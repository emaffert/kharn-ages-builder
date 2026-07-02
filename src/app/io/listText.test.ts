import { describe, it, expect } from "vitest";
import { fangsCatalog } from "@data";
import type { ListDocument } from "@core";
import { exportText, importText } from "./listText";

function makeDoc(): ListDocument {
  const now = "2026-07-02T00:00:00Z";
  const apathee = { instanceId: "a", profileId: "fangs-apathee-3", addedEquipmentIds: [], removedBaseEquipmentIds: [], spellIds: ["seduction-du-fiel"] };
  const executeur = { instanceId: "e", profileId: "fangs-executeur-2", addedEquipmentIds: ["arbalete-de-poing"], removedBaseEquipmentIds: [], spellIds: [], munitions: { "arbalete-de-poing": 4 } };
  return {
    schemaVersion: "1",
    catalogVersion: fangsCatalog.version,
    id: "l1",
    name: "Tanière de Nyx",
    format: "escarmouche",
    pointsLimit: 300,
    createdAt: now,
    updatedAt: now,
    fersDeLance: [{ id: "fdl1", factionId: "fangs", leaderInstanceId: "a", members: [apathee, executeur] }],
    snapshot: { totalCost: 0, entries: [] },
  };
}

describe("export/import texte", () => {
  it("l'export contient le nom, la faction et les figurines", () => {
    const txt = exportText(fangsCatalog, makeDoc());
    expect(txt).toContain("Tanière de Nyx");
    expect(txt).toContain("Fangs");
    expect(txt).toContain("Apathée III");
    expect(txt).toContain("meneur");
    expect(txt).toContain("Arbalète de poing (×4 munitions)");
  });

  it("réimporte les figurines, l'arme, les munitions et le sort (best-effort)", () => {
    const { doc, unresolved } = importText(fangsCatalog, exportText(fangsCatalog, makeDoc()));
    const members = doc.fersDeLance[0].members;
    expect(members.map((m) => m.profileId)).toEqual(["fangs-apathee-3", "fangs-executeur-2"]);
    expect(doc.fersDeLance[0].factionId).toBe("fangs");
    const exec = members.find((m) => m.profileId === "fangs-executeur-2")!;
    expect(exec.addedEquipmentIds).toContain("arbalete-de-poing");
    expect(exec.munitions?.["arbalete-de-poing"]).toBe(4);
    const apathee = members.find((m) => m.profileId === "fangs-apathee-3")!;
    expect(apathee.spellIds).toContain("seduction-du-fiel");
    expect(doc.fersDeLance[0].leaderInstanceId).toBe(apathee.instanceId);
    expect(unresolved).toEqual([]);
  });

  it("round-trip d'un équipement de base retiré", () => {
    const doc = makeDoc();
    // L'Exécuteur retire son couteau de base ; le round-trip texte doit le préserver.
    doc.fersDeLance[0].members = doc.fersDeLance[0].members.map((m) =>
      m.profileId === "fangs-executeur-2" ? { ...m, removedBaseEquipmentIds: ["couteau"] } : m,
    );
    const txt = exportText(fangsCatalog, doc);
    expect(txt).toContain("Couteau [retiré]");
    const { doc: back } = importText(fangsCatalog, txt);
    const exec = back.fersDeLance[0].members.find((m) => m.profileId === "fangs-executeur-2")!;
    expect(exec.removedBaseEquipmentIds).toContain("couteau");
  });

  it("signale les lignes non reconnues", () => {
    const { unresolved } = importText(fangsCatalog, "Ma liste\nFangs · Escarmouche · 300 Ko\n\n• Profil Inexistant — 10 Ko");
    expect(unresolved.length).toBeGreaterThan(0);
  });
});
