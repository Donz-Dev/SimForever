import { describe, expect, it } from 'vitest';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import type { TalentEffects } from '../../src/game/talents/TalentEffect';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { armorReduction } from '../../src/engine';
import type { WeaponProfile } from '../../src/engine';

/*
 * ==============================================================================
 * TWO ENGINE GAPS CLOSED, AND THE REASONS THAT NAMED THEM.
 *
 * A REASON MATCHED BY WORDING IS A TEST. The idiom is
 * `grantCastModifier.test.ts`'s: a family of `unmodelled` claims expires
 * together, and matching the SENTENCE rather than the ids is what makes the
 * whole family findable the day the blocker clears. It has paid for itself six
 * times, and it failed to be applied at least four -- twice a talent was fully
 * working while printing a caveat saying it could not fire.
 *
 * THIS ONE COVERS EVERY CLASS DELIBERATELY. Armor penetration was blocked for
 * the Rogue's Hack and Slash and Serrated Blades AND for the Warrior's
 * Weaponmaster, and the Rogue's own reason said so -- "the same gap as the
 * Warrior Weaponmaster mace clause". A test scoped to one class would have let
 * the Warrior's copy of the claim survive the thing that cleared it, which is
 * the decay `rotationIds.test.ts` was caught in when it checked four of twenty-
 * six lists.
 * ==============================================================================
 */

const TABLES: Readonly<Record<string, Readonly<Record<string, TalentEffects>>>> = {
  warrior: WARRIOR_TALENT_EFFECTS,
  paladin: PALADIN_TALENT_EFFECTS,
  hunter: HUNTER_TALENT_EFFECTS,
  rogue: ROGUE_TALENT_EFFECTS,
  priest: PRIEST_TALENT_EFFECTS,
  shaman: SHAMAN_TALENT_EFFECTS,
  mage: MAGE_TALENT_EFFECTS,
  warlock: WARLOCK_TALENT_EFFECTS,
  druid: DRUID_TALENT_EFFECTS,
};

function everyReason(): { id: string; reason: string }[] {
  const out: { id: string; reason: string }[] = [];
  for (const [className, table] of Object.entries(TABLES)) {
    for (const [talentId, effects] of Object.entries(table)) {
      for (const effect of effects) {
        if (effect.kind !== 'unmodelled') continue;
        out.push({ id: `${className}.${talentId}`, reason: effect.reason });
      }
    }
  }
  return out;
}

const matching = (pattern: RegExp) =>
  everyReason()
    .filter((entry) => pattern.test(entry.reason))
    .map((entry) => `${entry.id}: ${entry.reason}`);

describe('the armor-penetration claim has expired everywhere', () => {
  /*
   * The exact wordings the three talents carried. Kept as separate alternatives
   * rather than one loose pattern, because a loose one would sweep in a reason
   * that mentions armor for some other purpose -- Toughness, for one.
   */
  it('has no talent still saying the damage pipeline cannot express it', () => {
    expect(
      matching(
        /damage pipeline (?:cannot express|has no form)|no form in the damage pipeline|which the damage pipeline/i,
      ),
    ).toEqual([]);
  });

  it('has no talent still calling armor ignore "not modelled"', () => {
    expect(matching(/ignores? a percentage of the target[' ]?s? ?armor, which/i)).toEqual([]);
  });

  it('really is a stat now, and it really reaches the pipeline', () => {
    const mace = {
      mainHand: {
        name: 'Test mace',
        baseDamage: 100,
        swingTimerMs: 2000,
        weaponType: 'mace',
        skill: 300,
      } as WeaponProfile,
    };
    // Both callers, so neither can be quietly dropped by an edit to the other.
    expect(talentBuild('rogue', { hack_and_slash: 5 }, mace).stats.armorPenetration).toBe(15);
    expect(talentBuild('warrior', { weaponmaster: 5 }, mace).stats.armorPenetration).toBe(15);
  });

  /*
   * AND THE ARITHMETIC IT IS WORTH, written out by hand.
   *
   *   armor constant at level 63 = 400 + 85 x 63 = 5755
   *   3731 / (5755 + 3731)                       = 39.33% removed
   *   15% off the armor leaves 3171.35
   *   3171.35 / (5755 + 3171.35)                 = 35.53% removed
   *
   * So fifteen points of penetration is worth 3.80 points of damage. Taking
   * the 15% off the REDUCTION instead gives 33.43% and would make it worth
   * 5.90 -- over half as much again, and a number nothing downstream would
   * have questioned.
   */
  it('takes its percentage off the ARMOR and not off the reduction', () => {
    const BOSS_ARMOR = 3731;
    const full = armorReduction(BOSS_ARMOR, 63);
    const penetrated = armorReduction(BOSS_ARMOR * 0.85, 63);

    expect(full).toBeCloseTo(0.3933, 4);
    expect(penetrated).toBeCloseTo(0.3553, 4);
    expect((full - penetrated) * 100).toBeCloseTo(3.8, 1);

    // The reading that was NOT taken, so the difference between them is pinned.
    const wrong = full * 0.85;
    expect((full - wrong) * 100).toBeCloseTo(5.9, 1);
    expect(full - penetrated).toBeLessThan(full - wrong);
  });
});

describe('the attacker-side avoidance claim has expired too', () => {
  it('has no talent still saying an attacker cannot lower dodge or parry', () => {
    expect(
      matching(/nothing lets an attacker lower them|attack tables read the DEFENDER for both/i),
    ).toEqual([]);
  });

  it('really is a stat, and the Rogue is its one caller today', () => {
    expect(talentBuild('rogue', { weapon_expertise: 2 }).stats.dodgeParryReduction).toBe(2);
  });
});
