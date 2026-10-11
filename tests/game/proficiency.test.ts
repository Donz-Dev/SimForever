import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../../src/game/character/ids';
import type { ClassId } from '../../src/game/character/ids';
import {
  CLASS_PROFICIENCIES,
  PROFICIENCIES,
  hasProficiency,
  proficiencyForItem,
  type Proficiency,
} from '../../src/game/character/proficiency';
import { ARMOUR_CLASS_SLOTS, canEquip } from '../../src/game/items/equipRules';
import { ITEMS, itemsForSlot } from '../../src/game/items/itemData';
import type { EquipmentSlot, Item } from '../../src/game/items/Item';
import { PROFILE_PRESETS } from '../../src/profiles/presets';

/*
 * ==============================================================================
 * THE OWNER'S PROFICIENCY TABLE, TRANSCRIBED A SECOND TIME.
 *
 * Written out here as the 27 columns the owner supplied them in, against the
 * source's own `TRUE`/`FALSE`, where `CLASS_PROFICIENCIES` stores each row as
 * a list of what is true. **That is the point**: two different shapes of the
 * same fact, so a transcription error has to be made twice in two different
 * forms to survive. This file is what a reader diffs against the spreadsheet,
 * row by row and column by column.
 *
 * It is this project's standing rule for captured data -- "write the spec out
 * independently in the test", because a test that reads the source data passes
 * no matter what the source data says.
 * ==============================================================================
 */
const COLUMNS = [
  'block', 'parry',
  'bow', 'gun', 'crossbow', 'thrown',
  'cloth', 'leather', 'mail', 'plate', 'shield',
  'dual_wield', 'dagger', 'fist', 'axe_1h', 'mace_1h', 'sword_1h',
  'polearm', 'staff', 'axe_2h', 'mace_2h', 'sword_2h',
  'wand', 'totem', 'libram', 'idol', 'feral_combat',
] as const satisfies readonly Proficiency[];

const T = true;
const F = false;

/** The owner's rows, in the owner's column order. */
const TABLE: Readonly<Record<ClassId, readonly boolean[]>> = {
  //        bl par bow gun cbw thr clo lea mai pla shi  dw dag fst ax1 mc1 sw1 pol stf ax2 mc2 sw2 wnd tot lib idl fer
  warrior: [ T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  T,  F,  F,  F,  F,  F],
  warlock: [ F,  F,  F,  F,  F,  F,  T,  F,  F,  F,  F,  F,  T,  F,  F,  F,  T,  F,  T,  F,  F,  F,  T,  F,  F,  F,  F],
  shaman:  [ T,  F,  F,  F,  F,  F,  T,  T,  T,  F,  T,  F,  T,  T,  T,  T,  F,  F,  T,  T,  T,  F,  F,  T,  F,  F,  F],
  rogue:   [ F,  T,  T,  T,  T,  T,  T,  T,  F,  F,  F,  T,  T,  T,  T,  T,  T,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F],
  priest:  [ F,  F,  F,  F,  F,  F,  T,  F,  F,  F,  F,  F,  T,  F,  F,  T,  F,  F,  T,  F,  F,  F,  T,  F,  F,  F,  F],
  paladin: [ T,  T,  F,  F,  F,  F,  T,  T,  T,  T,  T,  F,  F,  F,  T,  T,  T,  T,  F,  T,  T,  T,  F,  F,  T,  F,  F],
  mage:    [ F,  F,  F,  F,  F,  F,  T,  F,  F,  F,  F,  F,  T,  F,  F,  F,  T,  F,  T,  F,  F,  F,  T,  F,  F,  F,  F],
  hunter:  [ F,  T,  T,  T,  T,  T,  T,  T,  T,  F,  F,  T,  T,  T,  T,  F,  T,  T,  T,  T,  F,  T,  F,  F,  F,  F,  F],
  druid:   [ F,  F,  F,  F,  F,  F,  T,  T,  F,  F,  F,  F,  F,  T,  F,  T,  F,  T,  T,  F,  T,  F,  F,  F,  F,  T,  T],
};

describe('the proficiency table is the owner s, column for column', () => {
  it('covers every column the owner supplied, and nothing else', () => {
    expect([...PROFICIENCIES].sort()).toEqual([...COLUMNS].sort());
  });

  it.each(CLASS_IDS)('%s matches the spreadsheet row', (characterClass) => {
    const row = TABLE[characterClass];
    expect(row).toHaveLength(COLUMNS.length);
    const mismatched = COLUMNS.filter(
      (column, index) => hasProficiency(characterClass, column) !== row[index],
    );
    expect(mismatched).toEqual([]);
  });

  it('stores each row as a list of what is TRUE, with no duplicates', () => {
    for (const characterClass of CLASS_IDS) {
      const row = CLASS_PROFICIENCIES[characterClass];
      expect(new Set(row).size).toBe(row.length);
    }
  });
});

