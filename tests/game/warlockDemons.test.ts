import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { NO_CHANCES, Simulation, dealDamage, resolveCast, seconds } from '../../src/engine';
import { createDemon } from '../../src/game/actors/createDemon';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { sacrificedDemon } from '../../src/game/rotations/warlock';
import { bringsPet } from '../../src/game/character/petFamilies';
import {
  IMP_FIREBOLT_CAST_MS,
  IMP_FIREBOLT_PAUSE_MS,
  LASH_OF_PAIN_COOLDOWN_MS,
} from '../../src/game/abilities/demon';
import { DEMONIC_BRAND_DAMAGE_MAX, DEMONIC_BRAND_DAMAGE_MIN } from '../../src/game/auras/warlock';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { parseProfile, serializeProfile } from '../../src/profiles';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * THE WARLOCK'S DEMONS, AND EVERY DEMONOLOGY TALENT THE OWNER NAMED.
 *
 * Asserted on the MECHANISM -- the multiplier on damage that lands, the charge
 * that is spent, the cast time resolved -- because a talent working and a
 * talent mattering are different questions, and a DPS figure answers neither.
 * ==============================================================================
 */

const LEVEL = 60;
type Demon = 'imp' | 'succubus';

/*
 * ISOLATED AGAINST ITS OWN ALLOCATION, because `legalise` pads a deep talent's
 * tiers with filler and the filler lands in Improved Imp and Unholy Power --
 * which multiply a demon's damage. The first draft compared against an empty
 * tree and read Soul Link as 1.4729: 1.03 x 1.1 x 1.3. So every ratio here is
 * the legal allocation WITH the talent over the same allocation WITHOUT it.
 */
const legal = (talents: Record<string, number>) => legalise(talents, 'warlock');
const without = (allocation: Record<string, number>, talentId: string) => {
  const copy = { ...allocation };
  delete copy[talentId];
  return copy;
};

/** The demon's pet modifiers for an allocation taken as given. */
const petModifiers = (allocation: Record<string, number>, demon: Demon) =>
  talentBuild('warlock', allocation, { hasPet: true, summonedDemon: demon, level: LEVEL }).pet;

/** One hit of `abilityId` from a demon, on a table that always hits and never crits. */
function demonHit(
  demon: Demon,
  allocation: Record<string, number>,
  abilityId: string,
  school: 'fire' | 'shadow',
): number {
  const owner = makeAttacker({ stats: { spellPower: 0 } });
  const pet = createDemon({ owner, demon, talents: petModifiers(allocation, demon) });
  const target = makeTarget();
  const simulation = buildSimulation([owner, pet, target], { attackChances: () => NO_CHANCES });
  simulation.begin();
  return dealDamage(simulation, {
    source: pet,
    target,
    abilityId,
    abilityName: abilityId,
    school,
    baseAmount: 100,
    attackTable: 'spell',
  }).amount;
}

/** What `talentId` alone does to one demon hit. */
const ratioOf = (
  talentId: string,
  talents: Record<string, number>,
  demon: Demon,
  abilityId: string,
  school: 'fire' | 'shadow',
) => {
  const full = legal(talents);
  return (
    demonHit(demon, full, abilityId, school) /
    demonHit(demon, without(full, talentId), abilityId, school)
  );
};

const warlock = (talents: Record<string, number>, summonedDemon?: Demon) =>
  createPlayer({
    race: 'undead',
    characterClass: 'warlock',
    talents: legalise(talents, 'warlock'),
    ...(summonedDemon ? { summonedDemon } : {}),
  });

describe('a Warlock brings a pet exactly when a demon is summoned', () => {
  it('answers from the summoned demon, not the talents', () => {
    expect(bringsPet('warlock', {})).toBe(false);
    expect(bringsPet('warlock', {}, 'imp')).toBe(true);
    expect(bringsPet('warlock', {}, 'succubus')).toBe(true);
    // The sacrifice-only demons cannot be out.
    expect(bringsPet('warlock', {}, 'voidwalker')).toBe(false);
  });
});

