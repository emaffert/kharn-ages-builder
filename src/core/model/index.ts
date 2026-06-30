/**
 * Barrel du modèle de données + helpers de validation.
 * Référence : docs/schema-donnees.md.
 */

export * from "./common";
export * from "./constraints";
export * from "./effects";
export * from "./catalog";
export * from "./list";

import { CatalogSchema, type Catalog } from "./catalog";
import { ListDocumentSchema, type ListDocument } from "./list";

/** Valide et type une donnée brute comme catalogue (lève en cas d'erreur). */
export function parseCatalog(data: unknown): Catalog {
  return CatalogSchema.parse(data);
}

/** Valide et type une donnée brute comme document de liste (lève en cas d'erreur). */
export function parseListDocument(data: unknown): ListDocument {
  return ListDocumentSchema.parse(data);
}
