import type { Catalog, Equipment, EquipmentUpgrade } from "@core";
import { CardImageSection, DetailHeader, DetailPage, Field, FieldGroup, NumberField, RemoveButton, Section } from "./primitives";
import { EQUIPMENT_CATEGORIES, INPUT, SECTION } from "./shared";
import { ReservedToEditor } from "./editors";
import { EffectListEditor } from "../RuleEditors";

const CATEGORY_LABEL: Record<string, string> = {
  "arme-cac": "Corps à corps",
  "arme-tir": "Tir",
  bouclier: "Bouclier",
  armure: "Armure",
  objet: "Objet",
};

export function EquipmentDetail({
  equipment: e,
  cat,
  onChange,
  onRemove,
}: {
  equipment: Equipment;
  cat: Catalog;
  onChange: (patch: Partial<Equipment>) => void;
  onRemove: () => void;
}) {
  const numOrUndef = (v: string): number | undefined => (v === "" ? undefined : Number(v));
  const isCac = e.category === "arme-cac";
  const isTir = e.category === "arme-tir";
  const isBouclier = e.category === "bouclier";
  const isArmure = e.category === "armure";
  const num = (label: string, value: number | undefined, key: keyof Equipment, className = "w-24") => (
    <NumberField
      label={label}
      value={value ?? null}
      className={className}
      onChange={(v) => onChange({ [key]: v } as Partial<Equipment>)}
    />
  );
  const perceArmureField = (
    <Field label="perce-armure" className="w-28">
      <input
        value={e.perceArmure == null ? "" : String(e.perceArmure)}
        placeholder='nb ou "1D5"'
        onChange={(ev) => {
          const v = ev.target.value.trim();
          onChange({ perceArmure: v === "" ? undefined : v === "1D5" ? "1D5" : Number(v) });
        }}
        className={INPUT}
      />
    </Field>
  );

  return (
    <DetailPage
      header={
        <DetailHeader
          name={e.name}
          onName={(v) => onChange({ name: v })}
          cost={e.cost}
          onCost={(v) => onChange({ cost: v ?? 0 })}
          onRemove={onRemove}
          removeTitle="Supprimer cet équipement"
          sub={
            <>
              <span className="adm-id">{e.id}</span>
              <span className="dot" />
              <span>{CATEGORY_LABEL[e.category] ?? e.category}</span>
            </>
          }
        />
      }
      body={
        <>
          <Section title="Type" icon="type" note="détermine les champs à renseigner">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Catégorie" className="w-40">
                <select
                  value={e.category}
                  onChange={(ev) => onChange({ category: ev.target.value as Equipment["category"] })}
                  className={INPUT}
                >
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c] ?? c}
                    </option>
                  ))}
                </select>
              </Field>
              {isBouclier && <span className="pb-2 text-xs adm-faint">Occupe 1 main.</span>}
            </div>
          </Section>

          {/* Armes de corps à corps : mains, allonge, perce-armure. */}
          {isCac && (
            <Section title="Corps à corps" icon="equipment" note="mains, allonge, perce-armure">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="mains" className="w-32">
                  <select
                    value={e.hands ?? ""}
                    onChange={(ev) => {
                      const v = ev.target.value;
                      onChange({ hands: v === "" ? undefined : v === "1-2" ? "1-2" : (Number(v) as 1 | 2) });
                    }}
                    className={INPUT}
                  >
                    <option value="">-</option>
                    <option value="1">1 main</option>
                    <option value="2">2 mains</option>
                    <option value="1-2">1 ou 2 mains</option>
                  </select>
                </Field>
                {num("allonge", e.allonge, "allonge")}
                {perceArmureField}
              </div>
            </Section>
          )}

          {/* Armes de tir : portée, recharge, munitions. */}
          {isTir && (
            <Section title="Tir" icon="equipment" note="portée, recharge, munitions">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="portée courte" className="w-24">
                  <input
                    type="number"
                    value={e.range?.short ?? ""}
                    onChange={(ev) =>
                      onChange({ range: { short: Number(ev.target.value || 0), long: e.range?.long ?? 0, max: e.range?.max } })
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="portée longue" className="w-24">
                  <input
                    type="number"
                    value={e.range?.long ?? ""}
                    onChange={(ev) =>
                      onChange({ range: { short: e.range?.short ?? 0, long: Number(ev.target.value || 0), max: e.range?.max } })
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="portée max" className="w-24">
                  <input
                    type="number"
                    value={e.range?.max ?? ""}
                    onChange={(ev) =>
                      onChange({ range: { short: e.range?.short ?? 0, long: e.range?.long ?? 0, max: numOrUndef(ev.target.value) } })
                    }
                    className={INPUT}
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="recharge (cadence)" className="w-28">
                  <input
                    type="number"
                    value={e.reload?.cadence ?? ""}
                    onChange={(ev) =>
                      onChange({
                        reload:
                          ev.target.value === ""
                            ? undefined
                            : { cadence: Number(ev.target.value), paCost: e.reload?.paCost ?? 0 },
                      })
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="recharge (PA)" className="w-24">
                  <input
                    type="number"
                    value={e.reload?.paCost ?? ""}
                    onChange={(ev) =>
                      onChange({ reload: { cadence: e.reload?.cadence ?? 0, paCost: Number(ev.target.value || 0) } })
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="munitions" className="w-40">
                  <select
                    value={e.munitionKind ?? ""}
                    onChange={(ev) => onChange({ munitionKind: ev.target.value || undefined })}
                    className={INPUT}
                  >
                    <option value="">- aucune</option>
                    {(cat.munitionKinds ?? []).map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {num("munitions de base", e.baseMunitions, "baseMunitions")}
                {num("allonge", e.allonge, "allonge")}
                {perceArmureField}
              </div>
            </Section>
          )}

          {/* Bouclier / Armure : durée de vie (DV) et, pour l'armure, ses valeurs. */}
          {(isBouclier || isArmure) && (
            <Section
              title={isArmure ? "Armure" : "Bouclier"}
              icon="armor"
              note={isArmure ? "protection échec / seuil / réussite · DV" : "durée de vie"}
            >
              <div className="flex flex-wrap items-end gap-3">
                {isArmure && (
                  <>
                    {num("prot. échec", e.protectionEchec, "protectionEchec")}
                    {num("seuil", e.seuil, "seuil")}
                    {num("prot. réussite", e.protectionReussite, "protectionReussite")}
                    {num("seuil si déjà protégé", e.heavySeuil, "heavySeuil", "w-24")}
                  </>
                )}
                {num("durée de vie (DV)", e.durability, "durability")}
              </div>
            </Section>
          )}

          <Section title={SECTION.verbatim} icon="verbatim">
            <textarea
              value={e.effectsText}
              rows={2}
              onChange={(ev) => onChange({ effectsText: ev.target.value })}
              className={`${INPUT} w-full`}
            />
          </Section>

          <Section title={SECTION.effects} icon="effects">
            <EffectListEditor
              effects={e.effects ?? []}
              newSource={{ kind: "equipment", id: e.id }}
              cat={cat}
              onChange={(ef) => onChange({ effects: ef.length ? ef : undefined })}
            />
          </Section>

          {/* Améliorations intrinsèques à l'objet (ex. Caparaçon → Pointes acérées), distinctes des cartes Borax. */}
          <Section title="Améliorations optionnelles" icon="skills" note="intrinsèques à l'objet">
            <div className="flex flex-col gap-2">
              {(e.upgrades ?? []).map((u, i) => {
                const upgrades = e.upgrades ?? [];
                const patchUp = (patch: Partial<EquipmentUpgrade>) =>
                  onChange({ upgrades: upgrades.map((x, j) => (j === i ? { ...u, ...patch } : x)) });
                const removeUp = () => {
                  const next = upgrades.filter((_, j) => j !== i);
                  onChange({ upgrades: next.length ? next : undefined });
                };
                return (
                  <div key={u.id} className="adm-card space-y-2 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={u.label}
                        onChange={(ev) => patchUp({ label: ev.target.value })}
                        placeholder="Nom (ex. Pointes acérées)"
                        className={`${INPUT} w-56`}
                      />
                      <label className="flex items-center gap-1 text-xs adm-muted">
                        +
                        <input
                          type="number"
                          value={u.cost}
                          onChange={(ev) => patchUp({ cost: Number(ev.target.value) || 0 })}
                          className={`${INPUT} w-16`}
                        />
                        Ko
                      </label>
                      <RemoveButton onClick={removeUp} />
                    </div>
                    <input
                      value={u.effectsText ?? ""}
                      onChange={(ev) => patchUp({ effectsText: ev.target.value || undefined })}
                      placeholder="Effet (verbatim, ex. Modifie le verrouillage.)"
                      className={`${INPUT} w-full`}
                    />
                  </div>
                );
              })}
              <button
                type="button"
                className="adm-add"
                onClick={() =>
                  onChange({
                    upgrades: [...(e.upgrades ?? []), { id: `up-${Date.now()}`, label: "Nouvelle amélioration", cost: 0 }],
                  })
                }
              >
                + amélioration
              </button>
            </div>
          </Section>

          <Section title="Lien monture" icon="mount" note="règles de bataille p.32">
            <div className="flex flex-col gap-3">
              <Field label="Équipement lié à la monture" className="max-w-md">
                <select
                  value={e.mountEquipment ?? ""}
                  onChange={(ev) =>
                    onChange({ mountEquipment: (ev.target.value || undefined) as "mount" | "rider" | undefined })
                  }
                  className={INPUT}
                >
                  <option value="">Non (équipement standard)</option>
                  <option value="mount">Porté par la MONTURE (ex. Caparaçon)</option>
                  <option value="rider">Porté par le CAVALIER monté (ex. Lance de cavalerie)</option>
                </select>
              </Field>
              <p className="adm-faint text-[11px] leading-tight">
                Un équipement lié à la monture n'apparaît que sur une figurine montée (onglet « Monture » du cavalier
                ou fiche de la monture), jamais dans le picker d'équipement standard. La réservation de faction
                ci-dessous s'applique en plus (ex. Lance réservée aux Khârns).
              </p>
              {e.mountEquipment != null && (
                <FieldGroup label="Coût par faction" hint="(déroge au coût de base, ex. Caparaçon 20/22)">
                  <div className="flex flex-wrap gap-3">
                    {cat.factions.map((f) => (
                      <Field key={f.id} label={f.name} className="w-24">
                        <input
                          type="number"
                          value={e.costByFaction?.[f.id] ?? ""}
                          placeholder="—"
                          onChange={(ev) => {
                            const cur = { ...(e.costByFaction ?? {}) };
                            if (ev.target.value === "") delete cur[f.id];
                            else cur[f.id] = Number(ev.target.value);
                            onChange({ costByFaction: Object.keys(cur).length ? cur : undefined });
                          }}
                          className={INPUT}
                        />
                      </Field>
                    ))}
                  </div>
                </FieldGroup>
              )}
            </div>
          </Section>

          <Section title="Réservé à" icon="constraints" note="qui peut l'équiper">
            <ReservedToEditor value={e.reservedTo} cat={cat} onChange={(v) => onChange({ reservedTo: v })} />
          </Section>

          <CardImageSection value={e.cardImage ?? ""} onChange={(v) => onChange({ cardImage: v || undefined })} />
        </>
      }
    />
  );
}
