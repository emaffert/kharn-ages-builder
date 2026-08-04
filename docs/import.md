# Points d'attention lors de l'import

## Général

- Vérifier les compétences ajoutées par les règles de bataille
- Concernant les munitions : elles sont génériques, divisées uniquement en flèches pour les arcs, et carreaux pour les arbalètes. On peut en acheter de plusieurs sortes différentes, ceci est présenté dans un tableau page 46 du livre de règles KAT

## Vérifiactions à faire côté Fang

- Augmentation du I sur le profil des Goulues quand elles ont leur amélioration Apprentie de Nyx

## Khérops

- Tag "Guerrier" partégé par de nombreuses références : Guerrier X, Arbalétrier, Lieutenant, Tireur d'élite
- Berserker partage une image avec Brute de la guilde (Guilde noire)
- Capitaine et Commandant -> même image, partagent la même carte "injonction sanglante", peuvent être considérés comme deux versions d'une même carte
- Commandant donne une réduction de 5 Ko aux Guerriers *s'ils changent leur arme de base*
- 3 figurines différentes s'appellant simplement "Guerrier X" : il s'agit de la même base mais avec des équipements de base différents. Ils pourraient être renommés en fonction de leur arme de base : Guerrier au Marteau, Guerrier au Fauchard, Guerrier à la Francisque
- Forgeronne permet aux Guerriers de payer plus cher les armes ou armures pour un effet supplémentaire
- Lieutenant augmente de 1 la limite des Kherops non unique et non personnage dans son Ost ou fer de lance -> concept inexistant pour le moment
- Ogodei paye 10 de moins les armes à deux mains
- Porte bannière : bannière gratuite si le tambour fait parti du fer de lance, et elle confère Hors Normes

## Tembos

- Prendre en compte le surcoût des équipements pour les Tembos, et les compétences Vivacité et Fluet pour les Khémistes
- Point à noter : on ne va pas compter de surcout pour les armes spécifiques aux personnages Tembos et au Khépesh pour le moment, mais ce point devra être validé plus tard
- Khépesh est une arme réservée aux Tembos
- Peit arc d'Euthéria est une arme réservée aux Khémistes
- Tonfa est une arme réservée aux Guerriers, contrairement aux Khéros ceci désigne explicitement la figurine "Guerrier" Tembo, pas les Guerrières Khémiste ou les Guerriers d'autre factions

## Khârns

- Le Bourgmestre partage sa carte avec Raimbert, un personnage de la Guilde Noire. L'amélioration Opportunisme est pour le Bourgmestre, pas pour Raimbert
- Il existe plusieurs variantes des Guerriers Kharns et des Paladins, il s'agit des mêmes figurines mais avec des équipements de base différents. Ils pourraient être renommés en fonction de leur arme de base
- Engueran fait que les Paladins de son Fer de Lance coûtent 15 de moins uniquement s'il est le Leader
- Gaubert est considéré comme un Paladin, il profite donc du bonus d'Engueran et sa limitation P lui fait occuper la place d'un paladin niveau 3
- Key le Sénéchal partage une image avec le Négociateur de la Guilde (Guilde Noire). L'amélioration Key le Machiavélique est ratachée uniquement à Key le Sénéchal
- Myriam partage une image avec la Courtisane (Guilde Noire). La carte Pacte du Secret est ratachée uniquement à Myriam, et est un effet qui s'active si certains personnages sont recrutés dans l'Ost. Il s'agit d'un nouveau concept, nous devons afficher quand cette carte est active
- Syrga acquiert des compétences si certains personnages font parti de l'Ost

## Guilde Noire

- Beaucoup de cartes de la guilde partagent une image avec des cartes d'autres factions
- Attention à la carte Frère d'arme, elle donne des compétences de façon conditionnelle en fonction du nombre de gens dans la liste, et elle donne notamment "apatride" si au moins deux frères d'armes sont dans la liste. Ca veut dire que tous les frères d'armes doivent apparaître dans les rosters de toutes les factions même s'ils n'ont pas "apatride" de base
- La carte "Atouts de Mathys" donne aussi des compétences en fonction des frères d'armes dans la liste
- Khalsa est bi-faction, et sa carte lui donne des équipements gratuits quand elle fait parti de la Guilde Noire. Ces équipements doivent donc être des équipements de base et être gratuits

## Goûns

- Alaric a une amélioration qui a un effet si la liste comporte un certain nombre de modèles particuliers
- Alaric et les Sunkherces peuvent utiliser un sort particulier sans grimoire
- Artisane Dogon, Dogon, et des Mongos ont une stat en fonction du nombre de certains profils en jeu
- Il y a deux profils de Champion Tribal, qui sont les même mais avec des loadouts différents. On peut les nommer en fonction de leur loadout

## Affranchis

