import { useMemo, useState } from "react";
import { loadCatalog } from "@data";
import { specialCardsForProfile } from "@ui/explain";
import type { Catalog, Profile } from "@core";

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

/** Une figurine peut-elle acheter quelque chose ? Non si une contrainte `forbids-equipment`
 *  (sur son profil ou une carte la ciblant) bloque toutes les catégories d'achat (ex. Likan, Muskh). */
function canBuy(p: Profile, cat: Catalog): boolean {
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
  return PURCHASE_CATS.some((c) => !forbidden.has(c));
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
  const costOf = (p: Profile, i: number) =>
    guards[i] == null ? p.cost : p.modelId === "djouked" ? Math.max(0, p.cost - 35) : 0;

  const total = items.reduce((n, x, i) => n + costOf(x.p, i), 0);
  const limit = 300;
  const ratio = Math.min(100, (total / limit) * 100);

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
                  {buyable && open && <PurchaseSummary p={x.p} cat={cat} accent={accent} onPick={setItemInfo} />}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Barre de validation */}
      <footer className="flex items-center gap-4 border-t px-4 py-2 text-sm" style={{ borderColor: accent, background: `${accent}12` }}>
        <span className="rounded px-2 py-0.5 font-medium" style={{ background: "#4a6b3222", color: "#3c5a28" }}>
          ✓ Liste valide
        </span>
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
          <EditDrawer profile={editProfile} accent={accent} deep={deep} onClose={() => setModal(null)} />
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
  const bits: string[] = [];
  if (e.category === "arme-cac") bits.push("Corps à corps");
  if (e.category === "arme-tir") bits.push("Tir");
  if (e.hands) bits.push(`${e.hands} main${e.hands > 1 ? "s" : ""}`);
  if (e.allonge != null) bits.push(`Allonge ${e.allonge}`);
  if (e.range) bits.push(`Portée ${e.range.short}/${e.range.long}`);
  if (e.durability != null) bits.push(`Solidité ${e.durability}`);
  if (e.perceArmure != null) bits.push(`Perce-armure ${e.perceArmure}`);
  return {
    title: e.name,
    price: e.isFree || e.cost === 0 ? "gratuit" : `${e.cost} Ko`,
    lines: [bits.join(" · "), e.effectsText].filter(Boolean),
  };
}

/** Résumé compact des « achats » d'une figurine ; chaque objet ouvre sa fiche (description + prix). */
function PurchaseSummary({
  p,
  cat,
  accent,
  onPick,
}: {
  p: Profile;
  cat: Catalog;
  accent: string;
  onPick: (info: ItemInfo) => void;
}) {
  const WEAPON_CATS = ["arme-cac", "arme-tir", "bouclier", "armure"];
  const equip = p.baseEquipmentIds
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

function EditDrawer({
  profile: p,
  accent,
  deep,
  onClose,
}: {
  profile: Profile;
  accent: string;
  deep: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="kh-display text-xl font-bold" style={{ color: deep }}>
          {p.name} <span className="opacity-50">{LEVEL[p.level ?? 0]}</span>
        </h3>
        <span className="text-sm opacity-60">{p.cost} Ko</span>
      </div>

      <div>
        <SectionTitle accent={accent}>Équipement</SectionTitle>
        <div className="flex items-center justify-between rounded bg-white/40 px-2 py-1 text-sm">
          <span>Couteau (base)</span>
          <button className="text-xs opacity-60 hover:text-red-700 hover:opacity-100">retirer</button>
        </div>
        <AddRow label="+ ajouter une arme" accent={accent} />
      </div>

      <div>
        <SectionTitle accent={accent}>Amélioration</SectionTitle>
        <select className="w-full rounded bg-white/60 px-2 py-1 text-sm shadow-inner">
          <option>— aucune —</option>
          <option>Apprentie de Nyx (+15 Ko)</option>
        </select>
      </div>

      <div>
        <SectionTitle accent={accent}>Magie</SectionTitle>
        <select className="mb-2 w-full rounded bg-white/60 px-2 py-1 text-sm shadow-inner">
          <option>Sans grimoire</option>
          <option>Petit grimoire (+20 Ko · 5 pages)</option>
          <option>Grand grimoire (+40 Ko · ∞)</option>
        </select>
        <p className="mb-1 text-xs opacity-60">Sorts (0 / 5 pages)</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" /> Séduction du Fiel <span className="opacity-50">2 p · 10 Ko</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-md px-4 py-1.5 text-sm hover:bg-white/50">
          Fermer
        </button>
      </div>
    </div>
  );
}

function AddRow({ label, accent }: { label: string; accent: string }) {
  return (
    <button
      className="mt-1 w-full rounded border-2 border-dashed px-2 py-1 text-xs transition hover:bg-white/40"
      style={{ borderColor: `${accent}55`, color: accent }}
    >
      {label}
    </button>
  );
}
