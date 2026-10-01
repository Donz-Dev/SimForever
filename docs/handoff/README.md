# The per-class deep dives

Nine documents, one per class, each the starting point for that class's own
context window.

**Read [CLAUDE.md](../../CLAUDE.md) first.** It is the rules, and roughly a fifth
of it is lessons paid for in wrong numbers. Then [HANDOVER.md](../../HANDOVER.md)
for project status. These files are the CLASS.

| Document | Profiles | Live gaps |
| --- | --- | --- |
| [warrior.md](warrior.md) | 2H Arms, DW Fury, Prot Warr | **1** |
| [paladin.md](paladin.md) | Seal Twist Ret, Shockadin, Prot Pally | **2** |
| [druid.md](druid.md) | Moonkin, Cat, Bear | **12** |
| [hunter.md](hunter.md) | BM Hunter, LW Ranged, LW Melee | **13** |
| [rogue.md](rogue.md) | Venom, Combat, Rupture | **14** |
| [mage.md](mage.md) | Frostfire, Arcane, Fire | **16** |
| [shaman.md](shaman.md) | Ele Shaman, Enh Shaman | **17** |
| [priest.md](priest.md) | Shadow | **18** |
| [warlock.md](warlock.md) | SM/DS, Firelock | **25** |

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

**Two talents are waiting on one mechanism because of it:** the Rogue's Quietus
(damage, 35%) and the Priest's Early Demise (crit, 20%). Both are missing
declarations rather than gaps in the ruling, and **whichever context builds it
should build it for both.**
