import { z } from "zod";
import {
  LevelSchema,
  MasteryDomainSchema,
  EquipmentCategorySchema,
  RuleTextSchema,
  SelectorSchema,
  SkillRefSchema,
} from "./common";
import { ConstraintSchema } from "./constraints";
import { EffectSchema } from "./effects";

/**
 * Catalogue de référence (lecture seule, versionné).
 * Référence : docs/schema-donnees.md - couche 1.
 */

export const FactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string(),
  subFactions: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type Faction = z.infer<typeof FactionSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  keyword: z.string(),
  hasValue: z.boolean(),
  obligatory: z.boolean().optional(),
  /** Description officielle verbatim (livret, ou carte si compétence rare). */
  sourceText: z.string(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const MagicWaySchema = z.object({
  id: z.string(),
  name: z.string(),
  factionId: z.string(),
  /**
   * Compétence qui *maîtrise* cette voie : une figurine peut lancer la voie dès qu'elle possède
   * cette compétence (ex. « Ostéomancie », « Le Sacrifice »). Source de vérité du statut de lanceur.
   */
  skillId: z.string().optional(),
});
export type MagicWay = z.infer<typeof MagicWaySchema>;

/** Regroupe les versions d'une même figurine (niveaux + personnages associés). */
export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  factionId: z.string().optional(),
  profileIds: z.array(z.string()),
});
export type Model = z.infer<typeof ModelSchema>;

/** Caractéristiques. Valeurs nullables (ex. Aliénés : seule V est définie). */
export const StatsSchema = z.object({
  v: z.number().nullable(),
  p: z.number().nullable(),
  a: z.number().nullable(),
  c: z.number().nullable(),
  t: z.number().nullable(),
  i: z.number().nullable(),
});
export type Stats = z.infer<typeof StatsSchema>;

export const ArmorSchema = z.object({
  sourceText: z.string().optional(),
  /** Seuil de l'armure : valeur à atteindre pour un jet de protection réussi (chiffre central). */
  seuil: z.number().optional(),
  /** Protection en cas d'échec du jet (chiffre de gauche). */
  protectionEchec: z.number().optional(),
  /** Protection en cas de réussite du jet (chiffre de droite). */
  protectionReussite: z.number().optional(),
  /** Durabilité de l'armure = nombre de cercles blancs affichés à côté. */
  durability: z.number().optional(),
  natural: z.boolean().optional(),
});
export type Armor = z.infer<typeof ArmorSchema>;

export const LimitationSchema = z.object({
  /** "special" : limitation régie par une contrainte (ex. Likan « • »). */
  kind: z.enum(["X", "U", "P", "special"]),
  value: z.number().optional(),
  /** Pour "P" : occupe l'emplacement d'un (modèle, niveau). */
  consumesSlotOf: z.object({ modelId: z.string(), level: LevelSchema }).optional(),
});
export type Limitation = z.infer<typeof LimitationSchema>;


