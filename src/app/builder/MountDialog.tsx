import { useState } from "react";
import { SegmentedControl } from "@ui";
import { eligibleMountsFor, mountOptionSkills, mountSheetSkills, type Catalog, type GrantedSkill, type Mount, type MountType, type Profile, type ProfileInstance } from "@core";
import { wornArmorsFrom, type ItemInfo } from "./shared";
import { MountEquipEditor, MountOptionsEditor } from "./MountOptions";
import { ArmorBlock, RulesBlock, SheetHeader, SkillChips, StatCell } from "./StatSheet";

/**
 * Deux surfaces distinctes pour les montures :
 * - `MountPicker` : petite modale de choix (comme les Likans), n'exposant que les montures éligibles ;
 * - `MountStatCard` : fiche de la monture façon fiche de profil (stats, compétences cliquables, règles).
 */
const ROMAN = ["", "I", "II", "III"];
const SHARED_STATS: [keyof NonNullable<Mount["bonuses"]>, string][] = [
  ["v", "V"],
  ["p", "P"],
  ["a", "A"],
  ["c", "C"],
  ["pa", "PA"],
];
const BONUS_ORDER: [keyof NonNullable<Mount["bonuses"]>, string][] = [
  ["v", "V"],
  ["p", "P"],
  ["a", "A"],
  ["c", "C"],
  ["pa", "PA"],
  ["pv", "PV"],
  ["stature", "stature"],
  ["allonge", "allonge"],
];

/** Résumé compact des bonus dérivé des stats (pour la ligne de choix). */
function bonusSummary(b: NonNullable<Mount["bonuses"]>): string {
  return BONUS_ORDER.filter(([k]) => b[k] != null && b[k] !== 0)
    .map(([k, lab]) => `${b[k]! > 0 ? "+" : ""}${b[k]} ${lab}`)
    .join(" · ");
}

/** Icône affichée pour une monture : propre au niveau, sinon partagée par le type. */
function mountIcon(cat: Catalog, mount: Mount, type?: MountType): string | undefined {
  return mount.icon ?? (type?.cardImage ? cat.icons?.[type.cardImage] : undefined);
}

/** Petite modale de choix : uniquement les montures éligibles au cavalier (filtre moteur). */
export function MountPicker({
  cat,
  rider,
  currentId,
  onSet,
}: {
  cat: Catalog;
  rider: Profile;
  currentId?: string;
  onSet: (mountId: string | null) => void;
}) {
  const eligible = [...eligibleMountsFor(cat, rider)].sort(
    (a, b) => a.typeId.localeCompare(b.typeId) || a.level - b.level,
  );
  if (eligible.length === 0) return <p className="mdl-note">Aucune monture éligible pour cette figurine.</p>;
  return (
    <div className="mdl-list">
      {eligible.map((m) => {
        const type = cat.mountTypes.find((t) => t.id === m.typeId);
        const active = currentId === m.id;
        const summary = m.bonuses ? bonusSummary(m.bonuses) : "";
        return (
          <button
            key={m.id}
            className={`mdl-choice${active ? " is-active" : ""}`}
            onClick={() => onSet(active ? null : m.id)}
          >
            <span>
              {type?.name ?? m.typeId} <span className="lvl">{ROMAN[m.level] ?? m.level}</span>
              {summary && <span className="mdl-choice-sub">{summary}</span>}
            </span>
            <span className="cost">{m.cost} Ko</span>
          </button>
        );
      })}
    </div>
  );
}

/** Aperçu d'un type de monture (roster) : sélecteur de niveau (comme les profils) + fiche du niveau choisi. */
export function MountPreview({
  cat,
  typeId,
  onInfo,
}: {
  cat: Catalog;
  typeId: string;
  onInfo: (info: ItemInfo) => void;
}) {
  const type = cat.mountTypes.find((t) => t.id === typeId);
  const levels = cat.mounts.filter((m) => m.typeId === typeId).sort((a, b) => a.level - b.level);
  const [id, setId] = useState(levels[0]?.id ?? "");
  const m = levels.find((x) => x.id === id) ?? levels[0];
  if (!m) return <p className="mdl-note">Aucun niveau défini pour cette monture.</p>;
  return (
    <>
      {levels.length > 1 && (
        <div className="mb-3">
          <SegmentedControl
            ariaLabel="Niveau"
            value={m.id}
            onChange={setId}
            options={levels.map((l) => ({ value: l.id, label: `${ROMAN[l.level] ?? l.level} · ${l.cost}` }))}
          />
        </div>
      )}
      <MountStatCard cat={cat} mount={m} type={type} onInfo={onInfo} />
    </>
  );
}

/**
 * Fiche éditable de la monture d'une figurine : onglets « Carte » (stats + compétences, achats compris),
 * « Équipement » (Caparaçon + ses améliorations) et « Options » (options de monture + partagées), comme un profil.
 */
