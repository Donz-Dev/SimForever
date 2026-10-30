/**
 * Round 83: Survivalist's Discipline is modelled (both traps 30 s -> 18 s at
 * 2/2), so re-price it on the two melee Hunters, which weave traps and do not
 * take it. Round 78 moved LW Melee's two points OUT of it while it was inert.
 *
 *   PRESET=lw_melee FILE=tools/optimise/survivalistsDiscipline83.ts VARIANTS=sd83LwMeleeShipped WEIGHTED=1 ITER=400 npx vite-node tools/probe_build.ts
 *   PRESET=hawk_melee FILE=tools/optimise/survivalistsDiscipline83.ts VARIANTS=sd83Hawk WEIGHTED=1 ITER=400 npx vite-node tools/probe_build.ts
 */
import type { Apply, Variant } from '../buildVariants';
import { legalAllocation } from '../../src/game/talents/talentRules';
import { talentsForClass } from '../../src/game/talents/talentData';

/** Move `points` from `donor` into Survivalist's Discipline. */
const intoDiscipline =
  (donor: string, points = 2): Apply =>
  (profile) => {
    const talents = { ...profile.talents };
    talents[donor] = (talents[donor] ?? 0) - points;
    if (talents[donor] <= 0) delete talents[donor];
    talents.survivalist_s_discipline = (talents.survivalist_s_discipline ?? 0) + points;
    /*
     * REFUSE AN ILLEGAL MOVE rather than measure it. The first run of this file
     * took Hawk Melee's Pathfinding, which strands Unleashed Fury and Summon
     * Hawk -- `createPlayer` drops both in silence, and the +37.55 it printed
     * was a build without its hawk.
     */
    const { dropped } = legalAllocation(talentsForClass(profile.character.characterClass)!, talents);
    if (dropped.length > 0) throw new Error(`${donor} -> Discipline strands ${dropped.join(', ')}`);
    return { ...profile, talents };
  };

const control: Variant = { label: 'the shipped tree -- the control', apply: (p) => p };

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  // Expose Prey is the ONLY legal two-point donor on this tree: every other
  // one strands a deeper talent (checked against `legalAllocation`).
  sd83Hawk: [control, { label: 'Discipline 2 from Expose Prey 2', apply: intoDiscipline('expose_prey') }],
  // LW Melee as shipped (round 83), with the moved points put back, to confirm
  // the gain from the other side.
  sd83LwMeleeShipped: [
    control,
    {
      label: 'Resourcefulness 2 back (the round 82 tree)',
      apply: (profile) => {
        const talents: Record<string, number> = { ...profile.talents, resourcefulness: 2 };
        delete talents.survivalist_s_discipline;
        return { ...profile, talents };
      },
    },
  ],
};
