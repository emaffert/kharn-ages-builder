import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Résolution des icônes de profil/monture.
 *
 * Le catalogue ne transporte plus les images : il ne garde qu'une **référence** adressée par
 * contenu, `<hash>.webp`. Les octets viennent de deux sources qui portent, par construction, le
 * même nom pour le même contenu :
 *
 * 1. le **miroir du dépôt** (`src/assets/icons/`), émis par Vite en assets hashés et précaché par
 *    le service worker : disponible hors-ligne, y compris à la toute première visite ;
 * 2. le **bucket Supabase**, alimenté par l'éditeur d'icône de l'admin : c'est par là qu'arrive
 *    une icône créée depuis l'app déployée, sans attendre un redéploiement.
 *
 * On préfère le miroir quand il connaît la référence - non pas qu'il « gagne » (les octets sont
 * identiques), mais parce qu'il ne coûte aucune requête et fonctionne sans réseau. Le bucket sert
 * donc exactement les icônes plus récentes que le dernier `catalog.json` committé.
 */

/** Bucket public des icônes (cf. migration 0004). */
export const ICON_BUCKET = "catalog-icons";

/**
 * Miroir local, indexé par nom de fichier. `eager` : la table de correspondance doit être prête
 * au premier rendu, et il ne s'agit que d'URLs, pas des images elles-mêmes.
 */
const mirror = new Map<string, string>(
  Object.entries(
    import.meta.glob<string>("../assets/icons/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1), url]),
);

/** Nombre d'icônes présentes dans le miroir du dépôt (diagnostic admin). */
export function mirroredIconCount(): number {
  return mirror.size;
}

/** Miroir du dépôt, énuméré : nom de référence et URL de l'asset buildé. */
export function mirroredIcons(): { name: string; url: string }[] {
  return Array.from(mirror, ([name, url]) => ({ name, url }));
}

/** La référence est-elle servie par le miroir du dépôt (donc valable hors-ligne) ? */
export function isMirrored(ref: string): boolean {
  return mirror.has(ref);
}

/**
 * URL affichable pour une référence d'icône, ou `undefined` s'il n'y a rien à afficher.
 *
 * Les data-URI sont rendues telles quelles : les versions publiées avant la sortie des images du
 * catalogue en contiennent encore, et l'historique en conserve dix. Sans ce cas, revenir sur une
 * ancienne version afficherait un catalogue sans aucun portrait.
 */
export function iconSrc(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith("data:")) return ref;
  const local = mirror.get(ref);
  if (local) return local;
  // Pas de backend configuré (cf. `supabase.ts`) : l'app reste utilisable, sans cette icône.
  if (!supabase) return undefined;
  return supabase.storage.from(ICON_BUCKET).getPublicUrl(ref).data.publicUrl;
}

/**
 * Nom adressé par contenu : 16 hex du SHA-256 des octets, plus l'extension.
 *
 * 64 bits suffisent très largement ici (quelques centaines d'icônes) et gardent le catalogue
 * lisible. Le script de conversion applique la **même** règle côté Node : les deux doivent rester
 * d'accord, sinon une icône déjà téléversée serait réenvoyée sous un autre nom.
 */
export async function iconName(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 16)}.webp`;
}

// ── Opérations sur le bucket (admin) ────────────────────────────────────────

/** Erreur d'accès au bucket, traduite pour l'admin. */
function bucketErrorMessage(message: string): string {
  // Le Storage renvoie un 403 générique quand la policy refuse : l'utilisateur n'est pas admin.
  if (/row-level security|not authorized|403/i.test(message)) {
    return "Refusé : rôle administrateur requis.";
  }
  if (/failed to fetch|network/i.test(message)) return "Serveur injoignable : vérifie ta connexion.";
  return message;
}

/**
 * Dépose une icône dans le bucket et rend sa référence.
 *
 * `upsert` : le nom étant le hash du contenu, réenvoyer la même icône vise le même objet avec des
 * octets identiques. C'est un cas normal (recadrage refait à l'identique), pas un conflit.
 * `cacheControl` très long : un objet adressé par contenu ne change jamais.
 */
export async function uploadIcon(
  client: SupabaseClient,
  bytes: ArrayBuffer,
): Promise<{ name: string | null; error: string | null }> {
  const name = await iconName(bytes);
  const { error } = await client.storage.from(ICON_BUCKET).upload(name, bytes, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) return { name: null, error: bucketErrorMessage(error.message) };
  return { name, error: null };
}

/**
 * Noms présents dans le bucket. `null` si le bucket est inaccessible - à distinguer d'un bucket
 * vide, qui ferait conclure à tort que tout est à téléverser.
 */
export async function listBucketIcons(client: SupabaseClient): Promise<Set<string> | null> {
  const names = new Set<string>();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage.from(ICON_BUCKET).list("", { limit: PAGE, offset });
    if (error) return null;
    for (const row of data ?? []) names.add(row.name);
    if (!data || data.length < PAGE) return names;
  }
}

/**
 * Téléverse les icônes du miroir absentes du bucket. C'est l'outil de la migration initiale (le
 * dépôt sait tout, le bucket est vide) autant que l'entretien courant, quand une version publiée
 * pourrait citer une référence que le bucket ne sert pas encore.
 */
export async function syncMirrorToBucket(
  client: SupabaseClient,
  onProgress?: (done: number, total: number) => void,
): Promise<{ uploaded: number; error: string | null }> {
  const present = await listBucketIcons(client);
  if (!present) return { uploaded: 0, error: "Bucket illisible : vérifie que la migration 0004 est appliquée." };
  const missing = mirroredIcons().filter((icon) => !present.has(icon.name));
  let uploaded = 0;
  for (const icon of missing) {
    // L'asset est servi par le même origin que l'app (dev comme build) : pas de CORS ici.
    const response = await fetch(icon.url);
    if (!response.ok) return { uploaded, error: `Icône ${icon.name} illisible dans le miroir.` };
    const { error } = await uploadIcon(client, await response.arrayBuffer());
    if (error) return { uploaded, error };
    uploaded++;
    onProgress?.(uploaded, missing.length);
  }
  return { uploaded, error: null };
}

/** Une icône du bucket que plus aucune version conservée ne cite. */
export type OrphanIcon = { name: string; createdAt: string; size: number };

/**
 * Icônes orphelines, telles que les calcule le serveur (cf. migration 0004). `grace` protège les
 * icônes déposées mais pas encore publiées : elles sont légitimement sans référence.
 */
export async function fetchOrphanIcons(
  client: SupabaseClient,
  graceDays = 30,
): Promise<{ orphans: OrphanIcon[] | null; error: string | null }> {
  const { data, error } = await client.rpc("orphan_icon_names", { grace: `${graceDays} days` });
  if (error) return { orphans: null, error: bucketErrorMessage(error.message) };
  const rows = (data ?? []) as { name: string; created_at: string; size: number | null }[];
  return {
    orphans: rows.map((r) => ({ name: r.name, createdAt: r.created_at, size: r.size ?? 0 })),
    error: null,
  };
}

/**
 * Supprime des icônes du bucket. On passe par l'API Storage et non par du SQL : supprimer la ligne
 * de `storage.objects` retirerait la métadonnée sans libérer le fichier.
 */
export async function removeIcons(client: SupabaseClient, names: string[]): Promise<string | null> {
  if (names.length === 0) return null;
  const { error } = await client.storage.from(ICON_BUCKET).remove(names);
  return error ? bucketErrorMessage(error.message) : null;
}
