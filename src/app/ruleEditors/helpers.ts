import type { Catalog, ConstraintType, EffectOperation, Selector } from "@core";

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

// Libellés français des actions, regroupées par famille (menu de choix de l'opération).
export const OP_LABELS: Record<EffectOperation["kind"], string> = {
  "cost-delta": "Modifier le coût",
  "cost-set": "Fixer le coût",
  "grimoire-discount": "Réduire un grimoire",
  "grant-skill": "Conférer une compétence",
  "grant-spell": "Conférer un sort",
  "grant-spell-choice": "Conférer des sorts au choix",
  "grant-trait": "Conférer un trait",
  "grant-mastery-die": "Conférer un dé de maîtrise",
  "unlock-upgrade": "Débloquer une amélioration",
  "stat-modifier": "Modifier une caractéristique",
  "stat-count": "Caractéristique = comptage de figurines",
  "stat-max": "Caractéristique = plus forte du groupe",
  "skill-count": "Compétence = comptage de figurines",
  "spell-pages": "Pages de sorts",
  "limit-modifier": "Modifier la limitation (X)",
};

/** Libellés français des types de contrainte (menu de choix). */
export const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  "forbids-equipment": "Interdit d'équiper",
  "requires-present": "Nécessite une présence",
  "faction-membership": "Appartenance de faction",
  "forbids-grimoire": "Interdit d'acquérir un grimoire",
  attachment: "Rattachement (garde / porteur)",
  slave: "Esclave (possédée par un Seigneur de guerre)",
};
