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

  /*
   * A VALUE BESIDE A SWITCH, for the entries somebody else supplies at a
   * strength of their own -- Thorns and Retribution Aura scale with the
   * SUPPLIER'S spell power. Stored per entry in `raidBuffValues`; an entry with
   * nothing stored shows and uses its declared default (700).
   */
  const values = profile.raidBuffValues ?? {};
  const setValue = (id: string, value: number) => {
    onChange({ ...profile, raidBuffValues: { ...values, [id]: value } });
  };

  const onPlayer = RAID_BUFFS.filter((buff) => buff.appliesTo === 'player');
  const onTarget = RAID_BUFFS.filter((buff) => buff.appliesTo === 'enemy');
  const active = RAID_BUFFS.filter((buff) => chosen.has(buff.id));

  return (
    <Panel
      title="Raid buffs"
      collapsible
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
      <BuffGroup
        title="On the character"
        buffs={onPlayer}
        chosen={chosen}
        onToggle={toggle}
        values={values}
        onValue={setValue}
      />
      <BuffGroup
        title="On the target"
        buffs={onTarget}
        chosen={chosen}
        onToggle={toggle}
        values={values}
        onValue={setValue}
      />
    </Panel>
  );
}

function BuffGroup({
  title,
  buffs,
  chosen,
  onToggle,
  values,
  onValue,
}: {
  readonly title: string;
  readonly buffs: readonly RaidBuff[];
  readonly chosen: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly values: Readonly<Record<string, number>>;
  readonly onValue: (id: string, value: number) => void;
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
                <label
                  className="buff-row"
                  title={
                    buff.exclusiveWith
                      ? `${buff.detail} — replaces ${RAID_BUFFS_BY_ID.get(buff.exclusiveWith)?.name}`
                      : buff.detail
                  }
                >
                  <input
                    type="checkbox"
                    checked={chosen.has(buff.id)}
                    onChange={() => onToggle(buff.id)}
                  />
                  <span className="buff-name">{buff.name}</span>
                </label>
                {/* OUTSIDE THE LABEL, so typing a number does not toggle the
                    switch. Disabled while the buff is off, because a strength
                    for a buff nobody is supplying means nothing. */}
                {buff.value ? (
                  <label className="buff-value">
                    <span className="muted">{buff.value.label}</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      disabled={!chosen.has(buff.id)}
                      value={values[buff.id] ?? buff.value.defaultValue}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next) && next >= 0) onValue(buff.id, next);
                      }}
                    />
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
