import type { Catalog, MountOption } from "@core";
import { INPUT, SECTION } from "./shared";
import { ChipMultiSelect, Combobox, DetailHeader, DetailPage, EditableNumber, Field, FieldGroup, Section } from "./primitives";

/** Éditeur d'une option de monture (règles de bataille p.32) : panier, compétence, réservations, coûts. */
const BUCKETS: [MountOption["bucket"], string][] = [
  ["mount", "Monture"],
  ["rider", "Cavalier"],
  ["both", "Partagée (les deux)"],
];
const KINDS = ["quagga", "koelod", "mochere"] as const;

export function MountOptionDetail({
  option: o,
  cat,
  onChange,
  onRemove,
}: {
  option: MountOption;
  cat: Catalog;
  onChange: (patch: Partial<MountOption>) => void;
  onRemove: () => void;
}) {
  const res = o.reservation ?? {};
  const patchRes = (patch: Partial<NonNullable<MountOption["reservation"]>>) => {
    const next = { ...res, ...patch };
    const clean = {
      factions: next.factions?.length ? next.factions : undefined,
      mountKinds: next.mountKinds?.length ? next.mountKinds : undefined,
    };
    onChange({ reservation: clean.factions || clean.mountKinds ? clean : undefined });
  };

  return (
    <DetailPage
      header={
        <DetailHeader
          name={o.name}
          onName={(v) => onChange({ name: v })}
          namePlaceholder="Nom de l'option"
          onRemove={onRemove}
          removeTitle="Supprimer cette option"
          sub={<span className="adm-id">{o.id}</span>}
        />
      }
      body={
        <>
          <Section title="Option" icon="identity">
            <Field label="Panier" hint="où l'option s'achète et sur quelle fiche elle agit" className="w-64">
              <select
                value={o.bucket}
                onChange={(e) => onChange({ bucket: e.target.value as MountOption["bucket"] })}
                className={INPUT}
              >
                {BUCKETS.map(([v, lab]) => (
                  <option key={v} value={v}>
                    {lab}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Compétence conférée" icon="skills">
            <Combobox
              value={o.grantsSkill?.skillId ?? ""}
              className="w-72"
              placeholder="Choisir une compétence…"
              options={[...cat.skills]
                .sort((a, b) => a.keyword.localeCompare(b.keyword, "fr"))
                .map((s) => ({ value: s.id, label: s.keyword }))}
              onChange={(v) => onChange({ grantsSkill: v ? { skillId: v } : undefined })}
            />
          </Section>

          <Section title="Coût" icon="cost">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <EditableNumber
                  label="Coût de base"
                  value={o.cost}
                  unverified={false}
                  onChange={(v) => onChange({ cost: Number(v) || 0 })}
                />
                <EditableNumber
                  label="Valeur X max (vide = sans valeur)"
                  value={o.maxValue ?? null}
                  unverified={false}
                  onChange={(v) => onChange({ maxValue: v == null ? undefined : Number(v) })}
                />
              </div>

              {o.maxValue != null && (
                <FieldGroup label="Coût par palier X" hint="(X1, X2, … - déroge au coût de base)">
                  <div className="flex flex-wrap gap-3">
                    {Array.from({ length: o.maxValue }, (_, i) => (
                      <Field key={i} label={`X${i + 1}`} className="w-20">
                        <input
                          type="number"
                          value={o.costByValue?.[i] ?? ""}
                          placeholder="—"
                          onChange={(e) => {
                            const arr = [...(o.costByValue ?? [])];
                            arr[i] = Number(e.target.value) || 0;
                            onChange({ costByValue: arr.some((x) => x) ? arr : undefined });
                          }}
                          className={INPUT}
                        />
                      </Field>
                    ))}
                  </div>
                </FieldGroup>
              )}

              <FieldGroup label="Coût par nature de monture" hint="(déroge au coût de base, ex. Repoussement)">
                <div className="flex flex-wrap gap-3">
                  {KINDS.map((k) => (
                    <Field key={k} label={k} className="w-24">
                      <input
                        type="number"
                        value={o.costByMountKind?.[k] ?? ""}
                        placeholder="—"
                        onChange={(e) => {
                          const cur = { ...(o.costByMountKind ?? {}) };
                          if (e.target.value === "") delete cur[k];
                          else cur[k] = Number(e.target.value);
                          onChange({ costByMountKind: Object.keys(cur).length ? cur : undefined });
                        }}
                        className={INPUT}
                      />
                    </Field>
                  ))}
                </div>
              </FieldGroup>
            </div>
          </Section>

          <Section title={SECTION.verbatim} icon="verbatim">
            <textarea
              value={o.effectsText ?? ""}
              rows={2}
              onChange={(e) => onChange({ effectsText: e.target.value || undefined })}
              className={`${INPUT} w-full`}
            />
          </Section>

          <Section title="Réservations" icon="constraints" note="au sein d'une dimension, l'appartenance suffit">
            <div className="flex flex-col gap-3">
              <FieldGroup label="Factions du cavalier">
                <ChipMultiSelect
                  options={cat.factions.map((f) => ({ value: f.id, label: f.name }))}
                  selected={res.factions ?? []}
                  onToggle={(id) =>
                    patchRes({
                      factions: (res.factions ?? []).includes(id)
                        ? (res.factions ?? []).filter((x) => x !== id)
                        : [...(res.factions ?? []), id],
                    })
                  }
                />
              </FieldGroup>
              <FieldGroup label="Natures de monture">
                <ChipMultiSelect
                  options={KINDS.map((k) => ({ value: k, label: k }))}
                  selected={res.mountKinds ?? []}
                  onToggle={(k) =>
                    patchRes({
                      mountKinds: (res.mountKinds ?? []).includes(k)
                        ? (res.mountKinds ?? []).filter((x) => x !== k)
                        : [...(res.mountKinds ?? []), k],
                    })
                  }
                />
              </FieldGroup>
            </div>
          </Section>
        </>
      }
    />
  );
}
