# Handover

**Status only.** Rules and conventions are in [CLAUDE.md](CLAUDE.md); how a class
gets built is [docs/class-implementation.md](docs/class-implementation.md).

## Where the project is

All nine classes and all 23 profiles are implemented, every number traced to a
source rather than invented, and **all 23 priority lists are the ruleset owner's
own** -- specified entry by entry and measured after. **2,270 tests**, CI green on Node 20 and 22. Profile
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

**THE ROGUE DEEP DIVE WAS THE LAST IN AND NEEDED A RECONCILIATION RATHER THAN A
MERGE.** Venom 392.7 to **440.2**, Combat 419.8 to **461.8**, Rupture 377.1 to
**402.5**. Its census went 14 live gaps to **3**, and nine of the eleven it closed
were declarations rather than engine work.

**IT BRANCHED BEFORE FIVE OTHER DIVES LANDED AND BUILT SEVEN OVERLAPPING APIs
UNDER DIFFERENT NAMES.** That is the real finding of this round, and it cost more
than any single dive:

| The Rogue called it | The merged project calls it |
| --- | --- |
| `abilityBelowTargetHealth` (a list of ids) | `abilityDamageInFinalFraction` (one id per entry) |
| `FightProgress` (an object) | a plain `remainingFraction` number |
| `clockConditionsUnreachable` (a predicate) | a THROW from `forWhileFinalFraction` |
| `abilityDamageTaken` + `abilityDamageTakenMultiplierFor` | `attackerAbilityModifiers` + `abilityModifierAgainst` |
| `critMultiplier: 'melee'` | `table: 'melee-special'` |

**AND THREE OF ITS ADDITIONS WERE GENUINELY NEW, so they were restored rather than
translated**: `CastModifier.costReduction` (a FLAT cost cut, where main had only
the fraction -- not interchangeable), `abilityCrit`'s `valueIndex` (without which
Puncturing Wounds silently gave Mutilate Backstab's 15% instead of 30%), and
`appliedElsewhere`.

**`appliedElsewhere` IS THE ONE WORTH KEEPING ACROSS CLASSES.** It names the module
that applies an effect the table cannot express -- Vile Poisons and Improved
Poisons both WORK, read by the poison reactions, and every census in the project
counted both as live gaps because their reasons said "APPLIES in full" in capitals
and `class_audit.ts` counts effects, not adjectives. It is data, exactly as `scope`
is, and the tool now counts a talent carrying it PARTLY modelled.

**THE TRANSLATION IS VERIFIED BY MEASUREMENT AND NOT ONLY BY TESTS.** Its own
figures reproduce to the decimal after the rewrite -- Venom 440.2 and Combat 461.8
are exactly what its branch recorded against its own engine -- and its 708-line
test file passes. A rename that had changed semantics would have moved them.

**ONE EXPIRY CROSSED A CLASS BOUNDARY AND ONLY A TEST CAUGHT IT.** The Warrior's
Weaponmaster said "the damage pipeline has no attacker-side armor term, re-checked
2026-09-30" -- true that day, and false once this dive made `armorPenetration` a
stat for Hack and Slash. Nothing in the Warrior's own files changed.
`armorPenetration.test.ts` asserts BOTH callers on purpose, which is what failed.
See [docs/handoff/rogue.md](docs/handoff/rogue.md).

**THE HUNTER DEEP DIVE MOVED TWO PROFILES AND THE CONTAINMENT HELD EXACTLY.**
BM Hunter **405.8 to 731.8, +326.0, REAL** and LW Melee **321.5 to 362.7, +41.1,
REAL**; the other twenty-one identical to the decimal, **LW Ranged included** --
which is the check for a change that touched pets, hawks, traps and a melee bleed
at once. **BM Hunter is now the top profile in the project.**

**ALMOST ALL OF IT IS TWO OWNER ANSWERS, NOT ENGINE WORK.** Both figures were
named `PLACEHOLDER_` and both were load-bearing:

| | |
| --- | --- |
| BM Hunter **+223.2** | the pet's base DPS, **50 to 150**, measured with the hawk left at 32 |
| BM Hunter **+144.4** | the hawk at **108**, with both of the two it can have dealing damage, measured with the pet left at 50 |
| LW Melee **+30.4** | the Immolation Trap entry |
| LW Melee **+12.4** | Lacerating Strikes' bleed |

