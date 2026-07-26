import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { parseCatalog } from "./index";

/** Catalogue valide dont on remplace le recrutement du premier profil par des contraintes d'époque. */
function legacy(recruitment: unknown[]): unknown {
  const raw = structuredClone(catalog) as { profiles: { recruitment: unknown[]; notes?: string[] }[] };
  raw.profiles[0].recruitment = recruitment;
  delete raw.profiles[0].notes;
  return raw;
}

describe("mise à niveau d'un catalogue antérieur", () => {
  it("renomme « equipment-reserved » en « forbids-grimoire »", () => {
    const parsed = parseCatalog(
      legacy([
        {
          id: "c1",
          type: "equipment-reserved",
          params: { forbidGrimoires: ["grand"] },
          scope: "profil",
          sourceText: "Ne peut pas acquérir de « Grand Grimoire ».",
          severity: "error",
        },
      ]),
    );
    expect(parsed.profiles[0].recruitment[0].type).toBe("forbids-grimoire");
    expect(parsed.profiles[0].recruitment[0].params.forbidGrimoires).toEqual(["grand"]);
  });

  it("reverse une contrainte « custom » dans les notes internes au lieu de la perdre", () => {
    const parsed = parseCatalog(
      legacy([
        { id: "c1", type: "custom", params: {}, scope: "profil", sourceText: "Règle à encoder.", severity: "error" },
      ]),
    );
    expect(parsed.profiles[0].recruitment).toEqual([]);
    expect(parsed.profiles[0].notes).toContain("Règle à encoder.");
  });

  it("laisse intact un catalogue déjà à jour", () => {
    expect(parseCatalog(catalog)).toEqual(catalog);
  });
});
