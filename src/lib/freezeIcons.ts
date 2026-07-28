import type { Catalog } from "@core";
import { ICON_BUCKET, iconName, isMirrored } from "./icons";
import { supabase } from "./supabase";

/**
 * « Figer les icônes » : matérialise dans le dépôt les portraits qui n'y sont pas encore.
 *
 * Deux origines possibles pour une icône absente du miroir, et cette étape est ce qui les fait
 * converger :
 *
 * - créée depuis l'admin déployé, elle n'existe que dans le **bucket** : on la retélécharge ;
 * - créée en dev sans backend, elle est restée en **data-URI** dans le catalogue : on la décode,
 *   et sa référence remplace la data-URI, qui disparaît du fichier.
 *
 * Sans cette étape, le `catalog.json` committé citerait des images que le dépôt ne sert pas : elles
 * s'afficheraient tant que le bucket répond, et disparaîtraient hors-ligne ou à la première visite.
 *
 * Réservé au développement : l'écriture passe par `/__save-icons`, qui n'existe pas en production.
 */

/** Emplacements du schéma qui portent une référence d'icône. */
function refsOf(cat: Catalog): string[] {
  return [
    ...Object.values(cat.icons ?? {}),
    ...cat.profiles.map((p) => p.icon),
    ...cat.mounts.map((m) => m.icon),
  ].filter((ref): ref is string => ref != null);
}

/** Applique un remplacement de références (data-URI -> nom) aux trois emplacements. */
function rewriteRefs(cat: Catalog, renamed: Map<string, string>): Catalog {
  if (renamed.size === 0) return cat;
  const swap = <T extends { icon?: string }>(entity: T): T =>
    entity.icon && renamed.has(entity.icon) ? { ...entity, icon: renamed.get(entity.icon) } : entity;
  return {
    ...cat,
    icons: Object.fromEntries(
      Object.entries(cat.icons ?? {}).map(([card, ref]) => [card, renamed.get(ref) ?? ref]),
    ),
    profiles: cat.profiles.map(swap),
    mounts: cat.mounts.map(swap),
  };
}

/** Encode des octets en base64, par tranches pour ne pas saturer la pile d'appels. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export type FreezeResult = {
  /** Catalogue à enregistrer : identique à l'entrée, sauf si des data-URI ont été remplacées. */
  catalog: Catalog;
  /** Nombre d'icônes écrites dans `src/assets/icons/`. */
  written: number;
  /** Message d'échec, ou `null`. En cas d'échec le catalogue rendu est celui d'entrée, inchangé. */
  error: string | null;
};

export async function freezeIcons(cat: Catalog): Promise<FreezeResult> {
  const unchanged = (error: string | null): FreezeResult => ({ catalog: cat, written: 0, error });

  // Une même icône peut être citée par plusieurs profils : on ne la traite qu'une fois.
  const pending = new Set(refsOf(cat).filter((ref) => ref.startsWith("data:") || !isMirrored(ref)));
  if (pending.size === 0) return unchanged(null);

  const files: { name: string; base64: string }[] = [];
  const renamed = new Map<string, string>();

  for (const ref of pending) {
    let bytes: Uint8Array;
    if (ref.startsWith("data:")) {
      // `fetch` sur une data-URI : le décodage base64 est fait par le navigateur.
      bytes = new Uint8Array(await (await fetch(ref)).arrayBuffer());
      renamed.set(ref, await iconName(bytes.buffer as ArrayBuffer));
    } else {
      if (!supabase) return unchanged(`Icône ${ref} absente du dépôt et aucun backend pour la récupérer.`);
      const url = supabase.storage.from(ICON_BUCKET).getPublicUrl(ref).data.publicUrl;
      const response = await fetch(url);
      if (!response.ok) return unchanged(`Icône ${ref} introuvable dans le bucket (HTTP ${response.status}).`);
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    files.push({ name: renamed.get(ref) ?? ref, base64: toBase64(bytes) });
  }

  try {
    const res = await fetch("/__save-icons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(files),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return unchanged(body.error ?? `HTTP ${res.status}`);
    }
  } catch (e) {
    return unchanged(e instanceof Error ? e.message : "écriture des icônes impossible");
  }

  return { catalog: rewriteRefs(cat, renamed), written: files.length, error: null };
}
