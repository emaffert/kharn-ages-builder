import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCatalog, type Catalog } from "@core";

/**
 * Accès à la table `catalog_versions` : historique append-only du catalogue, en lecture
 * publique et en écriture réservée aux admins (RLS, cf. migration 0001).
 *
 * Le catalogue pèse plusieurs Mo (icônes en base64) : la synchro se fait donc en deux temps,
 * un appel léger pour connaître le numéro de la dernière version, puis le téléchargement de
 * la donnée seulement si elle est nouvelle.
 */

/** Repère d'une version publiée, sans sa donnée. */
export type PublishedMeta = { versionId: number; publishedAt: string | null };

/** Version publiée, donnée comprise et validée. */
export type PublishedVersion = PublishedMeta & { version: string; catalog: Catalog };

/**
 * Numéro de la dernière version publiée (quelques octets), ou `null` si le serveur est
 * injoignable ou qu'aucune version n'a encore été publiée.
 */
export async function fetchLatestVersionId(client: SupabaseClient): Promise<PublishedMeta | null> {
  try {
    const { data, error } = await client
      .from("catalog_versions")
      .select("id, published_at")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { id: number; published_at: string | null };
    return { versionId: row.id, publishedAt: row.published_at };
  } catch {
    return null;
  }
}

/**
 * Dernière version publiée avec sa donnée, validée. `null` si le serveur est injoignable,
 * qu'aucune version n'existe, ou que la donnée reçue ne passe pas la validation : un échec
 * n'est jamais bloquant, l'app garde le catalogue dont elle dispose.
 */
export async function fetchPublishedCatalog(client: SupabaseClient): Promise<PublishedVersion | null> {
  try {
    const { data, error } = await client
      .from("catalog_versions")
      .select("id, version, data, published_at")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { id: number; version: string; data: unknown; published_at: string | null };
    return {
      versionId: row.id,
      publishedAt: row.published_at,
      version: row.version,
      catalog: parseCatalog(row.data),
    };
  } catch {
    return null;
  }
}

/** Message d'erreur de publication, traduit pour l'admin. */
function publishErrorMessage(error: { code?: string; message: string }): string {
  // 42501 = insufficient_privilege : la policy RLS a refusé l'insertion (rôle non admin).
  if (error.code === "42501") return "Publication refusée : rôle administrateur requis.";
  if (/failed to fetch|network/i.test(error.message)) return "Serveur injoignable : vérifie ta connexion.";
  return error.message;
}

/**
 * Publie le catalogue courant comme nouvelle version. Le catalogue est revalidé avant envoi :
 * on ne publie jamais une donnée que l'app ne saurait pas relire.
 */
export async function publishCatalog(
  client: SupabaseClient,
  toPublish: Catalog,
  authorId: string,
): Promise<{ published: PublishedMeta | null; error: string | null }> {
  let payload: Catalog;
  try {
    payload = parseCatalog(toPublish);
  } catch (e) {
    return { published: null, error: `Catalogue invalide : ${e instanceof Error ? e.message : "schéma refusé"}` };
  }
  const { data, error } = await client
    .from("catalog_versions")
    .insert({ version: payload.version, data: payload, author_id: authorId })
    .select("id, published_at")
    .single();
  if (error) return { published: null, error: publishErrorMessage(error) };
  const row = data as { id: number; published_at: string | null };
  return { published: { versionId: row.id, publishedAt: row.published_at }, error: null };
}
