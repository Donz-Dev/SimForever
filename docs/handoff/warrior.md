# WARRIOR DEEP DIVE — done

**Class:** Warrior
**Profiles:** 2H Arms, DW Fury, Prot Warr
**Dive completed:** 2026-09-30. **Live gaps: 1** -- it finished at 0 and client
build 1.60.1.70170 added a talent nothing here can reach. See the patch note
below.

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The two damage Warriors, optimised

**THE ROUND WHERE THE WHOLE ANSWER WAS AN ABILITY ALREADY IN THE BOOK.** Both
trees turned out to be completely forced and every enchant but one and every
consumable was already right -- so all but 1.7 of the two figures below came out
of the priority lists, and 94 of it from a single entry neither list had.

**AND THAT ENTRY SHIPS SWITCHED OFF, WHICH IS THE OWNER'S CALL.** So what
actually lands is +23.1 and +7.7, and the 94 is sitting in the list behind a
closed eye. The measurement is why that is a usable state rather than a lost
finding.

| | spread | was | ships at | with Recklessness enabled |
| --- | --- | --- | --- | --- |
| **2H Arms** | 39/10/2 | 849.7 | **872.8** | **897.2** |
| **DW Fury** | 17/34/0 | 989.6 | **997.3** | **1092.6** |

**THE TWO COLUMNS ARE THE OWNER'S RULING AND NOT A HEDGE**: Recklessness is in
both lists and **switched off**, so the published figure is the third column and
the fourth is what opening the eye is worth. See below.

Both trees loaded in the calculator: **"all 51 spent"**, nothing refunded.

- 2H Arms — <https://talentsforever.com/warrior/60/30325213132515201-0505-2-CA2FAE2HE2KJIMNOLQSUEGiD-6>
- DW Fury — <https://talentsforever.com/warrior/60/30305013002-05253005122210501--SUVTYZbdfha1ACE4HEGKa-6>

### What moved

| | |
| --- | --- |
| **2H Arms: Hamstring at 20 rage, at the bottom** | **+26.74**. Pressed for its procs, not its damage |
| **DW Fury: Enrage 4 -> 2, Improved Berserker Rage 2, and an entry for it** | **+6.02**. The talent alone is bit-identical |
| **2H Arms: boots, Minor Speed -> +7 Agility** | **+1.72**. The one slot in either build that was granting nothing |

And in the lists, **switched off**, worth this much to whoever opens the eye:

| | |
| --- | --- |
| **DW Fury: Recklessness above Death Wish** | **+94.15**. Free, Berserker Stance, +100 crit chance for 15 seconds of a 60-second fight |
| **2H Arms: Recklessness last, under the Hamstring entry** | **+37.91**, and **+57.29** for the pair |

### This section said both of these abilities were in no list, and called the set mostly correct

The list under **In the book, in no list, never cast** has named
`recklessness_cast` and `berserker_rage_cast` for the life of this document,
under a sentence reading *"most are correct"*. One of them was correct and the
other was **94 DPS**, which is 9.5% of the profile and the largest single figure
this class has produced.

**A LIST OF WHAT IS ABSENT IS NOT CHECKED BY ANYTHING THAT COMPILES**, which is
this project's own rule about the Paladin's Hammer of Wrath -- listed as a spell
the file did not declare, forty lines above its declaration. The same shape, one
layer up: an enumeration of absences with a blanket judgement over it. The list
held **seventeen** abilities and **three of them went into a list this round** --
Recklessness **+94.15**, Hamstring **+26.74**, Berserker Rage **+6.02** -- so it
was right about fourteen and wrong about three.

**AND THE ENTRY IT WAS RIGHT ABOUT WAS WRITTEN UP AS THE ONE TO RE-READ.**
`berserker_rage_cast` carried its own paragraph -- *"A build that spent a point
there would want the entry back and would want it measured"* -- and that is
exactly what happened. It is worth **+6.02**. Recklessness, which carried no
paragraph at all, was worth fifteen times as much.

### Recklessness ships switched off, on the owner's instruction

> *"Recklessness is fine to implement and put in the rotation for DPS warrior.
> But use the glyph to have it be default disabled in the APL."*

**SO THE PUBLISHED FIGURES DO NOT INCLUDE IT, AND THE ENTRY IS STILL THERE WITH
EVERY BYTE OF ITS MEASURED PLACEMENT.** `AplEntry.disabled` is the flag and
`compileRotation` filters `disabled !== true` once, when the character is built.

