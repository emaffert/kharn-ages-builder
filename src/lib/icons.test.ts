import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Résolution d'une référence d'icône en URL affichable.
 *
 * Le module lit son miroir et son client au chargement : chaque cas réimporte donc le module
 * après avoir posé le décor (`resetModules` + `doMock`), plutôt que de partager une instance.
 * Le miroir est bien peuplé en test - Vite résout `import.meta.glob` sur `src/assets/icons/` -,
 * ce qui permet de vérifier l'invariant « le dépôt sert tout ce que le catalogue cite ».
 *
 * Les opérations de bucket, elles, reçoivent leur client en argument : elles se testent avec un
 * faux client, sans toucher au chargement du module.
 */

const PUBLIC_URL = "https://exemple.supabase.co/storage/v1/object/public/catalog-icons/abc123.webp";

/** Charge `icons.ts` avec ou sans backend configuré. */
async function loadModule(withClient: boolean) {
  vi.resetModules();
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: PUBLIC_URL } }));
  const from = vi.fn(() => ({ getPublicUrl }));
  vi.doMock("./supabase", () => ({
    supabase: withClient ? { storage: { from } } : null,
    isSupabaseConfigured: withClient,
  }));
  const mod = await import("./icons");
  return { ...mod, from, getPublicUrl };
}

afterEach(() => {
  vi.doUnmock("./supabase");
  vi.resetModules();
});

describe("iconSrc", () => {
  it("ne rend rien sans référence", async () => {
    const { iconSrc } = await loadModule(true);
    expect(iconSrc(undefined)).toBeUndefined();
  });

  it("rend une data-URI telle quelle - l'historique publié en contient encore", async () => {
    const { iconSrc } = await loadModule(true);
    const legacy = "data:image/jpeg;base64,/9j/4AAQ";
    expect(iconSrc(legacy)).toBe(legacy);
  });

  it("bascule sur le bucket quand la référence n'est pas dans le miroir du dépôt", async () => {
    const { iconSrc, from, getPublicUrl } = await loadModule(true);
    expect(iconSrc("abc123.webp")).toBe(PUBLIC_URL);
    expect(from).toHaveBeenCalledWith("catalog-icons");
    expect(getPublicUrl).toHaveBeenCalledWith("abc123.webp");
  });

  it("ne rend rien, sans planter, quand aucun backend n'est configuré", async () => {
    // Mode local-first (pas de `.env`) : l'app reste utilisable, simplement sans cette icône.
    const { iconSrc } = await loadModule(false);
    expect(iconSrc("abc123.webp")).toBeUndefined();
  });

  it("ne consulte pas le bucket pour une data-URI, même sans backend", async () => {
    const { iconSrc } = await loadModule(false);
    expect(iconSrc("data:image/webp;base64,UklGRg")).toBe("data:image/webp;base64,UklGRg");
  });
});

describe("iconName", () => {
  const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

  it("dérive un nom stable du contenu", async () => {
    const { iconName } = await loadModule(true);
    const a = await iconName(bytes("des octets d'image"));
    expect(a).toBe(await iconName(bytes("des octets d'image")));
    expect(a).toMatch(/^[0-9a-f]{16}\.webp$/);
  });

  it("donne des noms différents à des contenus différents", async () => {
    const { iconName } = await loadModule(true);
    expect(await iconName(bytes("image A"))).not.toBe(await iconName(bytes("image B")));
  });
});

describe("miroir du dépôt", () => {
  it("ignore une référence qu'il ne connaît pas", async () => {
    const { isMirrored } = await loadModule(true);
    expect(isMirrored("0000000000000000.webp")).toBe(false);
  });

  /**
   * L'invariant qui tient toute l'architecture : `catalog.json` ne cite que des références, et le
   * repli hors-ligne ne vaut que si les fichiers correspondants sont committés à côté. Un portrait
   * ajouté au catalogue sans son `.webp` passerait tous les autres contrôles et ne se verrait qu'en
   * production, à la première visite sans réseau.
   */
  it("contient toutes les icônes citées par le catalogue committé", async () => {
    const { isMirrored } = await loadModule(true);
    const { catalog } = await import("@data");
    const refs = [
      ...Object.values(catalog.icons ?? {}),
      ...catalog.profiles.map((p) => p.icon),
      ...catalog.mounts.map((m) => m.icon),
    ].filter((ref): ref is string => ref != null && !ref.startsWith("data:"));

    expect(refs.length).toBeGreaterThan(0);
    expect(refs.filter((ref) => !isMirrored(ref))).toEqual([]);
  });
});

// ── Opérations de bucket ────────────────────────────────────────────────────

type StorageStub = {
  upload?: ReturnType<typeof vi.fn>;
  list?: ReturnType<typeof vi.fn>;
  remove?: ReturnType<typeof vi.fn>;
};

/** Faux client Supabase : seules les méthodes utilisées par le cas testé sont fournies. */
function fakeClient(storage: StorageStub = {}, rpc = vi.fn()) {
  const from = vi.fn(() => storage);
  return { client: { storage: { from }, rpc } as never, from, rpc };
}

/** Une page de résultats `list()`, au format renvoyé par le Storage. */
const page = (names: string[]) => ({ data: names.map((name) => ({ name })), error: null });

