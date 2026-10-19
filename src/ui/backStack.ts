import { useEffect, useRef } from "react";

/**
 * Pile des couches (écran de liste, fenêtres) que le bouton retour du téléphone ou du navigateur
 * referme une à une avant de quitter le site. Chaque couche ouverte pose une entrée d'historique ;
 * la refermer par l'interface retire cette entrée, si bien que l'historique ne garde jamais plus
 * d'entrées que de couches ouvertes.
 */

type Layer = { onBack: () => boolean | void };

const stack: Layer[] = [];
/** Entrées à retirer, regroupées en un seul `history.go` à la fin de la tâche en cours. */
let pendingBack = 0;
/** Retours lancés par nous dont l'événement `popstate` n'est pas encore arrivé. */
let ownTraversals = 0;
/** Poses d'entrée différées le temps qu'un de nos retours aboutisse. */
const deferredPushes: (() => void)[] = [];
let listening = false;

function pushEntry() {
  window.history.pushState({ khLayer: stack.length }, "");
}

function flushBack() {
  const n = pendingBack;
  pendingBack = 0;
  if (n === 0) return;
  ownTraversals++;
  window.history.go(-n);
}

function onPopState() {
  if (ownTraversals > 0) {
    ownTraversals--;
    if (ownTraversals === 0) deferredPushes.splice(0).forEach((push) => push());
    return;
  }
  const top = stack.pop();
  if (!top) return;
  // Une couche peut refuser de se fermer (liste non sauvegardée) : elle reste, avec son entrée.
  if (top.onBack() === false) {
    stack.push(top);
    pushEntry();
  }
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", onPopState);
}

/**
 * pushLayer ouvre une couche que le bouton retour refermera en appelant `onBack` ; `onBack` peut
 * renvoyer false pour la garder ouverte. Renvoie la fonction à appeler quand la couche se ferme
 * par l'interface, qui retire son entrée d'historique (sans effet si le retour l'a déjà fermée).
 */
export function pushLayer(onBack: () => boolean | void): () => void {
  listen();
  const layer: Layer = { onBack };
  stack.push(layer);
  if (pendingBack > 0) {
    // Une couche fermée dans la même tâche libère une entrée encore présente : on la réutilise.
    pendingBack--;
    window.history.replaceState({ khLayer: stack.length }, "");
  } else if (ownTraversals > 0) {
    deferredPushes.push(pushEntry);
  } else {
    pushEntry();
  }
  return () => {
    const i = stack.indexOf(layer);
    if (i === -1) return;
    stack.splice(i, 1);
    if (pendingBack++ === 0) queueMicrotask(flushBack);
  };
}

/**
 * resetStaleLayers retire les entrées laissées par des couches d'avant un rechargement de la page :
 * les couches ont disparu avec lui, leurs entrées non.
 */
export function resetStaleLayers(): void {
  const depth = (window.history.state as { khLayer?: number } | null)?.khLayer ?? 0;
  if (depth > 0 && stack.length === 0) {
    listen();
    ownTraversals++;
    window.history.go(-depth);
  }
}

/** useBackLayer tient une couche ouverte tant que `active` est vrai (voir `pushLayer`). */
export function useBackLayer(active: boolean, onBack: () => boolean | void): void {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    return pushLayer(() => onBackRef.current());
  }, [active]);
}
