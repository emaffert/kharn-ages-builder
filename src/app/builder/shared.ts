import {
  castWays as coreCastWays,
  pageBonusSources as corePageBonusSources,
  innateSpellIds as coreInnateSpellIds,
  spellGrants as coreSpellGrants,
  armorRole,
  pageAllocation as corePageAllocation,
  genericSpellAllocation as coreGenericSpellAllocation,
  spellLevelCost as coreSpellLevelCost,
  forbiddenGrimoires as coreForbiddenGrimoires,
  castableSpells as coreCastableSpells,
  eligibleMountsFor as coreEligibleMountsFor,
  equipmentAllowedIn,
  isApatride,
  isRecruitableIn,
  isSlaveIn,
  openRecruitmentAccepts,
  originFactionId,
  mountKindOf,
  mountOptionCostOf,
  sealRequiredFor,
  FRERE_D_ARMES,
} from "@core";
import type {
  Armor,
  Catalog,
  GenericSpellAllocation,
  GrantedSkillRef,
  MountOption,
  PageAllocation,
  PageSource,
  Profile,
  ProfileInstance,
  Selector,
  Spell,
  SpellGrant,
} from "@core";
import type { ArmorDisplay } from "./StatSheet";
// Libellés de présentation partagés avec l'admin (source unique dans @ui) - alias pour garder les noms locaux.
import { STAT_LABELS as STATS, LEVEL_LABEL as LEVEL } from "@ui";

/**
 * Constantes, helpers purs et types partagés par les composants du constructeur.
 * Aucun rendu ici : uniquement des données et de la logique dérivée du catalogue/liste.
 */

export { STATS, LEVEL };

/**
 * Lignes d'achat d'options de monture (p.32) pour un ensemble de paniers, avec leur coût unitaire.
 * Sert à grouper l'achat de compétences en une seule entrée « Compétences +X Ko » dans les résumés.
 * Le libellé est le mot-clé de la compétence conférée (+ valeur X si l'option en a une), sinon le nom de l'option.
 */
export function mountOptionLines(
  cat: Catalog,
  mountOptionIds: Record<string, number> | undefined,
  buckets: MountOption["bucket"][],
  mountId?: string,
): { label: string; cost: number }[] {
  const kind = mountKindOf(cat, mountId);
  return Object.entries(mountOptionIds ?? {})
    .map(([oid, val]) => {
      const opt = cat.mountOptions.find((o) => o.id === oid);
      return opt ? { opt, val } : null;
    })
    .filter((x): x is { opt: MountOption; val: number } => x != null && buckets.includes(x.opt.bucket))
    .map(({ opt, val }) => {
      const kw = opt.grantsSkill
        ? (cat.skills.find((s) => s.id === opt.grantsSkill!.skillId)?.keyword ?? opt.name)
        : opt.name;
      return { label: `${kw}${opt.maxValue != null ? ` ${val}` : ""}`, cost: mountOptionCostOf(opt, val, kind) };
    });
}

/**
 * **Toutes** les protections à afficher pour un porteur : une ligne par protection, dans l'ordre où
 * elles se lisent sur la fiche.
 *
 * Une armure ordinaire achetée **remplace** l'armure innée - on n'en porte qu'une. Tout le reste
 * s'**ajoute** : le Gambison, qui a son emplacement propre, et les objets qui protègent sans être
 * des armures (Vouge de Moringa). D'où plusieurs lignes possibles : armure + gambison + vouge.
 *
 * `upgradesByEquip` (optionnel) suffixe le libellé avec les améliorations actives (ex. « Pointes acérées »).
 * `innateArmor` (optionnel) : armure innée du porteur - affichée si rien ne la remplace, et lue pour
 * le `heavySeuil` conditionnel (Armure de Combat Khârne : seuil abaissé si le porteur est déjà au
 * moins aussi protégé).
 */