| | ships at | with the eye opened |
| --- | --- | --- |
| **2H Arms** | **872.8** | **897.2** |
| **DW Fury** | **997.3** | **1092.6** |

**THIS IS THE FIRST STOCK LIST IN THE PROJECT TO CARRY THE FLAG.** It was built
as an EDITING convenience -- *"so that trying something does not cost the
line"*, switching an entry off rather than retyping its condition to put it
back -- and nothing shipped holding one. So this is a new use of an existing
field rather than a new field, and it is the honest way to carry a measured
option the owner wants off: **deleting the entry would lose the measurement and
the placement with it**, and an entry with no measured position is one somebody
has to measure again before they can use it.

**AND IT CREATED A FIFTH CAUSE OF A NEVER-FIRED ENTRY, WHICH THE TOOL COULD NOT
TELL FROM A DEFECT.** `measure_profiles.ts` with `USES=1` printed
`recklessness_cast 0.00 uses <-- NEVER FIRED` on both profiles -- the loudest
flag that tool has, pointed at the one cause that is a SETTING. It reads
`(switched off in the list)` now, which is the same fix as
`(not learned by this build)` and for the same reason: **a zero has to say which
kind it is, or the flag that means "this is the bug" stops meaning anything.**

**WHAT TURNS OFF WITH IT IS IMPROVED TACTICAL MASTERY.** Its five points are
live only while the Arms list dances for Recklessness, so with the eye closed
`battle_stance_cast` is back to **0.00 uses** and the talent is a pure
prerequisite again. Both states are correct and the talent cannot move either
way -- Anger Management requires it at full rank -- but the note below belongs
to the eye being open.

### Recklessness, and why the right placement is the opposite on the two builds

Fifteen seconds at +100 crit chance is two things at once for a Warrior, and the
second is easy to miss: `critRageMultiplierFor` is **2.0**, so a window in which
every blow crits roughly **doubles rage income** as well. Flurry is also
permanently up inside it on the Fury build.

**DW FURY IS ALREADY IN BERSERKER STANCE, so the entry is free and goes high.**
Five placements, with the best three re-measured at 1,500 and 4,000 iterations
because they fell inside each other's intervals at 400:

| | |
| --- | --- |
| above Death Wish, unconditional | **+94.15** |
| at the bottom | +91.56 |
| gated to overlap Death Wish, at 35s left | +87.33 |
| at the pull | +79.38 |
| in the execute phase | +66.05 |

**SO PAIRING THE TWO DAMAGE COOLDOWNS IS WORSE THAN NOT PAIRING THEM**, which is
the one result here that reads backwards. Death Wish's window opens at 35
seconds remaining; a 30-minute cooldown held for it spends the first half of the
fight unused, and fifteen seconds of guaranteed crit is worth more early than it
is worth stacked.

**2H ARMS HAS TO DANCE FOR IT, AND THEREFORE GOES LAST.** Recklessness requires
Berserker Stance, `PriorityRotation` will cast a stance change to reach an
ability, and the Arms list's own `battle_stance_cast` entry sits above Heroic
Strike and brings it straight back. At the bottom the dance happens in a moment
the list had nothing castable for anyway -- **+40.24 against +34.28** above
Heroic Strike.

**AND THE DANCE MAKES IMPROVED TACTICAL MASTERY LIVE -- WHILE THE EYE IS OPEN.**
Those five points retain up to fifteen rage across a stance change, and this
list makes none with the entry switched off, so **the talent is live or dead
depending on one checkbox**. It was held either way only because Anger
Management requires it at FULL rank, which is what makes this harmless: there is
no allocation decision riding on it.

**A TALENT THAT WAS PURE PREREQUISITE CAN BE WOKEN BY A LIST EDIT**, which is
the inverse of every "this talent is dead" finding in this round and is the part
worth carrying forward. `battle_stance_cast` measured **0.00 uses for the life
of this list**, is **0.00 as shipped**, and is about **1.1 a fight** with the eye
open -- the return leg, which is what `armsRotation.test.ts` drives by opening
it rather than by reading the shipped preset.

### Hamstring is +26.7 on one build and -33.3 on the other

