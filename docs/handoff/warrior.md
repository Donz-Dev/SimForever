# WARRIOR DEEP DIVE — done

**Class:** Warrior
**Profiles:** 2H Arms, DW Fury, Prot Warr
**Dive completed:** 2026-09-30. **Live gaps: 0.**

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## Read this before anything else

**THE WARRIOR IS NOT THE NORM AND MUST NOT BE USED AS THE MODEL FOR EFFORT.** It
had **four** sources where every other class has one or two — **five** now — and
**eight of its numbers turned out wrong** the first time they were cross-checked:
Slam, Thunder Clap, Bloodthirst, Demoralizing Shout, Battle Shout, Shield Wall,
Revenge and Shield Slam. **Three more moved on the re-check below.** It is also
the only class with an owner spreadsheet (`WoWForeverWarriorAbilities.xlsx`), the
only one documented in `docs/` in its own right — [docs/warrior.md](../warrior.md)
— and it carries 2,025 comment lines against 268–529 for every other class.

**So its 0 live gaps is what a class looks like AFTER the work, not a class that
needed less.** Read any claim about this project's depth as a claim about the
Warrior until checked.

[docs/warrior.md](../warrior.md) has the full tooltip-reading rules and the
per-ability figures. **They are class-independent** and worth reading before
auditing any class.

---

## What this dive found

Everything below came from one thing: **the Warrior was the last class with no
spellbook capture**, so it was the only one whose data carried no build number
and could not be diffed by machine. Taking it was one command.

| | |
| --- | --- |
| **Spearing Strike requires a two-handed weapon** | stated by the spellbook capture and by `foreverchanges.pro`, absent only from the Wowhead tooltip we had. **DW Fury had been casting it all project**, and a test asserted that it did. Gated in `abilitiesForBuild` beside Shield Slam's shield |
| **Slam's cooldown is 18, not 15** | **build drift**, not a source disagreement: `--verify` re-fetched the same spell id and got 18, and so do both other sources. The 15 was right eleven days earlier against three sources including the owner's own word |
| **Improved Berserker Rage is built** | the last live gap, and never an engine one. Its reason argued from a priority LIST; its number, 5 and 10 by rank, was in the values file the whole time |
| **Berserker Rage's duration was never a placeholder** | "Lasts 10 sec", in all three sources. The `PLACEHOLDER_` reason was a claim about the owner's spreadsheet wearing the shape of a claim about the data. Nineteen placeholders become eighteen |
| **Thunder Clap hits 4, not "all nearby"** | the cap is the description's last sentence, in every source. It declared `Infinity` |
| **Five transcriptions CONFIRMED** | Forever stopped rendering `(100% of Spell Power)`, so Bloodthirst, Shield Slam, Revenge, Hamstring and Intercept now print 48, 640–670, 138–168, 45 and 65 — every one a figure read out of an effect row when nothing could state it |
| **Revenge and Shield Slam are exact midpoints** | 138–168 and 640–670. `docs/warrior.md` had recorded this as unanswerable |

Full record, with the method: [source-cross-checks.md](../source-cross-checks.md).

---

## The profiles

| Profile | Talents | DPS | List | Style / stance |
| --- | --- | --- | --- | --- |
| DW Fury | 18/33/0 | **729.2** | `WARRIOR_DUAL_WIELD_BERSERKER` | dual wield, Berserker |
| 2H Arms | 38/13/0 | **667.8** | `WARRIOR_TWO_HAND_BATTLE` | two-hander, Battle |
| Prot Warr | 17/0/34 | **480.4** | `WARRIOR_SHIELD_DEFENSIVE` | 1H & shield, Defensive, **target attacks back** |

**DW Fury and 2H Arms are the two highest profiles in the project.** Prot Warr is
sixth. Anything that moves a shared melee rule shows up here first and largest.

**BOTH CORRECTIONS MEASURED AS NOISE**, 30 batches of 10: 2H Arms 607.2 → 603.3
(−3.9, ±9.1) and DW Fury 652.0 → 651.2 (−0.8, ±8.9), with the other twenty-one
identical to the decimal. **The uses column is what says a list changed**, and it
changed a lot: Slam went 2.9 casts a fight to 2.5, and Spearing Strike went 2.7
to **zero** — its 15 rage going straight into Heroic Strike, 9.0 casts to 11.0.
**Losing an ability outright cost 0.8 DPS**, which is what a rage-bound build
looks like: the bar is the constraint, not the ability list.

### Deep Wounds, ruled and corrected 2026-10-05

**THE LARGEST SINGLE CORRECTION ON THIS CLASS SINCE THE PRIORITY LISTS.** 2H Arms
**+43.2**, DW Fury **+62.0**, Prot Warr **+11.4**, and nothing else in the project
by a decimal. The ruleset owner stated three clauses and all three were wrong: it
could crit, it ticked every three seconds rather than every two, and a
re-application reset the clock while DISCARDING the undelivered damage.

