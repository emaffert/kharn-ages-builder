import { useRef, useState, type TouchEvent } from "react";

/** Distance horizontale à partir de laquelle un balayage relâché change d'onglet, en pixels. */
const COMMIT_DISTANCE = 60;
/** Déplacement à partir duquel on décide si le geste est horizontal (balayage) ou vertical (défilement). */
const AXIS_LOCK = 10;
/** Part du déplacement suivie quand il n'y a plus d'onglet dans ce sens : le contenu résiste. */
const EDGE_RESISTANCE = 0.25;

/**
 * useSwipe suit un balayage horizontal : `dragX` est le décalage à donner au contenu pendant le geste,
 * et au relâché `onNext` (vers la gauche) ou `onPrevious` (vers la droite) est appelé si le geste
 * dépasse le seuil dans un sens permis. Un geste surtout vertical, ou parti d'un champ de saisie,
 * est laissé au défilement.
 */
export function useSwipe({
  onNext,
  onPrevious,
  canNext,
  canPrevious,
}: {
  onNext: () => void;
  onPrevious: () => void;
  canNext: boolean;
  canPrevious: boolean;
}) {
  const start = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const [dragX, setDragX] = useState(0);

  const resist = (dx: number) => ((dx < 0 && canNext) || (dx > 0 && canPrevious) ? dx : dx * EDGE_RESISTANCE);

  return {
    dragX,
    dragging: dragX !== 0,
    handlers: {
      onTouchStart: (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        start.current =
          e.touches.length === 1 && !target.closest("input, textarea, select")
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null }
            : null;
      },
      onTouchMove: (e: TouchEvent) => {
        const s = start.current;
        if (!s || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - s.x;
        const dy = e.touches[0].clientY - s.y;
        if (s.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) >= AXIS_LOCK) {
          s.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
        }
        if (s.axis === "x") setDragX(resist(dx));
      },
      onTouchEnd: (e: TouchEvent) => {
        const s = start.current;
        start.current = null;
        setDragX(0);
        if (!s || s.axis !== "x" || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - s.x;
        if (dx <= -COMMIT_DISTANCE && canNext) onNext();
        else if (dx >= COMMIT_DISTANCE && canPrevious) onPrevious();
      },
      onTouchCancel: () => {
        start.current = null;
        setDragX(0);
      },
    },
  };
}
