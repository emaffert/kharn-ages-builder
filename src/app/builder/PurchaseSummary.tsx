import { specialCardsForProfile } from "@ui/explain";
import {
  equipmentDiscount,
  equipmentMatchesEquipFilter,
  munitionKindForEquip,
  resolveMunitionLines,
  baseEquipmentCount,
  specialCardCost,
  temboEquipmentSurcharge,
  type Catalog,
  type EquipmentCostRule,
  type Profile,
  type Spell,
  upgradesForEquipment,
} from "@core";
import { equipInfo, mountOptionLines, type ItemInfo } from "./shared";

type SummaryChip = { name: string; info: ItemInfo };

/** Résumé compact des « achats » d'une figurine (replié sous la ligne) ; chaque objet ouvre sa fiche. */
export function PurchaseSummary({
  p,
  cat,
  added,
  addedCounts,
  removed,
  grimoireId,
  spellIds,
  grantedSpellIds,
  upgrades,
  upgradeCounts,
  munitions,
  equipmentUpgrades,
  grantedUpgrades,
  costRules,
  grimoireDiscount,
  mountId,
  mountOptionIds,
  factionId,
  onPick,
}: {
  p: Profile;
  cat: Catalog;
  /** Faction du Fer de Lance : révèle les cartes portées par la bannière (bonus des Affranchis). */
  factionId?: string;
  added: string[];
  /** Exemplaires achetés des objets empilables (id → quantité). */
  addedCounts?: Record<string, number>;
  removed: string[];
  /** Monture équipée (id de niveau) : active la colonne « Monture » (options payées par le cavalier). */
  mountId?: string;
  /** Options de monture achetées (`inst.mountOptionIds`) : id → valeur X. */
  mountOptionIds?: Record<string, number>;
  /** Règles de remise par objet applicables à cette figurine (Ogodeï, Commandant…). */
  costRules: EquipmentCostRule[];
  /** Réduction de prix de grimoire par palier (ex. Mochère), appliquée à la ligne « Magie ». */
  grimoireDiscount?: Record<string, number>;
  grimoireId?: string;
  spellIds: string[];
  /** Sorts offerts retenus, par effet qui les octroie : hors budget, mais leur prix en Ko reste dû. */
  grantedSpellIds?: Record<string, string[]>;
  upgrades: string[];
  upgradeCounts?: Record<string, number>;
  munitions: Record<string, Record<string, number>>;
  /** Améliorations d'armes/armures sélectionnées, par équipement (ex. Empoisonner sur l'arme de Key). */
  equipmentUpgrades: Record<string, string[]>;
  /** Améliorations octroyées à cette figurine (définitions : coût + catégories concernées). */
  grantedUpgrades: { upgradeId: string; label: string; cost: number; equipmentCategories: string[] }[];
  onPick: (info: ItemInfo) => void;
}) {
  const WEAPON_CATS = ["arme-cac", "arme-tir", "bouclier"];
  const equip = [...p.baseEquipmentIds.filter((id) => !removed.includes(id)), ...added]
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const chip = (name: string, info: ItemInfo): SummaryChip => ({ name, info });
  // Exemplaires : ceux de la carte pour l'équipement de base, ceux achetés sinon (objets empilables).
  const qtyOf = (e: NonNullable<(typeof equip)[number]>) =>
    p.baseEquipmentIds.includes(e.id) ? baseEquipmentCount(p, e.id) : (addedCounts?.[e.id] ?? 1);
  const label = (e: NonNullable<(typeof equip)[number]>) =>
    qtyOf(e) > 1 ? `${e.name} ×${qtyOf(e)}` : e.name;
  // Coût affiché d'un équipement = objet + ses munitions (p.46) + ses améliorations (ex. Empoisonner, Borax)
  // + une éventuelle remise (Ogodeï, Commandant…) ; le détail est listé dans la fiche de l'objet.
  const equipChip = (e: NonNullable<(typeof equip)[number]>): SummaryChip => {
    const munLines = resolveMunitionLines(munitionKindForEquip(cat, e.id), munitions[e.id]);
    const munCost = munLines.reduce((n, l) => n + l.price, 0);
    const available = upgradesForEquipment(e, grantedUpgrades);
    const upsForE = (equipmentUpgrades[e.id] ?? [])
      .map((uid) => available.find((u) => u.id === uid))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));
    const upCost = upsForE.reduce((n, u) => n + u.cost, 0);
    // Remise et surcoût Tembo (p.20) : seulement sur l'équipement ACHETÉ (pas l'équipement de base).
    const isBase = p.baseEquipmentIds.includes(e.id);
    const disc = isBase ? 0 : equipmentDiscount(cat, e.id, costRules, removed);
    const surcharge = isBase ? 0 : temboEquipmentSurcharge(cat, p.traits, e.id);
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
    const qty = qtyOf(e);
    const base = equipInfo(e, cat);
    if (munCost === 0 && upCost === 0 && disc === 0 && surcharge === 0 && qty === 1) return chip(label(e), base);
    return chip(label(e), {
      ...base,
      // Le total recalculé remplace le prix de catalogue : `prices` est vidé, sinon il primerait.
      prices: undefined,
      price: `${e.cost * qty + munCost + upCost + (disc + surcharge) * qty} Ko`,
      lines: [
        ...base.lines,
        ...(qty > 1 ? [`${qty} exemplaires (${e.cost} Ko l'unité)`] : []),
        ...(munCost > 0
          ? [`Munitions (+${munCost} Ko) : ${munLines.map((l) => `${l.qty} ${l.label}`).join(", ")}`]
          : []),
        ...upsForE.map((g) => `${g.label} (+${g.cost} Ko)`),
        ...(disc < 0 ? [`Remise ${disc} Ko (${discSources.join(", ")})`] : []),
        ...(surcharge > 0 ? [`Surcoût Tembo +${surcharge} Ko`] : []),
      ],
    });
  };
  const armes = equip.filter((e) => WEAPON_CATS.includes(e.category)).map(equipChip);
  const armures = equip.filter((e) => e.category === "armure").map(equipChip);
  // Le casque a son propre emplacement (p.14) : il se lit à part, comme l'armure.
  const casques = equip.filter((e) => e.category === "casque").map(equipChip);
  const objets = equip
    .filter((e) => !WEAPON_CATS.includes(e.category) && e.category !== "armure" && e.category !== "casque")
    .map(equipChip);
  // Monture : options payées par le cavalier (paniers « cavalier » + « partagée »), groupées en « Compétences ».
  const monture: SummaryChip[] = [];
  if (mountId != null) {
    const lines = mountOptionLines(cat, mountOptionIds, ["rider", "both"], mountId);
    if (lines.length > 0) {
      const total = lines.reduce((n, l) => n + l.cost, 0);
      monture.push(
        chip("Compétences", {
          title: "Compétences de monture (cavalier)",
          price: `+${total} Ko`,
          lines: lines.map((l) => `${l.label} (+${l.cost} Ko)`),
        }),
      );
    }
  }
  // N'affiche que les cartes automatiques (appliquées d'office) et les améliorations réellement sélectionnées.
  const cartes = specialCardsForProfile(p, cat, factionId)
    .filter((c) => !c.amelioration || upgrades.includes(c.id))
    .map((c) => {
      // Amélioration empilable : quantité × coût, avec « ×N » dans le nom.
      const qty = c.perLevelStack ? (upgradeCounts?.[c.id] ?? 1) : 1;
      const unit = specialCardCost(c, p);
      return chip(qty > 1 ? `${c.name} ×${qty}` : c.name, {
        // Partagée : payée une fois pour le Fer de Lance → « … Ko · partagée » (pas un coût par ligne).
        title: c.name,
        price: c.shared
          ? `${unit > 0 ? `${unit} Ko · ` : ""}partagée`
          : unit > 0
            ? `${unit * qty} Ko`
            : "auto",
        lines: [c.rulesText],
      });
    });
  // Magie : le grimoire acheté (avec son coût) puis une entrée « N sorts » (coût total).
  const magie: SummaryChip[] = [];
  const grim = grimoireId ? cat.grimoires.find((g) => g.id === grimoireId) : undefined;
  if (grim) {
    const disc = Math.min(grimoireDiscount?.[grim.id] ?? 0, grim.cost);
    magie.push(
      chip(grim.name, {
        title: grim.name,
        price: `${grim.cost - disc} Ko`,
        lines: [
          `${grim.pages === "illimite" ? "∞" : grim.pages} pages`,
          ...(disc > 0 ? [`🐎 Réduction monture : −${disc} Ko${disc >= grim.cost ? " (offert)" : ""}`] : []),
        ],
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
  // Sorts offerts : hors budget de pages et de niveaux, mais ils gardent leur prix en Kouronnes.
  const offered = [...new Set(Object.values(grantedSpellIds ?? {}).flat())]
    .map((id) => cat.spells.find((s) => s.id === id))
    .filter((s): s is Spell => Boolean(s));
  if (offered.length > 0) {
    magie.push(
      chip(`${offered.length} sort${offered.length > 1 ? "s" : ""} offert${offered.length > 1 ? "s" : ""}`, {
        title: "Sorts offerts",
        price: `${offered.reduce((n, s) => n + (s.cost ?? 0), 0)} Ko`,
        lines: [
          "Sans grimoire, hors budget de pages et de niveaux.",
          ...offered.map((s) => `${s.name}${s.cost ? ` · ${s.cost} Ko` : ""}`),
        ],
      }),
    );
  }
  const rows: [string, SummaryChip[]][] = [
    ["Armes", armes],
    ["Armure", armures],
    ["Casque", casques],
    ["Équipement", objets],
    ["Cartes", cartes],
    ["Magie", magie],
    ["Monture", monture],
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
