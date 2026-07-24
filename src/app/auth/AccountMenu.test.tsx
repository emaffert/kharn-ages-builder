// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { AccountMenu } from "./AccountMenu";
import { DEFAULT_SESSION, SessionContext, type SessionValue } from "./context";

afterEach(cleanup);

// jsdom n'implémente pas ResizeObserver, dont Radix se sert pour positionner le popover.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const asUser = (email: string) => ({ id: "u1", email }) as User;

function renderMenu(session: Partial<SessionValue>) {
  return render(
    <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...session }}>
      <AccountMenu />
    </SessionContext.Provider>,
  );
}

describe("AccountMenu", () => {
  it("n'affiche rien sans backend configuré", () => {
    const { container } = renderMenu({ status: "unconfigured" });
    expect(container.textContent).toBe("");
  });

  it("propose la connexion à un visiteur et ouvre la modale", () => {
    renderMenu({ status: "anonymous" });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    // La modale est montée dans un portail : on la reconnaît à son onglet Inscription.
    expect(screen.getByRole("radio", { name: "Inscription" })).toBeTruthy();
  });

  it("affiche le pseudo du compte connecté", () => {
    renderMenu({
      status: "authenticated",
      user: asUser("xayin@nyx.fr"),
      profile: { id: "u1", pseudo: "Xayin", role: "user" },
    });
    expect(screen.getByText("Xayin")).toBeTruthy();
  });

  it("retombe sur la partie locale de l'e-mail sans pseudo", () => {
    renderMenu({ status: "authenticated", user: asUser("xayin@nyx.fr"), profile: null });
    expect(screen.getByText("xayin")).toBeTruthy();
  });

  it("signale le rôle admin et permet de se déconnecter", async () => {
    const signOut = vi.fn(async () => {});
    renderMenu({
      status: "authenticated",
      user: asUser("chef@nyx.fr"),
      profile: { id: "u1", pseudo: "Chef", role: "admin" },
      isAdmin: true,
      signOut,
    });
    fireEvent.click(screen.getByRole("button", { name: /Compte de Chef/i }));
    expect(await screen.findByText("Administrateur")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
