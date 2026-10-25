import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  abilityChoicesFor,
  AplEntries,
  AplPanel,
  aplNamesFor,
} from '../../src/ui/panels/AplPanel';
import { duplicateEntry, setAbility } from '../../src/ui/panels/aplEditing';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { serializeProfile } from '../../src/profiles/serialization';
import type { AplEntry } from '../../src/game/rotations/apl';

/*
 * ============================================================================
 * THE TWO EDITS THAT MAKE A LIST CHEAP TO EXPERIMENT ON.
 *
 * Both are the owner's asks and both answer the same complaint from different
 * sides: the EXPENSIVE part of an entry is its condition, and before these
 * two, trying "the same rule one stack lower" or "the same rule on the other
 * strike" meant deleting a line, adding a new one at the bottom, rebuilding
 * the condition from dropdowns and walking it back up.
 *
 * THE FUNCTIONS ARE TESTED RATHER THAN THE CLICKS, which is `aplEditing.ts`'s
 * own argument: an edit that drops a condition or reorders a list is a bug a
 * render test cannot see, and one somebody would meet as a rotation quietly
 * doing something else.
 * ============================================================================
 */

const arms = () => PRESETS_BY_ID.get('two_hand_arms')!.build();

/** A line with every optional field set, so nothing can be dropped silently. */
const FULL: AplEntry = {
  abilityId: 'mortal_strike',
  condition: { kind: 'resource', resource: 'rage', compare: 'atLeast', amount: 30 },
  note: 'measured at +12.5',
  interruptsChannel: true,
  disabled: true,
};

describe('duplicating an entry', () => {
  it('puts the copy directly below the original', () => {
    const entries: readonly AplEntry[] = [
      { abilityId: 'a' },
      { abilityId: 'b' },
      { abilityId: 'c' },
    ];
    expect(duplicateEntry(entries, 1).map((entry) => entry.abilityId)).toEqual([
      'a',
      'b',
      'b',
      'c',
    ]);
  });

  it('copies every field, which is the whole point of the control', () => {
    /*
     * A COPY THAT LOST THE CONDITION would be the "add an ability" dropdown
     * with extra steps, and would lose it SILENTLY -- an entry with no
     * condition is an unconditional floor under everything below it, so the
     * failure is not a missing line but a list that quietly stops reaching
     * most of itself.
     */
    const [, copy] = duplicateEntry([FULL], 0);
    expect(copy).toEqual(FULL);
    expect(copy).not.toBe(FULL);
  });

  it('is a no-op out of range, and never wraps', () => {
    const entries: readonly AplEntry[] = [{ abilityId: 'a' }];
    expect(duplicateEntry(entries, -1)).toBe(entries);
    expect(duplicateEntry(entries, 5)).toBe(entries);
  });

  it('cannot change what the list does until somebody edits the copy', () => {
    /*
     * ==========================================================================
     * THE CONTAINMENT ARGUMENT, ASSERTED RATHER THAN STATED.
     *
     * Every other insertion in `aplEditing.ts` goes at the BOTTOM, because an
     * unconditional entry anywhere else is a floor under everything beneath
     * it. A copy placed immediately under its own original is the exception:
     * the original is checked FIRST and the two are byte-identical, so
     * whenever the copy would be castable the original already was.
     *
     * What this pins is the "byte-identical" half -- the part a future change
     * could break -- by round-tripping both rows through the serialiser the
     * profile is saved with.
     * ==========================================================================
     */
    const profile = arms();
    const duplicated = duplicateEntry(profile.rotation.entries, 7);
    const asJson = (entry: AplEntry) => JSON.stringify(entry);
    expect(asJson(duplicated[7])).toBe(asJson(duplicated[8]));
    expect(duplicated).toHaveLength(profile.rotation.entries.length + 1);
  });
});

describe('changing which ability an entry casts', () => {
  it('keeps the condition, the note and the flags', () => {
    /*
     * THE CONDITION IS KEPT RATHER THAN CLEARED, and that is the decision:
     * the condition is the expensive part, which is the whole reason this
     * control exists instead of "delete and re-add".
     */
    const [changed] = setAbility([FULL], 0, 'slam');
    expect(changed).toEqual({ ...FULL, abilityId: 'slam' });
  });

  it('refuses an empty id rather than emptying the entry', () => {
    // The dropdown has to be able to hold a "(choose)" state without that
    // selection blanking a line. `addEntry` already follows this rule.
    const entries: readonly AplEntry[] = [FULL];
    expect(setAbility(entries, 0, '')).toBe(entries);
    expect(setAbility(entries, 3, 'slam')).toBe(entries);
  });

  it('leaves every other entry untouched, by identity', () => {
    const entries: readonly AplEntry[] = [{ abilityId: 'a' }, { abilityId: 'b' }];
    const next = setAbility(entries, 0, 'c');
    expect(next[1]).toBe(entries[1]);
  });

  it('produces a list a saved profile can still carry', () => {
    /*
     * A STORED LIST IS WRITTEN OUT IN FULL, so an edit that produced a shape
     * the serialiser cannot hold would be found when somebody pressed Save --
     * which is the worst place to find out.
     */
    const profile = arms();
    const edited = {
      ...profile,
      rotation: {
        ...profile.rotation,
        source: 'custom' as const,
        entries: setAbility(duplicateEntry(profile.rotation.entries, 12), 13, 'heroic_strike'),
      },
    };
    const text = serializeProfile(edited);
    expect(JSON.parse(text).rotation.entries).toHaveLength(profile.rotation.entries.length + 1);
  });
});

