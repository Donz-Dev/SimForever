import { describe, expect, it } from 'vitest';
import type { Ability } from '../../src/engine';
import { seconds } from '../../src/engine';
import { runPrecombat } from '../../src/engine/abilities/precombat';
import {
  ENERGY_PER_SECOND,
  ENERGY_REGEN,
  MANA_REGEN,
  MANA_REGEN_LOCKOUT_MS,
} from '../../src/game/combat/resourceRules';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ==============================================================================
 * REGENERATION IS CREDITED ACROSS A PRE-COMBAT LEAD, AND A SPEND IS STAMPED
 * WHEN IT HAPPENED.
 *
 * THE RULESET OWNER'S RULING, in answer to a question about what the lead time
 * actually buys: "yes, credit the regen and back-date the five-second rule."
 *
 * ------------------------------------------------------------------------------
 * IT IS THE THIRD AND FOURTH OBSERVABLE CONSEQUENCE OF A LEAD. The owner's
 * original ruling enumerated exactly TWO -- "an aura it applied has N seconds
 * less left at the pull, and its own cooldown comes back N seconds sooner" --
 * and `accruesBeforeCombat` added a third for Bloodrage's rage. So the
 * enumeration has now been extended twice, which is worth knowing before
 * treating any list of consequences here as closed.
 *
 * ------------------------------------------------------------------------------
 * THE CLOCK IS NOT MOVED AND CANNOT BE. `SimulationClock` only goes forward and
 * every scheduled event, swing timer and aura window is expressed against it --
 * the reason the whole feature resolves at timestamp zero. So the pre-combat
 * window is walked as a NEGATIVE local offset, each tick is evaluated at its own
 * moment, and the spend stamp is simply a number that is allowed to be negative.
 *
 * ------------------------------------------------------------------------------
 * AND THE TWO HALVES FIGHT EACH OTHER ON PURPOSE, which is the thing worth
 * testing rather than either half alone: crediting regeneration hands mana back,
 * and back-dating the five second rule is what stops it being handed back. A
 * caster that spent 3 seconds early is locked out for those 3 seconds, so the
 * credit is correctly ZERO -- while a Rogue, which has no such rule, really does
 * bank its ten a second.
 * ==============================================================================
 */

/** An instant ability that costs `amount` of `resource` and does nothing else. */
function spender(resource: 'energy' | 'mana', amount: number): Ability {
  return {
    id: `spend_${resource}`,
    name: `Spend ${resource}`,
    cost: { resource, amount },
    requiresTarget: false,
    onCast: () => {},
  };
}

describe('energy, which has no lockout to get in the way', () => {
  it('credits the lead at ten a second, which is the rate and not the cadence', () => {
    /*
     * TEN A SECOND, from `ENERGY_PER_SECOND` rather than written out: half an
     * energy twenty times a second. **The literal reading of the owner's "1
     * energy 20 times a second" was built, measured and REJECTED** -- it
     * doubled every energy build -- so the rate is ten and the cadence is
     * twenty. A test hard-coding 20 would be asserting the version that was
     * withdrawn.
     */
    const ability = spender('energy', 25);
    const player = makeAttacker({
      abilities: [ability],
      resources: [{ type: 'energy', maximum: 100, initial: 100 }],
      regeneration: [ENERGY_REGEN],
    } as never);
    const simulation = buildSimulation([player, makeTarget()]);

    runPrecombat(simulation, player, [{ abilityId: ability.id, secondsBefore: 1 }]);

    // Spent 25 a second early, and one second of regeneration is ten of it.
    expect(player.resources.get('energy')!.current).toBeCloseTo(100 - 25 + ENERGY_PER_SECOND, 6);
    expect(ENERGY_PER_SECOND).toBe(10);
  });

  it('stamps the spend at the moment it happened, which is negative', () => {
    const ability = spender('energy', 25);
    const player = makeAttacker({
      abilities: [ability],
      resources: [{ type: 'energy', maximum: 100, initial: 100 }],
      regeneration: [ENERGY_REGEN],
    } as never);
    const simulation = buildSimulation([player, makeTarget()]);

    runPrecombat(simulation, player, [{ abilityId: ability.id, secondsBefore: 2 }]);

    /*
     * A PLAIN NUMBER, AND A NEGATIVE ONE IS ARITHMETIC RATHER THAN A SPECIAL
     * CASE. `spentWithin` asks `now - last < windowMs`, so this reads as two
     * seconds ago at the pull with nothing having to understand that the pull
     * is zero.
     */
    expect(player.lastSpentAt('energy')).toBe(-seconds(2));
  });

  it('credits nothing for a window shorter than one tick', () => {
    /*
     * THE TICK LANDS AT THE END OF ITS OWN INTERVAL, which is the live path's
     * own rule -- "the first tick lands one full interval into the fight, not
     * at time zero". A 40ms lead against a 50ms interval contains no tick, so a
     * pool that starts full does not get a free one for standing still.
     */
    const ability = spender('energy', 25);
    const player = makeAttacker({
      abilities: [ability],
      resources: [{ type: 'energy', maximum: 100, initial: 100 }],
      regeneration: [ENERGY_REGEN],
    } as never);
    const simulation = buildSimulation([player, makeTarget()]);

    runPrecombat(simulation, player, [{ abilityId: ability.id, secondsBefore: 0.04 }]);

    expect(player.resources.get('energy')!.current).toBeCloseTo(75, 6);
  });
});

