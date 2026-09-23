import type { RaidBuff } from '../../game/buffs/raidBuffs';
import {
  RAID_BUFFS,
  RAID_BUFFS_BY_ID,
  withRaidBuff,
} from '../../game/buffs/raidBuffs';
import type { CharacterProfile } from '../../profiles';
import { Panel } from '../components/Panel';

interface RaidBuffsPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

/**
 * What the rest of the raid has given this character, and what it has put on
 * the target.
 *
 * ----------------------------------------------------------------------------
 * ONE LIST, ACROSS EVERY SETUP. It sits on the profile, so it is saved,
 * exported and reloaded with the character rather than being re-ticked for
 * every run.
 *
 * NOTHING IS ON BY DEFAULT, and that is deliberate. Every figure this project
 * has recorded was measured unbuffed, and a default raid loadout would move
 * all of them at once. It is also how `BATTLE_FURY` went wrong: an aura nobody
 * asked for, applied to every player, inflating every number.
 *
 * GROUPED BY WHO PROVIDES IT rather than by what it does, because that is how
 * someone building a raid thinks -- "do we have a Paladin" is one decision and
 * three buffs. Target debuffs are separated out, because reducing the boss's
 * armor and raising your own strength are not the same kind of assumption.
 *
 * The panel is collapsible in the same way the talent trees are: twenty rows
 * push everything below them off a laptop screen, and this is set once and
 * then rarely touched.
 * ----------------------------------------------------------------------------
 */
export function RaidBuffsPanel({ profile, onChange }: RaidBuffsPanelProps) {
  const chosen = new Set(profile.raidBuffs);

  /*
   * Turning one on can turn another OFF. Leader of the Pack and Moonkin Form
   * are the same +3%, and the ruleset owner's ruling is that they do not stack
   * and that the panel is where to say so -- the engine is right to add two
   * different auras together, and what is wrong is choosing both.
   *
   * `withRaidBuff` also returns the ids in catalogue order, so two profiles
   * with the same selection are the same file rather than a diff of whichever
   * switch was flipped first.
   */
  const toggle = (id: string) => {
    const raidBuffs = chosen.has(id)
      ? profile.raidBuffs.filter((existing) => existing !== id)
      : withRaidBuff(profile.raidBuffs, id);
    onChange({ ...profile, raidBuffs });
  };

  const onPlayer = RAID_BUFFS.filter((buff) => buff.appliesTo === 'player');
  const onTarget = RAID_BUFFS.filter((buff) => buff.appliesTo === 'enemy');
  const active = RAID_BUFFS.filter((buff) => chosen.has(buff.id));
  const caveats = active.filter((buff) => buff.unmodelled !== undefined);

  return (
    <Panel
      title="Raid buffs"
      subtitle={
        active.length === 0
          ? 'None — fighting alone'
          : `${active.length} of ${RAID_BUFFS.length} selected`
      }
      actions={
        active.length > 0 ? (
          <button
            type="button"
            className="ghost"
            onClick={() => onChange({ ...profile, raidBuffs: [] })}
          >
            Clear
          </button>
        ) : undefined
      }
    >
      <p className="muted">
        Applied before the first swing of every iteration. Saved with the character, so the
        same raid is assumed across every run until it is changed.
      </p>

      <BuffGroup title="On the character" buffs={onPlayer} chosen={chosen} onToggle={toggle} />
      <BuffGroup title="On the target" buffs={onTarget} chosen={chosen} onToggle={toggle} />

      {caveats.length > 0 ? (
        <>
          <h3>Selected but not fully simulated</h3>
          <p className="muted warn">
            These are switched on and do less than they say. The same discipline the Gear
            and Talent panels apply, in the place the choice is made.
          </p>
          <ul className="issues">
            {caveats.map((buff) => (
              <li key={buff.id}>
                <strong>{buff.name}</strong>
                <span className="muted"> {buff.unmodelled}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Panel>
  );
}

function BuffGroup({
  title,
  buffs,
  chosen,
  onToggle,
}: {
  readonly title: string;
  readonly buffs: readonly RaidBuff[];
  readonly chosen: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
}) {
  // Grouped by provider, in the order they first appear, so the catalogue
  // decides the ordering and this does not have a second opinion.
  const bySource = new Map<string, RaidBuff[]>();
  for (const buff of buffs) {
    const existing = bySource.get(buff.source);
    if (existing) existing.push(buff);
    else bySource.set(buff.source, [buff]);
  }

  return (
    <>
      <h3>{title}</h3>
      {[...bySource.entries()].map(([source, group]) => (
        <div key={source} className="buff-group">
          <span className="buff-source">{source}</span>
          <ul className="buff-list">
            {group.map((buff) => (
              <li key={buff.id}>
                <label className="buff-row">
                  <input
                    type="checkbox"
                    checked={chosen.has(buff.id)}
                    onChange={() => onToggle(buff.id)}
                  />
                  <span className="buff-name">{buff.name}</span>
                  <span className="buff-detail muted">
                    {buff.detail}
                    {/* Named rather than left to be discovered by ticking it
                        and watching another box clear itself. */}
                    {buff.exclusiveWith ? (
                      <em>
                        {' '}
                        — replaces {RAID_BUFFS_BY_ID.get(buff.exclusiveWith)?.name}
                      </em>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
