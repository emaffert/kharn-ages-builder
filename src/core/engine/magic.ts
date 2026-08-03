/**
 * Dérivations magie/équipement d'une figurine (fonctions pures, sans UI).
 * Servent au calcul de capacité de pages, aux voies lançables, aux sorts disponibles
 * et à la validation de l'emplacement d'armure - cf. docs/regles-creation-liste.md.
 * La limitation de mains ne s'applique qu'en jeu : elle n'est pas validée au recrutement.
 */
import type { Catalog, Effect, Profile, SpecialCard, Spell } from "../model";
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
 * Compétence « Archimage » : maîtrise **toutes** les voies de magie, sans compétence d'école. Elle se
 * suffit à elle-même et s'octroie comme n'importe quelle compétence (ex. « Grimoire de Josève » →
 * `grant-skill` sur son porteur). Pas de trait jumeau à tenir à jour, contrairement à `apatride`.
 */
export const ARCHIMAGE_SKILL_ID = "archimage";

/**
 * Voies de magie lançables : la figurine possède la compétence qui maîtrise cette voie
 * (MagicWay.skillId), qu'elle soit native ou octroyée par effet (`grantedSkillIds`, ex. Apprentie
 * de Nyx → ostéomancie via `grant-skill`). Cartes comme équipement confèrent désormais le lancement
 * par cette voie (octroi de la compétence), plus par un flag `grantsCasting` dédié.
 * « Archimage » ouvre d'un coup toutes les voies du catalogue (cf. `ARCHIMAGE_SKILL_ID`).
 */
export function castWays(
  cat: Catalog,
  profile: Profile,
  _inst: ProfileInstance,
  _traits: ReadonlySet<string>,
  grantedSkillIds: readonly string[] = [],
): string[] {
  const skillIds = new Set<string>([...profile.skills.map((s) => s.skillId), ...grantedSkillIds]);
  if (skillIds.has(ARCHIMAGE_SKILL_ID)) return cat.magicWays.map((w) => w.id);
  return cat.magicWays
    .filter((w) => w.skillId != null && skillIds.has(w.skillId))
    .map((w) => w.id);
}

/** Une source de pages : un effet `spell-pages` (profil, carte/amélioration ou équipement). `magicWayId` = pool dédié à une voie. */
export type PageSource = { name: string; amount: number; magicWayId?: string };

/**
 * Effets **portés** par une figurine, calculables sans aucun contexte de liste : ceux de son profil,
 * ceux des cartes qui la visent (une amélioration ne compte que si elle est achetée) et ceux de
 * l'équipement qu'elle a sur elle.
 *
 * C'est la base des opérations que le moteur ne résout pas dans son pipeline d'occurrences
 * (`spell-pages`, `grant-spell`, `grant-spell-choice`) : elles doivent rester calculables sur une fiche
 * isolée - aperçu de profil avant recrutement, panneau de magie qui simule un équipement - où aucune
 * liste n'existe.
 * Elles ne visent donc jamais que le porteur, et ne peuvent pas être conditionnelles.
 */
function borneEffects(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
  traits: ReadonlySet<string>,
): { name: string; effect: Effect }[] {
  const selected = inst.specialCardIds ?? [];
  const out: { name: string; effect: Effect }[] = [];
  for (const e of profile.effects ?? []) out.push({ name: profile.name, effect: e });
  for (const c of cat.specialCards) {
    if (cardApplies(c, profile, traits, selected)) for (const e of c.effects) out.push({ name: c.name, effect: e });
  }
  for (const id of wornEquipmentIds(profile, inst)) {
    const eq = cat.equipment.find((x) => x.id === id);
    if (!eq) continue;
    for (const e of eq.effects ?? []) out.push({ name: eq.name, effect: e });
  }
  return out;
}

/**
 * Sources de pages conférées à la figurine (ex. Fille de Nyx +3, Crosse +3, Brassards d'Euthéria :
 * 5 pages Adansonia + 5 pages shamanisme). `magicWayId` renseigné = pool dédié (cf. `pageAllocation`).
 */
export function pageBonusSources(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
  traits: ReadonlySet<string>,
): PageSource[] {
  return borneEffects(cat, profile, inst, traits)
    .flatMap(({ name, effect }) =>
      effect.operation.kind === "spell-pages"
        ? [{ name, amount: effect.operation.amount, magicWayId: effect.operation.magicWayId }]
        : [],
    )
    .filter((s) => s.amount > 0);
}

