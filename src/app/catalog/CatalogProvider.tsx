import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCatalog, readPublishedCatalog, writePublishedCatalog } from "@data";
import type { Catalog } from "@core";
import { fetchLatestVersionId, fetchPublishedCatalog, type PublishedMeta } from "../../lib/catalogApi";
import { supabase } from "../../lib/supabase";
import { CatalogContext, type CatalogValue } from "./context";

/** Repère de la version publiée telle que connue du cache (le nom vient du catalogue lui-même). */
function cachedMeta(): PublishedMeta | null {
  const cached = readPublishedCatalog();
  return cached
    ? { versionId: cached.versionId, publishedAt: cached.publishedAt, version: cached.catalog.version }
    : null;
}

/** Temps laissé au serveur avant de démarrer sur le catalogue local (la synchro continue derrière). */
const REMOTE_TIMEOUT_MS = 4000;
/** Délai avant d'afficher l'écran d'attente : en dessous, la synchro est imperceptible. */
const SPINNER_DELAY_MS = 300;
/**
 * Cadence de la veille sur les publications d'autrui. La requête ne rapporte qu'un numéro de
 * version : à deux ou trois administrateurs, une minute est sans conséquence pour le serveur, et
 * c'est assez court pour qu'on n'accumule pas une demi-heure de travail condamné.
 */
const POLL_INTERVAL_MS = 60 * 1000;

/**
 * Fournit le catalogue actif à toute l'app.
 *
 * Au démarrage on laisse quelques secondes au serveur pour donner sa dernière version publiée ;
 * passé ce délai (ou en cas d'échec), on démarre sur le catalogue local - brouillon admin, sinon
 * dernière version publiée en cache, sinon catalogue bundlé - et la synchro se poursuit en
 * arrière-plan : la version distante s'applique dès qu'elle arrive.
 *
 * Le catalogue pesant plusieurs Mo, on demande d'abord le seul numéro de version : sans nouveauté,
 * la synchro ne télécharge rien. Le client est injectable pour les tests ; `null` (pas de `.env`)
 * laisse l'app en local-first, sans attente ni requête.
 */
export function CatalogProvider({
  children,
  client = supabase,
  pollMs = POLL_INTERVAL_MS,
}: {
  children: ReactNode;
  client?: SupabaseClient | null;
  /** Cadence de la veille sur les nouvelles publications ; réglable pour les tests. */
  pollMs?: number;
}) {
  const [catalog, setCatalog] = useState<Catalog>(() => loadCatalog());
  const [published, setPublished] = useState<PublishedMeta | null>(() => cachedMeta());
  // Attente initiale : uniquement s'il y a un serveur à interroger.
  const [waiting, setWaiting] = useState(() => Boolean(client));
  const [showSpinner, setShowSpinner] = useState(false);
  const [update, setUpdate] = useState<PublishedMeta | null>(null);

  const refresh = useCallback(() => {
    setCatalog(loadCatalog());
    setPublished(cachedMeta());
    setUpdate(null); // on vient de repartir du serveur : il n'y a plus de retard à signaler
  }, []);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    const timers = [
      setTimeout(() => alive && setShowSpinner(true), SPINNER_DELAY_MS),
      setTimeout(() => alive && setWaiting(false), REMOTE_TIMEOUT_MS),
    ];
    void (async () => {
      try {
        const latest = await fetchLatestVersionId(client);
        // Serveur injoignable ou rien de publié : on garde ce qu'on a.
        if (!alive || !latest) return;
        // Déjà à jour : aucune donnée à télécharger.
        if (readPublishedCatalog()?.versionId === latest.versionId) {
          setPublished(latest);
          return;
        }
        const remote = await fetchPublishedCatalog(client);
        if (!alive || !remote) return;
        writePublishedCatalog(remote, remote.catalog);
        setPublished({ versionId: remote.versionId, publishedAt: remote.publishedAt, version: remote.version });
        // `loadCatalog` et non `remote.catalog` : c'est lui qui arbitre. Le cache venant d'être mis à
        // jour, un brouillon admin bâti sur la version précédente est désormais périmé et sera
        // abandonné - la version qui vient d'être publiée prend la main, y compris pour l'admin.
        setCatalog(loadCatalog());
      } finally {
        if (alive) setWaiting(false);
      }
    })();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [client]);

  /**
   * Veille sur les publications faites pendant que la page est ouverte.
   *
   * Volontairement inerte : on ne demande que le numéro de version (quelques octets) et on se
   * contente de le signaler. Appliquer la nouvelle version reviendrait à remplacer le catalogue
   * sous les doigts de quelqu'un - c'est justement ce qu'on veut éviter -, et un rechargement
   * décidé par le site effacerait une liste ou un brouillon en cours. L'écran invite, l'utilisateur
   * choisit son moment.
   *
   * La veille s'arrête dès qu'un retard est constaté : le message ne changerait plus.
   */
  useEffect(() => {
    if (!client || update) return;
    let alive = true;
    const check = async () => {
      if (!alive || document.hidden) return;
      const latest = await fetchLatestVersionId(client);
      // `published` vaut null tant que la synchro initiale n'a pas répondu : rien à comparer encore.
      if (!alive || !latest || !published || latest.versionId === published.versionId) return;
      setUpdate(latest);
    };
    // Au retour sur l'onglet, comme pour les mises à jour du site (cf. `src/pwa.ts`) : c'est le
    // moment où l'on reprend le travail, et donc celui où le décalage compte.
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void check(), pollMs);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [client, published, update, pollMs]);

  const value = useMemo<CatalogValue>(
    () => ({ catalog, published, update, refresh }),
    [catalog, published, update, refresh],
  );

  if (waiting) {
    return (
      <div className="kh-shell flex h-screen items-center justify-center text-sm" style={{ color: "var(--bone-faint)" }}>
        {showSpinner ? "Chargement du catalogue…" : null}
      </div>
    );
  }
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
