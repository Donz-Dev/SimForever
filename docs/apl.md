# The Action Priority List, as data

`src/game/rotations/apl/`

A priority list used to be code. `PriorityEntry.condition` is a closure, which
is the right shape for the engine and the wrong shape for everything else: a
function cannot be written to a file, cannot be shown in a panel, and cannot be
changed by somebody who is not editing TypeScript. So the list — which decides
most of a build's damage — was the one part of a character with no panel, no
profile field, and no way to adjust it.

An `AplList` is the same list expressed as plain JSON-safe objects.
`compileRotation` turns one into the closures the engine runs, once, when the
character is built; `describeCondition` turns one into a sentence.

```ts
export const DRUID_CAT: AplList = {
  name: 'Druid (Cat)',
  entries: [
    { abilityId: 'shifting_power', condition: resource('atMost', 50, 'energy') },
    { abilityId: 'berserk' },
    { abilityId: 'shred', condition: selfHas('clearcasting') },
    { abilityId: 'rip', condition: comboPoints('exactly', 5) },
    { abilityId: 'rake', condition: targetExpired('rake') },
    { abilityId: 'shred' },
  ],
};
```

## What a condition can say

| kind | asks |
| --- | --- |
| `aura` | is the buff UP — `auras.has`, which is not a reading of the clock |
| `auraTime` | seconds left; an absent aura reads as zero |
| `auraStacks` | how many stacks |
| `resource` | a flat amount of rage, energy, mana or focus |
| `resourceFraction` | a share of the pool's maximum |
| `comboPoints` | points **on the current target** |
| `cooldown` | ready, or on cooldown |
| `fightRemaining` | seconds, or a fraction of the planned duration |
| `fightElapsed` | seconds since the pull; `exactly 0` is the opener |
| `health` | a fraction of maximum |
| `swingIn` / `swungWithin` | the weapon timers |
| `hasReaction` | what the BUILD carries, constant for a fight |
| `castsInstantly` | whether an ability's cast time is zero |
| `all` / `any` / `not` | combine them |
| `builtin` | a named closure, for the four that are not data |

Write them with the builders in `apl/shorthand.ts` rather than by hand:
`targetExpired('rip')` instead of
`{ kind: 'auraTime', on: 'target', auraId: 'rip', compare: 'atMost', seconds: 0 }`.

## The four rules that matter

**Mirror the source's comparison exactly, including strictness.** The nine class
files wrote `< cap` and `<= cap` in different places and meant both, so
`AplCompare` carries `below` and `above` beside `atLeast` and `atMost`. The two
differ on exactly the value that matters, and it is a value a stack count or a
resource lands on.

**An absent target is false, never true.** Every target-reading helper in all
nine files began `target !== undefined &&`. Getting it backwards gives an entry
that fires when there is nothing to fire at.

**Say whose aura it is in the name.** `expired` meant the target's in five files
while the Hunter wrote `selfExpired` beside it for its own; `missing`,
`missingOn`, `withoutAura`, `selfLacks` and `actorHas` were five names over two
tests. Reading a list meant first working out which dialect its file spoke. That
is the one mistranslation that converts silently — both readings compile and both
produce an ordinary-looking rotation.

**Describe every new kind.** `describeCondition` has no `default` branch, so a
new kind fails the typecheck until somebody writes its sentence. A kind nobody
described would render blank in the panel, which reads as an entry with *no*
condition — and an entry that looks unconditional is one somebody reorders
wrongly, because an ungated entry is a floor under everything below it.

## The four builtins

Four conditions are class machinery rather than a comparison, so they are named
closures in a registry instead:

| id | what it asks |
| --- | --- |
| `spendable_rage_at_least` | rage minus the reserve held for Mortal Strike, while Mortal Strike is off cooldown |
| `charge_stance_allowed` | already in a stance Charge permits — which is also the Vanguard gate, with no talent named |
| `hawks_below_cap` | fewer than two Hawks up |
| `ability_holds_swing_timer` | whether a talent made an ability not cost a swing |

They are still data: `{ kind: 'builtin', id, args }` serialises, survives a save
and a load, and describes itself, so an entry carrying one can be reordered,
removed or given further conditions beside it. What it cannot be is **rewritten**
in a panel — and the panel says so rather than offering an editor that would
quietly drop the half it cannot express.

**The registry throws on an unknown id**, which is the opposite of how
`TALENT_AURAS` handles a miss. That one drops silently on purpose, so a typo
shows up as a talent that visibly does nothing. Here the right failure is loud: a
list naming a builtin this version does not carry would run with a condition
*missing*, and an entry that loses its gate fires far more often than it should —
a bigger number and no error.

## Checking a change to this

**`tools/rotation_fingerprint.ts` is the check, not `measure_profiles.ts`.** It
hashes the combat log of all 25 presets over three seeds. The log is a pure
formatter over the same telemetry stream the analyzers read, so it carries every
cast, swing, aura and tick in order — a list that picked a different ability
once, or the same abilities in a different order, moves the hash. A DPS total can
hide both.

