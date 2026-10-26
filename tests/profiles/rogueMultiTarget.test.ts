import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles';
import { sectionOf } from '../../src/profiles/aplSections';
import { ROGUE_MULTI_TARGET } from '../../src/profiles/multiTarget/rogue';

/*
 * ROUND 78's ROGUE MULTI TARGET LISTS.
 *
 * The Combat preset's list is DERIVED from its Single Target stock list, and
 * narrowed by a race and two consumable selections written into
 * `multiTarget/rogue.ts` by hand -- so the thing that can drift is that copy
 * of the preset's race and selections. This compares the stored Multi Target
 * list against the stored Single Target list entry for entry: the only
 * difference allowed is the Slice and Dice gate.
 */
describe('the Rogue Multi Target defaults', () => {
  it('give Combat its Single Target list with Slice and Dice at one point', () => {
    const profile = PRESETS_BY_ID.get('rogue_combat')!.build();
    const single = profile.rotation.entries;
    const multi = sectionOf(profile, 'multi').rotation.entries;

    expect(multi.map((e) => [e.abilityId, e.disabled ?? false])).toEqual(
      single.map((e) => [e.abilityId, e.disabled ?? false]),
    );
    multi.forEach((entry, i) => {
      if (entry.abilityId === 'slice_and_dice') {
        expect(JSON.stringify(entry.condition)).toContain('"points":1');
        expect(JSON.stringify(single[i].condition)).toContain('"points":3');
      } else {
        expect(entry).toEqual(single[i]);
      }
    });
  });

  it('give no other Rogue preset a list of its own, because none reaches an area effect', () => {
    expect(Object.keys(ROGUE_MULTI_TARGET)).toEqual(['rogue_combat']);
  });
});