export function wornArmorsFrom(
  cat: Catalog,
  equipmentIds: string[],
  upgradesByEquip?: Record<string, string[]>,
  innateArmor?: Armor,
): ArmorDisplay[] {
  const alreadyProtected = (e: Catalog["equipment"][number]) =>
    innateArmor?.protectionEchec != null &&
    innateArmor.protectionReussite != null &&
    e.protectionEchec != null &&
    e.protectionReussite != null &&
    innateArmor.protectionEchec <= e.protectionEchec &&
    innateArmor.protectionReussite <= e.protectionReussite;
  const line = (e: Catalog["equipment"][number]): ArmorDisplay => {
    const upIds = upgradesByEquip?.[e.id] ?? [];
    const upNames = (e.upgrades ?? []).filter((u) => upIds.includes(u.id)).map((u) => u.label);
    // « Possède déjà ces caractéristiques » → seuil de réussite amélioré (heavySeuil).
    const seuil = e.heavySeuil != null && alreadyProtected(e) ? e.heavySeuil : e.seuil;
    return {
      label: `🛡 ${e.name}${upNames.length ? ` (${upNames.join(", ")})` : ""}`,
      protectionEchec: e.protectionEchec,
      seuil,
      protectionReussite: e.protectionReussite,
      durability: e.durability,
    };
  };
  const worn = equipmentIds
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e) && armorRole(e!) != null);
  const roled = (role: ReturnType<typeof armorRole>) => worn.filter((e) => armorRole(e) === role);
  const standard = roled("standard");
  const innateLine: ArmorDisplay[] = innateArmor
    ? [
        {
          label: "🛡 Armure",
          protectionEchec: innateArmor.protectionEchec,
          seuil: innateArmor.seuil,
          protectionReussite: innateArmor.protectionReussite,
          durability: innateArmor.durability,
        },
      ]
    : [];
  return [
    ...(standard.length > 0 ? standard.map(line) : innateLine),
    ...roled("stackable").map(line),
    ...roled("extra").map(line),
  ];
}

// Groupes de stats comme sur les cartes officielles : combat (V P A C) puis (T I).
export const STATS_COMBAT: [keyof Profile["stats"], string][] = STATS.slice(0, 4);
export const STATS_SECONDARY: [keyof Profile["stats"], string][] = STATS.slice(4);

export type EmblemKind = "fangs" | "kharns" | "gouns" | "kherops" | "tembos" | "guilde" | "affranchis";

/**
 * Les 6 factions (livre de règles, p. 6) + les Affranchis. `accent`/`deep` : ancienne palette
 * (écrans non migrés). `color`/`colorBright`/`colorDeep`/`emblem` : identité « Forge/Braise »
 * (blasons placeholders - à remplacer par les vrais logos quand ils seront disponibles).
 * `transverse` : « faction » sans figurines propres qui recrute parmi les autres (Affranchis).
 */
