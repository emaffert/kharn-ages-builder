import { useState } from "react";
import type { Profile, Catalog } from "@core";
import { ProfileStatCard, type ProfileMods } from "./ProfileStatCard";
import { MountOptionsEditor } from "./MountOptions";
import { EquipPanel } from "./EquipPanel";
import { MagiePanel } from "./MagiePanel";
import { canBuy, castWays, wornArmorsFrom, type ItemInfo } from "./shared";

/**
 * Éditeur d'une figurine (onglets Carte / Équipement / Améliorations / Magie) et ses panneaux.
 * Piloté par des callbacks du store (aucun état de liste local ici). Rendu dans un Dialog du kit
 * (le Dialog fournit le titre, la fermeture et le pied). Les panneaux lourds sont extraits :
 * `EquipPanel` (choix d'équipement), `MagiePanel` (grimoire + sorts).
 */

/** Éditeur d'une figurine en **onglets** (Carte / Équipement / Magie / Monture), sans sous-modale. */
export function FigureEditor({
  profile: p,
  cat,
  added,
  removed,
  upgrades,
  grimoire,
  spells,
  onAdd,
  onRemove,
  onToggleBase,
  munitions,
  onMunTier,
  onToggleUpgrade,
  upgradeCounts,
  onSetUpgradeCount,
  onGrimoire,
  onToggleSpell,
  onInfo,
  equipmentUpgrades,
  onToggleEquipmentUpgrade,
  mods,
  mountId,
  mountOptionIds,
  onSetMountOption,
}: {
  profile: Profile;
  cat: Catalog;
  added: string[];
  removed: string[];
  upgrades: string[];
  grimoire: "none" | "petit" | "grand";
  spells: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleBase: (id: string) => void;
  munitions: Record<string, Record<string, number>>;
  onMunTier: (equipId: string, typeId: string, tierIndex: number | null) => void;
  onToggleUpgrade: (id: string) => void;
  upgradeCounts?: Record<string, number>;
  onSetUpgradeCount: (id: string, qty: number) => void;
  onGrimoire: (g: "none" | "petit" | "grand") => void;
  onToggleSpell: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
  equipmentUpgrades: Record<string, string[]>;
  onToggleEquipmentUpgrade: (equipmentId: string, upgradeId: string) => void;
  mods?: ProfileMods;
  /** Monture de la figurine (si montée) : active l'onglet « Monture » (options réservées au cavalier). */
  mountId?: string;
  mountOptionIds?: Record<string, number>;
  onSetMountOption?: (optionId: string, value: number | null) => void;
}) {
  const activeBase = p.baseEquipmentIds.filter((id) => !removed.includes(id));
  const ways = castWays(p, cat, upgrades, [...activeBase, ...added], (mods?.grantedSkills ?? []).map((g) => g.skillId));
  const castable = ways.length > 0;

  // Les améliorations se cochent désormais directement dans l'onglet « Carte » (plus d'onglet dédié).
  type TabId = "carte" | "equip" | "magie" | "monture";
  const tabs = [
    { id: "carte" as const, label: "Carte" },
    canBuy(p, cat) && { id: "equip" as const, label: "Équipement" },
    (castable || spells.length > 0) && { id: "magie" as const, label: "Magie" },
    mountId != null && { id: "monture" as const, label: "Monture" },
  ].filter(Boolean) as { id: TabId; label: string }[];
  const [tab, setTab] = useState<TabId>("carte");
  const active = tabs.some((t) => t.id === tab) ? tab : "carte";

  return (
    <div className="fe-root">
      {tabs.length > 1 && (
        <div className="fe-tabs">
          {tabs.map((t) => (
            <button key={t.id} className="ui-tab" data-state={active === t.id ? "active" : "inactive"} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {active === "carte" && (
        <ProfileStatCard
          p={p}
          cat={cat}
          onInfo={onInfo}
          upgrades={upgrades}
          onToggleUpgrade={onToggleUpgrade}
          upgradeCounts={upgradeCounts}
          onSetUpgradeCount={onSetUpgradeCount}
          mods={mods}
          wornArmors={wornArmorsFrom(cat, [...activeBase, ...added], undefined, p.armor)}
        />
      )}
      {active === "equip" && (
        <EquipPanel
          profile={p}
          cat={cat}
          added={added}
          removed={removed}
          onAdd={onAdd}
          onRemove={onRemove}
          onToggleBase={onToggleBase}
          munitions={munitions}
          onMunTier={onMunTier}
          onInfo={onInfo}
          grantedUpgrades={mods?.grantedUpgrades ?? []}
          costRules={mods?.equipmentCostRules ?? []}
          equipmentUpgrades={equipmentUpgrades}
          onToggleEquipmentUpgrade={onToggleEquipmentUpgrade}
          hasMount={mountId != null}
        />
      )}
      {active === "magie" && (
        <MagiePanel
          profile={p}
          cat={cat}
          upgrades={upgrades}
          grimoire={grimoire}
          spells={spells}
          ways={ways}
          wornEquipIds={[...activeBase, ...added]}
          onGrimoire={onGrimoire}
          onToggleSpell={onToggleSpell}
          onInfo={onInfo}
          grimoireDiscount={mods?.grimoireDiscount}
        />
      )}
      {active === "monture" && (
        <div className="fe-root">
          <p className="fe-opt-intro">
            Compétences débloquées par la monture (réservées au cavalier ou partagées avec la monture). La
            Lance de cavalerie, elle, s'achète dans l'onglet « Équipement ».
          </p>
          <MountOptionsEditor
            cat={cat}
            mountId={mountId}
            factionId={p.factionId}
            selected={mountOptionIds ?? {}}
            buckets={["rider", "both"]}
            onSetOption={(oid, v) => onSetMountOption?.(oid, v)}
          />
        </div>
      )}
    </div>
  );
}
