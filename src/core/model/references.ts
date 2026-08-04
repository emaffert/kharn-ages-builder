import type { Catalog } from "./catalog";

/**
 * Graphe des références entre entités du catalogue.
 *
 * Un identifiant n'est jamais isolé : un profil est cité par des cartes, des réservations
 * d'équipement, des sélecteurs d'effet ; un équipement par des équipements de base et des filtres
 * de coût. Renommer ou supprimer sans suivre ces liens laisse des références orphelines - c'est
 * exactement ce qui est arrivé en supprimant « couteau » à la main.
 *
 * Ce module est la source unique de ce graphe. Il sert au renommage en cascade **et** à l'alerte de
 * suppression, pour qu'ils ne puissent pas diverger.
 */

export type RefKind =
  | "profile" | "model" | "equipment" | "faction" | "skill"
  | "spell" | "magicWay" | "specialCard" | "mount" | "mountType" | "grimoire"
  | "munitionKind" | "mountOption";

/**
 * Clés dont la valeur (chaîne, ou tableau de chaînes) désigne une entité de ce type.
 *
 * Volontairement nominatif plutôt qu'une recherche de texte : un parcours qui remplacerait toute
 * chaîne égale à l'identifiant abîmerait les verbatims, les noms et les traits.
 */
const REF_KEYS: Record<RefKind, readonly string[]> = {
  profile: ["profileIds", "profileId", "subjectProfileId", "requiredProfileId", "excludedProfileIds"],
  model: ["modelId", "modelIds"],
  equipment: ["baseEquipmentIds", "fixedBaseEquipmentIds", "equipmentIds", "addedEquipmentIds"],
  faction: ["factionId", "factionIds", "allowedFactions", "factionEligibility", "factions", "origin", "originChoices", "fromFactionIds"],
  skill: ["skillId", "skillIds"],
  spell: ["spellId", "spellIds"],
  magicWay: ["magicWayId", "magicWayIds"],
  specialCard: ["specialCardIds"],
  mount: ["mountId"],
  mountType: ["typeId"],
  grimoire: ["forbidGrimoires", "grimoireId"],
  munitionKind: ["munitionKind"],
  // Les options de monture ne sont citées que par les listes des joueurs (`mountOptionIds`), jamais
  // par le catalogue : la clé est déclarée pour l'uniformité du traitement, elle ne trouve rien ici.
  mountOption: ["mountOptionIds"],
};

/** Libellé lisible d'une clé de référence, pour dire à l'utilisateur *où* l'identifiant est employé. */
const KEY_LABEL: Record<string, string> = {
  baseEquipmentIds: "équipement de base",
  fixedBaseEquipmentIds: "équipement de base non retirable",
  equipmentIds: "filtre d'équipement",
  addedEquipmentIds: "équipement ajouté",
  profileIds: "profils visés",
  profileId: "profil visé",
  subjectProfileId: "profil sujet",
  requiredProfileId: "profil requis",
  excludedProfileIds: "profils exclus",
  modelId: "modèle",
  modelIds: "modèles visés",
  factionId: "faction",
  factionIds: "factions visées",
  allowedFactions: "factions autorisées",
  factionEligibility: "factions éligibles",
  factions: "factions",
  origin: "peuple d'origine",
  originChoices: "peuples proposés au recrutement",
  fromFactionIds: "recrutement ouvert",
  skillId: "compétence",
  spellId: "sort",
  spellIds: "sorts",
  magicWayId: "voie de magie",
  specialCardIds: "cartes spéciales",
  mountId: "monture",
  typeId: "type de monture",
  forbidGrimoires: "grimoires interdits",
  grimoireId: "grimoire",
  munitionKind: "sorte de munition",
  mountOptionIds: "options de monture",
  costByFaction: "coût par faction",
  source: "source de l'effet",
};

/** `EffectSource.kind` → type d'entité, pour les effets qui portent l'identité de leur porteur. */
const SOURCE_KIND: Record<string, RefKind> = {
  profile: "profile",
  "special-card": "specialCard",
  mount: "mount",
  equipment: "equipment",
};

