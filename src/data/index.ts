/**
 * Catalogue de données (toutes factions). Source de vérité : `catalog.json`
 * (round-trip avec l'éditeur admin). Le JSON est validé par Zod au chargement (`parseCatalog`).
 * Référence : docs/schema-donnees.md.
 */

import { parseCatalog, type Catalog } from "@core";
import catalogJson from "./catalog.json";

/** Catalogue bundlé, chargé depuis le JSON canonique et validé. */
export const catalog: Catalog = parseCatalog(catalogJson);

/** Clé de persistance des éditions admin locales (cf. useCatalogStore). */
const ADMIN_CATALOG_KEY = "kharn-admin-catalog-v1";

/**
 * Retourne le catalogue actif : les éditions admin locales (localStorage) si présentes et valides,
 * sinon le catalogue bundlé. Permet à toute l'app (constructeur inclus) de refléter les éditions -
 * notamment les icônes de profil.
 */
export function loadCatalog(): Catalog {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(ADMIN_CATALOG_KEY) : null;
    if (raw) return parseCatalog(JSON.parse(raw));
  } catch {
    /* JSON/quota/validation invalides → repli sur le catalogue bundlé */
  }
  return catalog;
}

/**
 * Une copie locale du catalogue (localStorage) est-elle active ET différente de `catalog.json` ?
 * Sert de garde-fou en dev : la copie locale masque le fichier, donc les modifications directes
 * de `catalog.json` ne sont pas reflétées tant qu'on ne l'a pas rechargée (Admin › Réinit.).
 */
export function localCatalogDivergesFromFile(): boolean {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(ADMIN_CATALOG_KEY) : null;
    if (!raw) return false;
    return raw !== JSON.stringify(catalog);
  } catch {
    return false;
  }
}
