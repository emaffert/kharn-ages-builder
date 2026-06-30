import { describe, it, expect } from "vitest";
import { fangsCatalog } from "@data";
import { describeConstraint, describeEffect, specialCardsForProfile } from "./explain";

describe("explain", () => {
  it("produit une explication non vide pour chaque contrainte du catalogue", () => {
    const all = [
      ...fangsCatalog.profiles.flatMap((p) => p.recruitment),
      ...fangsCatalog.specialCards.flatMap((c) => c.constraints),
      ...fangsCatalog.equipment.flatMap((e) => e.restrictions),
    ];
    for (const c of all) {
      expect(describeConstraint(c, fangsCatalog).length).toBeGreaterThan(0);
    }
  });

  it("produit une explication non vide pour chaque effet du catalogue", () => {
    const all = [
      ...fangsCatalog.profiles.flatMap((p) => p.effects ?? []),
      ...fangsCatalog.specialCards.flatMap((c) => c.effects),
    ];
    for (const e of all) {
      expect(describeEffect(e, fangsCatalog).length).toBeGreaterThan(0);
    }
  });

  it("explique l'interdiction d'arme du Larbin", () => {
    const larbin = fangsCatalog.profiles.find((p) => p.id === "fangs-larbin-1")!;
    const txt = larbin.recruitment.map((c) => describeConstraint(c, fangsCatalog)).join(" ");
    expect(txt).toMatch(/Interdit d'équiper/);
  });

  it("rattache la carte « Fille de Nyx » à Apathée", () => {
    const apathee = fangsCatalog.profiles.find((p) => p.id === "fangs-apathee-3")!;
    expect(specialCardsForProfile(apathee, fangsCatalog).some((c) => c.id === "fille-de-nyx")).toBe(
      true,
    );
  });
});
