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
  ARMOUR_SLOTS,
  BUDGET_EXPONENT,
  COST,
  RATING_BUDGET_SHARE,
  RATING_DONOR_SHARE,
  RATING_STEP,
  SHARE_WEIGHT,
  TRINKET_CRIT_RATING,
  statsFor,
  weightedShares,
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
        /*
         * EVERY PIECE IS LOCKED TO A CLASS THAT INCLUDES THE WEARER, and to the
         * wearer alone unless it is a weapon another template borrows: the Enh
         * Shaman wears Seal Twist Ret's mace (`weaponsFrom`), which therefore
         * reads "Classes: Paladin, Shaman".
         */
        expect(item.classRestrictions).toContain(template.characterClass);
        if (item.weapon === undefined) {
          expect(item.classRestrictions).toEqual([template.characterClass]);
        }
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
      const preset = PRESETS_BY_ID.get(template.presetId);
      if (!preset) continue; // a retired preset's row; pinned below
      expect(`${template.presetId}: ${template.characterClass}`).toBe(
        `${template.presetId}: ${preset.build().character.characterClass}`,
      );
    }
  });

  it('keeps a row for exactly the three retired presets, and no other orphan', () => {
    /*
     * ROUND 82 RETIRED RUPTURE, SHOCKADIN AND SBOLT SPAM AND KEPT THEIR ROWS:
     * a saved profile may still hold one of their item ids, and Shockadin's row
     * is the starting set for a new one-hand-and-shield or caster Paladin. Any
     * other row with no preset is a template nobody can reach.
     */
    const orphans = BENCHMARK_TEMPLATES.filter((t) => !PRESETS_BY_ID.has(t.presetId)).map((t) => t.presetId);
    expect(orphans.sort()).toEqual(['pally_shockadin', 'rogue_rupture', 'warlock_sbolt']);
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
  it('never carries more than the owner s cap between them, on a DPS pair', () => {
    /*
     * ------------------------------------------------------------------------
     * THE TANKS ARE EXEMPT -- FOUR SINCE FURY PROT -- AND THAT IS THE OWNER'S TWO STATEMENTS
     * DISAGREEING RATHER THAN A HOLE HERE.
     *
     * "A maximum of 28 crit rating across both trinkets" was said of the DPS
     * archetypes. "1 with half item budget on stamina / half on crit. The
     * other trinket can be similar crit + attack power" is a later and more
     * specific instruction about the tanks, and half a trinket's budget is
     * about 21 rating at E65 -- so a tank pair comes to 42.
     *
     * The later and more specific statement wins, which is this project's
     * standing rule, and the figure is printed by `benchmark_stat_report.ts`
     * so the owner can see what their two sentences add up to.
     * ------------------------------------------------------------------------
     */
    const declared = BENCHMARK_TEMPLATES.filter((template) => template.trinkets === undefined);
    expect(declared.length).toBe(BENCHMARK_TEMPLATES.length - 4);

    for (const template of declared) {
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

  it('gives the three tanks the owner s own pair, and never an empty slot', () => {
    /*
     * "Tank trinkets shouldn't both be stamina only. Let's mix it up and do 1
     * with half item budget on stamina / half on crit. The other trinket can
     * be similar crit + attack power for bear and prot warr. And one pure
     * spell power trinket for Prot pally."
     *
     * A ternary here once handed these three an EMPTY share list and the set
     * silently lost 68 stamina, which is why every assertion below is that
     * something IS there.
     */
    for (const presetId of ['prot_warr', 'druid_bear']) {
      const equipment = benchmarkEquipmentFor(presetId, 'E65')!;
      const first = ITEMS_BY_ID.get(equipment.trinket1!.itemId)!;
      const second = ITEMS_BY_ID.get(equipment.trinket2!.itemId)!;
      expect(first.stats.stamina ?? 0).toBeGreaterThan(0);
      expect(first.stats.critRating ?? 0).toBeGreaterThan(0);
      expect(second.stats.critRating ?? 0).toBeGreaterThan(0);
      expect(second.stats.attackPower ?? 0).toBeGreaterThan(0);
    }

    const pally = benchmarkEquipmentFor('prot_pally', 'E65')!;
    const pallyFirst = ITEMS_BY_ID.get(pally.trinket1!.itemId)!;
    const pallySecond = ITEMS_BY_ID.get(pally.trinket2!.itemId)!;
    expect(pallyFirst.stats.stamina ?? 0).toBeGreaterThan(0);
    expect(pallyFirst.stats.critRating ?? 0).toBeGreaterThan(0);
    // Pure spell power: the owner's word, so nothing else on it.
    expect(pallySecond.stats.spellPower ?? 0).toBeGreaterThan(0);
    expect(pallySecond.stats.critRating ?? 0).toBe(0);
    expect(pallySecond.stats.attackPower ?? 0).toBe(0);
  });

  it('splits the tank s first trinket evenly, which SHARES would not', () => {
    // "Half item budget on stamina / half on crit". The positional table gives
    // 65/35 and `SHARE_WEIGHT` would then halve the crit again, so an even
    // split is a different mechanism rather than a different number.
    const first = ITEMS_BY_ID.get(
      benchmarkEquipmentFor('prot_warr', 'E65')!.trinket1!.itemId,
    )!;
    expect(first.stats.stamina!).toBe(first.stats.critRating!);
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
    /*
     * RE-MEASURED with `STAT=spellPower CLASS=mage real_set_shape.ts`: median
     * 292, p75 356, max 391. The figures drift as the item database grows, so
     * they are a reference and not a constant -- which is why the bounds
     * around them are loose.
     */
    spellPower: { median: 292, best: 391 },
  };

  it('keeps a melee set s crit inside the range real items occupy', () => {
    const crit = totalOf('two_hand_arms', 'E65', 'critRating');
    expect(crit).toBeGreaterThan(REAL_E65.crit.median * 0.8);
    expect(crit).toBeLessThanOrEqual(REAL_E65.crit.best);
  });

  it('gives a caster set the spell power a strong real set carries', () => {
    /*
     * ============================================================================
     * THE UPPER BOUND HAS SLACK AND THE LOWER ONE DOES NOT, which is a
     * statement about the EVIDENCE rather than a convenience.
     *
     * `best` is the richest single item in each slot summed -- and those
     * per-slot populations are 3 to 15 items, so the maximum of a handful is
     * not a ceiling the way a median over hundreds is a centre.
     *
     * WHAT THE ASSERTION IS FOR is the order of magnitude: spell power was 205
     * here, below an ORDINARY real set, and the failure that would matter is a
     * return to that or a run to twice the richest.
     *
     * ----------------------------------------------------------------------------
     * IT WENT 401 -> 429 WHEN THE OWNER STATED THE WEAPON FIGURE, AND THE
     * EXCESS IS NOT IN THE WEAPON. That is worth writing down here rather than
     * absorbing into a wider tolerance, because the decomposition says where a
     * future tightening would have to happen:
     *
     *     real E65 mage weapon slot   n=4, median 94, max 94
     *     generated weapon                       94   <- exact, by the owner's rule
     *     real set total              median 292, p75 356, max 391
     *     generated set total                                    429
     *
     * THE OWNER'S `ItemLevel + 29` REPRODUCES THE REAL ITEMS EXACTLY -- all
     * four real Forever caster weapons at this item level carry 94, and the
     * formula gives 94 -- so the weapon is now the most faithful slot in the
     * set rather than the least. What is over is the ARMOUR: 429 - 94 = 335
     * against a richest-real 391 - 94 = 297.
     *
     * AND THAT WAS ALREADY TRUE BEFORE THIS CHANGE, at 401 - 77 = 324 against
     * the same 297. Making the weapon correct did not create the excess; it
     * stopped the weapon being 17 short of real and thereby stopped masking it.
     * Pulling the armour back is a `SHARE_WEIGHT` decision and belongs to the
     * owner, so it is reported rather than tuned.
     * ============================================================================
     */
    const spellPower = totalOf('mage_fire', 'E65', 'spellPower');
    expect(spellPower).toBeGreaterThan(REAL_E65.spellPower.median);
    expect(spellPower).toBeLessThanOrEqual(REAL_E65.spellPower.best * 1.12);
  });

  it('gives a caster WEAPON exactly what a real Forever one carries', () => {
    /*
     * THE SHARPER HALF OF THE TEST ABOVE, and the one that can be exact.
     * `real_set_shape.ts` reports the weapon slot for a mage at item level
     * 60-70 as n=4, median 94, max 94 -- every real Forever caster weapon in
     * that band carries the same figure, and the owner's `ItemLevel + 29`
     * gives it. A set total is a sum of fifteen judgements; this is one
     * number against four real items.
     */
    const staff = benchmarkItemsFor(
      BENCHMARK_TEMPLATES.find((template) => template.label === 'Fire')!,
      BENCHMARK_SETS.find((set) => set.id === 'E65')!,
    ).find((item) => item.subclass === 'Staff')!;
    expect(staff.tooltip).toContain('+94 Spell Power');
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

  it('changes nothing for a template that already fits and has no pair', () => {
    /*
     * The rotation itself is a no-op for a list a slot can hold whole. The
     * example avoids Strength and Attack Power TOGETHER, because those two are
     * an `EXCLUSIVE_PAIR` and the pair takes its own turn by rotation -- which
     * is a second reason a slot's list can differ between indices and would
     * make this assertion test both mechanisms at once.
     */
    const plan = ARMOUR_SLOTS.find((p) => p.slot === 'head')!;
    const short = ['Crit', 'Agility', 'Stamina', 'Intellect', 'Spirit'] as const;
    expect(statsFor(plan, short, 0)).toEqual(statsFor(plan, short, 3));
  });
});

/* -------------------------------------------------------------------------- */
/* Paying for a rating                                                        */
/* -------------------------------------------------------------------------- */

describe('a hit rating is paid for out of crit, not out of spell power', () => {
  /*
   * ============================================================================
   * THE OWNER'S RULING, read off four items: "The spell power has been reduced
   * down to +1 spell power on some B55 items in order to account for +25 hit
   * rating ... Instead of pull from spell power to get more hit rating, it
   * should be pull from crit rating to get more hit rating."
   *
   * IT HAD TWO CAUSES AND THE RULE ADDRESSES ONE. The rating's cost came off
   * the TOTAL before the shares divided anything, so every stat shrank
   * together -- and at the 3/2 power a slot with little left rounds each share
   * to 0 or 1. That is what `RATING_DONORS` fixes. The other cause is that 25
   * hit costs 97% of a B55 medium slot whatever it is taken from, which is
   * what `RATING_BUDGET_SHARE` fixes.
   * ============================================================================
   */
  it('leaves no stat line at 1, which is what the owner saw', () => {
    const tiny: string[] = [];
    for (const item of BENCHMARK_ITEMS) {
      for (const effect of item.effects) {
        const match = /^\+(\d+) (Spell Power|Attack Power)$/.exec(effect.text);
        if (match && Number(match[1]) <= 1) {
          tiny.push(`${item.name} ${item.inventoryType}: ${effect.text}`);
        }
      }
    }
    expect(tiny).toEqual([]);
  });

  it('takes the rating out of crit on a slot that carries both', () => {
    /*
     * The same slot with and without its hit, which is the only way to see
     * WHERE the cost came from. Crit falls and spell power does not.
     */
    const withHit = ITEMS_BY_ID.get(
      benchmarkEquipmentFor('mage_fire', 'E65')!.gloves!.itemId,
    )!;
    const withoutHit = ITEMS_BY_ID.get(
      benchmarkEquipmentFor('mage_fire', 'E65')!.chest!.itemId,
    )!;
    expect(withHit.stats.hitChance ?? 0).toBeGreaterThan(0);
    expect(withoutHit.stats.hitChance ?? 0).toBe(0);
    // Gloves is a four-stat slot and chest a five-stat one, so the comparison
    // is the SHAPE: the slot carrying hit still has real spell power on it.
    expect(withHit.stats.spellPower ?? 0).toBeGreaterThan(5);
  });

  it('is bounded, so crit is not drained to nothing', () => {
    /*
     * The literal reading over-corrects: a caster carries 110 hit across
     * almost every slot, so unbounded draining leaves crit at 74 against a
     * real mage set's 154 -- and pushes spell power above the richest set in
     * the database. See `RATING_DONOR_SHARE`.
     */
    expect(RATING_DONOR_SHARE).toBeGreaterThan(0);
    expect(RATING_DONOR_SHARE).toBeLessThan(1);
    const caster = totalOf('mage_fire', 'E65', 'critRating');
    expect(caster).toBeGreaterThan(100);
  });

  it('never lets a rating take more than half a slot, which is what crushed B55', () => {
    /*
     * 25 hit is 97% of a B55 medium slot and 42% of an E85 one, which is why
     * the cap is a SHARE and not an amount. The four slots that read "+25 Hit
     * Rating, +2 Stamina, +1 Spell Power" are what it exists for.
     *
     * UNLESS THE OWNER'S TOTAL CANNOT FIT UNDER THE CAPS AT ALL, which first
     * happened in round 44: Fire Demo asks for 150 hit, and at B55 its hit
     * slots hold less than that at half a slot each. The total is absolute, so
     * the cap gives way -- but only once EVERY hit slot in the set is full, and
     * the sets where that happens are named below rather than tolerated.
     */
    const shareOf = (item: (typeof BENCHMARK_ITEMS)[number]) => {
      const rating = (ITEMS_BY_ID.get(item.id)?.stats.hitChance ?? 0) * RATING_PER_PERCENT.hit;
      return (rating * COST.Hit) ** BUDGET_EXPONENT / item.budget ** BUDGET_EXPONENT;
    };
    const overflowing: string[] = [];
    for (const template of BENCHMARK_TEMPLATES) {
      for (const set of BENCHMARK_SETS) {
        const carrying = benchmarkItemsFor(template, set).filter(
          (item) => (ITEMS_BY_ID.get(item.id)?.stats.hitChance ?? 0) > 0,
        );
        const over = carrying.filter((item) => shareOf(item) > RATING_BUDGET_SHARE + 1e-9);
        if (over.length === 0) continue;
        overflowing.push(`${template.label} ${set.id}`);
        // Every slot carrying hit is at its cap: within one step of five.
        for (const item of carrying) {
          const nextStep =
            (((ITEMS_BY_ID.get(item.id)?.stats.hitChance ?? 0) * RATING_PER_PERCENT.hit + RATING_STEP) *
              COST.Hit) **
              BUDGET_EXPONENT /
            item.budget ** BUDGET_EXPONENT;
          expect(nextStep, `${item.name} ${item.inventoryType} has room left`).toBeGreaterThan(
            RATING_BUDGET_SHARE,
          );
        }
      }
    }
    expect(overflowing).toEqual(['Fire Demo B55']);
  });

  it('still reaches each profile its EXACT total, which is absolute', () => {
    // The owner's figure wins over the cap if they ever conflict, because
    // "even though the needed hit cap is mandatory, IT STILL COUNTS AGAINST
    // THE STAT BUDGET ON THE ITEMS" -- it is a requirement, not a preference.
    for (const template of BENCHMARK_TEMPLATES) {
      for (const set of BENCHMARK_SETS) {
        let hit = 0;
        for (const item of benchmarkItemsFor(template, set)) {
          for (const effect of item.effects) {
            const match = /^\+(\d+) Hit Rating$/.exec(effect.text);
            if (match) hit += Number(match[1]);
          }
        }
        expect(`${template.label} ${set.id}: ${hit}`).toBe(
          `${template.label} ${set.id}: ${template.hit}`,
        );
      }
    }
  });

  it('spreads a rating in whole steps of five, as a real item states it', () => {
    for (const item of BENCHMARK_ITEMS) {
      for (const effect of item.effects) {
        const match = /^\+(\d+) (Hit|Expertise) Rating$/.exec(effect.text);
        if (match) expect(Number(match[1]) % RATING_STEP).toBe(0);
      }
    }
  });

  it('does not let hit and expertise stack past the cap on one slot', () => {
    /*
     * They are spread in two passes over the same slots, so the second is told
     * what the first took. Without that a Rogue's 150 hit and 10 expertise can
     * land together and put a slot over the cap that exists to stop it.
     */
    for (const item of BENCHMARK_ITEMS) {
      const built = ITEMS_BY_ID.get(item.id)!;
      const hit = (built.stats.hitChance ?? 0) * RATING_PER_PERCENT.hit;
      const expertise = (built.stats.dodgeParryReduction ?? 0) * RATING_PER_PERCENT.expertise;
      if (hit === 0 || expertise === 0) continue;
      const spent = (hit * COST.Hit) ** BUDGET_EXPONENT + (expertise * COST.Expertise) ** BUDGET_EXPONENT;
      expect(spent).toBeLessThanOrEqual(item.budget ** BUDGET_EXPONENT);
    }
  });
});