export const FACTIONS: {
  id: string;
  name: string;
  accent: string;
  deep: string;
  blurb: string;
  color: string;
  colorBright: string;
  colorDeep: string;
  emblem: EmblemKind;
  transverse?: boolean;
}[] = [
  { id: "fangs", name: "Fangs", accent: "#7a4a2b", deep: "#4a2f1c", blurb: "Les enfants de Nyx, dans la Tanière.", color: "#b0472b", colorBright: "#e0553f", colorDeep: "#5e1a13", emblem: "fangs" },
  { id: "kharns", name: "Khârns", accent: "#2b3a5a", deep: "#16223d", blurb: "Les représentants de la Couronne et de ses vassaux.", color: "#3d5f95", colorBright: "#7aa0d6", colorDeep: "#16223d", emblem: "kharns" },
  { id: "gouns", name: "Goüns", accent: "#4f6a34", deep: "#2c3a1a", blurb: "Un peuple shamanique des plaines Dogons.", color: "#5f7a3e", colorBright: "#93b366", colorDeep: "#2c3a1a", emblem: "gouns" },
  { id: "kherops", name: "Khérops", accent: "#7a5a2b", deep: "#40300f", blurb: "Les soldats de l'Empereur des steppes et de ses fils.", color: "#9a6b2a", colorBright: "#d0a24a", colorDeep: "#40300f", emblem: "kherops" },
  { id: "tembos", name: "Tembos", accent: "#2f6a60", deep: "#123a34", blurb: "Anciens maîtres de Safar, retirés dans la forêt d'Euthéria.", color: "#2f7168", colorBright: "#5fa89c", colorDeep: "#123a34", emblem: "tembos" },
  { id: "guilde-noire", name: "Guilde Noire", accent: "#2f2a26", deep: "#141210", blurb: "Les renégats ayant choisi d'adhérer aux préceptes de la guilde.", color: "#736784", colorBright: "#a99bbd", colorDeep: "#241f2d", emblem: "guilde" },
  { id: "affranchis", name: "Affranchis", accent: "#4a463f", deep: "#201d18", blurb: "Rassemblement de la plupart des peuples de Safar qui, fuyant la guerre, se sont trouvé une raison commune de s'unir.", color: "#54504a", colorBright: "#8a8278", colorDeep: "#2a2723", emblem: "affranchis", transverse: true },
];

/** Porteur d'un profil dépendant, extrait de ses contraintes (attachment ou requires-present). */
type CarrierSpec = { trait?: string; profileIds?: string[]; modelIds?: string[]; requiredProfileId?: string };

function carrierSpec(p: Profile, cat: Catalog): CarrierSpec | null {
  for (const c of p.recruitment) {
    if (c.type !== "attachment") continue;
    const car = (c.params as { carrier?: CarrierSpec }).carrier;
    if (car && (car.trait || car.profileIds?.length || car.modelIds?.length)) {
      return { trait: car.trait, profileIds: car.profileIds, modelIds: car.modelIds };
    }
  }
  // requires-present : porté par le profil ou par une carte spéciale (ex. Muskh via Xayìn).
  const all = [...p.recruitment, ...cat.specialCards.flatMap((s) => s.constraints)];
  for (const c of all) {
    if (c.type !== "requires-present") continue;
    const params = c.params as { subjectProfileId?: string; requiredProfileId?: string };
    if (params.subjectProfileId === p.id && params.requiredProfileId) {
      return { requiredProfileId: params.requiredProfileId };
    }
  }
  return null;
}

/**
 * Une figurine recrutée uniquement via un porteur (ex. Likan, Muskh) - pas d'achat propre. Les
 * esclaves en font partie, mais **selon le Fer de Lance d'accueil** : la Porteuse d'eau se recrute
 * normalement chez les Goûns et les Tembos, et par un Seigneur de guerre partout ailleurs. D'où la
 * faction en paramètre : sans elle, on ne juge que les dépendances inconditionnelles.
 */
export const isDependent = (p: Profile, cat: Catalog, factionId?: string): boolean =>
  carrierSpec(p, cat) != null || (factionId != null && isSlaveIn(p, factionId));

/** Le dépendant occupe-t-il la capacité de rattachement du porteur (contrainte `attachment`) ? */
export const isAttachmentDependent = (p: Profile): boolean =>
  p.recruitment.some((c) => c.type === "attachment");

function carrierMatches(spec: CarrierSpec, carrier: Profile): boolean {
  if (spec.requiredProfileId) return carrier.id === spec.requiredProfileId;
  if (spec.trait && carrier.traits.includes(spec.trait)) return true;
  if (spec.profileIds?.includes(carrier.id)) return true;
  if (spec.modelIds && carrier.modelId != null && spec.modelIds.includes(carrier.modelId)) return true;
  return false;
}

/** Un groupe de figurines dépendantes (par modèle) recrutables via un porteur donné. */
export type DependentGroup = {
  modelId: string;
  modelName: string;
  profiles: Profile[];
  /** true => rattachement à capacité (Σ niveaux ≤ niveau du porteur), ex. Likan. */
  capacityLimited: boolean;
};

