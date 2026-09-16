import type { CombatantOptions } from '../../src/engine';
import { Combatant } from '../../src/engine';

/** A friendly combatant with no weapon or rotation, so it only acts when told. */
export function makeAttacker(overrides: Partial<CombatantOptions> = {}): Combatant {
  return new Combatant({
    id: 'attacker',
    name: 'Attacker',
    kind: 'player',
    faction: 'friendly',
    maxHealth: 1000,
    stats: { attackPower: 100, ...overrides.stats },
    ...overrides,
  });
}

/** A hostile combatant that stands still. */
export function makeTarget(overrides: Partial<CombatantOptions> = {}): Combatant {
  return new Combatant({
    id: 'target',
    name: 'Target',
    kind: 'enemy',
    faction: 'hostile',
    maxHealth: 10_000,
    ...overrides,
  });
}
