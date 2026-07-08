import type { EmblemKind } from "./shared";

/**
 * Blason héraldique de faction (placeholder - remplaçable par les vraies icônes).
 * Se teinte via les variables `--faction` / `--faction-deep` / `--gold` du parent.
 */
const INK = "#f4e6c8";

const SIGILS: Record<EmblemKind, React.JSX.Element> = {
  // Flamme (enfants de Nyx)
  fangs: (
    <g fill={INK}>
      <path d="M20 8 C16 15 17 20 20 25 C23 20 24 15 20 8 Z" />
      <path d="M14 13 C12 18 13 22 17 25 C16 20 15 17 14 13 Z" />
      <path d="M26 13 C28 18 27 22 23 25 C24 20 25 17 26 13 Z" />
      <path d="M20 24 C18 27 18 30 20 32 C22 30 22 27 20 24 Z" />
    </g>
  ),
  // Fleur de lys (Couronne) : pétale central ovale + 2 latéraux repliés, barre fine, pied tri-pétale
  kharns: (
    <g fill={INK}>
      <path d="M20 5 C17.4 8.5 16.9 13.5 17.5 18.5 C17.8 20.8 18.4 22.4 19 23 L21 23 C21.6 22.4 22.2 20.8 22.5 18.5 C23.1 13.5 22.6 8.5 20 5 Z" />
      <path d="M19 22 C15.3 22.3 12.4 21.4 11.6 15.4 C11.4 13.9 12.6 13.6 13.4 14.8 C14.3 16.2 14.8 18.6 16.6 19.6 C17.5 20.1 18.4 20.6 19 22 Z" />
      <path d="M21 22 C24.7 22.3 27.6 21.4 28.4 15.4 C28.6 13.9 27.4 13.6 26.6 14.8 C25.7 16.2 25.2 18.6 23.4 19.6 C22.5 20.1 21.6 20.6 21 22 Z" />
      <rect x="14.8" y="23.4" width="10.4" height="1.8" rx="0.9" />
      <path d="M17.5 25.6 C17.7 27.8 18.5 29.8 20 31.4 C21.5 29.8 22.3 27.8 22.5 25.6 C21.9 26.6 21 26.8 20 26 C19 26.8 18.1 26.6 17.5 25.6 Z" />
    </g>
  ),
  // Deux lances croisées derrière un bouclier ovale primitif
  gouns: (
    <>
      <g stroke={INK} strokeWidth="1.8" strokeLinecap="round">
        <line x1="12.5" y1="11.5" x2="27.5" y2="33" />
        <line x1="27.5" y1="11.5" x2="12.5" y2="33" />
      </g>
      <path d="M9.5 8 L12.9 9.7 L11.1 11.9 Z" fill={INK} />
      <path d="M30.5 8 L27.1 9.7 L28.9 11.9 Z" fill={INK} />
      <path d="M20 12.5 C15.2 13.4 14.2 19 15.2 24.5 C16 29 20 32 20 32 C20 32 24 29 24.8 24.5 C25.8 19 24.8 13.4 20 12.5 Z" fill={INK} />
      <path d="M20 16.5 V29 M16.7 22 H23.3" stroke="var(--faction-deep)" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  // Bouclier rond orné de cornes de rhinocéros
  kherops: (
    <>
      <path d="M16.6 16 C15.8 13.2 16.2 11.4 17.6 10.4 C17.3 12.2 17.5 14 18.4 16 Z" fill={INK} />
      <path d="M23.4 16 C24.2 13.2 23.8 11.4 22.4 10.4 C22.7 12.2 22.5 14 21.6 16 Z" fill={INK} />
      <circle cx="20" cy="24" r="8.6" fill={INK} />
      <circle cx="20" cy="24" r="2.6" fill="var(--faction-deep)" />
    </>
  ),
  // Arbre au centre d'un demi-cercle de deux défenses d'éléphant
  tembos: (
    <g fill={INK}>
      <path d="M12 17 C10.4 24 13.6 31 20 33 C15.6 30.5 13.2 25 14.4 18 Z" />
      <path d="M28 17 C29.6 24 26.4 31 20 33 C24.4 30.5 26.8 25 25.6 18 Z" />
      <rect x="19" y="21" width="2" height="8" rx="0.8" />
      <path d="M20 14 L16.5 21 H23.5 Z" />
      <path d="M20 17.5 L15.5 24 H24.5 Z" />
    </g>
  ),
  // Entrelacs de fibules (bijou)
  guilde: (
    <>
      <path d="M20 7 C25.5 9 25.5 17 20 19 C14.5 17 14.5 9 20 7 Z" fill="none" stroke={INK} strokeWidth="2.1" />
      <path d="M20 25 C25.5 27 25.5 35 20 37 C14.5 35 14.5 27 20 25 Z" fill="none" stroke={INK} strokeWidth="2.1" />
      <path d="M20 17.5 L23.2 22 L20 26.5 L16.8 22 Z" fill={INK} />
    </>
  ),
  // Hache à double tranchant dorée (les Affranchis) - labrys : hampe centrale + deux fers en croissant.
  affranchis: (
    <g fill="var(--gold)">
      <rect x="19.1" y="9" width="1.8" height="27" rx="0.9" />
      <circle cx="20" cy="36.5" r="1.7" />
      <path d="M19.2 13 C12 13 8 16 7.4 20 C8 24 12 27 19.2 27 C16.6 23 16.6 17 19.2 13 Z" />
      <path d="M20.8 13 C28 13 32 16 32.6 20 C32 24 28 27 20.8 27 C23.4 23 23.4 17 20.8 13 Z" />
    </g>
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
