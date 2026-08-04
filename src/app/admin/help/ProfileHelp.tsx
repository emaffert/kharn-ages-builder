import { HelpExample, HelpTitle, SectionHelp } from "../SectionHelp";

/**
 * Aides des sections de la fiche d'un profil. Textes destinés à qui saisit des cartes : ce qu'on
 * voit à l'écran, ce que ça change pour le joueur, et un exemple réel à chaque fois.
 *
 * À relire dès qu'on touche à la section correspondante. Des tests vérifient que les options
 * décrites ici existent encore telles quelles dans l'interface.
 */

export function IdentityHelp() {
  return (
    <SectionHelp title="Aide - identité d'une figurine">
      <p>
        Cette section dit <strong>qui est la figurine</strong> : son nom, le groupe auquel elle
        appartient, son niveau, sa faction, et deux réglages qui méritent une explication.
      </p>

      <HelpTitle>Le groupe</HelpTitle>
      <p>
        Un groupe rassemble les <strong>versions d'une même figurine</strong>. Le Guerrier Mongo
        existe en niveaux I, II et III : ce sont trois fiches, mais un seul groupe. C'est le groupe
        qui apparaît dans la liste de recrutement du joueur, et c'est là qu'il choisit son niveau.
      </p>
      <p>
        Deux figurines qui portent le même nom sans être la même figurine ne doivent{" "}
        <strong>pas</strong> partager un groupe : elles se disputeraient la limite de recrutement.
      </p>

      <HelpTitle>Le peuple d'origine</HelpTitle>
      <p>
        Presque toutes les figurines viennent du peuple dont elles portent le logo : ce menu reste
        alors sur <strong>« sa faction »</strong>, et il n'y a rien à faire.
      </p>
      <p>
        Il ne sert qu'aux <strong>transfuges</strong> : les membres de la Guilde Noire et les
        Affranchis, qui ont quitté leur peuple pour en rejoindre un autre.
      </p>
      <p>
        Le renseigner a <strong>une seule conséquence automatique</strong> : la figurine peut acheter
        la <strong>monture de son peuple d'avant</strong>. Un transfuge d'origine khârne se voit
        proposer le Quagga, un khérops le Kœlod, un goûn la Mochère. Fang ou tembo, il reste à pied,
        ces peuples n'ayant pas de monture.
      </p>
      <p>
        Il ne lui ouvre <strong>rien d'autre</strong> : ni les armes réservées à son ancien peuple, ni
        ses sorts, ni ses compétences réservées.
      </p>
      <HelpExample>
        <strong>Gakere</strong>, de la Guilde Noire, a « Goüns » pour peuple d'origine. La Mochère lui
        est donc proposée, mais pas la Canne des esprits, réservée aux Goüns.
      </HelpExample>

      <HelpTitle>La nature carnivore ou herbivore</HelpTitle>
      <p>
        Elle suit le peuple d'origine dans les règles, mais <strong>l'outil ne la déduit pas</strong>{" "}
        : c'est à toi de poser la compétence « Carnivore » sur la fiche, comme n'importe quelle autre
        compétence. Renseigner le peuple d'origine ne la fait pas apparaître.
      </p>
      <p>
        Deux cas, à ne pas confondre :
      </p>
      <ul className="adm-doc-list">
        <li>
          <strong>Les Affranchis</strong> gardent la nature de leur peuple. Un Affranchi d'origine
          khârne ou fang est carnivore : la compétence se saisit à la main.
        </li>
        <li>
          <strong>La Guilde Noire n'en a aucune.</strong> Ses figurines ne représentent pas leur
          espèce d'origine : ne rien leur poser, même si leur peuple d'origine est carnivore.
        </li>
      </ul>
      <p>
        Quels peuples sont carnivores se lit dans <strong>Réglages → Factions</strong>, colonne
        « Nature ». Cette colonne sert de mémo : rien ne la lit non plus.
      </p>

      <HelpTitle>« Choisie au recrutement »</HelpTitle>
      <p>
        Dernière entrée du même menu, elle sert aux figurines dont l'origine <strong>n'est pas
        décidée d'avance</strong> : c'est le joueur qui tranche, figurine par figurine, au moment de
        la recruter. Cocher des peuples fait apparaître la question dans le constructeur.
      </p>
      <HelpExample>
        L'<strong>Agent sombre</strong> est un infiltré « recruté dans tous les royaumes ». Une seule
        fiche, mais cinq provenances possibles - fang, goûn, khârn, khérops, tembo - dont dépend la
        monture qu'il pourra prendre. Le joueur choisit à chaque recrutement, et peut en changer
        ensuite d'un clic sur sa ligne.
      </HelpExample>

      <HelpTitle>Le socle</HelpTitle>
      <p>
        Le diamètre en millimètres, imprimé à droite de la limitation sur les cartes qui le donnent.
        Beaucoup ne l'impriment pas : laisser vide dans ce cas, ce n'est pas un oubli. Il ne sert pour
        l'instant qu'à la figurine physique, aucune règle ne le lit.
      </p>
    </SectionHelp>
  );
}

