# The per-class deep dives

Nine documents, one per class, each the starting point for that class's own
context window.

**Read [CLAUDE.md](../../CLAUDE.md) first.** It is the rules, and roughly a fifth
of it is lessons paid for in wrong numbers. Then [HANDOVER.md](../../HANDOVER.md)
for project status. These files are the CLASS.

**THE WARRIOR AND THE PALADIN ARE DONE.** Both deep dives have run; read their
columns for what one looks like at the END rather than for how much work a class
needs. (The Warrior reached ZERO live gaps and sits at one again, which a patch
did rather than a regression -- see the note under the table.) The Paladin is the better lesson of the two: **six of the eight gaps it
closed were never engine gaps at all**, and their reasons were claims about the
engine that were about the wrong thing.

| Document | Profiles | Live gaps |
| --- | --- | --- |
| [warrior.md](warrior.md) | 2H Arms, DW Fury, Prot Warr | **1** |
| [paladin.md](paladin.md) | Seal Twist Ret, Shockadin, Prot Pally | **1** |
| [druid.md](druid.md) | Moonkin, Cat, Bear | **2** |
| [rogue.md](rogue.md) | Venom, Combat, Rupture | **3** |
| [shaman.md](shaman.md) | Ele Shaman, Enh Shaman | **6** |
| [hunter.md](hunter.md) | BM Hunter, LW Ranged, LW Melee | **8** |
| [mage.md](mage.md) | Frostfire, Arcane, Fire | **10** |
| [priest.md](priest.md) | Shadow | **12** |
| [warlock.md](warlock.md) | SM/DS, Firelock | **19** |

**FOUR OF THOSE COUNTS MOVED AT CLIENT BUILD 1.60.1.70170 AND THE WARRIOR'S WENT
UP**, which is the thing to expect from a patch rather than from a dive: Forever
added LINGERING RAGE, whose whole effect is the delay before rage decays after
leaving combat, and nothing here leaves combat. **A patch can open a gap in a
class somebody finished.** The Paladin, Mage and Warlock each lost one, every time
because a talent that carried a live gap was removed from the tree rather than
because anything was built.

**SO THESE NUMBERS ARE RE-DERIVED, NEVER ADJUSTED** --
`npx vite-node tools/class_audit.ts <class>` prints the four buckets and throws if
they do not account for every talent. The total is 62 across 466 talents.

## And one that is not a class

**[gui.md](gui.md) — the GUI and the miscellaneous tweaks around it.** The nine
class dives finished the simulation and none of them touched the UI, so it is the
first pass that part has had. It carries the project recap, how to run the app, the
two known panel bugs, and what the UI is made of.

**BOTH KNOWN BUGS ARE ENGINE WORK THAT OUTRAN ITS PANEL**, which is the shape to
expect: `appliedElsewhere` landed in the census and in `class_audit.ts` and never
reached the Talent panel, so two working Rogue talents are displayed as gaps.

## LAND THE SHARED ENGINE PIECES FIRST

**The ruleset owner's instruction after the first round of nine, and it is about
SEQUENCING rather than noticing.** These briefs already listed the shared items,
under the heading "four items want building once, not nine times". Nine parallel
contexts read that and **three of the four got built two and three times anyway.**

| Capability | Built by | |
| --- | --- | --- |
| the clock-conditioned per-ability modifier | **Priest and Rogue**, independently | twice |
| spell hit per school (`AbilityModifier.hitBonus`) | **Priest and the Mage/Paladin work**, independently — down to subtracting from miss | twice |
| the target-side per-ability modifier | **Mage and Rogue**, independently | twice |
| `abilityCritDamage`, reaching `critMultiplierBonus` | the **Warlock**, and the Rogue then REUSED it | **once** |

**A "build once" NOTE IN NINE PARALLEL BRIEFS IS NOT A MECHANISM.** Only landing
the thing on `main` before the dives start is. Identification was never the
failure — the briefs were right about all four — so the fix is an ordering and not
a louder warning.

**AND THE FOURTH ROW IS THE PROOF, NOT AN EXCEPTION.** `critMultiplierBonus` had
existed since Impale with nothing reaching it, and two classes wanted the same
declaration: the Warlock's Pandemic and the Rogue's Lethality. It was built **once**
— and the only thing that separates it from the three above is that **the Warlock
merged first**, so by the time the Rogue needed it the API was on `main` to point
at. Nothing about that capability was easier. The order was.

### What it cost

