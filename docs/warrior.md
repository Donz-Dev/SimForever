# The Warrior

The class the engine was built against, and the only one with a ruleset-owner
spreadsheet of its own. This file holds what is still **binding**: the numbers
the code uses and which source won, the stance gating, the reading rules that
apply to every class, and what is inert and why.

It replaces five files that recorded how the Warrior got here
(`warrior-completion.md`, `warrior-abilities.md`, `warrior-ability-audit.md`,
`warrior-talent-audit.md`, `talent-audit-method.md`). The history is in git;
the DPS tables they published were superseded by the profile baselines in
[HANDOVER.md](../HANDOVER.md).

Cross-class rules live in [CLAUDE.md](../CLAUDE.md) and are not repeated here.
The process for a class is [class-implementation.md](class-implementation.md).

## Where the numbers come from

**Five** sources now, and all five were needed.

| | |
| --- | --- |
| `WoWForeverWarriorAbilities.xlsx` | the ruleset owner's own sheet, outside the repo. Highest authority **except** where a capture overruled it below |
| `src/data/abilities/forever-warrior-tooltips.json` | 32 spells captured from Forever's own client data, with the **effect rows** and the stance list. `node tools/import_spell.mjs --verify` re-fetches and exits 1 on drift |
| `src/data/abilities/forever-warrior-spellbook.json` | **new 2026-09-30**, and the ninth of nine. 42 spells from the beta client's own `spellbooks.js`, carrying the **build number** and the **requirement lines** — which is what the tooltips do not have |
| `foreverchanges.pro/spellbook/warrior` | the beta client diffed against Classic Era, per rank. **The tie-break, by the owner's standing rule** |
| `talentsforever.com/warrior` | the talent tree. Audited 2026-09-23: **53 of 53 talents and 154 of 154 rank values match** — the one audit in this project that found nothing wrong |

**THE WARRIOR HAD NO SPELLBOOK CAPTURE FOR THE WHOLE PROJECT**, which made it
the one class whose data carried no build number and could not be machine-diffed
against the other eight. This file used to explain that as a deliberate
non-decision — "a Warrior spellbook can be captured ... if the eight-class shape
is ever wanted". It was wanted, and two corrections fell straight out of taking
it: **Spearing Strike's two-handed requirement** and a second reading of Slam's
cooldown. See [source-cross-checks.md](source-cross-checks.md).

### What the simulator implements, at max rank

Every figure is the rank a level 60 trains. Where the sheet and a capture
disagreed, the ruleset owner chose Forever **every time**.

| Ability | Implemented | Sheet said | Why the sheet lost |
| --- | --- | --- | --- |
| Mortal Strike | weapon +160 | 160 | agree |
| Shield Slam | **655** + block value | 421–439 | rank 1 in the sheet; and see the rank rule below. 655 is the exact midpoint of Forever's 640–670 |
| Revenge | **153** | 81–99 | effect row, tooltip hid it. 153 is the exact midpoint of Forever's 138–168 |
| Slam | weapon **+87**, **18s** cooldown | no bonus, no cooldown | three sources against it; rank 5, not rank 4. **The cooldown was 15 and Forever moved it** — see below |
| Bloodthirst | **35% AP +48** | 30 + 0.35 AP | effect row 49; sheet gave rank 1 |
| Thunder Clap | +103, **6s** cooldown, **4 targets** | 4s | the sheet's 4 is also Classic's, so it looked right from two directions. The target cap is the description's last sentence and was read as "all nearby" until 2026-09-30 |
| Demoralizing Shout | **−196** AP, 45s | no magnitude | description said 210, effect row −195, spellbook capture says 204, `foreverchanges.pro` says 196 |
| Battle Shout | **+139** AP, 3 min | no magnitude | capture says 140 in both places; spellbook and the owner's raid list say 139, and the owner asked for the spellbook |
| Shield Wall | −60% taken, 12s, **15 min** | 30 min | 11 min off 15 leaves 4 exactly; off 30 it leaves 19, which nobody writes a talent for |
| Sunder Armor | −450 armor a stack, 5 stacks, 30s | no magnitude | — |
| Recklessness | +100 crit, 15s, +20% taken | no magnitude | — |
| Overpower | weapon +35 | agree | — |
| Heroic Strike / Cleave | +157 / +50 | agree | — |
| Hamstring / Intercept | +45 / +65 | agree | — |
| Execute | 600 + 15 per extra rage | agree | — |
| Rend | 147 over 21s | agree | — |
| Spearing Strike | 40% weapon damage, 20s, **two-handed weapons only** | agree | the weapon requirement is in the spellbook and on `foreverchanges.pro`, and in no Wowhead tooltip |
| Death Wish | +20% physical, +5% taken, 30s | absent | a talent grants it; the sheet has no row |
| Last Stand | +30% max health, 20s, lost on expiry | absent | as above |