export function TraitsHelp() {
  return (
    <SectionHelp title="Aide - traits">
      <p>
        Un trait est une <strong>étiquette invisible</strong>. Elle n'apparaît jamais sur la carte du
        joueur : elle sert uniquement à ce que d'autres règles puissent désigner un groupe de
        figurines d'un seul mot.
      </p>
      <p>
        C'est la différence avec une <strong>compétence</strong>, qui, elle, est imprimée sur la carte
        et se voit sur la fiche. Un mot-clé qui doit à la fois s'afficher et servir de cible existe
        donc <strong>deux fois</strong> : en compétence pour être lu, en trait pour être visé.
      </p>

      <HelpTitle>À quoi ça sert</HelpTitle>
      <ul className="adm-doc-list">
        <li>
          <strong>Réserver un objet ou un sort</strong> à un groupe : le Madrier n'est proposé qu'aux
          figurines portant le trait « synkherces ».
        </li>
        <li>
          <strong>Viser des figurines dans un effet</strong> : Engueran réduit le coût de tous les
          « paladin » de son Fer de Lance.
        </li>
        <li>
          <strong>Rattacher une carte spéciale</strong> à une famille entière plutôt qu'à des
          figurines nommées une par une.
        </li>
      </ul>

      <HelpTitle>Vérifier qu'un trait sert</HelpTitle>
      <p>
        Sous la liste, chaque trait indique <strong>où il est employé</strong>. Un trait annoncé comme
        n'étant référencé par aucune règle ne fait rien du tout : soit la règle qui devait s'en servir
        reste à écrire, soit le trait est une coquille - une faute de frappe suffit à ce qu'il ne
        corresponde plus à rien.
      </p>
      <HelpExample>
        Écrire « paladins » au lieu de « paladin » ne provoque aucune erreur : la figurine porte
        simplement un trait que personne ne regarde, et la remise d'Engueran ne s'applique plus.
      </HelpExample>
    </SectionHelp>
  );
}