/** Figurines dépendantes qu'une figurine porteuse peut recruter, dérivées des contraintes du catalogue. */
export function recruitableDependentGroups(carrier: Profile, cat: Catalog): DependentGroup[] {
  const byModel = new Map<string, Profile[]>();
  for (const p of cat.profiles) {
    const spec = carrierSpec(p, cat);
    if (!spec || !carrierMatches(spec, carrier)) continue;
    const key = p.modelId ?? p.id;
    const list = byModel.get(key) ?? [];
    list.push(p);
    byModel.set(key, list);
  }
  return [...byModel].map(([modelId, profiles]) => {
    const sorted = [...profiles].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    return {
      modelId,
      modelName: cat.models.find((m) => m.id === modelId)?.name ?? sorted[0].name,
      profiles: sorted,
      capacityLimited: sorted.some(isAttachmentDependent),
    };
  });
}

// ── Garde du corps (désignation) ── Dérivé des effets portant un champ `designation`.

/** Correspondance identité d'un sélecteur sur un profil : ET entre dimensions, OU dedans. */
function selectorMatchesProfile(sel: Selector, p: Profile): boolean {
  let any = false;
  if (sel.profileIds?.length) {
    any = true;
    if (!sel.profileIds.includes(p.id)) return false;
  }
  if (sel.modelIds?.length) {
    any = true;
    if (!(p.modelId != null && sel.modelIds.includes(p.modelId))) return false;
  }
  if (sel.traits?.length) {
    any = true;
    if (!sel.traits.some((t) => p.traits.includes(t))) return false;
  }
  if (sel.factionIds?.length) {
    any = true;
    if (!(p.factionId != null && sel.factionIds.includes(p.factionId))) return false;
  }
  if (sel.levels?.length) {
    any = true;
    if (!(p.level != null && sel.levels.includes(p.level))) return false;
  }
  return any;
}

/** Nom par défaut de la liaison quand l'effet ne précise pas de `designation.label`. */
export const DEFAULT_LINK_LABEL = "garde du corps";

/** Un effet de désignation : `guardMatch` = qui est le garde, `of` = les figurines liables, `label` = nom de la liaison. */
type GuardDesignation = { guardMatch: (p: Profile) => boolean; of: Selector; label: string };

function guardDesignations(cat: Catalog): GuardDesignation[] {
  const out: GuardDesignation[] = [];
  for (const p of cat.profiles) {
    for (const e of p.effects ?? []) {
      if (!e.designation) continue;
      // `self` => le garde est la figurine source (ce profil) ; sinon la cible désigne le garde.
      const guardMatch = e.target.self
        ? (q: Profile) => q.id === p.id
        : (q: Profile) => selectorMatchesProfile(e.target, q);
      out.push({ guardMatch, of: e.designation.of, label: e.designation.label ?? DEFAULT_LINK_LABEL });
    }
  }
  for (const s of cat.specialCards) {
    for (const e of s.effects ?? []) {
      if (!e.designation || e.target.self) continue; // `self` sur une carte n'a pas de source unique
      out.push({
        guardMatch: (q: Profile) => selectorMatchesProfile(e.target, q),
        of: e.designation.of,
        label: e.designation.label ?? DEFAULT_LINK_LABEL,
      });
    }
  }
  return out;
}

/** Sélecteurs des protégés qu'un garde donné peut protéger (⋃ des désignations correspondantes). */
export function protecteeSelectorsFor(guard: Profile, cat: Catalog): Selector[] {
  return guardDesignations(cat)
    .filter((d) => d.guardMatch(guard))
    .map((d) => d.of);
}

/** Nom de la liaison qu'un garde donné propose (première désignation correspondante ; défaut « garde du corps »). */
export function designationLabelFor(guard: Profile, cat: Catalog): string {
  return guardDesignations(cat).find((d) => d.guardMatch(guard))?.label ?? DEFAULT_LINK_LABEL;
}

