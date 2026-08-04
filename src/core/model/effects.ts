import { z } from "zod";
import { EffectScopeSchema, EquipmentCategorySchema, MasteryDomainSchema, SelectorSchema, SkillRefSchema } from "./common";

/**
 * Effet = modificateur dynamique (coût, déblocage d'option, octroi de compétence/trait),
 * souvent appliqué à d'autres figurines, conditionnellement à l'état de la liste.
 * Voir docs/schema-donnees.md - couche 2.
 */
/** Caractéristiques modifiables par un effet (mêmes clés que la fiche : V P A C T I + PA PV Stature). */
export const StatKeySchema = z.enum(["v", "p", "a", "c", "t", "i", "stature", "pa", "pv"]);

export const EffectOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cost-delta"),
    amount: z.number(),
    /**
     * `true` : le modificateur ne s'applique qu'aux figurines ayant *changé leur arme de base*
     * (au moins un équipement de base retiré correspondant au filtre `target`). Ex. Commandant khérops :
     * −5 Ko aux Guerriers qui remplacent leur arme de base.
     */
    requiresBaseSwap: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("cost-set"), amount: z.number(), maxCount: z.number().optional() }),
  /**
   * Réduit le prix d'un grimoire de la CIBLE (ex. Mochère : grimoire du cavalier moins cher). `tier`
   * limite à « petit » ou « grand » (absent = tous) ; `amount` = Ko retranchés (prix plancher 0).
   */
  z.object({ kind: z.literal("grimoire-discount"), tier: z.enum(["petit", "grand"]).optional(), amount: z.number() }),
  // Octroie aux cibles la possibilité d'améliorer CHAQUE équipement des catégories visées (opt-in par
  // objet) pour `cost` Ko/objet. Ex. Key empoisonne son arme (10 Ko) ; « Borax » améliore armes+armures.
  z.object({
    kind: z.literal("unlock-upgrade"),
    upgradeId: z.string(),
    label: z.string(),
    cost: z.number(),
    equipmentCategories: z.array(EquipmentCategorySchema),
    /**
     * Compétences (avec valeur éventuelle) conférées à la figurine tant qu'elle porte un équipement
     * amélioré ainsi. Ex. Borax armes : « Spécialiste » valeur "attaque" + valeur "défense".
     */
    grantsSkills: z.array(SkillRefSchema).optional(),
  }),
  // `value` : pour une compétence « à valeur » (ex. octroie « Héroïque défense » → value "défense").
  // `precision` : précision libre affichée à côté de la compétence (ex. « Spécialiste : hache »).
  // `incrementIfPresent` : si la cible possède DÉJÀ la compétence (nativement), n'octroie pas `value`
  //   mais AUGMENTE sa valeur native de ce nombre (ex. Symbiose « Moringa 3 ou +2 si déjà connue » → 2 ;
  //   Khépesh « Brutalité 1 ou +1 si déjà connue » → 1). Sans effet sur une compétence non « à valeur ».
  z.object({
    kind: z.literal("grant-skill"),
    skillId: z.string(),
    value: z.union([z.string(), z.number()]).optional(),
    precision: z.string().optional(),
    incrementIfPresent: z.number().optional(),
  }),
  // Octroie la connaissance d'un sort « de signature » (connu d'office, gratuit, hors budget de pages).
  // Ex. Alaric connaît « Lien Mental ». Affiché sur la fiche même pour un non-lanceur.
  z.object({ kind: z.literal("grant-spell"), spellId: z.string() }),
  /**
   * Octroie `count` sort(s) **au choix du joueur** dans une sélection : tous les sorts d'une voie
   * (`magicWayId`) et/ou une liste explicite (`spellIds`) - au moins l'un des deux, sinon la sélection
   * est vide (brouillon d'admin, qui ne doit pas fuiter dans le constructeur).
   *
   * Sort offert = **hors budget** de pages ET de niveaux, sans grimoire, cumulable avec le grimoire et
   * les autres bonus. Le prix en Ko du sort reste dû, et la réservation du sort (`reservedTo`)
   * s'applique toujours : une Fille de Nyx atteint ainsi les sorts qui lui sont réservés, pas une autre.
   * Ex. Demi-soeur : « Possède 1 sort d'Ostéomancie sans grimoire » ; Vouge de Moringa : 3 sorts d'Adansonia.
   */
  z.object({
    kind: z.literal("grant-spell-choice"),
    magicWayId: z.string().optional(),
    spellIds: z.array(z.string()).optional(),
    count: z.number().optional(),
  }),
  // Octroie un trait (tag mécanique) aux cibles, jusqu'au point fixe, AVANT la validation - donc lu
  // par les règles et les sélecteurs qui inspectent les traits. À réserver aux tags sans compétence
  // correspondante : quand la carte affiche une compétence (« Apatride »), c'est `grant-skill` qui
  // l'octroie, pour que profil et effet parlent la même langue.
  z.object({ kind: z.literal("grant-trait"), trait: z.string() }),
  z.object({
    kind: z.literal("stat-modifier"),
    stat: StatKeySchema,
    // nombre fixe, ou "level" = le niveau de la figurine elle-même.
    amount: z.union([z.number(), z.literal("level")]),
  }),
  // Fixe une caractéristique au NOMBRE de figurines correspondant à `of` dans la portée
  // (ex. Instinct grégaire : T des Dogons = nombre de Dogons). Plancher = valeur de base imprimée
  // (pattern officiel : un profil sans valeur de base sur cette carac. n'a pas de plancher).
  z.object({ kind: z.literal("stat-count"), stat: StatKeySchema, of: SelectorSchema }),
  // Ajoute `amount` à une caractéristique PAR figurine correspondant à `of` dans la portée
  // (ex. Mongo sombre : +1 en T par Mongo en jeu). À distinguer de `stat-count`, qui *fixe* la
  // caractéristique au décompte : ici le décompte s'ajoute à la valeur de base imprimée.
  z.object({ kind: z.literal("stat-per-count"), stat: StatKeySchema, of: SelectorSchema, amount: z.number() }),
  // Fixe une caractéristique à la valeur MAXIMALE de cette carac. parmi les figurines correspondant
  // à `of` dans la portée (ex. « Doctrine » de l'Ordre : T et I = les plus fortes des membres de
  // l'Ordre présents dans le Fer de Lance). Lit les valeurs de BASE (imprimées) ; plancher = base.
  z.object({ kind: z.literal("stat-max"), stat: StatKeySchema, of: SelectorSchema }),
  // Valeur d'une compétence (à valeur, ex. Seigneur de guerre X) dérivée d'un décompte :
  // X = ⌊ nombre de figurines « of » dans la portée / per ⌋ (per défaut 1, arrondi inférieur).
  z.object({
    kind: z.literal("skill-count"),
    skillId: z.string(),
    of: SelectorSchema,
    per: z.number().optional(),
  }),
  // Budget de pages de sorts (ex. Fille de Nyx : +3 ; Crosse d'Ostéomancie : +3).
  // `magicWayId` (option.) : les pages sont un POOL dédié à cette voie (ex. Brassards d'Euthéria :
  // 5 pages Adansonia + 5 pages shamanisme, chacun un pool séparé). Absent = pages du budget GLOBAL,
  // utilisables par n'importe quelle voie accessible. Enforcement dans le moteur (`pageAllocation`).
  z.object({ kind: z.literal("spell-pages"), amount: z.number(), magicWayId: z.string().optional() }),
  /**
   * Augmente (ou réduit) la limitation numérique (kind « X ») des groupes de profils ciblés, dans la
   * portée. Ex. Lieutenant khérops : +1 à la limite des Khérops non uniques / non personnages de son FdL.
   * Ne touche que les limitations « X » (U/P inchangées).
   */
  z.object({ kind: z.literal("limit-modifier"), amount: z.number() }),
  /**
   * Octroie un **dé de maîtrise** supplémentaire aux cibles (ex. Bannière Khéropse). `domains` = les
   * domaines actifs de ce dé (offensive/defensive/objectif/tir/esoterique). Affiché sur la fiche.
   */
  z.object({ kind: z.literal("grant-mastery-die"), domains: z.array(MasteryDomainSchema) }),
]);
export type EffectOperation = z.infer<typeof EffectOperationSchema>;

