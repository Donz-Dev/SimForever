import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { characterAtCombatStart } from '../../src/simulator';
import { ROGUE_HEMO, ROGUE_RUPTURE, rogueRotation } from '../../src/game/rotations/rogue';

const built = (id: string) => PRESETS_BY_ID.get(id)!.build();
const talentsOf = (id: string) =>
  (built(id) as unknown as { talents: Record<string, number> }).talents;

describe('the Hemo build', () => {
  /*
   * DECODED FROM THE OWNER'S URL rather than transcribed from a tree:
   * talentsforever.com/rogue/60/005303105-3-5320003301013211501-...
   *
   * A build coming back at other than 51 points, or throwing "X given N of M
   * ranks", means the tree on disk disagrees with the tree the URL was written
   * against -- and a WRONG tree does not always fail, so the total is asserted.
   */
  it('spends exactly 51 points, 17 / 3 / 31', () => {
    const talents = talentsOf('rogue_hemo');
    const total = Object.values(talents).reduce((a, b) => a + b, 0);
    expect(total).toBe(51);
  });

  it('takes Hemorrhage and NOT Cutthroat, which is what picks its list', () => {
    const talents = talentsOf('rogue_hemo');
    expect(talents.hemorrhage).toBe(1);
    expect(talents.cutthroat ?? 0).toBe(0);
    // And the Rupture build is the other way round on the second of those.
    expect(talentsOf('rogue_rupture').cutthroat).toBe(5);
  });

  it('drops the whole Backstab engine', () => {
    /*
     * THE REASON REMOVING THE ENTRY IS NOT A ROTATION PREFERENCE. Cutthroat is
     * Backstab's proc and Puncturing Wounds is its extra combo point and crit;
     * with both gone, Backstab is a 60-energy strike with nothing attached.
     */
    const talents = talentsOf('rogue_hemo');
    expect(talents.cutthroat ?? 0).toBe(0);
    expect(talents.puncturing_wounds ?? 0).toBe(0);
    expect(talents.ghostly_strike ?? 0).toBe(0);
  });

  it('matches the Rupture preset in every field except the talents', () => {
    /*
     * THE OWNER'S SPECIFICATION IS "EXACTLY THE SAME EXCEPT THESE TALENTS", and
     * a build is FIVE settings that have to agree -- class, playstyle, stance or
     * form, gear, and whether the target swings back. Checking them one by one is
     * the test that the new preset did not quietly inherit a different encounter
     * or a different weapon set.
     */
    const hemo = built('rogue_hemo');
    const rupture = built('rogue_rupture');
    expect(hemo.character.race).toBe(rupture.character.race);
    expect(hemo.character.characterClass).toBe(rupture.character.characterClass);
    expect(hemo.character.level).toBe(rupture.character.level);
    expect(hemo.character.combatStyle).toBe(rupture.character.combatStyle);
    expect(hemo.character.stance).toBe(rupture.character.stance);
    /*
     * THE SAME GEAR, SLOT BY SLOT AND STAT BY STAT, BUT NOT THE SAME ITEM IDS.
     *
     * Each benchmark template generates its OWN items -- the Hemo set is
     * numbered separately from the Rupture set -- so comparing the equipment
     * objects compares the id allocator and not the gear. The two templates are
     * identical in everything the budget reads (hit 120, expertise 10, the
     * Rogue preference order, leather, two daggers), so what has to match is
     * the stats, and a mismatch there is the thing this test exists to catch.
     */
    expect(Object.keys(hemo.equipment).sort()).toEqual(Object.keys(rupture.equipment).sort());
    for (const slot of Object.keys(hemo.equipment)) {
      const mine = ITEMS_BY_ID.get(
        (hemo.equipment as Record<string, { itemId: number }>)[slot].itemId,
      );
      const theirs = ITEMS_BY_ID.get(
        (rupture.equipment as Record<string, { itemId: number }>)[slot].itemId,
      );
      expect(mine?.stats, slot).toEqual(theirs?.stats);
      expect(mine?.weapon?.speed, slot).toBe(theirs?.weapon?.speed);
    }
    expect(hemo.raidBuffs).toEqual(rupture.raidBuffs);
    expect(hemo.encounter).toEqual(rupture.encounter);
    expect(hemo.talents).not.toEqual(rupture.talents);
  });

  it('holds two daggers, because Ambush needs one in the main hand', () => {
    const character = characterAtCombatStart(built('rogue_hemo') as never);
    expect(character).toBeDefined();
    expect(character!.weapons.mainHand?.weaponType).toBe('dagger');
    expect(character!.weapons.offHand?.weaponType).toBe('dagger');
  });
});

