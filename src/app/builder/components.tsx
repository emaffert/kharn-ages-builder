import type { ReactNode } from "react";

/** Petits composants de présentation partagés par le constructeur (dépendent uniquement de leurs props). */

/** Pastille de recrutement lié (ex. « + Likan », « + Muskh ») posée sous une figurine porteuse. */
export function RecruitPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="bld-pill" onClick={onClick}>
      {label}
    </button>
  );
}

/** Étiquette courte (limitation, « Mage »…). */
export function Tag({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <span className="rounded px-1.5 py-0.5 font-medium uppercase tracking-wide" style={{ background: `${accent}1a`, color: accent }}>
      {children}
    </span>
  );
}

/** Titre de section (soulignement discret). */
export function SectionTitle({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <h4
      className="kh-display mb-1.5 border-b pb-1 text-xs font-semibold uppercase tracking-wider"
      style={{ borderColor: `${accent}33`, color: accent }}
    >
      {children}
    </h4>
  );
}

/** Indicateur d'emplacement occupé (mains, armure…) : points pleins/vides, ou « ∞ » si illimité. */
export function SlotChip({ label, used, cap, accent }: { label: string; used: number; cap: number; accent: string }) {
  const full = Number.isFinite(cap) && used >= cap;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: `${accent}14`, color: full ? "#9a3b2b" : accent }}>
      <span className="kh-display uppercase tracking-wide opacity-70">{label}</span>
      {Number.isFinite(cap) ? (
        <>
          <span className="tracking-tight">{Array.from({ length: cap }, (_, k) => (k < used ? "●" : "○")).join("")}</span>
          <span className="opacity-70">
            {used}/{cap}
          </span>
        </>
      ) : (
        <span className="opacity-70">{used} · ∞</span>
      )}
    </span>
  );
}
