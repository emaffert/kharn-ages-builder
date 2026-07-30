import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { recruitCost, sealFor, sealOfferedFor, sealRequiredFor } from "@core";
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
    sceau: [],
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

describe("sidebar - Guilde Noire (Sceau)", () => {
  const gnProfile = (id: string) => catalog.profiles.find((p) => p.id === id)!;

  it("un membre GN sans dérogation est recrutable partout, dans sa propre section", () => {
    const kharns = sections("kharns");
    expect(kharns.sceau).toContain("Raimbert");
    expect(kharns["hors-faction"]).not.toContain("Raimbert");
  });

  it("le coût affiché intègre le sceau hors de la Guilde Noire, pas chez elle", () => {
    const raimbert = gnProfile("guilde-noire-raimbert-2");
    expect(recruitCost(catalog, raimbert, "kharns")).toBe(raimbert.cost + 10);
    expect(recruitCost(catalog, raimbert, "guilde-noire")).toBe(raimbert.cost);
  });

  it("un GN allié d'une faction y entre sans sceau, mais le paye ailleurs", () => {
    // Le Négociateur de la Guilde est « Allié des Khârns ».
    const negociateur = gnProfile("guilde-noire-negociateur-2");
    expect(sealRequiredFor(catalog, negociateur, "kharns")).toBeUndefined();
    expect(sections("kharns")["hors-faction"]).toContain("Négociateur de la Guilde");
    expect(sealRequiredFor(catalog, negociateur, "fangs")?.id).toBe("sceau-de-la-guilde-noire");
    expect(sections("fangs").sceau).toContain("Négociateur de la Guilde");
  });

  it("les frères d'armes gardent leur section et leur coût (sceau facultatif)", () => {
    const mathys = gnProfile("guilde-noire-mathys-3");
    expect(sections("kharns")["freres-d-armes"]).toContain("Mathys");
    expect(sections("kharns").sceau).not.toContain("Mathys");
    expect(sealRequiredFor(catalog, mathys, "kharns")).toBeUndefined();
    expect(recruitCost(catalog, mathys, "kharns")).toBe(mathys.cost);
    // ... mais le sceau leur reste proposé à l'achat pour tenir seuls.
    expect(sealOfferedFor(catalog, mathys, "kharns")?.id).toBe("sceau-de-la-guilde-noire");
  });

  it("le sceau n'est proposé à personne d'autre que la Guilde Noire", () => {
    const larbin = catalog.profiles.find((p) => p.factionId === "fangs")!;
    expect(sealFor(catalog, larbin)).toBeUndefined();
  });
});

describe("sidebar - montures disponibles", () => {
  it("un FdL Guilde Noire propose les montures des trois origines de ses figurines", () => {
    // guilde-noire n'est dans l'éligibilité d'AUCUN type de monture : tout passe par les traits
    // d'origine (monture-kharns/kherops/gouns) des profils recrutables.
    expect([...availableMountTypeIds(catalog, "guilde-noire")]).toEqual(
      expect.arrayContaining(["koelod", "mochere", "quagga"]),
    );
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
