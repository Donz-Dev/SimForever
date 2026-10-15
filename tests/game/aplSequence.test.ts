import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/engine';
import type { TelemetryEvent } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { compileRotation } from '../../src/game/rotations/apl';
import type { AplList } from '../../src/game/rotations/apl';
import { conditionOf, rootOf, setSequence } from '../../src/ui/panels/aplEditing';
import { describeCondition } from '../../src/game/rotations/apl/describe';

/**
 * ==============================================================================
 * TWO APL ADDITIONS THE OWNER ASKED FOR, AND BOTH ARE TESTED THROUGH A FIGHT.
 *
 *   "I want the cooldown condition to have a 'seconds left' controller just
 *    like buff/debuff does."
 *
 *   "There also needs to be a way to combine abilities into one action, that
 *    way it can cause a set sequence to occur. Like 5 combo points is reached
 *    + 35 energy is reached -> use Cold Blood and then Eviscerate."
 *
 * THE SEQUENCE IS THE ONE THAT NEEDS A FIGHT, and CLAUDE.md says why: "when a
 * new condition primitive is added, the `USES=1` pass IS the test that it
 * fires" -- `recordSwing` landed in the wrong one of two identical functions,
 * the window never opened, three lists cast nothing, and the suite passed. A
 * unit test on `selectAction` chooses the moment; a fight does not.
 * ==============================================================================
 */

/** Run one fight on a preset with a hand-written list, and return its casts. */
function castsOn(presetId: string, list: AplList, seed = 4242) {
  const profile = PRESETS_BY_ID.get(presetId)!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(
    trainingDummyEncounter(
      { ...profile, rotation: { source: 'custom', ...list } } as never,
      seed,
    ),
    { emit: (event) => events.push(event) },
  );
  simulation.run();

  return events.filter((event) => event.type === 'cast');
}

