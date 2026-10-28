/**
 * Round 83: Survivalist's Discipline is modelled (both traps 30 s -> 18 s at
 * 2/2), so re-price it on the two melee Hunters, which weave traps and do not
 * take it. Round 78 moved LW Melee's two points OUT of it while it was inert.
 *
 *   PRESET=lw_melee FILE=tools/optimise/survivalistsDiscipline83.ts VARIANTS=sd83LwMelee WEIGHTED=1 ITER=400 npx vite-node tools/probe_build.ts
 *   PRESET=hawk_melee FILE=tools/optimise/survivalistsDiscipline83.ts VARIANTS=sd83Hawk WEIGHTED=1 ITER=400 npx vite-node tools/probe_build.ts
 */
import type { Apply, Variant } from '../buildVariants';

/** Move `points` from `donor` into Survivalist's Discipline. */
const intoDiscipline =
  (donor: string, points = 2): Apply =>
  (profile) => {
    const talents = { ...profile.talents };
    talents[donor] = (talents[donor] ?? 0) - points;
    if (talents[donor] <= 0) delete talents[donor];
    talents.survivalist_s_discipline = (talents.survivalist_s_discipline ?? 0) + points;
    return { ...profile, talents };
  };

const control: Variant = { label: 'the shipped tree -- the control', apply: (p) => p };

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  sd83LwMelee: [
    control,
    { label: 'Discipline 2 from Clever Traps 2 (round 78 undone)', apply: intoDiscipline('clever_traps') },
    { label: 'Discipline 2 from Improved Stings 2', apply: intoDiscipline('improved_stings') },
    { label: 'Discipline 2 from Resourcefulness 2', apply: intoDiscipline('resourcefulness') },
    { label: 'Discipline 2 from Survivalist 4 -> 2', apply: intoDiscipline('survivalist') },
  ],
  sd83Hawk: [
    control,
    { label: 'Discipline 2 from Pathfinding 2 (movement)', apply: intoDiscipline('pathfinding') },
    { label: 'Discipline 2 from Clever Traps 2', apply: intoDiscipline('clever_traps') },
    { label: 'Discipline 2 from Improved Monkey 3 -> 1', apply: intoDiscipline('improved_aspect_of_the_monkey') },
    { label: 'Discipline 2 from Survivalist 3 -> 1', apply: intoDiscipline('survivalist') },
  ],
};
