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

type Modal = null | { kind: "preview"; profileId: string } | { kind: "edit"; index: number };

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

  const byName = (a: Profile, b: Profile) => a.name.localeCompare(b.name);
  const personnages = cat.profiles.filter((p) => p.isNamed && !isDependent(p)).sort(byName);
  const troupes = cat.profiles.filter((p) => !p.isNamed && !isDependent(p)).sort(byName);
  const conditionnels = cat.profiles.filter(isDependent).sort(byName);

  const items = SAMPLE.map((s) => ({ ...s, p: cat.profiles.find((x) => x.id === s.id)! })).filter((x) => x.p);
  const total = items.reduce((n, x) => n + (x.free ? 0 : x.p.cost), 0);
  const limit = 300;
  const ratio = Math.min(100, (total / limit) * 100);

  const modalProfile =
    modal?.kind === "preview"
      ? cat.profiles.find((p) => p.id === modal.profileId)
      : modal?.kind === "edit"
        ? items[modal.index]?.p
        : undefined;

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
            <RosterGroup label="Personnages" items={personnages} onOpen={(id) => setModal({ kind: "preview", profileId: id })} />
            <RosterGroup label="Troupes" items={troupes} onOpen={(id) => setModal({ kind: "preview", profileId: id })} />
            <RosterGroup
              label="Recrutement conditionnel"
              hint="se recrutent via un porteur dans la liste"
              items={conditionnels}
              onOpen={(id) => setModal({ kind: "preview", profileId: id })}
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
            {items.map((x, i) => (
              <div key={i}>
                <button
                  onClick={() => setModal({ kind: "edit", index: i })}
                  className="flex w-full items-center gap-3 rounded-md border-l-4 bg-white/45 px-3 py-2.5 text-left shadow-sm transition hover:bg-white/70"
                  style={{ borderLeftColor: x.leader ? accent : "transparent" }}
                >
                  <span className="w-4 text-center" style={{ color: accent }}>
                    {x.leader ? "❖" : <span className="cursor-grab opacity-40">⠿</span>}
                  </span>
                  <span className="flex-1">
                    <span className="font-semibold" style={{ color: deep }}>
                      {x.p.name}
                    </span>
                    {x.p.level && <span className="ml-1 opacity-50">{LEVEL[x.p.level]}</span>}
                    {x.leader && (
                      <span className="kh-display ml-2 text-[10px] uppercase tracking-wide" style={{ color: accent }}>
                        Leader
                      </span>
                    )}
                  </span>
                  <span className={`text-sm ${x.free ? "font-semibold" : ""}`} style={{ color: x.free ? "#4a6b32" : deep }}>
                    {x.free ? "gratuit" : `${x.p.cost} Ko`}
                  </span>
                  <span className="opacity-40 hover:text-red-700 hover:opacity-100">✕</span>
                </button>
                <div className="ml-8 mt-1 flex gap-2">
                  {x.p.traits.includes("femelle-fang") && <RecruitPill label="+ Likan" accent={accent} />}
                  {x.p.id === "fangs-xayin-2" && <RecruitPill label="+ Muskh" accent={accent} />}
                </div>
              </div>
            ))}
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
      {modal && modalProfile && (
        <Overlay onClose={() => setModal(null)}>
          {modal.kind === "preview" ? (
            <CardPreview profile={modalProfile} cat={cat} accent={accent} deep={deep} onClose={() => setModal(null)} />
          ) : (
            <EditDrawer profile={modalProfile} accent={accent} deep={deep} onClose={() => setModal(null)} />
          )}
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
  items: Profile[];
  onOpen: (id: string) => void;
  conditional?: boolean;
}) {
  return (
    <div className="mb-3">
      <p className="kh-display px-2 text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      {hint && <p className="px-2 pb-1 text-[10px] italic opacity-50">{hint}</p>}
      <ul>
        {items.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onOpen(p.id)}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-white/60"
            >
              <span className={conditional ? "opacity-70" : ""}>
                {p.name}
                {p.level && <span className="ml-1 opacity-50">{LEVEL[p.level]}</span>}
              </span>
              <span className="text-xs opacity-70">{conditional ? "🔗" : p.cost}</span>
            </button>
          </li>
        ))}
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

function CardPreview({
  profile: p,
  cat,
  accent,
  deep,
  onClose,
}: {
  profile: Profile;
  cat: Catalog;
  accent: string;
  deep: string;
  onClose: () => void;
}) {
  const cards = specialCardsForProfile(p, cat);
  return (
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
          {p.skills.map((s, i) => (
            <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs">
              {cat.skills.find((sk) => sk.id === s.skillId)?.keyword ?? s.skillId}
              {s.value != null ? ` ${s.value}` : ""}
            </span>
          ))}
        </div>
        {p.rules.length > 0 && (
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
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {cards.length > 0 && (
          <div>
            <SectionTitle accent={accent}>Cartes liées</SectionTitle>
            <ul className="space-y-1 text-sm">
              {cards.map((c) => (
                <li key={c.id} className="flex justify-between rounded bg-white/40 px-2 py-1">
                  <span>{c.name}</span>
                  <span className="opacity-60">{c.cost > 0 ? `${c.cost} Ko` : "auto"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2">
          <button
            className="rounded-md py-2 text-sm font-semibold text-white shadow transition hover:brightness-110"
            style={{ background: accent }}
          >
            Ajouter à la liste
          </button>
          <button onClick={onClose} className="rounded-md py-2 text-sm hover:bg-white/50">
            Fermer
          </button>
        </div>
      </div>
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
