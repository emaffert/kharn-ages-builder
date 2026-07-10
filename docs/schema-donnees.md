# Schéma de données - Khârn-Âges list builder

Modèle de données de l'application, présenté ici de façon **conceptuelle**.

> **Schéma faisant foi :** l'implémentation de référence est constituée des schémas **Zod** de
> [`src/core/model/`](../src/core/model/) (`catalog.ts`, `list.ts`, `effects.ts`,
> `constraints.ts`, `common.ts`). En cas de divergence, ce sont eux la source de vérité ; ce
> document en donne l'intention et les cas d'usage. Quelques champs ajoutés en cours de route
> (ex. `ProfileInstance.munitions`, `Effect.operation "stat-modifier" / "spell-pages"`) sont
> signalés ci-dessous, mais reportez-vous au code pour la liste exhaustive.

Voir aussi : [`regles-creation-liste.md`](regles-creation-liste.md) pour les règles métier sous-jacentes.

## Principes d'architecture

- **Local-first.** L'app fonctionne sans compte ni serveur : construction, sauvegarde locale, export, import, partage par fichier/lien. L'authentification + synchronisation cloud sera une couche **additive** ultérieure.
- **Trois couches de données distinctes :**
  1. **Catalogue** - données de référence (cartes, équipements, sorts…), en **lecture seule** et **versionnées**.
  2. **Moteur de contraintes** - règles de recrutement déclaratives et extensibles.
  3. **Données utilisateur** - les listes créées, dans un **format portable et versionné**.
- **Cœur métier agnostique de l'UI.** Modèle + moteur + calcul de coût/validation = un module TypeScript pur, réutilisable en web puis en mobile.
- **Identifiants stables.** Chaque entrée du catalogue a un `id` stable **généré par nous** (slug lisible, ex. `fangs-larbin-1`). On **ne réutilise pas** les codes imprimés sur les cartes (ex. `KAFALA1`) : ils ne sont pas uniques par profil (partagés entre plusieurs cartes, probablement une référence d'illustration/planche). Indispensable pour ré-hydrater une liste partagée.
- **Wording verbatim = source de vérité.** Tout objet portant une règle a un champ `sourceText` contenant le texte officiel **non modifié**. Les champs structurés (pour le moteur) en sont une *interprétation* qui ne fait jamais foi.

## Couche 1 - Catalogue

### Métadonnées

```ts
interface Catalog {
  version: string;            // version du catalogue (ex. "2026.06.01")
  rulesVersion: string;       // version des règles/FAQ couverte (ex. "FAQ 2026-01")
  factions: Faction[];
  skills: Skill[];            // dictionnaire des compétences
  magicWays: MagicWay[];
  models: Model[];            // regroupements (un modèle = ses versions/niveaux)
  profiles: Profile[];        // les cartes individuelles
  equipment: Equipment[];
  grimoires: Grimoire[];
  spells: Spell[];
  mounts: Mount[];
  mountOptions: MountOption[];
  pacts: Pact[];              // mode bataille
  orders: Order[];            // mode bataille
  specialCards: SpecialCard[]; // cartes spéciales / de règle / de trait
}
```

### Faction

```ts
interface Faction {
  id: string;                 // "kharns", "gouns", "kherops", "fangs", "tembos", "guilde-noire", "affranchis"
  name: string;
  logo: string;               // référence d'asset
  subFactions?: string[];     // ex. Goûns -> ["dogons", "mongos"]
  notes?: string;
}
```

### Compétence (dictionnaire)

```ts
interface Skill {
  id: string;
  keyword: string;            // "Endurance", "Le sang m'attire", "Allonge", ...
  hasValue: boolean;          // true si la compétence a une valeur X (ex. "Allonge 2")
  obligatory?: boolean;       // certaines compétences sont "obligatoires"
  sourceText: string;         // description officielle verbatim (livret) ; sur carte si rare
}
```

> Une compétence portée par une carte peut avoir un **texte propre** (ex. « Soumis », « Éprouvé ») : dans ce cas, le verbatim est stocké au niveau du `Profile` (voir `rules`).

### Voie de magie

```ts
interface MagicWay {
  id: string;                 // "osteomancie", "shamanisme", "sang-et-acier", "sacrifice", "adansonia"
  name: string;
  factionId: string;
  castingBonusText: string;   // verbatim de la règle de bonus d'incantation
}
```

### Modèle et Profil

Un **Model** regroupe les versions d'une même figurine (niveaux I/II/III et personnages
associés). Sert notamment à résoudre la limitation **LIM P** (un personnage consomme
l'emplacement d'un niveau donné de son modèle).

