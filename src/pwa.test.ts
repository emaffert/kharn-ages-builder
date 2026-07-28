import { describe, expect, it } from "vitest";
import { shouldReloadOnControllerChange } from "./pwa";

describe("rechargement à la prise de main d'une nouvelle version", () => {
  it("recharge quand une version remplace celle qui contrôlait la page", () => {
    expect(shouldReloadOnControllerChange(true, false)).toBe(true);
  });

  it("ne recharge pas à la première installation", () => {
    // Aucun contrôleur au démarrage : la page tourne déjà sur le code qui vient d'être servi.
    expect(shouldReloadOnControllerChange(false, false)).toBe(false);
  });

  it("ne relance pas un rechargement déjà en cours", () => {
    expect(shouldReloadOnControllerChange(true, true)).toBe(false);
  });
});

describe("annonce d'une nouvelle version", () => {
  it("annonce quand une version remplace celle qui contrôlait la page", () => {
    expect(shouldReloadOnControllerChange(true, false)).toBe(true);
  });

  it("n'annonce rien à la première installation, ni deux fois", () => {
    expect(shouldReloadOnControllerChange(false, false)).toBe(false);
    expect(shouldReloadOnControllerChange(true, true)).toBe(false);
  });
});
