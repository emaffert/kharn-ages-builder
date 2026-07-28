import { useState } from "react";
import { clearStaleDraftNotice, staleDraftWasDropped } from "@data";
import { Button } from "@ui";

/**
 * Annonce l'abandon d'un brouillon devenu caduc.
 *
 * Quand une nouvelle version est publiée, le brouillon en cours dans ce navigateur est écarté :
 * il portait sur la version précédente, et le publier écraserait le travail de quelqu'un d'autre.
 * Sans cette annonce, l'écran changerait tout seul et le travail semblerait avoir disparu sans
 * raison ; l'expliquer coûte une phrase.
 */
export function StaleDraftNotice() {
  const [visible, setVisible] = useState(() => staleDraftWasDropped());
  if (!visible) return null;

  return (
    <div className="adm-banner mb-5">
      <div className="adm-banner-icon" aria-hidden>
        ⟳
      </div>
      <div className="flex-1">
        <p className="adm-banner-title">Modifications non publiées abandonnées</p>
        <p className="adm-banner-text">
          Une <strong>nouvelle version du catalogue a été publiée</strong> pendant que tu travaillais. Cet écran est
          reparti de cette version : les modifications que tu n'avais pas publiées ont été abandonnées. Elles portaient
          sur une version dépassée, et les publier aurait effacé le travail de la personne qui vient de publier.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => {
          clearStaleDraftNotice();
          setVisible(false);
        }}
      >
        Compris
      </Button>
    </div>
  );
}
