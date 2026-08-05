import type { CatalogUpgrade } from "@core";
import { AutoTextarea, DetailHeader, DetailPage, Field, Section } from "./primitives";
import { ChipsField } from "../ruleEditors/kit";
import { CAT_LABEL } from "../builder/shared";
import { EQUIPMENT_CATEGORIES, INPUT, SECTION } from "./shared";

/**
 * Fiche d'une **amélioration de catalogue** : ce que n'importe quelle figurine peut payer en plus sur
 * un équipement qui remplit ses conditions, sans qu'aucune carte ne l'y autorise. L'Affûtage en est
 * le cas d'école : 8 Ko sur une arme de corps à corps tranchante, jamais sur une arme gratuite.
 *
 * À ne pas confondre avec les deux autres façons d'améliorer un équipement, qui s'éditent ailleurs :
 * celles **propres à un objet** se saisissent sur sa fiche (l'Épée courte et ses « deux effets »), et
 * celles qu'une **carte octroie** sont un effet de cette carte (le Borax).
 */
export function UpgradeDetail({
  upgrade: u,
  onChange,
  onRemove,
}: {
  upgrade: CatalogUpgrade;
  onChange: (patch: Partial<CatalogUpgrade>) => void;
  onRemove: () => void;
}) {
  return (
    <DetailPage
      header={
        <DetailHeader
          name={u.label}
          onName={(v) => onChange({ label: v })}
          namePlaceholder="Nom de l'amélioration"
          cost={u.cost}
          onCost={(v) => onChange({ cost: v ?? 0 })}
          costPlaceholder="0"
          onRemove={onRemove}
          removeTitle="Supprimer cette amélioration"
          sub={<span className="adm-id">{u.id}</span>}
        />
      }
      body={
        <Section
          title="Où elle se propose"
          icon="equipment"
          note="les conditions se cumulent : la case n'apparaît que sur un équipement qui les remplit toutes"
        >
          <ChipsField
            label="Catégories d'équipement"
            options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: CAT_LABEL[c] ?? c }))}
            selected={u.equipmentCategories}
            onChange={(v) => onChange({ equipmentCategories: v as CatalogUpgrade["equipmentCategories"] })}
          />
          <div className="mt-3 flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs adm-muted">
              <input
                type="checkbox"
                checked={u.requiresTranchant ?? false}
                onChange={(e) => onChange({ requiresTranchant: e.target.checked || undefined })}
              />
              Seulement sur une arme tranchante (case cochée sur la fiche de l'arme)
            </label>
            <label className="flex items-center gap-2 text-xs adm-muted">
              <input
                type="checkbox"
                checked={u.forbiddenOnFreeWeapon ?? false}
                onChange={(e) => onChange({ forbiddenOnFreeWeapon: e.target.checked || undefined })}
              />
              Jamais sur une arme gratuite (une arme qui ne coûte rien au catalogue)
            </label>
          </div>
          {u.equipmentCategories.length === 0 && (
            <p className="adm-block-note mt-3">
              Sans catégorie cochée, cette amélioration n'est proposée nulle part.
            </p>
          )}
        </Section>
      }
      verbatim={
        <Section title={SECTION.verbatim} icon="verbatim" note="ce que le joueur lit en ouvrant l'amélioration">
          <Field label="effet">
            <AutoTextarea
              value={u.effectsText ?? ""}
              onChange={(v) => onChange({ effectsText: v || undefined })}
              className={INPUT}
            />
          </Field>
        </Section>
      }
    />
  );
}
