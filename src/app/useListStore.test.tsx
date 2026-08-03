import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { catalog } from "@data";
import type { Catalog } from "@core";
import { CatalogContext } from "./catalog/context";
import { useListStore } from "./useListStore";

/**
 * Tests d'interaction du store du constructeur : mutations par instanceId + cohérence de
 * l'évaluation (coût dérivé du moteur). Dexie est inactif sous jsdom (pas d'IndexedDB), on ne
 * teste donc pas la persistance ici.
 */
/** Rend le store avec un catalogue de banc d'essai (le provider n'est pas monté dans ces tests). */
function withCatalog(cat: Catalog) {
  return ({ children }: { children: ReactNode }) => (
    <CatalogContext.Provider value={{ catalog: cat, published: null, update: null, refresh: () => {} }}>
      {children}
    </CatalogContext.Provider>
  );
}

describe("useListStore", () => {
  it("addMember ajoute une figurine et la désigne meneur", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-apathee-3"));
    const fdl = result.current.fdl;
    expect(fdl.members).toHaveLength(1);
    expect(fdl.leaderInstanceId).toBe(fdl.members[0].instanceId);
    expect(result.current.evaluation.totalCost).toBe(140);
  });

  it("retirer le meneur désigne la figurine la plus chère restante", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1")); // 45, meneur initial
    act(() => result.current.addMember("fangs-apathee-3")); // 140
    const goulue = result.current.fdl.members[0].instanceId;
    act(() => result.current.removeMember(goulue));
    const fdl = result.current.fdl;
    expect(fdl.members).toHaveLength(1);
    expect(result.current.catalog.profiles.find((p) => p.id === fdl.members[0].profileId)?.name).toBe("Apathée");
    expect(fdl.leaderInstanceId).toBe(fdl.members[0].instanceId);
  });

  it("retirer une porteuse emporte ses unités rattachées", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1"));
    const goulue = result.current.fdl.members[0].instanceId;
    act(() => result.current.addAttached(goulue, "fangs-likan-1"));
    expect(result.current.fdl.members).toHaveLength(2);
    act(() => result.current.removeMember(goulue));
    expect(result.current.fdl.members).toHaveLength(0);
  });

  it("setGuard rend le larbin désigné gratuit (via l'effet Fille de Nyx)", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-apathee-3"));
    act(() => result.current.addMember("fangs-larbin-1"));
    const [apathee, larbin] = result.current.fdl.members;
    // Non désigné : le larbin paye plein tarif.
    expect(result.current.evaluation.costByInstance[larbin.instanceId]).toBeGreaterThan(0);
    act(() => result.current.setGuard(larbin.instanceId, apathee.instanceId));
    expect(result.current.evaluation.costByInstance[larbin.instanceId]).toBe(0);
  });

  it("moveMember réordonne les figurines", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1"));
    act(() => result.current.addMember("fangs-apathee-3"));
    const [a, b] = result.current.fdl.members.map((m) => m.instanceId);
    act(() => result.current.moveMember(b, a)); // b passe devant a
    expect(result.current.fdl.members.map((m) => m.instanceId)).toEqual([b, a]);
  });

  it("toggleUpgrade ajoute le coût de l'amélioration", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1")); // 45
    const goulue = result.current.fdl.members[0].instanceId;
    act(() => result.current.toggleUpgrade(goulue, "apprentie-de-nyx")); // +15
    expect(result.current.evaluation.totalCost).toBe(60);
  });

  // Sceau de la guilde noire : posé d'office sur une recrue GN étrangère, et non retirable.
  const SEAL = "sceau-de-la-guilde-noire";

  it("recruter un membre GN ailleurs l'équipe du sceau et facture le surcoût", () => {
    const { result } = renderHook(() => useListStore("kharns"));
    act(() => result.current.addMember("guilde-noire-raimbert-2")); // 118
    const membre = result.current.fdl.members[0];
    expect(membre.addedEquipmentIds).toEqual([SEAL]);
    expect(result.current.evaluation.totalCost).toBe(128);
    expect(result.current.evaluation.issues.filter((i) => i.ruleId?.startsWith("faction:"))).toHaveLength(0);
  });

  it("le sceau imposé ne peut pas être retiré", () => {
    const { result } = renderHook(() => useListStore("kharns"));
    act(() => result.current.addMember("guilde-noire-raimbert-2"));
    const id = result.current.fdl.members[0].instanceId;
    act(() => result.current.removeEquip(id, SEAL));
    expect(result.current.fdl.members[0].addedEquipmentIds).toEqual([SEAL]);
  });

  it("dans un Fer de Lance Guilde Noire, aucun sceau n'est imposé", () => {
    const { result } = renderHook(() => useListStore("guilde-noire"));
    act(() => result.current.addMember("guilde-noire-raimbert-2"));
    expect(result.current.fdl.members[0].addedEquipmentIds).toEqual([]);
    expect(result.current.evaluation.totalCost).toBe(118);
  });

  it("un frère d'armes se recrute sans sceau, et peut l'acheter puis le rendre", () => {
    const { result } = renderHook(() => useListStore("kharns"));
    act(() => result.current.addMember("guilde-noire-mathys-3"));
    const id = result.current.fdl.members[0].instanceId;
    expect(result.current.fdl.members[0].addedEquipmentIds).toEqual([]);
    act(() => result.current.addEquip(id, SEAL));
    expect(result.current.fdl.members[0].addedEquipmentIds).toEqual([SEAL]);
    act(() => result.current.removeEquip(id, SEAL));
    expect(result.current.fdl.members[0].addedEquipmentIds).toEqual([]);
  });

  it("toggleBase refuse de rendre un équipement de base soudé à la figurine", () => {
    const base = catalog.profiles.find((p) => new Set(p.baseEquipmentIds).size >= 2)!;
    const [fixedId, freeId] = [...new Set(base.baseEquipmentIds)];
    const cat: Catalog = {
      ...catalog,
      profiles: catalog.profiles.map((p) => (p.id === base.id ? { ...p, fixedBaseEquipmentIds: [fixedId] } : p)),
    };
    const { result } = renderHook(() => useListStore(base.factionId ?? "fangs"), { wrapper: withCatalog(cat) });
    act(() => result.current.addMember(base.id));
    const id = result.current.fdl.members[0].instanceId;
    act(() => result.current.toggleBase(id, fixedId));
    expect(result.current.fdl.members[0].removedBaseEquipmentIds).toEqual([]);
    // ... alors que le reste de l'équipement de base se rend normalement.
    act(() => result.current.toggleBase(id, freeId));
    expect(result.current.fdl.members[0].removedBaseEquipmentIds).toEqual([freeId]);
  });

  it("acheter deux fois un objet empilable empile les exemplaires au lieu de doubler la ligne", () => {
    const stacked = catalog.equipment.find((e) => e.stackable)!;
    const porteuse = catalog.profiles.find((p) => p.baseEquipmentCounts?.[stacked.id] != null)!;
    const { result } = renderHook(() => useListStore(porteuse.factionId ?? "fangs"));
    act(() => result.current.addMember(porteuse.id));
    const id = result.current.fdl.members[0].instanceId;
    const before = result.current.evaluation.totalCost;
    act(() => result.current.addEquip(id, stacked.id));
    act(() => result.current.addEquip(id, stacked.id));
    const m = result.current.fdl.members[0];
    expect(m.addedEquipmentIds).toEqual([stacked.id]);
    expect(m.addedEquipmentCounts).toEqual({ [stacked.id]: 2 });
    expect(result.current.evaluation.totalCost).toBe(before + stacked.cost * 2);
    // Le retrait rend un exemplaire à la fois, la ligne ne part qu'au dernier.
    act(() => result.current.removeEquip(id, stacked.id));
    expect(result.current.fdl.members[0].addedEquipmentCounts).toEqual({ [stacked.id]: 1 });
    act(() => result.current.removeEquip(id, stacked.id));
    expect(result.current.fdl.members[0].addedEquipmentIds).toEqual([]);
    expect(result.current.evaluation.totalCost).toBe(before);
  });

  it("un objet non empilable ne s'achète qu'une fois", () => {
    const plain = catalog.equipment.find((e) => !e.stackable && e.cost > 0 && e.category === "objet")!;
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1"));
    const id = result.current.fdl.members[0].instanceId;
    act(() => result.current.addEquip(id, plain.id));
    act(() => result.current.addEquip(id, plain.id));
    expect(result.current.fdl.members[0].addedEquipmentIds).toEqual([plain.id]);
    expect(result.current.fdl.members[0].addedEquipmentCounts).toBeUndefined();
  });

  it("toggleUpgrade impose un choix exclusif au sein d'un même choiceGroup", () => {
    const { result } = renderHook(() => useListStore("gouns"));
    act(() => result.current.addMember("gouns-artisane-dogon-1"));
    const artisane = result.current.fdl.members[0].instanceId;
    act(() => result.current.toggleUpgrade(artisane, "racines-tribales-nourrice"));
    act(() => result.current.toggleUpgrade(artisane, "racines-tribales-herboriste"));
    // La 2e sélection du même groupe (Racines Tribales) remplace la 1re.
    expect(result.current.fdl.members[0].specialCardIds).toEqual(["racines-tribales-herboriste"]);
  });
});

