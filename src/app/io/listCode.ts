import { parseListDocument, type Catalog, type ListDocument } from "@core";

/**
 * Code portable d'une liste : JSON **compressé** (deflate-raw, API native `CompressionStream`)
 * puis encodé en base64url. La compression raccourcit fortement le code (JSON très répétitif),
 * sans dépendance. Le décodage valide via Zod (parseListDocument).
 */

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as Uint8Array<ArrayBuffer>);
  void writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

const PREFIX = "KA1:"; // versionne le format du code (KA1 = deflate + base64url)

export async function encodeList(doc: ListDocument): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(doc));
  const deflated = await pipe(json, new CompressionStream("deflate-raw"));
  return PREFIX + toBase64Url(deflated);
}

/**
 * Vérifie qu'une liste importée est compatible avec le catalogue courant.
 * Renvoie des avertissements (non bloquants) : version de catalogue différente, profils inconnus.
 */
export function checkImportedList(cat: Catalog, doc: ListDocument): string[] {
  const warnings: string[] = [];
  if (doc.catalogVersion !== cat.version) {
    warnings.push(`Version de catalogue différente (liste : ${doc.catalogVersion}, actuelle : ${cat.version}).`);
  }
  const known = new Set(cat.profiles.map((p) => p.id));
  const unknown = new Set<string>();
  for (const fdl of doc.fersDeLance) for (const m of fdl.members) if (!known.has(m.profileId)) unknown.add(m.profileId);
  if (unknown.size > 0) warnings.push(`Profils inconnus (ignorés) : ${[...unknown].join(", ")}.`);
  return warnings;
}

/** Décode + valide un code portable. Lève une erreur explicite si invalide. */
export async function decodeList(code: string): Promise<ListDocument> {
  const trimmed = code.trim();
  const body = trimmed.startsWith(PREFIX) ? trimmed.slice(PREFIX.length) : trimmed;
  const inflated = await pipe(fromBase64Url(body), new DecompressionStream("deflate-raw"));
  return parseListDocument(JSON.parse(new TextDecoder().decode(inflated)));
}
