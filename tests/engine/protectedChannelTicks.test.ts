import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { MIND_FLAY, MIND_FLAY_PROTECTED_TICKS, MIND_FLAY_TICKS } from '../../src/game/abilities/priest';
import { ARCANE_MISSILES } from '../../src/game/abilities/mage';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/**
 * A test that walks `src/game` and reads every `.ts` file needs more than the
 * 5s default.
 *
 * ------------------------------------------------------------------------------
 * THIS TEST FAILED ON EVERY FULL-SUITE RUN AND PASSED STANDALONE IN 321ms,
 * which is the sixth instance of a pattern CLAUDE.md records and the second
 * with a counted mechanism: **a test that reads the source tree is the one kind
 * that gets slower the more tests run beside it**, because its synchronous disk
 * reads contend with vitest transforming 167 test files in parallel.
 *
 * THE LIMIT IS PER-TEST AND `vite.config.ts` STILL SETS NO `testTimeout`.
 * Widening it globally would hide the next test that genuinely gets slower --
 * and the two Monte Carlo tests that time out intermittently beside this one
 * (`protectionRotation`, `raidBuffs`) have a DIFFERENT cause and are
 * deliberately left alone, because they read no files.
 *
 * `stealthBreaking.test.ts` carries the same constant for the same reason and
 * also caches its walk; this file makes ONE walk from ONE test, so the limit
 * alone is enough.
 * ------------------------------------------------------------------------------
 */
const READS_THE_SOURCE_TREE_MS = 30_000;

/*
 * ==============================================================================
 * AN INTERRUPT MAY TAKE MIND FLAY'S LAST TICK AND NOT ITS FIRST TWO.
 *
 * THE RULESET OWNER'S RULING: "there already exists a way to interrupt Mind Flay
 * casts. If this box is checked, make sure it preserves a minimum of the first 2
 * ticks of Mind Flay and thus only cuts off the last tick when interrupted.
 * **This may no longer be optimal play, but I still want the functionality so
 * the user can choose.**"
 *
 * ------------------------------------------------------------------------------
 * NO STOCK LIST REACHES IT, WHICH IS WHY THIS TEST BUILDS THE SITUATION. The
 * only interrupting entries checked into the project are the Warlock's three,
 * and the Shadow Priest's list interrupts nothing -- so the rule is reachable
 * only by somebody ticking the box in the panel, which is exactly how the owner
 * described it.
 *
 * **THAT IS THE SAMPLE SHAPE THIS PROJECT HAS BEEN CAUGHT BY**: "a list that
 * happens to avoid a bug is not a list that proves there is none." The last
 * interrupt bug here was found by the owner ticking that very box, after the one
 * list using the feature had avoided it by accident. So this constructs a
 * Shadow Priest whose Mind Blast interrupts, and asserts on what it does.
 * ==============================================================================
 */

/** The Shadow Priest, with its Mind Blast made an interrupting entry. */
function interruptingShadowPriest() {
  const profile = PRESETS_BY_ID.get('shadow_priest')!.build();
  return {
    ...profile,
    rotation: {
      ...profile.rotation,
      source: 'custom' as const,
      entries: profile.rotation.entries.map((entry) =>
        entry.abilityId === 'mind_blast' ? { ...entry, interruptsChannel: true } : entry,
      ),
    },
  };
}

function interruptsIn(profile: ReturnType<typeof interruptingShadowPriest>, seed: number) {
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(trainingDummyEncounter(profile, seed), {
    emit: (event) => events.push(event),
  });
  simulation.begin();
  simulation.run();
  return events.filter(
    (event) =>
      event.type === 'channel_interrupted' &&
      (event as { abilityId?: string }).abilityId === 'mind_flay',
  ) as unknown as readonly { ticksDelivered: number; ticksTotal: number }[];
}

