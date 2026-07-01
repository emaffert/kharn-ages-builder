import { useMemo, useState } from "react";
import { loadCatalog } from "@data";
import { specialCardsForProfile } from "@ui/explain";
import type { Catalog, Profile } from "@core";

/**
 * Maquette VISUELLE (statique) du constructeur de liste — DA « parchemin » fidèle aux
 * livres/cartes, accent coloré par faction. Aucune logique métier : simple aperçu UX.
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
  { id: "fangs", name: "Fangs", accent: "#7a4a2b", deep: "#4a2f1c" },
  { id: "kharns", name: "Khârns", accent: "#2b3a5a", deep: "#16223d" },
  { id: "kherops", name: "Khérops", accent: "#7a2b2b", deep: "#4a1c1c" },
  { id: "guilde-noire", name: "Guilde Noire", accent: "#2f2a26", deep: "#141210" },
];

// Liste d'exemple (références de profils réels).
const SAMPLE = [
  { id: "fangs-apathee-3", leader: true },
  { id: "fangs-xayin-2" },
  { id: "fangs-goulue-1" },
  { id: "fangs-larbin-1", free: true },
  { id: "fangs-executeur-2" },
];

const isDependent = (p: Profile) => p.modelId === "likan" || p.id === "fangs-muskh-1";

type Focus = { kind: "roster"; profileId: string } | { kind: "list"; index: number };

export function ListBuilderMock() {
  const cat = useMemo(() => loadCatalog(), []);
  const [factionId, setFactionId] = useState("fangs");
  const fac = FACTIONS.find((f) => f.id === factionId)!;
  const { accent, deep } = fac;

  const byName = (a: Profile, b: Profile) => a.name.localeCompare(b.name);
  const personnages = cat.profiles.filter((p) => p.isNamed && !isDependent(p)).sort(byName);
  const troupes = cat.profiles.filter((p) => !p.isNamed && !isDependent(p)).sort(byName);
  const conditionnels = cat.profiles.filter(isDependent).sort(byName);

  const [focus, setFocus] = useState<Focus>({ kind: "roster", profileId: personnages[0]?.id ?? "" });

  const items = SAMPLE.map((s) => ({ ...s, p: cat.profiles.find((x) => x.id === s.id)! })).filter((x) => x.p);
  const total = items.reduce((n, x) => n + (x.free ? 0 : x.p.cost), 0);
  const limit = 300;
  const ratio = Math.min(100, (total / limit) * 100);

  const focusProfile =
    focus.kind === "roster"
      ? cat.profiles.find((p) => p.id === focus.profileId)
      : items[focus.index]?.p;

  return (
    <div className="kh-builder kh-parchment flex h-full flex-col">
      {/* En-tête : configuration éditable */}
      <header
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-6 py-3"
        style={{ borderColor: accent, background: `${accent}14` }}
      >
        <input
          defaultValue="Tanière de Nyx"
          className="kh-display rounded border-b-2 bg-transparent px-1 py-0.5 text-xl font-semibold outline-none"
          style={{ borderColor: accent, color: deep }}
        />
        <Field label="Format">
          <select className="rounded bg-white/50 px-2 py-0.5 text-sm" style={{ boxShadow: `inset 0 0 0 1px ${accent}55` }}>
            <option>Escarmouche</option>
            <option>Bataille (Ost)</option>
          </select>
        </Field>
        <Field label="Faction">
          <select
            value={factionId}
            onChange={(e) => setFactionId(e.target.value)}
            className="rounded bg-white/50 px-2 py-0.5 text-sm"
            style={{ boxShadow: `inset 0 0 0 1px ${accent}55` }}
          >
            {FACTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Points (Ko)">
          <input
            type="number"
            defaultValue={300}
            className="w-20 rounded bg-white/50 px-2 py-0.5 text-sm"
            style={{ boxShadow: `inset 0 0 0 1px ${accent}55` }}
          />
        </Field>
        <div className="ml-auto text-right">
          <div className="text-sm">
            <span className="kh-display text-lg font-bold" style={{ color: deep }}>
              {total}
            </span>
            <span className="opacity-60"> / {limit} Ko</span>
          </div>
          <div className="mt-1 h-2 w-44 overflow-hidden rounded-full" style={{ background: `${accent}22` }}>
            <div className="h-full rounded-full" style={{ width: `${ratio}%`, background: accent }} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Roster */}
        <aside className="kh-panel flex w-72 shrink-0 flex-col border-r" style={{ borderColor: `${accent}44` }}>
          <div className="border-b px-3 py-2.5" style={{ borderColor: `${accent}33` }}>
            <input
              placeholder="Rechercher un profil…"
              className="w-full rounded bg-white/60 px-2 py-1.5 text-sm outline-none"
              style={{ boxShadow: `inset 0 0 0 1px ${accent}44` }}
            />
            <p className="kh-display mt-2 text-sm font-semibold" style={{ color: deep }}>
              Roster · {fac.name}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <RosterGroup label="Personnages" items={personnages} focus={focus} setFocus={setFocus} accent={accent} />
            <RosterGroup label="Troupes" items={troupes} focus={focus} setFocus={setFocus} accent={accent} />
            <RosterGroup
              label="Recrutement conditionnel"
              hint="se recrutent via un profil de la liste"
              items={conditionnels}
              focus={focus}
              setFocus={setFocus}
              accent={accent}
              conditional
            />
          </div>
        </aside>

        {/* Liste */}
        <section className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-xl space-y-2">
            {items.map((x, i) => (
              <div key={i}>
                <button
                  onClick={() => setFocus({ kind: "list", index: i })}
                  className="flex w-full items-center gap-3 rounded-md border-l-4 bg-white/40 px-3 py-2 text-left transition hover:bg-white/70"
                  style={{
                    borderLeftColor: x.leader ? accent : "transparent",
                    boxShadow: focus.kind === "list" && focus.index === i ? `0 0 0 1.5px ${accent}` : undefined,
                  }}
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
                {/* Boutons de recrutement conditionnel sur le porteur */}
                <div className="ml-8 mt-1 flex gap-2">
                  {x.p.traits.includes("femelle-fang") && <RecruitPill label="+ Likan" accent={accent} />}
                  {x.p.id === "fangs-xayin-2" && <RecruitPill label="+ Muskh" accent={accent} />}
                </div>
              </div>
            ))}
            <button
              className="w-full rounded-md border-2 border-dashed px-3 py-2 text-sm transition hover:bg-white/40"
              style={{ borderColor: `${accent}55`, color: accent }}
            >
              + ajouter une figurine
            </button>
          </div>
        </section>

        {/* Panneau contextuel : aperçu (roster) ou édition (liste) */}
        <aside
          className="kh-panel hidden w-[380px] shrink-0 flex-col overflow-y-auto border-l p-4 lg:flex"
          style={{ borderColor: `${accent}44` }}
        >
          {focus.kind === "roster" && focusProfile ? (
            <CardPreview profile={focusProfile} cat={cat} accent={accent} deep={deep} />
          ) : focusProfile ? (
            <EditDrawer profile={focusProfile} accent={accent} deep={deep} />
          ) : null}
        </aside>
      </div>

      {/* Barre de validation */}
      <footer
        className="flex items-center gap-4 border-t px-6 py-2 text-sm"
        style={{ borderColor: accent, background: `${accent}14` }}
      >
        <span className="rounded px-2 py-0.5 font-medium" style={{ background: "#4a6b3222", color: "#3c5a28" }}>
          ✓ Liste valide
        </span>
        <span className="opacity-60">{items.length} figurines · Muskh et Likans se recrutent via leur porteur.</span>
        <span className="ml-auto">
          Total <span className="kh-display font-bold" style={{ color: deep }}>{total} Ko</span>
        </span>
      </footer>
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="opacity-60">{label}</span>
      {children}
    </label>
  );
}

