import { useCallback, useState } from "react";
import { parseCatalog, type Catalog, type Profile } from "@core";
import { loadCatalog } from "@data";

const STORAGE_KEY = "kharn-admin-catalog-v1";

/** Valeur éditable d'un champ de profil. */
export type FieldValue = number | string | null;

function readStored(): Catalog | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseCatalog(JSON.parse(raw));
  } catch {
    return null;
  }
}

function mapProfile(cat: Catalog, id: string, fn: (p: Profile) => Profile): Catalog {
  return { ...cat, profiles: cat.profiles.map((p) => (p.id === id ? fn(p) : p)) };
}

function setField(profile: Profile, path: string, value: FieldValue): Profile {
  if (path.startsWith("stats.")) {
    const k = path.slice(6) as keyof Profile["stats"];
    return { ...profile, stats: { ...profile.stats, [k]: value as number | null } };
  }
  return { ...profile, [path]: value };
}

function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

/**
 * Édition locale du catalogue (admin). Les modifications sont conservées dans le navigateur
 * (localStorage) et peuvent être exportées en JSON pour être commitées par un mainteneur.
 */
export function useCatalogStore() {
  const [catalog, setCatalog] = useState<Catalog>(() => readStored() ?? loadCatalog());
  const [dirty, setDirty] = useState<boolean>(() => readStored() != null);

  const apply = useCallback((updater: (c: Catalog) => Catalog) => {
    setCatalog((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* quota / mode privé : on garde au moins l'état en mémoire */
      }
      return next;
    });
    setDirty(true);
  }, []);

  const updateField = useCallback(
    (id: string, path: string, value: FieldValue) =>
      apply((c) => mapProfile(c, id, (p) => setField(p, path, value))),
    [apply],
  );

  /** Modifie des champs complexes (tableaux/objets) d'un profil par fusion superficielle. */
  const updateProfile = useCallback(
    (id: string, patch: Partial<Profile>) =>
      apply((c) => mapProfile(c, id, (p) => ({ ...p, ...patch }))),
    [apply],
  );

  const toggleUnverified = useCallback(
    (id: string, key: string) =>
      apply((c) =>
        mapProfile(c, id, (p) => ({ ...p, unverifiedFields: toggle(p.unverifiedFields ?? [], key) })),
      ),
    [apply],
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCatalog(loadCatalog());
    setDirty(false);
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalog.${catalog.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [catalog]);

  const unverifiedCount = catalog.profiles.reduce(
    (n, p) => n + (p.unverifiedFields?.length ?? 0),
    0,
  );

  return {
    catalog,
    dirty,
    unverifiedCount,
    updateField,
    updateProfile,
    toggleUnverified,
    reset,
    exportJson,
  };
}
