import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { SessionContext, type Profile, type SessionStatus, type SessionValue } from "./context";
import { authErrorMessage } from "./errors";

/**
 * Fournit la session (utilisateur + profil + rôle) à toute l'app.
 *
 * Le client est injectable (`client`) : par défaut celui de `lib/supabase`, mais les tests
 * passent un faux client. S'il vaut `null` (pas de `.env`), le provider reste inerte et
 * l'app tourne en local-first, exactement comme avant l'introduction des comptes.
 */
export function SessionProvider({
  children,
  client = supabase,
}: {
  children: ReactNode;
  client?: SupabaseClient | null;
}) {
  // `auth` n'est renseigné qu'une fois le premier événement reçu : jusque-là, on est en
  // cours de restauration de session.
  const [auth, setAuth] = useState<{ user: User | null } | null>(null);
  // Profil mémorisé avec l'utilisateur auquel il appartient : au changement de compte, le
  // profil devient caduc par simple dérivation, sans effet de remise à zéro.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null);
  const [recovering, setRecovering] = useState(false);

  // Restauration de la session + écoute des changements (login, logout, refresh de token,
  // retour d'un lien e-mail). `onAuthStateChange` émet immédiatement l'état initial, ce qui
  // sort du statut `loading` sans appel supplémentaire.
  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      setAuth({ user: session?.user ?? null });
      // Retour d'un lien « mot de passe oublié » : la session est ouverte, mais l'utilisateur
      // doit choisir un nouveau mot de passe avant de reprendre le cours normal.
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      // Volontairement aucun appel Supabase ici : le SDK tient un verrou pendant ce callback
      // et une requête imbriquée peut s'y bloquer. Le profil est chargé par l'effet suivant.
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  const user = client ? (auth?.user ?? null) : null;
  const userId = user?.id ?? null;
  const status: SessionStatus = !client ? "unconfigured" : !auth ? "loading" : user ? "authenticated" : "anonymous";
  const profile = loaded && loaded.userId === userId ? loaded.profile : null;

  // Chargement du profil (pseudo + rôle), rejoué à chaque changement d'utilisateur.
  useEffect(() => {
    if (!client || !userId) return;
    let alive = true;
    void (async () => {
      const { data } = await client.from("profiles").select("id, pseudo, role").eq("id", userId).maybeSingle();
      // La RLS n'autorise que son propre profil : la ligne est soit la sienne, soit absente.
      if (alive) setLoaded({ userId, profile: (data as Profile | null) ?? null });
    })();
    return () => {
      alive = false;
    };
  }, [client, userId]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!client) return { error: "Authentification indisponible." };
      const { error } = await client.auth.signInWithPassword({ email, password });
      return { error: authErrorMessage(error) };
    },
    [client],
  );

  const signUp = useCallback(
    async (email: string, password: string, pseudo: string) => {
      if (!client) return { error: "Authentification indisponible.", needsConfirmation: false };
      // `pseudo` est repris par le trigger `handle_new_user` pour créer la ligne `profiles`.
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { pseudo } },
      });
      // Sans session en retour, Supabase attend la confirmation de l'adresse e-mail.
      return { error: authErrorMessage(error), needsConfirmation: !error && !data?.session };
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
  }, [client]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      if (!client) return { error: "Authentification indisponible." };
      // Le lien doit revenir sur l'app, sous-chemin compris (GitHub Pages sert sous /<dépôt>/).
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      return { error: authErrorMessage(error) };
    },
    [client],
  );

  const updatePassword = useCallback(
    async (password: string) => {
      if (!client) return { error: "Authentification indisponible." };
      const { error } = await client.auth.updateUser({ password });
      if (!error) setRecovering(false);
      return { error: authErrorMessage(error) };
    },
    [client],
  );

  const updatePseudo = useCallback(
    async (pseudo: string) => {
      if (!client || !userId) return { error: "Authentification indisponible." };
      // Seule la colonne `pseudo` est accordée à `authenticated` : le rôle reste hors de portée.
      const { error } = await client.from("profiles").update({ pseudo }).eq("id", userId);
      if (error) return { error: error.message };
      setLoaded((prev) => (prev && prev.userId === userId && prev.profile ? { ...prev, profile: { ...prev.profile, pseudo } } : prev));
      return { error: null };
    },
    [client, userId],
  );

  const deleteAccount = useCallback(async () => {
    if (!client) return { error: "Authentification indisponible." };
    // La suppression de `auth.users` passe par une fonction serveur : le navigateur n'a pas
    // (et ne doit pas avoir) les droits sur le schéma `auth`. Cf. migration 0003.
    const { error } = await client.rpc("delete_account");
    if (error) return { error: error.message };
    await client.auth.signOut();
    return { error: null };
  }, [client]);

  const endRecovery = useCallback(() => setRecovering(false), []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      profile,
      isAdmin: profile?.role === "admin",
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updatePseudo,
      deleteAccount,
      recovering,
      endRecovery,
    }),
    [
      status,
      user,
      profile,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updatePseudo,
      deleteAccount,
      recovering,
      endRecovery,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
