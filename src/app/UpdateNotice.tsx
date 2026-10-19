import { useEffect, useState } from "react";
import { Button, Dialog } from "@ui";
import { applyUpdate, isUpdateReady, subscribeUpdateReady } from "./updates";

/**
 * Invitation à recharger quand une nouvelle version du site est prête.
 *
 * Une proposition et non un rechargement d'office, une fois l'utilisateur au travail : recharger lui
 * ferait perdre la fenêtre ouverte et sa place dans la page. « Plus tard » laisse l'ancienne version
 * tourner, ce qui est sans danger - le catalogue, lui, vient du serveur et reste à jour.
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
      <p className="mt-2 text-sm opacity-80">La liste en cours est conservée.</p>
    </Dialog>
  );
}
