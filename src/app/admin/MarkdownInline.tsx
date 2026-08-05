import { Fragment, type ReactNode } from "react";

/**
 * Rendu des marques Markdown **en ligne** d'un texte du journal : gras, italique, code. Le journal
 * n'en emploie pas d'autres, et une puce lue avec ses astérisques à l'écran (`**Une seule arme
 * gratuite par Safar.**`) donne l'impression d'un texte non terminé.
 *
 * Volontairement minimal, comme le lecteur du journal : pas de liens, pas de titres, pas de
 * bibliothèque. Ce qui n'est pas reconnu est laissé tel quel plutôt que d'être avalé.
 */
const PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;

export function MarkdownInline({ text }: { text: string }): ReactNode {
  return text.split(PATTERN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const italic =
      (part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length > 2);
    if (italic) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