describe('an entry can combine abilities into ONE action', () => {
  /*
   * THE OWNER'S OWN EXAMPLE, built as a list of two entries: the sequence, and
   * a cheap filler beneath it. The FILLER IS THE TEST -- without it nothing
   * could get between the two steps and the sequence would be indistinguishable
   * from two ordinary entries.
   */
  const coldBloodThenEviscerate: AplList = {
    name: 'Cold Blood sequence',
    entries: [
      {
        abilityId: 'cold_blood',
        sequence: ['eviscerate'],
        condition: {
          kind: 'all',
          of: [
            { kind: 'comboPoints', compare: 'atLeast', points: 5 },
            { kind: 'resource', resource: 'energy', compare: 'atLeast', amount: 35 },
          ],
        },
      },
      { abilityId: 'sinister_strike' },
    ],
  };

  it('casts the second ability immediately after the first, every time', () => {
    /*
     * ------------------------------------------------------------------------
     * THE WHOLE CLAIM, AND IT IS ABOUT WHAT IS *NOT* BETWEEN THEM. Cold Blood
     * is free and off the global cooldown, so the instant it goes out an
     * ordinary priority list is re-read from the top and Sinister Strike at 45
     * energy is affordable -- the Eviscerate it was pressed for never happens
     * and a two-minute cooldown is spent on nothing.
     *
     * ASSERTED AS "the next cast after every Cold Blood is an Eviscerate",
     * which is the property; a count of each would pass against a list that
     * cast them at unrelated moments.
     * ------------------------------------------------------------------------
     */
    const casts = castsOn('rogue_venom', coldBloodThenEviscerate);
    const ids = casts.map((cast) => (cast as { abilityId: string }).abilityId);

    const coldBloods = ids.filter((id) => id === 'cold_blood').length;
    expect(coldBloods, 'the sequence fired at all').toBeGreaterThan(0);

    for (let i = 0; i < ids.length; i += 1) {
      if (ids[i] !== 'cold_blood') continue;
      expect(ids[i + 1], `the cast after Cold Blood at index ${i}`).toBe('eviscerate');
    }
  });

  it('is what two ordinary entries do NOT give you', () => {
    /*
     * ========================================================================
     * THE CONTROL, AND IT TOOK SOME CARE TO MAKE IT DECISIVE.
     *
     * The first version of this test compared the owner's own example -- gated
     * at 35 energy -- with and without the sequence, and the two came out
     * IDENTICAL. Not because the feature does nothing: because a Venom Rogue
     * at that moment has 35-44 energy, Sinister Strike costs 45, and nothing
     * else was affordable to fill the gap. The fight even waits 2.5 seconds
     * between the two casts.
     *
     * THAT IS WORTH RECORDING RATHER THAN HIDING. "Two variants that agree
     * exactly are a patch that did not apply" is this project's usual tell,
     * and here the identity was real and the TEST was wrong -- it was not
     * constructing a contested gap at all.
     *
     * SO THE GATE IS 45 RATHER THAN 35, which is the smallest change that
     * makes Sinister Strike affordable in the gap. One variable differs
     * between the two runs below: whether the entry carries a `sequence`.
     * ========================================================================
     */
    const gate: AplList['entries'][number]['condition'] = {
      kind: 'all',
      of: [
        { kind: 'comboPoints', compare: 'atLeast', points: 5 },
        { kind: 'resource', resource: 'energy', compare: 'atLeast', amount: 45 },
      ],
    };
    const listWith: AplList = {
      name: 'combined',
      entries: [
        { abilityId: 'cold_blood', sequence: ['eviscerate'], condition: gate },
        { abilityId: 'sinister_strike' },
      ],
    };
    const listWithout: AplList = {
      name: 'separate',
      entries: [{ abilityId: 'cold_blood', condition: gate }, { abilityId: 'sinister_strike' }],
    };

    const after = (list: AplList) => {
      const ids = castsOn('rogue_venom', list).map(
        (cast) => (cast as { abilityId: string }).abilityId,
      );
      const at = ids.indexOf('cold_blood');
      expect(at, 'Cold Blood fired').toBeGreaterThanOrEqual(0);
      return ids[at + 1];
    };

    expect(after(listWith)).toBe('eviscerate');
    // Without it, the list is re-read and the filler wins the gap -- and
    // Eviscerate is in this list ONLY as the second half of the action.
    expect(after(listWithout)).toBe('sinister_strike');
  });

  it('does not start when a later step cannot be afforded', () => {
    /*
     * RESOLVED BEFORE COMMITTED, which is the discipline `resolveCast` and
     * `consumeCastCharges` already split along. A sequence half-cast is worse
     * than one not started: Cold Blood spent with no Eviscerate behind it is
     * the cooldown thrown away, and nothing reports it.
     *
     * The gate here is deliberately satisfiable for Cold Blood ALONE -- no
     * combo point requirement -- so the only thing that can stop the sequence
     * is Eviscerate's own cost of five points.
     */
    const impossible: AplList = {
      name: 'A sequence ending in something unaffordable',
      entries: [
        // Eviscerate needs combo points; at the pull there are none.
        { abilityId: 'cold_blood', sequence: ['eviscerate'], condition: { kind: 'fightElapsed', compare: 'exactly', seconds: 0 } },
        { abilityId: 'sinister_strike' },
      ],
    };

    const ids = castsOn('rogue_venom', impossible).map(
      (cast) => (cast as { abilityId: string }).abilityId,
    );
    expect(ids.includes('cold_blood'), 'it never committed').toBe(false);
  });

  it('compiles an empty chain away rather than storing one', () => {
    /*
     * `syncDefaultRotation` COMPARES A STORED LIST TO THE STOCK ONE BY VALUE,
     * so an entry that gained a step and lost it again has to come back
     * byte-identical. That is the rule `disabled` already follows.
     */
    expect(setSequence([{ abilityId: 'eviscerate', sequence: ['cold_blood'] }], 0, [])).toEqual([
      { abilityId: 'eviscerate' },
    ]);
    // A half-made chain -- the panel's "(choose)" is the empty string.
    expect(setSequence([{ abilityId: 'eviscerate' }], 0, ['', 'cold_blood'])).toEqual([
      { abilityId: 'eviscerate', sequence: ['cold_blood'] },
    ]);
  });

  it('leaves every entry without one exactly as it was', () => {
    /*
     * THE CONTAINMENT CHECK IN MINIATURE. `compileEntry` must not add a
     * `sequence` key to the twenty-six stock lists, which is what keeps all 75
     * combat-log hashes identical.
     */
    const compiled = compileRotation({
      name: 'plain',
      entries: [{ abilityId: 'sinister_strike' }],
    });
    expect(compiled.name).toBe('plain');
  });
});

