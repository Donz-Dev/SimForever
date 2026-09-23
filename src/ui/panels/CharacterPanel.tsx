import type { CharacterProfile, ProfilePreset } from '../../profiles';
import { PROFILE_PRESETS } from '../../profiles';
import type { CharacterSelection, CombatStyleId } from '../../game/character';
import { abilitiesForClass } from '../../game/abilities/abilitiesForClass';
import {
  FACTIONS,
  applySelection,
  classesForRace,
  combatStylesFor,
  getClass,
  getCombatStyle,
  getRace,
  racesForFaction,
  resolveCombatStyle,
  STANCES,
  defaultStanceFor,
  getStance,
  isTankBuild,
  resolveStance,
} from '../../game/character';
import { TextField } from '../components/Field';
import { OptionGroup } from '../components/OptionGroup';
import { Panel } from '../components/Panel';

interface CharacterPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
  /** True once the character has been confirmed and the rest is in play. */
  readonly confirmed: boolean;
  readonly onConfirm: () => void;
  readonly onEdit: () => void;
  readonly onImport: () => void;
  readonly onLoad: () => void;
  /**
   * Replace the whole character with a ready-made one.
   *
   * Separate from `onChange` because it is not an edit: a preset sets every
   * field at once, including gear and talents, and the caller confirms the
   * character in the same step rather than leaving someone to press Confirm on
   * a build they did not assemble.
   */
  readonly onPreset: (preset: ProfilePreset) => void;
}

/**
 * Step one: who is fighting.
 *
 * Character creation, in the order the game asks for it: faction, race, class,
 * style. Nothing else appears until it is confirmed, because everything else —
 * gear, the encounter, the run — is a decision about a character that does not
 * exist yet.
 *
 * The component holds no rules of its own. Which races belong to a faction,
 * which classes a race may play, and what happens to the current class when the
 * race changes are all answered by `game/character`.
 */
/**
 * Turn the target's swings ON when a build BECOMES a tank.
 *
 * A shield warrior in Defensive Stance is not being simulated at all with a
 * target that stands still: the attacks-received table, rage from damage
 * taken, Revenge, Shield Block and six talents are all waiting on something
 * swinging back. Making the person find a checkbox in another panel before
 * any of that exists is a trap, and the numbers they read in the meantime are
 * confidently wrong rather than obviously wrong.
 *
 * ON THE TRANSITION ONLY, which is what keeps it from fighting the person. It
 * fires when the build was not a tank and now is; picking Defensive and then
 * deliberately switching the target's swings back off leaves them off, because
 * nothing about the build changed afterwards.
 *
 * And it never switches them off. Leaving the tank configuration is not a
 * statement about what the encounter should be, and someone measuring a damage
 * build against a boss that hits back is doing something reasonable.
 */
function withTankEncounter(
  previous: CharacterProfile,
  next: CharacterProfile,
): CharacterProfile {
  const was = isTankBuild(previous.character.combatStyle, previous.character.stance);
  const now = isTankBuild(next.character.combatStyle, next.character.stance);
  if (was || !now || next.encounter.targetAttacks) return next;
  return { ...next, encounter: { ...next.encounter, targetAttacks: true } };
}