/**
 * Sorts connus d'office (« de signature ») : gratuits, hors budget de pages, affichés même sur une
 * figurine qui ne lance pas de sorts. Ex. Alaric → « Lien Mental ».
 */
export function innateSpellIds(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
  traits: ReadonlySet<string>,
): string[] {
  const ids = borneEffects(cat, profile, inst, traits).flatMap(({ effect }) =>
    effect.operation.kind === "grant-spell" && effect.target.self ? [effect.operation.spellId] : [],
  );
  return [...new Set(ids)];
}

/**
 * Une offre de sorts au choix portée par la figurine (effet `grant-spell-choice`) : `count` sorts à
 * prendre dans `choices`, hors de tout budget. Une offre par effet, pour que deux sources gardent
 * chacune son quota.
 */
export interface SpellGrant {
  /** Identifiant de l'effet : c'est la clé de `ProfileInstance.grantedSpellIds`. */
  effectId: string;
  /** Nom de la source (profil, carte, objet), pour dire au joueur d'où vient l'offre. */
  name: string;
  count: number;
  /** Sorts éligibles, réservations comprises. Vide = offre inexploitable (sélection non renseignée). */
  choices: Spell[];
}

/**
 * Offres de sorts au choix conférées à la figurine (ex. Demi-soeur : 1 sort d'Ostéomancie).
 * La sélection réunit la voie (`magicWayId`) et la liste explicite (`spellIds`) ; la réservation du
 * sort s'applique comme partout ailleurs. La maîtrise de la voie n'est PAS exigée : l'offre vaut
 * connaissance du sort, comme un sort de signature.
 */
export function spellGrants(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
  traits: ReadonlySet<string>,
): SpellGrant[] {
  return borneEffects(cat, profile, inst, traits).flatMap(({ name, effect }) => {
    const op = effect.operation;
    if (op.kind !== "grant-spell-choice" || !effect.target.self) return [];
    const explicit = new Set(op.spellIds ?? []);
    const choices = cat.spells.filter(
      (s) =>
        (explicit.has(s.id) || (op.magicWayId != null && s.magicWayId === op.magicWayId)) &&
        spellReservationOk(s, profile, traits),
    );
    return [{ effectId: effect.id, name, count: Math.max(0, Math.floor(op.count ?? 1)), choices }];
  });
}

/** Sorts offerts effectivement retenus, tous effets confondus (dédoublonnés, dans l'ordre de saisie). */
export function grantedSpellIds(inst: ProfileInstance): string[] {
  return [...new Set(Object.values(inst.grantedSpellIds ?? {}).flat())];
}

export function pageBonus(cat: Catalog, profile: Profile, inst: ProfileInstance, traits: ReadonlySet<string>): number {
  return pageBonusSources(cat, profile, inst, traits).reduce((n, s) => n + s.amount, 0);
}

export function grimoirePages(cat: Catalog, grimoireId?: string): number {
  if (!grimoireId) return 0;
  const pages = cat.grimoires.find((g) => g.id === grimoireId)?.pages;
  return pages === "illimite" ? Infinity : (pages ?? 0);
}

/** Un pool de pages dédié à une voie de magie (ex. Brassards d'Euthéria → Adansonia). */
export interface PagePool {
  wayId: string;
  wayName: string;
  /** Nom(s) de la ou des sources qui fournissent ce pool (ex. « Brassards d'Euthéria »). */
  label: string;
  cap: number;
  used: number;
}

/**
 * Répartition des pages de sorts : un budget GÉNÉRAL (grimoire + bonus non dédiés) + des POOLS dédiés
 * à une voie (Brassards). Attribution optimale : chaque sort de voie X remplit d'abord le pool dédié à X
 * (s'il existe), le surplus déborde sur le budget général. `over` = débordement du général (liste invalide).
 */
export interface PageAllocation {
  general: { cap: number; used: number };
  pools: PagePool[];
  /** Somme des pages de tous les sorts sélectionnés (dédiés + généraux). */
  totalUsed: number;
  /** true si le budget général est dépassé (les pools dédiés absorbent d'abord). */
  over: boolean;
}

