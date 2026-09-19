# Finishing the Warrior

What is left before the Warrior is a class you can trust end to end. Counts,
file claims and every DPS figure below were produced on 2026-09-18.

Read this alongside [talent-effects.md](talent-effects.md), which covers how a
talent expresses itself and every edge case the Warrior turned up.

---

## Where it stands

Starting set, level 63 dummy, **300 fights per row** with a 95% interval.
Reproduce with `npx vite-node tools/measure_rotation.ts`, which spells out the
talent builds it uses.

| Build | Standing target | Target swings back |
| --- | --- | --- |
| Dual-wield, no talents | **148.13** ± 1.83 | **224.04** ± 1.76 |
| Two-hander, no talents | **148.57** ± 1.60 | — |
| 1H & Shield, no talents | **90.01** ± 1.41 | — |
| 1H & Shield, 31-pt Protection | **101.37** ± 2.14 | **219.07** ± 2.52 |
| Dual-wield, 31-pt Arms | **187.41** ± 2.66 | — |
| Fury to Death Wish | **182.98** ± 2.17 | — |
| the same, without Death Wish | **171.39** ± 2.10 | — |

> The two columns differ by **rage from damage taken**, which is enormous. A
> damage warrior is not the one being hit, which is why `targetAttacks` is off
> by default. Treat the right column as a tanking scenario.

**These are not comparable to the figures published before 2026-09-18.** The
previous table read 118.97 / 119.07 / 81.33 / 160.60 and was measured before the
ten inert abilities had their effect magnitudes, so three of the rotation's
strongest actions were doing nothing. Filling them is worth **+28.32 DPS** on a
geared dual-wielder on its own.

The old table also recorded no talent builds, so its "Shield Slam" and "full
Arms" rows could not be reproduced by anyone. The harness now writes its builds
out talent by talent; both are 31-point capstone builds.

| | Count | |
| --- | --- | --- |
| Abilities defined | 27 | from the ability spreadsheet |
| Abilities a rotation casts | **14** | Battle Shout, Recklessness and Sunder Armor joined the list |
| Abilities castable that do NOTHING | **3** | was 10; see §1 |
| Talents fully modelled | 27 of 53 | 6 partly, 20 inert |
| Items | 19 | 1 is real Forever data, 18 are Classic stand-ins |
| Armour enchants | **0** | only Crusader, for weapons |

---

## 1. ~~The ten inert abilities~~ — SOLVED, and not the way this document said

Battle Shout, Demoralizing Shout, Sunder Armor, Recklessness, Shield Wall and
both non-Battle stances **now do what Forever says they do**. Only Berserker
Rage, Bloodrage and Shield Block are still inert, and each for a stated reason
below.

### The plan was wrong, and it would have produced wrong numbers

This document said the magnitudes were missing and had to come from the ruleset
owner, and that in the meantime the standing decision was to borrow WoW Classic
values under `PLACEHOLDER_` names.

**They were never missing.** `nether.wowhead.com/forever/tooltip/item/<id>` was
already known to serve Forever item data. The same host serves
`/forever/tooltip/spell/<id>`, and every one of these abilities is there with a
real Forever number.

Borrowing from Classic would have been confidently wrong:

| | Forever | Classic | The borrow would have been |
| --- | --- | --- | --- |
| Demoralizing Shout | −210 AP, 45 sec | −146 AP, 30 sec | **30% too weak** |
| Shield Wall | 60% for 12 sec | 75% for 10 sec | too strong, too short |
| Shield Block | +75% block, 7 sec, **2 attacks** | +75% block, 5 sec, 1 attack | half the blocks |

Three of the durations already on file as "plausible and *probably* fine" were
also simply wrong: Battle Shout is 3 minutes and not 120 seconds, Demoralizing
Shout 45 seconds and not 30, Shield Wall 12 and not 10.

### What the numbers are

Captured by `tools/import_spell.mjs` into `src/data/abilities/forever-warrior.json`,
transcribed into named constants in `src/game/auras/warrior.ts`, and
cross-checked against the stored tooltip by
`tests/game/warriorAbilityValues.test.ts`.

| Ability | Spell | Forever |
| --- | --- | --- |
| Battle Shout | 25289 | +140 attack power, 3 min |
| Demoralizing Shout | 11556 | −210 attack power, 45 sec |
| Sunder Armor | 11597 | −450 armor a stack, 5 stacks, 30 sec |
| Recklessness | 1719 | +100 crit, 15 sec, +20% damage taken |
| Shield Wall | 871 | −60% damage taken, 12 sec |
| Defensive Stance | 71 | −10% damage done, −10% taken |
| Berserker Stance | 2458 | +3 crit, +10% damage taken |
| Battle Stance | 2457 | **nothing at all** — confirmed, not assumed |

### What it was worth

Three of them are in the rotation with measured priorities. Ablation, 200
fights per row, geared dual-wielder:

| | DPS | Cost of removing it |
| --- | --- | --- |
| All three openers | 148.20 ± 2.38 | — |
| without Sunder Armor | 135.69 | **−12.51** |
| without Battle Shout | 136.37 | **−11.83** |
| without Recklessness | 142.87 | −5.33 |
| no openers at all | 119.88 ± 1.71 | **−28.32** |

