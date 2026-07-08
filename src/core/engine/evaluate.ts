import type {
  Catalog,
  Constraint,
  Effect,
  EffectScope,
  FerDeLance,
  ListDocument,
  MasteryDomain,
  Mount,
  Profile,
  ProfileInstance,
  Selector,
  SpecialCard,
} from "../model";
import { armorsWorn, castWays, forbiddenGrimoires, pageCapacity, pagesUsed, wornEquipmentIds } from "./magic";
import { totalMunitionCost } from "./munitions";

/**
 * Moteur d'évaluation d'une liste : calcul de coût + validation, en tenant compte
 * des effets dynamiques (octrois, déblocages, modificateurs de coût).
 * Référence : docs/schema-donnees.md - couche 2 (ordre de résolution).
 *
 * Opérations d'effet prises en charge ici : `cost-delta`, `cost-set`, `grant-trait`,
 * `grant-skill` (`spell-pages` est traité par engine/magic.ts pour la capacité de pages).
 * TODO - opérations définies au schéma mais PAS encore appliquées à l'évaluation :
 *   `stat-modifier` (ex. Apprentie de Nyx : +niveau en I), `cap`.
 *   Tant qu'elles ne sont pas implémentées, ces effets sont sans incidence sur coût/stats.
 */

/** Compétence octroyée par un effet (avec sa valeur éventuelle pour les compétences « à valeur »). */
export type GrantedSkill = { skillId: string; value?: string | number };

/**
 * Amélioration d'équipement octroyée par un effet `unlock-upgrade` : la figurine peut acheter
 * cette amélioration (opt-in) sur chacun de ses équipements des catégories visées, pour `cost` Ko/objet.
 */
export type GrantedUpgrade = {
  upgradeId: string;
  label: string;
  cost: number;
  equipmentCategories: string[];
  /** Compétences (avec valeur éventuelle) conférées tant qu'un équipement porte cette amélioration (Borax). */
  grantsSkills?: GrantedSkill[];
};

export interface Issue {
  severity: "error" | "warning";
  ferDeLanceId?: string;
  instanceId?: string;
  ruleId?: string;
  message: string;
  /** Wording officiel - fait foi. */
  sourceText: string;
}

export interface EvaluationResult {
  totalCost: number;
  costByInstance: Record<string, number>;
  /** Coût propre de la monture (niveau + son équipement), par figurine montée. Affiché sur la sous-ligne. */
  mountCost: Record<string, number>;
  costByFerDeLance: Record<string, number>;
  /** Traits octroyés par effet, par instance (en plus des traits de base du profil). Pour l'affichage. */
  grantedTraits: Record<string, string[]>;
  /** Compétences octroyées par effet, par instance (avec valeur éventuelle, ex. Héroïque « défense »). */
  grantedSkills: Record<string, GrantedSkill[]>;
  /** Modificateurs de caractéristiques cumulés par effet, par instance (stat -> delta). Pour l'affichage. */
  statDeltas: Record<string, Record<string, number>>;
  /** Valeurs de compétences calculées par effet, par instance (skillId -> valeur). Pour l'affichage. */
  skillValues: Record<string, Record<string, number>>;
  /** Améliorations d'équipement disponibles (octroyées par effet), par instance. Pour le constructeur. */
  grantedUpgrades: Record<string, GrantedUpgrade[]>;
  /**
   * Provenance des modifications affichées (stats/compétences/traits), par instance puis par clé
   * (`stat:<carac>`, `skill:<id>`, `trait:<id>`) → liste des effets responsables (nom + texte).
   * Permet d'expliquer, au clic sur une valeur colorée, quel effet la modifie.
   */
  effectSources: Record<string, Record<string, EffectSourceRef[]>>;
  /** Bonus de limitation par groupe `modèle#niveau` (effet `limit-modifier`, ex. Lieutenant). Pour le constructeur. */
  limitBonuses: Record<string, number>;
  /** Dés de maîtrise octroyés par effet, par instance (ex. Bannière Khéropse). Pour l'affichage. */
  grantedMasteryDice: Record<string, MasteryDomain[][]>;
  /** Règles de remise par objet, par instance (ex. Ogodeï, Commandant). Appliquées via `equipmentDiscount`. */
  equipmentCostRules: Record<string, EquipmentCostRule[]>;
  /** Bonus d'allonge (en toises) apporté par la monture, par instance. Affiché en ligne dédiée. */
  mountAllonge: Record<string, number>;
  /**
   * Réduction de prix de grimoire par instance ET par palier (ex. Mochère). `instanceId -> { petit, grand }`.
   * Permet d'afficher le prix net sur chaque bouton (Magie) et sur la ligne de la figurine (résumé).
   */
  grimoireDiscount: Record<string, Record<string, number>>;
  issues: Issue[];
}

/** Un effet responsable d'une modification affichée : nom de la source + texte de la règle. */
export interface EffectSourceRef {
  label: string;
  text: string;
}

/**
 * Règle de remise/surcoût par objet (effet `cost-delta` filtré par équipement) applicable à une
 * figurine, ex. Ogodeï (−10 Ko aux armes à 2 mains), Commandant (−5 Ko si arme de base changée).
 * Sérialisable : l'UI l'applique à un équipement donné via `equipmentDiscount`.
 */
export interface EquipmentCostRule {
  amount: number;
  label: string;
  equipmentCategories?: string[];
  equipmentIds?: string[];
  equipmentHands?: number[];
  requiresBaseSwap?: boolean;
}

/** Un équipement correspond-il au filtre d'équipement (catégorie / id / mains ; « 1-2 » matche 1 et 2) ? */
export function equipmentMatchesEquipFilter(
  cat: Catalog,
  equipId: string,
  sel: { equipmentCategories?: readonly string[]; equipmentIds?: readonly string[]; equipmentHands?: readonly number[] },
): boolean {
  const e = cat.equipment.find((x) => x.id === equipId);
  if (!e) return false;
  if (sel.equipmentCategories?.includes(e.category)) return true;
  if (sel.equipmentIds?.includes(equipId)) return true;
  const hands = sel.equipmentHands;
  if (hands && hands.length > 0 && e.hands != null) {
    if (e.hands === "1-2" ? hands.some((x) => x === 1 || x === 2) : hands.includes(e.hands)) return true;
  }
  return false;
}

/**
 * Remise cumulée (négatif) / surcoût pour un équipement donné, d'après les règles applicables à la
 * figurine et son état (équipement de base retiré, pour le gate « arme de base changée »).
 */
export function equipmentDiscount(
  cat: Catalog,
  equipId: string,
  rules: EquipmentCostRule[] | undefined,
  removedBaseIds: readonly string[],
): number {
  if (!rules) return 0;
  let d = 0;
  for (const r of rules) {
    if (!equipmentMatchesEquipFilter(cat, equipId, r)) continue;
    if (r.requiresBaseSwap && !removedBaseIds.some((id) => equipmentMatchesEquipFilter(cat, id, r))) continue;
    d += r.amount;
  }
  return d;
}

interface CatalogIndex {
  profile: Map<string, Profile>;
  specialCard: Map<string, SpecialCard>;
  equipmentCost: Map<string, number>;
  equipmentCategory: Map<string, string>;
  grimoireCost: Map<string, number>;
  spellCost: Map<string, number>;
  mountCost: Map<string, number>;
  mountOptionCost: Map<string, number>;
  orderCost: Map<string, number>;
}

interface ResolvedInstance {
  ferDeLanceId: string;
  fdlFactionId: string;
  instance: ProfileInstance;
  profile: Profile;
  traits: Set<string>;
  /** Cette figurine est-elle le meneur de son Fer de Lance ? */
  isLeader: boolean;
  /** Compétences octroyées par effet : skillId → valeur éventuelle (compétence « à valeur »). */
  grantedSkills: Map<string, string | number | undefined>;
}

interface EffectOccurrence {
  effect: Effect;
  ferDeLanceId: string;
  /** Pour les effets sourcés par un profil : l'instance source (pour `self`). */
  sourceInstanceId?: string;
  /** Nombre de figurines à l'origine de l'effet (module les effets « par source »). */
  sourceCount?: number;
}

function indexCatalog(cat: Catalog): CatalogIndex {
  return {
    profile: new Map(cat.profiles.map((p) => [p.id, p])),
    specialCard: new Map(cat.specialCards.map((s) => [s.id, s])),
    equipmentCost: new Map(cat.equipment.map((e) => [e.id, e.cost])),
    equipmentCategory: new Map(cat.equipment.map((e) => [e.id, e.category])),
    grimoireCost: new Map(cat.grimoires.map((g) => [g.id, g.cost])),
    spellCost: new Map(cat.spells.map((s) => [s.id, s.cost ?? 0])),
    mountCost: new Map(cat.mounts.map((m) => [m.id, m.cost])),
    mountOptionCost: new Map(cat.mountOptions.map((o) => [o.id, o.cost])),
    orderCost: new Map(cat.orders.map((o) => [o.id, o.cost])),
  };
}

