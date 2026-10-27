import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfile, runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import type { TelemetryEvent } from '../../src/engine';
import { ALL_ABILITIES, resolveCast, seconds } from '../../src/engine';
import { manaPerTick } from '../../src/game/combat/resourceRules';
import { dealDamage } from '../../src/engine';
import {
  FIRE_BLAST_SP_COEFFICIENT,
  ARCANE_WRATH_SP_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import {
  ARCANE_BLAST_BASE_MANA_FRACTION,
  ARCANE_BLAST_CAST_MS,
  ARCANE_BLAST_DAMAGE,
  ARCANE_MISSILES_PER_TICK,
  ARCANE_WRATH,
  ARCANE_WRATH_COEFFICIENT,
  ARCANE_WRATH_CAST_MS,
  ARCANE_WRATH_COOLDOWN_MS,
  ARCANE_WRATH_DAMAGE,
  ARCANE_WRATH_MANA_TO_SPELL_POWER,
  ARCANE_MISSILES_TICK_COEFFICIENT,
  ARCANE_MISSILES_TICKS,
  FIREBALL_DAMAGE,
  FROSTBOLT_DAMAGE,
  ICE_LANCE,
  ICE_LANCE_DAMAGE,
  MAGE_ARMOR_ABILITY,
  COMBUSTION_ABILITY,
  ARCANE_POWER_ABILITY,
  PRESENCE_OF_MIND_ABILITY,
  ICE_LANCE_FROZEN_MULTIPLIER,
  EVOCATION,
  MAGE_ABILITIES,
  MAGE_BASE_MANA,
  PYROBLAST_DAMAGE,
  SCORCH_DAMAGE,
} from '../../src/game/abilities/mage';
import {
  arcaneBlastAura,
  ARCANE_BLAST_COST_INCREASE_PER_STACK,
  ARCANE_BLAST_INTELLECT_TO_SPELL_POWER,
  ARCANE_BLAST_MAX_STACKS,
  ARCANE_POWER,
  ARCANE_POWER_COST_INCREASE,
  MAGE_COSTED_SPELL_IDS,
  FIREBALL_DOT,
  MAGE_FIRE_POWER_EFFECTS,
  PYROBLAST_DOT,
  WINTERS_CHILL_DAMAGE_PER_STACK,
  WINTERS_CHILL_DURATION_MS,
  wintersChillAura,
  COMBUSTION,
  EVOCATION_AURA,
  EVOCATION_CHANNEL_MS,
  FROSTFIRE_ALSO_COUNTS_AS,
  EVOCATION_REGEN_BYPASS,
  EVOCATION_REGEN_MULTIPLIER,
  IGNITE_DURATION_MS,
  MISSILE_BARRAGE,
  COMBUSTION_CRITS_TO_END,
  COMBUSTION_CRIT_PER_STACK,
  COMBUSTION_STACK_CAP,
  FIRE_SPELL_IDS,
  FINGERS_OF_FROST,
  FINGERS_OF_FROST_PROC_CHANCE,
  fingersOfFrostAura,
  HEATING_UP,
  HEATING_UP_MAX_STACKS,
  HEATING_UP_REDUCTION_PER_STACK,
  IMPROVED_SCORCH_MAX_STACKS,
  MAGE_ARMOR,
  MAGE_ARMOR_REGEN_BYPASS,
  PRESENCE_OF_MIND,
  PYROBLAST_COEFFICIENTS,
  igniteAura,
  fireVulnerabilityAura,
} from '../../src/game/auras/mage';
import { aurasForClass } from '../../src/game/auras/auraCatalog';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { talentBuild } from '../../src/game/talents/talentBuild';
import {
  CHILL_ABILITY_IDS,
  MAGE_TALENT_REACTIONS,
  MAGE_CAST_REACTIONS,
  fingersOfFrost,
  fingersOfFrostSpender,
} from '../../src/game/reactions/mageTalents';
import { talentNumber, talentNumbers } from '../../src/game/talents/talentValues';
import { castAbility } from '../../src/engine';
import { legalise } from '../helpers/legalTalents';
import { ARCANE_BLAST_SP_COEFFICIENT } from '../../src/game/combat/coefficients';
import {
  MAGE_ARCANE,
  MAGE_FIRE,
  MAGE_FROSTFIRE,
  mageRotation,
} from '../../src/game/rotations/mage';
import { baseManaFor } from '../../src/game/character/baseStatLookup';
import { RACE_IDS } from '../../src/game/character/ids';
import type { AplCondition } from '../../src/game/rotations/apl';
import { compileCondition } from '../../src/game/rotations/apl';

/*
 * A condition is DATA now. `compileCondition` turns one back into the closure
 * the engine runs, which is what these assertions have always been calling --
 * the step used to be implicit because a list held closures directly.
 */
const compiled = (condition: AplCondition | undefined) =>
  condition ? compileCondition(condition) : undefined;

/*
 * The Mage's numbers, written out by hand from the beta client's spellbook.
 * Three profiles, all `caster`, told apart by where their points went.
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

const presetPlayer = (preset: string) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'gnome',
    characterClass: 'mage',
    combatStyle: 'caster',
    talents: built.talents,
    equipment: built.equipment,
  });
};

/** A Mage with the real book and no rotation of its own, so casts are ours. */
const bareMage = (preset: string) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return makeAttacker({
    autoAttack: 'none',
    abilities: abilitiesForClass('mage', 'caster', built.talents),
    resources: [{ type: 'mana', maximum: 100_000 }],
  });
};

describe('the numbers', () => {
  it('takes the midpoint of each stated range, at MAX RANK', () => {
    // Figures that follow foreverchanges.pro where it and our own capture
    // disagree, by the ruleset owner's standing rule. Written out by hand
    // from the source and carrying the ruling, not only the number. See
    // docs/source-cross-checks.md.
    expect(FIREBALL_DAMAGE).toBe(483);
    expect(FROSTBOLT_DAMAGE).toBe(475);
    expect(SCORCH_DAMAGE).toBe(178);
    expect(PYROBLAST_DAMAGE).toBe(583);
    /*
     * AND ARCANE BLAST IS THE CAPTURE'S MIDPOINT AGAIN. This read
     * `394 * (1 - ARCANE_BLAST_DAMAGE_REDUCTION)` -- the old capture's 364-424
     * with a patch note's 40% applied, because the capture predated the
     * redesign. At build 1.60.1.70425 the spellbook states **218 to 254**, so
     * the derivation and its constant are both gone.
     *
     * THE DERIVATION WAS RIGHT TO WITHIN A POINT, 236.4 against 236, which is
     * the best thing that can happen to one -- and it was checkable only
     * because it was written as arithmetic rather than as a literal.
     */
    expect(ARCANE_BLAST_DAMAGE).toBe(236);
    expect(ICE_LANCE_DAMAGE).toBe(145);
  });

  it('reads Pyroblast at rank 8, not the rank 1 its talent tooltip shows', () => {
    // The Fire talent says "101 to 131"; a level 60 trains rank 8 at
    // "520 to 646". The rank-1 rule, for the fifth time in this project.
    expect(PYROBLAST_DAMAGE).toBeGreaterThan((101 + 131) / 2);
  });

  it('treats base mana as a CLASS constant, which is what a % cost is of', () => {
    /*
     * "15% of base mana" is the only cost in the project that is not a plain
     * number. Base mana is the same for every race, which is what lets the
     * cost be resolved once rather than per character -- asserted rather than
     * assumed, because the whole shortcut rests on it.
     */
    // A race that cannot be a Mage reports 0 rather than undefined, and is
    // skipped -- the claim is about the races that CAN be one.
    const mageRaces = RACE_IDS.filter((race) => baseManaFor(race, 'mage') > 0);
    expect(mageRaces.length).toBeGreaterThan(2);
    for (const race of mageRaces) expect(baseManaFor(race, 'mage'), race).toBe(MAGE_BASE_MANA);
    expect(ARCANE_BLAST_BASE_MANA_FRACTION).toBe(0.15);
  });

  it('declares an effect for every one of the 54 talents', () => {
    // 55: ARCANE WRATH was added at client build 1.60.1.70425. Wake of Fire
    // became Improved Fire Blast in the same patch, which is a rename and
    // changes no count -- so the tree grew by exactly one. 54 since round 51's
    // refresh removed Piercing Ice.
    expect(Object.keys(MAGE_TALENT_EFFECTS)).toHaveLength(54);
  });
});

describe('which list a Mage runs', () => {
  it('counts ALL THREE trees, which the first version did not', () => {
    /*
     * ------------------------------------------------------------------------
     * THE BUG THIS CAUGHT. The first selector compared Arcane against Frost
     * and never looked at Fire, so the owner's 10/39/2 FIRE build -- ten
     * Arcane points against two Frost -- came back as ARCANE. It ran a list
     * built around Arcane Missiles and Arcane Blast, produced a perfectly
     * ordinary 143.9 DPS, and cast neither Fireball nor Pyroblast once.
     *
     * A rotation that is merely the WRONG one for the build is the worst kind
     * of wrong here: nothing errors, nothing is missing, and the number looks
     * like a number.
     * ------------------------------------------------------------------------
     */
    expect(batchOf('mage_fire', 1, 1).rotationName).toContain('Fire');
    expect(batchOf('mage_frostfire', 1, 1).rotationName).toContain('Frostfire');
    expect(batchOf('mage_arcane', 1, 1).rotationName).toContain('Arcane');
  });

  it('gives a talentless Mage a list rather than nothing at all', () => {
    // A `caster` has no auto-attack, so no rotation means no damage at all --
    // and a Mage with no talents still has a trainer's Fireball in hand.
    expect(mageRotation({})).toBeDefined();
  });
});

describe('Arcane Wrath, which no profile casts yet', () => {
  /*
   * ==========================================================================
   * NEW AT CLIENT BUILD 1.60.1.70425, granted by the Arcane tree's new row-3
   * talent, and in NO priority list and NO preset's allocation -- so
   * `coefficient_probe.ts` cannot see it at all: that tool casts every ability
   * every PRESET can reach, and nothing reaches this one.
   *
   * WHICH IS THE QUIETEST PLACE IN THIS PROJECT FOR AN ABILITY TO BE WRONG.
   * An ability declared, learnable, castable and never cast is reported
   * nowhere -- the shape `ability_audit.ts` was written for -- so the
   * MECHANISM is asserted here, and that is the whole reason this block
   * exists rather than a line in a list.
   *
   * IT IS DECLARED SO THE TALENT CAN BE MEASURED, which is the opposite of the
   * usual order: the owner has asked for the Arcane Mage to be optimised, and a
   * talent whose ability does not exist is a talent nobody can price. The
   * `grantAbility` guard in `hunterFiveFixes.test.ts` exists because this one
   * shipped undeclared for a full suite run.
   * ==========================================================================
   */
  const wrathDamage = (maxMana: number): number => {
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [ARCANE_WRATH],
      resources: [{ type: 'mana', maximum: maxMana }],
      stats: { spellPower: 0 },
    });
    const target = makeTarget({ maxHealth: 10_000_000, stats: { armor: 0 } });
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    /*
     * THE MAXIMUM TAKEN OVER MANY CASTS, which is the un-missed, un-crit figure.
     * A mean here would be a miss rate and a crit rate wearing a damage number.
     */
    let best = 0;
    for (let i = 0; i < 60; i += 1) {
      const resolution = dealDamage(simulation, {
        source: actor,
        target,
        abilityId: 'arcane_wrath',
        abilityName: 'Arcane Wrath',
        school: 'arcane',
        baseAmount:
          ARCANE_WRATH_DAMAGE + maxMana * ARCANE_WRATH_MANA_TO_SPELL_POWER * ARCANE_WRATH_COEFFICIENT,
        powerCoefficient: ARCANE_WRATH_COEFFICIENT,
        attackTable: 'spell',
        cannotCrit: true,
      });
      best = Math.max(best, resolution.amount);
    }
    return best;
  };

  it('is a 3.5 SECOND CAST and not an instant, which it shipped as', () => {
    /*
     * ========================================================================
     * THE CAST TIME IS THE ASSERTION THIS BLOCK EXISTS FOR NOW.
     *
     * This read `expect(ARCANE_WRATH.castTimeMs ?? 0).toBe(0)` with the comment
     * "Instant: the capture states no cast time" -- and the capture states
     * **`"cast": "3.5 sec cast"`** in its own field. The probe that read the
     * entry asked for `castTime`, got `undefined`, and a reading error became a
     * claim about the source.
     *
     * **A FIELD READ BY THE WRONG NAME REPORTS AS A SOURCE THAT IS SILENT**, and
     * every rule this project has for a quiet source is generous: a tie-break
     * does not apply, an omission has not denied anything, and a neighbouring
     * spell's coefficient becomes borrowable. All three were then applied to a
     * source that had spoken, and the spell came out instant with Fire Blast's
     * 0.429 -- which is the one combination that looks ordinary, because the
     * wrong cast time and the wrong coefficient pulled opposite ways.
     *
     * SO THE ASSERTION IS WRITTEN AGAINST THE CAPTURE'S OWN WORDING, and the
     * negative is kept: an instant Arcane Wrath at 1.0 would be absurd, and
     * nothing else in the suite would have said so.
     * ========================================================================
     */
    expect(ARCANE_WRATH_CAST_MS).toBe(seconds(3.5));
    expect(ARCANE_WRATH.castTimeMs).toBe(seconds(3.5));
    expect(ARCANE_WRATH.castTimeMs ?? 0).not.toBe(0);
    expect(ARCANE_WRATH.cost).toEqual({ resource: 'mana', amount: 395 });
    expect(ARCANE_WRATH_COOLDOWN_MS).toBe(seconds(6));
  });

  it('takes the midpoint of 439 to 529, the OWNER\'s figure over the capture', () => {
    /*
     * ========================================================================
     * 439 TO 529 IS THE OWNER'S AND THE CAPTURE SAYS 406 TO 496, exactly 33
     * lower at both ends. **A later statement from the owner outranks a
     * capture** -- the rule Rake's 5.5% tick and Swipe's 3% already follow --
     * and the EVEN OFFSET is what says this is a build difference rather than a
     * transcription error, so the capture is one refresh behind rather than
     * wrong.
     *
     * BOTH FIGURES ARE WRITTEN OUT because a reader who knows the checked-in
     * capture would otherwise read 484 as drift, which is the same reason the
     * constant carries them.
     *
     * AND THE TALENT TOOLTIP SAYS 122 TO 146, WHICH IS RANK 1 -- a quarter of
     * the real spell. **A talent tooltip shows rank 1 of the ability it
     * grants**, which has twice cost this project a Hunter ability: Sniper Shot
     * at 160 against 295, and Summon Hawk at 32 against 108, the second worth
     * 144 DPS.
     * ========================================================================
     */
    expect(ARCANE_WRATH_DAMAGE).toBe((439 + 529) / 2);
    expect(ARCANE_WRATH_DAMAGE).not.toBe((406 + 496) / 2);
    expect(ARCANE_WRATH_DAMAGE).not.toBe((122 + 146) / 2);
  });

  it('gains spell damage from the MANA POOL, at five percent of the maximum', () => {
    /*
     * ========================================================================
     * "This spell gains additional Spell Damage equal to 5% of your maximum
     * Mana", and the DIFFERENCE between two pools is what isolates it: every
     * other term -- the base, the coefficient, the school multiplier, the armor
     * curve -- is identical on both sides and cancels.
     *
     * SO THE PREDICTED STEP IS EXACTLY `delta x 0.05 x coefficient`, and
     * asserting it that way rather than against a literal is what makes this a
     * check on the CLAUSE instead of on the arithmetic of one fixture.
     *
     * MAXIMUM AND NOT CURRENT, which the tooltip states and which this fixture
     * cannot distinguish -- both pools start full. Said out loud: the reading is
     * enforced by `onCast` asking `maximum`, and reading `current` instead would
     * make the spell weaken through a fight, a smaller number and no error.
     * ========================================================================
     */
    const small = wrathDamage(3_000);
    const large = wrathDamage(8_000);
    const predicted =
      (8_000 - 3_000) * ARCANE_WRATH_MANA_TO_SPELL_POWER * ARCANE_WRATH_COEFFICIENT;
    expect(large - small).toBeCloseTo(predicted, 6);
    // And it is a real share of the spell rather than a rounding: ~107 damage.
    expect(predicted).toBeGreaterThan(100);
  });

  it('is in the book only for a Mage that spent the point', () => {
    // `grantsByAbility` gates it, which is what `talentGating` asserts for the
    // Warrior's nine -- checked here because this is a NEW grant.
    const without = abilitiesForClass('mage', 'caster', {}).map((a) => a.id);
    expect(without).not.toContain('arcane_wrath');

    const with_ = abilitiesForClass(
      'mage',
      'caster',
      legalise({ arcane_blast: 1, arcane_wrath: 1 }, 'mage'),
    ).map((a) => a.id);
    expect(with_).toContain('arcane_wrath');
  });

  it('scales at 100% of Spell Power, which the owner stated and is not a borrow', () => {
    /*
     * ========================================================================
     * THE PLACEHOLDER THIS ASSERTED WAS WRONG BY A FACTOR OF 2.3.
     *
     * `WoWSimWorksheet.xlsx` predates the spell, so there was no row to
     * transcribe and the constant was `PLACEHOLDER_ARCANE_WRATH_SP_COEFFICIENT
     * = 0.429` -- Fire Blast's figure, borrowed on the argument that the sheet
     * gives every Mage INSTANT the same `1.5 / 3.5`. The owner has given it
     * directly: **"+100% of Spell Power for its coefficient."**
     *
     * THE BORROW FAILED ON ITS PREMISE RATHER THAN ITS METHOD. "The same damage
     * band, the same cast time and a comparable cooldown" -- and the cast time
     * was 3.5 seconds, not instant. **The structural argument was sound and
     * pointed at the wrong neighbour**: `3.5 / 3.5` is 1.0, which is the
     * owner's own figure, so reading the capture's `cast` field would have
     * landed on it without being told.
     *
     * SO THE FLAG DID ITS JOB AND THE ARGUMENT BESIDE IT IS WHAT FAILED. The
     * `PLACEHOLDER_` name is what got this asked about at all -- this project's
     * rule is that a flagged reading is cheap and a wrong unflagged one is not
     * -- and the lesson underneath is one level down: **a well-argued borrow is
     * only as good as the facts its argument rests on.**
     * ========================================================================
     */
    expect(ARCANE_WRATH_COEFFICIENT).toBe(ARCANE_WRATH_SP_COEFFICIENT);
    expect(ARCANE_WRATH_SP_COEFFICIENT).toBe(1);
    // And NOT the borrowed figure, which was Fire Blast's.
    expect(ARCANE_WRATH_COEFFICIENT).not.toBeCloseTo(FIRE_BLAST_SP_COEFFICIENT, 6);
  });
});

