import { useState, type FormEvent } from "react";
import { Button, Dialog } from "@ui";
import { purgeCachedLists } from "../io/listsDb";
import { useSession } from "./context";

/** Mot à saisir pour confirmer la suppression : un clic seul ne doit pas suffire. */
const DELETE_WORD = "SUPPRIMER";

/**
 * Réglages du compte : pseudo d'affichage et suppression définitive.
 *
 * La suppression efface le compte côté serveur (les listes suivent par cascade) puis vide le
 * cache local de ce compte : ne rien nettoyer ici laisserait les listes réapparaître sur cet
 * appareil, et remonter vers le prochain compte connecté.
 */
export function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, profile, updatePseudo, deleteAccount } = useSession();
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");

  /**
   * Fermer la modale désarme la suppression : sans cela, une zone de confirmation laissée
   * remplie resterait active à la réouverture, et un seul clic suffirait à tout effacer.
   */
  function setOpen(next: boolean) {
    if (!next) {
      setConfirmingDelete(false);
      setConfirmWord("");
      setError(null);
      setNotice(null);
    }
    onOpenChange(next);
  }

  async function savePseudo(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: message } = await updatePseudo(pseudo.trim());
    setBusy(false);
    if (message) setError(message);
    else setNotice("Pseudo mis à jour.");
  }

  async function confirmDelete() {
    const userId = user?.id;
    setBusy(true);
    setError(null);
    const { error: message } = await deleteAccount();
    if (message) {
      setBusy(false);
      setError(message);
      return;
    }
    if (userId) await purgeCachedLists(userId).catch(() => {});
    setBusy(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} size="sm" title="Mon compte">
      <div className="flex flex-col gap-5">
        <form className="flex flex-col gap-3" onSubmit={savePseudo}>
          <label className="ui-field">
            <span className="ui-field__label">Pseudo</span>
            <input
              className="ui-input"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              autoComplete="nickname"
            />
          </label>
          <p className="text-xs" style={{ color: "var(--bone-faint)" }}>
            Connecté avec {user?.email}. L'adresse ne peut pas être modifiée ici.
          </p>
          {error && (
            <p className="ui-error" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="ui-notice">{notice}</p>}
          <div>
            <Button type="submit" variant="primary" size="sm" disabled={busy || pseudo.trim() === ""}>
              Enregistrer
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-3" style={{ borderTop: "1px solid var(--hair)", paddingTop: 16 }}>
          {!confirmingDelete ? (
            <>
              <p className="text-xs" style={{ color: "var(--bone-faint)" }}>
                Supprimer ton compte efface définitivement tes listes, sur tous tes appareils.
              </p>
              <div>
                <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                  Supprimer mon compte
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="ui-error">
                Action irréversible : le compte et toutes ses listes seront perdus. Saisis {DELETE_WORD} pour
                confirmer.
              </p>
              <input
                className="ui-input"
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                aria-label={`Saisir ${DELETE_WORD} pour confirmer`}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={confirmDelete}
                  disabled={busy || confirmWord.trim() !== DELETE_WORD}
                >
                  Supprimer définitivement
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