/**
 * Pages qu'un pool de capacité `cap` peut absorber parmi des sorts de tailles `sizes` (en pages).
 * Un sort est ATOMIQUE (il ne peut pas être scindé entre le pool et le grimoire général) → on cherche
 * le sous-ensemble de somme maximale ≤ `cap` (knapsack 0/1, valeur = poids). Ex. tailles [2,2,2], cap 5
 * → 4 (deux sorts ; le 3ᵉ, 2 pages, ne rentre pas dans la page restante et part au général).
 */
export function maxPagesInPool(sizes: readonly number[], cap: number): number {
  if (!Number.isFinite(cap)) return sizes.reduce((n, s) => n + s, 0);
  const dp = new Array<number>(cap + 1).fill(0);
  for (const s of sizes) {
    if (s <= 0 || s > cap) continue;
    for (let c = cap; c >= s; c--) dp[c] = Math.max(dp[c], dp[c - s] + s);
  }
  return dp[cap];
}

export function pageAllocation(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
  traits: ReadonlySet<string>,
): PageAllocation {
  const sources = pageBonusSources(cat, profile, inst, traits);
  let generalCap = grimoirePages(cat, inst.grimoireId);
  const poolCaps = new Map<string, { labels: Set<string>; cap: number }>();
  for (const s of sources) {
    if (s.magicWayId) {
      const e = poolCaps.get(s.magicWayId) ?? { labels: new Set<string>(), cap: 0 };
      e.cap += s.amount;
      e.labels.add(s.name);
      poolCaps.set(s.magicWayId, e);
    } else {
      generalCap += s.amount;
    }
  }
  // Tailles (en pages) des sorts sélectionnés, par voie (sorts sans pages/voie n'occupent pas de pool).
  // Les génériques sont hors grimoire : ils se comptent en niveaux (cf. `genericSpellAllocation`).
  const byWaySizes = new Map<string, number[]>();
  let totalUsed = 0;
  for (const id of inst.spellIds) {
    const sp = cat.spells.find((x) => x.id === id);
    if (sp?.kind === "generique") continue;
    const pages = sp?.pages ?? 0;
    if (pages <= 0) continue;
    totalUsed += pages;
    if (sp?.magicWayId) {
      const arr = byWaySizes.get(sp.magicWayId) ?? [];
      arr.push(pages);
      byWaySizes.set(sp.magicWayId, arr);
    }
  }
  // Attribution optimale : chaque pool absorbe le plus de pages possible (placement atomique des sorts),
  // le reste (surplus + voies sans pool) va au budget général.
  const pools: PagePool[] = [...poolCaps.entries()].map(([wayId, e]) => ({
    wayId,
    wayName: cat.magicWays.find((w) => w.id === wayId)?.name ?? wayId,
    label: [...e.labels].join(", "),
    cap: e.cap,
    used: maxPagesInPool(byWaySizes.get(wayId) ?? [], e.cap),
  }));
  const pooledUsed = pools.reduce((n, p) => n + p.used, 0);
  const generalUsed = totalUsed - pooledUsed;
  return {
    general: { cap: generalCap, used: generalUsed },
    pools,
    totalUsed,
    over: Number.isFinite(generalCap) && generalUsed > generalCap,
  };
}

/** Capacité totale de pages (général + pools dédiés). Pour l'affichage/compat ; la validité passe par `pageAllocation.over`. */
export function pageCapacity(cat: Catalog, profile: Profile, inst: ProfileInstance, traits: ReadonlySet<string>): number {
  const a = pageAllocation(cat, profile, inst, traits);
  return a.general.cap + a.pools.reduce((n, p) => n + p.cap, 0);
}

export function pagesUsed(cat: Catalog, inst: ProfileInstance): number {
  return inst.spellIds.reduce((n, id) => {
    const s = cat.spells.find((x) => x.id === id);
    return s == null || s.kind === "generique" ? n : n + (s.pages ?? 0);
  }, 0);
}

/** Coût en niveaux d'un sort générique : 1 par défaut, davantage pour les plus puissants (Passe-Passe : 3). */
export function spellLevelCost(spell: Spell): number {
  return spell.levelCost ?? 1;
}

/**
 * Budget de sorts **génériques**, compté en niveaux et non en pages : un lanceur peut en connaître
 * autant que son niveau (un profil de niveau 3 dispose de 3 niveaux de sorts génériques), chaque sort
 * en consommant `levelCost`. Indépendant du grimoire, qui ne finance que les sorts de voie.
 */
export interface GenericSpellAllocation {
  cap: number;
  used: number;
  over: boolean;
}

