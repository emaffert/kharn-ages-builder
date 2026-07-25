import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListDocument } from "@core";
import {
  allSavedLists,
  clearDeletions,
  deleteSavedList,
  pendingDeletions,
  replaceCachedLists,
  saveList,
} from "../io/listsDb";
import { deleteRemoteList, fetchLists, upsertList } from "../../lib/listsApi";
import { useSession } from "../auth/context";
import { supabase } from "../../lib/supabase";
import { reconcileLists } from "./merge";

/**
 * État de la bibliothèque vis-à-vis du serveur, pour l'afficher à l'utilisateur.
 * - `local` : pas de compte (ou pas de backend) → les listes ne vivent que sur cet appareil.
 * - `offline` : compte connecté mais serveur injoignable → on travaille sur le cache.
 */
export type SyncState = "local" | "syncing" | "synced" | "offline";

export type SavedLists = {
  savedLists: ListDocument[];
  syncState: SyncState;
  save: (doc: ListDocument) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/**
 * Bibliothèque des listes sauvegardées, local-first avec synchro serveur.
 *
 * Le cache IndexedDB répond immédiatement et fonctionne hors-ligne ; dès qu'un compte est
 * connecté, on réconcilie avec le serveur (cf. `reconcileLists`) : les listes créées sans
 * compte y montent, celles des autres appareils redescendent. Chaque enregistrement et chaque
 * suppression écrit d'abord en local - jamais bloqué par le réseau - puis est propagé.
 */
export function useSavedLists(client: SupabaseClient | null = supabase): SavedLists {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [savedLists, setSavedLists] = useState<ListDocument[]>([]);
  const [syncState, setSyncState] = useState<SyncState>("local");
  // Évite qu'une synchro lancée pour un compte n'écrase l'état d'un autre (déconnexion rapide).
  const runId = useRef(0);

  /** Recharge depuis le cache local (source d'affichage immédiate). */
  const reloadLocal = useCallback(async (owner: string | null) => {
    const docs = await allSavedLists(owner).catch(() => []);
    setSavedLists(docs);
    return docs;
  }, []);

  /** Réconcilie le cache local et le serveur, puis publie le résultat. */
  const sync = useCallback(
    async (active: SupabaseClient, owner: string, run: number) => {
      setSyncState("syncing");
      const local = await allSavedLists(owner).catch(() => []);
      const [remote, deletedIds] = await Promise.all([
        fetchLists(active, owner),
        pendingDeletions(owner).catch(() => [] as string[]),
      ]);
      if (run !== runId.current) return;
      // Serveur injoignable : on garde le cache tel quel, sans rien conclure ni propager.
      if (remote === null) {
        setSavedLists(local);
        setSyncState("offline");
        return;
      }
      const { merged, toUpload, toCache, toDeleteRemote } = reconcileLists(local, remote, deletedIds);
      setSavedLists(merged);
      const failures = await Promise.all([
        ...toUpload.map((doc) => upsertList(active, owner, doc)),
        ...toDeleteRemote.map((id) => deleteRemoteList(active, id)),
      ]);
      if (run !== runId.current) return;
      // Le cache local adopte l'état réconcilié, y compris le rattachement au compte.
      if (toCache.length > 0 || toUpload.length > 0 || toDeleteRemote.length > 0) {
        await replaceCachedLists(merged, owner).catch(() => {});
      }
      await clearDeletions(toDeleteRemote).catch(() => {});
      setSyncState(failures.some(Boolean) ? "offline" : "synced");
    },
    [],
  );

  useEffect(() => {
    const run = ++runId.current;
    void (async () => {
      await reloadLocal(userId);
      if (run !== runId.current) return;
      if (!client || !userId) {
        setSyncState("local");
        return;
      }
      await sync(client, userId, run);
    })();
  }, [client, userId, reloadLocal, sync]);

  const save = useCallback(
    async (doc: ListDocument) => {
      await saveList(doc, userId);
      await reloadLocal(userId);
      if (!client || !userId) return;
      const failure = await upsertList(client, userId, doc);
      setSyncState(failure ? "offline" : "synced");
    },
    [client, userId, reloadLocal],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteSavedList(id, userId);
      await reloadLocal(userId);
      if (!client || !userId) return;
      const failure = await deleteRemoteList(client, id);
      if (failure) {
        setSyncState("offline"); // la pierre tombale reste : la suppression repartira plus tard
        return;
      }
      await clearDeletions([id]).catch(() => {});
      setSyncState("synced");
    },
    [client, userId, reloadLocal],
  );

  return { savedLists, syncState, save, remove };
}