export const ProfileSchema = z.object({
  /** Slug stable généré par nous (ex. "fangs-larbin-1"), PAS le code imprimé. */
  id: z.string(),
  modelId: z.string().optional(),
  name: z.string(),
  level: LevelSchema.optional(),
  /** Absent => profil « sans logo ». */
  factionId: z.string().optional(),
  cost: z.number(),
  isNamed: z.boolean().optional(),
  limitation: LimitationSchema,
  stats: StatsSchema,
  stature: z.number(),
  pa: z.number(),
  pv: z.number(),
  armor: ArmorSchema.optional(),
  skills: z.array(SkillRefSchema),
  /** Équipement de base (coût déjà inclus dans `cost`). */
  baseEquipmentIds: z.array(z.string()),
  /** Un tableau de dés de maîtrise ; chaque dé porte 1 à 5 domaines. */
  masteryDice: z.array(z.array(MasteryDomainSchema)),
  /** Vocabulaire ouvert (ex. "apatride", "tembo", "femelle-fang", "frere-d-armes"…). */
  traits: z.array(z.string()),
  recruitment: z.array(ConstraintSchema),
  effects: z.array(EffectSchema).optional(),
  /** Tout le texte de règles de la carte, verbatim. */
  rules: z.array(RuleTextSchema),
  /** Notes éditoriales hors carte (non verbatim) : ex. compétences ajoutées par le livre de bataille. */
  notes: z.array(z.string()).optional(),
  cardImage: z.string(),
  /**
   * Icône/portrait recadré (data-URI) *propre à ce profil*, qui **déroge** au partage : si présent,
   * il l'emporte sur l'icône partagée par `cardImage` (cf. `iconFor`). Utile quand un niveau doit
   * avoir sa propre illustration. Par défaut on préfère `Catalog.icons` (partagé entre niveaux).
   */
  icon: z.string().optional(),
  mountEligible: z.boolean().optional(),
  /** Champs dont la lecture sur la carte est incertaine (chemins, ex. "stature", "stats.t"). */
  unverifiedFields: z.array(z.string()).optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const EquipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: EquipmentCategorySchema,
  cost: z.number(),
  /** Mains occupées (affichage seulement, pas de limite au recrutement). "1-2" = maniable à 1 ou 2 mains (bâtarde). */
  hands: z.union([z.literal(1), z.literal(2), z.literal("1-2")]).optional(),
  allonge: z.number().optional(),
  range: z.object({ short: z.number(), long: z.number(), max: z.number().optional() }).optional(),
  reload: z.object({ cadence: z.number(), paCost: z.number() }).optional(),
  /**
   * Munitions achetables : identifiant de la sorte de munition (cf. `catalog.munitionKinds`,
   * ex. "fleches" pour un arc, "carreaux" pour une arbalète). Sa présence active l'achat de munitions.
   */
  munitionKind: z.string().optional(),
  /** Quantité de munitions de base incluse (armes de tir). */
  baseMunitions: z.number().optional(),
  /** L'objet confère la capacité de lancer des sorts dans ces voies (ex. focus/relique). */
  grantsCasting: z.object({ magicWayIds: z.array(z.string()) }).optional(),
  /** Durée de vie (DV) - boucliers et armures. */
  durability: z.number().optional(),
  /** Valeurs d'armure (équipement de catégorie « armure ») : cf. `Profile.armor`. */
  protectionEchec: z.number().optional(),
  seuil: z.number().optional(),
  protectionReussite: z.number().optional(),
  perceArmure: z.union([z.number(), z.literal("1D5")]).optional(),
  effectsText: z.string(),
  /** Compétences conférées (ex. la Faucille d'Os confère « Riposte »). */
  grantsSkills: z.array(SkillRefSchema).optional(),
  /**
   * Réservation : l'équipement n'est portable que par les profils correspondant à *toutes* les
   * dimensions fournies (au sein d'une dimension, l'appartenance suffit). Ex. Bâton relique →
   * Décatie ; Arc court → niveau I ; équipement réservé à une espèce/faction.
   */
  reservedTo: z
    .object({
      profileIds: z.array(z.string()).optional(),
      modelIds: z.array(z.string()).optional(),
      traits: z.array(z.string()).optional(),
      levels: z.array(LevelSchema).optional(),
      factionIds: z.array(z.string()).optional(),
    })
    .optional(),
  /** Si l'équipement a sa propre carte (sinon affiché inline sur le profil). */
  cardImage: z.string().optional(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

export const GrimoireSchema = z.object({
  id: z.enum(["petit", "grand"]),
  name: z.string(),
  cost: z.number(),
  pages: z.union([z.number(), z.literal("illimite")]),
});
export type Grimoire = z.infer<typeof GrimoireSchema>;

export const SpellSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["generique", "grimoire", "reserve-profil"]),
  magicWayId: z.string().optional(),
  pages: z.number().optional(),
  cost: z.number().optional(),
  reservedTo: z
    .object({ profileIds: z.array(z.string()).optional(), trait: z.string().optional() })
    .optional(),
  target: z.string(),
  cadence: z.string().optional(),
  duration: z.string().optional(),
  difficulties: z.array(z.object({ threshold: z.number(), effectText: z.string() })),
  cardImage: z.string().optional(),
});
export type Spell = z.infer<typeof SpellSchema>;

export const MountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["quagga", "koelod", "mochere"]),
  level: LevelSchema,
  cost: z.number(),
  factionEligibility: z.array(z.string()),
  bonusesText: z.string(),
  bonuses: z
    .object({
      pa: z.number().optional(),
      v: z.number().optional(),
      a: z.number().optional(),
      c: z.number().optional(),
      p: z.number().optional(),
      pv: z.number().optional(),
      allonge: z.number().optional(),
      stature: z.number().optional(),
    })
    .optional(),
  grantedSkills: z.array(SkillRefSchema).optional(),
  specialActionsText: z.string().optional(),
  cardImage: z.string().optional(),
});
export type Mount = z.infer<typeof MountSchema>;

export const MountOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number(),
  effectsText: z.string(),
});
export type MountOption = z.infer<typeof MountOptionSchema>;

export const PactSchema = z.object({
  id: z.string(),
  name: z.string(),
  compositionText: z.string(),
  composition: z.array(ConstraintSchema),
  advantageText: z.string(),
});
export type Pact = z.infer<typeof PactSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number(),
  effectText: z.string(),
  assignableTo: z.array(z.enum(["vassal", "seigneur-de-guerre"])),
});
export type Order = z.infer<typeof OrderSchema>;