/**
 * Une instance correspond-elle à l'identité d'un sélecteur ? ET entre les dimensions renseignées,
 * OU à l'intérieur d'une dimension. Un sélecteur sans aucune dimension d'identité ne correspond à rien.
 */
function instanceMatchesIdentity(sel: Selector, ri: ResolvedInstance): boolean {
  let any = false;
  if (sel.all) any = true; // « toutes les figurines de la portée » (d'autres dimensions restreignent encore)
  if (sel.profileIds?.length) {
    any = true;
    if (!sel.profileIds.includes(ri.profile.id)) return false;
  }
  if (sel.modelIds?.length) {
    any = true;
    if (!(ri.profile.modelId != null && sel.modelIds.includes(ri.profile.modelId))) return false;
  }
  if (sel.traits?.length) {
    any = true;
    if (!sel.traits.some((t) => ri.traits.has(t))) return false;
  }
  if (sel.factionIds?.length) {
    any = true;
    if (!(ri.profile.factionId != null && sel.factionIds.includes(ri.profile.factionId))) return false;
  }
  if (sel.levels?.length) {
    any = true;
    if (!(ri.profile.level != null && sel.levels.includes(ri.profile.level))) return false;
  }
  if (sel.isLeader != null) {
    any = true;
    if (ri.isLeader !== sel.isLeader) return false;
  }
  return any;
}

function instancesInScope(
  all: ResolvedInstance[],
  scope: EffectScope | "profil",
  ferDeLanceId: string,
): ResolvedInstance[] {
  if (scope === "ost") return all;
  return all.filter((ri) => ri.ferDeLanceId === ferDeLanceId);
}

/**
 * Une condition est-elle satisfaite dans la portée ? Une condition peut être un sélecteur unique
 * ou une liste de sélecteurs, auquel cas toutes les clauses doivent tenir (ET),
 * ex. « ≥3 Dogons ET ≥1 Père de famille ».
 */
function conditionHolds(
  condition: Selector | Selector[] | undefined,
  scope: EffectScope,
  ferDeLanceId: string,
  all: ResolvedInstance[],
): boolean {
  if (!condition) return true;
  const clauses = Array.isArray(condition) ? condition : [condition];
  const pool = instancesInScope(all, scope, ferDeLanceId);
  return clauses.every((clause) => {
    const matches = pool.filter((ri) => instanceMatchesIdentity(clause, ri));
    return matches.length >= (clause.countAtLeast ?? 1);
  });
}

/**
 * Désignation « garde du corps » : la cible (le garde) est-elle assignée à un protégé valide ?
 * Sans champ `designation`, toute désignation (assignée à quelqu'un) suffit ; avec, le protégé
 * doit correspondre à `designation.of` (ex. Larbin → Fille de Nyx, Djouked → Broutcha).
 */
function designationOk(effect: Effect, ri: ResolvedInstance, all: ResolvedInstance[]): boolean {
  const targetId = ri.instance.bodyguardOfInstanceId;
  if (targetId == null) return false;
  if (!effect.designation) return true;
  const protectee = all.find((r) => r.instance.instanceId === targetId);
  return protectee != null && instanceMatchesIdentity(effect.designation.of, protectee);
}

function collectEffectOccurrences(
  resolved: ResolvedInstance[],
  cat: Catalog,
  idx: CatalogIndex,
  /** true => inclut aussi les effets « en jeu » (appliesToListBuilding false) - pour l'affichage. */
  includeInGame = false,
): EffectOccurrence[] {
  const occurrences: EffectOccurrence[] = [];

  // Effets portés par les profils présents. Un effet « optIn » (choix du joueur) n'est appliqué
  // que si l'instance a explicitement opté - désignée garde du corps (ex. Djouked → −35 pour Broutcha).
  // Les effets `appliesToListBuilding: false` sont « en jeu seulement » : jamais calculés ici.
  for (const ri of resolved) {
    for (const effect of ri.profile.effects ?? []) {
      if (!includeInGame && !effect.appliesToListBuilding) continue;
      if (effect.optIn && !designationOk(effect, ri, resolved)) continue;
      occurrences.push({
        effect,
        ferDeLanceId: ri.ferDeLanceId,
        sourceInstanceId: ri.instance.instanceId,
        sourceCount: 1,
      });
    }
  }

  // Effets portés par la MONTURE d'une figurine, appliqués au cavalier (source = le cavalier).
  // Ex. Mochère : réduction du prix des grimoires du cavalier.
  for (const ri of resolved) {
    const mountId = ri.instance.mount?.mountId;
    if (!mountId) continue;
    const mount = cat.mounts.find((m) => m.id === mountId);
    for (const effect of mount?.effects ?? []) {
      if (!includeInGame && !effect.appliesToListBuilding) continue;
      if (effect.optIn && !designationOk(effect, ri, resolved)) continue;
      occurrences.push({
        effect,
        ferDeLanceId: ri.ferDeLanceId,
        sourceInstanceId: ri.instance.instanceId,
        sourceCount: 1,
      });
    }
  }

  // Effets des cartes spéciales « intrinsèques » (coût 0). Le nombre de figurines
  // concernées (`sourceCount`) module les effets « par source »
  // (ex. 1 Larbin gratuit PAR Fille de Nyx, plafonné à 2).
  const fdlIds = [...new Set(resolved.map((ri) => ri.ferDeLanceId))];
  for (const card of cat.specialCards) {
    // Intrinsèque = appliquée d'office : coût 0 ET pas une amélioration (celles-ci relèvent
    // d'un choix du joueur, appliquées via `instance.specialCardIds`). Les cartes d'Ost sont
    // exclues : elles ne s'appliquent que sélectionnées + valides (cf. `ostCardOccurrences`).
    if (card.cost !== 0 || card.amelioration || card.ostScope) continue;
    for (const fdlId of fdlIds) {
      const inFdl = resolved.filter((ri) => ri.ferDeLanceId === fdlId);
      const sources = inFdl.filter((ri) => specialCardScopeMatches(card, ri));
      if (sources.length === 0) continue;
      for (const effect of card.effects) {
        if ((!includeInGame && !effect.appliesToListBuilding) || effect.optIn) continue;
        if (effect.target.self) {
          // Effet ciblant la source elle-même (ex. Syrga → « Embuscade ») : il faut l'identité de
          // chaque porteuse, donc une occurrence par figurine-source.
          for (const src of sources) {
            occurrences.push({
              effect,
              ferDeLanceId: fdlId,
              sourceInstanceId: src.instance.instanceId,
              sourceCount: 1,
            });
          }
        } else {
          // Effet agrégé (ex. Larbin PAR Fille de Nyx) : une occurrence, modulée par le nombre de sources.
          occurrences.push({ effect, ferDeLanceId: fdlId, sourceCount: sources.length });
        }
      }
    }
  }

  // Effets des cartes spéciales « payantes » sélectionnées par une instance.
  for (const ri of resolved) {
    for (const cardId of ri.instance.specialCardIds ?? []) {
      const card = idx.specialCard.get(cardId);
      if (!card) continue;
      for (const effect of card.effects) {
        if (!includeInGame && !effect.appliesToListBuilding) continue;
        occurrences.push({
          effect,
          ferDeLanceId: ri.ferDeLanceId,
          sourceInstanceId: ri.instance.instanceId,
          sourceCount: 1,
        });
      }
    }
  }

  return occurrences;
}

function specialCardScopeMatches(card: SpecialCard, ri: ResolvedInstance): boolean {
  if (card.scope.profileIds?.includes(ri.profile.id)) return true;
  if (card.scope.trait && ri.traits.has(card.scope.trait)) return true;
  if (card.scope.factionIds && ri.profile.factionId && card.scope.factionIds.includes(ri.profile.factionId))
    return true;
  return false;
}

// ── Cartes à portée Ost (sélectionnées au niveau de la liste) ────────────────

/** Une carte d'Ost est-elle *disponible* ? = la liste contient une figurine correspondant à sa portée. */
function ostCardAvailable(card: SpecialCard, resolved: ResolvedInstance[]): boolean {
  return resolved.some((ri) => specialCardScopeMatches(card, ri));
}

/** Une carte d'Ost est-elle *active* ? = disponible ET sa condition de composition tient sur toute la liste. */
function ostCardActive(card: SpecialCard, resolved: ResolvedInstance[]): boolean {
  const anyFdl = resolved[0]?.ferDeLanceId ?? "";
  return ostCardAvailable(card, resolved) && conditionHolds(card.activationCondition, "ost", anyFdl, resolved);
}

/** Effets des cartes d'Ost sélectionnées ET actives (portée « ost » → toute la bande). */
function ostCardOccurrences(
  list: ListDocument,
  cat: Catalog,
  resolved: ResolvedInstance[],
  includeInGame: boolean,
): EffectOccurrence[] {
  const out: EffectOccurrence[] = [];
  const anyFdl = resolved[0]?.ferDeLanceId ?? list.fersDeLance[0]?.id ?? "";
  for (const id of list.ost?.cardIds ?? []) {
    const card = cat.specialCards.find((c) => c.id === id);
    if (!card?.ostScope || !ostCardActive(card, resolved)) continue;
    for (const effect of card.effects) {
      if (!includeInGame && !effect.appliesToListBuilding) continue;
      out.push({ effect, ferDeLanceId: anyFdl, sourceCount: 1 });
    }
  }
  return out;
}

