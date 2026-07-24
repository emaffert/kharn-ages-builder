import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase partagé (auth + Data API).
 *
 * Les variables sont lues dans `import.meta.env` (fichier `.env.local`). Si elles sont absentes,
 * `supabase` vaut `null` : l'app continue de fonctionner en local-first (Dexie) sans backend, et
 * toute la feature « comptes/synchro » reste inerte. On ne fait donc jamais planter le build ni les
 * tests faute de configuration.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Vrai si les variables d'environnement Supabase sont présentes. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, publishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Récupère la session portée par l'URL au retour d'un lien e-mail (confirmation de
        // compte, réinitialisation de mot de passe) ou d'un futur login OAuth.
        detectSessionInUrl: true,
      },
    })
  : null;