```bash
npx vite-node tools/rotation_fingerprint.ts > before.txt
# ...change something...
npx vite-node tools/rotation_fingerprint.ts > after.txt
diff before.txt after.txt
```

It is sharper than a measurement **and about a hundred times cheaper**. A mean
answers "did the published figure move", which is a question about variance and
needs 300 fights a profile; a hash answers "did any decision change at all",
which is a question about identity and needs three. The engine draws from one
random stream, so a single differing decision reorders every later draw and the
rest of the fight diverges completely — the property that ruins paired
measurement is exactly what makes this check work.

All 75 hashes were unchanged by the conversion of all 26 lists.

## Storing one on a profile

`CharacterProfile.rotation` is a `StoredRotation`: a `source`, a `name`, and
the entries in full. **Written out in full, always**, which is the owner's call
and the opposite of how `combatStyle` handles its default — a saved file is a
complete description of the build, and nothing about it depends on what this
version of the simulator thinks a Beast Mastery Hunter's stock list is. The
cost, chosen knowingly, is that a saved profile is **frozen**: it keeps its list
after a stock list is improved.

**`source` is what stops a stored list becoming the wrong list.** Freezing a
list means it no longer follows the build, and the build is editable — change a
Rogue's capstone and a different stock list applies; change class and the stored
list names another class's abilities, every one of which `PriorityRotation`
skips in silence. This project has already shipped a Fire Mage that ran the
Arcane list and produced a perfectly ordinary DPS figure.

| `source` | editing the build in the app | loading a file |
| --- | --- | --- |
| `default` | re-derives, the way changing class replaces gear | runs exactly what is in the file |
| `custom` | left alone, and the panel **says** it no longer matches | runs exactly what is in the file |

`syncDefaultRotation` runs on every profile change a panel makes rather than on
the four that can matter, because it is idempotent and because the alternative
is a list of "edits that change which stock list applies" that stays correct
until somebody adds a fifth. It is **not** called on load: that is the freezing.

## Editing one

`ui/panels/aplEditing.ts` holds the edits as plain functions, apart from the
component, because they are the part that can be wrong — an entry that loses its
condition while being reordered, or a clause that round-trips into a *different*
condition, is a rotation quietly doing something else and an ordinary-looking
DPS figure.

- **A new entry goes at the BOTTOM**, the only position that cannot change what
  the list already does: an unconditional entry anywhere else is a floor under
  everything below it.
- **Moving past either end is a no-op, not a wrap.** Position is priority, so
  wrapping the first entry to the bottom is the worst possible reading of a
  mis-click.
- **A duplicate is allowed**, because two stock lists need one — the Mage's
  Arcane Missiles and the Warlock's Shadow Bolt are each in their list twice,
  gated above and ungated below.

A condition is edited as a **flat list of clauses**, which is what nearly every
stock condition is. `any`, `not` and the four builtins decompose to nothing, so
the panel shows them as a sentence and says they are not editable here — an
editor that silently simplified the Rogue's `not(poolingForAmbush)` into
something it could draw would change the rotation with nothing on screen to say
so.

**Buffs and debuffs are chosen by NAME from a dropdown**, never typed.
`auras/auraCatalog.ts` derives what a class can be asked about from three
sources — the class's own aura module read as a namespace, its talent auras
narrowed by its own talent tree, and the raid buffs — with a safety net that
adds anything its stock lists mention, wherever that definition happens to
live. `auraCatalog.test.ts` asserts that net holds for all 26 lists.

The first version was a text box with a datalist of *ability* ids beside it, on
the reasoning that most aura ids are ability ids and there was no registry of
the rest. Both halves were true and the conclusion was wrong: it meant a buff
condition was unreachable unless you already knew that Fire Vulnerability is
`fire_vulnerability`. **And a half-typed id is worse than a wrong one** — an
aura that does not exist is never present, so `is up` is permanently false and
`has run out` is permanently true. One silently disables an entry, the other
silently ungates it, and neither looks like anything but a rotation that
performs differently than expected.

Both groups are always offered, with the one matching the clause's subject on
top. Filtering to debuffs alone for a target clause would be tidier and wrong:
the Druid's Bear list asks whether the target has the *Warrior's* Demoralizing
Shout. An id the catalog does not know is kept as its own option rather than
falling back to the first entry, so a hand-edited file is never silently
rewritten.

**`is not up` and `has run out` are different options on purpose.** The first is
`!auras.has(id)` and the second is `remainingMs(id) <= 0`; they differ on an
aura that is present with nothing left, and the stock lists write both. They
were one option in the first draft and the round-trip test caught it — opening
the Enhancement list and touching nothing would have rewritten its Windfury
Weapon entry into a reading of the clock.

## What is not here yet

Nothing in the editor builds an `any`, a `not`, or a nested condition, and
nothing edits a builtin. All four are preserved, shown and runnable; they just
have to be written in TypeScript.
