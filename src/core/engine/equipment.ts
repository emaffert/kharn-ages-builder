/**
 * Prédicats d'équipement transverses au moteur : ce dont plusieurs règles ont besoin, sans que le
 * concept appartienne à l'une d'elles.
 */
import {
  baseEquipmentCount,
  type Catalog,
  type Constraint,
  type Equipment,
  type Profile,
  type ProfileInstance,
} from "../model";

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
 * Paramètres de `forbids-equipment`. Les trois filtres se lisent **ensemble** : un objet est interdit
 * s'il passe *tous* ceux qui sont renseignés, et qu'il ne figure pas dans les exceptions.
 *
 * - `categories` : catégories visées (vide = toutes) ;
 * - `hands` : nombre de mains visé (vide = tous), pour « ne peut manier d'arme à 2 mains ». Une arme
 *   bâtarde (`hands: "1-2"`) n'est jamais visée : elle se manie aussi à une main ;
 * - `exceptEquipmentIds` : liste blanche qui échappe à l'interdiction, pour les cartes qui n'ouvrent
 *   qu'un choix fermé (« ne peut choisir que la Sarclette ou le Couteau »).
 */
export type ForbidEquipmentParams = {
  categories?: string[];
  hands?: number[];
  exceptEquipmentIds?: string[];
};

export function forbidEquipmentParams(c: Constraint): ForbidEquipmentParams {
  const p = c.params as Record<string, unknown>;
  const list = (k: string): unknown[] => (Array.isArray(p[k]) ? (p[k] as unknown[]) : []);
  return {
    categories: list("categories") as string[],
    hands: (list("hands") as unknown[]).map(Number).filter((n) => Number.isFinite(n)),
    exceptEquipmentIds: list("exceptEquipmentIds") as string[],
  };
}

/**
 * Interdictions d'équipement qui visent ce profil : les siennes, et celles que des cartes spéciales
 * lui adressent nommément (`params.profileId`).
 */
export function forbidEquipmentRulesFor(cat: Catalog, p: Profile): ForbidEquipmentParams[] {
  const rules: ForbidEquipmentParams[] = [];
  for (const c of p.recruitment) {
    if (c.type === "forbids-equipment") rules.push(forbidEquipmentParams(c));
  }
  for (const card of cat.specialCards) {
    for (const c of card.constraints) {
      if (c.type !== "forbids-equipment") continue;
      if ((c.params as { profileId?: string }).profileId !== p.id) continue;
      rules.push(forbidEquipmentParams(c));
    }
  }
  return rules;
}

/**
 * Cet objet tombe-t-il sous le coup de cette interdiction ? **Le guichet unique** : le moteur s'en
 * sert pour refuser une liste, le panneau d'équipement pour ne pas proposer l'objet. Les deux
 * lectures doivent coïncider, sans quoi le constructeur propose ce que la validation refuse - ou,
 * comme c'était le cas, retire à Key toutes les armes de corps à corps alors que sa carte ne lui
 * interdit que celles à deux mains.
 */
export function forbidRuleHits(rule: ForbidEquipmentParams, e: Equipment): boolean {
  // Contrainte sans aucun filtre = brouillon d'admin (créée avec des params vierges) : elle
  // n'interdit rien, plutôt que de tout interdire d'un coup sur une fiche en cours de saisie.
  if (!rule.categories?.length && !rule.hands?.length) return false;
  if (rule.exceptEquipmentIds?.includes(e.id)) return false;
  if (rule.categories?.length && !rule.categories.includes(e.category)) return false;
  if (rule.hands?.length) {
    // `hands` non numérique (arme bâtarde « 1-2 ») : jamais visée.
    if (typeof e.hands !== "number" || !rule.hands.includes(e.hands)) return false;
  }
  return true;
}

/** Cet objet est-il interdit à cette figurine (toutes interdictions confondues) ? */
export function equipmentForbiddenFor(cat: Catalog, p: Profile, e: Equipment): boolean {
  return forbidEquipmentRulesFor(cat, p).some((rule) => forbidRuleHits(rule, e));
}

/**
 * Catégories interdites **en entier** à cette figurine : celles dont aucune arme ne lui est
 * accessible, quel que soit le nombre de mains. Sert aux emplacements et aux compteurs (armure,
 * casque), là où la question porte sur la famille et non sur un objet donné. Une interdiction
 * limitée aux armes à deux mains n'en fait pas partie : elle laisse passer les armes à une main.
 */
export function fullyForbiddenCategories(cat: Catalog, p: Profile): Set<string> {
  const out = new Set<string>();
  for (const rule of forbidEquipmentRulesFor(cat, p)) {
    // Interdiction partielle (nombre de mains, liste blanche) : la catégorie reste ouverte.
    if (rule.hands?.length || rule.exceptEquipmentIds?.length) continue;
    for (const c of rule.categories ?? []) out.add(c);
  }
  return out;
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