```ts
interface Model {
  id: string;                 // ex. "paladin"
  name: string;
  factionId?: string;
  profileIds: string[];       // versions rattachées
}

type Level = 1 | 2 | 3;

interface Profile {
  id: string;                 // slug stable généré, ex. "fangs-larbin-1" (PAS le code carte)
  modelId?: string;
  name: string;
  level?: Level;              // null pour certains profils spéciaux (Aliénés, etc.)
  factionId?: string;         // absent => profil "sans logo"
  cost: number;               // Ko
  isNamed?: boolean;          // personnage nommé

  limitation: Limitation;
  stats: Stats;               // certaines valeurs peuvent être nulles (Aliénés)
  stature: number;            // 0..6
  pa: number;
  pv: number;
  armor?: Armor;

  skills: SkillRef[];         // mots-clés + valeur éventuelle
  baseEquipmentIds: string[]; // équipement de base (coût déjà inclus dans `cost`)
  masteryDice: MasteryDomain[][]; // un dé par entrée ; chaque dé porte 1 à 5 domaines

  magic?: {
    canCast: boolean;
    magicWayIds: string[];    // voies maîtrisées
    knownReservedSpellIds?: string[];
  };

  traits: Trait[];            // "apatride", "allie-des", "carnivore", "tembo", "khemiste",
                              // "affranchi", "aliene", "femelle-fang", ...
  recruitment: Constraint[];  // contraintes de recrutement (voir couche 2)
  effects?: Effect[];         // effets dynamiques émis dans la liste (coût, octroi, déblocage)
  rules: RuleText[];          // TOUT le texte de règles de la carte, verbatim
  notes?: string[];           // notes éditoriales hors carte (ex. ajouts du livre de bataille)
  cardImage: string;          // référence d'asset
  mountEligible?: boolean;
  unverifiedFields?: string[]; // chemins des champs à revérifier (ex. "stature", "stats.t")
}

interface Limitation {
  kind: "X" | "U" | "P" | "special"; // "special" : régie par une contrainte (ex. Likan « • »)
  value?: number;             // pour "X"
  consumesSlotOf?: {          // pour "P" : occupe l'emplacement d'un (modèle, niveau)
    modelId: string;
    level: Level;
  };
}

interface Stats { v: number|null; p: number|null; a: number|null; c: number|null; t: number|null; i: number|null; }

type MasteryDomain = "offensive" | "defensive" | "objectif" | "tir" | "esoterique";

interface SkillRef {
  skillId: string;
  value?: number | string;   // "Allonge 2" (num) ou valeur textuelle
  precision?: string;        // complément propre au profil (affiché à la description dépliée)
}

interface Armor { sourceText: string; seuil?: number; durability?: number; natural?: boolean; }

interface RuleText { label?: string; text: string; }   // text = verbatim, fait foi
```

### Équipement

```ts
interface Equipment {
  id: string;
  name: string;
  category: "arme-cac" | "arme-tir" | "bouclier" | "armure" | "munition" | "objet" | "monture-option";
  cost: number;               // Ko (peut être 0 pour une arme gratuite)
  isFree?: boolean;           // arme gratuite (règle du "max moitié du FdL")
  hands?: 1 | 2;
  allonge?: number;           // en toises
  range?: { short: number; long: number; max?: number };  // armes de tir
  reload?: { cadence: number; paCost: number };
  munition?: { unitCost: number; max?: number };  // munitions achetables (tir sans recharge)
  grantsCasting?: { magicWayIds: string[] };      // objet conférant l'incantation (focus/relique)
  durability?: number;        // armures / boucliers
  perceArmure?: number | "1D5";
  effectsText: string;        // verbatim
  grantsSkills?: SkillRef[];   // ex. la Faucille d'Os confère « Riposte »
  restrictions: Constraint[]; // notes de restriction (verbatim + éventuel encodage)
  // Réservation structurée : portable seulement par les profils validant TOUTES les dimensions
  // fournies (ex. Arc court → niveau I ; Bâton relique → Décatie).
  reservedTo?: {
    profileIds?: string[]; modelIds?: string[]; traits?: string[];
    levels?: Level[]; factionIds?: string[];
  };
  cardImage?: string;          // si l'équipement a sa propre carte (sinon affiché inline)
}
```

