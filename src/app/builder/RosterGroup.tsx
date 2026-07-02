import { LEVEL, type ModelEntry } from "./shared";

/** Groupe du roster (Personnages / Troupes / Recrutement conditionnel) : liste de modèles cliquables. */
export function RosterGroup({
  label,
  hint,
  items,
  onOpen,
  conditional,
  maxed,
  onQuickAdd,
}: {
  label: string;
  hint?: string;
  items: ModelEntry[];
  onOpen: (id: string) => void;
  conditional?: boolean;
  maxed?: (m: ModelEntry) => boolean;
  onQuickAdd?: (m: ModelEntry) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="bld-grp-label">
        {label}
        {hint ? <span className="hint">— {hint}</span> : <span className="line" />}
      </div>
      {items.map((m) => {
        const first = m.profiles[0];
        const last = m.profiles[m.profiles.length - 1];
        const multi = m.profiles.length > 1;
        const minCost = Math.min(...m.profiles.map((p) => p.cost));
        const isMax = maxed?.(m) ?? false;
        return (
          <div key={m.id} className={`bld-ritem${conditional ? " is-cond" : ""}${isMax ? " is-max" : ""}`}>
            <div className="bld-rmed">{LEVEL[first.level ?? 0] || "·"}</div>
            <button
              className="bld-rmain"
              onClick={() => onOpen(m.id)}
              title={isMax ? "Limite de recrutement atteinte" : "Voir la carte"}
            >
              <span className="bld-rname">
                {m.name}
                {multi ? (
                  <span className="lvl">
                    {LEVEL[first.level ?? 0]}–{LEVEL[last.level ?? 0]}
                  </span>
                ) : (
                  first.level ? <span className="lvl">{LEVEL[first.level]}</span> : null
                )}
                {isMax && <span className="max">max</span>}
              </span>
              <span className="bld-rcost">{conditional ? "🔗" : multi ? `${minCost}+` : `${first.cost}`}</span>
            </button>
            {onQuickAdd && !conditional && (
              <button
                className="bld-radd"
                disabled={isMax}
                title={isMax ? "Limite atteinte" : multi ? "Ajouter (choix du niveau)" : "Ajouter à la liste"}
                onClick={() => onQuickAdd(m)}
              >
                +
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
