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
 * ============================================================================
 * THE ANSWER, AND THE FIX, BOTH KEPT -- BECAUSE THE ANSWER ALONE WAS MISREAD.
 *
 * WHAT IT MEASURED: Life Tap went 5.40 casts to 7.03 and Incinerate 16.10 to
 * 14.68. The potion's 1,400 health bought 1.63 more Life Taps, each a global
 * cooldown that deals nothing -- and mana GAINED rose while mana SPENT fell, so
 * the extra taps were for mana the build did not need. Life Tap's `canCast`
 * asks whether there is health to spend and whether the pool has room; it never
 * asks whether the mana is WANTED.
 *
 * THAT EXPLANATION WAS CORRECT AND WAS WRITTEN UP AS A PROPERTY OF WARLOCKS.
 * The ruleset owner read it and ruled the opposite: "this should never be the
 * case. Spending life tap on global cooldowns should only be based on the
 * warlock's current mana." The Firelock's Life Tap entry was UNGATED where the
 * SM/DS entry was already gated at 15% -- so the explanation was a description
 * of a bug, not a justification for it.
 *
 * **HAVING FOUND THE REAL CAUSE, ASK WHETHER THE CAUSE IS ITSELF CORRECT.**
 * That is the half of "isolate a loss, do not blame the obvious suspect" this
 * episode adds: the isolation worked perfectly and the conclusion drawn from it
 * was still wrong.
 *
 * SO THIS TOOL NOW MEASURES ZERO, which is the point of leaving it runnable.
 * With the gate in place a healing potion is worth -0.1 on the Firelock, Life
 * Tap fires about once a fight instead of five times, and the profile itself is
 * **+88.7 DPS**. If it ever reads a large negative again, the gate has gone.
 * ============================================================================
 */
