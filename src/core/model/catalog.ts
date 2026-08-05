import { z } from "zod";
import {
  ArmorSchema,
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

/**
 * Nature alimentaire d'un peuple : ouvre l'action « dévorer » (carnivore) et les Formations
 * réservées à l'une ou l'autre. Le livret ne l'imprime pas sur les cartes (« tous les combattants
 * khârns et fangs sont par nature carnivores, c'est un fait ») : elle se déduit donc du peuple.
 */
export const FactionNatureSchema = z.enum(["carnivore", "herbivore"]);
export type FactionNature = z.infer<typeof FactionNatureSchema>;

/**
 * Recrutement ouvert : la faction accueille les **génériques** (limitation « X » - ni unique ni
 * personnage) d'autres factions, sans « Allié des X » ni sceau. C'est la règle des Affranchis
 * (règles de bataille p.46) : décrite une fois ici plutôt qu'en contrainte sur chaque profil
 * accueilli, sans quoi tout nouveau générique importé serait muet sur son accès.
 */
export const OpenRecruitmentSchema = z.object({
  /** Factions dont les génériques sont accueillis. */
  fromFactionIds: z.array(z.string()),
  /** Génériques refusés malgré l'ouverture, par trait (ex. `femelle-fang`, `ordre-du-sang-et-acier`). */
  excludeTraits: z.array(z.string()).optional(),
  /** Génériques refusés nommément (ex. Bourreau du Sacrifice : seul le Prêtre niveau I est toléré). */
  excludeProfileIds: z.array(z.string()).optional(),
  /**
   * Plafonds par Fer de Lance sur un groupe de profils accueillis (ex. « il ne peut y avoir plus
   * d'un shaman goûn par Fer de Lance »). `label` nomme le groupe dans le message d'erreur.
   */
  caps: z
    .array(z.object({ label: z.string(), profileIds: z.array(z.string()), max: z.number() }))
    .optional(),
  /** Wording officiel dont la règle est tirée - fait foi. */
  sourceText: z.string(),
});
export type OpenRecruitment = z.infer<typeof OpenRecruitmentSchema>;

export const FactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string(),
  /** Nature du peuple, héritée par ses figurines et par celles qui en sont **originaires**. */
  nature: FactionNatureSchema.optional(),
  /** Cf. `OpenRecruitmentSchema`. Absent = faction fermée (le cas général). */
  openRecruitment: OpenRecruitmentSchema.optional(),
  notes: z.string().optional(),
});
export type Faction = z.infer<typeof FactionSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  keyword: z.string(),
  hasValue: z.boolean(),
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
  /**
   * **Peuple d'origine**, pour les factions « creuset » qui recrutent chez les autres (Guilde Noire,
   * Affranchis) : la figurine a quitté son peuple mais en garde la **monture** et la **nature**
   * carnivore/herbivore - pas ses objets ni ses sorts réservés (FAQ). Absent = originaire de sa
   * propre faction. Remplace l'ancien trait `monture-<faction>`, qui ne savait pas dire l'origine
   * d'un peuple sans monture (les Fangs).
   */
  origin: z.string().optional(),
  /**
   * Peuples entre lesquels l'origine se **choisit au recrutement**, figurine par figurine, au lieu
   * d'être fixée par la carte. C'est le cas de l'Agent sombre, infiltré « recruté dans tous les
   * royaumes » : un seul profil, mais cinq provenances possibles, dont dépend sa monture.
   *
   * La liste est explicite, jamais « toutes les factions » : l'Agent sombre vient des cinq peuples,
   * pas de la Guilde Noire elle-même ni des Affranchis. Exclut `origin`, qui dit une origine fixe.
   */
  originChoices: z.array(z.string()).optional(),
  /**
   * **Diamètre du socle** en millimètres, tel qu'imprimé à droite de la limitation. Propriété de la
   * figurine physique, pas de son profil de jeu : elle ne change rien au recrutement ni au coût.
   * Absente sur beaucoup de cartes, qui ne l'impriment pas.
   */
  baseSize: z.union([z.literal(30), z.literal(40), z.literal(50), z.literal(60)]).optional(),
  cost: z.number(),
  limitation: LimitationSchema,
  stats: StatsSchema,
  stature: z.number(),
  pa: z.number(),
  pv: z.number(),
  armor: ArmorSchema.optional(),
  skills: z.array(SkillRefSchema),
  /** Équipement de base (coût déjà inclus dans `cost`), **un identifiant par objet distinct**. */
  baseEquipmentIds: z.array(z.string()),
  /**
   * Nombre d'exemplaires d'un objet de base, quand la figurine en porte plusieurs (ex. Camériste :
   * 3 doses de poison). Absent ou 1 = un seul. Les catalogues antérieurs répétaient l'identifiant :
   * `migrateCatalog` les replie sur ce champ.
   */
  baseEquipmentCounts: z.record(z.string(), z.number().int().min(1)).optional(),
  /**
   * Sous-ensemble de `baseEquipmentIds` **soudé à la figurine** : elle ne peut pas le rendre pour
   * en récupérer le coût (ex. les doses de poison de la Camériste, l'outillage de l'Agent sombre).
   * Le constructeur en interdit le retrait ; le reste de l'équipement de base reste rendable.
   */
  fixedBaseEquipmentIds: z.array(z.string()).optional(),
  /** Un tableau de dés de maîtrise ; chaque dé porte 1 à 5 domaines. */
  masteryDice: z.array(z.array(MasteryDomainSchema)),
  /** Vocabulaire ouvert (ex. "tembo", "femelle-fang", "frere-d-armes", "khemiste"…). */
  traits: z.array(z.string()),
  recruitment: z.array(ConstraintSchema),
  effects: z.array(EffectSchema).optional(),
  /** Tout le texte de règles de la carte, verbatim. */
  rules: z.array(RuleTextSchema),
  /** Notes éditoriales hors carte (non verbatim) : ex. compétences ajoutées par le livre de bataille. */
  notes: z.array(z.string()).optional(),
  cardImage: z.string(),
  /**
   * Référence d'icône *propre à ce profil*, qui **déroge** au partage : si présente, elle l'emporte
   * sur l'icône partagée par `cardImage` (cf. `iconFor`). Utile quand un niveau doit avoir sa propre
   * illustration. Par défaut on préfère `Catalog.icons` (partagé entre niveaux). Même forme que les
   * valeurs de `Catalog.icons` : un nom `<hash>.webp`, pas une image.
   */
  icon: z.string().optional(),
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
  /**
   * Durée de vie (DV) - boucliers, armures et casques : le nombre de cases à cocher imprimées sur la
   * carte. Absente pour un casque qui n'en porte pas, et le livret est explicite là-dessus (p.14) :
   * « si le casque n'en comporte pas, ces effets sont effectifs pour toute la durée de la partie ».
   */
  durability: z.number().optional(),
  /**
   * **Empilable** : une même figurine peut en porter plusieurs exemplaires (ex. doses de poison,
   * fioles). Seuls ces objets acceptent une quantité dans l'équipement de base et peuvent être
   * achetés plusieurs fois ; les autres restent en un seul exemplaire.
   */
  stackable: z.boolean().optional(),
  /**
   * Armure **cumulable** : elle ne consomme pas l'unique emplacement d'armure et peut donc être portée
   * en plus d'une armure ordinaire (ex. Gambison, « 1 seule armure par Safar en plus d'un gambison »).
   * Le plafond devient : 1 armure ordinaire + 1 cumulable.
   */
  stacksWithArmor: z.boolean().optional(),
  /** Valeurs d'armure (équipement de catégorie « armure ») : cf. `Profile.armor`. */
  protectionEchec: z.number().optional(),
  seuil: z.number().optional(),
  protectionReussite: z.number().optional(),
  /**
   * Seuil amélioré appliqué si le porteur possède **déjà** une armure innée au moins aussi protectrice
   * (échec ≤ et réussite ≤ celles de cette armure). Ex. Armure de Combat Khârne : seuil 7, `heavySeuil` 5.
   */
  heavySeuil: z.number().optional(),
  perceArmure: z.union([z.number(), z.literal("1D5")]).optional(),
  effectsText: z.string(),
  /**
   * Effets appliqués tant que l'objet est porté (octroi de compétence/sort, coût…), comme
   * `Profile.effects`. Cible `self` = le porteur. Ex. Faucille d'Os → octroie « Riposte ».
   */
  effects: z.array(EffectSchema).optional(),
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
  /**
   * Équipement lié à la monture (p.32) : disponible uniquement en présence d'une monture.
   * `mount` = porté par la MONTURE (Caparaçon, sur `inst.mount.addedEquipmentIds`) ;
   * `rider` = par le CAVALIER monté (Lance de cavalerie, sur `inst.addedEquipmentIds`).
   */
  mountEquipment: z.enum(["mount", "rider"]).optional(),
  /** Coût variable selon la faction du cavalier (ex. Caparaçon : khârn/GN 20, khérops 22). Prioritaire sur `cost`. */
  costByFaction: z.record(z.string(), z.number()).optional(),
  /**
   * Améliorations optionnelles *intrinsèques* à cet objet (ex. Caparaçon → « Pointes acérées » +5 Ko),
   * achetables une fois l'objet équipé. Stockées dans `equipmentUpgrades[equipmentId]` de l'instance.
   * À distinguer des améliorations *octroyées* par une carte (effets `unlock-upgrade`, ex. Borax).
   */
  upgrades: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        cost: z.number(),
        effectsText: z.string().optional(),
      }),
    )
    .optional(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;
export type EquipmentUpgrade = NonNullable<Equipment["upgrades"]>[number];

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
  /**
   * Coût en **niveaux** d'un sort générique (défaut 1) : un lanceur peut en connaître autant que son
   * niveau, et « Passe-Passe » en vaut 3 à lui seul. Sans objet pour les sorts de grimoire, qui se
   * comptent en pages.
   */
  levelCost: z.number().optional(),
  /**
   * Réservation : le sort n'est accessible qu'aux profils correspondant à *au moins une* des dimensions
   * fournies. S'applique aussi aux sorts génériques (ex. « Passe-Passe », réservé à Bharbathos).
   */
  reservedTo: z
    .object({
      profileIds: z.array(z.string()).optional(),
      trait: z.string().optional(),
      factionIds: z.array(z.string()).optional(),
    })
    .optional(),
  target: z.string(),
  cadence: z.string().optional(),
  duration: z.string().optional(),
  difficulties: z.array(z.object({ threshold: z.number(), effectText: z.string() })),
  cardImage: z.string().optional(),
});
export type Spell = z.infer<typeof SpellSchema>;

