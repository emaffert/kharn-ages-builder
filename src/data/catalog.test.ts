import { describe, it, expect } from "vitest";
import { loadCatalog, catalog } from "@data";

describe("catalogue", () => {
  it("est validé par Zod et se charge sans erreur", () => {
    expect(() => loadCatalog()).not.toThrow();
  });

  it("contient les profils transcrits par faction", () => {
    const byFaction = (id: string) => catalog.profiles.filter((p) => p.factionId === id).length;
    expect(byFaction("fangs")).toBe(20);
    expect(byFaction("gouns")).toBe(19);
  });

  it("référence des équipements existants dans les équipements de base", () => {
    const known = new Set(catalog.equipment.map((e) => e.id));
    const referenced = catalog.profiles.flatMap((p) => p.baseEquipmentIds);
    const unknown = [...new Set(referenced)].filter((id) => !known.has(id));
    expect(unknown).toEqual([]);
  });

  it("inclut la compétence générique « Aliéné » et l'attribue aux Likans", () => {
    expect(catalog.skills.some((s) => s.id === "aliene")).toBe(true);
    const likan = catalog.profiles.find((p) => p.id === "fangs-likan-1")!;
    expect(likan.skills.find((s) => s.skillId === "aliene")?.value).toBe("femelle Fang");
  });

  it("a des identifiants de profil uniques", () => {
    const ids = catalog.profiles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("référence des compétences existantes dans le dictionnaire", () => {
    const known = new Set(catalog.skills.map((s) => s.id));
    const referenced = catalog.profiles.flatMap((p) => p.skills.map((s) => s.skillId));
    const unknown = [...new Set(referenced)].filter((id) => !known.has(id));
    expect(unknown).toEqual([]);
  });

  it("relie chaque profil d'un modèle à un modèle existant", () => {
    const modelIds = new Set(catalog.models.map((m) => m.id));
    const referenced = catalog.profiles
      .map((p) => p.modelId)
      .filter((id): id is string => Boolean(id));
    const unknown = referenced.filter((id) => !modelIds.has(id));
    expect(unknown).toEqual([]);
  });
});
