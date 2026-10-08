# ROGUE DEEP DIVE

**Class:** Rogue
**Profiles to audit and prepare:** Venom, Combat, Rupture, **Hemo**

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## Where this class is

**THE DIVE IS DONE. Fourteen live gaps to three, and not one of the three is an
engine gap.** Nine talents were built, five engine capabilities were added to
reach them, and two `unmodelled` reasons turned out to have expired while still
being printed on the results page.

| | |
| --- | --- |
| **Live gaps** | **3**, down from 14 |
| `remorseless_attacks` | needs a KILL, and the fight ends on a timer with the target alive. Not the same case as a "below N% health" clause, which the owner has ruled is the final fraction of the fight |
| `riposte`, `setup` | need a target that swings back. `targetAttacks` supplies one and no Rogue profile sets it, so these are **PROFILE gaps rather than engine ones** and want no new rule |

**THE TWO PROFILE GAPS ARE THE ONLY THING LEFT THAT COULD BE CLOSED HERE**, and
closing them means giving a Rogue profile a target that attacks back — which is
a build decision for the owner, not a modelling one.

### The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 53 | **32** | **6** | **12** | **3** |

Reprint it with `npx vite-node tools/class_audit.ts rogue`, which derives the
whole thing and throws if the four buckets do not account for every talent.

**THE PARTLY COLUMN GAINED TWO TALENTS THAT WERE ALREADY WORKING.**
`vile_poisons` and `improved_poisons` apply in full — `poisonReactions` reads
both ranks straight off the allocation — and every census in the project
counted them as live gaps, because `class_audit` counts EFFECTS and their
reasons only said "APPLIES" in capital letters. **Prose could not fix that**, so
the `unmodelled` effect carries `appliedElsewhere` now: a string naming the
module that really applies it, which is data, is countable, and can be checked
because it names a file.

---

## The profiles

**THE DPS COLUMN BELOW IS THE DIVE'S OWN MEASUREMENT AND HAS SINCE MOVED.** Four
later changes reached these profiles -- armor penetration being wired up, the
flat-inside-the-weapon-fraction rule, Seal Fate's first cast, and the Venom
list's own rework -- on top of everything other classes merged in between. Read
the column as what the dive was worth, not as today's baseline, and reprint the
current figures with `npx vite-node tools/measure_profiles.ts`.

| Profile | Talents | DPS | was | | List |
| --- | --- | --- | --- | --- | --- |
| Combat | 18/33/0 | **691.1** | 419.8 | **+271.3** | `ROGUE_COMBAT` |
| Hemo | 17/3/31 | **622.4** | — | *new in this dive* | `ROGUE_HEMO` |
| Venom | 37/12/2 | **594.5** | 392.7 | **+201.8** | `ROGUE_VENOM` |
| Rupture | 12/8/31 | **584.2** | 377.1 | **+207.1** | `ROGUE_RUPTURE` |

**ALL FOUR RE-READ FROM ONE RUN ON `main`, AND ALL FOUR WERE STALE BY 60 TO 105.**
They stood at 586.3 / 510.6 / 497.6 / 527.1, and **none of that was Rogue work**:
the enchants, the consumables and a run of owner rulings moved every profile in
the project while this class was untouched. **A per-class table drifts fastest
when the class is finished**, because nothing is re-measuring it.

**THIS COLUMN IS KEPT CURRENT NOW, AND IT WAS NOT.** It stood at 461.8 / 440.2 /
409.4 — the dive's own figures, correct on the day and moved four times since by
later work. All three are re-read from one 23-profile run, on the tree that has
both the Venom APL and the Combat work in it.

**AND RE-READING IS WHY, RATHER THAN ADJUSTING.** It has earned its keep twice in
two days. Once on a clean rebase of two pull requests off the same `main` that had
each edited this table and each written a Venom figure the other invalidated — git
had nothing to flag, because they touched different entries in the same file. And
once on the **flat-damage revert**, which moved Venom and Rupture again.

**TWO OF THESE THREE FIGURES MOVED TWICE IN TWO DAYS AND NEITHER MOVE WAS A ROGUE
CHANGE.** Venom went 488.1 → 504.8 on its own APL work and then → 510.6 when the
owner corrected where an ability's flat damage sits; Rupture went → 470.7 on that
same formula and back to 455.0. **Combat is 586.3 throughout**, because Sinister
Strike is 100% weapon damage and the formula question cannot touch it.

**THE CONTAINMENT CHECK WAS EXACT: the other twenty profiles are identical to
the decimal.** Five of the nine talents built are Rogue-only content and four
are engine capabilities with one caller each, so nothing else could move — and
the run says nothing else did.

### What each change was worth, isolated

Knocked out one at a time, 30 batches of 10 each, against the finished branch.
**Every one reaches exactly the profiles that take the talent**, which is a
containment check per talent rather than per commit.

| | Venom | Combat | Rupture |
| --- | --- | --- | --- |
| `murder` +4% all damage | **+16.9** | **+17.8** | — not taken |
| Mutilate's +20% vs Poisoned | **+14.9** | — | — |
| `puncturing_wounds` Mutilate crit | **+15.3** | — | — |
| `hack_and_slash` sword extra attack | — | **+13.9** | — |
| `weapon_expertise` | — | +10.6 *(noise)* | — |
| `puncturing_wounds` Backstab combo point | — | — | **+12.3** |
| `thousand_cuts` | — | — | **+9.3** |
| `serrated_blades` +30% Rupture | — | — | **+8.3** |
| `serrated_blades` armor penetration | — | — | **+4.8** † |
| Hemorrhage's +15% Rupture taken | — | — | +4.5 *(noise)* |
| `lethality` crit damage | +5.7 *(noise)* | +2.7 *(noise)* | +2.6 *(noise)* |

**`murder` IS THE LARGEST SINGLE ITEM ON TWO OF THE THREE PROFILES**, and it is
not a mechanism at all — it is the owner's ruling that the target is a Humanoid
or a Giant, applied the way the Hunter's Improved Tracking already is, with the
assumption stated in the talent's own entry rather than checked by the engine.
Its old reason blamed the ENGINE ("no combatant here carries a creature type")
and the question was never put to the owner. **Check whether a missing number is
a missing RULE before recording it as a gap** — this is the second time that has
paid out, after the coefficient sheet.

**`lethality` MEASURES AS NOISE ON ALL THREE AND IS STILL CORRECT.** A crit
damage bonus reaches only the crit half of the abilities it names, and abilities
are under half of a Rogue's damage — so 20% of the bonus half of a x2 crit on a
minority of a minority is a couple of DPS. **A correct talent can be worth
nothing**, and the mechanism is tested rather than the delta.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Venom | Main Hand 37.5%, Mutilate 16.0%, Off Hand 14.3%, **Instant Poison 11.9%, Deadly Poison 10.7%**, Mutilate (Off Hand) 7.4% |
| Combat | Main Hand 42.2%, Sinister Strike 18.3%, Off Hand 17.2%, Eviscerate 12.4%, Instant 4.4%, Deadly 4.0% |
| Rupture | Main Hand 38.2%, Backstab 20.4%, Off Hand 14.1%, **Rupture 8.0%**, Deadly 7.3%, Hemorrhage 5.7% |

