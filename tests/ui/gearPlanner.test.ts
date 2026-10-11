import { describe, expect, it } from 'vitest';
import { qualityColour, tooltipLines } from '../../src/ui/panels/gear/tooltipLines';
import {
  LEFT_SLOTS,
  RIGHT_SLOTS,
  pickerItems,
  weaponSlotsFor,
} from '../../src/ui/panels/gear/slots';
import { ITEMS_BY_ID, itemsForSlot } from '../../src/game/items/itemData';
import { defaultValuationForPreset } from '../../src/game/items/defaultValuation';
import { BENCHMARK_TEMPLATES } from '../../src/game/items/benchmarkSets';

/*
 * ==============================================================================
 * THE PANEL'S OWN LOGIC, TESTED WITHOUT THE PANEL.
 *
 * `Panel` is `useState(true)`: a collapsible panel starts SHUT and renders no
 * body at all in a static render, so a test that went through `GearPanel`
 * would assert nothing about any of this and would pass just as happily if the
 * whole pane were deleted. That is why the card's text, the slot layout and
 * the sorting live in plain modules -- `aplEditing.ts`'s arrangement, for the
 * same reason.
 * ==============================================================================
 */

describe('the item card is the capture s own tooltip, drawn', () => {
  it('drops the name line the card already draws as a heading', () => {
    const lines = tooltipLines('Thunderfury\nBinds when picked up', 'Thunderfury');
    expect(lines.map((line) => line.left)).toEqual(['Binds when picked up']);
  });

  /*
   * THE DUPLICATE THE BROWSER FOUND. A generated benchmark item writes an
   * `Item Level 65` line into its own tooltip and a captured Forever item
   * writes none -- so the card printed "Item Level 65" twice for half the
   * database. Matched by SHAPE and not by position, so a capture that stops
   * writing the line loses nothing.
   */
  it('drops a leading Item Level line, which only half the database carries', () => {
    const generated = tooltipLines('E65 Head\nItem Level 65\n589 Armor', 'E65 Head');
    expect(generated.map((line) => line.left)).toEqual(['589 Armor']);

    const captured = tooltipLines('Demonic Gauntlet\nBinds when picked up', 'Demonic Gauntlet');
    expect(captured.map((line) => line.left)).toEqual(['Binds when picked up']);
  });

  it('keeps every line when the tooltip does not open with the name', () => {
    const lines = tooltipLines('Something else\n+10 Strength', 'Thunderfury');
    expect(lines).toHaveLength(2);
  });

  it('splits a tabbed line into the card s two columns', () => {
    const [line] = tooltipLines('X\nTwo-Hand\tStaff', 'X');
    expect(line.left).toBe('Two-Hand');
    expect(line.right).toBe('Staff');
  });

  it('colours stats, armour and Equip lines as stats', () => {
    const kinds = tooltipLines(
      'X\n+29 Intellect\n75 Armor\n44 Block\nEquip: +14 Critical Strike Rating\nUse: Something',
      'X',
    ).map((line) => line.kind);
    expect(kinds).toEqual(['stat', 'stat', 'stat', 'stat', 'stat']);
  });

  it('colours a NEGATIVE stat as a stat too', () => {
    // Lapidis Tankard carries "-15 Agility". A `+`-only pattern would draw a
    // penalty as ordinary text, which is the same trap the item parser's own
    // rule fell into and had to be widened for.
    expect(tooltipLines('X\n-15 Agility', 'X')[0].kind).toBe('stat');
  });

  it('dims the derived dps line and a set roster', () => {
    const kinds = tooltipLines('X\n(51.3 damage per second)\n(4) Set : Something', 'X').map(
      (line) => line.kind,
    );
    expect(kinds).toEqual(['muted', 'muted']);
  });

  it('leaves binds, requires and the slot line plain', () => {
    const kinds = tooltipLines('X\nBinds when equipped\nRequires Level 60\nUnique', 'X').map(
      (line) => line.kind,
    );
    expect(kinds).toEqual(['plain', 'plain', 'plain']);
  });

  it('drops blank lines, which a capture is full of', () => {
    expect(tooltipLines('X\n\n  \n+1 Strength', 'X')).toHaveLength(1);
  });
});

describe('an item name takes its colour from a token, never a literal', () => {
  /*
   * The stylesheet's own rule -- "roles, not shades" -- applies to an inline
   * `style` as much as to a CSS rule, and `themes.test.ts` enforces it for the
   * stylesheet. This is the same guard on the TypeScript side: the six quality
   * values have ONE copy, in `styles.css`.
   */
  it('returns a custom property for every quality', () => {
    for (let quality = 0; quality < 6; quality += 1) {
      expect(qualityColour(quality)).toBe(`var(--quality-${quality})`);
    }
  });

  it('falls back to the ordinary white item for a quality this build does not know', () => {
    expect(qualityColour(9)).toBe('var(--quality-1)');
    expect(qualityColour(-1)).toBe('var(--quality-1)');
  });
});

