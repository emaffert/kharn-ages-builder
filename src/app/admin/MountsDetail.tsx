import { useState } from "react";
import type { Catalog, Mount, MountType } from "@core";
import { INPUT, SECTION } from "./shared";
import { ChipMultiSelect, Combobox, DetailHeader, DetailPage, EditableNumber, Field, FieldGroup, RemoveButton, Section } from "./primitives";
import { IconSlot } from "./ProfileDetail";
import { RulesEditor, SkillsEditor } from "./editors";
import { EffectListEditor } from "../RuleEditors";
import { IconEditor } from "../IconEditor";

/**
 * Édition d'UN niveau de monture (sélectionné dans la sidebar, comme un profil). Le détail regroupe :
 * - une section « Type » partagée par tous les niveaux (nom, nature, éligibilité, image partagée) ;
 * - les champs propres au niveau (coût, bonus, icône propre, compétences, effets, règles).
 * L'écart de niveau ±1 et l'interdiction Berseker sont gérés par le moteur.
 */
const KINDS = ["quagga", "koelod", "mochere"] as const;
const ROMAN = ["", "I", "II", "III"];
const BONUS_KEYS: [keyof NonNullable<Mount["bonuses"]>, string][] = [
  ["pa", "PA"],
  ["v", "V"],
  ["a", "A"],
  ["c", "C"],
  ["p", "P"],
  ["pv", "PV"],
  ["stature", "Stature"],
  ["allonge", "Allonge"],
];

