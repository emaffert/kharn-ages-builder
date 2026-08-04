# Journal des modifications

Ce fichier retrace les évolutions notables du constructeur de listes Khârn-Âges, pour pouvoir
les annoncer aux joueurs et aux personnes qui suivent le projet.

Conventions : une entrée par date de mise en ligne, la plus récente en haut, rédigée du point de
vue de l'utilisateur (ce qui change pour lui, pas comment c'est fait). Les détails techniques
n'y figurent que lorsqu'ils ont une conséquence visible.

## 2026-08-06 (5)

### Catalogue 0.5.1 : Khalsa et la Porteuse d'eau

- **Khalsa est « Indépendante » dans ses deux versions.** Sa carte affranchie ne portait pas la
  compétence, alors que celle de la Guilde Noire l'avait : c'est un personnage nommé, elle s'active
  et récupère ses points d'action loin de son leader quel que soit le Fer de Lance qui l'accueille.
- **La Porteuse d'eau n'est plus une esclave chez les Affranchis.** Un Fer de Lance affranchi pouvait
  la recruter par le recrutement ouvert, mais elle y arrivait avec la condition d'esclave : il lui
  fallait un Seigneur de guerre pour la posséder, et elle ne pouvait porter qu'une arme de corps à
  corps gratuite. Les Affranchis refusant d'enrôler des esclaves, elle rejoint désormais leurs rangs
  comme une générique goûne ordinaire, avec son équipement et sa limitation habituels.

## 2026-08-06 (4)

### Un garde rapproché ne compte plus double

- **Une figurine ne peut être désignée que par un seul garde.** Broutcha ne peut pas offrir à la fois
  son Larbin gratuit de Fille de Nyx et la remise de 35 Kouronnes de Djouked : son emplacement de
  garde rapprochée va à l'un ou à l'autre. Le constructeur l'empêchait déjà à la saisie, mais une
  liste plus ancienne pouvait encore porter les deux sans que rien ne le signale. Elle est maintenant
  refusée, en pointant la désignation en trop.
- **Rien ne change quand les emplacements existent vraiment** : avec deux Filles de Nyx, un Larbin
  gratuit et Djouked cohabitent toujours.
- **Une désignation ne franchit plus les frontières.** Un garde ne peut désigner qu'une figurine de
  son propre Fer de Lance, et ne peut pas se désigner lui-même. Ces liaisons impossibles à saisir
  restaient acceptées si une liste en portait ; elles sont maintenant signalées plutôt que de faire
  disparaître une remise sans explication.

## 2026-08-06 (3)

### Trois règles de cartes que le constructeur laissait passer

- **Key le Sénéchal refuse enfin les armes qu'il ne sait pas manier.** Sa carte lui interdit les armes
  de tir et les armes à deux mains ; on pouvait pourtant les lui acheter. Les épées bâtardes restent
  autorisées, puisqu'elles se manient aussi à une main.
- **Alaric ne troque plus sa canne contre n'importe quoi.** Sa carte ne lui laisse le choix qu'entre la
  Sarclette et le Couteau comme arme alternative. Le reste ne lui est plus proposé.
- **Le Mongo sombre gagne la Témérité que sa carte lui promet** : +1 par Mongo en jeu, en plus de sa
  valeur imprimée. Elle restait bloquée à 4 quelle que soit la horde qui l'accompagnait.

## 2026-08-06 (2)

### Le glisser-déposer ne déforme plus ce qu'on déplace

- **Le bloc que l'on saisit garde sa taille.** En réordonnant les figurines d'une liste, ou les lignes
  d'une fiche dans l'administration, le bloc en cours de déplacement pouvait s'étirer ou s'écraser en
  hauteur au moment où il changeait de place. Il suit maintenant le curseur sans se déformer.

## 2026-08-06

### Les fiches d'arme et de sort deviennent lisibles

- **Le prix n'occupe plus le devant de la scène.** Il rejoint le nom, en or, comme la pièce imprimée
  au bas des cartes - et quand il n'y a rien à payer, **plus rien ne s'affiche** au lieu d'un « - ».
  Sur les 55 sorts du jeu, 51 n'ont aucun coût en Kouronnes : la pastille était vide neuf fois sur dix.
