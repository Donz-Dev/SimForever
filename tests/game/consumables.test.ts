import { describe, expect, it } from 'vitest';
import {
  CATEGORY_BY_CONSUMABLE_ID,
  CONSUMABLE_CATEGORIES,
  CONSUMABLES_BY_ID,
  consumableEffects,
  selectedConsumables,
  type ConsumableSelection,
} from '../../src/game/buffs/consumables';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { characterAtCombatStart } from '../../src/simulator';
import { createPet } from '../../src/game/actors/createPet';
import type { StatName } from '../../src/engine';
import { spellPowerFor } from '../../src/engine';
import { loadProfile } from '../../src/profiles';
import { createDefaultProfile } from '../../src/profiles/CharacterProfile';

/*
 * ==============================================================================
 * RULESET: CONSUMABLES, FROM THE OWNER'S TABLE.
 *
 * Twelve categories, at most one per category. The table is transcribed BY HAND
 * below rather than read back out of `consumables.ts` -- a test that reads the
 * source data passes no matter what the source data says.
 *
 * THE EXCLUSIVITY IS NOT TESTED AS A RULE, BECAUSE IT IS NOT ONE. A selection
 * is keyed by category, so two from one category is not representable and there
 * is nothing to enforce or to bypass. What IS tested is the one thing the shape
 * cannot stop: a consumable filed under a category it does not belong to.
 * ==============================================================================
 */

/** The owner's table, written out: category -> the effects it offers. */
const TABLE: Readonly<Record<string, readonly string[]>> = {
  Flask: ['+1200 Hit Points', '+150 Spell Power'],
  'Weapon Effect': ['+2% Melee Crit Chance', '+1% Spell Crit Chance & +36 Spell Power'],
  Strength: ['+30 Strength'],
  Agility: ['+25 Agility & +2% Crit Chance'],
  'Attack Power': ['+40 Attack Power'],
  'Blasted Lands': ['+25 Agility', '+25 Strength', '+25 Intellect', '+25 Spirit'],
  'Mana Regen': ['+12 MP5'],
  'Hit Points': ['+120 Hit Points'],
  Armor: ['+450 Armor'],
  'Spell Power': ['+35 Spell Power'],
  'School Spell Power': [
    '+40 Fire Spell Power',
    '+40 Shadow Spell Power',
    '+40 Arcane Spell Power',
    '+40 Frost Spell Power',
    '+40 Nature Spell Power',
    '+40 Holy Spell Power',
  ],
  Food: [
    '+40 Attack Power',
    '+33 Spell Power',
    '+44 Healing Power',
    '+20 Stamina',
    '+20 Strength',
    '+20 Agility',
  ],
  /*
   * AND THE TWO MID-FIGHT ROWS, which the owner gave as two further categories:
   * "Potions are the primary category" and "the 'Other' is the secondary
   * category". Exclusive within themselves and not with each other, which is
   * one map keyed by category and nothing to enforce.
   */
  Potion: [
    'Major Healing Potion',
    'Major Mana Potion',
    'Mighty Rage Potion',
    'Major Frenzy Potion',
    "Major Mender's Potion",
    'Major Spellblasting Potion',
  ],
  Other: ['Thistle Tea', 'Demonic Rune', 'Healthstone'],
};

/**
 * Who may drink what, from the two rows of the owner's table that say so.
 *
 * Written out by hand like everything else here: a test that read the class
 * lists off the catalogue would pass whatever the catalogue said.
 */
const CLASS_RESTRICTED: Readonly<Record<string, readonly string[]>> = {
  mighty_rage_potion: ['warrior', 'druid'],
  thistle_tea: ['rogue', 'druid'],
};

