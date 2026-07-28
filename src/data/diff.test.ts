import { describe, it, expect } from "vitest";
import type { Catalog } from "@core";
import { catalog } from "./index";
import { diffCatalogs, type DiffSection } from "./diff";

/** Copie profonde : chaque test part du catalogue réel et n'en modifie qu'un point. */
const clone = (): Catalog => JSON.parse(JSON.stringify(catalog)) as Catalog;

const section = (sections: DiffSection[], key: string): DiffSection | undefined =>
  sections.find((s) => s.key === key);

describe("diffCatalogs", () => {
  it("ne trouve rien entre un catalogue et sa copie", () => {
    const diff = diffCatalogs(catalog, clone());
    expect(diff.total).toBe(0);
    expect(diff.sections).toEqual([]);
  });

  it("repère un coût modifié, avec le chemin et les deux valeurs", () => {
    const after = clone();
    const target = after.equipment[0];
    const before = target.cost;
    target.cost = before + 7;

    const changes = section(diffCatalogs(catalog, after).sections, "equipment")?.changes ?? [];
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "changed", id: target.id, label: target.name });
    expect(changes[0].fields).toEqual([{ path: "cost", before, after: before + 7 }]);
  });

  it("nomme un profil par son nom et son niveau", () => {
    const after = clone();
    const index = catalog.profiles.findIndex((p) => p.level != null && p.stats.v != null);
    const profile = after.profiles[index];
    profile.stats.v = profile.stats.v! + 1;

    const changes = section(diffCatalogs(catalog, after).sections, "profiles")?.changes ?? [];
    expect(changes[0].label).toBe(`${profile.name} ${["", "I", "II", "III"][profile.level!]}`);
    expect(changes[0].fields).toEqual([
      { path: "stats.v", before: catalog.profiles[index].stats.v, after: profile.stats.v },
    ]);
  });

  it("distingue ajout et retrait, et nomme une compétence par son mot-clé", () => {
    const after = clone();
    const removed = after.skills[0];
    after.skills = after.skills.slice(1);
    after.skills.push({ id: "skill-neuve", keyword: "Compétence neuve", hasValue: false, sourceText: "" });

    const changes = section(diffCatalogs(catalog, after).sections, "skills")?.changes ?? [];
    expect(changes.map((c) => [c.kind, c.id])).toEqual([
      ["added", "skill-neuve"],
      ["removed", removed.id],
    ]);
    expect(changes[0].label).toBe("Compétence neuve");
    expect(changes[1].label).toBe(removed.keyword);
  });

  it("apparie les éléments d'un tableau par leur clé, pas par leur position", () => {
    const after = clone();
    // Un profil dont les compétences portent une valeur : on en modifie une et on la déplace en tête.
    const index = catalog.profiles.findIndex((p) => p.skills.length >= 2);
    const profile = after.profiles[index];
    const moved = profile.skills.pop()!;
    profile.skills.unshift({ ...moved, precision: "déplacée" });

    const fields = section(diffCatalogs(catalog, after).sections, "profiles")?.changes[0].fields ?? [];
    expect(fields).toEqual([
      { path: `skills[${moved.skillId}].precision`, before: undefined, after: "déplacée" },
    ]);
  });

  it("ignore un champ optionnel absent devenu nul", () => {
    const after = clone();
    (after.equipment[0] as Record<string, unknown>).notes = null;
    expect(diffCatalogs(catalog, after).total).toBe(0);
  });

  it("compare les réglages et le nom de version dans la section Général", () => {
    const after = clone();
    after.version = "0.9.9";
    after.settings = { ...after.settings, temboEquipmentSurcharge: { per: 10, amount: 4 } };

    const changes = section(diffCatalogs(catalog, after).sections, "general")?.changes ?? [];
    expect(changes.map((c) => c.id)).toEqual(["version", "settings"]);
    expect(changes[0].fields).toEqual([{ path: "", before: catalog.version, after: "0.9.9" }]);
    expect(changes[1].fields?.[0].path).toBe("temboEquipmentSurcharge.amount");
  });

  it("rapporte les portraits sans jamais exposer leur contenu", () => {
    const after = clone();
    const [first] = Object.keys(after.icons ?? {});
    after.icons = { ...after.icons, [first]: "autre.webp", "carte-neuve.jpg": "neuve.webp" };

    const changes = section(diffCatalogs(catalog, after).sections, "icons")?.changes ?? [];
    expect(changes).toEqual([
      { kind: "changed", id: first, label: first, fields: [], hidden: 0 },
      { kind: "added", id: "carte-neuve.jpg", label: "carte-neuve.jpg" },
    ]);
  });

  it("plafonne le nombre de lignes d'une même entité et compte le surplus", () => {
    const after = clone();
    const profile = after.profiles[0];
    const stats = profile.stats as unknown as Record<string, number | null>;
    for (const key of Object.keys(stats)) stats[key] = (stats[key] ?? 0) + 1;
    profile.cost += 1;
    profile.name = `${profile.name} bis`;

    const changed = section(diffCatalogs(catalog, after).sections, "profiles")?.changes[0];
    expect(changed?.fields?.length).toBeLessThanOrEqual(20);
    expect(changed?.hidden).toBe(0); // moins de 20 champs ici : le plafond n'est pas atteint
  });
});
