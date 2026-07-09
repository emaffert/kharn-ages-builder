import { EquipmentCategorySchema, MasteryDomainSchema } from "@core";

/** Constantes et helpers purs de l'admin (aucun composant - module « fast-refresh safe »). */

// Libellés de présentation partagés avec le builder (source unique dans @ui).
export { STAT_LABELS, LEVEL_LABEL } from "@ui";

// Listes de valeurs dérivées des schémas @core - source unique, ne peut pas diverger.
export const MASTERY_DOMAINS = MasteryDomainSchema.options;
export const EQUIPMENT_CATEGORIES = EquipmentCategorySchema.options;

/** Classe de champ de saisie (bâtie sur les tokens dans admin.css). */
export const INPUT = "adm-input";

/**
 * Titres canoniques des sections transverses partagées par toutes les pages de détail.
 * Source unique : garantit que « verbatim », « contraintes », « effets »… portent le même
 * intitulé partout (fini les libellés qui divergent d'une page à l'autre).
 */
export const SECTION = {
  verbatim: "Texte verbatim (fait foi)",
  notes: "Notes (hors carte)",
  constraints: "Contraintes",
  effects: "Effets / octrois",
} as const;

export const replaceAt = <T,>(arr: T[], i: number, v: T): T[] => arr.map((x, j) => (j === i ? v : x));
export const removeAt = <T,>(arr: T[], i: number): T[] => arr.filter((_, j) => j !== i);
