import { useState } from "react";
import { SegmentedControl } from "@ui";
import { eligibleMountsFor, mountSheetSkills, type Catalog, type GrantedSkill, type Mount, type MountType, type Profile } from "@core";
import { type ItemInfo } from "./shared";

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

/** Fiche de la monture (façon fiche de profil) : stats apportées / propres, compétences cliquables, règles. */
export function MountStatCard({
  cat,
  mount,
  type,
  rider,
  onInfo,
}: {
  cat: Catalog;
  mount: Mount;
  type?: MountType;
  /** Cavalier (si connu) : applique la transmission des 3 compétences + règle « meilleure valeur ». */
  rider?: Profile;
  onInfo: (info: ItemInfo) => void;
}) {
  const b = mount.bonuses ?? {};
  const shared = SHARED_STATS.filter(([k]) => b[k] != null && b[k] !== 0);
  const skills: GrantedSkill[] = rider ? mountSheetSkills(mount, rider) : (mount.grantedSkills ?? []);
  const icon = mountIcon(cat, mount, type);
  const skillName = (id: string) => cat.skills.find((s) => s.id === id)?.keyword ?? id;
  const showSkill = (skillId: string, label: string) => {
    const sk = cat.skills.find((x) => x.id === skillId);
    onInfo({ title: label, price: "compétence", lines: [sk?.sourceText ?? "Description indisponible."] });
  };
  return (
    <div className="fe-statcard fe-statcard--mount">
      <div className="fe-card">
        <div className="fe-card-head">
          <div className="fe-headmain">
            {icon && <img className="fe-portrait" src={icon} alt="" />}
            <h3 className="fe-card-name">
              {type?.name ?? mount.typeId}
              <span className="lvl">{ROMAN[mount.level] ?? mount.level}</span>
            </h3>
          </div>
          <span className="fe-cost-chip">{mount.cost} Ko</span>
        </div>

        <div className="fe-mstats">
          {shared.length > 0 && (
            <div className="fe-mstat-grp">
              <div className="fe-substat-cap">Apporte au cavalier</div>
              <div className="fe-statrow">
                {shared.map(([k, lab]) => (
                  <span key={k} className="fe-stat">
                    <span className="k">{lab}</span>
                    <span className="v is-fx">
                      {b[k]! > 0 ? "+" : ""}
                      {b[k]}
                    </span>
                  </span>
                ))}
                {b.allonge != null && b.allonge !== 0 && (
                  <span className="fe-stat">
                    <span className="k">Allonge</span>
                    <span className="v is-fx">
                      {b.allonge > 0 ? "+" : ""}
                      {b.allonge}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
          {(b.pv != null || b.stature != null) && (
            <div className="fe-mstat-grp">
              <div className="fe-substat-cap">Propre à la monture</div>
              <div className="fe-statrow">
                {b.pv != null && (
                  <span className="fe-stat">
                    <span className="k">PV</span>
                    <span className="v">{b.pv}</span>
                  </span>
                )}
                {b.stature != null && (
                  <span className="fe-stat">
                    <span className="k">Stature</span>
                    <span className="v">{b.stature}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {skills.length > 0 && (
          <div className="fe-skills">
            {skills.map((s, i) => {
              const label = `${skillName(s.skillId)}${s.value != null ? ` ${s.value}` : ""}`;
              return (
                <button key={i} className="fe-skill" onClick={() => showSkill(s.skillId, label)}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {(mount.rules ?? []).length > 0 && (
          <div className="fe-rules">
            {(mount.rules ?? []).map((r, i) => (
              <div key={i}>
                {r.label && (
                  <b>
                    {r.label}
                    {r.text ? " : " : ""}
                  </b>
                )}
                {r.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
