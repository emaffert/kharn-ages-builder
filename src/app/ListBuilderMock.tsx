import { useMemo, useState } from "react";
import { loadCatalog } from "@data";
import { specialCardsForProfile } from "@ui/explain";
import type { Catalog, Profile, Spell } from "@core";

/**
 * Maquette VISUELLE (statique) du constructeur de liste. Flux : écran de sélection de
 * faction → écran de construction (roster + liste) avec barre d'actions ; aperçu de carte
 * et édition d'une figurine en **modales** (adaptées mobile/desktop). Aucune logique métier.
 */

const LEVEL = ["", "I", "II", "III"];
const STATS: [keyof Profile["stats"], string][] = [
  ["v", "V"],
  ["p", "P"],
  ["a", "A"],
  ["c", "C"],
  ["t", "T"],
  ["i", "I"],
];

const FACTIONS = [
  { id: "fangs", name: "Fangs", accent: "#7a4a2b", deep: "#4a2f1c", blurb: "Enfants de Nyx, sorcellerie d'os." },
  { id: "kharns", name: "Khârns", accent: "#2b3a5a", deep: "#16223d", blurb: "La Couronne et ses vassaux." },
  { id: "kherops", name: "Khérops", accent: "#7a2b2b", deep: "#4a1c1c", blurb: "Les soldats de l'Empereur." },
  { id: "guilde-noire", name: "Guilde Noire", accent: "#2f2a26", deep: "#141210", blurb: "Renégats et mercenaires." },
];

const SAMPLE = [
  { id: "fangs-apathee-3", leader: true },
  { id: "fangs-xayin-2" },
  { id: "fangs-goulue-1" },
  { id: "fangs-larbin-1", free: true },
  { id: "fangs-executeur-2" },
];

const isDependent = (p: Profile) => p.modelId === "likan" || p.id === "fangs-muskh-1";

const TRAIT_LABEL: Record<string, string> = { "femelle-fang": "une femelle Fang" };

/** Modèle/figurine exact via lequel se recrute un profil dépendant (Likan → femelle Fang, Muskh → Xayìn). */
function carrierLabel(p: Profile, cat: Catalog): string | null {
  const name = (id?: string) =>
    cat.profiles.find((x) => x.id === id)?.name ?? cat.models.find((m) => m.id === id)?.name;
  // Attachment : porteur désigné par trait ou par identifiants.
  for (const c of p.recruitment as { type: string; params?: Record<string, unknown> }[]) {
    if (c.type !== "attachment") continue;
    const car = c.params?.carrier as { trait?: string; profileIds?: string[]; modelIds?: string[] } | undefined;
    if (car?.trait) return TRAIT_LABEL[car.trait] ?? car.trait;
    const names = [...(car?.profileIds ?? []), ...(car?.modelIds ?? [])].map(name).filter(Boolean);
    if (names.length) return names.join(" / ");
  }
  // requires-present : sur le profil ou porté par une carte spéciale (ex. Muskh via Xayìn).
  const constraints = [...p.recruitment, ...cat.specialCards.flatMap((s) => s.constraints)] as {
    type: string;
    params?: Record<string, unknown>;
  }[];
  for (const c of constraints) {
    if (c.type === "requires-present" && c.params?.subjectProfileId === p.id) {
      const req = name(c.params?.requiredProfileId as string | undefined);
      if (req) return req;
    }
  }
  return null;
}

/** Catégories d'équipement qu'une figurine peut acheter (hors munition/option de monture). */
const PURCHASE_CATS = ["arme-cac", "arme-tir", "bouclier", "armure", "objet"];
const CAT_LABEL: Record<string, string> = {
  "arme-cac": "Corps à corps",
  "arme-tir": "Tir",
  bouclier: "Bouclier",
  armure: "Armure",
  objet: "Objet",
};

/** Catégories d'équipement interdites à une figurine par une contrainte `forbids-equipment`
 *  (portée par son profil ou par une carte la ciblant). */
function forbiddenCats(p: Profile, cat: Catalog): Set<string> {
  const forbidden = new Set<string>();
  const collect = (constraints: { type: string; params?: Record<string, unknown> }[]) => {
    for (const c of constraints) {
      if (c.type !== "forbids-equipment") continue;
      const target = c.params?.profileId as string | undefined;
      if (target && target !== p.id) continue;
      for (const cat of (c.params?.categories as string[] | undefined) ?? []) forbidden.add(cat);
    }
  };
  collect(p.recruitment);
  collect(cat.specialCards.flatMap((s) => s.constraints));
  return forbidden;
}

/** Une figurine peut-elle acheter quelque chose ? Non si toutes les catégories d'achat sont
 *  interdites (ex. Likan, Muskh). */
function canBuy(p: Profile, cat: Catalog): boolean {
  const forbidden = forbiddenCats(p, cat);
  return PURCHASE_CATS.some((c) => !forbidden.has(c));
}

/** Une figurine correspond-elle à la réservation d'un équipement ? (toutes les dimensions fournies). */
function equipReservedOk(e: Catalog["equipment"][number], p: Profile): boolean {
  const r = e.reservedTo;
  if (!r) return true;
  if (r.profileIds && !r.profileIds.includes(p.id)) return false;
  if (r.modelIds && !(p.modelId != null && r.modelIds.includes(p.modelId))) return false;
  if (r.traits && !r.traits.some((t) => p.traits.includes(t))) return false;
  if (r.levels && !(p.level != null && r.levels.includes(p.level))) return false;
  if (r.factionIds && !(p.factionId != null && r.factionIds.includes(p.factionId))) return false;
  return true;
}

// ── Magie ──────────────────────────────────────────────────────────────────────