/** Carte spéciale / de règle / de trait (affichable), liée à des profils ou à un groupe. */
export const SpecialCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number(),
  scope: z.object({
    profileIds: z.array(z.string()).optional(),
    trait: z.string().optional(),
    /** Réservée à une (ou plusieurs) faction entière, ex. « Ordre de Mission Royale » → Khârns. */
    factionIds: z.array(z.string()).optional(),
  }),
  /**
   * `true` : amélioration *choisie* par le joueur (achat optionnel, ex. Apprentie de Nyx, Crosse).
   * Absent/`false` : carte automatique appliquée d'office (ex. Fille de Nyx, Xayìn & Muskh).
   */
  amelioration: z.boolean().optional(),
  /**
   * Groupe de choix exclusif : parmi les améliorations partageant le même `choiceGroup`,
   * une figurine ne peut en sélectionner qu'une seule (ex. les 3 spécialités « Racines Tribales »).
   */
  choiceGroup: z.string().optional(),
  /**
   * `true` : amélioration *partagée* au niveau du Fer de Lance - payée **une seule fois** quel que soit
   * le nombre de figurines qui en bénéficient (ex. Lien de la Terre). On l'active depuis n'importe quel
   * modèle éligible ; l'effet (portée `fer-de-lance`) profite à toute sa cible.
   */
  shared: z.boolean().optional(),
  /** La carte confère la capacité de lancer des sorts dans ces voies (ex. Apprentie de Nyx → ostéomancie). */
  grantsCasting: z.object({ magicWayIds: z.array(z.string()) }).optional(),
  /**
   * `true` : amélioration *empilable* - achetable en plusieurs exemplaires sur une même figurine,
   * plafonnée à son **niveau** (ex. « Ordre de Mission Royale » : autant d'ordres que le Niveau).
   * La quantité choisie est stockée dans `ProfileInstance.specialCardCounts`.
   */
  perLevelStack: z.boolean().optional(),
  /**
   * `true` : carte à portée **Ost** - sélectionnée au niveau de la liste (pas d'une figurine), ses effets
   * (portée `ost`) s'appliquent à toute la bande. `scope` sert alors de **disponibilité** (la carte n'est
   * proposée que si la liste contient une figurine correspondante, ex. Myriam). Stockée dans `list.ost.cardIds`.
   */
  ostScope: z.boolean().optional(),
  /**
   * Condition d'activation d'une carte d'Ost (composition), évaluée sur toute la liste : la carte peut
   * être sélectionnée mais reste **invalide → erreur** tant que la condition n'est pas remplie
   * (ex. « ≥ 4 personnages parmi … »). Ses effets ne s'appliquent que si la condition est satisfaite.
   */
  activationCondition: z.union([SelectorSchema, z.array(SelectorSchema)]).optional(),
  rulesText: z.array(RuleTextSchema),
  constraints: z.array(ConstraintSchema),
  effects: z.array(EffectSchema),
  cardImage: z.string(),
});
export type SpecialCard = z.infer<typeof SpecialCardSchema>;

/**
 * Table de munitions achetables (règles p.46). Une « sorte » (flèches pour les arcs, carreaux pour
 * les arbalètes) propose plusieurs `types` (Simple, Perce-armure…) ; pour chaque type, `quantities`
 * donne le nombre de munitions obtenues à chaque palier de prix (`tierPrices`, ex. 5 Ko / 15 Ko).
 * Une quantité de 0 = type indisponible à ce palier.
 */
export const MunitionTypeSchema = z.object({
  id: z.string(),
  label: z.string(),
  quantities: z.array(z.number()),
});
export type MunitionType = z.infer<typeof MunitionTypeSchema>;

export const MunitionKindSchema = z.object({
  id: z.string(),
  label: z.string(),
  tierPrices: z.array(z.number()),
  types: z.array(MunitionTypeSchema),
});
export type MunitionKind = z.infer<typeof MunitionKindSchema>;

export const CatalogSchema = z.object({
  version: z.string(),
  rulesVersion: z.string(),
  factions: z.array(FactionSchema),
  skills: z.array(SkillSchema),
  magicWays: z.array(MagicWaySchema),
  models: z.array(ModelSchema),
  profiles: z.array(ProfileSchema),
  equipment: z.array(EquipmentSchema),
  grimoires: z.array(GrimoireSchema),
  spells: z.array(SpellSchema),
  mounts: z.array(MountSchema),
  mountOptions: z.array(MountOptionSchema),
  pacts: z.array(PactSchema),
  orders: z.array(OrderSchema),
  specialCards: z.array(SpecialCardSchema),
  /** Sortes de munitions achetables (flèches, carreaux…) ; référencées par `equipment.munitionKind`. */
  munitionKinds: z.array(MunitionKindSchema).optional(),
  /**
   * Icônes/portraits recadrés, indexés par `cardImage` (data-URI). Comme plusieurs profils (les
   * niveaux d'un même modèle) partagent une illustration de carte, les indexer par `cardImage`
   * partage automatiquement l'icône : on ne recadre qu'une fois par carte.
   */
  icons: z.record(z.string(), z.string()).optional(),
});
export type Catalog = z.infer<typeof CatalogSchema>;

/**
 * Icône à afficher pour un profil : l'icône *propre au profil* (`p.icon`) si définie - elle déroge
 * au partage pour ce niveau précis -, sinon celle partagée par `cardImage` (commune aux niveaux),
 * sinon aucune.
 */
export function iconFor(cat: Catalog, p: Profile): string | undefined {
  return p.icon ?? cat.icons?.[p.cardImage];
}
