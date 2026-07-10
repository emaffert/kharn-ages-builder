import { useState } from "react";
import type { Skill } from "@core";
import { CheckField, DetailPage, Field, Section } from "./primitives";
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
    <DetailPage
      header={
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
      }
      body={
      <>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Field label="id" hint="met à jour toutes les références" className="w-64">
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
                className={`${INPUT} font-mono ${idError ? "ring-1 ring-[color:var(--scorch)]" : ""}`}
                title="Renommer l'id met à jour toutes les références (profils, équipements, effets)."
              />
            </Field>
            {idError && <span className="text-xs text-[color:var(--scorch)]">id déjà pris / invalide</span>}
          </div>
          <CheckField label="A une valeur (X)" checked={s.hasValue} onChange={(v) => onChange({ hasValue: v })} />
        </div>
        <Section title="Description">
          <textarea
            value={s.sourceText}
            rows={3}
            onChange={(e) => onChange({ sourceText: e.target.value })}
            className={`${INPUT} w-full`}
          />
        </Section>
      </>
      }
    />
  );
}
