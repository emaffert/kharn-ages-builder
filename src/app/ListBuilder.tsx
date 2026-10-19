import { useEffect, useState } from "react";
import { parseListDocument, type ListDocument } from "@core";
import { useListStore } from "./useListStore";
import { FactionSelect } from "./builder/FactionSelect";
import { BuilderScreen } from "./builder/BuilderScreen";

/**
 * Constructeur de liste joueur. Flux : écran de sélection de faction → écran de construction
 * (roster + liste) avec barre d'actions ; aperçu de carte et édition d'une figurine en modales.
 * L'état vit dans `useListStore` (ListDocument) ; coûts et validation viennent de `evaluateList`.
 */

/** Liste en cours de construction dans cet onglet, pour la retrouver si le navigateur recharge la page. */
const CURRENT_LIST_KEY = "kharn-current-list-v1";

/** readCurrentList renvoie la liste en cours enregistrée pour cet onglet, ou null s'il n'y en a pas. */
function readCurrentList(): ListDocument | null {
  try {
    const raw = window.sessionStorage.getItem(CURRENT_LIST_KEY);
    return raw ? parseListDocument(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCurrentList(list: ListDocument | null): void {
  try {
    if (list) window.sessionStorage.setItem(CURRENT_LIST_KEY, JSON.stringify(list));
    else window.sessionStorage.removeItem(CURRENT_LIST_KEY);
  } catch {
    // Stockage indisponible (navigation privée, quota) : la liste vit seulement en mémoire.
  }
}

export function ListBuilder() {
  // Un téléphone décharge souvent l'onglet en veille et le recharge au réveil : on reprend la liste
  // en cours là où on l'avait laissée.
  const [resumed] = useState(readCurrentList);
  const store = useListStore(undefined, resumed ?? undefined);
  const [step, setStep] = useState<"select" | "build">(resumed ? "build" : "select");
  useEffect(() => {
    writeCurrentList(step === "build" ? store.list : null);
  }, [step, store.list]);

  if (step === "select") {
    return (
      <FactionSelect
        store={store}
        onStart={(id, format, pointsLimit) => {
          store.newList(id, { format, pointsLimit });
          setStep("build");
        }}
        onLoad={(doc) => {
          store.loadSaved(doc);
          setStep("build");
        }}
      />
    );
  }
  return <BuilderScreen store={store} onNew={() => setStep("select")} />;
}
