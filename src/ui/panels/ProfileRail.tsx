import type { ClassId } from '../../game/character';
import type { ProfilePreset } from '../../profiles';
import { PROFILE_PRESETS } from '../../profiles';

/**
 * Which CSS variable carries each class's colour.
 *
 * ----------------------------------------------------------------------------
 * A `Record<ClassId, string>` and not a lookup with a fallback, for the reason
 * `SCOPE_LABELS` was one: adding a tenth class without giving it a colour is a
 * COMPILE ERROR rather than a pill that silently renders in whatever the
 * fallback was. The values live in `styles.css` with the series and tree
 * colours, because this file has no business holding nine literal hexes.
 * ----------------------------------------------------------------------------
 */
const CLASS_COLOURS: Record<ClassId, string> = {
  warrior: 'var(--class-warrior)',
  paladin: 'var(--class-paladin)',
  hunter: 'var(--class-hunter)',
  rogue: 'var(--class-rogue)',
  priest: 'var(--class-priest)',
  shaman: 'var(--class-shaman)',
  mage: 'var(--class-mage)',
  warlock: 'var(--class-warlock)',
  druid: 'var(--class-druid)',
};

interface ProfileRailProps {
  readonly onPreset: (preset: ProfilePreset) => void;
  /** The preset showing right now, if the character came from one. */
  readonly activeId: string | undefined;
}

/**
 * The 23 ready-made characters, as one class-coloured pill each.
 *
 * ----------------------------------------------------------------------------
 * A preset is a whole answer rather than a starting point: name, race, class,
 * style, stance, tree, gear and whether the target swings back, all at once.
 * See `profiles/presets.ts` for why those belong together.
 *
 * IT USED TO BE 23 CARDS CARRYING `preset.detail` -- "Orc, two-hander, Battle
 * Stance, standing target" under every name -- stacked at the top of the
 * character panel, and it was most of a screen of body text before the app
 * showed anything. The detail is still there, on `title`, where it costs
 * nothing until someone wants it.
 *
 * IN CLASS ORDER, AND WITH NO HEADINGS. The order is what groups them, and the
 * colour is what makes the grouping legible -- nine headings would put back the
 * furniture the pills were meant to remove.
 * ----------------------------------------------------------------------------
 */
export function ProfileRail({ onPreset, activeId }: ProfileRailProps) {
  return (
    <nav className="profile-rail" aria-label="Profiles">
      <span className="field-label">Profiles</span>
      {PROFILE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={preset.id === activeId ? 'profile-pill active' : 'profile-pill'}
          style={{ '--class-colour': CLASS_COLOURS[preset.characterClass] } as React.CSSProperties}
          onClick={() => onPreset(preset)}
          title={preset.detail}
          aria-current={preset.id === activeId ? 'true' : undefined}
        >
          {preset.label}
        </button>
      ))}
    </nav>
  );
}
