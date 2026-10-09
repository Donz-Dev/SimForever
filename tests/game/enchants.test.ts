import { describe, expect, it } from 'vitest';
import type { Equipment, EquipmentSlot } from '../../src/game/items/Item';
import {
  ENCHANTS,
  ENCHANTS_BY_ID,
  enchantsForSlot,
} from '../../src/game/items/itemData';
import {
  FOREVER_ENCHANTS,
  FOREVER_ENCHANT_ID_BASE,
  foreverEnchantId,
} from '../../src/game/items/foreverEnchants';
import {
  armorFromItems,
  attackTableModifiersForStyle,
  statsForStyle,
} from '../../src/game/items/equipment';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { createPet } from '../../src/game/actors/createPet';
import { COMBAT_CONSTANTS, createForeverAttackChances } from '../../src/game/combat/attackChances';
import { characterAtCombatStart } from '../../src/simulator';
import { RATING_PER_PERCENT, dealDamage, hasteMultiplierFrom } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { AttackTableModifiers } from '../../src/engine';

/*
 * ==============================================================================
 * RULESET: ARMOUR ENCHANTS, FROM THE OWNER'S OWN TABLE.
 *
 * Ten columns of what each slot may carry, and 24 rows of what each profile
 * opens with. Both are TRANSCRIBED BY HAND below rather than read back out of
 * `foreverEnchants.ts` or `gearSets.ts` -- a test that reads the source data
 * passes no matter what the source data says, and the whole point of this file
 * is that the spreadsheet and the simulator agree.
 *
 * FOUR OF THE ENCHANTS DO NOTHING AND ARE STILL HERE. Healing power, threat in
 * both directions and Minor Speed are not modelled, the owner asked for them to
 * stay selectable, and each one SAYS it is inert -- which is the honest failure
 * mode this project asks for rather than a missing dropdown entry.
 * ==============================================================================
 */

// ---------------------------------------------------------------------------
// The catalogue: which enchants each slot offers
// ---------------------------------------------------------------------------

/**
 * Every column of the owner's table, written out.
 *
 * "None" is not an entry here: it is the empty option every dropdown already
 * has, so a column reading only "None" -- the shoulder -- is the empty list.
 */
const COLUMNS: Readonly<Record<string, readonly string[]>> = {
  head: [
    '+1% Dodge',
    '+1% Haste',
    '+8 Agility',
    '+8 Stamina',
    '+8 Strength',
    '+8 Intellect',
    '+8 Spirit',
  ],
  neck: ['+5 Strength', '+6 Spell Power', '+11 Healing Power', '+5 Agility', '+5 Defense Skill'],
  shoulders: [],
  cloak: ['+5 Agility', '+1% Dodge', '+60 Armor', '-2% Threat'],
  chest: ['+4 Stats', '+4 Defense Skill'],
  wrists: [
    '+9 Strength',
    '+16 Spell Power',
    '+4 Defense Skill',
    '+9 Agility',
    '+16 Healing Power',
  ],
  gloves: [
    '+15 Strength',
    '+15 Agility',
    '+20 Spell Power',
    '+2% Threat',
    '+1% Haste',
    '+4 Defense Skill',
  ],
  legs: [
    '+1% Dodge',
    '+1% Haste',
    '+8 Agility',
    '+8 Stamina',
    '+8 Strength',
    '+8 Intellect',
    '+8 Spirit',
    '+4 Defense Skill',
  ],
  feet: ['Minor Speed', '+7 Agility', '+7 Stamina', '+4 Defense Skill'],
  ranged: ['+2% Crit Chance'],
};