**+28.32 DPS, about a quarter of the class's output**, was sitting in three
abilities that burned no global cooldown because the rotation correctly refused
to cast things that did nothing.

Whether the openers sit above or below the strikes is **not measurable**: 148.20
± 2.38 against 145.44 ± 2.13. They are kept above on principle, and the honest
statement is that the measurement does not object rather than that it agrees.

### Still inert, and why

| Ability | Why |
| --- | --- |
| **Berserker Rage** | Forever's own tooltip names **no magnitude** — "generating extra rage when taking damage". Its other half is Fear and Incapacitate immunity, which the engine has no notion of. Not a gap in the capture; a gap in the source. |
| **Bloodrage** | Forever gives the number — 10 rage instantly then 10 more over 10 sec, at 20% of base health. The aura has **no periodic and no rage-grant mechanism**, so this needs code, not data. |
| **Shield Block** | +75% block for 7 sec, limited to **2 attacks**. The per-attack charge cap is not expressible, and granting +75% block for a full 7 seconds without it would overstate it badly. |

**Demoralizing Shout is deliberately not in the rotation**, though it works. It
lowers the *target's* attack power, which does nothing to a standing dummy and
is actively negative when the target swings back — less damage taken is less
rage from damage taken. It is a survival cooldown in a simulator that does not
model survival.

---

## 2. Still blocked on the ruleset owner

Nothing here can be done without data, and asking costs nothing.

### 2.1 Stance gating

**Only the GATING is still missing.** What each stance *does* is now known --
Defensive is −10% damage done and −10% taken, Berserker is +3 crit and +10%
taken, and Battle Stance genuinely does nothing. Which abilities each stance
*requires* is not in the tooltips, and that is the part the rotation needs
before it can stance dance.

The spell tooltips do carry a "Requires Berserker Stance" line, which is a
lead rather than an answer: it appears on some abilities and the ability
spreadsheet contradicts none of it because the spreadsheet says nothing at all.
**Worth checking before asking again** — see §3.6.

Two talents wait on it: Improved Tactical Mastery and Vanguard.

**Ask for:** which abilities require which stance.

### 2.2 The five missing abilities

Sweeping Strikes, Death Wish, Piercing Howl, Last Stand and Concussion Blow are
talents that grant an ability, and none of those abilities is in the
spreadsheet. The grants are already declared, so they gate correctly the moment
the abilities exist.

**Ask for:** their rows.

### 2.3 Defense skill

Player dodge, parry and block are all wired and read from the character's own
stats. What is missing is **defense skill only**: the attacks-received table
uses flat ruleset constants for boss miss, crit and crush, and shifting them by
a skill comparison needs a formula Forever has not given.

Anticipation is the one talent waiting on it.

### 2.4 Forever item ids

The ids, and only the ids. The DATA is reachable — see §3.5, which is where the
tooling for it lives, because that part is not blocked at all.

**Ask for:** item ids. Anything with one can be imported today.

---

## 3. Doable now, no new data needed

### 3.1 ~~Re-measure the rotation~~ — DONE

`game/rotations/warrior.ts` put Rend above Mortal Strike on an ordering measured
**against placeholder weapons**, and the rage economy had changed twice since.

Re-measured on 2026-09-18 with `tools/measure_rotation.ts`, at 200-300 fights a
row instead of the 400 iterations of a single build the old note described.
**Rend above Mortal Strike survives** — it is still the most rage-efficient
thing a warrior does and still ignores armor, and Sunder Armor stripping 2250
armor does not change that ordering because the bleed was never subject to armor
in the first place.

What did change is the top of the list: Battle Shout, Recklessness and Sunder
Armor now sit above every strike, worth +28.32 DPS together.

**The 30-rage Mortal Strike reserve is still a heuristic and still unmeasured.**
It was not touched. That is the remaining piece of this item.

### 3.2 Wire the Import and Load buttons

`ProfilePanel.tsx` is **written and not mounted**. Its serialize-out, parse-in
and render-issues round trip is exactly what the Import and Load buttons above
the character name need, and those buttons currently call `() => undefined`.

Profiles now carry talents, equipment and the encounter switches, so saving a
build is worth something in a way it was not before.

### 3.3 Talents needing only wiring

- **Enrage** and **Master of Defense** — both were filed as blocked on nothing
  attacking the player, and both stopped being blocked when `targetAttacks`
  landed. Their per-rank values are already captured: Enrage is a 30% chance on
  being hit to deal 2–10% more physical damage for 12s, Master of Defense a
  50/100% chance of 5 rage on a dodge or parry with a shield. Each needs a
  talent-granted reaction, which is the shape Shield Specialization already
  uses on a block. **The cheapest remaining talent wins.**
- **Combat-start auras** — Anger Management and Death Wish. The aura mechanism
  exists and `trainingDummyEncounter` has the slot for opening buffs; nothing
  connects a talent to it.
