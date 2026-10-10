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

## What is not here yet

**The panel is read-only, and no profile stores a list.** The format is what
editing and saving need; the profile field, its migration and the editor
controls are the next piece of work. A panel that let somebody reorder entries
and then silently lost the order on reload would be worse than one that shows
the order.