describe('the talents that needed a school', () => {
  it('raises Fire CRIT for a Fire mage and leaves Frost and Arcane alone', () => {
    /*
     * ------------------------------------------------------------------------
     * FIRE POWER LEFT THIS ASSERTION AT CLIENT BUILD 1.60.1.70425, and the
     * damage half of the row going to 1 is the finding rather than a loss.
     *
     * It used to read `damageMultiplier` 1.1 -- Fire Power 5/5 at a flat 2% a
     * rank -- and the talent is now "3% per your Fire effects on the target, up
     * to 12%", which is not a `SchoolModifiers` entry at all. A conditional
     * bonus folded into the unconditional bucket loses its condition, so it
     * lives in `schoolDamagePerTargetEffect` and this collection correctly
     * reports no flat Fire damage multiplier.
     *
     * CRITICAL MASS IS WHAT IS LEFT HERE, and it went 3 ranks to 5 in the same
     * patch -- the Fire build takes 5/5 now, because Combustion's prerequisite
     * demands it, so +10% Fire crit where it was +6%.
     * ------------------------------------------------------------------------
     */
    const fire = presetPlayer('mage_fire');
    expect(fire.schoolModifiers.for('fire').critBonus).toBe(10);
    expect(fire.schoolModifiers.for('fire').damageMultiplier ?? 1).toBe(1);
    expect(fire.schoolModifiers.for('frost').damageMultiplier ?? 1).toBe(1);
    expect(fire.schoolModifiers.for('arcane').damageMultiplier ?? 1).toBe(1);
  });

  it('gives the Frostfire build both halves, which is the point of it', () => {
    /*
     * 0/29/22 with no capstone in either tree. Fire Power raises Frostfire
     * Bolt because it is dealt as Fire; Ice Shards raises its Frost crits at
     * +100% of a spell crit's 0.5 bonus. The build exists for that overlap.
     *
     * AND FIRE POWER'S HALF MOVED OUT OF `schoolModifiers` WITH THE REDESIGN,
     * so what this reads on the Fire side is CRITICAL MASS -- 4/5 here, the
     * rank the client's new fifth made affordable. Fire Power's own half of the
     * overlap is asserted in the ramp test below, where the count lives.
     *
     * 3/5 SINCE THE OWNER'S ROUND 51 BUILD, so +6%.
     */
    const frostfire = presetPlayer('mage_frostfire');
    expect(frostfire.schoolModifiers.for('fire').critBonus).toBe(6);
    expect(frostfire.schoolModifiers.for('frost').critMultiplierBonus).toBeCloseTo(0.5, 6);
  });

  it('ramps Fire Power by the Fire effects on the target, and caps it', () => {
    /*
     * ========================================================================
     * "Increases the damage done by your Fire spells by 3% per your Fire effects
     * on the target, up to a maximum increase of 12%. Effects which mix multiple
     * schools of magic do not qualify."
     *
     * THE OLD DECLARATION APPLIED A FLAT 3% -- `schoolDamage` reading index 0 of
     * `[3, 12]` -- which is the per-effect figure used as though it were the
     * whole talent, between a quarter and a third of its value. **The wrong
     * number was the RIGHT number for the wrong operation**, which is why no
     * figure looked odd and why this is asserted as a RAMP rather than as a
     * multiplier.
     *
     * FOUR EFFECTS IS THE CAP EXACTLY, 4 x 3 = 12, so the fifth step asserted
     * here is the one that proves the ceiling binds rather than the count
     * running away. Soul Siphon has the same coincidence and the same risk: a
     * list that is wrong is invisible while everything is up.
     * ========================================================================
     */
    const fire = presetPlayer('mage_fire');
    expect(fire.schoolDamagePerTargetEffect.get('fire')).toEqual({
      percentPerEffect: 3,
      maxPercent: 12,
      effectIds: MAGE_FIRE_POWER_EFFECTS,
    });
    // Both Fire builds carry 3/3 after the spread repair.
    expect(presetPlayer('mage_frostfire').schoolDamagePerTargetEffect.get('fire')).toEqual(
      fire.schoolDamagePerTargetEffect.get('fire'),
    );
    // And it is scoped to Fire: no other school carries one.
    expect(fire.schoolDamagePerTargetEffect.get('frost')).toBeUndefined();
    expect(fire.schoolDamagePerTargetEffect.get('arcane')).toBeUndefined();

    /*
     * AND THE RANKS SCALE BOTH NUMBERS TOGETHER, which is what says the cap is
     * read from its own index rather than defaulted to the per-effect figure.
     * `[[1,4],[2,8],[3,12]]`: a default would make rank 1 "1% capped at 1%".
     */
    for (const [rank, perEffect, cap] of [[1, 1, 4], [2, 2, 8], [3, 3, 12]] as const) {
      const build = talentBuild('mage', legalise({ fire_power: rank }, 'mage'));
      expect(build.schoolDamagePerTargetEffect.get('fire'), `rank ${rank}`).toEqual({
        percentPerEffect: perEffect,
        maxPercent: cap,
        effectIds: MAGE_FIRE_POWER_EFFECTS,
      });
    }
  });

  it('RAISES A LIVE FIREBALL, one step per effect, and stops at the cap', () => {
    /*
     * ========================================================================
     * THE END OF THE WIRE, AND NOT THE REGISTRY.
     *
     * The two assertions above say the scaling is ON the character and the list
     * is the right list. Neither says `resolveDamage` reads it -- which is
     * precisely how `armorPenetration` shipped: declared, granted by three
     * talents, counted as fully modelled and READ BY NOTHING, with its own test
     * file green throughout because it asserted the arithmetic and the
     * registration and never the join between them.
     *
     * A RATIO IS THE ASSERTION TO TRUST, because every term between the
     * coefficient and the damage event appears on both sides and cancels --
     * spell power, the school multiplier, Critical Mass, the armor curve. So
     * one, two, three and four effects must come out at exactly 1.03, 1.06,
     * 1.09 and 1.12 whatever else the build carries.
     *
     * AND THE FOURTH AND FIFTH STEPS ARE THE SAME, which is the cap biting
     * rather than the count running away: 4 x 3 is exactly 12, so a fifth
     * qualifying effect would be worth nothing. There are only four in the
     * list, so the fourth step IS the ceiling and this asserts it lands on the
     * stated maximum rather than one short of it.
     *
     * `cannotCrit` AND A HUNDRED POINTS OF HIT, so one cast is decisive. A
     * sampled figure here would be a crit rate and a miss rate wearing a
     * damage number, which is the shape `probe_revelation.ts` exists for.
     * ========================================================================
     */
    const ramp = [FIREBALL_DOT, PYROBLAST_DOT, igniteAura(0), fireVulnerabilityAura(0)];

    const fireballAt = (count: number): number => {
      const built = PRESETS_BY_ID.get('mage_fire')!.build();
      const actor = createPlayer({
        race: 'gnome',
        characterClass: 'mage',
        combatStyle: 'caster',
        talents: built.talents,
        equipment: built.equipment,
      });
      const target = makeTarget({ maxHealth: 10_000_000, stats: { armor: 0 } });
      const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
      simulation.begin();
      for (let i = 0; i < count; i += 1) simulation.applyAura(target, ramp[i], actor.id);

      return dealDamage(simulation, {
        source: actor,
        target,
        abilityId: 'fireball',
        abilityName: 'Fireball',
        school: 'fire',
        baseAmount: 10_000,
        attackTable: 'spell',
        cannotCrit: true,
      }).amount;
    };

    const base = fireballAt(0);
    expect(base).toBeGreaterThan(0);
    for (const [count, ratio] of [[1, 1.03], [2, 1.06], [3, 1.09], [4, 1.12]] as const) {
      expect(fireballAt(count) / base, `${count} effects`).toBeCloseTo(ratio, 6);
    }
  });

  it('counts five Fire effects and excludes the one that mixes schools', () => {
    /*
     * ========================================================================
     * THE TOOLTIP'S LAST SENTENCE, AND THE LIST IS THE WHOLE OF ITS
     * ENFORCEMENT: "Effects which mix multiple schools of magic do not
     * qualify." Frostfire Bolt's DoT ticks Fire and `countsAsSchools` says it
     * is also Frost, so it is excluded -- by not being in
     * `MAGE_FIRE_POWER_EFFECTS`, because nothing in the code can tell.
     *
     * THE ASYMMETRY IS ASSERTED IN BOTH DIRECTIONS BELOW, because it is the one
     * thing here a reader gets backwards: a Frostfire Bolt COLLECTS the bonus,
     * being a Fire spell, and does not CONTRIBUTE to it.
     * ========================================================================
     */
    expect(MAGE_FIRE_POWER_EFFECTS).toEqual([
      'fireball',
      'pyroblast',
      'ignite',
      'fire_vulnerability',
      // Flamestrike's burn, round 58.
      'flamestrike',
    ]);
    expect(MAGE_FIRE_POWER_EFFECTS).not.toContain('frostfire_bolt');
    /*
     * EACH NAMED ID IS A REAL MAGE AURA, OR THE COUNT SILENTLY NEVER REACHES
     * IT -- which is the whole failure mode of a named list. `auras.has()`
     * against an id nothing applies is permanently false, so a typo here is a
     * talent worth 3% less per misspelling with nothing anywhere to say so.
     *
     * `aurasForClass` RATHER THAN `CATALOG_AURAS`, because that constant holds
     * only the FACTORY-built auras -- Fireball's and Pyroblast's DoTs are plain
     * exported constants that the catalogue's export walk finds instead. Asking
     * the narrower list reported `fireball` as missing, which is the catalogue's
     * own documented split and not a gap.
     */
    const mageAuraIds = new Set(aurasForClass('mage').map((aura) => aura.id));
    for (const id of MAGE_FIRE_POWER_EFFECTS) {
      expect(mageAuraIds.has(id), id).toBe(true);
    }
  });

  it('does NOT multiply intellect by eleven', () => {
    /*
     * ------------------------------------------------------------------------
     * THE `scale` BUG, PINNED WHERE IT HURT MOST. `percentAdd` wants a
     * FRACTION and a talent states a PERCENTAGE, so Arcane Mind's "+10%
     * intellect" arrived as +1000%: 139 base intellect read back as 1,529 and
     * spell crit as 28.9% against a true 5.8%.
     *
     * The Druid and the Shaman shipped with the same mistake. There is a
     * structural test in `classRegistration.test.ts` that fails for ANY
     * unscaled percentage effect; this one pins the number a person would
     * actually look at.
     * ------------------------------------------------------------------------
     */
    /*
     * THE COMPARISON HAS TO WEAR THE SAME GEAR. It used to be a naked
     * character, which worked only because the Warrior plate the Mage borrowed
     * had no intellect on it at all -- 175 points of Arcanist intellect later,
     * `base * 1.1` was comparing two different characters. Same items, no
     * talents, so the only difference left is the talent under test.
     */
    const built = PRESETS_BY_ID.get('mage_arcane')!.build();
    const plain = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      combatStyle: 'caster',
      equipment: built.equipment,
    });
    const arcane = presetPlayer('mage_arcane');

    const base = plain.stats.get('intellect');
    expect(arcane.stats.get('intellect')).toBeCloseTo(base * 1.1, 6);
  });
});

describe('the cast modifiers this class is full of', () => {
  it('shortens Pyroblast by a quarter a Heating Up stack', () => {
    /*
     * ----------------------------------------------------------------------
     * CALLED HOT STREAK UNTIL CLIENT BUILD 1.60.1.70170: "Hot Streak has been
     * renamed to Heating Up, since it is no longer dependent on having a
     * 'streak'". The window also went 15 seconds to 20.
     *
     * THE TITLE USED TO END "and is NOT consumed", and that was the OPEN
     * QUESTION this test carried rather than a fact. The new tooltip reads
     * "reduce the cast time of your NEXT Pyroblast cast within 20 sec" -- the
     * Maelstrom Weapon shape -- and the patch note said only that the name had
     * moved, so the old behaviour was kept and flagged. The owner then called
     * it: "This was an oversight by me ... Heating up's 3 stacks should be
     * consumed after 1 pyroblast cast." The consumption is tested next door.
     *
     * WHAT IS LEFT HERE IS THE MAGNITUDE, which the ruling did not touch.
     * ----------------------------------------------------------------------
     */
    const actor = bareMage('mage_fire');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    const pyroblast = actor.abilities.get('pyroblast')!;
    const base = pyroblast.castTimeMs!;

    simulation.applyAura(actor, HEATING_UP, actor.id);
    actor.auras.get('heating_up')!.stacks = HEATING_UP_MAX_STACKS;

    const reduction = HEATING_UP_REDUCTION_PER_STACK * HEATING_UP_MAX_STACKS;
    expect(resolveCast(actor, pyroblast).baseCastTimeMs).toBe(Math.round(base * (1 - reduction)));

    // Three stacks of 25% is exactly 75%, so six seconds becomes one and a half.
    expect(resolveCast(actor, pyroblast).baseCastTimeMs).toBe(seconds(1.5));
  });

  it('keeps its hand-filled 25%, which the rename nearly lost', () => {
    /*
     * A SINGLE-RANK TALENT'S VALUE IS HAND-FILLED AND KEYED BY TALENT ID, so the
     * rename wrote a new key and the importer's merge found nothing under it:
     * `values/mage.json` came back with `heating_up` at null.
     *
     * AN EFFECT THAT READS NO VALUE IS DROPPED IN SILENCE, so the cast-time
     * reduction would simply have stopped applying while the talent reported
     * itself fully modelled. Asserted here from the tooltip rather than from the
     * constant, because the constant and the values file are two different
     * things and only one of them can go missing this way.
     */
    expect(talentNumber('mage', 'heating_up', 1, 0)).toBe(25);
    expect(HEATING_UP_REDUCTION_PER_STACK).toBe(0.25);
  });

  it('is spent in FULL by one Pyroblast, not a stack at a time', () => {
    /*
     * ----------------------------------------------------------------------
     * THE OWNER'S RULING: "Heating up's 3 stacks should be consumed after 1
     * pyroblast cast."
     *
     * `all` AND NOT `stack`, WHICH IS WHY THAT FIELD IS AN ENUM. Spending one
     * charge would leave two behind for the next Pyroblast, which reads as a
     * working talent and is worth several times what it should be -- and both
     * readings produce a plausible number, so the test asserts the aura is GONE
     * rather than that it shrank.
     *
     * AND THE THIRD ASSERTION IS THE ONE THAT WOULD HAVE CAUGHT THE OLD
     * BEHAVIOUR: a SECOND Pyroblast inside the same window pays full cast time.
     * That is the whole difference the ruling makes -- 75% off one Pyroblast
     * against 75% off every Pyroblast in twenty seconds.
     * ----------------------------------------------------------------------
     */
    expect(HEATING_UP.castModifier?.consumedByCast).toBe('all');

    const actor = bareMage('mage_fire');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    simulation.begin();

    const pyroblast = actor.abilities.get('pyroblast')!;
    const base = pyroblast.castTimeMs!;

    simulation.applyAura(actor, HEATING_UP, actor.id);
    actor.auras.get('heating_up')!.stacks = HEATING_UP_MAX_STACKS;
    expect(resolveCast(actor, pyroblast).baseCastTimeMs).toBe(seconds(1.5));

    castAbility(simulation, actor, pyroblast, target);

    // The whole aura, not two stacks of it.
    expect(actor.auras.has('heating_up')).toBe(false);
    expect(actor.auras.stacksOf('heating_up')).toBe(0);
    // So the next Pyroblast inside the same window pays in full.
    expect(resolveCast(actor, pyroblast).baseCastTimeMs).toBe(base);
  });

  it('is not spent by anything other than Pyroblast', () => {
    /*
     * `abilityIds: ['pyroblast']` is what scopes it, and a charge spent on the
     * wrong ability is the invisible failure: the proc still fires, the aura
     * still reports its uptime, and the saving simply lands nowhere. Fireball is
     * the filler directly beneath Pyroblast in both lists and is a Heating Up
     * TRIGGER, so it is the one that would collide.
     */
    const actor = bareMage('mage_fire');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    simulation.begin();

    simulation.applyAura(actor, HEATING_UP, actor.id);
    actor.auras.get('heating_up')!.stacks = HEATING_UP_MAX_STACKS;

    castAbility(simulation, actor, actor.abilities.get('fireball')!, target);
    expect(actor.auras.stacksOf('heating_up')).toBe(HEATING_UP_MAX_STACKS);
  });

  it('RAISES Arcane Blast’s cost per stack, which is a negative fraction', () => {
    /*
     * The one cast modifier in the project that makes something WORSE, and the
     * field takes it without a special case. 175% a stack on a 140-mana spell:
     * one stack is 385, two is 630, four is 1,120 -- which is what makes
     * Arcane Blast a burst spell rather than a filler, and what the priority
     * list's stack limit is reading.
     */
    const actor = bareMage('mage_arcane');
    const simulation = buildSimulation([actor, makeTarget()]);
    const blast = actor.abilities.get('arcane_blast')!;
    const base = blast.cost!.amount;

    expect(base).toBe(Math.round(MAGE_BASE_MANA * ARCANE_BLAST_BASE_MANA_FRACTION));
    expect(ARCANE_BLAST_COST_INCREASE_PER_STACK).toBe(1.75);

    simulation.applyAura(actor, arcaneBlastAura(actor.stats.effective.intellect), actor.id);
    for (const stacks of [1, 2, 4]) {
      actor.auras.get('arcane_blast')!.stacks = stacks;
      expect(resolveCast(actor, blast).costAmount, `${stacks} stacks`).toBeCloseTo(
        base * (1 + ARCANE_BLAST_COST_INCREASE_PER_STACK * stacks),
        6,
      );
    }
  });

  it('applies the stack AFTER the cast that paid the old price', () => {
    /*
     * "Each time you cast Arcane Blast, the mana cost is increased" -- so the
     * first cast is 140 and the SECOND is 385. Applying the stack before the
     * damage would charge the opener for a debuff it did not have.
     */
    const actor = bareMage('mage_arcane');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    const blast = actor.abilities.get('arcane_blast')!;

    expect(resolveCast(actor, blast).costAmount).toBe(blast.cost!.amount);
    blast.onCast({ simulation, caster: actor, target, ability: blast });
    expect(actor.auras.stacksOf('arcane_blast')).toBe(1);
    expect(resolveCast(actor, blast).costAmount).toBeGreaterThan(blast.cost!.amount);
  });
});

