import { describe, expect, it } from "vitest";
import { entryKey, parseEntries, unseenEntries } from "./changelog";

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
  const entry = parseEntries(JOURNAL)[0];

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
    expect(parseEntries("# Titre seul\n\nRien.\n")).toEqual([]);
  });

  it("découpe toutes les entrées, de la plus récente à la plus ancienne", () => {
    expect(parseEntries(JOURNAL).map((e) => e.date)).toEqual(["2026-07-28", "2026-07-26"]);
  });
});

describe("signature d'une entrée", () => {
  const entry = parseEntries(JOURNAL)[0];

  it("est stable pour un journal inchangé", () => {
    expect(entryKey(entry)).toBe(entryKey(parseEntries(JOURNAL)[0]));
  });

  it("change quand une puce est ajoutée le même jour", () => {
    // Une date seule laisserait passer les compléments apportés après coup.
    const complete = JOURNAL.replace("- Encore une.", "- Encore une.\n- Et une de plus.");
    expect(entryKey(parseEntries(complete)[0])).not.toBe(entryKey(entry));
  });

  it("change quand une nouvelle entrée datée arrive", () => {
    const suivante = JOURNAL.replace("## 2026-07-28", "## 2026-07-29\n\n### Neuf\n\n- Une nouveauté.\n\n## 2026-07-28");
    expect(entryKey(parseEntries(suivante)[0])).not.toBe(entryKey(entry));
  });
});

describe("ce qui reste à lire", () => {
  const entries = parseEntries(JOURNAL);

  it("à la première visite, ne déroule pas tout l'historique", () => {
    expect(unseenEntries(entries, null).map((e) => e.date)).toEqual(["2026-07-28"]);
  });

  it("montre les deux versions à qui en a sauté une", () => {
    const vieux = entryKey(entries[1]); // l'utilisateur en était resté au 26
    expect(unseenEntries(entries, vieux).map((e) => e.date)).toEqual(["2026-07-28"]);
  });

  it("ne montre rien quand la dernière entrée est déjà lue", () => {
    expect(unseenEntries(entries, entryKey(entries[0]))).toEqual([]);
  });

  it("réannonce une entrée complétée après lecture, sans remonter plus loin", () => {
    // Signature d'une version antérieure du 28 : seule cette entrée est réannoncée.
    const avantComplement = "2026-07-28:autrehash";
    expect(unseenEntries(entries, avantComplement).map((e) => e.date)).toEqual(["2026-07-28"]);
  });

  // Une journée à plus de neuf entrées : « (10) » se compare comme plus petit que « (9) », ce qui
  // faisait passer la plus récente pour la plus ancienne et n'annonçait plus rien du tout.
  it("compte les entrées d'un même jour dans le bon ordre au-delà de la dixième", () => {
    const journee = `# Journal

## 2026-08-06 (10)

### Dixième

- Une puce.

## 2026-08-06 (9)

### Neuvième

- Une puce.

## 2026-08-05

### Veille

- Une puce.
`;
    const entries = parseEntries(journee);
    expect(unseenEntries(entries, entryKey(entries[1])).map((e) => e.date)).toEqual(["2026-08-06 (10)"]);
    expect(unseenEntries(entries, entryKey(entries[2])).map((e) => e.date)).toEqual([
      "2026-08-06 (10)",
      "2026-08-06 (9)",
    ]);
  });

  it("s'arrête à la dernière entrée lue, même si le journal en compte beaucoup", () => {
    const long = JOURNAL.replace("## 2026-07-26", "## 2026-07-27\n\n### Intermédiaire\n\n- Une puce.\n\n## 2026-07-26");
    const toutes = parseEntries(long);
    expect(unseenEntries(toutes, entryKey(toutes[2])).map((e) => e.date)).toEqual(["2026-07-28", "2026-07-27"]);
  });
});