export const EffectSourceSchema = z.object({
  kind: z.enum(["profile", "special-card", "mount", "equipment"]),
  id: z.string(),
});
export type EffectSource = z.infer<typeof EffectSourceSchema>;

export const EffectSchema = z.object({
  id: z.string(),
  source: EffectSourceSchema,
  scope: EffectScopeSchema,
  /**
   * Condition d'activation. Absente => actif dès que la source est recrutée.
   * Une liste de sélecteurs = conditions cumulées (ET : toutes doivent être vraies),
   * ex. « ≥3 Dogons ET ≥1 Père de famille ».
   */
  condition: z.union([SelectorSchema, z.array(SelectorSchema)]).optional(),
  /** Cible de l'effet (peut être `self`). */
  target: SelectorSchema,
  /**
   * Liaison à une autre figurine, et **verrou de l'effet** : présent, l'effet ne joue que si le
   * joueur a relié la figurine concernée à l'une de celles décrites par `of`. Pilote aussi l'UI de
   * désignation du constructeur. `label` = nom de la liaison montré au joueur (défaut « garde du corps »).
   *
   * Deux lectures selon l'opération, car le sujet de la liaison diffère :
   * - `cost-set` : ce sont les **cibles** qui doivent être reliées (ex. le Larbin, à une Fille de Nyx) ;
   * - effet porté par une figurine (profil, monture, équipement) : c'est la **source** qui doit être
   *   reliée (ex. Djouked, à Broutcha), et l'effet entier est ignoré tant qu'elle ne l'est pas.
   */
  designation: z.object({ of: SelectorSchema, label: z.string().optional() }).optional(),
  operation: EffectOperationSchema,
  sourceText: z.string(),
});
export type Effect = z.infer<typeof EffectSchema>;
