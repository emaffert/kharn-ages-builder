import type { ReactNode } from "react";

/**
 * Atomes de rendu partagés par les fiches de profil (`ProfileStatCard`) et de monture (`MountStatCard`) :
 * en-tête, cellule de stat, bloc d'armure, pastilles de compétence, bloc de règles. Ils portent le
 * markup/les classes communs pour éviter la duplication ; chaque fiche construit les *données* à leur façon.
 */

/** En-tête de carte : portrait + nom (+ niveau) + pastille de coût. */
export function SheetHeader({
  icon,
  name,
  level,
  cost,
}: {
  icon?: string;
  name: ReactNode;
  /** Libellé de niveau (ex. « II ») ; omis si absent. */
  level?: ReactNode;
  /** Libellé de coût complet (ex. « 45 Ko ») ; omis si absent. */
  cost?: ReactNode;
}) {
  return (
    <div className="fe-card-head">
      <div className="fe-headmain">
        {icon && <img className="fe-portrait" src={icon} alt="" />}
        <h3 className="fe-card-name">
          {name}
          {level ? <span className="lvl">{level}</span> : null}
        </h3>
      </div>
      {cost != null && <span className="fe-cost-chip">{cost}</span>}
    </div>
  );
}

/** Cellule de caractéristique. `fx` = modifiée par un effet (braise) ; cliquable si `onClick` fourni (source). */
export function StatCell({
  label,
  value,
  fx,
  onClick,
}: {
  label: string;
  value: ReactNode;
  fx?: boolean;
  onClick?: () => void;
}) {
  const v = value ?? "-";
  return (
    <span className="fe-stat">
      <span className="k">{label}</span>
      {fx && onClick ? (
        <button className="v is-fx" title="Modifiée par un effet - voir la source" onClick={onClick}>
          {v}
        </button>
      ) : fx ? (
        <span className="v is-fx">{v}</span>
      ) : (
        <span className="v">{v}</span>
      )}
    </span>
  );
}

/** Une armure à afficher (protection échec / seuil / réussite + durabilité), innée ou portée. */
export type ArmorDisplay = {
  label: ReactNode;
  protectionEchec?: number;
  seuil?: number;
  protectionReussite?: number;
  durability?: number;
};

const fmtArmor = (n: number | undefined) => (n == null ? "-" : n > 0 ? `+${n}` : String(n));

/** Bloc(s) d'armure : une ligne par armure (innée puis armures portées). */
export function ArmorBlock({ armors }: { armors: ArmorDisplay[] }) {
  return (
    <>
      {armors.map((a, i) => (
        <div
          key={i}
          className="fe-armor"
          title="Armure - protection en cas d'échec / seuil / protection en cas de réussite"
        >
          <span className="fe-armor-lab">{a.label}</span>
          <span className="fe-armor-vals">
            {fmtArmor(a.protectionEchec)} <i>/</i> {a.seuil ?? "-"} <i>/</i> {fmtArmor(a.protectionReussite)}
          </span>
          {a.durability != null && <span className="fe-armor-dur">durabilité {a.durability}</span>}
        </div>
      ))}
    </>
  );
}

/** Une compétence cliquable. `fx` = affichée comme modifiée (braise). */
export type SkillChip = { key: string; label: string; fx?: boolean; onClick: () => void };

/** Liste de pastilles de compétences (le conteneur est toujours rendu, même vide). */
export function SkillChips({ skills }: { skills: SkillChip[] }) {
  return (
    <div className="fe-skills">
      {skills.map((s) => (
        <button
          key={s.key}
          className={`fe-skill${s.fx ? " is-fx" : ""}`}
          onClick={s.onClick}
          title={s.fx ? "Compétence ou valeur modifiée par un effet" : undefined}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** Bloc « règles de la carte » : règles verbatim + précisions de compétences (cliquables). */
export function RulesBlock({
  rules,
  precisions = [],
}: {
  rules: { label?: string; text?: string }[];
  precisions?: { label: string; precision?: string; onClick: () => void }[];
}) {
  if (rules.length === 0 && precisions.length === 0) return null;
  return (
    <div className="fe-rules">
      {rules.map((r, i) => (
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
      {precisions.map((s, i) => (
        <div key={`prec-${i}`}>
          <button className="fe-rule-btn" onClick={s.onClick}>
            {s.label}
          </button>{" "}
          : {s.precision}
        </div>
      ))}
    </div>
  );
}