/** Coût des cartes d'Ost sélectionnées (facturé dès la sélection, même si la condition n'est pas remplie). */
function ostCardsCost(list: ListDocument, cat: Catalog): number {
  let sum = 0;
  for (const id of list.ost?.cardIds ?? []) {
    const card = cat.specialCards.find((c) => c.id === id);
    if (card?.ostScope) sum += card.cost;
  }
  return sum;
}

/** Erreur si une carte d'Ost est sélectionnée mais indisponible (source absente) ou non remplie. */
function validateOstCards(cat: Catalog, list: ListDocument, resolved: ResolvedInstance[], issues: Issue[]): void {
  for (const id of list.ost?.cardIds ?? []) {
    const card = cat.specialCards.find((c) => c.id === id);
    if (!card?.ostScope) continue;
    if (!ostCardAvailable(card, resolved)) {
      issues.push({
        severity: "error",
        ruleId: `ost-card-unavailable:${id}`,
        message: `« ${card.name} » : la figurine requise pour cette carte d'Ost n'est pas dans la liste.`,
        sourceText: card.rulesText[0]?.text ?? "",
      });
    } else if (!conditionHolds(card.activationCondition, "ost", resolved[0]?.ferDeLanceId ?? "", resolved)) {
      issues.push({
        severity: "error",
        ruleId: `ost-card:${id}`,
        message: `« ${card.name} » : condition de composition de l'Ost non remplie.`,
        sourceText: card.rulesText[0]?.text ?? "",
      });
    }
  }
}

/** Applique les octrois (grant-trait / grant-skill) jusqu'à atteindre un point fixe. */
function applyGrants(resolved: ResolvedInstance[], occurrences: EffectOccurrence[]): void {
  const MAX_ITERATIONS = 16; // garde anti-cycle
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let changed = false;
    for (const occ of occurrences) {
      const { effect } = occ;
      if (effect.operation.kind !== "grant-trait" && effect.operation.kind !== "grant-skill") {
        continue;
      }
      if (!conditionHolds(effect.condition, effect.scope, occ.ferDeLanceId, resolved)) continue;

      const targets = resolveTargets(occ, resolved);
      for (const ri of targets) {
        if (effect.operation.kind === "grant-trait") {
          if (!ri.traits.has(effect.operation.trait)) {
            ri.traits.add(effect.operation.trait);
            changed = true;
          }
        } else {
          if (!ri.grantedSkills.has(effect.operation.skillId)) {
            ri.grantedSkills.set(effect.operation.skillId, effect.operation.value);
            changed = true;
          }
        }
      }
    }
    if (!changed) return;
  }
}

function resolveTargets(occ: EffectOccurrence, resolved: ResolvedInstance[]): ResolvedInstance[] {
  const { effect } = occ;
  const pool = instancesInScope(resolved, effect.scope, occ.ferDeLanceId);
  // `self` = la figurine-source ; `cavalier` = le porteur d'une monture (l'effet de monture prend le
  // cavalier comme source, donc les deux visent la même instance ici).
  if (effect.target.self || (effect.target.cavalier && effect.source.kind === "mount")) {
    return pool.filter((ri) => ri.instance.instanceId === occ.sourceInstanceId);
  }
  return pool.filter((ri) => instanceMatchesIdentity(effect.target, ri));
}

function baseInstanceCost(ri: ResolvedInstance, idx: CatalogIndex, cat: Catalog): number {
  const inst = ri.instance;
  let cost = ri.profile.cost;
  for (const id of inst.removedBaseEquipmentIds) cost -= idx.equipmentCost.get(id) ?? 0;
  for (const id of inst.addedEquipmentIds) cost += idx.equipmentCost.get(id) ?? 0;
  if (inst.grimoireId) cost += idx.grimoireCost.get(inst.grimoireId) ?? 0;
  for (const id of inst.spellIds) cost += idx.spellCost.get(id) ?? 0;
  cost += totalMunitionCost(cat, inst);
  // Coût de la monture : traité à part (sous-ligne dédiée), pas ici. Voir `mountCostOf`.
  for (const id of inst.orderIds ?? []) cost += idx.orderCost.get(id) ?? 0;
  for (const id of inst.specialCardIds ?? []) {
    const card = idx.specialCard.get(id);
    // Les améliorations partagées sont facturées une fois par Fer de Lance (cf. computeCosts), pas par instance.
    if (card?.shared) continue;
    // Amélioration empilable : coût × quantité (plafond appliqué côté store/UI).
    const qty = card?.perLevelStack ? (inst.specialCardCounts?.[id] ?? 1) : 1;
    cost += (card?.cost ?? 0) * qty;
  }
  return cost;
}

/** Coût propre de la monture d'une figurine (niveau + son équipement acheté). Affiché sur la sous-ligne. */
function mountCostOf(inst: ProfileInstance, idx: CatalogIndex): number {
  const m = inst.mount;
  if (!m) return 0;
  let c = idx.mountCost.get(m.mountId) ?? 0;
  for (const id of m.addedEquipmentIds ?? []) c += idx.equipmentCost.get(id) ?? 0;
  return c;
}

/**
 * Réduction de prix de grimoire par instance ET par palier (opération `grimoire-discount`, ex. Mochère).
 * `instanceId -> tier ("petit"/"grand") -> réduction`, plafonnée au prix du grimoire de ce palier.
 * Indépendante du grimoire actuellement choisi : l'UI peut afficher le prix net sur chaque bouton.
 */
const GRIMOIRE_TIERS = ["petit", "grand"] as const;
function collectGrimoireDiscounts(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
  idx: CatalogIndex,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const occ of occurrences) {
    const op = occ.effect.operation;
    if (op.kind !== "grimoire-discount") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;
    for (const ri of resolveTargets(occ, resolved)) {
      const id = ri.instance.instanceId;
      const m = out.get(id) ?? new Map<string, number>();
      for (const t of op.tier ? [op.tier] : GRIMOIRE_TIERS) m.set(t, (m.get(t) ?? 0) + op.amount);
      out.set(id, m);
    }
  }
  for (const [, m] of out) for (const [t, d] of m) m.set(t, Math.min(d, idx.grimoireCost.get(t) ?? d));
  return out;
}

function computeCosts(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
  idx: CatalogIndex,
  cat: Catalog,
): Map<string, number> {
  const cost = new Map<string, number>();
  for (const ri of resolved) cost.set(ri.instance.instanceId, baseInstanceCost(ri, idx, cat));

  // Améliorations partagées : facturées une seule fois par Fer de Lance (au premier porteur),
  // quel que soit le nombre de figurines qui la sélectionnent ou en bénéficient.
  const chargedShared = new Map<string, Set<string>>(); // ferDeLanceId -> cardIds déjà facturées
  for (const ri of resolved) {
    for (const id of ri.instance.specialCardIds ?? []) {
      const card = idx.specialCard.get(id);
      if (!card?.shared) continue;
      const done = chargedShared.get(ri.ferDeLanceId) ?? new Set<string>();
      if (done.has(id)) continue;
      done.add(id);
      chargedShared.set(ri.ferDeLanceId, done);
      cost.set(ri.instance.instanceId, (cost.get(ri.instance.instanceId) ?? 0) + card.cost);
    }
  }

  // cost-delta : modificateurs additifs.
  for (const occ of occurrences) {
    const op = occ.effect.operation;
    if (op.kind !== "cost-delta") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;

    for (const ri of resolveTargets(occ, resolved)) {
      const sel = occ.effect.target;
      const hasFilter =
        (sel.equipmentCategories?.length ?? 0) > 0 ||
        (sel.equipmentIds?.length ?? 0) > 0 ||
        (sel.equipmentHands?.length ?? 0) > 0;
      const matches = (id: string) => equipmentMatchesEquipFilter(cat, id, sel);
      let delta = op.amount;
      if (hasFilter) {
        // Gate « changement d'arme de base » : au moins un équipement de base retiré correspond au filtre.
        if (op.requiresBaseSwap && !ri.instance.removedBaseEquipmentIds.some(matches)) continue;
        // Appliqué une fois par équipement ajouté ciblé (catégorie / id / mains).
        delta = op.amount * ri.instance.addedEquipmentIds.filter(matches).length;
      }
      cost.set(ri.instance.instanceId, (cost.get(ri.instance.instanceId) ?? 0) + delta);
    }
  }

  // grimoire-discount : réduit le prix du grimoire CHOISI de la cible (ex. Mochère).
  const grimDisc = collectGrimoireDiscounts(resolved, occurrences, idx);
  for (const ri of resolved) {
    const g = ri.instance.grimoireId;
    const d = g ? grimDisc.get(ri.instance.instanceId)?.get(g) : undefined;
    if (d) cost.set(ri.instance.instanceId, (cost.get(ri.instance.instanceId) ?? 0) - d);
  }

  // cost-set : fixe le coût (ex. larbins « garde du corps » gratuits). Seules les cibles
  // *désignées* (bodyguardOfInstanceId) en bénéficient - le joueur choisit qui occupe l'emplacement -
  // dans la limite de maxCount et du nombre de sources (sourceCount).
  for (const occ of occurrences) {
    const op = occ.effect.operation;
    if (op.kind !== "cost-set") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;

    const designated = resolveTargets(occ, resolved).filter((ri) => designationOk(occ.effect, ri, resolved));
    const cap = op.maxCount ?? designated.length;
    const freed = Math.min(cap, occ.sourceCount ?? designated.length, designated.length);
    for (const ri of designated.slice(0, freed)) {
      cost.set(ri.instance.instanceId, op.amount);
    }
  }

  return cost;
}

