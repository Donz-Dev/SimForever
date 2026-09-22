import type { Milliseconds } from '../../engine';
import { seconds } from '../../engine';
import type { ClassId, CombatStyleId } from './ids';

/**
 * How long a class's global cooldown is.
 *
 * ----------------------------------------------------------------------------
 * THE RULE, from the ruleset owner:
 *
 *   Every action, unless otherwise specified, triggers a 1.5 second global
 *   cooldown before another can be taken. For a Rogue, and for a Druid in Cat
 *   Form, it is 1.0 second instead.
 *
 * It is a property of the CLASS and not of the ability -- the same
 * Sinister-Strike-shaped ability costs a Rogue one second and a Warrior one
 * and a half -- so it lives on the combatant and the engine reads it from
 * there. The engine keeps a 1.5 second fallback for an actor built without
 * one, which in practice means a training dummy.
 *
 * The Druid clause is per FORM, not per class: a Druid in Bear Form is on the
 * ordinary 1.5, and only Cat is quickened. That is why this takes a combat
 * style as well as a class.
 * ----------------------------------------------------------------------------
 */
export const STANDARD_GCD_MS: Milliseconds = seconds(1.5);

/** The shorter one, for a Rogue and for a Druid in Cat Form. */
export const QUICKENED_GCD_MS: Milliseconds = seconds(1);

export function globalCooldownFor(
  characterClass: ClassId,
  style: CombatStyleId | undefined,
): Milliseconds {
  if (characterClass === 'rogue') return QUICKENED_GCD_MS;
  if (characterClass === 'druid' && style === 'cat') return QUICKENED_GCD_MS;
  return STANDARD_GCD_MS;
}
