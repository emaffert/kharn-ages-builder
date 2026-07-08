import { useCallback, useMemo, useState } from "react";
import {
  parseCatalog,
  type Catalog,
  type Equipment,
  type MagicWay,
  type Model,
  type Mount,
  type MountType,
  type Profile,
  type Skill,
  type SpecialCard,
  type Spell,
} from "@core";
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

/** Un modèle est-il référencé ailleurs que par ses profils (consumesSlotOf, sélecteurs `modelIds`) ? */
function isModelReferenced(cat: Catalog, modelId: string): boolean {
  if (cat.profiles.some((p) => p.limitation?.consumesSlotOf?.modelId === modelId)) return true;
  let found = false;
  const walk = (n: unknown): void => {
    if (found || n == null) return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (typeof n === "object") {
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
        if (k === "modelIds" && Array.isArray(v) && v.includes(modelId)) {
          found = true;
          return;
        }
        walk(v);
      }
    }
  };
  walk({ profiles: cat.profiles, specialCards: cat.specialCards, spells: cat.spells });
  return found;
}

/**
 * Édition locale du catalogue (admin). Les modifications sont conservées dans le navigateur
 * (localStorage) et peuvent être exportées en JSON pour être commitées par un mainteneur.
 */
export function useCatalogStore() {
  // Une seule lecture/validation Zod du catalogue stocké au montage (évite un double parse).
  const stored = useMemo(() => readStored(), []);
  const [catalog, setCatalog] = useState<Catalog>(() => stored ?? loadCatalog());
  const [dirty, setDirty] = useState<boolean>(() => stored != null);

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

  /** Modifie un modèle (groupe de figurines partageant un socle, ex. « du Sacrifice » = Prêtre + Bourreau). */
  const updateModel = useCallback(
    (id: string, patch: Partial<Model>) =>
      apply((c) => ({ ...c, models: c.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    [apply],
  );

  /** Crée un nouveau modèle (groupe) vide et renvoie son id. */
  const addModel = useCallback((factionId?: string): string => {
    const id = `model-${Date.now()}`;
    apply((c) => ({
      ...c,
      models: [...c.models, { id, name: "Nouveau groupe", factionId, profileIds: [] }],
    }));
    return id;
  }, [apply]);

  /**
   * Rattache un profil à un autre modèle (regroupe des variantes, ex. tous les Guerriers khérops).
   * Met à jour `profile.modelId` ET les `profileIds` des modèles, puis supprime les modèles vidés
   * par le déplacement (sauf s'ils sont encore référencés ailleurs).
   */
  const assignProfileToModel = useCallback(
    (profileId: string, targetModelId: string) =>
      apply((c) => {
        const profiles = c.profiles.map((p) =>
          p.id === profileId ? { ...p, modelId: targetModelId } : p,
        );
        const models = c.models.map((m) => ({
          ...m,
          profileIds:
            m.id === targetModelId
              ? [...new Set([...m.profileIds, profileId])]
              : m.profileIds.filter((id) => id !== profileId),
        }));
        const next = { ...c, profiles, models };
        // Nettoie les modèles désormais vides, sauf la cible et ceux encore référencés.
        return {
          ...next,
          models: models.filter(
            (m) =>
              m.id === targetModelId ||
              m.profileIds.length > 0 ||
              isModelReferenced(next, m.id),
          ),
        };
      }),
    [apply],
  );

  // ── Voies de magie (table éditable dans l'admin) ──
  const addMagicWay = useCallback((): string => {
    const id = `way-${Date.now()}`;
    apply((c) => ({
      ...c,
      magicWays: [...c.magicWays, { id, name: "Nouvelle voie", factionId: "" }],
    }));
    return id;
  }, [apply]);

  const updateMagicWay = useCallback(
    (id: string, patch: Partial<MagicWay>) =>
      apply((c) => ({
        ...c,
        magicWays: c.magicWays.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      })),
    [apply],
  );

  const removeMagicWay = useCallback(
    (id: string) => apply((c) => ({ ...c, magicWays: c.magicWays.filter((w) => w.id !== id) })),
    [apply],
  );

  // ── Montures (types + niveaux, éditables dans l'admin) ──
  const addMountType = useCallback((): string => {
    const id = `mount-type-${Date.now()}`;
    apply((c) => ({
      ...c,
      mountTypes: [
        ...c.mountTypes,
        { id, name: "Nouvelle monture", kind: "quagga", factionEligibility: [], excludedProfileIds: [] },
      ],
    }));
    return id;
  }, [apply]);

  const updateMountType = useCallback(
    (id: string, patch: Partial<MountType>) =>
      apply((c) => ({
        ...c,
        mountTypes: c.mountTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    [apply],
  );

  const removeMountType = useCallback(
    (id: string) =>
      apply((c) => ({
        ...c,
        mountTypes: c.mountTypes.filter((t) => t.id !== id),
        mounts: c.mounts.filter((m) => m.typeId !== id), // retire aussi les niveaux rattachés
      })),
    [apply],
  );

  const addMount = useCallback(
    (typeId: string): string => {
      const id = `mount-${Date.now()}`;
      apply((c) => {
        const used = new Set(c.mounts.filter((m) => m.typeId === typeId).map((m) => m.level));
        const level = ([1, 2, 3] as const).find((l) => !used.has(l)) ?? 1;
        return { ...c, mounts: [...c.mounts, { id, typeId, level, cost: 0, bonuses: {}, grantedSkills: [] }] };
      });
      return id;
    },
    [apply],
  );

  const updateMount = useCallback(
    (id: string, patch: Partial<Mount>) =>
      apply((c) => ({ ...c, mounts: c.mounts.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    [apply],
  );

  const removeMount = useCallback(
    (id: string) => apply((c) => ({ ...c, mounts: c.mounts.filter((m) => m.id !== id) })),
    [apply],
  );

  const updateEquipment = useCallback(
    (id: string, patch: Partial<Equipment>) =>
      apply((c) => ({
        ...c,
        equipment: c.equipment.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),
    [apply],
  );

  const addEquipment = useCallback((): string => {
    const id = `equip-${Date.now()}`;
    apply((c) => ({
      ...c,
      equipment: [
        ...c.equipment,
        { id, name: "Nouvel équipement", category: "arme-cac", cost: 0, effectsText: "" },
      ],
    }));
    return id;
  }, [apply]);

  const removeEquipment = useCallback(
    (id: string) => apply((c) => ({ ...c, equipment: c.equipment.filter((e) => e.id !== id) })),
    [apply],
  );

  const updateSkill = useCallback(
    (id: string, patch: Partial<Skill>) =>
      apply((c) => ({ ...c, skills: c.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [apply],
  );

  const addSkill = useCallback((): string => {
    const id = `skill-${Date.now()}`;
    apply((c) => ({
      ...c,
      skills: [...c.skills, { id, keyword: "Nouvelle compétence", hasValue: false, sourceText: "" }],
    }));
    return id;
  }, [apply]);

  const removeSkill = useCallback(
    (id: string) => apply((c) => ({ ...c, skills: c.skills.filter((s) => s.id !== id) })),
    [apply],
  );

  /**
   * Renomme l'id d'une compétence et met à jour toutes les références en cascade
   * (`skillId` des profils/équipements/effets). Retourne false si l'id est vide,
   * inchangé, ou déjà pris par une autre compétence.
   */
  const renameSkillId = useCallback(
    (oldId: string, rawNewId: string): boolean => {
      const newId = rawNewId.trim();
      if (!newId || newId === oldId) return false;
      let ok = true;
      apply((c) => {
        if (c.skills.some((s) => s.id === newId)) {
          ok = false;
          return c;
        }
        // Remplace le champ `skillId` partout, et l'`id` de l'objet compétence lui-même
        // (détecté par la présence de `keyword`, pour ne pas toucher aux voies de magie homonymes).
        const walk = (node: unknown): unknown => {
          if (Array.isArray(node)) return node.map(walk);
          if (node && typeof node === "object") {
            const o = node as Record<string, unknown>;
            const next: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(o)) {
              if (k === "skillId" && v === oldId) next[k] = newId;
              else if (k === "id" && v === oldId && "keyword" in o) next[k] = newId;
              else next[k] = walk(v);
            }
            return next;
          }
          return node;
        };
        return walk(c) as typeof c;
      });
      return ok;
    },
    [apply],
  );

  const updateSpecialCard = useCallback(
    (id: string, patch: Partial<SpecialCard>) =>
      apply((c) => ({
        ...c,
        specialCards: c.specialCards.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })),
    [apply],
  );

  const addSpecialCard = useCallback((): string => {
    const id = `card-${Date.now()}`;
    apply((c) => ({
      ...c,
      specialCards: [
        ...c.specialCards,
        { id, name: "Nouvelle carte", cost: 0, scope: {}, rulesText: [], constraints: [], effects: [], cardImage: "" },
      ],
    }));
    return id;
  }, [apply]);

  const removeSpecialCard = useCallback(
    (id: string) => apply((c) => ({ ...c, specialCards: c.specialCards.filter((s) => s.id !== id) })),
    [apply],
  );

  const updateSpell = useCallback(
    (id: string, patch: Partial<Spell>) =>
      apply((c) => ({ ...c, spells: c.spells.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [apply],
  );

  const addSpell = useCallback((): string => {
    const id = `spell-${Date.now()}`;
    apply((c) => ({
      ...c,
      spells: [...c.spells, { id, name: "Nouveau sort", kind: "generique", target: "", difficulties: [] }],
    }));
    return id;
  }, [apply]);

  const removeSpell = useCallback(
    (id: string) => apply((c) => ({ ...c, spells: c.spells.filter((s) => s.id !== id) })),
    [apply],
  );

  /** Définit (ou retire, si `dataUrl` est nul) l'icône partagée indexée par `cardImage`. */
  const setIcon = useCallback(
    (cardImage: string, dataUrl: string | null) =>
      apply((c) => {
        const icons = { ...(c.icons ?? {}) };
        if (dataUrl) icons[cardImage] = dataUrl;
        else delete icons[cardImage];
        return { ...c, icons };
      }),
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

  /** Charge un catalogue depuis du JSON (validé). Retourne un message d'erreur, ou null si OK. */
  const importJson = useCallback(
    (text: string): string | null => {
      try {
        const next = parseCatalog(JSON.parse(text));
        apply(() => next);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "JSON invalide";
      }
    },
    [apply],
  );

  /**
   * DEV uniquement : enregistre le catalogue directement dans `src/data/catalog.json`
   * via l'endpoint du serveur Vite. Retourne un message d'erreur, ou null si OK.
   */
  const saveToProject = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/__save-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalog),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        return j.error ?? `HTTP ${res.status}`;
      }
      // Le fichier devient la source ; on abandonne la copie locale pour éviter toute divergence.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setDirty(false);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "échec de l'enregistrement";
    }
  }, [catalog]);

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
    updateModel,
    addModel,
    assignProfileToModel,
    addMagicWay,
    updateMagicWay,
    removeMagicWay,
    addMountType,
    updateMountType,
    removeMountType,
    addMount,
    updateMount,
    removeMount,
    updateEquipment,
    addEquipment,
    removeEquipment,
    updateSkill,
    addSkill,
    removeSkill,
    renameSkillId,
    updateSpecialCard,
    addSpecialCard,
    removeSpecialCard,
    updateSpell,
    addSpell,
    removeSpell,
    setIcon,
    toggleUnverified,
    reset,
    exportJson,
    importJson,
    saveToProject,
  };
}
