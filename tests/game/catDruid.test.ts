import { describe, expect, it } from 'vitest';
import { Simulation, toRollUnits } from '../../src/engine';
import {
  RAKE_AP_COEFFICIENT,
  RAKE_TICK_AP_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { CLEARCASTING } from '../../src/game/auras/druid';
import { DRUID_CAT } from '../../src/game/rotations/druid';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { talentBuild, talentContextFor } from '../../src/game/talents/talentBuild';
import { talentNumber } from '../../src/game/talents/talentValues';
import { weaponsFor } from '../../src/game/actors/createPlayer';
import { MAX_CHARACTER_LEVEL } from '../../src/game/character';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ============================================================================
 * THE CAT DRUID: four things the ruleset owner reported, and what each was.
 *
 *   1. every Clearcasting proc should go on SHRED, whatever the combo points
 *   2. Rend and Tear was applying ~1.025x where ~1.09x was expected
 *   3. Primal Fury gave no combo points to a Cat, only rage to a Bear
 *   4. Rake's DoT tick should scale at 5.5% of attack power, not 1%
 *
 * TWO OF THE FOUR WERE A SECOND CLAUSE NOBODY READ. Primal Fury's row holds
 * three numbers and the effect took index 0; Rend and Tear was scoped by a
 * reading of its words that the owner's own figure contradicts. Neither
 * reported itself unmodelled, so the census counted both in the `Fully` column.
 * ============================================================================
 */

const CAT = PRESETS_BY_ID.get('druid_cat')!.build();

function buildIn(style: 'cat' | 'bear') {
  return talentBuild(
    'druid',
    CAT.talents,
    talentContextFor(CAT.equipment, style, weaponsFor(CAT.equipment, style), {
      characterClass: 'druid',
      talents: CAT.talents,
      level: MAX_CHARACTER_LEVEL,
    }),
  );
}

/** Replay the Cat over `seeds` fights and collect from the event stream. */
function replay(seeds = 20) {
  let procs = 0;
  let up = false;
  let lastCast: string | undefined;
  const spentOn = new Map<string, number>();
  let comboFromBloodFrenzy = 0;
  let rage = 0;

  for (let seed = 1; seed <= seeds; seed += 1) {
    const config = trainingDummyEncounter({ ...CAT }, seed * 7919);
    const simulation = new Simulation(config, {
      emit: (event) => {
        if (event.type === 'aura_applied' && event.auraId === CLEARCASTING.id) {
          procs += 1;
          up = true;
        }
        /*
         * THE CAST THAT SPENDS IT is the last one before the aura is removed.
         * A free ability cast while it is up does NOT consume it, and the first
         * draft of this attribution read the next cast of any kind -- which
         * reported Berserk, and the since-removed Tiger's Fury, taking charges
         * they cannot take.
         */
        if (event.type === 'cast' && up) lastCast = event.abilityId;
        if (event.type === 'aura_removed' && event.auraId === CLEARCASTING.id) {
          if (lastCast) spentOn.set(lastCast, (spentOn.get(lastCast) ?? 0) + 1);
          up = false;
          lastCast = undefined;
        }
        if (
          event.type === 'resource_gained' &&
          event.resource === 'comboPoints' &&
          event.source === 'blood_frenzy'
        ) {
          comboFromBloodFrenzy += event.amount;
        }
        if (event.type === 'resource_gained' && event.resource === 'rage') rage += event.amount;
      },
    });
    simulation.begin();
    simulation.run();
  }
  return { procs: procs / seeds, spentOn, comboFromBloodFrenzy: comboFromBloodFrenzy / seeds, rage };
}

describe('1. every Clearcasting proc goes on Shred', () => {
  it('puts a Clearcasting-gated Shred above the finisher', () => {
    const ids = DRUID_CAT.map((entry) => entry.abilityId);
    expect(ids.indexOf('shred')).toBeLessThan(ids.indexOf('rip'));
    // Twice on purpose: gated above, ungated as the filler below.
    expect(ids.filter((id) => id === 'shred')).toHaveLength(2);
    expect(ids.lastIndexOf('shred')).toBeGreaterThan(ids.indexOf('rake'));
  });

  it('spends every proc on Shred and nothing else', () => {
    /*
     * MEASURED, because the position in the list is a claim about what the
     * rotation reaches and not a demonstration of it. Before this entry the
     * 2.05 procs a fight landed on Shred, Rake and Rip in roughly 1.3/0.4/0.3.
     */
    const { procs, spentOn } = replay();
    expect(procs).toBeGreaterThan(1.5);
    expect([...spentOn.keys()]).toEqual(['shred']);
    expect(spentOn.get('shred')! / 20).toBeCloseTo(procs, 1);
  });
});

describe('2. Rend and Tear reaches every point of melee damage', () => {
  it('names both melee tables, including the swing', () => {
    /*
     * THE OWNER'S FIGURE DECIDED THE WORDING. "Melee abilities" invites the
     * narrow reading and that is what shipped; measured over 30 batches with
     * the target bleeding 89.3% of the fight, the three readings give x1.0296,
     * x1.0612 and x1.0948, and only the last is the ~1.09x reported. The first
     * is the ~1.025x reported as the symptom.
     */
    expect(DRUID_TALENT_EFFECTS.rend_and_tear).toEqual([
      { kind: 'bleedingTargetDamage', tables: ['melee-auto', 'melee-special'] },
    ]);
    expect(talentNumber('druid', 'rend_and_tear', 5, 0)).toBe(10);
  });

  it('registers +10% on both tables for the Cat', () => {
    const bleeding = buildIn('cat').bleedingTargetModifiers;
    for (const table of ['melee-auto', 'melee-special'] as const) {
      expect(bleeding.for(table).damageMultiplier, table).toBeCloseTo(1.1, 10);
    }
    // And on no other table: this is a MELEE talent.
    for (const table of ['spell', 'ranged-auto', 'ranged-special'] as const) {
      expect(bleeding.for(table).damageMultiplier ?? 1, table).toBe(1);
    }
  });
});

/*
 * ----------------------------------------------------------------------------
 * PRIMAL FURY IS CALLED BLOOD FRENZY AT CLIENT BUILD 1.60.1.70170, and the
 * rename is all that moved: same row, same two ranks, same tooltip word for
 * word, same `[100, 5, 100]` at rank 2.
 *
 * THE TALENT ID FOLLOWED THE CLIENT AND SO DID THE REACTION IDS, which is the
 * opposite of what Primal Bite did. A talent id is DERIVED from the client's
 * name, so there was no choice about the first; the reaction ids and the
 * resource-source names were a choice, and they moved because the source name
 * is what a person reads on the resource panel beside the combo points it
 * granted. Primal Bite's ABILITY id stayed `mangle` because rotations, profiles
 * and the Berserk aura all key off it.
 * ----------------------------------------------------------------------------
 */
describe('3. Blood Frenzy has two clauses and both are form-gated', () => {
  it('states a rage chance, the rage, and a combo point chance', () => {
    // "...{0}% chance to gain an additional {1} Rage ... while in Bear Form ...
    // In addition, your non-periodic critical strikes from Cat Form abilities
    // that generate Combo Points have a {2}% chance to add an additional
    // Combo Point."
    expect([0, 1, 2].map((i) => talentNumber('druid', 'blood_frenzy', 2, i))).toEqual([
      100, 5, 100,
    ]);
    // And nothing answers to the old name, which is what a stale talent id
    // looks like: every effect silently dropped.
    expect(talentNumber('druid', 'primal_fury', 2, 0)).toBeUndefined();
  });

  it('gives a Cat the combo point proc and a Bear the rage one, never both', () => {
    expect(buildIn('cat').reactions.map((r) => r.id)).toEqual(['blood_frenzy_combo_point']);
    expect(buildIn('bear').reactions.map((r) => r.id)).toEqual(['blood_frenzy']);
  });

  it('reads index 2 for the combo point chance, not index 0', () => {
    /*
     * Both are 100 at rank 2, so index 0 would LOOK right -- which is why the
     * index is asserted rather than the resulting chance. At rank 1 they differ
     * only in the rage figure, so no rank distinguishes them by value alone.
     */
    const combo = DRUID_TALENT_EFFECTS.blood_frenzy.find(
      (effect) => effect.kind === 'reaction' && effect.reactionId === 'blood_frenzy_combo_point',
    );
    expect(combo).toMatchObject({ valueIndex: 2, requires: { styles: ['cat'] } });
  });

  it('gives a Cat combo points in a real fight, and no rage at all', () => {
    /*
     * THE RAGE HALF WAS FIRING FOR THE CAT, and its reaction carried a comment
     * saying it could not: "rage is the Bear's resource, and `grantResource`
     * finds no pool on a Cat". Every Druid owns every pool in every form -- the
     * test next door asserts exactly that -- so the Cat was gaining 100 rage a
     * fight and wasting 62% of it.
     */
    const { comboFromBloodFrenzy, rage } = replay();
    expect(comboFromBloodFrenzy).toBeGreaterThan(3);
    expect(rage).toBe(0);
  });

  it('cannot fire on a bleed TICK, which the engine guarantees', () => {
    /*
     * "NON-PERIODIC critical strikes". `dealDamage` offers an attack to
     * reactions only when `request.attackTable && !request.periodic`, so a Rake
     * tick is never shown to one -- and every DoT in Forever can crit, so a Cat
     * holding Rake and Rip up produces a stream of periodic crits that would
     * otherwise print combo points for a bleed ticking.
     */
    const reaction = buildIn('cat').reactions[0];
    expect(reaction.outcomes).toEqual(['crit']);
    expect(reaction.on).toBe('dealt');
  });
});

describe("4. Rake's tick scales at 5.5% and its hit still at 1%", () => {
  it('moved only the tick', () => {
    /*
     * `WoWSimWorksheet.xlsx` states 1% for both halves and that is what
     * shipped. The owner has since given the TICK as 5.5% directly, and a later
     * statement outranks the sheet -- the same way the sheet outranked the
     * Warrior ability spreadsheet. The HIT is the half to be careful about:
     * reading "Rake is 5.5%" and setting both would inflate the direct damage.
     */
    expect(RAKE_AP_COEFFICIENT).toBe(0.01);
    expect(RAKE_TICK_AP_COEFFICIENT).toBe(0.055);
  });

  it('is worth more than the hit, which is the point of the change', () => {
    expect(RAKE_TICK_AP_COEFFICIENT).toBeGreaterThan(RAKE_AP_COEFFICIENT);
    // Three ticks over nine seconds, so 16.5% of attack power across the bleed
    // against 1% on the hit -- written out so the magnitude is visible.
    expect(RAKE_TICK_AP_COEFFICIENT * 3).toBeCloseTo(0.165, 10);
  });
});

describe('the Cat still spends its combo points', () => {
  it('reaches Rip, which is what the extra points are for', () => {
    /*
     * THE CHECK THAT TWO OF THESE CHANGES DID NOT CANCEL. Blood Frenzy hands the
     * Cat about ten extra combo points a fight, and the Clearcasting entry sits
     * ABOVE Rip -- so a list that spent every charge on Shred and never reached
     * its finisher would read as a working change and a worse build.
     */
    let rips = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const simulation = new Simulation(trainingDummyEncounter({ ...CAT }, seed * 7919), {
        emit: (event) => {
          if (event.type === 'cast' && event.abilityId === 'rip') rips += 1;
        },
      });
      simulation.begin();
      simulation.run();
    }
    expect(rips / 20).toBeGreaterThan(2);
  });

  it('keeps crit in roll units, so the combo proc is not a rounding artefact', () => {
    // 100% at rank 2, truncated into the 1-10000 space like every chance here.
    expect(toRollUnits(100)).toBe(10_000);
  });
});