/*
 * ==============================================================================
 * THE THREE ROWS THAT ARE NOT CLASSIC'S.
 *
 * Pinned by name, loudly, because each is a place a reader who knows Classic
 * would "fix" the table back. They are the reason this was asked rather than
 * inferred: a Classic proficiency table would have been wrong in BOTH
 * directions on the Rogue, which is the class the owner used as the example.
 * ==============================================================================
 */
describe('where Forever disagrees with Classic', () => {
  it('lets a Rogue hold a one-handed axe', () => {
    expect(hasProficiency('rogue', 'axe_1h')).toBe(true);
  });

  it('does NOT let a Druid hold a dagger', () => {
    expect(hasProficiency('druid', 'dagger')).toBe(false);
  });

  it('lets a Hunter hold a two-handed axe and no mace of either size', () => {
    expect(hasProficiency('hunter', 'axe_2h')).toBe(true);
    expect(hasProficiency('hunter', 'mace_1h')).toBe(false);
    expect(hasProficiency('hunter', 'mace_2h')).toBe(false);
  });
});

describe('an item is matched to the proficiency it demands', () => {
  it('reads a one-handed and a two-handed axe as different columns', () => {
    expect(proficiencyForItem('One-Hand', 'Axe', false)).toBe('axe_1h');
    expect(proficiencyForItem('Two-Hand', 'Axe', false)).toBe('axe_2h');
    // A `Main Hand` axe is one-handed too, which `slots` alone cannot say.
    expect(proficiencyForItem('Main Hand', 'Axe', false)).toBe('axe_1h');
  });

  it('reads a thrown weapon off the inventory type, because its subclass is null', () => {
    expect(proficiencyForItem('Thrown', undefined, false)).toBe('thrown');
  });

  /*
   * THE CLOAK, which is the trap this whole function exists around. All 44
   * cloaks in the data carry the subclass "Cloth" and every class wears one.
   * Reading the subclass without asking which SLOT it is for would have left
   * eight classes with no back slot at all -- and it would have looked exactly
   * like a correct filter.
   */
  it('does not apply an armour class outside the eight armour slots', () => {
    expect(proficiencyForItem('Back', 'Cloth', false)).toBeUndefined();
    expect(proficiencyForItem('Chest', 'Cloth', true)).toBe('cloth');
    expect(ARMOUR_CLASS_SLOTS.has('cloak')).toBe(false);
    expect(ARMOUR_CLASS_SLOTS.size).toBe(8);
  });

  it('lets anyone wear jewellery, which has no subclass at all', () => {
    expect(proficiencyForItem('Finger', undefined, false)).toBeUndefined();
    expect(proficiencyForItem('Trinket', undefined, false)).toBeUndefined();
    expect(proficiencyForItem('Held In Off-hand', undefined, false)).toBeUndefined();
  });

  it('is permissive about a word it does not know', () => {
    // "Cosmetic" is one head item in the data, and a future capture will add
    // more shapes. A filter that hides what it cannot explain is the one kind
    // of bug that leaves nothing behind to notice.
    expect(proficiencyForItem('Head', 'Cosmetic', true)).toBeUndefined();
  });
});

describe('dual wield is a rule about the SLOT, not about the item', () => {
  const oneHandSword = ITEMS.find(
    (item) => item.inventoryType === 'One-Hand' && item.subclass === 'Sword',
  )!;
  const shield = ITEMS.find((item) => item.subclass === 'Shield')!;
  const heldOffHand = ITEMS.find((item) => item.inventoryType === 'Held In Off-hand')!;

  it('lets a Paladin hold a one-handed sword in the MAIN hand only', () => {
    expect(canEquip('paladin', oneHandSword, 'mainHand')).toBe(true);
    expect(canEquip('paladin', oneHandSword, 'offHand')).toBe(false);
    expect(canEquip('warrior', oneHandSword, 'offHand')).toBe(true);
  });

  it('does not treat a shield or a held off-hand item as a second weapon', () => {
    // Both sit in the off hand and neither swings, so neither asks for dual
    // wield -- the shield asks for `shield` and the held item asks for nothing.
    expect(canEquip('paladin', shield, 'shield')).toBe(true);
    expect(canEquip('paladin', heldOffHand, 'offHand')).toBe(true);
    expect(canEquip('rogue', shield, 'shield')).toBe(false);
  });
});

