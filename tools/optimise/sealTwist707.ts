/**
 * Seal Twist under Unsealed Wrath (1.60.1.70707). The shipped list is the
 * owner's cycle -- Righteousness after three copies of Command, Command after
 * one of Righteousness -- and the variants are symmetric swaps at N either way,
 * which is what the list did before the owner gave the cycle.
 *
 *   PRESET=pally_ret FILE=tools/optimise/sealTwist707.ts VARIANTS=swap DURATION=120 ITER=200 npx vite-node tools/probe_build.ts
 */
import { type Variant, apl } from '../buildVariants';
import { all, any, not, selfHas, selfStacks } from '../../src/game/rotations/apl/shorthand';

const control: Variant = { label: "the owner's 3-then-1 cycle -- the control", apply: (p) => p };

const swapAt = (n: number): Variant => ({
  label: `symmetric swap at ${n} cop${n === 1 ? 'y' : 'ies'}`,
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
  swap: [control, swapAt(1), swapAt(2), swapAt(3)],
};