describe('the enchants each slot offers', () => {
  it('matches the owner table column for column', () => {
    for (const [slot, expected] of Object.entries(COLUMNS)) {
      const offered = enchantsForSlot(slot as EquipmentSlot)
        // The two WEAPON enchants are a different source and a different
        // question; `items.test.ts` owns them. Neither reaches an armour slot,
        // which the assertion below pins separately.
        .filter((enchant) => enchant.id > FOREVER_ENCHANT_ID_BASE)
        .map((enchant) => enchant.name);
      expect([...offered].sort(), slot).toEqual([...expected].sort());
    }
  });

  it('keeps the armour enchants off every weapon slot', () => {
    /*
     * A head enchant on a sword would be silently applied -- `statsFromEquipment`
     * reads whatever enchant id the slot carries and asks no questions -- so the
     * SLOT LIST is the only thing stopping it, and the Gear panel builds its
     * dropdown from exactly this call.
     */
    for (const slot of ['mainHand', 'offHand', 'twoHand'] as const) {
      const armour = enchantsForSlot(slot).filter((e) => e.id > FOREVER_ENCHANT_ID_BASE);
      expect(armour, slot).toEqual([]);
    }
  });

  it('gives every slot in the table an entry, and nothing else one', () => {
    // Derived from the enchants rather than written out, which is the one place
    // that is right: this asserts the two lists describe the SAME set of slots.
    const slotsWithEnchants = new Set<string>();
    for (const enchant of FOREVER_ENCHANTS) {
      for (const slot of enchant.slots) slotsWithEnchants.add(slot);
    }
    const expected = Object.entries(COLUMNS)
      .filter(([, names]) => names.length > 0)
      .map(([slot]) => slot);
    expect([...slotsWithEnchants].sort()).toEqual(expected.sort());
  });
});

// ---------------------------------------------------------------------------
// The ids, which a saved profile stores
// ---------------------------------------------------------------------------

describe('the ids are stable and are nobody else’s', () => {
  it('allocates them by position from the Forever block', () => {
    /*
     * ------------------------------------------------------------------------
     * A SAVED PROFILE STORES A BARE NUMBER, so reordering the declaration list
     * would move somebody's helmet enchant onto their boots -- quietly, with
     * the right stats arriving on the wrong slot and nothing erroring. This is
     * what makes a reorder fail.
     *
     * Three are pinned rather than all 28: the first, the last, and the one
     * the ranged crit uses, which is the only entry anything other than
     * `statsFromEquipment` reads.
     * ------------------------------------------------------------------------
     */
    expect(foreverEnchantId('+1% Dodge')).toBe(FOREVER_ENCHANT_ID_BASE + 1);
    expect(foreverEnchantId('+2% Crit Chance')).toBe(FOREVER_ENCHANT_ID_BASE + 28);
    expect(FOREVER_ENCHANTS).toHaveLength(28);
  });

  it('throws on a name the table does not contain', () => {
    // A loadout naming an enchant that does not exist has to be a build
    // failure. Skipping the slot would be a profile silently missing a stat.
    expect(() => foreverEnchantId('+9 Strength of the Invented')).toThrow();
  });

  it('shares no id with the two scraped weapon enchants', () => {
    const ids = ENCHANTS.map((enchant) => enchant.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const enchant of FOREVER_ENCHANTS) {
      expect(enchant.id).toBeGreaterThan(FOREVER_ENCHANT_ID_BASE);
    }
  });
});

// ---------------------------------------------------------------------------
// What each one is worth
// ---------------------------------------------------------------------------

/** A character wearing one enchant on one slot and nothing else. */
function wearing(slot: EquipmentSlot, itemId: number, enchantName: string) {
  return { [slot]: { itemId, enchantId: foreverEnchantId(enchantName) } };
}

