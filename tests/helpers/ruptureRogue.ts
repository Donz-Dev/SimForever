import type { CharacterProfile } from '../../src/profiles';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { syncDefaultRotation } from '../../src/profiles/rotation';

/*
 * THE RUPTURE PRESET IS GONE (round 82) AND ITS BUILD IS STILL THE ONLY ONE
 * THAT TAKES CUTTHROAT, so the tests that used it as a fixture for Cutthroat,
 * Ambush, Vanish and the Rupture list rebuild it here: the Hemo Dagger preset,
 * which the old preset's own comment says matched it in every field but the
 * talents, with the Rupture talents put back and its stock list re-derived.
 *
 * Transcribed from `git show origin/main:src/profiles/presets.ts` as it stood
 * before the removal -- 12 / 8 / 31.
 */
export const RUPTURE_TALENTS: Readonly<Record<string, number>> = {
  malice: 5,
  ruthlessness: 3,
  relentless_strikes: 1,
  improved_slice_and_dice: 3,
  improved_eviscerate: 3,
  lightning_reflexes: 2,
  puncturing_wounds: 3,
  camouflage: 5,
  master_of_deception: 3,
  opportunity: 2,
  improved_ambush: 3,
  initiative: 3,
  ghostly_strike: 1,
  improved_distract: 2,
  premeditation: 1,
  serrated_blades: 3,
  preparation: 1,
  hemorrhage: 1,
  cutthroat: 5,
  thousand_cuts: 1,
};

export function ruptureRogueProfile(): CharacterProfile {
  const hemo = PRESETS_BY_ID.get('rogue_hemo')!.build();
  return syncDefaultRotation({
    ...hemo,
    character: { ...hemo.character, name: 'Rupture' },
    talents: { ...RUPTURE_TALENTS },
    rotation: { ...hemo.rotation, source: 'default' },
    // The old preset's one consumable difference from Hemo Dagger.
    consumables: { ...hemo.consumables, food: 'food_agility' },
  } as CharacterProfile);
}
