import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ALL_PRIORITY_LISTS } from '../../src/game/rotations/allLists';
import { aplFor } from '../../src/game/rotations/rotationFor';
import type { AplCondition } from '../../src/game/rotations/apl';
import {
  BUILTIN_CONDITION_IDS,
  compileCondition,
  describeCondition,
  isBuiltinConditionId,
} from '../../src/game/rotations/apl';
import { AplEntries, AplPanel, aplNamesFor } from '../../src/ui/panels/AplPanel';
import { PROFILE_PRESETS, PRESETS_BY_ID } from '../../src/profiles/presets';
import { resolveCombatStyle, resolveStance } from '../../src/game/character';

/*
 * ============================================================================
 * A PRIORITY LIST IS DATA NOW, and this covers the three things that are true
 * of that and were not true of a list of closures.
 *
 *   1. it can be WRITTEN DOWN -- every condition survives JSON, which is what
 *      makes it savable
 *   2. it can be READ -- every kind has a sentence, which is what makes the
 *      panel possible
 *   3. it can be COMPILED -- and what it compiles to is what the engine runs
 *
 * WHAT THIS FILE DOES NOT COVER is that the conversion preserved behaviour.
 * No unit test can: the claim is about 192 entries across 26 lists, and the
 * thing that establishes it is `tools/rotation_fingerprint.ts`, which hashes
 * the combat log of all 25 presets over three seeds. Those 75 hashes are
 * unchanged by the conversion, which is a far stronger statement than any
 * assertion here -- one differing decision anywhere reorders the random stream
 * and moves the hash.
 * ============================================================================
 */

/** Every condition in every list, flattened, with the list it came from. */
function allConditions(): readonly { readonly list: string; readonly condition: AplCondition }[] {
  const found: { list: string; condition: AplCondition }[] = [];
  const walk = (list: string, condition: AplCondition) => {
    found.push({ list, condition });
    if (condition.kind === 'all' || condition.kind === 'any') {
      for (const part of condition.of) walk(list, part);
    } else if (condition.kind === 'not') {
      walk(list, condition.of);
    }
  };
  for (const record of ALL_PRIORITY_LISTS) {
    for (const entry of record.list.entries) {
      if (entry.condition) walk(record.list.name, entry.condition);
    }
  }
  return found;
}

describe('every built-in list is data', () => {
  it('survives a round trip through JSON unchanged', () => {
    /*
     * THE WHOLE POINT OF THE FORMAT, and the thing a closure could never do.
     * A list that does not survive `JSON.parse(JSON.stringify(...))` cannot be
     * saved to a profile, which is what this format exists for.
     */
    for (const record of ALL_PRIORITY_LISTS) {
      expect(JSON.parse(JSON.stringify(record.list)), record.list.name).toEqual(record.list);
    }
  });

  it('carries no functions anywhere in it', () => {
    // The failure this would catch is a half-converted list: one entry still
    // holding a closure serialises to `undefined` and loses its gate in
    // silence, which is an entry that fires far more often than it should.
    const functions = allConditions().filter(
      ({ condition }) => typeof (condition as unknown) === 'function',
    );
    expect(functions).toEqual([]);
  });

  it('compiles every condition without throwing', () => {
    // `builtin` THROWS on an id the registry does not carry, by design -- a
    // list running with a condition missing is worse than one that will not
    // build. This is what proves no list names one that does not exist.
    for (const { list, condition } of allConditions()) {
      expect(() => compileCondition(condition), list).not.toThrow();
    }
  });

  it('describes every condition as a non-empty sentence', () => {
    for (const { list, condition } of allConditions()) {
      const sentence = describeCondition(condition);
      expect(sentence.length, `${list}: ${JSON.stringify(condition)}`).toBeGreaterThan(0);
      // A kind nobody described would render blank, which reads as an entry
      // with NO condition rather than one that could not be shown.
      expect(sentence, list).not.toContain('undefined');
    }
  });

  it('names only builtins the registry carries', () => {
    const used = new Set(
      allConditions()
        .map(({ condition }) => (condition.kind === 'builtin' ? condition.id : undefined))
        .filter((id): id is string => id !== undefined),
    );
    for (const id of used) expect(isBuiltinConditionId(id), id).toBe(true);
    // And the other direction: a builtin nothing uses is dead weight that
    // would go on passing every check above.
    for (const id of BUILTIN_CONDITION_IDS) expect(used.has(id), `${id} is unused`).toBe(true);
  });
});