describe('the panel offers both', () => {
  /*
   * `renderToStaticMarkup` AND `createElement`, the arrangement every UI test
   * here uses -- jsdom is not a dependency and the test glob is `.ts` only.
   *
   * THE ENTRIES AND NOT THE PANEL for anything inside the body: `Panel` is
   * collapsible and starts SHUT, so going through `AplPanel` renders a title
   * bar and nothing else, and every "contains" check would pass by containing
   * nothing. `gearPanelStone.test.ts` learned that from a failing test.
   */
  const renderEditable = (presetId: string) => {
    const profile = PRESETS_BY_ID.get(presetId)!.build();
    const { names, nameOf } = aplNamesFor(profile);
    return renderToStaticMarkup(
      createElement(AplEntries, {
        list: profile.rotation,
        names,
        nameOf,
        abilities: abilityChoicesFor(profile),
        onChange: () => undefined,
      }),
    );
  };

  it('draws a duplicate button on every row', () => {
    const markup = renderEditable('two_hand_arms');
    const rows = PRESETS_BY_ID.get('two_hand_arms')!.build().rotation.entries.length;
    expect([...markup.matchAll(/class="apl-duplicate"/g)]).toHaveLength(rows);
  });

  it('draws the ability as a dropdown that offers the build’s own book', () => {
    const profile = PRESETS_BY_ID.get('two_hand_arms')!.build();
    const markup = renderEditable('two_hand_arms');
    expect(markup).toContain('apl-ability-choice');
    // Every ability the character knows is selectable, so an entry can be
    // pointed anywhere without going through delete-and-re-add.
    for (const ability of abilityChoicesFor(profile)) {
      expect(markup, ability.name).toContain(`value="${ability.id}"`);
    }
  });

  it('keeps an entry naming an ability this build cannot cast', () => {
    /*
     * ==========================================================================
     * `AuraChoice`'S RULE, AND IT MATTERS MORE HERE.
     *
     * Falling back to whichever name sorts first would rewrite the entry the
     * moment the panel DREW it -- an edit nobody made, to a list nobody
     * touched, with nothing on screen to say so.
     *
     * It is not hypothetical: every stock list names all four free racial
     * cooldowns and a character learns one race's, so three entries in any
     * list are abilities the build does not have. They are dropped from the
     * stored list by `withoutOtherRacials`, which is why this is asserted on a
     * list built by hand rather than on a preset.
     * ==========================================================================
     */
    const profile = PRESETS_BY_ID.get('two_hand_arms')!.build();
    const { names, nameOf } = aplNamesFor(profile);
    const markup = renderToStaticMarkup(
      createElement(AplEntries, {
        list: { name: 'test', entries: [{ abilityId: 'a_spell_from_another_class' }] },
        names,
        nameOf,
        abilities: abilityChoicesFor(profile),
        onChange: () => undefined,
      }),
    );
    expect(markup).toContain('value="a_spell_from_another_class"');
    expect(markup).toContain('not in this build');
  });

  it('shows a plain name when the list is read-only', () => {
    // No `onChange` is how a result page or a test renders a list it is not
    // offering to edit, and a dropdown there would be a control that does
    // nothing.
    const profile = PRESETS_BY_ID.get('two_hand_arms')!.build();
    const { names, nameOf } = aplNamesFor(profile);
    const markup = renderToStaticMarkup(
      createElement(AplEntries, { list: profile.rotation, names, nameOf }),
    );
    expect(markup).toContain('class="apl-ability"');
    expect(markup).not.toContain('apl-ability-choice');
    expect(markup).not.toContain('apl-duplicate');
  });

  it('still names the list in the badge', () => {
    // The panel's header renders while the body is shut, which is what this
    // one is for -- the cheapest guard against a build running another spec's
    // list.
    const markup = renderToStaticMarkup(
      createElement(AplPanel, { profile: arms(), section: 'single', onChange: () => undefined }),
    );
    expect(markup).toContain('Warrior (Two-Hander, Battle)');
  });
});
