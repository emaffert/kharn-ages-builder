import { useState } from "react";
import { SegmentedControl } from "@ui";
import type { Catalog, GenericSpellAllocation, PageAllocation, Profile, Spell } from "@core";
import { SectionTitle, SlotChip } from "./components";
import {
  forbiddenGrimoires,
  genericSpellAllocation,
  pageAllocation,
  pageBonusSources,
  spellBudgetBits,
  spellInfo,
  spellsFor,
  type ItemInfo,
} from "./shared";

/**
 * Onglet magie. Un sort générique se paie en **niveaux du profil** et ne demande aucun grimoire ;
 * un sort de voie se paie en **pages** et suppose un grimoire acheté. Ce sont deux budgets distincts,
 * donc deux sélections : le contrôle segmenté dit laquelle on dépense et porte les deux soldes, pour
 * que l'autre reste visible sans y basculer.
 */
type SpellPane = "generique" | "grimoire";

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
  const gen = genericSpellAllocation(p, cat, spells);
  const isGeneric = (id: string) => cat.spells.find((s) => s.id === id)?.kind === "generique";
  // On ouvre sur le budget que la figurine dépense déjà : personne ne perd de vue son grimoire.
  const [pane, setPane] = useState<SpellPane>(() =>
    grimoire !== "none" || spells.some((id) => !isGeneric(id)) ? "grimoire" : "generique",
  );

  // Bonus de pages « généraux » (non dédiés à une voie) : les pools dédiés ont leur propre compteur.
  const generalSources = pageBonusSources(p, cat, upgrades, wornEquipIds).filter((s) => !s.magicWayId);
  const capLabel = alloc.general.cap === Infinity ? "∞" : String(alloc.general.cap);
  // Les deux dépassements s'affichent quel que soit l'onglet actif : un budget crevé ne doit pas se cacher.
  const warnings = [
    ways.length === 0 ? "La figurine ne peut pas lancer de sorts - retire les sorts ci-dessous." : null,
    gen.over
      ? `Budget de niveaux dépassé (${gen.used} / ${gen.cap}) - retire un sort générique.`
      : null,
    alloc.over
      ? `Capacité de pages dépassée (${alloc.general.used} / ${capLabel} au budget général) - retire un sort ou prends un grimoire plus grand.`
      : null,
  ].filter((w): w is string => w != null);

  return (
    <div className="fe-root">
      {warnings.map((w) => (
        <p key={w} className="fe-warn">
          ⚠ {w}
        </p>
      ))}

      <SegmentedControl
        ariaLabel="Budget de sorts"
        value={pane}
        onChange={setPane}
        options={[
          { value: "generique", label: `Sorts génériques ${gen.used}/${gen.cap} niv` },
          { value: "grimoire", label: `Grimoire ${alloc.general.used}/${capLabel} p` },
        ]}
      />

      {pane === "generique" ? (
        <div className="flex flex-wrap items-center gap-3">
          <SlotChip label="Niveaux" used={gen.used} cap={gen.cap} />
          <span className="fe-mag-bonus">Autant de niveaux de sorts que le niveau du profil. Sans grimoire.</span>
        </div>
      ) : (
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
            <span className="fe-mag-bonus">
              Bonus pages : {generalSources.map((s) => `+${s.amount} ${s.name}`).join(", ")}
            </span>
          )}
        </div>
      )}

      <SpellPanel
        profile={p}
        cat={cat}
        pane={pane}
        ways={ways}
        alloc={alloc}
        gen={gen}
        selected={spells}
        onToggle={onToggleSpell}
        onInfo={onInfo}
        isBlocked={(id) =>
          isGeneric(id)
            ? genericSpellAllocation(p, cat, [...spells, id]).over
            : pageAllocation(p, cat, upgrades, wornEquipIds, [...spells, id], grimoire).over
        }
      />
    </div>
  );
}

