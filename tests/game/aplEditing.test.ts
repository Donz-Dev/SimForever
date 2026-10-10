import { describe, expect, it } from 'vitest';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import type { GroupNode } from '../../src/ui/panels/aplEditing';
import { compileCondition } from '../../src/game/rotations/apl';
import {
  addEntry,
  appendTo,
  blankClauseNode,
  blankGroup,
  conditionOf,
  moveEntry,
  nodeAt,
  removeAt,
  removeEntry,
  replaceAt,
  rootOf,
  setCondition,
  setGroupOp,
  toggleNegated,
} from '../../src/ui/panels/aplEditing';
import { ALL_PRIORITY_LISTS } from '../../src/game/rotations/allLists';
import {
  CURRENT_PROFILE_VERSION,
  createDefaultProfile,
  loadProfile,
  parseProfile,
  serializeProfile,
} from '../../src/profiles';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';
import {
  defaultRotationFor,
  rotationMatchesBuild,
  syncDefaultRotation,
} from '../../src/profiles/rotation';

/*
 * ============================================================================
 * EDITING A PRIORITY LIST, AND KEEPING IT ATTACHED TO THE RIGHT BUILD.
 *
 * The edits themselves are small and the ways they go wrong are not: an entry
 * that loses its condition while being reordered, a clause that round-trips
 * into a DIFFERENT condition, or a stored list that quietly stops belonging to
 * the character running it. None of those is visible on screen -- a rotation
 * doing something slightly different produces a perfectly ordinary DPS figure,
 * which is the failure this project has shipped before.
 * ============================================================================
 */

const entries: readonly AplEntry[] = [
  { abilityId: 'a' },
  { abilityId: 'b', condition: { kind: 'resource', resource: 'rage', compare: 'atLeast', amount: 30 } },
  { abilityId: 'c' },
];

