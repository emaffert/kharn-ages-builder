import { specialCardsForProfile } from "@ui/explain";
import {
  equipmentDiscount,
  equipmentMatchesEquipFilter,
  munitionKindForEquip,
  resolveMunitionLines,
  type Catalog,
  type EquipmentCostRule,
  type Profile,
  type Spell,
} from "@core";
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
  upgradeCounts,
  munitions,
  equipmentUpgrades,
  grantedUpgrades,
  costRules,
  onPick,
}: {
  p: Profile;
  cat: Catalog;
  added: string[];
  removed: string[];
  /** Règles de remise par objet applicables à cette figurine (Ogodeï, Commandant…). */
  costRules: EquipmentCostRule[];
  grimoireId?: string;
  spellIds: string[];
  upgrades: string[];
  upgradeCounts?: Record<string, number>;
  munitions: Record<string, Record<string, number>>;
  /** Améliorations d'armes/armures sélectionnées, par équipement (ex. Empoisonner sur l'arme de Key). */
  equipmentUpgrades: Record<string, string[]>;
  /** Améliorations octroyées à cette figurine (définitions : coût + catégories concernées). */
  grantedUpgrades: { upgradeId: string; label: string; cost: number; equipmentCategories: string[] }[];
  onPick: (info: ItemInfo) => void;
}) {
  const WEAPON_CATS = ["arme-cac", "arme-tir", "bouclier", "armure"];
  const equip = [...p.baseEquipmentIds.filter((id) => !removed.includes(id)), ...added]
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const chip = (name: string, info: ItemInfo): SummaryChip => ({ name, info });
  // Arme : coût affiché = arme + ses munitions (règles p.46) + ses améliorations (ex. Empoisonner) ;
  // le détail est listé dans la fiche de l'objet.
  const armes = equip
    .filter((e) => WEAPON_CATS.includes(e.category))
    .map((e) => {
      const munLines = resolveMunitionLines(munitionKindForEquip(cat, e.id), munitions[e.id]);
      const munCost = munLines.reduce((n, l) => n + l.price, 0);
      const upsForE = (equipmentUpgrades[e.id] ?? [])
        .map((uid) => grantedUpgrades.find((g) => g.upgradeId === uid))
        .filter((g): g is (typeof grantedUpgrades)[number] => Boolean(g) && g!.equipmentCategories.includes(e.category));
      const upCost = upsForE.reduce((n, g) => n + g.cost, 0);
      // Remise (Ogodeï, Commandant…) : seulement sur les armes ACHETÉES (pas l'équipement de base).
      const disc = p.baseEquipmentIds.includes(e.id) ? 0 : equipmentDiscount(cat, e.id, costRules, removed);
      const discSources = [
        ...new Set(
          costRules
            .filter(
              (r) =>
                equipmentMatchesEquipFilter(cat, e.id, r) &&
                (!r.requiresBaseSwap || removed.some((id) => equipmentMatchesEquipFilter(cat, id, r))),
            )
            .map((r) => r.label),
        ),
      ];
      const base = equipInfo(e);
      if (munCost === 0 && upCost === 0 && disc === 0) return chip(e.name, base);
      return chip(e.name, {
        ...base,
        price: `${e.cost + munCost + upCost + disc} Ko`,
        lines: [
          ...base.lines,
          ...(munCost > 0
            ? [`Munitions (+${munCost} Ko) : ${munLines.map((l) => `${l.qty} ${l.label}`).join(", ")}`]
            : []),
          ...upsForE.map((g) => `${g.label} (+${g.cost} Ko)`),
          ...(disc < 0 ? [`Remise ${disc} Ko (${discSources.join(", ")})`] : []),
        ],
      });
    });
  const objets = equip.filter((e) => !WEAPON_CATS.includes(e.category)).map((e) => chip(e.name, equipInfo(e)));
  // N'affiche que les cartes automatiques (appliquées d'office) et les améliorations réellement sélectionnées.
  const cartes = specialCardsForProfile(p, cat)
    .filter((c) => !c.amelioration || upgrades.includes(c.id))
    .map((c) => {
      // Amélioration empilable : quantité × coût, avec « ×N » dans le nom.
      const qty = c.perLevelStack ? (upgradeCounts?.[c.id] ?? 1) : 1;
      return chip(qty > 1 ? `${c.name} ×${qty}` : c.name, {
        // Partagée : payée une fois pour le Fer de Lance → « … Ko · partagée » (pas un coût par ligne).
        title: c.name,
        price: c.shared
          ? `${c.cost > 0 ? `${c.cost} Ko · ` : ""}partagée`
          : c.cost > 0
            ? `${c.cost * qty} Ko`
            : "auto",
        lines: c.rulesText.map((r) => r.text),
      });
    });
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
        lines: spells.map((s) => `${s.name} - ${s.pages ?? 0} p${s.cost ? ` · ${s.cost} Ko` : ""}`),
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
  // Rien à acheter → pas de panneau (les erreurs sont affichées sur la ligne de la figurine).
  if (shown.length === 0) return null;
  return (
    <div className="bld-loadout">
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
