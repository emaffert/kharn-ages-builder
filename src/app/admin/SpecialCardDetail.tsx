import type { Catalog, SpecialCard } from "@core";
import { ConstraintListEditor, EffectListEditor } from "../RuleEditors";
import { Section } from "./primitives";
import { INPUT } from "./shared";
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
  return (
    <div className="space-y-5">
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
      <label className="flex items-center gap-2 text-sm adm-muted">
        <input
          type="checkbox"
          checked={card.amelioration ?? false}
          onChange={(e) => onChange({ amelioration: e.target.checked || undefined })}
        />
        Amélioration choisie par le joueur
        <span className="text-xs adm-faint">
          (sinon carte automatique appliquée d'office, ex. Fille de Nyx)
        </span>
      </label>
      {card.amelioration && (
        <>
          <label className="flex items-center gap-2 text-xs adm-faint">
            groupe de choix exclusif
            <input
              value={card.choiceGroup ?? ""}
              onChange={(e) => onChange({ choiceGroup: e.target.value || undefined })}
              className={`${INPUT} w-48`}
              placeholder="ex. artisane-racines"
            />
            <span>une seule amélioration du même groupe sélectionnable</span>
          </label>
          <label className="flex items-center gap-2 text-sm adm-muted">
            <input
              type="checkbox"
              checked={card.shared ?? false}
              onChange={(e) => onChange({ shared: e.target.checked || undefined })}
            />
            Partagée (payée une fois par Fer de Lance)
            <span className="text-xs adm-faint">
              (activée depuis n'importe quel modèle éligible, ex. Lien de la Terre)
            </span>
          </label>
        </>
      )}
      <GrantsCastingEditor value={card.grantsCasting} cat={cat} onChange={(v) => onChange({ grantsCasting: v })} />

      <Section title="Portée (à qui s'applique la carte)">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs adm-faint">
            trait
            <input
              value={scope.trait ?? ""}
              onChange={(e) => onChange({ scope: { ...scope, trait: e.target.value || undefined } })}
              className={`${INPUT} w-40`}
              placeholder="ex. fille-de-nyx"
            />
          </label>
          <ProfileMultiSelect
            label="profils"
            ids={scope.profileIds ?? []}
            cat={cat}
            onChange={(v) => onChange({ scope: { ...scope, profileIds: v.length ? v : undefined } })}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs adm-faint">
            factions
            {cat.factions.map((f) => {
              const on = scope.factionIds?.includes(f.id) ?? false;
              return (
                <label key={f.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const cur = scope.factionIds ?? [];
                      const next = on ? cur.filter((x) => x !== f.id) : [...cur, f.id];
                      onChange({ scope: { ...scope, factionIds: next.length ? next : undefined } });
                    }}
                  />
                  {f.name}
                </label>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Texte de la carte (verbatim — fait foi)">
        <TextLinesEditor items={card.rulesText} onChange={(r) => onChange({ rulesText: r })} />
      </Section>

      <Section title="Contraintes">
        <ConstraintListEditor constraints={card.constraints} cat={cat} onChange={(c) => onChange({ constraints: c })} />
      </Section>

      <Section title="Effets / octrois">
        <EffectListEditor
          effects={card.effects}
          newSource={{ kind: "special-card", id: card.id }}
          cat={cat}
          onChange={(e) => onChange({ effects: e })}
        />
      </Section>

      <Section title="Image (optionnel)">
        <input
          value={card.cardImage}
          placeholder="cards/..."
          onChange={(e) => onChange({ cardImage: e.target.value })}
          className={`${INPUT} w-full max-w-md`}
        />
      </Section>
    </div>
  );
}
