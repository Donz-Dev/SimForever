import { describe, expect, it } from 'vitest';
import type { AttackOutcome } from '../../src/engine';
import { grantGeneratedResource } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import {
  BEAR_FORM_CRIT_RAGE_MULTIPLIER,
  RAGE_FROM_BEAR_PAW,
  RAGE_PER_SECOND_ONE_HAND,
  RAGE_PER_SECOND_TWO_HAND,
  WARRIOR_CRIT_RAGE_MULTIPLIER,
  critRageMultiplierFor,
  rageFromSwing,
} from '../../src/game/combat/resourceRules';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { runProfileBatch, resourceFlowOf } from '../../src/simulator';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * A CRITICAL SWING PAYS MORE RAGE, new at client build 1.60.1.70170.
 *
 * Two figures and nothing else is stated:
 *
 *   Warrior  "Players now generate 100% increased Rage when landing a critical
 *            strike with a basic attack."
 *   Druid    "Bear Form and Dire Bear Form now generate 75% increased Rage when
 *            landing a Critical Strike."
 *
 * TWO MULTIPLIERS AND NOT ONE WITH AN EXCEPTION, which the owner confirmed: 2.0
 * and 1.75, read independently, rather than 1.75 stacking on a class-wide 2.0
 * that the word "Players" invites.
 *
 * ------------------------------------------------------------------------------
 * EVERY TEST HERE IS ON THE MECHANISM AND NOT ON A DPS DELTA, because this is a
 * change to what a character can AFFORD rather than to what anything hits for --
 * so the honest measure is the rage, and a damage figure that moved would be the
 * rotation reaching further rather than the rule working.
 *
 * AND THE ONE THING THAT COULD BE QUIETLY WRONG IS THE `perDamage` HALF. A crit
 * has already doubled the damage, so multiplying a damage-proportional award as
 * well pays the bonus twice -- a bigger number and no error. Forever's two rage
 * rules split exactly along that line: rage from DEALING damage is flat per
 * swing, rage from TAKING it is per damage. Both are asserted below.
 * ==============================================================================
 */

const award = (outcome: AttackOutcome, multiplier: number, amount = 500) => {
  const actor = makeAttacker({
    resources: [{ type: 'rage', maximum: 100, initial: 0 }],
    critResourceMultiplier: multiplier,
  });
  const simulation = buildSimulation([actor, makeTarget()]);
  grantGeneratedResource(
    simulation,
    actor,
    { resource: 'rage', flat: 10, requiresDamage: true },
    amount,
    undefined,
    outcome === 'crit',
  );
  return actor.resources.require('rage').current;
};

describe('the engine rule', () => {
  it('multiplies a flat award on a crit and leaves every other outcome alone', () => {
    expect(award('crit', 2)).toBe(20);
    for (const outcome of ['hit', 'glance', 'crush', 'block'] as const) {
      expect(award(outcome, 2), outcome).toBe(10);
    }
  });

  it('defaults to 1, so nothing changes for a combatant that states no figure', () => {
    const plain = makeAttacker({ resources: [{ type: 'rage', maximum: 100, initial: 0 }] });
    expect(plain.critResourceMultiplier).toBe(1);
    expect(award('crit', 1)).toBe(10);
  });

  it('still refuses an award whose damage never landed', () => {
    /*
     * `requiresDamage` is checked BEFORE the multiplier, which is the ordering
     * that matters: a crit for zero is not a thing a combat table produces, but
     * the two rules are independent and a reader should not have to work out
     * which one wins.
     */
    expect(award('crit', 2, 0)).toBe(0);
  });

  it('does NOT multiply the damage-proportional half', () => {
    /*
     * THE ONE THING THAT WOULD HAVE BEEN A BIGGER NUMBER AND NO ERROR. Rage from
     * TAKING damage is `D x 10 / H`, so a crit has already doubled D by the time
     * the award is computed -- multiplying here as well pays twice.
     */
    const actor = makeAttacker({
      resources: [{ type: 'rage', maximum: 100, initial: 0 }],
      critResourceMultiplier: 2,
    });
    const simulation = buildSimulation([actor, makeTarget()]);

    grantGeneratedResource(
      simulation,
      actor,
      { resource: 'rage', perDamage: 0.02 },
      500,
      undefined,
      true,
    );
    expect(actor.resources.require('rage').current).toBe(10);
  });
});

