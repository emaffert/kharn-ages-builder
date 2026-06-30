import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

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

export default defineConfig({
  plugins: [
    devCardsPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Khârn-Âges — Constructeur de listes",
        short_name: "Khârn-Âges",
        lang: "fr",
        start_url: "/",
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
});
