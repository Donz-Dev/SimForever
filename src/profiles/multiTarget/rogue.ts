import type { MultiTargetDefaults } from './types';
import type { AplCondition, AplEntry, AplList } from '../../game/rotations/apl';
import { all, comboPoints, fightRemaining, resource, selfTime, targetTime } from '../../game/rotations/apl';
import {
  ROGUE_COMBAT,
  ROGUE_COMBAT_MUT,
  ROGUE_HEMO,
  ROGUE_PURE_HEMO,
  ROGUE_VENOM,
} from '../../game/rotations/rogue';
import type { RaceId } from '../../game/character';
import { racialsForRace } from '../../game/rotations/racialCooldowns';
import { withoutUnselectedConsumables } from '../../game/rotations/consumableCooldowns';

/**
 * The Rogue presets' optimised Multi Target lists (rounds 78 and 80), keyed by
 * preset id. A preset with no entry runs its Single Target list on several
 * targets.
 *
 * ==============================================================================
 * FIVE OF SIX SINCE ROUND 80, AND WHAT THEY TUNE IS THE CLOCK RATHER THAN THE
 * TARGETS.
 *
 * BLADE FLURRY IS THE ROGUE'S ONLY AREA EFFECT, it is tier 20 of Combat, and
 * only the two Combat-tree builds reach it. So for Venom, Hemo Dagger and Pure
 * Hemo a 3-, 5- or 8-target fight is a ONE-target fight -- and the report runs
 * those at 60s and 30s where the Single Target list is tuned at 120s. That is
 * the lever: what a two-minute list does with a three-minute Cold Blood, a
 * maintenance Rupture and a once-a-fight Thistle Tea is wrong for a fight half
 * or a quarter as long, and the owner's round 79 rule lets the two lists
 * differ. Every figure is paired against the Single Target list, 400 fights,
 * at five targets / 60s and eight / 30s (`tools/optimise/rogueVariants80.ts`):
 *
 * | preset | edits to its Single Target list | 5T/60s | 8T/30s |
 * | --- | --- | --- | --- |
 * | Venom | Cold Blood on points alone (3+), Slice and Dice at 2+, Thistle Tea at 25, the potion ungated | +3.5 +/- 4.7 | +16.3 +/- 6.5 |
 * | Combat Mut | the potion ungated, Slice and Dice at 2+ | +2.2 +/- 4.6 | +11.4 +/- 4.2 |
 * | Combat | (round 78's Slice and Dice at 1) plus Thistle Tea at 25, the potion ungated | +33.1 +/- 10.5 | +77.5 +/- 16.7 |
 * | Hemo Dagger | Rupture at 2+, Eviscerate and Cold Blood at 4+ with 2s floors, the end dump at 8s | +7.5 +/- 5.9 | +25.5 +/- 7.7 |
 * | Pure Hemo | no Rupture, Slice and Dice at 1+, Thistle Tea at 25 | +7.8 +/- 7.7 | +32.7 +/- 11.3 |
 *
 * COMBAT ALSO DROPS the Single Target list's Vanish into Garrote, which is
 * +9.6 at one target and -4.5 / -18.4 at three-to-five / eight.
 *
 * RUPTURE HAS NONE: every edit tried was noise at 5T/60s and a loss at 8T/30s
 * (Rupture at 3+ -5.3, Thistle Tea at 25 -20.4).
 *
 * THESE ARE OUR LISTS, NOT THE OWNER'S, which is why owner thresholds can move
 * here and not in a Single Target list: the Thistle Tea gate the owner named
 * for each preset stays on the Single Target list (Combat's 15 against 25 is
 * -1.3 +/- 5.8 there), and only the shorter fights take the looser one -- with
 * one five-minute cooldown in a 30 or 60 second fight, drinking it into Blade
 * Flurry and Adrenaline Rush is the whole of its value.
 *
 * DERIVED FROM EACH STOCK LIST RATHER THAN COPIED, so a change the owner makes
 * to a Single Target list reaches the Multi Target one too, and narrowed by
 * race and consumable selection exactly as `stockListFor` narrows the stored
 * Single Target list -- a custom list is never re-derived, so it has to be
 * built narrowed. `tests/profiles/rogueMultiTarget.test.ts` compares each one
 * against its preset's Single Target list entry for entry.
 * ==============================================================================
 */

/** The consumable selection every Rogue preset carries for its two action rows. */
const ROGUE_ACTION_SELECTION = {
  potion: 'major_frenzy_potion',
  potion_secondary: 'secondary_major_healing_potion',
  other: 'thistle_tea',
} as const;

