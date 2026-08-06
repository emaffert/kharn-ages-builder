# Briskars : concepts à couvrir dans le constructeur de liste

## En bref

Briskars et Khârn-Âges reposent sur la même charpente. Le portage est donc faisable, et la grande
majorité des concepts se ramène à du re-paramétrage de mécanismes déjà écrits et testés. Trois
chantiers seulement sont réellement neufs : les montures et cavaliers, les pièces d'artillerie et la
réserve d'avant partie.

Comptons **60 à 90 heures de développement**, hors mode campagne, et **hors saisie du catalogue**
qui reste, comme pour Khârn-Âges, le poste le plus lourd de tous.

Deux repères pour situer ce chiffre : le projet Khârn-Âges représente à ce jour un peu plus d'une
centaine d'heures, catalogue partiellement compris, et les deux chantiers qui lui restent à livrer,
le Barda et le mode Bataille, sont estimés ensemble à **40 à 60 heures**. Porter Briskars et finir
Khârn-Âges sont donc deux efforts du même ordre de grandeur.

Deux nuances sur cet étalon, qui jouent en sens contraire. D'un côté, cette centaine d'heures ne
couvre qu'**une partie de la saisie du catalogue** : le reste, ainsi qu'une passe de vérification, a
été fait par quelqu'un d'autre. Le poste catalogue est donc sous-représenté dans le repère, et il
faut bien le compter en plus pour Briskars. De l'autre, **nous avons désormais l'expérience du
domaine** : ajouter un modèle, un effet, une contrainte ou un écran d'administration suit
aujourd'hui des chemins connus, ce qui rendra le portage plus rapide que ne l'a été la construction
initiale, à mécanique équivalente.

## Comment lire cette liste

Première liste des concepts du jeu qui influencent la construction d'une bande, avec pour chacun ce
dont on dispose déjà dans le constructeur Khârn-Âges et la charge de portage.

Les charges sont données en **heures de développement**, à la louche, et calibrées sur le rythme
réel du projet Khârn-Âges. Elles ne comprennent ni la saisie du catalogue, ni la mise en place du
dépôt.

Ce qui coûte cher n'est presque jamais la règle elle-même mais l'**interface** qui va avec : une
validation sans écran se compte en minutes, un concept qui demande un nouveau panneau de saisie se
compte en heures.

## 1. Cadre de la liste

- **Budget de la bande en pièces d'or.** Même principe que nos Kô, avec coût cumulé en direct.
  Renommage et jauge existante. Charge : 1 h.
- **Format tournoi avec sous-budgets.** Le format découpe l'enveloppe globale : un plafond de
  figurines, et une **fourchette d'équipement** avec un minimum comme un maximum (entre 25 et 75 PO
  dans l'exemple de la FAQ). Demande un écran de saisie du format, une ventilation du coût par type
  d'élément et plusieurs jauges. Charge : 6 à 8 h.
- **Réserve « side »** d'équipements permutables avant la partie. C'est le même concept que notre
  **Barda**, en plus simple : le Barda accueille en plus des figurines de réserve, des sorts de
  grimoire et le changement de niveau des Safars entre les rondes, trois choses que le side ne
  connaît pas. Attention, le Barda est conçu mais **pas encore développé**. Charge : 10 à 14 h, ou
  3 à 4 h seulement si le Barda est livré d'ici là pour Khârn-Âges.
- **Nom, sauvegarde, export et partage de la liste.** Tout est déjà en place. Charge : néant.

## 2. Recrutement des figurines

- **Une faction par bande**, qui filtre les profils disponibles. Identique chez nous. Charge : 1 h.
- **Briskars uniques et génériques à limitation chiffrée.** C'est exactement nos limitations U et X.
  Charge : 1 h.
- **Trait « Fraternité »** qui rend un profil recrutable par plusieurs factions. Équivalent de nos
  « alliés des X ». Charge : 1 h.
- **Apatrides**, qui deviennent membres de la faction qui les recrute. Concept déjà géré.
  Charge : 1 h.
- **Mercenaires**, jamais plus nombreux que les membres de la faction qui les emploie. Règle de
  proportion du même type que nos esclaves, sans interface. Charge : 2 h.
