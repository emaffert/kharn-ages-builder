# Chantier - Mode Bataille

Statut : **étude, non commencé**. Le format est aujourd'hui **désactivé dans l'interface**
(`src/app/builder/FactionSelect.tsx:112`, « Bientôt »). Rédigé le 2026-08-04.

Source : `rules corpus/LDR KA Saison2.pdf`, chapitre « Le mode Bataille », **pages 49 à 74**.
Complément hors chapitre : les **PIONs**, page 5 du même livre, qui sont un poste de coût du format
bataille.

Voir aussi : [`barda.md`](barda.md) - les deux chantiers se rejoignent (les Ordres se paient sur le
barda de l'Ost) et partagent leurs prérequis.

> **L'ordre d'exécution ne se lit plus ici.** Ce chantier a été fusionné avec
> [`barda.md`](barda.md) dans [`feuille-de-route-ost.md`](feuille-de-route-ost.md), qui remplace le
> découpage en lots de la section 3 ci-dessous. Cette page reste la référence pour les **règles**
> (les 18 Pactes, 12 Ordres, 16 Formations) et l'**état du code**.

## 1. Les règles, poste par poste

### 1.1 Structure de l'Ost

C'est le seul bloc qui soit entièrement de la construction de liste.

- Un Ost (ou Host) regroupe **3 au minimum à 5 au maximum** Fers de Lance, **de 300 à 600 Ko
  chacun**. Exception : si aucun Fer de Lance ne dépasse le minimum de 300 Ko, certains peuvent
  valoir moins de 300 Ko.
- Valeur d'Ost visée : **900 à 3000 Ko**.
- **Un Fer de Lance ne peut pas dépasser la moitié de la valeur totale de l'Ost** lors de la phase
  de recrutement. (Exemple du livret : un Fer de Lance à 600 Ko exige un Ost d'au moins 1200 Ko.)
- Les Fers de Lance n'ont pas à valoir un nombre rond de centaines de Ko, ni à être de valeur égale.
- Les deux joueurs n'ont pas à avoir le même **nombre** de Fers de Lance, du moment que les Osts sont
  de valeur totale identique.
- Chaque Fer de Lance est dirigé par un **Vassal** (son leader). L'Ost entier obéit à un **Seigneur
  de guerre**, lui-même leader de son Fer de Lance.
- **Limitations : X et U s'appliquent par Fer de Lance, P s'applique à l'Ost entier.**

### 1.2 Les trois modes de jeu

Purement en jeu, mais ils déterminent quelles valeurs une aide de liste aurait intérêt à afficher.

- **Mode réel** : toutes les figurines sont jouées, comme en escarmouche. Aucun marqueur nécessaire.
- **Mode accéléré** : une seule figurine marquée par Fer de Lance. Elle reçoit **1 PA par niveau de
  combattant** qui l'accompagne dans son Fer de Lance et se trouve dans l'aura du leader (montures et
  Aliénés compris, ses propres niveaux exclus). Pas de Formation possible ; seul le Seigneur de
  guerre peut donner un Ordre.
- **Mode normal** (celui retenu pour le jeu organisé) : le nombre de **marqueurs d'activation** de
  l'Ost vaut **l'intelligence I du Seigneur de guerre + 1 par Fer de Lance + sa valeur personnelle de
  compétence « SDG »**.

Précisions sur le calcul des marqueurs :

- Les Fers de Lance totalement détruits, et le porteur de « SDG X » qui n'est plus sur la table, ne
  génèrent plus de marqueurs.
- Succession si le Seigneur de guerre tombe : un **Vassal**, puis à défaut n'importe quel porteur
  d'une valeur de SDG, puis un personnage, puis enfin **le Safar le plus coûteux encore en vie**.
  Sans aucun porteur de SDG, il n'y a plus de bonus : le total retombe au nombre de Fers de Lance
  augmenté du I de la figurine choisie.
- Un Ost ne peut jamais résoudre plus d'activations qu'il n'a de figurines ; tout marqueur en trop
  est définitivement perdu.
- **Cas goûn** : le leader d'un Ost goûn génère **1 marqueur par multiple complet de 4 niveaux I**
  possédés par l'Ost, et en conserve 1 pour lui. Le **Vieillard Shaman niveau III** en gagne 1 par
  groupe de **3** niveaux I. Le livret annonce d'autres modes de calcul pour les futures factions.
- Les Formations modulent ce nombre (voir 1.5).

### 1.3 Nouvelles règles de jeu (hors construction)

Sans impact sur la liste, listées pour mémoire.

- **Auras identiques multiples** : le chevauchement de plusieurs auras du même type ne cumule pas
  leurs effets, sauf mention contraire.
- **Bonus magiques** : les bonus octroyés par les magies sur Safar ne peuvent pas dépasser au total
  la valeur d'**intelligence I** de la figurine qui incante.
- **Consolidation** : un Safar isolé et non marqué peut se déplacer pour rejoindre l'aura d'un Vassal
  ou d'un Seigneur de guerre allié, hors corps à corps. Il est ensuite géré comme un membre du Fer de
  Lance qu'il a rejoint.
- **Figurines inactives** : elles peuvent se déplacer, se défendre, soutenir, et rien d'autre, sauf
  les compétences passives **Autorité, Bretteur X, Chef de guerre X, Instinct de survie, Merci,
  Ralliement, Riposte, Rusé** (et ce qu'autorise un Ordre).
- **Embusqués** : on peut réserver autant de marqueurs différenciés qu'on a de Safars en embuscade,
  et décider au moment de la révélation si le marqueur revient à l'embusqué ou reste sur son allié.
- Séquence de tour, alternance des activations et règles d'engagement : pages 61 à 65.

### 1.4 Les Pactes

Un Pacte se décide **à la constitution de l'Ost**, en accord avec l'adversaire ou selon les modalités
du tournoi. **On ne peut en conclure qu'un seul par Ost et par partie**, on ne peut pas y renoncer en
cours de partie, et **ses avantages comme ses restrictions ne sont pas optionnels**.

Chaque Pacte pose des **conditions de composition** (donc des contraintes de construction) et donne
un **avantage** (parfois de construction, souvent de jeu pur). Voici les 18 Pactes du livre.

#### Fangs

##### 1. L'Ost des Affranchis, le Pacte des réfugiés

- *Conditions* : chaque Fer de Lance compte au moins **3 représentants de factions différentes**
  (Khârns, Khérops, Fangs, Goûns, Guilde Noire et/ou Affranchis). Aucun personnage nommé autre que
  ceux portant le trait « Affranchi ».
- *Avantage* : chaque Safar gagne « Ralliement » ; au premier test de Ralliement de chaque membre, le
  dé de maîtrise n'est pas définitivement perdu.
- *Construction* : conditions fortes, avantage purement en jeu.

##### 2. L'Ost des filles de Nyx, le Pacte des descendantes

- *Conditions* : chacun de vos Fers de Lance doit être dirigé par une fille de Nyx.
- *Avantage* : les filles de Nyx acquièrent **gratuitement leurs sorts réservés** et ont accès à
  **tous les sorts de la faction**, même ceux réservés à d'autres Fangs, ceux de Nyx exceptés.
- *Construction* : **impact direct** sur le coût des sorts et sur l'éligibilité.

##### 3. L'Ost de la Horde, le Pacte des Fangs

- *Conditions* : chaque Fer de Lance comporte au moins un Larbin et une Goulue de niveau I ; aucun
  Fer de Lance de moins de 5 figurines, hors Likans.
- *Avantage* : tous les niveaux I de l'Ost acquièrent « Riposte » pour la partie.
- *Construction* : conditions seulement.

##### 4. Le Sabbat des Meneuses

- *Conditions* : pas de personnages nommés, pas de Likans, **pas plus de 2 Exécuteurs**.
- *Avantage* : le seuil du « collier d'os » diminue de 1 par Meneuse présente dans l'Ost, minimum
  3+ ; la cadence des sorts d'ostéomancie augmente de 1 ; une Meneuse non marquée peut dépenser 1 PA
  pour augmenter de 2 le jet d'incantation d'une autre Meneuse active.
- *Construction* : conditions seulement.

##### 5. La Curée

- *Conditions* : l'Ost ne peut pas compter **plus de femelles que de Fers de Lance**.
- *Avantage* : **la limitation des Larbins est doublée** ; « Embuscade » des Exécuteurs niveau I
  fonctionne sur les tirs ; les Exécuteurs niveau III gagnent « Exécuteur ».
- *Construction* : **impact direct** (modification de limitation).

#### Goûns

##### 6. L'Ost des plaines, le Pacte des Dogons

- *Conditions* : chaque Fer de Lance compte au moins 1 Dogon (l'Artisane et Alaric sont des Dogons) ;
  **pas plus de 3 Champions tribaux** dans l'Ost.
- *Avantage* : chaque niveau I de l'Ost gagne 1 PA « comme s'il était inscrit sur sa carte ».
- *Construction* : conditions ; l'avantage modifie une caractéristique affichée sur la fiche.

##### 7. Les Chevaucheurs des Plaines

- *Conditions* : chaque Fer de Lance doit contenir au moins 1 mochère.
- *Avantage* : **chaque mochère niveau III de l'Ost permet de transporter 15 Ko d'équipement sans en
  payer le coût**.
- *Construction* : **impact direct sur le budget** (une enveloppe d'équipement gratuit à répartir).

#### Guilde Noire

##### 8. La Guilde en mission, le Pacte des voleurs

- *Conditions* : au sein d'un Ost de la Guilde Noire, **un unique Fer de Lance d'une autre faction**,
  sans restriction ; il doit être composé d'une seule autre faction ou de membres de la Guilde Noire.
- *Avantage* : ce Fer de Lance apporte son soutien normalement ; chaque Safar remporte 1D5 Ko de
  « Goal-average » par ennemi vaincu ou réduit à sa merci.
- *Construction* : **contrainte inter-Fers de Lance** (composition de l'Ost, pas d'un seul FdL).

#### Khârns

##### 9. Maison Claire, le Pacte des vengeurs du prince Baudry

- *Conditions* : Ost composé **uniquement de Khârns niveaux II et/ou III** ; aucun autre personnage
  qu'Aicard et Gaubert ne peut être recruté aux côtés de Syrga et d'Engueran.
- *Avantage* : si Syrga et Engueran sont dans le même Fer de Lance et que l'un des deux est Seigneur
  de guerre, « Force de l'Ost » et la **baisse de coût de recrutement de 15 Ko des Paladins**
  s'appliquent à **toutes les figurines non personnage de l'Ost** ; Engueran et Gaubert sont
  eux-mêmes Paladins.
- *Construction* : **impact majeur**, remise conditionnée à un placement précis dans l'Ost.

##### 10. L'Ordre du Sang de Balthus, le Pacte des mages

- *Conditions* : liste blanche (tous les Khârns non-personnages, toute la Guilde Noire, Alaric
  Jeune paysan ou Rajuah, le Patriarche, Néphtys, et **jusqu'à 2 génériques goûns ou tembos dans tout
  l'Ost**). Balthus doit être présent comme Seigneur de guerre ; chaque autre Fer de Lance doit
  comporter un frère, un fidèle ou un maître de l'Ordre.
- *Avantage* : **grands et petits grimoires coûtent 15 Ko de moins** ; Balthus n'en a pas besoin pour
  stocker un nombre illimité de pages ; un mage peut drainer des PV non soignables aux mages de
  niveau inférieur de son aura pour baisser la difficulté d'un sort.
- *Construction* : **impact direct** (remise de grimoire, déjà exprimable).

##### 11. Le complot des assassins

- *Conditions* : **Key doit être Seigneur de guerre** ; aucun autre personnage nommé ni Paladin ; les
  Voleurs de la Guilde sont autorisés.
- *Avantage* : **les armes de corps à corps de l'Ost peuvent être enduites de poison pour 10 Ko par
  arme**.
- *Construction* : **impact direct** (débloque une amélioration d'équipement à l'échelle de l'Ost).

##### 12. L'Ordre de l'Acier, le Pacte d'azur

- *Conditions* : tous les Khârns sans distinction (sauf le roi Kharl VI de Balthus et Key le
  Sénéchal), plus tous les Goûns de limitation ≥ 1. Le Seigneur de guerre doit être Syrga, Engueran,
  Gaubert, Martha ou Myriam ; **chaque leader de Fer de Lance doit être un Khârn unique ou un
  personnage de niveau II ou III**.
- *Avantage* : l'armure de **demi-plate est gratuite** pour ceux qui n'en possèdent pas du tout ; les
  autres paient **10 Ko de moins une arme forgée** (ni canne, ni gourdin, ni sarclette, ni arme de
  tir) **ou au choix** voient le seuil de leur armure baisser de 2.
- *Construction* : **impact majeur**, avec un **choix par figurine** à enregistrer dans la liste.

#### Khérops

##### 13. L'Ost impérial, le Pacte des Steppes

- *Conditions* : Seigneur de guerre = membre de la famille impériale (Nagoï Khan, Tarsak, Taqtoï ou
  Ogodeï) ; les Vassaux des autres Fers de Lance doivent être des gradés (Commandant, Capitaine ou
  Lieutenant khérops, qui comptent comme guerriers khérops) ; aucun autre membre de la famille.
- *Avantage* : le Fer de Lance du Seigneur de guerre acquiert « Riposte » ; les Berserkers acquièrent
  « Sauvage ».
- *Construction* : conditions seulement.

##### 14. L'Armée des Frères, le Pacte des héritiers

- *Conditions* : Ogodeï, Taqtoï et Tarsak doivent être **chacun leader d'un Fer de Lance**, l'un des
  trois étant Seigneur de guerre ; **chaque Fer de Lance doit intégrer au moins un mage**.
- *Avantage* : tout l'Ost acquiert « En éveil » ; les trois frères deviennent « Réceptif Sacrifice » ;
  les Montures de Tarsak et Ogodeï gagnent **au choix** « Empathie » ou le trait « Corpulent » ;
  Taqtoï et jusqu'à 2 Guerriers khérops de son Fer de Lance peuvent se déployer en embuscade.
- *Construction* : conditions fortes + **choix à enregistrer** (option de monture, désignation des
  embusqués).

##### 15. Le détachement des Steppes

- *Conditions* : Seigneur de guerre = un Commandant khérops ; tous les Vassaux Capitaines ou
  Lieutenants ; aucun personnage nommé.
- *Avantage* : **le Seigneur de guerre peut avoir jusqu'à 3 Ordres gratuits, et les Vassaux jusqu'à
  2**.
- *Construction* : **impact direct sur le budget des Ordres**.

#### Tembos et Khémistes

##### 16. L'Ost d'Euthéria, le Pacte des Tembos

- *Conditions* : chaque Fer de Lance compte au moins 3 figurines dont au moins une Khémiste.
- *Avantage* : tous les Tembos maîtrisant Adansonia possèdent **gratuitement** le sort « Drain
  d'énergie » ; toutes les Khémistes maîtrisant Adansonia possèdent gratuitement « Guérison
  végétale ».
- *Construction* : **impact direct** (sort offert, opération déjà existante).

##### 17. L'école d'Euthéria

- *Conditions* : chaque Fer de Lance compte au moins 1 Novice et 1 Prêtresse niveau 1.
- *Avantage* : chaque Safar maîtrisant Adansonia possède **3 pages de grimoire supplémentaires
  gratuites**.
- *Construction* : **impact direct** (budget de pages, opération déjà existante).

##### 18. L'Alliance, le Pacte Goûns / Tembos

- *Conditions* : les Tembos et/ou Khémistes doivent représenter **moins de la moitié des Fers de
  Lance** de l'Ost (donc 1 seul si l'Ost en compte 3 ou 4, 2 s'il en compte 5) ; **aucune mixité au
  sein d'un même Fer de Lance**, chacun n'étant composé que d'une unique faction.
- *Avantage* : chaque figurine peut défendre à la place d'une autre de son Ost engagée dans le même
  corps à corps, avec ses propres caractéristiques et PA.
- *Construction* : **contrainte de proportion entre Fers de Lance**.

### 1.5 Les Formations

- **Optionnelles**, employées seulement si tous les joueurs sont d'accord. Le livret conseille de
  jouer sans, au début.
- **Sans coût en Ko.**
- Chaque joueur peut en choisir **autant que le nombre de tours prévus** pour la partie ou par le
  scénario, et **ne peut utiliser chaque Formation qu'une seule fois** dans une partie.
- Une Formation est jouée pour chaque Ost en début de tour et ses effets durent jusqu'à la fin du
  tour. Elles ne sont révélées qu'au moment d'être jouées.
- **Impossibles en mode accéléré.**
- Le livret annonce « 4 génériques, 1 herbivore, 1 carnivore et 9 de faction, soit 15 au total » ;
  **on en dénombre 16 sur les planches** (voir ci-dessous). À vérifier sur le PDF en couleur avant
  saisie.

| Formation | Portée | Effet notable sur les marqueurs |
| --- | --- | --- |
| Avancer prudemment | générique | - |
| Formation de Guerre | générique, offensive | - |
| Formation Marche-Forcée | générique, mouvement | - |
| Formation Tenaille | générique, mouvement | - |
| Formation Tortue | générique, défensive | **-2 marqueurs** |
| Formation Pâturage | herbivores | - |
| Formation Vorace | carnivores | - |
| Formation fang | Fangs | **+1 marqueur** |
| Formation goûne | Goûns | - |
| Formation Guilde Noire | Guilde Noire | **+1 marqueur** |
| Formation khârne | Khârns | **-1 marqueur** |
| Formation khéropse | Khérops | - |
| Formation tembo / khémiste | Tembos et Khémistes | **-2 marqueurs** |
| Battre la cadence ! | Khérops | - |
| Gardez vos positions | Khârns | - |
| Restez cachés | Fangs et Goûns | - |

D'autres Formations arriveront « sous forme de carte avec les personnages qui les incarneront » : le
modèle doit être ouvert.

### 1.6 Les Ordres

- Les Ordres sont **considérés comme des équipements dont peuvent se munir les Vassaux et les
  Seigneurs de guerre**. Ils ont un **coût en Ko**.
- Ils sont **acquis une fois l'adversaire et la configuration de son Ost connus** ; « il peut donc
  être nécessaire de modifier sa composition pour pouvoir les intégrer ».
- **En tournoi, ils doivent être intégrés dans la valeur de barda de votre Ost.** Au début de la
  partie, **l'adversaire ne peut connaître que le montant total en Ko de vos Ordres**, pas leur
  nature.
- On peut posséder **autant d'exemplaires d'un même Ordre que de tours de jeu**, mais **pas plus d'un
  Ordre par tour de jeu pour chaque leader** de Fer de Lance.

| Ordre | Coût | Portée |
| --- | --- | --- |
| À l'attaque ! | 5 Ko | toutes |
| Sus à l'ennemi ! | 5 Ko | toutes |
| À moi ! | 10 Ko | toutes |
| Pour nos couleurs ! | 10 Ko | toutes |
| Mur de boucliers | 10 Ko | Khârns |
| Tenez bon ! | 15 Ko | toutes |
| Protégez les faibles | 15 Ko | Goûns |
| Infiltration | 20 Ko | toutes |
| L'heure du Héros | 20 Ko | toutes |
| Mimétisme | 20 Ko | toutes |
| Maître de guerre | 25 Ko | toutes |
| Transfuge | 25 Ko | Guilde Noire |

Deux Ordres touchent au décompte des marqueurs : « L'heure du Héros » ajoute un marqueur au total du
tour, « Maître de guerre » permet une double activation en consommant deux marqueurs.

### 1.7 Les PIONs (p. 5, hors chapitre mais même format)

« Passage d'Initiative Obtenu par le Nombre ». Un PION remplace une activation et rend la main à
l'adversaire.

- Achetables **de 1 à 3**, coût **incrémental : 5 Ko le premier, 10 Ko le deuxième, 15 Ko le
  troisième**.
- Achat lors de la **phase d'adaptation, juste avant la partie**, une fois les Fers de Lance révélés.
- **Uniquement si votre force est en infériorité numérique ET de niveau** à ce stade. En bataille,
  la comparaison se fait sur **l'Ost entier**, pas Fer de Lance par Fer de Lance.
- On ne peut jamais dépasser le nombre d'activations adverses grâce aux PIONs, ni le total de 3.

Note importante : la même phase d'adaptation « permet de moduler votre Fer de Lance en remplaçant de
l'équipement ou en modifiant le niveau de vos combattants ». C'est **exactement la mécanique du
Barda** décrite dans la Geste de Safar - les deux chantiers se recoupent ici.

## 2. État du code

### Ce qui existe déjà et qui sert

- **Le document de liste porte déjà `fersDeLance: FerDeLance[]`** (`src/core/model/list.ts:78`) et un
  bloc `ost` (`:105`). Le format portable est prêt pour l'Ost.
- **`format: "escarmouche" | "bataille"`** existe (`src/core/model/list.ts:101`) et est déjà lu à
  l'import texte (`src/app/io/listText.ts:159`) et affiché (`BuilderScreen.tsx:598`).
- **Les portées « ost » sont déjà dans le modèle ET dans le moteur** : `ConstraintScopeSchema` et
  `EffectScopeSchema` (`src/core/model/common.ts:43` et `:47`) acceptent `"ost"`, et le moteur les
  honore (`evaluate.ts:309`, `:496`, `:1651`). Aujourd'hui l'Ost et le Fer de Lance coïncident
  puisqu'il n'y en a qu'un, mais **le chemin de code existe**.
- **Un panneau au niveau de la liste existe déjà** : `ost.cardIds` + `OstPanel`
  (`src/app/builder/OstPanel.tsx`, monté en `BuilderScreen.tsx:719`).
- **Le vocabulaire des effets couvre déjà la plupart des avantages de Pacte à impact construction** :
  `cost-delta`, `cost-set`, `grimoire-discount`, `unlock-upgrade`, `grant-skill`, `grant-spell`,
  `grant-spell-choice`, `grant-trait`, `stat-modifier`, `spell-pages`, `limit-modifier`,
  `grant-mastery-die` (`src/core/model/effects.ts`). Un Pacte est donc, pour l'essentiel, **un
  porteur d'effets de portée Ost plus un jeu de contraintes** : deux notions déjà modélisées.
- **La compétence « Seigneur de guerre » est au dictionnaire** (`seigneur-de-guerre`, à valeur), avec
  `autorite`, `chef-de-guerre`, `independant`, `ralliement`, `riposte`. La fonction `sdgValue`
  existe (`src/core/engine/slavery.ts:63`) et est déjà utilisée par le constructeur.
- **`Faction.nature`** (`carnivore` / `herbivore`) existe déjà, et le commentaire du schéma
  (`src/core/model/catalog.ts:20`) cite explicitement les Formations comme motif.
- **`docs/competences-bataille.md`** tient déjà la checklist des compétences que le livre de bataille
  ajoute aux profils, dont les valeurs de **SDG X par faction** (Prince 3, Engueran 2, Syrga 1,
  Tarsak 2, Ogodeï 1, Commandant 2, Capitaine 1, Grand Sacrificateur 1, Broutcha 1, Apathée 1) et le
  cas goûn.
- **Aucune migration de base** : les listes sont stockées en `jsonb`
  (`supabase/migrations/0001_init.sql:78`) et `parseListDocument` ne fait que valider.

### Ce qui bloque

- **Le store est câblé en dur sur un seul Fer de Lance.** `fdl = list.fersDeLance[0]`
  (`src/app/useListStore.ts:167`), et `patchFdl` ne patche que l'index 0 (`:171`). `patchMember` passe
  par `patchFdl`, donc **la totalité des mutations** (recrutement, équipement, magie, montures,
  esclaves, gardes du corps…) est mono-Fer-de-Lance. `emptyList` crée un unique `fdl1` (`:96`).
  **C'est le verrou principal de tout le chantier.**
- **Le format bataille est désactivé** dans l'écran de départ (`FactionSelect.tsx:112`).
- **Les limitations sont toutes validées par Fer de Lance**, y compris « P »
  (`evaluate.ts:1230`, `validateLimitations(fdl, inFdl, …)`). En bataille, **P doit être validée sur
  l'Ost**.
- **Pas de Pactes, pas d'Ordres, pas de Formations dans le catalogue.** Attention : **la
  documentation est en avance sur le code** - `docs/schema-donnees.md` annonce `pacts: Pact[]` et
  `orders: Order[]` dans l'interface `Catalog`, alors que ni `CatalogSchema`
  (`src/core/model/catalog.ts:522`) ni `catalog.json` ne les contiennent. À corriger dans la doc quoi
  qu'il arrive.
- **Pas de notion de Seigneur de guerre d'Ost.** Il n'existe que `FerDeLance.leaderInstanceId`, qui
  correspond au Vassal. Rien ne désigne le SDG au niveau du document.
- **Aucune validation de structure d'Ost** : ni le nombre de Fers de Lance, ni leurs bornes de valeur,
  ni la règle de la moitié.
- **Export et import ne gèrent qu'un Fer de Lance en pratique.** `listText.ts` boucle bien sur
  `doc.fersDeLance` à l'export, mais l'import reconstruit un unique Fer de Lance
  (`listText.ts:288` et alentours) et ne connaît ni Vassal multiple ni Seigneur de guerre.
- **Le catalogue n'a pas de trait ni de marquage « gradé », « frère de l'Ordre », « famille
  impériale », « fille de Nyx » systématiques.** Plusieurs Pactes s'appuient sur des ensembles de
  profils que le catalogue n'expose pas encore comme tels. À vérifier trait par trait au moment de la
  saisie ; `fille-de-nyx`, `meneuse`, `dogon`, `frere-d-armes` existent déjà comme traits de cartes
  spéciales, donc la mécanique est là.

## 3. Inventaire du travail

### Lot A - Fondations multi-Fers de Lance

**Prérequis absolu de tout le reste.**

- Déverrouiller le store : `patchFdl(fdlId, …)`, sélection du Fer de Lance courant, ajout,
  suppression, renommage, déplacement d'une figurine d'un Fer de Lance à un autre.
- Désignation du **Seigneur de guerre** au niveau du document (en plus du Vassal de chaque Fer de
  Lance), avec la règle « le SDG est le leader de son propre Fer de Lance ».
- Validations de structure : 3 à 5 Fers de Lance, 300 à 600 Ko chacun avec l'exception du « aucun ne
  dépasse 300 », et aucun Fer de Lance au-dessus de la moitié de la valeur d'Ost.
- **LIM P sur l'Ost** au lieu du Fer de Lance, en mode bataille uniquement.
- Interface : navigation entre Fers de Lance, jauge par Fer de Lance **et** jauge d'Ost.
- Export texte, code portable et fiche imprimable multi-Fers de Lance, import compris.
- Réactivation du format bataille dans l'écran de départ.

**4 à 6 jours.**

### Lot B - Les Pactes

- Schéma catalogue `Pact` : identifiant, nom, `sourceText` verbatim, portée de faction, conditions
  (réutilisant `ConstraintSchema` en portée `ost`), effets (réutilisant `EffectSchema` en portée
  `ost`), image de carte.
- Sélection d'un Pacte unique au niveau du document, validation de ses conditions, application de ses
  effets par le moteur.
- **Nouveaux types de contraintes nécessaires** : « au moins N factions différentes par Fer de
  Lance », « pas plus de femelles que de Fers de Lance », « les Tembos/Khémistes sous la moitié des
  Fers de Lance », « chaque Fer de Lance doit contenir au moins un X », « un unique Fer de Lance
  d'une autre faction », « chaque leader doit être un X », « le Seigneur de guerre doit être un X ».
  Environ 6 à 8 nouveaux types.
- Deux Pactes demandent d'enregistrer un **choix par figurine** (Ordre de l'Acier : arme forgée à
  -10 Ko **ou** seuil d'armure -2 ; Armée des Frères : Empathie **ou** trait Corpulent sur les
  montures). C'est un mécanisme nouveau, à concevoir.
- Éditeur de Pacte dans l'admin.
- Saisie des 18 Pactes.

**5 à 8 jours**, le tiers en saisie de données.

### Lot C - Les Ordres

- Schéma catalogue `Order` : identifiant, nom, coût, portée de faction, `sourceText`, image de carte.
- Achat rattaché au Seigneur de guerre et aux Vassaux, en plusieurs exemplaires, avec le plafond
  « autant d'exemplaires que de tours » et « un seul par tour et par leader ».
- **Rattachement au barda de l'Ost** : c'est le point de jonction avec le chantier
  [`barda.md`](barda.md).
- Ordres gratuits accordés par un Pacte (Détachement des Steppes) : un effet dédié.
- Export : pouvoir **masquer le détail** et ne publier que le montant total, comme l'exige le livret.
- Saisie des 12 Ordres.

**2,5 à 3,5 jours.**

### Lot D - Les Formations

- Schéma catalogue `Formation` : identifiant, nom, portée (générique / faction / nature), delta de
  marqueurs, `sourceText`, image de carte.
- Sélection avant partie, plafonnée au nombre de tours, chacune une seule fois, filtrée par faction
  et par nature de peuple.
- Aucun coût, donc aucun impact budgétaire.
- **Décision préalable** : `docs/regles-creation-liste.md` tranchait que les Formations étaient « non
  pertinentes pour la construction de liste ». La position a été nuancée le 2026-08-04 : elles se
  choisissent **avant** la partie et sont contraintes par la faction ou la nature du peuple, donc
  elles relèvent de la déclaration ; c'est leur *emploi* qui est tactique. Reste à décider si le
  builder les porte ou non.
- Saisie des 16 cartes (vérifier d'abord l'écart avec les 15 annoncées).

**1,5 à 2,5 jours.**

### Lot E - Les PIONs

- 1 à 3 exemplaires, coût incrémental 5 / 10 / 15 Ko, plafond de 3.
- Les conditions d'achat (infériorité numérique **et** de niveau) ne sont vérifiables que face à
  l'adversaire : le builder ne peut qu'afficher le total de figurines et de niveaux de l'Ost, et
  laisser le joueur décider.
- Probablement une simple ligne budgétaire optionnelle.

**0,5 jour.**

### Lot F - Aides de jeu dérivées

Optionnel, mais c'est ce qui rend une liste de bataille réellement utilisable à la table.

- **Nombre de marqueurs d'activation** : I du Seigneur de guerre + 1 par Fer de Lance + sa valeur de
  SDG, avec le **cas goûn** (1 par multiple complet de 4 niveaux I, dont 1 pour lui) et le cas du
  **Vieillard Shaman III** (1 par groupe de 3 niveaux I). Plafonné au nombre de figurines.
- **Ordre de succession du Seigneur de guerre** : Vassal, puis porteur de SDG, puis personnage, puis
  Safar le plus coûteux.
- **Niveaux cumulés par Fer de Lance**, pour le calcul de PA du mode accéléré.
- Effet des Formations sélectionnées sur le total de marqueurs.

**1 à 2 jours.**

### Lot G - Données de profil

- Repasser toute la checklist de `docs/competences-bataille.md` sur les 7 factions : **SDG X**,
  Indépendant, Merci, Riposte, Rusé, Bond 4, Empathie. Elle est aujourd'hui **partiellement
  appliquée** (Fangs cochés, le reste à faire).
- Sans les valeurs de SDG, le lot F ne peut pas fonctionner.

**1 jour.**

### Total

**16 à 24 jours**, dont environ un quart de saisie de données pure (18 Pactes, 12 Ordres,
16 Formations, checklist de compétences).

## 4. Arbitrages à trancher

1. **Une liste bataille = un document, ou plusieurs ?** Un Ost est un document unique à plusieurs
   Fers de Lance (le modèle y invite), mais un joueur voudra sans doute réutiliser un Fer de Lance
   d'escarmouche. Proposition : un document unique, avec un import de Fer de Lance depuis la
   bibliothèque.
2. **Le Barda est-il par Fer de Lance ou par Ost ?** La Geste dit « à chaque Fer de Lance est associé
   un Barda de 100 Ko ». Le livre de bataille parle du « barda de votre Ost » pour les Ordres. Les
   deux coexistent probablement. À trancher avec le chantier [`barda.md`](barda.md).
3. **Les Formations entrent-elles dans le builder ?** Voir lot D.
4. **Les avantages de Pacte purement en jeu sont-ils modélisés ou seulement affichés ?** Proposition :
   modéliser ceux qui touchent le coût, la limitation, l'éligibilité ou une valeur de fiche ;
   afficher les autres en `sourceText` sans les interpréter, conformément au principe « le verbatim
   fait foi ».
5. **Que faire des Pactes dont la condition ne peut pas être vérifiée à la construction ?**
   (« Balthus doit être présent en tant que SDG » est vérifiable ; « les mochères III transportent
   15 Ko gratuits » demande de savoir quel équipement le joueur veut y loger.) Proposition : une
   enveloppe explicite à répartir, comme un budget secondaire.
6. **Mode de jeu (réel / accéléré / normal) : est-ce une propriété de la liste ?** Il change ce
   qu'on affiche (marqueurs, PA d'accompagnement) mais pas la légalité de la liste. Proposition :
   un simple réglage d'affichage, non stocké dans le document.

## 5. Chantiers transverses

À croiser avec [`barda.md`](barda.md) et les prochaines tâches. Les recoupements sont importants.

- **Multi-Fers de Lance (lot A) est le prérequis commun.** Il rend aussi réel le « Barda par Fer de
  Lance » de la Geste, qui n'a aujourd'hui pas d'objet puisqu'il n'existe qu'un Fer de Lance.
- **Le Barda accueille les Ordres.** Le livre de bataille est explicite : « en tournois, ils doivent
  être intégrés dans la valeur de barda de votre Ost ». Faire le Barda sans prévoir cette entrée,
  c'est le refaire ensuite.
- **La phase d'adaptation est la même mécanique dans les deux livres** : la Geste la décrit comme la
  modulation entre rondes adossée au Barda, le livre de bataille la mentionne pour les PIONs et les
  Ordres. La « phase 3 » du chantier Barda et le lot E d'ici sont **le même sujet**.
- **Panneaux au niveau de la liste.** `OstPanel` existe, le Barda en ajoute un, les Pactes, les
  Ordres, les Formations et les PIONs en ajoutent quatre autres. Un cadre commun devient nettement
  rentable.
- **Jauges de budget multiples.** Ost, par Fer de Lance, Barda, Ordres, enveloppe de mochère : le
  bandeau ne connaît aujourd'hui qu'un plafond unique.
- **Coût d'un objet sans porteur.** Les Ordres sont des « équipements » attachés à un leader mais
  achetés hors fiche ; c'est le même besoin que les équipements de Barda.
- **Nouveaux types de contraintes de composition inter-Fers de Lance** (lot B). Ils serviront aussi
  aux restrictions de la Geste et à la faction des Affranchis, dont les règles ont la même forme.
- **Fiche imprimable / feuille de ronde.** Multi-Fers de Lance, Barda, Ordres masqués : le même
  export sert les deux chantiers.

## 6. Dette documentaire - CORRIGÉE le 2026-08-04

- `docs/schema-donnees.md` : l'interface `Catalog` annonçait `pacts` et `orders`, qui n'existent ni
  dans `CatalogSchema` ni dans `catalog.json`. **Corrigé** : l'interface est alignée sur le schéma
  réel (ajout de `settings`, `mountTypes`, `munitionKinds`, `icons`), et les formes `Pact` / `Order`
  / `Formation` sont explicitement marquées **prévisionnelles**.
- `docs/regles-creation-liste.md` ne listait que 9 Pactes et comptait les Formations hors
  construction de liste. **Corrigé** : les 18 Pactes sont listés par faction, les décomptes
  d'Ordres et de Formations sont donnés, et la position sur les Formations est nuancée (choisies
  avant la partie, contraintes par faction ou nature, donc déclaratives ; c'est leur emploi qui est
  tactique).
- `docs/competences-bataille.md` était une checklist partiellement cochée. **Corrigé** : l'état est
  vérifié contre `catalog.json` v0.5.0, toutes les lignes sont tranchées, et trois écarts réels sont
  documentés (voir ci-dessous).

### Écarts de données à traiter avant le lot F

- **Indépendant manquant** sur `kherops-nagoi-khan-3`, `affranchis-maraka-3`, `affranchis-khalsa-2`,
  `affranchis-clotrique-3`. `guilde-noire-khalsa-2` l'a, `affranchis-khalsa-2` non : même
  personnage, deux traitements.
- **« Grand Sacrificateur »** (SDG 1) figurait dans la checklist mais n'existe pas au catalogue ;
  candidats proches `kherops-bourreau-2` et `kherops-pretre-1`, à arbitrer sur carte.
- **Valeurs de SDG absentes de la checklist mais présentes au catalogue** : Gaubert (1), Balthus (5),
  Lieutenant khérops (1), Nagoï Khan (5). La checklist a été complétée.
