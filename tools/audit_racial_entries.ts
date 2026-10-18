/**
 * Which racial entries in each preset's priority list belong to NO race that
 * can play that class -- and so can never be lit by a race swap.
 *
 *   npx vite-node tools/audit_racial_entries.ts
 *
 * Read off `RACIALS` (what each race grants) and `racesForClass` (who may play
 * what), so it cannot disagree with the race dropdown about what is legal.
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { racesForClass } from '../src/game/character';
import { RACIALS } from '../src/game/racials';
import { ALL_RACIAL_ABILITY_IDS } from '../src/game/rotations/racialCooldowns';

function grantedBy(race: string): Set<string> {
  const out = new Set<string>();
  for (const trait of RACIALS[race as keyof typeof RACIALS].traits) {
    for (const effect of trait.effects) if (effect.kind === 'grantAbility') out.add(effect.abilityId);
  }
  return out;
}

let total = 0;
for (const preset of PROFILE_PRESETS) {
  const profile = preset.build();
  const cls = profile.character.characterClass;
  const legal = new Set<string>();
  for (const race of racesForClass(cls)) for (const id of grantedBy(race.id)) legal.add(id);
  const invalid = profile.rotation.entries
    .map((entry) => entry.abilityId)
    .filter((id) => ALL_RACIAL_ABILITY_IDS.has(id) && !legal.has(id));
  total += invalid.length;
  console.log(`${preset.id.padEnd(20)} ${cls.padEnd(8)} ${String(invalid.length).padStart(2)}  ${invalid.join(', ')}`);
}
console.log(`\n${total} racial entries across ${PROFILE_PRESETS.length} presets belong to no race that can play the class.`);
