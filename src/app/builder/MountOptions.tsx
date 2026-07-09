import { mountKindOf, mountOptionCostOf, type Catalog } from "@core";

/**
 * Achat des options d'un cavalier monté / de sa monture (règles de bataille p.32). Selon la surface :
 * - onglet « Monture » du cavalier : `buckets = ["rider","both"]` ;
 * - fiche de la monture, onglet « Options » : `buckets = ["mount","both"]`.
 * Les options partagées (`both`) apparaissent des deux côtés et pointent sur le même stockage : cochée d'un
 * côté, elle l'est de l'autre, sans surcoût. Seules les options éligibles sont proposées.
 * (L'équipement de monture, ex. Caparaçon, s'achète dans l'onglet « Équipement » via `MountEquipEditor`.)
 */
export function MountOptionsEditor({
  cat,
  mountId,
  factionId,
  selected,
  buckets,
  onSetOption,
}: {
  cat: Catalog;
  mountId?: string;
  factionId?: string;
  /** Options achetées de la figurine (`inst.mountOptionIds`) : id → valeur X. */
  selected: Record<string, number>;
  buckets: Array<"mount" | "rider" | "both">;
  onSetOption: (optionId: string, value: number | null) => void;
}) {
  const kind = mountKindOf(cat, mountId);
  const optOk = (o: Catalog["mountOptions"][number]) =>
    buckets.includes(o.bucket) &&
    (!o.reservation?.factions || (factionId != null && o.reservation.factions.includes(factionId))) &&
    (!o.reservation?.mountKinds || (kind != null && o.reservation.mountKinds.includes(kind)));
  const options = cat.mountOptions.filter(optOk);

  if (options.length === 0)
    return <p className="fe-opt-empty">Aucune option disponible pour cette monture.</p>;

  return (
    <div className="fe-opts">
      {options.map((o) => {
        const val = selected[o.id] ?? 0;
        const on = val > 0;
        if (o.maxValue != null) {
          return (
            <div key={o.id} className={`fe-opt${on ? " on" : ""}`}>
              <span className="fe-opt-name">
                {o.name}
                {o.bucket === "both" && <span className="fe-opt-badge">partagée</span>}
              </span>
              <div className="fe-opt-x">
                {Array.from({ length: o.maxValue + 1 }, (_, x) => (
                  <button
                    key={x}
                    type="button"
                    className={`fe-opt-xbtn${val === x ? " on" : ""}`}
                    onClick={() => onSetOption(o.id, x === 0 ? null : x)}
                  >
                    {x === 0 ? "–" : x}
                  </button>
                ))}
              </div>
              <span className="fe-opt-cost">{on ? `${mountOptionCostOf(o, val, kind)} Ko` : ""}</span>
            </div>
          );
        }
        return (
          <label key={o.id} className={`fe-opt${on ? " on" : ""}`}>
            <input type="checkbox" checked={on} onChange={() => onSetOption(o.id, on ? null : 1)} />
            <span className="fe-opt-name">
              {o.name}
              {o.bucket === "both" && <span className="fe-opt-badge">partagée</span>}
            </span>
            <span className="fe-opt-cost">{mountOptionCostOf(o, 1, kind)} Ko</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Onglet « Équipement » de la monture : équiper l'équipement porté par la monture (ex. Caparaçon) et
 * cocher ses améliorations intrinsèques (ex. Pointes acérées). Ressemble à l'onglet équipement des profils.
 */
export function MountEquipEditor({
  cat,
  factionId,
  equipped,
  upgrades,
  onToggleEquip,
  onToggleUpgrade,
}: {
  cat: Catalog;
  factionId?: string;
  /** Équipement de monture présent (`inst.mount.addedEquipmentIds`). */
  equipped: string[];
  /** Améliorations achetées par objet (`inst.mount.equipmentUpgrades`). */
  upgrades: Record<string, string[]>;
  onToggleEquip: (equipId: string) => void;
  onToggleUpgrade: (equipId: string, upgradeId: string) => void;
}) {
  const costOf = (e: Catalog["equipment"][number]) =>
    e.costByFaction && factionId != null && e.costByFaction[factionId] != null ? e.costByFaction[factionId] : e.cost;
  const equipments = cat.equipment.filter(
    (e) =>
      e.mountEquipment === "mount" &&
      (!e.reservedTo?.factionIds || (factionId != null && e.reservedTo.factionIds.includes(factionId))),
  );

  if (equipments.length === 0)
    return <p className="fe-opt-empty">Aucun équipement disponible pour cette monture.</p>;

  return (
    <div className="fe-opts">
      {equipments.map((e) => {
        const on = equipped.includes(e.id);
        const active = upgrades[e.id] ?? [];
        return (
          <div key={e.id} className="fe-equip-item">
            <label className={`fe-opt${on ? " on" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => onToggleEquip(e.id)} />
              <span className="fe-opt-name">
                {e.name}
                <span className="fe-opt-badge">équipement</span>
              </span>
              <span className="fe-opt-cost">{costOf(e)} Ko</span>
              {e.effectsText && <span className="fe-opt-note">{e.effectsText}</span>}
            </label>
            {on && (e.upgrades?.length ?? 0) > 0 && (
              <div className="fe-upgrades">
                {e.upgrades!.map((u) => (
                  <label key={u.id} className="fe-upgrade">
                    <input
                      type="checkbox"
                      className="ui-check"
                      checked={active.includes(u.id)}
                      onChange={() => onToggleUpgrade(e.id, u.id)}
                    />
                    <span>{u.label}</span>
                    <span className="fe-upgrade-cost">+{u.cost} Ko</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
