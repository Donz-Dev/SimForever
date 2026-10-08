import { describe, expect, it } from 'vitest';
import { resolveCast, toSeconds } from '../../src/engine';
import {
  ANGER_MANAGEMENT_INTERVAL_MS,
  ANGER_MANAGEMENT_MAX_START_OFFSET_MS,
  ANGER_MANAGEMENT_RAGE_PER_TICK,
} from '../../src/game/auras/warrior';
import { OFF_HAND_DAMAGE_MULTIPLIER } from '../../src/game/actors/weapons';
import { CLEAVE, WHIRLWIND_OFF_HAND_NAME } from '../../src/game/abilities/warrior';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { talentValue } from '../../src/game/talents/talentValues';
import { UNBRIDLED_WRATH_RAGE } from '../../src/game/reactions/warriorTalents';
import { createDefaultProfile } from '../../src/profiles';
import { characterAtCombatStart, runProfile, runProfileBatch, resourceFlowOf } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { legalise } from '../helpers/legalTalents';

/*
 * Three Fury mechanics, written out by hand from the ruleset owner's
 * instructions and cross-checked against the captured per-rank values.
 */

function profile(talents: Record<string, number> = {}, extra: Record<string, unknown> = {}) {
  const base = createDefaultProfile();
  return {
    ...base,
    character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
    equipment: startingEquipmentFor('warrior', 'dual_wield'),
    talents,
    simulation: { ...base.simulation, iterations: 60, seed: 19, durationSeconds: 60 },
    ...extra,
  } as never;
}

// ---------------------------------------------------------------------------
// Anger Management
// ---------------------------------------------------------------------------