It is 10 rage for a flat 45 damage, which is nothing -- **1.2% of 2H Arms'
damage table at 11.7 uses a fight**. What it is worth is its TRIGGERING: it is a
weapon use, so Crusader, Weaponmaster's extra attack, Unbridled Wrath's rage and
Deep Wounds all roll on it. The same shape as the melee Hunter's Wing Clip,
where the triggering was the larger half of a +41.2.

**WHAT DECIDES IT IS WHETHER THE LIST HAS AN IDLE GLOBAL COOLDOWN**, and the
engine's own event count says so without any inference. On 2H Arms the fight
goes from **33 casts and 351 processed events to 42 casts and 247**: nine more
casts for a hundred fewer events, because every idle 100ms rotation poll that
becomes a cast removes several polls. DW Fury moves **44 casts and 449 events to
48 and 427** -- barely at all, because Heroic Strike already spends every spare
rage and there is no idle moment to put a filler in.

**SO THE INVERSE OF THIS PROJECT'S USUAL EVENT-COUNT READING.** A change that
RAISES `eventsProcessed` for an identical log is a cost paid in time; one that
LOWERS it while raising the cast count is an actor that is idle less, and it is
the cheapest confirmation available that a filler is filling something.

**AND THE GATE IS NOT ITS COST.** Twenty rage, swept rather than compared:
ungated **+54.80**, at 10 **+54.80**, at 20 **+57.29**, at 30 **+57.54**, at 60
**+47.96**. `atLeast 10` is IDENTICAL to ungated to the decimal because that is
the ability's own cost restated and `checkCast` already enforces it. Twenty and
thirty are indistinguishable at 2,000 and swap places at 4,000, so twenty is
asserted as the SAFE boundary rather than a tight one -- ten rage of headroom
above the cost, so the entry cannot drain the pool toward the next Mortal Strike.

### Both trees are completely forced, and a full-rank prerequisite is why

**NEITHER BUILD HAS A LIVE TALENT BELOW MAXIMUM.** Between them they carry
fourteen points that do nothing, and only two of the fourteen could move:

| | | why it cannot move |
| --- | --- | --- |
| **Improved Tactical Mastery 5** | 2H Arms, DW Fury | **Anger Management requires it at 5/5.** `requiresRanks` is 5, not 1 |
| **Improved Rend 3** | DW Fury | **Deep Wounds requires it at 3/3**, and Rend cannot be cast in Berserker Stance at all |
| **Sweeping Strikes 1** | 2H Arms | Mortal Strike's prerequisite. Area damage against one target |
| **Enrage 4** | DW Fury | Bloodthirst needs thirty points below tier 30 of Fury and there are thirty-three, so **two is the most that can leave** |
| **Lingering Rage 2** | DW Fury | Fury sits EXACTLY on its tier-15 boundary -- 5+2+5+3 is fifteen -- so taking either point strands Dual Wield Specialization, Raging Blows, Enrage AND Improved Execute at once |

**`requiresRanks` IS NOT ALWAYS 1, AND THAT IS WHAT MAKES A DEAD POINT
MANDATORY.** Three of the Warrior's seven prerequisites ask for the FULL rank --
Anger Management on Improved Tactical Mastery 5/5, Deep Wounds on Improved Rend
3/3, Gore Drinker on Enrage 5/5 -- against four that ask for one. So "this talent
does nothing, move its points" is a claim that has to be checked against the
prerequisite GRAPH and not only against the tier arithmetic: the first three
variants written this round were illegal for exactly this reason and
`buildVariants.ts` refused all three, naming the nine talents each would have
stranded.

**AND THE TWO POINTS THAT COULD MOVE HAD NOWHERE DEAD-FREE TO GO.** Enrage 2,
Blood Craze 2 and Booming Voice 2 all measured **BIT-IDENTICAL FIGHTS** holding
the leftover pair -- three dead destinations proven equally dead -- so the choice
of where they sit is legibility rather than DPS, and Enrage keeps them.

**ENRAGE'S OWN FOUR ARE THE `target` CAUSE OF INERT, NOT AN ENGINE GAP.** "After
being the victim of any damaging attack", and both presets set
`targetAttacks: false` -- it reports no uptime at all. It expires the day
somebody hits a damage Warrior.

### Everything else was already optimal, and the enchants are a clean sweep for strength

