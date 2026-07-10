import type { Catalog, Spell } from "@core";
import { AddButton, CardImageSection, Combobox, DetailHeader, DetailPage, Field, RemoveButton, Section } from "./primitives";
import { INPUT, removeAt, replaceAt } from "./shared";
import { ProfileMultiSelect } from "./editors";

export function SpellDetail({
  spell: s,
  cat,
  onChange,
  onRemove,
}: {
  spell: Spell;
  cat: Catalog;
  onChange: (patch: Partial<Spell>) => void;
  onRemove: () => void;
}) {
  const numOrUndef = (v: string): number | undefined => (v === "" ? undefined : Number(v));
  const reserved = s.reservedTo ?? {};
  return (
    <DetailPage
      header={
        <DetailHeader
          name={s.name}
          onName={(v) => onChange({ name: v })}
          cost={s.cost ?? null}
          onCost={(v) => onChange({ cost: v ?? undefined })}
          costPlaceholder="—"
          onRemove={onRemove}
          removeTitle="Supprimer ce sort"
          sub={<span className="adm-id">{s.id}</span>}
        />
      }
      body={
        <>
          <Section title="Paramètres" icon="type">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Type" className="w-48">
                <select
                  value={s.kind}
                  onChange={(e) => onChange({ kind: e.target.value as Spell["kind"] })}
                  className={INPUT}
                >
                  <option value="generique">générique</option>
                  <option value="grimoire">grimoire</option>
                  <option value="reserve-profil">réservé à un profil</option>
                </select>
              </Field>
              <Field label="Voie" className="w-48">
                <Combobox
                  value={s.magicWayId ?? ""}
                  className="w-full"
                  placeholder="Rechercher une voie…"
                  options={[
                    { value: "", label: "- (aucune)" },
                    ...cat.magicWays.map((m) => ({ value: m.id, label: m.name })),
                  ]}
                  onChange={(v) => onChange({ magicWayId: v || undefined })}
                />
              </Field>
              <Field label="Pages" className="w-20">
                <input
                  type="number"
                  value={s.pages ?? ""}
                  onChange={(e) => onChange({ pages: numOrUndef(e.target.value) })}
                  className={INPUT}
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field label="Cible" className="w-56">
                <input value={s.target} onChange={(e) => onChange({ target: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Cadence" className="w-36">
                <input
                  value={s.cadence ?? ""}
                  onChange={(e) => onChange({ cadence: e.target.value || undefined })}
                  className={INPUT}
                />
              </Field>
              <Field label="Durée" className="w-44">
                <input
                  value={s.duration ?? ""}
                  onChange={(e) => onChange({ duration: e.target.value || undefined })}
                  className={INPUT}
                />
              </Field>
            </div>
          </Section>

          <Section title="Difficultés" icon="stats" note="seuil → effet">
            <div className="space-y-2">
              {s.difficulties.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input
                    type="number"
                    value={d.threshold}
                    onChange={(e) =>
                      onChange({ difficulties: replaceAt(s.difficulties, i, { ...d, threshold: Number(e.target.value) }) })
                    }
                    className={`${INPUT} w-20`}
                  />
                  <textarea
                    value={d.effectText}
                    rows={2}
                    onChange={(e) =>
                      onChange({ difficulties: replaceAt(s.difficulties, i, { ...d, effectText: e.target.value }) })
                    }
                    className={`${INPUT} flex-1`}
                  />
                  <RemoveButton onClick={() => onChange({ difficulties: removeAt(s.difficulties, i) })} />
                </div>
              ))}
              <AddButton onClick={() => onChange({ difficulties: [...s.difficulties, { threshold: 0, effectText: "" }] })}>
                + difficulté
              </AddButton>
            </div>
          </Section>

          <Section title="Réservé à" icon="constraints" note="qui peut le lancer">
            <div className="space-y-3">
              <Field label="Trait" className="w-56">
                <input
                  value={reserved.trait ?? ""}
                  onChange={(e) =>
                    onChange({ reservedTo: cleanReserved({ ...reserved, trait: e.target.value || undefined }) })
                  }
                  className={INPUT}
                />
              </Field>
              <ProfileMultiSelect
                label="Profils"
                ids={reserved.profileIds ?? []}
                cat={cat}
                onChange={(v) =>
                  onChange({ reservedTo: cleanReserved({ ...reserved, profileIds: v.length ? v : undefined }) })
                }
              />
            </div>
          </Section>

          <CardImageSection value={s.cardImage ?? ""} onChange={(v) => onChange({ cardImage: v || undefined })} hint="optionnel - chemin de la carte affichée dans l'aperçu." />
        </>
      }
    />
  );
}

function cleanReserved(r: { profileIds?: string[]; trait?: string }) {
  const out: { profileIds?: string[]; trait?: string } = {};
  if (r.trait) out.trait = r.trait;
  if (r.profileIds?.length) out.profileIds = r.profileIds;
  return Object.keys(out).length ? out : undefined;
}