| Clause REMOVED from the finished build | 2H Arms | DW Fury | Prot Warr |
| --- | --- | --- | --- |
| **the rollover** | **-43.9** | **-68.5** | **-12.8** |
| "it cannot crit" (crit restored) | +18.8 | +30.9 | +10.5 |
| the two-second cadence (back to three) | -2.4 | -3.1 | -1.3 |

**THE ROLLOVER IS NEARLY ALL OF IT, AND THE REASON IS A RATE ARGUMENT.** Deep
Wounds refreshes on every melee crit, far more often than once per twelve seconds,
so under `reset` alone most of each application never ticked. Rolling the
remainder forward means every crit's worth eventually lands.

**THE ROWS DO NOT SUM** -- they are each that clause taken out of the FINISHED
build, and the three interact hard because the crit multiplier scales whatever the
pool is delivering. Reading them as independent terms is wrong by a third.

**THE CADENCE WAS ALMOST FREE**: six sixths and four quarters deliver the same
pool over the same twelve seconds.

**AND ONE INTERPRETATION IS LEFT.** Deep Wounds' TRIGGER is still gated on
`isWeaponUse` -- the owner widened FLURRY's to any non-DoT crit and said nothing
about this one, so the two reactions now differ deliberately. Its tooltip says
"your critical strikes" with no melee qualifier, but its damage is explicitly "of
your melee weapon's average damage", which is what makes the weapon gate
defensible. Worth asking.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| 2H Arms | Main Hand 41.4%, Mortal Strike 17.7%, Overpower 14.7%, Execute 7.4%, Rend 5.5%, Deep Wounds 5.4% |
| DW Fury | Main Hand 22.5%, Heroic Strike 19.5%, Off Hand 17.5%, Bloodthirst 13.8%, Execute 11.8%, Whirlwind 5.8% |
| Prot Warr | Heroic Strike 32.3%, Revenge 21.7%, Shield Slam 19.1%, Main Hand 12.4%, Thunder Clap 6.4%, Rend 4.5% |

**PROT WARR IS THE ONLY PROFILE IN THE PROJECT WHOSE AUTO ATTACK IS NOT ITS
LARGEST SOURCE**, and the only one where the target swings back. Its rage income
is partly from damage TAKEN, which is why Bastion's 10% damage multiplier measures
as ~12% DPS: more damage buys more rage buys more casts. Treat it as a different
animal from the other two.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 53 | 43 | 4 | 6 | **0** |

Reprint with `npx vite-node tools/class_audit.ts warrior`, which derives it from
the effect tables and throws if the four buckets do not account for every talent.

### No live gaps

All six inert talents carry a `scope`: Improved Hamstring (movement), Booming
Voice (radius), Iron Will (stun and fear), Improved Disarm and Improved Shield
Bash (control effects, which is why neither ability exists here), Defiance
(threat).

### Partly modelled — four, and two of the four clauses could ever change

| Talent | What is missing | Can it reach a profile? |
| --- | --- | --- |
| `sweeping_strikes` | its whole effect is an extra target and every encounter has one enemy | **no**, until an encounter has two |
| `weaponmaster` | the mace-and-staff clause ignores a percentage of target armor, and the damage pipeline has **no attacker-side armor term at any step** (re-checked 2026-09-30) | **no** — every weapon in every Warrior gear set is a sword, so only the implemented sword clause is reachable |
| `improved_berserker_rage` | snare removal, `crowdControl` | ruled out |
| `piercing_howl` | **NOT TO BE IMPLEMENTED** — the owner ruled it out | ruled out |

---

## Never-fired entries — five now, and all five deliberate

| Entry | Profiles | Why |
| --- | --- | --- |
| `battle_shout_cast` | all three | **the encounter already supplies it** as a preset raid buff, so the cast is refused all fight |
| `battle_stance_cast` | 2H Arms | the preset already opens in Battle Stance |
| `berserker_stance_cast` | DW Fury | as above |
| `defensive_stance_cast` | Prot Warr | as above |
| `spearing_strike` | DW Fury | **NEW.** It needs a two-hander and that list is only reached by a dual-wielder |

**THE FIRST FOUR ARE KEPT ON PURPOSE** and must not be "fixed". A character built
by hand in another stance needs the stance casts, and they cost a build that does
not need them exactly nothing. Battle Shout's entry carried a **"+11.83 DPS"
comment measured before raid buffs were selected rather than assumed**; the figure
was right on the day and the comment now says so.

**THE FIFTH IS THE OWNER'S AND IS LEFT AS WRITTEN.** It was added because the
point in DW Fury's build looked wasted, which it was — for a reason nobody had
read. Taking the entry out, and moving the talent point, are both their calls.