/** La collection du catalogue qui contient les entités de ce type (pour l'unicité d'un identifiant). */
export const COLLECTION_OF: Record<RefKind, keyof Catalog> = {
  profile: "profiles",
  model: "models",
  equipment: "equipment",
  faction: "factions",
  skill: "skills",
  spell: "spells",
  magicWay: "magicWays",
  specialCard: "specialCards",
  mount: "mounts",
  mountType: "mountTypes",
  grimoire: "grimoires",
  munitionKind: "munitionKinds",
  mountOption: "mountOptions",
};

/**
 * Types dont l'identifiant est une **constante du code**, donc impossible à renommer :
 *
 * - `grimoire` : « petit » et « grand » sont figés dans deux énumérations Zod
 *   (`ListDocument.grimoireId`, `EffectOperation.tier`) ; les renommer invaliderait le schéma ;
 * - `faction` : le constructeur associe couleurs, blason et accroche à chaque faction par son
 *   identifiant (`FACTIONS` dans `builder/shared.ts`) ; renommer ferait perdre l'habillage en
 *   silence, sans qu'aucune validation ne s'en aperçoive.
 */
export const FIXED_ID_KINDS: readonly RefKind[] = ["grimoire", "faction"];

/** Peut-on renommer une entité de ce type ? */
export const canRenameId = (kind: RefKind): boolean => !FIXED_ID_KINDS.includes(kind);

/** Une référence trouvée : qui cite l'identifiant, et à quel titre. */
export interface Reference {
  /** L'entité qui cite, telle qu'on la nomme à l'écran : « profil « Goulue » ». */
  owner: string;
  /** Le rôle de la citation : « équipement de base ». */
  where: string;
}

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * La valeur de cette clé porte-t-elle vraiment des identifiants ?
 *
 * Deux clés de `REF_KEYS` sont homonymes d'une **collection** du catalogue : `factions` (réservation
 * d'une option de monture) et `profiles` (nulle part, mais la symétrie coûte peu). À la racine, ces
 * clés portent les entités elles-mêmes, pas des références - les traiter comme une liste
 * d'identifiants reviendrait à ne jamais descendre dans la collection, et à laisser passer toute
 * référence nichée dans une faction.
 */
const holdsIds = (v: unknown): v is string | string[] =>
  typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string"));

/**
 * Parcourt les références de `kind` sous `node`. `fn` reçoit chaque identifiant rencontré et
 * retourne sa valeur de remplacement (identique pour une simple lecture).
 */
function mapRefs(node: unknown, kind: RefKind, fn: (id: string, where: string) => string): void {
  if (Array.isArray(node)) return node.forEach((n) => mapRefs(n, kind, fn));
  if (!isBag(node)) return;

  // Un effet porte l'identité de ce qui l'émet dans `source: { kind, id }`.
  const src = node.source;
  if (isBag(src) && typeof src.kind === "string" && typeof src.id === "string" && SOURCE_KIND[src.kind] === kind) {
    src.id = fn(src.id, KEY_LABEL.source);
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "source") continue; // déjà traité ci-dessus
    // Les factions indexent aussi un coût : elles sont alors des *clés* d'objet.
    if (key === "costByFaction" && kind === "faction" && isBag(value)) {
      node[key] = Object.fromEntries(
        Object.entries(value).map(([f, v]) => [fn(f, KEY_LABEL.costByFaction), v]),
      );
      continue;
    }
    if (REF_KEYS[kind].includes(key) && holdsIds(value)) {
      const where = KEY_LABEL[key] ?? key;
      node[key] = typeof value === "string" ? fn(value, where) : value.map((v) => fn(v, where));
      continue;
    }
    mapRefs(value, kind, fn);
  }
}

/** Nom lisible d'une entité de collection, pour les messages (« profil « Goulue » »). */
function ownerLabel(collection: string, entity: Bag): string {
  const kind =
    { profiles: "profil", models: "modèle", equipment: "équipement", factions: "faction",
      skills: "compétence", spells: "sort", magicWays: "voie", specialCards: "carte",
      mounts: "monture", mountTypes: "type de monture", mountOptions: "option de monture",
      grimoires: "grimoire", munitionKinds: "munition" }[collection] ?? collection;
  const name = typeof entity.name === "string" ? entity.name
    : typeof entity.keyword === "string" ? entity.keyword
    : typeof entity.label === "string" ? entity.label // sortes de munition
    : String(entity.id ?? "?");
  return `${kind} « ${name} »`;
}

