// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { catalog, readPublishedCatalog, writePublishedCatalog } from "@data";
import { PublishAction } from "./PublishAction";
import { DEFAULT_SESSION, SessionContext, type SessionValue } from "../auth/context";
import { createMemoryStorage } from "../../testing/memoryStorage";

afterEach(cleanup);
beforeEach(() => vi.stubGlobal("localStorage", createMemoryStorage()));

const admin: Partial<SessionValue> = {
  status: "authenticated",
  user: { id: "admin-1", email: "chef@nyx.fr" } as User,
  profile: { id: "admin-1", pseudo: "Chef", role: "admin" },
  isAdmin: true,
};

/**
 * Faux serveur. `latest` est la ligne renvoyée par le contrôle « quelqu'un a-t-il publié depuis ? »
 * fait juste avant l'insertion ; `null` (le défaut) = aucune version publiée, donc rien à heurter.
 */
function fakeClient(
  result: { data: unknown; error?: { code?: string; message: string } | null },
  latest: { id: number; version: string; published_at: string | null } | null = null,
) {
  const insert = vi.fn(() => ({
    select: () => ({ single: async () => ({ data: result.data, error: result.error ?? null }) }),
  }));
  const select = () => ({
    order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: latest, error: null }) }) }),
  });
  return { client: { from: () => ({ insert, select }) } as unknown as SupabaseClient, insert };
}

function renderAction(session: Partial<SessionValue>, client: SupabaseClient | null, onPublished = vi.fn()) {
  render(
    <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...session }}>
      <PublishAction catalog={catalog} dirty={false} onPublished={onPublished} client={client} />
    </SessionContext.Provider>,
  );
  return { onPublished };
}

describe("PublishAction", () => {
  it("reste invisible pour un joueur non admin", () => {
    const { client } = fakeClient({ data: { id: 1, version: "0.2.0", published_at: null } });
    const { container } = render(
      <SessionContext.Provider value={{ ...DEFAULT_SESSION, status: "anonymous" }}>
        <PublishAction catalog={catalog} dirty={false} onPublished={vi.fn()} client={client} />
      </SessionContext.Provider>,
    );
    expect(container.textContent).toBe("");
  });

  it("reste invisible sans backend configuré", () => {
    const { container } = render(
      <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...admin }}>
        <PublishAction catalog={catalog} dirty={false} onPublished={vi.fn()} client={null} />
      </SessionContext.Provider>,
    );
    expect(container.textContent).toBe("");
  });

  it("demande confirmation avant de publier", () => {
    const { client, insert } = fakeClient({ data: { id: 1, version: "0.2.0", published_at: null } });
    renderAction(admin, client);
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    expect(screen.getByText(/servi à tous les joueurs/i)).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  it("propose le nom de la version courante et publie celui qu'on saisit", async () => {
    const { client, insert } = fakeClient({ data: { id: 7, version: "0.2.0", published_at: null } });
    const { onPublished } = renderAction(admin, client);
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    const field = screen.getByLabelText("Nom de la nouvelle version") as HTMLInputElement;
    // Aucune version publiée : on part du nom porté par le catalogue courant.
    expect(field.value).toBe(catalog.version);
    fireEvent.change(field, { target: { value: "0.2.0" } });
    fireEvent.click(screen.getByRole("button", { name: "Publier maintenant" }));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ version: "0.2.0" }));
    // Le catalogue rendu à l'admin porte le nouveau nom, pas l'ancien.
    expect(onPublished.mock.calls[0][0].version).toBe("0.2.0");
    expect(readPublishedCatalog()?.catalog.version).toBe("0.2.0");
  });

  it("refuse de publier sans nom de version", () => {
    const { client, insert } = fakeClient({ data: { id: 1, version: "x", published_at: null } });
    renderAction(admin, client);
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    fireEvent.change(screen.getByLabelText("Nom de la nouvelle version"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Publier maintenant" }));
    expect(insert).not.toHaveBeenCalled();
  });

  it("publie, met le cache à jour et abandonne le brouillon local", async () => {
    const { client, insert } = fakeClient({ data: { id: 42, version: "0.2.0", published_at: "2026-07-25T10:00:00Z" } });
    const { onPublished } = renderAction(admin, client);
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    fireEvent.click(screen.getByRole("button", { name: "Publier maintenant" }));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ author_id: "admin-1" }));
    expect(readPublishedCatalog()?.versionId).toBe(42);
    expect(await screen.findByText(/est en ligne/i)).toBeTruthy();
  });

  it("affiche le refus du serveur sans rien changer localement", async () => {
    const { client } = fakeClient({ data: null, error: { code: "42501", message: "row-level security" } });
    const { onPublished } = renderAction(admin, client);
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    fireEvent.click(screen.getByRole("button", { name: "Publier maintenant" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/administrateur/i);
    expect(onPublished).not.toHaveBeenCalled();
    expect(readPublishedCatalog()).toBeNull();
  });

  it("alerte quand le catalog.json du dépôt a décroché de la version publiée", () => {
    const { client } = fakeClient({ data: { id: 1, version: "x", published_at: null } });
    writePublishedCatalog({ versionId: 9, publishedAt: null }, { ...catalog, version: "0.9.9" });
    renderAction(admin, client);
    expect(screen.getByText(/ne correspond plus à la version publiée/i)).toBeTruthy();
  });

  it("refuse de publier par-dessus une version parue entre-temps", async () => {
    // L'écran n'a jamais vu de version publiée (published = null), mais le serveur en a une :
    // publier ici écraserait le travail de celui qui vient de publier.
    const { client, insert } = fakeClient({ data: { id: 12, version: "x", published_at: null } }, {
      id: 11,
      version: "0.4.0",
      published_at: null,
    });
    const { onPublished } = renderAction(admin, client);
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    fireEvent.click(screen.getByRole("button", { name: "Publier maintenant" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/publiée entre-temps/i);
    expect(insert).not.toHaveBeenCalled();
    expect(onPublished).not.toHaveBeenCalled();
  });

  it("détaille l'écart avec la version publiée à la demande", () => {
    const { client } = fakeClient({ data: { id: 1, version: "x", published_at: null } });
    const published = { ...catalog, version: "0.9.9", equipment: catalog.equipment.slice(1) };
    writePublishedCatalog({ versionId: 9, publishedAt: null }, published);
    renderAction(admin, client);
    fireEvent.click(screen.getByRole("button", { name: "Voir les différences" }));
    // Le fichier est le point de départ : ce qu'il a en plus est donc *retiré* par la version publiée.
    expect(screen.getByRole("heading", { name: /Équipement/ })).toBeTruthy();
    expect(screen.getByText(catalog.equipment[0].name)).toBeTruthy();
    expect(screen.getByText("0.9.9")).toBeTruthy();
  });

  it("n'alerte pas quand le fichier correspond à la version publiée", () => {
    const { client } = fakeClient({ data: { id: 1, version: "x", published_at: null } });
    writePublishedCatalog({ versionId: 9, publishedAt: null }, catalog);
    renderAction(admin, client);
    expect(screen.queryByText(/ne correspond plus à la version publiée/i)).toBeNull();
  });
});
