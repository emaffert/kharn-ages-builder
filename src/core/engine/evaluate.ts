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
  /** Traits octroyés par effet, par instance (en plus des traits de base du profil). */
  grantedTraits: Record<string, string[]>;
  /** Compétences octroyées par effet, par instance. */
  grantedSkills: Record<string, string[]>;
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
  grantedSkills: Set<string>;
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

/** Un instance correspond-il aux champs d'identité d'un sélecteur (OR entre champs) ? */
function instanceMatchesIdentity(sel: Selector, ri: ResolvedInstance): boolean {
  if (sel.profileIds?.includes(ri.profile.id)) return true;
  if (sel.modelIds && ri.profile.modelId && sel.modelIds.includes(ri.profile.modelId)) return true;
  if (sel.traits?.some((t) => ri.traits.has(t))) return true;
  if (sel.factionIds && ri.profile.factionId && sel.factionIds.includes(ri.profile.factionId)) {
    return true;
  }
  return false;
}

function instancesInScope(
  all: ResolvedInstance[],
  scope: EffectScope | "profil",
  ferDeLanceId: string,
): ResolvedInstance[] {
  if (scope === "ost") return all;
  return all.filter((ri) => ri.ferDeLanceId === ferDeLanceId);
}

/** Une condition (sélecteur) est-elle satisfaite dans la portée ? */
function conditionHolds(
  condition: Selector | undefined,
  scope: EffectScope,
  ferDeLanceId: string,
  all: ResolvedInstance[],
): boolean {
  if (!condition) return true;
  const pool = instancesInScope(all, scope, ferDeLanceId);
  const matches = pool.filter((ri) => instanceMatchesIdentity(condition, ri));
  const threshold = condition.countAtLeast ?? 1;
  return matches.length >= threshold;
}

function collectEffectOccurrences(
  resolved: ResolvedInstance[],
  cat: Catalog,
  idx: CatalogIndex,
): EffectOccurrence[] {
  const occurrences: EffectOccurrence[] = [];

  // Effets portés par les profils présents. Un effet « optIn » (choix du joueur) n'est appliqué
  // que si l'instance a explicitement opté — désignée garde du corps (ex. Djouked → −35 pour Broutcha).
  // Les effets `appliesToListBuilding: false` sont « en jeu seulement » : jamais calculés ici.
  for (const ri of resolved) {
    for (const effect of ri.profile.effects ?? []) {
      if (!effect.appliesToListBuilding) continue;
      if (effect.optIn && ri.instance.bodyguardOfInstanceId == null) continue;
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
          if (!effect.appliesToListBuilding || effect.optIn) continue;
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
        if (!effect.appliesToListBuilding) continue;
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
            ri.grantedSkills.add(effect.operation.skillId);
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
  for (const id of inst.specialCardIds ?? []) cost += idx.specialCard.get(id)?.cost ?? 0;
  return cost;
}

function computeCosts(
  resolved: ResolvedInstance[],
  occurrences: EffectOccurrence[],
  idx: CatalogIndex,
): Map<string, number> {
  const cost = new Map<string, number>();
  for (const ri of resolved) cost.set(ri.instance.instanceId, baseInstanceCost(ri, idx));

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

    const designated = resolveTargets(occ, resolved).filter((ri) => ri.instance.bodyguardOfInstanceId != null);
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
        grantedSkills: new Set(),
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
    validateFactionMembership(fdl, inFdl, issues);
    validateLeader(fdl, inFdl, issues);
  }

  validateForbiddenEquipment(cat, resolved, idx, issues);
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
  const countByProfile = new Map<string, number>();
  for (const ri of inFdl) {
    countByProfile.set(ri.profile.id, (countByProfile.get(ri.profile.id) ?? 0) + 1);
  }
  const seenProfiles = new Set(inFdl.map((ri) => ri.profile.id));
  for (const profileId of seenProfiles) {
    const ri = inFdl.find((r) => r.profile.id === profileId)!;
    const lim = ri.profile.limitation;
    const count = countByProfile.get(profileId) ?? 0;
    const max =
      lim.kind === "X" ? (lim.value ?? Infinity) : lim.kind === "U" || lim.kind === "P" ? 1 : Infinity;
    if (count > max) {
      issues.push({
        severity: "error",
        ferDeLanceId: fdl.id,
        ruleId: `limitation:${profileId}`,
        message: `« ${ri.profile.name} » : ${count} recruté(s) pour une limitation de ${max}.`,
        sourceText: `Limitation ${lim.kind}${lim.value ? " " + lim.value : ""}.`,
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

// ── Point d'entrée ───────────────────────────────────────────────────────────

export function evaluateList(cat: Catalog, list: ListDocument): EvaluationResult {
  const idx = indexCatalog(cat);
  const resolved = buildResolved(list, idx);
  const occurrences = collectEffectOccurrences(resolved, cat, idx);

  applyGrants(resolved, occurrences); // 1-2 : octrois jusqu'au point fixe
  const cost = computeCosts(resolved, occurrences, idx); // 4 : coûts
  const issues = validate(cat, list, resolved, idx); // 5 : contraintes

  const costByInstance: Record<string, number> = {};
  const costByFerDeLance: Record<string, number> = {};
  for (const ri of resolved) {
    const c = cost.get(ri.instance.instanceId) ?? 0;
    costByInstance[ri.instance.instanceId] = c;
    costByFerDeLance[ri.ferDeLanceId] = (costByFerDeLance[ri.ferDeLanceId] ?? 0) + c;
  }
  const totalCost = Object.values(costByInstance).reduce((s, c) => s + c, 0);

  const grantedTraits: Record<string, string[]> = {};
  const grantedSkills: Record<string, string[]> = {};
  for (const ri of resolved) {
    const base = new Set(ri.profile.traits);
    const granted = [...ri.traits].filter((t) => !base.has(t));
    if (granted.length > 0) grantedTraits[ri.instance.instanceId] = granted;
    if (ri.grantedSkills.size > 0) grantedSkills[ri.instance.instanceId] = [...ri.grantedSkills];
  }

  return { totalCost, costByInstance, costByFerDeLance, grantedTraits, grantedSkills, issues };
}