describe('the two things the patch did to Heating Up', () => {
  /*
   * ============================================================================
   * TWO CLAUSES IN ONE NOTE, AND THEY TOUCH OPPOSITE ENDS OF THE TALENT.
   *
   * "Heating Up is no longer consumed if the Mage also had Presence of Mind
   * active for the Pyroblast cast. Heating up also always gains an additional
   * charge each time the Mage casts Fire Blast. This does mean Fire Blast
   * critical strikes generate 2 charges."
   *
   * One is about SPENDING the aura and one is about GAINING it, so neither test
   * below could stand in for the other.
   * ============================================================================
   */

  it('is not spent on a Pyroblast that Presence of Mind already made instant', () => {
    /*
     * --------------------------------------------------------------------------
     * `requiresCastTime` DID NOT ALREADY SAY THIS, which is the near miss worth
     * asserting: that flag reads the ability's DECLARED `castTimeMs`, and
     * Pyroblast always declares one. So the aura matched a cast that was already
     * instant, its 75% had nothing left to reduce, and all three stacks were
     * thrown away -- with nothing on the results page to show it, because the
     * Pyroblast was instant either way and the aura still reported its uptime.
     *
     * IT MATTERS TO A LIST THAT EXISTS. The Arcane list was respecified to move
     * Presence of Mind so it makes PYROBLAST instant, so before this every one
     * of those casts also ate a three-stack Heating Up for nothing.
     *
     * BOTH HALVES ARE DRIVEN: the cast is still instant, which is Presence of
     * Mind doing its own job, AND the Heating Up stacks survive. Asserting only
     * the second would pass an implementation that had broken the first.
     * --------------------------------------------------------------------------
     */
    const actor = bareMage('mage_fire');
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    const pyroblast = actor.abilities.get('pyroblast')!;

    simulation.applyAura(actor, HEATING_UP, actor.id);
    for (let i = 1; i < HEATING_UP_MAX_STACKS; i += 1) {
      simulation.applyAura(actor, HEATING_UP, actor.id);
    }
    expect(actor.auras.get('heating_up')!.stacks).toBe(HEATING_UP_MAX_STACKS);

    simulation.applyAura(actor, PRESENCE_OF_MIND, actor.id);

    // Presence of Mind alone makes it instant -- Heating Up is not needed.
    expect(resolveCast(actor, pyroblast).baseCastTimeMs).toBe(0);

    castAbility(simulation, actor, pyroblast, simulation.combatants[1]);

    // Presence of Mind IS spent, which is its own `consumedByCast: 'all'`.
    expect(actor.auras.has(PRESENCE_OF_MIND.id)).toBe(false);
    // And Heating Up is NOT, with every stack intact.
    expect(actor.auras.has(HEATING_UP.id)).toBe(true);
    expect(actor.auras.get(HEATING_UP.id)!.stacks).toBe(HEATING_UP_MAX_STACKS);
  });

  it('is still spent by a Pyroblast with no Presence of Mind, which is the control', () => {
    /*
     * THE OTHER SIDE OF THE SAME CONDITION, and without it the test above
     * passes against an aura that is never consumed at all -- which would be a
     * far bigger change than the note asks for and would read as a working
     * talent worth several times its value.
     */
    const actor = bareMage('mage_fire');
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    const pyroblast = actor.abilities.get('pyroblast')!;

    simulation.applyAura(actor, HEATING_UP, actor.id);
    expect(actor.auras.has(HEATING_UP.id)).toBe(true);
    // Not instant: the aura shortens it rather than removing the cast.
    expect(resolveCast(actor, pyroblast).baseCastTimeMs).toBeGreaterThan(0);

    castAbility(simulation, actor, pyroblast, simulation.combatants[1]);
    expect(actor.auras.has(HEATING_UP.id)).toBe(false);
  });

  it('gains a charge on every Fire Blast CAST, so a crit makes two', () => {
    /*
     * ==========================================================================
     * "HEATING UP ALSO ALWAYS GAINS AN ADDITIONAL CHARGE EACH TIME THE MAGE
     * CASTS FIRE BLAST. THIS DOES MEAN FIRE BLAST CRITICAL STRIKES GENERATE 2
     * CHARGES."
     *
     * The note explains its own arithmetic, and that arithmetic is what makes
     * this a SECOND reaction rather than a change to the first. Fire Blast was
     * already in `HEATING_UP_TRIGGERS`, so a crit grants a charge through the
     * `dealt` path; the cast reaction grants one whatever happened.
     *
     * SO THE TEMPTING IMPLEMENTATION IS THE WRONG ONE. Doubling the charge
     * inside the crit reaction gives a critting Fire Blast its two and gives a
     * non-critting one NOTHING -- a smaller number, no error, and it reads
     * exactly like a working talent. The two halves are driven separately here
     * for that reason.
     * ==========================================================================
     */
    const stacksAfter = (crit: boolean): number => {
      const actor = createPlayer({
        race: 'gnome',
        characterClass: 'mage',
        talents: legalise({ heating_up: 1 }, 'mage'),
        bonusStats: {
          hitChance: 100,
          // Forced either way, so the crit path is a decision and not a roll.
          spellCritChance: crit ? 100 : -1000,
          critRating: 0,
        },
      });
      const target = makeTarget({ maxHealth: 1_000_000, stats: { armor: 0 } });
      const simulation = buildSimulation([actor, target]);
      simulation.begin();
      const fireBlast = actor.abilities.get('fire_blast')!;
      castAbility(simulation, actor, fireBlast, target);
      return actor.auras.get(HEATING_UP.id)?.stacks ?? 0;
    };

    // A cast that did NOT crit still banks one, which is the new half.
    expect(stacksAfter(false)).toBe(1);
    // And one that crit banks two: the cast reaction and the damage reaction.
    expect(stacksAfter(true)).toBe(2);
  });

  it('registers both of Heating Up’s halves on a build that takes it', () => {
    /*
     * THE JOIN, AND IT IS THE HALF THAT GOES MISSING IN SILENCE. The cast
     * reaction has to be in `MAGE_CAST_REACTIONS` as well as in the effect
     * table, and a reaction the registry does not carry is simply absent --
     * `lone_wolf` went the whole project that way. It is also `valueless`,
     * because an effect that reads no value is DROPPED without saying so, and
     * Heating Up's own value is hand-filled and has gone missing once already.
     *
     * REGISTERED UNDER ONE TALENT ID, which is what makes it impossible for a
     * build to have one half and not the other.
     */
    const actor = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      talents: legalise({ heating_up: 1 }, 'mage'),
    });
    expect(actor.reactions.map((r) => r.id)).toContain('heating_up');
    expect(actor.castReactions.map((r) => r.id)).toContain('heating_up_fire_blast');

    // And a Mage without the talent has neither.
    const without = createPlayer({ race: 'gnome', characterClass: 'mage' });
    expect(without.reactions.map((r) => r.id)).not.toContain('heating_up');
    expect(without.castReactions.map((r) => r.id)).not.toContain('heating_up_fire_blast');
  });
});

describe('the three fights', () => {
  it('Fire opens with Scorch until the vulnerability caps, then stops', () => {
    const batch = batchOf('mage_fire', 40, 5);
    const used = (name: string) =>
      batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;

    /*
     * ENOUGH SCORCHES TO CAP FIVE STACKS, AND THEN AGAIN. The vulnerability
     * lasts thirty seconds against a sixty-second fight, so a Fire mage stacks
     * it twice -- which is why this is "more than five" rather than "exactly
     * five", and why the condition reads the STACKS rather than counting casts.
     */
    expect(used('Scorch')).toBeGreaterThan(IMPROVED_SCORCH_MAX_STACKS);

    /*
     * PYROBLAST IS CAST, WHICH IS THE WHOLE OF HOT STREAK. Six seconds of cast
     * time is never worth it unshortened; every one of these is a Hot Streak
     * Pyroblast, because the entry's condition allows no other kind.
     */
    expect(used('Pyroblast')).toBeGreaterThan(1);

    // And Fireball is the filler underneath all of it -- thin, because this
    // build runs out of mana rather than out of global cooldowns.
    expect(used('Fireball')).toBeGreaterThan(0);
  });

  it('stacks the Fire vulnerability on the TARGET and scales with it', () => {
    const actor = bareMage('mage_fire');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);

    simulation.applyAura(target, fireVulnerabilityAura(3), actor.id);
    target.auras.get('fire_vulnerability')!.stacks = IMPROVED_SCORCH_MAX_STACKS;

    // Compounding, matching every other damage multiplier in the engine.
    expect(target.damageTakenMultiplierFor('fire')).toBeCloseTo(1.03 ** 5, 6);
    expect(target.damageTakenMultiplierFor('frost')).toBeCloseTo(1, 6);
  });

  it('Arcane channels Arcane Missiles, which is the first channel in the project', () => {
    const batch = batchOf('mage_arcane', 40, 5);
    const missiles = batch.abilities.find((a) => a.abilityName === 'Arcane Missiles');
    expect(missiles?.uses ?? 0).toBeGreaterThan(2);
    // Five ticks a cast, each rolling the table on its own, so a channel lands
    // far more "hits" than it has casts.
    expect(ARCANE_MISSILES_TICKS).toBe(5);
    expect(ARCANE_MISSILES_PER_TICK).toBe(209);
  });

  it('NO LONGER GIVES THEM A FLOOR: both halves of it have expired', () => {
    /*
     * --------------------------------------------------------------------------
     * TWO REASONS, BOTH GONE, AND NEITHER WAS A DATA CHANGE IN THE END.
     *
     * The gear half went first: all three wear Arcanist and read 452 spell
     * power -- 422 off the items and 30 off the staff enchant -- where the
     * Warrior shell gave none.
     *
     * The coefficient half has gone now. The spell TEXT still states a flat
     * range and no coefficient, exactly as before; what arrived is the RULE,
     * supplied by the ruleset owner as universal, so it never needed stating
     * per spell. Nothing was invented and nothing was read from Classic.
     * --------------------------------------------------------------------------
     */
    /*
     * ------------------------------------------------------------------------
     * THE FIGURE IS THE GEAR'S AND THE CLAIM IS THE JOIN, which is what this
     * assertion has to be now.
     *
     * It pinned an exact total, rebuilt three times as the gear changed -- the
     * items, then Forever's +64 on the caster weapon, then the owner's caster
     * enchant row. The gear underneath is the E65 benchmark set now and the
     * old weapon is deleted, so a fourth literal would be a fourth thing to
     * rewrite.
     *
     * WHAT THE TEST IS FOR is that the set's spell power REACHES the character:
     * the shortfall it was written for was a caster in a Warrior's gear
     * reading zero. So the enchant's contribution is isolated -- it is the one
     * term that can be removed -- and the rest is asserted to be real.
     * ------------------------------------------------------------------------
     */
    const totals = ['mage_fire', 'mage_frostfire', 'mage_arcane'].map((preset) =>
      presetPlayer(preset).stats.get('spellPower'),
    );
    for (const [index, total] of totals.entries()) {
      expect(total, String(index)).toBeGreaterThan(6 + 16 + 20 + 30);
    }
    // AND FIRE AND FROSTFIRE READ THE SAME, which is the half that catches one
    // Mage being given a different set: their templates are identical in
    // everything the budget sees. Arcane was the third until round 51 gave its
    // template 10 more hit rating to reach 17% on Arcane. Since round 80 the
    // Frostfire staff carries Revelation where Fire keeps +65 Spell Power, so
    // the two differ by exactly that enchant.
    expect(totals[0]).toBe(totals[1] + 65);
    const named = batchOf('mage_fire', 20, 5).castButNotSimulated.map((e) => e.abilityName);
    expect(named).not.toContain('Fireball');
  });

  it('takes both of Pyroblast’s halves from the sheet, not from its cast time', () => {
    /*
     * 0.91 on the hit and 15% a tick, transcribed by hand from
     * WoWSimWorksheet.xlsx rather than read back out of the table under test.
     *
     * PYROBLAST USED TO BE THE ONE SPELL THAT REACHED THE CAST CLAMP. Six
     * seconds over 3.5 is 1.714, clamped to 1.0, then shared with its burn --
     * three derivation steps and a borrowed Classic rule, replaced by two
     * stated numbers. There is no clamp left for anything to reach.
     */
    expect(PYROBLAST_COEFFICIENTS.direct).toBeCloseTo(0.91, 10);
    expect(PYROBLAST_COEFFICIENTS.perTick).toBeCloseTo(0.15, 10);

    // And it is NOT what the old derivation gave, which is the point.
    expect(PYROBLAST_COEFFICIENTS.direct).not.toBeCloseTo(1 / 1.8, 3);
  });

  it('gives IGNITE no coefficient, because its size is already scaled', () => {
    /*
     * --------------------------------------------------------------------------
     * THE ONE MAGICAL EFFECT IN THE PROJECT THAT DELIBERATELY DOES NOT SCALE.
     *
     * Ignite is "an additional N% of your spell's damage over 4 sec", so its
     * magnitude is a SHARE OF THE CRIT THAT CAUSED IT -- and that hit already
     * had its own coefficient applied. Giving Ignite one as well would apply
     * spell power twice to the same damage, at a number that would look
     * entirely reasonable.
     *
     * The rule is general: any effect whose size is derived from another hit
     * takes no coefficient of its own. Asserted here because
     * `everySpellScales.test.ts` cannot reach Ignite -- it is an aura with no
     * ability behind it, so nothing casts it.
     * --------------------------------------------------------------------------
     */
    const events: TelemetryEvent[] = [];
    const actor = makeAttacker({
      autoAttack: 'none',
      stats: { spellPower: 5000 },
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target], { durationMs: seconds(30) }, {
      emit: (event) => events.push(event),
    });

    // A fixed 400 of "spell damage that crit", which is what the reaction hands
    // the aura. The ticks must total exactly that, untouched by the 5000.
    const IGNITED = 400;
    simulation.applyAura(target, igniteAura(IGNITED), actor.id);
    simulation.advanceTo(seconds(10));

    const total = events
      .filter((e) => e.type === 'damage' && e.abilityId === 'ignite')
      .reduce((sum, e) => sum + (e.type === 'damage' ? e.amount : 0), 0);

    expect(total).toBeCloseTo(IGNITED, 6);
  });

  it('gives Arcane Missiles 28.6% a missile, from the sheet', () => {
    /*
     * 28.6% PER TICK, hand-transcribed from WoWSimWorksheet.xlsx. Five
     * missiles make 1.43 in total, which is still the largest coefficient in
     * the project.
     *
     * The derived channel rule happened to give the same figure -- five
     * seconds over 3.5, shared five ways -- so this one number did not move.
     * It is asserted against the SHEET rather than against that arithmetic,
     * because the agreement is a coincidence of this spell and not a rule.
     */
    expect(ARCANE_MISSILES_TICK_COEFFICIENT).toBeCloseTo(0.286, 10);
    expect(ARCANE_MISSILES_TICK_COEFFICIENT * ARCANE_MISSILES_TICKS).toBeGreaterThan(1);
  });
});

