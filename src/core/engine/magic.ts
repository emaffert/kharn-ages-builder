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

/** Une source de pages : un effet `spell-pages` (carte/amélioration ou équipement). `magicWayId` = pool dédié à une voie. */
export type PageSource = { name: string; amount: number; magicWayId?: string };

/**
 * Sources de pages conférées à la figurine : cartes/améliorations applicables (Fille de Nyx +3, Crosse +3…)
 * ET équipement porté (ex. Brassards d'Euthéria : 5 pages Adansonia + 5 pages shamanisme). Chaque source
 * porte un effet `spell-pages` ; `magicWayId` renseigné = pool dédié à cette voie (cf. `pageAllocation`).
 */
export function pageBonusSources(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
  traits: ReadonlySet<string>,
): PageSource[] {
  const selected = inst.specialCardIds ?? [];
  const toSource = (name: string, op: { amount?: number; magicWayId?: string }): PageSource => ({
    name,
    amount: op.amount ?? 0,
    magicWayId: op.magicWayId,
  });
  const asPages = (op: unknown) => op as { amount?: number; magicWayId?: string };
  const fromCards = cat.specialCards
    .filter((c) => cardApplies(c, profile, traits, selected))
    .flatMap((c) => c.effects.filter((e) => e.operation.kind === "spell-pages").map((e) => toSource(c.name, asPages(e.operation))));
  const fromEquipment = wornEquipmentIds(profile, inst)
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .flatMap((e) => (e.effects ?? []).filter((ef) => ef.operation.kind === "spell-pages").map((ef) => toSource(e.name, asPages(ef.operation))));
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
  const byWaySizes = new Map<string, number[]>();
  let totalUsed = 0;
  for (const id of inst.spellIds) {
    const sp = cat.spells.find((x) => x.id === id);
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