/*
 * ==============================================================================
 * THE CONTAINMENT CHECK: a filter must not hide what a preset already wears.
 *
 * This is the half that would be invisible otherwise. A proficiency row that
 * is wrong by one column takes an item out of a list, and an item missing from
 * a list looks exactly like an item that is not in the database -- there is no
 * zero anywhere and nothing to count. All 25 presets passing says the table
 * agrees with 25 builds the owner specified by hand.
 * ==============================================================================
 */
describe('the filter hides nothing any preset is wearing', () => {
  it.each(PROFILE_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s wears only items its class may equip',
    (_id, preset) => {
      const profile = preset.build();
      const illegal: string[] = [];
      for (const [slot, equipped] of Object.entries(profile.equipment)) {
        if (!equipped) continue;
        const item = ITEMS.find((candidate) => candidate.id === equipped.itemId);
        if (!item) continue;
        if (!canEquip(profile.character.characterClass, item, slot as EquipmentSlot)) {
          illegal.push(`${slot}: ${item.name}`);
        }
      }
      expect(illegal).toEqual([]);
    },
  );
});

describe('the filter actually filters, which a permissive default could hide', () => {
  /*
   * A RULE THAT MATCHES NOTHING READS EXACTLY LIKE ONE THAT SOMETIMES MATCHES,
   * which this project has already paid for twice -- the ranged attack power
   * item rule that matched none of the twelve lines in the data, and
   * `isWeaponUseOf(attack, 'ranged')`, which was false for every attack
   * forever. `proficiencyForItem` returns `undefined` for anything it does not
   * recognise, so a typo in the switch would make the whole filter a no-op and
   * every count below would simply equal the total.
   */
  const legalCount = (characterClass: ClassId, slot: EquipmentSlot): number =>
    itemsForSlot(slot).filter((item: Item) => canEquip(characterClass, item, slot)).length;

  it('takes mail and plate away from a Rogue s head slot', () => {
    const all = itemsForSlot('head').length;
    expect(legalCount('warrior', 'head')).toBeLessThan(all);
    expect(legalCount('rogue', 'head')).toBeLessThan(legalCount('warrior', 'head'));
  });

  it('leaves a Rogue no two-hander at all', () => {
    expect(legalCount('rogue', 'twoHand')).toBe(0);
    /*
     * A WARRIOR DOES NOT GET EVERY TWO-HANDER EITHER, AND THAT IS THE
     * `Classes:` LINE. It used to, because the proficiency table alone has
     * nothing to say about a Paladin-only mace -- and the four two-handers a
     * Warrior cannot take are exactly the ones that name another class.
     */
    const twoHanders = itemsForSlot('twoHand');
    expect(legalCount('warrior', 'twoHand')).toBeLessThan(twoHanders.length);
    const refused = twoHanders.filter((item) => !canEquip('warrior', item, 'twoHand'));
    expect(refused.every((item) => item.classRestrictions !== undefined)).toBe(true);
  });

  it('leaves a Mage and a Druid only what their row allows in the ranged slot', () => {
    // A Mage has the wand column and nothing else that goes there; a Druid has
    // none of the five, so its ranged slot is empty.
    expect(legalCount('mage', 'ranged')).toBeGreaterThan(0);
    expect(legalCount('druid', 'ranged')).toBe(0);
  });

  it('gives each relic to exactly the class whose column names it', () => {
    expect(legalCount('druid', 'relic')).toBeGreaterThan(0);
    expect(legalCount('paladin', 'relic')).toBeGreaterThan(0);
    expect(legalCount('shaman', 'relic')).toBeGreaterThan(0);
    expect(legalCount('warrior', 'relic')).toBe(0);
    expect(legalCount('rogue', 'relic')).toBe(0);
  });
});

/*
 * ==============================================================================
 * THE `Classes:` LINE, which the proficiency table cannot replace.
 *
 * The table answers "may this class wear leather". It cannot answer "may a
 * Warrior wear the ROGUE tier set", which is leather and says so on its own
 * tooltip -- and **895 of the 1,946 items on file name a class**, nearly half
 * the database. Offering a Warrior the Rogue and Druid tier is what the owner
 * saw.
 * ==============================================================================
 */
