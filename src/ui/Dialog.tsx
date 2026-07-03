import * as RD from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

/**
 * Modale à **taille fixe** (backée Radix : focus-trap, Échap, empilement et a11y gérés).
 * Les variantes `md`/`lg` imposent une hauteur fixe : le contenu défile à l'intérieur au
 * lieu de faire enfler la fenêtre.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="ui-dialog__scrim" />
        {/* Sans description explicite, aria-describedby={undefined} coupe l'avertissement Radix. */}
        <RD.Content
          className={`ui-dialog ui-dialog--${size}`}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="ui-dialog__head">
            <RD.Title className="ui-dialog__title">{title}</RD.Title>
            {description ? <RD.Description className="sr-only">{description}</RD.Description> : null}
            <RD.Close className="ui-dialog__x" aria-label="Fermer">
              ✕
            </RD.Close>
          </div>
          <div className="ui-dialog__body">{children}</div>
          {footer ? <div className="ui-dialog__foot">{footer}</div> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
