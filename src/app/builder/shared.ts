import {
  castWays as coreCastWays,
  pageBonusSources as corePageBonusSources,
  forbiddenGrimoires as coreForbiddenGrimoires,
  castableSpells as coreCastableSpells,
  mountKindOf,
  mountOptionCostOf,
} from "@core";
import type { Catalog, MountOption, Profile, ProfileInstance, Selector, Spell } from "@core";
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
 * Armures portées, dérivées d'une liste d'équipements (catégorie « armure ») : Brigandine, Caparaçon…
 * `upgradesByEquip` (optionnel) suffixe le libellé avec les améliorations actives (ex. « Pointes acérées »).
 */
export function wornArmorsFrom(
  cat: Catalog,
  equipmentIds: string[],
  upgradesByEquip?: Record<string, string[]>,
): ArmorDisplay[] {
  return equipmentIds
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => e?.category === "armure")
    .map((e) => {
      const upIds = upgradesByEquip?.[e.id] ?? [];
      const upNames = (e.upgrades ?? []).filter((u) => upIds.includes(u.id)).map((u) => u.label);
      return {
        label: `🛡 ${e.name}${upNames.length ? ` (${upNames.join(", ")})` : ""}`,
        protectionEchec: e.protectionEchec,
        seuil: e.seuil,
        protectionReussite: e.protectionReussite,
        durability: e.durability,
      };
    });
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

/** Une figurine recrutée uniquement via un porteur (ex. Likan, Muskh) - pas d'achat propre. */
export const isDependent = (p: Profile, cat: Catalog): boolean => carrierSpec(p, cat) != null;

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

/** Un effet de désignation : `guardMatch` = qui est le garde, `of` = les figurines protégeables. */
type GuardDesignation = { guardMatch: (p: Profile) => boolean; of: Selector };

function guardDesignations(cat: Catalog): GuardDesignation[] {
  const out: GuardDesignation[] = [];
  for (const p of cat.profiles) {
    for (const e of p.effects ?? []) {
      if (!e.designation) continue;
      // `self` => le garde est la figurine source (ce profil) ; sinon la cible désigne le garde.
      const guardMatch = e.target.self
        ? (q: Profile) => q.id === p.id
        : (q: Profile) => selectorMatchesProfile(e.target, q);
      out.push({ guardMatch, of: e.designation.of });
    }
  }
  for (const s of cat.specialCards) {
    for (const e of s.effects ?? []) {
      if (!e.designation || e.target.self) continue; // `self` sur une carte n'a pas de source unique
      out.push({ guardMatch: (q: Profile) => selectorMatchesProfile(e.target, q), of: e.designation.of });
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

/** Un profil (protégé candidat) correspond-il à l'un de ces sélecteurs ? */
export function profileMatchesAnySelector(p: Profile, sels: Selector[]): boolean {
  return sels.some((s) => selectorMatchesProfile(s, p));
}

/** Modèle/figurine exact via lequel se recrute un profil dépendant (Likan → femelle Fang, Muskh → Xayìn). */
export function carrierLabel(p: Profile, cat: Catalog): string | null {
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

/** Une figurine peut-elle acheter quelque chose ? Non si toutes les catégories d'achat sont interdites. */
export function canBuy(p: Profile, cat: Catalog): boolean {
  const forbidden = forbiddenCats(p, cat);
  return PURCHASE_CATS.some((c) => !forbidden.has(c));
}

/**
 * Une figurine est-elle recrutable dans un Fer de Lance de faction `factionId` ?
 * Même logique que le moteur (`validateFactionMembership`) : même faction, sans logo,
 * trait `apatride`, ou contrainte `faction-membership` listant la faction d'accueil (« Allié des X »).
 */
export function isRecruitableIn(p: Profile, factionId: string): boolean {
  if (!p.factionId || p.factionId === factionId) return true;
  if (p.traits.includes("apatride")) return true;
  return (p.recruitment ?? []).some(
    (c) =>
      c.type === "faction-membership" &&
      ((c.params as { allowedFactions?: string[] }).allowedFactions ?? []).includes(factionId),
  );
}

/** Une figurine correspond-elle à la réservation d'un équipement ? (toutes les dimensions fournies). */
export function equipReservedOk(e: Catalog["equipment"][number], p: Profile): boolean {
  const r = e.reservedTo;
  if (!r) return true;
  if (r.profileIds && !r.profileIds.includes(p.id)) return false;
  if (r.modelIds && !(p.modelId != null && r.modelIds.includes(p.modelId))) return false;
  if (r.traits && !r.traits.some((t) => p.traits.includes(t))) return false;
  if (r.levels && !(p.level != null && r.levels.includes(p.level))) return false;
  if (r.factionIds && !(p.factionId != null && r.factionIds.includes(p.factionId))) return false;
  return true;
}

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

export function castWays(p: Profile, cat: Catalog, selectedUpgrades: string[], wornEquipIds: string[] = p.baseEquipmentIds): string[] {
  return coreCastWays(cat, p, synthInstance(p, selectedUpgrades, wornEquipIds), new Set(p.traits));
}

export function pageBonusSources(p: Profile, cat: Catalog, selectedUpgrades: string[]): { name: string; amount: number }[] {
  return corePageBonusSources(cat, p, synthInstance(p, selectedUpgrades, []), new Set(p.traits));
}

export function pageBonus(p: Profile, cat: Catalog, selectedUpgrades: string[]): number {
  return pageBonusSources(p, cat, selectedUpgrades).reduce((n, s) => n + s.amount, 0);
}

export function spellsFor(p: Profile, cat: Catalog, ways: string[]): Spell[] {
  return coreCastableSpells(cat, p, new Set(p.traits), ways);
}

export function spellInfo(s: Spell, cat: Catalog): ItemInfo {
  const way = cat.magicWays.find((w) => w.id === s.magicWayId)?.name;
  return {
    title: s.name,
    price: s.cost != null && s.cost > 0 ? `${s.cost} Ko` : "-",
    lines: [
      `${s.pages ?? 0} page(s)${way ? ` · ${way}` : ""}`,
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
  if (e.range) bits.push(`Port.${e.range.short}/${e.range.long}`);
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

export type Modal =
  | null
  | { kind: "preview"; modelId: string }
  | { kind: "edit"; instanceId: string }
  | { kind: "guard"; instanceId: string }
  | { kind: "recruit-attached"; carrierInstanceId: string; modelId: string }
  | { kind: "recruit-level"; modelId: string }
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
