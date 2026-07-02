/** Contrôle segmenté (choix unique parmi quelques options : format, budget…). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="ui-seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          data-on={value === opt.value}
          disabled={opt.disabled}
          title={opt.title}
          onClick={() => !opt.disabled && onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
