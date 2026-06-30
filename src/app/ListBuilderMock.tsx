import { useMemo, useState } from "react";
import { loadCatalog } from "@data";

/**
 * Maquette VISUELLE (statique) du constructeur de liste, pour valider l'UX avant
 * de câbler la logique (evaluateList, store, etc.). Données Fang réelles pour le réalisme,
 * mais aucune interaction métier : ceci n'est qu'un aperçu.
 */

const LEVEL = ["", "I", "II", "III"];

// Liste d'exemple (références de profils réels).
const SAMPLE = [
  { id: "fangs-apathee-3", leader: true },
  { id: "fangs-goulue-1" },
  { id: "fangs-goulue-1" },
  { id: "fangs-larbin-1", free: true },
  { id: "fangs-executeur-2" },
  { id: "fangs-muskh-1", error: true },
];

export function ListBuilderMock() {
  const cat = useMemo(() => loadCatalog(), []);
  const profile = (id: string) => cat.profiles.find((p) => p.id === id);
  const [selected, setSelected] = useState(1); // index dans SAMPLE (la Goulue)

  const items = SAMPLE.map((s) => ({ ...s, p: profile(s.id)! })).filter((x) => x.p);
  const total = items.reduce((n, x) => n + (x.free ? 0 : x.p.cost), 0);
  const limit = 300;
  const ratio = Math.min(100, (total / limit) * 100);
  const sel = items[selected];

  return (
    <div className="flex h-full flex-col bg-stone-950 text-stone-100">
      {/* Barre de configuration */}
      <header className="flex items-center gap-4 border-b border-stone-800 bg-stone-900/60 px-5 py-3">
        <input
          defaultValue="Tanière de Nyx"
          className="rounded bg-stone-800 px-3 py-1.5 text-lg font-bold outline-none ring-1 ring-stone-700 focus:ring-amber-600"
        />
        <span className="rounded-full bg-stone-800 px-3 py-1 text-xs text-stone-300">Escarmouche</span>
        <span className="rounded-full bg-rose-900/40 px-3 py-1 text-xs font-medium text-rose-200 ring-1 ring-rose-700/40">
          Fangs
        </span>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm">
              <span className="font-bold text-amber-300">{total}</span>
              <span className="text-stone-400"> / {limit} Ko</span>
            </div>
            <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-stone-800">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${ratio}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Colonne gauche : roster */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-stone-800 bg-stone-900/40">
          <div className="border-b border-stone-800 p-3">
            <input
              placeholder="Rechercher un profil…"
              className="w-full rounded bg-stone-800 px-2 py-1.5 text-sm outline-none ring-1 ring-stone-700 focus:ring-amber-600"
            />
            <p className="mt-2 text-xs uppercase tracking-wider text-amber-300/70">Roster Fang</p>
          </div>
          <ul className="flex-1 overflow-y-auto p-2">
            {cat.profiles.map((p) => {
              const count = items.filter((x) => x.id === p.id).length;
              const max =
                p.limitation.kind === "X" ? (p.limitation.value ?? 99) : p.limitation.kind === "special" ? 99 : 1;
              const full = count >= max;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-stone-800/60"
                >
                  <span className={full ? "text-stone-500" : ""}>
                    {p.name}
                    {p.level && <span className="ml-1 text-stone-500">{LEVEL[p.level]}</span>}
                    {p.limitation.kind !== "special" && (
                      <span className="ml-2 text-[10px] text-stone-600">
                        {count}/{max === 99 ? "∞" : max}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-stone-400">{p.cost}</span>
                    <button
                      disabled={full}
                      className="flex h-5 w-5 items-center justify-center rounded bg-amber-600/80 text-xs font-bold text-amber-50 hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-500"
                    >
                      +
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Colonne centre : la liste */}
        <section className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-xl space-y-2">
            {items.map((x, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                  i === selected
                    ? "border-amber-600/60 bg-amber-600/10"
                    : "border-stone-800 bg-stone-900/40 hover:bg-stone-800/50"
                } ${x.leader ? "ring-1 ring-amber-500/30" : ""}`}
              >
                {x.leader ? (
                  <span title="Leader" className="text-amber-400">
                    ★
                  </span>
                ) : (
                  <span className="w-3 cursor-grab text-stone-600" title="Glisser pour réordonner">
                    ⠿
                  </span>
                )}
                <span className="flex-1">
                  <span className="font-medium">{x.p.name}</span>
                  {x.p.level && <span className="ml-1 text-stone-500">{LEVEL[x.p.level]}</span>}
                  {x.leader && <span className="ml-2 text-[10px] uppercase text-amber-400/80">leader</span>}
                  {x.error && <span className="ml-2 text-xs text-rose-400">⛔ nécessite Xayìn</span>}
                </span>
                <span className={`text-sm ${x.free ? "text-emerald-400" : "text-stone-300"}`}>
                  {x.free ? "gratuit" : `${x.p.cost} Ko`}
                </span>
                <span className="text-stone-600 hover:text-rose-400">✕</span>
              </button>
            ))}
            <button className="w-full rounded-lg border border-dashed border-stone-700 px-3 py-2 text-sm text-stone-500 hover:border-amber-600 hover:text-amber-300">
              + ajouter une figurine
            </button>
          </div>
        </section>

        {/* Colonne droite : drawer de détail */}
        <aside className="hidden w-[360px] shrink-0 flex-col overflow-y-auto border-l border-stone-800 bg-stone-900/40 p-4 lg:flex">
          <h3 className="text-lg font-bold text-stone-50">
            {sel.p.name} <span className="text-stone-500">{LEVEL[sel.p.level ?? 0]}</span>
          </h3>
          <p className="mb-4 text-xs text-stone-500">{sel.free ? "gratuit (garde rapproché)" : `${sel.p.cost} Ko`}</p>

          <Block title="Équipement">
            <Row label="Couteau (base)" right="gratuit" action="retirer" />
            <AddRow label="+ ajouter une arme" />
          </Block>

          <Block title="Amélioration">
            <select className="w-full rounded bg-stone-800 px-2 py-1 text-sm ring-1 ring-stone-700">
              <option>— aucune —</option>
              <option>Apprentie de Nyx (+15 Ko)</option>
            </select>
          </Block>

          <Block title="Magie">
            <select className="mb-2 w-full rounded bg-stone-800 px-2 py-1 text-sm ring-1 ring-stone-700">
              <option>Sans grimoire</option>
              <option>Petit grimoire (+20 Ko · 5 pages)</option>
              <option>Grand grimoire (+40 Ko · ∞)</option>
            </select>
            <p className="mb-1 text-xs text-stone-500">Sorts (0 / 5 pages)</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" /> Séduction du Fiel <span className="text-stone-500">2 p · 10 Ko</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" /> Inflection Mentale <span className="text-stone-500">2 p · 10 Ko</span>
            </label>
          </Block>

          <Block title="Compétences (carte)">
            <div className="flex flex-wrap gap-1">
              {sel.p.skills.slice(0, 6).map((s, i) => (
                <span key={i} className="rounded bg-stone-800 px-1.5 py-0.5 text-xs text-stone-300">
                  {cat.skills.find((sk) => sk.id === s.skillId)?.keyword ?? s.skillId}
                  {s.value != null ? ` ${s.value}` : ""}
                </span>
              ))}
            </div>
          </Block>
        </aside>
      </div>

      {/* Barre de validation */}
      <footer className="flex items-center gap-4 border-t border-stone-800 bg-stone-900/60 px-5 py-2 text-sm">
        <span className="rounded bg-rose-900/40 px-2 py-0.5 text-rose-200">⛔ 1 erreur</span>
        <span className="text-stone-400">« Ce dernier ne peut pas être recruté sans Xayìn. »</span>
        <span className="ml-auto text-stone-400">
          Total <span className="font-bold text-amber-300">{total} Ko</span>
        </span>
      </footer>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300/70">{title}</h4>
      {children}
    </section>
  );
}

function Row({ label, right, action }: { label: string; right: string; action?: string }) {
  return (
    <div className="flex items-center justify-between rounded bg-stone-800/50 px-2 py-1 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2 text-xs">
        <span className="text-stone-400">{right}</span>
        {action && <button className="text-stone-500 hover:text-rose-400">{action}</button>}
      </span>
    </div>
  );
}

function AddRow({ label }: { label: string }) {
  return (
    <button className="w-full rounded border border-dashed border-stone-700 px-2 py-1 text-xs text-stone-500 hover:border-amber-600 hover:text-amber-300">
      {label}
    </button>
  );
}
