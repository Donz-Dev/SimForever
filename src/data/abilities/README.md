# Warrior ability effect magnitudes

`forever-warrior-tooltips.json` holds Forever's own data for **all 32 Warrior spells the
simulator cares about** — the 26 from the ability spreadsheet, the three stances,
and the five that talents grant and the spreadsheet omits entirely.

For each: the rendered tooltip, the raw effect rows, and which stances it can be
used in.

**Generated, never hand-edited.** `tools/import_spell.mjs` writes it.

**The Warrior now has a spellbook capture too**, `forever-warrior-spellbook.json`,
written by `tools/import_forever_spells.mjs warrior --write` on 2026-09-30. Until
then it was the one class of the nine without one, and the two files answer
different questions: the tooltips carry the **effect rows** and the stance list,
the spellbook carries the **build number** and the **requirement lines**. It was
the second that mattered — Spearing Strike's "Requires Two-Handed Axes,
Two-Handed Maces, Polearms, Two-Handed Swords, Staves" appears in the spellbook
and in no Wowhead tooltip, and a dual-wielder had been casting it all project.

A build number is the other thing it adds: the tooltip capture carries only a
date, so until now nothing about the Warrior's data could be compared with the
other eight by build.

## Why this file exists

The ruleset owner's ability spreadsheet gives costs, cooldowns and damage. It
gives no effect magnitudes at all, so ten abilities — Battle Shout,
Demoralizing Shout, Sunder Armor, Recklessness, Berserker Rage, Bloodrage,
Shield Wall, Shield Block and two of the three stances — were castable and
completely inert. They were the single biggest gap in the class, and the
standing plan was to borrow WoW Classic values and flag them loudly.

**That plan was unnecessary, and would have been wrong.** The same host that
already served Forever *item* data serves Forever *spell* data:

```
https://nether.wowhead.com/forever/tooltip/spell/<id>
```

These are Forever's own numbers, and they are **not** Classic's. Every row below
was fetched from both endpoints rather than recalled:

| | Forever | Classic | Borrowing would have been |
| --- | --- | --- | --- |
| Shield Wall | 60% for 12 sec, 15 min cooldown | 75% for 10 sec, 30 min | too strong, too short |
| Shield Block | +75% block, 7 sec, **2 attacks** | +75% block, 5 sec, 1 attack | too short, half the blocks |
| Demoralizing Shout | −196 attack power, 45 sec | −146 attack power, 30 sec | **25% too weak**, and a third too short |

The Demoralizing Shout row reads −210 in the tooltip DESCRIPTION and −195 in its
own effect row, which is 196 once base points are allowed for; 196 is what the
simulator applies and what `foreverchanges.pro` states. This table said 210 for
as long as the constant said 196.

Borrowing from Classic would have produced confident, plausible, wrong figures
for precisely the abilities the project most wanted filled — and every one would
have carried a `PLACEHOLDER_` name saying it was unverified, which is honest
about the provenance and useless about the value.

The Demoralizing Shout row is worth dwelling on: the first draft of this file
guessed the Classic figure at −300 from memory and had to be corrected by
fetching it. A number recalled rather than looked up is an invented number
wearing a citation.

## The audit

[`docs/warrior.md`](../../../docs/warrior.md) is the reading of this file:
stance gating for all 32, what the three stances do, and every place Forever and
the ruleset owner's spreadsheet disagree — with which one won.
**Read that rather than re-deriving it from the JSON.**

## Where the numbers go

**The magnitudes are transcribed by hand** into named constants in
`src/game/auras/warrior.ts`, beside a comment naming the spell id. This file is
the transcript they were read from.

The importer deliberately does **not** parse magnitudes out of the tooltip. The
sentences vary too much between abilities for a regex to be trustworthy, and a
mis-read magnitude is exactly the plausible wrong number this project exists to
avoid. What it stores is the sentence; a person reads the number out of it.

`tests/game/warriorAbilityValues.test.ts` closes the loop: it asserts each
constant against the stored tooltip text, so a transcription typo fails.

## Refreshing

```bash
node tools/import_spell.mjs --verify        # re-fetch all 32, diff, exit 1 on drift
node tools/import_spell.mjs --refresh       # re-capture
node tools/import_spell.mjs forever 25289   # print one spell
node tools/import_spell.mjs classic 25289   # the Classic one, for comparison
```

`--verify` matters more here than convenience. **Forever has changed under this
project before** — Bastion was removed from the Protection tree and moved
Focused Rage into its slot, and it was found only because capturing talent
values happened to trip over it. A retuned Shield Wall would be invisible
without this check.

## Ranks

Everything with ranks is captured at its **max rank for level 60**, the only
level the simulator runs at. The rank matters a great deal: Battle Shout rank 1
grants 12 attack power and rank 7 grants 140.

The id and rank of each is the manifest at the top of `tools/import_spell.mjs`,
which is also where the mapping to the simulator's own ability ids lives. The
list came from <https://www.wowhead.com/forever/class=1/warrior>.

## What is still missing after this

**Berserker Rage has no magnitude even in Forever.** Its tooltip says it
generates "extra rage when taking damage" and names no number — no effect row
carries one either; the spell has exactly two rows and both are immunities — and
its other half, immunity to Fear and Incapacitate, is not a concept the engine
has. It stays inert, and that is a fact about the source rather than a gap in
the capture.

**Its DURATION is not missing and was filed as though it were.** "Lasts 10 sec",
in all three sources. It carried a `PLACEHOLDER_` name until 2026-09-30 on the
grounds that the ability spreadsheet states no duration, which is true of the
spreadsheet and says nothing about the data. **Improved Berserker Rage's rage on
activation is not missing either** — 5 and 10 by rank, in the values file — and
is applied.

## The refresh of 2026-09-30, and what it found

`--verify` failed on **seven of the 32**, and five of the seven are the same
good news: Forever stopped rendering the `(100% of Spell Power)` artifact, so
Bloodthirst, Shield Slam, Revenge, Hamstring and Intercept now print the numbers
this project had already read out of their effect rows — 48, 640 to 670, 138 to
168, 45 and 65. Every one of those transcriptions was confirmed by a source that
could not state it when the transcription was made.

**One is a real change: Slam's cooldown went 15 to 18.** Nothing in this
repository moved; the game did. That is the kind of error no cross-check finds
and only a refresh does.

The last is Sunder Armor's threat effect row, 1014 to 207. Threat is out of
scope, so it changes nothing here and is recorded so the next reader of the
diff does not have to work that out.

**And the two ranges answer a question `docs/warrior.md` had left open.** Revenge
and Shield Slam are implemented flat, at 153 and 655, because Forever's effect
rows give one number and could not say whether it was a midpoint. 138–168 and
640–670 have midpoints of exactly 153 and 655, so the reading was right and is
now sourced rather than assumed.

**Battle Stance really does nothing.** "A balanced combat stance", in full. The
engine assumed that and was right; it is now confirmed rather than assumed.
