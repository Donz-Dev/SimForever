import { describe, expect, it } from 'vitest';
import type { Ability, Combatant, Simulation, TelemetryEvent, WeaponProfile } from '../../src/engine';
import { Simulation as SimulationClass, castAbility, dealDamage, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { THUNDER_CLAP, WHIRLWIND } from '../../src/game/abilities/warrior';
import { EXPLOSIVE_TRAP_ABILITY, MULTI_SHOT, VOLLEY } from '../../src/game/abilities/hunter';
import { ARCANE_EXPLOSION, BLAST_WAVE, BLIZZARD } from '../../src/game/abilities/mage';
import { CONSECRATION, CONSECRATION_FULL_TARGETS } from '../../src/game/abilities/paladin';
import { CONSECRATION_TOTAL } from '../../src/game/auras/paladin';
import { FIRE_NOVA, MAGMA_TOTEM } from '../../src/game/abilities/shaman';
import { SEARING_TOTEM_DOT } from '../../src/game/auras/shaman';

import { HURRICANE, MANGLE, SWIPE } from '../../src/game/abilities/druid';
import { HOLY_NOVA } from '../../src/game/abilities/priest';
import {
  BANE_OF_HAVOC_ABILITY,
  CORRUPTION_ABILITY,
  HELLFIRE,
  HELLFIRE_HEAL_NAME,
  HELLFIRE_SELF_DAMAGE,
  RAIN_OF_FIRE,
} from '../../src/game/abilities/warlock';
import {
  CHAIN_LIGHTNING,
  CHAIN_LIGHTNING_DAMAGE,
  CHAIN_LIGHTNING_JUMP_FACTOR,
} from '../../src/game/abilities/shaman';
import { ELEMENTAL_MASTERY_AURA } from '../../src/game/auras/shaman';
import {
  LIGHTNING_OVERLOAD_FRACTION,
  lightningOverload,
} from '../../src/game/reactions/shamanTalents';
import {
  ARCANE_EXPLOSION_SP_COEFFICIENT,
  BLIZZARD_TICK_SP_COEFFICIENT,
  HELLFIRE_TICK_SP_COEFFICIENT,
  HOLY_NOVA_SP_COEFFICIENT,
  HURRICANE_TICK_SP_COEFFICIENT,
  MAGMA_TOTEM_PULSE_SP_COEFFICIENT,
  RAIN_OF_FIRE_TICK_SP_COEFFICIENT,
  VOLLEY_TICK_RAP_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { compileRotation } from '../../src/game/rotations/apl';
import type { AplList } from '../../src/game/rotations/apl';
import { setMultiDot } from '../../src/ui/panels/aplEditing';
import { BANE_OF_HAVOC, BANE_OF_HAVOC_SHARE } from '../../src/game/auras/warlock';
import { SWEEPING_STRIKES, SWEEPING_STRIKES_CHARGES } from '../../src/game/auras/warrior';
import { BLADE_FLURRY } from '../../src/game/auras/rogue';
import { SWEEPING_STRIKES_EXTRA_OPPONENT } from '../../src/game/reactions/warrior';
import {
  BANE_OF_HAVOC_REACTIONS,
  BLADE_FLURRY_EXTRA_OPPONENT,
} from '../../src/game/reactions/reactionsForClass';
import { FOREVER_THREAT_RULES } from '../../src/game/combat/threat';
import {
  EXTRA_TARGET_SWING_DAMAGE,
  EXTRA_TARGET_SWING_SECONDS,
} from '../../src/game/encounters/raidBoss';
import { compileCondition, describeCondition, targetCount } from '../../src/game/rotations/apl';
import type { AplCondition } from '../../src/game/rotations/apl';
import { conditionOf, rootOf } from '../../src/ui/panels/aplEditing';
import { TARGET_COUNT_OPTIONS } from '../../src/ui/panels/EncounterPanel';
import {
  createTargetsFor,
  trainingDummyEncounter,
} from '../../src/simulator/trainingDummyEncounter';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  createDefaultProfile,
  parseProfile,
  serializeProfile,
  type CharacterProfile,
} from '../../src/profiles';
import { migrateProfile } from '../../src/profiles/migrateProfile';
import { validateProfile } from '../../src/profiles/validateProfile';
import { selectedRaidBuffs } from '../../src/game/buffs/raidBuffs';
import { runProfileBatch } from '../../src/simulator/runBatch';

/*
 * MULTI-TARGET, round 57. Every assertion is about a MECHANISM -- how many
 * enemies an ability reached, what a copy dealt, what an add swings for --
 * because a DPS figure at several targets is a rotation outcome and the stock
 * lists are single-target lists.
 */

const WEAPON: WeaponProfile = {
  name: 'Test Weapon',
  swingTimerMs: seconds(2.6),
  baseDamage: 100,
  damageVariance: 0,
  powerCoefficient: 2.6 / 14,
};

/** An ability's stance requirement stripped, so the harness needs no stance dance. */
const anyStance = (ability: Ability): Ability => ({ ...ability, stances: undefined });

function fight(targets: number, attacker: Partial<Parameters<typeof makeAttacker>[0]> = {}) {
  const events: TelemetryEvent[] = [];
  const caster = makeAttacker({
    autoAttack: 'none',
    maxHealth: 10_000,
    stats: { attackPower: 1000, spellPower: 500 },
    weapons: { mainHand: WEAPON, ranged: WEAPON },
    resources: [
      { type: 'mana', maximum: 1_000_000 },
      { type: 'rage', maximum: 1000 },
      { type: 'energy', maximum: 1000 },
    ],
    ...attacker,
  });
  const enemies = Array.from({ length: targets }, (_, index) =>
    makeTarget({ id: `dummy_${index + 1}`, name: `Dummy ${index + 1}`, maxHealth: 10_000_000 }),
  );
  const simulation = buildSimulation([caster, ...enemies], { durationMs: seconds(120) }, {
    emit: (event) => events.push(event),
  });
  return { simulation, caster, enemies, events };
}

/** Every distinct enemy an ability's damage reached, misses included. */
function struckBy(events: readonly TelemetryEvent[], abilityId: string): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.type === 'damage' && event.abilityId === abilityId) ids.add(event.targetId);
  }
  return ids;
}

