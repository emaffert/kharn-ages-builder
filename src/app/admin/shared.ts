import type { Profile } from "@core";

/** Constantes et helpers purs de l'admin (aucun composant — module « fast-refresh safe »). */

export const STAT_LABELS: [keyof Profile["stats"], string][] = [
  ["v", "V"],
  ["p", "P"],
  ["a", "A"],
  ["c", "C"],
  ["t", "T"],
  ["i", "I"],
];

export const LEVEL_LABEL = ["", "I", "II", "III"];

export const MASTERY_DOMAINS = ["offensive", "defensive", "objectif", "tir", "esoterique"] as const;

export const EQUIPMENT_CATEGORIES = [
  "arme-cac",
  "arme-tir",
  "bouclier",
  "armure",
  "munition",
  "objet",
  "monture-option",
] as const;

/** Classe de champ de saisie (bâtie sur les tokens dans admin.css). */
export const INPUT = "adm-input";

export const replaceAt = <T,>(arr: T[], i: number, v: T): T[] => arr.map((x, j) => (j === i ? v : x));
export const removeAt = <T,>(arr: T[], i: number): T[] => arr.filter((_, j) => j !== i);