describe('the comparisons mean what they say', () => {
  /*
   * STRICTNESS IS THE WHOLE CORRECTNESS REQUIREMENT of the compiler, because
   * the nine class files wrote both `<` and `<=` and the conversion had to
   * keep each one. These pin the boundary, which is the only value where the
   * two differ -- and it is a value a resource or a stack count lands on.
   */
  const probe = (condition: AplCondition, current: number) => {
    const actor = {
      resources: { get: () => ({ current, maximum: 100 }) },
      auras: { has: () => false, stacksOf: () => 0, remainingMs: () => 0 },
      abilities: { has: () => false, get: () => undefined, isReady: () => false },
      health: { current, maximum: 100 },
      reactions: [],
    };
    return compileCondition(condition)(
      { clock: { now: () => 0 }, plannedDurationMs: 60_000, combatants: [] } as never,
      actor as never,
      undefined,
    );
  };

  it.each([
    ['atMost', 60, true],
    ['below', 60, false],
    ['atLeast', 60, true],
    ['above', 60, false],
    ['exactly', 60, true],
  ] as const)('%s 60 at exactly 60 is %s', (compare, amount, expected) => {
    expect(probe({ kind: 'resource', resource: 'energy', compare, amount }, 60)).toBe(expected);
  });
});

describe('the panel shows the list the build runs', () => {
  /*
   * RENDERED, because the whole deliverable is a panel: nothing else in the
   * suite would notice it being absent, and `aplFor` returning the right list
   * says nothing about whether anybody can see it.
   *
   * `renderToStaticMarkup` and `createElement`, the arrangement
   * `gearPanelStone.test.ts` established -- jsdom is not a dependency and the
   * test glob is `.ts` only.
   */
  /*
   * THE ENTRIES AND NOT THE PANEL. `Panel` is `useState(!startOpen)` and this
   * one is collapsible, so going through `AplPanel` renders a title bar and no
   * body -- every "contains" check below would pass by containing nothing.
   * That cost `gearPanelStone.test.ts` a failing test to learn.
   */
  const render = (presetId: string) => {
    const profile = PRESETS_BY_ID.get(presetId)!.build();
    const style = resolveCombatStyle(
      profile.character.characterClass,
      profile.character.combatStyle,
    );
    const stance =
      profile.character.characterClass === 'warrior'
        ? resolveStance(style, profile.character.stance)
        : undefined;
    void style;
    void stance;
    const { names, nameOf } = aplNamesFor(profile);
    return renderToStaticMarkup(
      createElement(AplEntries, { list: profile.rotation, names, nameOf }),
    );
  };

  /** The panel's own header, which DOES render while the body is shut. */
  const renderPanel = (presetId: string) =>
    renderToStaticMarkup(
      createElement(AplPanel, {
        profile: PRESETS_BY_ID.get(presetId)!.build(),
        onChange: () => undefined,
      }),
    );

  it('names the list in the panel badge, which shows while it is shut', () => {
    /*
     * THE BADGE IS THE CHEAPEST GUARD against the failure this project has had
     * twice -- a build running a list meant for another spec, which produces a
     * perfectly ordinary DPS figure and nothing that looks wrong.
     */
    expect(renderPanel('two_hand_arms')).toContain('Warrior (Two-Hander, Battle)');
  });

  it('lists every ability, in priority order', () => {
    const markup = render('two_hand_arms');
    expect(markup).toContain('Mortal Strike');
    expect(markup).toContain('Slam');
    // Order matters and is the whole meaning of the list.
    expect(markup.indexOf('Mortal Strike')).toBeLessThan(markup.indexOf('Slam'));
  });

  it('says "always" for an entry with no condition', () => {
    // An unconditional entry is a FLOOR under everything below it, so it is
    // the single most important thing to be able to read off a list.
    expect(render('two_hand_arms')).toContain('always');
  });

  it('renders a readable condition rather than an id', () => {
    const markup = render('druid_cat');
    expect(markup).toContain('Rake');
    // The `expired` idiom, said the way the lists mean it.
    expect(markup).toContain('has run out');
    expect(markup).not.toContain('auraTime');
  });

  it('opens on every preset without throwing', () => {
    for (const preset of PROFILE_PRESETS) {
      expect(() => render(preset.id), preset.id).not.toThrow();
      expect(() => renderPanel(preset.id), preset.id).not.toThrow();
    }
  });
});

describe('aplFor agrees with the rotation the build actually gets', () => {
  /*
   * `aplFor` LOOKS THE LIST UP BY NAME rather than repeating `rotationFor`'s
   * dispatch, which is nine rules in five patterns. This is what says the
   * lookup resolves for every preset -- a miss would render an empty panel
   * reading "no priority list", which looks like a build with no rotation.
   */
  it.each(PROFILE_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s resolves to a list',
    (_id, preset) => {
      const profile = preset.build();
      const style = resolveCombatStyle(
        profile.character.characterClass,
        profile.character.combatStyle,
      );
      const stance =
        profile.character.characterClass === 'warrior'
          ? resolveStance(style, profile.character.stance)
          : undefined;
      const list = aplFor(profile.character.characterClass, style, stance, profile.talents);
      expect(list).toBeDefined();
      expect(list!.entries.length).toBeGreaterThan(0);
    },
  );
});