/**
 * Où cet identifiant est-il cité dans le catalogue ? L'entité elle-même n'est pas comptée : seules
 * les citations par d'autres. Le résultat est dédoublonné (une carte qui cite dix fois un profil
 * n'apparaît qu'une fois par rôle).
 */
export function findReferences(cat: Catalog, kind: RefKind, id: string): Reference[] {
  const own = COLLECTION_OF[kind];
  const found = new Map<string, Reference>();
  for (const [collection, list] of Object.entries(cat)) {
    if (!Array.isArray(list)) continue;
    for (const entity of list as Bag[]) {
      if (!isBag(entity)) continue;
      // L'entité elle-même est écartée : ses effets portent son propre identifiant en `source`,
      // ce qui n'apprend rien sur « qui d'autre en dépend ».
      if (collection === own && entity.id === id) continue;
      mapRefs(entity, kind, (found_, where) => {
        if (found_ === id) {
          const ref = { owner: ownerLabel(collection, entity), where };
          found.set(`${ref.owner}|${ref.where}`, ref);
        }
        return found_;
      });
    }
  }
  return [...found.values()];
}

/** L'identifiant est-il libre dans sa collection ? (hors l'entité qui le porte déjà). */
export function idIsFree(cat: Catalog, kind: RefKind, id: string, exceptId?: string): boolean {
  const list = cat[COLLECTION_OF[kind]] as unknown as { id: string }[];
  return !list.some((e) => e.id === id && e.id !== exceptId);
}

/**
 * Renomme une entité **et toutes les références qui la citent**. Retourne un nouveau catalogue ;
 * l'original n'est pas modifié.
 */
export function renameId(cat: Catalog, kind: RefKind, oldId: string, newId: string): Catalog {
  const next = structuredClone(cat) as unknown as Bag;
  const own = COLLECTION_OF[kind];
  for (const entity of (next[own] as Bag[]) ?? []) if (entity.id === oldId) entity.id = newId;
  mapRefs(next, kind, (id) => (id === oldId ? newId : id));
  return next as unknown as Catalog;
}

/**
 * Références **facultatives** : quand l'entité citée disparaît, on vide le champ et l'objet citant
 * survit. Indexé par collection, car la même clé peut être structurelle ailleurs - `skillId` est
 * facultatif sur une voie de magie, mais constitutif d'une compétence de profil.
 */
const CLEARABLE_BY_COLLECTION: Record<string, readonly string[]> = {
  // Un transfuge dont le peuple d'origine disparaît reste recrutable : il perd seulement l'accès à
  // la monture et à la nature de ce peuple.
  profiles: ["modelId", "factionId", "origin"],
  // Une arme de tir dont la sorte de munition disparaît reste une arme : elle cesse seulement
  // d'ouvrir l'achat de munitions.
  equipment: ["munitionKind"],
  models: ["factionId"],
  magicWays: ["skillId"],
  spells: ["magicWayId"],
};

/** Références facultatives quel que soit l'endroit (l'opération « pages de sorts » notamment). */
const CLEARABLE_ANYWHERE = ["magicWayId"];

/**
 * Sous-objets **constitutifs** de leur parent : s'ils disparaissent, le parent disparaît aussi.
 * Un effet sans opération, ou une contrainte sans paramètres, ne serait plus un objet valide -
 * seulement un débris qui ferait échouer la validation du catalogue.
 */
const STRUCTURAL_CHILDREN = ["operation", "params", "carrier"];

/** Marque un objet dont la référence était structurelle : il disparaît avec elle. */
const DROP = Symbol("drop");

function prune(node: unknown, kind: RefKind, id: string): unknown | typeof DROP {
  if (Array.isArray(node)) {
    return node.map((n) => prune(n, kind, id)).filter((n) => n !== DROP);
  }
  if (!isBag(node)) return node;

  const out: Bag = {};
  for (const [key, value] of Object.entries(node)) {
    // Une source d'effet qui pointe vers l'entité supprimée : l'effet entier n'a plus d'émetteur.
    if (key === "source" && isBag(value) && typeof value.kind === "string"
      && SOURCE_KIND[value.kind] === kind && value.id === id) return DROP;

    if (key === "costByFaction" && kind === "faction" && isBag(value)) {
      out[key] = Object.fromEntries(Object.entries(value).filter(([f]) => f !== id));
      continue;
    }
    if (REF_KEYS[kind].includes(key) && holdsIds(value)) {
      if (Array.isArray(value)) { out[key] = value.filter((v) => v !== id); continue; }
      if (value === id) {
        if (CLEARABLE_ANYWHERE.includes(key)) continue; // champ vidé : l'objet survit
        return DROP;                                    // référence constitutive : l'objet part
      }
      out[key] = value;
      continue;
    }
    const pruned = prune(value, kind, id);
    if (pruned === DROP) {
      if (STRUCTURAL_CHILDREN.includes(key)) return DROP; // le parent ne survit pas sans lui
      continue; // sous-objet facultatif (ex. « occupe la place de ») : on le retire, l'objet reste
    }
    out[key] = pruned;
  }
  return out;
}