**Ranges are gone from Revenge and Shield Slam**, which is a change in shape as
well as magnitude: both were a spread of ±9 and both are flat now, so any spread
they show comes from the combat table alone.

**AND THE READING IS NOW SOURCED RATHER THAN ASSUMED.** This paragraph used to
end "Forever's effect rows give a single base value and cannot say whether 655 is
flat or a midpoint." Since the 2026-09-30 refresh they can: Forever stopped
rendering the `(100% of Spell Power)` artifact, and the descriptions read **640
to 670** and **138 to 168**, whose midpoints are exactly 655 and 153. So both
figures are right, the spread is ±15 rather than the old ±9, and implementing
them flat understates only the VARIANCE and not the mean.

**Two of the three that were inert have moved**:

| | |
| --- | --- |
| **Berserker Rage** | still inert, and the reason has narrowed. No source names a magnitude for "generating extra rage when taking damage" and **no effect row carries one** — the spell has two rows and both are immunities. Its **duration is not a gap**: "Lasts 10 sec", in all three sources, and it was a `PLACEHOLDER_` until 2026-09-30 on the strength of the owner's spreadsheet being silent. **Improved Berserker Rage's 10 rage on activation is stated and is applied** |
| **Shield Block** | **no longer inert.** "Only 2 attacks" is `consumedByBlock`, and it is in the Protection list. This row said a per-attack charge cap "is not expressible" long after it had been expressed |
| **Sweeping Strikes** | implemented and inert: its whole effect is an *additional* opponent. See Multi-target |

### Reading Forever's spell data — the traps, all class-independent

These cost this project eight corrections and they apply to every class.

- **Read the effect rows, not only the description.** Base points run **one
  higher** than the stated figure throughout this data set (Slam 88/87, Thunder
  Clap 104/103, Bloodthirst 49/48). Battle Shout is the sole exception, which is
  what makes it a real disagreement rather than an artifact.
- **A readable description can still be wrong.** Demoralizing Shout printed 210
  above a row saying −195, and the 210 was transcribed for months because
  nothing prompted anyone to look one line down.
- **`(100% of Spell Power)` is a templating artifact**, on Shield Slam, Revenge,
  Bloodthirst and Intercept. Warriors have no spell power and nothing grants
  any; the number is simply absent from the text and only the effect row has it.
- **The tooltip wins wherever it states a number**, because it is rendered at
  level 60. Battle Shout and Demoralizing Shout carry a standalone `Level 60`
  line and **scale with level**, so for those two the row is the spell's base
  and the tooltip is the value at 60. A blanket −1 was applied briefly and would
  have made Demoralizing Shout 7% too weak while looking rigorous.
  **BUT DEMORALIZING SHOUT IS THE EXCEPTION TO ITS OWN RULE.** Read literally
  that paragraph makes it 210, and the implementation is 196 — which is what
  `foreverchanges.pro` states and what the effect row gives. Four sources, three
  numbers (210, 196, 204), and the preferred source agrees with the row. Where a
  reading rule and the tie-break disagree, the tie-break is a NUMBER and the rule
  is an inference.
- **A REQUIREMENT LINE IS DATA AND A MISSING ONE IS NOT.** Wowhead's Forever
  tooltips carry no requirement line for Spearing Strike; the spellbook capture
  and `foreverchanges.pro` both state a two-handed weapon. Silence is not
  disagreement, so the tie-break rule never came into it — two sources spoke and
  one did not. A dual-wielder had been casting it for the whole project.
