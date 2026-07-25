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

/** Clé du cache de la dernière version publiée (table `catalog_versions`). */
const PUBLISHED_CATALOG_KEY = "kharn-published-catalog-v1";

/** Dernière version publiée connue, mise en cache pour un démarrage rapide et hors-ligne. */
export type PublishedCatalog = { versionId: number; publishedAt: string | null; catalog: Catalog };

function readLocalStorage(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Lit le cache de la version publiée (null si absent, illisible ou invalide). */
export function readPublishedCatalog(): PublishedCatalog | null {
  try {
    const raw = readLocalStorage(PUBLISHED_CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { versionId?: unknown; publishedAt?: unknown; catalog?: unknown };
    if (typeof parsed.versionId !== "number") return null;
    return {
      versionId: parsed.versionId,
      publishedAt: typeof parsed.publishedAt === "string" ? parsed.publishedAt : null,
      catalog: parseCatalog(parsed.catalog),
    };
  } catch {
    /* cache corrompu ou schéma dépassé → on l'ignore, le catalogue bundlé prend le relais */
    return null;
  }
}

/** Met en cache la version publiée téléchargée depuis le serveur. */
export function writePublishedCatalog(meta: { versionId: number; publishedAt: string | null }, published: Catalog): void {
  try {
    localStorage.setItem(PUBLISHED_CATALOG_KEY, JSON.stringify({ ...meta, catalog: published }));
  } catch {
    /* quota / mode privé : le cache est un confort, pas une nécessité */
  }
}

/**
 * Retourne le catalogue actif, par ordre de priorité :
 * 1. les éditions admin locales (brouillon en cours dans ce navigateur) ;
 * 2. la dernière version publiée mise en cache (serveur = source de vérité) ;
 * 3. le catalogue bundlé (première visite hors-ligne, ou aucune version publiée).
 */
export function loadCatalog(): Catalog {
  try {
    const raw = readLocalStorage(ADMIN_CATALOG_KEY);
    if (raw) return parseCatalog(JSON.parse(raw));
  } catch {
    /* JSON/quota/validation invalides → repli sur les niveaux suivants */
  }
  return readPublishedCatalog()?.catalog ?? catalog;
}

/**
 * Une copie locale du catalogue (localStorage) est-elle active ET différente de `catalog.json` ?
 * Sert de garde-fou en dev : la copie locale masque le fichier, donc les modifications directes
 * de `catalog.json` ne sont pas reflétées tant qu'on ne l'a pas rechargée (Admin › Réinit.).
 */
export function localCatalogDivergesFromFile(): boolean {
  const raw = readLocalStorage(ADMIN_CATALOG_KEY);
  if (!raw) return false;
  return raw !== JSON.stringify(catalog);
}
