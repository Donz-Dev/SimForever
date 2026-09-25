import { describe, expect, it } from 'vitest';
import type { Equipment } from '../../src/game/items/Item';
import {
  CRUSADER,
  ITEMS,
  ITEMS_BY_ID,
  SPELL_POWER_ENCHANT,
  enchantsForSlot,
  itemsForSlot,
} from '../../src/game/items/itemData';
import {
  BASE_WEAPON_SKILL,
  liveEquipment,
  statsForStyle,
  unmodelledEffects,
  weaponsForEquipment,
} from '../../src/game/items/equipment';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { attackPowerCoefficientFor } from '../../src/game/combat/weaponDamage';

/*
 * Every number below is transcribed BY HAND from the item's Wowhead tooltip,
 * not read back out of the data file. A test that asked the data what the data
 * said would pass whatever the data said.
 *
 * These are WoW CLASSIC items in a WoW: Forever simulator. That is deliberate
 * -- real weapon numbers beat invented placeholders -- but it means nothing
 * here is Forever data.
 */

interface WeaponSpec {
  readonly id: number;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly speed: number;
  readonly dps: number;
}

const WEAPONS: readonly WeaponSpec[] = [
  { id: 17075, name: "Vis'kag the Bloodletter", min: 100, max: 187, speed: 2.6, dps: 55.19 },
  { id: 228265, name: 'Brutality Blade', min: 92, max: 171, speed: 2.5, dps: 52.6 },
  { id: 228229, name: 'Obsidian Edged Blade', min: 187, max: 280, speed: 3.6, dps: 64.86 },
  { id: 17069, name: "Striker's Mark", min: 69, max: 129, speed: 2.5, dps: 39.6 },
];

/** The eight Tier 1 pieces, with the stats printed on each. */
const MIGHT_SET: readonly (readonly [id: number, name: string, str: number, sta: number, armor: number])[] = [
  [226495, 'Jaws of Might', 32, 20, 608],
  [226492, 'Pauldrons of Might', 22, 8, 562],
  [226494, 'Hauberk of Might', 26, 13, 749],
  [226499, 'Armguards of Might', 19, 9, 328],
  [226497, 'Hands of Might', 25, 15, 468],
  [226498, 'Sash of Might', 24, 8, 421],
  [226493, 'Leggings of Might', 32, 19, 655],
  [226496, 'Treads of Might', 24, 9, 515],
];

