import { describe, expect, it } from 'vitest';
import { Simulation, castAbility, resolveCast, seconds, toSeconds } from '../../src/engine';
import type { AttackTableKind, Combatant, TelemetryEvent } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { CRUSADER } from '../../src/game/items/itemData';
import { OFF_HAND_DAMAGE_MULTIPLIER } from '../../src/game/actors/weapons';
import { characterAtCombatStart } from '../../src/simulator';
import { talentBuild } from '../../src/game/talents/talentBuild';
import {
  PET_BASE_DAMAGE_MAX,
  PET_BASE_DAMAGE_MIN,
  PET_BASE_STRENGTH,
  createPet,
} from '../../src/game/actors/createPet';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { legalise } from '../helpers/legalTalents';
import { legalAllocation } from '../../src/game/talents/talentRules';
import { talentsForClass } from '../../src/game/talents/talentData';
import { runProfile, runProfileBatch } from '../../src/simulator';

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};
import { AUTO_ATTACK_NAMES, autoAttackName } from '../../src/engine';
import {
  HAWK_DAMAGE_PER_STRIKE,
  HAWK_DURATION_MS,
  HAWK_MAX_ACTIVE,
  HAWK_RANGED_ATTACK_POWER_COEFFICIENT,
  HAWK_STRIKES,
  HAWK_STRIKE_INTERVAL_MS,
  HAWK_TICK_DIVISOR,
  HAWK_TOTAL_AS_MULTIPLE_OF_OPENER,
  activeHawks,
  hawkStrikeDamage,
  hawkTickDamage,
  EXPLOSIVE_TRAP,
  EXPLOSIVE_TRAP_BURN_DURATION_MS,
  EXPLOSIVE_TRAP_BURN_TOTAL,
  EXPLOSIVE_TRAP_TICK_INTERVAL_MS,
  IMMOLATION_TRAP,
  IMMOLATION_TRAP_DURATION_MS,
  IMMOLATION_TRAP_TICK_INTERVAL_MS,
  IMMOLATION_TRAP_TOTAL,
  TRAP_ATTACK_POWER_COEFFICIENT,
  LACERATING_STRIKES_DURATION_MS,
  LACERATING_STRIKES_TICKS,
  laceratingStrikesAura,
} from '../../src/game/auras/hunter';
import {
  EXPLOSIVE_TRAP_ABILITY,
  EXPLOSIVE_TRAP_INITIAL_DAMAGE,
  IMMOLATION_TRAP_ABILITY,
  MONGOOSE_BITE,
  SUMMON_HAWK,
  WING_CLIP,
  WING_CLIP_DAMAGE,
} from '../../src/game/abilities/hunter';
import { ASPECT_OF_THE_BEAST } from '../../src/game/auras/hunter';
import {
  RESOURCEFULNESS_REGEN,
  RESOURCEFULNESS_REGEN_BYPASS_PERCENT,
  deadlyAspects,
  exposePrey,
  laceratingStrikes,
  resourcefulness,
} from '../../src/game/reactions/hunterTalents';
import {
  HUNTER_BEAST_MASTERY,
  HUNTER_LONE_WOLF_MELEE,
  HUNTER_LONE_WOLF_RANGED,
} from '../../src/game/rotations/hunter';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';
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
 * ------------------------------------------------------------------------------
 * THE FIVE HUNTER GAPS THE OWNER'S RULINGS CLOSED, and one mislabelled row.
 *
 * Every one of these asserts a MECHANISM rather than a DPS delta, because three
 * of the five are worth nothing to any profile and would pass a DPS test by
 * accident: Rapid Killing's cooldown is longer than a fight either way, Clever
 * Traps is taken by no Hunter profile, and Resourcefulness only matters to a
 * build that runs dry.
 *
 * The expected numbers are written out by hand from the source's own words
 * rather than read back out of the code, so a constant changing fails here.
 * ------------------------------------------------------------------------------
 */

/** Every damage event one actor dealt, by ability name. */
function damageBy(events: readonly TelemetryEvent[], sourceId: string) {
  const rows = new Map<string, { count: number; total: number }>();
  for (const event of events) {
    if (event.type !== 'damage' || event.sourceId !== sourceId) continue;
    const row = rows.get(event.abilityName) ?? { count: 0, total: 0 };
    row.count += 1;
    row.total += event.amount;
    rows.set(event.abilityName, row);
  }
  return rows;
}

function recordingSimulation(combatants: Combatant[], durationMs = seconds(60)) {
  const events: TelemetryEvent[] = [];
  const simulation = buildSimulation(combatants, { durationMs }, {
    emit: (event: TelemetryEvent) => events.push(event),
  } as ConstructorParameters<typeof Simulation>[1]);
  return { simulation, events };
}

// ---------------------------------------------------------------------------

describe('Lacerating Strikes bleeds for a share of the strike', () => {
  /*
   * "Your Mongoose Bite also causes the target to Bleed for damage over 21 sec
   * equal to 40% of the damage done by Mongoose Bite."
   */
  const HIT = 500;
  const SHARE = 0.4;

  it('divides 40% of the hit into seven three-second ticks', () => {
    // 21 seconds at the three-second cadence every bleed in this ruleset uses.
    expect(toSeconds(LACERATING_STRIKES_DURATION_MS)).toBe(21);
    expect(LACERATING_STRIKES_TICKS).toBe(7);

    const { simulation, events } = recordingSimulation([
      makeAttacker({ stats: { attackPower: 0 } }),
      makeTarget({ stats: { armor: 3731 } }),
    ]);
    const [actor, target] = simulation.combatants;
    simulation.applyAura(target, laceratingStrikesAura(HIT * SHARE), actor.id);
    simulation.run();

    const bleed = damageBy(events, actor.id).get('Lacerating Strikes');
    expect(bleed?.count).toBe(LACERATING_STRIKES_TICKS);
    /*
     * A BLEED IS PHYSICAL AND IGNORES ARMOR, so the total against a 3731-armor
     * target is the whole 200 and not ~60% of it. That is the assertion the
     * armor on the target above exists for -- without it the test would pass
     * with `appliesArmor` left to its physical default.
     *
     * Crits are what make this a floor rather than an equality: the attacker has
     * base crit, so some runs tick harder.
     */
    expect(bleed!.total).toBeGreaterThanOrEqual(HIT * SHARE - 0.001);
  });

  it('takes the share off what LANDED, not off the weapon', () => {
    /*
     * THE DIFFERENCE FROM DEEP WOUNDS, WRITTEN AS A TEST. Deep Wounds recomputes
     * a percentage of the weapon's average damage; this reads the resolved hit.
     * So a crit for double leaves double the bleed, which a weapon-average
     * reading could not produce.
     */
    const small = laceratingStrikesAura(HIT * SHARE);
    const big = laceratingStrikesAura(HIT * 2 * SHARE);
    const totals = [small, big].map((aura) => {
      const { simulation, events } = recordingSimulation([
        makeAttacker({ stats: { attackPower: 0, critChance: -100 } }),
        makeTarget(),
      ]);
      const [actor, target] = simulation.combatants;
      simulation.applyAura(target, aura, actor.id);
      simulation.run();
      return damageBy(events, actor.id).get('Lacerating Strikes')!.total;
    });
    expect(totals[1]).toBeCloseTo(totals[0] * 2, 6);
  });

  it('fires only off Mongoose Bite, and only when it connected', () => {
    const reaction = laceratingStrikes(40);
    const { simulation } = recordingSimulation([makeAttacker(), makeTarget()]);
    const [actor, target] = simulation.combatants;

    const attack = (abilityId: string | undefined, amount: number) => ({
      attacker: actor,
      defender: target,
      outcome: 'hit' as const,
      abilityId,
      abilityName: abilityId ?? 'Main Hand Auto-Attack',
      amount,
      weaponSlot: 'mainHand' as const,
      critical: false,
    });

    expect(reaction.canTrigger!(simulation, actor, attack('mongoose_bite', 500))).toBe(true);
    // A different ability, and a Mongoose Bite that was dodged.
    expect(reaction.canTrigger!(simulation, actor, attack('raptor_strike', 500))).toBe(false);
    expect(reaction.canTrigger!(simulation, actor, attack(undefined, 500))).toBe(false);
    expect(reaction.canTrigger!(simulation, actor, attack('mongoose_bite', 0))).toBe(false);
  });

  it('is granted by the talent, from the hand-filled 40', () => {
    /*
     * A single-rank talent has no `{0}` for the importer to match, so its
     * `values` come back null and an effect reading no value is DROPPED IN
     * SILENCE. This is the test that the hand-filled value is present: without
     * it the reaction is simply absent and the talent reads as unmodelled
     * without ever having said so.
     */
    const build = talentBuild('hunter', { lacerating_strikes: 1 });
    expect(build.reactions.map((r) => r.id)).toContain('lacerating_strikes');
    expect(build.unmodelled.map((u) => u.talentId)).not.toContain('lacerating_strikes');
  });

  it('reaches the Lone Wolf melee build, which is the one that takes it', () => {
    const hunter = characterAtCombatStart(PRESETS_BY_ID.get('lw_melee')!.build())!;
    expect(hunter.reactions.map((r) => r.id)).toContain('lacerating_strikes');
  });
});