- **Les valeurs chiffrées reprennent leur nom.** `Tir · 2 m · Port.3/7 max 7` devient un tableau où
  chaque case est étiquetée, et les cases qui n'ont pas lieu d'être disparaissent : une Fronde n'a ni
  recharge ni munitions, sa fiche n'en parle plus.
- **L'armure retrouve le cartouche des cartes** : le seuil dans la cuirasse, encadré par la
  protection en cas d'échec et en cas de réussite. `Arm.-2/6/-3` ne disait pas quel nombre était lequel.
- **Les sorts affichent enfin leur cadence et leur durée**, que la fiche passait sous silence alors
  que toutes les cartes les impriment.
- **Les seuils d'un sort forment une échelle** : le jet à obtenir dans un jeton, l'effet en face.
  Mieux on lance, mieux ça marche - la fiche le montre maintenant d'un coup d'œil.

## 2026-08-05 (2)

### L'Agent sombre choisit son peuple

- Un **Agent sombre** vient du peuple de votre choix - fang, goûn, khârn, khérops ou tembo. La
  question est posée au recrutement, et le peuple retenu s'affiche sur sa ligne.
- Ce choix décide de sa **monture** : un Agent khârn peut prendre un Quagga, un khérops un Kœlod, un
  goûn une Mochère. Fang ou tembo, il reste à pied. La modale le rappelle au moment de choisir.
- On peut en changer d'avis : un clic sur le peuple, sur la ligne de la figurine. Si la nouvelle
  provenance ferme l'accès à la monture achetée, elle est retirée plutôt que de laisser une erreur.
- Le peuple suit la figurine dans les listes exportées, en code comme en texte.

## 2026-08-05

### Les textes des cartes s'affichent tels qu'ils sont écrits

- Les **retours à la ligne** des descriptions sont enfin rendus. Ils étaient écrasés partout : un
  objet sur trois en contient, et le Goupillon ou l'Arbalète de poing s'affichaient en un seul bloc
  illisible. Lignes vides comprises, pour séparer deux paragraphes.
- Le texte d'une **carte spéciale** se saisit maintenant d'un seul tenant, comme la description d'un
  objet, au lieu d'une liste de blocs héritée des fiches de figurine. Les cartes existantes ont été
  converties sans rien perdre.
- Dans l'administration, les **zones de texte grandissent avec leur contenu** au lieu de rester
  coincées sur deux lignes.

## 2026-08-04

### Les Affranchis ouvrent leurs rangs

- La faction des **Affranchis** entre dans le constructeur, avec ses **23 figurines** : de Maraka et
  Clotrique, qui la mènent, jusqu'au Jardinier à 30 Ko. C'est la dernière faction du jeu à rejoindre
  l'outil - toutes y sont désormais.
- **Khalsa** existe en deux versions, une par camp, chacune avec ce que sa carte lui donne : cape
  d'ombre et rossignol chez la Guilde Noire, « Furtivité 3 » chez les Affranchis.
- Un Fer de Lance affranchi accueille **les combattants ordinaires des autres peuples** (khârns,
  khérops, goûns, fangs et Guilde Noire), sans rien payer ni personne à réunir. Ils apparaissent dans
  une section **« Peuples ralliés »** du roster. Les restrictions des règles sont appliquées : pas de
  membre de l'Ordre du Sang et de l'Acier, pas de femelle fang, pas de Bourreau du Sacrifice, et
  **un seul** shaman goûn ou prêtre du Sacrifice khérops par Fer de Lance.
- **Une figurine qui rallie les Affranchis laisse derrière elle l'arsenal de son peuple** : le
  Guerrier khârn ne peut plus acheter l'Armure de Combat Khârne. Ses armes de signature, elles, lui
  restent.
- Tous les membres d'un Fer de Lance affranchi gagnent **Furtivité**, y compris les ralliés : ils
  combattent comme une seule et même faction. Les autres, venus d'ailleurs, peuvent apprendre
  **« Éclaireur 2 » et « Rusé »** pour 5 Ko multipliés par leur niveau.
- Une figurine peut désormais déclarer son **peuple d'origine**, distinct de la faction sous laquelle
  elle combat. C'est ce qui lui laisse la **monture** de son peuple, et sa nature **carnivore** chez
  les Affranchis - et cela répare au passage les membres de la Guilde Noire venus des Fangs, dont
  l'origine n'était nulle part.
