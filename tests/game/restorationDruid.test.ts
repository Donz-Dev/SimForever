import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { Combatant as CombatantClass, Simulation, castAbility, seconds } from '../../src/engine';
import {
  HEALING_TOUCH,
  HEALING_TOUCH_HEAL,
  INNERVATE,
  NATURES_SWIFTNESS_ABILITY,
  REGROWTH,
  REGROWTH_HEAL,
  REJUVENATION,
  SWIFTMEND,
  WILD_GROWTH,
} from '../../src/game/abilities/druid';
import {
  INNERVATE_REGEN_MULTIPLIER,
  REGROWTH_TICK,
  REJUVENATION_TICK,
  WILD_GROWTH_TICKS,
  WILD_GROWTH_TOTAL,
  wildGrowthFalloff,
} from '../../src/game/auras/druid';
import {
  HEALING_TOUCH_HEAL_COEFFICIENT,
  REGROWTH_HEAL_COEFFICIENT,
  REGROWTH_TICK_HEAL_COEFFICIENT,
  REJUVENATION_TICK_HEAL_COEFFICIENT,
  WILD_GROWTH_TICK_HEAL_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { CLEARCASTING } from '../../src/game/auras/druid';
import { omenOfClarityHealReaction, omenOfClarityReaction } from '../../src/game/reactions/druid';
import { DRUID_RESTORATION } from '../../src/game/rotations/druid';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { healerEncounter } from '../../src/simulator/healerEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 71: the Restoration Druid ("Resto Drood"). Each block pins a mechanism:
 * the owner's coefficients and falloff, the capture's ranks, the talents the
 * build takes, and where the list sends each spell in each healer fight.
 * ==============================================================================
 */

/** A raid member in a party, at a given share of its health. */
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

/** A Druid with no talents, no crit, and a stated healing power. */
function druid(healingPower = 0, abilities = [HEALING_TOUCH, REJUVENATION, REGROWTH, WILD_GROWTH, SWIFTMEND]) {
  return makeAttacker({
    id: 'druid',
    autoAttack: 'none',
    abilities,
    resources: [{ type: 'mana', maximum: 100_000 }],
    stats: { spellCritChance: -100, healingPower },
  });
}

function heals(events: readonly TelemetryEvent[]) {
  return events.filter((event): event is Extract<TelemetryEvent, { type: 'heal' }> => event.type === 'heal');
}

/** Cast one ability at a target and return every heal for the next `forSeconds`. */
function castAndWatch(caster: Combatant, abilityId: string, targets: Combatant[], target: Combatant, forSeconds = 30) {
  const events: TelemetryEvent[] = [];
  const simulation = buildSimulation([caster, ...targets], { durationMs: seconds(120) }, { emit: (e) => events.push(e) });
  simulation.begin();
  castAbility(simulation, caster, caster.abilities.get(abilityId)!, target);
  simulation.advanceTo(seconds(forSeconds));
  return { events: heals(events), simulation };
}

const raw = (event: { amount: number; overhealing: number }) => event.amount + event.overhealing;

describe("the owner's coefficients and the capture's ranks", () => {
  it('gives HT 100%, Regrowth 28.6% and 7.1% a tick, Rejuvenation 20% a tick, Wild Growth 3.3% a tick', () => {
    expect(HEALING_TOUCH_HEAL_COEFFICIENT).toBe(1);
    expect(REGROWTH_HEAL_COEFFICIENT).toBe(0.286);
    expect(REGROWTH_TICK_HEAL_COEFFICIENT).toBe(0.071);
    expect(REJUVENATION_TICK_HEAL_COEFFICIENT).toBe(0.2);
    expect(WILD_GROWTH_TICK_HEAL_COEFFICIENT).toBe(0.033);
  });

  it('uses rank 11 HT, rank 11 Rejuvenation, rank 9 Regrowth and rank 3 Wild Growth', () => {
    expect([HEALING_TOUCH.cost?.amount, HEALING_TOUCH.castTimeMs]).toEqual([840, 3500]);
    expect(HEALING_TOUCH_HEAL).toBe((2139 + 2525) / 2);
    expect([REJUVENATION.cost?.amount, REJUVENATION.castTimeMs]).toEqual([360, undefined]);
    expect(REJUVENATION_TICK).toBe(776 / 4);
    expect([REGROWTH.cost?.amount, REGROWTH.castTimeMs]).toEqual([525, 2000]);
    expect(REGROWTH_HEAL).toBe((965 + 1077) / 2);
    expect(REGROWTH_TICK).toBeCloseTo(994 / 7, 10);
    expect([WILD_GROWTH.cost?.amount, WILD_GROWTH.cooldownMs]).toEqual([1050, 6000]);
    expect(WILD_GROWTH_TOTAL).toBe(679);
    expect(SWIFTMEND.cooldownMs).toBe(15_000);
    expect(INNERVATE.cooldownMs).toBe(360_000);
  });
});

describe('the heals, untalented', () => {
  it('Healing Touch heals its base plus all of healing power', () => {
    const t0 = member('t', 1, 0.1);
    const zero = castAndWatch(druid(0), 'healing_touch', [t0], t0, 5).events[0]!;
    const t1 = member('t', 1, 0.1);
    const thousand = castAndWatch(druid(1000), 'healing_touch', [t1], t1, 5).events[0]!;
    expect(raw(zero)).toBeCloseTo(HEALING_TOUCH_HEAL, 6);
    expect(raw(thousand) - raw(zero)).toBeCloseTo(1000, 6);
  });

  it('Rejuvenation ticks four times, every three seconds, at 194 plus 20% of healing power', () => {
    const t = member('t', 1, 0.1);
    const { events } = castAndWatch(druid(1000), 'rejuvenation', [t], t);
    const ticks = events.filter((e) => e.abilityId === 'rejuvenation' && e.periodic);
    expect(ticks.map((e) => e.timestamp)).toEqual([3000, 6000, 9000, 12_000]);
    for (const tick of ticks) expect(raw(tick)).toBeCloseTo(REJUVENATION_TICK + 0.2 * 1000, 6);
  });

  it('Regrowth heals on the hit and then seven times over 21 seconds', () => {
    const t = member('t', 1, 0.1);
    const { events } = castAndWatch(druid(1000), 'regrowth', [t], t);
    const direct = events.filter((e) => e.abilityId === 'regrowth' && !e.periodic);
    const ticks = events.filter((e) => e.abilityId === 'regrowth' && e.periodic);
    expect(direct).toHaveLength(1);
    expect(raw(direct[0]!)).toBeCloseTo(REGROWTH_HEAL + 0.286 * 1000, 6);
    expect(ticks).toHaveLength(7);
    for (const tick of ticks) expect(raw(tick)).toBeCloseTo(REGROWTH_TICK + 0.071 * 1000, 6);
  });

  it('Wild Growth heals the whole party, seven ticks falling off 1.06, 1.04 ... 0.94', () => {
    const party = [member('a', 1, 0.1), member('b', 1, 0.1), member('c', 1, 0.1), member('d', 2, 0.1)];
    const { events } = castAndWatch(druid(1000), 'wild_growth', party, party[0]!);
    const byTarget = (id: string) => events.filter((e) => e.abilityId === 'wild_growth' && e.targetId === id);
    for (const id of ['a', 'b', 'c']) {
      const ticks = byTarget(id);
      expect(ticks).toHaveLength(WILD_GROWTH_TICKS);
      ticks.forEach((tick, index) => {
        const expected = (WILD_GROWTH_TOTAL / 7 + 0.033 * 1000) * wildGrowthFalloff(index);
        expect(raw(tick), `${id} tick ${index}`).toBeCloseTo(expected, 6);
      });
    }
    // Not the other party.
    expect(byTarget('d')).toHaveLength(0);
    // The falloff moves healing earlier and keeps the total.
    expect([0, 1, 2, 3, 4, 5, 6].map(wildGrowthFalloff).reduce((a, b) => a + b, 0)).toBeCloseTo(7, 10);
    expect(wildGrowthFalloff(0)).toBeCloseTo(1.06, 10);
    expect(wildGrowthFalloff(6)).toBeCloseTo(0.94, 10);
  });

  it('Wild Growth on a target with no party heals that target alone', () => {
    const tank = member('tank', undefined, 0.1);
    const { events } = castAndWatch(druid(0), 'wild_growth', [tank, member('x', 1, 0.1)], tank);
    expect(new Set(events.map((e) => e.targetId))).toEqual(new Set(['tank']));
  });

  it('every heal over time can crit', () => {
    const caster = makeAttacker({
      id: 'druid',
      autoAttack: 'none',
      abilities: [REJUVENATION, WILD_GROWTH],
      resources: [{ type: 'mana', maximum: 100_000 }],
      stats: { spellCritChance: 100, healingPower: 0 },
    });
    const t = member('t', 1, 0.01);
    const { events } = castAndWatch(caster, 'rejuvenation', [t], t);
    expect(events.filter((e) => e.periodic).every((e) => e.critical)).toBe(true);
  });
});

describe('Swiftmend', () => {
  it('is refused without a Rejuvenation or Regrowth of yours on the target', () => {
    const caster = druid();
    const t = member('t', 1, 0.1);
    const simulation = buildSimulation([caster, t]);
    simulation.begin();
    expect(simulation.castRejection(caster, caster.abilities.get('swiftmend')!, t)).toBeDefined();
  });

  it("heals Rejuvenation's whole effect at once, and leaves the Rejuvenation in place", () => {
    const caster = druid(1000);
    const t = member('t', 1, 0.1);
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster, t], { durationMs: seconds(60) }, { emit: (e) => events.push(e) });
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('rejuvenation')!, t);
    simulation.advanceTo(seconds(2));
    castAbility(simulation, caster, caster.abilities.get('swiftmend')!, t);
    const swift = heals(events).filter((e) => e.abilityId === 'swiftmend');
    expect(swift).toHaveLength(1);
    expect(raw(swift[0]!)).toBeCloseTo(4 * (REJUVENATION_TICK + 0.2 * 1000), 6);
    expect(t.auras.has('rejuvenation')).toBe(true);
  });

  /*
   * A 50/50 WHEN BOTH ARE UP (round 72), the owner's. Each side is forced
   * through `rollChance`, so the test is decided by one cast rather than a
   * sample -- and with only one of them up no roll is drawn at all.
   */
  function swiftmendWith(rolls: boolean | undefined, which: readonly ('rejuvenation' | 'regrowth')[]) {
    const caster = druid(0, [REJUVENATION, REGROWTH, SWIFTMEND]);
    const t = member('t', 1, 0.1);
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster, t], { durationMs: seconds(60) }, { emit: (e) => events.push(e) });
    simulation.begin();
    for (const id of which) {
      castAbility(simulation, caster, caster.abilities.get(id)!, t);
      simulation.advanceTo(simulation.clock.now() + seconds(2.5));
    }
    let drawn = 0;
    const real = simulation.rng;
    (simulation as { rng: typeof real }).rng = {
      ...real,
      next: () => real.next(),
      nextInt: (a: number, b: number) => real.nextInt(a, b),
      nextFloat: (a: number, b: number) => real.nextFloat(a, b),
      nextDuration: (a: number, b: number) => real.nextDuration(a, b),
      pick: <T,>(items: readonly T[]) => real.pick(items),
      rollChance: (chance: number) => {
        if (chance === 0.5) drawn += 1;
        return chance === 0.5 ? (rolls ?? true) : real.rollChance(chance);
      },
    };
    castAbility(simulation, caster, caster.abilities.get('swiftmend')!, t);
    const amount = raw(heals(events).find((e) => e.abilityId === 'swiftmend')!);
    return { amount, drawn };
  }

  it('flips a coin between Rejuvenation and Regrowth when both are up', () => {
    const rejuvenationWhole = 4 * REJUVENATION_TICK;
    const regrowthWhole = 7 * REGROWTH_TICK;
    const heads = swiftmendWith(true, ['rejuvenation', 'regrowth']);
    const tails = swiftmendWith(false, ['rejuvenation', 'regrowth']);
    expect(heads.amount).toBeCloseTo(rejuvenationWhole, 6);
    expect(tails.amount).toBeCloseTo(regrowthWhole, 6);
    expect([heads.drawn, tails.drawn]).toEqual([1, 1]);
  });

  it('uses the one that is up, with no roll, when only one is', () => {
    const onlyRejuvenation = swiftmendWith(undefined, ['rejuvenation']);
    const onlyRegrowth = swiftmendWith(undefined, ['regrowth']);
    expect(onlyRejuvenation.amount).toBeCloseTo(4 * REJUVENATION_TICK, 6);
    expect(onlyRegrowth.amount).toBeCloseTo(7 * REGROWTH_TICK, 6);
    expect([onlyRejuvenation.drawn, onlyRegrowth.drawn]).toEqual([0, 0]);
  });
});

