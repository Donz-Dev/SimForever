import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AplEntries, aplNamesFor } from '../../src/ui/panels/AplPanel';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { appliesDot } from '../../src/game/abilities/dots';

/*
 * MULTI-DOT IS OFFERED ONLY ON AN ABILITY THAT HAS A DoT (round 67), the
 * owner's: "if an ability doesn't have a DoT effect then it should not have the
 * multi-dot GUI element". Counted per entry against the Multi Target list,
 * which is the section that offers it.
 */
function multiDotControls(presetId: string): { readonly shown: number; readonly dots: number } {
  /*
   * THE ENTRIES, NOT THE PANEL: `AplPanel` starts shut and a static render of
   * it has no body, so "no Multi-DoT anywhere" would pass by rendering nothing
   * -- which the first draft of this test did.
   */
  const profile = PRESETS_BY_ID.get(presetId)!.build();
  const list = profile.multiTarget!.rotation;
  const { names, nameOf } = aplNamesFor(profile);
  const markup = renderToStaticMarkup(
    createElement(AplEntries, { list, names, nameOf, multiTarget: true, onChange: () => undefined }),
  );
  return {
    shown: markup.split('aria-label="Multi-DoT targets"').length - 1,
    dots: list.entries.filter(
      (entry) => !entry.target && (appliesDot(entry.abilityId) || entry.multiDot !== undefined),
    ).length,
  };
}

describe('Multi-DoT in the APL panel', () => {
  it('is on no entry of an Arcane Mage list, which casts no DoT', () => {
    const profile = PRESETS_BY_ID.get('mage_arcane')!.build();
    expect(profile.multiTarget!.rotation.entries.length).toBeGreaterThan(0);
    expect(multiDotControls('mage_arcane')).toEqual({ shown: 0, dots: 0 });
  });

  it('is on exactly the DoT entries of a Warlock list', () => {
    const { shown, dots } = multiDotControls('warlock_smds');
    expect(dots).toBeGreaterThan(0);
    expect(shown).toBe(dots);
  });
});