- Le roster range les ralliés **par peuple d'origine** : la liste d'un seul tenant était un mur.
- Un peuple accueilli l'est **selon ses propres règles, et seulement elles** : une figurine unique ou
  un personnage de ces peuples ne peut plus s'inviter en payant un sceau de la Guilde Noire. Ce que la
  carte accorde nommément (« Allié des Affranchis », « Apatride ») passe toujours avant, comme il se
  doit pour le Bourgmestre.
- Le roster ne propose plus que les **niveaux réellement recrutables** d'une figurine : l'Agent
  sombre s'affichait avec ses trois niveaux chez les Affranchis, qui n'acceptent que le premier.

### Petites choses

- Le budget d'une nouvelle liste est à **500 Ko** par défaut.
- La tuile des Affranchis perd sa mention « Transverse ».

## 2026-08-03 (3)

### Dupliquer une figurine

- Un bouton **« Dupliquer »** apparaît sur chaque figurine de la liste, à côté de la corbeille. La
  copie arrive juste en dessous, avec **tout ce qu'on avait acheté** : armes, armures, améliorations,
  munitions, grimoire et sorts (offerts compris), cartes, monture et ses options.
- Le bouton ne s'affiche pas sur les profils **uniques** ni sur les **personnages** : leur second
  exemplaire n'existera jamais. Ailleurs, il se **grise** dès que la limite de recrutement est
  atteinte, bonus compris (le +1 du Lieutenant khérops, par exemple).
- Deux choses ne suivent pas la copie, parce que ce sont des liens vers d'autres figurines et non de
  l'équipement : les **rattachées** (Likans, Muskh), qui sont des recrues à part entière avec leurs
  propres limites, et la **désignation de garde du corps**, qui se repose en un clic.
- La copie peut se retrouver en faute sur d'autres règles (deux armures, budget de pages dépassé…) :
  le constructeur la crée quand même et signale le problème sur sa ligne, comme partout ailleurs.

## 2026-08-03 (2)

### Une arme peut protéger

- La **Vouge de Moringa** compte comme un bouclier -1/5/-2 avec 10 de DV. Le constructeur ignorait
  cette protection : elle est désormais saisie et affichée.
- Une protection qui n'est pas une armure **s'ajoute** : elle n'occupe pas l'emplacement d'armure du
  porteur, qui peut donc garder son armure. Ce sont les mains qu'elle mobilise qui la limitent.
- La fiche affiche maintenant **une ligne par protection**. Un combattant avec son armure et un
  gambison en voit deux, et trois s'il porte en plus la Vouge - avant, le gambison faisait disparaître
  l'armure de la fiche.
