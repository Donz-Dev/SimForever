import type { ReactNode } from 'react';

interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

/** A labelled form row. */
export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint ? <span className="field-hint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

interface NumberFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
}

/**
 * A numeric input that keeps the value valid.
 *
 * An empty or unparseable box is ignored rather than written back as NaN, so a
 * half-typed number can never reach the profile or the engine.
 */
export function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: NumberFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (event.target.value === '' || Number.isNaN(parsed)) return;
          onChange(clamp(parsed, min, max));
        }}
      />
    </Field>
  );
}

export interface SelectOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
}

interface SelectFieldProps<T extends string | number> {
  readonly label: string;
  readonly hint?: string;
  readonly value: T;
  readonly options: readonly SelectOption<T>[];
  readonly onChange: (value: T) => void;
}

/**
 * A field with a fixed set of choices.
 *
 * The caller is responsible for the option list containing the current value.
 * A `<select>` whose value matches no option renders blank and, worse, reports
 * the first option on the next change -- so a value the list does not know
 * about would be silently replaced by one it does. Where that can happen the
 * caller adds the current value to the list; `EncounterPanel` does exactly
 * that for an armor figure typed into an older profile.
 */
export function SelectField<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={String(value)}
        onChange={(event) => {
          const chosen = options.find((option) => String(option.value) === event.target.value);
          if (chosen) onChange(chosen.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <Field label={label}>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

interface CheckboxFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** A labelled on/off switch. */
export function CheckboxField({ label, hint, checked, onChange }: CheckboxFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </Field>
  );
}
