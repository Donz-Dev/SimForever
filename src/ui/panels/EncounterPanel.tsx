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
      // What the fight is against, so a shut panel still answers the question
      // someone opens it to check.
      badge={`${profile.encounter.targetName} · level ${profile.encounter.targetLevel}${
        profile.encounter.targetAttacks ? ' · swings back' : ''
      }`}
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
