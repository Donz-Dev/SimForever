import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_SETS,
  BENCHMARK_TEMPLATES,
  BENCHMARK_ITEMS,
  benchmarkEquipmentFor,
  benchmarkItemsFor,
} from '../../src/game/items/benchmarkSets';
import {
  BENCHMARK_ICONS,
  benchmarkIcon,
} from '../../src/game/items/benchmarkIcons';
import {
  TRINKET_CRIT_RATING,
  SHARE_WEIGHT,
  statsFor,
  weightedShares,
  ARMOUR_SLOTS,
} from '../../src/game/items/benchmarkGear';
import { ITEMS, ITEMS_BY_ID } from '../../src/game/items/itemData';
import { STAT_FOR_BENCH_STAT } from '../../src/game/items/defaultValuation';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { RATING_PER_PERCENT } from '../../src/engine';
import { className } from '../../src/game/character';

/*
 * ==============================================================================
 * THE SHAPE OF A BENCHMARK SET, which is what the owner read four problems off
 * and which the budget's own arithmetic cannot see. `benchmarkGear.test.ts`
 * asks whether an item fits its budget and every one of these items did.
 *
 * `tools/benchmark_stat_report.ts` prints the figures; this pins them.
 * ==============================================================================
 */

const setsOf = (presetId: string, setId: (typeof BENCHMARK_SETS)[number]['id']) =>
  Object.values(benchmarkEquipmentFor(presetId, setId) ?? {}).map(
    (equipped) => ITEMS_BY_ID.get(equipped!.itemId)!,
  );

const totalOf = (presetId: string, setId: (typeof BENCHMARK_SETS)[number]['id'], stat: string) =>
  setsOf(presetId, setId).reduce(
    (sum, item) => sum + ((item.stats as Record<string, number | undefined>)[stat] ?? 0),
    0,
  );

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