- **Contrats et alliances entre factions.** Notre modèle est plus simple aujourd'hui (une faction
  plus quelques exceptions). Nouveau mode de recrutement, avec sa déclaration dans l'écran de liste
  et son coût. Charge : 6 à 10 h, à confirmer, les sources nous manquent.
- **Profils qui ouvrent ou restreignent le recrutement d'autres** (Torquemada et ses miliciens,
  Yuanshi et ses disciples, la carte « La presse »). Le moteur sait déjà faire ce genre de chose.
  Charge : 1 à 2 h.
- **Figurines liées à une autre** (montures, invocations, totems, fétiches), qui ne se recrutent pas
  seules. Le mécanisme de rattachement existe. Charge : 4 à 6 h.
- **Leader désigné automatiquement**, à savoir le Briskar le plus cher équipement compris. Chez nous
  le joueur choisit son leader à la main : c'est une simplification de l'existant, sans interface à
  ajouter. Charge : 1 à 2 h.
- **Exceptions à la désignation du leader** : un mercenaire ne peut pas l'être hors bande de
  mercenaires, un équipement peut faire d'un non-magicien le leader. Charge : 1 h.

## 3. Figurines particulières

- **Montures et cavaliers.** L'équipage, le mot-clé Cavalier, la monture qui a son propre profil et
  son propre logo de faction. Nos montures sont traitées comme un équipement du cavalier, la
  transposition n'est pas directe. Côté constructeur, l'essentiel se ramène à une figurine liée à
  une autre, avec sa faction et son coût : les règles de chevauchée ne servent qu'en partie.
  Charge : 8 à 12 h.
- **Pièces d'artillerie.** Points de structure au lieu de points de vie, et servant à désigner avant
  la partie. Nouvelle catégorie de figurine recrutable, plus un petit écran de désignation.
  Charge : 6 à 10 h.
- **Figurines non vivantes** (totems, invocations). Rien d'équivalent, mais elles s'appuient sur le
  rattachement ci-dessus. Charge : 3 à 4 h.

## 4. Équipement

- **Catalogue d'équipement additionnel** : armes de corps à corps, armes de tir, armures, objets
  divers. La structure est identique à la nôtre, portées, cadence, recharge et allonge comprises.
  Charge : 2 h.
- **Limitation par bande** : un exemplaire par bande par défaut, certains objets non limités,
  d'autres limités à deux, d'autres à un par figurine. Nos limitations portent sur la figurine et
  non sur la bande, il faut un nouveau niveau de décompte et ses messages. Charge : 4 h.
- **Éligibilité anatomique** : pas de bras, une seule pince, arme à deux mains. La contrainte de
  mains est déjà gérée. Charge : 2 h.
- **Armure achetée qui remplace celle de la carte**, avec son malus de mouvement. Proche de notre
  gestion des emplacements d'armure. Charge : 2 h.
- **Force minimale requise pour porter une armure.** Condition simple à ajouter. Charge : 1 h.
- **Poison réservé aux armes tranchantes de corps à corps**, limité à deux par bande. Cas très
  proche de notre Affûtage. Charge : 2 h.
- **Arme hors savoir-faire** (une arme à feu se recharge plus lentement dans les mains d'un
  spécialiste du corps à corps). Simple avertissement d'affichage, pas un blocage. Charge : 1 h.
- **Équipements liés à l'artillerie** (gargousses, boulets). Charge : 1 h.

## 5. Magie

- **Six voies de magie** et maîtrise déclarée par profil. Identique chez nous. Charge : 1 h.
- **Sorts propres à la carte du mage.** Identique. Charge : 1 h.
- **Sorts génériques achetés dans les voies maîtrisées.** Identique, et même plus simple puisqu'il
  n'y a pas de budget de pages. Charge : 2 h.
- **Grimoire et parchemin** comme laissez-passer vers une autre voie. Nos grimoires servent à autre
  chose : mécanique à repenser et sélecteur de sorts à revoir. Charge : 4 à 6 h.
- **Coût du mage égal à sa valeur plus celle de tous ses sorts.** Identique. Charge : 1 h.

## 6. Fiche de figurine dans le constructeur

