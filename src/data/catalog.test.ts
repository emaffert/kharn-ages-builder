import { describe, it, expect } from "vitest";
import { loadCatalog, fangsCatalog } from "@data";

describe("catalogue Fang", () => {
  it("est validé par Zod et se charge sans erreur", () => {
    expect(() => loadCatalog()).not.toThrow();
  });

  it("contient les 21 profils transcrits", () => {
    expect(fangsCatalog.profiles).toHaveLength(21);
  });

  it("a des identifiants de profil uniques", () => {
    const ids = fangsCatalog.profiles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("référence des compétences existantes dans le dictionnaire", () => {
    const known = new Set(fangsCatalog.skills.map((s) => s.id));
    const referenced = fangsCatalog.profiles.flatMap((p) => p.skills.map((s) => s.skillId));
    const unknown = [...new Set(referenced)].filter((id) => !known.has(id));
    expect(unknown).toEqual([]);
  });

  it("relie chaque profil d'un modèle à un modèle existant", () => {
    const modelIds = new Set(fangsCatalog.models.map((m) => m.id));
    const referenced = fangsCatalog.profiles
      .map((p) => p.modelId)
      .filter((id): id is string => Boolean(id));
    const unknown = referenced.filter((id) => !modelIds.has(id));
    expect(unknown).toEqual([]);
  });
});