### Grimoire et Sorts

```ts
interface Grimoire {
  id: "petit" | "grand";
  name: string;
  cost: number;               // 20 / 40
  pages: number | "illimite"; // 5 / illimité
}

interface Spell {
  id: string;
  name: string;
  kind: "generique" | "grimoire" | "reserve-profil";
  magicWayId?: string;        // pour les sorts de voie
  pages?: number;             // place occupée dans un grimoire
  cost?: number;              // Ko éventuel
  reservedTo?: { profileIds?: string[]; trait?: string }; // ex. « Réservé aux Filles de Nyx »
  target: string;             // verbatim
  cadence?: string;
  duration?: string;
  difficulties: { threshold: number; effectText: string }[]; // souvent 1 à 3
  cardImage?: string;          // les sorts ont souvent leur propre carte
}
```

> Sorts génériques : `cost = 0`, et nombre connu ≤ niveau du lanceur (contrainte au niveau de la liste).

### Montures (mode bataille)

```ts
interface Mount {
  id: string;
  name: string;
  type: "quagga" | "koelod" | "mochere";
  level: Level;
  cost: number;
  factionEligibility: string[]; // factions pouvant la recruter
  bonusesText: string;          // verbatim
  bonuses?: { pa?: number; v?: number; a?: number; c?: number; p?: number; pv?: number; allonge?: number; stature?: number };
  grantedSkills?: SkillRef[];
  specialActionsText?: string;  // ruade / piétinement, verbatim
  restrictions: Constraint[];   // niveau ±1 du cavalier, etc.
  cardImage?: string;
}

interface MountOption {        // caparaçon, lance de cavalerie, compétences achetables
  id: string;
  name: string;
  cost: number;
  effectsText: string;
  restrictions: Constraint[];
}
```

### Pactes et Ordres (mode bataille)

```ts
interface Pact {
  id: string;
  name: string;
  compositionText: string;    // conditions verbatim
  composition: Constraint[];  // encodage structuré (scope = ost)
  advantageText: string;      // verbatim
}

interface Order {
  id: string;
  name: string;
  cost: number;
  effectText: string;         // verbatim
  assignableTo: ("vassal" | "seigneur-de-guerre")[];
}
```

### Carte spéciale / de règle / de trait

Certains profils sont accompagnés d'une carte décrivant des règles spéciales liées à un
profil précis ou à un groupe (ex. « Xayìn & Muskh », « Fille de Nyx »). Elle est affichable,
peut porter un coût et des contraintes.

```ts
interface SpecialCard {
  id: string;
  name: string;
  cost: number;                                       // souvent 0
  scope: { profileIds?: string[]; trait?: string };   // « Réservée à Xayìn et Muskh » / « aux Filles de Nyx »
  // true : amélioration CHOISIE par le joueur (achat optionnel, appliquée via instance.specialCardIds).
  // absent/false : carte automatique appliquée d'office (ex. Fille de Nyx, Xayìn & Muskh).
  amelioration?: boolean;
  grantsCasting?: { magicWayIds: string[] };          // ex. Apprentie de Nyx → ostéomancie
  rulesText: RuleText[];                              // verbatim, fait foi
  constraints: Constraint[];                          // ex. Muskh requires-present Xayìn
  effects: Effect[];                                  // ex. Forgeronne déverrouille « Borax », Mathys octroie « apatride »
  cardImage: string;
}
```

## Couche 2 - Moteur de contraintes

Une contrainte est un objet déclaratif. Forme commune :

```ts
interface Constraint {
  id: string;
  type: ConstraintType;
  params: Record<string, unknown>;
  scope: "profil" | "fer-de-lance" | "ost";
  sourceText: string;         // wording officiel dont la contrainte est tirée (fait foi)
  severity: "error" | "warning";
  autoEnforced: boolean;      // false => simple note affichée à l'utilisateur (cas "custom")
}
```

### Types de contraintes prévus