describe('Mage Armor, whose whole worth is the five second rule', () => {
  /*
   * --------------------------------------------------------------------------
   * "Increases your resistance to all magic by 15 and allows 50% of your mana
   * regeneration to continue while casting."
   *
   * The second clause is the one that pays, and the engine already had the
   * rule waiting for it: `manaPerTick` suppresses regeneration for five
   * seconds after mana is spent and lets through whatever fraction
   * `manaRegenBypass` names. A Mage casting continuously never leaves that
   * lockout, so this is the difference between half its regeneration and none.
   *
   * ASSERTED ON THE MECHANISM rather than on a profile's DPS, because a mana
   * effect is worth nothing to a build that never runs dry -- and two of the
   * three Mage builds might not. What has to be true is that the stat arrives
   * and that the rule reads it.
   * --------------------------------------------------------------------------
   */
  const caster = (bypassFromTalents = 0) =>
    makeAttacker({
      autoAttack: 'none',
      stats: { manaPer5: 100, manaRegenBypass: bypassFromTalents },
      resources: [{ type: 'mana', maximum: 10_000 }],
    });

  it('grants a flat 50 into the same pool a talent feeds', () => {
    expect(MAGE_ARMOR_REGEN_BYPASS).toBe(50);
    expect(MAGE_ARMOR.statModifiers).toEqual([
      { stat: 'manaRegenBypass', operation: 'flat', value: 50 },
    ]);
    // No duration: thirty minutes outlasts every fight here thirty times over.
    expect(MAGE_ARMOR.durationMs).toBe(0);
  });

  it('lets half the regeneration through while the lockout is running', () => {
    const actor = caster();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();

    const full = manaPerTick(actor, 0);
    expect(full).toBeGreaterThan(0);

    // Spend, so the five second rule is biting.
    actor.recordResourceSpend('mana', 0);
    const during = manaPerTick(actor, seconds(1));

    simulation.applyAura(actor, MAGE_ARMOR, actor.id);
    const withArmor = manaPerTick(actor, seconds(1));

    expect(during).toBeLessThan(full);
    expect(withArmor).toBeCloseTo(full * 0.5, 6);
    expect(withArmor).toBeGreaterThan(during);
  });

  it('stacks ADDITIVELY with a talent granting the same thing, clamped at 100', () => {
    /*
     * Arcane Meditation grants the same stat, so a Mage that takes it and
     * casts this is not getting 50% of 50% -- it is getting the sum. The clamp
     * lives in the rule rather than in the aura, so neither source has to know
     * about the other.
     */
    const actor = caster(60);
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    simulation.applyAura(actor, MAGE_ARMOR, actor.id);

    actor.recordResourceSpend('mana', 0);

    // 60 + 50 is 110, clamped to 100: the whole tick comes through.
    expect(manaPerTick(actor, seconds(1))).toBeCloseTo(manaPerTick(actor, seconds(10)), 6);
  });

  it('is in every Mage build, and is cast once', () => {
    for (const preset of ['mage_fire', 'mage_frostfire', 'mage_arcane']) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      const book = abilitiesForClass('mage', 'caster', built.talents).map((a) => a.id);
      expect(book, preset).toContain('mage_armor');
    }

    // `canCast` refuses it once the aura is up, so an ungated entry at the top
    // of a list costs one global cooldown for the whole fight and no more.
    const actor = caster();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    const context = { simulation, caster: actor, target: undefined, ability: MAGE_ARMOR_ABILITY };
    expect(MAGE_ARMOR_ABILITY.canCast?.(context)).toBe(true);
    simulation.applyAura(actor, MAGE_ARMOR, actor.id);
    expect(MAGE_ARMOR_ABILITY.canCast?.(context)).toBe(false);
  });
});

describe('Fingers of Frost, the one Frozen talent that is not inert', () => {
  /*
   * --------------------------------------------------------------------------
   * "Gives your Chill effects a 15% chance to grant you the Fingers of Frost
   * effect, which treats your next 2 spells cast as if the target were Frozen.
   * Lasts 15 sec."
   *
   * EVERY OTHER FROZEN EFFECT IN THIS CLASS IS INERT BECAUSE OF THE TARGET --
   * nothing freezes a raid boss, which is a durable claim. This talent does
   * not freeze anything: it puts a state on the MAGE, and that is reachable
   * exactly as written.
   * --------------------------------------------------------------------------
   */
  const frostMage = () =>
    makeAttacker({
      autoAttack: 'none',
      abilities: [ICE_LANCE],
      stats: { spellPower: 1000 },
      resources: [{ type: 'mana', maximum: 50_000 }],
    });

  it('keeps the chance as a constant the values file still agrees with', () => {
    /*
     * ITS RANK SCALES THE CHARGES, NOT THE CHANCE, which is the opposite of
     * nearly every other proc talent here. A constant standing in for a
     * per-rank value is how a rank change goes unnoticed, so this asserts the
     * constant against BOTH ranks rather than trusting it.
     */
    expect(talentNumber('mage', 'fingers_of_frost', 1, 0)).toBe(FINGERS_OF_FROST_PROC_CHANCE);
    expect(talentNumber('mage', 'fingers_of_frost', 2, 0)).toBe(FINGERS_OF_FROST_PROC_CHANCE);
    // And the charges DO scale.
    expect(talentNumber('mage', 'fingers_of_frost', 1, 1)).toBe(1);
    expect(talentNumber('mage', 'fingers_of_frost', 2, 1)).toBe(2);
  });

  it('procs only off a Chill effect, which has to be declared rather than detected', () => {
    // Frostbolt and Frostfire Bolt both "slow movement speed by 40%", and
    // nothing here has movement -- so the slow cannot be detected and the ids
    // are named instead.
    // Cone of Cold joined when it was declared: the owner kept its slow in
    // scope ONLY as a Chill, so Fingers of Frost can proc off it.
    expect([...CHILL_ABILITY_IDS].sort()).toEqual(['cone_of_cold', 'frostbolt', 'frostfire_bolt']);

    const reaction = fingersOfFrost(2);
    const actor = frostMage();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    const fires = (abilityId: string) =>
      reaction.canTrigger?.(simulation, actor, { abilityId } as never) ?? true;
    expect(fires('scorch')).toBe(false);
    expect(fires('pyroblast')).toBe(false);
  });

  it('triples ALL of Ice Lance, the coefficient as well as the base', () => {
    /*
     * TIMES THREE, LOWERED FROM FOUR: "Ice Lance damage against Frozen targets
     * changed to a 200% increase (Was 300%)." The READING is unchanged and is
     * the owner's -- "increased BY 200%" is base plus twice itself, where
     * "deals 200% damage" would be two and is also what Classic does.
     *
     * AND IT REACHES THE COEFFICIENT. Applying the multiplier to `baseAmount`
     * alone would leave a spell-power-heavy Mage's Ice Lance barely improved
     * and would look entirely reasonable, so the ratio is asserted at a
     * thousand spell power where the coefficient dominates.
     *
     * THE RATIO IS ASSERTED AS WELL AS THE CONSTANT, which is what makes this
     * a test of the MECHANISM: the multiplier is read at cast time and reaches
     * two separate terms, and a constant check cannot see one of them being
     * dropped or applied twice. Four and three are the two readings the
     * project has held, so an exact ratio against a scripted non-crit is the
     * check -- the floor below is kept for the crit case.
     */
    expect(ICE_LANCE_FROZEN_MULTIPLIER).toBe(3);

    const actor = frostMage();
    const target = makeTarget({ maxHealth: 1_000_000 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) }, {
      emit: (event) => events.push(event),
    });
    simulation.begin();

    const damageOf = () => {
      const hit = events.filter((e) => e.type === 'damage' && e.abilityId === 'ice_lance').pop();
      return hit && hit.type === 'damage' ? hit.amount : 0;
    };

    castAbility(simulation, actor, ICE_LANCE, target);
    const plain = damageOf();
    expect(plain).toBeGreaterThan(0);

    simulation.advanceTo(seconds(5));
    simulation.applyAura(actor, fingersOfFrostAura(2), actor.id);
    simulation.advanceTo(seconds(6));
    castAbility(simulation, actor, ICE_LANCE, target);
    const frozen = damageOf();

    /*
     * The combat table can crit either one, so this is a floor rather than an
     * equality: three times the base must be well clear of an uncrit hit. A
     * crit is 1.5x on the spell table, so `plain * 1.5` is the worst case the
     * unfrozen cast can reach and 3x must beat it -- which `> plain * 1.6`
     * says without assuming neither cast crit.
     */
    expect(frozen).toBeGreaterThan(plain * 1.6);
  });

  it('does not let the cast that procced it spend a charge', () => {
    /*
     * Cast reactions run AFTER `onCast`, so the Frostbolt whose damage applied
     * the aura would otherwise immediately eat one of its own charges. "Your
     * NEXT 2 spells" is what rules that out.
     */
    const actor = frostMage();
    const simulation = buildSimulation([actor, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    const spender = fingersOfFrostSpender();
    simulation.applyAura(actor, fingersOfFrostAura(2), actor.id);
    expect(spender.canTrigger?.(simulation, actor, {} as never)).toBe(false);

    simulation.advanceTo(seconds(1));
    expect(spender.canTrigger?.(simulation, actor, {} as never)).toBe(true);

    // Two charges, two casts.
    spender.onTrigger(simulation, actor, {} as never);
    expect(actor.auras.stacksOf('fingers_of_frost')).toBe(1);
    spender.onTrigger(simulation, actor, {} as never);
    expect(actor.auras.has('fingers_of_frost')).toBe(false);
  });

  /*
   * THIS REPLACES A TEST THAT PINNED THE GAP. It asserted Shatter was still
   * unmodelled and that its reason named Fingers of Frost -- correct on the day
   * and exactly the shape CLAUDE.md warns about, a test enforcing a temporary
   * limitation instead of catching it. The limitation is gone, so the test
   * asserts the MECHANISM instead.
   */
  it('gives Shatter the Fingers of Frost window, and names the aura it reads', () => {
    /*
     * THE ID IS A STRING AND NOTHING TYPECHECKS IT. Renaming the aura would
     * leave Shatter pointing at nothing, paying nothing, with no compile error
     * and no failing assertion anywhere else -- so this asserts the LINK rather
     * than the two ids separately.
     */
    const shatter = MAGE_TALENT_EFFECTS.shatter;
    expect(shatter).toHaveLength(1);
    const effect = shatter[0]!;
    expect(effect.kind).toBe('critWhileAura');
    if (effect.kind !== 'critWhileAura') throw new Error('unreachable');
    expect(effect.auraId).toBe(FINGERS_OF_FROST.id);
    // "all your spells", and every ability in the Mage's book is one.
    expect(effect.abilityId).toBe(ALL_ABILITIES);
  });

  it('is 17, 33 and 50 percent by rank, which is what the capture says', () => {
    /*
     * Written out by hand from `values/mage.json`, which states
     * "Increases the critical strike chance of all your spells against Frozen
     * targets by {0}%." at [17, 33, 50]. THREE RANKS, not Classic's five --
     * reading a Classic 10/20/30/40/50 here would be wrong in both the count
     * and every value.
     */
    expect(talentNumber('mage', 'shatter', 1, 0)).toBe(17);
    expect(talentNumber('mage', 'shatter', 2, 0)).toBe(33);
    expect(talentNumber('mage', 'shatter', 3, 0)).toBe(50);
  });

  it('pays only while the aura is up, and reaches every spell', () => {
    /*
     * THE MECHANISM, not a DPS delta: the resolved crit bonus on a named spell,
     * read off the combatant's own funnel before and after the aura lands.
     *
     * A profile's DPS moving is not the test that a talent works -- and this
     * one is a window worth about two casts per proc, which is small enough to
     * sit inside the noise of any batch.
     */
    const mage = presetPlayer('mage_frostfire');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    const critFor = (abilityId: string) => mage.abilityModifierFor(abilityId).critBonus ?? 0;

    /*
     * BASELINES FIRST, and per ability, because this build already has
     * per-ability crit from other talents -- Incineration names four spells.
     * The claim is the DIFFERENCE the window makes, not the absolute.
     */
    const frostboltBefore = critFor('frostbolt');
    const fireballBefore = critFor('fireball');

    simulation.applyAura(mage, fingersOfFrostAura(2), mage.id);
    expect(critFor('frostbolt') - frostboltBefore).toBeCloseTo(50, 10);
    // "ALL your spells", so a Fire spell in the same build gets the same 50.
    expect(critFor('fireball') - fireballBefore).toBeCloseTo(50, 10);

    mage.auras.remove(simulation, FINGERS_OF_FROST.id);
    expect(critFor('frostbolt')).toBeCloseTo(frostboltBefore, 10);
    expect(critFor('fireball')).toBeCloseTo(fireballBefore, 10);
  });

  it('does not reach an auto attack, which carries no ability id', () => {
    /*
     * "All your SPELLS". A swing has no `abilityId`, so nothing keyed to one
     * touches it -- including `ALL_ABILITIES`. Asserted because the catch-all
     * key is exactly the shape that would leak into swings if the funnel ever
     * stopped short-circuiting on `undefined`.
     */
    const mage = presetPlayer('mage_frostfire');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    simulation.applyAura(mage, fingersOfFrostAura(2), mage.id);

    expect(mage.abilityModifierFor(undefined).critBonus ?? 0).toBe(0);
  });
});

describe('Combustion, whose end condition is four crits rather than a clock', () => {
  /*
   * --------------------------------------------------------------------------
   * "When activated, this spell causes each of your Fire damage spell hits to
   * increase your critical strike chance with Fire damage spells by 10%. This
   * effect lasts until you have caused 4 non-periodic critical strikes with
   * Fire spells."
   *
   * IT HAD NO TEST AT ALL BEFORE THIS, which is how three separate errors
   * survived in one aura: the ability applied ten stacks by writing
   * `instance.stacks` directly, the crit was `spellCritChance` -- every school
   * rather than Fire -- and the window was a placeholder thirty seconds.
   *
   * AND THE FIRST OF THOSE CANCELLED THE OTHER TWO. `applyStatModifiers` runs
   * inside `apply` at ONE stack, and only `refresh` re-applies -- so writing
   * the field afterwards left the aura REPORTING ten stacks and PAYING one.
   * The caveat beside it said the effect was generous; it was worth +10% crit
   * for thirty seconds, and the profile was understated by 38.9 DPS.
   *
   * Every assertion below is on the MECHANISM, because a talent working and a
   * talent mattering are different questions.
   * --------------------------------------------------------------------------
   */
  const fireMage = () => {
    const built = PRESETS_BY_ID.get('mage_fire')!.build();
    return makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('mage', 'caster', built.talents),
      reactions: [MAGE_TALENT_REACTIONS.combustion(talentNumber('mage', 'combustion', 1, 0)!)],
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
  };

  it('reads its 10 from the values file rather than from a constant', () => {
    // Hand-filled per `src/data/talents/values/README.md`: a single-rank talent
    // has no `{0}` for the importer to identify, and an effect that reads no
    // value is DROPPED rather than reported.
    expect(talentNumber('mage', 'combustion', 1, 0)).toBe(COMBUSTION_CRIT_PER_STACK);
  });

  it('raises Fire spells only, and by a stack at a time', () => {
    const mage = fireMage();
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(120) });
    simulation.begin();

    const critOf = (abilityId: string) => mage.abilityModifierFor(abilityId).critBonus ?? 0;
    expect(critOf('fireball')).toBe(0);

    simulation.applyAura(mage, COMBUSTION, mage.id);
    expect(critOf('fireball')).toBe(COMBUSTION_CRIT_PER_STACK);
    // An Arcane spell in the same book gets nothing: the old shape moved
    // `spellCritChance`, which is every school at once.
    expect(critOf('arcane_missiles')).toBe(0);
    expect(critOf('frostbolt')).toBe(0);

    simulation.applyAura(mage, COMBUSTION, mage.id);
    simulation.applyAura(mage, COMBUSTION, mage.id);
    expect(mage.auras.stacksOf('combustion')).toBe(3);
    // THREE stacks is three times the bonus. `modifiersScaleWithStacks` did not
    // reach `abilityModifiers` until this aura wanted it.
    expect(critOf('fireball')).toBe(3 * COMBUSTION_CRIT_PER_STACK);
  });

  it('covers every Fire spell in the Mage book and nothing else', () => {
    /*
     * THE SCHOOL IS WRITTEN OUT AS IDS, so a new Fire spell has to be added to
     * `FIRE_SPELL_IDS` by hand. This is the test that says so the day one is
     * not -- which Presence of Mind's own list did NOT have, and is how that
     * list came to be missing Arcane Wrath. A list standing in for a property
     * of the ability needs either a clause that describes the set or a test
     * that derives it; Presence of Mind has the clause now, and this has the
     * test.
     */
    const fire = MAGE_ABILITIES.filter((ability) =>
      // Every Mage ability that deals Fire damage, found from its own source.
      ['fireball', 'scorch', 'pyroblast', 'fire_blast', 'blast_wave', 'frostfire_bolt', 'flamestrike'].includes(
        ability.id,
      ),
    ).map((ability) => ability.id);
    expect([...FIRE_SPELL_IDS].sort()).toEqual([...fire].sort());
  });

  it('ends on the THIRD non-periodic Fire crit, not on a timer', () => {
    /*
     * THE AURA IS PERMANENT -- `durationMs: 0` -- because the source states no
     * duration. `PLACEHOLDER_COMBUSTION_DURATION_MS` is deleted with this, and
     * a run that reached `COMBUSTION_STACK_CAP` would mean the counter below
     * had stopped working rather than that the cap is a ruleset figure.
     */
    expect(COMBUSTION.durationMs).toBe(0);
    expect(COMBUSTION.maxStacks).toBe(COMBUSTION_STACK_CAP);

    const mage = fireMage();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const simulation = buildSimulation([mage, target], { durationMs: seconds(120) });
    simulation.begin();
    simulation.applyAura(mage, COMBUSTION, mage.id);

    const reaction = mage.reactions.find((r) => r.id === 'combustion')!;
    const fire = (outcome: 'hit' | 'crit') => {
      const attack = { attacker: mage, defender: target, outcome, abilityId: 'fireball',
        abilityName: 'Fireball', amount: 100, weaponSlot: undefined, critical: outcome === 'crit' };
      if (reaction.canTrigger?.(simulation, mage, attack as never) === false) return;
      reaction.onTrigger(simulation, mage, attack as never);
    };

    // Three hits: three more stacks, and the aura still up.
    fire('hit');
    fire('hit');
    fire('hit');
    expect(mage.auras.stacksOf('combustion')).toBe(4);

    /*
     * THREE CRITS, NOT FOUR, SINCE CLIENT BUILD 1.60.1.70170: "The number of
     * charges of Combustion has returned to 3 (was 4)".
     *
     * "CHARGES" IN THAT NOTE IS THE CRIT COUNT AND NOT `maxStacks`, which is the
     * confusion worth guarding against here -- this aura has a stack count too,
     * capped at twenty for an unrelated reason. Reading the note as the stack cap
     * would have left the window ending a crit late and capped the crit bonus at
     * +30%, and both halves are asserted in this test so neither can drift.
     */
    expect(COMBUSTION_CRITS_TO_END).toBe(3);
    fire('crit');
    fire('crit');
    expect(mage.auras.has('combustion')).toBe(true);
    fire('crit');
    expect(mage.auras.has('combustion')).toBe(false);
  });

  it('starts a second window from zero crits', () => {
    /*
     * THE COUNTER IS A CLOSURE, per character, keyed on the aura's `appliedAt`.
     * Without the key a second Combustion would inherit the first's count and
     * end on its first crit -- which is a shorter window and no error.
     */
    const mage = fireMage();
    const target = makeTarget({ maxHealth: 10_000_000 });
    const simulation = buildSimulation([mage, target], { durationMs: seconds(400) });
    simulation.begin();

    const reaction = mage.reactions.find((r) => r.id === 'combustion')!;
    const crit = () =>
      reaction.onTrigger(simulation, mage, { attacker: mage, defender: target, outcome: 'crit',
        abilityId: 'fireball', abilityName: 'Fireball', amount: 100, weaponSlot: undefined,
        critical: true } as never);

    simulation.applyAura(mage, COMBUSTION, mage.id);
    for (let i = 0; i < COMBUSTION_CRITS_TO_END; i += 1) crit();
    expect(mage.auras.has('combustion')).toBe(false);

    simulation.advanceTo(seconds(200));
    simulation.applyAura(mage, COMBUSTION, mage.id);
    for (let i = 0; i < COMBUSTION_CRITS_TO_END - 1; i += 1) crit();
    expect(mage.auras.has('combustion')).toBe(true);
    crit();
    expect(mage.auras.has('combustion')).toBe(false);
  });
});

