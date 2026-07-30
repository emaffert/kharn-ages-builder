import { useCallback, useMemo, useState } from "react";
import {
  evaluateList,
  sealRequiredFor,
  type Catalog,
  type EvaluationResult,
  type ListDocument,
  type ProfileInstance,
} from "@core";
import { useCatalog } from "./catalog/context";
import { useSavedLists, type SyncState } from "./lists/useSavedLists";
import { newInstanceId, newListId } from "./io/ids";

/**
 * Store maison du constructeur de liste joueur : détient un `ListDocument`, expose des
 * mutations par `instanceId`, et dérive l'évaluation (coût + validation) via `evaluateList`.
 * Local-first : la persistance (Dexie) et l'import/export viendront se brancher par-dessus.
 */

/**
 * Nouvelle figurine. Le sceau imposé par le recrutement (ex. « Sceau de la guilde noire » pour un
 * membre GN dans un Fer de Lance étranger) est porté d'office : sans lui la recrue serait illégale,
 * et le constructeur en interdit le retrait.
 */
function newInstance(cat: Catalog, profileId: string, factionId: string): ProfileInstance {
  const profile = cat.profiles.find((p) => p.id === profileId);
  const seal = profile ? sealRequiredFor(cat, profile, factionId) : undefined;
  return {
    instanceId: newInstanceId(profileId),
    profileId,
    addedEquipmentIds: seal ? [seal.id] : [],
    removedBaseEquipmentIds: [],
    spellIds: [],
  };
}

function emptyList(cat: Catalog, factionId: string): ListDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1",
    catalogVersion: cat.version,
    id: newListId(),
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
  /** Carte à portée Ost (sélection au niveau de la liste) : active/retire. */
  toggleOstCard: (cardId: string) => void;
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
  /** Attribue (ou retire avec `null`) une monture à la figurine. Conserve les options éventuelles. */
  setMount: (instanceId: string, mountId: string | null) => void;
  /** Achète/retire une option de monture (p.32) ; `value` = valeur X (1 par défaut), `null` = retirée. */
  setMountOption: (instanceId: string, optionId: string, value: number | null) => void;
  /** Ajoute/retire un équipement porté par la MONTURE (ex. Caparaçon) sur `mount.addedEquipmentIds`. */
  toggleMountEquip: (instanceId: string, equipId: string) => void;
  /** Coche/décoche une amélioration intrinsèque d'un équipement de monture (ex. Caparaçon → Pointes acérées). */
  toggleMountEquipUpgrade: (instanceId: string, equipId: string, upgradeId: string) => void;
  setGrimoire: (instanceId: string, g: "none" | "petit" | "grand") => void;
  toggleSpell: (instanceId: string, spellId: string) => void;
  toggleUpgrade: (instanceId: string, cardId: string) => void;
  /** Quantité d'une amélioration *empilable* (`perLevelStack`) ; 0 = retirée, plafonnée au niveau. */
  setUpgradeCount: (instanceId: string, cardId: string, qty: number) => void;
  /** Amélioration partagée (payée une fois par Fer de Lance) : active/retire sur tout le FdL. */
  toggleSharedAmelioration: (instanceId: string, cardId: string) => void;
  /** Amélioration d'équipement (opt-in par objet, ex. arme empoisonnée) : active/retire sur un équipement. */
  toggleEquipmentUpgrade: (instanceId: string, equipmentId: string, upgradeId: string) => void;
  /** Choisit (ou retire, tierIndex=null) le palier de munition d'un type, pour une arme d'une instance. */
  setMunitionTier: (instanceId: string, equipId: string, typeId: string, tierIndex: number | null) => void;
  setGuard: (instanceId: string, ofInstanceId: string | null) => void;
  // Persistance locale (Dexie).
  savedLists: ListDocument[];
  /** Où en est la bibliothèque vis-à-vis du compte (local, synchro en cours, à jour, hors-ligne). */
  syncState: SyncState;
  saveCurrent: () => Promise<void>;
  loadSaved: (doc: ListDocument) => void;
  removeSaved: (id: string) => Promise<void>;
}

