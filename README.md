# Khârn-Âges - Constructeur de listes

Application web (PWA, local-first) de création de listes pour le jeu de figurines
**Khârn-Âges**. Aucune dépendance serveur : tout fonctionne dans le navigateur ;
l'authentification et la synchronisation cloud sont prévues comme couche additive ultérieure.

## Stack

TypeScript + React + Vite + Tailwind CSS, validation par Zod, tests avec Vitest.
Cible mobile : PWA installable. Voir [`docs/stack-technique.md`](docs/stack-technique.md).

## Documentation

- [`docs/regles-creation-liste.md`](docs/regles-creation-liste.md) - règles métier (source de vérité).
- [`docs/schema-donnees.md`](docs/schema-donnees.md) - modèle de données et architecture.
- [`docs/stack-technique.md`](docs/stack-technique.md) - choix techniques.
- [`docs/tests.md`](docs/tests.md) - organisation des tests (cœur et vue) et couverture.
- [`docs/procedure-import-faction.md`](docs/procedure-import-faction.md) - guide d'import d'une nouvelle faction (méthode et pièges).

## Prérequis

Node 20+ (le projet est développé et validé sous **Node 26**, géré par `nvm`).
Le `Makefile` charge automatiquement la bonne version de Node ; aucune activation manuelle
de `nvm` n'est nécessaire.

## Commandes

```bash
make install      # installer les dépendances
make dev          # serveur de développement (puis ouvrir l'URL locale affichée)
make test         # lancer les tests une fois
make test-watch   # tests en mode watch
make build        # build de production
make typecheck    # vérification TypeScript
make preview      # prévisualiser le build de production
make help         # liste des cibles
```

## Structure

```text
src/
  core/   # cœur métier (TypeScript pur, sans dépendance UI)
    model/    # types + schémas Zod (catalogue, liste portable)
    engine/   # validation des contraintes, résolution des effets, calcul de coût + magie
  data/   # catalogue (JSON) + chargement validé
  ui/     # kit de composants partagés (Button, Tag, Dialog…), libellés partagés (labels.ts)
          #   et helpers de présentation (traduction lisible des règles)
  app/    # écrans + état applicatif
    builder/  # constructeur de listes (sélection de faction, roster, éditeur de figurine)
    admin/    # éditeur de catalogue (CRUD profils/équipements/sorts…), stylé sur les classes .adm-*
    io/       # persistance Dexie + sérialisation (code portable, texte) + ids
docs/     # documentation de conception
cards/    # images des cartes (gitignoré - copyright ; servi en dev uniquement)
```

Règle d'or : `src/core` ne dépend de rien ; tout le reste dépend de `core`.

## L'application

Deux écrans, accessibles par les onglets du haut :

- **Constructeur** (onglet par défaut au lancement) - la création de listes joueur ;
- **Admin** - l'éditeur du catalogue de référence.

## Le constructeur de listes

Flux : **sélection de faction** (format escarmouche/bataille, budget en Ko, ou reprise d'une
liste sauvegardée) → **écran de construction**.

- **Roster** (à gauche ; en modale sur mobile) : profils groupés en **Personnages**, **Troupes**,
  **Recrutement conditionnel** (unités recrutées via un porteur, ex. Likan), **Hors Faction**
  (recrues inter-factions : apatrides et « Allié des X »), **Frères d'armes** (compagnons qui
  deviennent apatrides en groupe) et **Montures** (types accessibles à un profil recrutable, selon
  son origine). Ajout rapide, ou aperçu de la carte avant recrutement.
- **Liste** (au centre) : figurines réordonnables par glisser-déposer, dépliables ; désignation
  du **meneur**, du **garde du corps**, rattachement des unités dépendantes (Likan/Muskh).
- **Éditeur de figurine** (modale, en onglets) : Carte, Équipement (achat/retrait, munitions,
  emplacements de mains/armure), Améliorations (cartes spéciales optionnelles), Magie (grimoire,
  budget de pages, sorts).
- **Coût et validation** entièrement dérivés du moteur (`evaluateList`) : coût par figurine et
  total, budget, et signalement des erreurs (limitation, faction, meneur, magie…).
