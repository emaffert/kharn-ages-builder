# Khârn-Âges — Règles de création de liste

Synthèse issue du corpus de règles (livret de base, règles de bataille saison 2, FAQ jan. 2026).
Sert de référence pour le moteur de construction de liste de l'application.

## Sources et hiérarchie

- **Livret de règles de base** : règles fondamentales.
- **Règles de bataille (saison 2)** : couche avancée (Osts, Pactes, Montures, Aliénés, Tembos/Khémistes, Affranchis). N'entre pas en contradiction avec la base, elle complète.
- **FAQ (jan. 2026)** : corrections et précisions. **Fait foi en cas de litige.**

En jeu, l'ordre de priorité est : **scénario > cartes de jeu > règles de base**.

## Concepts clés

- **Kouronne (Ko)** : unité de valeur/coût. La valeur totale d'une liste = somme des coûts (figurines + armes + équipements + cartes + grimoires/sorts payants + options + montures + ordres + PIONs).
- **Fer de Lance (FdL)** : la bande de base (format escarmouche).
- **Ost / Host** : regroupement de 3 à 5 Fers de Lance (format bataille).
- **Niveau** (I / II / III) : reflète l'expérience ; détermine le nombre de D10 lancés (1/2/3) et le nombre de dés de maîtrise.

## Les deux formats

### Escarmouche

- Unité : 1 Fer de Lance.
- Format : 300 Ko (starter), 400+ Ko conseillé, sinon libre entre joueurs.

### Bataille

- Unité : 1 Ost = 3 à 5 Fers de Lance de 300 à 600 Ko chacun.
- Valeur d'Ost typique : 900 à 3000 Ko.
- Un Fer de Lance ne peut pas dépasser la **moitié** de la valeur totale de l'Ost.
- Les Fers de Lance d'un Ost peuvent avoir des valeurs différentes et non rondes.

## Factions

Appartenances identifiées par un **logo de faction** :

- Khârns
- Goûns (sous-types : Dogons, Mongos)
- Khérops
- Fangs
- Tembos / Khémistes (même faction, même logo)
- Guilde Noire
- Affranchis

Règles :

- Un Fer de Lance se compose d'une **unique faction** (règle de base).
- Les **profils sans logo** sont recrutables par n'importe quel Fer de Lance.

### Exceptions de recrutement inter-factions

- **Apatride** (trait carte) : recrutable par toutes les factions.
- **Allié des X** (trait carte) : recrutable par la faction X ou sa faction d'origine.
- **Guilde Noire** :
  - peut rejoindre sa faction d'origine sans surcoût ;
  - peut rejoindre une autre faction via la carte **Sceau de la Guilde Noire** (+10 Ko) ;
  - les figurines GN ne sont ni carnivores ni herbivores et n'ont pas accès aux équipements/sorts réservés à leur espèce d'origine.

## Le profil (carte de figurine)

Données portées par une carte (vérifié sur la carte « Larbin », Fang niveau I) :

