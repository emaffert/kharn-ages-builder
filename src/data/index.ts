/**
 * Catalogue de données. Pour l'instant : faction Fang (fixture de référence).
 * Référence : docs/schema-donnees.md.
 *
 * Le catalogue est typé `Catalog` à la compilation. `loadCatalog()` rejoue en plus
 * la validation Zod au runtime (utile quand la donnée viendra de JSON / de l'éditeur admin).
 */

import { parseCatalog, type Catalog } from "@core";
import { fangsCatalog } from "./fangs";

export { fangsCatalog };

/** Catalogue actif de l'application (validé au runtime). */
export function loadCatalog(): Catalog {
  return parseCatalog(fangsCatalog);
}
