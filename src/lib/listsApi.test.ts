import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListDocument } from "@core";
import { deleteRemoteList, fetchLists, upsertList } from "./listsApi";

const doc = (id: string, updatedAt = "2026-07-01T10:00:00Z"): ListDocument =>
  ({
    schemaVersion: "1",
    catalogVersion: "1",
    id,
    name: id,
    format: "escarmouche",
    createdAt: updatedAt,
    updatedAt,
    fersDeLance: [],
    snapshot: { totalCost: 0, entries: [] },
  }) as ListDocument;

function selectClient(result: { data: unknown; error?: { message: string } | null }) {
  const eq = vi.fn(async () => ({ data: result.data, error: result.error ?? null }));
  return { client: { from: () => ({ select: () => ({ eq }) }) } as unknown as SupabaseClient, eq };
}

describe("fetchLists", () => {
  it("valide chaque liste et écarte les lignes corrompues", async () => {
    const { client } = selectClient({ data: [{ data: doc("a") }, { data: { pas: "une liste" } }] });
    const lists = await fetchLists(client, "u1");
    expect(lists?.map((l) => l.id)).toEqual(["a"]);
  });

  it("distingue « aucune liste » (tableau vide) d'un échec serveur (null)", async () => {
    expect(await fetchLists(selectClient({ data: [] }).client, "u1")).toEqual([]);
    const failing = selectClient({ data: null, error: { message: "Failed to fetch" } });
    expect(await fetchLists(failing.client, "u1")).toBeNull();
  });

  it("ne demande que les listes du compte", async () => {
    const { client, eq } = selectClient({ data: [] });
    await fetchLists(client, "u1");
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });
});

describe("upsertList", () => {
  it("envoie la liste avec son propriétaire et sa date", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const client = { from: () => ({ upsert }) } as unknown as SupabaseClient;
    expect(await upsertList(client, "u1", doc("a"))).toBeNull();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", user_id: "u1", updated_at: "2026-07-01T10:00:00Z" }),
    );
  });

  it("remonte l'erreur du serveur plutôt que de la taire", async () => {
    const client = {
      from: () => ({ upsert: async () => ({ error: { message: "Failed to fetch" } }) }),
    } as unknown as SupabaseClient;
    expect(await upsertList(client, "u1", doc("a"))).toBe("Failed to fetch");
  });
});

describe("deleteRemoteList", () => {
  it("supprime par identifiant", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const client = { from: () => ({ delete: () => ({ eq }) }) } as unknown as SupabaseClient;
    expect(await deleteRemoteList(client, "a")).toBeNull();
    expect(eq).toHaveBeenCalledWith("id", "a");
  });
});
