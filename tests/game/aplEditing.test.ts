import { describe, expect, it } from 'vitest';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import { compileCondition } from '../../src/game/rotations/apl';
import {
  addEntry,
  blankClause,
  clausesOf,
  conditionFromClauses,
  moveEntry,
  removeEntry,
  setCondition,
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

describe('clauses round-trip through the editor', () => {
  /*
   * THE ASSERTION THAT MATTERS. A clause the panel draws has to come back as
   * the SAME condition -- not an equivalent-looking one. The failure mode is a
   * person opening an entry, changing nothing, and the rotation quietly
   * behaving differently afterwards.
   */
  it('every editable condition in every stock list survives unchanged', () => {
    let checked = 0;
    for (const record of ALL_PRIORITY_LISTS) {
      for (const entry of record.list.entries) {
        if (!entry.condition) continue;
        const clauses = clausesOf(entry.condition);
        // `undefined` means the panel shows it read-only, which is the honest
        // answer for `any`, `not` and the builtins.
        if (clauses === undefined) continue;
        expect(conditionFromClauses(clauses), `${record.list.name}: ${entry.abilityId}`).toEqual(
          entry.condition,
        );
        checked += 1;
      }
    }
    // A guard on the guard: if `clausesOf` started returning undefined for
    // everything, the loop above would assert nothing at all.
    expect(checked).toBeGreaterThan(40);
  });

  it('shows a condition it cannot draw as read-only instead of simplifying it', () => {
    // The Rogue's `not(poolingForAmbush)` and anything carrying a builtin.
    expect(clausesOf({ kind: 'not', of: { kind: 'aura', on: 'self', auraId: 'x', present: true } }))
      .toBeUndefined();
    expect(clausesOf({ kind: 'builtin', id: 'hawks_below_cap' })).toBeUndefined();
    expect(
      clausesOf({
        kind: 'any',
        of: [
          { kind: 'aura', on: 'self', auraId: 'x', present: true },
          { kind: 'aura', on: 'self', auraId: 'y', present: true },
        ],
      }),
    ).toBeUndefined();
  });

  it('keeps "has run out" apart from "has N seconds left"', () => {
    /*
     * They are the same test only if a window of zero is a window, and the
     * class files wrote them as different helpers because they are different
     * ROTATION decisions: a refresh window CLIPS whatever is left, which cost
     * the Moonkin 14.9 DPS.
     */
    const ranOut: AplCondition = {
      kind: 'auraTime',
      on: 'target',
      auraId: 'rip',
      compare: 'atMost',
      seconds: 0,
    };
    const clauses = clausesOf(ranOut)!;
    expect(clauses[0].test).toBe('down');
    expect(conditionFromClauses(clauses)).toEqual(ranOut);
  });

  it('no clauses at all is no condition, not an empty one', () => {
    // An empty `all` is TRUE for every actor, so storing one would turn a
    // gated entry into an unconditional floor.
    expect(conditionFromClauses([])).toBeUndefined();
  });

  it('every blank clause compiles', () => {
    for (const kind of ['buff', 'resource', 'cooldown', 'fight'] as const) {
      const condition = conditionFromClauses([blankClause(kind)])!;
      expect(() => compileCondition(condition), kind).not.toThrow();
    }
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
