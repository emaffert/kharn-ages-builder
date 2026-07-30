import { z } from "zod";

/**
 * Document de liste utilisateur (format portable et versionné).
 * Référence : docs/schema-donnees.md - couche 3.
 */

export const ProfileInstanceSchema = z.object({
  instanceId: z.string(),
  profileId: z.string(),
  addedEquipmentIds: z.array(z.string()),
  /**
   * Exemplaires achetés d'un objet **empilable** (`equipment.stackable`) : id → quantité (absent = 1).
   * L'identifiant reste unique dans `addedEquipmentIds` ; c'est ce champ qui porte le nombre.
   */
  addedEquipmentCounts: z.record(z.string(), z.number().int().min(1)).optional(),
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
    })
    .optional(),
  /**
   * Options de monture achetées (cavalier, monture ou partagées) : id d'option → valeur X (1 si sans valeur).
   * Champ unique : le `bucket` du catalogue décide de l'affichage. Une option partagée n'est comptée qu'une fois.
   */
  mountOptionIds: z.record(z.string(), z.number()).optional(),
  /** Instances rattachées (ex. Likans liés à cette Fang). */
  attachedInstanceIds: z.array(z.string()).optional(),
  /** Si cette instance occupe un emplacement gratuit « garde du corps » offert par une autre instance. */
  bodyguardOfInstanceId: z.string().optional(),
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
      /** Cartes à portée Ost sélectionnées (opt-in au niveau de la liste, ex. « Pacte du Secret »). */
      cardIds: z.array(z.string()).optional(),
    })
    .optional(),
  /** Instantané dénormalisé pour la portabilité (recalculé à l'ouverture). */
  snapshot: ListSnapshotSchema,
});
export type ListDocument = z.infer<typeof ListDocumentSchema>;

/**
 * Exemplaires achetés d'un objet (0 s'il n'est pas acheté, 1 par défaut).
 *
 * La quantité vit dans `addedEquipmentCounts`, l'identifiant restant unique dans la liste. Une liste
 * écrite avant ce champ pouvait répéter l'identifiant : cette forme est encore comptée telle quelle.
 */
export function addedEquipmentCount(inst: ProfileInstance, equipmentId: string): number {
  const repeats = inst.addedEquipmentIds.filter((id) => id === equipmentId).length;
  if (repeats === 0) return 0;
  return repeats > 1 ? repeats : (inst.addedEquipmentCounts?.[equipmentId] ?? 1);
}

/** Équipement acheté dédoublonné, avec ses exemplaires : id → quantité. */
export function addedEquipmentTally(inst: ProfileInstance): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of inst.addedEquipmentIds) {
    if (!out.has(id)) out.set(id, addedEquipmentCount(inst, id));
  }
  return out;
}
