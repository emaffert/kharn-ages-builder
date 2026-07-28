/**
 * Comparaison de deux catalogues : ce qui a été ajouté, retiré ou modifié, entité par entité.
 *
 * Complète `publishedDivergesFromFile` : celui-ci répond « ça a bougé », celui-là répond « quoi ».
 * La comparaison porte sur des catalogues normalisés par `parseCatalog`, donc insensible à l'ordre
 * des clés ; seules les valeurs comptent.
 *
 * Le résultat reste une donnée brute (valeurs avant/après non formatées) : c'est la vue qui décide
 * comment les présenter, et notamment comment tronquer ce qui est trop long pour être lu.
 */

import type { Catalog } from "@core";

/** Une valeur modifiée, repérée par son chemin dans l'entité (`stats.v`, `skills[riposte].value`). */
export interface FieldChange {
  path: string;
  before: unknown;
  after: unknown;
}

/** Le sort d'une entité entre les deux catalogues. */
export type EntryChange =
  | { kind: "added" | "removed"; id: string; label: string; fields?: undefined; hidden?: undefined }
  | { kind: "changed"; id: string; label: string; fields: FieldChange[]; hidden: number };

/** Une famille d'entités (les profils, l'équipement…) et ce qui y a changé. */
export interface DiffSection {
  key: string;
  title: string;
  changes: EntryChange[];
}

/** Les sections qui ont changé (les autres sont omises) et le nombre total de changements. */
export interface CatalogDiff {
  sections: DiffSection[];
  total: number;
}

/** Profondeur maximale de descente dans une entité : au-delà, la valeur est rendue en bloc. */
const MAX_DEPTH = 6;
/** Nombre de lignes conservées pour une même entité ; le surplus est compté, pas listé. */
const MAX_FIELDS = 20;

const ROMAN = ["", "I", "II", "III"];

type Entity = { id: string } & Record<string, unknown>;

const asEntities = <T extends { id: string }>(list: readonly T[]): Entity[] => list as unknown as Entity[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deux valeurs sont-elles équivalentes ? `undefined` et `null` sont ramenés au même cas : un champ
 * optionnel absent d'un côté et nul de l'autre décrit la même donnée, et le signaler ne ferait que
 * du bruit.
 */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Clé d'appariement des éléments d'un tableau d'objets. Sans elle, l'insertion d'un élément en tête
 * décalerait tous les indices et ferait apparaître la liste entière comme modifiée.
 */
const ELEMENT_KEYS = ["id", "skillId", "equipmentId", "spellId", "profileId", "upgradeId"] as const;

function elementKey(value: unknown): string | null {
  if (!isPlainObject(value)) return null;
  for (const key of ELEMENT_KEYS) {
    const raw = value[key];
    if (typeof raw === "string" && raw) return raw;
  }
  return null;
}

/** Les clés d'un tableau, si *tous* ses éléments en ont une et qu'aucune n'est en double. */
function keysOf(list: unknown[]): string[] | null {
  const keys = list.map(elementKey);
  if (keys.some((k) => k === null)) return null;
  const unique = new Set(keys as string[]);
  return unique.size === keys.length ? (keys as string[]) : null;
}

/** Descend dans deux valeurs et pousse les différences feuille à feuille dans `out`. */
function diffValue(before: unknown, after: unknown, path: string, out: FieldChange[], depth: number): void {
  if (out.length > MAX_FIELDS) return; // une ligne d'avance sur la limite : elle sert à compter le surplus
  if (same(before, after)) return;

  if (depth < MAX_DEPTH && isPlainObject(before) && isPlainObject(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      diffValue(before[key], after[key], path ? `${path}.${key}` : key, out, depth + 1);
    }
    return;
  }

  if (depth < MAX_DEPTH && Array.isArray(before) && Array.isArray(after)) {
    const beforeKeys = keysOf(before);
    const afterKeys = keysOf(after);
    if (beforeKeys && afterKeys) {
      const byKey = (list: unknown[], keys: string[], key: string) => list[keys.indexOf(key)];
      for (const key of new Set([...afterKeys, ...beforeKeys])) {
        diffValue(byKey(before, beforeKeys, key), byKey(after, afterKeys, key), `${path}[${key}]`, out, depth + 1);
      }
      return;
    }
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      diffValue(before[i], after[i], `${path}[${i}]`, out, depth + 1);
    }
    return;
  }

  out.push({ path, before, after });
}

/** Les champs modifiés d'une entité, plafonnés à `MAX_FIELDS` (le reste est compté). */
function changedFields(before: Entity, after: Entity): { fields: FieldChange[]; hidden: number } {
  const found: FieldChange[] = [];
  diffValue(before, after, "", found, 0);
  return { fields: found.slice(0, MAX_FIELDS), hidden: Math.max(0, found.length - MAX_FIELDS) };
}

/** Une famille d'entités du catalogue, et comment nommer les siennes à l'écran. */
interface SectionSpec {
  key: string;
  title: string;
  pick: (cat: Catalog) => Entity[];
  label: (entity: Entity, cat: Catalog) => string;
}

/**
 * Comment nommer une entité : son nom si elle en a un, sinon le mot-clé d'une compétence ou le
 * libellé d'une sorte de munition, sinon son identifiant. Aucune famille n'échappe ainsi à un nom
 * lisible, sans avoir à décrire chacune.
 */
const byName = (e: Entity): string => {
  for (const key of ["name", "keyword", "label"]) {
    const raw = e[key];
    if (typeof raw === "string" && raw.trim()) return raw;
  }
  return e.id;
};

