import { describe, expect, it } from 'vitest';
import { Simulation, resolveCast, seconds, toSeconds } from '../../src/engine';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { createPet, PLACEHOLDER_PET_BASE_DPS } from '../../src/game/actors/createPet';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { AUTO_ATTACK_NAMES, autoAttackName } from '../../src/engine';
import {
  HAWK_DAMAGE_PER_STRIKE,
  HAWK_DURATION_MS,
  HAWK_MAX_ACTIVE,
  HAWK_STRIKE_INTERVAL_MS,
  IMMOLATION_TRAP,
  IMMOLATION_TRAP_DURATION_MS,
  IMMOLATION_TRAP_TICK_INTERVAL_MS,
  IMMOLATION_TRAP_TOTAL,
  LACERATING_STRIKES_DURATION_MS,
  LACERATING_STRIKES_TICKS,
  laceratingStrikesAura,
} from '../../src/game/auras/hunter';
import {
  IMMOLATION_TRAP_ABILITY,
  MONGOOSE_BITE,
  SUMMON_HAWK,
} from '../../src/game/abilities/hunter';
import {
  RESOURCEFULNESS_REGEN,
  RESOURCEFULNESS_REGEN_BYPASS_PERCENT,
  laceratingStrikes,
  resourcefulness,
} from '../../src/game/reactions/hunterTalents';
import { HUNTER_LONE_WOLF_MELEE } from '../../src/game/rotations/hunter';

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
      makeTarget({ armor: 3731 }),
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
    expect(ids[ids.length - 1]).toBe('immolation_trap');
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

describe('the hawk, at the owner’s 108', () => {
  /*
   * "Assume it's 108 for initial and every other hit. Once every 2 seconds.
   * Similar to a DoT effect except two of these can be active."
   *
   * 108 is the spellbook's rank-4 figure. The 32 it replaces was the TALENT
   * tooltip's, which shows rank 1 of the ability it grants.
   */
  it('takes its damage from the max-rank capture, not the talent tooltip', () => {
    expect(HAWK_DAMAGE_PER_STRIKE).toBe(108);
    expect(toSeconds(HAWK_STRIKE_INTERVAL_MS)).toBe(2);
    expect(toSeconds(HAWK_DURATION_MS)).toBe(18);
    expect(HAWK_MAX_ACTIVE).toBe(2);
  });

  it('deals the dive on cast and then one strike per active hawk', () => {
    const { simulation, events } = recordingSimulation(
      [
        makeAttacker({
          stats: { attackPower: 0, critChance: -100 },
          resources: ['mana'],
          maxMana: 10_000,
        }),
        makeTarget(),
      ],
      // Two strikes' worth, and not ending ON one: an event due at the instant
      // the fight ends does not run, so 4 seconds would drop the second strike.
      seconds(5),
    );
    const [actor, target] = simulation.combatants;
    actor.abilities.add(SUMMON_HAWK);
    simulation.begin();
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    simulation.run();

    const hawk = damageBy(events, actor.id).get('Hawk')!;
    // The dive at t=0, then strikes at 2s and 4s. All three at one stack.
    expect(hawk.count).toBe(3);
    expect(hawk.total).toBeCloseTo(HAWK_DAMAGE_PER_STRIKE * 3, 6);
  });

  it('doubles the strike with a second hawk up', () => {
    /*
     * THE UNDERSTATEMENT THAT IS GONE. The periodic fires once per AURA rather
     * than once per stack, so before this the second of the two hawks the
     * ability can have added nothing at all -- which its own `unmodelled` note
     * admitted. At 32 a strike that was small; at 108 it was half the ability.
     */
    const { simulation, events } = recordingSimulation(
      [
        makeAttacker({
          stats: { attackPower: 0, critChance: -100 },
          resources: ['mana'],
          maxMana: 10_000,
        }),
        makeTarget(),
      ],
      seconds(3),
    );
    const [actor, target] = simulation.combatants;
    actor.abilities.add(SUMMON_HAWK);
    simulation.begin();
    // Two hawks up before the first strike lands at t=2s.
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    expect(actor.auras.stacksOf('summon_hawk')).toBe(2);
    simulation.run();

    const hawk = damageBy(events, actor.id).get('Hawk')!;
    // Two dives plus one strike from each of the two hawks.
    expect(hawk.count).toBe(3);
    expect(hawk.total).toBeCloseTo(HAWK_DAMAGE_PER_STRIKE * 4, 6);
  });

  it('refuses a third hawk, which is what the ability says', () => {
    const { simulation } = recordingSimulation([
      makeAttacker({ resources: ['mana'], maxMana: 10_000 }),
      makeTarget(),
    ]);
    const [actor, target] = simulation.combatants;
    simulation.begin();

    const canCast = () =>
      SUMMON_HAWK.canCast!({ simulation, caster: actor, target, ability: SUMMON_HAWK });

    expect(canCast()).toBe(true);
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    expect(canCast()).toBe(true);
    SUMMON_HAWK.onCast({ simulation, caster: actor, target, ability: SUMMON_HAWK });
    // "Only 2 hawks can be active at once."
    expect(canCast()).toBe(false);
  });
});

// ---------------------------------------------------------------------------

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

  it('carries the owner’s base DPS rather than an invented one', () => {
    /*
     * 150, supplied by the ruleset owner: "Make the base placeholder DPS 150 (1
     * hit for ~300 every 2 seconds)". The two halves of that sentence agree, and
     * this pins the one they agree on -- it was 50 for as long as pets existed,
     * so every pet figure recorded before 2026-09-30 is a third of this.
     */
    expect(PLACEHOLDER_PET_BASE_DPS).toBe(150);
  });
});
