import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { wornArmorsFrom } from "./shared";

/**
 * Armure de Combat Khârne (équipement `eq-armure-combat-kharne`, `heavySeuil` 5) : le seuil de réussite
 * baisse à 5 si le porteur possède déjà une armure innée au moins aussi protectrice (échec ≤ -1 ET réussite ≤ -3).
 */
describe("wornArmorsFrom - heavySeuil conditionnel", () => {
  const combatSeuil = (innate?: { protectionEchec?: number; protectionReussite?: number }) =>
    wornArmorsFrom(catalog, ["eq-armure-combat-kharne"], undefined, innate)[0]?.seuil;

  it("porteur déjà lourd (Paladin -1/7/-3) → seuil 5", () => {
    expect(combatSeuil({ protectionEchec: -1, protectionReussite: -3 })).toBe(5);
  });

  it("porteur léger (Guerrier 0/6/-1) → seuil de base 7", () => {
    expect(combatSeuil({ protectionEchec: 0, protectionReussite: -1 })).toBe(7);
  });

  it("Engueran (-1/6/-3, protections déjà lourdes) → seuil 5", () => {
    expect(combatSeuil({ protectionEchec: -1, protectionReussite: -3 })).toBe(5);
  });

  it("sans armure innée connue → seuil de base 7", () => {
    expect(combatSeuil(undefined)).toBe(7);
  });

  it("une armure sans heavySeuil (Brigandine) garde son seuil, même sur porteur lourd", () => {
    const brig = wornArmorsFrom(catalog, ["brigandine"], undefined, {
      protectionEchec: -1,
      protectionReussite: -3,
    })[0];
    expect(brig?.seuil).toBe(catalog.equipment.find((e) => e.id === "brigandine")?.seuil);
  });
});
