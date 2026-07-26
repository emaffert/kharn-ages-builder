import { z } from "zod";
import { ConstraintScopeSchema, type ConstraintScope } from "./common";

/**
 * Contrainte = validateur de légalité (gate). Voir docs/schema-donnees.md - couche 2.
 * Les `params` sont volontairement libres (`unknown`) pour rester extensibles ;
 * chaque `type` de contrainte définit son propre format de params (interprété par le moteur).
 * Seuls les types réellement appliqués par le moteur figurent ici : une règle qu'aucun type ne
 * couvre se consigne dans les **notes internes** du profil ou de la carte, pas en contrainte.
 *
 * Une contrainte est une barrière : elle bloque toujours (issue `error`). Une règle qui ne
 * bloquerait pas n'est pas une contrainte, c'est une note.
 */
export const ConstraintTypeSchema = z.enum([
  "requires-present",
  "attachment",
  "forbids-equipment",
  "forbids-grimoire",
  "faction-membership",
]);
export type ConstraintType = z.infer<typeof ConstraintTypeSchema>;

/**
 * Portées admissibles par type, c'est-à-dire **où le moteur cherche** pour évaluer la règle.
 *
 * Une seule valeur = portée imposée par la mécanique elle-même (l'éditeur l'énonce, sans la
 * proposer au choix : la changer ne changerait rien). Plusieurs valeurs = le wording de la carte
 * peut viser un niveau ou l'autre, et le moteur en tient compte. La première valeur est la portée
 * par défaut à la création.
 */
export const CONSTRAINT_SCOPES: Record<ConstraintType, readonly ConstraintScope[]> = {
  // « ne peut pas être recruté sans X » : selon la carte, dans son Fer de Lance ou n'importe où dans l'Ost.
  "requires-present": ["fer-de-lance", "ost"],
  // Porteur et rattachés appartiennent au même Fer de Lance par construction.
  attachment: ["fer-de-lance"],
  // Ne regarde que l'équipement de la figurine elle-même.
  "forbids-equipment": ["profil"],
  // Ne regarde que les acquisitions de la figurine elle-même.
  "forbids-grimoire": ["profil"],
  // Compare la faction de la figurine à celle du Fer de Lance qui l'accueille.
  "faction-membership": ["fer-de-lance"],
};

/** Portée par défaut d'un type (et sa seule portée possible quand il n'en admet qu'une). */
export function defaultConstraintScope(type: ConstraintType): ConstraintScope {
  return CONSTRAINT_SCOPES[type][0];
}

/** Le type laisse-t-il un choix de portée à l'utilisateur ? */
export function scopeIsChosen(type: ConstraintType): boolean {
  return CONSTRAINT_SCOPES[type].length > 1;
}

export const ConstraintSchema = z.object({
  id: z.string(),
  type: ConstraintTypeSchema,
  params: z.record(z.string(), z.unknown()),
  /** Niveau auquel la règle s'évalue. Contraint par le type (cf. `CONSTRAINT_SCOPES`). */
  scope: ConstraintScopeSchema,
  /** Wording officiel dont la contrainte est tirée - fait foi. */
  sourceText: z.string(),
});
export type Constraint = z.infer<typeof ConstraintSchema>;
