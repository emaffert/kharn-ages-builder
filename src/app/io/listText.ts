import { evaluateList, type Catalog, type ListDocument, type ProfileInstance } from "@core";
import { newListId } from "./ids";

/**
 * Format TEXTE lisible d'une liste (partage/impression) + import best-effort par nom.
 * Le code portable reste le format fiable ; le texte est tolérant et signale les lignes
 * non reconnues (cf. docs/regles-creation-liste.md — import dans les deux formats).
 */

const LEVEL = ["", "I", "II", "III"];
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// ── Export ──────────────────────────────────────────────────────────────────

export function exportText(cat: Catalog, doc: ListDocument): string {
  const ev = evaluateList(cat, doc);
  const profile = (id: string) => cat.profiles.find((p) => p.id === id);
  const nameOf = (m: ProfileInstance) => {
    const p = profile(m.profileId);
    return p ? `${p.name}${p.level ? ` ${LEVEL[p.level]}` : ""}` : m.profileId;
  };
  const equipName = (id: string) => cat.equipment.find((e) => e.id === id)?.name ?? id;
  const details = (m: ProfileInstance): string[] => {
    const out: string[] = [];
    const active = new Set(m.removedBaseEquipmentIds);
    const base = profile(m.profileId)?.baseEquipmentIds ?? [];
    for (const id of base) if (!active.has(id)) out.push(equipItem(m, id, "de base"));
    // Base retirée : listée explicitement pour un round-trip fidèle (sinon réimportée par défaut).
    for (const id of base) if (active.has(id)) out.push(equipItem(m, id, "retiré"));
    for (const id of m.addedEquipmentIds) out.push(equipItem(m, id));
    if (m.grimoireId) out.push(`    grimoire · ${cat.grimoires.find((g) => g.id === m.grimoireId)?.name ?? m.grimoireId}`);
    for (const id of m.spellIds) out.push(`    sort · ${cat.spells.find((s) => s.id === id)?.name ?? id}`);
    for (const id of m.specialCardIds ?? []) out.push(`    amélioration · ${cat.specialCards.find((c) => c.id === id)?.name ?? id}`);
    return out;
  };
  const equipItem = (m: ProfileInstance, id: string, suffix?: string) => {
    const qty = m.munitions?.[id];
    const mun = qty ? ` (×${qty} munitions)` : "";
    return `    équip. · ${equipName(id)}${mun}${suffix ? ` [${suffix}]` : ""}`;
  };

  const fac = cat.factions.find((f) => f.id === doc.fersDeLance[0]?.factionId)?.name ?? "?";
  const lines: string[] = [
    doc.name,
    `${fac} · ${doc.format === "escarmouche" ? "Escarmouche" : "Bataille"} · ${doc.pointsLimit ?? "?"} Ko · total ${ev.totalCost} Ko`,
    "",
  ];
  for (const fdl of doc.fersDeLance) {
    const attached = new Set(fdl.members.flatMap((m) => m.attachedInstanceIds ?? []));
    const cost = (m: ProfileInstance) => {
      const c = ev.costByInstance[m.instanceId] ?? 0;
      return c === 0 ? "gratuit" : `${c} Ko`;
    };
    for (const m of fdl.members) {
      if (attached.has(m.instanceId)) continue;
      const leader = m.instanceId === fdl.leaderInstanceId ? " · meneur" : "";
      lines.push(`• ${nameOf(m)} — ${cost(m)}${leader}`);
      lines.push(...details(m));
      for (const cid of m.attachedInstanceIds ?? []) {
        const child = fdl.members.find((x) => x.instanceId === cid);
        if (child) {
          lines.push(`  ↳ ${nameOf(child)} — ${cost(child)}`);
          lines.push(...details(child).map((l) => `  ${l}`));
        }
      }
    }
  }
  return lines.join("\n");
}

// ── Import (best-effort) ──────────────────────────────────────────────────────

let importCounter = 0;
const newId = (profileId: string) => `${profileId}#imp-${importCounter++}`;

export interface TextImportResult {
  doc: ListDocument;
  unresolved: string[];
}

