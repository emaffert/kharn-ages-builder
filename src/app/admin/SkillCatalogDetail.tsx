import { useState } from "react";
import type { Skill } from "@core";
import { Section } from "./primitives";
import { INPUT } from "./shared";

export function SkillCatalogDetail({
  skill: s,
  onChange,
  onRemove,
  onRenameId,
}: {
  skill: Skill;
  onChange: (patch: Partial<Skill>) => void;
  onRemove: () => void;
  /** Renomme l'id (cascade sur les références). Retourne false si l'id est invalide/déjà pris. */
  onRenameId: (newId: string) => boolean;
}) {
  // Le parent monte ce composant avec key={skill.id} : le brouillon se réinitialise au changement.
  const [idDraft, setIdDraft] = useState(s.id);
  const [idError, setIdError] = useState(false);
  const commitId = () => {
    const v = idDraft.trim();
    if (v === s.id) return;
    if (!v || !onRenameId(v)) {
      setIdError(true);
      setIdDraft(s.id);
    } else {
      setIdError(false);
    }
  };
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <input
          value={s.keyword}
          onChange={(e) => onChange({ keyword: e.target.value })}
          className="adm-title flex-1"
        />
        <button
          type="button"
          onClick={onRemove}
          title="Supprimer cette compétence"
          className="adm-x"
        >
          ✕
        </button>
      </header>
      <div className="flex flex-wrap items-center gap-4 text-xs adm-muted">
        <label className="flex items-center gap-1 adm-faint">
          id
          <input
            value={idDraft}
            onChange={(e) => setIdDraft(e.target.value)}
            onBlur={commitId}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setIdDraft(s.id);
                setIdError(false);
              }
            }}
            spellCheck={false}
            className={`${INPUT} w-56 font-mono ${idError ? "ring-1 ring-red-500" : ""}`}
            title="Renommer l'id met à jour toutes les références (profils, équipements, effets)."
          />
          {idError && <span className="text-red-500">id déjà pris / invalide</span>}
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={s.hasValue} onChange={(e) => onChange({ hasValue: e.target.checked })} />
          a une valeur (X)
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={s.obligatory ?? false}
            onChange={(e) => onChange({ obligatory: e.target.checked || undefined })}
          />
          obligatoire
        </label>
      </div>
      <Section title="Description">
        <textarea
          value={s.sourceText}
          rows={3}
          onChange={(e) => onChange({ sourceText: e.target.value })}
          className={`${INPUT} w-full`}
        />
      </Section>
    </div>
  );
}
