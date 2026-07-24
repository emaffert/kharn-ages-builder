// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { AuthDialog } from "./AuthDialog";
import { DEFAULT_SESSION, SessionContext, type SessionValue } from "./context";

afterEach(cleanup);

function renderDialog(session: Partial<SessionValue> = {}) {
  const onOpenChange = vi.fn();
  render(
    <SessionContext.Provider value={{ ...DEFAULT_SESSION, status: "anonymous", ...session }}>
      <AuthDialog open onOpenChange={onOpenChange} />
    </SessionContext.Provider>,
  );
  return { onOpenChange };
}

/** Renseigne e-mail + mot de passe (les champs sont repérés par leur libellé). */
function fillCredentials(email = "a@b.c", password = "secret1") {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: password } });
}

describe("AuthDialog", () => {
  it("s'ouvre en mode connexion, sans champ pseudo", () => {
    renderDialog();
    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.queryByLabelText("Pseudo")).toBeNull();
  });

  it("bascule en inscription et demande un pseudo", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Inscription" }));
    expect(screen.getByLabelText("Pseudo")).toBeTruthy();
  });

  it("connecte et ferme la modale au succès", async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    const { onOpenChange } = renderDialog({ signIn });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.c", "secret1"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("affiche l'erreur renvoyée et laisse la modale ouverte", async () => {
    const signIn = vi.fn(async () => ({ error: "E-mail ou mot de passe incorrect." }));
    const { onOpenChange } = renderDialog({ signIn });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/incorrect/i);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("inscrit avec le pseudo et annonce la confirmation par e-mail", async () => {
    const signUp = vi.fn(async () => ({ error: null, needsConfirmation: true }));
    const { onOpenChange } = renderDialog({ signUp });
    fireEvent.click(screen.getByRole("radio", { name: "Inscription" }));
    fireEvent.change(screen.getByLabelText("Pseudo"), { target: { value: "Xayin" } });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));
    await waitFor(() => expect(signUp).toHaveBeenCalledWith("a@b.c", "secret1", "Xayin"));
    expect(await screen.findByText(/confirme ton adresse/i)).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("inscrit et ferme la modale quand la session est ouverte directement", async () => {
    const signUp = vi.fn(async () => ({ error: null, needsConfirmation: false }));
    const { onOpenChange } = renderDialog({ signUp });
    fireEvent.click(screen.getByRole("radio", { name: "Inscription" }));
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

});
