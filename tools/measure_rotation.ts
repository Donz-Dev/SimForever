/*
 * Measure Warrior builds over many seeds, so a rotation change is argued from a
 * number rather than a hunch.
 *
 *   npx vite-node tools/measure_rotation.ts
 *   SEEDS=80 ITERATIONS=10 npx vite-node tools/measure_rotation.ts
 *
 * WHY IT RUNS BATCHES AND NOT `runProfile`
 *
 * The UI renders `runProfileBatch(...).representative`, and even at one
 * iteration a batch derives its own seed -- so a direct `runProfile` call with
 * the same profile is a DIFFERENT fight. Measuring with a call the app does not
 * make is how a long detour into "stale Vite cache" got started once.
 *
 * WHY MANY SEEDS
 *
 * One fight is noise. Dodge alone is a 6.5% chance that goes missing from an
 * entire 100-second fight about once in two hundred runs. Every figure printed
 * here is a mean over SEEDS x ITERATIONS fights with a 95% interval, and a
 * difference smaller than that interval is not a difference.
 */
import { runProfileBatch } from '../src/simulator';
import {
  createDefaultProfile,
  type CharacterProfile,
  type TalentAllocation,
} from '../src/profiles';
import { startingEquipmentFor } from '../src/game/items/startingSets';
import type { CombatStyleId } from '../src/game/character';

const SEEDS = Number(process.env.SEEDS ?? 40);
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);

export interface Measurement {
  readonly mean: number;
  /** Half-width of the 95% interval on the mean. */
  readonly interval: number;
  readonly fights: number;
}

export interface BuildOptions {
  readonly style?: CombatStyleId;
  readonly talents?: TalentAllocation;
  readonly targetAttacks?: boolean;
}

/** A geared warrior, in the starting set, as the app creates one. */
export function warrior(options: BuildOptions = {}): CharacterProfile {
  const style = options.style ?? 'dual_wield';
  const base = createDefaultProfile();
  /*
   * NOT cast with `as`. An earlier draft did, and it silently swallowed
   * `two_handed` for the real id `two_hander` -- which left the two-hander
   * build in PLACEHOLDER weapons and read 89.86 DPS against the 119.07 on
   * file. The wrong number looked like a regression in the abilities being
   * measured. `tools/` is outside tsconfig's `include`, so the compiler was
   * never going to catch it either; the cast removed the last check there was.
   */
  const profile: CharacterProfile = {
    ...base,
    character: { ...base.character, combatStyle: style },
    equipment: startingEquipmentFor('warrior', style),
    talents: options.talents ?? {},
    simulation: { ...base.simulation, iterations: ITERATIONS },
    encounter: { ...base.encounter, targetAttacks: options.targetAttacks ?? false },
  };
  return profile;
}

/** Mean DPS and its 95% interval over SEEDS independent batches. */
export function measure(profile: CharacterProfile): Measurement {
  const samples: number[] = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const batch = runProfileBatch({ ...profile, simulation: { ...profile.simulation, seed } });
    samples.push(batch.dps.mean);
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance =
    samples.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (samples.length - 1);
  return {
    mean,
    interval: 2 * Math.sqrt(variance / samples.length),
    fights: SEEDS * ITERATIONS,
  };
}

/** `a` minus `b`, and whether the gap survives both intervals. */
export function difference(label: string, a: Measurement, b: Measurement): void {
  const delta = a.mean - b.mean;
  const gap = Math.sqrt(a.interval ** 2 + b.interval ** 2);
  const verdict = Math.abs(delta) > gap ? 'REAL' : 'NOISE';
  console.log(
    `${label.padEnd(46)} ${delta >= 0 ? '+' : ''}${delta.toFixed(2).padStart(7)} ` +
      `+/- ${gap.toFixed(2).padStart(5)}  ${verdict}`,
  );
}

export function report(label: string, m: Measurement): Measurement {
  console.log(
    `${label.padEnd(46)} ${m.mean.toFixed(2).padStart(7)} DPS  ` +
      `+/- ${m.interval.toFixed(2).padStart(5)}  (${m.fights} fights)`,
  );
  return m;
}

