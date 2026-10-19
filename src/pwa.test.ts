import { describe, expect, it } from "vitest";
import { controllerChangeAction } from "./pwa";

describe("prise de main d'une nouvelle version du site", () => {
  it("recharge d'office juste après l'ouverture du site", () => {
    expect(controllerChangeAction(true, false, 2_000)).toBe("reload");
  });

  it("annonce la mise à jour quand l'utilisateur est déjà au travail", () => {
    expect(controllerChangeAction(true, false, 60_000)).toBe("announce");
  });

  it("ne fait rien à la première installation", () => {
    // Aucun contrôleur au démarrage : la page tourne déjà sur le code qui vient d'être servi.
    expect(controllerChangeAction(false, false, 2_000)).toBe("none");
  });

  it("ne traite pas deux fois la même mise à jour", () => {
    expect(controllerChangeAction(true, true, 2_000)).toBe("none");
    expect(controllerChangeAction(true, true, 60_000)).toBe("none");
  });
});
