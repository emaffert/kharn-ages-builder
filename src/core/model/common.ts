import { z } from "zod";

/** Niveau d'entraînement (I / II / III). */
export const LevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Level = z.infer<typeof LevelSchema>;

/** Les 5 domaines de maîtrise. */
export const MasteryDomainSchema = z.enum([
  "offensive",
  "defensive",
  "objectif",
  "tir",
  "esoterique",
]);
export type MasteryDomain = z.infer<typeof MasteryDomainSchema>;

/** Catégories d'équipement. */
export const EquipmentCategorySchema = z.enum([
  "arme-cac",
  "arme-tir",
  "bouclier",
  "armure",
  "objet",
]);
export type EquipmentCategory = z.infer<typeof EquipmentCategorySchema>;

/** Portée d'application d'une contrainte. */
export const ConstraintScopeSchema = z.enum(["profil", "fer-de-lance", "ost"]);
export type ConstraintScope = z.infer<typeof ConstraintScopeSchema>;

/** Portée d'application d'un effet. */
export const EffectScopeSchema = z.enum(["fer-de-lance", "ost"]);
export type EffectScope = z.infer<typeof EffectScopeSchema>;

/** Bloc de texte de règle. `text` est le wording officiel verbatim — il fait foi. */
export const RuleTextSchema = z.object({
  label: z.string().optional(),
  text: z.string(),
});
export type RuleText = z.infer<typeof RuleTextSchema>;

/** Référence à une compétence, avec sa valeur éventuelle (numérique « Allonge 2 » ou textuelle « Aliéné femelle Fang »). */
export const SkillRefSchema = z.object({
  skillId: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  /**
   * Précision propre à ce profil qui complète la description générique de la compétence
   * (ex. « embuscade » de l'Exécuteur : bonus au seuil/dégâts sur sa 1ʳᵉ attaque révélée).
   * N'apparaît pas dans le tag — seulement dans la description dépliée.
   */
  precision: z.string().optional(),
});
export type SkillRef = z.infer<typeof SkillRefSchema>;

/**
 * Sélecteur d'entités, utilisé par les contraintes et les effets pour cibler
 * des figurines/équipements, ou exprimer une condition d'activation.
 *
 * Correspondance d'identité : ET entre les dimensions renseignées, OU à l'intérieur d'une dimension.
 * Ex. `{ profileIds: [A, B], levels: [2], traits: [X, Y] }` = (A ou B) ET niveau 2 ET (X ou Y).
 * Pour cumuler des comptages indépendants, utiliser une liste de sélecteurs (ET entre clauses).
 */
export const SelectorSchema = z.object({
  self: z.boolean().optional(),
  /** Correspond à *toutes* les figurines de la portée (ex. « toutes les figurines de l'Ost »). */
  all: z.boolean().optional(),
  profileIds: z.array(z.string()).optional(),
  modelIds: z.array(z.string()).optional(),
  traits: z.array(z.string()).optional(),
  factionIds: z.array(z.string()).optional(),
  /** Niveaux ciblés (I/II/III). */
  levels: z.array(z.number()).optional(),
  /** Statut de meneur : true => uniquement le leader du Fer de Lance ; false => uniquement les non-leaders. */
  isLeader: z.boolean().optional(),
  equipmentCategories: z.array(EquipmentCategorySchema).optional(),
  /** Cible des équipements précis (par id), ex. l'« Arbalète de poing » de l'Exécuteur. */
  equipmentIds: z.array(z.string()).optional(),
  /** Seuil de comptage pour une condition (ex. ≥ 2 « frères d'armes »). */
  countAtLeast: z.number().optional(),
});
export type Selector = z.infer<typeof SelectorSchema>;