// ---------------------------------------------------------------------------

describe('Explosive Trap, the second trap the owner put in scope', () => {
  /*
   * --------------------------------------------------------------------------
   * "Place a Fire trap that explodes when an enemy approaches, causing 208 to
   * 264 Fire damage and 330 additional Fire damage over 20 sec to all within 10
   * yards." 520 mana, instant, 30-second cooldown, rank 3 and rank 3 is max.
   *
   * EVERY FIGURE WRITTEN OUT BY HAND from the capture, which is the project's
   * two-independent-checks rule: a typo here fails, and upstream drift fails
   * `--verify`.
   * --------------------------------------------------------------------------
   */
  it('costs and cools down what the capture states', () => {
    expect(EXPLOSIVE_TRAP_ABILITY.cost).toEqual({ resource: 'mana', amount: 520 });
    expect(toSeconds(EXPLOSIVE_TRAP_ABILITY.cooldownMs!)).toBe(30);
    // Instant, so it never resets a swing timer -- the thing that matters most
    // about a melee Hunter casting anything.
    expect(EXPLOSIVE_TRAP_ABILITY.castTimeMs).toBeUndefined();
  });

  it('is a HYBRID where Immolation Trap is not: 236 on the cast plus 330 over 20s', () => {
    /*
     * THE MIDPOINT OF 208 TO 264, which the combat table would normally spread
     * -- except this one rolls no table at all, so the midpoint IS the hit.
     * Immolation Trap has no initial damage, which makes this the first trap in
     * the project to deal any from its own `onCast`.
     */
    expect(EXPLOSIVE_TRAP_INITIAL_DAMAGE).toBe(236);
    expect(EXPLOSIVE_TRAP_BURN_TOTAL).toBe(330);
    expect(toSeconds(EXPLOSIVE_TRAP_BURN_DURATION_MS)).toBe(20);
  });

  it('ticks ten times for 33, which is the cadence choice stated at the aura', () => {
    /*
     * TWENTY DOES NOT DIVIDE BY THREE, and three seconds is what every other
     * Hunter damage-over-time effect here uses -- so the class convention could
     * not hold and two seconds was chosen: it divides 20 exactly, 330/10 is a
     * whole 33, and the project already ticks at two seconds for Rupture.
     *
     * ASSERTED SO THE CHOICE CANNOT DRIFT SILENTLY. Four seconds would also
     * divide evenly and deal the same total; nothing measurable rests on it, and
     * a stated interval from the owner or a source is what would settle it.
     */
    expect(toSeconds(EXPLOSIVE_TRAP_TICK_INTERVAL_MS)).toBe(2);
    expect(EXPLOSIVE_TRAP_BURN_DURATION_MS / EXPLOSIVE_TRAP_TICK_INTERVAL_MS).toBe(10);

    const { simulation, events } = recordingSimulation([
      // No crit, so the total is exactly the stated one.
      makeAttacker({ stats: { attackPower: 0, critChance: -100, spellCritChance: -100 } }),
      makeTarget(),
    ]);
    const [actor, target] = simulation.combatants;
    simulation.applyAura(target, EXPLOSIVE_TRAP, actor.id);
    simulation.run();

    const burn = damageBy(events, actor.id).get('Explosive Trap');
    expect(burn?.count).toBe(10);
    expect(burn!.total).toBeCloseTo(EXPLOSIVE_TRAP_BURN_TOTAL, 6);
  });

  it('takes its ATTACK power share (5%, 13% since round 37) and no spell power, on the BURN half', () => {
    /*
     * ========================================================================
     * THE PATCH REVERSED HALF OF THE OWNER'S RULING. It went in with "there
     * isn't an AP or SP scaler" and both halves carried `powerCoefficient: 0`;
     * the note is "Immolation Trap and Explosive Trap now scale with 5% of
     * your Attack Power", which is later and wins. The SPELL power half of the
     * ruling stands.
     *
     * AND IT COULD NOT BE `powerCoefficient`, WHICH IS WHY THIS TEST PUSHES
     * BOTH POOLS SEPARATELY. That field picks its pool by SCHOOL -- attack
     * power when physical, spell power otherwise -- and a trap is FIRE, so
     * 0.05 written there would have read the Hunter's SPELL power. On a Hunter
     * that is close to nothing: the trap would have gained almost exactly
     * zero, kept an ordinary damage row, and looked implemented.
     * `attackPowerCoefficient` is the field, and the two assertions below are
     * what tell the two apart.
     *
     * THE 5% IS A DURATION TOTAL, NOT PER TICK, which is this project's own
     * reading of a coefficient stated without those words -- Rip was six times
     * its stated figure for exactly that mistake.
     *
     * AND THE WHOLE 5% IS ON THE BURN, which is the one judgement in the note:
     * this trap has two damage components and Immolation Trap has one, so the
     * burn is what the two abilities share. The initial hit keeps "no scaler".
     * See the comment on `EXPLOSIVE_TRAP`.
     * ========================================================================
     */
    const totalAt = (attackPower: number, spellPower: number) => {
      const { simulation, events } = recordingSimulation([
        makeAttacker({
          abilities: [EXPLOSIVE_TRAP_ABILITY],
          autoAttack: 'none',
          stats: {
            attackPower,
            rangedAttackPower: attackPower,
            spellPower,
            critChance: -100,
            spellCritChance: -100,
          },
          resources: [{ type: 'mana', maximum: 10_000 }],
        }),
        makeTarget(),
      ]);
      const [actor, target] = simulation.combatants;
      castAbility(simulation, actor, actor.abilities.get('explosive_trap')!, target);
      simulation.run();
      const row = damageBy(events, actor.id).get('Explosive Trap');
      return row!.total;
    };

    const bare = totalAt(0, 0);
    expect(bare).toBeCloseTo(EXPLOSIVE_TRAP_INITIAL_DAMAGE + EXPLOSIVE_TRAP_BURN_TOTAL, 6);

    // SPELL power alone still does nothing, which is the surviving half of the
    // owner's ruling AND the check that the coefficient is not school-routed.
    expect(totalAt(0, 2000)).toBeCloseTo(bare, 6);

    // And attack power adds exactly 5% of itself over the whole ability.
    expect(totalAt(2000, 0)).toBeCloseTo(bare + 2000 * TRAP_ATTACK_POWER_COEFFICIENT, 6);
    // Asserted as a SLOPE over two points as well, so the figure is 5% rather
    // than 100 damage that happens to match at one stat line.
    expect(totalAt(4000, 0) - totalAt(2000, 0)).toBeCloseTo(
      2000 * TRAP_ATTACK_POWER_COEFFICIENT,
      6,
    );
  });

  it('keeps its area clause in its own words rather than approximating it', () => {
    // "to all within 10 yards", and there is one target. The same limit
    // Multi-Shot and Blast Wave carry.
    expect(EXPLOSIVE_TRAP_ABILITY.unmodelled).toContain('10 yards');
    expect(EXPLOSIVE_TRAP_ABILITY.unmodelled).toContain('triggers');
  });

  it('is in the Hunter book, so Clever Traps can reach it', () => {
    /*
     * CLEVER TRAPS NAMES BOTH TRAPS and was half-paid for exactly as long as
     * only one was declared. One `abilityDamage` entry per trap, and Explosive
     * Trap's initial hit and burn share an ability id so one entry reaches both.
     */
    const built = talentBuild('hunter', { clever_traps: 2 });
    expect(built.abilityModifiers.for('explosive_trap').damageMultiplier).toBeCloseTo(1.3, 6);
    expect(built.abilityModifiers.for('immolation_trap').damageMultiplier).toBeCloseTo(1.3, 6);
  });
});

