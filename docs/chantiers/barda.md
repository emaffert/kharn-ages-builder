# Chantier - Gestion du Barda

Statut : **étude, non commencé**. Rédigé le 2026-08-04.

Source : `~/Downloads/geste-de-safar-v2.0.pdf`, section « Le mode escarmouche », pages 5-6
(« Le format de Fer de Lance et Barda », « Restrictions de composition de Fer de Lance »).

Ce document rassemble les règles, l'état actuel du code, les arbitrages à trancher et le découpage
du travail. Les charges sont en **heures**, calibrées sur le rythme réel du projet (réétalonnées le
2026-08-06 ; la version précédente chiffrait en jours et surestimait d'un facteur cinq à six). Il est fait pour être repris tel quel plus tard, sans avoir à relire le PDF.

> **L'ordre d'exécution ne se lit plus ici.** Ce chantier a été fusionné avec
> [`mode-bataille.md`](mode-bataille.md) dans [`feuille-de-route-ost.md`](feuille-de-route-ost.md),
> qui remplace le découpage de la section 4 ci-dessous. Cette page reste la référence pour les
> **règles** et l'**état du code**.

## 1. Les règles

### Format

Le format de Fer de Lance est de **500 Kouronnes tout équipement compris** (armes, armures,
boucliers, sorts, grimoires, objets, etc.), sauf précision expresse pour un événement donné
(tournoi en binôme, triplette, élimination directe…).

Ce format est modulé par deux aspects.

**Premier aspect - la modulation entre rondes.** Entre chaque ronde d'un même tournoi, un joueur
peut modifier les **niveaux** des Safars qu'il a engagés dans son Fer de Lance, tant qu'il respecte
les contraintes de composition imposées. Il peut par ce biais retirer un Safar de son Fer de Lance
pour accueillir des niveaux plus élevés des autres figurines qui le composent.

> Exemple du livret : un Guerrier Khârn niveau I à 65 Ko avec sa lance pourra être modulé avant le
> début d'une ronde en Guerrier niveau II ou III. De même, son équipement pourra être attribué à un
> autre Safar, **sauf s'il lui est propre**, c'est-à-dire ne figurant pas dans la liste des
> équipements génériques et/ou le pack d'équipement.

**Second aspect - le Barda.** À chaque Fer de Lance est associé un **Barda de 100 Kouronnes
maximum**. Il est constitué de tout ce que le joueur souhaite pour pouvoir moduler son Fer de Lance
entre les rondes : des **équipements**, des **sorts de grimoires additionnels**, mais aussi des
**Safars de réserve**.

Un Safar de réserve est intégré au Barda **sous la forme de son plus petit niveau disponible** et
**au coût de sa carte de profil**, c'est-à-dire comprenant l'équipement référencé sur sa carte. Il
est donc impossible de réserver un Safar de plus de 100 Kouronnes dans son Barda ; mais s'il est
déclinable en plusieurs niveaux, **ils sont tous accessibles lors de la phase de composition**.

### Restrictions de composition

Les limitations spécifiques à un événement restent à la discrétion des organisateurs. Il est
toutefois admis que :

- Un Safar donné dans un Fer de Lance ne peut être équipé que d'**une seule arme gratuite** inscrite
  sur la feuille de guerre du joueur.
- Il est possible d'équiper plusieurs fois la même arme gratuite sur des Safars différents, **sans
  dépasser plus de la moitié du Fer de Lance** équipé de la même arme gratuite. (Exemple du livret :
  jusqu'à 3 Guerriers avec des cannes gratuites si le Fer de Lance compte au moins 6 combattants.)
- Il n'est possible d'avoir dans son Barda que des **armes gratuites qui ne sont pas déjà attribuées**
  à un Safar du Fer de Lance. (Exemple : une Goulue équipée d'un arc court interdit d'en mettre un
  second au barda en prévision d'un changement de composition.)
- Les armes et plus généralement les équipements **payants ne sont pas limités**, à l'exception de
  l'« amulette du Culte » : on ne peut pas en posséder plus dans un Fer de Lance que le nombre de
  **niveaux cumulés des magiciens** qui le composent. (Exemple : un Bourreau du Sacrifice permet
  d'en posséder 2 dans un Fer de Lance khérops.)
- Tous les autres aspects (limitations par niveau, coûts, nombre de projectiles…) doivent respecter
  les limitations existantes.

### Portée

Le Barda n'apparaît que dans la partie **escarmouche** de la Geste. Aucune mention dans la partie
mode Bataille. Attention au faux ami : `docs/regles-creation-liste.md` et
`docs/concepts-creation-liste.md` emploient déjà le mot « barda » à propos des **Ordres** du mode
bataille (« coût intégré au barda de l'Ost ») - c'est un autre sens, sans rapport avec ce chantier.

## 2. État actuel du builder

### Ce qui joue en notre faveur

- **`FerDeLance` est déjà une entité à part** (`src/core/model/list.ts:78`, `FerDeLanceSchema`) : le
  Barda s'y accroche naturellement, y compris en mode bataille où il y en a plusieurs.
- **Aucune migration de base de données.** Le document de liste est stocké tel quel : en JSON
  compressé pour le code portable (`src/app/io/listCode.ts`) et en colonne `jsonb` côté Supabase
  (`supabase/migrations/0001_init.sql:78`, `lists.data` = ListDocument sérialisé). Un champ optionnel
  de plus est gratuit.
- **Aucune couche de migration de liste à écrire.** `parseListDocument` (`src/core/model/index.ts:29`)
  se contente de valider par Zod - `migrate.ts` ne concerne que les **catalogues**. Un champ optionnel
  est donc rétrocompatible par construction.
- **Le moteur a un point d'entrée unique**, `evaluateList` (`src/core/engine/evaluate.ts:2208`), qui
  rend déjà `costByFerDeLance` et une liste d'`issues` typées. Le Barda s'y branche sans réécriture.
- **Un panneau au niveau de la liste existe déjà comme modèle** : `OstPanel`
  (`src/app/builder/OstPanel.tsx`, monté en `src/app/builder/BuilderScreen.tsx:719`), sélection
  d'opt-ins hors figurine, replié par défaut.
- **Le budget est déjà éditable** dans l'en-tête (`pointsLimit`, `BuilderScreen.tsx:249`, et le choix
  300/500/libre dans `FactionSelect.tsx:51`).

### Ce qui coince

- **Tout le calcul d'équipement suppose un porteur.** `equipmentDiscount`
  (`src/core/engine/evaluate.ts:190`), `temboEquipmentSurcharge` (`:212`), `costByFaction`, et les
  **54 équipements à `reservedTo`** du catalogue se résolvent contre un profil. Un objet posé dans le
  Barda n'a pas de porteur : il faut une variante « sans porteur » du prix **et** du filtre
  d'éligibilité. C'est le vrai coût technique du chantier.
- **`EquipPanel` (519 l.) et le roster sont écrits autour d'une instance de figurine.** Le sélecteur
  du Barda ne peut pas les réutiliser tels quels ; il faudra soit extraire la partie « catalogue
  filtré + prix affiché », soit accepter un composant parallèle plus simple.
- **Rien n'existe côté Barda** aujourd'hui : zéro occurrence dans `src/`.
- **Les restrictions d'armes gratuites du même chapitre sont faites** (2026-08-05, cf.
  `validateFreeWeapons` dans `evaluate.ts` et `freeWeaponsCarried` dans `engine/equipment.ts`) : une
  seule arme gratuite par Safar, carte comprise, et pas plus de la moitié du Fer de Lance sous la
  même arme gratuite achetée. Le décompte sur lequel s'appuie la troisième contrainte de Barda
  (« arme gratuite non déjà attribuée ») est donc déjà écrit. **Le plafond d'amulette du culte, lui,
  reste à faire.**
- **Le format texte demande un aller-retour explicite** (`src/app/io/listText.ts`, export + import
  best-effort par nom) : le Barda doit y être écrit et relu, sinon un aller-retour le perd.
- **Un client plus ancien perdrait silencieusement le Barda** : Zod retire les clés inconnues à la
  lecture. À garder en tête pour la synchro multi-appareils.

### Repères de catalogue (v0.5.0, règles FAQ 2026-01)

- 144 équipements, dont **8 gratuits** (cost 0 ou absent), **54 avec `reservedTo`**, **1 avec
  `costByFaction`**.
- 154 profils, 104 modèles, 10 montures, 27 cartes spéciales.
- 42 sorts de grimoire, **tous budgétés en pages**, dont **3 seulement ont un prix en Ko** (10 Ko) :
  `seduction-du-fiel`, `inflection-mentale`, `guerison-des-limbes`. Grimoires : petit 20 Ko / 5 pages,
  grand 40 Ko / illimité.
- L'amulette du culte existe bien : `guilde-noire-amulette-du-culte`, 6 Ko, sans `reservedTo`.

## 3. Arbitrages à trancher avant de coder

Ce sont des décisions de règle, pas de code. Aucune n'est bloquante pour commencer le modèle de
données, toutes le sont pour finir le moteur.

1. **Prix d'un objet sans porteur.** Proposition : prix nominal, faction du Fer de Lance pour
   `costByFaction`, **pas** de remise de porteur (Ogodeï, Commandant) ni de surcoût tembo, puisqu'on
   ne sait pas encore qui le portera. Conséquence assumée : le prix payé au Barda peut différer du
   prix qu'aurait coûté le même objet acheté sur une figurine.
2. **Sorts de grimoire au Barda.** Ils se paient en **pages**, pas en Ko : sur 42, seuls 3 ont un
   prix. Rangés au Barda, ils ne consommeraient donc quasiment jamais de budget - est-ce l'intention
   du livret ? Question corollaire : peut-on ranger un **grimoire** (20/40 Ko) au Barda ?
3. **Éligibilité sans porteur.** Sans figurine, `reservedTo` n'est pas applicable. Proposition :
   proposer tout ce qu'**au moins un profil de la faction** pourrait acheter.
4. **Réserve = modèle ou profil ?** Le texte décrit un modèle rangé à son plus bas niveau, dont tous
   les niveaux redeviennent accessibles à la composition. Proposition : stocker le `profileId` du
   niveau le plus bas (l'entité qui porte le prix) et **afficher** les niveaux accessibles. Le
   `modelId` existe déjà sur le profil pour les retrouver.
5. **Origine choisie.** Un profil à `originChoices` (Agent sombre) rangé en réserve : fige-t-on
   l'origine au moment de la mise au Barda, ou au moment de la composition ? Proposition : au Barda,
   comme pour une figurine recrutée (`ProfileInstance.origin`).
6. **Portée du plafond.** 100 Ko par Fer de Lance, donc en mode bataille autant de bardas que de Fers
   de Lance. À confirmer, la Geste ne parle que d'escarmouche.
7. **Le Barda compte-t-il dans le budget affiché ?** Proposition : non, deux jauges distinctes
   (500 / 100), parce que ce sont deux plafonds indépendants dans le livret.

## 4. Découpage du travail

### Phase 1 - le Barda lui-même : 8 à 12 heures

| Lot | Détail | Charge |
| --- | --- | --- |
| Modèle | `FerDeLance.barda` : équipements + quantités, sorts, réserves. Plafond configurable (défaut 100). Champ optionnel, rétrocompatible. | 1 h |
| Moteur | Coût du Barda par Fer de Lance dans `EvaluationResult` ; issues « Barda dépassé », « réserve à plus de 100 Ko », « arme gratuite déjà attribuée à un Safar ». Extraction d'un chemin de coût et d'éligibilité **sans porteur**. | 2 h |
| UI | Panneau Barda dans le constructeur, à côté d'`OstPanel` : trois sections (équipements / sorts / réserves) + jauge 100 Ko. Sélecteurs « sans porteur ». **C'est le lot le plus lourd.** | 3 à 4 h |
| En-tête | Seconde jauge (500 + 100), intégration à `isValid` et au popover d'erreurs. | 0,5 h |
| Sérialisation | Export/import texte (`listText.ts`), code portable, fiche imprimable. | 1 h |
| Finitions | Tests (`evaluate.test.ts`, panneau, aller-retour texte), CHANGELOG, `docs/schema-donnees.md` et `docs/regles-creation-liste.md`. | 1 à 2 h |

### Phase 2 - restrictions de composition du même chapitre : ~1 heure

- ~~Une seule arme gratuite par Safar.~~ Faite le 2026-08-05.
- ~~La même arme gratuite sur au plus la moitié du Fer de Lance.~~ Faite le 2026-08-05.
- Amulette du culte plafonnée aux niveaux cumulés des magiciens du Fer de Lance.

Indépendantes du Barda, mais c'est la même page de règles - et la troisième contrainte de Barda
(« arme gratuite non déjà attribuée ») s'appuie sur le décompte des deux premières, désormais
disponible.

### Phase 3 - modulation entre rondes : 10 à 16 heures

Une notion de **variante de ronde** dérivée d'un Fer de Lance + son Barda : validation de chaque
variante, comparaison entre variantes, choix du niveau des Safars engagés. Nouvel écran, nouveau
document, impact sur la synchro.

À ne lancer que si le besoin tournoi est confirmé. **Le Barda a de la valeur sans cette phase** : on
déclare son barda, on le valide, on module à la main le jour du tournoi.

### Recommandation

Phase 1 seule d'abord (une dizaine d'heures), puis enchaîner la phase 2 dans la foulée puisqu'elle
est courte et complète le chapitre.

## 5. Chantiers transverses repérés

À croiser avec les autres tâches en préparation - ces refactors ne servent pas que le Barda.

- **Coût et éligibilité d'un équipement sans porteur.** Extraire de `evaluate.ts` une fonction pure
  « prix nominal d'un objet dans un contexte de faction » et un filtre d'éligibilité par faction
  plutôt que par profil. Utile partout où l'on veut présenter un catalogue avant d'avoir une
  figurine.
- **Sélecteur d'équipement réutilisable.** Sortir d'`EquipPanel` la partie « catalogue filtré +
  catégories + prix affiché + fiche d'objet », aujourd'hui soudée à une instance.
- **Sélecteur de profils réutilisable.** Même problème côté roster pour choisir un Safar de réserve.
- **Panneaux au niveau de la liste.** `OstPanel` et le futur panneau Barda partagent la même forme
  (opt-in hors figurine, replié, jauge) : un cadre commun éviterait de la dupliquer une troisième
  fois.
- **Jauges de budget multiples.** L'en-tête ne connaît qu'un plafond ; le Barda en ajoute un, et
  d'autres formats en ajouteront sans doute.
- **Fiche imprimable / feuille de ronde.** La Geste renvoie à un formulaire PDF officiel
  (« Feuille de ronde pour tournoi », section downloads de `www.tgcmcreation.fr`). Si l'on vise un
  export conforme, le Barda en fait partie - à traiter comme un chantier à part.
