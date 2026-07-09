import type { Catalog, ProfileInstance } from "@core";
import { equipInfo, mountOptionLines, type ItemInfo } from "./shared";

type Chip = { name: string; info: ItemInfo };

/**
 * Résumé compact des « achats » d'une monture (sous sa sous-ligne) : colonnes « Équipement » (Caparaçon
 * + ses améliorations) et « Options » (options du panier « monture » groupées en « Compétences +X Ko »).
 * La somme correspond aux suppléments du coût de monture (le niveau de base est porté par la sous-ligne).
 */
export function MountPurchaseSummary({
  cat,
  factionId,
  mount,
  mountOptionIds,
  onPick,
}: {
  cat: Catalog;
  factionId?: string;
  mount: NonNullable<ProfileInstance["mount"]>;
  mountOptionIds?: Record<string, number>;
  onPick: (info: ItemInfo) => void;
}) {
  const chip = (name: string, info: ItemInfo): Chip => ({ name, info });
  const equipCostOf = (e: Catalog["equipment"][number]) =>
    e.costByFaction && factionId != null && e.costByFaction[factionId] != null ? e.costByFaction[factionId] : e.cost;

  const equipements: Chip[] = (mount.addedEquipmentIds ?? [])
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => {
      const ups = (mount.equipmentUpgrades?.[e.id] ?? [])
        .map((uid) => e.upgrades?.find((u) => u.id === uid))
        .filter((u): u is NonNullable<typeof u> => Boolean(u));
      const upCost = ups.reduce((n, u) => n + u.cost, 0);
      const base = equipInfo(e);
      return chip(e.name, {
        ...base,
        price: `${equipCostOf(e) + upCost} Ko`,
        lines: [...base.lines, ...ups.map((u) => `${u.label} (+${u.cost} Ko)`)],
      });
    });

  const options: Chip[] = [];
  const lines = mountOptionLines(cat, mountOptionIds, ["mount"], mount.mountId);
  if (lines.length > 0) {
    const total = lines.reduce((n, l) => n + l.cost, 0);
    options.push(
      chip("Compétences", {
        title: "Compétences de monture",
        price: `+${total} Ko`,
        lines: lines.map((l) => `${l.label} (+${l.cost} Ko)`),
      }),
    );
  }

  const rows: [string, Chip[]][] = [
    ["Équipement", equipements],
    ["Options", options],
  ];
  const shown = rows.filter(([, v]) => v.length > 0);
  if (shown.length === 0) return null;

  return (
    <div className="bld-loadout">
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
    </div>
  );
}
