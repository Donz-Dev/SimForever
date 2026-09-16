import type { PartialStats, WeaponProfile } from '../../engine';
import { Combatant } from '../../engine';
import { EXAMPLE_ABILITIES } from '../abilities/exampleAbilities';
import { BASIC_MELEE_ROTATION } from '../rotations/basicMeleeRotation';

/** Default weapon for the example player. */
export const EXAMPLE_WEAPON: WeaponProfile = {
  name: 'Melee',
  swingTimerMs: 2600,
  baseDamage: 80,
  damageVariance: 0.15,
  powerCoefficient: 0.35,
  school: 'physical',
  // Auto attacks are the player's only rage income, which is what makes the
  // rotation rage-limited rather than purely cooldown-limited.
  generates: { resource: 'rage', amount: 15 },
};

export interface PlayerOptions {
  readonly id?: string;
  readonly name?: string;
  readonly maxHealth?: number;
  readonly stats?: PartialStats;
  readonly weapon?: WeaponProfile;
}

/**
 * The example player: a melee character with two abilities and a swing timer.
 *
 * Every number is a default that a profile can override. Real class and spec
 * definitions will live alongside this file, built the same way.
 */
export function createPlayer(options: PlayerOptions = {}): Combatant {
  return new Combatant({
    id: options.id ?? 'player_1',
    name: options.name ?? 'Player',
    kind: 'player',
    faction: 'friendly',
    maxHealth: options.maxHealth ?? 1000,
    stats: {
      strength: 100,
      attackPower: 100,
      critRating: 0,
      hasteRating: 0,
      ...options.stats,
    },
    resources: [
      // Rage starts empty and is built by attacking, unlike mana.
      { type: 'rage', maximum: 100, initial: 0 },
    ],
    abilities: EXAMPLE_ABILITIES,
    rotation: BASIC_MELEE_ROTATION,
    weapon: options.weapon ?? EXAMPLE_WEAPON,
  });
}