- **Sauvegarde locale** (Dexie/IndexedDB) et **import/export** en deux formats : *code portable*
  (compact, fidèle) et *texte* (lisible, réimport best-effort). Voir
  [`docs/schema-donnees.md`](docs/schema-donnees.md) - couche 3.

## Données du catalogue

La **source de vérité du catalogue est `src/data/catalog.json`** (toutes les factions).
Il est **validé par Zod** au chargement (`parseCatalog`). On ne l'édite pas à la main :
on passe par l'éditeur admin, qui exporte un JSON à recommiter (les imports de faction sont
l'exception - voir [`docs/procedure-import-faction.md`](docs/procedure-import-faction.md)).

Cycle de mise à jour des données :

1. lancer `make dev` et ouvrir l'éditeur ;
2. corriger les profils dans l'interface ;
3. cliquer **Exporter JSON** ;
4. remplacer `src/data/catalog.json` par le fichier exporté, puis commiter.

## L'éditeur admin

Accessible par l'onglet **Admin**. À gauche, la liste des entrées du catalogue - profils,
équipements, compétences, cartes spéciales, sorts, voies de magie, montures, réglages - avec
recherche et indicateur ⚠ pour les profils ayant des champs à vérifier. À droite, le détail de
l'entrée sélectionnée.

L'admin partage le **système visuel** de l'application (tokens « Forge / Braise », thème
clair/sombre, composants `@ui`) ; son UI est découpée en modules sous `src/app/admin/`.

Champs modifiables :

- **identité** : nom, coût, niveau, faction, limitation (type + valeur), personnage (le statut de
  mage est **dérivé** : une figurine lance dès qu'elle possède la compétence d'une voie de magie) ;
- **caractéristiques** : V, P, A, C, T, I, stature, PA, PV ;
- **compétences** (depuis le dictionnaire), **traits**, **équipement de base** ;
- **règles de carte** (texte verbatim - fait foi).

Les **contraintes et effets** sont affichés en **lecture seule**, traduits en français lisible
à côté de leur wording officiel, avec des badges (sévérité, auto-vérifiée ou simple note,
calculé par l'éditeur ou effet en jeu, et via quelle carte spéciale). Cela permet de vérifier
que le moteur comprend et applique correctement chaque règle.

### Données à vérifier

Certaines valeurs lues sur les cartes sont incertaines (échelle de stature peu lisible,
domaines des dés de maîtrise, quelques caractéristiques). Elles sont **marquées « à vérifier »**
(champ `unverifiedFields`), surlignées en ambre, avec un bouton **⚠** sur chaque champ pour
basculer entre « à vérifier » et « validé ». Un compteur global est affiché.

### Boutons

- **Exporter JSON** : télécharge le catalogue édité.
- **Importer** : recharge un catalogue depuis un fichier JSON (validé par Zod ; un message
  d'erreur s'affiche si le JSON est invalide).
- **Réinitialiser** : revient à la donnée d'origine (annule les modifications locales).

Les modifications sont conservées dans le navigateur (localStorage) entre les sessions.

### Aperçu des cartes (dev uniquement)

En développement, le détail d'un profil affiche l'**image de la carte source** (servie par un
middleware Vite depuis `cards/`, actif seulement avec `make dev`). Ces images ne sont jamais
incluses dans le build de production.

## Tests

`make test` exécute la suite Vitest : validation du catalogue, moteur d'évaluation
(coût, contraintes, effets), traduction des règles, sérialisation, et rendu des vues
(React Testing Library + jsdom). Couverture : `make coverage`. Organisation, conventions et
guide des **tests de vue** dans [`docs/tests.md`](docs/tests.md).

## Licence

Le **code source** de ce projet est distribué sous licence **GNU AGPL-3.0-or-later**
(voir [`LICENSE`](LICENSE)).

> **Avertissement de propriété intellectuelle.** « Khârn-Âges », « Kârn-Âges Tactik »,
> ainsi que tous les noms, règles de jeu, profils, caractéristiques et images associés
> sont la propriété de **TGCM Création** (<https://www.tgcmcreation.fr>) et **ne sont pas
> couverts par cette licence**. Il s'agit d'un outil de fan, à but non commercial ; aucun
> droit sur ces éléments n'est cédé ni impliqué.
