import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalog } from "@core";
import { writePublishedCatalog } from "@data";
import { Button, Dialog } from "@ui";
import { useSession } from "../auth/context";
import { useCatalog } from "../catalog/context";
import { publishCatalog } from "../../lib/catalogApi";
import { supabase } from "../../lib/supabase";

/** « n° 12 · 24/07/2026 21:15 », ou juste le numéro si la date est inconnue. */
function describeVersion(versionId: number, publishedAt: string | null): string {
  if (!publishedAt) return `n° ${versionId}`;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return `n° ${versionId}`;
  return `n° ${versionId} · ${date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
}

/**
 * Bouton « Publier » : pousse le catalogue courant dans `catalog_versions`, ce qui en fait la
 * version servie à tous les joueurs. Réservé aux admins (la RLS le vérifie de toute façon côté
 * serveur), masqué pour tous les autres. La publication est confirmée au préalable : elle est
 * visible de tout le monde, même si l'historique permet d'y revenir.
 *
 * La ligne d'état au-dessus du bouton répond à « où en est le serveur par rapport à moi ? » :
 * version publiée connue, et présence d'un brouillon local qui n'y est pas encore.
 */
export function PublishAction({
  catalog,
  dirty,
  onPublished,
  client = supabase,
}: {
  catalog: Catalog;
  dirty: boolean;
  onPublished: () => void;
  client?: SupabaseClient | null;
}) {
  const { user, isAdmin } = useSession();
  const { published, refresh } = useCatalog();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!client || !isAdmin || !user) return null;

  async function publish() {
    if (!client || !user) return;
    setBusy(true);
    setError(null);
    const { published: meta, error: message } = await publishCatalog(client, catalog, user.id);
    setBusy(false);
    if (message || !meta) {
      setError(message ?? "Publication impossible.");
      return;
    }
    // Le cache local reflète immédiatement ce qui vient d'être publié : pas d'aller-retour
    // serveur, et la version publiée est disponible hors-ligne dès maintenant.
    writePublishedCatalog(meta, catalog);
    refresh();
    onPublished();
    setConfirming(false);
    setDone(true);
  }

  return (
    <>
      <p className="w-full text-xs adm-faint">
        {published ? `Version publiée : ${describeVersion(published.versionId, published.publishedAt)}` : "Jamais publié"}
        {dirty && <span className="adm-accent"> · brouillon local non publié</span>}
      </p>
      <Button variant="primary" size="sm" onClick={() => setConfirming(true)}>
        Publier
      </Button>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) setError(null);
        }}
        size="sm"
        title="Publier le catalogue"
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            La version <strong>{catalog.version}</strong> deviendra le catalogue servi à tous les joueurs, à leur
            prochain chargement.
          </p>
          <p className="adm-faint text-xs">
            {published
              ? `Version publiée actuelle : ${describeVersion(published.versionId, published.publishedAt)}. Elle reste dans l'historique, qui conserve les 10 dernières versions.`
              : "Aucune version n'a encore été publiée."}
          </p>
          {error && (
            <p className="ui-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setConfirming(false)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="primary" size="sm" onClick={publish} disabled={busy}>
              {busy ? "Publication…" : "Publier maintenant"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={done} onOpenChange={setDone} size="sm" title="Catalogue publié">
        <p className="text-sm">
          La version <strong>{catalog.version}</strong> est en ligne. Le brouillon local a été abandonné : cet écran
          édite désormais la version publiée.
        </p>
      </Dialog>
    </>
  );
}