/** « Larbin I », « Quagga III » : le niveau fait partie de l'identité d'une entité qui en a un. */
const withLevel = (name: string, level: unknown): string =>
  typeof level === "number" ? `${name} ${ROMAN[level] ?? level}` : name;

const SECTIONS: SectionSpec[] = [
  { key: "factions", title: "Factions", pick: (c) => asEntities(c.factions), label: byName },
  { key: "models", title: "Groupes de figurines", pick: (c) => asEntities(c.models), label: byName },
  {
    key: "profiles",
    title: "Profils",
    pick: (c) => asEntities(c.profiles),
    label: (e) => withLevel(byName(e), e.level),
  },
  { key: "skills", title: "Compétences", pick: (c) => asEntities(c.skills), label: byName },
  { key: "equipment", title: "Équipement", pick: (c) => asEntities(c.equipment), label: byName },
  { key: "specialCards", title: "Cartes spéciales", pick: (c) => asEntities(c.specialCards), label: byName },
  { key: "spells", title: "Sorts", pick: (c) => asEntities(c.spells), label: byName },
  { key: "magicWays", title: "Voies de magie", pick: (c) => asEntities(c.magicWays), label: byName },
  { key: "grimoires", title: "Grimoires", pick: (c) => asEntities(c.grimoires), label: byName },
  { key: "mountTypes", title: "Types de monture", pick: (c) => asEntities(c.mountTypes), label: byName },
  {
    key: "mounts",
    title: "Montures",
    pick: (c) => asEntities(c.mounts),
    label: (e, cat) => {
      const type = cat.mountTypes.find((t) => t.id === e.typeId);
      return withLevel(type?.name ?? String(e.typeId), e.level);
    },
  },
  { key: "mountOptions", title: "Options de monture", pick: (c) => asEntities(c.mountOptions), label: byName },
  { key: "munitionKinds", title: "Sortes de munitions", pick: (c) => asEntities(c.munitionKinds ?? []), label: byName },
];

function diffSection(spec: SectionSpec, before: Catalog, after: Catalog): DiffSection {
  const beforeList = spec.pick(before);
  const afterList = spec.pick(after);
  const beforeById = new Map(beforeList.map((e) => [e.id, e]));
  const afterById = new Map(afterList.map((e) => [e.id, e]));
  const changes: EntryChange[] = [];

  // On suit l'ordre du catalogue d'arrivée : une entité ajoutée apparaît à sa place définitive.
  for (const entity of afterList) {
    const previous = beforeById.get(entity.id);
    if (!previous) {
      changes.push({ kind: "added", id: entity.id, label: spec.label(entity, after) });
      continue;
    }
    const { fields, hidden } = changedFields(previous, entity);
    if (fields.length > 0) {
      changes.push({ kind: "changed", id: entity.id, label: spec.label(entity, after), fields, hidden });
    }
  }
  for (const entity of beforeList) {
    if (!afterById.has(entity.id)) {
      changes.push({ kind: "removed", id: entity.id, label: spec.label(entity, before) });
    }
  }
  return { key: spec.key, title: spec.title, changes };
}

const GENERAL_FIELDS = [
  ["version", "Nom de la version"],
  ["rulesVersion", "Version des règles"],
  ["settings", "Paramètres de règles"],
] as const;

/** Ce qui ne relève d'aucune famille d'entités : les étiquettes de version et les réglages. */
function generalSection(before: Catalog, after: Catalog): DiffSection {
  const changes: EntryChange[] = [];
  for (const [key, label] of GENERAL_FIELDS) {
    const found: FieldChange[] = [];
    diffValue(before[key], after[key], "", found, 0);
    if (found.length > 0) {
      changes.push({ kind: "changed", id: key, label, fields: found.slice(0, MAX_FIELDS), hidden: Math.max(0, found.length - MAX_FIELDS) });
    }
  }
  return { key: "general", title: "Général", changes };
}

/**
 * Les portraits, comparés par leur seule référence : la valeur est un nom de fichier adressé par
 * contenu (ou, dans les versions publiées anciennes, une data-URI de plusieurs dizaines de kilo-octets).
 * Ni l'un ni l'autre ne se lit, donc on ne rapporte que le sort de chaque entrée.
 */
function iconsSection(before: Catalog, after: Catalog): DiffSection {
  const beforeIcons = before.icons ?? {};
  const afterIcons = after.icons ?? {};
  const changes: EntryChange[] = [];
  for (const [key, value] of Object.entries(afterIcons)) {
    if (!(key in beforeIcons)) changes.push({ kind: "added", id: key, label: key });
    else if (beforeIcons[key] !== value) changes.push({ kind: "changed", id: key, label: key, fields: [], hidden: 0 });
  }
  for (const key of Object.keys(beforeIcons)) {
    if (!(key in afterIcons)) changes.push({ kind: "removed", id: key, label: key });
  }
  return { key: "icons", title: "Portraits", changes };
}

/**
 * Compare deux catalogues. Les sections sans changement sont omises : la vue n'a qu'à parcourir ce
 * qu'elle reçoit, et `total === 0` signifie « les deux catalogues portent la même donnée ».
 */
export function diffCatalogs(before: Catalog, after: Catalog): CatalogDiff {
  const sections = [
    generalSection(before, after),
    ...SECTIONS.map((spec) => diffSection(spec, before, after)),
    iconsSection(before, after),
  ].filter((section) => section.changes.length > 0);

  return { sections, total: sections.reduce((sum, section) => sum + section.changes.length, 0) };
}
