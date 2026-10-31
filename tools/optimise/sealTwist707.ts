/**
 * Seal Twist under Unsealed Wrath (1.60.1.70707). The shipped list is the
 * owner's cycle -- Righteousness after three copies of Command, Command after
 * one of Righteousness -- and the variants are other cycles.
 *
 *   PRESET=pally_ret FILE=tools/optimise/sealTwist707.ts VARIANTS=swap DURATION=120 ITER=400 npx vite-node tools/probe_build.ts
 *   PRESET=pally_ret FILE=tools/optimise/sealTwist707.ts VARIANTS=cycles DURATION=120 ITER=400 npx vite-node tools/probe_build.ts
 *
 * A COPY IS AN ATTACK: every landed attack under a seal stores one, so "N
 * attacks under Command" is "Command has stored N copies".
 */
import { type Apply, type Variant, apl, chain } from '../buildVariants';
import type { AplCondition } from '../../src/game/rotations/apl';
import { all, any, fightElapsed, not, selfHas, selfStacks } from '../../src/game/rotations/apl/shorthand';

const SOC = 'seal_of_command';
const SOR = 'seal_of_righteousness';
const stored = (seal: string, n: number) => selfStacks('atLeast', n, `unsealed_wrath_${seal}`);
const neither = all(not(selfHas(SOC)), not(selfHas(SOR)));

const control: Variant = { label: "A: 3 Command then 1 Righteousness -- the control", apply: (p) => p };

/** Replace both seal entries' conditions. */
const seals = (command: AplCondition, righteousness: AplCondition): Apply =>
  apl((entries) =>
    entries.map((e) =>
      e.abilityId === SOC
        ? { ...e, condition: command }
        : e.abilityId === SOR
          ? { ...e, condition: righteousness }
          : e,
    ),
  );

/** The opener with `last` as the seal that is up at the pull. */
const openOn =
  (last: string): Apply =>
  (profile) => ({
    ...profile,
    precombat: [
      { abilityId: last === SOC ? SOR : SOC, secondsBefore: 3 },
      { abilityId: last, secondsBefore: 1.5 },
      { abilityId: 'judgement', secondsBefore: 0 },
    ],
  });

const swapAt = (n: number): Variant => ({
  label: `symmetric swap at ${n} cop${n === 1 ? 'y' : 'ies'}`,
  apply: seals(any(neither, all(selfHas(SOR), stored(SOR, n))), all(selfHas(SOC), stored(SOC, n))),
});

/*
 * THE THREE CYCLES THE OWNER ASKED TO COMPARE.
 *
 *   A  3 Command, 1 Righteousness, repeat           -- the shipped list
 *   B  3 Righteousness, 1 Command, repeat           -- opens under Righteousness
 *   C  1 Command, then 3 Righteousness, 3 Command   -- the first Command phase
 *      is one attack, read off the clock: it is the only Command phase that
 *      can end inside the first three seconds.
 */
const B: Variant = {
  label: 'B: 3 Righteousness then 1 Command',
  apply: chain(
    openOn(SOR),
    seals(all(selfHas(SOR), stored(SOR, 3)), any(neither, all(selfHas(SOC), stored(SOC, 1)))),
  ),
};

const C: Variant = {
  label: 'C: 1 Command, then 3 Righteousness, 3 Command',
  apply: chain(
    openOn(SOC),
    seals(
      any(neither, all(selfHas(SOR), stored(SOR, 3))),
      all(selfHas(SOC), any(stored(SOC, 3), all(fightElapsed('below', 3), stored(SOC, 1)))),
    ),
  ),
};

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  swap: [control, swapAt(1), swapAt(2), swapAt(3)],
  cycles: [control, B, C],
};
