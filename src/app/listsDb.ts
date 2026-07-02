import Dexie, { type Table } from "dexie";
import { parseListDocument, type ListDocument } from "@core";

/**
 * Persistance locale des listes joueur (IndexedDB via Dexie) — couche local-first.
 * La synchro cloud viendra se brancher par-dessus plus tard (cf. mémoire archi).
 */
class ListsDb extends Dexie {
  lists!: Table<ListDocument, string>;
  constructor() {
    super("kharn-ages-builder");
    this.version(1).stores({ lists: "id, updatedAt" });
  }
}

// IndexedDB peut être absent (jsdom en test) : on dégrade proprement en no-op.
const db = typeof indexedDB !== "undefined" ? new ListsDb() : null;

export async function saveList(doc: ListDocument): Promise<void> {
  await db?.lists.put(doc);
}

export async function allSavedLists(): Promise<ListDocument[]> {
  if (!db) return [];
  const rows = await db.lists.toArray();
  // Revalidation Zod : on écarte une sauvegarde corrompue ou d'un schéma obsolète
  // plutôt que de la propager (elle ferait planter l'évaluation).
  const valid: ListDocument[] = [];
  for (const row of rows) {
    try {
      valid.push(parseListDocument(row));
    } catch {
      /* sauvegarde ignorée */
    }
  }
  return valid.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)); // plus récentes d'abord
}

export async function deleteSavedList(id: string): Promise<void> {
  await db?.lists.delete(id);
}
