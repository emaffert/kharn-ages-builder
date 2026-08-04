import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Enveloppe sortable (dnd-kit) d'un groupe « figurine + ses rattachées ».
 * La poignée (grip) reçoit `handleProps` ; le décalage des lignes est animé par dnd-kit.
 */
export function SortableUnit({
  id,
  children,
}: {
  id: string;
  children: (h: { isDragging: boolean; handleProps: Record<string, unknown> }) => ReactNode;
}) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className="bld-unit-group"
      style={{
        // Translate seul : `Transform` ajoute un scaleX/scaleY qui étire ou écrase
        // le bloc déplacé quand les lignes n'ont pas toutes la même hauteur.
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 5 : undefined,
      }}
    >
      {children({ isDragging, handleProps: { ...attributes, ...listeners } })}
    </div>
  );
}