**AND A SCOPE QUESTION CAME BACK AS AN ABILITY.** Asked whether traps were out of
scope, the owner added no union member and put **Immolation Trap** in instead,
ruling away only the part the engine cannot do: "assume it triggers instantly when
cast". That closed three Hunter talents rather than one. **Explosive Trap is still
undeclared, because the owner named one trap** -- a ruling covers what it says.
See [docs/handoff/hunter.md](docs/handoff/hunter.md).

**THE PRIEST DEEP DIVE CLOSED THE LARGEST SHARED GAP IN THE CENSUS, AND IT
REACHED FOUR CLASSES.** Spell hit per school was the stated reason five talents
across three classes were inert, and **it was not true**: `rollTable` already
folds the school's modifier in before the roll, so the school was in hand all
along and what was missing was a FIELD. `AbilityModifier.hitBonus`, one line in
`talentBuild`, five talents -- Arcane Focus and Elemental Precision on the Mage,
Shadow Focus and Holy Precision on the Priest, Divine Precision on the Paladin.

**IT ALSO BUILT THE CLOCK-CONDITIONED MODIFIER** that Early Demise and the
Rogue's Quietus both wanted, which is `addWhileFinalFraction` -- and the Rogue
branch built the same thing independently. See the note on that field.

**ITS OWN FIGURES WERE MEASURED AT A BASE FOUR MERGES OLD** and are not repeated
here for that reason: Arcane +34.1, Frostfire +25.2, Shadow +17.4 and Shockadin
+12.4 against a baseline where Arcane was 392.6 and Shockadin 379.0. **The
published table below is re-measured once after all the dives land** rather than
patched five times -- which is the only way the 23 figures stay comparable to
each other, and comparability is the whole contract of that table.

**AND SHADOW WORD: DEATH WAS RE-ISOLATED AT THE CURRENT BASELINE AND HAS NOT
MOVED**: putting it back is +35.2 REAL, so spell hit and that ability are
independent and the cost of the owner's choice is confirmed rather than assumed.
See [docs/handoff/priest.md](docs/handoff/priest.md).

**THE DRUID DEEP DIVE MOVED THREE PROFILES AND THE OTHER TWENTY DID NOT MOVE BY
A DECIMAL.** Cat **488.0 to 656.1, +168.1**, Bear **376.2 to 444.7, +68.5**,
Moonkin **384.3 to 398.0, +13.7**, and every other figure identical -- which is
the containment check for nine talents and six new declarations. **Cat is now the
highest profile in the project**, above DW Fury's 651.2, from ninth.

**A GAIN THAT SIZE IS ATTRIBUTED, NOT ASSERTED.** `tools/druid_attribution.ts`
takes one talent back out at a time over the same 30 batches of 10. King of the
Jungle is **+104.5** on its own, because the Cat's whole fight budget is about
690 energy and two Tiger's Furies at 60 each are 120 of it; then Predatory
Strikes +62.9, the Glaive's form clause +32.3, Genesis +29.5, Rend and Tear
+16.6. **Two of those figures carry a cascade**: removing three points from Feral
Combat puts a deeper talent under its tier gate and `createPlayer` drops it
silently, so `-predatory_strikes` also drops Rend and Tear and Berserk. The probe
names every cascade beside its figure, and the first run of it did not.
See [docs/handoff/druid.md](docs/handoff/druid.md).

**THE MAGE DEEP DIVE MOVED TWO PROFILES AND LEFT TWENTY-ONE IDENTICAL.** Arcane
392.6 to **450.9, +58.3, REAL** and Fire 401.2 to **440.1, +38.9, REAL**, on two
signature mechanics that were each wrong in a way the code said out loud.
Frostfire did not move by a decimal, which is the containment check: it takes
neither Combustion nor Arcane Blast nor Arcane Power. **Arcane is now the top
Mage, and the Mage is the best caster after Firelock.**

