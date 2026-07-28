#!/usr/bin/env node
/**
 * Fusion ponctuelle du `catalog.json` du dépôt avec la version publiée (juillet 2026).
 *
 * Contexte : les deux ont divergé. La version publiée n° 3 (11h09) portait bien le fichier du dépôt,
 * mais les versions 4 et suivantes ont été publiées depuis un brouillon de navigateur antérieur au
 * travail du matin. Résultat : la version publiée a gagné une grosse saisie de sorts et de données,
 * et perdu la slugification des identifiants ainsi que quelques corrections faites sur le fichier.
 *
 * Stratégie : partir de la **version publiée** - c'est elle qui porte la saisie irremplaçable - et y
 * rejouer ce que seul le fichier possède :
 *
 *   1. les identifiants slugifiés (66 équipements + 3 sorts), références comprises ;
 *   2. les icônes sorties du catalogue (références `<hash>.webp` au lieu des data-URI) ;
 *   3. cinq corrections ciblées (Alliés d'outre-tombe, Pacte du Secret, gambison, Passe-Passe, et
 *      le trait de réserve de la Faux de la damnation).
 *
 * Ce qui vient de la version publiée est conservé tel quel : les ~42 sorts saisis, le retrait des
 * sorts « Test - X », le nombre de mains des armes de tir, le coût du Paladin cavalier III, la
 * `capacityRule` des Likans et la portée « profil » des recrutements alliés.
 *
 * Le script **échoue bruyamment** si une correction ne trouve pas sa cible : mieux vaut s'arrêter
 * que produire un catalogue à moitié fusionné sans le dire.
 *
 * Usage :
 *   node --env-file=.env.local scripts/merge-published-catalog.mjs            # dernière version publiée
 *   node --env-file=.env.local scripts/merge-published-catalog.mjs --version-id 10
 *   node scripts/merge-published-catalog.mjs --from /chemin/publie.json       # sans réseau
 *
 * Options : --version <nom>   nom de la version écrite dans le catalogue (défaut : 0.3.2)
 *           --dry-run         affiche le rapport sans écrire le fichier
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = resolve(ROOT, "src/data/catalog.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const VERSION_NAME = option("--version", "0.3.2");
const DRY_RUN = flag("--dry-run");

/** Ce que le script a fait, ligne à ligne ; imprimé à la fin, et vérifié avant d'écrire. */
const report = [];
const failures = [];
const done = (line) => report.push(`  ok   ${line}`);
const failed = (line) => {
  failures.push(line);
  report.push(`  ÉCHEC ${line}`);
};

/** La version publiée : téléchargée depuis Supabase, ou lue sur disque avec `--from`. */
async function loadPublished() {
  const from = option("--from", null);
  if (from) {
    const raw = JSON.parse(await readFile(resolve(from), "utf8"));
    // Accepte aussi bien le catalogue nu qu'une ligne `catalog_versions` exportée.
    return { catalog: raw.data ?? raw, source: from };
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY absents : lancer avec --env-file=.env.local, ou passer --from");
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const versionId = option("--version-id", null);
  const query = versionId
    ? `id=eq.${versionId}&select=id,version,published_at,data`
    : "select=id,version,published_at,data&order=id.desc&limit=1";
  const rows = await (await fetch(`${url}/rest/v1/catalog_versions?${query}`, { headers })).json();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("aucune version publiée trouvée");
  const row = rows[0];
  return { catalog: row.data, source: `version publiée n° ${row.id} (« ${row.version} », ${row.published_at})` };
}

/**
 * Remplace des identifiants **partout** dans la donnée, valeur de chaîne par valeur de chaîne.
 * Une référence est toujours l'identifiant exact et rien d'autre, et les identifiants remplacés
 * (`equip-1785180156759`, `spell-1785224840042`) ne peuvent pas apparaître comme texte libre :
 * comparer la chaîne entière est donc sûr, et couvre du même coup les champs qu'on ne connaît pas.
 */
function remapIds(value, mapping) {
  if (typeof value === "string") return mapping.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => remapIds(v, mapping));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapIds(v, mapping)]));
  }
  return value;
}

