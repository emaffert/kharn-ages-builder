# Chantier - Ajustements du modèle de catalogue

Statut : **à implémenter, non commencé**. Ouvert le 2026-08-04.

Trois manques repérés en relisant le chapitre « Généralités » des règles de bataille
(`rules corpus/LDR KA Saison2.pdf`, pages 4 à 14) et en auditant `catalog.json` v0.5.0. Aucun n'est
bloquant : ce sont des règles que le modèle ne sait pas exprimer aujourd'hui, contournées par une
saisie approchée.

Ils sont indépendants les uns des autres et de la
[feuille de route Ost/Bataille](feuille-de-route-ost.md).

## 1. Type de munition interdit aux armes gratuites

**C'est le seul des trois qui laisse aujourd'hui passer une liste illégale.**

Le livret (p. 13) : « l'affûtage » et la « dose de poison » ne peuvent pas être appliqués sur une
arme de corps à corps gratuite, **la « flèche hydre » ne peut pas être utilisée avec un arc
gratuit**.

La Flèche hydre est modélisée comme un **type de munition** de la sorte `fleches`
(`catalog.munitionKinds`), au palier à 15 Ko, quantité 1. Rien n'empêche de l'acheter pour un arc
gratuit.

**À faire** : un drapeau sur le *type* de munition, du genre `forbiddenOnFreeWeapon: true`, honoré
par le moteur (issue de validation) et par le panneau d'achat (option grisée quand l'arme porteuse
est gratuite). Le champ se pose sur le type, pas sur la sorte : seule la Flèche hydre est concernée,
pas les flèches simples.

À rapprocher des restrictions d'armes gratuites de la Geste de Safar, traitées en
[phase 3 de la feuille de route](feuille-de-route-ost.md) : même motif, même endroit dans le moteur.

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