**AUTO ATTACKS ARE 52–59% OF EVERY ROGUE PROFILE**, which is why `murder` — the
one change that reaches a swing — outweighs the four that reach abilities.

**RUPTURE IS 8.0% OF THE BUILD NAMED AFTER IT, UP FROM 3.6%**, without the
priority list being touched. Serrated Blades' +30% and Hemorrhage's +15% both
land on it now. **The owner said 1.3 applications a fight was too low and that
is still open** — this raised what each application is worth, not how many there
are.

---

## The five engine capabilities, and their one caller each

Each is a missing DECLARATION rather than a missing rule, which is what the
`unmodelled` reasons said and what turned out to be true.

| | For | The trap |
| --- | --- | --- |
| `armorPenetration` (stat) | `hack_and_slash` mace, `serrated_blades`, **and the Warrior's Weaponmaster** | A percentage of the ARMOR, not of the reduction. 9% off a boss's 3731 armor is **2.23 points** of mitigation, not 9; the other reading is four times the talent. **† It reached `main` GRANTED AND UNREAD** -- see below |
| `dodgeParryReduction` (stat) | `weapon_expertise` | NOT `hitChance`. Hit comes off MISS, and miss, dodge and parry are three different-sized slices that move differently with the level gap |
| `CastModifier.costReduction` | `thousand_cuts` | FLAT. A fraction is right for a 380-mana spell and wrong for a 35-energy strike |
| `AuraDefinition.abilityDamageTaken` | Hemorrhage's Rupture clause, Mutilate's Poisoned clause | NOT a school multiplier. Rupture is physical, so +15% physical would raise every swing on the target too |
| `AbilityModifiers.addWhileFinalFraction` | `quietus` | Keyed by FRACTION, because Quietus is 35% and the Priest's Early Demise is 20%. A shared constant would silently hand one the other's window |