/**
 * Les entités que le fichier et la version publiée nomment pareil sous deux identifiants différents.
 *
 * Un même nom peut désigner deux entités bel et bien distinctes dans la version publiée : quelqu'un
 * a resaisi dans l'admin un sort qui existait déjà. Reprendre l'identifiant du fichier les
 * fusionnerait en douce, donc on ne renomme que vers un identifiant **libre** côté publié, et on
 * signale les homonymes plutôt que de trancher à la place de l'utilisateur.
 */
function idMappingByName(collection, file, published) {
  const fileByName = new Map(file[collection].map((e) => [e.name, e.id]));
  const fileIds = new Set(file[collection].map((e) => e.id));
  const publishedIds = new Set(published[collection].map((e) => e.id));
  const mapping = new Map();
  const claimed = new Set();
  const unmatched = [];
  const collisions = [];

  for (const entity of published[collection]) {
    if (fileIds.has(entity.id)) continue; // même identifiant des deux côtés : rien à faire
    const fileId = fileByName.get(entity.name);
    if (!fileId) {
      unmatched.push(`${entity.name || "(sans nom)"} [${entity.id}]`);
      continue;
    }
    if (publishedIds.has(fileId) || claimed.has(fileId)) {
      collisions.push(`« ${entity.name} » [${entity.id}] : « ${fileId} » porte déjà ce nom`);
      continue;
    }
    mapping.set(entity.id, fileId);
    claimed.add(fileId);
  }
  return { mapping, unmatched, collisions };
}

const find = (catalog, collection, id) => catalog[collection].find((e) => e.id === id);

/**
 * Doublons tranchés à la main (2026-07-28). La version publiée porte deux entités de même nom :
 * une coquille créée à l'import pour servir de support, et sa resaisie complète depuis la carte.
 * On retire la coquille et on laisse son identifiant slugifié à la bonne entrée - les références
 * existantes (ici le `grant-spell` du Guerrier Albinos III) continuent alors de résoudre, et
 * pointent désormais sur le sort qui a vraiment des seuils.
 *
 * Décision de l'utilisateur pour l'Onde revigorante : le bon sort est celui qui a été ajouté, il
 * n'est **pas réservé**, et le fait que les synkherces le connaissent d'office se règlera après la
 * fusion (côté carte spéciale) - donc rien n'est touché ici sur ce point.
 */
const SUPERSEDED = [
  {
    collection: "spells",
    drop: "onde-revigorante",
    keep: "spell-1785237326204",
    label: "Onde revigorante : la coquille sans seuils cède la place à la transcription complète",
  },
];

// ── Chargement ────────────────────────────────────────────────────────────────
const file = JSON.parse(await readFile(CATALOG, "utf8"));
const { catalog: published, source } = await loadPublished();

console.log(`Base    : ${source}`);
console.log(`Apports : ${CATALOG}\n`);

// ── 0. Doublons tranchés ──────────────────────────────────────────────────────
// À faire AVANT l'appariement par nom : une fois la coquille retirée, son identifiant est libre et
// l'appariement donne naturellement cet identifiant à l'entrée conservée.
const promoted = new Map();
for (const { collection, drop, keep, label } of SUPERSEDED) {
  const shell = find(published, collection, drop);
  const kept = find(published, collection, keep);
  if (!shell || !kept) {
    failed(`${label} - entité introuvable (${!shell ? drop : keep})`);
    continue;
  }
  // Ce que la coquille portait et que la resaisie n'a pas : à signaler plutôt qu'à perdre en silence.
  const lost = Object.keys(shell).filter((k) => k !== "id" && shell[k] !== undefined && kept[k] === undefined);
  published[collection] = published[collection].filter((e) => e.id !== drop);
  promoted.set(keep, { collection, drop });
  done(label);
  if (lost.length > 0) report.push(`       champs de la coquille non repris : ${lost.join(", ")}`);
}

