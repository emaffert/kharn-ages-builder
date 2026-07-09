import type { Catalog, Spell } from "@core";
import { AddButton, Combobox, DetailPage, Field, RemoveButton, Section } from "./primitives";
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
      <header className="flex items-center gap-3">
        <input
          value={s.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="adm-title flex-1"
        />
        <label className="flex items-center gap-1 adm-accent">
          <input
            type="number"
            value={s.cost ?? ""}
            onChange={(e) => onChange({ cost: numOrUndef(e.target.value) })}
            className="adm-cost"
          />
          <span className="text-sm">Ko</span>
        </label>
        <button type="button" onClick={onRemove} title="Supprimer ce sort" className="adm-x">
          ✕
        </button>
      </header>
      }
      body={
      <>
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

        <div className="flex flex-wrap items-end gap-3">
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

        <Section title="Difficultés (seuil → effet)">
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
      </>
      }
      applicability={
        <Section title="Réservé à">
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
      }
      media={
        <Field label="Image (optionnel)">
          <input
            value={s.cardImage ?? ""}
            placeholder="cards/..."
            onChange={(e) => onChange({ cardImage: e.target.value || undefined })}
            className={`${INPUT} max-w-md`}
          />
        </Field>
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