/**
 * Type de monture (Quagga, Koelod, Mochère…) : porte l'éligibilité *partagée par tous ses niveaux*.
 * Éligible = faction du cavalier ∈ `factionEligibility` ET profil ∉ `excludedProfileIds`
 * (la règle de niveau ±1 et l'interdiction Berseker sont gérées par le moteur).
 */
export const MountKindSchema = z.enum(["quagga", "koelod", "mochere"]);
export type MountKind = z.infer<typeof MountKindSchema>;

export const MountTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: MountKindSchema,
  factionEligibility: z.array(z.string()),
  /** Profils qui ne peuvent pas prendre cette monture malgré leur faction (ex. Affranchis d'origine khéropse/fang). */
  excludedProfileIds: z.array(z.string()).optional(),
  cardImage: z.string().optional(),
});
export type MountType = z.infer<typeof MountTypeSchema>;

/** Un niveau concret d'une monture (coût + bonus + compétences), rattaché à un `MountType`. */
export const MountSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  level: LevelSchema,
  cost: z.number(),
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
  /** Effets appliqués quand cette monture est recrutée (ex. Mochère → grimoire du cavalier). Cible `cavalier`. */
  effects: z.array(EffectSchema).optional(),
  /** Règles verbatim propres à ce niveau (ex. Ruade, Piétinement), comme `Profile.rules`. */
  rules: z.array(RuleTextSchema).optional(),
  /**
   * Référence d'icône propre à ce niveau : déroge à celle partagée du type (`MountType.cardImage`).
   * Cf. `Profile.icon` et `mountIconFor`.
   */
  icon: z.string().optional(),
});
export type Mount = z.infer<typeof MountSchema>;

