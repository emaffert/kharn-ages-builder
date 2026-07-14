/**
 * Dérivations magie/équipement d'une figurine (fonctions pures, sans UI).
 * Servent au calcul de capacité de pages, aux voies lançables, aux sorts disponibles
 * et à la validation de l'emplacement d'armure - cf. docs/regles-creation-liste.md.
 * La limitation de mains ne s'applique qu'en jeu : elle n'est pas validée au recrutement.
 */
import type { Catalog, Profile, SpecialCard, Spell } from "../model";
import type { ProfileInstance } from "../model";

/** Équipement effectivement porté : équipement de base non retiré + équipement acheté. */
export function wornEquipmentIds(profile: Profile, inst: ProfileInstance): string[] {
  return [
    ...profile.baseEquipmentIds.filter((id) => !inst.removedBaseEquipmentIds.includes(id)),
    ...inst.addedEquipmentIds,
  ];
}

/** Une carte s'applique-t-elle à la figurine ? (auto selon la portée, ou amélioration sélectionnée). */
function cardApplies(card: SpecialCard, profile: Profile, traits: ReadonlySet<string>, selected: string[]): boolean {
  const scope =
    (card.scope.profileIds?.includes(profile.id) ?? false) ||
    (card.scope.trait ? traits.has(card.scope.trait) : false) ||
    (card.scope.factionIds && profile.factionId ? card.scope.factionIds.includes(profile.factionId) : false);
  return card.amelioration ? scope && selected.includes(card.id) : scope;
}

/**
 * Voies de magie lançables : la figurine possède la compétence qui maîtrise cette voie
 * (MagicWay.skillId), qu'elle soit native ou octroyée par effet (`grantedSkillIds`, ex. Apprentie
 * de Nyx → ostéomancie via `grant-skill`). Cartes comme équipement confèrent désormais le lancement
 * par cette voie (octroi de la compétence), plus par un flag `grantsCasting` dédié.
 */
export function castWays(
  cat: Catalog,
  profile: Profile,
  _inst: ProfileInstance,
  _traits: ReadonlySet<string>,
  grantedSkillIds: readonly string[] = [],
): string[] {
  const skillIds = new Set<string>([...profile.skills.map((s) => s.skillId), ...grantedSkillIds]);
  return cat.magicWays
    .filter((w) => w.skillId != null && skillIds.has(w.skillId))
    .map((w) => w.id);
}

/**
 * Sources de pages conférées à la figurine : cartes/améliorations applicables (Fille de Nyx +3, Crosse +3…)
 * ET équipement porté (ex. Brassards d'Euthéria +5 pages). Chaque source porte un effet `spell-pages`.
 * NB : la restriction de la source à un unique arcane (Brassards) n'est pas encore modélisée - les pages
 * alimentent le budget global (cf. `pageCapacity`).
 */
export function pageBonusSources(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
  traits: ReadonlySet<string>,
): { name: string; amount: number }[] {
  const selected = inst.specialCardIds ?? [];
  const fromCards = cat.specialCards
    .filter((c) => cardApplies(c, profile, traits, selected))
    .flatMap((c) =>
      c.effects
        .filter((e) => e.operation.kind === "spell-pages")
        .map((e) => ({ name: c.name, amount: (e.operation as { amount?: number }).amount ?? 0 })),
    );
  const fromEquipment = wornEquipmentIds(profile, inst)
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .flatMap((e) =>
      (e.effects ?? [])
        .filter((ef) => ef.operation.kind === "spell-pages")
        .map((ef) => ({ name: e.name, amount: (ef.operation as { amount?: number }).amount ?? 0 })),
    );
  return [...fromCards, ...fromEquipment].filter((s) => s.amount > 0);
}

export function pageBonus(cat: Catalog, profile: Profile, inst: ProfileInstance, traits: ReadonlySet<string>): number {
  return pageBonusSources(cat, profile, inst, traits).reduce((n, s) => n + s.amount, 0);
}