/** Un profil (protégé candidat) correspond-il à l'un de ces sélecteurs ? */
export function profileMatchesAnySelector(p: Profile, sels: Selector[]): boolean {
  return sels.some((s) => selectorMatchesProfile(s, p));
}

/** Modèle/figurine exact via lequel se recrute un profil dépendant (Likan → femelle Fang, Muskh → Xayìn). */
export function carrierLabel(p: Profile, cat: Catalog, factionId?: string): string | null {
  if (factionId != null && isSlaveIn(p, factionId)) return "un Seigneur de guerre";
  const name = (id?: string) =>
    cat.profiles.find((x) => x.id === id)?.name ?? cat.models.find((m) => m.id === id)?.name;
  // Attachment : porteur désigné par trait ou par identifiants. `label` = libellé lisible optionnel.
  for (const c of p.recruitment as { type: string; params?: Record<string, unknown> }[]) {
    if (c.type !== "attachment") continue;
    const car = c.params?.carrier as
      | { trait?: string; label?: string; profileIds?: string[]; modelIds?: string[] }
      | undefined;
    if (car?.trait) return car.label ?? car.trait;
    const names = [...(car?.profileIds ?? []), ...(car?.modelIds ?? [])].map(name).filter(Boolean);
    if (names.length) return names.join(" / ");
  }
  // requires-present : sur le profil ou porté par une carte spéciale (ex. Muskh via Xayìn).
  const constraints = [...p.recruitment, ...cat.specialCards.flatMap((s) => s.constraints)] as {
    type: string;
    params?: Record<string, unknown>;
  }[];
  for (const c of constraints) {
    if (c.type === "requires-present" && c.params?.subjectProfileId === p.id) {
      const req = name(c.params?.requiredProfileId as string | undefined);
      if (req) return req;
    }
  }
  return null;
}

/** Catégories d'équipement qu'une figurine peut acheter (hors munition/option de monture). */
export const PURCHASE_CATS = ["arme-cac", "arme-tir", "bouclier", "armure", "objet"];
export const CAT_LABEL: Record<string, string> = {
  "arme-cac": "Corps à corps",
  "arme-tir": "Tir",
  bouclier: "Bouclier",
  armure: "Armure",
  objet: "Objet",
};

/** Catégories d'équipement interdites à une figurine par une contrainte `forbids-equipment`. */
export function forbiddenCats(p: Profile, cat: Catalog): Set<string> {
  const forbidden = new Set<string>();
  const collect = (constraints: { type: string; params?: Record<string, unknown> }[]) => {
    for (const c of constraints) {
      if (c.type !== "forbids-equipment") continue;
      const target = c.params?.profileId as string | undefined;
      if (target && target !== p.id) continue;
      for (const cat of (c.params?.categories as string[] | undefined) ?? []) forbidden.add(cat);
    }
  };
  collect(p.recruitment);
  collect(cat.specialCards.flatMap((s) => s.constraints));
  return forbidden;
}

/**
 * Le profil peut-il exister en plusieurs exemplaires, et donc être dupliqué ?
 *
 * Non pour un profil **unique** (U) ni pour un **personnage** (P) : le second exemplaire n'existera
 * jamais, un bouton grisé en permanence n'apprendrait rien à personne. Partout ailleurs le bouton
 * s'affiche, quitte à se griser quand la limitation est atteinte (cf. `atLimit`).
 */
export const isDuplicable = (p: Profile) => p.limitation.kind !== "U" && p.limitation.kind !== "P";

/** Une figurine peut-elle acheter quelque chose ? Non si toutes les catégories d'achat sont interdites. */
export function canBuy(p: Profile, cat: Catalog): boolean {
  const forbidden = forbiddenCats(p, cat);
  return PURCHASE_CATS.some((c) => !forbidden.has(c));
}

/** Une figurine peut-elle porter cet objet dans un Fer de Lance de cette faction ? (réservations +
 *  arsenal perdu par un transfuge du recrutement ouvert). */
