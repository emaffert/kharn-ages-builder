import type { Catalog, Equipment } from "@core";
import { Section } from "./primitives";
import { EQUIPMENT_CATEGORIES, INPUT } from "./shared";
import { GrantsCastingEditor, ReservedToEditor, SkillsEditor } from "./editors";

export function EquipmentDetail({
  equipment: e,
  cat,
  onChange,
  onRemove,
}: {
  equipment: Equipment;
  cat: Catalog;
  onChange: (patch: Partial<Equipment>) => void;
  onRemove: () => void;
}) {
  const numOrUndef = (v: string): number | undefined => (v === "" ? undefined : Number(v));

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <input
          value={e.name}
          onChange={(ev) => onChange({ name: ev.target.value })}
          className="adm-title flex-1"
        />
        <label className="flex items-center gap-1 adm-accent">
          <input
            type="number"
            value={e.cost}
            onChange={(ev) => onChange({ cost: Number(ev.target.value) })}
            className="adm-cost"
          />
          <span className="text-sm">Ko</span>
        </label>
        <button
          type="button"
          onClick={onRemove}
          title="Supprimer cet équipement"
          className="adm-x"
        >
          ✕
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-xs adm-muted">
        <label className="flex items-center gap-1">
          catégorie
          <select
            value={e.category}
            onChange={(ev) => onChange({ category: ev.target.value as Equipment["category"] })}
            className={INPUT}
          >
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          mains
          <select
            value={e.hands ?? ""}
            onChange={(ev) =>
              onChange({ hands: ev.target.value === "" ? undefined : (Number(ev.target.value) as 1 | 2) })
            }
            className={INPUT}
          >
            <option value="">—</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={e.isFree ?? false}
            onChange={(ev) => onChange({ isFree: ev.target.checked || undefined })}
          />
          arme gratuite
        </label>
        <label className="flex items-center gap-1">
          allonge
          <input
            type="number"
            value={e.allonge ?? ""}
            onChange={(ev) => onChange({ allonge: numOrUndef(ev.target.value) })}
            className={`${INPUT} w-16`}
          />
        </label>
        <label className="flex items-center gap-1">
          durabilité
          <input
            type="number"
            value={e.durability ?? ""}
            onChange={(ev) => onChange({ durability: numOrUndef(ev.target.value) })}
            className={`${INPUT} w-16`}
          />
        </label>
      </div>

      <Section title="Effets (verbatim — fait foi)">
        <textarea
          value={e.effectsText}
          rows={2}
          onChange={(ev) => onChange({ effectsText: ev.target.value })}
          className={`${INPUT} w-full`}
        />
      </Section>

      <Section title="Compétences conférées">
        <SkillsEditor
          skills={e.grantsSkills ?? []}
          cat={cat}
          onChange={(s) => onChange({ grantsSkills: s.length ? s : undefined })}
        />
      </Section>

      <Section title="Réservé à (qui peut l'équiper)">
        <ReservedToEditor value={e.reservedTo} cat={cat} onChange={(v) => onChange({ reservedTo: v })} />
      </Section>

      <details>
        <summary className="cursor-pointer text-xs adm-faint">
          Champs avancés (portée, recharge, perce-armure, image)
        </summary>
        <div className="mt-2 space-y-2 text-xs adm-muted">
          <div className="flex flex-wrap items-center gap-2">
            <span>Portée (tir) :</span>
            <input
              type="number"
              placeholder="courte"
              value={e.range?.short ?? ""}
              onChange={(ev) =>
                onChange({
                  range:
                    ev.target.value === "" && e.range?.long == null
                      ? undefined
                      : { short: Number(ev.target.value || 0), long: e.range?.long ?? 0, max: e.range?.max },
                })
              }
              className={`${INPUT} w-20`}
            />
            <input
              type="number"
              placeholder="longue"
              value={e.range?.long ?? ""}
              onChange={(ev) =>
                onChange({
                  range: { short: e.range?.short ?? 0, long: Number(ev.target.value || 0), max: e.range?.max },
                })
              }
              className={`${INPUT} w-20`}
            />
            <input
              type="number"
              placeholder="max"
              value={e.range?.max ?? ""}
              onChange={(ev) =>
                onChange({
                  range: { short: e.range?.short ?? 0, long: e.range?.long ?? 0, max: numOrUndef(ev.target.value) },
                })
              }
              className={`${INPUT} w-20`}
            />
            {e.range && (
              <button type="button" onClick={() => onChange({ range: undefined })} className="adm-x">
                ✕ portée
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Recharge :</span>
            <input
              type="number"
              placeholder="cadence"
              value={e.reload?.cadence ?? ""}
              onChange={(ev) =>
                onChange({
                  reload:
                    ev.target.value === ""
                      ? undefined
                      : { cadence: Number(ev.target.value), paCost: e.reload?.paCost ?? 0 },
                })
              }
              className={`${INPUT} w-24`}
            />
            <input
              type="number"
              placeholder="PA"
              value={e.reload?.paCost ?? ""}
              onChange={(ev) =>
                onChange({ reload: { cadence: e.reload?.cadence ?? 0, paCost: Number(ev.target.value || 0) } })
              }
              className={`${INPUT} w-20`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Munitions :</span>
            <select
              value={e.munitionKind ?? ""}
              onChange={(ev) => onChange({ munitionKind: ev.target.value || undefined })}
              className={INPUT}
            >
              <option value="">— aucune</option>
              {(cat.munitionKinds ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <span className="text-xs adm-faint">(sorte de munition achetable, cf. table p.46)</span>
          </div>
          <GrantsCastingEditor value={e.grantsCasting} cat={cat} onChange={(v) => onChange({ grantsCasting: v })} />
          <label className="flex items-center gap-2">
            Perce-armure :
            <input
              value={e.perceArmure == null ? "" : String(e.perceArmure)}
              placeholder='nombre ou "1D5"'
              onChange={(ev) => {
                const v = ev.target.value.trim();
                onChange({ perceArmure: v === "" ? undefined : v === "1D5" ? "1D5" : Number(v) });
              }}
              className={`${INPUT} w-32`}
            />
          </label>
          <label className="flex items-center gap-2">
            Image :
            <input
              value={e.cardImage ?? ""}
              placeholder="cards/..."
              onChange={(ev) => onChange({ cardImage: ev.target.value || undefined })}
              className={`${INPUT} w-full max-w-md`}
            />
          </label>
        </div>
      </details>
    </div>
  );
}