```ts
type ConstraintType =
  | "limitation"              // déjà porté par Profile.limitation, mais peut être exprimé ici
  | "consumes-slot"           // LIM P : occupe un emplacement (modèle, niveau)
  | "requires-present"        // recrutable seulement si {profil|modèle|trait} présent
  | "attachment"              // rattachement à un porteur + capacité (ex. Likan -> Fang)
  | "forbids-equipment"       // interdit une catégorie/un type d'équipement (ex. Éprouvé)
  | "equipment-reserved"      // équipement réservé à faction/profil/niveau (ex. arc court -> niv I)
  | "count-relative"          // plafond relatif (ex. arme gratuite <= moitié du FdL)
  | "faction-membership"      // apatride / allié des X / sans-logo / Sceau GN (+coût)
  | "mount-eligibility"       // monture niveau ±1, exclusions (berserk, etc.)
  | "pact-composition"        // prédicats de composition d'un pacte
  | "mutual-exclusion"
  | "custom";                 // repli : texte affiché, non auto-vérifié
```

### Exemples encodés

**Larbin - « Éprouvé : ne peut être recruté avec une arme »**

```ts
{
  id: "kafala1-eprouve",
  type: "forbids-equipment",
  params: { categories: ["arme-cac", "arme-tir"] },
  scope: "profil",
  sourceText: "Éprouvé : ne peut être recruté avec une arme.",
  severity: "error",
  autoEnforced: true
}
```

**Likan (Aliéné) - rattaché à une femelle Fang, somme des niveaux ≤ niveau du porteur**

```ts
{
  id: "likan-attachment",
  type: "attachment",
  params: {
    carrier: { trait: "femelle-fang" },
    capacityRule: "sum(attached.level) <= carrier.level"
  },
  scope: "fer-de-lance",
  sourceText: "La somme des niveaux des Likans, qu'elles possèdent, ne peut pas excéder leur niveau.",
  severity: "error",
  autoEnforced: true
}
```

**LIM P - un personnage occupe l'emplacement d'un niveau du modèle**

```ts
{
  id: "engueran-consumes-paladin-3",
  type: "consumes-slot",
  params: { modelId: "paladin", level: 3 },
  scope: "fer-de-lance",
  sourceText: "Si je souhaite guerroyer avec Engueran (...), il prendra alors la place d'un des paladins niveau III.",
  severity: "error",
  autoEnforced: true
}
```

**Muskh - « ne peut pas être recruté sans Xayìn » (porté par la carte spéciale « Xayìn & Muskh »)**

```ts
{
  id: "muskh-requires-xayin",
  type: "requires-present",
  params: { profileId: "fangs-xayin" },
  scope: "fer-de-lance",
  sourceText: "Ce dernier ne peut pas être recruté sans Xayìn, ni posséder d'équipement.",
  severity: "error",
  autoEnforced: true
}
```

### Effets (modificateurs dynamiques)

À distinguer des contraintes :

- une **`Constraint`** *valide* la légalité (gate) ;
- un **`Effect`** *modifie* dynamiquement le coût, débloque des options, ou octroie une compétence/trait - souvent **à d'autres figurines** de la liste, **conditionnellement** à l'état de celle-ci.

Ces effets doivent être pris en compte par l'éditeur **au moment de la création de liste** (calcul du coût et validation).

```ts
interface Effect {
  id: string;
  source: { kind: "profile" | "special-card" | "mount" | "equipment"; id: string };
  scope: "fer-de-lance" | "ost";
  condition?: Selector;       // état requis (présence, comptage…). Absent = actif dès la source recrutée.
  target: Selector;           // cible (peut être self)
  operation: EffectOperation;
  optIn?: boolean;            // true = effet optionnel (choix du joueur), non appliqué d'office
                             //        (ex. réduction « garde du corps » : Djouked pour Broutcha)
  sourceText: string;         // verbatim, fait foi
  autoEnforced: boolean;
}

type EffectOperation =
  | { kind: "cost-delta"; amount: number }                              // Ogodeï : -10 sur les armes à 2 mains
  | { kind: "cost-set"; amount: number; maxCount?: number }             // 1 cible/source, plafonné par maxCount (ex. Larbins gratuits)
  | { kind: "unlock-upgrade"; upgradeId: string; perItemCost: number }  // Forgeronne : amélioration « Borax »
  | { kind: "grant-skill"; skillId: string }
  | { kind: "grant-trait"; trait: string }                             // Mathys : « apatride »
  | { kind: "cap"; value: number }
  | { kind: "stat-modifier"; stat: "v"|"p"|"a"|"c"|"t"|"i"|"stature"|"pa"|"pv"; amount: number | "level" } // Apprentie de Nyx : +niveau en I
  | { kind: "spell-pages"; amount: number };                           // Fille de Nyx +3 ; Crosse +3

// Appliqués par le moteur (src/core/engine) : cost-delta, cost-set, grant-trait, grant-skill,
// et spell-pages (capacité de pages, via engine/magic.ts). PAS ENCORE appliqués : stat-modifier,
// unlock-upgrade, cap - cf. le TODO en tête de engine/evaluate.ts.

interface Selector {
  self?: boolean;
  profileIds?: string[];
  modelIds?: string[];
  traits?: string[];          // ex. "guerrier-kherops", "frere-d-armes"
  factionIds?: string[];
  equipmentCategories?: Equipment["category"][];
  countAtLeast?: number;      // ex. ≥ 2 « frères d'armes »
}
```

