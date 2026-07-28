/**
 * Mises à niveau des catalogues antérieurs, appliquées **avant** la validation Zod.
 *
 * Un catalogue peut venir de trois endroits qui n'évoluent pas ensemble : le fichier du dépôt, une
 * version publiée sur le serveur, un brouillon d'administration dans le navigateur. Sans ce
 * rattrapage, un catalogue écrit avant un renommage serait rejeté en bloc et silencieusement
 * remplacé par le repli - donc perdu du point de vue de l'utilisateur.
 */

type Bag = Record<string, unknown>;

const isBag = (v: unknown): v is Bag => typeof v === "object" && v !== null && !Array.isArray(v);
const bags = (v: unknown): Bag[] => (Array.isArray(v) ? v.filter(isBag) : []);

/**
 * Porteur de contraintes (profil ou carte spéciale) : renomme les types obsolètes et reverse les
 * anciennes contraintes « custom » (jamais interprétées par le moteur) dans les notes internes,
 * qui sont désormais l'endroit prévu pour une règle non structurable.
 */
function migrateConstraintHolder(holder: Bag, key: "recruitment" | "constraints"): void {
  const list = bags(holder[key]);
  if (list.length === 0) return;
  const kept: Bag[] = [];
  const rescued: string[] = [];
  for (const c of list) {
    if (c.type === "equipment-reserved") c.type = "forbids-grimoire";
    if (c.type === "custom") {
      const text = typeof c.sourceText === "string" ? c.sourceText.trim() : "";
      if (text) rescued.push(text);
      continue;
    }
    kept.push(c);
  }
  holder[key] = kept;
  if (rescued.length > 0) {
    const notes = Array.isArray(holder.notes) ? holder.notes.filter((n) => typeof n === "string") : [];
    holder.notes = [...notes, ...rescued];
  }
}

/**
 * Nom d'entité affiché : première lettre en capitale, le reste intact.
 *
 * La casse saisie ne doit pas décider de ce que voit le joueur - « couteau » et « Couteau »
 * désignent le même objet, et rien ne justifie qu'une liste exportée montre l'un ou l'autre selon
 * l'humeur du jour. Normalisé à la lecture, donc valable pour le fichier du dépôt, une version
 * publiée et un brouillon d'administration.
 *
 * Réservé aux **noms d'entités** : les libellés qui vivent en milieu de phrase (« se recrute via
 * une femelle Fang », « garde du corps ») gardent leur minuscule, qui y est correcte.
 */
const NAMED_COLLECTIONS: [collection: string, field: string][] = [
  ["factions", "name"], ["skills", "keyword"], ["magicWays", "name"], ["models", "name"],
  ["profiles", "name"], ["equipment", "name"], ["grimoires", "name"], ["spells", "name"],
  ["mountTypes", "name"], ["mountOptions", "name"], ["specialCards", "name"],
];

/** Première lettre en capitale, espaces de bord retirés. Sans effet sur un nom déjà propre. */
export function displayName(raw: string): string {
  const s = raw.trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Applique les rattrapages à une donnée brute de catalogue (non mutante pour l'appelant). */
export function migrateCatalog(data: unknown): unknown {
  if (!isBag(data)) return data;
  const cat = structuredClone(data) as Bag;
  for (const p of bags(cat.profiles)) migrateConstraintHolder(p, "recruitment");
  for (const c of bags(cat.specialCards)) migrateConstraintHolder(c, "constraints");
  for (const [collection, field] of NAMED_COLLECTIONS) {
    for (const entity of bags(cat[collection])) {
      if (typeof entity[field] === "string") entity[field] = displayName(entity[field]);
    }
  }
  return cat;
}