describe('the character pane', () => {
  it('has no shirt and no tabard, which the owner asked to drop', () => {
    const ids = [...LEFT_SLOTS, ...RIGHT_SLOTS].map((slot) => slot.id);
    expect(ids).not.toContain('shirt');
    expect(ids).not.toContain('tabard');
  });

  it('lays every armour, jewellery and relic slot out exactly once', () => {
    const ids = [...LEFT_SLOTS, ...RIGHT_SLOTS].map((slot) => slot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(
      [
        'chest', 'cloak', 'feet', 'gloves', 'head', 'legs', 'neck', 'relic',
        'ring1', 'ring2', 'shoulders', 'trinket1', 'trinket2', 'waist', 'wrists',
      ].sort(),
    );
  });

  it('offers a two-hander to a two-hand style and never an off hand', () => {
    const ids = weaponSlotsFor('two_hander').map((slot) => slot.id);
    expect(ids).toContain('twoHand');
    expect(ids).not.toContain('offHand');
  });

  it('offers a dual-wielder two hands and no two-hander', () => {
    const ids = weaponSlotsFor('dual_wield').map((slot) => slot.id);
    expect(ids).toEqual(['mainHand', 'offHand', 'ranged']);
  });

  it('offers a shield build a shield rather than a second weapon', () => {
    const ids = weaponSlotsFor('one_hand_shield').map((slot) => slot.id);
    expect(ids).toContain('shield');
    expect(ids).not.toContain('offHand');
  });

  it('offers a form or caster style every hand, because they are stat sticks', () => {
    // The Elemental shaman wears a caster shield and the Hunter sets hold a
    // two-hander for its agility; leaving a row out never stopped a preset
    // equipping one, it only stopped the person SEEING it.
    const ids = weaponSlotsFor('caster').map((slot) => slot.id);
    expect(ids).toEqual(['mainHand', 'offHand', 'twoHand', 'shield', 'ranged']);
  });
});

describe('a slot s list is sorted by what the build values', () => {
  const dwFury = defaultValuationForPreset('dw_fury');

  const list = (overrides: Partial<Parameters<typeof pickerItems>[0]> = {}) =>
    pickerItems({
      slot: 'head',
      characterClass: 'warrior',
      style: 'dual_wield',
      valuation: dwFury,
      search: '',
      showUnusable: false,
      ...overrides,
    });

  it('puts the most valuable item first and never goes back up', () => {
    const scores = list().map((row) => row.score);
    expect(scores.length).toBeGreaterThan(10);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  /*
   * A BUILD WITH NO TEMPLATE SORTS BY ITEM LEVEL AND THE PANEL SAYS SO. An
   * empty valuation scores every item zero, and a column of identical zeroes
   * sorted alphabetically is worse than no sorting at all.
   */
  it('falls back to item level when there is no valuation', () => {
    const levels = list({ valuation: {} }).map((row) => row.item.itemLevel);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
  });

  it('is stable: equal score and equal item level break on the name', () => {
    const rows = list({ valuation: {} });
    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i].item.itemLevel === rows[i - 1].item.itemLevel) {
        expect(rows[i - 1].item.name.localeCompare(rows[i].item.name)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('filters to what the class can equip', () => {
    /*
     * NO CLASS SEES EVERY HEAD ITEM ANY MORE, which is the `Classes:` line: a
     * Warrior is refused the Mage and Priest tier it could otherwise wear by
     * armour class alone. So the assertion is the ORDERING -- a Rogue, who is
     * refused mail and plate on top of that, sees fewer than a Warrior.
     */
    const all = itemsForSlot('head').length;
    const warrior = list({ characterClass: 'warrior' }).length;
    const rogue = list({ characterClass: 'rogue' }).length;
    expect(warrior).toBeLessThan(all);
    expect(rogue).toBeLessThan(warrior);
  });

  it('shows the unusable ones greyed when asked, and sorts them LAST', () => {
    const rows = list({ characterClass: 'rogue', showUnusable: true });
    expect(rows).toHaveLength(itemsForSlot('head').length);
    const firstIllegal = rows.findIndex((row) => row.illegal === true);
    expect(firstIllegal).toBeGreaterThan(0);
    expect(rows.slice(firstIllegal).every((row) => row.illegal === true)).toBe(true);
  });

  /*
   * WHAT IS ALREADY WORN IS ALWAYS LISTED. A profile loaded from a file, or
   * saved before the filter existed, can be wearing something this table calls
   * illegal -- and a picker that hid it would show the slot's current contents
   * nowhere at all.
   */
  it('always lists what is already equipped, even when the filter excludes it', () => {
    const plate = itemsForSlot('head').find((item) => item.subclass === 'Plate')!;
    const rows = list({ characterClass: 'rogue', equippedId: plate.id });
    expect(rows.some((row) => row.item.id === plate.id)).toBe(true);
  });

  it('matches the search against the name, ignoring case', () => {
    const named = itemsForSlot('head')[0].name;
    const rows = list({ search: named.toUpperCase() });
    expect(rows.some((row) => row.item.name === named)).toBe(true);
    expect(rows.every((row) => row.item.name.toLowerCase().includes(named.toLowerCase()))).toBe(true);
  });

  it('never offers a benchmark item, which is generated rather than captured', () => {
    // A dropdown that offered "E85 Chest" beside real loot would be the one
    // place somebody could mistake synthetic gear for Forever data.
    expect(list().every((row) => row.item.id < 9_500_000)).toBe(true);
  });

  it('scores every one of the 25 templates against a real slot without throwing', () => {
    for (const template of BENCHMARK_TEMPLATES) {
      const rows = pickerItems({
        slot: 'chest',
        characterClass: 'warrior',
        style: 'two_hander',
        valuation: defaultValuationForPreset(template.presetId),
        search: '',
        showUnusable: false,
      });
      expect(rows.every((row) => Number.isFinite(row.score))).toBe(true);
    }
  });
});

describe('the value beside a row is the value on its card', () => {
  it('reads the same item the panel reads', () => {
    const rows = pickerItems({
      slot: 'chest',
      characterClass: 'warrior',
      style: 'two_hander',
      valuation: defaultValuationForPreset('two_hand_arms'),
      search: '',
      showUnusable: false,
    });
    const top = rows[0];
    expect(ITEMS_BY_ID.get(top.item.id)).toBe(top.item);
    expect(top.score).toBeGreaterThan(0);
  });
});