- La Vouge est une arme au logo Tembo : son prix inclut déjà le tarif Tembo, elle ne subit plus le
  surcoût de +3 Ko par tranche de 10 (soit 9 Ko de trop jusqu'ici).

## 2026-08-03

### Les sorts offerts

- Certaines cartes et certains objets donnent un sort « pour rien » : la **Demi-soeur** possède
  1 sort d'Ostéomancie sans grimoire, la **Vouge de Moringa** offre 3 sorts d'Adansonia. C'était
  écrit sur les cartes, mais le constructeur ne savait pas le proposer.
- L'onglet « Magie » affiche désormais un troisième volet, **« Sorts offerts »**, avec son propre
  compteur. On y choisit ses sorts comme ailleurs, source par source.
- Ces sorts ne demandent **aucun grimoire** et ne consomment **ni page ni niveau** : ils s'ajoutent
  à tout ce que la figurine achète par ailleurs. Leur prix en Kouronnes, lui, reste dû.
- Les réservations continuent de s'appliquer : la Demi-soeur ne pioche pas dans les sorts réservés
  aux Filles de Nyx, mais une Fille de Nyx qui recevrait la même offre y aurait droit.
- Un sort ne se connaît qu'une fois : celui qu'on prend en offert disparaît de la liste des sorts
  à payer, et inversement. Si l'objet qui offrait le sort est revendu, le constructeur le signale
  au lieu de garder le sort en douce.

## 2026-07-31 (2)

### Les esclaves

- Un combattant qui possède « Seigneur de guerre » affiche un bouton **« + Esclave »**, comme les
  femelles Fangs affichent « + Likan ». L'esclave se range sous son maître dans la liste.
- Le constructeur applique les quatre règles de la page 10 : un esclave appartient à un Seigneur de
  guerre du Fer de Lance, qui n'en possède pas plus que sa valeur de SDG ; les esclaves ne peuvent
  pas être plus nombreux que les autres combattants ; ils ne s'équipent que d'une arme de corps à
  corps gratuite ; et un esclave ne mène jamais un Fer de Lance.
- Un esclave ne prend **aucune amélioration payante**. Certaines visent tout un peuple - « Lien de
  la Terre » vise les Dogons, donc la Porteuse d'eau - mais personne n'investit sur une captive.
- Une carte peut être esclave **seulement dans certaines factions**. La Porteuse d'eau reste une
  recrue ordinaire chez les Goûns et chez les Tembos, avec tout son équipement ; ailleurs, elle
  arrive par un Seigneur de guerre, à raison d'une seule par maître.

## 2026-07-31

### La compétence « Archimage » fonctionne

- « Archimage » ne faisait rien du tout. Elle donne désormais accès aux sorts de **toutes les
  voies de magie** dans le même grimoire, comme le dit la carte.
- Elle se suffit à elle-même : une figurine qui n'a qu'« Archimage », sans compétence d'école,
  est bien reconnue comme mage (onglet « Magie » et pastille « Mage » sur sa fiche).
- Concrètement, Balthus qui achète le **Grimoire de Josève** choisit maintenant ses sorts parmi
  les cinq voies, et plus seulement dans « Le Sang et l'Acier ».
- Les sorts réservés à un personnage ou à une faction précise le restent : un archimage ne pioche
  pas dans les sorts signatures des autres.

### « Apatride » et « Affinité » se lisent sur la carte

- « Apatride » demandait, en plus de la compétence, une étiquette interne invisible sur la fiche :
  sans elle, la compétence ne faisait rien. Seule la compétence inscrite sur la carte compte
  désormais, et l'étiquette a disparu. Les cas où « Apatride » est *gagné* en cours de liste
  (Sceau de la Guilde Noire, ≥ 2 Frères d'Armes) fonctionnent comme avant, à ceci près que la
  figurine l'affiche maintenant parmi ses compétences.
- « Affinité (école X) » n'était prise en compte que si elle était imprimée sur le profil. Une
  Affinité conférée par un objet ou une carte ouvre maintenant son école, elle aussi.

### Un sort devenu inaccessible est signalé

- Si ce qui ouvrait une voie de magie disparaît après coup (objet revendu, amélioration décochée),
  les sorts déjà choisis dans cette voie restaient en place sans un mot. La liste est maintenant
  invalide, avec le nom des sorts en cause : « Balthus ne peut pas connaître ce sort : Poigne
  spectrale. »

## 2026-07-30

### Un objet n'est réservé que s'il le dit

- L'écran d'équipement masquait tout objet porté par une seule figurine, en le tenant pour sa
  propriété. C'était une déduction, pas une règle : elle cachait à tout le monde des armes
  ordinaires comme la Pertuisane, la Fronde, le Gourdin ou l'Arc de guerre, simplement parce
  qu'une seule carte les mentionne.
- Désormais, seule la réservation inscrite sur l'objet compte. Les armes signatures (Marteau
  Tonnerre d'Ogodeï, Vaillante d'Engueran...) restent réservées à leur porteur ; le reste est
  achetable par qui peut le porter.

### Objets en plusieurs exemplaires

- Un objet peut être déclaré **empilable** : une figurine en porte alors plusieurs exemplaires,
  affichés « Dose de poison ×3 » au lieu de trois lignes identiques. Les trois doses de la
  Camériste sont reprises automatiquement sous cette forme.
- Ces objets-là, et eux seuls, peuvent être **achetés en plusieurs exemplaires** : chaque achat
  ajoute un exemplaire, chaque retrait en rend un. Leur prix est annoncé « 6 Ko / unité », pour
  dire d'emblée qu'on peut en prendre plusieurs.
- Rendre un équipement de base en plusieurs exemplaires les rend tous, et rembourse le total.

### Équipement de base que la figurine ne peut pas rendre

- Certaines figurines portent un équipement qui fait corps avec elles : les doses de poison de la
  Camériste, l'outillage de l'Agent sombre. Ces objets s'affichent désormais avec un cadenas dans
  l'onglet Équipement, au lieu du bouton qui permettait de les rendre pour en récupérer le coût.
- Le reste de leur équipement de base, l'arme notamment, se rend toujours normalement.

### Budgets proposés à la création d'une liste

- Les deux budgets prédéfinis sont désormais **300 et 500 Ko** (au lieu de 300 et 400). « Autre »
  reste là pour n'importe quelle autre valeur.

### Recruter un membre de la Guilde Noire dans une autre faction

- Le Sceau de la Guilde Noire entre en jeu : tous les membres de la Guilde Noire apparaissent
  désormais dans le roster de n'importe quelle faction, dans une section « Guilde Noire » à part.
- Le prix affiché dans cette section comprend déjà le sceau (+10 Ko) : c'est bien ce que la
  figurine coûtera. Le sceau est équipé d'office au recrutement et ne peut pas être retiré, puisque
  c'est lui qui autorise la recrue.
- Un membre de la Guilde Noire qui est déjà « allié » de la faction d'accueil (le Négociateur chez
  les Khârns, le Mongo sombre chez les Goûns...) continue d'entrer sans surcoût, comme avant.
