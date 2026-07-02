import { LEVEL, type ModelEntry } from "./shared";

/** Groupe du roster (Personnages / Troupes / Recrutement conditionnel) : liste de modèles cliquables. */
export function RosterGroup({
  label,
  hint,
  items,
  onOpen,
  conditional,
  maxed,
  accent,
  onQuickAdd,
}: {
  label: string;
  hint?: string;
  items: ModelEntry[];
  onOpen: (id: string) => void;
  conditional?: boolean;
  maxed?: (m: ModelEntry) => boolean;
  accent?: string;
  onQuickAdd?: (m: ModelEntry) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="kh-display px-2 text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      {hint && <p className="px-2 pb-1 text-[10px] italic opacity-50">{hint}</p>}
      <ul>
        {items.map((m) => {
          const first = m.profiles[0];
          const last = m.profiles[m.profiles.length - 1];
          const multi = m.profiles.length > 1;
          const minCost = Math.min(...m.profiles.map((p) => p.cost));
          const isMax = maxed?.(m) ?? false;
          return (
            <li key={m.id} className="flex items-center gap-1">
              <button
                onClick={() => onOpen(m.id)}
                title={isMax ? "Limite de recrutement atteinte" : "Voir la carte"}
                className={`flex flex-1 items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-white/60 ${isMax ? "opacity-40" : ""}`}
              >
                <span className={conditional ? "opacity-70" : ""}>
                  {m.name}
                  {multi ? (
                    <span className="ml-1.5 text-xs opacity-40">
                      {LEVEL[first.level ?? 0]}–{LEVEL[last.level ?? 0]}
                    </span>
                  ) : (
                    first.level && <span className="ml-1 opacity-40">{LEVEL[first.level]}</span>
                  )}
                  {isMax && <span className="ml-1.5 text-[10px] uppercase tracking-wide">· max</span>}
                </span>
                <span className="text-xs opacity-70">
                  {conditional ? "🔗" : multi ? `${minCost}+` : `${first.cost}`}
                </span>
              </button>
              {onQuickAdd && !conditional && (
                <button
                  onClick={() => onQuickAdd(m)}
                  disabled={isMax}
                  title={isMax ? "Limite atteinte" : multi ? "Ajouter (choix du niveau)" : "Ajouter à la liste"}
                  className="shrink-0 rounded px-1.5 text-sm font-bold transition hover:bg-white/60 disabled:opacity-30"
                  style={{ color: accent }}
                >
                  +
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
