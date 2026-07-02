import { useState } from "react";
import { specialCardsForProfile } from "@ui/explain";
import type { Catalog, Profile, Spell } from "@core";
import { ProfileStatCard } from "./ProfileStatCard";
import { SectionTitle, SlotChip } from "./components";
import {
  CAT_LABEL,
  LEVEL,
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
 * Piloté par des callbacks du store (aucun état de liste local ici).
 */

function AmeliorationsPanel({
  profile: p,
  cat,
  upgrades,
  accent,
  deep,
  onToggleUpgrade,
  onInfo,
}: {
  profile: Profile;
  cat: Catalog;
  upgrades: string[];
  accent: string;
  deep: string;
  onToggleUpgrade: (id: string) => void;
  onInfo: (info: ItemInfo) => void;
}) {
  const ameliorations = specialCardsForProfile(p, cat).filter((c) => c.amelioration);
  return (
    <div className="space-y-1">
      {ameliorations.map((c) => (
        <div key={c.id} className="flex items-center gap-2 rounded bg-white/40 px-2 py-1 text-sm">
          <input
            type="checkbox"
            checked={upgrades.includes(c.id)}
            onChange={() => onToggleUpgrade(c.id)}
            className="accent-current"
            style={{ color: accent }}
          />
          <button
            onClick={() =>
              onInfo({ title: c.name, price: c.cost > 0 ? `${c.cost} Ko` : "gratuit", lines: c.rulesText.map((r) => r.text) })
            }
            title="Voir le détail"
            className="flex-1 text-left font-medium underline decoration-dotted underline-offset-2 transition hover:opacity-70"
            style={{ color: deep }}
          >
            {c.name}
          </button>
          <span className="text-xs opacity-60">{c.cost > 0 ? `+${c.cost} Ko` : "gratuit"}</span>
        </div>
      ))}
      {ameliorations.length === 0 && <p className="text-sm opacity-50">Aucune amélioration disponible.</p>}
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
  accent,
  deep,
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
  accent: string;
  deep: string;
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
    <div className="space-y-3">
      {warning && (
        <p className="rounded-md px-2 py-1.5 text-xs font-medium" style={{ background: "#9a3b2b18", color: "#9a3b2b" }}>
          ⚠ {warning}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md" style={{ boxShadow: `inset 0 0 0 1px ${accent}55` }}>
          {(["none", "petit", "grand"] as const).map((g) => {
            const disabled = forbiddenGrims.has(g);
            const label =
              g === "none"
                ? "Sans grimoire"
                : g === "petit"
                  ? `Petit +${cat.grimoires.find((x) => x.id === "petit")?.cost ?? 20}`
                  : `Grand +${cat.grimoires.find((x) => x.id === "grand")?.cost ?? 40}`;
            return (
              <button
                key={g}
                onClick={() => !disabled && onGrimoire(g)}
                disabled={disabled}
                className="px-3 py-1 text-xs transition disabled:opacity-30"
                style={grimoire === g ? { background: accent, color: "#f5ecd6" } : { color: accent }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {sources.length > 0 && (
          <span className="text-xs opacity-60">
            Bonus pages : {sources.map((s) => `+${s.amount} ${s.name}`).join(", ")}
          </span>
        )}
      </div>
      <SpellPanel
        profile={p}
        cat={cat}
        ways={ways}
        pageCap={pageCap}
        selected={spells}
        accent={accent}
        deep={deep}
        onToggle={onToggleSpell}
        onInfo={onInfo}
      />
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
  accent,
  deep,
  onClose,
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
  accent: string;
  deep: string;
  onClose: () => void;
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
  const eq = (id: string) => cat.equipment.find((e) => e.id === id);
  const activeBase = p.baseEquipmentIds.filter((id) => !removed.includes(id));
  const addedCost = added.reduce((n, id) => n + (eq(id)?.cost ?? 0), 0);
  const removedCost = removed.reduce((n, id) => n + (eq(id)?.cost ?? 0), 0);
  const munTotal = [...activeBase, ...added].reduce((n, id) => {
    const e = eq(id);
    return n + (e?.munition ? munQty(id) * e.munition.unitCost : 0);
  }, 0);
  const upgradeCost = upgrades.reduce((n, id) => n + (cat.specialCards.find((s) => s.id === id)?.cost ?? 0), 0);
  const ways = castWays(p, cat, upgrades, [...activeBase, ...added]);
  const castable = ways.length > 0;
  const ameliorations = specialCardsForProfile(p, cat).filter((c) => c.amelioration);
  const grimoireCost = grimoire === "none" ? 0 : (cat.grimoires.find((g) => g.id === grimoire)?.cost ?? 0);
  const spellCost = spells.reduce((n, id) => n + (cat.spells.find((s) => s.id === id)?.cost ?? 0), 0);
  const magicCost = castable ? grimoireCost + spellCost : 0;
  const total = p.cost + addedCost - removedCost + munTotal + upgradeCost + magicCost;

  const tabs = [
    { id: "carte" as const, label: "Carte" },
    canBuy(p, cat) && { id: "equip" as const, label: "Équipement" },
    ameliorations.length > 0 && { id: "amelio" as const, label: "Améliorations" },
    (castable || spells.length > 0) && { id: "magie" as const, label: "Magie" },
  ].filter(Boolean) as { id: "carte" | "equip" | "amelio" | "magie"; label: string }[];
  const [tab, setTab] = useState<"carte" | "equip" | "amelio" | "magie">("carte");
  const active = tabs.some((t) => t.id === tab) ? tab : "carte";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="kh-display text-xl font-bold" style={{ color: deep }}>
          {p.name} <span className="opacity-50">{LEVEL[p.level ?? 0]}</span>
        </h3>
        <span className="text-sm opacity-60">{total} Ko</span>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b" style={{ borderColor: `${accent}33` }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="kh-display -mb-px border-b-2 px-3 py-1.5 text-sm transition"
              style={active === t.id ? { borderColor: accent, color: deep } : { borderColor: "transparent", color: `${deep}88` }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {active === "carte" && <ProfileStatCard p={p} cat={cat} accent={accent} deep={deep} onInfo={onInfo} />}
      {active === "equip" && (
        <EquipPanel
          profile={p}
          cat={cat}
          added={added}
          removed={removed}
          accent={accent}
          deep={deep}
          onAdd={onAdd}
          onRemove={onRemove}
          onToggleBase={onToggleBase}
          munQty={munQty}
          onMun={onMun}
          onInfo={onInfo}
        />
      )}
      {active === "amelio" && (
        <AmeliorationsPanel
          profile={p}
          cat={cat}
          upgrades={upgrades}
          accent={accent}
          deep={deep}
          onToggleUpgrade={onToggleUpgrade}
          onInfo={onInfo}
        />
      )}
      {active === "magie" && (
        <MagiePanel
          profile={p}
          cat={cat}
          upgrades={upgrades}
          grimoire={grimoire}
          spells={spells}
          ways={ways}
          accent={accent}
          deep={deep}
          onGrimoire={onGrimoire}
          onToggleSpell={onToggleSpell}
          onInfo={onInfo}
        />
      )}

      <div className="flex justify-end gap-2 border-t pt-2" style={{ borderColor: `${accent}22` }}>
        <button onClick={onClose} className="rounded-md px-4 py-1.5 text-sm hover:bg-white/50">
          Fermer
        </button>
      </div>
    </div>
  );
}

/** Indicateur d'emplacement occupé (mains, armure…) : points pleins/vides ou « ∞ ». */

/** Modale de choix d'équipement en deux volets : catalogue disponible (gauche) ↔ équipé (droite). */
function EquipPanel({
  profile: p,
  cat,
  added,
  removed,
  accent,
  deep,
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
  accent: string;
  deep: string;
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

  // Emplacements occupés par l'équipement porté (base non retirée + acheté).
  const worn = [...activeBase, ...added].map(eq).filter((e): e is NonNullable<typeof e> => Boolean(e));
  const handCap = p.skills.some((s) => s.skillId === "hors-norme") ? Infinity : 2;
  const handsUsed = worn.reduce((n, e) => n + (e.hands ?? 0), 0);
  const armorCap = 1;
  const armorUsed = worn.filter((e) => e.category === "armure").length;
  const canWearArmor = !forbidden.has("armure");

  // Raison de non-équipabilité (grisage) : plus de mains, ou emplacement d'armure occupé.
  const blockReason = (e: Catalog["equipment"][number]): string | null => {
    if (e.hands && handsUsed + e.hands > handCap) return "Plus assez de mains libres";
    if (e.category === "armure" && armorUsed >= armorCap) return "Emplacement d'armure déjà occupé";
    return null;
  };

  // Recherche par nom OU mot-clé de catégorie (« corps à corps », « armure », « munitions »…).
  const q = query.trim().toLowerCase();
  const matches = (e: Catalog["equipment"][number]) => {
    if (q === "") return true;
    const hay = `${e.name} ${CAT_LABEL[e.category] ?? ""} ${e.category}`.toLowerCase();
    return hay.includes(q) || (CAT_LABEL[e.category] ?? "").toLowerCase().includes(q);
  };
  // Arme *unique* = portée par une seule figurine (son équipement de base). Elle n'est pas
  // générique : elle n'apparaît que pour sa propre figurine, jamais dans le catalogue des autres.
  const ownerCount = (id: string) => cat.profiles.filter((pr) => pr.baseEquipmentIds.includes(id)).length;
  const isUnique = (e: Catalog["equipment"][number]) => ownerCount(e.id) === 1;

  const avail = cat.equipment.filter(
    (e) =>
      PURCHASE_CATS.includes(e.category) &&
      !forbidden.has(e.category) &&
      equipReservedOk(e, p) && // masque totalement l'équipement non portable (réservations)
      !(isUnique(e) && !p.baseEquipmentIds.includes(e.id)) && // arme unique : réservée à sa figurine
      // équipement de base : n'apparaît à gauche que s'il a été retiré (pour le remettre).
      (!p.baseEquipmentIds.includes(e.id) || removed.includes(e.id)) &&
      !added.includes(e.id) &&
      matches(e),
  );
  // Une base retirée *unique* (portée par une seule figurine) ne rejoint pas « Corps à corps »/
  // « Tir », mais un groupe à part — ce n'est pas un équipement générique disponible à tous.
  const UNIQUE = "__unique";
  const groupOf = (e: Catalog["equipment"][number]) => (isUnique(e) ? UNIQUE : e.category);
  const GROUP_LABEL: Record<string, string> = { ...CAT_LABEL, [UNIQUE]: "Équipement propre (retiré)" };
  const byCat = [UNIQUE, ...PURCHASE_CATS]
    .map((g) => [g, avail.filter((e) => groupOf(e) === g)] as [string, typeof avail])
    .filter(([, v]) => v.length > 0);
  const addedCost = added.reduce((n, id) => n + (eq(id)?.cost ?? 0), 0);
  const removedCost = removed.reduce((n, id) => n + (eq(id)?.cost ?? 0), 0);
  const munTotal = worn.reduce((n, e) => n + (e.munition ? munQty(e.id) * e.munition.unitCost : 0), 0);

  // Sélecteur de munitions affiché sous une arme de tir sans recharge.
  const munitionRow = (e: Catalog["equipment"][number]) => {
    if (!e.munition) return null;
    const n = munQty(e.id);
    const m = e.munition;
    return (
      <div className="ml-4 flex items-center gap-2 rounded bg-white/30 px-2 py-1 text-xs">
        <span className="flex-1 opacity-70">
          ↳ Munitions{" "}
          <span className="opacity-60">
            ({m.unitCost} Ko/u{m.max != null ? `, max ${m.max}` : ""})
          </span>
        </span>
        <button
          onClick={() => onMun(e.id, n - 1)}
          disabled={n <= 0}
          className="h-5 w-5 rounded border text-center leading-none disabled:opacity-30"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          −
        </button>
        <span className="w-5 text-center font-semibold" style={{ color: deep }}>
          {n}
        </span>
        <button
          onClick={() => onMun(e.id, n + 1)}
          disabled={m.max != null && n >= m.max}
          className="h-5 w-5 rounded border text-center leading-none disabled:opacity-30"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          +
        </button>
        <span className="w-12 text-right opacity-60">{n * m.unitCost} Ko</span>
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
    <div className="space-y-3">
      {equipWarning && (
        <p className="rounded-md px-2 py-1.5 text-xs font-medium" style={{ background: "#9a3b2b18", color: "#9a3b2b" }}>
          ⚠ {equipWarning}
        </p>
      )}
      {/* Emplacements occupés */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SlotChip label="Mains" used={handsUsed} cap={handCap} accent={accent} />
        {canWearArmor && <SlotChip label="Armure" used={armorUsed} cap={armorCap} accent={accent} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Volet disponible */}
        <div>
          <SectionTitle accent={accent}>Disponible</SectionTitle>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un équipement…"
            className="mb-2 w-full rounded bg-white/60 px-2 py-1.5 text-sm shadow-inner outline-none"
          />
          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {byCat.map(([c, list]) => (
              <div key={c}>
                <p className="kh-display mb-0.5 text-[11px] uppercase tracking-wide opacity-50" style={{ color: accent }}>
                  {GROUP_LABEL[c]}
                </p>
                <div className="space-y-1">
                  {list.map((e) => {
                    const blocked = blockReason(e);
                    const isBase = removed.includes(e.id); // base retirée : le → la remet.
                    return (
                      <div
                        key={e.id}
                        className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${blocked ? "bg-black/5 opacity-45" : "bg-white/40"}`}
                        title={blocked ?? undefined}
                      >
                        <span className="flex-1">
                          <button
                            onClick={() => onInfo(equipInfo(e))}
                            title="Voir le détail"
                            className="font-medium underline decoration-dotted underline-offset-2 transition hover:opacity-70"
                            style={{ color: deep }}
                          >
                            {e.name}
                          </button>
                          {isBase && (
                            <span className="ml-1 rounded bg-black/10 px-1 text-[10px] uppercase tracking-wide opacity-60">
                              base
                            </span>
                          )}
                          {equipBits(e) && <span className="ml-1 text-[11px] opacity-50">{equipBits(e)}</span>}
                        </span>
                        <span className="text-xs opacity-60">{e.cost > 0 ? `${e.cost} Ko` : "gratuit"}</span>
                        <button
                          onClick={() => (isBase ? onToggleBase(e.id) : onAdd(e.id))}
                          disabled={Boolean(blocked)}
                          title={blocked ?? (isBase ? "Remettre l'équipement de base" : "Ajouter")}
                          className="rounded px-2 py-0.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ background: accent }}
                        >
                          →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {byCat.length === 0 && (
              <p className="text-sm opacity-50">{q ? "Aucun résultat." : "Aucun équipement disponible."}</p>
            )}
          </div>
        </div>

        {/* Volet équipé — l'équipement de base reste toujours en tête. */}
        <div>
          <div className="flex items-baseline justify-between">
            <SectionTitle accent={accent}>Équipé</SectionTitle>
            <span className="text-sm">
              <span className="opacity-60">total </span>
              <span className="font-semibold" style={{ color: deep }}>
                {p.cost + addedCost - removedCost + munTotal} Ko
              </span>
            </span>
          </div>
          <div className="space-y-1">
            {p.baseEquipmentIds.map((id) => {
              const e = eq(id);
              if (!e || removed.includes(id)) return null; // retirée → repart dans « Disponible »
              return (
                <div key={id}>
                  <div className="flex items-center gap-2 rounded bg-black/5 px-2 py-1 text-sm">
                    <button
                      onClick={() => onToggleBase(id)}
                      title="Retirer (baisse le coût, libère l'emplacement)"
                      className="opacity-60 transition hover:text-red-700 hover:opacity-100"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => onInfo(equipInfo(e))}
                      title="Voir le détail"
                      className="flex-1 text-left font-medium underline decoration-dotted underline-offset-2 transition hover:opacity-70"
                      style={{ color: deep }}
                    >
                      {e.name}
                    </button>
                    <span className="rounded bg-black/10 px-1 text-[10px] uppercase tracking-wide opacity-60">base</span>
                    <span className="text-xs opacity-60">{e.cost > 0 ? `${e.cost} Ko` : "gratuit"}</span>
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
                    <div className="flex items-center gap-2 rounded bg-white/50 px-2 py-1 text-sm">
                      <button
                        onClick={() => onRemove(id)}
                        title="Retirer"
                        className="opacity-60 transition hover:text-red-700 hover:opacity-100"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => onInfo(equipInfo(e))}
                        title="Voir le détail"
                        className="flex-1 text-left font-medium underline decoration-dotted underline-offset-2 transition hover:opacity-70"
                        style={{ color: deep }}
                      >
                        {e.name}
                      </button>
                      <span className="text-xs opacity-60">{e.cost > 0 ? `${e.cost} Ko` : "gratuit"}</span>
                    </div>
                    {e.munition && munitionRow(e)}
                  </div>
                )
              );
            })}
            {activeBase.length === 0 && added.length === 0 && (
              <p className="text-sm opacity-50">Rien d'équipé.</p>
            )}
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
  accent,
  deep,
  onToggle,
  onInfo,
}: {
  profile: Profile;
  cat: Catalog;
  ways: string[];
  pageCap: number;
  selected: string[];
  accent: string;
  deep: string;
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SlotChip label="Pages" used={pagesUsed} cap={pageCap} accent={accent} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Volet disponible */}
        <div>
          <SectionTitle accent={accent}>Disponible</SectionTitle>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un sort…"
            className="mb-2 w-full rounded bg-white/60 px-2 py-1.5 text-sm shadow-inner outline-none"
          />
          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {groupNames.map((g) => (
              <div key={g}>
                <p className="kh-display mb-0.5 text-[11px] uppercase tracking-wide opacity-50" style={{ color: accent }}>
                  {g}
                </p>
                <div className="space-y-1">
                  {avail
                    .filter((s) => groupOf(s) === g)
                    .map((s) => {
                      const no = blocked(s);
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${no ? "bg-black/5 opacity-45" : "bg-white/40"}`}
                          title={no ? "Pas assez de pages" : undefined}
                        >
                          <button
                            onClick={() => onInfo(spellInfo(s, cat))}
                            title="Voir le détail"
                            className="flex-1 text-left font-medium underline decoration-dotted underline-offset-2 hover:opacity-70"
                            style={{ color: deep }}
                          >
                            {s.name}
                          </button>
                          <span className="text-[11px] opacity-60">
                            {s.pages ?? 0} p{s.cost ? ` · ${s.cost} Ko` : ""}
                          </span>
                          <button
                            onClick={() => onToggle(s.id)}
                            disabled={no}
                            title={no ? "Pas assez de pages" : "Ajouter"}
                            className="rounded px-2 py-0.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ background: accent }}
                          >
                            →
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
            {avail.length === 0 && (
              <p className="text-sm opacity-50">{q ? "Aucun résultat." : "Aucun sort disponible."}</p>
            )}
          </div>
        </div>

        {/* Volet sélectionnés */}
        <div>
          <div className="flex items-baseline justify-between">
            <SectionTitle accent={accent}>Sélectionnés</SectionTitle>
            <span className="text-sm">
              <span className="opacity-60">pages </span>
              <span className="font-semibold" style={{ color: deep }}>
                {pagesUsed}/{pageCap === Infinity ? "∞" : pageCap}
              </span>
            </span>
          </div>
          <div className="space-y-1">
            {chosen.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded bg-white/50 px-2 py-1 text-sm">
                <button
                  onClick={() => onToggle(s.id)}
                  title="Retirer"
                  className="opacity-60 transition hover:text-red-700 hover:opacity-100"
                >
                  ←
                </button>
                <button
                  onClick={() => onInfo(spellInfo(s, cat))}
                  title="Voir le détail"
                  className="flex-1 text-left font-medium underline decoration-dotted underline-offset-2 hover:opacity-70"
                  style={{ color: deep }}
                >
                  {s.name}
                </button>
                <span className="text-[11px] opacity-60">
                  {s.pages ?? 0} p{s.cost ? ` · ${s.cost} Ko` : ""}
                </span>
              </div>
            ))}
            {chosen.length === 0 && <p className="text-sm opacity-50">Aucun sort.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
