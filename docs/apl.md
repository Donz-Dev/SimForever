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

## A stored list is narrowed by RACE

Every list names all four free racial cooldowns, because the shared constant in
`rotations/racialCooldowns.ts` is spread into lists that belong to no race. A
build only ever learns whichever its own race grants, so `stockListFor` drops
the rest — see `withoutOtherRacials`.

**The engine never needed it and the panel did.** `PriorityRotation` skips an
ability the character does not know in silence, which is the property that lets
one list serve several builds, so an Orc carrying Berserking, Elune's Light and
Eureka! cost exactly nothing: all 75 combat-log hashes and event counts are
identical either way. What it cost was a *person* reading the panel — three of
an Orc's first four entries were abilities no Orc can cast, with nothing on
screen to say so.

**Only a racial may be dropped.** "Drop what the build does not know" is the
wider rule and it would delete a capstone a list names for a sibling spec: one
Hunter list serves a build without the capstone, and the Hemo list *is* the
Rupture list minus two entries.

**And `syncDefaultRotation` had to stop comparing by name alone.** For class,
style, stance and talents the name was the whole question — a different build
means a different stock list and therefore a different name. Race does not work
that way: an Orc Warrior and a Gnome Warrior run the **same named list** with
different racial entries in it, so a name comparison would have left Blood Fury
in after somebody changed an Orc to a Gnome, and left Eureka! out.

## And by what the character DRANK

The same mechanism one category along, and the one difference is what makes it
interesting. `rotations/consumableCooldowns.ts` holds nine entries — six Potions
and three Other items — spread into every one of the 25 stock lists, and
`stockListFor` drops the ones the profile did not select. See
`withoutUnselectedConsumables`, which is `withoutOtherRacials` with a selection
in place of a race.

**A race is settled when the character is made; a selection changes while
somebody is looking at the panel.** That is the whole difference, and it is what
satisfies the request this was built for — *"when a potion is selected it will
then become visible on the APL so the user can place it amongst their rotation
with conditions"*. Choosing a Major Mana Potion makes its entry appear, with its
condition and its note, because `syncDefaultRotation` re-derives a `default`
list on every profile change.

**It needed no new mechanism, and `editProfile` had already predicted it.** Its
own comment reads: *"applied to every change rather than to the four that can
matter, because it is idempotent and because the alternative is a list of edits
that change which stock list applies that is correct until somebody adds a
fifth."* A consumable selection is the fifth, and it arrived for free.

**The seven that are not heals go where the racials go** — second in a DPS list,
last in a tank list. Free, off the global cooldown, so both ends of a list were
already measured for the racials and both were wrong: the top costs Charge its
one-instant window, and the bottom is where five of seven racials came back
inert.

**The two heals are the exception, and they are the one judgement here.** A tank
list puts free entries last on a measured argument — *"100ms is not free to a
tank at thirty percent health"* — and that argument does not reach a healing
potion, because the bottom of a tank list is a place entries are **not reached**.
A Protection warrior caps its rage, so something above is nearly always
castable. So `CONSUMABLE_HEALS` sits with Last Stand and Shield Wall, below them
because those are the bigger answer to the same question. In the other 22 lists
the position is free: with `targetAttacks` off, health never leaves maximum, the
condition is permanently false, and an unreachable condition high in a list is
not a floor under anything.

**Major Mender's Potion is deliberately in no list**, and the constant says so
where the entry is not — because an absent entry for something the catalogue
offers reads exactly like an omission. It grants 75 Healing Power, healing power
is not a stat this engine has, and an entry for it would cost one rotation poll
per two minutes to achieve nothing.

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

A condition is edited as a **tree**: a group that matches `all of` or `any of`,
holding clauses and nested groups, each with a `not` toggle.

It was a flat list of ANDed clauses at first, and that **locked 51 of the 132
stock conditions** — one `not` anywhere, or one `any`, made the whole condition
read-only. The Rogue's pooling gates, the Paladin's entire seal twist, the
Mage's Scorch and the Priest's hold band could be read and not touched.

The tree has a second, larger benefit: **a leaf the panel cannot draw no longer
poisons its whole condition.** A builtin, a swing-timer read, `hasReaction` or
`castsInstantly` becomes one `fixed` row — shown as its sentence, negatable,
removable, not rewritable — inside a tree that is otherwise fully editable. 22
such leaves remain across 20 conditions; nothing is locked as a whole.

