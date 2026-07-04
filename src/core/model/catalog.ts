import { z } from "zod";
import {
  LevelSchema,
  MasteryDomainSchema,
  EquipmentCategorySchema,
  RuleTextSchema,
  SkillRefSchema,
} from "./common";
import { ConstraintSchema } from "./constraints";
import { EffectSchema } from "./effects";

/**
 * Catalogue de référence (lecture seule, versionné).
 * Référence : docs/schema-donnees.md — couche 1.
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
  castingBonusText: z.string(),
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
  sourceText: z.string(),
  seuil: z.number().optional(),
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

export const ProfileMagicSchema = z.object({
  canCast: z.boolean(),
  magicWayIds: z.array(z.string()),
  knownReservedSpellIds: z.array(z.string()).optional(),
});

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
  magic: ProfileMagicSchema.optional(),
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
  isFree: z.boolean().optional(),
  hands: z.union([z.literal(1), z.literal(2)]).optional(),
  allonge: z.number().optional(),
  range: z.object({ short: z.number(), long: z.number(), max: z.number().optional() }).optional(),
  reload: z.object({ cadence: z.number(), paCost: z.number() }).optional(),
  /** Munitions achetables (armes de tir sans recharge) : coût par unité et quantité max éventuelle. */
  munition: z.object({ unitCost: z.number(), max: z.number().optional() }).optional(),
  /** L'objet confère la capacité de lancer des sorts dans ces voies (ex. focus/relique). */
  grantsCasting: z.object({ magicWayIds: z.array(z.string()) }).optional(),
  durability: z.number().optional(),
  perceArmure: z.union([z.number(), z.literal("1D5")]).optional(),
  effectsText: z.string(),
  /** Compétences conférées (ex. la Faucille d'Os confère « Riposte »). */
  grantsSkills: z.array(SkillRefSchema).optional(),
  restrictions: z.array(ConstraintSchema),
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
  restrictions: z.array(ConstraintSchema),
  cardImage: z.string().optional(),
});
export type Mount = z.infer<typeof MountSchema>;

export const MountOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number(),
  effectsText: z.string(),
  restrictions: z.array(ConstraintSchema),
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
  scope: z.object({ profileIds: z.array(z.string()).optional(), trait: z.string().optional() }),
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
  /** La carte confère la capacité de lancer des sorts dans ces voies (ex. Apprentie de Nyx → ostéomancie). */
  grantsCasting: z.object({ magicWayIds: z.array(z.string()) }).optional(),
  rulesText: z.array(RuleTextSchema),
  constraints: z.array(ConstraintSchema),
  effects: z.array(EffectSchema),
  cardImage: z.string(),
});
export type SpecialCard = z.infer<typeof SpecialCardSchema>;

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
  /**
   * Icônes/portraits recadrés, indexés par `cardImage` (data-URI). Comme plusieurs profils (les
   * niveaux d'un même modèle) partagent une illustration de carte, les indexer par `cardImage`
   * partage automatiquement l'icône : on ne recadre qu'une fois par carte.
   */
  icons: z.record(z.string(), z.string()).optional(),
});
export type Catalog = z.infer<typeof CatalogSchema>;

/**
 * Icône à afficher pour un profil : l'icône *propre au profil* (`p.icon`) si définie — elle déroge
 * au partage pour ce niveau précis —, sinon celle partagée par `cardImage` (commune aux niveaux),
 * sinon aucune.
 */
export function iconFor(cat: Catalog, p: Profile): string | undefined {
  return p.icon ?? cat.icons?.[p.cardImage];
}
