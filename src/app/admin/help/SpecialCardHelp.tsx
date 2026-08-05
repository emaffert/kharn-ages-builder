import { HelpExample, HelpTitle, SectionHelp } from "../SectionHelp";

/**
 * Aides de la fiche d'une carte spéciale. À relire dès qu'on touche à ces sections : des tests
 * vérifient que les natures et les portées décrites ici existent encore dans l'interface.
 */

export function CardKindHelp() {
  return (
    <SectionHelp title="Aide - nature d'une carte">
      <p>
        Trois natures, qui répondent à une seule question : <strong>qui décide que la carte
        s'applique ?</strong>
      </p>

      <HelpTitle>Automatique</HelpTitle>
      <p>
        Personne ne décide : la carte s'applique <strong>d'office</strong> à toute figurine que sa
        portée désigne. Le joueur la voit sur la fiche, sans rien avoir à cocher.
      </p>
      <HelpExample>
        <strong>Fille de Nyx</strong> : toutes les Filles de Nyx l'ont, toujours. Elles n'ont pas à
        l'acheter et ne peuvent pas y renoncer.
      </HelpExample>

      <HelpTitle>Amélioration</HelpTitle>
      <p>
        Le <strong>joueur choisit</strong> de l'acheter, figurine par figurine. Elle apparaît dans la
        colonne « Améliorations » de la fiche, avec son prix, et n'a d'effet qu'une fois cochée.
      </p>
      <HelpExample>
        <strong>Apprentie de Nyx</strong> : proposée aux figurines éligibles, à 15 Ko. Une Goulue peut
        la prendre ou non, c'est le joueur qui tranche.
      </HelpExample>
      <p>Quatre réglages n'existent que pour cette nature :</p>
      <ul className="adm-doc-list">
        <li>
          <strong>Groupe de choix exclusif</strong> : parmi les améliorations d'un même groupe, une
          figurine n'en prend qu'une. Les trois « Racines Tribales » de l'Artisane Dogon s'excluent.
        </li>
        <li>
          <strong>Partagée</strong> : payée <strong>une seule fois</strong> pour le Fer de Lance, quel
          que soit le nombre de figurines qui en profitent (Lien de la Terre).
        </li>
        <li>
          <strong>Prix multiplié par le niveau</strong> : le prix saisi est celui d'un niveau I. Un
          niveau II paie le double. « Aguerri aux bois » coûte ainsi 5 Ko × le niveau.
        </li>
        <li>
          <strong>Plusieurs exemplaires, jusqu'au niveau de la figurine</strong> : le joueur choisit
          une <em>quantité</em>, et paie chaque exemplaire. Un niveau II peut porter deux « Ordres de
          mission royale ». À ne pas confondre avec le réglage précédent, où c'est le prix qui varie
          et non le nombre.
        </li>
      </ul>

      <HelpTitle>Ost</HelpTitle>
      <p>
        La carte ne se choisit pas sur une figurine mais <strong>sur la liste entière</strong>, dans
        le bandeau en tête du constructeur. Elle est toujours automatique une fois retenue.
      </p>
      <p>
        Sa portée sert alors de <strong>disponibilité</strong> : la carte n'est proposée que si la
        liste contient une figurine correspondante. Et elle peut exiger une composition précise,
        auquel cas la liste reste invalide tant que celle-ci n'est pas réunie.
      </p>
      <HelpExample>
        <strong>Pacte du Secret</strong> n'est proposée que si Myriam est dans la liste, et demande
        au moins quatre personnages parmi ceux qu'elle nomme.
      </HelpExample>
    </SectionHelp>
  );
}

export function CardScopeHelp() {
  return (
    <SectionHelp title="Aide - portée d'une carte">
      <p>
        La portée dit <strong>quelles figurines</strong> la carte concerne. Les critères se cumulent :
        une figurine est retenue dès qu'elle correspond à l'un d'eux.
      </p>

      <HelpTitle>Trait, Profils, Factions</HelpTitle>
      <ul className="adm-doc-list">
        <li>
          <strong>Trait</strong> : toutes les figurines qui portent cette étiquette. Le moyen le plus
          souple, et celui qui s'étend tout seul aux figurines ajoutées plus tard.
        </li>
        <li>
          <strong>Profils</strong> : des figurines nommées une par une. Pour une carte qui ne vise
          qu'elles.
        </li>
        <li>
          <strong>Factions</strong> : toutes les figurines <strong>au logo</strong> de ces factions.
        </li>
      </ul>

      <HelpTitle>« Factions » ou « Factions du Fer de Lance » ?</HelpTitle>
      <p>
        C'est la distinction la plus délicate de cette fiche, et elle change tout.
      </p>
      <ul className="adm-doc-list">
        <li>
          <strong>Factions</strong> regarde <strong>la carte de la figurine</strong>. Une figurine au
          logo khârn est concernée par une carte « Factions : Khârns », qu'elle combatte pour les
          Khârns ou ailleurs.
        </li>
        <li>
          <strong>Factions du Fer de Lance</strong> regarde <strong>sous quelle bannière elle
          combat</strong>. Toute figurine d'un Fer de Lance affranchi est concernée par une carte
          « Factions du Fer de Lance : Affranchis », même si sa propre carte porte un autre logo.
        </li>
      </ul>
      <HelpExample>
        <strong>« Le couvert des bois »</strong> donne Furtivité à tout un Fer de Lance affranchi. Un
        Guerrier khârn rallié aux Affranchis l'obtient : il combat sous leur bannière. Avec
        « Factions : Affranchis », il ne l'aurait pas eue, puisque sa carte reste khârne - et la règle
        du jeu dit précisément l'inverse.
      </HelpExample>
      <p>
        En résumé : <strong>Factions</strong> pour ce qu'une figurine <strong>est</strong>,{" "}
        <strong>Factions du Fer de Lance</strong> pour ce qu'elle <strong>rejoint</strong>. La
        première suit la figurine partout, la seconde s'arrête à la porte du Fer de Lance.
      </p>

      <HelpTitle>« Seulement les figurines venues d'un autre peuple »</HelpTitle>
      <p>
        Cette case n'apparaît qu'avec « Factions du Fer de Lance ». Elle écarte les figurines
        <strong> natives</strong> de la faction d'accueil, et ne garde que les recrues.
      </p>
      <HelpExample>
        <strong>« Aguerri aux bois »</strong> laisse un combattant venu d'ailleurs apprendre
        « Éclaireur 2 » et « Rusé » chez les Affranchis. Un Affranchi de naissance n'en a pas besoin :
        la case le met de côté, et la carte ne lui est pas proposée.
      </HelpExample>
    </SectionHelp>
  );
}
