import { specialCardsForProfile } from "@ui/explain";
import type { Catalog, Profile, Spell } from "@core";
import { equipInfo, type ItemInfo } from "./shared";

type SummaryChip = { name: string; info: ItemInfo };

/** Résumé compact des « achats » d'une figurine (replié sous la ligne) ; chaque objet ouvre sa fiche. */
export function PurchaseSummary({
  p,
  cat,
  accent,
  added,
  removed,
  grimoireId,
  spellIds,
  issues,
  onPick,
}: {
  p: Profile;
  cat: Catalog;
  accent: string;
  added: string[];
  removed: string[];
  grimoireId?: string;
  spellIds: string[];
  issues: string[];
  onPick: (info: ItemInfo) => void;
}) {
  const WEAPON_CATS = ["arme-cac", "arme-tir", "bouclier", "armure"];
  const equip = [...p.baseEquipmentIds.filter((id) => !removed.includes(id)), ...added]
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const chip = (name: string, info: ItemInfo): SummaryChip => ({ name, info });
  const armes = equip.filter((e) => WEAPON_CATS.includes(e.category)).map((e) => chip(e.name, equipInfo(e)));
  const objets = equip.filter((e) => !WEAPON_CATS.includes(e.category)).map((e) => chip(e.name, equipInfo(e)));
  const cartes = specialCardsForProfile(p, cat).map((c) =>
    chip(c.name, {
      title: c.name,
      price: c.cost > 0 ? `${c.cost} Ko` : "auto",
      lines: c.rulesText.map((r) => r.text),
    }),
  );
  // Magie : le grimoire acheté (avec son coût) puis une entrée « N sorts » (coût total).
  const magie: SummaryChip[] = [];
  const grim = grimoireId ? cat.grimoires.find((g) => g.id === grimoireId) : undefined;
  if (grim) {
    magie.push(
      chip(grim.name, {
        title: grim.name,
        price: `${grim.cost} Ko`,
        lines: [`${grim.pages === "illimite" ? "∞" : grim.pages} pages`],
      }),
    );
  }
  if (spellIds.length > 0) {
    const spells = spellIds.map((id) => cat.spells.find((s) => s.id === id)).filter((s): s is Spell => Boolean(s));
    const sCost = spells.reduce((n, s) => n + (s.cost ?? 0), 0);
    magie.push(
      chip(`${spells.length} sort${spells.length > 1 ? "s" : ""}`, {
        title: "Sorts sélectionnés",
        price: `${sCost} Ko`,
        lines: spells.map((s) => `${s.name} — ${s.pages ?? 0} p${s.cost ? ` · ${s.cost} Ko` : ""}`),
      }),
    );
  }
  const rows: [string, SummaryChip[]][] = [
    ["Armes", armes],
    ["Équip.", objets],
    ["Cartes", cartes],
    ["Magie", magie],
  ];
  const shown = rows.filter(([, v]) => v.length > 0);
  return (
    <div className="border-t px-3 py-2 pl-9 text-xs" style={{ borderColor: `${accent}22` }}>
      {issues.length > 0 && (
        <ul className="mb-1.5 space-y-0.5" style={{ color: "#9a3b2b" }}>
          {issues.map((m, k) => (
            <li key={k}>⚠ {m}</li>
          ))}
        </ul>
      )}
      {shown.length === 0 ? (
        <span className="opacity-50">Aucun achat pour l'instant.</span>
      ) : (
        <div className="flex flex-col gap-1">
          {shown.map(([label, vals]) => (
            <div key={label} className="flex gap-2">
              <span className="kh-display w-14 shrink-0 pt-0.5 uppercase tracking-wide opacity-50" style={{ color: accent }}>
                {label}
              </span>
              <span className="flex flex-wrap gap-1">
                {vals.map((v, k) => (
                  <button
                    key={k}
                    onClick={() => onPick(v.info)}
                    className="rounded bg-black/5 px-1.5 py-0.5 transition hover:bg-black/15"
                    title="Voir la fiche et le prix"
                  >
                    {v.name}
                    <span className="ml-1 opacity-50">{v.info.price}</span>
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