describe("uploadIcon", () => {
  it("dépose sous le nom du contenu, en WebP immuable", async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const { client } = fakeClient({ upload });
    const { uploadIcon, iconName } = await loadModule(true);
    const bytes = new TextEncoder().encode("octets").buffer as ArrayBuffer;

    const { name, error } = await uploadIcon(client, bytes);

    expect(error).toBeNull();
    expect(name).toBe(await iconName(bytes));
    const [sentName, , options] = upload.mock.calls[0] as unknown as [string, unknown, Record<string, unknown>];
    expect(sentName).toBe(name);
    expect(options).toMatchObject({ contentType: "image/webp", upsert: true });
  });

  it("traduit un refus de la policy en message de rôle", async () => {
    const upload = vi.fn(async () => ({ error: { message: "new row violates row-level security policy" } }));
    const { client } = fakeClient({ upload });
    const { uploadIcon } = await loadModule(true);

    const { name, error } = await uploadIcon(client, new ArrayBuffer(4));

    expect(name).toBeNull();
    expect(error).toMatch(/administrateur/i);
  });
});

describe("listBucketIcons", () => {
  it("distingue un bucket vide d'un bucket illisible", async () => {
    const { listBucketIcons } = await loadModule(true);

    const vide = fakeClient({ list: vi.fn(async () => page([])) });
    expect(await listBucketIcons(vide.client)).toEqual(new Set());

    const cassé = fakeClient({ list: vi.fn(async () => ({ data: null, error: { message: "boom" } })) });
    expect(await listBucketIcons(cassé.client)).toBeNull();
  });

  it("parcourt toutes les pages", async () => {
    // Une page pleine (1000) doit en faire demander une suivante ; une page partielle arrête.
    const first = Array.from({ length: 1000 }, (_, i) => `${i}.webp`);
    const list = vi
      .fn()
      .mockResolvedValueOnce(page(first))
      .mockResolvedValueOnce(page(["reste.webp"]));
    const { client } = fakeClient({ list });
    const { listBucketIcons } = await loadModule(true);

    const names = await listBucketIcons(client);

    expect(names?.size).toBe(1001);
    expect(names?.has("reste.webp")).toBe(true);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1][1]).toMatchObject({ offset: 1000 });
  });
});

describe("syncMirrorToBucket", () => {
  it("ne téléverse rien quand le bucket a déjà tout le miroir", async () => {
    const { syncMirrorToBucket, mirroredIcons } = await loadModule(true);
    const upload = vi.fn();
    const list = vi.fn(async () => page(mirroredIcons().map((i) => i.name)));
    const { client } = fakeClient({ list, upload });

    const { uploaded, error } = await syncMirrorToBucket(client);

    expect(error).toBeNull();
    expect(uploaded).toBe(0);
    expect(upload).not.toHaveBeenCalled();
  });

  it("téléverse les seules manquantes, et rend compte de l'avancement", async () => {
    const { syncMirrorToBucket, mirroredIcons } = await loadModule(true);
    const all = mirroredIcons();
    const missing = all.slice(0, 3);
    const list = vi.fn(async () => page(all.slice(3).map((i) => i.name)));
    const upload = vi.fn(async () => ({ error: null }));
    const { client } = fakeClient({ list, upload });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
    );
    const progress: number[] = [];

    const { uploaded, error } = await syncMirrorToBucket(client, (n) => progress.push(n));

    expect(error).toBeNull();
    expect(uploaded).toBe(missing.length);
    expect(upload).toHaveBeenCalledTimes(missing.length);
    expect(progress).toEqual([1, 2, 3]);
    vi.unstubAllGlobals();
  });

  it("s'arrête et signale quand le bucket est illisible - sinon on croirait tout devoir renvoyer", async () => {
    const { syncMirrorToBucket } = await loadModule(true);
    const upload = vi.fn();
    const { client } = fakeClient({ list: vi.fn(async () => ({ data: null, error: { message: "nope" } })), upload });

    const { uploaded, error } = await syncMirrorToBucket(client);

    expect(uploaded).toBe(0);
    expect(error).toMatch(/0004/);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("fetchOrphanIcons", () => {
  it("passe le délai de grâce au serveur et normalise les lignes", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ name: "vieille.webp", created_at: "2026-01-01T00:00:00Z", size: 12000 }],
      error: null,
    }));
    const { client } = fakeClient({}, rpc);
    const { fetchOrphanIcons } = await loadModule(true);

    const { orphans, error } = await fetchOrphanIcons(client, 30);

    expect(error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("orphan_icon_names", { grace: "30 days" });
    expect(orphans).toEqual([{ name: "vieille.webp", createdAt: "2026-01-01T00:00:00Z", size: 12000 }]);
  });

  it("rend une liste vide, pas une erreur, quand rien n'est orphelin", async () => {
    const { client } = fakeClient({}, vi.fn(async () => ({ data: [], error: null })));
    const { fetchOrphanIcons } = await loadModule(true);
    expect((await fetchOrphanIcons(client)).orphans).toEqual([]);
  });
});

describe("removeIcons", () => {
  it("ne consulte pas le serveur pour une liste vide", async () => {
    const remove = vi.fn();
    const { client } = fakeClient({ remove });
    const { removeIcons } = await loadModule(true);

    expect(await removeIcons(client, [])).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("passe par l'API Storage, qui seule libère les fichiers", async () => {
    const remove = vi.fn(async () => ({ error: null }));
    const { client } = fakeClient({ remove });
    const { removeIcons } = await loadModule(true);

    expect(await removeIcons(client, ["a.webp", "b.webp"])).toBeNull();
    expect(remove).toHaveBeenCalledWith(["a.webp", "b.webp"]);
  });
});