`not` is a **flag on a node** rather than a node of its own, because that is
what a checkbox is and because `not(not(x))` is not a thing any list writes. A
double negation that did arrive is kept whole as a fixed leaf rather than
collapsed, so it still round-trips exactly.

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

**A factory-built aura has to be listed in its module's `CATALOG_AURAS`.**
Walking a module's exports finds every aura declared as a constant and none
built by a function — which silently cost the dropdowns 20 auras across nine
classes, Rip and Deep Wounds and Ignite among them. Rip is how it was noticed: a
Druid could not gate Rip on Rip already being up, the single most ordinary thing
a feral rotation does. Each module now exports the definitions its factories
build, with the representative argument beside the factory rather than in the
catalog, and `auraCatalog.test.ts` reads the *source* and fails if anything
declared is offered to nobody.

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

## Switching an entry off

`AplEntry.disabled` keeps a line in the list and never offers it to the
rotation. The eye button in the panel is the toggle.

**So that trying something does not cost the line.** Removing an entry to see
what it is worth and adding it back means retyping its condition, its note and
its interrupt flag — and this whole editing layer exists because a condition
that cannot be redrawn exactly is a rotation that changed with nothing on screen
to say so.

**Filtered in `compileRotation`, not checked in `selectAction`.** The second is
the obvious alternative and is worse twice over: it would ask the question on
every entry of every decision for a flag almost nothing sets, and
`PriorityRotation` computes `interruptsChannels` ONCE in its constructor — so a
disabled *interrupting* entry would still make the actor poll its channel every
100ms. That is the cost `Rotation.interruptsChannels` exists to avoid, and it is
invisible: the combat log stays byte-identical and only `eventsProcessed` moves,
which is exactly how that mistake was found the first time.

**The flag is dropped rather than stored as `false`**, which is
`interruptsChannel`'s rule and matters more here: `syncDefaultRotation` compares
a stored list to the stock one **by value**, so an entry switched off and on
again has to come back byte-identical or a `default` list silently stops
matching the build it came from.

**Absent means active, so there is no migration.** A profile saved before the
field existed has no `disabled` key and behaves exactly as it did.

## Interrupting a channel

`AplEntry.interruptsChannel` is a **checkbox** on each entry. It was baked into
three Warlock entries and reachable from nowhere else, which made a real
rotation decision — is this worth throwing away the rest of a channel for? —
expressible only in TypeScript.

**Both halves still have to agree.** The channel declares
`interruptibleChannel` and the entry declares `interruptsChannel`, and nothing
is cancelled unless both do. So the checkbox is offered only when the list
actually holds an interruptible channel, and never on that channel's own entry:
a tick that could never fire is worse than no control, and "cancel this channel
to cast it again" is a loop rather than a rotation.

**The label names the channel** — "interrupt Arcane Missiles", "interrupt
Wrack", "interrupt Mind Flay" — read off the list and the ability book rather
than from a list of classes, so a fourth interruptible channel is covered the
day it lands.

**Evocation is deliberately not interruptible**, on the owner's instruction. It
is the Mage's other channel and is eight seconds of mana regeneration; cutting
it short would throw away the thing it was cast for. That is why a Mage can be
offered the checkbox safely — it can only ever cut Arcane Missiles short — and
`aplEditing.test.ts` pins it at the ability as well as in the panel.

**An interruptible channel POLLS instead of sleeping to its end**, every
`ROTATION_POLL_MS`, because the one moment it would otherwise wake is the moment
the channel has already finished. That is the right trade when something might
interrupt and pure waste when nothing can: marking Arcane Missiles and Mind Flay
interruptible, with no entry asking to interrupt them, cost the Arcane Mage 13%
more events a fight and the Shadow Priest 25% — for an *identical combat log*.
`Rotation.interruptsChannels` is what gates it, and a rotation that does not say
is assumed to interrupt, because that is the safe default.

## What is not here yet

Five condition kinds have no controls and stay `fixed`: the four builtins,
`swingIn`, `swungWithin`, `hasReaction` and `castsInstantly`. Each is genuinely
class machinery rather than a rule somebody would write in a panel — "rage minus
the reserve held for Mortal Strike while Mortal Strike is off cooldown" does not
belong in a dropdown. They are preserved, shown, negatable, removable and
runnable; they just have to be written in TypeScript.
