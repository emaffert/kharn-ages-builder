# Compétences ajoutées par le livre « Règles de bataille »

Le livre de bataille **octroie des compétences à certains profils**, qui ne sont pas (toujours)
imprimées sur les cartes antérieures. La FAQ précise : *« les ajouts de compétences dans le
livre de règles de bataille prennent le pas sur les cartes de profil originales »*.

**Checklist à appliquer à chaque faction importée.**

> **État vérifié contre `src/data/catalog.json` v0.5.0 le 2026-08-04.** Les cases cochées ont été
> relues dans les données, pas seulement dans cette page. Les écarts restants sont listés en fin de
> document.

## Indépendant

Tous les **personnages nommés**, sauf Key le Sénéchal et Kharl VI (Khârns) et **Muskh** (Fangs).
Plus :

- Khârns : les **Avant-gardes**. - ✅ (I/II/III)
- Khérops : les **Berserkers**. - ✅ (seul le niveau II existe au catalogue)
- Fangs : les **Exécuteurs**. - ✅ (I/II/III, Apathée, Broutcha, Xayìn ; Muskh/Djouked l'ont d'office
  sur leur carte, l'exception du livre signifie seulement qu'il ne le leur *ajoute* pas)
- Goûns : les **éclaireurs mongo**. - ✅ (I/II/III)

Personnages nommés : 26 des 31 profils à limitation « P » l'ont. Key est correctement exclu ;
Kharl VI n'existe pas encore au catalogue. **Quatre manques**, voir les écarts.

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

- Khârns : Prince (3), Engueran (2), Syrga (1), Maître de l'Ordre (1). - ✅ ; **+ Gaubert (1) et
  Balthus (5)** présents au catalogue mais absents de cette liste.
- Khérops : Tarsak (2), Ogodeï (1), Commandant (2), Capitaine (1). - ✅ ; **+ Lieutenant (1) et
  Nagoï Khan (5)** présents au catalogue mais absents de cette liste. « Grand Sacrificateur (1) » :
  **ce profil n'existe pas au catalogue** (voir les écarts).
- Fangs : Broutcha (1), Apathée (1). - ✅
- Affranchis : Maraka (2), Clotrique (3). - ✅ (hors livre de bataille, propres à la faction)
- Goûns : pas de SDG à valeur numérique ; le leader génère 1 marqueur par multiple complet de
  4 niveaux I, et le **Vieillard Shaman III** 1 par groupe de 3 niveaux I. Le Vieillard Shaman porte
  bien la compétence sans valeur au catalogue. - ✅

## Écarts constatés au 2026-08-04

À traiter avant d'implémenter le calcul des marqueurs d'activation.

- **Indépendant manquant** sur 4 personnages nommés : `kherops-nagoi-khan-3`, `affranchis-maraka-3`,
  `affranchis-khalsa-2`, `affranchis-clotrique-3`. À noter que `guilde-noire-khalsa-2` **l'a**,
  alors que `affranchis-khalsa-2`, même personnage, ne l'a pas : incohérence entre les deux versions.
- **« Grand Sacrificateur »** figurait dans cette checklist avec SDG 1, mais aucun profil de ce nom
  n'existe. Les candidats khérops proches sont `kherops-bourreau-2` (Bourreau du Sacrifice) et
  `kherops-pretre-1` (Prêtre du Sacrifice). À arbitrer sur carte avant correction.
- **Kharl VI** n'est pas encore au catalogue ; l'exception qui le concerne est donc sans objet
  aujourd'hui.

## Procédure d'import d'une nouvelle faction

1. Transcrire les cartes (profils, équipements, sorts, cartes spéciales).
2. **Repasser cette checklist** et appliquer les compétences de bataille correspondantes.
3. Vérifier les **compétences génériques** introduites par le livre de bataille (Bond, Merci,
   Riposte, Rusé, Seigneur de guerre, Sauvage, Indépendant…) : s'assurer qu'elles existent dans
   le dictionnaire (onglet **Compétences** de l'admin), sinon les ajouter.
4. Noter en `notes` ce qui est ajouté « via les Règles de bataille » si utile à la traçabilité.
