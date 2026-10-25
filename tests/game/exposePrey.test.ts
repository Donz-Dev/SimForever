import { describe, expect, it } from 'vitest';
import type { AttackTableKind, Combatant } from '../../src/engine';
import { dealDamage, seconds } from '../../src/engine';
import { ARCANE_SHOT, EXPLOSIVE_TRAP_ABILITY, IMMOLATION_TRAP_ABILITY } from '../../src/game/abilities/hunter';
import { EXPOSE_PREY, EXPOSE_PREY_DURATION_MS, exposePrey } from '../../src/game/reactions/hunterTalents';
import { talentNumber } from '../../src/game/talents/talentValues';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * EXPOSE PREY OPENS ON MELEE AND RANGED ATTACKS (round 69), the owner's:
 * "triggers when melee and RANGED attacks hit the target" -- the tooltip's own
 * "your melee and ranged attacks". A 100% chance, so each case is decided by
 * one hit rather than a sample.
 * ==============================================================================
 */

const BOW = { name: 'Bow', swingTimerMs: 3000, baseDamage: 100, damageVariance: 0 };
const AXE = { name: 'Axe', swingTimerMs: 3000, baseDamage: 100, damageVariance: 0 };

function hunter(overrides: Parameters<typeof makeAttacker>[0] = {}): Combatant {
  return makeAttacker({
    reactions: [exposePrey(100)],
    stats: { attackPower: 100, hitChance: 100 },
    resources: [{ type: 'mana', maximum: 100_000 }],
    // In the book, or a cast is refused as "on cooldown".
    abilities: [ARCANE_SHOT, IMMOLATION_TRAP_ABILITY, EXPLOSIVE_TRAP_ABILITY],
    ...overrides,
  });
}

function opensAfterFirstSwing(autoAttack: 'ranged' | 'main-hand'): boolean {
  const actor = hunter({ autoAttack, weapons: autoAttack === 'ranged' ? { ranged: BOW } : { mainHand: AXE } });
  const simulation = buildSimulation([actor, makeTarget({ maxHealth: 1e9 })], { durationMs: seconds(10) });
  simulation.begin();
  simulation.advanceTo(10);
  return actor.auras.has(EXPOSE_PREY.id);
}

/** One hit of `table`, dealt directly, and whether the window opened. */
function opensOn(table: AttackTableKind): boolean {
  const actor = hunter();
  const target = makeTarget({ maxHealth: 1e9 });
  const simulation = buildSimulation([actor, target]);
  simulation.begin();
  dealDamage(simulation, {
    source: actor,
    target,
    abilityId: 'test',
    abilityName: 'Test',
    school: table === 'spell' ? 'fire' : 'physical',
    baseAmount: 100,
    attackTable: table,
  });
  return actor.auras.has(EXPOSE_PREY.id);
}

describe('Expose Prey', () => {
  it('opens on a RANGED auto-attack', () => {
    expect(opensAfterFirstSwing('ranged')).toBe(true);
  });

  it('opens on a melee auto-attack', () => {
    expect(opensAfterFirstSwing('main-hand')).toBe(true);
  });

  it('opens on a ranged special, Arcane Shot', () => {
    const actor = hunter({ weapons: { ranged: BOW } });
    const target = makeTarget({ maxHealth: 1e9 });
    const simulation = buildSimulation([actor, target]);
    simulation.begin();
    expect(simulation.cast(actor, ARCANE_SHOT, target).ok).toBe(true);
    expect(actor.auras.has(EXPOSE_PREY.id)).toBe(true);
  });

  it('opens on every melee and ranged table, and not on a spell', () => {
    expect(opensOn('melee-auto')).toBe(true);
    expect(opensOn('melee-special')).toBe(true);
    expect(opensOn('ranged-auto')).toBe(true);
    expect(opensOn('ranged-special')).toBe(true);
    expect(opensOn('spell')).toBe(false);
  });

  it('does not open on a trap, which is neither', () => {
    for (const trap of [IMMOLATION_TRAP_ABILITY, EXPLOSIVE_TRAP_ABILITY]) {
      const actor = hunter();
      const target = makeTarget({ maxHealth: 1e9 });
      const simulation = buildSimulation([actor, target], { durationMs: seconds(30) });
      simulation.begin();
      expect(simulation.cast(actor, trap, target).ok, trap.id).toBe(true);
      simulation.advanceTo(seconds(20));
      expect(actor.auras.has(EXPOSE_PREY.id), trap.id).toBe(false);
    }
  });

  it("lasts the tooltip's {1}, ten seconds at both ranks", () => {
    expect(talentNumber('hunter', 'expose_prey', 1, 1)).toBe(10);
    expect(talentNumber('hunter', 'expose_prey', 2, 1)).toBe(10);
    expect(EXPOSE_PREY_DURATION_MS).toBe(seconds(10));
    expect(EXPOSE_PREY.durationMs).toBe(seconds(10));
  });
});
