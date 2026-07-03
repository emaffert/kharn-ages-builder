import * as RT from "@radix-ui/react-toast";
import type { ReactNode } from "react";

/** Fournisseur + viewport des toasts (à monter autour de la zone qui en émet). */
export function ToastProvider({ children, duration = 2400 }: { children: ReactNode; duration?: number }) {
  return (
    <RT.Provider swipeDirection="right" duration={duration}>
      {children}
      <RT.Viewport className="ui-toast-vp" />
    </RT.Provider>
  );
}

/** Notification brève (confirmation d'action). Contrôlée via `open`. */
export function Toast({
  open,
  onOpenChange,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
}) {
  return (
    <RT.Root open={open} onOpenChange={onOpenChange} className="ui-toast">
      <RT.Title className="ui-toast-title">{title}</RT.Title>
    </RT.Root>
  );
}
