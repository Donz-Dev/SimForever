/**
 * What each profile's pools hold at the pull, and how long its lockout has left.
 *
 * ==============================================================================
 * THE DIAGNOSTIC FOR THE OWNER'S RULING that regeneration is credited across a
 * pre-combat lead and that a mana spend is stamped when it happened.
 *
 * Both are invisible in a DPS figure on most profiles and neither has a zero
 * anywhere to notice: a pool arriving short reads exactly like a pool that was
 * meant to be short. What this prints is the two quantities the ruling moves --
 * what is in the pool at timestamp zero, and when the pool was last spent,
 * which is NEGATIVE for anything an opener paid for before the pull.
 *
 * A LOCKOUT WITH TIME LEFT IS THE POINT, not a fault: a caster that spent mana
 * 1.5 seconds early should arrive with 3.5 of its five seconds still to run,
 * and before the ruling it arrived with all five.
 * ==============================================================================
 */
import { Simulation } from '../src/engine';
import type { ResourceType } from '../src/engine';
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { MANA_REGEN_LOCKOUT_MS } from '../src/game/combat/resourceRules';

const POOLS: readonly ResourceType[] = ['energy', 'mana', 'focus'];
const only = (process.env.PROFILES ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

console.log('\n  profile              pool      at pull / max     last spent   lockout left');
console.log('  ' + '-'.repeat(76));

for (const preset of PROFILE_PRESETS) {
  if (only.length > 0 && !only.includes(preset.id)) continue;
  const profile = preset.build();
  if ((profile.precombat ?? []).length === 0) continue;

  const simulation = new Simulation(trainingDummyEncounter(profile, 4242));
  simulation.begin();
  const player = simulation.combatants.find((actor) => actor.kind === 'player');
  if (!player) continue;

  for (const type of POOLS) {
    const pool = player.resources.get(type);
    if (!pool || pool.maximum <= 0) continue;

    const spent = player.lastSpentAt(type);
    if (spent === undefined && pool.current >= pool.maximum) continue;

    const stamp = spent === undefined ? '       --' : `${(spent / 1000).toFixed(2)}s`.padStart(9);
    // Only mana has a lockout; the others are flat per tick.
    const left =
      type === 'mana' && spent !== undefined
        ? `${Math.max(0, (spent + MANA_REGEN_LOCKOUT_MS) / 1000).toFixed(2)}s`.padStart(8)
        : '      --';

    console.log(
      `  ${preset.id.padEnd(20)} ${type.padEnd(8)} ${pool.current.toFixed(0).padStart(7)} /` +
        ` ${pool.maximum.toFixed(0).padEnd(7)} ${stamp}  ${left}`,
    );
  }
}
console.log('');