// ── 1. Identifiants slugifiés ─────────────────────────────────────────────────
const mapping = new Map();
for (const collection of ["equipment", "spells"]) {
  const { mapping: partial, unmatched, collisions } = idMappingByName(collection, file, published);
  for (const [from, to] of partial) mapping.set(from, to);
  done(`${collection} : ${partial.size} identifiant(s) resslugifié(s)`);
  // Les entités publiées absentes du fichier sont normales (les sorts saisis dans l'admin) :
  // on ne les signale que pour mémoire, elles gardent leur identifiant.
  if (unmatched.length > 0) report.push(`       ${unmatched.length} entité(s) propres à la version publiée, identifiant conservé`);
  for (const collision of collisions) report.push(`  À VOIR doublon de nom dans ${collection} - ${collision}`);
}

// L'entrée conservée doit bel et bien avoir hérité de l'identifiant libéré : sans ça les références
// existantes pointeraient dans le vide, et l'appariement par nom aurait échoué en silence.
for (const [keep, { drop }] of promoted) {
  if (mapping.get(keep) !== drop) failed(`« ${keep} » n'a pas repris l'identifiant « ${drop} » : appariement par nom en échec`);
}

let merged = remapIds(published, mapping);

// ── 2. Icônes hors du catalogue ───────────────────────────────────────────────
// Les deux côtés décrivent les mêmes images : le fichier les nomme (`<hash>.webp`), la version
// publiée les embarque encore en base64. On reprend donc les références du fichier telles quelles.
const fileIconKeys = Object.keys(file.icons ?? {}).sort().join("|");
const publishedIconKeys = Object.keys(merged.icons ?? {}).sort().join("|");
if (fileIconKeys !== publishedIconKeys) {
  failed("icônes : les deux catalogues ne référencent pas les mêmes cartes, reprise impossible en l'état");
} else {
  merged.icons = { ...file.icons };
  done(`icônes : ${Object.keys(merged.icons).length} référence(s) reprises du fichier`);
}

// Icônes propres à une entité (dérogation au partage par carte).
for (const collection of ["profiles", "mounts"]) {
  let count = 0;
  for (const entity of merged[collection]) {
    const fileEntity = find(file, collection, entity.id);
    if (fileEntity?.icon && entity.icon !== fileEntity.icon) {
      entity.icon = fileEntity.icon;
      count += 1;
    }
  }
  if (count > 0) done(`${collection} : ${count} icône(s) propres reprises du fichier`);
}