export function CharacterPanel({
  profile,
  onChange,
  confirmed,
  onConfirm,
  onEdit,
  onImport,
  onLoad,
  onPreset,
}: CharacterPanelProps) {
  const race = getRace(profile.character.race);
  const selection: CharacterSelection = {
    faction: race?.faction ?? 'alliance',
    race: profile.character.race,
    characterClass: profile.character.characterClass,
  };

  const styles = combatStylesFor(selection.characterClass);
  const style = resolveCombatStyle(selection.characterClass, profile.character.combatStyle);
  /*
   * Only the Warrior has stances, so only the Warrior is asked. Resolved
   * rather than read straight off the profile, so a profile written before
   * stances existed opens in its style's default instead of nowhere -- a
   * warrior in no stance cannot cast Overpower, Rend, Execute, Thunder Clap,
   * Hamstring or Charge.
   */
  const isWarrior = selection.characterClass === 'warrior';
  const stance = resolveStance(style, profile.character.stance);

  const applyChange = (change: Partial<CharacterSelection>) => {
    const next = applySelection(change, selection);

    onChange({
      ...profile,
      character: {
        ...profile.character,
        race: next.race,
        characterClass: next.characterClass,
        // Re-resolve against the new class, so a profile does not quietly carry
        // "bear" around after switching away from Druid.
        combatStyle: resolveCombatStyle(next.characterClass, profile.character.combatStyle),
        /*
         * A stance belongs to a Warrior and to nobody else, so changing class
         * away from Warrior drops it rather than leaving a Mage carrying
         * "defensive" around. Changing TO Warrior takes the style's default.
         */
        stance:
          next.characterClass === 'warrior'
            ? defaultStanceFor(
                resolveCombatStyle(next.characterClass, profile.character.combatStyle),
              )
            : undefined,
      },
    });
  };

  // Once confirmed the whole block collapses to a single line. Editing is an
  // explicit action, so a stray click cannot silently rebuild the character
  // underneath results that were run against the old one.
  if (confirmed) {
    return <ConfirmedCharacter profile={profile} style={style} onEdit={onEdit} />;
  }

  const classDefinition = getClass(selection.characterClass);
  const abilityCount = abilitiesForClass(selection.characterClass, style).length;
  // A profile is not valid without a name, so there is nothing to confirm until
  // there is one. Trimmed, because a name of spaces fails the same check.
  const named = profile.character.name.trim().length > 0;

  return (
    <Panel
      title="Character"
      actions={
        <>
          <button type="button" onClick={onImport}>
            Import
          </button>
          <button type="button" onClick={onLoad}>
            Load
          </button>
        </>
      }
    >
      {/*
        * FIRST, above the name, because it is the fastest way past all of it.
        * Someone who wants a Protection warrior wants five fields, a tree and
        * nineteen gear slots, and every one of those is a chance to end up
        * with a character nobody meant -- a shield without Defensive Stance,
        * or a tank against a target that never swings.
        */}
      <PresetButtons onPreset={onPreset} />

      <TextField
        label="Name"
        value={profile.character.name}
        onChange={(name) => onChange({ ...profile, character: { ...profile.character, name } })}
      />

      <OptionGroup
        label="Faction"
        options={FACTIONS}
        value={selection.faction}
        onChange={(faction) => applyChange({ faction })}
        columns={2}
      />

      <OptionGroup
        label="Race"
        options={racesForFaction(selection.faction)}
        value={selection.race}
        onChange={(next) => applyChange({ race: next })}
      />

      <OptionGroup
        label="Class"
        options={classesForRace(selection.race)}
        value={selection.characterClass}
        onChange={(characterClass) => applyChange({ characterClass })}
      />

      <OptionGroup
        label="Combat style"
        options={styles}
        value={style}
        onChange={(next) =>
          onChange(
            withTankEncounter(profile, {
              ...profile,
              character: {
                ...profile.character,
                combatStyle: next,
                /*
                 * Changing style RESETS the stance to that style's default.
                 *
                 * Each default is the stance the build actually wants, and
                 * carrying the old one across is how a shield warrior ends up
                 * in Berserker without having chosen it. Overriding afterwards
                 * is one click; noticing a stance you did not pick is not.
                 */
                stance:
                  next && selection.characterClass === 'warrior'
                    ? defaultStanceFor(next)
                    : profile.character.stance,
              },
            }),
          )
        }
      />

      {isWarrior ? (
        <>
          <OptionGroup
            label="Stance"
            options={STANCES}
            value={stance}
            onChange={(next) =>
              onChange(
                withTankEncounter(profile, {
                  ...profile,
                  character: { ...profile.character, stance: next },
                }),
              )
            }
          />
          <p className="muted stance-note">{getStance(stance)?.effect}</p>
        </>
      ) : null}

      {abilityCount === 0 ? (
        <p className="muted warn">
          No abilities are implemented for {classDefinition?.name ?? 'this class'} yet, so it
          will fight with auto attacks only.
        </p>
      ) : null}

      <button type="button" className="confirm" onClick={onConfirm} disabled={!named}>
        {named ? 'Confirm character' : 'Name your character'}
      </button>
    </Panel>
  );
}

/**
 * The confirmed character, as one line.
 *
 * Everything the choices above produced, in the order they were made, so the
 * summary reads back as a sentence rather than as a list of fields.
 */
function ConfirmedCharacter({
  profile,
  style,
  onEdit,
}: {
  readonly profile: CharacterProfile;
  readonly style: CombatStyleId;
  readonly onEdit: () => void;
}) {
  const race = getRace(profile.character.race);
  const classDefinition = getClass(profile.character.characterClass);
  const styleDefinition = getCombatStyle(style);
  /*
   * The stance is on the summary line because it changes what the character
   * can cast. A collapsed summary that omitted it would leave someone
   * comparing two runs with no way to see that the stance differed.
   */
  const stanceDefinition =
    profile.character.characterClass === 'warrior'
      ? getStance(resolveStance(style, profile.character.stance))
      : undefined;

  return (
    <section className="panel character-summary">
      <div className="character-summary-body">
        <div>
          <strong>{profile.character.name}</strong>
          <span className="muted">
            {race?.name} {classDefinition?.name}
            {styleDefinition ? ` · ${styleDefinition.name}` : ''}
            {stanceDefinition ? ` · ${stanceDefinition.name}` : ''}
          </span>
        </div>
        <button type="button" onClick={onEdit}>
          Change
        </button>
      </div>
    </section>
  );
}

/**
 * The ready-made characters.
 *
 * A preset is a whole answer rather than a starting point: name, race, class,
 * style, stance, tree, gear and whether the target swings back, all at once.
 * See `profiles/presets.ts` for why those belong together.
 */
function PresetButtons({ onPreset }: { readonly onPreset: (preset: ProfilePreset) => void }) {
  return (
    <div className="presets">
      <span className="field-label">Start from</span>
      <div className="preset-row">
        {PROFILE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="preset"
            onClick={() => onPreset(preset)}
            title={preset.detail}
          >
            <span className="preset-label">{preset.label}</span>
            <span className="preset-detail">{preset.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