describe('the item data', () => {
  it('holds both item files, and no id twice', () => {
    /*
     * NINE FILES, and the count is per file so that one failing to load is a
     * failure rather than a shorter list nobody notices.
     *
     *   classic-warrior 19, sod-hunter 12, sod-rogue 13, sod-druid 35,
     *   sod-shaman 20, sod-mage 8, sod-paladin 27, sod-warlock 8, sod-priest 9
     *
     * Every one of them is SHORTER than the set it came from, because
     * twenty-two pieces are worn by more than one set and an id belongs to the
     * first file that asks for it -- `tools/item-sets.json` decides which.
     * `itemData` throws on a duplicate, which is what makes that safe.
     */
    const PER_FILE = [19, 12, 13, 35, 20, 8, 27, 8, 9];
    const total = PER_FILE.reduce((sum, count) => sum + count, 0);
    expect(total).toBe(151);
    expect(ITEMS).toHaveLength(total);
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(total);
  });

  /*
   * The first FOREVER item, as opposed to the eighteen Classic stand-ins around
   * it. Transcribed by hand from the tooltip at
   * https://www.wowhead.com/forever/item=19321.
   */
  it('has the Forever shield, with its block stats modelled', () => {
    const shield = ITEMS_BY_ID.get(19321);
    expect(shield).toBeDefined();
    if (!shield) return;

    expect(shield.name).toBe('The Immovable Object');
    expect(shield.slots).toEqual(['shield']);
    expect(shield.stats.armor).toBe(2468);
    expect(shield.stats.stamina).toBe(15);
    expect(shield.source).toContain('/forever/');

    /*
     * BOTH LINES ARE BLOCK VALUE, and this test used to say otherwise.
     *
     * "44 Block" on a shield is its INHERENT BLOCK VALUE, not a chance. Read
     * as a chance it gave The Immovable Object a 44% chance to block, which is
     * wrong in a way that looks entirely plausible on a tank. It adds to the
     * "+27 Block Value" line: 44 + 27 = 71.
     *
     * The shield grants no block CHANCE at all. That comes from the flat 5%
     * for holding one, from talents, from defense skill and from Shield Block.
     */
    expect(shield.stats.blockValue).toBe(71);
    expect(shield.stats.blockChance).toBeUndefined();
    expect(shield.unmodelled.map((effect) => effect.text)).toEqual([]);
  });

  it.each(MIGHT_SET)('%s: %s has the stated strength, stamina and armor', (id, name, str, sta, armor) => {
    const item = ITEMS_BY_ID.get(id);
    expect(item, String(id)).toBeDefined();
    if (!item) return;

    expect(item.name).toBe(name);
    expect(item.stats.strength).toBe(str);
    expect(item.stats.stamina).toBe(sta);
    expect(item.stats.armor).toBe(armor);
  });

  it.each(WEAPONS)('$name has the stated damage and speed', (spec) => {
    const item = ITEMS_BY_ID.get(spec.id);
    expect(item, spec.name).toBeDefined();
    if (!item?.weapon) return;

    expect(item.name).toBe(spec.name);
    expect(item.weapon.minDamage).toBe(spec.min);
    expect(item.weapon.maxDamage).toBe(spec.max);
    expect(item.weapon.speed).toBe(spec.speed);
    // The loader already checks damage against speed against dps and throws on
    // a mismatch; this confirms the figure it checked against.
    expect(item.weapon.dps).toBeCloseTo(spec.dps, 2);
    expect((spec.min + spec.max) / 2 / spec.speed).toBeCloseTo(spec.dps, 1);
  });

  it('reads the attack power, hit and crit off the effect text', () => {
    // Don Julio's Band: +11 Stamina, 1% crit, 1% hit, +16 Attack Power.
    const ring = ITEMS_BY_ID.get(19325);
    expect(ring?.stats).toMatchObject({
      stamina: 11,
      critChance: 1,
      hitChance: 1,
      attackPower: 16,
    });

    // Quick Strike Ring: +5 Strength, +8 Stamina, 1% crit, +36 Attack Power.
    expect(ITEMS_BY_ID.get(228261)?.stats).toMatchObject({
      strength: 5,
      stamina: 8,
      critChance: 1,
      attackPower: 36,
    });

    // Cape of the Black Baron: 45 armor, +15 Agility, +20 Attack Power.
    expect(ITEMS_BY_ID.get(13340)?.stats).toMatchObject({
      armor: 45,
      agility: 15,
      attackPower: 20,
    });
  });

  it('adds up the hit and crit the Might set grants', () => {
    // Five pieces give 1% hit each; Hauberk gives 2% crit and Jaws and
    // Leggings 1% each.
    const set = MIGHT_SET.map(([id]) => ITEMS_BY_ID.get(id));
    const hit = set.reduce((sum, item) => sum + (item?.stats.hitChance ?? 0), 0);
    const crit = set.reduce((sum, item) => sum + (item?.stats.critChance ?? 0), 0);

    expect(hit).toBe(5);
    expect(crit).toBe(4);
  });

  it('takes weapon skill off the Obsidian Edged Blade rather than calling it a stat', () => {
    // "Increased Two-handed Swords +3" is not a stat; it shifts the combat
    // table through the weapon's skill.
    const blade = ITEMS_BY_ID.get(228229);
    expect(blade?.weapon?.bonusSkill).toBe(3);
    expect(blade?.stats.strength).toBe(42);
  });

  it('puts each item in the right slots', () => {
    expect(ITEMS_BY_ID.get(17075)?.slots).toEqual(['mainHand', 'offHand']);
    expect(ITEMS_BY_ID.get(228229)?.slots).toEqual(['twoHand']);
    expect(ITEMS_BY_ID.get(17069)?.slots).toEqual(['ranged']);
    expect(ITEMS_BY_ID.get(19325)?.slots).toEqual(['ring1', 'ring2']);
    expect(ITEMS_BY_ID.get(11815)?.slots).toEqual(['trinket1', 'trinket2']);
    expect(ITEMS_BY_ID.get(13340)?.slots).toEqual(['cloak']);
  });

  it('offers the right items per slot', () => {
    /*
     * NOT AN EXHAUSTIVE LIST ANY MORE. With nine classes' gear on file the
     * head slot alone holds a dozen, and a test that lists them all breaks
     * every time a set arrives while saying nothing about the mapping. What
     * matters is that each KIND of item lands where it belongs, so one of each
     * is named and the exclusions are asserted instead.
     */
    const names = (slot: Parameters<typeof itemsForSlot>[0]) =>
      itemsForSlot(slot).map((item) => item.name);

    expect(names('head')).toContain('Jaws of Might');
    expect(names('head')).toContain('Crown of Prophecy');
    expect(names('mainHand')).toContain("Vis'kag the Bloodletter");
    expect(names('twoHand')).toContain('Obsidian Edged Blade');
    expect(names('twoHand')).toContain('Anathema');

    // A two-hander is never offered for one hand, and a one-hander never for
    // two. That is what makes the style rules able to pick one or the other.
    expect(names('mainHand')).not.toContain('Obsidian Edged Blade');
    expect(names('twoHand')).not.toContain("Vis'kag the Bloodletter");

    /*
     * A SHIELD IS RESOLVED BY SUBCLASS, so it goes in `shield` and never in the
     * off-hand WEAPON slot where a dual-wielder could swing it. Earth and Fire
     * is a caster shield and obeys the same rule.
     */
    expect(names('shield')).toContain('The Immovable Object');
    expect(names('shield')).toContain('Earth and Fire');
    expect(names('offHand')).not.toContain('Earth and Fire');

    // A relic is offered nowhere else, and nothing else is offered as one.
    expect(names('relic')).toContain('Idol of the Moon');
    expect(names('relic')).toContain('Libram of Hope');
    expect(names('relic').every((name) => /Idol|Libram|Totem/.test(name))).toBe(true);
    expect(names('trinket1')).not.toContain('Idol of the Moon');

    // A wand is a RANGED item, alongside the bows.
    expect(names('ranged')).toContain('Crimson Shocker');
    expect(names('ranged')).toContain("Striker's Mark");
  });

  it('reads spell power, spell crit and defense off the effect text', () => {
    /*
     * Four rules that arrived with the caster and tank sets. Every figure is
     * transcribed by hand from the item's own tooltip.
     */

    // Staff of Dominance: "Increases damage and healing done by magical spells
    // and effects by up to 47", and 2% crit "with all spells and attacks".
    const staff = ITEMS_BY_ID.get(228271);
    expect(staff?.stats.spellPower).toBe(47);

    /*
     * "WITH ALL SPELLS AND ATTACKS" IS TWO STATS. `critChance` and
     * `spellCritChance` are read by different tables, so a line that says both
     * has to grant both -- it used to grant only the melee half, which was
     * invisible until there was caster gear to notice it on.
     */
    expect(staff?.stats.critChance).toBe(2);
    expect(staff?.stats.spellCritChance).toBe(2);

    // Eye of the Beast: "with spells" and nothing else, so spells only.
    const eye = ITEMS_BY_ID.get(13968);
    expect(eye?.stats.spellCritChance).toBe(2);
    expect(eye?.stats.critChance).toBeUndefined();

    // Blackhand's Breadth: no qualifier at all, so physical only.
    const breadth = ITEMS_BY_ID.get(13965);
    expect(breadth?.stats.critChance).toBe(2);
    expect(breadth?.stats.spellCritChance).toBeUndefined();

    /*
     * Earthen Guard: "Increased Defense +7" and "Increases the block value of
     * your shield by 12", on top of the shield's own "44 Block".
     *
     * Defense had to beat `WEAPON_SKILL_PATTERN`, which matches `Increased
     * <anything> +N` and was turning it into a weapon's bonus skill -- dropped
     * entirely, because a shield has no weapon to carry one.
     */
    const guard = ITEMS_BY_ID.get(20688);
    expect(guard?.stats.defenseSkill).toBe(7);
    expect(guard?.stats.blockValue).toBe(44 + 12);

    // And the weapon-skill line itself still reads as weapon skill.
    expect(ITEMS_BY_ID.get(228229)?.weapon?.bonusSkill).toBe(3);

    /*
     * A SCHOOL-SPECIFIC LINE IS NOT SPELL POWER. Anathema's +75 is Shadow only
     * and `spellPower` is school-blind, so it is listed rather than applied --
     * if this ever starts passing as spell power, the Priest's Holy spells got
     * a bonus the item never gave them.
     */
    const anathema = ITEMS_BY_ID.get(228336);
    expect(anathema?.stats.spellPower).toBeUndefined();
    expect(anathema?.unmodelled.map((effect) => effect.text)).toContain(
      'Increases damage done by Shadow spells and effects by up to 75.',
    );
  });

  it('keeps a set bonus as text rather than dropping it', () => {
    /*
     * A set bonus reads "(4) Set : ..." and starts with a bracket, so it
     * matched no prefix and no bare-number rule and was DROPPED -- not
     * unmodelled, dropped. Nothing else in this parser is allowed to do that.
     * Twenty profiles now wear Tier 1, and the Priest's four-piece is a flat
     * +2% spell crit that would have read as simply missing.
     */
    const crown = ITEMS_BY_ID.get(226584);
    const sets = crown?.unmodelled.filter((effect) => effect.kind === 'Set') ?? [];
    expect(sets.map((effect) => effect.text)).toContain(
      '(4) Increases your critical strike chance with spells and attacks by 2%.',
    );
    for (const bonus of sets) {
      expect(bonus.reason).toContain('set bonus');
    }
  });
});

