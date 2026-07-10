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
import { Combobox, DomainIcon, Field, CheckField, ChipMultiSelect } from "./admin/primitives";

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

// Libellés français des types de contrainte proposés (fallback sur l'identifiant brut).
const CONSTRAINT_LABELS: Partial<Record<ConstraintType, string>> = {
  "forbids-equipment": "Interdit d'équiper",
  "requires-present": "Nécessite une présence",
  "faction-membership": "Appartenance de faction",
  "equipment-reserved": "Équipement réservé",
  attachment: "Rattachement (garde / porteur)",
  custom: "Personnalisée (note libre)",
};

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
  if (sel.cavalier) out.cavalier = true;
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
        <input type="checkbox" checked={selector.cavalier ?? false} onChange={(e) => set({ cavalier: e.target.checked })} />
        le cavalier (effet de monture)
      </label>
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
      <div className="flex items-center gap-2">
        <span className="adm-field-label">Niveaux</span>
        <ChipMultiSelect
          options={[
            { value: "1", label: "I" },
            { value: "2", label: "II" },
            { value: "3", label: "III" },
          ]}
          selected={(selector.levels ?? []).map(String)}
          onToggle={(v) => {
            const lv = Number(v);
            const cur = selector.levels ?? [];
            const next = cur.includes(lv) ? cur.filter((x) => x !== lv) : [...cur, lv];
            set({ levels: next.length ? next : undefined });
          }}
        />
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
      <div className="flex items-center gap-2">
        <span className="adm-field-label">Mains</span>
        <ChipMultiSelect
          options={[
            { value: "1", label: "1 main" },
            { value: "2", label: "2 mains" },
          ]}
          selected={(selector.equipmentHands ?? []).map(String)}
          onToggle={(v) => {
            const h = Number(v);
            const cur = selector.equipmentHands ?? [];
            const next = cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h];
            set({ equipmentHands: next.length ? next : undefined });
          }}
        />
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
    case "grimoire-discount":
      return { kind, amount: 0 };
    case "unlock-upgrade":
      return { kind, upgradeId: "", label: "", cost: 0, equipmentCategories: [] };
    case "grant-skill":
      return { kind, skillId: "" };
    case "grant-spell":
      return { kind, spellId: "" };
    case "cap":
      return { kind, value: 0 };
    case "stat-modifier":
      return { kind, stat: "i", amount: "level" };
    case "stat-count":
      return { kind, stat: "t", of: {} };
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

// Libellés français des actions, regroupées par famille (menu de choix de l'opération).
const OP_LABELS: Record<EffectOperation["kind"], string> = {
  "cost-delta": "Modifier le coût",
  "cost-set": "Fixer le coût",
  "grimoire-discount": "Réduire un grimoire",
  "grant-skill": "Conférer une compétence",
  "grant-spell": "Conférer un sort",
  "grant-mastery-die": "Conférer un dé de maîtrise",
  "unlock-upgrade": "Débloquer une amélioration",
  "stat-modifier": "Modifier une caractéristique",
  "stat-count": "Caractéristique = comptage de figurines",
  "stat-max": "Caractéristique = plus forte du groupe",
  "skill-count": "Compétence = comptage de figurines",
  "spell-pages": "Pages de sorts",
  "limit-modifier": "Modifier la limitation (X)",
  cap: "Plafond (non implémenté)",
};

// `cap` est volontairement absent du menu (non implémenté par le moteur).
const OP_GROUPS: { group: string; kinds: EffectOperation["kind"][] }[] = [
  { group: "Coût", kinds: ["cost-delta", "cost-set", "grimoire-discount"] },
  { group: "Octrois", kinds: ["grant-skill", "grant-spell", "grant-mastery-die", "unlock-upgrade"] },
  { group: "Caractéristiques & compétences", kinds: ["stat-modifier", "stat-count", "stat-max", "skill-count"] },
  { group: "Divers", kinds: ["spell-pages", "limit-modifier"] },
];

const STAT_KEYS = ["v", "p", "a", "c", "t", "i", "stature", "pa", "pv"] as const;
type StatKey = (typeof STAT_KEYS)[number];

const skillOptions = (cat: Catalog): Option[] =>
  [...cat.skills].sort((a, b) => a.keyword.localeCompare(b.keyword, "fr")).map((s) => ({ value: s.id, label: s.keyword }));
const spellOptions = (cat: Catalog): Option[] =>
  [...cat.spells].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((s) => ({ value: s.id, label: s.name }));