Exemples (le `sourceText` porte le wording verbatim) :

- **Ogodeï** - « Paye 10 [Ko] de moins les armes à deux mains » → `cost-delta -10`, `target.self`, filtre armes à 2 mains.
- **Apathée / Fille de Nyx** - « recruter 1 Larbin sans en payer le coût (maximum 2 gratuits, sans dépasser la limitation totale de 5) » → `cost-set 0` **par Fille de Nyx présente** (1 chacune), `maxCount 2` comme plafond, cible `fangs-larbin-1`, en interaction avec sa LIM 5.
- **Forgeronne / Borax** - « 5 [Ko]/arme … 10 [Ko]/armure … confèrent … aux guerriers équipés » → `unlock-upgrade`, débloqué si Forgeronne présente, ciblant les « guerriers ».
- **Commandant** - « les guerriers khérops paient moins cher leurs armes » → `cost-delta`, cible `traits: ["guerrier-kherops"]` (wording à confirmer, carte non fournie).
- **Mathys / Frères d'Armes** - « Dès lors qu'ils sont au moins 2 frères d'armes dans un Fer de Lance, ils gagnent tous le trait apatride » → `grant-trait "apatride"`, `condition.countAtLeast 2` sur `traits: ["frere-d-armes"]`.

#### Ordre de résolution (moteur)

L'octroi d'un trait peut débloquer une autre règle (« apatride » change la validation de faction). Le moteur résout donc en phases, **jusqu'à un point fixe** (avec garde anti-cycle) :

