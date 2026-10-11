import { describe, expect, it } from 'vitest';
import type { Equipment } from '../../src/game/items/Item';
import {
  CRUSADER,
  EFFECT_RULES,
  FOREVER_OVERRIDDEN_IDS,
  ITEMS,
  ITEMS_BY_ID,
  SPELL_POWER_ENCHANT,
  enchantsForSlot,
  itemsForSlot,
} from '../../src/game/items/itemData';
import {
  BASE_WEAPON_SKILL,
  liveEquipment,
  schoolPowerForStyle,
  statsForStyle,
  unmodelledEffects,
  weaponsForEquipment,
} from '../../src/game/items/equipment';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { BENCHMARK_ITEMS } from '../../src/game/items/benchmarkSets';
import foreverNewEpics from '../../src/data/items/forever-new-epics.json';
import foreverNewRares from '../../src/data/items/forever-new-rares.json';
import foreverChangedEpics from '../../src/data/items/forever-changed-epics.json';
import foreverChangedRares from '../../src/data/items/forever-changed-rares.json';
import foreverSame from '../../src/data/items/forever-same.json';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { attackPowerCoefficientFor } from '../../src/game/combat/weaponDamage';

/*
 * Every number below is transcribed BY HAND from the item's own tooltip, not
 * read back out of the data file. A test that asked the data what the data said
 * would pass whatever the data said.
 *
 * ============================================================================
 * THESE ARE FOREVER'S OWN ITEMS NOW. This file used to open with a warning that
 * everything it named was a WoW Classic or Season of Discovery stand-in; those
 * nine files are deleted and `src/data/items/` holds five captures from
 * `foreverchanges.pro` and nothing else.
 *
 * WHICH MEANS EVERY FIXTURE HERE CHANGED, and the subject did not: this file is
 * about the LOADER and the EQUIPMENT RULES, so each test was re-pointed at a
 * Forever item that exercises the same rule. Where no Forever item carries a
 * wording -- Classic's "Improves your chance to get a critical strike by 2%",
 * which Forever writes as a rating -- the test asserts that nothing does,
 * because a rule matching nothing is how the ranged attack power bug hid.
 * ============================================================================
 */

interface WeaponSpec {
  readonly id: number;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly speed: number;
  readonly dps: number;
}

/**
 * Four Forever weapons, one per hand the engine knows about.
 *
 * The dps is the figure the LOADER cross-checks, `(min + max) / 2 / speed`, and
 * not the one-decimal figure the tooltip prints: Forever's own tooltip rounds
 * "59.5 damage per second" off 59.4828.
 */
const WEAPONS: readonly WeaponSpec[] = [
  { id: 16345, name: "High Warlord's Blade", min: 138, max: 207, speed: 2.9, dps: 59.48 },
  { id: 18877, name: "High Warlord's Greatsword", min: 235, max: 353, speed: 3.8, dps: 77.37 },
  { id: 18835, name: "High Warlord's Recurve", min: 66, max: 100, speed: 1.8, dps: 46.11 },
  { id: 21126, name: "Death's Sting", min: 83, max: 156, speed: 1.8, dps: 66.39 },
];

/**
 * Four pieces of the Battlegear of Heroism, Forever's own plate.
 *
 * The set is eight in the client and four of them are in this capture, which is
 * enough to say what the parser does with plate: armour, two or three
 * primaries, one rating, and four set bonuses that are kept as text.
 */
const HEROISM: readonly (readonly [id: number, name: string, str: number, sta: number, armor: number])[] = [
  [21999, 'Helm of Heroism', 18, 32, 556],
  [21997, 'Breastplate of Heroism', 21, 26, 684],
  [21998, 'Gauntlets of Heroism', 18, 12, 393],
  [21995, 'Boots of Heroism', 20, 20, 470],
];

