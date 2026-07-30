import type { MountType, Profile } from "@core";
import { SearchIcon } from "./icons";
import { RosterGroup } from "./RosterGroup";
import type { ModelEntry } from "./shared";

/** Une entrée « monture » du roster (type + coût minimal + icône résolue). */
export type RosterMountEntry = { type: MountType; minCost: number; icon?: string };

/**
 * Barre latérale du constructeur : recherche + sections de recrutement (Personnages, Troupes,
 * Recrutement conditionnel, Hors Faction, Frères d'armes, Guilde Noire, Montures). Purement
 * présentationnelle : les sections déjà catégorisées et les callbacks lui sont fournis par
 * `BuilderScreen`.
 */
export function RosterSidebar({
  query,
  onQueryChange,
  factionName,
  models,
  personnages,
  troupes,
  conditionnels,
  horsFaction,
  freresDArmes,
  sceau,
  sceauHint,
  mountTypes,
  modelMaxed,
  onQuickAdd,
  onPreview,
  onMountPreview,
  costOf,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  factionName: string;
  /** Ensemble des modèles recrutables (après recherche) : vide → message d'état. */
  models: ModelEntry[];
  personnages: ModelEntry[];
  troupes: ModelEntry[];
  conditionnels: ModelEntry[];
  horsFaction: ModelEntry[];
  freresDArmes: ModelEntry[];
  /** Recrues qui n'entrent qu'en payant leur sceau (Guilde Noire) : coût affiché sceau compris. */
  sceau: ModelEntry[];
  /** Rappel du surcoût affiché en tête de la section (ex. « sceau compris, +10 Ko »). */
  sceauHint?: string;
  mountTypes: RosterMountEntry[];
  modelMaxed: (m: ModelEntry) => boolean;
  onQuickAdd: (m: ModelEntry) => void;
  onPreview: (modelId: string) => void;
  onMountPreview: (typeId: string) => void;
  /** Coût de recrutement affiché (sceau compris là où il est imposé). */
  costOf: (p: Profile) => number;
}) {
  return (
    <>
      <div className="bld-roster-head">
        <label className="bld-search">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Rechercher un profil…"
          />
          {query && (
            <button type="button" onClick={() => onQueryChange("")} title="Effacer" className="bld-search-x">
              ✕
            </button>
          )}
        </label>
      </div>
      <div className="bld-roster-scroll">
        {models.length === 0 ? (
          <p className="bld-empty">
            {query.trim() !== ""
              ? "Aucun profil ne correspond à la recherche."
              : `Aucune figurine à recruter pour ${factionName} pour l'instant.`}
          </p>
        ) : (
          <>
            <RosterGroup label="Personnages" items={personnages} maxed={modelMaxed} onQuickAdd={onQuickAdd} onOpen={onPreview} />
            <RosterGroup label="Troupes" items={troupes} maxed={modelMaxed} onQuickAdd={onQuickAdd} onOpen={onPreview} />
            <RosterGroup label="Recrutement conditionnel" items={conditionnels} onOpen={onPreview} conditional />
            <RosterGroup label="Hors Faction" items={horsFaction} maxed={modelMaxed} onQuickAdd={onQuickAdd} onOpen={onPreview} />
            <RosterGroup label="Frères d'armes" items={freresDArmes} maxed={modelMaxed} onQuickAdd={onQuickAdd} onOpen={onPreview} />
            <RosterGroup
              label="Guilde Noire"
              hint={sceauHint}
              items={sceau}
              maxed={modelMaxed}
              onQuickAdd={onQuickAdd}
              onOpen={onPreview}
              costOf={costOf}
            />
            {mountTypes.length > 0 && (
              <div>
                <div className="bld-grp-label">
                  Montures<span className="line" />
                </div>
                {mountTypes.map(({ type, minCost, icon }) => (
                  <div key={type.id} className="bld-ritem is-cond">
                    <button className="bld-rmain" onClick={() => onMountPreview(type.id)} title="Voir la fiche">
                      <span className="bld-rmed">{icon ? <img className="bld-rmed-img" src={icon} alt="" /> : "🐎"}</span>
                      <span className="bld-rname">{type.name}</span>
                      <span className="bld-rcost">{minCost}+</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