1. collecte des effets actifs (source présente + condition remplie) ;
2. application des `grant-trait` / `grant-skill` (peut réactiver l'étape 1) ;
3. résolution des `unlock-upgrade` (options disponibles) ;
4. calcul des coûts (`cost-delta`, `cost-set` avec `maxCount`) dans un ordre défini ;
5. validation des `Constraint` en tenant compte des capacités octroyées.

## Couche 3 - Données utilisateur (liste portable)

### Document de liste

```ts
interface ListDocument {
  schemaVersion: string;      // version du format de liste
  catalogVersion: string;     // catalogue contre lequel la liste a été construite
  id: string;                 // uuid
  name: string;
  format: "escarmouche" | "bataille";
  pointsLimit?: number;
  createdAt: string;          // ISO
  updatedAt: string;

  fersDeLance: FerDeLance[];  // 1 en escarmouche, 3..5 en bataille
  ost?: {                     // mode bataille uniquement
    pactId?: string;
    pions?: number;           // 0..3
  };

  // Instantané dénormalisé pour la portabilité (rendu même si le catalogue du
  // destinataire a évolué). La validation est toujours rejouée contre son catalogue.
  snapshot: {
    totalCost: number;
    entries: { instanceId: string; displayName: string; cost: number }[];
  };
}

interface FerDeLance {
  id: string;
  name?: string;
  factionId: string;
  leaderInstanceId: string;
  members: ProfileInstance[];
}

interface ProfileInstance {
  instanceId: string;
  profileId: string;
  addedEquipmentIds: string[];
  removedBaseEquipmentIds: string[];
  spellIds: string[];
  grimoireId?: "petit" | "grand";
  munitions?: Record<string, number>; // quantité de munitions par arme de tir (sans recharge)
  mount?: {
    mountId: string;
    optionIds: string[];
  };
  attachedInstanceIds?: string[];  // ex. Likans rattachés à cette Fang
  bodyguardOfInstanceId?: string;  // occupe un emplacement « garde du corps » offert par une autre instance
  orderIds?: string[];             // ordres (Vassal/SDG, mode bataille)
  specialCardIds?: string[];       // cartes spéciales payantes sélectionnées (ex. « Apprentie de Nyx »)
  note?: string;
}
```

### Export, partage et import

Deux formats, **tous deux ré-importables** :

- **Texte (humain)** : format lisible **mais à grammaire définie** (en-tête nom/format/coût, puis une ligne par figurine avec ses options) - à la fois agréable à lire et **parsable**. À l'import, résolution par **nom** contre le catalogue local en best-effort ; toute ligne non résolue (nom modifié, catalogue différent) est **signalée à l'utilisateur pour correction manuelle** plutôt que rejetée.
- **Code/lien portable** : `ListDocument` sérialisé → compressé → encodé (base64url), partageable en fichier ou en lien (`#data=...`). Format de référence, sans ambiguïté (résolution par `id`).

**Ré-hydratation** (quel que soit le format) : on résout par `id` (code portable) ou par nom (texte) + `catalogVersion`. Si la version diffère, on prévient l'utilisateur, on s'appuie sur le `snapshot`/best-effort pour l'affichage, et on **rejoue la validation** contre le catalogue local.

## Affichage des cartes

L'application doit pouvoir **afficher l'image de la carte** pour les **profils, équipements et sorts** (ainsi que montures et cartes spéciales). Chaque entité affichable porte donc un `cardImage`. Cas particuliers :

- un équipement ou un sort peut être **inline** sur la carte d'un profil (pas d'image propre) **ou** exister comme **carte séparée** (`cardImage` renseigné) ;
- une **carte spéciale** (ex. « Xayìn & Muskh », « Fille de Nyx ») a toujours sa propre image ;
- une image de carte peut contenir **plusieurs profils empilés** (les 3 niveaux d'un modèle) : prévoir soit le recadrage par profil, soit l'affichage de l'image entière avec mise en évidence.

## Édition du catalogue (interface administrateur)

Une interface d'administration permet d'**éditer les profils et le catalogue** depuis le web :
corriger les erreurs d'import des cartes, et laisser des **utilisateurs non techniques** faire
évoluer le catalogue (nouvelles cartes, errata).

Implications :

- Le modèle de catalogue doit être **éditable champ par champ**, avec **validation de schéma** à la saisie, et édition **séparée** du `sourceText` verbatim et de son interprétation structurée.
- **Persistance, en deux temps** (cohérent avec l'archi local-first puis backend additif) :
  1. **v1 - éditeur local** : modifications en mémoire/navigateur, **exportées en JSON** (commit par un mainteneur). Pas de serveur.
  2. **plus tard - catalogue hébergé** : un backend stocke le catalogue et propage les évolutions à tous ; l'accès admin passe par l'**authentification** (rôle admin) prévue dans la couche additive.
- C'est la feature qui justifiera le plus probablement le passage à un backend ; le modèle versionné y est déjà préparé.

## Points ouverts / TODO

- Confirmer/compléter le champ `Armor` sur des cartes avec armure (non encore rencontrée).
- Décider du dictionnaire exact des `Trait` au fil de la transcription.
- Choisir la stratégie de compression du code portable (impacte la longueur des liens).
- Le calcul de coût (équipements ajoutés/retirés, surcoût Tembo, munitions, grimoire+sorts, monture+options, ordres, PIONs) sera spécifié comme fonction du cœur métier.
- **Budget de pages de sorts** = pages de grimoire + bonus (ex. Filles de Nyx : 3 pages sans grimoire, ou +3 sur un petit) ; capacité dérivée du profil et des cartes spéciales.
- **Surcharges issues du livre de bataille** : certains profils gagnent compétences/SDG non imprimés sur la carte (la FAQ précise que le livre de bataille prime). Prévoir un override de profil sourcé par les règles, distinct du contenu de carte.
- **Fiabilité de transcription** : certaines valeurs chiffrées (stats) sont peu lisibles sur les JPG ; les marquer « à vérifier » et s'appuyer sur l'interface admin pour validation humaine.
