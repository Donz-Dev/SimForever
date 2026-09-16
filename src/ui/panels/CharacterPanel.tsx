import type { CharacterProfile } from '../../profiles';
import { NumberField, TextField } from '../components/Field';
import { Panel } from '../components/Panel';

interface CharacterPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

export function CharacterPanel({ profile, onChange }: CharacterPanelProps) {
  const setStat = (stat: 'attackPower' | 'critRating' | 'hasteRating', value: number) => {
    onChange({ ...profile, stats: { ...profile.stats, [stat]: value } });
  };

  return (
    <Panel title="Character" subtitle={`${profile.character.race} ${profile.character.characterClass}`}>
      <TextField
        label="Name"
        value={profile.character.name}
        onChange={(name) => onChange({ ...profile, character: { ...profile.character, name } })}
      />
      <NumberField
        label="Attack Power"
        value={profile.stats.attackPower ?? 0}
        min={0}
        onChange={(value) => setStat('attackPower', value)}
      />
      <NumberField
        label="Crit Rating"
        hint="180 rating = 1%"
        value={profile.stats.critRating ?? 0}
        min={0}
        onChange={(value) => setStat('critRating', value)}
      />
      <NumberField
        label="Haste Rating"
        hint="170 rating = 1%"
        value={profile.stats.hasteRating ?? 0}
        min={0}
        onChange={(value) => setStat('hasteRating', value)}
      />
    </Panel>
  );
}
