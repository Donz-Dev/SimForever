import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { talentsForClass } from '../../src/game/talents/talentData';
import { talentNumber, talentValue } from '../../src/game/talents/talentValues';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';

const warrior = (talents: Record<string, number> = {}) =>
  createPlayer({ race: 'human', characterClass: 'warrior', combatStyle: 'dual_wield', talents });

/*
 * Values transcribed BY HAND from the Forever talent calculator, not read out
 * of src/data/talents/values/warrior.json. A test that asked the values file
 * what the values file said would pass whatever the values file said.
 *
 * Improved Rend is here because it is NOT 12/24/36. Three Warrior talents break
 * the linear assumption, and this is the test that would fail if anyone ever
 * decided to generate ranks from rank one.
 */
const HAND_TRANSCRIBED: Record<string, readonly number[]> = {
  improved_heroic_strike: [1, 2, 3],
  cruelty: [1, 2, 3, 4, 5],
  precision: [1, 2, 3],
  vitality: [2, 4, 6, 8, 10],
  boundless_rage: [10, 20, 30],
  improved_execute: [3, 5],
  improved_intercept: [5, 10],
  improved_rend: [12, 23, 35],
  improved_disarm: [7, 13, 20],
  flurry: [5, 10, 15, 20, 25],
};

describe('talent values', () => {
  for (const [id, expected] of Object.entries(HAND_TRANSCRIBED)) {
    it(`${id} reads ${expected.join('/')}`, () => {
      const read = expected.map((_, index) => talentNumber('warrior', id, index + 1));
      expect(read).toEqual([...expected]);
    });
  }

  it('does not extrapolate a rank it does not have', () => {
    expect(talentNumber('warrior', 'improved_heroic_strike', 4)).toBeUndefined();
    expect(talentNumber('warrior', 'improved_heroic_strike', 0)).toBeUndefined();
  });

  it('has no values for a class that was never captured', () => {
    expect(talentNumber('mage', 'arcane_focus', 1)).toBeUndefined();
  });

  it('keeps every varying number for a talent that varies several', () => {
    // Dual Wield Specialization: off-hand damage, rage generation and hit.
    expect(talentValue('warrior', 'dual_wield_specialization', 1)).toEqual([5, 20, 2]);
  });
});

describe('every Warrior talent declares what it does', () => {
  const talents = talentsForClass('warrior');

  it('covers all of them, so a missing entry is a mistake rather than silence', () => {
    expect(talents).toBeDefined();
    if (!talents) return;
    const missing = [...talents.byId.keys()].filter((id) => !WARRIOR_TALENT_EFFECTS[id]);
    expect(missing).toEqual([]);
  });

  it('declares nothing for a talent that does not exist', () => {
    expect(talents).toBeDefined();
    if (!talents) return;
    const unknown = Object.keys(WARRIOR_TALENT_EFFECTS).filter((id) => !talents.byId.has(id));
    expect(unknown).toEqual([]);
  });

  it('gives every unmodelled talent a reason', () => {
    for (const [id, effects] of Object.entries(WARRIOR_TALENT_EFFECTS)) {
      for (const effect of effects) {
        if (effect.kind === 'unmodelled') {
          expect(effect.reason.length, `${id} has an empty reason`).toBeGreaterThan(20);
        }
      }
    }
  });
});

describe('stat effects', () => {
  it('adds Cruelty to crit, one percentage point per rank', () => {
    const before = warrior().stats.effective.critChance;
    expect(warrior({ cruelty: 5 }).stats.effective.critChance).toBeCloseTo(before + 5, 5);
    expect(warrior({ cruelty: 2 }).stats.effective.critChance).toBeCloseTo(before + 2, 5);
  });

  it('adds Precision to hit', () => {
    expect(warrior({ precision: 3 }).stats.effective.hitChance).toBeCloseTo(3, 5);
  });

  it('applies Vitality as a percentage of stamina and strength', () => {
    const before = warrior();
    const after = warrior({ vitality: 5 }); // +10%
    expect(after.stats.effective.stamina).toBeCloseTo(before.stats.effective.stamina * 1.1, 5);
    expect(after.stats.effective.strength).toBeCloseTo(before.stats.effective.strength * 1.1, 5);
  });

  it('re-derives attack power from the strength Vitality added', () => {
    /*
     * The reason percentage talents stay modifiers rather than being folded
     * into a flat number. Attack power is a FUNCTION of strength, so it has to
     * move when strength does; computing it once at creation would leave it at
     * its untalented value.
     */
    const before = warrior().stats.effective.attackPower;
    const after = warrior({ vitality: 5 }).stats.effective.attackPower;
    expect(after).toBeGreaterThan(before);
  });
});

