import { useState } from "react";
import type { Catalog, Mount, MountType } from "@core";
import { INPUT } from "./shared";
import { Combobox, EditableNumber, RemoveButton, Section } from "./primitives";
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
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-baseline gap-2">
        <span className="adm-title text-xl">{type?.name ?? m.typeId}</span>
        <span className="adm-accent text-lg font-bold">{ROMAN[m.level] ?? m.level}</span>
      </header>

      {type && (
        <Section title="Type (partagé par tous les niveaux)">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={type.name}
                onChange={(e) => onChangeType(type.id, { name: e.target.value })}
                className={`${INPUT} w-48`}
                placeholder="Nom du type"
              />
              <select
                value={type.kind}
                onChange={(e) => onChangeType(type.id, { kind: e.target.value as MountType["kind"] })}
                className={INPUT}
                title="Nature"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <RemoveButton onClick={() => onRemoveType(type.id)} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs adm-faint">
              Factions éligibles
              {cat.factions.map((f) => (
                <label key={f.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={type.factionEligibility.includes(f.id)}
                    onChange={(e) => {
                      const cur = type.factionEligibility;
                      onChangeType(type.id, {
                        factionEligibility: e.target.checked ? [...cur, f.id] : cur.filter((x) => x !== f.id),
                      });
                    }}
                  />
                  {f.name}
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-1 text-xs adm-faint">
              <span>Profils exclus (malgré la faction)</span>
              {(type.excludedProfileIds ?? []).map((pid) => (
                <div key={pid} className="flex items-center gap-2">
                  <span className="adm-title text-sm">{cat.profiles.find((p) => p.id === pid)?.name ?? pid}</span>
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

            <label className="flex items-center gap-2 text-xs adm-faint">
              Carte (chemin, partagée)
              <input
                value={type.cardImage ?? ""}
                onChange={(e) => onChangeType(type.id, { cardImage: e.target.value || undefined })}
                className={`${INPUT} w-80`}
                placeholder="cards/Kherops/koelod.jpg"
              />
            </label>
            <IconSlot
              title="Icône partagée"
              hint="Commune à tous les niveaux de ce type."
              src={shared}
              active={shared != null && own == null}
              onEdit={() => setEditingIcon("shared")}
              onRemove={() => type.cardImage && setIcon(type.cardImage, null)}
            />
          </div>
        </Section>
      )}

      <Section title={`Niveau ${ROMAN[m.level] ?? m.level}`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={m.level}
              onChange={(e) => onChangeMount(m.id, { level: Number(e.target.value) as Mount["level"] })}
              className={INPUT}
              title="Niveau"
            >
              {[1, 2, 3].map((l) => (
                <option key={l} value={l}>
                  Niveau {ROMAN[l]}
                </option>
              ))}
            </select>
            <EditableNumber
              label="Coût"
              value={m.cost}
              unverified={false}
              onChange={(v) => onChangeMount(m.id, { cost: Number(v) || 0 })}
            />
            <RemoveButton onClick={() => onRemoveMount(m.id)} />
          </div>

          <IconSlot
            title="Icône propre à ce niveau"
            hint="Déroge à l'icône partagée : l'emporte pour ce niveau seul."
            src={own}
            active={own != null}
            createLabel="Déroger au partage…"
            onEdit={() => setEditingIcon("own")}
            onRemove={() => onChangeMount(m.id, { icon: undefined })}
          />

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

          <div className="flex flex-col gap-1">
            <span className="text-xs adm-faint">Compétences conférées (à la monture)</span>
            <SkillsEditor
              skills={m.grantedSkills ?? []}
              cat={cat}
              onChange={(s) => onChangeMount(m.id, { grantedSkills: s.length ? s : undefined })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs adm-faint">Effets (cible « cavalier » pour le porteur)</span>
            <EffectListEditor
              effects={m.effects ?? []}
              newSource={{ kind: "mount", id: m.id }}
              cat={cat}
              onChange={(e) => onChangeMount(m.id, { effects: e.length ? e : undefined })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs adm-faint">Règles de la carte (verbatim)</span>
            <RulesEditor
              rules={m.rules ?? []}
              onChange={(r) => onChangeMount(m.id, { rules: r.length ? r : undefined })}
            />
          </div>
        </div>
      </Section>

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
    </div>
  );
}
