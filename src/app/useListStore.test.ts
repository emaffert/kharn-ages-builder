import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListStore } from "./useListStore";

/**
 * Tests d'interaction du store du constructeur : mutations par instanceId + cohérence de
 * l'évaluation (coût dérivé du moteur). Dexie est inactif sous jsdom (pas d'IndexedDB), on ne
 * teste donc pas la persistance ici.
 */
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
