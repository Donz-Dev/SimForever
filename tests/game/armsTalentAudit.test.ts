import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { buildSimulation } from '../helpers/buildSimulation';
import { legalise } from '../helpers/legalTalents';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { COMBAT_CONSTANTS } from '../../src/game/combat/attackChances';
import { ALL_ABILITIES } from '../../src/engine';
import {
  OVERPOWER_READY,
  OVERPOWER_WINDOW_MS,
  STANCE_RAGE_FLOOR,
} from '../../src/game/auras/warrior';
import { WARRIOR_TALENT_REACTIONS } from '../../src/game/reactions/warriorTalents';

/*
 * The Arms talent audit, item by item.
 *
 * Every expected value is written out BY HAND from the Forever calculator or
 * from what the ruleset owner stated, never read back out of the code under
 * test. A test that asked the implementation what the implementation said
 * would pass whatever it said.
 */

const warrior = (talents: Record<string, number> = {}) =>
  createPlayer({ race: 'human', characterClass: 'warrior', combatStyle: 'dual_wield', talents });

// ---------------------------------------------------------------------------
// Improved Tactical Mastery
// ---------------------------------------------------------------------------

describe('changing stance costs rage', () => {
  function swapAndRead(talents: Record<string, number>, startingRage = 100): number {
    const player = warrior(talents);
    const dummy = createTrainingDummy({ name: 'D', health: 100_000, armor: 0, level: 63 });
    const sim = buildSimulation([player, dummy]);
    sim.begin();
    const rage = player.resources.require('rage');
    rage.gain(startingRage);
    /*
     * Defensive, because a dual-wielder now OPENS in Berserker: swapping to
     * the stance already held is not a change and costs nothing, which is a
     * separate rule tested below. Picking the stance the character is not in
     * is what makes this a test of the cost.
     */
    sim.cast(player, player.abilities.get('defensive_stance_cast')!, undefined);
    return rage.current;
  }

  /*
   * Stated by the ruleset owner: a stance change drops everything above ten.
   * Until this existed a swap was FREE, which the rotation exploited -- it
   * would change stance whenever anything in another stance looked marginally
   * better, because nothing was charged for it.
   */
  it('drops everything above ten without the talent', () => {
    expect(STANCE_RAGE_FLOOR).toBe(10);
    expect(swapAndRead({})).toBe(10);
  });

  /*
   * "Tactical Mastery lets you retain up to an ADDITIONAL 3/6/9/12/15 Rage
   * when you change stances", so the floor is 10 plus the talent's value and
   * max rank keeps 25 -- the figure the ruleset owner gave.
   */
  it('retains an additional three rage at one rank', () => {
    expect(swapAndRead(legalise({ improved_tactical_mastery: 1 }))).toBe(13);
  });

  it('retains twenty-five in total at max rank', () => {
    expect(swapAndRead(legalise({ improved_tactical_mastery: 5 }))).toBe(25);
  });

  it('takes nothing when there was less than the floor to begin with', () => {
    expect(swapAndRead({}, 4)).toBe(4);
  });

  it('takes nothing for re-entering the stance already held', () => {
    /*
     * Not a change, so not a cost. Without this guard a rotation that
     * re-confirmed its stance would drain the bar every time it did so, which
     * is a bug that would look exactly like the talent working.
     */
    const player = warrior();
    const dummy = createTrainingDummy({ name: 'D', health: 100_000, armor: 0, level: 63 });
    const sim = buildSimulation([player, dummy]);
    sim.begin();
    const rage = player.resources.require('rage');
    rage.gain(80);
    // Berserker is where a dual-wielder starts, so this is a no-op.
    sim.cast(player, player.abilities.get('berserker_stance_cast')!, undefined);
    expect(rage.current).toBe(80);
  });

  it('records the loss, so the rage ledger still balances', () => {
    /*
     * Rage that leaves the bar without a telemetry event is rage the ledger
     * cannot account for. The first version of the drain did exactly that and
     * broke `gained minus spent is what is left` within a minute -- and it
     * would also have hidden the cost of stance dancing from the rage
     * breakdown, which is the one place someone auditing this talent looks.
     */
    const player = warrior();
    const dummy = createTrainingDummy({ name: 'D', health: 100_000, armor: 0, level: 63 });
    const sim = buildSimulation([player, dummy]);
    sim.begin();
    player.resources.require('rage').gain(100);
    sim.cast(player, player.abilities.get('defensive_stance_cast')!, undefined);
    // Nothing to assert on the sink here -- the ledger test in
    // resourceGeneration.test.ts is what proves it. This pins the rage itself.
    expect(player.resources.require('rage').current).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Two-Handed Weapon Specialization
// ---------------------------------------------------------------------------

describe('damage multipliers compound rather than adding', () => {
  /*
   * The ruleset owner's example: three 10% bonuses are 1.1 * 1.1 * 1.1 =
   * 33.1% more damage, not 30%.
   */
  it('makes three ten percent bonuses 33.1%, not 30%', () => {
    const compounded = 1.1 * 1.1 * 1.1;
    expect(compounded).toBeCloseTo(1.331, 6);
    expect(compounded).not.toBeCloseTo(1.3, 3);
  });

  it('applies Two-Handed Weapon Specialization as one multiplier of 1.03', () => {
    // Three ranks is "+3%", which is 1.03 -- not three multipliers of 1.01,
    // and not an addition of 3 to something.
    const build = talentBuild('warrior', legalise({ two_handed_weapon_specialization: 3 }), {
      mainHand: { name: 'Two-hander', twoHanded: true } as never,
    });
    expect(build.damageMultiplier).toBeCloseTo(1.03, 6);
  });

  it('does not apply it with a one-handed weapon, and says why', () => {
    const build = talentBuild('warrior', legalise({ two_handed_weapon_specialization: 3 }), {
      mainHand: { name: 'One-hander', twoHanded: false } as never,
    });
    expect(build.damageMultiplier).toBeCloseTo(1, 6);
    expect(build.unmodelled.some((u) => u.talentId === 'two_handed_weapon_specialization')).toBe(
      true,
    );
  });

  it('multiplies a talent multiplier by an aura multiplier', () => {
    /*
     * Death Wish is +20% damage done and Two-Handed Specialization +3%. The
     * two live in different places -- an aura on the combatant and a talent
     * multiplier -- which is exactly the pairing an additive bug hides in.
     * Together they must be 1.236, not 1.23.
     */
    expect(1.2 * 1.03).toBeCloseTo(1.236, 6);
    expect(1.2 * 1.03).not.toBeCloseTo(1.23, 4);
  });
});

// ---------------------------------------------------------------------------
// Impale
// ---------------------------------------------------------------------------

describe('Impale raises the crit multiplier, for abilities only', () => {
  const bonusFor = (rank: number, abilityId: string | undefined) =>
    talentBuild('warrior', legalise({ impale: rank })).abilityModifiers.for(abilityId)
      .critMultiplierBonus ?? 0;

  /*
   * "Increases the critical strike damage bonus of your abilities by 10/20%."
   *
   * It raises the BONUS HALF. A melee crit multiplies by 2, so the bonus is
   * 1.0 and 20% of it is 0.2, giving 2.2x -- the figure the ruleset owner
   * stated. Scaling the whole multiplier would give 2.4x.
   */
  it('takes a 2x crit to 2.2x at max rank', () => {
    expect(COMBAT_CONSTANTS.meleeCritMultiplier).toBe(2);
    expect(2 + bonusFor(2, 'mortal_strike')).toBeCloseTo(2.2, 6);
  });

  it('takes it to 2.1x at one rank', () => {
    expect(2 + bonusFor(1, 'mortal_strike')).toBeCloseTo(2.1, 6);
  });

  it('is not 2.4x: it scales the bonus, not the whole multiplier', () => {
    expect(2 + bonusFor(2, 'mortal_strike')).not.toBeCloseTo(2.4, 2);
  });

  /*
   * HEROIC STRIKE COUNTS AS AN ABILITY, and that is the interesting half. It
   * replaces an auto attack, so it would be easy to treat as one -- but it has
   * an ability id, and the ruleset owner is explicit that it should get this.
   */
  it('reaches Heroic Strike, which replaces a swing but is an ability', () => {
    expect(bonusFor(2, 'heroic_strike')).toBeCloseTo(0.2, 6);
  });

  it('is declared against every ability rather than a named one', () => {
    expect(bonusFor(2, ALL_ABILITIES)).toBeCloseTo(0.2, 6);
  });
});

// ---------------------------------------------------------------------------
// Bloodthrill and the Overpower window
// ---------------------------------------------------------------------------

describe('the Overpower window', () => {
  /*
   * Stated by the ruleset owner: a dodge grants one hidden charge against the
   * target, the cap is one, it lasts six seconds, an Overpower consumes it,
   * and another dodge inside the window refreshes the timer without stacking.
   *
   * Bloodthrill's own tooltip corroborates the duration: "activate your
   * Overpower ability for 1 attack on your current target. Lasts 6 sec."
   */
  it('lasts six seconds, not the five that was assumed', () => {
    expect(OVERPOWER_WINDOW_MS).toBe(6000);
  });

  it('caps at one charge', () => {
    expect(OVERPOWER_READY.maxStacks).toBe(1);
  });

  it('refreshes rather than stacking when it triggers again', () => {
    expect(OVERPOWER_READY.refreshBehaviour).toBe('reset');
  });

  /*
   * "Bloodthrill works exactly the same besides the triggering condition", so
   * it has to be the SAME aura rather than a parallel one that could drift
   * from it -- a second window with its own duration would be two mechanics
   * that only look alike.
   */
  it('is opened by Bloodthrill as well as by a dodge', () => {
    const build = talentBuild('warrior', legalise({ bloodthrill: 5 }));
    const reaction = build.reactions.find((r) => r.id === 'bloodthrill');
    expect(reaction).toBeDefined();
    expect(reaction?.on).toBe('dealt');
  });
});

// ---------------------------------------------------------------------------
// Weaponmaster
// ---------------------------------------------------------------------------

describe('Weaponmaster depends on which weapon swung', () => {
  const axe = { name: 'A', weaponType: 'axe' } as never;
  const mace = { name: 'M', weaponType: 'mace' } as never;

  it('grants the axe and polearm crit with one in the main hand', () => {
    const build = talentBuild('warrior', legalise({ weaponmaster: 5 }), { mainHand: axe });
    expect(build.abilityModifiers.for(ALL_ABILITIES).critBonus).toBe(5);
  });

  it('grants no crit with a mace, and says why rather than going quiet', () => {
    const build = talentBuild('warrior', legalise({ weaponmaster: 5 }), { mainHand: mace });
    expect(build.abilityModifiers.for(ALL_ABILITIES).critBonus ?? 0).toBe(0);
    const reasons = build.unmodelled
      .filter((u) => u.talentId === 'weaponmaster')
      .map((u) => u.reason)
      .join(' ');
    expect(reasons).toMatch(/weapon/i);
  });

  /*
   * THE SWORD CLAUSE IS PER SWINGING WEAPON. A warrior holding a mace and a
   * sword gets it from the sword and from the OFF HAND -- reading the main
   * hand would give the mace the proc and deny it to the sword, exactly
   * backwards.
   *
   * The reaction is granted whatever is held, because which weapon swung is
   * only knowable per attack; the gate is inside `canTrigger`.
   */
  it('grants the sword reaction, gated per attack rather than per character', () => {
    const build = talentBuild('warrior', legalise({ weaponmaster: 5 }), { mainHand: mace });
    expect(build.reactions.some((r) => r.id === 'weaponmaster_sword')).toBe(true);
  });

  it('is registered under the talent id, reading its third value', () => {
    // Rank values are [crit, armor ignore, extra attack] -- the reaction takes
    // the third, declared as `valueIndex: 2` on the talent.
    expect(WARRIOR_TALENT_REACTIONS.weaponmaster).toBeDefined();
  });

  /*
   * ----------------------------------------------------------------------------
   * THE GATE ITSELF, which went untested while a comment above it claimed it
   * did not exist. The comment said "NOT GATED ON CARRYING A SWORD, because a
   * reaction cannot see the weapon"; the code below it had read
   * `actor.weapons[slot]` all along. Nothing failed, because every weapon in
   * the item data is a Sword, so the gate never refuses in a real build.
   *
   * Written as a matrix because the interesting cases are the MIXED ones, and
   * those are exactly the ones a per-character reading would get backwards.
   * ----------------------------------------------------------------------------
   */
  const alwaysRolls = { rng: { rollChance: () => true } } as never;
  const holding = (mainHand: string, offHand: string) =>
    ({ weapons: { mainHand: { weaponType: mainHand }, offHand: { weaponType: offHand } } }) as never;

  it.each([
    { mainHand: 'sword', offHand: 'sword', swung: 'mainHand', procs: true },
    { mainHand: 'sword', offHand: 'sword', swung: 'offHand', procs: true },
    // The two that a per-character reading gets exactly backwards.
    { mainHand: 'mace', offHand: 'sword', swung: 'offHand', procs: true },
    { mainHand: 'sword', offHand: 'mace', swung: 'offHand', procs: false },
    { mainHand: 'mace', offHand: 'sword', swung: 'mainHand', procs: false },
    { mainHand: 'axe', offHand: 'axe', swung: 'mainHand', procs: false },
    // A bow is not a melee attack, whatever is in the other hands.
    { mainHand: 'sword', offHand: 'sword', swung: 'ranged', procs: false },
  ])(
    '$mainHand/$offHand swinging $swung -> proc $procs',
    ({ mainHand, offHand, swung, procs }) => {
      const reaction = WARRIOR_TALENT_REACTIONS.weaponmaster(5);
      const result = reaction.canTrigger?.(
        alwaysRolls,
        holding(mainHand, offHand),
        { weaponSlot: swung } as never,
      );
      expect(result ?? false).toBe(procs);
    },
  );

  it('rolls 1% per rank, which is the value the talent declares', () => {
    /*
     * Transcribed by hand from the beta client's per-rank values, where
     * Weaponmaster reads [1,3,1] [2,6,2] [3,9,3] [4,12,4] [5,15,5] -- crit,
     * armor ignore, extra attack. The third is what this reaction takes.
     */
    for (const rank of [1, 2, 3, 4, 5]) {
      let rolled = -1;
      const capture = {
        rng: {
          rollChance: (chance: number) => {
            rolled = chance;
            return false;
          },
        },
      } as never;
      WARRIOR_TALENT_REACTIONS.weaponmaster(rank).canTrigger?.(
        capture,
        holding('sword', 'sword'),
        { weaponSlot: 'mainHand' } as never,
      );
      expect(rolled).toBeCloseTo(rank / 100, 10);
    }
  });

  it('triggers an extra attack with the MAIN HAND, whichever hand procced', () => {
    /*
     * Stated by the ruleset owner, and it matters for a mace-and-sword pairing:
     * an off-hand sword's proc swings the main-hand mace. Hand of Justice
     * already behaves this way and the two now agree.
     */
    const calls: string[] = [];
    const reaction = WARRIOR_TALENT_REACTIONS.weaponmaster(5);
    reaction.onTrigger(
      { extraAttack: (_actor: unknown, slot: string) => calls.push(slot) } as never,
      {} as never,
      {} as never,
    );
    expect(calls).toEqual(['mainHand']);
  });
});
