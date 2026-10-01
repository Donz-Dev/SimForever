# Handover

**Status only.** Rules and conventions are in [CLAUDE.md](CLAUDE.md); how a class
gets built is [docs/class-implementation.md](docs/class-implementation.md).

## Where the project is

All nine classes and all 23 profiles are implemented, every number traced to a
source rather than invented, and **all 23 priority lists are the ruleset owner's
own** -- specified entry by entry and measured after. **2,022 tests**, CI green on Node 20 and 22. Profile
format **v10**. Live at <https://donz-dev.github.io/SimForever/>, republished by
`.github/workflows/deploy.yml` on every push to `main` that passes.

The profiles were specified by the ruleset owner as `talentsforever.com` build
URLs and every one decodes to exactly 51 points. Every profile is in its own
class's gear, from twelve sixtyupgrades sets the owner supplied — 151 items in
nine files. The item database is **frozen**.

### The regression baseline

**30 batches of 10**, preset raid buffs, reproduced by
`npx vite-node tools/measure_profiles.ts`. Comparable to **each other** and to
nothing else. **Measure with `runProfileBatch`, not `runProfile`** — the app runs
the former and the two are different fights even at one iteration.

**THE METHOD CHANGED WITH THIS TABLE, AND THAT IS WHY SOME FIGURES MOVED WITHOUT
A CAUSE.** Every earlier baseline here was ONE batch of 300 at seed 12345; these
are thirty independent batches of ten, which is what `measure_profiles.ts` runs
and what gives each figure the interval a REAL/noise verdict needs. Most profiles
land inside the old interval and a few do not — 2H Arms read 596.6 under the old
method and 607.2 under this one on identical code. Do not read those as changes.

**THE PALADIN DEEP DIVE MOVED ALL THREE OF ITS PROFILES AND NOTHING ELSE.**
Seal Twist Ret 471.0 to **528.3 (+57.3)**, Shockadin 379.0 to **472.7 (+93.7)**,
Prot Pally 153.2 to **238.1 (+84.9)**, every one REAL -- and the twenty
non-Paladin profiles identical to the decimal, which is the containment check for
a change touching four shared engine files. **The mean across 23 goes 411.7 to
421.9**, Seal Twist Ret becomes the project's fourth-highest profile, and Prot
Pally stops being an outlier at the bottom: 238.1 against the Elemental Shaman's
295.4. Nothing in it was a new number -- it is six talents and a judgement that
were inert for reasons about the engine that were about the wrong thing. See
[docs/handoff/paladin.md](docs/handoff/paladin.md).

**SHATTER MOVED ONE PROFILE AND THE CONTAINMENT HELD EXACTLY.** Frostfire
376.6 to **412.5, +36.0, REAL**, and the other twenty-two identical to the
decimal -- which is what a talent change scoped to one build should look like.
It makes Frostfire the top Mage, above Fire's 401.2 and Arcane's 392.6, and the
build that existed for the Fire/Frost overlap now has a third reason to. See
[docs/handoff-apl.md](docs/handoff-apl.md).

**RE-MEASURED ON THE RULESET OWNER'S OWN PRIORITY LISTS.** All 23 are theirs now,
specified entry by entry; what was here before was this project's guess and said
so. Fourteen profiles moved.

| Profile | Class | Talents | DPS | | Profile | Class | Talents | DPS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DW Fury | Warrior | 18/33/0 | 652.0 | | Fire Mage | Mage | 10/39/2 | 401.2 |
| 2H Arms | Warrior | 38/13/0 | 607.2 | | Venom Rogue | Rogue | 37/12/2 | 392.7 |
| Firelock | Warlock | 5/11/35 | 535.5 | | Arcane Mage | Mage | 47/4/0 | 392.6 |
| **Seal Twist Ret** | Paladin | 13/0/38 | **528.3** | | Moonkin | Druid | 38/0/13 | 384.3 |
| Cat Druid | Druid | 9/35/7 | 488.0 | | Rupture Rogue | Rogue | 12/8/31 | 377.1 |
| **Shockadin** | Paladin | 23/0/28 | **472.7** | | Bear Druid | Druid | 9/42/0 | 376.2 |
| Prot Warr | Warrior | 17/0/34 | 454.6 | | SM/DS | Warlock | 40/11/0 | 349.1 |
| Enh Shaman | Shaman | 19/32/0 | 451.1 | | LW Melee | Hunter | 7/13/31 | 321.5 |
| Shadow Priest | Priest | 16/3/32 | 437.3 | | LW Ranged | Hunter | 7/39/5 | 311.7 |
| Combat Rogue | Rogue | 18/33/0 | 419.8 | | Ele Shaman | Shaman | 38/13/0 | 295.4 |
| Frostfire Mage | Mage | 0/29/22 | 412.5 | | **Prot Pally** | Paladin | 8/36/7 | **238.1** |
| BM Hunter | Hunter | 31/20/0 | 405.8 | | | | | |

