/**
 * Coordination entre le service worker et l'application : une mise à jour est **annoncée**, jamais
 * imposée.
 *
 * La liste que le joueur compose ne vit que dans l'état React - rien ne l'écrit tant qu'il n'a pas
 * cliqué sur « Enregistrer ». Recharger sans le demander effacerait son Fer de Lance. Le brouillon
 * d'administration, lui, survit (il est écrit à chaque modification), mais le principe reste le
 * même : c'est l'utilisateur qui choisit le moment.
 */

/** Marqueur de session : la page vient d'être rechargée pour appliquer une nouvelle version. */
const JUST_UPDATED_KEY = "kharn-just-updated";

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

/** Recharge en laissant une trace, pour que l'administration puisse annoncer les nouveautés. */
export function applyUpdate(): void {
  try {
    sessionStorage.setItem(JUST_UPDATED_KEY, "1");
  } catch {
    /* mode privé : on rechargera sans annonce, ce n'est pas bloquant */
  }
  location.reload();
}

/** La page vient-elle d'être rechargée pour une mise à jour ? Consommé une seule fois. */
export function consumeJustUpdated(): boolean {
  try {
    const flag = sessionStorage.getItem(JUST_UPDATED_KEY);
    if (flag) sessionStorage.removeItem(JUST_UPDATED_KEY);
    return Boolean(flag);
  } catch {
    return false;
  }
}
