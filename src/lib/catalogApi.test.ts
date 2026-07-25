import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { catalog } from "@data";
import { fetchPublishedCatalog, publishCatalog } from "./catalogApi";

/** Faux client : n'implémente que la chaîne d'appels utilisée par `catalogApi`. */
function readClient(result: { data: unknown; error?: { message: string } | null }) {
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: result.data, error: result.error ?? null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

function insertClient(result: { data: unknown; error?: { code?: string; message: string } | null }) {
  const insert = vi.fn(() => ({
    select: () => ({ single: async () => ({ data: result.data, error: result.error ?? null }) }),
  }));
  return { client: { from: () => ({ insert }) } as unknown as SupabaseClient, insert };
}

describe("fetchPublishedCatalog", () => {
  it("valide et renvoie la dernière version publiée", async () => {
    const client = readClient({ data: { id: 7, version: "1.2.3", data: catalog } });
    const published = await fetchPublishedCatalog(client);
    expect(published?.versionId).toBe(7);
    expect(published?.version).toBe("1.2.3");
    expect(published?.catalog.profiles.length).toBe(catalog.profiles.length);
  });

  it("renvoie null quand aucune version n'est publiée", async () => {
    expect(await fetchPublishedCatalog(readClient({ data: null }))).toBeNull();
  });

  it("renvoie null sur erreur serveur (l'app garde son catalogue)", async () => {
    expect(await fetchPublishedCatalog(readClient({ data: null, error: { message: "Failed to fetch" } }))).toBeNull();
  });

  it("renvoie null si la version publiée ne passe pas la validation", async () => {
    const client = readClient({ data: { id: 3, version: "x", data: { profiles: "n'importe quoi" } } });
    expect(await fetchPublishedCatalog(client)).toBeNull();
  });
});

describe("publishCatalog", () => {
  it("insère la version, sa donnée et son auteur", async () => {
    const { client, insert } = insertClient({ data: { id: 12, published_at: null } });
    const result = await publishCatalog(client, catalog, "user-1");
    expect(result).toEqual({ published: { versionId: 12, publishedAt: null }, error: null });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ version: catalog.version, author_id: "user-1" }),
    );
  });

  it("traduit le refus de la RLS en message explicite", async () => {
    const { client } = insertClient({
      data: null,
      error: { code: "42501", message: 'new row violates row-level security policy for table "catalog_versions"' },
    });
    const result = await publishCatalog(client, catalog, "user-1");
    expect(result.published).toBeNull();
    expect(result.error).toMatch(/administrateur/i);
  });

  it("refuse de publier un catalogue invalide sans appeler le serveur", async () => {
    const { client, insert } = insertClient({ data: { id: 1 } });
    const broken = { ...catalog, profiles: "cassé" } as unknown as typeof catalog;
    const result = await publishCatalog(client, broken, "user-1");
    expect(result.error).toMatch(/invalide/i);
    expect(insert).not.toHaveBeenCalled();
  });
});
