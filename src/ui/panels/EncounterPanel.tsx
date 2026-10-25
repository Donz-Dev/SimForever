import { TARGET_ARMOR_OPTIONS } from '../../game/actors/createTrainingDummy';
import type { CharacterProfile } from '../../profiles';
import { MAX_ENCOUNTER_TARGETS } from '../../profiles/CharacterProfile';
import type { SelectOption } from '../components/Field';
import { NumberField, SelectField, TextField } from '../components/Field';
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
 * depend on two borrowed Classic placeholders.
 *
 * IT NO LONGER SAYS SO ON SCREEN, and that is the owner's decision rather than
 * an oversight. The third condition of CLAUDE.md's placeholder rule used to
 * name this panel as its worked example; the rule is rewritten and this is
 * where it points now. The two values are still `PLACEHOLDER_` constants, still
 * commented as Classic and unverified, and still editable here -- which is the
 * part that actually lets someone check them.
 *
 * It also turns on the ramp and the assumed healer, neither of which is
 * editable. Nobody asked to vary them, and a field for every modelling choice
 * is how a panel becomes unreadable.
 */
export function EncounterPanel({ profile, onChange }: EncounterPanelProps) {
  const setEncounter = (changes: Partial<CharacterProfile['encounter']>) => {
    onChange({ ...profile, encounter: { ...profile.encounter, ...changes } });
  };

  return (
    <Panel
      title="Encounter"
      collapsible
    >
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
      {/*
        * NUMBER OF TARGETS (round 57), the owner's dropdown: presets from 1 to
        * 8, one by default. The first is the boss and the rest are adds; area
        * abilities strike them and the APL's "Number of targets" condition
        * reads the count. On a tank run each add swings for 500 every two
        * seconds and does not ramp.
        */}
      <SelectField
        label="Number of Targets"
        value={profile.encounter.numberOfTargets ?? 1}
        options={TARGET_COUNT_OPTIONS}
        onChange={(numberOfTargets) => setEncounter({ numberOfTargets })}
      />

      {/*
        * THE "TARGET ATTACKS BACK" CHECKBOX IS GONE (round 52): the Simulation
        * panel's Run Tank Simulation button is that switch now, and it carries
        * Salvation with it exactly as the checkbox did. The swing figures stay
        * here, always shown, because both a tank run and the Tank Healer fight
        * read them.
        */}
      <NumberField
        label="Swing damage"
        hint="tank and healer runs"
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
    </Panel>
  );
}

/** The Number of Targets presets, 1 to `MAX_ENCOUNTER_TARGETS`. */
export const TARGET_COUNT_OPTIONS: readonly SelectOption<number>[] = Array.from(
  { length: MAX_ENCOUNTER_TARGETS },
  (_, index) => ({ value: index + 1, label: String(index + 1) }),
);

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
