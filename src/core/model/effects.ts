import { z } from "zod";
import { EffectScopeSchema, SelectorSchema } from "./common";

/**
 * Effet = modificateur dynamique (coût, déblocage d'option, octroi de compétence/trait),
 * souvent appliqué à d'autres figurines, conditionnellement à l'état de la liste.
 * Voir docs/schema-donnees.md — couche 2.
 */
export const EffectOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cost-delta"), amount: z.number() }),
  z.object({ kind: z.literal("cost-set"), amount: z.number(), maxCount: z.number().optional() }),
  z.object({ kind: z.literal("unlock-upgrade"), upgradeId: z.string(), perItemCost: z.number() }),
  z.object({ kind: z.literal("grant-skill"), skillId: z.string() }),
  z.object({ kind: z.literal("grant-trait"), trait: z.string() }),
  z.object({ kind: z.literal("cap"), value: z.number() }),
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
  /** Condition d'activation. Absente => actif dès que la source est recrutée. */
  condition: SelectorSchema.optional(),
  /** Cible de l'effet (peut être `self`). */
  target: SelectorSchema,
  operation: EffectOperationSchema,
  /** false => effet en jeu uniquement (affiché verbatim, non calculé par l'éditeur). */
  appliesToListBuilding: z.boolean(),
  /** true => effet optionnel (choix du joueur) : NON appliqué automatiquement par le moteur. */
  optIn: z.boolean().optional(),
  sourceText: z.string(),
  autoEnforced: z.boolean(),
});
export type Effect = z.infer<typeof EffectSchema>;
