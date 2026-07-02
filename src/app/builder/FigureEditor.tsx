import { useState } from "react";
import { specialCardsForProfile } from "@ui/explain";
import { SegmentedControl } from "@ui";
import type { Catalog, Profile, Spell } from "@core";
import { ProfileStatCard } from "./ProfileStatCard";
import { SectionTitle, SlotChip } from "./components";
import {
  CAT_LABEL,
  PURCHASE_CATS,
  canBuy,
  castWays,
  equipBits,
  equipInfo,
  equipReservedOk,
  forbiddenCats,
  forbiddenGrimoires,
  pageBonus,
  pageBonusSources,
  spellInfo,
  spellsFor,
  type ItemInfo,
} from "./shared";

/**
 * Éditeur d'une figurine (onglets Carte / Équipement / Améliorations / Magie) et ses panneaux.
 * Piloté par des callbacks du store (aucun état de liste local ici). Rendu dans un Dialog du kit
 * (le Dialog fournit le titre, la fermeture et le pied).
 */

function AmeliorationsPanel({
  profile: p,
  cat,
  upgrades,
  onToggleUpgrade,
  onInfo,
}: {
  profile: Profile;
  cat: Catalog;
  upgrades: string[];
  onToggleUpgrade: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
}) {
  const ameliorations = specialCardsForProfile(p, cat).filter((c) => c.amelioration);
  return (
    <div className="fe-col">
      {ameliorations.map((c) => (
        <label key={c.id} className="fe-check">
          <input type="checkbox" checked={upgrades.includes(c.id)} onChange={() => onToggleUpgrade(c.id)} />
          <button
            className="nm"
            onClick={() =>
              onInfo({ title: c.name, price: c.cost > 0 ? `${c.cost} Ko` : "gratuit", lines: c.rulesText.map((r) => r.text) })
            }
            title="Voir le détail"
          >
            {c.name}
          </button>
          <span className="px">{c.cost > 0 ? `+${c.cost} Ko` : "gratuit"}</span>
        </label>
      ))}
      {ameliorations.length === 0 && <p className="fe-mag-bonus">Aucune amélioration disponible.</p>}
    </div>
  );
}

/** Onglet magie : choix du grimoire, compteur de pages, puis sélection des sorts (SpellPanel). */
function MagiePanel({
  profile: p,
  cat,
  upgrades,
  grimoire,
  spells,
  ways,
  onGrimoire,
  onToggleSpell,
  onInfo,
}: {
  profile: Profile;
  cat: Catalog;
  upgrades: string[];
  grimoire: "none" | "petit" | "grand";
  spells: string[];
  ways: string[];
  onGrimoire: (g: "none" | "petit" | "grand") => void;
  onToggleSpell: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
}) {
  const forbiddenGrims = forbiddenGrimoires(p);
  const pages = grimoire === "none" ? 0 : cat.grimoires.find((g) => g.id === grimoire)?.pages;
  const pageCap = (pages === "illimite" ? Infinity : ((pages as number) ?? 0)) + pageBonus(p, cat, upgrades);
  const sources = pageBonusSources(p, cat, upgrades);
  const pagesUsed = spells.reduce((n, id) => n + (cat.spells.find((s) => s.id === id)?.pages ?? 0), 0);
  const warning =
    ways.length === 0
      ? "La figurine ne peut pas lancer de sorts — retire les sorts ci-dessous."
      : pagesUsed > pageCap
        ? `Capacité de pages dépassée (${pagesUsed} / ${pageCap === Infinity ? "∞" : pageCap}) — retire un sort ou prends un grimoire plus grand.`
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
            { value: "petit", label: `Petit +${cat.grimoires.find((x) => x.id === "petit")?.cost ?? 20}`, disabled: forbiddenGrims.has("petit") },
            { value: "grand", label: `Grand +${cat.grimoires.find((x) => x.id === "grand")?.cost ?? 40}`, disabled: forbiddenGrims.has("grand") },
          ]}
        />
        {sources.length > 0 && (
          <span className="fe-mag-bonus">Bonus pages : {sources.map((s) => `+${s.amount} ${s.name}`).join(", ")}</span>
        )}
      </div>
      <SpellPanel profile={p} cat={cat} ways={ways} pageCap={pageCap} selected={spells} onToggle={onToggleSpell} onInfo={onInfo} />
    </div>
  );
}

