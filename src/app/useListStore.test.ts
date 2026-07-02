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
});