**ONE SLOT IN EITHER BUILD WAS GRANTING NOTHING**: 2H Arms' boots carried MINOR
SPEED, which is `unmodelled`. +7 Agility is **+1.72** and +7 Stamina runs
**BIT-IDENTICAL FIGHTS** -- which is what makes the agility figure the slot's
whole value rather than noise, because nothing attacks a damage Warrior.

**AND STRENGTH BEAT AGILITY IN EVERY SLOT THAT OFFERS THE CHOICE, ON BOTH
BUILDS.** Plate is 2 attack power a strength against agility's 1 plus a
twentieth of a crit: neck **-1.75**, wrists **-2.20**, gloves **-2.22** on 2H
Arms, and -1.27, -2.14, -3.12 on DW Fury. **+1% Haste is not a Warrior stat
here** either -- -2.57 a slot on Arms, -2.96 on Fury, and -6.23 and -7.46 in the
gloves where it displaces fifteen strength. Crusader stays on every weapon:
+25 Agility is **-6.56** on the two-hander and **-13.57** across both of Fury's.

**THE FLASK IS A DEAD SLOT ON BOTH AND BOTH OPTIONS ARE INERT.** +1200 Hit
Points against +150 Spell Power runs bit-identical fights on a build nothing
attacks and which casts nothing. Recorded because a dead row looks like an
oversight and is not -- the same finding as the Moonkin's two dead enchants.

**AND THE REST OF THE CONSUMABLE ROW IS CONFIRMED RATHER THAN CHANGED.** Mighty
Rage beats Major Frenzy by **21.1** on Arms and **38.0** on Fury; the melee
weapon stone beats the caster one by 14.5 and 42.6; Blasted Lands strength beats
agility by 2.4 and 7.1. The owner's strength-food ruling holds on both, and by a
figure small enough to be worth stating: **-0.95 and -1.17** against +40 Attack
Power, with a spread of 0.1 -- a real difference and a tiny one.

### What this round leaves open

**NINETY RAGE ON 2H ARMS' HEROIC STRIKE, WHICH IS THE OWNER'S OWN NUMBER** --
respecified from 75 when they gave the list. Re-swept with the two new entries
in, it reads **+61.24 at 70, +58.38 at 80, +57.29 at 90, +58.53 at 100**, so the
peak has moved toward 70 and has not arrived there: 70 against 90 is 3.95 with a
combined interval of 4.73 at four thousand iterations, and two variants measured
against the same baseline are not paired with each other. **WITHOUT** the new
entries, 70 measured -4.30 and 50 measured -27.84.

So the floor stays where the owner put it and the figure is recorded rather than
acted on. **A crit pays a Warrior double rage, so Recklessness changes the exact
quantity this threshold rations** -- which is why it was re-swept at all rather
than carried over, and why it is worth asking about.

DW Fury's own 42 is confirmed: 36 is indistinguishable (+94.91 against +94.94),
50 is -3.7 and 60 is -10.7.

### Three things measured as losses and are correctly absent

| | |
| --- | --- |
| **Cleave at the bottom of the Fury list** | **-128.95**. An on-next-swing ability at 17 rage, always affordable, starving Bloodthirst and Execute from beneath -- the documented rule, at its full price |
| **Sweeping Strikes on 2H Arms** | **-10.45**. 30 rage for an additional nearby opponent, and there is one target. It is in the book, in no list, and holds Mortal Strike's prerequisite point |
| **Thunder Clap on 2H Arms** | -2.54, noise. Castable in Battle Stance, 20 rage, and it loses to leaving the global cooldown free |

And two orderings that are already right: **Execute above Overpower is -34.18**
and **above Slam is -11.23** on Arms, so Execute belongs below both; the Slam
swing window is flat from 500ms to 1500ms and only 750ms is distinguishable, at
-2.88.

---

## Client build 1.60.1.70170 — the largest reshuffle of any class

**ALL THREE BUILDS WERE RE-SPECIFIED and the owner supplied all three URLs with
the patch notes.** DW Fury **790.4 → 892.0 (+101.6 REAL)**, 2H Arms
**721.5 → 784.1 (+62.6 REAL)**, Prot Warr 499.3 → 504.9 (+5.6, noise).

**AND THE ZERO LIVE GAPS BECAME ONE.** Forever added LINGERING RAGE, whose whole
effect is the delay before rage decays after leaving combat, and nothing here
leaves combat -- so the class that finished its dive at zero has a gap again
because the ruleset grew one. It carries no `scope` tag: whether an
out-of-combat state belongs in scope is the owner's decision, and a scoped entry
is filed as answered. **Anger Management's second clause is the same question**
and is carried in a COMMENT rather than a declaration, which is why the census
counts that talent as fully modelled -- the undeclared-ruling shape, still here.

