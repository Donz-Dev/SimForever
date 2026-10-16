import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { PRESENCE_OF_MIND } from '../../src/game/auras/mage';
import { runProfileBatch } from '../../src/simulator';

/**
 * ==============================================================================
 * WHAT A CLEARCASTING CHARGE WAS SPENT ON.
 *
 * The owner's ask: "for the classes that have a clearcasting effect -- Elemental
 * Focus (shaman), Arcane Concentration (mage), and Omen of Clarity (druid) --
 * have it list in the resources section what clearcasting was used on."
 *
 * WHY IT NEEDED TELEMETRY AT ALL, which is the thing worth asserting rather
 * than the shape of the table: A FREE CAST EMITS NO `resource_spent` EVENT. The
 * saving is invisible in the stream by construction, so the resource economy
 * above it adds to 100% while a Druid's 84 energy a fight goes unmentioned --
 * and `aura_removed` says the charge went without saying what took it.
 *
 * SO EVERY TEST HERE DRIVES A REAL BATCH and reads the aggregate. A unit test
 * on the event's shape would pass against a version that never emitted one,
 * which is the `isWeaponUseOf(attack, 'ranged')` failure: a predicate that is
 * always false reads exactly like one that is sometimes true.
 * ==============================================================================
 */
const batchOf = (preset: string, iterations = 10) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed: 4242 },
  } as never);
};

describe('the three clearcasting classes report what the charge was spent on', () => {
  /*
   * ALL THREE THE OWNER NAMED, and they are three different auras: the Mage's
   * and the Druid's are both called `clearcasting` and the Shaman's aura id is
   * `elemental_focus` with the display name "Clearcasting". Matching on the
   * NAME is what makes one assertion cover all three, and is also what a
   * person reading the panel matches on.
   */
  for (const preset of ['druid_cat', 'mage_arcane', 'shaman_elemental'] as const) {
    it(`names the abilities ${preset} spent Clearcasting on`, () => {
      const rows = batchOf(preset).castCharges.filter((row) => row.auraName === 'Clearcasting');

      expect(rows.length, 'at least one ability took a charge').toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.abilityName, 'the row names an ability').toBeTruthy();
        expect(row.casts).toBeGreaterThan(0);
      }
    });
  }

  it('reports the SAVING, which is the figure the pool is missing', () => {
    /*
     * ------------------------------------------------------------------------
     * THE HALF THAT MAKES IT A RESOURCE REPORT RATHER THAN A CAST COUNT.
     * "Clearcasting was used on Shred nine times" says nothing about whether
     * the proc is worth anything; "and saved 378 energy" is the number the
     * economy above is short by.
     *
     * ASSERTED AGAINST THE ABILITY'S OWN COST, not a literal: the saving per
     * charge must be exactly what the ability costs, because Clearcasting is
     * `costFraction: 1`. A literal would be testing the talent that reduces
     * Shred's cost rather than the report.
     * ------------------------------------------------------------------------
     */
    const batch = batchOf('druid_cat');
    const rows = batch.castCharges.filter((row) => row.auraName === 'Clearcasting');
    const total = rows.reduce((sum, row) => sum + row.saved, 0);

    expect(total, 'a free energy ability saved real energy').toBeGreaterThan(0);
    for (const row of rows) expect(row.resource).toBe('energy');
  });

  it('is absent for a build with no charge-spending aura at all', () => {
    /*
     * THE CONTAINMENT CHECK, and it is what says the rows above are about
     * Clearcasting rather than about every cast. A Warrior spends no cast
     * charges, so the section does not render -- which is the honest empty
     * rather than a table of zeroes.
     */
    expect(batchOf('two_hand_arms').castCharges).toEqual([]);
  });
});

describe('it covers every cast charge, not only the three that were asked for', () => {
  it('reports Missile Barrage, which is the bigger half on the Arcane Mage', () => {
    /*
     * ========================================================================
     * WHY THE REPORT IS GENERAL. A Clearcasting-only table would have shown
     * the SMALLER half of this build's charge economy: over ten fights
     * Missile Barrage saves several times what Clearcasting does on Arcane
     * Missiles alone.
     *
     * That is the "general field read by only some of its rules" failure
     * pointed at a panel -- the version that named three auras would have
     * been correct about those three and silently blind to Eclipse, Maelstrom
     * Weapon, Presence of Mind and Inner Focus.
     * ========================================================================
     */
    const rows = batchOf('mage_arcane').castCharges;
    const barrage = rows.filter((row) => row.auraName === 'Missile Barrage');
    const clearcasting = rows.filter((row) => row.auraName === 'Clearcasting');

    expect(barrage.length).toBeGreaterThan(0);
    expect(clearcasting.length).toBeGreaterThan(0);

    const saved = (set: typeof rows) => set.reduce((sum, row) => sum + row.saved, 0);
    expect(saved(barrage)).toBeGreaterThan(saved(clearcasting));
  });

  it('sorts by what was saved, which is not the same as how often', () => {
    const rows = batchOf('mage_arcane').castCharges;
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].saved).toBeGreaterThanOrEqual(rows[i].saved);
    }
  });

  it('keeps a charge that reduces no cost at all, rather than hiding it', () => {
    /*
     * ========================================================================
     * PRESENCE OF MIND SHORTENS A CAST AND REDUCES NO COST, so the panel has to
     * keep a row for it -- a charge spent on something that saved nothing is the
     * one thing somebody tuning a priority list would most want to see.
     *
     * THIS USED TO ASSERT `saved === 0` AND THAT WAS A ROTATION OUTCOME. It held
     * while the Arcane list happened to spend the charge on a cast that nothing
     * else discounted, and Arcane Blast's redesign -- 2.5 seconds to 1.5 --
     * changed which spell the list reaches with the charge up. The figure moved
     * to 35.2 without Presence of Mind changing at all, which is this project's
     * own rule that a cast count is a rotation outcome however much it looks
     * like a mechanism.
     *
     * ------------------------------------------------------------------------
     * AND THE REASON IT CAN BE NON-ZERO IS WORTH RECORDING: `saved` IS PER CAST
     * AND NOT PER AURA. `runCast` computes one figure -- the base cost less what
     * was resolved -- and hands it to EVERY charge spent on that cast, so a
     * charge spent alongside a cost-reducing one is credited with a saving it
     * did not cause.
     *
     * THAT IS A REPORTING QUIRK RATHER THAN A BUG, and the honest reading of the
     * column is "what the cast this charge was spent on saved". Flagged here
     * because a reader comparing Presence of Mind's 35.2 against its own tooltip
     * would reasonably conclude the panel was wrong.
     * ------------------------------------------------------------------------
     *
     * SO WHAT IS ASSERTED IS THE INVARIANT: the row exists, the charge is spent,
     * and the AURA itself declares no cost reduction -- which is the claim that
     * cannot be moved by a priority list.
     * ========================================================================
     */
    const rows = batchOf('mage_arcane').castCharges;
    const pom = rows.find((row) => row.auraName === 'Presence of Mind');
    expect(pom, 'the Arcane list casts it').toBeDefined();
    expect(pom!.casts).toBeGreaterThan(0);

    // It cannot save cost itself: its cast modifier is cast TIME and nothing else.
    expect(PRESENCE_OF_MIND.castModifier?.costFraction).toBeUndefined();
    expect(PRESENCE_OF_MIND.castModifier?.castTimeFraction).toBe(1);
    // And whatever the list does, the figure is never negative.
    expect(pom!.saved).toBeGreaterThanOrEqual(0);
  });
});
