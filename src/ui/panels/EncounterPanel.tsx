import type { CharacterProfile } from '../../profiles';
import { CheckboxField, NumberField, TextField } from '../components/Field';
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
      <NumberField
        label="Armor"
        value={profile.encounter.targetArmor}
        min={0}
        step={100}
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