function buildResolved(list: ListDocument, idx: CatalogIndex): ResolvedInstance[] {
  const resolved: ResolvedInstance[] = [];
  for (const fdl of list.fersDeLance) {
    for (const inst of fdl.members) {
      const profile = idx.profile.get(inst.profileId);
      if (!profile) continue;
      resolved.push({
        ferDeLanceId: fdl.id,
        fdlFactionId: fdl.factionId,
        instance: inst,
        profile,
        traits: new Set(profile.traits),
        isLeader: inst.instanceId === fdl.leaderInstanceId,
        grantedSkills: new Map(),
      });
    }
  }
  return resolved;
}

// ── Validation ─────────────────────────────────────────────────────────────

function validate(
  cat: Catalog,
  list: ListDocument,
  resolved: ResolvedInstance[],
  idx: CatalogIndex,
  limitBonuses: Map<string, number>,
): Issue[] {
  const issues: Issue[] = [];

  for (const fdl of list.fersDeLance) {
    const inFdl = resolved.filter((ri) => ri.ferDeLanceId === fdl.id);
    validateLimitations(fdl, inFdl, issues, limitBonuses);
    validateConsumesSlot(cat, fdl, inFdl, issues);
    validateFactionMembership(fdl, inFdl, issues);
    validateLeader(fdl, inFdl, issues);
  }

  validateMounts(cat, resolved, issues);
  validateForbiddenEquipment(cat, resolved, idx, issues);
  validateReservedEquipment(cat, resolved, issues);
  validateRequiresPresent(cat, resolved, issues);
  validateAttachments(cat, list, resolved, issues);
  validateSpecialCardScope(idx, resolved, issues);
  validateMagicAndSlots(cat, resolved, issues);
  validateOstCards(cat, list, resolved, issues);

  return issues;
}

/** Le leader doit être désigné et éligible : personnage OU l'une des 2 figurines les plus chères. */
function validateLeader(fdl: FerDeLance, inFdl: ResolvedInstance[], issues: Issue[]): void {
  if (inFdl.length === 0) return;
  const leader = inFdl.find((ri) => ri.instance.instanceId === fdl.leaderInstanceId);
  const push = (message: string) =>
    issues.push({ severity: "error", ferDeLanceId: fdl.id, ruleId: "leader-eligibility", message, sourceText: "Le meneur doit être un personnage ou l'une des deux figurines les plus chères." });
  if (!leader) {
    push("Aucun meneur éligible n'est désigné pour ce Fer de Lance.");
    return;
  }
  const isChar = (p: Profile) => Boolean(p.isNamed) || p.limitation.kind === "U" || p.limitation.kind === "P";
  const topTwo = new Set(
    [...inFdl].sort((a, b) => b.profile.cost - a.profile.cost).slice(0, 2).map((ri) => ri.instance.instanceId),
  );
  if (!isChar(leader.profile) && !topTwo.has(leader.instance.instanceId)) {
    push(`« ${leader.profile.name} » ne peut pas être meneur (ni personnage, ni parmi les deux plus chères).`);
  }
}

/** Validations dérivées : grimoire interdit, capacité de pages, sorts sans lanceur, mains/armure. */
function validateMagicAndSlots(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  for (const ri of resolved) {
    const { profile: p, instance: inst, traits } = ri;
    const push = (ruleId: string, message: string) =>
      issues.push({
        severity: "error",
        ferDeLanceId: ri.ferDeLanceId,
        instanceId: inst.instanceId,
        ruleId,
        message,
        sourceText: "Règles de création de liste - équipement & magie.",
      });

    if (inst.grimoireId && forbiddenGrimoires(p).has(inst.grimoireId)) {
      push("grimoire-forbidden", `« ${p.name} » ne peut pas acquérir ce grimoire.`);
    }

    if (inst.spellIds.length > 0) {
      if (castWays(cat, p, inst, traits).length === 0) {
        push("spells-no-caster", `« ${p.name} » a des sorts alors qu'elle ne peut pas en lancer.`);
      } else {
        const cap = pageCapacity(cat, p, inst, traits);
        const used = pagesUsed(cat, inst);
        if (used > cap) {
          push("pages-over-capacity", `« ${p.name} » : ${used} pages de sorts pour ${cap === Infinity ? "∞" : cap} disponibles.`);
        }
      }
    }

    // La limitation de mains ne s'applique qu'en jeu : on n'en fait pas une contrainte de recrutement.
    if (armorsWorn(cat, p, inst) > 1) push("multiple-armor", `« ${p.name} » porte plusieurs armures.`);
  }
}

function validateSpecialCardScope(
  idx: CatalogIndex,
  resolved: ResolvedInstance[],
  issues: Issue[],
): void {
  for (const ri of resolved) {
    for (const cardId of ri.instance.specialCardIds ?? []) {
      const card = idx.specialCard.get(cardId);
      if (!card) continue;
      if (!specialCardScopeMatches(card, ri)) {
        const reserve = card.scope.trait
          ? card.scope.trait
          : card.scope.factionIds
            ? `la faction ${card.scope.factionIds.join(", ")}`
            : "des profils spécifiques";
        issues.push({
          severity: "error",
          ferDeLanceId: ri.ferDeLanceId,
          instanceId: ri.instance.instanceId,
          ruleId: `special-card-scope:${cardId}`,
          message: `La carte « ${card.name} » ne peut pas être attribuée à « ${ri.profile.name} ».`,
          sourceText: `Réservée à ${reserve}.`,
        });
      }
    }
  }
}

/** Clé de regroupement d'une limitation : `modèle#niveau` (variantes de loadout partagent la limite). */
function limitGroupKey(ri: ResolvedInstance): string {
  return ri.profile.modelId != null ? `${ri.profile.modelId}#${ri.profile.level ?? 0}` : ri.profile.id;
}

/**
 * Bonus de limitation (effet `limit-modifier`, ex. Lieutenant khérops : +1) par groupe `modèle#niveau`.
 * N'affecte que les limitations « X » (numériques) ; +amount une fois par groupe et par source.
 */
function collectLimitBonuses(resolved: ResolvedInstance[], occurrences: EffectOccurrence[]): Map<string, number> {
  const bonus = new Map<string, number>();
  for (const occ of occurrences) {
    if (occ.effect.operation.kind !== "limit-modifier") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;
    const amount = occ.effect.operation.amount;
    const seen = new Set<string>();
    for (const ri of instancesInScope(resolved, occ.effect.scope, occ.ferDeLanceId)) {
      if (ri.profile.limitation.kind !== "X") continue;
      if (!instanceMatchesIdentity(occ.effect.target, ri)) continue;
      const key = limitGroupKey(ri);
      if (seen.has(key)) continue;
      seen.add(key);
      bonus.set(key, (bonus.get(key) ?? 0) + amount);
    }
  }
  return bonus;
}

function validateLimitations(
  fdl: FerDeLance,
  inFdl: ResolvedInstance[],
  issues: Issue[],
  limitBonuses: Map<string, number>,
): void {
  // Compté par (modèle, niveau) : les variantes de loadout (même modèle ET même niveau, profils
  // distincts) partagent la même limitation ; des niveaux différents comptent séparément
  // (un modèle avec un N2 « U » et un N3 « U » peut aligner le N2 et le N3).
  const groups = new Map<string, { ri: ResolvedInstance; count: number }>();
  for (const ri of inFdl) {
    const key = limitGroupKey(ri);
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { ri, count: 1 });
  }
  for (const [key, { ri, count }] of groups) {
    const lim = ri.profile.limitation;
    const max =
      lim.kind === "X"
        ? (lim.value ?? Infinity) + (limitBonuses.get(key) ?? 0)
        : lim.kind === "U" || lim.kind === "P"
          ? 1
          : Infinity;
    if (count > max) {
      issues.push({
        severity: "error",
        ferDeLanceId: fdl.id,
        ruleId: `limitation:${key}`,
        message: `« ${ri.profile.name} » : ${count} recruté(s) pour une limitation de ${max}.`,
        sourceText: `Limitation ${lim.kind}${lim.value ? " " + lim.value : ""}.`,
      });
    }
  }
}

/**
 * Plafond d'un emplacement (modèle, niveau) = limitation du profil générique cible
 * (X → sa valeur ; U/P → 1). Partagé entre le moteur et le constructeur.
 */
