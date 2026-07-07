import { useState, type ReactNode } from "react";
import { Tag } from "@ui";
import type { FieldValue } from "../useCatalogStore";
import { INPUT } from "./shared";
import offensive from "../../assets/maitrise/offensive.png";
import defensive from "../../assets/maitrise/defensive.png";
import objectif from "../../assets/maitrise/objectif.png";
import tir from "../../assets/maitrise/tir.png";
import esoterique from "../../assets/maitrise/esoterique.png";

/** Composants de présentation réutilisables de l'admin (stylés sur admin.css). */

/** Vrais symboles des 5 domaines de maîtrise (mêmes assets que le dé des fiches). */
const DOMAIN_ICONS: Record<string, string> = { offensive, defensive, objectif, tir, esoterique };

/**
 * Icône d'un domaine de maîtrise (asset N&B). Recoloré par le `filter` de thème `--km-tune`
 * (comme le dé des fiches) : encre en clair, os en sombre. L'état actif/inactif dans un dé est
 * rendu par l'opacité (cf. `.adm-dice .adm-domain-icon` dans admin.css).
 */
export function DomainIcon({ domain, className = "h-4 w-4" }: { domain: string; className?: string }) {
  const src = DOMAIN_ICONS[domain];
  if (!src) return null;
  return <img src={src} alt={domain} className={`adm-domain-icon ${className}`} />;
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
  /** Bouton « à vérifier » par champ. Absent → pas de bouton (le flag est géré ailleurs, ex. groupé). */
  onToggle?: () => void;
}) {
  return (
    <label className={`group adm-num ${unverified ? "adm-num--warn" : ""}`}>
      <span className="adm-num-label">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {onToggle && <FlagButton active={unverified} onClick={onToggle} />}
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

export type ComboOption = { value: string; label: string; hint?: string };

/**
 * Menu déroulant cherchable générique : choisir une entrée dans une liste (compétence, profil,
 * modèle, voie de sort…) qui s'étoffe. Même comportement que le choix d'équipement.
 */
export function Combobox({
  value,
  options,
  onChange,
  placeholder = "Rechercher…",
  className = "flex-1",
}: {
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const current = options.find((o) => o.value === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = (
    q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint?.toLowerCase().includes(q) ?? false))
      : options
  ).slice(0, 12);
  return (
    <div className={`adm-combo-wrap ${className}`}>
      <input
        className={`${INPUT} w-full`}
        value={open ? query : current?.label ?? value}
        placeholder={placeholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && matches.length > 0 && (
        <ul className="adm-combo">
          {matches.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className="adm-combo-item"
                onMouseDown={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {o.hint && <span className="adm-faint text-xs">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
