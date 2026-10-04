import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { castAbility, dealDamage, isWeaponUse, seconds, spellPowerFor } from '../../src/engine';
import {
  HAMMER_OF_WRATH,
  HAMMER_OF_WRATH_COEFFICIENT,
  HAMMER_OF_WRATH_DAMAGE,
  RIGHTEOUS_FURY_ABILITY,
  HOLY_STRIKE_HOLY_DAMAGE,
  HOLY_STRIKE_WEAPON_FRACTION,
  JUDGEMENT_OF_COMMAND,
  JUDGEMENT_OF_RIGHTEOUSNESS,
  TWIST_OF_LIGHT_FLAG,
} from '../../src/game/abilities/paladin';
import {
  RIGHTEOUS_FURY,
  SEAL_AURA_IDS,
  SEAL_OF_COMMAND_WEAPON_FRACTION,
  SEAL_OF_FURY_DAMAGE,
  SEAL_OF_RIGHTEOUSNESS_BASE,
  activeSeal,
  sealDamage,
  TEMPLARS_BULWARK,
  TEMPLARS_BULWARK_HEALTH_SHARE,
  sealOfRighteousnessCoefficient,
} from '../../src/game/auras/paladin';
import { SEAL_OF_COMMAND_PPM } from '../../src/game/reactions/paladin';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { paladinRotation } from '../../src/game/rotations/paladin';
import { EXECUTE_PHASE_FRACTION } from '../../src/game/combat/executePhase';
import { HAMMER_OF_WRATH_SP_COEFFICIENT } from '../../src/game/combat/coefficients';

/*
 * The Paladin's numbers, written out by hand from the beta client's spellbook.
 * The first class in the project whose damage scales with SPELL POWER.
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

/*
 * CASTS HAVE TO BE SPACED, because a seal takes a global cooldown like
 * anything else. Two `castAbility` calls at the same instant means the second
 * is simply REFUSED -- which reads as "the seal did not replace anything" and
 * is nothing of the kind.
 */
const castSpaced = (
  simulation: ReturnType<typeof buildSimulation>,
  actor: ReturnType<typeof bareBuild>,
  abilityId: string,
  at: number,
) => {
  simulation.advanceTo(at);
  const result = castAbility(simulation, actor, actor.abilities.get(abilityId)!, undefined);
  expect(result, `${abilityId} at ${at}ms`).toEqual({ ok: true });
};

/**
 * A Paladin with the real ability book and NO rotation of its own.
 *
 * A `createPlayer` Paladin carries its priority list, which acts the moment
 * the simulation begins and puts the character on the global cooldown -- so a
 * manual cast at t=0 is refused with `on_gcd` and the test measures nothing
 * while appearing to measure something. The abilities are the real ones, so
 * the talent flags they carry are real too.
 */
const bareBuild = (preset: string) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return makeAttacker({
    autoAttack: 'none',
    abilities: abilitiesForClass(
      'paladin',
      built.character.combatStyle as never,
      built.talents,
    ),
    resources: [{ type: 'mana', maximum: 100_000 }],
  });
};

const presetPlayer = (preset: string) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'human',
    characterClass: 'paladin',
    combatStyle: built.character.combatStyle as never,
    talents: built.talents,
    equipment: built.equipment,
  });
};