// ---------------------------------------------------------------------------
// The baselines docs/warrior-completion.md publishes.
// ---------------------------------------------------------------------------

/*
 * THE BUILDS ARE WRITTEN OUT, and that is the point of them being here.
 *
 * The baselines this file replaces were published with no record of the talents
 * behind them, so "Dual-wield, full Arms build -- 160.60" could not be
 * reproduced by anyone, including the person who measured it. An unreproducible
 * baseline is a rumour. These two are spelled out talent by talent and add up
 * to exactly 31 points, the minimum that reaches a capstone.
 *
 * An earlier draft of this list invented four ids that do not exist --
 * `tactical_mastery` for `improved_tactical_mastery`, plus two weapon
 * specialisations the Forever tree does not have at all. Unknown ids are
 * silently ignored, so it measured a near-talentless warrior and called it a
 * full Arms build. `npx vite-node` over `talentsForClass('warrior')` prints the
 * real ids.
 *
 * AND IT WAS ILLEGAL. Mortal Strike requires a point in Sweeping Strikes, which
 * this build skipped, so `createPlayer` would now strip Mortal Strike from it
 * entirely -- and before it enforced the rules, the build was measured with a
 * capstone it had not earned. The point comes out of Bloodthrill.
 */
const ARMS_31: TalentAllocation = {
  improved_heroic_strike: 3,
  deflection: 5,
  improved_rend: 3, // 11
  improved_charge: 2,
  improved_tactical_mastery: 5,
  improved_overpower: 2, // 20
  anger_management: 1,
  deep_wounds: 3, // 24
  spearing_strike: 1,
  impale: 2, // 27
  sweeping_strikes: 1, // 28 -- Mortal Strike REQUIRES a point here
  bloodthrill: 2, // 30
  mortal_strike: 1, // 31
};

const PROTECTION_31: TalentAllocation = {
  shield_specialization: 5,
  anticipation: 5, // 10
  improved_bloodrage: 2,
  toughness: 5,
  improved_thunder_clap: 3, // 20
  last_stand: 1,
  master_of_defense: 2,
  improved_revenge: 3,
  defiance: 3, // 29
  improved_sunder_armor: 1, // 30
  shield_slam: 1, // 31
};

console.log(`\nSEEDS=${SEEDS} ITERATIONS=${ITERATIONS}  (${SEEDS * ITERATIONS} fights per row)\n`);

report('Dual-wield, no talents', measure(warrior()));
report('Two-hander, no talents', measure(warrior({ style: 'two_hander' })));
report('1H & Shield, no talents', measure(warrior({ style: 'one_hand_shield' })));
report(
  '1H & Shield, 31-pt Protection (Shield Slam)',
  measure(warrior({ style: 'one_hand_shield', talents: PROTECTION_31 })),
);
report('Dual-wield, 31-pt Arms (Mortal Strike)', measure(warrior({ talents: ARMS_31 })));

/*
 * Death Wish sits at tier 20 of Fury, so a build reaching it is a Fury build.
 * Measured against the same build without the talent, which is the only
 * comparison that isolates the ability rather than the tree.
 */
const FURY_DEATH_WISH: TalentAllocation = {
  booming_voice: 5,
  cruelty: 5, // 10
  unbridled_wrath: 5, // 15
  improved_cleave: 3,
  boundless_rage: 3, // 21
  enrage: 5, // 26
  precision: 3, // 29
  death_wish: 1, // 30
};
const FURY_NO_DEATH_WISH: TalentAllocation = { ...FURY_DEATH_WISH, death_wish: 0 };

console.log('');
const withDW = report('Fury build WITH Death Wish', measure(warrior({ talents: FURY_DEATH_WISH })));
const withoutDW = report('Fury build without it', measure(warrior({ talents: FURY_NO_DEATH_WISH })));
difference('  Death Wish is worth', withDW, withoutDW);
console.log('');
report('Dual-wield, target swings back', measure(warrior({ targetAttacks: true })));
report(
  '1H & Shield Prot, target swings back',
  measure(warrior({ style: 'one_hand_shield', talents: PROTECTION_31, targetAttacks: true })),
);
console.log('');