| | |
| --- | --- |
| **Combustion, +38.9** | applied TEN stacks by writing `instance.stacks` directly, of `spellCritChance` -- every school -- for a placeholder 30 seconds. `applyStatModifiers` runs inside `apply` at ONE stack and only `refresh` re-applies, so the aura REPORTED ten stacks and PAID one. Three errors, and the first cancelled the other two. It is a real ramp now: a stack per Fire spell hit, Fire spells only, ending on four non-periodic Fire crits. `PLACEHOLDER_COMBUSTION_DURATION_MS` is deleted |
| **Arcane Blast, +64.5** | its "+10% damage to all your OTHER spells" was unmodelled with a caveat saying there is no "everything except this one". True of `damageDoneMultiplier` and not of `abilityModifiers`, where it is a list with one name left out. **When it ends is an INTERPRETATION** -- see the open questions |
| **Arcane Power, -6.2** | its "+30% mana cost" was dropped with a caveat saying it would need a list of every Mage spell. The list exists and a test derives the same set from `MAGE_ABILITIES` |
| **Winter's Chill, 0.0** | built, and no Mage profile takes it. `attackerAbilityModifiers` is the mirror of the `critWhileAura` Shatter needed: a crit bonus for two NAMED abilities carried by the TARGET |

**ITS TRIAL MERGE WITH `priest-deep-dive` PROJECTED Arcane 492.2, Fire 449.4 and
Frostfire 437.8**, the last being spell hit alone. **Not a baseline** -- a
projection on a merge that had not happened, recorded so whoever merged second
could tell a surprise from an expectation. The Priest merge is still to come.
See [docs/handoff/mage.md](docs/handoff/mage.md).

**THE SHAMAN DEEP DIVE MOVED BOTH ITS PROFILES AND NOTHING ELSE.** Ele Shaman
295.4 to **375.0, +79.6, REAL** — the largest single-profile gain in the project
since the owner's priority lists landed — and Enh Shaman 451.1 to **462.0, +10.9,
noise**, with the other twenty-one identical to the decimal.

**AND IT WAS RE-BASELINED AGAINST `main` AFTER THE WARRIOR AND WARLOCK DIVES
LANDED**, because both of those touched ENGINE files and a delta taken against the
older base would have credited this one with their work. Both Shaman figures came
back identical to the decimal, so nothing those two changed reaches this class —
which is also the containment check for them.

**THE ENHANCEMENT FIGURE IS A LIE BY NET AND THE DECOMPOSITION IS THE REPORT.**
Four real changes offset inside one interval, and because the build is MANA-BOUND
they do not sum to it either — removing Fire Nova's 520 mana a cast makes
everything above it more affordable, so each isolated value overstates what it
adds. Each measured on its own, 30 batches of 10:

| Change | Profile | Worth |
| --- | --- | --- |
| Searing Totem in the Elemental list | Ele | **+59.5** |
| Fire Nova, declared and in the Enhancement list | Enh | **+25.5** |
| Elemental Focus (Clearcasting) | Ele | **+12.5** |
| Lightning Overload | Ele | **+11.1** |
| Maelstrom Weapon, flat 20% to **5 PPM** | Enh | **+6.6** |
| Improved Stormstrike's mana regeneration | Enh | **+3.4** |
| Windfury imbue internal cooldown, 1.5s to **3s** | Enh | **-10.0** |

**THE LARGEST IS A TALENT POINT BUYING A CLAUSE THE ROTATION COULD NOT REACH.** The
Elemental build spends 3/3 on CALL OF FLAME, whose first clause is "the damage done
by your FIRE TOTEMS", and its list cast no totem for the whole project. The talent
was correct, its effect was correct, and it was worth nothing — which reports
identically to a talent that works. **When a talent names an ability, check a list
casts it.** See [docs/handoff/shaman.md](docs/handoff/shaman.md).

**AND IT PROPOSED TWO NEW SCOPE MEMBERS**, `castPushback` and `totemEntities`, on a
"blocked twice" argument rather than on the owner's word — which moved FIVE classes'
counts, not just its own. See CLAUDE.md under **Scope**; the owner has not ruled on
them.

**THE PALADIN DEEP DIVE MOVED ALL THREE OF ITS PROFILES AND NOTHING ELSE.**
Seal Twist Ret 471.0 to **528.3 (+57.3)**, Shockadin 379.0 to **472.7 (+93.7)**,
Prot Pally 153.2 to **238.1 (+84.9)**, every one REAL -- and the twenty
non-Paladin profiles identical to the decimal, which is the containment check for
a change touching four shared engine files. Seal Twist Ret becomes the project's
third-highest profile and Prot Pally stops being an outlier at the bottom.

**NOTHING IN IT WAS A NEW NUMBER.** Six of the eight gaps it closed were never
engine gaps: their `unmodelled` reasons were claims about what the engine could
not do, and each claim was about the wrong thing. Three of them rested on a rule
that a reaction cannot fire on a BLOCK, which **the Warrior's own reactions have
disproved since the attack table was written**. See
[docs/handoff/paladin.md](docs/handoff/paladin.md).