describe('resource and ability effects', () => {
  it('raises the rage cap by Boundless Rage', () => {
    expect(warrior().resources.get('rage')?.maximum).toBe(100);
    expect(warrior({ boundless_rage: 3 }).resources.get('rage')?.maximum).toBe(130);
  });

  it('reduces an ability cost', () => {
    const cost = (c: ReturnType<typeof warrior>, id: string) => c.abilities.get(id)?.cost?.amount;
    expect(cost(warrior(), 'heroic_strike')).toBe(15);
    expect(cost(warrior({ improved_heroic_strike: 3 }), 'heroic_strike')).toBe(12);
    expect(cost(warrior({ improved_execute: 2 }), 'execute')).toBe(10);
  });

  it('reduces an ability cooldown', () => {
    expect(warrior().abilities.get('intercept')?.cooldownMs).toBe(30_000);
    expect(warrior({ improved_intercept: 2 }).abilities.get('intercept')?.cooldownMs).toBe(20_000);
  });

  it('never lets a cost go below zero', () => {
    const build = talentBuild('warrior', { improved_sunder_armor: 3 });
    const reduction = build.abilityCostReduction.get('sunder_armor_cast') ?? 0;
    const player = warrior({ improved_sunder_armor: 3 });
    const cost = player.abilities.get('sunder_armor_cast')?.cost?.amount ?? 0;
    expect(reduction).toBeGreaterThan(0);
    expect(cost).toBeGreaterThanOrEqual(0);
  });

  it('does not mutate the shared ability definitions', () => {
    /*
     * Ability definitions are module-level constants shared by every character
     * in every iteration of a batch. Editing one in place would leak a talent
     * into characters that never took it, and compound across iterations.
     */
    warrior({ improved_heroic_strike: 3 });
    expect(warrior().abilities.get('heroic_strike')?.cost?.amount).toBe(15);
  });
});

describe('unmodelled talents are reported rather than silently inert', () => {
  it('names the talent, its rank and the reason', () => {
    const build = talentBuild('warrior', { deflection: 5 });
    expect(build.unmodelled).toHaveLength(1);
    const [entry] = build.unmodelled;
    expect(entry.talentId).toBe('deflection');
    expect(entry.name).toBe('Deflection');
    expect(entry.rank).toBe(5);
    expect(entry.reason).toMatch(/parry/i);
    // The source's own words, so a person can see what it is supposed to do.
    expect(entry.text).toMatch(/Parry/);
  });

  it('leaves a talent that works out of the list', () => {
    const build = talentBuild('warrior', { cruelty: 5, deflection: 5 });
    expect(build.unmodelled.map((u) => u.talentId)).toEqual(['deflection']);
  });

  it('reports a talent with no captured value instead of treating it as zero', () => {
    // Bastion was removed from the live calculator, so it has no values.
    const build = talentBuild('warrior', { bastion: 3 });
    expect(build.unmodelled).toHaveLength(1);
    expect(build.stats).toEqual({});
  });

  it('contributes nothing at all for a class with no effect table', () => {
    const build = talentBuild('mage', { arcane_focus: 5 });
    expect(build.stats).toEqual({});
    expect(build.grantedAbilities.size).toBe(0);
    expect(build.unmodelled).toEqual([]);
  });

  it('ignores a talent with zero points', () => {
    expect(talentBuild('warrior', { deflection: 0 }).unmodelled).toEqual([]);
  });
});