- Les Frères d'armes ne changent pas : toujours leur propre section, toujours recrutables par deux
  ou plus, sans surcoût. Nouveauté pour eux : un frère seul peut maintenant acheter le sceau dans
  son onglet Équipement pour tenir un Fer de Lance sans son frère.
- Quand une figurine ne peut pas être recrutée, le message dit désormais ce qui lui manque : un
  second frère d'armes, ou le sceau.

## 2026-07-29

### Créer un profil depuis l'administration

- La liste des profils reçoit un bouton « + profil », comme les équipements ou les sorts. La
  nouvelle fiche est créée dans la faction affichée, puis s'ouvre pour être remplie.
- Elle naît avec son propre groupe de figurines ; sans groupe, elle n'aurait été proposée à
  personne dans le constructeur.
- Ses caractéristiques sont vides plutôt qu'à zéro, pour distinguer ce qui reste à saisir d'une
  valeur réellement nulle, et sa limitation de recrutement démarre à 1 exemplaire.
- L'icône partagée n'est proposée qu'une fois l'image de carte renseignée : c'est elle qui décide
  avec quels autres niveaux l'icône est partagée.

### Supprimer un profil

- La fiche de profil reçoit le bouton de suppression qu'ont déjà les autres fiches. La confirmation
  annonce les fiches qui citent le profil, et ce qui leur arrivera.
- Le groupe de figurines part avec sa dernière figurine, au lieu de rester en liste vide.
- Après suppression, c'est la fiche voisine qui s'ouvre, pas la première du catalogue.

### Aucune suppression ne laisse plus de référence en l'air

- Supprimer une faction, une voie de magie, une monture, une option de monture ou une sorte de
  munition passe maintenant par le même chemin que les autres suppressions : ce qui citait
  l'élément supprimé est nettoyé en même temps. Ces cinq-là se contentaient de retirer la ligne, en
  laissant derrière elles des renvois vers un élément disparu.
- La cascade se poursuit d'elle-même : supprimer une faction emporte ses voies de magie, et plus
  aucun sort ne renvoie alors à une voie qui n'existe plus. Supprimer un type de monture emporte
  ses niveaux et leurs citations.
- Une arme de tir dont on supprime la sorte de munition reste une arme : elle cesse simplement de
  proposer des munitions.
- Les confirmations de l'écran Réglages annoncent elles aussi les fiches concernées.

### Boutons de création en tête de liste

- « + profil », « + carte », « + sort »… se trouvent désormais en haut de la barre latérale, à côté
  du compte d'éléments. Il fallait dérouler la liste entière pour les atteindre.
- Une création efface la recherche en cours, sans quoi la nouvelle fiche naissait hors du filtre et
  semblait perdue.

### Nommer un groupe de figurines au moment de le créer

