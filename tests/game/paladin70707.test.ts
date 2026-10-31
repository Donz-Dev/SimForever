import { describe, expect, it } from 'vitest';
import type { AttackEvent, TelemetryEvent } from '../../src/engine';
import { applyHealing, dealDamage, seconds } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { HOLY_SHIELD, OATH_OF_LIGHT_DURATION_MS, OATH_OF_LIGHT_HEALING } from '../../src/game/auras/paladin';
import {
  FLASH_OF_LIGHT,
  HOLY_LIGHT,
  HOLY_SHOCK,
  OATH_OF_LIGHT_ABILITY,
} from '../../src/game/abilities/paladin';
import { castAbility } from '../../src/engine';
import { PLACEHOLDER_HOLY_LIGHT_HEAL_COEFFICIENT } from '../../src/game/combat/coefficients';
import { PALADIN_HOLY } from '../../src/game/rotations/paladin';
import { Combatant } from '../../src/engine';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * THE PALADIN AT CLIENT BUILD 1.60.1.70707, MECHANISM BY MECHANISM.
 *
 * Every figure is written out by hand from the tooltip, and every effect is
 * driven through the engine rather than read off its declaration -- a heal is
 * healed, a strike is struck -- because what changed here is mostly WHICH
 * things a talent reaches, and a declaration cannot show that.
 * ==============================================================================
 */

const BASE_HEAL = 1000;

/** One heal of `abilityId`, at a guaranteed crit or none, by a character with this build. */
function heal(talents: Record<string, number>, abilityId: string, crit: boolean): number {
  const build = talentBuild('paladin', legalise(talents, 'paladin'));
  const healer = makeAttacker({
    autoAttack: 'none',
    abilityModifiers: build.abilityModifiers,
    stats: { spellCritChance: crit ? 1000 : -1000, healingPower: 0 },
  });
  const ally = makeAttacker({ id: 'ally', name: 'Ally', maxHealth: 1_000_000 });
  ally.health.set(1);
  const simulation = buildSimulation([healer, ally, makeTarget()]);
  return applyHealing(simulation, {
    source: healer,
    target: ally,
    abilityId,
    abilityName: abilityId,
    baseAmount: BASE_HEAL,
    powerCoefficient: 0,
  }).amount;
}

describe('Holy Power, now a heal crit DAMAGE talent', () => {
  it('takes a Holy heal crit from 1.5x to 1.75x at 5/5, which is the bonus half', () => {
    // "+50%" of the 0.5 above 1, so 1.75 -- not 2.0 and not 2.25. As a RATIO of
    // crit to plain on one build, because the padding that makes the allocation
    // legal carries Healing Light's own +12% on Holy Light.
    const ratio = (talents: Record<string, number>, id: string) =>
      heal(talents, id, true) / heal(talents, id, false);
    expect(ratio({ healing_light: 3 }, 'holy_light')).toBeCloseTo(1.5, 6);
    for (const id of ['holy_light', 'flash_of_light', 'holy_shock', 'lights_vigil']) {
      expect(ratio({ holy_power: 5 }, id), id).toBeCloseTo(1.75, 6);
    }
  });

  it('no longer reaches a damage crit or a crit CHANCE, which it used to', () => {
    const build = talentBuild('paladin', legalise({ holy_power: 5 }, 'paladin'));
    for (const id of ['holy_shock', 'holy_strike']) {
      const modifier = build.abilityModifiers.for(id);
      expect(modifier.critBonus ?? 0, id).toBe(0);
      expect(modifier.critMultiplierBonus ?? 0, id).toBe(0);
    }
  });
});

describe('Boundless Light', () => {
  it("adds 30% crit to Holy Shock's HEAL at 2/2 and nothing to its damage", () => {
    // Every ally lacks an Oath of Light here, because none is ever sworn.
    const build = talentBuild('paladin', legalise({ holy_shock: 1, boundless_light: 2 }, 'paladin'));
    expect(build.abilityModifiers.for('holy_shock').healingCritBonus).toBe(30);
    expect(build.abilityModifiers.for('holy_shock').critBonus ?? 0).toBe(0);
  });
});

describe('Conviction, now spells AND attacks', () => {
  it('grants 6 points of melee crit and 6 of spell crit at 3/3', () => {
    const build = talentBuild('paladin', legalise({ conviction: 3 }, 'paladin'));
    expect(build.stats.critChance).toBe(6);
    expect(build.stats.spellCritChance).toBe(6);
  });
});

