import { describe, expect, it } from 'vitest';
import type { ClassId, CombatStyleId, RaceId } from '../../src/game/character';
import type { EquipmentSlot } from '../../src/game/items/Item';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { hasStartingEquipment, startingEquipmentFor } from '../../src/game/items/startingSets';
import { liveEquipment } from '../../src/game/items/equipment';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { validateProfile } from '../../src/profiles';
import { createDefaultProfile } from '../../src/profiles';

/*
 * ============================================================================
 * THE STARTING SET IS THE E65 BENCHMARK SET NOW, which is what this whole file
 * had to be rewritten around.
 *
 * It used to name twelve curated Classic and Season of Discovery sets item by
 * item -- "Jaws of Might", "Vis'kag the Bloodletter" -- transcribed by hand so
 * that a test could not pass by asking the set what the set said. Those nine
 * files are deleted on the owner's instruction, and `startingEquipmentFor`
 * returns gear generated from the itemization budget instead.
 *
 * SO THE SUBJECT CHANGED FROM *WHICH ITEMS* TO *WHICH SHAPE*, and the shape is
 * what the old file was really protecting: every class armed, nothing in a slot
 * it cannot occupy, a shield in `shield` and never in a weapon hand, the two
 * Paladin shield builds told apart, and no slot silently dropped by the style.
 * Every one of those bugs has happened, and none of them needs a named item to
 * be worth testing.
 * ============================================================================
 */

const nameOf = (itemId: number) => ITEMS_BY_ID.get(itemId)?.name;

/** Every class, written out rather than read from the source under test. */
const CLASSES: readonly ClassId[] = [
  'warrior', 'rogue', 'druid', 'shaman', 'mage', 'paladin', 'hunter', 'warlock', 'priest',
];

/**
 * Each class's default style, which is the one character creation lands on,
 * with a race that can legally be it.
 *
 * The race is here because `validateProfile` rejects an illegal pairing -- a
 * Human Druid -- and that has nothing to do with the gear under test.
 */
const DEFAULT_STYLES: readonly (readonly [ClassId, CombatStyleId, RaceId])[] = [
  ['warrior', 'dual_wield', 'orc'],
  ['rogue', 'dual_wield', 'undead'],
  ['druid', 'cat', 'tauren'],
  ['shaman', 'caster', 'troll'],
  ['mage', 'caster', 'gnome'],
  ['paladin', 'one_hand_shield', 'human'],
  ['hunter', 'ranged', 'orc'],
  ['warlock', 'caster', 'undead'],
  ['priest', 'caster', 'troll'],
];

/**
 * Which weapon slots each Warrior style fills, and nothing about which ITEM.
 *
 * The three styles are the reason this mapping is worth a test at all: a
 * two-hander in a dual-wield set is dropped, a one-hander in a two-hand set is
 * dropped, and either mistake leaves a character swinging the placeholder.
 */
const WARRIOR_HANDS: Record<string, readonly EquipmentSlot[]> = {
  dual_wield: ['mainHand', 'offHand'],
  two_hander: ['twoHand'],
  one_hand_shield: ['mainHand', 'shield'],
};

