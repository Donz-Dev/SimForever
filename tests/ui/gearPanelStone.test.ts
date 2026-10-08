import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoneRow } from '../../src/ui/panels/GearPanel';
import {
  WARLOCK_STONE_TOOLTIPS,
  type WarlockStoneId,
} from '../../src/game/buffs/warlockStones';

/*
 * ============================================================================
 * THE FIRST TEST IN THIS PROJECT THAT RENDERS A PANEL, and it is here because
 * the stone's whole deliverable is a control: the ruleset owner asked for "a
 * GUI element similar to rogue poisons where I can select Firestone or
 * Spellstone", and nothing else in the suite would notice if the dropdown were
 * absent. The poison row it is modelled on has no render test, which is why
 * that gap is worth not copying.
 *
 * `renderToStaticMarkup` RATHER THAN A DOM, deliberately. `vite.config.ts`
 * invites UI tests to opt into jsdom per file -- but jsdom is not a dependency
 * here and `include` matches `tests/**\/*.test.ts` only, so a `.tsx` component
 * test would need a new package AND a change to a config every other session
 * shares. Server rendering is pure Node, needs neither, and answers the
 * question actually being asked: is the control there, with the right options
 * and the right text.
 *
 * `createElement` RATHER THAN JSX for the same reason -- this file stays `.ts`
 * so the existing glob picks it up.
 *
 * IT RENDERS `StoneRow` AND NOT `GearPanel`, which took a failing test to
 * learn: `Panel` is `useState(true)`, so a collapsible panel starts SHUT and
 * renders no body in a static render. Going through the panel asserted nothing
 * -- it passed the absence checks for every class including the Rogue, whose
 * poison row certainly exists.
 *
 * TWO THINGS IT DOES NOT COVER, said plainly rather than implied:
 *   - the `onChange` wiring, which needs real events. `warlockStones.test.ts`
 *     covers it from the other end by proving the profile FIELD changes the
 *     result, so the control exists and the field it writes is load-bearing.
 *   - the CLASS GATE, which lives in `GearPanel` around this component and is
 *     behind that same collapsed panel. The gate that matters for correctness
 *     is `createPlayer`'s, which ignores a stone for a non-Warlock and IS
 *     tested; this one is cosmetic.
 * ============================================================================
 */

const render = (stone: WarlockStoneId) =>
  renderToStaticMarkup(createElement(StoneRow, { stone, onChange: () => {} }));

describe('the Warlock stone control in the Gear panel', () => {
  it('offers both stones and None to a Warlock', () => {
    const html = render('none');

    expect(html).toContain('Weapon Stone');
    // The three options, by value, which is what the profile stores.
    expect(html).toContain('value="none"');
    expect(html).toContain('value="firestone"');
    expect(html).toContain('value="spellstone"');
    expect(html).toContain('Firestone');
    expect(html).toContain('Spellstone');
    // Labelled for a screen reader, since the visible span is not a <label>.
    expect(html).toContain('aria-label="Warlock weapon stone"');
  });

  it('shows the selected stone, and prints what it buys', () => {
    /*
     * THE HINT IS THE SOURCE'S OWN WORDS, so the panel states the numbers
     * rather than leaving a player to remember them -- and asserting it against
     * the same constant the component reads means the two cannot drift into
     * disagreeing about what a Firestone does.
     */
    const html = render('firestone');
    expect(html).toContain(WARLOCK_STONE_TOOLTIPS.firestone);
    expect(html).toContain('spell critical strike chance by 2%');
    expect(html).toContain('Fire spells by up to 21');

    const other = render('spellstone');
    expect(other).toContain('spell haste by 2%');
    expect(other).toContain('Shadow spells by up to 21');
  });

  it('shows the current selection rather than defaulting the control', () => {
    // The select is controlled by the profile's value, so a stone that round
    // trips through the panel comes back selected rather than reset.
    expect(render('spellstone')).toContain('value="spellstone"');
    expect(render('none')).toContain(WARLOCK_STONE_TOOLTIPS.none);
  });
});
