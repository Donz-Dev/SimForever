/**
 * Which preset allocations the CURRENT trees refuse, and what each one drops.
 *
 * ==============================================================================
 * A PATCH MOVES A TREE AND `legalAllocation` STRIPS WHAT NO LONGER FITS, IN
 * SILENCE -- `createPlayer` drops an illegal rank rather than refusing to build
 * the character, which is right for a typo and reads as a build that is simply
 * worse. Client build 1.60.1.70425 added talents, removed talents and moved
 * rows, and SEVEN of the 25 presets came out short: Shaman Elemental lost
 * FOURTEEN of its 51 points that way.
 *
 * `decode_talent_build.mjs --presets` answers the neighbouring question -- does
 * each preset still match its talentsforever.com URL -- and it cannot answer
 * this one, because a URL and a preset can agree with each other and both
 * disagree with the tree.
 *
 * THE CASCADE IS THE POINT RATHER THAN THE COUNT. A removed talent takes its
 * own points and then whatever its absence puts under a tier gate, so `dropped`
 * is what says which of the two happened.
 * ==============================================================================
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { legalAllocation } from '../src/game/talents/talentRules';
import { talentsForClass } from '../src/game/talents/talentData';

let bad = 0;
for (const preset of PROFILE_PRESETS) {
  const profile = preset.build();
  const tree = talentsForClass(profile.character.characterClass);
  if (!tree) throw new Error(`no talent data for ${preset.id}`);
  const asked = Object.values(profile.talents).reduce((a, b) => a + b, 0);
  const { allocation, dropped } = legalAllocation(tree, profile.talents);
  const legal = Object.values(allocation).reduce((a, b) => a + b, 0);
  if (dropped.length === 0 && legal === asked) continue;
  bad += 1;
  console.log(`${preset.id.padEnd(20)} asked ${asked}, legal ${legal}`);
  if (dropped.length > 0) console.log(`  DROPPED: ${dropped.join(', ')}`);
}
console.log(bad === 0 ? 'every preset allocation is legal' : `${bad} illegal`);
