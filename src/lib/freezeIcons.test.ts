import { afterEach, describe, expect, it, vi } from "vitest";
import { catalog } from "@data";
import type { Catalog } from "@core";

/**
 * Gel des icônes : ce qui garantit que `catalog.json` ne cite jamais un portrait que le dépôt ne
 * sert pas. Le module lit son miroir au chargement, d'où le rechargement par cas.
 *
 * Le catalogue réel sert de base, mais chaque cas ne garde que les emplacements qu'il observe :
 * les références réelles sont toutes déjà dans le miroir, donc sans intérêt à figer.
 */

const BUCKET_URL = "https://exemple.supabase.co/storage/v1/object/public/catalog-icons/";
// WebP minimal (12 octets) : le contenu importe peu, seule sa constance compte.
const WEBP = "data:image/webp;base64,UklGRgoAAABXRUJQVlA4TA0AAAA=";

async function loadModule(withClient = true) {
  vi.resetModules();
  vi.doMock("./supabase", () => ({
    supabase: withClient
      ? {
          storage: {
            from: () => ({ getPublicUrl: (name: string) => ({ data: { publicUrl: BUCKET_URL + name } }) }),
          },
        }
      : null,
    isSupabaseConfigured: withClient,
  }));
  return await import("./freezeIcons");
}

/** Catalogue réduit aux emplacements d'icône du cas, pour ne pas traîner les 80 vraies références. */
function catalogWith(over: {
  icons?: Record<string, string>;
  profileIcon?: string;
  mountIcon?: string;
}): Catalog {
  return {
    ...catalog,
    icons: over.icons ?? {},
    profiles: [{ ...catalog.profiles[0], icon: over.profileIcon }],
    mounts: [{ ...catalog.mounts[0], icon: over.mountIcon }],
  };
}

/** Intercepte `/__save-icons` et les téléchargements, et rend ce qui a été posté. */
function stubNetwork({ saveOk = true, bucketOk = true } = {}) {
  const posted: { name: string; base64: string }[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: { body?: string }) => {
      if (input === "/__save-icons") {
        if (!saveOk) return { ok: false, status: 400, json: async () => ({ error: "disque plein" }) };
        posted.push(JSON.parse(init?.body ?? "[]"));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (!bucketOk) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
      // Data-URI comme URL de bucket : les deux se lisent en octets de la même façon.
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer };
    }),
  );
  return posted;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("./supabase");
  vi.resetModules();
});

describe("freezeIcons", () => {
  it("ne fait rien quand tout est déjà dans le dépôt", async () => {
    const { freezeIcons } = await loadModule();
    const posted = stubNetwork();
    // Le catalogue committé, dont l'invariant garantit que toutes les références sont miroir.
    const result = await freezeIcons(catalog);

    expect(result.error).toBeNull();
    expect(result.written).toBe(0);
    expect(result.catalog).toBe(catalog);
    expect(posted).toEqual([]);
  });

  it("remplace une data-URI par une référence et écrit le fichier", async () => {
    const { freezeIcons } = await loadModule();
    const posted = stubNetwork();
    const cat = catalogWith({ icons: { "cards/x.jpg": WEBP } });

    const result = await freezeIcons(cat);

    expect(result.error).toBeNull();
    expect(result.written).toBe(1);
    const ref = result.catalog.icons!["cards/x.jpg"];
    expect(ref).toMatch(/^[0-9a-f]{16}\.webp$/);
    expect(posted[0]).toHaveLength(1);
    expect(posted[0][0].name).toBe(ref);
  });

  it("fige aussi les dérogations de profil et de monture", async () => {
    const { freezeIcons } = await loadModule();
    stubNetwork();
    const cat = catalogWith({ profileIcon: WEBP, mountIcon: WEBP });

    const result = await freezeIcons(cat);

    expect(result.catalog.profiles[0].icon).toMatch(/^[0-9a-f]{16}\.webp$/);
    expect(result.catalog.mounts[0].icon).toMatch(/^[0-9a-f]{16}\.webp$/);
    // Contenu identique => même nom => un seul fichier écrit pour les deux emplacements.
    expect(result.written).toBe(1);
    expect(result.catalog.profiles[0].icon).toBe(result.catalog.mounts[0].icon);
  });

  it("retélécharge une référence connue du bucket mais absente du dépôt", async () => {
    const { freezeIcons } = await loadModule();
    const posted = stubNetwork();
    const cat = catalogWith({ icons: { "cards/x.jpg": "abcdef0123456789.webp" } });

    const result = await freezeIcons(cat);

    expect(result.error).toBeNull();
    expect(result.written).toBe(1);
    expect(posted[0][0].name).toBe("abcdef0123456789.webp");
    // Une référence déjà nommée n'est pas renommée, seulement matérialisée.
    expect(result.catalog.icons!["cards/x.jpg"]).toBe("abcdef0123456789.webp");
  });

  it("échoue sans rien modifier quand le bucket ne rend pas l'image", async () => {
    const { freezeIcons } = await loadModule();
    stubNetwork({ bucketOk: false });
    const cat = catalogWith({ icons: { "cards/x.jpg": "abcdef0123456789.webp" } });

    const result = await freezeIcons(cat);

    expect(result.error).toMatch(/introuvable dans le bucket/);
    expect(result.written).toBe(0);
    expect(result.catalog).toBe(cat);
  });

  it("échoue sans rien modifier quand l'écriture disque est refusée", async () => {
    const { freezeIcons } = await loadModule();
    stubNetwork({ saveOk: false });
    const cat = catalogWith({ icons: { "cards/x.jpg": WEBP } });

    const result = await freezeIcons(cat);

    expect(result.error).toBe("disque plein");
    // Le catalogue rendu est celui d'entrée : on n'enregistre pas des références sans fichiers.
    expect(result.catalog).toBe(cat);
    expect(result.catalog.icons!["cards/x.jpg"]).toBe(WEBP);
  });

  it("refuse de figer une référence de bucket sans backend configuré", async () => {
    const { freezeIcons } = await loadModule(false);
    stubNetwork();
    const cat = catalogWith({ icons: { "cards/x.jpg": "abcdef0123456789.webp" } });

    const result = await freezeIcons(cat);

    expect(result.error).toMatch(/aucun backend/i);
    expect(result.written).toBe(0);
  });
});
