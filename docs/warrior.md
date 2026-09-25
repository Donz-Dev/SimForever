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

Four sources, and all four were needed.

| | |
| --- | --- |
| `WoWForeverWarriorAbilities.xlsx` | the ruleset owner's own sheet, outside the repo. Highest authority **except** where a capture overruled it below |
| `src/data/abilities/forever-warrior.json` | 32 spells captured from Forever's own client data. `node tools/import_spell.mjs --verify` re-fetches and exits 1 on drift |
| `foreverchanges.pro/spellbook/warrior` | the beta client diffed against Classic Era, per rank |
| `talentsforever.com/warrior` | the talent tree. Audited 2026-09-23: **53 of 53 talents and 154 of 154 rank values match** — the one audit in this project that found nothing wrong |

### What the simulator implements, at max rank

Every figure is the rank a level 60 trains. Where the sheet and a capture
disagreed, the ruleset owner chose Forever **every time**.

| Ability | Implemented | Sheet said | Why the sheet lost |
| --- | --- | --- | --- |
| Mortal Strike | weapon +160 | 160 | agree |
| Shield Slam | **655** + block value | 421–439 | rank 1 in the sheet; and see the rank rule below |
| Revenge | **153** | 81–99 | effect row, tooltip hid it |
| Slam | weapon **+87**, 15s cooldown | no bonus, no cooldown | three sources against it; rank 5, not rank 4 |
| Bloodthirst | **35% AP +48** | 30 + 0.35 AP | effect row 49; sheet gave rank 1 |
| Thunder Clap | +103, **6s** cooldown | 4s | the sheet's 4 is also Classic's, so it looked right from two directions |
| Demoralizing Shout | **−196** AP, 45s | no magnitude | description said 210, effect row −195 |
| Battle Shout | **+139** AP, 3 min | no magnitude | capture says 140 in both places; spellbook and the owner's raid list say 139, and the owner asked for the spellbook |
| Shield Wall | −60% taken, 12s, **15 min** | 30 min | 11 min off 15 leaves 4 exactly; off 30 it leaves 19, which nobody writes a talent for |
| Sunder Armor | −450 armor a stack, 5 stacks, 30s | no magnitude | — |
| Recklessness | +100 crit, 15s, +20% taken | no magnitude | — |
| Overpower | weapon +35 | agree | — |
| Heroic Strike / Cleave | +157 / +50 | agree | — |
| Hamstring / Intercept | +45 / +65 | agree | — |
| Execute | 600 + 15 per extra rage | agree | — |
| Rend | 147 over 21s | agree | — |
| Spearing Strike | 40% weapon damage | agree | — |
| Death Wish | +20% physical, +5% taken, 30s | absent | a talent grants it; the sheet has no row |
| Last Stand | +30% max health, 20s, lost on expiry | absent | as above |

**Ranges are gone from Revenge and Shield Slam**, which is a change in shape as
well as magnitude: both were a spread of ±9 and both are flat now, so any spread
they show comes from the combat table alone. Forever's effect rows give a single
base value and cannot say whether 655 is flat or a midpoint.

**The three that are still inert have each named their own obstacle**:

| | |
| --- | --- |
| **Berserker Rage** | Forever's tooltip names **no magnitude** — "generating extra rage when taking damage". A gap in the SOURCE, not in the capture. Its other half is fear and incapacitate immunity, which is out of scope |
| **Shield Block** | +75% block for 7s limited to **2 attacks**. A per-attack charge cap is not expressible, and granting the 7 seconds without it would overstate it badly |
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

**Demoralizing Shout is deliberately absent, though it works.** It lowers the
target's attack power, which does nothing to a standing dummy and is actively
negative when the target swings back: less damage taken is less rage. It is a
survival cooldown, and survival is a death count here rather than an outcome.

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
| Thunder Clap | all nearby | 1 |
| Sweeping Strikes | next 5 attacks hit one extra | nothing at all |

Each declares what it *would* hit through `Ability.targets`, so the claim lives
on the ability rather than in a comment nobody reads. Cleave, Whirlwind and
Thunder Clap are understated by exactly the targets they do not hit — which
against one dummy is the correct answer. **Sweeping Strikes is not understated;
it is inert**, 30 rage for no damage, and absent from every list.

## Talents

**43 of 53 are fully modelled, 3 partly and 7 inert**, and the tree is closer to
finished than that reads: **all seven inert ones are permanently out of scope by
ruling** — Improved Hamstring and Piercing Howl (movement), Booming Voice
(radius), Iron Will (stun and fear), Defiance (threat), Improved Disarm and
Improved Shield Bash (the ability is not implemented).

**Only three talents on this class are blocked on anything that could ever
change:**

| | |
| --- | --- |
| Sweeping Strikes | needs a second target — see Multi-target |
| Weaponmaster's mace clause | ignores a percentage of target armor, which the damage pipeline cannot express. Its axe/polearm crit and sword extra attack both work |
| Improved Berserker Rage | grants rage on activation, and no priority list casts Berserker Rage |

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

| | |
| --- | --- |
| **Victory Rush** | new in Forever, and needs a recent kill — genuinely inert against a single boss |
| **Retaliation** | **15 min in Forever, down from 30.** A real Arms cooldown once the target swings back, and not modelled |
| **Tactical Mastery** | no longer a talent; trained at 14, 10 rage retained. Stance-change rage is not modelled |

## Refreshing the data

```bash
node tools/import_spell.mjs --verify     # re-fetch all 32, diff, exit 1 on drift
node tools/import_spell.mjs --refresh    # re-capture
```

`src/data/abilities/forever-warrior.json` is named unlike the other eight
(`forever-<class>-spellbook.json`) because it came from a different importer.
