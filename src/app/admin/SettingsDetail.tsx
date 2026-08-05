import { useState } from "react";
import { findReferences, technicalIdSuggestions, type Catalog, type CatalogSettings, type Grimoire, type MunitionKind, type Reference } from "@core";
import { Button } from "@ui";
import { IconBucketSection } from "./IconBucketSection";
import { AddButton, ConfirmDeleteDialog, Field, Glyph, PageHeader, RemoveButton, Section, type PendingDelete } from "./primitives";
import { INPUT } from "./shared";

/**
 * Page « Réglages » : données de référence du catalogue éditées en tables (peu d'entrées) -
 * grimoires (ensemble fixe petit/grand), surcoût Tembo, sortes de munitions (paliers × types) et
 * icônes. Les factions ont leur propre page (`FactionsDetail`). Toute suppression passe par une
 * confirmation (répercussion sur profils / équipements / listes).
 */
export function SettingsDetail({
  cat,
  onUpdateGrimoire,
  onAddMunitionKind,
  onUpdateMunitionKind,
  onRemoveMunitionKind,
  onUpdateSettings,
  onSlugifyAllIds,
}: {
  cat: Catalog;
  /** Donne un identifiant lisible à toutes les entités qui portent encore celui de leur création. */
  onSlugifyAllIds: () => void;
  onUpdateGrimoire: (id: string, patch: Partial<Grimoire>) => void;
  onAddMunitionKind: () => void;
  onUpdateMunitionKind: (id: string, patch: Partial<MunitionKind>) => void;
  onRemoveMunitionKind: (id: string) => void;
  onUpdateSettings: (patch: Partial<CatalogSettings>) => void;
}) {
  const surcharge = cat.settings?.temboEquipmentSurcharge;
  const surchargeEnabled = surcharge != null;
  const setSurcharge = (patch: Partial<NonNullable<CatalogSettings["temboEquipmentSurcharge"]>>) =>
    onUpdateSettings({ temboEquipmentSurcharge: { per: surcharge?.per ?? 10, amount: surcharge?.amount ?? 3, ...patch } });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const confirmDelete = (what: string, run: () => void, refs?: Reference[]) =>
    setPendingDelete({ what, run, refs });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="adm-banner">
        <span className="adm-banner-icon"><Glyph name="alert" /></span>
        <div>
          <p className="adm-banner-title">Données internes sensibles</p>
          <p className="adm-banner-text">
            Ces réglages structurent tout le catalogue. Modifier ou supprimer un{" "}
            <strong>grimoire</strong> ou une <strong>sorte de munition</strong> se répercute sur les profils,
            équipements, sorts et listes déjà enregistrés. À éditer avec précaution.
          </p>
        </div>
      </div>

      <PageHeader title="Réglages" subtitle="Données de référence : grimoires, munitions, icônes." />

      {/* ── Grimoires (ensemble fixe) ────────────────────────────── */}
      <Section title="Grimoires" icon="magic">
        <div className="flex flex-col gap-2">
          <p className="adm-faint text-xs">
            Dans « Pages », saisir un nombre (budget de pages de sorts) ou « illimite » pour un grimoire
            sans limite de pages.
          </p>
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

      {/* ── Surcoût d'équipement Tembo (règles de bataille p.20) ── */}
      <Section title="Surcoût Tembo" icon="equipment">
        <div className="flex flex-col gap-3">
          <p className="adm-faint text-xs">
            Les figurines au trait « tembo » paient plus cher l'équipement <strong>ajouté</strong> (armes,
            armures, objets) qui n'est pas déjà au logo Tembo : +N Ko par tranche complète de M Ko de son prix.
            Une arme gratuite le reste. Les équipements réservés au trait « tembo » (ex. Khépesh) l'incluent déjà.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={surchargeEnabled}
              onChange={(e) =>
                onUpdateSettings({ temboEquipmentSurcharge: e.target.checked ? { per: 10, amount: 3 } : undefined })
              }
            />
            Activer le surcoût Tembo
          </label>
          {surchargeEnabled && (
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <Field label="+ Ko (surcoût)" className="w-32">
                <input
                  type="number"
                  value={surcharge?.amount ?? 3}
                  onChange={(e) => setSurcharge({ amount: Number(e.target.value) || 0 })}
                  className={INPUT}
                />
              </Field>
              <span className="pb-2">par tranche de</span>
              <Field label="Ko (tranche)" className="w-32">
                <input
                  type="number"
                  value={surcharge?.per ?? 10}
                  onChange={(e) => setSurcharge({ per: Number(e.target.value) || 1 })}
                  className={INPUT}
                />
              </Field>
            </div>
          )}
        </div>
      </Section>

      {/* ── Munitions (sortes → paliers de prix × types) ─────────── */}
      <Section title="Munitions" icon="equipment">
        <div className="flex flex-col gap-5">
          <p className="adm-muted text-xs">
            Cochez « Pas sur une arme gratuite » pour un type que les règles refusent sur une arme
            qui ne coûte rien (la Flèche hydre sur un arc gratuit) : il ne sera plus proposé sur ces
            armes, et une liste qui en porte déjà sera signalée comme illégale.
          </p>
          {(cat.munitionKinds ?? []).map((k) => (
            <MunitionKindEditor
              key={k.id}
              kind={k}
              confirmDelete={confirmDelete}
              onChange={(patch) => onUpdateMunitionKind(k.id, patch)}
              onRemove={() =>
                confirmDelete(
                  `la sorte de munition « ${k.label} »`,
                  () => onRemoveMunitionKind(k.id),
                  findReferences(cat, "munitionKind", k.id),
                )
              }
            />
          ))}
          <AddButton onClick={onAddMunitionKind}>+ sorte de munition</AddButton>
        </div>
      </Section>

      {/* ── Identifiants ─────────────────────────────────────────── */}
      <Section title="Identifiants" icon="identity">
        <IdSlugifier cat={cat} onSlugifyAll={onSlugifyAllIds} />
      </Section>

      {/* ── Icônes ───────────────────────────────────────────────── */}
      <IconBucketSection cat={cat} />

      <ConfirmDeleteDialog pending={pendingDelete} onClose={() => setPendingDelete(null)} />

    </div>
  );
}