export function useListStore(initialFactionId = "fangs"): ListStore {
  // Catalogue actif fourni par `CatalogProvider` (version publiée ou brouillon admin local).
  const { catalog } = useCatalog();
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

  // Bibliothèque des listes sauvegardées : cache local + synchro du compte.
  const { savedLists, syncState, save, remove } = useSavedLists();

  return {
    catalog,
    list,
    evaluation,
    fdl,
    setName: (name) => setList((l) => touch({ ...l, name })),
    setFormat: (format) => setList((l) => touch({ ...l, format })),
    toggleOstCard: (cardId) =>
      setList((l) => {
        const cur = l.ost?.cardIds ?? [];
        const next = cur.includes(cardId) ? cur.filter((x) => x !== cardId) : [...cur, cardId];
        return touch({ ...l, ost: { ...(l.ost ?? {}), cardIds: next.length ? next : undefined } });
      }),
    setPointsLimit: (pointsLimit) => setList((l) => touch({ ...l, pointsLimit })),
    newList: (factionId, opts) =>
      setList({
        ...emptyList(catalog, factionId),
        ...(opts?.format ? { format: opts.format } : {}),
        ...(opts?.pointsLimit != null ? { pointsLimit: opts.pointsLimit } : {}),
      }),
    addMember: (profileId) =>
      patchFdl((f) => {
        const m = newInstance(catalog, profileId, f.factionId);
        return { ...f, members: [...f.members, m], leaderInstanceId: f.leaderInstanceId || m.instanceId };
      }),
    addAttached: (carrierInstanceId, profileId) =>
      patchFdl((f) => {
        const m = newInstance(catalog, profileId, f.factionId);
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
    // Objet empilable déjà acheté : on ajoute un exemplaire plutôt qu'une seconde ligne.
    addEquip: (instanceId, equipId) =>
      patchMember(instanceId, (m) => {
        const stackable = catalog.equipment.find((e) => e.id === equipId)?.stackable;
        if (!m.addedEquipmentIds.includes(equipId)) {
          return { ...m, addedEquipmentIds: [...m.addedEquipmentIds, equipId] };
        }
        if (!stackable) return m;
        const counts = m.addedEquipmentCounts ?? {};
        return { ...m, addedEquipmentCounts: { ...counts, [equipId]: (counts[equipId] ?? 1) + 1 } };
      }),
    removeEquip: (instanceId, equipId) =>
      patchFdl((f) => ({
        ...f,
        members: f.members.map((m) => {
          if (m.instanceId !== instanceId) return m;
          // Le sceau imposé au recrutement n'est pas retirable : sans lui la figurine serait illégale.
          const profile = catalog.profiles.find((p) => p.id === m.profileId);
          if (profile && sealRequiredFor(catalog, profile, f.factionId)?.id === equipId) return m;
          // Empilé : on rend un exemplaire à la fois, la ligne ne part qu'au dernier.
          const qty = m.addedEquipmentCounts?.[equipId] ?? 1;
          if (qty > 1) {
            return { ...m, addedEquipmentCounts: { ...m.addedEquipmentCounts, [equipId]: qty - 1 } };
          }
          const counts = Object.fromEntries(
            Object.entries(m.addedEquipmentCounts ?? {}).filter(([id]) => id !== equipId),
          );
          return {
            ...m,
            addedEquipmentIds: m.addedEquipmentIds.filter((id) => id !== equipId),
            addedEquipmentCounts: Object.keys(counts).length ? counts : undefined,
          };
        }),
      })),
    toggleBase: (instanceId, equipId) =>
      patchMember(instanceId, (m) => {
        // Équipement de base soudé à la figurine : ni rendu, ni remboursé.
        const profile = catalog.profiles.find((p) => p.id === m.profileId);
        if (profile?.fixedBaseEquipmentIds?.includes(equipId)) return m;
        return { ...m, removedBaseEquipmentIds: toggle(m.removedBaseEquipmentIds, equipId) };
      }),
    setMount: (instanceId, mountId) =>
      patchMember(instanceId, (m) => {
        if (mountId) return { ...m, mount: { ...m.mount, mountId } };
        // Retrait de la monture : on nettoie ce qui en dépend - équipement du cavalier réservé aux
        // montés (ex. Lance de cavalerie) et options de monture (devenues orphelines).
        const addedEquipmentIds = m.addedEquipmentIds.filter(
          (id) => catalog.equipment.find((e) => e.id === id)?.mountEquipment !== "rider",
        );
        return { ...m, mount: undefined, addedEquipmentIds, mountOptionIds: undefined };
      }),
    setMountOption: (instanceId, optionId, value) =>
      patchMember(instanceId, (m) => {
        const cur = { ...(m.mountOptionIds ?? {}) };
        if (value == null) delete cur[optionId];
        else cur[optionId] = value;
        return { ...m, mountOptionIds: Object.keys(cur).length ? cur : undefined };
      }),
    toggleMountEquip: (instanceId, equipId) =>
      patchMember(instanceId, (m) => {
        if (!m.mount) return m;
        const cur = m.mount.addedEquipmentIds ?? [];
        const removing = cur.includes(equipId);
        const next = removing ? cur.filter((x) => x !== equipId) : [...cur, equipId];
        // À la dépose de l'objet, on retire ses améliorations intrinsèques éventuelles.
        const ups = { ...(m.mount.equipmentUpgrades ?? {}) };
        if (removing) delete ups[equipId];
        return {
          ...m,
          mount: {
            ...m.mount,
            addedEquipmentIds: next.length ? next : undefined,
            equipmentUpgrades: Object.keys(ups).length ? ups : undefined,
          },
        };
      }),
    toggleMountEquipUpgrade: (instanceId, equipId, upgradeId) =>
      patchMember(instanceId, (m) => {
        if (!m.mount) return m;
        const ups = { ...(m.mount.equipmentUpgrades ?? {}) };
        const cur = ups[equipId] ?? [];
        const next = cur.includes(upgradeId) ? cur.filter((x) => x !== upgradeId) : [...cur, upgradeId];
        if (next.length) ups[equipId] = next;
        else delete ups[equipId];
        return { ...m, mount: { ...m.mount, equipmentUpgrades: Object.keys(ups).length ? ups : undefined } };
      }),
    setGrimoire: (instanceId, g) =>
      patchMember(instanceId, (m) => ({ ...m, grimoireId: g === "none" ? undefined : g })),
    toggleSpell: (instanceId, spellId) =>
      patchMember(instanceId, (m) => ({ ...m, spellIds: toggle(m.spellIds, spellId) })),
    setUpgradeCount: (instanceId, cardId, qty) =>
      patchMember(instanceId, (m) => {
        const level = catalog.profiles.find((p) => p.id === m.profileId)?.level ?? 1;
        const clamped = Math.max(0, Math.min(level, Math.floor(qty)));
        const counts = { ...(m.specialCardCounts ?? {}) };
        let ids = m.specialCardIds ?? [];
        if (clamped <= 0) {
          ids = ids.filter((id) => id !== cardId);
          delete counts[cardId];
        } else {
          if (!ids.includes(cardId)) ids = [...ids, cardId];
          counts[cardId] = clamped;
        }
        return { ...m, specialCardIds: ids, specialCardCounts: counts };
      }),
    toggleUpgrade: (instanceId, cardId) =>
      patchMember(instanceId, (m) => {
        const current = m.specialCardIds ?? [];
        if (current.includes(cardId)) {
          const counts = { ...(m.specialCardCounts ?? {}) };
          delete counts[cardId];
          return { ...m, specialCardIds: current.filter((id) => id !== cardId), specialCardCounts: counts };
        }
        // Ajout : si la carte relève d'un groupe de choix exclusif, retirer les autres du même groupe.
        const group = catalog.specialCards.find((c) => c.id === cardId)?.choiceGroup;
        const kept = group
          ? current.filter((id) => catalog.specialCards.find((c) => c.id === id)?.choiceGroup !== group)
          : current;
        return { ...m, specialCardIds: [...kept, cardId] };
      }),
    toggleEquipmentUpgrade: (instanceId, equipmentId, upgradeId) =>
      patchMember(instanceId, (m) => {
        const map = { ...(m.equipmentUpgrades ?? {}) };
        const cur = map[equipmentId] ?? [];
        const next = cur.includes(upgradeId)
          ? cur.filter((u) => u !== upgradeId)
          : [...cur, upgradeId];
        if (next.length) map[equipmentId] = next;
        else delete map[equipmentId];
        return { ...m, equipmentUpgrades: Object.keys(map).length ? map : undefined };
      }),
    toggleSharedAmelioration: (instanceId, cardId) =>
      patchFdl((f) => {
        // Active dès qu'un membre la porte : si active → retirer partout ; sinon → poser sur ce membre.
        const active = f.members.some((m) => (m.specialCardIds ?? []).includes(cardId));
        return {
          ...f,
          members: f.members.map((m) => {
            if (active) return { ...m, specialCardIds: (m.specialCardIds ?? []).filter((id) => id !== cardId) };
            return m.instanceId === instanceId
              ? { ...m, specialCardIds: [...(m.specialCardIds ?? []), cardId] }
              : m;
          }),
        };
      }),
    setMunitionTier: (instanceId, equipId, typeId, tierIndex) =>
      patchMember(instanceId, (m) => {
        const all = { ...(m.munitions ?? {}) };
        const forEquip = { ...(all[equipId] ?? {}) };
        if (tierIndex == null) delete forEquip[typeId];
        else forEquip[typeId] = tierIndex;
        if (Object.keys(forEquip).length === 0) delete all[equipId];
        else all[equipId] = forEquip;
        return { ...m, munitions: all };
      }),
    setGuard: (instanceId, ofInstanceId) =>
      patchMember(instanceId, (m) => ({ ...m, bodyguardOfInstanceId: ofInstanceId ?? undefined })),
    savedLists,
    syncState,
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
      await save(doc);
    },
    loadSaved: (doc) => setList(doc),
    removeSaved: (id) => remove(id),
  };
}