describe('Omen of Clarity on a healing spell', () => {
  /*
   * ROUND 72, the owner's: "Make Omen of Clarity have a chance to proc on
   * healing spell cast." At a 100% chance here, so each case is one cast.
   */
  function healer() {
    return makeAttacker({
      id: 'druid',
      autoAttack: 'none',
      abilities: [HEALING_TOUCH, REJUVENATION, INNERVATE],
      resources: [{ type: 'mana', maximum: 100_000 }],
      stats: { spellCritChance: -100, healingPower: 0 },
      castReactions: [omenOfClarityHealReaction(100)],
      reactions: [omenOfClarityReaction(100)],
    });
  }

  it('procs Clearcasting off a heal cast, which deals no damage', () => {
    const caster = healer();
    const t = member('t', 1, 0.1);
    const simulation = buildSimulation([caster, t]);
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('rejuvenation')!, t);
    expect(caster.auras.has(CLEARCASTING.id)).toBe(true);
  });

  it('is spent by a heal, which then costs nothing, and not by Innervate', () => {
    const caster = healer();
    const t = member('t', 1, 0.1);
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([caster, t], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    simulation.applyAura(caster, CLEARCASTING, caster.id);
    castAbility(simulation, caster, caster.abilities.get('innervate')!, undefined);
    expect(caster.auras.has(CLEARCASTING.id)).toBe(true);
    simulation.advanceTo(seconds(2));
    events.length = 0;
    castAbility(simulation, caster, caster.abilities.get('healing_touch')!, t);
    const spent = events.filter((e) => e.type === 'resource_spent' && e.resource === 'mana');
    expect(spent.reduce((sum, e) => sum + (e as { amount: number }).amount, 0)).toBe(0);
  });

  it('shares one ten-second internal cooldown between the heal half and the damage half', () => {
    const caster = healer();
    const t = member('t', 1, 0.1);
    const simulation = buildSimulation([caster, t], { durationMs: seconds(60) });
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('rejuvenation')!, t);
    expect(caster.auras.has(CLEARCASTING.id)).toBe(true);
    caster.auras.remove(simulation, CLEARCASTING.id);
    simulation.advanceTo(seconds(3));
    // Inside the window: a second heal does not proc it again.
    castAbility(simulation, caster, caster.abilities.get('rejuvenation')!, member('u', 1, 0.1));
    expect(caster.auras.has(CLEARCASTING.id)).toBe(false);
    // Nor does the damage half, whose window is the same one.
    const reaction = omenOfClarityReaction(100);
    expect(reaction.canTrigger!(simulation, caster, {} as never)).toBe(false);
    simulation.advanceTo(seconds(11));
    expect(reaction.canTrigger!(simulation, caster, {} as never)).toBe(true);
  });

  it('is on every Druid, built with the character', () => {
    const profile = PRESETS_BY_ID.get('druid_resto')!.build();
    const player = createPlayer({ ...profile.character, talents: profile.talents });
    expect(player.castReactions.map((r) => r.id)).toContain('omen_of_clarity_heal');
    expect(player.reactions.map((r) => r.id)).toContain('omen_of_clarity');
  });
});