| | |
| --- | --- |
| **removed** | Improved Cleave, Boundless Rage, **Precision** (silent), **Toughness** |
| **added** | Lingering Rage, Furious Precision, Gore Drinker |
| **moved** | Iron Will from Fury to Protection; Improved Berserker Rage up a row; six Protection rows |
| **prerequisites** | Flurry wants Death Wish 1 where it wanted Enrage 5; Bloodthirst wants nothing; Last Stand wants nothing |

**THE TWO LARGEST GAINS, MARGINAL:** the new crit-rage rule is **+75.5** to DW
Fury and **+18.0** to 2H Arms, and Bloodthrill's doubling is **+33.5** to 2H Arms.
A tank gets **+6.8** from the crit rage, because it is already capping.

**SPEARING STRIKE'S REQUIREMENT CROSSED FROM A WEAPON TO A STANCE** -- two-handed
to Battle Stance -- so it left `abilitiesForBuild` for `Ability.stances`, and DW
Fury still cannot cast it: it can now hold the weapons and not the stance. The
owner's new build moves that point to Improved Execute. **The answer did not
change and the reason did, twice.**

**GORE DRINKER IS BUILT AND NO BUILD TAKES IT.** Four of its five triggers are
casts; ENRAGE is a talent proc in Forever and is never cast, which is the one
`unmodelled` clause on it. It is the Warrior's first CAST reaction, so
`talentBuild.ts` had no `warrior` entry in `CAST_REACTIONS` until now -- a
registry that is optional and silent.

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
| DW Fury | 18/33/0 | **667.5** | `WARRIOR_DUAL_WIELD_BERSERKER` | dual wield, Berserker |
| 2H Arms | 38/13/0 | **621.1** | `WARRIOR_TWO_HAND_BATTLE` | two-hander, Battle |
| Prot Warr | 17/0/34 | **457.0** | `WARRIOR_SHIELD_DEFENSIVE` | 1H & shield, Defensive, **target attacks back** |

**DW Fury and 2H Arms are the two highest profiles in the project.** Prot Warr is
sixth. Anything that moves a shared melee rule shows up here first and largest.

**BOTH CORRECTIONS MEASURED AS NOISE**, 30 batches of 10: 2H Arms 607.2 → 603.3
(−3.9, ±9.1) and DW Fury 652.0 → 651.2 (−0.8, ±8.9), with the other twenty-one
identical to the decimal. **The uses column is what says a list changed**, and it
changed a lot: Slam went 2.9 casts a fight to 2.5, and Spearing Strike went 2.7
to **zero** — its 15 rage going straight into Heroic Strike, 9.0 casts to 11.0.
**Losing an ability outright cost 0.8 DPS**, which is what a rage-bound build
looks like: the bar is the constraint, not the ability list.

### Deep Wounds again, from an official source, 2026-10-05

Three bullets -- "Deep Wounds compared to Vanilla now" -- and **two were already
right**: it rolls its damage over when refreshed (the pool, below), and it does
not reset its tick timer on a refresh. The second was true BY ACCIDENT:
`AuraCollection.refresh` reschedules the EXPIRY and never touches `tickHandle`.
Nothing asserted it, so nothing would have caught the day that changed. Pinned
now.

**The third was wrong: it must not scale with Attack Power.** The pool read the
universal weapon formula -- base + (speed / 14) x AP -- and now reads
`WeaponProfile.baseDamage` alone, which the engine documents as "average damage
per swing before attack power" and which is what the tooltip's "your melee
weapon's average damage" means.

**2H Arms −46.7, DW Fury −61.7, Prot Warr −18.7, all REAL.** It nearly cancels
the pooling gain: across the whole Deep Wounds pass the net is **2H Arms −3.5,
DW Fury +0.3, Prot Warr −12.0** (−4.7 of which is Thunder Clap). The bleed had
been paid twice over -- once by rolling nothing over, once by scaling with attack
power -- and **the two errors were hiding each other**.

**TWO CLOCKS, AND ONLY ONE RESETS.** The duration restarts at twelve seconds; the
tick timer does not. Both are stated, by different sources, and both hold.

