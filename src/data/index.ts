/**
 * Catalogue de données. Source de vérité : `catalog.fangs.json` (round-trip avec l'éditeur admin).
 * Le JSON est validé par Zod au chargement (`parseCatalog`).
 * Référence : docs/schema-donnees.md.
 */

import { parseCatalog, type Catalog } from "@core";
import catalogJson from "./catalog.fangs.json";

/** Catalogue Fang, chargé depuis le JSON canonique et validé. */
export const fangsCatalog: Catalog = parseCatalog(catalogJson);

/** Retourne le catalogue actif de l'application. */
export function loadCatalog(): Catalog {
  return fangsCatalog;
}