describe('the two figures, which are the ruleset', () => {
  it('is 2.0 for a Warrior, whatever it is holding', () => {
    expect(WARRIOR_CRIT_RAGE_MULTIPLIER).toBe(2);
    for (const style of ['two_hander', 'dual_wield', 'one_hand_shield'] as const) {
      expect(critRageMultiplierFor('warrior', style), style).toBe(2);
    }
  });

  it('is 1.75 for a Bear Druid and 1 for the other two forms', () => {
    expect(BEAR_FORM_CRIT_RAGE_MULTIPLIER).toBe(1.75);
    expect(critRageMultiplierFor('druid', 'bear')).toBe(1.75);
    // A Cat and a Moonkin OWN a rage pool and have nothing that fills it from a
    // swing, and Forever states the increase for the bear forms only.
    expect(critRageMultiplierFor('druid', 'cat')).toBe(1);
    expect(critRageMultiplierFor('druid', 'moonkin')).toBe(1);
  });

  it('is 1 for every other class, including the two that own a rage pool clause', () => {
    for (const cls of ['paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock'] as const) {
      expect(critRageMultiplierFor(cls, undefined), cls).toBe(1);
    }
  });

  it('reaches the built character, not just the rule', () => {
    /*
     * THE JOIN, which is the half that has been missing twice in this project --
     * `armorPenetration` shipped declared, granted and read by nothing. Grepping
     * for the constant would have passed; building a character is what says the
     * number arrives.
     */
    const warrior = createPlayer({
      race: 'orc',
      characterClass: 'warrior',
      combatStyle: 'two_hander',
    });
    const bear = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'bear' });
    const cat = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'cat' });
    const mage = createPlayer({ race: 'gnome', characterClass: 'mage', combatStyle: 'caster' });

    expect(warrior.critResourceMultiplier).toBe(2);
    expect(bear.critResourceMultiplier).toBe(1.75);
    expect(cat.critResourceMultiplier).toBe(1);
    expect(mage.critResourceMultiplier).toBe(1);
  });
});

describe('what it does not change', () => {
  it('leaves the per-swing award itself alone, so haste still cancels', () => {
    /*
     * `rage = R x S` every `S` seconds is `R` per second, so a weapon's speed
     * cancels and haste raises nothing. That argument is about the BASE award and
     * is untouched by this patch -- which is worth pinning, because the crit
     * multiplier is the first thing in this file that makes a FASTER weapon earn
     * more: a crit rate is per swing, so more swings collect it more often.
     */
    expect(rageFromSwing(2.6, false).flat).toBeCloseTo(RAGE_PER_SECOND_ONE_HAND * 2.6, 10);
    expect(rageFromSwing(3.4, true).flat).toBeCloseTo(RAGE_PER_SECOND_TWO_HAND * 3.4, 10);
    expect(RAGE_FROM_BEAR_PAW.flat).toBeCloseTo(RAGE_PER_SECOND_ONE_HAND * 2.5, 10);
    for (const generation of [rageFromSwing(2.6, false), RAGE_FROM_BEAR_PAW]) {
      expect(generation.requiresDamage).toBe(true);
      expect(generation.perDamage).toBeUndefined();
    }
  });
});

describe('in a real fight', () => {
  const rageFromSwings = (presetId: string) => {
    const built = PRESETS_BY_ID.get(presetId)!.build();
    const batch = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 60, seed: 77 },
    } as never);
    const flow = resourceFlowOf(batch, 'rage');
    const swing = flow.gained.filter((row) => row.sourceId.startsWith('auto_attack_'));
    /*
     * GROSS, NOT NET. `amount` is what landed in the pool after the cap, and a
     * warrior caps constantly -- so reading it would measure how full the bar was
     * rather than what a swing paid, and would hide the whole change.
     */
    return {
      total: swing.reduce((sum, row) => sum + row.amount + row.wasted, 0),
      rows: swing.length,
    };
  };

  it('pays a 2H Arms warrior more than its flat rate would, and the gap is its crit rate', () => {
    /*
     * ------------------------------------------------------------------------
     * THE MEASURED CHECK, because the unit tests above cannot see whether the
     * outcome reaches `grantGeneratedResource` at all -- the Hunter's Deadly
     * Aspects passed a unit test on its branch while asking a predicate that was
     * always false, and 403 ranged swings produced zero procs of a stated 10%.
     *
     * WHAT IS ASSERTED IS A RANGE AND NOT A FIGURE: swing rage must now exceed
     * the un-multiplied `R x S` per swing, and by less than double -- which is
     * the whole interval the crit rate can produce. A build at 30% crit collects
     * about 1.3x; a build at 0% would collect exactly 1.0 and a build at 100%
     * exactly 2.0, and neither is reachable.
     * ------------------------------------------------------------------------
     */
    const { total, rows } = rageFromSwings('two_hand_arms');
    expect(rows).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);

    const built = PRESETS_BY_ID.get('two_hand_arms')!.build();
    const batch = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 60, seed: 77 },
    } as never);
    const main = batch.abilities.find((row) => row.abilityName === 'Main Hand Auto-Attack')!;
    const landed = main.hits;
    const flat = rageFromSwing(3.4, true).flat!;

    expect(total).toBeGreaterThan(landed * flat);
    expect(total).toBeLessThan(landed * flat * 2);
  }, 20_000);
});
