import { useState } from "react";
import { Button, Popover, Tag } from "@ui";
import { AuthDialog } from "./AuthDialog";
import { useSession } from "./context";

/** Nom d'affichage : le pseudo s'il est connu, sinon la partie locale de l'e-mail. */
function displayName(pseudo: string | null | undefined, email: string | undefined) {
  return pseudo?.trim() || email?.split("@")[0] || "Compte";
}

/**
 * Zone « compte » de la barre supérieure : bouton de connexion quand personne n'est
 * connecté, pseudo + menu (rôle, déconnexion) sinon. Rien du tout si l'app tourne sans
 * backend (`unconfigured`) : la feature comptes n'existe alors pas.
 */
export function AccountMenu() {
  const { status, user, profile, isAdmin, signOut } = useSession();
  const [authOpen, setAuthOpen] = useState(false);

  if (status === "unconfigured") return null;

  if (status === "loading") {
    return (
      <span className="kh-account__loading" aria-live="polite">
        …
      </span>
    );
  }

  if (status === "anonymous") {
    return (
      <>
        <Button size="sm" onClick={() => setAuthOpen(true)}>
          Se connecter
        </Button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  const name = displayName(profile?.pseudo, user?.email);
  return (
    <Popover
      trigger={
        <button type="button" className="kh-account" aria-label={`Compte de ${name}`}>
          <span className="kh-account__avatar" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="kh-account__name">{name}</span>
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-xs" style={{ color: "var(--bone-faint)" }}>
            {user?.email}
          </div>
        </div>
        {isAdmin && <Tag tone="amber">Administrateur</Tag>}
        <Button size="sm" onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    </Popover>
  );
}
