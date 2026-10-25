import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { Combatant as CombatantClass, castAbility, seconds } from '../../src/engine';
import {
  ANCESTRAL_HEALING_KEY,
  CHAIN_HEAL,
  CHAIN_HEAL_HEAL,
  HEALING_WAVE,
  LESSER_HEALING_WAVE,
  MANA_TIDE_TOTEM,
  NATURES_SWIFTNESS_ABILITY,
  RIPTIDE,
  WATER_SHIELD_ABILITY,
} from '../../src/game/abilities/shaman';
import {
  MANA_TIDE_MANA_PER_TICK,
  RIPTIDE_HOT_TOTAL,
  WATER_SHIELD_MANA_FRACTION,
} from '../../src/game/auras/shaman';
import {
  CHAIN_HEAL_HEAL_COEFFICIENT,
  HEALING_WAVE_HEAL_COEFFICIENT,
  LESSER_HEALING_WAVE_HEAL_COEFFICIENT,
  RIPTIDE_HEAL_COEFFICIENT,
  RIPTIDE_TICK_HEAL_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { SHAMAN_RESTORATION } from '../../src/game/rotations/shaman';
import { compileRotation } from '../../src/game/rotations/apl';
import { conditionOf, rootOf } from '../../src/ui/panels/aplEditing';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { BENCHMARK_TEMPLATES, benchmarkItemsFor } from '../../src/game/items/benchmarkSets';
import { BENCHMARK_SETS } from '../../src/game/items/benchmarkGear';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 60: the Restoration Shaman ("Piss Beam"). Each block pins a mechanism.
 * ==============================================================================
 */

/** A raid member in a party, at a given share of its health. */
function member(id: string, party: number, healthFraction: number): Combatant {
  const actor = new CombatantClass({
    id,
    name: id,
    kind: 'summon',
    faction: 'friendly',
    maxHealth: 10_000,
    party,
  });
  actor.health.set(10_000 * healthFraction);
  return actor;
}

function shaman(crit: number, abilities = [LESSER_HEALING_WAVE, HEALING_WAVE, CHAIN_HEAL, RIPTIDE]) {
  return makeAttacker({
    id: 'shaman',
    autoAttack: 'none',
    abilities,
    resources: [{ type: 'mana', maximum: 10_000 }],
    stats: { spellCritChance: crit, healingPower: 0 },
  });
}

function heals(events: readonly TelemetryEvent[]) {
  return events.filter((event): event is Extract<TelemetryEvent, { type: 'heal' }> => event.type === 'heal');
}

describe("the owner's coefficients", () => {
  it('gives LHW 1.5/3.5, HW 3/3.5, Chain Heal 2.5/3.5, Riptide 21.4% and 10% a tick', () => {
    expect(LESSER_HEALING_WAVE_HEAL_COEFFICIENT).toBe(1.5 / 3.5);
    expect(HEALING_WAVE_HEAL_COEFFICIENT).toBe(3 / 3.5);
    expect(CHAIN_HEAL_HEAL_COEFFICIENT).toBe(2.5 / 3.5);
    expect(RIPTIDE_HEAL_COEFFICIENT).toBe(0.214);
    expect(RIPTIDE_TICK_HEAL_COEFFICIENT).toBe(0.1);
  });

  it("uses the capture's ranks: costs, casts and cooldowns", () => {
    expect([LESSER_HEALING_WAVE.cost?.amount, LESSER_HEALING_WAVE.castTimeMs]).toEqual([380, 1500]);
    expect([HEALING_WAVE.cost?.amount, HEALING_WAVE.castTimeMs]).toEqual([620, 3000]);
    expect([CHAIN_HEAL.cost?.amount, CHAIN_HEAL.castTimeMs]).toEqual([405, 2500]);
    expect([RIPTIDE.cost?.amount, RIPTIDE.cooldownMs]).toEqual([385, 6000]);
    expect([MANA_TIDE_TOTEM.cost?.amount, MANA_TIDE_TOTEM.cooldownMs]).toEqual([60, 300_000]);
    expect([NATURES_SWIFTNESS_ABILITY.cooldownMs, NATURES_SWIFTNESS_ABILITY.triggersGcd]).toEqual([180_000, false]);
  });
});

describe('Chain Heal', () => {
  function chain(party: readonly Combatant[], target: Combatant, riptide = false) {
    const caster = shaman(-100);
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster, ...party], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    if (riptide) castAbility(simulation, caster, caster.abilities.get('riptide')!, target);
    simulation.advanceTo(seconds(2));
    events.length = 0;
    castAbility(simulation, caster, caster.abilities.get('chain_heal')!, target);
    simulation.advanceTo(seconds(5));
    return heals(events).filter((event) => event.abilityId === 'chain_heal');
  }

  it('jumps to the two lowest INJURED members of the target\'s party, halving each time', () => {
    const party = [member('a', 1, 0.5), member('b', 1, 0.6), member('c', 1, 0.4), member('d', 1, 1), member('e', 2, 0.1)];
    const healed = chain(party, party[0]);
    expect(healed.map((e) => e.targetId)).toEqual(['a', 'c', 'b']);
    const raw = healed.map((e) => e.amount + e.overhealing);
    expect(raw[0]).toBeCloseTo(CHAIN_HEAL_HEAL, 6);
    expect(raw[1]).toBeCloseTo(CHAIN_HEAL_HEAL / 2, 6);
    expect(raw[2]).toBeCloseTo(CHAIN_HEAL_HEAL / 4, 6);
  });

  it('jumps once when only one other member is hurt, and not at all when none is', () => {
    expect(chain([member('a', 1, 0.5), member('b', 1, 0.6), member('c', 1, 1)], member('x', 9, 1)).length).toBe(1);
    const one = [member('a', 1, 0.5), member('b', 1, 0.6), member('c', 1, 1)];
    expect(chain(one, one[0]).map((e) => e.targetId)).toEqual(['a', 'b']);
    const none = [member('a', 1, 0.5), member('b', 1, 1)];
    expect(chain(none, none[0]).map((e) => e.targetId)).toEqual(['a']);
  });

  it('heals 25% more on the Riptide target, and the jumps start from that figure', () => {
    const party = [member('a', 1, 0.2), member('b', 1, 0.3)];
    const healed = chain(party, party[0], true);
    const raw = healed.map((e) => e.amount + e.overhealing);
    expect(raw[0]).toBeCloseTo(CHAIN_HEAL_HEAL * 1.25, 6);
    expect(raw[1]).toBeCloseTo(CHAIN_HEAL_HEAL * 1.25 * 0.5, 6);
  });
});