/** Grimoires que la figurine ne peut pas acquérir (param `forbidGrimoires` d'une contrainte de profil). */
function forbiddenGrimoires(p: Profile): Set<string> {
  const out = new Set<string>();
  for (const c of p.recruitment as { params?: Record<string, unknown> }[]) {
    (c.params?.forbidGrimoires as string[] | undefined)?.forEach((g) => out.add(g));
  }
  return out;
}

/** Voies de magie lançables : inné + octroi par amélioration sélectionnée + par objet porté. */
function castWays(p: Profile, cat: Catalog, selectedUpgrades: string[], wornEquipIds: string[] = p.baseEquipmentIds): string[] {
  const ways = new Set<string>(p.magic?.canCast ? p.magic.magicWayIds : []);
  for (const c of specialCardsForProfile(p, cat)) {
    if (c.grantsCasting && (!c.amelioration || selectedUpgrades.includes(c.id))) {
      c.grantsCasting.magicWayIds.forEach((w) => ways.add(w));
    }
  }
  for (const id of wornEquipIds) {
    cat.equipment.find((e) => e.id === id)?.grantsCasting?.magicWayIds.forEach((w) => ways.add(w));
  }
  return [...ways];
}

/** Sources de pages conférées par les cartes/améliorations applicables (Fille de Nyx +3, Crosse +3…). */
function pageBonusSources(p: Profile, cat: Catalog, selectedUpgrades: string[]): { name: string; amount: number }[] {
  return specialCardsForProfile(p, cat)
    .filter((c) => !c.amelioration || selectedUpgrades.includes(c.id))
    .flatMap((c) =>
      c.effects
        .filter((e) => e.operation.kind === "spell-pages")
        .map((e) => ({ name: c.name, amount: (e.operation as { amount?: number }).amount ?? 0 })),
    )
    .filter((s) => s.amount > 0);
}

function pageBonus(p: Profile, cat: Catalog, selectedUpgrades: string[]): number {
  return pageBonusSources(p, cat, selectedUpgrades).reduce((n, s) => n + s.amount, 0);
}

/** Sorts lançables par la figurine : génériques (tout lanceur) + sorts de ses voies (réservations respectées). */
function spellsFor(p: Profile, cat: Catalog, ways: string[]): Spell[] {
  return cat.spells.filter((s) => {
    if (s.kind === "generique") return true;
    if (s.magicWayId && !ways.includes(s.magicWayId)) return false;
    if (s.reservedTo) {
      const okTrait = s.reservedTo.trait ? p.traits.includes(s.reservedTo.trait) : false;
      const okProfile = s.reservedTo.profileIds?.includes(p.id) ?? false;
      if (!okTrait && !okProfile) return false;
    }
    return true;
  });
}

function spellInfo(s: Spell, cat: Catalog): ItemInfo {
  const way = cat.magicWays.find((w) => w.id === s.magicWayId)?.name;
  return {
    title: s.name,
    price: s.cost != null && s.cost > 0 ? `${s.cost} Ko` : "—",
    lines: [
      `${s.pages ?? 0} page(s)${way ? ` · ${way}` : ""}`,
      `Cible : ${s.target}`,
      ...s.difficulties.map((d) => `${d.threshold}+ : ${d.effectText}`),
    ],
  };
}

/** Ligne de stats compacte d'un équipement pour les listes. */
function equipBits(e: Catalog["equipment"][number]): string {
  const bits: string[] = [];
  if (e.category === "arme-cac") bits.push("CaC");
  if (e.category === "arme-tir") bits.push("Tir");
  if (e.hands) bits.push(`${e.hands}m`);
  if (e.allonge != null) bits.push(`All.${e.allonge}`);
  if (e.range) bits.push(`Port.${e.range.short}/${e.range.long}`);
  if (e.durability != null) bits.push(`Sol.${e.durability}`);
  if (e.perceArmure != null) bits.push(`PA ${e.perceArmure}`);
  return bits.join(" · ");
}

type ModelEntry = { id: string; name: string; profiles: Profile[] };
type Modal =
  | null
  | { kind: "preview"; modelId: string }
  | { kind: "edit"; index: number }
  | { kind: "guard"; index: number };
/** Fiche courte d'un achat (arme, équipement, carte) affichée au clic depuis le résumé. */
type ItemInfo = { title: string; price: string; lines: string[] };

export function ListBuilderMock() {
  const [step, setStep] = useState<"select" | "build">("select");
  const [factionId, setFactionId] = useState("fangs");
  if (step === "select") {
    return (
      <FactionSelect
        onStart={(id) => {
          setFactionId(id);
          setStep("build");
        }}
      />
    );
  }
  return <BuilderScreen factionId={factionId} onNew={() => setStep("select")} />;
}

// ── Écran 1 : sélection de la faction ─────────────────────────────────────────

function FactionSelect({ onStart }: { onStart: (id: string) => void }) {
  return (
    <div className="kh-builder kh-parchment h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm uppercase tracking-[0.3em] opacity-50">Khârn-Âges</p>
        <h1 className="kh-display mt-1 text-4xl font-bold" style={{ color: "#2e2418" }}>
          Nouvelle liste
        </h1>

        <div className="mt-6 flex flex-wrap items-end gap-6 text-sm">
          <label className="flex flex-col gap-1">
            <span className="opacity-60">Format</span>
            <select className="rounded bg-white/60 px-3 py-1.5 shadow-inner">
              <option>Escarmouche (1 Fer de Lance)</option>
              <option>Bataille (Ost)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="opacity-60">Points (Ko)</span>
            <input type="number" defaultValue={300} className="w-28 rounded bg-white/60 px-3 py-1.5 shadow-inner" />
          </label>
        </div>

        <h2 className="kh-display mt-10 text-lg font-semibold opacity-70">Choisissez une faction</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FACTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => onStart(f.id)}
              className="group flex items-center gap-4 rounded-xl border-2 bg-white/40 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: `${f.accent}66` }}
            >
              <span
                className="kh-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow"
                style={{ background: f.accent }}
              >
                {f.name[0]}
              </span>
              <span>
                <span className="kh-display block text-xl font-bold" style={{ color: f.deep }}>
                  {f.name}
                </span>
                <span className="text-sm opacity-60">{f.blurb}</span>
              </span>
              <span className="ml-auto opacity-0 transition group-hover:opacity-60" style={{ color: f.accent }}>
                →
              </span>
            </button>
          ))}
        </div>

        <p className="mt-10 text-sm opacity-60">
          ou <button className="underline">charger une liste existante</button>
        </p>
      </div>
    </div>
  );
}