describe('the ruling', () => {
  it('never cuts Mind Flay before its second tick has landed', () => {
    /*
     * ==========================================================================
     * ACROSS SEVERAL SEEDS AND SUMMED, because this is a RATE and not a
     * boundary: whether a given fight interrupts at all depends on when Mind
     * Blast comes off cooldown relative to a channel, which is exactly the kind
     * of thing one seed decides by luck.
     *
     * THE ASSERTION IS ON EVERY INTERRUPT, not on their mean. A floor that
     * holds on average is not a floor -- one channel cut after a single tick is
     * the whole of what this rule forbids.
     * ==========================================================================
     */
    const profile = interruptingShadowPriest();
    let interrupts = 0;

    for (const seed of [4242, 99, 1234, 777, 31337]) {
      for (const cut of interruptsIn(profile, seed)) {
        interrupts += 1;
        expect(
          cut.ticksDelivered,
          'an interrupt took a protected tick',
        ).toBeGreaterThanOrEqual(MIND_FLAY_PROTECTED_TICKS);
        // And it is a real interrupt rather than a channel that simply ended.
        expect(cut.ticksDelivered).toBeLessThan(cut.ticksTotal);
      }
    }

    /*
     * THE GUARD THAT MAKES THE ABOVE MEAN ANYTHING. A rule about interrupts
     * asserted over zero interrupts passes trivially, which is how a test ends
     * up proving nothing -- and it is the failure mode this project records for
     * Preparation's three tests and their two-ability book.
     */
    expect(interrupts, 'the fixture actually interrupted something').toBeGreaterThan(0);
  });

  it('cuts only the LAST tick, which is what the owner asked for', () => {
    // Two protected of three total leaves exactly one cuttable, so the two
    // constants together are the ruling rather than either one alone.
    expect(MIND_FLAY_TICKS).toBe(3);
    expect(MIND_FLAY_PROTECTED_TICKS).toBe(2);
    expect(MIND_FLAY_TICKS - MIND_FLAY_PROTECTED_TICKS).toBe(1);
    expect(MIND_FLAY.protectedChannelTicks).toBe(MIND_FLAY_PROTECTED_TICKS);
  });
});


describe('what carries it', () => {
  it('is Mind Flay alone, and Arcane Missiles is deliberately untouched', () => {
    /*
     * ==========================================================================
     * THE RULING NAMED ONE CHANNEL AND IS NOT EXTENDED BY ANALOGY.
     *
     * "The first 2 ticks, and thus only the last one is cut" reads as a general
     * rule -- `channelTicks - 1` -- and deriving it would make ARCANE MISSILES
     * un-interruptible for its first FOUR ticks on nobody's authority. That is
     * the Immolation Trap precedent: the owner ruled one trap in and the other
     * stayed undeclared until they named it too, and waiting carried a second
     * fact an analogy would have had to guess.
     *
     * BY SOURCE SCAN, because the thing to prevent is a DECLARATION being added
     * quietly -- the same guard `breaksActionAuras` has, and for the same
     * reason: an opt-in list nobody re-reads.
     * ==========================================================================
     */
    expect(ARCANE_MISSILES.interruptibleChannel, 'still interruptible').toBe(true);
    expect(ARCANE_MISSILES.protectedChannelTicks, 'and unprotected').toBeUndefined();

    const declaring: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.ts')) {
          const source = readFileSync(path, 'utf8');
          // The declaration, not the field's own definition or its doc comment.
          if (/protectedChannelTicks:\s*\w/.test(source)) declaring.push(path);
        }
      }
    };
    walk('src/game');

    expect(declaring).toEqual(['src/game/abilities/priest.ts']);
    /*
     * ==========================================================================
     * **THE DEFAULT 5s LIMIT WAS TOO TIGHT FOR A TEST THAT READS THE SOURCE
     * TREE, AND THIS IS THE SIXTH INSTANCE OF THAT CLASS.**
     *
     * This body walks `src/game` and reads every `.ts` file in it synchronously,
     * which is the one kind of test that gets SLOWER the more tests run beside
     * it -- vitest transforms 167 test files in parallel and they compete for
     * the same disk. It timed out at 5000ms under the full suite while passing
     * standalone in **285ms**, a 17x margin, with the assertion itself
     * unaffected.
     *
     * CLAUDE.md's "Testing" section records the same failure in
     * `stealthBreaking.test.ts`, whose `sourceFiles` helper caches the walk and
     * which carries an explicit `READS_THE_SOURCE_TREE_MS` for exactly this. A
     * CACHE buys nothing here -- there is one walk in one test -- so the limit
     * is the whole fix rather than insurance behind one.
     *
     * **PER-TEST AND NOT `testTimeout`.** `vite.config.ts` deliberately sets no
     * global limit: widening it would hide the next test that genuinely gets
     * slower, which is the thing a timeout is actually good at catching.
     * ==========================================================================
     */
  }, READS_THE_SOURCE_TREE_MS);
});