/**
 * Option achetable pour un cavalier monté ou sa monture (règles de bataille p.32). Toutes les options
 * du Lot B confèrent une compétence. Le panier détermine où elle s'achète et sur quelle fiche elle agit :
 * - `mount` : sur la fiche de la MONTURE (ex. Peau dure, Sacrifice X) ;
 * - `rider` : dans l'onglet « Monture » du CAVALIER (ex. Autorité, Exécuteur) ;
 * - `both` : PARTAGÉE (ex. Brutalité X, Endurance, Stable) - achetée une seule fois (depuis l'un OU
 *   l'autre), elle apparaît des deux côtés sans surcoût, la meilleure valeur étant conservée.
 * Le Caparaçon et la Lance de cavalerie ne sont PAS des options mais des `equipment` (cf. `mountEquipment`).
 */
export const MountOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  bucket: z.enum(["mount", "rider", "both"]),
  /** Compétence conférée par l'option (avec valeur éventuelle). */
  grantsSkill: SkillRefSchema.optional(),
  /** Valeur X maximale achetable (paliers 1..maxValue), pour les compétences à valeur (Brutalité, Sacrifice). */
  maxValue: z.number().optional(),
  /** Réservation : factions du cavalier et/ou natures de monture autorisées (au sein d'une dimension, l'appartenance suffit). */
  reservation: z
    .object({
      factions: z.array(z.string()).optional(),
      mountKinds: z.array(MountKindSchema).optional(),
    })
    .optional(),
  /** Coût fixe (ou coût du palier X1 si `costByValue` est fourni). */
  cost: z.number(),
  /** Coût par palier de valeur : index 0 = X1, index 1 = X2… (Brutalité, Sacrifice). */
  costByValue: z.array(z.number()).optional(),
  /** Coût variable selon la nature de la monture (clé = nature, ex. Repoussement : koelod 15 / quagga 25). */
  costByMountKind: z.record(z.string(), z.number()).optional(),
  effectsText: z.string().optional(),
});
export type MountOption = z.infer<typeof MountOptionSchema>;

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
    /**
     * Portée par la **bannière**, pas par la carte de profil : la carte vise toute figurine d'un Fer
     * de Lance de ces factions, quelle que soit la sienne. C'est ce que demandent les bonus des
     * Affranchis, dont « toutes les figurines qui combattent sous leur bannière bénéficient des
     * effets comme une seule et même faction, que leurs cartes soient affranchies ou non » (p.47).
     */
    ferDeLanceFactionIds: z.array(z.string()).optional(),
    /**
     * Avec `ferDeLanceFactionIds` : ne vise que les **recrues d'un autre peuple**. Sert aux règles
     * qui n'existent que pour elles (l'entraînement d'éclaireur affranchi, que les Affranchis
     * d'origine possèdent déjà).
     */
    nonNativeOnly: z.boolean().optional(),
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
  /**
   * `true` : amélioration *empilable* - achetable en plusieurs exemplaires sur une même figurine,
   * plafonnée à son **niveau** (ex. « Ordre de Mission Royale » : autant d'ordres que le Niveau).
   * La quantité choisie est stockée dans `ProfileInstance.specialCardCounts`.
   */
  perLevelStack: z.boolean().optional(),
  /**
   * `true` : le prix est **multiplié par le niveau** de la figurine (« il lui en coûtera 5 Ko × son
   * niveau »). À ne pas confondre avec `perLevelStack`, qui laisse le joueur choisir la quantité :
   * ici le prix suit le niveau, sans choix.
   */
  costPerLevel: z.boolean().optional(),
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
  /**
   * Texte officiel de la carte, **d'un seul tenant**, retours à la ligne compris (rendus tels quels).
   *
   * Contrairement aux fiches de figurine (profils, montures), une carte spéciale n'énumère pas des
   * capacités nommées : c'est un paragraphe suivi. Elle se saisit donc comme la description d'un
   * objet, et non en blocs `RuleText` à étiquette - un emprunt au modèle des profils dont rien ici
   * n'avait l'usage (l'étiquette n'était ni saisissable ni affichée).
   */
  rulesText: z.string(),
  constraints: z.array(ConstraintSchema),
  effects: z.array(EffectSchema),
  /**
   * Notes internes (hors carte, jamais montrées aux joueurs) : c'est ici que se consigne une règle
   * qu'aucun type de contrainte ne couvre, plutôt que dans une contrainte inerte.
   */
  notes: z.array(z.string()).optional(),
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
  /**
   * Interdit sur une **arme gratuite** (p.13) : « la "flèche hydre" ne peut pas être utilisée avec un
   * arc gratuit ». Le drapeau se pose sur le type, pas sur la sorte - seule la Flèche hydre est
   * concernée, pas les flèches simples. Cf. `isFreeWeapon` pour ce qui compte comme arme gratuite.
   */
  forbiddenOnFreeWeapon: z.boolean().optional(),
});
export type MunitionType = z.infer<typeof MunitionTypeSchema>;

