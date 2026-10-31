/**
 * Seal Twist under Unsealed Wrath (1.60.1.70707): how many stored copies to
 * swap seals at. The shipped list swaps at the talent's cap, three.
 *
 *   PRESET=pally_ret FILE=tools/optimise/sealTwist707.ts VARIANTS=swap DURATION=120 ITER=200 npx vite-node tools/probe_build.ts
 */
import { type Variant, apl } from '../buildVariants';
import { all, any, not, selfHas, selfStacks } from '../../src/game/rotations/apl/shorthand';

const control: Variant = { label: 'swap at 3 copies -- the control', apply: (p) => p };

const swapAt = (n: number): Variant => ({
  label: `swap at ${n} cop${n === 1 ? 'y' : 'ies'}`,
  apply: apl((entries) =>
    entries.map((e) => {
      if (e.abilityId === 'seal_of_command') {
        return {
          ...e,
          condition: any(
            all(not(selfHas('seal_of_command')), not(selfHas('seal_of_righteousness'))),
            all(selfHas('seal_of_righteousness'), selfStacks('atLeast', n, 'unsealed_wrath_seal_of_righteousness')),
          ),
        };
      }
      if (e.abilityId === 'seal_of_righteousness') {
        return {
          ...e,
          condition: all(selfHas('seal_of_command'), selfStacks('atLeast', n, 'unsealed_wrath_seal_of_command')),
        };
      }
      return e;
    }),
  ),
});

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  swap: [control, swapAt(1), swapAt(2)],
};
