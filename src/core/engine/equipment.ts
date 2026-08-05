/**
 * Prédicats d'équipement transverses au moteur : ce dont plusieurs règles ont besoin, sans que le
 * concept appartienne à l'une d'elles.
 */
import type { Equipment } from "../model";

/**
 * Arme **gratuite** au sens des règles : celles que le livret donne pour rien (Gourdin, Couteau,
 * Arc court…), reconnaissables à leur prix nul au catalogue. Une arme rendue gratuite par une remise
 * n'en est pas une : c'est l'arme qui est gratuite dans les règles, pas l'aubaine du moment.
 *
 * Trois règles s'y adossent : la Flèche hydre interdite sur un arc gratuit (p.13, cf.
 * `munitionTypeAllowedOn`), l'esclave qui ne peut porter qu'une arme de corps à corps gratuite
 * (p.10, cf. `slaveMayBuy`), et les restrictions de la Geste de Safar (une seule arme gratuite par
 * Safar, la même sur au plus la moitié du Fer de Lance) - ces dernières restent à écrire.
 */
export function isFreeWeapon(e: Equipment | undefined): boolean {
  return e != null && e.cost === 0;
}
