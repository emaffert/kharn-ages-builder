import type { Skill } from "@core";
import { Section } from "./primitives";
import { INPUT } from "./shared";

export function SkillCatalogDetail({
  skill: s,
  onChange,
  onRemove,
}: {
  skill: Skill;
  onChange: (patch: Partial<Skill>) => void;
  onRemove: () => void;
}) {
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
        <span className="adm-faint">
          id : <code>{s.id}</code>
        </span>
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
