import { describe, expect, it } from 'vitest';
import type { Ability } from '../../src/engine';
import { HASTED_GCD_FLOOR_MS, RATING_PER_PERCENT, castAbility } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 75: HASTE SHORTENS THE GLOBAL COOLDOWN, TO A FLOOR OF ONE SECOND. The
 * owner's: "Haste effects reduce the global cooldown triggered by spells ...
 * Haste effects are not Flurry, Rapid Fire, etc that specifically apply to
 * weapon swing speed ... Haste can reduce the global cooldown from 1.5 sec to a
 * floor of 1.0 seconds."
 * ==============================================================================
 */

const rating = (percent: number) => percent * RATING_PER_PERCENT.haste;

const instant: Ability = {
  id: 'instant',
  name: 'Instant',
  attackTable: 'spell',
  onCast: () => {},
};

function gcdAfterCast(stats: Record<string, number>, baseGcdMs?: number): number {
  const caster = makeAttacker({ autoAttack: 'none', abilities: [instant], stats });
  if (baseGcdMs !== undefined) (caster as { baseGcdMs: number }).baseGcdMs = baseGcdMs;
  const target = makeTarget();
  const simulation = buildSimulation([caster, target]);
  simulation.begin();
  castAbility(simulation, caster, caster.abilities.get('instant')!, target);
  return caster.gcdReadyAt;
}

describe('the global cooldown under haste', () => {
  it('is 1.5s with no haste', () => {
    expect(gcdAfterCast({})).toBe(1500);
  });

  it('divides by the haste multiplier', () => {
    expect(gcdAfterCast({ hasteRating: rating(20) })).toBe(1250);
    expect(gcdAfterCast({ hasteRating: rating(10) })).toBe(Math.round(1500 / 1.1));
  });

  it('stops at one second however much haste there is', () => {
    expect(HASTED_GCD_FLOOR_MS).toBe(1000);
    expect(gcdAfterCast({ hasteRating: rating(50) })).toBe(1000);
    expect(gcdAfterCast({ hasteRating: rating(200) })).toBe(1000);
  });

  it('leaves a one-second global cooldown where it is', () => {
    // A Rogue's or a Cat's: already at the floor, and haste cannot take it under.
    expect(gcdAfterCast({ hasteRating: rating(30) }, 1000)).toBe(1000);
  });

  it('is not shortened by swing speed', () => {
    // Flurry, Slice and Dice, Rapid Fire: attack speed, not haste.
    expect(gcdAfterCast({ attackSpeedRating: rating(30) })).toBe(1500);
  });
});
