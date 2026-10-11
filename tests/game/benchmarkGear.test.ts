import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_SETS,
  BENCHMARK_ID_BASE,
  BENCHMARK_ITEMS,
  BENCHMARK_TEMPLATES,
  BENCHMARK_TEMPLATES_BY_LABEL,
  benchmarkEquipmentFor,
  benchmarkItemsFor,
} from '../../src/game/items/benchmarkSets';
import { ITEMS, ITEMS_BY_ID, itemsForSlot } from '../../src/game/items/itemData';
import { PROFILE_PRESETS, PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { RATING_PER_PERCENT } from '../../src/engine';
import type { EquipmentSlot } from '../../src/game/items/Item';

/**
 * ==============================================================================
 * THE SET HAS TO FIT ITS BUDGET, which is the one claim generating gear makes.
 *
 * Everything else about a benchmark item is a presentation choice -- which
 * slots carry the hit, how a slot's budget divides between its stats, what a
 * staff's swing speed is. The claim that can be WRONG is that the result is an
 * item somebody could plausibly have looted, and that reduces to: does it spend
 * what its item level and slot allow?
 * ==============================================================================
 */
describe('benchmark gear fits the budget it was generated from', () => {
  it('spends no more than its slot allows, on every item of every set', () => {
    const over = BENCHMARK_ITEMS.filter((item) => item.spent > item.budget * 1.02).map(
      (item) => `${item.name} ${item.itemLevel}: ${item.spent.toFixed(1)} of ${item.budget.toFixed(1)}`,
    );
    expect(over).toEqual([]);
  });

  it('spends MOST of it too, because an underspent set is a quiet handicap', () => {
    /*
     * The floor is 90%, not 100%: rounding every stat to an integer loses a
     * little, and a slot whose whole budget goes to hit has nothing left to
     * round. An item at 60% would mean the allocator dropped something.
     */
    const under = BENCHMARK_ITEMS.filter((item) => item.spent < item.budget * 0.9).map(
      (item) => `${item.name} ${item.itemLevel}: ${item.spent.toFixed(1)} of ${item.budget.toFixed(1)}`,
    );
    expect(under).toEqual([]);
  });
});

describe('the spreadsheet is honoured', () => {
  it('reaches each profile its EXACT hit rating, in realistic pieces', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      for (const set of BENCHMARK_SETS) {
        const items = benchmarkItemsFor(template, set);
        let hit = 0;
        for (const item of items) {
          for (const effect of item.effects) {
            const match = /^\+(\d+) Hit Rating$/.exec(effect.text);
            if (match) {
              hit += Number(match[1]);
              // No real item carries 40 hit; the spread exists to stop that.
              expect(Number(match[1])).toBeLessThanOrEqual(25);
            }
          }
        }
        expect(`${template.label} ${set.id}: ${hit}`).toBe(
          `${template.label} ${set.id}: ${template.hit}`,
        );
      }
    }
  });

  it('reaches each profile its EXACT reduced dodge/parry rating', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      const items = benchmarkItemsFor(template, BENCHMARK_SETS[1]);
      let expertise = 0;
      for (const item of items) {
        for (const effect of item.effects) {
          const match = /^\+(\d+) Expertise Rating$/.exec(effect.text);
          if (match) expertise += Number(match[1]);
        }
      }
      expect(`${template.label}: ${expertise}`).toBe(`${template.label}: ${template.expertise}`);
    }
  });

  it('puts the first preferred stat on more items than the last', () => {
    // The spreadsheet's order is descending importance, so the allocator has to
    // read it as an order rather than a set.
    const template = BENCHMARK_TEMPLATES.find((t) => t.label === '2H Arms')!;
    const items = benchmarkItemsFor(template, BENCHMARK_SETS[1]);
    const count = (needle: string) =>
      items.filter((i) => i.effects.some((e) => e.text.includes(needle))).length;
    expect(count('Critical Strike Rating')).toBeGreaterThan(count('Attack Power'));
  });

  it('keeps jewellery to one base attribute', () => {
    const PRIMARIES = ['Strength', 'Agility', 'Stamina', 'Intellect', 'Spirit'];
    for (const item of BENCHMARK_ITEMS) {
      if (!['Finger', 'Neck', 'Trinket'].includes(item.inventoryType)) continue;
      const attributes = item.effects.filter((e) =>
        PRIMARIES.some((p) => e.text.endsWith(` ${p}`)),
      );
      expect(`${item.name}: ${attributes.length}`).toBe(`${item.name}: ${Math.min(1, attributes.length)}`);
    }
  });
});