- **A talent tooltip shows rank 1** of the ability it grants. Mortal Strike
  85/160, Bloodthirst 30/48, Shield Slam 421/640 — three arguments, one rule,
  and the calculator was never wrong about any of them. The sheet **mixes the
  two conventions**, so it cannot settle a rank question by itself.

## Stances

Forever states gating outright, in the spell page's `Forms` row. An **empty row
means any stance, which is an answer and not an absence of one**, and the prose
form is comma-separated — reading only the first entry halves the answer for
Rend, Execute, Thunder Clap and Hamstring.

| Usable in | Abilities |
| --- | --- |
| any | Mortal Strike, Bloodthirst, Shield Slam, Slam, Heroic Strike, Cleave, Spearing Strike, Battle Shout, Demoralizing Shout, Sunder Armor, Bloodrage |
| Battle | Charge, Overpower, Sweeping Strikes |
| Battle or Defensive | Rend, Thunder Clap |
| Battle or Berserker | Execute, Hamstring |
| Berserker | Whirlwind, Intercept, Recklessness, Berserker Rage |
| Defensive | Revenge, Shield Wall, Shield Block |

| Stance | Effect |
| --- | --- |
| **Battle** | **nothing at all** — "a balanced combat stance", in full. It exists to be the stance other things are gated on, and Forever confirms both its existence and its emptiness. It was defined here as an assumption first, on the grounds that two stances with no way back to a neutral one is not a coherent ruleset |
| **Defensive** | −10% damage done, −10% damage taken. Its +30% threat is dropped: threat is out of scope |
| **Berserker** | +3% crit, +10% damage taken |

**Stance-change rage is not modelled at all**, and no preset changes stance
mid-fight. Tactical Mastery is no longer a talent in Forever — it is trained at
14, and retains 10 rage rather than Classic's 25. Improved Tactical Mastery is
inert for that reason.

## The priority lists

All three orders came from the ruleset owner directly, which is why the Warrior
is the one class whose lists are **not** this project's guess. Each is chosen by
combat style AND stance together, because a rotation that never leaves its
stance is a different rotation and not a filtered one.

| List | Chosen by | Heroic Strike above |
| --- | --- | --- |
| Two-Hander, Battle | `two_hander` + Battle | 75 rage |
| Dual-Wield, Berserker | `dual_wield` + Berserker | 42 rage |
| Shield, Defensive | shield + Defensive | 26 rage |

**Nothing in the dual-wield Berserker list leaves Berserker Stance**, so it
never swaps. Before the lists were split per stance the rotation thrashed — 540
rage a fight — and every build's figures carried that noise.

**FIVE ENTRIES ACROSS THE THREE LISTS NEVER FIRE, AND ALL FIVE ARE DELIBERATE.**
Each profile's own stance cast (the preset already opens in it), Battle Shout in
all three (`battle_shout` is a preset raid buff, so the aura is up at the pull),
and **Spearing Strike in the Berserker list**, which is the new one: it needs a
two-handed weapon and that list is only reached by a dual-wielder. The first
four cost a build that does not need them nothing and are what a hand-built
character in another stance depends on. The fifth is the owner's entry, added on
the belief that the ability was reachable, and taking it out is their call.

**Slam's condition is the only one in any list that reads the swing timer.** It
is the one ability with a cast time, and Improved Slam takes that to half a
second and makes it HOLD the swing, so a Slam started with more than a second
left costs nothing. It reads the pending swing's own scheduled timestamp, which
is the only thing that knows: haste, an extra attack and a cast that reset the
timer all move it.

**Sunder Armor refreshes at 3 seconds in the Arms list and 4 in the Protection
one.** Both are the owner's, each given for its own list, and nothing says they
should agree — so they are two constants rather than one quietly applied to a
list nobody checked it against.

