import type { ThemeId } from '../theme';
import { THEMES } from '../theme';

interface ThemePickerProps {
  readonly value: ThemeId;
  readonly onChange: (theme: ThemeId) => void;
}

/**
 * Four swatches in the header.
 *
 * Swatches rather than a dropdown, because the thing being chosen is what it
 * looks like: a list of names makes someone pick one, look, go back and pick
 * another. Each button shows its own scheme's page colour and accent, so the
 * choice is visible before it is made.
 *
 * The swatch colours are literals on the theme definition rather than the
 * tokens themselves -- the tokens only hold the ACTIVE theme, so reading them
 * would paint all four buttons the same.
 */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="theme-picker" role="group" aria-label="Colour scheme">
      {THEMES.map((theme) => {
        const [background, accent] = theme.swatch;
        return (
          <button
            key={theme.id}
            type="button"
            className={`theme-swatch${theme.id === value ? ' selected' : ''}`}
            onClick={() => onChange(theme.id)}
            title={`${theme.name} — ${theme.note}`}
            aria-label={theme.name}
            aria-pressed={theme.id === value}
          >
            <span className="theme-swatch-chip" style={{ background }}>
              <span className="theme-swatch-accent" style={{ background: accent }} />
            </span>
            <span className="theme-swatch-name">{theme.name}</span>
          </button>
        );
      })}
    </div>
  );
}
