import type { Catalog, Faction, Grimoire, MunitionKind } from "@core";
import { AddButton, Field, RemoveButton, Section } from "./primitives";
import { INPUT } from "./shared";

/**
 * Page « Réglages » : données de référence du catalogue éditées en tables (peu d'entrées) -
 * factions, grimoires (ensemble fixe petit/grand), et sortes de munitions (paliers × types).
 */
export function SettingsDetail({
  cat,
  onAddFaction,
  onUpdateFaction,
  onRemoveFaction,
  onUpdateGrimoire,
  onAddMunitionKind,
  onUpdateMunitionKind,
  onRemoveMunitionKind,
}: {
  cat: Catalog;
  onAddFaction: () => void;
  onUpdateFaction: (id: string, patch: Partial<Faction>) => void;
  onRemoveFaction: (id: string) => void;
  onUpdateGrimoire: (id: string, patch: Partial<Grimoire>) => void;
  onAddMunitionKind: () => void;
  onUpdateMunitionKind: (id: string, patch: Partial<MunitionKind>) => void;
  onRemoveMunitionKind: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h2 className="adm-title text-2xl">Réglages</h2>
        <p className="adm-faint mt-1 text-sm">Données de référence : factions, grimoires, munitions.</p>
      </header>

      {/* ── Factions ─────────────────────────────────────────────── */}
      <Section title="Factions">
        <div className="flex flex-col gap-2">
          {cat.factions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="adm-field-label w-40">Nom</span>
              <span className="adm-field-label w-48">Logo (chemin)</span>
              <span className="adm-field-label flex-1">Notes</span>
            </div>
          )}
          {cat.factions.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2">
              <input
                value={f.name}
                onChange={(e) => onUpdateFaction(f.id, { name: e.target.value })}
                className={`${INPUT} w-40`}
                placeholder="Nom"
              />
              <input
                value={f.logo}
                onChange={(e) => onUpdateFaction(f.id, { logo: e.target.value })}
                className={`${INPUT} w-48`}
                placeholder="factions/…"
              />
              <input
                value={f.notes ?? ""}
                onChange={(e) => onUpdateFaction(f.id, { notes: e.target.value || undefined })}
                className={`${INPUT} flex-1`}
                placeholder="notes (optionnel)"
              />
              <span className="adm-faint font-mono text-[10px]">{f.id}</span>
              <RemoveButton onClick={() => onRemoveFaction(f.id)} />
            </div>
          ))}
          <AddButton onClick={onAddFaction}>+ faction</AddButton>
        </div>
      </Section>

      {/* ── Grimoires (ensemble fixe) ────────────────────────────── */}
      <Section title="Grimoires">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="adm-field-label w-28">Grimoire</span>
            <span className="adm-field-label w-24">Coût (Ko)</span>
            <span className="adm-field-label w-32">Pages</span>
          </div>
          {cat.grimoires.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-2">
              <input value={g.name} onChange={(e) => onUpdateGrimoire(g.id, { name: e.target.value })} className={`${INPUT} w-28`} />
              <input
                type="number"
                value={g.cost}
                onChange={(e) => onUpdateGrimoire(g.id, { cost: Number(e.target.value) || 0 })}
                className={`${INPUT} w-24`}
              />
              <input
                value={g.pages === "illimite" ? "illimite" : String(g.pages)}
                placeholder='nb ou "illimite"'
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onUpdateGrimoire(g.id, { pages: v === "illimite" ? "illimite" : Number(v) || 0 });
                }}
                className={`${INPUT} w-32`}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Munitions (sortes → paliers de prix × types) ─────────── */}
      <Section title="Munitions">
        <div className="flex flex-col gap-5">
          {(cat.munitionKinds ?? []).map((k) => (
            <MunitionKindEditor
              key={k.id}
              kind={k}
              onChange={(patch) => onUpdateMunitionKind(k.id, patch)}
              onRemove={() => onRemoveMunitionKind(k.id)}
            />
          ))}
          <AddButton onClick={onAddMunitionKind}>+ sorte de munition</AddButton>
        </div>
      </Section>
    </div>
  );
}

/** Éditeur d'une sorte de munition : label, paliers de prix (colonnes), types (lignes) avec quantités. */
function MunitionKindEditor({
  kind,
  onChange,
  onRemove,
}: {
  kind: MunitionKind;
  onChange: (patch: Partial<MunitionKind>) => void;
  onRemove: () => void;
}) {
  const tiers = kind.tierPrices;

  const setTierPrice = (i: number, v: number) =>
    onChange({ tierPrices: tiers.map((p, j) => (j === i ? v : p)) });

  const addTier = () =>
    onChange({
      tierPrices: [...tiers, 0],
      types: kind.types.map((t) => ({ ...t, quantities: [...t.quantities, 0] })),
    });

  const removeTier = (i: number) =>
    onChange({
      tierPrices: tiers.filter((_, j) => j !== i),
      types: kind.types.map((t) => ({ ...t, quantities: t.quantities.filter((_, j) => j !== i) })),
    });

  const setType = (ti: number, patch: Partial<MunitionKind["types"][number]>) =>
    onChange({ types: kind.types.map((t, j) => (j === ti ? { ...t, ...patch } : t)) });

  const setQty = (ti: number, qi: number, v: number) =>
    setType(ti, { quantities: kind.types[ti].quantities.map((q, j) => (j === qi ? v : q)) });

  const addType = () =>
    onChange({
      types: [...kind.types, { id: `mt-${Date.now()}`, label: "Nouveau type", quantities: tiers.map(() => 0) }],
    });

  const removeType = (ti: number) => onChange({ types: kind.types.filter((_, j) => j !== ti) });

  return (
    <div className="adm-card space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Field label="Sorte" className="w-56">
          <input value={kind.label} onChange={(e) => onChange({ label: e.target.value })} className={INPUT} />
        </Field>
        <span className="adm-faint font-mono text-[10px]">{kind.id}</span>
        <button type="button" onClick={onRemove} title="Supprimer la sorte" className="adm-x ml-auto">
          ✕ sorte
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="adm-field-label text-left">Type \ Palier</th>
              {tiers.map((price, i) => (
                <th key={i} className="px-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setTierPrice(i, Number(e.target.value) || 0)}
                      className={`${INPUT} w-16 text-center`}
                      title="Prix du palier (Ko)"
                    />
                    <button type="button" onClick={() => removeTier(i)} title="Supprimer le palier" className="adm-x text-[10px]">
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-1">
                <button type="button" onClick={addTier} className="adm-add text-xs" title="Ajouter un palier">
                  + palier
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {kind.types.map((t, ti) => (
              <tr key={t.id}>
                <td>
                  <input
                    value={t.label}
                    onChange={(e) => setType(ti, { label: e.target.value })}
                    className={`${INPUT} w-40`}
                    placeholder="Type (ex. Simple)"
                  />
                </td>
                {tiers.map((_, qi) => (
                  <td key={qi} className="text-center">
                    <input
                      type="number"
                      value={t.quantities[qi] ?? 0}
                      onChange={(e) => setQty(ti, qi, Number(e.target.value) || 0)}
                      className={`${INPUT} w-16 text-center`}
                      title="Quantité obtenue à ce palier (0 = indisponible)"
                    />
                  </td>
                ))}
                <td>
                  <RemoveButton onClick={() => removeType(ti)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddButton onClick={addType}>+ type</AddButton>
    </div>
  );
}
