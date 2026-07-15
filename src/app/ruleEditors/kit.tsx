import { INPUT, removeAt, replaceAt } from "../admin/shared";
import { Combobox, Field, ChipMultiSelect } from "../admin/primitives";
import { STAT_KEYS, type Option, type StatKey } from "./helpers";

/**
 * Primitives de champ partagées par les éditeurs de règles (contraintes / effets) : petits champs
 * étiquetés, listes de valeurs, puces. Ce fichier n'exporte que des composants (fast-refresh) ; les
 * constantes/fonctions pures sont dans `./helpers`.
 */

export function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="adm-add">
      {children}
    </button>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Supprimer" className="adm-x">
      ✕
    </button>
  );
}

export function StringList({
  label,
  values,
  onChange,
  options,
  placeholder,
  combo,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options?: Option[];
  placeholder?: string;
  /** true (avec `options`) : combobox cherchable au lieu d'un menu natif (listes qui s'étoffent). */
  combo?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="adm-field-label">{label}</span>
      {values.map((v, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {options && combo ? (
            <Combobox
              value={v}
              options={options}
              className="w-44"
              onChange={(nv) => onChange(replaceAt(values, i, nv))}
            />
          ) : options ? (
            <select value={v} onChange={(e) => onChange(replaceAt(values, i, e.target.value))} className={INPUT}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={v}
              placeholder={placeholder}
              onChange={(e) => onChange(replaceAt(values, i, e.target.value))}
              className={`${INPUT} w-32`}
            />
          )}
          <RemoveButton onClick={() => onChange(removeAt(values, i))} />
        </span>
      ))}
      <AddButton onClick={() => onChange([...values, combo ? "" : options?.[0]?.value ?? ""])}>+</AddButton>
    </div>
  );
}

/** Rangée « label + puces » pour un ensemble de valeurs (chaînes), homogène avec les `Field`. */
export function ChipRow({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="adm-field-label">{label}</span>
      <ChipMultiSelect
        options={options}
        selected={selected}
        onToggle={(v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])}
      />
    </div>
  );
}

/** Bloc de puces étiqueté (label au-dessus), pour un ensemble borné de valeurs. */
export function ChipsField({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="adm-field-label">{label}</div>
      <ChipMultiSelect
        options={options}
        selected={selected}
        onToggle={(v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])}
      />
    </div>
  );
}

// Note : `admin.css` force `width:100%` sur un `.adm-input` DANS un `.adm-field`. La largeur se règle
// donc sur le `Field` lui-même (via sa `className`), pas sur l'input.

/** Champ numérique étiqueté (label au-dessus), homogène avec le reste de l'admin. */
export function NumField({
  label,
  hint,
  value,
  onChange,
  w = "w-24",
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  w?: string;
}) {
  return (
    <Field label={label} hint={hint} className={w}>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={INPUT}
      />
    </Field>
  );
}

/** Champ texte étiqueté (label au-dessus). */
export function TxtField({
  label,
  hint,
  value,
  placeholder,
  onChange,
  w = "w-40",
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  w?: string;
}) {
  return (
    <Field label={label} hint={hint} className={w}>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </Field>
  );
}

export function StatSelect({ value, onChange }: { value: StatKey; onChange: (s: StatKey) => void }) {
  return (
    <Field label="Caractéristique" className="w-28">
      <select value={value} onChange={(e) => onChange(e.target.value as StatKey)} className={INPUT}>
        {STAT_KEYS.map((s) => (
          <option key={s} value={s}>
            {s.toUpperCase()}
          </option>
        ))}
      </select>
    </Field>
  );
}