/** Éditeur d'une figurine en **onglets** (Équipement / Améliorations / Magie), sans sous-modale. */
export function FigureEditor({
  profile: p,
  cat,
  added,
  removed,
  upgrades,
  grimoire,
  spells,
  onAdd,
  onRemove,
  onToggleBase,
  munQty,
  onMun,
  onToggleUpgrade,
  onGrimoire,
  onToggleSpell,
  onInfo,
}: {
  profile: Profile;
  cat: Catalog;
  added: string[];
  removed: string[];
  upgrades: string[];
  grimoire: "none" | "petit" | "grand";
  spells: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleBase: (id: string) => void;
  munQty: (id: string) => number;
  onMun: (id: string, qty: number) => void;
  onToggleUpgrade: (id: string) => void;
  onGrimoire: (g: "none" | "petit" | "grand") => void;
  onToggleSpell: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
}) {
  const activeBase = p.baseEquipmentIds.filter((id) => !removed.includes(id));
  const ways = castWays(p, cat, upgrades, [...activeBase, ...added]);
  const castable = ways.length > 0;
  const ameliorations = specialCardsForProfile(p, cat).filter((c) => c.amelioration);

  const tabs = [
    { id: "carte" as const, label: "Carte" },
    canBuy(p, cat) && { id: "equip" as const, label: "Équipement" },
    ameliorations.length > 0 && { id: "amelio" as const, label: "Améliorations" },
    (castable || spells.length > 0) && { id: "magie" as const, label: "Magie" },
  ].filter(Boolean) as { id: "carte" | "equip" | "amelio" | "magie"; label: string }[];
  const [tab, setTab] = useState<"carte" | "equip" | "amelio" | "magie">("carte");
  const active = tabs.some((t) => t.id === tab) ? tab : "carte";

  return (
    <div className="fe-root">
      {tabs.length > 1 && (
        <div className="fe-tabs">
          {tabs.map((t) => (
            <button key={t.id} className="ui-tab" data-state={active === t.id ? "active" : "inactive"} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {active === "carte" && <ProfileStatCard p={p} cat={cat} onInfo={onInfo} />}
      {active === "equip" && (
        <EquipPanel
          profile={p}
          cat={cat}
          added={added}
          removed={removed}
          onAdd={onAdd}
          onRemove={onRemove}
          onToggleBase={onToggleBase}
          munQty={munQty}
          onMun={onMun}
          onInfo={onInfo}
        />
      )}
      {active === "amelio" && (
        <AmeliorationsPanel profile={p} cat={cat} upgrades={upgrades} onToggleUpgrade={onToggleUpgrade} onInfo={onInfo} />
      )}
      {active === "magie" && (
        <MagiePanel
          profile={p}
          cat={cat}
          upgrades={upgrades}
          grimoire={grimoire}
          spells={spells}
          ways={ways}
          onGrimoire={onGrimoire}
          onToggleSpell={onToggleSpell}
          onInfo={onInfo}
        />
      )}
    </div>
  );
}

/** Choix d'équipement en deux volets : catalogue disponible (gauche) ↔ équipé (droite). */
function EquipPanel({
  profile: p,
  cat,
  added,
  removed,
  onAdd,
  onRemove,
  onToggleBase,
  munQty,
  onMun,
  onInfo,
}: {
  profile: Profile;
  cat: Catalog;
  added: string[];
  removed: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleBase: (id: string) => void;
  munQty: (id: string) => number;
  onMun: (id: string, qty: number) => void;
  onInfo: (info: ItemInfo) => void;
}) {
  const [query, setQuery] = useState("");
  const eq = (id: string) => cat.equipment.find((e) => e.id === id);
  const forbidden = forbiddenCats(p, cat);
  const activeBase = p.baseEquipmentIds.filter((id) => !removed.includes(id));

  const worn = [...activeBase, ...added].map(eq).filter((e): e is NonNullable<typeof e> => Boolean(e));
  const handCap = p.skills.some((s) => s.skillId === "hors-norme") ? Infinity : 2;
  const handsUsed = worn.reduce((n, e) => n + (e.hands ?? 0), 0);
  const armorCap = 1;
  const armorUsed = worn.filter((e) => e.category === "armure").length;
  const canWearArmor = !forbidden.has("armure");

  const blockReason = (e: Catalog["equipment"][number]): string | null => {
    if (e.hands && handsUsed + e.hands > handCap) return "Plus assez de mains libres";
    if (e.category === "armure" && armorUsed >= armorCap) return "Emplacement d'armure déjà occupé";
    return null;
  };

  const q = query.trim().toLowerCase();
  const matches = (e: Catalog["equipment"][number]) => {
    if (q === "") return true;
    const hay = `${e.name} ${CAT_LABEL[e.category] ?? ""} ${e.category}`.toLowerCase();
    return hay.includes(q) || (CAT_LABEL[e.category] ?? "").toLowerCase().includes(q);
  };
  const ownerCount = (id: string) => cat.profiles.filter((pr) => pr.baseEquipmentIds.includes(id)).length;
  const isUnique = (e: Catalog["equipment"][number]) => ownerCount(e.id) === 1;

  const avail = cat.equipment.filter(
    (e) =>
      PURCHASE_CATS.includes(e.category) &&
      !forbidden.has(e.category) &&
      equipReservedOk(e, p) &&
      !(isUnique(e) && !p.baseEquipmentIds.includes(e.id)) &&
      (!p.baseEquipmentIds.includes(e.id) || removed.includes(e.id)) &&
      !added.includes(e.id) &&
      matches(e),
  );
  const UNIQUE = "__unique";
  const groupOf = (e: Catalog["equipment"][number]) => (isUnique(e) ? UNIQUE : e.category);
  const GROUP_LABEL: Record<string, string> = { ...CAT_LABEL, [UNIQUE]: "Équipement propre (retiré)" };
  const byCat = [UNIQUE, ...PURCHASE_CATS]
    .map((g) => [g, avail.filter((e) => groupOf(e) === g)] as [string, typeof avail])
    .filter(([, v]) => v.length > 0);
  const addedCost = added.reduce((n, id) => n + (eq(id)?.cost ?? 0), 0);
  const removedCost = removed.reduce((n, id) => n + (eq(id)?.cost ?? 0), 0);
  const munTotal = worn.reduce((n, e) => n + (e.munition ? munQty(e.id) * e.munition.unitCost : 0), 0);

  const munitionRow = (e: Catalog["equipment"][number]) => {
    if (!e.munition) return null;
    const n = munQty(e.id);
    const m = e.munition;
    return (
      <div className="fe-mun">
        <span className="lab">
          ↳ Munitions ({m.unitCost} Ko/u{m.max != null ? `, max ${m.max}` : ""})
        </span>
        <button className="fe-step" onClick={() => onMun(e.id, n - 1)} disabled={n <= 0}>
          −
        </button>
        <span style={{ width: 18, textAlign: "center", fontWeight: 600, color: "var(--bone)" }}>{n}</span>
        <button className="fe-step" onClick={() => onMun(e.id, n + 1)} disabled={m.max != null && n >= m.max}>
          +
        </button>
        <span style={{ width: 48, textAlign: "right" }}>{n * m.unitCost} Ko</span>
      </div>
    );
  };

  const equipWarning =
    handsUsed > handCap
      ? `Trop d'équipement à mains (${handsUsed} / ${handCap}).`
      : armorUsed > armorCap
        ? "Plusieurs armures équipées."
        : null;

  return (
    <div className="fe-root">
      {equipWarning && <p className="fe-warn">⚠ {equipWarning}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <SlotChip label="Mains" used={handsUsed} cap={handCap} />
        {canWearArmor && <SlotChip label="Armure" used={armorUsed} cap={armorCap} />}
      </div>

      <div className="fe-panes">
        {/* Volet disponible */}
        <div>
          <SectionTitle>Disponible</SectionTitle>
          <input
            className="fe-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un équipement…"
          />
          <div className="fe-scroll">
            {byCat.map(([c, list]) => (
              <div key={c}>
                <p className="fe-group-label">{GROUP_LABEL[c]}</p>
                <div className="fe-col">
                  {list.map((e) => {
                    const blocked = blockReason(e);
                    const isBase = removed.includes(e.id);
                    return (
                      <div key={e.id} className={`fe-item${blocked ? " is-blocked" : ""}`} title={blocked ?? undefined}>
                        <span className="fe-item-main">
                          <button className="fe-item-name" onClick={() => onInfo(equipInfo(e))} title="Voir le détail">
                            {e.name}
                          </button>
                          {isBase && <span className="fe-badge-base">base</span>}
                          {equipBits(e) && <span className="fe-item-bits">{equipBits(e)}</span>}
                        </span>
                        <span className="fe-item-cost">{e.cost > 0 ? `${e.cost} Ko` : "gratuit"}</span>
                        <button
                          className="fe-move add"
                          onClick={() => (isBase ? onToggleBase(e.id) : onAdd(e.id))}
                          disabled={Boolean(blocked)}
                          title={blocked ?? (isBase ? "Remettre l'équipement de base" : "Ajouter")}
                        >
                          →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {byCat.length === 0 && <p className="fe-mag-bonus">{q ? "Aucun résultat." : "Aucun équipement disponible."}</p>}
          </div>
        </div>

        {/* Volet équipé — l'équipement de base reste toujours en tête. */}
        <div>
          <div className="fe-section-head">
            <SectionTitle>Équipé</SectionTitle>
            <span className="tot">
              total <b>{p.cost + addedCost - removedCost + munTotal} Ko</b>
            </span>
          </div>
          <div className="fe-col">
            {p.baseEquipmentIds.map((id) => {
              const e = eq(id);
              if (!e || removed.includes(id)) return null;
              return (
                <div key={id}>
                  <div className="fe-item">
                    <button className="fe-move rem" onClick={() => onToggleBase(id)} title="Retirer (libère l'emplacement)">
                      ←
                    </button>
                    <span className="fe-item-main">
                      <button className="fe-item-name" onClick={() => onInfo(equipInfo(e))} title="Voir le détail">
                        {e.name}
                      </button>
                      <span className="fe-badge-base">base</span>
                    </span>
                    <span className="fe-item-cost">{e.cost > 0 ? `${e.cost} Ko` : "gratuit"}</span>
                  </div>
                  {e.munition && munitionRow(e)}
                </div>
              );
            })}
            {added.map((id) => {
              const e = eq(id);
              return (
                e && (
                  <div key={id}>
                    <div className="fe-item">
                      <button className="fe-move rem" onClick={() => onRemove(id)} title="Retirer">
                        ←
                      </button>
                      <span className="fe-item-main">
                        <button className="fe-item-name" onClick={() => onInfo(equipInfo(e))} title="Voir le détail">
                          {e.name}
                        </button>
                      </span>
                      <span className="fe-item-cost">{e.cost > 0 ? `${e.cost} Ko` : "gratuit"}</span>
                    </div>
                    {e.munition && munitionRow(e)}
                  </div>
                )
              );
            })}
            {activeBase.length === 0 && added.length === 0 && <p className="fe-mag-bonus">Rien d'équipé.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Panneau de sélection des sorts (deux volets, budget de pages) — dans l'esprit du choix d'armes. */
function SpellPanel({
  profile: p,
  cat,
  ways,
  pageCap,
  selected,
  onToggle,
  onInfo,
}: {
  profile: Profile;
  cat: Catalog;
  ways: string[];
  pageCap: number;
  selected: string[];
  onToggle: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
}) {
  const [query, setQuery] = useState("");
  const spellById = (id: string) => cat.spells.find((s) => s.id === id);
  const chosen = selected.map(spellById).filter((s): s is Spell => Boolean(s));
  const pagesUsed = chosen.reduce((n, s) => n + (s.pages ?? 0), 0);
  const q = query.trim().toLowerCase();

  const GENERIC = "Génériques";
  const wayName = (id?: string) => cat.magicWays.find((w) => w.id === id)?.name ?? id ?? "Autres";
  const groupOf = (s: Spell) => (s.kind === "generique" ? GENERIC : wayName(s.magicWayId));
  const avail = spellsFor(p, cat, ways).filter(
    (s) => !selected.includes(s.id) && (q === "" || s.name.toLowerCase().includes(q)),
  );
  const groupNames = [...new Set(avail.map(groupOf))].sort((a, b) =>
    a === GENERIC ? -1 : b === GENERIC ? 1 : a.localeCompare(b),
  );
  const blocked = (s: Spell) => pagesUsed + (s.pages ?? 0) > pageCap;

  return (
    <div className="fe-root">
      <div className="flex flex-wrap items-center gap-2">
        <SlotChip label="Pages" used={pagesUsed} cap={pageCap} />
      </div>

      <div className="fe-panes">
        {/* Volet disponible */}
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
                        <div key={s.id} className={`fe-item${no ? " is-blocked" : ""}`} title={no ? "Pas assez de pages" : undefined}>
                          <span className="fe-item-main">
                            <button className="fe-item-name" onClick={() => onInfo(spellInfo(s, cat))} title="Voir le détail">
                              {s.name}
                            </button>
                            <span className="fe-item-bits">
                              {s.pages ?? 0} p{s.cost ? ` · ${s.cost} Ko` : ""}
                            </span>
                          </span>
                          <button
                            className="fe-move add"
                            onClick={() => onToggle(s.id)}
                            disabled={no}
                            title={no ? "Pas assez de pages" : "Ajouter"}
                          >
                            →
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
            {avail.length === 0 && <p className="fe-mag-bonus">{q ? "Aucun résultat." : "Aucun sort disponible."}</p>}
          </div>
        </div>

        {/* Volet sélectionnés */}
        <div>
          <div className="fe-section-head">
            <SectionTitle>Sélectionnés</SectionTitle>
            <span className="tot">
              pages <b>{pagesUsed}/{pageCap === Infinity ? "∞" : pageCap}</b>
            </span>
          </div>
          <div className="fe-col">
            {chosen.map((s) => (
              <div key={s.id} className="fe-item">
                <button className="fe-move rem" onClick={() => onToggle(s.id)} title="Retirer">
                  ←
                </button>
                <span className="fe-item-main">
                  <button className="fe-item-name" onClick={() => onInfo(spellInfo(s, cat))} title="Voir le détail">
                    {s.name}
                  </button>
                  <span className="fe-item-bits">
                    {s.pages ?? 0} p{s.cost ? ` · ${s.cost} Ko` : ""}
                  </span>
                </span>
              </div>
            ))}
            {chosen.length === 0 && <p className="fe-mag-bonus">Aucun sort.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