- Dossier de cartes nettoyé : 94 fichiers -> 24, une carte par fichier (recto illustré à gauche,
  stats à droite). 23 profils + la carte « Khalsa l'Ombre Lune ». Écartés : 43 doublons du pack
  « preview », 3 dos de carte et la carte de présentation du pack.
- **Khalsa** est bi-faction et sa carte spéciale lui donne des équipements et des compétences
  différents selon le camp : deux profils distincts (un GN, un Affranchi) portant chacun directement
  ce qui lui revient, plutôt qu'une règle conditionnelle. Le profil GN existe déjà
  (`guilde-noire-khalsa-2`, carte Affranchie en illustration). Sa carte affranchie n'affiche pas
  « Indépendant », que le profil GN porte : à revérifier.
- **Deux « Franc Cogneur Khérops »** : même illustration, niveau I (85 Ko, Lim 2) et niveau II
  (110 Ko, Lim U). Un seul modèle, deux niveaux - noter que le niveau II passe unique, ce qui est
  inhabituel.
- **Maraka** est goûne (« simple tisserande goûne », p.44) et **Clotrique** bûcheron de
  Ligneux-Ville : leur origine vient du récit, pas de leur carte. Pour les autres, elle se lit sur
  l'illustration du recto.
- Le **socle** (`profile.baseSize`, en mm) se lit à droite de la limitation, quand la carte le donne.
  Chez les Affranchis, seules les 11 cartes du pack de Renforts l'impriment ; les 12 autres n'ont
  rien et restent vides. Champ d'admin uniquement pour l'instant (section « Identité »), aucune règle
  ne le lit et le constructeur ne l'affiche pas encore.
- La nature carnivore / herbivore se déduit du peuple d'origine (`faction.nature`), conformément à la
  FAQ : chez les Affranchis elle dépend du visuel de la carte, c'est-à-dire du peuple représenté.
- Bonus de faction restés en **verbatim** parce qu'ils ne touchent ni la composition ni le coût : le
  +1 d'incantation par allié non activé dans l'aura, et le bonus de défense contre les tirs à couvert
  (égal au niveau).
- **Points restés en verbatim**, faute de mécanique qui les couvre - tous sont des effets de jeu,
  sans incidence sur la composition ni sur le coût :
  - Ferronière : « les Affranchis **khérops** dans son aura ». Viser une **origine** n'est pas
    exprimable par un sélecteur (`Selector` n'a pas de dimension `origin`).
  - Repenti, « Apprenti » : copie en début de partie une compétence générique d'un allié au choix.
  - Swe Dova, « Champion désigné » : draine jusqu'à 6 PA sur des Niveaux 1 alliés.
  - Vivandière « Fricot », Percussionniste « Tambour de la liberté », Béquilleur « Vorace »,
    Tireur Yuntaishan « Qui-vive », Clotrique (partage sa témérité), Mendiant (+3 en soutien).
- **Arme au nom générique, règles propres** : quand une carte donne à une arme banale un effet que
  l'objet partagé n'a pas, créer un objet **au nom de sa figurine**, réservé à elle
  (`reservedTo.profileIds`), plutôt que dévier l'objet commun. Trois cas ici : « Hache d'abattage de
  Boquillon » (dégâts et effets appliqués 2 fois en cas de RC), « Hache d'abattage de Clotrique »
  (+1 dégât, confère riposte) et « Marteau de guerre du Stoppeur » (+2 en défense en plus).
- **« Bol de Millet »** (Vivandière) : un **seul** objet. « 2 utilisations » n'est pas deux
  exemplaires - c'est une réserve interne qui se décompte en jeu, elle reste dans la description.
  Ne pas confondre avec les doses de poison de la Camériste, qui sont bien trois objets. Prix non
  imprimé, à confirmer.
- **Synkherces** : c'est une **carte spéciale** (portée : trait `synkherces`), qu'un mot-clé imprimé
  signale sur les cartes de profil. Elle existait pour le Guerrier Albinos mais n'accordait rien :
  Riposte et « Onde revigorante » étaient saisis en dur sur lui, donc ni visibles comme octrois ni
  réutilisables. Ils sont désormais portés par la carte (deux effets `target: self`), et Swe Dova la
  partage. Le Madrier n'a besoin d'aucun effet : il est déjà `reservedTo.traits: ["synkherces"]`.
  Le mot-clé suit la convention du projet : compétence `synkherce` pour l'affichage, trait
  `synkherces` pour la mécanique.
- **Furtivité** est passée « à valeur » dans le dictionnaire : la carte affranchie de Khalsa affiche
  « Furtivité 3 », les autres l'affichent sans valeur.
- **Stature** : aucune carte affranchie ne l'imprime. Toutes sont à 4 en valeur d'attente, flaguées.
