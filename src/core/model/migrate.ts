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

/**
 * Équipement de base en plusieurs exemplaires : il s'écrivait en répétant l'identifiant (trois
 * « Dose de poison » pour la Camériste). La répétition ne se voyait qu'au coût - l'affichage, le
 * retrait et le marquage « non retirable » raisonnaient par objet, pas par exemplaire. On la replie
 * donc sur `baseEquipmentCounts`, seule forme comptée partout.
 */
function migrateBaseEquipmentCounts(p: Bag): string[] {
  const ids = Array.isArray(p.baseEquipmentIds) ? p.baseEquipmentIds.filter((v) => typeof v === "string") : [];
  if (ids.length === 0) return [];
  const counts: Bag = isBag(p.baseEquipmentCounts) ? { ...p.baseEquipmentCounts } : {};
  const unique: string[] = [];
  const repeated: string[] = [];
  for (const id of ids as string[]) {
    if (!unique.includes(id)) unique.push(id);
    else {
      counts[id] = (typeof counts[id] === "number" ? counts[id] : 1) + 1;
      repeated.push(id);
    }
  }
  p.baseEquipmentIds = unique;
  if (Object.keys(counts).length > 0) p.baseEquipmentCounts = counts;
  return repeated;
}

/**
 * L'origine s'écrivait en trait `monture-<faction>`, un nom qui décrivait la conséquence (la monture
 * accessible) plutôt que le fait (le peuple d'origine) - et qui restait donc muet pour un peuple sans
 * monture. On le replie sur le champ `origin`, seule forme lue désormais.
 */
function migrateOrigin(p: Bag): void {
  const traits = Array.isArray(p.traits) ? p.traits.filter((t) => typeof t === "string") : [];
  const mount = (traits as string[]).find((t) => t.startsWith("monture-"));
  if (!mount) return;
  p.traits = (traits as string[]).filter((t) => t !== mount);
  if (typeof p.origin !== "string") p.origin = mount.slice("monture-".length);
}

/**
 * L'armure se flaguait valeur par valeur (`armor.seuil`, `armor.durability`…), alors qu'elle se lit
 * d'un bloc sur la carte et qu'aucune de ses valeurs ne se vérifie seule. Les quatre chemins sont
 * repliés sur `armor` - sans quoi les anciens resteraient dans `unverifiedFields` sans plus aucun
 * bouton pour les effacer, donc un ⚠ perpétuel.
 */
const ARMOR_PATHS = ["armor.protectionEchec", "armor.seuil", "armor.protectionReussite", "armor.durability"];

function migrateArmorFlag(p: Bag): void {
  const flags = Array.isArray(p.unverifiedFields)
    ? p.unverifiedFields.filter((f): f is string => typeof f === "string")
    : [];
  if (!flags.some((f) => ARMOR_PATHS.includes(f))) return;
  const kept = flags.filter((f) => !ARMOR_PATHS.includes(f));
  p.unverifiedFields = kept.includes("armor") ? kept : [...kept, "armor"];
}

/**
 * Le texte d'une carte spéciale s'écrivait en blocs `RuleText`, calqués sur les règles d'un profil.
 * Personne n'en avait l'usage : l'étiquette n'était ni saisissable ni affichée, et l'éditeur
 * l'effaçait à la première frappe. On replie les blocs en **un seul texte**, séparés par une ligne
 * vide - la séparation visuelle des paragraphes est ainsi conservée telle qu'elle se lisait.
 */
function migrateCardRulesText(card: Bag): void {
  if (!Array.isArray(card.rulesText)) return;
  card.rulesText = card.rulesText
    .filter(isBag)
    .map((b) => {
      const text = typeof b.text === "string" ? b.text.trim() : "";
      const label = typeof b.label === "string" ? b.label.trim() : "";
      return label && text ? `${label} : ${text}` : label || text;
    })
    .filter((t) => t !== "")
    .join("\n\n");
}

/**
 * Blancs de bord d'un texte verbatim : invisibles à la saisie, mais bien là une fois le texte rendu
 * avec ses retours à la ligne. Nettoyés à la lecture, donc aussi dans un brouillon d'administration
 * ou une version publiée. Les **lignes vides internes** sont conservées : c'est le seul moyen dont
 * dispose l'utilisateur pour séparer deux paragraphes dans un champ unique.
 */
function trimVerbatim(node: unknown, keys: readonly string[]): void {
  for (const bag of bags(node)) {
    for (const k of keys) if (typeof bag[k] === "string") bag[k] = (bag[k] as string).trim();
  }
}

/** Applique les rattrapages à une donnée brute de catalogue (non mutante pour l'appelant). */
export function migrateCatalog(data: unknown): unknown {
  if (!isBag(data)) return data;
  const cat = structuredClone(data) as Bag;
  // Un objet qu'une figurine portait en plusieurs exemplaires est empilable par constat.
  const stacked = new Set(bags(cat.profiles).flatMap(migrateBaseEquipmentCounts));
  for (const e of bags(cat.equipment)) {
    if (typeof e.id === "string" && stacked.has(e.id)) e.stackable = true;
  }
  for (const p of bags(cat.profiles)) {
    migrateConstraintHolder(p, "recruitment");
    migrateOrigin(p);
    migrateArmorFlag(p);
  }
  for (const c of bags(cat.specialCards)) {
    migrateConstraintHolder(c, "constraints");
    migrateCardRulesText(c);
  }
  // Textes verbatim, partout où l'utilisateur les saisit à la main.
  trimVerbatim(cat.specialCards, ["rulesText"]);
  trimVerbatim(cat.equipment, ["effectsText"]);
  trimVerbatim(cat.skills, ["sourceText"]);
  trimVerbatim(cat.spells, ["effectText", "sourceText", "description"]);
  for (const p of bags(cat.profiles)) trimVerbatim(p.rules, ["text"]);
  for (const m of bags(cat.mounts)) trimVerbatim(m.rules, ["text"]);
  for (const [collection, field] of NAMED_COLLECTIONS) {
    for (const entity of bags(cat[collection])) {
      if (typeof entity[field] === "string") entity[field] = displayName(entity[field]);
    }
  }
  return cat;
}