**WHAT THE OWNER'S LISTS WERE WORTH, against the last figures measured on this
project's own shells:**

| | |
| --- | --- |
| SM/DS +55.9, Enh Shaman +46.2, Cat +43.9 | the three largest, and the first two are the two weakest casters |
| Frostfire +36.7, Shockadin +36.4, Ret +27.2, Moonkin +25.1, Bear +22.1, Ele Shaman +16.4 | |
| Venom −24.3 | its Eviscerate's two aura-duration floors, isolated at −20.4. The Venom entry itself is +17.7 |
| BM Hunter −11.6, Shadow −10.8, Prot Pally −5.6 | Shadow is Shadow Word: Death coming out, isolated at −35.7 against +24.9 for the rest of the list. Prot Pally is Righteous Fury and Templar's Bulwark costing global cooldowns for nothing modelled |
| **LW Melee −237.1** | two separate things. −100.6 from Raptor Strike becoming on-next-swing, which its capture stated all along, and −136.6 from the list dropping Serpent Sting, Arcane Shot and Rapid Fire while adding Hunter's Mark |

**THE SPREAD NARROWED AND THE MEAN DID NOT.** 408.5 to 410.1 across 23 profiles,
because LW Melee absorbed most of what the other twenty-two gained.

**BEFORE THE LISTS, POISONS WERE THE LAST THING TO MOVE THESE, AND ONLY THE
ROGUES MOVED.**
Venom +25.5%, Rupture +16.2%, Combat +8.4%, and all twenty other profiles
identical to the decimal -- which is the containment check for a change that
adds a whole system rather than touching a shared rule.

Before that, normalisation and the Druid paw formula moved twelve, and the
coefficient sheet before them moved nineteen. **Every Rogue figure recorded
before poisons existed was a floor**, because the Venom build spends eleven of
its fifty-one points on them.

**THE CHECK IS THAT THE PROFILES A CHANGE SHOULD NOT REACH DO NOT MOVE BY A
DECIMAL**, and it wants naming per change rather than a fixed list. For anything
in the physical-damage path it is the eleven pure-melee profiles — both Warriors,
Prot Warr, all three Rogues, Cat, Bear, and LW Melee; for a spell change it is
those plus the ranged Hunters. Run all 23 every time and say which ones were
expected to move. The list used to read "all three Hunters" as pure melee, which
stopped being true the moment Sniper Shot became a cast.

**A caster figure is an estimate, not a floor.** All three reasons it used to be a
floor have expired: caster gear exists, spell power has a school, and the
coefficient rule arrived. What remains unmodelled for casters is ordinary content
— totems have no entity, Chain Lightning has no second target, Blast Wave's area
half lands on the one enemy there is — and each is listed per ability on the
results page.

**Two figures are understated by a known amount.** Cat and Bear hold the Glaive of
Obsidian Fury, whose "+172 Attack Power in Cat, Bear, and Dire Bear forms only"
cannot be expressed, because an item stat is not conditional on the combat style.

### The macro audit

**Every ability and damage source, across all 23 profiles, checked for whether it
is CONNECTED rather than whether its number is right.**
[docs/ability-audit.md](docs/ability-audit.md), `npx vite-node tools/ability_audit.ts`.

