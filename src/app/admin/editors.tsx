import type { ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Catalog, Equipment, Limitation, RuleText, SkillRef } from "@core";
import { AddButton, Combobox, RemoveButton } from "./primitives";
import { INPUT, LEVEL_LABEL, removeAt, replaceAt } from "./shared";

// ── Liste réordonnable (drag & drop) ──────────────────────────────────────────
// L'ordre des éléments = leur ordre d'affichage dans les profils ; on le contrôle par glisser-déposer.

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 5 : undefined,
      }}
      className="flex items-start gap-2"
    >
      <button type="button" className="adm-grip" title="Glisser pour réordonner" {...attributes} {...listeners}>
        ⠿
      </button>
      {children}
    </div>
  );
}

function SortableList<T>({
  items,
  onReorder,
  children,
}: {
  items: T[];
  onReorder: (v: T[]) => void;
  children: (item: T, i: number) => ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = items.map((_, i) => String(i));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(items, Number(active.id), Number(over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item, i) => (
            <SortableRow key={i} id={String(i)}>
              {children(item, i)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Éditeurs de champs complexes ─────────────────────────────────────────────

export function RulesEditor({ rules, onChange }: { rules: RuleText[]; onChange: (r: RuleText[]) => void }) {
  return (
    <div className="space-y-2">
      <SortableList items={rules} onReorder={onChange}>
        {(r, i) => (
          <>
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
          </>
        )}
      </SortableList>
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
      <SortableList items={skills} onReorder={onChange}>
        {(s, i) => (
          <div className="adm-card space-y-1 p-1.5 flex-1">
            <div className="flex items-center gap-2">
            <Combobox
              value={s.skillId}
              placeholder="Rechercher une compétence…"
              options={[...cat.skills]
                .sort((a, b) => a.keyword.localeCompare(b.keyword))
                .map((sk) => ({ value: sk.id, label: sk.keyword }))}
              onChange={(v) => onChange(replaceAt(skills, i, { ...s, skillId: v }))}
            />
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
        )}
      </SortableList>
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

/** Combobox cherchable pour choisir un équipement par son nom (le catalogue s'étoffant). */
export function EquipmentCombobox({
  value,
  cat,
  onSelect,
}: {
  value: string;
  cat: Catalog;
  onSelect: (id: string) => void;
}) {
  return (
    <Combobox
      value={value}
      placeholder="Rechercher un équipement…"
      options={cat.equipment.map((x) => ({
        value: x.id,
        label: x.name,
        hint: `${x.category} · ${x.cost} Ko`,
      }))}
      onChange={onSelect}
    />
  );
}

/** Réservation structurée d'un équipement : qui peut l'équiper (traits, niveaux, factions, profils). */
const RESERVED_LEVELS = [1, 2, 3] as const;
export function ReservedToEditor({
  value,
  cat,
  onChange,
}: {
  value: Equipment["reservedTo"];
  cat: Catalog;
  onChange: (v: Equipment["reservedTo"]) => void;
}) {
  const r = value ?? {};
  const clean = (v: NonNullable<Equipment["reservedTo"]>): Equipment["reservedTo"] => {
    const out: NonNullable<Equipment["reservedTo"]> = {};
    if (v.profileIds?.length) out.profileIds = v.profileIds;
    if (v.modelIds?.length) out.modelIds = v.modelIds;
    if (v.traits?.length) out.traits = v.traits;
    if (v.levels?.length) out.levels = v.levels;
    if (v.factionIds?.length) out.factionIds = v.factionIds;
    return Object.keys(out).length ? out : undefined;
  };
  const update = (patch: Partial<NonNullable<Equipment["reservedTo"]>>) => onChange(clean({ ...r, ...patch }));
  const toggleLevel = (lvl: (typeof RESERVED_LEVELS)[number]) => {
    const levels = r.levels ?? [];
    update({ levels: levels.includes(lvl) ? levels.filter((l) => l !== lvl) : [...levels, lvl] });
  };
  const toggleFaction = (id: string) => {
    const fs = r.factionIds ?? [];
    update({ factionIds: fs.includes(id) ? fs.filter((f) => f !== id) : [...fs, id] });
  };
  return (
    <div className="space-y-2 text-xs adm-muted">
      <p className="adm-faint">Vide = équipement libre. Sinon, réservé aux figurines validant toutes les dimensions renseignées.</p>
      <div className="flex flex-wrap items-center gap-3">
        <span>niveaux :</span>
        {RESERVED_LEVELS.map((lvl) => (
          <label key={lvl} className="flex items-center gap-1">
            <input type="checkbox" checked={r.levels?.includes(lvl) ?? false} onChange={() => toggleLevel(lvl)} />
            {LEVEL_LABEL[lvl]}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span>factions :</span>
        {cat.factions.map((f) => (
          <label key={f.id} className="flex items-center gap-1">
            <input type="checkbox" checked={r.factionIds?.includes(f.id) ?? false} onChange={() => toggleFaction(f.id)} />
            {f.name}
          </label>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-1">traits :</span>
        <div className="flex-1">
          <TraitsEditor traits={r.traits ?? []} onChange={(t) => update({ traits: t })} />
        </div>
      </div>
      <ProfileMultiSelect label="profils" ids={r.profileIds ?? []} cat={cat} onChange={(v) => update({ profileIds: v })} />
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
            <EquipmentCombobox value={id} cat={cat} onSelect={(newId) => onChange(replaceAt(ids, i, newId))} />
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
      <SortableList items={items} onReorder={onChange}>
        {(r, i) => (
          <>
            <textarea
              value={r.text}
              rows={2}
              onChange={(e) => onChange(replaceAt(items, i, { text: e.target.value }))}
              className={`${INPUT} flex-1`}
            />
            <RemoveButton onClick={() => onChange(removeAt(items, i))} />
          </>
        )}
      </SortableList>
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
          <Combobox
            value={id}
            className="w-48"
            placeholder="Rechercher un profil…"
            options={cat.profiles.map((p) => ({
              value: p.id,
              label: p.name + (p.level ? ` ${LEVEL_LABEL[p.level]}` : ""),
            }))}
            onChange={(v) => onChange(replaceAt(ids, i, v))}
          />
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