function castOnce(
  ability: Ability,
  targets: number,
  setup?: (simulation: Simulation, caster: Combatant, enemies: readonly Combatant[]) => void,
) {
  const run = fight(targets, { abilities: [ability] });
  setup?.(run.simulation, run.caster, run.enemies);
  castAbility(run.simulation, run.caster, run.caster.abilities.get(ability.id)!, run.enemies[0]);
  run.simulation.advanceTo(seconds(40));
  return run;
}

describe('the area abilities strike every target they are allowed', () => {
  // [ability, the aura or ability id its damage carries, how many of FIVE it reaches]
  const CASES: readonly [Ability, string, number][] = [
    [anyStance(THUNDER_CLAP), 'thunder_clap', 4],
    [anyStance(WHIRLWIND), 'whirlwind', 4],
    [MULTI_SHOT, 'multi_shot', 3],
    [EXPLOSIVE_TRAP_ABILITY, 'explosive_trap', 5],
    [VOLLEY, 'volley', 5],
    [ARCANE_EXPLOSION, 'arcane_explosion', 5],
    [BLAST_WAVE, 'blast_wave', 5],
    [BLIZZARD, 'blizzard', 5],
    [CONSECRATION, 'consecration', 5],
    [HURRICANE, 'hurricane', 5],
    [SWIPE, 'swipe', 3],
    [HOLY_NOVA, 'holy_nova', 5],
    [MAGMA_TOTEM, 'magma_totem', 5],
    [HELLFIRE, 'hellfire', 5],
    [RAIN_OF_FIRE, 'rain_of_fire', 5],
  ];

  it.each(CASES)('%s reaches its targets out of five, and only the one at one', (ability, id, n) => {
    expect(struckBy(castOnce(ability, 5).events, id).size, ability.id).toBe(n);
    expect([...struckBy(castOnce(ability, 1).events, id)], ability.id).toEqual(['dummy_1']);
  });

  it('Fire Nova reaches every target once a fire totem is up', () => {
    const run = castOnce(FIRE_NOVA, 5, (simulation, caster, enemies) => {
      simulation.advanceTo(0);
      simulation.applyAura(enemies[0], SEARING_TOTEM_DOT, caster.id);
    });
    expect(struckBy(run.events, 'fire_nova').size).toBe(5);
  });

  it('Primal Bite strikes one target, since Berserk left the tree', () => {
    const plain = castOnce(MANGLE, 5);
    expect(struckBy(plain.events, 'mangle').size).toBe(1);
  });

  it('Consecration gives the first four both halves and the rest the 96', () => {
    const run = castOnce(CONSECRATION, 6);
    const totals = new Map<string, number>();
    // At zero spell power the totals are the flat damage, which is the split.
    const zero = fight(6, { abilities: [CONSECRATION], stats: { spellPower: 0 } });
    castAbility(zero.simulation, zero.caster, zero.caster.abilities.get('consecration')!, zero.enemies[0]);
    zero.simulation.advanceTo(seconds(20));
    for (const event of zero.events) {
      if (event.type === 'damage' && event.abilityId === 'consecration' && !event.critical) {
        totals.set(event.targetId, Math.max(totals.get(event.targetId) ?? 0, event.amount));
      }
    }
    const perTick = [...totals.values()];
    expect(perTick.filter((v) => v > perTick[perTick.length - 1]).length).toBe(
      CONSECRATION_FULL_TARGETS,
    );
    expect(Math.max(...perTick) / Math.min(...perTick)).toBeCloseTo(CONSECRATION_TOTAL / 96, 5);
    expect(struckBy(run.events, 'consecration').size).toBe(6);
  });
});

