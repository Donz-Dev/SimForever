interface Option<T extends string> {
  readonly id: T;
  readonly name: string;
}

interface OptionGroupProps<T extends string> {
  readonly label: string;
  readonly options: readonly Option<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Lay the buttons out side by side rather than wrapping. Used for faction. */
  readonly columns?: number;
}

/**
 * A group of mutually exclusive choices rendered as buttons.
 *
 * Used instead of a `<select>` for race and class because character creation is
 * a browsing decision: seeing every option at once is the point. It also makes
 * the cascade visible, since the class list visibly changes when the race does.
 */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
}: OptionGroupProps<T>) {
  return (
    <div className="field">
      <span className="field-label">
        {label}
        <span className="field-hint">{options.length} available</span>
      </span>
      <div
        className="option-group"
        style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === value}
            className={option.id === value ? 'option selected' : 'option'}
            onClick={() => onChange(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}
