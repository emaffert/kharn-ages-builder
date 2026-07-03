import * as RT from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Fournisseur unique à monter près de la racine (délais partagés). */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RT.Provider delayDuration={300}>{children}</RT.Provider>;
}

/** Infobulle courte (backée Radix). */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content className="ui-tip" sideOffset={6}>
          {content}
          <RT.Arrow style={{ fill: "var(--panel-dark)" }} />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
