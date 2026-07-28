/**
 * Catalogue de données (toutes factions). Source de vérité : `catalog.json`
 * (round-trip avec l'éditeur admin). Le JSON est validé par Zod au chargement (`parseCatalog`).
 * Référence : docs/schema-donnees.md.
 */

import { parseCatalog, type Catalog } from "@core";
import { diffCatalogs, type CatalogDiff } from "./diff";
import catalogJson from "./catalog.json";

export { diffCatalogs } from "./diff";
export type { CatalogDiff, DiffSection, EntryChange, FieldChange } from "./diff";

/** Catalogue bundlé, chargé depuis le JSON canonique et validé. */
export const catalog: Catalog = parseCatalog(catalogJson);

/**
 * Clé de persistance du brouillon admin (cf. useCatalogStore). La v2 n'enveloppe plus un catalogue
 * nu mais `{ baseVersionId, catalog }` : un brouillon sait désormais de quelle version publiée il
 * dérive. Un brouillon v1, dont la provenance est inconnue, n'est pas relu - c'est justement ce
 * genre de brouillon sans origine qui a écrasé une version publiée en juillet 2026.
 */
const ADMIN_CATALOG_KEY = "kharn-admin-catalog-v2";
const LEGACY_ADMIN_CATALOG_KEY = "kharn-admin-catalog-v1";

/** Clé du drapeau « un brouillon périmé a été abandonné », à annoncer à l'admin. */
const STALE_DRAFT_KEY = "kharn-stale-draft-dropped";

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

/** Brouillon admin en cours, et la version publiée sur laquelle il a été bâti. */
export type AdminDraft = { baseVersionId: number | null; catalog: Catalog };

function writeLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / mode privé : on continue sans persistance */
  }
}

function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Lit le brouillon admin, **et le supprime s'il est périmé**.
 *
 * Un brouillon n'est valable que pour la version publiée dont il dérive : dès qu'une nouvelle
 * version paraît, continuer d'éditer l'ancienne ne mène qu'à écraser le travail d'autrui en
 * publiant. On préfère donc perdre un brouillon que perdre une version publiée - c'est la
 * concession assumée (cf. le fork de juillet 2026), d'autant qu'un brouillon périmé condamnait
 * déjà son auteur à republier une donnée dépassée.
 *
 * Le fait qu'un brouillon ait été abandonné est mémorisé pour que l'admin puisse l'annoncer,
 * plutôt que de voir son écran changer sans explication.
 */
export function readAdminDraft(): AdminDraft | null {
  // Un brouillon d'avant le versionnage n'a pas d'origine connue : indécidable, donc écarté.
  removeLocalStorage(LEGACY_ADMIN_CATALOG_KEY);
  let draft: AdminDraft;
  try {
    const raw = readLocalStorage(ADMIN_CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { baseVersionId?: unknown; catalog?: unknown };
    draft = {
      baseVersionId: typeof parsed.baseVersionId === "number" ? parsed.baseVersionId : null,
      catalog: parseCatalog(parsed.catalog),
    };
  } catch {
    /* JSON/quota/validation invalides → le brouillon est inexploitable */
    removeLocalStorage(ADMIN_CATALOG_KEY);
    return null;
  }

  if (draft.baseVersionId === (readPublishedCatalog()?.versionId ?? null)) return draft;
  dropAdminDraft();
  writeLocalStorage(STALE_DRAFT_KEY, "1");
  return null;
}

/** Enregistre le brouillon en le rattachant à la version publiée qu'il modifie. */
export function writeAdminDraft(baseVersionId: number | null, draft: Catalog): void {
  writeLocalStorage(ADMIN_CATALOG_KEY, JSON.stringify({ baseVersionId, catalog: draft }));
}

/** Abandonne le brouillon admin (publication, reprise du serveur, ou péremption). */
export function dropAdminDraft(): void {
  removeLocalStorage(ADMIN_CATALOG_KEY);
}

/** Un brouillon a-t-il été abandonné parce qu'une nouvelle version avait paru ? */
export function staleDraftWasDropped(): boolean {
  return readLocalStorage(STALE_DRAFT_KEY) !== null;
}

/** Efface l'annonce, une fois que l'admin en a pris connaissance. */
export function clearStaleDraftNotice(): void {
  removeLocalStorage(STALE_DRAFT_KEY);
}

/**
 * Retourne le catalogue actif, par ordre de priorité :
 * 1. le brouillon admin de ce navigateur, **s'il porte sur la version publiée courante** ;
 * 2. la dernière version publiée mise en cache (serveur = source de vérité) ;
 * 3. le catalogue bundlé (première visite hors-ligne, ou aucune version publiée).
 */
export function loadCatalog(): Catalog {
  return readAdminDraft()?.catalog ?? readPublishedCatalog()?.catalog ?? catalog;
}

/**
 * La dernière version publiée diffère-t-elle du `catalog.json` embarqué dans le build ?
 *
 * Le fichier du dépôt reste le repli (première visite, hors-ligne, aucune version publiée) : quand
 * il décroche de ce qui est réellement servi aux joueurs, il faut le resynchroniser (Exporter le
 * JSON depuis l'admin, puis le committer). Les deux catalogues sortent de `parseCatalog`, donc
 * comparables texte à texte sans risque de faux positif dû à l'ordre des clés.
 */
export function publishedDivergesFromFile(): boolean {
  const published = readPublishedCatalog();
  if (!published) return false;
  return JSON.stringify(published.catalog) !== JSON.stringify(catalog);
}

/**
 * Le détail de cet écart : ce que la version publiée apporte par rapport au `catalog.json` du dépôt.
 * Le fichier est donc l'état de départ et la version publiée l'état d'arrivée, dans le sens de la
 * resynchronisation à faire. `null` si aucune version publiée n'est connue.
 */
export function publishedDiffFromFile(): CatalogDiff | null {
  const published = readPublishedCatalog();
  return published ? diffCatalogs(catalog, published.catalog) : null;
}

// Sérialisations calculées une fois : c'est la partie coûteuse de la comparaison. Sans ce cache, le
// garde-fou ne pouvait être appelé qu'avec parcimonie - d'où un bandeau qui restait affiché après
// avoir été résolu. Le brouillon étant désormais enveloppé, on mémorise le verdict par contenu brut :
// tant que le brouillon ne bouge pas, la comparaison se réduit à celle de deux chaînes.
let bundledSerialized: string | null = null;
let lastDraftRaw: string | null = null;
let lastDraftDiverges = false;

/**
 * Un brouillon admin est-il actif ET différent de `catalog.json` ?
 * Garde-fou en dev : le brouillon masque le fichier, donc les modifications faites directement dans
 * `catalog.json` ne sont pas visibles tant qu'on n'a pas repris le fichier (« Repartir du fichier »).
 */
export function localCatalogDivergesFromFile(): boolean {
  const raw = readLocalStorage(ADMIN_CATALOG_KEY);
  if (!raw) return false;
  if (raw !== lastDraftRaw) {
    lastDraftRaw = raw;
    bundledSerialized ??= JSON.stringify(catalog);
    let body: string | undefined;
    try {
      body = JSON.stringify((JSON.parse(raw) as { catalog?: unknown }).catalog);
    } catch {
      body = undefined; // brouillon illisible : il ne représente pas le fichier
    }
    lastDraftDiverges = body !== bundledSerialized;
  }
  return lastDraftDiverges;
}
