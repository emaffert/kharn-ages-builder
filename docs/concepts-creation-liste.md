# Concepts du constructeur de liste (joueur)

Inventaire des concepts à gérer dans l'écran joueur de création de liste, avec leur impact
sur le **coût** et la **validation**. Sert de base au design UX/UI.

Voir aussi : [`regles-creation-liste.md`](regles-creation-liste.md) (règles) et
[`schema-donnees.md`](schema-donnees.md) (modèle + moteur).

Légende : **[v1]** nécessaire pour Fangs/escarmouche · **[Bataille]** mode Ost · **[+]** déjà
représenté dans le moteur `evaluateList`.

## 1. Cadre de la liste [v1]

- **Format** : escarmouche (1 Fer de Lance) ou bataille (Ost = 3 à 5 FdL).
- **Format de points** : 300 / 400 / libre (escarmouche) ; 900–3000 (Ost), un FdL ≤ moitié de l'Ost.
- **Nom** de la liste.
- Validation : coût total ≤ format de points (avertissement ou blocage selon réglage).

## 2. Faction [v1] [+]

- Une **unique faction** par Fer de Lance → filtre les profils disponibles.
- Exceptions de recrutement :
  - **apatride** : recrutable par toutes les factions ;
  - **allié des X** : recrutable par X ou sa faction d'origine ;
  - profils **sans logo** : recrutables partout ;
  - **Sceau de la Guilde Noire** (source : FAQ + carte des règles de base) : une figurine **Guilde
    Noire** peut rejoindre un FdL d'une autre faction pour **+10 Ko**. *(Concept Guilde Noire, hors Fangs.)*
  - **Frères d'armes** (carte de Mathys, Guilde Noire) : dès qu'il y a **≥ 2** figurines « frère
    d'armes » dans un même FdL, elles deviennent **apatrides**. Conséquence pour le builder : on
    doit pouvoir les **ajouter dans n'importe quel FdL** (comme apatrides), mais la liste n'est
    **valide que s'il y en a au moins 2** (sinon erreur tant que la condition n'est pas remplie).
- Le moteur valide l'appartenance (`faction-membership`, + `grant-trait` conditionnel pour les
  frères d'armes).

## 3. Recrutement des unités (profils) [v1] [+]

- Chaque profil : **coût en Ko**, **niveau** (I/II/III), **limitation** (X / U / P).
- Le joueur ajoute des exemplaires ; respect des **limitations** (X = max, U = 1, P = 1 + occupe un
  emplacement d'un (modèle, niveau)).
- Coût cumulé en direct.
- **Unités dépendantes (recrutement lié)** : certaines unités ne se recrutent **pas seules** :
  - **Aliénés** (Likans) : uniquement **rattachés à un porteur** (femelle Fang), somme des niveaux
    ≤ niveau du porteur ;
  - **Muskh** : uniquement **via Xayìn** (`requires-present`).
  - UI : les ajouter **via leur dépendance** (bouton « + Likan » sur le porteur, Muskh proposé avec
    Xayìn), ou ajoutables mais **liste marquée invalide** tant que la dépendance n'est pas satisfaite.
- **Ordre des figurines** : le joueur peut **réordonner** sa liste (drag and drop) ; l'ordre est
  **conservé** dans le document de liste.
- UI : liste des profils disponibles (filtrés faction), recherche, ajout/retrait, compteur vs limitation.

## 4. Désignation du leader [v1]

- Choisir le **leader** parmi les deux plus hauts niveaux, ou un personnage.
- **[Bataille]** : un **Vassal** par FdL + un **Seigneur de guerre** pour l'Ost.
- Impact en jeu (aura, marqueurs SDG) ; pas d'impact de coût.
- UI : le leader ayant un impact en jeu, le **mettre en avant** — épinglé en tête de liste, **icône
  dédiée**, et/ou section à part. Sélection/changement du leader explicite.

## 5. Équipement par figurine [v1] [+]

- **Équipement de base** : coût déjà inclus ; on peut le **retirer** (réduit le coût) ou le garder.
- **Ajout** d'équipement : coût ajouté. Contrainte de **mains** (1 arme à 2 mains, ou 2 armes/bouclier
  à 1 main ; exception « Hors-norme »).
