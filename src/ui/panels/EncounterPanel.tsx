import type { CharacterProfile } from '../../profiles';
import { NumberField, TextField } from '../components/Field';
import { Panel } from '../components/Panel';

interface EncounterPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
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
        label="Health"
        value={profile.encounter.targetHealth}
        min={1}
        step={1000}
        onChange={(targetHealth) => setEncounter({ targetHealth })}
      />
      <NumberField
        label="Armor"
        hint="7390 = 50% physical reduction"
        value={profile.encounter.targetArmor}
        min={0}
        step={100}
        onChange={(targetArmor) => setEncounter({ targetArmor })}
      />
    </Panel>
  );
}