/** Panneau de sélection des sorts du budget actif (deux volets) - dans l'esprit du choix d'armes. */
function SpellPanel({
  profile: p,
  cat,
  pane,
  ways,
  alloc,
  gen,
  selected,
  onToggle,
  onInfo,
  isBlocked,
}: {
  profile: Profile;
  cat: Catalog;
  pane: SpellPane;
  ways: string[];
  alloc: PageAllocation;
  gen: GenericSpellAllocation;
  selected: string[];
  onToggle: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
  /** Ajouter ce sort dépasserait-il son budget (attribution atomique optimale recalculée pour les pages) ? */
  isBlocked: (spellId: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const spellById = (id: string) => cat.spells.find((s) => s.id === id);
  const inPane = (s: Spell) => (pane === "generique" ? s.kind === "generique" : s.kind !== "generique");
  const chosen = selected.map(spellById).filter((s): s is Spell => Boolean(s) && inPane(s!));
  const q = query.trim().toLowerCase();

  // Les génériques forment une liste plate ; les sorts de grimoire se groupent par voie.
  const wayName = (id?: string) => cat.magicWays.find((w) => w.id === id)?.name ?? id ?? "Autres";
  const groupOf = (s: Spell) => (pane === "generique" ? "" : wayName(s.magicWayId));
  // On ne filtre PAS les sorts connus d'office : l'éligibilité est gérée par `spell.reservedTo`,
  // et un sort générique connu d'office doit rester ajoutable.
  const avail = spellsFor(p, cat, ways).filter(
    (s) => inPane(s) && !selected.includes(s.id) && (q === "" || s.name.toLowerCase().includes(q)),
  );
  const groupsOf = (list: Spell[]) => [...new Set(list.map(groupOf))].sort((a, b) => a.localeCompare(b));
  const blockedTitle = pane === "generique" ? "Budget de niveaux insuffisant" : "Pas assez de pages";
  const totalCap =
    pane === "generique"
      ? gen.cap
      : Number.isFinite(alloc.general.cap)
        ? alloc.general.cap + alloc.pools.reduce((n, pl) => n + pl.cap, 0)
        : Infinity;
  const totalUsed = pane === "generique" ? gen.used : alloc.totalUsed;
  const unit = pane === "generique" ? "niveaux" : "pages";

  const spellRow = (s: Spell, action: "add" | "rem") => {
    const no = action === "add" && isBlocked(s.id);
    return (
      <div
        key={s.id}
        className={`fe-item is-clickable${no ? " is-blocked" : ""}`}
        title={no ? blockedTitle : "Voir le détail"}
        onClick={() => onInfo(spellInfo(s, cat))}
      >
        {action === "add" && (
          <button
            className="fe-move add"
            onClick={(ev) => {
              ev.stopPropagation();
              onToggle(s.id);
            }}
            disabled={no}
            title={no ? blockedTitle : "Ajouter"}
          >
            ←
          </button>
        )}
        <span className="fe-item-main">
          <span className="fe-item-name">{s.name}</span>
          <span className="fe-item-bits">
            {spellBudgetBits(s)}
            {s.cost ? ` · ${s.cost} Ko` : ""}
          </span>
        </span>
        {action === "rem" && (
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
        )}
      </div>
    );
  };

  const groupedList = (list: Spell[], action: "add" | "rem") =>
    groupsOf(list).map((g) => (
      <div key={g}>
        {g !== "" && <p className="fe-group-label">{g}</p>}
        <div className="fe-col">{list.filter((s) => groupOf(s) === g).map((s) => spellRow(s, action))}</div>
      </div>
    ));

  return (
    <div className="fe-root">
      {pane === "grimoire" && (
        <div className="flex flex-wrap items-center gap-2">
          <SlotChip label="Pages" used={alloc.general.used} cap={alloc.general.cap} />
          {alloc.pools.map((pl) => (
            <SlotChip key={pl.wayId} label={`${pl.label} : Pages ${pl.wayName}`} used={pl.used} cap={pl.cap} />
          ))}
        </div>
      )}

      <div className="fe-panes">
        {/* Volet sélectionnés - à gauche (près de la fiche). */}
        <div>
          <div className="fe-section-head">
            <SectionTitle>Sélectionnés</SectionTitle>
            <span className="tot">
              {unit}{" "}
              <b>
                {totalUsed}/{totalCap === Infinity ? "∞" : totalCap}
              </b>
            </span>
          </div>
          <div className="fe-scroll">
            {groupedList(chosen, "rem")}
            {chosen.length === 0 && (
              <p className="fe-mag-bonus">
                {pane === "generique" ? "Aucun sort générique." : "Aucun sort de grimoire."}
              </p>
            )}
          </div>
        </div>

        {/* Volet disponible - à droite. */}
        <div>
          <SectionTitle>Disponible</SectionTitle>
          <input
            className="fe-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pane === "generique" ? "Rechercher un sort générique…" : "Rechercher un sort de grimoire…"}
          />
          <div className="fe-scroll">
            {groupedList(avail, "add")}
            {avail.length === 0 && <p className="fe-mag-bonus">{q ? "Aucun résultat." : "Aucun sort disponible."}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