describe('the owner multipliers, one talent at a time', () => {
  it('Unholy Power 5/5 is 1.1x on everything a demon deals', () => {
    expect(ratioOf('unholy_power', { unholy_power: 5 }, 'imp', 'imp_firebolt', 'fire')).toBeCloseTo(1.1, 10);
    expect(ratioOf('unholy_power', { unholy_power: 5 }, 'succubus', 'lash_of_pain', 'shadow'))
      .toBeCloseTo(1.1, 10);
  });

  it('Improved Imp 3/3 is 1.3x on Firebolt and nothing else', () => {
    expect(ratioOf('improved_imp', { improved_imp: 3 }, 'imp', 'imp_firebolt', 'fire')).toBeCloseTo(1.3, 10);
    expect(ratioOf('improved_imp', { improved_imp: 3 }, 'imp', 'something_else', 'fire')).toBeCloseTo(1, 10);
  });

  it('Improved Sayaad 3/3 is 1.3x on Lash of Pain and nothing else', () => {
    expect(ratioOf('improved_sayaad', { improved_sayaad: 3 }, 'succubus', 'lash_of_pain', 'shadow'))
      .toBeCloseTo(1.3, 10);
    expect(ratioOf('improved_sayaad', { improved_sayaad: 3 }, 'succubus', 'something_else', 'shadow'))
      .toBeCloseTo(1, 10);
  });

  it('Soul Link is 1.03x on the demon AND on the Warlock, and only with a demon out', () => {
    const talents = { demonic_sacrifice: 1, soul_link: 1 };
    expect(ratioOf('soul_link', talents, 'imp', 'imp_firebolt', 'fire')).toBeCloseTo(1.03, 10);

    const full = legal(talents);
    const warlockMultiplier = (allocation: Record<string, number>, summoned?: Demon) =>
      talentBuild('warlock', allocation, {
        hasPet: summoned !== undefined,
        summonedDemon: summoned,
      }).damageMultiplier;
    expect(warlockMultiplier(full, 'imp') / warlockMultiplier(without(full, 'soul_link'), 'imp'))
      .toBeCloseTo(1.03, 10);
    expect(warlockMultiplier(full) / warlockMultiplier(without(full, 'soul_link'))).toBeCloseTo(1, 10);
  });

  it('Unholy Power and Soul Link are different talents and MULTIPLY', () => {
    // The padding for Soul Link already includes Unholy Power 5/5.
    const full = legal({ demonic_sacrifice: 1, soul_link: 1 });
    expect(full.unholy_power).toBe(5);
    const both = petModifiers(full, 'imp').damageMultiplier;
    const neither = petModifiers(without(without(full, 'soul_link'), 'unholy_power'), 'imp').damageMultiplier;
    expect(both / neither).toBeCloseTo(1.1 * 1.03, 10);
  });

  it('Demonic Knowledge 3/3 is +60 spell power on the Warlock and the demon, with a demon out', () => {
    const talents = { demonic_knowledge: 3 };
    const withoutDemon = warlock(talents).stats.effective.spellPower;
    const withImp = warlock(talents, 'imp').stats.effective.spellPower;
    expect(withImp - withoutDemon).toBeCloseTo(60, 10);
    expect(petModifiers(legal(talents), 'imp').spellPower).toBeCloseTo(60, 10);

    const owner = makeAttacker({ stats: { spellPower: 500 } });
    const demon = createDemon({ owner, demon: 'imp', talents: petModifiers(legal(talents), 'imp') });
    // 10% of the owner's spell power, plus the talent's 60.
    expect(demon.stats.effective.spellPower).toBeCloseTo(50 + 60, 10);
  });

  it('Master Demonologist 5/5 is +10% Fire with the Imp and +10% Shadow with the Succubus, on both', () => {
    const full = legal({ master_demonologist: 5 });
    const school = (allocation: Record<string, number>, summoned: Demon | undefined, s: 'fire' | 'shadow') =>
      talentBuild('warlock', allocation, {
        hasPet: summoned !== undefined,
        summonedDemon: summoned,
      }).schoolModifiers.for(s).damageMultiplier ?? 1;
    const lift = (summoned: Demon | undefined, s: 'fire' | 'shadow') =>
      school(full, summoned, s) / school(without(full, 'master_demonologist'), summoned, s);
    expect(lift('imp', 'fire')).toBeCloseTo(1.1, 10);
    expect(lift('imp', 'shadow')).toBeCloseTo(1, 10);
    expect(lift('succubus', 'shadow')).toBeCloseTo(1.1, 10);
    expect(lift('succubus', 'fire')).toBeCloseTo(1, 10);
    expect(lift(undefined, 'fire')).toBeCloseTo(1, 10);

    expect(ratioOf('master_demonologist', { master_demonologist: 5 }, 'imp', 'imp_firebolt', 'fire'))
      .toBeCloseTo(1.1, 10);
    expect(ratioOf('master_demonologist', { master_demonologist: 5 }, 'succubus', 'lash_of_pain', 'shadow'))
      .toBeCloseTo(1.1, 10);
  });
});