/**
 * Retire du catalogue **toutes les citations** d'un identifiant, sans supprimer l'entité elle-même.
 *
 * Une citation dans une liste disparaît de la liste ; une citation dont l'objet ne peut pas se
 * passer emporte cet objet (une compétence de profil, un effet « conférer ce sort », une monture
 * dont le type n'existe plus). Les références facultatives, elles, sont simplement vidées.
 */
export function removeReferences(cat: Catalog, kind: RefKind, id: string): Catalog {
  const clone = structuredClone(cat) as unknown as Bag;
  // Les références facultatives sont vidées d'abord, là où leur collection dit qu'elles le sont ;
  // le parcours générique n'a plus alors qu'à traiter les références structurelles.
  for (const [collection, keys] of Object.entries(CLEARABLE_BY_COLLECTION)) {
    for (const entity of (clone[collection] as Bag[]) ?? []) {
      for (const key of keys) if (entity[key] === id && REF_KEYS[kind].includes(key)) delete entity[key];
    }
  }
  return prune(clone, kind, id) as Catalog;
}

/** Entités présentes dans `before` et absentes de `after`, tous types confondus. */
function vanished(before: Catalog, after: Catalog): { kind: RefKind; id: string }[] {
  const gone: { kind: RefKind; id: string }[] = [];
  for (const [kind, collection] of Object.entries(COLLECTION_OF) as [RefKind, keyof Catalog][]) {
    const was = (before[collection] as unknown as { id: string }[] | undefined) ?? [];
    const still = new Set(((after[collection] as unknown as { id: string }[] | undefined) ?? []).map((e) => e.id));
    for (const e of was) if (!still.has(e.id)) gone.push({ kind, id: e.id });
  }
  return gone;
}

/**
 * Supprime une entité **et tout ce qui la cite**, en une seule opération. C'est le seul chemin de
 * suppression du catalogue : supprimer d'un simple filtre laissait des références orphelines,
 * invisibles jusqu'à ce qu'un joueur ouvre la fiche concernée - c'est ainsi que 16 profils se sont
 * retrouvés à pointer vers un « couteau » disparu.
 *
 * La cascade se poursuit d'elle-même. Une citation constitutive emporte l'objet qui la porte, et cet
 * objet peut être une entité à part entière : un niveau de monture s'en va avec son type, une voie
 * de magie avec sa faction. Ces entités-là sont reprises par le même chemin, sans quoi la suppression
 * réparerait une référence orpheline en en créant d'autres. S'y ajoute une dépendance que le graphe
 * ne voit pas : un groupe de figurines que sa dernière figurine quitte n'a plus de raison d'être.
 */
export function removeEntity(cat: Catalog, kind: RefKind, id: string): Catalog {
  let next = removeReferences(cat, kind, id);
  const collection = COLLECTION_OF[kind];
  const list = next[collection] as unknown as { id: string }[] | undefined;
  if (list) next = { ...next, [collection]: list.filter((e) => e.id !== id) };

  const handled = new Set([`${kind}:${id}`]);
  const emptied = kind === "profile" ? cat.profiles.find((p) => p.id === id)?.modelId : undefined;
  if (emptied != null && !next.profiles.some((p) => p.modelId === emptied)) {
    handled.add(`model:${emptied}`);
    next = removeEntity(next, "model", emptied);
  }
  // Chaque passe retire au moins une entité d'un catalogue fini : la descente s'arrête d'elle-même.
  for (const v of vanished(cat, next)) {
    if (!handled.has(`${v.kind}:${v.id}`)) next = removeEntity(next, v.kind, v.id);
  }
  return next;
}
