import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "danger" | "ghost";

/** Bouton du kit, stylé sur les tokens Forge/Braise. */
export function Button({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const cls = [
    "ui-btn",
    variant !== "default" ? `ui-btn--${variant}` : "",
    size === "sm" ? "ui-btn--sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
