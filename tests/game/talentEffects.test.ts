import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { talentsForClass } from '../../src/game/talents/talentData';
import { legalise } from '../helpers/legalTalents';
import { talentNumber, talentValue } from '../../src/game/talents/talentValues';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';

const warrior = (talents: Record<string, number> = {}) =>
  createPlayer({
    race: 'human',
    characterClass: 'warrior',
    combatStyle: 'dual_wield',
    talents: legalise(talents),
  });

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
    // The Priest, which has none. This named the Mage, then the Paladin --
    // a class-not-yet-built fixture has to move as classes are built, and it
    // failing is the signal that one arrived.
    expect(talentNumber('priest', 'unbreakable_will', 1)).toBeUndefined();
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

  /*
   * VITALITY IS GONE, and with it the only Warrior talent that used
   * `percentAdd`.
   *
   * Two tests lived here: one asserting Vitality raised stamina and strength by
   * a percentage, and one asserting attack power RE-DERIVED from the strength
   * it added -- the reason percentage talents stay modifiers instead of being
   * folded into a flat number at creation.
   *
   * Forever's tier 20 Protection talent is Bastion, not Vitality; the
   * repository had Vitality because a hand edit put the wrong talent in that
   * slot. No Warrior talent scales a stat by a percentage any more, so there is
   * nothing here to point these at.
   *
   * The mechanism itself is not untested: `StatBlock` applies percentAdd and
   * the derivation function re-runs on every read, both covered in
   * tests/engine/stats.test.ts. What is lost is the coverage of a talent using
   * it, and that returns the moment one does.
   */

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
    // Iron Will reduces stun and fear duration, and nothing stuns the player.
    const build = talentBuild('warrior', { iron_will: 5 });
    expect(build.unmodelled).toHaveLength(1);
    const [entry] = build.unmodelled;
    expect(entry.talentId).toBe('iron_will');
    expect(entry.name).toBe('Iron Will');
    expect(entry.rank).toBe(5);
    expect(entry.reason).toMatch(/stun/i);
    // The source's own words, with the rank's number filled in, so a person can
    // see what it is supposed to do.
    expect(entry.text).toMatch(/15%/);
  });

  it('leaves a talent that works out of the list', () => {
    const build = talentBuild('warrior', { cruelty: 5, iron_will: 5 });
    expect(build.unmodelled.map((u) => u.talentId)).toEqual(['iron_will']);
  });

  it('reports a conditional talent that does not apply, rather than silently dropping it', () => {
    /*
     * Two-Handed Weapon Specialization with no two-hander. Not an error and not
     * a permanent gap -- equipping the right weapon makes it work -- so it has
     * to be visible rather than silent.
     */
    const build = talentBuild('warrior', { two_handed_weapon_specialization: 3 }, {});
    expect(build.damageMultiplier).toBe(1);
    expect(build.unmodelled).toHaveLength(1);
    expect(build.unmodelled[0].reason).toMatch(/weapon/i);
  });

  it('contributes nothing at all for an allocation that spent nothing', () => {
    /*
     * THIS USED TO NAME A CLASS WITH NO EFFECT TABLE -- the Mage, then the
     * Warlock, then the Priest. Every class has one now, so there is no such
     * class to name and the premise is simply gone.
     *
     * What it was really asserting survives: a build that spent no points
     * contributes nothing, grants nothing, and reports nothing as unmodelled.
     * That is the invariant, and it never depended on an unfinished class.
     */
    const build = talentBuild('priest', {});
    expect(build.stats).toEqual({});
    expect(build.grantedAbilities.size).toBe(0);
    expect(build.unmodelled).toEqual([]);
  });

  it('ignores a talent with zero points', () => {
    expect(talentBuild('warrior', { deflection: 0 }).unmodelled).toEqual([]);
  });
});