export const MunitionKindSchema = z.object({
  id: z.string(),
  label: z.string(),
  tierPrices: z.array(z.number()),
  types: z.array(MunitionTypeSchema),
});
export type MunitionKind = z.infer<typeof MunitionKindSchema>;

/** Réglages transverses du catalogue (paramètres de règles éditables dans l'admin). */
export const CatalogSettingsSchema = z.object({
  /**
   * Surcoût d'équipement des figurines « tembo » (Règles de bataille p.20) : +`amount` Ko par tranche
   * complète de `per` Ko sur chaque équipement **ajouté** non déjà tarifé Tembo (les équipements au logo
   * Tembo - réservés au trait « tembo » - l'incluent déjà). Absent = mécanisme désactivé.
   */
  temboEquipmentSurcharge: z.object({ per: z.number(), amount: z.number() }).optional(),
});
export type CatalogSettings = z.infer<typeof CatalogSettingsSchema>;

export const CatalogSchema = z.object({
  version: z.string(),
  rulesVersion: z.string(),
  /** Paramètres de règles transverses (ex. surcoût d'équipement Tembo). */
  settings: CatalogSettingsSchema.optional(),
  factions: z.array(FactionSchema),
  skills: z.array(SkillSchema),
  magicWays: z.array(MagicWaySchema),
  models: z.array(ModelSchema),
  profiles: z.array(ProfileSchema),
  equipment: z.array(EquipmentSchema),
  grimoires: z.array(GrimoireSchema),
  spells: z.array(SpellSchema),
  mountTypes: z.array(MountTypeSchema),
  mounts: z.array(MountSchema),
  mountOptions: z.array(MountOptionSchema),
  specialCards: z.array(SpecialCardSchema),
  /** Sortes de munitions achetables (flèches, carreaux…) ; référencées par `equipment.munitionKind`. */
  munitionKinds: z.array(MunitionKindSchema).optional(),
  /**
   * Icônes/portraits recadrés, indexés par `cardImage`. Comme plusieurs profils (les niveaux d'un
   * même modèle) partagent une illustration de carte, les indexer par `cardImage` partage
   * automatiquement l'icône : on ne recadre qu'une fois par carte.
   *
   * La valeur est une **référence**, pas une image : le nom de fichier adressé par contenu
   * `<hash>.webp` (cf. `iconName` côté app). Les octets vivent ailleurs - miroir précaché dans le
   * dépôt, ou bucket Supabase - et c'est `iconSrc` qui résout la référence en URL affichable.
   * Une data-URI reste tolérée en lecture : les versions publiées avant la sortie des images du
   * catalogue en contiennent encore, et l'historique en conserve dix.
   */
  icons: z.record(z.string(), z.string()).optional(),
});
export type Catalog = z.infer<typeof CatalogSchema>;