describe('the catalogue', () => {
  it('matches the owner table row for row, in order', () => {
    expect(CONSUMABLE_CATEGORIES.map((category) => category.name)).toEqual(Object.keys(TABLE));
    for (const category of CONSUMABLE_CATEGORIES) {
      expect(
        category.options.map((option) => option.name),
        category.name,
      ).toEqual(TABLE[category.name]);
    }
  });

  it('gives every consumable its own id', () => {
    const declared = CONSUMABLE_CATEGORIES.flatMap((category) => category.options);
    expect(CONSUMABLES_BY_ID.size).toBe(declared.length);
    // And each one knows the category it came from, which is what validation
    // checks a hand-edited profile against.
    for (const consumable of declared) {
      expect(CATEGORY_BY_CONSUMABLE_ID.get(consumable.id)).toBeDefined();
    }
  });

  it('declares the same effect twice when the table lists it twice', () => {
    /*
     * "+40 Attack Power" is its own CATEGORY and also a Food, and they are two
     * entries with two ids on purpose -- which is exactly what lets a character
     * take both and get eighty. Folding them into one id would have made the
     * second choice silently replace the first.
     */
    const attackPower = CONSUMABLES_BY_ID.get('elixir_attack_power');
    const food = CONSUMABLES_BY_ID.get('food_attack_power');
    /*
     * BOTH POOLS, BY THE OWNER'S RULING: "+40 Attack Power is truly Melee
     * Attack AND Ranged attack power for this consumable." It shipped as the
     * melee pool alone on the precedent every ITEM line sets, and the two
     * wordings are now known to mean different things -- so an item saying
     * "Attack Power" still means `attackPower`, and a consumable saying it
     * means both. Neither settles the other.
     *
     * THE SAME RULING REACHES THE FOOD, because the effect text is identical:
     * treating two identical lines differently would need a reason.
     */
    expect(attackPower?.stats).toEqual({ attackPower: 40, rangedAttackPower: 40 });
    expect(food?.stats).toEqual({ attackPower: 40, rangedAttackPower: 40 });
    expect(CATEGORY_BY_CONSUMABLE_ID.get('elixir_attack_power')).toBe('attack_power');
    expect(CATEGORY_BY_CONSUMABLE_ID.get('food_attack_power')).toBe('food');

    const both = consumableEffects({ attack_power: 'elixir_attack_power', food: 'food_attack_power' });
    expect(both.stats.attackPower).toBe(80);
    expect(both.stats.rangedAttackPower).toBe(80);
  });
});

describe('one per category, by construction', () => {
  it('cannot hold two from the same category', () => {
    /*
     * Not an assertion about behaviour so much as about the TYPE: a selection
     * is a map keyed by category, so the second write replaces the first and
     * there is no state in which both are held. The raid buffs next door need
     * `exclusiveWith` and a panel that honours it; this needs neither.
     */
    const selection: ConsumableSelection = { flask: 'flask_hit_points' };
    const replaced: ConsumableSelection = { ...selection, flask: 'flask_spell_power' };
    expect(selectedConsumables(replaced).map((c) => c.id)).toEqual(['flask_spell_power']);
    expect(consumableEffects(replaced).bonusHitPoints).toBe(0);
  });

  it('refuses a consumable filed under the wrong category', () => {
    /*
     * The one mistake the shape cannot prevent, and the only route to holding
     * the same consumable twice. A hand-edited profile could put the flask
     * under `food`; `selectedConsumables` looks it up WITHIN the category, so
     * it contributes nothing rather than stacking with a real food.
     */
    const smuggled = { food: 'flask_spell_power' } as ConsumableSelection;
    expect(selectedConsumables(smuggled)).toEqual([]);
    expect(consumableEffects(smuggled).stats).toEqual({});
  });

  it('ignores an id nothing declares, rather than throwing', () => {
    // A profile saved when a consumable existed should load after it is
    // renamed -- one missing consumable, not a character that cannot be built.
    expect(selectedConsumables({ flask: 'flask_of_the_invented' })).toEqual([]);
    expect(consumableEffects(undefined).bonusHitPoints).toBe(0);
  });
});

