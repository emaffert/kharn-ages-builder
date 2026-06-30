// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCatalogStore } from "./useCatalogStore";

beforeEach(() => {
  // localStorage peut être indisponible (Node sans --localstorage-file) ; le store le gère.
  try {
    localStorage?.clear();
  } catch {
    /* indisponible */
  }
});

describe("useCatalogStore", () => {
  it("modifie un champ scalaire et passe en état modifié", () => {
    const { result } = renderHook(() => useCatalogStore());
    const id = result.current.catalog.profiles[0]!.id;
    act(() => result.current.updateField(id, "cost", 999));
    expect(result.current.catalog.profiles.find((p) => p.id === id)!.cost).toBe(999);
    expect(result.current.dirty).toBe(true);
  });

  it("modifie une caractéristique imbriquée (stats.v)", () => {
    const { result } = renderHook(() => useCatalogStore());
    const id = result.current.catalog.profiles[0]!.id;
    act(() => result.current.updateField(id, "stats.v", 7));
    expect(result.current.catalog.profiles.find((p) => p.id === id)!.stats.v).toBe(7);
  });

  it("bascule l'indicateur « à vérifier » d'un champ", () => {
    const { result } = renderHook(() => useCatalogStore());
    const id = result.current.catalog.profiles[0]!.id;
    const has = () =>
      result.current.catalog.profiles.find((p) => p.id === id)!.unverifiedFields?.includes("stats.v") ??
      false;
    const before = has();
    act(() => result.current.toggleUnverified(id, "stats.v"));
    expect(has()).toBe(!before);
  });

  it("réinitialise les modifications locales", () => {
    const { result } = renderHook(() => useCatalogStore());
    const id = result.current.catalog.profiles[0]!.id;
    act(() => result.current.updateField(id, "cost", 1));
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
    expect(result.current.catalog.profiles.find((p) => p.id === id)!.cost).not.toBe(1);
  });
});
