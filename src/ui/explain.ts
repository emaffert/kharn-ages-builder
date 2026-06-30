import type { Catalog, Constraint, Effect, Profile, Selector, SpecialCard } from "@core";

/**
 * Traduction des règles structurées (contraintes & effets) en français lisible,
 * pour permettre la revue humaine dans l'éditeur admin.
 * Le wording officiel (`sourceText`) reste affiché à côté et fait foi.
 */

const profileName = (cat: Catalog, id: string) =>
  cat.profiles.find((p) => p.id === id)?.name ?? id;
const skillName = (cat: Catalog, id: string) =>
  cat.skills.find((s) => s.id === id)?.keyword ?? id;

const equipName = (cat: Catalog, id: string) =>
  cat.equipment.find((e) => e.id === id)?.name ?? id;

export function describeSelector(sel: Selector, cat: Catalog): string {
  if (sel.self) {
    if (sel.equipmentIds?.length) {
      return `son « ${sel.equipmentIds.map((id) => equipName(cat, id)).join(", ")} »`;
    }
    if (sel.equipmentCategories?.length) {
      return `son équipement (${sel.equipmentCategories.join(", ")})`;
    }
    return "lui-même";
  }
  const parts: string[] = [];
  if (sel.profileIds?.length) {
    parts.push(sel.profileIds.map((id) => `« ${profileName(cat, id)} »`).join(", "));
  }
  if (sel.modelIds?.length) parts.push(`modèles ${sel.modelIds.join(", ")}`);
  if (sel.traits?.length) parts.push(`les figurines « ${sel.traits.join(", ")} »`);
  if (sel.factionIds?.length) parts.push(`factions ${sel.factionIds.join(", ")}`);
  if (sel.equipmentCategories?.length) {
    parts.push(`équipement ${sel.equipmentCategories.join(", ")}`);
  }
  if (sel.equipmentIds?.length) {
    parts.push(`équipement ${sel.equipmentIds.map((id) => equipName(cat, id)).join(", ")}`);
  }
  let s = parts.join(" / ") || "—";
  if (sel.countAtLeast) s = `au moins ${sel.countAtLeast} × ${s}`;
  return s;
}

export function describeConstraint(c: Constraint, cat: Catalog): string {
  switch (c.type) {
    case "forbids-equipment": {
      const cats = (c.params as { categories?: string[] }).categories ?? [];
      return `Interdit d'équiper : ${cats.join(", ") || "tout équipement"}.`;
    }
    case "requires-present": {
      const req = (c.params as { requiredProfileId?: string }).requiredProfileId;
      return `Nécessite la présence de « ${req ? profileName(cat, req) : "?"} » dans le Fer de Lance.`;
    }
    case "attachment": {
      const p = c.params as { carrier?: { trait?: string }; capacityRule?: string };
      return `Doit être rattaché à une figurine « ${p.carrier?.trait ?? "?"} ». Capacité : ${p.capacityRule ?? "?"}.`;
    }
    case "equipment-reserved": {
      const p = c.params as { forbidGrimoires?: string[]; trait?: string };
      if (p.forbidGrimoires) return `Ne peut pas acquérir : grimoire(s) ${p.forbidGrimoires.join(", ")}.`;
      if (p.trait) return `Réservé aux figurines « ${p.trait} ».`;
      return c.sourceText;
    }
    case "faction-membership": {
      const f = (c.params as { allowedFactions?: string[] }).allowedFactions ?? [];
      return `Recrutable dans les factions : ${f.join(", ")}.`;
    }
    case "consumes-slot": {
      const p = c.params as { modelId?: string; level?: number };
      return `Occupe un emplacement de « ${p.modelId} » niveau ${p.level}.`;
    }
    case "count-relative":
    case "mount-eligibility":
    case "pact-composition":
    case "mutual-exclusion":
    case "limitation":
    case "custom":
    default:
      return c.sourceText;
  }
}

