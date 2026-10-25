import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { Combatant as CombatantClass, Simulation, castAbility, dealDamage, seconds } from '../../src/engine';
import {
  BINDING_HEAL,
  BINDING_HEAL_HEAL,
  DIVINE_AEGIS_KEY,
  FLASH_HEAL,
  FLASH_HEAL_HEAL,
  GREATER_HEAL,
  GREATER_HEAL_HEAL,
  INNER_FOCUS_ABILITY,
  PENANCE,
  PENANCE_HEAL,
  POWER_WORD_SHIELD,
  POWER_WORD_SHIELD_ABSORB,
  PRAYER_OF_HEALING,
  PRAYER_OF_HEALING_HEAL,
  PRAYER_OF_MENDING,
  PRAYER_OF_MENDING_HEAL,
  RENEW,
  RENEWED_HOPE_CRIT_KEY,
  RENEWED_HOPE_SECONDS_KEY,
} from '../../src/game/abilities/priest';
import { DIVINE_AEGIS_CAP, INNER_FOCUS, RENEW_TICK } from '../../src/game/auras/priest';
import {
  BINDING_HEAL_HEAL_COEFFICIENT,
  FLASH_HEAL_HEAL_COEFFICIENT,
  GREATER_HEAL_HEAL_COEFFICIENT,
  PENANCE_HEAL_COEFFICIENT,
  POWER_WORD_SHIELD_ABSORB_COEFFICIENT,
  PRAYER_OF_HEALING_HEAL_COEFFICIENT,
  PRAYER_OF_MENDING_HEAL_COEFFICIENT,
  RENEW_TICK_HEAL_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { innerFocusSpender } from '../../src/game/reactions/priestTalents';
import { PRIEST_DISCIPLINE, PRIEST_HOLY } from '../../src/game/rotations/priest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { healerEncounter } from '../../src/simulator/healerEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 73: the Holy and Disc Priests. Each block pins a mechanism: the owner's
 * coefficients, Prayer of Mending's jumps, absorbs counted as healing, Divine
 * Aegis adding up, Renewed Hope, Penance's three heals and Inner Focus on it,
 * the talents on the built characters, and both lists in both healer fights.
 * ==============================================================================
 */

function member(id: string, party: number | undefined, healthFraction: number): Combatant {
  const actor = new CombatantClass({
    id,
    name: id,
    kind: 'summon',
    faction: 'friendly',
    maxHealth: 100_000,
    ...(party !== undefined ? { party } : {}),
  });
  actor.health.set(100_000 * healthFraction);
  return actor;
}

const ALL = [FLASH_HEAL, GREATER_HEAL, BINDING_HEAL, PRAYER_OF_HEALING, RENEW, POWER_WORD_SHIELD, PRAYER_OF_MENDING, PENANCE];

function priest(healingPower = 0, crit = -100, abilities = ALL) {
  return makeAttacker({
    id: 'priest',
    autoAttack: 'none',
    abilities,
    maxHealth: 100_000,
    resources: [{ type: 'mana', maximum: 100_000 }],
    stats: { spellCritChance: crit, healingPower },
  });
}

function heals(events: readonly TelemetryEvent[]) {
  return events.filter((event): event is Extract<TelemetryEvent, { type: 'heal' }> => event.type === 'heal');
}
const raw = (event: { amount: number; overhealing: number }) => event.amount + event.overhealing;

function watch(caster: Combatant, others: Combatant[]) {
  const events: TelemetryEvent[] = [];
  const simulation = buildSimulation([caster, ...others], { durationMs: seconds(120) }, { emit: (e) => events.push(e) });
  simulation.begin();
  return { simulation, events };
}

describe("the owner's coefficients and the capture's ranks", () => {
  it('gives the owner\'s eight figures', () => {
    expect(FLASH_HEAL_HEAL_COEFFICIENT).toBe(0.429);
    expect(GREATER_HEAL_HEAL_COEFFICIENT).toBe(0.857);
    expect(PRAYER_OF_HEALING_HEAL_COEFFICIENT).toBe(0.286);
    expect(BINDING_HEAL_HEAL_COEFFICIENT).toBe(0.429);
    expect(RENEW_TICK_HEAL_COEFFICIENT).toBe(0.2);
    expect(POWER_WORD_SHIELD_ABSORB_COEFFICIENT).toBe(0.1);
    expect(PRAYER_OF_MENDING_HEAL_COEFFICIENT).toBe(0.429);
    expect(PENANCE_HEAL_COEFFICIENT).toBe(0.857);
  });

  it("uses foreverchanges.pro's figures, which win a tie with the capture", () => {
    expect(FLASH_HEAL_HEAL).toBe((774 + 910) / 2);
    expect(BINDING_HEAL_HEAL).toBe((774 + 910) / 2);
    expect(GREATER_HEAL_HEAL).toBe((1853 + 2067) / 2);
    expect(PRAYER_OF_HEALING_HEAL).toBe((631 + 667) / 2);
    expect(RENEW_TICK).toBe(830 / 5);
    expect(POWER_WORD_SHIELD_ABSORB).toBe(928);
    expect(PRAYER_OF_MENDING_HEAL).toBe(413);
    expect(PENANCE_HEAL).toBe(425);
    expect([FLASH_HEAL.cost?.amount, GREATER_HEAL.cost?.amount, PRAYER_OF_HEALING.cost?.amount]).toEqual([380, 710, 1070]);
    expect([POWER_WORD_SHIELD.cooldownMs, PRAYER_OF_MENDING.cooldownMs, PENANCE.cooldownMs]).toEqual([4000, 10_000, 12_000]);
  });
});

describe('the heals, untalented', () => {
  it('Flash Heal and Greater Heal heal their base plus their share of healing power', () => {
    for (const [spell, base, coefficient] of [
      [FLASH_HEAL, FLASH_HEAL_HEAL, 0.429],
      [GREATER_HEAL, GREATER_HEAL_HEAL, 0.857],
    ] as const) {
      const caster = priest(1000);
      const t = member('t', 1, 0.1);
      const { simulation, events } = watch(caster, [t]);
      castAbility(simulation, caster, caster.abilities.get(spell.id)!, t);
      simulation.advanceTo(seconds(4));
      expect(raw(heals(events)[0]!), spell.id).toBeCloseTo(base + coefficient * 1000, 6);
    }
  });

  it('Prayer of Healing gives every member of the party the full amount', () => {
    const caster = priest(1000);
    const party = [member('a', 1, 0.1), member('b', 1, 0.1), member('c', 1, 0.1), member('d', 2, 0.1)];
    const { simulation, events } = watch(caster, party);
    castAbility(simulation, caster, caster.abilities.get('prayer_of_healing')!, party[0]);
    simulation.advanceTo(seconds(4));
    const healed = heals(events);
    expect(healed.map((e) => e.targetId).sort()).toEqual(['a', 'b', 'c']);
    for (const e of healed) expect(raw(e)).toBeCloseTo(PRAYER_OF_HEALING_HEAL + 0.286 * 1000, 6);
  });

  it('Binding Heal heals the target and the Priest, each the full amount', () => {
    const caster = priest(0);
    caster.health.set(10_000);
    const t = member('t', 1, 0.1);
    const { simulation, events } = watch(caster, [t]);
    castAbility(simulation, caster, caster.abilities.get('binding_heal')!, t);
    simulation.advanceTo(seconds(2));
    const healed = heals(events);
    expect(healed.map((e) => e.targetId).sort()).toEqual(['priest', 't']);
    for (const e of healed) expect(raw(e)).toBeCloseTo(BINDING_HEAL_HEAL, 6);
  });

  it('Renew ticks five times over fifteen seconds at 166 plus 20%', () => {
    const caster = priest(1000);
    const t = member('t', 1, 0.1);
    const { simulation, events } = watch(caster, [t]);
    castAbility(simulation, caster, caster.abilities.get('renew')!, t);
    simulation.advanceTo(seconds(20));
    const ticks = heals(events).filter((e) => e.abilityId === 'renew');
    expect(ticks.map((e) => e.timestamp)).toEqual([3000, 6000, 9000, 12_000, 15_000]);
    for (const tick of ticks) expect(raw(tick)).toBeCloseTo(RENEW_TICK + 200, 6);
  });

  it('Penance heals three times: at once, then each second, a third of 85.7% each', () => {
    const caster = priest(900);
    const t = member('t', 1, 0.1);
    const { simulation, events } = watch(caster, [t]);
    castAbility(simulation, caster, caster.abilities.get('penance')!, t);
    simulation.advanceTo(seconds(5));
    const healed = heals(events).filter((e) => e.abilityId === 'penance');
    expect(healed.map((e) => e.timestamp)).toEqual([0, 1000, 2000]);
    for (const e of healed) expect(raw(e)).toBeCloseTo(PENANCE_HEAL + (0.857 / 3) * 900, 6);
  });
});

describe('Power Word: Shield', () => {
  it('absorbs 928 plus 10% of healing power, and the soak counts as the Priest\'s healing', () => {
    const caster = priest(1000);
    const t = member('t', 1, 1);
    const boss = makeTarget({ id: 'boss' });
    const { simulation, events } = watch(caster, [t, boss]);
    castAbility(simulation, caster, caster.abilities.get('power_word_shield')!, t);
    const shield = 928 + 100;
    expect(t.auras.get('power_word_shield')!.absorbRemaining).toBeCloseTo(shield, 6);
    dealDamage(simulation, { source: boss, target: t, abilityName: 'Hit', school: 'physical', baseAmount: 600, appliesArmor: false });
    dealDamage(simulation, { source: boss, target: t, abilityName: 'Hit', school: 'physical', baseAmount: 600, appliesArmor: false });
    const soaks = heals(events).filter((e) => e.abilityId === 'power_word_shield');
    expect(soaks.map((e) => e.amount)).toEqual([600, shield - 600]);
    expect(soaks.every((e) => e.sourceId === 'priest' && e.overhealing === 0)).toBe(true);
    // Spent, so gone.
    expect(t.auras.has('power_word_shield')).toBe(false);
  });

  it('puts Weakened Soul on for 15 seconds and is refused while it is up', () => {
    const caster = priest(0);
    const t = member('t', 1, 1);
    const { simulation } = watch(caster, [t]);
    castAbility(simulation, caster, caster.abilities.get('power_word_shield')!, t);
    expect(t.auras.get('weakened_soul')!.expiresAt).toBe(seconds(15));
    simulation.advanceTo(seconds(5));
    expect(simulation.castRejection(caster, caster.abilities.get('power_word_shield')!, t)).toBeDefined();
    simulation.advanceTo(seconds(15));
    expect(simulation.castRejection(caster, caster.abilities.get('power_word_shield')!, t)).toBeUndefined();
  });

  it('Ice Barrier, an absorb that does not opt in, reports no healing', () => {
    const boss = makeTarget({ id: 'boss' });
    const mage = makeAttacker({ id: 'mage', autoAttack: 'none' });
    const { simulation, events } = watch(mage, [boss]);
    simulation.applyAura(mage, { id: 'test_barrier', name: 'Barrier', durationMs: seconds(30), absorb: () => 500 }, mage.id);
    dealDamage(simulation, { source: boss, target: mage, abilityName: 'Hit', school: 'physical', baseAmount: 300, appliesArmor: false });
    expect(heals(events)).toHaveLength(0);
  });
});

describe('Prayer of Mending', () => {
  it('heals its carrier when hit, then jumps to someone else, six heals in all', () => {
    const caster = priest(1000);
    const raid = [member('tank', 1, 0.5), member('a', 1, 0.5), member('b', 2, 0.5), member('c', 3, 0.5)];
    const boss = makeTarget({ id: 'boss' });
    const { simulation, events } = watch(caster, [...raid, boss]);
    castAbility(simulation, caster, caster.abilities.get('prayer_of_mending')!, raid[0]);
    expect(raid[0]!.auras.has('prayer_of_mending')).toBe(true);
    const carriers: string[] = [];
    for (let hit = 0; hit < 10; hit++) {
      const carrier = raid.find((m) => m.auras.has('prayer_of_mending'));
      if (!carrier) break;
      carriers.push(carrier.id);
      dealDamage(simulation, { source: boss, target: carrier, abilityName: 'Hit', school: 'physical', baseAmount: 100, appliesArmor: false });
    }
    const pom = heals(events).filter((e) => e.abilityId === 'prayer_of_mending');
    expect(pom).toHaveLength(6);
    expect(carriers).toHaveLength(6);
    expect(carriers[0]).toBe('tank');
    // Never back onto whoever it just left.
    for (let i = 1; i < carriers.length; i++) expect(carriers[i]).not.toBe(carriers[i - 1]);
    for (const e of pom) expect(raw(e)).toBeCloseTo(PRAYER_OF_MENDING_HEAL + 0.429 * 1000, 6);
    expect(raid.some((m) => m.auras.has('prayer_of_mending'))).toBe(false);
  });

  it('is one per caster: a recast takes the old one off', () => {
    const caster = priest(0);
    const raid = [member('tank', 1, 0.5), member('a', 1, 0.5)];
    const { simulation } = watch(caster, raid);
    castAbility(simulation, caster, caster.abilities.get('prayer_of_mending')!, raid[0]);
    caster.abilities.resetCooldowns();
    caster.gcdReadyAt = 0;
    castAbility(simulation, caster, caster.abilities.get('prayer_of_mending')!, raid[1]);
    expect(raid.filter((m) => m.auras.has('prayer_of_mending')).map((m) => m.id)).toEqual(['a']);
  });
});

describe('Divine Aegis', () => {
  function aegisPriest() {
    const marked = { ...FLASH_HEAL, bonuses: { [DIVINE_AEGIS_KEY]: 15 } };
    return priest(0, 100, [marked]);
  }

  it('shields 15% of a non-periodic crit, adding up to 1,200 rather than refreshing', () => {
    const caster = aegisPriest();
    const t = member('t', 1, 0.01);
    const { simulation } = watch(caster, [t]);
    const crit = FLASH_HEAL_HEAL * 1.5;
    castAbility(simulation, caster, caster.abilities.get('flash_heal')!, t);
    simulation.advanceTo(seconds(2));
    expect(t.auras.get('divine_aegis')!.absorbRemaining).toBeCloseTo(crit * 0.15, 6);
    castAbility(simulation, caster, caster.abilities.get('flash_heal')!, t);
    simulation.advanceTo(seconds(4));
    expect(t.auras.get('divine_aegis')!.absorbRemaining).toBeCloseTo(crit * 0.3, 6);
    for (let i = 0; i < 20; i++) {
      castAbility(simulation, caster, caster.abilities.get('flash_heal')!, t);
      simulation.advanceTo(simulation.clock.now() + seconds(2));
    }
    expect(t.auras.get('divine_aegis')!.absorbRemaining).toBe(DIVINE_AEGIS_CAP);
  });
});

describe('Renewed Hope', () => {
  it('crits 10% more on a Weakened Soul target and takes five seconds off it per heal', () => {
    const shield = { ...POWER_WORD_SHIELD, bonuses: { [RENEWED_HOPE_CRIT_KEY]: 10 } };
    const flash = { ...FLASH_HEAL, bonuses: { [RENEWED_HOPE_SECONDS_KEY]: 5 } };
    const caster = priest(0, 0, [shield, flash]);
    const t = member('t', 1, 0.1);
    const { simulation } = watch(caster, [t]);
    castAbility(simulation, caster, caster.abilities.get('power_word_shield')!, t);
    expect(t.abilityModifierAgainst('flash_heal').critBonus).toBe(10);
    expect(t.auras.get('weakened_soul')!.expiresAt).toBe(seconds(15));
    simulation.advanceTo(seconds(2));
    castAbility(simulation, caster, caster.abilities.get('flash_heal')!, t);
    simulation.advanceTo(seconds(4));
    expect(t.auras.get('weakened_soul')!.expiresAt).toBe(seconds(10));
    castAbility(simulation, caster, caster.abilities.get('flash_heal')!, t);
    simulation.advanceTo(seconds(6));
    castAbility(simulation, caster, caster.abilities.get('flash_heal')!, t);
    // Five seconds were left at most; the third heal takes the rest.
    expect(t.auras.has('weakened_soul')).toBe(false);
  });
});

describe('Inner Focus on Penance', () => {
  it('makes Penance free and gives all three heals +25% crit', () => {
    const caster = makeAttacker({
      id: 'priest',
      autoAttack: 'none',
      abilities: [INNER_FOCUS_ABILITY, PENANCE],
      resources: [{ type: 'mana', maximum: 100_000 }],
      stats: { spellCritChance: 0, healingPower: 0 },
      castReactions: [innerFocusSpender()],
    });
    const t = member('t', 1, 0.1);
    const { simulation, events } = watch(caster, [t]);
    castAbility(simulation, caster, caster.abilities.get('inner_focus')!, undefined);
    simulation.advanceTo(1);
    expect(caster.abilityModifierFor('penance')?.critBonus).toBe(25);
    castAbility(simulation, caster, caster.abilities.get('penance')!, t);
    simulation.advanceTo(seconds(1.5));
    expect(caster.auras.has(INNER_FOCUS.id)).toBe(true);
    simulation.advanceTo(seconds(3));
    expect(caster.auras.has(INNER_FOCUS.id)).toBe(false);
    const spent = events.filter((e) => e.type === 'resource_spent' && e.resource === 'mana');
    expect(spent.reduce((sum, e) => sum + (e as { amount: number }).amount, 0)).toBe(0);
  });
});

describe("the owner's talents, on the built characters", () => {
  const build = (id: string) => {
    const profile = PRESETS_BY_ID.get(id)!.build();
    return { profile, player: createPlayer({ ...profile.character, talents: profile.talents }) };
  };

  it("takes each URL's 51 points", () => {
    for (const id of ['priest_holy', 'priest_disc']) {
      const total = Object.values(build(id).profile.talents).reduce((a, b) => a + (b ?? 0), 0);
      expect(total, id).toBe(51);
    }
  });

  it('Holy knows Prayer of Mending and Binding Heal; Disc knows Penance and Inner Focus', () => {
    const holy = build('priest_holy').player;
    const disc = build('priest_disc').player;
    expect(['prayer_of_mending', 'binding_heal'].every((id) => holy.abilities.has(id))).toBe(true);
    expect(holy.abilities.has('penance')).toBe(false);
    expect(['penance', 'inner_focus'].every((id) => disc.abilities.has(id))).toBe(true);
    expect(disc.abilities.has('prayer_of_mending')).toBe(false);
  });

  it('Spiritual Healing +10% and Holy Specialization +5% crit on the heals; Improved PW:S +20% on the shield', () => {
    const holy = build('priest_holy').player;
    expect(holy.abilityModifierFor('greater_heal')?.healingMultiplier).toBeCloseTo(1.1, 10);
    expect(holy.abilityModifierFor('greater_heal')?.critBonus).toBe(5);
    // Twin Disciplines on the instants, and Improved Renew 2/3.
    expect(holy.abilityModifierFor('renew')?.healingMultiplier).toBeCloseTo(1.1 * 1.05 * 1.1, 10);
    expect(holy.abilityModifierFor('power_word_shield')?.healingMultiplier).toBeCloseTo(1.2, 10);
  });

  it('Soul Warding takes the shield cooldown off; Divine Fury takes 0.5s off Greater Heal', () => {
    const holy = build('priest_holy').player;
    expect(holy.abilities.get('power_word_shield')!.cooldownMs ?? 0).toBe(0);
    expect(holy.abilities.get('greater_heal')!.castTimeMs).toBe(2500);
  });

  it('Disc carries Renewed Hope and Divine Aegis on its heals', () => {
    const disc = build('priest_disc').player;
    expect(disc.abilities.get('power_word_shield')!.bonuses?.[RENEWED_HOPE_CRIT_KEY]).toBe(10);
    expect(disc.abilities.get('flash_heal')!.bonuses?.[RENEWED_HOPE_SECONDS_KEY]).toBe(5);
    expect(disc.abilities.get('penance')!.bonuses?.[DIVINE_AEGIS_KEY]).toBe(15);
  });
});

describe('the lists, in both healer fights', () => {
  function casts(id: string, fight: 'tank' | 'raid') {
    const profile = PRESETS_BY_ID.get(id)!.build();
    const events: TelemetryEvent[] = [];
    new Simulation(healerEncounter(profile, fight, 4242), { emit: (e) => events.push(e) }).run();
    return events.filter((e): e is Extract<TelemetryEvent, { type: 'cast' }> => e.type === 'cast');
  }

  it('each preset runs its own list', () => {
    expect(PRESETS_BY_ID.get('priest_holy')!.build().rotation.name).toBe(PRIEST_HOLY.name);
    expect(PRESETS_BY_ID.get('priest_disc')!.build().rotation.name).toBe(PRIEST_DISCIPLINE.name);
  });

  it('Holy: Renew, the shield and Flash Heal in the tank fight; Prayer of Mending and Prayer of Healing in the raid', () => {
    const tank = new Set(casts('priest_holy', 'tank').map((e) => e.abilityId));
    expect(['renew', 'power_word_shield', 'flash_heal'].every((id) => tank.has(id))).toBe(true);
    expect(tank.has('prayer_of_mending') || tank.has('prayer_of_healing')).toBe(false);
    const raid = new Set(casts('priest_holy', 'raid').map((e) => e.abilityId));
    expect(['renew', 'power_word_shield', 'prayer_of_mending', 'prayer_of_healing'].every((id) => raid.has(id))).toBe(true);
    expect(raid.has('flash_heal')).toBe(false);
  });

  it('Disc: Inner Focus and Penance go out together, on the tank', () => {
    const disc = casts('priest_disc', 'tank');
    const focus = disc.find((e) => e.abilityId === 'inner_focus')!;
    const penance = disc.find((e) => e.abilityId === 'penance' && e.timestamp === focus.timestamp);
    expect(penance).toBeDefined();
    expect(penance!.targetId).toBe(disc.find((e) => e.abilityId === 'renew')!.targetId);
    const raid = new Set(casts('priest_disc', 'raid').map((e) => e.abilityId));
    expect(raid.has('prayer_of_healing')).toBe(true);
    expect(raid.has('flash_heal') || raid.has('renew')).toBe(false);
  });
});

