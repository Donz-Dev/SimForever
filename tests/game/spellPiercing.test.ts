import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/game/items/itemData';
import { talentBuild } from '../../src/game/talents/talentBuild';
import {
  SPELL_RESISTANCE_K_PER_LEVEL,
  spellResistanceConstant,
} from '../../src/game/combat/spellResistance';

/*
 * ============================================================================
 * THE RULESET'S HALF OF SPELL RESISTANCE (round 46): K, and the two places
 * Spell Piercing comes from -- an item line and Arcane Subtlety.
 * ============================================================================
 */

describe('K', () => {
  it('is nine times the caster\'s level, the owner\'s choice: 540 at 60', () => {
    expect(SPELL_RESISTANCE_K_PER_LEVEL).toBe(9);
    expect(spellResistanceConstant(60)).toBe(540);
  });
});

describe('"+N Spell Penetration" on an item', () => {
  it('is read as Spell Piercing', () => {
    // "Equip: +3 Spell Penetration", on the Forever capture's own tooltip.
    const spaulders = ITEMS.find((item) => item.name === "Field Marshal's Silk Spaulders");
    expect(spaulders?.tooltip).toContain('+3 Spell Penetration');
    expect(spaulders?.stats.spellPiercing).toBe(3);
    expect(spaulders?.unmodelled.some((line) => /Penetration/.test(line.text))).toBe(false);
  });

  it('is read on every item that carries the line, and left unread on none', () => {
    const carriers = ITEMS.filter((item) => /Spell Penetration/.test(item.tooltip ?? ''));
    // 25 once the changed-items override layer has replaced its Classic twins.
    expect(carriers.length).toBeGreaterThanOrEqual(20);
    for (const item of carriers) {
      expect(item.stats.spellPiercing ?? 0, item.name).toBeGreaterThan(0);
    }
  });
});

describe('Arcane Subtlety', () => {
  it('grants Spell Piercing by rank, 8 then 15', () => {
    /*
     * "Reduces your target's resistance to all your spells by {0}". It was
     * filed under the THREAT scope with a reason covering both clauses, so the
     * resistance half was counted as answered and did nothing.
     */
    expect(talentBuild('mage', { arcane_subtlety: 1 }).stats.spellPiercing).toBe(8);
    expect(talentBuild('mage', { arcane_subtlety: 2 }).stats.spellPiercing).toBe(15);
  });
});
