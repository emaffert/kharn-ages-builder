/**
 * Coordination entre le service worker et l'application : une mise à jour est **annoncée**, jamais
 * imposée.
 *
 * La liste que le joueur compose ne vit que dans l'état React - rien ne l'écrit tant qu'il n'a pas
 * cliqué sur « Enregistrer ». Recharger sans le demander effacerait son Fer de Lance. Le brouillon
 * d'administration, lui, survit (il est écrit à chaque modification), mais le principe reste le
 * même : c'est l'utilisateur qui choisit le moment.
 */

let updateReady = false;
const listeners = new Set<() => void>();

/** Une nouvelle version attend d'être appliquée (l'utilisateur décide quand). */
export function markUpdateReady(): void {
  if (updateReady) return;
  updateReady = true;
  listeners.forEach((fn) => fn());
}

export function isUpdateReady(): boolean {
  return updateReady;
}

export function subscribeUpdateReady(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Applique la nouvelle version. Les nouveautés, elles, s'annoncent sur la signature du journal. */
export function applyUpdate(): void {
  location.reload();
}
