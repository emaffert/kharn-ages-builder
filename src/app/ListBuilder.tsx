import { useEffect, useMemo, useState } from "react";
import { specialCardsForProfile } from "@ui/explain";
import {
  castWays as coreCastWays,
  pageBonusSources as corePageBonusSources,
  forbiddenGrimoires as coreForbiddenGrimoires,
  castableSpells as coreCastableSpells,
} from "@core";
import type { Catalog, ListDocument, Profile, ProfileInstance, Spell } from "@core";
import { useListStore, type ListStore } from "./useListStore";
import { decodeList, encodeList } from "./listCode";
import { exportText, importText as parseTextList } from "./listText";

/**
 * Constructeur de liste joueur. Flux : écran de sélection de faction → écran de construction
 * (roster + liste) avec barre d'actions ; aperçu de carte et édition d'une figurine en modales.
 * L'état vit dans `useListStore` (ListDocument) ; coûts et validation viennent de `evaluateList`.
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
// Adaptateurs minces vers `src/core/engine/magic.ts` (logique unique côté cœur). Les panneaux
// travaillent avec (profil, listes) ; on synthétise une `ProfileInstance` pour appeler le cœur.

function synthInstance(p: Profile, selectedUpgrades: string[], wornEquipIds: string[]): ProfileInstance {
  return {
    instanceId: "",
    profileId: p.id,
    addedEquipmentIds: wornEquipIds,
    removedBaseEquipmentIds: p.baseEquipmentIds, // → équipement porté (cœur) = wornEquipIds
    spellIds: [],
    specialCardIds: selectedUpgrades,
  };
}

const forbiddenGrimoires = (p: Profile) => coreForbiddenGrimoires(p);

function castWays(p: Profile, cat: Catalog, selectedUpgrades: string[], wornEquipIds: string[] = p.baseEquipmentIds): string[] {
  return coreCastWays(cat, p, synthInstance(p, selectedUpgrades, wornEquipIds), new Set(p.traits));
}

function pageBonusSources(p: Profile, cat: Catalog, selectedUpgrades: string[]): { name: string; amount: number }[] {
  return corePageBonusSources(cat, p, synthInstance(p, selectedUpgrades, []), new Set(p.traits));
}

function pageBonus(p: Profile, cat: Catalog, selectedUpgrades: string[]): number {
  return pageBonusSources(p, cat, selectedUpgrades).reduce((n, s) => n + s.amount, 0);
}

function spellsFor(p: Profile, cat: Catalog, ways: string[]): Spell[] {
  return coreCastableSpells(cat, p, new Set(p.traits), ways);
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
  | { kind: "edit"; instanceId: string }
  | { kind: "guard"; instanceId: string }
  | { kind: "recruit-likan"; carrierInstanceId: string }
  | { kind: "recruit-level"; modelId: string };
/** Fiche courte d'un achat (arme, équipement, carte) affichée au clic depuis le résumé. */
type ItemInfo = { title: string; price: string; lines: string[] };

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
                <p className="font-semibold">Lignes non reconnues (ignorées) :</p>
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
                  try {
                    onLoad(await decodeList(importText));
                  } catch {
                    const r = parseTextList(store.catalog, importText);
                    if (r.doc.fersDeLance[0].members.length === 0) {
                      setImportError("Ni code valide, ni figurine reconnue dans le texte.");
                    } else if (r.unresolved.length > 0) {
                      setImportUnresolved(r.unresolved);
                      setPendingImport(r.doc);
                    } else {
                      onLoad(r.doc);
                    }
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
    try {
      store.loadSaved(await decodeList(importText));
      setIo(null);
    } catch {
      const r = parseTextList(cat, importText);
      if (r.doc.fersDeLance[0].members.length === 0) {
        setImportError("Aucune figurine reconnue.");
        return;
      }
      if (r.unresolved.length > 0) {
        setImportUnresolved(r.unresolved);
        setPendingImport(r.doc);
      } else {
        store.loadSaved(r.doc);
        setIo(null);
      }
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
                <p className="font-semibold">Lignes non reconnues (ignorées) :</p>
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

function ActionBtn({
  children,
  accent,
  primary,
  onClick,
}: {
  children: React.ReactNode;
  accent: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
  maxed,
  accent,
  onQuickAdd,
}: {
  label: string;
  hint?: string;
  items: ModelEntry[];
  onOpen: (id: string) => void;
  conditional?: boolean;
  maxed?: (m: ModelEntry) => boolean;
  accent?: string;
  onQuickAdd?: (m: ModelEntry) => void;
}) {
  if (items.length === 0) return null;
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
          const isMax = maxed?.(m) ?? false;
          return (
            <li key={m.id} className="flex items-center gap-1">
              <button
                onClick={() => onOpen(m.id)}
                title={isMax ? "Limite de recrutement atteinte" : "Voir la carte"}
                className={`flex flex-1 items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-white/60 ${isMax ? "opacity-40" : ""}`}
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
                  {isMax && <span className="ml-1.5 text-[10px] uppercase tracking-wide">· max</span>}
                </span>
                <span className="text-xs opacity-70">
                  {conditional ? "🔗" : multi ? `${minCost}+` : `${first.cost}`}
                </span>
              </button>
              {onQuickAdd && !conditional && (
                <button
                  onClick={() => onQuickAdd(m)}
                  disabled={isMax}
                  title={isMax ? "Limite atteinte" : multi ? "Ajouter (choix du niveau)" : "Ajouter à la liste"}
                  className="shrink-0 rounded px-1.5 text-sm font-bold transition hover:bg-white/60 disabled:opacity-30"
                  style={{ color: accent }}
                >
                  +
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecruitPill({ label, accent, onClick }: { label: string; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-2 py-0.5 text-xs transition hover:bg-white/60"
      style={{ borderColor: `${accent}66`, color: accent }}
    >
      {label}
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
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
  grimoireId,
  spellIds,
  issues,
  onPick,
}: {
  p: Profile;
  cat: Catalog;
  accent: string;
  added: string[];
  removed: string[];
  grimoireId?: string;
  spellIds: string[];
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
  // Magie : le grimoire acheté (avec son coût) puis une entrée « N sorts » (coût total).
  const magie: SummaryChip[] = [];
  const grim = grimoireId ? cat.grimoires.find((g) => g.id === grimoireId) : undefined;
  if (grim) {
    magie.push(
      chip(grim.name, {
        title: grim.name,
        price: `${grim.cost} Ko`,
        lines: [`${grim.pages === "illimite" ? "∞" : grim.pages} pages`],
      }),
    );
  }
  if (spellIds.length > 0) {
    const spells = spellIds.map((id) => cat.spells.find((s) => s.id === id)).filter((s): s is Spell => Boolean(s));
    const sCost = spells.reduce((n, s) => n + (s.cost ?? 0), 0);
    magie.push(
      chip(`${spells.length} sort${spells.length > 1 ? "s" : ""}`, {
        title: "Sorts sélectionnés",
        price: `${sCost} Ko`,
        lines: spells.map((s) => `${s.name} — ${s.pages ?? 0} p${s.cost ? ` · ${s.cost} Ko` : ""}`),
      }),
    );
  }
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

/** Carte de statistiques d'un profil (tags, stats, compétences cliquables, règles) + cartes liées. */
function ProfileStatCard({
  p,
  cat,
  accent,
  deep,
  onInfo,
}: {
  p: Profile;
  cat: Catalog;
  accent: string;
  deep: string;
  onInfo: (info: ItemInfo) => void;
}) {
  const cards = specialCardsForProfile(p, cat);
  const precisions = p.skills.filter((s) => s.precision);
  const showSkill = (skillId: string, label: string) => {
    const sk = cat.skills.find((x) => x.id === skillId);
    onInfo({ title: label, price: "compétence", lines: [sk?.sourceText ?? "Description indisponible."] });
  };
  const limLabel =
    p.limitation.kind === "special"
      ? "Limitation •"
      : `Limitation ${p.limitation.kind}${p.limitation.value != null ? ` ${p.limitation.value}` : ""}`;
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

      {cards.length > 0 && (
        <div>
          <SectionTitle accent={accent}>Cartes liées</SectionTitle>
          <ul className="space-y-1 text-sm">
            {cards.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() =>
                    onInfo({ title: c.name, price: c.cost > 0 ? `${c.cost} Ko` : "auto", lines: c.rulesText.map((r) => r.text) })
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
    </div>
  );
}

function CardPreview({
  profiles,
  cat,
  accent,
  deep,
  onClose,
  onAdd,
  isAtLimit,
  onInfo,
}: {
  profiles: Profile[];
  cat: Catalog;
  accent: string;
  deep: string;
  onClose: () => void;
  onAdd: (profileId: string) => void;
  isAtLimit: (profileId: string) => boolean;
  onInfo: (info: ItemInfo) => void;
}) {
  const [idx, setIdx] = useState(0);
  const p = profiles[idx];
  const dependent = isDependent(p);
  const carrier = carrierLabel(p, cat);
  return (
    <div className="space-y-4">
      {profiles.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-60">Niveau</span>
          <div className="inline-flex overflow-hidden rounded-md" style={{ boxShadow: `inset 0 0 0 1px ${accent}66` }}>
            {profiles.map((pf, i) => (
              <button
                key={pf.id}
                onClick={() => setIdx(i)}
                className="px-3 py-1 text-sm transition"
                style={i === idx ? { background: accent, color: "#f5ecd6" } : { color: accent }}
              >
                {LEVEL[pf.level ?? 0]} · {pf.cost}
              </button>
            ))}
          </div>
        </div>
      )}
      <ProfileStatCard p={p} cat={cat} accent={accent} deep={deep} onInfo={onInfo} />
      <div className="flex justify-end gap-2">
        {dependent ? (
          <p className="mr-auto rounded-md bg-black/5 px-3 py-2 text-xs italic opacity-70">
            Se recrute via {carrier ?? "un porteur"}, pas directement.
          </p>
        ) : (
          <button
            onClick={() => {
              onAdd(p.id);
              onClose();
            }}
            disabled={isAtLimit(p.id)}
            title={isAtLimit(p.id) ? "Limite de recrutement atteinte pour ce niveau" : undefined}
            className="rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: accent }}
          >
            {isAtLimit(p.id) ? "Limite atteinte" : "Ajouter à la liste"}
          </button>
        )}
        <button onClick={onClose} className="rounded-md px-4 py-1.5 text-sm hover:bg-white/50">
          Fermer
        </button>
      </div>
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
