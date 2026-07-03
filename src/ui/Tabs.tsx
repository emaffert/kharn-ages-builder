import * as RT from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

/**
 * Onglets (backés Radix : navigation clavier + a11y).
 * Usage : <Tabs tabs={[{value,label,content}]} defaultValue=… />
 */
export function Tabs({
  tabs,
  defaultValue,
  ariaLabel,
}: {
  tabs: ReadonlyArray<{ value: string; label: ReactNode; content: ReactNode }>;
  defaultValue?: string;
  ariaLabel?: string;
}) {
  return (
    <RT.Root defaultValue={defaultValue ?? tabs[0]?.value}>
      <RT.List className="ui-tabs__list" aria-label={ariaLabel}>
        {tabs.map((t) => (
          <RT.Trigger key={t.value} value={t.value} className="ui-tab">
            {t.label}
          </RT.Trigger>
        ))}
      </RT.List>
      {tabs.map((t) => (
        <RT.Content key={t.value} value={t.value}>
          {t.content}
        </RT.Content>
      ))}
    </RT.Root>
  );
}
