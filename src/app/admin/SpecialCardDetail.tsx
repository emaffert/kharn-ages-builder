import type { Catalog, SpecialCard } from "@core";
import { ConstraintListEditor, EffectListEditor } from "../RuleEditors";
import { CheckField, ChipMultiSelect, DetailPage, Field, Section } from "./primitives";
import { INPUT, SECTION } from "./shared";
import { GrantsCastingEditor, ProfileMultiSelect, TextLinesEditor } from "./editors";

export function SpecialCardDetail({
  card,
  cat,
  onChange,
  onRemove,
}: {
  card: SpecialCard;
  cat: Catalog;
  onChange: (patch: Partial<SpecialCard>) => void;
  onRemove: () => void;
}) {
  const scope = card.scope;
  const cond = Array.isArray(card.activationCondition)
    ? card.activationCondition[0]
    : card.activationCondition;
  const setCond = (next: { profileIds?: string[]; countAtLeast?: number }) => {
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v != null && (!Array.isArray(v) || v.length)));
    onChange({ activationCondition: Object.keys(clean).length ? clean : undefined });
  };
  return (
    <DetailPage
      header={
      <header className="flex items-center gap-3">
        <input
          value={card.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="adm-title flex-1"
        />
        <label className="flex items-center gap-1 adm-accent">
          <input
            type="number"
            value={card.cost}
            onChange={(e) => onChange({ cost: Number(e.target.value) })}
            className="adm-cost"
          />
          <span className="text-sm">Ko</span>
        </label>
        <button type="button" onClick={onRemove} title="Supprimer cette carte" className="adm-x">
          ✕
        </button>
      </header>
      }
      body={
      <>
        <CheckField
          label={
            <>
              Amélioration choisie par le joueur
              <span className="adm-field-hint">(sinon carte automatique appliquée d'office, ex. Fille de Nyx)</span>
            </>
          }
          checked={card.amelioration ?? false}
          onChange={(v) => onChange({ amelioration: v || undefined })}
        />
        {card.amelioration && (
          <>
            <Field
              label="Groupe de choix exclusif"
              hint="une seule amélioration du même groupe sélectionnable"
              className="w-64"
            >
              <input
                value={card.choiceGroup ?? ""}
                onChange={(e) => onChange({ choiceGroup: e.target.value || undefined })}
                className={INPUT}
                placeholder="ex. artisane-racines"
              />
            </Field>
            <CheckField
              label={
                <>
                  Partagée (payée une fois par Fer de Lance)
                  <span className="adm-field-hint">(activée depuis n'importe quel modèle éligible, ex. Lien de la Terre)</span>
                </>
              }
              checked={card.shared ?? false}
              onChange={(v) => onChange({ shared: v || undefined })}
            />
          </>
        )}
        <GrantsCastingEditor value={card.grantsCasting} cat={cat} onChange={(v) => onChange({ grantsCasting: v })} />
        <CheckField
          label={
            <>
              Carte à portée Ost (sélectionnée au niveau de la liste)
              <span className="adm-field-hint">(la « Portée » ci-dessous sert alors de disponibilité - ex. Myriam présente)</span>
            </>
          }
          checked={card.ostScope ?? false}
          onChange={(v) => onChange({ ostScope: v || undefined })}
        />
      </>
      }
      verbatim={
        <Section title={SECTION.verbatim}>
          <TextLinesEditor items={card.rulesText} onChange={(r) => onChange({ rulesText: r })} />
        </Section>
      }
      applicability={
      <>
        {card.ostScope && (
          <Section title="Condition d'activation (composition de l'Ost)">
            <div className="space-y-2">
              <ProfileMultiSelect
                label="Parmi les profils"
                ids={cond?.profileIds ?? []}
                cat={cat}
                onChange={(v) => setCond({ ...cond, profileIds: v.length ? v : undefined })}
              />
              <Field label="Figurines présentes (au moins)" className="w-32">
                <input
                  type="number"
                  value={cond?.countAtLeast ?? ""}
                  onChange={(e) =>
                    setCond({ ...cond, countAtLeast: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                  className={INPUT}
                />
              </Field>
            </div>
          </Section>
        )}
        <Section title="Portée (à qui s'applique la carte)">
          <div className="space-y-3">
            <Field label="Trait" className="w-56">
              <input
                value={scope.trait ?? ""}
                onChange={(e) => onChange({ scope: { ...scope, trait: e.target.value || undefined } })}
                className={INPUT}
                placeholder="ex. fille-de-nyx"
              />
            </Field>
            <ProfileMultiSelect
              label="Profils"
              ids={scope.profileIds ?? []}
              cat={cat}
              onChange={(v) => onChange({ scope: { ...scope, profileIds: v.length ? v : undefined } })}
            />
            <div className="space-y-1">
              <span className="adm-field-label">Factions</span>
              <ChipMultiSelect
                options={cat.factions.map((f) => ({ value: f.id, label: f.name }))}
                selected={scope.factionIds ?? []}
                onToggle={(id) => {
                  const cur = scope.factionIds ?? [];
                  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
                  onChange({ scope: { ...scope, factionIds: next.length ? next : undefined } });
                }}
              />
            </div>
          </div>
        </Section>
      </>
      }
      constraints={
        <Section title={SECTION.constraints}>
          <ConstraintListEditor constraints={card.constraints} cat={cat} onChange={(c) => onChange({ constraints: c })} />
        </Section>
      }
      effects={
        <Section title={SECTION.effects}>
          <EffectListEditor
            effects={card.effects}
            newSource={{ kind: "special-card", id: card.id }}
            cat={cat}
            onChange={(e) => onChange({ effects: e })}
          />
        </Section>
      }
      media={
        <Field label="Image (optionnel)">
          <input
            value={card.cardImage}
            placeholder="cards/..."
            onChange={(e) => onChange({ cardImage: e.target.value })}
            className={`${INPUT} max-w-md`}
          />
        </Field>
      }
    />
  );
}
