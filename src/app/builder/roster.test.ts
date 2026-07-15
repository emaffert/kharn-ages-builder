import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { availableMountTypeIds, recruitableRosterModels, rosterSectionOf, type RosterSection } from "./shared";

/**
 * Contenu de la sidebar du constructeur : catégorisation des modèles recrutables en sections et
 * montures accessibles. Logique pure extraite de BuilderScreen (recruitableRosterModels /
 * rosterSectionOf / availableMountTypeIds).
 */

/** Regroupe les modèles recrutables d'une faction par section, en noms de modèles. */
function sections(factionId: string): Record<RosterSection, string[]> {
  const out: Record<RosterSection, string[]> = {
    personnage: [],
    troupe: [],
    conditionnel: [],
    "hors-faction": [],
    "freres-d-armes": [],
  };
  for (const m of recruitableRosterModels(catalog, factionId)) {
    out[rosterSectionOf(catalog, factionId, m.profiles[0])].push(m.name);
  }
  return out;
}

describe("sidebar - sections du roster", () => {
  it("dans sa propre faction, un frère d'armes est un personnage natif (pas dans « Frères d'armes »)", () => {
    const gn = sections("guilde-noire");
    expect(gn.personnage).toContain("Mathys");
    expect(gn["freres-d-armes"]).toHaveLength(0);
  });

  it("hors de leur faction, les frères d'armes forment leur propre section", () => {
    const kharns = sections("kharns");
    expect(kharns["freres-d-armes"]).toEqual(
      expect.arrayContaining(["Mathys", "Bharbathos", "Gakere", "Kaito", "Sükh"]),
    );
    // ...et ne sont pas fondus dans « Hors Faction ».
    expect(kharns["hors-faction"]).not.toContain("Mathys");
  });

  it("un allié « Allié des X » va en « Hors Faction », pas en « Frères d'armes »", () => {
    // Le Bourgmestre (khârn) est allié Guilde Noire + Affranchis.
    const gn = sections("guilde-noire");
    expect(gn["hors-faction"]).toContain("Bourgmestre");
    expect(gn["freres-d-armes"]).not.toContain("Bourgmestre");
  });

  it("un frère d'armes n'apparaît pas dans les sections natives d'une autre faction", () => {
    const kharns = sections("kharns");
    for (const s of ["personnage", "troupe", "conditionnel"] as const) {
      expect(kharns[s]).not.toContain("Mathys");
    }
  });
});

describe("sidebar - montures disponibles", () => {
  it("un FdL Guilde Noire propose les 3 montures (via les origines de ses figurines)", () => {
    // guilde-noire n'est dans l'éligibilité d'AUCUN type de monture : tout passe par les traits
    // d'origine (monture-kharns/kherops/gouns) des profils recrutables.
    expect([...availableMountTypeIds(catalog, "guilde-noire")].sort()).toEqual(["koelod", "mochere", "quagga"]);
  });

  it("un FdL Khérops propose au moins le Kœlod", () => {
    expect(availableMountTypeIds(catalog, "kherops").has("koelod")).toBe(true);
  });

  it("le résultat ne dépend que des profils recrutables, pas de la faction du type de monture", () => {
    // guilde-noire a été retiré de quagga.factionEligibility ; le Quagga reste proposé via les
    // origines khârnes de plusieurs GN.
    const quagga = catalog.mountTypes.find((t) => t.id === "quagga")!;
    expect(quagga.factionEligibility).not.toContain("guilde-noire");
    expect(availableMountTypeIds(catalog, "guilde-noire").has("quagga")).toBe(true);
  });
});
