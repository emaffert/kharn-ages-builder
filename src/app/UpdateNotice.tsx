import { useEffect, useState } from "react";
import { Button, Dialog } from "@ui";
import { applyUpdate, isUpdateReady, subscribeUpdateReady } from "./updates";

/**
 * Invitation à recharger quand une nouvelle version du site est prête.
 *
 * Volontairement une proposition et non un rechargement d'office : la liste en cours de composition
 * ne vit que dans la page, et la reprendre à zéro serait une punition pour être resté connecté au
 * mauvais moment. « Plus tard » laisse l'ancienne version tourner, ce qui est sans danger - le
 * catalogue, lui, vient du serveur et reste à jour.
 */
export function UpdateNotice() {
  const [ready, setReady] = useState(isUpdateReady);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeUpdateReady(() => setReady(true)), []);

  return (
    <Dialog
      open={ready && !dismissed}
      onOpenChange={(o) => {
        if (!o) setDismissed(true);
      }}
      size="sm"
      title="Le site a été mis à jour"
      footer={
        <>
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            Plus tard
          </Button>
          <Button onClick={applyUpdate}>Recharger</Button>
        </>
      }
    >
      <p>
        Une nouvelle version est prête. Rechargez la page pour en profiter.
      </p>
      <p className="mt-2 text-sm opacity-80">
        Si vous avez une liste en cours qui n'est pas enregistrée, enregistrez-la d'abord : le
        rechargement repart d'une page vierge.
      </p>
    </Dialog>
  );
}
