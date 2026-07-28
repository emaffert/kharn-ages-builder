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
  | "spell" | "magicWay" | "specialCard" | "mount" | "mountType" | "grimoire";

/**
 * Clés dont la valeur (chaîne, ou tableau de chaînes) désigne une entité de ce type.
 *
 * Volontairement nominatif plutôt qu'une recherche de texte : un parcours qui remplacerait toute
 * chaîne égale à l'identifiant abîmerait les verbatims, les noms et les traits.
 */
const REF_KEYS: Record<RefKind, readonly string[]> = {
  profile: ["profileIds", "profileId", "subjectProfileId", "requiredProfileId", "excludedProfileIds"],
  model: ["modelId", "modelIds"],
  equipment: ["baseEquipmentIds", "equipmentIds", "addedEquipmentIds"],
  faction: ["factionId", "factionIds", "allowedFactions", "factionEligibility", "factions"],
  skill: ["skillId", "skillIds"],
  spell: ["spellId", "spellIds"],
  magicWay: ["magicWayId", "magicWayIds"],
  specialCard: ["specialCardIds"],
  mount: ["mountId"],
  mountType: ["typeId"],
  grimoire: ["forbidGrimoires", "grimoireId"],
};

/** Libellé lisible d'une clé de référence, pour dire à l'utilisateur *où* l'identifiant est employé. */
const KEY_LABEL: Record<string, string> = {
  baseEquipmentIds: "équipement de base",
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
  skillId: "compétence",
  spellId: "sort",
  spellIds: "sorts",
  magicWayId: "voie de magie",
  specialCardIds: "cartes spéciales",
  mountId: "monture",
  typeId: "type de monture",
  forbidGrimoires: "grimoires interdits",
  grimoireId: "grimoire",
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
    if (REF_KEYS[kind].includes(key)) {
      const where = KEY_LABEL[key] ?? key;
      if (typeof value === "string") node[key] = fn(value, where);
      else if (Array.isArray(value)) node[key] = value.map((v) => (typeof v === "string" ? fn(v, where) : v));
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
