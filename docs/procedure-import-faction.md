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
- `carnivore` / `herbivore` : **suivre la FAQ**. Les figurines **Guilde Noire ne sont ni carnivore
  ni herbivore** (elles n'héritent pas de l'espèce d'origine) - ne pas leur mettre ces traits.
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

- `apatride` : recrutable dans le fer-de-lance de n'importe quelle faction
  (`evaluate.ts` `validateFactionMembership`, `shared.ts`, `BuilderScreen.tsx`).
- `tembo` : surcoût d'équipement Tembo (`evaluate.ts` `temboEquipmentSurcharge`).
- `monture-<faction>` : **origine « montures uniquement »**. Les figurines des factions
  « creuset » (Guilde Noire, Affranchis) gardent l'accès à la **monture de leur peuple d'origine**
  (mais **pas** à ses objets/sorts réservés - FAQ). `isMountEligible` accepte un profil si la
  `factionEligibility` d'un type de monture contient sa `factionId` **ou** un trait `monture-<f>`.
  À poser sur chaque profil de ces factions selon son origine (ex. un membre GN d'origine khéropse
  → `monture-kherops` → Kœlod ; origine fang → aucun trait, les Fangs n'ont pas de monture ;
  Berserker → aucune monture quoi qu'il arrive). Ne pas confondre avec la faction du profil : pour
  ces factions, retirer leur `factionId` de la `factionEligibility` des montures (fait pour le
  Quagga vs `guilde-noire`) et tout passer par le trait. Garder l'origine en clair dans
  `profile.notes`.

Si un nouvel import introduit un comportement moteur attaché à un trait, ajouter une ligne dans
`BUILTIN_TRAIT_USAGE` en même temps que le code moteur.

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
- armure : `armor.protectionEchec`, `armor.seuil`, `armor.protectionReussite`, `armor.durability`.
- `baseEquipmentIds`.

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

## Workflow admin : le piège du localStorage

L'admin travaille sur une copie **localStorage** (`kharn-admin-catalog-v1`) qui **masque
`catalog.json`** jusqu'à un **« Réinit. »**. « Exporter JSON » **écrase** `catalog.json` avec le
localStorage.

Conséquences, pour ne pas perdre de travail :

- Après une modification de `catalog.json` sur disque, l'utilisateur doit faire **« Réinit. »** pour
  la voir dans l'admin.
- S'il réédite/exporte **avant** de recharger, il réécrase le disque avec sa version localStorage et
  **perd** les modifications faites sur `catalog.json`. Ordre sûr : Réinit -> vérifier -> éditer ->
  Exporter.
- Une modification de **code** (composant React) prend effet au simple rechargement de page, elle
  n'est pas masquée par le localStorage.

## Conventions d'édition de `catalog.json`

- Le fichier est écrit exactement comme `JSON.stringify(obj, null, 2) + "\n"`.
- Éditer via de **petits scripts Node** plutôt qu'à la main : lire, muter, réécrire avec le format
  ci-dessus. Rendre les scripts **idempotents** (tester la présence avant d'ajouter) pour pouvoir les
  rejouer sans doublon.
- Les **images de carte** sont inlinées en `data:` base64 dans `catalog.json` (`icons`, `profiles`,
  `mounts`) : c'est le fonctionnement normal du projet, les gros blobs base64 sont attendus.

## Checklist de validation avant commit

À exécuter systématiquement :

- `node -e '...JSON.parse(catalog.json)...'` : le JSON est valide.
- Parse Zod : `CatalogSchema.safeParse(cat).success === true`.
- `npx tsc --noEmit` : pas d'erreur de type.
- `npx vitest run` : toute la suite passe.
- Vérifier que le diff n'est **qu'ajout** (rien d'existant modifié involontairement) quand l'import
  ne fait qu'ajouter des références.
