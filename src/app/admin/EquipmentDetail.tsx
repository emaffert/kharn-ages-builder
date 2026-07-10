import type { Catalog, Equipment, EquipmentUpgrade } from "@core";
import { DetailPage, Field, RemoveButton, Section } from "./primitives";
import { EQUIPMENT_CATEGORIES, INPUT, SECTION } from "./shared";
import { ReservedToEditor, SkillsEditor } from "./editors";

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
  const num = (label: string, value: number | undefined, key: keyof Equipment, w = "w-24") => (
    <Field label={label} className={w}>
      <input
        type="number"
        value={value ?? ""}
        onChange={(ev) => onChange({ [key]: numOrUndef(ev.target.value) } as Partial<Equipment>)}
        className={INPUT}
      />
    </Field>
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
      <header className="flex items-center gap-3">
        <input value={e.name} onChange={(ev) => onChange({ name: ev.target.value })} className="adm-title flex-1" />
        <label className="flex items-center gap-1 adm-accent">
          <input
            type="number"
            value={e.cost}
            onChange={(ev) => onChange({ cost: Number(ev.target.value) })}
            className="adm-cost"
          />
          <span className="text-sm">Ko</span>
        </label>
        <button type="button" onClick={onRemove} title="Supprimer cet équipement" className="adm-x">
          ✕
        </button>
      </header>
      }
      body={
      <>
      {/* Type + champs propres à ce type (on n'affiche que le nécessaire). */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Catégorie" className="w-40">
          <select
            value={e.category}
            onChange={(ev) => onChange({ category: ev.target.value as Equipment["category"] })}
            className={INPUT}
          >
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {isBouclier && <span className="pb-1 text-xs adm-faint">Occupe 1 main.</span>}
      </div>

      {/* Armes de corps à corps : mains, allonge, perce-armure. */}
      {isCac && (
        <Section title="Corps à corps (mains, allonge, perce-armure)">
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
        <Section title="Tir (portée, recharge, munitions)">
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
          <div className="flex flex-wrap items-end gap-3">
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
        <Section title={isArmure ? "Armure (protection échec / seuil / réussite · DV)" : "Bouclier (durée de vie)"}>
          <div className="flex flex-wrap items-end gap-3">
            {isArmure && (
              <>
                {num("prot. échec", e.protectionEchec, "protectionEchec")}
                {num("seuil", e.seuil, "seuil")}
                {num("prot. réussite", e.protectionReussite, "protectionReussite")}
                {num("seuil si déjà protégé", e.heavySeuil, "heavySeuil", "w-20")}
              </>
            )}
            {num("durée de vie (DV)", e.durability, "durability")}
          </div>
        </Section>
      )}

      <Section title="Compétences conférées">
        <SkillsEditor
          skills={e.grantsSkills ?? []}
          cat={cat}
          onChange={(s) => onChange({ grantsSkills: s.length ? s : undefined })}
        />
      </Section>

      {/* Améliorations intrinsèques à l'objet (ex. Caparaçon → Pointes acérées), distinctes des cartes Borax. */}
      <Section title="Améliorations optionnelles (intrinsèques à l'objet)">
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

      <Section title="Lien monture (p.32)">
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
            ci-dessus s'applique en plus (ex. Lance réservée aux Khârns).
          </p>
          {e.mountEquipment != null && (
            <div className="space-y-1">
              <span className="adm-field-label">Coût par faction <span className="adm-field-hint">(déroge au coût de base, ex. Caparaçon 20/22)</span></span>
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
            </div>
          )}
        </div>
      </Section>
      </>
      }
      verbatim={
        <Section title={SECTION.verbatim}>
          <textarea
            value={e.effectsText}
            rows={2}
            onChange={(ev) => onChange({ effectsText: ev.target.value })}
            className={`${INPUT} w-full`}
          />
        </Section>
      }
      applicability={
        <Section title="Réservé à (qui peut l'équiper)">
          <ReservedToEditor value={e.reservedTo} cat={cat} onChange={(v) => onChange({ reservedTo: v })} />
        </Section>
      }
      media={
        <Field label="Image">
          <input
            value={e.cardImage ?? ""}
            placeholder="cards/..."
            onChange={(ev) => onChange({ cardImage: ev.target.value || undefined })}
            className={`${INPUT} max-w-md`}
          />
        </Field>
      }
    />
  );
}
