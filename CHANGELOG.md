# Journal des modifications

Ce fichier retrace les évolutions notables du constructeur de listes Khârn-Âges, pour pouvoir
les annoncer aux joueurs et aux personnes qui suivent le projet.

Conventions : une entrée par date de mise en ligne, la plus récente en haut, rédigée du point de
vue de l'utilisateur (ce qui change pour lui, pas comment c'est fait). Les détails techniques
n'y figurent que lorsqu'ils ont une conséquence visible.

## 2026-07-26

### Administration du catalogue

- Les contraintes de recrutement n'affichent plus de réglages sans effet : la « portée » n'est
  proposée que lorsqu'elle change réellement quelque chose. Sur « nécessite une présence », on
  choisit désormais si la figurine requise doit être dans le même Fer de Lance ou n'importe où
  dans l'Ost, et le moteur en tient compte.
- Le rattachement (Likan et sa porteuse, par exemple) se règle avec un vrai formulaire : on choisit
  si le porteur est désigné par un trait, par des profils ou par des modèles, et on lui donne le nom
  lisible affiché aux joueurs. Ce nom n'est plus effacé par la modification du reste.
- Le réglage « sévérité » disparaît des contraintes : une contrainte bloque toujours la liste. Une
  règle qui ne bloque pas se consigne en note interne.
- Le type de contrainte « personnalisée », qui n'était jamais vérifié, est remplacé par des notes
  internes, désormais disponibles aussi sur les cartes spéciales. Les contraintes de ce type déjà
  saisies sont reversées automatiquement dans ces notes.
- « Équipement réservé » s'appelle maintenant « Interdit d'acquérir un grimoire », ce qu'il faisait
  réellement.

### Éditeur d'effets plus lisible

- La cible d'un effet n'affiche plus que les critères qui comptent à l'endroit où on est : une
  condition, un groupe à compter et une liaison n'ont pas les mêmes réglages utiles. Les critères
  sans effet à cet endroit ne sont plus proposés.
- Chaque bloc explique en une phrase comment il se lit : ce qu'il faut valider entièrement, et où
  une seule valeur suffit. Le filtre d'équipement, qui fonctionne différemment des autres, le dit.
- Changer l'action d'un effet emporte les réglages que la nouvelle action ne lit pas (filtre
  d'équipement, liaison), au lieu de les laisser derrière elle, invisibles et sans effet.
- Sur une monture, la cible « le cavalier » remplace le doublon « lui-même », et le libellé de la
  source s'adapte à ce qui porte l'effet (une figurine, une carte, un équipement).
- Les cartes d'effet et de contrainte sont découpées en parties titrées, au lieu d'une suite de
  champs de même poids.
- La portée n'est demandée que lorsqu'elle change quelque chose : un effet qui ne concerne que la
  figurine qui le porte ne la propose plus.
- La case « au choix du joueur » disparaît. Elle ne faisait qu'exiger une liaison, ce que la liaison
  exprime déjà : renseigner « Liaison à une autre figurine » suffit désormais à conditionner l'effet.
  Le réglage n'apparaît que sur les deux actions de coût, les seules que le moteur sache verrouiller
  ainsi.

## 2026-07-25

### Comptes joueurs

- Création de compte et connexion par e-mail et mot de passe, avec un pseudo d'affichage.
- Un menu de compte apparaît dans la barre du haut : pseudo, adresse et déconnexion.
- Mot de passe oublié : un lien envoyé par e-mail permet d'en choisir un nouveau.
- Écran « Mon compte » : modification du pseudo d'affichage.
- Suppression définitive du compte, listes comprises, sur tous les appareils.

### Listes synchronisées entre appareils

- Les listes sauvegardées sont désormais rattachées au compte et suivent le joueur d'un appareil
  à l'autre.
- Les listes créées avant d'avoir un compte sont récupérées et rattachées à la première connexion.
- Tout continue de fonctionner hors-ligne : les listes restent enregistrées sur l'appareil et
  repartent vers le compte au retour du réseau. Une pastille à côté de « Reprendre une liste »
  indique l'état de la synchronisation.
- Conséquence à connaître : une fois déconnecté, la bibliothèque paraît vide. Les listes sont sur
  le compte, elles reviennent à la reconnexion.

### Catalogue publié depuis l'administration

- Le catalogue (profils, équipements, sorts, montures) n'est plus figé dans le site : il est servi
  par le serveur et se met à jour sans nouvelle mise en ligne du site.
- L'administration reçoit un bouton « Publier » qui envoie la version en cours à tous les joueurs,
  après confirmation et saisie d'un nom de version.
- Les 10 dernières versions publiées sont conservées, ce qui permet de revenir en arrière en cas
  de mauvaise publication.
- Au démarrage, le site attend quelques secondes la dernière version publiée ; sans réponse, il
  affiche la version qu'il connaît déjà et se met à jour dès qu'elle arrive.

### Administration

- L'accès à l'administration est réservé aux comptes ayant le rôle administrateur. Il n'est plus
  ouvert à tous les visiteurs.

## 2026-07-24

### Corrections du constructeur

- Plusieurs Likans de même niveau peuvent de nouveau être rattachés à une même figurine (les
  Likans ne sont pas uniques).
- Le bouton « + Likan » reste actif tant que la capacité de rattachement le permet : une figurine
  dépendante n'est plus limitée par son propre emplacement.
