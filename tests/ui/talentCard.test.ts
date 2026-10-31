import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TalentCard } from '../../src/ui/panels/TalentCard';
import { talentsForClass } from '../../src/game/talents/talentData';
import type { TalentAllocation } from '../../src/game/talents/Talent';

/*
 * ==============================================================================
 * THE HOVER CARD, which replaced a native `title` showing rank-one text at
 * every rank. Rendered statically -- the card itself has no portal; only the
 * `HoverCard` host does -- so each state the panel can be in is asserted on
 * the words a player reads.
 * ==============================================================================
 */

const mage = talentsForClass('mage')!;
const render = (talentId: string, allocation: TalentAllocation) =>
  renderToStaticMarkup(
    createElement(TalentCard, {
      characterClass: 'mage',
      talents: mage,
      talent: mage.byId.get(talentId)!,
      allocation,
      iconUrl: 'icon.jpg',
    }),
  );

describe('the talent card', () => {
  it('describes the rank held, says Passive and Max rank at full', () => {
    // Improved Frostbolt: a five-rank passive (Arcane Focus until 1.60.1.70707).
    const html = render('improved_frostbolt', { improved_frostbolt: 5 });
    expect(html).toContain('Improved Frostbolt');
    expect(html).toContain('Rank 5 of 5 · Passive');
    expect(html).toContain('Max rank');
    expect(html).not.toContain('Next rank');
    expect((html.match(/pip on/g) ?? []).length).toBe(5);
  });

  it('shows the next rank part-way up, and the rank-one text at zero', () => {
    const partial = render('improved_frostbolt', { improved_frostbolt: 2 });
    expect(partial).toContain('Rank 2 of 5');
    expect(partial).toContain('Next rank:');
    const none = render('improved_frostbolt', {});
    expect(none).toContain('Rank 0 of 5');
    expect(none).not.toContain('Next rank');
  });

  it('calls a talent that grants an ability Active, and lists what it still needs in red', () => {
    const html = render('combustion', {});
    expect(html).toContain('· Active');
    expect(html).toContain('is-unmet');
    expect(html).toContain('Requires 30 points in Fire');
  });
});
