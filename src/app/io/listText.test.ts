import { describe, it, expect } from "vitest";
import { catalog } from "@data";
import type { ListDocument } from "@core";
import { exportText, importText } from "./listText";

function makeDoc(): ListDocument {
  const now = "2026-07-02T00:00:00Z";
  const apathee = { instanceId: "a", profileId: "fangs-apathee-3", addedEquipmentIds: [], removedBaseEquipmentIds: [], spellIds: ["seduction-du-fiel"] };
  const executeur = { instanceId: "e", profileId: "fangs-executeur-2", addedEquipmentIds: ["arbalete-de-poing"], removedBaseEquipmentIds: [], spellIds: [], munitions: { "arbalete-de-poing": { simple: 1 } } };
  return {
    schemaVersion: "1",
    catalogVersion: catalog.version,
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
    const txt = exportText(catalog, makeDoc());
    expect(txt).toContain("Tanière de Nyx");
    expect(txt).toContain("Fangs");
    expect(txt).toContain("Apathée III");
    expect(txt).toContain("meneur");
    expect(txt).toContain("Arbalète de poing (munitions: 6 Simple)");
  });

  it("réimporte les figurines, l'arme, les munitions et le sort (best-effort)", () => {
    const { doc, unresolved } = importText(catalog, exportText(catalog, makeDoc()));
    const members = doc.fersDeLance[0].members;
    expect(members.map((m) => m.profileId)).toEqual(["fangs-apathee-3", "fangs-executeur-2"]);
    expect(doc.fersDeLance[0].factionId).toBe("fangs");
    const exec = members.find((m) => m.profileId === "fangs-executeur-2")!;
    expect(exec.addedEquipmentIds).toContain("arbalete-de-poing");
    expect(exec.munitions?.["arbalete-de-poing"]).toEqual({ simple: 1 });
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
    const txt = exportText(catalog, doc);
    expect(txt).toContain("Couteau [retiré]");
    const { doc: back } = importText(catalog, txt);
    const exec = back.fersDeLance[0].members.find((m) => m.profileId === "fangs-executeur-2")!;
    expect(exec.removedBaseEquipmentIds).toContain("couteau");
  });

  it("signale les lignes non reconnues", () => {
    const { unresolved } = importText(catalog, "Ma liste\nFangs · Escarmouche · 300 Ko\n\n• Profil Inexistant — 10 Ko");
    expect(unresolved.length).toBeGreaterThan(0);
  });

  it("l'export note les exemplaires d'un objet empilable, et l'import les retrouve", () => {
    const stacked = catalog.equipment.find((e) => e.stackable)!;
    const porteuse = catalog.profiles.find((p) => p.baseEquipmentCounts?.[stacked.id] != null)!;
    const doc = makeDoc();
    doc.fersDeLance[0] = {
      ...doc.fersDeLance[0],
      factionId: porteuse.factionId ?? "fangs",
      leaderInstanceId: "s",
      members: [
        {
          instanceId: "s",
          profileId: porteuse.id,
          addedEquipmentIds: [stacked.id],
          addedEquipmentCounts: { [stacked.id]: 2 },
          removedBaseEquipmentIds: [],
          spellIds: [],
        },
      ],
    };
    const txt = exportText(catalog, doc);
    expect(txt).toContain(`${stacked.name} ×2`); // acheté
    expect(txt).toContain(`${stacked.name} ×${porteuse.baseEquipmentCounts![stacked.id]}`); // de base
    const back = importText(catalog, txt).doc.fersDeLance[0].members[0];
    expect(back.addedEquipmentCounts).toEqual({ [stacked.id]: 2 });
  });
});

const DEMI_SOEUR_CARD = "card-1785410528373";
/** L'identifiant de l'effet est généré par l'admin : on le relit plutôt que de le figer ici. */
const grantEffectId = (): string =>
  catalog.specialCards
    .find((c) => c.id === DEMI_SOEUR_CARD)!
    .effects.find((e) => e.operation.kind === "grant-spell-choice")!.id;

describe("sorts offerts", () => {
  const GRANT = grantEffectId();
  const ORDRE_SEPULCRAL = "spell-1785239128129";

  function docWithGrant(): ListDocument {
    const doc = makeDoc();
    doc.fersDeLance[0].members.push({
      instanceId: "d",
      profileId: "profile-1785410170666",
      addedEquipmentIds: [],
      removedBaseEquipmentIds: [],
      spellIds: [],
      grantedSpellIds: { [GRANT]: [ORDRE_SEPULCRAL] },
    });
    return doc;
  }

  it("l'export nomme le sort offert sans exposer l'identifiant de son effet", () => {
    const txt = exportText(catalog, docWithGrant());
    expect(txt).toContain("sort offert · Ordre sépulcral");
    expect(txt).not.toContain(GRANT);
  });

  it("la relecture rattache le sort à l'offre qui peut l'accueillir", () => {
    const { doc, unresolved } = importText(catalog, exportText(catalog, docWithGrant()));
    const demi = doc.fersDeLance[0].members.find((m) => m.profileId === "profile-1785410170666")!;
    expect(demi.grantedSpellIds).toEqual({ [GRANT]: [ORDRE_SEPULCRAL] });
    expect(demi.spellIds).toEqual([]); // un sort offert n'est pas un sort payé
    expect(unresolved).toEqual([]);
  });

  it("un sort offert sans offre pour l'accueillir est signalé", () => {
    // L'Apathée n'a pas la carte « Demi-soeur » : rien chez elle n'offre de sort.
    const txt = exportText(catalog, makeDoc()).replace(
      "sort · Séduction du Fiel",
      "sort offert · Séduction du Fiel",
    );
    const { doc, unresolved } = importText(catalog, txt);
    const apathee = doc.fersDeLance[0].members.find((m) => m.profileId === "fangs-apathee-3")!;
    expect(apathee.grantedSpellIds).toBeUndefined();
    expect(unresolved.join("\n")).toContain("Séduction du Fiel");
  });
});