export const equipAllowedIn = equipmentAllowedIn;

// ── Magie ── Adaptateurs minces vers `src/core/engine/magic.ts` (logique unique côté cœur).
// Les panneaux travaillent avec (profil, listes) ; on synthétise une `ProfileInstance` pour appeler le cœur.

function synthInstance(p: Profile, selectedUpgrades: string[], wornEquipIds: string[]): ProfileInstance {
  return {
    instanceId: "",
    profileId: p.id,
    addedEquipmentIds: wornEquipIds,
    removedBaseEquipmentIds: p.baseEquipmentIds, // → équipement porté (cœur) = wornEquipIds
    spellIds: [],
    specialCardIds: selectedUpgrades,
  };
}

export const forbiddenGrimoires = (p: Profile) => coreForbiddenGrimoires(p);

export function castWays(
  p: Profile,
  cat: Catalog,
  selectedUpgrades: string[],
  wornEquipIds: string[] = p.baseEquipmentIds,
  grantedSkillIds: readonly string[] = [],
): string[] {
  return coreCastWays(cat, p, synthInstance(p, selectedUpgrades, wornEquipIds), new Set(p.traits), grantedSkillIds);
}

export function pageBonusSources(
  p: Profile,
  cat: Catalog,
  selectedUpgrades: string[],
  wornEquipIds: string[] = p.baseEquipmentIds,
): PageSource[] {
  return corePageBonusSources(cat, p, synthInstance(p, selectedUpgrades, wornEquipIds), new Set(p.traits));
}

/** Sorts connus d'office par la figurine (profil, carte qui la vise, équipement porté). */
export function innateSpellIds(
  p: Profile,
  cat: Catalog,
  selectedUpgrades: string[],
  wornEquipIds: string[] = p.baseEquipmentIds,
): string[] {
  return coreInnateSpellIds(cat, p, synthInstance(p, selectedUpgrades, wornEquipIds), new Set(p.traits));
}

/** Offres de sorts au choix portées par la figurine (profil, carte qui la vise, équipement porté). */
export function spellGrants(
  p: Profile,
  cat: Catalog,
  selectedUpgrades: string[],
  wornEquipIds: string[] = p.baseEquipmentIds,
): SpellGrant[] {
  return coreSpellGrants(cat, p, synthInstance(p, selectedUpgrades, wornEquipIds), new Set(p.traits));
}

export function pageBonus(p: Profile, cat: Catalog, selectedUpgrades: string[], wornEquipIds: string[] = p.baseEquipmentIds): number {
  return pageBonusSources(p, cat, selectedUpgrades, wornEquipIds).reduce((n, s) => n + s.amount, 0);
}

/** Répartition des pages de sorts (budget général + pools dédiés par voie, ex. Brassards) pour l'état courant. */
export function pageAllocation(
  p: Profile,
  cat: Catalog,
  selectedUpgrades: string[],
  wornEquipIds: string[],
  spellIds: string[],
  grimoireId?: string,
): PageAllocation {
  const inst: ProfileInstance = {
    ...synthInstance(p, selectedUpgrades, wornEquipIds),
    spellIds,
    grimoireId: grimoireId === "none" ? undefined : (grimoireId as ProfileInstance["grimoireId"]),
  };
  return corePageAllocation(cat, p, inst, new Set(p.traits));
}

/** Budget de sorts génériques (compté en niveaux) pour l'état courant. */
export function genericSpellAllocation(p: Profile, cat: Catalog, spellIds: string[]): GenericSpellAllocation {
  return coreGenericSpellAllocation(cat, p, { ...synthInstance(p, [], p.baseEquipmentIds), spellIds });
}

/** Sorts sélectionnables. `grantedSkills` porte les compétences octroyées (ex. une Affinité conférée par un objet). */
export function spellsFor(
  p: Profile,
  cat: Catalog,
  ways: string[],
  grantedSkills: readonly GrantedSkillRef[] = [],
): Spell[] {
  return coreCastableSpells(cat, p, new Set(p.traits), ways, grantedSkills);
}

