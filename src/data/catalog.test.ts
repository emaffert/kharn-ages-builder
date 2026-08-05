import { describe, it, expect } from "vitest";
import { loadCatalog, catalog } from "@data";

describe("catalogue", () => {
  it("est validé par Zod et se charge sans erreur", () => {
    expect(() => loadCatalog()).not.toThrow();
  });

  it("contient les profils transcrits par faction", () => {
    const byFaction = (id: string) => catalog.profiles.filter((p) => p.factionId === id).length;
    expect(byFaction("fangs")).toBe(22);
    expect(byFaction("gouns")).toBe(20);
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

  // Les casques sont une famille à part (p.14), et leur durée de vie est le nombre de cases à cocher
  // de la carte : seuls le Bassinet et la Cervelière en ont, les autres valent toute la partie.
  it("range les six casques dans leur catégorie, avec la durée de vie des seuls concernés", () => {
    const casques = catalog.equipment.filter((e) => e.category === "casque");
    expect(casques.map((e) => e.id).sort()).toEqual([
      "barbute",
      "bassinet",
      "casque-a-nasal",
      "casque-a-plumet",
      "cerveliere",
      "heaume",
    ]);
    const avecDV = casques.filter((e) => e.durability != null);
    expect(avecDV.map((e) => [e.id, e.durability])).toEqual([
      ["bassinet", 5],
      ["cerveliere", 5],
    ]);
    // Le nombre d'utilisations a quitté les textes d'effet pour le champ dédié.
    expect(casques.filter((e) => /utilisations/i.test(e.effectsText))).toEqual([]);
  });

  // « Aucun équipement » se dit en énumérant les catégories : en oublier une ouvre une porte.
  it("n'ouvre pas les casques à qui n'a droit à aucun équipement", () => {
    const holders = [
      ...catalog.profiles.map((p) => ({ id: p.id, rules: p.recruitment })),
      ...catalog.specialCards.map((c) => ({ id: c.id, rules: c.constraints })),
    ];
    const trous = holders.filter(({ rules }) =>
      rules.some((r) => {
        if (r.type !== "forbids-equipment") return false;
        const cats = (r.params as { categories?: string[] }).categories ?? [];
        return cats.includes("objet") && cats.includes("armure") && !cats.includes("casque");
      }),
    );
    expect(trous.map((h) => h.id)).toEqual([]);
  });

  // L'Affûtage n'est plus un objet qu'on achète dans son coin : c'est une amélioration d'arme.
  it("porte l'Affûtage en amélioration de catalogue, et plus en équipement", () => {
    expect(catalog.equipment.find((e) => e.id === "affutage")).toBeUndefined();
    const affutage = (catalog.equipmentUpgrades ?? []).find((u) => u.id === "affutage");
    expect(affutage).toBeDefined();
    expect(affutage!.equipmentCategories).toEqual(["arme-cac"]);
    expect(affutage!.requiresTranchant).toBe(true);
    expect(affutage!.forbiddenOnFreeWeapon).toBe(true);
  });

  it("ne pose le tranchant que sur des armes", () => {
    const horsArmes = catalog.equipment.filter(
      (e) => e.tranchant && e.category !== "arme-cac" && e.category !== "arme-tir",
    );
    expect(horsArmes.map((e) => e.id)).toEqual([]);
    // Le tri par famille : ni les masses, ni les cannes, ni les bâtons ne coupent.
    const contondantes = ["gourdin", "canne-alaric", "canne-des-sages", "marteau-de-guerre", "fleau"];
    expect(contondantes.filter((id) => catalog.equipment.find((e) => e.id === id)?.tranchant)).toEqual([]);
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

  it("montures : chaque niveau référence un type, une faction et des compétences existants", () => {
    const typeIds = new Set(catalog.mountTypes.map((t) => t.id));
    const factionIds = new Set(catalog.factions.map((f) => f.id));
    const skillIds = new Set(catalog.skills.map((s) => s.id));
    const profileIds = new Set(catalog.profiles.map((p) => p.id));
    expect(catalog.mounts.filter((m) => !typeIds.has(m.typeId))).toEqual([]);
    const badFactions = catalog.mountTypes.flatMap((t) => t.factionEligibility.filter((f) => !factionIds.has(f)));
    expect(badFactions).toEqual([]);
    const badExcluded = catalog.mountTypes.flatMap((t) => (t.excludedProfileIds ?? []).filter((p) => !profileIds.has(p)));
    expect(badExcluded).toEqual([]);
    const badSkills = catalog.mounts.flatMap((m) => (m.grantedSkills ?? []).map((s) => s.skillId).filter((id) => !skillIds.has(id)));
    expect(badSkills).toEqual([]);
  });
});