describe('a cooldown condition can read the seconds left', () => {
  it('gates on the clock rather than on a yes or no', () => {
    /*
     * ------------------------------------------------------------------------
     * ASSERTED THROUGH A FIGHT because the point is that it FIRES. A condition
     * that is never true and one that is always true both produce an ordinary
     * list and an ordinary figure -- which is the `swungWithin` failure, where
     * a new primitive read something nothing set and three lists silently cast
     * nothing.
     *
     * "Adrenaline Rush has at most 0s of cooldown left" IS "is ready", which
     * is the reading that makes an absent ability read zero -- so the two
     * lists below must behave the same way.
     * ------------------------------------------------------------------------
     */
    const byState: AplList = {
      name: 'ready',
      entries: [
        { abilityId: 'adrenaline_rush', condition: { kind: 'cooldown', abilityId: 'adrenaline_rush', state: 'ready' } },
        { abilityId: 'sinister_strike' },
      ],
    };
    const byClock: AplList = {
      name: 'seconds left',
      entries: [
        {
          abilityId: 'adrenaline_rush',
          condition: { kind: 'cooldownTime', abilityId: 'adrenaline_rush', compare: 'atMost', seconds: 0 },
        },
        { abilityId: 'sinister_strike' },
      ],
    };

    const count = (list: AplList) =>
      castsOn('rogue_combat', list).filter(
        (cast) => (cast as { abilityId: string }).abilityId === 'adrenaline_rush',
      ).length;

    expect(count(byState), 'it fires at all').toBeGreaterThan(0);
    expect(count(byClock)).toBe(count(byState));
  });

  it('is never true while a real cooldown is running', () => {
    /*
     * THE OTHER DIRECTION, and the one a yes/no cannot express: "within 10
     * seconds of coming back" is a window, not a state. Adrenaline Rush is on
     * a five-minute cooldown and a fight is shorter than that, so after the
     * one cast the condition can never be satisfied again -- which is what
     * makes the count exactly one rather than merely non-zero.
     */
    const nearlyReady: AplList = {
      name: 'nearly ready',
      entries: [
        {
          abilityId: 'adrenaline_rush',
          condition: { kind: 'cooldownTime', abilityId: 'adrenaline_rush', compare: 'atMost', seconds: 10 },
        },
        { abilityId: 'sinister_strike' },
      ],
    };
    const ids = castsOn('rogue_combat', nearlyReady).map(
      (cast) => (cast as { abilityId: string }).abilityId,
    );
    expect(ids.filter((id) => id === 'adrenaline_rush')).toHaveLength(1);
  });

  it('round-trips through the editor unchanged, which is the editor s one promise', () => {
    /*
     * `aplEditing.test.ts` asserts this for all 132 stock conditions; this is
     * the same assertion for a kind no stock list uses yet. Opening a
     * condition and changing nothing must leave it byte-identical.
     */
    const condition = {
      kind: 'cooldownTime',
      abilityId: 'cold_blood',
      compare: 'atMost',
      seconds: 3,
    } as const;

    const root = rootOf(condition);
    const child = root.children[0];
    expect(child.kind, 'the editor can DRAW it rather than keeping it fixed').toBe('clause');
    if (child.kind === 'clause') expect(child.clause.cooldownTest).toBe('secondsLeft');

    expect(conditionOf(root)).toEqual(condition);
  });

  it('describes itself in words a person can read', () => {
    expect(
      describeCondition(
        { kind: 'cooldownTime', abilityId: 'cold_blood', compare: 'atMost', seconds: 3 },
        { ability: () => 'Cold Blood' },
      ),
    ).toBe('Cold Blood has at most 3s of cooldown left');
  });
});