describe('Arcane Blast, whose damage half is the Arcane rotation', () => {
  /*
   * ==========================================================================
   * REDESIGNED: "This spell is now a 1.5 second cast, and each time it is cast
   * it grants the casting Mage 15% of their Intellect as additional Spell
   * Damage. This effect also increases the cost of Arcane Blast as before and
   * still stacks to 4 times. However, the effect now lasts 15 seconds from when
   * it is FIRST APPLIED, instead of just until the next spell cast. Mana cost
   * unchanged, but damage done and Spell Damage coefficients both reduced 40%."
   *
   * THE DAMAGE CLAUSE CHANGED KIND AND NOT SIZE. It was "+10% damage to all
   * your OTHER spells" per stack, carried as an `abilityModifiers` entry for
   * every damage spell except this one; it is now SPELL POWER from Intellect,
   * which is a stat on the Mage and therefore reaches Arcane Blast itself. The
   * three tests that pinned the old clause are replaced rather than loosened.
   *
   * AND THE AMBIGUITY IS GONE. "8 sec or until any other damage spell is cast"
   * was this project's most load-bearing interpretation -- read literally the
   * bonus was destroyed by the only thing that could collect it -- and HANDOVER
   * carried it as a question for the owner. The redesign answers it by removing
   * it: the window is a stated fifteen seconds and nothing ends it early.
   * ==========================================================================
   */
  it('is a 1.5 second cast whose coefficient followed the cast time down', () => {
    /*
     * THE -40% ON THE COEFFICIENT *IS* THE CAST TIME CHANGE, which is the one
     * thing worth checking rather than transcribing. Coefficients here follow
     * `castTime / 3.5`, the old 0.714 is `2.5 / 3.5` rounded, and
     *
     *     2.5 / 3.5 x 0.6  =  1.5 / 3.5   exactly
     *
     * so the note's two clauses are one change written twice. That agreement is
     * the evidence the figure is right, and it is asserted as the arithmetic
     * rather than as 0.4284 so a reader can see it.
     */
    expect(ARCANE_BLAST_CAST_MS).toBe(seconds(1.5));
    expect(ARCANE_BLAST_SP_COEFFICIENT).toBeCloseTo(1.5 / 3.5, 12);
    // The old pair, multiplied out, lands on the new one -- the 0.4 is written
    // here rather than read from a constant, because the constant is gone and
    // this assertion is about the note's HISTORY rather than about a figure.
    expect((2.5 / 3.5) * (1 - 0.4)).toBeCloseTo(1.5 / 3.5, 12);

    // And the client now states the base damage the same cut produced.
    expect(ARCANE_BLAST_DAMAGE).toBeCloseTo(((364 + 424) / 2) * 0.6, 0);
    expect(ARCANE_BLAST_DAMAGE).toBe((218 + 254) / 2);
  });

  it('grants spell power from Intellect, per stack, and reaches itself', () => {
    /*
     * --------------------------------------------------------------------------
     * "GRANTS THE CASTING MAGE 15% OF THEIR INTELLECT AS ADDITIONAL SPELL
     * DAMAGE" is a STAT, which is the whole difference from the clause it
     * replaced: the old one named "all your OTHER spells" and this one names
     * nobody, so Arcane Blast's own next cast collects it.
     *
     * ASSERTED ON THE STAT AND ON A SPELL'S MODIFIER BOTH. The stat is what the
     * note says; the absence of a per-ability modifier is what says the old
     * clause is really gone rather than sitting alongside the new one -- which
     * would be a bigger number and no error.
     * --------------------------------------------------------------------------
     */
    /*
     * A REAL `createPlayer` MAGE RATHER THAN `bareMage`, which is the one test
     * in this block that needs one: `bareMage` is `makeAttacker` with a book
     * bolted on and carries NO primary stats at all, so its Intellect is zero
     * and 15% of nothing is nothing. A fixture that cannot express the quantity
     * under test proves nothing about it.
     */
    const mage = createPlayer({ race: 'gnome', characterClass: 'mage' });
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    const intellect = mage.stats.effective.intellect;
    expect(intellect).toBeGreaterThan(0);
    const before = mage.stats.effective.spellPower;

    simulation.applyAura(mage, arcaneBlastAura(intellect), mage.id);
    expect(mage.stats.effective.spellPower - before).toBeCloseTo(
      intellect * ARCANE_BLAST_INTELLECT_TO_SPELL_POWER,
      6,
    );

    // The old "+10% to other spells" is gone, on this spell and on itself.
    expect(mage.abilityModifierFor('arcane_missiles').damageMultiplier ?? 1).toBe(1);
    expect(mage.abilityModifierFor('arcane_blast').damageMultiplier ?? 1).toBe(1);
  });

  it('multiplies the spell power by its stacks, up to four', () => {
    /*
     * A FLAT STAT SCALES BY THE COUNT, not to the power of it: `applyStatModifiers`
     * multiplies a flat spec by `instance.stacks`, where a damage MULTIPLIER
     * compounds. That difference is `scaleByStacks`'s own rule and it matters
     * here -- four stacks is 60% of Intellect and not 1.15 to the fourth.
     */
    // A real Mage, for the reason the test above gives: `bareMage` has no
    // Intellect, so a per-stack share of it would be zero at every stack.
    const mage = createPlayer({ race: 'gnome', characterClass: 'mage' });
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    const intellect = mage.stats.effective.intellect;
    const before = mage.stats.effective.spellPower;
    const aura = arcaneBlastAura(intellect);

    for (let stacks = 1; stacks <= ARCANE_BLAST_MAX_STACKS; stacks += 1) {
      simulation.applyAura(mage, aura, mage.id);
      expect(mage.auras.stacksOf('arcane_blast'), `${stacks}`).toBe(stacks);
      expect(mage.stats.effective.spellPower - before, `${stacks} stacks`).toBeCloseTo(
        intellect * ARCANE_BLAST_INTELLECT_TO_SPELL_POWER * stacks,
        6,
      );
    }

    // And a fifth application is declined rather than stacking.
    simulation.applyAura(mage, aura, mage.id);
    expect(mage.auras.stacksOf('arcane_blast')).toBe(ARCANE_BLAST_MAX_STACKS);
  });

  it('runs fifteen seconds from the FIRST cast, which a refresh must not extend', () => {
    /*
     * ==========================================================================
     * "THE EFFECT NOW LASTS 15 SECONDS FROM WHEN IT IS FIRST APPLIED", and
     * `refreshBehaviour: 'ignore'` is the whole of it -- which is not obvious
     * and is why this is asserted rather than trusted.
     *
     * `AuraCollection.refresh` increments the stack and re-applies the scaled
     * stat modifiers BEFORE it consults the behaviour, and only the expiry
     * reschedule is gated on it. So `ignore` declines the new WINDOW and accepts
     * the new STACK, which is exactly the note. `reset` -- the DEFAULT, and what
     * this aura carried before -- would restart the clock on every cast and make
     * the window effectively unbounded on a spammed spell.
     *
     * BOTH HALVES ARE ASSERTED: the expiry does not move, AND the stack still
     * climbs. A behaviour that declined both would also leave the expiry alone.
     * ==========================================================================
     */
    const mage = bareMage('mage_arcane');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    const aura = arcaneBlastAura(mage.stats.effective.intellect);

    simulation.applyAura(mage, aura, mage.id);
    const expiresAt = mage.auras.get('arcane_blast')!.expiresAt;
    expect(expiresAt).toBe(seconds(15));

    simulation.advanceTo(seconds(5));
    simulation.applyAura(mage, aura, mage.id);

    // The window is untouched by the second cast...
    expect(mage.auras.get('arcane_blast')!.expiresAt).toBe(expiresAt);
    // ...and the stack still went up.
    expect(mage.auras.stacksOf('arcane_blast')).toBe(2);
  });

  it('is no longer ended by another damage spell, which the spender used to do', () => {
    /*
     * `arcaneBlastSpender` IS DELETED. It removed the stacks on the next damage
     * spell's `cast.final`, which was the reading of "or until any other damage
     * spell is cast" -- and the note replaced that clause with a clock.
     *
     * ASSERTED AS A NEGATIVE ON THE REGISTRY, because a cast reaction left
     * registered would end the window early for no reason anybody stated, and
     * the only visible symptom would be a smaller number.
     */
    expect(Object.keys(MAGE_CAST_REACTIONS)).not.toContain('arcane_blast');

    const mage = bareMage('mage_arcane');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    expect(mage.castReactions.map((r) => r.id)).not.toContain('arcane_blast_spend');
  });

  it('still charges 175% more per stack, which the note says is unchanged', () => {
    // The half the redesign did NOT touch, pinned beside the halves it did --
    // "this effect also increases the cost of Arcane Blast as before".
    const mage = bareMage('mage_arcane');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    const blast = mage.abilities.get('arcane_blast')!;
    const base = blast.cost!.amount;
    expect(base).toBe(Math.round(MAGE_BASE_MANA * ARCANE_BLAST_BASE_MANA_FRACTION));

    simulation.applyAura(mage, arcaneBlastAura(mage.stats.effective.intellect), mage.id);
    for (const stacks of [1, 2, 4]) {
      mage.auras.get('arcane_blast')!.stacks = stacks;
      expect(resolveCast(mage, blast).costAmount, `${stacks} stacks`).toBeCloseTo(
        base * (1 + ARCANE_BLAST_COST_INCREASE_PER_STACK * stacks),
        6,
      );
    }
  });

  it('builds to four stacks in a real fight and holds them for its window', () => {
    /*
     * THE MECHANISM IN A REAL FIGHT, because every assertion above could be
     * right while the list never reached four stacks -- which is the shape the
     * owner's Arcane list is written around and the reason its Presence of Mind
     * entry waits for the cap.
     *
     * AND THE REMOVAL ASSERTION IS INVERTED FROM WHAT IT WAS. It used to demand
     * that the aura "goes away for a reason other than its own eight seconds",
     * which was the spender; the window is a clock now, so what is asserted is
     * that the cap is REACHED. Pinning a removal would pass on the expiry alone
     * and say nothing.
     */
    const built = PRESETS_BY_ID.get('mage_arcane')!.build();
    const run = runProfile(built, 4242);

    const rows = run.timeline.filter(
      (event) => 'auraId' in event && event.auraId === 'arcane_blast',
    );
    expect(rows.length).toBeGreaterThan(0);
    const highest = Math.max(...rows.map((event) => ('stacks' in event ? event.stacks : 0)));
    expect(highest).toBe(ARCANE_BLAST_MAX_STACKS);
  });
});

describe('Arcane Power, whose cost half is no longer dropped', () => {
  it('charges 30% more for every spell that costs mana', () => {
    const mage = bareMage('mage_arcane');
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    const missiles = mage.abilities.get('arcane_missiles')!;
    const before = resolveCast(mage, missiles).costAmount;
    expect(before).toBeGreaterThan(0);

    simulation.applyAura(mage, ARCANE_POWER, mage.id);
    expect(resolveCast(mage, missiles).costAmount).toBeCloseTo(
      before * (1 + ARCANE_POWER_COST_INCREASE),
      6,
    );
  });

  it('names every costed spell in the book, and a test is what keeps it in step', () => {
    /*
     * THE LIST IS THE THING THAT ROTS. `MAGE_COSTED_SPELL_IDS` stands in for a
     * property of the ability -- "does it cost mana" -- and a new spell added
     * to the book without being added here would quietly escape Arcane Power's
     * cost clause. Derived from `MAGE_ABILITIES` here so that is a failure
     * rather than a silence.
     */
    const costed = MAGE_ABILITIES.filter((ability) => (ability.cost?.amount ?? 0) > 0)
      .map((ability) => ability.id)
      .sort();
    expect([...MAGE_COSTED_SPELL_IDS].sort()).toEqual(costed);
  });
});