describe('they are unmistakably synthetic', () => {
  it('is numbered and named so nothing can be read as Forever data', () => {
    for (const item of BENCHMARK_ITEMS) {
      expect(item.id).toBeGreaterThanOrEqual(BENCHMARK_ID_BASE);
      expect(item.name).toMatch(/^(B55|E65|E75|E85) /);
      expect(item.source).toContain('SYNTHETIC');
    }
  });

  it('is never offered in a slot dropdown', () => {
    const slots: EquipmentSlot[] = ['head', 'chest', 'mainHand', 'twoHand', 'ranged', 'ring1'];
    for (const slot of slots) {
      const offered = itemsForSlot(slot).filter((i) => i.id >= BENCHMARK_ID_BASE);
      expect(offered).toEqual([]);
    }
  });

  it('does not collide with a captured id', () => {
    const captured = ITEMS.filter((i) => i.id < BENCHMARK_ID_BASE).map((i) => i.id);
    expect(new Set(captured).size).toBe(captured.length);
    expect(Math.max(...captured)).toBeLessThan(BENCHMARK_ID_BASE);
  });

  it('does not pick up the Forever spell power override', () => {
    /*
     * `FOREVER_SPELL_POWER_BUFFS` adds 64 spell power to four caster weapons by
     * ID. The owner asked specifically that it not infect generated gear, and
     * the id range is what guarantees it -- but an assertion is cheaper than
     * trusting a range.
     */
    const staff = BENCHMARK_ITEMS.find((i) => i.name === 'E65 Two-Hand Staff')!;
    const built = ITEMS_BY_ID.get(staff.id)!;
    const stated = staff.effects
      .filter((e) => /Spell Power$/.test(e.text))
      .reduce((total, e) => total + Number(/\+(\d+)/.exec(e.text)![1]), 0);
    expect(built.stats.spellPower ?? 0).toBe(stated);
  });
});

describe('the panel can find a template from the profile alone', () => {
  it('matches all 25 presets by character name', () => {
    /*
     * THE JOIN THE UI DEPENDS ON. `game` may not import from `profiles`, so the
     * Gear panel looks a template up by `character.name` -- and a preset label
     * changing would quietly stop the buttons appearing rather than fail
     * anything. This is the assertion that turns that into a suite failure.
     */
    const missing = PROFILE_PRESETS.filter(
      (preset) => !BENCHMARK_TEMPLATES_BY_LABEL.has(preset.build().character.name),
    ).map((preset) => `${preset.id}: ${preset.build().character.name}`);
    expect(missing).toEqual([]);
  });

  it('points each label at the template for that same preset', () => {
    // Matching by name must not quietly hand a Rogue the Warrior's set.
    for (const preset of PROFILE_PRESETS) {
      const template = BENCHMARK_TEMPLATES_BY_LABEL.get(preset.build().character.name)!;
      expect(`${preset.id} -> ${template.presetId}`).toBe(`${preset.id} -> ${preset.id}`);
    }
  });
});

describe('a set equips onto its profile', () => {
  it('fills every slot for all 25 presets, at every set', () => {
    for (const preset of PROFILE_PRESETS) {
      for (const set of BENCHMARK_SETS) {
        const equipment = benchmarkEquipmentFor(preset.id, set.id);
        expect(`${preset.id} ${set.id}`).toBe(
          equipment ? `${preset.id} ${set.id}` : 'MISSING',
        );
        for (const equipped of Object.values(equipment!)) {
          expect(ITEMS_BY_ID.get(equipped!.itemId)).toBeDefined();
        }
      }
    }
  });

  it('gives the character its hit cap, through the engine', () => {
    /*
     * END TO END, not off the items: hit is granted as a RATING and the engine
     * divides by 10 to get a percentage point, so this is the assertion that
     * the owner's "needed hit rating" actually arrives as hit.
     */
    const preset = PRESETS_BY_ID.get('rogue_venom')!;
    const built = preset.build();
    const bare = characterAtCombatStart({ ...built, equipment: {} } as never)!;
    const geared = characterAtCombatStart({
      ...built,
      equipment: benchmarkEquipmentFor('rogue_venom', 'E65')!,
    } as never)!;
    const gained = geared.stats.effective.hitChance - bare.stats.effective.hitChance;
    expect(gained).toBeCloseTo(120 / RATING_PER_PERCENT.hit, 6);
  });

  it('gives a two-hander to a two-hand build and two weapons to a dual-wielder', () => {
    const arms = benchmarkEquipmentFor('two_hand_arms', 'E65')!;
    expect(arms.twoHand).toBeDefined();
    expect(arms.offHand).toBeUndefined();

    const fury = benchmarkEquipmentFor('dw_fury', 'E65')!;
    expect(fury.mainHand).toBeDefined();
    expect(fury.offHand).toBeDefined();

    const prot = benchmarkEquipmentFor('prot_warr', 'E65')!;
    expect(prot.shield).toBeDefined();
    expect(prot.mainHand).toBeDefined();

    const hunter = benchmarkEquipmentFor('bm_hunter', 'E65')!;
    expect(hunter.ranged).toBeDefined();
  });
});