describe('Demonic Sacrifice and Demonic Pact', () => {
  const DS = { demonic_sacrifice: 1 };
  const PACT = { demonic_sacrifice: 1, soul_link: 1, demonic_pact: 1 };

  it('keeps the sacrifice with no demon out', () => {
    expect(sacrificedDemon(DS, 'succubus', undefined)).toBe('succubus');
  });

  it('cancels it when any demon is summoned without the Pact', () => {
    expect(sacrificedDemon(DS, 'succubus', 'imp')).toBeUndefined();
    expect(sacrificedDemon(DS, 'succubus', 'succubus')).toBeUndefined();
  });

  it('keeps it with the Pact while a DIFFERENT demon is out -- the owner strategy', () => {
    expect(sacrificedDemon(PACT, 'succubus', 'imp')).toBe('succubus');
    expect(sacrificedDemon(PACT, 'imp', 'succubus')).toBe('imp');
  });

  it('still cancels it with the Pact when the sacrificed demon is resummoned', () => {
    expect(sacrificedDemon(PACT, 'imp', 'imp')).toBeUndefined();
  });

  it('gives a Fire Warlock both passives in a fight: +15% Fire from the sacrifice, +10% Fire from the Imp', () => {
    const base = PRESETS_BY_ID.get('warlock_firelock')!.build();
    const profile = {
      ...base,
      character: { ...base.character, petFamily: 'succubus', summonedDemon: 'imp' },
      talents: { ...base.talents, soul_link: 1, demonic_pact: 1, master_demonologist: 5 },
    };
    const simulation = new Simulation(trainingDummyEncounter(profile as never, 1));
    simulation.begin();
    const player = simulation.combatants.find((a) => a.kind === 'player')!;
    expect(player.auras.has('demonic_sacrifice_succubus')).toBe(true);
    expect(simulation.combatants.some((a) => a.kind === 'pet' && a.name === 'Imp')).toBe(true);
  });
});