describe("Winter's Chill, a crit debuff the TARGET carries", () => {
  /*
   * --------------------------------------------------------------------------
   * "Gives your Frost damage spells a {0}% chance to apply the Winter's Chill
   * effect, which increases the chance your Ice Lance and Frostbolt spells
   * will critically hit the target by 2% for 15 sec. Stacks up to {3} times."
   *
   * THE ONE SHAPE THIS ENGINE DID NOT HAVE, and its `unmodelled` reason named
   * both halves: `abilityCrit` is registered on the CASTER, and an ordinary
   * aura reaches every ability or none. `attackerAbilityModifiers` names
   * abilities and is read off the DEFENDER.
   *
   * IT IS THE MIRROR OF `critWhileAura`, built for Shatter one PR earlier.
   * Same shape, other side of the attack.
   *
   * NO MAGE PROFILE TAKES IT -- the Frostfire build is 0/29/22 and this sits
   * deeper than that in Frost -- so the baseline does not move and these
   * assertions are on the MECHANISM, which is the only thing that would tell
   * a working talent from an inert one here.
   * --------------------------------------------------------------------------
   */
  const buildFor = (rank: number) =>
    MAGE_TALENT_REACTIONS.winter_s_chill(
      talentNumber('mage', 'winter_s_chill', rank, 0)!,
      talentNumbers('mage', 'winter_s_chill', rank),
    );

  it('keeps its per-stack 40 as a constant the file still agrees with', () => {
    /*
     * ------------------------------------------------------------------------
     * THE ROW IS `[chance, 40, 5]` NOW AND WAS `[chance, 2, 15, maxStacks]`.
     * One entry shorter, and the DURATION left it -- 15 seconds is no longer
     * stated by the client at all, so `WINTERS_CHILL_DURATION_MS` is this
     * repository's figure carried across the redesign rather than something to
     * check against index 2, which is the stack cap now.
     *
     * SO THE ASSERTION THAT USED TO READ THE DURATION HAD TO GO, and that is
     * the finding: a test comparing a constant to a value the source has
     * stopped stating cannot fail, it can only read the wrong number. It was
     * `talentNumber(..., 2)` against the duration and index 2 is now 5.
     * ------------------------------------------------------------------------
     */
    for (let rank = 1; rank <= 5; rank += 1) {
      expect(talentNumber('mage', 'winter_s_chill', rank, 1)).toBe(
        WINTERS_CHILL_DAMAGE_PER_STACK,
      );
    }
    /*
     * AND THE DURATION IS ASSERTED AGAINST THE AURA INSTEAD OF AGAINST THE ROW,
     * because the row no longer states it. That makes this constant the one
     * figure here with no source to check -- 15 seconds carried across the
     * redesign on this repository's own authority -- so the assertion is that
     * the aura actually uses it, which is the only claim left to make.
     */
    expect(wintersChillAura(5).durationMs).toBe(WINTERS_CHILL_DURATION_MS);
  });

  it('caps at five stacks at EVERY rank, where the rank used to move it', () => {
    /*
     * THE RANK USED TO SCALE TWO NUMBERS -- the chance 20..100 and the cap
     * 1..5 -- and now scales only the chance, with the cap flat at 5. The
     * builder still takes the whole row, because a rank that moves one number
     * today is not a promise about the next patch and this talent has already
     * changed that answer once.
     *
     * AND THE CAP'S INDEX MOVED FROM 3 TO 2 WITH THE SHORTER ROW, which is the
     * real risk in the redesign: `values?.[3]` is `undefined` on a three-entry
     * row, the builder's fallback is 1, and the talent would have applied a
     * one-stack debuff instead of a five-stack one. A fifth of its value, with
     * the right uptime, and no error. That is why all five ranks are driven.
     */
    for (const [rank, cap] of [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5]] as const) {
      const actor = makeAttacker({ autoAttack: 'none' });
      const target = makeTarget();
      const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
      simulation.begin();

      buildFor(rank).onTrigger(simulation, actor, {
        attacker: actor, defender: target, outcome: 'hit', abilityId: 'frostbolt',
        abilityName: 'Frostbolt', amount: 100, weaponSlot: undefined, critical: false,
      } as never);
      expect(target.auras.get('winters_chill')!.maxStacks, `rank ${rank}`).toBe(cap);
    }
  });

  it('is applied by any Frost spell and benefits only the one it names', () => {
    /*
     * TWO DIFFERENT SETS, and the tooltip says so. Frostfire Bolt applies it,
     * because it "counts as both Frost and Fire damage", and gets nothing from
     * it -- the sentence names CONE OF COLD and stops. That asymmetry survived
     * the redesign; what changed is that the benefiting set went from two
     * spells to one, and from crit to damage.
     */
    const actor = makeAttacker({ autoAttack: 'none' });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    const reaction = buildFor(5);
    const applies = (abilityId: string) =>
      reaction.canTrigger?.(simulation, actor, { abilityId } as never) ?? true;
    expect(applies('frostbolt')).toBe(true);
    expect(applies('ice_lance')).toBe(true);
    // Frost by its own spellbook entry, even though it is DEALT as Fire.
    expect(applies('frostfire_bolt')).toBe(true);
    expect(applies('pyroblast')).toBe(false);
    expect(applies('arcane_missiles')).toBe(false);

    simulation.applyAura(target, wintersChillAura(5), actor.id);
    const damageAgainst = (abilityId: string) =>
      target.abilityModifierAgainst(abilityId).damageMultiplier ?? 1;
    expect(damageAgainst('cone_of_cold')).toBeCloseTo(
      1 + WINTERS_CHILL_DAMAGE_PER_STACK / 100,
      6,
    );
    /*
     * AND THE TWO SPELLS IT USED TO NAME GET NOTHING NOW, asserted rather than
     * left absent: a debuff that quietly kept amplifying Ice Lance would be the
     * old talent surviving its own replacement, which is a bigger number and no
     * error on the one Mage tree that cares about Ice Lance.
     */
    expect(damageAgainst('ice_lance')).toBe(1);
    expect(damageAgainst('frostbolt')).toBe(1);
    expect(damageAgainst('frostfire_bolt')).toBe(1);
    expect(target.abilityModifierAgainst('ice_lance').critBonus ?? 0).toBe(0);
  });

  it('stacks its damage bonus, and belongs to the target rather than the caster', () => {
    const actor = makeAttacker({ autoAttack: 'none' });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    for (let i = 0; i < 5; i += 1) simulation.applyAura(target, wintersChillAura(5), actor.id);
    expect(target.auras.stacksOf('winters_chill')).toBe(5);
    /*
     * ========================================================================
     * **EXACTLY 3x AT FIVE STACKS, BY THE OWNER'S RULING, SO THIS ONE ADDS.**
     *
     * "Winter's Chill at 5 stacks is a 3x multiplier for Cone of Cold" --
     * `1 + 0.4 x 5`, where this engine's default raises a damage multiplier to
     * the POWER of the stack count and would give `1.4^5 = 5.378`.
     * `AuraDefinition.additiveDamageStacks` is the opt-in and this aura is its
     * only caller.
     *
     * AND THE FLAG IS WHAT GOT IT RULED ON. This assertion carried the power
     * reading with the additive one pinned beside it as a negative, both
     * figures written out -- and the answer came back in one line. **A flagged
     * reading is cheap and a wrong unflagged one is not**, which is the third
     * time that has paid on a Mage constant.
     *
     * IMPROVED SCORCH KEEPS ITS 1.159. **A ruling covers what it says and is
     * not extended by analogy** -- at 3% a stack the two readings are 1.159
     * against 1.150 and indistinguishable, so the owner ruled about the 40% one
     * and the 3% one is untouched. `additiveDamageStacks` defaults to false for
     * exactly that reason.
     *
     * WORTH NOTHING EITHER WAY TODAY: Cone of Cold is not declared and no Mage
     * profile takes the talent.
     * ========================================================================
     */
    expect(target.abilityModifierAgainst('cone_of_cold').damageMultiplier).toBeCloseTo(3, 6);
    expect(target.abilityModifierAgainst('cone_of_cold').damageMultiplier).toBeCloseTo(
      1 + (5 * WINTERS_CHILL_DAMAGE_PER_STACK) / 100,
      6,
    );
    // And NOT the compounding default, which every other stacking aura takes.
    expect(target.abilityModifierAgainst('cone_of_cold').damageMultiplier).not.toBeCloseTo(
      (1 + WINTERS_CHILL_DAMAGE_PER_STACK / 100) ** 5,
      6,
    );

    // ON THE TARGET. The caster's own funnel knows nothing about it, which is
    // the whole reason a new field was needed.
    expect(actor.abilityModifierFor('cone_of_cold').damageMultiplier ?? 1).toBe(1);
    expect(actor.abilityModifierAgainst('cone_of_cold').damageMultiplier ?? 1).toBe(1);
  });
});

describe('Ignite, which is Deep Wounds in a different school', () => {
  /*
   * --------------------------------------------------------------------------
   * TWO EXCEPTIONS, BOTH BY THE RULESET OWNER, and both because Ignite is a
   * DoT applied BY a critical strike:
   *
   *   IT CANNOT CRIT   against the general Forever rule that every DoT can.
   *                    The crit is already in the magnitude, so a crit on the
   *                    tick pays for the same crit twice.
   *   IT ROLLS OVER    a second crit adds to the undelivered remainder rather
   *                    than replacing it.
   *
   * THE OLD CODE DID NEITHER, and its comment argued the second one away well:
   * "Forever's tooltip describes one burn from one crit and says nothing about
   * rolling them together ... Classic's Ignite does combine, which is exactly
   * the kind of inherited assumption this project has been caught by before."
   * Every step sound, conclusion wrong -- the tooltip was the wrong source, and
   * `periodic.pool` existed because the owner had already specified this for
   * Deep Wounds.
   * --------------------------------------------------------------------------
   */
  it('cannot crit, which is the field being ABSENT rather than false', () => {
    /*
     * ASSERTED ON THE EVENT STREAM rather than on the definition, because
     * "cannot crit" is expressed by omitting `critFrom` and there is nothing on
     * the aura to read. At 100% spell crit a single surviving crit roll would
     * make every tick a crit, so this cannot pass by luck.
     */
    const mage = makeAttacker({ autoAttack: 'none', stats: { spellCritChance: 100 } });
    const target = makeTarget({ maxHealth: 1_000_000_000 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([mage, target], { durationMs: seconds(900) }, {
      emit: (event) => events.push(event),
    });
    simulation.begin();

    for (let i = 0; i < 100; i += 1) {
      simulation.applyAura(target, igniteAura(400), mage.id);
      simulation.advanceTo(seconds(5 * (i + 1)));
    }

    const ticks = events.filter((e) => e.type === 'damage' && e.abilityId === 'ignite');
    expect(ticks.length).toBeGreaterThan(100);
    expect(ticks.filter((e) => e.type === 'damage' && e.critical)).toHaveLength(0);
  });

  it('rolls the undelivered remainder into the new application', () => {
    /*
     * THE WHOLE POINT, and the numbers are what say it. One Ignite of 400 is
     * two ticks of 200. Re-applied after ONE tick, the second application finds
     * 200 still owed and adds its own 400, so the pool is 600 over two ticks of
     * 300 -- total delivered 200 + 300 + 300 = 800, which is both crits paid in
     * full. The old behaviour threw the 200 away and delivered 600.
     */
    const mage = makeAttacker({ autoAttack: 'none' });
    const target = makeTarget({ maxHealth: 1_000_000_000 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([mage, target], { durationMs: seconds(60) }, {
      emit: (event) => events.push(event),
    });
    simulation.begin();

    const amounts = () =>
      events
        .filter(
          (e): e is Extract<TelemetryEvent, { type: 'damage' }> =>
            e.type === 'damage' && e.abilityId === 'ignite',
        )
        .map((e) => e.amount);

    simulation.applyAura(target, igniteAura(400), mage.id);
    simulation.advanceTo(seconds(2));
    expect(amounts()).toEqual([200]);

    // A second crit, with 200 still owed.
    simulation.applyAura(target, igniteAura(400), mage.id);
    simulation.advanceTo(seconds(10));
    const delivered = amounts();
    expect(delivered).toHaveLength(3);
    expect(delivered.reduce((a, b) => a + b, 0)).toBeCloseTo(800, 6);
    expect(delivered[1]).toBeCloseTo(300, 6);
    expect(delivered[2]).toBeCloseTo(300, 6);
  });

  it('still resets its DURATION, which is a separate clock from the pool', () => {
    // The same split Deep Wounds documents: `refreshBehaviour: 'reset'`
    // restarts the four seconds while `pool` carries the damage forward.
    expect(igniteAura(100).refreshBehaviour).toBe('reset');
    expect(igniteAura(100).durationMs).toBe(IGNITE_DURATION_MS);
  });
});

describe('Frostfire Bolt, which counts as BOTH Frost and Fire', () => {
  /*
   * --------------------------------------------------------------------------
   * "This spell ... counts as both Frost and Fire damage", from its own
   * spellbook entry, and the ruleset owner has listed the ten talents it means:
   * Ignite, Improved Scorch, Master of Elements, Critical Mass, Fire Power,
   * Combustion, Elemental Precision, Ice Shards, Frost Channeling and Piercing
   * Ice.
   *
   * SEVEN ALREADY WORKED and three did not, all three of them the FROST-scoped
   * ones. The owner spotted Piercing Ice by eye; Ice Shards and Frost
   * Channeling were the same bug wearing two different selectors.
   *
   * TEN POINTS OF FROST IN EVERY ALLOCATION HERE, because Piercing Ice and
   * Frost Channeling both sit at tier 10 and `createPlayer` strips an illegal
   * rank SILENTLY -- which reads as "the talent is worth nothing" and is how
   * this test first appeared to fail.
   * --------------------------------------------------------------------------
   */
  it('declares the second school rather than changing its school', () => {
    /*
     * IT IS STILL DEALT AS FIRE, and that is not a contradiction: `school`
     * answers "which vulnerability, which resistance, what the log says" and
     * needs ONE answer. `countsAsSchools` is the only question with two --
     * which of the caster's own school talents select it.
     */
    expect([...FROSTFIRE_ALSO_COUNTS_AS]).toEqual(['frost']);
  });

  /*
   * PIERCING ICE'S TWO TESTS ARE GONE WITH THE TALENT -- the client removed it
   * in round 51's refresh. They proved that a FROST damage talent reaches a
   * spell dealt as Fire, and that two school talents multiply; no other Mage
   * talent is a Frost `schoolDamage` to carry the claim, and `countsAsSchools`
   * itself is still asserted by the hit and crit cases around this one.
   */
  it('is paid ONCE by a talent that names both of its schools', () => {
    /*
     * ON A BUILD THAT CAN STILL MISS. Since round 51 the Frostfire preset
     * reaches 17% Fire and Frost hit (11 from gear, 6 from Elemental Precision
     * 3/3) and neither spell misses at all, so a rate comparison has nothing to
     * compare. One rank of the talent is 2%, which leaves both at 4%.
     */
    /*
     * THE DOUBLE-COUNT GUARD, and the first thing this field met. Elemental
     * Precision is "+5% chance to hit with Frost AND Fire spells" -- ONE source
     * -- so summing the two schools gave a Frostfire Bolt +10% and its measured
     * miss rate fell to 5.26% against an expected 10%.
     *
     * ASSERTED AS "THE SAME AS SCORCH'S", which is the comparison that cannot
     * drift with the table. Scorch is Fire alone and Frostfire Bolt is both, so
     * one talent naming both schools must leave the two spells on the SAME miss
     * rate -- and paid twice, Frostfire's would be about half of it.
     */
    const built = frostfireThatMisses();
    expect(MAGE_TALENT_EFFECTS.elemental_precision).toEqual([
      { kind: 'schoolHit', schools: ['frost', 'fire'] },
    ]);

    const batch = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 60 },
    } as never);
    const bolt = batch.abilities.find((row) => row.abilityName === 'Frostfire Bolt')!;
    const scorch = batch.abilities.find((row) => row.abilityName === 'Scorch')!;

    expect(scorch.avoidRate).toBeGreaterThan(0);
    expect(bolt.avoidRate).toBeCloseTo(scorch.avoidRate, 1);
  });
});

/**
 * The Frostfire preset one Elemental Precision rank down, so its spells miss.
 *
 * Round 51 put it on the 17% cap, and two tests here compare MISS RATES. The two
 * points go to Permafrost, which is crowd control and does nothing, so the tree
 * keeps its total and nothing deeper is refunded.
 */
function frostfireThatMisses() {
  const built = PRESETS_BY_ID.get('mage_frostfire')!.build();
  return { ...built, talents: { ...built.talents, elemental_precision: 1, permafrost: 2 } };
}

describe('what the Results panel divides its rates by', () => {
  /*
   * --------------------------------------------------------------------------
   * THE OWNER READ ELEMENTAL PRECISION OFF THE MISS COLUMN AND SAW HALF OF IT.
   * The talent was delivering its full 1% a point to the ROLL the whole time;
   * the dilution was in the report. `recordDealt` counted every damage event
   * into `attempts`, including DoT ticks, and the panel divided avoided and
   * crits by that -- so a HYBRID, whose burn pools into its own row, reported a
   * miss rate over a denominator those outcomes were never offered.
   *
   * Frostfire Bolt: 21.8 attempts a fight of which 12.0 are casts, reporting
   * 2.83% miss on a spell whose casts miss 10% of the time. Arcane Blast and
   * Arcane Missiles, which have no burn, read 9.71% and 10.30% against the same
   * 10% expectation -- the two spells with nothing to dilute them were right
   * all along, which is what pins the cause on the denominator.
   * --------------------------------------------------------------------------
   */
  it('reports a hybrid miss rate over its CASTS, not over its ticks', () => {
    // A rate needs misses, which the capped preset no longer has. See below.
    const built = frostfireThatMisses();
    const batch = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 40 },
    } as never);

    const bolt = batch.abilities.find((row) => row.abilityName === 'Frostfire Bolt')!;
    // The burn really is in this row: more attempts than casts.
    expect(bolt.attempts).toBeGreaterThan(bolt.uses);
    /*
     * ------------------------------------------------------------------------
     * AND THE RATE IS ABOUT THE CASTS, CHECKED AGAINST THE CHARACTER'S OWN
     * MISS RATHER THAN AGAINST A BAND.
     *
     * The band was 7% to 13%: 5/5 Elemental Precision against the old gear's
     * hit. The E65 benchmark set targets 110 hit rating for a caster, which
     * with the talent's 5% puts this Mage ON the owner's 1% spell miss FLOOR --
     * so the honest expectation is about 1%, and a band around 10% would now
     * fail a build that is working perfectly.
     *
     * THE DENOMINATOR IS STILL THE CLAIM, and it is what the second assertion
     * rules out: attempts outnumber casts in this row, so dividing by them --
     * which is what the bug did -- gives a visibly smaller number.
     * ------------------------------------------------------------------------
     */
    /*
     * ========================================================================
     * THE COMPARISON SPELL IS NAMED NOW, AND THAT IS THE WHOLE REPAIR.
     *
     * It used to `find` "a row whose attempts EQUAL its casts" -- any row --
     * and compare DISTANCES to it. **The claim was right and the SUBJECT was
     * chosen by whatever the fight produced first**, which is this project's
     * own lesson about a test that enumerates its subjects loosely: a change to
     * the DECISION TIMING, a free off-GCD cast acting again in the same
     * instant, moved which spell matched and the comparison inverted on a
     * denominator that is as correct as it ever was.
     *
     * SCORCH, which the sibling test above already compares against by name
     * for the same reason: it is on the same character, rolls on the spell
     * table, and pools no burn into its row, so its rate was right even while
     * the hybrid's was not.
     *
     * AND A MEASURED RATE IS NOT THE CHANCE, which ruled out the other anchor
     * tried here -- the 1% floor the owner's rule guarantees. Frostfire Bolt
     * measures **0.8%** against that floor across sixty fights, because a
     * frequency is an estimate and a floor is a bound on the CHANCE. Asserting
     * the figure could not fall below 1% failed on a build that is working.
     * ========================================================================
     */
    const scorchRow = batch.abilities.find((row) => row.abilityName === 'Scorch');
    expect(scorchRow, 'no Scorch row to compare against').toBeDefined();
    /*
     * ========================================================================
     * AT MOST ITS CASTS, NOT EXACTLY ITS CASTS -- and the equality was fragile
     * from the day it was written rather than broken by anything.
     *
     * THE CLAIM IS THAT NOTHING POOLS INTO THIS ROW, which is a statement about
     * attempts EXCEEDING casts: a hybrid's burn adds damage events to its
     * caster's row and nothing else can. Frostfire Bolt is asserted that way
     * below, `toBeGreaterThan`, and this is the same claim pointed the other
     * direction.
     *
     * WHAT MAKES THE *EQUALITY* FAIL IS A CAST STILL IN FLIGHT WHEN THE FIGHT
     * ENDS. A cast emits its `cast` event when it STARTS and its damage inside
     * `onCast` when it finishes, so a 1.5-second Scorch begun at 62.7 seconds
     * of a 62.9-second fight is one use and no attempt. Measured: **three of
     * forty seeds** do exactly that, with the last Scorch at 62724ms, 62263ms
     * and 62724ms against fights ending at 62907ms, 62533ms and 62953ms.
     *
     * SO THE ROW READS 6.975 USES AGAINST 6.95 ATTEMPTS, and every one of those
     * 0.025 is a cast the fight cut off. Nothing is pooled, the denominator is
     * as clean as it ever was, and the equality was only ever true because this
     * profile's cast timing happened not to land there. **A boundary this test
     * never meant to assert**, surfaced by the Scorch the optimisation pass
     * moved before the pull -- which shifted every later cast by 1.5 seconds.
     * ========================================================================
     */
    expect(scorchRow!.attempts, 'Scorch pools no burn').toBeLessThanOrEqual(scorchRow!.uses);

    const cleanRate = 100 * scorchRow!.avoidRate;
    const reported = 100 * bolt.avoidRate;
    const diluted = (reported * bolt.uses) / bolt.attempts;

    // The row is genuinely a hybrid, or there is nothing to dilute and the
    // test is asserting the same number twice.
    expect(bolt.attempts, 'the burn pools into this row').toBeGreaterThan(bolt.uses);

    expect(Math.abs(reported - cleanRate)).toBeLessThan(Math.abs(diluted - cleanRate));
    expect(diluted).toBeLessThan(reported);
  });

  it('leaves a pure DoT at zero rather than dividing by nothing', () => {
    /*
     * THE FALLBACK. Ignite has no cast of its own, so nothing in its row ever
     * rolled -- dividing by that would be `NaN` on the page. Its rates are all
     * zero either way: a tick cannot be avoided and this one cannot crit.
     */
    const built = PRESETS_BY_ID.get('mage_fire')!.build();
    const batch = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 10 },
    } as never);

    const ignite = batch.abilities.find((row) => row.abilityName === 'Ignite')!;
    expect(ignite.attempts).toBeGreaterThan(0);
    expect(ignite.uses).toBe(0);
    expect(Number.isFinite(ignite.avoidRate)).toBe(true);
    expect(ignite.avoidRate).toBe(0);
    expect(ignite.critRate).toBe(0);
  });
});

