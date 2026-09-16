import type { Rotation } from '../../engine';
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
