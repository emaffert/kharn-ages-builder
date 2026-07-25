import type { SyncState } from "./useSavedLists";

const LABEL: Record<SyncState, { text: string; hint: string }> = {
  local: {
    text: "Sur cet appareil",
    hint: "Tes listes ne sont enregistrées que dans ce navigateur. Connecte-toi pour les retrouver sur tous tes appareils.",
  },
  syncing: { text: "Synchronisation…", hint: "Échange en cours avec ton compte." },
  synced: { text: "Synchronisé", hint: "Tes listes sont à jour sur ton compte." },
  offline: {
    text: "Hors-ligne",
    hint: "Serveur injoignable : tes listes restent enregistrées ici et repartiront à la prochaine connexion.",
  },
};

/** Où en est la bibliothèque de listes vis-à-vis du compte. */
export function SyncBadge({ state }: { state: SyncState }) {
  const { text, hint } = LABEL[state];
  return (
    <span className="fs-sync" data-state={state} title={hint}>
      {text}
    </span>
  );
}