describe('Innervate and Nature\'s Swiftness', () => {
  it('Innervate multiplies mana regeneration by five and lets all of it continue while casting', () => {
    expect(INNERVATE_REGEN_MULTIPLIER).toBe(5);
    const caster = druid(0, [INNERVATE]);
    const simulation = buildSimulation([caster]);
    simulation.begin();
    castAbility(simulation, caster, caster.abilities.get('innervate')!, undefined);
    const aura = caster.auras.get('innervate')!;
    expect(aura.definition.resourceRegenMultiplier).toEqual({ mana: 5 });
    expect(caster.stats.get('manaRegenBypass')).toBeGreaterThanOrEqual(100);
  });

  it("makes the next Healing Touch or Regrowth instant, once", () => {
    for (const spell of ['healing_touch', 'regrowth']) {
      const caster = druid(0, [HEALING_TOUCH, REGROWTH, NATURES_SWIFTNESS_ABILITY]);
      const t = member('t', 1, 0.1);
      const simulation = buildSimulation([caster, t]);
      simulation.begin();
      castAbility(simulation, caster, caster.abilities.get('natures_swiftness')!, undefined);
      castAbility(simulation, caster, caster.abilities.get(spell)!, t);
      expect(caster.castEndsAt, spell).toBe(0);
      expect(caster.auras.has('natures_swiftness'), spell).toBe(false);
    }
  });
});

