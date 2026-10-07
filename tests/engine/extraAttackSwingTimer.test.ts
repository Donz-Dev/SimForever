import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../src/engine';
import { seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * AN EXTRA ATTACK RESETS THE SWING TIMER, AND THAT IS A RULING.
 *
 * The ruleset owner, 2026-10-07: "an extra attack from Reckoning is exactly the
 * same as the other extra attacks -- like from Hand of Justice. It will trigger
 * an auto-attack and reset the swing timer."
 *
 * ------------------------------------------------------------------------------
 * WHY THIS FILE EXISTS, when the behaviour is what the code already does.
 *
 * Because NOTHING ABOUT THE CODE ANNOUNCES THAT IT IS DELIBERATE. `extraAttack`
 * ends with `scheduleSwing(full timer)`, which cancels whatever the slot was
 * waiting on -- and read cold, that is a bug: an extra attack appears to pay for
 * itself by delaying the next normal swing.
 *
 * IT WAS READ AS ONE, during the Paladin pass. A change to preserve the pending
 * swing's due time was written, measured, and reverted when the measurement
 * showed Reckoning was already at expectation; the owner then ruled. **Without a
 * test, the next person to look finds the same apparent bug and the same
 * plausible fix**, which is precisely the decay a seeded measurement cannot
 * catch on its own -- it would simply report a different number.
 *
 * THE ASYMMETRY IS THE REASON IT KEEPS SURFACING. For a proc firing from inside
 * the attacker's OWN swing the reset is invisible: the original handler has
 * already scheduled its successor a whole timer out, so rescheduling to the same
 * instant changes nothing. For one firing from damage TAKEN -- Reckoning -- the
 * reset is real. Both cases are pinned below, because a fix aimed at the second
 * would leave the first passing.
 * ==============================================================================
 */

const SWING_MS = seconds(3);

function fight() {
  const attacker: Combatant = makeAttacker({
    autoAttack: 'main-hand',
    weapons: {
      mainHand: { name: 'Test Weapon', swingTimerMs: SWING_MS, baseDamage: 10, damageVariance: 0 },
    },
  });
  const target = makeTarget({ maxHealth: 1_000_000 });
  const simulation = buildSimulation([attacker, target], { durationMs: seconds(60) });
  return { attacker, target, simulation };
}

/** When the slot's pending swing is currently due. */
const dueAt = (attacker: Combatant, slot: 'mainHand' = 'mainHand') =>
  attacker.pendingSwing(slot)?.timestamp;

describe('an extra attack and the swing timer', () => {
  it('restarts the timer from the moment of the extra attack', () => {
    const { attacker, simulation } = fight();

    simulation.advanceTo(seconds(1));
    const before = dueAt(attacker);
    expect(before).toBeDefined();

    /*
     * HALFWAY THROUGH THE SWING, which is where the rule is observable. An extra
     * attack here throws away the progress and starts a fresh three seconds.
     */
    simulation.advanceTo(seconds(2));
    simulation.extraAttack(attacker, 'mainHand');
    simulation.advanceTo(seconds(2));

    expect(dueAt(attacker)).toBe(seconds(2) + SWING_MS);
  });

  it('does NOT preserve what was left of the pending swing', () => {
    /*
     * THE ASSERTION THAT STOPS THE PLAUSIBLE FIX. Preserving the due time is the
     * change somebody will reach for, and it is the one the owner ruled against.
     * Written as its own expectation rather than as the inverse of the one above,
     * so a failure says which rule was broken.
     */
    const { attacker, simulation } = fight();

    simulation.advanceTo(seconds(1));
    const original = dueAt(attacker)!;

    simulation.advanceTo(seconds(2));
    simulation.extraAttack(attacker, 'mainHand');
    simulation.advanceTo(seconds(2));

    expect(dueAt(attacker)).not.toBe(original);
    expect(dueAt(attacker)).toBeGreaterThan(original);
  });

  it('keeps at most one pending swing, so the chain cannot fork', () => {
    /*
     * THE INVARIANT THE RESET IS TANGLED UP WITH, and the reason `scheduleSwing`
     * cancels at all: without it an extra attack fired from inside a swing would
     * leave two independent timers on one weapon, doubling with every proc. Four
     * Hand of Justice procs once turned 115 main-hand swings into 211.
     */
    const { attacker, simulation } = fight();

    simulation.advanceTo(seconds(2));
    simulation.extraAttack(attacker, 'mainHand');
    simulation.extraAttack(attacker, 'mainHand');
    simulation.extraAttack(attacker, 'mainHand');
    simulation.advanceTo(seconds(2));

    expect(dueAt(attacker)).toBe(seconds(2) + SWING_MS);
  });

  it('is invisible when the proc fires from the attacker’s own swing', () => {
    /*
     * HAND OF JUSTICE AND WINDFURY TOTEM, which is why the rule went unnoticed:
     * the swing handler has already scheduled its successor a whole timer out, so
     * an extra attack at that same instant reschedules to the same time.
     *
     * A fix aimed at the damage-taken case would leave this passing, which is
     * exactly why both are here.
     */
    const { attacker, simulation } = fight();

    simulation.advanceTo(SWING_MS);
    const afterNormalSwing = dueAt(attacker);
    expect(afterNormalSwing).toBe(SWING_MS + SWING_MS);

    simulation.extraAttack(attacker, 'mainHand');
    simulation.advanceTo(SWING_MS);

    expect(dueAt(attacker)).toBe(afterNormalSwing);
  });
});
