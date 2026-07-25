import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

/** Rôle porté par `profiles.role` (cf. migration 0001). */
export type Role = "user" | "admin";

/** Profil applicatif, miroir de la table `profiles` (seules les colonnes utiles à l'UI). */
export type Profile = { id: string; pseudo: string | null; role: Role };

/**
 * État d'authentification.
 * - `unconfigured` : aucun backend Supabase (`.env` absent) → l'app reste en local-first,
 *   l'UI de comptes est masquée et l'admin garde son accès libre d'avant les comptes.
 * - `loading` : session en cours de restauration (au démarrage, ou retour d'un lien e-mail).
 */
export type SessionStatus = "unconfigured" | "loading" | "anonymous" | "authenticated";

/** Résultat d'une action d'auth : `error` est un message déjà traduit, prêt à afficher. */
export type AuthResult = { error: string | null };

export type SessionValue = {
  status: SessionStatus;
  user: User | null;
  /** `null` tant que le profil n'est pas encore chargé, même si `status` vaut `authenticated`. */
  profile: Profile | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** `needsConfirmation` : compte créé mais e-mail à confirmer (aucune session ouverte). */
  signUp: (email: string, password: string, pseudo: string) => Promise<AuthResult & { needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** Envoie le lien de réinitialisation de mot de passe à l'adresse donnée. */
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  /** Définit un nouveau mot de passe pour la session en cours. */
  updatePassword: (password: string) => Promise<AuthResult>;
  updatePseudo: (pseudo: string) => Promise<AuthResult>;
  /** Supprime définitivement le compte et tout ce qui s'y rattache, puis déconnecte. */
  deleteAccount: () => Promise<AuthResult>;
  /** Vrai au retour d'un lien de réinitialisation : un nouveau mot de passe est attendu. */
  recovering: boolean;
  endRecovery: () => void;
};

const unavailable = async () => ({ error: "Authentification indisponible." });

/**
 * Valeur par défaut : « pas de backend ». Elle rend les composants d'auth utilisables
 * hors provider (tests unitaires, rendus isolés) sans jamais planter.
 */
export const DEFAULT_SESSION: SessionValue = {
  status: "unconfigured",
  user: null,
  profile: null,
  isAdmin: false,
  signIn: unavailable,
  signUp: async () => ({ error: "Authentification indisponible.", needsConfirmation: false }),
  signOut: async () => {},
  requestPasswordReset: unavailable,
  updatePassword: unavailable,
  updatePseudo: unavailable,
  deleteAccount: unavailable,
  recovering: false,
  endRecovery: () => {},
};

export const SessionContext = createContext<SessionValue>(DEFAULT_SESSION);

/** Accès à la session courante (voir `SessionProvider`). */
export function useSession(): SessionValue {
  return useContext(SessionContext);
}