- **Caractéristiques** Constitution, Dextérité, Force, Mental, Mouvement, points d'action et points
  de vie. Notre bloc de caractéristiques est là, il change juste de noms, dans le constructeur comme
  dans l'administration. Charge : 2 à 3 h.
- **Armure avec ses cases à cocher et son seuil.** Modèle quasiment identique au nôtre.
  Charge : 1 h.
- **Valeurs de combat dérivées** (attaque, botte, tir, défense, esquive, contre). Purement
  calculatoire. Charge : 1 à 2 h.
- **Compétences, règles spéciales et bottes** de chaque carte. Identique. Charge : 1 h.
- **Portraits et illustrations des cartes.** Toute la chaîne existe déjà. Charge : 1 h.

## 7. Hors périmètre d'une première version

- **Mode campagne** : carrières, expérience, navire, port d'attache, succès, rareté à l'achat des
  sorts. Ce n'est plus un constructeur de liste mais un suivi d'équipage entre parties, à traiter
  comme un produit distinct. Charge : au moins autant que tout le reste, à chiffrer séparément.
- **Scénarios et conditions de victoire.** Sans effet sur la construction de liste. Charge : néant.

## Ordre de grandeur global

La somme ligne à ligne, plus quelques heures pour monter le dépôt et retirer le spécifique
Khârn-Âges, dépasse la centaine d'heures. Mais les sommes ligne à ligne surestiment toujours, parce
que les petits postes se traitent par paquets : renommer les caractéristiques ou câbler les cinq
points de magie, c'est une séance, pas quinze additions.

Retenons donc **60 à 90 heures de développement** pour une première version complète, hors mode
campagne et **hors saisie du catalogue**. Cette dernière est à prévoir en plus, et son volume dépend
du nombre réel de cartes, que nous ne connaissons pas encore.

Le repère utile pour le product owner : **porter Briskars coûte à peu près ce qu'a coûté
Khârn-Âges**, peut-être une fois et demie si les livres de saison réservent des surprises. Ce n'est
pas contradictoire avec le fait que l'infrastructure soit offerte : on ajoute en échange des
mécaniques que Khârn-Âges n'a jamais eues (artillerie, sous-budgets de tournoi, réserve d'avant
partie) et il faut démêler les niveaux, qui irriguent tout le moteur actuel.

C'est un ordre de grandeur, pas un engagement : chaque ligne est une estimation à vue, et les
sources dont nous disposons sont incomplètes.

## Ce qui disparaît par rapport à Khârn-Âges

Briskars ne connaît ni les niveaux I, II et III, ni les dés de maîtrise, ni la stature, ni l'arme
gratuite, ni l'esclavage, ni les creusets d'origine, ni le mode bataille avec ses Osts, ses pactes
et ses ordres.

## Les points d'attention

1. **Le vrai gros morceau n'est pas dans cette liste** : c'est la saisie du catalogue, autrement dit
   toutes les cartes de profil, de sorts, d'artillerie et de montures, éditions limitées comprises.
   Sur Khârn-Âges, c'est le poste qui a coûté le plus de temps, très loin devant le développement.
2. **C'est en lisant les cartes que le reste du travail apparaîtra.** Les règles générales ne
   décrivent qu'une partie du jeu : chaque profil porte ses propres contraintes et ses propres
   effets, et c'est en les dépouillant qu'on découvrira ce qu'il reste à développer. Les estimations
   ci-dessus ne peuvent donc pas être complètes.
3. **Trois chantiers seulement sont vraiment lourds** : les montures et cavaliers, l'artillerie avec
   son servant et la réserve d'avant partie, auxquels s'ajouterait le mode campagne si vous le
   souhaitez un jour. Tout le reste est du re-paramétrage de mécanismes déjà écrits et testés, à une
   réserve près : quelques concepts s'appuient sur des chantiers Khârn-Âges conçus mais pas encore
   livrés, le Barda pour le side en particulier.

## Réserve sur les sources

Cette liste s'appuie sur le livre de règles de base, la mise à jour montures d'avril 2025 et la FAQ
de juillet 2024. Le livre de base ne connaît que quatre factions alors que la FAQ en cite déjà bien
davantage, et les livres de saison ainsi que le livre de campagne sont référencés sans être
fournis. Des concepts ont donc pu m'échapper.
