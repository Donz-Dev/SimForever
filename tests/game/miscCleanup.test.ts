import { describe, expect, it } from 'vitest';
import type { AttackEvent, Combatant, TelemetryEvent } from '../../src/engine';
import { castAbility, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import {
  RUPTURE_TICK_AP_COEFFICIENT_CAP,
  ruptureTickApCoefficient,
} from '../../src/game/combat/coefficients';
import { linearBySpeed } from '../../src/game/combat/speedRow';
import { JUDGEMENT } from '../../src/game/abilities/paladin';
import { echoAura } from '../../src/game/auras/paladin';
import { SEAL_OF_COMMAND_PPM, carriesSeal, echoProc } from '../../src/game/reactions/paladin';
import { SHAMAN_ABILITIES } from '../../src/game/abilities/shaman';
import { FLAMETONGUE_WEAPON_IMBUE, WINDFURY_WEAPON_IMBUE } from '../../src/game/auras/shaman';
import {
  flametongueTotemDamage,
  flametongueTotemReaction,
  flametongueWeaponDamage,
  flametongueWeaponReaction,
} from '../../src/game/buffs/flametongue';
import { RAID_BUFFS_BY_ID, withRaidBuff } from '../../src/game/buffs/raidBuffs';
import { consumableReactions } from '../../src/game/buffs/consumables';
import { FROST_OIL_PROC_CHANCE, frostOilReaction } from '../../src/game/buffs/frostOil';
import { MAGE_ABILITIES } from '../../src/game/abilities/mage';
import { CHILL_ABILITY_IDS } from '../../src/game/reactions/mageTalents';
import { MAGE_COSTED_SPELL_IDS } from '../../src/game/auras/mage';
import {
  BANE_OF_DOOM_ABILITY,
  BANE_OF_AGONY_ABILITY,
  SOUL_FIRE,
  SOUL_FIRE_MANA,
  WARLOCK_DESTRUCTION_SPELLS,
} from '../../src/game/abilities/warlock';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import { WARLOCK_ABILITIES } from '../../src/game/abilities/warlock';
import { createForeverAttackChances } from '../../src/game/combat/attackChances';
import { PRIEST_ABILITIES } from '../../src/game/abilities/priest';

const WARLOCK_BY_ID = (id: string) => WARLOCK_ABILITIES.find((ability) => ability.id === id)!;
const PRIEST_BY_ID = (id: string) => PRIEST_ABILITIES.find((ability) => ability.id === id)!;

/*
 * ============================================================================
 * THE MISCELLANEOUS CLEANUP ROUND, ONE MECHANISM EACH.
 *
 * Every figure below is written out BY HAND from the owner's message, not read
 * back from the source, so a transcription error has to be made twice.
 * ============================================================================
 */

const damageEvents = (events: TelemetryEvent[], abilityId: string) =>
  events.filter(
    (event) =>
      event.type === 'damage' && (event as { abilityId?: string }).abilityId === abilityId,
  );

/** A landed main-hand attack by `attacker` on `defender`. */
const mainHandHit = (
  attacker: Combatant,
  defender: Combatant,
  abilityId: string | undefined = undefined,
): AttackEvent =>
  ({
    attacker,
    defender,
    outcome: 'hit',
    abilityId,
    abilityName: abilityId ?? 'Main Hand Auto-Attack',
    amount: 100,
    weaponSlot: 'mainHand',
    critical: false,
    attackTable: abilityId ? 'melee-special' : 'melee-auto',
  }) as AttackEvent;

const withMainHand = (speedSeconds: number, extra: Parameters<typeof makeAttacker>[0] = {}) =>
  makeAttacker({
    autoAttack: 'none',
    weapons: {
      mainHand: {
        name: 'Test Weapon',
        twoHanded: true,
        swingTimerMs: seconds(speedSeconds),
        baseDamage: 100,
        powerCoefficient: speedSeconds / 14,
      },
    },
    ...extra,
  });

describe('Rupture, by combo point', () => {
  it('is 1/2/3% of attack power a tick for 1/2/3 points and caps at 3%', () => {
    expect(ruptureTickApCoefficient(1)).toBeCloseTo(0.01, 10);
    expect(ruptureTickApCoefficient(2)).toBeCloseTo(0.02, 10);
    expect(ruptureTickApCoefficient(3)).toBeCloseTo(0.03, 10);
    expect(ruptureTickApCoefficient(4)).toBeCloseTo(0.03, 10);
    expect(ruptureTickApCoefficient(5)).toBeCloseTo(0.03, 10);
    expect(RUPTURE_TICK_AP_COEFFICIENT_CAP).toBe(0.03);
  });
});

describe('the seal balance pass', () => {
  it('lets no seal ride on a Holy Strike, and leaves it a weapon use', () => {
    const player = makeAttacker();
    const boss = makeTarget();
    expect(carriesSeal(mainHandHit(player, boss))).toBe(true);
    expect(carriesSeal(mainHandHit(player, boss, 'crusader_strike'))).toBe(true);
    expect(carriesSeal(mainHandHit(player, boss, 'holy_strike'))).toBe(false);
  });

  it('rolls the Echo of Seal of Command at 7 PPM rather than landing it every time', () => {
    /*
     * The owner: it "could always be triggering a Seal of Command hit, rather
     * than having a chance to trigger Seal of Command when the echo is active."
     * A 3.5-second weapon at 7 PPM is 7 x 3.5 / 60 = 40.8%, by hand.
     */
    const player = withMainHand(3.5);
    const boss = makeTarget({ maxHealth: 1e9 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([player, boss], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    const reaction = echoProc();

    const trials = 2000;
    for (let i = 0; i < trials; i += 1) {
      simulation.applyAura(player, echoAura('seal_of_command'), player.id);
      const attack = mainHandHit(player, boss);
      expect(reaction.canTrigger!(simulation, player, attack)).toBe(true);
      reaction.onTrigger(simulation, player, attack);
      // The charge is spent whether or not the roll landed.
      expect(player.auras.has('echo_seal_of_command')).toBe(false);
    }

    const echoes = damageEvents(events, 'twist_of_light').length;
    const expected = (SEAL_OF_COMMAND_PPM * 3.5) / 60;
    expect(expected).toBeCloseTo(0.4083, 3);
    expect(echoes / trials).toBeGreaterThan(expected - 0.05);
    expect(echoes / trials).toBeLessThan(expected + 0.05);
  });

  it('puts Judgement on the melee table, for a 2x crit', () => {
    expect(JUDGEMENT.attackTable).toBe('melee-special');
  });
});

describe('the speed row Seal of Righteousness and both Flametongues share', () => {
  it('is linear between the two stated speeds and clamped outside them', () => {
    expect(linearBySpeed(1.3, 17, 55)).toBeCloseTo(17, 10);
    expect(linearBySpeed(4.0, 17, 55)).toBeCloseTo(55, 10);
    expect(linearBySpeed(2.65, 17, 55)).toBeCloseTo(36, 10);
    expect(linearBySpeed(1.0, 17, 55)).toBeCloseTo(17, 10);
    expect(linearBySpeed(5.0, 17, 55)).toBeCloseTo(55, 10);
  });

  it('gives each Flametongue the owner figures', () => {
    expect(flametongueTotemDamage(1.3)).toBeCloseTo(17, 10);
    expect(flametongueTotemDamage(4.0)).toBeCloseTo(55, 10);
    expect(flametongueWeaponDamage(1.3)).toBeCloseTo(35, 10);
    expect(flametongueWeaponDamage(4.0)).toBeCloseTo(112, 10);
  });
});

describe('the Shaman imbues', () => {
  const shaman = () =>
    withMainHand(3.5, {
      abilities: SHAMAN_ABILITIES,
      resources: [{ type: 'mana', maximum: 100_000 }],
    });

  it('holds one main-hand imbue at a time', () => {
    const player = shaman();
    const boss = makeTarget();
    const simulation = buildSimulation([player, boss]);
    simulation.begin();

    const cast = (id: string, at: number) => {
      simulation.advanceTo(at);
      expect(castAbility(simulation, player, player.abilities.get(id)!, boss)).toEqual({
        ok: true,
      });
    };

    cast('windfury_weapon', 0);
    cast('flametongue_weapon', seconds(2));
    expect(player.auras.has('windfury_weapon')).toBe(false);
    expect(player.auras.has('flametongue_weapon')).toBe(true);

    cast('rockbiter_weapon', seconds(4));
    expect(player.auras.has('flametongue_weapon')).toBe(false);
    expect(player.auras.has('rockbiter_weapon')).toBe(true);
    // +653 melee attack power, on the stat block.
    expect(player.stats.get('attackPower')).toBeCloseTo(100 + 653, 6);
  });

  it('procs Flametongue Weapon on main-hand uses only while the imbue is up', () => {
    const player = shaman();
    const boss = makeTarget();
    const simulation = buildSimulation([player, boss]);
    simulation.begin();
    const reaction = flametongueWeaponReaction();

    expect(reaction.canTrigger!(simulation, player, mainHandHit(player, boss))).toBe(false);
    simulation.applyAura(player, FLAMETONGUE_WEAPON_IMBUE, player.id);
    expect(reaction.canTrigger!(simulation, player, mainHandHit(player, boss))).toBe(true);
    expect(reaction.canTrigger!(simulation, player, mainHandHit(player, boss, 'stormstrike'))).toBe(
      true,
    );
    const offHand = { ...mainHandHit(player, boss), weaponSlot: 'offHand' } as AttackEvent;
    expect(reaction.canTrigger!(simulation, player, offHand)).toBe(false);
  });

  it('lets Flametongue Weapon switch off its carrier own Flametongue Totem, and nothing else', () => {
    const player = shaman();
    const boss = makeTarget();
    const simulation = buildSimulation([player, boss]);
    simulation.begin();
    const totem = flametongueTotemReaction();

    // A 100% proc, on every main-hand use.
    expect(totem.canTrigger!(simulation, player, mainHandHit(player, boss))).toBe(true);
    simulation.applyAura(player, WINDFURY_WEAPON_IMBUE, player.id);
    expect(totem.canTrigger!(simulation, player, mainHandHit(player, boss))).toBe(true);
    player.auras.remove(simulation, WINDFURY_WEAPON_IMBUE.id);
    simulation.applyAura(player, FLAMETONGUE_WEAPON_IMBUE, player.id);
    expect(totem.canTrigger!(simulation, player, mainHandHit(player, boss))).toBe(false);
  });

  it('makes Flametongue Totem and Windfury Totem replace each other when selected', () => {
    expect(RAID_BUFFS_BY_ID.get('flametongue_totem')?.exclusiveWith).toBe('windfury_totem');
    expect(withRaidBuff(['windfury_totem'], 'flametongue_totem')).toEqual(['flametongue_totem']);
    expect(withRaidBuff(['flametongue_totem'], 'windfury_totem')).toEqual(['windfury_totem']);
  });
});

describe('Frost Oil', () => {
  it('coats a hand, and an off-hand coat on a two-hander reaches nothing', () => {
    const both = {
      weapon_effect_main_hand: 'frost_oil_main_hand',
      weapon_effect_off_hand: 'frost_oil_off_hand',
    };
    expect(consumableReactions(both, 'dual_wield').map((r) => r.id)).toEqual([
      'frost_oil_mainHand',
      'frost_oil_offHand',
    ]);
    expect(consumableReactions(both, 'two_hander').map((r) => r.id)).toEqual([
      'frost_oil_mainHand',
    ]);
  });

  it('procs on 10% of that hand uses, with no internal cooldown', () => {
    expect(FROST_OIL_PROC_CHANCE).toBe(0.1);
    const player = withMainHand(2.6);
    const boss = makeTarget({ maxHealth: 1e9 });
    const simulation = buildSimulation([player, boss]);
    simulation.begin();
    const reaction = frostOilReaction('mainHand');

    let fired = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i += 1) {
      if (reaction.canTrigger!(simulation, player, mainHandHit(player, boss))) fired += 1;
    }
    expect(fired / trials).toBeGreaterThan(0.085);
    expect(fired / trials).toBeLessThan(0.115);
  });
});

describe('Cone of Cold', () => {
  const cone = MAGE_ABILITIES.find((ability) => ability.id === 'cone_of_cold');

  it('is declared with the owner tooltip', () => {
    expect(cone).toBeDefined();
    expect(cone!.cost).toEqual({ resource: 'mana', amount: 555 });
    expect(cone!.cooldownMs).toBe(seconds(10));
    expect(cone!.castTimeMs ?? 0).toBe(0);
  });

  it('is a Chill, so it can proc Fingers of Frost, and Arcane Power reaches its cost', () => {
    expect(CHILL_ABILITY_IDS).toContain('cone_of_cold');
    expect(MAGE_COSTED_SPELL_IDS).toContain('cone_of_cold');
  });
});

describe('Bane of Doom', () => {
  const warlock = () =>
    makeAttacker({
      autoAttack: 'none',
      // Hit capped, so the application roll cannot miss: this pins the TIMING.
      stats: { attackPower: 0, hitChance: 17, critChance: -100, spellCritChance: -100 },
      abilities: [BANE_OF_DOOM_ABILITY, BANE_OF_AGONY_ABILITY],
      resources: [{ type: 'mana', maximum: 100_000 }],
    });

  it('deals its damage ONCE, one minute after the cast', () => {
    const player = warlock();
    const boss = makeTarget({ maxHealth: 1e9 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([player, boss], { durationMs: seconds(120) }, {
      emit: (e) => events.push(e),
    });
    simulation.begin();
    expect(castAbility(simulation, player, BANE_OF_DOOM_ABILITY, boss)).toEqual({ ok: true });

    simulation.advanceTo(seconds(59.9));
    expect(damageEvents(events, 'bane_of_doom')).toHaveLength(0);
    simulation.advanceTo(seconds(61));
    expect(damageEvents(events, 'bane_of_doom')).toHaveLength(1);
  });

  it('is one Bane per Warlock: Bane of Agony takes its place', () => {
    const player = warlock();
    const boss = makeTarget({ maxHealth: 1e9 });
    const simulation = buildSimulation([player, boss], { durationMs: seconds(120) });
    simulation.begin();
    castAbility(simulation, player, BANE_OF_DOOM_ABILITY, boss);
    expect(boss.auras.has('bane_of_doom')).toBe(true);
    simulation.advanceTo(seconds(2));
    castAbility(simulation, player, BANE_OF_AGONY_ABILITY, boss);
    expect(boss.auras.has('bane_of_doom')).toBe(false);
    expect(boss.auras.has('bane_of_agony')).toBe(true);
  });
});

describe('Soul Fire', () => {
  it('costs a Soul Shard and 335 mana, on a six-second cast and a minute cooldown', () => {
    expect(SOUL_FIRE.cost).toEqual({ resource: 'soulShards', amount: 1 });
    expect(SOUL_FIRE_MANA).toBe(335);
    expect(SOUL_FIRE.castTimeMs).toBe(seconds(6));
    expect(SOUL_FIRE.cooldownMs).toBe(seconds(60));
  });

  it('is reached by the talents that name it', () => {
    expect(WARLOCK_DESTRUCTION_SPELLS).toContain('soul_fire');
    // Bane's SECOND number is Soul Fire's cast-time reduction.
    expect(WARLOCK_TALENT_EFFECTS.bane).toContainEqual({
      kind: 'abilityCastTime',
      abilityId: 'soul_fire',
      valueIndex: 1,
    });
  });
});

describe('a pure DoT rolls to hit when it is applied', () => {
  /*
   * ==========================================================================
   * THE OWNER'S RULE, AND FIVE ABILITIES THAT SKIPPED IT. Corruption, Bane of
   * Agony, Siphon Life, Shadow Word: Pain and Devouring Plague deal nothing on
   * the cast, so no damage event carried a roll and all five landed every time.
   * The whole suite passed with that in -- a missing miss is not an error --
   * which is why these drive the REAL `onCast` and count what landed.
   *
   * 17% spell miss with no hit, by hand. 3000 casts is a standard error of
   * about 0.7 points, so the bands below are four of them wide.
   * ==========================================================================
   */
  const POOR_DOTS = [
    { ability: () => WARLOCK_BY_ID('corruption'), aura: 'corruption' },
    { ability: () => WARLOCK_BY_ID('bane_of_agony'), aura: 'bane_of_agony' },
    { ability: () => WARLOCK_BY_ID('siphon_life'), aura: 'siphon_life' },
    { ability: () => BANE_OF_DOOM_ABILITY, aura: 'bane_of_doom' },
    { ability: () => PRIEST_BY_ID('shadow_word_pain'), aura: 'shadow_word_pain' },
    { ability: () => PRIEST_BY_ID('devouring_plague'), aura: 'devouring_plague' },
  ];

  const landRate = (
    abilityId: () => import('../../src/engine').Ability,
    auraId: string,
    caster: Combatant,
  ): number => {
    const boss = makeTarget({ maxHealth: 1e9 });
    // THE RULESET'S table: the engine default has no 17% spell miss in it.
    const simulation = buildSimulation([caster, boss], {
      attackChances: createForeverAttackChances(),
    });
    simulation.begin();
    const ability = abilityId();
    const trials = 3000;
    let landed = 0;
    for (let i = 0; i < trials; i += 1) {
      ability.onCast!({ simulation, caster, target: boss, ability });
      if (boss.auras.has(auraId)) landed += 1;
      boss.auras.remove(simulation, auraId);
    }
    return landed / trials;
  };

  for (const { ability, aura } of POOR_DOTS) {
    it(`${aura} misses on the 17% spell miss with no hit`, () => {
      const rate = landRate(ability, aura, makeAttacker({ stats: { hitChance: 0 } }));
      expect(rate).toBeGreaterThan(0.83 - 0.03);
      expect(rate).toBeLessThan(0.83 + 0.03);
    });
  }

  it('lands every time at the 17-point cap', () => {
    for (const { ability, aura } of POOR_DOTS) {
      expect(landRate(ability, aura, makeAttacker({ stats: { hitChance: 17 } })), aura).toBe(1);
    }
  });

  it('counts SCHOOL-scoped hit, which a bare `rollAttack` never saw', () => {
    /*
     * The Shadow Priest reaches its cap through Shadow Focus -- school-scoped
     * Shadow hit -- so this is the case that decides whether the roll is the
     * same one `dealDamage` makes. 12 points on the stat and 5 on the school is
     * the cap; 12 alone leaves 5% to miss.
     */
    const statOnly = makeAttacker({ stats: { hitChance: 12 } });
    const withSchool = makeAttacker({ stats: { hitChance: 12 } });
    withSchool.schoolModifiers.add('shadow', { hitBonus: 5 });

    const swp = () => PRIEST_BY_ID('shadow_word_pain');
    expect(landRate(swp, 'shadow_word_pain', withSchool)).toBe(1);
    const rate = landRate(swp, 'shadow_word_pain', statOnly);
    expect(rate).toBeGreaterThan(0.95 - 0.02);
    expect(rate).toBeLessThan(0.95 + 0.02);
  });
});