| | |
| --- | --- |
| **135** | abilities in at least one profile's book |
| **110** | exercised by at least one profile |
| **25** | cast by none of the 23, **each with a stated reason and none of them a broken declaration** |
| **8** | priority list entries that never fire, six of them deliberate |
| **23 of 23** | damage tables summing to **100%** |
| **0** | abilities that deal damage without responding to a stat (the coefficient probe's result) |

**THOSE LAST TWO TOGETHER ARE THE BILL OF HEALTH**: everything that deals damage
scales with something, and everything that deals damage is counted. The share
total is the one that is easy to overlook and hard to fake -- a source nobody
reports reads as a zero rather than as a gap.

**AND IT CORRECTED A DOCUMENTED INVARIANT.** Both handoff files claimed every
entry in every list fires; eight do not, and the claim was contradicted two
paragraphs below in the same file by the stance and shout entries kept on purpose.

## Per-class deep dives

**Nine documents in [docs/handoff/](docs/handoff/), one per class**, each the
starting point for that class's own context window. Every one carries its
profiles and their baseline DPS, its talent census row, its live gaps with
reasons, its never-fired entries, its damage sources, the state of its SOURCES,
and the traps specific to it.

Their figures are re-derivable rather than asserted: `npx vite-node
tools/class_audit.ts <class>` prints the census, the gaps and the per-profile
structure, and throws if its four buckets do not account for every talent.

| Document | Profiles | Live gaps |
| --- | --- | --- |
| [warrior.md](docs/handoff/warrior.md) | 2H Arms, DW Fury, Prot Warr | **1** |
| [paladin.md](docs/handoff/paladin.md) | Seal Twist Ret, Shockadin, Prot Pally | **2** |
| [druid.md](docs/handoff/druid.md) | Moonkin, Cat, Bear | **12** |
| [hunter.md](docs/handoff/hunter.md) | BM Hunter, LW Ranged, LW Melee | **13** |
| [rogue.md](docs/handoff/rogue.md) | Venom, Combat, Rupture | **14** |
| [mage.md](docs/handoff/mage.md) | Frostfire, Arcane, Fire | **16** |
| [shaman.md](docs/handoff/shaman.md) | Ele Shaman, Enh Shaman | **17** |
| [priest.md](docs/handoff/priest.md) | Shadow | **18** |
| [warlock.md](docs/handoff/warlock.md) | SM/DS, Firelock | **25** |

**THE WARRIOR'S 1 AGAINST THE WARLOCK'S 25 IS NOT A DIFFERENCE IN DIFFICULTY.**
The Warrior had four sources and eight of its numbers turned out wrong; the other
eight classes rest on `talentsforever.com` plus one `foreverchanges.pro`
cross-check. Read the Warrior's column as what a class looks like after the work,
not as a class that needed less.

## The milestone

**A full engine for WoW: Forever with all 23 profiles fully implemented — every
ability, spell, cooldown and talent NON-INERT, and every applicable spell and
ability carrying an attack power or spell power coefficient.**

Measured at `d2718b0`, and the numbers say it is not close:

| | |
| --- | --- |
| **140 of 468 talents are a live gap** | down from a raw count of 262 unmodelled reasons, because 89 are permanently out of scope by ruling and 33 more are PARTLY modelled. See the census below — the raw total is not a work queue |
| **113 abilities declared against 478 captured** | the data is on disk; the declarations are not. Druid 15, Hunter 14, Mage 13, Rogue 12, Warlock 10, Shaman 9, Priest 7, Paladin 6, plus the Warrior's 27 |
| ~~**Coefficients**~~ | **DONE, AND NOW EVERY ROW IS APPLIED.** `WoWSimWorksheet.xlsx`, the owner's authoritative coefficient document, is transcribed in `src/game/combat/coefficients.ts` and applied across all nine classes. Every derived rule is deleted. The last unapplied row was Hammer of Wrath, which was not a declared ability until the owner put it in two Paladin priority lists; the two poison rows went the same way when the poison system landed. [docs/spell-coefficients.md](docs/spell-coefficients.md) |
| **18 `PLACEHOLDER_*` constants** | each a real number nobody has supplied. Sniper Shot's invented 200-mana cost is gone, but it was never one of these: it was a bare literal with a false caveat, which is worse — an invented number that is not named cannot be audited |
| ~~**Rotations are thin and unmeasured**~~ | **DONE.** All 23 priority lists are the ruleset owner's own, specified entry by entry, and every one is measured — see the baseline above and [docs/handoff-rotations.md](docs/handoff-rotations.md). The twelve dead entries are gone: every entry in every list fires. Fourteen abilities and three talent mechanics were declared to reach them, and six engine capabilities built |

**The Warrior was built first and built properly, and it is not the norm.** Read
any claim about this project's depth as a claim about the Warrior until checked.
It is the only class with an owner spreadsheet, the only one documented in
`docs/` at all, and it carries 2,025 comment lines against 268–529 for every
other class.

### All nine classes are cross-checked

Against `foreverchanges.pro`, under the owner's standing rule that **where it and
our own capture disagree, it wins**. Full record, method and its two traps in
[docs/source-cross-checks.md](docs/source-cross-checks.md).

**NOT ONE CLASS CAME BACK CLEAN. Twenty-seven figures moved**, and the exercise
found three distinct kinds of error:

| | |
| --- | --- |
| **Source disagreement at the same build** | most of them, usually a few points. Both sources read 1.60.1.70009, so refreshing a capture settles nothing — which is why the standing rule was needed |
| **Build drift** | a figure that was right when written and is not now: Wrath 62–68 → 92–102, Holy Strike 40%/12s → 50%/10s, Life Tap doubled, and Mangle **renamed to Primal Bite**. **No amount of cross-checking finds these; only refreshing the captures does** |
| **Our own transcription** | Sniper Shot, wrong in four fields at once, with the answers in its own capture the whole time |

The third kind is the one to fear. **Sniper Shot** read 160 damage, a 200-mana
placeholder, instant cast and a 6-second cooldown; its capture says 295, 365 mana,
a **4-second cast** and 15 seconds, and said so at both builds. The old comment
applied the rank-1 rule to a capture that is already max rank — a real rule, the
wrong artifact — and the placeholder's justification ("the spellbook gives no cost
line at all") was simply false.

**What moved most**: Prot Pally +13.5% and Seal Twist Ret +10.0% on Holy Strike's
doubling, Firelock +12.1% on Life Tap, and **LW Ranged −11.1%** on Sniper Shot
becoming a four-second cast.

**THE LW RANGED PRIORITY LIST NOW NEEDS RE-MEASURING.** A cast resets the ranged
swing timer, which is the rule that removed Aimed Shot from that list at *two*
seconds. Dropping Sniper Shot measures **+7.9** on one run; it wants the full
30-batch method before it changes, and it is not changed yet.

**Ability numbers are done; TALENT VALUES have never been cross-checked at all.**
`src/data/talents/values/*.json` comes from `talentsforever.com` alone and has no
second source.

### The talent census

Every talent, classified from the DATA rather than from prose: an `unmodelled`
entry carries a `scope` when the owner has ruled the effect out, so a decision
and a gap can be told apart mechanically. `tests/game/outOfScope.test.ts`
enforces it, and a new class writing "nothing here moves" without the ruling
fails.

| Class | Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- | --- |
| Warrior | 53 | 43 | 3 | 6 | **1** |
| Paladin | 52 | 32 | 5 | 13 | **2** |
| Druid | 51 | 20 | 5 | 14 | **12** |
| Hunter | 50 | 24 | 5 | 8 | **13** |
| Shaman | 50 | 17 | 4 | 12 | **17** |
| Mage | 54 | 27 | 2 | 9 | **16** |
| Priest | 53 | 15 | 2 | 18 | **18** |
| Rogue | 53 | 25 | 2 | 12 | **14** |
| Warlock | 52 | 21 | 3 | 3 | **25** |
| **Total** | **468** | **224** | **31** | **95** | **118** |

**SIX TALENTS LEFT THE GAP COLUMN WITH THE PRIORITY LISTS**, and four of them
were never really in it. Cutthroat and Premeditation were counted among the
eleven Rogue talents that stealth makes inert and are neither -- Cutthroat is an
in-combat proc whose whole purpose is to REMOVE a stealth requirement, and
Premeditation's Forever tooltip has no stealth clause at all. Preparation's
reason was a statement about the engine ("nothing can reset a cooldown from
content") and the engine now can. Fingers of Frost carried `FROZEN_UNMODELLED`,
which is a claim about the TARGET, and that talent does not freeze anything.

**255 of 468 talents do something**, 95 never will, and **118 are the actual
remaining work** — not the 262 a raw count of unmodelled reasons suggests. The 103
scoped entries break down as 33 healing, 32 crowd control, 17 positioning, 14
threat and **7 stealth**. Every total above is re-summed from its rows rather
than adjusted, which is the rule a clean merge once broke by one.

**EIGHT TALENTS LEFT THE GAP COLUMN WITH THE PALADIN DEEP DIVE, AND SIX WERE
NEVER REALLY IN IT.** Reckoning, Holy Shield and Shield Specialization were
written off against a rule that a reaction cannot fire on a BLOCK — which the
Warrior's own Shield Specialization, Revenge, Enrage and Blood Craze have
disproved since the table was written. Divine Favor's reason was true of
`CastModifier` and false of an aura's `abilityModifiers`; Sanctified Judgement's
wanted a cast reaction that already existed; and Templar's Bulwark had been
granted, cast and absorbing in full for as long as absorbs have existed, while
its reason said it was not granted at all. **Only Divine Precision needed a new
engine field**, and that one is shared with the Mage twice and the Priest twice.

**STEALTH IS THE NEWEST RULING AND IT CLOSED THE LARGEST OPEN QUESTION.** Every
fight opens in combat, so nothing is ever stealthed — and until the owner ruled,
that was an ENCOUNTER property rather than one of the rulings, which left six
Rogue talents counted as work nothing would ever reach. **The Rogue goes from 20
live gaps to 14 and stops being the second-largest queue in the project.** It
covers being stealthed, detecting it, and the openers that require it; it does NOT
cover an in-combat proc that REMOVES a stealth requirement, which is what
Cutthroat is and why Cutthroat is modelled.

The rulings, recorded in CLAUDE.md under **Scope**: positions, range, facing and
movement; crowd control; threat; and healing THROUGHPUT — but **mana RETURN is in
scope**, because it changes a damage profile's sustain, so a talent returning mana
is a live gap and gets no `scope`.

Two questions the census raises that the rulings do not answer:

- **Poisons and Venom both exist now**, so three of the Rogue's census gaps are
  closed: Vile Poisons, Improved Poisons and Venom all apply, the last stacking
  ADDITIVELY with the first by the owner's ruling.
  **VENOM IS IN NO PRIORITY LIST, BECAUSE IT MEASURES AS A LOSS** -- 415.2
  without it against 395.7, 398.0 and 400.1 at three placements, each outside
  its interval. A combo point is worth more on Eviscerate than a 30% bonus on
  the fifth of the build's damage that poisons supply. The mechanism is tested,
  so one line re-measures it the day a coefficient moves.
  **AND POISONS EXISTING OPENED A GAP THAT WAS CLOSED BY IMPOSSIBILITY.**
  Mutilate is "+20% against Poisoned targets" and its `unmodelled` reason used
  to be that no target here is ever poisoned. The Venom build now keeps Deadly
  Poison up for most of a fight, so that is a live 20% on the signature ability
  of the build that takes it, and it is not read. Left for its own PR because it
  moves a profile and wants a re-measured baseline. **A reason can expire
  without anybody touching the thing it is written on.**
- **Stealth and openers.** Eleven Rogue talents are inert because every fight
  opens in combat — Premeditation, Initiative, Improved Ambush, Cutthroat, Dirty
  Deeds, Camouflage, Opportunity and more. That is an encounter property, not one
  of the four rulings, and it is most of why the Rogue has the second-largest live
  count. **Worth asking whether an opener is in scope at all.**
- **Totems as entities.** Five Shaman talents need a totem to exist as something
  that acts on its own. That is the mid-fight-summon engine gap wearing different
  clothes, and it lands on an Elemental profile whose figure is short by whatever
  they are worth.

**The spell exclusion list is still to be proposed and approved** — 478 captured
against 113 declared. A stated exclusion list is what turns a vague "incomplete"
into a finite work list.

### Open engine gaps

| Gap | Talents | Classes |
| --- | --- | --- |
| ~~**Spell hit per school**~~ **DONE.** `AbilityModifier.hitBonus`, taken off MISS, folded by `combineModifiers` and by `combine`. The reason — that the table decides hit before any per-school modifier is consulted — was false: the school's modifier was already one of that function's three arguments. **Four talents left, none of them the Paladin's** | ~~5~~ 4 | Mage ×2, Priest ×2 |
| **Crit damage for a LIST of NAMED abilities** — `critMultiplierBonus` exists on `AbilityModifiers` and no talent effect reaches it, the way `abilityCrit` reaches crit CHANCE | 2 | Warlock, Rogue |
| **A one-shot per-ability CRIT modifier** — and it is NOT `CastModifier`, which carries cast time and cost. An AURA's `abilityModifiers` carries a `critBonus`, spent by a CAST REACTION rather than by `consumedByCast`: cast charges are spent before `runCast`, so the aura would be gone before the spell rolled its crit. **Divine Favor does it now; the Priest's is the same shape** | ~~2~~ 1 | Priest |
| **A style-scoped item stat** — `statsForStyle` knows the combat style; the item rule does not | 1 item line | both feral Druids, 172 attack power |
| ~~**A flat per-school damage bonus**~~ **NOT A GAP, AND NOT FLAT.** Judgement of the Crusader's "up to 161" is spell POWER on the target, by the owner's ruling, so each ability scales it by its own coefficient. `AuraDefinition.spellPowerTakenBySchool`, read through `spellPowerAgainst`. The old reason had correctly ruled out `damageTakenBySchool` for multiplying and then read the number as flat anyway | 0 | — |
| **Mid-fight summoning** — `Simulation` exposes `combatants` read-only | 2 | Warlock Infernal, Mage elemental. Nothing in any profile needs it |
| **An aura scoped to an attack TABLE** — built, as `damageDoneByTable`. `AttackTableModifiers` is fixed when the character is and Seal of the Crusader's penalty has to come and go with the seal | 0 | — |

### Placeholders — every invented number, named

| Constant | Value | What would settle it |
| --- | --- | --- |
| ~~`PLACEHOLDER_SEAL_OF_COMMAND_PPM`~~ | **7, and real** | **Answered.** The owner has confirmed 7 procs-per-minute, so the constant is `SEAL_OF_COMMAND_PPM` and the fourth-highest profile loses its one big asterisk. The value did not move; what moved is whether it can be quoted |
| `PLACEHOLDER_PET_BASE_DPS` | 50 | one stated pet DPS or damage range at 60. Every source gives family modifiers RELATIVE to a base and none states the base |
| `PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE` | 20 | the tooltip says only "a chance" |
| `PLACEHOLDER_SOUL_SHARDS` | 10 | what a Warlock banks before a pull. No in-fight income |
| `PLACEHOLDER_COMBUSTION_DURATION_MS` | 30s | its real end is "until 4 crits", which nothing counts. Generous |
| `PLACEHOLDER_WINDFURY_WEAPON_DURATION_MS` / `_INTERNAL_COOLDOWN_MS` | 1.5s | borrowed from Windfury Totem, whose window the owner stated. The SoD trinket tooltip says 2s where the code carries 1.5 |
| `PLACEHOLDER_FLURRY_DURATION_MS` / `_BERSERKER_RAGE_` / `_REVENGE_WINDOW_MS` | 12s / 10s / 5s | Warrior-era; charges end Flurry in practice |
| `PLACEHOLDER_PET_SWING_SECONDS` | — | no longer affects damage, since a pet's base is a DPS |
| `PLACEHOLDER_BOSS_*` | 5000 / 2s / 15% | the encounter, not a class. See [docs/incoming-damage.md](docs/incoming-damage.md) |
| `PLACEHOLDER_ONE_HAND` / `_TWO_HANDER` / `_RANGED` | — | only used when nothing is equipped; every preset equips |

**Interpretations** are not placeholders — a real number read one of two ways,
with the reading beside it: Seal of Righteousness' base as the LOW end of "21 to
75"; Maelstrom Weapon and Arcane Blast as per stack; Bane of Agony ticking flat;
every DoT cadence dividing its stated total into whole ticks; a hybrid's two
halves sharing one coefficient by DURATION rather than by damage. The last is why
Fireball's burn is 11% of its damage and takes 35% of its scaling.

## Open questions for the ruleset owner

**THE FOUR FLAT FINISHERS ARE ANSWERED**, and so is everything else the
coefficient audit raised. `WoWSimWorksheet.xlsx` supplies Eviscerate at 4% of
attack power per combo point spent, Ferocious Bite at 3%, Rip at 4% per combo
point per tick, and Rupture at a flat 3% a tick. Lacerate's "10% weapon damage
per existing application" applies too — its `unmodelled` reason claimed a
periodic tick could not read its own stack count, and `AuraInstance` has carried
`stacks` all along.

**AND ONE COEFFICIENT NOW EXISTS THAT THE SHEET DOES NOT CONTAIN.** Wrack is
**14.3% of spell power per tick**, six ticks one second apart, supplied by the
owner directly -- `WoWSimWorksheet.xlsx` lists nine Warlock spells and Wrack is
not one of them. It is the only row in `coefficients.ts` that a refresh of the
sheet will not carry, and the provenance is recorded beside the constant for
exactly that reason. **It did not make the ability worth casting:** 0.858 over a
six-second channel is Shadow Bolt's 0.857 in twice the time, so Wrack stays out
of every list, which is what the owner asked for. Its +10% to your other Shadow
DoTs is still unmodelled and is the reason anybody would cast it.

~~**ONE ROW OF THE SHEET STILL CANNOT BE APPLIED.**~~ **Every row is applied.**
The last one was:

- ~~**Hammer of Wrath.**~~ **Declared.** Its "20% or less health" is the CLOCK,
  by the same ruling Execute runs on — `combat/executePhase.ts`, which is where
  that rule moved when it stopped being the Warrior's alone. The row had sat
  transcribed-and-unapplied since the sheet arrived, and what cleared it was not
  new data but the owner putting the ability in two priority lists.

~~**Instant Poison and Deadly Poison.**~~ **Applied.** They were listed here as
a missing SYSTEM rather than a missing number, and the system was built: both
coefficients are read by `reactions/poisons.ts` and `auras/rogue.ts`. The
comment on the constants said "not applied" for a while after it stopped being
true, which is the third time an expired reason has been caught in this file.

1. ~~**Seal of Command's PPM.**~~ **Answered: 7.** And so are Vindication's proc
   chance (**10%**), Seal of the Crusader's damage penalty (**Classic's reading,
   where it exactly cancels the haste**) and Judgement of the Crusader's "up to
   161" (**spell power, not flat damage**). Four Paladin answers in one pass, and
   three of them deleted an inert talent rather than a placeholder.
2. **Seal of Righteousness' base** — is the low end of "20.5 to 71.4" the `base`
   term, or the midpoint? Still open, and the last Paladin interpretation.
3. **Is a dispel in scope, and is a self-disarming immunity?** The Paladin's last
   two live gaps turn on these and nothing else. `purifying_power`'s Cleanse and
   Purify half is inert because nothing here applies anything dispellable, which
   is an ENCOUNTER property rather than one of the five rulings — the same shape
   stealth had before you ruled on it. `guardian_s_favor`'s Blessing of
   Protection, and `sacred_duty`'s Divine Shield and Divine Protection, all stop
   the Paladin attacking for their duration.
4. **Maelstrom Weapon's proc chance.** Not in the client data at all.
5. **One pet's base DPS, or one damage range, at 60.** The family modifiers are
   real and happiness is the wiki's 125%; what no source states is the absolute
   those are relative to.
6. **Bane of Agony's ramp** — did Forever keep Classic's 50/100/150 bands?
7. **Berserker Rage's magnitude** — Forever's tooltip names none.
8. **The hawk's damage, and how to read it.** Both sources state ONE figure —
   our capture 108, `foreverchanges.pro` 110 — for a hawk that "dive-bomb[s] your
   targeted enemy, dealing 108 Physical damage and continuing its assault for 18
   sec", and **neither quantifies the continuing assault**, which is what the
   simulator actually models at 32 a strike. Is 108 the per-strike rate (which
   would more than triple the hawk), or an opening hit on top of ticks whose rate
   is unstated? 32 appears in no source and is left alone pending the answer.

**The four from the Warlock cross-check are ANSWERED**, and the answer came with a
standing rule that closes the same question for every class: **where our capture
and `foreverchanges.pro` disagree, foreverchanges wins.** Life Tap is 840,
Shadowburn 251–281, Searing Pain 105–123. Shadowburn is charged both a shard and
365 mana, because there the preferred source is silent rather than different — it
carries no reagent field for any spell. See
[docs/source-cross-checks.md](docs/source-cross-checks.md).

Answered already, for reference: Seal of Command procs at **7 PPM**;
Vindication procs at **10%**; Seal of the Crusader's damage penalty is
**Classic's, exactly cancelling its haste**; Judgement of the Crusader's "up to
161" is **spell power rather than flat damage**; Retribution Aura stays
**undeclared**; Divine Favor is **in the Shockadin list**; seal damage is **not** a
weapon use; a hawk is modelled **without** a real combatant; pet family is a **profile field**; Shield
Slam triggers **main-hand** effects; Careful Aim contributes to attack power
**and** ranged attack power; resistances on an enemy target do not affect damage.

## What to do next

The refactor is phased; the milestone follows it.

1. ~~**Phase 1 — documentation.**~~ **Done.** Five Warrior-only docs and the engine
   gap survey folded into [docs/warrior.md](docs/warrior.md) and this file;
   CLAUDE.md restructured as a reference; five expired claims cleared.
2. **Phase 2 — code, conservatively.** In progress. **Done:** the rulings are data
   (`OutOfScope`, 96 entries tagged, a test that a new class cannot slip past), the
   Talent panel shows a decision separately from a gap, the healing split is made,
   and the odd-one-out Warrior capture is named for what it is. **Left:**
   - **Ask the owner for each placeholder number** — 18 of them, listed above,
     and Seal of Command's is the proof the asking is worth it: one message turned
     the largest invented number in a top-five profile into real data. **Four
     Paladin questions were answered in one pass and only one of them was a
     placeholder** — the other three were inert talents, which is the lesson the
     coefficient sheet taught twenty-nine talents at once. **Check whether a
     missing number is missing DATA or a missing RULING.**
   - **The talents whose rule already exists with nothing hooked to it.**
     Shaman Elemental Focus is the clearest: a one-shot cost modifier is exactly
     `CastModifier.costFraction` with `consumedByCast`, which Maelstrom Weapon
     already uses, and its reason still says it has no declaration. Rogue
     Lethality and Warlock Pandemic want `critMultiplierBonus`, which exists and
     nothing reaches. **These will move DPS, so they want their own PR and a
     re-measured baseline.**
     **THE PALADIN IS THE WORKED EXAMPLE OF HOW BIG THIS CATEGORY IS.** Six of its
     ten live gaps were in it, worth +57, +94 and +85 DPS across its three
     profiles, and not one of them needed a number nobody had. **Read every
     `unmodelled` reason that names an engine limitation against the engine, not
     against its own plausibility** — three of the Paladin's were contradicted by
     code in the Warrior's own reaction file.
   - **Dead code**: exports nothing imports.
   **Do not restructure the engine, the panels or the profile schema**; volume is
   the problem, not shape.
3. **Phase 3 — the milestone, per class.** Every talent resolves to an effect or
   to a permanent out-of-scope reason, with no "not written yet". Every spell on
   the approved list declared, with its cooldown. Every damaging ability carrying
   the right coefficient. **The APL measured entry by entry** — 30 batches of 10
   per variant, a difference inside the interval treated as no difference. The
   Hunter review is the worked method and moved those three profiles +20 to +55
   DPS each.

~~**THE APL HALF OF PHASE 3 IS THE NEXT PIECE OF WORK**~~ **and is done.** All 23
lists are the owner's, every entry in every one of them fires, and the baseline
above is measured on them. [docs/handoff-rotations.md](docs/handoff-rotations.md)
carries what each list turned out to be worth and the three findings that came
out of building them.

**PICKING IT UP AGAIN HAS ITS OWN BRIEF**: [docs/handoff-apl.md](docs/handoff-apl.md),
which carries the state, the two open items below in full, the tools in the order
to use them, and the two things about this codebase a list author needs before
writing an entry.

**WHAT THE APL WORK LEFT BEHIND, in order of how much it costs:**

1. **Two of the owner's lists measure down and were shipped as written**, with
   the cost isolated rather than acted on: Venom's Eviscerate floors at -20.4,
   and Shadow Word: Death leaving the Priest at -35.7. Both are the owner's
   design and both numbers are in the baseline notes above.

A profile has **no `faction` field**; faction is derived from race. The milestone
asks for faction as a default, so either say that derivation is the answer or
store it and bump v10.
