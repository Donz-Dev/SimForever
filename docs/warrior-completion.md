# Finishing the Warrior

What is left before the Warrior is a class you can trust end to end, from an
audit of the code on 2026-09-18 rather than from the status docs.

The Warrior already works: it can be built, geared, talented and fought, and
every number traces to a source. This is the list of what still does not, in the
order that buys the most.

---

## Where it actually stands

Measured with the full starting set, 12 seeds x 6 iterations, level 63 dummy:

| Build | DPS |
| --- | --- |
| Dual-wield, no talents | 120.17 |
| Dual-wield, a full Arms build | 160.60 |
| Two-hander, no talents | 119.27 |
| 1H & Shield, no talents | 78.65 |

> **HANDOVER's "roughly 140 DPS" is stale.** It was measured when every warrior
> was handed all three 31-point capstones at once. Gated, an untalented
> dual-wielder is 120 and a talented one 160.

| | Count | |
| --- | --- | --- |
| Abilities defined | 27 | from the ability spreadsheet |
| Abilities the rotation ever casts | **9** | the other 18 are inert, situational, or unreachable |
| Abilities that are castable but do NOTHING | **9** | 21 `PLACEHOLDER_*` constants behind them |
| Talents fully modelled | 25 of 53 | 7 partly, 21 inert |
| Items | 18 | one armour set, three weapons, one bow |
| Shields in the item data | **0** | the 1H & Shield style cannot fill its own slot |
| Armour enchants | **0** | only Crusader, for weapons |

---

## 1. Blocked on the ruleset owner

Nothing in this section can be done without data. It is first because it is the
largest single block of missing behaviour, and because asking costs nothing.

### 1.1 Effect values for nine abilities

Battle Shout, Demoralizing Shout, Sunder Armor, Recklessness, Berserker Rage,
Bloodrage, Shield Wall, Shield Block, and both non-Battle stances are
**castable and completely inert**. Costs and cooldowns are known; magnitudes and
durations are not. There are 21 `PLACEHOLDER_*` constants in
`game/auras/warrior.ts` holding the gaps.

They are deliberately absent from the rotation, because casting them would burn
a global cooldown for nothing and make the warrior look worse than it is.

**Ask for:** attack power granted by Battle Shout and removed by Demoralizing
Shout; armor per Sunder stack, max stacks, duration; Recklessness crit bonus and
duration; Bloodrage instant and per-tick rage; Shield Wall and Shield Block
magnitudes.

**Then:** fill the constants, delete the `PLACEHOLDER_` prefixes, and add each to
the rotation with a measured priority. Three of them — Battle Shout, Sunder
Armor, Recklessness — will move DPS materially.

### 1.2 Stance gating

**Corrections were promised and never arrived.** The sheet has no Battle Stance
row at all. Stances exist as auras, cost nothing, gate nothing, and are absent
from the rotation because stance dancing for no modelled benefit is pure loss.

Two talents wait on this: Improved Tactical Mastery and Vanguard.

**Ask for:** which abilities require which stance, and what each stance does.

### 1.3 Forever item data

The 18 items are **WoW Classic stand-ins**, not Forever items. The Tier 1
"Unstoppable Might" set is Season of Discovery. A Forever item of the same name
may carry different values.

**Ask for:** whatever item data exists. Failing that, the set is a usable
baseline and should be labelled as one — which
[`startingSets.ts`](../src/game/items/startingSets.ts) now does.

### 1.4 The five missing abilities

Sweeping Strikes, Death Wish, Piercing Howl, Last Stand and Concussion Blow are
talents that grant an ability, and none of those abilities is in the spreadsheet.
The grants are already declared, so they gate correctly the moment the abilities
exist.

**Ask for:** their rows.

---

## 2. Doable now, highest value first

### 2.1 Shields, and armour enchants

The 1H & Shield style **cannot fill its own shield slot** — there are no shields
in the item data at all. That style measures 78.65 DPS against dual-wield's
120.17, and some unknown part of that gap is simply a missing item.

Scraping a shield is one call to the tooltip endpoint documented in
`src/data/items/README.md`; no browser needed. The same pass could add armour
enchants, of which there are currently none.

