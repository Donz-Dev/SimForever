import { describe, expect, it } from 'vitest';
import { SCOPE_LABELS, rulingsInPlay } from '../../src/ui/panels/TalentPanel';
import type { OutOfScope, UnmodelledTalent } from '../../src/game/talents/TalentEffect';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * THE CAPTION OVER THE OUT-OF-SCOPE LIST, WHICH USED TO BE A HAND-WRITTEN COPY OF
 * A UNION.
 *
 * ----------------------------------------------------------------------------
 * It read "this simulator models no positions, no crowd control, no threat and no
 * healing throughput" for every build, and it had already gone stale: STEALTH was a
 * ruling and the sentence did not name it, so a Rogue was told its stealth talents
 * were out of scope for four reasons, none of which was the one that applied. Two
 * more rulings arrived with the Shaman and would have made it three missing.
 *
 * The fix is an exhaustive `Record<OutOfScope, string>`, so the COMPILER catches a
 * new member with no label, plus deriving the sentence from the entries actually
 * shown. What is left for a test is the derivation: that it names what is present
 * and nothing else, which no type can check.
 * ----------------------------------------------------------------------------
 */

const entry = (scope: OutOfScope | undefined): UnmodelledTalent =>
  ({ talentId: 't', name: 'T', rank: 1, text: '', reason: '', scope }) as UnmodelledTalent;

describe('the out-of-scope caption', () => {
  it('has a label for every ruling, which is what the Record type enforces', () => {
    // Asserted as well as typed, because `Record` is only checked where the object
    // literal is written and this reads it back through the union.
    const scopes: OutOfScope[] = [
      'positioning',
      'crowdControl',
      'threat',
      'healing',
      'stealth',
      'castPushback',
      'totemEntities',
    ];
    for (const scope of scopes) {
      expect(SCOPE_LABELS[scope], scope).toBeTruthy();
    }
    expect(Object.keys(SCOPE_LABELS)).toHaveLength(scopes.length);
  });

  it('names only the rulings the build actually hits', () => {
    expect(rulingsInPlay([entry('threat')])).toBe('no threat');
    expect(rulingsInPlay([entry('threat'), entry('healing')])).toBe(
      'no threat and no healing throughput',
    );
    expect(rulingsInPlay([entry('positioning'), entry('threat'), entry('stealth')])).toBe(
      'no positions or movement, no threat and no stealth and no openers',
    );
  });

  it('says nothing at all when there is nothing to say', () => {
    expect(rulingsInPlay([])).toBe('');
    expect(rulingsInPlay([entry(undefined)])).toBe('');
  });

  it('does not over-claim against a real build, which is the bug it fixes', () => {
    /*
     * THE ELEMENTAL SHAMAN IS THE WORKED CASE. Its ruled-out talents are cast
     * pushback, crowd control and positioning -- it heals nothing, stealths nothing
     * and generates no threat it would notice, so the old sentence named three
     * rulings that had nothing to do with its build and omitted the one that did.
     */
    const built = PRESETS_BY_ID.get('shaman_elemental')!.build();
    const ruled = talentBuild('shaman', built.talents).unmodelled.filter(
      (item) => item.scope !== undefined,
    );
    const sentence = rulingsInPlay(ruled);

    expect(sentence).toContain('no cast pushback');
    expect(sentence).not.toContain('healing');
    expect(sentence).not.toContain('stealth');
  });
});
