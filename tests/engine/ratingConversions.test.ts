import { describe, expect, it } from 'vitest';
import { RATING_PER_PERCENT, critChanceFrom, hasteMultiplierFrom } from '../../src/engine';
import { ITEMS } from '../../src/game/items/itemData';
import { makeStats } from '../../src/engine/stats/Stats';

/**
 * Forever's rating conversions, transcribed from the ruleset owner by hand.
 *
 * ----------------------------------------------------------------------------
 * WRITTEN OUT INDEPENDENTLY, which is this project's rule for a spec: a test
 * that reads the source constant passes no matter what the source constant
 * says. These eight numbers came from the owner in one message and are typed
 * out again here so that a change to `RATING_PER_PERCENT` has to be a change
 * somebody made on purpose.
 *
 * THEY REPLACED PLACEHOLDERS, and `statWeights.test.ts` had pinned one of
 * those -- it asserted haste at the invented 170 and failed when the real 10
 * arrived, which is a test failing on a change that made the project more
 * correct. The lesson is in that file; the spec lives here.
 * ----------------------------------------------------------------------------
 */
const OWNER_TABLE = {
  defense: 1,
  hit: 10,
  crit: 14,
  haste: 10,
  expertise: 10,
  dodge: 12,
  parry: 20,
  block: 5,
} as const;

describe("Forever's rating conversions", () => {
  it('matches the table the ruleset owner stated', () => {
    for (const [name, rating] of Object.entries(OWNER_TABLE)) {
      expect(RATING_PER_PERCENT[name as keyof typeof OWNER_TABLE]).toBe(rating);
    }
  });

  it('keeps mastery and versatility flagged as placeholders', () => {
    // Forever states neither and nothing in the ruleset grants either. They
    // keep the old invented numbers, and the day one of them is stated is the
    // day this assertion should fail.
    expect(RATING_PER_PERCENT.mastery).toBe(180);
    expect(RATING_PER_PERCENT.versatility).toBe(205);
  });

  it('turns 14 crit rating into one percentage point of crit', () => {
    // End to end through the engine's own reader rather than by dividing the
    // constant back out: a constant check cannot see a conversion applied in
    // the wrong place.
    const none = makeStats({ critChance: 0, critRating: 0 });
    const fourteen = makeStats({ critChance: 0, critRating: 14 });
    expect(critChanceFrom(fourteen) - critChanceFrom(none)).toBeCloseTo(0.01, 10);
  });

  it('turns 10 haste rating into one percent of haste', () => {
    expect(hasteMultiplierFrom(makeStats({ hasteRating: 10 }))).toBeCloseTo(1.01, 10);
  });
});

describe('Forever items carry their ratings onto the character', () => {
  /**
   * A REAL ITEM, END TO END, because the rules live in the item parser and a
   * table of constants says nothing about whether anything reads them.
   *
   * Premier High Warlord's Blade is "+24 Attack Power" and "+14 Critical
   * Strike Rating" -- so it should arrive as 14 rating, which is one point of
   * crit, and NOT as 14 points of crit.
   */
  it('stores crit as a rating, because something reads one', () => {
    const blade = ITEMS.find((item) => item.name === "Premier High Warlord's Blade");
    expect(blade).toBeDefined();
    expect(blade!.stats.critRating).toBe(14);
    expect(blade!.stats.critChance ?? 0).toBe(0);
    expect(blade!.stats.attackPower).toBe(24);
  });

  it('converts hit, which has no rating stat to land in', () => {
    // Ironwood Blade is "+10 Hit Rating", and 10 rating is one point of hit.
    const ironwood = ITEMS.find((item) => item.name === 'Ironwood Blade');
    expect(ironwood).toBeDefined();
    expect(ironwood!.stats.hitChance).toBeCloseTo(1, 10);
  });

  it('leaves no Forever rating line sitting in unmodelled', () => {
    /*
     * THE WHOLE POINT OF HAVING THE TABLE. Before the owner stated it, every
     * one of these lines would have been reported as an effect the simulator
     * cannot express -- correct, and 106 items' worth of correct-and-useless.
     */
    const stranded = ITEMS.flatMap((item) =>
      item.unmodelled
        .filter((effect) => / Rating$/.test(effect.text.replace(/\.$/, '')))
        .map((effect) => `${item.name}: ${effect.text}`),
    );
    expect(stranded).toEqual([]);
  });
});
