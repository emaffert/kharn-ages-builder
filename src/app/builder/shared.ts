import {
  castWays as coreCastWays,
  pageBonusSources as corePageBonusSources,
  forbiddenGrimoires as coreForbiddenGrimoires,
  castableSpells as coreCastableSpells,
} from "@core";
import type { Catalog, Profile, ProfileInstance, Spell } from "@core";

/**
 * Constantes, helpers purs et types partagés par les composants du constructeur.
 * Aucun rendu ici : uniquement des données et de la logique dérivée du catalogue/liste.
 */

export const LEVEL = ["", "I", "II", "III"];

export const STATS: [keyof Profile["stats"], string][] = [
  ["v", "V"],
  ["p", "P"],
  ["a", "A"],
  ["c", "C"],
  ["t", "T"],
  ["i", "I"],
];

export type EmblemKind = "fangs" | "kharns" | "kherops" | "guilde";

/**
 * Factions. `accent`/`deep` : ancienne palette (encore lue par des écrans non migrés).
 * `color`/`colorBright`/`colorDeep`/`emblem` : identité visuelle « Forge/Braise » (blasons, teintes).
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
}[] = [
  { id: "fangs", name: "Fangs", accent: "#7a4a2b", deep: "#4a2f1c", blurb: "Enfants de Nyx, sorcellerie d'os.", color: "#b0472b", colorBright: "#e0553f", colorDeep: "#5e1a13", emblem: "fangs" },
  { id: "kharns", name: "Khârns", accent: "#2b3a5a", deep: "#16223d", blurb: "La Couronne et ses vassaux.", color: "#3d5f95", colorBright: "#7aa0d6", colorDeep: "#16223d", emblem: "kharns" },
  { id: "kherops", name: "Khérops", accent: "#7a2b2b", deep: "#4a1c1c", blurb: "Les soldats de l'Empereur.", color: "#9a2f2f", colorBright: "#d15a4e", colorDeep: "#3a1010", emblem: "kherops" },
  { id: "guilde-noire", name: "Guilde Noire", accent: "#2f2a26", deep: "#141210", blurb: "Renégats et mercenaires.", color: "#736784", colorBright: "#a99bbd", colorDeep: "#241f2d", emblem: "guilde" },
];

/** Une figurine recrutée uniquement via un porteur (Likan, Muskh) — pas d'achat propre. */
export const isDependent = (p: Profile) => p.modelId === "likan" || p.id === "fangs-muskh-1";

const TRAIT_LABEL: Record<string, string> = { "femelle-fang": "une femelle Fang" };

/** Modèle/figurine exact via lequel se recrute un profil dépendant (Likan → femelle Fang, Muskh → Xayìn). */
export function carrierLabel(p: Profile, cat: Catalog): string | null {
  const name = (id?: string) =>
    cat.profiles.find((x) => x.id === id)?.name ?? cat.models.find((m) => m.id === id)?.name;
  // Attachment : porteur désigné par trait ou par identifiants.
  for (const c of p.recruitment as { type: string; params?: Record<string, unknown> }[]) {
    if (c.type !== "attachment") continue;
    const car = c.params?.carrier as { trait?: string; profileIds?: string[]; modelIds?: string[] } | undefined;
    if (car?.trait) return TRAIT_LABEL[car.trait] ?? car.trait;
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
    price: s.cost != null && s.cost > 0 ? `${s.cost} Ko` : "—",
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
  if (e.hands) bits.push(`${e.hands}m`);
  if (e.allonge != null) bits.push(`All.${e.allonge}`);
  if (e.range) bits.push(`Port.${e.range.short}/${e.range.long}`);
  if (e.durability != null) bits.push(`Sol.${e.durability}`);
  if (e.perceArmure != null) bits.push(`PA ${e.perceArmure}`);
  return bits.join(" · ");
}

/** Fiche d'un équipement (nom, prix, stats + effet) pour l'affichage au clic. */
export function equipInfo(e: Catalog["equipment"][number]): ItemInfo {
  return {
    title: e.name,
    price: e.isFree || e.cost === 0 ? "gratuit" : `${e.cost} Ko`,
    lines: [equipBits(e), e.effectsText].filter(Boolean),
  };
}

export type ModelEntry = { id: string; name: string; profiles: Profile[] };

export type Modal =
  | null
  | { kind: "preview"; modelId: string }
  | { kind: "edit"; instanceId: string }
  | { kind: "guard"; instanceId: string }
  | { kind: "recruit-likan"; carrierInstanceId: string }
  | { kind: "recruit-level"; modelId: string };

/** Fiche courte d'un achat (arme, équipement, carte) affichée au clic depuis le résumé. */
export type ItemInfo = { title: string; price: string; lines: string[] };