describe('what the items do that the simulator does not', () => {
  it("does not list Vis'kag's proc as missing, now that it is implemented", () => {
    const viskag = ITEMS_BY_ID.get(17075);
    expect(viskag?.stats).toEqual({});
    // The chance-on-hit is a reaction in procs.ts, so it is neither a stat nor
    // a gap.
    expect(viskag?.unmodelled).toEqual([]);
  });

  it("keeps Hand of Justice's attack power and implements its proc", () => {
    const hoj = ITEMS_BY_ID.get(11815);
    expect(hoj?.stats.attackPower).toBe(20);
    expect(hoj?.unmodelled).toEqual([]);
  });

  it('does NOT list resistances as unmodelled any more', () => {
    /*
     * They are carried on the item and totalled on the character sheet
     * instead. Nineteen slots of plate produced a wall of rows saying the same
     * thing nineteen times, which buried the effects that genuinely have no
     * mechanic behind them.
     */
    const chest = ITEMS_BY_ID.get(226494);
    expect(chest?.unmodelled.some((e) => /Resistance/.test(e.text))).toBe(false);
    // Still on the item, for the sheet to total.
    expect(chest?.resistances.fire).toBeGreaterThan(0);
  });

  it('grants Crusader no flat stats, because its strength is a proc', () => {
    expect(CRUSADER.name).toBe('Enchant Weapon - Crusader');
    // The +100 Strength is an aura from a proc, not a permanent stat.
    expect(CRUSADER.stats).toEqual({});
    /*
     * NOTHING is unmodelled any more. The heal was, and its reason said
     * "Nothing damages the player, so a heal would restore nothing" -- true
     * when written, and expired the day the target started killing people.
     */
    expect(CRUSADER.unmodelled).toEqual([]);
  });

  it('offers both weapon enchants on melee weapons only', () => {
    // Crusader and Spell Power. Both are melee-weapon enchants; the caster sets
    // put the second on a staff, which is one.
    expect(enchantsForSlot('mainHand').map((e) => e.id)).toEqual([20034, 22749]);
    expect(enchantsForSlot('offHand').map((e) => e.id)).toEqual([20034, 22749]);
    expect(enchantsForSlot('twoHand').map((e) => e.id)).toEqual([20034, 22749]);
    // Explicitly not the bow.
    expect(enchantsForSlot('ranged')).toEqual([]);
    expect(enchantsForSlot('head')).toEqual([]);

    // Crusader is a proc and carries no stat; Spell Power is a flat 30, which
    // the source states as "add up to 30 damage to spells".
    expect(CRUSADER.stats).toEqual({});
    expect(SPELL_POWER_ENCHANT.stats).toEqual({ spellPower: 30 });
  });

  it('lists what an equipped set fails to model', () => {
    const equipment: Equipment = {
      mainHand: { itemId: 17075, enchantId: 20034 },
      trinket1: { itemId: 11815 },
    };
    const missing = unmodelledEffects(equipment, 'dual_wield');

    // Vis'kag's proc, Crusader's strength and heal, and Hand of Justice's
    // extra attack are all implemented. This set is fully simulated.
    expect(missing).toEqual([]);
  });
});

