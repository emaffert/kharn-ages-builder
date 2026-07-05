import type {
  Catalog,
  Constraint,
  Effect,
  EffectScope,
  FerDeLance,
  ListDocument,
  Profile,
  ProfileInstance,
  Selector,
  SpecialCard,
} from "../model";
import {
  armorsWorn,
  castWays,
  forbiddenGrimoires,
  handCapacity,
  handsUsed,
  pageCapacity,
  pagesUsed,
} from "./magic";

/**
 * Moteur d'évaluation d'une liste : calcul de coût + validation, en tenant compte
 * des effets dynamiques (octrois, déblocages, modificateurs de coût).
 * Référence : docs/schema-donnees.md — couche 2 (ordre de résolution).
 *
 * Opérations d'effet prises en charge ici : `cost-delta`, `cost-set`, `grant-trait`,
 * `grant-skill` (`spell-pages` est traité par engine/magic.ts pour la capacité de pages).
 * TODO — opérations définies au schéma mais PAS encore appliquées à l'évaluation :
 *   `stat-modifier` (ex. Apprentie de Nyx : +niveau en I), `unlock-upgrade`, `cap`.
 *   Tant qu'elles ne sont pas implémentées, ces effets sont sans incidence sur coût/stats.
 */

/** Compétence octroyée par un effet (avec sa valeur éventuelle pour les compétences « à valeur »). */
export type GrantedSkill = { skillId: string; value?: string | number };

export interface Issue {
  severity: "error" | "warning";
  ferDeLanceId?: string;
  instanceId?: string;
  ruleId?: string;
  message: string;
  /** Wording officiel — fait foi. */
  sourceText: string;
}

export interface EvaluationResult {
  totalCost: number;
  costByInstance: Record<string, number>;
  costByFerDeLance: Record<string, number>;
  /** Traits octroyés par effet, par instance (en plus des traits de base du profil). Pour l'affichage. */
  grantedTraits: Record<string, string[]>;
  /** Compétences octroyées par effet, par instance (avec valeur éventuelle, ex. Héroïque « défense »). */
  grantedSkills: Record<string, GrantedSkill[]>;
  /** Modificateurs de caractéristiques cumulés par effet, par instance (stat -> delta). Pour l'affichage. */
  statDeltas: Record<string, Record<string, number>>;
  /** Valeurs de compétences calculées par effet, par instance (skillId -> valeur). Pour l'affichage. */
  skillValues: Record<string, Record<string, number>>;
  issues: Issue[];
}