- Le champ « Nom du groupe » disparaît de la fiche de profil : « Nouveau groupe » demande maintenant
  le nom dans une petite fenêtre, et un bouton « Renommer le groupe… » sert au renommage. Les deux
  champs faisaient à peu près la même chose, côte à côte.
- La fusion est annoncée pendant la saisie : si le nom est déjà porté par un groupe de la faction,
  la fenêtre prévient que la figurine le rejoindra au lieu de former un groupe à part.

## 2026-07-28

### Chargement et mises à jour nettement plus rapides

- Les portraits des figurines ne voyagent plus avec les données du catalogue. Le premier chargement
  de l'application est environ trois fois plus léger.
- Une correction de données, un coût ou une règle par exemple, ne fait plus retélécharger tous les
  portraits : seules les données changent, les images déjà connues du navigateur sont conservées.
- Les portraits restent affichés sans connexion, y compris lors de la toute première visite.

### Sorts génériques et sorts de grimoire séparés

- L'onglet Magie distingue désormais les deux façons de payer un sort. Un sort générique se paie en
  niveaux de la figurine : un profil de niveau III en connaît trois niveaux, et « Passe-Passe » en
  vaut trois à lui seul. Un sort de voie se paie en pages et suppose un grimoire.
- Les deux budgets ont leur propre sélection, avec le même fonctionnement que le choix d'armes. Le
  sélecteur du haut porte les deux soldes, donc l'autre budget reste lisible sans y basculer. Le
  palier de grimoire est passé sous l'onglet Grimoire, le seul qu'il finance.
- Les sorts génériques n'entament plus la capacité de pages du grimoire.

### Correction : sorts réservés visibles par tout le monde

- Un sort générique réservé à un personnage ou à une faction était proposé à tous les lanceurs.
  « Passe-Passe », réservé à Bharbathos, apparaissait par exemple sur n'importe quelle figurine
  capable de lancer des sorts. La réservation s'applique maintenant aussi aux génériques, et peut
  viser une faction entière.
- Une figurine qui ne maîtrise aucune voie de magie ne se voit plus proposer le moindre sort.
- Un sort en cours de rédaction dans l'administration n'apparaît plus dans le constructeur tant
  qu'il n'a pas reçu sa voie.

### Le gambison se porte en plus d'une armure

- La règle spéciale du gambison est prise en compte : il occupe son propre emplacement et se cumule
  donc avec une armure ordinaire, sans plus déclencher l'avertissement « porte plusieurs armures ».
- La fiche de figurine affiche les deux protections, chacune sur sa ligne.

### Portée maximale des armes de tir

- Quand une arme a une portée maximale, au-delà de laquelle le tir est impossible, elle est affichée
  avec ses portées courte et longue, sur la fiche comme dans le choix d'équipement.

### Administration : saisie de l'équipement et des listes

- Le nombre de mains se renseigne aussi sur les armes de tir, et plus seulement sur les armes de
  corps à corps.
- Une armure peut être déclarée cumulable avec une autre, ce qui lui donne son propre emplacement.
- Une entité dont le nom a été vidé apparaît dans les listes sous la mention « (sans nom) », au lieu
  d'une ligne vide impossible à rouvrir pour la corriger ou la supprimer.

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

### Catalogue de sorts complété

- Une quarantaine de sorts saisis : l'Ostéomancie, le Shamanisme, Le Sacrifice, Le Sang et l'Acier
  et Adansonia ont désormais leurs sorts, avec leur cible, leur cadence, leur durée et leurs seuils
  de difficulté.
- Les quatre sorts de démonstration, nommés « Test », sont retirés du catalogue.
- « Onde revigorante » figurait dans la liste sans aucun seuil de difficulté, donc sans effet. Le
  sort porte maintenant son texte complet : il soigne 1D5 ou 1D10 points de vie sur un Safar à cinq
  toises. Le Guerrier Albinos le connaît toujours d'office, et il devient accessible aux autres
  lanceurs de shamanisme.
- La Faux de la damnation était réservée à un trait qui n'existait pas, si bien qu'elle n'était
  proposée à personne. Elle l'est désormais aux Filles de Nyx de niveau III, comme « Alliés
  d'outre-tombe ».
- Le nombre de mains des arbalètes, de la sarbacane et du petit arc d'Euthéria est renseigné.

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
