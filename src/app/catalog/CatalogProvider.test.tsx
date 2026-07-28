// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import {
  catalog,
  readAdminDraft,
  readPublishedCatalog,
  staleDraftWasDropped,
  writeAdminDraft,
  writePublishedCatalog,
} from "@data";
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
  const { catalog: active, published, update } = useCatalog();
  return (
    <div>
      <span data-testid="version">{active.version}</span>
      <span data-testid="published">{published ? String(published.versionId) : "aucune"}</span>
      <span data-testid="update">{update ? `${update.versionId}:${update.version}` : "aucune"}</span>
    </div>
  );
}

const renderWith = (client: SupabaseClient | null, pollMs?: number) =>
  render(
    <CatalogProvider client={client} {...(pollMs === undefined ? {} : { pollMs })}>
      <Probe />
    </CatalogProvider>,
  );

/** Faux serveur dont la dernière version peut changer en cours de test (publication d'autrui). */
function mutableServer(initial: Row) {
  const holder = { row: initial };
  const client = {
    from: () => {
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: holder.row, error: null }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, publish: (row: Row) => (holder.row = row) };
}

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

  it("laisse le brouillon admin prioritaire tant qu'il porte sur la version publiée courante", async () => {
    writePublishedCatalog({ versionId: 5, publishedAt: null }, { ...catalog, version: "publiée" });
    writeAdminDraft(5, { ...catalog, version: "brouillon" });
    const { client } = fakeServer(remote); // le serveur en est toujours à la version 5
    renderWith(client);
    expect(await screen.findByText("brouillon")).toBeTruthy();
  });

  it("signale une publication survenue pendant que la page est ouverte, sans rien remplacer", async () => {
    writePublishedCatalog({ versionId: 5, publishedAt: null }, { ...catalog, version: "9.9.9" });
    writeAdminDraft(5, { ...catalog, version: "brouillon" });
    const server = mutableServer(remote); // le serveur en est à la version 5, comme le brouillon
    renderWith(server.client, 5);
    expect(await screen.findByText("brouillon")).toBeTruthy();
    expect(screen.getByTestId("update").textContent).toBe("aucune");

    server.publish({ id: 6, version: "0.4.0", data: { ...catalog, version: "0.4.0" }, published_at: null });
    await waitFor(() => expect(screen.getByTestId("update").textContent).toBe("6:0.4.0"));

    // Le point du mécanisme : prévenir sans rien toucher. Le brouillon est intact, à l'écran comme
    // en mémoire, et la donnée de la nouvelle version n'a même pas été téléchargée.
    expect(screen.getByTestId("version").textContent).toBe("brouillon");
    expect(readAdminDraft()?.catalog.version).toBe("brouillon");
    expect(readPublishedCatalog()?.versionId).toBe(5);
  });

  it("abandonne le brouillon admin dès qu'une version plus récente est publiée", async () => {
    // Brouillon bâti sur la version 4, alors que le serveur en est à la 5 : le publier écraserait
    // le travail de celui qui a publié entre-temps.
    writePublishedCatalog({ versionId: 4, publishedAt: null }, { ...catalog, version: "précédente" });
    writeAdminDraft(4, { ...catalog, version: "brouillon" });
    const { client } = fakeServer(remote);
    renderWith(client);
    // La version qui vient d'être publiée prend la main, y compris à l'écran de l'admin.
    expect(await screen.findByText("9.9.9")).toBeTruthy();
    expect(readPublishedCatalog()?.versionId).toBe(5);
    expect(readAdminDraft()).toBeNull();
    expect(staleDraftWasDropped()).toBe(true);
  });
});
