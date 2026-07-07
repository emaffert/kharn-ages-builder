import { z } from "zod";
import { ConstraintScopeSchema } from "./common";

/**
 * Contrainte = validateur de légalité (gate). Voir docs/schema-donnees.md — couche 2.
 * Les `params` sont volontairement libres (`unknown`) pour rester extensibles ;
 * chaque `type` de contrainte définit son propre format de params (interprété par le moteur).
 */
export const ConstraintTypeSchema = z.enum([
  "limitation",
  "requires-present",
  "attachment",
  "forbids-equipment",
  "equipment-reserved",
  "count-relative",
  "faction-membership",
  "mount-eligibility",
  "pact-composition",
  "mutual-exclusion",
  "custom",
]);
export type ConstraintType = z.infer<typeof ConstraintTypeSchema>;

export const ConstraintSchema = z.object({
  id: z.string(),
  type: ConstraintTypeSchema,
  params: z.record(z.string(), z.unknown()),
  scope: ConstraintScopeSchema,
  /** Wording officiel dont la contrainte est tirée — fait foi. */
  sourceText: z.string(),
  severity: z.enum(["error", "warning"]),
  /** false => simple note affichée à l'utilisateur (cas « custom »), non vérifiée automatiquement. */
  autoEnforced: z.boolean(),
});
export type Constraint = z.infer<typeof ConstraintSchema>;
