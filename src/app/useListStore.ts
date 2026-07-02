import { useCallback, useEffect, useMemo, useState } from "react";
import { evaluateList, type Catalog, type EvaluationResult, type ListDocument, type ProfileInstance } from "@core";
import { loadCatalog } from "@data";
import { allSavedLists, deleteSavedList, saveList } from "./listsDb";

/**
 * Store maison du constructeur de liste joueur : détient un `ListDocument`, expose des
 * mutations par `instanceId`, et dérive l'évaluation (coût + validation) via `evaluateList`.
 * Local-first : la persistance (Dexie) et l'import/export viendront se brancher par-dessus.
 */

let idCounter = 0;
const newInstanceId = (profileId: string) => `${profileId}#${Date.now().toString(36)}-${idCounter++}`;

function newInstance(profileId: string): ProfileInstance {
  return {
    instanceId: newInstanceId(profileId),
    profileId,
    addedEquipmentIds: [],
    removedBaseEquipmentIds: [],
    spellIds: [],
  };
}

function emptyList(cat: Catalog, factionId: string): ListDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1",
    catalogVersion: cat.version,
    id: `list-${Date.now().toString(36)}`,
    name: "Nouvelle liste",
    format: "escarmouche",
    pointsLimit: 300,
    createdAt: now,
    updatedAt: now,
    fersDeLance: [{ id: "fdl1", factionId, leaderInstanceId: "", members: [] }],
    snapshot: { totalCost: 0, entries: [] },
  };
}

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/** Leader par défaut = figurine la plus chère (toujours éligible car dans les 2 plus chères). */
function defaultLeader(cat: Catalog, members: ProfileInstance[]): string {
  const cost = (m: ProfileInstance) => cat.profiles.find((p) => p.id === m.profileId)?.cost ?? 0;
  return [...members].sort((a, b) => cost(b) - cost(a))[0]?.instanceId ?? "";
}

export interface ListStore {
  catalog: Catalog;
  list: ListDocument;
  evaluation: EvaluationResult;
  fdl: ListDocument["fersDeLance"][number];
  setName: (name: string) => void;
  setFormat: (format: ListDocument["format"]) => void;
  setPointsLimit: (n: number | undefined) => void;
  newList: (factionId: string, opts?: { format?: ListDocument["format"]; pointsLimit?: number }) => void;
  addMember: (profileId: string) => void;
  addAttached: (carrierInstanceId: string, profileId: string) => void;
  removeMember: (instanceId: string) => void;
  moveMember: (fromInstanceId: string, toInstanceId: string) => void;
  setLeader: (instanceId: string) => void;
  addEquip: (instanceId: string, equipId: string) => void;
  removeEquip: (instanceId: string, equipId: string) => void;
  toggleBase: (instanceId: string, equipId: string) => void;
  setGrimoire: (instanceId: string, g: "none" | "petit" | "grand") => void;
  toggleSpell: (instanceId: string, spellId: string) => void;
  toggleUpgrade: (instanceId: string, cardId: string) => void;
  setMunition: (instanceId: string, equipId: string, qty: number) => void;
  setGuard: (instanceId: string, ofInstanceId: string | null) => void;
  // Persistance locale (Dexie).
  savedLists: ListDocument[];
  saveCurrent: () => Promise<void>;
  loadSaved: (doc: ListDocument) => void;
  removeSaved: (id: string) => Promise<void>;
}

