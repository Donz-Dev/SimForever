import type { Rotation } from '../../engine';
import type { ClassId, CombatStyleId } from '../character';
import { warriorRotation } from './warrior';

/**
 * The action priority list for a class and combat style.
 *
 * Combat style exists partly to select this: a Warrior with a shield has a
 * different list from one with a two-hander, and a Druid's bear and cat
 * rotations share almost nothing.
 *
 * Only the Warrior has a rotation today. The lookup takes the style regardless,
 * so adding per-style lists for the other classes is a change to this table
 * alone.
 */
export function rotationFor(
  characterClass: ClassId,
  style: CombatStyleId,
): Rotation | undefined {
  return characterClass === 'warrior' ? warriorRotation(style) : undefined;
}