The duplicates were not wasted work so much as deferred reconciliation, and the
bill arrived on whichever branch merged last. The **Rogue** branched before five
other dives landed and came back carrying **seven** divergent APIs:
`abilityBelowTargetHealth`, `FightProgress`, `clockConditionsUnreachable`,
`abilityDamageTaken`, `abilityDamageTakenMultiplierFor`, `critMultiplier`, and a
flat `costReduction`. Reconciling it was a longer job than any single dive, and
every rename carried the risk this project exists to avoid: a plausible wrong
number. `costReduction` against `costFraction` is exactly that shape — one is
flat, one is a percentage, and reading either as the other compiles.

**TWO OF THE SEVEN WERE GENUINELY NEW AND HAD TO BE RESTORED RATHER THAN
TRANSLATED**, which is the part that makes a blanket "take main's side" wrong:
`costReduction` and `abilityCrit`'s `valueIndex`, the second of which was fixing a
real misreading where Puncturing Wounds gave Mutilate Backstab's number.

### How to do it next time

1. **Read the briefs for the shared items before dispatching anything.** They are
   the ones a brief names together with another class.
2. **Land those on `main` first, in one pass, with their own tests.** They do not
   need the class work to be useful, and they are small next to it.
3. **Then fan out**, with each brief pointing at the merged API by name rather
   than at a capability to build.
4. **And re-base a dive against `main` before it measures**, not after. Two dives
   did this unprompted and both reported deltas that were still true at merge; the
   ones that did not had figures taken against a base four merges old.

**THE CHEAPEST VERSION OF THIS RULE IS THE TRIAL MERGE.** The Mage dive merged
`priest-deep-dive` into itself before either landed, recorded the projected figures
as "not a baseline", and **its projection was exact** — Arcane 492.2, Fire 449.4,
Frostfire 437.8, all three confirmed by the republished baseline afterwards. That
is twenty minutes of work that told the next merger a surprise from an expectation.

## Every one of these numbers is re-derivable

**Do not trust a figure in these documents — reprint it.** A figure written by
hand into a document is a claim with a date on it, and this project has been
caught six times by a caveat that stopped being true while nobody touched it.

```bash
npx vite-node tools/class_audit.ts <class>       # census, gaps, per-profile structure
npx vite-node tools/ability_audit.ts            # every ability, every profile
npx vite-node tools/coefficient_probe.ts        # does each ability's damage scale
```

`class_audit.ts` derives the census from the effect tables and **throws if its
four buckets do not account for every talent**, which is how the hand-maintained
census in HANDOVER.md is checked rather than believed.

## What the four census columns mean

Decided from the DATA, not from prose: an `unmodelled` entry carries a `scope`
from the `OutOfScope` union when the owner has ruled its effect out, and nothing
otherwise. That is the whole difference between a decision and a gap.

| Column | Means |
| --- | --- |
| **Fully** | no `unmodelled` entry at all; every clause is expressed |
| **Partly** | has a working effect AND an unmodelled clause |
| **Ruled out** | no working effect, and every reason carries a `scope`. **Permanent** |
| **Live gap** | no working effect, and at least one reason carries no scope. **The actual queue** |

## The DPS in these documents is the baseline

30 batches of 10 with preset raid buffs, from [HANDOVER.md](../../HANDOVER.md).
**`class_audit.ts` prints its own one-batch figure and says so** — that one is not
comparable to the baseline and is not to be quoted.

## Three causes of inert, and they expire differently

Say which. Only the first is an engine gap.

| | |
| --- | --- |
| **the engine** | no declaration exists. Expires when one is built |
| **the target** | a raid boss is never killed, is not Undead. Expires only if the encounter changes |
| **the build** | the profile did not take it, or took a talent switching it off |

**A LOW-HEALTH REQUIREMENT IS NOT THE SECOND ONE.** `inExecutePhase` reads
remaining combat TIME against the last fraction of the planned duration, by the
owner's ruling — 20% for Execute and Hammer of Wrath, and **35% for the Rogue's
Quietus**, which the owner has now set. Three entries in this project explained a
silence as "the target never drops" and all three were wrong to.

~~**Two talents are waiting on one mechanism because of it**~~ **and the
mechanism is BUILT.** `AbilityModifiers.addWhileFinalFraction(fraction, ...)`,
keyed by FRACTION rather than by one constant — the Rogue's Quietus is 35% and
the Priest's Early Demise is 20%, and a shared `EXECUTE_PHASE_FRACTION` would
have handed one of them the other's window. Quietus is wired, which was safe
because no Rogue profile takes it. **Early Demise is one entry and is
deliberately not wired**: it moves a Priest figure and belongs with that class's
own re-measured baseline.