export function genericSpellAllocation(cat: Catalog, profile: Profile, inst: ProfileInstance): GenericSpellAllocation {
  const used = inst.spellIds.reduce((n, id) => {
    const s = cat.spells.find((x) => x.id === id);
    return s?.kind === "generique" ? n + spellLevelCost(s) : n;
  }, 0);
  const cap = profile.level ?? 1;
  return { cap, used, over: used > cap };
}

/** Grimoires que la figurine ne peut pas acquérir (contrainte `forbids-grimoire` de son profil). */
export function forbiddenGrimoires(profile: Profile): Set<string> {
  const out = new Set<string>();
  for (const c of profile.recruitment) {
    if (c.type !== "forbids-grimoire") continue;
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

/** Une compétence octroyée par effet, avec sa valeur éventuelle (ex. Affinité « Shamanisme »). */
export type GrantedSkillRef = { skillId: string; value?: string | number };

/**
 * Voies accessibles via la compétence « Affinité X » : le mage peut mettre dans son grimoire les sorts
 * normalement réservés à la voie/faction X, EN PLUS de la sienne (ex. Néphtys : Affinité « Shamanisme »).
 * `X` (valeur de la compétence, ex. « Shamanisme ») est résolu contre l'id, le nom de la voie, ou le
 * mot-clé de sa compétence de maîtrise. La compétence peut être native ou octroyée par effet
 * (`grantedSkills`, ex. un objet qui confère une affinité) ; une Affinité sans valeur n'ouvre rien.
 * N'accorde PAS le lancement natif de la voie (pas de bonus d'incantation) : sert uniquement à élargir
 * la sélection de sorts de grimoire (réservations profil/trait plus fines toujours appliquées,
 * cf. `castableSpells`).
 */
export function affinityWays(
  cat: Catalog,
  profile: Profile,
  grantedSkills: readonly GrantedSkillRef[] = [],
): string[] {
  const values = [...profile.skills, ...grantedSkills]
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

/**
 * La figurine satisfait-elle la réservation d'un sort ? Une réservation absente n'exclut personne ;
 * sinon il suffit de valider *une* des dimensions (trait, profil nommé, faction).
 */
function spellReservationOk(spell: Spell, profile: Profile, traits: ReadonlySet<string>): boolean {
  const r = spell.reservedTo;
  if (!r) return true;
  return (
    (r.trait != null && traits.has(r.trait)) ||
    (r.profileIds?.includes(profile.id) ?? false) ||
    (profile.factionId != null && (r.factionIds?.includes(profile.factionId) ?? false))
  );
}

/**
 * Sorts lançables : génériques (ouverts à tout lanceur) + sorts des voies maîtrisées ou d'affinité.
 * `ways` porte déjà les voies de l'Archimage (toutes), qui voit donc tous les sorts de grimoire.
 * Une figurine qui ne maîtrise aucune voie ne lance rien du tout, pas même un générique.
 * La réservation s'applique dans tous les cas, y compris aux génériques : un générique réservé à un
 * personnage ou à une faction ne doit apparaître que là (ex. « Passe-Passe » → Bharbathos).
 * Un sort de voie sans voie renseignée n'est lançable par personne : c'est un brouillon d'admin,
 * qui ne doit pas fuiter dans le constructeur avant d'être achevé.
 */
export function castableSpells(
  cat: Catalog,
  profile: Profile,
  traits: ReadonlySet<string>,
  ways: string[],
  grantedSkills: readonly GrantedSkillRef[] = [],
): Spell[] {
  const allWays = new Set([...ways, ...affinityWays(cat, profile, grantedSkills)]);
  if (allWays.size === 0) return [];
  return cat.spells.filter((s) => {
    if (!spellReservationOk(s, profile, traits)) return false;
    if (s.kind === "generique") return true;
    return s.magicWayId != null && allWays.has(s.magicWayId);
  });
}

/**
 * Armures portées, réparties selon les deux emplacements : `standard` (une seule par Safar) et
 * `stackable` (une armure cumulable en plus, ex. le Gambison - cf. `Equipment.stacksWithArmor`).
 */
export function armorsWorn(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
): { standard: number; stackable: number } {
  const armors = wornEquipmentIds(profile, inst)
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => e?.category === "armure");
  return {
    standard: armors.filter((e) => !e.stacksWithArmor).length,
    stackable: armors.filter((e) => e.stacksWithArmor).length,
  };
}
