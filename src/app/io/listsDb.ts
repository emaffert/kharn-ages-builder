import Dexie, { type Table } from "dexie";
import { parseListDocument, type ListDocument } from "@core";

/**
 * Cache local des listes joueur (IndexedDB via Dexie).
 *
 * Depuis la synchro serveur, le cache est **rattaché à un compte** : `ownerId` porte l'id du
 * propriétaire, ou `null` pour une liste créée sans être connecté. Sans cela, les listes d'un
 * compte seraient visibles - voire téléversées - par le compte suivant à se connecter sur le
 * même navigateur.
 *
 * La table `deletedLists` garde une pierre tombale par suppression, le temps de la propager au
 * serveur : sans elle, une liste supprimée hors-ligne réapparaîtrait à la synchro suivante.
 */
type StoredList = ListDocument & { ownerId: string | null };

class ListsDb extends Dexie {
  lists!: Table<StoredList, string>;
  deletedLists!: Table<{ id: string; ownerId: string | null }, string>;
  constructor() {
    super("kharn-ages-builder");
    this.version(1).stores({ lists: "id, updatedAt" });
    // v2 : `ownerId` (rattachement au compte) et les pierres tombales. Les listes déjà en base
    // n'en ont pas → `undefined`, traité comme `null` : elles migreront vers le premier compte.
    this.version(2).stores({ lists: "id, updatedAt, ownerId", deletedLists: "id" });
  }
}

// IndexedDB peut être absent (jsdom en test) : on dégrade proprement en no-op.
const db = typeof indexedDB !== "undefined" ? new ListsDb() : null;

/** Une liste appartient-elle à l'utilisateur courant (ou à personne, donc migrable) ? */
function belongsTo(row: StoredList, ownerId: string | null): boolean {
  const owner = row.ownerId ?? null;
  return owner === null || owner === ownerId;
}

export async function saveList(doc: ListDocument, ownerId: string | null = null): Promise<void> {
  await db?.lists.put({ ...doc, ownerId });
  // Réenregistrer une liste annule une suppression restée en attente de synchro.
  await db?.deletedLists.delete(doc.id);
}

/**
 * Listes visibles pour le compte donné (`null` = hors connexion) : les siennes, plus celles
 * créées sans compte, qui n'attendent qu'une connexion pour être rattachées.
 */
export async function allSavedLists(ownerId: string | null = null): Promise<ListDocument[]> {
  if (!db) return [];
  const rows = await db.lists.toArray();
  // Revalidation Zod : on écarte une sauvegarde corrompue ou d'un schéma obsolète
  // plutôt que de la propager (elle ferait planter l'évaluation).
  const valid: ListDocument[] = [];
  for (const row of rows) {
    if (!belongsTo(row, ownerId)) continue;
    try {
      valid.push(parseListDocument(row));
    } catch {
      /* sauvegarde ignorée */
    }
  }
  return valid.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)); // plus récentes d'abord
}

export async function deleteSavedList(id: string, ownerId: string | null = null): Promise<void> {
  await db?.lists.delete(id);
  // Pierre tombale : seule une liste connue du serveur a besoin d'être supprimée là-bas, mais
  // on ne le sait pas toujours ici - le surplus est purgé après la synchro.
  if (ownerId) await db?.deletedLists.put({ id, ownerId });
}

/** Suppressions en attente de propagation au serveur, pour ce compte. */
export async function pendingDeletions(ownerId: string): Promise<string[]> {
  if (!db) return [];
  const rows = await db.deletedLists.toArray();
  return rows.filter((r) => r.ownerId === ownerId).map((r) => r.id);
}

/** Oublie les pierres tombales une fois la suppression propagée. */
export async function clearDeletions(ids: readonly string[]): Promise<void> {
  if (!db || ids.length === 0) return;
  await db.deletedLists.bulkDelete([...ids]);
}

/** Efface du cache tout ce qui appartient à un compte (suppression de compte). */
export async function purgeCachedLists(ownerId: string): Promise<void> {
  if (!db) return;
  const rows = await db.lists.toArray();
  await db.lists.bulkDelete(rows.filter((r) => r.ownerId === ownerId).map((r) => r.id));
  const tombs = await db.deletedLists.toArray();
  await db.deletedLists.bulkDelete(tombs.filter((t) => t.ownerId === ownerId).map((t) => t.id));
}

/** Remplace le cache du compte par l'état issu de la synchro (et rattache les listes migrées). */
export async function replaceCachedLists(docs: readonly ListDocument[], ownerId: string): Promise<void> {
  if (!db) return;
  const rows = await db.lists.toArray();
  const obsolete = rows.filter((r) => belongsTo(r, ownerId) && !docs.some((d) => d.id === r.id)).map((r) => r.id);
  await db.lists.bulkDelete(obsolete);
  await db.lists.bulkPut(docs.map((doc) => ({ ...doc, ownerId })));
}
