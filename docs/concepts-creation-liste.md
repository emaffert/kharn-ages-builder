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
- Exceptions de recrutement : **apatride**, **allié des X**, profils **sans logo**, **Guilde Noire**
  (via Sceau, +10 Ko). Le moteur valide l'appartenance.

## 3. Recrutement des unités (profils) [v1] [+]

- Chaque profil : **coût en Ko**, **niveau** (I/II/III), **limitation** (X / U / P).
- Le joueur ajoute des exemplaires ; respect des **limitations** (X = max, U = 1, P = 1 + occupe un
  emplacement d'un (modèle, niveau)).
- Coût cumulé en direct.
- UI : liste des profils disponibles (filtrés faction), recherche, ajout/retrait, compteur vs limitation.

## 4. Désignation du leader [v1]

- Choisir le **leader** parmi les deux plus hauts niveaux, ou un personnage.
- **[Bataille]** : un **Vassal** par FdL + un **Seigneur de guerre** pour l'Ost.
- Impact en jeu (aura, marqueurs SDG) ; pas d'impact de coût. UI : sélection du leader.

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
- À implémenter dans le moteur : le **budget de pages** (l'opération `spell-pages` est posée, pas encore enforce).

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

- **Effets optionnels (`optIn`)** : choix du joueur, non auto-appliqués. Ex. réduction « garde
  rapproché » de Djouked, **exclusive** avec un Larbin gratuit (budget partagé « Fille de Nyx »,
  max 2/FdL). L'UI doit proposer le choix et résoudre le budget partagé.
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

## Périmètre proposé pour la v1 (Fangs / escarmouche)

Concepts **1–7, 9, 11, 12, 13** (hors montures, pactes/PIONs/ordres réservés à la bataille).
Les montures et le mode bataille (8, 10) seront ajoutés avec les factions concernées.
