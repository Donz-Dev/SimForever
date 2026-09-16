import type { CharacterProfile } from '../../profiles';
import { armorReduction } from '../../engine';
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
        label="Level"
        hint="63 = raid boss"
        value={profile.encounter.targetLevel}
        min={1}
        max={99}
        onChange={(targetLevel) => setEncounter({ targetLevel })}
      />
      <NumberField
        label="Armor"
        hint="3731 = raid boss"
        value={profile.encounter.targetArmor}
        min={0}
        step={100}
        onChange={(targetArmor) => setEncounter({ targetArmor })}
      />
      <TargetSummary
        level={profile.encounter.targetLevel}
        armor={profile.encounter.targetArmor}
      />
    </Panel>
  );
}

/**
 * What the target's level and armor actually mean for the combat tables.
 *
 * Level is easy to mistake for cosmetic. It sets defense skill, the armor
 * constant and crit suppression, so a single point of it moves every number in
 * the fight.
 */
function TargetSummary({
  level,
  armor,
}: {
  readonly level: number;
  readonly armor: number;
}) {
  const rows = [
    { label: 'Defense skill', value: String(level * 5), from: `${level} x 5` },
    {
      label: 'Physical reduction',
      value: `${(armorReduction(armor, level) * 100).toFixed(1)}%`,
      from: 'from armor',
    },
  ];

  return (
    <table className="base-stats">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td className="numeric">{row.value}</td>
            <td className="numeric muted">{row.from}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