**THE WARRIOR DEEP DIVE MOVED TWO PROFILES AND BOTH MOVES ARE NOISE.** 2H Arms
607.2 to **603.3** (-3.9 against +/-9.1) on Slam's cooldown going 15 to 18, and
DW Fury 652.0 to **651.2** (-0.8 against +/-8.9) on Spearing Strike turning out
to require a two-handed weapon. The other twenty-one are identical to the
decimal, Prot Warr included. **The uses column is where the change actually
shows**: Slam 2.9 casts a fight to 2.5, and Spearing Strike 2.7 to ZERO, with
its 15 rage going straight into Heroic Strike -- 9.0 casts to 11.0. **Losing an
ability outright cost 0.8 DPS**, which is what a rage-bound build looks like --
and it means the owner's Spearing Strike entry was worth about one DPS even
while it worked.

**THE SAME DIVE TOOK THE FIRST CLASS TO ZERO LIVE GAPS.** See
[docs/handoff/warrior.md](docs/handoff/warrior.md) and
[docs/source-cross-checks.md](docs/source-cross-checks.md).

**SHATTER MOVED ONE PROFILE AND THE CONTAINMENT HELD EXACTLY.** Frostfire
376.6 to **412.5, +36.0, REAL**, and the other twenty-two identical to the
decimal -- which is what a talent change scoped to one build should look like.
It makes Frostfire the top Mage, above Fire's 401.2 and Arcane's 392.6, and the
build that existed for the Fire/Frost overlap now has a third reason to. The
mean across 23 is 463.5, and the three dives that moved it are below. See
[docs/handoff-apl.md](docs/handoff-apl.md).

**THE WARLOCK DEEP DIVE MOVED FIVE PROFILES AND ONE OF THEM A LONG WAY DOWN.**
**Firelock 535.5 to 468.4, -67.1, REAL** -- a CORRECTION, and the four causes were
each carrying a comment admitting what they did:

| | |
| --- | --- |
| **-42.2** | **Shadow and Flame**, whose two halves name OPPOSITE schools on purpose. Both were whole-character multipliers, so a hybrid held x1.10 TWICE ON EVERY SCHOOL where the talent gives x1.10 once per school. Its comment read "generous for a hybrid, which Firelock is" |
| **-13.1** | **Demonic Sacrifice**, whose Succubus option is "+15% FIRE damage". Whole-character too, so the 22% of Firelock that is Shadow collected a fire bonus. Its comment read "exact for either profile" -- true of SM/DS, not of this one |
| **-4.8 / -3.3** | **Agonizing Flames and Ruin**, both "your DESTRUCTION spells" read as Fire and Shadow -- the two schools a Warlock HAS, which is every spell it owns. So both also raised Corruption, 13.5% of the profile |

**AND THE OTHER DIRECTION: SM/DS 349.1 to 363.9, +14.8, REAL**, all of it Pandemic,
plus **+2.6 to +3.2 on all three Rogues** from Lethality. Those two talents wanted
the IDENTICAL missing declaration and both said so in almost identical words; one
`abilityCritDamage` effect reached both. **The other eighteen profiles are
identical to the decimal.**

**TWO LESSONS, AND THE FIRST IS THE EXPENSIVE ONE.** A clause that cannot be
expressed per school is not therefore worth applying whole-character with a
caveat -- "generous for a hybrid" was 42 DPS. And **a TREE is not a SCHOOL**:
Shadow Bolt is a Destruction spell in the source's own spellbook tab, which is the
entry the school reading gets wrong. See
[docs/handoff/warlock.md](docs/handoff/warlock.md).

**RE-MEASURED ON THE RULESET OWNER'S OWN PRIORITY LISTS.** All 23 are theirs now,
specified entry by entry; what was here before was this project's guess and said
so. Fourteen profiles moved.

