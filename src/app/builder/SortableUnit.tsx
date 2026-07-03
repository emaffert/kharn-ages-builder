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
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 5 : undefined,
      }}
    >
      {children({ isDragging, handleProps: { ...attributes, ...listeners } })}
    </div>
  );
}
