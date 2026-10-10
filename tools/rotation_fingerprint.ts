/**
 * An EXACT fingerprint of what every preset DOES, for checking a refactor that
 * is supposed to change nothing.
 *
 * ----------------------------------------------------------------------------
 * SHARPER THAN A DPS MEASUREMENT, AND MUCH CHEAPER. `measure_profiles.ts`
 * answers "did this move the published figure", which is a question about
 * variance and needs 300 fights a profile to answer; this answers "did any
 * decision change at all", which is a question about identity and needs three.
 *
 * IT HASHES THE COMBAT LOG, not the damage. The log is a pure formatter over
 * the same telemetry stream the analyzers read, so it carries every cast, every
 * swing, every aura and every tick in order -- a rotation that picked a
 * different ability once, or the same abilities in a different order, moves the
 * hash. A DPS total can hide both: two orderings of the same casts can sum to
 * the same damage.
 *
 * AND THE ENGINE DRAWS FROM ONE RANDOM STREAM, so a single changed decision
 * reorders every later draw and the rest of the fight diverges completely.
 * That is usually a nuisance -- it is what stops paired measurement working for
 * anything that can flip a roll -- and here it is the point: an identical hash
 * over three seeds means no decision changed anywhere in those fights.
 *
 * Run it before a rotation refactor, save the output, run it after, diff.
 * ----------------------------------------------------------------------------
 */
import { createHash } from 'node:crypto';
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { runProfile } from '../src/simulator';

const SEEDS = [12345, 777, 20260101];

for (const preset of PROFILE_PRESETS) {
  const base = preset.build();
  const parts: string[] = [];
  for (const seed of SEEDS) {
    const result = runProfile(
      { ...base, simulation: { ...base.simulation, iterations: 1, seed } },
      seed,
    );
    const hash = createHash('sha256').update(result.combatLog.join('\n')).digest('hex').slice(0, 12);
    // The event count beside the hash, because a hash says "different" and a
    // count says something about HOW -- a list that stopped casting one entry
    // shows up as a smaller number rather than as noise.
    parts.push(`${hash}:${result.eventsProcessed}`);
  }
  console.log(`${preset.id.padEnd(20)} ${parts.join('  ')}`);
}