describe('equipping', () => {
  const FULL: Equipment = {
    head: { itemId: 226495 },
    shoulders: { itemId: 226492 },
    chest: { itemId: 226494 },
    wrists: { itemId: 226499 },
    gloves: { itemId: 226497 },
    waist: { itemId: 226498 },
    legs: { itemId: 226493 },
    feet: { itemId: 226496 },
    mainHand: { itemId: 17075 },
    offHand: { itemId: 228265 },
    twoHand: { itemId: 228229 },
    ranged: { itemId: 17069 },
    neck: { itemId: 228685 },
    ring1: { itemId: 19325 },
    ring2: { itemId: 228261 },
    trinket1: { itemId: 13965 },
    trinket2: { itemId: 11815 },
    cloak: { itemId: 13340 },
  };

  it('keeps a stat-stick off hand, and a shield in one, for its STATS', () => {
    /*
     * ------------------------------------------------------------------------
     * THE MIRROR OF THE MAIN-HAND BUG, AND IT SURVIVED THAT FIX.
     *
     * `offHand: 'stat-stick'` means held, contributing stats, never swinging --
     * the same words the main hand's version uses. Five styles say it, and
     * `liveEquipment` deleted both off-hand slots for every one of them, so an
     * Elemental shaman holding Earth and Fire got nothing at all from a CASTER
     * shield worth 26 spell power, 9 stamina and 7 intellect.
     *
     * The swing side was always right, and is what makes keeping the slot safe:
     * `weaponsForEquipment` refuses to build a weapon for a stat-stick hand.
     * ------------------------------------------------------------------------
     */
    const caster: Equipment = {
      mainHand: { itemId: 228263 }, // Sorcerous Dagger
      shield: { itemId: 228142 }, // Earth and Fire
    };

    const live = liveEquipment(caster, 'caster');
    expect(live.mainHand).toBeDefined();
    expect(live.shield).toBeDefined();

    // 36 from the dagger and 26 from the shield, and neither swings.
    expect(statsForStyle(caster, 'caster').spellPower).toBe(36 + 26);
    expect(weaponsForEquipment(caster, 'caster')).toEqual({});

    // A style that fills the off hand with a WEAPON still drops a shield, and a
    // two-hand style drops both.
    expect(liveEquipment(caster, 'dual_wield').shield).toBeUndefined();
    expect(liveEquipment(caster, 'two_hander').shield).toBeUndefined();
    expect(liveEquipment(caster, 'two_hander').mainHand).toBeUndefined();
  });

  it('uses the one-handers while dual-wielding and ignores the two-hander', () => {
    const weapons = weaponsForEquipment(FULL, 'dual_wield');

    expect(weapons.mainHand?.name).toBe("Vis'kag the Bloodletter");
    expect(weapons.offHand?.name).toBe('Brutality Blade');
    // Dual-wield has no ranged slot, so the bow does not swing.
    expect(weapons.ranged).toBeUndefined();
  });

  it('uses the two-hander in the main hand for a two-handed style', () => {
    const weapons = weaponsForEquipment(FULL, 'two_hander');

    expect(weapons.mainHand?.name).toBe('Obsidian Edged Blade');
    expect(weapons.offHand).toBeUndefined();
  });

  it("does not bank the two-hander's strength while dual-wielding", () => {
    // Obsidian Edged Blade is +42 Strength. A dual-wielder must not get it.
    const dual = statsForStyle(FULL, 'dual_wield');
    const twoHand = statsForStyle(FULL, 'two_hander');

    expect(twoHand.strength! - dual.strength!).toBe(42 - 10);
    expect(liveEquipment(FULL, 'dual_wield').twoHand).toBeUndefined();
    expect(liveEquipment(FULL, 'two_hander').mainHand).toBeUndefined();
  });

  it('KEEPS a two-hander a stat-stick style is holding', () => {
    /*
     * ------------------------------------------------------------------------
     * The Ranged and Caster styles declare `mainHand: 'stat-stick'` and say in
     * as many words that melee weapons may be equipped and never swing. This
     * used to read "not two-hand" as "one-hand" and delete the two-hander, so
     * a Hunter holding Dreadforge Retaliator as a stat stick silently lost its
     * 12 agility and 30 attack power, and a caster holding a STAFF would lose
     * the lot.
     *
     * The same mistake as stripping the ranged slot from a melee character,
     * in the other direction: taking away a slot the style can actually fill.
     * ------------------------------------------------------------------------
     */
    const twoHandOnly: Equipment = { twoHand: { itemId: 227981 } }; // Dreadforge Retaliator

    const oneHandOnly: Equipment = { mainHand: { itemId: 17075 } }; // Vis'kag

    for (const style of ['ranged', 'caster'] as const) {
      expect(liveEquipment(twoHandOnly, style).twoHand, style).toBeDefined();
      expect(statsForStyle(twoHandOnly, style).agility, style).toBe(12);

      /*
       * HELD, AND NEVER SWUNG -- neither kind produces a weapon.
       *
       * An earlier version of this test asserted the OPPOSITE, on the
       * reasoning that `mainHand` was never stripped from a stat-stick style
       * so a held one-hander had always produced a weapon profile here, and
       * that the two kinds should therefore agree. They should, and they were
       * agreeing on the wrong answer: `createPlayer` merges these OVER the
       * style's own weapons, so a profile returned here replaces a Cat's paw.
       * A Druid in form was swinging an Obsidian Edged Blade.
       */
      expect(weaponsForEquipment(oneHandOnly, style).mainHand, style).toBeUndefined();
      expect(weaponsForEquipment(twoHandOnly, style).mainHand, style).toBeUndefined();
    }

    // A swinging style is unchanged: it still picks one hand or the other.
    expect(liveEquipment(twoHandOnly, 'dual_wield').twoHand).toBeUndefined();
    expect(liveEquipment(twoHandOnly, 'two_hander').twoHand).toBeDefined();
  });

  it('still refuses to hold a one-hander and a two-hander at once', () => {
    // A stat-stick style can hold either, but not both. The two-hander
    // yields, which is the same loser the swinging styles pick.
    const both: Equipment = {
      mainHand: { itemId: 17075 }, // Vis'kag
      twoHand: { itemId: 227981 }, // Dreadforge Retaliator
    };
    expect(liveEquipment(both, 'ranged').twoHand).toBeUndefined();
    expect(liveEquipment(both, 'ranged').mainHand).toBeDefined();
  });

  it('reproduces the weapon damage range through the engine profile', () => {
    // 100-187 has a midpoint of 143.5, so the variance is 43.5/143.5. The
    // engine rolls baseDamage * [1-v, 1+v], which must give back 100-187.
    const weapons = weaponsForEquipment(FULL, 'dual_wield');
    const mh = weapons.mainHand;
    expect(mh).toBeDefined();
    if (!mh) return;

    expect(mh.baseDamage).toBeCloseTo(143.5, 6);
    const variance = mh.damageVariance ?? 0;
    expect(mh.baseDamage * (1 - variance)).toBeCloseTo(100, 6);
    expect(mh.baseDamage * (1 + variance)).toBeCloseTo(187, 6);
  });

  it('derives the attack power coefficient from the weapon speed', () => {
    const mh = weaponsForEquipment(FULL, 'dual_wield').mainHand;
    // 2.6 second weapon, by Forever's universal speed / 14.
    expect(mh?.swingTimerMs).toBe(2600);
    expect(mh?.powerCoefficient).toBeCloseTo(attackPowerCoefficientFor(2600), 10);
    expect(mh?.powerCoefficient).toBeCloseTo(2.6 / 14, 10);
  });

  it('carries weapon skill onto the two-hander and leaves the rest at base', () => {
    expect(weaponsForEquipment(FULL, 'two_hander').mainHand?.skill).toBe(BASE_WEAPON_SKILL + 3);
    expect(weaponsForEquipment(FULL, 'dual_wield').mainHand?.skill).toBe(BASE_WEAPON_SKILL);
  });

  it('gives the bow no rage generation', () => {
    const ranged = weaponsForEquipment(FULL, 'ranged').ranged;
    expect(ranged?.name).toBe("Striker's Mark");
    expect(ranged?.generates).toBeUndefined();
  });

  it('changes the character the simulation builds', () => {
    const bare = createPlayer({ race: 'human', characterClass: 'warrior', combatStyle: 'dual_wield' });
    const geared = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: FULL,
    });

    expect(geared.stats.effective.strength).toBeGreaterThan(bare.stats.effective.strength);
    expect(geared.stats.effective.attackPower).toBeGreaterThan(bare.stats.effective.attackPower);
    expect(geared.weapons.mainHand?.name).toBe("Vis'kag the Bloodletter");
    // The placeholder is gone once something real is equipped.
    expect(bare.weapons.mainHand?.name).toBe('Melee');
  });

  it('keeps a placeholder only for a slot nothing is equipped in', () => {
    const partial: Equipment = { mainHand: { itemId: 17075 } };
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: partial,
    });

    expect(player.weapons.mainHand?.name).toBe("Vis'kag the Bloodletter");
    expect(player.weapons.offHand?.name).toBe('Melee (Off Hand)');
  });
});

describe('the dual-wield off-hand penalty', () => {
  it('applies to an equipped off-hand without being asked for', () => {
    // A regression guard. The penalty used to be set only when a caller passed
    // an explicit multiplier, so an equipped off-hand swung at full damage
    // while the placeholder one -- which defaulted -- did not. That doubled the
    // off-hand's contribution and was invisible except in the totals.
    const equipment: Equipment = {
      mainHand: { itemId: 17075 },
      offHand: { itemId: 228265 },
    };
    const weapons = weaponsForEquipment(equipment, 'dual_wield');

    expect(weapons.offHand?.damageMultiplier).toBe(0.5);
    expect(weapons.mainHand?.damageMultiplier).toBeUndefined();
  });

  it('still honours an explicit override, for talents that change it', () => {
    const weapons = weaponsForEquipment(
      { offHand: { itemId: 228265 } },
      'dual_wield',
      { offHandDamageMultiplier: 0.75 },
    );
    expect(weapons.offHand?.damageMultiplier).toBe(0.75);
  });
});
