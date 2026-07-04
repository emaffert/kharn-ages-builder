import type { Catalog, Spell } from "@core";
import { AddButton, RemoveButton, Section } from "./primitives";
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
    <div className="space-y-5">
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

      <div className="flex flex-wrap items-center gap-3 text-xs adm-muted">
        <label className="flex items-center gap-1">
          type
          <select
            value={s.kind}
            onChange={(e) => onChange({ kind: e.target.value as Spell["kind"] })}
            className={INPUT}
          >
            <option value="generique">générique</option>
            <option value="grimoire">grimoire</option>
            <option value="reserve-profil">réservé à un profil</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          voie
          <select
            value={s.magicWayId ?? ""}
            onChange={(e) => onChange({ magicWayId: e.target.value || undefined })}
            className={INPUT}
          >
            <option value="">—</option>
            {cat.magicWays.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          pages
          <input
            type="number"
            value={s.pages ?? ""}
            onChange={(e) => onChange({ pages: numOrUndef(e.target.value) })}
            className={`${INPUT} w-16`}
          />
        </label>
      </div>

      <Section title="Réservé à">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs adm-faint">
            trait
            <input
              value={reserved.trait ?? ""}
              onChange={(e) =>
                onChange({ reservedTo: cleanReserved({ ...reserved, trait: e.target.value || undefined }) })
              }
              className={`${INPUT} w-40`}
            />
          </label>
          <ProfileMultiSelect
            label="profils"
            ids={reserved.profileIds ?? []}
            cat={cat}
            onChange={(v) =>
              onChange({ reservedTo: cleanReserved({ ...reserved, profileIds: v.length ? v : undefined }) })
            }
          />
        </div>
      </Section>

      <div className="flex flex-wrap gap-3 text-xs adm-muted">
        <label className="flex items-center gap-1">
          cible
          <input value={s.target} onChange={(e) => onChange({ target: e.target.value })} className={`${INPUT} w-48`} />
        </label>
        <label className="flex items-center gap-1">
          cadence
          <input
            value={s.cadence ?? ""}
            onChange={(e) => onChange({ cadence: e.target.value || undefined })}
            className={`${INPUT} w-32`}
          />
        </label>
        <label className="flex items-center gap-1">
          durée
          <input
            value={s.duration ?? ""}
            onChange={(e) => onChange({ duration: e.target.value || undefined })}
            className={`${INPUT} w-40`}
          />
        </label>
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

      <Section title="Image (optionnel)">
        <input
          value={s.cardImage ?? ""}
          placeholder="cards/..."
          onChange={(e) => onChange({ cardImage: e.target.value || undefined })}
          className={`${INPUT} w-full max-w-md`}
        />
      </Section>
    </div>
  );
}

function cleanReserved(r: { profileIds?: string[]; trait?: string }) {
  const out: { profileIds?: string[]; trait?: string } = {};
  if (r.trait) out.trait = r.trait;
  if (r.profileIds?.length) out.profileIds = r.profileIds;
  return Object.keys(out).length ? out : undefined;
}
