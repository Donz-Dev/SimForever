import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsumableRow } from '../../src/ui/panels/ConsumablesPanel';
import { CONSUMABLE_CATEGORIES_BY_ID } from '../../src/game/buffs/consumables';
import type { ClassId } from '../../src/game/character';

/*
 * ============================================================================
 * THE TWO MID-FIGHT DROPDOWNS, AND WHO IS OFFERED WHAT.
 *
 * The owner asked for these to "be added as a dropdown on the consumable
 * panel", so the control IS the deliverable -- and nothing else in the suite
 * would notice if a row were absent or if a Mage were offered a Mighty Rage
 * Potion. `gearPanelStone.test.ts` is the precedent and its reasoning carries
 * over whole:
 *
 * `renderToStaticMarkup` RATHER THAN A DOM, because jsdom is not a dependency
 * and the `include` glob matches `tests/**\/*.test.ts` only -- so a component
 * test in `.tsx` would need a new package and a change to a config every other
 * session shares. Server rendering is pure Node and answers the question being
 * asked: is the control there, with the right options.
 *
 * `ConsumableRow` AND NOT `ConsumablesPanel`, which that file learned from a
 * failing test: `Panel` starts SHUT when it is collapsible and renders no body
 * at all in a static render, so going through the panel asserts nothing by
 * containing nothing.
 *
 * WHAT IT DOES NOT COVER, said plainly: the `onChange` wiring, which needs real
 * events. `midFightConsumables.test.ts` covers it from the other end -- that
 * selecting a potion puts the ability in the book and the entry in the list --
 * so the control exists and the field it writes is load-bearing.
 * ============================================================================
 */

const render = (categoryId: string, characterClass: ClassId, chosenId = '') =>
  renderToStaticMarkup(
    createElement(ConsumableRow, {
      category: CONSUMABLE_CATEGORIES_BY_ID.get(categoryId)!,
      characterClass,
      chosenId,
      onSelect: () => {},
    }),
  );

describe('the Potion row', () => {
  it('offers all six to a Warrior, who may drink all six', () => {
    const html = render('potion', 'warrior');
    expect(html).toContain('Potion');
    expect(html).toContain('value=""');
    for (const id of [
      'major_healing_potion',
      'major_mana_potion',
      'mighty_rage_potion',
      'major_frenzy_potion',
      'major_menders_potion',
      'major_spellblasting_potion',
    ]) {
      expect(html, id).toContain(`value="${id}"`);
    }
  });

  it('does not offer the Mighty Rage Potion to a Mage', () => {
    /*
     * THE OWNER'S TABLE SAYS "(Warrior, Druid)" and the panel is where that is
     * enforced for a person. The gate that matters for CORRECTNESS is
     * `consumableAbilities`, which refuses the ability to a Mage carrying a
     * hand-edited one and is tested there; this one is what stops anybody
     * choosing it in the first place.
     */
    const html = render('potion', 'mage');
    expect(html).not.toContain('value="mighty_rage_potion"');
    // And the five it may drink are all still there, so the gate is on the one
    // entry rather than on the row.
    expect(html).toContain('value="major_mana_potion"');
    expect(html).toContain('value="major_spellblasting_potion"');
  });
});

describe('the Other row', () => {
  it('offers Thistle Tea to a Rogue and a Druid and to nobody else', () => {
    expect(render('other', 'rogue')).toContain('value="thistle_tea"');
    expect(render('other', 'druid')).toContain('value="thistle_tea"');
    for (const characterClass of ['warrior', 'mage', 'hunter', 'priest'] as const) {
      expect(render('other', characterClass), characterClass).not.toContain(
        'value="thistle_tea"',
      );
    }
  });

  it('offers the Rune and the Healthstone to everybody', () => {
    for (const characterClass of ['warrior', 'rogue', 'mage', 'druid'] as const) {
      const html = render('other', characterClass);
      expect(html, characterClass).toContain('value="demonic_rune"');
      expect(html, characterClass).toContain('value="healthstone"');
    }
  });
});

describe('a selection the class may no longer have', () => {
  it('is still shown, labelled, rather than silently reading as None', () => {
    /*
     * ==========================================================================
     * A WARRIOR WITH A MIGHTY RAGE POTION, MADE INTO A MAGE. The ability is
     * already gone -- `consumableAbilities` gates on the class -- and the
     * SELECTION is still in the profile, so a dropdown showing "None" would
     * claim nothing was chosen while the saved file says otherwise.
     *
     * This is the aura dropdown's own rule: "an id the catalog does not know is
     * kept as its own option rather than falling back to the first entry, so a
     * hand-edited file is never silently rewritten." Reselecting or clearing is
     * then a visible act rather than something that happened while nobody was
     * looking.
     * ==========================================================================
     */
    const html = render('potion', 'mage', 'mighty_rage_potion');
    expect(html).toContain('value="mighty_rage_potion"');
    expect(html).toContain('not for this class');
  });

  it('says nothing extra when the class may have it', () => {
    // The mirror assertion: a legal choice must not be labelled.
    const html = render('potion', 'warrior', 'mighty_rage_potion');
    expect(html).not.toContain('not for this class');
  });
});
