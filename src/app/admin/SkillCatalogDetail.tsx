import type { Catalog, Skill } from "@core";
import { AutoTextarea, CheckField, DetailHeader, DetailPage, IdField, Section } from "./primitives";

export function SkillCatalogDetail({
  skill: s,
  cat,
  onChange,
  onRemove,
  onRenameId,
  onSlugifyId,
}: {
  skill: Skill;
  cat: Catalog;
  onChange: (patch: Partial<Skill>) => void;
  onRemove: () => void;
  /** Renomme l'identifiant, en cascade sur tout ce qui le cite. */
  onRenameId: (newId: string) => void;
  /** Donne un identifiant lisible à une entité qui porte encore celui de sa création. */
  onSlugifyId?: () => void;
}) {
  return (
    <DetailPage
      header={
        <DetailHeader
          name={s.keyword}
          onName={(v) => onChange({ keyword: v })}
          onNameCommit={onSlugifyId}
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
            <AutoTextarea
              value={s.sourceText}
              onChange={(v) => onChange({ sourceText: v })}
              minRows={3}
            />
          </Section>
        </>
      }
    />
  );
}