/** Parse un roster texte, résout au mieux par nom ; renvoie le document + les lignes non reconnues. */
export function importText(cat: Catalog, text: string): TextImportResult {
  const unresolved: string[] = [];
  const members: ProfileInstance[] = [];
  let leaderInstanceId = "";
  let factionId = "fangs";
  let name = "Liste importée";
  let format: ListDocument["format"] = "escarmouche";
  let pointsLimit = 300;

  const profByName = (label: string): (typeof cat.profiles)[number] | undefined => {
    const roman = label.match(/\b(I{1,3})\b\s*$/);
    const level = roman ? roman[1].length : undefined; // I→1, II→2, III→3
    const base = norm(label.replace(/\b(I{1,3})\b\s*$/, ""));
    const cands = cat.profiles.filter((p) => norm(p.name) === base);
    return (level != null ? cands.find((p) => p.level === level) : undefined) ?? cands[0];
  };
  const byName = <T extends { name: string }>(list: T[], label: string) =>
    list.find((x) => norm(x.name) === norm(label));

  const rawLines = text.split(/\r?\n/);
  let current: ProfileInstance | null = null;
  let currentTop: ProfileInstance | null = null;
  let sawFirst = false;
  let parsedMeta = false;

  for (const raw of rawLines) {
    const line = raw.trim();
    if (line === "") continue;

    // En-tête : 1ʳᵉ ligne = nom.
    if (!sawFirst) {
      name = line;
      sawFirst = true;
      continue;
    }
    // Ligne « méta » : la première après le nom SI elle nomme une faction (sinon c'est une figurine).
    if (!parsedMeta) {
      parsedMeta = true;
      const fac = cat.factions.find((f) => line.toLowerCase().includes(f.name.toLowerCase()));
      if (fac && /ko/i.test(line)) {
        factionId = fac.id;
        if (/bataille/i.test(line)) format = "bataille";
        const pts = line.match(/(\d+)\s*ko/i);
        if (pts) pointsLimit = Number(pts[1]);
        continue;
      }
      // sinon : on ne « consomme » pas la ligne, elle sera traitée comme figurine ci-dessous.
    }

    // Détail d'une figurine : « mot-clé · valeur ».
    const detail = line.match(/^(équip\.?|arme|sort|grimoire|am[ée]lioration)\s*[·:]\s*(.+)$/i);
    if (detail && current) {
      const kind = norm(detail[1]);
      let val = detail[2].trim();
      if (kind.startsWith("equip") || kind === "arme") {
        const mun = val.match(/\(×?\s*(\d+)\s*munitions?\)/i);
        const tag = norm(val.match(/\[([^\]]*)\]\s*$/)?.[1] ?? ""); // "de base" | "retire" | ""
        val = val.replace(/\s*\(×?\s*\d+\s*munitions?\)\s*/i, "").replace(/\s*\[.*\]\s*$/, "").trim();
        const e = byName(cat.equipment, val);
        const isBase = e != null && cat.profiles.find((p) => p.id === current!.profileId)?.baseEquipmentIds.includes(e.id);
        if (!e) unresolved.push(raw);
        else if (isBase) {
          // Base explicitement retirée → on la marque comme telle (round-trip du coût).
          if (tag === "retire") current.removedBaseEquipmentIds.push(e.id);
        } else {
          current.addedEquipmentIds.push(e.id);
          if (mun) current.munitions = { ...(current.munitions ?? {}), [e.id]: Number(mun[1]) };
        }
      } else if (kind === "grimoire") {
        const g = cat.grimoires.find((x) => norm(x.name) === norm(val) || x.id === norm(val));
        if (g) current.grimoireId = g.id;
        else unresolved.push(raw);
      } else if (kind === "sort") {
        const s = byName(cat.spells, val);
        if (s) current.spellIds.push(s.id);
        else unresolved.push(raw);
      } else {
        const c = byName(cat.specialCards, val);
        if (c) current.specialCardIds = [...(current.specialCardIds ?? []), c.id];
        else unresolved.push(raw);
      }
      continue;
    }

    // Ligne de figurine (top-level « • » ou rattachée « ↳ »).
    const attached = /^↳/.test(line);
    const label = line.replace(/^[•↳*\-\s]+/, "").split(/\s+—\s+|\s+-\s+/)[0].trim();
    const prof = profByName(label);
    if (!prof) {
      unresolved.push(raw);
      current = null;
      continue;
    }
    const inst: ProfileInstance = {
      instanceId: newId(prof.id),
      profileId: prof.id,
      addedEquipmentIds: [],
      removedBaseEquipmentIds: [],
      spellIds: [],
    };
    members.push(inst);
    current = inst;
    if (attached && currentTop) {
      currentTop.attachedInstanceIds = [...(currentTop.attachedInstanceIds ?? []), inst.instanceId];
    } else {
      currentTop = inst;
      if (/meneur/i.test(line) || leaderInstanceId === "") leaderInstanceId = inst.instanceId;
    }
  }

  const now = new Date().toISOString();
  const doc: ListDocument = {
    schemaVersion: "1",
    catalogVersion: cat.version,
    id: newListId(),
    name,
    format,
    pointsLimit,
    createdAt: now,
    updatedAt: now,
    fersDeLance: [{ id: "fdl1", factionId, leaderInstanceId, members }],
    snapshot: { totalCost: 0, entries: [] },
  };
  return { doc, unresolved };
}
