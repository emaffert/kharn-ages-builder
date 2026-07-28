import { describe, expect, it } from "vitest";
import { parseLatestEntry } from "./changelog";

const JOURNAL = `# Journal des modifications

Texte d'introduction, à ignorer.

## 2026-07-28

### Une rubrique

- Une puce courte.
- Une puce longue qui se
  poursuit sur la ligne suivante.

### Une autre rubrique

- Encore une.

## 2026-07-26

### Version précédente

- Ne doit pas apparaître.
`;

describe("lecture du journal des modifications", () => {
  const entry = parseLatestEntry(JOURNAL)!;

  it("retient la première entrée datée, pas les précédentes", () => {
    expect(entry.date).toBe("2026-07-28");
    expect(entry.sections.map((s) => s.title)).toEqual(["Une rubrique", "Une autre rubrique"]);
  });

  it("recolle une puce écrite sur plusieurs lignes", () => {
    expect(entry.sections[0].items[1]).toBe("Une puce longue qui se poursuit sur la ligne suivante.");
  });

  it("n'emporte pas le texte d'introduction du fichier", () => {
    expect(JSON.stringify(entry)).not.toContain("introduction");
  });

  it("ne renvoie rien pour un journal sans entrée", () => {
    expect(parseLatestEntry("# Titre seul\n\nRien.\n")).toBeNull();
  });
});
