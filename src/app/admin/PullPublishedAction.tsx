import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalog } from "@core";
import { writePublishedCatalog } from "@data";
import { Button, Dialog } from "@ui";
import { useCatalog } from "../catalog/context";
import { fetchPublishedCatalog } from "../../lib/catalogApi";
import { supabase } from "../../lib/supabase";

/**
 * « Repartir de la version publiée » : récupère la dernière version du serveur et la prend comme
 * base d'édition, en abandonnant le brouillon local.
 *
 * C'est la première étape du cycle de resynchronisation du dépôt : récupérer la version publiée,
 * « Enregistrer » pour l'écrire dans `catalog.json`, puis committer. Réservé au développement -
 * en production, le catalogue servi vient déjà du serveur.
 */
export function PullPublishedAction({
  dirty,
  onPulled,
  client = supabase,
}: {
  dirty: boolean;
  onPulled: (published: Catalog) => void;
  client?: SupabaseClient | null;
}) {
  const { refresh } = useCatalog();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!client) return null;

  async function pull() {
    if (!client) return;
    setBusy(true);
    setError(null);
    const published = await fetchPublishedCatalog(client);
    setBusy(false);
    if (!published) {
      setError("Aucune version publiée, ou serveur injoignable.");
      return;
    }
    writePublishedCatalog(published, published.catalog);
    refresh();
    onPulled(published.catalog);
    setConfirming(false);
  }

  return (
    <>
      <Button size="sm" onClick={() => setConfirming(true)}>
        Repartir de la version publiée
      </Button>

      <Dialog
        open={confirming}
        onOpenChange={(isOpen) => {
          setConfirming(isOpen);
          if (!isOpen) setError(null);
        }}
        size="sm"
        title="Repartir de la version publiée"
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>La dernière version publiée sur le serveur remplacera le catalogue affiché ici.</p>
          {dirty && (
            <p className="ui-warn">
              Tes modifications locales non publiées seront perdues.
            </p>
          )}
          {error && (
            <p className="ui-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setConfirming(false)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="primary" size="sm" onClick={pull} disabled={busy}>
              {busy ? "Récupération…" : "Remplacer"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