export function MountSheet({
  cat,
  mount,
  type,
  rider,
  instance,
  onInfo,
  onSetOption,
  onToggleEquip,
  onToggleEquipUpgrade,
}: {
  cat: Catalog;
  mount: Mount;
  type?: MountType;
  rider: Profile;
  instance: ProfileInstance;
  onInfo: (info: ItemInfo) => void;
  onSetOption: (optionId: string, value: number | null) => void;
  onToggleEquip: (equipId: string) => void;
  onToggleEquipUpgrade: (equipId: string, upgradeId: string) => void;
}) {
  const [tab, setTab] = useState<"carte" | "equip" | "options">("carte");
  const TABS: [typeof tab, string][] = [
    ["carte", "Carte"],
    ["equip", "Équipement"],
    ["options", "Options"],
  ];
  return (
    <div className="fe-root">
      <div className="fe-tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className="ui-tab"
            data-state={tab === id ? "active" : "inactive"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "carte" && (
        <MountStatCard cat={cat} mount={mount} type={type} rider={rider} instance={instance} onInfo={onInfo} />
      )}
      {tab === "equip" && (
        <MountEquipEditor
          cat={cat}
          factionId={rider.factionId}
          equipped={instance.mount?.addedEquipmentIds ?? []}
          upgrades={instance.mount?.equipmentUpgrades ?? {}}
          onToggleEquip={onToggleEquip}
          onToggleUpgrade={onToggleEquipUpgrade}
        />
      )}
      {tab === "options" && (
        <MountOptionsEditor
          cat={cat}
          mountId={mount.id}
          factionId={rider.factionId}
          selected={instance.mountOptionIds ?? {}}
          buckets={["mount", "both"]}
          onSetOption={onSetOption}
        />
      )}
    </div>
  );
}

/** Fiche de la monture (façon fiche de profil) : stats apportées / propres, compétences cliquables, règles. */
export function MountStatCard({
  cat,
  mount,
  type,
  rider,
  instance,
  onInfo,
}: {
  cat: Catalog;
  mount: Mount;
  type?: MountType;
  /** Cavalier (si connu) : applique la transmission des 3 compétences + règle « meilleure valeur ». */
  rider?: Profile;
  /** Instance du cavalier (si connue) : intègre les options achetées (monture + partagées + transmises). */
  instance?: ProfileInstance;
  onInfo: (info: ItemInfo) => void;
}) {
  const b = mount.bonuses ?? {};
  const shared = SHARED_STATS.filter(([k]) => b[k] != null && b[k] !== 0);
  const skills: GrantedSkill[] = rider
    ? mountSheetSkills(mount, rider, {
        mountBought: instance ? mountOptionSkills(cat, instance, ["mount", "both"]) : [],
        riderBought: instance ? mountOptionSkills(cat, instance, ["rider", "both"]) : [],
      })
    : (mount.grantedSkills ?? []);
  // Compétences issues d'une option achetée (tous paniers) → affichées en braise (fx) sur la fiche.
  // Une compétence de panier « cavalier » non transmise n'est pas affichée ici : la marquer est sans effet.
  const boughtSkillIds = new Set(
    instance ? mountOptionSkills(cat, instance, ["mount", "both", "rider"]).map((s) => s.skillId) : [],
  );
  const icon = mountIcon(cat, mount, type);
  const skillName = (id: string) => cat.skills.find((s) => s.id === id)?.keyword ?? id;
  const showSkill = (skillId: string, label: string) => {
    const sk = cat.skills.find((x) => x.id === skillId);
    onInfo({ title: label, price: "compétence", lines: [sk?.sourceText ?? "Description indisponible."] });
  };
  const fmtDelta = (n: number) => `${n > 0 ? "+" : ""}${n}`;
  return (
    <div className="fe-statcard fe-statcard--mount">
      <div className="fe-card">
        <SheetHeader
          icon={icon}
          name={type?.name ?? mount.typeId}
          level={ROMAN[mount.level] ?? mount.level}
          cost={`${mount.cost} Ko`}
        />

        <div className="fe-mstats">
          {shared.length > 0 && (
            <div className="fe-mstat-grp">
              <div className="fe-substat-cap">Apporte au cavalier</div>
              <div className="fe-statrow">
                {shared.map(([k, lab]) => (
                  <StatCell key={k} label={lab} value={fmtDelta(b[k]!)} fx />
                ))}
                {b.allonge != null && b.allonge !== 0 && (
                  <StatCell label="Allonge" value={fmtDelta(b.allonge)} fx />
                )}
              </div>
            </div>
          )}
          {(b.pv != null || b.stature != null) && (
            <div className="fe-mstat-grp">
              <div className="fe-substat-cap">Propre à la monture</div>
              <div className="fe-statrow">
                {b.pv != null && <StatCell label="PV" value={b.pv} />}
                {b.stature != null && <StatCell label="Stature" value={b.stature} />}
              </div>
            </div>
          )}
        </div>

        <ArmorBlock
          armors={wornArmorsFrom(
            cat,
            instance?.mount?.addedEquipmentIds ?? [],
            instance?.mount?.equipmentUpgrades ?? {},
          )}
        />

        <SkillChips
          skills={skills.map((s, i) => {
            const label = `${skillName(s.skillId)}${s.value != null ? ` ${s.value}` : ""}`;
            return { key: String(i), label, fx: boughtSkillIds.has(s.skillId), onClick: () => showSkill(s.skillId, label) };
          })}
        />

        <RulesBlock rules={mount.rules ?? []} />
      </div>
    </div>
  );
}