describe('a template piece has an icon that exists', () => {
  /*
   * THE ICONS ARE FETCHED BY FILE NAME FROM `wow.zamimg.com`, so a name that
   * does not exist renders as a BROKEN IMAGE -- worse than the question mark
   * it replaced, and visible only in a browser. Every entry in the table is
   * therefore an icon a REAL item in the capture already references, which
   * makes "does this file exist" a property of the data.
   */
  const realIcons = new Set(ITEMS.filter((item) => item.id < 9_500_000).map((item) => item.icon));

  it.each(BENCHMARK_ICONS)('%s is an icon a real item uses', (icon) => {
    expect(realIcons.has(icon)).toBe(true);
  });

  it('gives every generated item a real icon, never the question mark', () => {
    const missing = BENCHMARK_ITEMS.filter((item) => item.icon === 'inv_misc_questionmark');
    expect(missing.map((item) => `${item.name} ${item.inventoryType}`)).toEqual([]);
  });

  it('uses the SAME icon for a slot across all four sets', () => {
    // The owner's instruction: "stick to it across the 4 sets for that slot".
    for (const template of BENCHMARK_TEMPLATES) {
      const bySlot = new Map<string, Set<string>>();
      for (const set of BENCHMARK_SETS) {
        for (const item of benchmarkItemsFor(template, set)) {
          const key = `${item.inventoryType}|${item.subclass ?? ''}`;
          if (!bySlot.has(key)) bySlot.set(key, new Set());
          bySlot.get(key)!.add(item.icon);
        }
      }
      for (const [key, icons] of bySlot) {
        expect(`${template.label} ${key}: ${[...icons].join(',')}`).toBe(
          `${template.label} ${key}: ${[...icons][0]}`,
        );
      }
    }
  });

  it('keeps the four armour classes visually apart in a slot', () => {
    // Real data gives leather and mail the same helmet; two sets that look
    // identical in a character pane defeat the point of having icons.
    for (const inventory of ['Head', 'Chest', 'Hands', 'Feet'] as const) {
      const icons = (['Cloth', 'Leather', 'Mail', 'Plate'] as const).map((armour) =>
        benchmarkIcon(inventory, armour, armour),
      );
      expect(new Set(icons).size).toBe(4);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Naming and the tooltip                                                     */
/* -------------------------------------------------------------------------- */

describe('a template piece names its build, its set and its class', () => {
  it('is called "<build> (<set>)", which is the owner s format', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      for (const set of BENCHMARK_SETS) {
        for (const item of benchmarkItemsFor(template, set)) {
          expect(item.name).toBe(`${template.label} (${set.id})`);
        }
      }
    }
  });

  it('states the class the profile is, which a real tier piece does', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      for (const item of benchmarkItemsFor(template, BENCHMARK_SETS[1])) {
        expect(item.tooltip).toContain(`Classes: ${className(template.characterClass)}`);
      }
    }
  });

  /*
   * AND THE LINE IS READ BACK OUT. The generator writes text and the parser
   * reads it -- the seam the whole generator is built on -- so a template
   * piece is class-restricted by exactly the rule a captured one is.
   */
  it('is class-restricted by the line it wrote', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      const equipment = benchmarkEquipmentFor(template.presetId, 'E65')!;
      for (const equipped of Object.values(equipment)) {
        const item = ITEMS_BY_ID.get(equipped!.itemId)!;
        expect(item.classRestrictions).toEqual([template.characterClass]);
      }
    }
  });

  /*
   * THE OWNER'S ORDER: Name | Binds | Slot/Armor Class | Armor | Base
   * Attributes | Requirements | Rating Stats. It was the ALLOCATION order,
   * which put a rating in the middle of the attributes.
   */
  it('writes the attributes before the requirements and the ratings after', () => {
    const head = benchmarkItemsFor(BENCHMARK_TEMPLATES[0], BENCHMARK_SETS[1])[0];
    const lines = head.tooltip.split('\n');
    const at = (pattern: RegExp) => lines.findIndex((line) => pattern.test(line));

    expect(lines[0]).toBe(head.name);
    expect(lines[1]).toMatch(/^Item Level /);
    expect(lines[2]).toBe('Binds when picked up');
    expect(lines[3]).toMatch(/^Head\t/);
    expect(at(/^\d+ Armor$/)).toBe(4);

    const firstAttribute = at(/^\+\d+ (Strength|Agility|Stamina|Intellect|Spirit)$/);
    const classes = at(/^Classes: /);
    const requires = at(/^Requires Level /);
    const firstRating = at(/^Equip: /);

    expect(firstAttribute).toBeGreaterThan(4);
    expect(classes).toBeGreaterThan(firstAttribute);
    expect(requires).toBe(classes + 1);
    expect(firstRating).toBeGreaterThan(requires);
  });

  it('declares each template s class as the preset actually builds it', () => {
    /*
     * THE CROSS-LAYER CHECK. `game` may not import `profiles`, so the class is
     * DECLARED on the template -- and a declaration that drifts from its
     * preset would mislabel every card in the set. Tests can see both layers.
     */
    for (const template of BENCHMARK_TEMPLATES) {
      const preset = PRESETS_BY_ID.get(template.presetId)!;
      expect(`${template.presetId}: ${template.characterClass}`).toBe(
        `${template.presetId}: ${preset.build().character.characterClass}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The trinkets                                                               */
/* -------------------------------------------------------------------------- */

describe('the two trinkets are the owner s pair of archetypes', () => {
  /*
   * "It's expected to see trinkets that have 28 crit rating + a scaling spell
   * power / attack power value. OR pure spell power trinkets", with "a maximum
   * of 28 crit rating (2%) across both trinkets".
   *
   * They were the worst thing in a set: a one-stat slot, four of five
   * preference lists opening with Crit, and the trinket multiplier making the
   * pair the two largest crit sources in the whole set -- 68 rating from two
   * items.
   */
  it('never carries more than the owner s cap between them, in any set', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      for (const set of BENCHMARK_SETS) {
        const equipment = benchmarkEquipmentFor(template.presetId, set.id)!;
        const crit = (['trinket1', 'trinket2'] as const).reduce(
          (sum, slot) => sum + (ITEMS_BY_ID.get(equipment[slot]!.itemId)?.stats.critRating ?? 0),
          0,
        );
        expect(`${template.label} ${set.id}: ${crit}`).toBe(
          `${template.label} ${set.id}: ${Math.min(crit, TRINKET_CRIT_RATING)}`,
        );
      }
    }
  });

  it('puts the crit on the FIRST and leaves the second pure', () => {
    const equipment = benchmarkEquipmentFor('mage_fire', 'E65')!;
    const first = ITEMS_BY_ID.get(equipment.trinket1!.itemId)!;
    const second = ITEMS_BY_ID.get(equipment.trinket2!.itemId)!;

    expect(first.stats.critRating).toBe(TRINKET_CRIT_RATING);
    expect(first.stats.spellPower ?? 0).toBeGreaterThan(0);
    expect(second.stats.critRating ?? 0).toBe(0);
    expect(second.stats.spellPower ?? 0).toBeGreaterThan(0);
  });

  it('gives a melee build attack power where a caster gets spell power', () => {
    const equipment = benchmarkEquipmentFor('two_hand_arms', 'E65')!;
    const second = ITEMS_BY_ID.get(equipment.trinket2!.itemId)!;
    expect(second.stats.attackPower ?? 0).toBeGreaterThan(0);
    expect(second.stats.spellPower ?? 0).toBe(0);
  });

  /*
   * A MAXIMUM IS NOT THE SAME AS A FIXED AMOUNT, which the B55 sets proved: a
   * blue item-level-55 trinket has a budget of 23.3 points and 28 crit costs
   * 28 of them, so the flat figure put the item 20% over its own budget AND
   * left nothing for the scaling half.
   */
  it('carries LESS than the cap where a blue trinket cannot afford it', () => {
    const b55 = ITEMS_BY_ID.get(benchmarkEquipmentFor('mage_fire', 'B55')!.trinket1!.itemId)!;
    expect(b55.stats.critRating!).toBeLessThan(TRINKET_CRIT_RATING);
    expect(b55.stats.critRating!).toBeGreaterThan(0);
  });

  it('gives a build that wants no crit neither archetype, and not an empty slot', () => {
    // The three tanks and the Bear name no Crit and no damage stat, so their
    // trinkets keep what their preference list leads with. A ternary here once
    // handed them an EMPTY share list and the set silently lost 68 stamina.
    for (const presetId of ['prot_warr', 'prot_pally', 'druid_bear']) {
      const equipment = benchmarkEquipmentFor(presetId, 'E65')!;
      for (const slot of ['trinket1', 'trinket2'] as const) {
        const item = ITEMS_BY_ID.get(equipment[slot]!.itemId)!;
        expect(`${presetId} ${slot} crit`, `${presetId} ${slot}`).toBeTruthy();
        expect(item.stats.critRating ?? 0).toBe(0);
        expect(item.stats.stamina ?? 0).toBeGreaterThan(0);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The share weights, against Forever's own items                             */
/* -------------------------------------------------------------------------- */

describe('a set looks like a real set of its item level', () => {
  /*
   * ============================================================================
   * THE OWNER'S STANDARD, in their own words: "if 750 isn't reachable that's
   * fine. I want it to be realistic."
   *
   * `tools/real_set_shape.ts` measures the real population -- Forever items at
   * item level 60-70 that a class can equip, PvP excluded, summed across a
   * full set. The figures below are from that tool and are the thing these
   * assertions are anchored to:
   *
   *                      median   p75   best-in-database
   *   crit rating          168    182        210     (a warrior set)
   *   spell power          290    345        397     (a mage set)
   *
   * A BENCHMARK SET SHOULD SIT BETWEEN p75 AND BEST. These sets exist so two
   * builds can be compared at one item level, so each should be a STRONG set
   * of that level -- and must not exceed what the game contains, or the
   * comparison stops being about the builds.
   *
   * THE BOUNDS ARE LOOSE ON PURPOSE. What must not drift is the ORDER OF
   * MAGNITUDE: before `SHARE_WEIGHT`, crit was 295 (40% above the best real
   * set) and spell power was 205 (below an ordinary one). A tolerance tight
   * enough to pin the exact allocation would fail on every future tweak to a
   * preference list and say nothing about realism.
   * ============================================================================
   */
  const REAL_E65 = {
    crit: { median: 168, best: 210 },
    spellPower: { median: 290, best: 397 },
  };

  it('keeps a melee set s crit inside the range real items occupy', () => {
    const crit = totalOf('two_hand_arms', 'E65', 'critRating');
    expect(crit).toBeGreaterThan(REAL_E65.crit.median * 0.8);
    expect(crit).toBeLessThanOrEqual(REAL_E65.crit.best);
  });

  it('gives a caster set the spell power a strong real set carries', () => {
    const spellPower = totalOf('mage_fire', 'E65', 'spellPower');
    expect(spellPower).toBeGreaterThan(REAL_E65.spellPower.median);
    expect(spellPower).toBeLessThanOrEqual(REAL_E65.spellPower.best);
  });

  it('keeps crit on an armour or jewellery line to what a real one carries', () => {
    /*
     * Real Forever items at item level 60-70 carry 14 crit rating on a line,
     * occasionally 28, and never more -- so no generated piece should out-crit
     * the richest real one.
     *
     * WEAPONS ARE EXCLUDED, AND NOT BECAUSE THEY FAIL IT QUIETLY. A two-hander
     * is the largest budget in a set and the seven that carry 36 at E65 are
     * saying so; the real weapon population at that band is five items, which
     * is too thin for its maximum to be a ceiling. The whole-SET totals above
     * are what hold the weapons honest, and they are measured against a
     * population of hundreds.
     */
    const cap = 2 * RATING_PER_PERCENT.crit;
    for (const item of BENCHMARK_ITEMS) {
      if (item.itemLevel > 65 || item.weapon) continue;
      const crit = ITEMS_BY_ID.get(item.id)?.stats.critRating ?? 0;
      expect(`${item.name} ${item.inventoryType}: ${crit}`).toBe(
        `${item.name} ${item.inventoryType}: ${Math.min(crit, cap)}`,
      );
    }
  });

  it('weights crit down and spell power up, and nothing else', () => {
    expect(Object.keys(SHARE_WEIGHT).sort()).toEqual(['Crit', 'Spell Power']);
    expect(SHARE_WEIGHT.Crit!).toBeLessThan(1);
    expect(SHARE_WEIGHT['Spell Power']!).toBeGreaterThan(1);
  });

  it('renormalises, so a slot still spends its whole budget', () => {
    const shares = weightedShares(['Crit', 'Spell Power', 'Intellect', 'Stamina', 'Spirit']);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    // And crit, first in the list, no longer takes the largest share.
    expect(shares[1]).toBeGreaterThan(shares[0]);
  });
});

/* -------------------------------------------------------------------------- */
/* No preferred stat at zero                                                  */
/* -------------------------------------------------------------------------- */

describe('a set grants something of every stat its template prefers', () => {
  /*
   * The owner: stats like stamina and spirit going to nothing across a whole
   * set "is unrealistic to how items are actually designed". Five of the 25
   * sets had at least one -- Ret had no Attack Power, the Shockadin no Agility
   * and no Attack Power, both Protection builds no Block, the Bear no Defense
   * -- because a template may name more stats than a slot has room for and the
   * first N were taken every time.
   */
  it.each(BENCHMARK_TEMPLATES.map((t) => [t.label, t] as const))(
    '%s buys all of its preferences somewhere in the set',
    (_label, template) => {
      const totals = new Map<string, number>();
      for (const item of setsOf(template.presetId, 'E65')) {
        for (const [name, value] of Object.entries(item.stats)) {
          if (typeof value === 'number') totals.set(name, (totals.get(name) ?? 0) + value);
        }
      }
      /*
       * `Bonus Armor` IS EXCLUDED, and not because it is missing: it is written
       * as a `+N Armor` line and lands in the same `armor` stat the slot's own
       * base armour does, so it cannot be told apart from the outside.
       */
      const zeroes = template.preferred.filter(
        (stat) => stat !== 'Bonus Armor' && (totals.get(STAT_FOR_BENCH_STAT[stat]) ?? 0) === 0,
      );
      expect(zeroes).toEqual([]);
    },
  );

  it('rotates the TAIL of a long list and keeps the core', () => {
    const plan = ARMOUR_SLOTS.find((p) => p.slot === 'head')!;
    const long = ['Crit', 'Strength', 'Spell Power', 'Agility', 'Intellect', 'Stamina'] as const;

    const first = statsFor(plan, long, 0);
    const second = statsFor(plan, long, 1);
    // The core -- everything but the last position -- is the same on both.
    expect(first.slice(0, 4)).toEqual(second.slice(0, 4));
    // And the last position is a different member of the tail.
    expect(first[4]).not.toBe(second[4]);
  });

  it('changes nothing for a template that already fits', () => {
    // Twenty of the twenty-five name no more stats than a head holds, and for
    // those the rotation returns the same list whatever index it is given.
    const plan = ARMOUR_SLOTS.find((p) => p.slot === 'head')!;
    const short = ['Crit', 'Strength', 'Stamina', 'Agility', 'Attack Power'] as const;
    expect(statsFor(plan, short, 0)).toEqual(statsFor(plan, short, 3));
  });
});
