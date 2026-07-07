import { useEffect } from "react";
import { Button } from "@ui";

/**
 * Documentation utilisateur de l'admin (overlay plein écran).
 * Explique la logique verbatim/structuré, les restrictions d'équipement, les contraintes de
 * recrutement et les effets, avec des exemples JSON prêts à coller dans les champs « avancés ».
 */

/** Bloc de code JSON. */
function Code({ children }: { children: string }) {
  return <pre className="adm-doc-code">{children}</pre>;
}

function H({ children }: { children: string }) {
  return <h2 className="adm-doc-h2">{children}</h2>;
}

export function AdminDocs({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="adm-scrim fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 sm:p-8" onClick={onClose}>
      <div className="adm-modal adm-doc" onClick={(e) => e.stopPropagation()}>
        <div className="adm-doc-head">
          <h1 className="adm-doc-title">Aide — édition du catalogue</h1>
          <Button size="sm" onClick={onClose}>Fermer</Button>
        </div>

        <div className="adm-doc-body">
          <p>
            Le catalogue distingue deux natures de données : le <strong>texte officiel des cartes</strong>{" "}
            (verbatim, <em>fait foi</em> en cas de litige — champs « Règles », « Effets », « Texte de la carte »)
            et son <strong>interprétation structurée</strong> (contraintes, effets, réservations) qui alimente le
            moteur mais ne fait jamais foi. Renseignez toujours le verbatim ; l'encodage structuré est optionnel et
            se rajoute quand on veut que le moteur applique la règle.
          </p>

          <H>Restreindre qui peut porter un équipement</H>
          <p>
            Ouvrez l'équipement dans l'onglet <strong>Équipement</strong> : la section{" "}
            <strong>« Réservé à (qui peut l'équiper) »</strong> permet de le restreindre, sans toucher au JSON.
            Renseignez une ou plusieurs dimensions :
          </p>
          <ul className="adm-doc-list">
            <li><strong>niveaux</strong> — cases I / II / III (ex. l'Arc court, réservé au niveau I) ;</li>
            <li><strong>factions</strong> — une case par faction ;</li>
            <li><strong>traits</strong> — étiquettes à ajouter (ex. <code>synkherces</code> pour le Madrier) ;</li>
            <li><strong>profils</strong> — une ou plusieurs figurines précises.</li>
          </ul>
          <p>
            <strong>Tout laisser vide = équipement libre.</strong> Sinon, une figurine doit valider{" "}
            <em>toutes</em> les dimensions renseignées (au sein d'une même dimension, correspondre à l'une des
            valeurs suffit). La restriction est appliquée par le <strong>constructeur</strong> (l'arme n'apparaît
            pas parmi les équipements ajoutables) et revérifiée par le <strong>moteur</strong> (une liste importée
            avec une arme interdite est signalée).
          </p>
          <p>
            Pour l'inverse — « ce profil ne peut pas porter d'arme » — ce n'est pas ici mais sur la figurine :
            onglet <strong>Profils</strong>, section <strong>Restrictions</strong>, où l'on ajoute une contrainte
            (voir ci-dessous, ex. le Larbin « Éprouvé »).
          </p>

          <H>Contraintes de recrutement (Constraint)</H>
          <p>
            Une contrainte <em>valide la légalité</em> d'une liste (une barrière : elle bloque ou avertit). Dans
            l'admin, on l'ajoute via le formulaire repliable <strong>« Contraintes »</strong> sur la fiche d'un
            profil (recrutement) ou d'une carte spéciale : on choisit un <strong>type</strong>, puis on remplit
            ses champs.
          </p>
          <p><strong>Champs communs à tous les types :</strong></p>
          <ul className="adm-doc-list">
            <li><strong>portée</strong> — à quel niveau la règle s'évalue : <code>profil</code>, <code>fer-de-lance</code> ou <code>ost</code>.</li>
            <li><strong>sévérité</strong> — <code>error</code> (bloquant) ou <code>warning</code> (simple avertissement).</li>
            <li><strong>auto-vérifiée</strong> — si décochée, la contrainte n'est <em>jamais</em> vérifiée par le moteur : elle ne fait qu'afficher sa note (obligatoire pour <code>custom</code>).</li>
            <li><strong>texte source</strong> — le wording verbatim de la carte, qui fait foi.</li>
          </ul>

          <p><strong>Types à formulaire</strong> (champs dédiés, pas de JSON) :</p>
          <ul className="adm-doc-list">
            <li>
              <strong><code>forbids-equipment</code></strong> — interdit à la figurine de porter certaines catégories
              d'équipement (ex. Larbin « Éprouvé »). <em>Champ :</em> <strong>catégories interdites</strong> (une ou
              plusieurs). Sur une fiche de profil, le sujet est la figurine elle-même ; un champ <strong>profil (sujet)</strong>{" "}
              n'apparaît que lorsqu'on édite la contrainte sur une <em>carte spéciale</em> visant un profil précis.            </li>
            <li>
              <strong><code>requires-present</code></strong> — la figurine ne peut être recrutée que si une autre est
              présente dans le Fer de Lance (ex. Muskh exige Xayìn). <em>Champs :</em> <strong>sujet</strong> (la
              figurine soumise à la condition) ; <strong>requiert</strong> (celle qui doit être présente).            </li>
            <li>
              <strong><code>faction-membership</code></strong> — autorise une figurine d'une autre faction à être
              recrutée dans les Fers de Lance des factions listées (ex. « Allié des X »). <em>Champ :</em>{" "}
              <strong>factions autorisées</strong> (le trait <code>apatride</code> outrepasse tout).
            </li>
            <li>
              <strong><code>equipment-reserved</code></strong> — interdit à la figurine d'acquérir certains
              grimoires. <em>Champ :</em> <strong>grimoires interdits</strong> (petit / grand).
            </li>
          </ul>

          <p><strong>Types à saisir en JSON</strong> (champ « params (JSON) ») :</p>
          <p>
            <strong><code>attachment</code></strong> — rattache la figurine à un porteur ; la somme des niveaux des
            rattachés ne peut excéder le niveau du porteur (ex. Likan → femelle Fang).          </p>
          <Code>{`{
  "carrier": { "trait": "femelle-fang", "label": "une femelle Fang" },
  //  carrier = le porteur : par "trait", ou "profileIds": [...], ou "modelIds": [...]
  //  label (optionnel) = libellé lisible affiché à la place du trait ("via une femelle Fang")
  "capacityRule": "sum(attached.level) <= carrier.level"
  //  capacityRule = descriptif ; la règle « ≤ niveau du porteur » est appliquée d'office
}`}</Code>
          <p>
            <strong><code>custom</code></strong> — repli libre pour une règle qu'aucun type ne couvre. Contenu{" "}
            <strong>non interprété</strong> : mettez « auto-vérifiée » à faux, seul le <strong>texte source</strong>{" "}
            est montré. Les <code>params</code> acceptent n'importe quel JSON :
          </p>
          <Code>{`{ "note": "décrivez la règle ici ; ce contenu n'est pas lu par le moteur" }`}</Code>
          <p>
            <strong>Bon à savoir.</strong> « <strong>Allié des X</strong> » n'est <em>pas</em> automatique : il faut
            une contrainte <code>faction-membership</code> listant la faction d'accueil (ou le trait{" "}
            <code>apatride</code> pour « recrutable partout »). L'unicité d'un{" "}
            <strong>personnage (LIM P)</strong> est automatique via le champ <strong>« Limitation » = P</strong> du
            profil ; s'il occupe <em>en plus</em> la place d'un profil générique, renseignez{" "}
            <strong>« occupe la place de »</strong> directement sur la limitation (modèle + niveau).
          </p>

          <H>Effets (Effect)</H>
          <p>
            Un effet <em>modifie dynamiquement</em> la liste (coût, octroi de compétence/trait, pages de sorts…),
            souvent sur <strong>d'autres figurines</strong> et sous condition. On l'édite via le formulaire repliable{" "}
            <strong>« Effets »</strong> (fiche d'un profil ou d'une carte spéciale), où l'on renseigne :
          </p>
          <ul className="adm-doc-list">
            <li><strong>opération</strong> — ce que fait l'effet (référence ci-dessous) ;</li>
            <li><strong>cible</strong> — à qui il s'applique (un sélecteur) ;</li>
            <li><strong>condition</strong> — état requis pour qu'il s'active (optionnel) ; on peut cumuler plusieurs clauses, <strong>toutes</strong> devant être vraies (ET), ex. « ≥3 Dogons ET ≥1 Père de famille » ;</li>
            <li><strong>appliqué à la construction</strong> — si décoché, l'effet est « en jeu » seulement (affiché, jamais calculé au coût) ;</li>
            <li><strong>au choix du joueur</strong> — l'effet n'est pas appliqué d'office (ex. réduction « garde rapprochée »).</li>
          </ul>

          <p><strong>Opérations</strong> — le champ « opération » et ce qu'il produit :</p>
          <ul className="adm-doc-list">
            <li><code>{`{ "kind": "cost-delta", "amount": -10 }`}</code> — ajuste le coût de la cible (négatif = réduction). Ex. Exécuteur : −10 sur l'Arbalète de poing (cible <code>equipmentIds</code>).</li>
            <li><code>{`{ "kind": "cost-set", "amount": 0, "maxCount": 2 }`}</code> — fixe le coût de la cible (souvent 0 = gratuit) ; <code>maxCount</code> plafonne le nombre de cibles concernées (ex. Larbins des Filles de Nyx).</li>
            <li><code>{`{ "kind": "grant-skill", "skillId": "heroique", "value": "défense" }`}</code> — octroie une compétence à la cible ; <code>value</code> (optionnel) précise le domaine d'une compétence « à valeur » (ex. Héroïque « défense »). Sur le profil, les valeurs d'une même compétence fusionnent (« Héroïque objectif et défense »).</li>
            <li><code>{`{ "kind": "grant-trait", "trait": "apatride" }`}</code> — octroie un trait à la cible (peut débloquer d'autres règles, ex. faction).</li>
            <li><code>{`{ "kind": "spell-pages", "amount": 3 }`}</code> — ajoute des pages de sorts à la cible.</li>
            <li><code>{`{ "kind": "stat-modifier", "stat": "i", "amount": "level" }`}</code> — modifie une caractéristique (<code>amount</code> = nombre ou <code>"level"</code>). <em>Effet en jeu — affiché, non calculé au coût.</em></li>
            <li><code>{`{ "kind": "stat-count", "stat": "t", "of": { "traits": ["dogon"] }, "atLeastBase": true }`}</code> — fixe une caractéristique au <strong>nombre de figurines</strong> correspondant à <code>of</code> dans la portée (ex. Instinct grégaire : T = nombre de Dogons) ; <code>atLeastBase</code> = plancher à la valeur de base. <em>Affiché sur le profil.</em></li>
            <li><code>{`{ "kind": "skill-count", "skillId": "seigneur-de-guerre", "of": { "levels": [1] }, "per": 3 }`}</code> — fixe la <strong>valeur d'une compétence</strong> (à valeur) à <code>⌊ nombre de figurines « of » / per ⌋</code> (arrondi inférieur ; <code>per</code> défaut 1). Ex. Seigneur de guerre = ⌊ Niv I de l'Ost / 3 ⌋. <em>Affiché sur le profil.</em></li>
          </ul>

          <p><strong>Sélecteurs</strong> (cible et condition) — dimensions cumulables :</p>
          <ul className="adm-doc-list">
            <li><code>{`"self": true`}</code> — la source de l'effet elle-même.</li>
            <li><code>{`"profileIds": ["fangs-larbin-1"]`}</code> — des profils précis.</li>
            <li><code>{`"traits": ["frere-d-armes"]`}</code> — les figurines portant l'un de ces traits.</li>
            <li><code>{`"equipmentCategories": ["arme-cac"]`}</code> — restreint la cible à ces catégories d'équipement (utile avec <code>cost-delta</code>).</li>
            <li><code>{`"equipmentIds": ["arbalete-de-poing"]`}</code> — un équipement précis.</li>
            <li><code>{`"countAtLeast": 2`}</code> — sur une <strong>condition</strong> : l'effet ne s'active que si au moins N figurines correspondent (ex. « ≥ 2 frères d'armes → tous apatrides »).</li>
            <li><code>{`"modelIds": ["pere-de-famille"]`}</code> — toutes les figurines d'un modèle (tous niveaux).</li>
            <li><code>{`"factionIds": [...]`}</code> — existe dans le format mais n'a pas encore de champ dédié dans le formulaire.</li>
          </ul>

          <p>
            <strong>Garde du corps (désignation).</strong> Le champ <strong>« désignation »</strong> d'un effet de
            coût restreint la remise aux gardes <em>désignés</em> : la cible (le garde) n'en bénéficie que si le
            joueur l'assigne à protéger une figurine décrite par <code>of</code>. Le constructeur en déduit qui peut
            être garde du corps de qui — plus besoin de coder ces liens.
          </p>
          <Code>{`// Effet « Larbin gratuit » d'une Fille de Nyx (cible = Larbin) :
"operation": { "kind": "cost-set", "amount": 0, "maxCount": 2 },
"designation": { "of": { "traits": ["fille-de-nyx"] } }
//  of = les protégeables ; le Larbin doit être désigné garde d'une Fille de Nyx pour être gratuit.`}</Code>

          <H>Améliorations & choix exclusif</H>
          <p>
            Une carte spéciale cochée « Amélioration » est un achat optionnel du joueur (sinon elle s'applique
            d'office). Quand plusieurs améliorations sont <strong>mutuellement exclusives</strong> (ex. les 3
            spécialités « Racines Tribales »), donnez-leur le même <code>choiceGroup</code> : le constructeur n'en
            gardera qu'une.
          </p>
          <Code>{`// Sur chacune des 3 cartes :
"amelioration": true,
"choiceGroup": "artisane-racines"`}</Code>
          <p>
            Une amélioration <strong>partagée</strong> (<code>shared: true</code>) est <strong>payée une seule
            fois par Fer de Lance</strong>, quel que soit le nombre de figurines qui en bénéficient : on l'active
            depuis n'importe quel modèle éligible et l'effet (portée <code>fer-de-lance</code>) profite à toute sa
            cible (ex. Lien de la Terre).
          </p>
          <Code>{`"amelioration": true,
"shared": true`}</Code>

          <H>Fiabilité & champs « à vérifier »</H>
          <p>
            Les valeurs peu lisibles sur les cartes (stature, certaines stats, dés de maîtrise) sont marquées « à
            vérifier » (⚠) via le bouton à côté du champ : elles s'affichent en ambre et sont comptées en tête de la
            barre latérale, pour une relecture humaine. Le verbatim, lui, reste la référence.
          </p>
        </div>
      </div>
    </div>
  );
}
