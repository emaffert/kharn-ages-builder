# Compétences ajoutées par le livre « Règles de bataille »

Le livre de bataille **octroie des compétences à certains profils**, qui ne sont pas (toujours)
imprimées sur les cartes antérieures. La FAQ précise : *« les ajouts de compétences dans le
livre de règles de bataille prennent le pas sur les cartes de profil originales »*.

**Checklist à appliquer à chaque faction importée.**

> **État vérifié contre `src/data/catalog.json` v0.5.0 le 2026-08-04.** Les cases cochées ont été
> relues dans les données, pas seulement dans cette page. Les écarts restants sont listés en fin de
> document.

## Ambidextre

Un Safar maniant une arme dans chaque main peut, lors d'une attaque à 3 PA, faire deux attaques à
2 PA successives. S'il possède une arme maniable à 1 **et** 2 mains, il gagne « Riposte » quand il
la manie à 2 mains.

- Khârns : les **Avant-gardes**. - ✅ (I/II/III)
- Fangs : **Broutcha**. - ✅

## Furtivité

Augmente le bonus de couvert d'une valeur égale au niveau. Le livre ne l'attribue à personne : elle
n'arrive que par les cartes. Présente sur 6 profils au catalogue.

## Indépendant

Tous les **personnages nommés**, sauf Key le Sénéchal et Kharl VI (Khârns) et **Muskh** (Fangs)
« entre autres » : **le livret laisse explicitement la liste des exceptions ouverte**, donc un
personnage nommé sans Indépendant n'est pas un oubli tant que sa carte ne le porte pas. C'est la
carte qui tranche, pas cette règle générale.

Muskh porte bien « Indépendant » sur sa carte : l'exception du livret signifie seulement qu'il ne le
lui *ajoute* pas. Rien à corriger.

En jeu : les Safars d'un Fer de Lance dont le leader est **en embuscade** gagnent « Indépendant »
tant qu'il n'est pas physiquement présent sur le terrain.

Plus :

- Khârns : les **Avant-gardes**. - ✅ (I/II/III)
- Khérops : les **Berserkers**. - ✅ (seul le niveau II existe au catalogue)
- Fangs : les **Exécuteurs**. - ✅ (I/II/III, Apathée, Broutcha, Xayìn ; Muskh/Djouked l'ont d'office
  sur leur carte, l'exception du livre signifie seulement qu'il ne le leur *ajoute* pas)
- Goûns : les **éclaireurs mongo**. - ✅ (I/II/III)

Personnages nommés : 27 des 31 profils à limitation « P » l'ont. Key est correctement exclu et
Kharl VI n'existe pas au catalogue ; les trois autres sans Indépendant relèvent de la clause « entre
autres » ci-dessus, à confirmer sur leur carte si le doute revient.

## Merci

- Khârns : le Prince, Engueran, les Paladins. - ✅ (Paladins II/III et Paladins cavaliers II/III,
  Gaubert aussi)
- Goûns : le Père de Famille. - ✅ (II/III)
- Guilde Noire : Mathys, Gakere. - ✅

## Riposte

- Khérops : Tarsak. - ✅
- (Pactes/Formations peuvent en octroyer d'autres temporairement - hors profil.)

## Rusé

- Khârns : Avant-gardes niveau III. - ✅
- Fangs : **Goulues niveau II** et **Meneuses niveau II**. - ✅ (Meneuse III aussi)
- Goûns : Guerriers Mongo niveau III. - ✅

L'identifiant de la compétence au dictionnaire est **`rusee`** (mot-clé « Rusé »).

## Bond 4

- Khârns : Syrga et l'Avant-garde khârne niveau III. - ✅ (valeur 4 sur les deux)

## Empathie

- Khârns : Engueran (« Empathie / Rescapé »). - ✅

## Seigneur de guerre X (mode bataille)

Compétence `seigneur-de-guerre`, à valeur. Elle détermine le nombre de marqueurs d'activation
(cf. [`chantiers/mode-bataille.md`](chantiers/mode-bataille.md)) : sans elle, le mode bataille ne
peut rien calculer.

Le livret ne fait que **rattraper les profils sortis avant l'extension** : les suivants portent la
compétence d'office sur leur carte. Il est donc normal - et attendu - que le catalogue en compte
plus que cette liste.

Ce que le **livret** attribue :

- Khârns : Prince (3), Engueran (2), Syrga (1), Maître de l'Ordre (1). - ✅
- Khérops : Tarsak (2), Ogodeï (1), Commandant (2), Capitaine (1). - ✅ ; « Grand Sacrificateur (1) »
  est nommé par le livret mais **ce profil n'existe pas chez nous** : la carte
  `kherops-pretre-ou-bourreau-fr.jpg` s'arrête au Prêtre (niveau I, Lim 3) et au Bourreau
  (niveau II, Lim 2).
- Fangs : Broutcha (1). - ✅
- Goûns : pas de SDG à valeur numérique ; le leader génère 1 marqueur par multiple complet de
  4 niveaux I, et le **Vieillard Shaman III** 1 par groupe de 3 niveaux I. Le Vieillard Shaman porte
  bien la compétence sans valeur au catalogue. - ✅

Ce que les **cartes** ajoutent, hors livret : Gaubert (1), Balthus (5), Lieutenant khérops (1),
Nagoï Khan (5), Apathée (1), Maraka (2), Clotrique (3). - ✅

## Corrections appliquées le 2026-08-04

- **Khalsa** : `affranchis-khalsa-2` n'avait pas « Indépendant » alors que `guilde-noire-khalsa-2`
  l'avait. C'est un personnage nommé, la compétence lui revient dans toutes ses versions. **Corrigé.**
  (Les deux versions diffèrent encore par ailleurs : l'Affranchie porte « Furtivité 3 » et
  « Carnivore », pas celle de la Guilde Noire. À vérifier sur carte le jour où ça compte.)
- **Porteuse d'eau** : `gouns-porteuse-d-eau-1` était recrutable **en tant qu'esclave** par un Fer de
  Lance affranchi, via leur recrutement ouvert chez les Goûns, alors que le livret dit que « les
  Affranchis se refusent à enrôler des esclaves ». `affranchis` a été ajouté à `exceptFactions` :
  elle reste recrutable chez eux si elle satisfait les règles de recrutement ouvert, mais comme une
  générique goûne ordinaire, pas comme une esclave. **Corrigé.**
- **Muskh** : porte « Indépendant » sur sa carte, l'exception du livret ne fait que dire que le livre
  ne le lui ajoute pas. **Rien à corriger.**
- **Kharl VI** n'est pas au catalogue ; l'exception qui le concerne est sans objet aujourd'hui.

## Procédure d'import d'une nouvelle faction

1. Transcrire les cartes (profils, équipements, sorts, cartes spéciales).
2. **Repasser cette checklist** et appliquer les compétences de bataille correspondantes.
3. Vérifier les **compétences génériques** introduites par le livre de bataille (Bond, Merci,
   Riposte, Rusé, Seigneur de guerre, Sauvage, Indépendant…) : s'assurer qu'elles existent dans
   le dictionnaire (onglet **Compétences** de l'admin), sinon les ajouter.
4. Noter en `notes` ce qui est ajouté « via les Règles de bataille » si utile à la traçabilité.