describe('the Hemo list', () => {
  const ids = ROGUE_HEMO.entries.map((entry) => entry.abilityId);

  it('has no Backstab at all', () => {
    expect(ids).not.toContain('backstab');
    // And the list it derives from still does.
    expect(ROGUE_RUPTURE.entries.map((e) => e.abilityId)).toContain('backstab');
  });

  it('is a list of its OWN now, and differs from Rupture in four places', () => {
    /*
     * ==========================================================================
     * IT WAS `ROGUE_RUPTURE.entries.filter(...)` AND THIS TEST ASSERTED THAT.
     *
     * The derivation was right while the two lists agreed on every number, and
     * it is what this project argues for everywhere else: two near-identical
     * lists maintained by hand DRIFT, and the drift is invisible, because an
     * entry is four lines and a difference reads as deliberate.
     *
     * IT IS ALSO WHY THIS PROFILE MOVED +10.4 ON NOBODY'S INSTRUCTION one
     * round ago, inheriting four Rupture changes it had never been given.
     *
     * THE OWNER HAS NOW GIVEN IT ITS OWN NUMBERS, and they differ in every one
     * of the four places the two lists overlap. A derivation that has to
     * override four of eleven entries is a copy with extra steps, and the
     * overrides are exactly where the two would drift -- so it is a list.
     *
     * WHAT THIS TEST DOES NOW IS NAME THE DIFFERENCES, so a future edit that
     * quietly re-aligns one of them has to say so.
     * ==========================================================================
     */
    const gate = (list: typeof ROGUE_HEMO, abilityId: string) =>
      JSON.stringify(list.entries.find((e) => e.abilityId === abilityId)?.condition);

    // Rupture: three points here, four there, and no Hemorrhage clause here.
    expect(gate(ROGUE_HEMO, 'rupture')).toContain('"points":3');
    expect(gate(ROGUE_RUPTURE, 'rupture')).toContain('"points":4');
    expect(gate(ROGUE_HEMO, 'rupture')).not.toContain('hemorrhage');
    expect(gate(ROGUE_RUPTURE, 'rupture')).toContain('hemorrhage');

    // Eviscerate: EXACTLY five here against four or more there, and a
    // four-second floor against six.
    expect(gate(ROGUE_HEMO, 'eviscerate')).toContain('"compare":"exactly","points":5');
    expect(gate(ROGUE_RUPTURE, 'eviscerate')).toContain('"compare":"atLeast","points":4');
    expect(gate(ROGUE_HEMO, 'eviscerate')).toContain('"seconds":4');
    expect(gate(ROGUE_RUPTURE, 'eviscerate')).toContain('"seconds":6');

    // And Cold Blood is in this list and in no other Subtlety one -- the
    // talent is new on this build, paid for out of Improved Slice and Dice.
    expect(ids).toContain('cold_blood');
    expect(ROGUE_RUPTURE.entries.map((e) => e.abilityId)).not.toContain('cold_blood');
  });

  it('shares its SHAPE with the Rupture list, which is still the point', () => {
    /*
     * The numbers diverged and the skeleton did not: both open with
     * Premeditation, both put Ambush above Vanish so the sequence emerges from
     * the priorities, and both end with Preparation over a filler. Asserted
     * because "it is its own list now" is the kind of change that invites
     * someone to reorder it freely.
     */
    const order = (list: typeof ROGUE_HEMO, abilityId: string) =>
      list.entries.findIndex((e) => e.abilityId === abilityId);
    for (const list of [ROGUE_HEMO, ROGUE_RUPTURE]) {
      expect(order(list, 'premeditation')).toBe(0);
      expect(order(list, 'ambush')).toBeLessThan(order(list, 'vanish'));
      expect(order(list, 'slice_and_dice')).toBeLessThan(order(list, 'rupture'));
      expect(order(list, 'rupture')).toBeLessThan(order(list, 'eviscerate'));
      expect(order(list, 'preparation')).toBeGreaterThan(order(list, 'eviscerate'));
    }
  });

  it('puts Hemorrhage last and ungated, as the filler', () => {
    /*
     * +108.9, AND THE GATE'S JUSTIFICATION WENT WITH BACKSTAB. The Rupture list
     * gates Hemorrhage on its own debuff because there "it MAINTAINS and Backstab
     * BUILDS" -- correct while something else was building, and it made Hemorrhage
     * a floor that starved the entries beneath it. Here there is nothing beneath
     * it, so the floor costs nothing and the building has to come from somewhere.
     *
     * Ungated it wastes 272.7 fewer energy a fight; the specification as first
     * written threw away a third of the profile's income.
     */
    expect(ids[ids.length - 1]).toBe('hemorrhage');
    expect(ROGUE_HEMO.entries[ROGUE_HEMO.entries.length - 1].condition).toBeUndefined();
    // The Rupture list's own Hemorrhage is still gated.
    expect(ROGUE_RUPTURE.entries.find((e) => e.abilityId === 'hemorrhage')?.condition).toBeDefined();
  });

  it('names no ability twice', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('which list a Subtlety Rogue runs', () => {
  /*
   * ============================================================================
   * HEMORRHAGE NO LONGER SEPARATES THE TWO SUBTLETY BUILDS -- both take it,
   * because both are built around it. Cutthroat is the discriminator, and it is a
   * FUNCTIONAL one: Cutthroat is the Rupture list's only in-combat route to
   * Ambush, so a Hemorrhage build without it cannot run that list's Backstab
   * engine at all.
   *
   * `rotationFor` dispatches on five different patterns across nine classes and a
   * Shockadin once ran a list built around a talent it does not take for its whole
   * life without erroring. A claim about which list a build runs is worth a test.
   * ============================================================================
   */
  it('sends a Hemorrhage build WITH Cutthroat to the Rupture list', () => {
    expect(rogueRotation({ hemorrhage: 1, cutthroat: 5 }).name).toContain('Rupture');
  });

  it('sends a Hemorrhage build WITHOUT Cutthroat to the Hemo list', () => {
    expect(rogueRotation({ hemorrhage: 1 }).name).toContain('Hemo');
  });

  it('sends Mutilate to Venom only WITH the Venom capstone', () => {
    /*
     * ==========================================================================
     * THIS ASSERTED `mutilate -> Venom` FULL STOP, AND A SECOND MUTILATE BUILD
     * MADE THAT WRONG. Combat Mut takes Mutilate and Seal Fate and spends on
     * Eviscerate; it does NOT take the Venom capstone, and the Venom list's
     * second entry is the Venom finisher.
     *
     * A LIST THAT NAMES AN ABILITY THE BUILD CANNOT CAST IS SKIPPED IN SILENCE,
     * so the wrong answer here is the kind that produces an ordinary DPS figure
     * -- which this project has shipped twice, as a Fire Mage running the Arcane
     * list and a Shockadin running a list built around a talent it does not take.
     *
     * MUTILATE STILL WINS OVER HEMORRHAGE, which is the existing order and the
     * half of this test that did not change.
     * ==========================================================================
     */
    expect(rogueRotation({ mutilate: 1, venom: 1, hemorrhage: 1 }).name).toContain('Venom');
    expect(rogueRotation({ mutilate: 1, hemorrhage: 1 }).name).toContain('Combat Mut');
    expect(rogueRotation({ adrenaline_rush: 1 }).name).toContain('Combat');
  });

  it('routes each of the five presets to its own list', () => {
    const listFor = (id: string) =>
      rogueRotation(talentsOf(id) as Readonly<Record<string, number>>).name;
    expect(listFor('rogue_venom')).toContain('Venom');
    expect(listFor('rogue_combat')).toContain('Combat');
    expect(listFor('rogue_rupture')).toContain('Rupture');
    expect(listFor('rogue_hemo')).toContain('Hemo');
    // The fifth, and the one that forced the capstone clause into the dispatch.
    expect(listFor('rogue_combat_mut')).toContain('Combat Mut');
  });
});
