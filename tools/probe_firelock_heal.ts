/**
 * Why does healing a Firelock cost it 28 DPS?
 *
 * Both heals measured as a REAL loss on that one profile -- Major Healing Potion
 * -28.4 and Healthstone -26.2, each drunk once, on a target that never attacks.
 * So it is the HEALING rather than either potion, and "isolate a loss, do not
 * blame the obvious suspect" says to find out rather than to reason.
 *
 * Prints the ability breakdown and the resource flow either side of it, which is
 * where a shift in what the list casts has to show up.
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { runProfileBatch, resourceFlowOf } from '../src/simulator';
import { syncDefaultRotation } from '../src/profiles/rotation';
import type { CharacterProfile } from '../src/profiles';

const PRESET = process.env.PRESET ?? 'warlock_firelock';
const base = PRESETS_BY_ID.get(PRESET)!.build();

const withPotion = (id: string | undefined): CharacterProfile => {
  const consumables = { ...base.consumables };
  if (id) consumables.potion = id;
  else delete consumables.potion;
  return syncDefaultRotation({ ...base, consumables });
};

const run = (profile: CharacterProfile) =>
  runProfileBatch({ ...profile, simulation: { ...profile.simulation, seed: 7, iterations: 40 } });

const without = run(withPotion(undefined));
const healed = run(withPotion('major_healing_potion'));

console.log('%s  without %s   healed %s\n', PRESET, without.dps.mean.toFixed(1), healed.dps.mean.toFixed(1));

const rows = new Set([
  ...without.abilities.map((row) => row.abilityName),
  ...healed.abilities.map((row) => row.abilityName),
]);

console.log('%-28s %9s %9s %9s', 'ability', 'uses', 'uses(heal)', 'delta');
for (const name of [...rows].sort()) {
  const a = without.abilities.find((row) => row.abilityName === name);
  const b = healed.abilities.find((row) => row.abilityName === name);
  const ua = a?.uses ?? 0;
  const ub = b?.uses ?? 0;
  if (Math.abs(ub - ua) < 0.05) continue;
  console.log('%-28s %9s %9s %9s', name, ua.toFixed(2), ub.toFixed(2), (ub - ua).toFixed(2));
}

console.log('\n%-10s %10s %10s %10s %10s', 'resource', 'gained', 'g(heal)', 'spent', 's(heal)');
for (const resource of ['mana', 'health'] as const) {
  const a = resourceFlowOf(without, resource);
  const b = resourceFlowOf(healed, resource);
  console.log(
    '%-10s %10s %10s %10s %10s',
    resource,
    a.totalGained.toFixed(0),
    b.totalGained.toFixed(0),
    a.totalSpent.toFixed(0),
    b.totalSpent.toFixed(0),
  );
}

/*
 * WHAT THE ANSWER TURNED OUT TO BE, kept with the tool so the next reader does
 * not have to re-derive it: Life Tap goes 5.40 casts to 7.03 and Incinerate
 * 16.10 to 14.68. The potion's 1,400 health buys 1.63 more Life Taps, each of
 * which costs a global cooldown and deals nothing -- and mana GAINED rises
 * while mana SPENT falls, so the extra taps are for mana the build did not
 * need. Life Tap's `canCast` asks whether there is health to spend and whether
 * the pool has room; it never asks whether the mana is wanted.
 */
