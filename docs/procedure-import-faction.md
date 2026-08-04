# Procédure d'import d'une nouvelle faction

Guide opérationnel : la méthode pas à pas et surtout les **pièges récurrents** rencontrés lors
des imports (Tembos notamment). Complète, sans les dupliquer :

- `competences-bataille.md` : compétences octroyées par le livre de bataille (checklist par faction).
- `schema-donnees.md` : schéma de données complet des trois couches.
- `import.md` : points d'attention spécifiques à chaque faction déjà importée.

## Source et préparation

- La **source de vérité, ce sont les cartes** (images), pas le PDF. Les fichiers de carte sont dans
  `cards/<Faction>/`, même si l'extension n'est pas `.jpg` ce sont des images lisibles.
- Relire les **règles de bataille** de la faction avant de commencer, pour avoir en tête les
  mécaniques spécifiques (surcoûts, montures, cartes spéciales, natures d'amélioration).
- Repasser la **checklist `competences-bataille.md`** : appliquer Indépendant, Merci, Riposte,
  Seigneur de guerre, etc. aux profils concernés.

## Le piège numéro un : compétence vs trait

C'est la source d'erreur la plus fréquente. Deux notions distinctes, à ne pas confondre :

- **Trait** (`profile.traits`) : tag **interne**, mécanique, **jamais imprimé** sur la carte.
  Sert à l'appartenance de faction, aux réservations (`reservedTo.traits`), aux portées de cartes,
  aux effets `grant-trait`, etc.
- **Compétence** (`profile.skills` + entrée du dictionnaire `catalog.skills`) : mot-clé **affiché**
  sur la carte (chip).

Un mot-clé de faction imprimé sur la carte (ex. **Tembo**, **Khémiste**, **Apatride**) qui a aussi
un rôle mécanique doit exister **en double** :

- une **compétence** dans `catalog.skills` (`{ id, keyword, hasValue: false, sourceText }`) et un
  `skillRef` (`{ skillId }`) en tête de `profile.skills` de chaque profil concerné, pour l'affichage ;
- un **trait** dans `profile.traits` pour la mécanique.

Symptôme d'un oubli : « le profil a perdu sa compétence Khémiste à l'import » = le trait existe mais
la compétence homonyme manque, donc le mot-clé ne s'affiche nulle part.

## Un « mot-clé » de carte : compétence, objet, ou verbatim ?

Toutes les lignes listées sur une carte de profil ne sont pas des compétences. Avant d'inventer une
entrée de dictionnaire, se poser la question dans cet ordre (retours d'expérience Guilde Noire) :

- **Compétence connue** (déjà dans `catalog.skills`, ou générique du livret) : réutiliser l'`id`
  existant. Toujours réconcilier contre le dictionnaire avant de créer (recherche normalisée sur le
  mot-clé) - beaucoup existent déjà.
- **Objet** : une ligne sans description qui nomme un équipement/artefact (ex. « Cape d'ombre »,
  « Rossignol », « Bourse bien remplie », « Amulette du culte », « Ruse du pleutre », « Ombre »)
  n'est **pas** une compétence : c'est un **objet** (`equipment`, catégorie `objet`), à mettre dans
  `baseEquipmentIds`. Si le détail manque, créer un **placeholder** (`cost: 0`, `effectsText: ""`) à
  compléter en admin. **Vérifier d'abord s'il existe déjà** (ex. « Peintures de guerre » existait
  déjà en base - ne rien recréer, juste le référencer dans `baseEquipmentIds`).
- **Capacité verbatim** : une ligne **nommée + décrite** propre à la carte, non générique (ex.
  « Lâche : possède 2 PIONS… », « Allégeance : s'active en même temps que le leader », « Jumeaux :
  tant que… », « Peut piller ») va en **texte verbatim** dans `profile.rules`, **pas** dans le
  dictionnaire. Format : `{ label: "<nom court>", text: "<description>" }` - le nom dans `label`, la
  description dans `text` (ne pas tout mettre dans `label` avec un `text` vide).

En cas de doute entre « compétence à valeur » et « objet/verbatim », préférer verbatim : c'est
réversible et n'introduit pas de fausse entrée de dictionnaire réutilisée ailleurs par erreur.

Autres points relevés à l'import (à garder en tête) :

- Le mot-clé de faction en compétence (`frere-d-armes`, `tembo`…) se place plutôt **en fin** de la
  liste `skills` du profil (avant la compétence de magie s'il y en a une), pas forcément en tête.
- `carnivore` / `herbivore` : ce n'est **pas** un trait à poser, c'est une propriété du peuple
  (`faction.nature`) héritée via le **peuple d'origine** - cf. la section dédiée plus bas.
- Indicateur de dé d'incantation sur une carte (ligne « 0-5-1 » etc.) = le profil est **lanceur** :
  penser à la compétence de magie / `affinite` correspondante.
- Convention confirmée : **flaguer toutes les stats** (`stats.*` + `stature` + `masteryDice` +
  `baseEquipmentIds`) en `unverifiedFields` - l'utilisateur en corrige régulièrement plusieurs
  (stature et une carac ou deux) à la relecture.

## Traits lus « en dur » par le moteur

Certains traits ne sont pas exprimés par une contrainte/effet du catalogue : ils sont **codés en dur**
dans le moteur. Il faut alors les déclarer dans `BUILTIN_TRAIT_USAGE` (`src/ui/explain.ts`), sinon
l'admin affiche « tag interne, non référencé par une règle » alors qu'ils **sont** actifs.

Traits hardcodés connus à ce jour :

- `tembo` : surcoût d'équipement Tembo (`evaluate.ts` `temboEquipmentSurcharge`).

Si un nouvel import introduit un comportement moteur attaché à un trait, ajouter une ligne dans
`BUILTIN_TRAIT_USAGE` en même temps que le code moteur.

## Peuple d'origine (`profile.origin`)

Les factions « creuset » (Guilde Noire, Affranchis) rassemblent des transfuges. Ce qu'ils gardent de
leur peuple est **énuméré** par la FAQ, et rien d'autre :

- la **monture** de ce peuple (`isMountEligible` lit `originFactionId(profile)` = `origin` sinon
  `factionId`), pour les deux creusets ;
- sa **nature** carnivore / herbivore, **chez les Affranchis seulement** : « ils respectent leur
  nature profonde d'herbivore ou de carnivore sans restrictions » (p.47). Les figurines de la Guilde
  Noire, elles, « ne sont pas intrinsèquement représentantes de leur espèce d'origine » (FAQ) et
  n'en ont donc aucune. Rien ne la déduit automatiquement : à l'import, poser la **compétence**
  `carnivore` sur les profils affranchis dont le peuple d'origine a `faction.nature: "carnivore"`
  (khârns, fangs).

Pas les objets, pas les sorts, pas les compétences réservés. Conséquences pratiques :

- Renseigner `origin` sur **chaque** profil de ces factions (menu « Peuple d'origine » dans la fiche
  admin) ; la nature du peuple se règle dans **Factions → Peuples**. Vide = originaire de sa
  propre faction, ce qui est le cas général ailleurs.
- Une faction creuset n'a **pas** à figurer dans la `factionEligibility` d'une monture : ses membres
  y entrent par leur origine (`guilde-noire` et `affranchis` ont été retirés du Quagga).
- Une origine sans monture se déclare quand même (les Fangs n'en ont pas) : c'est le fait qui compte,
  pas sa conséquence. C'est ce que l'ancien trait `monture-<faction>` ne savait pas dire ; il est
  replié sur `origin` par `migrateCatalog`.
- Le Berserker reste sans monture quoi qu'il arrive (compétence `berserk`, testée à part).
- Quand une carte vise une origine (« les Affranchis **khérops** dans son aura »), c'est `origin`
  qu'il faut lire, pas la faction.

### Origine choisie au recrutement

Certaines cartes ne fixent pas l'origine, elles la laissent au joueur : l'**Agent sombre** est un
infiltré « recruté dans tous les royaumes », un seul profil pour cinq provenances possibles, dont
dépend sa monture. On ne duplique pas le profil par peuple.

- `Profile.originChoices` (liste explicite de peuples) déclare le choix ; il exclut `origin`. Dans
  l'admin, c'est l'option **« — choisie au recrutement — »** du menu « Peuple d'origine » qui fait
  apparaître la liste des peuples proposés.
- `ProfileInstance.origin` porte la réponse, figurine par figurine. C'est le **seul trait d'identité**
  que le joueur décide : tout le reste du document de liste n'est qu'achats et liaisons.
- Le moteur lit `effectiveOrigin(profile, instance)`, qui ignore un choix hors liste (import, liste
  écrite à la main). `validateChosenOrigin` réclame l'origine manquante.
- Le constructeur pose la question **aux deux entrées du recrutement** : la modale de niveau et
  l'aperçu de carte. Ensuite, une puce sur la ligne permet d'en changer - le store retire alors la
  monture que le nouveau peuple ne permet plus.

## Recrutement ouvert (`faction.openRecruitment`)

Une faction peut accueillir **les génériques** (limitation « X ») d'autres peuples, sans « Allié des
X » ni sceau : c'est la règle des Affranchis (p.46). Décrite **une fois sur la faction**, jamais en
contrainte sur chaque profil accueilli - sans quoi tout nouveau générique importé serait muet sur son
accès. Éditable dans **Factions → Recrutement entre peuples**.

- `fromFactionIds` : les peuples accueillis. `excludeTraits` / `excludeProfileIds` : les refus.
  `caps` : les plafonds par Fer de Lance (« pas plus d'un shaman goûn »), qui ne s'appliquent qu'aux
  figurines **entrées par cette porte**.
- Un refus est un **veto** (`openRecruitmentRefuses`) : il bat toutes les autres voies d'accès, sceau
  compris. Sans quoi la figurine qu'on vient d'écarter rentrerait par la porte de derrière - c'est
  ainsi que Khalsa, personnage de la Guilde Noire, arrivait chez les Affranchis alors qu'elle y a son
  propre profil. Le veto ne vaut que pour les peuples listés en `fromFactionIds`.
- Le filtre « générique » est dans le moteur (`isGeneric`), pas en donnée : c'est la définition même
  du mot.
- Côté équipement, `equipmentAllowedIn` retire au transfuge les objets **réservés à une faction**
  autre que celle qui l'accueille. Les autres réservations (profil, modèle, trait, niveau) sont
  intactes : sa propre arme de signature lui reste.
- Côté roster, ces recrues ont leur section (« Peuples ralliés ») : les mêler aux quelques
  « Allié des X » rendrait les deux illisibles.

## Cartes portées par la bannière

`SpecialCard.scope.ferDeLanceFactionIds` : la carte suit le **Fer de Lance**, pas la carte de profil.
C'est ce que demande « toutes les figurines qui combattent sous la bannière des Affranchis
bénéficient des effets comme une seule et même faction, que leurs cartes soient affranchies ou non ».
Deux réglages l'accompagnent :

- `scope.nonNativeOnly` : ne vise que les recrues venues d'ailleurs (ce que la faction d'accueil
  **apprend**, et qu'elle sait déjà) ;
- `costPerLevel` : prix multiplié par le niveau (« 5 Ko x son niveau »). À ne pas confondre avec
  `perLevelStack`, qui laisse le joueur choisir une quantité.

`specialCardsForProfile(profile, cat, fdlFactionId)` ne révèle ces cartes que si on lui passe la
faction d'accueil : l'admin ne la connaît pas, le constructeur si.

## Compétences lues « en dur » par le moteur

Quand la carte **affiche** une compétence, c'est elle que le moteur lit : pas de trait jumeau à
poser en plus, et les effets qui l'octroient emploient `grant-skill`.

- `apatride` : recrutable dans n'importe quelle faction (`recruitment.ts` `isApatride`, utilisé par
  `validateFactionMembership` et par le roster du constructeur). Octroyée par le Sceau de la Guilde
  Noire et par la carte « Frères d'Armes » (≥ 2 réunis).
- `affinite` (à valeur, ex. « Shamanisme ») : ouvre au grimoire les sorts d'une école
  supplémentaire (`magic.ts` `affinityWays`). Sans valeur, elle n'ouvre rien.
- `archimage` : maîtrise toutes les écoles et suffit à faire un lanceur (`magic.ts` `castWays`).

## Surcoût d'équipement et `reservedTo`

- Le surcoût Tembo est **paramétrable** dans `catalog.settings.temboEquipmentSurcharge`
  (`{ per, amount }`) et éditable dans **Réglages** de l'admin. Il s'applique par objet **ajouté**,
  aux figurines portant le trait `tembo`, sur `Math.floor(cost / per) * amount`.
- `reservedOk` (moteur et builder) est un **ET logique** sur toutes les dimensions fournies
  (`profileIds`, `traits`, `modelIds`, `levels`, `factionIds`). Ajouter une dimension **restreint**,
  n'élargit pas.
- Une arme **exclusive à une faction dont le prix carte inclut déjà la majoration** doit porter le
  marqueur `reservedTo.traits: ["<faction>"]` (ex. `["tembo"]`), sinon le moteur lui applique le
  surcoût en double. Le marqueur peut coexister avec `profileIds` (l'ET reste vrai si les profils
  visés ont bien le trait). Exemples Tembos : Khépesh, Tonfa, Godille-moringa.

## `unverifiedFields` et flags « à vérifier »

Chaque champ marqué à vérifier alimente le ⚠ de la sidebar admin. **Règle absolue :** ne mettre dans
`unverifiedFields` que des chemins **granulaires possédant un toggle** dans `ProfileDetail.tsx`.
Jamais un nom de groupe brut comme `"stats"` : aucun `FlagButton` ne le reconnaît, donc il est
**invisible et impossible à effacer** (⚠ perpétuel dans la sidebar sans flag visible dans le détail).

Chemins effaçables (existence d'un `FlagButton`) :

- stats : `stats.v`, `stats.p`, `stats.a`, `stats.c`, `stats.t`, `stats.i`, `stature`, `pa`, `pv`
  (agrégés par le chip « à vérifier (groupé) »).
- `masteryDice`.
- `armor` : **un seul** chemin pour toute l'armure innée. Elle se lit d'un bloc sur la carte
  (« -1 / 7 / -2 » + durabilité) et aucune de ses valeurs ne se vérifie séparément. Les anciens
  chemins par valeur (`armor.seuil`…) sont repliés dessus par `migrateCatalog`.
- `baseEquipmentIds`.

`baseSize` n'est **pas** flaguable (pas de bouton) : il est absent de beaucoup de cartes, un champ
vide n'y est donc pas un oubli.

Si un nouveau champ doit pouvoir être « à vérifier », **ajouter d'abord son `FlagButton`** dans
`ProfileDetail.tsx` avant de l'utiliser dans les données. Audit rapide de non-régression : vérifier
qu'aucun `unverifiedFields` ne contient un token hors de cette liste.

## Magie (grimoires, sorts, pages)

- **Un seul grimoire par magicien**, dédié à une école ; Affinité / Archimage **élargissent le même
  grimoire**, ils n'en ajoutent pas un second.
- Petit grimoire = 20 Ko / 5 pages ; grand grimoire = 40 Ko / pages illimitées.
- Un effet `spell-pages` peut cibler une école précise via `magicWayId` : cela crée un **pool de
  pages dédié** (ex. Brassards d'Euthéria : 5 pages Adansonia). L'allocation remplit d'abord les pools
  dédiés, **de façon atomique** (les pages d'un sort ne se scindent jamais entre un pool et le grimoire
  général : voir `maxPagesInPool` / `pageAllocation` dans `magic.ts`).
- Affinité X ouvre au grimoire les sorts d'une école supplémentaire (`affinityWays`).
- **Archimage** ouvre **toutes** les écoles (`castWays`) : la compétence se suffit à elle-même, un
  archimage est lanceur même sans compétence d'école. Elle s'octroie comme n'importe quelle
  compétence (`grant-skill`, ex. « Grimoire de Josève ») ; pas de trait à poser en plus.

## Workflow admin : le piège du brouillon local

L'admin travaille sur un **brouillon** conservé dans le navigateur (localStorage
`kharn-admin-catalog-v1`) qui **masque `catalog.json`** tant qu'on ne le remplace pas explicitement.
Les actions de la barre latérale :

- **Publier** : met le brouillon en ligne (nouvelle version du catalogue pour les joueurs).
- **Enregistrer** (dev seulement) : **écrit** le brouillon dans `catalog.json` du dépôt.
- **Repartir du fichier** (dev seulement) : jette le brouillon et réédite le `catalog.json` du dépôt.
- **Repartir de la version publiée** (dev seulement) : jette le brouillon et réédite la version en
  ligne.

Conséquences, pour ne pas perdre de travail :

- Après une modification de `catalog.json` sur disque (script d'import…), il faut
  **« Repartir du fichier »** pour la voir dans l'admin.
- Si on édite puis **« Enregistrer »** *avant* d'avoir repris le fichier, on réécrase le disque avec
  le brouillon et on **perd** les modifications du script. Ordre sûr : Repartir du fichier ->
  vérifier -> éditer -> Enregistrer.
- Une modification de **code** (composant React) prend effet au simple rechargement de page, elle
  n'est pas masquée par le brouillon.

## Textes verbatim : blocs ou texte simple ?

Deux formes, et une seule bonne raison de choisir l'une ou l'autre :

- **Blocs `RuleText` (`{label?, text}`)** : réservés aux **fiches de figurine** - `profile.rules` et
  `mount.rules`. Une fiche énumère des capacités **nommées** (« Fricot : … », « Vorace : … ») et
  l'étiquette se rend en gras, comme sur la carte imprimée.
- **Texte simple** : partout ailleurs - `specialCard.rulesText`, `equipment.effectsText`,
  `skill.sourceText`, les textes de sort. Ce sont des paragraphes suivis, sans capacité nommée.

Les **retours à la ligne sont rendus tels quels** (`white-space: pre-line`), lignes vides comprises :
c'est ainsi qu'on sépare deux paragraphes dans un champ unique. Inutile donc de découper un texte en
plusieurs entrées pour l'aérer. Les blancs de **bord** sont retirés à la lecture (`migrateCatalog`),
et `pre-line` écrase les espaces surnuméraires : rien à nettoyer à la main.

Le texte d'une carte spéciale s'écrivait autrefois en blocs, par emprunt au modèle des profils.
Personne n'en avait l'usage - l'étiquette n'était ni saisissable ni affichée, et l'éditeur l'effaçait
à la première frappe. `migrateCatalog` replie ces blocs en un seul texte, séparés par une ligne vide.

## Conventions d'édition de `catalog.json`

- Le fichier est écrit exactement comme `JSON.stringify(obj, null, 2) + "\n"`.
- Éditer via de **petits scripts Node** plutôt qu'à la main : lire, muter, réécrire avec le format
  ci-dessus. Rendre les scripts **idempotents** (tester la présence avant d'ajouter) pour pouvoir les
  rejouer sans doublon.
- Les **portraits** ne sont pas dans `catalog.json` : les trois emplacements qui en portent un
  (`icons`, `profiles[].icon`, `mounts[].icon`) ne contiennent qu'une **référence** `<hash>.webp`.
  Les fichiers vivent dans `src/assets/icons/` (miroir committé, précaché, valable hors-ligne) et
  dans le bucket Supabase `catalog-icons` (alimenté par l'éditeur d'icône de l'admin).
- Ne jamais écrire une data-URI à la main dans le catalogue : passer par l'éditeur d'icône, puis
  par « Enregistrer » en dev, qui matérialise le fichier manquant dans le miroir (cf. `freezeIcons`).
  Un test verrouille l'invariant « toute référence du catalogue est présente dans le miroir ».

## Checklist de validation avant commit

À exécuter systématiquement :

- `node -e '...JSON.parse(catalog.json)...'` : le JSON est valide.
- Parse Zod : `CatalogSchema.safeParse(cat).success === true`.
- `npx tsc --noEmit` : pas d'erreur de type.
- `npx vitest run` : toute la suite passe.
- Vérifier que le diff n'est **qu'ajout** (rien d'existant modifié involontairement) quand l'import
  ne fait qu'ajouter des références.
