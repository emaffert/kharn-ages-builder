/**
 * Lecture du `CHANGELOG.md` du dépôt, embarqué au build. Séparé du composant pour ne pas casser le
 * rafraîchissement à chaud (un fichier qui exporte un composant n'exporte que des composants).
 */

/** Une entrée du journal : sa date, et ses rubriques. */
export interface ChangelogEntry {
  date: string;
  sections: { title: string; items: string[] }[];
}

/**
 * Découpe le journal en entrées datées, de la plus récente à la plus ancienne (l'ordre du fichier).
 * Volontairement minimal : le journal n'emploie que trois formes, un titre de date, des rubriques et
 * des puces, et les puces se poursuivent sur plusieurs lignes.
 */
export function parseEntries(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let section: ChangelogEntry["sections"][number] | null = null;

  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      entry = { date: line.slice(3).trim(), sections: [] };
      section = null;
      entries.push(entry);
    } else if (!entry) {
      continue; // en-tête du fichier, avant la première entrée
    } else if (line.startsWith("### ")) {
      section = { title: line.slice(4).trim(), items: [] };
      entry.sections.push(section);
    } else if (line.startsWith("- ")) {
      if (!section) entry.sections.push((section = { title: "", items: [] }));
      section.items.push(line.slice(2).trim());
    } else if (line.trim() && section?.items.length) {
      // Continuation d'une puce sur la ligne suivante.
      section.items[section.items.length - 1] += ` ${line.trim()}`;
    }
  }
  return entries;
}

/**
 * Signature d'une entrée : sa date **et** son contenu. Elle sert à savoir si l'utilisateur a déjà
 * vu ces nouveautés, quel que soit le chemin par lequel il est arrivé sur la nouvelle version -
 * bouton « Recharger », rafraîchissement spontané du navigateur, ou simple visite ultérieure.
 *
 * Le contenu entre dans la signature pour qu'une entrée complétée après coup soit réannoncée : une
 * date seule laisserait passer les ajouts du même jour.
 */
export function entryKey(entry: ChangelogEntry): string {
  const text = entry.sections.map((s) => s.title + s.items.join("")).join("");
  // Hachage FNV-1a : suffisant pour distinguer deux rédactions, et sans dépendance.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${entry.date}:${hash.toString(36)}`;
}

/**
 * Les entrées que cet utilisateur n'a pas encore lues, de la plus récente à la plus ancienne.
 *
 * Qui saute deux versions doit voir les deux : on remonte le journal jusqu'à retrouver ce qu'il
 * avait lu. La date sert de garde-fou, pour qu'une entrée retouchée après lecture n'entraîne pas
 * l'affichage de tout l'historique - seule celle du jour concerné est réannoncée.
 *
 * À la première visite, une seule entrée : dérouler tout le journal à quelqu'un qui découvre le
 * site n'annonce rien, ça l'assomme.
 */
export function unseenEntries(entries: ChangelogEntry[], seen: string | null): ChangelogEntry[] {
  if (entries.length === 0) return [];
  if (!seen) return entries.slice(0, 1);

  const seenDate = seen.split(":")[0];
  // Le garde-fou compare les **jours**, pas le titre entier : une date porte souvent un rang dans la
  // journée (« 2026-08-06 (10) »), et « (10) » est lexicographiquement plus petit que « (9) ». Comparer
  // les titres faisait passer la dixième entrée du jour pour la plus ancienne, et n'annonçait plus rien.
  const day = (date: string) => date.split(" ")[0];
  const unseen: ChangelogEntry[] = [];
  for (const entry of entries) {
    if (day(entry.date) < day(seenDate)) break; // déjà lue, et tout ce qui suit l'est aussi
    if (entryKey(entry) === seen) break;
    unseen.push(entry);
  }
  return unseen;
}
