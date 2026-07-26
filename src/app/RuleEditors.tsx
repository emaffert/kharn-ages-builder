import { useState } from "react";
import type { Catalog, Constraint, ConstraintScope, ConstraintType, Effect, Selector } from "@core";
import { CONSTRAINT_SCOPES, defaultConstraintScope, scopeIsChosen } from "@core";
import { SegmentedControl } from "@ui";
import { describeConstraint, describeEffect } from "@ui/explain";
import { EQUIPMENT_CATEGORIES, INPUT, removeAt, replaceAt } from "./admin/shared";
import { Combobox, Field, FieldGroup, CheckField } from "./admin/primitives";
import { ProfileMultiSelect } from "./admin/editors";
import { AddButton, ChipsField, StringList, TxtField } from "./ruleEditors/kit";
import { GRIMOIRE_OPTIONS, modelOptions, profileOptions, type Option } from "./ruleEditors/helpers";
import { SelectorEditor } from "./ruleEditors/SelectorEditor";
import { OperationEditor } from "./ruleEditors/OperationEditor";

/**
 * Éditeurs structurés des contraintes et effets (propres à un profil). Les briques de bas niveau
 * sont dans `./ruleEditors/` : primitives de champ (`kit`), `SelectorEditor`, `OperationEditor`.
 * Ce fichier conserve l'API publique (`ConstraintListEditor`, `EffectListEditor`) et les paramètres
 * de contrainte.
 */

// Tous les types du modèle sont proposés : chacun est réellement appliqué par le moteur. Une règle
// qu'aucun type ne couvre se consigne dans les notes internes, pas en contrainte.
const CONSTRAINT_TYPES: ConstraintType[] = [
  "forbids-equipment",
  "requires-present",
  "faction-membership",
  "forbids-grimoire",
  "attachment",
];

// Libellés français des types de contrainte proposés (fallback sur l'identifiant brut).
const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  "forbids-equipment": "Interdit d'équiper",
  "requires-present": "Nécessite une présence",
  "faction-membership": "Appartenance de faction",
  "forbids-grimoire": "Interdit d'acquérir un grimoire",
  attachment: "Rattachement (garde / porteur)",
};

// Où le moteur cherche, dit du point de vue de l'utilisateur.
const SCOPE_LABEL: Record<ConstraintScope, string> = {
  profil: "La figurine elle-même",
  "fer-de-lance": "Le Fer de Lance",
  ost: "L'Ost (toute la liste)",
};

// Pour les types dont la portée est imposée par la mécanique : pourquoi elle ne se choisit pas.
const SCOPE_FIXED_REASON: Record<ConstraintType, string> = {
  "forbids-equipment": "La règle ne regarde que l'équipement de cette figurine.",
  "forbids-grimoire": "La règle ne regarde que les acquisitions de cette figurine.",
  "faction-membership": "La faction de la figurine est comparée à celle du Fer de Lance qui l'accueille.",
  attachment: "Le porteur et ses rattachés appartiennent au même Fer de Lance.",
  "requires-present": "",
};

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
    case "forbids-grimoire":
      return (
        <ChipsField
          label="Grimoires interdits"
          options={GRIMOIRE_OPTIONS}
          selected={arr("forbidGrimoires")}
          onChange={(v) => set({ forbidGrimoires: v })}
        />
      );
    case "attachment":
      return (
        <CarrierEditor
          carrier={params.carrier as CarrierParams | undefined}
          cat={cat}
          onChange={(v) => set({ carrier: v })}
        />
      );
    default:
      return null;
  }
}

/** Porteur d'un rattachement : par trait, par profils ou par modèles, plus son libellé lisible. */
type CarrierParams = { trait?: string; label?: string; profileIds?: string[]; modelIds?: string[] };

/** Manières de désigner le porteur. Elles s'excluent : une seule est renseignée à la fois. */
type CarrierMode = "trait" | "profiles" | "models";

const CARRIER_MODES: { value: CarrierMode; label: string }[] = [
  { value: "trait", label: "Un trait" },
  { value: "profiles", label: "Des profils" },
  { value: "models", label: "Des modèles" },
];

/** Manière déjà employée par la donnée (défaut : le trait, cas le plus courant). */
function carrierModeOf(c: CarrierParams): CarrierMode {
  if (c.profileIds?.length) return "profiles";
  if (c.modelIds?.length) return "models";
  return "trait";
}

/**
 * Qui peut porter la figurine rattachée. Ce bloc pilote le **recrutement** (le dépendant ne
 * s'achète pas seul, il se recrute depuis son porteur), pas la validation : la capacité, elle,
 * est toujours « somme des niveaux des rattachés ≤ niveau du porteur ».
 *
 * Le porteur se désigne d'**une seule** manière : le sélecteur choisit laquelle, et seule la
 * dimension correspondante est enregistrée. Le nom lisible, lui, survit à tous les changements.
 */
