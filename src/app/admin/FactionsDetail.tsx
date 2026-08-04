import { useState } from "react";
import { findReferences, type Catalog, type Faction } from "@core";
import { OpenRecruitmentEditor } from "./OpenRecruitmentEditor";
import {
  AddButton,
  ConfirmDeleteDialog,
  Glyph,
  PageHeader,
  RemoveButton,
  Section,
  type PendingDelete,
} from "./primitives";
import { INPUT } from "./shared";

/**
 * Page « Factions » : la liste des peuples et la façon dont ils se recrutent entre eux. Séparée des
 * « Réglages » (grimoires, munitions, icônes), qui n'ont rien à voir et dont la page débordait.
 */
export function FactionsDetail({
  cat,
  onAddFaction,
  onUpdateFaction,
  onRemoveFaction,
}: {
  cat: Catalog;
  onAddFaction: () => void;
  onUpdateFaction: (id: string, patch: Partial<Faction>) => void;
  onRemoveFaction: (id: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="adm-banner">
        <span className="adm-banner-icon"><Glyph name="alert" /></span>
        <div>
          <p className="adm-banner-title">Données internes sensibles</p>
          <p className="adm-banner-text">
            Supprimer ou renommer une <strong>faction</strong> se répercute sur les profils, les
            équipements, les sorts et les listes déjà enregistrées. À éditer avec précaution.
          </p>
        </div>
      </div>

      <PageHeader title="Factions" subtitle="Les peuples, leur nature, et qui ils acceptent de recruter." />

      {/* ── Les peuples ──────────────────────────────────────────── */}
      <Section title="Peuples" icon="identity">
        <div className="flex flex-col gap-2">
          {/* Grille (et non flex) : l'identifiant est de longueur variable, en flex il rognait la
              colonne Notes d'une quantité différente à chaque ligne. */}
          {cat.factions.length > 0 && (
            <div className="adm-faction-row adm-field-label">
              <span>Nom</span>
              <span>Logo (chemin)</span>
              <span>Nature</span>
              <span>Notes</span>
              <span>Identifiant</span>
              <span />
            </div>
          )}
          {cat.factions.map((f) => (
            <div key={f.id} className="adm-faction-row">
              <input
                value={f.name}
                onChange={(e) => onUpdateFaction(f.id, { name: e.target.value })}
                className={INPUT}
                placeholder="Nom"
              />
              <input
                value={f.logo}
                onChange={(e) => onUpdateFaction(f.id, { logo: e.target.value })}
                className={INPUT}
                placeholder="factions/…"
              />
              {/* Nature du peuple : les cartes ne l'impriment pas, elle vaut pour tous ses
                  combattants et suit ceux qui le quittent (champ « Peuple d'origine » d'un profil). */}
              <select
                value={f.nature ?? ""}
                onChange={(e) =>
                  onUpdateFaction(f.id, { nature: (e.target.value || undefined) as Faction["nature"] })
                }
                className={INPUT}
                title="Ouvre « dévorer » et les Formations réservées. Laisser vide si le peuple n’en a pas (Guilde Noire)."
              >
                <option value="">—</option>
                <option value="carnivore">Carnivore</option>
                <option value="herbivore">Herbivore</option>
              </select>
              <input
                value={f.notes ?? ""}
                onChange={(e) => onUpdateFaction(f.id, { notes: e.target.value || undefined })}
                className={INPUT}
                placeholder="notes (optionnel)"
              />
              <span className="adm-faint truncate font-mono text-[10px]" title={f.id}>
                {f.id}
              </span>
              <RemoveButton
                onClick={() =>
                  setPendingDelete({
                    what: `la faction « ${f.name} »`,
                    run: () => onRemoveFaction(f.id),
                    refs: findReferences(cat, "faction", f.id),
                  })
                }
              />
            </div>
          ))}
          <AddButton onClick={onAddFaction}>+ faction</AddButton>
        </div>
      </Section>

      {/* ── Recrutement ouvert (Affranchis) ──────────────────────── */}
      <Section title="Recrutement entre peuples" icon="identity">
        <div className="flex flex-col gap-4">
          <p className="adm-faint text-xs">
            Une faction peut accueillir les figurines ordinaires d’autres peuples, sans passer par
            « Allié des&nbsp;X » ni par un sceau. C’est le cas des Affranchis, qui rassemblent des
            transfuges de presque tous les peuples.
          </p>
          {cat.factions.map((f) => (
            <div key={f.id} className="space-y-1">
              <div className="adm-field-label">{f.name}</div>
              <OpenRecruitmentEditor
                cat={cat}
                faction={f}
                onChange={(openRecruitment) => onUpdateFaction(f.id, { openRecruitment })}
              />
            </div>
          ))}
        </div>
      </Section>

      <ConfirmDeleteDialog pending={pendingDelete} onClose={() => setPendingDelete(null)} />
    </div>
  );
}
