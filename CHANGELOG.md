# Journal des modifications

Ce fichier retrace les évolutions notables du constructeur de listes Khârn-Âges, pour pouvoir
les annoncer aux joueurs et aux personnes qui suivent le projet.

Conventions : une entrée par date de mise en ligne, la plus récente en haut, rédigée du point de
vue de l'utilisateur (ce qui change pour lui, pas comment c'est fait). Les détails techniques
n'y figurent que lorsqu'ils ont une conséquence visible.

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