const leftoverDataUris = JSON.stringify(merged).match(/"data:image/g)?.length ?? 0;
if (leftoverDataUris > 0) failed(`${leftoverDataUris} image(s) encodées subsistent dans le catalogue fusionné`);

// ── 3. Corrections faites sur le fichier ──────────────────────────────────────
// Chaque correction dit ce qu'elle cherche : si la cible a bougé, on veut le savoir.

// 3a. « Alliés d'outre-tombe » : la réserve cite un trait qui n'existe pas (`"Nyx "`, espace comprise).
{
  const spell = find(merged, "spells", "allies-d-outre-tombe");
  if (!spell) failed("Alliés d'outre-tombe : sort introuvable");
  else if (spell.reservedTo?.trait === "fille-de-nyx") done("Alliés d'outre-tombe : réserve déjà correcte");
  else {
    spell.reservedTo = { ...spell.reservedTo, trait: "fille-de-nyx" };
    done("Alliés d'outre-tombe : réserve remise sur le trait fille-de-nyx");
  }
}

// 3b. Pacte du Secret : Martha n'est pas encore importée, sa mention rendait la carte insatisfaisable.
{
  const card = find(merged, "specialCards", "pacte-du-secret");
  const fileCard = find(file, "specialCards", "pacte-du-secret");
  if (!card || !fileCard) failed("Pacte du Secret : carte introuvable");
  else {
    const ids = card.activationCondition?.profileIds ?? [];
    if (ids.includes("kharns-martha")) {
      card.activationCondition.profileIds = ids.filter((id) => id !== "kharns-martha");
      done("Pacte du Secret : référence à Martha retirée de la condition d'activation");
    } else {
      done("Pacte du Secret : condition déjà sans Martha");
    }
    if (fileCard.notes && !card.notes) {
      card.notes = fileCard.notes;
      done("Pacte du Secret : note interne du fichier restaurée");
    }
  }
}

// 3c. Gambison : se porte EN PLUS d'une armure (retour joueurs).
{
  const gambison = find(merged, "equipment", "gambison");
  if (!gambison) failed("Gambison : équipement introuvable");
  else if (gambison.stacksWithArmor === true) done("Gambison : cumul déjà présent");
  else {
    gambison.stacksWithArmor = true;
    done("Gambison : cumul avec une armure rétabli");
  }
}

// 3d. Passe-Passe : sort générique, il se paie en niveaux et non en pages de grimoire.
{
  const spell = find(merged, "spells", "guilde-noire-passe-passe");
  if (!spell) failed("Passe-Passe : sort introuvable");
  else if (spell.levelCost === 3 && spell.pages === undefined) done("Passe-Passe : coût déjà en niveaux");
  else {
    spell.levelCost = 3;
    delete spell.pages;
    done("Passe-Passe : coût remis en niveaux (3), pages de grimoire retirées");
  }
}

// 3e. Faux de la damnation : même défaut de trait que le sort ci-dessus, mais présent des DEUX
// côtés - le fichier ne l'avait pas corrigé non plus. Le trait « Nyx » n'existe pas ; les trois
// profils concernés (Broutcha II, Apathée III, Xayìn II) portent `fille-de-nyx`. Corrigé sur
// décision de l'utilisateur (2026-07-28) : sans ça la réserve ne retient personne.
{
  const weapon = find(merged, "equipment", "faux-de-la-damnation");
  const traits = weapon?.reservedTo?.traits ?? [];
  if (!weapon) failed("Faux de la damnation : équipement introuvable");
  else if (!traits.includes("Nyx")) done("Faux de la damnation : réserve déjà correcte");
  else {
    weapon.reservedTo.traits = traits.map((t) => (t === "Nyx" ? "fille-de-nyx" : t));
    done("Faux de la damnation : réserve remise sur le trait fille-de-nyx");
  }
}

// ── 4. Nom de version ─────────────────────────────────────────────────────────
merged.version = VERSION_NAME;
done(`version nommée « ${VERSION_NAME} »`);

// ── 5. Contrôles avant écriture ───────────────────────────────────────────────
// Ces contrôles ne remplacent pas `npm test` (Zod + intégrité des références) : ils attrapent ce que
// la fusion elle-même peut casser, et rien d'autre.
for (const collection of ["profiles", "equipment", "spells", "skills", "models", "specialCards", "mounts"]) {
  const ids = merged[collection].map((e) => e.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) failed(`${collection} : identifiant(s) en double après fusion - ${[...new Set(duplicates)].join(", ")}`);
}

const serialized = JSON.stringify(merged);
const survivors = [...mapping.keys()].filter((oldId) => serialized.includes(`"${oldId}"`));
if (survivors.length > 0) failed(`${survivors.length} ancien(s) identifiant(s) non remplacés : ${survivors.slice(0, 5).join(", ")}`);

const fileEquipIds = new Set(file.equipment.map((e) => e.id));
const missing = [...fileEquipIds].filter((id) => !merged.equipment.some((e) => e.id === id));
if (missing.length > 0) failed(`${missing.length} équipement(s) du fichier absents du résultat : ${missing.slice(0, 5).join(", ")}`);

// ── Rapport ───────────────────────────────────────────────────────────────────
console.log(report.join("\n"));
console.log(
  `\nRésultat : ${merged.profiles.length} profils · ${merged.equipment.length} équipements · ` +
    `${merged.spells.length} sorts · ${Object.keys(merged.icons ?? {}).length} icônes`,
);

if (failures.length > 0) {
  console.error(`\n${failures.length} problème(s) : le fichier n'a PAS été écrit.`);
  process.exit(1);
}

if (DRY_RUN) {
  console.log("\n--dry-run : rien n'a été écrit.");
  process.exit(0);
}

const before = (await readFile(CATALOG, "utf8")).length;
await writeFile(CATALOG, JSON.stringify(merged, null, 2) + "\n");
const after = (await readFile(CATALOG, "utf8")).length;
console.log(`\ncatalog.json écrit : ${(before / 1e6).toFixed(2)} Mo -> ${(after / 1e6).toFixed(2)} Mo`);
console.log("Suite : `make test` puis, si tout est vert, republier depuis l'admin.");
