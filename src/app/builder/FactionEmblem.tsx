import type { EmblemKind } from "./shared";

/**
 * Blason héraldique de faction (placeholder — remplaçable par les vraies icônes).
 * Se teinte via les variables `--faction` / `--faction-deep` / `--gold` du parent.
 */
const SIGILS: Record<EmblemKind, React.JSX.Element> = {
  fangs: (
    <path
      d="M20 11 C15 15 12 15 11 23 C15 20 17 21 20 27 C23 21 25 20 29 23 C28 15 25 15 20 11 Z"
      fill="#f4e6c8"
      opacity=".9"
    />
  ),
  kharns: (
    <>
      <path d="M11 18 L15 24 L20 16 L25 24 L29 18 L27 30 H13 Z" fill="#f4e6c8" opacity=".9" />
      <circle cx="11" cy="16" r="1.6" fill="var(--gold)" />
      <circle cx="20" cy="13" r="1.6" fill="var(--gold)" />
      <circle cx="29" cy="16" r="1.6" fill="var(--gold)" />
    </>
  ),
  kherops: (
    <>
      <path d="M8 22 C12 16 28 16 32 22 C28 28 12 28 8 22 Z" fill="#f4e6c8" opacity=".92" />
      <circle cx="20" cy="22" r="3.4" fill="var(--faction-deep)" />
    </>
  ),
  guilde: (
    <>
      <circle cx="20" cy="22" r="8" fill="none" stroke="#f4e6c8" strokeWidth="2.2" opacity=".9" />
      <path
        d="M20 16 L22 21 L27 21 L23 24 L24.5 29 L20 26 L15.5 29 L17 24 L13 21 L18 21 Z"
        fill="#f4e6c8"
        opacity=".9"
      />
    </>
  ),
};

export function FactionEmblem({ kind, className }: { kind: EmblemKind; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 44" aria-hidden="true">
      <path
        d="M20 2 L37 8 V22 C37 33 29 40 20 43 C11 40 3 33 3 22 V8 Z"
        fill="var(--faction)"
        stroke="var(--gold)"
        strokeWidth="2"
      />
      {SIGILS[kind]}
    </svg>
  );
}
