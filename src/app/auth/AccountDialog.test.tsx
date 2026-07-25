// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { AccountDialog } from "./AccountDialog";
import { DEFAULT_SESSION, SessionContext, type SessionValue } from "./context";

afterEach(cleanup);

const connected: Partial<SessionValue> = {
  status: "authenticated",
  user: { id: "u1", email: "xayin@nyx.fr" } as User,
  profile: { id: "u1", pseudo: "Xayin", role: "user" },
};

function renderDialog(session: Partial<SessionValue> = {}) {
  const onOpenChange = vi.fn();
  render(
    <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...connected, ...session }}>
      <AccountDialog open onOpenChange={onOpenChange} />
    </SessionContext.Provider>,
  );
  return { onOpenChange };
}

describe("AccountDialog", () => {
  it("part du pseudo actuel et enregistre le nouveau", async () => {
    const updatePseudo = vi.fn(async () => ({ error: null }));
    renderDialog({ updatePseudo });
    const field = screen.getByLabelText("Pseudo") as HTMLInputElement;
    expect(field.value).toBe("Xayin");
    fireEvent.change(field, { target: { value: "  Nyx  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    // Le pseudo est nettoyé avant envoi.
    await waitFor(() => expect(updatePseudo).toHaveBeenCalledWith("Nyx"));
    expect(await screen.findByText(/mis à jour/i)).toBeTruthy();
  });

  it("affiche l'erreur si le serveur refuse le pseudo", async () => {
    const updatePseudo = vi.fn(async () => ({ error: "permission denied" }));
    renderDialog({ updatePseudo });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("exige le mot de confirmation avant de supprimer le compte", () => {
    const deleteAccount = vi.fn(async () => ({ error: null }));
    renderDialog({ deleteAccount });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    const confirm = screen.getByRole("button", { name: "Supprimer définitivement" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Saisir SUPPRIMER/i), { target: { value: "à peu près" } });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("supprime le compte et ferme la modale une fois le mot saisi", async () => {
    const deleteAccount = vi.fn(async () => ({ error: null }));
    const { onOpenChange } = renderDialog({ deleteAccount });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    fireEvent.change(screen.getByLabelText(/Saisir SUPPRIMER/i), { target: { value: "SUPPRIMER" } });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("garde la modale ouverte si la suppression échoue", async () => {
    const deleteAccount = vi.fn(async () => ({ error: "Aucun compte connecté." }));
    const { onOpenChange } = renderDialog({ deleteAccount });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    fireEvent.change(screen.getByLabelText(/Saisir SUPPRIMER/i), { target: { value: "SUPPRIMER" } });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("désarme la suppression quand on referme la modale", () => {
    const deleteAccount = vi.fn(async () => ({ error: null }));
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...connected, deleteAccount }}>
          <button onClick={() => setOpen(true)}>rouvrir</button>
          <AccountDialog open={open} onOpenChange={setOpen} />
        </SessionContext.Provider>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    fireEvent.change(screen.getByLabelText(/Saisir SUPPRIMER/i), { target: { value: "SUPPRIMER" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    fireEvent.click(screen.getByRole("button", { name: "rouvrir" }));
    // La zone de confirmation est repartie de zéro : plus de bouton armé.
    expect(screen.queryByRole("button", { name: "Supprimer définitivement" })).toBeNull();
    expect(screen.getByRole("button", { name: "Supprimer mon compte" })).toBeTruthy();
  });
});