describe('every line a benchmark item states is a line the engine reads', () => {
  it('leaves nothing in `unmodelled` on any of the 1,560 generated items', () => {
    /*
     * ==========================================================================
     * THE SET PAYS BUDGET FOR A STAT AND THEN HAS TO GRANT IT.
     *
     * A benchmark item is generated as TOOLTIP TEXT and parsed back through
     * `itemData`'s own rules, deliberately: that is what makes it reach the
     * engine down the same path a captured item does, instead of through a
     * second copy of the parser. The cost of that choice is a seam -- the
     * generator can write a line the parser has never been taught to read, and
     * the budget is spent either way.
     *
     * IT HAPPENED, AND IT COST EVERY PRIMARY ON EVERY SET. `LINE.Strength`
     * writes "+19 Strength", a CAPTURED item carries its primaries in the raw
     * `stats` object instead, and so no rule existed for the words. A Warrior's
     * E65 set came out as 328 Critical Strike Rating -- 23.4% crit, entirely
     * plausible -- with **no strength, stamina or agility at all**, and the
     * first full measurement of the E65 sets was taken that way.
     *
     * WHY NOTHING CAUGHT IT: `budget` and `spent` still balanced, because both
     * are computed from the ALLOCATION rather than from the parse; the items
     * were in the right slots; the tooltips read correctly to a human; and
     * `item_vocabulary.ts`, the one tool whose job is to find unread lines,
     * excluded generated items on purpose.
     *
     * SO THE ASSERTION IS ZERO, FOR EVERY ITEM, AND IT NAMES WHAT IT FOUND --
     * a count alone would say "17 lines" and leave somebody grepping.
     * ==========================================================================
     */
    const stranded = ITEMS.filter((item) => item.id >= BENCHMARK_ID_BASE).flatMap((item) =>
      item.unmodelled.map((effect) => `${item.name} (${item.id}): "${effect.text}"`),
    );
    expect(stranded).toEqual([]);
  });

  it('grants every primary its preferred stats name', () => {
    /*
     * THE OTHER HALF, because "nothing unread" would also be true of a
     * generator that stopped writing primaries altogether. A melee set's
     * strength is the biggest single thing on it, so it is asserted directly.
     */
    for (const presetId of ['two_hand_arms', 'dw_fury', 'druid_cat']) {
      const equipment = benchmarkEquipmentFor(presetId, 'E65')!;
      const strength = Object.values(equipment).reduce(
        (sum, equipped) => sum + (ITEMS_BY_ID.get(equipped!.itemId)?.stats.strength ?? 0),
        0,
      );
      expect(strength, presetId).toBeGreaterThan(50);
    }

    // And a caster set carries spell power and intellect rather than strength.
    const mage = benchmarkEquipmentFor('mage_fire', 'E65')!;
    const casterTotals = Object.values(mage).reduce(
      (acc, equipped) => {
        const stats = ITEMS_BY_ID.get(equipped!.itemId)?.stats ?? {};
        return {
          spellPower: acc.spellPower + (stats.spellPower ?? 0),
          intellect: acc.intellect + (stats.intellect ?? 0),
          strength: acc.strength + (stats.strength ?? 0),
        };
      },
      { spellPower: 0, intellect: 0, strength: 0 },
    );
    expect(casterTotals.spellPower).toBeGreaterThan(100);
    expect(casterTotals.intellect).toBeGreaterThan(50);
    expect(casterTotals.strength).toBe(0);
  });
});