/** Nombre d'exemplaires d'un objet dans l'équipement de base d'un profil (1 par défaut). */
export function baseEquipmentCount(p: Profile, equipmentId: string): number {
  if (!p.baseEquipmentIds.includes(equipmentId)) return 0;
  return p.baseEquipmentCounts?.[equipmentId] ?? 1;
}

/**
 * Référence d'icône d'un profil : celle *propre au profil* (`p.icon`) si définie - elle déroge au
 * partage pour ce niveau précis -, sinon celle partagée par `cardImage` (commune aux niveaux),
 * sinon aucune. À passer à `iconSrc` pour obtenir une URL affichable.
 */
export function iconFor(cat: Catalog, p: Profile): string | undefined {
  // `cardImage` vide = pas de carte scannée (fiche en cours de saisie) : aucune icône partagée à
  // aller chercher, sinon la clé « » les ferait toutes se partager la même image.
  return p.icon ?? (p.cardImage ? cat.icons?.[p.cardImage] : undefined);
}

/**
 * Référence d'icône d'une monture, même règle de dérogation que `iconFor` : l'icône propre au
 * niveau l'emporte sur celle partagée par le `cardImage` de son type.
 *
 * Passer le niveau le plus bas d'un type donne l'icône représentative de ce type (c'est ce
 * qu'affiche le roster, qui liste les types et non les niveaux).
 */
export function mountIconFor(cat: Catalog, mount: Mount | undefined): string | undefined {
  if (!mount) return undefined;
  const type = cat.mountTypes.find((t) => t.id === mount.typeId);
  return mount.icon ?? (type?.cardImage ? cat.icons?.[type.cardImage] : undefined);
}
