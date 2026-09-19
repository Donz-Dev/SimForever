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