**THREE NEW TALENT EFFECT KINDS**, and two of them are selectors that were
simply absent: `abilityCritDamage` names a LIST of abilities for crit DAMAGE
(the Warlock's Pandemic wants the same one), `abilityBelowTargetHealth` carries
the clock ruling as data, and `abilityCrit` finally took a `valueIndex`.

**`stat` TOOK A `requires` TOO**, which is what let Hack and Slash's three
weapon clauses be three entries instead of a paragraph of apology. An unmet
clause is REPORTED by `talentBuild` rather than silently skipped.

---

## † THE STAT WAS GRANTED AND READ BY NOTHING, FOR A RELEASE

**The single most useful thing in this document, because the tests passed.**

`armorPenetration` landed on `main` declared in `STAT_NAMES`, granted by
Serrated Blades, Hack and Slash and Weaponmaster, counted by the census as
fully modelled, and described by a comment in `rogueEffects.ts` as "read by
`resolveDamage` off the ATTACKER". `resolveDamage` read
`target.stats.get('armor')` raw. A Rogue with nine points of penetration took
exactly the damage reduction of a Rogue with none.

**IT WAS MY OWN TEST THAT MISSED IT, AND THE NAME SAID OTHERWISE.** The test was
called *"really is a stat now, and it really reaches the pipeline"* and never
touched the pipeline. What the file asserted was:

| | |
| --- | --- |
| the ARITHMETIC | `armorReduction` on an already-reduced armor figure |
| the REGISTRATION | `talentBuild` putting the number on the stat |

Both correct. Both still passing with the feature dead, because **neither half's
test can fail when the JOIN between them is missing.** A test for two correct
halves has to resolve real damage and compare, which is the one assertion that
cannot pass unless the wiring exists -- and with the fix reverted it fails by
22.2 damage while all three originals stay green.

**THE FIGURE IT WAS WORTH:** the Rupture Rogue 450.3 to **455.0, +4.8**, with the
other twenty-two identical to the decimal. The tool calls +4.8 noise against a
±3.4 interval and the containment is what settles it -- twenty-two profiles at
exactly 0.0 and one at +4.8 is not how noise distributes, and the mechanism test
proves the damage changed. The +6.9 recorded above was measured on the
pre-merge base, where the profile ran at 377 rather than 450.

## ADRENALINE RUSH WAS INERT FOR THE WHOLE PROJECT, AND WORTH +53.0

**Combat 524.2 → 577.2 from one field.** The biggest single figure the Rogue has
produced, and it was never a missing engine capability.

**ITS `unmodelled` REASON WAS WRONG ABOUT THE ENGINE RATHER THAN STALE.** It read
*"energy arrives as a fixed batch on a timer … Needs a rate multiplier on
ResourceRegen."* `ResourceRegen.amountPerTick` has been `(actor, context) =>
number` since it was written, and `createPet` has multiplied a pet's focus through
that exact signature for as long as pets have existed. **The hook was there and
nothing was pointed at it** — so this is not the "expired reason" failure mode
below, it is a reason that was false on the day it was written.

**AND THE RESULTS PAGE SHOWED IT WORKING.** The ability was cast, spent its
cooldown, applied its aura and reported **24.9% uptime** for the whole project
while delivering no energy at all. An inert buff with visible uptime is the
hardest kind to notice: there is no missing row, no zero and no caveat where a
reader is looking. **The buff-uptime table is not evidence that a buff does
anything** — it only says the aura was present.

The multiplier is data on the aura (`AuraDefinition.resourceRegenMultiplier`) and
the rule is on the combatant (`regenMultiplierFor`), so the shared energy rule a
Cat Druid also uses does not have to name a Rogue cooldown.

**BLADE FLURRY WAS CHECKED AT THE SAME TIME AND WORKS.** Fight-average haste of
29.63% is exactly Slice and Dice 30% × 82.1% uptime plus Blade Flurry 20% × 24.9%
— so its haste half is live and only its second target is missing, which is the
`positioning` ruling and not a gap. **Two cooldowns that looked equally
suspicious, and the arithmetic separated them in one reading.**

---

## THE COMBAT LIST SPENT EXACTLY ONE COMBO POINT ON EVERY EVISCERATE

**+10.8 from a two-point gate**, 577.7 → 588.5 at 90 batches of 10.

**IT WAS ARITHMETIC AND NOT A TENDENCY.** Sinister Strike is the only builder in
the list and awards one point; Eviscerate sat ABOVE it with no point gate, so it
was the first castable entry the moment a point existed and the bar went
0 → 1 → 0 forever. **Ten casts a fight, ten points.** An ungated finisher above
the only builder does not spend "whatever is on the bar" — it spends ONE, always,
while the list reads as though it might spend five.

**SO THE GATE IS THE POINT COUNT, NOT A FLOOR.** Every cast lands at exactly the
gate, which makes the sweep a sweep over Eviscerate's combo point cost:

| points spent | DPS (90 batches of 10) |
| --- | --- |
| 1 (ungated) | 577.7 ± 3.4 |
| **2** | **588.5 ± 2.9** *(shipped)* |
| 3 | 587.2 ± 3.4 |
| 4 | 580.6 ± 4.9 |
| 5 | 572.2 ± 4.2 |

**FIVE LOSES, AND THE REASON IS IN THE DAMAGE TABLE.**
`EVISCERATE_BY_COMBO_POINT` is 278, 448, 618, 788, 958 — **278 for the first
point and 170 for each one after**. Damage per combo point therefore FALLS as the
bar fills: 278, 224, 206, 197, 192. "Hold for five" is the right rule for a
finisher whose table runs through the origin and Eviscerate's does not. One point
still loses because the 35 energy and the global cooldown are paid per CAST, so
278 for a whole cast is worse than the Sinister Strike it displaced.

**THIS IS WHY THE EARLIER READING SAID THE QUESTION WAS FLAT.** CLAUDE.md records
Combat's Eviscerate going "from 1.1 casts a fight to 9.0 for +0.6 DPS" — and both
of those lists are the two WORST points on the curve, bad in opposite directions.
**A two-point comparison cannot see a peak**, and "it does not matter" is the
conclusion it hands you when the two ends happen to measure the same.

### Slice and Dice: the uptime fix was the Eviscerate gate

**86.7% → 88.3% with the Slice and Dice entry untouched.** The ungated Eviscerate
was draining the bar on every single point, so there was never a point banked when
Slice and Dice needed three. **The uptime problem was not in the Slice and Dice
entry at all**, which is where it looked like it was.

**A REFRESH WINDOW WAS MEASURED AND REJECTED**, recorded so it is not re-run:

| | DPS (90 batches of 10) | SnD uptime |
| --- | --- | --- |
| **if not active** *(the owner's, shipped)* | **588.5 ± 2.9** | 88.3% |
| ≤ 2s remaining | 590.2 ± 2.9 | 89.3% |
| ≤ 4s remaining | 590.0 ± 3.3 | 89.4% |

+1.7 against ±2.9 is not a difference this method can report, and the standing
warning about refresh windows applies in full — **a refresh RESETS the aura**.
With no Improved Slice and Dice in this build (it is an Assassination talent) a
three-point cast runs 15 seconds rather than 21.75, so four seconds clipped is a
QUARTER of the buff. The point threshold is not a lever either: two points
measures 580.0–583.7 and five measures 583.6, both worse than the owner's three.

---

## A TEST WAS PINNING THE STALE LIMITATION, AND THAT IS WHY IT SURVIVED

`rogueAbilities.test.ts` had a test named *"says on the results page what it
cannot do"* asserting Adrenaline Rush was listed under "cast but not simulated",
with a comment repeating the false claim that the engine has no multiplier. **A
test named for what the page SAYS was quietly enforcing that the page keep saying
something untrue**, and fixing the ability is what finally failed it. It asserts
Blade Flurry's caveat — which is real — and that Adrenaline Rush is *absent* now.

---

## AMBUSH HAD THREE TALENTS POINTING AT IT AND ALL THREE WERE SWITCHED OFF

**Rupture 455.0 → 488.5, +33.5**, and the census went from 14 ruled out to 12.

**ONE FALSE PREMISE, SHARED BY THREE TALENTS.** Improved Ambush (45% crit),
Initiative (a second combo point at 3/3) and Opportunity's Ambush clause (+10%
damage) each carried an `unmodelled` entry reading *"Ambush requires stealth and
is absent"*. Ambush has been declared since the owner ruled that **Cutthroat's
proc IS its stealth requirement** — it was in the book, in this list and dealing
1.6% of the profile's damage while three talents aimed at it reported themselves
out of scope. All three are 6 of the profile's 51 points.

### The `scope` tag is why nobody looked again

This is the failure mode worth carrying out of here, and it is a GOOD mechanism
being misapplied. A `scope` tag means "the owner has ruled this out", so the
effect is deliberately kept off the live-gap list and shown separately in the
Talent panel — the whole point being that a ruled-out effect is not a work queue
item. **Tagging a LIVE effect `stealth` therefore removed it from the only list
anybody re-reads.** An ordinary `unmodelled` reason would have been counted as a
gap and re-read when the blocker cleared.

**When a ruling widens what is modelled, the scope tags are the first place to
look** — and the last place a reader expects to have to.

### What each was worth, isolated

60 batches of 10 each, knocked out one at a time against the finished list.

| | |
| --- | --- |
| Improved Ambush, 45% crit on Ambush | **+14.0** |
| Opportunity's Ambush clause, +10% damage | **+4.8** |
| Initiative, the second combo point | **+1.4**, inside the interval |

**INITIATIVE IS THE ODD ONE AND THE REASON IS THE LIST, NOT THE TALENT.** At 3/3
it is 100%, so every Ambush is worth two combo points rather than one — and this
build's only damage finishers are Rupture at exactly five points and an Eviscerate
that fires zero times. Extra points arrive into a list with nowhere to put them.
**A correct talent can be worth nothing because of where the points go**, which
is a rotation finding wearing a talent's clothes: the figure would move if the
Eviscerate floors were revisited.

---

## VANISH, AND STEALTH THAT IS A GATE RATHER THAN A SYSTEM

**Ambush went from 0.4 casts a fight to 2.8**, and from 1.6% of the profile's
damage to **12.4%**.

**THE OWNER'S RULING IS WHAT MAKES THIS SMALL:** *"It's a stealth ability, but we
don't need stealth to properly function — it just needs to enable Ambush."* So
there is still no stealth system. `STEALTH` is an aura Ambush reads in `canCast`,
exactly the shape Cutthroat already had, and the two are alternatives rather than
a new requirement.

**TWO ROUTES, ONE AURA.** The Rogue carries it from `openingAuras` at the pull —
the owner's "you start from stealth" — and Vanish applies the same definition
mid-fight. One code path, so the opener and a Vanish window cannot drift apart.
It is on the CLASS rather than a profile, because opening stealthed is a fact
about a Rogue; the Venom and Combat lists have no Ambush entry, so both are
unchanged to the decimal and the containment run says so.

**CUTTHROAT IS SPENT FIRST WHEN BOTH ARE UP.** A real decision: Cutthroat comes
off a Backstab proc several times a fight and a stealth window comes off a
five-minute cooldown, so spending the renewable one first keeps the scarce one.

### Vanish's numbers, and the one that is not stated

Read from `forever-rogue-spellbook.json` at rank 2, which is max: `Instant`,
`5 min cooldown`, `Reagents: Flash Powder` — so **no energy cost**, because a
consumable is not a resource this engine tracks.

**FIVE MINUTES IS LONGER THAN EVERY FIGHT HERE**, which is what makes PREPARATION
the second half of the cycle rather than a tidy-up: it finishes the cooldown on
every other Rogue ability and therefore on Vanish. The measurement shows **1.7
Vanishes a fight** — one, a Preparation, and a second — which is the owner's
design arriving exactly as specified.

**THE DURATION OF PLAIN STEALTH IS NOT IN ANY SOURCE.** Only Vanish states one
("improved stealth mode for 10 sec"), and the opener reuses it rather than being
given an invented number or an unbounded one. **The choice is not load-bearing**:
the list spends the opening window inside the first two global cooldowns, so ten
seconds and forever behave identically. `STEALTH_DURATION_MS` is the single place
to change it if the owner states a figure.

**IT TAKES A GLOBAL COOLDOWN, which is the engine's default and not a stated
fact.** Nothing in the source says otherwise, so the default stands rather than a
guess being written down as data.

---

## THE RUPTURE LIST NOW CARRIES THE OWNER'S FOUR SEQUENCES IN THREE ENTRIES

```
Opener:                                    Stealth, Premeditation, Ambush
When <= 3 combo points:                    Vanish, Ambush
When Vanish + Premed on CD and CP <= 1:    Preparation
When Prep is on CD and the others are not: Vanish, Premeditation, Ambush
```

**A PRIORITY LIST HAS NO SEQUENCES**, so these collapse. The list is re-read from
the top every global cooldown and the first castable entry wins, which means a
sequence is what EMERGES when each step is in turn the highest castable entry.
Premeditation, Ambush and Vanish at the top produce all four — **including the
last, which needs no entry at all**: once Preparation has reset their cooldowns,
the same three are castable again and the list walks them. The opener's "Stealth"
is not an entry either, because it is the aura the fight starts with.

**AMBUSH'S ENTRY IS UNCONDITIONAL NOW**, because its own `canCast` is the gate —
a dagger and either aura. It used to restate half that rule as
`selfActive('cutthroat')`, which was harmless with one route and would have been
wrong with two. It is not a floor under the list despite being ungated, because
`checkCast` refuses it whenever neither aura is up.

### CUTTHROAT WORKS, AND ITS WINDOWS WERE EXPIRING ANYWAY

**Ambush 2.74 → 3.5 casts a fight, and Rupture 488.5 → 493.8.** Two questions
were asked and the answer to both was no — and measuring them found the real
loss, which was neither.

**Cutthroat is not broken.** 207 windows over 300 fights and 30 of them end in an
Ambush, so the aura-as-gate mechanism does fire. **And the list was not spending a
Vanish during a Cutthroat proc** — zero occurrences in 300 fights, and zero
Ambushes cast with both auras up.

**177 of the 207 windows expired unspent, and the cause is energy.**

| | |
| --- | --- |
| mean energy when a window OPENED | **0.2** |
| mean PEAK energy during the ten seconds | 45.2 |
| windows that ever reached Ambush's 60 | **30 of 207** |

**CUTTHROAT PROCS OFF BACKSTAB, WHICH COSTS THE SAME 60 ENERGY**, so the proc
always lands on an empty pool. Ten seconds is 100 energy of regeneration — and
inside those 177 windows the list cast **156 Hemorrhages, 78 Ruptures, 62 Slice
and Dices and 47 Backstabs**, spending the regeneration before any of it could be
banked. The window was not too short.

### The floor rule, upside down

Ambush is **second** in this list and was still unreachable. **Priority does not
reserve a resource**: an entry is checked, refused for cost, and the list walks
past it to something affordable. So a CHEAP entry starves an expensive one from
beneath however high the expensive one sits — which is the same mechanism that
makes an ungated cheap ability a floor, seen from the other side.

**So the fix is a condition on the cheap entries, not a reorder.** Hemorrhage and
Backstab both hold while a Cutthroat window is open and the pool is short of 60.

| | DPS (150 batches of 10) | |
| --- | --- | --- |
| before | 489.1 ± 2.1 | |
| **hold Hemorrhage + Backstab** | **493.6 ± 2.1** | **+4.5, shipped** |
| hold everything below Ambush | 490.8 ± 3.2 | worse — see below |

**HOLDING MORE MEASURES WORSE.** Gating Slice and Dice and Rupture the same way
reads 490.8: they are maintenance, and dropping a Rupture to buy an Ambush gives
back more than it takes.

**IT ONLY POOLS FOR CUTTHROAT, NOT FOR A STEALTH WINDOW.** Stealth is already
spent every single time — 2.64 opened, 2.64 spent, none expired — because Vanish
carries its own energy gate and never opens a window it cannot use. A condition
for a case that does not arise is still a decision somebody has to read.

**AND VANISH NOW REFUSES WHILE CUTTHROAT IS UP**, which is the owner's
instruction and measures exactly nothing: 493.0 either way. It ships because the
reason it cannot happen today is an **ordering rather than a rule** — Ambush is
above Vanish so it wins whenever affordable, and when it is not affordable
Vanish's own energy gate refuses too, because the two share a cost. Both of those
are accidents a later edit could move.

**+4.5 IS BELOW WHAT THE 30-BATCH HARNESS CAN REPORT**, which is why the test
asserts the CONDITION on the real list entries rather than a DPS delta. The
containment run calls it noise; 150 batches separate it.

### Three refinements measured, one shipped

60 batches of 10 each, against 482.8 for the list as first written.

| | DPS | |
| --- | --- | --- |
| **Vanish also gated on 60 energy** | **488.5 ± 2.9** | **+5.7, shipped** |
| Ambush above Premeditation | 484.9 ± 2.9 | +2.1, inside |
| Premeditation gated at ≤3 points | 482.8 ± 3.4 | **+0.0 exactly** |
| Preparation ungated and last, as it was | 481.6 ± 3.3 | −1.2, inside |

**THE ENERGY GATE IS THE ONLY ONE THAT MEASURED.** Ambush costs 60 of a 100
pool; spending a global cooldown on Vanish and then finding Ambush unaffordable
does not usually lose the window, it makes the stealth Ambush arrive several
global cooldowns late, behind the builders that refilled the pool it was waiting
on. Gating Vanish rather than Ambush is deliberate — a free Cutthroat proc should
be spent whatever the pool looks like, and a five-minute cooldown should not.

**THE PREMEDITATION POINT GATE MEASURES EXACTLY NOTHING AND IS NOT SHIPPED**,
which is worth recording because the arithmetic looks compelling: it grants two
points, so a pool at four throws one away. The reason it buys nothing is the
COOLDOWN — at two minutes it fires at the pull and once more after Preparation,
and the pool is low at both. **A guard against a case that cannot arise is still
a decision somebody has to read**, so the owner's simpler entry stands.

**PREPARATION'S NEW PLACE AND GATE ARE THE OWNER'S AND MEASURE FLAT**, and both
halves of that sentence are the note. It fires 1.0 times a fight either way; what
the gate changes is WHEN, which a sixty-second fight is too short to reward. The
old comment arguing for "last, below every builder" was sound while the only
things Preparation reset were cooldowns the list never waited on — Vanish is what
changes what it is for.

---

## THE THREE FINISHERS SHARE 21.5 COMBO POINTS, AND TWO OF THEM WERE MISPRICED

**493.8 → 497.6**, +4.5 at 150 batches of 10. Two changes, and they are not
independent.

### The economy first, because it decides what was available

| | |
| --- | --- |
| combo points gained a fight | 21.50 |
| spent | 19.70 |
| **wasted at the cap** | **0.54** |
| energy gained / spent / wasted | 717.9 / 693.9 / 10.5 |

**THE POOL WAS NOT THE CONSTRAINT**, which is what made this a pricing question
rather than a waste question — 0.54 points lost to the cap all fight. The two
maintenance effects took 9.85 points each and Eviscerate took none. What *was*
wrong is that **Rupture's debuff was up only 43.7% of the fight**.

### Rupture spends four points now, not five: +3.0

**Its damage AND its duration per combo point both fall as the pool fills**, which
is the opposite of what "hold for five" assumes:

| points | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| damage per point | 159 | 111 | 98 | 94 | 94 |
| seconds per point | 8.0 | 5.0 | 4.0 | 3.5 | 3.2 |

The fifth point buys **92 damage and two seconds**. With 21.5 points gained and
19.7 spent, the binding constraint is *time to threshold*, not points available —
so waiting for a fifth point costs uptime on a bleed that was already down more
than half the fight. Rupture goes from 2.0 casts to 2.3, and 6.6% of damage to 8.5%.

**The whole grid, 60 batches of 10 a cell:**

| | Rupt ≥3 | Rupt ≥4 | Rupt =5 |
| --- | --- | --- | --- |
| **SnD ≥2** | 494.8 | 495.2 | 492.3 |
| **SnD ≥3** | 494.4 | **495.7** | 493.0 *(was shipped)* |
| **SnD ≥4** | 489.6 | 493.7 | 494.1 |
| **SnD ≥5** | 477.4 | 476.7 | 489.2 |

**SLICE AND DICE'S OWN THRESHOLD IS NOT A LEVER** between two and four, and
holding it to five costs 4 to 18 — the same answer the Combat list gave
independently. Its duration table is *proportional*, a flat three seconds a point,
so there is no per-point argument either way and what decides it is uptime. **The
owner's three stands.**

**AND RUPTURE MUST STAY BELOW SLICE AND DICE.** Swapping the two entries measures
**487.2, a loss of 8.5**: the haste is on every auto-attack and the autos are half
this profile's damage. The original ordering was right; this is the record that it
was checked rather than inherited.

### Eviscerate's two duration floors are gone: +1.5 on top

**The second list those floors have suppressed, in the same file.** "Spend five
points only while Slice and Dice AND Rupture both have ten seconds left" held it
to **zero casts a fight** for this list's whole life — and CLAUDE.md already
records the same pair costing the Venom list 20 DPS. A finisher with nothing left
to spend reads identically to a suppressed one, which is why this came out of the
`USES=1` column rather than from suspecting it.

**The two halves are not independent.** With Rupture still hoarding the fifth
point, dropping the floors is worth +0.6 and *nothing fires*. With Rupture at four
it is worth +1.5 and Eviscerate fires 0.2 times a fight for 1.2% of damage. The
floors were not the only thing stopping it.

**It still holds for five, which is the reverse of the Combat list's answer**, and
the reason is the bleed: a point taken by Eviscerate is a point Rupture needed.

| Eviscerate at | 5 | ≥4 | ≥3 | ≥2 |
| --- | --- | --- | --- | --- |
| DPS | **498.1** | 497.7 | 489.3 | 479.2 |

The top two are inside each other's intervals, so the higher gate ships: it keeps
Eviscerate an **overflow valve** for points the other two could not use, rather
than a competitor for them. **Do not normalise this threshold against Combat's
two** — the sweep is a fact about the list, not about the ability.

### One methodology note, because it nearly produced a false finding

The first version of this sweep edited the **Venom** list. The Slice and Dice
entry is textually identical in all three Rogue lists, so a `replace(old, new, 1)`
hit the first one while the Rupture profile was being measured — and the Slice and
Dice axis came back **identical to the decimal across all four thresholds**. That
is indistinguishable from "this threshold does not matter", and the conclusion was
there to be believed. Every edit is scoped by slicing the file at the list's own
`export const` now, with an assertion that the entry appears once inside it.

---

## HEMO — A FOURTH PROFILE, AND THE FILLER IS THE WHOLE OF IT

**527.1 DPS**, which makes it the second strongest Rogue behind Combat's 586.3 and
the strongest Subtlety build by 30. From the owner's own talent URL, decoded to 51
points: **17 / 3 / 31**.

### It is the Rupture build with the Backstab engine removed

Ten talents differ and three of them are the point:

| | |
| --- | --- |
| `cutthroat` 5 → 0 | Backstab's proc, and the Rupture list's only **in-combat** route to Ambush |
| `puncturing_wounds` 3 → 0 | Backstab's extra combo point and its crit |
| `ghostly_strike` 1 → 0 | so the ability is absent from the book entirely |

The rest is five points moving from Combat into Assassination: Lethality 2 → 5,
Ruthlessness 2 → 3, Relentless Strikes 1, **Quietus 5** and Dirty Deeds 2 arriving,
Lightning Reflexes 2 going.

**SO REMOVING BACKSTAB FROM THE LIST IS NOT A ROTATION PREFERENCE — IT FOLLOWS THE
TREE.** With Cutthroat and Puncturing Wounds gone, Backstab is a 60-energy strike
with nothing attached, against Hemorrhage at 35 that also maintains a debuff. The
owner's instruction to drop the entry removes the entry the talents stopped paying
for.

**AND AMBUSH BECOMES STEALTH-ONLY HERE**, with one route to its gate (the pull and
Vanish) where the Rupture list has two. The energy-pooling condition on Hemorrhage
reads the Cutthroat aura and therefore never holds in this build — correct rather
than inert: there is no Cutthroat window to pool for, and Vanish is already gated on
being able to afford the Ambush that follows it.

**QUIETUS'S FIVE POINTS HAVE ONE LIVE CLAUSE**, which is the right one: it names
Sinister Strike, Ghostly Strike and Hemorrhage, and this build takes neither of the
first two in its tree or its list. Hemorrhage is this profile's maintenance strike
and its filler. **Dirty Deeds' two points do nothing and that is a RULING**, not a
gap — both its abilities are stealth openers ruled out for good.

### The specification as given threw away a third of its energy

**416.9 DPS, and 272.7 energy a fight wasted at the cap.** Removing Backstab removed
the list's only **ungated** builder, and nothing above it is castable on demand:
Premeditation and Vanish are on minute cooldowns, Ambush needs a stealth window, and
the three finishers need combo points the list then had no way to earn.

| | DPS | Slice and Dice | Rupture debuff | energy wasted |
| --- | --- | --- | --- | --- |
| Backstab out, nothing added | 416.9 | 69.9% | 25.3% | **272.7** |
| **Hemorrhage ungated** *(shipped)* | **527.1** | — | — | — |

**THE GATE'S OWN JUSTIFICATION WENT WITH BACKSTAB**, which is why ungating
Hemorrhage is following the owner's design rather than second-guessing it. The
Rupture list's note reads *"gated on its own debuff having a second left, it
**maintains** and Backstab **builds**"* — the gate was correct because something
else was doing the building, and it made Hemorrhage a floor that starved Ghostly
Strike and Sinister Strike beneath it. **Here there is nothing beneath it**, so the
floor costs nothing and the building has to come from somewhere. Hemorrhage goes
from 4.6 casts a fight to **17.4**, and 21.0% of the profile's damage.

**A 45-ENERGY FILLER IS STRICTLY WORSE, and the proof is a row that moves nothing:**

| | DPS |
| --- | --- |
| as specified | 416.9 ± 2.8 |
| **Hemorrhage ungated** | **525.8 ± 3.7** |
| Sinister Strike at the bottom | 483.8 ± 3.5 |
| **both of the above** | **525.8 ± 3.7** — identical, to the decimal |
| *(reference)* Backstab left in | 506.9 ± 3.3 |

**The "both" row is the floor rule confirming itself.** Sinister Strike at 45 energy
below an ungated Hemorrhage at 35 can never be the first castable entry, so adding
it changes nothing at all — the same arithmetic that made Hemorrhage a problem in
the Rupture list, pointing the other way. And ungating it beats **leaving Backstab
in** by 19, so the owner is right about this tree twice over.

### The list is DERIVED from `ROGUE_RUPTURE`, not transcribed

`ROGUE_HEMO` is `ROGUE_RUPTURE` with Backstab filtered out and Hemorrhage moved to
the bottom ungated. **Two near-identical lists maintained by hand drift, and the
drift is invisible** — an entry is four lines and a difference between two similar
lists reads as deliberate. Anything measured into the Rupture list from here reaches
this one for free, which is what the owner's "exactly the same except" asks for. A
test compares the ORDER of every shared entry, so an insertion in the wrong place
fails rather than being absorbed.

**ITS EVISCERATE INHERITS THE FIVE-POINT GATE AND FIRES ZERO TIMES, AND THAT WAS
MEASURED RATHER THAN ASSUMED** — the combo economy here is a different one, since
Hemorrhage earns a point every 35 energy where the Rupture list's filler cost 60. The
Rupture sweep's answer still holds:

| Eviscerate at | 5 *(inherited)* | ≥4 | ≥3 | ≥2 | removed |
| --- | --- | --- | --- | --- | --- |
| DPS | **525.8** | 525.5 | 513.9 | 498.3 | 523.5 |

Removing the entry measures *lower* and inside the interval, so it stays: the
derivation is left clean, and it is a live entry the moment the economy shifts.

### Which list a Subtlety Rogue runs

**Hemorrhage no longer separates the two Subtlety builds** — both take it, because
both are built around it. **Cutthroat is the discriminator**, and it is a functional
one rather than an arbitrary tiebreak: a Hemorrhage build without Cutthroat cannot
run the Rupture list's Backstab engine at all, so the talent that decides which list
*works* is the talent the dispatch reads. Reading Quietus would work today and is
weaker — it is a damage talent that says nothing about which list can function.

---

## SEAL FATE IS CAPPED PER ABILITY USE, SO MUTILATE TOPS OUT AT THREE

**Venom 600.8 → 594.5, −6.3.** The other twenty-four profiles are identical to
the decimal — Venom is the only one that holds both Mutilate and Seal Fate.

**THE OWNER'S RULING:** *"The Mutilate ability has been updated. With Seal Fate it
can now NO LONGER give 4 combo points. If either hand crits, Mutilate gives 3."*

So the opportunity belongs to the **use** rather than to the hit. Two of
Mutilate's own plus at most one, whether one hand crits or both.

### The mechanism, because −6.3 is inside the interval

The DPS figure is borderline at ±5.7, so what settles it is the combo point
ledger, over 400 fights:

| | before | after |
| --- | --- | --- |
| points from Seal Fate | 10.65 | **8.00** |
| points gained | 35.08 | 33.17 |
| wasted at the cap | 2.63 | 1.92 |
| spent | 32.83 | 30.79 |

**2.65 fewer Seal Fate points a fight**, which is the double-crit second trigger
and nothing else. The arithmetic checks: the suppressed amount is
`casts × crit²` where the old total was `casts × 2 × crit`, so the ratio says
Mutilate crits about half the time on this build — which is what Malice, Lethality
and Puncturing Wounds' Mutilate clause add up to.

### Why it keys on a cast counter

A `dealt` reaction fires **per damage event**, and Mutilate deals two — so a rule
phrased per USE had nothing to key on. `Combatant.castSequence` is the new engine
fact: `recordCast` stamps every cast, and Seal Fate's own closure remembers the
number it last fired on.

**Mutilate's own award already worked this way** — its comment reads "two points
for the ability, not one per hand, and a half-avoided Mutilate is still a
Mutilate" — so the cap is that same reading applied to the proc rather than a new
convention being invented beside it.

**NOT THE TIMESTAMP**, which is the tempting discriminator: the two hits share a
millisecond only because they are dealt synchronously inside one `onCast`, and
nothing guarantees that. **NOT A BOOLEAN LATCH** either, because something would
have to clear it — and a latch nobody cleared would make Seal Fate fire once a
*fight*, which is a smaller number and no error.

**THE CLOSURE IS ONLY SAFE BECAUSE A REACTION IS BUILT PER CHARACTER.**
`talentBuild` calls the builder once per combatant, which is the same reason
Windfury's internal cooldown can live in one; a module-level variable would make
one Rogue's Mutilate suppress another's, silently, and only from the second
character in a batch onwards. That was checked rather than assumed — two rogues
built side by side hold different reaction objects and both get their point.

### The reading that was chosen, and where it could be wrong

**The OPPORTUNITY is capped and the roll happens once.** The other reading — roll
per crit and cap the AWARD at one — is **indistinguishable at 5/5**, where the
chance is 100% and every build in the project sits. They diverge only at ranks 1
to 4: a double-critting Mutilate would be `1 − (1 − p)²` rather than `p`, so 84%
instead of 60% at rank 3.

*"If EITHER hand crits, Mutilate gives 3"* reads as one question asked of the use
rather than two asked of the hits, so that is what shipped. It is one comparison
in `sealFate` if the owner states otherwise.

### What the test file had to become

`sealFateFirstCast.test.ts` asserted **four** in three places. Its original
subject — a builder's own points must not wipe the one Seal Fate just banked — is
untouched and still load-bearing, so those cases stay at three rather than being
deleted. What is new is the pair that the cap actually needs: **one hand critting
and both hands critting give the same three**, because asserting only the double
crit would pass against a rule that awarded per crit and capped the total
somewhere else. The off-hand case is asserted separately since it resolves
*second* — that is the one that fails if the latch is keyed on the hand.

**Two of those tests failed on their own premises first**, which is worth
recording: one named DW Fury as a character with no cast reactions and it has one,
and one was refused by the **global cooldown** rather than by the latch — both
casts happen at time 0. A test that fails for a reason that is not its subject
reads exactly like the code being wrong.

---

## Two reasons that had expired, both printed while false

**THIS IS THE FAILURE MODE THE PROJECT KEEPS MEETING, and both instances here
had the disproving code in the same file.**

- **Rupture** declared `'Its "increased by your Attack Power" clause does NOT
  [land]: the source gives no coefficient'`. `RUPTURE_TICK_AP_COEFFICIENT` is
  applied four lines above the claim, and has been since the owner's sheet
  arrived. The ability was fully scaling while telling the results page it
  could not.
- **Hemorrhage** declared its Rupture clause had no form. True when written;
  `abilityDamageTaken` is the form, and the constant is deleted rather than
  reworded.
- **Mutilate's "+20% against Poisoned targets"** expired the other way, without
  anybody touching Mutilate: it read "poisons are not implemented" and the
  poison system landed a release earlier. **A reason can expire because
  something ELSE was built.**

`armorPenetration.test.ts` matches the SENTENCES rather than the ids, across all
nine classes — because the Rogue's own reason said "the same gap as the Warrior
Weaponmaster mace clause", and a test scoped to one class would have let the
Warrior's copy of the claim outlive the thing that cleared it.

---

## What is left, and it is short

1. **`riposte` and `setup`** want a Rogue profile whose target attacks back.
   An owner decision about the profiles, not a modelling one.
2. **`remorseless_attacks`** needs a kill. Permanent for this encounter shape.
3. **Rupture's 1.3 applications a fight.** The owner has said it is too low and
   this dive did not touch any priority list. Its entry is gated on
   `rupture down` AND `exactly 5 combo points`, and the same `>= 10s` floor
   idea suppresses Eviscerate in the same list to zero casts — **which the owner
   has separately ruled fine**. Measure variants; do not reason about them.
4. **`lethality`'s Gouge share** and **`opportunity`'s Garrote and Ambush
   shares** are scoped out, not pending.
5. **Talent VALUES have never been cross-checked** for any class. The Rogue's
   ABILITY numbers were, at build 1.60.1.70009, and two moved — Backstab
   225 → 150 and Mutilate 38 → 50. `values/rogue.json` rests on
   `talentsforever.com` alone.

**`quietus` IS BUILT AND NO PROFILE TAKES IT**, which is why it was the safe
place to build the clock mechanism. **The Priest's Early Demise is the second
caller and is deliberately NOT wired** — the mechanism is there and it is one
entry, held back because it moves a Priest figure and belongs with that class's
own re-measured baseline. Its reason has been left pointing at the mechanism
rather than at the gap.

---

## Traps specific to this class

- **A POISON IS NOT A WEAPON USE, BUT IS TRIGGERED BY ONE** — the owner's ruling.
  `isWeaponUseOf(attack, slot)` fires it, and **the poison hit carries no
  `weaponSlot`**, so it cannot proc a second poison, a Crusader or Hand of
  Justice. Getting that backwards does not look wrong: poisons chaining off
  poisons is a bigger number and no error.
- **AND "POISONED" IS THE DEADLY POISON DEBUFF, NOT ANY POISON.** Instant Poison
  deals its damage and leaves nothing behind, so it never makes a target
  Poisoned in the sense Mutilate's tooltip means. That is correct rather than a
  shortfall, and it is why the +20% rides on the debuff's own aura.
- **A POISON'S CHANCE IS FLAT PER STRIKE, NOT PROCS PER MINUTE**, which is the
  opposite of every weapon enchant here. A fast off hand really does poison more
  often. PPM exists to stop exactly that, and the two live side by side.
- **A PERIODIC TICK RUNS NO REACTIONS.** `dealDamage` excludes them on purpose —
  a bleed ticking is not an attack anybody parries — so Thousand Cuts could not
  be a proc and had to be an aura the Rupture tick APPLIES. Its old reason said
  "the tick is reachable", and that was the half that was wrong.
- **A TALENT VALUE TRAVELS TO AN AURA AS AN `abilityBonus`.** An aura definition
  cannot read an allocation, so Rupture's `onCast` reads the named bonus and
  hands it down — the same hook Improved Slice and Dice uses for its duration.
- **COMBO POINTS BELONG TO A TARGET.** `comboPointTargetId` records whose they
  are. **Anything banking points by writing the pool must set the target too**,
  or every finisher refuses to spend and reads as an ability that lost its flat
  damage. Puncturing Wounds' proc goes through `awardComboPoint` for that reason.
- **A finisher spends its points inside its own `onCast`**, where neither the
  cost system nor a damage reaction can see it. `AbilityCastEvent` carries what
  the cast SPENT, measured by snapshotting every pool around it.
- **Energy ticks twenty times a second**, not ten, and **the GCD is 1.0 for a
  Rogue**, arriving as `baseGcdMs`.
- **AN UNCONDITIONAL ENTRY IS A FLOOR UNDER EVERYTHING BELOW IT.** The Rupture
  list's original Hemorrhage was 35 energy and ungated with Ghostly Strike at 40
  and Sinister Strike at 45 beneath it — nothing below an ungated cheaper
  ability can ever be the first castable entry, so a six-entry list was really
  three.
- **AND THE COST THAT DECIDES IT IS THE BUILT ONE.** Thousand Cuts now takes
  Hemorrhage and Backstab down by up to 15 energy inside its window, so the
  Rupture list's ordering is answering a different question at a Rupture tick
  than it is between them. Read costs off the character
  `characterAtCombatStart` builds.
- **`legalise` TAKES A CLASS NOW**, and did not. A Rogue test asking for a
  31-point Subtlety capstone on its own got a character WITHOUT it, silently,
  and read the result as "the talent is worth nothing". That caught four tests
  in this dive.

---

## Never-fired entries

| Entry | Profile | Why |
| --- | --- | --- |
| `eviscerate` | Rupture | the gate's two aura-duration floors never coincide with five combo points. **Ruled fine by the owner: "zero is fine"** |

**Do not "fix" that gate.** The measurement is recorded: dropping the two
duration floors from the *Venom* entry took that list from 392.7 to 413.1 on the
pre-dive baseline, which means the whole −24.3 the Venom list measured is those
floors, not the Venom entry (worth +17.7 there).

## THE VENOM LIST'S COMBO POINTS WERE OVERFLOWING, AND RUPTURE WAS THE SINK

**488.1 to 504.8, +16.7**, by casting an ability that was already in the build's
book and in no list. The other twenty-two profiles were identical to the decimal.

> **EVERY FIGURE IN THIS SECTION WAS MEASURED ON A FORMULA THAT HAS SINCE BEEN
> REVERTED.** An ability's flat damage sat INSIDE its weapon percentage while this
> sweep ran, which changes Mutilate — 75% weapon damage plus 50 — and therefore
> every number below. The shipped list now measures **510.6**.
>
> **THE RANKINGS ARE WHAT A SWEEP BUYS, AND THEY SURVIVE.** Mutilate's COMBO POINT
> generation is untouched by the formula, and that is what every decision here
> turns on: the pool overflowing, Rupture absorbing it, the threshold grid being
> flat. The absolute numbers are stale and the orderings are not. Re-running the
> sixteen-cell grid to refresh cells that were indistinguishable from each other
> would buy nothing — **but do not quote a cell below as a current figure.**

**SEAL FATE IS 100% AT 5/5 AND MUTILATE CRITS TWICE**, so one double-critting
cast is FOUR combo points -- two of its own and two from Seal Fate. The build
gained about 28.5 a fight and wasted 7.21 of them at the cap, because the only
damage finisher it could reach was gated on three conditions at once.

**MINIMISING THE WASTE IS NOT THE SAME AS MAXIMISING THE DAMAGE**, which is the
finding worth carrying. The lowest-waste list measured is not the strongest one:

| | DPS | combo points wasted |
| --- | --- | --- |
| before | 488.1 | 7.21 |
| Rupture BELOW Venom | 500.2 | 2.45 |
| **Rupture ABOVE Venom (shipped)** | **504.8** | **2.02** |
| Rupture, no Venom entry | 507.4 | 6.11 |

The last row wastes three times what the shipped one does and measures 2.6
higher -- inside both intervals, so not a difference this method can call.
Venom-the-finisher absorbs points tidily and produces no damage of its own, so
tidiness is not the thing to optimise.

**THE THRESHOLDS ARE NOT A LEVER, AND THE WHOLE GRID WAS MEASURED TO SAY SO.**
Slice and Dice at 2/3/4/5 against Venom at 2/3/4/5 -- sixteen lists, 30 batches
of 10 each:

| | Venom ≥2 | ≥3 | ≥4 | ≥5 |
| --- | --- | --- | --- | --- |
| **SnD ≥2** | 504.8 | 504.5 | 504.6 | 505.4 |
| **SnD ≥3** | 504.2 | 505.2 | **504.8** *(shipped)* | 504.0 |
| **SnD ≥4** | 503.2 | 505.2 | 505.1 | 504.6 |
| **SnD ≥5** | 491.4 | 489.4 | 493.1 | 498.4 |

**Twelve of the sixteen are one list.** The top three rows span 503.2 to 505.4,
a range of 2.2 against intervals of ±4 to 5, and the best cell beats the shipped
one by 0.6. **The one real edge is holding Slice and Dice to five**, which costs
8 to 15 — it is a MAINTENANCE buff, so uptime beats duration: a three-point cast
already runs 21.75 seconds with Improved Slice and Dice, and waiting for five
leaves the 30% attack speed DOWN while the pool refills. **The owner's original
numbers stay**, because a measurement that cannot separate twelve lists is not
an argument for changing any of them.

**AND IT KILLED THE EVISCERATE ENTRY, WHICH WAS ALREADY DOING NOTHING.** It fired
0.3 times a fight for 0.9% of damage before and 0.0 times after, because its gate
wants Slice and Dice above ten seconds AND the Venom buff above ten seconds AND
exactly five points -- and Rupture now takes the pool at four. Removed rather
than left dead, on the owner's call: an entry that cannot fire produces an
ordinary figure and an ordinary results page, which is exactly why `USES=1`
exists. **The owner's instruction for the pass was explicitly not to reach a
higher figure by casting Eviscerate more**, and the points it would have spent
go to Rupture instead.

**AND THE BOOKS THAT LOOKED UNBALANCED WERE A READER BUG, NOT AN ENGINE ONE.**
The report read 28.50 gained, 7.21 wasted and 25.89 spent, which is 4.6 more
spent than appeared to arrive. `grantResource` emits `amount: gained` -- what the
pool ACTUALLY TOOK -- with `wasted` beside it as a separate quantity, so the two
do not overlap and the Results panel's `gained - wasted - spent` subtracted the
overflow twice. It went negative and a `Math.max(0, ...)` clamped it away.

Replaying one fight settles it: 31 gained, 3 wasted, 30 spent, 1 left in the
pool, and 30 + 1 = 31. Every event's own `current` agrees with the pool at every
step. **The identity is `gained = spent + what is left`**, and it is asserted now
rather than recomputed -- a test that recomputed `gained - spent` would pass
against any definition of `gained`, which is the assumption that broke.

**It also means the gap this rework started from was the wrong number.** The
gained-against-used difference is points still IN THE POOL at the end, not points
lost; the real loss was the larger figure in the column beside it, 7.21 wasted at
the cap, and that is what Rupture took to 2.02.

## In the book, in no list, never cast

`sinister_strike`, `backstab`, `expose_armor`, `ambush`, `ghostly_strike` —
varying by profile. **`rupture` left this list** when the Venom rework put it in
one; the Combat build still carries it uncast.

- `ambush` is castable only on a Cutthroat proc, which only the Rupture build
  takes, so the other two carry an Ambush they can never use. That is the
  honest state of the ability rather than a gap.
- `expose_armor` and `ghostly_strike` are simply not in the owner's lists.
- ~~**VENOM IS IN NO LIST DELIBERATELY**~~ **It is in one, and it survived a
  second challenge.** The owner put it back; the rework then measured the list
  without it at 507.4 against 504.8 with it, which is inside both intervals --
  so the entry stays. **A measurement that cannot separate two lists is not an
  argument for deleting one of them**, and that is the rule this entry now
  rests on rather than on the older "+30% to poisons loses to Eviscerate",
  which was true of a list where Eviscerate still fired.