/** True for the round 80 end-of-fight Eviscerate, the one entry that reads the clock. */
const isEndOfFightEntry = (entry: AplEntry): boolean =>
  JSON.stringify(entry.condition ?? {}).includes('fightRemaining');

/**
 * A stock list, edited per ability id -- a condition replaces the entry's own,
 * `undefined` ungates it and `null` removes it -- then narrowed for the
 * preset's race and selections. The end-of-fight Eviscerate is never edited.
 */
function derive(
  list: AplList,
  race: RaceId,
  edits: Readonly<Record<string, AplCondition | null | undefined>>,
  extra: (entries: AplEntry[]) => AplEntry[] = (entries) => entries,
): readonly AplEntry[] {
  const edited = list.entries.flatMap((entry): AplEntry[] => {
    if (isEndOfFightEntry(entry) || !(entry.abilityId in edits)) return [entry];
    const condition = edits[entry.abilityId];
    if (condition === null) return [];
    const { condition: _old, ...rest } = entry;
    void _old;
    return [condition === undefined ? rest : { ...rest, condition }];
  });
  return withoutUnselectedConsumables(
    racialsForRace({ ...list, entries: extra(edited) }, race, 'rogue'),
    'rogue',
    ROGUE_ACTION_SELECTION,
  ).entries;
}

const sliceAndDiceAt = (points: number): AplCondition =>
  all(selfTime('atMost', 0, 'slice_and_dice'), comboPoints('atLeast', points));
const teaAt = (energy: number): AplCondition => resource('atMost', energy, 'energy');

/** Thistle Tea's gate in every short-fight list that moves it. */
const MULTI_THISTLE_TEA_ENERGY = 25;

/** Combat keeps round 78's one-point Slice and Dice. */
const COMBAT_MULTI_SLICE_AND_DICE_POINTS = 1;

/** Hemo Dagger's finishers, which spend at four with two-second floors in a short fight. */
const hemoMultiFinisher = all(
  comboPoints('atLeast', 4),
  targetTime('atLeast', 2, 'rupture'),
  selfTime('atLeast', 2, 'slice_and_dice'),
);
/** The end-of-fight Eviscerate the Hemo Dagger Single Target list does not carry. */
const HEMO_MULTI_END_OF_FIGHT: AplEntry = {
  abilityId: 'eviscerate',
  condition: all(fightRemaining('atMost', 8), comboPoints('atLeast', 2)),
};

export const ROGUE_MULTI_TARGET: MultiTargetDefaults = {
  rogue_venom: {
    name: 'Rogue (Venom, Multi Target)',
    entries: derive(ROGUE_VENOM, 'undead', {
      cold_blood: comboPoints('atLeast', 3),
      slice_and_dice: sliceAndDiceAt(2),
      thistle_tea: teaAt(MULTI_THISTLE_TEA_ENERGY),
      major_frenzy_potion: undefined,
    }),
  },
  rogue_combat_mut: {
    name: 'Rogue (Combat Mut, Multi Target)',
    entries: derive(ROGUE_COMBAT_MUT, 'undead', {
      slice_and_dice: sliceAndDiceAt(2),
      major_frenzy_potion: undefined,
    }),
  },
  rogue_combat: {
    name: 'Rogue (Combat, Multi Target)',
    entries: derive(ROGUE_COMBAT, 'orc', {
      vanish: null,
      slice_and_dice: sliceAndDiceAt(COMBAT_MULTI_SLICE_AND_DICE_POINTS),
      thistle_tea: teaAt(MULTI_THISTLE_TEA_ENERGY),
      major_frenzy_potion: undefined,
    }),
  },
  rogue_hemo: {
    name: 'Rogue (Hemo Dagger, Multi Target)',
    entries: derive(
      ROGUE_HEMO,
      'undead',
      {
        rupture: all(targetTime('atMost', 0, 'rupture'), comboPoints('atLeast', 2)),
        cold_blood: hemoMultiFinisher,
        eviscerate: hemoMultiFinisher,
      },
      (entries) => [HEMO_MULTI_END_OF_FIGHT, ...entries],
    ),
  },
  rogue_pure_hemo: {
    name: 'Rogue (Pure Hemo, Multi Target)',
    entries: derive(ROGUE_PURE_HEMO, 'undead', {
      rupture: null,
      slice_and_dice: sliceAndDiceAt(1),
      thistle_tea: teaAt(MULTI_THISTLE_TEA_ENERGY),
    }),
  },
};