describe('the item data', () => {
  it('holds every item file, and no id twice', () => {
    /*
     * FIVE FILES, and the count is per file so that one failing to load is a
     * failure rather than a shorter list nobody notices.
     *
     *   forever-new-epics      449  items Forever ADDED
     *   forever-new-rares      412
     *   forever-changed-epics  614  Classic items Forever ALTERED
     *   forever-changed-rares  198
     *   forever-same           273  Classic items Forever KEPT UNCHANGED
     *
     * `same` IS THE FILE THAT IS EASY NOT TO TAKE. A diff site publishes what
     * CHANGED, so "new plus changed" is a complete description of the diff and
     * an incomplete description of the game -- without it, 273 items Forever
     * left alone would be absent from a database claiming to be Forever's.
     *
     * THE TWO CHANGED FILES ARE AN OVERRIDE LAYER rather than more items: an
     * id they share with something already on file REPLACES it.
     */
    const BASE = [449, 412, 273];
    const OVERRIDE = [614, 198];
    const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0);
    expect(sum(BASE)).toBe(1134);
    expect(sum(OVERRIDE)).toBe(812);

    /*
     * AND IT NOW OVERRIDES NOTHING, WHICH IS A FACT WORTH PINNING RATHER THAN
     * A REASON TO DELETE IT.
     *
     * Three ids used to collide -- The Immovable Object, Don Julio's Band and
     * The Unstoppable Force -- and all three collisions were against the
     * CLASSIC stand-ins, which are deleted. Forever's own five captures carry
     * each id exactly once, so the layer is inert today.
     *
     * IT STAYS BECAUSE THE RULE IS WHAT MATTERS. `same.json` and
     * `changed.json` are two readings of the same client and a refreshed
     * capture can legitimately list an item in both; the alternative to this
     * layer is `itemData` throwing on the duplicate, or worse, merging the two
     * so an item carries Classic's "+1% crit" AND Forever's "+14 Critical
     * Strike Rating" at once. A ZERO here means "no collision", and the day it
     * is not zero this assertion says so.
     */
    expect(FOREVER_OVERRIDDEN_IDS).toEqual([]);
    const expected = sum(BASE) + sum(OVERRIDE) - FOREVER_OVERRIDDEN_IDS.length;
    expect(expected).toBe(1946);

    /*
     * CAPTURED ITEMS ONLY. `ITEMS` also carries the synthetic benchmark gear,
     * which is generated rather than captured and lives above 9,500,000 -- so
     * counting the whole list would make this assertion about the generator
     * instead of about the files, and it would move every time a template
     * changed. `benchmarkGear.test.ts` owns the other half.
     */
    const captured = ITEMS.filter((item) => item.id < 9_500_000);
    expect(captured).toHaveLength(expected);
    expect(new Set(captured.map((item) => item.id)).size).toBe(expected);
  });

  it('has no Classic or Season of Discovery item left in it', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S INSTRUCTION, ASSERTED RATHER THAN TRUSTED: "only new/changed
     * authentic Forever items, and KEEP THE RECENTLY MADE TEST ITEMS. None of
     * the old WoW Vanilla/Classic/SoD items."
     *
     * EVERY CAPTURED ITEM NAMES `foreverchanges.pro` AS ITS SOURCE, and the
     * benchmark items say in as many words that they are synthetic. The check
     * is on the SOURCE and not on the id range, because the Forever captures
     * reuse Classic's ids for everything Forever inherited -- Don Julio's Band
     * is 19325 in both -- so an id proves nothing and the provenance does.
     * ------------------------------------------------------------------------
     */
    for (const item of ITEMS) {
      if (item.id >= 9_500_000) {
        expect(item.source, item.name).toMatch(/SYNTHETIC benchmark gear/);
      } else {
        expect(item.source, item.name).toMatch(/foreverchanges\.pro/);
      }
    }

    // And the nine stand-in files are gone rather than merely unreferenced.
    const sodNames = ['Jaws of Might', "Vis'kag the Bloodletter", 'Obsidian Edged Blade'];
    for (const name of sodNames) {
      expect(ITEMS.some((item) => item.name === name), name).toBe(false);
    }
  });

  it('lets a Forever change override the Classic stand-in, not merge with it', () => {
    /*
     * ------------------------------------------------------------------------
     * MERGED IS THE FAILURE THIS GUARDS. Classic's Don Julio's Band says
     * "Improves your chance to get a critical strike by 1%" and Forever's says
     * "+14 Critical Strike Rating" -- the SAME 1%, written two ways. An item
     * carrying both lines would be worth 2%, and nothing about it would look
     * wrong.
     *
     * NOTHING COLLIDES TODAY, so what this asserts is the OUTCOME rather than
     * the mechanism: the ring carries Forever's rating and not Classic's
     * percentage, whichever route it took to get here. The ring is in
     * `changed.json` because Forever altered it, and the Classic entry it
     * replaced is deleted along with the rest of the stand-ins.
     * ------------------------------------------------------------------------
     */
    const ring = ITEMS_BY_ID.get(19325)!;
    expect(ring.stats.critRating).toBe(14);
    expect(ring.stats.critChance ?? 0).toBe(0);
    expect(ring.stats.hitChance).toBeCloseTo(1, 10);
  });

  it('has the Forever shield, with its block stats modelled', () => {
    const shield = ITEMS_BY_ID.get(19321);
    expect(shield).toBeDefined();
    if (!shield) return;

    expect(shield.name).toBe('The Immovable Object');
    expect(shield.slots).toEqual(['shield']);
    expect(shield.stats.armor).toBe(2468);
    expect(shield.stats.stamina).toBe(15);
    expect(shield.source).toMatch(/foreverchanges\.pro/);

    /*
     * BOTH LINES ARE BLOCK VALUE, and this test used to say otherwise.
     *
     * "44 Block" on a shield is its INHERENT BLOCK VALUE, not a chance. Read
     * as a chance it gave The Immovable Object a 44% chance to block, which is
     * wrong in a way that looks entirely plausible on a tank. It adds to the
     * "+27 Block Value" line: 44 + 27 = 71.
     *
     * AND THE TWO ARE DIFFERENT KINDS OF NUMBER, which is what the benchmark
     * generator reads off this item: the 44 comes free with the item level, as
     * base armour does, and the 27 is an Equip line bought out of the budget.
     *
     * The shield grants no block CHANCE at all. That comes from the flat 5%
     * for holding one, from talents, from defense skill and from Shield Block.
     */
    expect(shield.stats.blockValue).toBe(71);
    expect(shield.stats.blockChance).toBeUndefined();
    expect(shield.unmodelled.map((effect) => effect.text)).toEqual([]);
  });

  it.each(HEROISM)('%s: %s has the stated strength, stamina and armor', (id, name, str, sta, armor) => {
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

  it('reads the ratings and attack power off the effect text', () => {
    /*
     * FOREVER GRANTS RATINGS WHERE CLASSIC GRANTS PERCENTAGES, and the
     * conversions are the owner's own table: 14 rating is a point of crit, 10
     * is a point of hit.
     *
     * Don Julio's Band: +11 Stamina, +14 Critical Strike Rating, +10 Hit
     * Rating, +16 Attack Power.
     */
    expect(ITEMS_BY_ID.get(19325)?.stats).toMatchObject({
      stamina: 11,
      critRating: 14,
      hitChance: 1,
      attackPower: 16,
      /*
       * BOTH POOLS, BY THE OWNER'S HARD RULING: "Attack Power always equals
       * and reaches Melee & Ranged Attack Power. And Melee Attack Power NEVER
       * reaches Ranged Attack Power."
       */
      rangedAttackPower: 16,
    });

    // High Warlord's Blade: +7 Stamina, +14 Critical Strike Rating, +28 Attack
    // Power -- a one-hander whose whole stat line is ratings and power.
    expect(ITEMS_BY_ID.get(16345)?.stats).toMatchObject({
      stamina: 7,
      critRating: 14,
      attackPower: 28,
      rangedAttackPower: 28,
    });

    /*
     * AND "Ranged Attack Power" IS STILL ITS OWN STAT, which is the half the
     * ruling did not change. High Warlord's Recurve is +36 Ranged Attack
     * Power and grants no melee power at all.
     *
     * THIS LINE WENT UNREAD FOR THE WHOLE DATASET. The rule was written for
     * Classic's "+48 ranged Attack Power." with a lower-case r, and every one
     * of the twelve lines in the Forever data has a capital R -- so a Hunter's
     * own bow granted no ranged attack power, and the rule that existed to
     * catch it matched nothing.
     */
    const bow = ITEMS_BY_ID.get(18835);
    expect(bow?.stats.rangedAttackPower).toBe(36);
    expect(bow?.stats.attackPower).toBeUndefined();
  });

  it('reads mana regeneration as mana per FIVE seconds', () => {
    /*
     * ------------------------------------------------------------------------
     * THE UNIT IS SETTLED BY THE RULESET'S OWN DATA, NOT ASSUMED. 252 of the
     * changed items carry Classic's own lines beside Forever's in
     * `tools/data/forever-changed.capture.json`, and Field Marshal's Headdress
     * reads "Restores 4 mana per 5 sec." in Classic against "+4 Mana
     * Regeneration" in Forever -- the SAME NUMBER, so the compact rewrite
     * keeps the per-five-seconds unit.
     *
     * A GUESS WOULD HAVE BEEN FIVE TIMES OUT IN EITHER DIRECTION and entirely
     * plausible: "+4 Mana Regeneration" reads just as naturally as 4 a second.
     * 160 lines carry it, every one of them a caster piece, and mana RETURN is
     * explicitly not out of scope.
     * ------------------------------------------------------------------------
     */
    const headdress = ITEMS_BY_ID.get(17602);
    expect(headdress?.name).toBe("Field Marshal's Headdress");
    expect(headdress?.stats.manaPer5).toBe(4);
    expect(headdress?.stats.spellPower).toBe(33);

    // 92 base armour and a "+70 Armor" bonus line: both read, and added.
    expect(headdress?.stats.armor).toBe(92 + 70);
  });

  it('reads weapon skill in BOTH wordings, and calls neither a stat', () => {
    /*
     * ------------------------------------------------------------------------
     * TWO SENTENCES FOR ONE THING. Classic says "Increased Fist Weapons +4."
     * and Forever says "+3 Daggers Skill", and only the first had a rule -- so
     * Death's Sting and Frenzied Striker lost their skill points, which is the
     * same class of mistake as the 1,384 spell power lines and was found the
     * same way, by `tools/item_vocabulary.ts`.
     *
     * NEITHER IS A STAT. It shifts the combat table through the weapon's own
     * skill, so it lands on `weapon.bonusSkill` and nowhere in `stats`.
     * ------------------------------------------------------------------------
     */
    const sting = ITEMS_BY_ID.get(21126);
    expect(sting?.weapon?.bonusSkill).toBe(3);
    expect(sting?.stats.attackPower).toBe(38);

    const claws = ITEMS_BY_ID.get(20005);
    expect(claws?.name).toBe('Devilsaur Claws');
    expect(claws?.weapon?.bonusSkill).toBe(4);
    expect(claws?.stats.agility).toBe(4);

    // A weapon with no such line gets zero rather than undefined, so the
    // combat table always has a number to add.
    expect(ITEMS_BY_ID.get(16345)?.weapon?.bonusSkill).toBe(0);
  });

  it('puts each item in the right slots', () => {
    expect(ITEMS_BY_ID.get(16345)?.slots).toEqual(['mainHand', 'offHand']);
    expect(ITEMS_BY_ID.get(18877)?.slots).toEqual(['twoHand']);
    expect(ITEMS_BY_ID.get(18835)?.slots).toEqual(['ranged']);
    expect(ITEMS_BY_ID.get(19325)?.slots).toEqual(['ring1', 'ring2']);
    expect(ITEMS_BY_ID.get(19287)?.slots).toEqual(['trinket1', 'trinket2']);
    expect(ITEMS_BY_ID.get(19321)?.slots).toEqual(['shield']);
    expect(ITEMS_BY_ID.get(279250)?.slots).toEqual(['relic']);
    // A caster's held off-hand is the same engine slot a shield is NOT in.
    expect(ITEMS_BY_ID.get(272685)?.slots).toEqual(['offHand']);
  });

  it('offers the right items per slot', () => {
    /*
     * NOT AN EXHAUSTIVE LIST. With 1,943 items on file the head slot alone
     * holds hundreds, and a test that lists them all breaks every time a
     * capture is refreshed while saying nothing about the mapping. What
     * matters is that each KIND of item lands where it belongs, so one of each
     * is named and the exclusions are asserted instead.
     */
    const names = (slot: Parameters<typeof itemsForSlot>[0]) =>
      itemsForSlot(slot).map((item) => item.name);

    expect(names('head')).toContain('Helm of Heroism');
    expect(names('mainHand')).toContain("High Warlord's Blade");
    expect(names('twoHand')).toContain("High Warlord's Greatsword");

    // A two-hander is never offered for one hand, and a one-hander never for
    // two. That is what makes the style rules able to pick one or the other.
    expect(names('mainHand')).not.toContain("High Warlord's Greatsword");
    expect(names('twoHand')).not.toContain("High Warlord's Blade");

    /*
     * A SHIELD IS RESOLVED BY SUBCLASS, so it goes in `shield` and never in
     * the off-hand WEAPON slot where a dual-wielder could swing it. A HELD
     * off-hand is the other way round: it is an off-hand item and not a
     * shield, and the two share Forever's inventory type "Off Hand".
     */
    expect(names('shield')).toContain('The Immovable Object');
    expect(names('offHand')).not.toContain('The Immovable Object');
    expect(names('offHand')).toContain('Premier High Warlord\'s Tome of Destruction');
    expect(names('shield')).not.toContain('Premier High Warlord\'s Tome of Destruction');

    // A relic is offered nowhere else, and nothing else is offered as one.
    expect(names('relic')).toContain('Idol of Swiftness');
    expect(names('relic').every((name) => /Idol|Libram|Totem/.test(name))).toBe(true);
    expect(names('trinket1')).not.toContain('Idol of Swiftness');

    /*
     * AND THE BENCHMARK GEAR IS NEVER OFFERED. It is generated from the budget
     * rather than captured, so a person browsing a slot sees real items only.
     */
    expect(names('head').some((name) => /^(B55|E65|E75|E85) /.test(name))).toBe(false);
  });

  it('reads spell power as school-blind or school-scoped, and keeps them apart', () => {
    /*
     * ------------------------------------------------------------------------
     * TWO DIFFERENT STATS, AND FOLDING THEM IN EITHER DIRECTION LOSES A REAL
     * DISTINCTION. A Shadow-only bonus added to `spellPower` would make the
     * same character's Holy and Arcane spells hit harder; a school-blind bonus
     * filed under one school would be lost by the other six.
     *
     * Elemental Mage Staff: "+36 Fire Spell Damage" and "+36 Frost Spell
     * Damage", which is two schools on one item and NOTHING in the blind pool.
     * ------------------------------------------------------------------------
     */
    const staff = ITEMS_BY_ID.get(944);
    expect(staff?.name).toBe('Elemental Mage Staff');
    expect(staff?.schoolPower.fire).toBe(36);
    expect(staff?.schoolPower.frost).toBe(36);
    expect(staff?.stats.spellPower).toBeUndefined();
    expect(staff?.schoolPower.shadow).toBeUndefined();

    // And it is not reported as missing: that blocker cleared when
    // `SchoolModifiers` grew a spell power per school.
    expect(staff?.unmodelled.map((e) => e.text)).toEqual([]);

    /*
     * THE SCHOOL-BLIND LINE IS THE OTHER STAT. "+59 Spell Power" names no
     * school, so it lands in `stats` and leaves `schoolPower` empty.
     */
    const kris = ITEMS_BY_ID.get(21416);
    expect(kris?.stats.spellPower).toBe(59);
    expect(Object.keys(kris?.schoolPower ?? {})).toHaveLength(0);
  });

  it('keeps a set bonus as text rather than dropping it', () => {
    /*
     * A set bonus reads "(4) Chance on melee attack to ..." and starts with a
     * bracket, so it matched no prefix and no bare-number rule and was
     * DROPPED -- not unmodelled, dropped. Nothing else in this parser is
     * allowed to do that.
     */
    const chest = ITEMS_BY_ID.get(21997);
    const sets = chest?.unmodelled.filter((effect) => effect.kind === 'Set') ?? [];
    expect(sets.map((effect) => effect.text)).toContain('(6) +40 Attack Power.');
    expect(sets).toHaveLength(4);
    for (const bonus of sets) {
      expect(bonus.reason).toContain('set bonus');
    }

    /*
     * AND A SET BONUS IS NOT APPLIED, which the "(6) +40 Attack Power." line
     * is the sharpest test of: the same words outside a bracket ARE a rule, so
     * a parser that stripped the prefix would hand this piece 40 attack power
     * on its own.
     */
    expect(chest?.stats.attackPower).toBeUndefined();
  });

  it('reaches every effect rule, or says which Classic wordings it cannot', () => {
    /*
     * ------------------------------------------------------------------------
     * A RULE THAT MATCHES NOTHING READS EXACTLY LIKE ONE THAT SOMETIMES
     * MATCHES, and this is the bug class that cost twelve ranged attack power
     * lines: the rule was written for Classic's wording, the data is all
     * Forever's, and nothing ever told anybody.
     *
     * SO EVERY RULE IS WALKED AGAINST EVERY EFFECT LINE. The ones that reach
     * nothing are listed BY PATTERN below with why, and the list is asserted
     * EXACTLY -- a TENTH unreachable rule fails this test, and so does one of
     * these nine becoming reachable, which is the half that expires.
     *
     * NINE OF TWENTY-TWO, and seven of the nine are CLASSIC wordings whose
     * Forever equivalent is a rating. They are kept rather than deleted
     * because a Classic tooltip is still read for an item Forever inherited.
     * That is a different claim from "this rule is live", and the difference
     * is what this test records.
     *
     * THE MOST STRIKING IS CLASSIC'S SPELL POWER SENTENCE. "Increases damage
     * and healing done by magical spells and effects by up to N" is the line
     * this project read for years, and `foreverchanges.pro` rewrites every one
     * of them to "+N Spell Power" -- including on items Forever did not
     * otherwise change. It survives only inside SET BONUSES, where the "(6)"
     * prefix puts it past the anchor.
     * ------------------------------------------------------------------------
     */
    /*
     * ASKED OF THE EFFECT LINES, WHICH IS WHAT THE RULES ARE APPLIED TO -- not
     * of the whole tooltip, which is a weaker question that would have passed
     * straight through the bug this test exists for.
     *
     * A captured item's tooltip DOES contain "+32 Stamina", so a tooltip scan
     * calls the five primary rules reachable; a captured item's primaries
     * arrive in its raw `stats` object and never pass through a rule at all.
     * The GENERATED gear is the only thing that states a primary as an EFFECT.
     * So both populations are needed, and the question has to be asked of
     * `effects`.
     *
     * READ OFF THE DATA FILES RATHER THAN OFF `Item`, because `Item` keeps only
     * the lines it could NOT read -- which is the half that proves nothing
     * here. `buildItem` records no trace of which rule fired, so the patterns
     * are re-applied to the same strings `buildStats` walks.
     */
    const effectTexts = [
      ...(
        [
          foreverNewEpics,
          foreverNewRares,
          foreverChangedEpics,
          foreverChangedRares,
          foreverSame,
        ] as unknown as readonly { items: readonly { effects?: readonly { text: string }[] }[] }[]
      )
        .flatMap((file) => file.items)
        .flatMap((item) => (item.effects ?? []).map((effect) => effect.text)),
      ...BENCHMARK_ITEMS.flatMap((item) => item.effects.map((effect) => effect.text)),
    ];

    const unreachable = EFFECT_RULES.map((rule) => rule.pattern.source).filter(
      (source) => !effectTexts.some((text) => new RegExp(source).test(text)),
    );

    expect(unreachable.sort()).toEqual(
      [
        // Forever grants block chance as a rating; nothing states a percentage.
        '^\\+?(\\d+)% (?:Chance to Block|Block Chance)$',
        // No Forever item grants haste at all yet. The enchant table does.
        '^\\+(\\d+) Haste Rating\\.?$',
        /*
         * SPIRIT, WHICH IS THE ONE ENTRY HERE THAT IS ABOUT THE GENERATOR
         * RATHER THAN ABOUT A CLASSIC WORDING.
         *
         * A captured item carries spirit in its raw `stats` like every other
         * primary, so only the benchmark gear can reach this rule -- and it
         * never does: spirit is FIFTH in the caster preference list and a full
         * slot takes four stats. "Descending order of importance" is the
         * owner's instruction and four-per-slot is this generator's choice, so
         * the fifth preference is simply never bought.
         *
         * A QUESTION FOR THE OWNER RATHER THAN A BUG: a caster benchmark grants
         * no spirit at all, which is defensible for a damage profile and is not
         * what the spreadsheet row looks like.
         */
        '^\\+(\\d+) Spirit\\.?$',
        // Classic's flat percentages, every one of which Forever writes as a
        // rating -- "+14 Critical Strike Rating" for "a critical strike by 1%".
        '^Improves your chance to get a critical strike by (\\d+)%\\.?$',
        '^Improves your chance to get a critical strike with spells by (\\d+)%\\.?$',
        '^Improves your chance to get a critical strike with all spells and attacks by (\\d+)%\\.?$',
        '^Improves your chance to hit(?: with all spells and attacks)? by (\\d+)%\\.?$',
        /*
         * CLASSIC'S SPELL POWER SENTENCE, which is the one that reads as the
         * biggest surprise: `foreverchanges.pro` rewrites all 764 of them to
         * "+N Spell Power". It remains inside set bonuses, where the "(6)"
         * prefix puts the line past this anchor.
         */
        '^Increases damage and healing done by magical spells and effects by up to (\\d+)\\.?$',
        // Classic's defense and shield-block wordings, now Defense Rating and
        // a bare "+27 Block Value".
        '^Increased Defense \\+(\\d+)\\.?$',
        '^Increases the block value of your shield by (\\d+)\\.?$',
      ].sort(),
    );
  });
});

