import { describe, expect, it } from 'vitest';
import { runProfile } from '../../src/simulator';
import { MIND_BLAST, MIND_FLAY } from '../../src/game/abilities/priest';
import { seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import type { CharacterProfile } from '../../src/profiles';
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
  setInterrupts,
  toggleNegated,
} from '../../src/ui/panels/aplEditing';
import { abilityBookFor, interruptibleChannelsIn } from '../../src/ui/panels/AplPanel';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
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

describe('cutting a channel short is a choice, not a baked-in flag', () => {
  /*
   * ==========================================================================
   * IT WAS EXPRESSIBLE ONLY IN TYPESCRIPT. Three Warlock entries carried
   * `interruptsChannel` and nothing else could, so a real rotation decision --
   * is this worth throwing away the rest of a channel for -- was unreachable
   * from the app.
   *
   * BOTH HALVES STILL HAVE TO AGREE: the channel declares
   * `interruptibleChannel` and the entry declares `interruptsChannel`, and
   * nothing is cancelled unless both do. That is what makes the checkbox safe
   * to offer, and what makes it meaningless in a list with no interruptible
   * channel in it -- which is why it is not offered there.
   * ==========================================================================
   */
  it('offers the checkbox only where the list holds an interruptible channel', () => {
    const cases = [
      ['warlock_smds', 'Wrack'],
      ['mage_arcane', 'Arcane Missiles'],
      ['shadow_priest', 'Mind Flay'],
    ] as const;
    for (const [presetId, channelName] of cases) {
      const profile = PRESETS_BY_ID.get(presetId)!.build();
      const channels = interruptibleChannelsIn(profile.rotation.entries, abilityBookFor(profile));
      expect(channels.map((channel) => channel.name), presetId).toContain(channelName);
    }

    // A class with no interruptible channel offers nothing, so no entry can be
    // ticked into doing nothing for ever.
    for (const presetId of ['two_hand_arms', 'druid_cat', 'rogue_combat']) {
      const profile = PRESETS_BY_ID.get(presetId)!.build();
      expect(
        interruptibleChannelsIn(profile.rotation.entries, abilityBookFor(profile)),
        presetId,
      ).toEqual([]);
    }
  });

  it("a Mage's checkbox can only ever interrupt Arcane Missiles", () => {
    /*
     * THE OWNER'S EDGE CASE. Evocation is the Mage's OTHER channel -- eight
     * seconds of mana regeneration -- and cutting it short would throw away
     * the thing it was cast for. It is deliberately not marked
     * `interruptibleChannel`, so it cannot be offered and cannot be cancelled,
     * and the label on the checkbox names Arcane Missiles alone.
     */
    for (const presetId of ['mage_arcane', 'mage_fire', 'mage_frostfire']) {
      const profile = PRESETS_BY_ID.get(presetId)!.build();
      const names = interruptibleChannelsIn(
        profile.rotation.entries,
        abilityBookFor(profile),
      ).map((channel) => channel.name);
      expect(names, presetId).not.toContain('Evocation');
    }

    // And at the source: the ability itself refuses, whatever any list says.
    const book = abilitiesForClass('mage', 'caster');
    const evocation = book.find((ability) => ability.id === 'evocation');
    expect(evocation, 'Evocation is in the book').toBeDefined();
    expect(evocation!.interruptibleChannel, 'Evocation must not be interruptible').toBeFalsy();
    expect(
      book.find((ability) => ability.id === 'arcane_missiles')!.interruptibleChannel,
    ).toBe(true);
  });

  it('does not offer to interrupt a channel with itself', () => {
    // `selectInterrupt` is consulted only while the actor is channelling, so a
    // tick on the channel's own entry would mean "cancel this to cast it
    // again" -- a loop, not a rotation.
    const profile = PRESETS_BY_ID.get('warlock_smds')!.build();
    const channels = interruptibleChannelsIn(profile.rotation.entries, abilityBookFor(profile));
    const forWrack = channels.filter((channel) => channel.id !== 'wrack');
    expect(forWrack).toEqual([]);
  });

  it('sets and clears the flag, and clears it by DROPPING the key', () => {
    /*
     * `JSON.stringify` writes `"interruptsChannel": false` and omits an absent
     * key, so storing the false would make a list that had been ticked and
     * unticked compare as different from the stock one it came from.
     */
    const entries: readonly AplEntry[] = [{ abilityId: 'shadow_bolt' }];
    const on = setInterrupts(entries, 0, true);
    expect(on[0].interruptsChannel).toBe(true);

    const off = setInterrupts(on, 0, false);
    expect('interruptsChannel' in off[0]).toBe(false);
    expect(off[0]).toEqual({ abilityId: 'shadow_bolt' });
  });

  it('keeps the flag on the stock Warlock list, which the owner set', () => {
    // Three entries, by the owner's list: a Shadow Bolt on a Nightfall proc, a
    // Corruption that fell off, a Bane of Agony that fell off.
    const profile = PRESETS_BY_ID.get('warlock_smds')!.build();
    const ticked = profile.rotation.entries.filter((entry) => entry.interruptsChannel);
    expect(ticked.map((entry) => entry.abilityId)).toEqual([
      'shadow_bolt',
      'bane_of_agony',
      'corruption',
    ]);
  });
});

