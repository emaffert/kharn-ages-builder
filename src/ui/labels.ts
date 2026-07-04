import type { Profile } from "@core";

/**
 * Libellés de présentation partagés (admin ↔ builder) — source unique.
 * Les *listes* de valeurs (domaines, catégories) se dérivent des schémas `@core`
 * côté consommateur ; ici on ne garde que les libellés purement présentationnels.
 */

/** Caractéristiques dans l'ordre des cartes, avec leur libellé court. */
export const STAT_LABELS: [keyof Profile["stats"], string][] = [
  ["v", "V"],
  ["p", "P"],
  ["a", "A"],
  ["c", "C"],
  ["t", "T"],
  ["i", "I"],
];

/** Libellé de niveau indexé par `level` (1/2/3) ; index 0 = « sans niveau ». */
export const LEVEL_LABEL = ["", "I", "II", "III"];