describe('Hellfire burns the caster, and the group heals it back', () => {
  it('takes 210 a tick, records it as a heal a second later, and ends whole', () => {
    const run = fight(1, { abilities: [HELLFIRE] });
    run.simulation.advanceTo(0);
    const full = run.caster.health.current;
    castAbility(run.simulation, run.caster, run.caster.abilities.get('hellfire')!, run.enemies[0]);
    // Two seconds in: two ticks paid, the first already healed back.
    run.simulation.advanceTo(seconds(2) + 1);
    expect(run.caster.health.current).toBe(full - HELLFIRE_SELF_DAMAGE);
    run.simulation.advanceTo(seconds(40));
    expect(run.caster.health.current).toBe(full);
    const heals = run.events.filter((e) => e.type === 'heal' && e.abilityName === HELLFIRE_HEAL_NAME);
    expect(heals).toHaveLength(15);
    // A health cost, not a damage event: nothing from the caster to itself.
    expect(
      run.events.some((e) => e.type === 'damage' && e.targetId === run.caster.id),
    ).toBe(false);
  });
});

describe("the owner's eight coefficients", () => {
  it('are the stated figures', () => {
    expect(HELLFIRE_TICK_SP_COEFFICIENT).toBe(0.022);
    expect(RAIN_OF_FIRE_TICK_SP_COEFFICIENT).toBe(0.03);
    expect(VOLLEY_TICK_RAP_COEFFICIENT).toBe(0.03);
    expect(ARCANE_EXPLOSION_SP_COEFFICIENT).toBe(0.143);
    expect(BLIZZARD_TICK_SP_COEFFICIENT).toBe(0.03);
    expect(HOLY_NOVA_SP_COEFFICIENT).toBe(0.107);
    expect(HURRICANE_TICK_SP_COEFFICIENT).toBe(0.03);
    expect(MAGMA_TOTEM_PULSE_SP_COEFFICIENT).toBe(0.0255);
  });

  /** Mean damage of one ability's landed, non-crit hits at a given stat block. */
  function meanHit(ability: Ability, id: string, stats: Record<string, number>): number {
    const run = fight(1, { abilities: [ability], stats });
    castAbility(run.simulation, run.caster, run.caster.abilities.get(ability.id)!, run.enemies[0]);
    run.simulation.advanceTo(seconds(40));
    const hits = run.events.flatMap((e) =>
      e.type === 'damage' && e.abilityId === id && e.amount > 0 && !e.critical ? [e.amount] : [],
    );
    return hits.reduce((a, b) => a + b, 0) / hits.length;
  }

  it.each([
    [ARCANE_EXPLOSION, 'arcane_explosion', 0.143],
    [HOLY_NOVA, 'holy_nova', 0.107],
    [BLIZZARD, 'blizzard', 0.03],
    [HURRICANE, 'hurricane', 0.03],
  ] as const)('%s gains its coefficient per point of spell power', (ability, id, coefficient) => {
    // Variance-free: each spell's flat damage is a midpoint, and these rows roll
    // no spread, so the slope over 1000 spell power is the coefficient.
    const slope = (meanHit(ability, id, { spellPower: 1000 }) - meanHit(ability, id, { spellPower: 0 })) / 1000;
    expect(slope).toBeCloseTo(coefficient, 3);
  });

  it('Volley reads RANGED attack power and not spell power', () => {
    const low = meanHit(VOLLEY, 'volley', { rangedAttackPower: 0, spellPower: 0 });
    const high = meanHit(VOLLEY, 'volley', { rangedAttackPower: 1000, spellPower: 0 });
    const sp = meanHit(VOLLEY, 'volley', { rangedAttackPower: 0, spellPower: 1000 });
    expect((high - low) / 1000).toBeCloseTo(VOLLEY_TICK_RAP_COEFFICIENT, 3);
    expect(sp).toBeCloseTo(low, 5);
  });
});

