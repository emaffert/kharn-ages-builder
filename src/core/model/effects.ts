import { z } from "zod";
import { EffectScopeSchema, EquipmentCategorySchema, SelectorSchema } from "./common";

/**
 * Effet = modificateur dynamique (coût, déblocage d'option, octroi de compétence/trait),
 * souvent appliqué à d'autres figurines, conditionnellement à l'état de la liste.
 * Voir docs/schema-donnees.md — couche 2.
 */
/** Caractéristiques modifiables par un effet (mêmes clés que la fiche : V P A C T I + PA PV Stature). */
export const StatKeySchema = z.enum(["v", "p", "a", "c", "t", "i", "stature", "pa", "pv"]);

export const EffectOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cost-delta"), amount: z.number() }),
  z.object({ kind: z.literal("cost-set"), amount: z.number(), maxCount: z.number().optional() }),
  // Octroie aux cibles la possibilité d'améliorer CHAQUE équipement des catégories visées (opt-in par
  // objet) pour `cost` Ko/objet. Ex. Key empoisonne son arme (10 Ko) ; « Borax » améliore armes+armures.
  z.object({
    kind: z.literal("unlock-upgrade"),
    upgradeId: z.string(),
    label: z.string(),
    cost: z.number(),
    equipmentCategories: z.array(EquipmentCategorySchema),
  }),
  // `value` : pour une compétence « à valeur » (ex. octroie « Héroïque défense » → value "défense").
  z.object({ kind: z.literal("grant-skill"), skillId: z.string(), value: z.union([z.string(), z.number()]).optional() }),
  z.object({ kind: z.literal("grant-trait"), trait: z.string() }),
  z.object({ kind: z.literal("cap"), value: z.number() }),
  z.object({
    kind: z.literal("stat-modifier"),
    stat: StatKeySchema,
    // nombre fixe, ou "level" = le niveau de la figurine elle-même.
    amount: z.union([z.number(), z.literal("level")]),
  }),
  // Fixe une caractéristique au NOMBRE de figurines correspondant à `of` dans la portée
  // (ex. Instinct grégaire : T des Dogons = nombre de Dogons). `atLeastBase` => plancher = valeur de base.
  z.object({
    kind: z.literal("stat-count"),
    stat: StatKeySchema,
    of: SelectorSchema,
    atLeastBase: z.boolean().optional(),
  }),
  // Fixe une caractéristique à la valeur MAXIMALE de cette carac. parmi les figurines correspondant
  // à `of` dans la portée (ex. « Doctrine » de l'Ordre : T et I = les plus fortes des membres de
  // l'Ordre présents dans le Fer de Lance). Lit les valeurs de BASE (imprimées) ; plancher = base.
  z.object({ kind: z.literal("stat-max"), stat: StatKeySchema, of: SelectorSchema }),
  // Valeur d'une compétence (à valeur, ex. Seigneur de guerre X) dérivée d'un décompte :
  // X = ⌊ nombre de figurines « of » dans la portée / per ⌋ (per défaut 1, arrondi inférieur).
  z.object({
    kind: z.literal("skill-count"),
    skillId: z.string(),
    of: SelectorSchema,
    per: z.number().optional(),
  }),
  // Budget de pages de sorts (ex. Fille de Nyx : +3 ; Crosse d'Ostéomancie : +3).
  // Enforcement (capacité vs sorts choisis) prévu côté constructeur de liste.
  z.object({ kind: z.literal("spell-pages"), amount: z.number() }),
]);
export type EffectOperation = z.infer<typeof EffectOperationSchema>;

export const EffectSourceSchema = z.object({
  kind: z.enum(["profile", "special-card", "mount", "equipment"]),
  id: z.string(),
});
export type EffectSource = z.infer<typeof EffectSourceSchema>;

export const EffectSchema = z.object({
  id: z.string(),
  source: EffectSourceSchema,
  scope: EffectScopeSchema,
  /**
   * Condition d'activation. Absente => actif dès que la source est recrutée.
   * Une liste de sélecteurs = conditions cumulées (ET : toutes doivent être vraies),
   * ex. « ≥3 Dogons ET ≥1 Père de famille ».
   */
  condition: z.union([SelectorSchema, z.array(SelectorSchema)]).optional(),
  /** Cible de l'effet (peut être `self`). */
  target: SelectorSchema,
  /**
   * Désignation « garde du corps » : la cible (le garde) ne bénéficie de l'opération que si elle est
   * assignée à protéger l'une des figurines décrites par `of`. Pilote l'UI de désignation du
   * constructeur ET conditionne la remise dans le moteur (ex. Larbin → Fille de Nyx ; Djouked → Broutcha).
   */
  designation: z.object({ of: SelectorSchema }).optional(),
  operation: EffectOperationSchema,
  /** false => effet en jeu uniquement (affiché verbatim, non calculé par l'éditeur). */
  appliesToListBuilding: z.boolean(),
  /** true => effet optionnel (choix du joueur) : NON appliqué automatiquement par le moteur. */
  optIn: z.boolean().optional(),
  sourceText: z.string(),
  autoEnforced: z.boolean(),
});
export type Effect = z.infer<typeof EffectSchema>;
