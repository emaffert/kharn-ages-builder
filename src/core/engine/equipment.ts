/**
 * Prédicats d'équipement transverses au moteur : ce dont plusieurs règles ont besoin, sans que le
 * concept appartienne à l'une d'elles.
 */
import { baseEquipmentCount, type Catalog, type Equipment, type Profile, type ProfileInstance } from "../model";

/** Une arme, au sens des règles : de corps à corps ou de tir. Ni bouclier, ni armure, ni objet. */
export function isWeapon(e: Equipment | undefined): boolean {
  return e != null && (e.category === "arme-cac" || e.category === "arme-tir");
}

/**
 * Arme **gratuite** au sens des règles : celles que le livret donne pour rien (Gourdin, Couteau,
 * Arc court…), reconnaissables à leur prix nul au catalogue. Une arme rendue gratuite par une remise
 * n'en est pas une : c'est l'arme qui est gratuite dans les règles, pas l'aubaine du moment. Un objet
 * gratuit non plus (le Bol de Millet) : la règle parle d'armes.
 *
 * Trois règles s'y adossent : une seule arme gratuite par Safar et pas plus de la moitié du Fer de
 * Lance sous la même (FAQ 2026, cf. `validateFreeWeapons`), la Flèche hydre interdite sur un arc
 * gratuit (p.13, cf. `munitionTypeAllowedOn`), et l'esclave qui ne peut porter qu'une arme de corps
 * à corps gratuite (p.10, cf. `slaveMayBuy`).
 */
export function isFreeWeapon(e: Equipment | undefined): boolean {
  return e != null && isWeapon(e) && e.cost === 0;
}

/**
 * Armes gratuites que porte une figurine, rangées selon leur provenance - la FAQ ne les compte pas de
 * la même façon : « une arme gratuite figurant sur la carte de profil d'un Safar n'entre pas dans ce
 * maximum autorisé », celui de la moitié du Fer de Lance. Pour le plafond d'une par Safar, en
 * revanche, les deux comptent : c'est ce avec quoi il part au combat.
 *
 * Une arme de base rendue ne compte plus (elle n'est plus sur la figurine) ; un exemplaire acheté
 * compte à chaque fois qu'il est acheté.
 */
export function freeWeaponsCarried(
  cat: Catalog,
  profile: Profile,
  inst: ProfileInstance,
): { printed: string[]; bought: string[] } {
  const eq = (id: string) => cat.equipment.find((e) => e.id === id);
  const printed = profile.baseEquipmentIds
    .filter((id) => !inst.removedBaseEquipmentIds.includes(id) && isFreeWeapon(eq(id)))
    .flatMap((id) => Array<string>(baseEquipmentCount(profile, id)).fill(id));
  const bought = inst.addedEquipmentIds.filter((id) => isFreeWeapon(eq(id)));
  return { printed, bought };
}
