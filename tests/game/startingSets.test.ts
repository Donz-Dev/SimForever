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
 * The Warrior's starting set, transcribed BY HAND from the item data rather
 * than read out of startingSets.ts. A test that asked the set what the set said
 * would pass whatever the set said -- including pointing at an item that no
 * longer exists, which is the failure this is guarding against.
 */
const WARRIOR_ARMOUR: Partial<Record<EquipmentSlot, string>> = {
  head: 'Jaws of Might',
  neck: 'Onyxia Tooth Pendant',
  shoulders: 'Pauldrons of Might',
  cloak: 'Cape of the Black Baron',
  chest: 'Hauberk of Might',
  wrists: 'Armguards of Might',
  gloves: 'Hands of Might',
  waist: 'Sash of Might',
  legs: 'Leggings of Might',
  feet: 'Treads of Might',
  ring1: "Don Julio's Band",
  ring2: 'Quick Strike Ring',
  trinket1: "Blackhand's Breadth",
  trinket2: 'Hand of Justice',
  ranged: "Striker's Mark",
};

const WARRIOR_WEAPONS: Record<string, Partial<Record<EquipmentSlot, string>>> = {
  dual_wield: { mainHand: "Vis'kag the Bloodletter", offHand: 'Brutality Blade' },
  two_hander: { twoHand: 'Obsidian Edged Blade' },
  one_hand_shield: { mainHand: 'Brutality Blade', shield: 'The Immovable Object' },
};

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

describe('the Warrior starting set', () => {
  for (const [style, weapons] of Object.entries(WARRIOR_WEAPONS)) {
    const expected = { ...WARRIOR_ARMOUR, ...weapons };

    it(`equips the right items for ${style}`, () => {
      const set = startingEquipmentFor('warrior', style as CombatStyleId);
      const actual: Record<string, string | undefined> = {};
      for (const [slot, equipped] of Object.entries(set)) {
        actual[slot] = equipped ? nameOf(equipped.itemId) : undefined;
      }
      expect(actual).toEqual(expected);
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
     * Wowhead gives a shield the inventory type "Off Hand", the same as a held
     * off-hand item, and only the subclass says otherwise. Getting this wrong
     * would let a dual-wielder equip a shield and SWING it.
     */
    const shield = ITEMS_BY_ID.get(19321);
    expect(shield?.slots).toEqual(['shield']);

    const set = startingEquipmentFor('warrior', 'one_hand_shield');
    expect(set.shield?.itemId).toBe(19321);
    expect(set.offHand).toBeUndefined();

    // And a dual-wielder is never handed one.
    expect(startingEquipmentFor('warrior', 'dual_wield').shield).toBeUndefined();
  });

  it('has a curated set for every class now, which it did not', () => {
    /*
     * THIS TEST USED TO ASSERT THAT A MAGE GOT NOTHING, and the comment in
     * `startingSets.ts` said why: "the honest answer rather than dressing a Mage
     * in plate". That was honest for exactly as long as there was no Mage gear.
     * Twelve sets later, a from-scratch Mage in an empty Gear panel is the
     * dishonest answer -- it fights with placeholder weapons and still produces
     * a confident-looking number.
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

  it('puts every class in its own armour, not the Warrior plate', () => {
    /*
     * The bug this whole area exists to prevent: seventeen profiles once wore
     * `SHARED_ARMOUR`, which is the Warrior set, and a profile in the wrong gear
     * runs perfectly and produces a plausible number. The head slot is enough to
     * tell them apart, and each name is transcribed by hand.
     */
    const head = (characterClass: ClassId, style: CombatStyleId) => {
      const slot = startingEquipmentFor(characterClass, style).head;
      return slot ? nameOf(slot.itemId) : undefined;
    };

    expect(head('warrior', 'dual_wield')).toBe('Jaws of Might');
    expect(head('rogue', 'dual_wield')).toBe('Nightslayer Cover');
    expect(head('druid', 'moonkin')).toBe('Cenarion Antlers');
    expect(head('druid', 'cat')).toBe('Cenarion Horns');
    expect(head('druid', 'bear')).toBe('Cenarion Crown');
    expect(head('shaman', 'caster')).toBe('Coif of The Five Thunders');
    expect(head('shaman', 'two_hander')).toBe('Crown of Destruction');
    expect(head('mage', 'caster')).toBe('Arcanist Crown');
    expect(head('hunter', 'ranged')).toBe('Crown of Destruction');
    expect(head('warlock', 'caster')).toBe('Deathmist Mask');
    expect(head('priest', 'caster')).toBe('Crown of Prophecy');
  });

  it('tells the two Paladin shield builds apart by the ENCOUNTER', () => {
    /*
     * ------------------------------------------------------------------------
     * BOTH HOLD A ONE-HANDER AND A SHIELD, so the style cannot separate them.
     *
     * Shockadin's shield is Earth and Fire, which is a CASTER shield carrying 26
     * spell power; Protection's is Earthen Guard. What tells them apart is
     * whether the target swings back -- the ruleset owner's own answer, and the
     * same shape as `isTankBuild`: a build inferred from two fields rather than
     * declared in one.
     * ------------------------------------------------------------------------
     */
    const tank = startingEquipmentFor('paladin', 'one_hand_shield', { targetAttacks: true });
    const shockadin = startingEquipmentFor('paladin', 'one_hand_shield', { targetAttacks: false });

    expect(nameOf(tank.shield!.itemId)).toBe('Earthen Guard');
    expect(nameOf(tank.head!.itemId)).toBe('Lawbringer Headguard');

    expect(nameOf(shockadin.shield!.itemId)).toBe('Earth and Fire');
    expect(nameOf(shockadin.head!.itemId)).toBe('Lawbringer Crown');

    // Omitted defaults to the damage build, because a character is created
    // before the encounter is set up and nothing has said it is tanking yet.
    expect(startingEquipmentFor('paladin', 'one_hand_shield')).toEqual(shockadin);

    // The two-hander is Retribution and holds nothing in the other hand.
    const ret = startingEquipmentFor('paladin', 'two_hander');
    expect(nameOf(ret.twoHand!.itemId)).toBe('Obsidian Edged Blade');
    expect(ret.shield).toBeUndefined();
  });

  it('keeps every slot the style can fill, and drops none of them', () => {
    /*
     * A set can be equipped and contribute NOTHING: `liveEquipment` strips the
     * slots a style cannot fill, and a caster shield in a stat-stick off hand
     * used to be one of them. Worth asserting per class, because the sets that
     * fill unusual slots -- a shield on a caster, a relic, a wand -- are exactly
     * the ones a style rule can silently discard.
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
    expect(geared.weapons.mainHand?.name).toBe("Vis'kag the Bloodletter");
    expect(geared.weapons.offHand?.name).toBe('Brutality Blade');
    // And the armour is worth something.
    expect(geared.stats.effective.attackPower).toBeGreaterThan(
      naked.stats.effective.attackPower,
    );
    expect(geared.stats.effective.armor).toBeGreaterThan(naked.stats.effective.armor);
  });
});