describe('Chain Lightning jumps', () => {
  it('strikes three targets, each jump 30% less than the hit before', () => {
    const run = fight(5, { abilities: [CHAIN_LIGHTNING], stats: { spellPower: 0 } });
    castAbility(run.simulation, run.caster, run.caster.abilities.get('chain_lightning')!, run.enemies[0]);
    run.simulation.advanceTo(seconds(5));
    const hits = run.events.filter((e) => e.type === 'damage' && e.abilityId === 'chain_lightning');
    expect(hits.map((e) => e.type === 'damage' && e.targetId)).toEqual(['dummy_1', 'dummy_2', 'dummy_3']);
    const landed = hits.flatMap((e) => (e.type === 'damage' && e.amount > 0 && !e.critical ? [e] : []));
    for (const hit of landed) {
      const jump = Number(hit.type === 'damage' ? hit.targetId.slice(-1) : 0) - 1;
      expect(hit.type === 'damage' && hit.amount).toBeCloseTo(
        CHAIN_LIGHTNING_DAMAGE * CHAIN_LIGHTNING_JUMP_FACTOR ** jump,
        5,
      );
    }
  });

  it('overloads into a whole duplicate chain at half damage, with no threat (57c)', () => {
    const events: TelemetryEvent[] = [];
    const caster = makeAttacker({
      autoAttack: 'none',
      abilities: [CHAIN_LIGHTNING],
      castReactions: [lightningOverload(100)],
      stats: { spellPower: 0 },
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const enemies = Array.from({ length: 5 }, (_, i) =>
      makeTarget({ id: `dummy_${i + 1}`, maxHealth: 10_000_000 }),
    );
    const simulation = buildSimulation([caster, ...enemies], { threatRules: FOREVER_THREAT_RULES }, {
      emit: (event) => events.push(event),
    });
    const manaBefore = caster.resources.get('mana')!.current;
    castAbility(simulation, caster, caster.abilities.get('chain_lightning')!, enemies[0]);
    simulation.advanceTo(seconds(5));

    const overload = events.filter(
      (e) => e.type === 'damage' && e.abilityName === 'Chain Lightning (Overload)',
    );
    expect(overload.map((e) => e.type === 'damage' && e.targetId)).toEqual(['dummy_1', 'dummy_2', 'dummy_3']);
    for (const hit of overload) {
      if (hit.type !== 'damage' || hit.amount === 0 || hit.critical) continue;
      const jump = Number(hit.targetId.slice(-1)) - 1;
      expect(hit.amount).toBeCloseTo(
        CHAIN_LIGHTNING_DAMAGE * LIGHTNING_OVERLOAD_FRACTION * CHAIN_LIGHTNING_JUMP_FACTOR ** jump,
        5,
      );
    }
    // No threat from the copy, and the cast itself still threatens.
    const threat = events.filter((e) => e.type === 'threat');
    expect(threat.some((e) => e.type === 'threat' && e.abilityName === 'Chain Lightning (Overload)')).toBe(false);
    expect(threat.some((e) => e.type === 'threat' && e.abilityName === 'Chain Lightning')).toBe(true);
    // No mana: one cast's cost and nothing more.
    expect(manaBefore - caster.resources.get('mana')!.current).toBe(CHAIN_LIGHTNING.cost!.amount);
  });

  it('is one target at one target', () => {
    const run = castOnce(CHAIN_LIGHTNING, 1);
    expect([...struckBy(run.events, 'chain_lightning')]).toEqual(['dummy_1']);
  });

  it('has no cooldown while Elemental Mastery is up', () => {
    const run = fight(3, { abilities: [CHAIN_LIGHTNING] });
    run.simulation.advanceTo(0);
    const chain = run.caster.abilities.get('chain_lightning')!;
    castAbility(run.simulation, run.caster, chain, run.enemies[0]);
    run.simulation.advanceTo(seconds(2.1));
    expect(run.simulation.castRejection(run.caster, chain, run.enemies[0], { ignoreGcd: true })).toBe(
      'on_cooldown',
    );
    run.simulation.applyAura(run.caster, ELEMENTAL_MASTERY_AURA, run.caster.id);
    expect(run.simulation.castRejection(run.caster, chain, run.enemies[0], { ignoreGcd: true })).toBeUndefined();
  });
});

describe('Multi-DoT', () => {
  /** A fight running one entry: Corruption, gated on the target lacking it. */
  function spread(targets: number, multiDot: number | undefined) {
    const list: AplList = {
      name: 'Multi-DoT test',
      entries: [
        {
          abilityId: 'corruption',
          condition: { kind: 'aura', on: 'target', auraId: 'corruption', present: false },
          ...(multiDot !== undefined ? { multiDot } : {}),
        },
      ],
    };
    const run = fight(targets, {
      abilities: [{ ...CORRUPTION_ABILITY, castTimeMs: 0 }],
      rotation: compileRotation(list),
      stats: { spellPower: 0, hitChance: 100 },
    });
    run.simulation.advanceTo(seconds(10));
    return new Set(
      run.events.flatMap((e) =>
        e.type === 'aura_applied' && e.auraId === 'corruption' ? [e.targetId] : [],
      ),
    );
  }

  it('spreads a DoT across the first X targets, boss first', () => {
    expect([...spread(5, 3)].sort()).toEqual(['dummy_1', 'dummy_2', 'dummy_3']);
  });

  it('treats X above the number of targets as the number of targets', () => {
    expect([...spread(2, 6)].sort()).toEqual(['dummy_1', 'dummy_2']);
  });

  it('without it, an entry stays on the boss', () => {
    expect([...spread(5, undefined)]).toEqual(['dummy_1']);
  });

  it('is stored only when it is more than one, and validated on load', () => {
    const entries = [{ abilityId: 'corruption' }];
    expect(setMultiDot(entries, 0, 3)).toEqual([{ abilityId: 'corruption', multiDot: 3 }]);
    expect(setMultiDot(setMultiDot(entries, 0, 3), 0, undefined)).toEqual(entries);
    expect(setMultiDot(entries, 0, 1)).toEqual(entries);
    const profile = JSON.parse(serializeProfile(createDefaultProfile()));
    profile.rotation.entries = [{ abilityId: 'corruption', multiDot: 0 }];
    expect(validateProfile(profile).ok).toBe(false);
    profile.rotation.entries = [{ abilityId: 'corruption', multiDot: 4 }];
    expect(validateProfile(profile).ok).toBe(true);
  });

  it('puts Bane of Havoc on target #2 whatever it is cast at, and only there', () => {
    /*
     * THE OWNER'S RULING (round 59): "on >1 target Bane of Havoc should be
     * hardcoded to cast on target #2". It used to go wherever the entry aimed
     * it -- this test cast it at #2 and then #3 and expected #3.
     */
    const run = fight(3, { abilities: [BANE_OF_HAVOC_ABILITY], stats: { hitChance: 100 } });
    run.simulation.advanceTo(0);
    const havoc = run.caster.abilities.get('bane_of_havoc')!;
    castAbility(run.simulation, run.caster, havoc, run.enemies[2]);
    const carriers = run.enemies.filter((e) => e.auras.has(BANE_OF_HAVOC.id)).map((e) => e.id);
    expect(carriers).toEqual(['dummy_2']);
    // And it is refused while it is up there.
    run.simulation.advanceTo(seconds(2));
    expect(castAbility(run.simulation, run.caster, havoc, run.enemies[0]).ok).toBe(false);
  });

  it('refuses Bane of Havoc on a single target, where it copies nothing', () => {
    const run = fight(1, { abilities: [BANE_OF_HAVOC_ABILITY], stats: { hitChance: 100 } });
    run.simulation.advanceTo(0);
    const havoc = run.caster.abilities.get('bane_of_havoc')!;
    expect(castAbility(run.simulation, run.caster, havoc, run.enemies[0]).ok).toBe(false);
  });
});

describe('"strike an additional opponent": Sweeping Strikes and Blade Flurry', () => {
  function meleeHits(run: ReturnType<typeof fight>, count: number) {
    for (let i = 0; i < count; i++) {
      dealDamage(run.simulation, {
        source: run.caster,
        target: run.enemies[0],
        abilityId: 'test_strike',
        abilityName: 'Test Strike',
        school: 'physical',
        baseAmount: 500,
        attackTable: 'melee-special',
        weaponSlot: 'mainHand',
      });
    }
  }

  it('Sweeping Strikes copies five landed hits onto a second target and is spent', () => {
    const run = fight(3, { reactions: [SWEEPING_STRIKES_EXTRA_OPPONENT] });
    run.simulation.advanceTo(0);
    run.simulation.applyAura(run.caster, SWEEPING_STRIKES, run.caster.id);
    expect(run.caster.auras.stacksOf(SWEEPING_STRIKES.id)).toBe(SWEEPING_STRIKES_CHARGES);
    meleeHits(run, 20);

    const landed = run.events.filter(
      (e) => e.type === 'damage' && e.abilityId === 'test_strike' && e.amount > 0,
    );
    const copies = run.events.filter((e) => e.type === 'damage' && e.abilityId === 'sweeping_strikes');
    expect(copies).toHaveLength(SWEEPING_STRIKES_CHARGES);
    expect(new Set(copies.map((e) => e.type === 'damage' && e.targetId))).toEqual(new Set(['dummy_2']));
    copies.forEach((copy, index) => {
      expect(copy.type === 'damage' && copy.amount).toBe(
        landed[index].type === 'damage' && landed[index].amount,
      );
    });
    expect(run.caster.auras.has(SWEEPING_STRIKES.id)).toBe(false);
  });

  it('Blade Flurry copies every landed hit, and nothing at one target', () => {
    const run = fight(2, { reactions: [BLADE_FLURRY_EXTRA_OPPONENT] });
    run.simulation.advanceTo(0);
    run.simulation.applyAura(run.caster, BLADE_FLURRY, run.caster.id);
    meleeHits(run, 10);
    const landed = run.events.filter(
      (e) => e.type === 'damage' && e.abilityId === 'test_strike' && e.amount > 0,
    ).length;
    const copies = run.events.filter((e) => e.type === 'damage' && e.abilityId === 'blade_flurry');
    expect(copies).toHaveLength(landed);

    const alone = fight(1, { reactions: [BLADE_FLURRY_EXTRA_OPPONENT] });
    alone.simulation.advanceTo(0);
    alone.simulation.applyAura(alone.caster, BLADE_FLURRY, alone.caster.id);
    meleeHits(alone, 10);
    expect(alone.events.some((e) => e.type === 'damage' && e.abilityId === 'blade_flurry')).toBe(false);
  });
});

describe('Bane of Havoc', () => {
  it('copies 15% of damage dealt to OTHER targets onto the cursed one', () => {
    const run = fight(3, { reactions: [...BANE_OF_HAVOC_REACTIONS] });
    run.simulation.advanceTo(0);
    run.simulation.applyAura(run.enemies[0], BANE_OF_HAVOC, run.caster.id);
    for (const target of [run.enemies[0], run.enemies[1], run.enemies[2]]) {
      dealDamage(run.simulation, {
        source: run.caster,
        target,
        abilityId: 'test_bolt',
        abilityName: 'Test Bolt',
        school: 'fire',
        baseAmount: 1000,
        attackTable: 'spell',
      });
    }
    const hits = run.events.filter(
      (e) => e.type === 'damage' && e.abilityId === 'test_bolt' && e.targetId !== 'dummy_1' && e.amount > 0,
    );
    const copies = run.events.filter((e) => e.type === 'damage' && e.abilityId === 'bane_of_havoc');
    expect(copies).toHaveLength(hits.length);
    copies.forEach((copy, index) => {
      expect(copy.type === 'damage' && copy.targetId).toBe('dummy_1');
      const hit = hits[index];
      expect(copy.type === 'damage' ? copy.amount : 0).toBeCloseTo(
        (hit.type === 'damage' ? hit.amount : 0) * BANE_OF_HAVOC_SHARE,
        5,
      );
    });
  });

  it('is one Bane: casting it takes a Bane of Agony off the target', () => {
    const run = fight(1, {
      abilities: [BANE_OF_HAVOC_ABILITY],
      stats: { spellPower: 0, hitChance: 100 },
    });
    run.simulation.advanceTo(0);
    run.simulation.applyAura(run.enemies[0], { id: 'bane_of_agony', name: 'Bane of Agony', durationMs: seconds(24) }, run.caster.id);
    castAbility(run.simulation, run.caster, run.caster.abilities.get('bane_of_havoc')!, run.enemies[0]);
    if (run.enemies[0].auras.has(BANE_OF_HAVOC.id)) {
      expect(run.enemies[0].auras.has('bane_of_agony')).toBe(false);
    }
  });
});

describe('Holy Nova causes no threat', () => {
  it('reads a multiplier of zero from the threat rules', () => {
    expect(FOREVER_THREAT_RULES.ability?.('holy_nova', makeAttacker())?.multiplier).toBe(0);
  });
});

describe('the encounter builds Number of Targets', () => {
  const withTargets = (n: number, targetAttacks = false): CharacterProfile => {
    const base = createDefaultProfile();
    return { ...base, encounter: { ...base.encounter, numberOfTargets: n, targetAttacks } };
  };

  it('one target is exactly the boss', () => {
    const targets = createTargetsFor(withTargets(1));
    expect(targets.map((t) => t.id)).toEqual(['dummy_1']);
  });

  it('extra targets are adds that swing for 500 every 2 seconds and do not ramp', () => {
    const targets = createTargetsFor(withTargets(4, true));
    expect(targets.map((t) => t.id)).toEqual(['dummy_1', 'dummy_2', 'dummy_3', 'dummy_4']);
    const [boss, ...adds] = targets;
    expect(boss.reactions.some((r) => r.id.includes('ramp'))).toBe(true);
    for (const add of adds) {
      expect(add.weapons.mainHand?.baseDamage).toBe(EXTRA_TARGET_SWING_DAMAGE);
      expect(add.weapons.mainHand?.swingTimerMs).toBe(seconds(EXTRA_TARGET_SWING_SECONDS));
      expect(add.reactions).toHaveLength(0);
      expect(add.namesOwnSwings).toBe(true);
    }
  });

  it('a DPS run gives the adds no weapon at all', () => {
    for (const add of createTargetsFor(withTargets(3)).slice(1)) {
      expect(add.weapons.mainHand).toBeUndefined();
    }
  });

  it("a swinging target's adds keep hitting at the same size while the boss ramps", () => {
    // A damage build, so most swings LAND -- a shield tank avoids or blocks
    // nearly all of them and leaves nothing to measure.
    const profile = PRESETS_BY_ID.get('mage_fire')!.build();
    const tank: CharacterProfile = {
      ...profile,
      simulation: { ...profile.simulation, iterations: 1 },
      encounter: { ...profile.encounter, targetAttacks: true, numberOfTargets: 3 },
    };
    const events: TelemetryEvent[] = [];
    const simulation = new SimulationClass(trainingDummyEncounter(tank), {
      emit: (event) => events.push(event),
    });
    simulation.run();
    const raw = (sourceId: string) =>
      events.flatMap((e) =>
        e.type === 'damage' && e.sourceId === sourceId && e.amount > 0 && e.outcome === 'hit'
          ? [e.amount + (e.mitigated ?? 0)]
          : [],
      );
    const add = raw('dummy_2');
    const boss = raw('dummy_1');
    expect(add.length).toBeGreaterThan(5);
    // Every add swing sits inside the boss's 15% variance band around 500,
    // early and late alike -- no ramp.
    for (const swing of add) {
      expect(swing).toBeLessThanOrEqual(EXTRA_TARGET_SWING_DAMAGE * 1.15 + 1);
      expect(swing).toBeGreaterThanOrEqual(EXTRA_TARGET_SWING_DAMAGE * 0.85 - 1);
    }
    // While the boss ramps: its last landed swing is far past its first. The
    // ramp is capped at 2x since round 79, so with a swing's own variance the
    // last can land just under twice the first -- half again is the claim.
    expect(boss[boss.length - 1]).toBeGreaterThan(boss[0] * 1.5);
  });

  it("the raid's debuffs land on the boss and not on an add", () => {
    const profile = PRESETS_BY_ID.get('dw_fury')!.build();
    const many: CharacterProfile = {
      ...profile,
      encounter: { ...profile.encounter, numberOfTargets: 3 },
    };
    const simulation = new SimulationClass(trainingDummyEncounter(many));
    simulation.advanceTo(0);
    const debuffs = selectedRaidBuffs(many.raidBuffs).flatMap((buff) =>
      buff.appliesTo === 'enemy' && buff.aura ? [buff.aura.id] : [],
    );
    expect(debuffs.length).toBeGreaterThan(0);
    const boss = simulation.combatants.find((c) => c.id === 'dummy_1')!;
    const add = simulation.combatants.find((c) => c.id === 'dummy_2')!;
    for (const id of debuffs) {
      expect(boss.auras.has(id), id).toBe(true);
      expect(add.auras.has(id), id).toBe(false);
    }
  });

  it('debuff uptime reports the boss once, not a row per target', () => {
    const profile = PRESETS_BY_ID.get('prot_warr')!.build();
    const many: CharacterProfile = {
      ...profile,
      simulation: { ...profile.simulation, iterations: 2 },
      encounter: { ...profile.encounter, numberOfTargets: 4 },
    };
    const batch = runProfileBatch(many);
    const names = batch.debuffUptime.map((row) => row.auraId);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('Number of Targets on the profile', () => {
  it('defaults to one, and the panel offers 1 to 8', () => {
    expect(createDefaultProfile().encounter.numberOfTargets).toBe(1);
    expect(TARGET_COUNT_OPTIONS.map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('a version 16 profile migrates to one target', () => {
    const old = JSON.parse(serializeProfile(createDefaultProfile()));
    old.version = 16;
    delete old.encounter.numberOfTargets;
    const result = parseProfile(JSON.stringify(old));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.encounter.numberOfTargets).toBe(1);
    const migrated = migrateProfile(old);
    expect(migrated.ok).toBe(true);
  });

  it.each([0, 9, 2.5, '3'])('refuses %s targets', (bad) => {
    const profile = JSON.parse(serializeProfile(createDefaultProfile()));
    profile.encounter.numberOfTargets = bad;
    expect(validateProfile(profile).ok).toBe(false);
  });
});

describe('the "number of targets" APL condition', () => {
  const at = (targets: number, condition: AplCondition) => {
    const run = fight(targets);
    run.simulation.advanceTo(0);
    return compileCondition(condition)(run.simulation, run.caster, run.enemies[0]);
  };

  it('compares the living enemies against the count', () => {
    expect(at(1, targetCount('atLeast', 3))).toBe(false);
    expect(at(3, targetCount('atLeast', 3))).toBe(true);
    expect(at(5, targetCount('atLeast', 3))).toBe(true);
    expect(at(1, targetCount('exactly', 1))).toBe(true);
    expect(at(2, targetCount('below', 2))).toBe(false);
  });

  it('describes itself', () => {
    expect(describeCondition(targetCount('atLeast', 3))).toContain('3 targets');
  });

  it('round-trips through the editor unchanged', () => {
    for (const condition of [
      targetCount('atLeast', 3),
      targetCount('exactly', 1),
      { kind: 'all', of: [targetCount('above', 2), { kind: 'fightElapsed', compare: 'atLeast', seconds: 5 }] },
      { kind: 'not', of: targetCount('atMost', 1) },
    ] as AplCondition[]) {
      expect(conditionOf(rootOf(condition))).toEqual(condition);
    }
  });
});
