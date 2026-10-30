import { describe, expect, it } from 'vitest';
import type { Combatant, TelemetryEvent } from '../../src/engine';
import { castAbility, seconds, Simulation } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { REVENGE_DAMAGE } from '../../src/game/abilities/warrior';
import { REVENGE_READY, WARRIOR_STANCES } from '../../src/game/auras/warrior';
import { REVENGE_AP_COEFFICIENT } from '../../src/game/combat/coefficients';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * REVENGE IS 22.5% OF ATTACK POWER, by the owner's later statement over the
 * sheet's 22%. Written out by hand here, and MEASURED from damage that landed.
 *
 * A RATIO RATHER THAN A SLOPE: stance, talents and any damage multiplier reach
 * the flat 153 and the attack power term alike, so damage at 1,000 attack power
 * over damage at none is `(153 + 0.225 x 1000) / 153` whatever else applies.
 */

const ATTACK_POWER = 1_000;

function prot(attackPower: number): Combatant {
  const profile = PRESETS_BY_ID.get('prot_warr')!.build();
  const options = {
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: profile.character.combatStyle,
    stance: profile.character.stance,
    equipment: profile.equipment,
    talents: profile.talents,
  };
  const geared = createPlayer({ ...options, bonusStats: profile.stats });
  const player = createPlayer({
    ...options,
    bonusStats: {
      ...profile.stats,
      attackPower:
        (profile.stats.attackPower ?? 0) - geared.stats.effective.attackPower + attackPower,
    },
  });
  (player as { rotation?: unknown }).rotation = undefined;
  return player;
}

function revengeDamage(attackPower: number): number {
  const events: TelemetryEvent[] = [];
  const player = prot(attackPower);
  expect(player.stats.effective.attackPower).toBeCloseTo(attackPower, 6);
  const target = createTrainingDummy({
    name: 'Target',
    health: 1_000_000_000,
    armor: 0,
    level: 63,
    attacks: false,
  });
  const simulation = new Simulation(
    {
      durationMs: seconds(10),
      seed: 1,
      createCombatants: () => [player, target],
      attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 }),
    },
    { emit: (event) => events.push(event) },
  );
  for (const resource of player.resources.all) resource.fill();
  simulation.applyAura(player, REVENGE_READY, player.id);
  const revenge = player.abilities.get('revenge')!;
  // The stance is an opening aura the fight applies; this harness never begins
  // one, so Defensive Stance is put up by hand, as the coefficient probe does.
  const defensive = WARRIOR_STANCES.find((stance) => revenge.stances?.includes(stance.id))!;
  simulation.applyAura(player, defensive, player.id);
  const result = castAbility(simulation, player, revenge, target);
  expect(result).toEqual({ ok: true });
  simulation.advanceTo(seconds(10));

  return events
    .filter((e) => e.type === 'damage' && e.sourceId === player.id && e.abilityId === 'revenge')
    .reduce((sum, e) => sum + (e as { amount: number }).amount, 0);
}

describe('Revenge scales with 22.5% of attack power', () => {
  it('declares the owner’s figure', () => {
    expect(REVENGE_AP_COEFFICIENT).toBe(0.225);
    expect(REVENGE_DAMAGE).toBe(153);
  });

  it('delivers it to damage that lands, on top of the flat 153', () => {
    const flat = revengeDamage(0);
    const scaled = revengeDamage(ATTACK_POWER);
    expect(flat).toBeGreaterThan(0);
    expect(scaled / flat).toBeCloseTo((153 + 0.225 * ATTACK_POWER) / 153, 2);
  });
});
