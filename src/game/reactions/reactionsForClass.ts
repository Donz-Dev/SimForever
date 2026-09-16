import type { Reaction } from '../../engine';
import type { ClassId, CombatStyleId } from '../character';
import { WARRIOR_REACTIONS } from './warrior';

/**
 * Reactive procs a class has.
 *
 * The same shape as `abilitiesForClass` and `rotationFor`, and for the same
 * reason: it takes the combat style so that per-style lists are a change to
 * this function alone when they are needed.
 *
 * Only the Warrior has any. A Rogue's Riposte, a Hunter's counterattack and a
 * Druid's Savage Defense all want this hook when their content arrives.
 */
export function reactionsForClass(
  characterClass: ClassId,
  _style?: CombatStyleId,
): readonly Reaction[] {
  return characterClass === 'warrior' ? WARRIOR_REACTIONS : [];
}