| Profile | Class | Talents | DPS | | Profile | Class | Talents | DPS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BM Hunter | Hunter | 31/20/0 | 731.8 | | Fire Mage | Mage | 10/39/2 | 449.4 |
| Cat Druid | Druid | 9/35/7 | 656.1 | | Bear Druid | Druid | 9/42/0 | 444.7 |
| DW Fury | Warrior | 18/33/0 | 651.2 | | **Venom Rogue** | Rogue | 37/12/2 | **440.2** |
| 2H Arms | Warrior | 38/13/0 | 603.3 | | Frostfire Mage | Mage | 0/29/22 | 437.8 |
| Seal Twist Ret | Paladin | 13/0/38 | 528.3 | | **Rupture Rogue** | Rogue | 12/8/31 | **402.5** |
| Arcane Mage | Mage | 47/4/0 | 492.2 | | Moonkin | Druid | 38/0/13 | 398.0 |
| Shockadin | Paladin | 23/0/28 | 472.7 | | Ele Shaman | Shaman | 38/13/0 | 375.0 |
| Firelock | Warlock | 5/11/35 | 468.4 | | SM/DS | Warlock | 40/11/0 | 363.9 |
| Enh Shaman | Shaman | 19/32/0 | 462.0 | | LW Melee | Hunter | 7/13/31 | 362.7 |
| **Combat Rogue** | Rogue | 18/33/0 | **461.8** | | LW Ranged | Hunter | 7/39/5 | 311.7 |
| Shadow Priest | Priest | 16/3/32 | 454.7 | | Prot Pally | Paladin | 8/36/7 | 238.1 |
| Prot Warr | Warrior | 17/0/34 | 454.6 | |  | | |  |

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
| **9** | priority list entries that never fire, six of them deliberate. The ninth is Spearing Strike in the Berserker list, added by the Warrior dive — and it is the one `ability_audit.ts` itself cannot see, because the build does not have the ability |
| **23 of 23** | damage tables summing to **100%** |
| **0** | abilities that deal damage without responding to a stat (the coefficient probe's result) |

**THOSE LAST TWO TOGETHER ARE THE BILL OF HEALTH**: everything that deals damage
scales with something, and everything that deals damage is counted. The share
total is the one that is easy to overlook and hard to fake -- a source nobody
reports reads as a zero rather than as a gap.

**AND IT CORRECTED A DOCUMENTED INVARIANT.** Both handoff files claimed every
entry in every list fires; eight did, nine do now, and the claim was
contradicted two paragraphs below in the same file by the stance and shout
entries kept on purpose.

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
| [warrior.md](docs/handoff/warrior.md) | 2H Arms, DW Fury, Prot Warr | **0** |
| [paladin.md](docs/handoff/paladin.md) | Seal Twist Ret, Shockadin, Prot Pally | **2** |
| [druid.md](docs/handoff/druid.md) | Moonkin, Cat, Bear | **2** |
| [rogue.md](docs/handoff/rogue.md) | Venom, Combat, Rupture | **3** |
| [shaman.md](docs/handoff/shaman.md) | Ele Shaman, Enh Shaman | **6** |
| [hunter.md](docs/handoff/hunter.md) | BM Hunter, LW Ranged, LW Melee | **8** |
| [mage.md](docs/handoff/mage.md) | Frostfire, Arcane, Fire | **11** |
| [priest.md](docs/handoff/priest.md) | Shadow | **12** |
| [warlock.md](docs/handoff/warlock.md) | SM/DS, Firelock | **20** |

**THE WARRIOR'S 0 AGAINST THE WARLOCK'S 25 IS NOT A DIFFERENCE IN DIFFICULTY.**
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
| **64 of 468 talents are a live gap** | well down from a raw count of 251 unmodelled reasons, because 95 are permanently out of scope by ruling and 35 more are PARTLY modelled. See the census below, and **re-sum it rather than adjusting it** — the raw total is not a work queue. **The Warrior is at zero**, the first class to get there |
| **114 abilities declared against 478 captured** | the data is on disk; the declarations are not. Druid 15, Hunter 14, Mage 13, Rogue 12, Warlock 10, Shaman 9, Priest 7, Paladin 6, plus the Warrior's 27. **THE WARRIOR IS RECONCILED**, which is what the exclusion list below actually means: 42 captured against 30 declared counting its three stances, and each of the 12 that are not declared is named — 3 that Forever has and nothing here needs, 9 that are threat or crowd control by ruling. See [docs/warrior.md](docs/warrior.md). It is the only class where the subtraction balances |
| ~~**Coefficients**~~ | **DONE, AND NOW EVERY ROW IS APPLIED.** `WoWSimWorksheet.xlsx`, the owner's authoritative coefficient document, is transcribed in `src/game/combat/coefficients.ts` and applied across all nine classes. Every derived rule is deleted. The last unapplied row was Hammer of Wrath, which was not a declared ability until the owner put it in two Paladin priority lists; the two poison rows went the same way when the poison system landed. [docs/spell-coefficients.md](docs/spell-coefficients.md) |
| **15 `PLACEHOLDER_*` constants** | each a real number nobody has supplied. **COUNT THEM, DO NOT ADJUST THEM**: `grep -rhoE "PLACEHOLDER_[A-Z_]+" src/ \| sort -u \| wc -l`. The Warlock dive and the Warrior dive each removed one from 19 and each wrote 18, and git merged that without a conflict — this figure was wrong by one for exactly as long as it took to re-derive it, the Paladin dive removed a third, and the Shaman dive a fourth when Maelstrom Weapon's invented chance became 5 PPM. Sniper Shot's invented 200-mana cost is gone, but it was never one of these: it was a bare literal with a false caveat, which is worse — an invented number that is not named cannot be audited |
| ~~**Rotations are thin and unmeasured**~~ | **DONE.** All 23 priority lists are the ruleset owner's own, specified entry by entry, and every one is measured — see the baseline above and [docs/handoff-rotations.md](docs/handoff-rotations.md). The twelve dead entries of that round are gone; the nine that remain are listed in [docs/ability-audit.md](docs/ability-audit.md), each with a reason and none of them a broken declaration. Fourteen abilities and three talent mechanics were declared to reach them, and six engine capabilities built |

**The Warrior was built first and built properly, and it is not the norm.** Read
any claim about this project's depth as a claim about the Warrior until checked.
It is the only class with an owner spreadsheet, the only one documented in
`docs/` at all, and it carries 2,025 comment lines against 268–529 for every
other class.

### All nine classes are cross-checked

Against `foreverchanges.pro`, under the owner's standing rule that **where it and
our own capture disagree, it wins**. Full record, method and its two traps in
[docs/source-cross-checks.md](docs/source-cross-checks.md).

**NOT ONE CLASS CAME BACK CLEAN. Twenty-seven figures moved**, and **three more
on the Warrior's re-check** -- thirty. The exercise found three distinct kinds of
error, and the Warrior re-check added a FOURTH:

| | |
| --- | --- |
| **Source disagreement at the same build** | most of them, usually a few points. Both sources read 1.60.1.70009, so refreshing a capture settles nothing — which is why the standing rule was needed |
| **Build drift** | a figure that was right when written and is not now: Wrath 62–68 → 92–102, Holy Strike 40%/12s → 50%/10s, Life Tap doubled, and Mangle **renamed to Primal Bite**. **No amount of cross-checking finds these; only refreshing the captures does** |
| **Our own transcription** | Sniper Shot, wrong in four fields at once, with the answers in its own capture the whole time |
| **A source that is SILENT rather than different** | Spearing Strike's two-handed requirement is stated by two sources and omitted by the third, which is the one we had. An omission is not a denial, so the tie-break rule never applies -- the sources that speak decide it. **The same shape as Shadowburn's Soul Shard**, where `foreverchanges.pro` carries no reagent field at all |

The third kind is the one to fear. **Sniper Shot** read 160 damage, a 200-mana
placeholder, instant cast and a 6-second cooldown; its capture says 295, 365 mana,
a **4-second cast** and 15 seconds, and said so at both builds. The old comment
applied the rank-1 rule to a capture that is already max rank — a real rule, the
wrong artifact — and the placeholder's justification ("the spellbook gives no cost
line at all") was simply false.

**What moved most**: Prot Pally +13.5% and Seal Twist Ret +10.0% on Holy Strike's
doubling, Firelock +12.1% on Life Tap, and **LW Ranged −11.1%** on Sniper Shot
becoming a four-second cast.

**AND EIGHT CLASSES ARE NOW ONE REFRESH OLD.** The Warrior's re-check found
Slam's cooldown had gone 15 to 18 in ELEVEN DAYS, on the class with the best
sources in the project and against a figure the owner had confirmed personally.
Nothing in this repository moved; the game did. The other eight captures are all
at build 1.60.1.70009 and have not been re-fetched since 2026-09-25.
`node tools/import_forever_spells.mjs --all --write` is one command, and the
diff is where the change announces itself.

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
| Warrior | 53 | 43 | 4 | 6 | **0** |
| Paladin | 52 | 32 | 5 | 13 | **2** |
| Druid | 51 | 29 | 5 | 15 | **2** |
| Hunter | 50 | 27 | 6 | 9 | **8** |
| Shaman | 50 | 22 | 4 | 18 | **6** |
| Mage | 54 | 30 | 2 | 11 | **11** |
| Priest | 53 | 20 | 2 | 19 | **12** |
| Rogue | 53 | 31 | 5 | 14 | **3** |
| Warlock | 52 | 24 | 3 | 5 | **20** |
| **Total** | **468** | **258** | **36** | **110** | **64** |

**THE WARRIOR LEFT THE GAP COLUMN ENTIRELY**, and its last entry is worth
reading because of the shape rather than the size. Improved Berserker Rage's
reason was "grants rage when Berserker Rage is activated, and no priority list
casts Berserker Rage" — an argument about a LIST, filed where this project keeps
arguments about the ENGINE — while the number it needed, 5 and 10 by rank, sat in
`values/warrior.json` the whole time. **A reason that argues from a rotation is
not an engine gap**, and it read like one for as long as it existed.

**AND THE PALADIN LEFT IT ALMOST ENTIRELY, FOR A RELATED REASON SIX TIMES OVER.**
Eight talents left the column and **six were never in it**: Reckoning, Holy
Shield and Shield Specialization all rested on a rule that a reaction cannot fire
on a BLOCK, which the Warrior's own Shield Specialization, Revenge, Enrage and
Blood Craze have disproved since the attack table was written. Divine Favor's
reason was true of `CastModifier` and false of an aura's `abilityModifiers`;
Sanctified Judgement's wanted a cast reaction that already existed; and Templar's
Bulwark had been granted, cast and absorbing in full the whole time. **Only Divine
Precision needed a new engine field.** Read every reason that names an engine
limitation against the ENGINE, not against its own plausibility.

**SIX TALENTS LEFT THE GAP COLUMN WITH THE PRIORITY LISTS**, and four of them
were never really in it. Cutthroat and Premeditation were counted among the
eleven Rogue talents that stealth makes inert and are neither -- Cutthroat is an
in-combat proc whose whole purpose is to REMOVE a stealth requirement, and
Premeditation's Forever tooltip has no stealth clause at all. Preparation's
reason was a statement about the engine ("nothing can reset a cooldown from
content") and the engine now can. Fingers of Frost carried `FROZEN_UNMODELLED`,
which is a claim about the TARGET, and that talent does not freeze anything.

**294 of 468 talents do something**, 110 never will, and **64 are the
actual remaining work** — not the 251 a raw count of unmodelled reasons
suggests. The 105 scoped entries break down as 34 healing, 33 crowd
control, 17 positioning, 14 threat and 7 stealth.

**EVERY FIGURE IN THIS SECTION IS RE-SUMMED FROM THE TABLE ABOVE RATHER THAN
ADJUSTED, AND THIS MERGE IS WHY.** The Warlock dive and the Warrior dive each
moved the total from the same base and each wrote its own answer; both also wrote
this warning, independently, which is how close the trap is to the surface. Two
branches moving a count by one from the same base both write the same number, git
merges them without a conflict, and the total is short by one.
`tools/class_audit.ts` derives the whole census independently and throws if the
buckets do not account for every talent — run it rather than trusting this.

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

**THE WARRIOR NOW HAS ONE AND IT BALANCES**, which is the worked example for the
other eight: 42 captured, 30 declared, and the 12 that are not are named
individually — Victory Rush, Retaliation and Tactical Mastery, plus nine that are
threat or crowd control by existing ruling. Nothing is declared that the capture
does not have, which is the check in the other direction. Each class is one
`node tools/import_forever_spells.mjs <class>` and an hour of reading.

### Open engine gaps

| Gap | Talents | Classes |
| --- | --- | --- |
| ~~**Spell hit per school**~~ **BUILT.** `AbilityModifier.hitBonus`, taken off MISS because no table carries a hit chance, and folded by `combineModifiers` AND by `combine` — it was not folded by the second at first, so one source worked and two cancelled. The reason, that the table decides hit before any per-school modifier is consulted, was false: the school's modifier was already one of `combineModifiers`' three arguments. Divine Precision uses it; **the other four are a one-line effect each and belong to their own re-measured baselines** | ~~5~~ 4 | Mage ×2, Priest ×2 |
| ~~**Crit damage for a LIST of NAMED abilities**~~ **BUILT.** `abilityCritDamage` is the declaration `critMultiplierBonus` had been waiting for since Impale. Pandemic and Lethality both named the field in almost identical words, so it was built once: **+14.8 to SM/DS and +2.6 to +3.2 across the three Rogues** | ~~2~~ 0 | — |
| ~~**A per-school damage multiplier from an AURA**~~ **BUILT.** `damageDoneBySchool`, predicted by name in `game/auras/warrior.ts` before it existed. Demonic Sacrifice and Shadow and Flame were both whole-character with a caveat, and the caveat was **−55.3 DPS of Firelock** | ~~2~~ 0 | — |
| ~~**A periodic-only school vulnerability**~~ **BUILT.** `periodicDamageTakenBySchool`, which Wrack's own `unmodelled` reason named. A plain Shadow vulnerability would also have raised Shadow Bolt at half the SM/DS profile | ~~1~~ 0 | — |
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
| `PLACEHOLDER_FLURRY_DURATION_MS` / `_REVENGE_WINDOW_MS` | 12s / 5s | Warrior-era; charges end Flurry in practice. **`_BERSERKER_RAGE_DURATION_MS` is gone**: all three sources say "Lasts 10 sec", and the placeholder's reason was a claim about the owner's spreadsheet being silent — true of the spreadsheet and irrelevant to the data |
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

**THREE ARE NEW AND ALL THREE COME FROM THE WARRIOR DIVE.** Each is a decision
rather than a missing number, and none of them blocks anything.

- **DW Fury's point in Spearing Strike, and the Berserker list's entry for it.**
  Spearing Strike requires a two-handed weapon -- stated by the spellbook capture
  and by `foreverchanges.pro`, absent only from the Wowhead tooltip this project
  had been reading. So the point buys nothing on a dual-wielder and the list entry
  can never fire. The entry was added on your instruction precisely BECAUSE the
  point looked wasted, so both halves are yours to move. It was worth about one
  DPS even while it worked: removing it cost 0.8, because the 15 rage went
  straight into Heroic Strike.
- **Berserker Rage's magnitude**, which is the same question as before and now the
  only unanswerable thing on the class. "Generating extra rage when taking damage"
  -- no number in any source, and the spell carries exactly two effect rows, both
  immunities. Improved Berserker Rage's 10 rage ON ACTIVATION is stated and is
  applied; the ability's own half is not.
- **Retaliation.** 15 minutes in Forever, down from 30. Battle Stance, 15 seconds,
  at most 30 counterattacks. It is a real Arms cooldown once a target swings back
  and it is not modelled -- worth nothing to all three profiles today, because the
  one in Battle Stance is the one whose target stands still. Worth declaring only
  if an attacking Arms encounter is wanted.

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
   - **Ask the owner for each placeholder number** — 16 of them, listed
     above. Every one answered is a placeholder deleted. **One went without being
     asked about**: Berserker Rage's duration was never missing data. **And Seal
     of Command's is the proof the asking is worth it** — one message turned the
     largest invented number in a top-three profile into real data.
     **FOUR PALADIN QUESTIONS WERE ANSWERED IN ONE PASS AND ONLY ONE WAS A
     PLACEHOLDER.** The other three were inert TALENTS, which is the lesson the
     coefficient sheet taught twenty-nine talents at once. **Check whether a
     missing number is missing DATA or a missing RULING.**
   - **The talents whose rule already exists with nothing hooked to it.**
     Shaman Elemental Focus is the clearest: a one-shot cost modifier is exactly
     `CastModifier.costFraction` with `consumedByCast`, which Maelstrom Weapon
     already uses, and its reason still says it has no declaration.
     ~~Rogue Lethality and Warlock Pandemic want `critMultiplierBonus`, which
     exists and nothing reaches.~~ **Both DONE** -- `abilityCritDamage`, one
     declaration for both, and it did move DPS: +14.8 to SM/DS and +2.6 to +3.2
     across the three Rogues. **These will move DPS, so they want their own PR
     and a re-measured baseline**, which is how that one was done.
     **AND THE PALADIN IS THE WORKED EXAMPLE OF HOW BIG THIS CATEGORY IS.** Six
     of its ten live gaps were in it, worth +57, +94 and +85 DPS across its three
     profiles, and not one of them needed a number nobody had. Three were
     contradicted by code in the WARRIOR'S OWN reaction file. **Read every
     `unmodelled` reason that names an engine limitation against the engine, not
     against its own plausibility.**
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
lists are the owner's, the nine entries that do not fire each have a reason,
and the baseline above is measured on them. [docs/handoff-rotations.md](docs/handoff-rotations.md)
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