describe('Immolation Trap', () => {
  /*
   * "Place a Fire trap that will burn the first enemy to approach for 690 Fire
   * damage over 15 sec", at 245 mana on a 30-second cooldown -- and on the
   * owner's ruling it triggers instantly when cast.
   */
  it('costs and cools down what the capture states', () => {
    expect(IMMOLATION_TRAP_ABILITY.cost).toEqual({ resource: 'mana', amount: 245 });
    expect(toSeconds(IMMOLATION_TRAP_ABILITY.cooldownMs!)).toBe(30);
    // Instant: no cast time at all, so it never resets a swing timer.
    expect(IMMOLATION_TRAP_ABILITY.castTimeMs).toBeUndefined();
  });

  it('burns for 690 over five three-second ticks', () => {
    expect(toSeconds(IMMOLATION_TRAP_DURATION_MS)).toBe(15);
    expect(IMMOLATION_TRAP_DURATION_MS / IMMOLATION_TRAP_TICK_INTERVAL_MS).toBe(5);

    const { simulation, events } = recordingSimulation([
      // No crit, so the total is exactly the stated one.
      makeAttacker({ stats: { attackPower: 0, critChance: -100, spellCritChance: -100 } }),
      makeTarget(),
    ]);
    const [actor, target] = simulation.combatants;
    simulation.applyAura(target, IMMOLATION_TRAP, actor.id);
    simulation.run();

    const burn = damageBy(events, actor.id).get('Immolation Trap');
    expect(burn?.count).toBe(5);
    expect(burn!.total).toBeCloseTo(IMMOLATION_TRAP_TOTAL, 6);
  });

  it('takes 13% of the larger ATTACK power pool over its duration, and no spell power', () => {
    /*
     * ========================================================================
     * IT WENT IN WITH NO SCALER AT ALL -- "Immolation trap doesn't scale with
     * attack power or spell power currently" -- and the patch note gives it 5%
     * of ATTACK power. The spell power half of the ruling stands, which is why
     * both pools are pushed separately here: `powerCoefficient` would have
     * routed a fire ability's coefficient to SPELL power and the trap would
     * have gained nothing on a Hunter while looking implemented.
     *
     * A DURATION TOTAL across its five ticks, not 5% per tick -- which would
     * be five times the stated figure, Rip's mistake exactly.
     *
     * RANGED ATTACK POWER IS PUSHED TOO AND MUST DO NOTHING, which is the
     * narrowest of the three assertions: `attackPowerCoefficient` reads the
     * MELEE pool because a trap is not a weapon use and has no slot, and the
     * owner's general ruling is that bare "Attack Power" reaches both pools --
     * so for any source that grants it the two agree and this assertion is
     * about the FIELD rather than about a Hunter's gear.
     * ========================================================================
     */
    const totalWith = (stats: Record<string, number>) => {
      const { simulation, events } = recordingSimulation([
        makeAttacker({ stats: { critChance: -100, spellCritChance: -100, ...stats } }),
        makeTarget(),
      ]);
      const [actor, target] = simulation.combatants;
      simulation.applyAura(target, IMMOLATION_TRAP, actor.id);
      simulation.run();
      return damageBy(events, actor.id).get('Immolation Trap')!.total;
    };

    expect(totalWith({})).toBeCloseTo(IMMOLATION_TRAP_TOTAL, 6);
    // Attack power adds exactly 13% of itself (the owner's round 37, was 5%).
    expect(totalWith({ attackPower: 2000 })).toBeCloseTo(
      IMMOLATION_TRAP_TOTAL + 2000 * TRAP_ATTACK_POWER_COEFFICIENT,
      6,
    );
    // Spell power does nothing, which the owner's surviving ruling requires.
    expect(totalWith({ spellPower: 2000 })).toBeCloseTo(IMMOLATION_TRAP_TOTAL, 6);
    /*
     * AND THE RANGED POOL COUNTS NOW, AS THE LARGER OF THE TWO -- the owner's
     * round 37: "using the maximum of either the Hunter's melee or ranged
     * Attack Power". So 2000 ranged alone pays in full, and 500 melee beside it
     * changes nothing: the pools are not added.
     */
    const fromRanged = IMMOLATION_TRAP_TOTAL + 2000 * TRAP_ATTACK_POWER_COEFFICIENT;
    expect(totalWith({ rangedAttackPower: 2000 })).toBeCloseTo(fromRanged, 6);
    expect(totalWith({ rangedAttackPower: 2000, attackPower: 500 })).toBeCloseTo(fromRanged, 6);
    expect(TRAP_ATTACK_POWER_COEFFICIENT).toBe(0.13);
  });

  it('is last in the Lone Wolf melee list, where the owner put it', () => {
    /*
     * "add it to the LW melee APL after strider kick" -- so this pins the
     * POSITION and not merely the presence. An unconditional entry is a floor
     * under everything below it, so where it sits is the whole of what it does.
     */
    const ids = HUNTER_LONE_WOLF_MELEE.entries.map((entry) => entry.abilityId);
    expect(ids[ids.indexOf('strider_kick') + 1]).toBe('immolation_trap');
    /*
     * IT IS NO LONGER LAST, AND THAT ASSERTION WAS MINE RATHER THAN THE
     * OWNER'S. Their instruction was "add it to the LW melee APL AFTER STRIDER
     * KICK", which is what the line above pins; "and last" was true on the day
     * and stopped being true when Wing Clip arrived beneath it. The floor is
     * Wing Clip's now -- no cooldown against the trap's 30 seconds.
     */
    expect(ids[ids.length - 1]).toBe('wing_clip');
  });

  it('is cast by the melee Hunter and by neither ranged one', () => {
    /*
     * THE CONTAINMENT CHECK FOR A CLASS ABILITY. Every Hunter learns it -- it is
     * a trainer spell, not talent-granted -- so the two ranged builds have it in
     * the book and in no list, which is the correct state and not a gap.
     */
    for (const preset of ['bm_hunter', 'lw_ranged', 'lw_melee'] as const) {
      const book = characterAtCombatStart(PRESETS_BY_ID.get(preset)!.build())!.abilities.all;
      expect(book.map((a) => a.id)).toContain('immolation_trap');
    }
  });

  it('Clever Traps raises its damage and nothing else it names', () => {
    /*
     * "Increases the duration of Freezing and Frost trap effects by 30% and the
     * DAMAGE of Immolation and Explosive trap effects by 30%." `valueIndex: 1`
     * is the damage; both numbers are 30 at every rank, which is exactly the
     * coincidence that would hide the wrong index -- so the assertion is on the
     * ability the modifier lands on rather than on the number.
     */
    const build = talentBuild('hunter', { clever_traps: 2 });
    expect(build.abilityModifiers.for('immolation_trap').damageMultiplier).toBeCloseTo(1.3, 6);
    // No Hunter profile takes it, which is why this is a mechanism test only.
    expect(build.abilityModifiers.for('serpent_sting').damageMultiplier ?? 1).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('the hawk: two of them, each on its own clock', () => {
  /*
   * ----------------------------------------------------------------------------
   * THE RULESET OWNER'S MODEL, THIRD REVISION, 2026-10-02:
   *
   *   "it's 108 + 5% ranged attack power (RAP) on the initial hit BUT
   *    (108 + 5% RAP) / 4 every 2 seconds -- instead of (108 + 5% RAP) every 3
   *    seconds."
   *   "...there is a hawk_1 and hawk_2, so that casting one doesn't overwrite
   *    the other."
   *
   * THE OPENER AND THE ASSAULT ARE DIFFERENT NUMBERS NOW. The revision before
   * this had every hit at the full figure every three seconds; the one before
   * that had 108 flat every two seconds with no scaling at all.
   * ----------------------------------------------------------------------------
   */
  const hawkOwner = () =>
    makeAttacker({
      stats: { rangedAttackPower: 1000, critChance: -100 },
      resources: [{ type: 'mana', maximum: 10_000 }],
    });

  it('opens for the full figure and strikes for a quarter of it', () => {
    expect(HAWK_DAMAGE_PER_STRIKE).toBe(108);
    expect(HAWK_RANGED_ATTACK_POWER_COEFFICIENT).toBe(0.05);
    expect(toSeconds(HAWK_STRIKE_INTERVAL_MS)).toBe(2);
    expect(toSeconds(HAWK_DURATION_MS)).toBe(18);
    expect(HAWK_TICK_DIVISOR).toBe(4);
    expect(HAWK_MAX_ACTIVE).toBe(2);

    // 108 + 5% of ranged attack power on the dive...
    expect(hawkStrikeDamage(1000)).toBeCloseTo(108 + 50, 6);
    expect(hawkStrikeDamage(0)).toBe(108);
    // ...and a quarter of that on every strike after it.
    expect(hawkTickDamage(1000)).toBeCloseTo((108 + 50) / 4, 6);
    expect(hawkTickDamage(0)).toBeCloseTo(27, 6);

    /*
     * TEN HITS, AND THIS ONE IS DERIVED RATHER THAN STATED. The owner gave a
     * hit count with the PREVIOUS revision ("totalling 7 hits") and gave none
     * with this one, so 1 + 18 / 2 is arithmetic rather than a source. Asserted
     * anyway, as the cross-check on the cadence and the duration.
     */
    expect(HAWK_STRIKES).toBe(10);
    // One full hit plus nine quarters.
    expect(HAWK_TOTAL_AS_MULTIPLE_OF_OPENER).toBeCloseTo(3.25, 10);
  });

  it('lands ten hits from one cast, totalling 3.25 openers', () => {
    const { simulation, events } = recordingSimulation(
      [hawkOwner(), makeTarget()],
      // Past the last tick at t=18 without reaching a second cast.
      seconds(20),
    );
    const [actor, target] = simulation.combatants;
    actor.abilities.add(SUMMON_HAWK);
    simulation.begin();
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    simulation.run();

    const hawk = damageBy(events, actor.id).get('Hawk')!;
    expect(hawk.count).toBe(HAWK_STRIKES);
    /*
     * NOT `opener x 10`, which is the mistake this asserts against: the dive is
     * full and the other nine are quarters, so the total is 3.25 openers and
     * the row's AVERAGE is not any single hit.
     */
    expect(hawk.total).toBeCloseTo(
      hawkStrikeDamage(1000) + hawkTickDamage(1000) * (HAWK_STRIKES - 1),
      6,
    );
    expect(hawk.total).toBeCloseTo(hawkStrikeDamage(1000) * 3.25, 6);
    expect(hawk.total).not.toBeCloseTo(hawkStrikeDamage(1000) * HAWK_STRIKES, 1);
  });

  it('scales every hit with ranged attack power, the instant one included', () => {
    /*
     * THE INSTANT HIT IS THE ABILITY'S AND THE SIX STRIKES ARE THE AURA'S, so
     * this is the check that the coefficient reached BOTH -- a 5% applied to
     * only the ticks is six sevenths right and reads as an ordinary hawk.
     */
    const totals = [0, 1000].map((rap) => {
      const { simulation, events } = recordingSimulation(
        [
          makeAttacker({
            stats: { rangedAttackPower: rap, critChance: -100 },
            resources: [{ type: 'mana', maximum: 10_000 }],
          }),
          makeTarget(),
        ],
        seconds(20),
      );
      const [actor, target] = simulation.combatants;
      actor.abilities.add(SUMMON_HAWK);
      simulation.begin();
      SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
      simulation.run();
      return damageBy(events, actor.id).get('Hawk')!.total;
    });

    expect(totals[0]).toBeCloseTo(108 * HAWK_TOTAL_AS_MULTIPLE_OF_OPENER, 6);
    expect(totals[1]).toBeCloseTo((108 + 50) * HAWK_TOTAL_AS_MULTIPLE_OF_OPENER, 6);
    // The coefficient is worth 50 on the dive and 12.5 on each of nine strikes.
    expect(totals[1] - totals[0]).toBeCloseTo(50 * 3.25, 6);
  });

  it('gives the second hawk its OWN clock, which is the point of the rewrite', () => {
    /*
     * ------------------------------------------------------------------------
     * THE CAVEAT THIS REPLACES, in its own words: "the two share one 18-second
     * clock: summoning the second resets the first, so both expire together
     * instead of 18 seconds after their own summon."
     *
     * Two auras rather than one with two stacks is the whole fix, and this is
     * the assertion that says so: summon six seconds apart and the first still
     * expires six seconds before the second.
     * ------------------------------------------------------------------------
     */
    const { simulation } = recordingSimulation([hawkOwner(), makeTarget()], seconds(60));
    const [actor, target] = simulation.combatants;
    simulation.begin();

    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    const firstRemaining = actor.auras.remainingMs('hawk_1', simulation.clock.now());
    expect(firstRemaining).toBe(HAWK_DURATION_MS);
    expect(actor.auras.has('hawk_2')).toBe(false);

    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    const now = simulation.clock.now();
    // The SECOND slot is filled, and the first is untouched rather than reset.
    expect(actor.auras.has('hawk_1')).toBe(true);
    expect(actor.auras.has('hawk_2')).toBe(true);
    expect(actor.auras.remainingMs('hawk_1', now)).toBe(firstRemaining);
    expect(activeHawks(actor)).toBe(2);
  });

  it('overwrites the oldest on a third cast rather than refusing it', () => {
    /*
     * "Casting a third summon hawk while hawk_1 and hawk_2 are active WOULD
     * cause an overwrite / refresh." The ability permits it -- there is no
     * `canCast` gate any more -- and the LIST is what declines, below.
     */
    const { simulation } = recordingSimulation([hawkOwner(), makeTarget()], seconds(60));
    const [actor, target] = simulation.combatants;
    simulation.begin();

    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    expect(SUMMON_HAWK.canCast).toBeUndefined();

    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    // Still two, and both at full duration -- one was replaced, not added.
    expect(activeHawks(actor)).toBe(2);
    const now = simulation.clock.now();
    expect(actor.auras.remainingMs('hawk_1', now)).toBe(HAWK_DURATION_MS);
    expect(actor.auras.remainingMs('hawk_2', now)).toBe(HAWK_DURATION_MS);
  });

  it('credits its damage to summon_hawk, which two talents depend on', () => {
    /*
     * ------------------------------------------------------------------------
     * THE SILENT BREAKAGE THIS REWRITE COULD HAVE CAUSED, AND THE REASON THIS
     * TEST EXISTS. Unleashed Fury declares `abilityDamage` and Ferocity
     * `abilityCrit` against the id `summon_hawk`, and both reached the old hawk
     * because the AURA was called `summon_hawk` -- a periodic tick carries its
     * aura's id.
     *
     * The auras are `hawk_1` and `hawk_2` now. Had the ticks kept using
     * `aura.id`, two talents a Beast Mastery build takes would have stopped
     * applying to a quarter of its damage, nothing would have errored, and the
     * profile would have read as an ordinary hawk that was quietly 17% weaker.
     * ------------------------------------------------------------------------
     */
    const { simulation, events } = recordingSimulation(
      [hawkOwner(), makeTarget()],
      seconds(20),
    );
    const [actor, target] = simulation.combatants;
    actor.abilities.add(SUMMON_HAWK);
    simulation.begin();
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    simulation.run();

    const ids = new Set(
      events
        .filter((event) => event.type === 'damage' && event.abilityName === 'Hawk')
        .map((event) => (event as { abilityId?: string }).abilityId),
    );
    expect([...ids]).toEqual(['summon_hawk']);

    // And the two talents still name that id.
    expect(HUNTER_TALENT_EFFECTS.unleashed_fury).toContainEqual({
      kind: 'abilityDamage',
      abilityId: 'summon_hawk',
    });
    expect(HUNTER_TALENT_EFFECTS.ferocity).toContainEqual({
      kind: 'abilityCrit',
      abilityId: 'summon_hawk',
    });
  });

  it('is gated in the list at two hawks, not in the ability', () => {
    /*
     * The owner's clause: "cast summon hawk IF summoned_hawks < 2". Without it
     * this list casts every six seconds for the whole fight, spending 190 mana
     * to restart a hawk with twelve seconds left on a build that runs dry.
     */
    const entry = HUNTER_BEAST_MASTERY.entries.find((e) => e.abilityId === 'summon_hawk');
    expect(entry?.condition).toBeDefined();

    const { simulation } = recordingSimulation([hawkOwner(), makeTarget()], seconds(60));
    const [actor, target] = simulation.combatants;
    simulation.begin();

    expect(compiled(entry!.condition)!(simulation, actor, target)).toBe(true);
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    expect(compiled(entry!.condition)!(simulation, actor, target)).toBe(true);
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    expect(compiled(entry!.condition)!(simulation, actor, target)).toBe(false);
  });
});

describe('the three talents whose reasons were wrong', () => {
  it('Rapid Killing takes two minutes off Rapid Fire', () => {
    /*
     * ITS OWN REASON CLAIMED THIS WORKED AND NOTHING APPLIED IT. Worth no DPS
     * to either build that takes it -- 5 minutes and 3 minutes are both longer
     * than a fight, so Rapid Fire is cast once either way -- which is exactly
     * why only a mechanism test catches it.
     */
    /*
     * BUILT BY HAND RATHER THAN READ OFF A PROFILE, which is the repair this
     * project has now made five times: this used to compare BM Hunter against
     * LW Ranged, and LW Ranged stopped taking Rapid Killing the day its two
     * points bought Improved Stings instead. A test that reads a profile to pin
     * a MECHANISM breaks on a revision that has nothing to do with it.
     *
     * AND NO PROFILE TAKES IT NOW, which is a fact worth pinning SEPARATELY --
     * see below. It is worth no DPS to anything: five minutes and three minutes
     * are both longer than a fight, so Rapid Fire is cast once either way,
     * which is exactly why only a mechanism test catches it at all.
     */
    const cooldownWith = (rapid_killing: number) => {
      const hunter = createPlayer({
        race: 'orc',
        characterClass: 'hunter',
        combatStyle: 'ranged',
        talents: legalise({ rapid_killing }, 'hunter'),
      });
      return toSeconds(hunter.abilities.get('rapid_fire')!.cooldownMs!);
    };

    expect(cooldownWith(0)).toBe(300);
    expect(cooldownWith(2)).toBe(180);
  });

  it('is taken by no profile, because the fight is shorter than either cooldown', () => {
    for (const preset of ['bm_hunter', 'lw_ranged']) {
      expect(PRESETS_BY_ID.get(preset)!.build().talents.rapid_killing ?? 0, preset).toBe(0);
    }
  });

  it('Bestial Discipline lets half the mana regeneration through', () => {
    /*
     * "allows 50% of your Mana regeneration to continue while casting", at 2/2.
     * `manaRegenBypass` is read during the FIVE SECOND RULE rather than during a
     * literal cast, which is why the reason this replaces -- "a Hunter has no
     * cast long enough for it to reach" -- was wrong about the engine as well as
     * about the Hunter, who has a four-second Sniper Shot.
     */
    const profile = PRESETS_BY_ID.get('bm_hunter')!.build();
    expect(profile.talents.bestial_discipline).toBe(2);
    const hunter = characterAtCombatStart(profile)!;
    expect(hunter.stats.get('manaRegenBypass')).toBe(50);

    // The pet's focus half still works: the row states focus FIRST.
    expect(talentBuild('hunter', { bestial_discipline: 2 }).pet.focusRegenMultiplier).toBeCloseTo(
      1.2,
      6,
    );
  });

  describe('Resourcefulness', () => {
    it('takes 60% off the melee abilities that cost mana, and the trap', () => {
      /*
       * A PERCENTAGE MANA COST IS `grantCastModifier`, which retired this exact
       * sentence for eleven talents. The reason survived because it was worded
       * around traps as well, so the wording test that catches the others missed
       * it.
       */
      const profile = PRESETS_BY_ID.get('lw_melee')!.build();
      expect(profile.talents.resourcefulness).toBe(2);
      const hunter = characterAtCombatStart(profile)!;

      // Mongoose Bite is 65 mana; 60% off is 26.
      expect(MONGOOSE_BITE.cost).toEqual({ resource: 'mana', amount: 65 });
      const bite = resolveCast(hunter, hunter.abilities.get('mongoose_bite')!);
      expect(bite.costAmount).toBeCloseTo(65 * 0.4, 6);

      // And the trap, at 245.
      const trap = resolveCast(hunter, hunter.abilities.get('immolation_trap')!);
      expect(trap.costAmount).toBeCloseTo(245 * 0.4, 6);
    });

    it('leaves the shots alone, which the talent does not name', () => {
      const hunter = characterAtCombatStart(PRESETS_BY_ID.get('lw_melee')!.build())!;
      const sting = resolveCast(hunter, hunter.abilities.get('serpent_sting')!);
      // Serpent Sting is 250 mana and this build takes no Efficiency.
      expect(sting.costAmount).toBeCloseTo(250, 6);
    });

    it('opens a mana-regeneration window on an ABILITY critical strike', () => {
      const reaction = resourcefulness(100);
      const { simulation } = recordingSimulation([makeAttacker(), makeTarget()]);
      const [actor, target] = simulation.combatants;
      simulation.begin();

      expect(actor.stats.get('manaRegenBypass')).toBe(0);
      const strike = {
        attacker: actor,
        defender: target,
        outcome: 'crit' as const,
        abilityId: 'raptor_strike',
        abilityName: 'Raptor Strike',
        amount: 500,
        weaponSlot: 'mainHand' as const,
        critical: true,
        attackTable: 'melee-special' as const,
      };
      expect(reaction.canTrigger?.(simulation, actor, strike) ?? true).toBe(true);
      reaction.onTrigger(simulation, actor, strike);

      expect(actor.auras.has(RESOURCEFULNESS_REGEN.id)).toBe(true);
      expect(actor.stats.get('manaRegenBypass')).toBe(RESOURCEFULNESS_REGEN_BYPASS_PERCENT);
      // 30 seconds, stated by the tooltip and constant across both ranks.
      expect(toSeconds(RESOURCEFULNESS_REGEN.durationMs)).toBe(30);
    });

    it('refuses every crit the patch narrowed it away from', () => {
      /*
       * ======================================================================
       * "ONLY ACTIVATING ON MELEE AND RANGED ABILITY CRITICAL STRIKES TO
       * PREVENT SPAMMING. IS NOT ACTIVATED BY TRAPS."
       *
       * It used to fire on ANY crit with no test at all -- a Serpent Sting
       * tick's crit opened the window as readily as a Raptor Strike's, which is
       * what the note means by spamming.
       *
       * DRIVEN AS A TABLE, because that is the one thing on the event which can
       * answer both halves of the note at once, and because the two halves fail
       * differently:
       *
       *   the AUTO tables   excluded by the word "ability", which this project
       *                     already reads as stopping at `-special`. A Hunter's
       *                     auto-shot is most of its crits, so this is the
       *                     larger half of the narrowing and the note does not
       *                     name it
       *   a TRAP            declares NO table -- it cannot miss -- and crits
       *                     through `critFrom: 'ranged-special'`. So a table
       *                     CHECK alone is not enough: the event's `attackTable`
       *                     is undefined for a trap, which is what excludes it,
       *                     and a reader who assumed `critFrom` filled that
       *                     field in would have let both traps through
       *   a periodic TICK   has no table either, so Serpent Sting's burn and
       *                     Lacerating Strikes' bleed go with the traps
       *
       * THE CHANCE IS 100 SO A REFUSAL IS NEVER A LOST ROLL, which matters:
       * `canTrigger` rolls the dice as its last clause, so at any lower chance
       * a `false` here would be indistinguishable from bad luck.
       * ======================================================================
       */
      const reaction = resourcefulness(100);
      const { simulation } = recordingSimulation([makeAttacker(), makeTarget()]);
      const [actor, target] = simulation.combatants;
      simulation.begin();

      const crit = (
        abilityId: string | undefined,
        attackTable: AttackTableKind | undefined,
      ) =>
        reaction.canTrigger?.(
          simulation,
          actor,
          {
            attacker: actor,
            defender: target,
            outcome: 'crit',
            abilityId,
            abilityName: abilityId ?? 'Auto-Attack',
            amount: 500,
            critical: true,
            attackTable,
          } as never,
        ) ?? true;

      // The two the note keeps.
      expect(crit('raptor_strike', 'melee-special')).toBe(true);
      expect(crit('aimed_shot', 'ranged-special')).toBe(true);

      // The swing and the shot, which "ability" excludes.
      expect(crit(undefined, 'melee-auto')).toBe(false);
      expect(crit(undefined, 'ranged-auto')).toBe(false);

      // Both traps, which the note excludes by name and which carry NO table.
      expect(crit('immolation_trap', undefined)).toBe(false);
      expect(crit('explosive_trap', undefined)).toBe(false);

      // And a damage-over-time tick, which has no table either.
      expect(crit('serpent_sting', undefined)).toBe(false);
    });

    it('builds its proc from the CHANCE and not from the cost reduction', () => {
      /*
       * `valueIndex: 1`. The row is [cost%, chance%, bypass%, seconds] and at
       * rank 1 the first two are both 30 -- so only rank 2, where they are 60
       * and 60, would... also agree. They agree at every rank, which is why this
       * asserts the reaction EXISTS on a build with the talent and nothing about
       * its number: a value test here could not tell the two apart.
       */
      const build = talentBuild('hunter', { resourcefulness: 2 });
      expect(build.reactions.map((r) => r.id)).toContain('resourcefulness');
    });
  });
});

// ---------------------------------------------------------------------------

describe('a pet’s damage is reported as the pet’s', () => {
  it('names a pet swing after the pet, not after a hand the owner is not using', () => {
    /*
     * ------------------------------------------------------------------------
     * THE ROW WAS 38.1% OF BEAST MASTERY AND NONE OF IT WAS THE HUNTER'S. The
     * damage breakdown pools by ability NAME across every friendly actor, so the
     * pet's main-hand swing landed under "Main Hand Auto-Attack" -- on a profile
     * whose combat style is `ranged` and which never swings a melee weapon at
     * all. The shares still summed to 100% and nothing contradicted it.
     *
     * `docs/handoff/hunter.md` read that row and concluded "BM Hunter is the
     * only profile that swings BOTH melee and ranged". This is the test that
     * stops the label saying it again.
     * ------------------------------------------------------------------------
     */
    const owner = createPlayer({
      race: 'orc',
      characterClass: 'hunter',
      combatStyle: 'ranged',
      talents: {},
    });
    const pet = createPet({ owner, family: 'cat' });

    expect(autoAttackName(pet, 'mainHand')).toBe('Cat Melee');
    expect(autoAttackName(owner, 'mainHand')).toBe(AUTO_ATTACK_NAMES.mainHand);
  });

  it('keeps the Beast Mastery profile’s melee row out of the Hunter’s own rows', () => {
    const profile = PRESETS_BY_ID.get('bm_hunter')!.build();
    expect(profile.character.combatStyle).toBe('ranged');

    const hunter = characterAtCombatStart(profile)!;
    // A ranged style swings the ranged slot and nothing else.
    expect(hunter.autoAttack).toBe('ranged');
  });

  it('carries the owner’s stated damage rather than an invented one', () => {
    /*
     * THE LAST PLACEHOLDER IN THE PET MODEL IS GONE. It was 50, then 150 for a
     * day, and is now 36.34 to 55.32 a swing from the owner's full model --
     * base damage, base stats and the two formulas that turn them into attack
     * power and crit. Pinned here as the two numbers the owner wrote;
     * `petsAndHunter.test.ts` checks the engine reproduces the range.
     */
    expect(PET_BASE_DAMAGE_MIN).toBe(36.34);
    expect(PET_BASE_DAMAGE_MAX).toBe(55.32);
    expect(PET_BASE_STRENGTH).toBe(136);
  });
});

// ---------------------------------------------------------------------------

describe('the melee Hunter dual-wields', () => {
  /*
   * ----------------------------------------------------------------------------
   * THE RULESET OWNER'S CHANGE, 2026-10-03: "instead of a two-hander being the
   * default weapon I want it to be dual wield. The main hand weapon should be:
   * vis'kag with crusader enchant. The off hand weapon should be: core hound
   * tooth with crusader enchant."
   *
   * IT IS A CHANGE TO FOUR OF THE FIVE SETTINGS A BUILD HAS TO AGREE ON -- the
   * style, the gear, and through them what two talents are worth -- which is why
   * these are asserted together rather than as a weapon swap.
   * ----------------------------------------------------------------------------
   */
  const melee = () => PRESETS_BY_ID.get('lw_melee')!.build();

  it('holds Vis\u2019kag and the Core Hound Tooth, both enchanted', () => {
    const profile = melee();
    expect(profile.character.combatStyle).toBe('dual_wield');
    /*
     * THE ENCHANTS, NOT THE ITEMS. Vis'kag and the Core Hound Tooth were
     * Season of Discovery stand-ins and went with the rest of them; the melee
     * Hunter wears the E65 benchmark set now. What this test was really about
     * survives: it dual-wields, and BOTH hands carry Crusader.
     */
    expect(profile.equipment.mainHand?.enchantId).toBe(CRUSADER.id);
    expect(profile.equipment.offHand?.enchantId).toBe(CRUSADER.id);
    // The two-hander is gone rather than carried alongside.
    expect(profile.equipment.twoHand).toBeUndefined();
  });

  it('swings both hands, where it used to swing one', () => {
    const hunter = characterAtCombatStart(melee())!;
    expect(hunter.autoAttack).toBe('dual-wield');
    expect(hunter.weapons.mainHand).toBeDefined();
    expect(hunter.weapons.offHand).toBeDefined();
    /*
     * THE BOW IS STILL EQUIPPED AND HAS NO WEAPON PROFILE, which is the rule
     * rather than a loss: `weaponsForEquipment` skips the ranged slot unless
     * the style marks it `required`, while `statsForStyle` reads
     * `liveEquipment` and so counts Rhok'delar's stats either way. A ranged
     * weapon coexists with a one-hander and simply does not swing.
     *
     * Unchanged by this commit -- the two-hander build was the same -- and
     * asserted because "the melee Hunter lost its bow" is the obvious wrong
     * conclusion to draw from a dual-wield switch.
     */
    expect(melee().equipment.ranged).toBeDefined();
    expect(hunter.weapons.ranged).toBeUndefined();
  });

  /*
   * ==========================================================================
   * THE CRIT-DAMAGE HALF, AND WHICH TABLE IT REACHES.
   *
   * The owner's ruling: Predator's Edge "does NOT affect the hunter's
   * auto-attack swings, unless it was upgraded to a Raptor Strike on next
   * hit. This functions very similarly to warrior's Impale talent and Heroic
   * Strike."
   *
   * SO THE RAPTOR STRIKE CLAUSE IS ASSERTED THROUGH THE ABILITY RATHER THAN
   * THROUGH A SPECIAL CASE, because there is no special case: an on-next-swing
   * ability declares `melee-special` and resolves there, so "the swing, when it
   * was upgraded" and "a special" are the same set. A test that only read the
   * declaration would pass against a version that put `melee-auto` back with
   * an exception bolted on; this one would not.
   * ==========================================================================
   */
  it('raises melee SPECIALS and leaves an ordinary swing alone', () => {
    const hunter = characterAtCombatStart(melee())!;
    expect(melee().talents!.predator_s_edge).toBe(5);

    // 30% at 5/5, and a melee crit's bonus half is 1.0, so +0.30.
    expect(hunter.attackTableModifiers.for('melee-special').critMultiplierBonus).toBeCloseTo(
      0.3,
      10,
    );
    expect(hunter.attackTableModifiers.for('melee-auto').critMultiplierBonus ?? 0).toBe(0);
    // And nothing on the ranged tables, which is what it over-applied to
    // before it was scoped to melee at all.
    expect(hunter.attackTableModifiers.for('ranged-auto').critMultiplierBonus ?? 0).toBe(0);
    expect(hunter.attackTableModifiers.for('ranged-special').critMultiplierBonus ?? 0).toBe(0);
  });

  it('reaches Raptor Strike because an on-next-swing ability IS a special', () => {
    const raptor = characterAtCombatStart(melee())!.abilities.get('raptor_strike')!;
    /*
     * BOTH FIELDS TOGETHER ARE THE CLAUSE. `onNextSwing` is what makes it
     * replace the swing the owner says is otherwise excluded, and
     * `attackTable` is what puts the replacement on the table the talent
     * raises. Either alone would leave the ruling unimplemented.
     */
    expect(raptor.onNextSwing).toBeDefined();
    expect(raptor.attackTable).toBe('melee-special');
  });

  it('pays a 25% off-hand penalty, not 50%, because of Predator\u2019s Edge', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S FIGURE: "it becomes a 25% penalty with rank 5 predator's
     * edge." Written out here from the two numbers that produce it rather than
     * as 0.75, because 0.75 is right at rank 5 and wrong at every other rank:
     *
     *     OFF_HAND_DAMAGE_MULTIPLIER x (1 + 50 / 100) = 0.5 x 1.5 = 0.75
     *
     * The talent MULTIPLIES the penalty; it does not replace it. Reading "the
     * penalty becomes 25%" as an instruction to write 0.75 somewhere would
     * agree with the owner today and silently stop scaling.
     * ------------------------------------------------------------------------
     */
    const profile = melee();
    expect(profile.talents.predator_s_edge).toBe(5);

    const hunter = characterAtCombatStart(profile)!;
    expect(hunter.weapons.offHand?.damageMultiplier).toBeCloseTo(
      OFF_HAND_DAMAGE_MULTIPLIER * 1.5,
      10,
    );
    expect(hunter.weapons.offHand?.damageMultiplier).toBeCloseTo(0.75, 10);

    // And the main hand is untouched by any of it.
    expect(hunter.weapons.mainHand?.damageMultiplier ?? 1).toBe(1);
  });

  it('builds the multiplier from the rank, so it is not pinned to 5/5', () => {
    /*
     * The row is [crit damage, off-hand damage] and the two differ at every rank
     * -- 6/10 through 30/50 -- so this is also the check that `valueIndex: 1`
     * reads the second number and not the first.
     */
    for (const [rank, offHandBonus] of [
      [1, 10],
      [3, 30],
      [5, 50],
    ] as const) {
      const build = talentBuild('hunter', { predator_s_edge: rank });
      expect(build.offHandDamageMultiplier).toBeCloseTo(1 + offHandBonus / 100, 10);
    }
  });

  it('rolls Deadly Aspects off EITHER hand, which "all melee auto attacks" says', () => {
    /*
     * ------------------------------------------------------------------------
     * EQUIVALENT BY ACCIDENT UNTIL THE BUILD CHANGED. The reaction checked
     * `isWeaponUseOf(attack, 'mainHand')`, and while this Hunter held a
     * two-hander that WAS "any melee swing" -- one slot swings. Dual wielding
     * separated them, and the off hand is a 1.30-second dagger, so it swings
     * MORE often than the main hand and every one of those was failing to roll.
     *
     * The tooltip is explicit: "all melee auto attacks".
     * ------------------------------------------------------------------------
     */
    const reaction = deadlyAspects(100);
    const { simulation } = recordingSimulation([makeAttacker(), makeTarget()]);
    const [actor, target] = simulation.combatants;
    simulation.begin();
    simulation.applyAura(actor, ASPECT_OF_THE_BEAST, actor.id);

    const swing = (weaponSlot: 'mainHand' | 'offHand' | 'ranged') => ({
      attacker: actor,
      defender: target,
      outcome: 'hit' as const,
      abilityId: undefined,
      abilityName: 'Auto-Attack',
      amount: 100,
      weaponSlot,
      critical: false,
    });

    expect(reaction.canTrigger!(simulation, actor, swing('mainHand'))).toBe(true);
    expect(reaction.canTrigger!(simulation, actor, swing('offHand'))).toBe(true);
    // The bow is not a melee auto attack, and Aspect of the Beast is what is up.
    expect(reaction.canTrigger!(simulation, actor, swing('ranged'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('Wing Clip is pressed for the procs, not the 50', () => {
  /*
   * ----------------------------------------------------------------------------
   * THE RULESET OWNER'S REASON FOR ADDING IT: "even though it only deals 50 base
   * damage and has no attack power coefficient it can still count as a melee use
   * in order to trigger things like hand of justice, windfury, and expose prey."
   *
   * So the assertions below are about the TRIGGER more than the damage. An
   * ability whose 50 landed correctly and triggered nothing would pass a damage
   * test and be worth a fraction of what this is.
   * ----------------------------------------------------------------------------
   */
  it('costs and hits for what the capture states', () => {
    expect(WING_CLIP.cost).toEqual({ resource: 'mana', amount: 80 });
    expect(WING_CLIP_DAMAGE).toBe(50);
    // No cooldown, which is what makes it a true floor under the list.
    expect(WING_CLIP.cooldownMs).toBeUndefined();
    expect(WING_CLIP.attackTable).toBe('melee-special');
  });

  it('is a MAIN-HAND weapon use, which is the whole point of it', () => {
    /*
     * `weaponSlot` and `weaponScaling` are different questions and this is the
     * clearest case of it: the first says whose procs fire, the second says what
     * the damage reads. Wing Clip answers the first and declines the second.
     */
    const { simulation, events } = recordingSimulation([
      makeAttacker({
        stats: { attackPower: 0, critChance: -100 },
        resources: [{ type: 'mana', maximum: 10_000 }],
        /*
         * ASSERTED THROUGH A PROC ACTUALLY FIRING, because the damage telemetry
         * carries no `weaponSlot` -- it has `abilityName` and not the slot. So
         * the only honest way to show the pipeline treats this as a weapon use
         * is to give the actor a reaction that fires on one and watch it go
         * off, which is also what the owner actually asked for.
         *
         * BUILT IN RATHER THAN PUSHED: `reactions` is a readonly array, and the
         * typechecker says so even though a push passes at runtime.
         */
        reactions: [exposePrey(100)],
      }),
      makeTarget(),
    ]);
    const [actor, target] = simulation.combatants;
    simulation.begin();
    expect(actor.auras.has('expose_prey')).toBe(false);

    WING_CLIP.onCast({ simulation, caster: actor, target, ability: WING_CLIP });

    expect(events.some((e) => e.type === 'damage' && e.abilityName === 'Wing Clip')).toBe(true);
    expect(actor.auras.has('expose_prey')).toBe(true);
  });

  it('takes no attack power at all, at any gear level', () => {
    const damageAt = (attackPower: number) => {
      const { simulation, events } = recordingSimulation([
        makeAttacker({
          stats: { attackPower, critChance: -100 },
          resources: [{ type: 'mana', maximum: 10_000 }],
        }),
        makeTarget({ stats: { armor: 0 } }),
      ]);
      const [actor, target] = simulation.combatants;
      simulation.begin();
      WING_CLIP.onCast({ simulation, caster: actor, target, ability: WING_CLIP });
      return damageBy(events, actor.id).get('Wing Clip')?.total ?? 0;
    };

    /*
     * EQUAL AT BOTH, which is the assertion `weaponScaling` being absent earns.
     * A `weaponScaling: { slot: 'mainHand' }` added by someone "fixing" the
     * missing field would make these diverge by hundreds.
     */
    expect(damageAt(2000)).toBeCloseTo(damageAt(0), 6);
    expect(damageAt(0)).toBeCloseTo(WING_CLIP_DAMAGE, 6);
  });

  it('is the last entry, and a floor because it has no cooldown', () => {
    const ids = HUNTER_LONE_WOLF_MELEE.entries.map((entry) => entry.abilityId);
    expect(ids[ids.length - 1]).toBe('wing_clip');

    const entry = HUNTER_LONE_WOLF_MELEE.entries[ids.length - 1];
    expect(entry.condition).toBeUndefined();

    /*
     * AND THAT IS WHY IT IS LAST RATHER THAN MERELY LOW. Immolation Trap above
     * it is ungated too, but has a 30-second cooldown, so the list falls past
     * it; Wing Clip has none, so nothing below it could ever be reached.
     */
    const trap = HUNTER_LONE_WOLF_MELEE.entries.find((e) => e.abilityId === 'immolation_trap')!;
    expect(trap.condition).toBeUndefined();
    expect(IMMOLATION_TRAP_ABILITY.cooldownMs).toBeGreaterThan(0);
  });

  it('feeds Expose Prey, which is what opens Mongoose Bite here', () => {
    /*
     * ------------------------------------------------------------------------
     * THE PAYOFF, AND IT IS FOUR ROWS ABOVE IT IN THE LIST. Mongoose Bite's only
     * route in this build is the Expose Prey aura -- the ability says "can only
     * be performed after you dodge" and nothing attacks this Hunter -- and
     * Expose Prey rolls off any landed attack. A filler that lands 22 times a
     * fight is 22 more rolls for it.
     *
     * Asserted as the reaction ACCEPTING a Wing Clip, rather than as a use
     * count, because the count is a rotation outcome and this is the mechanism.
     * ------------------------------------------------------------------------
     */
    const reaction = exposePrey(100);
    const { simulation } = recordingSimulation([makeAttacker(), makeTarget()]);
    const [actor, target] = simulation.combatants;

    const clip = {
      attacker: actor,
      defender: target,
      outcome: 'hit' as const,
      abilityId: 'wing_clip',
      abilityName: 'Wing Clip',
      amount: WING_CLIP_DAMAGE,
      weaponSlot: 'mainHand' as const,
      // Wing Clip's own table: Expose Prey names its tables since round 69.
      attackTable: WING_CLIP.attackTable,
      critical: false,
    };

    expect(reaction.canTrigger!(simulation, actor, clip)).toBe(true);
    // A Wing Clip that was dodged triggers nothing, which is the honest cost of
    // being a weapon use rather than a free proc.
    expect(reaction.canTrigger!(simulation, actor, { ...clip, amount: 0 })).toBe(false);
  });

  it('does NOT feed Deadly Aspects, which wants an auto-attack', () => {
    /*
     * The melee half reads "all melee AUTO attacks", and an absent `abilityId`
     * is that test. Wing Clip is an ability, so it is correctly excluded --
     * asserted because "it is a melee weapon use" is true and would make the
     * wrong conclusion easy.
     */
    const reaction = deadlyAspects(100);
    const { simulation } = recordingSimulation([makeAttacker(), makeTarget()]);
    const [actor, target] = simulation.combatants;
    simulation.begin();
    simulation.applyAura(actor, ASPECT_OF_THE_BEAST, actor.id);

    expect(
      reaction.canTrigger!(simulation, actor, {
        attacker: actor,
        defender: target,
        outcome: 'hit',
        abilityId: 'wing_clip',
        abilityName: 'Wing Clip',
        amount: WING_CLIP_DAMAGE,
        weaponSlot: 'mainHand',
        critical: false,
      }),
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */

describe('both ranged lists cast every shot the build owns', () => {
  /*
   * ============================================================================
   * ARCANE SHOT WAS IN BM HUNTER'S BOOK AND IN NO LIST, dealing nothing, for the
   * life of the profile. It is a trainer shot every Hunter owns from level 6 and
   * it is **14.6% of LW Ranged's damage**; adding the entry was worth **+31**.
   *
   * THERE IS NO ZERO ANYWHERE FOR THAT. An entry that fires zero times prints a
   * zero and gets looked at; an ability with no entry at all simply has no row,
   * and the damage table still sums to 100%. `ability_audit.ts` is the tool for
   * it, and this is the regression guard for the two profiles it caught.
   *
   * THE ASSERTION IS THE LIST AND NOT THE ORDER. Where Arcane Shot sits is a
   * rotation decision -- measured, and at the bottom for BM because above Summon
   * Hawk it is -48.6 -- and a test that pins an ORDER has to give way the next
   * time somebody measures one.
   * ============================================================================
   */
  const SHOTS = ['arcane_shot', 'aimed_shot', 'serpent_sting'] as const;

  it('names Arcane Shot in both ranged lists', () => {
    for (const list of [HUNTER_BEAST_MASTERY, HUNTER_LONE_WOLF_RANGED]) {
      const ids = list.entries.map((entry) => entry.abilityId);
      for (const shot of SHOTS) expect(ids, `${list.name}: ${shot}`).toContain(shot);
    }
  });

  it('casts it in a real fight on both, rather than merely listing it', () => {
    /*
     * THE LIST AND THE BOOK HAVE TO AGREE, which naming an id does not
     * establish: `PriorityRotation` skips an ability the character never
     * learned IN SILENCE, so an entry can be present and permanently inert.
     */
    for (const preset of ['bm_hunter', 'lw_ranged']) {
      const batch = batchOf(preset, 10, 4242);
      const arcane = batch.abilities.find((row) => row.abilityName === 'Arcane Shot');
      expect(arcane, preset).toBeDefined();
      expect(arcane!.uses, preset).toBeGreaterThan(0);
      expect(arcane!.damage, preset).toBeGreaterThan(0);
    }
  });
});

describe('the two ranged Hunter trees are legal and spend all fifty-one', () => {
  /*
   * ============================================================================
   * CHECKED AGAINST talentsforever.com AS WELL AS AGAINST THE RULES. Both URLs
   * were loaded in the calculator and read back their spread with "all 51
   * spent" and nothing refunded:
   *
   *   BM Hunter    31/20/0   .../hunter/60/5320001505101251-30520500005--ACBGHJMKNOPSVQUa-3
   *   LW Ranged     5/41/5   .../hunter/60/5-3053450511503051-5-ASQVYXZacefWgbdC-3
   *
   * THIS EXISTS BECAUSE THE SHOCKADIN SHIPPED AN ILLEGAL TREE. `legalAllocation`
   * now enforces `pointsBelowTier`, so a tree that would be refused in game
   * fails here -- where before it was silently stripped by `createPlayer` and
   * measured as a finding.
   * ============================================================================
   */
  it.each([
    ['bm_hunter', 31, 20, 0],
    ['lw_ranged', 5, 41, 5],
  ])('%s spends %i/%i/%i, all of it legal', (preset, bm, marks, survival) => {
    const hunter = talentsForClass('hunter')!;
    const allocation = PRESETS_BY_ID.get(preset as string)!.build().talents;

    const { allocation: legal, dropped } = legalAllocation(hunter, allocation);
    expect(dropped, preset as string).toEqual([]);
    expect(Object.values(legal).reduce((a, b) => a + b, 0)).toBe(51);

    const inTree = (tree: string) =>
      Object.entries(allocation).reduce(
        (n, [id, points]) => n + (hunter.byId.get(id)?.tree === tree ? points : 0),
        0,
      );
    expect(inTree('beast_mastery')).toBe(bm);
    expect(inTree('marksmanship')).toBe(marks);
    expect(inTree('survival')).toBe(survival);
  });
});

/* -------------------------------------------------------------------------- */

describe('Arcane Shot and Summon Hawk share a cooldown', () => {
  /*
   * ============================================================================
   * "SHARES COOLDOWN WITH ARCANE SHOT", which the Hunter wiki states outright
   * and both abilities declare as `cooldownGroup: 'arcane_shot'`.
   *
   * ASSERTED ON THE EVENT STREAM AND NOT ON THE DECLARATION, because a
   * `cooldownGroup` that is declared and never exercised looks exactly like one
   * that works -- and this one became load-bearing the day Arcane Shot entered
   * BM Hunter's list, where before it had one member and nothing to share with.
   * ============================================================================
   */
  const SHARED = new Set(['arcane_shot', 'summon_hawk']);

  const castGaps = (preset: string, seeds: readonly number[]) => {
    const built = PRESETS_BY_ID.get(preset)!.build();
    const gaps: number[] = [];
    const counts = new Map<string, number>();
    for (const seed of seeds) {
      const run = runProfile(
        { ...built, simulation: { ...built.simulation, iterations: 1, seed } },
        seed,
      );
      const times = run.timeline
        .filter((e) => e.type === 'cast' && SHARED.has((e as { abilityId: string }).abilityId))
        .map((e) => ({ at: e.timestamp, id: (e as { abilityId: string }).abilityId }));
      for (const t of times) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
      for (let i = 1; i < times.length; i += 1) gaps.push(times[i].at - times[i - 1].at);
    }
    return { gaps, counts };
  };

  it('never lets BM Hunter cast either one within six seconds of the other', () => {
    const { gaps, counts } = castGaps('bm_hunter', [12345, 777, 20260101, 4242, 99]);

    // Both are actually being cast, or the assertion below is about nothing.
    expect(counts.get('summon_hawk') ?? 0).toBeGreaterThan(0);
    expect(counts.get('arcane_shot') ?? 0).toBeGreaterThan(0);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(seconds(6));
  });

  it('is what bounds the pair, rather than either ability on its own', () => {
    /*
     * THE CHECK THAT THE GROUP IS DOING THE WORK. Both are 6-second abilities,
     * so a build that ignored the group could cast ten of EACH in a sixty
     * second fight. The combined count has to fit in one ability's budget.
     */
    const { counts } = castGaps('bm_hunter', [12345]);
    const total = (counts.get('summon_hawk') ?? 0) + (counts.get('arcane_shot') ?? 0);
    expect(total).toBeLessThanOrEqual(11); // sixty seconds over six, plus the opener
  });
});
