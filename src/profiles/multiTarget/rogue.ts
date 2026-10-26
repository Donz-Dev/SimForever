import type { MultiTargetDefaults } from './types';
import type { AplEntry } from '../../game/rotations/apl';
import { all, comboPoints, selfTime } from '../../game/rotations/apl';
import { ROGUE_COMBAT } from '../../game/rotations/rogue';
import { racialsForRace } from '../../game/rotations/racialCooldowns';
import { withoutUnselectedConsumables } from '../../game/rotations/consumableCooldowns';

/**
 * The Rogue presets' optimised Multi Target lists (round 78), keyed by preset
 * id. A preset with no entry runs its Single Target list on several targets.
 *
 * ==============================================================================
 * ONE ENTRY OF SIX, AND THE OTHER FIVE ARE ABSENT ON PURPOSE.
 *
 * BLADE FLURRY IS THE ROGUE'S ONLY AREA EFFECT, and it copies each landed melee
 * hit onto ONE other enemy -- so a Rogue's 3-, 5- and 8-target figures are its
 * two-target figures, which is why t3 and t5 read identically in the full
 * report. It is tier 20 of Combat, so only the two Combat-tree builds reach it:
 * a 31-point Assassination or Subtlety capstone plus 21 Combat points is 52.
 * Venom, Rupture, Hemo Dagger and Pure Hemo have NO multi-target lever in a
 * list at all, and their Single Target list is their best Multi Target list.
 *
 * COMBAT MUT HAS NOTHING TO CHANGE EITHER. Its Blade Flurry is pre-cast at the
 * pull and on a two-minute cooldown, so in a 60s or 30s fight the list entry
 * never fires again; every multi-only edit tried on it (Eviscerate at 2/4/5
 * points, Cold Blood only under Blade Flurry, Blade Flurry above Slice and
 * Dice, the potion under Blade Flurry, Slice and Dice at 2) was noise, a loss
 * or bit-identical. Figures in `tools/optimise/rogueVariants.ts`.
 * ==============================================================================
 */

/**
 * COMBAT: THE OWNER'S SINGLE TARGET LIST WITH SLICE AND DICE AT ONE POINT.
 *
 * ------------------------------------------------------------------------------
 * Slice and Dice is swing speed, and under Blade Flurry every landed swing is
 * copied -- so keeping it up is worth more than on one target, and the owner's
 * three-point gate (right for one target) lets it drop for too long. Paired,
 * over 600 fights: +17.22 +/- 9.65 at 3 and at 5 targets (60s) and +21.69 +/-
 * 16.24 at 8 targets (30s); at two points +15.77 and +10.85. The Single Target
 * list keeps the owner's three, where one point measures +4.46 +/- 6.19.
 *
 * DERIVED FROM `ROGUE_COMBAT` RATHER THAN COPIED, so a change the owner makes to
 * the Single Target list reaches this one too. Narrowed by race and consumable
 * selection exactly as `stockListFor` narrows the stored Single Target list --
 * a custom list is never re-derived, so it has to be built narrowed. The race
 * and the two selections are the preset's; `presets.test.ts`-style drift is
 * guarded by `tests/profiles/rogueMultiTarget.test.ts`.
 * ------------------------------------------------------------------------------
 */
const COMBAT_MULTI_SLICE_AND_DICE_POINTS = 1;

const combatMultiEntries: readonly AplEntry[] = withoutUnselectedConsumables(
  racialsForRace(
    {
      ...ROGUE_COMBAT,
      entries: ROGUE_COMBAT.entries.map((entry) =>
        entry.abilityId === 'slice_and_dice'
          ? {
              ...entry,
              condition: all(
                selfTime('atMost', 0, 'slice_and_dice'),
                comboPoints('atLeast', COMBAT_MULTI_SLICE_AND_DICE_POINTS),
              ),
            }
          : entry,
      ),
    },
    'gnome',
    'rogue',
  ),
  'rogue',
  { potion: 'major_frenzy_potion', other: 'thistle_tea' },
).entries;

export const ROGUE_MULTI_TARGET: MultiTargetDefaults = {
  rogue_combat: {
    name: 'Rogue (Combat, Multi Target)',
    entries: combatMultiEntries,
  },
};
