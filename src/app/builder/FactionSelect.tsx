import { useState } from "react";
import type { ListDocument } from "@core";
import type { ListStore } from "../useListStore";
import { FACTIONS } from "./shared";
import { checkImportedList, decodeList } from "../listCode";
import { importText as parseTextList } from "../listText";

/** Écran 1 : choix de la faction / format / points, ou chargement / import d'une liste existante. */

export function FactionSelect({
  store,
  onStart,
  onLoad,
}: {
  store: ListStore;
  onStart: (id: string, format: ListDocument["format"], pointsLimit: number) => void;
  onLoad: (doc: ListDocument) => void;
}) {
  const [showLoad, setShowLoad] = useState(false);
  const [format, setFormat] = useState<ListDocument["format"]>("escarmouche");
  const [points, setPoints] = useState(300);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importUnresolved, setImportUnresolved] = useState<string[]>([]);
  const [pendingImport, setPendingImport] = useState<ListDocument | null>(null);
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
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ListDocument["format"])}
              className="rounded bg-white/60 px-3 py-1.5 shadow-inner"
            >
              <option value="escarmouche">Escarmouche (1 Fer de Lance)</option>
              <option value="bataille" disabled>
                Bataille (Ost) — bientôt
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="opacity-60">Points (Ko)</span>
            <input
              type="number"
              value={points}
              min={0}
              onChange={(e) => setPoints(Math.max(0, Number(e.target.value) || 0))}
              className="w-28 rounded bg-white/60 px-3 py-1.5 shadow-inner"
            />
          </label>
        </div>

        <h2 className="kh-display mt-10 text-lg font-semibold opacity-70">Choisissez une faction</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FACTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => onStart(f.id, format, points)}
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
          ou{" "}
          <button className="underline" onClick={() => setShowLoad((v) => !v)}>
            charger une liste existante
          </button>
          {store.savedLists.length > 0 && <span className="opacity-50"> ({store.savedLists.length})</span>}
          {" · "}
          <button className="underline" onClick={() => { setShowImport((v) => !v); setImportError(null); }}>
            importer un code
          </button>
        </p>

        {showImport && (
          <div className="mt-3 rounded-lg border bg-white/40 p-3" style={{ borderColor: "#7a4a2b44" }}>
            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
                setImportUnresolved([]);
                setPendingImport(null);
              }}
              placeholder="Code (KA1:…) ou roster texte"
              className="h-24 w-full resize-none rounded bg-white/60 p-2 font-mono text-xs shadow-inner outline-none"
            />
            {importError && <p className="mt-1 text-sm" style={{ color: "#9a3b2b" }}>⚠ {importError}</p>}
            {importUnresolved.length > 0 && (
              <div className="mt-1 rounded-md bg-black/5 p-2 text-xs" style={{ color: "#9a3b2b" }}>
                <p className="font-semibold">Avertissements :</p>
                <ul className="mt-1 space-y-0.5">
                  {importUnresolved.map((l, k) => (
                    <li key={k}>· {l.trim()}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-2 flex justify-end">
              <button
                onClick={async () => {
                  if (pendingImport) return onLoad(pendingImport);
                  setImportError(null);
                  setImportUnresolved([]);
                  let doc: ListDocument;
                  let warnings: string[] = [];
                  try {
                    doc = await decodeList(importText); // code portable
                  } catch {
                    const r = parseTextList(store.catalog, importText); // sinon texte best-effort
                    if (r.doc.fersDeLance[0].members.length === 0) {
                      setImportError("Ni code valide, ni figurine reconnue dans le texte.");
                      return;
                    }
                    doc = r.doc;
                    warnings = r.unresolved;
                  }
                  warnings = [...checkImportedList(store.catalog, doc), ...warnings];
                  if (warnings.length > 0) {
                    setImportUnresolved(warnings);
                    setPendingImport(doc);
                  } else {
                    onLoad(doc);
                  }
                }}
                disabled={importText.trim() === ""}
                className="rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-40"
                style={{ background: "#7a4a2b" }}
              >
                {pendingImport ? "Charger quand même" : "Importer"}
              </button>
            </div>
          </div>
        )}

        {showLoad && (
          <div className="mt-3 rounded-lg border bg-white/40 p-3" style={{ borderColor: "#7a4a2b44" }}>
            {store.savedLists.length === 0 ? (
              <p className="text-sm opacity-60">Aucune liste sauvegardée.</p>
            ) : (
              <ul className="space-y-1">
                {store.savedLists.map((doc) => {
                  const fac = FACTIONS.find((f) => f.id === doc.fersDeLance[0]?.factionId);
                  return (
                    <li key={doc.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/50">
                      <button className="flex flex-1 items-center gap-2 text-left" onClick={() => onLoad(doc)}>
                        <span className="kh-display font-semibold" style={{ color: fac?.deep ?? "#2e2418" }}>
                          {doc.name}
                        </span>
                        {fac && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: fac.accent }}>
                            {fac.name}
                          </span>
                        )}
                        <span className="text-xs opacity-50">
                          {doc.snapshot.totalCost} Ko · {new Date(doc.updatedAt).toLocaleDateString("fr-FR")}
                        </span>
                      </button>
                      <button
                        onClick={() => store.removeSaved(doc.id)}
                        title="Supprimer"
                        className="opacity-40 transition hover:text-red-700 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Écran 2 : construction ────────────────────────────────────────────────────