describe('the numbers', () => {
  it('takes the midpoint of each judgement, at MAX RANK', () => {
    // Figures that follow foreverchanges.pro where it and our own capture
    // disagree, by the ruleset owner's standing rule. Written out by hand
    // from the source and carrying the ruling, not only the number. See
    // docs/source-cross-checks.md.
    expect(JUDGEMENT_OF_RIGHTEOUSNESS).toBe(170);
    expect(JUDGEMENT_OF_COMMAND).toBe(178);
    // Holy Strike changed in the client AND the sources then disagreed: the
    // 50% fraction is the newer build, the 81-105 is foreverchanges.
    expect(HOLY_STRIKE_HOLY_DAMAGE).toBe(93);
    expect(HOLY_STRIKE_WEAPON_FRACTION).toBe(0.5);
    expect(SEAL_OF_FURY_DAMAGE).toBe(35);
  });

  it("uses the ruleset owner's seal formula, coefficients and all", () => {
    /*
     * ------------------------------------------------------------------------
     * A FLAT SPELL POWER COEFFICIENT PER STRIKE, CHOSEN BY WHAT IS HELD: 20%
     * with a one-hander, 22% with a two-hander, and NO attack power term.
     * Hand-transcribed from WoWSimWorksheet.xlsx.
     *
     * THIS REPLACED A FORMULA the owner had supplied earlier --
     * `base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)` -- which read
     * attack power too and scaled continuously with weapon speed. The two
     * disagree about the SHAPE and not only the size, so both are written out
     * here: the new rule is asserted, and the old one is asserted NOT to hold,
     * because a half-applied replacement would still look plausible.
     * ------------------------------------------------------------------------
     */
    expect(sealOfRighteousnessCoefficient(false)).toBe(0.2);
    expect(sealOfRighteousnessCoefficient(true)).toBe(0.22);

    const base = SEAL_OF_RIGHTEOUSNESS_BASE;
    // The base is ADDED to the coefficient, never replaced by it.
    expect(sealDamage(base, 500, 0.2)).toBeCloseTo(base + 100, 6);
    expect(sealDamage(base, 500, 0.22)).toBeCloseTo(base + 110, 6);
    expect(sealDamage(base, 0, 0.2)).toBeCloseTo(base, 6);

    // ATTACK POWER NO LONGER REACHES IT AT ALL: the only other term is spell
    // power, so a seal on a character with none is worth exactly its base.
    expect(sealDamage(base, 0, 0.22)).toBe(base);
  });

  it('reads HOLY spell power, which eight pieces of Lawbringer grant', () => {
    /*
     * ------------------------------------------------------------------------
     * THE SEAL IS THE ONE THING IN THE PROJECT A SCHOOL-SCOPED SPELL POWER CAN
     * REACH, and Lawbringer is covered in it: "Increases damage done by Holy
     * spells and effects by up to 27" on the Crown, and seven more like it.
     * Those lines were carried as unmodelled text until `SchoolModifiers`
     * grew a spell power per school.
     *
     * Asserted as THE STAT ARRIVING, scoped to the right school, and not as a
     * DPS delta -- because the same mechanism is worth a real number to one of
     * these two builds and exactly nothing to the other, and only the stat
     * says which is which.
     * ------------------------------------------------------------------------
     */
    const shockadin = presetPlayer('pally_shockadin');
    const blind = shockadin.stats.get('spellPower');

    /*
     * Eight Lawbringer pieces: 27 + 21 + 16 + 14 + 20 + 19 + 24 + 20.
     *
     * `toBeCloseTo` because the school-blind half is 373.3 -- Holy Power
     * converts a percentage of intellect -- so the difference of two floats is
     * 160.99999999999994 and the exact comparison is the wrong tool.
     */
    expect(spellPowerFor(shockadin, 'holy') - blind).toBeCloseTo(161, 6);
    // And NOTHING else gained, which is the whole reason it is not a stat.
    expect(spellPowerFor(shockadin, 'shadow')).toBe(blind);
    expect(spellPowerFor(shockadin, 'physical')).toBe(blind);
  });

  it('is worth a real number to ONE of the two builds that carry it', () => {
    /*
     * ------------------------------------------------------------------------
     * THE ECLIPSE LESSON, AND THE CHAMPION OF THE LIGHT ONE, FOR A THIRD TIME.
     *
     * Retribution wears four Lawbringer pieces and really does have 79 Holy
     * spell power on it -- and gains NOTHING, because its seals are Command
     * and Crusader. **Seal of Command is 70% of WEAPON damage with no spell
     * power term at all**, so the stat arrives and multiplies nothing.
     *
     * Shockadin casts Seal of Righteousness, which is the one formula with a
     * spell power coefficient, so its 161 is worth ~9.5 DPS.
     *
     * A talent WORKING and a talent MATTERING are different questions, which
     * is why the assertion above is on the stat.
     * ------------------------------------------------------------------------
     */
    const ret = presetPlayer('pally_ret');
    expect(spellPowerFor(ret, 'holy') - ret.stats.get('spellPower')).toBeCloseTo(79, 6);

    // Protection's tank cut of Lawbringer says nothing about Holy at all.
    const prot = presetPlayer('prot_pally');
    expect(spellPowerFor(prot, 'holy')).toBe(prot.stats.get('spellPower'));
  });

  it('makes a two-hander hit harder, in one step rather than continuously', () => {
    /*
     * "Slower weapons cause more Holy damage per swing" still holds, and it
     * now holds in TWO STEPS rather than in proportion to speed: 22% with a
     * two-hander against 20% with anything else.
     *
     * Under the old formula a 3.6-second weapon was worth exactly twice a
     * 1.8-second one. Under the sheet it is worth 10% more. The direction
     * survived the change and the magnitude did not, which is the sort of
     * thing a test that only checked the direction would have missed.
     */
    const twoHand = sealDamage(21, 500, sealOfRighteousnessCoefficient(true));
    const oneHand = sealDamage(21, 500, sealOfRighteousnessCoefficient(false));
    expect(twoHand).toBeGreaterThan(oneHand);
    expect(twoHand - 21).toBeCloseTo((oneHand - 21) * 1.1, 6);
  });

  it('declares an effect for every one of the 52 talents', () => {
    expect(Object.keys(PALADIN_TALENT_EFFECTS)).toHaveLength(52);
  });
});