// ── Écran 2 : construction ────────────────────────────────────────────────────

function BuilderScreen({ factionId, onNew }: { factionId: string; onNew: () => void }) {
  const cat = useMemo(() => loadCatalog(), []);
  const fac = FACTIONS.find((f) => f.id === factionId)!;
  const { accent, deep } = fac;
  const [modal, setModal] = useState<Modal>(null);

  const models: ModelEntry[] = cat.models
    .map((m) => ({
      id: m.id,
      name: m.name,
      profiles: m.profileIds
        .map((id) => cat.profiles.find((p) => p.id === id))
        .filter((p): p is Profile => Boolean(p))
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0)),
    }))
    .filter((m) => m.profiles.length > 0);
  const kindOf = (m: ModelEntry) => {
    const p0 = m.profiles[0];
    if (isDependent(p0)) return "cond";
    if (p0.isNamed || p0.limitation.kind === "U" || p0.limitation.kind === "P") return "perso";
    return "troupe";
  };
  const byName = (a: ModelEntry, b: ModelEntry) => a.name.localeCompare(b.name);
  const personnages = models.filter((m) => kindOf(m) === "perso").sort(byName);
  const troupes = models.filter((m) => kindOf(m) === "troupe").sort(byName);
  const conditionnels = models.filter((m) => kindOf(m) === "cond").sort(byName);

  const items = useMemo(
    () => SAMPLE.map((s) => ({ ...s, p: cat.profiles.find((x) => x.id === s.id)! })).filter((x) => x.p),
    [cat],
  );
  const isChar = (p: Profile) => Boolean(p.isNamed) || p.limitation.kind === "U" || p.limitation.kind === "P";

  // État interactif de la maquette centrale : leader unique, gardes du corps (chaque garde est
  // lié à une Fille de Nyx précise), repli du résumé d'achats, et fiche d'un objet cliqué.
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(items.map((x, i) => (isChar(x.p) ? i : -1)).filter((i) => i >= 0)),
  );
  const toggleExpanded = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const [itemInfo, setItemInfo] = useState<ItemInfo | null>(null);

  // Équipement acheté par figurine (au-delà de l'équipement de base). Piloté par la modale « deux volets ».
  const [equip, setEquip] = useState<Record<number, string[]>>({});
  const addEquip = (i: number, id: string) => setEquip((prev) => ({ ...prev, [i]: [...(prev[i] ?? []), id] }));
  const removeEquip = (i: number, id: string) =>
    setEquip((prev) => ({ ...prev, [i]: (prev[i] ?? []).filter((x) => x !== id) }));
  const eqCost = (id: string) => cat.equipment.find((e) => e.id === id)?.cost ?? 0;
  const equipCost = (i: number) => (equip[i] ?? []).reduce((n, id) => n + eqCost(id), 0);

  // Équipement de base retiré (baisse le coût, libère un emplacement — cf. règles §Équipement).
  const [removedBase, setRemovedBase] = useState<Record<number, string[]>>({});
  const toggleBase = (i: number, id: string) =>
    setRemovedBase((prev) => {
      const cur = prev[i] ?? [];
      return { ...prev, [i]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  const removedBaseCost = (i: number) => (removedBase[i] ?? []).reduce((n, id) => n + eqCost(id), 0);

  // Améliorations choisies (cartes spéciales optionnelles payantes) par figurine.
  const [upgrades, setUpgrades] = useState<Record<number, string[]>>({});
  const toggleUpgrade = (i: number, id: string) =>
    setUpgrades((prev) => {
      const cur = prev[i] ?? [];
      return { ...prev, [i]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  const upgradeCost = (i: number) =>
    (upgrades[i] ?? []).reduce((n, id) => n + (cat.specialCards.find((s) => s.id === id)?.cost ?? 0), 0);

  // Magie : grimoire choisi + sorts sélectionnés par figurine. Comptés seulement si la figurine lance.
  const [grimoire, setGrimoire] = useState<Record<number, "none" | "petit" | "grand">>({});
  const grimoireOf = (i: number) => grimoire[i] ?? "none";
  const [spells, setSpells] = useState<Record<number, string[]>>({});
  const toggleSpell = (i: number, id: string) =>
    setSpells((prev) => {
      const cur = prev[i] ?? [];
      return { ...prev, [i]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  const grimoireCostOf = (choice: string) =>
    choice === "none" ? 0 : (cat.grimoires.find((g) => g.id === choice)?.cost ?? 0);
  const wornEquipOf = (p: Profile, i: number) => [
    ...p.baseEquipmentIds.filter((id) => !(removedBase[i] ?? []).includes(id)),
    ...(equip[i] ?? []),
  ];
  const magicCost = (p: Profile, i: number) => {
    if (castWays(p, cat, upgrades[i] ?? [], wornEquipOf(p, i)).length === 0) return 0; // ne compte que si la figurine lance
    const sCost = (spells[i] ?? []).reduce((n, id) => n + (cat.spells.find((s) => s.id === id)?.cost ?? 0), 0);
    return grimoireCostOf(grimoireOf(i)) + sCost;
  };

  // Munitions par figurine et par arme de tir (quantité). Coût = quantité × coût unitaire.
  const [munitions, setMunitions] = useState<Record<number, Record<string, number>>>({});
  const munQty = (i: number, id: string) => munitions[i]?.[id] ?? 0;
  const setMun = (i: number, id: string, qty: number) =>
    setMunitions((prev) => ({ ...prev, [i]: { ...(prev[i] ?? {}), [id]: Math.max(0, qty) } }));
  // Ne compte que les munitions des armes réellement portées (base non retirée + achetées).
  const munitionCost = (p: Profile, i: number) => {
    const worn = [...p.baseEquipmentIds.filter((id) => !(removedBase[i] ?? []).includes(id)), ...(equip[i] ?? [])];
    return worn.reduce((n, id) => {
      const e = cat.equipment.find((x) => x.id === id);
      return n + (e?.munition ? munQty(i, id) * e.munition.unitCost : 0);
    }, 0);
  };

  // Leader : uniquement un personnage OU l'une des deux figurines les plus chères.
  const topTwo = new Set(
    items
      .map((x, i) => ({ i, c: x.p.cost }))
      .sort((a, b) => b.c - a.c)
      .slice(0, 2)
      .map((o) => o.i),
  );
  const canLead = (p: Profile, i: number) => isChar(p) || topTwo.has(i);
  const [leaderIdx, setLeaderIdx] = useState(() => Math.max(0, items.findIndex((x) => x.leader)));

  // « Garde du corps » : emplacement gratuit offert par une Fille de Nyx (cost-set 0, max 2).
  // Le garde est *lié* à une Fille de Nyx précise (choisie si plusieurs), pour de futures
  // mécaniques où l'unité liée compte. Larbin → gratuit, Djouked → −35 (Broutcha).
  const GUARD_CAP = 2;
  const filles = items.map((x, i) => ({ idx: i, name: x.p.name })).filter((_, i) => items[i].p.traits.includes("fille-de-nyx"));
  const hasModel = (m: string) => items.some((x) => x.p.modelId === m);
  const guardEligible = (p: Profile) =>
    p.modelId === "larbin" ? filles.length > 0 : p.modelId === "djouked" ? hasModel("broutcha") : false;
  const [guards, setGuards] = useState<Record<number, number>>(() => {
    const fdn = items.findIndex((x) => x.p.traits.includes("fille-de-nyx"));
    const g: Record<number, number> = {};
    items.forEach((x, i) => {
      if (x.free && fdn >= 0) g[i] = fdn;
    });
    return g;
  });
  const guardCount = Object.keys(guards).length;
  const setGuard = (i: number, fdnIdx: number) => setGuards((prev) => ({ ...prev, [i]: fdnIdx }));
  const removeGuard = (i: number) =>
    setGuards((prev) => {
      const n = { ...prev };
      delete n[i];
      return n;
    });
  const onGuardClick = (i: number) => {
    if (guards[i] != null) removeGuard(i);
    else if (guardCount < GUARD_CAP) {
      if (filles.length === 1) setGuard(i, filles[0].idx);
      else setModal({ kind: "guard", index: i });
    }
  };
  const baseCostOf = (p: Profile, i: number) =>
    guards[i] == null ? p.cost : p.modelId === "djouked" ? Math.max(0, p.cost - 35) : 0;
  const costOf = (p: Profile, i: number) =>
    baseCostOf(p, i) + equipCost(i) - removedBaseCost(i) + munitionCost(p, i) + upgradeCost(i) + magicCost(p, i);

  const total = items.reduce((n, x, i) => n + costOf(x.p, i), 0);
  const limit = 300;
  const ratio = Math.min(100, (total / limit) * 100);

  // Capacité de pages d'une figurine (grimoire + bonus de cartes).
  const pageCapOf = (p: Profile, i: number) => {
    const g = grimoireOf(i);
    const pages = g === "none" ? 0 : cat.grimoires.find((x) => x.id === g)?.pages;
    const base = pages === "illimite" ? Infinity : ((pages as number) ?? 0);
    return base + pageBonus(p, cat, upgrades[i] ?? []);
  };

  // Validation par figurine : capacité de pages dépassée, sorts sans lanceur, mains/armure en trop.
  const figureIssues = (p: Profile, i: number): string[] => {
    const issues: string[] = [];
    const sel = spells[i] ?? [];
    if (sel.length > 0) {
      const ways = castWays(p, cat, upgrades[i] ?? [], wornEquipOf(p, i));
      if (ways.length === 0) {
        issues.push("Sorts sélectionnés mais la figurine ne peut plus lancer de sorts.");
      } else {
        const cap = pageCapOf(p, i);
        const used = sel.reduce((n, id) => n + (cat.spells.find((s) => s.id === id)?.pages ?? 0), 0);
        if (used > cap) issues.push(`Pages de sorts : ${used} / ${cap === Infinity ? "∞" : cap} — capacité dépassée.`);
      }
    }
    const worn = wornEquipOf(p, i)
      .map((id) => cat.equipment.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    const handCap = p.skills.some((s) => s.skillId === "hors-norme") ? Infinity : 2;
    const handsUsed = worn.reduce((n, e) => n + (e.hands ?? 0), 0);
    if (handsUsed > handCap) issues.push(`Mains : ${handsUsed} / ${handCap} — trop d'équipement à mains.`);
    if (worn.filter((e) => e.category === "armure").length > 1) issues.push("Plusieurs armures équipées.");
    return issues;
  };
  const issuesByItem = items.map((x, i) => figureIssues(x.p, i));
  const invalidCount = issuesByItem.filter((is) => is.length > 0).length;

  const modalModel = modal?.kind === "preview" ? models.find((m) => m.id === modal.modelId) : undefined;
  const editProfile = modal?.kind === "edit" ? items[modal.index]?.p : undefined;

  return (
    <div className="kh-builder kh-parchment flex h-full flex-col">
      {/* Barre d'actions */}
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: accent, background: `${accent}12` }}>
        <button onClick={onNew} className="rounded px-2 py-1 text-sm hover:bg-white/50" title="Créer une nouvelle liste">
          ← Nouvelle liste
        </button>
        <span className="h-5 w-px" style={{ background: `${accent}44` }} />
        <input
          defaultValue="Tanière de Nyx"
          className="kh-display rounded bg-transparent px-1 text-lg font-semibold outline-none"
          style={{ color: deep }}
        />
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: accent }}>
          {fac.name}
        </span>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm">
              <span className="kh-display font-bold" style={{ color: deep }}>
                {total}
              </span>
              <span className="opacity-60"> / {limit} Ko</span>
            </div>
            <div className="mt-0.5 h-1.5 w-32 overflow-hidden rounded-full" style={{ background: `${accent}22` }}>
              <div className="h-full rounded-full" style={{ width: `${ratio}%`, background: accent }} />
            </div>
          </div>
          <ActionBtn accent={accent}>Importer</ActionBtn>
          <ActionBtn accent={accent}>Exporter</ActionBtn>
          <ActionBtn accent={accent} primary>
            Sauvegarder
          </ActionBtn>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Roster */}
        <aside className="kh-panel hidden w-72 shrink-0 flex-col border-r md:flex" style={{ borderColor: `${accent}44` }}>
          <div className="border-b px-3 py-2.5" style={{ borderColor: `${accent}33` }}>
            <input
              placeholder="Rechercher un profil…"
              className="w-full rounded bg-white/60 px-2 py-1.5 text-sm outline-none shadow-inner"
            />
            <p className="kh-display mt-2 text-sm font-semibold" style={{ color: deep }}>
              Roster · {fac.name}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <RosterGroup label="Personnages" items={personnages} onOpen={(id) => setModal({ kind: "preview", modelId: id })} />
            <RosterGroup label="Troupes" items={troupes} onOpen={(id) => setModal({ kind: "preview", modelId: id })} />
            <RosterGroup
              label="Recrutement conditionnel"
              hint="se recrutent via un porteur dans la liste"
              items={conditionnels}
              onOpen={(id) => setModal({ kind: "preview", modelId: id })}
              conditional
            />
          </div>
        </aside>

        {/* Liste */}
        <section className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-2">
            <button
              className="mb-2 rounded-md px-3 py-1.5 text-sm font-medium text-white shadow md:hidden"
              style={{ background: accent }}
            >
              + ajouter depuis le roster
            </button>
            {items.map((x, i) => {
              const buyable = canBuy(x.p, cat); // faux si forbids-equipment bloque tout (Likan/Muskh).
              const isLeader = i === leaderIdx;
              const guarded = guards[i] != null;
              const eligible = guardEligible(x.p);
              const free = guarded && x.p.modelId !== "djouked";
              const open = expanded.has(i);
              const leadable = canLead(x.p, i);
              const hasActions = x.p.traits.includes("femelle-fang") || x.p.id === "fangs-xayin-2" || eligible;
              return (
                <div
                  key={i}
                  className="rounded-md border-l-4 bg-white/45 shadow-sm transition hover:bg-white/60"
                  style={{ borderLeftColor: isLeader ? accent : "transparent" }}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {buyable ? (
                      <button
                        onClick={() => toggleExpanded(i)}
                        title={open ? "Replier le résumé" : "Déplier le résumé des achats"}
                        className="w-4 text-center opacity-60 transition hover:opacity-100"
                        style={{ color: accent }}
                      >
                        {open ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="w-4 cursor-grab text-center opacity-40">⠿</span>
                    )}
                    <button
                      onClick={() => setModal({ kind: "edit", index: i })}
                      className="flex flex-1 items-center text-left"
                    >
                      <span className="flex-1">
                        <span className="font-semibold" style={{ color: deep }}>
                          {x.p.name}
                        </span>
                        {x.p.level && <span className="ml-1 opacity-50">{LEVEL[x.p.level]}</span>}
                        {issuesByItem[i].length > 0 && (
                          <span className="ml-2" style={{ color: "#9a3b2b" }} title={issuesByItem[i].join("\n")}>
                            ⚠
                          </span>
                        )}
                        {guarded && (
                          <span className="kh-display ml-2 text-[10px] uppercase tracking-wide" style={{ color: "#4a6b32" }}>
                            Garde du corps de {items[guards[i]]?.p.name}
                          </span>
                        )}
                      </span>
                    </button>
                    {isLeader ? (
                      <span
                        className="kh-display rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                        style={{ background: accent }}
                      >
                        ❖ Leader
                      </span>
                    ) : (
                      leadable && (
                        <button
                          onClick={() => setLeaderIdx(i)}
                          title="Promouvoir en Leader"
                          className="rounded-full border px-2.5 py-1 text-xs transition hover:bg-white/60"
                          style={{ borderColor: `${accent}66`, color: accent }}
                        >
                          Définir leader
                        </button>
                      )
                    )}
                    <span className={`w-16 text-right text-sm ${free ? "font-semibold" : ""}`} style={{ color: free ? "#4a6b32" : deep }}>
                      {free ? "gratuit" : `${costOf(x.p, i)} Ko`}
                    </span>
                    <button className="opacity-40 transition hover:text-red-700 hover:opacity-100" title="Retirer">
                      ✕
                    </button>
                  </div>
                  {hasActions && (
                    <div className="flex flex-wrap gap-2 px-3 pb-2.5 pl-9">
                      {x.p.traits.includes("femelle-fang") && <RecruitPill label="+ Likan" accent={accent} />}
                      {x.p.id === "fangs-xayin-2" && <RecruitPill label="+ Muskh" accent={accent} />}
                      {eligible && (
                        <button
                          onClick={() => onGuardClick(i)}
                          disabled={!guarded && guardCount >= GUARD_CAP}
                          title={
                            x.p.modelId === "djouked"
                              ? "Garde rapproché de Broutcha (−35 Ko)"
                              : "Garde du corps d'une Fille de Nyx (gratuit)"
                          }
                          className="rounded-full border px-2 py-0.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40"
                          style={
                            guarded
                              ? { background: "#4a6b3218", borderColor: "#4a6b3255", color: "#3c5a28" }
                              : { borderColor: `${accent}55`, color: accent }
                          }
                        >
                          {guarded ? "✓ Garde du corps — retirer" : "Garde du corps"}
                        </button>
                      )}
                    </div>
                  )}
                  {buyable && open && (
                    <PurchaseSummary
                      p={x.p}
                      cat={cat}
                      accent={accent}
                      added={equip[i] ?? []}
                      removed={removedBase[i] ?? []}
                      issues={issuesByItem[i]}
                      onPick={setItemInfo}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Barre de validation */}
      <footer className="flex items-center gap-4 border-t px-4 py-2 text-sm" style={{ borderColor: accent, background: `${accent}12` }}>
        {invalidCount === 0 ? (
          <span className="rounded px-2 py-0.5 font-medium" style={{ background: "#4a6b3222", color: "#3c5a28" }}>
            ✓ Liste valide
          </span>
        ) : (
          <span className="rounded px-2 py-0.5 font-medium" style={{ background: "#9a3b2b22", color: "#9a3b2b" }}>
            ⚠ {invalidCount} figurine{invalidCount > 1 ? "s" : ""} en erreur
          </span>
        )}
        <span className="opacity-60">{items.length} figurines · Muskh et Likans se recrutent via leur porteur.</span>
      </footer>

      {/* Modale : aperçu ou édition */}
      {modal?.kind === "preview" && modalModel && (
        <Overlay onClose={() => setModal(null)}>
          <CardPreview profiles={modalModel.profiles} cat={cat} accent={accent} deep={deep} onClose={() => setModal(null)} />
        </Overlay>
      )}
      {modal?.kind === "edit" && editProfile && (
        <Overlay onClose={() => setModal(null)}>
          <FigureEditor
            profile={editProfile}
            cat={cat}
            added={equip[modal.index] ?? []}
            removed={removedBase[modal.index] ?? []}
            upgrades={upgrades[modal.index] ?? []}
            grimoire={grimoireOf(modal.index)}
            spells={spells[modal.index] ?? []}
            accent={accent}
            deep={deep}
            onClose={() => setModal(null)}
            onAdd={(id) => addEquip(modal.index, id)}
            onRemove={(id) => removeEquip(modal.index, id)}
            onToggleBase={(id) => toggleBase(modal.index, id)}
            munQty={(id) => munQty(modal.index, id)}
            onMun={(id, qty) => setMun(modal.index, id, qty)}
            onToggleUpgrade={(id) => toggleUpgrade(modal.index, id)}
            onGrimoire={(g) => setGrimoire((prev) => ({ ...prev, [modal.index]: g }))}
            onToggleSpell={(id) => toggleSpell(modal.index, id)}
            onInfo={setItemInfo}
          />
        </Overlay>
      )}
      {modal?.kind === "guard" && (
        <Overlay onClose={() => setModal(null)}>
          <div className="space-y-3">
            <h3 className="kh-display text-lg font-bold" style={{ color: deep }}>
              Garde du corps de quelle Fille de Nyx ?
            </h3>
            <p className="text-sm opacity-70">
              {items[modal.index]?.p.name} devient gratuit et reste lié à la Fille de Nyx choisie.
            </p>
            <div className="flex flex-col gap-1.5">
              {filles.map((f) => (
                <button
                  key={f.idx}
                  onClick={() => {
                    setGuard(modal.index, f.idx);
                    setModal(null);
                  }}
                  className="rounded-md border px-3 py-2 text-left text-sm transition hover:bg-white/60"
                  style={{ borderColor: `${accent}44`, color: deep }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </Overlay>
      )}
      {itemInfo && (
        <Overlay onClose={() => setItemInfo(null)}>
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="kh-display text-lg font-bold leading-tight" style={{ color: deep }}>
                {itemInfo.title}
              </h3>
              <span className="rounded px-2 py-0.5 text-sm font-semibold text-white" style={{ background: accent }}>
                {itemInfo.price}
              </span>
            </div>
            {itemInfo.lines.map((l, k) => (
              <p key={k} className="text-sm leading-snug">
                {l}
              </p>
            ))}
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function ActionBtn({ children, accent, primary }: { children: React.ReactNode; accent: string; primary?: boolean }) {
  return (
    <button
      className="rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition hover:brightness-105"
      style={primary ? { background: accent, color: "#f5ecd6" } : { boxShadow: `inset 0 0 0 1px ${accent}66`, color: accent }}
    >
      {children}
    </button>
  );
}

function RosterGroup({
  label,
  hint,
  items,
  onOpen,
  conditional,
}: {
  label: string;
  hint?: string;
  items: ModelEntry[];
  onOpen: (id: string) => void;
  conditional?: boolean;
}) {
  return (
    <div className="mb-3">
      <p className="kh-display px-2 text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      {hint && <p className="px-2 pb-1 text-[10px] italic opacity-50">{hint}</p>}
      <ul>
        {items.map((m) => {
          const first = m.profiles[0];
          const last = m.profiles[m.profiles.length - 1];
          const multi = m.profiles.length > 1;
          const minCost = Math.min(...m.profiles.map((p) => p.cost));
          return (
            <li key={m.id}>
              <button
                onClick={() => onOpen(m.id)}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-white/60"
              >
                <span className={conditional ? "opacity-70" : ""}>
                  {m.name}
                  {multi ? (
                    <span className="ml-1.5 text-xs opacity-40">
                      {LEVEL[first.level ?? 0]}–{LEVEL[last.level ?? 0]}
                    </span>
                  ) : (
                    first.level && <span className="ml-1 opacity-40">{LEVEL[first.level]}</span>
                  )}
                </span>
                <span className="text-xs opacity-70">
                  {conditional ? "🔗" : multi ? `${minCost}+` : `${first.cost}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecruitPill({ label, accent }: { label: string; accent: string }) {
  return (
    <button
      className="rounded-full border px-2 py-0.5 text-xs transition hover:bg-white/60"
      style={{ borderColor: `${accent}66`, color: accent }}
    >
      {label}
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
      onClick={onClose}
    >
      <div
        className="kh-builder kh-parchment max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl p-6 shadow-2xl sm:w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-medium uppercase tracking-wide"
      style={{ background: `${accent}1a`, color: accent }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <h4
      className="kh-display mb-1.5 border-b pb-1 text-xs font-semibold uppercase tracking-wider"
      style={{ borderColor: `${accent}33`, color: accent }}
    >
      {children}
    </h4>
  );
}

type SummaryChip = { name: string; info: ItemInfo };

function equipInfo(e: Catalog["equipment"][number]): ItemInfo {
  return {
    title: e.name,
    price: e.isFree || e.cost === 0 ? "gratuit" : `${e.cost} Ko`,
    lines: [equipBits(e), e.effectsText].filter(Boolean),
  };
}

/** Résumé compact des « achats » d'une figurine ; chaque objet ouvre sa fiche (description + prix). */
function PurchaseSummary({
  p,
  cat,
  accent,
  added,
  removed,
  issues,
  onPick,
}: {
  p: Profile;
  cat: Catalog;
  accent: string;
  added: string[];
  removed: string[];
  issues: string[];
  onPick: (info: ItemInfo) => void;
}) {
  const WEAPON_CATS = ["arme-cac", "arme-tir", "bouclier", "armure"];
  const equip = [...p.baseEquipmentIds.filter((id) => !removed.includes(id)), ...added]
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const chip = (name: string, info: ItemInfo): SummaryChip => ({ name, info });
  const armes = equip.filter((e) => WEAPON_CATS.includes(e.category)).map((e) => chip(e.name, equipInfo(e)));
  const objets = equip.filter((e) => !WEAPON_CATS.includes(e.category)).map((e) => chip(e.name, equipInfo(e)));
  const cartes = specialCardsForProfile(p, cat).map((c) =>
    chip(c.name, {
      title: c.name,
      price: c.cost > 0 ? `${c.cost} Ko` : "auto",
      lines: c.rulesText.map((r) => r.text),
    }),
  );
  const magie = p.magic?.canCast
    ? p.magic.magicWayIds.map((id) => {
        const w = cat.magicWays.find((mw) => mw.id === id);
        return chip(w?.name ?? id, { title: w?.name ?? id, price: "voie", lines: [w?.castingBonusText ?? ""] });
      })
    : [];
  const rows: [string, SummaryChip[]][] = [
    ["Armes", armes],
    ["Équip.", objets],
    ["Cartes", cartes],
    ["Magie", magie],
  ];
  const shown = rows.filter(([, v]) => v.length > 0);
  return (
    <div className="border-t px-3 py-2 pl-9 text-xs" style={{ borderColor: `${accent}22` }}>
      {issues.length > 0 && (
        <ul className="mb-1.5 space-y-0.5" style={{ color: "#9a3b2b" }}>
          {issues.map((m, k) => (
            <li key={k}>⚠ {m}</li>
          ))}
        </ul>
      )}
      {shown.length === 0 ? (
        <span className="opacity-50">Aucun achat pour l'instant.</span>
      ) : (
        <div className="flex flex-col gap-1">
          {shown.map(([label, vals]) => (
            <div key={label} className="flex gap-2">
              <span className="kh-display w-14 shrink-0 pt-0.5 uppercase tracking-wide opacity-50" style={{ color: accent }}>
                {label}
              </span>
              <span className="flex flex-wrap gap-1">
                {vals.map((v, k) => (
                  <button
                    key={k}
                    onClick={() => onPick(v.info)}
                    className="rounded bg-black/5 px-1.5 py-0.5 transition hover:bg-black/15"
                    title="Voir la fiche et le prix"
                  >
                    {v.name}
                    <span className="ml-1 opacity-50">{v.info.price}</span>
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardPreview({
  profiles,
  cat,
  accent,
  deep,
  onClose,
}: {
  profiles: Profile[];
  cat: Catalog;
  accent: string;
  deep: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const p = profiles[idx];
  const cards = specialCardsForProfile(p, cat);
  const dependent = isDependent(p);
  const carrier = carrierLabel(p, cat);
  const precisions = p.skills.filter((s) => s.precision);
  const [info, setInfo] = useState<{ title: string; text: string } | null>(null);
  const showSkill = (skillId: string, label: string) => {
    const sk = cat.skills.find((x) => x.id === skillId);
    setInfo({ title: label, text: sk?.sourceText ?? "Description indisponible." });
  };
  const limLabel =
    p.limitation.kind === "special"
      ? "Limitation •"
      : `Limitation ${p.limitation.kind}${p.limitation.value != null ? ` ${p.limitation.value}` : ""}`;
  return (
    <div className="space-y-4">
      {profiles.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-60">Niveau</span>
          <div className="inline-flex overflow-hidden rounded-md" style={{ boxShadow: `inset 0 0 0 1px ${accent}66` }}>
            {profiles.map((pf, i) => (
              <button
                key={pf.id}
                onClick={() => {
                  setIdx(i);
                  setInfo(null);
                }}
                className="px-3 py-1 text-sm transition"
                style={i === idx ? { background: accent, color: "#f5ecd6" } : { color: accent }}
              >
                {LEVEL[pf.level ?? 0]} · {pf.cost}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-[1fr_240px]">
      <div className="rounded-lg border-2 bg-white/40 p-4" style={{ borderColor: accent }}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="kh-display text-2xl font-bold leading-tight" style={{ color: deep }}>
            {p.name}
            {p.level && <span className="ml-2 text-lg opacity-60">{LEVEL[p.level]}</span>}
          </h3>
          <span className="rounded px-2 py-0.5 text-sm font-semibold text-white" style={{ background: accent }}>
            {p.cost} Ko
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          <Tag accent={accent}>{limLabel}</Tag>
          {p.magic?.canCast && <Tag accent={accent}>Mage</Tag>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {STATS.map(([k, label]) => (
            <span key={label} className="rounded bg-black/5 px-2 py-1 text-sm">
              <span className="opacity-50">{label} </span>
              <span className="font-semibold">{p.stats[k] ?? "—"}</span>
            </span>
          ))}
          <span className="rounded bg-black/5 px-2 py-1 text-sm">
            <span className="opacity-50">PA </span>
            <span className="font-semibold">{p.pa}</span>
          </span>
          <span className="rounded bg-black/5 px-2 py-1 text-sm">
            <span className="opacity-50">PV </span>
            <span className="font-semibold">{p.pv}</span>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {p.skills.map((s, i) => {
            const sk = cat.skills.find((x) => x.id === s.skillId);
            const label = `${sk?.keyword ?? s.skillId}${s.value != null ? ` ${s.value}` : ""}`;
            return (
              <button
                key={i}
                onClick={() => showSkill(s.skillId, label)}
                className="rounded-full bg-black/5 px-2 py-0.5 text-xs transition hover:bg-black/10"
                style={{ boxShadow: `inset 0 0 0 1px ${accent}33` }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(p.rules.length > 0 || precisions.length > 0) && (
          <ul className="mt-3 space-y-1 text-sm">
            {p.rules.map((r, i) => (
              <li key={i}>
                {r.label && (
                  <span className="font-semibold" style={{ color: deep }}>
                    {r.label} :{" "}
                  </span>
                )}
                {r.text}
              </li>
            ))}
            {precisions.map((s, i) => {
              const kw = cat.skills.find((x) => x.id === s.skillId)?.keyword ?? s.skillId;
              return (
                <li key={`prec-${i}`}>
                  <button
                    onClick={() => showSkill(s.skillId, kw)}
                    className="font-semibold underline decoration-dotted underline-offset-2 transition hover:opacity-70"
                    style={{ color: deep }}
                  >
                    {kw}
                  </button>{" "}
                  : {s.precision}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {cards.length > 0 && (
          <div>
            <SectionTitle accent={accent}>Cartes liées</SectionTitle>
            <ul className="space-y-1 text-sm">
              {cards.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() =>
                      setInfo({ title: c.name, text: c.rulesText.map((r) => r.text).join(" ") || "—" })
                    }
                    className="flex w-full justify-between rounded bg-white/40 px-2 py-1 text-left transition hover:bg-white/70"
                  >
                    <span>{c.name}</span>
                    <span className="opacity-60">{c.cost > 0 ? `${c.cost} Ko` : "auto"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2">
          {dependent ? (
            <p className="rounded-md bg-black/5 px-3 py-2 text-xs italic opacity-70">
              Se recrute via {carrier ?? "un porteur"}, pas directement.
            </p>
          ) : (
            <button
              className="rounded-md py-2 text-sm font-semibold text-white shadow transition hover:brightness-110"
              style={{ background: accent }}
            >
              Ajouter à la liste
            </button>
          )}
          <button onClick={onClose} className="rounded-md py-2 text-sm hover:bg-white/50">
            Fermer
          </button>
        </div>
      </div>
      </div>
      {info && (
        <div className="rounded-lg border-l-4 bg-white/50 p-3" style={{ borderColor: accent }}>
          <div className="flex items-start justify-between gap-2">
            <span className="kh-display font-semibold" style={{ color: deep }}>
              {info.title}
            </span>
            <button onClick={() => setInfo(null)} className="text-sm opacity-50 hover:opacity-100">
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm leading-snug">{info.text}</p>
        </div>
      )}
    </div>
  );
}

/** Liste à cocher des améliorations disponibles (cartes spéciales optionnelles). */
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
function FigureEditor({
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
    canBuy(p, cat) && { id: "equip" as const, label: "Équipement" },
    ameliorations.length > 0 && { id: "amelio" as const, label: "Améliorations" },
    (castable || spells.length > 0) && { id: "magie" as const, label: "Magie" },
  ].filter(Boolean) as { id: "equip" | "amelio" | "magie"; label: string }[];
  const [tab, setTab] = useState<"equip" | "amelio" | "magie">(tabs[0]?.id ?? "equip");
  const active = tabs.some((t) => t.id === tab) ? tab : (tabs[0]?.id ?? "equip");

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
function SlotChip({ label, used, cap, accent }: { label: string; used: number; cap: number; accent: string }) {
  const full = Number.isFinite(cap) && used >= cap;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{ background: `${accent}14`, color: full ? "#9a3b2b" : accent }}
    >
      <span className="kh-display uppercase tracking-wide opacity-70">{label}</span>
      {Number.isFinite(cap) ? (
        <>
          <span className="tracking-tight">
            {Array.from({ length: cap }, (_, k) => (k < used ? "●" : "○")).join("")}
          </span>
          <span className="opacity-70">
            {used}/{cap}
          </span>
        </>
      ) : (
        <span className="opacity-70">{used} · ∞</span>
      )}
    </span>
  );
}

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