export function MountsDetail({
  cat,
  mountId,
  onChangeType,
  onRemoveType,
  onChangeMount,
  onRemoveMount,
  setIcon,
}: {
  cat: Catalog;
  mountId: string;
  onChangeType: (id: string, patch: Partial<MountType>) => void;
  onRemoveType: (id: string) => void;
  onChangeMount: (id: string, patch: Partial<Mount>) => void;
  onRemoveMount: (id: string) => void;
  setIcon: (cardImage: string, dataUrl: string | null) => void;
}) {
  const [editingIcon, setEditingIcon] = useState<"shared" | "own" | null>(null);
  const m = cat.mounts.find((x) => x.id === mountId);
  if (!m) return <p className="adm-faint">Sélectionnez une monture.</p>;
  const type = cat.mountTypes.find((t) => t.id === m.typeId);
  const shared = type?.cardImage ? cat.icons?.[type.cardImage] : undefined;
  const own = m.icon;
  const excludable = type
    ? [...cat.profiles]
        .filter((p) => p.factionId != null && type.factionEligibility.includes(p.factionId))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    : [];

  return (
    <DetailPage
      header={
        <DetailHeader
          name={type?.name ?? m.typeId}
          onName={(v) => type && onChangeType(type.id, { name: v })}
          namePlaceholder="Nom du type"
          cost={m.cost}
          onCost={(v) => onChangeMount(m.id, { cost: v ?? 0 })}
          onRemove={() => onRemoveMount(m.id)}
          removeTitle="Supprimer ce niveau"
          extra={<span className="adm-badge-lvl">{ROMAN[m.level] ?? m.level}</span>}
          sub={
            <>
              <span className="adm-id">{m.id}</span>
              <span className="dot" />
              <span>
                Niveau {ROMAN[m.level] ?? m.level}
                {type ? ` · ${type.kind}` : ""}
              </span>
            </>
          }
        />
      }
      body={
        <>
          <Section title="Identité" icon="identity">
            <div className="flex flex-col gap-4">
              {/* Icônes partagée (par type) et propre au niveau - même disposition que les profils. */}
              <div className="flex flex-wrap gap-4">
                <IconSlot
                  title="Partagée (par type)"
                  hint="Commune à tous les niveaux de ce type."
                  src={shared}
                  active={shared != null && own == null}
                  onEdit={() => setEditingIcon("shared")}
                  onRemove={() => type?.cardImage && setIcon(type.cardImage, null)}
                />
                <IconSlot
                  title="Propre à ce niveau"
                  hint="Déroge au partage : remplace la partagée pour ce niveau seul."
                  src={own}
                  active={own != null}
                  createLabel="Déroger au partage…"
                  onEdit={() => setEditingIcon("own")}
                  onRemove={() => onChangeMount(m.id, { icon: undefined })}
                />
              </div>
              {editingIcon && (
                <IconEditor
                  initialSrc={type?.cardImage ? `/${type.cardImage}` : undefined}
                  onSave={(dataUrl) => {
                    if (editingIcon === "own") onChangeMount(m.id, { icon: dataUrl });
                    else if (type?.cardImage) setIcon(type.cardImage, dataUrl);
                    setEditingIcon(null);
                  }}
                  onClose={() => setEditingIcon(null)}
                />
              )}
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <Field label="Niveau" className="w-36">
                  <select
                    value={m.level}
                    onChange={(e) => onChangeMount(m.id, { level: Number(e.target.value) as Mount["level"] })}
                    className={INPUT}
                  >
                    {[1, 2, 3].map((l) => (
                      <option key={l} value={l}>
                        Niveau {ROMAN[l]}
                      </option>
                    ))}
                  </select>
                </Field>
                {type && (
                  <Field label="Nature" className="w-40">
                    <select
                      value={type.kind}
                      onChange={(e) => onChangeType(type.id, { kind: e.target.value as MountType["kind"] })}
                      className={INPUT}
                    >
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </div>
          </Section>

          {type && (
            <Section title="Type" icon="type" note="partagé par tous les niveaux">
              <div className="flex flex-col gap-3">
                <FieldGroup label="Factions éligibles">
                  <ChipMultiSelect
                    options={cat.factions.map((f) => ({ value: f.id, label: f.name }))}
                    selected={type.factionEligibility}
                    onToggle={(id) => {
                      const cur = type.factionEligibility;
                      onChangeType(type.id, {
                        factionEligibility: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                      });
                    }}
                  />
                </FieldGroup>

                <FieldGroup label="Profils exclus" hint="(malgré la faction)">
                  {(type.excludedProfileIds ?? []).map((pid) => (
                    <div key={pid} className="flex items-center gap-2">
                      <span className="adm-muted text-sm">{cat.profiles.find((p) => p.id === pid)?.name ?? pid}</span>
                      <RemoveButton
                        onClick={() =>
                          onChangeType(type.id, {
                            excludedProfileIds: (type.excludedProfileIds ?? []).filter((x) => x !== pid),
                          })
                        }
                      />
                    </div>
                  ))}
                  <Combobox
                    value=""
                    className="w-64"
                    placeholder="Exclure un profil…"
                    options={excludable
                      .filter((p) => !(type.excludedProfileIds ?? []).includes(p.id))
                      .map((p) => ({ value: p.id, label: p.name }))}
                    onChange={(v) => {
                      if (v) onChangeType(type.id, { excludedProfileIds: [...(type.excludedProfileIds ?? []), v] });
                    }}
                  />
                </FieldGroup>

                <Field label="Carte (chemin, partagée)" className="max-w-lg">
                  <input
                    value={type.cardImage ?? ""}
                    onChange={(e) => onChangeType(type.id, { cardImage: e.target.value || undefined })}
                    className={INPUT}
                    placeholder="cards/Kherops/koelod.jpg"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => onRemoveType(type.id)}
                  title="Supprimer le type et tous ses niveaux"
                  className="adm-x self-start text-xs"
                >
                  Supprimer le type (tous les niveaux)
                </button>
              </div>
            </Section>
          )}

          <Section title={`Niveau ${ROMAN[m.level] ?? m.level}`} icon="stats" id="sec-mount-level">
            <div className="flex flex-col gap-4">
              <FieldGroup label="Bonus (delta apporté au cavalier)">
                <div className="flex flex-wrap gap-2">
                  {BONUS_KEYS.map(([k, lab]) => (
                    <EditableNumber
                      key={k}
                      label={lab}
                      value={m.bonuses?.[k] ?? null}
                      unverified={false}
                      onChange={(v) => {
                        const b = { ...(m.bonuses ?? {}) };
                        if (v == null) delete b[k];
                        else b[k] = Number(v);
                        onChangeMount(m.id, { bonuses: b });
                      }}
                    />
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup label="Compétences conférées (à la monture)">
                <SkillsEditor
                  skills={m.grantedSkills ?? []}
                  cat={cat}
                  onChange={(s) => onChangeMount(m.id, { grantedSkills: s.length ? s : undefined })}
                />
              </FieldGroup>
            </div>
          </Section>

          <Section title={SECTION.verbatim} icon="verbatim">
            <RulesEditor
              rules={m.rules ?? []}
              onChange={(r) => onChangeMount(m.id, { rules: r.length ? r : undefined })}
            />
          </Section>

          <Section title={SECTION.effects} icon="effects" note="cible « cavalier » pour le porteur">
            <EffectListEditor
              effects={m.effects ?? []}
              newSource={{ kind: "mount", id: m.id }}
              cat={cat}
              onChange={(e) => onChangeMount(m.id, { effects: e.length ? e : undefined })}
            />
          </Section>
        </>
      }
    />
  );
}