describe('reordering and membership', () => {
  it('moves an entry and keeps its condition with it', () => {
    const moved = moveEntry(entries, 1, -1);
    expect(moved.map((entry) => entry.abilityId)).toEqual(['b', 'a', 'c']);
    // The condition travels. Losing it would leave an UNGATED entry near the
    // top, which is a floor under everything below it.
    expect(moved[0].condition).toEqual(entries[1].condition);
  });

  it('refuses to move past either end rather than wrapping', () => {
    /*
     * POSITION IS PRIORITY, so wrapping the first entry to the bottom on an
     * up-arrow would be the most destructive possible reading of a mis-click.
     */
    expect(moveEntry(entries, 0, -1)).toBe(entries);
    expect(moveEntry(entries, 2, 1)).toBe(entries);
  });

  it('adds at the bottom, where it cannot change what the list already does', () => {
    const added = addEntry(entries, 'd');
    expect(added.map((entry) => entry.abilityId)).toEqual(['a', 'b', 'c', 'd']);
    // An unconditional entry anywhere else is a floor: everything below it
    // would become unreachable.
    expect(added[3].condition).toBeUndefined();
  });

  it('allows the same ability twice, which two stock lists need', () => {
    // The Mage's Arcane Missiles and the Warlock's Shadow Bolt are each in
    // their list twice ON PURPOSE -- gated on a proc above, ungated below.
    expect(addEntry(entries, 'a').map((entry) => entry.abilityId)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('removes one entry and leaves the rest alone', () => {
    expect(removeEntry(entries, 1).map((entry) => entry.abilityId)).toEqual(['a', 'c']);
    expect(removeEntry(entries, 9)).toBe(entries);
  });

  it('drops the condition key entirely rather than storing undefined', () => {
    // `JSON.stringify` omits an undefined value, so a profile that stored one
    // would differ from the profile it loads back as.
    const cleared = setCondition(entries, 1, undefined);
    expect('condition' in cleared[1]).toBe(false);
  });
});

describe('a condition round-trips through the editor', () => {
  /*
   * ==========================================================================
   * THE ASSERTION THAT MATTERS, AND IT COVERS EVERY CONDITION NOW.
   *
   * A condition the panel opens has to come back as the SAME condition -- not
   * an equivalent-looking one. The failure is a person opening an entry,
   * changing nothing, and the rotation quietly behaving differently.
   *
   * IT USED TO SKIP WHAT THE EDITOR COULD NOT DRAW, which was 51 of the 132
   * conditions in the stock lists. A leaf with no controls is a `fixed` node
   * now -- kept exactly, shown as its sentence -- so there is nothing left to
   * skip and the loop asserts on all of them.
   * ==========================================================================
   */
  it('every condition in every stock list survives unchanged', () => {
    let checked = 0;
    for (const record of ALL_PRIORITY_LISTS) {
      for (const entry of record.list.entries) {
        if (!entry.condition) continue;
        expect(
          conditionOf(rootOf(entry.condition)),
          `${record.list.name}: ${entry.abilityId}`,
        ).toEqual(entry.condition);
        checked += 1;
      }
    }
    // A guard on the guard: a parser that returned an empty root for
    // everything would make the loop above assert nothing.
    expect(checked).toBeGreaterThan(120);
  });

  it('no condition is read-only as a whole any more', () => {
    /*
     * The thing this change was for. Before it, one `not` or one `any`
     * anywhere locked an entire condition -- the Rogue pooling gates, the
     * Paladin seal twist, the Mage Scorch, the Priest hold band.
     */
    for (const record of ALL_PRIORITY_LISTS) {
      for (const entry of record.list.entries) {
        if (!entry.condition) continue;
        const root = rootOf(entry.condition);
        expect(root.kind, `${record.list.name}: ${entry.abilityId}`).toBe('group');
        expect(root.children.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps a leaf it cannot draw, rather than dropping or simplifying it', () => {
    // A builtin has no controls that mean what it means.
    const condition: AplCondition = {
      kind: 'all',
      of: [
        { kind: 'resource', resource: 'rage', compare: 'atLeast', amount: 10 },
        { kind: 'builtin', id: 'charge_stance_allowed' },
      ],
    };
    const root = rootOf(condition);
    expect(root.children.map((child) => child.kind)).toEqual(['clause', 'fixed']);
    expect(conditionOf(root)).toEqual(condition);
  });

  it('reads any, not and nesting as a tree', () => {
    // The shape the Mage Scorch condition is written in: a AND (b OR c).
    const condition: AplCondition = {
      kind: 'all',
      of: [
        { kind: 'hasReaction', reactionId: 'improved_scorch' },
        {
          kind: 'any',
          of: [
            {
              kind: 'auraStacks',
              on: 'target',
              auraId: 'fire_vulnerability',
              compare: 'below',
              stacks: 5,
            },
            {
              kind: 'auraTime',
              on: 'target',
              auraId: 'fire_vulnerability',
              compare: 'atMost',
              seconds: 3,
            },
          ],
        },
      ],
    };
    const root = rootOf(condition);
    expect(root.op).toBe('all');
    expect(root.children[0].kind).toBe('fixed');
    const nested = root.children[1];
    expect(nested.kind).toBe('group');
    expect(nested.kind === 'group' && nested.op).toBe('any');
    expect(nested.kind === 'group' && nested.children.length).toBe(2);
    expect(conditionOf(root)).toEqual(condition);
  });

  it('reads a not as a flag on the node it negates', () => {
    const condition: AplCondition = {
      kind: 'not',
      of: { kind: 'aura', on: 'self', auraId: 'cutthroat', present: true },
    };
    const root = rootOf(condition);
    expect(root.children[0].negated).toBe(true);
    expect(root.children[0].kind).toBe('clause');
    expect(conditionOf(root)).toEqual(condition);
  });

  it('keeps a double negation whole rather than collapsing it', () => {
    /*
     * `not(not(x))` and `x` mean the same thing and are not the same DATA, and
     * this editor has one promise: opening a condition and changing nothing
     * leaves it byte-identical. A flag cannot hold two negations, so the whole
     * thing becomes a fixed leaf.
     */
    const condition: AplCondition = {
      kind: 'not',
      of: { kind: 'not', of: { kind: 'aura', on: 'self', auraId: 'x', present: true } },
    };
    expect(rootOf(condition).children[0].kind).toBe('fixed');
    expect(conditionOf(rootOf(condition))).toEqual(condition);
  });

  it('keeps "has run out" apart from "is not up"', () => {
    /*
     * `!auras.has(id)` and `remainingMs(id) <= 0` differ on an aura that is
     * PRESENT WITH NOTHING LEFT, and the stock lists write both -- the Shaman
     * Windfury Weapon entry is the first and five classes` `expired` helpers
     * are the second. They were one option in a first draft, and the
     * round-trip caught it.
     */
    const ranOut: AplCondition = {
      kind: 'auraTime',
      on: 'target',
      auraId: 'rip',
      compare: 'atMost',
      seconds: 0,
    };
    const notUp: AplCondition = { kind: 'aura', on: 'target', auraId: 'rip', present: false };
    expect(conditionOf(rootOf(ranOut))).toEqual(ranOut);
    expect(conditionOf(rootOf(notUp))).toEqual(notUp);
  });

  it('no clauses at all is no condition, not an empty one', () => {
    // An empty `all` is TRUE for every actor, so emitting one would turn a
    // gated entry into an unconditional floor.
    expect(conditionOf(rootOf(undefined))).toBeUndefined();
  });

  it('every blank clause compiles', () => {
    for (const kind of ['buff', 'resource', 'cooldown', 'fight', 'health'] as const) {
      const root = appendTo(rootOf(undefined), [], blankClauseNode(kind)) as GroupNode;
      const condition = conditionOf(root);
      expect(condition, kind).toBeDefined();
      expect(() => compileCondition(condition!), kind).not.toThrow();
    }
  });
});

describe('changing the tree', () => {
  const base = rootOf({
    kind: 'all',
    of: [
      { kind: 'comboPoints', compare: 'atLeast', points: 4 },
      { kind: 'aura', on: 'self', auraId: 'cutthroat', present: true },
    ],
  });

  it('negates one node without touching its siblings', () => {
    const next = toggleNegated(base, [1]) as GroupNode;
    expect(conditionOf(next)).toEqual({
      kind: 'all',
      of: [
        { kind: 'comboPoints', compare: 'atLeast', points: 4 },
        { kind: 'not', of: { kind: 'aura', on: 'self', auraId: 'cutthroat', present: true } },
      ],
    });
  });

  it('switches a group between all and any', () => {
    const next = setGroupOp(base, [], 'any') as GroupNode;
    expect(conditionOf(next)?.kind).toBe('any');
  });

  it('removes a child, and unwraps the group when one is left', () => {
    // Down to one child, `all([x])` is just `x` -- which is how the lists are
    // written, and what the entry was before a second clause was added.
    const next = removeAt(base, [1]) as GroupNode;
    expect(conditionOf(next)).toEqual({ kind: 'comboPoints', compare: 'atLeast', points: 4 });
  });

  it('appends into a NESTED group rather than the root', () => {
    const withGroup = appendTo(base, [], blankGroup('any'));
    const deep = appendTo(withGroup, [2], blankClauseNode('resource'));
    const nested = nodeAt(deep, [2]);
    expect(nested?.kind).toBe('group');
    expect(nested?.kind === 'group' && nested.children.length).toBe(1);
    // ...and the root still has its own two.
    expect(deep.kind === 'group' && deep.children.length).toBe(3);
  });

  it('replaces a clause in place', () => {
    expect(nodeAt(base, [0])?.kind).toBe('clause');
    const next = replaceAt(base, [0], {
      kind: 'clause',
      negated: false,
      clause: { kind: 'resource', resource: 'energy', compare: 'atMost', value: 50 },
    }) as GroupNode;
    expect(conditionOf(next)).toEqual({
      kind: 'all',
      of: [
        { kind: 'resource', resource: 'energy', compare: 'atMost', amount: 50 },
        { kind: 'aura', on: 'self', auraId: 'cutthroat', present: true },
      ],
    });
  });

  it('ignores a path that does not exist', () => {
    // A stale path from a render that raced an edit. Doing nothing is right;
    // writing at the wrong index would silently rewrite another condition.
    expect(removeAt(base, [9])).toBe(base);
    expect(toggleNegated(base, [9])).toBe(base);
    expect(appendTo(base, [0], blankClauseNode('buff'))).toBe(base);
  });
});

describe('a stored list stays attached to its build', () => {
  it('every preset stores the list it was already running', () => {
    for (const preset of PROFILE_PRESETS) {
      const profile = preset.build();
      expect(profile.rotation.source, preset.id).toBe('default');
      expect(profile.rotation.entries.length, preset.id).toBeGreaterThan(0);
      expect(profile.rotation, preset.id).toEqual(defaultRotationFor(profile));
    }
  });

  it('re-derives a default list when the build changes', () => {
    /*
     * THE FAILURE THIS PREVENTS IS ONE THIS PROJECT HAS SHIPPED: a Fire Mage
     * ran the Arcane list for its whole life and produced a perfectly ordinary
     * DPS figure, because nothing about a wrong rotation looks wrong.
     */
    const fire = PRESETS_BY_ID.get('mage_fire')!.build();
    const arcane = PRESETS_BY_ID.get('mage_arcane')!.build();
    expect(fire.rotation.name).not.toBe(arcane.rotation.name);

    const swapped = syncDefaultRotation({ ...fire, talents: arcane.talents });
    expect(swapped.rotation.name).toBe(arcane.rotation.name);
  });

  it('never re-derives a custom list, and says it no longer matches', () => {
    const fire = PRESETS_BY_ID.get('mage_fire')!.build();
    const arcane = PRESETS_BY_ID.get('mage_arcane')!.build();
    const edited = {
      ...fire,
      rotation: { ...fire.rotation, source: 'custom' as const, entries: [{ abilityId: 'fireball' }] },
    };

    const swapped = syncDefaultRotation({ ...edited, talents: arcane.talents });
    // Untouched -- somebody's own list is never silently replaced...
    expect(swapped.rotation).toEqual(edited.rotation);
    // ...and the panel is told to say so.
    expect(rotationMatchesBuild(swapped)).toBe(false);
    expect(rotationMatchesBuild(edited)).toBe(true);
  });

  it('leaves the profile object alone when nothing changed', () => {
    // Referential equality is what keeps React's rendering cheap, and this
    // runs on every edit the app makes.
    const profile = PRESETS_BY_ID.get('druid_cat')!.build();
    expect(syncDefaultRotation(profile)).toBe(profile);
  });
});

describe('the list survives a save and a load', () => {
  it('a custom list comes back exactly as it was written', () => {
    const profile = PRESETS_BY_ID.get('rogue_combat')!.build();
    const custom = {
      ...profile,
      rotation: {
        source: 'custom' as const,
        name: profile.rotation.name,
        entries: [
          { abilityId: 'eviscerate', condition: { kind: 'comboPoints', compare: 'atLeast', points: 4 } },
          { abilityId: 'sinister_strike' },
        ] as readonly AplEntry[],
      },
    };

    const loaded = parseProfile(serializeProfile(custom));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    // Frozen: a loaded file runs exactly the list it carries, whatever the
    // stock list for that build is now.
    expect(loaded.profile.rotation).toEqual(custom.rotation);
  });

  it('migrates an older profile to the list it was already running', () => {
    /*
     * THE ONE THING THAT WOULD CHANGE A RESULT is a migration that just added
     * the field: an empty list is a character that casts nothing, so every old
     * profile would silently drop to auto attacks.
     */
    const current = PRESETS_BY_ID.get('two_hand_arms')!.build();
    const old = JSON.parse(serializeProfile(current));
    old.version = 12;
    delete old.rotation;

    const loaded = loadProfile(old);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.profile.version).toBe(CURRENT_PROFILE_VERSION);
    expect(loaded.profile.rotation.source).toBe('default');
    expect(loaded.profile.rotation).toEqual(current.rotation);
  });

  it('refuses a list naming a condition this build does not carry', () => {
    /*
     * `compileCondition` THROWS on an unknown builtin, which would happen when
     * the fight starts -- the worst place to find out. Refused at load, the
     * file gets a message instead.
     */
    const profile = syncDefaultRotation(createDefaultProfile());
    const broken = JSON.parse(serializeProfile(profile));
    broken.rotation.entries = [{ abilityId: 'slam', condition: { kind: 'builtin', id: 'nonsense' } }];

    const loaded = parseProfile(JSON.stringify(broken));
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.issues.some((issue) => issue.message.includes('nonsense'))).toBe(true);
  });

  it('finds a builtin nested inside an all()', () => {
    // The Warrior's rage pooling is exactly this shape, so a check that only
    // looked at the top level would pass every list that actually has one.
    const profile = syncDefaultRotation(createDefaultProfile());
    const broken = JSON.parse(serializeProfile(profile));
    broken.rotation.entries = [
      {
        abilityId: 'slam',
        condition: {
          kind: 'all',
          of: [
            { kind: 'resource', resource: 'rage', compare: 'atLeast', amount: 10 },
            { kind: 'builtin', id: 'also_nonsense' },
          ],
        },
      },
    ];
    expect(parseProfile(JSON.stringify(broken)).ok).toBe(false);
  });

  it('accepts an entry naming an ability the build does not know', () => {
    /*
     * THE `raidBuffs` RULE RATHER THAN THE `equipment` ONE, and deliberate:
     * `PriorityRotation` already skips an entry whose ability the character
     * does not have, which is what lets one list serve several builds. The
     * stock lists rely on it.
     */
    const profile = syncDefaultRotation(createDefaultProfile());
    const edited = JSON.parse(serializeProfile(profile));
    edited.rotation.entries = [{ abilityId: 'a_spell_from_another_class' }];
    expect(parseProfile(JSON.stringify(edited)).ok).toBe(true);
  });
});