**Done when:** a shield can be equipped, the starting set fills that slot, and
the three styles are comparable on equal footing.

### 2.2 Re-measure the rotation against real gear

`game/rotations/warrior.ts` puts Rend above Mortal Strike, and the comment is
explicit that the ordering was measured **against placeholder weapons** where
rage was scarce and a bleed ignoring armor was the best rage a warrior could
spend. The starting set changes the rage economy completely.

The Mortal Strike rage reserve (30) is a heuristic from the same era.

**Done when:** the priority list and the reserve are re-measured over a few
hundred iterations with the starting set, and the comment records the new
numbers. This is cheap and may be worth several DPS in either direction.

### 2.3 A block outcome and a block value stat

One stat and one table entry, and it fixes **four** things:

- Shield Slam is missing its "+ shield block value" component
- Revenge triggers on block in Classic, so it catches two thirds of what it should
- Shield Specialization (talent) is entirely unmodelled
- The 1H & Shield style has no defensive identity at all

**Done when:** `melee-received` can produce `block`, a block value stat exists,
and Revenge lists it among its trigger outcomes.

### 2.4 Make something attack the player

Five talents and three built-but-unreachable systems all wait on this single
gap: Table 6 (attacks received), rage from damage taken, and Revenge are all
implemented and tested, and none of them has ever fired in a real fight.

Blood Craze, Enrage, Master of Defense, Last Stand and Improved Revenge's
trigger are inert for this reason alone.

**Done when:** the training dummy swings back on a timer, with a damage figure
from the ruleset owner or a clearly flagged placeholder.

### 2.5 Wire the Import and Load buttons

`ProfilePanel.tsx` is **written and not mounted**. Its serialize-out,
parse-in and render-issues round trip is exactly what the Import and Load
buttons above the character name need, and those buttons currently call
`() => undefined`.

Profiles now carry talents and equipment, so saving a build is worth something
in a way it was not before.

**Done when:** a build can be exported to JSON, pasted back, and reproduce the
same fight.

### 2.6 Talents that need only wiring

Two remaining talent blockers need no new ruleset data:

- **Combat-start auras** — Anger Management and Death Wish. The aura mechanism
  exists, `trainingDummyEncounter` has the slot for opening buffs, and nothing
  connects a talent to it. Probably the cheapest remaining talent win.
- **Weaponmaster's sword clause** — needs a talent-granted reaction that
  triggers an extra attack. `extraAttack` exists in the engine; the effect would
  need to read the talent's *third* value rather than its first.

### 2.7 Defense skill

Player parry and dodge are wired and read from the character's stats. What is
missing is **defense skill only**: the attacks-received table uses flat ruleset
constants for boss miss, crit and crush, and shifting them by a skill comparison
needs a formula Forever has not given.

Anticipation is the one talent waiting on this. Worth asking for alongside 1.2.

---

## 3. Deliberately not doing yet

Recorded so nobody re-derives the decision.

| | Why |
| --- | --- |
| Threat, movement, stuns, multiple targets, shout radius | None matters against a single stationary dummy, and each needs an encounter model that does not exist. Seven talents sit here. |
| Dual Wield Specialization, Raging Blows | Partly modelling either would understate it by an unknown amount rather than visibly not working. |
| Re-scraping the other eight classes' talent structure | Real, but it is not Warrior work. See below. |

---

## 4. Standing risks

**The talent structure has only been corrected for Bastion.** Forever removed it
and moved Focused Rage into its slot, and that was found only because capturing
values tripped over it. The eight classes with no values captured could have
drifted the same way and nobody would know. A re-scrape is the honest fix.

**The unmodelled reasons go stale.** The classification has been wrong three
times — Improved Rend and Improved Overpower were filed as impossible before
per-ability scaling existed, and Unbridled Wrath's two-handed clause was written
off for want of a weapon type added an hour earlier. When a blocker above
clears, re-read every remaining reason rather than trusting it.

**Nothing here changes the fact that the items are Classic.** Every DPS figure
in this document is good for comparing builds to each other and nothing else.
