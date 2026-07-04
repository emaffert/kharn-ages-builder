import type { Catalog, Limitation, RuleText, SkillRef } from "@core";
import { AddButton, RemoveButton } from "./primitives";
import { INPUT, LEVEL_LABEL, removeAt, replaceAt } from "./shared";

// ── Éditeurs de champs complexes ─────────────────────────────────────────────

export function RulesEditor({ rules, onChange }: { rules: RuleText[]; onChange: (r: RuleText[]) => void }) {
  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <input
            placeholder="Label (optionnel)"
            value={r.label ?? ""}
            onChange={(e) => onChange(replaceAt(rules, i, { ...r, label: e.target.value || undefined }))}
            className={`${INPUT} w-32 shrink-0`}
          />
          <textarea
            value={r.text}
            rows={2}
            onChange={(e) => onChange(replaceAt(rules, i, { ...r, text: e.target.value }))}
            className={`${INPUT} flex-1`}
          />
          <RemoveButton onClick={() => onChange(removeAt(rules, i))} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...rules, { text: "" }])}>+ règle</AddButton>
    </div>
  );
}

export function SkillsEditor({
  skills,
  cat,
  onChange,
}: {
  skills: SkillRef[];
  cat: Catalog;
  onChange: (s: SkillRef[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {skills.map((s, i) => (
        <div key={i} className="adm-card space-y-1 p-1.5">
          <div className="flex items-center gap-2">
            <select
              value={s.skillId}
              onChange={(e) => onChange(replaceAt(skills, i, { ...s, skillId: e.target.value }))}
              className={`${INPUT} flex-1`}
            >
              {[...cat.skills]
                .sort((a, b) => a.keyword.localeCompare(b.keyword))
                .map((sk) => (
                  <option key={sk.id} value={sk.id}>
                    {sk.keyword}
                  </option>
                ))}
            </select>
            <input
              type="text"
              placeholder="valeur"
              value={s.value ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChange(
                  replaceAt(skills, i, {
                    ...s,
                    value: v === "" ? undefined : /^\d+$/.test(v) ? Number(v) : v,
                  }),
                );
              }}
              className={`${INPUT} w-28`}
            />
            {s.precision === undefined && (
              <button
                type="button"
                title="Ajouter une précision propre au profil"
                onClick={() => onChange(replaceAt(skills, i, { ...s, precision: "" }))}
                className="adm-add"
              >
                + précision
              </button>
            )}
            <RemoveButton onClick={() => onChange(removeAt(skills, i))} />
          </div>
          {s.precision !== undefined && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                placeholder="précision propre au profil (complète la description, hors tag)"
                value={s.precision}
                onChange={(e) => onChange(replaceAt(skills, i, { ...s, precision: e.target.value }))}
                className={`${INPUT} flex-1`}
              />
              <RemoveButton onClick={() => onChange(replaceAt(skills, i, { ...s, precision: undefined }))} />
            </div>
          )}
        </div>
      ))}
      <AddButton onClick={() => onChange([...skills, { skillId: cat.skills[0]?.id ?? "" }])}>
        + compétence
      </AddButton>
    </div>
  );
}

export function TraitsEditor({ traits, onChange }: { traits: string[]; onChange: (t: string[]) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {traits.map((t, i) => (
        <span key={i} className="adm-chip">
          <input value={t} onChange={(e) => onChange(replaceAt(traits, i, e.target.value))} />
          <RemoveButton onClick={() => onChange(removeAt(traits, i))} />
        </span>
      ))}
      <AddButton onClick={() => onChange([...traits, "nouveau-trait"])}>+ trait</AddButton>
    </div>
  );
}

export function EquipmentEditor({
  ids,
  cat,
  onChange,
}: {
  ids: string[];
  cat: Catalog;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {ids.map((id, i) => {
        const e = cat.equipment.find((x) => x.id === id);
        return (
          <div key={i} className="flex items-center gap-2">
            <select
              value={id}
              onChange={(ev) => onChange(replaceAt(ids, i, ev.target.value))}
              className={`${INPUT} flex-1`}
            >
              {cat.equipment.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <span className="w-16 text-right text-xs adm-faint">{e ? `${e.cost} Ko` : "?"}</span>
            <RemoveButton onClick={() => onChange(removeAt(ids, i))} />
          </div>
        );
      })}
      <AddButton onClick={() => onChange([...ids, cat.equipment[0]?.id ?? ""])}>
        + équipement
      </AddButton>
    </div>
  );
}

export function LimitationEditor({
  limitation,
  onChange,
}: {
  limitation: Limitation;
  onChange: (l: Limitation) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={limitation.kind}
        onChange={(e) => onChange({ ...limitation, kind: e.target.value as Limitation["kind"] })}
        className={INPUT}
      >
        <option value="X">X (multiple)</option>
        <option value="U">U (unique)</option>
        <option value="P">P (personnage)</option>
        <option value="special">special</option>
      </select>
      {limitation.kind === "X" && (
        <input
          type="number"
          value={limitation.value ?? ""}
          onChange={(e) =>
            onChange({ ...limitation, value: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          className={`${INPUT} w-16`}
          placeholder="X"
        />
      )}
    </div>
  );
}
/** Éditeur de texte multi-lignes (RuleText[] sans label) — pour cartes spéciales. */
export function TextLinesEditor({ items, onChange }: { items: RuleText[]; onChange: (r: RuleText[]) => void }) {
  return (
    <div className="space-y-2">
      {items.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            value={r.text}
            rows={2}
            onChange={(e) => onChange(replaceAt(items, i, { text: e.target.value }))}
            className={`${INPUT} flex-1`}
          />
          <RemoveButton onClick={() => onChange(removeAt(items, i))} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, { text: "" }])}>+ ligne</AddButton>
    </div>
  );
}

export function ProfileMultiSelect({
  label,
  ids,
  cat,
  onChange,
}: {
  label: string;
  ids: string[];
  cat: Catalog;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs adm-faint">{label}</span>
      {ids.map((id, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <select value={id} onChange={(e) => onChange(replaceAt(ids, i, e.target.value))} className={INPUT}>
            {cat.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.level ? ` ${LEVEL_LABEL[p.level]}` : ""}
              </option>
            ))}
          </select>
          <RemoveButton onClick={() => onChange(removeAt(ids, i))} />
        </span>
      ))}
      <AddButton onClick={() => onChange([...ids, cat.profiles[0]?.id ?? ""])}>+ profil</AddButton>
    </div>
  );
}

export function GrantsCastingEditor({
  value,
  cat,
  onChange,
}: {
  value?: { magicWayIds: string[] };
  cat: Catalog;
  onChange: (v?: { magicWayIds: string[] }) => void;
}) {
  const ids = value?.magicWayIds ?? [];
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    onChange(next.length ? { magicWayIds: next } : undefined);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs adm-faint">
      <span>Confère le lancement de sorts :</span>
      {cat.magicWays.map((w) => (
        <label key={w.id} className="flex items-center gap-1">
          <input type="checkbox" checked={ids.includes(w.id)} onChange={() => toggle(w.id)} />
          {w.name}
        </label>
      ))}
      {cat.magicWays.length === 0 && <span className="adm-faint">(aucune voie définie)</span>}
    </div>
  );
}