// Note : `admin.css` force `width:100%` sur un `.adm-input` DANS un `.adm-field`. La largeur se règle
// donc sur le `Field` lui-même (via sa `className`), pas sur l'input.

/** Champ numérique étiqueté (label au-dessus), homogène avec le reste de l'admin. */
function NumField({
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
function TxtField({
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

function StatSelect({ value, onChange }: { value: StatKey; onChange: (s: StatKey) => void }) {
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

/** Sous-sélecteur `of` (groupe de figurines à compter / comparer), sur toute la largeur. */
function OfSelector({ label, of, cat, onChange }: { label: string; of: Selector; cat: Catalog; onChange: (s: Selector) => void }) {
  return (
    <div className="w-full space-y-1">
      <div className="adm-field-label">{label}</div>
      <SelectorEditor selector={of} cat={cat} allowSelf={false} onChange={onChange} />
    </div>
  );
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
    <div className="space-y-3">
      <Field label="Action" className="max-w-xs">
        <select
          value={op.kind}
          onChange={(e) => onChange(defaultOperation(e.target.value as EffectOperation["kind"]))}
          className={INPUT}
        >
          {OP_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.kinds.map((k) => (
                <option key={k} value={k}>
                  {OP_LABELS[k]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="flex flex-wrap items-end gap-3">
      {op.kind === "cost-delta" && (
        <>
          <NumField label="Valeur (Ko)" value={op.amount} onChange={(v) => onChange({ ...op, amount: v ?? 0 })} />
          <div className="self-center">
            <CheckField
              label="si arme de base changée"
              checked={op.requiresBaseSwap ?? false}
              onChange={(b) => onChange({ ...op, requiresBaseSwap: b || undefined })}
            />
          </div>
        </>
      )}

      {op.kind === "cost-set" && (
        <>
          <NumField label="Coût (Ko)" value={op.amount} onChange={(v) => onChange({ ...op, amount: v ?? 0 })} />
          <NumField
            label="Plafond de cibles"
            hint="défaut : 1 par source"
            value={op.maxCount ?? null}
            onChange={(v) => onChange({ ...op, maxCount: v ?? undefined })}
          />
        </>
      )}

      {op.kind === "grimoire-discount" && (
        <>
          <NumField label="Réduction (Ko)" value={op.amount} onChange={(v) => onChange({ ...op, amount: v ?? 0 })} />
          <Field label="Grimoire concerné">
            <select
              value={op.tier ?? ""}
              onChange={(e) => onChange({ ...op, tier: (e.target.value || undefined) as "petit" | "grand" | undefined })}
              className={INPUT}
            >
              <option value="">tous grimoires</option>
              <option value="petit">petit</option>
              <option value="grand">grand</option>
            </select>
          </Field>
        </>
      )}

      {op.kind === "unlock-upgrade" && (
        <>
          <TxtField label="Identifiant" value={op.upgradeId} onChange={(v) => onChange({ ...op, upgradeId: v })} w="w-32" />
          <TxtField label="Libellé" value={op.label} onChange={(v) => onChange({ ...op, label: v })} />
          <NumField label="Coût / objet" value={op.cost} onChange={(v) => onChange({ ...op, cost: v ?? 0 })} />
          <div className="w-full space-y-1">
            <div className="adm-field-label">Catégories d'équipement</div>
            <ChipMultiSelect
              options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
              selected={op.equipmentCategories}
              onToggle={(c) => {
                const cur = op.equipmentCategories;
                onChange({ ...op, equipmentCategories: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] });
              }}
            />
          </div>
          <div className="w-full space-y-1">
            <div className="adm-field-label">
              Compétences conférées
              <span className="adm-field-hint">tant que l'objet amélioré est équipé</span>
            </div>
            {(op.grantsSkills ?? []).map((gs, i) => (
              <div key={i} className="flex items-end gap-2">
                <Field label="Compétence">
                  <Combobox
                    value={gs.skillId}
                    className="w-44"
                    placeholder="Rechercher…"
                    options={skillOptions(cat)}
                    onChange={(v) => onChange({ ...op, grantsSkills: replaceAt(op.grantsSkills ?? [], i, { ...gs, skillId: v }) })}
                  />
                </Field>
                <TxtField
                  label="Valeur"
                  hint="option."
                  w="w-28"
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
          <Field label="Compétence">
            <Combobox
              value={op.skillId}
              className="w-56"
              placeholder="Rechercher une compétence…"
              options={skillOptions(cat)}
              onChange={(v) => onChange({ ...op, skillId: v })}
            />
          </Field>
          <TxtField
            label="Valeur"
            hint="option."
            w="w-28"
            value={op.value != null ? String(op.value) : ""}
            onChange={(v) => onChange({ ...op, value: v || undefined })}
          />
          <TxtField
            label="Précision"
            hint="option."
            w="w-36"
            value={op.precision ?? ""}
            onChange={(v) => onChange({ ...op, precision: v || undefined })}
          />
        </>
      )}

      {op.kind === "grant-spell" && (
        <Field label="Sort">
          <Combobox
            value={op.spellId}
            className="w-64"
            placeholder="Rechercher un sort…"
            options={spellOptions(cat)}
            onChange={(v) => onChange({ ...op, spellId: v })}
          />
        </Field>
      )}

      {op.kind === "grant-mastery-die" && (
        <div className="w-full space-y-1">
          <div className="adm-field-label">Domaines du dé</div>
          <ChipMultiSelect
            options={MASTERY_DOMAINS.map((d) => ({ value: d, label: d }))}
            selected={op.domains}
            onToggle={(d) =>
              onChange({ ...op, domains: op.domains.includes(d) ? op.domains.filter((x) => x !== d) : [...op.domains, d] })
            }
            renderIcon={(d) => <DomainIcon domain={d} />}
          />
        </div>
      )}

      {op.kind === "stat-modifier" && (
        <>
          <StatSelect value={op.stat} onChange={(s) => onChange({ ...op, stat: s })} />
          <TxtField
            label="Valeur"
            w="w-32"
            placeholder="nb ou « level »"
            value={op.amount === "level" ? "level" : String(op.amount)}
            onChange={(v) => {
              const t = v.trim();
              onChange({ ...op, amount: t === "level" ? "level" : Number(t) });
            }}
          />
        </>
      )}

      {op.kind === "stat-count" && (
        <>
          <StatSelect value={op.stat} onChange={(s) => onChange({ ...op, stat: s })} />
          <OfSelector
            label="= nombre de figurines correspondant à (plancher : valeur de base du profil)"
            of={op.of}
            cat={cat}
            onChange={(s) => onChange({ ...op, of: s })}
          />
        </>
      )}

      {op.kind === "stat-max" && (
        <>
          <StatSelect value={op.stat} onChange={(s) => onChange({ ...op, stat: s })} />
          <OfSelector
            label="= valeur la plus forte parmi le groupe (dans la portée)"
            of={op.of}
            cat={cat}
            onChange={(s) => onChange({ ...op, of: s })}
          />
        </>
      )}

      {op.kind === "skill-count" && (
        <>
          <Field label="Compétence">
            <Combobox
              value={op.skillId}
              className="w-56"
              placeholder="Rechercher une compétence…"
              options={skillOptions(cat)}
              onChange={(v) => onChange({ ...op, skillId: v })}
            />
          </Field>
          <NumField label="Par groupe de" value={op.per ?? 1} onChange={(v) => onChange({ ...op, per: v || 1 })} w="w-20" />
          <OfSelector
            label="figurines à compter (dans la portée) - arrondi à l'inférieur"
            of={op.of}
            cat={cat}
            onChange={(s) => onChange({ ...op, of: s })}
          />
        </>
      )}

      {op.kind === "spell-pages" && (
        <NumField label="Pages" value={op.amount} onChange={(v) => onChange({ ...op, amount: v ?? 0 })} />
      )}

      {op.kind === "limit-modifier" && (
        <NumField label="Montant" value={op.amount} onChange={(v) => onChange({ ...op, amount: v ?? 0 })} />
      )}
      </div>
    </div>
  );
}

// ── Params d'une contrainte (selon le type) ───────────────────────────────────

const GRIMOIRE_OPTIONS: Option[] = [
  { value: "petit", label: "petit" },
  { value: "grand", label: "grand" },
];

/** Bloc de puces étiqueté (label au-dessus), pour un ensemble borné de valeurs. */
function ChipsField({
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
        <div className="space-y-2">
          <ChipsField
            label="Catégories interdites"
            options={EQUIPMENT_CATEGORIES.map((c): Option => ({ value: c, label: c }))}
            selected={arr("categories")}
            onChange={(v) => set({ categories: v })}
          />
          {/* Sur une carte spéciale : le profil visé. Sur une fiche de profil, le sujet est la figurine. */}
          {!onProfile && (
            <Field label="Profil visé" className="max-w-xs">
              <Combobox
                value={str("profileId")}
                options={profileOptions(cat)}
                placeholder="Rechercher un profil…"
                onChange={(v) => set({ profileId: v || undefined })}
              />
            </Field>
          )}
        </div>
      );
    case "requires-present":
      return (
        <div className="flex flex-wrap gap-3">
          <Field label="Sujet" className="w-56">
            <Combobox
              value={str("subjectProfileId")}
              options={profileOptions(cat)}
              placeholder="Rechercher un profil…"
              onChange={(v) => set({ subjectProfileId: v })}
            />
          </Field>
          <Field label="Requiert la présence de" className="w-56">
            <Combobox
              value={str("requiredProfileId")}
              options={profileOptions(cat)}
              placeholder="Rechercher un profil…"
              onChange={(v) => set({ requiredProfileId: v })}
            />
          </Field>
        </div>
      );
    case "faction-membership":
      return (
        <ChipsField
          label="Factions autorisées"
          options={cat.factions.map((f): Option => ({ value: f.id, label: f.name }))}
          selected={arr("allowedFactions")}
          onChange={(v) => set({ allowedFactions: v })}
        />
      );
    case "equipment-reserved":
      return (
        <ChipsField
          label="Grimoires interdits"
          options={GRIMOIRE_OPTIONS}
          selected={arr("forbidGrimoires")}
          onChange={(v) => set({ forbidGrimoires: v })}
        />
      );
    case "attachment": {
      const carrier = (params.carrier as { trait?: string } | undefined) ?? {};
      return (
        <div className="flex flex-wrap gap-3">
          <TxtField
            label="Trait du porteur"
            value={carrier.trait ?? ""}
            onChange={(v) => set({ carrier: v ? { trait: v } : undefined })}
          />
          <TxtField
            label="Règle de capacité"
            value={str("capacityRule")}
            onChange={(v) => set({ capacityRule: v || undefined })}
          />
        </div>
      );
    }
    default:
      // Types sans éditeur dédié (custom…) : params libres en JSON.
      return (
        <Field label="Paramètres (JSON)">
          <textarea
            defaultValue={JSON.stringify(params, null, 2)}
            onBlur={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                /* JSON invalide : ignoré jusqu'à correction */
              }
            }}
            className={`${INPUT} block w-full font-mono`}
            rows={3}
          />
        </Field>
      );
  }
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
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Type" className="w-56">
              <select value={c.type} onChange={(e) => update(i, { ...c, type: e.target.value as ConstraintType, params: {} })} className={INPUT}>
                {CONSTRAINT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONSTRAINT_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Portée" className="w-40">
              <select value={c.scope} onChange={(e) => update(i, { ...c, scope: e.target.value as Constraint["scope"] })} className={INPUT}>
                <option value="profil">profil</option>
                <option value="fer-de-lance">fer-de-lance</option>
                <option value="ost">ost</option>
              </select>
            </Field>
            <Field label="Sévérité" className="w-32">
              <select value={c.severity} onChange={(e) => update(i, { ...c, severity: e.target.value as Constraint["severity"] })} className={INPUT}>
                <option value="error">erreur</option>
                <option value="warning">avertissement</option>
              </select>
            </Field>
            <div className="self-center">
              <CheckField
                label="vérifiée automatiquement"
                checked={c.autoEnforced}
                onChange={(b) => update(i, { ...c, autoEnforced: b })}
              />
            </div>
          </div>
          <div className="adm-field-label pt-1">Paramètres</div>
          <ParamsEditor type={c.type} params={c.params} cat={cat} onChange={(p) => update(i, { ...c, params: p })} onProfile={onProfile} />
          <Field label="Texte verbatim" hint="fait foi">
            <textarea value={c.sourceText} onChange={(e) => update(i, { ...c, sourceText: e.target.value })} className={`${INPUT} block w-full`} rows={2} />
          </Field>
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
          <Field label="Portée" className="max-w-[12rem]">
            <select value={e.scope} onChange={(ev) => update(i, { ...e, scope: ev.target.value as Effect["scope"] })} className={INPUT}>
              <option value="fer-de-lance">fer-de-lance</option>
              <option value="ost">ost</option>
            </select>
          </Field>
          <div className="adm-field-label pt-1">Opération</div>
          <OperationEditor op={e.operation} cat={cat} onChange={(op) => update(i, { ...e, operation: op })} />
          <div className="adm-field-label pt-1">Cible</div>
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
          <Field label="Texte verbatim" hint="fait foi">
            <textarea value={e.sourceText} onChange={(ev) => update(i, { ...e, sourceText: ev.target.value })} className={`${INPUT} block w-full`} rows={2} />
          </Field>
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