describe('Two-Handed Weapon Specialization, now physical damage', () => {
  it('raises PHYSICAL damage by 6% at 3/3 whatever is held, and Holy by nothing', () => {
    const build = talentBuild(
      'paladin',
      legalise({ two_handed_weapon_specialization: 3 }, 'paladin'),
    );
    expect(build.schoolModifiers.for('physical').damageMultiplier).toBeCloseTo(1.06, 10);
    expect(build.schoolModifiers.for('holy').damageMultiplier ?? 1).toBe(1);
  });

  it("cuts threat by 20% only while a two-hander is held -- Instrument of Law's clause", () => {
    const talents = legalise({ two_handed_weapon_specialization: 3 }, 'paladin');
    const twoHander = { name: 'Two-Hander', twoHanded: true, swingTimerMs: seconds(3.5), baseDamage: 100 };
    const oneHander = { name: 'One-Hander', twoHanded: false, swingTimerMs: seconds(2.6), baseDamage: 100 };
    expect(talentBuild('paladin', talents, { mainHand: twoHander as never }).threatModifiers).toEqual([
      { multiplier: 0.8 },
    ]);
    expect(talentBuild('paladin', talents, { mainHand: oneHander as never }).threatModifiers).toEqual([]);
  });
});

describe('Shieldsworn, the Protection capstone', () => {
  it("is taken by the Prot Pally, and Holy Strike's cooldown is four seconds shorter", () => {
    const prot = PRESETS_BY_ID.get('prot_pally')!.build();
    expect(prot.talents.shieldsworn).toBe(1);
    const book = createPlayer({
      race: 'human',
      characterClass: 'paladin',
      combatStyle: prot.character.combatStyle as never,
      talents: prot.talents,
      equipment: prot.equipment,
    });
    expect(book.abilities.get('holy_strike')!.cooldownMs).toBe(seconds(10) - seconds(4));
  });

  it("sets off Holy Shield's damage on a landed Holy Strike without spending a charge", () => {
    const build = talentBuild(
      'paladin',
      legalise({ holy_shield: 1, shieldsworn: 1 }, 'paladin'),
      { hasShield: true },
    );
    const paladin = makeAttacker({
      autoAttack: 'none',
      reactions: build.reactions,
      resources: [{ type: 'mana', maximum: 10_000 }],
    });
    const boss = makeTarget({ maxHealth: 1e9 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([paladin, boss], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    simulation.applyAura(paladin, HOLY_SHIELD, paladin.id);
    const charges = paladin.auras.get('holy_shield')!.stacks;

    dealDamage(simulation, {
      source: paladin,
      target: boss,
      abilityId: 'holy_strike',
      abilityName: 'Holy Strike',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-special',
      weaponSlot: 'mainHand',
    });

    const shield = events.filter(
      (e) => e.type === 'damage' && (e as { abilityId?: string }).abilityId === 'holy_shield',
    );
    expect(shield.length).toBe(1);
    expect(paladin.auras.get('holy_shield')!.stacks).toBe(charges);
  });

  it('does nothing for a Holy Strike without Holy Shield up, or for another ability', () => {
    const build = talentBuild('paladin', legalise({ holy_shield: 1, shieldsworn: 1 }, 'paladin'), {
      hasShield: true,
    });
    const reaction = build.reactions.find((r) => r.id === 'shieldsworn')!;
    const attack = (abilityId: string | undefined): AttackEvent => ({
      attacker: makeAttacker(),
      defender: makeTarget(),
      outcome: 'hit',
      abilityId,
      abilityName: abilityId ?? 'Main Hand',
      amount: 100,
      weaponSlot: 'mainHand',
      critical: false,
    });
    const simulation = buildSimulation([makeAttacker(), makeTarget()]);
    expect(reaction.canTrigger!(simulation, makeAttacker(), attack('holy_strike'))).toBe(true);
    expect(reaction.canTrigger!(simulation, makeAttacker(), attack(undefined))).toBe(false);
    expect(reaction.canTrigger!(simulation, makeAttacker(), attack('judgement'))).toBe(false);
  });
});

describe('the five new talents and the four that left', () => {
  it('declares the new ones and none of the removed', () => {
    for (const id of ['oath_of_light', 'boundless_light', 'stoicism', 'shieldsworn', 'turn_evil', 'unsealed_wrath']) {
      expect(PALADIN_TALENT_EFFECTS[id], id).toBeDefined();
    }
    for (const id of [
      'one_handed_weapon_specialization',
      'improved_seal_of_fury',
      'instrument_of_law',
      'voice_of_truth',
      'twist_of_light',
    ]) {
      expect(PALADIN_TALENT_EFFECTS[id], id).toBeUndefined();
    }
  });
});

describe("Oath of Light, with the owner's amounts", () => {
  /** A Paladin with Holy Light, Flash, Holy Shock and the Oath, no crit, no healing power. */
  const healer = (id: string, talents: Record<string, number> = {}) => {
    const build = talentBuild('paladin', legalise(talents, 'paladin'));
    return makeAttacker({
      id,
      name: id,
      autoAttack: 'none',
      abilities: [HOLY_LIGHT, FLASH_OF_LIGHT, HOLY_SHOCK, OATH_OF_LIGHT_ABILITY],
      abilityModifiers: build.abilityModifiers,
      resources: [{ type: 'mana', maximum: 100_000 }],
      stats: { spellCritChance: -1000, healingPower: 0 },
    });
  };
  const ally = (id: string) => {
    const a = new Combatant({ id, name: id, kind: 'summon', faction: 'friendly', maxHealth: 1_000_000, party: 1 });
    a.health.set(1);
    return a;
  };
  const healed = (events: TelemetryEvent[], targetId: string, abilityId: string) =>
    events
      .filter((e) => e.type === 'heal' && (e as { targetId?: string }).targetId === targetId)
      .filter((e) => (e as { abilityId?: string }).abilityId === abilityId)
      .reduce((n, e) => n + (e as unknown as { amount: number }).amount, 0);

  it('states the figures: 400, 115, 229, five minutes, 8% of base mana', () => {
    expect(OATH_OF_LIGHT_HEALING).toEqual({ holy_light: 400, flash_of_light: 115, holy_shock: 229 });
    expect(OATH_OF_LIGHT_DURATION_MS).toBe(seconds(300));
    expect(PALADIN_TALENT_EFFECTS.oath_of_light).toEqual([{ kind: 'grantAbility', abilityId: 'oath_of_light' }]);
  });

  it("adds 400 'up to' to the caster's Holy Light on the Oath target, scaled by its coefficient", () => {
    const paladin = healer('paladin');
    const sworn = ally('sworn');
    const other = ally('other');
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([paladin, sworn, other, makeTarget()], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    expect(castAbility(simulation, paladin, OATH_OF_LIGHT_ABILITY, sworn)).toEqual({ ok: true });
    simulation.advanceTo(seconds(2));
    castAbility(simulation, paladin, HOLY_LIGHT, sworn);
    simulation.advanceTo(seconds(6));
    castAbility(simulation, paladin, HOLY_LIGHT, other);
    simulation.advanceTo(seconds(10));
    const difference = healed(events, 'sworn', 'holy_light') - healed(events, 'other', 'holy_light');
    expect(difference).toBeCloseTo(400 * PLACEHOLDER_HOLY_LIGHT_HEAL_COEFFICIENT, 6);
  });

  it('pays only the Paladin who swore it, and moves when sworn again', () => {
    const paladin = healer('paladin');
    const second = healer('second');
    const a = ally('a');
    const b = ally('b');
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([paladin, second, a, b, makeTarget()], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    castAbility(simulation, paladin, OATH_OF_LIGHT_ABILITY, a);
    castAbility(simulation, second, HOLY_LIGHT, a);
    simulation.advanceTo(seconds(4));
    castAbility(simulation, second, HOLY_LIGHT, b);
    simulation.advanceTo(seconds(8));
    // Another Paladin's Holy Light gains nothing from somebody else's Oath.
    expect(healed(events, 'a', 'holy_light')).toBeCloseTo(healed(events, 'b', 'holy_light'), 6);

    // "One Oath at a time": swearing it on b takes it off a.
    castAbility(simulation, paladin, OATH_OF_LIGHT_ABILITY, b);
    expect(a.auras.has('oath_of_light')).toBe(false);
    expect(b.auras.get('oath_of_light')?.sourceId).toBe('paladin');
  });

  it("takes Boundless Light's 30% back on the Oath target and nowhere else", () => {
    const paladin = healer('paladin', { holy_shock: 1, boundless_light: 2 });
    const sworn = ally('sworn');
    const other = ally('other');
    const simulation = buildSimulation([paladin, sworn, other, makeTarget()]);
    simulation.begin();
    castAbility(simulation, paladin, OATH_OF_LIGHT_ABILITY, sworn);
    expect(sworn.abilityModifierAgainst('holy_shock').healingCritBonus).toBe(-30);
    expect(other.abilityModifierAgainst('holy_shock').healingCritBonus ?? 0).toBe(0);
    expect(paladin.abilityModifierFor('holy_shock')?.healingCritBonus).toBe(30);
  });

  it('is cast on the tank by the Holy list, and only while the tank has none', () => {
    const entry = PALADIN_HOLY.entries.find((e) => e.abilityId === 'oath_of_light')!;
    expect(entry.target).toEqual({ kind: 'tank' });
    expect(entry.condition).toEqual({ kind: 'aura', on: 'target', auraId: 'oath_of_light', present: false });
  });
});
