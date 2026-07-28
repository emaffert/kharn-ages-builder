import { createContext, useContext } from "react";
import { loadCatalog } from "@data";
import type { Catalog } from "@core";
import type { PublishedMeta } from "../../lib/catalogApi";

export type CatalogValue = {
  /** Catalogue actif : brouillon admin local, sinon dernière version publiée, sinon bundlé. */
  catalog: Catalog;
  /** Repère de la version publiée connue (numéro + date), `null` si aucune. */
  published: PublishedMeta | null;
  /**
   * Une version plus récente que celle affichée a été publiée pendant que la page était ouverte.
   * Rien n'est appliqué : la donnée n'est même pas téléchargée. C'est un signalement, à charge de
   * l'écran d'inviter au rechargement - remplacer le catalogue sous les doigts de quelqu'un
   * effacerait son travail en cours sans qu'il ait rien demandé.
   */
  update: PublishedMeta | null;
  /** Recharge le catalogue actif depuis le stockage local (après édition admin ou publication). */
  refresh: () => void;
};

/**
 * Valeur par défaut (évaluée une fois à l'import) : le catalogue local, sans serveur. Elle permet
 * d'utiliser les écrans hors provider (tests, rendus isolés) comme avant la synchro.
 */
export const CatalogContext = createContext<CatalogValue>({
  catalog: loadCatalog(),
  published: null,
  update: null,
  refresh: () => {},
});

/** Catalogue actif de l'app (voir `CatalogProvider`). */
export function useCatalog(): CatalogValue {
  return useContext(CatalogContext);
}