describe('a seal is exclusive, like a stance', () => {
  it('removes whichever seal was up when another is cast', () => {
    const actor = bareBuild('pally_ret');
    const simulation = buildSimulation([actor, makeTarget()]);

    castSpaced(simulation, actor, 'seal_of_command', 0);
    expect(activeSeal(actor)).toBe('seal_of_command');

    castSpaced(simulation, actor, 'seal_of_the_crusader', seconds(2));
    expect(activeSeal(actor)).toBe('seal_of_the_crusader');

    // Exactly one, always. "Only one Seal can be active on the Paladin."
    expect(SEAL_AURA_IDS.filter((id) => actor.auras.has(id))).toHaveLength(1);
  });

  it('refuses Judgement with no seal up rather than dealing default damage', () => {
    /*
     * "Unleash the energy of a Seal spell." With none there is nothing to
     * unleash, so `canCast` refuses and a priority list skips it -- which is
     * what stops it burning its ten-second cooldown for nothing.
     */
    const actor = bareBuild('pally_ret');
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);

    expect(activeSeal(actor)).toBeUndefined();
    expect(castAbility(simulation, actor, actor.abilities.get('judgement')!, target)).toEqual({
      ok: false,
      reason: 'condition_failed',
    });
  });
});

describe('Twist of Light, the reason a profile is called Seal Twist', () => {
  it('flags every seal for the build that takes it, and none for the others', () => {
    /*
     * The talent arrives as a FLAG ON EACH SEAL rather than as a reaction,
     * because only the cast that replaces a seal knows a replacement happened
     * -- and `applyTalentChanges` hands each character its own copy of the
     * ability, so reading it there is per-character by construction.
     */
    const ret = presetPlayer('pally_ret');
    for (const id of SEAL_AURA_IDS) {
      expect(ret.abilities.get(id)?.bonuses?.[TWIST_OF_LIGHT_FLAG], id).toBe(1);
    }

    // Shockadin stops at 28 Retribution points and does not reach it.
    const shockadin = presetPlayer('pally_shockadin');
    expect(
      shockadin.abilities.get('seal_of_righteousness')?.bonuses?.[TWIST_OF_LIGHT_FLAG] ?? 0,
    ).toBe(0);
  });

  it('grants an Echo only when a DIFFERENT seal replaces one', () => {
    const actor = bareBuild('pally_ret');
    const simulation = buildSimulation([actor, makeTarget()]);

    // The first seal replaces nothing.
    castSpaced(simulation, actor, 'seal_of_command', 0);
    expect(actor.auras.has('echo_seal_of_command')).toBe(false);

    // Re-casting the SAME seal refreshes it and replaces nothing, which is
    // what "with a different Seal" says.
    castSpaced(simulation, actor, 'seal_of_command', seconds(2));
    expect(actor.auras.has('echo_seal_of_command')).toBe(false);

    // A different one does.
    castSpaced(simulation, actor, 'seal_of_the_crusader', seconds(4));
    expect(actor.auras.has('echo_seal_of_command')).toBe(true);
  });

  it('pays out in a real fight, which is the whole build', () => {
    const batch = batchOf('pally_ret', 40, 5);
    const echo = batch.abilities.find((a) => a.abilityName.startsWith('Echo'));
    expect(echo?.damage ?? 0).toBeGreaterThan(0);
  });
});

