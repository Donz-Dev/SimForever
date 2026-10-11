import { describe, expect, it } from 'vitest';
import {
  COMBAT_THISTLE_TEA_ENERGY_THRESHOLD,
  CONSUMABLE_COOLDOWNS,
  THISTLE_TEA_ENERGY_THRESHOLD,
  TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
  consumableCooldowns,
  thistleTeaCooldown,
} from '../../src/game/rotations/consumableCooldowns';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';

/*
 * ============================================================================
 * THE GATES ON THE SHARED MID-FIGHT CONSUMABLE ENTRIES.
 *
 * `CONSUMABLE_COOLDOWNS` is spread into every one of the 26 lists, so a number
 * in it is a number in all of them -- and the ruleset owner has now given
 * THREE different Thistle Tea gates: twenty shared, fifteen on the Combat
 * Rogue, ten on the Venom Rogue.
 *
 * A SHARED FRAGMENT HOLDS ONE VALUE, so the gate is a PARAMETER rather than a
 * moved constant, and this file is the one place the whole map is asserted.
 *
 * IT LIVES HERE RATHER THAN IN A ROTATION FILE for the reason the food row's
 * test moved into `consumables.test.ts`: it is a claim about a SHARED THING
 * rather than about any one list, and writing it per list means one ruling
 * fails several files and the set has to be edited in each. Two copies of a
 * set is how the two drift.
 * ============================================================================
 */

/** Every profile that drinks Thistle Tea, and the gate it drinks at. */
const THISTLE_TEA_GATES: Readonly<Record<string, number>> = {
  rogue_venom: TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
  rogue_rupture: TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
  // Combat Mut has its own list and the owner gave it the same ten.
  rogue_combat_mut: TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
  // Pure Hemo spreads the Hemo Dagger build, so it carries the same ten.
  rogue_pure_hemo: TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
  rogue_combat: COMBAT_THISTLE_TEA_ENERGY_THRESHOLD,
  /*
   * ==========================================================================
   * THE HEMO ROGUE WAS NOT RESPECIFIED AND INHERITS THE RUPTURE GATE ANYWAY,
   * because `ROGUE_HEMO` IS the Rupture list's entries minus two of them:
   * `...ROGUE_RUPTURE.entries.filter(...)`.
   *
   * THAT IS THE DERIVATION WORKING RATHER THAN LEAKING. The list is defined as
   * "the Rupture build with the Backstab engine taken out", so a change to
   * what it is derived FROM reaching it is the point -- the alternative is a
   * hand-written copy of eleven entries, which is the shape this project keeps
   * paying for.
   *
   * IT IS STILL A PROFILE MOVING ON NOBODY'S INSTRUCTION, which is why it is
   * written down here rather than left for somebody to find in a figure. The
   * Thistle Tea gate is the cheapest of the inherited changes; the Slice and
   * Dice point gate, Hemorrhage's position and the Eviscerate floors come with
   * it.
   * ==========================================================================
   */
  rogue_hemo: TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
  // The one carrier that is not a Rogue, and the only one still on twenty.
  druid_cat: THISTLE_TEA_ENERGY_THRESHOLD,
};

const gateOf = (presetId: string) => {
  const entry = PRESETS_BY_ID.get(presetId)!
    .build()
    .rotation.entries.find((e) => e.abilityId === 'thistle_tea');
  return (entry?.condition as { amount?: number } | undefined)?.amount;
};

