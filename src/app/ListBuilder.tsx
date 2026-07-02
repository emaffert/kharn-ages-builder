import { useEffect, useMemo, useState } from "react";
import type { ListDocument, Profile } from "@core";
import { FACTIONS, LEVEL, canBuy, isDependent, type ItemInfo, type Modal, type ModelEntry } from "./builder/shared";
import { useListStore, type ListStore } from "./useListStore";
import { Overlay } from "./Overlay";
import { ActionBtn, RecruitPill } from "./builder/components";
import { CardPreview } from "./builder/CardPreview";
import { FigureEditor } from "./builder/FigureEditor";
import { RosterGroup } from "./builder/RosterGroup";
import { PurchaseSummary } from "./builder/PurchaseSummary";
import { checkImportedList, decodeList, encodeList } from "./listCode";
import { exportText, importText as parseTextList } from "./listText";

/**
 * Constructeur de liste joueur. Flux : écran de sélection de faction → écran de construction
 * (roster + liste) avec barre d'actions ; aperçu de carte et édition d'une figurine en modales.
 * L'état vit dans `useListStore` (ListDocument) ; coûts et validation viennent de `evaluateList`.
 */

export function ListBuilder() {
  const store = useListStore();
  const [step, setStep] = useState<"select" | "build">("select");
  if (step === "select") {
    return (
      <FactionSelect
        store={store}
        onStart={(id, format, pointsLimit) => {
          store.newList(id, { format, pointsLimit });
          setStep("build");
        }}
        onLoad={(doc) => {
          store.loadSaved(doc);
          setStep("build");
        }}
      />
    );
  }
  return <BuilderScreen store={store} onNew={() => setStep("select")} />;
}

// ── Écran 1 : sélection de la faction ─────────────────────────────────────────

