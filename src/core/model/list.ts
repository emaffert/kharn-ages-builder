import { z } from "zod";

/**
 * Document de liste utilisateur (format portable et versionné).
 * Référence : docs/schema-donnees.md - couche 3.
 */

export const ProfileInstanceSchema = z.object({
  instanceId: z.string(),
  profileId: z.string(),
  addedEquipmentIds: z.array(z.string()),
  removedBaseEquipmentIds: z.array(z.string()),
  spellIds: z.array(z.string()),
  grimoireId: z.enum(["petit", "grand"]).optional(),
  /**
   * Munitions achetées, par arme : `equipId → { typeId → indice de palier }` (indice dans
   * `munitionKind.tierPrices`). Ex. `{ arc: { simple: 1, "perce-armure": 0 } }` = 15 Ko de Simple + 5 Ko de Perce-armure.
   */
  munitions: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  /**
   * Monture recrutée avec la figurine (« équipement inaccessible »). Figurine à part entière : elle a
   * son propre équipement, ses améliorations et ses compétences/options achetées. `mountId` = le niveau
   * choisi (gabarit `catalog.mounts`). Les options réservées AU CAVALIER sont dans `riderMountOptionIds`.
   */
  mount: z
    .object({
      mountId: z.string(),
      addedEquipmentIds: z.array(z.string()).optional(),
      removedBaseEquipmentIds: z.array(z.string()).optional(),
      equipmentUpgrades: z.record(z.string(), z.array(z.string())).optional(),
      skillOptionIds: z.array(z.string()).optional(),
    })
    .optional(),
  /** Options (compétences/équipements) réservées au CAVALIER, débloquées par la possession d'une monture. */
  riderMountOptionIds: z.array(z.string()).optional(),
  /** Instances rattachées (ex. Likans liés à cette Fang). */
  attachedInstanceIds: z.array(z.string()).optional(),
  /** Si cette instance occupe un emplacement gratuit « garde du corps » offert par une autre instance. */
  bodyguardOfInstanceId: z.string().optional(),
  orderIds: z.array(z.string()).optional(),
  /** Cartes spéciales payantes sélectionnées (opt-in), ex. « Apprentie de Nyx ». */
  specialCardIds: z.array(z.string()).optional(),
  /**
   * Quantité par carte spéciale *empilable* (`perLevelStack`), plafonnée au niveau de la figurine.
   * Présent uniquement pour ces cartes ; l'appartenance reste dans `specialCardIds` (quantité ≥ 1).
   */
  specialCardCounts: z.record(z.string(), z.number()).optional(),
  /**
   * Améliorations d'équipement achetées (opt-in par objet, ex. arme empoisonnée, armure « Borax ») :
   * `equipmentId → upgradeIds`. Le surcoût et les catégories éligibles viennent de l'effet `unlock-upgrade`
   * qui octroie l'amélioration.
   */
  equipmentUpgrades: z.record(z.string(), z.array(z.string())).optional(),
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
  ost: z
    .object({
      pactId: z.string().optional(),
      pions: z.number().optional(),
      /** Cartes à portée Ost sélectionnées (opt-in au niveau de la liste, ex. « Pacte du Secret »). */
      cardIds: z.array(z.string()).optional(),
    })
    .optional(),
  /** Instantané dénormalisé pour la portabilité (recalculé à l'ouverture). */
  snapshot: ListSnapshotSchema,
});
export type ListDocument = z.infer<typeof ListDocumentSchema>;