- Nom, faction (logo), niveau (I/II/III), concept visuel, identifiant de carte.
- **Coût** en Ko.
- **Limitation** (voir ci-dessous).
- Caractéristiques : **V, P, A, C, T, I**.
- **Stature** (0 à 6).
- **PA** (points d'action), **PV** (points de vie).
- **Armure** éventuelle.
- **Compétences** (mots-clés + règles spécifiques en texte libre).
- **Équipement de base** (coût déjà inclus dans le coût du profil).
- **Dés de maîtrise** (5 domaines).

Une même figurine peut exister en plusieurs profils (niveaux différents → coûts différents).

## Limitations de recrutement

- **LIM X** : jusqu'à X exemplaires du même profil.
- **LIM U** : unique (1 seul exemplaire).
- **LIM P** (Personnage) : unique **et** occupe l'un des emplacements autorisés par les autres limitations du même nom.
- En mode Bataille : LIM X et LIM U s'appliquent **par Fer de Lance** ; LIM P s'applique à **l'Ost entier**.

### Restrictions spécifiques (texte libre par carte)

Au-delà des limitations standard, chaque carte peut porter une restriction propre. Le moteur doit pouvoir les exprimer de façon déclarative et extensible. Exemples rencontrés :

- **Éprouvé** (Larbin) : ne peut pas être recruté avec une arme.
- **Likan (Aliéné)** : recrutable uniquement lié à une femelle Fang ; somme des niveaux des Likans ≤ niveau de la Fang.
- Figurine recrutable seulement si une autre figurine précise est présente dans le Fer de Lance (dépendance).

Types de contraintes à prévoir : exclusion d'équipement, dépendance de présence, lien/rattachement à un porteur, plafond conditionnel, et un type `custom` en repli.

## Le leader

- Désigné parmi les **deux plus hauts niveaux** du Fer de Lance, ou parmi les personnages.
- En Bataille : chaque FdL a un **Vassal** (leader local) ; l'Ost a un **Seigneur de Guerre** (SDG).

## Équipement

- Chaque profil a un **équipement de base** dont le coût est déjà inclus (affiché en négatif sur la carte). Le retirer **baisse** le coût total ; ajouter d'autres équipements ajoute leur coût.
- **Mains** : 1 arme à 2 mains, ou 2 armes/bouclier à 1 main (sauf compétence « Hors-norme »).
- **Arme gratuite** :
  - 1 seule par Safar ;
  - au plus la moitié du Fer de Lance peut porter la même arme gratuite ;
  - une arme gratuite déjà inscrite sur la carte n'entre pas dans ce maximum.
- **Arc court** : réservé au niveau I (ou aux profils qui l'ont d'office).
- **Munitions** (arcs/arbalètes sans recharge) : quantités achetables (coût additionnel).
- **Armes à recharge** : munitions illimitées.
- **Tembos** : surcoût d'équipement de +3 Ko par tranche complète de 10 Ko (déjà compté sur les cartes au logo Tembo).
- **Affranchis** : pas d'accès aux équipements/compétences réservés à la faction d'origine.

## Magie

- **Sorts génériques** : gratuits ; un mage en connaît autant que son niveau.
- **Grimoires** (coût ajouté au recrutement du mage) :
  - petit grimoire : 20 Ko, 5 pages ;
  - grand grimoire : 40 Ko, pages illimitées.
- **Sorts de grimoire** : coût en Ko + occupent un nombre de **pages** ; réservés à la **voie de magie** maîtrisée.
- **Voies de magie** par faction : Ostéomancie (Fangs), Shamanisme (Goûns), Le Sang et l'Acier (Khârns), Sacrifice (Khérops), Adansonia (Tembos/Khémistes).
- Compétences liées : **Affinité (voie X)**, **Archimage** (toutes les voies).

## Montures et Cavaliers (Bataille)

- Traitées comme un **équipement incessible**, recrutées avec le cavalier.
- Niveau de la monture : **±1** par rapport au cavalier.
- Catalogue (coûts par niveau I / II / III) :
  - Quaggas : 30 / 45 / 70 Ko (Khârns, Guilde Noire, Affranchis hors khérops/fang, Clan de Vortig).
  - Kœlods : 45 / 60 / 90 Ko (Khérops).
  - Mochères : 25 / 45 / 65 Ko (Goûns).
- Options achetables : caparaçon, lance de cavalerie, compétences (Brutalité, Autorité, Endurance, etc.) avec restrictions de faction.
- Restrictions : Berserk → pas de monture ; Embuscade / Endurance inutilisables montés ; etc.

## Aliénés (Bataille)

- **Likans** recrutés par les femelles Fangs ; somme des niveaux des Likans ≤ niveau de la Fang.
- Coûts : 25 / 35 / 50 Ko (niveaux I / II / III).

## Mode Bataille — éléments de liste additionnels

- **Pactes** (1 seul par Ost), chacun avec conditions de composition + avantage : Alliance (Goûns/Tembos), Ost des plaines (Dogons), Ost des Affranchis, Ordre de l'Acier, Maison Claire, Ost impérial, Guilde en mission, Ost de la Horde, Ost d'Euthéria.
- **PIONs** : achat de 1 à 3, coût incrémental 5 / 10 / 15 Ko ; possible uniquement si l'Ost est en infériorité numérique **et** de niveau ; jamais plus que le nombre d'activations adverses.
- **Ordres** : « équipements » pour Vassaux/SDG, coût en Ko (intégré au « barda » de l'Ost).
- **Formations** : optionnelles, **sans coût** (choix tactique en cours de partie, non pertinent pour la construction de liste).

## Faction des Affranchis (Bataille)

- Peut comporter n'importe quel **générique** (non personnage, non unique) des factions khârne, khéropse, goûne, fang et Guilde Noire, avec restrictions :
  - aucun fidèle/frère/membre de l'Ordre du Sang et de l'Acier (Khârns) ;
  - aucune femelle Fang ;
  - shamans goûns niveau I uniquement, max 1 par FdL ;
  - prêtres du sacrifice khérops niveau I uniquement, max 1 par FdL ;
  - Guilde Noire : génériques non uniques uniquement.
- Profils « Affranchis » par nature : non recrutables par une autre faction.
- Un combattant non « affranchi » peut acquérir « Éclaireur 2 » + « Rusé » pour 5 Ko × son niveau.

## Point ouvert : le catalogue de profils

Le corpus décrit le **moteur de construction**, pas le **catalogue complet** des profils (stats, coûts, compétences, équipements). Ces données vivent sur les **cartes de profil**.

État actuel : cartes disponibles au format **image uniquement** (`./cards`). Elles sont transcriptibles en données structurées par lecture d'image. C'est la principale donnée à constituer pour rendre l'application fonctionnelle.

Ordre de grandeur : ~15 profils par faction ; certains personnages n'ont qu'une version, d'autres modèles jusqu'à 3 versions (niveaux I/II/III). Gabarit commun, mais certaines images regroupent les 3 versions empilées verticalement.

### Fidélité du wording (impératif)

Le **wording exact** des règles inscrites sur les cartes **fait foi** en cas de conflit d'interprétation. Lors de la transcription :

- conserver le texte des règles **verbatim**, sans reformulation ni correction ;
- dans le modèle de données, séparer le **texte officiel** (champ intouchable, source de vérité) de toute **interprétation structurée** dérivée (encodage pour le moteur de contraintes), qui ne fait jamais foi.
