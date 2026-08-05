import { cardMatchesBanner } from "@core";
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
  if (sel.cavalier) return "le cavalier";
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
  let s = parts.join(" et ") || "-";
  if (sel.countAtLeast) s = `au moins ${sel.countAtLeast} × ${s}`;
  return s;
}

export function describeConstraint(c: Constraint, cat: Catalog): string {
  switch (c.type) {
    case "forbids-equipment": {
      const p = c.params as { categories?: string[]; hands?: number[]; exceptEquipmentIds?: string[] };
      const cats = p.categories ?? [];
      const hands = p.hands?.length ? ` à ${p.hands.join("/")} main(s)` : "";
      const except = p.exceptEquipmentIds?.length
        ? `, sauf ${p.exceptEquipmentIds.map((id) => equipName(cat, id)).join(" et ")}`
        : "";
      return `Interdit d'équiper : ${cats.join(", ") || "tout équipement"}${hands}${except}.`;
    }
    case "requires-present": {
      const req = (c.params as { requiredProfileId?: string }).requiredProfileId;
      const where = c.scope === "ost" ? "l'Ost" : "le Fer de Lance";
      return `Nécessite la présence de « ${req ? profileName(cat, req) : "?"} » dans ${where}.`;
    }
    case "attachment": {
      const car = (c.params as { carrier?: CarrierParams }).carrier;
      return `Doit être rattaché à ${carrierText(car, cat)}. La somme des niveaux des rattachés ne peut pas dépasser le niveau du porteur.`;
    }
    case "forbids-grimoire": {
      const g = (c.params as { forbidGrimoires?: string[] }).forbidGrimoires ?? [];
      return `Ne peut pas acquérir : grimoire(s) ${g.join(", ") || "?"}.`;
    }
    case "faction-membership": {
      const f = (c.params as { allowedFactions?: string[] }).allowedFactions ?? [];
      return `Recrutable dans les factions : ${f.join(", ")}.`;
    }
    case "slave": {
      const p = c.params as { exceptFactions?: string[]; perCarrierMax?: number };
      const factionName = (id: string) => cat.factions.find((f) => f.id === id)?.name ?? id;
      const sauf = (p.exceptFactions ?? []).map(factionName);
      const parts = [sauf.length > 0 ? `Esclave sauf pour : ${sauf.join(", ")}.` : "Esclave."];
      if (typeof p.perCarrierMax === "number") {
        parts.push(`Maximum ${p.perCarrierMax} par Seigneur de guerre.`);
      }
      return parts.join(" ");
    }
    default:
      return c.sourceText;
  }
}

/** Porteur d'une contrainte de rattachement : trait, profils ou modèles, plus un libellé lisible. */
type CarrierParams = { trait?: string; label?: string; profileIds?: string[]; modelIds?: string[] };

/** Formulation lisible du porteur (« une femelle Fang », sinon les noms, sinon le tag brut). */
function carrierText(car: CarrierParams | undefined, cat: Catalog): string {
  if (!car) return "un porteur";
  if (car.label) return car.label;
  const names = [
    ...(car.profileIds ?? []).map((id) => profileName(cat, id)),
    ...(car.modelIds ?? []).map((id) => cat.models.find((m) => m.id === id)?.name ?? id),
  ];
  if (names.length) return names.map((n) => `« ${n} »`).join(" ou ");
  return car.trait ? `une figurine « ${car.trait} »` : "un porteur";
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
    case "grimoire-discount":
      base = `−${op.amount} Ko sur le${op.tier ? ` ${op.tier}` : ""} grimoire de ${tgt}`;
      break;
    case "unlock-upgrade": {
      const skills = (op.grantsSkills ?? [])
        .map((gs) => `${skillName(cat, gs.skillId)}${gs.value != null ? ` ${gs.value}` : ""}`)
        .join(", ");
      base = `Débloque l'amélioration « ${op.label} » (+${op.cost} Ko/objet, sur ${op.equipmentCategories.join(", ")}) pour ${tgt}${skills ? ` ; confère « ${skills} » tant qu'équipée` : ""}`;
      break;
    }
    case "grant-skill": {
      const val = op.value != null ? ` ${op.value}` : "";
      const prec = op.precision ? ` (${op.precision})` : "";
      base = `Octroie la compétence « ${skillName(cat, op.skillId)}${val}${prec} » à ${tgt}`;
      break;
    }
    case "grant-spell": {
      const sp = cat.spells.find((s) => s.id === op.spellId)?.name ?? op.spellId;
      base = `Connaît d'office le sort « ${sp} » (${tgt})`;
      break;
    }
    case "grant-spell-choice": {
      const n = op.count ?? 1;
      const way = op.magicWayId ? cat.magicWays.find((w) => w.id === op.magicWayId)?.name ?? op.magicWayId : null;
      const named = (op.spellIds ?? []).map((id) => cat.spells.find((s) => s.id === id)?.name ?? id);
      const pool = [way ? `de la voie « ${way} »` : null, named.length ? `parmi ${named.join(", ")}` : null]
        .filter(Boolean)
        .join(" ou ");
      base = `Connaît ${n} sort${n > 1 ? "s" : ""} au choix ${pool || "(sélection non renseignée)"}, sans grimoire ni budget de pages (${tgt})`;
      break;
    }
    case "grant-trait":
      base = `Octroie le trait « ${op.trait} » à ${tgt}`;
      break;
    case "stat-modifier": {
      const amount = op.amount === "level" ? "son niveau" : `${op.amount >= 0 ? "+" : ""}${op.amount}`;
      base = `Ajoute ${amount} à ${op.stat.toUpperCase()} de ${tgt}`;
      break;
    }
    case "stat-count":
      base = `${op.stat.toUpperCase()} de ${tgt} = nombre de ${describeSelector(op.of, cat)} (minimum : valeur de base du profil, si elle existe)`;
      break;
    case "stat-per-count":
      base = `${op.amount >= 0 ? "+" : ""}${op.amount} en ${op.stat.toUpperCase()} pour ${tgt} par ${describeSelector(op.of, cat)}`;
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
    case "grant-equipment": {
      const noms = op.equipmentIds.map((id) => equipName(cat, id)).join(", ") || "-";
      base = `Octroie ${noms} à ${tgt} (porté sans être acheté, non retirable)`;
      break;
    }
  }
  if (e.condition) {
    const clauses = Array.isArray(e.condition) ? e.condition : [e.condition];
    base += ` - si ${clauses.map((c) => describeSelector(c, cat)).join(" et ")}`;
  }
  if (e.designation)
    base += ` - ${e.designation.label ?? "garde du corps"} de ${describeSelector(e.designation.of, cat)}`;
  return base;
}

