/**
 * Dérivations magie/équipement d'une figurine (fonctions pures, sans UI).
 * Servent au calcul de capacité de pages, aux voies lançables, aux sorts disponibles
 * et à la validation des emplacements (mains/armure) — cf. docs/regles-creation-liste.md.
 */
import type { Catalog, Profile, SpecialCard, Spell } from "../model";
import type { ProfileInstance } from "../model";

const HAND_CAP = 2;

/** Équipement effectivement porté : équipement de base non retiré + équipement acheté. */
export function wornEquipmentIds(profile: Profile, inst: ProfileInstance): string[] {
  return [
    ...profile.baseEquipmentIds.filter((id) => !inst.removedBaseEquipmentIds.includes(id)),
    ...inst.addedEquipmentIds,
  ];
}

/** Une carte s'applique-t-elle à la figurine ? (auto selon la portée, ou amélioration sélectionnée). */
function cardApplies(card: SpecialCard, profile: Profile, traits: ReadonlySet<string>, selected: string[]): boolean {
  const scope =
    (card.scope.profileIds?.includes(profile.id) ?? false) ||
    (card.scope.trait ? traits.has(card.scope.trait) : false);
  return card.amelioration ? scope && selected.includes(card.id) : scope;
}

/** Voies de magie lançables : inné + améliorations sélectionnées + objets portés. */
export function castWays(cat: Catalog, profile: Profile, inst: ProfileInstance, traits: ReadonlySet<string>): string[] {
  const ways = new Set<string>(profile.magic?.canCast ? profile.magic.magicWayIds : []);
  const selected = inst.specialCardIds ?? [];
  for (const c of cat.specialCards) {
    if (c.grantsCasting && cardApplies(c, profile, traits, selected)) {
      c.grantsCasting.magicWayIds.forEach((w) => ways.add(w));
    }
  }
  for (const id of wornEquipmentIds(profile, inst)) {
    cat.equipment.find((e) => e.id === id)?.grantsCasting?.magicWayIds.forEach((w) => ways.add(w));
  }
  return [...ways];
}

/** Sources de pages conférées par les cartes/améliorations applicables (Fille de Nyx +3, Crosse +3…). */
export function pageBonusSources(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
  traits: ReadonlySet<string>,
): { name: string; amount: number }[] {
  const selected = inst.specialCardIds ?? [];
  return cat.specialCards
    .filter((c) => cardApplies(c, profile, traits, selected))
    .flatMap((c) =>
      c.effects
        .filter((e) => e.operation.kind === "spell-pages")
        .map((e) => ({ name: c.name, amount: (e.operation as { amount?: number }).amount ?? 0 })),
    )
    .filter((s) => s.amount > 0);
}

export function pageBonus(cat: Catalog, profile: Profile, inst: ProfileInstance, traits: ReadonlySet<string>): number {
  return pageBonusSources(cat, profile, inst, traits).reduce((n, s) => n + s.amount, 0);
}

export function grimoirePages(cat: Catalog, grimoireId?: string): number {
  if (!grimoireId) return 0;
  const pages = cat.grimoires.find((g) => g.id === grimoireId)?.pages;
  return pages === "illimite" ? Infinity : (pages ?? 0);
}

/** Capacité totale de pages : grimoire + bonus des cartes/améliorations. */
export function pageCapacity(cat: Catalog, profile: Profile, inst: ProfileInstance, traits: ReadonlySet<string>): number {
  return grimoirePages(cat, inst.grimoireId) + pageBonus(cat, profile, inst, traits);
}

export function pagesUsed(cat: Catalog, inst: ProfileInstance): number {
  return inst.spellIds.reduce((n, id) => n + (cat.spells.find((s) => s.id === id)?.pages ?? 0), 0);
}

/** Grimoires que la figurine ne peut pas acquérir (param `forbidGrimoires` d'une contrainte de profil). */
export function forbiddenGrimoires(profile: Profile): Set<string> {
  const out = new Set<string>();
  for (const c of profile.recruitment) {
    (c.params as { forbidGrimoires?: string[] })?.forbidGrimoires?.forEach((g) => out.add(g));
  }
  return out;
}

/** Sorts lançables : génériques (tout lanceur) + sorts des voies maîtrisées (réservations respectées). */
export function castableSpells(
  cat: Catalog,
  profile: Profile,
  traits: ReadonlySet<string>,
  ways: string[],
): Spell[] {
  return cat.spells.filter((s) => {
    if (s.kind === "generique") return true;
    if (s.magicWayId && !ways.includes(s.magicWayId)) return false;
    if (s.reservedTo) {
      const okTrait = s.reservedTo.trait ? traits.has(s.reservedTo.trait) : false;
      const okProfile = s.reservedTo.profileIds?.includes(profile.id) ?? false;
      if (!okTrait && !okProfile) return false;
    }
    return true;
  });
}

/** Plafond de mains ; la compétence « Hors-norme » le lève. */
export function handCapacity(profile: Profile): number {
  return profile.skills.some((s) => s.skillId === "hors-norme") ? Infinity : HAND_CAP;
}

/** Mains occupées par l'équipement porté. */
export function handsUsed(cat: Catalog, profile: Profile, inst: ProfileInstance): number {
  return wornEquipmentIds(profile, inst).reduce(
    (n, id) => n + (cat.equipment.find((e) => e.id === id)?.hands ?? 0),
    0,
  );
}

/** Nombre d'armures portées (pour le plafond d'une seule armure). */
export function armorsWorn(cat: Catalog, profile: Profile, inst: ProfileInstance): number {
  return wornEquipmentIds(profile, inst).filter(
    (id) => cat.equipment.find((e) => e.id === id)?.category === "armure",
  ).length;
}
