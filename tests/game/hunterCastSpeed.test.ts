import { describe, expect, it } from 'vitest';
import type { Ability, WeaponProfile } from '../../src/engine';
import { RATING_PER_PERCENT, Simulation, applyHaste, castAbility, seconds } from '../../src/engine';
import { AIMED_SHOT, MULTI_SHOT, SNIPER_SHOT } from '../../src/game/abilities/hunter';
import { QUIVER_RANGED_SPEED_DIVISOR } from '../../src/game/character/hunterRanged';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 77: A HUNTER'S CAST SHOTS ARE SPED BY HASTE AND BY RANGED ATTACK SPEED.
 * The owner's: "Hunter's cast time are affected by Haste AND ranged attack
 * speed increases. This includes: Rapid Fire, Berserking, Haste from
 * gear/enchants, Haste from Racials, and Deadly Aspects proc 'Quick Shots', and
 * the Quiver attack speed increase. This affects: Multi-shot, Sniper Shot, and
 * Aimed Shot cast times."
 * ==============================================================================
 */

const rating = (percent: number) => percent * RATING_PER_PERCENT.haste;

const bow: WeaponProfile = {
  name: 'Bow',
  swingTimerMs: Math.round(3000 / QUIVER_RANGED_SPEED_DIVISOR),
  baseDamage: 100,
  speedMultiplier: QUIVER_RANGED_SPEED_DIVISOR,
};

const shot = (flag: boolean): Ability => ({
  id: 'shot',
  name: 'Shot',
  castTimeMs: seconds(2),
  attackTable: 'ranged-special',
  ...(flag ? { castSpedByRangedAttackSpeed: true } : {}),
  onCast: () => {},
});

function castEnds(ability: Ability, stats: Record<string, number>): { castEndsAt: number; gcdReadyAt: number } {
  const caster = makeAttacker({ autoAttack: 'none', abilities: [ability], stats, weapons: { ranged: bow } });
  const target = makeTarget();
  const simulation = buildSimulation([caster, target]);
  simulation.begin();
  castAbility(simulation, caster, caster.abilities.get(ability.id)!, target);
  return { castEndsAt: caster.castEndsAt, gcdReadyAt: caster.gcdReadyAt };
}

describe('a cast shot', () => {
  it('is sped by the quiver alone', () => {
    expect(castEnds(shot(true), {}).castEndsAt).toBe(applyHaste(2000, QUIVER_RANGED_SPEED_DIVISOR));
  });

  it('multiplies haste, swing speed and the quiver', () => {
    // 10% haste (gear, Berserking, a racial), 40% swing speed (Rapid Fire).
    const { castEndsAt } = castEnds(shot(true), { hasteRating: rating(10), attackSpeedRating: rating(40) });
    expect(castEndsAt).toBe(applyHaste(2000, 1.1 * 1.4 * QUIVER_RANGED_SPEED_DIVISOR));
  });

  it('keeps the full global cooldown: a shot is not a spell (round 81)', () => {
    /*
     * The CAST is sped by haste, ranged speed and the quiver; the global
     * cooldown it starts is not sped by any of them. Haste shortens only a
     * SPELL's global cooldown, the owner's answer to round 75's "triggered by
     * spells" -- it read "haste alone" until then, `applyHaste(1500, 1.1)`.
     */
    const { gcdReadyAt } = castEnds(shot(true), { hasteRating: rating(10), attackSpeedRating: rating(40) });
    expect(gcdReadyAt).toBe(1500);
  });

  it('does not reach a cast that is not declared', () => {
    const { castEndsAt } = castEnds(shot(false), { hasteRating: rating(10), attackSpeedRating: rating(40) });
    expect(castEndsAt).toBe(applyHaste(2000, 1.1));
  });
});

describe('the three shots the owner named', () => {
  it('declare it, and nothing else in the Hunter book needs to', () => {
    for (const ability of [AIMED_SHOT, MULTI_SHOT, SNIPER_SHOT]) {
      expect(ability.castSpedByRangedAttackSpeed).toBe(true);
    }
  });

  it("are sped by a built Hunter's quiver", () => {
    const profile = PRESETS_BY_ID.get('lw_ranged')!.build();
    const simulation = new Simulation(trainingDummyEncounter(profile, 1));
    const hunter = simulation.combatants.find((actor) => actor.kind === 'player')!;
    expect(hunter.weapons.ranged?.speedMultiplier).toBe(QUIVER_RANGED_SPEED_DIVISOR);
  });
});
