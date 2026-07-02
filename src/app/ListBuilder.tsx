import { useState } from "react";
import { useListStore } from "./useListStore";
import { FactionSelect } from "./builder/FactionSelect";
import { BuilderScreen } from "./builder/BuilderScreen";

/**
 * Constructeur de liste joueur. Flux : écran de sélection de faction → écran de construction
 * (roster + liste) avec barre d'actions ; aperçu de carte et édition d'une figurine en modales.
 * L'état vit dans `useListStore` (ListDocument) ; coûts et validation viennent de `evaluateList`.
 */

export function ListBuilder() {
  const store = useListStore();
  const [step, setStep] = useState<"select" | "build">("select");
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