describe('an interrupt only fires when the ability could actually be cast', () => {
  /*
   * ==========================================================================
   * THE REGRESSION. `selectInterrupt` used to accept `already_casting` as the
   * rejection reason, on the reasoning that `checkCast` reports ONE reason in a
   * fixed order and the cast lock is checked second -- "so nothing else is in
   * the way".
   *
   * EVERY STEP OF THAT IS TRUE AND THE CONCLUSION IS BACKWARDS: an earlier
   * reason hides every later one, so the cast lock being second means the
   * global cooldown, the ability's own cooldown, its cost and its target are
   * never reached while the caster is channelling. `already_casting` says only
   * that the caster is alive.
   *
   * IT WAS INVISIBLE UNTIL THE PANEL LET SOMEBODY TICK A BOX ON AN ABILITY WITH
   * A COOLDOWN. The stock Warlock list is the only one with interrupting
   * entries and all three are gated on an aura with no cooldown and no cost
   * they could fail -- their conditions did the work this check was supposed to
   * do. Mind Blast has an eight-second cooldown, and ticking it cancelled Mind
   * Flay on EVERY poll for the whole of it.
   * ==========================================================================
   */
  const SEEDS = [1, 2, 3, 4, 5];

  const run = (profile: CharacterProfile) => {
    let interrupts = 0;
    let mindFlayTicks = 0;
    let mindBlastHits = 0;
    for (const seed of SEEDS) {
      const result = runProfile(
        { ...profile, simulation: { ...profile.simulation, iterations: 1, seed } },
        seed,
      );
      for (const event of result.timeline as readonly { type: string; abilityName?: string }[]) {
        if (event.type === 'channel_interrupted') interrupts += 1;
        if (event.type === 'damage' && event.abilityName === 'Mind Flay') mindFlayTicks += 1;
        if (event.type === 'damage' && event.abilityName === 'Mind Blast') mindBlastHits += 1;
      }
    }
    const fights = SEEDS.length;
    return {
      interrupts: interrupts / fights,
      mindFlayTicks: mindFlayTicks / fights,
      mindBlastHits: mindBlastHits / fights,
    };
  };

  const priest = () => PRESETS_BY_ID.get('shadow_priest')!.build();
  const ticking = (abilityId: string) => {
    const profile = priest();
    return {
      ...profile,
      rotation: {
        ...profile.rotation,
        source: 'custom' as const,
        entries: profile.rotation.entries.map((entry) =>
          entry.abilityId === abilityId ? { ...entry, interruptsChannel: true } : entry,
        ),
      },
    };
  };

  it('leaves the channel alone while the interrupting ability is on cooldown', () => {
    /*
     * THE ASSERTION THE BUG FAILS. Mind Blast is on an eight-second cooldown,
     * so it can interrupt at most a handful of times a fight -- with the old
     * check it fired on every poll and Mind Flay went to ZERO ticks.
     */
    const stock = run(priest());
    const ticked = run(ticking('mind_blast'));

    expect(stock.interrupts, 'the stock list interrupts nothing').toBe(0);
    expect(stock.mindFlayTicks, 'the filler channel ticks').toBeGreaterThan(20);

    // The channel is still the filler afterwards -- cut into, not deleted.
    expect(ticked.mindFlayTicks, 'Mind Flay survives the tick').toBeGreaterThan(15);
    // And an interrupt costs a cast, so there cannot be more of them than
    // there are Mind Blasts to interrupt FOR.
    expect(ticked.interrupts).toBeLessThanOrEqual(ticked.mindBlastHits + 1);
  });

  it('casts the ability it cancelled the channel for', () => {
    // The whole point of checking before cancelling: the old code could throw
    // away the rest of a channel and then cast nothing.
    const ticked = run(ticking('mind_blast'));
    expect(ticked.interrupts, 'it does interrupt sometimes').toBeGreaterThan(0);
    expect(ticked.mindBlastHits, 'and gets more Mind Blasts out for it').toBeGreaterThan(
      run(priest()).mindBlastHits,
    );
  });

  it('reports the cooldown, not the cast lock, when asked past the lock', () => {
    /*
     * THE UNIT-LEVEL STATEMENT OF THE SAME THING, so the REASON is pinned and
     * not only its consequence.
     *
     * `makeAttacker` RATHER THAN `createPlayer`, because a built player carries
     * a ROTATION -- advancing the clock would let the Priest's own priority
     * list cast things, and the first version of this test found the caster on
     * a global cooldown three seconds later with no idea why. This project has
     * that written down; it still took a failing test to remember.
     */
    const caster = makeAttacker({
      abilities: [MIND_BLAST, MIND_FLAY],
      resources: [{ type: 'mana', maximum: 10_000, initial: 10_000 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([caster, target], { durationMs: seconds(60) });
    simulation.begin();

    // Mind Blast first, which puts it on its own cooldown...
    expect(simulation.cast(caster, MIND_BLAST, target).ok).toBe(true);
    // ...then past the cast and the global cooldown, and into the channel.
    simulation.advanceTo(simulation.clock.now() + seconds(3));
    expect(simulation.cast(caster, MIND_FLAY, target).ok, 'the channel starts').toBe(true);
    expect(caster.isCasting(simulation.clock.now()), 'channelling').toBe(true);
    expect(caster.abilities.isReady('mind_blast', simulation.clock.now())).toBe(false);

    /*
     * AT THE CHANNEL'S START THE GLOBAL COOLDOWN IS STILL RUNNING, and it is
     * still checked -- cancelling a channel to sit on a running GCD would throw
     * the rest of it away and cast nothing.
     */
    expect(
      simulation.castRejection(caster, MIND_BLAST, target, { ignoreCastLock: true }),
    ).toBe('on_gcd');

    // Into the channel, past the global cooldown, with Mind Blast's own eight
    // seconds still to run.
    simulation.advanceTo(simulation.clock.now() + seconds(1.6));
    expect(caster.isCasting(simulation.clock.now()), 'still channelling').toBe(true);
    expect(caster.isOnGcd(simulation.clock.now()), 'off the global cooldown').toBe(false);

    // The old reading: one reason, and it is the lock -- which says nothing
    // about the cooldown, because the lock is checked first.
    expect(simulation.castRejection(caster, MIND_BLAST, target)).toBe('already_casting');
    // The real question, and the real answer.
    expect(
      simulation.castRejection(caster, MIND_BLAST, target, { ignoreCastLock: true }),
    ).toBe('on_cooldown');
  });
});
