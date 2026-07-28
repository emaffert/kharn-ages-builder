import { Button } from "@ui";
import { useCatalog } from "../catalog/context";

/**
 * Signale qu'une nouvelle version du catalogue a été publiée pendant que cet écran était ouvert.
 *
 * Rien n'a été touché : les modifications en cours sont toujours là, et le rechargement n'est pas
 * imposé. Mais elles portent désormais sur une version dépassée et ne pourront pas être publiées -
 * autant le dire tout de suite, pendant qu'il est encore possible de recopier ce qui compte, plutôt
 * qu'au moment du refus de publier ou d'un rechargement subi.
 */
export function NewVersionNotice() {
  const { update } = useCatalog();
  if (!update) return null;

  return (
    <div className="adm-banner mb-5">
      <div className="adm-banner-icon" aria-hidden>
        ↯
      </div>
      <div className="flex-1">
        <p className="adm-banner-title">Une nouvelle version vient d'être publiée</p>
        <p className="adm-banner-text">
          Quelqu'un a publié la version <strong>« {update.version} »</strong> pendant que tu travaillais. Cet écran
          montre encore la précédente. <strong>Rien n'a été perdu</strong>, mais tes modifications en cours ne
          pourront pas être publiées : elles portent sur une version dépassée.
        </p>
        <p className="adm-banner-text">
          Recopie ce que tu veux garder, puis recharge pour repartir de la nouvelle version. Ce qui n'aura pas été
          publié sera abandonné au rechargement.
        </p>
      </div>
      <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
        Recharger
      </Button>
    </div>
  );
}
