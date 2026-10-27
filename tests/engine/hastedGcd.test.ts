import { describe, expect, it } from 'vitest';
import type { Ability } from '../../src/engine';
import { HASTED_GCD_FLOOR_MS, RATING_PER_PERCENT, castAbility, isSpellForGcd } from '../../src/engine';
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

function gcdAfterCast(stats: Record<string, number>, baseGcdMs?: number, ability: Ability = instant): number {
  const caster = makeAttacker({ autoAttack: 'none', abilities: [ability], stats });
  if (baseGcdMs !== undefined) (caster as { baseGcdMs: number }).baseGcdMs = baseGcdMs;
  const target = makeTarget();
  const simulation = buildSimulation([caster, target]);
  simulation.begin();
  castAbility(simulation, caster, caster.abilities.get(ability.id)!, target);
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

/*
 * ==============================================================================
 * ROUND 81: ONLY A SPELL'S. The owner, asked whether "the global cooldown
 * triggered by spells" reached melee and ranged abilities too: spells only.
 * Reaching everything put a 2% hasted Windshaper Bear on a 1.471s cooldown, so
 * its 6s Primal Bite stopped lining up with four of them and came ~1.4s late a
 * cycle -- and the Tauren beside it, with no haste, out-damaged it.
 * ==============================================================================
 */
describe("haste reaches only a SPELL's global cooldown (round 81)", () => {
  const strike: Ability = { id: 'strike', name: 'Strike', attackTable: 'melee-special', onCast: () => {} };
  const shot: Ability = { id: 'shot', name: 'Shot', attackTable: 'ranged-special', onCast: () => {} };
  const shout: Ability = {
    id: 'shout',
    name: 'Shout',
    cost: { resource: 'rage', amount: 10 },
    onCast: () => {},
  };
  const heal: Ability = {
    id: 'heal',
    name: 'Heal',
    cost: { resource: 'mana', amount: 100 },
    onCast: () => {},
  };
  const freeSpell: Ability = { id: 'free_spell', name: 'Free spell', spell: true, onCast: () => {} };

  it('reads a melee strike, a shot and a rage shout as not spells', () => {
    for (const ability of [strike, shot, shout]) expect(isSpellForGcd(ability)).toBe(false);
  });

  it('reads a spell-table cast, a mana cost with no table and a declared free spell as spells', () => {
    for (const ability of [instant, heal, freeSpell]) expect(isSpellForGcd(ability)).toBe(true);
  });

  it('keeps a strike at 1.5s and hastes a free spell, cast under the same 20% haste', () => {
    /*
     * Cast for real, since the derivation being right and the GCD path asking
     * it are two halves. The costed fixtures are left to the two reads above:
     * this helper's attacker owns no rage or mana pool to pay from.
     */
    expect(gcdAfterCast({ hasteRating: rating(20) }, undefined, strike)).toBe(1500);
    expect(gcdAfterCast({ hasteRating: rating(20) }, undefined, freeSpell)).toBe(1250);
  });

  it("lets a declaration override the derivation either way", () => {
    expect(isSpellForGcd({ ...strike, spell: true })).toBe(true);
    expect(isSpellForGcd({ ...heal, spell: false })).toBe(false);
  });
});
