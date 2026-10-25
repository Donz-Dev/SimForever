import { Fragment } from 'react';
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
 * IN THREE GROUPS, BY ROLE (round 66, the owner's): DPS, Tank and Healer,
 * each in class order inside it. It read "in class order, and with no
 * headings" before -- the colour did the grouping -- and a role is the one
 * grouping colour cannot show, since a Protection Warrior and an Arms one are
 * the same colour.
 *
 * NAMED, NOT DERIVED. A tank or a healer is a ROLE the owner assigned, and
 * Fury Prot is a dual-wielding tank that `isTankBuild` would have to be taught
 * about. A preset in neither list is a DPS profile, so a new one appears.
 * ----------------------------------------------------------------------------
 */
export const TANK_PROFILE_IDS: readonly string[] = ['druid_bear', 'prot_warr', 'prot_pally', 'fury_prot'];
export const HEALER_PROFILE_IDS: readonly string[] = ['shaman_resto', 'holy_pal', 'druid_resto', 'priest_holy', 'priest_disc'];

const BY_ID = new Map(PROFILE_PRESETS.map((preset) => [preset.id, preset]));

/** The rail's three groups, in the owner's order. */
export function profileGroups(): readonly { readonly label: string; readonly presets: readonly ProfilePreset[] }[] {
  const named = new Set([...TANK_PROFILE_IDS, ...HEALER_PROFILE_IDS]);
  const pick = (ids: readonly string[]) =>
    ids.map((id) => BY_ID.get(id)).filter((preset): preset is ProfilePreset => preset !== undefined);
  return [
    { label: 'DPS Profiles', presets: PROFILE_PRESETS.filter((preset) => !named.has(preset.id)) },
    { label: 'Tank Profiles', presets: pick(TANK_PROFILE_IDS) },
    { label: 'Healer Profiles', presets: pick(HEALER_PROFILE_IDS) },
  ];
}

export function ProfileRail({ onPreset, activeId }: ProfileRailProps) {
  return (
    <nav className="profile-rail" aria-label="Profiles">
      {profileGroups().map((group) => (
        <Fragment key={group.label}>
          <span className="field-label">{group.label}</span>
          {group.presets.map((preset) => (
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
        </Fragment>
      ))}
    </nav>
  );
}
