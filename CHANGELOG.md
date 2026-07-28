# Journal des modifications

Ce fichier retrace les évolutions notables du constructeur de listes Khârn-Âges, pour pouvoir
les annoncer aux joueurs et aux personnes qui suivent le projet.

Conventions : une entrée par date de mise en ligne, la plus récente en haut, rédigée du point de
vue de l'utilisateur (ce qui change pour lui, pas comment c'est fait). Les détails techniques
n'y figurent que lorsqu'ils ont une conséquence visible.

## 2026-07-28

### Correction : améliorations d'objet invisibles

- Une amélioration optionnelle définie sur un objet (l'Épée courte et ses « deux effets », par
  exemple) n'apparaissait pas à l'achat et n'était pas facturée. Seul l'équipement de monture, comme
  le Caparaçon et ses « Pointes acérées », en tenait compte.
- Elles se cochent désormais sur la fiche de la figurine, au même endroit que celles conférées par
  une carte, et leur prix apparaît dans le récapitulatif.

### Noms toujours présentés de la même façon

- Les noms de profils, d'équipements, de sorts et de compétences s'affichent avec une majuscule
  initiale, quelle que soit la façon dont ils ont été saisis. Une liste exportée ne montre plus
  « couteau » ici et « Couteau » là.

### Mises à jour du site annoncées sans délai

- Le site cherche désormais activement une nouvelle version : au retour sur l'onglet, et une fois
  par heure. Un onglet laissé ouvert, ou l'application installée sur l'écran d'accueil, ne restait
  sinon sur son ancienne version que jusqu'à une prochaine visite, parfois plusieurs jours.
- Quand une nouvelle version est prête, le site le dit et propose de recharger. Il ne le fait jamais
  de lui-même : une liste en cours de composition n'existe que dans la page tant qu'elle n'est pas
  enregistrée, et un rechargement imposé l'effacerait.
- L'administration ouvre les nouveautés à la première visite qui suit une mise à jour, quelle que
  soit la façon dont on y est arrivé. Elle montre tout ce qui n'a pas encore été lu : sauter deux
  versions n'en escamote aucune.

### Administration : identifiants modifiables

- L'identifiant d'un profil, d'un équipement, d'une compétence, d'un sort, d'une carte ou d'une
  monture se corrige directement dans l'en-tête de sa fiche.
- Le renommage est répercuté partout : équipements de base, réservations, portées de cartes,
  sélecteurs d'effet, conditions. Le champ annonce combien de références vont suivre avant de
  valider, et refuse un identifiant déjà pris.
- Les grimoires et les factions font exception : leur identifiant est une constante du programme,
  la fiche l'affiche donc en lecture seule.

### Administration : suppressions sûres

- Supprimer une fiche prévient d'abord de ce qui la cite : la confirmation nomme les fiches
  concernées et le rôle de chaque citation (équipement de base, réservation, portée de carte…).
- Les citations sont retirées en même temps que la fiche, au lieu de rester à pointer dans le vide.
  Une fiche qui n'existerait plus sans elle disparaît aussi : une compétence de profil dont la
  compétence est supprimée, un effet qui ne cite que cet objet.

### Catalogue d'équipement enrichi

- 68 nouveaux équipements : boucliers (rondache, broquel, pavois), armures (gambison, armure de
  cuir, cotte de mailles), armes d'hast, munitions et objets de la Guilde Noire.
- Prix, portées et valeurs de perce-armure corrigés sur une quarantaine d'objets existants.
- Les réservations sont précisées : un objet réservé à un personnage l'est désormais aussi à son
  niveau et à sa faction, ce qui évite de le voir proposé à des figurines qui n'y ont pas droit.
- Le Sabre Khémiste n'est plus une arme de base des Guerrières et de la Prêtresse Émérite tembos :
  il leur reste réservé, mais devient un achat optionnel.
- Nouvelle arme : la Faux de la damnation. Les munitions en double (flèches, carreaux, flèche hydre)
  sont retirées de la liste d'équipement, où elles faisaient doublon avec la table des munitions.
- Trois nouveaux sorts : « Alliés d'outre-tombe », « Blessure arcanique » et « Confusion ».

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
- Un sort connu d'office peut désormais venir d'une carte ou d'un objet porté, et plus seulement de
  la carte de profil. Symétriquement, des pages de sorts peuvent venir directement d'un profil.
  Auparavant, ces effets étaient ignorés en silence selon l'endroit où on les avait placés.
- « Modifier la limitation » explique ce qu'elle relève réellement (des groupes de recrutement, un
  modèle à un niveau donné, hors uniques et personnages) et ne propose plus de viser la figurine
  qui porte l'effet, ce qui aurait rendu sa propre limitation impossible à dépasser.
- La cible se choisit entre « cette figurine » et « d'autres figurines », au lieu d'une case cochée
  qui laissait croire qu'il n'y avait rien d'autre à décider.
- Le périmètre de l'effet est passé dans la section « À qui il s'applique » : il n'apparaît plus
  dans une autre section au gré d'un réglage situé deux blocs plus bas.
- Le filtre d'équipement et la liaison ne s'étalent plus par défaut : on choisit d'abord si le
  montant porte sur la figurine ou sur certains objets, et si l'effet est réservé aux figurines
  reliées. Les champs n'apparaissent qu'ensuite.
- Les choix segmentés de l'administration annoncent correctement leur libellé aux lecteurs d'écran.
- Les parties d'une règle se lisent dans une colonne à gauche, séparées par un filet : on repère la
  structure sans la chercher. Les contrôles à deux choix passent en contour, pour que la couleur
  n'attire plus l'œil avant les titres.
- L'explication placée sous une case à cocher ne se collait pas à son libellé, faute d'un retour à
  la ligne. Corrigé partout où une case porte une explication.
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