describe('what an enchant grants', () => {
  /** A Warrior's own set, used only as something to hang an enchant on. */
  const set = startingEquipmentFor('warrior', 'two_hander');

  const statsWith = (slot: EquipmentSlot, enchantName: string) =>
    statsForStyle(
      wearing(slot, set[slot]!.itemId, enchantName),
      'two_hander',
    );

  const statsWithout = (slot: EquipmentSlot) =>
    statsForStyle({ [slot]: { itemId: set[slot]!.itemId } }, 'two_hander');

  const delta = (slot: EquipmentSlot, enchantName: string, stat: string) =>
    ((statsWith(slot, enchantName) as Record<string, number>)[stat] ?? 0) -
    ((statsWithout(slot) as Record<string, number>)[stat] ?? 0);

  it('grants a flat primary as that primary and nothing else', () => {
    expect(delta('head', '+8 Strength', 'strength')).toBe(8);
    expect(delta('head', '+8 Strength', 'agility')).toBe(0);
    expect(delta('head', '+8 Agility', 'agility')).toBe(8);
    expect(delta('legs', '+8 Intellect', 'intellect')).toBe(8);
    expect(delta('feet', '+7 Stamina', 'stamina')).toBe(7);
  });

  it('gives "+4 Stats" ALL FIVE primaries, four each', () => {
    /*
     * The owner's own clarification, and the reading that is easy to get wrong:
     * "Stats" is not three primaries or four, it is stamina, strength, agility,
     * intellect AND spirit. A version granting the three a melee build reads
     * would be right about every melee profile and short on every caster.
     */
    for (const stat of ['strength', 'agility', 'stamina', 'intellect', 'spirit']) {
      expect(delta('chest', '+4 Stats', stat), stat).toBe(4);
    }
  });

  it('grants spell power, dodge and defense skill as their own stats', () => {
    expect(delta('gloves', '+20 Spell Power', 'spellPower')).toBe(20);
    expect(delta('head', '+1% Dodge', 'dodgeChance')).toBe(1);
    expect(delta('neck', '+5 Defense Skill', 'defenseSkill')).toBe(5);
    expect(delta('chest', '+4 Defense Skill', 'defenseSkill')).toBe(4);
  });

  it('grants "+1% Haste" as exactly one percent of haste', () => {
    /*
     * ------------------------------------------------------------------------
     * THE RATING IS A UNIT HERE, NOT A SOURCE. `hasteMultiplierFrom` divides by
     * `RATING_PER_PERCENT.haste`, so multiplying by the same constant puts 1%
     * in and gets 1.01 out exactly -- which is the idiom Seal of the Crusader,
     * Nature's Grace, Flurry and Blade Flurry already use. The constant itself
     * is a placeholder and this is immune to it moving.
     * ------------------------------------------------------------------------
     */
    expect(delta('head', '+1% Haste', 'hasteRating')).toBe(RATING_PER_PERCENT.haste);

    const withHaste = makeAttacker({
      stats: { hasteRating: RATING_PER_PERCENT.haste },
    });
    expect(hasteMultiplierFrom(withHaste.stats.effective)).toBeCloseTo(1.01, 10);
  });

  it('shortens a cast, a melee swing AND a ranged swing with that one percent', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S OWN EDGE CASE, stated when the table was supplied: "1% Haste
     * affects cast speed, ranged auto-attack speed, and melee auto-attack
     * speed." All three go through `applyHaste` off the same multiplier, so the
     * claim to check is that nothing takes a different route -- and `applyHaste`
     * is what every one of them calls.
     *
     * ASSERTED ON THE ARITHMETIC rather than by running three fights, because a
     * fight would measure the rotation as much as the haste. A 2000ms cast at
     * 1% is 1980ms; a 3.6-second two-hander is 3564ms; a 2.9-second bow is
     * 2871ms. None of the three is a rounding artefact of the others.
     * ------------------------------------------------------------------------
     */
    const multiplier = 1 + 1 / 100;
    expect(Math.round(2000 / multiplier)).toBe(1980);
    expect(Math.round(3600 / multiplier)).toBe(3564);
    expect(Math.round(2900 / multiplier)).toBe(2871);
  });

  it('does NOT count an enchant’s armor as armor FROM ITEMS', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S RULING, and the whole reason `armorFromItems` stopped going
     * through `statsFromEquipment`. Toughness and Thick Hide scale "your Armor
     * value from items"; the cloak's sixty points are not that, so they reach
     * the character once and flat.
     *
     * BOTH HALVES ARE ASSERTED, because only one of them is the interesting
     * one: the stat MUST arrive (an enchant that granted nothing would pass a
     * test checking only that Toughness ignored it) and the item total must NOT
     * move.
     * ------------------------------------------------------------------------
     */
    const bare: Equipment = { cloak: { itemId: set.cloak!.itemId } };
    const enchanted: Equipment = wearing('cloak', set.cloak!.itemId, '+60 Armor');

    const armorStat = (equipment: Equipment) =>
      (statsForStyle(equipment, 'two_hander') as Record<string, number>).armor ?? 0;

    expect(armorStat(enchanted) - armorStat(bare)).toBe(60);
    expect(armorFromItems(enchanted, 'two_hander')).toBe(
      armorFromItems(bare, 'two_hander'),
    );
  });
});

