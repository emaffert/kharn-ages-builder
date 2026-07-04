import { describe, it, expect } from "vitest";
import { catalog } from "@data";
import type { ListDocument } from "@core";
import { encodeList, decodeList, checkImportedList } from "./listCode";

const doc: ListDocument = {
  schemaVersion: "1",
  catalogVersion: "test",
  id: "list-1",
  name: "Tanière de Nyx",
  format: "escarmouche",
  pointsLimit: 300,
  createdAt: "2026-07-02T00:00:00Z",
  updatedAt: "2026-07-02T00:00:00Z",
  fersDeLance: [
    {
      id: "fdl1",
      factionId: "fangs",
      leaderInstanceId: "a",
      members: [
        { instanceId: "a", profileId: "fangs-apathee-3", addedEquipmentIds: [], removedBaseEquipmentIds: [], spellIds: [] },
      ],
    },
  ],
  snapshot: { totalCost: 140, entries: [{ instanceId: "a", displayName: "Apathée", cost: 140 }] },
};

describe("code portable de liste", () => {
  it("encode puis décode restitue le document (round-trip)", async () => {
    const code = await encodeList(doc);
    expect(code.startsWith("KA1:")).toBe(true);
    expect(await decodeList(code)).toEqual(doc);
  });

  it("tolère un code sans le préfixe", async () => {
    const body = (await encodeList(doc)).slice("KA1:".length);
    expect(await decodeList(body)).toEqual(doc);
  });

  it("rejette un code invalide", async () => {
    await expect(decodeList("pas-un-code")).rejects.toBeTruthy();
  });
});

describe("checkImportedList", () => {
  it("aucun avertissement pour une liste compatible", () => {
    const ok = { ...doc, catalogVersion: catalog.version, fersDeLance: [{ id: "f", factionId: "fangs", leaderInstanceId: "a", members: [{ instanceId: "a", profileId: "fangs-apathee-3", addedEquipmentIds: [], removedBaseEquipmentIds: [], spellIds: [] }] }] };
    expect(checkImportedList(catalog, ok)).toEqual([]);
  });

  it("signale une version différente et un profil inconnu", () => {
    const bad = { ...doc, catalogVersion: "0.0.0-autre", fersDeLance: [{ id: "f", factionId: "fangs", leaderInstanceId: "a", members: [{ instanceId: "a", profileId: "profil-inexistant", addedEquipmentIds: [], removedBaseEquipmentIds: [], spellIds: [] }] }] };
    const w = checkImportedList(catalog, bad);
    expect(w.some((m) => m.includes("Version"))).toBe(true);
    expect(w.some((m) => m.includes("profil-inexistant"))).toBe(true);
  });
});
