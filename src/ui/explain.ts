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

export function describeSelector(sel: Selector, cat: Catalog): string {
  if (sel.self) {
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
  }
  if (e.condition) base += ` — si ${describeSelector(e.condition, cat)}`;
  if (!e.appliesToListBuilding) base += " (effet en jeu uniquement)";
  return base;
}

/** Cartes spéciales dont la portée correspond à un profil donné. */
export function specialCardsForProfile(profile: Profile, cat: Catalog): SpecialCard[] {
  return cat.specialCards.filter(
    (card) =>
      card.scope.profileIds?.includes(profile.id) ||
      (card.scope.trait ? profile.traits.includes(card.scope.trait) : false),
  );
}
