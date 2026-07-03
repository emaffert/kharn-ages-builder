import { specialCardsForProfile } from "@ui/explain";
import type { Catalog, Profile, Spell } from "@core";
import { equipInfo, type ItemInfo } from "./shared";

type SummaryChip = { name: string; info: ItemInfo };

/** Résumé compact des « achats » d'une figurine (replié sous la ligne) ; chaque objet ouvre sa fiche. */
export function PurchaseSummary({
  p,
  cat,
  added,
  removed,
  grimoireId,
  spellIds,
  upgrades,
  issues,
  onPick,
}: {
  p: Profile;
  cat: Catalog;
  added: string[];
  removed: string[];
  grimoireId?: string;
  spellIds: string[];
  upgrades: string[];
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
  // N'affiche que les cartes automatiques (appliquées d'office) et les améliorations réellement sélectionnées.
  const cartes = specialCardsForProfile(p, cat)
    .filter((c) => !c.amelioration || upgrades.includes(c.id))
    .map((c) =>
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
    ["Équipement", objets],
    ["Cartes", cartes],
    ["Magie", magie],
  ];
  const shown = rows.filter(([, v]) => v.length > 0);
  // Rien à montrer (ni achat, ni alerte) → pas de panneau du tout (plus de « Aucun achat »).
  if (shown.length === 0 && issues.length === 0) return null;
  return (
    <div className="bld-loadout">
      {issues.length > 0 && (
        <div className="bld-loadout-issues">
          {issues.map((m, k) => (
            <span key={k}>⚠ {m}</span>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <div className="bld-loadout-groups">
          {shown.map(([label, vals]) => (
            <div key={label} className="bld-loadout-group">
              <div className="bld-loadout-label">{label}</div>
              <div className="bld-loadout-items">
                {vals.map((v, k) => (
                  <button
                    key={k}
                    className="bld-loadout-item"
                    onClick={() => onPick(v.info)}
                    title="Voir la fiche et le prix"
                  >
                    <span className="nm">{v.name}</span>
                    <span className="px">{v.info.price}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