**Demoralizing Shout is IN the Protection list, at the owner's request, and it
still does nothing.** This section said it was "deliberately absent, though it
works" — a live claim about a list that had already changed. It lowers the
target's attack power and `encounters/raidBoss.ts` gives the boss melee
`powerCoefficient: 0`, so the swing damage IS the whole swing and there is no
attack power term to reduce. It costs 10 rage and a global cooldown at about
80% uptime and changes no incoming damage. It becomes real the day a target's
damage is derived rather than stated.

**A rotation measured on one build is not measured for another.** The opener
priorities were measured on a dual-wielder and applied to the shield list too,
where Shield Slam was barely being cast — a shield warrior is rage starved in a
way a dual-wielder is not, and Sunder Armor's five stacks cost 75 rage ahead of
it. Measuring the shield list on its own put Shield Slam above the openers.

## Multi-target: a skeleton, not a feature

Four abilities strike more than one enemy in Forever and none can here, because
`trainingDummyEncounter` builds exactly one dummy and nothing in the engine has
ever created a second.

| Ability | Forever | Here |
| --- | --- | --- |
| Cleave | 2 targets | 1 |
| Whirlwind | up to 4 | 1 |
| Thunder Clap | **up to 4** | 1 |
| Sweeping Strikes | next 5 attacks hit one extra | nothing at all |

**THUNDER CLAP SAID "ALL NEARBY" HERE AND IN THE CODE**, where it declared
`maxTargets: Infinity`. The description's last sentence is "Will affect up to 4
targets", in every source including both captures — the cap was read past
because the clause before it sounded complete. It changes nothing against one
dummy, which is why it survived.

Each declares what it *would* hit through `Ability.targets`, so the claim lives
on the ability rather than in a comment nobody reads. Cleave, Whirlwind and
Thunder Clap are understated by exactly the targets they do not hit — which
against one dummy is the correct answer. **Sweeping Strikes is not understated;
it is inert**, 30 rage for no damage, and absent from every list.

## Talents

**43 of 53 are fully modelled, 4 partly and 6 inert — and THE LIVE GAP COLUMN IS
ZERO.** All six inert ones are permanently out of scope by ruling: Improved
Hamstring (movement), Booming Voice (radius), Iron Will (stun and fear),
Improved Disarm and Improved Shield Bash (both control effects, which is why
neither ability exists here), and Defiance (threat). Each carries a `scope` on
its `unmodelled` entry, so it is counted as a decision rather than as work.
Reprint with `npx vite-node tools/class_audit.ts warrior`.

**THE LAST LIVE GAP WAS IMPROVED BERSERKER RAGE AND IT WAS NEVER AN ENGINE
ONE.** Its reason read "grants rage on activation, and no priority list casts
Berserker Rage" — an argument about a LIST, recorded where this project keeps
arguments about the ENGINE — while its number, 5 and 10 by rank, sat in
`values/warrior.json` the whole time. It is granted the way Improved Charge's
rage is, and what is left of it is snare removal, which carries a `crowdControl`
scope. It still moves no published figure: no list casts the ability and no
profile spends a point there. **A talent working and a talent mattering are
different questions**, and only the first was ever a gap.

**Two CLAUSES are blocked on something that could change, both inside PARTLY
modelled talents, and neither can reach a profile:**

| | |
| --- | --- |
| Sweeping Strikes | needs a second target — see Multi-target. Every encounter has one enemy |
| Weaponmaster's mace-and-staff clause | ignores a percentage of target armor, and the damage pipeline has **no attacker-side armor term at any step** — re-checked 2026-09-30. Its axe/polearm crit and sword extra attack both work, and **every weapon in every Warrior gear set is a sword**, so no profile can reach either of the other two clauses |

**Weaponmaster's sword clause reads the weapon in the SLOT THAT SWUNG**, not
the character's weapon: an off-hand sword procs beside a main-hand mace and an
off-hand mace does not proc beside a main-hand sword. Reading "the character's
weapon" gets both backwards. The chance is 1% per rank, the talent's third
value, and the extra attack always swings the main hand — matching Hand of
Justice. The doc comment above it once claimed a reaction *cannot* see the
weapon, directly above code that had read `actor.weapons[slot]` since it was
written; the gate was correct and untested, and there is a matrix now.

