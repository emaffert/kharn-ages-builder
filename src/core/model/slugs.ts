import type { Catalog } from "./catalog";
import { COLLECTION_OF, canRenameId, idIsFree, type RefKind } from "./references";

/**
 * Identifiants lisibles, dérivés du nom.
 *
 * Une entité créée dans l'administration naît sans nom, donc avec un identifiant technique
 * (`profile-1785410170666`) : au moment de la créer, il n'y a rien d'autre à en tirer. Ces
 * identifiants finissent pourtant dans les scripts, les diffs et les messages d'erreur, où ils
 * n'apprennent rien. Ce module donne la règle qui les remplace, une fois le nom connu.
 */

/** Identifiant produit par la création dans l'admin : un horodatage, rien de parlant. */
const TECHNIQUE = /\d{9,}/;

/** L'identifiant est-il encore celui que la création a fabriqué ? */
export function isTechnicalId(id: string): boolean {
  return TECHNIQUE.test(id);
}

/** Nom → identifiant : sans accents, en minuscules, les séparateurs réduits à un tiret. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Nom d'affichage d'une entité, selon la collection (les compétences n'ont pas de `name`). */
function displayNameOf(entity: Record<string, unknown>): string {
  for (const key of ["name", "keyword", "label"]) {
    const v = entity[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/**
 * Racine de l'identifiant, par collection. Le nom seul ne suffit pas partout : trois « Likan » et
 * trois « Exécuteur » cohabitent chez les profils, deux « Guerrier » chez les modèles. On reprend
 * donc la convention déjà en place dans le catalogue - faction, nom, niveau - qui les sépare.
 */
function stemFor(cat: Catalog, kind: RefKind, entity: Record<string, unknown>): string {
  // Un niveau de monture n'a **pas de nom propre** : il se nomme par son type et son rang. Traité
  // avant le garde-fou sur le nom vide, qui l'écarterait à tort.
  if (kind === "mount") {
    const type = cat.mountTypes.find((t) => t.id === entity.typeId);
    return type ? [slugify(type.name), entity.level].filter(Boolean).join("-") : "";
  }
  const nom = slugify(displayNameOf(entity));
  if (!nom) return "";
  const faction = typeof entity.factionId === "string" ? entity.factionId : undefined;
  if (kind === "profile") return [faction, nom, entity.level].filter(Boolean).join("-");
  if (kind === "model") return [faction, nom].filter(Boolean).join("-");
  return nom;
}

/**
 * Identifiant proposé pour cette entité, libre de toute collision. `undefined` si l'entité n'a pas
 * encore de nom, si son type interdit le renommage, ou si son identifiant actuel convient déjà.
 *
 * `reserved` permet de traiter un lot d'un coup : les identifiants déjà attribués dans le même
 * passage y sont ajoutés au fur et à mesure, sinon deux entités homonymes viseraient le même.
 */
export function suggestId(
  cat: Catalog,
  kind: RefKind,
  id: string,
  reserved: ReadonlySet<string> = new Set(),
): string | undefined {
  if (!canRenameId(kind, id)) return undefined;
  const list = cat[COLLECTION_OF[kind]] as unknown as Record<string, unknown>[];
  const entity = list.find((e) => e.id === id);
  if (!entity) return undefined;
  const stem = stemFor(cat, kind, entity);
  if (!stem || stem === id) return undefined;
  const libre = (candidat: string) =>
    !reserved.has(candidat) && idIsFree(cat, kind, candidat, id);
  if (libre(stem)) return stem;
  // Homonymes que la convention ne sépare pas (deux « Dague damasquinée ») : on numérote.
  for (let n = 2; n <= 99; n += 1) {
    const candidat = `${stem}-${n}`;
    if (libre(candidat)) return candidat;
  }
  return undefined;
}

/** Une entité à renommer, telle que l'outil de rattrapage la présente. */
export interface IdSuggestion {
  kind: RefKind;
  from: string;
  to: string;
  /** Nom affiché, pour que la liste se lise sans déchiffrer les identifiants. */
  label: string;
}

/**
 * Toutes les entités dont l'identifiant est encore technique et pour lesquelles le nom permet d'en
 * proposer un meilleur. Les propositions sont calculées **ensemble**, chacune réservant la sienne :
 * deux entités homonymes reçoivent ainsi deux identifiants distincts.
 */
export function technicalIdSuggestions(cat: Catalog): IdSuggestion[] {
  const out: IdSuggestion[] = [];
  const reserved = new Set<string>();
  for (const kind of Object.keys(COLLECTION_OF) as RefKind[]) {
    const list = cat[COLLECTION_OF[kind]] as unknown as Record<string, unknown>[] | undefined;
    for (const entity of list ?? []) {
      const id = entity.id;
      if (typeof id !== "string" || !isTechnicalId(id)) continue;
      const to = suggestId(cat, kind, id, reserved);
      if (!to) continue;
      reserved.add(to);
      out.push({ kind, from: id, to, label: displayNameOf(entity) || id });
    }
  }
  return out;
}
