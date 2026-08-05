# Chantier - Ajustements du modèle de catalogue

Statut : **point 1 fait le 2026-08-05, points 2 et 3 à implémenter**. Ouvert le 2026-08-04.

Trois manques repérés en relisant le chapitre « Généralités » des règles de bataille
(`rules corpus/LDR KA Saison2.pdf`, pages 4 à 14) et en auditant `catalog.json` v0.5.0. Aucun n'est
bloquant : ce sont des règles que le modèle ne sait pas exprimer aujourd'hui, contournées par une
saisie approchée.

Ils sont indépendants les uns des autres et de la
[feuille de route Ost/Bataille](feuille-de-route-ost.md).

## 1. Type de munition interdit aux armes gratuites - FAIT (2026-08-05)

C'était le seul des trois qui laissait passer une liste illégale.

Le livret (p. 13) : « l'affûtage » et la « dose de poison » ne peuvent pas être appliqués sur une
arme de corps à corps gratuite, **la « flèche hydre » ne peut pas être utilisée avec un arc
gratuit**.

La Flèche hydre est un **type de munition** de la sorte `fleches` (`catalog.munitionKinds`), au
palier à 15 Ko, quantité 1. Elle porte désormais `forbiddenOnFreeWeapon: true` (catalogue 0.5.2).
Le champ se pose sur le type, pas sur la sorte : seule la Flèche hydre est concernée, pas les
flèches simples.

Ce qui a été livré :

- `isFreeWeapon` (`src/core/engine/equipment.ts`) : la définition partagée d'une arme gratuite,
  c'est-à-dire une arme **que les règles donnent pour rien**, repérée par son prix nul au catalogue.
  Une arme ramenée à 0 Ko par une remise n'en est pas une. `slaveMayBuy` et la facette « Gratuit »
  du panneau d'achat, qui inlinaient chacune leur test, s'y adossent maintenant.
- `munitionTypeAllowedOn` / `munitionTypesFor` (`munitions.ts`) : le panneau d'achat n'affiche plus
  du tout la ligne interdite, plutôt que de la griser.
- `validateMunitions` (`evaluate.ts`, `ruleId` `munition-free-weapon:<arme>`) : une liste importée
  ou antérieure à la règle qui porte la munition interdite est refusée. Le prix de la munition reste
  compté, pour qu'une liste illégale n'apparaisse pas moins chère qu'elle ne l'est.
- Case à cocher « Pas sur une arme gratuite » dans l'admin, par type de munition.

Seul l'**Arc court** (0 Ko, équipement de base de l'Éclaireur Mongo I) est concerné aujourd'hui : les
autres arcs coûtent de 10 à 35 Ko, et les arbalètes n'ont pas de type Hydre dans leurs carreaux.

À rapprocher des restrictions d'armes gratuites de la Geste de Safar, traitées en
[phase 3 de la feuille de route](feuille-de-route-ost.md) : même notion d'arme gratuite, à brancher
sur `isFreeWeapon`.

## 2. Affûtage en amélioration d'arme

L'Affûtage (8 Ko) est aujourd'hui un **objet** (`category: "objet"`), alors que c'est en réalité une
**amélioration d'arme** : « la lame affûtée génère 1 dégât de plus (ne peut pas être appliqué sur une
arme ne possédant pas de tranchant) ».

Il a été laissé en objet parce que le modèle d'amélioration ne sait pas restreindre aux **armes
tranchantes** : `Equipment.upgrades` est intrinsèque à un objet donné, et l'opération
`unlock-upgrade` filtre par `equipmentCategories` (`arme-cac`, `arme-tir`…), ce qui est trop large -
une canne ou un gourdin passeraient.

**À faire** : un moyen de qualifier une arme de tranchante (drapeau sur `Equipment`, ou trait
d'équipement), puis exprimer l'Affûtage en amélioration filtrée là-dessus. Une fois fait, la
restriction « pas sur une arme de corps à corps gratuite » du point 1 s'applique naturellement.

**Pas de dose de poison ici** : elle s'achète à l'exemplaire et peut servir sur plusieurs armes
différentes, l'objet empilable est la bonne modélisation. Elle reste concernée par la seule
restriction « pas sur une arme de corps à corps gratuite ».

## 3. Catégorie « Casque »

Les six casques (Barbute 10, Bassinet 8, Casque à nasal 6, Casque à plumet 8, Cervelière 10,
Heaume 15) sont saisis en `objet`. Le livret (p. 14) en fait une famille à part : « les casques
peuvent être portés par n'importe quel Safar, en complément d'une armure ou non ».

Le comportement actuel est correct - un `objet` ne consomme pas l'emplacement d'armure - mais la
famille n'est pas nommée, donc l'interface ne peut pas les regrouper ni les présenter comme un choix
unique.

**À faire** : une catégorie `casque` dans `EquipmentCategorySchema`, avec une **durabilité
optionnelle**. Le livret précise « il coche une case de durée de vie à chaque utilisation, **si le
casque n'en comporte pas**, ces effets sont effectifs pour toute la durée de la partie » : seuls le
**Bassinet** et la **Cervelière** ont des cases.

Attention en changeant la catégorie : elle est référencée par `PURCHASE_CATS` et `CAT_LABEL`
(`src/app/builder/shared.ts:351`), par les filtres `forbiddenCats`, et par les
`equipmentCategories` des effets `unlock-upgrade` déjà saisis. Vérifier qu'aucune carte n'octroyait
une amélioration « objets » en comptant sur les casques.

## Points écartés

- **Identifiant généré de la Flèche hydre** (`mt-1785224277213` au lieu d'un slug lisible) : les
  identifiants de type de munition ne sont pas éditables dans l'admin, donc rien à faire sans une
  migration dédiée. Coût réel nul, on vit avec.
- **PIONs** : concept de mise en place de partie (phase d'adaptation, face à l'adversaire), hors du
  périmètre d'un constructeur de listes. **Ne sera pas géré.**
- **Grand Sacrificateur khérops** : nommé dans la liste « SDG X » du livret, mais absent de notre jeu
  de cartes - `cards/Kherops/kherops-pretre-ou-bourreau-fr.jpg` ne contient que le Prêtre (niveau I,
  Lim 3) et le Bourreau (niveau II, Lim 2). Ce n'est pas un manque de saisie : le profil n'existe pas
  chez nous.
