import type { ReactNode } from "react";
import { Tag } from "@ui";
import type { FieldValue } from "../useCatalogStore";

/** Composants de présentation réutilisables de l'admin (stylés sur admin.css). */

/** Icônes originales évoquant les 5 domaines de maîtrise (cf. livret p.7). */
export function DomainIcon({ domain, className = "h-4 w-4" }: { domain: string; className?: string }) {
  const common = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (domain) {
    case "offensive": // épées croisées
      return (
        <svg {...common}>
          <path d="M3 13 13 3" />
          <path d="M13 13 3 3" />
        </svg>
      );
    case "defensive": // bouclier
      return (
        <svg {...common}>
          <path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z" />
        </svg>
      );
    case "objectif": // fanion
      return (
        <svg {...common}>
          <path d="M5 2v12" />
          <path d="M5 3h7l-2 2 2 2H5" />
        </svg>
      );
    case "tir": // arc et flèche
      return (
        <svg {...common}>
          <path d="M4 3a8 8 0 0 1 0 10" />
          <path d="M2 8h11" />
          <path d="M11 6l2 2-2 2" />
        </svg>
      );
    case "esoterique": // étincelle
      return (
        <svg {...common}>
          <path d="M8 2l1.2 4.8L14 8l-4.8 1.2L8 14l-1.2-4.8L2 8l4.8-1.2z" />
        </svg>
      );
    default:
      return null;
  }
}

/** Pastille de règle — réutilise `@ui` Tag (mêmes tons que le builder). */
export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const map: Record<string, "neutral" | "warn" | "amber" | "moss"> = {
    slate: "neutral",
    red: "warn",
    amber: "amber",
    green: "moss",
    violet: "neutral",
  };
  return <Tag tone={map[tone] ?? "neutral"}>{children}</Tag>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="adm-section-title">{title}</h3>
      {children}
    </section>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="adm-add">
      {children}
    </button>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Supprimer" className="adm-x">
      ✕
    </button>
  );
}

export function FlagButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Lecture incertaine (cliquer pour valider)" : "Marquer comme « à vérifier »"}
      className={`leading-none transition-opacity ${
        active ? "adm-flag adm-flag--on" : "adm-flag opacity-0 group-hover:opacity-100"
      }`}
    >
      ⚠
    </button>
  );
}

export function EditableNumber({
  label,
  value,
  unverified,
  onChange,
  onToggle,
}: {
  label: string;
  value: number | null;
  unverified: boolean;
  onChange: (v: FieldValue) => void;
  onToggle: () => void;
}) {
  return (
    <label className={`group adm-num ${unverified ? "adm-num--warn" : ""}`}>
      <span className="adm-num-label">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      <FlagButton active={unverified} onClick={onToggle} />
    </label>
  );
}

export function RuleCard({
  human,
  sourceText,
  badges,
}: {
  human: string;
  sourceText: string;
  badges: ReactNode;
}) {
  return (
    <div className="adm-card p-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
      <p className="adm-fg text-sm">{human}</p>
      <p className="adm-quote pl-2 text-xs italic">« {sourceText} »</p>
    </div>
  );
}