describe('Anger Management', () => {
  it('is one rage every three seconds', () => {
    expect(ANGER_MANAGEMENT_RAGE_PER_TICK).toBe(1);
    expect(toSeconds(ANGER_MANAGEMENT_INTERVAL_MS)).toBe(3);
  });

  it('starts somewhere in the first three seconds, not at a fixed moment', () => {
    /*
     * A passive on its own timer did not start that timer when the pull did.
     * Every fight ticking first at exactly 3000ms would give an extra rage to
     * fights of one length and not another, and tighten the distribution
     * around a fiction.
     */
    expect(ANGER_MANAGEMENT_MAX_START_OFFSET_MS).toBe(3000);

    const firstTick = (seed: number) => {
      const result = runProfile(
        profile(legalise({ anger_management: 1 }), {
          simulation: { ...createDefaultProfile().simulation, seed, durationSeconds: 30 },
        }),
      );
      const tick = result.timeline.find(
        (event) => event.type === 'resource_gained' && event.source === 'anger_management',
      );
      return tick?.timestamp;
    };

    const firsts = [1, 2, 3, 4, 5, 6].map(firstTick);
    for (const at of firsts) {
      expect(at).toBeDefined();
      expect(at!).toBeGreaterThanOrEqual(1);
      expect(at!).toBeLessThanOrEqual(ANGER_MANAGEMENT_MAX_START_OFFSET_MS);
    }
    // Rolled, not fixed: six seeds must not all land on the same millisecond.
    expect(new Set(firsts).size).toBeGreaterThan(1);
  });

  it('delivers about twenty rage over a sixty second fight', () => {
    // 60 / 3 is twenty ticks of one rage, give or take where the first landed.
    const gained = resourceFlowOf(
      runProfileBatch(profile(legalise({ anger_management: 1 }))),
      'rage',
    ).gained;
    const anger = gained.find((row) => row.sourceId === 'anger_management');

    expect(anger).toBeDefined();
    expect(anger!.amount).toBeGreaterThan(18);
    expect(anger!.amount).toBeLessThanOrEqual(21);
  });

  it('grants nothing without the talent', () => {
    const gained = resourceFlowOf(runProfileBatch(profile()), 'rage').gained;
    expect(gained.some((row) => row.sourceId === 'anger_management')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dual Wield Specialization
// ---------------------------------------------------------------------------

describe('Dual Wield Specialization', () => {
  const offHand = (ranks: number) =>
    characterAtCombatStart(
      profile(ranks > 0 ? legalise({ dual_wield_specialization: ranks }) : {}),
    )!;

  it('takes off-hand damage from half to five eighths at 5/5', () => {
    /*
     * The ruleset owner's figure, and the captured rank values agree: +25% on
     * top of the base half, so 0.5 becomes 0.625.
     */
    expect(OFF_HAND_DAMAGE_MULTIPLIER).toBe(0.5);
    expect(offHand(0).weapons.offHand?.damageMultiplier).toBe(0.5);
    expect(offHand(5).weapons.offHand?.damageMultiplier).toBeCloseTo(0.625, 10);
  });

  it('raises off-hand rage generation by half at 5/5', () => {
    /*
     * READS `flat`, NOT `perDamage`. Forever's rage from damage dealt is a
     * flat `R x S` per swing rather than a rate on the damage, so the talent's
     * multiplier lands on the other field.
     *
     * HALF, NOT DOUBLE, SINCE CLIENT BUILD 1.60.1.70170. The tooltip read "+100%
     * off-hand Rage generation" and reads "+50%"; the values row went 20/40/60/
     * 80/100 to 10/20/30/40/50.
     *
     * THE PATCH NOTE SAYS THE CLAUSE WAS REMOVED AND THE CLIENT SAYS IT WAS
     * HALVED, and the client wins -- "no longer provides a 20/40/60/80/100%
     * increase" is about THAT increase. This assertion is the one that would
     * catch a future reading of the note as a removal.
     */
    const plain = offHand(0).weapons.offHand?.generates?.flat ?? 0;
    const talented = offHand(5).weapons.offHand?.generates?.flat ?? 0;
    expect(plain).toBeGreaterThan(0);
    expect(talented).toBeCloseTo(plain * 1.5, 10);

    // And nothing scales with damage on either.
    expect(offHand(5).weapons.offHand?.generates?.perDamage).toBeUndefined();
  });

  it('no longer gives the off hand any hit; Furious Precision does', () => {
    /*
     * THE CLAUSE MOVED RATHER THAN GOING AWAY. Client build 1.60.1.70170: "Dual
     * Wield Specialization no longer grants hit to your off-hand attacks", and
     * FURIOUS PRECISION one row above it grants 4/7/10 where this gave 2/4/6/8/10.
     *
     * BOTH HALVES ARE ASSERTED HERE because a test on one alone cannot tell "the
     * clause moved" from "the clause was deleted" -- and the per-slot mechanism
     * is the thing worth keeping covered: folding either into the character-wide
     * hit stat would hand the MAIN hand the points, which is the whole reason
     * `hitBonusBySlot` exists.
     */
    expect(offHand(5).hitBonusFor('offHand')).toBe(0);
    expect(offHand(5).hitBonusFor('mainHand')).toBe(0);

    const furious = characterAtCombatStart(profile(legalise({ furious_precision: 3 })))!;
    expect(furious.hitBonusFor('offHand')).toBe(10);
    expect(furious.hitBonusFor('mainHand')).toBe(0);
  });

  it('scales both clauses per rank, from captured values', () => {
    // [5,10] .. [25,50]. Written out by hand from the values file's own
    // numbers rather than computed from the rank.
    const build = (ranks: number) =>
      talentBuild('warrior', legalise({ dual_wield_specialization: ranks }));

    expect(build(1).offHandDamageMultiplier).toBeCloseTo(1.05, 10);
    expect(build(1).offHandResourceMultiplier).toBeCloseTo(1.1, 10);

    expect(build(3).offHandDamageMultiplier).toBeCloseTo(1.15, 10);
    expect(build(3).offHandResourceMultiplier).toBeCloseTo(1.3, 10);

    expect(build(5).offHandDamageMultiplier).toBeCloseTo(1.25, 10);
    expect(build(5).offHandResourceMultiplier).toBeCloseTo(1.5, 10);

    // No hit at any rank -- see the test above.
    expect(build(5).offHandHitBonus).toBe(0);
  });

  it('shows up as a lower off-hand miss chance in the fight, through Furious Precision', () => {
    /*
     * THE SUBJECT OF THIS TEST CHANGED TALENTS AND NOT MECHANISMS. The hit it was
     * measuring moved to Furious Precision at client build 1.60.1.70170, so it
     * reads that allocation instead -- and the thing it proves is the same one:
     * the per-slot bonus reaches the off-hand combat table in a real fight, which
     * is what a unit test on `hitBonusFor` cannot show.
     *
     * The GUI reads this same provider per hand, so a change here is a change on
     * the character sheet.
     */
    const missRate = (ranks: number) => {
      const rows = runProfileBatch(
        profile(ranks ? legalise({ furious_precision: ranks }) : {}),
      ).abilities;
      return rows.find((row) => row.abilityName === 'Off Hand Auto-Attack')!.avoidRate;
    };
    expect(missRate(3)).toBeLessThan(missRate(0) - 0.05);
  });

  it('is no longer reported as unmodelled', () => {
    const kinds = WARRIOR_TALENT_EFFECTS.dual_wield_specialization.map((e) => e.kind);
    expect(kinds).not.toContain('unmodelled');
    expect(kinds).toEqual(['offHandDamage', 'offHandResourceGeneration']);
    // The clause that left has a talent of its own, and it is not unmodelled
    // either.
    expect(WARRIOR_TALENT_EFFECTS.furious_precision.map((e) => e.kind)).toEqual(['offHandHit']);
  });
});

// ---------------------------------------------------------------------------
// Raging Blows
// ---------------------------------------------------------------------------

describe('Raging Blows', () => {
  /*
   * ----------------------------------------------------------------------------
   * THE OFF-HAND STRIKE IS NO LONGER THIS TALENT'S, which is why every test below
   * that used to pass `legalise({ raging_blows: 1 })` to get it now passes `{}`.
   *
   * Client build 1.60.1.70170: "Raging Blows no longer causes your Whirlwind to
   * strike with your offhand. Whirlwind will now always strike with both weapons
   * without requiring a talent point." So the mechanism is unchanged and its
   * trigger is gone -- the ability reads whether an off hand is EQUIPPED.
   *
   * WHICH IS WHY THE FIRST TEST HAD TO BE REPLACED RATHER THAN RETARGETED: it
   * asserted the strike was ABSENT without the talent, and that is now false by
   * design. What takes its place asserts the condition that is actually left, and
   * it needs a two-hander to show the negative case.
   * ----------------------------------------------------------------------------
   */
  it('gives Whirlwind a second strike with the off hand, with no talent spent', () => {
    const names = (talents: Record<string, number>) =>
      runProfileBatch(profile(talents)).abilities.map((row) => row.abilityName);

    expect(names({})).toContain(WHIRLWIND_OFF_HAND_NAME);
    expect(names(legalise({ raging_blows: 1 }))).toContain(WHIRLWIND_OFF_HAND_NAME);
  });

  it('lands the off-hand strike as often as the main-hand one', () => {
    // One cast, two strikes. Attempts must match, or the second strike is
    // being skipped on some casts.
    const rows = runProfileBatch(profile({})).abilities;
    const main = rows.find((row) => row.abilityName === 'Whirlwind')!;
    const off = rows.find((row) => row.abilityName === WHIRLWIND_OFF_HAND_NAME)!;
    expect(off.attempts).toBeCloseTo(main.attempts, 5);
  });

  it('carries the off-hand DAMAGE penalty', () => {
    /*
     * Half the main hand's average, untalented, because the penalty is the
     * off-hand weapon's own `damageMultiplier` -- the same one an auto attack
     * uses. Not exact: the two hands hold different weapons.
     */
    const rows = runProfileBatch(profile({})).abilities;
    const main = rows.find((row) => row.abilityName === 'Whirlwind')!;
    const off = rows.find((row) => row.abilityName === WHIRLWIND_OFF_HAND_NAME)!;
    expect(off.average).toBeLessThan(main.average);
    expect(off.average).toBeGreaterThan(main.average * 0.3);
  });

  it('does NOT carry the off-hand miss penalty', () => {
    /*
     * A special, not a swing. The dual-wield miss penalty lives only in the
     * `melee-auto` table, so the off-hand Whirlwind should be avoided at
     * roughly the rate the MAIN-HAND Whirlwind is -- and far less often than
     * an off-hand auto attack.
     */
    const rows = runProfileBatch(profile({})).abilities;
    const mainWhirl = rows.find((row) => row.abilityName === 'Whirlwind')!;
    const offWhirl = rows.find((row) => row.abilityName === WHIRLWIND_OFF_HAND_NAME)!;
    const offAuto = rows.find((row) => row.abilityName === 'Off Hand Auto-Attack')!;

    expect(offWhirl.avoidRate).toBeLessThan(offAuto.avoidRate - 0.1);
    expect(Math.abs(offWhirl.avoidRate - mainWhirl.avoidRate)).toBeLessThan(0.05);
  });

  it('benefits from Dual Wield Specialization, which it feeds off', () => {
    const average = (talents: Record<string, number>) => {
      const rows = runProfileBatch(profile(talents)).abilities;
      return rows.find((row) => row.abilityName === WHIRLWIND_OFF_HAND_NAME)!.average;
    };
    const plain = average({});
    const specced = average(legalise({ dual_wield_specialization: 5 }));
    // 0.5 to 0.625 is a quarter more per landed strike.
    expect(specced).toBeGreaterThan(plain * 1.15);
  });

  it('takes three rage off Cleave AND off Whirlwind', () => {
    /*
     * WHAT IS LEFT OF THE TALENT, AND IT GREW. Client build 1.60.1.70170:
     * "Raging Blows now reduces the Rage cost of your Cleave and Whirlwind
     * abilities by 3", where it was two rage off Cleave alone.
     *
     * It took over the job of IMPROVED CLEAVE, which the same patch deleted.
     *
     * Still single rank, so the three is hand-filled in the values file with a
     * note. Written out here from the tooltip rather than read back from either
     * the values file or the ability -- a test that asks the data what the data
     * says passes whatever the data says.
     */
    const build = talentBuild('warrior', legalise({ raging_blows: 1 }));
    expect(build.abilityCostReduction.get('cleave')).toBe(3);
    expect(build.abilityCostReduction.get('whirlwind')).toBe(3);
    expect(CLEAVE.cost?.amount).toBe(20);
  });

  it('reports nothing about itself as unmodelled any more', () => {
    const kinds = WARRIOR_TALENT_EFFECTS.raging_blows.map((effect) => effect.kind);
    expect(kinds).not.toContain('unmodelled');
    // Two costs rather than a flag and a cost: the flag's work is now the
    // ability's own.
    expect(kinds).toEqual(['abilityCost', 'abilityCost']);
  });
});

// ---------------------------------------------------------------------------
// Blood Craze and Enrage: the ruleset owner's item 4
// ---------------------------------------------------------------------------

describe('Blood Craze and Enrage stay tied to being attacked', () => {
  it('leaves Enrage inert when nothing attacks the player', () => {
    /*
     * ALREADY THE CASE, pinned rather than changed. Enrage is a reaction to
     * being hit, so a fight where the target stands still can never trigger
     * it -- which is exactly the ruleset owner's instruction to ignore it
     * unless the encounter is set up to take damage.
     */
    const result = runProfileBatch(profile(legalise({ enrage: 5 })));
    expect(result.buffUptime.some((row) => row.auraName.includes('Enrage'))).toBe(false);
  });

  it('brings Enrage to life when the target swings back', () => {
    const base = createDefaultProfile();
    const result = runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: 'one_hand_shield', stance: 'defensive' },
      equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
      talents: legalise({ enrage: 5 }),
      simulation: { ...base.simulation, iterations: 40, seed: 21, durationSeconds: 60 },
      encounter: { ...base.encounter, targetAttacks: true },
    } as never);

    expect(result.buffUptime.some((row) => row.auraName.includes('Enrage'))).toBe(true);
  });

  it('reports Blood Craze as fully modelled, with nothing left to caveat', () => {
    /*
     * ONE REACTION NOW, NOT TWO. The Bloodthirst trigger was removed at client
     * build 1.60.1.70170, and it was the clause that fired on the other side of
     * an attack -- so the talent went from a two-entry shape to a one-entry one
     * and from a Fury talent to a tank talent in a damage tree.
     */
    /*
     * IT CARRIED TWO DIFFERENT CAVEATS AND OUTLIVED BOTH.
     *
     * The first said the healing "is not observable: the character cannot drop
     * below one health" -- true until the encounter started killing people.
     * The second said its TICK CADENCE was a placeholder borrowed from
     * Classic, which the ruleset owner has now stated: every two seconds,
     * three ticks.
     *
     * Asserted as EMPTY rather than deleted, so a caveat cannot quietly come
     * back without a test failing. Its reaction is still checked above.
     */
    const reasons = WARRIOR_TALENT_EFFECTS.blood_craze.filter(
      (effect) => effect.kind === 'unmodelled',
    );
    expect(reasons).toEqual([]);
    expect(WARRIOR_TALENT_EFFECTS.blood_craze.map((e) => e.kind)).toEqual(['reaction']);
  });
});

// ---------------------------------------------------------------------------
// The 1.60.1.70170 Fury changes that are not Dual Wield Specialization
// ---------------------------------------------------------------------------

describe('Booming Voice took a rage cost off a positioning ruling', () => {
  /*
   * ----------------------------------------------------------------------------
   * THE TALENT WAS A PURE `positioning` RULING AND GAINED A LIVE CLAUSE, which is
   * the quietest kind of change CLAUDE.md records around `scope`: a ruling is
   * permanent by design, so a scoped talent is kept out of the live-gap list and
   * off the Talent panel's "not modelled" column. A second clause arriving on one
   * is a real effect landing in the one place nobody re-reads.
   *
   * "Increases the area of effect of your Shouts by 50% and reduces their Rage
   * cost by 25%" at 5/5, where it was radius and nothing else.
   * ----------------------------------------------------------------------------
   */
  it('reads the rage percentage at index 1, not the area of effect at index 0', () => {
    // [10, 5] .. [50, 25], area first. Written out from the tooltip.
    expect(talentValue('warrior', 'booming_voice', 1)).toEqual([10, 5]);
    expect(talentValue('warrior', 'booming_voice', 5)).toEqual([50, 25]);

    const cost = WARRIOR_TALENT_EFFECTS.booming_voice.find(
      (effect) => effect.kind === 'grantCastModifier',
    );
    expect(cost).toMatchObject({ property: 'costFraction', valueIndex: 1 });
  });

  it('is a PERCENTAGE, so it takes a quarter off a ten-rage shout rather than 25', () => {
    /*
     * `abilityCost` subtracts a FLAT amount -- right for Improved Thunder Clap's
     * two rage and wrong for a quarter of a ten-rage shout, where it would make
     * the ability free and then some. `grantCastModifier` is the percentage route.
     */
    const build = talentBuild('warrior', legalise({ booming_voice: 5 }));
    for (const id of ['battle_shout_cast', 'demoralizing_shout_cast']) {
      expect(build.abilityCostReduction.get(id), id).toBeUndefined();
    }

    const actor = characterAtCombatStart(profile(legalise({ booming_voice: 5 })))!;
    const shout = actor.abilities.get('battle_shout_cast')!;
    expect(shout.cost!.amount).toBe(10);
    expect(resolveCast(actor, shout).costAmount).toBeCloseTo(7.5, 6);
  });

  it('keeps its positioning ruling, which is the half that is still permanent', () => {
    const scoped = WARRIOR_TALENT_EFFECTS.booming_voice.filter(
      (effect) => effect.kind === 'unmodelled',
    );
    expect(scoped).toHaveLength(1);
    expect(scoped[0]).toMatchObject({ scope: 'positioning' });
  });
});

describe('Unbridled Wrath is one rage whatever is held', () => {
  it('no longer doubles for a two-hander', () => {
    /*
     * "Unbridled Wrath no longer grants twice as much Rage to two-handed
     * weapons", and the tooltip drops the sentence that said so. The values row
     * went from `[chance, 1, 2]` to `[chance, 1]` with it, which is why the
     * effect now names index 0 explicitly rather than relying on the default.
     */
    expect(talentValue('warrior', 'unbridled_wrath', 5)).toEqual([60, 1]);
    expect(UNBRIDLED_WRATH_RAGE).toBe(1);
    expect(WARRIOR_TALENT_EFFECTS.unbridled_wrath).toEqual([
      { kind: 'reaction', reactionId: 'unbridled_wrath', valueIndex: 0 },
    ]);
  });

  it('pays the same one rage to a two-hander as to a dual-wielder, in a real fight', () => {
    /*
     * ------------------------------------------------------------------------
     * THE MEASURED HALF, because the constant alone cannot show that the reaction
     * stopped READING the weapon. It used to look the swinging weapon up and
     * branch on `twoHanded`, so a test on the number would pass while the branch
     * still existed and paid two.
     *
     * ASSERTED AS A RATE PER PROC rather than a total: the two builds swing at
     * different speeds and land different numbers of uses, so only the amount per
     * proc is comparable.
     * ------------------------------------------------------------------------
     */
    const perProc = (style: 'two_hander' | 'dual_wield') => {
      const base = createDefaultProfile();
      const batch = runProfileBatch({
        ...base,
        character: {
          ...base.character,
          combatStyle: style,
          stance: style === 'two_hander' ? 'battle' : 'berserker',
        },
        equipment: startingEquipmentFor('warrior', style),
        talents: legalise({ unbridled_wrath: 5 }),
        simulation: { ...base.simulation, iterations: 60, seed: 19, durationSeconds: 60 },
      } as never);
      const row = resourceFlowOf(batch, 'rage').gained.find(
        (entry) => entry.sourceId === 'unbridled_wrath',
      );
      /*
       * `amount` IS NET OF THE CAP and a rage warrior caps often, so the per-proc
       * figure has to add `wasted` back -- otherwise this measures how full the
       * bar was rather than what a proc paid.
       */
      return { granted: (row?.amount ?? 0) + (row?.wasted ?? 0), count: row?.count ?? 0 };
    };

    const twoHand = perProc('two_hander');
    const dualWield = perProc('dual_wield');
    expect(twoHand.count).toBeGreaterThan(0);
    expect(dualWield.count).toBeGreaterThan(0);
    expect(twoHand.granted / twoHand.count).toBeCloseTo(1, 6);
    expect(dualWield.granted / dualWield.count).toBeCloseTo(1, 6);
  }, 20_000);
});
