import type { Catalog, Faction, OpenRecruitment } from "@core";
import { AddButton, Field, RemoveButton } from "./primitives";
import { INPUT } from "./shared";
import { ChipRow, StringList } from "../ruleEditors/kit";

/**
 * Éditeur du **recrutement ouvert** d'une faction : quels peuples elle accueille, et à quelles
 * conditions. Une faction ordinaire n'en a pas ; c'est la règle des Affranchis.
 */
export function OpenRecruitmentEditor({
  cat,
  faction,
  onChange,
}: {
  cat: Catalog;
  faction: Faction;
  onChange: (open: OpenRecruitment | undefined) => void;
}) {
  const open = faction.openRecruitment;
  const set = (patch: Partial<OpenRecruitment>) =>
    onChange({ fromFactionIds: [], sourceText: "", ...open, ...patch });

  const factionOptions = cat.factions
    .filter((f) => f.id !== faction.id)
    .map((f) => ({ value: f.id, label: f.name }));
  /**
   * Tous les profils des peuples accueillis, quelle que soit leur limitation : on nomme justement un
   * refus pour barrer quelqu'un qu'aucune autre règle n'écarterait - un personnage qui rentrerait
   * malgré tout en payant son sceau, par exemple.
   */
  const profileOptions = cat.profiles
    .filter((p) => open?.fromFactionIds.includes(p.factionId ?? ""))
    .map((p) => ({
      value: p.id,
      label: `${p.name}${p.level ? ` ${"I".repeat(p.level)}` : ""}`,
      hint: cat.factions.find((f) => f.id === p.factionId)?.name,
    }));
  // Les plafonds, eux, ne portent que sur des figurines effectivement accueillies.
  const genericOptions = profileOptions.filter(
    (o) => cat.profiles.find((p) => p.id === o.value)?.limitation.kind === "X",
  );
  const traitOptions = [...new Set(cat.profiles.flatMap((p) => p.traits))]
    .sort()
    .map((t) => ({ value: t, label: t }));

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <p className="adm-faint text-xs">
          Cette faction ne recrute que les siens (plus les cas particuliers : « Allié des&nbsp;X »,
          apatrides, sceau).
        </p>
        <AddButton onClick={() => set({})}>+ ouvrir le recrutement à d’autres peuples</AddButton>
      </div>
    );
  }

  return (
    <div className="adm-card space-y-3 p-3">
      <p className="adm-faint text-xs">
        Les figurines <strong>génériques</strong> (ni uniques, ni personnages) des peuples cochés
        rejoignent cette faction sans rien payer. Elles y perdent l’équipement réservé à leur peuple,
        mais gardent leur monture et leur nature. Un refus, lui, est définitif : la figurine refusée
        ne rentre plus par aucune autre porte, pas même en payant un sceau.
      </p>

      <ChipRow
        label="Peuples accueillis"
        options={factionOptions}
        selected={open.fromFactionIds}
        onChange={(v) => set({ fromFactionIds: v })}
      />

      <StringList
        label="Refusés (par trait)"
        values={open.excludeTraits ?? []}
        options={traitOptions}
        combo
        onChange={(v) => set({ excludeTraits: v.length > 0 ? v : undefined })}
      />

      <StringList
        label="Refusés (nommément)"
        values={open.excludeProfileIds ?? []}
        options={profileOptions}
        combo
        onChange={(v) => set({ excludeProfileIds: v.length > 0 ? v : undefined })}
      />

      <div className="space-y-2">
        <div className="adm-field-label">Plafonds par Fer de Lance</div>
        <p className="adm-faint text-xs">
          Pour les groupes limités en nombre, comme « pas plus d’un shaman par Fer de Lance ».
        </p>
        {(open.caps ?? []).map((cap, i) => {
          const setCap = (patch: Partial<typeof cap>) =>
            set({ caps: (open.caps ?? []).map((c, j) => (j === i ? { ...c, ...patch } : c)) });
          return (
            <div key={i} className="adm-card space-y-2 p-2">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Nom du groupe" className="w-56">
                  <input
                    value={cap.label}
                    onChange={(e) => setCap({ label: e.target.value })}
                    className={INPUT}
                    placeholder="ex. shaman goûn"
                  />
                </Field>
                <Field label="Maximum" className="w-24">
                  <input
                    type="number"
                    value={cap.max}
                    onChange={(e) => setCap({ max: Number(e.target.value) || 0 })}
                    className={INPUT}
                  />
                </Field>
                <span className="adm-rowmeta ml-auto">
                  <RemoveButton
                    onClick={() => set({ caps: (open.caps ?? []).filter((_, j) => j !== i) })}
                  />
                </span>
              </div>
              <StringList
                label="Profils du groupe"
                values={cap.profileIds}
                options={genericOptions}
                combo
                onChange={(v) => setCap({ profileIds: v })}
              />
            </div>
          );
        })}
        <AddButton
          onClick={() => set({ caps: [...(open.caps ?? []), { label: "", profileIds: [], max: 1 }] })}
        >
          + plafond
        </AddButton>
      </div>

      <Field label="Texte officiel" hint="Le wording des règles, qui fait foi.">
        <textarea
          value={open.sourceText}
          onChange={(e) => set({ sourceText: e.target.value })}
          rows={3}
          className={INPUT}
        />
      </Field>

      <button type="button" onClick={() => onChange(undefined)} className="adm-x text-xs">
        ✕ refermer le recrutement de cette faction
      </button>
    </div>
  );
}
