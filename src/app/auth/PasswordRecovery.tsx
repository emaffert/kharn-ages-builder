import { useState, type FormEvent } from "react";
import { Button, Dialog } from "@ui";
import { useSession } from "./context";

/**
 * Modale imposée au retour d'un lien « mot de passe oublié ».
 *
 * Supabase ouvre déjà la session à ce moment-là : sans cet écran, l'utilisateur se retrouverait
 * connecté sans jamais choisir de nouveau mot de passe, et repartirait avec l'ancien.
 */
export function PasswordRecovery() {
  const { recovering, updatePassword, endRecovery } = useSession();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: message } = await updatePassword(password);
    setBusy(false);
    setError(message);
    if (!message) setPassword("");
  }

  return (
    <Dialog open={recovering} onOpenChange={(open) => !open && endRecovery()} size="sm" title="Nouveau mot de passe">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <p className="text-sm" style={{ color: "var(--bone-dim)" }}>
          Choisis un nouveau mot de passe pour ton compte. Tu es déjà connecté : il remplacera l'ancien
          immédiatement.
        </p>
        <label className="ui-field">
          <span className="ui-field__label">Mot de passe</span>
          <input
            className="ui-input"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error && (
          <p className="ui-error" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={busy || password.length < 6}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
