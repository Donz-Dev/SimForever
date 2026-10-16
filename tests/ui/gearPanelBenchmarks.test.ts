import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GearPanel } from '../../src/ui/panels/GearPanel';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { BENCHMARK_SETS } from '../../src/game/items/benchmarkSets';

/*
 * ============================================================================
 * THE BUTTONS ARE THE DELIVERABLE, so something has to assert they are there.
 *
 * `renderToStaticMarkup` rather than a DOM, following `gearPanelStone.test.ts`:
 * jsdom is not a dependency here and `include` matches `tests/**\/*.test.ts`
 * only, so server rendering is what answers "is the control present" without a
 * new package and a shared config change.
 *
 * IT CANNOT PRESS THEM. A static render shows the markup and not the click, so
 * what the button DOES is covered by `benchmarkGear.test.ts` driving
 * `benchmarkEquipmentForName` directly. This file covers the half that one
 * cannot: that the panel offers them at all, and only where a template exists.
 * ============================================================================
 */
const render = (presetId: string) =>
  renderToStaticMarkup(
    createElement(GearPanel, {
      profile: PRESETS_BY_ID.get(presetId)!.build(),
      onChange: () => {},
    }),
  );

describe('the Gear panel offers the benchmark sets', () => {
  it('shows all four buttons on a preset build', () => {
    const markup = render('two_hand_arms');
    for (const set of BENCHMARK_SETS) {
      expect(markup).toContain(`>${set.id}<`);
    }
  });

  it('shows them for every one of the 28 presets', () => {
    for (const [id] of PRESETS_BY_ID) {
      const markup = render(id);
      const missing = BENCHMARK_SETS.filter((set) => !markup.includes(`>${set.id}<`));
      expect(`${id}: ${missing.map((s) => s.id).join(',')}`).toBe(`${id}: `);
    }
  });

  it('keeps Clear, and the starting set beside them', () => {
    /*
     * The owner asked for the four buttons "instead of where it says Starting
     * Set & Clear". Both are kept: Clear is a different job, and the starting
     * set is the REAL gear a preset ships with -- the thing every published
     * figure was measured on, and the only way back to it.
     */
    const markup = render('two_hand_arms');
    expect(markup).toContain('>Clear<');
    expect(markup).toContain('>Starting set<');
  });

  it('names the hit target in the tooltip, because that is what the set targets', () => {
    expect(render('rogue_venom')).toContain('120 hit rating');
    /*
     * 40 AND IT READ 30 FOR A RELEASE. The Cat's template was raised by 10
     * rating with the other four TAUREN rows, because Tauren Endurance's hit
     * clause became crit damage and the owner's templates had been crediting
     * that 1%. The figure is read off the panel rather than the template, so
     * it is the check that the tooltip still describes the set it generates --
     * see `BENCHMARK_TEMPLATES`.
     */
    expect(render('druid_cat')).toContain('40 hit rating');
  });
});
