import type { ReactNode } from "react";

/** Petits composants de présentation partagés par le constructeur (dépendent uniquement de leurs props). */

/** Pastille de recrutement lié (ex. « + Likan », « + Muskh ») posée sous une figurine porteuse. */
export function RecruitPill({
  label,
  onClick,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button className="bld-pill" onClick={onClick} disabled={disabled} title={title}>
      {label}
    </button>
  );
}

/** Titre de section (soulignement discret). */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="fe-section-title">{children}</h4>;
}

/** Indicateur d'emplacement occupé (mains, armure…) : points pleins/vides, ou « ∞ » si illimité. */
export function SlotChip({ label, used, cap }: { label: string; used: number; cap: number }) {
  const full = Number.isFinite(cap) && used >= cap;
  return (
    <span className={`fe-slot${full ? " is-full" : ""}`}>
      <span className="lab">{label}</span>
      {Number.isFinite(cap) ? (
        <>
          <span style={{ letterSpacing: "-1px" }}>
            {Array.from({ length: cap }, (_, k) => (k < used ? "●" : "○")).join("")}
          </span>
          <span>
            {used}/{cap}
          </span>
        </>
      ) : (
        <span>{used} · ∞</span>
      )}
    </span>
  );
}
