import type { ListDocument } from "@core";

/**
 * Réconciliation entre les listes du cache local et celles du serveur.
 *
 * Le serveur fait foi, mais l'app reste utilisable hors-ligne : on fusionne donc les deux côtés
 * par identifiant, en gardant la version la plus récemment modifiée (`updatedAt`, ISO 8601 :
 * comparable en ordre lexicographique). Ce « last-write-wins » est volontairement simple - à
 * cette échelle, deux appareils qui éditent la même liste en même temps restent l'exception.
 *
 * Les suppressions locales sont portées par des pierres tombales (`deletedIds`) : sans elles,
 * une liste supprimée hors-ligne reviendrait d'entre les morts à la synchro suivante.
 */
export type Reconciliation = {
  /** État final : ce que l'utilisateur doit voir, et ce que le cache local doit contenir. */
  merged: ListDocument[];
  /** À pousser sur le serveur (absentes là-bas, ou version locale plus récente). */
  toUpload: ListDocument[];
  /** À écrire dans le cache local (absentes ici, ou version distante plus récente). */
  toCache: ListDocument[];
  /** À supprimer sur le serveur (supprimées localement pendant qu'on était hors-ligne). */
  toDeleteRemote: string[];
};

export function reconcileLists(
  local: ListDocument[],
  remote: ListDocument[],
  deletedIds: readonly string[] = [],
): Reconciliation {
  const deleted = new Set(deletedIds);
  const byId = new Map<string, { local?: ListDocument; remote?: ListDocument }>();
  for (const doc of local) byId.set(doc.id, { ...byId.get(doc.id), local: doc });
  for (const doc of remote) byId.set(doc.id, { ...byId.get(doc.id), remote: doc });

  const result: Reconciliation = { merged: [], toUpload: [], toCache: [], toDeleteRemote: [] };
  for (const [id, pair] of byId) {
    if (deleted.has(id)) {
      // La suppression l'emporte, même si le serveur a une version plus récente : l'intention
      // de l'utilisateur sur cet appareil est explicite, contrairement à un simple horodatage.
      if (pair.remote) result.toDeleteRemote.push(id);
      continue;
    }
    if (pair.local && pair.remote) {
      if (pair.local.updatedAt > pair.remote.updatedAt) {
        result.merged.push(pair.local);
        result.toUpload.push(pair.local);
      } else if (pair.local.updatedAt < pair.remote.updatedAt) {
        result.merged.push(pair.remote);
        result.toCache.push(pair.remote);
      } else {
        result.merged.push(pair.remote); // identiques : rien à transférer
      }
    } else if (pair.local) {
      // Jamais montée sur le serveur : c'est le cas des listes créées avant d'avoir un compte.
      result.merged.push(pair.local);
      result.toUpload.push(pair.local);
    } else if (pair.remote) {
      result.merged.push(pair.remote);
      result.toCache.push(pair.remote);
    }
  }
  // Plus récentes d'abord, comme la bibliothèque locale.
  result.merged.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return result;
}
