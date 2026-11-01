import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart, runProfile } from '../../src/simulator';
import {
  ENERGIZE_ENERGY,
  ENERGIZE_PPM,
  energizeReaction,
} from '../../src/game/items/setBonuses';
import { validateProfile } from '../../src/profiles/validateProfile';

/*
 * ENERGIZE, a Rogue set bonus in the background: "Chance on melee attack to
 * restore 20 Energy", 1 PPM on every weapon use that deals damage -- the
 * owner's rate and scope. Read off the EVENT STREAM, because a proc's rate is
 * only checkable against a denominator: the uses ENTITLED to a roll, counted
 * here by hand rather than by asking the reaction.
 */

const ROGUES = ['rogue_venom', 'rogue_combat', 'rogue_combat_mut', 'rogue_hemo', 'rogue_pure_hemo'];

function withEnergize(id: string, seed: number) {
  const built = PRESETS_BY_ID.get(id)!.build();
  return {
    ...built,
    setBonuses: ['energize'],
    simulation: { ...built.simulation, durationSeconds: 120, iterations: 1, seed },
  };
}

// A poison is triggered by a use and is not one: it carries no weapon.
const NOT_A_WEAPON_USE = /Poison/;

describe('Energize', () => {
  it('is off unless a profile asks for it', () => {
    for (const id of ROGUES) {
      const built = PRESETS_BY_ID.get(id)!.build();
      expect(built.setBonuses, id).toBeUndefined();
      const run = runProfile({ ...built, simulation: { ...built.simulation, iterations: 1 } });
      const procs = run.timeline.filter(
        (e) => e.type === 'resource_gained' && e.source === 'energize',
      );
      expect(procs, id).toHaveLength(0);
    }
  });

  it('restores 20 energy at 1 PPM of each use, by the speed of the hand that made it', () => {
    let procs = 0;
    let expected = 0;
    let variance = 0;
    for (const id of ROGUES) {
      const character = characterAtCombatStart(withEnergize(id, 1))!;
      const speed = {
        mainHand: character.weapons.mainHand!.swingTimerMs / 1000,
        offHand: character.weapons.offHand!.swingTimerMs / 1000,
      };
      for (let seed = 1; seed <= 12; seed += 1) {
        const run = runProfile(withEnergize(id, seed));
        const player = run.actors.find((actor) => actor.kind === 'player')!;
        for (const event of run.timeline) {
          if (event.type === 'resource_gained' && event.source === 'energize') {
            procs += 1;
            expect(event.resource).toBe('energy');
            expect(event.amount + event.wasted).toBe(ENERGIZE_ENERGY);
          }
          if (event.type !== 'damage' || event.sourceId !== player.id) continue;
          if (event.periodic || event.amount <= 0) continue;
          if (event.attackTable !== 'melee-auto' && event.attackTable !== 'melee-special') continue;
          if (NOT_A_WEAPON_USE.test(event.abilityName)) continue;
          const hand = /Off Hand/.test(event.abilityName) ? speed.offHand : speed.mainHand;
          const p = (ENERGIZE_PPM * hand) / 60;
          expected += p;
          variance += p * (1 - p);
        }
      }
    }
    const z = (procs - expected) / Math.sqrt(variance);
    expect(expected).toBeGreaterThan(100);
    expect(Math.abs(z), `${procs} procs against ${expected.toFixed(1)} expected`).toBeLessThan(3.5);
  });

  it('rolls on a landed weapon use that deals damage, and on nothing else', () => {
    /*
     * DRIVEN DIRECTLY, with a roll that always wins, so what is counted is
     * whether a roll was TAKEN. The fight test above cannot see a poison
     * rolling: a poison hit is emitted between the weapon hit and its gain,
     * and it moves the rate by less than the test's own noise.
     */
    const reaction = energizeReaction();
    const actor = characterAtCombatStart(withEnergize('rogue_combat', 1))!;
    const context = { rng: { nextFloat: () => 0 } } as never;
    const attack = (fields: object) =>
      ({ outcome: 'hit', amount: 100, attackTable: 'melee-special', ...fields }) as never;
    const rolls = (fields: object) => reaction.canTrigger!(context, actor, attack(fields));

    expect(rolls({ weaponSlot: 'mainHand', attackTable: 'melee-auto' })).toBe(true);
    expect(rolls({ weaponSlot: 'offHand', attackTable: 'melee-auto' })).toBe(true);
    expect(rolls({ weaponSlot: 'mainHand' }), 'an ability with the main hand').toBe(true);
    expect(rolls({ weaponSlot: undefined }), 'a poison carries no weapon').toBe(false);
    expect(rolls({ weaponSlot: 'mainHand', amount: 0 }), 'deals no damage').toBe(false);
    // An avoided attack never reaches `canTrigger`: the outcome list stops it.
    expect(reaction.outcomes).not.toContain('miss');
    expect(reaction.outcomes).not.toContain('dodge');
    expect(reaction.outcomes).not.toContain('parry');

    // THE HAND'S OWN SPEED: a roll just over that hand's chance fails.
    for (const hand of ['mainHand', 'offHand'] as const) {
      const chance = (ENERGIZE_PPM * actor.weapons[hand]!.swingTimerMs) / 60_000;
      const at = (roll: number) =>
        reaction.canTrigger!({ rng: { nextFloat: () => roll } } as never, actor, attack({ weaponSlot: hand }));
      expect(at(chance * 0.999), hand).toBe(true);
      expect(at(chance * 1.001), hand).toBe(false);
    }
  });

  it('survives a save and a load, and a bad value is refused', () => {
    const profile = withEnergize('rogue_combat', 1);
    const loaded = validateProfile(JSON.parse(JSON.stringify(profile)));
    expect(loaded.ok && loaded.profile.setBonuses).toEqual(['energize']);
    expect(validateProfile({ ...profile, setBonuses: 'energize' }).ok).toBe(false);
  });
});