describe('what a consumable is worth', () => {
  const warriorWith = (consumables: ConsumableSelection) =>
    createPlayer({
      race: 'orc',
      characterClass: 'warrior',
      combatStyle: 'two_hander',
      consumables,
    });

  const delta = (consumables: ConsumableSelection, stat: StatName) =>
    warriorWith(consumables).stats.get(stat) - warriorWith({}).stats.get(stat);

  it('adds a flat stat to the starting block, before the conversions run', () => {
    /*
     * BEFORE, not after, which is the half worth testing: a Warrior converts
     * two attack power a strength, so thirty strength is sixty attack power as
     * well as thirty strength. A layer added afterwards would grant the primary
     * and none of what it buys.
     */
    expect(delta({ strength: 'elixir_strength' }, 'strength')).toBe(30);
    expect(delta({ strength: 'elixir_strength' }, 'attackPower')).toBe(60);
  });

  it('separates the two kinds of crit, because two tables read them', () => {
    // The Agility row's crit is the character-wide melee and ranged stat, which
    // is the owner's ruling on which of the two its wording meant.
    expect(delta({ agility: 'elixir_agility' }, 'critChance')).toBeCloseTo(
      2 + 25 / 20,
      6,
    );
    expect(delta({ weapon_effect: 'weapon_spell_crit' }, 'spellCritChance')).toBe(1);
    expect(delta({ weapon_effect: 'weapon_spell_crit' }, 'critChance')).toBe(0);
  });

  it('keeps the MELEE crit off the ranged tables', () => {
    /*
     * ------------------------------------------------------------------------
     * "+2% Melee Crit Chance" IS NOT `critChance`, and that is the whole point
     * of it carrying an attack-table modifier instead. `critChanceFrom` is the
     * engine's ONE crit function and both the melee and the ranged tables read
     * it -- so granting the stat would hand two points to every shot a Hunter
     * fires, from a line whose first word is "Melee".
     *
     * The owner's own pair of labels is what settles it: this row says "Melee"
     * and the Agility row does not, and they ruled the Agility one reaches
     * melee AND ranged. Two labels for one stat would be one label.
     * ------------------------------------------------------------------------
     */
    const hunter = createPlayer({
      race: 'orc',
      characterClass: 'hunter',
      combatStyle: 'ranged',
      consumables: { weapon_effect: 'weapon_melee_crit' },
    });
    expect(hunter.attackTableModifiers.for('melee-auto').critBonus).toBe(2);
    expect(hunter.attackTableModifiers.for('melee-special').critBonus).toBe(2);
    expect(hunter.attackTableModifiers.for('ranged-auto').critBonus ?? 0).toBe(0);
    expect(hunter.attackTableModifiers.for('ranged-special').critBonus ?? 0).toBe(0);
    // And it is not on the stat either, which is the mistake it avoids.
    expect(hunter.stats.get('critChance')).toBe(
      createPlayer({ race: 'orc', characterClass: 'hunter', combatStyle: 'ranged' }).stats.get(
        'critChance',
      ),
    );
  });

  it('grants flat hit points, which cannot be a stat', () => {
    /*
     * `STAT_NAMES` has no `hitPoints` -- health is a maximum derived from
     * stamina -- so this is the one effect in the table that reaches the
     * character by a route of its own. Asserted on the POOL rather than on a
     * stat, because there is no stat to read.
     */
    const plain = warriorWith({});
    const flasked = warriorWith({ flask: 'flask_hit_points' });
    expect(flasked.health.maximum - plain.health.maximum).toBe(1200);

    // And the two hit point entries are different categories, so they add.
    const both = warriorWith({ flask: 'flask_hit_points', hit_points: 'hit_points_120' });
    expect(both.health.maximum - plain.health.maximum).toBe(1320);
  });

  it('puts school spell power on the school and nowhere else', () => {
    const mage = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      combatStyle: 'caster',
      consumables: { school_spell_power: 'school_fire' },
    });
    const bare = createPlayer({ race: 'gnome', characterClass: 'mage', combatStyle: 'caster' });

    expect(spellPowerFor(mage, 'fire') - spellPowerFor(bare, 'fire')).toBe(40);
    expect(spellPowerFor(mage, 'frost') - spellPowerFor(bare, 'frost')).toBe(0);
    // NOT on the school-blind stat, which is the mistake the keyed route
    // exists to prevent -- 40 there would reach every school at once.
    expect(mage.stats.get('spellPower')).toBe(bare.stats.get('spellPower'));
  });

  it('adds the blind pool to every school, where the keyed one does not', () => {
    // The other half of the same distinction, and the one that says the test
    // above is about the ROUTE rather than about the number being small.
    const mage = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      combatStyle: 'caster',
      consumables: { spell_power: 'spell_power_35' },
    });
    const bare = createPlayer({ race: 'gnome', characterClass: 'mage', combatStyle: 'caster' });
    for (const school of ['fire', 'frost', 'arcane'] as const) {
      expect(spellPowerFor(mage, school) - spellPowerFor(bare, school), school).toBe(35);
    }
  });

  it('reports the two healing-power entries as doing nothing, and only those', () => {
    /*
     * An inert effect that SAYS it is inert is the honest failure mode. The
     * mirror assertion is the one that expires: any OTHER consumable gaining a
     * caveat, or either of these gaining a stat, has to be a deliberate edit
     * here.
     *
     * BOTH ARE HEALING POWER, AND THAT IS THE WHOLE LIST. Nothing a character
     * does in this simulator heals anybody, so there is no throughput for the
     * Food's +44 or the Major Mender's Potion's +75 to scale -- and they are the
     * only two entries in the owner's table that name it.
     */
    const inert = CONSUMABLE_CATEGORIES.flatMap((category) => category.options).filter(
      (option) => option.unmodelled !== undefined,
    );
    expect(inert.map((option) => option.name)).toEqual([
      '+44 Healing Power',
      "Major Mender's Potion",
    ]);
    for (const option of inert) expect(option.stats, option.name).toBeUndefined();
    expect(consumableEffects({ food: 'food_healing_power' }).unmodelled).toHaveLength(1);
    expect(consumableEffects({ potion: 'major_menders_potion' }).unmodelled).toHaveLength(1);
  });

  it('keeps every class-restricted consumable free of stats', () => {
    /*
     * ==========================================================================
     * THE CONDITION UNDER WHICH `consumableEffects` MAY STAY CLASS-BLIND.
     *
     * It takes a selection and no class, so a Mage carrying a hand-edited Mighty
     * Rage Potion would collect whatever stats it declared. That is safe today
     * for one reason only: both class-restricted entries grant an ABILITY and
     * nothing else, and `consumableAbilities` is where the class gate lives.
     *
     * So this is the guard on a property of the TABLE rather than of the
     * function. A class-restricted consumable that gained a stat would be a
     * bonus silently paid to every class -- "a condition nobody declared is not
     * an omission, it is a bonus being paid" -- and this fails until somebody
     * threads the class through instead.
     * ==========================================================================
     */
    const restricted = CONSUMABLE_CATEGORIES.flatMap((category) => category.options).filter(
      (option) => option.classes !== undefined,
    );
    expect(restricted.map((option) => option.id).sort()).toEqual(
      Object.keys(CLASS_RESTRICTED).sort(),
    );
    for (const option of restricted) {
      expect([...(option.classes ?? [])].sort(), option.id).toEqual(
        [...CLASS_RESTRICTED[option.id]].sort(),
      );
      expect(option.stats, option.id).toBeUndefined();
      expect(option.schoolPower, option.id).toBeUndefined();
      expect(option.bonusHitPoints, option.id).toBeUndefined();
      expect(option.attackTableModifiers, option.id).toBeUndefined();
    }
  });

  it('does not reach a Hunter’s pet', () => {
    /*
     * A pet inherits a share of its owner's stats, so this is NOT free the way
     * the bow enchant's ranged crit was -- `createPet` reads the owner's
     * finished block, and the owner's agility elixir is in it. What must not
     * happen is the pet collecting the MELEE CRIT MODIFIER, which lives on the
     * owner's combatant and is not a stat at all.
     */
    const owner = createPlayer({
      race: 'orc',
      characterClass: 'hunter',
      combatStyle: 'ranged',
      consumables: { weapon_effect: 'weapon_melee_crit' },
    });
    const pet = createPet({ owner, family: 'cat' });
    expect(owner.attackTableModifiers.for('melee-auto').critBonus).toBe(2);
    expect(pet.attackTableModifiers.for('melee-auto').critBonus ?? 0).toBe(0);
  });
});

