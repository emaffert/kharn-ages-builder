import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
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