describe('an item that names a class is offered only to that class', () => {
  it('reads the line off the tooltip for every item that has one', () => {
    const restricted = ITEMS.filter((item) => item.id < 9_500_000 && item.classRestrictions);
    expect(restricted.length).toBeGreaterThan(800);
    for (const item of restricted) {
      // Every name parsed is a real class id. The LINE is in the tooltip for
      // all but the seven the Wowhead capture answers -- see below.
      for (const id of item.classRestrictions!) expect(CLASS_IDS).toContain(id);
    }
    const fromTooltip = restricted.filter((item) => /^Classes:/m.test(item.tooltip));
    expect(restricted.length - fromTooltip.length).toBe(7);
  });

  it('refuses a named class and allows the one it names', () => {
    const mageOnly = ITEMS.find(
      (item) =>
        item.classRestrictions?.length === 1 &&
        item.classRestrictions[0] === 'mage' &&
        item.slots.includes('head'),
    )!;
    expect(mageOnly).toBeDefined();
    expect(canEquip('mage', mageOnly, 'head')).toBe(true);
    expect(canEquip('warlock', mageOnly, 'head')).toBe(false);
    // And the armour class alone would have allowed the warlock: both wear cloth.
    expect(mageOnly.subclass).toBe('Cloth');
  });

  it('honours a line that names several classes', () => {
    const several = ITEMS.find((item) => (item.classRestrictions?.length ?? 0) > 1)!;
    expect(several).toBeDefined();
    for (const id of CLASS_IDS) {
      const allowed = several.classRestrictions!.includes(id);
      expect(`${id}: ${canEquip(id, several, several.slots[0])}`).toBe(`${id}: ${allowed}`);
    }
  });

  it('offers an item with no line to anyone its proficiency allows', () => {
    const open = ITEMS.find(
      (item) =>
        item.id < 9_500_000 && !item.classRestrictions && item.subclass === 'Plate' && item.slots.includes('head'),
    )!;
    expect(canEquip('warrior', open, 'head')).toBe(true);
    expect(canEquip('rogue', open, 'head')).toBe(false); // plate, not the line
  });

  /*
   * ----------------------------------------------------------------------------
   * A SOURCE GAP, PINNED SO IT IS NOT MISTAKEN FOR A BUG HERE.
   *
   * **184 items carry a set bonus and NO `Classes:` line** -- the capture
   * itself omits it, which was checked in the raw JSON rather than assumed.
   * Conqueror's Crown states "Classes: Warrior" and Bonescythe Helmet states
   * nothing, so the T2.5 sets are still offered to anybody whose armour class
   * allows them.
   *
   * NOT EVERY ONE OF THE 184 IS A CLASS SET. Devilsaur Armor, the Dragon Mail
   * sets and the Highlander's/Defiler's PvP sets are crafted or reputation
   * sets that genuinely have no class restriction, so "has a set bonus
   * therefore belongs to a class" would be wrong -- which is why nothing here
   * infers one, and why the number is written down for the owner instead.
   * ----------------------------------------------------------------------------
   */
  it('records how many set pieces NEITHER source restricts', () => {
    const real = ITEMS.filter((item) => item.id < 9_500_000);
    const setPieces = real.filter((item) => /^\(\d+\) Set/m.test(item.tooltip));
    const unrestricted = setPieces.filter((item) => !item.classRestrictions);
    /*
     * 184 LACKED A LINE IN FOREVER'S CAPTURE AND EVERY ONE WAS ASKED OF
     * WOWHEAD; seven -- the Bonescythe set -- had one, which is why the figure
     * is 177 and not 184. The other 177 carry none in Classic's own data
     * either, so a Paladin being offered a Frostfire Circlet is what BOTH
     * sources say about that item rather than a gap in this filter.
     */
    expect(`${unrestricted.length} of ${setPieces.length}`).toBe('177 of 742');
  });

  it('answers a missing line from the capture, and never overrides a stated one', () => {
    const bonescythe = ITEMS.find((item) => item.name === 'Bonescythe Helmet')!;
    // Its own tooltip says nothing; the capture says Rogue.
    expect(bonescythe.tooltip).not.toMatch(/^Classes:/m);
    expect(bonescythe.classRestrictions).toEqual(['rogue']);
    expect(canEquip('warrior', bonescythe, 'head')).toBe(false);
    expect(canEquip('rogue', bonescythe, 'head')).toBe(true);

    // And an item that states its own is answered by the tooltip.
    const stated = ITEMS.find((item) => /^Classes: Warrior$/m.test(item.tooltip))!;
    expect(stated.classRestrictions).toEqual(['warrior']);
  });
});