/**
 * Où un trait (tag interne) est-il référencé par les règles du catalogue ?
 * Permet, dans l'éditeur, de remonter d'un trait à la/les règle(s) qui l'utilisent.
 */
/**
 * Traits lus directement par le moteur (règles intégrées, non exprimées comme
 * contrainte/effet dans le catalogue). À garder en phase avec le code moteur.
 */
const BUILTIN_TRAIT_USAGE: Record<string, string> = {
  tembo: "moteur - surcoût d’équipement Tembo appliqué aux objets ajoutés (règle intégrée)",
};

export function explainTraitUsage(trait: string, cat: Catalog): string[] {
  const out: string[] = [];
  if (BUILTIN_TRAIT_USAGE[trait]) out.push(BUILTIN_TRAIT_USAGE[trait]);
  const selUses = (sel?: Selector | Selector[]): boolean => {
    if (!sel) return false;
    const clauses = Array.isArray(sel) ? sel : [sel];
    return clauses.some((s) => Boolean(s.traits?.includes(trait)));
  };
  const constraintUses = (c: Constraint) => {
    const p = c.params as { carrier?: { trait?: string } };
    return c.type === "attachment" && p.carrier?.trait === trait;
  };
  // Un effet référence le trait via sa cible, sa condition, le `of` de son opération
  // (stat-count / stat-per-count / stat-max / skill-count) ou la désignation garde du corps.
  const effectUses = (e: Effect): boolean => {
    if (selUses(e.target) || selUses(e.condition) || selUses(e.designation?.of)) return true;
    const op = e.operation;
    if (
      (op.kind === "stat-count" ||
        op.kind === "stat-per-count" ||
        op.kind === "stat-max" ||
        op.kind === "skill-count") &&
      selUses(op.of)
    ) {
      return true;
    }
    return false;
  };

  for (const p of cat.profiles) {
    for (const c of p.recruitment) {
      if (constraintUses(c)) out.push(`« ${p.name} » - ${describeConstraint(c, cat)}`);
    }
    for (const e of p.effects ?? []) {
      if (effectUses(e)) out.push(`« ${p.name} » - ${describeEffect(e, cat)}`);
    }
  }
  for (const card of cat.specialCards) {
    if (card.scope.trait === trait) out.push(`carte « ${card.name} » - portée de la carte`);
    for (const c of card.constraints) {
      if (constraintUses(c)) out.push(`carte « ${card.name} » - ${describeConstraint(c, cat)}`);
    }
    for (const e of card.effects) {
      if (effectUses(e)) {
        out.push(`carte « ${card.name} » - ${describeEffect(e, cat)}`);
      }
    }
  }
  for (const s of cat.spells) {
    if (s.reservedTo?.trait === trait) out.push(`sort « ${s.name} » - réservé à ce trait`);
  }
  return [...new Set(out)];
}

/**
 * Cartes spéciales dont la portée correspond à un profil donné.
 *
 * `fdlFactionId` = la faction du Fer de Lance qui l'accueille, quand on la connaît (le constructeur
 * la connaît, l'éditeur de catalogue non) : elle seule révèle les cartes portées par la bannière,
 * qui s'appliquent à une figurine à cause de qui la recrute et non de ce qu'elle est.
 */
export function specialCardsForProfile(
  profile: Profile,
  cat: Catalog,
  fdlFactionId?: string,
): SpecialCard[] {
  return cat.specialCards.filter(
    (card) =>
      card.scope.profileIds?.includes(profile.id) ||
      (card.scope.trait ? profile.traits.includes(card.scope.trait) : false) ||
      (card.scope.factionIds && profile.factionId
        ? card.scope.factionIds.includes(profile.factionId)
        : false) ||
      (fdlFactionId != null && cardMatchesBanner(card, profile, fdlFactionId)),
  );
}
