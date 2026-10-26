/*
 * ROUND 79: the off-hand weapon enchant on the five builds that carried the
 * two-hand-only +25 Agility in a one-hand slot. The owner: "+15 agi (or
 * Crusader) NOT +25 agi". Measured at 1 target / 120 s and at 5 targets / 60 s.
 *
 *   PRESET=rogue_hemo FILE=tools/optimise/offHandEnchantVariants.ts VARIANTS=oh79 DURATION=120 npx vite-node tools/probe_build.ts
 */
import type { Variant } from '../buildVariants';
import { enchant } from '../buildVariants';
import { foreverEnchantId } from '../../src/game/items/foreverEnchants';

const AGILITY_15 = foreverEnchantId('+15 Agility');
const CRUSADER = 20034;

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  oh79: [
    { label: 'off hand +15 Agility', apply: enchant('offHand', AGILITY_15) },
    { label: 'off hand Crusader', apply: enchant('offHand', CRUSADER) },
  ],
};