export function slotCapacity(cat: Catalog, modelId: string, level: number): number {
  const target =
    cat.profiles.find((p) => p.modelId === modelId && p.level === level && !p.isNamed) ??
    cat.profiles.find((p) => p.modelId === modelId && p.level === level);
  if (!target) return Infinity;
  return target.limitation.kind === "X" ? (target.limitation.value ?? Infinity) : 1;
}

/**
 * LIM P : un personnage « occupe la place » d'un profil générique (modèle, niveau) via le champ
 * `limitation.consumesSlotOf` { modelId, level }. Génériques du profil cible + personnages consommant
 * son créneau ne peuvent dépasser la limitation du profil cible (ex. Gaubert prend une place de Paladin III).
 */
function validateConsumesSlot(cat: Catalog, fdl: FerDeLance, inFdl: ResolvedInstance[], issues: Issue[]): void {
  const bySlot = new Map<string, { modelId: string; level: number; consumers: ResolvedInstance[] }>();
  for (const ri of inFdl) {
    const cs = ri.profile.limitation.consumesSlotOf;
    if (!cs) continue;
    const key = `${cs.modelId}#${cs.level}`;
    const slot = bySlot.get(key) ?? { modelId: cs.modelId, level: cs.level, consumers: [] };
    slot.consumers.push(ri);
    bySlot.set(key, slot);
  }
  for (const { modelId, level, consumers } of bySlot.values()) {
    const target =
      cat.profiles.find((p) => p.modelId === modelId && p.level === level && !p.isNamed) ??
      cat.profiles.find((p) => p.modelId === modelId && p.level === level);
    if (!target) continue;
    const allowed = slotCapacity(cat, modelId, level);
    // Génériques comptés par (modèle, niveau) : les variantes de loadout partagent l'emplacement.
    const generics = inFdl.filter((ri) => ri.profile.modelId === modelId && ri.profile.level === level).length;
    const total = generics + consumers.length;
    if (total > allowed) {
      issues.push({
        severity: "error",
        ferDeLanceId: fdl.id,
        ruleId: `consumes-slot:${modelId}#${level}`,
        message: `${total} occupant(s) de la place de « ${target.name} » (niveau ${level}) pour une limite de ${allowed}.`,
        sourceText: `Occupe l'emplacement d'un « ${target.name} » de niveau ${level}.`,
      });
    }
  }
}

function validateFactionMembership(
  fdl: FerDeLance,
  inFdl: ResolvedInstance[],
  issues: Issue[],
): void {
  for (const ri of inFdl) {
    const pf = ri.profile.factionId;
    if (!pf || pf === fdl.factionId) continue; // sans logo ou même faction
    if (ri.traits.has("apatride")) continue;
    const allowed = (ri.profile.recruitment ?? []).some(
      (c) =>
        c.type === "faction-membership" &&
        Array.isArray((c.params as { allowedFactions?: unknown }).allowedFactions) &&
        ((c.params as { allowedFactions: string[] }).allowedFactions).includes(fdl.factionId),
    );
    if (!allowed) {
      issues.push({
        severity: "error",
        ferDeLanceId: fdl.id,
        instanceId: ri.instance.instanceId,
        ruleId: `faction:${ri.profile.id}`,
        message: `« ${ri.profile.name} » (${pf}) ne peut pas être recruté dans un Fer de Lance ${fdl.factionId}.`,
        sourceText: "Vous devez composer votre Fer de Lance en choisissant parmi une unique faction.",
      });
    }
  }
}

function forbiddenCategories(c: Constraint): string[] {
  const p = c.params as { categories?: unknown };
  return Array.isArray(p.categories) ? (p.categories as string[]) : [];
}

function validateForbiddenEquipment(
  cat: Catalog,
  resolved: ResolvedInstance[],
  idx: CatalogIndex,
  issues: Issue[],
): void {
  // Contraintes portées par les profils (sujet = le profil) ...
  const checks: { subjectProfileId: string; constraint: Constraint }[] = [];
  for (const ri of resolved) {
    for (const c of ri.profile.recruitment) {
      if (c.type === "forbids-equipment") checks.push({ subjectProfileId: ri.profile.id, constraint: c });
    }
  }
  // ... et par les cartes spéciales (sujet = params.profileId).
  for (const card of cat.specialCards) {
    for (const c of card.constraints) {
      if (c.type !== "forbids-equipment") continue;
      const subject = (c.params as { profileId?: string }).profileId;
      if (subject) checks.push({ subjectProfileId: subject, constraint: c });
    }
  }

  for (const { subjectProfileId, constraint } of checks) {
    const cats = forbiddenCategories(constraint);
    for (const ri of resolved.filter((r) => r.profile.id === subjectProfileId)) {
      const offending = ri.instance.addedEquipmentIds.filter((id) =>
        cats.includes(idx.equipmentCategory.get(id) ?? ""),
      );
      if (offending.length > 0) {
        issues.push({
          severity: constraint.severity,
          ferDeLanceId: ri.ferDeLanceId,
          instanceId: ri.instance.instanceId,
          ruleId: constraint.id,
          message: `« ${ri.profile.name} » ne peut pas être équipé de ce type d'équipement.`,
          sourceText: constraint.sourceText,
        });
      }
    }
  }
}

/** Une figurine valide-t-elle la réservation d'un équipement ? (toutes les dimensions fournies). */
function reservedOk(eq: Catalog["equipment"][number], p: Profile): boolean {
  const r = eq.reservedTo;
  if (!r) return true;
  if (r.profileIds && !r.profileIds.includes(p.id)) return false;
  if (r.modelIds && !(p.modelId != null && r.modelIds.includes(p.modelId))) return false;
  if (r.traits && !r.traits.some((t) => p.traits.includes(t))) return false;
  if (r.levels && !(p.level != null && r.levels.includes(p.level))) return false;
  if (r.factionIds && !(p.factionId != null && r.factionIds.includes(p.factionId))) return false;
  return true;
}

/**
 * Défense en profondeur : le constructeur empêche déjà d'ajouter un équipement réservé à une
 * figurine non éligible, mais une liste importée pourrait en contenir un - on le signale ici.
 * On ne contrôle que l'équipement AJOUTÉ (l'équipement de base est défini par la carte).
 */
/** La monture posée sur une figurine existe-t-elle et est-elle éligible (faction/exclusion/Berseker/±1) ? */
function validateMounts(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  for (const ri of resolved) {
    const mountId = ri.instance.mount?.mountId;
    if (!mountId) continue;
    const mount = cat.mounts.find((m) => m.id === mountId);
    if (!mount || !isMountEligible(cat, ri.profile, mount)) {
      issues.push({
        severity: "error",
        ferDeLanceId: ri.ferDeLanceId,
        instanceId: ri.instance.instanceId,
        ruleId: `mount-${mountId}`,
        message: `« ${ri.profile.name} » ne peut pas prendre la monture « ${mountLabel(cat, mountId)} ».`,
        sourceText: "Monture non éligible (faction, exclusion, Berseker ou écart de niveau).",
      });
    }
  }
}

function validateReservedEquipment(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  const eqById = new Map(cat.equipment.map((e) => [e.id, e]));
  for (const ri of resolved) {
    for (const id of ri.instance.addedEquipmentIds) {
      const eq = eqById.get(id);
      if (eq && !reservedOk(eq, ri.profile)) {
        issues.push({
          severity: "error",
          ferDeLanceId: ri.ferDeLanceId,
          instanceId: ri.instance.instanceId,
          ruleId: `reserved-${eq.id}`,
          message: `« ${ri.profile.name} » ne peut pas être équipé de « ${eq.name} » (réservé à d'autres figurines).`,
          sourceText: "Équipement réservé.",
        });
      }
    }
  }
}

function validateRequiresPresent(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  type Req = { subjectProfileId: string; requiredProfileId: string; constraint: Constraint };
  const reqs: Req[] = [];
  for (const ri of resolved) {
    for (const c of ri.profile.recruitment) {
      if (c.type !== "requires-present") continue;
      const p = c.params as { requiredProfileId?: string; subjectProfileId?: string };
      if (p.requiredProfileId) {
        reqs.push({ subjectProfileId: p.subjectProfileId ?? ri.profile.id, requiredProfileId: p.requiredProfileId, constraint: c });
      }
    }
  }
  for (const card of cat.specialCards) {
    for (const c of card.constraints) {
      if (c.type !== "requires-present") continue;
      const p = c.params as { requiredProfileId?: string; subjectProfileId?: string };
      if (p.requiredProfileId && p.subjectProfileId) {
        reqs.push({ subjectProfileId: p.subjectProfileId, requiredProfileId: p.requiredProfileId, constraint: c });
      }
    }
  }

  for (const req of reqs) {
    // Vérifié par Fer de Lance.
    const fdlIds = [...new Set(resolved.map((ri) => ri.ferDeLanceId))];
    for (const fdlId of fdlIds) {
      const inFdl = resolved.filter((ri) => ri.ferDeLanceId === fdlId);
      const hasSubject = inFdl.some((ri) => ri.profile.id === req.subjectProfileId);
      const hasRequired = inFdl.some((ri) => ri.profile.id === req.requiredProfileId);
      if (hasSubject && !hasRequired) {
        const subject = inFdl.find((ri) => ri.profile.id === req.subjectProfileId)!;
        issues.push({
          severity: req.constraint.severity,
          ferDeLanceId: fdlId,
          instanceId: subject.instance.instanceId,
          ruleId: req.constraint.id,
          message: `« ${subject.profile.name} » nécessite la présence d'une autre figurine dans le Fer de Lance.`,
          sourceText: req.constraint.sourceText,
        });
      }
    }
  }
}

