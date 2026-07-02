import { useMemo, useState } from "react";
import type { ListDocument } from "@core";
import { Button, SegmentedControl } from "@ui";
import type { ListStore } from "../useListStore";
import { FACTIONS } from "./shared";
import { FactionEmblem } from "./FactionEmblem";
import { resolveImport } from "./importList";

/** Écran 1 : choix de la faction / format / budget, ou reprise / import d'une liste existante. */

const FORMAT_LABEL: Record<string, string> = { escarmouche: "Escarmouche", bataille: "Bataille" };

/** Date relative courte pour les listes récentes (aujourd'hui / hier / il y a N j / date). */
function relativeDate(ts: string | number): string {
  const t = new Date(ts).getTime();
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return new Date(t).toLocaleDateString("fr-FR");
}

export function FactionSelect({
  store,
  onStart,
  onLoad,
}: {
  store: ListStore;
  onStart: (id: string, format: ListDocument["format"], pointsLimit: number) => void;
  onLoad: (doc: ListDocument) => void;
}) {
  // Une faction est jouable si le catalogue contient des profils pour elle.
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of store.catalog.profiles) if (p.factionId) c.set(p.factionId, (c.get(p.factionId) ?? 0) + 1);
    return c;
  }, [store.catalog]);
  const firstAvailable = FACTIONS.find((f) => (counts.get(f.id) ?? 0) > 0) ?? FACTIONS[0];

  const [selectedId, setSelectedId] = useState(firstAvailable.id);
  const selected = FACTIONS.find((f) => f.id === selectedId) ?? firstAvailable;

  const [format, setFormat] = useState<ListDocument["format"]>("escarmouche");
  const [budget, setBudget] = useState<"300" | "400" | "custom">("300");
  const [customPoints, setCustomPoints] = useState(300);
  const points = budget === "custom" ? customPoints : Number(budget);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importUnresolved, setImportUnresolved] = useState<string[]>([]);
  const [pendingImport, setPendingImport] = useState<ListDocument | null>(null);

  const sceneVars = {
    "--faction": selected.color,
    "--faction-2": selected.colorBright,
    "--faction-deep": selected.colorDeep,
  } as React.CSSProperties;

  return (
    <div className="fs-scene" style={sceneVars}>
      <div className="fs-wrap">
        <div className="fs-hero">
          <div className="fs-eyebrow">Constructeur de listes</div>
          <h1 className="fs-title">Choisis ta faction</h1>
          <p className="fs-sub">Une seule faction par Fer de Lance. Elle déterminera les figurines recrutables.</p>
        </div>

        <div className="fs-grid">
          {FACTIONS.map((f) => {
            const n = counts.get(f.id) ?? 0;
            const soon = n === 0;
            const facVars = {
              "--faction": f.color,
              "--faction-2": f.colorBright,
              "--faction-deep": f.colorDeep,
            } as React.CSSProperties;
            return (
              <button
                key={f.id}
                type="button"
                disabled={soon}
                aria-pressed={!soon && f.id === selectedId}
                className={`fs-tile${soon ? " is-soon" : f.id === selectedId ? " is-sel" : ""}`}
                style={facVars}
                onClick={() => !soon && setSelectedId(f.id)}
              >
                <FactionEmblem kind={f.emblem} className="fs-emblem" />
                <h3>{f.name}</h3>
                <p>{f.blurb}</p>
                <div className="fs-count">{soon ? "à venir" : `${n} profils`}</div>
              </button>
            );
          })}
        </div>

        <div className="fs-setup">
          <div className="fs-grp">
            <span className="fs-glabel">Format</span>
            <SegmentedControl
              ariaLabel="Format"
              value={format}
              onChange={setFormat}
              options={[
                { value: "escarmouche", label: "Escarmouche" },
                { value: "bataille", label: "Bataille", disabled: true, title: "Bientôt" },
              ]}
            />
          </div>
          <div className="fs-grp">
            <span className="fs-glabel">Budget</span>
            <div className="flex items-center gap-3">
              <SegmentedControl
                ariaLabel="Budget"
                value={budget}
                onChange={setBudget}
                options={[
                  { value: "300", label: "300 Ko" },
                  { value: "400", label: "400 Ko" },
                  { value: "custom", label: "Autre" },
                ]}
              />
              {budget === "custom" && (
                <input
                  className="fs-points"
                  type="number"
                  min={0}
                  value={customPoints}
                  aria-label="Budget personnalisé (Ko)"
                  onChange={(e) => setCustomPoints(Math.max(0, Number(e.target.value) || 0))}
                />
              )}
            </div>
          </div>
          <div className="fs-go">
            <span>
              Faction : <span className="fs-chosen">{selected.name}</span>
            </span>
            <Button variant="primary" onClick={() => onStart(selected.id, format, points)}>
              Commencer →
            </Button>
          </div>
        </div>

        <div className="fs-saved">
          <div className="fs-saved-head">
            <h2>Reprendre une liste</h2>
            <span className="fs-line" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowImport((v) => !v);
                setImportError(null);
              }}
            >
              Importer un code
            </Button>
          </div>

          {showImport && (
            <div className="fs-import">
              <textarea
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError(null);
                  setImportUnresolved([]);
                  setPendingImport(null);
                }}
                placeholder="Code (KA1:…) ou roster texte"
              />
              {importError && <p className="fs-import-msg">⚠ {importError}</p>}
              {importUnresolved.length > 0 && (
                <div className="fs-import-msg">
                  <p className="font-semibold">Avertissements :</p>
                  <ul className="mt-1 space-y-0.5">
                    {importUnresolved.map((l, k) => (
                      <li key={k}>· {l.trim()}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={importText.trim() === ""}
                  onClick={async () => {
                    if (pendingImport) return onLoad(pendingImport);
                    setImportError(null);
                    setImportUnresolved([]);
                    try {
                      const { doc, warnings } = await resolveImport(store.catalog, importText);
                      if (warnings.length > 0) {
                        setImportUnresolved(warnings);
                        setPendingImport(doc);
                      } else {
                        onLoad(doc);
                      }
                    } catch (e) {
                      setImportError(e instanceof Error ? e.message : "Import impossible.");
                    }
                  }}
                >
                  {pendingImport ? "Charger quand même" : "Importer"}
                </Button>
              </div>
            </div>
          )}

          {store.savedLists.length === 0 ? (
            <p className="fs-sub" style={{ textAlign: "left" }}>
              Aucune liste sauvegardée pour l'instant.
            </p>
          ) : (
            <div className="fs-slist">
              {store.savedLists.map((doc) => {
                const fac = FACTIONS.find((f) => f.id === doc.fersDeLance[0]?.factionId) ?? FACTIONS[0];
                const facVars = {
                  "--faction": fac.color,
                  "--faction-2": fac.colorBright,
                  "--faction-deep": fac.colorDeep,
                } as React.CSSProperties;
                return (
                  <div key={doc.id} className="fs-scard" style={facVars}>
                    <button className="fs-scard-main" onClick={() => onLoad(doc)}>
                      <FactionEmblem kind={fac.emblem} className="fs-scard-em" />
                      <span className="fs-scard-info">
                        <span className="fs-scard-nm">{doc.name}</span>
                        <span className="fs-scard-mt">
                          {FORMAT_LABEL[doc.format] ?? doc.format}
                          <span className="fs-dot" />
                          {relativeDate(doc.updatedAt)}
                        </span>
                      </span>
                      <span className="fs-scard-ko">{doc.snapshot.totalCost} Ko</span>
                    </button>
                    <button
                      className="fs-scard-del"
                      title="Supprimer"
                      aria-label={`Supprimer ${doc.name}`}
                      onClick={() => store.removeSaved(doc.id)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Écran 2 : construction ────────────────────────────────────────────────────