describe("the owner's talents, on the built character", () => {
  const profile = PRESETS_BY_ID.get('druid_resto')!.build();
  const player = createPlayer({ ...profile.character, talents: profile.talents });

  it('takes the 11/0/40 from the owner\'s URL', () => {
    const total = Object.values(profile.talents).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(51);
    expect(profile.talents.wild_growth).toBe(1);
    expect(profile.talents.swiftmend).toBe(1);
    expect(profile.talents.nature_s_swiftness).toBe(1);
  });

  it('knows its spells, and the two talent-granted ones', () => {
    for (const id of ['healing_touch', 'rejuvenation', 'regrowth', 'innervate', 'wild_growth', 'swiftmend', 'natures_swiftness']) {
      expect(player.abilities.has(id), id).toBe(true);
    }
  });

  it("Nature's Splendor: Rejuvenation +3 seconds and Regrowth +6", () => {
    expect(player.abilities.get('rejuvenation')!.bonuses?.auraDurationBonusSeconds).toBe(3);
    expect(player.abilities.get('regrowth')!.bonuses?.auraDurationBonusSeconds).toBe(6);
  });

  it('Gift of Nature +10% on every heal, Improved Rejuvenation +15% on Rejuvenation, Genesis +10% on the ticks', () => {
    expect(player.abilityModifierFor('healing_touch')?.healingMultiplier).toBeCloseTo(1.1, 10);
    expect(player.abilityModifierFor('wild_growth')?.healingMultiplier).toBeCloseTo(1.1, 10);
    expect(player.abilityModifierFor('rejuvenation')?.healingMultiplier).toBeCloseTo(1.1 * 1.15, 10);
    // Genesis is 2% a rank since client build 1.60.1.70707, where it was 1%.
    expect(player.periodicHealingMultiplier).toBeCloseTo(1.1, 10);
    // Swiftmend takes the heal over time's modifiers instead, so carries none.
    expect(player.abilityModifierFor('swiftmend')?.healingMultiplier ?? 1).toBe(1);
  });

  it('Improved Regrowth +50% crit; Naturalist 0.5s off Healing Touch and Wild Growth; no shortened global cooldown', () => {
    expect(player.abilityModifierFor('regrowth')?.critBonus).toBe(50);
    const ht = player.abilities.get('healing_touch')!;
    expect(ht.castTimeMs).toBe(3000);
    // Wild Growth is a 3 second cast at client build 1.60.1.70707, and
    // Naturalist 5/5 takes the same half second off it.
    expect(player.abilities.get('wild_growth')!.castTimeMs).toBe(2500);
    // Gift of the Earthmother took these three to a one second global cooldown
    // and left the tree at client build 1.60.1.70707.
    for (const id of ['rejuvenation', 'swiftmend', 'wild_growth', 'regrowth']) {
      expect(player.abilities.get(id)!.gcdMs ?? 1500, id).toBe(1500);
    }
  });

  it('Tranquil Spirit 4/5: Healing Touch costs 8% less', () => {
    // A fresh character with its own list taken away, so only this cast spends.
    const solo = createPlayer({ ...profile.character, talents: profile.talents });
    (solo as { rotation?: unknown }).rotation = undefined;
    const t = member('t', 1, 0.1);
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([solo, t], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    castAbility(simulation, solo, solo.abilities.get('healing_touch')!, t);
    simulation.advanceTo(seconds(4));
    const spent = events.filter((e) => e.type === 'resource_spent' && e.resource === 'mana');
    expect(spent).toHaveLength(1);
    expect((spent[0] as { amount: number }).amount).toBeCloseTo(840 * 0.92, 6);
  });
});

describe('the list, in both healer fights', () => {
  function casts(fight: 'tank' | 'raid') {
    const profile = PRESETS_BY_ID.get('druid_resto')!.build();
    const events: TelemetryEvent[] = [];
    const simulation = new Simulation(healerEncounter(profile, fight, 4242), { emit: (e) => events.push(e) });
    simulation.run();
    return events.filter((e): e is Extract<TelemetryEvent, { type: 'cast' }> => e.type === 'cast');
  }

  it('is the stock list a Wild Growth build runs', () => {
    expect(PRESETS_BY_ID.get('druid_resto')!.build().rotation.name).toBe(DRUID_RESTORATION.name);
  });

  it('keeps Rejuvenation and Regrowth on the tank, and casts no Wild Growth, in the tank fight', () => {
    const tank = casts('tank');
    const ids = new Set(tank.map((e) => e.abilityId));
    expect(ids.has('rejuvenation')).toBe(true);
    expect(ids.has('regrowth')).toBe(true);
    expect(ids.has('healing_touch')).toBe(true);
    expect(ids.has('wild_growth')).toBe(false);
  });

  it('casts Wild Growth and spreads Rejuvenation across the raid in the raid fight', () => {
    const raid = casts('raid');
    expect(raid.filter((e) => e.abilityId === 'wild_growth').length).toBeGreaterThan(2);
    const rejuvTargets = new Set(raid.filter((e) => e.abilityId === 'rejuvenation').map((e) => e.targetId));
    expect(rejuvTargets.size).toBeGreaterThan(3);
  });
});
