import { armorReduction } from '../../engine';
import { TARGET_ARMOR_OPTIONS } from '../../game/actors/createTrainingDummy';
import type { CharacterProfile } from '../../profiles';
import type { SelectOption } from '../components/Field';
import { CheckboxField, NumberField, SelectField, TextField } from '../components/Field';
import { Panel } from '../components/Panel';

interface EncounterPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

/**
 * The target.
 *
 * Health is not editable and does not need to be: the dummy is there to be hit
 * for the length of the fight, and a health low enough to matter would end the
 * run early and quietly turn a DPS figure into a time-to-kill. It stays on the
 * profile, so a profile that sets it is still honoured.
 *
 * Whether the target hits BACK is editable, and off by default. Turning it on
 * is what brings the attacks-received table, rage from damage taken, Revenge
 * and six Warrior talents to life -- and what makes every resulting number
 * depend on two borrowed Classic placeholders, which is why they are shown
 * beside the switch rather than buried in code.
 */
/**
 * The armor choices, with the reduction each one actually produces.
 *
 * The percentage is computed by the engine's own armor formula against the
 * target's level, so it moves when the level does and cannot drift away from
 * what the simulation uses. It is not a label for the value -- nothing states
 * which boss any of the three figures belongs to.
 *
 * A profile whose armor is not one of the three keeps it: it is appended,
 * ordered with the rest, and marked. Dropping it would rewrite the encounter
 * the moment the panel rendered.
 */
export function armorOptions(
  current: number,
  targetLevel: number,
): readonly SelectOption<number>[] {
  const values = TARGET_ARMOR_OPTIONS.includes(current)
    ? [...TARGET_ARMOR_OPTIONS]
    : [...TARGET_ARMOR_OPTIONS, current].sort((a, b) => b - a);

  return values.map((armor) => ({
    value: armor,
    label: `${armor.toLocaleString()} — ${(armorReduction(armor, targetLevel) * 100).toFixed(1)}% reduced${
      TARGET_ARMOR_OPTIONS.includes(armor) ? '' : ' (from profile)'
    }`,
  }));
}

export function EncounterPanel({ profile, onChange }: EncounterPanelProps) {
  const setEncounter = (changes: Partial<CharacterProfile['encounter']>) => {
    onChange({ ...profile, encounter: { ...profile.encounter, ...changes } });
  };

  return (
    <Panel title="Encounter">
      <TextField
        label="Target"
        value={profile.encounter.targetName}
        onChange={(targetName) => setEncounter({ targetName })}
      />
      <NumberField
        label="Level"
        value={profile.encounter.targetLevel}
        min={1}
        max={99}
        onChange={(targetLevel) => setEncounter({ targetLevel })}
      />
      <SelectField
        label="Armor"
        hint="physical reduction at this level"
        value={profile.encounter.targetArmor}
        options={armorOptions(profile.encounter.targetArmor, profile.encounter.targetLevel)}
        onChange={(targetArmor) => setEncounter({ targetArmor })}
      />

      <CheckboxField
        label="Target attacks back"
        hint="off for a damage warrior"
        checked={profile.encounter.targetAttacks}
        onChange={(targetAttacks) => setEncounter({ targetAttacks })}
      />

      {profile.encounter.targetAttacks ? (
        <>
          <NumberField
            label="Swing damage"
            hint="before armor"
            value={profile.encounter.targetSwingDamage}
            min={0}
            step={100}
            onChange={(targetSwingDamage) => setEncounter({ targetSwingDamage })}
          />
          <NumberField
            label="Swing speed"
            hint="seconds"
            value={profile.encounter.targetSwingSeconds}
            min={0.1}
            step={0.1}
            onChange={(targetSwingSeconds) => setEncounter({ targetSwingSeconds })}
          />
          <p className="muted warn">
            Those two numbers are <strong>WoW Classic placeholders</strong>, not Forever data.
            Being hit is a large source of rage, so a fight with this on says as much about
            the figures above as about the character.
          </p>
          <p className="muted">
            A healer is assumed but not modelled: the character cannot die, so nothing here
            says whether they would survive.
          </p>
        </>
      ) : null}
    </Panel>
  );
}