**AND THE TWO AUDITS DISAGREE ABOUT IT, WHICH IS USEFUL.** `class_audit.ts` lists
`spearing_strike` under LIST ENTRIES NEVER FIRED; `ability_audit.ts` does not,
because it only reports a listed entry whose ability the build actually has. That
is exactly the fourth cause of a never-fired entry — the build never learned it —
and only one of the two tools shows it.

## In the book, in no list, never cast

`slam`, `whirlwind`, `overpower`, `revenge`, `hamstring`, `thunder_clap`,
`intercept`, `execute`, `cleave`, `rend_cast`, `demoralizing_shout_cast`,
`recklessness_cast`, `berserker_rage_cast`, `shield_wall_cast`,
`shield_block_cast`, `charge`, `sweeping_strikes` — **varying by profile**, and
most are correct: a two-hander does not Revenge, a Berserker cannot Thunder Clap,
Cleave and Sweeping Strikes are area damage against one enemy.

**`berserker_rage_cast` IS THE ONE WORTH RE-READING** now that Improved Berserker
Rage is built. The ability's own effect is still unstated by every source, so it
is a global cooldown for nothing to a warrior without the talent — which is all
three profiles. A build that spent a point there would want the entry back and
would want it measured.

---

## Traps specific to this class

- **THE OVERLOADED TABLE.** Thunder Clap, Intercept and Charge are melee abilities
  declaring `ranged-special`, because that table has no dodge or parry and because
  it is how `isWeaponUse` excludes them. **Check the class's own abilities, not a
  table name**, before scoping anything to a table.
- **A dual-wielder has two combat tables, not one shown twice.** Miss and enemy
  dodge derive from the WIELDING weapon's skill. Anything reporting them must ask
  per slot.
- **Shield Slam triggers MAIN HAND effects**, settled by the owner because the
  rule alone did not answer it.
- **TWO ABILITIES ARE GATED ON THE WEAPON AND NOT ON A TALENT OR A STANCE**, both
  in `abilitiesForBuild`: Shield Slam needs a shield, Spearing Strike a two-hander.
  A third belongs there and not in `canCast` — an ability that stays in the book
  and is always refused reads as a rotation problem.
- **Rage is a flat rate per swing, not a share of damage.** `R × S`, R being 3.46
  one-handed and 4.5 two-handed, S the BASE speed. Speed cancels, so haste raises
  nothing — **except that an extra attack pays a full `R × S` for a swing that
  cost no time.**
- **Prot Warr's Revenge costs 2 rage on the built character**, not what the
  ability declares. Read costs off `characterAtCombatStart`.
- **`WARRIOR_BATTLE` (14 entries) and `WARRIOR_SHIELD` (15) are still shells and
  NO PRESET REACHES THEM** — the fallbacks for a shield in Battle Stance or a
  dual-wielder outside Berserker. A test pins them so a third does not quietly
  join them. Do not measure them as if they mattered. **Their `spearing_strike`
  entry is now unreachable for the same reason the Berserker list's is**: neither
  fallback is chosen for a two-hander.
- **`protectionTalents.test.ts`'s Bastion DPS-ratio test is rotation-sensitive**
  with about 6% of headroom either way, and it moves with the Prot list. It reads
  1.1224 today and has read 1.089 to 1.16 on code that never touched the talent.
  **It is not testing the multiplier** — the exact 1.1 is asserted next door on
  `baseDamageMultiplier`. Expect it to move if you touch the Prot list.

---

## What is left, and none of it is a gap

Four things, and every one is a decision for the ruleset owner rather than work
anybody can do from the sources.

1. **DW Fury's point in Spearing Strike, and the Berserker list's entry for it.**
   Both are the owner's. The entry is worth nothing now and was worth about one
   DPS before, so moving the point is worth roughly what the talent it moves to
   is worth.
2. **Berserker Rage's magnitude.** "Generating extra rage when taking damage",
   with no number in any source and no effect row carrying one. Unanswerable from
   the data; one message answers it.
3. **Retaliation.** 15 minutes in Forever, Battle Stance, 15 seconds, at most 30
   counterattacks — a real Arms cooldown once the target swings back. The one
   profile in Battle Stance is the one whose target does not, so it is worth
   nothing to all three profiles today and would be worth measuring the moment
   an attacking Arms encounter exists.
4. **The two placeholders left on the class**, down from three.
   `PLACEHOLDER_REVENGE_WINDOW_MS` is five seconds: reactive windows are not a
   spell and have no tooltip, and the owner settled the OVERPOWER window at six
   without this one being asked about. `PLACEHOLDER_FLURRY_DURATION_MS` is a
   twelve-second backstop behind a three-swing charge count — the charges are
   stated and run out first, so nothing should ever reach it, and it is flagged
   rather than presented as ruleset data.