export function describeEffect(e: Effect, cat: Catalog): string {
  const tgt = describeSelector(e.target, cat);
  const op = e.operation;
  let base: string;
  switch (op.kind) {
    case "cost-delta":
      base = `${op.amount > 0 ? "+" : ""}${op.amount} Ko sur ${tgt}`;
      break;
    case "cost-set":
      base = `Coût fixé à ${op.amount} Ko pour ${tgt}${op.maxCount ? ` (1 par source, max ${op.maxCount})` : ""}`;
      break;
    case "unlock-upgrade":
      base = `Débloque l'amélioration « ${op.upgradeId} » (+${op.perItemCost} Ko/objet) pour ${tgt}`;
      break;
    case "grant-skill":
      base = `Octroie la compétence « ${skillName(cat, op.skillId)} » à ${tgt}`;
      break;
    case "grant-trait":
      base = `Octroie le trait « ${op.trait} » à ${tgt}`;
      break;
    case "cap":
      base = `Plafond ${op.value} pour ${tgt}`;
      break;
    case "stat-modifier": {
      const amount = op.amount === "level" ? "son niveau" : `${op.amount >= 0 ? "+" : ""}${op.amount}`;
      base = `Ajoute ${amount} à ${op.stat.toUpperCase()} de ${tgt}`;
      break;
    }
  }
  if (e.condition) base += ` — si ${describeSelector(e.condition, cat)}`;
  if (e.optIn) base += " (au choix du joueur)";
  if (!e.appliesToListBuilding) base += " (effet en jeu uniquement)";
  return base;
}

/**
 * Où un trait (tag interne) est-il référencé par les règles du catalogue ?
 * Permet, dans l'éditeur, de remonter d'un trait à la/les règle(s) qui l'utilisent.
 */
export function explainTraitUsage(trait: string, cat: Catalog): string[] {
  const out: string[] = [];
  const selUses = (sel?: Selector) => Boolean(sel?.traits?.includes(trait));
  const constraintUses = (c: Constraint) => {
    const p = c.params as { carrier?: { trait?: string }; trait?: string };
    if (c.type === "attachment" && p.carrier?.trait === trait) return true;
    if (c.type === "equipment-reserved" && p.trait === trait) return true;
    return false;
  };

  for (const p of cat.profiles) {
    for (const c of p.recruitment) {
      if (constraintUses(c)) out.push(`« ${p.name} » — ${describeConstraint(c, cat)}`);
    }
    for (const e of p.effects ?? []) {
      if (selUses(e.target) || selUses(e.condition)) out.push(`« ${p.name} » — ${describeEffect(e, cat)}`);
    }
  }
  for (const card of cat.specialCards) {
    if (card.scope.trait === trait) out.push(`carte « ${card.name} » — portée de la carte`);
    for (const c of card.constraints) {
      if (constraintUses(c)) out.push(`carte « ${card.name} » — ${describeConstraint(c, cat)}`);
    }
    for (const e of card.effects) {
      if (selUses(e.target) || selUses(e.condition)) {
        out.push(`carte « ${card.name} » — ${describeEffect(e, cat)}`);
      }
    }
  }
  for (const s of cat.spells) {
    if (s.reservedTo?.trait === trait) out.push(`sort « ${s.name} » — réservé à ce trait`);
  }
  for (const eq of cat.equipment) {
    for (const c of eq.restrictions) {
      if (constraintUses(c)) out.push(`équipement « ${eq.name} » — ${describeConstraint(c, cat)}`);
    }
  }
  return [...new Set(out)];
}

/** Cartes spéciales dont la portée correspond à un profil donné. */
export function specialCardsForProfile(profile: Profile, cat: Catalog): SpecialCard[] {
  return cat.specialCards.filter(
    (card) =>
      card.scope.profileIds?.includes(profile.id) ||
      (card.scope.trait ? profile.traits.includes(card.scope.trait) : false),
  );
}
