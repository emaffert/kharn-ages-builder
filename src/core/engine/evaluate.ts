import type {
  Catalog,
  Constraint,
  Effect,
  EffectScope,
  FerDeLance,
  ListDocument,
  MasteryDomain,
  Mount,
  MountKind,
  MountOption,
  Profile,
  ProfileInstance,
  Selector,
  SpecialCard,
} from "../model";
import { addedEquipmentTally, baseEquipmentCount } from "../model";
import {
  armorsWorn,
  castWays,
  castableSpells,
  forbiddenGrimoires,
  genericSpellAllocation,
  grantedSpellIds,
  innateSpellIds,
  pageAllocation,
  spellGrants,
  wornEquipmentIds,
} from "./magic";
import { engineIdOf } from "../model/engineIds";
import { freeWeaponsCarried } from "./equipment";
import { forbiddenMunitionLines, totalMunitionCost } from "./munitions";
import { effectiveOrigin, needsOriginChoice, originFactionId } from "./origin";
import {
  FRERE_D_ARMES,
  alliedFactions,
  equipmentAllowedIn,
  equipmentReservedOk,
  isApatride,
  openRecruitmentAccepts,
  openRecruitmentRefuses,
  recruitableWithoutSeal,
  sealFor,
} from "./recruitment";
import { isSlaveIn, sdgValue, slaveMayBuy, slavePerCarrierMax } from "./slavery";

/**
 * Moteur d'évaluation d'une liste : calcul de coût + validation, en tenant compte
 * des effets dynamiques (octrois, déblocages, modificateurs de coût).
 * Référence : docs/schema-donnees.md - couche 2 (ordre de résolution).
 *
 * Opérations d'effet prises en charge ici : `cost-delta`, `cost-set`, `grant-skill`
 * (`spell-pages` est traité par engine/magic.ts pour la capacité de pages).
 * TODO - opérations définies au schéma mais PAS encore appliquées à l'évaluation :
 *   `stat-modifier` (ex. Apprentie de Nyx : +niveau en I), `cap`.
 *   Tant qu'elles ne sont pas implémentées, ces effets sont sans incidence sur coût/stats.
 */

/** Compétence octroyée par un effet (avec sa valeur éventuelle pour les compétences « à valeur »). */
export type GrantedSkill = { skillId: string; value?: string | number; precision?: string };

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

/** Une amélioration proposée sur un objet, quelle que soit son origine. */
export interface AvailableUpgrade {
  id: string;
  label: string;
  cost: number;
}

/**
 * Améliorations achetables sur un objet donné : les **siennes** (`Equipment.upgrades`, ex. l'Épée
 * courte et ses « deux effets ») puis celles qu'un **effet lui octroie** (`unlock-upgrade`, ex. Borax).
 *
 * Les deux sortes partagent le même espace de noms dans `instance.equipmentUpgrades`, où seuls des
 * identifiants sont stockés. En cas d'homonymie, l'intrinsèque l'emporte : elle est portée par
 * l'objet lui-même, elle ne peut pas être comptée deux fois.
 */
export function upgradesForEquipment(
  equipment: { category: string; upgrades?: readonly AvailableUpgrade[] },
  granted: readonly GrantedUpgrade[],
): AvailableUpgrade[] {
  const own = (equipment.upgrades ?? []).map((u) => ({ id: u.id, label: u.label, cost: u.cost }));
  const ownIds = new Set(own.map((u) => u.id));
  const fromEffects = granted
    .filter((g) => g.equipmentCategories.includes(equipment.category) && !ownIds.has(g.upgradeId))
    .map((g) => ({ id: g.upgradeId, label: g.label, cost: g.cost }));
  return [...own, ...fromEffects];
}

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

/**
 * Surcoût « Tembo » pour un équipement AJOUTÉ (Règles de bataille p.20) : +`amount` Ko par tranche
 * complète de `per` Ko du prix de base, appliqué aux figurines portant le trait « tembo ». Les
 * équipements au logo Tembo (réservés au trait « tembo », ex. Khépesh) l'incluent déjà → exclus.
 * Sérialisable : l'UI l'applique par objet (comme `equipmentDiscount`). Retourne 0 si désactivé.
 */
export function temboEquipmentSurcharge(
  cat: Catalog,
  traits: ReadonlySet<string> | readonly string[],
  equipId: string,
): number {
  const cfg = cat.settings?.temboEquipmentSurcharge;
  if (!cfg || cfg.per <= 0) return 0;
  const isTembo = Array.isArray(traits) ? traits.includes("tembo") : (traits as ReadonlySet<string>).has("tembo");
  if (!isTembo) return 0;
  const e = cat.equipment.find((x) => x.id === equipId);
  if (!e || e.reservedTo?.traits?.includes("tembo")) return 0; // déjà tarifé Tembo
  if (e.cost <= 0) return 0; // une arme gratuite le reste
  return Math.floor(e.cost / cfg.per) * cfg.amount;
}

interface CatalogIndex {
  profile: Map<string, Profile>;
  specialCard: Map<string, SpecialCard>;
  equipmentCost: Map<string, number>;
  equipmentCategory: Map<string, string>;
  grimoireCost: Map<string, number>;
  spellCost: Map<string, number>;
  mountCost: Map<string, number>;
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
  grantedSkills: Map<string, { value?: string | number; precision?: string }>;
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
  // Le protégé doit exister, être dans le MÊME Fer de Lance, et n'être pas le garde lui-même : une
  // désignation ne traverse pas les Fers de Lance et ne se replie pas sur soi. Cherché ici plutôt
  // que laissé à la seule validation, pour que la remise ne tombe jamais sur une liaison illégale.
  const protectee = all.find(
    (r) => r.instance.instanceId === targetId && r.ferDeLanceId === ri.ferDeLanceId,
  );
  if (protectee == null || protectee.instance.instanceId === ri.instance.instanceId) return false;
  if (!effect.designation) return true;
  return instanceMatchesIdentity(effect.designation.of, protectee);
}

function collectEffectOccurrences(
  resolved: ResolvedInstance[],
  cat: Catalog,
  idx: CatalogIndex,
): EffectOccurrence[] {
  const occurrences: EffectOccurrence[] = [];

  // Effets portés par les profils présents. Un effet muni d'une `designation` est verrouillé : il
  // n'agit que si la figurine a été reliée à une figurine correspondante (ex. Djouked → −35 pour Broutcha).
  for (const ri of resolved) {
    for (const effect of ri.profile.effects ?? []) {
      if (effect.designation && !designationOk(effect, ri, resolved)) continue;
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
      if (effect.designation && !designationOk(effect, ri, resolved)) continue;
      occurrences.push({
        effect,
        ferDeLanceId: ri.ferDeLanceId,
        sourceInstanceId: ri.instance.instanceId,
        sourceCount: 1,
      });
    }
  }

  // Effets portés par l'ÉQUIPEMENT effectivement porté (base non retiré + acheté), source = le porteur.
  // Ex. Faucille d'Os → octroie « Riposte » à son porteur (cible `self`).
  for (const ri of resolved) {
    for (const eqId of wornEquipmentIds(ri.profile, ri.instance)) {
      const eq = cat.equipment.find((e) => e.id === eqId);
      for (const effect of eq?.effects ?? []) {
        if (effect.designation && !designationOk(effect, ri, resolved)) continue;
        occurrences.push({
          effect,
          ferDeLanceId: ri.ferDeLanceId,
          sourceInstanceId: ri.instance.instanceId,
          sourceCount: 1,
        });
      }
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
  if (cardMatchesBanner(card, ri.profile, ri.fdlFactionId)) return true;
  return false;
}

/**
 * Portée par la bannière : la carte suit le Fer de Lance qui accueille la figurine, pas la faction
 * imprimée sur sa carte. `nonNativeOnly` la restreint alors aux recrues venues d'ailleurs.
 */
export function cardMatchesBanner(
  card: SpecialCard,
  profile: Profile,
  fdlFactionId: string,
): boolean {
  if (!card.scope.ferDeLanceFactionIds?.includes(fdlFactionId)) return false;
  return !card.scope.nonNativeOnly || profile.factionId !== fdlFactionId;
}

/** Prix d'une carte pour cette figurine : multiplié par son niveau quand la règle le dit. */
export function specialCardCost(card: SpecialCard, profile: Profile): number {
  return card.costPerLevel ? card.cost * (profile.level ?? 1) : card.cost;
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
): EffectOccurrence[] {
  const out: EffectOccurrence[] = [];
  const anyFdl = resolved[0]?.ferDeLanceId ?? list.fersDeLance[0]?.id ?? "";
  for (const id of list.ost?.cardIds ?? []) {
    const card = cat.specialCards.find((c) => c.id === id);
    if (!card?.ostScope || !ostCardActive(card, resolved)) continue;
    for (const effect of card.effects) {
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
        sourceText: card.rulesText,
      });
    } else if (!conditionHolds(card.activationCondition, "ost", resolved[0]?.ferDeLanceId ?? "", resolved)) {
      issues.push({
        severity: "error",
        ruleId: `ost-card:${id}`,
        message: `« ${card.name} » : condition de composition de l'Ost non remplie.`,
        sourceText: card.rulesText,
      });
    }
  }
}

