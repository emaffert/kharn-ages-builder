// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AppShell } from "./App";
import { DEFAULT_SESSION, SessionContext, type SessionValue } from "./auth/context";

afterEach(cleanup);

function renderShell(session: Partial<SessionValue> = {}) {
  return render(
    <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...session }}>
      <AppShell />
    </SessionContext.Provider>,
  );
}

const adminTab = () => screen.queryByRole("button", { name: "Admin" });

describe("AppShell (accès à l'admin)", () => {
  it("laisse l'admin accessible sans backend, en développement (mode local-first)", () => {
    renderShell({ status: "unconfigured" });
    expect(adminTab()).toBeTruthy();
  });

  it("ferme l'admin sans backend en production (variables d'env oubliées au build)", () => {
    vi.stubEnv("DEV", false);
    try {
      renderShell({ status: "unconfigured" });
      expect(adminTab()).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("masque l'admin à un visiteur non connecté", () => {
    renderShell({ status: "anonymous" });
    expect(adminTab()).toBeNull();
  });

  it("masque l'admin à un joueur connecté sans le rôle", () => {
    renderShell({
      status: "authenticated",
      user: { id: "u1", email: "j@b.c" } as User,
      profile: { id: "u1", pseudo: "Joueur", role: "user" },
    });
    expect(adminTab()).toBeNull();
  });

  it("ouvre l'admin pour un administrateur", () => {
    renderShell({
      status: "authenticated",
      user: { id: "u1", email: "chef@b.c" } as User,
      profile: { id: "u1", pseudo: "Chef", role: "admin" },
      isAdmin: true,
    });
    const tab = adminTab();
    expect(tab).toBeTruthy();
    fireEvent.click(tab!);
    // L'écran admin est en chargement différé : le fallback suffit à prouver la bascule.
    expect(screen.getByText(/Chargement de l'éditeur/i)).toBeTruthy();
  });

  it("revient au constructeur si le rôle admin est perdu (déconnexion)", () => {
    const admin: Partial<SessionValue> = {
      status: "authenticated",
      user: { id: "u1", email: "chef@b.c" } as User,
      profile: { id: "u1", pseudo: "Chef", role: "admin" },
      isAdmin: true,
    };
    const { rerender } = renderShell(admin);
    fireEvent.click(adminTab()!);
    rerender(
      <SessionContext.Provider value={{ ...DEFAULT_SESSION, status: "anonymous" }}>
        <AppShell />
      </SessionContext.Provider>,
    );
    expect(adminTab()).toBeNull();
    expect(screen.queryByText(/Chargement de l'éditeur/i)).toBeNull();
  });
});
