import { describe, expect, it } from 'vitest';
import type { AuraDefinition, Combatant } from '../../src/engine';
import { dealDamage, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ============================================================================
 * TWO PER-SCHOOL FIELDS ON AN AURA, AND WHAT EACH ONE IS FOR.
 *
 *   `damageDoneBySchool`             the ATTACKER's side. "Increases your Fire
 *                                    damage by 15%", from an effect that comes
 *                                    and goes -- which `SchoolModifiers` cannot
 *                                    hold, because it is built once when the
 *                                    character is.
 *   `periodicDamageTakenBySchool`    the TARGET's side, and a TICK only.
 *                                    "Increasing the damage they take from your
 *                                    other Shadow damage over time effects."
 *
 * BOTH WERE ASKED FOR BY NAME BEFORE THEY EXISTED. `game/auras/warrior.ts`
 * predicted the first for Death Wish's "Physical" qualifier, and Wrack's own
 * `unmodelled` reason named the second -- a plain Shadow vulnerability would
 * also raise Shadow Bolt, which is over half of the SM/DS profile's damage.
 *
 * THE SPEC IS WRITTEN OUT HERE BY HAND rather than read off the Warlock's
 * auras, so this fails when the ENGINE is wrong and not when a talent moves.
 * ============================================================================
 */

const FIRE_BUFF: AuraDefinition = {
  id: 'fire_buff',
  name: 'Fire Buff',
  durationMs: seconds(60),
  damageDoneBySchool: { fire: 1.15 },
};

const SHADOW_BUFF: AuraDefinition = {
  id: 'shadow_buff',
  name: 'Shadow Buff',
  durationMs: seconds(60),
  damageDoneBySchool: { shadow: 1.1 },
};

const BLANKET_BUFF: AuraDefinition = {
  id: 'blanket_buff',
  name: 'Blanket Buff',
  durationMs: seconds(60),
  damageDoneMultiplier: 1.2,
};

const OVER_TIME_VULNERABILITY: AuraDefinition = {
  id: 'over_time_vulnerability',
  name: 'Over Time Vulnerability',
  durationMs: seconds(60),
  isDebuff: true,
  periodicDamageTakenBySchool: { shadow: 1.1 },
};

const EVERY_HIT_VULNERABILITY: AuraDefinition = {
  id: 'every_hit_vulnerability',
  name: 'Every Hit Vulnerability',
  durationMs: seconds(60),
  isDebuff: true,
  damageTakenBySchool: { shadow: 1.2 },
};

/** One unavoidable hit of a school, with no crit and no armor. */
function hit(
  attackerAuras: readonly AuraDefinition[],
  targetAuras: readonly AuraDefinition[],
  school: 'fire' | 'shadow',
  periodic: boolean,
): number {
  const attacker: Combatant = makeAttacker();
  const target: Combatant = makeTarget();
  const simulation = buildSimulation([attacker, target]);
  for (const aura of attackerAuras) simulation.applyAura(attacker, aura, attacker.id);
  for (const aura of targetAuras) simulation.applyAura(target, aura, attacker.id);

  // No `attackTable` and no `critFrom`: it lands flatly, so the only thing
  // moving the number is the multiplier under test.
  return dealDamage(simulation, {
    source: attacker,
    target,
    abilityId: 'probe',
    abilityName: 'Probe',
    school,
    baseAmount: 1000,
    periodic,
    appliesArmor: false,
  }).amount;
}

describe('damageDoneBySchool, the attacker side', () => {
  it('raises the school it names and leaves the other alone', () => {
    expect(hit([FIRE_BUFF], [], 'fire', false)).toBeCloseTo(1150, 6);
    expect(hit([FIRE_BUFF], [], 'shadow', false)).toBeCloseTo(1000, 6);
  });

  it('SHADOW AND FLAME IS THE SHAPE: two halves, opposite schools, one each', () => {
    /*
     * ------------------------------------------------------------------------
     * THIS IS THE BUG THE FIELD WAS BUILT FOR, written out as arithmetic.
     * Shadow and Flame gives +10% Shadow when Conflagrate lands and +10% Fire
     * when Shadowburn does, and the Firelock profile holds both for most of a
     * fight. As two whole-character multipliers that is 1.1 x 1.1 = x1.21 on
     * EVERY school; as two per-school ones it is x1.1 on each.
     *
     * A TEN PERCENT OVERSTATEMENT OF THE THIRD-HIGHEST PROFILE IN THE PROJECT,
     * and the code carried a comment admitting it was "generous for a hybrid,
     * which Firelock is".
     * ------------------------------------------------------------------------
     */
    expect(hit([FIRE_BUFF, SHADOW_BUFF], [], 'fire', false)).toBeCloseTo(1150, 6);
    expect(hit([FIRE_BUFF, SHADOW_BUFF], [], 'shadow', false)).toBeCloseTo(1100, 6);
  });

  it('multiplies with the blanket multiplier rather than replacing it', () => {
    // "+20% damage done" and "+15% Fire damage" are different effects.
    expect(hit([FIRE_BUFF, BLANKET_BUFF], [], 'fire', false)).toBeCloseTo(1380, 6);
    expect(hit([FIRE_BUFF, BLANKET_BUFF], [], 'shadow', false)).toBeCloseTo(1200, 6);
  });
});

describe('periodicDamageTakenBySchool, the target side', () => {
  it('reaches a TICK and not a cast, which is the whole point', () => {
    /*
     * The reason this is not `damageTakenBySchool` with a flag: Wrack amplifies
     * "your other Shadow damage OVER TIME effects", and a plain Shadow
     * vulnerability would also raise Shadow Bolt. These two assertions are that
     * distinction and nothing else.
     */
    expect(hit([], [OVER_TIME_VULNERABILITY], 'shadow', true)).toBeCloseTo(1100, 6);
    expect(hit([], [OVER_TIME_VULNERABILITY], 'shadow', false)).toBeCloseTo(1000, 6);
  });

  it('leaves a tick of another school alone', () => {
    expect(hit([], [OVER_TIME_VULNERABILITY], 'fire', true)).toBeCloseTo(1000, 6);
  });

  it('applies ALONGSIDE the every-hit field rather than instead of it', () => {
    /*
     * An aura may carry both, and a target under one of each is under both. The
     * first implementation read them with `??`, which silently dropped the
     * second -- and the comment beside it claimed the opposite, which is the
     * failure mode this assertion exists for.
     */
    expect(
      hit([], [OVER_TIME_VULNERABILITY, EVERY_HIT_VULNERABILITY], 'shadow', true),
    ).toBeCloseTo(1320, 6);
    // A cast gets the every-hit one only.
    expect(
      hit([], [OVER_TIME_VULNERABILITY, EVERY_HIT_VULNERABILITY], 'shadow', false),
    ).toBeCloseTo(1200, 6);
  });
});
