import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
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

  it('keeps a charge that saved nothing, rather than hiding it', () => {
    /*
     * Presence of Mind shortens a cast and reduces no cost, so it reports a
     * charge spent and zero saved. That is the honest answer AND the shape a
     * charge thrown away on a free ability takes -- which is the one thing
     * somebody tuning a priority list would most want to see.
     */
    const rows = batchOf('mage_arcane').castCharges;
    const pom = rows.find((row) => row.auraName === 'Presence of Mind');
    expect(pom, 'the Arcane list casts it').toBeDefined();
    expect(pom!.casts).toBeGreaterThan(0);
    expect(pom!.saved).toBe(0);
  });
});
