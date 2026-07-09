import type { Catalog, MountOption } from "@core";
import { INPUT } from "./shared";
import { Combobox, EditableNumber, RemoveButton, Section } from "./primitives";

/** Éditeur d'une option de monture (règles de bataille p.32) : panier, compétence, réservations, coûts. */
const BUCKETS: [MountOption["bucket"], string][] = [
  ["mount", "Monture"],
  ["rider", "Cavalier"],
  ["both", "Partagée (les deux)"],
];
const KINDS = ["quagga", "koelod", "mochere"] as const;

export function MountOptionDetail({
  option: o,
  cat,
  onChange,
  onRemove,
}: {
  option: MountOption;
  cat: Catalog;
  onChange: (patch: Partial<MountOption>) => void;
  onRemove: () => void;
}) {
  const res = o.reservation ?? {};
  const patchRes = (patch: Partial<NonNullable<MountOption["reservation"]>>) => {
    const next = { ...res, ...patch };
    const clean = {
      factions: next.factions?.length ? next.factions : undefined,
      mountKinds: next.mountKinds?.length ? next.mountKinds : undefined,
    };
    onChange({ reservation: clean.factions || clean.mountKinds ? clean : undefined });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center gap-2">
        <input
          value={o.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={`${INPUT} w-64`}
          placeholder="Nom de l'option"
        />
        <select
          value={o.bucket}
          onChange={(e) => onChange({ bucket: e.target.value as MountOption["bucket"] })}
          className={INPUT}
          title="Panier : où l'option s'achète et sur quelle fiche elle agit"
        >
          {BUCKETS.map(([v, lab]) => (
            <option key={v} value={v}>
              {lab}
            </option>
          ))}
        </select>
        <RemoveButton onClick={onRemove} />
      </header>

      <Section title="Compétence conférée">
        <Combobox
          value={o.grantsSkill?.skillId ?? ""}
          className="w-72"
          placeholder="Choisir une compétence…"
          options={[...cat.skills]
            .sort((a, b) => a.keyword.localeCompare(b.keyword, "fr"))
            .map((s) => ({ value: s.id, label: s.keyword }))}
          onChange={(v) => onChange({ grantsSkill: v ? { skillId: v } : undefined })}
        />
      </Section>

      <Section title="Réservations (au sein d'une dimension, l'appartenance suffit)">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs adm-faint">
            Factions du cavalier
            {cat.factions.map((f) => (
              <label key={f.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={res.factions?.includes(f.id) ?? false}
                  onChange={(e) =>
                    patchRes({
                      factions: e.target.checked
                        ? [...(res.factions ?? []), f.id]
                        : (res.factions ?? []).filter((x) => x !== f.id),
                    })
                  }
                />
                {f.name}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs adm-faint">
            Natures de monture
            {KINDS.map((k) => (
              <label key={k} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={res.mountKinds?.includes(k) ?? false}
                  onChange={(e) =>
                    patchRes({
                      mountKinds: e.target.checked
                        ? [...(res.mountKinds ?? []), k]
                        : (res.mountKinds ?? []).filter((x) => x !== k),
                    })
                  }
                />
                {k}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Coût">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <EditableNumber
              label="Coût de base"
              value={o.cost}
              unverified={false}
              onChange={(v) => onChange({ cost: Number(v) || 0 })}
            />
            <EditableNumber
              label="Valeur X max (vide = sans valeur)"
              value={o.maxValue ?? null}
              unverified={false}
              onChange={(v) => onChange({ maxValue: v == null ? undefined : Number(v) })}
            />
          </div>

          {o.maxValue != null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs adm-faint">Coût par palier X (X1, X2, …) - déroge au coût de base</span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: o.maxValue }, (_, i) => (
                  <label key={i} className="flex items-center gap-1 text-xs adm-muted">
                    X{i + 1}
                    <input
                      type="number"
                      value={o.costByValue?.[i] ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const arr = [...(o.costByValue ?? [])];
                        arr[i] = Number(e.target.value) || 0;
                        onChange({ costByValue: arr.some((x) => x) ? arr : undefined });
                      }}
                      className={`${INPUT} w-16`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs adm-faint">Coût par nature de monture (déroge au coût de base, ex. Repoussement)</span>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <label key={k} className="flex items-center gap-1 text-xs adm-muted">
                  {k}
                  <input
                    type="number"
                    value={o.costByMountKind?.[k] ?? ""}
                    placeholder="—"
                    onChange={(e) => {
                      const cur = { ...(o.costByMountKind ?? {}) };
                      if (e.target.value === "") delete cur[k];
                      else cur[k] = Number(e.target.value);
                      onChange({ costByMountKind: Object.keys(cur).length ? cur : undefined });
                    }}
                    className={`${INPUT} w-16`}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Effets (verbatim)">
        <textarea
          value={o.effectsText ?? ""}
          rows={2}
          onChange={(e) => onChange({ effectsText: e.target.value || undefined })}
          className={`${INPUT} w-full`}
        />
      </Section>
    </div>
  );
}