### What Forever removed, and what it added

Recorded because an absence is a fact about Forever rather than a gap here.

| Tree | Removed |
| --- | --- |
| Arms | Axe, Mace, **Sword** and Polearm Specialization |
| Fury | Improved Demoralizing Shout, Improved Battle Shout |
| Protection | Improved Shield Block, Improved Taunt, One-Handed Weapon Specialization |

**Sword Specialization does not exist in Forever.** Its extra-attack mechanic
does — Weaponmaster's sword clause is the same effect. A comment naming Sword
Specialization as the source of the extra-attack rules is describing Classic.

Forever adds ten with no Classic equivalent, all present here: Spearing Strike,
Bloodthrill, Weaponmaster, Boundless Rage, Raging Blows, Precision, Master of
Defense, Vanguard, Bastion, Focused Rage.

## Three abilities Forever has that the simulator does not

All three re-confirmed against the new spellbook capture on 2026-09-30, and none
of them is reachable by any of the three profiles.

| | |
| --- | --- |
| **Victory Rush** | new in Forever, and needs a recent kill — genuinely inert against a single boss. The two sources disagree on its damage (`talentsforever` "15% of Attack Power", `foreverchanges.pro` "1 damage"), which nothing needs to settle while it cannot be cast |
| **Retaliation** | **15 min in Forever, down from 30.** Battle Stance, 15 seconds, at most 30 counterattacks. A real Arms cooldown once the target swings back — and the one profile in Battle Stance is the one whose target does not swing back, so it would be worth nothing to all three today |
| **Tactical Mastery** | no longer a talent; trained at 14, 10 rage retained. Stance-change rage is not modelled |

### The exclusion list, and it balances

**42 captured, 30 declared, and every one of the 12 that are not is named.**
This is the first class in the project with a reconciled account of its own
spellbook rather than a count; HANDOVER.md's "478 captured against 113 declared"
is the same arithmetic done nowhere else yet.

| | |
| --- | --- |
| **30 declared** | everything in the table above, plus the three stances |
| **3 above** | Victory Rush, Retaliation, Tactical Mastery |
| **9 out of scope by ruling** | Challenging Shout, Mocking Blow and Taunt are **threat**; Concussion Blow, Disarm, Intimidating Shout, Piercing Howl, Pummel and Shield Bash are **crowd control** — stuns, fears, snares, disarms, silences. Piercing Howl is the one the owner ruled out by name, and the other eight fall under the same two entries in CLAUDE.md's Scope table |

Nothing is declared that the spellbook does not have, which is the check in the
other direction and the one that catches an invented ability.

## Refreshing the data

```bash
node tools/import_spell.mjs --verify                      # re-fetch all 32 TOOLTIPS, diff, exit 1 on drift
node tools/import_spell.mjs --refresh                     # re-capture them
node tools/import_forever_spells.mjs warrior --write      # re-capture the SPELLBOOK
```

**THE WARRIOR NOW HAS BOTH**, and the two files are not interchangeable.
`forever-warrior-tooltips.json` is a capture of Forever's rendered TOOLTIPS and
effect rows, from a different source and a different importer, made before
`import_forever_spells.mjs` existed. It is the only place several Warrior
magnitudes were ever recovered from, because the effect rows carry numbers the
description used to hide. `forever-warrior-spellbook.json` is the eight-class
shape: the build number, the requirement lines, and Forever's own
"changed / same / new" flag against Classic.

**The file names are the difference**, which is why the tooltip capture was
renamed from `forever-warrior.json` rather than made to match the others.
Putting a differently-shaped file under the `-spellbook` convention is exactly
the trap that makes a loader special-case one class — and now that a real
spellbook exists for this class, a reader who assumed the old name meant one
would have been reading effect rows as requirement lines. Nothing globs these
files; every reader names one literally.

**RUN BOTH.** They fail differently and the 2026-09-30 check needed each:
`--verify` is what caught Slam's cooldown moving, and only the spellbook carries
Spearing Strike's weapon requirement.
