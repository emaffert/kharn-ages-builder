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

/**
 * Faut-il **annoncer** une nouvelle version quand le worker qui contrôle la page change ?
 *
 * Deux gardes : à la toute première installation il n'y avait aucun contrôleur, et la page tourne
 * déjà sur le bon code - l'annoncer serait un faux message à la première visite. Et une annonce
 * déjà faite ne se répète pas.
 */
export function shouldReloadOnControllerChange(hadController: boolean, alreadyAnnounced: boolean): boolean {
  return hadController && !alreadyAnnounced;
}

export function setupServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let announced = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldReloadOnControllerChange(hadController, announced)) return;
    announced = true;
    // Annoncée, pas appliquée : une liste en cours n'existe que dans la page, et un rechargement
    // décidé par le site l'effacerait. L'application affiche l'invitation, l'utilisateur décide.
    markUpdateReady();
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
