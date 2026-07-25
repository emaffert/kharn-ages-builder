// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { render, screen, cleanup } from "@testing-library/react";
import { catalog, readPublishedCatalog, writePublishedCatalog } from "@data";
import { CatalogProvider } from "./CatalogProvider";
import { useCatalog } from "./context";
import { createMemoryStorage } from "../../testing/memoryStorage";

afterEach(cleanup);
beforeEach(() => vi.stubGlobal("localStorage", createMemoryStorage()));

type Row = { id: number; version: string; data: unknown; published_at: string | null };

/**
 * Faux serveur : compte les requêtes en distinguant l'appel léger (numéro de version seul) du
 * téléchargement de la donnée, pour vérifier qu'on ne rapatrie pas 2 Mo sans raison.
 */
function fakeServer(row: Row | null, options: { hang?: boolean } = {}) {
  const calls = { meta: 0, data: 0 };
  const client = {
    from: () => {
      let wantsData = false;
      const chain = {
        select: (columns: string) => {
          wantsData = columns.includes("data");
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (wantsData) calls.data += 1;
          else calls.meta += 1;
          // `hang` simule un serveur qui ne répond jamais (déclenche le repli sur le local).
          if (options.hang) await new Promise(() => {});
          return { data: row, error: null };
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function Probe() {
  const { catalog: active, published } = useCatalog();
  return (
    <div>
      <span data-testid="version">{active.version}</span>
      <span data-testid="published">{published ? String(published.versionId) : "aucune"}</span>
    </div>
  );
}

const renderWith = (client: SupabaseClient | null) =>
  render(
    <CatalogProvider client={client}>
      <Probe />
    </CatalogProvider>,
  );

const remote: Row = { id: 5, version: "9.9.9", data: { ...catalog, version: "9.9.9" }, published_at: "2026-07-25T08:00:00Z" };

describe("CatalogProvider", () => {
  it("sert le catalogue bundlé sans backend, sans attendre", () => {
    renderWith(null);
    expect(screen.getByTestId("version").textContent).toBe(catalog.version);
    expect(screen.getByTestId("published").textContent).toBe("aucune");
  });

  it("adopte la version publiée par le serveur et la met en cache", async () => {
    const { client, calls } = fakeServer(remote);
    renderWith(client);
    expect(await screen.findByText("9.9.9")).toBeTruthy();
    expect(screen.getByTestId("published").textContent).toBe("5");
    expect(readPublishedCatalog()?.versionId).toBe(5);
    expect(readPublishedCatalog()?.publishedAt).toBe("2026-07-25T08:00:00Z");
    expect(calls).toEqual({ meta: 1, data: 1 });
  });

  it("ne retélécharge pas la donnée quand la version en cache est à jour", async () => {
    writePublishedCatalog({ versionId: 5, publishedAt: null }, { ...catalog, version: "9.9.9" });
    const { client, calls } = fakeServer(remote);
    renderWith(client);
    expect(await screen.findByText("9.9.9")).toBeTruthy();
    expect(calls).toEqual({ meta: 1, data: 0 });
  });

  it("garde le catalogue local si le serveur n'a rien publié", async () => {
    const { client } = fakeServer(null);
    renderWith(client);
    expect(await screen.findByText(catalog.version)).toBeTruthy();
    expect(readPublishedCatalog()).toBeNull();
  });

  it("démarre sur le catalogue local si le serveur ne répond pas à temps", async () => {
    vi.useFakeTimers();
    try {
      const { client } = fakeServer(remote, { hang: true });
      renderWith(client);
      // Tant que le délai n'est pas écoulé, on patiente plutôt que d'afficher une version périmée.
      expect(screen.queryByTestId("version")).toBeNull();
      await vi.advanceTimersByTimeAsync(4000);
      expect(screen.getByTestId("version").textContent).toBe(catalog.version);
    } finally {
      vi.useRealTimers();
    }
  });

  it("démarre sur la version publiée déjà en cache (hors-ligne)", () => {
    writePublishedCatalog({ versionId: 4, publishedAt: null }, { ...catalog, version: "8.8.8" });
    renderWith(null);
    expect(screen.getByTestId("version").textContent).toBe("8.8.8");
    expect(screen.getByTestId("published").textContent).toBe("4");
  });

  it("laisse le brouillon admin local prioritaire sur la version publiée", async () => {
    localStorage.setItem("kharn-admin-catalog-v1", JSON.stringify({ ...catalog, version: "brouillon" }));
    const { client } = fakeServer(remote);
    renderWith(client);
    // Le cache est bien alimenté, mais l'écran continue d'afficher le brouillon en cours.
    expect(await screen.findByText("brouillon")).toBeTruthy();
    expect(readPublishedCatalog()?.versionId).toBe(5);
  });
});
