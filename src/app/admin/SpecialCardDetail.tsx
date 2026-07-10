import type { Catalog, SpecialCard } from "@core";
import { SegmentedControl } from "@ui";
import { ConstraintListEditor, EffectListEditor } from "../RuleEditors";
import { CardImageSection, CheckField, ChipMultiSelect, DetailHeader, DetailPage, Field, FieldGroup, Section } from "./primitives";
import { INPUT, SECTION } from "./shared";
import { ProfileMultiSelect, TextLinesEditor } from "./editors";

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
  const isAmelioration = card.amelioration ?? false;
  return (
    <DetailPage
      header={
        <DetailHeader
          name={card.name}
          onName={(v) => onChange({ name: v })}
          cost={card.cost}
          onCost={(v) => onChange({ cost: v ?? 0 })}
          onRemove={onRemove}
          removeTitle="Supprimer cette carte"
          sub={
            <>
              <span className="adm-id">{card.id}</span>
              <span className="dot" />
              <span>
                {isAmelioration ? "Amélioration" : "Automatique"}
                {card.ostScope ? " · portée Ost" : ""}
              </span>
            </>
          }
        />
      }
      body={
        <>
          <Section title="Type & activation" icon="type">
            <Field label="Type de carte">
              <SegmentedControl
                ariaLabel="Type de carte"
                value={isAmelioration ? "amelioration" : "auto"}
                onChange={(v) => onChange({ amelioration: v === "amelioration" ? true : undefined })}
                options={[
                  { value: "auto", label: "Automatique" },
                  { value: "amelioration", label: "Amélioration" },
                ]}
              />
              <span className="adm-field-hint mt-1 block">
                {isAmelioration
                  ? "Achetée au choix par le joueur sur une figurine éligible."
                  : "Appliquée d'office aux figurines concernées (ex. Fille de Nyx)."}
              </span>
            </Field>

            {isAmelioration && (
              <div className="adm-cond">
                <div className="adm-cond-eyebrow">Réglages de l'amélioration</div>
                <div className="flex flex-col gap-3">
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
                    label="Partagée (payée une fois par Fer de Lance)"
                    hint="Activable depuis n'importe quel modèle éligible (ex. Lien de la Terre)."
                    checked={card.shared ?? false}
                    onChange={(v) => onChange({ shared: v || undefined })}
                  />
                </div>
              </div>
            )}
          </Section>

          <Section title="Portée" icon="scope">
            <Field label="Cible de la carte">
              <SegmentedControl
                ariaLabel="Cible de la carte"
                value={card.ostScope ? "ost" : "profils"}
                onChange={(v) => onChange({ ostScope: v === "ost" ? true : undefined })}
                options={[
                  { value: "profils", label: "Profils" },
                  { value: "ost", label: "Ost" },
                ]}
              />
              <span className="adm-field-hint mt-1 block">
                {card.ostScope
                  ? "Sélectionnée au niveau de la liste, selon la composition de l'Ost."
                  : "Appliquée aux profils correspondant à la portée ci-dessous."}
              </span>
            </Field>

            <div className="adm-cond">
              <div className="adm-cond-eyebrow">{card.ostScope ? "Portée « Ost »" : "Portée « profils »"}</div>
              {card.ostScope ? (
                <div className="flex flex-col gap-3">
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
              ) : (
                <div className="flex flex-col gap-3">
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
                  <FieldGroup label="Factions">
                    <ChipMultiSelect
                      options={cat.factions.map((f) => ({ value: f.id, label: f.name }))}
                      selected={scope.factionIds ?? []}
                      onToggle={(id) => {
                        const cur = scope.factionIds ?? [];
                        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
                        onChange({ scope: { ...scope, factionIds: next.length ? next : undefined } });
                      }}
                    />
                  </FieldGroup>
                </div>
              )}
            </div>
          </Section>

          <Section title={SECTION.verbatim} icon="verbatim">
            <TextLinesEditor items={card.rulesText} onChange={(r) => onChange({ rulesText: r })} />
          </Section>

          <Section title={SECTION.effects} icon="effects">
            <EffectListEditor
              effects={card.effects}
              newSource={{ kind: "special-card", id: card.id }}
              cat={cat}
              onChange={(e) => onChange({ effects: e })}
            />
          </Section>

          <Section title={SECTION.constraints} icon="constraints">
            <ConstraintListEditor constraints={card.constraints} cat={cat} onChange={(c) => onChange({ constraints: c })} />
          </Section>

          <CardImageSection value={card.cardImage} onChange={(v) => onChange({ cardImage: v })} />
        </>
      }
    />
  );
}
