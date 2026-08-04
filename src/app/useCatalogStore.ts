import { useCallback, useMemo, useState } from "react";
import {
  type Catalog,
  type CatalogSettings,
  type Equipment,
  type Faction,
  type Grimoire,
  type MagicWay,
  type Mount,
  type MountOption,
  type MountType,
  type MunitionKind,
  type Profile,
  type Skill,
  type SpecialCard,
  type Spell,
  renameId,
  isTechnicalId,
  suggestId,
  technicalIdSuggestions,
  removeEntity as coreRemoveEntity,
  type RefKind,
} from "@core";
import { catalog as bundledCatalog, dropAdminDraft, readAdminDraft, writeAdminDraft } from "@data";
import { freezeIcons } from "../lib/freezeIcons";
import { useCatalog } from "./catalog/context";

/** Valeur éditable d'un champ de profil. */
export type FieldValue = number | string | null;

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
  // Une seule lecture/validation Zod du brouillon au montage (évite un double parse). `readAdminDraft`
  // écarte de lui-même un brouillon qui ne porte pas sur la version publiée courante.
  const stored = useMemo(() => readAdminDraft()?.catalog ?? null, []);
  // Sans brouillon local, on édite la version publiée servie par `CatalogProvider`.
  const { catalog: active, published, refresh: refreshActive } = useCatalog();
  const [catalog, setCatalog] = useState<Catalog>(() => stored ?? active);
  const [dirty, setDirty] = useState<boolean>(() => stored != null);

  // La version publiée sur laquelle porte l'édition en cours : elle est écrite avec le brouillon,
  // pour qu'une publication parue entre-temps le rende caduc au lieu de l'écraser silencieusement.
  const baseVersionId = published?.versionId ?? null;

  const apply = useCallback(
    (updater: (c: Catalog) => Catalog) => {
      setCatalog((prev) => {
        const next = updater(prev);
        writeAdminDraft(baseVersionId, next);
        return next;
      });
      setDirty(true);
    },
    [baseVersionId],
  );

  /**
   * **Le** chemin de suppression du catalogue : l'entité s'en va avec tout ce qui la cite
   * (cf. `removeEntity`). Toute suppression de l'admin passe par ici, sans quoi il resterait des
   * références orphelines - c'est ainsi que 16 profils se sont retrouvés à pointer vers un
   * « couteau » disparu.
   */
  const removeEntity = useCallback(
    (kind: RefKind, id: string) => apply((c) => coreRemoveEntity(c, kind, id)),
    [apply],
  );

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

  /**
   * Crée une figurine vierge, **avec son propre groupe**. Le groupe n'est pas un détail de forme :
   * le constructeur parcourt les groupes pour dresser son roster, une figurine qui n'en a pas
   * resterait invisible aux joueurs même une fois publiée. Choisir ensuite le vrai groupe depuis la
   * fiche déplace la figurine et supprime celui-ci, vidé (cf. `assignProfileToModel`).
   *
   * Les caractéristiques naissent vides plutôt qu'à zéro : « - » se voit et se corrige, un 0 se lit
   * comme une valeur saisie. La limitation par défaut est la plus restrictive (X 1) pour qu'une
   * fiche oubliée en l'état ne se recrute pas en nombre.
   */
  const addProfile = useCallback(
    (factionId?: string): string => {
      const id = `profile-${Date.now()}`;
      const modelId = `model-${id}`;
      apply((c) => ({
        ...c,
        models: [...c.models, { id: modelId, name: "Nouveau profil", factionId, profileIds: [id] }],
        profiles: [
          ...c.profiles,
          {
            id,
            modelId,
            name: "Nouveau profil",
            level: 1,
            factionId,
            cost: 0,
            limitation: { kind: "X", value: 1 },
            stats: { v: null, p: null, a: null, c: null, t: null, i: null },
            stature: 0,
            pa: 0,
            pv: 0,
            skills: [],
            baseEquipmentIds: [],
            masteryDice: [],
            traits: [],
            recruitment: [],
            rules: [],
            cardImage: "",
          },
        ],
      }));
      return id;
    },
    [apply],
  );

  /** Crée un nouveau modèle (groupe de figurines) vide et renvoie son id. */
  const addModel = useCallback((factionId?: string, name = "Nouveau groupe"): string => {
    const id = `model-${Date.now()}`;
    apply((c) => ({
      ...c,
      models: [...c.models, { id, name, factionId, profileIds: [] }],
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

  /**
   * Renomme un groupe (modèle). Si un autre groupe de la même faction porte déjà ce nom
   * (à la casse/aux espaces près), les deux sont fusionnés : les figurines du modèle courant
   * sont rattachées au groupe existant, puis le modèle vidé est supprimé. Renvoie l'id du
   * modèle survivant (celui du jumeau en cas de fusion, sinon `id`).
   */
  const renameModel = useCallback(
    (id: string, name: string): string => {
      let survivor = id;
      apply((c) => {
        const models = c.models.map((m) => (m.id === id ? { ...m, name } : m));
        const me = models.find((m) => m.id === id);
        if (!me) return c;
        const key = name.trim().toLowerCase();
        const twin =
          key === ""
            ? undefined
            : models.find(
                (m) =>
                  m.id !== id &&
                  (m.factionId ?? null) === (me.factionId ?? null) &&
                  m.name.trim().toLowerCase() === key,
              );
        if (!twin) return { ...c, models };
        // Fusion : rattache les figurines du modèle courant au jumeau, supprime le modèle vidé.
        survivor = twin.id;
        const profiles = c.profiles.map((p) =>
          p.modelId === id ? { ...p, modelId: twin.id } : p,
        );
        const merged = models
          .map((m) =>
            m.id === twin.id
              ? { ...m, profileIds: [...new Set([...m.profileIds, ...me.profileIds])] }
              : m,
          )
          .filter((m) => m.id !== id);
        return { ...c, profiles, models: merged };
      });
      return survivor;
    },
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

  const removeMagicWay = useCallback((id: string) => removeEntity("magicWay", id), [removeEntity]);

  // ── Réglages : factions, grimoires, munitions (données de référence) ──
  const addFaction = useCallback((): string => {
    const id = `faction-${Date.now()}`;
    apply((c) => ({ ...c, factions: [...c.factions, { id, name: "Nouvelle faction", logo: "" }] }));
    return id;
  }, [apply]);
  const updateFaction = useCallback(
    (id: string, patch: Partial<Faction>) =>
      apply((c) => ({ ...c, factions: c.factions.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
    [apply],
  );
  const removeFaction = useCallback((id: string) => removeEntity("faction", id), [removeEntity]);

  // Ensemble fixe (ids « petit » / « grand ») : édition seule, pas d'ajout/suppression.
  const updateGrimoire = useCallback(
    (id: string, patch: Partial<Grimoire>) =>
      apply((c) => ({ ...c, grimoires: c.grimoires.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
    [apply],
  );

  const addMunitionKind = useCallback((): string => {
    const id = `mun-${Date.now()}`;
    apply((c) => ({
      ...c,
      munitionKinds: [...(c.munitionKinds ?? []), { id, label: "Nouvelle sorte", tierPrices: [], types: [] }],
    }));
    return id;
  }, [apply]);
  const updateMunitionKind = useCallback(
    (id: string, patch: Partial<MunitionKind>) =>
      apply((c) => ({
        ...c,
        munitionKinds: (c.munitionKinds ?? []).map((k) => (k.id === id ? { ...k, ...patch } : k)),
      })),
    [apply],
  );
  const removeMunitionKind = useCallback((id: string) => removeEntity("munitionKind", id), [removeEntity]);

  // Réglages transverses (ex. surcoût d'équipement Tembo).
  const updateSettings = useCallback(
    (patch: Partial<CatalogSettings>) =>
      apply((c) => ({ ...c, settings: { ...c.settings, ...patch } })),
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

  // Emporte les niveaux rattachés, et leurs citations (cf. `removeEntity`).
  const removeMountType = useCallback((id: string) => removeEntity("mountType", id), [removeEntity]);

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

  const removeMount = useCallback((id: string) => removeEntity("mount", id), [removeEntity]);

  const addMountOption = useCallback((): string => {
    const id = `opt-${Date.now()}`;
    apply((c) => ({
      ...c,
      mountOptions: [...c.mountOptions, { id, name: "Nouvelle option", bucket: "mount", cost: 0 }],
    }));
    return id;
  }, [apply]);

  const updateMountOption = useCallback(
    (id: string, patch: Partial<MountOption>) =>
      apply((c) => ({ ...c, mountOptions: c.mountOptions.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
    [apply],
  );

  const removeMountOption = useCallback((id: string) => removeEntity("mountOption", id), [removeEntity]);

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

  /**
   * Renomme l'id d'une compétence et met à jour toutes les références en cascade
   * (`skillId` des profils/équipements/effets). Retourne false si l'id est vide,
   * inchangé, ou déjà pris par une autre compétence.
   */

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
        { id, name: "Nouvelle carte", cost: 0, scope: {}, rulesText: "", constraints: [], effects: [], cardImage: "" },
      ],
    }));
    return id;
  }, [apply]);

  const updateSpell = useCallback(
    (id: string, patch: Partial<Spell>) =>
      apply((c) => ({ ...c, spells: c.spells.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [apply],
  );

  const addSpell = useCallback((): string => {
    const id = `spell-${Date.now()}`;
    apply((c) => ({
      ...c,
      // « grimoire » par défaut, et sans voie : un brouillon n'est proposé à personne dans le
      // constructeur tant qu'on ne lui a pas donné une voie (ou choisi « générique » sciemment).
      spells: [...c.spells, { id, name: "Nouveau sort", kind: "grimoire", target: "", difficulties: [] }],
    }));
    return id;
  }, [apply]);

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

  /** Abandonne le brouillon local : la source redevient la version publiée (ou le fichier). */
  const dropDraft = useCallback(() => {
    dropAdminDraft();
    setDirty(false);
    refreshActive();
  }, [refreshActive]);

  /**
   * Renomme une entité et **tout ce qui la cite** (cf. `renameId`). Sans cette cascade, un
   * identifiant modifié à la main laisserait des références orphelines, invisibles jusqu'à ce
   * qu'un joueur ouvre la fiche concernée.
   */
  const renameEntityId = useCallback(
    (kind: RefKind, oldId: string, newId: string) => apply((c) => renameId(c, kind, oldId, newId)),
    [apply],
  );

  /**
   * Donne un identifiant lisible à une entité qui porte encore celui de sa création
   * (`profile-1785410170666`). Sans effet dès qu'elle en a un vrai : on ne rebaptise pas une entité
   * établie parce qu'on corrige une coquille dans son nom.
   */
  const slugifyEntityId = useCallback(
    (kind: RefKind, id: string) =>
      apply((c) => {
        if (!isTechnicalId(id)) return c;
        const next = suggestId(c, kind, id);
        return next ? renameId(c, kind, id, next) : c;
      }),
    [apply],
  );

  /**
   * Rattrapage en un passage : toutes les entités à identifiant technique reçoivent le leur. Les
   * propositions sont calculées d'abord, ensemble, pour que deux homonymes n'en visent pas un seul ;
   * puis appliquées l'une après l'autre, chacune avec sa cascade de références.
   */
  const slugifyAllIds = useCallback(
    () =>
      apply((c) =>
        technicalIdSuggestions(c).reduce((acc, s) => renameId(acc, s.kind, s.from, s.to), c),
      ),
    [apply],
  );

  /**
   * Repart du `catalog.json` du dépôt : le brouillon est abandonné et le fichier redevient la
   * source éditée. C'est le pendant d'« Enregistrer » pour le développement.
   */
  const resetToFile = useCallback(() => {
    dropDraft();
    setCatalog(bundledCatalog);
  }, [dropDraft]);

  /**
   * Repart d'un catalogue de référence venu du serveur - après une publication, ou quand on
   * récupère la dernière version publiée. Le brouillon local est abandonné pour qu'aucune
   * divergence ne subsiste.
   */
  const adoptPublished = useCallback(
    (published: Catalog) => {
      setCatalog(published);
      dropDraft();
    },
    [dropDraft],
  );

  /**
   * DEV uniquement : enregistre le catalogue directement dans `src/data/catalog.json`
   * via l'endpoint du serveur Vite.
   *
   * Les icônes sont **figées d'abord** : le fichier ne doit jamais citer un portrait que le dépôt
   * ne sert pas, sinon il cesse d'être un repli hors-ligne complet (cf. `freezeIcons`). L'échec du
   * gel interrompt l'enregistrement plutôt que d'écrire un catalogue incohérent.
   *
   * Retourne le nombre d'icônes figées, ou un message d'erreur.
   */
  const saveToProject = useCallback(async (): Promise<{ frozen: number; error: string | null }> => {
    const { catalog: toSave, written, error: freezeError } = await freezeIcons(catalog);
    if (freezeError) return { frozen: 0, error: `Icônes : ${freezeError}` };
    try {
      const res = await fetch("/__save-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        return { frozen: written, error: j.error ?? `HTTP ${res.status}` };
      }
      // Le gel a pu remplacer des data-URI par des références : l'écran doit refléter le fichier.
      setCatalog(toSave);
      // Le fichier devient la source ; on abandonne la copie locale pour éviter toute divergence.
      dropDraft();
      return { frozen: written, error: null };
    } catch (e) {
      return { frozen: written, error: e instanceof Error ? e.message : "échec de l'enregistrement" };
    }
  }, [catalog, dropDraft]);

  const unverifiedCount = catalog.profiles.reduce(
    (n, p) => n + (p.unverifiedFields?.length ?? 0),
    0,
  );

  return {
    catalog,
    dirty,
    unverifiedCount,
    updateField,
    addProfile,
    updateProfile,
    renameModel,
    addModel,
    assignProfileToModel,
    addMagicWay,
    updateMagicWay,
    removeMagicWay,
    addFaction,
    updateFaction,
    removeFaction,
    updateGrimoire,
    addMunitionKind,
    updateMunitionKind,
    removeMunitionKind,
    updateSettings,
    addMountType,
    updateMountType,
    removeMountType,
    addMount,
    updateMount,
    removeMount,
    addMountOption,
    updateMountOption,
    removeMountOption,
    updateEquipment,
    addEquipment,
    updateSkill,
    addSkill,
    updateSpecialCard,
    addSpecialCard,
    updateSpell,
    addSpell,
    setIcon,
    toggleUnverified,
    renameEntityId,
    slugifyEntityId,
    slugifyAllIds,
    removeEntity,
    resetToFile,
    saveToProject,
    adoptPublished,
  };
}