describe('mana, where the back-dated lockout is what stops the credit', () => {
  function caster(amount: number) {
    const ability = spender('mana', amount);
    const player = makeAttacker({
      abilities: [ability],
      resources: [{ type: 'mana', maximum: 10_000, initial: 10_000 }],
      regeneration: [MANA_REGEN],
      stats: { manaPer5: 500 },
    } as never);
    return { ability, player, simulation: buildSimulation([player, makeTarget()]) };
  }

  it('credits NOTHING across a lead the spend itself locked out', () => {
    /*
     * ========================================================================
     * THE INTERACTION, AND THE REASON BOTH HALVES HAD TO LAND TOGETHER.
     *
     * Crediting regeneration alone would have handed this caster three seconds
     * of mana back. The five second rule, stamped at the moment of the spend
     * rather than at the pull, is what suppresses exactly that -- so the pool
     * at the pull is the cost and nothing else.
     *
     * AND THE TICKS BEFORE THE SPEND ARE CREDITED TOO AND CLAMP TO NOTHING,
     * because the pool started full. That is `grantResource` doing its job, and
     * it is why the window is walked rather than special-cased.
     * ========================================================================
     */
    const { ability, player, simulation } = caster(1_000);
    runPrecombat(simulation, player, [{ abilityId: ability.id, secondsBefore: 3 }]);

    expect(player.resources.get('mana')!.current).toBeCloseTo(9_000, 6);
    expect(player.lastSpentAt('mana')).toBe(-seconds(3));
  });

  it('leaves the lockout with its remainder to run, rather than all five seconds', () => {
    /*
     * THE HALF THAT IS INVISIBLE IN A POOL FIGURE. Before the ruling the stamp
     * sat at zero, so a caster that drank its Mage Armor 4.5 seconds early
     * arrived with the FULL five seconds still to run. It should have half a
     * second left, and that difference is four and a half seconds of
     * regeneration at the start of every fight.
     */
    const { ability, player, simulation } = caster(1_000);
    runPrecombat(simulation, player, [{ abilityId: ability.id, secondsBefore: 4.5 }]);

    const spentAt = player.lastSpentAt('mana')!;
    const clearsAt = spentAt + MANA_REGEN_LOCKOUT_MS;

    expect(spentAt).toBe(-4_500);
    expect(clearsAt, 'half a second into the fight, not five').toBe(500);
    // And it IS still locked at the pull, so the remainder is real.
    expect(player.spentWithin('mana', 0, MANA_REGEN_LOCKOUT_MS)).toBe(true);
    expect(player.spentWithin('mana', 600, MANA_REGEN_LOCKOUT_MS)).toBe(false);
  });

  it('credits a gap that the lockout does not reach', () => {
    /*
     * THE OTHER DIRECTION, so the two tests above cannot both pass on a rule
     * that simply credits nothing ever. A spend SIX seconds early is clear of
     * its own five second lockout one second before the pull, so that last
     * second regenerates.
     *
     * TWENTY-ONE TICKS AND NOT TWENTY, WHICH IS THE BOUNDARY AND WAS WORTH
     * GETTING WRONG ONCE. `spentWithin` asks `now - last < windowMs`, strictly
     * -- so the tick at EXACTLY five seconds after the spend is already free,
     * and a one-second tail at fifty milliseconds a tick carries the twenty
     * after it. The first draft of this test expected 9,100 by counting only
     * the tail; the engine said 9,105 and the engine was right.
     *
     * Written as the arithmetic rather than as 9,105 so it says WHY: five mana
     * a tick is `manaPer5` 500 times the 50ms-in-5s fraction.
     */
    const { ability, player, simulation } = caster(1_000);
    runPrecombat(simulation, player, [{ abilityId: ability.id, secondsBefore: 6 }]);

    const perTick = 500 * (50 / 5_000);
    expect(player.resources.get('mana')!.current).toBeCloseTo(9_000 + 21 * perTick, 6);
  });
});

describe('the owner’s own case', () => {
  it('opens the two Combat Rogues ten energy above their post-Flurry pool', () => {
    /*
     * BLADE FLURRY AT A ONE SECOND LEAD, which is the one opener in the project
     * that spends ENERGY before the pull -- every other energy spender sits at
     * `before(0, ...)`, where there is no pre-pull time left to regenerate in
     * and the ruling is academic.
     *
     * READ OFF A REAL FIGHT rather than computed, because the claim is the JOIN:
     * `Simulation.begin()` runs `onPrecombat` before `startResourceRegeneration`,
     * so a pool credited inside the former is the only regeneration that can
     * have happened by timestamp zero.
     */
    /*
     * 85 FOR AN UNDEAD, 90 FOR THE GNOME: Combat is a Gnome since round 78, and
     * Expansive Mind's +5% maximum energy makes its pool 105 -- so Blade
     * Flurry's 25 leaves 80 and the one-second lead banks the same ten.
     */
    const banked: Record<string, number> = { rogue_combat: 90, rogue_combat_mut: 85 };
    for (const presetId of ['rogue_combat', 'rogue_combat_mut']) {
      const profile = PRESETS_BY_ID.get(presetId)!.build();
      const simulation = new Simulation(trainingDummyEncounter(profile, 4242));
      simulation.begin();
      const player = simulation.combatants.find((actor) => actor.kind === 'player')!;

      const energy = player.resources.get('energy')!;
      expect(energy.current, `${presetId} banked the lead`).toBeCloseTo(banked[presetId], 6);
      expect(player.lastSpentAt('energy'), `${presetId} spent a second early`).toBe(-seconds(1));
    }
  });
});
