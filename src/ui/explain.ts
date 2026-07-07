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
    if (sel.equipmentHands?.length) {
      return `ses armes à ${sel.equipmentHands.join("/")} main(s)`;
    }
    return "lui-même";
  }
  const parts: string[] = [];
  if (sel.all) parts.push("toutes les figurines");
  if (sel.profileIds?.length) {
    parts.push(sel.profileIds.map((id) => `« ${profileName(cat, id)} »`).join(", "));
  }
  if (sel.modelIds?.length) parts.push(`modèles ${sel.modelIds.join(", ")}`);
  if (sel.traits?.length) parts.push(`les figurines « ${sel.traits.join(", ")} »`);
  if (sel.factionIds?.length) parts.push(`factions ${sel.factionIds.join(", ")}`);
  if (sel.levels?.length) parts.push(`niveau ${sel.levels.join("/")}`);
  if (sel.isLeader != null) parts.push(sel.isLeader ? "le meneur" : "les non-meneurs");
  if (sel.equipmentCategories?.length) {
    parts.push(`équipement ${sel.equipmentCategories.join(", ")}`);
  }
  if (sel.equipmentIds?.length) {
    parts.push(`équipement ${sel.equipmentIds.map((id) => equipName(cat, id)).join(", ")}`);
  }
  if (sel.equipmentHands?.length) parts.push(`armes à ${sel.equipmentHands.join("/")} main(s)`);
  let s = parts.join(" et ") || "—";
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
      base = `${op.amount > 0 ? "+" : ""}${op.amount} Ko sur ${tgt}${op.requiresBaseSwap ? " (si arme de base changée)" : ""}`;
      break;
    case "cost-set":
      base = `Coût fixé à ${op.amount} Ko pour ${tgt}${op.maxCount ? ` (1 par source, max ${op.maxCount})` : ""}`;
      break;
    case "unlock-upgrade":
      base = `Débloque l'amélioration « ${op.label} » (+${op.cost} Ko/objet, sur ${op.equipmentCategories.join(", ")}) pour ${tgt}`;
      break;
    case "grant-skill":
      base = `Octroie la compétence « ${skillName(cat, op.skillId)}${op.value != null ? ` ${op.value}` : ""} » à ${tgt}`;
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
    case "stat-count":
      base = `${op.stat.toUpperCase()} de ${tgt} = nombre de ${describeSelector(op.of, cat)}${op.atLeastBase ? " (minimum : valeur de base)" : ""}`;
      break;
    case "stat-max":
      base = `${op.stat.toUpperCase()} de ${tgt} = la plus forte valeur de ${op.stat.toUpperCase()} parmi ${describeSelector(op.of, cat)}`;
      break;
    case "skill-count": {
      const per = op.per && op.per > 1 ? ` par groupe de ${op.per}` : "";
      base = `« ${skillName(cat, op.skillId)} » de ${tgt} = nombre de ${describeSelector(op.of, cat)}${per} (arrondi inférieur)`;
      break;
    }
    case "spell-pages":
      base = `${op.amount >= 0 ? "+" : ""}${op.amount} page(s) de sorts pour ${tgt}`;
      break;
    case "limit-modifier":
      base = `${op.amount >= 0 ? "+" : ""}${op.amount} à la limitation (X) de ${tgt}`;
      break;
    case "grant-mastery-die":
      base = `Octroie un dé de maîtrise (${op.domains.join(", ") || "vierge"}) à ${tgt}`;
      break;
  }
  if (e.condition) {
    const clauses = Array.isArray(e.condition) ? e.condition : [e.condition];
    base += ` — si ${clauses.map((c) => describeSelector(c, cat)).join(" et ")}`;
  }
  if (e.designation) base += ` — garde du corps de ${describeSelector(e.designation.of, cat)}`;
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
  const selUses = (sel?: Selector | Selector[]): boolean => {
    if (!sel) return false;
    const clauses = Array.isArray(sel) ? sel : [sel];
    return clauses.some((s) => Boolean(s.traits?.includes(trait)));
  };
  const constraintUses = (c: Constraint) => {
    const p = c.params as { carrier?: { trait?: string }; trait?: string };
    if (c.type === "attachment" && p.carrier?.trait === trait) return true;
    if (c.type === "equipment-reserved" && p.trait === trait) return true;
    return false;
  };
  // Un effet référence le trait via sa cible, sa condition, le `of` de son opération
  // (stat-count / stat-max / skill-count) ou la désignation garde du corps.
  const effectUses = (e: Effect): boolean => {
    if (selUses(e.target) || selUses(e.condition) || selUses(e.designation?.of)) return true;
    const op = e.operation;
    if ((op.kind === "stat-count" || op.kind === "stat-max" || op.kind === "skill-count") && selUses(op.of)) {
      return true;
    }
    return false;
  };

  for (const p of cat.profiles) {
    for (const c of p.recruitment) {
      if (constraintUses(c)) out.push(`« ${p.name} » — ${describeConstraint(c, cat)}`);
    }
    for (const e of p.effects ?? []) {
      if (effectUses(e)) out.push(`« ${p.name} » — ${describeEffect(e, cat)}`);
    }
  }
  for (const card of cat.specialCards) {
    if (card.scope.trait === trait) out.push(`carte « ${card.name} » — portée de la carte`);
    for (const c of card.constraints) {
      if (constraintUses(c)) out.push(`carte « ${card.name} » — ${describeConstraint(c, cat)}`);
    }
    for (const e of card.effects) {
      if (effectUses(e)) {
        out.push(`carte « ${card.name} » — ${describeEffect(e, cat)}`);
      }
    }
  }
  for (const s of cat.spells) {
    if (s.reservedTo?.trait === trait) out.push(`sort « ${s.name} » — réservé à ce trait`);
  }
  return [...new Set(out)];
}

/** Cartes spéciales dont la portée correspond à un profil donné. */
export function specialCardsForProfile(profile: Profile, cat: Catalog): SpecialCard[] {
  return cat.specialCards.filter(
    (card) =>
      card.scope.profileIds?.includes(profile.id) ||
      (card.scope.trait ? profile.traits.includes(card.scope.trait) : false) ||
      (card.scope.factionIds && profile.factionId
        ? card.scope.factionIds.includes(profile.factionId)
        : false),
  );
}
