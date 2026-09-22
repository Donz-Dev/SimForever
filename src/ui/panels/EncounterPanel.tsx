import { TARGET_ARMOR_OPTIONS } from '../../game/actors/createTrainingDummy';
import {
  EXTERNAL_HEAL_MAXIMUM,
  EXTERNAL_HEAL_MINIMUM,
} from '../../game/encounters/externalHealer';
import { BOSS_SWING_DAMAGE_RAMP } from '../../game/encounters/raidBoss';
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
 *
 * It also turns on the ramp and the assumed healer, neither of which is
 * editable. Nobody asked to vary them, and a field for every modelling choice
 * is how a panel becomes unreadable -- but they change every number on the
 * results page, so they are stated here in words.
 */
export function EncounterPanel({ profile, onChange }: EncounterPanelProps) {
  // Read from the constant rather than written out, so the sentence cannot
  // drift away from the mechanic the way a hardcoded "10%" eventually does.
  const rampPercent = BOSS_SWING_DAMAGE_RAMP * 100;
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
        value={profile.encounter.targetArmor}
        options={armorOptions(profile.encounter.targetArmor)}
        onChange={(targetArmor) => setEncounter({ targetArmor })}
      />

      <CheckboxField
        label="Target attacks back"
        checked={profile.encounter.targetAttacks}
        onChange={(targetAttacks) => setEncounter({ targetAttacks })}
      />

      {profile.encounter.targetAttacks ? (
        <>
          <NumberField
            label="Swing damage"
            hint="first swing, before armor"
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
            Each swing hits <strong>{rampPercent}% harder than the one before</strong>, so the
            fight gets away from the character on purpose. A healer is assumed but not
            modelled: {EXTERNAL_HEAL_MINIMUM.toLocaleString()} to{' '}
            {EXTERNAL_HEAL_MAXIMUM.toLocaleString()} every second, from nobody. The character
            can die, is put straight back on their feet, and the ramp carries on regardless —
            the results count the deaths.
          </p>
        </>
      ) : null}
    </Panel>
  );
}

/**
 * The armor values the encounter can be set to.
 *
 * Just the numbers. Nothing states which boss or tier any of the three is, so
 * there is nothing true to label them with.
 *
 * A profile whose armor is not one of the three KEEPS it: it is appended and
 * ordered with the rest. Dropping it would rewrite the encounter the moment
 * the panel rendered, because a select whose value matches no option renders
 * blank and reports the first option on the next change.
 */
export function armorOptions(current: number): readonly SelectOption<number>[] {
  const values = TARGET_ARMOR_OPTIONS.includes(current)
    ? [...TARGET_ARMOR_OPTIONS]
    : [...TARGET_ARMOR_OPTIONS, current].sort((a, b) => b - a);

  return values.map((armor) => ({ value: armor, label: armor.toLocaleString() }));
}
