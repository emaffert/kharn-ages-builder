import { describe, it, expect } from "vitest";
import { catalog } from "@data";
import { describeConstraint, describeEffect, specialCardsForProfile } from "./explain";

describe("explain", () => {
  it("produit une explication non vide pour chaque contrainte du catalogue", () => {
    const all = [
      ...catalog.profiles.flatMap((p) => p.recruitment),
      ...catalog.specialCards.flatMap((c) => c.constraints),
    ];
    for (const c of all) {
      expect(describeConstraint(c, catalog).length).toBeGreaterThan(0);
    }
  });

  it("produit une explication non vide pour chaque effet du catalogue", () => {
    const all = [
      ...catalog.profiles.flatMap((p) => p.effects ?? []),
      ...catalog.specialCards.flatMap((c) => c.effects),
    ];
    for (const e of all) {
      expect(describeEffect(e, catalog).length).toBeGreaterThan(0);
    }
  });

  it("explique l'interdiction d'arme du Larbin", () => {
    const larbin = catalog.profiles.find((p) => p.id === "fangs-larbin-1")!;
    const txt = larbin.recruitment.map((c) => describeConstraint(c, catalog)).join(" ");
    expect(txt).toMatch(/Interdit d'équiper/);
  });

  it("affiche les conditions cumulées (ET) de « Lien de la Terre »", () => {
    const card = catalog.specialCards.find((c) => c.id === "lien-de-la-terre")!;
    const txt = describeEffect(card.effects[0], catalog);
    // « ≥3 Dogons ET ≥1 Père de famille » : les deux clauses doivent apparaître, jointes par « et ».
    expect(txt).toMatch(/au moins 3 ×[^]*dogon/);
    expect(txt).toContain("pere-de-famille");
    expect(txt).toContain(" et ");
  });

  it("rattache la carte « Fille de Nyx » à Apathée", () => {
    const apathee = catalog.profiles.find((p) => p.id === "fangs-apathee-3")!;
    expect(specialCardsForProfile(apathee, catalog).some((c) => c.id === "fille-de-nyx")).toBe(
      true,
    );
  });
});
