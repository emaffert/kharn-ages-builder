import { useState } from "react";
import {
  equipmentDiscount,
  equipmentMatchesEquipFilter,
  munitionKindForEquip,
  resolveMunitionLines,
  temboEquipmentSurcharge,
  type Catalog,
  type Profile,
} from "@core";
import type { ProfileMods } from "./ProfileStatCard";
import { SectionTitle, SlotChip } from "./components";
import {
  CAT_LABEL,
  PURCHASE_CATS,
  equipBits,
  equipInfo,
  equipReservedOk,
  forbiddenCats,
  type ItemInfo,
} from "./shared";

/** Choix d'équipement en deux volets : catalogue disponible (gauche) ↔ équipé (droite). */
export function EquipPanel({
  profile: p,
  cat,
  added,
  removed,
  onAdd,
  onRemove,
  onToggleBase,
  munitions,
  onMunTier,
  onInfo,
  grantedUpgrades,
  costRules,
  equipmentUpgrades,
  onToggleEquipmentUpgrade,
  hasMount,
}: {
  profile: Profile;
  cat: Catalog;
  added: string[];
  removed: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleBase: (id: string) => void;
  munitions: Record<string, Record<string, number>>;
  onMunTier: (equipId: string, typeId: string, tierIndex: number | null) => void;
  onInfo: (info: ItemInfo) => void;
  grantedUpgrades: NonNullable<ProfileMods["grantedUpgrades"]>;
  costRules: NonNullable<ProfileMods["equipmentCostRules"]>;
  equipmentUpgrades: Record<string, string[]>;
  onToggleEquipmentUpgrade: (equipmentId: string, upgradeId: string) => void;
  /** La figurine a-t-elle une monture ? Débloque l'équipement de cavalier monté (Lance de cavalerie). */
  hasMount: boolean;
}) {
  const [query, setQuery] = useState("");
  const [openMun, setOpenMun] = useState<Record<string, boolean>>({}); // blocs de munitions dépliés, par arme
  const [catFilter, setCatFilter] = useState<string | null>(null); // puce de catégorie active (mono-sélection)
  const [facets, setFacets] = useState<Set<string>>(new Set()); // facettes d'armes actives (multi) : h1 / h2 / free
  const eq = (id: string) => cat.equipment.find((e) => e.id === id);
  const forbidden = forbiddenCats(p, cat);
  const activeBase = p.baseEquipmentIds.filter((id) => !removed.includes(id));

  const worn = [...activeBase, ...added].map(eq).filter((e): e is NonNullable<typeof e> => Boolean(e));
  // La limitation de mains ne s'applique qu'en jeu : on peut acheter autant d'armes que voulu.
  const armorCap = 1;
  const armorUsed = worn.filter((e) => e.category === "armure").length;
  const canWearArmor = !forbidden.has("armure");

  const blockReason = (e: Catalog["equipment"][number]): string | null => {
    if (e.category === "armure" && armorUsed >= armorCap) return "Emplacement d'armure déjà occupé";
    return null;
  };

  const q = query.trim().toLowerCase();
  const matches = (e: Catalog["equipment"][number]) => {
    if (q === "") return true;
    const hay = `${e.name} ${CAT_LABEL[e.category] ?? ""} ${e.category}`.toLowerCase();
    return hay.includes(q) || (CAT_LABEL[e.category] ?? "").toLowerCase().includes(q);
  };
  const ownerCount = (id: string) => cat.profiles.filter((pr) => pr.baseEquipmentIds.includes(id)).length;
  const isUnique = (e: Catalog["equipment"][number]) => ownerCount(e.id) === 1;

  // Pool disponible avant filtres de catégorie/facettes (sert aussi à compter les puces, comptes stables).
  const availAll = cat.equipment.filter(
    (e) =>
      // Équipement du CAVALIER monté (Lance de cavalerie) : proposé ici seulement s'il a une monture.
      // Équipement de la MONTURE (Caparaçon) : jamais ici (il s'achète sur la fiche de la monture).
      (e.mountEquipment == null || (e.mountEquipment === "rider" && hasMount)) &&
      PURCHASE_CATS.includes(e.category) &&
      !forbidden.has(e.category) &&
      equipReservedOk(e, p) &&
      !(isUnique(e) && !p.baseEquipmentIds.includes(e.id)) &&
      (!p.baseEquipmentIds.includes(e.id) || removed.includes(e.id)) &&
      !added.includes(e.id) &&
      matches(e),
  );

  // Filtres : catégorie en mono-sélection (sur la vraie catégorie de l'objet, donc une arme réservée reste
  // filtrable même si elle est affichée dans « Spécifique au personnage »), facettes d'armes en multi-sélection.
  const isWeaponCat = (c: string) => c === "arme-cac" || c === "arme-tir";
  const weaponCtx = catFilter == null || isWeaponCat(catFilter);
  const hasWeapons = availAll.some((e) => isWeaponCat(e.category));
  const handsFacets = [...facets].filter((f) => f === "h1" || f === "h2");
  const passFilters = (e: Catalog["equipment"][number]) => {
    if (catFilter && e.category !== catFilter) return false;
    if (weaponCtx) {
      // Le nombre de mains n'a de sens que sur une arme : activer 1/2 mains exclut les non-armes.
      if (handsFacets.length) {
        if (!isWeaponCat(e.category)) return false;
        const ok = handsFacets.some((f) =>
          f === "h1" ? e.hands === 1 || e.hands === "1-2" : e.hands === 2 || e.hands === "1-2",
        );
        if (!ok) return false;
      }
      if (facets.has("free") && e.cost !== 0) return false;
    }
    return true;
  };
  const avail = availAll.filter(passFilters);
  const catCounts = PURCHASE_CATS.map((c) => [c, availAll.filter((e) => e.category === c).length] as const).filter(
    ([, n]) => n > 0,
  );
  const hasFilter = q !== "" || catFilter !== null || facets.size > 0;

  const selectCat = (c: string | null) => {
    setCatFilter(c);
    if (c != null && !isWeaponCat(c)) setFacets(new Set()); // hors contexte arme : facettes sans objet
  };
  const toggleFacet = (f: string) =>
    setFacets((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  const UNIQUE = "__unique";
  const BASE_REMOVED = "__base_removed";
  // Spécifique au personnage : réservé à ce profil/modèle (ex. Marteau Tonnerre d'Ogodeï) ou base unique.
  const isCharSpecific = (e: Catalog["equipment"][number]) =>
    (e.reservedTo?.profileIds?.includes(p.id) ?? false) ||
    (p.modelId != null && (e.reservedTo?.modelIds?.includes(p.modelId) ?? false)) ||
    isUnique(e);
  // Catégories de tête : l'équipement de base RETIRÉ (pour identifier/remettre l'arme d'origine,
  // ex. swap d'arme des Guerriers via le Commandant), puis le spécifique au personnage.
  const groupOf = (e: Catalog["equipment"][number]) =>
    removed.includes(e.id) ? BASE_REMOVED : isCharSpecific(e) ? UNIQUE : e.category;
  const GROUP_LABEL: Record<string, string> = {
    ...CAT_LABEL,
    [BASE_REMOVED]: "Équipement de base retiré",
    [UNIQUE]: "Spécifique au personnage",
  };
  const byCat = [BASE_REMOVED, UNIQUE, ...PURCHASE_CATS]
    .map((g) => [g, avail.filter((e) => groupOf(e) === g)] as [string, typeof avail])
    .filter(([, v]) => v.length > 0);
  const addedCost = added.reduce((n, id) => n + (eq(id)?.cost ?? 0), 0);
  const removedCost = removed.reduce((n, id) => n + (eq(id)?.cost ?? 0), 0);
  const munTotal = worn.reduce(
    (n, e) =>
      n +
      resolveMunitionLines(munitionKindForEquip(cat, e.id), munitions[e.id]).reduce((s, l) => s + l.price, 0),
    0,
  );

  // Équipé regroupé par catégorie - mêmes en-têtes que « disponible » (base en tête de chaque groupe).
  const ownedResolved = [
    ...activeBase.map((id) => ({ id, isBase: true, e: eq(id) })),
    ...added.map((id) => ({ id, isBase: false, e: eq(id) })),
  ].filter((o): o is { id: string; isBase: boolean; e: NonNullable<ReturnType<typeof eq>> } => Boolean(o.e));
  const ownedCats = [
    ...PURCHASE_CATS,
    ...[...new Set(ownedResolved.map((o) => o.e.category))].filter((c) => !PURCHASE_CATS.includes(c)),
  ];
  const ownedByCat = ownedCats
    .map((c) => [c, ownedResolved.filter((o) => o.e.category === c)] as const)
    .filter(([, v]) => v.length > 0);

  // Munitions achetables (règles p.46) : pour chaque type, choix d'un palier (Aucun / prix → quantité).
  // Améliorations octroyées (opt-in par objet, ex. arme empoisonnée) applicables à cet équipement.
  const upgradeRow = (e: Catalog["equipment"][number]) => {
    const ups = grantedUpgrades.filter((g) => g.equipmentCategories.includes(e.category));
    if (ups.length === 0) return null;
    const active = equipmentUpgrades[e.id] ?? [];
    return (
      <div className="fe-upgrades">
        {ups.map((g) => (
          <label key={g.upgradeId} className="fe-upgrade">
            <input
              type="checkbox"
              className="ui-check"
              checked={active.includes(g.upgradeId)}
              onChange={() => onToggleEquipmentUpgrade(e.id, g.upgradeId)}
            />
            <span>{g.label}</span>
            <span className="fe-upgrade-cost">+{g.cost} Ko</span>
          </label>
        ))}
      </div>
    );
  };
  const munitionRow = (e: Catalog["equipment"][number]) => {
    const kind = munitionKindForEquip(cat, e.id);
    if (!kind) return null;
    const sel = munitions[e.id] ?? {};
    const open = openMun[e.id] ?? false;
    const base = e.baseMunitions ?? 0;
    const lines = resolveMunitionLines(kind, sel);
    const summaryParts = [
      ...(base > 0 ? [`${base} de base`] : []),
      ...lines.map((l) => `${l.qty} ${l.label}`),
    ];
    const summary = summaryParts.length ? summaryParts.join(", ") : "aucune";
    return (
      <div className="fe-mun-block">
        <button
          type="button"
          className="fe-mun-head"
          onClick={() => setOpenMun((s) => ({ ...s, [e.id]: !open }))}
          aria-expanded={open}
        >
          <span className="fe-mun-caret">{open ? "▾" : "▸"}</span>
          Munitions ({kind.label})
          {!open && <span className="fe-mun-sum">· {summary}</span>}
        </button>
        {open && base > 0 && (
          <div className="fe-mun-type">
            <span className="lab">De base</span>
            <span className="fe-mun-base">{base} incluses · gratuit</span>
          </div>
        )}
        {open &&
          kind.types.map((t) => {
          const cur = sel[t.id]; // indice de palier sélectionné, ou undefined
          return (
            <div key={t.id} className="fe-mun-type">
              <span className="lab">{t.label}</span>
              <button
                type="button"
                className={`fe-mun-opt${cur == null ? " on" : ""}`}
                onClick={() => onMunTier(e.id, t.id, null)}
              >
                Aucune
              </button>
              {kind.tierPrices.map((price, ti) => {
                const qty = t.quantities[ti] ?? 0;
                if (qty <= 0) return null; // type indisponible à ce palier
                return (
                  <button
                    key={ti}
                    type="button"
                    className={`fe-mun-opt${cur === ti ? " on" : ""}`}
                    onClick={() => onMunTier(e.id, t.id, ti)}
                    title={`${qty} ${t.label.toLowerCase()} pour ${price} Ko`}
                  >
                    {price} Ko · {qty}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Prix d'un objet, remise ET surcoût Tembo inclus. Remise (Ogodeï, Commandant…) et surcoût Tembo
  // (p.20) ne s'appliquent qu'aux objets ACHETÉS (pas l'équipement de base) : neutralisés pour `isBase`.
  const priceCell = (e: Catalog["equipment"][number], isBase: boolean) => {
    const disc = isBase ? 0 : equipmentDiscount(cat, e.id, costRules, removed);
    const surcharge = isBase ? 0 : temboEquipmentSurcharge(cat, p.traits, e.id);
    const adj = disc + surcharge;
    if (adj !== 0 && e.cost > 0) {
      const notes: string[] = [];
      if (disc < 0) {
        const sources = [
          ...new Set(
            costRules
              .filter(
                (r) =>
                  equipmentMatchesEquipFilter(cat, e.id, r) &&
                  (!r.requiresBaseSwap || removed.some((id) => equipmentMatchesEquipFilter(cat, id, r))),
              )
              .map((r) => r.label),
          ),
        ];
        notes.push(`Remise de ${-disc} Ko (${sources.join(", ")})`);
      }
      if (surcharge > 0) notes.push(`Surcoût Tembo +${surcharge} Ko`);
      const variant = adj > 0 ? "fe-item-cost--surcharge" : "fe-item-cost--disc";
      return (
        <span className={`fe-item-cost ${variant}`} title={notes.join(" · ")}>
          <s className="fe-item-cost-was">{e.cost}</s> {Math.max(0, e.cost + adj)} Ko
        </span>
      );
    }
    return <span className="fe-item-cost">{e.cost > 0 ? `${e.cost} Ko` : "gratuit"}</span>;
  };

  const equipWarning = armorUsed > armorCap ? "Plusieurs armures équipées." : null;

  return (
    <div className="fe-root">
      {equipWarning && <p className="fe-warn">⚠ {equipWarning}</p>}
      {canWearArmor && (
        <div className="flex flex-wrap items-center gap-2">
          <SlotChip label="Armure" used={armorUsed} cap={armorCap} />
        </div>
      )}

      <div className="fe-panes">
        {/* Volet équipé - à gauche (près de la fiche) ; l'équipement de base reste toujours en tête. */}
        <div>
          <div className="fe-section-head">
            <SectionTitle>Équipé</SectionTitle>
            <span className="tot">
              total <b>{p.cost + addedCost - removedCost + munTotal} Ko</b>
            </span>
          </div>
          <div className="fe-scroll">
            {ownedByCat.map(([c, list]) => (
              <div key={c}>
                <p className="fe-group-label">{CAT_LABEL[c] ?? c}</p>
                <div className="fe-col">
                  {list.map(({ id, isBase, e }) => (
                    <div key={id}>
                      <div className="fe-item is-clickable" onClick={() => onInfo(equipInfo(e))} title="Voir le détail">
                        <span className="fe-item-main">
                          <span className="fe-item-name">{e.name}</span>
                          {isBase && <span className="fe-badge-base">base</span>}
                        </span>
                        {priceCell(e, isBase)}
                        <button
                          className="fe-move rem"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (isBase) onToggleBase(id);
                            else onRemove(id);
                          }}
                          title={isBase ? "Retirer (libère l'emplacement)" : "Retirer"}
                        >
                          →
                        </button>
                      </div>
                      {munitionRow(e)}
                      {upgradeRow(e)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {ownedResolved.length === 0 && <p className="fe-mag-bonus">Rien d'équipé.</p>}
          </div>
        </div>

        {/* Volet disponible - à droite. */}
        <div>
          <SectionTitle>Disponible</SectionTitle>
          <input
            className="fe-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un équipement…"
          />
          {catCounts.length > 1 && (
            <div className="fe-filters" role="group" aria-label="Filtrer par catégorie">
              <button className="fe-chip" type="button" aria-pressed={catFilter === null} onClick={() => selectCat(null)}>
                Toutes<span className="n">{availAll.length}</span>
              </button>
              {catCounts.map(([c, n]) => (
                <button
                  key={c}
                  className="fe-chip"
                  type="button"
                  aria-pressed={catFilter === c}
                  onClick={() => selectCat(catFilter === c ? null : c)}
                >
                  {CAT_LABEL[c] ?? c}
                  <span className="n">{n}</span>
                </button>
              ))}
            </div>
          )}
          {weaponCtx && hasWeapons && (
            <div className="fe-facets" role="group" aria-label="Filtrer les armes">
              <span className="lab">Armes</span>
              {(
                [
                  ["h1", "1 main"],
                  ["h2", "2 mains"],
                  ["free", "Gratuit"],
                ] as const
              ).map(([f, label]) => (
                <button
                  key={f}
                  className="fe-facet"
                  type="button"
                  aria-pressed={facets.has(f)}
                  onClick={() => toggleFacet(f)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="fe-scroll">
            {byCat.map(([c, list]) => (
              <div key={c}>
                <p className="fe-group-label">{GROUP_LABEL[c]}</p>
                <div className="fe-col">
                  {list.map((e) => {
                    const blocked = blockReason(e);
                    const isBase = removed.includes(e.id);
                    return (
                      <div
                        key={e.id}
                        className={`fe-item is-clickable${blocked ? " is-blocked" : ""}`}
                        title={blocked ?? "Voir le détail"}
                        onClick={() => onInfo(equipInfo(e))}
                      >
                        <button
                          className="fe-move add"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (isBase) onToggleBase(e.id);
                            else onAdd(e.id);
                          }}
                          disabled={Boolean(blocked)}
                          title={blocked ?? (isBase ? "Remettre l'équipement de base" : "Ajouter")}
                        >
                          ←
                        </button>
                        <span className="fe-item-main">
                          <span className="fe-item-name">{e.name}</span>
                          {isBase && <span className="fe-badge-base">base</span>}
                          {equipBits(e) && <span className="fe-item-bits">{equipBits(e)}</span>}
                        </span>
                        {priceCell(e, isBase)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {byCat.length === 0 && (
              <p className="fe-mag-bonus">{hasFilter ? "Aucun résultat." : "Aucun équipement disponible."}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