function FactionSelect({
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

function BuilderScreen({ store, onNew }: { store: ListStore; onNew: () => void }) {
  const cat = store.catalog;
  const { evaluation, fdl } = store;
  const factionId = fdl.factionId;
  const fac = FACTIONS.find((f) => f.id === factionId) ?? FACTIONS[0];
  const { accent, deep } = fac;
  const [modal, setModal] = useState<Modal>(null);
  const [rosterQuery, setRosterQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const onSave = async () => {
    await store.saveCurrent();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const [io, setIo] = useState<null | "export" | "import">(null);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [exportCode, setExportCode] = useState("");
  const [exportMode, setExportMode] = useState<"code" | "texte">("code");
  useEffect(() => {
    if (io === "export") encodeList(store.list).then(setExportCode);
  }, [io, store.list]);
  // Ne calcule le texte (qui relance evaluateList) que lorsque la modale export est ouverte.
  const exportValue = useMemo(
    () => (io !== "export" ? "" : exportMode === "code" ? exportCode : exportText(cat, store.list)),
    [io, exportMode, exportCode, cat, store.list],
  );
  // Import unifié : code portable d'abord, sinon texte best-effort.
  const [importUnresolved, setImportUnresolved] = useState<string[]>([]);
  const [pendingImport, setPendingImport] = useState<ListDocument | null>(null);
  const runImport = async () => {
    setImportError(null);
    setImportUnresolved([]);
    setPendingImport(null);
    let doc: ListDocument;
    let warnings: string[] = [];
    try {
      doc = await decodeList(importText); // code portable
    } catch {
      const r = parseTextList(cat, importText); // sinon texte best-effort
      if (r.doc.fersDeLance[0].members.length === 0) {
        setImportError("Aucune figurine reconnue.");
        return;
      }
      doc = r.doc;
      warnings = r.unresolved;
    }
    warnings = [...checkImportedList(cat, doc), ...warnings];
    if (warnings.length > 0) {
      setImportUnresolved(warnings);
      setPendingImport(doc);
    } else {
      store.loadSaved(doc);
      setIo(null);
    }
  };

  const models: ModelEntry[] = cat.models
    .map((m) => ({
      id: m.id,
      name: m.name,
      profiles: m.profileIds
        .map((id) => cat.profiles.find((p) => p.id === id))
        .filter((p): p is Profile => Boolean(p))
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0)),
    }))
    // Roster restreint à la faction choisie (les autres factions n'ont pas encore de profils).
    .filter((m) => m.profiles.length > 0 && m.profiles[0].factionId === factionId)
    .filter((m) => rosterQuery.trim() === "" || m.name.toLowerCase().includes(rosterQuery.trim().toLowerCase()));
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

  // Limite de recrutement : Lim U/P → unique au niveau du **modèle** (ex. Décatie II vs III, une seule) ;
  // Lim X → `value` par profil.
  const modelOf = (p: Profile) => cat.models.find((m) => m.profileIds.includes(p.id));
  const atLimit = (p: Profile) => {
    if (p.limitation.kind === "U" || p.limitation.kind === "P") {
      const ids = modelOf(p)?.profileIds ?? [p.id];
      return fdl.members.filter((m) => ids.includes(m.profileId)).length >= 1;
    }
    if (p.limitation.kind === "X") {
      return fdl.members.filter((m) => m.profileId === p.id).length >= (p.limitation.value ?? Infinity);
    }
    return false;
  };
  const modelMaxed = (m: ModelEntry) => m.profiles.every(atLimit);

  const items = fdl.members
    .map((inst) => ({ inst, p: cat.profiles.find((x) => x.id === inst.profileId)! }))
    .filter((x) => x.p);
  const isChar = (p: Profile) => Boolean(p.isNamed) || p.limitation.kind === "U" || p.limitation.kind === "P";
  const memberOf = (id: string) => items.find((x) => x.inst.instanceId === id);

  // Ordre d'affichage : les unités rattachées (Likan/Muskh) apparaissent juste sous leur porteur.
  const attachedIds = new Set(items.flatMap((x) => x.inst.attachedInstanceIds ?? []));
  const ordered = items
    .filter((x) => !attachedIds.has(x.inst.instanceId))
    .flatMap((x) => [
      { x, attached: false },
      ...(x.inst.attachedInstanceIds ?? [])
        .map((cid) => memberOf(cid))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({ x: c, attached: true })),
    ]);

  // UI locale (non persistée). Repli : déplié par défaut → on suit les figurines *repliées*.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [itemInfo, setItemInfo] = useState<ItemInfo | null>(null);

  // Coûts & validation : entièrement dérivés du moteur (evaluateList).
  const costOf = (id: string) => evaluation.costByInstance[id] ?? 0;
  const total = evaluation.totalCost;
  const limit = store.list.pointsLimit ?? 300;
  const ratio = Math.min(100, (total / Math.max(1, limit)) * 100);
  const issuesOf = (id: string) =>
    evaluation.issues.filter((is) => is.severity === "error" && is.instanceId === id).map((is) => is.message);
  const invalidCount = new Set(
    evaluation.issues.filter((is) => is.severity === "error" && is.instanceId).map((is) => is.instanceId),
  ).size;
  const overLimit = limit != null && total > limit;
  // Erreurs de liste (sans instance : leader, appartenance…) + dépassement de budget.
  const listErrors = [
    ...evaluation.issues.filter((is) => is.severity === "error" && !is.instanceId).map((is) => is.message),
    ...(overLimit ? [`Budget dépassé : ${total} / ${limit} Ko.`] : []),
  ];
  const isValid = invalidCount === 0 && listErrors.length === 0;

  // Leader : personnage OU l'une des deux figurines les plus chères.
  const topTwo = new Set([...items].sort((a, b) => b.p.cost - a.p.cost).slice(0, 2).map((x) => x.inst.instanceId));
  const canLead = (p: Profile, id: string) => isChar(p) || topTwo.has(id);

  // Garde du corps : chaque Fille de Nyx n'offre qu'un emplacement → on retire dynamiquement
  // celles qui ont déjà un garde. La gratuité elle-même vient du moteur.
  const takenFdN = new Set(fdl.members.map((m) => m.bodyguardOfInstanceId).filter(Boolean) as string[]);
  const availableFilles = items
    .filter((x) => x.p.traits.includes("fille-de-nyx") && !takenFdN.has(x.inst.instanceId))
    .map((x) => ({ id: x.inst.instanceId, name: x.p.name }));
  // Djouked ne peut être que le garde rapproché de Broutcha (spécifiquement).
  const availableBroutcha = () =>
    items.find((x) => x.p.modelId === "broutcha" && !takenFdN.has(x.inst.instanceId))?.inst.instanceId;
  const guardEligible = (p: Profile) =>
    p.modelId === "larbin"
      ? availableFilles.length > 0
      : p.modelId === "djouked"
        ? availableBroutcha() != null
        : false;
  const onGuardClick = (id: string) => {
    if (memberOf(id)?.inst.bodyguardOfInstanceId != null) return store.setGuard(id, null);
    const p = memberOf(id)?.p;
    if (p?.modelId === "djouked") {
      const b = availableBroutcha();
      if (b) store.setGuard(id, b);
    } else if (availableFilles.length === 1) store.setGuard(id, availableFilles[0].id);
    else if (availableFilles.length > 1) setModal({ kind: "guard", instanceId: id });
  };
  // Ajout rapide depuis le roster (sans passer par la carte) ; choix du niveau si profils multiples.
  const onQuickAdd = (m: ModelEntry) => {
    if (m.profiles.length === 1) {
      if (!atLimit(m.profiles[0])) store.addMember(m.profiles[0].id);
    } else {
      setModal({ kind: "recruit-level", modelId: m.id });
    }
  };

  const modalModel = modal?.kind === "preview" ? models.find((m) => m.id === modal.modelId) : undefined;
  const editItem = modal?.kind === "edit" ? memberOf(modal.instanceId) : undefined;

  return (
    <div className="kh-builder kh-parchment flex h-full flex-col">
      {/* Barre d'actions */}
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: accent, background: `${accent}12` }}>
        <button onClick={onNew} className="rounded px-2 py-1 text-sm hover:bg-white/50" title="Créer une nouvelle liste">
          ← Nouvelle liste
        </button>
        <span className="h-5 w-px" style={{ background: `${accent}44` }} />
        <input
          value={store.list.name}
          onChange={(e) => store.setName(e.target.value)}
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
          <ActionBtn accent={accent} onClick={() => { setImportText(""); setImportError(null); setIo("import"); }}>
            Importer
          </ActionBtn>
          <ActionBtn accent={accent} onClick={() => setIo("export")}>
            Exporter
          </ActionBtn>
          <ActionBtn accent={accent} primary onClick={onSave}>
            {saved ? "✓ Enregistré" : "Sauvegarder"}
          </ActionBtn>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Roster */}
        <aside className="kh-panel hidden w-72 shrink-0 flex-col border-r md:flex" style={{ borderColor: `${accent}44` }}>
          <div className="border-b px-3 py-2.5" style={{ borderColor: `${accent}33` }}>
            <input
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
              placeholder="Rechercher un profil…"
              className="w-full rounded bg-white/60 px-2 py-1.5 text-sm outline-none shadow-inner"
            />
            <p className="kh-display mt-2 text-sm font-semibold" style={{ color: deep }}>
              Roster · {fac.name}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {models.length === 0 ? (
              <p className="px-2 py-4 text-sm opacity-60">
                {rosterQuery.trim() !== ""
                  ? "Aucun profil ne correspond à la recherche."
                  : `Aucune figurine à recruter pour la faction ${fac.name} pour l'instant.`}
              </p>
            ) : (
              <>
                <RosterGroup label="Personnages" items={personnages} maxed={modelMaxed} accent={accent} onQuickAdd={onQuickAdd} onOpen={(id) => setModal({ kind: "preview", modelId: id })} />
                <RosterGroup label="Troupes" items={troupes} maxed={modelMaxed} accent={accent} onQuickAdd={onQuickAdd} onOpen={(id) => setModal({ kind: "preview", modelId: id })} />
                <RosterGroup
                  label="Recrutement conditionnel"
                  hint="se recrutent via un porteur dans la liste"
                  items={conditionnels}
                  onOpen={(id) => setModal({ kind: "preview", modelId: id })}
                  conditional
                />
              </>
            )}
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
            {ordered.map(({ x, attached }) => {
              const id = x.inst.instanceId;
              const buyable = canBuy(x.p, cat); // faux si forbids-equipment bloque tout (Likan/Muskh).
              const isLeader = id === fdl.leaderInstanceId;
              const guarded = x.inst.bodyguardOfInstanceId != null;
              const eligible = guardEligible(x.p) || guarded; // reste dispo pour se dé-désigner
              const free = costOf(id) === 0 && (guarded || x.p.modelId === "larbin");
              const open = !collapsed.has(id);
              const leadable = canLead(x.p, id);
              const rowIssues = issuesOf(id);
              const hasActions = x.p.traits.includes("femelle-fang") || x.p.id === "fangs-xayin-2" || eligible;
              return (
                <div
                  key={id}
                  draggable={!attached}
                  onDragStart={attached ? undefined : () => setDragId(id)}
                  onDragOver={attached ? undefined : (e) => e.preventDefault()}
                  onDrop={
                    attached
                      ? undefined
                      : () => {
                          if (dragId && dragId !== id) store.moveMember(dragId, id);
                          setDragId(null);
                        }
                  }
                  onDragEnd={() => setDragId(null)}
                  className={`rounded-md border-l-4 bg-white/45 shadow-sm transition hover:bg-white/60 ${attached ? "ml-6" : ""} ${dragId === id ? "opacity-40" : ""}`}
                  style={{ borderLeftColor: isLeader ? accent : attached ? `${accent}55` : "transparent" }}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {attached ? (
                      <span className="w-3 text-center opacity-50" style={{ color: accent }} title="Unité rattachée à son porteur">
                        ↳
                      </span>
                    ) : (
                      <span className="w-3 cursor-grab text-center opacity-30" title="Glisser pour réordonner">
                        ⠿
                      </span>
                    )}
                    {buyable ? (
                      <button
                        onClick={() => toggleCollapsed(id)}
                        title={open ? "Replier le résumé" : "Déplier le résumé des achats"}
                        className="w-4 text-center opacity-60 transition hover:opacity-100"
                        style={{ color: accent }}
                      >
                        {open ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}
                    <button
                      onClick={() => setModal({ kind: "edit", instanceId: id })}
                      className="flex flex-1 items-center text-left"
                    >
                      <span className="flex-1">
                        <span className="font-semibold" style={{ color: deep }}>
                          {x.p.name}
                        </span>
                        {x.p.level && <span className="ml-1 opacity-50">{LEVEL[x.p.level]}</span>}
                        {rowIssues.length > 0 && (
                          <span className="ml-2" style={{ color: "#9a3b2b" }} title={rowIssues.join("\n")}>
                            ⚠
                          </span>
                        )}
                        {guarded && (
                          <span className="kh-display ml-2 text-[10px] uppercase tracking-wide" style={{ color: "#4a6b32" }}>
                            Garde du corps de {memberOf(x.inst.bodyguardOfInstanceId!)?.p.name}
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
                          onClick={() => store.setLeader(id)}
                          title="Promouvoir en Leader"
                          className="rounded-full border px-2.5 py-1 text-xs transition hover:bg-white/60"
                          style={{ borderColor: `${accent}66`, color: accent }}
                        >
                          Définir leader
                        </button>
                      )
                    )}
                    <span className={`w-16 text-right text-sm ${free ? "font-semibold" : ""}`} style={{ color: free ? "#4a6b32" : deep }}>
                      {free ? "gratuit" : `${costOf(id)} Ko`}
                    </span>
                    <button
                      onClick={() => store.removeMember(id)}
                      className="opacity-40 transition hover:text-red-700 hover:opacity-100"
                      title="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                  {hasActions && (
                    <div className="flex flex-wrap gap-2 px-3 pb-2.5 pl-9">
                      {x.p.traits.includes("femelle-fang") && (
                        <RecruitPill label="+ Likan" accent={accent} onClick={() => setModal({ kind: "recruit-likan", carrierInstanceId: id })} />
                      )}
                      {x.p.id === "fangs-xayin-2" && (
                        <RecruitPill label="+ Muskh" accent={accent} onClick={() => store.addAttached(id, "fangs-muskh-1")} />
                      )}
                      {eligible && (
                        <button
                          onClick={() => onGuardClick(id)}
                          title={
                            x.p.modelId === "djouked"
                              ? "Garde rapproché de Broutcha"
                              : "Garde du corps d'une Fille de Nyx"
                          }
                          className="rounded-full border px-2 py-0.5 text-xs transition"
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
                      added={x.inst.addedEquipmentIds}
                      removed={x.inst.removedBaseEquipmentIds}
                      grimoireId={x.inst.grimoireId}
                      spellIds={x.inst.spellIds}
                      issues={rowIssues}
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
        {isValid ? (
          <span className="rounded px-2 py-0.5 font-medium" style={{ background: "#4a6b3222", color: "#3c5a28" }}>
            ✓ Liste valide
          </span>
        ) : (
          <span
            className="rounded px-2 py-0.5 font-medium"
            style={{ background: "#9a3b2b22", color: "#9a3b2b" }}
            title={listErrors.join("\n")}
          >
            ⚠{" "}
            {[
              invalidCount > 0 ? `${invalidCount} figurine${invalidCount > 1 ? "s" : ""} en erreur` : null,
              ...listErrors,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        <span className="opacity-60">{items.length} figurines</span>
      </footer>

      {/* Modale : aperçu ou édition */}
      {modal?.kind === "preview" && modalModel && (
        <Overlay onClose={() => setModal(null)}>
          <CardPreview
            profiles={modalModel.profiles}
            cat={cat}
            accent={accent}
            deep={deep}
            onClose={() => setModal(null)}
            onAdd={(profileId) => store.addMember(profileId)}
            onInfo={setItemInfo}
            isAtLimit={(profileId) => {
              const p = cat.profiles.find((x) => x.id === profileId);
              return p ? atLimit(p) : false;
            }}
          />
        </Overlay>
      )}
      {modal?.kind === "edit" && editItem && (
        <Overlay onClose={() => setModal(null)}>
          <FigureEditor
            profile={editItem.p}
            cat={cat}
            added={editItem.inst.addedEquipmentIds}
            removed={editItem.inst.removedBaseEquipmentIds}
            upgrades={editItem.inst.specialCardIds ?? []}
            grimoire={editItem.inst.grimoireId ?? "none"}
            spells={editItem.inst.spellIds}
            accent={accent}
            deep={deep}
            onClose={() => setModal(null)}
            onAdd={(eid) => store.addEquip(editItem.inst.instanceId, eid)}
            onRemove={(eid) => store.removeEquip(editItem.inst.instanceId, eid)}
            onToggleBase={(eid) => store.toggleBase(editItem.inst.instanceId, eid)}
            munQty={(eid) => editItem.inst.munitions?.[eid] ?? 0}
            onMun={(eid, qty) => store.setMunition(editItem.inst.instanceId, eid, qty)}
            onToggleUpgrade={(cid) => store.toggleUpgrade(editItem.inst.instanceId, cid)}
            onGrimoire={(g) => store.setGrimoire(editItem.inst.instanceId, g)}
            onToggleSpell={(sid) => store.toggleSpell(editItem.inst.instanceId, sid)}
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
              {memberOf(modal.instanceId)?.p.name} sera lié à la Fille de Nyx choisie.
            </p>
            <div className="flex flex-col gap-1.5">
              {availableFilles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    store.setGuard(modal.instanceId, f.id);
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
      {modal?.kind === "recruit-level" &&
        (() => {
          const m = models.find((mm) => mm.id === modal.modelId);
          if (!m) return null;
          return (
            <Overlay onClose={() => setModal(null)}>
              <div className="space-y-3">
                <h3 className="kh-display text-lg font-bold" style={{ color: deep }}>
                  Recruter — {m.name}
                </h3>
                <p className="text-sm opacity-70">Choisir le niveau :</p>
                <div className="flex flex-col gap-1.5">
                  {m.profiles.map((p) => {
                    const max = atLimit(p);
                    return (
                      <button
                        key={p.id}
                        disabled={max}
                        onClick={() => {
                          store.addMember(p.id);
                          setModal(null);
                        }}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ borderColor: `${accent}44`, color: deep }}
                      >
                        <span>
                          {p.name} <span className="opacity-50">{LEVEL[p.level ?? 0]}</span>
                          {max && <span className="ml-1.5 text-[10px] uppercase tracking-wide">· max</span>}
                        </span>
                        <span className="text-xs opacity-60">{p.cost} Ko</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Overlay>
          );
        })()}
      {modal?.kind === "recruit-likan" &&
        (() => {
          const carrier = memberOf(modal.carrierInstanceId);
          const carrierLevel = carrier?.p.level ?? 0;
          const usedLevels = (carrier?.inst.attachedInstanceIds ?? [])
            .map((aid) => memberOf(aid)?.p)
            .filter((p): p is Profile => Boolean(p) && p!.modelId === "likan")
            .reduce((n, p) => n + (p.level ?? 0), 0);
          const remaining = carrierLevel - usedLevels;
          const likans = cat.profiles
            .filter((p) => p.modelId === "likan")
            .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
          return (
            <Overlay onClose={() => setModal(null)}>
              <div className="space-y-3">
                <h3 className="kh-display text-lg font-bold" style={{ color: deep }}>
                  Recruter un Likan
                </h3>
                <p className="text-sm opacity-70">
                  Capacité restante de {carrier?.p.name} : {remaining} (somme des niveaux des Likans ≤ niveau du porteur).
                </p>
                <div className="flex flex-col gap-1.5">
                  {likans.map((p) => {
                    const ok = (p.level ?? 0) <= remaining;
                    return (
                      <button
                        key={p.id}
                        disabled={!ok}
                        onClick={() => {
                          store.addAttached(modal.carrierInstanceId, p.id);
                          setModal(null);
                        }}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ borderColor: `${accent}44`, color: deep }}
                      >
                        <span>
                          {p.name} <span className="opacity-50">{LEVEL[p.level ?? 0]}</span>
                        </span>
                        <span className="text-xs opacity-60">{p.cost} Ko</span>
                      </button>
                    );
                  })}
                  {remaining <= 0 && <p className="text-sm opacity-60">Capacité de rattachement atteinte.</p>}
                </div>
              </div>
            </Overlay>
          );
        })()}
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
      {io === "export" && (
        <Overlay onClose={() => setIo(null)}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="kh-display text-lg font-bold" style={{ color: deep }}>
                Exporter
              </h3>
              <div className="inline-flex overflow-hidden rounded-md text-xs" style={{ boxShadow: `inset 0 0 0 1px ${accent}55` }}>
                {(["code", "texte"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setExportMode(m)}
                    className="px-3 py-1 transition"
                    style={exportMode === m ? { background: accent, color: "#f5ecd6" } : { color: accent }}
                  >
                    {m === "code" ? "Code portable" : "Texte"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm opacity-70">
              {exportMode === "code"
                ? "Code compact à partager ou réimporter sur un autre appareil."
                : "Roster lisible (partage/impression). Réimportable en best-effort."}
            </p>
            <textarea
              readOnly
              value={exportValue}
              onFocus={(e) => e.currentTarget.select()}
              className="h-48 w-full resize-none rounded bg-white/60 p-2 font-mono text-xs shadow-inner outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => navigator.clipboard?.writeText(exportValue)}
                className="rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow" style={{ background: accent }}
              >
                Copier
              </button>
              <button onClick={() => setIo(null)} className="rounded-md px-4 py-1.5 text-sm hover:bg-white/50">
                Fermer
              </button>
            </div>
          </div>
        </Overlay>
      )}
      {io === "import" && (
        <Overlay onClose={() => setIo(null)}>
          <div className="space-y-3">
            <h3 className="kh-display text-lg font-bold" style={{ color: deep }}>
              Importer une liste
            </h3>
            <p className="text-sm opacity-70">Colle un code portable (KA1:…) ou un roster texte. Remplace la liste en cours.</p>
            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
                setImportUnresolved([]);
                setPendingImport(null);
              }}
              placeholder="KA1:…  ou  roster texte"
              className="h-32 w-full resize-none rounded bg-white/60 p-2 font-mono text-xs shadow-inner outline-none"
            />
            {importError && <p className="text-sm" style={{ color: "#9a3b2b" }}>⚠ {importError}</p>}
            {importUnresolved.length > 0 && (
              <div className="rounded-md bg-black/5 p-2 text-xs" style={{ color: "#9a3b2b" }}>
                <p className="font-semibold">Avertissements :</p>
                <ul className="mt-1 space-y-0.5">
                  {importUnresolved.map((l, k) => (
                    <li key={k}>· {l.trim()}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              {pendingImport ? (
                <button
                  onClick={() => {
                    store.loadSaved(pendingImport);
                    setIo(null);
                  }}
                  className="rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow"
                  style={{ background: accent }}
                >
                  Charger quand même
                </button>
              ) : (
                <button
                  onClick={runImport}
                  disabled={importText.trim() === ""}
                  className="rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-40"
                  style={{ background: accent }}
                >
                  Charger
                </button>
              )}
              <button onClick={() => setIo(null)} className="rounded-md px-4 py-1.5 text-sm hover:bg-white/50">
                Annuler
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────
