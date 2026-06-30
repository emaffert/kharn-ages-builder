import { z } from "zod";

/**
 * Document de liste utilisateur (format portable et versionné).
 * Référence : docs/schema-donnees.md — couche 3.
 */

export const ProfileInstanceSchema = z.object({
  instanceId: z.string(),
  profileId: z.string(),
  addedEquipmentIds: z.array(z.string()),
  removedBaseEquipmentIds: z.array(z.string()),
  spellIds: z.array(z.string()),
  grimoireId: z.enum(["petit", "grand"]).optional(),
  mount: z.object({ mountId: z.string(), optionIds: z.array(z.string()) }).optional(),
  /** Instances rattachées (ex. Likans liés à cette Fang). */
  attachedInstanceIds: z.array(z.string()).optional(),
  orderIds: z.array(z.string()).optional(),
  note: z.string().optional(),
});
export type ProfileInstance = z.infer<typeof ProfileInstanceSchema>;

export const FerDeLanceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  factionId: z.string(),
  leaderInstanceId: z.string(),
  members: z.array(ProfileInstanceSchema),
});
export type FerDeLance = z.infer<typeof FerDeLanceSchema>;

export const ListSnapshotSchema = z.object({
  totalCost: z.number(),
  entries: z.array(
    z.object({ instanceId: z.string(), displayName: z.string(), cost: z.number() }),
  ),
});
export type ListSnapshot = z.infer<typeof ListSnapshotSchema>;

export const ListDocumentSchema = z.object({
  schemaVersion: z.string(),
  catalogVersion: z.string(),
  id: z.string(),
  name: z.string(),
  format: z.enum(["escarmouche", "bataille"]),
  pointsLimit: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  fersDeLance: z.array(FerDeLanceSchema),
  ost: z.object({ pactId: z.string().optional(), pions: z.number().optional() }).optional(),
  /** Instantané dénormalisé pour la portabilité (recalculé à l'ouverture). */
  snapshot: ListSnapshotSchema,
});
export type ListDocument = z.infer<typeof ListDocumentSchema>;
