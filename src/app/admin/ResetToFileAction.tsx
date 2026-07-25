import { useState } from "react";
import { Button, Dialog } from "@ui";

/**
 * « Repartir du fichier » : abandonne le brouillon local et réédite le `catalog.json` embarqué
 * dans le build. Réservé au développement - c'est ce qui permet de reprendre la main après avoir
 * modifié le fichier à la main, une fois qu'une version publiée masque le fichier.
 */
export function ResetToFileAction({ dirty, onReset }: { dirty: boolean; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setConfirming(true)}>
        Repartir du fichier
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming} size="sm" title="Repartir du fichier">
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Le <code>catalog.json</code> du dépôt remplacera le catalogue affiché ici.
          </p>
          {dirty && <p className="ui-warn">Tes modifications locales non publiées seront perdues.</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onReset();
                setConfirming(false);
              }}
            >
              Remplacer
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