describe('seal damage is not a weapon use', () => {
  it("carries no weapon slot, which is the whole of the owner's ruling", () => {
    /*
     * ------------------------------------------------------------------------
     * THE RULESET OWNER'S RULING: seal damage is not a weapon use at all, and
     * does not interact with weapon procs in either direction.
     *
     * `isWeaponUse` is exactly `weaponSlot === mainHand || offHand`, so the
     * test is that every seal hit is dealt without one. Asserted through the
     * function rather than by reading the call site, because the function is
     * what Windfury, Crusader and Hand of Justice actually consult.
     *
     * THE SWING THAT CARRIED IT STILL PROCS. That is the other half of the
     * ruling and it needs no code: an auto-attack is an ordinary main-hand
     * use and nothing here touches it.
     * ------------------------------------------------------------------------
     */
    const sealHit = {
      attacker: {} as never,
      defender: {} as never,
      outcome: 'hit' as const,
      abilityId: 'seal_of_righteousness',
      abilityName: 'Seal of Righteousness',
      amount: 120,
      weaponSlot: undefined,
      critical: false,
    };
    expect(isWeaponUse(sealHit)).toBe(false);

    const swing = { ...sealHit, abilityId: undefined, weaponSlot: 'mainHand' as const };
    expect(isWeaponUse(swing)).toBe(true);
  });

  it('states Seal of Command as a 7 PPM effect worth 70% of a swing', () => {
    /*
     * BOTH NUMBERS ARE THE RULESET OWNER'S NOW. The rate was a named placeholder
     * constant and this test asserted only that it was positive, deliberately,
     * so that it would keep passing when the real figure arrived. It has -- 7 -- so the assertion becomes the value, which is what a
     * test of real data is allowed to do and a test of a placeholder is not.
     */
    expect(SEAL_OF_COMMAND_PPM).toBe(7);
    expect(SEAL_OF_COMMAND_WEAPON_FRACTION).toBe(0.7);
  });
});

describe('the three builds', () => {
  it('picks each list by its own capstone', () => {
    expect(batchOf('pally_ret', 1, 1).rotationName).toContain('Seal Twist');
    expect(batchOf('pally_shockadin', 1, 1).rotationName).toContain('Shockadin');
    expect(batchOf('prot_pally', 1, 1).rotationName).toContain('Protection');
  });

  it('gives an untalented Paladin the list made only of trainer abilities', () => {
    /*
     * THE BUG THIS PINS. The Shockadin list first asked for Seal of Command,
     * which is a 21-point Retribution talent that build does not take -- so no
     * seal was ever cast, Judgement's `canCast` refused every time because it
     * needs one, and the profile silently lost both its seal damage AND its
     * judgement. Nothing errored; the figure was simply 90 DPS too low.
     */
    expect(paladinRotation({})).toBeDefined();

    const shockadin = presetPlayer('pally_shockadin').abilities.all.map((a) => a.id);
    expect(shockadin).toContain('seal_of_righteousness');
    expect(shockadin).not.toContain('seal_of_command');
  });

  it('actually keeps a seal up and judges it, in every build', () => {
    for (const preset of ['pally_ret', 'pally_shockadin', 'prot_pally']) {
      const batch = batchOf(preset, 30, 5);
      const used = (name: string) =>
        batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;
      expect(used('Judgement'), preset).toBeGreaterThan(1);

      const sealDamageDealt = batch.abilities
        .filter((a) => a.abilityName.startsWith('Seal of') || a.abilityName.startsWith('Echo'))
        .reduce((total, a) => total + a.damage, 0);
      expect(sealDamageDealt, preset).toBeGreaterThan(0);
    }
  });

  it('gives Protection the shield its whole tree is written around', () => {
    // Redoubt, Holy Shield and Shield Specialization are three of its five
    // best talents and none of them do anything without one.
    const built = PRESETS_BY_ID.get('prot_pally')!.build();
    expect(built.equipment.shield).toBeDefined();
    expect(built.encounter.targetAttacks).toBe(true);
    expect(built.character.combatStyle).toBe('one_hand_shield');

    /*
     * SHOCKADIN HOLDS ONE TOO, and it is not a tank. Its own set is a
     * one-hander and Earth and Fire, a CASTER shield carrying 26 spell power --
     * which is what moved the build off `two_hander`, where a one-hander and
     * an off hand are both deleted. A shield is not the tank's alone; what
     * makes Protection a tank is the tree, the stance and a target that swings
     * back.
     */
    const shockadin = PRESETS_BY_ID.get('pally_shockadin')!.build();
    expect(shockadin.equipment.shield).toBeDefined();
    expect(shockadin.character.combatStyle).toBe('one_hand_shield');
    expect(shockadin.encounter.targetAttacks).toBe(false);

    // Retribution swings a two-hander and holds nothing in the other hand.
    const ret = PRESETS_BY_ID.get('pally_ret')!.build();
    expect(ret.equipment.shield).toBeUndefined();
    expect(ret.equipment.twoHand).toBeDefined();
  });

  it('grants each capstone ability to exactly one build', () => {
    const ids = (preset: string) =>
      abilitiesForClass(
        'paladin',
        PRESETS_BY_ID.get(preset)!.build().character.combatStyle as never,
        PRESETS_BY_ID.get(preset)!.build().talents,
      ).map((a) => a.id);

    expect(ids('pally_ret')).toContain('seal_of_command');
    expect(ids('pally_shockadin')).toContain('holy_shock');
    expect(ids('prot_pally')).toContain('holy_shield');

    expect(ids('prot_pally')).not.toContain('seal_of_command');
    expect(ids('pally_ret')).not.toContain('holy_shield');
  });
});

