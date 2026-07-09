import { useState } from "react";
import type { Catalog, Mount, MountType } from "@core";
import { INPUT, SECTION } from "./shared";
import { ChipMultiSelect, Combobox, DetailPage, EditableNumber, Field, RemoveButton, Section } from "./primitives";
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
    <div className="mx-auto max-w-3xl">
    <DetailPage
      header={
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          {type ? (
            <input
              value={type.name}
              onChange={(e) => onChangeType(type.id, { name: e.target.value })}
              className="adm-title flex-1"
              placeholder="Nom du type"
            />
          ) : (
            <span className="adm-title flex-1">{m.typeId}</span>
          )}
          <span className="adm-accent text-lg font-bold">{ROMAN[m.level] ?? m.level}</span>
          <label className="flex items-center gap-1 adm-accent">
            <input
              type="number"
              value={m.cost}
              onChange={(e) => onChangeMount(m.id, { cost: Number(e.target.value) || 0 })}
              className="adm-cost"
            />
            <span className="text-sm">Ko</span>
          </label>
        </div>
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
          <button
            type="button"
            onClick={() => onRemoveMount(m.id)}
            title="Supprimer ce niveau"
            className="adm-x pb-1"
          >
            ✕ niveau
          </button>
        </div>
      </header>
      }
      body={
      <>
      {type && (
        <Section title="Type (partagé par tous les niveaux)">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <span className="adm-field-label">Factions éligibles</span>
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
            </div>

            <div className="space-y-1">
              <span className="adm-field-label">
                Profils exclus <span className="adm-field-hint">(malgré la faction)</span>
              </span>
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
            </div>

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

      <Section title={`Niveau ${ROMAN[m.level] ?? m.level}`}>
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <span className="adm-field-label">Bonus (delta apporté au cavalier)</span>
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
          </div>

          <div className="space-y-1">
            <span className="adm-field-label">Compétences conférées (à la monture)</span>
            <SkillsEditor
              skills={m.grantedSkills ?? []}
              cat={cat}
              onChange={(s) => onChangeMount(m.id, { grantedSkills: s.length ? s : undefined })}
            />
          </div>
        </div>
      </Section>
      </>
      }
      verbatim={
        <Section title={SECTION.verbatim}>
          <RulesEditor
            rules={m.rules ?? []}
            onChange={(r) => onChangeMount(m.id, { rules: r.length ? r : undefined })}
          />
        </Section>
      }
      effects={
        <Section title={`${SECTION.effects} (cible « cavalier » pour le porteur)`}>
          <EffectListEditor
            effects={m.effects ?? []}
            newSource={{ kind: "mount", id: m.id }}
            cat={cat}
            onChange={(e) => onChangeMount(m.id, { effects: e.length ? e : undefined })}
          />
        </Section>
      }
    />
    </div>
  );
}