describe('what the items do that the simulator does not', () => {
  it('does NOT list resistances as unmodelled', () => {
    /*
     * They are carried on the item and totalled on the character sheet
     * instead. Nineteen slots of plate produced a wall of rows saying the same
     * thing nineteen times, which buried the effects that genuinely have no
     * mechanic behind them.
     */
    const staff = ITEMS_BY_ID.get(944);
    expect(staff?.unmodelled.some((e) => /Resistance/.test(e.text))).toBe(false);
    // Still on the item, for the sheet to total.
    expect(staff?.resistances.fire).toBe(20);
    expect(staff?.resistances.frost).toBe(20);
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
    /*
     * Crusader and Spell Power. Both are melee-weapon enchants; the caster
     * sets put the second on a staff, which is one.
     *
     * THEY ARE A FILE OF THEIR OWN NOW. Both were SCRAPED -- a spell id, an
     * icon and a tooltip -- and they sat inside `classic-warrior.json` because
     * that is the file they were scraped with. Deleting it would have silently
     * unenchanted every weapon in the project, so they moved to
     * `src/data/items/weapon-enchants.json` first.
     *
     * AND THE ARMOUR ENCHANTS MUST NOT REACH A WEAPON SLOT. This used to
     * assert the three hands against a hard-coded pair of ids, which would
     * have passed just as happily with a helmet enchant appended -- so it asks
     * the stronger question now: the two weapon ids EXACTLY, and nothing else
     * offered there.
     */
    for (const slot of ['mainHand', 'offHand', 'twoHand'] as const) {
      expect(enchantsForSlot(slot).map((e) => e.id), slot).toEqual([20034, 22749]);
    }

    /*
     * THE BOW TAKES ONE ENCHANT AND IT IS NOT A WEAPON ONE. "+2% Crit Chance"
     * is the owner's ranged entry; Crusader and Weapon Spell Power are still
     * explicitly refused there, which is what the old `toEqual([])` was for.
     */
    expect(enchantsForSlot('ranged').map((e) => e.name)).toEqual(['+2% Crit Chance']);

    /*
     * AND THE SHOULDER IS THE SLOT WITH NOTHING. Its column in the owner's
     * table reads "None" and nothing else, so this is the only armour slot
     * that stays empty.
     */
    expect(enchantsForSlot('shoulders')).toEqual([]);
    expect(enchantsForSlot('head').length).toBeGreaterThan(0);

    // Crusader is a proc and carries no stat; Spell Power is a flat 30, which
    // the source states as "add up to 30 damage to spells".
    expect(CRUSADER.stats).toEqual({});
    expect(SPELL_POWER_ENCHANT.stats).toEqual({ spellPower: 30 });
  });

  it('NO LONGER CLAIMS a school-scoped spell power cannot be expressed', () => {
    /*
     * ------------------------------------------------------------------------
     * AN `unmodelled` REASON MATCHED BY WORDING IS A TEST, which is the rule
     * `grantCastModifier.test.ts` already writes down. A reason is a claim
     * about the engine ON THE DAY IT WAS WRITTEN and it expires; this one
     * expired when `SchoolModifiers` grew a spell power per school, and the
     * failure mode of leaving it behind is a line the Gear panel prints as
     * missing while the stat is quietly applied.
     *
     * Matched on the SENTENCE rather than on a list of item ids, so a new
     * capture writing the same complaint is caught.
     * ------------------------------------------------------------------------
     */
    const stale = ITEMS.flatMap((item) =>
      item.unmodelled
        .filter((effect) => /school-blind/i.test(effect.reason))
        .map((effect) => `${item.name}: ${effect.reason}`),
    );
    expect(stale).toEqual([]);

    // And no school-scoped line of either wording is listed as missing.
    const scoped = ITEMS.flatMap((item) =>
      item.unmodelled
        .filter(
          (e) =>
            /^Increases damage done by \w+ spells and effects/.test(e.text) ||
            /^\+\d+ (Fire|Frost|Arcane|Nature|Shadow|Holy) Spell (Power|Damage)$/.test(e.text),
        )
        .map((e) => `${item.name}: ${e.text}`),
    );
    expect(scoped).toEqual([]);
  });

  it('totals a school-scoped spell power across the equipped set', () => {
    /*
     * OFF `liveEquipment` LIKE EVERYTHING ELSE, so a two-hander's Shadow power
     * cannot count on a build holding a one-hander.
     *
     * THE PRESETS WEAR BENCHMARK GEAR NOW, which grants school-blind spell
     * power and names no school at all -- so the figure this used to assert
     * (the Shadow Priest's 357) is gone with the Classic set that carried it.
     * What is asserted instead is the RULE, on a hand-built set: a scoped line
     * totals per school, and a build holding nothing scoped gets an empty
     * record rather than a zero for each of the seven.
     */
    const twoStaves: Equipment = { twoHand: { itemId: 944 } };
    expect(schoolPowerForStyle(twoStaves, 'two_hander')).toEqual({ fire: 36, frost: 36 });

    // A caster style HOLDS a two-hander rather than swinging it, and still
    // reads its stats.
    expect(schoolPowerForStyle(twoStaves, 'caster')).toEqual({ fire: 36, frost: 36 });

    // Every preset's benchmark set is school-blind, so each comes back empty.
    for (const id of ['shadow_priest', 'mage_fire', 'two_hand_arms']) {
      const profile = PRESETS_BY_ID.get(id)!.build();
      const style = profile.character.combatStyle ?? 'dual_wield';
      expect(schoolPowerForStyle(profile.equipment, style), id).toEqual({});
    }
  });

  it('lists what an equipped set fails to model', () => {
    /*
     * A FULLY SIMULATED SET AND A PARTLY SIMULATED ONE, so the function is
     * shown doing both. High Warlord's Blade is stamina, a rating and attack
     * power and nothing else; Kris of Unspoken Names carries a set bonus that
     * nothing tracks.
     */
    const clean: Equipment = { mainHand: { itemId: 16345, enchantId: 20034 } };
    expect(unmodelledEffects(clean, 'dual_wield')).toEqual([]);

    const withSetBonus: Equipment = { mainHand: { itemId: 21416 } };
    const missing = unmodelledEffects(withSetBonus, 'dual_wield');
    expect(missing).toHaveLength(1);
    expect(missing[0]?.kind).toBe('Set');
    expect(missing[0]?.itemName).toBe('Kris of Unspoken Names');
  });

  it('keeps the two implemented item procs, which no Forever item carries', () => {
    /*
     * ------------------------------------------------------------------------
     * BOTH PROC'D ITEMS ARE GONE FROM THE RULESET, AND THE MECHANISMS STAY.
     * `procs.ts` implements Vis'kag's Fatal Wound and Hand of Justice's extra
     * attack, and neither item is in Forever's data -- so `MODELLED_AS_PROCS`
     * now matches nothing and the two reactions are unreachable from gear.
     *
     * WHICH IS WORTH ASSERTING RATHER THAN LEAVING TO BE DISCOVERED. An
     * unreachable mechanism that nothing says is unreachable is how a reader
     * concludes a profile has a damage source it does not have -- and the
     * CRUSADER enchant still drives the same proc machinery, so the code is
     * not dead, only the two item entries are.
     * ------------------------------------------------------------------------
     */
    for (const name of ["Vis'kag the Bloodletter", 'Hand of Justice']) {
      expect(ITEMS.some((item) => item.name === name), name).toBe(false);
    }

    // Nothing in the data carries either proc's wording, so nothing is
    // silently skipped by `MODELLED_AS_PROCS` either.
    const procLines = ITEMS.filter((item) => item.id < 9_500_000).flatMap((item) =>
      item.unmodelled
        .filter((e) => /Delivers a fatal wound|gain 1 extra attack/.test(e.text))
        .map((e) => e.text),
    );
    expect(procLines).toEqual([]);
  });
});