describe('Hammer of Wrath, the sheet\'s last unapplied row', () => {
  /*
   * --------------------------------------------------------------------------
   * "Hurls a hammer that strikes an enemy for 474 to 522 Holy damage. Only
   * usable on enemies that have 20% or less health." 425 mana, a 1 second
   * cast, a 6 second cooldown, rank 3, learned at 60.
   *
   * `HAMMER_OF_WRATH_SP_COEFFICIENT` sat transcribed and unapplied in
   * `coefficients.ts` from the day the sheet arrived, because the ability did
   * not exist. Nothing about the DATA changed -- what changed is that the
   * ruleset owner put it in two priority lists.
   *
   * THE HEALTH GATE IS THE CLOCK, which is Execute's ruling and not a new one.
   * A 20%-health condition could never fire against a damage sink with a
   * hundred thousand health taking fifteen thousand in a fight, which is
   * exactly how Execute came to sit in every Warrior list uncast.
   * --------------------------------------------------------------------------
   */
  it('takes the midpoint of its stated range and the sheet\'s coefficient', () => {
    // "474 to 522", written out by hand from the capture.
    expect(HAMMER_OF_WRATH_DAMAGE).toBe(498);
    expect(HAMMER_OF_WRATH_COEFFICIENT).toBe(HAMMER_OF_WRATH_SP_COEFFICIENT);
    expect(HAMMER_OF_WRATH_COEFFICIENT).toBeCloseTo(0.428571, 6);

    expect(HAMMER_OF_WRATH.cost).toEqual({ resource: 'mana', amount: 425 });
    expect(HAMMER_OF_WRATH.castTimeMs).toBe(seconds(1));
    expect(HAMMER_OF_WRATH.cooldownMs).toBe(seconds(6));
  });

  it('is refused for the first four fifths of the fight and allowed in the last', () => {
    const actor = makeAttacker({
      autoAttack: 'none',
      resources: [{ type: 'mana', maximum: 10_000 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(100) });
    simulation.begin();

    const context = { simulation, caster: actor, target, ability: HAMMER_OF_WRATH };
    expect(HAMMER_OF_WRATH.canCast?.(context)).toBe(false);

    // One second short of the window, and then inside it.
    simulation.advanceTo(seconds(100) * (1 - EXECUTE_PHASE_FRACTION) - seconds(1));
    expect(HAMMER_OF_WRATH.canCast?.(context)).toBe(false);

    simulation.advanceTo(seconds(100) * (1 - EXECUTE_PHASE_FRACTION));
    expect(HAMMER_OF_WRATH.canCast?.(context)).toBe(true);

    /*
     * AND THE TARGET'S HEALTH IS UNTOUCHED THROUGHOUT, which is the point. A
     * full-health dummy is exactly the case the tooltip's own condition would
     * refuse forever.
     */
    expect(target.health.current).toBe(target.health.maximum);
  });

  it('is in every Paladin build, needing no talent', () => {
    for (const preset of ['pally_ret', 'pally_shockadin', 'prot_pally']) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      const book = abilitiesForClass(
        'paladin',
        built.character.combatStyle as never,
        built.talents,
      ).map((a) => a.id);
      expect(book, preset).toContain('hammer_of_wrath');
    }
  });
});

describe("Templar's Bulwark, and the first absorb shield in the project", () => {
  /*
   * --------------------------------------------------------------------------
   * "When activated, this ability grants you an absorb shield equal to 100% of
   * your maximum health for 8 sec. Applies Forbearance for 1 min. Cannot be
   * cast while Forbearance is active." 110 mana, five minutes, new in Forever.
   *
   * `DamageResolution.absorbed` has been hard-coded to zero since the damage
   * pipeline was written, carrying a comment that the field existed so adding
   * absorbs later would not change the function's shape. It did not.
   *
   * READ IN `resolveDamage`, SPENT IN `dealDamage`, which is the arrangement a
   * block charge already has: the resolver applies nothing, so a shield drawn
   * down inside it would lose the amount every time an ability resolved a hit
   * it did not deal.
   * --------------------------------------------------------------------------
   */
  const shielded = () => {
    const actor = makeAttacker({ autoAttack: 'none', maxHealth: 10_000 });
    const target = makeTarget({ maxHealth: 10_000 });
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();
    return { actor, target, simulation };
  };

  it('shields for 100% of maximum health, read once when it is applied', () => {
    const { target, simulation } = shielded();
    simulation.applyAura(target, TEMPLARS_BULWARK, target.id);

    expect(TEMPLARS_BULWARK_HEALTH_SHARE).toBe(1);
    expect(target.auras.absorbAvailable()).toBe(target.health.maximum);
    expect(TEMPLARS_BULWARK.durationMs).toBe(seconds(8));
  });

  it('soaks damage before health, and ends when it is spent', () => {
    const { actor, target, simulation } = shielded();
    simulation.applyAura(target, TEMPLARS_BULWARK, target.id);

    const hit = (amount: number) =>
      dealDamage(simulation, {
        source: actor,
        target,
        abilityName: 'Test',
        school: 'holy',
        baseAmount: amount,
        appliesArmor: false,
      });

    const first = hit(4000);
    expect(first.absorbed).toBe(4000);
    expect(first.amount).toBe(0);
    expect(target.health.current).toBe(10_000);
    expect(target.auras.absorbAvailable()).toBe(6000);

    /*
     * A HIT BIGGER THAN WHAT IS LEFT absorbs the remainder and the rest lands.
     * The shield is then spent, and a spent shield ENDS -- an exhausted aura
     * sitting on the character would report uptime it is not providing.
     */
    const second = hit(10_000);
    expect(second.absorbed).toBe(6000);
    expect(second.amount).toBe(4000);
    expect(target.health.current).toBe(6000);
    expect(target.auras.has('templars_bulwark')).toBe(false);
  });

  it('is dropped by a death, like the other cooldowns spent to prevent one', () => {
    // Last Stand and Shield Wall declare the same. Carrying a shield through a
    // death would switch the assumed healer off when it is most needed.
    expect(TEMPLARS_BULWARK.removedOnDeath).toBe(true);
  });
});

describe('Righteous Fury, which is cast and does nothing', () => {
  it('carries no modifier at all, because threat is not tracked', () => {
    /*
     * "Increases the threat generated by your Holy attacks by 60%." Threat is
     * permanently out of scope, so an aura with no effect is the CORRECT
     * modelling rather than an unfinished one.
     *
     * IT IS STILL CAST, by the ruleset owner's ruling: a Protection Paladin
     * really does spend 30% of its base mana and a global cooldown on this at
     * the pull, so the profile pays what it pays. Dropping the ability would
     * hand the build back a cast it does not get to keep.
     */
    expect(RIGHTEOUS_FURY.statModifiers).toBeUndefined();
    expect(RIGHTEOUS_FURY.damageDoneMultiplier).toBeUndefined();
    expect(RIGHTEOUS_FURY.durationMs).toBe(0);

    // And it says so where a person can read it.
    expect(RIGHTEOUS_FURY_ABILITY.unmodelled).toContain('threat');
    expect(RIGHTEOUS_FURY_ABILITY.cost?.amount).toBeGreaterThan(0);
  });

  it('refuses a second cast once it is up, so it costs one global cooldown', () => {
    const actor = makeAttacker({ autoAttack: 'none' });
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();
    const context = {
      simulation,
      caster: actor,
      target: undefined,
      ability: RIGHTEOUS_FURY_ABILITY,
    };
    expect(RIGHTEOUS_FURY_ABILITY.canCast?.(context)).toBe(true);
    simulation.applyAura(actor, RIGHTEOUS_FURY, actor.id);
    expect(RIGHTEOUS_FURY_ABILITY.canCast?.(context)).toBe(false);
  });
});