- **Weaponmaster's sword clause** — needs a talent-granted reaction that
  triggers an extra attack. `extraAttack` exists, and effects can now read a
  talent's third value through `valueIndex`.

**Blood Craze stays inert, and for a real reason.** Its trigger is reachable
now, but it regenerates health, the player cannot drop below one health, and
survival is not modelled — so there is nothing for the heal to restore. It
becomes meaningful when survival does.

### 3.4 Armour enchants

There are none. Only Crusader, for weapons.

### 3.5 More Forever items

Not blocked — `https://nether.wowhead.com/forever/tooltip/item/<id>` **works**,
and the importer is written. Only the ids are missing (§2.4).

```bash
node tools/import_item.mjs forever <id>   # prints the entry to append
node tools/import_item.mjs --verify       # re-parses everything on file
```

`--verify` currently reproduces all 19 items exactly, which is why the tool can
be trusted with the next one.

### 3.6 Stance gating is partly answerable without asking

**The spell tooltips carry a stance requirement line.** Of the eleven captured
so far, four state one:

| Spell | Requires |
| --- | --- |
| Recklessness | Berserker Stance |
| Berserker Rage | Berserker Stance |
| Shield Wall | Defensive Stance |
| Shield Block | Defensive Stance |

The other seven state none, which is itself information: Battle Shout,
Demoralizing Shout, Sunder Armor and Bloodrage are castable in any stance.

**This does not close §2.1 on its own**, because only eleven spells have been
captured — the ones whose magnitudes were missing. Capturing the other sixteen
Warrior abilities would say whether Mortal Strike, Whirlwind, Overpower and the
rest carry requirements, and that is the whole of what the ruleset owner was
being asked for.

It is cheap: `node tools/import_spell.mjs forever <id>` per ability, and the
ids are on Wowhead. **Do this before asking again.**

Gating itself is a second piece of work: the engine would need `Ability.stance`,
a `canCast` check, and a rotation willing to spend a global cooldown swapping.
Two talents wait on that — Improved Tactical Mastery and Vanguard.

---

## 4. Done

Struck through rather than deleted, so finished work is not re-derived.

- ~~**A block outcome and block value**~~ — Shield Slam gained its missing damage
  component (+5.3 DPS), Revenge triggers on all three of its openings, Shield
  Specialization is modelled, and the shield's own block stats are real.
- ~~**Make something attack the player**~~ — `encounter.targetAttacks`. Brought
  the attacks-received table, rage from damage taken, Revenge and block to life,
  and exposed three bugs that could not show while nothing swung. **Five talent
  entries went on claiming it had not happened**, for three commits; see §5.
- ~~**Shields**~~ — The Immovable Object, the first real Forever item. It also
  settled that the missing shield was *never* why 1H & Shield lagged.
- ~~**A starting set**~~ — a Warrior begins geared, so the first number a person
  sees is one worth reading.
- ~~**The ten inert abilities**~~ — seven of ten filled from Forever's own spell
  data, not the Classic stand-ins this document planned for. Worth +28.32 DPS.
  See §1; the three that remain each name their own obstacle.
- ~~**Re-measure the rotation**~~ — done, with a reproducible harness that
  writes its talent builds out. The Mortal Strike rage reserve is the one part
  still unmeasured.

---

## 5. Standing risks

**The talent structure has only been corrected for Bastion.** Forever removed it
and moved Focused Rage into its slot, found only because capturing values
tripped over it. The eight classes with no values captured could have drifted
the same way and nobody would know.

**Unmodelled reasons go stale, and this is the failure mode that recurs.** The
classification has now been wrong **eight times, in two rounds**. The first
three — Improved Rend, Improved Overpower, Unbridled Wrath — were each blocked
on something that already existed. The second five all claimed nothing attacked
the player, three commits after something did: Enrage, Master of Defense and
Blood Craze stayed inert for a reason that had expired, and **Shield
Specialization and Improved Revenge were fully working while still printing a
caveat saying they could not fire.**

Two lessons, both paid for:

- **Clearing a blocker is not done until every reason that named it is
  re-read.** §4 recorded `targetAttacks` as finished and nobody swept the
  reasons; the count of fully-modelled talents was understated by two for three
  commits.
- **A test pinned to a temporary limitation outlives the limitation.** The
  Shield Specialization test was named *"still says it cannot fire, because
  nothing attacks the player"* and enforced the stale caveat instead of
  catching it. Assert what should stay true, not what happens to be true today.

**Survival is not modelled.** With `targetAttacks` on, a healer is *assumed*: the
character cannot drop below one health. Such a run says nothing about whether
they would live.

**Every absolute number is provisional, but less so than it was.** 18 of 19
items are still Classic and the boss swing figures are still Classic. The
ability magnitudes are no longer among the borrowed numbers — they are Forever's
own. Comparisons between builds hold; absolute DPS still does not.

**A source being reachable is not the same as it having been checked.** The
spell endpoint was available the entire time this document said the magnitudes
were missing and had to be requested. Nobody tried it, because the item endpoint
was filed under "items". Before recording anything as blocked on the ruleset
owner, try the obvious neighbouring URL.