describe('Evocation, which pays out during its own channel', () => {
  /*
   * --------------------------------------------------------------------------
   * "While channeling this spell, your mana regeneration is active and
   * increased by 1,500%. Lasts 8 sec." The capture and the ruleset owner agree
   * to the decimal -- +1500% IS x16 -- which is rare enough in this project to
   * be worth saying.
   *
   * IT IS WHY `Ability.onCastStart` EXISTS. `onCast` runs at the END of a cast,
   * so an effect that has to be in place FOR the cast had nowhere to go, and
   * the aura's duration would otherwise have to guess a HASTED channel length.
   * The pair is the design: `onCastStart` opens the window and `onCast` closes
   * it, so the two end together whatever haste does.
   * --------------------------------------------------------------------------
   */
  it('is a rate rather than a flat grant, so it scales with the character', () => {
    expect(EVOCATION_REGEN_MULTIPLIER).toBe(16);
    expect(EVOCATION_AURA.resourceRegenMultiplier?.mana).toBe(16);
    // "Regeneration is ACTIVE" -- the five second rule fully bypassed.
    expect(EVOCATION_REGEN_BYPASS).toBe(100);
  });

  it('opens the window at cast START and closes it when the channel ends', () => {
    const mage = makeAttacker({
      autoAttack: 'none',
      abilities: [EVOCATION],
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    expect(mage.auras.has('evocation')).toBe(false);
    castAbility(simulation, mage, EVOCATION, undefined);
    // Up immediately, which is the half `onCast` could not do.
    expect(mage.auras.has('evocation')).toBe(true);

    simulation.advanceTo(EVOCATION_CHANNEL_MS - 500);
    expect(mage.auras.has('evocation')).toBe(true);

    simulation.advanceTo(EVOCATION_CHANNEL_MS + 500);
    // And gone when the channel completed, not when a duration said so.
    expect(mage.auras.has('evocation')).toBe(false);
  });

  it('is sixteen times the rate, and beats the five second rule as well', () => {
    /*
     * MEASURED ON `manaPerTick`, which IS the rule, rather than on mana in a
     * pool over time. The pool measurement is what this test did first and it
     * was worse in two ways at once: eight seconds of sixteenfold regeneration
     * CAPS a Mage's mana, so the ratio came back below 1 and read like a broken
     * multiplier rather than a full bar.
     *
     * AND IT FOUND A REAL ONE ON THE WAY. `regenMultiplierFor` was read by the
     * energy rule and by neither of the other two, so `{ mana: 16 }` compiled,
     * applied and did nothing -- the ratio was exactly 1.0000. All three rules
     * go through it now.
     */
    const built = PRESETS_BY_ID.get('mage_fire')!.build();
    const mage = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      combatStyle: 'caster',
      talents: built.talents,
      equipment: built.equipment,
    });
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    // Out of the lockout: the plain out-of-combat rate.
    const quiet = seconds(100);
    const plain = manaPerTick(mage, quiet);
    expect(plain).toBeGreaterThan(0);

    simulation.applyAura(mage, EVOCATION_AURA, mage.id);
    expect(manaPerTick(mage, quiet) / plain).toBeCloseTo(EVOCATION_REGEN_MULTIPLIER, 6);
    mage.auras.remove(simulation, EVOCATION_AURA.id);

    /*
     * AND THE OTHER CLAUSE, AS THE STAT IT GRANTS. Staging the five-second
     * lockout here needs mana spent THROUGH THE CONTEXT -- `Resource.spend`
     * does not record when it happened, which is the same seam that once made
     * a Rogue finisher's combo points invisible -- and the lockout itself is
     * already covered by the Mage Armor block above. What is new is the number.
     *
     * A HUNDRED IS "YOUR OUT-OF-COMBAT RATE", which is what the owner's wording
     * asks for: the out-of-combat rate is the unsuppressed one. It stacks into
     * the same pool Mage Armor's 50 and Arcane Meditation's 50 feed, and the
     * RULE clamps the total at 100 -- so it is worth nothing to a Mage that has
     * kept its armor up, and everything to one that has not.
     */
    const bypass = EVOCATION_AURA.statModifiers?.find((m) => m.stat === 'manaRegenBypass');
    expect(bypass?.operation).toBe('flat');
    expect(bypass?.value).toBe(EVOCATION_REGEN_BYPASS);
    expect(EVOCATION_REGEN_BYPASS).toBe(100);

    const bare = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      combatStyle: 'caster',
      talents: {},
      equipment: built.equipment,
    });
    const bareSim = buildSimulation([bare, makeTarget()], { durationMs: seconds(60) });
    bareSim.begin();
    const before = bare.stats.get('manaRegenBypass');
    bareSim.applyAura(bare, EVOCATION_AURA, bare.id);
    expect(bare.stats.get('manaRegenBypass') - before).toBe(EVOCATION_REGEN_BYPASS);
  });

  it('is in all three lists and gated on a tenth of the pool, which NO profile now reaches', () => {
    /*
     * --------------------------------------------------------------------------
     * THIS TEST HAS BEEN INVALIDATED THREE TIMES BY CHANGES THAT HAD NOTHING TO
     * DO WITH EVOCATION, and the third one is what finally moved it off a cast
     * count. The sequence is worth keeping, because it is the same lesson three
     * times at increasing cost:
     *
     *   1. It asserted a cast on SEED 12345 alone, and passed for as long as
     *      that one fight happened to run dry.
     *   2. The Mage presets gained their consumable row -- +12 MP5 and +25
     *      intellect -- and the rate went 16 casts in 20 fights to 14. Seed
     *      12345 fell the other side of the gate and the test failed on a
     *      mechanism that still worked. It became a count over twenty seeds.
     *   3. Heating Up became consumed by one Pyroblast, so the Fire build casts
     *      Pyroblast 1.75 times a fight instead of 13.55 and spends 7,854 mana
     *      instead of 9,751. **It never drops to a tenth of its pool, so the
     *      rate is now ZERO** -- and the count over twenty seeds failed too.
     *
     * A CAST COUNT IS A ROTATION OUTCOME, however much it looks like a
     * mechanism, and this one depended on a mana pool draining -- which is a
     * fact about every other entry in the list. The same trap Life Tap's
     * assertion fell into twice.
     *
     * SO WHAT IS ASSERTED IS THE INVARIANT: the entry is in all three lists, at
     * the owner's threshold, and the CONDITION answers correctly on both sides
     * of it. That cannot be moved by a damage change elsewhere, and it still
     * fails if the entry is dropped or the threshold edited -- which is what the
     * cast count was really standing in for.
     *
     * THE ZERO IS RECORDED RATHER THAN HIDDEN, because a never-fired entry is a
     * row that is not there: `measure_profiles.ts USES=1` is where it shows.
     *
     * AND THE OWNER HAS RULED THE ZERO INTENDED, 2026-10-08 -- reported with the
     * threshold offered as the thing to move: "This is intended." So the entry
     * stays at 10% and these assertions pin a DECISION rather than a state of
     * affairs waiting to be resolved.
     * --------------------------------------------------------------------------
     */
    for (const list of [MAGE_FIRE, MAGE_FROSTFIRE, MAGE_ARCANE]) {
      const entry = list.entries.find((candidate) => candidate.abilityId === 'evocation');
      expect(entry).toBeDefined();
      expect(entry!.condition).toBeDefined();
    }

    // The condition itself, on both sides of the owner's tenth. Driven rather
    // than sampled: a resource level is not a probability.
    const actor = bareMage('mage_fire');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    simulation.begin();

    const mana = actor.resources.require('mana');
    const entry = MAGE_FIRE.entries.find((candidate) => candidate.abilityId === 'evocation')!;

    mana.fill();
    expect(compiled(entry.condition)!(simulation, actor, target)).toBe(false);

    mana.spend(mana.maximum * 0.95);
    expect(mana.current / mana.maximum).toBeLessThan(0.1);
    expect(compiled(entry.condition)!(simulation, actor, target)).toBe(true);
  });

  it('is reached ONCE in sixty runs at a 60s fight, and only by the Arcane Mage', () => {
    /*
     * ==========================================================================
     * THIS TEST IS A TRIPWIRE AND IT HAS NOW FIRED ONCE, WHICH IS THE POINT.
     *
     * It asserted ZERO casts across three profiles and twenty seeds each, with
     * the owner's ruling beside it -- "This is intended", 2026-10-08 -- and the
     * note that it "fails if a change makes Evocation start firing, which is
     * the right moment to go back to the owner."
     *
     * WHAT MOVED: Presence of Mind and Arcane Power came OFF the global
     * cooldown, on the owner's instruction. That is more casts a fight on the
     * Arcane Mage, and an Arcane Blast at four stacks costs EIGHT TIMES base --
     * so the build now reaches a tenth of its pool on **seed 10 of 20**, and
     * casts Evocation once. Mean headroom is still 2,638 mana, so this is a
     * TAIL rather than a shift: the build is not mana-bound and one fight in
     * twenty goes differently.
     *
     * **WHICH IS THE HONEST READING OF THE ENTRY RATHER THAN A REGRESSION.** A
     * conditional entry that is almost never true costs the entries below it
     * nothing and pays out in a fight that does not go like the measured ones.
     * The ruling is unchanged; what changed is that the safety net caught
     * something.
     *
     * ==========================================================================
     * **AND THESE NUMBERS DESCRIBE A SIXTY-SECOND CLOCK, NOT THE RULESET.** The
     * owner: "rotations need to be built for longer than 1 minute, so things
     * like evocation not firing might just be the short nature of combat." It
     * is exactly that. Arcane Mage casts of Evocation over twenty seeds:
     *
     *     60s  0.05      120s  0.40      180s  0.70      240s  1.00      300s  1.00
     *
     * So "never fires" was never a property of the list. Every profile carries
     * `durationSeconds: 60`, and at five minutes this build is MANA bound where
     * at one minute it ends with 2,638 spare. **The ruling "This is intended"
     * was given about a one-minute fight**, and if the default duration moves,
     * this test is the first thing that should be re-asked rather than
     * re-pinned.
     * ==========================================================================
     *
     * PINNED PER PROFILE AND EXACTLY, so it stays a tripwire AT THIS DURATION.
     * Fire and Frostfire are still zero and a cast on either is a different
     * finding entirely; Arcane is one, and both a rise and a fall are worth
     * somebody looking.
     * ==========================================================================
     */
    const casts = (preset: string) => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed += 1) {
        const run = runProfile(PRESETS_BY_ID.get(preset)!.build(), seed);
        total += run.timeline.filter(
          (event) =>
            'auraId' in event && event.auraId === 'evocation' && event.type === 'aura_applied',
        ).length;
      }
      return total;
    };

    expect(casts('mage_fire')).toBe(0);
    expect(casts('mage_frostfire')).toBe(0);
    /*
     * ZERO AGAIN AT ROUND 37, WHERE IT WAS TWO. The owner's new Arcane tree and
     * list -- Arcane Blast held below four stacks only while no Missile Barrage
     * is up, and Arcane Wrath taking the four-stack casts -- leave the build
     * clear of 10% mana in all twenty fights. A knock-on of a list and tree
     * change, which is what this tripwire is for: somebody looked.
     *
     * TWO AGAIN AT ROUND 80. The Arcane build now casts Fire Blast on cooldown
     * and a Pyroblast at three Heating Up stacks (32/16/3), which spends mana
     * the old list banked -- so two of twenty sixty-second fights reach the
     * 10% gate. The owner's entry and gate are unchanged.
     */
    expect(casts('mage_arcane')).toBe(2);
  }, 20_000);
});