describe('equipping', () => {
  /**
   * A hand-built Forever set, carrying one of everything the rules divide on.
   *
   * It is deliberately NOT a preset's set: a preset wears generated benchmark
   * gear, and these tests are about what the loader and `liveEquipment` do
   * with real captured items.
   */
  const FULL: Equipment = {
    head: { itemId: 21999 }, // Helm of Heroism
    chest: { itemId: 21997 }, // Breastplate of Heroism
    gloves: { itemId: 21998 }, // Gauntlets of Heroism
    feet: { itemId: 21995 }, // Boots of Heroism
    mainHand: { itemId: 16345 }, // High Warlord's Blade
    offHand: { itemId: 21126 }, // Death's Sting
    twoHand: { itemId: 18877 }, // High Warlord's Greatsword
    ranged: { itemId: 18835 }, // High Warlord's Recurve
    ring1: { itemId: 19325 }, // Don Julio's Band
    shield: { itemId: 19321 }, // The Immovable Object
  };

  it('keeps a stat-stick off hand, and a shield in one, for its STATS', () => {
    /*
     * ------------------------------------------------------------------------
     * THE MIRROR OF THE MAIN-HAND BUG, AND IT SURVIVED THAT FIX.
     *
     * `offHand: 'stat-stick'` means held, contributing stats, never swinging --
     * the same words the main hand's version uses. Five styles say it, and
     * `liveEquipment` deleted both off-hand slots for every one of them, so a
     * caster holding a tome worth 18 spell power got nothing at all from it.
     *
     * The swing side was always right, and is what makes keeping the slot
     * safe: `weaponsForEquipment` refuses to build a weapon for a stat-stick
     * hand.
     * ------------------------------------------------------------------------
     */
    const caster: Equipment = {
      mainHand: { itemId: 21416 }, // Kris of Unspoken Names, +59 Spell Power
      offHand: { itemId: 272685 }, // Tome of Destruction, +18 Spell Power
    };

    const live = liveEquipment(caster, 'caster');
    expect(live.mainHand).toBeDefined();
    expect(live.offHand).toBeDefined();

    // Neither swings, which is what this test is actually about.
    expect(statsForStyle(caster, 'caster').spellPower).toBe(59 + 18);
    expect(weaponsForEquipment(caster, 'caster')).toEqual({});

    // A style that fills the off hand with a WEAPON still keeps it, and a
    // two-hand style drops both hands.
    expect(liveEquipment(caster, 'two_hander').mainHand).toBeUndefined();
    expect(liveEquipment(caster, 'two_hander').offHand).toBeUndefined();

    // And a shield is dropped by every style that cannot hold one.
    const shielded: Equipment = { shield: { itemId: 19321 } };
    expect(liveEquipment(shielded, 'one_hand_shield').shield).toBeDefined();
    expect(liveEquipment(shielded, 'dual_wield').shield).toBeUndefined();
    expect(liveEquipment(shielded, 'two_hander').shield).toBeUndefined();
  });

  it('uses the one-handers while dual-wielding and ignores the two-hander', () => {
    const weapons = weaponsForEquipment(FULL, 'dual_wield');

    expect(weapons.mainHand?.name).toBe("High Warlord's Blade");
    expect(weapons.offHand?.name).toBe("Death's Sting");
    // Dual-wield has no ranged slot, so the bow does not swing.
    expect(weapons.ranged).toBeUndefined();
  });

  it('uses the two-hander in the main hand for a two-handed style', () => {
    const weapons = weaponsForEquipment(FULL, 'two_hander');

    expect(weapons.mainHand?.name).toBe("High Warlord's Greatsword");
    expect(weapons.offHand).toBeUndefined();
  });

  it("does not bank the two-hander's stats while dual-wielding", () => {
    /*
     * High Warlord's Greatsword is +26 Strength and +41 Stamina, and the two
     * one-handers carry no strength at all. A dual-wielder must get none of it.
     */
    const dual = statsForStyle(FULL, 'dual_wield');
    const twoHand = statsForStyle(FULL, 'two_hander');

    expect(twoHand.strength! - dual.strength!).toBe(26);
    expect(liveEquipment(FULL, 'dual_wield').twoHand).toBeUndefined();
    expect(liveEquipment(FULL, 'two_hander').mainHand).toBeUndefined();
  });

  it('KEEPS a two-hander a stat-stick style is holding', () => {
    /*
     * ------------------------------------------------------------------------
     * The Ranged and Caster styles declare `mainHand: 'stat-stick'` and say in
     * as many words that melee weapons may be equipped and never swing. This
     * used to read "not two-hand" as "one-hand" and delete the two-hander, so
     * a Hunter holding one as a stat stick silently lost its stats, and a
     * caster holding a STAFF would lose the lot.
     * ------------------------------------------------------------------------
     */
    const twoHandOnly: Equipment = { twoHand: { itemId: 18877 } };
    const oneHandOnly: Equipment = { mainHand: { itemId: 16345 } };

    for (const style of ['ranged', 'caster'] as const) {
      expect(liveEquipment(twoHandOnly, style).twoHand, style).toBeDefined();
      expect(statsForStyle(twoHandOnly, style).strength, style).toBe(26);

      /*
       * HELD, AND NEVER SWUNG -- neither kind produces a weapon.
       *
       * An earlier version of this test asserted the OPPOSITE, on the
       * reasoning that `mainHand` was never stripped from a stat-stick style
       * so a held one-hander had always produced a weapon profile here, and
       * that the two kinds should therefore agree. They should, and they were
       * agreeing on the wrong answer: `createPlayer` merges these OVER the
       * style's own weapons, so a profile returned here replaces a Cat's paw.
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
      mainHand: { itemId: 16345 },
      twoHand: { itemId: 18877 },
    };
    expect(liveEquipment(both, 'ranged').twoHand).toBeUndefined();
    expect(liveEquipment(both, 'ranged').mainHand).toBeDefined();
  });

  it('reproduces the weapon damage range through the engine profile', () => {
    // 138-207 has a midpoint of 172.5, so the variance is 34.5/172.5. The
    // engine rolls baseDamage * [1-v, 1+v], which must give back 138-207.
    const weapons = weaponsForEquipment(FULL, 'dual_wield');
    const mh = weapons.mainHand;
    expect(mh).toBeDefined();
    if (!mh) return;

    expect(mh.baseDamage).toBeCloseTo(172.5, 6);
    const variance = mh.damageVariance ?? 0;
    expect(mh.baseDamage * (1 - variance)).toBeCloseTo(138, 6);
    expect(mh.baseDamage * (1 + variance)).toBeCloseTo(207, 6);
  });

  it('derives the attack power coefficient from the weapon speed', () => {
    const mh = weaponsForEquipment(FULL, 'dual_wield').mainHand;
    // 2.9 second weapon, by Forever's universal speed / 14.
    expect(mh?.swingTimerMs).toBe(2900);
    expect(mh?.powerCoefficient).toBeCloseTo(attackPowerCoefficientFor(2900), 10);
    expect(mh?.powerCoefficient).toBeCloseTo(2.9 / 14, 10);
  });

  it('carries weapon skill onto the hand that has it and leaves the rest at base', () => {
    /*
     * Death's Sting's "+3 Daggers Skill" is in the OFF hand, which is also the
     * end-to-end check on Forever's wording: a dual-wielder has TWO combat
     * tables and skill is what separates them, so a hand with the line and a
     * hand without must differ.
     */
    const dual = weaponsForEquipment(FULL, 'dual_wield');
    expect(dual.offHand?.skill).toBe(BASE_WEAPON_SKILL + 3);
    expect(dual.mainHand?.skill).toBe(BASE_WEAPON_SKILL);
    expect(weaponsForEquipment(FULL, 'two_hander').mainHand?.skill).toBe(BASE_WEAPON_SKILL);
  });

  it('gives the bow no rage generation', () => {
    const ranged = weaponsForEquipment(FULL, 'ranged').ranged;
    expect(ranged?.name).toBe("High Warlord's Recurve");
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
    expect(geared.weapons.mainHand?.name).toBe("High Warlord's Blade");
    // The placeholder is gone once something real is equipped.
    expect(bare.weapons.mainHand?.name).toBe('Melee');
  });

  it('keeps a placeholder only for a slot nothing is equipped in', () => {
    const partial: Equipment = { mainHand: { itemId: 16345 } };
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: partial,
    });

    expect(player.weapons.mainHand?.name).toBe("High Warlord's Blade");
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
      mainHand: { itemId: 16345 },
      offHand: { itemId: 21126 },
    };
    const weapons = weaponsForEquipment(equipment, 'dual_wield');

    expect(weapons.offHand?.damageMultiplier).toBe(0.5);
    expect(weapons.mainHand?.damageMultiplier).toBeUndefined();
  });

  it('still honours an explicit override, for talents that change it', () => {
    const weapons = weaponsForEquipment(
      { offHand: { itemId: 21126 } },
      'dual_wield',
      { offHandDamageMultiplier: 0.75 },
    );
    expect(weapons.offHand?.damageMultiplier).toBe(0.75);
  });
});