function CarrierEditor({
  carrier,
  cat,
  onChange,
}: {
  carrier: CarrierParams | undefined;
  cat: Catalog;
  onChange: (v: CarrierParams | undefined) => void;
}) {
  const c = carrier ?? {};
  const [mode, setMode] = useState<CarrierMode>(() => carrierModeOf(c));
  // N'écrit que la dimension active : changer de manière ne laisse pas l'ancienne derrière elle.
  const write = (patch: Partial<CarrierParams>, on: CarrierMode = mode) => {
    const next: CarrierParams = { ...c, ...patch };
    const out: CarrierParams = {};
    if (next.label) out.label = next.label;
    if (on === "trait" && next.trait) out.trait = next.trait;
    if (on === "profiles" && next.profileIds?.length) out.profileIds = next.profileIds;
    if (on === "models" && next.modelIds?.length) out.modelIds = next.modelIds;
    onChange(Object.keys(out).length ? out : undefined);
  };
  const switchMode = (m: CarrierMode) => {
    setMode(m);
    write({}, m); // les dimensions des autres manières sont abandonnées
  };
  const empty = !c.trait && !c.profileIds?.length && !c.modelIds?.length;
  return (
    <div className="space-y-3">
      <Field label="Porteur désigné par">
        <SegmentedControl
          ariaLabel="Porteur désigné par"
          value={mode}
          onChange={(v) => switchMode(v as CarrierMode)}
          options={CARRIER_MODES}
        />
      </Field>
      {mode === "trait" && (
        <TxtField
          label="Trait du porteur"
          hint="ex. femelle-fang"
          w="w-56"
          value={c.trait ?? ""}
          onChange={(v) => write({ trait: v || undefined })}
        />
      )}
      {mode === "profiles" && (
        <ProfileMultiSelect
          label="Profils porteurs"
          ids={c.profileIds ?? []}
          cat={cat}
          onChange={(v) => write({ profileIds: v })}
        />
      )}
      {mode === "models" && (
        <StringList
          label="Modèles porteurs"
          values={c.modelIds ?? []}
          onChange={(v) => write({ modelIds: v })}
          options={modelOptions(cat)}
        />
      )}
      <TxtField
        label="Nom lisible du porteur"
        hint="affiché aux joueurs, ex. « une femelle Fang »"
        w="w-72"
        value={c.label ?? ""}
        onChange={(v) => write({ label: v || undefined })}
      />
      {empty && (
        <p className="adm-field-hint">
          Sans porteur, cette figurine redevient recrutable directement dans le constructeur.
        </p>
      )}
    </div>
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
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Type" className="w-56">
              <select
                value={c.type}
                onChange={(e) => {
                  // Changer de type remet des params vierges ET la portée propre au nouveau type.
                  const type = e.target.value as ConstraintType;
                  update(i, { ...c, type, params: {}, scope: defaultConstraintScope(type) });
                }}
                className={INPUT}
              >
                {CONSTRAINT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONSTRAINT_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </Field>
            {scopeIsChosen(c.type) ? (
              <Field label="Où chercher" className="w-52">
                <select
                  value={c.scope}
                  onChange={(e) => update(i, { ...c, scope: e.target.value as ConstraintScope })}
                  className={INPUT}
                >
                  {CONSTRAINT_SCOPES[c.type].map((s) => (
                    <option key={s} value={s}>
                      {SCOPE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <FieldGroup label="Où chercher" className="max-w-xs">
                <p className="adm-faint text-xs leading-snug">
                  {SCOPE_LABEL[c.scope]}. {SCOPE_FIXED_REASON[c.type]}
                </p>
              </FieldGroup>
            )}
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
              type: "forbids-equipment",
              params: {},
              scope: defaultConstraintScope("forbids-equipment"),
              sourceText: "",
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
              liaison à une autre figurine (optionnel)
            </summary>
            <div className="mt-1 space-y-1">
              <p className="text-xs adm-faint">
                Si renseigné, la cible (ex. le garde) ne bénéficie de l'effet que si elle est désignée
                pour être liée à l'une de ces figurines.
              </p>
              <Field label="Nom de la liaison" hint="affiché dans le constructeur (défaut « garde du corps »)">
                <input
                  value={e.designation?.label ?? ""}
                  placeholder="garde du corps"
                  disabled={!e.designation}
                  onChange={(ev) =>
                    e.designation &&
                    update(i, {
                      ...e,
                      designation: { ...e.designation, label: ev.target.value || undefined },
                    })
                  }
                  className={`${INPUT} block w-full`}
                />
              </Field>
              <SelectorEditor
                selector={e.designation?.of ?? {}}
                cat={cat}
                allowSelf={false}
                onChange={(s) =>
                  update(i, {
                    ...e,
                    designation: Object.keys(s).length ? { ...e.designation, of: s } : undefined,
                  })
                }
              />
            </div>
          </details>
          <CheckField
            label="au choix du joueur (opt-in)"
            checked={e.optIn ?? false}
            onChange={(b) => update(i, { ...e, optIn: b || undefined })}
          />
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
            },
          ])
        }
      >
        + effet
      </AddButton>
    </div>
  );
}
