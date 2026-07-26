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

/** Applique les rattrapages à une donnée brute de catalogue (non mutante pour l'appelant). */
export function migrateCatalog(data: unknown): unknown {
  if (!isBag(data)) return data;
  const cat = structuredClone(data) as Bag;
  for (const p of bags(cat.profiles)) migrateConstraintHolder(p, "recruitment");
  for (const c of bags(cat.specialCards)) migrateConstraintHolder(c, "constraints");
  return cat;
}
