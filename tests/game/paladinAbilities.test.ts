import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { castAbility, isWeaponUse, seconds } from '../../src/engine';
import {
  HOLY_STRIKE_HOLY_DAMAGE,
  HOLY_STRIKE_WEAPON_FRACTION,
  JUDGEMENT_OF_COMMAND,
  JUDGEMENT_OF_RIGHTEOUSNESS,
  TWIST_OF_LIGHT_FLAG,
} from '../../src/game/abilities/paladin';
import {
  SEAL_ATTACK_POWER_COEFFICIENT,
  SEAL_AURA_IDS,
  SEAL_OF_COMMAND_WEAPON_FRACTION,
  SEAL_OF_FURY_DAMAGE,
  SEAL_OF_RIGHTEOUSNESS_BASE,
  SEAL_SPELL_POWER_COEFFICIENT,
  activeSeal,
  sealDamage,
} from '../../src/game/auras/paladin';
import { PLACEHOLDER_SEAL_OF_COMMAND_PPM } from '../../src/game/reactions/paladin';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { paladinRotation } from '../../src/game/rotations/paladin';

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
    expect(JUDGEMENT_OF_RIGHTEOUSNESS).toBe(178);
    expect(JUDGEMENT_OF_COMMAND).toBe(178);
    expect(HOLY_STRIKE_HOLY_DAMAGE).toBe(37);
    expect(HOLY_STRIKE_WEAPON_FRACTION).toBe(0.4);
    expect(SEAL_OF_FURY_DAMAGE).toBe(35);
  });

  it("uses the ruleset owner's seal formula, coefficients and all", () => {
    /*
     * ------------------------------------------------------------------------
     * THE FIRST SPELL POWER COEFFICIENT IN THE PROJECT, supplied directly:
     *
     *   damage = base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)
     *
     * Every caster before this -- Druid, Shaman, Mage -- states flat damage
     * and NO coefficient, and each says so on its results page. This is the
     * one place where gear reaches a Holy number, so it is asserted against
     * the formula written out again here by hand rather than against a
     * recorded figure.
     * ------------------------------------------------------------------------
     */
    expect(SEAL_ATTACK_POWER_COEFFICIENT).toBe(0.022);
    expect(SEAL_SPELL_POWER_COEFFICIENT).toBe(0.044);

    const base = SEAL_OF_RIGHTEOUSNESS_BASE;
    expect(sealDamage(base, 3.6, 1000, 0)).toBeCloseTo(base + 3.6 * 22, 6);
    expect(sealDamage(base, 3.6, 0, 500)).toBeCloseTo(base + 3.6 * 22, 6);
    // Spell power is worth exactly twice attack power, point for point.
    expect(sealDamage(base, 2, 0, 100) - base).toBeCloseTo(
      2 * (sealDamage(base, 2, 100, 0) - base),
      6,
    );
  });

  it('makes a slow weapon hit harder, which is what the tooltip says', () => {
    // "Slower weapons cause more Holy damage per swing" falls out of the
    // formula rather than needing a rule of its own.
    expect(sealDamage(21, 3.6, 1000, 200)).toBeGreaterThan(sealDamage(21, 1.8, 1000, 200));
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

  it('states Seal of Command as a PPM effect with a placeholder rate', () => {
    /*
     * The owner chose procs-per-minute; the figure has not arrived. It is the
     * single largest number in the Seal Twist build, so it is named, printed
     * on the results page, and asserted here as a placeholder rather than as
     * a value -- this test should keep passing when the real rate lands.
     */
    expect(PLACEHOLDER_SEAL_OF_COMMAND_PPM).toBeGreaterThan(0);
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

    const others = ['pally_ret', 'pally_shockadin'];
    for (const preset of others) {
      expect(PRESETS_BY_ID.get(preset)!.build().equipment.shield, preset).toBeUndefined();
    }
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