/** Ce que coûte un sort dans son propre budget : des niveaux pour un générique, des pages sinon. */
export function spellBudgetBits(s: Spell): string {
  return s.kind === "generique" ? `${coreSpellLevelCost(s)} niv` : `${s.pages ?? 0} p`;
}

export function spellInfo(s: Spell, cat: Catalog): ItemInfo {
  const way = cat.magicWays.find((w) => w.id === s.magicWayId)?.name;
  const budget = s.kind === "generique" ? `${coreSpellLevelCost(s)} niveau(x)` : `${s.pages ?? 0} page(s)`;
  return {
    title: s.name,
    price: s.cost != null && s.cost > 0 ? `${s.cost} Ko` : "-",
    lines: [
      `${budget}${way ? ` · ${way}` : ""}`,
      `Cible : ${s.target}`,
      ...s.difficulties.map((d) => `${d.threshold}+ : ${d.effectText}`),
    ],
  };
}

/** Ligne de stats compacte d'un équipement pour les listes. */
export function equipBits(e: Catalog["equipment"][number]): string {
  const bits: string[] = [];
  if (e.category === "arme-cac") bits.push("CaC");
  if (e.category === "arme-tir") bits.push("Tir");
  if (e.hands) bits.push(e.hands === "1-2" ? "1/2 m" : `${e.hands} m`);
  if (e.allonge != null) bits.push(`All.${e.allonge}`);
  // Portée courte/longue, puis la max quand l'arme en a une (au-delà, elle ne peut pas tirer).
  if (e.range) bits.push(`Port.${e.range.short}/${e.range.long}${e.range.max != null ? ` max ${e.range.max}` : ""}`);
  if (e.seuil != null) bits.push(`Arm.${e.protectionEchec ?? "-"}/${e.seuil}/${e.protectionReussite ?? "-"}`);
  if (e.durability != null) bits.push(`DV ${e.durability}`);
  if (e.perceArmure != null) bits.push(`PA ${e.perceArmure}`);
  return bits.join(" · ");
}

/** Fiche d'un équipement (nom, prix, stats + effet) pour l'affichage au clic. */
export function equipInfo(e: Catalog["equipment"][number]): ItemInfo {
  return {
    title: e.name,
    price: e.cost === 0 ? "gratuit" : `${e.cost} Ko`,
    lines: [equipBits(e), e.effectsText].filter(Boolean),
  };
}

export type ModelEntry = { id: string; name: string; profiles: Profile[]; icon?: string };

/** Peuples proposés au recrutement d'un profil, avec leur nom d'affichage. Vide si l'origine est fixée. */
export function originOptions(cat: Catalog, p: Profile): { id: string; name: string }[] {
  return (p.originChoices ?? []).map((id) => ({
    id,
    name: cat.factions.find((f) => f.id === id)?.name ?? id,
  }));
}

// ── Roster (sidebar du constructeur) ── logique pure de catégorisation, testable hors composant.

/** Sections de la sidebar. `personnage`/`troupe`/`conditionnel` = natifs de la faction ; les recrues
 *  inter-factions vont en `freres-d-armes` (trait `frere-d-armes`, ni allié ni apatride de carte), `sceau`
 *  (recrutable seulement en payant son sceau, ex. Guilde Noire), `peuples-rallies` (génériques accueillis
 *  en masse par le recrutement ouvert des Affranchis) ou `hors-faction` (alliés). */
export type RosterSection =
  | "personnage"
  | "troupe"
  | "conditionnel"
  | "hors-faction"
  | "peuples-rallies"
  | "freres-d-armes"
  | "sceau";