describe('Riptide', () => {
  it('heals at once and then five times over fifteen seconds', () => {
    const caster = shaman(-100);
    const target = member('a', 1, 0.1);
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster, target], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('riptide')!, target);
    simulation.advanceTo(seconds(20));
    const ticks = heals(events).filter((e) => e.abilityId === 'riptide' && e.periodic);
    expect(ticks).toHaveLength(5);
    for (const tick of ticks) expect(tick.amount + tick.overhealing).toBeCloseTo(RIPTIDE_HOT_TOTAL / 5, 6);
  });
});

describe('Water Shield and Ancestral Healing', () => {
  it('restores 2% of maximum mana on a direct heal crit, and nothing on a Riptide tick', () => {
    const caster = shaman(100, [LESSER_HEALING_WAVE, RIPTIDE, WATER_SHIELD_ABILITY]);
    const target = member('a', 1, 0.05);
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster, target], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('water_shield')!, undefined);
    simulation.advanceTo(seconds(2));
    castAbility(simulation, caster, caster.abilities.get('riptide')!, target);
    simulation.advanceTo(seconds(20));
    const gains = events.filter((e) => e.type === 'resource_gained' && e.source === 'water_shield');
    // One direct crit (the Riptide hit); five ticks that crit too, and none of them count.
    expect(gains).toHaveLength(1);
    expect(gains[0].type === 'resource_gained' && gains[0].amount + gains[0].wasted).toBeCloseTo(
      10_000 * WATER_SHIELD_MANA_FRACTION,
      6,
    );
  });

  it('puts Ancestral Healing on a direct crit when the talent marks the heal', () => {
    const marked = { ...LESSER_HEALING_WAVE, bonuses: { [ANCESTRAL_HEALING_KEY]: 25 } };
    const caster = shaman(100, [marked]);
    const target = member('a', 1, 0.05);
    const simulation = buildSimulation([caster, target]);
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('lesser_healing_wave')!, target);
    simulation.advanceTo(seconds(2));
    expect(target.auras.has('ancestral_healing')).toBe(true);
  });

  it('declares the talents that reach the heals', () => {
    expect(SHAMAN_TALENT_EFFECTS.tidal_mastery.map((e) => e.kind)).toEqual(['abilityCrit', 'abilityCrit', 'abilityCrit', 'abilityCrit']);
    expect(SHAMAN_TALENT_EFFECTS.purification.every((e) => e.kind === 'abilityHealing')).toBe(true);
    expect(SHAMAN_TALENT_EFFECTS.healing_way).toEqual([{ kind: 'abilityHealing', abilityId: 'healing_wave' }]);
    expect(SHAMAN_TALENT_EFFECTS.improved_healing_wave).toEqual([{ kind: 'abilityCastTime', abilityId: 'healing_wave' }]);
  });
});

