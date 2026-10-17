/*
 * ============================================================================
 * IS COMBUSTION WORTH A GLOBAL COOLDOWN? A question rather than a change.
 *
 *   PRESET=mage_fire npx vite-node tools/probe_combustion_gcd.ts
 *
 * ----------------------------------------------------------------------------
 * `triggersGcd(ability)` is `ability.triggersGcd ?? ability.onNextSwing ===
 * undefined`, so an ordinary ability is ON the global cooldown unless somebody
 * opts it out -- and `src/game/abilities/mage.ts` carries exactly two opt-outs,
 * both given by the owner in one sentence: "Ensure Presence of Mind and Arcane
 * Power don't trigger a global cooldown."
 *
 * COMBUSTION IS THE THIRD ABILITY OF THAT EXACT SHAPE AND WAS NOT NAMED.
 * In `src/data/abilities/forever-mage-spellbook.json` all three are the same
 * row -- no cost, "Instant", "3 min cooldown", no rank, each granted by a
 * capstone -- and the two that were named are the Arcane ones, because the
 * owner was auditing the Arcane profile. Combustion is in the FIRE list.
 *
 * SO THIS PROBE PRICES A RULING THAT HAS NOT BEEN GIVEN AND NOTHING SHIPS FROM
 * IT. A ruling covers what it says and is not extended by analogy, which is
 * what made waiting for Explosive Trap right: when the answer came it carried a
 * second fact (there is no attack-power scaler) that an analogy would have had
 * to guess.
 *
 * MUTATED AT RUNTIME RATHER THAN BY EDITING THE SOURCE, which is
 * `probe_parry_haste.ts`'s arrangement and for its reason: an isolation probe
 * that edits a file can leave a half-reverted change behind, and this project
 * has recorded that twice.
 *
 * PAIRED UNDER SHARED SEEDS, so the two runs share fight lengths. The flag is
 * flipped BETWEEN the two samplings in one process, which is the only way to
 * pair a change the profile cannot express.
 * ============================================================================
 */
import { pairedDelta, profileSamples } from '../src/simulator';
import { PRESETS_BY_ID } from '../src/profiles';
import { COMBUSTION_ABILITY } from '../src/game/abilities/mage';

const PRESET = process.env.PRESET ?? 'mage_fire';
const ITER = Number(process.env.ITER ?? 1500);
const SEED = Number(process.env.SEED ?? 20260101);
const DURATION = process.env.DURATION === undefined ? undefined : Number(process.env.DURATION);

const preset = PRESETS_BY_ID.get(PRESET)!.build();
const profile =
  DURATION === undefined
    ? preset
    : { ...preset, simulation: { ...preset.simulation, durationSeconds: DURATION } };
const slice = { from: 0, to: ITER };

const mutable = COMBUSTION_ABILITY as { triggersGcd?: boolean };
if (mutable.triggersGcd !== undefined) {
  throw new Error(
    `COMBUSTION_ABILITY already declares triggersGcd=${String(mutable.triggersGcd)} -- ` +
      'this probe exists because it declares nothing, so the question it asks has been answered',
  );
}

const onGcd = profileSamples(profile, SEED, slice);
mutable.triggersGcd = false;
const offGcd = profileSamples(profile, SEED, slice);
mutable.triggersGcd = undefined;

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const d = pairedDelta(onGcd.dps, offGcd.dps);
const verdict = d.spread === 0 ? 'IDENTICAL FIGHTS' : Math.abs(d.delta) > d.interval ? 'real' : 'noise';

console.log(
  `\n${PRESET}  ${profile.simulation.durationSeconds}s  ${ITER} paired iterations\n` +
    `  combustion ON  the GCD   ${mean(onGcd.dps).toFixed(2)} DPS\n` +
    `  combustion OFF the GCD   ${mean(offGcd.dps).toFixed(2)} DPS\n` +
    `  delta                    ${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(2)} ` +
    `+/- ${d.interval.toFixed(2)}  spread ${d.spread.toFixed(1)}  ${verdict}\n`,
);