**A TEST HAD BEEN DEFENDING THE BUG.** `talentReactions.test.ts` built its
expectation from the weapon formula WITH attack power, with a comment saying it
existed "so the test would catch the aura scaling by attack power twice".

### Thunder Clap's crit comes from the SPELL table, ruled 2026-10-05

The owner: "Thunder Clap uses the spell crit table, so global sources of critical
strike chance apply, but not crit from agility, or the Cruelty talent or
Weaponmaster talent."

**Prot Warr 480.4 → 475.7, −4.7**, and it is the only profile affected: 2H Arms
has Thunder Clap in its book and in no list, and a Berserker-stance Fury cannot
cast it at all. Its crit rate goes **17.7% → 4.9%**.

**ONLY THE CRIT MOVED.** `attackTable: 'spell'` would have been one word and
would also have changed MISS — spell miss is flat where `missFromSkill` gave
Thunder Clap almost none, measured at **0.9% avoided becoming 9.4%**, for a net
−5.4. Every clause of the ruling is about crit, so `DamageRequest.critTable`
takes the crit chance and multiplier and leaves the rest of the roll alone. One
line switches to the whole table if that was meant.

**THE THREE EXCLUSIONS, and only one needed work:**

| | |
| --- | --- |
| **Cruelty** | free — it is a `critChance` stat and the spell table reads `spellCritChance` |
| **agility** | **vacuous.** There is no agility-to-crit conversion in this engine at all; `baseStatTypes.ts` says so. It will hold for free when one is built, as long as it feeds `critChance` |
| **Weaponmaster** | needed real work — its crit was an `ALL_ABILITIES` ability modifier, which reaches any ability with an id whatever table it uses |

**AND WEAPONMASTER WAS WRONG IN BOTH DIRECTIONS.** `ALL_ABILITIES` reaches no
AUTO ATTACK either, because a swing carries no ability id — and "gives your melee
weapon attacks a benefit" includes swings, the largest source on every Warrior.
Scoped to `melee-auto` and `melee-special` now. It measures as nothing today
because every Warrior weapon is a sword and the talent wants an axe or polearm.

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

**THREE OF THESE HAVE SINCE BEEN PUT IN A LIST AND THIS PARAGRAPH SAID THEY
WERE MOSTLY FINE.** The sentence below used to end *"most are correct"* over a
list of **seventeen**, and three of the seventeen went in: Recklessness
**+94.15** on DW Fury -- 9.5% of the profile and the largest single figure this
class has produced -- Hamstring **+26.74** on 2H Arms, and Berserker Rage
**+6.02**. So it was right about fourteen and wrong about three. See **The two
damage Warriors, optimised** above.

**A LIST OF WHAT IS ABSENT IS NOT CHECKED BY ANYTHING THAT COMPILES**, which is
this project's own rule about the Paladin's Hammer of Wrath, one layer up: an
enumeration of absences with a blanket judgement over it. Re-read the judgement
when the lists change, because nothing else will.

`slam`, `whirlwind`, `overpower`, `revenge`, `thunder_clap`, `intercept`,
`execute`, `cleave`, `rend_cast`, `demoralizing_shout_cast`, `shield_wall_cast`,
`shield_block_cast`, `charge`, `sweeping_strikes` — **varying by profile**, and
these are correct: a two-hander does not Revenge, a Berserker cannot Thunder
Clap, Cleave and Sweeping Strikes are area damage against one enemy. Each of the
last three is now measured rather than argued -- **Cleave -128.95** at the
bottom of the Fury list, **Sweeping Strikes -10.45** on Arms, **Thunder Clap
-2.54**.

**`recklessness_cast`, `hamstring` AND `berserker_rage_cast` ARE NO LONGER ON
THIS LIST.** Recklessness is in both damage lists, Hamstring at the bottom of
the Arms one, and Berserker Rage at the bottom of the Fury one.

**AND THE ONE THAT CARRIED A PARAGRAPH WAS THE SMALL ONE.**
`berserker_rage_cast` had its own note here -- *"A build that spent a point
there would want the entry back and would want it measured"* -- and that is
exactly what happened: DW Fury spends two points off a dead Enrage and the pair
is worth **+6.02**. Recklessness carried no note at all and was worth fifteen
times as much. **The entry that gets written about is not the entry that is
expensive**, and what separated them was reading the BOOK against the list
rather than re-reading the prose.

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