/**
 * Modèles recrutables dans une faction (faction courante + recrues inter-factions), niveaux triés.
 * N'ajoute pas l'icône ni le filtre de recherche (laissés au composant).
 *
 * Le filtre porte sur **chaque niveau**, pas seulement sur le modèle : un même modèle peut n'être
 * accueilli que jusqu'à un certain niveau (les Affranchis prennent l'Agent sombre I mais pas les II
 * et III, qui sont uniques). Garder tous ses niveaux reviendrait à les proposer au recrutement pour
 * les refuser ensuite, à l'ajout.
 */
export function recruitableRosterModels(cat: Catalog, factionId: string): ModelEntry[] {
  return cat.models
    .map((m) => ({
      id: m.id,
      name: m.name,
      profiles: m.profileIds
        .map((id) => cat.profiles.find((p) => p.id === id))
        .filter((p): p is Profile => p != null && isRecruitableIn(cat, p, factionId))
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0)),
    }))
    .filter((m) => m.profiles.length > 0);
}

/** Section de sidebar d'un modèle, déterminée par son premier profil. */
export function rosterSectionOf(cat: Catalog, factionId: string, profile: Profile): RosterSection {
  // Une esclave se recrute par un Seigneur de guerre : elle est conditionnelle même venue d'ailleurs.
  if (isSlaveIn(profile, factionId)) return "conditionnel";
  if (profile.factionId === factionId) {
    if (isDependent(profile, cat)) return "conditionnel";
    if (profile.limitation.kind === "U" || profile.limitation.kind === "P") return "personnage";
    return "troupe";
  }
  const frere =
    profile.traits.includes(FRERE_D_ARMES) &&
    !isApatride(profile) &&
    !(profile.recruitment ?? []).some((c) => c.type === "faction-membership");
  if (frere) return "freres-d-armes";
  // Le recrutement ouvert amène des dizaines de génériques : les mêler aux quelques « Allié des X »
  // rendrait les deux illisibles.
  if (openRecruitmentAccepts(cat, profile, factionId)) return "peuples-rallies";
  return sealRequiredFor(cat, profile, factionId) ? "sceau" : "hors-faction";
}

/**
 * Ids des types de monture consultables depuis le roster : ceux qu'au moins un profil recrutable
 * dans la faction peut prendre, via sa faction ou son peuple d'origine.
 *
 * Pour un profil dont l'origine se choisit au recrutement, on prend l'**union** de ce que chaque
 * peuple lui ouvrirait : le roster liste ce qui est consultable avant même qu'une figurine existe,
 * il n'y a donc pas encore de choix à respecter.
 */
export function availableMountTypeIds(cat: Catalog, factionId: string): Set<string> {
  return new Set(
    cat.profiles
      .filter((p) => isRecruitableIn(cat, p, factionId))
      .flatMap((p) => {
        const origines = p.originChoices?.length ? p.originChoices : [undefined];
        return origines.flatMap((o) =>
          coreEligibleMountsFor(cat, p, o ?? originFactionId(p)).map((m) => m.typeId),
        );
      }),
  );
}

export type Modal =
  | null
  | { kind: "preview"; modelId: string }
  | { kind: "edit"; instanceId: string }
  | { kind: "guard"; instanceId: string }
  | { kind: "origin"; instanceId: string }
  | { kind: "recruit-attached"; carrierInstanceId: string; modelId: string }
  | { kind: "recruit-slave"; carrierInstanceId: string }
  /** Recrutement en deux temps : le niveau, puis le peuple d'origine quand la carte le laisse au
   *  choix (`profileId` renseigné = niveau déjà retenu, on en est à l'origine). */
  | { kind: "recruit-level"; modelId: string; profileId?: string }
  | { kind: "mount"; instanceId: string }
  | { kind: "mount-sheet"; instanceId: string }
  | { kind: "mount-preview"; typeId: string };

/** Fiche courte d'un achat (arme, équipement, carte) affichée au clic depuis le résumé. */
export type ItemInfo = {
  title: string;
  price: string;
  lines: string[];
  /** Effets responsables d'une modification (bloc « Modifiée par », visuellement séparé du descriptif). */
  sources?: { label: string; text: string }[];
};
