import * as RP from "@radix-ui/react-popover";
import type { ReactNode } from "react";

/**
 * Popover (backé Radix) - pour les fiches d'info (équipement, sort) au lieu d'une
 * grande modale. Le déclencheur reçoit le focus/aria automatiquement.
 */
export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <RP.Root>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content className="ui-pop" sideOffset={8} collisionPadding={12}>
          {children}
          <RP.Arrow className="ui-pop__arrow" width={12} height={6} />
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