/** Applique les octrois de compétence (grant-skill) jusqu'à atteindre un point fixe. */
function applyGrants(resolved: ResolvedInstance[], occurrences: EffectOccurrence[]): void {
  const MAX_ITERATIONS = 16; // garde anti-cycle
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let changed = false;
    for (const occ of occurrences) {
      const { effect } = occ;
      const op = effect.operation;
      if (op.kind !== "grant-skill" && op.kind !== "grant-trait") continue;
      if (!conditionHolds(effect.condition, effect.scope, occ.ferDeLanceId, resolved)) continue;

      if (op.kind === "grant-trait") {
        // Octroi de trait : ajouté à l'ensemble des traits résolus, jusqu'au point
        // fixe. Comme `applyGrants` précède `validate`, ce trait est vu par les règles (recrutement…).
        for (const ri of resolveTargets(occ, resolved)) {
          if (!ri.traits.has(op.trait)) {
            ri.traits.add(op.trait);
            changed = true;
          }
        }
        continue;
      }

      const { skillId, value, precision, incrementIfPresent } = op;
      for (const ri of resolveTargets(occ, resolved)) {
        // « +N si déjà connue » : la compétence native est augmentée via `skillValues` (cf.
        // computeSkillValues), pas ré-octroyée ici - sinon double affichage (« 2 et 4 »).
        if (incrementIfPresent != null && ri.profile.skills.some((s) => s.skillId === skillId)) continue;
        if (!ri.grantedSkills.has(skillId)) {
          ri.grantedSkills.set(skillId, { value, precision });
          changed = true;
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
  // Rendre un objet de base le rend en entier : la Camériste qui se sépare de ses doses rend les trois.
  for (const id of inst.removedBaseEquipmentIds) {
    cost -= (idx.equipmentCost.get(id) ?? 0) * baseEquipmentCount(ri.profile, id);
  }
  for (const [id, qty] of addedEquipmentTally(inst)) {
    cost += (idx.equipmentCost.get(id) ?? 0) * qty;
    cost += temboEquipmentSurcharge(cat, ri.traits, id) * qty; // surcoût Tembo (p.20), équipement ajouté uniquement
  }
  if (inst.grimoireId) cost += idx.grimoireCost.get(inst.grimoireId) ?? 0;
  // Un sort offert échappe aux budgets de pages et de niveaux, pas à son prix : l'offre porte sur la
  // connaissance du sort, pas sur les Kouronnes.
  for (const id of [...inst.spellIds, ...grantedSpellIds(inst)]) cost += idx.spellCost.get(id) ?? 0;
  cost += totalMunitionCost(cat, inst);
  // Coût de la monture (niveau, équipement monté, options « monture ») : traité à part. Voir `mountCostOf`.
  // Ici on n'ajoute que les options « cavalier » et « partagées » (comptées une fois, côté cavalier).
  if (inst.mount) cost += mountOptionsCost(cat, inst, ["rider", "both"]);
  for (const id of inst.specialCardIds ?? []) {
    const card = idx.specialCard.get(id);
    // Les améliorations partagées sont facturées une fois par Fer de Lance (cf. computeCosts), pas par instance.
    if (card?.shared) continue;
    // Amélioration empilable : coût × quantité (plafond appliqué côté store/UI).
    const qty = card?.perLevelStack ? (inst.specialCardCounts?.[id] ?? 1) : 1;
    cost += (card ? specialCardCost(card, ri.profile) : 0) * qty;
  }
  return cost;
}

/** Nature (quagga/koelod/mochère) de la monture d'un id de niveau donné. */
export function mountKindOf(cat: Catalog, mountId?: string): MountKind | undefined {
  if (!mountId) return undefined;
  const m = cat.mounts.find((x) => x.id === mountId);
  return m ? cat.mountTypes.find((t) => t.id === m.typeId)?.kind : undefined;
}

/** Coût d'une option (p.32) pour une valeur X et une nature de monture données. */
export function mountOptionCostOf(opt: MountOption, value: number, kind?: MountKind): number {
  if (opt.costByValue?.length) return opt.costByValue[Math.max(1, value) - 1] ?? opt.costByValue.at(-1) ?? opt.cost;
  if (opt.costByMountKind && kind && opt.costByMountKind[kind] != null) return opt.costByMountKind[kind];
  return opt.cost;
}

/** Coût d'un équipement, avec surcharge éventuelle selon la faction du porteur (ex. Caparaçon 20/22). */
function equipmentCostFor(cat: Catalog, idx: CatalogIndex, id: string, factionId?: string): number {
  const e = cat.equipment.find((x) => x.id === id);
  if (e?.costByFaction && factionId != null && e.costByFaction[factionId] != null) return e.costByFaction[factionId];
  return idx.equipmentCost.get(id) ?? 0;
}

/** Somme des coûts des options achetées dont le panier ∈ `buckets` (chaque option comptée une fois). */
function mountOptionsCost(cat: Catalog, inst: ProfileInstance, buckets: MountOption["bucket"][]): number {
  if (!inst.mount) return 0;
  const kind = mountKindOf(cat, inst.mount.mountId);
  let c = 0;
  for (const [id, value] of Object.entries(inst.mountOptionIds ?? {})) {
    const opt = cat.mountOptions.find((o) => o.id === id);
    if (opt && buckets.includes(opt.bucket)) c += mountOptionCostOf(opt, value, kind);
  }
  return c;
}

/** Coût propre de la monture (niveau + équipement de monture + options « monture »). Affiché sur la sous-ligne. */
function mountCostOf(inst: ProfileInstance, idx: CatalogIndex, cat: Catalog, factionId?: string): number {
  const m = inst.mount;
  if (!m) return 0;
  let c = idx.mountCost.get(m.mountId) ?? 0;
  for (const id of m.addedEquipmentIds ?? []) {
    c += equipmentCostFor(cat, idx, id, factionId);
    // Améliorations intrinsèques achetées sur cet objet (ex. Caparaçon → Pointes acérées).
    const e = cat.equipment.find((x) => x.id === id);
    for (const upId of m.equipmentUpgrades?.[id] ?? [])
      c += e?.upgrades?.find((u) => u.id === upId)?.cost ?? 0;
  }
  c += mountOptionsCost(cat, inst, ["mount"]);
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
      cost.set(
        ri.instance.instanceId,
        (cost.get(ri.instance.instanceId) ?? 0) + specialCardCost(card, ri.profile),
      );
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
        // Appliqué une fois par exemplaire acheté correspondant au filtre (catégorie / id / mains).
        delta = op.amount * [...addedEquipmentTally(ri.instance)]
          .filter(([id]) => matches(id))
          .reduce((n, [, qty]) => n + qty, 0);
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
    validateFactionMembership(cat, fdl, inFdl, issues);
    validateOpenRecruitmentCaps(cat, fdl, inFdl, issues);
    validateLeader(fdl, inFdl, issues);
    validateSlaves(cat, fdl, inFdl, issues);
    validateFreeWeapons(cat, fdl, inFdl, issues);
    validateGuardSlots(fdl, inFdl, resolved, issues);
  }

  validateChosenOrigin(cat, resolved, issues);
  validateMounts(cat, resolved, issues);
  validateMountOptions(cat, resolved, issues);
  validateForbiddenEquipment(cat, resolved, idx, issues);
  validateMunitions(cat, resolved, issues);
  validateReservedEquipment(cat, resolved, issues);
  validateFixedBaseEquipment(cat, resolved, issues);
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
  const isChar = (p: Profile) => p.limitation.kind === "P";
  // Un esclave ne mène personne, quel que soit son coût : il combat malgré lui.
  if (isSlaveIn(leader.profile, fdl.factionId)) {
    push(`« ${leader.profile.name} » ne peut pas être meneur : un esclave ne mène pas un Fer de Lance.`);
    return;
  }
  const topTwo = new Set(
    [...inFdl].sort((a, b) => b.profile.cost - a.profile.cost).slice(0, 2).map((ri) => ri.instance.instanceId),
  );
  if (!isChar(leader.profile) && !topTwo.has(leader.instance.instanceId)) {
    push(`« ${leader.profile.name} » ne peut pas être meneur (ni personnage, ni parmi les deux plus chères).`);
  }
}

/**
 * Un protégé n'offre qu'**un seul** emplacement de désignation (« garde du corps », « garde
 * rapprochée »).
 *
 * Deux effets indépendants peuvent convoiter le même : le Larbin gratuit qu'une Fille de Nyx offre
 * (`cost-set`, désignation portée par la cible) et la remise de 35 Ko de Djouked (`cost-delta`,
 * désignation portée par la source). Rien dans `designationOk` ne les fait se concurrencer : il
 * vérifie que le protégé correspond au sélecteur, pas qu'il est encore libre. Broutcha payait donc
 * les deux à la fois.
 *
 * Le constructeur retire déjà les protégés pris de la liste qu'il propose (`availableProtectees`),
 * si bien que la règle tenait à l'écran et nulle part ailleurs. On la vérifie ici pour qu'une liste
 * importée, restaurée d'une version antérieure ou retouchée à la main ne la contourne pas en silence.
 *
 * Trois liaisons sont refusées, les trois que le constructeur rend seulement *inatteignables* :
 * se désigner soi-même, désigner hors de son Fer de Lance, et désigner un protégé déjà pris.
 * `designationOk` écarte déjà les deux premières du calcul des coûts - la validation existe pour que
 * le joueur voie l'erreur au lieu de perdre une remise sans comprendre pourquoi.
 */
function validateGuardSlots(
  fdl: FerDeLance,
  inFdl: ResolvedInstance[],
  resolved: ResolvedInstance[],
  issues: Issue[],
): void {
  const push = (guard: ResolvedInstance, message: string) =>
    issues.push({
      severity: "error",
      ferDeLanceId: fdl.id,
      instanceId: guard.instance.instanceId,
      ruleId: "guard-slot-taken",
      message,
      sourceText: "Une figurine ne peut être désignée que par un seul garde, dans son Fer de Lance.",
    });

  const guardsByProtectee = new Map<string, ResolvedInstance[]>();
  for (const ri of inFdl) {
    const protecteeId = ri.instance.bodyguardOfInstanceId;
    if (protecteeId == null) continue;
    if (protecteeId === ri.instance.instanceId) {
      push(ri, `« ${ri.profile.name} » ne peut pas se désigner elle-même comme protégée.`);
      continue;
    }
    // Hors du Fer de Lance : la liaison ne vaut rien, et l'ignorer en silence laisserait le joueur
    // croire à une remise acquise. On distingue « ailleurs » de « nulle part » pour qu'il sache quoi faire.
    if (!inFdl.some((r) => r.instance.instanceId === protecteeId)) {
      const elsewhere = resolved.find((r) => r.instance.instanceId === protecteeId);
      push(
        ri,
        elsewhere
          ? `« ${ri.profile.name} » désigne « ${elsewhere.profile.name} », qui appartient à un autre Fer de Lance.`
          : `« ${ri.profile.name} » désigne une figurine qui ne fait plus partie de la liste.`,
      );
      continue;
    }
    guardsByProtectee.set(protecteeId, [...(guardsByProtectee.get(protecteeId) ?? []), ri]);
  }
  for (const [protecteeId, guards] of guardsByProtectee) {
    if (guards.length < 2) continue;
    const name = inFdl.find((ri) => ri.instance.instanceId === protecteeId)!.profile.name;
    // La première désignation tient ; l'erreur pointe les suivantes, celles que le joueur doit défaire.
    for (const extra of guards.slice(1)) {
      push(
        extra,
        `« ${name} » est déjà désignée par « ${guards[0].profile.name} » : elle n'offre qu'un seul emplacement de garde.`,
      );
    }
  }
}

/**
 * Les esclaves (LDR Saison 2, p. 10) : possédés par un Seigneur de guerre du Fer de Lance, jamais
 * plus nombreux que les autres combattants, et équipés au mieux d'une arme de mêlée gratuite.
 * Tout se juge dans le Fer de Lance d'accueil : ailleurs, la même figurine est une recrue ordinaire.
 */
function validateSlaves(cat: Catalog, fdl: FerDeLance, inFdl: ResolvedInstance[], issues: Issue[]): void {
  const slaves = inFdl.filter((ri) => isSlaveIn(ri.profile, fdl.factionId));
  if (slaves.length === 0) return;
  const push = (ri: ResolvedInstance | null, ruleId: string, message: string, sourceText: string) =>
    issues.push({
      severity: "error",
      ferDeLanceId: fdl.id,
      instanceId: ri?.instance.instanceId,
      ruleId,
      message,
      sourceText,
    });

  // Le porteur : celui dont la liste de rattachés contient l'esclave (même mécanique que les Likans).
  const carrierOf = new Map<string, ResolvedInstance>();
  for (const ri of inFdl) {
    for (const attachedId of ri.instance.attachedInstanceIds ?? []) {
      const slave = slaves.find((s) => s.instance.instanceId === attachedId);
      if (slave) carrierOf.set(attachedId, ri);
    }
  }

  for (const slave of slaves) {
    const carrier = carrierOf.get(slave.instance.instanceId);
    const carrierSdg = carrier
      ? sdgValue(carrier.profile, [...carrier.grantedSkills].map(([skillId, g]) => ({ skillId, value: g.value })))
      : 0;
    if (!carrier || carrierSdg === 0) {
      push(
        slave,
        "slave-no-warlord",
        `« ${slave.profile.name} » est une esclave : elle doit appartenir à un Seigneur de guerre du Fer de Lance.`,
        "Les « esclaves » peuvent être recrutés dans un Fer de Lance dont au moins un combattant possède la compétence « SDG X ».",
      );
    }
    // Améliorations payantes : personne n'investit sur un esclave. Sa carte peut le viser (« Lien
    // de la Terre » vise tous les Dogons), mais elle est asservie, pas soutenue par les siens.
    const upgrades = (slave.instance.specialCardIds ?? []).filter(
      (id) => cat.specialCards.find((c) => c.id === id)?.amelioration,
    );
    if (upgrades.length > 0) {
      const names = upgrades.map((id) => cat.specialCards.find((c) => c.id === id)?.name ?? id);
      push(
        slave,
        "slave-upgrade",
        `« ${slave.profile.name} » est une esclave : elle ne bénéficie d'aucune amélioration (${names.join(", ")}).`,
        "Les esclaves combattent malgré eux ; aucun peuple ne se risque à les équiper plus richement.",
      );
    }
    // Achats interdits : seule une arme de corps à corps gratuite est tolérée (l'équipement imprimé
    // sur la carte reste le sien, il n'est pas acheté).
    const bought = slave.instance.addedEquipmentIds;
    if (bought.length > 0) {
      const offending = bought.filter((id) => {
        const eq = cat.equipment.find((e) => e.id === id);
        return eq == null || !slaveMayBuy(eq);
      });
      if (offending.length > 0) {
        push(
          slave,
          "slave-equipment",
          `« ${slave.profile.name} » est une esclave : elle ne peut porter qu'une arme de corps à corps gratuite.`,
          "Les esclaves ne peuvent être équipés que d'armes de corps à corps gratuites ou combattre à mains nues.",
        );
      }
    }
  }

  // Plafond par porteur : jamais plus d'esclaves que sa valeur de SDG, et pas plus que ce
  // qu'autorise la carte de l'esclave elle-même (ex. « 1 par allié possédant SDG »).
  for (const carrier of inFdl) {
    const owned = slaves.filter((s) => carrierOf.get(s.instance.instanceId) === carrier);
    if (owned.length === 0) continue;
    const granted = [...carrier.grantedSkills].map(([skillId, g]) => ({ skillId, value: g.value }));
    const sdg = sdgValue(carrier.profile, granted);
    // Un porteur sans « SDG » n'est pas un porteur : chaque esclave s'est déjà vu reprocher
    // l'absence de Seigneur de guerre, inutile de doubler le reproche par un plafond à zéro.
    if (sdg === 0) continue;
    const cap = Math.min(sdg, ...owned.map((s) => slavePerCarrierMax(s.profile)));
    if (owned.length > cap) {
      push(
        carrier,
        "slave-over-warlord-capacity",
        `« ${carrier.profile.name} » possède ${owned.length} esclave(s) pour un maximum de ${cap}.`,
        "Ce Seigneur de guerre ne peut pas posséder plus d'esclaves que sa valeur de SDG.",
      );
    }
  }

  // Plafond de tête : les esclaves ne dépassent jamais en nombre les autres combattants.
  const others = inFdl.length - slaves.length;
  if (slaves.length > others) {
    push(
      null,
      "slave-outnumber",
      `${slaves.length} esclave(s) pour ${others} autre(s) combattant(s) : les esclaves ne peuvent pas être les plus nombreux.`,
      "Ils ne peuvent pas dépasser en nombre le total des autres combattants du Fer de Lance qui les accueille.",
    );
  }
}

/**
 * Sorts **offerts** (`grant-spell-choice`) : le choix du joueur reste rattaché à l'offre qui l'a permis.
 * Une offre qui disparaît (arme revendue, amélioration décochée) laisse un choix orphelin, qu'il faut
 * signaler plutôt que d'appliquer en douce - même logique que `spell-not-castable` pour les sorts payés.
 * Un sort ne se connaît par ailleurs qu'une fois : le prendre en offert *et* le payer serait un doublon.
 */
function validateGrantedSpells(
  cat: Catalog,
  ri: ResolvedInstance,
  push: (ruleId: string, message: string) => void,
): void {
  const { profile: p, instance: inst, traits } = ri;
  const chosenByEffect = Object.entries(inst.grantedSpellIds ?? {}).filter(([, ids]) => ids.length > 0);
  if (chosenByEffect.length === 0) return;
  const grants = new Map(spellGrants(cat, p, inst, traits).map((g) => [g.effectId, g]));
  const spellName = (id: string) => cat.spells.find((s) => s.id === id)?.name ?? id;

  for (const [effectId, ids] of chosenByEffect) {
    const grant = grants.get(effectId);
    if (!grant) {
      push(
        "granted-spell-orphan",
        `« ${p.name} » garde ${ids.length > 1 ? "des sorts offerts" : "un sort offert"} dont la source a disparu : ${ids.map(spellName).join(", ")}.`,
      );
      continue;
    }
    const eligible = new Set(grant.choices.map((s) => s.id));
    const strays = ids.filter((id) => !eligible.has(id));
    if (strays.length > 0) {
      push(
        "granted-spell-not-eligible",
        `« ${p.name} » : ${strays.map(spellName).join(", ")} ne fait pas partie des sorts offerts par « ${grant.name} ».`,
      );
    }
    if (ids.length > grant.count) {
      push(
        "granted-spell-over-count",
        `« ${p.name} » : ${ids.length} sorts offerts par « ${grant.name} » pour ${grant.count} accordé${grant.count > 1 ? "s" : ""}.`,
      );
    }
  }

  // Un même sort ne peut être connu qu'une fois, qu'il soit offert par deux sources ou offert et payé.
  const all = [...inst.spellIds, ...chosenByEffect.flatMap(([, ids]) => ids)];
  const dupes = [...new Set(all.filter((id, i) => all.indexOf(id) !== i))];
  if (dupes.length > 0) {
    push(
      "spell-duplicate",
      `« ${p.name} » connaît ${dupes.length > 1 ? "plusieurs fois les sorts" : "deux fois le sort"} : ${dupes.map(spellName).join(", ")}.`,
    );
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

    validateGrantedSpells(cat, ri, push);

    if (inst.spellIds.length > 0) {
      const granted = [...ri.grantedSkills].map(([skillId, g]) => ({ skillId, value: g.value }));
      const ways = castWays(cat, p, inst, traits, [...ri.grantedSkills.keys()]);
      if (ways.length === 0) {
        push("spells-no-caster", `« ${p.name} » a des sorts alors qu'elle ne peut pas en lancer.`);
      } else {
        // Sorts hors de portée : voie non maîtrisée ou réservation non satisfaite. Le cas se produit
        // quand ce qui ouvrait la voie disparaît APRÈS le choix des sorts (objet retiré, amélioration
        // décochée) - ex. le Grimoire de Josève, qui rend Balthus archimage, revendu après coup.
        // Les sorts connus d'office échappent à cette vérification : ils ne sont pas choisis.
        const allowed = new Set([
          ...castableSpells(cat, p, traits, ways, granted).map((s) => s.id),
          ...innateSpellIds(cat, p, inst, traits),
        ]);
        const strays = inst.spellIds.filter((id) => !allowed.has(id));
        if (strays.length > 0) {
          const names = strays.map((id) => cat.spells.find((s) => s.id === id)?.name ?? id);
          push(
            "spell-not-castable",
            `« ${p.name} » ne peut pas connaître ${names.length > 1 ? "ces sorts" : "ce sort"} : ${names.join(", ")}.`,
          );
        }
        // Sorts génériques : budget en niveaux (autant de niveaux de sorts que le niveau du profil).
        const gen = genericSpellAllocation(cat, p, inst);
        if (gen.over) {
          push(
            "generic-spells-over-level",
            `« ${p.name} » : ${gen.used} niveaux de sorts génériques pour un profil de niveau ${gen.cap}.`,
          );
        }
        // Attribution optimale : les pools dédiés (Brassards) absorbent d'abord, le surplus va au général.
        const alloc = pageAllocation(cat, p, inst, traits);
        if (alloc.over) {
          const g = alloc.general;
          push(
            "pages-over-capacity",
            `« ${p.name} » : ${g.used} pages de sorts pour ${g.cap === Infinity ? "∞" : g.cap} au budget général` +
              (alloc.pools.length > 0
                ? ` (hors pools dédiés : ${alloc.pools.map((pl) => `${pl.wayName} ${pl.used}/${pl.cap}`).join(", ")})`
                : "") +
              ".",
          );
        }
      }
    }

    // La limitation de mains ne s'applique qu'en jeu : on n'en fait pas une contrainte de recrutement.
    // Une armure ordinaire au plus, plus une armure cumulable (Gambison) qui a son propre emplacement.
    const armor = armorsWorn(cat, p, inst);
    if (armor.standard > 1) push("multiple-armor", `« ${p.name} » porte plusieurs armures.`);
    if (armor.stackable > 1) push("multiple-armor", `« ${p.name} » porte plusieurs armures cumulables.`);
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
 *
 * Volontairement `instanceMatchesIdentity` et non `resolveTargets` : cette opération vise des
 * **groupes de recrutement**, jamais la figurine-source. Honorer `self` ici rendrait la limitation
 * inopérante - N exemplaires recrutés produiraient N occurrences, donc une limite de `base + N`,
 * toujours supérieure à N. L'éditeur interdit d'ailleurs `self` sur cette action.
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
 * (X → sa valeur ; U/P → 1 ; special → pas de plafond d'emplacement). Partagé entre le
 * moteur et le constructeur.
 */
export function slotCapacity(cat: Catalog, modelId: string, level: number): number {
  const target =
    cat.profiles.find((p) => p.modelId === modelId && p.level === level && p.limitation.kind === "X") ??
    cat.profiles.find((p) => p.modelId === modelId && p.level === level);
  if (!target) return Infinity;
  if (target.limitation.kind === "X") return target.limitation.value ?? Infinity;
  // « special » : la limite n'est pas un plafond d'emplacement simple mais une règle dédiée
  // (ex. capacité de rattachement des Likans, validée par `validateAttachments`) - pas de cap ici.
  if (target.limitation.kind === "special") return Infinity;
  return 1;
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
      cat.profiles.find((p) => p.modelId === modelId && p.level === level && p.limitation.kind === "X") ??
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
  cat: Catalog,
  fdl: FerDeLance,
  inFdl: ResolvedInstance[],
  issues: Issue[],
): void {
  const host = cat.factions.find((f) => f.id === fdl.factionId);
  for (const ri of inFdl) {
    const pf = ri.profile.factionId;
    if (!pf || pf === fdl.factionId) continue; // sans logo ou même faction
    // Ce que la carte accorde nommément passe avant la règle générale du peuple (« Allié des X »,
    // « Apatride » imprimé) : c'est `recruitableWithoutSeal` qui arbitre, pour ne pas diverger.
    if (recruitableWithoutSeal(cat, ri.profile, fdl.factionId)) continue;
    // Refusé par la faction d'accueil : rien ne le rattrape, pas même un sceau.
    if (openRecruitmentRefuses(cat, ri.profile, fdl.factionId)) {
      issues.push({
        severity: "error",
        ferDeLanceId: fdl.id,
        instanceId: ri.instance.instanceId,
        ruleId: `faction:${ri.profile.id}`,
        message: `« ${ri.profile.name} » n'est pas accepté chez les ${host?.name ?? fdl.factionId}.`,
        sourceText:
          host?.openRecruitment?.sourceText ?? "Figurine écartée par la faction d'accueil.",
      });
      continue;
    }
    // `apatride` peut être la compétence inscrite sur la carte, ou un octroi résolu : carte « Frères
    // d'Armes » (2+ réunis) ou sceau que la figurine porte.
    if (isApatride(ri.profile, [...ri.grantedSkills.keys()])) continue;
    // Une esclave entre par la porte de service : sa condition l'autorise dans ce Fer de Lance, et
    // c'est `validateSlaves` qui lui réclame son Seigneur de guerre.
    if (isSlaveIn(ri.profile, fdl.factionId)) continue;
    if (alliedFactions(ri.profile).includes(fdl.factionId)) continue; // « Allié des X »
    if (openRecruitmentAccepts(cat, ri.profile, fdl.factionId)) continue; // recrutement ouvert
    // Voie de sortie encore ouverte : réunir un second frère d'armes, ou payer le sceau.
    const seal = sealFor(cat, ri.profile);
    const remedy = ri.profile.traits.includes(FRERE_D_ARMES)
      ? ` Il lui faut un second « frère d'armes »${seal ? `, ou « ${seal.name} » (+${seal.cost} Ko)` : ""}.`
      : seal
        ? ` Il lui faut « ${seal.name} » (+${seal.cost} Ko).`
        : "";
    issues.push({
      severity: "error",
      ferDeLanceId: fdl.id,
      instanceId: ri.instance.instanceId,
      ruleId: `faction:${ri.profile.id}`,
      message: `« ${ri.profile.name} » (${pf}) ne peut pas être recruté dans un Fer de Lance ${fdl.factionId}.${remedy}`,
      sourceText: "Vous devez composer votre Fer de Lance en choisissant parmi une unique faction.",
    });
  }
}

/**
 * Origine choisie au recrutement : elle doit être posée, et figurer parmi celles que la carte
 * propose. Vérifié même si l'interface l'impose, parce qu'une liste peut arriver par import ou avoir
 * été écrite avant que la carte n'offre ce choix.
 */
function validateChosenOrigin(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  for (const ri of resolved) {
    if (!needsOriginChoice(ri.profile)) continue;
    if (effectiveOrigin(ri.profile, ri.instance) != null) continue;
    const noms = (ri.profile.originChoices ?? [])
      .map((f) => cat.factions.find((x) => x.id === f)?.name ?? f)
      .join(", ");
    issues.push({
      severity: "error",
      ferDeLanceId: ri.ferDeLanceId,
      instanceId: ri.instance.instanceId,
      ruleId: `origin:${ri.profile.id}`,
      message: `« ${ri.profile.name} » doit venir d'un peuple : ${noms}.`,
      sourceText: "Recrutés dans tous les royaumes, ils peuvent venir de n'importe quel peuple.",
    });
  }
}

/**
 * Plafonds du recrutement ouvert : « il ne peut y en avoir plus d'un par Fer de Lance » (les shamans
 * goûns, les prêtres du sacrifice khérops chez les Affranchis). Ne s'applique qu'aux figurines
 * **entrées par cette porte** : un shaman goûn dans un Fer de Lance goûn n'est pas concerné.
 */
function validateOpenRecruitmentCaps(
  cat: Catalog,
  fdl: FerDeLance,
  inFdl: ResolvedInstance[],
  issues: Issue[],
): void {
  const caps = cat.factions.find((f) => f.id === fdl.factionId)?.openRecruitment?.caps;
  for (const cap of caps ?? []) {
    const matching = inFdl.filter(
      (ri) =>
        cap.profileIds.includes(ri.profile.id) &&
        openRecruitmentAccepts(cat, ri.profile, fdl.factionId),
    );
    if (matching.length <= cap.max) continue;
    for (const ri of matching) {
      issues.push({
        severity: "error",
        ferDeLanceId: fdl.id,
        instanceId: ri.instance.instanceId,
        ruleId: `open-recruitment-cap:${cap.label}`,
        message: `${matching.length} « ${cap.label} » dans ce Fer de Lance, pour un maximum de ${cap.max}.`,
        sourceText: `Il ne peut y avoir plus de ${cap.max} « ${cap.label} » par Fer de Lance.`,
      });
    }
  }
}

/**
 * Paramètres de `forbids-equipment`. Les trois filtres se lisent ensemble : un objet est interdit
 * s'il passe **tous** ceux qui sont renseignés, et qu'il ne figure pas dans les exceptions.
 *
 * - `categories` : catégories visées (vide = toutes) ;
 * - `hands` : nombre de mains visé (vide = tous), pour « ne peut manier d'arme à 2 mains ». Une arme
 *   bâtarde (`hands: "1-2"`) n'est jamais visée : elle se manie aussi à une main, donc rien
 *   n'interdit de la porter ;
 * - `exceptEquipmentIds` : liste blanche qui échappe à l'interdiction, pour les cartes qui n'ouvrent
 *   qu'un choix fermé (« ne peut choisir que la Sarclette ou le Couteau »).
 */
type ForbidEquipmentParams = {
  categories?: string[];
  hands?: number[];
  exceptEquipmentIds?: string[];
};

function forbidEquipmentParams(c: Constraint): ForbidEquipmentParams {
  const p = c.params as Record<string, unknown>;
  const list = (k: string): unknown[] => (Array.isArray(p[k]) ? (p[k] as unknown[]) : []);
  return {
    categories: list("categories") as string[],
    hands: (list("hands") as unknown[]).map(Number).filter((n) => Number.isFinite(n)),
    exceptEquipmentIds: list("exceptEquipmentIds") as string[],
  };
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
    const { categories, hands, exceptEquipmentIds } = forbidEquipmentParams(constraint);
    // Contrainte sans aucun filtre = brouillon d'admin (créée avec des params vierges) : elle
    // n'interdit rien, plutôt que de tout interdire d'un coup sur une fiche en cours de saisie.
    if (!categories?.length && !hands?.length) continue;
    for (const ri of resolved.filter((r) => r.profile.id === subjectProfileId)) {
      const offending = ri.instance.addedEquipmentIds.filter((id) => {
        if (exceptEquipmentIds?.includes(id)) return false;
        if (categories?.length && !categories.includes(idx.equipmentCategory.get(id) ?? "")) return false;
        if (hands?.length) {
          // `hands` non numérique (arme bâtarde « 1-2 ») : jamais visée, cf. `ForbidEquipmentParams`.
          const h = cat.equipment.find((e) => e.id === id)?.hands;
          if (typeof h !== "number" || !hands.includes(h)) return false;
        }
        return true;
      });
      if (offending.length > 0) {
        issues.push({
          severity: "error",
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

/**
 * Armes gratuites (FAQ 2026, « Équipements ») : « Chaque Safar peut partir au combat avec une et
 * unique arme gratuite. Il est cependant possible d'équiper plusieurs Safars de la même arme
 * gratuite, sans pour autant dépasser la moitié du fer de lance équipé avec la même arme gratuite.
 * Une arme gratuite figurant sur la carte de profil d'un Safar n'entre pas dans ce maximum autorisé. »
 *
 * Deux plafonds, donc, qui ne se comptent pas pareil :
 *
 * - **une par Safar**, l'arme de sa carte comprise - c'est ce avec quoi il part au combat. Le panneau
 *   d'équipement l'empêche déjà à la saisie ; on le vérifie pour les listes importées ou plus vieilles
 *   que la règle ;
 * - **la moitié du Fer de Lance** sous la même arme gratuite, en ne comptant que les exemplaires
 *   achetés. Signalé au niveau du Fer de Lance (sans `instanceId`) : c'est la composition qui est en
 *   faute, pas une figurine en particulier, et le reproche n'a pas à se répéter sur chaque fiche.
 */
function validateFreeWeapons(
  cat: Catalog,
  fdl: FerDeLance,
  inFdl: ResolvedInstance[],
  issues: Issue[],
): void {
  const name = (id: string) => cat.equipment.find((e) => e.id === id)?.name ?? id;
  const buyers = new Map<string, number>(); // arme gratuite → nombre de figurines qui l'ont achetée
  for (const ri of inFdl) {
    const { printed, bought } = freeWeaponsCarried(cat, ri.profile, ri.instance);
    const all = [...printed, ...bought];
    if (all.length > 1) {
      issues.push({
        severity: "error",
        ferDeLanceId: fdl.id,
        instanceId: ri.instance.instanceId,
        ruleId: "free-weapon-single",
        message: `« ${ri.profile.name} » emporte ${all.length} armes gratuites (${all.map(name).join(", ")}) : une seule est permise.`,
        sourceText: "Chaque Safar peut partir au combat avec une et unique arme gratuite.",
      });
    }
    // Un même Safar ne compte qu'une fois par arme, même s'il en a acheté deux exemplaires : le
    // plafond compte des Safars équipés, pas des armes.
    for (const id of new Set(bought)) buyers.set(id, (buyers.get(id) ?? 0) + 1);
  }
  // « La moitié du fer de lance », arrondie au plus bas. Le plancher à 1 épargne le Fer de Lance
  // d'une seule figurine, à qui la moitié de son effectif n'ouvrirait aucune arme gratuite.
  const cap = Math.max(1, Math.floor(inFdl.length / 2));
  for (const [id, n] of buyers) {
    if (n <= cap) continue;
    issues.push({
      severity: "error",
      ferDeLanceId: fdl.id,
      ruleId: `free-weapon-half:${id}`,
      message: `${n} figurines achètent « ${name(id)} » pour un maximum de ${cap} sur un Fer de Lance de ${inFdl.length}. Celles qui l'ont sur leur carte ne comptent pas.`,
      sourceText:
        "Il est cependant possible d'équiper plusieurs Safars de la même arme gratuite, sans pour autant dépasser la moitié du fer de lance équipé avec la même arme gratuite. Une arme gratuite figurant sur la carte de profil d'un Safar n'entre pas dans ce maximum autorisé.",
    });
  }
}

/**
 * Munitions interdites sur une arme gratuite (p.13) : la Flèche hydre sur un arc gratuit. Le panneau
 * d'achat ne les propose plus, donc seule une liste importée ou antérieure à la règle peut en porter.
 */
function validateMunitions(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  for (const ri of resolved) {
    for (const equipId of Object.keys(ri.instance.munitions ?? {})) {
      const lines = forbiddenMunitionLines(cat, ri.instance, equipId);
      if (lines.length === 0) continue;
      const weapon = cat.equipment.find((e) => e.id === equipId);
      const noms = lines.map((l) => `« ${l.label} »`).join(", ");
      issues.push({
        severity: "error",
        ferDeLanceId: ri.ferDeLanceId,
        instanceId: ri.instance.instanceId,
        ruleId: `munition-free-weapon:${equipId}`,
        message: `« ${ri.profile.name} » : ${noms} ne peut pas être acheté pour « ${weapon?.name ?? equipId} », qui est une arme gratuite.`,
        sourceText:
          "« L'affûtage » et la « dose de poison » ne peuvent pas être appliqués sur une arme de corps à corps gratuite, la « flèche hydre » ne peut pas être utilisée avec un arc gratuit.",
      });
    }
  }
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
    if (!mount || !isMountEligible(cat, ri.profile, mount, effectiveOrigin(ri.profile, ri.instance))) {
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

/** Réservations des options de monture (p.32) + équipement monté (Caparaçon sur la monture, faction). */
function validateMountOptions(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  for (const ri of resolved) {
    const mountId = ri.instance.mount?.mountId;
    const kind = mountKindOf(cat, mountId);
    const faction = ri.profile.factionId;
    const err = (ruleId: string, message: string) =>
      issues.push({
        severity: "error",
        ferDeLanceId: ri.ferDeLanceId,
        instanceId: ri.instance.instanceId,
        ruleId,
        message,
        sourceText: "Réservation d'option/équipement de monture (p.32).",
      });
    for (const [id, value] of Object.entries(ri.instance.mountOptionIds ?? {})) {
      const opt = cat.mountOptions.find((o) => o.id === id);
      if (!opt) continue;
      let why = "";
      if (!mountId) why = "nécessite une monture";
      else if (opt.reservation?.factions && !(faction && opt.reservation.factions.includes(faction)))
        why = "faction non autorisée";
      else if (opt.reservation?.mountKinds && !(kind && opt.reservation.mountKinds.includes(kind)))
        why = "nature de monture non autorisée";
      else if (opt.maxValue != null && (value < 1 || value > opt.maxValue))
        why = `valeur hors limite (1 à ${opt.maxValue})`;
      if (why) err(`mount-option-${id}`, `Option « ${opt.name} » : ${why}.`);
    }
    // Équipement porté par la MONTURE (ex. Caparaçon) : réservation de faction (goûn/Mochère exclus).
    for (const id of ri.instance.mount?.addedEquipmentIds ?? []) {
      const e = cat.equipment.find((x) => x.id === id);
      const fac = e?.reservedTo?.factionIds;
      if (e?.mountEquipment === "mount" && fac && !(faction && fac.includes(faction)))
        err(`mount-equip-${id}`, `« ${e.name} » n'est pas accessible à cette monture.`);
    }
    // Équipement porté par le CAVALIER mais réservé aux montés (ex. Lance de cavalerie) : nécessite une monture.
    for (const id of ri.instance.addedEquipmentIds) {
      const e = cat.equipment.find((x) => x.id === id);
      if (e?.mountEquipment === "rider" && !mountId)
        err(`mount-equip-${id}`, `« ${e.name} » nécessite une monture.`);
    }
  }
}

function validateReservedEquipment(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  const eqById = new Map(cat.equipment.map((e) => [e.id, e]));
  for (const ri of resolved) {
    for (const id of ri.instance.addedEquipmentIds) {
      const eq = eqById.get(id);
      if (eq && !equipmentAllowedIn(cat, eq, ri.profile, ri.fdlFactionId)) {
        // Un transfuge accueilli par le recrutement ouvert a laissé l'arsenal de son peuple derrière
        // lui : le dire, sinon la réservation semble arbitraire (l'objet est bien « à sa faction »).
        const lostArsenal =
          equipmentReservedOk(eq, ri.profile) && ri.profile.factionId !== ri.fdlFactionId;
        issues.push({
          severity: "error",
          ferDeLanceId: ri.ferDeLanceId,
          instanceId: ri.instance.instanceId,
          ruleId: `reserved-${eq.id}`,
          message: lostArsenal
            ? `« ${ri.profile.name} » a quitté son peuple : « ${eq.name} » lui reste inaccessible.`
            : `« ${ri.profile.name} » ne peut pas être équipé de « ${eq.name} » (réservé à d'autres figurines).`,
          sourceText: lostArsenal
            ? "Ayant fui leur peuple d'origine, ils ont de fait perdu l'accès à l'arsenal qui le caractérisait."
            : "Équipement réservé.",
        });
      }
    }
  }
}

/**
 * Même défense en profondeur pour l'équipement de base **soudé à la figurine**
 * (`fixedBaseEquipmentIds`) : le constructeur n'en propose pas le retrait, mais une liste importée
 * pourrait l'avoir rendu - ce qui reviendrait à en récupérer le coût indûment.
 */
function validateFixedBaseEquipment(cat: Catalog, resolved: ResolvedInstance[], issues: Issue[]): void {
  for (const ri of resolved) {
    const fixed = ri.profile.fixedBaseEquipmentIds ?? [];
    for (const id of ri.instance.removedBaseEquipmentIds) {
      if (!fixed.includes(id)) continue;
      const name = cat.equipment.find((e) => e.id === id)?.name ?? id;
      issues.push({
        severity: "error",
        ferDeLanceId: ri.ferDeLanceId,
        instanceId: ri.instance.instanceId,
        ruleId: `fixed-base-${id}`,
        message: `« ${ri.profile.name} » ne peut pas se séparer de « ${name} ».`,
        sourceText: "Équipement de base indissociable de la figurine.",
      });
    }
  }
}

/**
 * « X ne peut pas être recruté sans Y ». La **portée** de la contrainte dit où chercher Y :
 * `fer-de-lance` (défaut, ex. Xayìn & Muskh « réunis dans un même Fer de Lance ») ou `ost`
 * (la présence de Y n'importe où dans la bande suffit).
 */
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
    const inOst = req.constraint.scope === "ost";
    // Portée « ost » : un seul groupe (toute la liste). Sinon, un groupe par Fer de Lance.
    const groups = inOst
      ? [resolved]
      : [...new Set(resolved.map((ri) => ri.ferDeLanceId))].map((id) =>
          resolved.filter((ri) => ri.ferDeLanceId === id),
        );
    const where = inOst ? "l'Ost" : "le Fer de Lance";
    for (const pool of groups) {
      const subject = pool.find((ri) => ri.profile.id === req.subjectProfileId);
      if (!subject) continue;
      if (pool.some((ri) => ri.profile.id === req.requiredProfileId)) continue;
      issues.push({
        severity: "error",
        ferDeLanceId: subject.ferDeLanceId,
        instanceId: subject.instance.instanceId,
        ruleId: req.constraint.id,
        message: `« ${subject.profile.name} » nécessite la présence d'une autre figurine dans ${where}.`,
        sourceText: req.constraint.sourceText,
      });
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
          severity: "error",
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
    grantedSkills: new Map<string, { value?: string | number; precision?: string }>(),
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
    if (
      op.kind !== "stat-modifier" &&
      op.kind !== "stat-count" &&
      op.kind !== "stat-per-count" &&
      op.kind !== "stat-max"
    )
      continue;
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
        // Plancher = valeur de base imprimée (0 si le profil n'a pas de valeur sur cette carac.).
        const value = Math.max(base, count);
        // SET (non cumulatif) : si plusieurs Dogons portent l'effet, chaque occurrence fixe la même
        // valeur → idempotent, exprimé en delta sur la base.
        const m = out.get(ri.instance.instanceId) ?? new Map<string, number>();
        m.set(op.stat, value - base);
        out.set(ri.instance.instanceId, m);
      }
    } else if (op.kind === "stat-per-count") {
      // Caractéristique AUGMENTÉE de `amount` par figurine comptée : contrairement à `stat-count`,
      // le décompte s'ajoute à la valeur de base au lieu de la remplacer (ex. Mongo sombre : +1 en T
      // par Mongo en jeu). Cumulatif comme `stat-modifier`, d'où le passage par `add`.
      const pool = instancesInScope(resolved, occ.effect.scope, occ.ferDeLanceId);
      const count = pool.filter((ri) => instanceMatchesIdentity(op.of, ri)).length;
      for (const ri of resolveTargets(occ, resolved)) {
        add(ri.instance.instanceId, op.stat, op.amount * count);
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
const BERSEKER_SKILL_ID = engineIdOf("berserk");

/**
 * Un profil peut-il prendre CE niveau de monture ? Faction autorisée par le type, profil non exclu,
 * pas Berseker, et écart de niveau ≤ 1 (règles p.29). Un profil sans niveau n'est pas contraint sur l'écart.
 */
export function isMountEligible(
  cat: Catalog,
  profile: Profile,
  mount: Mount,
  /** Origine effective de la figurine, quand sa carte laisse le choix (cf. `effectiveOrigin`). */
  origin: string | undefined = originFactionId(profile),
): boolean {
  const type = cat.mountTypes.find((t) => t.id === mount.typeId);
  if (!type) return false;
  // Éligibilité par ORIGINE : le peuple d'origine (`profile.origin`, défaut = sa faction), car les
  // figurines des factions « creuset » gardent l'accès à la monture de leur peuple d'avant, mais pas
  // à ses objets/sorts réservés (FAQ). Une faction creuset n'a donc pas à figurer dans
  // `factionEligibility` : ses membres y entrent par leur origine.
  if (!(origin != null && type.factionEligibility.includes(origin))) return false;
  if (type.excludedProfileIds?.includes(profile.id)) return false;
  if (profile.skills.some((s) => s.skillId === BERSEKER_SKILL_ID)) return false;
  if (profile.level != null && Math.abs(mount.level - profile.level) > 1) return false;
  return true;
}

/** Montures (niveaux) qu'un profil donné peut recruter, pour l'origine indiquée. */
export function eligibleMountsFor(
  cat: Catalog,
  profile: Profile,
  origin: string | undefined = originFactionId(profile),
): Mount[] {
  return cat.mounts.filter((m) => isMountEligible(cat, profile, m, origin));
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
    if (
      op.kind === "stat-modifier" ||
      op.kind === "stat-count" ||
      op.kind === "stat-per-count" ||
      op.kind === "stat-max"
    )
      key = `stat:${op.stat}`;
    else if (op.kind === "grant-skill" || op.kind === "skill-count") key = `skill:${op.skillId}`;
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
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;

    if (op.kind === "skill-count") {
      const pool = instancesInScope(resolved, occ.effect.scope, occ.ferDeLanceId);
      const count = pool.filter((ri) => instanceMatchesIdentity(op.of, ri)).length;
      const value = Math.floor(count / (op.per && op.per > 0 ? op.per : 1));
      for (const ri of resolveTargets(occ, resolved)) {
        const m = out.get(ri.instance.instanceId) ?? new Map<string, number>();
        m.set(op.skillId, value); // SET non cumulatif (idempotent si plusieurs porteurs)
        out.set(ri.instance.instanceId, m);
      }
    } else if (op.kind === "grant-skill" && op.incrementIfPresent != null) {
      // « +N si déjà connue » : augmente la valeur NATIVE de la cible (Symbiose Moringa, Khépesh Brutalité).
      for (const ri of resolveTargets(occ, resolved)) {
        const native = ri.profile.skills.find((s) => s.skillId === op.skillId);
        if (!native) continue; // absente → octroi normal de `value` (cf. applyGrants), pas d'incrément
        const base = typeof native.value === "number" ? native.value : 0;
        const m = out.get(ri.instance.instanceId) ?? new Map<string, number>();
        m.set(op.skillId, base + op.incrementIfPresent); // SET idempotent (valeur native + N)
        out.set(ri.instance.instanceId, m);
      }
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

/**
 * Surcoût des améliorations d'équipement cochées (opt-in par objet), pour une instance. Compte les
 * intrinsèques comme les octroyées : c'est `upgradesForEquipment` qui dit ce qui est achetable, et
 * cette liste doit être la même que celle affichée dans le constructeur.
 */
function upgradeCost(ri: ResolvedInstance, granted: Map<string, GrantedUpgrade>, cat: Catalog): number {
  const ups = ri.instance.equipmentUpgrades;
  if (!ups) return 0;
  const worn = new Set(wornEquipmentIds(ri.profile, ri.instance));
  const grantedList = [...granted.values()];
  let cost = 0;
  for (const [equipId, upIds] of Object.entries(ups)) {
    if (!worn.has(equipId)) continue; // amélioration sur un équipement retiré : ignorée
    const equipment = cat.equipment.find((e) => e.id === equipId);
    if (!equipment) continue;
    const available = new Map(upgradesForEquipment(equipment, grantedList).map((u) => [u.id, u]));
    for (const upId of upIds) cost += available.get(upId)?.cost ?? 0;
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
): { allonge: Map<string, number>; optionGrants: Map<string, GrantedSkill[]> } {
  const allonge = new Map<string, number>();
  const optionGrants = new Map<string, GrantedSkill[]>();
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

    // Options « cavalier » et « partagées » achetées (p.32) : conférées à la fiche du CAVALIER. Règle
    // « meilleure valeur » face à une compétence native (numérique) : on remplace la native ; sinon octroi.
    const optRef: EffectSourceRef = { label: "Option de monture", text: "Compétence achetée (p.32)." };
    for (const gs of mountOptionSkills(cat, ri.instance, ["rider", "both"])) {
      const rs = ri.profile.skills.find((s) => s.skillId === gs.skillId);
      const gv = Number(gs.value);
      if (rs) {
        const rv = Number(rs.value);
        if (Number.isFinite(rv) && Number.isFinite(gv) && gv > rv) {
          const sv = skillValues.get(id) ?? new Map<string, number>();
          sv.set(gs.skillId, gv);
          skillValues.set(id, sv);
        } else continue; // native déjà présente et pas améliorée → rien à afficher en plus
      } else {
        const arr = optionGrants.get(id) ?? [];
        arr.push(gs);
        optionGrants.set(id, arr);
      }
      const m = sources.get(id) ?? new Map<string, EffectSourceRef[]>();
      const refs = m.get(`skill:${gs.skillId}`) ?? [];
      if (!refs.some((r) => r.label === optRef.label)) refs.push(optRef);
      m.set(`skill:${gs.skillId}`, refs);
      sources.set(id, m);
    }
  }
  return { allonge, optionGrants };
}

/** Compétence « Berseker » (transmises exclues) - voir `MOUNT_TRANSMITTED_SKILLS`. */
const MOUNT_TRANSMITTED_SKILLS = ["endurance", "harcelement", "instinct-de-survie"];

/**
 * Compétences effectives de la fiche d'une MONTURE (règles de bataille p.28 + FaQ) : ses compétences
 * natives, plus les 3 seules compétences que le cavalier lui transmet (endurance, harcèlement, instinct
 * de survie) si le cavalier les possède. Règle « meilleure valeur » pour une compétence commune.
 */
export function mountSheetSkills(
  mount: Mount,
  rider: Profile,
  /** Options achetées : celles de la MONTURE (+ partagées) et celles du CAVALIER (+ partagées, pour la transmission). */
  extra?: { mountBought?: GrantedSkill[]; riderBought?: GrantedSkill[] },
): GrantedSkill[] {
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
  for (const s of extra?.mountBought ?? []) put(s.skillId, s.value); // options « monture » + partagées
  // Transmission : les 3 compétences natives OU achetées (p.21-23) que le cavalier transmet à la monture.
  const riderSkills = [...rider.skills, ...(extra?.riderBought ?? [])];
  for (const s of riderSkills) if (MOUNT_TRANSMITTED_SKILLS.includes(s.skillId)) put(s.skillId, s.value);
  return [...out].map(([skillId, value]) => ({ skillId, value }));
}

/** Compétences conférées par les options achetées d'une figurine, filtrées par panier. */
export function mountOptionSkills(
  cat: Catalog,
  inst: ProfileInstance,
  buckets: MountOption["bucket"][],
): GrantedSkill[] {
  const out: GrantedSkill[] = [];
  for (const [id, value] of Object.entries(inst.mountOptionIds ?? {})) {
    const opt = cat.mountOptions.find((o) => o.id === id);
    if (!opt?.grantsSkill || !buckets.includes(opt.bucket)) continue;
    out.push({ skillId: opt.grantsSkill.skillId, value: opt.maxValue != null ? value : opt.grantsSkill.value });
  }
  return out;
}

// ── Point d'entrée ───────────────────────────────────────────────────────────

export function evaluateList(cat: Catalog, list: ListDocument): EvaluationResult {
  const idx = indexCatalog(cat);
  const resolved = buildResolved(list, idx);
  const occurrences = [
    ...collectEffectOccurrences(resolved, cat, idx),
    ...ostCardOccurrences(list, cat, resolved),
  ];

  applyGrants(resolved, occurrences); // 1-2 : octrois jusqu'au point fixe (construction)
  const cost = computeCosts(resolved, occurrences, idx, cat); // 4 : coûts
  // 4b : améliorations d'équipement octroyées (unlock-upgrade) + surcoût des options cochées.
  const grantedUp = collectGrantedUpgrades(resolved, occurrences);
  for (const ri of resolved) {
    const extra = upgradeCost(ri, grantedUp.get(ri.instance.instanceId) ?? new Map(), cat);
    if (extra) cost.set(ri.instance.instanceId, (cost.get(ri.instance.instanceId) ?? 0) + extra);
  }
  const limitBonuses = collectLimitBonuses(resolved, occurrences); // +1 limite (Lieutenant…)
  const equipmentCostRules = collectEquipmentCostRules(resolved, occurrences, cat); // remises par objet
  const issues = validate(cat, list, resolved, idx, limitBonuses); // 5 : contraintes

  // Affichage : mêmes effets, mais appliqués sur des CLONES pour ne pas polluer le calcul des coûts
  // (les deltas de stat / valeurs de compétence ne doivent pas rétroagir sur la construction).
  const display = cloneForDisplay(resolved);
  const displayOcc = [
    ...collectEffectOccurrences(display, cat, idx),
    ...ostCardOccurrences(list, cat, display),
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
    const mc = mountCostOf(ri.instance, idx, cat, ri.profile.factionId);
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
      const optSkills = mount.optionGrants.get(id) ?? [];
      if (dri.grantedSkills.size > 0 || extraSkills.length > 0 || optSkills.length > 0) {
        const merged: GrantedSkill[] = [...dri.grantedSkills].map(([skillId, g]) => ({
          skillId,
          value: g.value,
          precision: g.precision,
        }));
        // Fusionne les compétences des améliorations d'équipement (Borax…) et des options de monture (p.32).
        for (const gs of [...extraSkills, ...optSkills]) {
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
