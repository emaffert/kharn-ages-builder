import type { SupabaseClient } from "@supabase/supabase-js";
import { parseListDocument, type ListDocument } from "@core";

/**
 * Accès à la table `lists` : les listes du joueur, protégées par une RLS owner-only
 * (cf. migration 0001). Chaque ligne porte le `ListDocument` sérialisé en jsonb.
 */

/**
 * Toutes les listes du compte. `null` distingue un échec (serveur injoignable) d'un compte
 * sans aucune liste (`[]`) : dans le premier cas, il ne faut surtout pas conclure que le
 * serveur a été vidé et propager des suppressions.
 */
export async function fetchLists(client: SupabaseClient, userId: string): Promise<ListDocument[] | null> {
  try {
    const { data, error } = await client.from("lists").select("data").eq("user_id", userId);
    if (error || !data) return null;
    const valid: ListDocument[] = [];
    for (const row of data as { data: unknown }[]) {
      try {
        valid.push(parseListDocument(row.data));
      } catch {
        /* ligne corrompue ou d'un schéma obsolète : ignorée plutôt que propagée */
      }
    }
    return valid;
  } catch {
    return null;
  }
}

/** Crée ou remplace une liste côté serveur. Renvoie un message d'erreur, ou null si OK. */
export async function upsertList(
  client: SupabaseClient,
  userId: string,
  doc: ListDocument,
): Promise<string | null> {
  try {
    const { error } = await client
      .from("lists")
      .upsert({ id: doc.id, user_id: userId, data: doc, updated_at: doc.updatedAt });
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : "échec de l'envoi";
  }
}

/** Supprime une liste côté serveur (la RLS garantit qu'on ne touche que les siennes). */
export async function deleteRemoteList(client: SupabaseClient, id: string): Promise<string | null> {
  try {
    const { error } = await client.from("lists").delete().eq("id", id);
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : "échec de la suppression";
  }
}
