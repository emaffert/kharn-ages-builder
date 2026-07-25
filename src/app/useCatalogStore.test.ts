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

  it("modifie un champ complexe (règles) via updateProfile", () => {
    const { result } = renderHook(() => useCatalogStore());
    const id = result.current.catalog.profiles[0]!.id;
    act(() => result.current.updateProfile(id, { rules: [{ text: "Nouvelle règle" }] }));
    expect(result.current.catalog.profiles.find((p) => p.id === id)!.rules).toEqual([
      { text: "Nouvelle règle" },
    ]);
  });

  it("rattache un profil à un autre modèle et supprime le modèle vidé", () => {
    const { result } = renderHook(() => useCatalogStore());
    const moved = result.current.catalog.profiles.find((p) => p.modelId != null)!;
    const origin = moved.modelId!;
    const originCount = () =>
      result.current.catalog.profiles.filter((p) => p.modelId === origin).length;
    const before = originCount();
    // Déplace le profil dans un nouveau groupe dédié.
    let dest = "";
    act(() => {
      dest = result.current.addModel(moved.factionId);
    });
    act(() => result.current.assignProfileToModel(moved.id, dest));
    expect(result.current.catalog.profiles.find((p) => p.id === moved.id)!.modelId).toBe(dest);
    expect(result.current.catalog.models.find((m) => m.id === dest)!.profileIds).toContain(moved.id);
    expect(originCount()).toBe(before - 1);
    // Le renvoie vers son groupe d'origine → le groupe dédié, désormais vide, est supprimé.
    act(() => result.current.assignProfileToModel(moved.id, origin));
    expect(result.current.catalog.models.find((m) => m.id === dest)).toBeUndefined();
    expect(originCount()).toBe(before);
  });

  it("crée un nouveau modèle vide via addModel", () => {
    const { result } = renderHook(() => useCatalogStore());
    let id = "";
    act(() => {
      id = result.current.addModel("kherops");
    });
    const m = result.current.catalog.models.find((x) => x.id === id);
    expect(m).toMatchObject({ factionId: "kherops", profileIds: [] });
  });

  it("repart du fichier du dépôt et abandonne le brouillon", () => {
    const { result } = renderHook(() => useCatalogStore());
    const id = result.current.catalog.profiles[0]!.id;
    act(() => result.current.updateField(id, "cost", 1));
    act(() => result.current.resetToFile());
    expect(result.current.dirty).toBe(false);
    expect(result.current.catalog.profiles.find((p) => p.id === id)!.cost).not.toBe(1);
  });

  it("adopte un catalogue publié comme nouvelle référence", () => {
    const { result } = renderHook(() => useCatalogStore());
    const id = result.current.catalog.profiles[0]!.id;
    act(() => result.current.updateField(id, "cost", 1));
    expect(result.current.dirty).toBe(true);
    const published = { ...result.current.catalog, version: "0.2.0" };
    act(() => result.current.adoptPublished(published));
    // Le catalogue affiché devient celui du serveur, et il n'y a plus de brouillon en attente.
    expect(result.current.catalog.version).toBe("0.2.0");
    expect(result.current.dirty).toBe(false);
  });
});
