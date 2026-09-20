import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { legalAllocation, isLegal } from '../../src/game/talents/talentRules';
import { talentsForClass } from '../../src/game/talents/talentData';
import { legalise } from '../helpers/legalTalents';

/*
 * An illegal allocation grants nothing.
 *
 * The UI refuses an illegal click, so a build made by hand has always been
 * legal. A profile loaded from JSON goes nowhere near the UI, and nothing
 * checked it: one point in Mortal Strike -- a 31-point capstone that also
 * requires Sweeping Strikes -- handed over the ability. Every rule was already
 * written down in `talentRules`, and nothing called it.
 *
 * Prerequisites transcribed by hand from the Forever calculator:
 *   Mortal Strike  <- 1 point in Sweeping Strikes
 *   Bloodthirst    <- 1 point in Death Wish
 *   Shield Slam    <- 1 point in Concussion Blow
 *   Flurry         <- 5 points in Enrage
 */

const warrior = talentsForClass('warrior')!;

describe('an illegal allocation grants nothing', () => {
  it('refuses Mortal Strike to a warrior who spent one point on it', () => {
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      talents: { mortal_strike: 1 },
    });
    expect(player.abilities.has('mortal_strike')).toBe(false);
  });

  it('grants it to a warrior who actually earned it', () => {
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      talents: legalise({ mortal_strike: 1 }),
    });
    expect(player.abilities.has('mortal_strike')).toBe(true);
  });

  it('refuses a capstone whose PREREQUISITE is missing, tier met', () => {
    /*
     * The tier gate alone is not the rule. This build has thirty points in
     * Arms, so Mortal Strike's tier is satisfied -- and it skips Sweeping
     * Strikes, which Mortal Strike also requires.
     */
    const tierButNoPrereq = {
      improved_heroic_strike: 3,
      deflection: 5,
      improved_rend: 3,
      improved_charge: 2,
      improved_tactical_mastery: 5,
      improved_overpower: 2,
      anger_management: 1,
      deep_wounds: 3,
      spearing_strike: 1,
      impale: 2,
      bloodthrill: 3,
      mortal_strike: 1,
    };
    expect(isLegal(warrior, tierButNoPrereq)).toBe(false);

    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      talents: tierButNoPrereq,
    });
    expect(player.abilities.has('mortal_strike')).toBe(false);
  });
});

describe('legalAllocation', () => {
  it('drops a talent whose tier is not met and reports it', () => {
    const { allocation, dropped } = legalAllocation(warrior, { death_wish: 1 });
    expect(dropped).toContain('death_wish');
    expect(allocation.death_wish).toBeUndefined();
  });

  /*
   * THE CASCADE, which is why this iterates rather than filtering once.
   * Dropping a talent lowers the points in its tree, which can take another
   * below its own tier gate. A single pass would return an allocation that is
   * still illegal and now looks checked.
   */
  it('keeps dropping until what is left is actually legal', () => {
    const cascading = {
      improved_heroic_strike: 3,
      deflection: 5,
      improved_rend: 3, // 11 legal points at tier 0
      anger_management: 1, // tier 10: legal on 11 points, but needs Imp Tactical Mastery 5
      deep_wounds: 3, // tier 10: legal on 11 points, but needs Improved Rend 3 -- it has it
    };
    const { allocation } = legalAllocation(warrior, cascading);
    expect(isLegal(warrior, allocation)).toBe(true);
    expect(allocation.anger_management).toBeUndefined();
  });

  it('leaves a legal allocation alone', () => {
    const legal = legalise({ mortal_strike: 1 });
    const { allocation, dropped } = legalAllocation(warrior, legal);
    expect(dropped).toEqual([]);
    expect(allocation).toEqual(legal);
  });

  it('drops a talent that does not exist at all', () => {
    const { dropped } = legalAllocation(warrior, { not_a_talent: 3 });
    expect(dropped).toContain('not_a_talent');
  });
});