describe('the profile field', () => {
  it('loads an older profile with nothing chosen', () => {
    /*
     * The version 9 decision rather than the version 10 one. A saved character
     * with no consumables was genuinely fighting without them, so the migration
     * must not change a single figure they recorded.
     */
    const old = { ...createDefaultProfile(), version: 11 } as Record<string, unknown>;
    delete old.consumables;
    const loaded = loadProfile(old);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.profile.consumables).toEqual({});
    expect(loaded.profile.version).toBe(13);
  });

  it('runs BOTH of the last two migrations, which once collided', () => {
    /*
     * ------------------------------------------------------------------------
     * THE REGRESSION TEST FOR A CLEAN MERGE THAT WAS ARITHMETICALLY WRONG. The
     * Warlock's stone and these consumables were written on two branches from
     * the same base; both took version 11 and both keyed their migration at 10,
     * and git merged the two tables WITHOUT A CONFLICT -- leaving one object
     * literal with `10` twice, where the second silently wins and the first
     * migration never runs.
     *
     * The typechecker caught that one (TS1117). This is what catches the next
     * one, because a migration table built any other way -- entries pushed into
     * a map, say -- would take both and run only one with nothing to say so.
     * A version 10 profile has to come out the far end carrying BOTH fields.
     * ------------------------------------------------------------------------
     */
    const old = { ...createDefaultProfile(), version: 10 } as Record<string, unknown>;
    delete old.consumables;
    delete old.warlockStone;
    const loaded = loadProfile(old);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.profile.version).toBe(13);
    expect(loaded.profile.consumables).toEqual({});
    expect(loaded.profile.warlockStone).toBe('none');
  });

  it('refuses a consumable stored under the wrong category', () => {
    const wrong = { ...createDefaultProfile(), consumables: { food: 'flask_spell_power' } };
    const loaded = loadProfile(wrong);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.issues[0].path).toBe('consumables.food');
  });

  it('survives a save and a load', () => {
    const profile = { ...createDefaultProfile(), consumables: { flask: 'flask_spell_power' } };
    const loaded = loadProfile(JSON.parse(JSON.stringify(profile)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.profile.consumables).toEqual({ flask: 'flask_spell_power' });
  });
});