interface CatalogIndex {
  profile: Map<string, Profile>;
  specialCard: Map<string, SpecialCard>;
  equipmentCost: Map<string, number>;
  equipmentCategory: Map<string, string>;
  munitionUnitCost: Map<string, number>;
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
    munitionUnitCost: new Map(
      cat.equipment.filter((e) => e.munition).map((e) => [e.id, e.munition!.unitCost]),
    ),
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
  /** true => inclut aussi les effets « en jeu » (appliesToListBuilding false) — pour l'affichage. */
  includeInGame = false,
): EffectOccurrence[] {
  const occurrences: EffectOccurrence[] = [];

  // Effets portés par les profils présents. Un effet « optIn » (choix du joueur) n'est appliqué
  // que si l'instance a explicitement opté — désignée garde du corps (ex. Djouked → −35 pour Broutcha).
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

  // Effets des cartes spéciales « intrinsèques » (coût 0). Le nombre de figurines
  // concernées (`sourceCount`) module les effets « par source »
  // (ex. 1 Larbin gratuit PAR Fille de Nyx, plafonné à 2).
  const fdlIds = [...new Set(resolved.map((ri) => ri.ferDeLanceId))];
  for (const card of cat.specialCards) {
    // Intrinsèque = appliquée d'office : coût 0 ET pas une amélioration (celles-ci relèvent
    // d'un choix du joueur, appliquées via `instance.specialCardIds`).
    if (card.cost !== 0 || card.amelioration) continue;
    for (const fdlId of fdlIds) {
      const inFdl = resolved.filter((ri) => ri.ferDeLanceId === fdlId);
      const matchCount = inFdl.filter((ri) => specialCardScopeMatches(card, ri)).length;
      if (matchCount > 0) {
        for (const effect of card.effects) {
          if ((!includeInGame && !effect.appliesToListBuilding) || effect.optIn) continue;
          occurrences.push({ effect, ferDeLanceId: fdlId, sourceCount: matchCount });
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
  return false;
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
  if (effect.target.self) {
    return pool.filter((ri) => ri.instance.instanceId === occ.sourceInstanceId);
  }
  return pool.filter((ri) => instanceMatchesIdentity(effect.target, ri));
}

function baseInstanceCost(ri: ResolvedInstance, idx: CatalogIndex): number {
  const inst = ri.instance;
  let cost = ri.profile.cost;
  for (const id of inst.removedBaseEquipmentIds) cost -= idx.equipmentCost.get(id) ?? 0;
  for (const id of inst.addedEquipmentIds) cost += idx.equipmentCost.get(id) ?? 0;
  if (inst.grimoireId) cost += idx.grimoireCost.get(inst.grimoireId) ?? 0;
  for (const id of inst.spellIds) cost += idx.spellCost.get(id) ?? 0;
  for (const [equipId, qty] of Object.entries(inst.munitions ?? {})) {
    cost += (idx.munitionUnitCost.get(equipId) ?? 0) * qty;
  }
  if (inst.mount) {
    cost += idx.mountCost.get(inst.mount.mountId) ?? 0;
    for (const id of inst.mount.optionIds) cost += idx.mountOptionCost.get(id) ?? 0;
  }
  for (const id of inst.orderIds ?? []) cost += idx.orderCost.get(id) ?? 0;
  for (const id of inst.specialCardIds ?? []) {
    const card = idx.specialCard.get(id);
    // Les améliorations partagées sont facturées une fois par Fer de Lance (cf. computeCosts), pas par instance.
    if (card?.shared) continue;
    cost += card?.cost ?? 0;
  }
  return cost;
}

function computeCosts(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
  idx: CatalogIndex,
): Map<string, number> {
  const cost = new Map<string, number>();
  for (const ri of resolved) cost.set(ri.instance.instanceId, baseInstanceCost(ri, idx));

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
      const cats = occ.effect.target.equipmentCategories;
      const ids = occ.effect.target.equipmentIds;
      let delta = op.amount;
      if ((cats && cats.length > 0) || (ids && ids.length > 0)) {
        // Appliqué une fois par équipement ajouté ciblé (par catégorie et/ou par id).
        const n = ri.instance.addedEquipmentIds.filter(
          (id) =>
            (cats?.includes((idx.equipmentCategory.get(id) ?? "") as never) ?? false) ||
            (ids?.includes(id) ?? false),
        ).length;
        delta = op.amount * n;
      }
      cost.set(ri.instance.instanceId, (cost.get(ri.instance.instanceId) ?? 0) + delta);
    }
  }

  // cost-set : fixe le coût (ex. larbins « garde du corps » gratuits). Seules les cibles
  // *désignées* (bodyguardOfInstanceId) en bénéficient — le joueur choisit qui occupe l'emplacement —
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
): Issue[] {
  const issues: Issue[] = [];

  for (const fdl of list.fersDeLance) {
    const inFdl = resolved.filter((ri) => ri.ferDeLanceId === fdl.id);
    validateLimitations(fdl, inFdl, issues);
    validateConsumesSlot(cat, fdl, inFdl, issues);
    validateFactionMembership(fdl, inFdl, issues);
    validateLeader(fdl, inFdl, issues);
  }

  validateForbiddenEquipment(cat, resolved, idx, issues);
  validateReservedEquipment(cat, resolved, issues);
  validateRequiresPresent(cat, resolved, issues);
  validateAttachments(cat, list, resolved, issues);
  validateSpecialCardScope(idx, resolved, issues);
  validateMagicAndSlots(cat, resolved, issues);

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
        sourceText: "Règles de création de liste — équipement & magie.",
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

    const hands = handsUsed(cat, p, inst);
    const cap = handCapacity(p);
    if (hands > cap) push("hands-over-capacity", `« ${p.name} » : trop d'équipement à mains (${hands} / ${cap}).`);
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
      const matches =
        (card.scope.profileIds?.includes(ri.profile.id) ?? false) ||
        (card.scope.trait ? ri.traits.has(card.scope.trait) : false);
      if (!matches) {
        issues.push({
          severity: "error",
          ferDeLanceId: ri.ferDeLanceId,
          instanceId: ri.instance.instanceId,
          ruleId: `special-card-scope:${cardId}`,
          message: `La carte « ${card.name} » ne peut pas être attribuée à « ${ri.profile.name} ».`,
          sourceText: `Réservée à ${card.scope.trait ?? "des profils spécifiques"}.`,
        });
      }
    }
  }
}

