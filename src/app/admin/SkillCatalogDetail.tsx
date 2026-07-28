import type { Catalog, Skill } from "@core";
import { CheckField, DetailHeader, DetailPage, IdField, Section } from "./primitives";
import { INPUT } from "./shared";

export function SkillCatalogDetail({
  skill: s,
  cat,
  onChange,
  onRemove,
  onRenameId,
}: {
  skill: Skill;
  cat: Catalog;
  onChange: (patch: Partial<Skill>) => void;
  onRemove: () => void;
  /** Renomme l'identifiant, en cascade sur tout ce qui le cite. */
  onRenameId: (newId: string) => void;
}) {
  return (
    <DetailPage
      header={
        <DetailHeader
          name={s.keyword}
          onName={(v) => onChange({ keyword: v })}
          onRemove={onRemove}
          removeTitle="Supprimer cette compétence"
          sub={<IdField cat={cat} kind="skill" id={s.id} onRename={onRenameId} />}
        />
      }
      body={
        <>
          <Section title="Identité" icon="identity">
            <div className="flex flex-wrap items-end gap-4">
              <CheckField label="A une valeur (X)" checked={s.hasValue} onChange={(v) => onChange({ hasValue: v })} />
            </div>
          </Section>

          <Section title="Description" icon="verbatim">
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