/**
 * Rattrapage des identifiants : les entités créées dans l'administration gardent l'horodatage de
 * leur naissance (`profile-1785410170666`), qui n'apprend rien à qui relit un script ou un diff.
 * Cet outil les nomme d'après leur nom, en une passe, références comprises.
 */
function IdSlugifier({ cat, onSlugifyAll }: { cat: Catalog; onSlugifyAll: () => void }) {
  const suggestions = technicalIdSuggestions(cat);
  const [ouvert, setOuvert] = useState(false);

  if (suggestions.length === 0) {
    return (
      <p className="adm-faint text-xs">
        Tous les identifiants sont lisibles. Une entité créée ici en reçoit un dès qu'on la nomme.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="adm-faint text-xs">
        <strong>{suggestions.length}</strong> entité(s) portent encore l'identifiant de leur création.
        Les renommer met à jour tout ce qui les cite dans le catalogue, mais <strong>pas les listes
        déjà enregistrées</strong> par les joueurs, qui perdront les figurines concernées.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={onSlugifyAll}>
          Renommer les {suggestions.length}
        </Button>
        <Button size="sm" onClick={() => setOuvert((o) => !o)}>
          {ouvert ? "Masquer le détail" : "Voir le détail"}
        </Button>
      </div>
      {ouvert && (
        <ul className="adm-reflist">
          {suggestions.map((s) => (
            <li key={s.from}>
              <span className="adm-faint">{s.label}</span> · <code>{s.from}</code> →{" "}
              <code className="adm-accent">{s.to}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Éditeur d'une sorte de munition : label, paliers de prix (colonnes), types (lignes) avec quantités. */
function MunitionKindEditor({
  kind,
  confirmDelete,
  onChange,
  onRemove,
}: {
  kind: MunitionKind;
  confirmDelete: (what: string, run: () => void) => void;
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
        {/* `adm-rowmeta` cale ces éléments sur la hauteur de l'input, et non sur le bloc
            label + input, sans quoi ils flottent au-dessus de la saisie. */}
        <span className="adm-rowmeta adm-faint font-mono text-[10px]">{kind.id}</span>
        <button type="button" onClick={onRemove} title="Supprimer la sorte" className="adm-rowmeta adm-x ml-auto">
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
                    <button
                      type="button"
                      onClick={() => confirmDelete(`le palier « ${price} Ko » (colonne)`, () => removeTier(i))}
                      title="Supprimer le palier"
                      className="adm-x text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              <th className="adm-field-label px-1 text-center">Pas sur une arme gratuite</th>
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
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={t.forbiddenOnFreeWeapon ?? false}
                    onChange={(e) => setType(ti, { forbiddenOnFreeWeapon: e.target.checked || undefined })}
                    title="Ce type ne peut pas être acheté pour une arme qui ne coûte rien"
                  />
                </td>
                <td>
                  <RemoveButton onClick={() => confirmDelete(`le type « ${t.label} »`, () => removeType(ti))} />
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