function validateAttachments(
  _cat: Catalog,
  list: ListDocument,
  resolved: ResolvedInstance[],
  issues: Issue[],
): void {
  const byInstanceId = new Map(resolved.map((ri) => [ri.instance.instanceId, ri]));
  for (const fdl of list.fersDeLance) {
    for (const carrier of fdl.members) {
      const attached = carrier.attachedInstanceIds ?? [];
      if (attached.length === 0) continue;
      const carrierRi = byInstanceId.get(carrier.instanceId);
      if (!carrierRi) continue;

      // Seuls les rattachés soumis à une contrainte d'attachement (les Likans) comptent dans la
      // capacité - un Muskh rattaché à Xàyin, par ex., ne consomme pas la capacité Likan.
      const attachedRis = attached
        .map((id) => byInstanceId.get(id))
        .filter((ri): ri is ResolvedInstance => Boolean(ri))
        .filter((ri) => ri.profile.recruitment.some((c) => c.type === "attachment"));
      const attachmentConstraint = attachedRis
        .flatMap((ri) => ri.profile.recruitment)
        .find((c) => c.type === "attachment");
      if (!attachmentConstraint) continue;

      const carrierLevel = carrierRi.profile.level ?? 0;
      const sumLevels = attachedRis.reduce((s, ri) => s + (ri.profile.level ?? 0), 0);
      if (sumLevels > carrierLevel) {
        issues.push({
          severity: attachmentConstraint.severity,
          ferDeLanceId: fdl.id,
          instanceId: carrier.instanceId,
          ruleId: attachmentConstraint.id,
          message: `Somme des niveaux des rattachés (${sumLevels}) supérieure au niveau du porteur « ${carrierRi.profile.name} » (${carrierLevel}).`,
          sourceText: attachmentConstraint.sourceText,
        });
      }
    }
  }
}

// ── Affichage : profil réellement modifié par les effets ───────────────────────
// Rejoué sur des clones (traits repartant de la base) pour ne pas fausser coût/validation,
// en incluant les effets « en jeu » (stat-modifier, octrois de compétence conditionnels…).

function cloneForDisplay(resolved: ResolvedInstance[]): ResolvedInstance[] {
  return resolved.map((ri) => ({
    ...ri,
    traits: new Set(ri.profile.traits),
    grantedSkills: new Map<string, string | number | undefined>(),
  }));
}

/** Valeur de base d'une caractéristique (V P A C T I dans `stats` ; PA/PV/Stature à part). */
function baseStat(p: Profile, key: string): number {
  if (key === "pa") return p.pa;
  if (key === "pv") return p.pv;
  if (key === "stature") return p.stature;
  return (p.stats as Record<string, number | null>)[key] ?? 0;
}

function computeStatDeltas(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const add = (id: string, stat: string, delta: number) => {
    const m = out.get(id) ?? new Map<string, number>();
    m.set(stat, (m.get(stat) ?? 0) + delta);
    out.set(id, m);
  };
  for (const occ of occurrences) {
    const op = occ.effect.operation;
    if (op.kind !== "stat-modifier" && op.kind !== "stat-count" && op.kind !== "stat-max") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;
    if (op.kind === "stat-max") {
      // Caractéristique fixée au MAX de cette carac. (valeurs de base) parmi le groupe `of` dans la portée.
      const pool = instancesInScope(resolved, occ.effect.scope, occ.ferDeLanceId);
      const group = pool.filter((ri) => instanceMatchesIdentity(op.of, ri));
      const groupMax = group.reduce((mx, ri) => Math.max(mx, baseStat(ri.profile, op.stat)), -Infinity);
      for (const ri of resolveTargets(occ, resolved)) {
        const base = baseStat(ri.profile, op.stat);
        const value = Number.isFinite(groupMax) ? Math.max(base, groupMax) : base;
        // SET (non cumulatif, idempotent si plusieurs membres portent l'effet) exprimé en delta sur la base.
        const m = out.get(ri.instance.instanceId) ?? new Map<string, number>();
        m.set(op.stat, value - base);
        out.set(ri.instance.instanceId, m);
      }
    } else if (op.kind === "stat-count") {
      // Caractéristique fixée au nombre de figurines correspondant à `of` dans la portée.
      const pool = instancesInScope(resolved, occ.effect.scope, occ.ferDeLanceId);
      const count = pool.filter((ri) => instanceMatchesIdentity(op.of, ri)).length;
      for (const ri of resolveTargets(occ, resolved)) {
        const base = baseStat(ri.profile, op.stat);
        const value = op.atLeastBase ? Math.max(base, count) : count;
        // SET (non cumulatif) : si plusieurs Dogons portent l'effet, chaque occurrence fixe la même
        // valeur → idempotent, exprimé en delta sur la base.
        const m = out.get(ri.instance.instanceId) ?? new Map<string, number>();
        m.set(op.stat, value - base);
        out.set(ri.instance.instanceId, m);
      }
    } else {
      for (const ri of resolveTargets(occ, resolved)) {
        add(ri.instance.instanceId, op.stat, op.amount === "level" ? (ri.profile.level ?? 0) : op.amount);
      }
    }
  }
  return out;
}

/** Valeurs de compétences dérivées d'un décompte (skill-count), par instance : skillId -> valeur. */
const MOUNT_ROMAN = ["", "I", "II", "III"];
/** Libellé lisible d'un niveau de monture, ex. « Koelod II » (type + niveau romain). */
export function mountLabel(cat: Catalog, mountId: string): string {
  const m = cat.mounts.find((x) => x.id === mountId);
  if (!m) return mountId;
  const t = cat.mountTypes.find((x) => x.id === m.typeId);
  return `${t?.name ?? m.typeId} ${MOUNT_ROMAN[m.level] ?? m.level}`.trim();
}

/** Compétence « Berseker » : interdit à son porteur d'acquérir une monture (règles de bataille p.29). */
const BERSEKER_SKILL_ID = "berserk";

/**
 * Un profil peut-il prendre CE niveau de monture ? Faction autorisée par le type, profil non exclu,
 * pas Berseker, et écart de niveau ≤ 1 (règles p.29). Un profil sans niveau n'est pas contraint sur l'écart.
 */
export function isMountEligible(cat: Catalog, profile: Profile, mount: Mount): boolean {
  const type = cat.mountTypes.find((t) => t.id === mount.typeId);
  if (!type) return false;
  if (profile.factionId == null || !type.factionEligibility.includes(profile.factionId)) return false;
  if (type.excludedProfileIds?.includes(profile.id)) return false;
  if (profile.skills.some((s) => s.skillId === BERSEKER_SKILL_ID)) return false;
  if (profile.level != null && Math.abs(mount.level - profile.level) > 1) return false;
  return true;
}

/** Montures (niveaux) qu'un profil donné peut recruter. */
export function eligibleMountsFor(cat: Catalog, profile: Profile): Mount[] {
  return cat.mounts.filter((m) => isMountEligible(cat, profile, m));
}

/** Nom lisible de la source d'un effet (carte, profil, monture, équipement). */
function effectSourceLabel(effect: Effect, cat: Catalog): string {
  const { kind, id } = effect.source;
  if (kind === "special-card") return cat.specialCards.find((c) => c.id === id)?.name ?? id;
  if (kind === "profile") return cat.profiles.find((p) => p.id === id)?.name ?? id;
  if (kind === "mount") return mountLabel(cat, id);
  if (kind === "equipment") return cat.equipment.find((e) => e.id === id)?.name ?? id;
  return id;
}

/**
 * Provenance des modifications : pour chaque instance et chaque clé modifiée (`stat:…`, `skill:…`,
 * `trait:…`), la liste des effets responsables. Mêmes gardes que les fonctions de calcul
 * (condition + cibles) pour rester cohérent avec ce qui est réellement appliqué.
 */
