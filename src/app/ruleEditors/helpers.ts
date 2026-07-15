import type { Catalog, Selector } from "@core";

/**
 * Constantes et fonctions pures des éditeurs de règles (options dérivées du catalogue, nettoyage de
 * sélecteur). Séparées des composants (`kit.tsx`) pour ne pas casser le fast-refresh.
 */

export type Option = { value: string; label: string };

export const STAT_KEYS = ["v", "p", "a", "c", "t", "i", "stature", "pa", "pv"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const GRIMOIRE_OPTIONS: Option[] = [
  { value: "petit", label: "petit" },
  { value: "grand", label: "grand" },
];

export function profileOptions(cat: Catalog): Option[] {
  return cat.profiles.map((p) => ({ value: p.id, label: p.name + (p.level ? ` ${p.level}` : "") }));
}

/** Un modèle regroupe tous ses niveaux ; libellé = nom (sans niveau) d'un profil du modèle. */
export function modelOptions(cat: Catalog): Option[] {
  const byModel = new Map<string, string>();
  for (const p of cat.profiles) {
    if (p.modelId && !byModel.has(p.modelId)) byModel.set(p.modelId, p.name);
  }
  return [...byModel].map(([value, label]) => ({ value, label }));
}

export const skillOptions = (cat: Catalog): Option[] =>
  [...cat.skills].sort((a, b) => a.keyword.localeCompare(b.keyword, "fr")).map((s) => ({ value: s.id, label: s.keyword }));
export const spellOptions = (cat: Catalog): Option[] =>
  [...cat.spells].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((s) => ({ value: s.id, label: s.name }));

/** Ne conserve que les clés renseignées d'un sélecteur (évite les tableaux/valeurs vides en base). */
export function cleanSelector(sel: Selector): Selector {
  const out: Selector = {};
  if (sel.self) out.self = true;
  if (sel.cavalier) out.cavalier = true;
  if (sel.all) out.all = true;
  if (sel.profileIds?.length) out.profileIds = sel.profileIds;
  if (sel.modelIds?.length) out.modelIds = sel.modelIds;
  if (sel.traits?.length) out.traits = sel.traits;
  if (sel.factionIds?.length) out.factionIds = sel.factionIds;
  if (sel.levels?.length) out.levels = sel.levels;
  if (sel.isLeader != null) out.isLeader = sel.isLeader;
  if (sel.equipmentCategories?.length) out.equipmentCategories = sel.equipmentCategories;
  if (sel.equipmentIds?.length) out.equipmentIds = sel.equipmentIds;
  if (sel.equipmentHands?.length) out.equipmentHands = sel.equipmentHands;
  if (sel.countAtLeast != null) out.countAtLeast = sel.countAtLeast;
  return out;
}