export function useListStore(initialFactionId = "fangs"): ListStore {
  const catalog = useMemo(() => loadCatalog(), []);
  const [list, setList] = useState<ListDocument>(() => emptyList(catalog, initialFactionId));
  const evaluation = useMemo(() => evaluateList(catalog, list), [catalog, list]);
  const fdl = list.fersDeLance[0];

  const touch = (l: ListDocument): ListDocument => ({ ...l, updatedAt: new Date().toISOString() });
  const patchFdl = useCallback(
    (fn: (f: ListDocument["fersDeLance"][number]) => ListDocument["fersDeLance"][number]) =>
      setList((l) => touch({ ...l, fersDeLance: l.fersDeLance.map((f, i) => (i === 0 ? fn(f) : f)) })),
    [],
  );
  const patchMember = useCallback(
    (instanceId: string, fn: (m: ProfileInstance) => ProfileInstance) =>
      patchFdl((f) => ({ ...f, members: f.members.map((m) => (m.instanceId === instanceId ? fn(m) : m)) })),
    [patchFdl],
  );

  // Bibliothèque des listes sauvegardées (IndexedDB).
  const [savedLists, setSavedLists] = useState<ListDocument[]>([]);
  const refreshSaved = useCallback(() => {
    allSavedLists().then(setSavedLists).catch(() => setSavedLists([]));
  }, []);
  useEffect(() => refreshSaved(), [refreshSaved]);

  return {
    catalog,
    list,
    evaluation,
    fdl,
    setName: (name) => setList((l) => touch({ ...l, name })),
    setFormat: (format) => setList((l) => touch({ ...l, format })),
    setPointsLimit: (pointsLimit) => setList((l) => touch({ ...l, pointsLimit })),
    newList: (factionId, opts) =>
      setList({
        ...emptyList(catalog, factionId),
        ...(opts?.format ? { format: opts.format } : {}),
        ...(opts?.pointsLimit != null ? { pointsLimit: opts.pointsLimit } : {}),
      }),
    addMember: (profileId) =>
      patchFdl((f) => {
        const m = newInstance(profileId);
        return { ...f, members: [...f.members, m], leaderInstanceId: f.leaderInstanceId || m.instanceId };
      }),
    addAttached: (carrierInstanceId, profileId) =>
      patchFdl((f) => {
        const m = newInstance(profileId);
        return {
          ...f,
          members: [
            ...f.members.map((x) =>
              x.instanceId === carrierInstanceId
                ? { ...x, attachedInstanceIds: [...(x.attachedInstanceIds ?? []), m.instanceId] }
                : x,
            ),
            m,
          ],
        };
      }),
    removeMember: (instanceId) =>
      patchFdl((f) => {
        // Retirer une figurine emporte ses unités rattachées (Likans/Muskh liés).
        const target = f.members.find((m) => m.instanceId === instanceId);
        const removed = new Set<string>([instanceId, ...(target?.attachedInstanceIds ?? [])]);
        const members = f.members.filter((m) => !removed.has(m.instanceId));
        // Nettoie les liens (garde du corps, rattachements) vers les instances retirées.
        const cleaned = members.map((m) => ({
          ...m,
          bodyguardOfInstanceId:
            m.bodyguardOfInstanceId && removed.has(m.bodyguardOfInstanceId) ? undefined : m.bodyguardOfInstanceId,
          attachedInstanceIds: m.attachedInstanceIds?.filter((id) => !removed.has(id)),
        }));
        const leaderInstanceId = removed.has(f.leaderInstanceId)
          ? defaultLeader(catalog, cleaned)
          : f.leaderInstanceId;
        return { ...f, members: cleaned, leaderInstanceId };
      }),
    setLeader: (instanceId) => patchFdl((f) => ({ ...f, leaderInstanceId: instanceId })),
    moveMember: (fromInstanceId, toInstanceId) =>
      patchFdl((f) => {
        if (fromInstanceId === toInstanceId) return f;
        const members = [...f.members];
        const from = members.findIndex((m) => m.instanceId === fromInstanceId);
        if (from < 0) return f;
        const [moved] = members.splice(from, 1);
        const to = members.findIndex((m) => m.instanceId === toInstanceId);
        members.splice(to < 0 ? members.length : to, 0, moved);
        return { ...f, members };
      }),
    addEquip: (instanceId, equipId) =>
      patchMember(instanceId, (m) => ({ ...m, addedEquipmentIds: [...m.addedEquipmentIds, equipId] })),
    removeEquip: (instanceId, equipId) =>
      patchMember(instanceId, (m) => ({
        ...m,
        addedEquipmentIds: m.addedEquipmentIds.filter((id) => id !== equipId),
      })),
    toggleBase: (instanceId, equipId) =>
      patchMember(instanceId, (m) => ({ ...m, removedBaseEquipmentIds: toggle(m.removedBaseEquipmentIds, equipId) })),
    setGrimoire: (instanceId, g) =>
      patchMember(instanceId, (m) => ({ ...m, grimoireId: g === "none" ? undefined : g })),
    toggleSpell: (instanceId, spellId) =>
      patchMember(instanceId, (m) => ({ ...m, spellIds: toggle(m.spellIds, spellId) })),
    toggleUpgrade: (instanceId, cardId) =>
      patchMember(instanceId, (m) => ({ ...m, specialCardIds: toggle(m.specialCardIds ?? [], cardId) })),
    setMunition: (instanceId, equipId, qty) =>
      patchMember(instanceId, (m) => ({ ...m, munitions: { ...(m.munitions ?? {}), [equipId]: Math.max(0, qty) } })),
    setGuard: (instanceId, ofInstanceId) =>
      patchMember(instanceId, (m) => ({ ...m, bodyguardOfInstanceId: ofInstanceId ?? undefined })),
    savedLists,
    saveCurrent: async () => {
      // On fige l'instantané dénormalisé (coût total + entrées) pour l'affichage « Mes listes ».
      const entries = list.fersDeLance.flatMap((f) =>
        f.members.map((m) => ({
          instanceId: m.instanceId,
          displayName: catalog.profiles.find((p) => p.id === m.profileId)?.name ?? m.profileId,
          cost: evaluation.costByInstance[m.instanceId] ?? 0,
        })),
      );
      const doc = touch({ ...list, snapshot: { totalCost: evaluation.totalCost, entries } });
      setList(doc);
      await saveList(doc);
      refreshSaved();
    },
    loadSaved: (doc) => setList(doc),
    removeSaved: async (id) => {
      await deleteSavedList(id);
      refreshSaved();
    },
  };
}
