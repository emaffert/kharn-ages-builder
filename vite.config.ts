import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { parseCatalog } from "./src/core";

/** Type MIME d'une image d'après ses octets de tête. */
function sniffImageType(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  const brand = buf.subarray(4, 12).toString("latin1");
  if (brand.startsWith("ftyp") && brand.includes("avif")) return "image/avif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF") return "image/webp";
  return "application/octet-stream";
}

/**
 * Sert les images des cartes (dossier `cards/`, gitignoré) UNIQUEMENT en développement.
 * `apply: "serve"` => ce plugin n'existe pas dans le build de production.
 */
function devCardsPlugin(): Plugin {
  const cardsDir = resolve(__dirname, "cards");
  return {
    name: "dev-cards",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/cards", async (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, "");
        const filePath = resolve(cardsDir, rel);
        if (!filePath.startsWith(cardsDir)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        try {
          const buf = await readFile(filePath);
          res.setHeader("Content-Type", sniffImageType(buf));
          res.setHeader("Cache-Control", "no-cache");
          res.end(buf);
        } catch {
          next();
        }
      });
    },
  };
}

/**
 * Endpoint de DÉVELOPPEMENT pour enregistrer le catalogue édité directement dans
 * `src/data/catalog.json`. `apply: "serve"` => absent du build de production.
 */
function devSaveCatalogPlugin(): Plugin {
  const target = resolve(__dirname, "src/data/catalog.json");
  return {
    name: "dev-save-catalog",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__save-catalog", async (req, res, next) => {
        if (req.method !== "POST") return next();
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          // Validation Zod avant écriture : on refuse d'écraser le fichier source avec un
          // catalogue invalide (garde-fou contre une corruption ou un POST externe malveillant).
          const data = parseCatalog(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          await writeFile(target, JSON.stringify(data, null, 2) + "\n");
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erreur" }));
        }
      });
    },
  };
}

/**
 * Endpoint de DÉVELOPPEMENT qui matérialise des icônes dans `src/assets/icons/`.
 *
 * C'est le pendant de `devSaveCatalogPlugin` pour les images : une icône créée depuis l'admin
 * n'existe que dans le bucket, et le dépôt doit la recevoir pour continuer à servir de repli
 * hors-ligne. Le navigateur ne pouvant pas écrire sur le disque, il passe par ici.
 *
 * `apply: "serve"` => absent du build de production.
 */
function devSaveIconsPlugin(): Plugin {
  const iconsDir = resolve(__dirname, "src/assets/icons");
  // Doit rester d'accord avec `iconName` (src/lib/icons.ts).
  const NAME_RE = /^[0-9a-f]{16}\.webp$/;

  return {
    name: "dev-save-icons",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__save-icons", async (req, res, next) => {
        if (req.method !== "POST") return next();
        const reply = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const icons = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { name: string; base64: string }[];
          if (!Array.isArray(icons)) return reply(400, { ok: false, error: "tableau d'icônes attendu" });

          await mkdir(iconsDir, { recursive: true });
          for (const { name, base64 } of icons) {
            // Le nom vient du réseau : sans ce filtre, un `../` écrirait n'importe où dans le dépôt.
            if (typeof name !== "string" || !NAME_RE.test(name)) {
              return reply(400, { ok: false, error: `nom d'icône refusé : ${String(name).slice(0, 40)}` });
            }
            const data = Buffer.from(base64, "base64");
            // Le nom EST l'empreinte du contenu : on refuse d'écrire un fichier qui mentirait sur
            // le sien, sinon le miroir et le bucket divergeraient sous une même référence.
            const digest = createHash("sha256").update(data).digest("hex").slice(0, 16);
            if (`${digest}.webp` !== name) {
              return reply(400, { ok: false, error: `contenu incohérent avec le nom ${name}` });
            }
            await writeFile(resolve(iconsDir, name), data);
          }
          reply(200, { ok: true, written: icons.length });
        } catch (e) {
          reply(400, { ok: false, error: e instanceof Error ? e.message : "erreur" });
        }
      });
    },
  };
}

// `base` : en build de production, l'app est servie sous le sous-chemin du dépôt GitHub Pages
// (https://<user>.github.io/kharn-ages-builder/). En dev/test, on reste à la racine.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/kharn-ages-builder/" : "/",
  plugins: [
    devCardsPlugin(),
    devSaveCatalogPlugin(),
    devSaveIconsPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Précache les polices self-hostées (woff2) et le miroir des portraits (webp) : c'est ce qui
      // rend l'app complète hors-ligne DÈS la première visite, y compris ses icônes. Sans `webp`
      // ici, `src/assets/icons/` serait bien buildé mais chargé au coup par coup depuis le réseau.
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        // Icônes servies par le bucket : celles créées depuis l'admin déployé, donc plus récentes
        // que le miroir précaché ci-dessus. `CacheFirst` sans revalidation est le bon choix ici,
        // le nom d'un objet ÉTANT son hash de contenu : il ne peut pas changer sous le même nom.
        runtimeCaching: [
          {
            urlPattern: /\/storage\/v1\/object\/public\/catalog-icons\/[0-9a-f]+\.webp$/,
            handler: "CacheFirst",
            options: {
              cacheName: "catalog-icons",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Khârn-Âges - Constructeur de listes",
        short_name: "Khârn-Âges",
        lang: "fr",
        start_url: ".",
        display: "standalone",
        background_color: "#1a1410",
        theme_color: "#1a1410",
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@data": resolve(__dirname, "src/data"),
      "@ui": resolve(__dirname, "src/ui"),
      "@app": resolve(__dirname, "src/app"),
    },
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      // Exclus : tests, données JSON, point d'entrée, service worker PWA, snapshots.
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/__snapshots__/**", "src/main.tsx", "src/**/*.d.ts"],
    },
  },
}));
