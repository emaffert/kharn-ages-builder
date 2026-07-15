import type { Catalog, EffectOperation } from "@core";
import { EQUIPMENT_CATEGORIES, MASTERY_DOMAINS, INPUT, removeAt, replaceAt } from "../admin/shared";
import { Combobox, DomainIcon, Field, CheckField, ChipMultiSelect } from "../admin/primitives";
import { AddButton, NumField, RemoveButton, StatSelect, TxtField } from "./kit";
import { skillOptions, spellOptions } from "./helpers";
import { OfSelector } from "./SelectorEditor";

/** Opération par défaut (valeurs neutres) pour un type d'action donné. */
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
    case "grant-trait":
      return { kind, trait: "" };
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
  "grant-trait": "Conférer un trait",
  "grant-mastery-die": "Conférer un dé de maîtrise",
  "unlock-upgrade": "Débloquer une amélioration",
  "stat-modifier": "Modifier une caractéristique",
  "stat-count": "Caractéristique = comptage de figurines",
  "stat-max": "Caractéristique = plus forte du groupe",
  "skill-count": "Compétence = comptage de figurines",
  "spell-pages": "Pages de sorts",
  "limit-modifier": "Modifier la limitation (X)",
};

// `cap` est volontairement absent du menu (non implémenté par le moteur).
const OP_GROUPS: { group: string; kinds: EffectOperation["kind"][] }[] = [
  { group: "Coût", kinds: ["cost-delta", "cost-set", "grimoire-discount"] },
  { group: "Octrois", kinds: ["grant-skill", "grant-spell", "grant-trait", "grant-mastery-die", "unlock-upgrade"] },
  { group: "Caractéristiques & compétences", kinds: ["stat-modifier", "stat-count", "stat-max", "skill-count"] },
  { group: "Divers", kinds: ["spell-pages", "limit-modifier"] },
];

/** Éditeur de l'opération d'un effet : menu d'action + champs conditionnés au type choisi. */
export function OperationEditor({
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
          <NumField
            label="+ si déjà connue"
            hint="option."
            w="w-32"
            value={op.incrementIfPresent ?? null}
            onChange={(v) => onChange({ ...op, incrementIfPresent: v ?? undefined })}
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

      {op.kind === "grant-trait" && (
        <TxtField
          label="Trait"
          hint="tag interne, ex. apatride"
          w="w-56"
          value={op.trait}
          onChange={(v) => onChange({ ...op, trait: v })}
        />
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
        <>
          <NumField label="Pages" value={op.amount} onChange={(v) => onChange({ ...op, amount: v ?? 0 })} />
          <Field label="Voie dédiée" hint="option. (pool)">
            <select
              value={op.magicWayId ?? ""}
              onChange={(e) => onChange({ ...op, magicWayId: e.target.value || undefined })}
              className={INPUT}
            >
              <option value="">— budget général</option>
              {cat.magicWays.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {op.kind === "limit-modifier" && (
        <NumField label="Montant" value={op.amount} onChange={(v) => onChange({ ...op, amount: v ?? 0 })} />
      )}
      </div>
    </div>
  );
}