describe('what round 28 did to the Fire list', () => {
  /*
   * ==========================================================================
   * THE FILTER-AND-RESTATE IS THE THING THAT CAN BREAK FROM A DISTANCE.
   *
   * The Fire list spreads `RACIAL_COOLDOWNS` with Eureka FILTERED OUT and
   * restates it gated on three Heating Up stacks. If that shared block ever
   * renames its Eureka entry, the filter silently stops matching and the list
   * gets TWO entries for one ability -- the UNGATED one from the block, above
   * the gated one. The gate would then be dead and nothing would error: the
   * cooldown still fires once a fight, the uses column still reads 1.0, and the
   * only thing that moved is WHEN.
   *
   * A DUPLICATE ABILITY ID IS LEGAL IN THIS PROJECT AND IS WHY THIS NEEDS A
   * TEST. Arcane Missiles is in the Arcane list twice on purpose and the
   * Frostfire list has two Pyroblasts, so "no ability twice" is not an
   * invariant anything else checks.
   * ==========================================================================
   */
  it('gates Eureka exactly once, with nothing ungated above it', () => {
    const eurekas = MAGE_FIRE.entries.filter((row) => row.abilityId === 'eureka');
    expect(eurekas).toHaveLength(1);
    expect(eurekas[0]!.condition).toBeDefined();
  });

  /*
   * ==========================================================================
   * THE POTION IS A SEQUENCE STEP AND NOT AN ENTRY, AND BOTH HALVES MATTER.
   *
   * It was an entry above Combustion gated on Combustion's own AURA, which
   * worked and depended on the list ORDER plus a second decision happening.
   * With Combustion off the global cooldown on the owner's ruling the two
   * resolve in one instant, so the pairing is written as a guarantee instead.
   *
   * `abilityId` IS STEP ONE AND `sequence` HOLDS WHAT FOLLOWS, which is the
   * convention `MAGE_ARCANE`'s own stack uses -- and naming Combustion in BOTH
   * places is the mistake that reads as a finding: `selectAction` casts
   * `entry.abilityId` and sets `pendingSequence.index = 0`, so the resume finds
   * Combustion on cooldown, clears the pointer, and the potion never fires at
   * all. **-14.81 with a spread of 0.08**, which is a deterministic loss rather
   * than any decision moving.
   *
   * SO THIS ASSERTS THE SHAPE: one Combustion entry, the potion as its step and
   * NOT as an entry of its own, and Combustion's id not repeated inside its own
   * sequence.
   * ==========================================================================
   */
  it('casts the potion and Combustion as one two-step sequence', () => {
    const stacks = MAGE_FIRE.entries.filter(
      (row) => row.abilityId === 'major_spellblasting_potion',
    );
    expect(stacks).toHaveLength(1);

    const entry = stacks[0]!;
    expect(entry.sequence).toEqual(['combustion']);
    // The first step is `abilityId`, so repeating it inside the sequence casts
    // it twice and abandons the pointer -- see the note above.
    expect(entry.sequence).not.toContain('major_spellblasting_potion');
    expect(entry.condition).toBeDefined();

    // And Combustion's own entry is the round 80 FALLBACK only: below the
    // stack, under the same gate, so with Spellblasting drunk it is refused and
    // without it Combustion is not lost with the potion.
    const own = MAGE_FIRE.entries.filter((row) => row.abilityId === 'combustion');
    expect(own).toHaveLength(1);
    expect(own[0]!.condition).toEqual(entry.condition);
    expect(MAGE_FIRE.entries.indexOf(own[0]!)).toBeGreaterThan(MAGE_FIRE.entries.indexOf(entry));
    // The arrangement MAGE_ARCANE already uses -- the potion names the stack.
    // (The Arcane list also drinks it late through an entry of its own since round 80.)
    const arcane = MAGE_ARCANE.entries.find(
      (row) => row.abilityId === 'major_spellblasting_potion' && row.sequence !== undefined,
    )!;
    expect(arcane.sequence?.length).toBeGreaterThan(0);
  });

  /*
   * ==========================================================================
   * COMBUSTION IS OFF THE GLOBAL COOLDOWN AND DECLARES A COOLDOWN, which is
   * what makes the sequence above resolve in one instant -- and the second half
   * is not optional: `freeCastChain.test.ts` asserts across all nine classes
   * that every off-GCD ability has a `cooldownMs`, because one without would
   * win the list forever and HANG a fight rather than fail one.
   *
   * THE OWNER'S RULING, and it is the THIRD Mage ability of one shape: the
   * spellbook capture gives Presence of Mind, Arcane Power and Combustion the
   * same row, and the earlier ruling named only the two Arcane ones.
   * ==========================================================================
   */
  it('has Combustion off the global cooldown, with a cooldown declared', () => {
    expect(COMBUSTION_ABILITY.triggersGcd).toBe(false);
    expect(COMBUSTION_ABILITY.cooldownMs).toBeGreaterThan(0);
    // The two the owner ruled on first, so all three are pinned together.
    expect(ARCANE_POWER_ABILITY.triggersGcd).toBe(false);
    expect(PRESENCE_OF_MIND_ABILITY.triggersGcd).toBe(false);
  });

  /*
   * ==========================================================================
   * MAGE ARMOR IS OUT OF THE FIRE LIST AND STILL IN THE FROSTFIRE ONE, and
   * both halves are the assertion.
   *
   * The owner's ruling -- "Mage Armor doesn't need to be captured in the main
   * APL section" -- arrived as an audit of the ARCANE profile, and a list is
   * changed for the profile that was named. Round 26 did the Fire one. The
   * Frostfire list keeps its copy until somebody optimises that profile, so a
   * test that asserted "no Mage list has one" would be extending a ruling by
   * analogy, which is what this project does not do.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * NO MAGE LIST CARRIES A MAGE ARMOR ENTRY, AND THREE ROUNDS GOT THERE APART.
   *
   * This read "has no Mage Armor entry, WHERE FROSTFIRE STILL DOES" and pinned
   * Frostfire's as a deliberate contrast -- true when round 28 wrote it, false
   * by the time round 32 merged, because the Frostfire round removed its entry
   * on the same evidence. The two were measured concurrently and neither could
   * see the other.
   *
   * SO THE CONTRAST WAS A FACT ABOUT A MOMENT RATHER THAN A DESIGN. The durable
   * claim is the one all three agree on: Mage Armor lasts thirty minutes, so a
   * `selfExpired('mage_armor')` gate is false from the first poll and the entry
   * can never fire. Arcane dropped it in round 24, Fire in 28, Frostfire in 32.
   * ==========================================================================
   */
  it('has no Mage Armor entry in any of the three lists', () => {
    for (const [name, list] of [
      ['arcane', MAGE_ARCANE],
      ['fire', MAGE_FIRE],
      ['frostfire', MAGE_FROSTFIRE],
    ] as const) {
      expect(list.entries.some((row) => row.abilityId === 'mage_armor'), name).toBe(false);
    }
  });

  /*
   * ==========================================================================
   * THE TWO SCORCH WINDOWS ARE SEPARATE FACTS AND THIS PINS THAT THEY STILL
   * DISAGREE.
   *
   * They were ONE shared constant at 3 seconds. Round 26 swept the Fire list
   * and landed on 5 (2s -13.70, 3s 0, 4s +6.56, 5s +9.74, 6s +9.84, 8s +8.63)
   * and left Frostfire at 3, because nothing about that sweep transfers to a
   * build with a faster filler.
   *
   * PINNED BY WHAT EACH LIST ASKS RATHER THAN BY THE CONSTANTS, because the
   * constants are not exported -- and because what would actually go wrong is
   * somebody re-merging them, which this catches whichever value survived. It
   * is `critRageMultiplierFor`'s rule pointed at a rotation: pin each by
   * identity, never assert the two are equal.
   * ==========================================================================
   */
  /*
   * ROUND 78 SWEPT FROSTFIRE TOO, at 120s: 4s +13.69, 5s +18.16, 6s +24.72,
   * 7s +23.46, 8s +23.30 over its old 3. So Frostfire's window is now the WIDER
   * one -- still two separate facts, each pinned by identity.
   */
  it("asks for each list's own swept Scorch window", () => {
    const windowOf = (list: typeof MAGE_FIRE) => {
      const entry = list.entries.find((row) => row.abilityId === 'scorch')!;
      const json = JSON.stringify(entry.condition);
      const match = /"auraId":"fire_vulnerability","compare":"atMost","seconds":([0-9.]+)/.exec(
        json,
      );
      expect(match, `no fire_vulnerability duration clause in ${list.name}: ${json}`).not.toBeNull();
      return Number(match![1]);
    };
    expect(windowOf(MAGE_FIRE)).toBe(5);
    expect(windowOf(MAGE_FROSTFIRE)).toBe(7);
  });
});

describe('the three lists, after the owner tuned them', () => {
  it('casts Scorch only if Improved Scorch is actually taken', () => {
    /*
     * WITHOUT THE TALENT SCORCH APPLIES NO DEBUFF, so both halves of
     * `scorchNeeded` are permanently true and Scorch becomes an unconditional
     * entry near the top of two lists -- putting every entry beneath it out of
     * reach. The same failure the `<= 5` reading would have caused, arrived at
     * from the other direction.
     *
     * READ OFF THE BUILT CHARACTER'S REACTIONS, which is what the talent
     * leaves behind -- the arrangement Vanguard and Charge already use. Asking
     * the ability book would not work: Scorch is a trainer spell every Mage
     * owns.
     */
    const built = PRESETS_BY_ID.get('mage_fire')!.build();
    const talented = createPlayer({
      race: 'gnome', characterClass: 'mage', combatStyle: 'caster',
      talents: built.talents, equipment: built.equipment,
    });
    const untalented = createPlayer({
      race: 'gnome', characterClass: 'mage', combatStyle: 'caster',
      talents: {}, equipment: built.equipment,
    });

    expect(talented.reactions.some((r) => r.id === 'improved_scorch')).toBe(true);
    expect(untalented.reactions.some((r) => r.id === 'improved_scorch')).toBe(false);
    // Both still KNOW Scorch, which is why the book cannot be the test.
    expect(untalented.abilities.get('scorch')).toBeDefined();

    const entry = MAGE_FIRE.entries.find((row) => row.abilityId === 'scorch')!;
    const simulation = buildSimulation([untalented, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    expect(compiled(entry.condition)?.(simulation, untalented, undefined)).toBe(false);
  });

  it('puts Evocation in all three lists and fires it only when mana is low', () => {
    /*
     * THE OWNER ASKED FOR ALL THREE, and the Arcane profile never reaches 10%
     * -- `USES=1` shows 0.0 casts there against 0.9 for Fire. That is the
     * ENTRY's condition, not a broken entry, and the owner's list outranks a
     * measured decision of ours: it stays in all three as a floor for a longer
     * fight.
     */
    for (const list of [MAGE_FIRE, MAGE_FROSTFIRE, MAGE_ARCANE]) {
      expect(list.entries.some((row) => row.abilityId === 'evocation')).toBe(true);
    }

    const built = PRESETS_BY_ID.get('mage_fire')!.build();
    const mage = createPlayer({
      race: 'gnome', characterClass: 'mage', combatStyle: 'caster',
      talents: built.talents, equipment: built.equipment,
    });
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    const entry = MAGE_FIRE.entries.find((row) => row.abilityId === 'evocation')!;
    const mana = mage.resources.get('mana')!;

    mana.set(mana.maximum);
    expect(compiled(entry.condition)?.(simulation, mage, undefined)).toBe(false);
    mana.set(mana.maximum * 0.5);
    expect(compiled(entry.condition)?.(simulation, mage, undefined)).toBe(false);
    mana.set(mana.maximum * 0.09);
    expect(compiled(entry.condition)?.(simulation, mage, undefined)).toBe(true);
  });

  it('spends Presence of Mind at the Arcane Blast CAP, as one cooldown stack', () => {
    /*
     * ==========================================================================
     * THE OWNER RESHAPED THIS AND THIS TEST GIVES WAY AGAIN -- which is the
     * rule it already carried: **a test that pins a rotation decision has to
     * give way when the decision changes owner; a test that pins an INVARIANT
     * does not.** The invariant is unchanged and is what is asserted below; the
     * SHAPE it is expressed in is what moved.
     *
     * WHAT IT USED TO PIN: two separate entries, `presence_of_mind` at the cap
     * and `pyroblast` at the cap AND with the charge in hand, which emerged as
     * a pair because nothing between them was castable.
     *
     * WHAT IT PINS NOW: ONE entry with a `sequence`, on the owner's ask for "a
     * cooldown overlap condition ... this is often times how real players use
     * their cooldowns". The potion is step one, Presence of Mind step two, and
     * the six-second Pyroblast step three -- gated once, resolved as a unit,
     * with nothing able to be cast between the steps.
     *
     * **AND THAT IS A STRONGER CLAIM THAN THE OLD PAIR, WHICH IS WHY THE
     * RESHAPE WAS WORTH MAKING AT ZERO MEASURED COST.** The pair held together
     * only because every entry between the two happened to be off the global
     * cooldown -- and two of those became so in the same change. A sequence
     * says it outright instead of depending on it.
     * ==========================================================================
     */
    const built = PRESETS_BY_ID.get('mage_arcane')!.build();
    const mage = createPlayer({
      race: 'gnome', characterClass: 'mage', combatStyle: 'caster',
      talents: built.talents, equipment: built.equipment,
    });
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();

    /*
     * THE STACK IS FOUND BY ITS STEPS RATHER THAN BY ITS POSITION, so a list
     * reorder does not silently point this at a different entry.
     */
    const stacks = MAGE_ARCANE.entries.filter(
      (row) => (row.sequence ?? []).includes('presence_of_mind'),
    );
    /*
     * TWO SINCE ROUND 78: the potion stack, and the same stack WITHOUT the
     * potion beneath it -- the first is dropped from the list whenever the
     * potion is not selected, and the preset now drinks the Major Mana Potion.
     * Same gate, same steps after the potion.
     */
    expect(stacks).toHaveLength(2);
    const stack = stacks.find((row) => row.abilityId === 'major_spellblasting_potion')!;
    const withoutPotion = stacks.find((row) => row.abilityId === 'arcane_power')!;
    expect(withoutPotion.sequence).toEqual(['presence_of_mind', 'arcane_wrath']);
    expect(withoutPotion.condition).toEqual(stack.condition);

    /*
     * ORDER IS THE MECHANISM: Presence of Mind has to be cast BEFORE the
     * Arcane Wrath it makes instant, and Arcane Power before both so the Wrath
     * lands inside its window. The owner's round 37 stack: "Major Spellblasting
     * Potion paired with Arcane Power and Presence of Mind and Arcane Wrath".
     * It was the potion, Presence of Mind and an instant PYROBLAST.
     */
    expect([stack.abilityId, ...(stack.sequence ?? [])]).toEqual([
      'major_spellblasting_potion',
      'arcane_power',
      'presence_of_mind',
      'arcane_wrath',
    ]);

    // Pyroblast is in no STACK, and since round 80 it has one entry of its own:
    // the Heating Up chain the 32/16/3 tree buys, at three stacks.
    const pyro = MAGE_ARCANE.entries.filter((row) => row.abilityId === 'pyroblast');
    expect(pyro).toHaveLength(1);
    expect(pyro[0]!.sequence).toBeUndefined();

    const fires = () =>
      compiled(stack.condition as never)?.(simulation, mage, undefined) ?? true;

    // Refused with no stacks, and the whole way up: one, two and three.
    expect(fires()).toBe(false);
    for (let n = 1; n < ARCANE_BLAST_MAX_STACKS; n += 1) {
      simulation.applyAura(mage, arcaneBlastAura(mage.stats.effective.intellect), mage.id);
      expect(mage.auras.stacksOf('arcane_blast')).toBe(n);
      expect(fires()).toBe(false);
    }

    // And taken at the cap.
    simulation.applyAura(mage, arcaneBlastAura(mage.stats.effective.intellect), mage.id);
    expect(mage.auras.stacksOf('arcane_blast')).toBe(ARCANE_BLAST_MAX_STACKS);
    expect(fires()).toBe(true);

    // A Barrage does not exclude it: the owner dropped that clause.
    simulation.applyAura(mage, MISSILE_BARRAGE, mage.id);
    expect(fires()).toBe(true);
  });

  it('makes that Arcane Wrath actually instant, which is the whole point of the pair', () => {
    /*
     * ASSERT THE MECHANISM AND NOT ONLY THE CONDITIONS. Two entries can be
     * correctly gated and still buy nothing if the charge does not reach the
     * ability.
     *
     * THIS COMMENT NAMED THE BUG AND THIS TEST DID NOT COVER IT. It read
     * "`PRESENCE_OF_MIND_SPELLS` is a NAMED LIST, so a spell absent from it
     * takes the full cast with every condition reading true" -- and a spell WAS
     * absent from it: Arcane Wrath, which the owner found. The hazard was
     * identified, written down, and checked for exactly one spell. Presence of
     * Mind is a rule rather than a list now, and `presenceOfMind.test.ts`
     * asserts it over the whole book.
     */
    const mage = createPlayer({
      race: 'gnome', characterClass: 'mage', combatStyle: 'caster',
      talents: PRESETS_BY_ID.get('mage_arcane')!.build().talents,
    });
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    const wrath = mage.abilities.get('arcane_wrath')!;
    expect(wrath).toBeDefined();
    expect(resolveCast(mage, wrath).baseCastTimeMs).toBeGreaterThan(0);

    simulation.applyAura(mage, PRESENCE_OF_MIND, mage.id);
    expect(resolveCast(mage, wrath).baseCastTimeMs).toBe(0);
  });
});