function RosterGroup({
  label,
  hint,
  items,
  focus,
  setFocus,
  accent,
  conditional,
}: {
  label: string;
  hint?: string;
  items: Profile[];
  focus: Focus;
  setFocus: (f: Focus) => void;
  accent: string;
  conditional?: boolean;
}) {
  return (
    <div className="mb-3">
      <p className="kh-display px-2 text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      {hint && <p className="px-2 pb-1 text-[10px] italic opacity-50">{hint}</p>}
      <ul>
        {items.map((p) => {
          const active = focus.kind === "roster" && focus.profileId === p.id;
          return (
            <li key={p.id}>
              <button
                onClick={() => setFocus({ kind: "roster", profileId: p.id })}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-white/60"
                style={active ? { background: `${accent}22` } : undefined}
              >
                <span className={conditional ? "opacity-70" : ""}>
                  {p.name}
                  {p.level && <span className="ml-1 opacity-50">{LEVEL[p.level]}</span>}
                </span>
                <span className="flex items-center gap-1.5 text-xs opacity-70">
                  {conditional ? <span title="via un porteur">🔗</span> : `${p.cost}`}
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

function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <h4 className="kh-display mb-1.5 border-b pb-1 text-xs font-semibold uppercase tracking-wider" style={{ borderColor: `${accent}33`, color: accent }}>
      {children}
    </h4>
  );
}

/** Élément signature : le profil rendu comme une carte parchemin à liseré de faction. */
function CardPreview({ profile: p, cat, accent, deep }: { profile: Profile; cat: Catalog; accent: string; deep: string }) {
  const cards = specialCardsForProfile(p, cat);
  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-wider opacity-50">Aperçu de la carte</p>
      <div className="rounded-lg border-2 bg-white/45 p-4 shadow-sm" style={{ borderColor: accent }}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="kh-display text-xl font-bold leading-tight" style={{ color: deep }}>
            {p.name}
            {p.level && <span className="ml-2 text-base opacity-60">{LEVEL[p.level]}</span>}
          </h3>
          <span className="rounded px-2 py-0.5 text-sm font-semibold" style={{ background: accent, color: "#f5ecd6" }}>
            {p.cost} Ko
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
          <Tag accent={accent}>Limitation {p.limitation.kind}{p.limitation.value ? ` ${p.limitation.value}` : ""}</Tag>
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
                {r.label && <span className="font-semibold" style={{ color: deep }}>{r.label} : </span>}
                {r.text}
              </li>
            ))}
          </ul>
        )}
      </div>

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

      <button
        className="w-full rounded-md py-2 text-sm font-semibold shadow-sm transition hover:brightness-110"
        style={{ background: accent, color: "#f5ecd6" }}
      >
        Ajouter à la liste
      </button>
    </div>
  );
}

function EditDrawer({ profile: p, accent, deep }: { profile: Profile; accent: string; deep: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="kh-display text-lg font-bold" style={{ color: deep }}>
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
        <select className="w-full rounded bg-white/60 px-2 py-1 text-sm" style={{ boxShadow: `inset 0 0 0 1px ${accent}44` }}>
          <option>— aucune —</option>
          <option>Apprentie de Nyx (+15 Ko)</option>
        </select>
      </div>

      <div>
        <SectionTitle accent={accent}>Magie</SectionTitle>
        <select className="mb-2 w-full rounded bg-white/60 px-2 py-1 text-sm" style={{ boxShadow: `inset 0 0 0 1px ${accent}44` }}>
          <option>Sans grimoire</option>
          <option>Petit grimoire (+20 Ko · 5 pages)</option>
          <option>Grand grimoire (+40 Ko · ∞)</option>
        </select>
        <p className="mb-1 text-xs opacity-60">Sorts (0 / 5 pages)</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" /> Séduction du Fiel <span className="opacity-50">2 p · 10 Ko</span>
        </label>
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

function Tag({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <span className="rounded px-1.5 py-0.5" style={{ background: `${accent}1f`, color: accent }}>
      {children}
    </span>
  );
}
