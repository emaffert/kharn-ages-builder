import type { Catalog, MagicWay } from "@core";
import { INPUT } from "./shared";
import { AddButton, Combobox, RemoveButton, Section } from "./primitives";

/**
 * Table des voies de magie. Chaque voie est liée à une COMPÉTENCE (`skillId`) : une figurine
 * peut lancer la voie dès qu'elle possède cette compétence (source de vérité du statut de lanceur).
 */
export function MagicWaysDetail({
  cat,
  onAdd,
  onChange,
  onRemove,
}: {
  cat: Catalog;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<MagicWay>) => void;
  onRemove: (id: string) => void;
}) {
  const skillOptions = [...cat.skills]
    .sort((a, b) => a.keyword.localeCompare(b.keyword, "fr"))
    .map((s) => ({ value: s.id, label: s.keyword }));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h2 className="adm-title text-2xl">Voies de magie</h2>
        <p className="adm-faint mt-1 text-sm">
          Une figurine est lanceuse d'une voie dès qu'elle possède la compétence associée.
        </p>
      </header>
      <Section title="Voies">
        <div className="flex flex-col gap-2">
          {cat.magicWays.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-2">
              <input
                value={w.name}
                onChange={(e) => onChange(w.id, { name: e.target.value })}
                className={`${INPUT} w-44`}
                placeholder="Nom de la voie"
              />
              <select
                value={w.factionId}
                onChange={(e) => onChange(w.id, { factionId: e.target.value })}
                className={INPUT}
                title="Faction"
              >
                <option value="">(faction ?)</option>
                {cat.factions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <Combobox
                value={w.skillId ?? ""}
                className="w-56"
                placeholder="Compétence de maîtrise…"
                options={skillOptions}
                onChange={(v) => onChange(w.id, { skillId: v || undefined })}
              />
              <RemoveButton onClick={() => onRemove(w.id)} />
            </div>
          ))}
          <AddButton onClick={onAdd}>+ voie de magie</AddButton>
        </div>
      </Section>
    </div>
  );
}
