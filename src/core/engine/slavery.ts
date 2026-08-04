/**
 * Les esclaves (LDR Saison 2, p. 10). Ce n'est pas une compétence mais une **condition** inscrite
 * sur la carte, d'où une contrainte `slave` dédiée plutôt qu'un tag ou un rattachement détourné.
 *
 * La règle tient en quatre points, tous portés ici et validés par `validateSlaves` :
 *
 * 1. l'esclave appartient à un **Seigneur de guerre** du même Fer de Lance (compétence « SDG X »),
 *    qui ne peut en posséder plus que sa valeur de X ;
 * 2. les esclaves d'un Fer de Lance ne peuvent pas **dépasser en nombre** ses autres combattants ;
 * 3. ils ne s'équipent que d'**armes de corps à corps gratuites**, ou combattent à mains nues ;
 * 4. la carte peut restreindre encore : `exceptFactions` (la Porteuse d'eau n'est pas une esclave
 *    chez les Goûns ni chez les Tembos, où elle se recrute normalement) et `perCarrierMax`
 *    (« limitée à 1 par allié possédant SDG »).
 *
 * Hors des factions où elle s'applique, la figurine est une recrue ordinaire : rien de ce qui
 * précède ne la concerne, ni le porteur, ni le plafond, ni la restriction d'équipement.
 */
import type { Catalog, Constraint, Equipment, Profile } from "../model";
import { engineIdOf } from "../model/engineIds";

/** Compétence du porteur : « SDG X ». Sa valeur plafonne le nombre d'esclaves possédés. */
export const SDG_SKILL_ID = engineIdOf("seigneur-de-guerre");

/** Paramètres de la contrainte `slave`, tels que saisis dans l'admin. */
export type SlaveParams = {
  /** Factions où la figurine n'est PAS une esclave (ex. la Porteuse d'eau chez les Goûns/Tembos). */
  exceptFactions?: string[];
  /** Plafond par porteur inscrit sur la carte, plus serré que la valeur de SDG (ex. 1). */
  perCarrierMax?: number;
};

/** La contrainte `slave` du profil, s'il en porte une. */
export function slaveConstraint(p: Profile): Constraint | undefined {
  return p.recruitment.find((c) => c.type === "slave");
}

function slaveParams(c: Constraint): SlaveParams {
  return (c.params ?? {}) as SlaveParams;
}

/**
 * La figurine est-elle une esclave **dans ce Fer de Lance** ? Toute la mécanique en dépend : c'est
 * la faction d'accueil qui décide, pas le profil seul.
 */
export function isSlaveIn(p: Profile, factionId: string): boolean {
  const c = slaveConstraint(p);
  if (!c) return false;
  return !(slaveParams(c).exceptFactions ?? []).includes(factionId);
}

/** Plafond par porteur inscrit sur la carte de cette esclave (Infinity si la carte n'en fixe pas). */
export function slavePerCarrierMax(p: Profile): number {
  const c = slaveConstraint(p);
  const max = c ? slaveParams(c).perCarrierMax : undefined;
  return typeof max === "number" && max > 0 ? max : Infinity;
}

/**
 * Valeur de « SDG » de la figurine, native ou octroyée par effet ; 0 si elle n'a pas la compétence.
 * Une compétence sans valeur vaut 1 : elle désigne bien un Seigneur de guerre, qui possède au moins
 * un esclave (cas du Vieillard Shaman, dont la carte ne chiffre pas le X).
 */
export function sdgValue(p: Profile, grantedSkills: readonly { skillId: string; value?: string | number }[] = []): number {
  const refs = [...p.skills, ...grantedSkills].filter((s) => s.skillId === SDG_SKILL_ID);
  if (refs.length === 0) return 0;
  const values = refs.map((s) => (typeof s.value === "number" ? s.value : Number(s.value)));
  const best = Math.max(...values.map((v) => (Number.isFinite(v) && v > 0 ? v : 1)));
  return best;
}

/** La figurine peut-elle posséder des esclaves ? (elle porte « SDG ») */
export function carriesSlaves(
  p: Profile,
  grantedSkills: readonly { skillId: string; value?: string | number }[] = [],
): boolean {
  return sdgValue(p, grantedSkills) > 0;
}

/**
 * Un esclave ne peut acheter qu'une arme de corps à corps **gratuite** : « aucun peuple ne se risque
 * à les équiper plus richement ». L'équipement imprimé sur sa carte, lui, reste le sien.
 */
export function slaveMayBuy(e: Equipment): boolean {
  return e.category === "arme-cac" && e.cost === 0;
}

/** Profils esclaves recrutables dans ce Fer de Lance (tous modèles confondus, niveaux croissants). */
export function slaveProfilesFor(cat: Catalog, factionId: string): Profile[] {
  return cat.profiles
    .filter((p) => isSlaveIn(p, factionId))
    .sort((a, b) => a.name.localeCompare(b.name) || (a.level ?? 0) - (b.level ?? 0));
}
