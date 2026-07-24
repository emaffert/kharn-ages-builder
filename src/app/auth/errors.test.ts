import { describe, it, expect } from "vitest";
import { authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
  it("renvoie null sans erreur", () => {
    expect(authErrorMessage(null)).toBeNull();
    expect(authErrorMessage(undefined)).toBeNull();
  });

  it("traduit les erreurs courantes", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" })).toMatch(/incorrect/i);
    expect(authErrorMessage({ message: "Email not confirmed" })).toMatch(/confirmée/i);
    expect(authErrorMessage({ message: "User already registered" })).toMatch(/existe déjà/i);
    expect(authErrorMessage({ message: "Failed to fetch" })).toMatch(/injoignable/i);
  });

  it("reprend la longueur minimale annoncée par le serveur", () => {
    expect(authErrorMessage({ message: "Password should be at least 8 characters." })).toBe(
      "Mot de passe trop court : 8 caractères minimum.",
    );
  });

  it("signale un mode de connexion désactivé côté serveur", () => {
    expect(authErrorMessage({ message: "Unsupported provider: provider is not enabled" })).toMatch(/pas activé/i);
  });

  it("retombe sur le message brut quand la traduction est inconnue", () => {
    expect(authErrorMessage({ message: "Something odd happened" })).toBe("Something odd happened");
  });
});
