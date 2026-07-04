/**
 * Composants React réutilisables (présentation) + helpers de présentation.
 * Dépend de `core` pour les types ; ne contient pas de logique métier.
 */

export * from "./explain";
export * from "./labels";

// Kit de primitives (Phase 1) — backées Radix, stylées sur les tokens Forge/Braise.
export { Button } from "./Button";
export { Tag } from "./Tag";
export { Coin } from "./Coin";
export { SegmentedControl } from "./SegmentedControl";
export { Dialog } from "./Dialog";
export { Tabs } from "./Tabs";
export { Tooltip, TooltipProvider } from "./Tooltip";
export { Popover } from "./Popover";
export { Toast, ToastProvider } from "./Toast";
