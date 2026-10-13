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

/* -------------------------------------------------------------------------- */

describe('a tier counts points BELOW it, and nothing in it', () => {
  /*
   * ============================================================================
   * MEASURED AGAINST talentsforever.com, WHICH IS WHY THESE FIGURES ARE EXACT
   * RATHER THAN A READING.
   *
   * `requirementsMet` asked `pointsInTree(...) < talent.tier` against the WHOLE
   * allocation, so a talent's own ranks -- and its neighbours' in the same row
   * -- counted towards opening the row they sit in. A talent could help open
   * its own tier.
   *
   * THE CASE THAT SEPARATES THE TWO READINGS IS A TREE THAT STOPS AT THE TIER
   * IT IS SPENDING IN, which is what an optimiser produces and no hand-written
   * build does -- every preset in the project satisfies the strict rule anyway.
   * It was found by pasting a generated build URL into the calculator, which is
   * the only place the real rule is written down.
   *
   * Paladin Holy is the worked example because its tier 15 is cheap to reach:
   *
   *   14 below tier 15 + Divine Favor   the site refunds the point:
   *                                     "Divine Favor -- Requires 15 points in
   *                                     Holy -- 1 back"
   *   15 below tier 15 + Divine Favor   accepted, "Points left: 0"
   *
   * AND A SECOND POINT IN THE SAME ROW DOES NOT HELP EITHER: 14 below tier 15
   * plus a point in Infusion of Light AND one in Divine Favor came back with
   * BOTH refunded, not one.
   * ============================================================================
   */
  const paladin = talentsForClass('paladin')!;

  const below = {
    divine_strength: 5,
    divine_intellect: 5,
    improved_seals: 3,
  };

  it('refuses a tier-15 talent with fourteen points below it', () => {
    const { allocation, dropped } = legalAllocation(paladin, {
      ...below,
      spiritual_focus: 1, // 14 below tier 15
      divine_favor: 1,
    });
    expect(dropped).toContain('divine_favor');
    expect(allocation.divine_favor).toBeUndefined();
  });

  it('allows it with fifteen', () => {
    const { allocation, dropped } = legalAllocation(paladin, {
      ...below,
      spiritual_focus: 2, // 15 below tier 15
      divine_favor: 1,
    });
    expect(dropped).toEqual([]);
    expect(allocation.divine_favor).toBe(1);
  });

  it('does not let a neighbour in the SAME row help', () => {
    // Infusion of Light and Divine Favor are both tier 15. Fourteen below them
    // and a point in each: the site refunds both, so both must be dropped here.
    const { dropped } = legalAllocation(paladin, {
      ...below,
      spiritual_focus: 1,
      infusion_of_light: 1,
      divine_favor: 1,
    });
    expect(dropped).toContain('divine_favor');
    expect(dropped).toContain('infusion_of_light');
  });

  it('still opens row 1 on five points in row 0, which both readings agree on', () => {
    /*
     * THE EXAMPLE THE OLD COMMENT CITED FOR THE WRONG RULE, kept because it is
     * true and because it is exactly why the wrong rule survived: it does not
     * distinguish the two readings.
     */
    expect(isLegal(paladin, { divine_strength: 5, improved_seals: 1 })).toBe(true);
  });
});
