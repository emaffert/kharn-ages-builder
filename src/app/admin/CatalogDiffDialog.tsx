import type { CatalogDiff, EntryChange, FieldChange } from "@data";
import { Dialog } from "@ui";

/** Au-delà, une valeur est tronquée : la ligne doit rester lisible, pas exhaustive. */
const MAX_VALUE = 70;

/**
 * Une valeur telle qu'on l'affiche dans une ligne de comparaison. Les blocs illisibles (une image
 * encodée dans la donnée, un objet entier) sont annoncés pour ce qu'ils sont plutôt que déroulés.
 */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string" && value.startsWith("data:")) return "(image)";
  const text = typeof value === "string" ? value : (JSON.stringify(value) ?? "-");
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

const MARK = { added: "+", removed: "−", changed: "≠" } as const;

function FieldRow({ field }: { field: FieldChange }) {
  return (
    <li className="adm-diff-field">
      {field.path && <code className="adm-diff-path">{field.path}</code>}
      <span className="adm-diff-before">{formatValue(field.before)}</span>
      <span className="adm-faint">→</span>
      <span className="adm-diff-after">{formatValue(field.after)}</span>
    </li>
  );
}

function Entry({ change }: { change: EntryChange }) {
  return (
    <li className={`adm-diff-entry adm-diff-entry--${change.kind}`}>
      <span className="adm-diff-mark" aria-hidden>
        {MARK[change.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <span className="adm-diff-label">{change.label}</span>
        {change.kind === "changed" && change.fields.length > 0 && (
          <ul className="adm-diff-fields">
            {change.fields.map((field) => (
              <FieldRow key={field.path} field={field} />
            ))}
            {change.hidden > 0 && <li className="adm-faint text-xs">et {change.hidden} autres modifications</li>}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Détail d'un écart entre deux catalogues. La comparaison elle-même est faite en amont
 * (`diffCatalogs`) et passée telle quelle : cet écran ne fait que la mettre en forme, et n'est monté
 * qu'à l'ouverture - parcourir tout le catalogue coûte trop cher pour le faire à chaque rendu.
 */
export function CatalogDiffDialog({
  open,
  onOpenChange,
  diff,
  beforeLabel,
  afterLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diff: CatalogDiff | null;
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title="Ce qui diffère">
      <div className="flex flex-col gap-3 text-sm">
        <p className="adm-faint text-xs">
          De <strong>{beforeLabel}</strong> vers <strong>{afterLabel}</strong>.
        </p>
        {!diff && <p>Aucune version publiée à comparer.</p>}
        {diff && diff.total === 0 && <p>Les deux catalogues portent exactement la même donnée.</p>}
        {diff?.sections.map((section) => (
          <section key={section.key} className="adm-diff-section">
            <h3 className="adm-diff-title">
              {section.title}
              <span className="adm-faint"> · {section.changes.length}</span>
            </h3>
            <ul className="adm-diff-list">
              {section.changes.map((change) => (
                <Entry key={change.id} change={change} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