describe('what each of the 24 presets opens with', () => {
  it('gives every preset a row, and every entry is legal', () => {
    for (const preset of PROFILE_PRESETS) {
      const selection = preset.build().consumables;
      expect(Object.keys(selection).length, preset.id).toBeGreaterThan(0);
      for (const [category, id] of Object.entries(selection)) {
        expect(CATEGORY_BY_CONSUMABLE_ID.get(id), `${preset.id} ${category}`).toBe(category);
      }
    }
  });

  it('leaves a ranged Hunter the categories it cannot read', () => {
    /*
     * ------------------------------------------------------------------------
     * THE EMPTY SLOTS ARE THE CLAIM. The Weapon Effect row offers a crit scoped
     * to the two melee tables -- the owner confirmed it "should not apply to
     * Hunter Ranged attacks" -- and a spell crit, and a bow is neither. And a
     * Hunter shot takes no spell coefficient at all, because Forever REMOVED
     * Arcane Shot's and gave it a ranged attack power one instead.
     *
     * ATTACK POWER WAS A FOURTH AND IS NOT ANY MORE. It shipped blank on the
     * reading every ITEM line sets -- bare "Attack Power" is the melee pool --
     * and the owner ruled the consumable feeds both. So this list is three now,
     * and the elixir is asserted PRESENT below rather than quietly dropped.
     * ------------------------------------------------------------------------
     */
    for (const id of ['bm_hunter', 'lw_ranged']) {
      const selection = PRESETS_BY_ID.get(id)!.build().consumables;
      for (const category of ['weapon_effect', 'spell_power', 'school_spell_power']) {
        expect(selection[category], `${id} ${category}`).toBeUndefined();
      }
      // And it takes what it CAN read, or the assertions above would pass on a
      // row that was simply empty.
      expect(selection.agility, id).toBe('elixir_agility');
      expect(selection.attack_power, id).toBe('elixir_attack_power');
      expect(selection.blasted_lands, id).toBe('blasted_agility');
      /*
       * THE FOOD IS AGILITY AND NOT THE "+40 Attack Power" THAT NOW REACHES THE
       * BOW, which is the one place the ruling could have changed a row and
       * does not: a Hunter converts at 2 ranged attack power an agility, so
       * twenty agility is the same forty with crit on top.
       */
      expect(selection.food, id).toBe('food_agility');
    }
  });

  it('gives a ranged Hunter the elixir’s ranged half, on the character', () => {
    /*
     * THE JOIN FOR THE NEW RULING. A stat declared on the consumable and never
     * reaching the bow would read exactly like this test's absence -- so it is
     * measured on the built character, where `rangedAttackPower` is the pool a
     * bow actually scales off.
     */
    const withElixir = createPlayer({
      race: 'orc',
      characterClass: 'hunter',
      combatStyle: 'ranged',
      consumables: { attack_power: 'elixir_attack_power' },
    });
    const bare = createPlayer({ race: 'orc', characterClass: 'hunter', combatStyle: 'ranged' });
    expect(
      withElixir.stats.get('rangedAttackPower') - bare.stats.get('rangedAttackPower'),
    ).toBe(40);
    expect(withElixir.stats.get('attackPower') - bare.stats.get('attackPower')).toBe(40);
  });

  it('splits Blasted Lands on the conversion table, not on the armour type', () => {
    /*
     * A Rogue gets 1 attack power from each primary and crit from agility, so
     * it takes agility. A DRUID gets 2 from strength and 1 from agility, so the
     * Cat takes STRENGTH -- which is the entry a reader assumes wrongly,
     * because a Cat and a Rogue wear the same leather and stack the same stat
     * everywhere else.
     */
    expect(PRESETS_BY_ID.get('rogue_venom')!.build().consumables.blasted_lands).toBe(
      'blasted_agility',
    );
    expect(PRESETS_BY_ID.get('druid_cat')!.build().consumables.blasted_lands).toBe(
      'blasted_strength',
    );
  });

  it('picks the school each profile MEASURED, not the one its name suggests', () => {
    /*
     * Three of these are not guessable from the class. The Moonkin is 71%
     * arcane and 29% nature; the Frostfire Mage is 62% FIRE and 38% frost; the
     * Elemental Shaman is 56% nature and 44% fire. All three were measured off
     * the damage stream before the row was written.
     */
    const schoolOf = (id: string) =>
      PRESETS_BY_ID.get(id)!.build().consumables.school_spell_power;
    expect(schoolOf('druid_moonkin')).toBe('school_arcane');
    expect(schoolOf('mage_frostfire')).toBe('school_fire');
    expect(schoolOf('shaman_elemental')).toBe('school_nature');
    expect(schoolOf('warlock_firelock')).toBe('school_fire');
    expect(schoolOf('shadow_priest')).toBe('school_shadow');
  });

  it('reaches the character the fight builds', () => {
    /*
     * THE JOIN, not the registration. A row on a preset that never reached
     * `createPlayer` would pass every assertion above -- which is the shape
     * `armorPenetration` shipped in, declared and granted and read by nothing.
     */
    const profile = PRESETS_BY_ID.get('mage_fire')!.build();
    const withRow = characterAtCombatStart(profile)!;
    const without = characterAtCombatStart({ ...profile, consumables: {} })!;

    // Flask 150, weapon effect 36, Spell Power 35, Food 33 -- all school-blind.
    expect(withRow.stats.get('spellPower') - without.stats.get('spellPower')).toBe(
      150 + 36 + 35 + 33,
    );
    // And the Fire school on top of that, which only Fire damage reads.
    expect(spellPowerFor(withRow, 'fire') - spellPowerFor(without, 'fire')).toBe(
      150 + 36 + 35 + 33 + 40,
    );
    expect(spellPowerFor(withRow, 'frost') - spellPowerFor(without, 'frost')).toBe(
      150 + 36 + 35 + 33,
    );
    // The flat hit points, which take their own route to the pool.
    expect(withRow.health.maximum - without.health.maximum).toBe(120);
  });
});