describe("Nature's Swiftness and Mana Tide", () => {
  it('makes the next Nature spell instant, once', () => {
    const caster = shaman(-100, [HEALING_WAVE, NATURES_SWIFTNESS_ABILITY]);
    const target = member('a', 1, 0.1);
    const simulation = buildSimulation([caster, target]);
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('nature_s_swiftness')!, undefined);
    castAbility(simulation, caster, caster.abilities.get('healing_wave')!, target);
    expect(caster.castEndsAt).toBe(0);
    expect(caster.auras.has('nature_s_swiftness')).toBe(false);
  });

  it('restores 290 mana every 3 seconds, four times', () => {
    const caster = shaman(-100, [MANA_TIDE_TOTEM]);
    caster.resources.get('mana')!.set(1000);
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('mana_tide_totem')!, undefined);
    simulation.advanceTo(seconds(20));
    const ticks = events.filter((e) => e.type === 'resource_gained' && e.source === 'mana_tide_totem');
    expect(ticks).toHaveLength(4);
    for (const tick of ticks) expect(tick.type === 'resource_gained' && tick.amount).toBe(MANA_TIDE_MANA_PER_TICK);
  });
});

describe('the APL pieces', () => {
  it('round-trips the injured-count condition through the editor', () => {
    const condition = { kind: 'injuredCount', of: 'targetParty', below: 0.9, compare: 'atLeast', count: 2 } as const;
    expect(conditionOf(rootOf(condition))).toEqual(condition);
    expect(rootOf(condition).children[0].kind).toBe('clause');
  });

  it("aims Chain Heal at the Riptide carrier, which smart healing leaves alone", () => {
    const chainEntry = SHAMAN_RESTORATION.entries.find((e) => e.abilityId === 'chain_heal')!;
    expect(chainEntry.target).toEqual({ kind: 'withAura', auraId: 'riptide' });
    expect(SHAMAN_RESTORATION.smartHealing).toBe(true);
    expect(() => compileRotation(SHAMAN_RESTORATION)).not.toThrow();
  });
});

describe('Piss Beam', () => {
  const profile = PRESETS_BY_ID.get('shaman_resto')!.build();

  it("is the owner's build: 0/12/39, Water Shield before the pull, the Restoration list", () => {
    expect(profile.character).toMatchObject({ name: 'Piss Beam', characterClass: 'shaman' });
    expect(Object.values(profile.talents ?? {}).reduce((a, b) => a + b, 0)).toBe(51);
    expect(profile.precombat?.map((a) => a.abilityId)).toEqual(['water_shield']);
    expect(profile.rotation.name).toBe('Shaman (Restoration)');
  });

  it('wears Mail healer gear: healing power floored, Intellect, Spirit and Crit competing', () => {
    const template = BENCHMARK_TEMPLATES.find((t) => t.presetId === 'shaman_resto')!;
    expect(template.armour).toBe('Mail');
    const e65 = BENCHMARK_SETS.find((s) => s.id === 'E65')!;
    const items = benchmarkItemsFor(template, e65);
    for (const item of items.filter((i) => i.inventoryType !== 'Trinket')) {
      expect((ITEMS_BY_ID.get(item.id)!.stats as Record<string, number>).healingPower ?? 0, item.name).toBeGreaterThan(0);
    }
    const chest = items.find((i) => i.inventoryType === 'Chest')!;
    expect(chest.subclass).toBe('Mail');
  });
});
