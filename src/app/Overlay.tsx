import { type ReactNode, useEffect } from "react";

/**
 * Modale plein écran (fond assombri cliquable pour fermer).
 *
 * Gestion de la touche Échap : quand plusieurs modales sont empilées (ex. une fiche d'objet
 * par-dessus l'éditeur d'une figurine), Échap ne doit fermer que **celle du dessus**. Chaque
 * `Overlay` monté s'enregistre dans une pile partagée ; un unique listener global appelle
 * l'`onClose` du sommet de la pile.
 */
const overlayStack: Array<() => void> = [];

function onGlobalKey(e: KeyboardEvent): void {
  if (e.key === "Escape") overlayStack[overlayStack.length - 1]?.();
}

export function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }): React.JSX.Element {
  useEffect(() => {
    if (overlayStack.length === 0) window.addEventListener("keydown", onGlobalKey);
    overlayStack.push(onClose);
    return () => {
      const i = overlayStack.lastIndexOf(onClose);
      if (i >= 0) overlayStack.splice(i, 1);
      if (overlayStack.length === 0) window.removeEventListener("keydown", onGlobalKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div
        className="kh-builder kh-parchment max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl p-6 shadow-2xl sm:w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
