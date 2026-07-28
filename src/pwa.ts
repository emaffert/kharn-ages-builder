import { registerSW } from "virtual:pwa-register";

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
 * Faut-il recharger la page quand le worker qui la contrôle change ?
 *
 * Deux gardes : à la toute première installation il n'y avait aucun contrôleur, et la page tourne
 * déjà sur le bon code - recharger serait un clignotement gratuit à la première visite. Et un
 * rechargement déjà lancé ne doit pas se relancer.
 */
export function shouldReloadOnControllerChange(hadController: boolean, alreadyReloading: boolean): boolean {
  return hadController && !alreadyReloading;
}

export function setupServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldReloadOnControllerChange(hadController, reloading)) return;
    reloading = true;
    location.reload();
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