describe('the starting set', () => {
  for (const [style, hands] of Object.entries(WARRIOR_HANDS)) {
    it(`fills exactly the right hands for ${style}`, () => {
      const set = startingEquipmentFor('warrior', style as CombatStyleId, {
        targetAttacks: style === 'one_hand_shield',
      });
      const WEAPON_SLOTS: readonly EquipmentSlot[] = [
        'mainHand',
        'offHand',
        'twoHand',
        'shield',
        'ranged',
      ];
      const filled = WEAPON_SLOTS.filter((slot) => set[slot] !== undefined);
      expect(filled).toEqual(hands);
    });

    it(`puts every ${style} item in a slot it can actually go in`, () => {
      const set = startingEquipmentFor('warrior', style as CombatStyleId);
      for (const [slot, equipped] of Object.entries(set)) {
        const item = ITEMS_BY_ID.get(equipped!.itemId);
        expect(item, `${slot} points at a missing item`).toBeDefined();
        expect(item!.slots, `${item!.name} cannot go in ${slot}`).toContain(slot);
      }
    });
  }

  it('puts the shield in the shield slot, not the off hand', () => {
    /*
     * Forever gives a shield the inventory type "Off Hand", the same as a held
     * off-hand item, and only the subclass says otherwise. Getting this wrong
     * would let a dual-wielder equip a shield and SWING it.
     */
    const set = startingEquipmentFor('warrior', 'one_hand_shield', { targetAttacks: true });
    expect(set.shield).toBeDefined();
    expect(set.offHand).toBeUndefined();
    expect(ITEMS_BY_ID.get(set.shield!.itemId)?.slots).toEqual(['shield']);

    // And a dual-wielder is never handed one.
    expect(startingEquipmentFor('warrior', 'dual_wield').shield).toBeUndefined();
  });

  it('has a set for every class', () => {
    /*
     * THIS TEST USED TO ASSERT THAT A MAGE GOT NOTHING, and the comment in
     * `startingSets.ts` said why: "the honest answer rather than dressing a
     * Mage in plate". That was honest for exactly as long as there was no Mage
     * gear. A from-scratch Mage in an empty Gear panel is the dishonest
     * answer -- it fights with placeholder weapons and still produces a
     * confident-looking number.
     */
    for (const characterClass of CLASSES) {
      expect(hasStartingEquipment(characterClass), characterClass).toBe(true);
    }

    // And each one is real gear, not an empty object that passes the flag.
    for (const [characterClass, style] of DEFAULT_STYLES) {
      const set = startingEquipmentFor(characterClass, style);
      expect(Object.keys(set).length, characterClass).toBeGreaterThanOrEqual(15);
    }
  });

  it('puts every class in its own armour class, not the Warrior plate', () => {
    /*
     * ------------------------------------------------------------------------
     * THE BUG THIS WHOLE AREA EXISTS TO PREVENT: seventeen profiles once wore
     * the WARRIOR's set, and a profile in the wrong gear runs perfectly and
     * produces a plausible number.
     *
     * IT IS CHECKED ON THE ARMOUR VALUE NOW RATHER THAN ON THE ITEM NAME,
     * because every benchmark head piece is called "E65 Head" -- the name
     * carries the set and the slot, and the armour CLASS is the thing that
     * differs. Base armour is a function of slot, armour class and item level,
     * so at one item level the four classes are strictly ordered and a Mage in
     * plate would show up here immediately.
     * ------------------------------------------------------------------------
     */
    const headArmour = (characterClass: ClassId, style: CombatStyleId) => {
      const slot = startingEquipmentFor(characterClass, style).head!;
      return ITEMS_BY_ID.get(slot.itemId)!.stats.armor ?? 0;
    };

    const plate = headArmour('warrior', 'dual_wield');
    const mail = headArmour('hunter', 'ranged');
    const leather = headArmour('rogue', 'dual_wield');
    const cloth = headArmour('mage', 'caster');

    expect(plate).toBeGreaterThan(mail);
    expect(mail).toBeGreaterThan(leather);
    expect(leather).toBeGreaterThan(cloth);

    // The armour class follows the CLASS and not the style: a Moonkin is in
    // leather like the Rogue, and both Shaman styles are mail.
    expect(headArmour('druid', 'moonkin')).toBe(leather);
    expect(headArmour('shaman', 'two_hander')).toBe(mail);
    expect(headArmour('paladin', 'two_hander')).toBe(plate);

    /*
     * THE BEAR IS THE EXCEPTION AND IT IS BUYING SOMETHING. Its template lists
     * "Bonus Armor" second in its preferences, which is a BUDGETED stat at a
     * cost of 0.1 -- so its head is leather's 155 base plus 192 it paid for.
     * Base armour comes free with the item level and bonus armour does not,
     * and the two being separable is the whole reason the generator writes
     * them as separate lines.
     */
    expect(headArmour('druid', 'bear')).toBeGreaterThan(leather);
    expect(headArmour('druid', 'bear')).toBeLessThan(plate);
  });

  it('tells the two Paladin shield builds apart by the ENCOUNTER', () => {
    /*
     * ------------------------------------------------------------------------
     * BOTH HOLD A ONE-HANDER AND A SHIELD, so the style cannot separate them.
     * What tells them apart is whether the target swings back -- the ruleset
     * owner's own answer, and the same shape as `isTankBuild`: a build inferred
     * from two fields rather than declared in one.
     *
     * THE DIFFERENCE IS NOW THE STAT LINE RATHER THAN THE ITEM. Protection's
     * template leads with Stamina, Strength, Agility, Defense, Parry and Block;
     * the Shockadin's leads with Crit and Spell Power. So the tank's shield
     * carries stamina a damage build's does not, and the Shockadin's gear
     * carries spell power the tank's does not.
     * ------------------------------------------------------------------------
     */
    const tank = startingEquipmentFor('paladin', 'one_hand_shield', { targetAttacks: true });
    const shockadin = startingEquipmentFor('paladin', 'one_hand_shield', { targetAttacks: false });

    expect(tank.shield).toBeDefined();
    expect(shockadin.shield).toBeDefined();
    expect(tank.shield!.itemId).not.toBe(shockadin.shield!.itemId);

    const spellPower = (set: typeof tank) =>
      Object.values(set).reduce(
        (sum, equipped) => sum + (ITEMS_BY_ID.get(equipped!.itemId)?.stats.spellPower ?? 0),
        0,
      );
    expect(spellPower(shockadin)).toBeGreaterThan(0);
    expect(spellPower(tank)).toBe(0);

    // Omitted defaults to the damage build, because a character is created
    // before the encounter is set up and nothing has said it is tanking yet.
    expect(startingEquipmentFor('paladin', 'one_hand_shield')).toEqual(shockadin);

    // The two-hander is Retribution and holds nothing in the other hand.
    const ret = startingEquipmentFor('paladin', 'two_hander');
    expect(ret.twoHand).toBeDefined();
    expect(ret.shield).toBeUndefined();
    expect(nameOf(ret.twoHand!.itemId)).toMatch(/Two-Hand/);
  });

  it('keeps every slot the style can fill, and drops none of them', () => {
    /*
     * A set can be equipped and contribute NOTHING: `liveEquipment` strips the
     * slots a style cannot fill, and a caster shield in a stat-stick off hand
     * used to be one of them. Worth asserting per class, because the sets that
     * fill unusual slots -- a shield on a caster, a bow on a melee Hunter --
     * are exactly the ones a style rule can silently discard.
     */
    for (const [characterClass, style] of DEFAULT_STYLES) {
      const set = startingEquipmentFor(characterClass, style, { targetAttacks: true });
      const live = liveEquipment(set, style);
      for (const slot of Object.keys(set)) {
        expect(
          (live as Record<string, unknown>)[slot],
          `${characterClass}/${style} loses ${slot}`,
        ).toBeDefined();
      }
    }
  });

  it('arms every class, rather than leaving it on a placeholder', () => {
    /*
     * ------------------------------------------------------------------------
     * THE FAILURE THIS CATCHES HAS HAPPENED TWICE, in opposite directions, and
     * both times it was silent: a set whose weapon the STYLE cannot hold is
     * dropped, and the character swings "Melee", which is a placeholder with a
     * plausible damage range.
     *
     * The Shockadin was the second: its benchmark template said `twoHand` while
     * its style is `one_hand_shield`, so it held nothing at all. Checked for
     * every class and style here rather than for the one that broke.
     *
     * A CASTER AND A FERAL DRUID ARE THE TWO HONEST EXCEPTIONS. A caster style
     * HOLDS its weapon as a stat stick and never swings it, so it has no weapon
     * profile by design; a Druid in form swings a PAW built from the weapon's
     * dps. Both are named rather than skipped, because "could not swing it" and
     * "was never given one" are the two answers this test exists to separate.
     * ------------------------------------------------------------------------
     */
    for (const [characterClass, style, race] of DEFAULT_STYLES) {
      const player = createPlayer({
        race,
        characterClass,
        combatStyle: style,
        equipment: startingEquipmentFor(characterClass, style, { targetAttacks: true }),
      });

      if (style === 'caster') {
        // Held, never swung: no weapon profile at all.
        expect(player.weapons.mainHand, characterClass).toBeUndefined();
      } else if (style === 'ranged') {
        /*
         * A RANGED HUNTER IS THE OTHER STAT-STICK STYLE: its melee weapon is
         * held and its BOW is the one that swings, so the slot to check is the
         * ranged one. Checking `mainHand` here is how this test first read a
         * correctly armed Hunter as unarmed.
         */
        expect(player.weapons.mainHand, characterClass).toBeUndefined();
        expect(player.weapons.ranged?.name, characterClass).toMatch(/^E65 /);
      } else if (characterClass === 'druid') {
        expect(player.weapons.mainHand?.name, characterClass).toBe('Cat Paw');
      } else {
        expect(player.weapons.mainHand?.name, characterClass).toMatch(/^E65 /);
      }
    }
  });

  it('produces a profile that validates, for every class', () => {
    for (const [characterClass, style, race] of DEFAULT_STYLES) {
      const base = createDefaultProfile();
      const profile = {
        ...base,
        character: { ...base.character, race, characterClass, combatStyle: style },
        // The default profile carries a WARRIOR's talents, which are not legal
        // ids for anyone else. The gear is what is under test here.
        talents: {},
        equipment: startingEquipmentFor(characterClass, style),
      };
      expect(validateProfile(profile).ok, characterClass).toBe(true);
    }
  });

  it('produces a profile that validates', () => {
    // The set goes onto a profile, so it has to survive the same checks a
    // hand-edited or imported one does.
    const profile = {
      ...createDefaultProfile(),
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
    };
    expect(validateProfile(profile).ok).toBe(true);
  });

  it('actually arms the character it is given to', () => {
    const naked = createPlayer({ race: 'human', characterClass: 'warrior', combatStyle: 'dual_wield' });
    const geared = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
    });

    // Real weapons replace the placeholders outright.
    expect(naked.weapons.mainHand?.name).toBe('Melee');
    expect(geared.weapons.mainHand?.name).toBe('E65 Main-Hand Axe');
    expect(geared.weapons.offHand?.name).toBe('E65 Off-Hand Axe');
    // And the armour is worth something.
    expect(geared.stats.effective.attackPower).toBeGreaterThan(
      naked.stats.effective.attackPower,
    );
    expect(geared.stats.effective.armor).toBeGreaterThan(naked.stats.effective.armor);
  });
});
