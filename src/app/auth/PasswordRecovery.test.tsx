// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PasswordRecovery } from "./PasswordRecovery";
import { DEFAULT_SESSION, SessionContext, type SessionValue } from "./context";

afterEach(cleanup);

function renderRecovery(session: Partial<SessionValue>) {
  render(
    <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...session }}>
      <PasswordRecovery />
    </SessionContext.Provider>,
  );
}

describe("PasswordRecovery", () => {
  it("reste invisible hors retour de lien de réinitialisation", () => {
    renderRecovery({ recovering: false });
    expect(screen.queryByLabelText("Mot de passe")).toBeNull();
  });

  it("s'impose au retour du lien et enregistre le nouveau mot de passe", async () => {
    const updatePassword = vi.fn(async () => ({ error: null }));
    renderRecovery({ recovering: true, updatePassword });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "nouveau-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith("nouveau-secret"));
  });

  it("refuse un mot de passe trop court sans appeler le serveur", () => {
    const updatePassword = vi.fn(async () => ({ error: null }));
    renderRecovery({ recovering: true, updatePassword });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "court" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("affiche l'erreur du serveur", async () => {
    const updatePassword = vi.fn(async () => ({ error: "Lien expiré." }));
    renderRecovery({ recovering: true, updatePassword });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "nouveau-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/expiré/i);
  });
});
