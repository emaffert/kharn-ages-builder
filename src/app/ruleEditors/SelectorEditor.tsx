import type { Catalog, Selector } from "@core";
import { EQUIPMENT_CATEGORIES, INPUT } from "../admin/shared";
import { Field, CheckField } from "../admin/primitives";
import { ChipRow, NumField, StringList } from "./kit";
import { cleanSelector, modelOptions, profileOptions, type Option } from "./helpers";

/** Éditeur d'un sélecteur (cible d'un effet, condition, sous-groupe `of`). */
export function SelectorEditor({
  selector,
  cat,
  onChange,
  allowSelf = true,
}: {
  selector: Selector;
  cat: Catalog;
  onChange: (s: Selector) => void;
  allowSelf?: boolean;
}) {
  const set = (patch: Partial<Selector>) => onChange(cleanSelector({ ...selector, ...patch }));
  return (
    <div className="adm-card space-y-2 p-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {allowSelf && (
          <CheckField label="lui-même (self)" checked={selector.self ?? false} onChange={(b) => set({ self: b })} />
        )}
        <CheckField
          label="le cavalier (effet de monture)"
          checked={selector.cavalier ?? false}
          onChange={(b) => set({ cavalier: b })}
        />
        <CheckField
          label="toutes les figurines (portée entière)"
          checked={selector.all ?? false}
          onChange={(b) => set({ all: b })}
        />
      </div>
      <StringList
        label="Profils"
        values={selector.profileIds ?? []}
        onChange={(v) => set({ profileIds: v })}
        options={profileOptions(cat)}
        combo
      />
      <StringList
        label="Modèles"
        values={selector.modelIds ?? []}
        onChange={(v) => set({ modelIds: v })}
        options={modelOptions(cat)}
      />
      <StringList label="Traits" values={selector.traits ?? []} onChange={(v) => set({ traits: v })} placeholder="trait" />
      <ChipRow
        label="Niveaux"
        options={[
          { value: "1", label: "I" },
          { value: "2", label: "II" },
          { value: "3", label: "III" },
        ]}
        selected={(selector.levels ?? []).map(String)}
        onChange={(v) => set({ levels: v.length ? v.map(Number) : undefined })}
      />
      <ChipRow
        label="Factions"
        options={cat.factions.map((f): Option => ({ value: f.id, label: f.name }))}
        selected={selector.factionIds ?? []}
        onChange={(v) => set({ factionIds: v.length ? v : undefined })}
      />
      <Field label="Meneur" className="w-48">
        <select
          value={selector.isLeader == null ? "" : selector.isLeader ? "yes" : "no"}
          onChange={(e) => set({ isLeader: e.target.value === "" ? undefined : e.target.value === "yes" })}
          className={INPUT}
        >
          <option value="">indifférent</option>
          <option value="yes">est le meneur</option>
          <option value="no">n'est pas le meneur</option>
        </select>
      </Field>
      <ChipRow
        label="Équip. (catégories)"
        options={EQUIPMENT_CATEGORIES.map((c): Option => ({ value: c, label: c }))}
        selected={selector.equipmentCategories ?? []}
        onChange={(v) => set({ equipmentCategories: v.length ? (v as Selector["equipmentCategories"]) : undefined })}
      />
      <StringList
        label="Équip. (précis)"
        values={selector.equipmentIds ?? []}
        onChange={(v) => set({ equipmentIds: v })}
        options={cat.equipment.map((e) => ({ value: e.id, label: e.name }))}
        combo
      />
      <ChipRow
        label="Mains"
        options={[
          { value: "1", label: "1 main" },
          { value: "2", label: "2 mains" },
        ]}
        selected={(selector.equipmentHands ?? []).map(String)}
        onChange={(v) => set({ equipmentHands: v.length ? v.map(Number) : undefined })}
      />
      <NumField
        label="Au moins (nombre)"
        w="w-24"
        value={selector.countAtLeast ?? null}
        onChange={(v) => set({ countAtLeast: v ?? undefined })}
      />
    </div>
  );
}

/** Sous-sélecteur `of` (groupe de figurines à compter / comparer), sur toute la largeur. */
export function OfSelector({
  label,
  of,
  cat,
  onChange,
}: {
  label: string;
  of: Selector;
  cat: Catalog;
  onChange: (s: Selector) => void;
}) {
  return (
    <div className="w-full space-y-1">
      <div className="adm-field-label">{label}</div>
      <SelectorEditor selector={of} cat={cat} allowSelf={false} onChange={onChange} />
    </div>
  );
}