- **Arme gratuite** : 1 seule par figurine ; au plus la moitié du FdL avec la même arme gratuite.
- **Arc court** : niveau I uniquement. **Munitions** : quantités achetables.
- **Équipement réservé** (faction / profil / niveau). **Surcoût Tembo** (+3 Ko / tranche de 10).
- Contraintes par profil : ex. Larbin « Éprouvé » (pas d'arme), **Aliénés** (pas d'ajout d'équipement).
- Un équipement peut **conférer une compétence** (affichage).
- UI : par figurine, gérer l'équipement de base (retirer/garder) + ajouter depuis la liste autorisée,
  avec validation mains / arme gratuite / réservé.

## 6. Améliorations payantes (cartes spéciales) [v1] [+]

- Cartes d'amélioration sélectionnables **par figurine** (ex. « Apprentie de Nyx », « Crosse
  d'Ostéomancie »), **réservées** par portée (trait/profil), **coût** ajouté, confèrent
  effets/compétences/pages de sorts.
- UI : par figurine éligible, un sélecteur d'améliorations (filtré par portée).

## 7. Magie : grimoires & sorts [v1] [+ partiel]

- Une figurine **mage** (peut lancer, voie(s) de magie) peut prendre des sorts.
- **Sorts génériques** : gratuits, nombre ≤ niveau du lanceur.
- **Grimoires** : petit (20 Ko, 5 pages) / grand (40 Ko, illimité) ; coût ajouté.
- **Sorts de grimoire** : coût en Ko + occupent des **pages** ; réservés à la **voie** maîtrisée.
- **Budget de pages** = pages du grimoire + bonus (ex. Fille de Nyx +3, Crosse +3). Sorts choisis ≤ budget.
  (Un grand grimoire étant illimité, les bonus de pages y sont sans objet.)
- UI : par mage, choisir grimoire (ou aucun), sélectionner sorts (générique : ≤ niveau ; grimoire :
  ≤ budget de pages + bonne voie) ; coût.
- Moteur : le **budget de pages** est appliqué (`spell-pages` → capacité, dépassement signalé par
  `pages-over-capacity`), de même que grimoire interdit, mains/armure et absence de lanceur.

## 8. Montures & cavaliers [Bataille]

- **Monture** = équipement incessible recruté avec le cavalier ; niveau **±1** de celui du cavalier.
- Coût de la monture + **options** (caparaçon, lance de cavalerie, compétences) avec restrictions de faction.
- Restrictions : Berserk → pas de monture ; Embuscade/Endurance inutilisables montés.
- UI : pour un cavalier éligible, ajouter une monture (choix du niveau), puis ses options.

## 9. Modèles Aliénés [v1 pour Fangs (Likans)] [+ attachement]

- Recrutés **rattachés** à un porteur (femelle Fang) ; somme des niveaux des Aliénés ≤ niveau du porteur.
- **Pas d'ajout d'équipement** ; n'ont que les armes décrites sur leur carte.
- UI : rattacher des Aliénés à un porteur (relation), avec validation de la somme des niveaux.

## 10. Spécifique mode Bataille [Bataille]

- **Pactes** (1 par Ost) : conditions de composition + avantage.
- **PIONs** : achat 1 à 3 (5/10/15 Ko), sous conditions d'infériorité.
- **Ordres** : « équipements » pour Vassaux/SDG, coût intégré au « barda ».
- **Formations** : optionnelles, sans coût (choix en jeu).
- UI : composition de l'Ost (plusieurs FdL), choix du pacte, PIONs, ordres.

## 11. Choix dynamiques & exclusifs [+ partiel]

- **Garde rapproché (Fille de Nyx)** : chaque Fille de Nyx assigne **un** garde rapproché — en
  général un **Larbin gratuit**, mais **Broutcha** peut l'assigner à **Djouked** (qui obtient alors
  −35). Choix **exclusif**, budget partagé, **max 2 par FdL**. Deux approches UI possibles :
  - (a) **choix explicite** du garde rapproché par chaque Fille de Nyx ;
  - (b) **calcul automatique** (optimisation), MAIS la **cause** de chaque gratuité/réduction doit
    rester **visible** (quel Larbin est gratuit grâce à quelle Fille de Nyx ; pourquoi Djouked est réduit).
- **Effets optionnels (`optIn`)** plus généralement : choix du joueur, non auto-appliqués par le moteur.
- **Effets conditionnels à la composition** (octrois de trait/compétence, modificateurs de coût)
  recalculés en continu par le moteur.

## 12. Coût total & validation [v1] [+]

- **Coût total en direct** = Σ (profils ± équipement ± améliorations + grimoire/sorts + monture/options
  + ordres + PIONs), après application des effets de coût.
- **Validation** : limitations, faction, mains, arme gratuite, attachement, requires-present,
  forbids-equipment, réservés, budget de pages, éligibilité monture, composition de pacte, format de points.
- **Erreurs** (bloquantes) vs **avertissements**, chacune avec son **wording verbatim**.

## 13. Persistance & partage [déjà conçu]

- Sauvegarde locale (IndexedDB/Dexie), nom, document de liste **portable et versionné** (`snapshot`).
- **Export** : texte (lisible) + code/lien portable. **Import** des deux. Ré-hydratation par id/nom.

## Décisions UX (v1)

- **Disposition** : **deux colonnes** — roster de la faction (gauche) ↔ liste en cours (droite),
  coût/validation en direct.
- **Édition des options d'une figurine** : **modale en onglets** (Carte / Équipement / Améliorations /
  Magie) ouverte au clic sur la figurine.
- **Validation** : **stricte** — on empêche l'action qui viole une règle dure (limitation atteinte,
  arme sur un Larbin, mains, etc.). Les cas **conditionnels à la composition** (frères d'armes ≥ 2,
  rattachement des Aliénés) restent validés au **niveau liste** (ajout possible, liste invalide tant
  que la condition n'est pas remplie). Dépendances simples (Muskh→Xayìn) gérées par activation
  conditionnelle du bouton d'ajout.
- **Leader** mis en avant (épinglé en tête + icône). **Réordonnancement** des figurines (drag & drop).

## Périmètre proposé pour la v1 (Fangs / escarmouche)

Concepts **1–7, 9, 11, 12, 13** (hors montures, pactes/PIONs/ordres réservés à la bataille).
Les montures et le mode bataille (8, 10) seront ajoutés avec les factions concernées.