export function grimoirePages(cat: Catalog, grimoireId?: string): number {
  if (!grimoireId) return 0;
  const pages = cat.grimoires.find((g) => g.id === grimoireId)?.pages;
  return pages === "illimite" ? Infinity : (pages ?? 0);
}

/** Capacité totale de pages : grimoire + bonus des cartes/améliorations. */
export function pageCapacity(cat: Catalog, profile: Profile, inst: ProfileInstance, traits: ReadonlySet<string>): number {
  return grimoirePages(cat, inst.grimoireId) + pageBonus(cat, profile, inst, traits);
}

export function pagesUsed(cat: Catalog, inst: ProfileInstance): number {
  return inst.spellIds.reduce((n, id) => n + (cat.spells.find((s) => s.id === id)?.pages ?? 0), 0);
}

/** Grimoires que la figurine ne peut pas acquérir (param `forbidGrimoires` d'une contrainte de profil). */
export function forbiddenGrimoires(profile: Profile): Set<string> {
  const out = new Set<string>();
  for (const c of profile.recruitment) {
    (c.params as { forbidGrimoires?: string[] })?.forbidGrimoires?.forEach((g) => out.add(g));
  }
  return out;
}

const AFFINITY_SKILL_ID = "affinite";

/** Normalise un libellé pour comparer une valeur d'« Affinité X » à une voie (casse/accents/ponctuation). */
function normLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques combinants
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Voies accessibles via la compétence « Affinité X » : le mage peut mettre dans son grimoire les sorts
 * normalement réservés à la voie/faction X, EN PLUS de la sienne (ex. Néphtys : Affinité « Shamanisme »).
 * `X` (valeur de la compétence, ex. « Shamanisme ») est résolu contre l'id, le nom de la voie, ou le
 * mot-clé de sa compétence de maîtrise. N'accorde PAS le lancement natif de la voie (pas de bonus
 * d'incantation) : sert uniquement à élargir la sélection de sorts de grimoire (réservations profil/trait
 * plus fines toujours appliquées, cf. `castableSpells`).
 */
export function affinityWays(cat: Catalog, profile: Profile): string[] {
  const values = profile.skills
    .filter((s) => s.skillId === AFFINITY_SKILL_ID && s.value != null)
    .map((s) => normLabel(String(s.value)));
  if (values.length === 0) return [];
  const out = new Set<string>();
  for (const w of cat.magicWays) {
    const kw = w.skillId ? cat.skills.find((k) => k.id === w.skillId)?.keyword : undefined;
    const labels = [w.id, w.name, kw].filter((x): x is string => Boolean(x)).map(normLabel);
    if (values.some((v) => labels.includes(v))) out.add(w.id);
  }
  return [...out];
}

/** Sorts lançables : génériques (tout lanceur) + sorts des voies maîtrisées ou d'affinité (réservations respectées). */
export function castableSpells(
  cat: Catalog,
  profile: Profile,
  traits: ReadonlySet<string>,
  ways: string[],
): Spell[] {
  const allWays = new Set([...ways, ...affinityWays(cat, profile)]);
  return cat.spells.filter((s) => {
    if (s.kind === "generique") return true;
    if (s.magicWayId && !allWays.has(s.magicWayId)) return false;
    if (s.reservedTo) {
      const okTrait = s.reservedTo.trait ? traits.has(s.reservedTo.trait) : false;
      const okProfile = s.reservedTo.profileIds?.includes(profile.id) ?? false;
      if (!okTrait && !okProfile) return false;
    }
    return true;
  });
}

/** Nombre d'armures portées (pour le plafond d'une seule armure). */
export function armorsWorn(cat: Catalog, profile: Profile, inst: ProfileInstance): number {
  return wornEquipmentIds(profile, inst).filter(
    (id) => cat.equipment.find((e) => e.id === id)?.category === "armure",
  ).length;
}