describe('the Thistle Tea gate', () => {
  it('is three different numbers, and each one is the owner’s', () => {
    // And FOUR of the five drinkers are on a respecified one now, three of
    // them by instruction and the Hemo Rogue by derivation. See the map.
    expect(THISTLE_TEA_ENERGY_THRESHOLD).toBe(20);
    expect(COMBAT_THISTLE_TEA_ENERGY_THRESHOLD).toBe(15);
    expect(TIGHT_THISTLE_TEA_ENERGY_THRESHOLD).toBe(10);
    // THREE of the five drinkers are named and they hold TWO numbers, which is
    // what settles the parameter: no move of the shared constant fits them.
  });

  it('reaches exactly the profile it was given for', () => {
    for (const [presetId, gate] of Object.entries(THISTLE_TEA_GATES)) {
      expect(gateOf(presetId), presetId).toBe(gate);
    }
  });

  it('names every profile that drinks it, so the map cannot go stale', () => {
    /*
     * THE SET IS DERIVED AND COMPARED, not written out twice. A fifth profile
     * taking Thistle Tea -- or one of these five dropping it -- would otherwise
     * leave this file asserting a gate for a build that no longer has one, and
     * saying nothing about the new one.
     */
    const drinkers = PROFILE_PRESETS.filter((preset) =>
      preset.build().rotation.entries.some((entry) => entry.abilityId === 'thistle_tea'),
    ).map((preset) => preset.id);
    expect([...drinkers].sort()).toEqual(Object.keys(THISTLE_TEA_GATES).sort());
  });

  it('leaves the other 24 lists byte-identical to the shared default', () => {
    /*
     * `CONSUMABLE_COOLDOWNS` IS THE FUNCTION CALLED WITH NOTHING, which is what
     * makes the override safe: adding a parameter to a fragment every list
     * spreads could have moved 25 figures, and this is the assertion that it
     * did not.
     */
    expect(CONSUMABLE_COOLDOWNS).toEqual(consumableCooldowns());
    expect(CONSUMABLE_COOLDOWNS.map((entry) => entry.abilityId)).toContain('thistle_tea');
  });
});

describe('a stock entry cannot disagree with its own note', () => {
  /*
   * ============================================================================
   * THE OWNER'S SCREENSHOTS SHOW ONE THAT DOES, and it is not a bug in the data
   * -- it is what editing a condition in the panel does. A note is a FROZEN
   * STRING stored on the entry, so changing the gate from 20 to 10 leaves the
   * row explaining a gate it no longer has.
   *
   * NOTHING HERE CAN FIX A HAND-EDITED ENTRY. What this asserts is that a STOCK
   * list is self-consistent, so the only way to see a note disagree with its
   * gate is to have edited it yourself -- which is the difference between a
   * confusing display and a wrong one.
   * ============================================================================
   */
  it('builds the Thistle Tea note from the gate the condition uses', () => {
    for (const [presetId, gate] of Object.entries(THISTLE_TEA_GATES)) {
      const entry = PRESETS_BY_ID.get(presetId)!
        .build()
        .rotation.entries.find((e) => e.abilityId === 'thistle_tea')!;
      expect(entry.note, presetId).toContain(`Under ${gate} is the compromise`);
    }
  });

  it('does the same for an entry a list places itself', () => {
    // `thistleTeaCooldown` is the one entry a list can position by hand, which
    // is how the Combat Rogue puts it above its racials. It has to carry the
    // same guarantee or the split would be the way the two drift.
    const placed = thistleTeaCooldown(7);
    expect(JSON.stringify(placed.condition)).toContain('"amount":7');
    expect(placed.note).toContain('Under 7 is the compromise');
    // And with no argument it is the shared entry exactly.
    expect(thistleTeaCooldown()).toEqual(
      CONSUMABLE_COOLDOWNS.find((entry) => entry.abilityId === 'thistle_tea'),
    );
  });
});

describe('excluding an entry removes it and nothing else', () => {
  it('drops only what it is asked to', () => {
    const full = consumableCooldowns().map((entry) => entry.abilityId);
    const without = consumableCooldowns({ exclude: ['thistle_tea'] }).map((e) => e.abilityId);
    expect(without).toEqual(full.filter((id) => id !== 'thistle_tea'));
  });

  it('leaves the Combat list holding every entry exactly once', () => {
    /*
     * THE FAILURE THE SPLIT INVITES is an entry appearing TWICE -- placed by
     * hand and then spread again -- which `PriorityRotation` would run as two
     * entries and which reads on the page as one list with a duplicate row.
     * A duplicate id is legal here on purpose (the Mage's Arcane Missiles), so
     * nothing else would object.
     */
    const ids = PRESETS_BY_ID.get('rogue_combat')!
      .build()
      .rotation.entries.map((entry) => entry.abilityId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