describe("duplicateMember", () => {
  it("recopie le chargement et place la copie juste après l'originale", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1"));
    act(() => result.current.addMember("fangs-apathee-3"));
    const goulue = result.current.fdl.members[0].instanceId;
    act(() => result.current.addEquip(goulue, "epee-longue"));

    act(() => result.current.duplicateMember(goulue));
    const members = result.current.fdl.members;
    expect(members).toHaveLength(3);
    expect(members[1].profileId).toBe("fangs-goulue-1"); // insérée derrière l'originale
    expect(members[1].instanceId).not.toBe(goulue);
    expect(members[1].addedEquipmentIds).toEqual(["epee-longue"]);
    // Le coût double : la copie est une recrue de plus, pas un affichage.
    expect(result.current.evaluation.costByInstance[members[1].instanceId]).toBe(
      result.current.evaluation.costByInstance[goulue],
    );
  });

  it("la copie est indépendante : l'équiper ne touche pas l'originale", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1"));
    const goulue = result.current.fdl.members[0].instanceId;
    act(() => result.current.duplicateMember(goulue));
    const copie = result.current.fdl.members[1].instanceId;
    act(() => result.current.addEquip(copie, "epee-longue"));
    expect(result.current.fdl.members[0].addedEquipmentIds).toEqual([]);
    expect(result.current.fdl.members[1].addedEquipmentIds).toEqual(["epee-longue"]);
  });

  it("la copie arrive sans les rattachées de l'originale", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1"));
    const goulue = result.current.fdl.members[0].instanceId;
    act(() => result.current.addAttached(goulue, "fangs-likan-1"));
    act(() => result.current.duplicateMember(goulue));
    const copie = result.current.fdl.members.find(
      (m) => m.profileId === "fangs-goulue-1" && m.instanceId !== goulue,
    )!;
    expect(copie.attachedInstanceIds).toBeUndefined();
    expect(result.current.fdl.members.filter((m) => m.profileId === "fangs-likan-1")).toHaveLength(1);
  });

  it("la copie arrive sans la désignation de garde du corps", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-apathee-3"));
    act(() => result.current.addMember("fangs-larbin-1"));
    const [apathee, larbin] = result.current.fdl.members.map((m) => m.instanceId);
    act(() => result.current.setGuard(larbin, apathee));
    act(() => result.current.duplicateMember(larbin));
    const copie = result.current.fdl.members.find(
      (m) => m.profileId === "fangs-larbin-1" && m.instanceId !== larbin,
    )!;
    expect(copie.bodyguardOfInstanceId).toBeUndefined();
    // L'originale garde la sienne : elle reste gratuite, la copie non.
    expect(result.current.evaluation.costByInstance[larbin]).toBe(0);
    expect(result.current.evaluation.costByInstance[copie.instanceId]).toBeGreaterThan(0);
  });

  it("dupliquer le meneur ne change pas le meneur", () => {
    const { result } = renderHook(() => useListStore("fangs"));
    act(() => result.current.addMember("fangs-goulue-1"));
    const goulue = result.current.fdl.members[0].instanceId;
    act(() => result.current.duplicateMember(goulue));
    expect(result.current.fdl.leaderInstanceId).toBe(goulue);
  });
});