describe('Demonic Brand', () => {
  function brandFight(demon: Demon, rank: number) {
    const owner = createPlayer({
      race: 'undead',
      characterClass: 'warlock',
      talents: legalise({ demonic_brand: rank }, 'warlock'),
      summonedDemon: demon,
    });
    const pet = createDemon({
      owner,
      demon,
      talents: petModifiers(legal({ demonic_brand: rank }), demon),
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation(
      [owner, pet, target],
      { attackChances: () => NO_CHANCES },
      { emit: (event) => events.push(event) },
    );
    simulation.begin();
    // Unholy Power is in the brand's padding and is "all damage done by your
    // pets", so it reaches the brand strike too -- the range is scaled by it.
    const scale = petModifiers(legal({ demonic_brand: rank }), demon).damageMultiplier;
    return { owner, pet, target, simulation, events, scale };
  }

  const strikes = (events: readonly TelemetryEvent[]) =>
    events.filter(
      (e) => e.type === 'damage' && (e as { abilityId?: string }).abilityId === 'demonic_brand_strike',
    ) as (TelemetryEvent & { amount: number; school: string })[];

  it('brands on a landed Searing Pain with 2/4/6 charges, and the demon spends one per attack', () => {
    for (const [rank, charges] of [[1, 2], [2, 4], [3, 6]] as const) {
      const { owner, pet, target, simulation, events } = brandFight('imp', rank);
      dealDamage(simulation, {
        source: owner, target, abilityId: 'searing_pain', abilityName: 'Searing Pain',
        school: 'fire', baseAmount: 100, attackTable: 'spell',
      });
      expect(target.auras.stacksOf('demonic_brand'), `rank ${rank}`).toBe(charges);
      for (let i = 0; i < charges + 3; i += 1) {
        dealDamage(simulation, {
          source: pet, target, abilityId: 'imp_firebolt', abilityName: 'Firebolt (Imp)',
          school: 'fire', baseAmount: 100, attackTable: 'spell',
        });
      }
      expect(strikes(events), `rank ${rank}`).toHaveLength(charges);
      expect(target.auras.has('demonic_brand')).toBe(false);
    }
  });

  it('adds 65 to 68 FIRE from the Imp and SHADOW from the Succubus', () => {
    for (const [demon, school] of [['imp', 'fire'], ['succubus', 'shadow']] as const) {
      const { owner, pet, target, simulation, events, scale } = brandFight(demon, 3);
      dealDamage(simulation, {
        source: owner, target, abilityId: 'searing_pain', abilityName: 'Searing Pain',
        school: 'fire', baseAmount: 100, attackTable: 'spell',
      });
      dealDamage(simulation, {
        source: pet, target, abilityId: 'x', abilityName: 'x',
        school, baseAmount: 100, attackTable: 'spell',
      });
      const [strike] = strikes(events);
      expect(strike.school).toBe(school);
      expect(strike.amount / scale).toBeGreaterThanOrEqual(DEMONIC_BRAND_DAMAGE_MIN);
      expect(strike.amount / scale).toBeLessThanOrEqual(DEMONIC_BRAND_DAMAGE_MAX);
    }
  });

  it('does nothing without a Searing Pain', () => {
    const { pet, target, simulation, events } = brandFight('imp', 3);
    dealDamage(simulation, {
      source: pet, target, abilityId: 'imp_firebolt', abilityName: 'Firebolt (Imp)',
      school: 'fire', baseAmount: 100, attackTable: 'spell',
    });
    expect(strikes(events)).toHaveLength(0);
  });
});

describe('Decimation', () => {
  const ready = (player: Combatant) => {
    const simulation = buildSimulation([player, makeTarget()]);
    simulation.begin();
    return simulation;
  };

  it('takes Soul Fire to a 6 second cooldown', () => {
    const player = warlock({ decimation: 2 });
    expect(player.abilities.get('soul_fire')!.cooldownMs).toBe(seconds(6));
  });

  it('makes Soul Fire a 2.4 second cast with Bane 5/5, and shard-free', () => {
    const player = warlock({ decimation: 2, bane: 5 });
    ready(player);
    const cast = resolveCast(player, player.abilities.get('soul_fire')!);
    expect(cast.baseCastTimeMs).toBe(2400);
    expect(cast.costAmount).toBe(0);
  });

  it('is 40% off the cast time without Bane too', () => {
    const player = warlock({ decimation: 2 });
    ready(player);
    expect(resolveCast(player, player.abilities.get('soul_fire')!).baseCastTimeMs).toBe(3600);
  });

  it('raises Shadow Bolt and Searing Pain 6% in the last 35% of the fight, and not before', () => {
    const player = warlock({ decimation: 2 });
    for (const id of ['shadow_bolt', 'searing_pain']) {
      expect(player.abilityModifierFor(id, 0.34).damageMultiplier ?? 1, id).toBeCloseTo(1.06, 10);
      expect(player.abilityModifierFor(id, 0.36).damageMultiplier ?? 1, id).toBeCloseTo(1, 10);
    }
    expect(player.abilityModifierFor('incinerate', 0.1).damageMultiplier ?? 1).toBeCloseTo(1, 10);
  });
});

describe('the demons in a fight', () => {
  const run = (preset: string, summonedDemon?: Demon) => {
    const base = PRESETS_BY_ID.get(preset)!.build();
    const profile = {
      ...base,
      character: { ...base.character, ...(summonedDemon ? { summonedDemon } : {}) },
    };
    const events: TelemetryEvent[] = [];
    new Simulation(trainingDummyEncounter(profile as never, 3), { emit: (e) => events.push(e) }).run();
    return events;
  };
  const castsOf = (events: readonly TelemetryEvent[], id: string) =>
    events.filter((e) => e.type === 'cast' && (e as { abilityId: string }).abilityId === id);

  it('builds no demon for either preset, which summons none', () => {
    for (const id of ['warlock_smds', 'warlock_firelock']) {
      const simulation = new Simulation(trainingDummyEncounter(PRESETS_BY_ID.get(id)!.build(), 1));
      simulation.begin();
      expect(simulation.combatants.some((a) => a.kind === 'pet'), id).toBe(false);
    }
  });

  it('has the Imp cast Firebolt every 2.4 seconds: a 2 second cast and a 0.4 second pause', () => {
    // Written out by hand as well as from the constants, so a constant that
    // drifts fails here rather than moving the expectation with it.
    expect(IMP_FIREBOLT_CAST_MS + IMP_FIREBOLT_PAUSE_MS).toBe(2400);
    const casts = castsOf(run('warlock_firelock', 'imp'), 'imp_firebolt');
    expect(casts.length).toBeGreaterThan(20);
    const gaps = casts.slice(1).map((c, i) => c.timestamp - casts[i].timestamp);
    expect(Math.min(...gaps)).toBe(2400);
    expect(Math.max(...gaps)).toBe(2400);
  });

  it('has the Succubus swing and Lash of Pain on its 12 second cooldown', () => {
    const events = run('warlock_smds', 'succubus');
    const lashes = castsOf(events, 'lash_of_pain');
    expect(lashes.length).toBeGreaterThanOrEqual(4);
    const gaps = lashes.slice(1).map((c, i) => c.timestamp - lashes[i].timestamp);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(LASH_OF_PAIN_COOLDOWN_MS);
    expect(
      events.some((e) => e.type === 'damage' && (e as { abilityName?: string }).abilityName === 'Succubus Melee'),
    ).toBe(true);
  });

  it('survives a save and a load', () => {
    const base = PRESETS_BY_ID.get('warlock_smds')!.build();
    const profile = { ...base, character: { ...base.character, summonedDemon: 'succubus' } };
    const parsed = parseProfile(serializeProfile(profile as never));
    expect(parsed.ok && parsed.profile.character.summonedDemon).toBe('succubus');
  });
});
