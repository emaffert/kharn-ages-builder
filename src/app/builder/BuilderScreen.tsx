import { useEffect, useMemo, useState } from "react";
import type { ListDocument, Profile } from "@core";
import type { ListStore } from "../useListStore";
import { FACTIONS, LEVEL, canBuy, isDependent, type ItemInfo, type Modal, type ModelEntry } from "./shared";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button, Tag, Dialog, SegmentedControl, Toast, ToastProvider } from "@ui";
import { RecruitPill } from "./components";
import { FactionEmblem } from "./FactionEmblem";
import { SortableUnit } from "./SortableUnit";
import { EditIcon, TrashIcon, SearchIcon } from "./icons";
import { CardPreview } from "./CardPreview";
import { FigureEditor } from "./FigureEditor";
import { RosterGroup } from "./RosterGroup";
import { PurchaseSummary } from "./PurchaseSummary";
import { encodeList } from "../io/listCode";
import { exportText } from "../io/listText";
import { resolveImport } from "./importList";

/** Écran 2 : construction de la liste (roster à gauche, liste au centre, barre d'actions, modales). */

export function BuilderScreen({ store, onNew }: { store: ListStore; onNew: () => void }) {
  const cat = store.catalog;
  const { evaluation, fdl } = store;
  const factionId = fdl.factionId;
  const fac = FACTIONS.find((f) => f.id === factionId) ?? FACTIONS[0];
  const factionVars = {
    "--faction": fac.color,
    "--faction-2": fac.colorBright,
    "--faction-deep": fac.colorDeep,
  } as React.CSSProperties;
  const [modal, setModal] = useState<Modal>(null);
  const [rosterQuery, setRosterQuery] = useState("");
  const [showRoster, setShowRoster] = useState(false); // tiroir roster (mobile : aside masqué)
  const [saved, setSaved] = useState(false);
  // Réordonnancement : glisser depuis la poignée (petite distance d'activation pour préserver les clics).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) store.moveMember(String(active.id), String(over.id));
  };
  const onSave = async () => {
    await store.saveCurrent();
    setSaved(true); // le toast se referme seul (durée Radix) → onOpenChange(false)
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
      const { doc, warnings } = await resolveImport(cat, importText);
      if (warnings.length > 0) {
        setImportUnresolved(warnings);
        setPendingImport(doc);
      } else {
        store.loadSaved(doc);
        setIo(null);
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import impossible.");
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

  // Ordre d'affichage : chaque figurine de premier niveau porte ses unités rattachées (Likan/Muskh),
  // rendues juste sous elle. Seuls les groupes de premier niveau sont réordonnables (drag & drop).
  type Item = NonNullable<ReturnType<typeof memberOf>>;
  const attachedIds = new Set(items.flatMap((x) => x.inst.attachedInstanceIds ?? []));
  const groups: { x: Item; children: Item[] }[] = items
    .filter((x) => !attachedIds.has(x.inst.instanceId))
    .map((x) => ({
      x,
      children: (x.inst.attachedInstanceIds ?? [])
        .map((cid) => memberOf(cid))
        .filter((c): c is Item => Boolean(c)),
    }));
  const topLevelIds = groups.map((g) => g.x.inst.instanceId);

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

  // Contenu du roster, partagé entre l'aside desktop et la modale mobile.
  const rosterInner = (
    <>
      <div className="bld-roster-head">
        <label className="bld-search">
          <SearchIcon />
          <input
            value={rosterQuery}
            onChange={(e) => setRosterQuery(e.target.value)}
            placeholder="Rechercher un profil…"
          />
        </label>
      </div>
      <div className="bld-roster-scroll">
        {models.length === 0 ? (
          <p className="bld-empty">
            {rosterQuery.trim() !== ""
              ? "Aucun profil ne correspond à la recherche."
              : `Aucune figurine à recruter pour ${fac.name} pour l'instant.`}
          </p>
        ) : (
          <>
            <RosterGroup label="Personnages" items={personnages} maxed={modelMaxed} onQuickAdd={onQuickAdd} onOpen={(id) => setModal({ kind: "preview", modelId: id })} />
            <RosterGroup label="Troupes" items={troupes} maxed={modelMaxed} onQuickAdd={onQuickAdd} onOpen={(id) => setModal({ kind: "preview", modelId: id })} />
            <RosterGroup
              label="Recrutement conditionnel"
              hint="via un porteur dans la liste"
              items={conditionnels}
              onOpen={(id) => setModal({ kind: "preview", modelId: id })}
              conditional
            />
          </>
        )}
      </div>
    </>
  );

  // Rendu d'une ligne d'unité. `handle` (poignée dnd-kit) n'est fourni que pour les figurines
  // de premier niveau ; les rattachées suivent leur porteur et ne se glissent pas seules.
  const renderUnit = (
    x: Item,
    attached: boolean,
    handle?: { isDragging: boolean; handleProps: Record<string, unknown> },
  ) => {
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
        className={`bld-unit${isLeader ? " is-leader" : ""}${rowIssues.length > 0 ? " is-error" : ""}${attached ? " is-attached" : ""}${handle?.isDragging ? " is-dragging" : ""}`}
      >
        <div className="bld-unit-main">
          {!attached && (
            <button type="button" className="bld-grip" title="Glisser pour réordonner" {...(handle?.handleProps ?? {})}>
              ⠿
            </button>
          )}
          <div className={`bld-thumb${attached ? " sm" : ""}`}>
            <FactionEmblem kind={fac.emblem} className="sig" />
            <span className="lvl">{LEVEL[x.p.level ?? 0] || "·"}</span>
          </div>
          <div className="bld-uinfo">
            <div className="bld-uname">
              <button className="nm" onClick={() => setModal({ kind: "edit", instanceId: id })}>
                {x.p.name}
              </button>
              {x.p.level ? <span className="lvltag">{LEVEL[x.p.level]}</span> : null}
              {isLeader && <span className="bld-crest-badge">❖ Meneur</span>}
              {attached && <Tag>rattaché</Tag>}
            </div>
            {guarded && (
              <div className="bld-tags">
                <Tag tone="moss">Garde du corps de {memberOf(x.inst.bodyguardOfInstanceId!)?.p.name}</Tag>
              </div>
            )}
            {rowIssues.length > 0 && <div className="bld-urow-msg">⚠ {rowIssues.join(" · ")}</div>}
          </div>
          {free ? (
            <div className="bld-ucost free">gratuit</div>
          ) : (
            <div className="bld-ucost">
              {costOf(id)} <span className="ko">Ko</span>
            </div>
          )}
          <div className="bld-uactions">
            {buyable && (
              <button
                className="bld-toggle"
                onClick={() => toggleCollapsed(id)}
                title={open ? "Replier le résumé" : "Déplier le résumé des achats"}
              >
                {open ? "▾" : "▸"}
              </button>
            )}
            {!attached && !isLeader && leadable && (
              <button className="bld-setleader" onClick={() => store.setLeader(id)} title="Promouvoir en meneur">
                Définir meneur
              </button>
            )}
            {!attached && (
              <button className="bld-icon" title="Éditer" onClick={() => setModal({ kind: "edit", instanceId: id })}>
                <EditIcon />
              </button>
            )}
            <button className="bld-icon danger" title="Retirer" onClick={() => store.removeMember(id)}>
              <TrashIcon />
            </button>
          </div>
        </div>

        {hasActions && (
          <div className="bld-pills">
            {x.p.traits.includes("femelle-fang") && (
              <RecruitPill label="+ Likan" onClick={() => setModal({ kind: "recruit-likan", carrierInstanceId: id })} />
            )}
            {x.p.id === "fangs-xayin-2" && (
              <RecruitPill label="+ Muskh" onClick={() => store.addAttached(id, "fangs-muskh-1")} />
            )}
            {eligible && (
              <button
                className={`bld-pill${guarded ? " on" : ""}`}
                onClick={() => onGuardClick(id)}
                title={x.p.modelId === "djouked" ? "Garde rapproché de Broutcha" : "Garde du corps d'une Fille de Nyx"}
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
  };

  const formatLabel = store.list.format === "bataille" ? "Bataille" : "Escarmouche";
  const errorTotal = invalidCount + listErrors.length;
  const validityTitle = [
    invalidCount > 0 ? `${invalidCount} figurine${invalidCount > 1 ? "s" : ""} en erreur` : null,
    ...listErrors,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <ToastProvider>
      <div className="bld-root" style={factionVars}>
      {/* Bandeau de liste : identité + jauge-forge + validation + actions */}
      <div className="bld-listbar">
        <button className="bld-back" onClick={onNew} title="Créer une nouvelle liste">
          ← Nouvelle liste
        </button>
        <FactionEmblem kind={fac.emblem} className="bld-crest" />
        <div className="bld-id">
          <input
            className="bld-name"
            value={store.list.name}
            onChange={(e) => store.setName(e.target.value)}
            aria-label="Nom de la liste"
          />
          <div className="bld-meta">
            <span className="bld-faction-chip">{fac.name}</span>
            <span className="bld-dot" />
            <span>{formatLabel}</span>
            <span className="bld-dot" />
            <span>
              {items.length} figurine{items.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="bld-forge">
          <div className="bld-gauge">
            <div className="bld-gauge-top">
              <span className="bld-gauge-label">Budget</span>
              <span className="bld-gauge-val">
                {total} <span className="lim">/ {limit} Ko</span>
              </span>
            </div>
            <div className="bld-gauge-track">
              <div className={`bld-gauge-fill${overLimit ? " over" : ""}`} style={{ width: `${ratio}%` }} />
            </div>
          </div>
          {isValid ? (
            <div className="bld-validity ok">
              <span className="big">✓</span> Liste valide
            </div>
          ) : (
            <div className="bld-validity err" title={validityTitle}>
              <span className="big">⚠</span> {errorTotal} erreur{errorTotal > 1 ? "s" : ""}
            </div>
          )}
          <div className="bld-actions">
            <Button onClick={() => { setImportText(""); setImportError(null); setIo("import"); }}>Importer</Button>
            <Button onClick={() => setIo("export")}>Exporter</Button>
            <Button variant="primary" onClick={onSave}>
              Sauvegarder
            </Button>
          </div>
        </div>
      </div>

      <div className="bld-body">
        {/* Roster */}
        <aside className="bld-roster">{rosterInner}</aside>

        {/* Liste */}
        <section className="bld-list">
          <div className="bld-list-inner">
            <button className="bld-add-mobile" onClick={() => setShowRoster(true)}>
              + Ajouter depuis le roster
            </button>
            {groups.length === 0 && (
              <p className="bld-empty">Liste vide — ajoute des figurines depuis le roster.</p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
                {groups.map(({ x, children }) => (
                  <SortableUnit key={x.inst.instanceId} id={x.inst.instanceId}>
                    {(handle) => (
                      <>
                        {renderUnit(x, false, handle)}
                        {children.map((c) => renderUnit(c, true))}
                      </>
                    )}
                  </SortableUnit>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </section>
      </div>

      {/* Pied : légende */}
      <footer className="bld-foot">
        <span>Fer de Lance · {fac.name}</span>
        <span className="bld-dot" />
        <span className="bld-leg"><span className="bld-swatch" style={{ background: "var(--ember)" }} /> Meneur</span>
        <span className="bld-leg"><span className="bld-swatch" style={{ background: "var(--moss)" }} /> Gratuit</span>
        <span className="bld-leg"><span className="bld-swatch" style={{ background: "var(--scorch)" }} /> Erreur</span>
        <span style={{ flex: 1 }} />
        <span>
          {items.length} figurine{items.length > 1 ? "s" : ""}
        </span>
      </footer>

      {/* Modale roster (mobile) : l'aside étant masqué sous `md`. */}
      {showRoster && (
        <Dialog open onOpenChange={(o) => !o && setShowRoster(false)} title={`Recruter · ${fac.name}`} size="md">
          <div className="bld-root" style={{ ...factionVars, background: "transparent" }}>
            {rosterInner}
          </div>
        </Dialog>
      )}

      {/* Modale : aperçu ou édition */}
      {modal?.kind === "preview" && modalModel && (
        <Dialog open onOpenChange={(o) => !o && setModal(null)} title={modalModel.name} size="lg">
          <CardPreview
            profiles={modalModel.profiles}
            cat={cat}
            onClose={() => setModal(null)}
            onAdd={(profileId) => store.addMember(profileId)}
            onInfo={setItemInfo}
            isAtLimit={(profileId) => {
              const p = cat.profiles.find((x) => x.id === profileId);
              return p ? atLimit(p) : false;
            }}
          />
        </Dialog>
      )}
      {modal?.kind === "edit" && editItem && (
        <Dialog
          open
          onOpenChange={(o) => !o && setModal(null)}
          title={`${editItem.p.name} ${LEVEL[editItem.p.level ?? 0]}`.trim()}
          size="lg"
          footer={
            <>
              <span className="bld-ucost" style={{ fontSize: 15 }}>
                {costOf(editItem.inst.instanceId)} <span className="ko">Ko</span>
              </span>
              <span style={{ flex: 1 }} />
              <Button variant="ghost" onClick={() => setModal(null)}>Fermer</Button>
            </>
          }
        >
          <FigureEditor
            profile={editItem.p}
            cat={cat}
            added={editItem.inst.addedEquipmentIds}
            removed={editItem.inst.removedBaseEquipmentIds}
            upgrades={editItem.inst.specialCardIds ?? []}
            grimoire={editItem.inst.grimoireId ?? "none"}
            spells={editItem.inst.spellIds}
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
        </Dialog>
      )}
      {modal?.kind === "guard" && (
        <Dialog open onOpenChange={(o) => !o && setModal(null)} title="Garde du corps" size="sm">
          <p className="mdl-note">{memberOf(modal.instanceId)?.p.name} sera lié à la Fille de Nyx choisie.</p>
          <div className="mdl-list">
            {availableFilles.map((f) => (
              <button
                key={f.id}
                className="mdl-choice"
                onClick={() => {
                  store.setGuard(modal.instanceId, f.id);
                  setModal(null);
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {modal?.kind === "recruit-level" &&
        (() => {
          const m = models.find((mm) => mm.id === modal.modelId);
          if (!m) return null;
          return (
            <Dialog open onOpenChange={(o) => !o && setModal(null)} title={`Recruter — ${m.name}`} size="sm">
              <p className="mdl-note">Choisir le niveau :</p>
              <div className="mdl-list">
                {m.profiles.map((p) => {
                  const max = atLimit(p);
                  return (
                    <button
                      key={p.id}
                      disabled={max}
                      className="mdl-choice"
                      onClick={() => {
                        store.addMember(p.id);
                        setModal(null);
                      }}
                    >
                      <span>
                        {p.name} <span className="lvl">{LEVEL[p.level ?? 0]}</span>
                        {max && <span className="max">max</span>}
                      </span>
                      <span className="cost">{p.cost} Ko</span>
                    </button>
                  );
                })}
              </div>
            </Dialog>
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
            <Dialog open onOpenChange={(o) => !o && setModal(null)} title="Recruter un Likan" size="sm">
              <p className="mdl-note">
                Capacité restante de {carrier?.p.name} : {remaining} (somme des niveaux des Likans ≤ niveau du porteur).
              </p>
              <div className="mdl-list">
                {likans.map((p) => {
                  const ok = (p.level ?? 0) <= remaining;
                  return (
                    <button
                      key={p.id}
                      disabled={!ok}
                      className="mdl-choice"
                      onClick={() => {
                        store.addAttached(modal.carrierInstanceId, p.id);
                        setModal(null);
                      }}
                    >
                      <span>
                        {p.name} <span className="lvl">{LEVEL[p.level ?? 0]}</span>
                      </span>
                      <span className="cost">{p.cost} Ko</span>
                    </button>
                  );
                })}
                {remaining <= 0 && <p className="mdl-note">Capacité de rattachement atteinte.</p>}
              </div>
            </Dialog>
          );
        })()}
      {itemInfo && (
        <Dialog open onOpenChange={(o) => !o && setItemInfo(null)} title={itemInfo.title} size="sm">
          <span className="mdl-price">{itemInfo.price}</span>
          <div>
            {itemInfo.lines.map((l, k) => (
              <p key={k} className="mdl-line">
                {l}
              </p>
            ))}
          </div>
        </Dialog>
      )}
      {io === "export" && (
        <Dialog
          open
          onOpenChange={(o) => !o && setIo(null)}
          title="Exporter"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIo(null)}>Fermer</Button>
              <Button variant="primary" onClick={() => navigator.clipboard?.writeText(exportValue)}>Copier</Button>
            </>
          }
        >
          <div className="mb-3">
            <SegmentedControl
              ariaLabel="Format d'export"
              value={exportMode}
              onChange={setExportMode}
              options={[
                { value: "code", label: "Code portable" },
                { value: "texte", label: "Texte" },
              ]}
            />
          </div>
          <p className="mdl-note">
            {exportMode === "code"
              ? "Code compact à partager ou réimporter sur un autre appareil."
              : "Roster lisible (partage/impression). Réimportable en best-effort."}
          </p>
          <textarea
            className="mdl-textarea"
            style={{ height: "38vh" }}
            readOnly
            value={exportValue}
            onFocus={(e) => e.currentTarget.select()}
          />
        </Dialog>
      )}
      {io === "import" && (
        <Dialog
          open
          onOpenChange={(o) => !o && setIo(null)}
          title="Importer une liste"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIo(null)}>Annuler</Button>
              {pendingImport ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    store.loadSaved(pendingImport);
                    setIo(null);
                  }}
                >
                  Charger quand même
                </Button>
              ) : (
                <Button variant="primary" disabled={importText.trim() === ""} onClick={runImport}>
                  Charger
                </Button>
              )}
            </>
          }
        >
          <p className="mdl-note">Colle un code portable (KA1:…) ou un roster texte. Remplace la liste en cours.</p>
          <textarea
            className="mdl-textarea"
            style={{ height: "26vh" }}
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
              setImportUnresolved([]);
              setPendingImport(null);
            }}
            placeholder="KA1:…  ou  roster texte"
          />
          {importError && <p className="mdl-warn">⚠ {importError}</p>}
          {importUnresolved.length > 0 && (
            <div className="mdl-warn-box">
              <p className="font-semibold">Avertissements :</p>
              <ul className="mt-1 space-y-0.5">
                {importUnresolved.map((l, k) => (
                  <li key={k}>· {l.trim()}</li>
                ))}
              </ul>
            </div>
          )}
        </Dialog>
      )}
      <Toast open={saved} onOpenChange={setSaved} title="✓ Liste enregistrée" />
      </div>
    </ToastProvider>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────
