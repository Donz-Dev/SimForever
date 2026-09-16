import type { Rotation } from '../../engine';
import type { ClassId, CombatStyleId } from '../character';
import { PriorityRotation } from '../../engine';

/**
 * The example rotation, as an Action Priority List.
 *
 * Read top to bottom: use the first ability that is castable right now. The
 * engine already knows about cooldowns, rage and target validity, so the list
 * only has to express intent:
 *
 *   1. Strike       keep the bleed up and use the cooldown
 *   2. Heroic Blow  dump spare rage rather than letting it cap
 *
 * A more realistic list would add conditions (refresh the bleed only under 3
 * seconds remaining, pool rage before a cooldown). That is a change to this
 * file alone.
 */
export const BASIC_MELEE_ROTATION: Rotation = new PriorityRotation('Basic Melee', [
  { abilityId: 'strike' },
  { abilityId: 'heroic_blow' },
]);

/**
 * The action priority list for a class and combat style.
 *
 * Combat style exists partly to select this: a Warrior's two-hander and
 * dual-wield rotations are genuinely different lists, and a Druid's bear and
 * cat rotations share almost nothing.
 *
 * Only the Warrior has a rotation today, and the same one for all three of its
 * styles. The lookup takes the style regardless, so adding per-style lists is a
 * change to this table alone.
 */
export function rotationFor(
  characterClass: ClassId,
  _style: CombatStyleId,
): Rotation | undefined {
  return characterClass === 'warrior' ? BASIC_MELEE_ROTATION : undefined;
}