export function EffectsHelp() {
  return (
    <SectionHelp title="Aide - effets et octrois">
      <p>
        Un effet est ce que la figurine, la carte ou l'objet <strong>apporte</strong> : une remise,
        une compétence donnée à d'autres, une caractéristique modifiée, des pages de sorts en plus.
      </p>
      <p>
        À ne pas confondre avec une <strong>contrainte</strong>, qui interdit. Un effet ajoute
        toujours quelque chose ; il ne rend jamais une liste illégale.
      </p>

      <HelpTitle>Les trois questions de tout effet</HelpTitle>
      <ul className="adm-doc-list">
        <li>
          <strong>Sur qui ?</strong> - la cible. Elle-même, ou des figurines décrites par leur
          faction, leur trait, leur niveau, leur nom.
        </li>
        <li>
          <strong>Jusqu'où ?</strong> - la portée : le Fer de Lance seul, ou tout l'Ost.
        </li>
        <li>
          <strong>À quelle condition ?</strong> - facultatif. Sans condition, l'effet joue dès que la
          source est recrutée.
        </li>
      </ul>
      <HelpExample>
        <strong>Le Belliciste</strong> donne « Spécialiste attaque » à toutes les figurines de son Fer
        de Lance : cible « toutes », portée « Fer de Lance », aucune condition. Le joueur voit la
        compétence apparaître en surbrillance sur chaque fiche concernée, et peut cliquer dessus pour
        savoir d'où elle vient.
      </HelpExample>

      <HelpTitle>Les actions possibles</HelpTitle>
      <p>
        Le menu les range en quatre familles. Chacune fait apparaître ses propres champs une fois
        choisie.
      </p>
      <p>
        <strong>Coût</strong>
      </p>
      <ul className="adm-doc-list">
        <li>
          <strong>Modifier le coût</strong> - ajoute ou retranche des Kouronnes. Une case « si arme de
          base changée » ne l'applique qu'aux figurines ayant remplacé leur arme d'origine.
        </li>
        <li>
          <strong>Fixer le coût</strong> - impose un prix, en général zéro. Un nombre maximum limite
          combien de figurines en profitent.
        </li>
        <li>
          <strong>Réduire un grimoire</strong> - baisse le prix du grimoire de la cible, au choix le
          petit, le grand, ou les deux.
        </li>
      </ul>
      <p>
        <strong>Octrois</strong>
      </p>
      <ul className="adm-doc-list">
        <li>
          <strong>Conférer une compétence</strong> - la plus employée. Une valeur si la compétence en
          prend une (« Héroïque défense »), une précision libre affichée à côté (« Spécialiste :
          hache »), et « + si déjà connue » qui <em>augmente</em> la valeur au lieu de la remplacer
          quand la figurine possède déjà la compétence.
        </li>
        <li>
          <strong>Conférer un sort</strong> - un sort connu d'office, gratuit, sans grimoire ni page.
        </li>
        <li>
          <strong>Conférer des sorts au choix</strong> - un nombre de sorts que <em>le joueur</em>{" "}
          choisit, dans une école entière ou dans une liste que tu désignes. Hors budget de pages,
          mais le prix en Kouronnes reste dû.
        </li>
        <li>
          <strong>Conférer un trait</strong> - pose une étiquette invisible, que d'autres règles
          pourront viser.
        </li>
        <li>
          <strong>Conférer un dé de maîtrise</strong> - un dé de plus, dont tu coches les domaines.
        </li>
        <li>
          <strong>Débloquer une amélioration</strong> - ouvre un supplément payant sur{" "}
          <em>chaque</em> objet des catégories visées, que le joueur coche objet par objet. Peut
          conférer des compétences tant que l'objet amélioré est porté.
        </li>
      </ul>
      <p>
        <strong>Caractéristiques &amp; compétences</strong>
      </p>
      <ul className="adm-doc-list">
        <li>
          <strong>Modifier une caractéristique</strong> - ajoute ou retranche. « niveau » comme
          valeur applique le niveau de la figurine elle-même.
        </li>
        <li>
          <strong>Caractéristique = comptage de figurines</strong> - la valeur devient le nombre de
          figurines correspondant à la description donnée. Jamais en dessous de la valeur imprimée.
        </li>
        <li>
          <strong>Caractéristique augmentée par figurine comptée</strong> - le montant s'ajoute à la
          valeur imprimée, une fois par figurine correspondant à la description. « +1 en Témérité par
          Mongo en jeu » se saisit ainsi. À ne pas confondre avec le comptage ci-dessus, qui
          <em>remplace</em> la valeur au lieu de s'y ajouter.
        </li>
        <li>
          <strong>Caractéristique = plus forte du groupe</strong> - la valeur devient la meilleure du
          groupe décrit. Jamais en dessous de la valeur imprimée.
        </li>
        <li>
          <strong>Compétence = comptage de figurines</strong> - la valeur d'une compétence chiffrée
          devient un décompte, éventuellement divisé (une par tranche de deux, par exemple).
        </li>
      </ul>
      <p>
        <strong>Divers</strong>
      </p>
      <ul className="adm-doc-list">
        <li>
          <strong>Pages de sorts</strong> - des pages en plus. Sans école, elles servent à n'importe
          quel sort ; avec une école, elles forment une réserve <em>réservée</em> à celle-ci.
        </li>
        <li>
          <strong>Modifier la limitation (X)</strong> - relève ou abaisse le nombre d'exemplaires
          recrutables des figurines visées. Sans effet sur les uniques et les personnages.
        </li>
      </ul>

      <HelpTitle>Effets qui changent la liste, effets de jeu</HelpTitle>
      <p>
        Les actions ci-dessus se calculent au moment de composer la liste : un prix, une compétence,
        une limite. Ce qui n'existe que sur la table - un bonus au jet de dés, un déplacement -{" "}
        <strong>ne se saisit pas en effet</strong> : ça reste dans le texte de la carte, où le joueur
        le lira au bon moment.
      </p>
      <HelpExample>
        « Les mages affranchis gagnent +1 par allié non activé dans leur aura » ne change ni le coût
        ni la composition : ce texte reste tel quel, il n'y a pas d'effet à écrire.
      </HelpExample>

      <HelpTitle>Le texte officiel</HelpTitle>
      <p>
        Chaque effet garde à côté de lui la <strong>phrase de la carte</strong> dont il est tiré.
        C'est elle qui fait foi : en cas de doute sur ce que fait un effet, c'est cette phrase qu'on
        relit, pas les réglages.
      </p>
      <p>
        Elle sert d'abord ici, à la relecture. Mais pour les effets qui modifient une{" "}
        <strong>caractéristique</strong>, une <strong>compétence</strong> ou une{" "}
        <strong>limitation</strong>, <strong>le joueur la voit aussi</strong> : en cliquant la valeur
        surlignée sur sa fiche, il obtient un bloc « Modifiée par » qui nomme la source et affiche
        cette phrase. Elle doit donc être lisible par lui, pas seulement par toi.
      </p>
      <HelpExample>
        Un Guerrier khérops dont la Charge brutale passe à 2 grâce à son Kœlod peut cliquer la
        compétence et lire d'où vient le changement.
      </HelpExample>
    </SectionHelp>
  );
}

