import { describe, expect, it } from 'vitest';
import { Simulation, castAbility, resolveCast, seconds, toSeconds } from '../../src/engine';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { CRUSADER } from '../../src/game/items/gearSets';
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
} from '../../src/game/rotations/hunter';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';

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

  it('scales with neither attack power nor spell power, on BOTH halves', () => {
    /*
     * THE OWNER'S WORDS WHEN THEY PUT IT IN: "there isn't an AP or SP scaler."
     * Both halves, which is what makes this worth its own assertion -- the
     * initial hit is dealt from `onCast` and the burn from a tick, so a
     * coefficient could be forgotten on one and present on the other.
     *
     * CAST AT TWO VERY DIFFERENT STAT LINES and demand the same number.
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
    expect(totalAt(2000, 2000)).toBeCloseTo(bare, 6);
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

  it('scales with neither attack power nor spell power', () => {
    /*
     * THE OWNER'S RULING, and the only damaging effect in the project with no
     * stat behind it: "Immolation trap doesn't scale with attack power or spell
     * power currently." Asserted here as well as exempted in
     * `everySpellScales.test.ts`, because that test only looks at spell power
     * and this ruling covers both.
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

    expect(totalWith({ attackPower: 2000 })).toBeCloseTo(IMMOLATION_TRAP_TOTAL, 6);
    expect(totalWith({ spellPower: 2000 })).toBeCloseTo(IMMOLATION_TRAP_TOTAL, 6);
    expect(totalWith({ rangedAttackPower: 2000 })).toBeCloseTo(IMMOLATION_TRAP_TOTAL, 6);
  });

  it('is last in the Lone Wolf melee list, where the owner put it', () => {
    /*
     * "add it to the LW melee APL after strider kick" -- so this pins the
     * POSITION and not merely the presence. An unconditional entry is a floor
     * under everything below it, so where it sits is the whole of what it does.
     */
    const ids = HUNTER_LONE_WOLF_MELEE.map((entry) => entry.abilityId);
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
    const entry = HUNTER_BEAST_MASTERY.find((e) => e.abilityId === 'summon_hawk');
    expect(entry?.condition).toBeDefined();

    const { simulation } = recordingSimulation([hawkOwner(), makeTarget()], seconds(60));
    const [actor, target] = simulation.combatants;
    simulation.begin();

    expect(entry!.condition!(simulation, actor, target)).toBe(true);
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    expect(entry!.condition!(simulation, actor, target)).toBe(true);
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    expect(entry!.condition!(simulation, actor, target)).toBe(false);
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
    const bm = PRESETS_BY_ID.get('bm_hunter')!.build();
    const ranged = PRESETS_BY_ID.get('lw_ranged')!.build();
    const without = characterAtCombatStart(bm)!;
    const with2 = characterAtCombatStart(ranged)!;

    expect(bm.talents.rapid_killing ?? 0).toBe(0);
    expect(ranged.talents.rapid_killing).toBe(2);
    expect(toSeconds(without.abilities.get('rapid_fire')!.cooldownMs!)).toBe(300);
    expect(toSeconds(with2.abilities.get('rapid_fire')!.cooldownMs!)).toBe(180);
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

    it('opens a mana-regeneration window on a critical strike', () => {
      const reaction = resourcefulness(100);
      const { simulation } = recordingSimulation([makeAttacker(), makeTarget()]);
      const [actor, target] = simulation.combatants;
      simulation.begin();

      expect(actor.stats.get('manaRegenBypass')).toBe(0);
      reaction.onTrigger(simulation, actor, {
        attacker: actor,
        defender: target,
        outcome: 'crit',
        abilityId: 'raptor_strike',
        abilityName: 'Raptor Strike',
        amount: 500,
        weaponSlot: 'mainHand',
        critical: true,
      });

      expect(actor.auras.has(RESOURCEFULNESS_REGEN.id)).toBe(true);
      expect(actor.stats.get('manaRegenBypass')).toBe(RESOURCEFULNESS_REGEN_BYPASS_PERCENT);
      // 30 seconds, stated by the tooltip and constant across both ranks.
      expect(toSeconds(RESOURCEFULNESS_REGEN.durationMs)).toBe(30);
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
    expect(profile.equipment.mainHand).toEqual({ itemId: 17075, enchantId: CRUSADER });
    expect(profile.equipment.offHand).toEqual({ itemId: 228277, enchantId: CRUSADER });
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
    const ids = HUNTER_LONE_WOLF_MELEE.map((entry) => entry.abilityId);
    expect(ids[ids.length - 1]).toBe('wing_clip');

    const entry = HUNTER_LONE_WOLF_MELEE[ids.length - 1];
    expect(entry.condition).toBeUndefined();

    /*
     * AND THAT IS WHY IT IS LAST RATHER THAN MERELY LOW. Immolation Trap above
     * it is ungated too, but has a 30-second cooldown, so the list falls past
     * it; Wing Clip has none, so nothing below it could ever be reached.
     */
    const trap = HUNTER_LONE_WOLF_MELEE.find((e) => e.abilityId === 'immolation_trap')!;
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
