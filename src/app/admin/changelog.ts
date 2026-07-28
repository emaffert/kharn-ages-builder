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
 * Extrait la première entrée datée du journal (la plus récente, le fichier étant antichronologique).
 * Volontairement minimal : le journal n'emploie que trois formes, un titre de date, des rubriques et
 * des puces, et les puces se poursuivent sur plusieurs lignes.
 */
export function parseLatestEntry(markdown: string): ChangelogEntry | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## "));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  const body = lines.slice(start + 1, end < 0 ? undefined : end);

  const entry: ChangelogEntry = { date: lines[start].slice(3).trim(), sections: [] };
  let section: ChangelogEntry["sections"][number] | null = null;
  for (const line of body) {
    if (line.startsWith("### ")) {
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
  return entry;
}
