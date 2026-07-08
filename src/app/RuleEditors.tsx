import type {
  Catalog,
  Constraint,
  ConstraintType,
  Effect,
  EffectOperation,
  Selector,
} from "@core";
import { describeConstraint, describeEffect } from "@ui/explain";
import { EQUIPMENT_CATEGORIES, MASTERY_DOMAINS, INPUT, removeAt, replaceAt } from "./admin/shared";
import { Combobox, DomainIcon } from "./admin/primitives";

/** Éditeurs structurés des contraintes et effets (propres à un profil). */

// Types réellement appliqués par le moteur (+ « custom » = note libre non vérifiée).
// Les types prévus mais non implémentés sont retirés jusqu'à leur implémentation, pour ne pas
// exposer des champs sans effet.
const CONSTRAINT_TYPES: ConstraintType[] = [
  "forbids-equipment",
  "requires-present",
  "faction-membership",
  "equipment-reserved",
  "attachment",
  "custom",
];

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="adm-add"
    >
      {children}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Supprimer" className="adm-x">
      ✕
    </button>
  );
}

type Option = { value: string; label: string };

function StringList({
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
      <span className="text-xs adm-faint">{label}</span>
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

function profileOptions(cat: Catalog): Option[] {
  return cat.profiles.map((p) => ({ value: p.id, label: p.name + (p.level ? ` ${p.level}` : "") }));
}

/** Un modèle regroupe tous ses niveaux ; libellé = nom (sans niveau) d'un profil du modèle. */
function modelOptions(cat: Catalog): Option[] {
  const byModel = new Map<string, string>();
  for (const p of cat.profiles) {
    if (p.modelId && !byModel.has(p.modelId)) byModel.set(p.modelId, p.name);
  }
  return [...byModel].map(([value, label]) => ({ value, label }));
}

// ── Sélecteur (cible / condition) ─────────────────────────────────────────────

function cleanSelector(sel: Selector): Selector {
  const out: Selector = {};
  if (sel.self) out.self = true;
  if (sel.all) out.all = true;
  if (sel.profileIds?.length) out.profileIds = sel.profileIds;
  if (sel.modelIds?.length) out.modelIds = sel.modelIds;
  if (sel.traits?.length) out.traits = sel.traits;
  if (sel.factionIds?.length) out.factionIds = sel.factionIds;
  if (sel.levels?.length) out.levels = sel.levels;
  if (sel.isLeader != null) out.isLeader = sel.isLeader;
  if (sel.equipmentCategories?.length) out.equipmentCategories = sel.equipmentCategories;
  if (sel.equipmentIds?.length) out.equipmentIds = sel.equipmentIds;
  if (sel.equipmentHands?.length) out.equipmentHands = sel.equipmentHands;
  if (sel.countAtLeast != null) out.countAtLeast = sel.countAtLeast;
  return out;
}

function SelectorEditor({
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
    <div className="adm-card space-y-1.5 p-2">
      {allowSelf && (
        <label className="flex items-center gap-1 text-xs adm-muted">
          <input type="checkbox" checked={selector.self ?? false} onChange={(e) => set({ self: e.target.checked })} />
          lui-même (self)
        </label>
      )}
      <label className="flex items-center gap-1 text-xs adm-muted">
        <input type="checkbox" checked={selector.all ?? false} onChange={(e) => set({ all: e.target.checked })} />
        toutes les figurines (portée entière)
      </label>
      <StringList
        label="profils"
        values={selector.profileIds ?? []}
        onChange={(v) => set({ profileIds: v })}
        options={profileOptions(cat)}
        combo
      />
      <StringList
        label="modèles"
        values={selector.modelIds ?? []}
        onChange={(v) => set({ modelIds: v })}
        options={modelOptions(cat)}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs adm-faint">
        niveaux
        {[1, 2, 3].map((lv) => (
          <label key={lv} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={selector.levels?.includes(lv) ?? false}
              onChange={(e) => {
                const cur = selector.levels ?? [];
                const next = e.target.checked ? [...cur, lv] : cur.filter((x) => x !== lv);
                set({ levels: next.length ? next : undefined });
              }}
            />
            {["I", "II", "III"][lv - 1]}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs adm-faint">
        meneur
        <select
          value={selector.isLeader == null ? "" : selector.isLeader ? "yes" : "no"}
          onChange={(e) =>
            set({ isLeader: e.target.value === "" ? undefined : e.target.value === "yes" })
          }
          className={INPUT}
        >
          <option value="">indifférent</option>
          <option value="yes">est le meneur</option>
          <option value="no">n'est pas le meneur</option>
        </select>
      </label>
      <StringList label="traits" values={selector.traits ?? []} onChange={(v) => set({ traits: v })} placeholder="trait" />
      <StringList
        label="factions"
        values={selector.factionIds ?? []}
        onChange={(v) => set({ factionIds: v })}
        options={cat.factions.map((f) => ({ value: f.id, label: f.name }))}
      />
      <StringList
        label="équip. (cat.)"
        values={selector.equipmentCategories ?? []}
        onChange={(v) => set({ equipmentCategories: v as Selector["equipmentCategories"] })}
        options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
      />
      <StringList
        label="équip. (précis)"
        values={selector.equipmentIds ?? []}
        onChange={(v) => set({ equipmentIds: v })}
        options={cat.equipment.map((e) => ({ value: e.id, label: e.name }))}
      />
      <div className="flex items-center gap-2 text-xs adm-faint">
        mains
        {[1, 2].map((h) => (
          <label key={h} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={selector.equipmentHands?.includes(h) ?? false}
              onChange={(e) => {
                const cur = selector.equipmentHands ?? [];
                const next = e.target.checked ? [...cur, h] : cur.filter((x) => x !== h);
                set({ equipmentHands: next.length ? next : undefined });
              }}
            />
            {h}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-1 text-xs adm-faint">
        au moins
        <input
          type="number"
          value={selector.countAtLeast ?? ""}
          onChange={(e) => set({ countAtLeast: e.target.value === "" ? undefined : Number(e.target.value) })}
          className={`${INPUT} w-16`}
        />
      </label>
    </div>
  );
}

// ── Opération d'un effet ──────────────────────────────────────────────────────

function defaultOperation(kind: EffectOperation["kind"]): EffectOperation {
  switch (kind) {
    case "cost-delta":
      return { kind, amount: 0 };
    case "cost-set":
      return { kind, amount: 0 };
    case "unlock-upgrade":
      return { kind, upgradeId: "", label: "", cost: 0, equipmentCategories: [] };
    case "grant-skill":
      return { kind, skillId: "" };
    case "grant-trait":
      return { kind, trait: "" };
    case "grant-spell":
      return { kind, spellId: "" };
    case "cap":
      return { kind, value: 0 };
    case "stat-modifier":
      return { kind, stat: "i", amount: "level" };
    case "stat-count":
      return { kind, stat: "t", of: {}, atLeastBase: true };
    case "stat-max":
      return { kind, stat: "t", of: {} };
    case "skill-count":
      return { kind, skillId: "", of: {}, per: 3 };
    case "spell-pages":
      return { kind, amount: 0 };
    case "limit-modifier":
      return { kind, amount: 1 };
    case "grant-mastery-die":
      return { kind, domains: [] };
  }
}

function OperationEditor({
  op,
  cat,
  onChange,
}: {
  op: EffectOperation;
  cat: Catalog;
  onChange: (op: EffectOperation) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={op.kind}
        onChange={(e) => onChange(defaultOperation(e.target.value as EffectOperation["kind"]))}
        className={INPUT}
      >
        {/*
          Seules les opérations réellement appliquées par le moteur sont proposées.
          `stat-modifier` est gardé car utilisé « en jeu » (affiché, non calculé au coût).
          `cap` reste retiré tant qu'il n'est pas implémenté.
        */}
        {(
          [
            "cost-delta",
            "cost-set",
            "unlock-upgrade",
            "grant-skill",
            "grant-trait",
            "grant-spell",
            "stat-modifier",
            "stat-count",
            "stat-max",
            "skill-count",
            "spell-pages",
            "limit-modifier",
            "grant-mastery-die",
          ] as const
        ).map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      {op.kind === "cost-delta" && (
        <>
          <Num label="montant" value={op.amount} onChange={(v) => onChange({ ...op, amount: v })} />
          <label className="flex items-center gap-1 text-xs adm-faint">
            <input
              type="checkbox"
              checked={op.requiresBaseSwap ?? false}
              onChange={(e) => onChange({ ...op, requiresBaseSwap: e.target.checked || undefined })}
            />
            si arme de base changée
          </label>
        </>
      )}
      {op.kind === "limit-modifier" && (
        <Num label="montant" value={op.amount} onChange={(v) => onChange({ ...op, amount: v })} />
      )}
      {op.kind === "grant-mastery-die" && (
        <div className="flex w-full flex-wrap items-center gap-3 text-xs adm-faint">
          domaines du dé
          {MASTERY_DOMAINS.map((d) => {
            const on = op.domains.includes(d);
            return (
              <label key={d} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    onChange({ ...op, domains: on ? op.domains.filter((x) => x !== d) : [...op.domains, d] })
                  }
                />
                <DomainIcon domain={d} />
                {d}
              </label>
            );
          })}
        </div>
      )}
      {op.kind === "cost-set" && (
        <>
          <Num label="coût" value={op.amount} onChange={(v) => onChange({ ...op, amount: v })} />
          <Num
            label="max"
            value={op.maxCount ?? null}
            onChange={(v) => onChange({ ...op, maxCount: v ?? undefined })}
          />
        </>
      )}
      {op.kind === "unlock-upgrade" && (
        <>
          <Txt label="upgradeId" value={op.upgradeId} onChange={(v) => onChange({ ...op, upgradeId: v })} />
          <Txt label="libellé" value={op.label} onChange={(v) => onChange({ ...op, label: v })} />
          <Num label="coût/objet" value={op.cost} onChange={(v) => onChange({ ...op, cost: v ?? 0 })} />
          <div className="flex w-full flex-wrap items-center gap-2 text-xs adm-faint">
            catégories
            {EQUIPMENT_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={op.equipmentCategories.includes(c)}
                  onChange={(e) => {
                    const cur = op.equipmentCategories;
                    const next = e.target.checked ? [...cur, c] : cur.filter((x) => x !== c);
                    onChange({ ...op, equipmentCategories: next });
                  }}
                />
                {c}
              </label>
            ))}
          </div>
          <div className="flex w-full flex-col gap-1 text-xs adm-faint">
            <span>compétences conférées (tant que l'objet amélioré est équipé)</span>
            {(op.grantsSkills ?? []).map((gs, i) => (
              <div key={i} className="flex items-center gap-2">
                <Combobox
                  value={gs.skillId}
                  className="w-44"
                  placeholder="Compétence…"
                  options={[...cat.skills]
                    .sort((a, b) => a.keyword.localeCompare(b.keyword, "fr"))
                    .map((s) => ({ value: s.id, label: s.keyword }))}
                  onChange={(v) => onChange({ ...op, grantsSkills: replaceAt(op.grantsSkills ?? [], i, { ...gs, skillId: v }) })}
                />
                <Txt
                  label="valeur (option.)"
                  value={gs.value != null ? String(gs.value) : ""}
                  onChange={(v) => onChange({ ...op, grantsSkills: replaceAt(op.grantsSkills ?? [], i, { ...gs, value: v || undefined }) })}
                />
                <RemoveButton
                  onClick={() => {
                    const next = removeAt(op.grantsSkills ?? [], i);
                    onChange({ ...op, grantsSkills: next.length ? next : undefined });
                  }}
                />
              </div>
            ))}
            <AddButton onClick={() => onChange({ ...op, grantsSkills: [...(op.grantsSkills ?? []), { skillId: "" }] })}>
              + compétence
            </AddButton>
          </div>
        </>
      )}
      {op.kind === "grant-skill" && (
        <>
          <Combobox
            value={op.skillId}
            className="w-48"
            placeholder="Rechercher une compétence…"
            options={[...cat.skills]
              .sort((a, b) => a.keyword.localeCompare(b.keyword))
              .map((s) => ({ value: s.id, label: s.keyword }))}
            onChange={(v) => onChange({ ...op, skillId: v })}
          />
          <Txt
            label="valeur (option.)"
            value={op.value != null ? String(op.value) : ""}
            onChange={(v) => onChange({ ...op, value: v || undefined })}
          />
        </>
      )}
      {op.kind === "grant-trait" && (
        <Txt label="trait" value={op.trait} onChange={(v) => onChange({ ...op, trait: v })} />
      )}
      {op.kind === "grant-spell" && (
        <Combobox
          value={op.spellId}
          className="w-56"
          placeholder="Rechercher un sort…"
          options={[...cat.spells]
            .sort((a, b) => a.name.localeCompare(b.name, "fr"))
            .map((s) => ({ value: s.id, label: s.name }))}
          onChange={(v) => onChange({ ...op, spellId: v })}
        />
      )}
      {op.kind === "cap" && <Num label="valeur" value={op.value} onChange={(v) => onChange({ ...op, value: v })} />}
      {op.kind === "stat-modifier" && (
        <>
          <select
            value={op.stat}
            onChange={(ev) => onChange({ ...op, stat: ev.target.value as typeof op.stat })}
            className={INPUT}
          >
            {(["v", "p", "a", "c", "t", "i", "stature", "pa", "pv"] as const).map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <input
            value={op.amount === "level" ? "level" : String(op.amount)}
            placeholder='nombre ou "level"'
            onChange={(ev) => {
              const v = ev.target.value.trim();
              onChange({ ...op, amount: v === "level" ? "level" : Number(v) });
            }}
            className={`${INPUT} w-28`}
          />
        </>
      )}
      {op.kind === "stat-count" && (
        <>
          <select
            value={op.stat}
            onChange={(ev) => onChange({ ...op, stat: ev.target.value as typeof op.stat })}
            className={INPUT}
          >
            {(["v", "p", "a", "c", "t", "i", "stature", "pa", "pv"] as const).map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <span className="text-xs adm-faint">= nombre de</span>
          <label className="flex items-center gap-1 text-xs adm-muted">
            <input
              type="checkbox"
              checked={op.atLeastBase ?? false}
              onChange={(ev) => onChange({ ...op, atLeastBase: ev.target.checked || undefined })}
            />
            minimum = valeur de base
          </label>
          <div className="w-full">
            <div className="mb-1 text-xs adm-faint">figurines à compter (dans la portée)</div>
            <SelectorEditor selector={op.of} cat={cat} allowSelf={false} onChange={(s) => onChange({ ...op, of: s })} />
          </div>
        </>
      )}
      {op.kind === "stat-max" && (
        <>
          <select
            value={op.stat}
            onChange={(ev) => onChange({ ...op, stat: ev.target.value as typeof op.stat })}
            className={INPUT}
          >
            {(["v", "p", "a", "c", "t", "i", "stature", "pa", "pv"] as const).map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <span className="text-xs adm-faint">= valeur la plus forte parmi</span>
          <div className="w-full">
            <div className="mb-1 text-xs adm-faint">groupe de figurines (dans la portée)</div>
            <SelectorEditor selector={op.of} cat={cat} allowSelf={false} onChange={(s) => onChange({ ...op, of: s })} />
          </div>
        </>
      )}
      {op.kind === "skill-count" && (
        <>
          <span className="text-xs adm-faint">valeur de</span>
          <Combobox
            value={op.skillId}
            className="w-48"
            placeholder="Rechercher une compétence…"
            options={[...cat.skills]
              .sort((a, b) => a.keyword.localeCompare(b.keyword))
              .map((s) => ({ value: s.id, label: s.keyword }))}
            onChange={(v) => onChange({ ...op, skillId: v })}
          />
          <span className="text-xs adm-faint">= nombre de figurines ÷</span>
          <Num label="par groupe de" value={op.per ?? 1} onChange={(v) => onChange({ ...op, per: v || 1 })} />
          <div className="w-full">
            <div className="mb-1 text-xs adm-faint">figurines à compter (dans la portée) - arrondi à l'inférieur</div>
            <SelectorEditor selector={op.of} cat={cat} allowSelf={false} onChange={(s) => onChange({ ...op, of: s })} />
          </div>
        </>
      )}
      {op.kind === "spell-pages" && (
        <Num label="pages" value={op.amount} onChange={(v) => onChange({ ...op, amount: v })} />
      )}
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs adm-faint">
      {label}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${INPUT} w-20`}
      />
    </label>
  );
}

function Txt({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs adm-faint">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} w-32`} />
    </label>
  );
}

// ── Params d'une contrainte (selon le type) ───────────────────────────────────

function ParamsEditor({
  type,
  params,
  cat,
  onChange,
  onProfile,
}: {
  type: ConstraintType;
  params: Record<string, unknown>;
  cat: Catalog;
  onChange: (p: Record<string, unknown>) => void;
  /** true = édité sur une fiche de profil (le sujet est la figurine elle-même). */
  onProfile: boolean;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...params, ...patch });
  const arr = (k: string): string[] => (Array.isArray(params[k]) ? (params[k] as string[]) : []);
  const str = (k: string): string => (typeof params[k] === "string" ? (params[k] as string) : "");

  switch (type) {
    case "forbids-equipment":
      return (
        <div className="space-y-1.5">
          <StringList
            label="catégories interdites"
            values={arr("categories")}
            onChange={(v) => set({ categories: v })}
            options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          {/* Sur une carte spéciale : le profil visé. Sur une fiche de profil, le sujet est la figurine. */}
          {!onProfile && (
            <Txt label="profil (sujet)" value={str("profileId")} onChange={(v) => set({ profileId: v || undefined })} />
          )}
        </div>
      );
    case "requires-present":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="sujet"
            value={str("subjectProfileId")}
            onChange={(v) => set({ subjectProfileId: v })}
            options={profileOptions(cat)}
          />
          <Select
            label="requiert"
            value={str("requiredProfileId")}
            onChange={(v) => set({ requiredProfileId: v })}
            options={profileOptions(cat)}
          />
        </div>
      );
    case "faction-membership":
      return (
        <StringList
          label="factions autorisées"
          values={arr("allowedFactions")}
          onChange={(v) => set({ allowedFactions: v })}
          options={cat.factions.map((f) => ({ value: f.id, label: f.name }))}
        />
      );
    case "equipment-reserved":
      return (
        <StringList
          label="grimoires interdits"
          values={arr("forbidGrimoires")}
          onChange={(v) => set({ forbidGrimoires: v })}
          options={[
            { value: "petit", label: "petit" },
            { value: "grand", label: "grand" },
          ]}
        />
      );
    default:
      return (
        <label className="block text-xs adm-faint">
          params (JSON)
          <textarea
            defaultValue={JSON.stringify(params, null, 2)}
            onBlur={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                /* JSON invalide : ignoré jusqu'à correction */
              }
            }}
            className={`${INPUT} mt-1 block w-full font-mono`}
            rows={3}
          />
        </label>
      );
  }
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <label className="flex items-center gap-1 text-xs adm-faint">
      {label}
      <Combobox value={value} options={options} onChange={onChange} className="w-44" />
    </label>
  );
}

// ── Carte d'édition (commune) ─────────────────────────────────────────────────

function EditorCard({ children, preview, onRemove }: { children: React.ReactNode; preview: string; onRemove: () => void }) {
  return (
    <details className="adm-card">
      <summary className="adm-summary flex cursor-pointer list-none items-center gap-2 p-3 [&::-webkit-details-marker]:hidden">
        <span className="adm-ok flex-1 text-sm">↳ {preview}</span>
        <span className="adm-faint text-xs">modifier ▾</span>
        <button
          type="button"
          title="Supprimer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="adm-x"
        >
          ✕
        </button>
      </summary>
      <div className="adm-bd space-y-2 border-t p-3">{children}</div>
    </details>
  );
}

// ── Listes éditables ──────────────────────────────────────────────────────────

export function ConstraintListEditor({
  constraints,
  cat,
  onChange,
  onProfile = false,
}: {
  constraints: Constraint[];
  cat: Catalog;
  onChange: (c: Constraint[]) => void;
  /** true quand édité sur une fiche de profil (masque le champ « profil sujet » redondant). */
  onProfile?: boolean;
}) {
  const update = (i: number, c: Constraint) => onChange(replaceAt(constraints, i, c));
  return (
    <div className="space-y-2">
      {constraints.map((c, i) => (
        <EditorCard key={i} preview={describeConstraint(c, cat)} onRemove={() => onChange(removeAt(constraints, i))}>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-1 text-xs adm-faint">
              type
              <select value={c.type} onChange={(e) => update(i, { ...c, type: e.target.value as ConstraintType, params: {} })} className={INPUT}>
                {CONSTRAINT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs adm-faint">
              portée
              <select value={c.scope} onChange={(e) => update(i, { ...c, scope: e.target.value as Constraint["scope"] })} className={INPUT}>
                <option value="profil">profil</option>
                <option value="fer-de-lance">fer-de-lance</option>
                <option value="ost">ost</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs adm-faint">
              sévérité
              <select value={c.severity} onChange={(e) => update(i, { ...c, severity: e.target.value as Constraint["severity"] })} className={INPUT}>
                <option value="error">error</option>
                <option value="warning">warning</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs adm-muted">
              <input type="checkbox" checked={c.autoEnforced} onChange={(e) => update(i, { ...c, autoEnforced: e.target.checked })} />
              auto-vérifiée
            </label>
          </div>
          <ParamsEditor type={c.type} params={c.params} cat={cat} onChange={(p) => update(i, { ...c, params: p })} onProfile={onProfile} />
          <label className="block text-xs adm-faint">
            wording verbatim (fait foi)
            <textarea value={c.sourceText} onChange={(e) => update(i, { ...c, sourceText: e.target.value })} className={`${INPUT} mt-1 block w-full`} rows={2} />
          </label>
        </EditorCard>
      ))}
      <AddButton
        onClick={() =>
          onChange([
            ...constraints,
            {
              id: `c-${Date.now()}`,
              type: "custom",
              params: {},
              scope: "profil",
              sourceText: "",
              severity: "error",
              autoEnforced: false,
            },
          ])
        }
      >
        + contrainte
      </AddButton>
    </div>
  );
}

export function EffectListEditor({
  effects,
  newSource,
  cat,
  onChange,
}: {
  effects: Effect[];
  newSource: Effect["source"];
  cat: Catalog;
  onChange: (e: Effect[]) => void;
}) {
  const update = (i: number, e: Effect) => onChange(replaceAt(effects, i, e));
  return (
    <div className="space-y-2">
      {effects.map((e, i) => (
        <EditorCard key={i} preview={describeEffect(e, cat)} onRemove={() => onChange(removeAt(effects, i))}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs adm-faint">
              portée
              <select value={e.scope} onChange={(ev) => update(i, { ...e, scope: ev.target.value as Effect["scope"] })} className={INPUT}>
                <option value="fer-de-lance">fer-de-lance</option>
                <option value="ost">ost</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs adm-muted">
              <input type="checkbox" checked={e.appliesToListBuilding} onChange={(ev) => update(i, { ...e, appliesToListBuilding: ev.target.checked })} />
              calculé par l'éditeur
            </label>
          </div>
          <div className="text-xs adm-faint">opération</div>
          <OperationEditor op={e.operation} cat={cat} onChange={(op) => update(i, { ...e, operation: op })} />
          <div className="text-xs adm-faint">cible</div>
          <SelectorEditor selector={e.target} cat={cat} onChange={(s) => update(i, { ...e, target: s })} />
          <details>
            <summary className="cursor-pointer text-xs adm-faint">
              conditions (optionnelles) - toutes doivent être vraies
            </summary>
            <div className="mt-1 space-y-1.5">
              {(() => {
                const conds: Selector[] = e.condition
                  ? Array.isArray(e.condition)
                    ? e.condition
                    : [e.condition]
                  : [];
                const commit = (next: Selector[]) => {
                  const cleaned = next.filter((s) => Object.keys(s).length > 0);
                  update(i, {
                    ...e,
                    condition:
                      cleaned.length === 0 ? undefined : cleaned.length === 1 ? cleaned[0] : cleaned,
                  });
                };
                return (
                  <>
                    {conds.map((c, ci) => (
                      <div key={ci} className="flex items-start gap-2">
                        <div className="flex-1">
                          <SelectorEditor
                            selector={c}
                            cat={cat}
                            allowSelf={false}
                            onChange={(s) => commit(replaceAt(conds, ci, s))}
                          />
                        </div>
                        <button
                          type="button"
                          className="adm-x"
                          title="Retirer la clause"
                          onClick={() => commit(removeAt(conds, ci))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <AddButton onClick={() => commit([...conds, { countAtLeast: 1 }])}>+ clause</AddButton>
                  </>
                );
              })()}
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-xs adm-faint">
              désignation « garde du corps » (optionnel)
            </summary>
            <div className="mt-1 space-y-1">
              <p className="text-xs adm-faint">
                Si renseigné, la cible (le garde) ne bénéficie de l'effet que si elle est désignée pour
                protéger l'une de ces figurines.
              </p>
              <SelectorEditor
                selector={e.designation?.of ?? {}}
                cat={cat}
                allowSelf={false}
                onChange={(s) => update(i, { ...e, designation: Object.keys(s).length ? { of: s } : undefined })}
              />
            </div>
          </details>
          <label className="block text-xs adm-faint">
            wording verbatim (fait foi)
            <textarea value={e.sourceText} onChange={(ev) => update(i, { ...e, sourceText: ev.target.value })} className={`${INPUT} mt-1 block w-full`} rows={2} />
          </label>
        </EditorCard>
      ))}
      <AddButton
        onClick={() =>
          onChange([
            ...effects,
            {
              id: `e-${Date.now()}`,
              source: newSource,
              scope: "fer-de-lance",
              target: { self: true },
              operation: { kind: "cost-delta", amount: 0 },
              appliesToListBuilding: true,
              sourceText: "",
              autoEnforced: true,
            },
          ])
        }
      >
        + effet
      </AddButton>
    </div>
  );
}