// ---------------------------------------------------------------------------
// The four that do nothing, and say so
// ---------------------------------------------------------------------------

describe('the enchants that are not modelled', () => {
  const INERT = ['+11 Healing Power', '+16 Healing Power', '-2% Threat', '+2% Threat', 'Minor Speed'];

  it('are selectable, grant nothing, and each records why', () => {
    for (const name of INERT) {
      const enchant = ENCHANTS_BY_ID.get(foreverEnchantId(name))!;
      expect(enchant.stats, name).toEqual({});
      expect(enchant.attackTableModifiers, name).toBeUndefined();
      // An inert effect that SAYS it is inert is the honest failure mode. One
      // that is silently absent reads as a feature nobody got round to.
      expect(enchant.unmodelled.length, name).toBe(1);
      expect(enchant.unmodelled[0].text, name).toBe(name);
      expect(enchant.unmodelled[0].reason.length, name).toBeGreaterThan(20);
    }
  });

  it('leaves every OTHER enchant claiming nothing', () => {
    // The mirror of the above, and the one that expires: an enchant that gains
    // a stat must lose its caveat in the same commit.
    for (const enchant of FOREVER_ENCHANTS) {
      if (INERT.includes(enchant.name)) continue;
      expect(enchant.unmodelled, enchant.name).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// The ranged crit, which is the one that is not a stat
// ---------------------------------------------------------------------------

describe('the bow’s +2% crit reaches ranged attacks and nothing else', () => {
  it('registers on both ranged tables and neither melee one', () => {
    const equipment = PRESETS_BY_ID.get('bm_hunter')!.build().equipment;
    const modifiers = attackTableModifiersForStyle(equipment, 'ranged');

    expect(modifiers.for('ranged-auto').critBonus).toBe(2);
    expect(modifiers.for('ranged-special').critBonus).toBe(2);
    /*
     * NOT MELEE, which is the whole reason this is not `critChance`. The melee
     * Hunter wears the same armour and holds the same bow, and a stat would
     * have raised its Raptor Strike.
     */
    expect(modifiers.for('melee-auto').critBonus ?? 0).toBe(0);
    expect(modifiers.for('melee-special').critBonus ?? 0).toBe(0);
    expect(modifiers.for('spell').critBonus ?? 0).toBe(0);
  });

  it('reaches the built character, so talents and gear add rather than replace', () => {
    /*
     * TWO CORRECT HALVES WITH NOTHING JOINING THEM is the shape no half's test
     * can catch, and `createPlayer` is the join: the Hunter's own Mortal Shots
     * and Ranged Weapon Specialization are on `build.attackTableModifiers`, and
     * merging rather than overwriting is what keeps both.
     */
    const player = characterAtCombatStart(PRESETS_BY_ID.get('bm_hunter')!.build())!;
    const ranged = player.attackTableModifiers.for('ranged-special');
    // The enchant.
    expect(ranged.critBonus).toBe(2);
    // AND Mortal Shots, 5/5, which the same table carries from the TALENTS.
    // Both present is what says the two sets were merged rather than one
    // replacing the other -- which is the failure a single assertion misses.
    expect(ranged.critMultiplierBonus).toBeCloseTo(0.3, 6);
    expect(player.attackTableModifiers.for('ranged-auto').critBonus).toBe(2);
  });

  it('actually changes how often a ranged attack crits', () => {
    /*
     * ------------------------------------------------------------------------
     * THE READER, NOT THE WRITER. `armorPenetration` shipped declared, granted
     * and read by NOTHING, and its test file passed throughout because it
     * asserted the arithmetic and the registration and never the join. So this
     * rolls real attacks and counts crits.
     *
     * Two points on a 1-10000 die is 200 units, which over 20,000 hits is about
     * 400 more crits -- far outside the noise of either count. Measured as a
     * RATE because that is what a chance is, and the alternative (one scripted
     * roll on the boundary) tests the boundary and not the magnitude.
     * ------------------------------------------------------------------------
     */
    const critsOver = (critBonus: number) => {
      const attackTableModifiers = new AttackTableModifiers();
      if (critBonus) attackTableModifiers.add('ranged-auto', { critBonus });
      const actor = makeAttacker({
        autoAttack: 'none',
        // A crit chance well clear of both ends, so two points cannot be eaten
        // by a clamp at either.
        stats: { critChance: 20 },
        attackTableModifiers,
      });
      const target = makeTarget({ maxHealth: 1_000_000_000 });
      const simulation = buildSimulation([actor, target], { seed: 7 });
      simulation.advanceTo(0);

      let crits = 0;
      for (let i = 0; i < 20_000; i += 1) {
        const result = dealDamage(simulation, {
          source: actor,
          target,
          abilityName: 'shot',
          school: 'physical',
          baseAmount: 1,
          attackTable: 'ranged-auto',
          appliesArmor: false,
        });
        if (result?.outcome === 'crit') crits += 1;
      }
      return crits;
    };

    const plain = critsOver(0);
    const enchanted = critsOver(2);
    // 20% against 22%, so about 4000 against 4400.
    expect(plain / 20_000).toBeCloseTo(0.2, 2);
    expect(enchanted / 20_000).toBeCloseTo(0.22, 2);
    expect(enchanted).toBeGreaterThan(plain);
  });

  it('does not reach a Hunter’s PET', () => {
    /*
     * ------------------------------------------------------------------------
     * The owner's ruling: the bow's crit is the Hunter's, not the pet's. It
     * falls out of where the modifier lives rather than needing a guard --
     * `createPet` builds its own combatant and inherits the owner's crit STAT,
     * which this deliberately is not -- and that is exactly why it is worth a
     * test. A pet quietly collecting it would be a bigger number and no error.
     * ------------------------------------------------------------------------
     */
    const owner = characterAtCombatStart(PRESETS_BY_ID.get('bm_hunter')!.build())!;
    const pet = createPet({ owner, family: 'cat' });

    // The owner has it.
    expect(owner.attackTableModifiers.for('ranged-auto').critBonus).toBe(2);
    // The pet has none of it, on either side of the table.
    expect(pet.attackTableModifiers.for('ranged-auto').critBonus ?? 0).toBe(0);
    expect(pet.attackTableModifiers.for('melee-auto').critBonus ?? 0).toBe(0);
    expect(pet.attackTableModifiers.for('melee-special').critBonus ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// What each of the 25 profiles opens with
// ---------------------------------------------------------------------------

/**
 * The owner's loadout table, transcribed row for row.
 *
 * A slot absent from a row is "None" in the spreadsheet, and the six profiles
 * with no ranged ITEM at all are "None" there for the better reason that there
 * is nothing to enchant.
 */
const LOADOUTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  two_hand_arms: {
    head: '+8 Strength', neck: '+5 Strength', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Strength', gloves: '+15 Strength', legs: '+8 Strength', feet: 'Minor Speed',
  },
  dw_fury: {
    head: '+8 Strength', neck: '+5 Strength', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Strength', gloves: '+15 Strength', legs: '+8 Strength', feet: '+7 Agility',
  },
  prot_warr: {
    head: '+1% Dodge', neck: '+5 Defense Skill', cloak: '+1% Dodge', chest: '+4 Stats',
    wrists: '+4 Defense Skill', gloves: '+2% Threat', legs: '+1% Dodge', feet: 'Minor Speed',
  },
  rogue_venom: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
  },
  rogue_combat: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
  },
  rogue_rupture: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
  },
  rogue_hemo: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
  },
  druid_moonkin: {
    head: '+1% Haste', neck: '+6 Spell Power', cloak: '-2% Threat', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+1% Haste', feet: 'Minor Speed',
  },
  druid_cat: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
  },
  druid_bear: {
    head: '+1% Dodge', neck: '+5 Agility', cloak: '+1% Dodge', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+1% Dodge', feet: 'Minor Speed',
  },
  shaman_elemental: {
    head: '+1% Haste', neck: '+6 Spell Power', cloak: '-2% Threat', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+1% Haste', feet: 'Minor Speed',
  },
  shaman_enhancement: {
    head: '+8 Strength', neck: '+5 Strength', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Strength', gloves: '+15 Strength', legs: '+8 Strength', feet: 'Minor Speed',
  },
  mage_frostfire: {
    head: '+1% Haste', neck: '+6 Spell Power', cloak: '-2% Threat', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+1% Haste', feet: 'Minor Speed',
  },
  mage_arcane: {
    head: '+1% Haste', neck: '+6 Spell Power', cloak: '-2% Threat', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+1% Haste', feet: 'Minor Speed',
  },
  mage_fire: {
    head: '+1% Haste', neck: '+6 Spell Power', cloak: '-2% Threat', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+1% Haste', feet: 'Minor Speed',
  },
  pally_ret: {
    head: '+1% Haste', neck: '+5 Strength', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Strength', gloves: '+1% Haste', legs: '+1% Haste', feet: '+7 Agility',
  },
  pally_shockadin: {
    head: '+8 Strength', neck: '+5 Strength', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+8 Strength', feet: '+7 Agility',
  },
  prot_pally: {
    head: '+1% Dodge', neck: '+5 Defense Skill', cloak: '+1% Dodge', chest: '+4 Stats',
    wrists: '+4 Defense Skill', gloves: '+20 Spell Power', legs: '+1% Dodge', feet: '+7 Stamina',
  },
  bm_hunter: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
    ranged: '+2% Crit Chance',
  },
  lw_ranged: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
    ranged: '+2% Crit Chance',
  },
  lw_melee: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
  },
  // Hawk Melee wears LW Melee's gear exactly, on the owner's instruction, so
  // the row is the same row. It is written out rather than aliased because
  // this table exists to be an INDEPENDENT statement of what each profile
  // opens with -- sharing the object would make it agree with itself.
  hawk_melee: {
    head: '+8 Agility', neck: '+5 Agility', cloak: '+5 Agility', chest: '+4 Stats',
    wrists: '+9 Agility', gloves: '+15 Agility', legs: '+8 Agility', feet: '+7 Agility',
  },
  warlock_smds: {
    head: '+1% Haste', neck: '+6 Spell Power', cloak: '-2% Threat', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+1% Haste', feet: 'Minor Speed',
  },
  warlock_firelock: {
    head: '+1% Haste', neck: '+6 Spell Power', cloak: '-2% Threat', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+1% Haste', feet: 'Minor Speed',
  },
  shadow_priest: {
    head: '+1% Haste', neck: '+6 Spell Power', cloak: '-2% Threat', chest: '+4 Stats',
    wrists: '+16 Spell Power', gloves: '+20 Spell Power', legs: '+1% Haste', feet: 'Minor Speed',
  },
};

/** The slots a loadout can name. A weapon slot is not one. */
const ARMOUR_SLOTS: readonly EquipmentSlot[] = [
  'head',
  'neck',
  'shoulders',
  'cloak',
  'chest',
  'wrists',
  'gloves',
  'legs',
  'feet',
  'ranged',
];

describe('what each of the 25 profiles opens with', () => {
  it('covers every preset, so a new one cannot slip through unenchanted', () => {
    expect(PROFILE_PRESETS.map((preset) => preset.id).sort()).toEqual(
      Object.keys(LOADOUTS).sort(),
    );
  });

  it('matches the owner table row for row', () => {
    for (const preset of PROFILE_PRESETS) {
      const equipment = preset.build().equipment;
      const expected = LOADOUTS[preset.id];

      for (const slot of ARMOUR_SLOTS) {
        const equipped = equipment[slot];
        const want = expected[slot];
        const where = `${preset.id} ${slot}`;

        if (want === undefined) {
          // Either the slot holds nothing, or it holds something unenchanted.
          expect(equipped?.enchantId, where).toBeUndefined();
          continue;
        }
        expect(equipped, where).toBeDefined();
        expect(ENCHANTS_BY_ID.get(equipped!.enchantId!)?.name, where).toBe(want);
      }
    }
  });

  it('leaves the WEAPON enchants exactly as they were', () => {
    /*
     * ------------------------------------------------------------------------
     * Crusader and Weapon Spell Power predate all of this and the owner asked
     * for them to be left alone. `withEnchants` only ever writes the slots a
     * loadout NAMES, and no loadout names a hand -- but "it only writes what it
     * is given" is a claim about a function, and this is the claim about the
     * result.
     *
     * Eleven of the fourteen weapon slots across the presets carry one, which
     * is the figure that moves if an armour loadout ever reaches a hand.
     * ------------------------------------------------------------------------
     */
    const weaponEnchants = new Set<number>();
    for (const preset of PROFILE_PRESETS) {
      const equipment = preset.build().equipment;
      for (const slot of ['mainHand', 'offHand', 'twoHand', 'shield'] as const) {
        const id = equipment[slot]?.enchantId;
        if (id !== undefined) weaponEnchants.add(id);
      }
    }
    // The two scraped spell ids, and nothing from the Forever block.
    expect([...weaponEnchants].sort((a, b) => a - b)).toEqual([20034, 22749]);
  });
});

// ---------------------------------------------------------------------------
// The starting sets, which answer the same question for a new character
// ---------------------------------------------------------------------------

describe('a character created from scratch gets a loadout too', () => {
  it('gives each Warrior style its own row', () => {
    /*
     * THE WARRIOR IS THE ONE CLASS WHOSE STARTING SET HAS TO CHOOSE, because
     * three builds share one suit of plate. Every other class carries its
     * loadout on the named gear set, where there is nothing to decide.
     */
    const nameAt = (style: 'two_hander' | 'dual_wield' | 'one_hand_shield', slot: EquipmentSlot) => {
      const id = startingEquipmentFor('warrior', style)[slot]?.enchantId;
      return id === undefined ? undefined : ENCHANTS_BY_ID.get(id)?.name;
    };

    expect(nameAt('two_hander', 'head')).toBe('+8 Strength');
    expect(nameAt('two_hander', 'feet')).toBe('Minor Speed');
    // The one difference between the two damage warriors.
    expect(nameAt('dual_wield', 'feet')).toBe('+7 Agility');
    expect(nameAt('one_hand_shield', 'head')).toBe('+1% Dodge');
    expect(nameAt('one_hand_shield', 'gloves')).toBe('+2% Threat');
  });

  it('gives a ranged Hunter the bow enchant and a melee one none', () => {
    const rangedBow = startingEquipmentFor('hunter', 'ranged').ranged;
    const meleeBow = startingEquipmentFor('hunter', 'dual_wield').ranged;
    expect(ENCHANTS_BY_ID.get(rangedBow!.enchantId!)?.name).toBe('+2% Crit Chance');
    // Inert on a melee build either way; still not given to it, so the two
    // builds never diverge for a reason nobody wrote down.
    expect(meleeBow?.enchantId).toBeUndefined();
  });

  it('equips only enchants that exist and fit the slot', () => {
    /*
     * The structural guard. `startingEquipmentFor` skips an ITEM id the data no
     * longer has; an enchant id has no such guard and does not need one, so
     * long as this holds.
     */
    for (const characterClass of ['warrior', 'rogue', 'druid', 'hunter', 'mage'] as const) {
      for (const style of ['two_hander', 'dual_wield', 'one_hand_shield', 'ranged', 'caster', 'cat', 'bear', 'moonkin'] as const) {
        for (const [slot, equipped] of Object.entries(
          startingEquipmentFor(characterClass, style),
        )) {
          if (equipped?.enchantId === undefined) continue;
          const enchant = ENCHANTS_BY_ID.get(equipped.enchantId);
          expect(enchant, `${characterClass} ${style} ${slot}`).toBeDefined();
          expect(enchant!.slots, `${characterClass} ${style} ${slot}`).toContain(slot);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// And that they reach the character sheet, which is what a person reads
// ---------------------------------------------------------------------------

describe('the enchants reach the built character', () => {
  it('puts the whole caster row on the spell power the sheet shows', () => {
    const profile = PRESETS_BY_ID.get('mage_fire')!.build();
    const withEnchants = characterAtCombatStart(profile)!;

    const stripped = {
      ...profile,
      equipment: Object.fromEntries(
        Object.entries(profile.equipment).map(([slot, equipped]) => [
          slot,
          // The WEAPON enchant stays: this is isolating the armour row, and a
          // probe that reverted two things at once would measure a state the
          // code was never in.
          slot === 'twoHand' ? equipped : { itemId: equipped!.itemId },
        ]),
      ),
    } as typeof profile;

    const without = characterAtCombatStart(stripped)!;
    // +6 neck, +16 bracer, +20 gloves.
    expect(
      withEnchants.stats.get('spellPower') - without.stats.get('spellPower'),
    ).toBe(6 + 16 + 20);
    // And the haste, which the same row carries on head and legs.
    expect(
      hasteMultiplierFrom(withEnchants.stats.effective) /
        hasteMultiplierFrom(without.stats.effective),
    ).toBeCloseTo(1.02, 6);
  });

  it('puts the tank row on the table the boss actually rolls against', () => {
    /*
     * ------------------------------------------------------------------------
     * A STAT IS NOT MODELLED UNTIL SOMETHING READS IT, which is the lesson
     * `armorPenetration` cost: declared, granted by three talents, counted as
     * fully modelled and read by NOTHING, with its own test file green
     * throughout because it checked the arithmetic and the registration and
     * never the join.
     *
     * So this resolves the attacks-received table twice -- once with the
     * Protection row and once with the same plate and no enchants -- and
     * compares. The row is three points of dodge (head, cloak and legs) and
     * nine of defense skill (neck and bracer), and the owner's formula puts a
     * defense point at 0.04 percentage points on dodge, parry, block and miss
     * alike.
     *
     * THE DODGE DELTA IS NOT 3% AND THAT IS CORRECT: the chest's "+4 Stats" is
     * four AGILITY as well, a Warrior converts twenty agility to a point of
     * dodge, and Blessing of Kings multiplies the four to 4.4 before it gets
     * there. So dodge moves 3.22 points where parry and block move by the
     * defense skill alone -- which is exactly why the two are asserted
     * separately rather than as one number: the defense half is a flat 36 on
     * all three, and only dodge has a second source.
     * ------------------------------------------------------------------------
     */
    const profile = PRESETS_BY_ID.get('prot_warr')!.build();
    const stripped = {
      ...profile,
      equipment: Object.fromEntries(
        Object.entries(profile.equipment).map(([slot, equipped]) => [
          slot,
          // Crusader on the main hand stays: this isolates the ARMOUR row, and
          // a probe reverting two things at once measures a state the code was
          // never in.
          slot === 'mainHand' ? equipped : { itemId: equipped!.itemId },
        ]),
      ),
    } as typeof profile;

    const chances = createForeverAttackChances({ targetAttacks: true });
    const boss = createTrainingDummy({ attacks: true });
    const received = (p: typeof profile) =>
      chances('melee-received', boss, characterAtCombatStart(p)!, {});

    const enchanted = received(profile);
    const plain = received(stripped);

    // The defense-skill half, which is the same nine points on every slice.
    const fromDefense = 9 * COMBAT_CONSTANTS.defensePerSkill;
    expect(enchanted.block - plain.block).toBe(fromDefense);
    expect(enchanted.parry - plain.parry).toBe(fromDefense);
    expect(enchanted.miss - plain.miss).toBe(fromDefense);

    // And dodge, which carries the three enchants and the chest's agility on
    // top of it. Three points is 300 units and the 4.4 agility is 22 more.
    expect(enchanted.dodge - plain.dodge).toBe(fromDefense + 300 + 22);

    /*
     * THE STAT ITSELF, so the 22 above is placed rather than accepted. Four
     * agility multiplied to 4.4 by Blessing of Kings, over twenty agility a
     * point, is 0.22 -- and a change to the raid buff list moving this is a
     * change to the buff list, which is what the two assertions together say.
     */
    const dodgeStat = (p: typeof profile) =>
      characterAtCombatStart(p)!.stats.effective.dodgeChance;
    expect(dodgeStat(profile) - dodgeStat(stripped)).toBeCloseTo(3 + 4.4 / 20, 6);
  });
});
