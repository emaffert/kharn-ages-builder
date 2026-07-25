import { useState, type FormEvent } from "react";
import { Button, Dialog, SegmentedControl } from "@ui";
import { useSession } from "./context";

type Mode = "signin" | "signup";

const MODES = [
  { value: "signin" as const, label: "Connexion" },
  { value: "signup" as const, label: "Inscription" },
];

/**
 * Modale de connexion / inscription (e-mail + mot de passe).
 *
 * Le pseudo saisi à l'inscription est transmis dans les métadonnées du compte : c'est le
 * trigger `handle_new_user` qui crée la ligne `profiles` correspondante côté serveur.
 */
export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "signin") {
      const { error: message } = await signIn(email.trim(), password);
      setError(message);
      // Le succès ferme la modale : la session change et la barre affiche le compte.
      if (!message) onOpenChange(false);
    } else {
      const { error: message, needsConfirmation } = await signUp(email.trim(), password, pseudo.trim());
      setError(message);
      if (!message) {
        // Sans confirmation d'e-mail requise, la session est déjà ouverte : on ferme.
        if (needsConfirmation) {
          setNotice("Compte créé. Confirme ton adresse e-mail depuis le message qu'on vient de t'envoyer.");
        } else {
          onOpenChange(false);
        }
      }
    }
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={mode === "signin" ? "Se connecter" : "Créer un compte"}
      description="Connexion au compte Khârn-Âges pour retrouver ses listes sur tous ses appareils."
    >
      <div className="flex flex-col gap-4">
        {/* Enveloppé : en enfant direct de la colonne flex, le contrôle segmenté serait étiré. */}
        <div>
          <SegmentedControl options={MODES} value={mode} onChange={switchMode} ariaLabel="Connexion ou inscription" />
        </div>

        <form className="flex flex-col gap-3" onSubmit={submit}>
          {mode === "signup" && (
            <label className="ui-field">
              <span className="ui-field__label">Pseudo</span>
              <input
                className="ui-input"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                autoComplete="nickname"
                placeholder="Nom affiché"
              />
            </label>
          )}
          <label className="ui-field">
            <span className="ui-field__label">E-mail</span>
            <input
              className="ui-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Mot de passe</span>
            <input
              className="ui-input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {error && (
            <p className="ui-error" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="ui-notice">{notice}</p>}

          <Button type="submit" variant="primary" disabled={busy}>
            {mode === "signin" ? "Se connecter" : "Créer le compte"}
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
