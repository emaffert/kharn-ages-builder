import type { Catalog, Constraint, ConstraintType, Effect, Selector } from "@core";
import { describeConstraint, describeEffect } from "@ui/explain";
import { EQUIPMENT_CATEGORIES, INPUT, removeAt, replaceAt } from "./admin/shared";
import { Combobox, Field, CheckField } from "./admin/primitives";
import { AddButton, ChipsField, TxtField } from "./ruleEditors/kit";
import { GRIMOIRE_OPTIONS, profileOptions, type Option } from "./ruleEditors/helpers";
import { SelectorEditor } from "./ruleEditors/SelectorEditor";
import { OperationEditor } from "./ruleEditors/OperationEditor";

/**
 * Éditeurs structurés des contraintes et effets (propres à un profil). Les briques de bas niveau
 * sont dans `./ruleEditors/` : primitives de champ (`kit`), `SelectorEditor`, `OperationEditor`.
 * Ce fichier conserve l'API publique (`ConstraintListEditor`, `EffectListEditor`) et les paramètres
 * de contrainte.
 */

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