export function ConstraintsHelp() {
  return (
    <SectionHelp title="Aide - contraintes">
      <p>
        Une contrainte est une <strong>barrière</strong> : elle rend la liste du joueur invalide tant
        qu'elle n'est pas respectée, avec un message sur la ligne de la figurine concernée.
      </p>
      <p>
        Elle bloque toujours. Une règle qui ne bloquerait pas n'est pas une contrainte : si elle
        ajoute quelque chose, c'est un effet ; si elle ne concerne que la partie, elle reste dans le
        texte de la carte.
      </p>

      <HelpTitle>Les six barrières</HelpTitle>
      <ul className="adm-doc-list">
        <li>
          <strong>Nécessite une présence</strong> - la figurine ne peut pas être recrutée sans une
          autre, que tu désignes. Muskh a besoin de Xayìn.
        </li>
        <li>
          <strong>Rattachement (garde / porteur)</strong> - la figurine ne se recrute pas seule : elle
          arrive accrochée à une porteuse, décrite par son trait, son nom ou son groupe. Les Likans
          viennent avec une femelle Fang, et le joueur les ajoute depuis sa ligne à elle.
        </li>
        <li>
          <strong>Esclave (possédée par un Seigneur de guerre)</strong> - la figurine entre par un
          Seigneur de guerre, qui la possède. Elle apparaît en « recrutement conditionnel » : le
          joueur ne l'achète pas directement, il l'ajoute depuis son maître.
        </li>
        <li>
          <strong>Interdit d'équiper</strong> - ferme des catégories d'achat entières (armes,
          armures, boucliers, objets). Une figurine dont tout est fermé ne se voit plus proposer
          d'équipement du tout. Deux réglages resserrent l'interdiction quand la carte ne ferme pas
          toute une catégorie : le <strong>nombre de mains</strong>, pour « ne peut manier d'arme à
          deux mains », et une liste d'objets <strong>laissés autorisés</strong>, pour « ne peut
          choisir que la Sarclette ou le Couteau ».
        </li>
        <li>
          <strong>Interdit d'acquérir un grimoire</strong> - ferme le petit, le grand, ou les deux.
        </li>
        <li>
          <strong>Appartenance de faction</strong> - ouvre <em>l'inverse</em> des autres : elle laisse
          la figurine rejoindre les factions que tu coches. C'est le « Allié des X » des cartes, et
          la figurine apparaît alors dans la section « Hors Faction » du roster concerné.
        </li>
      </ul>
      <p>
        Chaque contrainte garde la <strong>phrase de la carte</strong> dont elle est tirée. Elle
        s'affiche au joueur dans le message d'erreur, sous l'explication : c'est ce qui lui dit
        pourquoi sa liste est refusée.
      </p>

      <HelpTitle>Une règle qu'aucune contrainte ne couvre</HelpTitle>
      <p>
        Elle se met en <strong>notes internes</strong>, en bas de la fiche. Mieux vaut une note qu'une
        contrainte approximative : la note se relit, la contrainte fausse bloque des listes légitimes.
      </p>
    </SectionHelp>
  );
}
