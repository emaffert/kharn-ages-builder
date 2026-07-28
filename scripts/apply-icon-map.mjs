#!/usr/bin/env node
/**
 * Second temps de la sortie des icônes du catalogue (cf. `scripts/icons_to_webp.py`) :
 * remplace les data-URI de `catalog.json` par les références produites par l'encodage.
 *
 * Pourquoi en Node plutôt que dans le script Python : le fichier doit rester écrit *exactement*
 * comme le fait l'app (`JSON.stringify(data, null, 2) + "\n"`, cf. `devSaveCatalogPlugin` dans
 * vite.config.ts). Passer par le même `JSON.stringify` garantit qu'un export depuis l'admin ne
 * produira pas un diff parasite sur tout le fichier.
 *
 * Idempotent : relancer après coup ne trouve plus rien à remplacer et laisse le fichier intact.
 *
 * Usage : node scripts/apply-icon-map.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = resolve(ROOT, "src/data/catalog.json");
const MAP_FILE = resolve(ROOT, "scripts/.icons-map.json");

const map = JSON.parse(await readFile(MAP_FILE, "utf8"));
const catalog = JSON.parse(await readFile(CATALOG, "utf8"));

let replaced = 0;

// Table partagée, indexée par `cardImage`.
for (const [cardImage, name] of Object.entries(map.icons ?? {})) {
  if (catalog.icons?.[cardImage] === undefined) {
    console.warn(`  ! icons/${cardImage} : absent du catalogue, ignoré`);
    continue;
  }
  catalog.icons[cardImage] = name;
  replaced++;
}

// Dérogations par niveau, indexées par identifiant d'entité.
for (const [section, key] of [
  ["profiles", "profiles"],
  ["mounts", "mounts"],
]) {
  for (const [id, name] of Object.entries(map[section] ?? {})) {
    const entity = catalog[key]?.find((e) => e.id === id);
    if (!entity) {
      console.warn(`  ! ${section}/${id} : absent du catalogue, ignoré`);
      continue;
    }
    entity.icon = name;
    replaced++;
  }
}

const before = (await readFile(CATALOG, "utf8")).length;
await writeFile(CATALOG, JSON.stringify(catalog, null, 2) + "\n");
const after = (await readFile(CATALOG, "utf8")).length;

console.log(`${replaced} référence(s) appliquées.`);
console.log(`catalog.json : ${(before / 1e6).toFixed(2)} Mo -> ${(after / 1e6).toFixed(2)} Mo`);
