import { useState, type ReactNode } from "react";
import { Dialog } from "@ui";

/**
 * Aide d'une section de fiche : un bouton discret dans son en-tête, un texte dans une modale.
 *
 * L'aide vit **à côté de ce qu'elle explique** plutôt que dans un manuel séparé - un manuel se
 * consulte rarement et vieillit sans qu'on s'en aperçoive, alors qu'un texte accroché à sa section
 * saute aux yeux le jour où l'on touche à celle-ci.
 *
 * Elle s'adresse à quelqu'un qui saisit des cartes, pas à quelqu'un qui lit le code : elle décrit ce
 * qu'on voit à l'écran et ce que ça produit pour le joueur, avec des exemples pris dans le
 * catalogue. Aucune mention de champ, de type ni de fichier.
 */
export function SectionHelp({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="adm-tab" title={title}>
        Aide
      </button>
      <Dialog open={open} onOpenChange={setOpen} size="lg" title={title}>
        <div className="adm-doc-body">{children}</div>
      </Dialog>
    </>
  );
}

/** Titre de rubrique dans une aide. */
export function HelpTitle({ children }: { children: string }) {
  return <h2 className="adm-doc-h2">{children}</h2>;
}

/**
 * Exemple pris dans le catalogue réel. Toujours nommer une vraie figurine, une vraie carte : un
 * exemple abstrait n'aide personne à reconnaître son propre cas.
 */
export function HelpExample({ children }: { children: ReactNode }) {
  return <p className="adm-doc-eg">{children}</p>;
}
