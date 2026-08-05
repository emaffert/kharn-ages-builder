# Feuille de route - Ost, Barda et mode Bataille

Rédigée le 2026-08-04. **Compile en un seul plan les deux chantiers étudiés séparément :**
[`barda.md`](barda.md) (Geste de Safar, escarmouche) et [`mode-bataille.md`](mode-bataille.md)
(LDR saison 2, pages 49-74). Ces deux documents restent la référence pour les **règles verbatim** et
l'inventaire détaillé ; celui-ci ne porte que l'**ordre d'exécution**.

## 1. Pourquoi les fusionner

Les deux chantiers ont été étudiés séparément, mais ils butent sur les mêmes verrous et se rendent
service mutuellement. Les fusionner change l'ordre de travail, pas le contenu.

- **Le verrou est commun.** Le store est câblé sur `list.fersDeLance[0]`
  (`src/app/useListStore.ts:167`, `patchFdl` ne patche que l'index 0). Le mode Bataille en a besoin
  pour exister ; le Barda en a besoin pour avoir un sens, puisque la Geste dit « à chaque Fer de
  Lance est associé un Barda » et qu'il n'y a aujourd'hui qu'un seul Fer de Lance.
- **Les deux livres décrivent la même phase de jeu.** La Geste appelle « modulation entre rondes »
  ce que le livre de bataille appelle « phase d'adaptation » : remplacer de l'équipement, changer le
  niveau des combattants. C'est un seul sujet, pas deux.
- **Le Barda accueille les Ordres.** Le livre de bataille est explicite : « en tournois, ils doivent
  être intégrés dans la valeur de barda de votre Ost ». Livrer le Barda sans prévoir cette entrée,
  c'est le rouvrir juste après.
- **Cinq briques techniques servent des deux côtés** : coût d'un objet sans porteur, sélecteurs
  d'équipement et de profil réutilisables, cadre commun de panneau au niveau de la liste, jauges de
  budget multiples, fiche imprimable.
- **Les contraintes de composition ont la même forme des deux côtés.** Les restrictions de la Geste
  (une arme gratuite par Safar, la moitié du Fer de Lance, l'amulette du culte) et les conditions de
  Pacte (au moins 3 factions par Fer de Lance, pas plus de femelles que de Fers de Lance…) demandent
  le même travail sur le moteur de contraintes.

## 2. Ce sur quoi on s'appuie

Établi en lisant le code, à ne pas redécouvrir.

- Le document de liste **porte déjà** `fersDeLance: FerDeLance[]` et un bloc `ost`
  (`src/core/model/list.ts:78` et `:105`). Le format portable est prêt.
- Les portées **`"ost"` existent déjà dans le modèle et dans le moteur** (`common.ts:43` et `:47`,
  honorées en `evaluate.ts:309`, `:496`, `:1651`). Aujourd'hui Ost et Fer de Lance coïncident, mais
  le chemin de code est écrit.
- **Aucune migration** : listes en `jsonb` (`supabase/migrations/0001_init.sql:78`), code portable en
  JSON compressé, et `parseListDocument` ne fait que valider. Un champ optionnel est rétrocompatible
  par construction. Seule réserve : Zod retire les clés inconnues, donc un client plus ancien
  perdrait silencieusement les nouveaux champs.
- Le **vocabulaire d'effets existant** (`cost-delta`, `cost-set`, `grimoire-discount`,
  `unlock-upgrade`, `grant-skill`, `grant-spell`, `grant-spell-choice`, `grant-trait`,
  `stat-modifier`, `spell-pages`, `limit-modifier`…) couvre la quasi-totalité des avantages de Pacte
  à impact construction. **Un Pacte = un porteur d'effets de portée Ost + des contraintes**, deux
  notions déjà modélisées.
- `OstPanel` (`src/app/builder/OstPanel.tsx`) est le patron des panneaux au niveau de la liste.
- `sdgValue` (`src/core/engine/slavery.ts:63`), la compétence `seigneur-de-guerre` et
  `Faction.nature` (carnivore/herbivore, cité pour les Formations) existent déjà.

## 3. La feuille de route

Sept phases. Chacune est **livrable seule** : aucune ne laisse l'application dans un état
intermédiaire inutilisable. L'ordre est contraint par les dépendances, pas par les priorités.

---

### Phase 0 - Fondations multi-Fers de Lance

**Débloque tout le reste. Rien d'autre ne peut commencer avant.**

- Déverrouiller le store : `patchFdl(fdlId, …)`, Fer de Lance courant, ajout, suppression,
  renommage, déplacement d'une figurine d'un Fer de Lance à l'autre. C'est un refactor mécanique mais
  large : **toutes** les mutations passent aujourd'hui par `patchFdl` sur l'index 0.
- Désignation du **Seigneur de guerre** au niveau du document, en plus du Vassal de chaque Fer de
  Lance, avec la règle « le SDG est le leader de son propre Fer de Lance ».
- **LIM P validée sur l'Ost** au lieu du Fer de Lance en mode bataille (`evaluate.ts:1230`).
- Validations de structure d'Ost : 3 à 5 Fers de Lance, 300 à 600 Ko chacun avec l'exception
  « si aucun ne dépasse 300 », aucun Fer de Lance au-dessus de la moitié de la valeur totale.
- Interface : navigation entre Fers de Lance, jauge par Fer de Lance **et** jauge d'Ost.
- Export texte, code portable et import multi-Fers de Lance.
- Réactivation du format bataille (`FactionSelect.tsx:112`).

**Livrable** : on peut construire un Ost légal de 3 à 5 Fers de Lance, le sauvegarder, l'exporter et
le réimporter. Sans Pacte, sans Ordre, sans Barda.

**4 à 6 jours.**

---

### Phase 1 - Briques transverses

Extraites une fois, utilisées par toutes les phases suivantes. À faire ici plutôt qu'en catastrophe
au milieu de la phase 2.

- **Coût et éligibilité d'un objet sans porteur** : une fonction pure « prix nominal d'un objet dans
  un contexte de faction » et un filtre d'éligibilité par faction plutôt que par profil. Aujourd'hui
  `equipmentDiscount` (`evaluate.ts:190`), `temboEquipmentSurcharge` (`:212`), `costByFaction` et les
  54 équipements à `reservedTo` se résolvent tous contre un profil. Sert au Barda **et** aux Ordres.
- **Sélecteur d'équipement réutilisable** : sortir d'`EquipPanel` (519 lignes) la partie « catalogue
  filtré + catégories + prix affiché + fiche d'objet », aujourd'hui soudée à une instance.
- **Sélecteur de profil réutilisable** : même chose côté roster, pour les Safars de réserve.
- **Cadre commun de panneau au niveau de la liste** : `OstPanel` existe, le Barda, les Pactes, les
  Ordres et les Formations en ajouteront quatre. Le motif est le même (opt-in hors figurine,
  replié par défaut, jauge éventuelle).
- **Jauges de budget multiples** : le bandeau ne connaît qu'un plafond ; il en faudra jusqu'à cinq
  (Ost, Fer de Lance, Barda, Ordres, enveloppe de mochère).

**Livrable** : rien de visible pour le joueur. C'est le prix à payer pour que les phases 2 à 5 ne se
marchent pas dessus. À ne pas sauter.

**2 à 3 jours.**

---

### Phase 2 - Le Barda

Cf. [`barda.md`](barda.md) pour les règles.

- Modèle : `FerDeLance.barda` (équipements et quantités, sorts, réserves), plafond configurable à
  100 Ko par défaut. Champ optionnel, rétrocompatible.
- Moteur : coût du Barda par Fer de Lance, plafond, réserve à plus de 100 Ko, arme gratuite déjà
  attribuée à un Safar.
- Panneau Barda à trois sections, appuyé sur les briques de la phase 1.
- Sérialisation texte et code portable.

**Sept arbitrages** sont à trancher avant de finir le moteur (prix sans porteur, sorts de grimoire
budgétés en pages, éligibilité, réserve modèle ou profil, origine choisie, portée du plafond,
affichage des jauges). Aucun ne bloque le modèle de données : on peut commencer et trancher en cours
de route.

**3 à 4 jours** (contre 4 à 6 en solo : la phase 1 en a retiré le lot le plus lourd).

---

### Phase 3 - Restrictions de composition

Le chapitre de la Geste dont dépend une des trois contraintes de Barda, et la même mécanique que les
conditions de Pacte.

- ~~Une seule arme gratuite par Safar.~~ Faite le 2026-08-05 (`validateFreeWeapons`).
- ~~La même arme gratuite sur au plus la moitié du Fer de Lance.~~ Faite le 2026-08-05.
- Amulette du culte plafonnée aux niveaux cumulés des magiciens du Fer de Lance
  (`guilde-noire-amulette-du-culte`, 6 Ko).
- **Nouveaux types de contraintes inter-Fers de Lance**, mutualisés avec la phase 4 : « au moins N
  factions différentes par Fer de Lance », « pas plus de X que de Fers de Lance », « proportion de
  faction sous la moitié des Fers de Lance », « chaque Fer de Lance contient au moins un X »,
  « chaque leader doit être un X », « le Seigneur de guerre doit être un X ». Six à huit types.

**Livrable** : les listes d'escarmouche gagnent leurs dernières validations de composition ; le
moteur de contraintes est prêt pour les Pactes.

**1,5 jour** (les deux règles d'armes gratuites sont déjà livrées).

---

### Phase 4 - Les Pactes

La phase la plus lourde en données. Elle dépend de la phase 3 pour les types de contraintes.

- Schéma catalogue `Pact` : identifiant, nom, `sourceText` verbatim, portée de faction, conditions
  (`ConstraintSchema` en portée `ost`), effets (`EffectSchema` en portée `ost`), image de carte.
- Sélection d'un Pacte unique, validation des conditions, application des effets.
- **Mécanisme nouveau à concevoir** : le *choix par figurine* accordé par un Pacte. L'Ordre de
  l'Acier laisse choisir entre « arme forgée à -10 Ko » et « seuil d'armure -2 » ; l'Armée des Frères
  entre « Empathie » et le trait « Corpulent ». Rien dans le modèle actuel ne porte un choix de ce
  genre.
- Éditeur de Pacte dans l'admin.
- **Saisie des 18 Pactes.**

Neuf des dix-huit ont un avantage à impact construction direct (sorts gratuits, grimoires à -15 Ko,
demi-plate offerte, limitation des Larbins doublée, 15 Ko d'équipement gratuit par mochère III,
jusqu'à 3 Ordres gratuits, 3 pages de grimoire gratuites…). Les autres ne posent que des conditions.

**5 à 7 jours**, dont environ un tiers de saisie.

---

### Phase 5 - Ordres et Formations

Deux lots petits et indépendants, regroupés parce qu'ils partagent le cadre de panneau et se
livrent ensemble.

**Ordres** (2,5 à 3,5 j) :

- Schéma `Order`, achat rattaché au Seigneur de guerre et aux Vassaux, exemplaires multiples,
  plafonds « autant que de tours » et « un seul par tour et par leader ».
- **Rattachement au barda de l'Ost** : le point de jonction concret entre les deux chantiers.
- Ordres gratuits accordés par un Pacte (Détachement des Steppes) via un effet.
- Export capable de **masquer le détail** et de ne publier que le montant total, comme l'exige le
  livret.
- Saisie des 12 Ordres.

**Formations** (1,5 à 2,5 j) :

- Schéma `Formation` : portée (générique / faction / nature), delta de marqueurs, `sourceText`.
- Sélection plafonnée au nombre de tours, chacune une seule fois, filtrée par faction et par nature.
- Aucun coût, donc aucun impact budgétaire.
- Saisie des 16 cartes, après avoir vérifié l'écart avec les 15 annoncées par le livret.

**Hors périmètre - les PIONs.** Achat de 1 à 3 en phase d'adaptation, coût incrémental 5 / 10 / 15
Ko, conditionné à une infériorité numérique et de niveau constatée **face à l'adversaire**. C'est un
concept de mise en place de partie, pas de construction de liste : **le builder ne le gérera pas.**

**4 à 6 jours.**

---

### Phase 6 - Aides de jeu dérivées

**Données** : **fait le 2026-08-04.** L'audit contre `catalog.json` v0.5.0 a montré que la checklist
de [`competences-bataille.md`](../competences-bataille.md) était appliquée ; les deux écarts réels
(Khalsa sans Indépendant, Porteuse d'eau recrutable en esclave par les Affranchis) sont corrigés.
Rien à reprendre ici.

- **Nombre de marqueurs d'activation** : I du Seigneur de guerre + 1 par Fer de Lance + sa valeur de
  SDG, plafonné au nombre de figurines, avec le **cas goûn** (1 par multiple complet de 4 niveaux I,
  dont 1 pour lui) et le **Vieillard Shaman III** (1 par groupe de 3 niveaux I).
- Effet des Formations sélectionnées sur ce total.
- **Ordre de succession du Seigneur de guerre** : Vassal, puis porteur de SDG, puis personnage, puis
  Safar le plus coûteux.
- **Niveaux cumulés par Fer de Lance**, pour les PA d'accompagnement du mode accéléré.

**1 à 2 jours.**

---

### Phase 7 - Phase d'adaptation

Le sujet commun aux deux livres, gardé pour la fin parce qu'il présuppose tout le reste et qu'il a de
la valeur **seulement si** le besoin tournoi est confirmé.

- Notion de **variante de ronde** dérivée d'un Ost (ou d'un Fer de Lance) et de son Barda :
  changement de niveau des Safars engagés, redistribution de l'équipement, achat des Ordres une fois
  l'adversaire connu.
- Validation de chaque variante, comparaison entre variantes.
- Nouvel écran, nouveau document, impact sur la synchro.

**À ne lancer que sur besoin confirmé.** Tout ce qui précède fonctionne sans : on déclare son Ost,
son Barda et ses Ordres, on valide, et on module à la main le jour du tournoi.

**5 à 10 jours.**

---

## 4. Récapitulatif

| Phase | Contenu | Charge | Dépend de |
| --- | --- | --- | --- |
| 0 | Fondations multi-Fers de Lance | 4 à 6 j | - |
| 1 | Briques transverses | 2 à 3 j | 0 |
| 2 | Barda | 3 à 4 j | 1 |
| 3 | Restrictions de composition | 2 j | 2 |
| 4 | Pactes | 5 à 7 j | 3 |
| 5 | Ordres et Formations | 4 à 6 j | 2 et 4 |
| 6 | Aides de jeu dérivées | 1 à 2 j | 0 et 5 |
| 7 | Phase d'adaptation | 5 à 10 j | tout |

**Phases 0 à 6 : 21 à 30 jours.** Avec la phase 7 : 26 à 40 jours.

À titre de comparaison, les deux chantiers menés séparément coûtaient 4 à 6 jours (Barda phases 1-2)
plus 16 à 24 jours (Bataille), soit 20 à 30 jours, **mais avec le refactor multi-Fers de Lance et les
briques transverses faits deux fois**, et un Barda à rouvrir pour y loger les Ordres.

## 5. Jalons de livraison

Trois points d'arrêt naturels, chacun utilisable par un joueur.

1. **Après la phase 2** (9 à 13 j) : le mode Bataille existe structurellement (Ost multi-Fers de
   Lance, validé, exportable) et le Barda est complet en escarmouche. C'est déjà deux fonctionnalités
   annoncées qui sortent de « Bientôt ».
2. **Après la phase 5** (20 à 28 j) : le mode Bataille est complet côté construction de liste.
   Pactes, Ordres, Formations. C'est la cible naturelle du chantier.
3. **Après la phase 6** (21 à 30 j) : les aides de jeu rendent la liste utilisable à la table.

## 6. Arbitrages à trancher, par phase

Repris des deux études, dédoublonnés et rattachés au moment où ils bloquent.

### Avant la phase 0

- Une liste bataille est-elle **un document unique** à plusieurs Fers de Lance, ou plusieurs
  documents liés ? Proposition : un document unique, avec un import de Fer de Lance depuis la
  bibliothèque.
- Le **mode de jeu** (réel / accéléré / normal) est-il une propriété de la liste ? Il change ce qu'on
  affiche mais pas la légalité. Proposition : réglage d'affichage, non stocké.

### Avant la phase 2

- **Prix d'un objet sans porteur.** Proposition : prix nominal, faction du Fer de Lance pour
  `costByFaction`, pas de remise de porteur ni de surcoût tembo.
- **Sorts de grimoire au Barda** : ils se paient en pages, pas en Ko (3 sur 42 ont un prix). Est-ce
  l'intention ? Peut-on ranger un grimoire (20/40 Ko) au Barda ?
- **Éligibilité sans porteur** : proposition, tout ce qu'au moins un profil de la faction pourrait
  acheter.
- **Réserve = modèle ou profil ?** Proposition : stocker le `profileId` du niveau le plus bas,
  afficher les niveaux accessibles.
- **Origine choisie** (Agent sombre) figée au Barda ou à la composition ? Proposition : au Barda.
- **Le Barda est-il par Fer de Lance ou par Ost ?** La Geste dit par Fer de Lance, le livre de
  bataille parle du « barda de l'Ost » pour les Ordres. Probablement les deux. **C'est l'arbitrage le
  plus structurant du plan** : il décide où vit le champ.
- **Le Barda compte-t-il dans le budget affiché ?** Proposition : non, deux jauges distinctes.

### Avant la phase 4

- **Les avantages de Pacte purement en jeu sont-ils modélisés ou seulement affichés ?** Proposition :
  modéliser ce qui touche le coût, la limitation, l'éligibilité ou une valeur de fiche ; afficher le
  reste en `sourceText` sans l'interpréter, conformément au principe « le verbatim fait foi ».
- **Les avantages non vérifiables à la construction** (les 15 Ko gratuits par mochère III) :
  proposition, une enveloppe explicite à répartir, comme un budget secondaire.

### Avant la phase 5

- **Les Formations entrent-elles dans le builder ?** La documentation a été nuancée le 2026-08-04 :
  elles se choisissent avant la partie et sont contraintes par faction ou nature, donc elles relèvent
  de la déclaration. Reste à décider si on les porte.

## 7. Risques

- **Le refactor de la phase 0 touche tout le constructeur.** `patchFdl` est le passage obligé de
  toutes les mutations ; s'y tromper casse l'escarmouche, qui marche aujourd'hui. La couverture de
  tests existante est le filet : la vérifier avant de commencer.
- **La saisie des 46 cartes** (18 Pactes, 12 Ordres, 16 Formations) est le poste le moins
  compressible et le plus facile à sous-estimer.
- **Les conditions de Pacte s'appuient sur des ensembles de profils que le catalogue n'expose pas
  toujours** (« gradés » khérops, « frère / fidèle / maître de l'Ordre », « famille impériale »).
  À vérifier trait par trait au moment de la saisie ; le mécanisme des traits existe déjà
  (`fille-de-nyx`, `meneuse`, `dogon`, `frere-d-armes`), il faudra peut-être en ajouter.
- **Un client plus ancien perd silencieusement les nouveaux champs** (Zod retire les clés inconnues).
  À traiter au moment où la synchro multi-appareils compte vraiment.
