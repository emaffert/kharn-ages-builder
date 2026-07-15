import { useState } from "react";
import { SegmentedControl } from "@ui";
import type { Catalog, PageAllocation, Profile, Spell } from "@core";
import { SectionTitle, SlotChip } from "./components";
import {
  forbiddenGrimoires,
  pageAllocation,
  pageBonusSources,
  spellInfo,
  spellsFor,
  type ItemInfo,
} from "./shared";

/** Onglet magie : choix du grimoire, compteur de pages, puis sélection des sorts (SpellPanel). */
export function MagiePanel({
  profile: p,
  cat,
  upgrades,
  grimoire,
  spells,
  ways,
  wornEquipIds,
  onGrimoire,
  onToggleSpell,
  onInfo,
  grimoireDiscount,
}: {
  profile: Profile;
  cat: Catalog;
  upgrades: string[];
  /** Équipement porté (base non retirée + acheté) : alimente les pages conférées par l'équipement (Brassards). */
  wornEquipIds: string[];
  grimoire: "none" | "petit" | "grand";
  spells: string[];
  ways: string[];
  onGrimoire: (g: "none" | "petit" | "grand") => void;
  onToggleSpell: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
  grimoireDiscount?: Record<string, number>;
}) {
  const forbiddenGrims = forbiddenGrimoires(p);
  // Prix net d'un palier de grimoire, réduction de monture (ex. Mochère) déduite.
  const netCost = (tier: "petit" | "grand") => {
    const base = cat.grimoires.find((x) => x.id === tier)?.cost ?? (tier === "petit" ? 20 : 40);
    return Math.max(0, base - Math.min(grimoireDiscount?.[tier] ?? 0, base));
  };
  const alloc = pageAllocation(p, cat, upgrades, wornEquipIds, spells, grimoire);
  // Bonus de pages « généraux » (non dédiés à une voie) : les pools dédiés ont leur propre compteur.
  const generalSources = pageBonusSources(p, cat, upgrades, wornEquipIds).filter((s) => !s.magicWayId);
  const warning =
    ways.length === 0
      ? "La figurine ne peut pas lancer de sorts - retire les sorts ci-dessous."
      : alloc.over
        ? `Capacité de pages dépassée (${alloc.general.used} / ${alloc.general.cap === Infinity ? "∞" : alloc.general.cap} au budget général) - retire un sort ou prends un grimoire plus grand.`
        : null;
  return (
    <div className="fe-root">
      {warning && <p className="fe-warn">⚠ {warning}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Grimoire"
          value={grimoire}
          onChange={onGrimoire}
          options={[
            { value: "none", label: "Sans grimoire", disabled: forbiddenGrims.has("none") },
            { value: "petit", label: `Petit +${netCost("petit")}`, disabled: forbiddenGrims.has("petit") },
            { value: "grand", label: `Grand +${netCost("grand")}`, disabled: forbiddenGrims.has("grand") },
          ]}
        />
        {generalSources.length > 0 && (
          <span className="fe-mag-bonus">Bonus pages : {generalSources.map((s) => `+${s.amount} ${s.name}`).join(", ")}</span>
        )}
      </div>
      <SpellPanel
        profile={p}
        cat={cat}
        ways={ways}
        alloc={alloc}
        selected={spells}
        onToggle={onToggleSpell}
        onInfo={onInfo}
        isBlocked={(id) => pageAllocation(p, cat, upgrades, wornEquipIds, [...spells, id], grimoire).over}
      />
    </div>
  );
}

/** Panneau de sélection des sorts (deux volets, budget de pages) - dans l'esprit du choix d'armes. */
function SpellPanel({
  profile: p,
  cat,
  ways,
  alloc,
  selected,
  onToggle,
  onInfo,
  isBlocked,
}: {
  profile: Profile;
  cat: Catalog;
  ways: string[];
  alloc: PageAllocation;
  selected: string[];
  onToggle: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
  /** Ajouter ce sort dépasserait-il le budget général (attribution atomique optimale recalculée) ? */
  isBlocked: (spellId: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const spellById = (id: string) => cat.spells.find((s) => s.id === id);
  const chosen = selected.map(spellById).filter((s): s is Spell => Boolean(s));
  const q = query.trim().toLowerCase();

  const GENERIC = "Génériques";
  const wayName = (id?: string) => cat.magicWays.find((w) => w.id === id)?.name ?? id ?? "Autres";
  const groupOf = (s: Spell) => (s.kind === "generique" ? GENERIC : wayName(s.magicWayId));
  // On ne filtre PAS les sorts connus d'office : l'éligibilité est gérée par `spell.reservedTo`,
  // et un sort générique connu d'office doit rester ajoutable.
  const avail = spellsFor(p, cat, ways).filter(
    (s) => !selected.includes(s.id) && (q === "" || s.name.toLowerCase().includes(q)),
  );
  const groupNames = [...new Set(avail.map(groupOf))].sort((a, b) =>
    a === GENERIC ? -1 : b === GENERIC ? 1 : a.localeCompare(b),
  );
  // Ajout possible ? On recalcule l'attribution ATOMIQUE optimale avec le sort en plus (un sort ne peut
  // pas être scindé entre son pool dédié et le grimoire général) : bloqué si le budget général déborde.
  const blocked = (s: Spell) => isBlocked(s.id);
  // Sélectionnés regroupés par voie - mêmes en-têtes que « disponible ».
  const chosenGroups = [...new Set(chosen.map(groupOf))].sort((a, b) =>
    a === GENERIC ? -1 : b === GENERIC ? 1 : a.localeCompare(b),
  );
  const totalCap = Number.isFinite(alloc.general.cap)
    ? alloc.general.cap + alloc.pools.reduce((n, pl) => n + pl.cap, 0)
    : Infinity;

  return (
    <div className="fe-root">
      <div className="flex flex-wrap items-center gap-2">
        <SlotChip label="Pages" used={alloc.general.used} cap={alloc.general.cap} />
        {alloc.pools.map((pl) => (
          <SlotChip key={pl.wayId} label={`${pl.label} : Pages ${pl.wayName}`} used={pl.used} cap={pl.cap} />
        ))}
      </div>

      <div className="fe-panes">
        {/* Volet sélectionnés - à gauche (près de la fiche). */}
        <div>
          <div className="fe-section-head">
            <SectionTitle>Sélectionnés</SectionTitle>
            <span className="tot">
              pages <b>{alloc.totalUsed}/{totalCap === Infinity ? "∞" : totalCap}</b>
            </span>
          </div>
          <div className="fe-scroll">
            {chosenGroups.map((g) => (
              <div key={g}>
                <p className="fe-group-label">{g}</p>
                <div className="fe-col">
                  {chosen
                    .filter((s) => groupOf(s) === g)
                    .map((s) => (
                      <div key={s.id} className="fe-item is-clickable" onClick={() => onInfo(spellInfo(s, cat))} title="Voir le détail">
                        <span className="fe-item-main">
                          <span className="fe-item-name">{s.name}</span>
                          <span className="fe-item-bits">
                            {s.pages ?? 0} p{s.cost ? ` · ${s.cost} Ko` : ""}
                          </span>
                        </span>
                        <button
                          className="fe-move rem"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onToggle(s.id);
                          }}
                          title="Retirer"
                        >
                          →
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            ))}
            {chosen.length === 0 && <p className="fe-mag-bonus">Aucun sort.</p>}
          </div>
        </div>

        {/* Volet disponible - à droite. */}
        <div>
          <SectionTitle>Disponible</SectionTitle>
          <input
            className="fe-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un sort…"
          />
          <div className="fe-scroll">
            {groupNames.map((g) => (
              <div key={g}>
                <p className="fe-group-label">{g}</p>
                <div className="fe-col">
                  {avail
                    .filter((s) => groupOf(s) === g)
                    .map((s) => {
                      const no = blocked(s);
                      return (
                        <div
                          key={s.id}
                          className={`fe-item is-clickable${no ? " is-blocked" : ""}`}
                          title={no ? "Pas assez de pages" : "Voir le détail"}
                          onClick={() => onInfo(spellInfo(s, cat))}
                        >
                          <button
                            className="fe-move add"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onToggle(s.id);
                            }}
                            disabled={no}
                            title={no ? "Pas assez de pages" : "Ajouter"}
                          >
                            ←
                          </button>
                          <span className="fe-item-main">
                            <span className="fe-item-name">{s.name}</span>
                            <span className="fe-item-bits">
                              {s.pages ?? 0} p{s.cost ? ` · ${s.cost} Ko` : ""}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
            {avail.length === 0 && <p className="fe-mag-bonus">{q ? "Aucun résultat." : "Aucun sort disponible."}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
