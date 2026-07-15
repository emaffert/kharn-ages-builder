import { readFile, writeFile } from "node:fs/promises";
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

// `base` : en build de production, l'app est servie sous le sous-chemin du dépôt GitHub Pages
// (https://<user>.github.io/kharn-ages-builder/). En dev/test, on reste à la racine.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/kharn-ages-builder/" : "/",
  plugins: [
    devCardsPlugin(),
    devSaveCatalogPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Précache aussi les polices self-hostées (woff2) pour un fonctionnement hors-ligne complet.
      // Le catalogue (icônes base64 embarquées) grossit → on relève la limite de précache à 4 Mio
      // (défaut 2 Mio) pour que le bundle JS reste précaché malgré sa taille.
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