function collectEffectSources(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
  cat: Catalog,
): Map<string, Map<string, EffectSourceRef[]>> {
  const out = new Map<string, Map<string, EffectSourceRef[]>>();
  const add = (id: string, key: string, ref: EffectSourceRef) => {
    const m = out.get(id) ?? new Map<string, EffectSourceRef[]>();
    const arr = m.get(key) ?? [];
    if (!arr.some((r) => r.label === ref.label && r.text === ref.text)) arr.push(ref);
    m.set(key, arr);
    out.set(id, m);
  };
  for (const occ of occurrences) {
    const { effect } = occ;
    const op = effect.operation;
    let key: string | null = null;
    if (op.kind === "stat-modifier" || op.kind === "stat-count" || op.kind === "stat-max") key = `stat:${op.stat}`;
    else if (op.kind === "grant-skill" || op.kind === "skill-count") key = `skill:${op.skillId}`;
    else if (op.kind === "grant-trait") key = `trait:${op.trait}`;
    else if (op.kind === "limit-modifier") key = "limit";
    if (!key) continue;
    if (!conditionHolds(effect.condition, effect.scope, occ.ferDeLanceId, resolved)) continue;
    const ref: EffectSourceRef = { label: effectSourceLabel(effect, cat), text: effect.sourceText };
    for (const ri of resolveTargets(occ, resolved)) add(ri.instance.instanceId, key, ref);
  }
  return out;
}

/** Règles de remise par objet (cost-delta filtré par équipement) applicables à chaque instance. */
function collectEquipmentCostRules(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
  cat: Catalog,
): Map<string, EquipmentCostRule[]> {
  const out = new Map<string, EquipmentCostRule[]>();
  for (const occ of occurrences) {
    const op = occ.effect.operation;
    if (op.kind !== "cost-delta") continue;
    const sel = occ.effect.target;
    const hasFilter =
      (sel.equipmentCategories?.length ?? 0) > 0 ||
      (sel.equipmentIds?.length ?? 0) > 0 ||
      (sel.equipmentHands?.length ?? 0) > 0;
    if (!hasFilter) continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;
    const rule: EquipmentCostRule = {
      amount: op.amount,
      label: effectSourceLabel(occ.effect, cat),
      equipmentCategories: sel.equipmentCategories,
      equipmentIds: sel.equipmentIds,
      equipmentHands: sel.equipmentHands,
      requiresBaseSwap: op.requiresBaseSwap,
    };
    for (const ri of resolveTargets(occ, resolved)) {
      const arr = out.get(ri.instance.instanceId) ?? [];
      arr.push(rule);
      out.set(ri.instance.instanceId, arr);
    }
  }
  return out;
}

/** Dés de maîtrise octroyés par effet (ex. Bannière Khéropse), par instance. Pour l'affichage. */
function collectGrantedMasteryDice(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
): Map<string, MasteryDomain[][]> {
  const out = new Map<string, MasteryDomain[][]>();
  for (const occ of occurrences) {
    const op = occ.effect.operation;
    if (op.kind !== "grant-mastery-die") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;
    for (const ri of resolveTargets(occ, resolved)) {
      const arr = out.get(ri.instance.instanceId) ?? [];
      arr.push(op.domains);
      out.set(ri.instance.instanceId, arr);
    }
  }
  return out;
}

function computeSkillValues(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const occ of occurrences) {
    const op = occ.effect.operation;
    if (op.kind !== "skill-count") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;
    const pool = instancesInScope(resolved, occ.effect.scope, occ.ferDeLanceId);
    const count = pool.filter((ri) => instanceMatchesIdentity(op.of, ri)).length;
    const value = Math.floor(count / (op.per && op.per > 0 ? op.per : 1));
    for (const ri of resolveTargets(occ, resolved)) {
      const m = out.get(ri.instance.instanceId) ?? new Map<string, number>();
      m.set(op.skillId, value); // SET non cumulatif (idempotent si plusieurs porteurs)
      out.set(ri.instance.instanceId, m);
    }
  }
  return out;
}

/** Améliorations d'équipement octroyées (effets `unlock-upgrade`), par instance : upgradeId → détail. */
function collectGrantedUpgrades(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
): Map<string, Map<string, GrantedUpgrade>> {
  const out = new Map<string, Map<string, GrantedUpgrade>>();
  for (const occ of occurrences) {
    const op = occ.effect.operation;
    if (op.kind !== "unlock-upgrade") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;
    for (const ri of resolveTargets(occ, resolved)) {
      const m = out.get(ri.instance.instanceId) ?? new Map<string, GrantedUpgrade>();
      m.set(op.upgradeId, {
        upgradeId: op.upgradeId,
        label: op.label,
        cost: op.cost,
        equipmentCategories: op.equipmentCategories,
        grantsSkills: op.grantsSkills,
      });
      out.set(ri.instance.instanceId, m);
    }
  }
  return out;
}

/** Surcoût des améliorations d'équipement cochées (opt-in par objet), pour une instance. */
function upgradeCost(ri: ResolvedInstance, granted: Map<string, GrantedUpgrade>, idx: CatalogIndex): number {
  const ups = ri.instance.equipmentUpgrades;
  if (!ups) return 0;
  const worn = new Set(wornEquipmentIds(ri.profile, ri.instance));
  let cost = 0;
  for (const [equipId, upIds] of Object.entries(ups)) {
    if (!worn.has(equipId)) continue; // amélioration sur un équipement retiré : ignorée
    const category = idx.equipmentCategory.get(equipId);
    for (const upId of upIds) {
      const g = granted.get(upId);
      if (g && category && g.equipmentCategories.includes(category)) cost += g.cost;
    }
  }
  return cost;
}

/**
 * Compétences (avec valeurs) conférées par les améliorations d'équipement APPLIQUÉES (ex. Borax :
 * « Spécialiste » attaque/défense sur une arme, « Instinct de survie » sur une armure). Renvoie la
 * liste par instance (une même compétence peut apparaître avec plusieurs valeurs) et renseigne la
 * provenance (bloc « Modifiée par »).
 */
function collectUpgradeGrantedSkills(
  display: ResolvedInstance[],
  grantedUp: Map<string, Map<string, GrantedUpgrade>>,
  idx: CatalogIndex,
  sources: Map<string, Map<string, EffectSourceRef[]>>,
): Map<string, GrantedSkill[]> {
  const out = new Map<string, GrantedSkill[]>();
  for (const ri of display) {
    const id = ri.instance.instanceId;
    const ups = ri.instance.equipmentUpgrades;
    const granted = grantedUp.get(id);
    if (!ups || !granted) continue;
    const worn = new Set(wornEquipmentIds(ri.profile, ri.instance));
    for (const [equipId, upIds] of Object.entries(ups)) {
      if (!worn.has(equipId)) continue;
      const category = idx.equipmentCategory.get(equipId);
      for (const upId of upIds) {
        const g = granted.get(upId);
        if (!g || !category || !g.equipmentCategories.includes(category)) continue;
        for (const gs of g.grantsSkills ?? []) {
          const arr = out.get(id) ?? [];
          if (!arr.some((s) => s.skillId === gs.skillId && s.value === gs.value)) arr.push(gs);
          out.set(id, arr);
          const m = sources.get(id) ?? new Map<string, EffectSourceRef[]>();
          const refs = m.get(`skill:${gs.skillId}`) ?? [];
          const ref: EffectSourceRef = { label: g.label, text: `Conférée par l'amélioration « ${g.label} ».` };
          if (!refs.some((r) => r.label === ref.label && r.text === ref.text)) refs.push(ref);
          m.set(`skill:${gs.skillId}`, refs);
          sources.set(id, m);
        }
      }
    }
  }
  return out;
}

/**
 * Applique les bonus de la MONTURE d'une figurine (règles p.27-31) sur la passe d'affichage :
 * - stats (pa/v/a/c/p/pv/stature) ajoutées aux `statDeltas` ;
 * - compétences conférées, avec la règle §7 « meilleure valeur » : une valeur de monture n'écrase
 *   pas une valeur native supérieure, et remplace (via `skillValues`) la native si elle est meilleure ;
 * - allonge exposée à part (ligne dédiée sur la fiche).
 * Renseigne aussi la provenance (« Monture « … » »). Renvoie les compétences octroyées + l'allonge par instance.
 */
function applyMountBonuses(
  display: ResolvedInstance[],
  cat: Catalog,
  statDeltas: Map<string, Map<string, number>>,
  skillValues: Map<string, Map<string, number>>,
  sources: Map<string, Map<string, EffectSourceRef[]>>,
): { allonge: Map<string, number> } {
  const allonge = new Map<string, number>();
  // Seules les caractéristiques (V P A C … + PA) et l'allonge s'ajoutent au cavalier. PV et stature
  // restent PROPRES à la monture (non partagés) ; les compétences de la monture restent sur SA fiche.
  const SHARED_STATS = ["pa", "v", "a", "c", "p"] as const;
  for (const ri of display) {
    const mountId = ri.instance.mount?.mountId;
    if (!mountId) continue;
    const mount = cat.mounts.find((m) => m.id === mountId);
    if (!mount) continue;
    const id = ri.instance.instanceId;
    const ref: EffectSourceRef = { label: mountLabel(cat, mountId), text: "Bonus de monture." };
    const addSource = (key: string) => {
      const m = sources.get(id) ?? new Map<string, EffectSourceRef[]>();
      const arr = m.get(key) ?? [];
      if (!arr.some((r) => r.label === ref.label && r.text === ref.text)) arr.push(ref);
      m.set(key, arr);
      sources.set(id, m);
    };
    const b = mount.bonuses ?? {};
    const sd = statDeltas.get(id) ?? new Map<string, number>();
    for (const stat of SHARED_STATS) {
      const val = b[stat];
      if (val != null && val !== 0) {
        sd.set(stat, (sd.get(stat) ?? 0) + val);
        addSource(`stat:${stat}`);
      }
    }
    if (sd.size > 0) statDeltas.set(id, sd);
    if (b.allonge != null && b.allonge !== 0) allonge.set(id, (allonge.get(id) ?? 0) + b.allonge);

    // Règle « meilleure valeur » (FaQ) : une compétence commune au cavalier et à la monture est
    // conservée à sa plus forte valeur sur la fiche du cavalier (ex. Guerrier Khérops + Koelod II
    // → Charge Brutale 2). N'agit que sur les valeurs numériques réellement supérieures.
    for (const ms of mount.grantedSkills ?? []) {
      const rs = ri.profile.skills.find((s) => s.skillId === ms.skillId);
      if (!rs) continue;
      const rv = Number(rs.value);
      const mv = Number(ms.value);
      if (Number.isFinite(rv) && Number.isFinite(mv) && mv > rv) {
        const sv = skillValues.get(id) ?? new Map<string, number>();
        sv.set(ms.skillId, mv);
        skillValues.set(id, sv);
        addSource(`skill:${ms.skillId}`);
      }
    }
  }
  return { allonge };
}

