import type { ReactNode } from "react";

type Tone = "neutral" | "warn" | "moss" | "amber";

/** Pastille sémantique (statut, mot-clé). */
export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const cls = tone === "neutral" ? "ui-tag" : `ui-tag ui-tag--${tone}`;
  return <span className={cls}>{children}</span>;
}