function validateLimitations(fdl: FerDeLance, inFdl: ResolvedInstance[], issues: Issue[]): void {
  // Compté par (modèle, niveau) : les variantes de loadout (même modèle ET même niveau, profils
  // distincts) partagent la même limitation ; des niveaux différents comptent séparément
  // (un modèle avec un N2 « U » et un N3 « U » peut aligner le N2 et le N3).
  const groups = new Map<string, { ri: ResolvedInstance; count: number }>();
  for (const ri of inFdl) {
    const key = ri.profile.modelId != null ? `${ri.profile.modelId}#${ri.profile.level ?? 0}` : ri.profile.id;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { ri, count: 1 });
  }
  for (const [key, { ri, count }] of groups) {
    const lim = ri.profile.limitation;
    const max =
      lim.kind === "X" ? (lim.value ?? Infinity) : lim.kind === "U" || lim.kind === "P" ? 1 : Infinity;
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
 * LIM P : un personnage « occupe la place » d'un profil générique (modèle, niveau) via une contrainte
 * `consumes-slot` { modelId, level }. Combattants du profil cible + personnages consommant son créneau
 * ne peuvent dépasser la limitation du profil cible (ex. Engueran prend une place de Paladin III).
 */
function validateConsumesSlot(cat: Catalog, fdl: FerDeLance, inFdl: ResolvedInstance[], issues: Issue[]): void {
  const bySlot = new Map<string, { modelId: string; level: number; consumers: ResolvedInstance[] }>();
  for (const ri of inFdl) {
    for (const c of ri.profile.recruitment) {
      if (c.type !== "consumes-slot") continue;
      const { modelId, level } = c.params as { modelId?: string; level?: number };
      if (!modelId || typeof level !== "number") continue;
      const key = `${modelId}#${level}`;
      const slot = bySlot.get(key) ?? { modelId, level, consumers: [] };
      slot.consumers.push(ri);
      bySlot.set(key, slot);
    }
  }
  for (const { modelId, level, consumers } of bySlot.values()) {
    const target =
      cat.profiles.find((p) => p.modelId === modelId && p.level === level && !p.isNamed) ??
      cat.profiles.find((p) => p.modelId === modelId && p.level === level);
    if (!target) continue;
    const allowed = target.limitation.kind === "X" ? (target.limitation.value ?? Infinity) : 1;
    const total = inFdl.filter((ri) => ri.profile.id === target.id).length + consumers.length;
    if (total > allowed) {
      const src = consumers[0].profile.recruitment.find((c) => c.type === "consumes-slot");
      issues.push({
        severity: "error",
        ferDeLanceId: fdl.id,
        ruleId: `consumes-slot:${modelId}#${level}`,
        message: `${total} occupant(s) de la place de « ${target.name} » (niveau ${level}) pour une limite de ${allowed}.`,
        sourceText: src?.sourceText ?? "",
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
 * figurine non éligible, mais une liste importée pourrait en contenir un — on le signale ici.
 * On ne contrôle que l'équipement AJOUTÉ (l'équipement de base est défini par la carte).
 */
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
      // capacité — un Muskh rattaché à Xàyin, par ex., ne consomme pas la capacité Likan.
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
    if (op.kind !== "stat-modifier" && op.kind !== "stat-count") continue;
    if (!conditionHolds(occ.effect.condition, occ.effect.scope, occ.ferDeLanceId, resolved)) continue;
    if (op.kind === "stat-count") {
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

// ── Point d'entrée ───────────────────────────────────────────────────────────

export function evaluateList(cat: Catalog, list: ListDocument): EvaluationResult {
  const idx = indexCatalog(cat);
  const resolved = buildResolved(list, idx);
  const occurrences = collectEffectOccurrences(resolved, cat, idx);

  applyGrants(resolved, occurrences); // 1-2 : octrois jusqu'au point fixe (construction)
  const cost = computeCosts(resolved, occurrences, idx); // 4 : coûts
  const issues = validate(cat, list, resolved, idx); // 5 : contraintes

  // Affichage : tous les effets d'octroi / de statistique, y compris « en jeu », sur des clones.
  const display = cloneForDisplay(resolved);
  const displayOcc = collectEffectOccurrences(display, cat, idx, true);
  applyGrants(display, displayOcc);
  const statDeltasByInstance = computeStatDeltas(display, displayOcc);
  const skillValuesByInstance = computeSkillValues(display, displayOcc);
  const displayById = new Map(display.map((ri) => [ri.instance.instanceId, ri]));

  const costByInstance: Record<string, number> = {};
  const costByFerDeLance: Record<string, number> = {};
  const grantedTraits: Record<string, string[]> = {};
  const grantedSkills: Record<string, GrantedSkill[]> = {};
  const statDeltas: Record<string, Record<string, number>> = {};
  const skillValues: Record<string, Record<string, number>> = {};
  for (const ri of resolved) {
    const id = ri.instance.instanceId;
    const c = cost.get(id) ?? 0;
    costByInstance[id] = c;
    costByFerDeLance[ri.ferDeLanceId] = (costByFerDeLance[ri.ferDeLanceId] ?? 0) + c;

    const dri = displayById.get(id);
    if (dri) {
      const base = new Set(ri.profile.traits);
      const traits = [...dri.traits].filter((t) => !base.has(t));
      if (traits.length > 0) grantedTraits[id] = traits;
      if (dri.grantedSkills.size > 0) {
        grantedSkills[id] = [...dri.grantedSkills].map(([skillId, value]) => ({ skillId, value }));
      }
    }
    const sd = statDeltasByInstance.get(id);
    if (sd && sd.size > 0) statDeltas[id] = Object.fromEntries(sd);
    const sv = skillValuesByInstance.get(id);
    if (sv && sv.size > 0) skillValues[id] = Object.fromEntries(sv);
  }
  const totalCost = Object.values(costByInstance).reduce((s, c) => s + c, 0);

  return {
    totalCost,
    costByInstance,
    costByFerDeLance,
    grantedTraits,
    grantedSkills,
    statDeltas,
    skillValues,
    issues,
  };
}