/** Compétence « Berseker » (transmises exclues) - voir `MOUNT_TRANSMITTED_SKILLS`. */
const MOUNT_TRANSMITTED_SKILLS = ["endurance", "harcelement", "instinct-de-survie"];

/**
 * Compétences effectives de la fiche d'une MONTURE (règles de bataille p.28 + FaQ) : ses compétences
 * natives, plus les 3 seules compétences que le cavalier lui transmet (endurance, harcèlement, instinct
 * de survie) si le cavalier les possède. Règle « meilleure valeur » pour une compétence commune.
 */
export function mountSheetSkills(mount: Mount, rider: Profile): GrantedSkill[] {
  const out = new Map<string, string | number | undefined>();
  const put = (skillId: string, value: string | number | undefined) => {
    if (!out.has(skillId)) out.set(skillId, value);
    else {
      const cur = out.get(skillId);
      if (typeof value === "number" && typeof cur === "number") out.set(skillId, Math.max(cur, value));
      else if (value != null && cur == null) out.set(skillId, value);
    }
  };
  for (const s of mount.grantedSkills ?? []) put(s.skillId, s.value);
  for (const s of rider.skills) if (MOUNT_TRANSMITTED_SKILLS.includes(s.skillId)) put(s.skillId, s.value);
  return [...out].map(([skillId, value]) => ({ skillId, value }));
}

// ── Point d'entrée ───────────────────────────────────────────────────────────

export function evaluateList(cat: Catalog, list: ListDocument): EvaluationResult {
  const idx = indexCatalog(cat);
  const resolved = buildResolved(list, idx);
  const occurrences = [
    ...collectEffectOccurrences(resolved, cat, idx),
    ...ostCardOccurrences(list, cat, resolved, false),
  ];

  applyGrants(resolved, occurrences); // 1-2 : octrois jusqu'au point fixe (construction)
  const cost = computeCosts(resolved, occurrences, idx, cat); // 4 : coûts
  // 4b : améliorations d'équipement octroyées (unlock-upgrade) + surcoût des options cochées.
  const grantedUp = collectGrantedUpgrades(resolved, occurrences);
  for (const ri of resolved) {
    const extra = upgradeCost(ri, grantedUp.get(ri.instance.instanceId) ?? new Map(), idx);
    if (extra) cost.set(ri.instance.instanceId, (cost.get(ri.instance.instanceId) ?? 0) + extra);
  }
  const limitBonuses = collectLimitBonuses(resolved, occurrences); // +1 limite (Lieutenant…)
  const equipmentCostRules = collectEquipmentCostRules(resolved, occurrences, cat); // remises par objet
  const issues = validate(cat, list, resolved, idx, limitBonuses); // 5 : contraintes

  // Affichage : tous les effets d'octroi / de statistique, y compris « en jeu », sur des clones.
  const display = cloneForDisplay(resolved);
  const displayOcc = [
    ...collectEffectOccurrences(display, cat, idx, true),
    ...ostCardOccurrences(list, cat, display, true),
  ];
  applyGrants(display, displayOcc);
  const statDeltasByInstance = computeStatDeltas(display, displayOcc);
  const skillValuesByInstance = computeSkillValues(display, displayOcc);
  const sourcesByInstance = collectEffectSources(display, displayOcc, cat);
  // Compétences conférées par les améliorations d'équipement appliquées (ex. Borax) → grantedSkills + sources.
  const upgradeSkillsByInstance = collectUpgradeGrantedSkills(display, grantedUp, idx, sourcesByInstance);
  // Bonus de monture PARTAGÉS au cavalier : stats (V P A C … + PA) + allonge uniquement (pas PV/stature/compétences).
  const mount = applyMountBonuses(display, cat, statDeltasByInstance, skillValuesByInstance, sourcesByInstance);
  const mountAllonge: Record<string, number> = Object.fromEntries(mount.allonge);
  const grimoireDiscount: Record<string, Record<string, number>> = Object.fromEntries(
    [...collectGrimoireDiscounts(resolved, occurrences, idx)].map(([id, m]) => [id, Object.fromEntries(m)]),
  );
  const grantedDiceByInstance = collectGrantedMasteryDice(display, displayOcc);
  const displayById = new Map(display.map((ri) => [ri.instance.instanceId, ri]));

  const costByInstance: Record<string, number> = {};
  const mountCostByInstance: Record<string, number> = {};
  const costByFerDeLance: Record<string, number> = {};
  const grantedTraits: Record<string, string[]> = {};
  const grantedSkills: Record<string, GrantedSkill[]> = {};
  const statDeltas: Record<string, Record<string, number>> = {};
  const skillValues: Record<string, Record<string, number>> = {};
  const grantedUpgrades: Record<string, GrantedUpgrade[]> = {};
  const effectSources: Record<string, Record<string, EffectSourceRef[]>> = {};
  const grantedMasteryDice: Record<string, MasteryDomain[][]> = {};
  for (const ri of resolved) {
    const id = ri.instance.instanceId;
    const c = cost.get(id) ?? 0;
    costByInstance[id] = c;
    const mc = mountCostOf(ri.instance, idx);
    if (mc > 0) mountCostByInstance[id] = mc;
    costByFerDeLance[ri.ferDeLanceId] = (costByFerDeLance[ri.ferDeLanceId] ?? 0) + c + mc;
    const gu = grantedUp.get(id);
    if (gu && gu.size > 0) grantedUpgrades[id] = [...gu.values()];

    const dri = displayById.get(id);
    if (dri) {
      const base = new Set(ri.profile.traits);
      const traits = [...dri.traits].filter((t) => !base.has(t));
      if (traits.length > 0) grantedTraits[id] = traits;
      const extraSkills = upgradeSkillsByInstance.get(id) ?? [];
      if (dri.grantedSkills.size > 0 || extraSkills.length > 0) {
        const merged: GrantedSkill[] = [...dri.grantedSkills].map(([skillId, value]) => ({ skillId, value }));
        // Fusionne les compétences des améliorations d'équipement (Borax…), sans doublon skillId+valeur.
        for (const gs of extraSkills) {
          if (!merged.some((s) => s.skillId === gs.skillId && s.value === gs.value)) merged.push(gs);
        }
        grantedSkills[id] = merged;
      }
    }
    const sd = statDeltasByInstance.get(id);
    if (sd && sd.size > 0) {
      // Un delta nul (ex. `stat-max` dont le max du groupe n'excède pas la base) n'est pas une
      // modification visible : on ne l'expose pas, pour ne pas colorer la stat comme « modifiée ».
      const nonZero = Object.fromEntries([...sd].filter(([, v]) => v !== 0));
      if (Object.keys(nonZero).length > 0) statDeltas[id] = nonZero;
    }
    const sv = skillValuesByInstance.get(id);
    if (sv && sv.size > 0) skillValues[id] = Object.fromEntries(sv);
    const src = sourcesByInstance.get(id);
    if (src && src.size > 0) effectSources[id] = Object.fromEntries(src);
    const gd = grantedDiceByInstance.get(id);
    if (gd && gd.length > 0) grantedMasteryDice[id] = gd;
  }
  const totalCost =
    Object.values(costByInstance).reduce((s, c) => s + c, 0) +
    Object.values(mountCostByInstance).reduce((s, c) => s + c, 0) +
    ostCardsCost(list, cat);

  return {
    totalCost,
    costByInstance,
    mountCost: mountCostByInstance,
    costByFerDeLance,
    grantedTraits,
    grantedSkills,
    statDeltas,
    skillValues,
    grantedUpgrades,
    effectSources,
    limitBonuses: Object.fromEntries(limitBonuses),
    equipmentCostRules: Object.fromEntries(equipmentCostRules),
    grantedMasteryDice,
    mountAllonge,
    grimoireDiscount,
    issues,
  };
}
