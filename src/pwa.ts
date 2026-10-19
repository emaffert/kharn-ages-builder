import { registerSW } from "virtual:pwa-register";
import { markUpdateReady } from "@app/updates";

/**
 * Enregistrement du service worker, avec les deux garanties que l'enregistrement injecté par
 * défaut n'apporte pas.
 *
 * Ce défaut se réduit à `navigator.serviceWorker.register(...)` au chargement. Le worker est bien
 * configuré en `skipWaiting` + `clientsClaim`, donc une nouvelle version prend la main dès qu'elle
 * est découverte - mais deux trous subsistent :
 *
 * 1. **rien ne cherche les mises à jour** tant que la page ne navigue pas. Un onglet laissé ouvert,
 *    ou l'application installée en PWA et rarement fermée, peut tourner des jours sur le code du
 *    jour de la première visite ;
 * 2. **prendre la main ne remplace pas le code déjà chargé.** Le nouveau worker sert les fichiers
 *    à jour, mais le paquet JavaScript en mémoire reste l'ancien jusqu'à un rechargement.
 *
 * C'est cette combinaison qui a laissé un visiteur voir un onglet « Admin » retiré du site depuis
 * longtemps : son navigateur servait un build antérieur au verrouillage.
 */

/** Intervalle de vérification, pour un onglet qui ne navigue jamais. */
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

/** Fenêtre après l'ouverture de la page pendant laquelle une mise à jour s'applique d'office. */
const FRESH_OPEN_MS = 10 * 1000;

/**
 * Que faire quand le worker qui contrôle la page change ?
 *
 * - Rien à la toute première installation : il n'y avait aucun contrôleur, la page tourne déjà sur
 *   le bon code. Rien non plus si c'est déjà fait.
 * - **Recharger** juste après l'ouverture du site : le navigateur a servi la version gardée en cache
 *   avant de découvrir la nouvelle. Annoncer une mise à jour à quelqu'un qui vient d'arriver serait
 *   déroutant, et la liste en cours survit au rechargement.
 * - **Annoncer** au-delà : l'utilisateur est au travail, il choisit son moment.
 */
export function controllerChangeAction(
  hadController: boolean,
  alreadyHandled: boolean,
  msSinceOpen: number,
): "none" | "reload" | "announce" {
  if (!hadController || alreadyHandled) return "none";
  return msSinceOpen < FRESH_OPEN_MS ? "reload" : "announce";
}

export function setupServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let handled = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const action = controllerChangeAction(hadController, handled, performance.now());
    if (action === "none") return;
    handled = true;
    if (action === "reload") location.reload();
    else markUpdateReady();
  });

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => {});
      // Au retour sur l'onglet : c'est le moment où l'utilisateur revient, et où un décalage de
      // version se verrait. Puis toutes les heures, pour les sessions qui ne quittent jamais.
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) check();
      });
      setInterval(check, UPDATE_INTERVAL_MS);
    },
  });
}
