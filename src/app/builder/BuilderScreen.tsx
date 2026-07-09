import { useEffect, useMemo, useState } from "react";
import { eligibleMountsFor, iconFor, mountLabel, slotCapacity, type Profile } from "@core";
import type { ListStore } from "../useListStore";
import {
  FACTIONS,
  LEVEL,
  canBuy,
  isAttachmentDependent,
  isDependent,
  isRecruitableIn,
  profileMatchesAnySelector,
  protecteeSelectorsFor,
  recruitableDependentGroups,
  type DependentGroup,
  type ItemInfo,
  type Modal,
  type ModelEntry,
} from "./shared";
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
import { Button, Dialog, SegmentedControl, Toast, ToastProvider, Popover } from "@ui";
import { RecruitPill } from "./components";
import { FactionEmblem } from "./FactionEmblem";
import { SortableUnit } from "./SortableUnit";
import { TrashIcon, SearchIcon } from "./icons";
import { CardPreview } from "./CardPreview";
import { FigureEditor } from "./FigureEditor";
import { MountPicker, MountPreview, MountSheet } from "./MountDialog";
import { RosterGroup } from "./RosterGroup";
import { OstPanel } from "./OstPanel";
import { PurchaseSummary } from "./PurchaseSummary";
import { MountPurchaseSummary } from "./MountPurchaseSummary";
import { encodeList } from "../io/listCode";
import { exportText } from "../io/listText";

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
  const [confirmBack, setConfirmBack] = useState(false);
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
  const [io, setIo] = useState<null | "export">(null);
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

  const models: ModelEntry[] = cat.models
    .map((m) => ({
      id: m.id,
      name: m.name,
      profiles: m.profileIds
        .map((id) => cat.profiles.find((p) => p.id === id))
        .filter((p): p is Profile => Boolean(p))
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0)),
    }))
    .map((m) => ({ ...m, icon: m.profiles[0] ? iconFor(cat, m.profiles[0]) : undefined }))
    // Roster de la faction choisie + profils recrutables inter-factions (sans logo, apatride,
    // « Allié des X » via une contrainte faction-membership).
    .filter((m) => m.profiles.length > 0 && m.profiles.some((p) => isRecruitableIn(p, factionId)))
    .filter((m) => rosterQuery.trim() === "" || m.name.toLowerCase().includes(rosterQuery.trim().toLowerCase()));
  const kindOf = (m: ModelEntry) => {
    const p0 = m.profiles[0];
    if (isDependent(p0, cat)) return "cond";
    if (p0.isNamed || p0.limitation.kind === "U" || p0.limitation.kind === "P") return "perso";
    return "troupe";
  };
  const byName = (a: ModelEntry, b: ModelEntry) => a.name.localeCompare(b.name);
  const personnages = models.filter((m) => kindOf(m) === "perso").sort(byName);
  const troupes = models.filter((m) => kindOf(m) === "troupe").sort(byName);
  const conditionnels = models.filter((m) => kindOf(m) === "cond").sort(byName);
  // Montures éligibles à la faction : consultables (fiche) depuis le roster, comme Likans/Muskh.
  const q = rosterQuery.trim().toLowerCase();
  const mountTypesForFaction = cat.mountTypes
    .filter((t) => t.factionEligibility.includes(factionId))
    .filter((t) => q === "" || t.name.toLowerCase().includes(q))
    .map((t) => {
      const levels = cat.mounts.filter((m) => m.typeId === t.id).sort((a, b) => a.level - b.level);
      const first = levels[0];
      return {
        type: t,
        minCost: levels.length ? Math.min(...levels.map((m) => m.cost)) : 0,
        icon: first?.icon ?? (t.cardImage ? cat.icons?.[t.cardImage] : undefined),
      };
    })
    .filter((e) => e.type && cat.mounts.some((m) => m.typeId === e.type.id))
    .sort((a, b) => a.type.name.localeCompare(b.type.name));

  // Limite de recrutement comptée par (modèle, niveau) : les variantes de loadout (même modèle ET
  // même niveau) partagent la limite ; des niveaux différents comptent séparément (un Père de Famille
  // N2 « U » et un N3 « U » coexistent). Lim U/P → 1 ; Lim X → `value`.
  const groupKey = (p: Profile) => (p.modelId != null ? `${p.modelId}#${p.level ?? 0}` : p.id);
  // Occupation d'un emplacement (modèle, niveau) : génériques de ce couple + personnages qui le consomment (LIM P).
  const slotOccupancy = (modelId: string, level: number) =>
    fdl.members.filter((m) => {
      const mp = cat.profiles.find((x) => x.id === m.profileId);
      if (!mp) return false;
      if (mp.modelId === modelId && mp.level === level) return true;
      const cs = mp.limitation.consumesSlotOf;
      return cs != null && cs.modelId === modelId && cs.level === level;
    }).length;
  const atLimit = (p: Profile) => {
    // 1) Limitation propre du profil (par groupe modèle#niveau) : U/P → 1, X → valeur (+ bonus
    //    `limit-modifier`, ex. Lieutenant khérops : +1 aux Khérops « X »).
    const own =
      p.limitation.kind === "X"
        ? (p.limitation.value ?? Infinity) + (evaluation.limitBonuses[groupKey(p)] ?? 0)
        : p.limitation.kind === "U" || p.limitation.kind === "P"
          ? 1
          : Infinity;
    if (own !== Infinity) {
      const key = groupKey(p);
      const count = fdl.members.filter((m) => {
        const mp = cat.profiles.find((x) => x.id === m.profileId);
        return mp != null && groupKey(mp) === key;
      }).length;
      if (count >= own) return true;
    }
    // Capacité d'un emplacement = limitation de base + bonus `limit-modifier` (ex. Lieutenant : +1).
    const capacityOf = (modelId: string, level: number) =>
      slotCapacity(cat, modelId, level) + (evaluation.limitBonuses[`${modelId}#${level}`] ?? 0);
    // 2) Emplacement que ce personnage consomme (LIM P) déjà plein.
    const cs = p.limitation.consumesSlotOf;
    if (cs && slotOccupancy(cs.modelId, cs.level) >= capacityOf(cs.modelId, cs.level)) return true;
    // 3) Ce profil est un générique dont l'emplacement est saturé par des consommateurs (ex. Paladin III + Gaubert).
    if (p.modelId != null && p.level != null && slotOccupancy(p.modelId, p.level) >= capacityOf(p.modelId, p.level)) {
      return true;
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
  const [editLimit, setEditLimit] = useState<string | null>(null); // budget en cours d'édition (null = affichage)

  // Coûts & validation : entièrement dérivés du moteur (evaluateList).
  const costOf = (id: string) => evaluation.costByInstance[id] ?? 0;
  const total = evaluation.totalCost;
  const limit = store.list.pointsLimit ?? 300;
  const ratio = Math.min(100, (total / Math.max(1, limit)) * 100);
  const remaining = limit - total;
  const commitLimit = () => {
    if (editLimit !== null && editLimit.trim() !== "") {
      store.setPointsLimit(Math.min(9999, Math.max(0, Math.floor(Number(editLimit)) || 0)));
    }
    setEditLimit(null);
  };
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
  // Détail des erreurs pour le popover (au lieu d'une infobulle au survol) : figurines fautives + erreurs de liste.
  const instanceErrors = [
    ...new Set(
      evaluation.issues.filter((is) => is.severity === "error" && is.instanceId).map((is) => String(is.instanceId)),
    ),
  ].map((id) => ({ id, name: memberOf(id)?.p.name ?? "Figurine", messages: issuesOf(id) }));
  const scrollToUnit = (id: string) =>
    document.getElementById(`unit-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  // « Non sauvegardé » : la copie en base a-t-elle le même horodatage que la liste courante ?
  const savedCopy = store.savedLists.find((l) => l.id === store.list.id);
  const dirty = savedCopy ? savedCopy.updatedAt !== store.list.updatedAt : items.length > 0;
  const onBack = () => (dirty ? setConfirmBack(true) : onNew());

  // Leader : personnage OU l'une des deux figurines les plus chères.
  const topTwo = new Set([...items].sort((a, b) => b.p.cost - a.p.cost).slice(0, 2).map((x) => x.inst.instanceId));
  const canLead = (p: Profile, id: string) => isChar(p) || topTwo.has(id);

  // Garde du corps (désignation) : dérivé des effets `designation` du catalogue. Chaque protégé n'offre
  // qu'une place → on retire dynamiquement ceux déjà gardés. La gratuité/remise vient du moteur.
  const takenFdN = new Set(fdl.members.map((m) => m.bodyguardOfInstanceId).filter(Boolean) as string[]);
  // Protégés disponibles pour un garde donné : figurines correspondant à `designation.of`,
  // pas déjà gardées, et distinctes du garde lui-même.
  const availableProtectees = (guardId: string, guardProfile: Profile): Item[] => {
    const sels = protecteeSelectorsFor(guardProfile, cat);
    if (sels.length === 0) return [];
    return items.filter(
      (x) =>
        x.inst.instanceId !== guardId &&
        !takenFdN.has(x.inst.instanceId) &&
        profileMatchesAnySelector(x.p, sels),
    );
  };
  const guardEligible = (guardId: string, p: Profile) => availableProtectees(guardId, p).length > 0;
  const onGuardClick = (id: string) => {
    const m = memberOf(id);
    if (!m) return;
    if (m.inst.bodyguardOfInstanceId != null) return store.setGuard(id, null); // dé-désigner
    const options = availableProtectees(id, m.p);
    if (options.length === 1) store.setGuard(id, options[0].inst.instanceId);
    else if (options.length > 1) setModal({ kind: "guard", instanceId: id });
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
  const mountItem =
    modal?.kind === "mount" || modal?.kind === "mount-sheet" ? memberOf(modal.instanceId) : undefined;
  // Améliorations partagées actives dans le Fer de Lance (payées une fois, cochées sur tous les éligibles).
  const sharedActiveCardIds = [...new Set((store.fdl?.members ?? []).flatMap((m) => m.specialCardIds ?? []))].filter(
    (id) => cat.specialCards.find((c) => c.id === id)?.shared,
  );

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
          {rosterQuery && (
            <button type="button" onClick={() => setRosterQuery("")} title="Effacer" className="bld-search-x">
              ✕
            </button>
          )}
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
              items={conditionnels}
              onOpen={(id) => setModal({ kind: "preview", modelId: id })}
              conditional
            />
            {mountTypesForFaction.length > 0 && (
              <div>
                <div className="bld-grp-label">
                  Montures<span className="line" />
                </div>
                {mountTypesForFaction.map(({ type, minCost, icon }) => (
                  <div key={type.id} className="bld-ritem is-cond">
                    <button
                      className="bld-rmain"
                      onClick={() => setModal({ kind: "mount-preview", typeId: type.id })}
                      title="Voir la fiche"
                    >
                      <span className="bld-rmed">{icon ? <img className="bld-rmed-img" src={icon} alt="" /> : "🐎"}</span>
                      <span className="bld-rname">{type.name}</span>
                      <span className="bld-rcost">{minCost}+</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
    const icon = iconFor(cat, x.p);
    const buyable = canBuy(x.p, cat); // faux si forbids-equipment bloque tout (Likan/Muskh).
    const isLeader = id === fdl.leaderInstanceId;
    const guarded = x.inst.bodyguardOfInstanceId != null;
    const guardOf = guarded ? memberOf(x.inst.bodyguardOfInstanceId!)?.p.name : null;
    const eligible = guardEligible(id, x.p) || guarded; // reste dispo pour se dé-désigner
    const free = costOf(id) === 0 && guarded;
    const open = !collapsed.has(id);
    const leadable = canLead(x.p, id);
    const rowIssues = issuesOf(id);
    const depGroups = recruitableDependentGroups(x.p, cat); // Likan, Muskh… dérivés des contraintes
    // Capacité de rattachement restante du porteur (Σ niveaux des rattachés « à capacité » ≤ son niveau).
    const usedCapacity = (x.inst.attachedInstanceIds ?? [])
      .map((aid) => memberOf(aid)?.p)
      .filter((p): p is Profile => Boolean(p) && isAttachmentDependent(p!))
      .reduce((n, p) => n + (p.level ?? 0), 0);
    const remainingCapacity = (x.p.level ?? 0) - usedCapacity;
    // Un groupe est indisponible si tous ses profils sont à leur limitation, ou (capacité) si aucun ne rentre.
    const groupDisabled = (g: DependentGroup) => {
      const free = g.profiles.filter((p) => !atLimit(p));
      if (free.length === 0) return true;
      return g.capacityLimited && !free.some((p) => (p.level ?? 0) <= remainingCapacity);
    };
    // Monture : proposée sur une figurine éligible non montée (et pas sur une sous-ligne).
    const canAddMount = !attached && !x.inst.mount && eligibleMountsFor(cat, x.p).length > 0;
    const hasActions = depGroups.length > 0 || eligible || canAddMount;
    return (
      <div
        key={id}
        id={`unit-${id}`}
        className={`bld-unit${isLeader ? " is-leader" : ""}${rowIssues.length > 0 ? " is-error" : ""}${attached ? " is-attached" : ""}${handle?.isDragging ? " is-dragging" : ""}`}
      >
        <div
          className="bld-unit-main"
          onClick={(e) => {
            // Tout le cadre (icône → prix), hors boutons/champs, ouvre l'édition de la figurine.
            if ((e.target as HTMLElement).closest("button, input, a")) return;
            setModal({ kind: "edit", instanceId: id });
          }}
        >
          {!attached && (
            <button type="button" className="bld-grip" title="Glisser pour réordonner" {...(handle?.handleProps ?? {})}>
              <span className="bld-grip-dots">⠿</span>
            </button>
          )}
          <div className={`bld-thumb${attached ? " sm" : ""}`}>
            {icon && <img className="bld-thumb-img" src={icon} alt="" />}
            <FactionEmblem kind={fac.emblem} className="sig" />
            {!icon && <span className="lvl">{LEVEL[x.p.level ?? 0] || "·"}</span>}
          </div>
          <div className="bld-uinfo">
            <div className="bld-uname">
              <button className="nm" onClick={() => setModal({ kind: "edit", instanceId: id })}>
                {x.p.name}
              </button>
              {x.p.level ? <span className="lvltag">{LEVEL[x.p.level]}</span> : null}
              {isLeader && <span className="bld-crest-badge">❖ Meneur</span>}
              {!attached && !isLeader && leadable && (
                <button
                  className="bld-setleader-chip"
                  onClick={() => store.setLeader(id)}
                  title="Promouvoir en meneur"
                >
                  ❖ Définir meneur
                </button>
              )}
            </div>
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
                aria-expanded={open}
                aria-label={open ? "Replier le détail" : "Déplier le détail des achats"}
                title={open ? "Replier le détail" : "Déplier le détail des achats"}
              >
                {open ? "▾" : "▸"}
              </button>
            )}
            <button className="bld-icon danger" title="Retirer" onClick={() => store.removeMember(id)}>
              <TrashIcon />
            </button>
          </div>
        </div>

        {hasActions && (
          <div className="bld-pills">
            {depGroups.map((g) => {
              const disabled = groupDisabled(g);
              return (
                <RecruitPill
                  key={g.modelId}
                  label={`+ ${g.modelName}`}
                  disabled={disabled}
                  title={disabled ? `${g.modelName} : limite atteinte` : undefined}
                  onClick={() => {
                    if (disabled) return;
                    if (g.capacityLimited || g.profiles.length > 1) {
                      setModal({ kind: "recruit-attached", carrierInstanceId: id, modelId: g.modelId });
                    } else {
                      store.addAttached(id, g.profiles[0].id);
                    }
                  }}
                />
              );
            })}
            {eligible && (
              <button
                className={`bld-pill${guarded ? " on" : ""}`}
                onClick={() => onGuardClick(id)}
                title={guarded ? "Retirer la désignation" : "Désigner comme garde du corps"}
              >
                {guarded ? `✓ Garde du corps de ${guardOf}` : "Garde du corps"}
              </button>
            )}
            {canAddMount && (
              <RecruitPill label="+ Monture" onClick={() => setModal({ kind: "mount", instanceId: id })} />
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
            upgrades={[...new Set([...(x.inst.specialCardIds ?? []), ...sharedActiveCardIds])]}
            upgradeCounts={x.inst.specialCardCounts}
            munitions={x.inst.munitions ?? {}}
            equipmentUpgrades={x.inst.equipmentUpgrades ?? {}}
            grantedUpgrades={evaluation.grantedUpgrades[x.inst.instanceId] ?? []}
            costRules={evaluation.equipmentCostRules[x.inst.instanceId] ?? []}
            grimoireDiscount={evaluation.grimoireDiscount[x.inst.instanceId] ?? {}}
            mountId={x.inst.mount?.mountId}
            mountOptionIds={x.inst.mountOptionIds}
            onPick={setItemInfo}
          />
        )}
      </div>
    );
  };

  // Sous-ligne de la monture (rendue comme une figurine rattachée, mais nichée dans le cavalier).
  const renderMountSubline = (x: Item) => {
    const id = x.inst.instanceId;
    const mid = x.inst.mount!.mountId;
    const mc = evaluation.mountCost[id] ?? 0;
    const mount = cat.mounts.find((m) => m.id === mid);
    const mType = cat.mountTypes.find((t) => t.id === mount?.typeId);
    const mIcon = mount?.icon ?? (mType?.cardImage ? cat.icons?.[mType.cardImage] : undefined);
    return (
      <div className="bld-unit is-attached">
        <div
          className="bld-unit-main"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button, input, a")) return;
            setModal({ kind: "mount-sheet", instanceId: id });
          }}
        >
          <div className="bld-thumb sm">
            {mIcon ? <img className="bld-thumb-img" src={mIcon} alt="" /> : <span className="lvl">🐎</span>}
          </div>
          <div className="bld-uinfo">
            <div className="bld-uname">
              <button className="nm" onClick={() => setModal({ kind: "mount-sheet", instanceId: id })}>
                {mountLabel(cat, mid)}
              </button>
              <span className="lvltag">Monture</span>
            </div>
          </div>
          <div className="bld-ucost">
            {mc} <span className="ko">Ko</span>
          </div>
          <div className="bld-uactions">
            <button className="bld-icon danger" title="Retirer la monture" onClick={() => store.setMount(id, null)}>
              <TrashIcon />
            </button>
          </div>
        </div>
        <MountPurchaseSummary
          cat={cat}
          factionId={x.p.factionId}
          mount={x.inst.mount!}
          mountOptionIds={x.inst.mountOptionIds}
          onPick={setItemInfo}
        />
      </div>
    );
  };

  const formatLabel = store.list.format === "bataille" ? "Bataille" : "Escarmouche";
  const errorTotal = invalidCount + listErrors.length;

  return (
    <ToastProvider>
      <div className="bld-root" style={factionVars}>
      {/* Bandeau de liste : identité + jauge-forge + validation + actions */}
      <div className="bld-listbar">
        <button className="bld-back" onClick={onBack} title="Revenir à l'accueil">
          ← Retour
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
                {total}{" "}
                <span className="lim">
                  /{" "}
                  {editLimit === null ? (
                    <button
                      type="button"
                      className="bld-lim-edit"
                      title="Modifier le budget"
                      onClick={() => setEditLimit(String(limit))}
                    >
                      {limit}
                    </button>
                  ) : (
                    <input
                      className="bld-lim-input"
                      type="number"
                      min={0}
                      max={9999}
                      autoFocus
                      value={editLimit}
                      aria-label="Budget maximum (Ko)"
                      onChange={(e) => setEditLimit(e.target.value)}
                      onBlur={commitLimit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitLimit();
                        if (e.key === "Escape") setEditLimit(null);
                      }}
                    />
                  )}{" "}
                  Ko
                </span>
              </span>
            </div>
            <div className="bld-gauge-track">
              <div className={`bld-gauge-fill${overLimit ? " over" : ""}`} style={{ width: `${ratio}%` }} />
            </div>
            <div className={`bld-gauge-rem${overLimit ? " over" : ""}`}>
              {remaining >= 0 ? `${remaining} Ko restants` : `${-remaining} Ko au-dessus`}
            </div>
          </div>
          {isValid ? (
            <div className="bld-validity ok">
              <span className="big">✓</span> Liste valide
            </div>
          ) : (
            <Popover
              trigger={
                <button className="bld-validity err" type="button">
                  <span className="big">⚠</span> {errorTotal} erreur{errorTotal > 1 ? "s" : ""}
                </button>
              }
            >
              <div className="bld-errpop">
                {instanceErrors.map((e) => (
                  <button key={e.id} type="button" className="bld-errpop-item" onClick={() => scrollToUnit(e.id)}>
                    <span className="nm">{e.name}</span>
                    <span className="msg">{e.messages.join(" · ")}</span>
                  </button>
                ))}
                {listErrors.map((m, k) => (
                  <div key={k} className="bld-errpop-line">
                    {m}
                  </div>
                ))}
              </div>
            </Popover>
          )}
          <div className="bld-actions">
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
            <OstPanel cat={cat} list={store.list} issues={evaluation.issues} onToggle={store.toggleOstCard} />
            {groups.length === 0 && (
              <p className="bld-empty">Liste vide - ajoute des figurines depuis le roster.</p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
                {groups.map(({ x, children }) => (
                  <SortableUnit key={x.inst.instanceId} id={x.inst.instanceId}>
                    {(handle) => (
                      <>
                        {renderUnit(x, false, handle)}
                        {x.inst.mount && renderMountSubline(x)}
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

      {/* Pied réservé (vide pour l'instant) - masqué tant qu'il n'a pas de contenu (.bld-foot:empty). */}
      <footer className="bld-foot" />

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
        <CardPreview
          profiles={modalModel.profiles}
          cat={cat}
          title={modalModel.name}
          open
          onOpenChange={(o) => !o && setModal(null)}
          onAdd={(profileId) => store.addMember(profileId)}
          onInfo={setItemInfo}
          isAtLimit={(profileId) => {
            const p = cat.profiles.find((x) => x.id === profileId);
            return p ? atLimit(p) : false;
          }}
        />
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
            upgrades={[...new Set([...(editItem.inst.specialCardIds ?? []), ...sharedActiveCardIds])]}
            grimoire={editItem.inst.grimoireId ?? "none"}
            spells={editItem.inst.spellIds}
            onAdd={(eid) => store.addEquip(editItem.inst.instanceId, eid)}
            onRemove={(eid) => store.removeEquip(editItem.inst.instanceId, eid)}
            onToggleBase={(eid) => store.toggleBase(editItem.inst.instanceId, eid)}
            munitions={editItem.inst.munitions ?? {}}
            onMunTier={(eid, typeId, ti) => store.setMunitionTier(editItem.inst.instanceId, eid, typeId, ti)}
            onToggleUpgrade={(cid) =>
              cat.specialCards.find((c) => c.id === cid)?.shared
                ? store.toggleSharedAmelioration(editItem.inst.instanceId, cid)
                : store.toggleUpgrade(editItem.inst.instanceId, cid)
            }
            upgradeCounts={editItem.inst.specialCardCounts}
            onSetUpgradeCount={(cid, qty) => store.setUpgradeCount(editItem.inst.instanceId, cid, qty)}
            onGrimoire={(g) => store.setGrimoire(editItem.inst.instanceId, g)}
            onToggleSpell={(sid) => store.toggleSpell(editItem.inst.instanceId, sid)}
            onInfo={setItemInfo}
            equipmentUpgrades={editItem.inst.equipmentUpgrades ?? {}}
            onToggleEquipmentUpgrade={(eid, uid) =>
              store.toggleEquipmentUpgrade(editItem.inst.instanceId, eid, uid)
            }
            mods={{
              statDeltas: evaluation.statDeltas[editItem.inst.instanceId],
              skillValues: evaluation.skillValues[editItem.inst.instanceId],
              grantedSkills: evaluation.grantedSkills[editItem.inst.instanceId],
              grantedTraitIds: evaluation.grantedTraits[editItem.inst.instanceId],
              grantedUpgrades: evaluation.grantedUpgrades[editItem.inst.instanceId],
              effectSources: evaluation.effectSources[editItem.inst.instanceId],
              grantedMasteryDice: evaluation.grantedMasteryDice[editItem.inst.instanceId],
              limitBonus: evaluation.limitBonuses[groupKey(editItem.p)] ?? 0,
              equipmentCostRules: evaluation.equipmentCostRules[editItem.inst.instanceId],
              mountAllonge: evaluation.mountAllonge[editItem.inst.instanceId],
              grimoireDiscount: evaluation.grimoireDiscount[editItem.inst.instanceId],
            }}
            mountId={editItem.inst.mount?.mountId}
            mountOptionIds={editItem.inst.mountOptionIds}
            onSetMountOption={(oid, v) => store.setMountOption(editItem.inst.instanceId, oid, v)}
          />
        </Dialog>
      )}
      {modal?.kind === "mount" && mountItem && (
        <Dialog open onOpenChange={(o) => !o && setModal(null)} title={`Monture - ${mountItem.p.name}`} size="sm">
          <p className="mdl-note">Choisir une monture :</p>
          <MountPicker
            cat={cat}
            rider={mountItem.p}
            currentId={mountItem.inst.mount?.mountId}
            onSet={(mid) => {
              store.setMount(mountItem.inst.instanceId, mid);
              setModal(null);
            }}
          />
        </Dialog>
      )}
      {modal?.kind === "mount-sheet" &&
        mountItem &&
        (() => {
          const mid = mountItem.inst.mount?.mountId;
          const mount = mid ? cat.mounts.find((m) => m.id === mid) : undefined;
          const type = mount ? cat.mountTypes.find((t) => t.id === mount.typeId) : undefined;
          const instId = mountItem.inst.instanceId;
          return (
            <Dialog
              open
              onOpenChange={(o) => !o && setModal(null)}
              title={mount ? mountLabel(cat, mount.id) : "Monture"}
              size="md"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setModal({ kind: "mount", instanceId: instId })}>
                    Changer
                  </Button>
                  <Button variant="danger" onClick={() => { store.setMount(instId, null); setModal(null); }}>
                    Retirer
                  </Button>
                  <span style={{ flex: 1 }} />
                  <Button variant="ghost" onClick={() => setModal(null)}>Fermer</Button>
                </>
              }
            >
              {mount ? (
                <MountSheet
                  cat={cat}
                  mount={mount}
                  type={type}
                  rider={mountItem.p}
                  instance={mountItem.inst}
                  onInfo={setItemInfo}
                  onSetOption={(oid, v) => store.setMountOption(instId, oid, v)}
                  onToggleEquip={(eid) => store.toggleMountEquip(instId, eid)}
                  onToggleEquipUpgrade={(eid, uid) => store.toggleMountEquipUpgrade(instId, eid, uid)}
                />
              ) : (
                <p className="mdl-note">Monture introuvable.</p>
              )}
            </Dialog>
          );
        })()}
      {modal?.kind === "mount-preview" && (
        <Dialog
          open
          onOpenChange={(o) => !o && setModal(null)}
          title={cat.mountTypes.find((t) => t.id === modal.typeId)?.name ?? "Monture"}
          size="md"
          footer={<><span style={{ flex: 1 }} /><Button variant="ghost" onClick={() => setModal(null)}>Fermer</Button></>}
        >
          <MountPreview cat={cat} typeId={modal.typeId} onInfo={setItemInfo} />
        </Dialog>
      )}
      {modal?.kind === "guard" &&
        (() => {
          const guard = memberOf(modal.instanceId);
          const options = guard ? availableProtectees(modal.instanceId, guard.p) : [];
          return (
            <Dialog open onOpenChange={(o) => !o && setModal(null)} title="Garde du corps" size="sm">
              <p className="mdl-note">{guard?.p.name} sera désigné garde du corps de :</p>
              <div className="mdl-list">
                {options.map((x) => (
                  <button
                    key={x.inst.instanceId}
                    className="mdl-choice"
                    onClick={() => {
                      store.setGuard(modal.instanceId, x.inst.instanceId);
                      setModal(null);
                    }}
                  >
                    {x.p.name}
                  </button>
                ))}
              </div>
            </Dialog>
          );
        })()}
      {modal?.kind === "recruit-level" &&
        (() => {
          const m = models.find((mm) => mm.id === modal.modelId);
          if (!m) return null;
          return (
            <Dialog open onOpenChange={(o) => !o && setModal(null)} title={`Recruter - ${m.name}`} size="sm">
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
      {modal?.kind === "recruit-attached" &&
        (() => {
          const carrier = memberOf(modal.carrierInstanceId);
          const modelName = cat.models.find((m) => m.id === modal.modelId)?.name ?? "figurine";
          const choices = cat.profiles
            .filter((p) => p.modelId === modal.modelId && isDependent(p, cat))
            .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
          const capacityLimited = choices.some(isAttachmentDependent);
          const carrierLevel = carrier?.p.level ?? 0;
          // Seuls les rattachés « à capacité » (contrainte attachment) consomment le niveau du porteur.
          const usedLevels = (carrier?.inst.attachedInstanceIds ?? [])
            .map((aid) => memberOf(aid)?.p)
            .filter((p): p is Profile => Boolean(p) && isAttachmentDependent(p!))
            .reduce((n, p) => n + (p.level ?? 0), 0);
          const remaining = carrierLevel - usedLevels;
          return (
            <Dialog open onOpenChange={(o) => !o && setModal(null)} title={`Recruter - ${modelName}`} size="sm">
              {capacityLimited && (
                <p className="mdl-note">
                  Capacité restante de {carrier?.p.name} : {remaining} (somme des niveaux des rattachés ≤ niveau du porteur).
                </p>
              )}
              <div className="mdl-list">
                {choices.map((p) => {
                  const ok = !atLimit(p) && (!capacityLimited || (p.level ?? 0) <= remaining);
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
                {capacityLimited && remaining <= 0 && <p className="mdl-note">Capacité de rattachement atteinte.</p>}
              </div>
            </Dialog>
          );
        })()}
      {itemInfo && (
        <Dialog open onOpenChange={(o) => !o && setItemInfo(null)} title={itemInfo.title} size="sm">
          {itemInfo.price && <span className="mdl-price">{itemInfo.price}</span>}
          {itemInfo.lines.length > 0 && (
            <div>
              {itemInfo.lines.map((l, k) => (
                <p key={k} className="mdl-line">
                  {l}
                </p>
              ))}
            </div>
          )}
          {itemInfo.sources && itemInfo.sources.length > 0 && (
            <div className={`mdl-sources${itemInfo.lines.length === 0 ? " mdl-sources--bare" : ""}`}>
              <div className="mdl-sources-label">Modifiée par</div>
              {itemInfo.sources.map((s, k) => (
                <p key={k} className="mdl-source">
                  <b>{s.label}</b>
                  {s.text ? ` - ${s.text}` : ""}
                </p>
              ))}
            </div>
          )}
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
      {confirmBack && (
        <Dialog
          open
          onOpenChange={(o) => !o && setConfirmBack(false)}
          title="Modifications non sauvegardées"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmBack(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmBack(false);
                  onNew();
                }}
              >
                Quitter
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await onSave();
                  setConfirmBack(false);
                  onNew();
                }}
              >
                Enregistrer et quitter
              </Button>
            </>
          }
        >
          <p className="mdl-note">Cette liste comporte des modifications non enregistrées. Elles seront perdues si tu quittes sans enregistrer.</p>
        </Dialog>
      )}
      <Toast open={saved} onOpenChange={setSaved} title="✓ Liste enregistrée" />
      </div>
    </ToastProvider>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────
