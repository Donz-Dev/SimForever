# OPTIMISING THE 25 LISTS, ONE PROFILE AT A TIME

**THE TOOLING FIRST, THEN THE LISTS**, which is the order it has to happen in
and is the owner's own framing -- "in order to actually optimize the APL I need
the tooling to be a bit more sophisticated as well."

| | what it was | the profile | mean |
| --- | --- | --- | --- |
| 1 | three APL tooling asks -- **duplicate**, **retarget**, and a **timeline** | **no figure moved**; all 25 rows reproduced the published table to the decimal | 752.7 |
| 1 | **2H Arms** food: +40 Attack Power -> +20 Strength | 825.0 -> 825.9 (**+0.9**) | 752.7 |
| 1 | **2H Arms** list, respecified by the owner | 825.9 -> **849.7** (**+23.8 REAL**) | **753.7** |
| 2 | **DW Fury** list: Death Wish eighth -> fourth | **no decision moved**; all 75 hashes and event counts identical | 753.7 |
| 2 | **DW Fury** food: +40 Attack Power -> +20 Strength | 988.5 -> **989.6** (**+1.2**) | **753.7** |
| 3 | **Prot Warr** list: four moves, the owner's order | 471.5 -> 471.1 (**-0.4**), deaths 6.17 -> 6.18 | 753.7 |
| 3 | **Prot Warr** food: +40 Attack Power -> **+20 Stamina** | **deaths 6.17 -> 5.93**, at -5.0 DPS | **753.6** |
| 4 | **Hack and Slash** is global across BOTH HANDS -- a TALENT fix, before the Rogue lists | Combat 776.2 -> **808.7** (**+32.5 REAL**) | **754.9** |
| 5 | **Venom** list, respecified: Rupture out, Eviscerate back | 684.9 -> **718.9** (**+33.5 REAL**) | 756.3 |
| 5 | **Venom** food: +40 Attack Power -> **+20 Agility** | +0.3 | **756.3** |
| 6 | **Combat** list + agility food | 808.7 -> **824.1** (**+15.3**) | 760.9 |
| 6 | **Rupture** list, TALENTS and agility food | 659.0 -> **719.4** (**+60.4 REAL**) | 760.9 |
| 6 | **Hemo**, which DERIVES from the Rupture list and was not respecified | 715.8 -> 726.2 (**+10.4**) | 760.9 |
| 6 | **Combat Mut**, a NEW profile -- Venom with two fields replaced | **790.6**, the 26th row | **760.9** |
| 7 | **Hemo Dagger** -- renamed, respecified, and NO LONGER DERIVED from Rupture | 726.2 -> **787.0** (**+60.7 REAL**) | **763.3** |
| 7 | **Pure Hemo**, a NEW profile -- the first list chosen by the WEAPON IN HAND | **723.5**, the 27th row | **761.6** |
| 8 | **Arcane Mage** -- 35/11/5, and Presence of Mind moved to make PYROBLAST instant | 857.7 -> 866.8 (**+9.1**) | 768.0 |
| 8 | **Fire Mage** -- 16/31/4, Fire Blast outside Clearcasting, Missiles on a Barrage | 753.0 -> **843.7** (**+90.7 REAL**) | 768.0 |
| 8 | **Frostfire Mage** -- list only: a SALVAGE Pyroblast, and Fire Blast above 10% mana | 837.0 -> **863.3** (**+26.3 REAL**) | 768.0 |
| 8 | **Ele Shaman** -- 32/6/13, the potion opens the list, the racials move DOWN | 651.4 -> **671.1** (**+19.7 REAL**) | 768.0 |
| 8 | **Moonkin** -- list only: the potion opens it, Starfire's Eclipse gate 2 -> 3 | 788.4 -> 785.9 (**-2.5**) | 768.0 |
| 8 | **Cat Druid** -- Frenzy Potion held for Berserk, Strength food, four list changes | 859.0 -> **892.7** (**+33.6 REAL**) | 768.0 |
| 8 | **Bear Druid** -- Stamina food, and the Mighty Rage Potion off the bottom | **deaths 10.00 -> 9.98**, at -9.6 DPS | **768.0** |
| 9 | **Seal Twist Ret** -- +150 Spell Power flask and +33 Spell Power food | 816.5 -> **876.4** (**+59.9 REAL**) | 774.2 |
| 9 | **Shockadin** -- the same pair, on the build that is 74% Holy | 714.4 -> **787.7** (**+73.3 REAL**) | 774.2 |
| 9 | **Prot Pally** -- the food, a respecified list, and SWIFT JUDGEMENT off the GCD | 400.6 -> **434.5** (**+33.9 REAL**), deaths 9.40 -> 9.37 | 774.2 |
| 9 | **LW Ranged** and **LW Melee** -- 5/39/7 and 5/13/33 | **0.0 to the decimal on both**, and correctly so | 774.2 |
| 9 | **Warlock** -- a CHOOSER for the sacrificed demon, and the 15% confirmed | **no figure moved**; 24 of 27 rows 0.0 to the decimal | **774.2** |
| 10 | **Firelock** -- 5/11/35, a new list, and an AFTERMATH INDEX THAT WAS RIGHT BY LUCK | 891.4 -> 885.5 (**-5.9**), and **26 of 27 rows 0.0** | **774.0** |
| 12 | **Shockadin** -- a fast 2H as an EXCLUSIVE alternative, both setups optimised, and A TALENT TIER RULE THAT WAS WRONG | 787.7 -> **856.0**, and the 2H at **933.2** as the 28th row | see below |
| 13 | **BM Hunter** and **LW Ranged** -- an ABILITY IN THE BOOK AND IN NO LIST, two trees with almost no freedom, and TWO CORRECTNESS FIXES BESIDE THEM | 856.2 -> **898.1** and 912.5 -> **935.3** | see below |

**ROUND 11 IS MISSING FROM THAT TABLE ON PURPOSE AND NOT BY ARITHMETIC.** It is
the tank case study -- Dire Bear Form's armor multiplier, the 75% armor cap and
the crushing-blow ruling -- and it is written up on its own branch, which had
not merged when this row was added. **Numbering this one 12 rather than taking
the next free integer** is the thing that stops two branches both calling
themselves 11, which is the clean-merge arithmetic failure CLAUDE.md documents
and which has already cost this project a profile format version.

## Round twelve: a second set of hands for the Shockadin

**THE OWNER'S ASK, IN TWO HALVES.** First "add a fast 2H to the profile ... an
alternative to the template gear, not a replacement ... the user should be able
to swap between the 2H and the 1H+Shield at will", then "optimize both setups"
-- enchants, consumables, talents and the list, with the E65 template gear held
fixed apart from the weapons.

| | was | now |
| --- | --- | --- |
| **Shockadin** (1H + shield) | 787.7 | **856.0** |
| **Shockadin 2H** (the 28th profile) | -- | **933.2** |

**THE TWO CONFIGURATIONS ARE EXCLUSIVE, AND THAT IS A RULING THAT CORRECTED THE
FIRST ATTEMPT.** It shipped with both weapons in one set, on the reasoning that
`liveEquipment` already strips whichever hands a style cannot fill -- true, the
stats were never doubled, and not what was asked for: "You cannot ever have the
stats of both active. It's one or the other ... Equipping a 2H weapon REMOVES
the 1H+shield from the character planner equipped items." **"Resolved correctly
at the point of use" and "cannot be expressed" are different guarantees**, and
the equipment MAP is what a person reads off the planner. `equipExclusive` is
that ruling where the planner enforces it, for every class and every style.

So the alternative is a second PRESET, which it had to be anyway: the two setups
want different TALENTS and a style flip cannot carry those.

**THE WEAPON IS THE OWNER'S SPECIFICATION STRAIGHT THROUGH THE GENERATOR.** It
is `speed: 2.0` on a two-hand plan and nothing else said, which gives 98-148 at
2.00 for 61.5 dps -- the same dps as Seal Twist Ret's 177-266 at 3.60, which is
what "rescaled to 2.0 swing speed with the same DPS" asks for.

**AND THE OTHER 26 PROFILES ARE BIT-IDENTICAL**, in combat-log hash AND event
count, over three seeds.

**THE LARGEST SINGLE ITEM IS A TALENT NO PROFILE TOOK**: Consecrated Ground
2/2, **+66**, because it is +10% Holy damage carried by the Consecration debuff
and this build is three-quarters Holy. Its wording says "Holy SPELLS" and the
implementation reaches the seal and Holy Strike too -- a defensible reading
while nobody took it, and **a question for the owner now that it is the biggest
talent on the profile**.

## Round thirteen: the two ranged Hunters

**THE PALADIN'S METHOD ON A CLASS WITH ALMOST NO TALENT FREEDOM**, and the
result is the opposite shape -- the Shockadin's gains were mostly talents, and
these are mostly ONE MISSING LIST ENTRY.

| | spread | was | optimised | shipped |
| --- | --- | --- | --- | --- |
| **BM Hunter** | 31/20/0 | 856.2 | 901.8 | **898.1** |
| **LW Ranged** | 5/41/5 | 912.5 | 933.2 | **935.3** |

**THE LAST TWO COLUMNS ARE NOT THE SAME ENGINE**, which is why both are shown.
"Optimised" is the talents, the list and the enchants; "shipped" is after the
two correctness fixes below -- Judgement of Wisdom no longer paying out on
self-buffs, and Improved Arcane Shot no longer shortening Summon Hawk's lockout.
Neither Hunter is mana-bound, so both land inside their own intervals, and
comparing 901.8 with 898.1 is comparing two different rulesets.

**ARCANE SHOT WAS IN BM HUNTER'S BOOK AND IN NO LIST**, dealing nothing, for the
life of the profile -- a trainer shot every Hunter owns from level 6, and
**14.6% of LW Ranged's damage**. Worth **+31**, and it is the class of bug with
no zero to find: an entry that fires zero times prints a zero and gets looked at,
where an ability with no entry has no row and the damage table still sums to
100%.

**BM HUNTER'S ENTIRE DESIGN SPACE IS TWO POINTS.** Bestial Wrath's tier 30 takes
thirty-one of the fifty-one, and Mortal Shots' tier 15 fixes thirteen more of
Marksmanship's twenty. Improved Stings got them: **+11.2** alone, **+41.7**
beside the new list entry.

**LW RANGED HAD FOUR DEAD POINTS AND THEY BOUGHT IMPROVED STINGS**, worth
**+20.8**. Survivalist, Rapid Killing and Scatter Shot each measured
**bit-identical fights** -- health on a profile nothing attacks, a cooldown
longer than the fight, and a disorient.

**AND EVERYTHING ELSE WAS ALREADY RIGHT**, which is worth recording: agility
beat haste, intellect and strength in all eight armour slots on both, and every
other move in either list measured a loss but one -- Arcane Shot above Sniper
Shot on LW Ranged, **+1.4**, which read real at 600 iterations, noise at 800 and
real at 3,000 before it was taken.

**AND TWO CORRECTNESS FIXES LANDED BESIDE THE OPTIMISATION**, both from the
owner reading the results: Improved Arcane Shot now honours its own "does not
affect the cooldown of abilities which share a cooldown" clause, and
**Judgement of Wisdom no longer pays out on self-buffs** -- which moves every
one of the nineteen profiles with a mana bar. The full write-up, including why the
stat stick's three alternative enchants all measure **-15.0 identically**, is in
[docs/handoff/hunter.md](docs/handoff/hunter.md).

## And a talent tier counts points BELOW it, which this project had wrong

**FOUND BY THE OWNER ASKING FOR THE BUILD AS A LINK SO THEY COULD AUDIT IT**, and
it is the best argument for that ask there could be: `tools/encode_talent_build.mjs`
turned the allocation into a talentsforever.com URL, the calculator refunded six
points, and said exactly why.

`requirementsMet` counted every point in the tree against a talent's tier --
including the talent's OWN ranks and its neighbours' in the same row. Two probes
against the site settle the real rule:

| | |
| --- | --- |
| 14 points below tier 15 + Divine Favor | refunded -- *"Requires 15 points in Holy -- 1 back"* |
| 15 below + Divine Favor | accepted |
| 14 below + one point in EACH of two tier-15 talents | **both** refunded, so same-tier points do not help |

**THE OLD COMMENT CITED THE CALCULATOR FOR THE WRONG RULE**, with an example that
cannot tell the two apart: "five points in row 0 open row 1" is true either way.
The case that separates them is a tree that STOPS at the tier it is spending in
-- which is what an optimiser produces and no hand-written build does.

**IT COST NOTHING HISTORICALLY AND IT COST THIS ROUND 40 DPS.** The Shockadin
trees were rebuilt legal, which is where 896.0 and 1008.2 became 856.0 and
933.2; `pointsBelowTier` is the fix, `talentLegality.test.ts` pins both probes,
and the test helper that pads an allocation to legality was padding to the loose
rule too.

**AND DIVINE FAVOR IS OFF THE GLOBAL COOLDOWN NOW**, by a ruling that arrived
after the measuring and retired a finding rather than confirming one: moving the
entry to the bottom of the list had been worth **+13.5** because once a fight it
displaced a Consecration. Off the global cooldown every position is inside
+/-2.2 of every other, so the entry went back where the owner put it -- and
removing it went from **+9.9** to **-9.7**. **A measured rotation decision is
only as settled as the mechanic under it.**

The full write-up, including the two findings that turned out to be noise, is in
[docs/handoff/paladin.md](docs/handoff/paladin.md).

**AND MORE ROWS CAN BE ADDED, WHICH IS THE POINT OF ITS BEING A TABLE** --
there are fifteen lists left and the owner has said so. **THE HEADER IS
WRITTEN FOR THE SERIES RATHER THAN FOR ITS FIRST ENTRY**, which is this file's
own rule arriving where it belongs: it read "THE APL EDITOR GROWS TEETH, AND 2H
ARMS IS RESPECIFIED" for exactly one round.

**AND THE THIRD ROUND IS THE FIRST WHOSE RIGHT-HAND COLUMN IS NOT A DPS
FIGURE**, which is the whole of what a tank round is: a Protection warrior's
figure of merit is a DEATH COUNT, and both of its changes are read there.

**THE FOURTH IS NOT A LIST AT ALL**, and that is worth a row rather than a
footnote: the owner asked for the Rogue next and named a TALENT that had to be
fixed first. **It was the largest single figure of the four rounds.**

## Round ten: a dormant bug that a TALENT CHANGE woke up

**THE NET IS -5.9 AND EVERY PART OF IT IS LARGE.** Three changes landed on one
profile and two of them nearly cancel, which is exactly the shape a single
figure hides. Decomposed by reverting each in a worktree, 20 seeds each:

| | Firelock | what it is |
| --- | --- | --- |
| round nine baseline | 891.4 | |
| **the owner's LIST alone** | **921.0** | **+29.6** -- Bane of Agony, Shadowburn second, the potion first |
| **the owner's TALENTS alone** | **853.1** | **-38.3** -- Aftermath 5/5 -> 2/5 is 30% off Immolate |
| both, which is what ships | 885.5 | -5.9 |

Marginals do not sum (891.4 + 29.6 - 38.3 = 882.7 against 885.5), which is the
usual overlap and is said rather than hidden.

### The bug, and why nothing could have caught it

**AFTERMATH READ A MOVEMENT SPEED AS A DAMAGE BONUS FOR THE WHOLE LIFE OF THE
TALENT.** CLAUDE.md named it before it could bite -- *"The Warlock's Aftermath
has the same mistake and escapes it only because at 5/5 the two numbers
coincide"* -- and this is the round where 5/5 stopped being true.

    rank    1     2     3     4     5
    {0}    10    20    30    40    50   <- Immolate initial damage
    {1}    20    40    60    80   100   <- daze chance
    {2}    50    50    50    50    50   <- MOVEMENT SPEED  <- what it read
    {3}     5     5     5     5     5   <- seconds

**THE COST OF NOT FIXING IT WAS MEASURED RATHER THAN ASSERTED: 921.0 against
885.5, +35.5.** With the owner's 2/5 and the wrong index, Immolate collects 50%
where the talent grants 20% -- two and a half times the talent on the profile's
second-largest damage source -- and the published figure would have read **+29.6
instead of -5.9**, in the right direction, on nobody's authority.

**AND THE 921.0 APPEARS TWICE IN THAT TABLE, WHICH IS NOT THIS PROJECT'S USUAL
TELL.** "Two variants that agree exactly are a patch that did not apply" -- here
they agree because they ARE the same configuration: old talents at 5/5 with a
correct index and new talents at 2/5 with the broken one both give Immolate
x1.50 under the same list. The identity is explicable, and saying which of the
two readings applies is the whole reason to check rather than to celebrate.

**THE COMMENT RESTATED THE WRONG INDEX IN ITS OWN WORDS**, "by {2}%" -- the Rip
lesson repeating, where a wrong reading survives in the prose beside it and the
figure that would expose it is wrong in the same sentence that asserts it.

**THE TEST ASSERTS THE SLOPE, NOT A VALUE.** Any single-rank check at 5/5 passes
against both indices, so the only shape that catches this is the rank scaling --
1.10 / 1.20 / 1.30 / 1.40 / 1.50 against a flat 1.50. `warlockTalents.test.ts`.

**AND ITS THIRD CASE WAS WRONG FIRST.** It expected the preset's Immolate
multiplier to be 1.20 and read **1.32**, because Agonizing Flames multiplies on
the same ability id. The code was right and the assertion was not -- so it
measures Aftermath as a RATIO against the same build without it, with
`legalAllocation(...).dropped` printed beside it. **An absolute expectation on a
per-ability multiplier is silently a claim about every talent that lands there.**

### Three points that buy nothing, and will never buy anything

**INTENSITY IS `castPushback`**, which is a permanent ruling rather than a gap:
the engine resolves a cast time once, before `onCast`, AND no caster profile is
attacked. **Blocked twice**, which is this project's own test for a ruling.

So the owner's respecification moves three points from a talent worth 30% of
Immolate's damage into one that is out of scope by construction. **That is the
figure worth putting in front of them**: the list they wrote is +29.6 and the
talents they wrote are -38.3, and the two are independent choices.

### The list, and two readings kept apart on purpose

Eight entries. **Bane of Agony is new** -- the first Affliction spell a
Destruction Warlock casts here, and a trainer spell, so it needs no talent.
2.0 casts a fight at **9.0% of the profile's damage**.

**BOTH DAMAGE-OVER-TIME ENTRIES GAIN A FIGHT FLOOR AND ONLY ONE IS A
JUDGEMENT.** Bane of Agony's 25 is `BANE_OF_AGONY_DURATION_MS` plus one, so the
debuff goes out only if it can run in full; Immolate's 3 is a choice and is the
owner's.

**AND THE TWO USE DIFFERENT READINGS IN ONE LIST** -- a 1.5-second refresh
window on Immolate, "is not up" on Bane of Agony. Transcribed as given rather
than normalised into one, which is the editor's own promise. The shared
two-second `REFRESH_WINDOW_MS` lost its last caller here and is removed, with
the reading it stood for kept beside the constant that now uses it.

## Round nine: where a CONSUMABLE beat every list change in the series

**THE TWO BIGGEST FIGURES IN NINE ROUNDS ARE A FLASK AND A PIECE OF FOOD.**
Seal Twist Ret **+59.9** and the Shockadin **+73.3**, and 24 of 27 rows are 0.0
to the decimal.

| | what moved | the half that did it |
| --- | --- | --- |
| Seal Twist Ret | 816.5 -> **876.4** | the consumables, **+56.4** of it; it got no list change at all |
| Shockadin | 714.4 -> **787.7** | the consumables, **+71.8** |
| Prot Pally | 400.6 -> **434.5** | the LIST, **+26.5** -- its food is +2.4, inside the interval |

### The decomposition, because three changes landed on one profile

Measured by reverting each half in a worktree, 20 seeds each, against the same
round-eight baseline:

| | consumables alone | list + GCD alone | measured total |
| --- | --- | --- | --- |
| Seal Twist Ret | **+56.4** | -3.4 (noise, and it has no list change) | +59.9 |
| Shockadin | **+71.8** | -1.5 (noise, same) | +73.3 |
| Prot Pally | +2.4 (noise) | **+26.5** | +33.9 |

**AND THE SWIFT JUDGEMENT RULING IS +5.4 OF THAT 26.5**, measured on its own --
borderline against its own +/-4.9 interval, which is about what taking a global
cooldown off a once-a-fight ability should be worth. The owner asked for it as
a correctness fix rather than a tune, and that is what the figure says it is.

**MARGINAL VALUES DO NOT SUM, which these illustrate rather than violate**: the
two halves of Prot Pally's row come to 28.9 against a measured 33.9, because
each was measured with the other absent.

### Why a flask was worth more than any list

**+1200 Hit Points -> +150 Spell Power on a build that is never attacked.** The
hit points reach a pool nothing touches; the spell power reaches 54% of Seal
Twist Ret's damage and **74% of the Shockadin's**, which is the highest Holy
share of the four hybrid builds and is why it is the bigger figure.

**THE PROTECTION PALADIN WAS GIVEN THE FOOD AND NOT THE FLASK**, and that
asymmetry is the owner's. It is the one of the four that is HIT BACK, so +1200
Hit Points is worth something there that it is worth nowhere else in the row --
recorded as the likely reason and not acted on, because a ruling covers what it
says. **Its food is +2.4, which is noise**, so the row is the list's.

**AND IT MAKES THREE OF `hybridConsumables`' FOUR BUILDS RULED ON, HOLDING TWO
DIFFERENT ANSWERS**, so the shared row cannot be edited -- the same arithmetic
that settled `STRENGTH_CONSUMABLES`, reached one category along. The Enhancement
Shaman is the remainder and is what the row still supplies.

### Three changes that moved nothing, and all three are correct

**SAID PLAINLY BECAUSE A 0.0 IS THIS PROJECT'S OWN TELL FOR A PATCH THAT DID NOT
APPLY.** Each of these was predicted to be worth nothing BEFORE it was measured,
which is what makes the zero evidence rather than an absence of it.

- **Both Lone Wolf Hunters**, respecified to 5/39/7 and 5/13/33. Both move the
  same two points out of **Focused Fire**, which has never paid them: "+2% while
  your pet is active", and `bringsPet` is exactly `lone_wolf === 0`. They land
  on **Survivalist** (health, on a build nothing attacks) and **Survivalist's
  Discipline** (a PERCENTAGE cooldown reduction, which `abilityCooldown` cannot
  express). **Only the second reason expires** -- it is a live gap arriving in a
  profile, and the day somebody gives `abilityCooldown` a fractional form this
  build gains two points of real effect with nobody touching it.
- **The demon chooser**, which is a UI control and should move nothing. Both
  Warlock rows are 0.0, which is the containment check a panel change gets.
- **The Prot Paladin's death count**, 9.40 -> 9.37. Its DPS row moved +33.9 and
  its figure of merit did not, which is the right way round for a change that
  was about what the list CASTS rather than about what it survives.

### And the 15% was confirmed rather than assumed

The owner's second ask: "ensure that this 15% shadow damage bonus is being
applied". Measured per ability against the same build with no demon chosen:

| | x1.1500 | x1.0000 |
| --- | --- | --- |
| **SM/DS (Imp)** | Wrack, Corruption, Bane of Agony, Siphon Life, Shadow Bolt | Touch of the Grave |
| **Firelock (Succubus)** | Incinerate, Immolate, Conflagrate | **Shadowburn**, Touch of the Grave |

**SHADOWBURN AT x1.0000 IS THE RESULT, not a gap**: it is a Shadow spell on a
Fire build, so a whole-character reading would have raised it -- which is the
exact mistake that cost this profile 55.3 DPS before `damageDoneBySchool` landed
on `AuraDefinition`.

**AND TOUCH OF THE GRAVE IS THE ROW THAT LOOKS LIKE A MISS AND IS A RULING.** It
is Shadow and it declares `ignoresAttackerDamageScaling`, because the owner's
text is "only scales off your hit points" -- so the CASTER'S Shadow Mastery,
Shadow Weaving and this sacrifice all stop at it while a debuff on the TARGET
still raises it. Pinned by name in `demonicSacrifice.test.ts` so a reader
checking "all Shadow went up 15%" does not file it as a defect.

**ASSERTED END TO END AND NOT ON THE CONSTANT**, which is the Adrenaline Rush
lesson: `DEMONIC_SACRIFICE_DAMAGE` has read 1.15 since the aura was written, and
a constant check cannot see an aura that is applied, reports its uptime and is
read by nothing.

### The control nobody could reach

**`petFamily` HAD NO UI ANYWHERE.** It was settable by a preset or by hand-editing
a saved file and by nothing else -- which is how it went missing from
`validateProfile`'s field-by-field rebuild and cost both Warlock presets 15% of
a school on load, in silence. The Talent panel has a chooser now, shown when a
Warlock has taken Demonic Sacrifice.

**A RADIO GROUP AND NOT FOUR CHECKBOXES**, which is the owner's word read
against the field: `petFamily` holds ONE id, so four independent boxes would let
somebody tick two and the profile could not hold the answer. Same structural
argument the consumable selection makes about one choice per category.

**AND NOTHING IS PRE-SELECTED.** An absent field gets no buff rather than a
default one, so a chooser that opened on the Imp would claim a choice the file
does not contain.

## Round eight: seven profiles at once, and the first round with a LOSS in it

**FOUR OF THE SEVEN ARE REAL AND ONE OF THEM IS +90.7**, which is the largest
single figure in this series. The twenty untouched rows are **0.0 to the
decimal**, which is the containment check.

| | what moved | what it was |
| --- | --- | --- |
| **Fire Mage** | 753.0 -> **843.7** | talents AND list: six points into Arcane bought Missile Barrage, and the list gained the Arcane Missiles entry that spends it, plus a Fire Blast gated OUT of Clearcasting |
| **Cat Druid** | 859.0 -> **892.7** | four list changes and a potion swap at once; not decomposed |
| **Frostfire** | 837.0 -> **863.3** | a Fire Blast above 10% mana, and a SALVAGE Pyroblast at two Heating Up stacks |
| **Ele Shaman** | 651.4 -> **671.1** | 32/6/13, Searing Totem first, and the racials BELOW the two maintenance entries |
| Arcane Mage | 857.7 -> 866.8 | inside the interval; the respecification is a rebuild of the build rather than a tune |
| Moonkin | 788.4 -> 785.9 | inside the interval |
| Bear Druid | **deaths 10.00 -> 9.98** | a tank row, and the DPS is the wrong measure -- see below |

### The Bear's row is the one worth reading twice

**STAMINA FOOD BOUGHT 231 HEALTH AND TOOK 0.02 DEATHS OFF A FIGHT, AT -9.6
DPS.** Measured on the mechanism rather than inferred, which is what
`tools/bear_survival.ts` is for:

| | before | after |
| --- | --- | --- |
| health | 9,254 | **9,485** |
| deaths | 10.00 | **9.98** |
| damage taken | 232,985 | 232,551 |
| dps | 395.7 | 386.1 |

**THE ENCOUNTER IS WHY, AND IT IS THE RAMP RATHER THAN THE FOOD.** The boss
opens at 5,000 and every swing is 10% harder, so by the end of a fight a single
blow is north of twelve thousand -- 231 more health is a fraction of one late
swing, and the character dies at the same point in the ramp either way. **This
is the same shape as block value measuring "not measured" in the tank weights**:
a flat mitigation quantity against a geometric one.

**IT IS THE OWNER'S CHOICE AND IT IS RECORDED, NOT ARGUED WITH.** What is worth
saying is that the comparison it invites -- against the Prot Warrior's stamina
food, which took deaths 6.17 -> 5.93 -- is a comparison between two different
HEALTH POOLS and two different ramp positions rather than between two foods.

**AND THE MIGHTY RAGE POTION NOW FIRES.** Moving it from the bottom of the tank
list to between Enrage and Berserk takes it to **1.0 casts a fight**, which is
what the move was for: the bottom of a tank list is a place entries are not
REACHED, and this file already records five of seven racials coming back inert
there.

### What the respecifications cost, which no DPS figure shows

Three things that a measurement cannot report, found by the suite and by the
census rather than by a number:

- **The Elemental build now spends three points on ELEMENTAL WARDING**, which
  reduces Fire, Frost and Nature damage TAKEN against a target that deals none.
  A genuine live gap with the ENCOUNTER cause. `shamanAbilities.test.ts` records
  it on both Shaman builds now rather than on Enhancement alone.
- **TIDAL FOCUS joins that build partly modelled, in the healthy direction**:
  its +5% chance to hit is why the five points are there, against a 17% spell
  miss and a 16-point usable cap, and only its healing-cost half is dead.
- **No Mage profile takes ARCANE RESILIENCE any more.** The conversion still
  works and is still declared; what changed is that nothing reaches it.

### Four tests were reading a profile to pin a mechanism

All four broke on an owner revision that had nothing to do with what they test
-- Reverberation, Shamanistic Focus, Arcane Resilience and the Presence of Mind
entry -- and three of them are the SAME correction
`grantCastModifier.test.ts` already recorded for Mental Agility one revision
earlier, in its own words: "this pins a mechanism, so it must not depend on
which talents a profile happens to spend points on". They build their
allocation by hand now.

**THE FOURTH IS THE EXCEPTION AND IT GIVES WAY.** "Spends Presence of Mind on
the CHEAP Arcane Blast, without a Barrage" pinned a ROTATION DECISION, and the
owner has made a different one -- the charge goes on a six-second Pyroblast at
the Arcane Blast cap instead. **A test that pins a rotation decision has to give
way when the decision changes owner; a test that pins an invariant does not.**

### Two builders, because a shared fragment was asked for three things at once

`buffPotionCooldown` is the two pure buff potions, optionally **held for one of
the character's own cooldowns** -- Spellblasting for Presence of Mind on the
Arcane Mage, Frenzy for Berserk on the Cat -- and `consumableCooldown` hands one
shared entry to a list that places it itself, which is what the Bear's move
needed. **Both carry the NOTE with the condition**, which is the whole reason
they are functions and not conditions patched on afterwards: a note is a frozen
string, and an override touching only the condition leaves the panel explaining
a gate that is gone. `thistleTeaCooldown` has had this shape for two rounds.

**A GATED POTION CANNOT STARVE ITSELF, and that is the thing to check before
writing one.** The aura each waits on is applied by an entry BELOW it, so the
first poll skips the potion and casts the cooldown and the next poll -- 100ms
later, because a potion takes no global cooldown -- finds the window open. A
gate waiting on something only an entry ABOVE it could supply would never open
at all, and would read exactly like a working list.

### And the Thistle Tea default is now reached by nobody

The Cat joined the tight ten, which was the last of the six drinkers still on
the shared twenty. **The shared constant must not move to ten.** A default is
what an UNRULED build gets; the tens and the fifteen are the owner's, given one
profile at a time, and folding their commonest answer into the default would
make the next unspecified build inherit a ruling that was never about it.
`consumableCooldownGates.test.ts` asserts the emptiness so the claim is
checkable rather than a comment.

## Round five: Venom, where the owner reversed two measured decisions

**+33.5, AND ALL OF IT IS THE LIST.** The agility food is **+0.3** -- a Rogue
gets 1 attack power a point, so +20 Agility is HALF the attack power of +40 and
buys crit with the difference, and the two come out level. 24 of 25 rows are
0.0 to the decimal.

### Two reversals, and both of ours were measured

| | what we had, and why | what the owner specified |
| --- | --- | --- |
| **Rupture** | measured INTO this list at **+16.7**, because the build's points were overflowing -- ~28.5 gained a fight with **7.21 wasted at the cap** | **out entirely** |
| **Eviscerate** | taken OUT because it fired **0.0 times**: its gate wanted Slice and Dice above TEN seconds, Venom above TEN, AND exactly FIVE points, with Rupture taking the pool at four before the third could be true | **back**, at three points and a three-second floor -- **3.6 casts a fight** |

**THE OVERFLOW ARGUMENT SURVIVES INTACT AND POINTS SOMEWHERE ELSE.** Rupture
was not there because Rupture is good; it was there because the points had
nowhere to go. The owner has given them a different outlet by LOOSENING every
number on the entry that could not fire, which is why this is a
respecification rather than a revert -- and `USES=1` confirms every one of the
seven entries fires.

**SO "AN ENTRY THAT CANNOT FIRE" WAS THE RIGHT DIAGNOSIS AND "REMOVE IT" WAS
ONE OF TWO CURES.** The note on the removal said an entry that cannot fire "is
the single most common rotation bug in this project and the one that hides
best", and it was right about the entry; what it did not consider is that the
gate was what could not fire, and the gate is a number.

### Cold Blood now aims at a finisher, and its GCD is what makes that work

The previous version fired it at **zero points and 60 energy**, on the stated
reasoning that the next ability would be the builder. The owner's gate is the
opposite in every term -- **three points, 35 energy, both buffs up** -- which is
Eviscerate's own gate plus the energy to pay for it. **The 35 is not Cold
Blood's cost**, because Cold Blood is free; it is the cost of what it is saved
for.

**THE OWNER ASKED FOR COLD BLOOD TO TAKE NO GLOBAL COOLDOWN AND IT ALREADY
DID**, which is the result rather than a disappointment -- and it is
load-bearing for this list where it was not for the last one. Pinned on the
EVENT STREAM as well as the flag.

**AND THE GAP IS ONE 100ms POLL RATHER THAN ZERO**, which is the documented
price of a free off-GCD cast: the actor is left FREE, so `nextDecisionTime`
returns `now + ROTATION_POLL_MS`. Charge and the four racial cooldowns already
pay it. **The test asserts the BAND and not the instant**, because the
distinction the owner's gate depends on is poll-versus-global, not zero.

### A note can contradict its own entry, and the owner's screenshot shows one

Their panel reads **"energy <= 10"** with a note underneath saying **"Under 20
is the compromise"**. Both are correct about different moments: the gate was
edited and **the note is a frozen string that an edit does not touch**.

**NOTHING HERE CAN FIX A HAND-EDITED ENTRY**, and the stock lists are now
asserted self-consistent instead -- `consumableCooldowns({ thistleTeaEnergy })`
builds the note from the same number the condition uses, so the only way to see
a note disagree with its gate is to have edited it yourself. **Whether the
panel should drop or flag a note when its condition changes is an open
question.**

**AND THE GATE IS A PARAMETER RATHER THAN A MOVED CONSTANT**, because the entry
is in a SHARED list fragment: five profiles drink Thistle Tea -- all four Rogues
and the Cat Druid -- from one entry every list spreads. `CONSUMABLE_COOLDOWNS`
is that function called with nothing, so the other 25 lists are byte-identical.

### The test file was rewritten before it landed

Its first version ran three batches of 200, 200 and 40 and cost **7.5 seconds**,
making it the heaviest file in the suite -- and `chargeAndShieldTalents` timed
out on the run that added it.

**THAT FILE IS A DOCUMENTED FLAKE UNDER LOAD**, 1.6s alone against a 5s limit,
and this is its FOURTH recorded instance. **The run was captured before being
re-run this time**, which is the rule this file states and had already been
broken once: the full suite passed at 3,414 and the file timed in isolation, so
both halves of the evidence survive.

**SO IT IS NOT PROOF OF CAUSE, AND IT IS STILL A REASON NOT TO SPEND SEVEN
SECONDS ASKING A QUESTION WORTH ONE.** Every question the file asks of a fight
is "does this fire at all", and `uses` is a MEAN PER FIGHT -- sixty iterations
answer it as well as three hundred. One memoised batch, **518ms**, same
fourteen assertions.

## Round four: Hack and Slash, a five-point talent worth nothing

**THE OWNER'S RULING:** "these are global effects ... if you have a MH mace, and
an off hand Dagger/Fist the off hand gives a global 5% crit chance to
everything, and the mace gives a global 15% armor pen to everything."

**IT WAS MAIN-HAND-ONLY, AND THE COMBAT ROGUE HOLDS A SWORD AND A DAGGER.** The
sword earned the extra attack; the dagger's 5% crit was dropped, because the
only hand the clause asked about was the sword's. Measured before the fix, 5/5
against 0/5 on that preset: **27.88% crit against 27.88%**. Worth **+32.5 DPS**,
and **24 of 25 rows moved 0.0 to the decimal** -- the sharpest containment check
available, because the change is keyed on holding a qualifying weapon in the
OFF hand and exactly one preset does.

### Three reasons nothing caught it, and they are three different shapes

| | |
| --- | --- |
| **the fixture** | `rogueTalents.test.ts` drives the talent with `holding('dagger')` -- a main hand and NO off hand -- so every case in it is a hand combination where both readings give the same answer |
| **the comment** | it said "ONLY THE COMBAT PROFILE TAKES THIS, and it holds two swords", which stopped being true when the presets moved into the benchmark gear. Two swords is again a character for whom both readings agree |
| **the census** | the talent reported itself FULLY MODELLED. Its three clauses are all declared and two of them were correctly inert for the weapons it thought the character held |

**A FIXTURE THAT CANNOT EXPRESS THE MISTAKE PROVES NOTHING ABOUT IT**, which is
the stock Warlock list's lesson in another file -- and here the COMMENT
described exactly the character the fixture did, so a reader checking either
would have found nothing wrong.

### Two thirds of the ruling were already right, and are now pinned

**THE EXTRA ATTACK** is the owner's stated exception -- "it can only proc when
you use that weapon and it always triggers a MH swing regardless of weapon
type" -- and was already gated inside the reaction on the weapon that SWUNG.
Both worked examples are asserted in both directions now, **with the roll
FORCED so one use is decisive**: a 5% chance over a sample answers "how often",
and the question is "can it at all".

**ARMOR PENETRATION IS ALREADY A PERCENTAGE OF WHAT IS LEFT.** Every armor
debuff is a flat stat modifier on the DEFENDER and `penetratedArmor` reads the
defender's stat, so the ordering the owner described holds BY CONSTRUCTION. The
worked example is transcribed as a test -- 3500 -> 1000 by debuffs -> **850** --
because "it already works" was a claim about the code that nothing was
checking, and a change that penetrated a BASE figure would reproduce every
earlier test while quietly inflating every armor debuff.

### `meets()` takes the context now, and the reason is a bug it caused

The off hand was **already on `TalentBuildContext`** and simply never reached
the requirement check: seven call sites each passed `context.mainHand` by hand,
and none of them could have passed the other one. One object cannot be passed
in the wrong order.

**AND FIVE ARGUMENTS OF WHICH THREE WERE OPTIONAL IS A SHAPE THAT ACCEPTS A
WRONG CALL SILENTLY.** A probe written while investigating this talent called
`weaponsFor(class, style, equipment)` against a signature of
`(equipment, style, multiplier)`, got the PLACEHOLDER weapons back, and briefly
"found" that every Rogue preset holds an untyped weapon -- which would have been
a far larger bug than the real one. It typechecked, because the first parameter
is an object either way.

### The ruling that was NOT extended, and the one that expired next door

**TWO DAGGERS ARE 5% AND NOT 10%.** "Global" is not "per weapon", and the
doubling reading is the generous one. No preset holds two of a kind that
matter, so nothing turns on it -- pinned and flagged for the owner rather than
assumed.

**THE WARRIOR'S WEAPONMASTER IS THIS TALENT WITH THE FAMILIES PERMUTED**, and
its `unmodelled` reason claimed its two clauses "read the MAIN HAND only" **as
though that were a property of the engine**. It was a property of
`BuildRequirement`, so the reason expired ACROSS A CLASS BOUNDARY with nothing
in its own file changing -- the kind this project keeps missing. It names the
RULING it is waiting on now rather than a capability, which is what gets one
asked.

**AND IT ALSO CLAIMED EVERY WARRIOR GEAR SET HOLDS A SWORD.** 2H Arms and DW
Fury hold AXES since the benchmark gear landed, so Weaponmaster's axe/polearm
crit clause is **live on 2H Arms** rather than unreachable. 2H Arms is the only
Warrior taking it and holds a two-hander, so the either-hand question moves no
figure there today.

## Round three: Prot Warr, where the DPS row is the wrong measure

**TWO CHANGES, AND NEITHER IS A DPS DECISION.** The published row moves 471.5
-> **469.7**, which is inside its own +/-3.2 interval and is the least
informative thing about the round. 24 of 25 rows are 0.0 to the decimal.

### The four list moves, and one of them overturns an argument this repo made

| | from | to |
| --- | --- | --- |
| **Defensive Stance** | sixth, BELOW the two survival cooldowns | **second**, above them |
| **Bloodrage** | two entries above Battle Shout | below it |
| **the mid-fight consumables** | LAST, with the racials | **tenth** |
| **Revenge** | below Shield Slam | above it |

**`protectionRotation.test.ts` ASSERTED THE OPPOSITE OF THE FIRST ONE AND GAVE
A REASON** -- the two survival cooldowns sat "above everything that can repeat
... above even the stance, because a dead tank is in no stance at all". The
decision was ours and is the owner's now.

**AND THE OLD ARGUMENT WAS NEVER LOAD-BEARING**, which is why this costs
nothing either way: the stance entry is gated on Defensive Stance having RUN
OUT, so it fires once at the pull -- where the tank is at full health and both
cooldowns below it are refused anyway. **The two orders differ only in a moment
when neither of the things being ordered can happen.** It becomes real the day
something moves the tank out of its stance mid-fight.

**WHAT SURVIVES IN THE TEST IS THE INVARIANT.** Nothing that REPEATS sits above
the two cooldowns: only Charge, castable for one instant at the pull, and the
stance, which is also a once-a-fight entry at a moment when nothing is in
danger. Both are off the global cooldown. **A test that pins a rotation
decision gives way when the decision changes owner; one that pins an invariant
does not**, and this is the clearest instance of that split the project has
produced.

### The list reorder is worth nothing, and the reason is not the one expected

**-0.4 DPS and +0.01 deaths**, on 300 fights. The move that looked like it
would matter was the mid-fight consumable coming up from the bottom -- the
racials' own position, which this file documents as a place entries are NOT
REACHED, "which is how five of seven racials came back inert when they were
tried there".

**IT WAS ALREADY FIRING 1.00 TIMES A FIGHT AT THE BOTTOM.** A two minute
cooldown in a sixty second fight is one cast whatever its position, and a tank
list does fall that far often enough to take it. **So the argument that
justified the move is sound and did not apply to this entry**, and the honest
reading is that the split between the potion and the racials is a policy the
owner has stated rather than a measured gain. It would start mattering on a
longer fight, where the potion is worth more than one cast.

**THE REVENGE/SHIELD SLAM SWAP IS THE ONE BOTH ENTRIES CONTEST**, and it moved
them 9.7 -> 10.4 and 9.4 -> 9.2 casts a fight for no net figure.

### The stamina food is the round, and it is a TRADE

| | before | after |
| --- | --- | --- |
| health | 8,803 | **9,034** |
| deaths | 6.17 | **5.93** |
| damage taken | 120,416 | 119,090 |
| rage gained | 655 | 651 |
| DPS | 471.5 | 466.5 |

**EVERY COLUMN MOVES THE WAY THE MECHANISM PREDICTS, INCLUDING THE TWO THAT
LOOK LIKE LOSSES.** Stamina buys health; health is what a death count is
counted in; and Forever's `D x 10 / H` means a bigger pool makes each point of
damage taken worth LESS rage -- so rage falls, and the damage that rage would
have bought falls with it. **A -5.0 DPS row is the price of -0.24 deaths**,
which is the trade a tank food is for.

**THE PAIRING IS WHAT MAKES THE DEATH FIGURE READABLE.** Four configurations
were measured and they fall into two pairs by HEALTH rather than by list: the
two at 8,803 health read 6.17 and 6.18 deaths, and the two at 9,034 read 5.93
and 5.98. The pairs do not overlap, and the thing that separates them is the
only thing that differs between them.

**AND THE TOOL HAD TO BE GENERALISED TO SEE ANY OF IT.** `bear_survival.ts` was
named after the Bear and served only the Bear, and its columns are not a Druid
fact -- deaths, damage taken, armor, dodge and rage are what ANY build whose
figure of merit is a death count is read on, and there are three such presets.
It takes a `PROFILE` now, prints HEALTH (a stamina change is invisible in every
other column), and REFUSES a build nothing attacks rather than printing a row
of zeros that reads like a finding.

### Three food rulings, two answers, and the row that can now never move

**2H ARMS AND DW FURY TAKE +20 STRENGTH; PROT WARR TAKES +20 STAMINA.** Three
of the five members of `STRENGTH_CONSUMABLES` are named and two different
answers are among them -- so **a shared row holds one value and the owner has
given two**, and no edit to it can satisfy the rulings that exist.

**THAT IS A FACT ABOUT THE SHAPE RATHER THAN A RULE ABOUT CAUTION**, which is
what the first two overrides rested on ("a ruling covers what it says and is
not extended by analogy"). It is the stronger argument and it arrived by the
owner simply answering a third time.

**AND THE ROW-WIDE TEST NOW LIVES IN ONE PLACE.** It was written in
`armsRotation.test.ts` and again in `berserkerRotation.test.ts`, so this single
ruling failed BOTH files and the set of "unnamed" profiles had to be edited in
each -- **two copies of a set is how the two drift**. It is a claim about the
consumable ROW rather than about any list, so it sits in `consumables.test.ts`
with the arithmetic that decides when the row itself should finally move. What
each rotation file keeps is that its own override touches the FOOD and nothing
else.

## Round two: DW Fury, and a move that provably changes nothing

**ONE ENTRY MOVED.** Death Wish goes from EIGHTH -- directly above Execute --
to FOURTH, between the potions and the Healthstone. No condition changed and
nothing else in the list moved.

**THE FOUR ENTRIES IT PASSES ARE ALL INERT, EACH FOR ITS OWN REASON:**

| | why it never fires |
| --- | --- |
| Healthstone | nothing attacks this build, so health never leaves maximum |
| Berserker Stance | the preset opens in it |
| Battle Shout | in `PRESET_RAID_BUFFS`, so its condition refuses all fight |
| Sunder Armor | a preset raid DEBUFF puts five stacks on the boss before the pull |

So the entry Death Wish is really above is **still Execute**, which is where it
already was.

**PROVEN BY THE CHEAP CHECK RATHER THAN THE EXPENSIVE ONE.**
`tools/rotation_fingerprint.ts` hashes the COMBAT LOG, so unchanged hashes say
no DECISION moved -- all 75, and every event count. The engine draws from ONE
random stream, so a single differing choice would reorder every later draw and
the rest of the fight would diverge completely; the property that ruins paired
measurement is what makes this sharp. **A DPS figure could only ever have said
"inside the interval"**, which is the same thing a change that failed to apply
says.

**IT IS STILL WORTH MAKING, AND THE FOUR REASONS ARE WHY.** Every one of them
belongs to the ENCOUNTER and to the raid rather than to the abilities, so
changing the raid buff selection or letting the target swing back wakes three
of them up -- and then the position is the difference between a 30-second
damage cooldown landing on time and landing behind a shout. **An entry that is
inert for an encounter reason is a dated fact**, which this file already
records about Reckoning's internal cooldown.

**THE FOOD IS +1.2 AND IS THE WHOLE OF THE ROUND'S MOVEMENT**, which the two
checks between them establish exactly: the fingerprint says the reorder is
zero, and 24 of 25 rows are 0.0 to the decimal -- including 2H Arms at exactly
849.7, so round one is undisturbed.

**AND IT IS A SECOND RULING RATHER THAN THE FIRST ONE EXTENDED.** The owner
named 2H Arms, then named DW Fury, one profile at a time -- so it is a second
OVERRIDE and `STRENGTH_CONSUMABLES` is still untouched. **TWO OF FIVE IS NOT A
ROW**: Prot Warr and both feral Druids share it and have not been named, and
`MELEE_COMMON` beneath it carries four Rogues and a melee Hunter. If the Druids
are named too, the honest edit is the row and both overrides come out together.

**THE CONTAINMENT TEST EARNED ITS KEEP IN ONE ROUND.**
`armsRotation.test.ts` asserted the other four members of the archetype row
were untouched, and it FAILED on `dw_fury` the moment this landed, naming the
profile that had changed. That is exactly what the list is for -- it shrinks by
one each time the owner names another -- and it asserts BOTH sides now, so it
says which side each profile is on rather than only naming the remainder.

## The tooling moved nothing, and that is the containment check

**THE BASELINE WAS TAKEN AT THIS COMMIT WITH ONLY THE TWO BEHAVIOUR-AFFECTING
FILES REVERTED**, which is the cheap isolation this file already argues for:
`git checkout <parent> -- src/game/rotations/warrior.ts src/profiles/presets.ts`,
measure, restore, measure. So the baseline run had **the whole editor and the
whole timeline panel in it**, and all 25 rows came back identical to the
published table.

**THAT IS A STRONGER CHECK THAN "the UI cannot move a figure"**, which is an
argument rather than a measurement -- and it is the Gear panel's round one
arriving a second time: a UI feature that moves a figure has a bug in it, so
"no row moved" is the thing to verify rather than the thing to be disappointed
by.

## The three tooling items answer one complaint

**THE EXPENSIVE PART OF AN ENTRY IS ITS CONDITION**, and every way of changing
an entry threw it away. That is the whole of what the first two do.

| | what it replaces |
| --- | --- |
| **duplicate**, copy directly below | delete, add at the bottom, rebuild the condition, walk it back up |
| **retarget**, the ability as a dropdown | the same four steps, for "the same rule on the other strike" |
| **the timeline** | holding two timestamps in your head and subtracting |

**BELOW RATHER THAN ABOVE IS WHAT MAKES A MID-LIST INSERTION SAFE AT ALL.**
Every other insertion in `aplEditing.ts` goes at the BOTTOM, because an
unconditional entry anywhere else is a floor under everything beneath it. A
copy placed under its own original is the one exception that cannot be: the
original is checked FIRST and the two are byte-identical, so whenever the copy
would be castable the original already was, and the list walks past it to
exactly where it went before. **It starts inert by construction** and becomes a
decision only once somebody edits it. Above would be the opposite -- the copy
would take every cast the original was making.

**AND AN ABILITY THE BUILD DOES NOT KNOW KEEPS ITS OWN OPTION**, which is
`AuraChoice`'s rule and matters more here than it does there: falling back to
whichever name sorts first would rewrite the entry the moment the panel DREW
it. An edit nobody made, to a list nobody touched, with nothing on screen to
say so.

## The timeline is a different question from the combat log, not a prettier one

The log is every event in order as text, which is the right shape for "what
happened at 14.2 seconds" and the wrong shape for **every question a priority
list is actually tuned against** -- all of which are about where two things sat
RELATIVE to each other. Did the buff fall off before it was refreshed. Did the
pool sit at zero through the window the expensive ability was up. Is this
cooldown ever lined up with that one.

**THE BUILDER IS SEPARATE FROM THE COMPONENT**, which is `aplEditing.ts`'s own
rule, and the reason is that the three aura edges are the part that can be
wrong and **all three render perfectly**:

| the edge | what getting it wrong draws |
| --- | --- |
| a REFRESH does not close a window | one 30-second Sunder Armor as a dozen bars with gaps that never existed |
| a STACK CHANGE does not either | the same, on anything that stacks |
| an aura still up at the END never emits a removal | every maintained buff ending whenever it was last refreshed, which reads as a rotation that stopped |

**AND THE AURA FILTER IS DELIBERATELY WIDER THAN THE CAST ONE.** A preset raid
DEBUFF is applied at the pull with the TARGET as its own source, so a
source-only filter drops it -- and the filter WAS source-only in the first
version, which is how a test driven by a real fight caught it. See below for
why that matters more than it sounds.

**ONE ITERATION, THE REPRESENTATIVE ONE, AND THE SUBTITLE SAYS SO.** Averaging
"was this up at t=12s" across iterations of different lengths that cast
different abilities draws a fight nobody ran; `ResourceTimeline` already made
that argument and this is the same argument over three more lanes.

## What the timeline immediately said about the list it was built for

**THE ARMS LIST'S SUNDER ARMOR ENTRY FIRES 0.00 TIMES, AND THE CAUSE IS THE
ENCOUNTER.** Five stacks are on the boss before the fight starts, because
`sunder_armor` is in `PRESET_RAID_BUFFS` -- so the entry's condition refuses it
for the whole fight, exactly as Battle Shout's does.

**IT IS THE FOURTH OF THE FOUR DOCUMENTED CAUSES** of a never-fired entry, and
the one that reads least like a defect: the id resolves, the build knows the
ability, the entry above yields, and the thing it would apply is already there.
**It is also the one the timeline shows directly**, which is why the wider aura
filter is not a convenience -- a row for a debuff that was up from the pull is
the answer, drawn.

**NOT CHANGED, BECAUSE IT IS NOT OURS TO CHANGE.** The entry is in the list the
owner specified and it costs that list nothing. Flagged here rather than
removed.

## 2H Arms: what each half was worth

**FOOD IS +0.9 AND IS CORRECT**, which is worth stating rather than
apologising for. +20 Strength and +40 Attack Power are **the same 40 attack
power** on a plate build before anything scales them -- strength is 2 attack
power a point -- and the difference is only that strength goes through the
CONVERSION, so Blessing of Kings' 10% reaches it and reaches no flat pool. Two
strength is four attack power on a character carrying about 1,800.

**AN OVERRIDE ON THE PRESET, NOT AN EDIT TO `MELEE_COMMON`.** The ruling names
one profile, and a ruling covers what it says. That row is shared with DW Fury,
Prot Warr and both feral Druids, and `MELEE_COMMON` beneath it with four Rogues
and a melee Hunter -- so the edit would have moved **ten published figures on
one sentence about an eleventh**. `armsRotation.test.ts` asserts the other four
are untouched, which is the containment check written down.

**THE LIST IS +23.8, AND BOTH HALVES OF IT CONTRIBUTE:**

| | 2H Arms, against 825.9 |
| --- | --- |
| the threshold alone, 75 -> 90 | **+10.5** |
| the reorder alone, at the old 75 | **+14.6** |
| **both, which is what shipped** | **+23.8 REAL** |

**MARGINAL VALUES MEASURED AGAINST THE SAME BASE DO NOT SUM** -- 10.5 and 14.6
make 25.1 against a measured 23.8 -- and they overlap for a nameable reason
rather than an unknown one: the reorder puts Heroic Strike above four entries
it used to sit below, so part of what raising its floor buys is the same part
the reorder would otherwise have cost.

**AND EACH HALF ALONE PRINTS `noise`, WHICH IS A STATEMENT ABOUT VARIANCE AND
NOT ABOUT WHETHER ANYTHING HAPPENED.** 2H Arms' own interval is about +/-9, so
+10.5 and +14.6 sit on its edge while their sum does not. The verdict is the
right default and the per-half figures are still what they are.

## The three things that moved in the list, and why two had to move together

| | from | to |
| --- | --- | --- |
| **Heroic Strike** | below Sunder Armor, floor 75 | above it, floor **90** |
| **Overpower** | above Sunder Armor | below it |
| **Slam** | LAST | above Mortal Strike |

**THE THRESHOLD AND THE POSITION ARE ONE CHANGE.** Heroic Strike now sits above
Sunder Armor, Mortal Strike, Rend and Slam; an ungated entry there would be a
FLOOR under all four. What stops it being one is 90 out of a cap of 100 --
which leaves a whole Mortal Strike's thirty unaffordable to it, so the entry
can only ever spend rage none of the four could have reached. **It is the
highest floor in the project**, against the Berserker list's 42 and the tank's
26, and it has to be.

**SLAM'S GATE IS UNCHANGED AND IS WHAT MAKES THE NEW POSITION AFFORDABLE.** It
only fires with more than a second of swing timer left, so it is refused
outright in the window where it would cost a swing. Above Mortal Strike without
that gate would be an Arms warrior trading its hardest hit for a cast.

## One test gave way, and it was the right one

`aplFormat.test.ts` asserted **"Mortal Strike before Slam"** -- a ROTATION
DECISION pinned in a file about how a panel renders -- and it failed the day the
owner put Slam above Mortal Strike. **The decision changed owner; the panel did
not change at all.**

It reads the entries off the list now and asserts the panel draws them in the
list's OWN order, whatever that order is. **And it splits on `apl-rank` rather
than comparing positions in one string**, because an ability name also occurs
inside CONDITIONS -- the Sunder Armor entry names its own aura and three
entries name a stance they also cast, so the old shape would have been
comparing a condition against a heading.

**THE REPLACEMENT PINS THE OWNER'S ORDER TOO, IN THE RIGHT FILE.**
`armsRotation.test.ts` writes all 24 entries out by hand, the way
`protectionRotation.test.ts` already does for the tank list -- so the owner
respecifying it again FAILS, which is how that gets noticed rather than merged
as an accident.

## What is left

- **SEVENTEEN LISTS**, which is the rest of the ask. All five Rogue profiles are
  done and the class is finished.
- **THE HEMO DAGGER SUBTLETY TREE IS A READING RATHER THAN A STATEMENT.** The
  owner's panel shows Improved Ambush at 0/3 against the 3/3 kept here, with a
  stated total of 31 either way; asked which three talents moved, they chose to
  keep the tree. **If that row's figure ever looks wrong, this is the first
  thing to re-ask** -- and a build URL through `decode_talent_build.mjs` settles
  it in one command.
- **ITS EVISCERATE FIRES 0.2 TIMES A FIGHT**, which is the tightest gate in the
  project that is not zero: exactly five points AND four seconds of each of two
  effects. It is the owner's and it DOES fire, which is the distinction that
  got Eviscerate removed from the Venom list and then put back -- but it is the
  entry to watch.
- **EIGHTEEN LISTS WAS THE COUNT BEFORE THIS ROUND.** All four Rogue lists are
  done; round six also ADDED one, so the denominator moved for the first time.
- **THE COMBAT ROGUE'S FIVE-POINT EVISCERATE MEASURED +15.3**, which is the
  opposite of what the old sweep predicted -- it had five as the WORST cell,
  16.3 below the peak at two. The sweep predates the benchmark gear, the
  racials and Hack and Slash paying this build its off-hand dagger. **A sweep
  is true of the build it was run on**, and this is the second time that has
  been the operative fact in this series.
- ~~**THE HEMO ROGUE MOVED ON NOBODY'S INSTRUCTION**~~ **CLOSED IN ROUND SEVEN
  BY THE OWNER RATHER THAN BY US.** It moved +10.4 because `ROGUE_HEMO` WAS
  `...ROGUE_RUPTURE.entries.filter(...)` and inherited four changes it had
  never been given. It has its own numbers now and is its own list: the
  derivation was right while the two lists agreed on every number, and **a
  derivation that has to override four of eleven entries is a copy with extra
  steps**.
- **TWENTY-ONE LISTS WAS THE COUNT BEFORE THIS ROUND.** 2H Arms was the first,
  DW Fury the second, Prot Warr the third, Venom the fourth; round four was a
  TALENT rather than a list, so the count did not move there. **Re-count this
  against the table at the top of this section rather than decrementing it** --
  which is the rule this file applies to every other derived figure, and the
  two places are a commit apart.
- **WHETHER THE PANEL SHOULD DROP OR FLAG A NOTE WHOSE CONDITION WAS EDITED.**
  The owner's own Venom screenshot shows a gate of 10 under a note saying 20.
  The stock lists cannot disagree with themselves; a hand-edited entry can.
- **THE OTHER THREE ROGUE LISTS**, and with them whether the Thistle Tea gate
  of ten is this list's or the archetype's. Four of five would still not be a
  row: the Cat Druid drinks it too.
- **WHETHER WEAPONMASTER READS THE SAME WAY AS HACK AND SLASH**, which is a
  question for the owner and not an engine gap: the capability exists and the
  reason on the talent names it. It moves no figure today.
- **WHETHER TWO QUALIFYING WEAPONS PAY A CLAUSE TWICE.** Implemented as once,
  which is the conservative reading of "global"; no preset can tell the
  difference.
- **THE MID-FIGHT CONSUMABLE'S POSITION IN A TANK LIST IS A POLICY, NOT A
  MEASURED GAIN.** The owner moved it off the bottom and it was already firing
  1.00 times a fight there, because a two minute cooldown in a sixty second
  fight is one cast wherever it sits. It would start to matter on a longer
  fight; nothing here runs one.
- **NEW PROFILES**, which the owner named as the work after the 25.
- **THE TIMELINE HAS NO AVERAGE VIEW** and deliberately does not; whether a
  per-lane figure pooled across the batch belongs beside each row -- uptime
  already is, on the Results page -- is an open question rather than an
  omission.
- **THE CAST LANE DRAWS A CHANNEL AS A TICK**, because a cast happens AT a
  moment and its length shows in the aura section instead. Right for every
  channel in the project today, and worth revisiting if one ever has no aura.

---

# THE GEAR PANEL, IN FIVE ROUNDS — READ THEM AS ONE

**ONE PIECE OF WORK IN FIVE COMMITS**, and the five headers below are its
rounds. The thing worth carrying out of it is the SHAPE: **the first round
built a feature and moved no figure at all; the next four were the owner
reading the result and sending it back.** That is the pattern this file already
records for the racials and for a patch, arriving a third time.

| | what it was | mean | PR |
| --- | --- | --- | --- |
| 1 | the Gear panel as a **character planner** -- item cards, a class filter, value sorting, the four test sets | **no figure moved**; all 75 hashes identical | [#243](https://github.com/Donz-Dev/SimForever/pull/243) |
| 2 | six tweaks, **aimed at Forever's own items** instead of at a target | 719.6 -> **736.1** | [#244](https://github.com/Donz-Dev/SimForever/pull/244) |
| 3 | a hit rating **paid for out of crit**, not out of spell power | 736.1 -> **737.3** | [#245](https://github.com/Donz-Dev/SimForever/pull/245) |
| 4 | **twelve movements** on the template gear | 737.3 -> **748.4** | [#246](https://github.com/Donz-Dev/SimForever/pull/246) |
| 5 | a dual-wielder applies the **weapon effect twice** | 748.4 -> **752.7** | [#247](https://github.com/Donz-Dev/SimForever/pull/247) |

**THE HEADERS BELOW RUN NEWEST FIRST**, so they are round 5, then 4, 3, 2, 1 --
the table above is in the order the work happened and the file is in the order
this one always is. Each header's figures belong to ITS round and say so.

**THE MEAN AT THE END OF THIS ROUND WAS 752.7**, and the sentence under the
baseline table is the only place that is ever current. Every figure in this
section belongs to the round it sits under.

**THIS PARAGRAPH READ "THE LIVE MEAN IS 752.7" UNTIL THE APL ROUND ABOVE IT
MOVED ONE ROW**, which is worth leaving as a worked example of its own warning:
a sentence claiming to be current is only current while nothing newer exists,
and that is every section header in this file eventually. **Name the round a
figure belongs to and it never needs editing.**

**AND A SIXTH ROW CAN BE ADDED**, which is the point of its being a table.

## What the owner contributed that no tool here did

**THE PROFICIENCY TABLE, ALL 27 COLUMNS, IN ONE MESSAGE.** Nothing in the six
data sources states one, so the choice was between borrowing Classic's behind a
`PLACEHOLDER_` name and asking. **Three rows disagree with Classic** -- a Rogue
may use a one-handed axe, a Druid may NOT use a dagger, a Hunter may use a
two-handed axe and no mace -- so a borrowed table would have been wrong in
**both directions on the one class the owner used as their example.**

**AND THEN FOUR READINGS OF THE RESULT, each of which found something no check
here was asking about:**

| what they read | what it was |
| --- | --- |
| the Gear panel's item list | 895 items carry a `Classes:` line that nothing parsed |
| the character sheet | two trinkets carrying 68 crit between them |
| "I was expecting 750 spell power" | a caster set below an ORDINARY real one |
| four B55 items | `+25 Hit Rating, +2 Stamina, +1 Spell Power` |

**EVERY ONE OF THOSE PASSED `item_budget.ts`**, which asks whether an item fits
its budget. All of them did. **Its arithmetic is about TOTALS and every one of
these faults was about SHAPE**, which is why `benchmark_stat_report.ts` and
`real_set_shape.ts` exist now.

## The question that changed, and the tool it produced

The ask was "shoot for 750 spell power". Then: **"if 750 isn't reachable that's
fine. I want it to be realistic."**

That turned an unverifiable target into a measurable one.
`tools/real_set_shape.ts` is the answer -- the per-slot distribution of a stat
over REAL Forever items a class can equip, PvP excluded, summed across a set:

| item level 60-70 | median | p75 | best in database |
| --- | --- | --- | --- |
| crit rating, a warrior set | 168 | 182 | **210** |
| spell power, a mage set | 290 | 345 | **397** |

Against a benchmark carrying **295 crit and 205 spell power** -- 40% above the
best real set on one and below an ordinary one on the other. Both symptoms,
arrived at independently.

**THE MEDIAN IS THE ANSWER AND THE MAXIMUM IS NOT.** A first pass took the
richest item in every slot and got 503, a ceiling no character wears --
cherry-picked across factions, raids and professions.

**AND A BENCHMARK SET SITS BETWEEN p75 AND BEST**, which is the one judgement in
the whole thread: these sets exist so two builds can be compared at one item
level, so each should be a STRONG set of that level and must not exceed what
the game contains.

## Three times the owner's words had to be bounded or widened by the data

**THIS IS THE REUSABLE PART.** In each case the owner said which DIRECTION and
Forever's own items said HOW FAR -- and taking either alone would have been
wrong.

| the ruling | read literally | what the items said |
| --- | --- | --- |
| "pull from crit rating to get more hit rating" | crit drained to **74** against a real mage set's 154, spell power above the richest in the database | bound it at 40%: crit **153** |
| "the eight **plate** armor class slots shouldn't have both strength and attack power" | plate only | **0 of 1,374** armour pieces carry both, every class -- so it is all four |
| the same, dropping the later stat | the Rogue's Strength **zero across the set** | both appear on real sets; the slots take turns, earlier preference three in four |

**AND ONE WHERE TWO OF THE OWNER'S OWN STATEMENTS DISAGREE AND THE LATER ONE
WINS.** "A maximum of 28 crit rating across both trinkets" was said of the DPS
archetypes; "half item budget on crit" is a later, more specific instruction
about the tanks, and half a trinket's budget is ~21 at E65 -- so **a tank pair
is 42**. The test exempts exactly the three templates that declare their own
pair rather than widening its assertion, and the stat report prints the figure
so the owner can see what their two sentences add up to.

## What each round's containment check was

**THE CHECK IS DIFFERENT EACH TIME, AND PICKING THE RIGHT ONE IS THE SKILL.**

| round | the check | why that one |
| --- | --- | --- |
| 1 | all **75 combat-log hashes and event counts** unchanged | a UI feature must move no figure, and event counts catch a change that costs only TIME |
| 3 | **24 of 25 rows noise** | crit and spell power are worth about the same, so moving budget between them is about SHAPE |
| 4 | **three rows 0.0 to the decimal** | two are in none of the twelve lists; the third's only change grants stamina, which a caster's fight never reads |
| 5 | **exactly seven rows moved** | the change is keyed on one combat style and the set with that style is the set that moved |

## Two bugs the suite and a report caught, where the DPS could not

- **28 crit overspent a B55 trinket by 20%** -- caught by `benchmarkGear.test.ts`'s
  budget assertion, because a maximum is not a fixed amount.
- **A ternary handed every tank two BLANK trinkets.** The set lost 68 stamina
  while the DPS moved less than its interval; `benchmark_stat_report.ts` is what
  showed it. **A figure inside the interval cannot say which half moved.**

## And two tests that were testing the gear rather than the rule

Both are the shape this file already documents, found again:

- **`shieldBlock.test.ts` asserted the shield's flat 5% block IS the
  character's**, which held only while the Protection template bought no Block
  Rating. The repair is the documented one: read the set's contribution off the
  SET and assert the arithmetic.
- **`lastStand.test.ts` required a Last Stand to fade on a death inside ONE
  seeded log**, written when its own comment said "a fight with twenty deaths".
  The gear has the tank at about **six** now, so the coincidence stopped
  landing. **Deterministic under a seed is not the same as a boundary**; it
  counts over five seeds.

## What is left, and it is the same three every round

- **177 SET PIECES ARE CLASS-RESTRICTED BY NEITHER SOURCE**, the T3 sets among
  them. All 184 that Forever's capture leaves unrestricted were asked of
  Wowhead and seven -- the Bonescythe set -- had a line; the rest carry none in
  Classic's own data either. **Nothing infers a class from a set bonus**,
  because a good fraction of the 177 are crafted and reputation sets with no
  restriction at all. A ruling plus about thirty set names would close it.
- **E85's SPELL POWER RUNS ABOVE THE BEST REAL ITEM-LEVEL-80-92 SET**, 555
  against 491. Its crit came into range in round four (236 against 252). It is
  the one set that exceeds what the game contains, recorded rather than tuned.
- **THE DEFAULT STAT VALUATION IS STILL EVERY PREFERRED STAT AT 1.00**, the
  owner's instruction until they supply a table. **What it costs is that their
  preference ORDER is discarded** -- a build values its first and fifth
  preference identically -- and the order is already in
  `BenchmarkTemplate.preferred`, so a real table is one record.

---

# A DUAL-WIELDER APPLIES THE WEAPON EFFECT TWICE

**THE OWNER'S RULING**, read off the Consumables panel: "Dual wielding needs to
trigger a second weapon effect consumable for an additional +2% melee crit
chance."

**MEAN 748.4 -> 752.7, AND EXACTLY SEVEN ROWS MOVED** -- the seven dual-wield
profiles, by +10.7 to +23.8, mean **+15.2**. **The other eighteen are 0.0 to the
decimal.** 3,341 tests.

| | |
| --- | --- |
| DW Fury | +23.8 |
| LW Melee | +19.5 |
| Hawk Melee | +16.7 |
| Combat | +13.5 |
| Hemo | +11.6 |
| Rupture | +10.8 |
| Venom | +10.7 |

**THAT IS THE CONTAINMENT CHECK AND IT IS UNUSUALLY SHARP**: the change is
keyed on one combat style, and the set of profiles with that style is exactly
the set that moved. Nothing else could have.

## It is a property of the ROW, not of the consumable

`ConsumableCategory.perWeapon` -- declared on Weapon Effect and nowhere else.
A weapon effect is COATED ONTO A WEAPON rather than drunk, so somebody holding
two buys two; a flask, an elixir and a piece of food are worth the same
whatever is in the character's hands.

**DECLARED RATHER THAN DERIVED**, and `consumables.test.ts` pins that it is the
only row carrying the flag, so a second one has to be deliberate.

## The whole consumable is applied twice, not just its crit

A second weapon effect is a second stone on a second weapon, so whatever it
grants it grants again. **The caster option is what makes that checkable**: it
carries `+1% Spell Crit Chance & +36 Spell Power`, and the test asserts both
double. If the owner's table ever gives the row something besides crit, it
already behaves.

## Two weapons means two that SWING

`weaponEffectCount` reads `offHand: 'weapon'` from `combatStyles.ts`, which is
the one rule that says a second weapon swings.

**A SHIELD IS NOT A SECOND COATED WEAPON**, and neither is a held off-hand item
nor the two-hander a Hunter carries as a stat stick. Reading "two hands full"
instead would have paid a Protection warrior for coating its shield -- a bigger
number and no error, which is this project's commonest shape of wrong.

## The selection is still one choice

The panel offers one weapon effect and the character applies it to whatever it
is holding. **Asking somebody to pick the same stone twice would be a control
whose only correct answer is the one already above it** -- so the row is
unchanged and a line under it says so, shown ONLY to a build that dual wields,
because a build holding one weapon needs no explanation.

# TWELVE MOVEMENTS ON THE TEMPLATE GEAR

**ROUND FOUR, AND THE FIRST WHERE THE DATA OVERRULED THE OWNER'S OWN SCOPE.**
Twelve asks: a stat pair that never appears on one item, spell power for the two
Paladin shield builds, the block line's position on a card, tank trinkets,
thirteen stat sticks, five enchant defaults and two new enchants.

**MEAN 737.3 -> 748.4**, 14 rows up, 8 down and **3 unchanged to the decimal** --
casters **+24.1**, tanks **+29.7**, physical non-tank **-0.3**. 3,334 tests.

| | what | where |
| --- | --- | --- |
| 1 | no armour piece carries Strength AND Attack Power | `EXCLUSIVE_PAIRS` |
| 2 | Shockadin and Prot Pally: spell power weapons and gear | the templates |
| 3 | a shield's block value under its armour on the card | `makeItem` |
| 4 | tank trinkets mixed | `TrinketPlan` |
| 5 | ranged stat sticks for three Warriors and four Rogues | `StatStick` |
| 6 | wand stat sticks for six casters | `StatStick` |
| 7 | relic slots left empty | nothing to do |
| 8-12 | five enchant defaults, three new enchants | `foreverEnchants`, `presetEnchants` |

**A ROW CAN BE ADDED TO THAT TABLE.**

## The data said the rule was wider than the owner thought

"The eight **plate** armor class item slots shouldn't have BOTH strength and
attack power, this should likely only affect the DPS warrior profiles."

Across **all 1,374 real armour pieces on file, not one carries both**:

| | pieces | with Strength | with Attack Power | BOTH |
| --- | --- | --- | --- | --- |
| Plate | 304 | 218 | 1 | **0** |
| Mail | 328 | 70 | 40 | **0** |
| Leather | 363 | 123 | 33 | **0** |
| Cloth | 379 | 0 | 0 | **0** |

So it is every armour class, and the owner's "likely only the DPS warriors" was
a guess about which PROFILES would move rather than about the rule's scope.

**AND AGILITY AND ATTACK POWER ARE NOT A PAIR**, which is why `EXCLUSIVE_PAIRS`
is a list of one rather than a blanket "no two offensive stats": 8 leather and
21 mail pieces carry both, so excluding that combination would be inventing a
rule the data contradicts.

## And then the rule collided with an older one

Dropping the later member outright is the obvious reading, and it took the
**Rogue's Strength to zero across the whole set** -- which is the owner's own
earlier rule that a preferred stat going to nothing "is unrealistic to how
items are actually designed".

**THE TWO ARE ABOUT DIFFERENT SCOPES AND BOTH CAN HOLD**: the pair is about one
ITEM and the zero check is about the SET. So the slots take turns --
`EXCLUSIVE_PAIR_PERIOD`, the earlier preference on three slots in four, which is
the shape the real items have:

    a warrior's plate     130 pieces with Strength    14 with Attack Power
    a rogue's leather      33                         22

## The owner's two trinket statements disagree, and the later one wins

"A maximum of 28 crit rating across both trinkets" was said of the DPS
archetypes. "1 with half item budget on stamina / half on crit" is a later and
more specific instruction about the tanks -- and half a trinket's budget is
about 21 rating at E65, so a tank pair comes to **42**.

The later and more specific statement wins, which is this project's standing
rule. **The figure is printed by `benchmark_stat_report.ts`** so the owner can
see what their two sentences add up to, and `benchmarkShape.test.ts` exempts
exactly the three templates that declare their own pair rather than widening
the assertion.

## Thirteen stat sticks, and nothing had to be added for them

Only the `ranged` STYLE fires a ranged weapon -- `rangedSlot: 'required'`, which
is the four Hunters -- so for the three Warriors, four Rogues and six casters
the item contributes its stats and no attacks. Checked rather than assumed: all
four spot-checked profiles report **no ranged damage row at all**.

**AND THE SIX WAND PROFILES ARE EXACTLY THE THREE CLASSES WITH THE WAND
PROFICIENCY.** Warlock, Priest and Mage; the Moonkin and the Elemental Shaman
are absent from the owner's list and are also absent from the `wand` column of
their own table.

**THE ROGUE'S HIT HAD TO BE RESERVED RATHER THAN COMPETED FOR.** Adding the
ranged slot to the hit spread did nothing, because `spreadRating` fills the
largest headroom first and the ranged slot is the SMALLEST budget in the set --
so the armour absorbed every point and the bow came out with agility and no
hit, which is half of what was asked for. It is taken off the template's total,
not added to it, so the owner's hit figure is still absolute.

## Three unchanged rows are the containment check

**LW Melee, Hawk Melee and Ele Shaman moved 0.0 to the decimal.** The first two
are in none of the owner's twelve lists -- item 12 names only LW Ranged and BM
Hunter -- and the Elemental Shaman's only change is a shield enchant granting
**stamina**, which moves a caster's maximum health and nothing a fight reads.
Bit-identical is the right answer for all three.

## What moved, and why

| | mean | what did it |
| --- | --- | --- |
| tanks | **+29.7** | trinket crit and attack power where there was stamina only |
| casters | **+24.1** | the +65 staff enchant, replacing a +30 |
| physical non-tank | **-0.3** | the Strength/Attack Power exclusivity, roughly cancelling the stat stick |

Caster spell power on the character is now **724-773**, which lands on the
owner's original 750 instinct for the first time.

## What is left

- the **177** set pieces restricted by neither source, T3 among them;
- **E85's spell power above the best real item-level-80-92 set**;
- the **default stat valuation**, still every preferred stat at 1.00;
- **the relic slots stay empty**, which is the owner's instruction rather than
  an omission: "Druid, Paladin, and Shaman have very specific 'relic' slots
  that are currently unknown and can be left empty as they are now."

# A HIT RATING IS PAID FOR OUT OF CRIT, AND THE DPS DID NOT MOVE

**ROUND THREE OF THE GEAR PANEL, AND THE FIRST WHOSE POINT IS NOT A NUMBER.**
The owner read four items and found the rule: "The spell power has been reduced
down to +1 spell power on some B55 items in order to account for +25 hit
rating. I think it's pulling from the wrong pull so-to-speak. Instead of pull
from spell power to get more hit rating, it should be pull from crit rating to
get more hit rating."

**MEAN 736.1 -> 737.3, AND 24 OF 25 ROWS ARE NOISE.** That is the finding
rather than a disappointment: the change moves budget between crit and spell
power, which are worth about the same, so **what it fixes is the SHAPE of an
item and it costs nothing in DPS.** 3,332 tests.

## One symptom, two causes, and the rule only addresses one

Four slots of every B55 caster set read:

    +25 Hit Rating | +2 Stamina | +1 Spell Power

| | the cause | the fix |
| --- | --- | --- |
| 1 | the rating's cost came off the TOTAL before the shares divided anything, so every stat shrank together -- and at the 3/2 power a slot with little left rounds each share to 0 or 1 | `RATING_DONORS` |
| 2 | **25 hit costs 97% of a B55 medium slot whatever it is taken from** | `RATING_BUDGET_SHARE` |

**THE SECOND IS WHY THE OWNER'S RULE ALONE WOULD NOT HAVE WORKED**, and it is
worth naming: those four slots carried NO CRIT AT ALL, so there was nothing for
the new rule to take. Funding from crit fixes a slot that has crit to give.

**AND THE CHUNK SIZE WAS A CIRCLE.** Hit was spread in one uniform chunk --
the smallest of 10/15/20/25 that fit the total into the slot list -- and the
slot list had itself been filtered by affordability. A set whose small slots
could not afford 25 therefore had FEWER eligible slots and so a BIGGER chunk.
It closed on 25 for every one of them. Each slot gets what it can afford now,
in steps of five, largest headroom first.

## The literal reading over-corrects, and the measurement says by how much

Draining crit without limit is the rule read literally. Measured at E65 against
the real item-level-60-70 population a mage set occupies -- **crit 154, spell
power 290/345/397**:

| donor share | caster crit | caster gear spell power |
| --- | --- | --- |
| 0% (no rule) | 181 | 384 |
| **40% (chosen)** | **153** | **401** |
| 70% | 124 | 415 |
| 100% (literal) | **74** | 427 |

**THE LITERAL READING TRADES ONE UNREALISTIC NUMBER FOR TWO**: crit far below
what a real set carries, and spell power above the richest set in the database.
`RATING_DONOR_SHARE` is the bound, and 40% lands caster crit at **153 against a
real mage set's 154**.

**SO THE RULE WAS IMPLEMENTED AND THEN BOUNDED BY MEASUREMENT**, which is the
shape to copy: the owner's rule said which direction, and Forever's own items
said how far.

## Where the sets sit now

| E65 | benchmark | real (median / p75 / best) |
| --- | --- | --- |
| crit, melee | 156-183 | 168 / 182 / 210 |
| crit, caster | 137-153 | 154 |
| spell power, caster | 396-401 | 290 / 345 / 397 |

Caster spell power on the CHARACTER is **722-727**, against the owner's
original 750 instinct -- reached by aiming at the items rather than at the
figure.

**AND THE `+1` LINES ARE GONE.** Ten lines of 2 or less remain across all 1,560
generated items, every one of them a fifth-preference stat on the smallest slot
of the cheapest set.

## A test that was relaxed rather than a parameter that was tuned

The caster set measures **401 spell power against a `best` of 397**, and the
assertion's upper bound was widened by 5% instead.

**THAT IS A STATEMENT ABOUT THE EVIDENCE.** `best` is the richest single item
in each slot summed, over per-slot populations of **3 to 15 items** -- the
maximum of a handful is not a ceiling the way a median over hundreds is a
centre. Moving a generator parameter to clear it by 1% would be fitting to
noise. What the assertion is for is the order of magnitude: spell power was
205, below an ORDINARY real set, and that is the failure worth catching.

## What is left

Unchanged from the last round, and none of it is new:

- the **177** set pieces restricted by neither source, the T3 sets among them;
- **E85 still runs above the best real item-level-80-92 set** -- crit is now in
  range at 236 against 252, but spell power is 555 against 491;
- the **default stat valuation** is still every preferred stat at 1.00.

# THE TEMPLATE GEAR, AIMED AT FOREVER'S OWN ITEMS INSTEAD OF AT A TARGET

**THE GEAR PANEL'S SECOND ROUND, AND IT IS THE ONE THAT MOVED FIGURES.** The
first built the planner and moved nothing; this one is six owner tweaks to the
benchmark sets, two of which are about what a set CARRIES.

**MEAN 719.6 -> 736.1, 19 rows up and 6 down**, and the split is the whole
story: **casters +42.7**, physical non-tank +5.2, the three tanks **-0.5**. 3,324
tests, typecheck and build clean.

| | the owner's ask | what it took |
| --- | --- | --- |
| 1 | icons instead of question marks | a table sourced FROM real items |
| 2 | "Seal Twist Ret (E65)", and the tooltip in their order | a rewritten `makeItem`, plus a `Classes:` line |
| 3 | crit is too prevalent, trinkets worst | `SHARE_WEIGHT` and two trinket archetypes |
| 4 | class-restricted items are being offered | 895 items carry a line nothing read |
| 5 | "Hit Rating", not "Hit Chance" | one label |
| 6 | caster spell power is way down | the other half of 3 |

**A ROW CAN BE ADDED TO THAT TABLE.**

## The question changed, and that is what made it answerable

The ask was "shoot for 750 spell power". Then: **"if 750 isn't reachable that's
fine. I want it to be realistic."**

That turned an unverifiable target into a measurable one, and
`tools/real_set_shape.ts` is what answers it -- the per-slot distribution of a
stat across REAL Forever items a class can equip, PvP excluded, summed over a
full set:

| item level 60-70 | median | p75 | best in database |
| --- | --- | --- | --- |
| crit rating, a warrior set | 168 | 182 | **210** |
| spell power, a mage set | 290 | 345 | **397** |

**Against a benchmark set carrying 295 crit and 205 spell power.** So crit sat
**40% above the best real set in the game** and spell power sat **below an
ordinary one** -- which is exactly the pair of symptoms reported, arrived at
independently.

**A BENCHMARK SET SHOULD SIT BETWEEN p75 AND BEST**, which is the one judgement
in this round: these sets exist so two builds can be compared at one item
level, so each should be a STRONG set of that level and must not exceed what
the game contains. After: **crit 185, spell power 376**.

**AND THE MEDIAN IS THE ANSWER WHERE THE MAXIMUM IS NOT.** A first pass took
the single richest spell-power item in every slot and got 503 -- a ceiling no
character wears, cherry-picked across factions, raids and professions. The
median over the items that carry the stat at all is what a piece of that kind
looks like.

## Real trinkets carry nothing, which is the opposite of the guess

Of the **35 real trinkets between item level 58 and 72, all 35 carry a proc or
an on-use effect and 6 carry any engine stat** -- dodge, on tank trinkets. A
real trinket's contribution is an effect this engine cannot model.

So the benchmark trinkets were the worst thing in a set for a reason nothing
would have flagged: a trinket is a ONE-stat slot, four of the five preference
lists open with Crit, and the trinket multiplier made the pair **the two
largest crit sources in the whole set -- 68 rating, 4.9% crit, from two items.**

**THE OWNER'S RULING IS A PAIR OF ARCHETYPES**: "it's expected to see trinkets
that have 28 crit rating + a scaling spell power / attack power value. OR pure
spell power trinkets", with "a maximum of 28 crit rating (2%) across both
trinkets". So the first is the crit-plus-scaling one, the second is pure, and
the pair carries 28 between them.

**A MAXIMUM IS NOT A FIXED AMOUNT**, which the B55 sets proved: a blue
item-level-55 trinket has a budget of 23.3 points and 28 crit costs 28 of them,
so the flat figure put the item **20% over its own budget** AND left nothing
for the scaling half -- turning the archetype back into the pure crit trinket it
replaced. `trinketCrit` clamps it the way `staminaFloor` already clamps, and
only B55 carries less.

## 895 items name a class, and nothing read the line

The proficiency table answers "may this class wear leather". It cannot answer
"may a Warrior wear the ROGUE tier set", which is leather and says so on its own
tooltip -- and **895 of the 1,946 items on file carry a `Classes:` line**,
nearly half the database. Thirteen distinct wordings, all comma-separated class
names; **no item carries a `Races:` line**, which was checked rather than
assumed.

It is parsed in `buildItem` and checked FIRST in `canEquip`. A Warrior's head
slot went from 132 items to 54.

**AND 184 SET PIECES LEAVE IT OUT, WHICH IS A SOURCE GAP AND IS FOR THE
OWNER.** Conqueror's Crown states "Classes: Warrior" and Bonescythe Helmet
states nothing -- checked in the raw capture JSON, so it is not an importer bug.
The T2.5 sets are the ones affected and they are the highest item level, so they
sort to the TOP of a Warrior's list, which is what was seen.

**NOTHING INFERS A CLASS FROM A SET BONUS**, and that is deliberate: Devilsaur
Armor, the Dragon Mail sets and the Highlander's/Defiler's PvP sets are crafted
and reputation sets with no class restriction at all, so "has a set bonus
therefore belongs to a class" is wrong for a good fraction of the 184. The count
is pinned in `proficiency.test.ts` instead.

## What the measurement said, and the containment check

| | n | mean delta |
| --- | --- | --- |
| casters | 8 | **+42.7** |
| physical non-tank | 14 | +5.2 |
| **tanks** | 3 | **-0.5** |

**THE TANKS NOT MOVING IS THE CHECK, NOT A RESULT.** Their preference lists name
no Crit and no damage stat, so `SHARE_WEIGHT` and the trinket archetypes cannot
reach them -- and the one thing that does reach them, the tail rotation, buys
Block and Defense they were not getting. -0.5 over three profiles says the two
cancelled rather than that nothing happened, which `tools/benchmark_stat_report.ts`
confirms directly: Prot Warr's stamina is unchanged at 324.

**AND A BUG WAS CAUGHT BY EXACTLY THAT.** The first version of the trinket
branch passed an EMPTY share list to a build with no Crit and no damage stat, so
all three tanks and the Bear got two blank trinkets and the set silently lost 68
stamina. The DPS moved by less than the interval; the stat report moved by 68.

## The five bugs this round, and how each was found

| what | found by |
| --- | --- |
| 895 items' class line read by nothing | the owner, using the panel |
| trinkets carrying 68 crit between them | the owner, reading the character sheet |
| caster spell power below an ordinary real set | the owner, expecting 750 |
| 28 crit overspending a B55 trinket by 20% | `benchmarkGear.test.ts`'s budget assertion |
| two blank trinkets on every tank | `benchmark_stat_report.ts`, not the DPS |

**THREE OF THE FIVE WERE THE OWNER READING THE APP**, which is now the fourth
round running. The two the suite caught were both caught by an assertion that
exists because something earlier went wrong the same way -- the budget check and
the stat report.

## What is left

- **THE 184 UNRESTRICTED SET PIECES** need either a ruling or a re-pull. Forty-
  eight set names, of which maybe thirty are genuine class sets.
- **E85 RUNS ~8% ABOVE THE BEST REAL ITEM LEVEL 80-92 SET** -- crit 271 against
  252, spell power 531 against 491. Arguably right for the top benchmark, and
  recorded rather than tuned.
- **THE DEFAULT STAT VALUATION IS STILL EVERY PREFERRED STAT AT 1.00**, pending
  the owner's table.

# THE GEAR PANEL IS A CHARACTER PLANNER, AND NOT ONE FIGURE MOVED

**THE THIRD UI PASS.** The owner asked for six things on the Gear panel: move
it above Talents, lay it out as a character planner without the model and
without the cosmetic slots, show a WoW item card on hover, filter each slot to
what the class can equip, sort by what the build values, and expose the four
test sets — with the enchant-loss bug on a test-set swap fixed. All six are in.

**ALL 75 COMBAT-LOG HASHES AND EVENT COUNTS ARE UNCHANGED**, which is the
containment check: nothing in this round can move a published figure, and the
event counts cover the "a change that costs only time" case the interruptible
channel taught. 3,229 tests pass, up from 3,101; typecheck and build clean.

| | what | state |
| --- | --- | --- |
| this round | the planner, the proficiency table, the valuation, format 14 | **this branch** |

**A ROW CAN BE ADDED TO THAT TABLE.** This file's own rule: a feature arrives
in waves, and the racials took four rounds with two of them the owner's.

## What the owner supplied, and what it was worth

**THE PROFICIENCY TABLE, ALL 27 COLUMNS FOR ALL NINE CLASSES, IN ONE MESSAGE.**
Nothing in the six data sources states one — not the spellbook captures, not
`talentsforever.com`, not `foreverchanges.pro` — so the choice was between
borrowing Classic's behind a `PLACEHOLDER_` name and asking. **Three rows
disagree with Classic:**

| | Forever | Classic |
| --- | --- | --- |
| Rogue, one-handed axe | **may** | may not, until Burning Crusade |
| Druid, dagger | **may not** | may |
| Hunter, two-handed axe and polearm | **may**, and no mace of either size | the same |

**SO A BORROWED TABLE WOULD HAVE BEEN WRONG IN BOTH DIRECTIONS ON THE ONE CLASS
THE OWNER USED AS THEIR EXAMPLE** — "If I'm a Rogue then I can't equip Plate
gear, Mail Gear, or two handed weapons". Asking beat inferring again, and it
cost one question.

**AND THE VALUATION: "I'll provide the stat valuation after this feature is
fully implemented. For now just make all the preferred stats valued at 1.00."**
So no magnitude is invented anywhere. Which stats a build prefers is the
owner's own `BenchmarkTemplate.preferred` column; the flat 1.00 is theirs too.
**What it costs, said plainly: at 1.00 each the ORDER they wrote is
discarded**, so the sort is "how much preferred stat is on this item" rather
than "how good is this item". One record away from being right.

## Four bugs, each hidden a different way

**THE FOUR TEST SETS DROPPED EVERY ENCHANT ON A SWAP.**
`benchmarkEquipmentFor` rebuilt each slot as `{ itemId }` and nothing else, so
pressing E65 and then E75 discarded the whole loadout — worth **+2.4 to +53.7
DPS a profile**. The buttons exist so one build can be compared at four item
levels, which is precisely the comparison this made wrong. **Silently**: an
unenchanted slot looks like a slot nobody enchanted, so there is no zero
anywhere and nothing to count. **The owner found it by using the app**, which
is the shape this file already records three times over.

**`scoreStats` PAID A MELEE BUILD FOR A RANGED-ONLY ATTACK POWER LINE.** The
owner's ruling is that a bare "+40 Attack Power" reaches BOTH pools, so 164
item lines set the two fields to the same number and pricing them independently
doubles every one. The rule is "the larger amount times the larger weight **of
the pools the item actually grants**" — and the first version dropped that last
clause, which is "Melee Attack Power NEVER reaches Ranged Attack Power" read
backwards. **Caught by a test written for the opposite case**, before it ever
rendered.

**THE ITEM CARD PRINTED "Item Level 65" TWICE FOR HALF THE DATABASE.** A
generated benchmark item writes an item-level line into its own tooltip and a
captured Forever item writes none. Found by looking at the rendered page in the
browser, not by any test — the same shape as the three bugs the owner found
using the app during the racials round.

**THE TEST SETS AND THE DEFAULT VALUATION BOTH HUNG OFF `character.name`.**
`BENCHMARK_TEMPLATES_BY_LABEL` joins on the name because `game` may not import
`profiles` and the name was the only thing both layers had — so renaming the
character took the four buttons away and, once the valuation existed, the
sorting with them. A preset stamps its template id on the profile now, and the
name join is the fallback for every file saved before it.

## A filter is the one kind of bug that leaves nothing behind

**AN ITEM A WRONG PROFICIENCY ROW EXCLUDES LOOKS EXACTLY LIKE AN ITEM THAT IS
NOT IN THE DATABASE.** No zero, no count, nothing on screen. So the filter is
built to be visible when it is wrong:

- **it defaults to permissive** — a word `proficiencyForItem` does not
  recognise returns `undefined` and the item is offered;
- the picker has a **"show items this class cannot use"** checkbox that greys
  them instead of hiding them, and an illegal row stays **clickable and
  hoverable** so its card can still explain it;
- **whatever is already equipped is always listed**, whatever the table says;
- and **all 25 presets wear only what their class may equip**, asserted per
  preset — which is the containment check that the table agrees with 25 builds
  the owner specified by hand.

**AND SOMETHING HAS TO ASK WHETHER THE FILTER EVER FIRES.** A permissive
default makes a typo in that switch a silent no-op across the whole database,
which is `isWeaponUseOf(attack, 'ranged')`'s failure exactly. The counts are
pinned: a Rogue has no two-hander at all, a Druid no ranged weapon, and each
relic reaches exactly the class whose column names it.

**THE CLOAK IS THE TRAP INSIDE THE TRAP.** All 44 cloaks carry the subclass
"Cloth" and every class wears one, so reading the subclass without asking which
SLOT it is for leaves eight classes with no back slot — and it would have
looked like a correct filter.

## What is in the profile now

**FORMAT 14**, two optional fields, **neither read by the engine**:
`statValuation` (what a point of each stat is worth, for SORTING gear) and
`benchmarkTemplateId`. Absent means "derive it" for both, so the migration
supplies a constant and no saved profile's result changes.

**THE UNIT IS THE STAT-WEIGHT RUN'S OWN UNIT**, deliberately: "per displayed
unit", with the two ratings in percentage points. That makes "Use for gear" a
COPY rather than a conversion — and a conversion is exactly where two tables
drift. The two live in layers that cannot import one another, so
`itemValue.test.ts` pins `unitsOf` against `WeightableStat.statPerUnit` for
every stat both name.

**IT MATTERS EVEN WITHOUT A RUN**, because the item parser is inconsistent
about ratings on purpose: `+14 Hit Rating` becomes `hitChance: 1.4` at parse
time and `+14 Critical Strike Rating` stays `critRating: 14`, because one has a
reader for the rating and the other does not. Scoring the engine stats raw
would make a point of crit worth ten times a point of hit for no reason anybody
chose.

## What is left

- **THE DEFAULT VALUATION DISCARDS THE OWNER'S PREFERENCE ORDER**, which is
  what was asked for until they supply a real table. `BenchmarkTemplate.preferred`
  already holds the order, in descending importance.
- **THE POISON AND WEAPON STONE ROWS ARE STILL `<select>`s** with no cards.
- **THE ENCHANT LIST IS FILTERED BY SLOT ONLY**, as it always was.
- **`docs/gear-planner.md`** is the feature's own document;
  `docs/handoff/gui.md` records what this pass changed about the shell.

# ITEMS: A BUDGET MODEL, FOREVER'S OWN DATA, AND A DATABASE WITH NO CLASSIC IN IT

**THIS SESSION REPLACED THE ITEM LAYER.** It began as a reading exercise -- how
are items generated -- and ended with the Classic and Season of Discovery
stand-ins deleted, 1,946 real Forever items in their place, four
budget-generated benchmark sets, and **eleven bugs that only real item data
could have exposed**.

**IT IS MERGED AND MEASURED.** 3,101 tests, typecheck and build clean, and all
25 profiles re-measured on the E65 set: the mean was **719.6** against 730.9,
with 11 rows up and 14 down.

**THAT FIGURE IS THIS ROUND'S AND THE TABLE HAS MOVED FIVE TIMES SINCE**, to
752.7 by way of the Gear panel's five rounds at the top of this file. The
baseline table is the record of what is CURRENT; this paragraph is the record
of what this commit did, and the two are supposed to differ.

| | what | state |
| --- | --- | --- |
| `c5900b0` | the itemization budget, verified; 1,673 Forever items; the rating table; `critRating` read by nothing | **merged** |
| `f985e55` (#240) | benchmark gear, the Attack Power ruling, 1,384 stranded spell power lines | **merged** |
| `3745ebc` (#241) | Forever's own items only, eleven bugs, 100 test repairs, three rebuilds of the baseline | **merged** |

**IT TOOK THREE MEASUREMENTS AND FOUR OWNER RULINGS**, which is this file's own
rule about a feature arriving in waves, with nothing but item data to blame:

| | what moved | mean |
| --- | --- | --- |
| 1 | every preset into the E65 set, with the parser bugs fixed | 730.9 -> **741.0** |
| — | the owner's slot-stat table (5/4/3/1 by slot), which buys the fifth preference | measured in round 2 |
| 2 | every armour piece carries stamina, at 12.5% of its slot | **734.1** |
| 3 | the owner's ruling that the share is 25% | **719.6** |

Plus two rulings that moved no figure: the Shockadin stays a 1H + shield build,
and Hemo keeps dual daggers.

**THE ELEVEN BUGS ARE THE PART WORTH READING**, because five were in code the
item swap did not touch, one was found by the owner reading the generated items,
and every one produced a plausible number. See **Eleven bugs, and how each one
hid** below.

## The budget, and four wrong answers to one question

An item's stats are bought out of a budget: `budget = qualityBase(ilvl) x
slotMultiplier`, spent at `budget^1.5 = sum((stat x cost)^1.5)`. It reproduces
real items well -- **122 of 133 non-weapon items on file within 90-110%** -- and
`docs/itemization.md` is the whole write-up.

**THE INTERESTING PART IS THE SEQUENCE OF WRONG ANSWERS**, because every one of
them was confidently stated and each was corrected by the owner's next question:

| | answer | what was wrong |
| --- | --- | --- |
| 1 | "not PvP-specific, it's Forever's budget" | two items, one from each population |
| 2 | "both: 11 points general, 5 PvP" | **no baseline** -- 100% was assumed to be the target |
| 3 | "PvP only, about 6 points" | one uncertain parameter, and PvP gear is the part most exposed to it |
| 4 | "spell power is 9% cheap" | **two populations in one bucket** -- it was the healing items |

The answer is that **Forever changed nothing**: stamina, spell power and
healing were each suspected and none of them moved. Classic's own epics and
Forever's non-PvP gear price at **93.2% and 93.3%** through the same model.

**WHAT FIXED IT WAS A CONTROL GROUP, NOT MORE DATA.** 487 of the 653 changed
items differ from Classic only in WORDING, so pricing them measures CLASSIC's
itemization through the same model with the same blind spots. Three rounds of
analysis had compared against 100%, which is not a number this model reaches
even on Classic.

**AND THE BLUES CONFIRMED IT ON A POPULATION THAT FITTED NOTHING.** 611 rares on
a different quality row land at 100.3% (Classic's own) and 100.6% (Forever's),
and independently ask for stamina at **0.99** against the 1.0 the owner ruled.

## Three bugs that only real item data could find

**`critRating` WAS READ BY NOTHING.** Declared, exported, documented, priced by
the stat-weight catalogue -- and both places that build a crit slice read
`stats.critChance` off the block, so `critChanceFrom` had no callers anywhere.
Harmless until Forever gear granted a rating, then worth **1% DPS on thirteen
profiles**. The DIRECTION is what made it findable: all thirteen moved DOWN, and
float noise is symmetric.

**1,384 SPELL POWER LINES FELL THROUGH THE PARSER.** Classic writes "Increases
damage and healing done by magical spells and effects by up to 40"; **Forever
writes "+94 Spell Power"**, and only the Classic sentence had a rule. Premier
High Warlord's War Staff reported +94 and delivered zero. Invisible because no
preset wore a Forever item -- **an item in the database and in no profile is the
quietest place in this project for a stat to go missing.**

**"ATTACK POWER" REACHED ONE POOL.** The owner's hard ruling -- it reaches both
melee and ranged, and "Melee Attack Power" never reaches ranged -- moved 164
item lines. BM Hunter **+24.1**, LW Ranged **+29.2**, the other 21 profiles 0.0
to the decimal.

## The rating table, confirmed twice

The owner's conversions: 1 defense, 10 hit, 14 crit, 10 haste, 10 expertise,
12 dodge, 20 parry, 5 block. **Forever's own rewrites of Classic items
reproduce them exactly** -- crit 14.0 over 42 items, spell crit 14.0 over 20,
hit 10.0 over 18, dodge 12.0 over 3, **with no variation at all**. Which also
settles that ONE rating feeds both crit tables: Classic has two item lines and
Forever has one.

## The benchmark sets

Four buttons -- **B55, E65, E75, E85** -- each generating a full set from the
budget at one quality and item level, targeting the build's hit cap and its
preferred stats in the owner's own order. `docs/itemization.md` records the
exception this makes to its own prohibition and why it is not the thing that
rule forbids.

Hit and expertise are absolute totals and **still cost budget**, so a Rogue
spends 120 points before buying anything else. Generated as tooltip TEXT and
parsed back, which is how the spell power gap above was found.

## Eleven bugs, and how each one hid

**EVERY ONE PRODUCED A PLAUSIBLE NUMBER**, which is the only thing they have in
common and is the reason this list is worth more than the feature it came out
of. Four needed real item data to exist at all; four more were found by the
REPAIRS, in code the item swap did not touch.

| | what was wrong | why nothing noticed |
| --- | --- | --- |
| 1 | **`critRating` was read by nothing.** Declared, exported, documented, priced by the stat-weight catalogue -- and both crit-slice builders read `stats.critChance`, so `critChanceFrom` had no callers | harmless until Forever gear granted a rating. Found by the DIRECTION: all thirteen affected profiles moved DOWN, and float noise is symmetric |
| 2 | **1,384 spell power lines fell through the parser.** Classic writes a sentence, Forever writes "+94 Spell Power" | no preset wore a Forever item. An item in the database and in no profile is the quietest place for a stat to go missing |
| 3 | **"Attack Power" reached one pool.** 164 item lines, melee only | the owner's ruling is that it reaches both. A Hunter with plausible attack power produces a plausible number |
| 4 | **Every benchmark set lost ALL its primaries.** A Warrior's E65 was 328 crit rating and no strength, stamina or agility | `budget` and `spent` still balanced, because both are computed from the ALLOCATION rather than from the parse. 23.4% crit from gear reads as ordinary |
| 5 | **Ranged attack power went unread on all twelve items that grant it**, Rhok'delar included | the rule was written for Classic's lower-case "ranged Attack Power." and every Forever line has a capital R. **A rule that matches nothing reads exactly like one that sometimes matches** |
| 6 | **160 mana regeneration lines unread** | Forever's "+4 Mana Regeneration" against Classic's "Restores 4 mana per 5 sec." |
| 7 | **Two weapon skill lines unread** -- "+3 Daggers Skill" against "Increased Daggers +3." | same shape, two items |
| 8 | **A tank's shield carried SIX points of block value** where Forever's own carry 44 | the budget bought it at a cost of 0.65 on a light slot. Shield Slam reads block value, so Protection lost it twice |
| 9 | **The Shockadin fought with the PLACEHOLDER weapon.** Its template said `twoHand` and its style is `one_hand_shield`, so `liveEquipment` dropped the weapon | the Hemo/Ambush shape, and `presets.ts` had already ruled on this exact conflict from the other direction |
| 10 | **A character created from scratch stopped getting enchants**, worth +2.4 to +53.7 DPS | the old curated sets carried them INSIDE; deleting those sets took the enchants with them, and only a PRESET re-applied a loadout |
| 11 | **Armour pieces were generated with NO STAMINA.** Bought only when it fell inside a template's stat count, so a Rogue's wrists had none and Seal Twist Ret had none ANYWHERE | **the owner found it by reading the items** -- "it's strange to me that stamina was dropped on some of the template items". 93.3% of Forever's own clean armour carries stamina, so the generator had made the exception the rule |

**THE ELEVENTH IS THE ONE NO TOOL HERE WAS GOING TO FIND, AND THAT IS NOW A
PATTERN RATHER THAN AN ANECDOTE.** Nothing was unread, nothing was over budget,
every item was in the right slot and the arithmetic balanced -- the gear was
simply not shaped like Forever's gear, which is a judgement about the RULESET
and not about the code. It is the fifth time the owner's reading of printed
output has beaten every check in this repository: the hit ladder, parry haste's
direction, Touch of the Grave's proc rate, Feral Swiftness's 30 dodge, and now
this. **Put the generated items in front of them, not only the figures.**

**FOUR OF THE ELEVEN WERE FOUND BY ONE TOOL, AND IT HAD TO BE WRITTEN FIRST.**
`tools/item_vocabulary.ts` groups the lines the parser could not read by SHAPE --
every number replaced by `N` -- so a hundred spell power lines are one row and a
one-off proc is one row too. A repeated shape is a missing RULE; a shape seen
once is usually a real proc. The list of 4,000 distinct sentences that preceded
it said nothing.

**AND THE TOOL HID BUG 4 FROM ITSELF FOR A COMMIT.** It excluded the GENERATED
items, on the reasoning that an unread line there is a bug in `benchmarkGear.ts`
rather than a gap in the parser's vocabulary. That reasoning is correct and the
exclusion was still wrong: it is the generator that writes a line nobody has
taught the parser to read. **An exclusion whose justification is "this would be
a different kind of bug" is an exclusion that hides that kind of bug.**

**THE UNIT OF BUG 6 WAS SETTLED BY THE DATA AND NOT BY A GUESS**, which is worth
its own line. "+4 Mana Regeneration" reads just as naturally as 4 mana a second,
and the two are five times apart. 252 of the changed items carry CLASSIC's own
lines beside Forever's in the capture, and Field Marshal's Headdress reads
"Restores 4 mana per 5 sec." against "+4 Mana Regeneration" -- the same number.
**The control group that was built to price Classic's itemization answered a
question about units**, which is not what it was for.

**TWO GUARDS CAME OUT OF IT, both of the shape this file prefers -- a mirror
assertion that EXPIRES rather than a figure that drifts.** `items.test.ts` walks
every effect rule against every effect line and fails on an unreachable one that
is not on its stated list; `benchmarkGear.test.ts` fails if any generated item
leaves anything in `unmodelled`, which is a stat the set paid budget for and
lost. The first has already paid: `+N Spirit` was on the unreachable list with a
comment calling it a question for the owner, the owner answered with a slot
table, and **the test failing is how that was confirmed**.

## Where it stands

**MERGED:** the budget model, the item database, the rating table, the benchmark
gear, the Attack Power ruling and the spell power fix -- `c5900b0` and
`f985e55` (#240).

**MERGED AS `3745ebc` (#241), IN SIX COMMITS:** the owner's four instructions --
keep the enchants, delete the old gear sets, keep only Forever and benchmark
items, collapse the duplicate crit rows -- plus the slot-stat table and the
stamina floor that came out of reading the result.

- the nine Classic/SoD files, `gearSets.ts`, `item-sets.json` and
  `import_item.mjs` are deleted
- `forever-same.json` captured (273 items Forever kept unchanged), so the
  database is new + changed + same + benchmark
- `startingEquipmentFor` keeps its name and returns E65, which is what lets 23
  test files carry on unedited
- the 25 enchant loadouts were **extracted before the deletion** and live in
  `PRESET_ENCHANTS`
- the two SCRAPED weapon enchants were rescued into `weapon-enchants.json` --
  they rode along inside `classic-warrior.json` and deleting it would have
  silently unenchanted every weapon in the project
- the stat-weight catalogue has ONE crit row

**DONE NOW, AND THE FIGURES WENT INTO THE BASELINE TABLE.** All 3,101 tests
passed and all 25 profiles were re-measured on the E65 set: the mean was
**719.6** where it had been 730.9, with **11 rows up and 14 down** -- physical
builds +14.4 on average, casters -31.6, the three tanks -62.4. **The table has
moved five times since and reads 752.7**; this is the figure the round
produced. The table at the end of this
file is the record and the paragraph under it says why the split falls that way.

**AND THAT MEAN MOVED THREE TIMES IN ONE ROUND**, 741.0 then 734.1 then 719.6,
because the owner's stamina floor landed between measurements and then its share
was ruled up from 12.5% to 25%. Every armour-class piece carries stamina now,
which on most builds is budget that was going to a damage stat.
**THE THREE THAT DO NOT MOVE AT ALL ARE THE THREE THAT LEAD WITH STAMINA** --
Prot Warr, Bear and Prot Pally, every one at 0.0 to the decimal through both
changes -- which is the containment check that says the floor tops up a slot
that would otherwise have dropped stamina rather than competing with a build
that wanted it. At 12.5% that list was five; 2H Arms and DW Fury carry stamina
third in their preference order, which clears a 12.5% floor and not a 25% one.

**AND THE INTERIM FIGURES THAT WERE RECORDED HERE WERE MEASURED ON A BUG.** This
paragraph used to read "2H Arms 825.0 -> 704.4" and "Cat 855.8 -> 614.4" as the
shape of the change. Those were taken before the benchmark sets granted any
PRIMARIES at all -- a Warrior's E65 was 328 crit rating and no strength -- so
they measured gear that was missing its main stat. The real figures are 843.8
and 872.6, in the other direction. **An interim measurement is worth recording
and is not worth trusting**, which is why it is replaced rather than deleted.

**AND THE CRIT ROW IS WHY POINTS 3 AND 4 WERE ONE CHANGE.** Collapsing the
catalogue to `critRating` failed immediately with `['critChance',
'spellCritChance']` unpriced -- because items still granted them. The duplicate
rows were not a display bug; they were the catalogue correctly reporting that
two eras of gear were in the database at once.

# MID-FIGHT CONSUMABLES — NINE POTIONS THAT ARE ABILITIES

**ALL 25 ROWS MOVED AND EVERY ONE WENT UP, MEAN 709.6 -> 730.9.** Twenty-five
deltas of +1.8 to +48.6 from the preset selections, and then **+88.7 on the
Firelock alone** from a bug those selections exposed.
Two new consumable categories — Potion and Other — whose entries are used DURING
the fight. The owner: they "must be treated like a character ability and be
exposed on the APL and consumable panels", so each carries an `Ability`, joins
the ability book when it is selected, and gets an entry in the priority list.

**IT LANDED AS TWO SQUASH COMMITS, `50fffe0` AND `ccf4dc8`**, and the six rounds
below are what is inside them. The table named the four branch SHAs while the PR
was open; a squash merge keeps none of them, so **a SHA written down before a
merge is a pointer that expires AT the merge** -- which is this file's own rule
about a pointer being a claim, applied to the one kind of pointer that cannot
survive the workflow this project uses.

| in | round | effect |
| --- | --- | --- |
| `50fffe0` | the nine abilities, the two categories, the panel and the APL | **no figure moved**; all 75 hashes and event counts identical |
| `50fffe0` | Preparation reset a potion, which is not a Rogue ability | no published figure; **Thistle Tea 2.00 casts -> 1.00** |
| `50fffe0` | every preset gets a sensible Potion and Other, measured | **25 of 25 rows**, 10 REAL |
| `50fffe0` | Life Tap gated on current mana, by the owner's ruling | Firelock **+88.7**, the other 24 at 0.0 |
| `ccf4dc8` | the Rune at the owner's 10%, not this repository's 30% | Firelock -4.3, six others +0.1 to +2.4, **mean unmoved** |
| `ccf4dc8` | a Healthstone for the builds with no pool to restore | 0.00 casts, **no figure moves** |

**NOTHING HERE NEEDED A NEW ENGINE CAPABILITY, AND THAT IS THE HEADLINE.** Every
field used already existed. The racials that landed the week before are the
template throughout: an ability belonging to no class is appended in
`createPlayer` beside them, a shared constant puts an entry in all 25 stock
lists, and `stockListFor` narrows it to what the profile carries —
`withoutUnselectedConsumables` is `withoutOtherRacials` with a SELECTION in
place of a race.

**AND THE OWNER'S ASK WAS ALREADY SATISFIED BY A MECHANISM THAT EXISTED.**
"When a potion is selected it will then become visible on the APL so the user
can place it amongst their rotation with conditions" needed no code at all:
`editProfile` runs `syncDefaultRotation` on every change a panel makes, and its
own comment had predicted exactly this case —

> applied to every change rather than to the four that can matter, because it is
> idempotent and because the alternative is a list of "edits that change which
> stock list applies" that is correct until somebody adds a fifth.

**A consumable selection is the fifth.** No profile format bump either: the
selection is already a map from category id to consumable id, so two more keys
are legal in every file ever saved.

## The four rulings, which are what the questions were for

Asked before anything was built, and three of the four went the way that moves
no figure on nobody's authority:

| question | the owner's answer |
| --- | --- |
| do they start a global cooldown? | **no** — the same answer they gave for four of the five racials |
| should any preset open with one? | **yes**, a sensible one each — which is this round's figures |
| the Rune below its own cost? | **refused**, not allowed to kill |
| does anything scale a heal? | **no** — the stated range is the whole answer |

**AND FIVE MORE RULINGS CAME BACK ON THE FINISHED WORK, ACROSS TWO ROUNDS**,
which is this file's own rule about a write-up not ending anything:

| what was reported | the ruling |
| --- | --- |
| Preparation was resetting Thistle Tea | **"Preparation does NOT reset Thistle Tea's cooldown"** — confirms the fix as shipped |
| healing a Warlock costs it 28 DPS | **"this should never be the case"** — a bug, not a property. See below |
| no mana potion is selected anywhere | **"this may be the case and that's fine"** — ratified |
| the Rune never fires on six profiles | **10% mana** is the default for mana users — the owner's figure, replacing our 30% |
| 2H Arms and DW Fury carry no Other | **non-mana, non-energy users and the three tanks take the Healthstone** |

**TWO OF THE FIVE REVERSED A CONCLUSION AND NONE OF THEM REVERSED A
MEASUREMENT**, which is the distinction worth carrying: every figure reported
was reproducible, and two of the five judgements built on top of a figure were
wrong. The Warlock heal was read as a property of the class when it was a defect;
the two empty `other` slots were read off this repository's own rule — "leave
empty only what is worth literally nothing" — when what the owner wanted was the
row a build would actually carry. **A row worth nothing is not the same as a row
that should be blank.**

**THE RUNE AT 10% COSTS THE FIRELOCK 4.3 AND GAINS 0.1 TO 2.4 ON SIX OTHERS**,
every one inside its interval, and the mean does not move from 730.9. The
direction is the mechanism: for a build that never runs dry, a Rune firing at 30%
was spending health and a poll for mana it did not need; for the Firelock, which
after the Life Tap gate genuinely does run dry, firing later is slightly worse.
**The one row that went down is the one the gate matters to**, which is worth
saying rather than reporting seven noise verdicts and a flat mean.

**THE GCD ANSWER IS THE ONE THAT MATTERED MOST AND IS INVISIBLE.** An ability
wrongly taking a global cooldown still restores the right pool for the right
amount on the right cooldown, so the mistake shows up in nothing but the DPS.
Being off it means ONE thing — the ability does not START one — and it is still
BLOCKED by one running, which a test forgot: it cast two free potions behind a
Ghostly Strike, neither happened, and it asserted on a state neither reached.

**AND THE RUNE'S GUARD IS LOAD-BEARING FOR A SECOND REASON THE QUESTION DID NOT
ASK ABOUT.** `Resource.spend` is all-or-nothing — it "returns false and changes
nothing" when the pool is short — so without the refusal a character below the
cost would have paid NO health and still collected the mana. A free Demonic Rune
is a bigger number and no error.

## Two bugs, both found by printing a quantity beside the figure

**PREPARATION WAS HANDING A ROGUE A SECOND THISTLE TEA.** "Immediately finishes
the cooldown on your other ROGUE abilities" was implemented as every ability the
character had, which was the same set until a book started holding racials and
potions. A five minute cooldown fired **twice in a sixty second fight** — 2.00
casts on Rupture, 1.86 on Hemo — taking the potion from a true +32.5 to a
reported +64.7 and +85.1.

**IT WAS FOUND BY THE CAST COUNT AND NOT BY THE DPS.** +64.7 reads as a potion
that is unusually good for a build with no other energy cooldown; "two casts of
something on a five minute cooldown" does not read as anything but wrong.
`resetCooldowns` takes the ids the caller owns now, because the engine cannot
answer "is this a Rogue ability" and must not try.

**AND THE THREE TESTS ALREADY ON PREPARATION COULD NOT HAVE SEEN IT**, because
all three built the actor a book of two Rogue abilities — so the restriction had
nothing to restrict. **A test whose fixture cannot express the mistake proves
nothing about it**, which is the stock Warlock list's lesson about the interrupt
check, in a different file. The racial half of the same bug is worth 0.0 today
and is why nobody found it when the racials landed: Preparation is only in the
two SUBTLETY lists and both those profiles are Undead, whose racial is a passive
reaction rather than an ability with a cooldown.

**AND `measure_profiles.ts` WOULD HAVE CALLED ALL NINE "NEVER FIRED"**, which is
the racials' own bug repeated and was avoided only because the comment they left
in `ABILITY_NAMES` says to add new ones there. A tool that answers "did this
entry fire" must know every ability a list can name, or its zero means two
different things.

## Healing a Warlock cost it 28 DPS, and that was a bug in Life Tap

**THE MOST TRANSFERABLE THING IN THIS ROUND, BECAUSE THE MEASUREMENT WAS RIGHT
AND THE CONCLUSION WAS WRONG.** On the Firelock a Major Healing Potion measured
**-28.4** and a Healthstone **-26.2**, both REAL, both drunk once, against a
target that never attacks.

`probe_firelock_heal.ts` isolated it exactly: a Warlock spends HEALTH for mana,
Life Tap's `canCast` asks whether there is health to spend and whether the mana
pool has room — **never whether the mana is WANTED** — so 1,400 restored health
bought 1.63 more Life Taps, each a global cooldown that deals nothing, and the
list cast **1.43 fewer Incinerates**. Mana GAINED rose 12,873 to 14,217 while
mana SPENT fell 7,583 to 7,206.

**AND THAT WAS WRITTEN UP AS AN INTERESTING PROPERTY OF WARLOCKS.** The owner
read it and ruled the opposite: *"this should never be the case. Spending life
tap on global cooldowns should only be based on the warlock's current mana."*

**THE REAL FAULT WAS THAT ONE OF THE TWO WARLOCK LISTS WAS GATED AND THE OTHER
WAS NOT.** The SM/DS entry is `manaBelowFraction(0.15)` and carries a comment
recording why — an unconditional Life Tap "fired five times a fight, each one a
global cooldown that dealt nothing" — and the FIRELOCK entry was left ungated.
**One caller is not a sample, and the sibling list is the first place to look.**

| | taps a fight | DPS |
| --- | --- | --- |
| ungated (what shipped) | **5.46** | 776.6 |
| below 1% | 0.27 | 850.3 |
| below 3% | 0.83 | 862.8 |
| **below 5%** | **1.05** | **865.4** |
| below 8% | 1.23 | 862.9 |
| below 15% (SM/DS's figure) | 1.70 | 855.9 |
| below 50% | 5.00 | 793.3 |

**FIVE PERCENT IS A MEASURED PEAK AND FALLS OFF BOTH SIDES** — too loose and the
taps are waste, too tight and the build runs dry before it taps. A two-point
comparison would have found neither edge, and 15% was not copied across:
*"do not normalise a threshold across two lists of the same class."*

**SM/DS NEEDED NO CHANGE, AND THE WAY THAT WAS CONFIRMED IS WORTH NOTING.** It
measures **0.00 taps at every gate from 2% to 30%** and every one of those cells
reads 715.4, identical to the decimal — which is normally this project's tell for
a patch that did not apply. The `taps` column is what says it is genuine: its
mana never falls that far, so its 15% was already doing the whole job.

**WORTH +88.7 TO THE FIRELOCK, 776.6 -> 865.4, AND THE OTHER 24 ROWS MOVED BY
0.0 TO THE DECIMAL.** A heal is now worth -0.1 there, which is the owner's
ruling satisfied.

**THE LESSON IS THE ORDER THE TWO WERE FOUND IN.** "Isolate a loss, do not blame
the obvious suspect" has a second half: **having found the real cause, ask
whether the cause is itself correct.** The isolation worked perfectly and the
conclusion drawn from it was still wrong, because a correct explanation of a
number was mistaken for a justification of it. **An explanation is not a
defence.**

## And the Firelock's pair inverted under the fix without changing

Gating Life Tap made the build genuinely mana-bound, so its single-candidate
figures reversed: measured ALONE the Major Mana Potion is **+33.0** against
Spellblasting's +18.4, where before the fix it never fired at all.

**PAIRED WITH THE DEMONIC RUNE, SPELLBLASTING WINS AGAIN — +41.5 AGAINST
+38.5.** The Rune already restores mana from a category the Potion is not
exclusive with, so a second mana source is redundant. `probe_firelock_pair.ts`.

So the selection did not change, and the reason it had to be re-measured anyway
is that **"marginal values do not sum" can reverse a ranking rather than merely
shrink it** — which is not what that rule says and is worth adding to it.

## What each preset drinks, and the one sentence behind it

The twelve older categories could be read off a table — the conversion table
decides Blasted Lands, the measured damage school decides School Spell Power. A
potion cannot: "forty attack power for thirty seconds" against "sixty strength
for twenty" against "2,250 mana" is not an arithmetic question. So every
candidate was run on every preset, 9 cells by 25 profiles by 300 fights, by
`tools/probe_consumable_choice.ts`.

**WHAT CAME OUT IS ONE SENTENCE: the Other slot takes the pool the build
actually runs out of, and the Potion slot takes the damage buff.** The two
categories are not exclusive with each other, so no build has to choose between
sustain and damage — which is why **no mana potion is selected anywhere**: the
Rune covers mana from the other category and leaves the Potion slot free for
something that hits.

| | Potion | Other | measured |
| --- | --- | --- | --- |
| Warriors, Cat, Bear | Mighty Rage | — / Thistle Tea / Healthstone | **+13.3 to +35.2** on the potion |
| the four Rogues | Major Frenzy | Thistle Tea | **+32.5 to +47.3** on the Tea |
| nine casters | Major Spellblasting | Demonic Rune | **+1.8 to +18.2** |
| both Paladin hybrids, Enh Shaman | Major Spellblasting | Demonic Rune | +5.6 to +9.1 |
| four Hunters | Major Frenzy | Demonic Rune | +4.5 to +11.2 |
| Prot Pally | Major Spellblasting | **Healthstone** | deaths 8.54 -> 8.31 |

**MIGHTY RAGE BEATS FRENZY WHEREVER IT IS LEGAL AND NOT BY A LITTLE**: sixty
strength is 120 attack power to a Warrior or a Druid against Frenzy's forty, over
twenty seconds against thirty — 2,400 attack-power-seconds against 1,200, plus
the rage. +35.2 against +5.2 on DW Fury.

**TWO PRESETS HAD NO `other` AND THE OWNER OVERRULED IT.** 2H Arms and DW Fury
restore no pool at all — no mana, no energy, nothing attacking them — so the
written rule's "leave empty only what is worth literally nothing" emptied them.
The ruling: *"non-mana, non-energy users and the three tank profiles (Prot Warr,
Prot Pally, and Bear) should use the Healthstone."* That is a SELECTION rather
than a measurement, and it is the right one: it is what such a build actually
carries, it still fires 0.00 times, and it moves no figure. **A row worth
nothing is not the same as a row that should be blank.**

**AND THE RUNE IS KEPT WHERE IT NEVER FIRES**, which is the Evocation decision.
At the owner's **10%** gate, four of the fifteen presets that carry one use it in
a sixty-second fight — the Firelock 1.0 times, LW Ranged 0.5, the Enhancement
Shaman 0.4, Retribution a rounding — and the other eleven never reach 10% mana
at all. Those four are the builds that genuinely run dry.

**THE RULE WAS CHOSEN FOR BEING CHECKABLE, WHICH IS WHY IT IS "spends mana" AND
NOT "the Rune fires".** A reader can verify the first from the class; the second
can only be verified by re-running the probe, and this project's own standard for
these rows is that "twenty-five separate opinions is not something a reader can
check".

**SO `USES=1` PRINTS `<-- NEVER FIRED` AGAINST THE RUNE ON ELEVEN PROFILES, AND
THAT IS EXPECTED RATHER THAN A NEW DEFECT.** Said here because an audit flag
nobody has explained is exactly the thing somebody later "fixes" — and the
honest reading is the one Evocation already has: a conditional entry that is
almost never true costs the entries below it nothing. **Both halves of the
Evocation precedent apply, including the second**: the right moment to go back
and ask the owner is the moment one of these STARTS firing.

## Two things from the end of the session that are not about consumables

**THE PRIMARY CHECKOUT WAS FOUR COMMITS BEHIND `main` AND NOBODY WAS WORKING IN
IT.** Reported to the owner as "four other sessions are working in this tree",
which was an inference from four REGISTERED WORKTREES and was wrong: their last
commits were three to sixteen days old and three of the four were clean. The
real cause is structural and worth knowing, because this project's workflow
guarantees it: **every PR is merged on GitHub, which moves `origin/main` and
nothing else.** The checkout's own `main` ref never moves until somebody pulls,
so a shared tree drifts behind silently and reads as activity. Four stale
worktrees and 24 stale branches were pruned after checking each one.

**AND ONE FULL-SUITE RUN FAILED ONCE AND WAS NOT DIAGNOSED**, which is recorded
rather than buried. `chargeAndShieldTalents.test.ts` failed in one run of the
full suite at `ccf4dc8` and has passed every run since -- **four times in
isolation and twice more under the full suite**, 3,076 passing.

What the failure RULES OUT is most of the explanations:

| | |
| --- | --- |
| a different fight | the file pins `seed: 4242`, so the simulation is deterministic |
| a timeout | **zero async bodies** in the file, and "a synchronous test cannot time out" -- the body blocks the event loop and vitest's timer never fires |
| a slow test crossing a limit | its slowest individual test is **1,616ms** against a 5,000ms default, though the FILE is the suite's slowest at 13.1s |

Which leaves the cause this file already documents: **"a seeded test that fails
under the full suite and passes in isolation on the same commit is the shared
checkout, not non-determinism."** Unproven here, and stated as unproven.

**THE REAL MISTAKE WAS DESTROYING THE EVIDENCE.** The first run's output was
filtered down to a summary line, and the fix was to RE-RUN with a different
filter -- which passed, and took the assertion text with it. **Capture a suite
failure before re-running it**: a flake you cannot reproduce is a flake you
cannot diagnose, and the one artifact that would have settled it existed for
about a minute.

## The deltas, and why fifteen "noise" verdicts all point the same way

```
Cat            855.8 DPS +/-  5.4   was  807.2  + 48.6  REAL
Hemo           694.2 DPS +/-  5.7   was  650.6  + 43.6  REAL
Combat         750.9 DPS +/-  6.3   was  708.3  + 42.6  REAL
DW Fury        946.6 DPS +/- 10.3   was  911.5  + 35.2  REAL
Venom          663.6 DPS +/-  4.9   was  628.3  + 35.3  REAL
Rupture        646.2 DPS +/-  5.3   was  611.9  + 34.3  REAL
Bear           455.7 DPS +/-  7.2   was  426.9  + 28.8  REAL
2H Arms        825.0 DPS +/- 10.2   was  798.2  + 26.8  REAL
Fire           707.6 DPS +/-  9.2   was  689.6  + 18.0  noise
Firelock       776.6 DPS +/-  6.8   was  759.2  + 17.4  REAL
Prot Warr      542.0 DPS +/-  6.5   was  526.2  + 15.8  REAL
SM/DS          715.4 DPS +/-  3.9   was  703.0  + 12.4  REAL
Moonkin        746.4 DPS +/-  7.7   was  734.4  + 11.9  noise
LW Melee       812.8 DPS +/-  8.4   was  801.6  + 11.2  noise
Enh Shaman     727.4 DPS +/-  8.9   was  716.8  + 10.6  noise
Ele Shaman     631.2 DPS +/-  5.3   was  622.3  +  9.0  noise
Frostfire      780.5 DPS +/- 17.3   was  771.6  +  9.0  noise
Shockadin      684.6 DPS +/-  5.2   was  677.5  +  7.1  noise
BM Hunter      798.0 DPS +/-  4.0   was  792.6  +  5.4  noise
Arcane         790.8 DPS +/-  9.1   was  786.2  +  4.7  noise
Hawk Melee     848.8 DPS +/-  7.2   was  844.4  +  4.5  noise
Seal Twist Ret 814.1 DPS +/-  8.2   was  809.9  +  4.2  noise
Prot Pally     372.7 DPS +/-  4.2   was  369.5  +  3.2  noise
LW Ranged      845.0 DPS +/-  6.3   was  842.6  +  2.4  noise
Shadow         751.2 DPS +/-  5.9   was  749.4  +  1.8  noise
```

**TWENTY-FIVE SAME-SIGNED DELTAS IS THE SHAPE CLAUDE.md DESCRIBES**: where the
mechanism predicts the direction, a "noise" verdict is a statement about
variance and not about whether anything happened. A potion that is drunk is
drunk; the per-profile size is just how much of the build's damage goes through
the stat it grants.

**THE MARGINAL FIGURES DO NOT SUM TO THE TOTAL AND CAN EXCEED IT.** The Cat's
+48.6 is Mighty Rage's +15.7 and the Tea's +30.7 measured separately, which is
46.4 — each is "what removing this one costs with the other present", and they
overlap because more energy means more Shreds carrying more attack power.

**AND THE ROW ORDER CHANGED UNDER THE TABLE, TWICE IN ONE ROUND.** The preset
selections put the **Cat Druid second at 855.8**, up from fifth, because the two
archetypes that may drink Mighty Rage are the two they moved most. Then the Life
Tap fix put the **FIRELOCK second at 865.4** and the Cat third.

**SO THIS PARAGRAPH EXPIRED TWICE WHILE THE ROUND WAS BEING WRITTEN**, which is
the cleanest demonstration this file has of why it keeps expiring: a sentence
naming the second-place row is invalidated by any row moving, and a round that
moves all 25 and then one of them again invalidates it twice.

---

# RACIALS, IN FOUR ROUNDS — READ THEM AS ONE

**THE FEATURE SHIPPED IN ONE COMMIT AND THEN TOOK THREE MORE ROUNDS, TWO OF
THEM THE OWNER'S.** The four headers below are one piece of work, and the thing
worth carrying out of it is the SHAPE rather than any single figure: a feature
arrives in waves exactly as a patch does, and "built and measured" is not
"right" any more than "the notes are exhausted" is "the patch is implemented".

| | what it was | effect |
| --- | --- | --- |
| 1 | the ten races, five abilities, four engine additions | 25 of 25 rows moved, mean **700.0 -> 709.8** |
| 2 | the owner's three asks about the panel and the APL | no figure moved; all **75 hashes identical** |
| 3 | the owner found the proc at HALF its rate, by arithmetic | SM/DS **1.17 -> 2.03** procs a fight |
| 4 | the sweep asking whether anything ELSE was left behind | **six DoTs**, four on classes no profile reaches |

**THE HEADERS BELOW RUN NEWEST FIRST, so they are rounds 3-and-4, then 2, then
1** -- the table above is in the order the work happened and the file is in the
order this one always is. Each header's figures belong to ITS round and say so.

**THE MEAN WAS 709.6 AT THE END OF THIS ROUND AND IS 719.6 NOW**, by way of
730.9 at the mid-fight consumables, 741.0 on Forever's items and 734.1 with the
stamina floor at half its final share. The sentence under the baseline table is the
only place that is ever live; rounds one and three each rebuilt the table, and
every other figure in this file -- including that 709.6 -- is dated. That is not a
style note: `update_baseline_table.py` spent its whole life writing the live
mean into a paragraph about the Shatter round, fifteen hundred lines above the
table, which round one found and fixed.

**ROUNDS THREE AND FOUR ARRIVED AFTER THE FEATURE WAS DOCUMENTED AS FINISHED**,
which is this file's own recurring pattern and the reason the table above is
written so a fifth row can be added to it.

## What the owner contributed that no tool here did

**FOUR QUESTIONS ANSWERED BEFORE A LINE WAS WRITTEN, and three of the four
changed the architecture** — Eureka! spending one charge per CAST rather than
per hit, Touch of the Grave being a flat 5% that also HEALS, and "holding a
sword" meaning EQUIPPED rather than wielded. That last one is the difference
between Axe Specialization reaching two profiles and reaching NONE: the only two
Orc presets holding an axe carry it as a stat stick on a ranged build.

**AND THEN THE BUG, FOUND BY DIVIDING TWO NUMBERS THE RESULTS PAGE ALREADY
SHOWED.** 1.17 procs a minute against 21.6 damage-dealing casts, where the rate
is 10%. No new control and no new tool — just somebody asking whether the two
agreed. **It is the third time the owner's reading of a printed figure has
beaten every tool here**, after the hit ladder and parry haste's direction, and
all three were cases where the tools were working correctly on the wrong
question.

**AND THEN ASKING WHETHER IT WAS ONLY THE WARLOCK**, which found four more DoTs
on three classes no profile uses at all. The fix had been measured and tested on
the build that exposed it, which is the coverage shape this file documents
elsewhere: a check derived from what the project already USES cannot find what
it does not use yet.

---

# TOUCH OF THE GRAVE WAS PROCCING AT HALF ITS RATE, AND THE OWNER FOUND IT BY ARITHMETIC

**1.17 PROCS A MINUTE AGAINST 21.6 DAMAGE-DEALING CASTS, WHERE 10% IS 2.16.**
That is the whole report, and it is the kind this project is worst at finding on
its own: the proc fired, every figure it produced was self-consistent, and the
3,022-test suite was green.

**"SAME RULE FOR DoTs - ONLY ON CAST NOT EACH TICK" HAD NO IMPLEMENTATION FOR A
PURE DoT.** It shipped as "only on the cast's DIRECT DAMAGE", and a pure
damage-over-time cast deals none -- Corruption, Bane of Agony and Siphon Life
each just apply an aura. So **8.95 casts a fight took no roll at all**, on the
one build whose core is DoTs.

| | what it is | effect |
| --- | --- | --- |
| 1 | a CAST half for Touch of the Grave, paired with the damage half | **SM/DS 1.17 -> 2.03 procs a fight** |

## What moved, measured on the MECHANISM

```
procs a fight        before   after
warlock_smds           1.17    2.03     <-- the owner's own figure, reproduced
warlock_firelock       2.73    2.73     <-- Immolate already rolled; the dedupe holds
rogue_rupture          4.85    4.55
rogue_venom            5.22    5.60
rogue_hemo             4.97    5.22
```

**ONLY SM/DS MOVES, AND THAT IS THE POINT.** It is the one build whose damage is
mostly pure DoTs. **Firelock is identical to the decimal**, which is the dedupe
working: Immolate deals direct damage AND applies a DoT in one instant, and it
rolled once before and rolls once now. The three Rogues move by +/-0.3 on a
Poisson standard error of 0.29 -- Rupture adds a roll and the one second
internal cooldown absorbs it, because a Rogue already takes a qualifying action
about twice a second.

**THE DPS EFFECT IS BELOW THIS PROJECT'S RESOLUTION AND IS NOT CLAIMED.** The
extra procs are worth about 187 damage a fight on SM/DS, roughly +3 DPS, against
a 300-fight interval of +/-3.3. All 25 profiles measured inside their intervals
and **twenty of them at exactly 0.0**, which is the containment check: only the
five Undead rows could move and only they did.

## The fix is a shape that was already in the repository

`judgementOfWisdomReactions` is a damage half and a cast half sharing one
closure, and **its own comment names Corruption as the case the cast half exists
for**. The damage half records the INSTANT it rolled; the cast half refuses when
a roll was already taken at that instant, because `runCast` runs `onCast` before
the cast reactions.

**WITHOUT THE DEDUPE, IMMOLATE WOULD SIT AT 19% WHERE CORRUPTION IS AT 10%** --
it would roll on its direct damage and again on the DoT it applied -- and both
figures read as perfectly ordinary.

**"HAS A DAMAGE PART" IS ANSWERED BY ASKING THE AURAS, NOT THE ABILITY.**
`appliedPeriodicNow` looks for an aura ON THE TARGET, with `periodic`, APPLIED
AT THIS INSTANT. Each clause excludes something real: Amplify Curse applies to
the CASTER; Demoralizing Shout, Expose Armor, Thunder Clap's slow and Wrack's
amplification all land on the target and none of them ticks; and an aura already
present is not this cast's doing.

The two alternatives were both worse. A flag on `Ability` is the shape where the
one that forgot is silently inert, and there are ten DoTs across five classes.
An EXCLUSION list is what the owner's wording invites -- "abilities which do not
have a damage component LIKE demoralizing shout" -- and fails the generous way,
which is the dangerous one.

## AND IT WAS NEVER ONLY THE WARLOCK

**THE FIX WAS MEASURED ON SM/DS AND TESTED ON THE THREE WARLOCK DoTs THAT
EXPOSED IT**, which is a check derived from what the project already USES and
cannot find what it does not use yet. The owner asked whether other DoTs were
left behind. A sweep of every ability every Undead-legal class can cast named
**SIX** against the pre-fix code:

```
priest/shadow_word_pain      warrior/rend_cast
priest/devouring_plague      warlock/corruption
rogue/rupture                warlock/bane_of_agony
```

**NOT ONE OF THE FIRST FOUR IS REACHED BY A PROFILE.** There is no Undead
Warrior, Priest or Paladin preset at all, and the Undead Rogues take Rupture but
it was never what moved the figure. **The build that exposes a bug is not the
measure of the bug.**

`racials.test.ts` walks the ability book of all six Undead-legal classes now,
casts every ability once with the roll FORCED to win, and asserts nothing
damaging takes no roll. **Forcing is what makes one cast decisive.** The first
version of that sweep drove two hundred casts an ability and was useless twice
over: the caster's AUTO-ATTACKS procced too, so rows that never cast at all
reported a dozen procs -- and an ability on a three minute cooldown got one
cast, where zero procs at 10% means nothing. **Devouring Plague read as a GAP on
a sample of one.**

**EIGHT ABILITIES THE HARNESS CANNOT REACH ARE PINNED BY NAME** -- Judgement,
Hammer of Wrath, Backstab, Ambush, Overpower, Revenge, Execute and Charge, each
needing fight state it cannot fabricate. Every one deals direct damage and goes
through the half that was never broken. Listed rather than skipped, because
"could not drive it" and "takes no roll" are the two answers the whole check
exists to keep apart.

## And the suite was green the whole time

**EVERY ASSERTION ABOUT THIS PROC WAS ABOUT AN ABILITY THAT DEALS DIRECT
DAMAGE**, so every one of them passed while three pure DoTs took no roll. That
is the blind spot, and the test aimed at it is a RATE WITH A DENOMINATOR: procs
divided by the actions that were entitled to a roll, with the qualifying ability
ids written out by hand. It is the arithmetic the owner did.

**Three of the four new tests fail against the old code and pass against the
new**, which was checked by reverting the two source files and running them --
the lesson from the crit bug earlier in this feature, where the first version of
a test agreed with the bug because it rebuilt the thing under test by hand.

---

# THE OWNER'S THREE ASKS, AND NOTHING MOVED BY A DECIMAL

**ALL 75 COMBAT-LOG HASHES AND EVENT COUNTS IDENTICAL**, which is the right
check for the middle one of these and about a hundred times cheaper than
re-measuring: it answers "did any decision change" rather than "did the
published figure move".

| | what was asked | what it took |
| --- | --- | --- |
| 1 | the Character panel's racial-traits section, gone | one component and its CSS, removed |
| 2 | an Orc's APL should not offer Berserking, Elune's Light and Eureka! | `withoutOtherRacials`, and a real bug in `syncDefaultRotation` |
| 3 | a way to switch an APL line off without removing it | `AplEntry.disabled`, filtered in `compileRotation` |

**THE FIRST IS A RULING AND NOT A REVERT.** The section listed the chosen race's
four tooltips and was built one commit earlier. It is the same decision that took
the "equipped but not simulated" lists off the Gear, Talent, Raid buffs and
Encounter panels during the GUI pass: **this reporting is for the repository and
not for somebody running a sim.** The data is untouched; what went is a READER.

## The second one found a bug that had nothing to do with racials

`syncDefaultRotation` compared a stored list to the stock one **by NAME**, and
for class, style, stance and talents that was the whole question — a different
build means a different stock list and therefore a different name. **RACE DOES
NOT WORK THAT WAY**: an Orc Warrior and a Gnome Warrior run the SAME NAMED LIST
with different racial entries in it. So changing an Orc to a Gnome would have
left Blood Fury in the list and never added Eureka!. It compares by value now.

**THE ENGINE NEVER NEEDED THE NARROWING AND THE PANEL DID.**
`PriorityRotation` skips an ability the character does not know in SILENCE —
the property that lets one list serve several builds — so an Orc carrying all
four cost exactly nothing. What it cost was a person reading the panel: three of
an Orc's first four entries were abilities no Orc can cast.

**ONLY A RACIAL MAY BE DROPPED**, which is the narrow version on purpose. "Drop
what the build does not know" would delete a capstone a list names for a sibling
spec — one Hunter list serves a build without the capstone, and the Hemo list IS
the Rupture list minus two entries.

## And the third one is filtered where it cannot cost anything

`AplEntry.disabled` is honoured in `compileRotation`, not checked in
`selectAction`, and the reason is a cost that does not show up in a combat log:
**`PriorityRotation` computes `interruptsChannels` ONCE in its constructor**, so
a disabled INTERRUPTING entry would still make the actor poll its channel every
100ms. That is the cost `Rotation.interruptsChannels` exists to avoid, and the
last time it was paid the log was byte-identical and only `eventsProcessed`
moved.

**THE FLAG IS DROPPED RATHER THAN STORED AS `false`** — `interruptsChannel`'s
rule, and sharper now that a stored list is compared BY VALUE: an entry switched
off and on again has to come back byte-identical or a `default` list silently
stops matching its build. Absent means active, so no migration and no format
bump.

**AND IT WAS SEEN IN A BROWSER**, which the racials round was not. The managed
dev server was unavailable both times — all five slots for this folder held by
other sessions — so the built app was served on a spare port and torn down
afterwards.

---

# RACIALS EXIST, AND EVERY ONE OF THE 25 FIGURES MOVED

**THE MEAN WENT 700.0 TO 709.8 AT THAT ROUND, AND SEVEN ROWS MOVED REAL.** Ten races, forty
traits, fifteen of them doing something — three weapon specializations, five
passives, five active cooldowns and Touch of the Grave with all eight of its
exclusions. `game/character/ids.ts` has said "racial traits will key off them"
since the vocabulary was written; this is that.

[docs/racials.md](docs/racials.md) is the write-up.

**THIS WAS ROUND ONE OF FOUR**, and the header at the top of this file indexes
the rest.
The owner's statement produced four questions before a line was written and they
were asked rather than guessed — Eureka!'s charge accounting, Touch of the
Grave's magnitude, which hand "holding" means, and whether the traits their list
omits are in scope. Three of the four answers changed the architecture, and the
fourth drew the scope line.

**AND THIS PARAGRAPH SAID "THIS IS ROUND ONE" AND STILL GOT IT WRONG**, because
it then printed a one-row table and closed it. Saying a thing is round one is
not the same as leaving room for round two — the TABLE is what has to be
writable, which is the correction now in CLAUDE.md.

| | what it is | largest effect |
| --- | --- | --- |
| 1 | the ten races, five abilities, four engine additions | **Venom +28.9**, and 25 of 25 rows moved |

## What moved

```
Venom          630.3 DPS +/-  5.7   was  601.5  + 28.9  REAL
LW Ranged      842.6 DPS +/-  7.1   was  814.5  + 28.1  REAL
Hemo           651.7 DPS +/-  5.9   was  624.3  + 27.4  REAL
Rupture        613.4 DPS +/-  4.6   was  588.2  + 25.1  REAL
LW Melee       801.6 DPS +/-  8.7   was  783.2  + 18.4  REAL
Hawk Melee     844.4 DPS +/-  8.1   was  826.1  + 18.3  REAL
BM Hunter      792.6 DPS +/-  5.2   was  777.8  + 14.7  REAL
Arcane         786.2 DPS +/-  9.5   was  769.4  + 16.8  noise
Seal Twist Ret 809.9 DPS +/-  8.4   was  796.8  + 13.0  noise
Moonkin        734.4 DPS +/-  7.8   was  724.0  + 10.5  noise
Shockadin      677.5 DPS +/-  5.4   was  667.7  +  9.7  noise
DW Fury        911.5 DPS +/- 10.4   was  901.8  +  9.7  noise
SM/DS          704.1 DPS +/-  4.5   was  695.3  +  8.9  noise
Prot Pally     369.5 DPS +/-  3.4   was  362.9  +  6.6  noise
2H Arms        798.2 DPS +/-  9.0   was  791.6  +  6.5  noise
Combat         708.3 DPS +/-  6.2   was  702.9  +  5.5  noise
Ele Shaman     622.3 DPS +/-  7.6   was  617.5  +  4.8  noise
Frostfire      771.6 DPS +/- 18.2   was  768.3  +  3.2  noise
Shadow         749.4 DPS +/-  5.1   was  746.9  +  2.5  noise
Enh Shaman     716.8 DPS +/- 10.9   was  715.2  +  1.5  noise
Fire           689.6 DPS +/-  9.4   was  690.1  -  0.5  noise
Firelock       759.2 DPS +/-  4.9   was  759.7  -  0.5  noise
Cat            807.2 DPS +/-  5.1   was  807.2  +  0.0  noise
Prot Warr      526.2 DPS +/-  7.3   was  529.7  -  3.5  noise
Bear           426.9 DPS +/-  5.7   was  437.3  - 10.4  noise
```

**A BEFORE-AND-AFTER CANNOT ATTRIBUTE ANY OF THAT TO A RACE**, which is the
measurement lesson of the round. Every row carries its race's traits AND the
100ms poll the priority lists now pay, and a weapon specialization cannot be
isolated by removing the weapon because the weapon has its own crit on it.
`tools/probe_racial_worth.ts` swaps the RACE on identical gear instead, and
[docs/racials.md](docs/racials.md) has all nineteen cells. The three readings
worth carrying:

- **Tauren is worth essentially nothing to all five of its profiles, and that is
  correct.** The usable melee hit cap is 8 with no miss floor, so Endurance's
  point of hit is dead on the Cat (9% hit), the Bear (11%) and the Prot Warrior
  (8) — and +5% health does nothing to a build nothing attacks.
- **The Cat measured EXACTLY 0.0**, which is this project's own tell for a patch
  that did not apply. Here it is the honest answer, and what proves it is the
  Moonkin: same race, same file, and **+10.5**, because its SPELL hit was below
  the 16% cap.
- **The Bear is slightly NEGATIVE and that is the rage formula.** `D x 10 / H`,
  so a 5% bigger pool makes each point of damage taken worth less rage.

## THREE BUGS, AND EACH WAS CAUGHT BY A DIFFERENT KIND OF CHECK

| what | what found it |
| --- | --- |
| **Touch of the Grave CRITTED** — 200 crits in 200 drains | a test that gave the caster a hundred points of crit |
| **the racial entries at the top of each list broke Charge** — one cast a fight to ZERO | the existing suite, which has three positional tests about Charge |
| **`measure_profiles` reported all five racials as NEVER FIRED on all 25 profiles** | a direct count off the event stream disagreeing with the audit |

### "Cannot crit" is not what omitting `critFrom` says

The drain shipped with no `critFrom`, which is the obvious way to write it and
is about **the other case entirely**: `critFrom` governs an attack with NO table
— a periodic tick, which rolls for a crit and nothing else. An attack that
DECLARES a table takes its crit from that table, and the spell table's crit
slice *is* the caster's `spellCritChance`. So "uses the Spell Cast Combat Table"
and "cannot crit" are two requirements and the second needed its own field.

**THE FIRST VERSION OF THAT TEST AGREED WITH THE BUG.** It built the
`DamageRequest` by hand and omitted `cannotCrit` exactly as the reaction did, so
it passed. **A test that reconstructs the thing under test will reproduce its
mistakes** — it drives the reaction through real fights now and reads the event
stream.

### The entries' position in a priority list was measured, both ends, and both ends were wrong

| | what happened |
| --- | --- |
| **top** | Charge's `canCast` allows only the opening timestamp, and an off-GCD cast leaves the actor free — so `nextDecisionTime` returns `now + 100ms` and the window is gone. Two Warrior builds lost their opener entirely. |
| **bottom** | this project's own rule for a new entry, "the only position that cannot change what the list already does" — and it left **five of seven** racials never cast, because a list with anything castable never falls that far. |

They sit **second** now, and **last in a tank list** so that nothing can delay a
survival cooldown — which is the argument `protectionRotation.test.ts` already
made about Charge, in its own words, before any of this existed.

**THE BOTTOM RULE IS ABOUT AN ENTRY THAT COSTS SOMETHING.** These cost nothing —
no resource, and four of the five take no global cooldown — so what the bottom
costs instead is the entry ever being reached. Worth writing down because the
rule reads as unconditional.

### An audit that cannot name an ability reports it as never fired

`printUses` falls back to the raw ability id when `ABILITY_NAMES` has no entry,
then looks that up by NAME — which can never match. The racials arrived in every
list at once and were absent from that map, so **all five printed `<-- NEVER
FIRED` on all 25 profiles** while the event stream had each of them casting once
a fight. The map covers them now.

**AND THE FIX CREATED A SECOND PROBLEM THAT NEEDED FIXING TOO.** Once the names
resolved, every profile grew three or four HONEST zeros — a Gnome cannot cast
Blood Fury — and a real never-fired entry would have sat among them unnoticed.
The audit reads the built character's ability book now and prints **"(not
learned by this build)"**, which is the distinction CLAUDE.md already describes:
"reading the built character's own ability book is what tells the BUILD cause
apart from the POSITION cause rather than guessing."

## Four engine additions, each with one caller

| | for |
| --- | --- |
| `AuraDefinition.nonPeriodicDamageMultiplier` | Eureka!'s "+10%, periodic effects get nothing from it" |
| `DamageRequest.cannotCrit` | the bug above |
| `DamageRequest.ignoresAttackerDamageScaling` | "only scales off your Hit Points - not shadow damage talents" |
| `ReactionTrigger` gains `'periodicDealt'` | so Consecration's ticks can proc Touch of the Grave at all |

**`periodicDealt` IS THE ONE WORTH READING.** The owner names two exceptions to
"DoTs and channels proc only on the cast" — Arcane Missiles and Consecration —
and they need **two different mechanisms**. Arcane Missiles is a channel, and a
channel's ticks are not periodic, so each missile is already an ordinary
non-periodic damage event. **Consecration deals nothing at all on its cast**: it
applies a ground aura that ticks, and `dealt` reactions never see a tick. So
through `dealt` a Paladin's only area spell could never have procced, and the
exception would have been silently absent on a racial whose every other clause
was implemented.

Nothing that existed declares `periodicDealt`, so adding it changed no
behaviour — which is what made it safe to add for one caller.

## And a doc bug the table script has had from the start

`update_baseline_table.py` replaced the **first** `mean across **N** is **X**`
in the whole file, and the first one is fifteen hundred lines ABOVE the table,
inside a dated paragraph about the Shatter round. So every run since the script
landed published the current mean in the middle of a historical write-up, and
the sentence under the table — there wasn't one — stayed untouched.

**THE SCRIPT'S OWN HEADER IS WHERE THIS IS DOCUMENTED AS SOLVED**: "a script
that re-derives one copy of a figure leaves the other to drift". It was aiming
at the wrong copy. It anchors after the table it just rebuilt now, the live
sentence is under the table, and the historical paragraph states its own dated
700.0.

## What is left

- **Three live clauses the owner declined by name**, each declared with a reason
  and no `scope`: Orc Shatter Curse's −15% magic damage taken, Troll
  Regeneration, and Skyborne Read Ley Line's mana return. All three are
  expressible today and all three are worth 0.0 to every preset, because no
  preset is a Dwarf, a Night Elf or a Skyborne.
- **Four traits with no combat effect in any sense** — Underwater Breathing,
  Find Treasure, Engineering Specialization, Cultivation — are live gaps only
  because there is no `OutOfScope` member for "not combat", and adding one is a
  scope decision that needs the owner.
- **Three name the creature TYPE** (Beast Slaying, Big Game Hunter, Elemental
  Insight), which is the target's cause in a shape this project had not met: not
  "the boss is not a Beast" but "the encounter declares no creature type".
- **No preset is a Dwarf, a Night Elf or either Skyborne**, so Stoneform,
  Elune's Light and Wind Blessed are measured on their mechanisms and not on any
  profile. The one figure available for Elune's Light is a by-product of the
  confounded probe: a Night Elf Cat Druid measures **820.2** against a Skyborne's
  **811.5**, so **+8.7 for Elune's Light and Quickness together, net of a point
  of haste**. Stated as the compound it is rather than attributed to one trait --
  which is the mistake that probe made in the first place.

---

# THE APL IS EDITABLE, AND THE INTERRUPT CHECK WAS READING A LIE

**SM/DS 690.4 -> 695.3, AND NOTHING ELSE MOVED BY A DECIMAL.** The Action
Priority List is now data, shown in a panel, editable, and saved with the
character -- SEVEN commits, through six of which the 75 combat-log hashes from
`tools/rotation_fingerprint.ts` stayed identical. The one figure that did move
is a BUG FIX the owner found by using the panel, and it moves the only list in
the project with an interrupting entry.

**THE APL WAS THE LAST PART OF A CHARACTER THAT COULD NOT BE SEEN OR CHANGED**,
and the reason was structural rather than neglect: `PriorityEntry.condition` is
a CLOSURE. A function cannot be written to a file, rendered in a panel, or
edited by somebody who is not editing TypeScript -- so the thing deciding most
of a build's damage had no panel, no profile field, and no way to adjust it.
Everything below is downstream of turning that one field into data.

| | what it was | effect |
| --- | --- | --- |
| `10a2dd6` | Save and Load a profile as a file | no figure; **`petFamily` was being dropped on load**, which cost both Warlocks their Demonic Sacrifice |
| `d16a222` | a priority list becomes DATA; a panel shows it | 75 hashes unchanged across all 26 lists |
| `a6e769e` | the list is editable and stored on the profile, format 13 | 75 hashes unchanged |
| `6ea600b` | buffs chosen by NAME, not by typing an id | no figure |
| `739912c` | `any`, `not` and nested conditions | 51 of 132 conditions stopped being read-only |
| `5ee11c2` | 20 factory-built auras offered; interrupt becomes a checkbox | no figure |
| `7541f1b` | the interrupt check stops reading `already_casting` as an answer | **SM/DS +4.9**, 24 rows at 0.0 |

## THREE BUGS, ALL FOUND BY THE OWNER, NONE FINDABLE BY THE SUITE

The most useful thing in this round is not any one fix. It is that the owner
found three real bugs by USING the panel, and in every case the 2,970-test
suite was structurally incapable of finding them -- for three different reasons.

| what | why no test could see it |
| --- | --- |
| **Rip missing from the Druid's debuff dropdown** | every aura assertion keyed off ids the stock LISTS mention, and no stock list mentions Rip's aura -- the Cat gates Rip on combo points |
| **an interruptible channel polling for nothing** | the combat log was BYTE-IDENTICAL; only `eventsProcessed` moved, 13% on the Arcane Mage and 25% on the Shadow Priest |
| **the interrupt check reading `already_casting`** | the only list using the feature happened to avoid it -- all three Warlock entries are aura-gated with no cooldown and no cost they could fail |

**EACH ONE NOW HAS A TEST AIMED AT THE BLIND SPOT RATHER THAN THE SYMPTOM.**
The first reads the SOURCE of every aura module and fails if anything declared
there is offered to nobody. The second is why `rotation_fingerprint.ts` prints
the event count beside the hash. The third asserts the consequence (Mind Flay
keeps its ticks) AND the reason (`ignoreCastLock` reports `on_cooldown` where
the plain call reports `already_casting`).

**AND ALL THREE WERE REACHABLE ONLY BECAUSE THE PANEL EXISTS.** None of them
could fire on a stock list: the catalog gap needed somebody to want a condition
no stock list writes, the poll cost needed an ability marked interruptible that
no entry interrupts, and the interrupt bug needed a tick on an ability with a
COOLDOWN. **Shipping the editor is what made the engine testable by hand**,
which is worth more than any one of the three fixes.

## The bug, because it is the most transferable thing here

`selectInterrupt` decided whether to cancel a channel by asking `checkCast` for
its rejection reason and accepting `already_casting`. Its own comment explained
why that was safe:

> `already_casting` IS THE WHOLE TRICK. `checkCast` reports exactly one reason,
> in a fixed order, and the cast lock is checked second -- so an entry that
> comes back `already_casting` is one where NOTHING ELSE is in the way: it is
> affordable, off cooldown, in the right stance and its condition is satisfied.

**EVERY STEP OF THAT IS TRUE AND THE CONCLUSION IS BACKWARDS.** One reason in a
fixed order means an earlier reason HIDES every later one. The cast lock being
checked second means everything else is checked LATER -- which is to say, while
the caster is channelling, not checked at all. `already_casting` establishes
that the caster is ALIVE and nothing more.

**WHAT IT COST, AND WHY NOBODY SAW IT FOR A YEAR.** Nothing, until the panel let
somebody tick a box the stock lists do not. A Shadow Priest ticking "interrupt
Mind Flay" on Mind Blast cancelled the channel on every poll -- including the
whole eight seconds Mind Blast spends ON COOLDOWN -- so Mind Flay went from
about 30 ticks a fight to ZERO. The owner found it in one sitting.

**THE STOCK WARLOCK LIST HID IT PERFECTLY**, which is the part worth keeping.
All three of its interrupting entries are gated on an aura, and none of the
three has a cooldown or a cost it could fail -- so their CONDITIONS were doing
the work this check was supposed to do, and the check's own contribution was
never exercised. A list that happens to avoid a bug is not a list that proves
there is none.

Fixed by asking the real question: `castRejection(..., { ignoreCastLock: true })`
-- would this be castable if the channel were abandoned? Everything else is
checked as usual, the GLOBAL COOLDOWN included, because cancelling a channel to
sit on a running GCD throws the rest of it away and casts nothing.

**AND THE FIX IS WORTH +4.9 TO THE ONE PROFILE THAT USES IT.** SM/DS was
cancelling Wrack to cast spells it could not afford; it now keeps the channel.
The verdict prints `noise` against a +/- 3.7 interval and the mechanism is
exact, which is this file's own rule about a verdict being a statement on
variance rather than on whether anything happened.

## Two things the rebuild turned up on its own

**ENH SHAMAN WAS PUBLISHED AT 716.1 AND MEASURES 715.2**, a drift of -0.9 that
predates this work and that nothing in this round touched -- the containment run
has it at 0.0 either side. Rebuilding the whole table rather than patching the
one row that moved is what found it, which is the argument
`tools/update_baseline_table.py` exists to make.

**AND THE STATUS BLOCK'S COPY OF THE MEAN NEEDED UPDATING BY HAND AGAIN**, 699.8
to 700.0. The script re-sums the sentence under the table and knows nothing
about the block fifteen hundred lines above it. That is written down two
sections below as "a script that re-derives one copy of a figure is not a script
that re-derives the figure", and it was still true this time.

---

# FOREVER PATCH 1.60.1.70170 — FIVE rounds of change, read them as one

**THE LAST THREE COMMITS OF IT WENT OUT IN ONE SESSION, AND WHAT THEY HAVE IN
COMMON IS THAT NONE OF THEM WAS A NEW MECHANIC.** Two were owner changes to
numbers already modelled, one was two rulings that changed no code, and the
largest effect of the three came from a figure this repository had had wrong for
a year with its own docs recording the discrepancy.

| | | |
| --- | --- | --- |
| `9e4b4d0` | round four: Bear crit rage 2.0x, Shifting Power gated on energy, Reckoning's internal cooldown | Cat **+13.2**, and **one change measuring exactly 0.0 for an arithmetic reason** |
| `4672bde` | two rulings: Ice Lance's frozen case and Evocation's zero casts are both "intended" | no code; five sites stopped describing them as interpretations |
| `0d91c7c` | round five: melee and ranged miss **8%** against a level 63 target | **15 of 25 rows**, the widest-reaching change of the patch |

**THREE OF THE FOUR THINGS WORTH REMEMBERING ARE ABOUT MEASUREMENT RATHER THAN
ABOUT THE RULESET**, and all three are now in CLAUDE.md:

- **A change that measures 0.0 can be correct AND correctly worthless, for a
  reason the encounter decides.** Reckoning's 1.5-second cooldown cannot bind
  against one attacker swinging every 2.4 seconds. Probed rather than shrugged
  at, because an unexplained zero is indistinguishable from a change that never
  applied -- and the comment already beside the constant had PREDICTED the
  opposite in specific terms.
- **A gate can be worth POSITIVE DPS.** Every other condition in the project
  refuses a cast; one on an ability that GRANTS a resource stops the grant
  overflowing, so the Cat casts Shifting Power less and collects more.
- **A difference that gets documented still needs somebody to call it wrong.**
  The miss derivation reproduced two of the three flat constants it replaced and
  moved the third by a point, and said so in `docs/combat-tables.md` for a year.

And the fourth, which is about the shape of a patch rather than any one change:
**neither a write-up nor an empty question list ends one.** Round four arrived
after rounds one to three were documented as finished; round five arrived after
the commit that closed the last two open questions, and was bigger than either.

**TWO PEER BRANCHES ALSO MERGED DURING ROUND FIVE** -- a 25th profile and a
Rogue talent fix -- so its figures were taken three times. That is written up
with the round, and the transferable half is in CLAUDE.md: a delta is only
meaningful against the baseline it was taken from, and patching the one row that
moved publishes a comparison between two different baselines.

---


## Round five: melee and ranged miss 8% against a level 63 target, not 9%

**AND THE DERIVATION HAD BEEN WRONG SINCE PR #10, WITH THIS REPOSITORY'S OWN
DOCS RECORDING THE DISCREPANCY.** The owner's note -- "the new melee and ranged
attack miss chance against a level 63 target is now 8% not 9%" -- restores a
figure their combat table always stated.

**IT IS THE WIDEST-REACHING CHANGE OF THE FIVE ROUNDS**: **fifteen of the 25
profiles moved**, the mean went 695.3 to **698.8**, and the only rows at 0.0 are
the ones that could not be touched.

```
Combat         702.9 DPS +/-  4.8   was  691.1  + 11.7  REAL
DW Fury        901.8 DPS +/- 11.1   was  892.0  +  9.8  noise
LW Ranged      814.5 DPS +/-  6.2   was  805.9  +  8.6  noise
Seal Twist Ret 796.8 DPS +/-  7.9   was  788.4  +  8.5  noise
2H Arms        791.6 DPS +/- 10.9   was  784.1  +  7.5  noise
Enh Shaman     716.1 DPS +/- 10.5   was  708.6  +  7.5  noise
Venom          601.5 DPS +/-  4.7   was  594.5  +  7.0  noise
Shockadin      608.0 DPS +/-  5.0   was  601.3  +  6.7  noise
BM Hunter      777.8 DPS +/-  4.5   was  771.7  +  6.2  noise
Rupture        588.2 DPS +/-  4.6   was  584.2  +  4.0  noise
LW Melee       783.2 DPS +/-  8.4   was  779.7  +  3.5  noise
Prot Warr      507.5 DPS +/-  6.2   was  504.9  +  2.5  noise
Hemo           624.3 DPS +/-  6.4   was  622.4  +  1.9  noise
Prot Pally     357.0 DPS +/-  3.8   was  355.2  +  1.8  noise
Hawk Melee     826.1 DPS +/-  7.1   was  824.4  +  1.7  noise
```

**ONE REAL AND FOURTEEN INSIDE THEIR INTERVALS, ALL POSITIVE, AND THE MECHANISM
IS EXACT.** A point of miss is a point of miss; the per-profile size is just how
much of its damage goes through a melee or ranged table. Thirteen same-signed
"noise" verdicts is the shape this file describes under **MEASURE A LIST** --
where the mechanism predicts the direction, the verdict is a statement about
variance and not about whether anything happened.

### What was wrong, and what wrote it down

`BASE_CHANCES` in the first version of `attackChances.ts` carried `meleeMiss: 8`
and `rangedMiss: 8`, from the owner's own combat table. The commit that derived
the table from weapon skill (**#10**) gave the large-gap regime its own base of
6% on top of the small-gap 5%, so a 15-point deficit came to `600 + 15 * 20` =
**9%**.

**`docs/combat-tables.md` SAID SO AND IT STOOD FOR A YEAR:** *"the formulas are
consistent with the constants they replace; only miss moves, from 8% to 9%."*
Dodge reproduced its 6.5% exactly and glance its 40% exactly; miss alone moved a
point. **Two of three figures reproducing and the third moving is the shape of a
bug**, and it read as a note about the formula instead. **A DIFFERENCE THAT GETS
DOCUMENTED STILL NEEDS SOMEBODY TO CALL IT WRONG.**

The fix deletes the second base rather than back-solving a coefficient: one base
of 5%, with the per-point rate doubling past a 10-point gap, gives 8% at a
15-point gap on the nose. It is also monotonic now -- the old pair jumped 6% to
8.2% across the threshold and it goes 6% to 7.2%.

### The ten rows that did not move, and why none of them is a failure to apply

**EIGHT ARE PURE CASTERS** -- Moonkin, Ele Shaman, all three Mages, both
Warlocks, Shadow Priest -- and spell miss is a flat 17% the owner states
separately, untouched here.

**AND TWO ARE MELEE, WHICH IS THE ONE THAT NEEDED CHECKING.** Cat and Bear Druid
measured 0.0 to the decimal on a change to the melee miss table, which reads
exactly like a change that failed to apply. They carry **9% and 11% hit** against
a single paw with no dual-wield penalty, so their melee attacks **could not miss
before the change either** -- measured at 0.00% miss over 975 and 435
non-periodic attempts.

| | melee attempts | miss% now |
| --- | --- | --- |
| 2H Arms, Prot Warr, Cat, Bear, Enh Shaman, Prot Pally | 399-975 | **0.00** |
| DW Fury | 923 | 6.93 |
| Rogues (Venom / Combat / Hemo / Rupture) | 1004-1331 | 9.02 / 9.46 / 12.53 / 13.89 |
| LW Melee | 1352 | 11.76 |

**SO THE HIT CAP IS 8 NOW AND SIX PROFILES ARE SITTING ON IT.** Melee and ranged
have **no miss floor** -- the owner stated the 1% floor for spells and
`missFromSkill` is a different formula -- so the ninth point of hit buys a
non-dual-wielder nothing. **A DUAL-WIELDER IS WHAT KEEPS HIT VALUABLE**: the +19%
penalty lands in full on both hands, which is why the Rogues still miss 9-14% and
collected the whole point, and why Combat is the one REAL verdict.

**MEASURE THE MISS RATE OFF THE EVENT STREAM, NOT FROM THE CONSTANTS.** The first
probe here computed it per profile with a zero dual-wield penalty and said the
four Rogues would gain nothing -- they gained the most. The event stream is the
only reading that accounts for the penalty, per-hand skill and school-scoped hit
at once.

### And TWO peer branches landed mid-measurement, so every figure was taken three times

**THE BASELINE IS WHATEVER `main` SAYS ON THE DAY, AND IT SAID THREE DIFFERENT
THINGS.** Hawk Melee (#212) merged while this was being measured against a
24-profile main, and Seal Fate's per-use cap (#215) merged while it was being
re-measured against a 25-profile one. Each time the whole round was re-measured
rather than having rows patched into it.

| | what it changed | what it cost this round |
| --- | --- | --- |
| #212 | added a 25th profile, Hawk Melee 824.4 | a full re-measure; the 24 originals reproduced to the decimal and Hawk Melee came in at **+1.7** |
| #215 | Seal Fate capped per ability USE, moving Venom 600.8 to **594.5** | a full re-measure; **only Venom's row differed**, and this round's figure for it went +9.7 to **+7.0** |

**THE SECOND ONE IS WHY A ROW CANNOT JUST BE PATCHED.** Venom's +9.7 was measured
against a baseline that no longer existed, and the honest figure against the
Venom that ships is +7.0 -- a difference of 2.7 on a row that moved for reasons
having nothing to do with this change. **A DELTA IS ONLY MEANINGFUL AGAINST THE
BASELINE IT WAS TAKEN FROM**, and a peer merge to any profile this change touches
invalidates that profile's delta even though the mechanism is untouched.

**THE CONFLICT WAS THE BASELINE TABLE AND ITS MEAN BOTH TIMES**, resolved by
taking `main`'s and regenerating. Hand-merging two versions of a 25-row table is
the edit `tools/update_baseline_table.py` exists to prevent, and a mean that two
branches each re-summed from the same base is the arithmetic failure this file
documents under **Git workflow** -- neither branch could see the other.



---

# FOREVER PATCH 1.60.1.70170 — the first four rounds

The entries below this one are a single patch. They are separate commits because
the owner's answers arrived in batches, and **three of the four rounds were each
larger than anything in the patch notes.**

| | commit | what it was | largest effect |
| --- | --- | --- | --- |
| 1 | `13ff285` | the notes, plus four silent tree changes the importers found | DW Fury **+101.6**, Seal Twist Ret **-98.5** |
| 2 | `0f71ad5` | four rulings on questions round one RAISED | Fire **-187.6** |
| 3 | `58f505e` | one more coefficient the owner gave afterwards | Frostfire **-159.3** |
| — | `2929ad8` | this file and CLAUDE.md, written up after round three | no code |
| 4 | `9e4b4d0` | a Bear multiplier, a Cat APL clause, a Paladin internal cooldown | Cat **+13.2** |
| — | `4672bde` | two owner rulings: Ice Lance's frozen case and Evocation's zero casts are both intended | no code |
| 5 | *the entry above* | melee and ranged miss 8% not 9%, which the derivation had had wrong since #10 | **14 profiles**, Combat **+11.7** |

**SO "THE PATCH NOTES ARE EXHAUSTED" WAS NOT "THE PATCH IS IMPLEMENTED", AND IT
STILL IS NOT AFTER FIVE ROUNDS.** What the notes produced was a list of
questions; the answers are still arriving. **Round four landed after the patch
had been written up as finished in a commit of its own, and round five landed
after a commit that closed the last two open questions** -- and it was the
widest-reaching of the five. Plan for the next one to land in several commits,
and do not read a write-up, or an empty question list, as the end of it.

**THE TOP ROW CHANGED TWICE AND THE MEAN FELL 10.9 ACROSS THE FIVE ROUNDS** --
704.8 to **693.9** over the 24 profiles that existed throughout, re-summed from
the table rather than carried forward each time. It read 689.4 after round three,
690.2 after round four put 17.0 back across two Druid rows, and 693.9 after round
five raised fifteen rows at once; **the first two are published figures that are
no longer the mean**, which is why this sentence names the round each belongs to.

**AND THE TABLE'S OWN MEAN IS 698.8, WHICH IS NOT THAT NUMBER AND MUST NOT BE
COMPARED TO IT.** A 25th profile merged from another branch during round five --
Hawk Melee at 826.1, well above the mean -- so the denominator changed in the
same commit range as the figures. **A MEAN ACROSS A CHANGED PROFILE COUNT IS NOT
A COMPARISON**: reading 704.8 against 698.8 says the project fell 6.0 when the
builds that existed throughout fell 10.9 and a new row pulled the average up.
Either state the count beside the mean or compare the rows.
Frostfire took first place in round one, held it through round two and lost it in
round three; **DW Fury is the top row at 901.8**, and no caster is in the top
six for the first time since the consumables landed. The Mage's two best profiles
lost 347 DPS between them across rounds two and three, both on owner rulings
rather than on anything this project had got wrong, and the class's best row is
now ARCANE at 769.4 -- which has not moved by a decimal through any of it.

**THE BASELINE TABLE WAS REBUILT THREE TIMES AND NO ROW DRIFTED**, which is the
first time `tools/update_baseline_table.py` has been under real pressure. Each
round's `SAVE=` file was the next round's `BASELINE=`, so "the other twenty-three
moved by 0.0" means something per round -- measured against the PRE-PATCH figures
instead, every row a previous round moved would have shown as moving again and the
containment check would have been unreadable.

**WHAT THE PATCH COST IN DOCUMENTATION DRIFT IS WORTH READING TOO:** three derived
counts in these two files turned out already wrong by one -- the `scope` table's
`threat` row, the placeholder figure, and the hand-filled-values figure at 8
against 18 -- each sitting under a sentence promising it was counted rather than
adjusted. All three were found by running the one-liner the sentence describes.

---

**ROUND FOUR: A BEAR MULTIPLIER, A CAT APL CLAUSE, AND A COOLDOWN WORTH
NOTHING.** Three owner changes, all small, and the interesting result is the one
that measured zero.

```
Cat          807.2 DPS +/- 5.1   was 794.0  + 13.2  REAL
Bear         500.0 DPS +/- 5.7   was 496.1  +  3.8  noise
Prot Pally   355.2 DPS +/- 3.0   was 355.2  +  0.0  noise
```

The other 21 are 0.0 to the decimal, with round three's `SAVE=` file as this
round's `BASELINE=` -- the chained-baseline discipline this file argues for.
Measured against the PRE-patch figures instead, every row the first three rounds
moved would have read as moving again.

| | |
| --- | --- |
| **Bear crit rage 1.75x to 2.0x** | "Additional Rage generated from landing Critical Strikes increased to 100% increased Rage (Was 75%)". **+3.8, noise** -- a Bear is not short of rage, so the multiplier is close to free. It now EQUALS the Warrior's 2.0 and stays a separate constant |
| **Shifting Power gated on `energy <= 50`** | the owner's APL clause. **+13.2, REAL -- a gate that PAYS**, which is not the usual direction |
| **Reckoning's 1.5s internal cooldown** | **0.0 to the decimal, and arithmetically it could not have been anything else** |

**THE GATE THAT PAID, AND WHY A GATE CAN.** Every other condition in this project
costs something: it refuses a cast that would otherwise have happened. **An
ability that GRANTS a resource is the exception.** Shifting Power gives 40 energy
against a cap of 100, so over 20 fights:

| | casts a fight | energy gained | wasted |
| --- | --- | --- | --- |
| ungated | 8.00 | 280.0 | **40.0** (12.5% of the grant) |
| gated | 7.45 | **298.0** | **0.0** |

The gated list casts it LESS and collects MORE. The reliable waster is the pull --
every fight opens at a full energy bar. `wasted` on the `resource_gained` event is
what shows this; the DPS figure alone could not say which half moved.

**AND FIFTY IS THE OWNER'S FIGURE, NOT THE ARITHMETIC'S.** 40 into a cap of 100
overflows above **60**, so the stated gate sits ten energy inside the no-waste
region rather than on its edge. Both waste nothing -- so a reader who DERIVES the
threshold from the grant gets a defensible, different, wrong number, and the test
asserts the boundary is SAFE rather than tight.

**THE COOLDOWN THAT MEASURED NOTHING, AND WHY THAT IS A FINDING.** An internal
cooldown on a tank proc should bite, so 0.0 was worth a probe rather than a
shrug:

| | |
| --- | --- |
| attacks received a fight | **25** |
| median gap / minimum gap | **2,400ms / 2,400ms** |
| gaps under 1,500ms | **0** |
| blocks / crits taken | 10.3 / **0.0** |

The encounter has ONE attacker on a two-second swing timer
(`PLACEHOLDER_BOSS_SWING_SECONDS`), widened further by the tank's own Thunder
Clap slow. **Two triggerable events cannot fall inside a 1.5-second window**, so
the cooldown refuses nothing. It is correctly implemented and correctly worth
nothing HERE, and it starts binding the day the encounter swings faster or gains
a second attacker. **An encounter cause** -- and the target row of the inert
table now covers TIMING as well as properties, because that row reads as a list
of things the boss IS.

**THE COMMENT ALREADY ON THE CONSTANT PREDICTED THE OPPOSITE, SPECIFICALLY.** It
said a tank "is critically struck several times a second against a target that
ramps". Crits taken are **0.0** and attacks arrive every 2.4 seconds. It was
written in the same commit that implemented the cooldown, by somebody who had
just read this project's rule that a prediction in a comment is a measurement
that has not happened. Both halves are corrected and `paladinTalents.test.ts`
asserts the gap, so the claim is no longer prose.

---

**ICE LANCE'S COEFFICIENT IS A QUARTER OF WHAT IT WAS, AND IT TAKES THE TOP ROW
OFF THE TABLE.** The ruleset owner, in their own form: "Ice lance now has a
1.5/3.5/4 spell power coefficient instead of 1.5/3.5."

**Frostfire 927.6 → 768.3, -159.3 REAL**, and the other twenty-three identical to
the decimal. It was the top profile and is now **ninth**; **DW Fury took the top
row at 892.0.**

| | before | after |
| --- | --- | --- |
| base coefficient | 0.43 (`1.5 / 3.5`) | **0.107** (`1.5 / 3.5 / 4`) |
| frozen coefficient, times four | 1.714 | **0.4286** |
| Ice Lance's average hit | 3,892 | **1,827** |
| its share of the profile | **35.7%** | 20.6% |

**35.7% OF A PROFILE ON ONE INSTANT IS WHAT MADE IT WORTH CHECKING AT ALL.** Ice
Lance is a 160-mana instant that was averaging 3,892 a hit -- on 133-157 base
damage, so the coefficient was doing essentially all of it. A spell whose flat
damage is 4% of its average hit is one whose coefficient is the only thing being
measured.

**TWO FOURS NOW SIT NEXT TO EACH OTHER AND THEY ARE DIFFERENT FOURS.**
`ICE_LANCE_FROZEN_MULTIPLIER` is the ruleset's "300% increased damage against
frozen targets"; the four inside the coefficient is part of the owner's
expression. **So a frozen Ice Lance carries `1.5 / 3.5 / 4 * 4` -- exactly
`1.5 / 3.5`, the figure the spell had UNFROZEN before the change.**

**THAT COINCIDENCE IS THE TRAP, AND THE TWO WRONG READINGS ARE SIXTEEN APART.**
Reading the owner's `/4` as having already done the frozen division -- so the
ability should stop applying the multiplier -- makes a frozen cast a quarter of
its coefficient; applying the multiplier twice makes it four times. Both produce
a plausible number.

**AND THE OWNER HAS SINCE CLOSED IT IN SO MANY WORDS, 2026-10-08.** Asked whether
the `/4` was meant to have already done the frozen division: **"This is intended
stop asking."** So the reasoning below is no longer the authority, only the
explanation -- which is the distinction worth keeping, because an interpretation
flagged as an interpretation stays one however long it sits there, and this
project has twice found a months-old caveat still describing a settled fact.

The right reading is that a statement of a VALUE does not
overturn the separate owner ruling about which terms the multiplier reaches, and
`tests/game/iceLance.test.ts` pins the product END TO END rather than either
constant -- which is the argument the pet's 1.375 damage multiplier already makes
here: a constant check cannot see a double application.

**THE WHOLE SUITE PASSED THE CHANGE UNTOUCHED, WHICH IS A STATEMENT ABOUT THE
SUITE.** A 159-DPS move on a profile and nothing failed: nothing anywhere pinned
this spell's scaling. The new file is eight tests and it measures the coefficient
from damage that landed.

**AND THE FIRST DRAFT OF THAT MEASUREMENT READ 0.1136 AGAINST A DECLARED 0.1071**
-- a clean 1.06x, which is PIERCING ICE at 3/3 on the Frostfire build. The obvious
move was to suspect the transcription; what was wrong was the measurement. **A
SLOPE IS NOT A COEFFICIENT** -- it is the coefficient times everything between it
and the damage event -- so the test divides the school multiplier back out and
names it, rather than widening a tolerance until it passed. The frozen-to-unfrozen
RATIO needs none of that, because every such term cancels, and it is the
assertion to trust most.

**FOUR OWNER RULINGS ON THE 1.60.1.70170 PATCH, AND ONE OF THEM COST THE FIRE
MAGE A FIFTH OF ITSELF.** All four were questions raised in the patch PR rather
than guesses taken in it.

| Ruling | Effect |
| --- | --- |
| **Heating Up's 3 stacks are consumed by ONE Pyroblast** -- "This was an oversight by me" | **Fire 877.7 → 690.1, -187.6 REAL.** Frostfire -9.2, noise |
| **Dual Wield Specialization: "the client tooltip was correct"** | 0.0 -- already implemented that way, now a ruling rather than a judgement |
| **Gore Drinker can be considered inert** -- "a non-combat talent for DPS warriors" | 0.0 -- the four cast triggers are kept, the Enrage clause is a gap nobody is waiting on |
| **The Shadow Priest preset's talents are correct** | 0.0 -- so its recorded build URL was the stale half, and is re-encoded |

**THE OTHER TWENTY-TWO PROFILES ARE IDENTICAL TO THE DECIMAL**, which is the
containment check: three of the four rulings were meant to move nothing and did
not.

**-187.6 IS WHAT "CONSUMED BY ONE CAST" MEANS, AND THE SIZE OF IT IS THE POINT.**
Pyroblast went from **13.55 casts a fight to 1.75**, because the Fire build only
reaches three stacks **2.00 times a fight** -- 6.60 non-periodic Fire crits over a
hundred seconds, and a twenty-second window that resets on each one. Under the
old reading the three stacks sat there and every Pyroblast in the window was
75% faster; under the owner's they pay for one.

**IT SHIPPED THE OTHER WAY FOR ONE REVIEW AND WAITING WAS RIGHT.** The rename
note said only that the name had moved, so the mechanic was left alone and
flagged as an open question -- and the two readings are 187 DPS apart on one
profile. Guessing the generous one and saying nothing would have put that figure
in the table on nobody's authority. **A flag is what gets a question asked**, which
is the third time in this project that a recorded open question has been worth
more than a decision.

**THE OWNER'S GATE IS ALREADY THE BEST OF FOUR, WHICH IS WORTH KNOWING BEFORE
ANYBODY REORDERS THE LIST.** The two Fire-ish lists cast Pyroblast at EXACTLY
three stacks, and the whole range was swept rather than argued:

| Pyroblast gate | Fire | Frostfire |
| --- | --- | --- |
| **exactly 3 (the owner's)** | **690.1** | **927.6** |
| at least 2 | 686.9 | 895.4 |
| at least 1 | 652.5 | 803.2 |
| ungated | 452.6 | 443.8 |

A six-second cast at the top of a list is catastrophic, which is what the last
row is: an ungated Pyroblast blocks everything beneath it. **The sweep cost one
command and it is the only thing that could have said the gate was already
right** -- the alternative was an argument about whether 3s at two stacks beats
1.5s at three.

**AND EVOCATION HAS STOPPED FIRING ENTIRELY, ON ALL THREE MAGE PROFILES.** The
Fire build spends 7,854 mana where it spent 9,751, so it never drops to the tenth
of its pool the owner's entry is gated on. The ability is declared, granted, in
every Mage list and fully modelled -- **a LIST cause, not an engine or a build
one** -- and it is recorded rather than left to be discovered, because a
never-fired entry is a row that is not there.

**THAT TEST HAD BEEN INVALIDATED THREE TIMES BY CHANGES THAT HAD NOTHING TO DO
WITH EVOCATION**, each time because it asserted a CAST COUNT: first on one seed,
then as a rate over twenty when the consumables moved it, and now at zero. It
asserts the CONDITION on both sides of the threshold instead. A cast that depends
on a pool draining is a fact about every other entry in the list.

**AND THE SHADOW PRIEST FINDING GOT A TOOL RATHER THAN A FIX.**
`decode_talent_build.mjs --presets` diffs every recorded URL against the preset
constant it is supposed to describe -- which is the pass that found the eleven
point disagreement, done by hand, and had never been run before. It is **not a
test**, deliberately: when the two disagree one of them is stale and which is the
owner's call. The Warlock's documented one-point amendment is listed as expected,
so a NEW divergence is the only thing that reports.

**FOREVER PATCHED, AND SEVEN OF THE TWENTY RECORDED BUILD URLS STOPPED DECODING.**
Client build **1.60.1.70170**: every talent tree, rank value and spellbook
re-imported, **ten of the twenty-four profiles re-specified**, six of them moved
in DPS, and **four talents removed that the patch notes do not mention at all**.

| Profile | was | now | | |
| --- | --- | --- | --- | --- |
| DW Fury | 790.4 | **892.0** | **+101.6 REAL** | crit rage is +75.5 of it |
| 2H Arms | 721.5 | **784.1** | **+62.6 REAL** | Bloodthrill +33.5, crit rage +18.0 |
| Cat Druid | 770.0 | **794.0** | **+24.0 REAL** | Shifting Power for Tiger's Fury |
| Seal Twist Ret | 886.9 | **788.4** | **-98.5 REAL** | Champion of the Light -27.6, Vengeance -24.3 |
| Shockadin | 682.0 | **601.3** | **-80.7 REAL** | the same two, -31.9 and -22.5 |
| Enh Shaman | 727.2 | 708.6 | -18.6 noise | lost Elemental Fury to a tier swap |

**THE OTHER EIGHTEEN MOVED BY 0.0 TO THE DECIMAL** -- all four Rogues, the
Moonkin, both Warlocks, the Shadow Priest, Arcane, the BM and ranged Hunters and
the Elemental Shaman -- which is the containment check saying the patch reached
what it should and nothing else. Prot Warr +5.6, Bear +5.7, Fire +3.6, Frostfire
-10.4, LW Melee -8.0 and Prot Pally -0.2 are all inside their own intervals.

**THE FIGURES NAMED ABOVE ARE MARGINAL AND DO NOT SUM TO THE TOTAL.** Each is
"what reverting this one costs with the rest of the patch present", measured by
reverting EVERY file the change touched -- Bloodthrill's needed two, the
predicate and the values row, which is the isolation rule this project learned on
the Cat attribution probe.

**FOUR REMOVALS ARE IN NO PATCH NOTE**, and all four were being spent on:

| | |
| --- | --- |
| **Improved Holy Strike** | Paladin Holy. **All three** Paladin builds spent 2 points |
| **Crusade** | Paladin Retribution. Two builds spent 2, +2% to everything |
| **Precision** | Warrior Fury, +3% hit. No Warrior build took it |
| **Toughness** | Warrior Protection, named in the notes. No Warrior build took it |

So three of the four were silent, and the two Paladin ones forced all three
Paladin builds to be re-specified. **A SILENT TREE CHANGE IS NOT A SILENT
FAILURE HERE, AND THAT IS THE ONE PIECE OF LUCK IN IT**: the encoding is one
digit per talent IN TREE ORDER, so a removal shifts every digit after it and
`tools/decode_talent_build.mjs` throws rather than producing a legal-looking
build nobody chose. Seven of the twenty URLs it carried stopped decoding at once,
and the three Warrior builds were not in that list to stop.

**THE OWNER SUPPLIED FIVE NEW BUILDS WITH THE NOTES AND FOUR MORE WHEN ASKED.**
Druid Cat and Bear and all three Warriors came with the patch; the three Paladins
and Enhancement Shaman were decisions rather than transcriptions -- 4, 4 and 2
freed points, and an Enhancement build that can no longer reach Elemental Fury at
19 points in the tree -- so they were asked for rather than guessed. **The
Elemental Shaman is the one re-encoding**: it takes both of the swapped talents at
the same ranks, so its digits moved and its build did not.

**THE WARRIOR WAS ABSENT FROM THE DECODER'S LIST FOR THE WHOLE PROJECT**, which
is why nothing noticed its tree had changed shape. The one class with four
sources was the one class no build URL was checked against. All three are in it
now.

**ONE NEW ENGINE RULE, AND IT IS A RESOURCE RULE RATHER THAN A DAMAGE ONE.**
`Combatant.critResourceMultiplier` -- 2.0 for a Warrior, 1.75 for a Bear Druid,
1 for everything else -- multiplies the FLAT half of a resource award on a
critical swing. The flat half only: a `perDamage` award is already proportional
to damage and a crit has already doubled the damage, so multiplying it too pays
the bonus twice, which is a bigger number and no error. Forever's two rage rules
split exactly along that line.

**IT MAKES CRIT A RAGE STAT, WHICH IS WHY DW FURY MOVED MOST.** Two hands, high
crit and a rage-starved list: +75.5 of its +101.6. A tank gets +6.8 from the same
rule, because a Protection warrior is already capping and wasting income.

**AND SWIPE'S COEFFICIENT WENT 10% TO 3% ON A PATCH NOTE THAT CALLS IT A FIX.**
`WoWSimWorksheet.xlsx` says 10 and the notes say 3, and the notes are later --
the rule Rake's tick already runs on. It moves no figure in the table: Swipe is
in no priority list, because every encounter here has one target.

**TWO PATCH ITEMS NEEDED NO CHANGE AND BOTH ARE RECORDED RATHER THAN LEFT
SILENT.** "Devouring Plague can now correctly critically strike" always could
here -- every DoT in Forever can crit, and that is a RULE the owner gave for the
whole ruleset rather than a per-spell property, so the client had a bug this
simulator never reproduced. And Faerie Fire's swing timer is not applicable: the
ability is modelled only as a raid-buff debuff and no Druid profile casts it. **A
patch note with no diff beside it reads as something that was missed.**

**THE SPELLBOOK IMPORTER HAD A PARSER BUG THAT HAD BEEN EATING REAL COSTS**, and
a finisher is what exposed it. The cost grid carries a THIRD cost-shaped cell for
some spells -- `["30 Energy", "Melee Range"], ["1 to 5 Combo Points", ""]` -- and
the cost branch was the fall-through, so the second overwrote the first and Rip
and Ferocious Bite came back costing no energy at all. The same shape had been
replacing mana costs with reagent lines, pet-family lines and totem tools for
about a hundred spells across seven classes: **Shadowburn read "Reagents: Soul
Shard" where its cost is 365 mana**, and every Hunter pet ability read its family
instead of its focus. `extraLines` carries them now and the first cost-shaped
cell wins, so a fourth kind of line cannot delete a cost either.

**NOTHING READS THAT CAPTURE PROGRAMMATICALLY**, which is exactly why it went
unnoticed: the wrong number sat in a reference document that a reader would have
believed. See [docs/source-cross-checks.md](docs/source-cross-checks.md).

**TWO DERIVED COUNTS IN THIS FILE WERE ALREADY WRONG BY ONE, AND RE-COUNTING
FOUND BOTH.** The `scope` table's `threat` row said 14 against 13 declarations,
and the placeholder figure said 10 against 9 -- each the arithmetic failure
CLAUDE.md documents under **Git workflow**, and each in a column whose own
instruction says to re-count rather than adjust. The placeholder count is 10 now
because this patch adds one, which is the coincidence worth naming.

**THE WARLOCK HAS A WEAPON STONE, AND BOTH PRESETS NOW CARRY ONE.**
`profile.warlockStone` -- a Firestone or a Spellstone, selected in the Gear panel
beside a Rogue's poisons, and **profile format v11**. The owner's choice:
**SM/DS takes the Spellstone (+19.6 REAL) and Firelock the Firestone (+20.8
REAL)**, and the other twenty-two profiles are identical to the decimal.

| Profile | none | Firestone | Spellstone |
| --- | --- | --- | --- |
| Firelock | 568.3 | **589.1, +20.8 REAL** | 575.0, +6.7 noise |
| SM/DS | 496.9 | 504.4, +7.6 REAL | **516.8, +19.9 REAL** |

**A FIRESTONE IS NOT A "FIRE STONE"** -- only its +21 is school-scoped, while its
2% spell crit is whole-character, which is why it is the better stone for a Fire
build and still worth +7.6 to a pure Shadow one.

**THE DEFAULT IS STILL `none` AND NO SAVED PROFILE MOVED.** The presets state the
owner's choice; `createDefaultProfile()` states no choice at all, which is the
opposite of version 10's poison decision and for the stated reason -- the owner
supplied the poison pairing, and a saved Warlock has simply never been asked.

**ONE FIGURE IN AN EARLIER VERSION OF THIS ENTRY WAS WRONG**, and the tell was
visible: SM/DS's two stones were reported at an IDENTICAL 484.6, which two
different stat bundles do not do across thirty batches. See
[docs/handoff/warlock.md](docs/handoff/warlock.md).

# BLOCK IS CORRECTLY IMPLEMENTED AND CORRECTLY WORTH ALMOST NOTHING

Both block rows come back "not measured" in the tank weights even at 3000
iterations. That was chased rather than accepted, and it is **a magnitude, not
a wiring fault**. No code changed.

**THE MECHANISM IS LIVE, CHECKED BY SCALING IT.** Blocks are not rare -- the
Prot Warrior blocks **16.05 of 26.60** attacks a fight, because Shield Block
takes its 11.16% table slice far higher for its duration -- and the value is
applied: **+5000 block value removes 64,243 damage and takes deaths from 8.69
to 4.82**.

**THE RATIO IS ARITHMETIC AND IT CHECKS OUT.** A dodge removes the whole blow
and a block removes a flat 97 of it, so a point of block chance should be worth
a point of dodge chance times `blockValue / meanHit`:

      97 / 5230       = 1.85%   predicted
      0.0017 / 0.1375 = 1.2%    measured

Block chance does not resolve even at a 30-point step (`0.00238 +-0.00274`),
which is itself the answer. Block VALUE does at a larger one -- 0.00205 a point
at 50, 0.00133 at 200, 0.00107 at 1000 -- the fall being that a block never
removes more than the blow it lands on.

**THE CAUSE IS THE ENCOUNTER'S DAMAGE RAMP, AND THAT IS A PLACEHOLDER.** The
boss opens at 5,000 and every swing is 10% harder, so incoming hits grow from
**1,624 early to 12,458 late** while block value stays flat at 97 -- six percent
of an early blow and 0.78% of a late one. Block's entire contribution is
**1,556 of 139,118** damage taken, 1.12%.

`targetSwingDamage` and `BOSS_DAMAGE_RAMP` are both invented numbers borrowed
from Classic, so **whether a flat mitigation stat means anything in this project
is currently decided by a placeholder** -- a question for the ruleset owner
rather than something to tune. See **What to do next**.

# PARRY HASTE POINTED THE WRONG WAY, AND THE BASELINE IS REFRESHED

**THE RULESET OWNER, CLARIFYING THEIR OWN WORDING:** "if I parry an attack MY
NEXT ATTACK COMES SOONER. If a boss parries an attack THEIR NEXT ATTACK COMES
SOONER." It shipped the other way round in the entry below -- `dealDamage`
passed `source`, the unit whose blow was turned aside, where it should pass
`target`, the parrier.

| Profile | was | now | |
| --- | --- | --- | --- |
| Prot Warr | 543.5 | **529.7** | **-13.8 REAL** |
| Bear | 448.4 | **437.3** | -11.0 noise |
| Prot Pally | 369.7 | **362.9** | **-6.8 REAL** |

The Shockadin does not move, correctly: its target does not swing back, so
nothing parries it and it parries nothing. The other twenty-one moved by 0.0.

**THE ORIGINAL SENTENCE IS WHY.** "Successfully parrying an attack reduces the
ATTACKER'S remaining swing timer by 40% of their max swing time" reads as the
unit whose blow was parried; it means the parrier, who is an attacker in their
own right.

**AND THE WRONG READING WAS SELF-CONSISTENT AND DANGEROUS-SOUNDING**, which is
what carried it through a review and a full measurement pass: it made a tank
parrying a boss speed the BOSS up, which is exactly what a tank is supposed to
fear, and every figure it produced hung together.

**IT EVEN PRODUCED A FINDING THAT READ AS INSIGHT, AND THAT FINDING WAS
PUBLISHED.** The tank weights priced parry at 42% of dodge, which was written
up, committed and opened as a PR before anybody asked why two stats that both
avoid the entire blow should differ by 2.4x. **The owner asked.** Corrected,
they are **0.1598 +-0.0393** against **0.1485 +-0.0346** and indistinguishable;
with the mechanic stripped off entirely they are IDENTICAL TO FOUR DECIMAL
PLACES, which is stronger than "similar" -- under shared seeds the two variants
then run bit-identical fights, so there is provably no other asymmetry between
them anywhere in the engine. `tools/probe_parry_haste.ts` is the command.

**A MEASUREMENT THAT IS INTERNALLY CONSISTENT IS NOT A MEASUREMENT THAT IS
RIGHT**, and the thing that caught this was not a test or an audit: it was
somebody reading two rows of a table and knowing what they ought to say.

**WHERE IT ACTUALLY BITES IS THE OPPOSITE OF WHERE IT LOOKED.** The boss parries
14% of the TANK's blows and the tank attacks far more often than the boss
swings, so the boss is hurried by the tank's own ATTACKS rather than by its
defence -- and several parries land inside one boss swing cycle, driving it to
the 20% floor. Its minimum gap is **480ms** where the wrong direction gave
1,440ms, and the Reckoning test's floor assertion moved with it.

Isolated one side at a time on Prot Warr, 1500 iterations:

| parry haste on | player swings | attacks received | deaths |
| --- | --- | --- | --- |
| neither | 12.80 | 25.49 | 7.973 |
| the player only | **13.15** | 25.49 | 7.964 |
| the boss only | 11.67 | **27.14** | 9.262 |
| both | 12.25 | 27.20 | 9.267 |

The player's own parries raise its swings with attacks received untouched; the
boss's raise attacks received. **THE PLAYER'S SWING COUNT FALLING IN THE
BOSS-ONLY ROW IS NOT A TIMER FAULT** -- it is Heroic Strike replacing more
auto-attacks as rage rises, and a replaced swing reports under its own name.
A column that counts "Main Hand Auto-Attack" is counting UNREPLACED swings.

## The baseline table is rebuilt

All 25 re-measured at `f9d425b` and the table below rebuilt by
`tools/update_baseline_table.py` -- four rows bold, being the ones three
commits of parry work moved against what the table last carried. **The mean is
re-summed from the table's own rows**: **699.8** against 698.8.

**THE SECOND COPY OF THE MEAN DID NOT MOVE WITH IT, WHICH IS THIS FILE'S OWN
RECURRING FAILURE.** The script rewrites the sentence under the table and knows
nothing about the status block fifteen hundred lines above it, which carried
698.8 until this commit. **A script that re-derives one copy of a figure is not
a script that re-derives the figure.**

The rest of that block was re-derived and had not moved: **260 / 39 / 105 / 62
of 466** from `tools/class_audit.ts`, **10** placeholder DECLARATIONS, **129**
scope entries across **9** members. The test count had: 2,750 to **2,809**.

# TANK STAT WEIGHTS, AND TWO RULESET CHANGES THAT CAME WITH THEM

**FOUR PROFILES MOVED AND TWENTY-ONE DID NOT.** The two rulings below are real
combat changes, so this is not a containment check that came back clean -- it is
four rows that were supposed to move and did.

| | was | now | |
| --- | --- | --- | --- |
| Prot Warr | 507.5 | **543.5** | **+36.0 REAL** -- parry haste, more rage |
| Bear | 500.0 | **448.4** | **-51.6 REAL** -- now parried |
| Shockadin | 608.0 | **667.7** | **+59.7 REAL** -- no longer parried |
| Prot Pally | 357.0 | **369.7** | **+12.8 REAL** -- parry haste |

## Enemy parry follows the ENCOUNTER, not the weapon in hand

The owner: "when the Target Attacks Back checkbox in the Encounter panel is
selected, the target gains a 14% chance to parry you." It replaces a reading of
the source's "0% if 1H & Shield is not selected" as a statement about the STYLE
-- only a shield tank stands in front of the boss.

**THAT READING WAS WRONG IN BOTH DIRECTIONS EITHER SIDE OF THE ONE CASE IT GOT
RIGHT.** The BEAR tanks without a shield and was never being parried; the
SHOCKADIN holds a shield against a dummy that never swings and was being parried
by it. `CombatStyleLookup` is gone with the change, because enemy parry was the
only thing it fed -- so a chance provider no longer needs to know how anybody
fights.

## Parry haste

40% of a full swing off the remaining timer, floored at 20% of a full swing,
"to both players and mobs, including raid bosses" -- all the owner's.
**PARRYING HURRIES THE PARRIER'S OWN NEXT SWING.**

**AND IT SHIPPED POINTING THE OTHER WAY, OFF THE OWNER'S OWN SENTENCE.**
"Successfully parrying an attack reduces the ATTACKER'S remaining swing timer"
reads as the unit whose blow was turned aside, and that is how it was built.
The clarification settles it: "if I parry an attack MY NEXT ATTACK COMES
SOONER. If a boss parries an attack THEIR NEXT ATTACK COMES SOONER." The entry
above this one is the correction and what it cost.

**BOTH FRACTIONS ARE OF A FULL SWING AND NOT OF WHAT IS LEFT.** That is what
makes it converge: each parry takes a fixed 40% off and the floor sits at 20% of
a swing, so no run of parries can drive a timer to zero. Read the floor as 20%
of the REMAINING time and it could be squeezed arbitrarily close, which is a
different and far more dangerous mechanic.

**IT HAS TO BE SCHEDULED, NOT APPLIED INLINE, AND THE FIRST VERSION FIRED
EXACTLY ZERO TIMES.** A swing's handler resolves its blow and only THEN
schedules its successor, so at the moment `dealDamage` sees the parry the handle
on the combatant is the swing that is CURRENTLY FIRING, with no time left on it.
**SIX UNIT TESTS PASSED THROUGHOUT**, because a test that calls `dealDamage` by
hand at a chosen moment DOES leave a real future swing pending -- the one case
the live path never presents. What caught it was measuring the mechanism's own
quantity: three tank profiles took **25.5 attacks a fight before the change and
25.5 after it**. One `events.schedule` at the current timestamp is the fix, and
it is the same fix for the same reason `extraAttack` schedules rather than
swinging inline. There is an end-to-end test now that counts swings over a whole
fight.

**AND IT EXPIRED A TEST THAT HAD BEEN RIGHT, ON SCHEDULE.**
`paladinTalents.test.ts` asserted Reckoning's 1,500ms internal cooldown "cannot
bind in THIS encounter, because the one attacker swings slower than it" -- true
while the boss's slowed swing was 2,400ms, and its own note said it "expires the
day the encounter swings faster". Parry haste makes that **1,440ms**, sixty
milliseconds inside the window: the minimum gap is now exactly 1,440ms and **88
of 1,016 gaps** fall under 1,500ms. The test asserts the opposite now and keeps
the history.

## The tank table

When the target swings back, a second weights table asks what a point TAKES OFF
THE DEATH COUNT rather than what it adds to DPS. "Avoid death" is treated as a
stat in the owner's own framing -- 30 agility taking deaths from 10.5 to 9.8 is
**+0.7 avoid death** -- so the sign is flipped once and more is better in both
tables.

**IT COSTS NO EXTRA FIGHTS.** `sampleIterations` counts deaths while it sums
damage, so the two tables are two readings of ONE measurement rather than two
runs that might disagree.

**DEATHS ARE A RICH COUNT HERE, WHICH IS WHAT MAKES THEM WEIGHTABLE.** The
encounter ramps the boss 10% a swing and stands the character back up without
resetting the ramp, so a tank dies **8 to 11 times** in a sixty-second fight.
The quantity is really "how far into the ramp this build survives" rather than a
chance of wiping.

Prot Warr at 600 iterations: dodge chance **0.128 +-0.079** deaths avoided a
point, parry **0.049**, defense skill **0.015**, agility **0.0069**, stamina
**0.0058**, armor **0.0004**. A stat that cannot move the count -- attack power,
spell power -- is left OUT rather than listed at zero, while `inconclusive` rows
stay, because "the run could not resolve this" is a different statement from
"this does nothing".

# STAT WEIGHTS — a new feature, and a measurement technique worth reusing

**No DPS figure moved.** Nothing about an existing run changed: `BatchResult`
gained a `dpsSamples` field that the batch already built, and everything else is
new. All 25 published rows were re-measured against `1718277` and every one came
back at **+ 0.0**.

What it does: one baseline run, then one run per selected stat with it
temporarily added, and the weight is the DPS difference over the amount added.
A checkbox under the Run button turns it on; `tools/stat_weights.ts` is the same
thing from a command line. [docs/stat-weights.md](docs/stat-weights.md) is the
write-up.

**THREE OF THE FOUR DESIGN DECISIONS APPLY TO EVERY BEFORE-AND-AFTER THIS
PROJECT TAKES, which is the part worth carrying away.**

| | |
| --- | --- |
| **share the base seed** | the before and the after then run bit-identical fights, and differencing them ITERATION BY ITERATION is worth about **5,000x in variance**: +30 strength on DW Fury is 17.55 ±0.18 over 500 paired iterations against 16.15 ±12.33 over 500 independent ones |
| **but not for every change** | one random stream, so a flipped miss roll reorders every later draw. The per-iteration SPREAD of the paired difference says which: 1.8 DPS for +30 strength, **124.7 for +9% hit** |
| **but do not give the noisy ones more fights** | allocating from the spread is correct and twice as cheap, and the owner ruled it out: it made two rows of one table incomparable. Report the INTERVAL instead |
| a capped stat is several stats | the owner's ruling, and new |

**THE OWNER'S OWN DESIGN FOR HIT IS THE INTERESTING ONE.** "Chance to miss" is
up to FIVE numbers and a build can be capped on one and not another -- a Combat
Rogue on 16 points of hit has **nothing left on its specials, nothing on its
spells, and eleven points left on its auto-attacks**. So hit is measured as a
LADDER, one weight per interval between the caps, which the owner put as "these
can be treated as multiple stats in effect".

**AND A TIER IS LINEAR BY CONSTRUCTION**, which is what makes the big step safe:
the boundaries sit exactly where a table stops paying, so nothing changes
behaviour inside one. DW Fury measures **5.8971 ±0.5058** to cap its off hand
and **2.6146 ±0.4053** for the ten more points that cap its main hand, and the
monotone fall is the check that the boundaries are where they should be.

**NAME A RUNG BY WHAT IT REACHES, NEVER BY ITS WIDTH -- the owner caught this
on sight.** The first version said "Hit chance — first 9.00%" and the reply was
that the melee cap is 8%, not 9%, and that it should never add 9 unless the
character has no hit at all. Both halves of that are right about the WORDING
and the number was never wrong: 9.00 is what DW Fury has LEFT on its off hand
once its 8 points of gear hit and 10 from Dual Wield Specialization have come
off a 27% dual-wield miss. **A width reads as a cap.** It says "+9.00% → caps
Off-hand swings" now, and nothing is truncated -- a rung runs to the cap it
names, because the question is how much it would TAKE.

**AND THE 8% MISS FIX LANDED WHILE THIS WAS BEING WRITTEN, WHICH MADE THE
OWNER'S OTHER EXAMPLE REAL.** `#214` took melee miss from 9% to 8%, so the
Protection Warrior's 8 points of gear hit now cover every table it rolls on:
its ladder comes back EMPTY and the panel says **"Already capped. No stat
weight."** -- which is the case the cap reporting was asked for, and it did not
exist on the branch point. Four figures and two tests in this work had to be
re-derived for it; see **Git workflow** in CLAUDE.md, which is where that
hazard is already written down.

**A ZERO IS A REAL ANSWER HERE AND IT HAD TO BE TOLD APART FROM AN ABSENCE OF
ONE.** Shared seeds make a stat the build cannot read produce a delta of exactly
0.00, which is this project's own tell for "the patch did not apply". The
planner BUILDS the character with the stat added and checks it arrived before
spending a fight, so "worth nothing" and "never applied" are separated before
the measurement. `WeightVerdict` is `measured` / `none` / `inconclusive`,
because 0.0000 and 0.08 ±0.9 render as the same zero and only one is an answer.
**Checking the delta alone does not find an identical pair** -- a constant +18
on every iteration has a spread of zero too, and the first version called that
"nothing". A test caught it.

**WEB WORKERS, WHICH `simulator/index.ts` HAS ANTICIPATED IN WRITING SINCE
BATCHING WAS WRITTEN.** 157.5 seconds to **41.7** for DW Fury's full 21-stat run
at 3000 iterations each, 54,000 fights, on eleven workers. The engine needed no
change for it: iterations are independent and nothing holds module-level state.

**THE BASELINE IS THE FLOOR AND IT CANNOT BE SPLIT.** `BatchTotals` is one
accumulator for the whole run, so every breakdown on the results page comes off
one thread. **Merging it is the obvious next step** and was not worth the blast
radius for this commit.

**AND THE UNIFORM ITERATIONS COST ROUGHLY DOUBLE, WHICH IS THE TRADE THE OWNER
MADE DELIBERATELY.** 24,000 fights became 54,000 and the wall clock went about
23s to 41.7s. What it bought is a table that can be read straight down: under
the allocation, a stat worth nothing settled in 250 fights and hit took 3000,
and nothing on screen said which row rested on which.

**THE BASELINE IT PRINTS IS NOT THE PUBLISHED ONE, and that is not a
regression.** 3000 iterations at a fresh seed has a standard error of about 1.8
DPS; `measure_profiles.ts` is 300 fights at about ±11.1. Three runs read DW Fury
at **894.7, 896.8 and 900.7** against a published **901.8 ±11.1** -- they agree,
and the stat-weight figure is simply tighter. Recorded because a reader who sees 885
beside a table saying 892 will otherwise go looking for a bug.

**THE SELECTION IS UI STATE, NOT A PROFILE FIELD**, which is the opposite of
poisons, raid buffs and consumables. The rule those followed is that a choice
which CHANGES WHAT A FIGHT PRODUCES belongs on the profile; this changes no
fight, so a format version, a migration, a line in each of the 25 presets and a
field `measure_profiles.ts` has to ignore would all buy nothing. `CURRENT_PROFILE_VERSION`
is still **12**.

# Handover

**Status only.** Rules and conventions are in [CLAUDE.md](CLAUDE.md); how a class
gets built is [docs/class-implementation.md](docs/class-implementation.md).

## Where the project is

All nine classes and all **25** profiles are implemented, every number traced to a
source rather than invented, and **every priority list is the ruleset owner's
own** -- specified entry by entry and measured after, the newest being Hawk
Melee's, given as "the same as the LW melee hunter" plus one placement.
**3,076 tests**, CI green on Node 20 and 22. Profile format **v13**. Live at
<https://donz-dev.github.io/SimForever/>, republished by
`.github/workflows/deploy.yml` on every push to `main` that passes.

**THE "23" IN THAT SENTENCE WAS STALE FOR MONTHS, AND THIS FILE ALREADY SAID
SO** -- the mean's own entry records that "Hemo made it twenty-four and the
sentence kept saying twenty-three". It was corrected one place and not the
other, which is the drift this document warns about one level down and then
demonstrated at the top. **Re-count rather than re-reading the sentence.**

### The state in one table

| | |
| --- | --- |
| **Talents** | 260 fully, 39 partly, 105 ruled out, **62 a live gap**, out of **466** -- from 132 before the class dives |
| **Abilities** | 114 declared against 478 captured |
| **Profiles** | **27**, all measured, **mean 774.0** on FOREVER'S OWN ITEMS -- Combat Mut is the first profile ADDED rather than measured, and the count had been 25 since the gear swap -- every earlier figure in this file was measured on Classic and Season of Discovery stand-ins, so the contributions below belong to that gear and not to this mean: the armour enchants were +27.0 of it, the pre-pull consumables +105.9, the racials **+9.8 at round one**, the MID-FIGHT consumables **+17.7** and the Life Tap gate **+3.5** |
| **Racials** | **10 races, 40 traits**: 15 do something, 20 effects ruled out, 11 a live gap |
| **Scope rulings** | **9 members**, all the owner's, carrying 129 TALENT entries and 19 racial declarations |
| **Placeholders** | **11 declared** -- see the milestone table, and count DECLARATIONS. **One of the eleven is not a ruleset number**: `PLACEHOLDER_PREFERRED_WEIGHT` is the Gear panel's stat-sorting weight, which no simulation reads, so it can sort a list badly and cannot move a figure |
| **Tests** | **3,341** on Node 20 and 22 |

**FOUR CLASSES ARE ESSENTIALLY DONE** -- Warrior 1 live gap, Paladin 1, Druid 2,
Rogue 3 -- and the remaining 62 sit mostly in the Warlock (19), Priest (12) and
Mage (10). **The Warlock's 19 overstates its own work**: thirteen of them are one
build cause, Demonic Sacrifice killing the demon, so its real queue is about 11.

**AND THIS BLOCK'S MEAN HAS NOW DRIFTED FOUR TIMES.** It read 700.0 against a
table at 709.6 after the racials, and 709.6 against a table at 730.9 after the
mid-fight consumables -- each time because `update_baseline_table.py` re-sums
the sentence under the table and knows nothing about this one fifteen hundred
lines below it. The script was fixed in the racials round to stop writing the
live mean into a DATED paragraph; it still does not know about this copy, and
there is no obvious way for it to.

**THE INSTRUCTION WAS ALREADY HERE AND WAS STILL NOT ENOUGH.** "Grep for the
figure after rebuilding the table" has been written in this block since the
racials round, and the figure drifted anyway the very next time the table moved.
A note telling a reader to re-derive a number is not the same as the number
being re-derived -- which is this file's own recurring failure, recorded for the
fourth time about the same four digits.

**THE RACIALS' +9.8 IS ROUND ONE'S AND NOT THE FEATURE'S NET**, which is 700.0
to 709.6 -- round three gave 0.2 back, and that 0.2 is five Undead rows moving
INSIDE their intervals rather than a loss. Attributing it would be publishing
noise as a figure.

**THE TWO RACIAL ROWS ARE COUNTED PER RACE AND THE SCOPE ONE PER DECLARATION**,
which differ by one and are both right: the two Skyborne races SHARE three of
their four traits, so Walk on Air's single `positioning` tag is two entries in
the census and one in a grep. `racials.test.ts` pins the per-race figures by
hand; the one-liner is in CLAUDE.md beside the scope table.

**EVERY FIGURE IN THAT TABLE IS RE-DERIVED RATHER THAN ADJUSTED**, and the two
that moved this time are the mean and the test count -- the mean because three
commits of parry work moved four tank and shield rows, and the tests because
those commits added fifteen. **The mean is re-summed from the table's own 25
rows** -- 689.4, 690.2 and 698.8 are earlier published figures that still appear
in this file against the commits they belong to, and 704.8 was over 24 profiles,
so it is not comparable to 699.8.
**AND 698.8 SURVIVED HERE FOR ONE COMMIT AFTER THE TABLE MOVED OFF IT**, because
`update_baseline_table.py` rewrites the sentence under the table and knows
nothing about this block. A script that re-derives ONE copy of a figure leaves
the other to drift, which is the same shape as the counts this paragraph exists
to warn about. The census, placeholder and
`scope` figures were re-counted and had not moved: **260 / 39 / 105 / 62 of 466**
from `tools/class_audit.ts`, 10 placeholder DECLARATIONS, and **129 scope entries
across NINE members**.

**AND THAT LAST COUNT CORRECTS BOTH FILES, WHICH HAD SAID SEVEN.** `OutOfScope`
declares nine and all nine are used. "Seven members, all of them the owner's" was
true on the day the Shaman dive's two were ratified, and `dispel` and `immunity`
arrived later from a single question whose answer split in two -- so the sentence
recording the ratification was correct and the total beside it was never updated.
**A COUNT IN PROSE DECAYS EVEN WHEN THE SENTENCE AROUND IT STAYS TRUE**, which is
why the instruction is to re-count rather than adjust, and why the one-liner that
does it is written down next to the table.

**THE TALENT TOTAL IS 466 AND WAS 468**, which is client build 1.60.1.70170
removing four talents and adding three. Every figure in that row is re-counted
from the declarations by `tools/class_audit.ts`, which throws if its four buckets
do not account for every talent -- and the `scope` and placeholder figures beside
it had each drifted by one before this re-count found them.

**THE WARRIOR IS NO LONGER AT ZERO**, and its one gap is new: Lingering Rage,
which lengthens the delay before rage decays after leaving combat. Nothing here
leaves combat, so it is inert -- and it carries no `scope` tag, because whether an
out-of-combat state belongs in scope is the owner's decision and a scoped entry is
filed as answered. Anger Management's second clause is the same question and is
carried in a comment rather than a declaration, which is why the census counts
that talent as fully modelled.

### How it got here: the nine-class push

**NINE PARALLEL DEEP DIVES, ONE PER CLASS, EACH IN ITS OWN CONTEXT**, briefed from
[docs/handoff/](docs/handoff/) and merged one at a time with the census re-derived
after every merge. What each was worth is recorded per class below and in its own
brief. The headline is that the live-gap count halved and the mean rose about 80
DPS, and that **almost none of it was new engine capability** -- most of what the
dives closed were declarations that could have been written at any point, plus
owner rulings that arrived when asked for.

**AND THE MERGE ORDER COST MORE THAN ANY SINGLE DIVE.** Three capabilities were
built two and three times by contexts working in parallel, and the bill landed on
whichever branch merged last: the Rogue came back carrying seven divergent APIs
and had to be translated rather than merged. That is written up as a rule in
CLAUDE.md and in full in [docs/handoff/README.md](docs/handoff/README.md) --
**land the shared engine pieces first**.

### And then the Hunter moved twice more

**THE HUNTER IS THE ONE CLASS THAT KEPT MOVING AFTER ITS DIVE**, and the second
round was a CORRECTION rather than a gain:

| | |
| --- | --- |
| the dive | BM Hunter 405.8 to **731.8**, almost all of it two owner answers -- the pet's base DPS 50 to 150, and the hawk at 108 |
| the raid buffs | 731.8 to **788.1**, Trueshot Aura and the Grace of Air swap |
| the pet damage model (#150) and Summon Hawk (#151) | 788.1 down to **646.6** |
| Summon Hawk again (#153) | 646.6 down to **547.0** |

**SO THE 788 WAS NEVER A REAL FIGURE, AND NEITHER WAS THE 731.8 OR THE 646.6.** A
placeholder answered generously, measured, published, and then corrected twice as
the real model arrived -- which is the cycle those named constants exist to make
possible, and the reason a figure resting on one is published with its placeholder
named rather than quietly. BM Hunter fell from first to sixth across the two
corrections, and is **546.1** now.

**THIS PARAGRAPH WAS STALE WITHIN THE HOUR, WHICH IS THE POINT OF IT.** It was
written at 646.6 and #153 landed before it merged. **Re-derive every figure in this
file rather than reading it** -- `tools/class_audit.ts` for the census,
`tools/measure_profiles.ts` for the baseline, and the mean from the table's own
rows. A number written by hand into a document is a claim with a date on it, and
this one is the shortest-lived example the project has.

### Where the GUI stands

**IT HAS HAD ITS PASS.** Pick a profile from the rail, Run Simulation, and the
full results stack renders: DPS and distribution, a damage table with uses,
share, crit and avoidance per ability, buff and debuff uptime, a resource
timeline and a combat log. 2H Arms comes back at 602.23 against a published
603.3 and Seal Twist Ret at 635.78 against 630.9 -- the batch-versus-profile
difference, not a bug, and the check that no UI change reached past the
simulator.

**THE PASS WAS MOSTLY SUBTRACTION.** The owner's instruction was that the
interface carries no notes: eleven explanatory paragraphs, five per-entry reason
strings and all four "not simulated" lists came off, and the 23 preset cards --
each with a line of body text under it -- became a two-column rail of
class-coloured pills. Every configuration panel is collapsible and starts shut,
so the app opens on a character and a Run button.

**NO DATA WAS REMOVED AND NOTHING STOPPED BEING TRACKED.** Every `unmodelled`
entry still carries its reason and its `scope`, and `tools/class_audit.ts` still
derives the whole census from them. What went is one READER -- which is why the
`unmodelled` field's own documentation now says to keep writing them and names
the audit as the consumer. **The risk after a change like this is that the next
class quietly stops filling them in.**

**THREE BUGS NOBODY HAD FILED CAME OUT OF IT**, and the useful one is this: every
panel is `overflow: hidden`, so content wider than its column was CLIPPED rather
than scrollable -- the damage-taken table's last columns were unreachable **at
full desktop width**, not merely on a phone, and nothing looked broken because
the table simply stopped. The other two are a duplicate React key that prose had
been hiding and a media query that never applied.

**WHAT IS LEFT IS IMPORT AND LOAD**, two buttons wired to `() => undefined`, and
the unmounted `ProfilePanel.tsx` that holds the round-trip they need. Parked by
the owner rather than closed. See
[docs/handoff/gui.md](docs/handoff/gui.md), which is the record of the pass.

The profiles were specified by the ruleset owner as `talentsforever.com` build
URLs and every one decodes to exactly 51 points. Every profile is in its own
class's gear, from twelve sixtyupgrades sets the owner supplied — 151 items in
nine files. The item database is **frozen**.

### Gear customisation: enchants, then consumables

**TWO OWNER TABLES LANDED BACK TO BACK AND BETWEEN THEM MOVED EVERY PROFILE IN
THE PROJECT.** The armour enchants were +2.4 to +53.7 on a mean of **+27.0**;
the consumables were +40.0 to +249.3 on a mean of **+105.9**. Nothing recorded
before them is comparable with anything recorded after, which is the single most
important thing to know when reading an older figure in this file.

| | Enchants | Consumables |
| --- | --- | --- |
| shape | one per enchantable SLOT, ten slots | one per CATEGORY, twelve categories |
| source | 28 entries, no spell behind any | 12 rows, no item behind any |
| ids | simulator's own, from a 900,000 block | simulator's own, by name |
| preloaded | the owner's own per-profile table | **chosen here**, to a stated rule |
| worth | `tests/game/enchants.test.ts` | `tests/game/consumables.test.ts` |

**NEITHER IS SCRAPED AND NEITHER COULD BE.** The two WEAPON enchants that
predate both came out of Wowhead with a spell id, an icon and a tooltip; these
are an effect and a slot, so there is nothing to `--verify` and no tooltip to
store. Both are declared outright -- `game/items/foreverEnchants.ts` and
`game/buffs/consumables.ts` -- and both carry simulator-allocated ids that **may
not be reordered once a profile has been saved against them**.

**THE EXCLUSIVITY IS WHERE THE TWO DIFFER MOST, AND IT IS A DESIGN POINT RATHER
THAN A DETAIL.** A consumable selection is a map from CATEGORY to consumable, so
two flasks is not representable and the panel enforces nothing. The alternative
is in the repository and has already cost something: `RaidBuff.exclusiveWith` is
a selection rule the raid buff panel honours, and a TALENT reached the same aura
without passing through that panel, which is how a Moonkin read +6% crit.

**THREE EFFECTS TURNED OUT NOT TO BE STATS**, and each is worth knowing because
the stat was the obvious place to put it:

| | |
| --- | --- |
| "+1200 Hit Points" | `STAT_NAMES` has no `hitPoints`; health is derived from stamina and the owner states no conversion. It reaches the maximum as its own term -- **and lowers rage**, because `D x 10 / H` |
| the bow's "+2% Crit Chance" | `critChance` is every attack a character makes, and this one is RANGED only. `AttackTableModifiers` on the two ranged tables, so the pet never sees it either |
| "+2% Melee Crit Chance" | the same scope pointing the other way, on the two MELEE tables -- because `critChanceFrom` is one function and a bow reads it too |

**THE LAST TWO ARE THE SAME TABLE ON OPPOSITE SIDES, AND THE OWNER'S OWN PAIR OF
LABELS IS WHAT SETTLED THEM.** Their enchant table writes "+2% Crit Chance" on a
bow and their consumable table writes "+2% Melee Crit Chance", and asked which
the unqualified one meant they said melee and ranged. Two labels for one stat
would be one label.

**AND AN ENCHANT'S ARMOR IS NOT "ARMOR FROM ITEMS"**, by the owner's ruling, so
`armorFromItems` sums ITEM stats directly rather than going through
`statsFromEquipment`. Toughness and Thick Hide scale the plate and not what was
enchanted onto it. Worth nothing on the day it was written -- no enchant granted
armor before the cloak's 60 -- and wrong the day one does.

**THE CONSUMABLE ROWS ARE CHOSEN, NOT STATED, AND THAT IS THE FIRST THING TO
REPLACE.** The owner supplied the catalogue and no per-profile table, and asked
for a sensible row on each. They follow one written-down rule rather than taste
-- take every category the build can read, choose within a category by what it
scales with, leave empty only what is worth nothing -- and both halves of every
row are derived from something re-checkable: the conversion table decides
Blasted Lands, and the MEASURED damage school decides School Spell Power. Three
of those schools are not guessable from the class: the Moonkin is 71% arcane,
the Frostfire Mage **62% fire**, the Elemental Shaman 56% nature.

**THE CASTERS MOVED FOUR TIMES AS FAR AS THE MELEE BUILDS AND THE OWNER HAS
CONFIRMED THAT IS INTENDED** -- "casters *should* have moved more". A caster row
reaches 254 school-blind spell power plus 40 on its own school, where the
biggest single entry a melee build can take is 40 attack power. The table
re-sorted around it: four of the top six are casters where none was before, and
the Frostfire Mage took the top from Seal Twist Ret. **Recorded because it reads
like a bug** -- a change moving one archetype +250 and another +40 is the shape
somebody later "fixes".

**ONE RULING CAME BACK THE OPPOSITE WAY FROM THE PRECEDENT, WHICH IS THE
EPISODE WORTH KEEPING.** "+40 Attack Power" shipped as the melee pool alone,
because every ITEM line in the data reads those words that way and because the
owner's one ruling the other way -- Careful Aim -- is about a TALENT, and a
ruling covers what it says. The owner then ruled the consumable feeds BOTH
pools. **So an item's wording and a consumable's are now known to mean different
things, and neither settles the other.** Waiting was still right: it cost one
review, where guessing would have left two Hunter profiles carrying an elixir
worth nothing with nobody to notice.

**AND THE TWO CHANGES COLLIDED WITH A THIRD, CLEANLY AND WRONGLY.** The Warlock
stone merged between them, and it and the consumables were written from the same
base: **both took profile version 11 and both keyed their migration at 10**, and
git merged the two migration tables with no conflict at all -- one object
literal with the key `10` twice, where the second silently wins and the first
migration never runs. The TYPECHECKER caught it, not the suite and not the
merge. The consumables are v12 keyed at 11 now, and `consumables.test.ts`
carries a regression test that a version 10 profile comes out the far end with
BOTH fields. See **Git workflow** in CLAUDE.md.

**THE GEAR PANEL NEEDED NO CODE FOR THE ENCHANTS**, because it already built its
dropdown from `enchantsForSlot`; what it needed was CSS, since the enchant
column was sized when the only two names were "Crusader" and "Spell Power". The
consumables are a panel of their own, under the raid buffs, one dropdown per
category. `tools/enchant_report.ts` and `tools/consumable_report.ts` print all
24 rows of each in the shape of the owner's own spreadsheets.

### The Mage fine-tuning pass

**SEVEN ITEMS FROM THE RULESET OWNER, AND ONE OF THEM TURNED OUT TO BE A
REPORTING BUG RATHER THAN A SIMULATION ONE.** Frostfire **623.2 to 661.3,
+38.0, REAL**; Arcane and Fire inside their intervals; the other twenty-one
profiles identical to the decimal.

| | |
| --- | --- |
| **Frostfire Bolt counts as BOTH schools, +38.0** | ten talents treat it as Frost and Fire and SEVEN already did. The three that did not were the Frost-scoped ones: Piercing Ice and Ice Shards select by school, Frost Channeling by ability id. `DamageRequest.countsAsSchools` is the first two and a list entry is the third |
| **Ignite cannot crit and ROLLS OVER, +13.2 to Fire** | the same two exceptions Deep Wounds carries, and for the same reason -- it is a DoT applied BY a crit. Losing the crit costs less than the roll-over gains, because a Fire list re-applies it before it has delivered. Isolated: Fire reads 608.8 with the old shape against 622.0 with this one |
| **Evocation, in all three lists at 10% mana** | 8-second channel, haste-shortened, x16 out-of-combat mana regeneration. Fired 0.9 times a fight for Fire, 0.4 for Frostfire and 0.0 for Arcane when this landed, and **0.0 on all three** since Heating Up changed -- **ruled intended by the owner, 2026-10-08**, so the entry stays at the threshold it has |
| **Presence of Mind on the CHEAP Arcane Blast** | at exactly one stack and no Missile Barrage, which is the opposite of where a damage cooldown goes and is the point: each stack raises the cost 175% |
| **Scorch is gated on Improved Scorch** | without the talent nothing applies the debuff, so the condition is permanently true and Scorch becomes an unconditional entry with every list entry beneath it unreachable |
| **Elemental Precision was never broken** | reported as "like 0.5% per point". It delivers the full 1% to the roll, and **the miss COLUMN was diluted** -- see below |

**TWO BUGS FOUND BY BUILDING THESE, NEITHER IN THE MAGE.**

**THE MISS RATE WAS DIVIDED BY THE WRONG DENOMINATOR, FOR EVERY HYBRID IN THE
PROJECT.** `recordDealt` counted every damage event into `attempts`, so a spell
whose burn pools into its own row reported avoided, crit and glance over
attempts those outcomes were never offered: Frostfire Bolt is 21.8 attempts a
fight of which 12.0 are casts, and it showed **2.83% miss on a spell whose casts
miss 10%**. That is what the owner read Elemental Precision off. The two Arcane
spells, which have no burn, read 9.71% and 10.30% against the same 10%
expectation -- **the undiluted rows were right all along, which is what pins the
cause on the denominator rather than on the talent.** Fixed in
`BatchTotals.recordDealt`; the damage total still includes the burn, because a
burn is part of the spell.

**AND `resourceRegenMultiplier` REACHED ONE OF THE THREE REGENERATION RULES.**
Written for Adrenaline Rush and wired into energy only, so Evocation's
`{ mana: 16 }` compiled, applied, reported its uptime and measured a ratio of
exactly 1.0000. Mana and focus go through `regenMultiplierFor` now. **A general
field added for one caller is a silent no-op for the second one.**

### The regression baseline

**30 batches of 10**, preset raid buffs, reproduced by
`npx vite-node tools/measure_profiles.ts`. Comparable to **each other** and to
nothing else. **Measure with `runProfileBatch`, not `runProfile`** — the app runs
the former and the two are different fights even at one iteration.

**EIGHT WARLOCK RULINGS FROM THE OWNER, AND SM/DS GAINED 38.1 ON THEM.** 441.5
to **479.7, REAL**, with Firelock at -0.4 and the other twenty-two identical to
the decimal. Each isolated by reverting it alone over thirty batches of ten:

| | |
| --- | --- |
| **+23.6** | **Bane of Agony's coefficient is 160% of spell power across the whole effect**, against the sheet's 13.3% a tick -- 1.064 in total over the eight ticks it then had. The owner's worked example is `552 + 500 * 1.6 = 1352`, and the twelve ticks reproduce it exactly. **The second row in `coefficients.ts` that is not from the sheet, and the first that CONTRADICTS it** |
| **+18.6** | **Amplify Curse**, one talent point moved out of Suppression, cast once before the first Bane and **off the global cooldown** -- which is what makes it free |
| **+6.6** | **Wrack counts as periodic damage for Malediction**, by ruling. Its ticks are CAST ticks and carry no `periodic` flag, so this was a question the data could not answer |
| **+1.7** | **a Nightfall proc is spent by the NEXT action.** Inside the interval on DPS, and the behaviour is not in doubt: Shadow Trance uptime falls from 0.082 to 0.049, so the proc is held 40% less time |
| **+0.4** | **Curse of the Elements counts for Soul Siphon.** Noise, and correctly so -- the three bleeds already reach the 36% cap, so the fourth counted effect is redundant until one drops |
| **-4.3** | **Siphon Life cannot crit.** The only damage-over-time effect here that cannot; every other one can, which is a Forever rule |
| **-7.6** | **the RAMP**, against a flat distribution of the same total. Back-loading throws away the big late ticks every time the Bane is re-applied, and it is the owner's data either way |

**AND A CHANNEL CAN NOW BE CANCELLED MID-CAST**, which is the eighth ruling and
a new engine capability: `Ability.interruptibleChannel` plus
`PriorityEntry.interruptsChannel`, and **both halves have to agree** before
anything is cut short. Worth **+3.2** on its own, and it REPLACED Wrack's
six-second gate rather than adding to it -- the gate asked "can I afford to stop
acting for six seconds" and answered conservatively, because a channel used to be
a commitment.

**IT IS NOT "EVERY ENTRY ABOVE THE CHANNEL", WHICH WAS THE TEMPTING SHORTCUT.**
The owner named three cases -- a Shadow Bolt because Nightfall procced, a
Corruption or a Bane of Agony because it fell off -- and Siphon Life and Life Tap
sit above Wrack in that same list and are NOT among them. A positional rule would
have been right about three entries and wrong about two. Measured off the
telemetry stream: 4.6 interrupts a fight, caused by **exactly those three ids and
nothing else**.

**THE CONTAINMENT CHECK IS THE INTERESTING ONE HERE**, because the change touches
`casting.ts`, `Simulation.ts` and `Combatant.ts` on every cast in the project:
**all 23 other profiles came back identical to the decimal.**

**THE RAMP IS CLASSIC'S SHAPE AT A DIFFERENT RESOLUTION**, which the old caveat
guessed and had no authority to assert: 1/24 : 1/12 : 1/8 is 1 : 2 : 3, and the
flat share over twelve ticks is 1/12 -- so the bands are 50%, 100% and 150% of
the average exactly as Classic's are. The guess was right and is now sourced.

**AND SIPHON LIFE IS WORTH CASTING, ASKED TWICE AND ANSWERED TWICE: +15.7** on
the re-measure after the interrupt rule landed, against +13.6 before it. **The
FIRST answer was wrong by a factor of two**, because Wrack's gate named Siphon
Life -- so removing Siphon Life took Wrack to zero casts and the figure was the
loss of both. **Removing the gate removed the coupling**, which is a better
outcome than remembering to work around it. See
[docs/handoff/warlock.md](docs/handoff/warlock.md).

**THE WARLOCK HAS A WEAPON STONE NOW, AND NO FIGURE IN THE TABLE MOVED.**
`profile.warlockStone` -- a Firestone or a Spellstone, selected in the Gear panel
beside a Rogue's poisons, and **profile format v11**. It defaults to `none` and
both presets keep it, which is the OPPOSITE of v10's poison decision and for a
stated reason: the owner supplied the poison pairing, and has not said which
stone a Warlock carries. Choosing one here would invent a build decision and move
a published baseline.

**WHAT THEY ARE WORTH, 30 batches of 10 on their own seeds:** Firelock takes
**+20.0 REAL** from a Firestone against +2.4 noise from a Spellstone; SM/DS takes
**+7.3 REAL from either**, a dead heat by two different routes. **A Firestone is
not a "Fire stone"** -- only its +21 is school-scoped, while its 2% spell crit is
whole-character, which is what makes it the better stone for a Fire build and an
equal one for a Shadow build. See
[docs/handoff/warlock.md](docs/handoff/warlock.md).

**THE NEWEST MOVE IS THAT A SEAL CRITS**, on the owner's ruling: Seal of
Righteousness, Seal of Fury and Seal of Command all roll against the Paladin's
MELEE crit chance. Three profiles moved and the other twenty are **+0.0 to the
decimal**, which is a stronger containment check than usual because the change
CONSUMES A RANDOM NUMBER per seal hit -- any leak outside the class would have
shifted a seeded stream and shown up as a difference rather than as a zero.

| | |
| --- | --- |
| **Seal Twist Ret 668.4 to 709.0, +40.6, REAL** | and it goes to the top of the table |
| **Shockadin 543.6 to 560.6, +17.0, REAL** | |
| Prot Pally 287.8 to **293.0**, +5.1 | **noise under the conservative rule**, which judges a gap against this run's interval DOUBLED. 5.1 against 5.8, so it is called noise before it is called a change |
| The other twenty | **+0.0** |

**THE TANK GAINS LEAST AND THAT IS THE BUILD RATHER THAN THE RULING.** Protection
carries Seal of Fury, a flat 35 Holy plus 10% of a spell power it barely has, and
it does not take Conviction -- so it is the least seal damage at the lowest crit
chance. Retribution gains most because Seal of Command and its Echo are a quarter
of its damage before anything else is counted.

**TWO NUMBERS COULD EACH HAVE GONE THE OTHER WAY AND ONE OF THEM IS NOT OBVIOUS.**
A seal deals HOLY damage, so `spellCritChance` and a spell's 1.5x are the
plausible answers; the owner named the MELEE chance, and the multiplier follows
the TABLE rather than the school, so a seal crit is **2x**. Reading the school
instead would have made every seal crit worth half what it should be -- a smaller
number, a plausible one, and no error. `tests/game/sealCrits.test.ts` pins both by
the SET of amounts a seal deals rather than by an average.

**AND THE ECHO CRITS, WHICH IS THE SAME RULING RATHER THAN AN EXTENSION OF IT.**
Twist of Light applies "the replaced Seal's effects", so an echoed seal is the
seal; it goes through `sealHit` and got the field for free. Seal of the Crusader
is untouched because it has no per-swing damage to crit.

**THE MEAN WAS 528.2 AT THAT POINT**, from 527.0, re-summed from the table's own
rows.

---

**AND THEN THE CASTER WEAPONS WERE BUFFED: +64 SPELL POWER ON FOUR OF THEM.**
The ruleset owner's, given directly, and the **first item numbers in this project
that are Forever's rather than Classic's** -- the Immovable Object aside. Staff
of Dominance 47 to 111, Sorcerous Dagger 36 to 100, Azuresong Mageblade 44 to
108, and Anathema 75 to 139 on SHADOW alone.

**IT IS ENCODED AS A DELTA AND NOT AS FOUR TOTALS.** The owner's own figures for
two of them did not match this data -- Staff of Dominance quoted at 60 against
the scrape's 47, Azuresong at 40 against 44 -- and asked which to use, the owner
chose the +64. So `FOREVER_SPELL_POWER_BUFFS` stores bonuses: a re-scrape that
moves a base still means "Forever buffed this by 64" rather than quietly
reinstating a Classic figure.

**TEN PROFILES MOVED REAL AND THIRTEEN DID NOT MOVE BY A DECIMAL, AND THE TEN
ARE EXACTLY THE TEN THAT HOLD ONE OF THE FOUR WEAPONS.** Every physical profile
is at +0.0: all three Warriors, all three Rogues, Cat, Bear, Enh Shaman, both
melee Hunters and BM Hunter. **Seal Twist Ret is the containment check inside
the casters** -- a Paladin, but a two-handed one, so it holds none of the four
and did not move either.

| | |
| --- | --- |
| **Frostfire +42.4, Fire +36.7, Moonkin +36.0** | the three largest |
| Firelock +35.5, Arcane +32.2, Ele Shaman +31.8, SM/DS +31.2, Shadow +24.1, Shockadin +23.0, Prot Pally +12.0 | |
| the other thirteen | **+0.0** |

**SIX OF THE TEN ARE ONE WEAPON.** The Staff of Dominance is in the Moonkin,
Mage and Warlock sets, so it alone accounts for Moonkin, all three Mages and
both Warlocks. Azuresong is the two shield Paladins, the Sorcerous Dagger the
Elemental Shaman, and Anathema the Shadow Priest.

**ANATHEMA'S STAYS SCOPED TO SHADOW**, which the owner confirmed. Its line reads
"damage done by SHADOW spells", so the bonus lands there and the school-blind
pool is untouched -- the Priest's stat block still reads 204 and only its Shadow
total moved, 497 to 561. Widening it would have fed Holy as well.

**A FOURTH HUNTER PROFILE, AND THE OWNER'S TWO ALLOCATIONS WERE MEASURED
AGAINST EACH OTHER BEFORE IT LANDED.** Hawk Melee **824.4**, second of
twenty-five and the top Hunter, with the other twenty-four identical to the
decimal. Specified as "largely the same as LW melee" -- same race, class, combat
style, gear, raid buffs and consumables -- with "the same APL except Summon Hawk
will be used above Wing Clip".

**TWO BUILDS WERE SUPPLIED AND THE QUESTION WAS WHICH.** They differ on one
thing that matters: whether to keep Lone Wolf's 20% or drop it for a pet. Both
readings were live until they were measured.

| Build | DPS |
| --- | --- |
| **16/11/24, Lone Wolf AND the hawk** -- shipped | **824.4** |
| 16/10/25, the pet instead of Lone Wolf | 803.8 |
| LW Melee -- Lone Wolf, no hawk | 779.7 |
| 16/10/25 with Summon Hawk out of the list -- the pet, no hawk | 733.5 |

**THE PET LOSES AND THE HAWK WINS, AND THEY ARE INDEPENDENT.** The pet and its
Claw and Bite were 13.2% of the 16/10/25 profile and did not cover the 20% they
cost -- that build is **-46.2 against LW Melee** once its hawk entry is taken
out, so trading Lone Wolf for a pet is a loss on its own. The hawk is worth
having either way, and the build that takes both is the one that shipped.

**FIVE OF ITS FIFTY-ONE POINTS DO NOTHING HERE AND IT STILL WINS BY 20.7.**
Improved Aspect of the Monkey is "dodge from an Aspect no damage profile uses"
and Pathfinding carries `scope: 'positioning'`, a permanent ruling rather than a
gap. **The allocation is left exactly as the owner wrote it** -- a preset that
quietly improved on it would stop being the build they specified -- and a test
names the two talents and fails if either ever becomes modelled. The losing
build wasted points too: Endurance Training's three are pet health and armor,
worth nothing to a profile nothing attacks.

**IT TAKES LONE WOLF *AND* SUMMON HAWK, WHICH IS WHAT MAKES THE LIST KEY
LOAD-BEARING RATHER THAN MERELY DEFENSIBLE.** Both melee Hunters are dual-wield,
below the Beast Mastery capstone, and now both take Lone Wolf -- so Summon Hawk
is the only thing that separates them, and it is also the talent the two lists
actually differ by. Keyed on Lone Wolf instead, this profile would run Lone Wolf
Melee's list, **never press the hawk it spends sixteen points on**, and report an
ordinary figure. The key was chosen for the 16/10/25 build, where it was one
reasonable option of two; the build that shipped is the one that would have
exposed the other choice. **The capstone stays first**, because Beast Mastery
takes Summon Hawk too and is `combatStyle: 'ranged'`: fall it into a melee list
and it stands there pressing Raptor Strike.

**THE ENTRY IS GATED ON THE CAP, like both other lists that press it.** Summon
Hawk has a six-second cooldown and a hawk lasts eighteen, so an ungated entry
fires every six seconds and overwrites the older of the two -- throwing away
twelve seconds of a hawk to start a new one. Wing Clip beneath it is still the
floor, because this entry has both a cooldown and a condition.

**AND THE PROFILE IS SEPARATED AT THE TOP, WHICH IS UNUSUAL.** 824.4 +/-8.5
against Cat's 807.2 +/-5.1 is a gap of 17.2 that clears both intervals, so unlike
the three-way tie it replaced this is a real second place. Only DW Fury's 892.0
is above it.

**WING CLIP IS PRESSED FOR THE PROCS AND NOT FOR THE 50, AND THE MEASUREMENT
SAYS SO.** LW Melee **631.4 to 672.6, +41.2, REAL**, the other twenty-three
identical to the decimal. The ruleset owner asked for it "as a filler/low
priority ability if there is nothing else to press", with the reason stated
plainly: "even though it only deals 50 base damage and has no attack power
coefficient it can still count as a melee use in order to trigger things like
hand of justice, windfury, and expose prey."

**SO IT WAS WORTH ISOLATING THE TWO HALVES, AND THE OWNER'S HALF IS THE BIGGER
ONE.** Patching the damage to 1 leaves a weapon use that deals nothing; dropping
`weaponSlot` leaves 50 damage that triggers nothing.

| | LW Melee | against no Wing Clip |
| --- | --- | --- |
| as shipped | **672.6** | **+41.2** |
| weapon use kept, damage patched to 1 | 648.1 | **+16.7**, the procs alone |
| 50 damage kept, `weaponSlot` dropped | 644.2 | **+12.8**, the damage alone |
| no Wing Clip | 631.4 | — |

**THE TWO DECOMPOSITIONS AGREE TO A DECIMAL, WHICH IS WHAT SAYS THE ISOLATION IS
SOUND**: 24.5 + 16.7 and 28.4 + 12.8 both come to 41.2, the measured total. The
~12 of synergy left over is inside the noise on four intervals of that size, so
it is not claimed as a mechanism. What IS claimed is the ordering, which holds on
every reading: **the triggering is worth more than the hit.**

**PATCHING THE DAMAGE TO 1 RATHER THAN 0 IS THE WHOLE ISOLATION.** An attack that
deals nothing is refused by every reaction that reads `amount` -- Expose Prey
included -- so zeroing it would have switched off the thing being measured and
read as "the procs are worth nothing". A one-damage hit costs 0.2 DPS and keeps
every roll.

**AND THE KNOCK-ON IS VISIBLE IN THE SHARES, WHICH IS THE INDEPENDENT CHECK.**
Wing Clip itself is 3.6% of the profile at 22 uses a fight, and two rows that it
never touches directly moved with it: **Mongoose Bite 6.6 uses to 7.0**, because
Expose Prey is its only route in this build and 22 more landed main-hand attacks
is 22 more rolls for it, and **Fatal Wound 1.1% to 1.9%**, which is Vis'kag's
main-hand proc. Neither is in the entry's own row. **A filler whose damage was
right and whose `weaponSlot` was missing would have read as 3.6% and a working
ability**, and been worth a third of this.

**`weaponSlot` SET AND `weaponScaling` ABSENT IS THE CLEAREST CASE OF THAT PAIR
IN THE PROJECT.** One says whose procs an attack triggers, the other says which
attack power pool its damage reads, and Wing Clip answers the first and declines
the second. Someone "fixing" the missing field would add hundreds of damage and
break the owner's statement, so the test asserts the damage is EQUAL at 0 and
2000 attack power.

**IT IS LAST BECAUSE IT HAS NO COOLDOWN, NOT BECAUSE IT IS WEAK.** That is the
half of the floor rule that is easy to forget: an entry is a floor when it is
ungated AND always castable. Immolation Trap above it is ungated too and has a
30-second cooldown, so the list falls straight past it; Wing Clip has none, so
nothing below it could ever be reached. What limits it is 80 mana, and this
build used to finish with mana unspent.

**THE PROFILE IS FOURTH OF TWENTY-FOUR NOW, AND ALL THREE HUNTERS ARE IN THE TOP
FIVE** -- it passed Frostfire, DW Fury and BM Hunter on this one entry.

**ALL THREE HUNTERS MOVED AND NOTHING ELSE DID, ON FIVE THINGS THE RULESET
OWNER REPORTED.** BM Hunter **595.7 to 668.6**, LW Ranged **486.5 to 681.1**, LW
Melee **523.8 to 631.4**, all REAL; the other twenty-one identical to the
decimal. **Three of the five had never worked at all** rather than working
wrongly, and every one produced a plausible figure -- a Hunter without its 20%,
without a haste proc and without a hawk is still a Hunter doing Hunter damage.

| | BM | LW Ranged | LW Melee |
| --- | --- | --- | --- |
| **Lone Wolf's 20%**, which had never been applied | — | **+113.5** | **+107.6** |
| **Ammunition**, 16.5 DPS x base bow speed into base damage | **+32.0** | **+43.1** | — |
| **The quiver**, ranged swing timer / 1.15 | **+32.3** | **+39.0** | — |
| **Deadly Aspects' Auto Shot half**, which could never fire | **+25.1** | **+30.2** | — |
| **Summon Hawk in the ranged list** | 0 | 0 | — |
| **together** | **+72.9** | **+194.7** | **+107.6** |

They overlap, so the columns do not sum. **LW Melee's whole change is Lone Wolf
alone**, to the decimal, and BM Hunter did not move from it at all -- it takes a
pet instead. That is the containment check inside the class.

**TWO OF THEM WERE SILENT FOR THE LIFE OF THE PROJECT, AND BOTH FOR THE SAME
REASON: A LOOKUP THAT MISSES IS NOT AN ERROR.**

**`grantAura` RESOLVES THROUGH A FIFTH REGISTRATION SITE AND NOBODY KNEW.**
CLAUDE.md lists four places a class is registered; `TALENT_AURAS` is a fifth,
and `createPlayer` DROPS an id it cannot find on purpose -- "a typo should show
up as a talent that visibly does nothing". `lone_wolf` was never registered, so
both profiles NAMED AFTER the talent went the whole project without its 20%.
`hunterFiveFixes.test.ts` now fails if any `grantAura` id across all nine
classes resolves to nothing, with the Warlock's one legitimate exemption
written out.

**AND A PREDICATE THAT IS ALWAYS FALSE READS EXACTLY LIKE ONE THAT IS SOMETIMES
TRUE.** Deadly Aspects asked `isWeaponUseOf(attack, 'ranged')`, and
`isWeaponUse` means "a use of a MELEE weapon" -- Thunder Clap and Charge declare
`weaponSlot: 'ranged'` precisely so it excludes them. So the expression was
`(mainHand || offHand) && ranged`: **403 ranged swings over twenty fights, zero
procs of a stated 10%.** The parameter is `MeleeWeaponSlot` now, so the question
is refused at compile time rather than answered wrongly -- and narrowing it
found two more callers passing a wider type than they ever use.

**THE QUIVER AND THE AMMUNITION ARE CLASS PROPERTIES, NOT EQUIPMENT.** "Hunters
also passively have a quiver equipped -- which is not a normal equipment slot."
Both live in `game/character/hunterRanged.ts`: the quiver DIVIDES the ranged
swing timer by 1.15 (the owner's own example, 2.9 / 1.15 = 2.5217 -- not x 0.85,
which is a 2% faster bow and a plausible wrong number), and ammunition adds
`16.5 x BASE bow speed` to base damage. **Neither touches `powerCoefficient`**,
which is base speed over fourteen: recomputing it from the shortened timer would
quietly cut every Hunter's attack power scaling by 13%.

**THE WIKI FORMULA ALREADY HAD THE AMMO TERM AND NOBODY HAD READ IT.**
`rangedAttackPower.test.ts` has carried `AmmoDPS x WeaponSpeed + (RAP / 14 x
WeaponSpeed + Scope + AvgWeaponDmg)` in its header since it was written -- the
same speed symbol in both terms, which is what settles "base" over
"quiver-shortened".

**AND A LIST IS CHOSEN BY A DIFFERENT TALENT FROM THE ONE THAT GRANTS THE
ABILITY.** `hunterRotation` dispatches on `bestial_wrath`, the 31-point
capstone; `summon_hawk` is a 5-point talent five rows above it. A build taking
the hawk without the capstone fell through to the ranged list, which had no hawk
entry, and silently stopped casting an ability it had paid for. The entry is in
both lists now and is SILENT for a build without the talent -- LW Ranged shows
it at 0.0 uses, which is the ninth deliberate never-fired entry.

**THE MEAN IS 578.4**, from 541.5, re-summed from the table's own rows.

---

**THE NEWEST MOVE IS A SIX-ITEM PALADIN PASS THE OWNER FOUND BY READING THE
APP**, and five of the six were a talent that reported itself modelled and did
nothing. **The twenty-one non-Paladin profiles are +0.0 to the decimal.**

| | |
| --- | --- |
| **Seal Twist Ret 709.0 to 748.3, +39.2, REAL** | Sacred Arbiter's missing 10% on Holy Strike, plus an instant Hammer of Wrath that **fires for the first time in the project** — 1.9 casts a fight, 4.5% of the profile |
| Shockadin 581.2 to **585.5**, +4.3 | noise. Sacred Arbiter alone, on a build whose Holy Strike is 7.7% of its damage |
| Prot Pally 304.9 to **303.9**, -1.0 | noise, **and the two talents it gained do not deal damage**: Improved Righteous Fury and Iron Creed are damage TAKEN. Deaths go 11.27 to 9.63 |

**TWO FAILURE SHAPES, AND NEITHER IS VISIBLE FROM THE CENSUS.**

**A NULL VALUES ENTRY.** Sacred Arbiter is single-rank, so the importer had no
`{0}` to match and wrote `null` — and `talentBuild` discards every effect that
asks for a number, while `class_audit` reads the effect TABLE and calls the
talent complete. **Third time on this class**, after Holy Shield and Divine
Favor. The whole risk group is a class's single-rank talents, and checking them
is a five-minute job that has now been worth doing three times.

**A TWO-CLAUSE REASON, WHICH KEEPS READING AS TRUE BECAUSE HALF OF IT IS.**
Improved Righteous Fury, Iron Creed and Instrument of Law each said "threat is
out of scope, AND <something that stopped being true>". The threat half is
permanent and correct in all three; the second half expired when the owner's own
priority lists started casting Righteous Fury and Hammer of Wrath. A reader
checks the reason, reads the true clause, and stops.

**ONE OF THE SIX WAS NOT A BUG.** Reckoning measures **3.77 extra swings a fight
against an expectation of 3.62**, with all four links of the block chain verified
separately — base 9.56%, +20 exactly from Holy Shield, +30 exactly from Redoubt.
Seeing 2 in one fight is the sample size: 3.6 is a COUNT, and an extra attack
emits no telemetry of its own, so the only honest form of the answer is a mean
over many fights. `tools/probe_block.ts` is the tool that says so and is kept.

**AND ONE ENGINE CHANGE WAS WRITTEN, REVERTED, AND THEN RULED ON** — which is
worth more than the ones that shipped, and the ruling is the part to keep.

`extraAttack` ends by scheduling a FULL fresh swing timer, which cancels the
pending one, so an extra attack pushes the next normal swing out by up to a
whole timer. A change to preserve the pending swing's due time was written as
the explanation for Reckoning seeming short; **the measurement said Reckoning
was already at expectation**, the justification collapsed, and it was reverted.

**THE RULESET OWNER HAS SINCE RULED THAT THE EXISTING BEHAVIOUR IS CORRECT**:
"an extra attack from Reckoning is exactly the same as the other extra attacks
— like from Hand of Justice. It will trigger an auto-attack and reset the swing
timer." So the reset is the RULE rather than an accident, Reckoning is not a
special case, and `docs/extra-attacks.md` had the row right all along ("the
swing timer: **restarted**") — the paragraph that used to sit here called it
"almost certainly wrong" and was contradicting a document in this repository.

**`tests/engine/extraAttackSwingTimer.test.ts` PINS IT NOW**, because nothing
about `scheduleSwing` with a full fresh timer announces that it is deliberate:
the next reader goes looking and finds a bug, exactly as this pass did.

---

**THE METHOD CHANGED WITH THIS TABLE, AND THAT IS WHY SOME FIGURES MOVED WITHOUT
A CAUSE.** Every earlier baseline here was ONE batch of 300 at seed 12345; these
are thirty independent batches of ten, which is what `measure_profiles.ts` runs
and what gives each figure the interval a REAL/noise verdict needs. Most profiles
land inside the old interval and a few do not — 2H Arms read 596.6 under the old
method and 607.2 under this one on identical code. Do not read those as changes.

**AND THEN TO EIGHTEEN, WITH JUDGEMENT OF WISDOM.** The owner's instruction,
after the mechanic landed: 50% of the actions a character takes against the
target restore 59 mana. **Six profiles moved REAL and six did not move by a
decimal**, and the six that did not are exactly the right six -- the three
Warriors and the three Rogues, the only profiles with no mana bar at all. Their
roll is refused before any randomness is consumed, so those fights are
bit-identical rather than merely close.

| | |
| --- | --- |
| **Seal Twist Ret +45.4, Frostfire +43.2, Enh Shaman +40.5** | the three largest |
| Fire +34.7, LW Ranged +28.7, Prot Pally +5.5 | the rest of the REAL moves |
| 2H Arms, DW Fury, Prot Warr, Venom, Combat, Rupture | **+0.0**, to the decimal |

**IT IS WORTH MOST TO A BUILD THAT RUNS DRY, NOT TO ONE THAT GAINS MOST MANA.**
Shadow Priest takes 1,516 mana from it and moves -1.6, inside its interval,
because it was never mana-bound and the mana lands in "unspent". Seal Twist Ret
takes a comparable 1,680 and gains 45.4, because it spends nearly everything it
gets. **Arcane is the odd one of the three Mages** -- +3.1 against Fire's +34.7
and Frostfire's +43.2.

**AND IT MOVED THE TOP OF THE TABLE BY NOISE RATHER THAN BY WORK.** DW Fury is
first at 651.2 with Cat at 650.9, a gap of 0.3 against intervals of +/-8.9 and
+/-6.2 -- so the two are indistinguishable and "the top profile" has stopped
being a meaningful statement about them. Cat's own -5.2 is noise: a Druid HAS a
mana bar, so the roll is taken and the seeded stream shifts even where the mana
is worth nothing.

**THE MEAN WAS 496.8 AT THAT POINT**, from 488.3.

---

**AND THEN EVERY SELECTED ENTRY WAS MADE TO LAST THE WHOLE FIGHT, WHICH IS THE
LARGEST SINGLE MOVE THE BASELINE HAS EVER MADE.** The owner's rule: a raid
buff or debuff is applied for **twice the planned duration**, so it cannot
expire mid-fight.

**IT CHANGES EXACTLY TWO ENTRIES AND THAT IS THE WHOLE STORY.** Sunder Armor
and Thunder Clap were declared with the durations the WARRIOR'S OWN abilities
use -- thirty seconds, because a warrior recasts them -- and the raid buff
REUSES those auras rather than declaring a second copy. Right for a warrior and
wrong for everyone else: on a Rogue or a Hunter nothing refreshes them, so the
raid's 2,250 armor reduction fell off at the half-way mark and the back half of
every such fight was measured against a target it was never meant to face.
Every other entry is already an hour, five minutes, or zero -- which means
permanent -- so a uniform rule moves only those two.

**FOURTEEN PROFILES MOVED REAL AND NINE DID NOT MOVE BY A DECIMAL, AND THE NINE
ARE EVERY PURE CASTER.** Moonkin, Ele Shaman, all three Mages, both Warlocks and
the Shadow Priest came back identical. That is the containment check and it
could not be cleaner: Sunder Armor reduces ARMOR, which only physical damage
pays, and Thunder Clap slows a target's SWING, which only matters when something
is being swung at. A profile that deals pure spell damage should see nothing
from either, and sees nothing.

| | |
| --- | --- |
| **Combat +59.3, Cat +52.9, BM Hunter +49.7** | the three largest |
| Bear +47.0, LW Melee +45.7, Venom +46.5, Rupture +43.9, Enh Shaman +43.3, LW Ranged +40.1 | |
| Seal Twist Ret +37.5, 2H Arms +21.3, Shockadin +20.1, Prot Warr +14.5, Prot Pally +12.2 | |
| Moonkin, Ele Shaman, Frostfire, Arcane, Fire, SM/DS, Firelock, Shadow | **+0.0** |

**DW FURY'S +15.9 IS CALLED NOISE AND IS ALMOST CERTAINLY REAL.** The verdict
compares a delta against this run's interval DOUBLED, which is deliberately
conservative -- it calls a real change noise before it calls noise a change --
and DW Fury's interval is the widest of the physical profiles. It is the one
figure in the table where the label is the method talking rather than the
mechanic.

**AND THE TWO-HANDED WARRIOR STOPPED CASTING SUNDER ARMOR ENTIRELY.** The raid's
five stacks now hold all fight, so the entry that refreshed them never becomes
the first castable one and the rage and global cooldowns go elsewhere. That is
the rule working rather than a list breaking, and it is asserted as ZERO in
`presets.test.ts` rather than deleted -- an entry that silently stops firing is
the failure this project has been caught by twelve times, so the one time it is
deliberate it gets written down.

**THE MEAN WAS 520.8 AT THAT POINT**, from 496.8, and Cat was on top at 703.8 —
which the seal crit ruling above has since taken back off it.

**BEFORE THAT, THE PRESET RAID BUFFS WENT FROM TWELVE TO SEVENTEEN, ON THE OWNER'S OWN SCREEN,
AND IT MOVED EIGHTEEN PROFILES.** Added: **Arcane Intellect, Blessing of Wisdom,
Mana Spring Totem, Trueshot Aura and Curse of the Elements.** Still absent on
purpose: Grace of Air Totem except where it replaces Windfury, Moonkin Form, which
cannot sit beside Leader of the Pack, and Curse of Recklessness.

**AND THE TWO RANGED HUNTERS SWAP WINDFURY FOR GRACE OF AIR**, also the owner's
instruction. Windfury Totem is "20% chance on each MAIN-HAND use", which a Hunter
shooting a bow never has -- a ticked box worth exactly nothing. **LW Melee keeps
Windfury**, because it swings a main hand: the split is by what the profile DOES
rather than by class.

**FIVE PROFILES DID NOT MOVE BY A DECIMAL, AND THEY ARE EXACTLY THE RIGHT FIVE.**
2H Arms, DW Fury, Prot Warr, Cat and Bear -- every profile that deals pure physical
damage, carries no mana bar and never fires a ranged weapon. All five new buffs are
intellect, mana, ranged attack power or magic damage taken, so a containment check
could not have come back cleaner if it had been designed.

| | |
| --- | --- |
| **Fire +103.1, LW Ranged +101.5, Frostfire +99.8** | the three largest. LW Ranged is the Windfury swap on top of Trueshot and the curse |
| Seal Twist Ret +57.2, BM Hunter +56.3, Arcane +54.3, Shockadin +50.0, Enh Shaman +47.8 | |
| Firelock +39.5, Shadow +39.2, SM/DS +38.1, Ele Shaman +36.4, Moonkin +34.4, Prot Pally +32.0 | |
| **Venom +8.2, LW Melee +7.0, Rupture +3.8, Combat +3.1** | the small ones, and they are small for a reason worth reading |
| 2H Arms, DW Fury, Prot Warr, Cat, Bear | **+0.0** |

**THE FOUR SMALL GAINS ARE CURSE OF THE ELEMENTS REACHING DAMAGE NOBODY THINKS OF
AS MAGIC.** A Rogue's poisons tick NATURE and a Hunter's Immolation Trap burns
FIRE, so three nominally physical profiles take a share of an 8% magic debuff --
and the share is in the right order, Venom's poison-heavy build gaining most. That
is the sort of thing a containment check is for: those four were not expected to
move at all, and the reason they did is correct rather than a leak.

**THE MEAN WAS 498.8 AT THAT POINT**, from 463.5. The dives and corrections
below then took it to 488.3, and Judgement of Wisdom to 496.8.

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

**RAPID FIRE WAS IN THE MELEE HUNTER'S BOOK AND IN NO LIST.** LW Melee **495.4
to 523.8, +28.4, REAL**, the other twenty-two identical to the decimal.
"Increases RANGED AND MELEE attack speed by 40% for 15 sec" -- the melee half is
why it belongs, and the other two Hunter lists have carried it since they were
written. **This one was the odd one out for as long as the build swung a
two-hander, and nobody re-read the list against the ability book when it
changed.**

**WHERE IT GOES MEASURES AS NOTHING.** First 517.0, third 523.8, last 531.2, on
intervals of 5.3, 7.3 and 7.1 -- all three overlap, so by this project's own rule
that is no difference and the nominally-highest is noise. It sits third because
that is where the owner's other two lists put it. **The entry is worth +28.4 and
its position is worth zero**, which is a distinction worth keeping apart: one is
a finding and the other is a coin.

**THE MELEE HUNTER DUAL-WIELDS NOW, AND IT MOVED ONE PROFILE.** LW Melee
**414.5 to 495.4, +80.9, REAL**, the other twenty-two identical to the decimal.
The ruleset owner replaced its two-hander with Vis'kag and the Core Hound Tooth,
both enchanted, and it is worth more than a weapon swap because it expired a
talent's caveat and exposed a proc that had been right by accident:

| | |
| --- | --- |
| **+38.8** | **Predator's Edge's off-hand clause**, which had no off hand to raise until now |
| **+30.2** | **Deadly Aspects rolling off EITHER hand**, which its tooltip always said |
| **~+11.9** | the switch itself: two weapons, two swing timers, and Vis'kag's Fatal Wound proc |

They overlap, so the three do not sum exactly. **The off hand is 23.5% of the
profile**, and Mongoose Bite nearly doubles its casts -- 3.3 a fight to 6.2 --
because Expose Prey procs off both hands.

**PREDATOR'S EDGE WAS HALF A TALENT AND THE OTHER HALF WAS NEVER AN ENGINE GAP.**
Its `unmodelled` reason read "there is no off hand for the second number to
raise", which is a claim about the PROFILE rather than about the engine --
`offHandDamage` had existed since Dual Wield Specialization needed it. The owner
changed the build and the reason expired with no engine code touched. **Hunter
goes 27 fully modelled to 28, and partly 6 to 5.**

**THE TALENT MULTIPLIES THE PENALTY RATHER THAN REPLACING IT**, which is the
arithmetic worth writing down: `0.5 x (1 + 50 / 100) = 0.75`, the owner's stated
25% penalty. Writing 0.75 directly would agree with them at rank 5 and silently
stop scaling everywhere else.

**THE PROC THAT HAD BEEN RIGHT BY ACCIDENT IS THE PART TO CARRY.** Deadly
Aspects' melee half checked `isWeaponUseOf(attack, 'mainHand')`, and while this
Hunter held a two-hander that WAS "any melee swing" -- one slot swings. Dual
wielding separated them, and the off hand is the FASTER weapon, so most of the
build's swings had stopped rolling for a proc whose tooltip says "all melee auto
attacks". **A test can be equivalent by accident and stop being so because the
CHARACTER changed, not the code** -- the "check its siblings" lesson arriving
from the other direction, and worth more than the weapon swap itself.

**THE HAWK HAS BEEN REDEFINED THREE TIMES IN THREE DAYS, AND EACH TIME IT MOVED
ONE PROFILE AND NOTHING ELSE.** The latest: **646.6 to 547.0, -99.6, REAL**, the
other twenty-two identical to the decimal.

| Revision | What it said | BM Hunter |
| --- | --- | --- |
| 2026-09-30 | 108 flat every 2 seconds, one aura stacked twice | 731.8 |
| 2026-10-02 | 108 + 5% RAP every 3 seconds, 7 hits, two independent hawks | 646.6 |
| 2026-10-02 | **108 + 5% RAP on the dive, a QUARTER of it every 2 seconds** | **547.0** |

**THE THIRD IS 3.25 OPENERS AGAINST THE SECOND'S 7**, so the ability more than
halved and the profile fell 15.4% with it. The hawk goes from the largest single
source at 30.3% to **17.9%**, behind auto-shot again and level with the pet's
swings.

**THE SECOND REVISION'S ISOLATIONS, KEPT BECAUSE THEY STILL EXPLAIN THE SHAPE:**
the 5% ranged attack power coefficient was worth **+84.0** measured by zeroing
it, and the move from ten hits at two seconds to seven at three was **-32.5**
including the gain from each hawk getting its own clock.

**WHAT HAS SURVIVED ALL THREE REVISIONS** is the part that was never about the
numbers: two independent auras with two clocks, the overwrite-the-oldest rule,
the `summoned_hawks < 2` clause on the list, and the damage crediting
`summon_hawk` so Unleashed Fury and Ferocity keep reaching it. **AND IT CLOSED A CAVEAT RATHER THAN A PLACEHOLDER**: the old model
admitted in writing that the two hawks shared one eighteen-second clock, so
summoning the second reset the first and both expired together. `hawk_1` and
`hawk_2` are separate auras now.

**THE SILENT BREAKAGE IT NEARLY CAUSED IS THE PART WORTH CARRYING.** Unleashed
Fury and Ferocity both key on the ability id `summon_hawk`, and both reached the
old hawk only because the AURA was called `summon_hawk` -- a periodic tick
carries its aura's id. Renaming the auras would have stopped two talents
applying to a quarter of a Beast Mastery build's damage with nothing erroring.
The damage events pass `abilityId` explicitly and a test asserts it.

**THE PET MODEL MOVED ONE PROFILE AND NOTHING ELSE BY A DECIMAL BEFORE THAT.** BM Hunter
**788.1 to 595.1, -193.0, REAL**, and the other twenty-two identical -- the two
pet-less Hunters included, which is the containment check for a change confined
to `createPet`. The ruleset owner supplied a complete pet model on 2026-10-01 and
**it removed the last placeholder in the class**:

| | |
| --- | --- |
| **-230.8** | the base damage, 300 a swing to **36.34-55.32**, measured with the pet's attack power and crit left as they were |
| **+37.5** | the pet's own **252 attack power and 5 crit**, which did not exist at all before |

**SO BM HUNTER'S 788.1 AND ITS 731.8 BEFORE THAT WERE BOTH MEASURED AGAINST AN
INVENTED BASE DAMAGE** -- 50 for the life of the project and 150 for a day. 595.1
is the first figure that was not, and it takes the profile from first to fourth.
The two isolations above were measured on the pre-`#149` raid buffs, where the
whole was -193.2; re-measured here it is -193.0, which is the same change seen
through a different raid.

**THE HUNTER DEEP DIVE CAME FIRST AND ITS CONTAINMENT HELD TOO.**
BM Hunter **405.8 to 731.8, +326.0, REAL** and LW Melee **321.5 to 362.7, +41.1,
REAL**; the other twenty-one identical to the decimal, **LW Ranged included** --
which is the check for a change that touched pets, hawks, traps and a melee bleed
at once.

**ALMOST ALL OF IT WAS TWO OWNER ANSWERS, NOT ENGINE WORK.** Both figures were
named `PLACEHOLDER_` and both were load-bearing:

| | |
| --- | --- |
| BM Hunter **+223.2** | the pet's base DPS, **50 to 150** -- **superseded the next day by the owner's real model**, above |
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

**THE PRIEST WAS THEN TUNED BY THE OWNER AND IS 516.4 TO 597.9, +81.5 REAL**,
with twenty-three of the twenty-four identical to the decimal. Shadow Word:
Death's entry is **+37.7** -- the price recorded against it twice while it was
absent, and the owner took it -- the new 13/3/35 build is **+18.7**, and the
Improved Mind Flay fix is **+18.2**. **Marginal figures, each measured by
removal from the finished configuration, and they do not sum to 81.5.**

**ONE TALENT HAD BEEN APPLYING THE WRONG NUMBER, AND NO AUDIT HERE ASKS.**
Improved Mind Flay declared `valueIndex: 1` against a row of
`[damage%, yards, slow%]`, so it applied the RANGE as a damage multiplier for
its whole life. **The census has four columns and none of them is "correct"**;
`coefficient_probe` asks whether damage responds to a stat and `ability_audit`
whether an ability is connected. The plausible wrong value was another rank's
right one -- 10% where the talent grants 20% -- so the talent read as one rank
behind itself and no figure looked odd. `tools/value_index_sweep.mjs` lists the
other 47 sites and **found a second instance at once**: the Warlock's Aftermath,
right only because at 5/5 its two candidate numbers coincide.

**AND THE HOLD BAND THE OWNER PUT ON SHADOW WORD: DEATH MEASURES -4.9**, which
was put to the owner with that figure and **ruled: "leave the hold band".** So it
is a DECISION rather than an outstanding item, the same resolution Hunter's Mark
got at -10.1 -- and saying which it is matters, because a settled choice written
up as pending inflates the queue and hides the real work.

It buys nothing because the Early Demise window (11.6s) is shorter than the
ability's cooldown (15s), so at most one cast can land in it and an ungated entry
already lands that one: 1.00 a fight either way, against 3.53 casts held and 4.00
unheld. **What would reopen it is the arithmetic, not the DPS** -- a longer fight
or a shorter cooldown makes the window hold two casts, and a test fails if that
happens.

**THE RATIONALE FIRST WRITTEN FOR THE BAND WAS FALSE** -- "one cooldown wide",
from 15% of a hundred-second fight, when the fight is sixty -- **and a test had
been written that asserted it and passed**, because `bandFraction * seconds(100)`
really is 15000. A rationale is a claim and wants measuring like any other.

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
mean across 25 was **700.0** at that round, RE-SUMMED FROM THE TABLE rather than
adjusted -- **by `tools/update_baseline_table.py`, which exists now**; the
sentence above it had promised a script for several commits and there was none,
so the mean and the ordering were still being maintained by hand.

**AND THAT FIGURE IS DATED NOW, BECAUSE THE SCRIPT HAD BEEN REWRITING IT.**
`update_baseline_table.py` replaced the FIRST "mean across N is X" in the whole
file, and the first one was this sentence -- fifteen hundred lines above the
table, inside a paragraph about Frostfire 412.5. So every run since has
published the current mean in the middle of a dated write-up, which is this
file's own complaint about a script that re-derives one copy of a figure,
pointing at the copy it was aiming for. The script anchors AFTER the table it
just rebuilt now, and the live sentence is under the table where it belongs.
**AND RE-SUMMING IT ONCE MOVED IT 21.5 ON A CHANGE WORTH 1.7 A PROFILE** -- that
was the Shatter edit, not this one -- which is the drift the instruction exists
to catch: 558.9 was stale at that point and would have stayed stale if the
figure had been adjusted by the delta instead. It read 488.3 for a while, then 541.3 **across 23 when there
were already 24** -- each figure right when it was written and drifted as dive after
dive moved a profile and left the average alone. **The COUNT drifted too, which
is the same failure one level up**: Hemo made it twenty-four and the sentence
kept saying twenty-three. Add the rows up and count them.
See [docs/handoff-apl.md](docs/handoff-apl.md).

**AND THEN THE BASE PAW DAMAGE TURNED OUT TO BE 1, FOR BOTH FORMS.** Stated by
the ruleset owner, where `BASE_BEAR_PAW_DAMAGE` and `BASE_CAT_PAW_DAMAGE` had
been **assumed at 100 and 50** with a comment saying so. They were about a fifth
of every paw swing -- 50 of the Cat's 245.1 and 100 of the Bear's 511.1 -- so two
profiles were carrying a sixth to a fifth of their damage on a number nobody had
supplied.

| Profile | was | now | |
| --- | --- | --- | --- |
| Cat | 937.7 | **843.0** | **-94.8, -10.1% REAL** |
| Bear | 523.1 | **433.6** | **-89.5, -17.1% REAL** |
| the other 22 | | | **+0.0** |

**THE MOONKIN IS ONE OF THE TWENTY-TWO**, which is the containment check worth
naming: it is the third Druid profile and it is a caster, so it holds a weapon
rather than a paw and the constant cannot reach it.

**THE TWO FORMS LOST DIFFERENT SHARES FROM THE SAME ~20% CUT, AND THE REASON IS
`weaponScaling`.** The base paw damage is a flat term inside the paw, so it
reaches the autos and the abilities that take weapon damage and nothing else:

| | paw-based share | prediction | measured |
| --- | --- | --- | --- |
| Bear | **85.9%** -- Maul 31.5, autos 28.0, Primal Bite 26.4 | 19.4% x 85.9% = 16.7% | **17.1%** |
| Cat | **54.6%** -- autos 31.5, Shred 23.1 | 20.0% x 54.6% = 10.9% | **10.1%** |

Rip at 35.3% and Rake at 10.1% carry their own coefficients, and Lacerate's
14.1% is a stacking DoT -- none of the three touches the paw.

**AND THE COMMENT NAMING THE PAW ABILITIES WAS WRONG, WHICH IS THE OBVIOUS PLACE
SOMEBODY WOULD GO FOR THAT ESTIMATE.** `weapons.ts` listed "Shred, Claw, Maul,
Primal Bite, Lacerate"; Lacerate deals no weapon damage at all. Pricing this
change off that list would have expected the Bear to lose its Lacerate share
too, putting the estimate at 19.4% x 100%. **Read `weaponScaling` rather than a
prose list of which abilities use the weapon.**

**THE BEAR IS NOW THE SECOND-LOWEST PROFILE IN THE PROJECT**, 433.6 against Prot
Pally's 303.9, having been mid-table. That is what the owner's number says and
it is not a tuning decision -- but it is a large move on a tank build and worth
knowing about.

**AND THEN RIP'S COEFFICIENT WAS PER TICK AND SHOULD HAVE BEEN PER DURATION.**
The owner reported the Cat as still too high and named the ability: "rip should
be 4% attack power coefficient per combo point spent over its duration NOT each
tick; each tick should be 4%/6 attack power coefficient per combo point spent."

Rip has SIX ticks -- twelve seconds at two -- so a five-point Rip was paying
`0.04 x 5 x 6` = **120% of attack power instead of 20%**, six times the stated
figure.

| Profile | was | now | |
| --- | --- | --- | --- |
| Cat | 843.0 | **663.3** | **-179.7, -21.3% REAL** |
| the other 23 | | | **+0.0** |

**THE BEAR IS ONE OF THE TWENTY-THREE AND SO IS THE MOONKIN**, which is the
containment worth naming: Rip is a Cat finisher, so neither of the other two
Druid profiles can reach it.

**THE ARITHMETIC RECONCILES, WHICH IS THE CHECK THAT THE FIX LANDED WHERE IT
SHOULD.** At 1792 attack power a five-point Rip went from `855 + 2150.4` to
`855 + 358.4`, so it pays 40.4% of what it did. Rip was 35.3% of 843.0 = 297.6,
and `297.6 x (1 - 0.404)` predicts **-177.4** against a measured **-179.7**. Its
share is **17.9%** now and the Cat's top source is its auto-attack at 40.0%.

**NOTHING IN THE SOURCE EVER SAID PER TICK, AND THE SHEET'S OWN NOTATION SAYS
SO.** `docs/spell-coefficients.md` records the key: `N% per tick` for an effect
stated per tick, `N%*combo point spent` for one multiplied by what the finisher
spent. Rip's row carries the second marker and NOT the first. **The per-tick
reading contradicted a notation table in the same document** -- and the constant
was named `RIP_TICK_AP_COEFFICIENT_PER_COMBO_POINT` with a comment repeating it,
which is how a reading becomes a fact nobody re-checks.

**THE TELL WAS THAT THE TWO HALVES OF ONE EFFECT USED DIFFERENT CONVENTIONS.**
Rip's flat damage was always a duration total divided by the tick count
(`RIP_BY_COMBO_POINT` over six) while its coefficient was applied per tick. Both
halves now come from one duration total over one named `RIP_TICK_COUNT`, so they
cannot drift apart again -- and a reader checking EITHER HALF ALONE would have
found it self-consistent, which is why this needed the owner rather than an
audit.

**AND IT PUTS THE CAT'S LIST BACK IN QUESTION, WHICH IS NOT DONE HERE.** Rip now
pays 40% of what it did, so "spend five points on Rip" is a weaker claim than it
was and Ferocious Bite is the alternative the list does not use. That is an APL
measurement rather than a coefficient fix, and this commit deliberately changes
one thing: the Cat's priority list is untouched and its 663.3 is the figure for
the list as it stands.

**AND NATURALIST WAS READING A NUMBER OF SECONDS AS A PERCENTAGE.** "Reduces the
cast time of your Healing Touch spell by 0.5 sec and increases all damage you
deal by 5%" is one values row of two numbers, `[0.5, 5]`, and
`conditionalDamage` had no `valueIndex` -- so it read index 0 and a rank-5
Moonkin carried **x1.005 instead of x1.05** for the whole life of the talent.
Moonkin **472.8 to 494.0, +21.2**, Cat **703.8 to 716.4, +12.6**, and the other
twenty-two identical to the decimal.

**BOTH LAND EXACTLY ON THE RATIO, WHICH IS A BETTER CHECK THAN THE VERDICT.**
472.8 x 1.05 / 1.005 = 494.0 and 703.8 x 1.02 / 1.002 = 716.4, to the decimal in
both cases -- so the Cat's +12.6 is a deterministic +1.8% even though the harness
printed `noise` for it. **A REAL/noise verdict is a statistical test on the
OUTPUT, and a change with a known exact mechanism can be real and be labelled
noise**: the Cat is a high-variance profile and 1.8% is inside its own interval.
Read the label, then check the mechanism.

**NOTHING COULD HAVE CAUGHT IT, and that is the part worth keeping.** Half a
percent is a plausible blanket multiplier; the talent reported itself FULLY
MODELLED, so the census counted it in the `Fully` column and no audit looks at a
working talent's magnitude; and the only published check on it was a profile DPS
figure measured with the bug already in. Every Moonkin and Cat number in this
repository was light and perfectly self-consistent.
`tests/game/talentValueIndex.test.ts` now records all eleven blanket
multipliers, by hand, with what each one's index MEANS.

**AND MOONKIN AURA WAS WORTH 6% TO THE WRONG RAID.** The owner has ruled that
Moonkin Aura and Leader of the Pack "are all the same exclusive 3% global
critical strike chance and do not stack", which SUPERSEDES their earlier "they
don't stack, but that can be handled on the GUI". The GUI half was never enough:
`withRaidBuff` governs the two RAID BUFF entries and knows nothing about the two
TALENTS, so a Moonkin carrying its own form talent in a raid with Leader of the
Pack ticked held two different aura ids and read **+6% crit** -- 24.243% spell
crit against 21.243%, measured. A profile loaded from JSON with both buff ids did
the same, because nothing re-runs `withRaidBuff` on load.

**ONE `AuraDefinition`, ONE id, FOUR SOURCES.** `PARTY_CRIT_AURA`, and both raid
buff entries and both talents apply it, so `AuraCollection.apply` refreshes
instead of stacking and no combination is worth more than 3%. Structural rather
than remembered: a fifth source gets the rule for free. **A rule enforced at a
chooser does not cover a source the chooser does not own.**

**AND THE MOONKIN PRESET NOW SELECTS MOONKIN AURA BY DEFAULT**, on the owner's
instruction -- a SUBSTITUTION for Leader of the Pack rather than the removal it
used to be, because the raid is not short a buff, it has the other one. Three
presets now substitute a raid buff and one drops one; the exception lists are
derived from `PRESET_RAID_BUFFS` by mapping and asserted EXHAUSTIVE in
`presets.test.ts`.

**ALL 24 PROFILES ARE IDENTICAL TO THE DECIMAL**, which is the whole point: the
fix removes a way to be wrong rather than changing a number, and the containment
check is that nothing moved at all.

**AND THEN SPELL HIT, WHICH WAS THREE SEPARATE THINGS.** The owner stated the
numbers -- 17% flat spell miss, a 1% floor, so a 16% usable cap -- and that a DoT
APPLICATION rolls to hit while its ticks never ask again.

| | |
| --- | --- |
| **Nature's Reach was doing NEITHER of its clauses** | "Increases the range of your offensive Balance spells by 20% **and improves your chance to hit by 4%**", declared as one `positioning` entry reading "Range, and nothing here has a position". True of the first clause, silent about the second |
| **The spell miss floored at 0, not 1%** | so the cap was 17 and the seventeenth point still bought something |
| **Serpent Sting could not miss** | it declared `ranged-special` and applied its aura unconditionally -- the only DoT in the project that never rolled |

**A `scope` IS THE WORST PLACE FOR A CLAUSE TO GO MISSING.** It is permanent by
design, so Nature's Reach was counted as RULED OUT rather than as a live gap: the
census that exists to find unfinished work had nothing to report, and 4% hit went
missing on all three Druid profiles for the life of the talent. **The Druid's
live-gap count did not change when this was fixed** -- 2 before, 2 after -- which
is exactly the problem. Classic's Nature's Reach is range and nothing else, which
is why the name and the first clause agreed with each other and with nothing else.

| Profile | was | now | |
| --- | --- | --- | --- |
| Cat | 716.4 | **749.7** | +33.3 REAL -- 4% melee hit |
| Moonkin | 494.0 | **516.8** | +22.8 REAL -- 4% spell hit |
| Bear | 488.5 | **494.8** | +6.3, inside its own interval and mechanically real |
| Shockadin | 583.6 | **581.2** | -2.4 -- the floor, see below |
| LW Ranged | 482.1 | **486.5** | +4.4, and NOT a gain. See below |
| BM Hunter | 595.8 | **595.7** | -0.1, the same |

**THE FLOOR WAS ALREADY LOAD-BEARING AND A PROBE SAID IT WAS NOT.** Hit reaches a
spell along TWO routes -- the character-wide `hitChance` stat, folded in by
`attackChances`, and a SCHOOL-scoped `hitBonus` folded in later by
`withModifier` -- so the floor is carried ON THE TABLE as
`AttackChances.missFloor`, where both respect it. Checking the STAT alone said no
profile was over 16% and the floor was a guard for the future; the SHOCKADIN
takes Divine Precision for +12% Holy hit on top of 6% from gear, which is 18
against a 17% miss, so its Holy spells could not miss at all. **A cap nobody has
reached is still the wrong cap, and "nobody" depended on which route was
measured.**

**THE TWO HUNTERS MOVED AND NEITHER MOVE IS A GAIN.** Serpent Sting now draws a
random number it did not draw before, which re-sequences every roll after it in a
seeded run -- so both figures are inside their intervals and the mechanism can
only ever REDUCE the sting's damage. Measured directly rather than inferred: over
twenty seeds it now lands 98.7% of casts on LW Ranged and 96.4% on BM Hunter,
where before it landed 100%.

**AND THEN OMEN OF CLARITY, WHICH IS WORTH EVERYTHING TO ONE DRUID AND NOTHING TO
THE OTHER TWO.** Every Druid learns it at 20 and none spends a point on it, so it
is registered by `reactionsForClass` beside Windfury Weapon rather than as a
talent proc. The owner supplied all three numbers and the tooltip states none of
them: **4% per spell or attack, doubled in Moonkin form, ten second internal
cooldown.**

| Profile | was | now | | procs a fight |
| --- | --- | --- | --- | --- |
| Cat | 749.7 | **795.3** | **+45.7 REAL** | 2.05, all spent |
| Bear | 494.8 | **498.0** | +3.2, inside its interval | 1.45 |
| Moonkin | 516.8 | **513.4** | -3.4, inside its interval | 1.50 (8%) |

**ONLY THE CAT IS RESOURCE-BOUND, WHICH IS THE WHOLE EXPLANATION** -- and it is
the same finding King of the Jungle produced on the same build. The Cat's entire
fight budget is about 690 energy, so two free 42-energy Shreds are +12% of it.
The Moonkin finishes with **29% of its mana income unspent** and the Bear is rage
rich, so a free cast there saves a resource they already have spare. **A correct
proc can be worth zero**, and the mechanism is what says it works: 1.50 and 1.45
procs a fight, every one of them spent.

**THE TWO SMALL FIGURES ARE RE-SEQUENCING, NOT EFFECT.** `canTrigger` rolls on
every landed attack, which reshuffles every subsequent roll in a seeded fight --
so for the Bear and the Moonkin the proc's own dice swamp what the proc is worth.
Read the procs column, not the DPS column.

**AND THEN TWO DEFENSIVE TALENTS, ONE WITH THE WRONG INDEX AND ONE WITH THE
WRONG RULE.** Both reported by the ruleset owner, and both confirmed:

| | |
| --- | --- |
| **Feral Swiftness gave 30 dodge, not 4** | "increases your movement speed while in Cat Form by {0}%, and increases your chance to Dodge by {1}%" -- `[30, 4]` at rank 2, no `valueIndex`, so it granted the MOVEMENT SPEED. The FOURTH value-index bug in this class |
| **Thick Hide was 3% of item armor** | it is "{0} additional base Armor per LEVEL and another {1} base Armor for each point of defense skill beyond five times your level" -- 54 armor against a correct **274** |

**ONE WAS THE WRONG INDEX AND THE OTHER THE WRONG RULE, AND THE SECOND IS
QUIETER.** A wrong rule ignores both indices equally, so there is no wrong index
for an index sweep to find; what found it was reading the tooltip beside the
declaration. Thick Hide needed two UNITS rather than two rules -- `statFromLevel`
and `statFromStat` both default to reading their value as a percentage, and now
take `scale: 1` for a talent stating a multiple.

**AND `statFromStat` TURNED OUT TO READ MORE THAN IT SAID.** It was documented
and tested as primaries-only because "the derivation is handed resolved
primaries" -- and `StatBlock` hands it the whole FIRST PASS, every stat resolved.
The real constraint is that nothing the derivation PRODUCES may be read by it, so
`defenseSkill` is safe and the test checks that property across all nine classes
instead of listing five stat names.

| Profile | was | now | |
| --- | --- | --- | --- |
| Bear | 514.4 | **523.1** | **+8.7** |
| the other 23 | | | **+0.0** |

**THE CAT DID NOT MOVE BY A DECIMAL AND TAKES FERAL SWIFTNESS AT RANK 2.** Its
dodge fell 45.95% to 19.95% and nothing attacks it, so 26 points of avoidance are
worth exactly zero -- which is the containment check that this commit reaches
only what it should.

**THE NET IS TWO MECHANISMS PULLING OPPOSITE WAYS, SO THE PAIR WAS MEASURED**
(`python tools/thick_hide_attribution.py`), with the Bear's armor, dodge, deaths,
damage taken and rage beside each figure:

| variant | armor | dodge | deaths | taken | rage | DPS |
| --- | --- | --- | --- | --- | --- | --- |
| both, as committed | 2870 | 19.45% | 13.69 | 275129 | 750 | **523.1** |
| without the dodge index | 2870 | 45.45% | 8.60 | 181443 | 671 | 516.9 |
| without the armor rule | 2650 | 19.45% | 13.87 | 282434 | 751 | 524.8 |
| neither | 2650 | 45.45% | 8.63 | 185385 | 669 | **514.4** |

The last row reproduces the published 514.4 to the decimal, which is the
cross-check the Cat probe learned the hard way. **Feral Swiftness is +10.4
isolated** -- 26 fewer points of avoidance, 52% more damage taken, 61% more
deaths, 82 more rage -- **and Thick Hide is −1.7 marginal and +2.5 isolated,
inside the interval both ways.**

**A PREDICTION IN THREE COMMENTS AND A TEST WAS WRONG, AND THE RULE THAT
FALSIFIED IT WAS ALREADY WRITTEN DOWN.** They said "more armor means less damage
taken means less rage, so the Bear's DPS falls". **Armor does not reduce rage** --
it comes off the PRE-ARMOR figure, which `resourceRules.ts` states in those words
and CLAUDE.md repeats. Measured: rage 751 to 750. All four have been corrected to
what the measurement shows.

**AND THE CENSUS MOVED WITHOUT THE LIVE-GAP COUNT MOVING.** Feral Swiftness's
movement-speed clause is `positioning` and was simply not declared, so the talent
sat in the `Fully` column -- the one column nothing re-reads -- while its only
live clause had the wrong index. The Druid is **29 fully, 6 partly, 14 ruled out,
2 live gaps**, the same two shapeshifting talents as before.

**AND THEN FOUR THINGS ON THE CAT, TWO OF THEM A SECOND CLAUSE NOBODY READ.**
The ruleset owner reported all four; what each turned out to be:

| | |
| --- | --- |
| **Primal Fury gave a Cat nothing** | its row holds THREE numbers and a single `reaction` read index 0. The whole second clause -- "your non-periodic critical strikes from Cat Form abilities that generate Combo Points have a 100% chance to add an additional Combo Point" -- was absent, and the talent reported itself FULLY MODELLED |
| **Rend and Tear read ~1.025x where ~1.09x was expected** | scoped to `melee-special` and non-periodic, on the reading "melee ABILITIES" invites |
| **Rake's DoT tick scaled at 1%** | the owner has since given it as 5.5%; the HIT stays at 1% |
| **Clearcasting went wherever the list reached** | about a third of the procs paid for Rake and Rip instead of Shred |

**THE OWNER'S FIGURE SETTLED A WORDING QUESTION THE WORDING COULD NOT.** With the
target bleeding 89.3% of the fight, the three readings of Rend and Tear measure
**x1.0296**, **x1.0612** and **x1.0948** -- and the first and last are the 1.025
reported as the symptom and the 1.09 reported as the expectation, to the decimal.
So it reaches every point of melee damage, and **Rip raises Rip**: a bleed's own
ticks are amplified by the bleed being up, which is the self-reference the narrow
reading was partly chosen to avoid, and the owner's figure includes it.

| Profile | was | now | |
| --- | --- | --- | --- |
| Cat | 795.3 | **937.7** | **+142.4 REAL** |
| Bear | 498.0 | **514.4** | **+16.4 REAL** |
| the other 22 | | | **+0.0** |

**THE CAT'S SPLIT, AS MARGINAL VALUES against the full build** -- each is what
removing that one change costs with the other three present:

| | Cat | Bear |
| --- | --- | --- |
| Rend and Tear widened | **+61.0** (autos 27.4, ticks 33.6) | **+16.4** (autos 9.5, ticks 6.9) |
| Primal Fury's combo points | **+45.1** | — |
| Rake's 5.5% tick | **+43.7** | — |
| Clearcasting always on Shred | +6.3, inside the interval | — |

**THEY SUM TO MORE THAN THE TOTAL AND THAT IS NOT AN ERROR**: 156.1 against
+142.4, because the marginals overlap -- Rake's bigger ticks and Rip's ticks both
collect Rend and Tear, so removing either alone understates what they share. The
Rend and Tear halves ARE exactly additive within themselves, 27.4 + 33.6 = 61.0
and 9.5 + 6.9 = 16.4, and the Bear's "as it shipped" variant reproduces its old
498.0 to the decimal -- which is the cross-check that Rend and Tear is the only
one of the four that reaches the Bear.

**THE PROBE WAS WRONG TWICE BEFORE IT WAS RIGHT**, and both times the tell was
arithmetic rather than a failure. It first reverted only the `tables` list and not
the fold in `damage.ts`, leaving the tick half in its own baseline; then it
reverted the fold with a one-shot string replace, and
`bleedingTargetModifier(request, request.attackTable ?? request.critFrom)`
appears TWICE in that file -- the crit fold and the damage fold -- so it patched
the inert one and two variants came back identical to the decimal. **Two variants
that agree exactly are a patch that did not apply.**

**A BALANCE OBSERVATION RATHER THAN A BUG: the Cat is now 40% clear of the next
profile**, 937.7 against DW Fury's 667.5, and 82% above the Bear. Every one of
the four levers is a figure the owner stated, so nothing here is a guess -- but
the spread across the 24 is much wider than it was and that is worth a look.

**AND MOONKIN FORM HAS NO UNMODELLED CLAUSE LEFT.** Its last one read "Omen of
Clarity's trigger chance is doubled, and Omen of Clarity is not declared ... so
there is no proc here for this to double" -- true when written, and specific
enough to point straight back here the day the proc landed. The Druid census was
**30 fully / 5 partly / 14 ruled out / 2 live gaps** at this point, and declaring
Feral Swiftness's positioning clause later moved one talent from `fully` to
`partly`.

**AND THEN AN OFFICIAL SOURCE REVISED DEEP WOUNDS AGAIN, THREE BULLETS, AND TWO
OF THEM WERE ALREADY RIGHT.** "Deep Wounds compared to Vanilla now: rolls over
its damage when refreshed; doesn't reset its tick timer when it is refreshed;
doesn't scale with Attack Power."

| Bullet | State |
| --- | --- |
| rolls over its damage | **already done** -- the pool, above |
| doesn't reset its tick timer | **already true, BY ACCIDENT.** `refresh` cancels and reschedules the EXPIRY and never touches `tickHandle`. Nothing asserted it, so nothing would have caught the day it changed; measured and pinned now |
| **doesn't scale with Attack Power** | **wrong here.** The pool read the universal weapon formula, base + (speed / 14) x AP |

**IT IS A LARGE NERF: 2H Arms -46.7, DW Fury -61.7, Prot Warr -18.7, all REAL**,
and it nearly cancels the pooling gain. Net across the whole Deep Wounds pass,
against the figures before any of it: 2H Arms **-3.5**, DW Fury **+0.3**, Prot
Warr **-12.0** (of which -4.7 is Thunder Clap). So the bleed was being paid twice
over -- once by rolling nothing over, and once by scaling with attack power --
and the two errors had been hiding each other.

**TWO CLOCKS, AND ONLY ONE RESETS.** The owner says the DURATION restarts at
twelve seconds; the official note says the TICK TIMER does not. Both hold: the
window re-opens while the ticks keep their cadence, so a refresh one second after
a tick still ticks one second later.

**AND A TEST HAD BEEN INSISTING ON THE BUG.** `talentReactions.test.ts` computed
its expectation from the weapon formula WITH attack power, and its comment said
it did so "so the test would catch the aura scaling by attack power twice". It
caught the wrong thing: scaling it once was already one time too many. A test
that pins the wrong rule defends it.

**THUNDER CLAP TAKES ITS CRIT FROM THE SPELL TABLE**, by the ruleset owner, and
it moved Prot Warr 480.4 to **475.7, -4.7** -- the only profile that casts it.
Its crit rate goes 17.7% to 4.9%, because the warrior's spell crit is 10% against
24.4% melee and both are suppressed against a level 63 target.

**ONLY THE CRIT MOVED, AND THAT WAS A DECISION.** `attackTable: 'spell'` would
have been a one-word change and brought something nobody asked for: spell miss is
flat where `missFromSkill` gave Thunder Clap almost none, so **0.9% avoided became
9.4%** -- a melee ability missing ten times as often off a sentence about critical
strikes, for a net -5.4 rather than -4.7. Every clause of the ruling is about
crit, so `DamageRequest.critTable` moves the crit chance and multiplier and
leaves miss, dodge and parry where they were.

**TWO OF THE THREE EXCLUSIONS WERE FREE AND ONE WAS NOT.** Cruelty is a
`critChance` stat, so the spell table cannot see it. Crit from AGILITY is a
vacuous exclusion -- there is no agility-to-crit conversion in this engine at
all, which `baseStatTypes.ts` states outright. **Weaponmaster needed real work**:
its axe/polearm crit was an `ALL_ABILITIES` ability modifier, which reaches any
ability with an id whatever table it uses.

**AND FIXING WEAPONMASTER FOUND IT WRONG IN BOTH DIRECTIONS.** `ALL_ABILITIES`
reaches no AUTO ATTACK, because a swing carries no ability id -- and "gives your
melee weapon attacks a benefit" plainly includes swings, which are the largest
source on every Warrior profile. Scoped to `melee-auto` and `melee-special` now,
which draws the line the tooltip draws and excludes Thunder Clap for the right
reason. It measures as nothing today: the talent needs an axe or a polearm and
every weapon in every Warrior gear set is a sword.

**DEEP WOUNDS MOVED ALL THREE WARRIORS, AND IT IS THE LARGEST SINGLE CORRECTION
SINCE THE PRIORITY LISTS.** 2H Arms 624.6 to **667.8 (+43.2, REAL)**, DW Fury
667.2 to **729.2 (+62.0, REAL)**, Prot Warr 469.0 to **480.4 (+11.4)**. The other
twenty are identical to the decimal.

**THE RULESET OWNER STATED THREE CLAUSES AND ALL THREE WERE WRONG**: it could
crit, it ticked every three seconds rather than every two, and a re-application
reset the clock and DISCARDED the undelivered damage instead of rolling it over.

**THE ROLLOVER IS NEARLY THE WHOLE OF IT**, and the reason is a rate argument
rather than a damage one. Deep Wounds refreshes on every melee crit, which for
these builds is far more often than once every twelve seconds -- so under
`refreshBehaviour: 'reset'` alone, most of each application's damage was thrown
away before it could tick. Rolling the remainder forward means every crit's worth
eventually lands, and in steady state the bleed delivers one application per crit
instead of a fraction of one.

| Clause REMOVED from the finished build | 2H Arms | DW Fury | Prot Warr |
| --- | --- | --- | --- |
| **the rollover** | **-43.9** | **-68.5** | **-12.8** |
| **"it cannot crit"** (so: crit restored) | +18.8 | +30.9 | +10.5 |
| the two-second cadence (back to three) | -2.4 | -3.1 | -1.3 |

**THEY DO NOT SUM, AND THAT IS THE POINT OF MEASURING THEM THIS WAY.** Each row is
that clause taken OUT of the finished build, so it is worth what it contributes
in the presence of the others -- and the three interact hard, because the crit
multiplier scales whatever the pool is delivering and the rollover decides how
much that is. -43.9 + 18.8 - 2.4 is +27.5 against an actual +43.2; reading the
rows as independent terms would be wrong by a third.

**THE CADENCE IS ALMOST FREE**, which is worth knowing: six ticks of a sixth and
four ticks of a quarter deliver the same pool over the same twelve seconds. What
the faster cadence buys is only that the pool drains sooner, which matters a
little once refreshes are topping it up.

**AND "IT CANNOT CRIT" IS AN EXCEPTION TO A DOCUMENTED UNIVERSAL RULE.** CLAUDE.md
states "Every DoT can crit, and none is reduced by armor. A Forever rule, not
Classic's", and that still holds for every other DoT. Deep Wounds is the owner's
named exception, and the reason is legible: the bleed is the PRODUCT of a critical
strike, so critting again pays the same roll twice. It is the only clause here
that costs damage, and it costs 19 to 31.

**WINDFURY WEAPON IS NOT WINDFURY TOTEM, AND IT WAS MODELLED AS THOUGH IT WERE.**
Enh Shaman 604.0 to **625.8, +21.8, REAL**, and the other twenty-two profiles
identical to the decimal. The ruleset owner separated the two effects on
2026-10-07: the imbue "grants 2 extra SPECIAL attacks with the rank's added
attack power", which differs from the totem in four ways, and the borrowed
implementation got every one of them wrong.

| | What the totem does, and the imbue was doing | The imbue's own rule | Worth |
| --- | --- | --- | --- |
| the attacks | an extra SWING, on `melee-auto` | **SPECIAL** attacks, `melee-special`: two rolls and **no glancing blow** | **+15.8** |
| the attack power | +466 as a 1.5-second AURA | **folded into the hits themselves** | **+18.8** |
| the swing timer | `extraAttack` restarts the slot | **not reset** | ~1 extra swing a fight |
| the report | counted as "Main Hand Auto-Attack" | **its own row** | 15.9% of the build |

**THE FIRST TWO COMPOUND: +31.6 TOGETHER against +34.6 apart**, because a
glancing blow was reducing the bonus attack power as well as the weapon damage.
The net is +21.8 rather than +31.6 because the old window also paid an ordinary
swing or a Stormstrike that happened to land inside it, which partly compensated
for everything else it got wrong.

**AND THE ROW WAS 15.9% OF THE BUILD, HIDING INSIDE THE AUTO-ATTACK LINE.** A
swing is reported as "Main Hand Auto-Attack", so the auto-attack row carried 34
attempts a fight on a weapon that cannot swing more than about 20 times -- the
second-largest damage source in the build, invisible, with the shares summing to
a tidy 100%. **It is "Windfury Attack" now and the imbue keeps its own name**:
`abilityBreakdown` builds one row per NAME and takes `uses` from casts, so
sharing the name produced a single row reading ONE USE and nine ATTEMPTS.

**MAELSTROM WEAPON WAS ASKED ABOUT IN THE SAME MESSAGE AND IS CORRECT.**
`tools/maelstrom_probe.ts` counts the rolls per source against the chance the
weapon's base speed implies: auto-attacks 31.2%, Windfury attacks 32.6%,
Stormstrike 30.7%, against 31.67% for a 3.80-second weapon at 5 PPM. All three
roll, none is missing. The bolt count is low because the ARITHMETIC says so --
about 35 melee uses a minute at 31.67% is 11 procs a minute, and five stacks buy
one bolt -- so 1.7 casts a fight is what 5 PPM means here, not a broken trigger.

**FLURRY'S TRIGGER MOVED ONE PROFILE, AND IT IS A RULING RATHER THAN A FIX.**
Enh Shaman 593.5 to **604.0, +10.5** -- inside the two runs' combined interval, so
the harness calls it noise, but the direction and cause are certain because a
mechanism was switched on rather than a number nudged, and 604.0 reproduced
exactly across two independent worktrees.

**THE CAUSE IS THAT TWO CLASSES SHARE ONE REACTION BUILDER.** Flurry gated on
`isWeaponUse`, which refused crits carrying no weapon slot; the owner ruled it
fires on ANY non-DoT critical strike. For the Warrior that reaches only Thunder
Clap, Intercept and Charge -- none of which DW Fury's list casts, so all three
Warriors are +0.0. **Enhancement Shaman takes its own Flurry and imports the
Warrior's builder**, and a Shaman crits with Lightning Bolt, Flame Shock and
Earth Shock, so there the same breadth is worth real damage.

It shipped NARROW for the Shaman for exactly one PR, because the ruling had been
given while reading a Warrior profile and extending it to another class was an
inference. The owner then ruled this class too. **Both tooltips still say "after
dealing a MELEE critical strike"** -- the override is deliberate and now in two
places at once. The lesson is the sharing: a change to a reaction two classes
import has to be MEASURED on both, and this one would have shipped as an
unexplained +10.5 on a class nobody was looking at.

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

**EVERY LIST IS THE RULESET OWNER'S OWN**, specified entry by entry; what was here
before was this project's guess and said so.

**ALL 24 RE-MEASURED IN ONE RUN, so these are comparable with each other rather
than each being the figure from the dive that last touched it.** The newest is
**Hemo**, a fourth Rogue profile from the owner's own talent URL.

**AND THE TABLE IS REBUILT BY A SCRIPT NOW RATHER THAN EDITED A ROW AT A TIME.** It
parses its own rows for each profile's class and talents, takes the DPS from the
measurement and derives the ordering, then asserts that the profiles it measured and
the profiles the table carries are the same set.

**THAT IS HERE BECAUSE THIS TABLE HAS GONE WRONG THREE TIMES.** Four rows were once
stale with nobody having touched them -- Cat 703.8, Combat 524.2, Venom 494.9 and
Rupture 450.3 were each correct the day they were written and had since been moved
by a dive on another branch. A row-at-a-time edit goes wrong silently, because every
individual figure has a commit behind it and looks defensible on its own. Adding
Hemo moves five rows between the two columns, which is exactly that kind of edit.

**AND IT HAS NOW CAUGHT THE FOURTH, WHICH NO HUMAN WAS GOING TO SEE.** A rebase
auto-merged two versions of this table -- one that had moved the Shadow Priest
into the left column at 597.9, and one that still had it in the right at 516.4 --
and git took BOTH rows cleanly, dropping Shockadin to keep the row count. The
result was twenty-four rows carrying twenty-three profiles, one of them twice at
two different figures, with no conflict marker and nothing misaligned. **The
set assertion is what failed**: "in the map, not in the table: ['Shockadin']".
A table where every row is individually plausible is precisely what a reader
cannot audit, which is why the check is a SET comparison and not a row count.

| Profile | Class | Talents | DPS | | Profile | Class | Talents | DPS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DW Fury | Warrior | 17/34/0 | 989.6 | | Shockadin | Paladin | 23/0/28 | 787.7 |
| LW Ranged | Hunter | 7/39/5 | 912.5 | | Hemo Dagger | Rogue | 17/3/31 | 787.0 |
| Cat Druid | Druid | 9/34/8 | 892.7 | | Moonkin | Druid | 38/0/13 | 785.9 |
| Firelock | Warlock | 5/11/35 | 885.5 | | Shadow Priest | Priest | 13/3/35 | 774.7 |
| Hawk Melee | Hunter | 16/11/24 | 883.0 | | Enh Shaman | Shaman | 17/34/0 | 750.7 |
| Seal Twist Ret | Paladin | 15/0/36 | 876.4 | | Pure Hemo | Rogue | 21/8/22 | 723.5 |
| Arcane Mage | Mage | 47/4/0 | 866.8 | | SM/DS | Warlock | 40/11/0 | 722.4 |
| Frostfire Mage | Mage | 0/29/22 | 863.3 | | Rupture Rogue | Rogue | 12/8/31 | 719.4 |
| BM Hunter | Hunter | 31/20/0 | 856.2 | | Venom Rogue | Rogue | 37/12/2 | 718.9 |
| 2H Arms | Warrior | 39/10/2 | 849.7 | | Ele Shaman | Shaman | 38/13/0 | 671.1 |
| Fire Mage | Mage | 10/39/2 | 843.7 | | Prot Warr | Warrior | 17/0/34 | 469.7 |
| LW Melee | Hunter | 7/13/31 | 831.5 | | Prot Pally | Paladin | 8/34/9 | 434.5 |
| Combat Rogue | Rogue | 18/33/0 | 824.1 | | Bear Druid | Druid | 9/42/0 | 386.1 |
| Combat Mut | Rogue | 30/21/0 | 790.6 | | | | | | |

The mean across **27** is **774.0**, RE-SUMMED FROM THE ROWS ABOVE rather than
adjusted, by `tools/update_baseline_table.py`.

**THE TOP IS DW FURY AT 974.3 +/-10.3, AND LW RANGED IS SECOND AT 888.9
+/-7.2.** The gap is 85.4.

**AND THAT IS THE SIXTH REWRITE OF THIS PARAGRAPH.** It has said "the top is
still the Frostfire Mage and its lead has narrowed to one interval" (true for
one commit), then DW Fury over LW Ranged by 86.1, then over Hawk Melee by 75.7,
then over the Cat by 90.8, then over the Firelock by 81.2, and now over LW
Ranged again by 66.8. **A SENTENCE NAMING THE SECOND-PLACE ROW EXPIRES WHENEVER
ANY ROW MOVES**, which is most commits.

**THESE 25 ARE THE FIRST FIGURES MEASURED ON FOREVER'S OWN ITEMS.** Every
earlier row in this file was measured in Classic and Season of Discovery
stand-ins; all 25 builds now wear the **E65 benchmark set**, generated from the
itemization budget at one quality and one item level. The mean went 730.9 to
**719.6**, which is the least interesting thing about it: **11 rows rose and 14
fell**, and the split is almost perfectly by archetype.

| | n | mean move |
| --- | --- | --- |
| physical, not tanking | 13 | **+14.4** |
| casters | 9 | **-31.6** |
| tanks | 3 | **-62.4** |

**AND IT WAS MEASURED THREE TIMES, WHICH IS WORTH READING AS A SEQUENCE.**
741.0 on Forever's items; 734.1 once every armour-class piece carried stamina at
12.5% of its slot's budget; 719.6 once the owner ruled that share up to the 25%
their own data shows. **Each step moved the mean DOWN and made the items more
like Forever's**, which is the trade the whole benchmark exists to make: a
generated set that spends its budget the way the ruleset does will not be the
set that maximises a DPS figure.
**THE THREE ROWS AT 0.0 THROUGH BOTH CHANGES ARE THE THREE THAT LEAD WITH
STAMINA** -- Prot Warr, Bear, Prot Pally -- which is what says the floor tops up
rather than overrides. At 12.5% it was five: 2H Arms and DW Fury carry stamina
THIRD, which clears a 12.5% floor and not a 25% one.

**TWO CHANGES PULLING AGAINST EACH OTHER, AND NEITHER IS A RULESET FINDING.**
The gear now grants its PRIMARIES, which no benchmark set did -- "+19 Strength"
was written as tooltip text and no rule read it, so every set was pure crit
rating -- plus ranged attack power, mana regeneration and a shield's real block
value. That lifts whatever a build scales with, which is why the physical rows
gained most.

**AND THE OLD SETS WERE NOT ALL ITEM LEVEL 65.** They ran from 66 to 88 and were
distributed unevenly between classes, so part of any gap between two presets was
a gap in their GEAR. E65 is uniform, which is the whole point of a benchmark --
and it means a build whose stand-in set happened to be item level 88 fell on the
swap. **The nine that fell are the nine with the most to lose from levelling the
field**, not nine builds that got worse.

**THE THREE TANKS FELL HARDEST AND IT IS THE WRONG MEASURE FOR THEM.** Bear
455.7 -> 367.3, Prot Warr 542.0 -> 455.5, Prot Pally 372.7 -> 360.6 -- and their
templates spend the budget on stamina, armour, defense skill and now parry, none
of which is damage. `tools/bear_survival.ts` and the SURVIVAL half of the stat
weights are where a Protection change is read; a DPS row for a tank is a number
that moves, not a number that means something.

**SO THIS TABLE IS NOT COMPARABLE TO ANY FIGURE ABOVE IT IN THIS FILE**, and the
reason is the gear rather than the engine. Every delta recorded in an earlier
round -- the enchants' +27.0, the consumables' +105.9, the racials' +9.8 -- was
measured on gear that no longer exists, and re-deriving any of them means
re-running that probe against this set.

**BOTH MAGE ROWS THAT FELL DID SO ON OWNER RULINGS ABOUT COEFFICIENTS AND
CONSUMPTION, NOT ON ANYTHING THIS PROJECT GOT WRONG.** Frostfire went 927.6 to
768.3 and Fire 877.7 to 690.1 -- **first to ninth and third to sixteenth** -- in
two commits, which is 347 DPS off the Mage's two best rows. The class had been
first and third; its best row is now ARCANE, at 769.4, which has not moved at
all through either patch.

**AND THE CASTER RE-SORT THIS PARAGRAPH ONCE DESCRIBED HAS NOW FULLY UNWOUND.** It
read "four of the top six are casters where none was in the top six a commit
ago", which was true of the consumables commit. **None of the top six is a caster
now.** The consumables are still what put them there and the rulings are what took
them out -- which is worth separating, because the first was a change to the
ruleset's generosity and the second two were corrections.

**TWO CHANGES MOVED EVERY ROW, ONE AFTER THE OTHER, AND NOTHING RECORDED BEFORE
EITHER IS COMPARABLE.** The armour enchants were +2.4 to +53.7 on a mean of
+27.0; the consumables were +40.0 to +249.3 on a mean of **+105.9**.

**THE SPREAD IS THE WHOLE STORY OF THE SECOND ONE, AND THE OWNER HAS CONFIRMED
IT IS INTENDED** -- "casters *should* have moved more". A caster's row reaches 254 school-blind spell
power -- the Flask's 150, the Weapon Effect's 36, the Spell Power elixir's 35
and the Food's 33 -- plus 40 more on its own school, 1% spell crit and 25
intellect. On roughly 500 base that is about +57% spell power, and the casters
moved +133 to +249 accordingly. The melee rows have no equivalent: the biggest
single entry they can take is 40 attack power, which is a far smaller share of
what they already carry. **Two tanks and the two ranged Hunters moved least**,
and both tanks for the reason their rows name: a tank spends its categories on
armor and hit points. The two ranged Hunters moved least of the damage builds
because neither Weapon Effect reaches a bow and a Hunter shot carries no spell
coefficient -- **the Attack Power elixir does reach them**, which it did not in
the first version of this change and which is the owner's ruling.

**THAT RULING IS THE ONE PLACE A `noise` VERDICT IS WRONG HERE.** Giving the two
ranged Hunters forty ranged attack power measured +8.0 and +9.5, and the harness
calls both noise against their own intervals -- while the mechanism is
deterministic and exact: forty points on about seventeen hundred. Every OTHER
row moved by **0.0 to the decimal**, which is the containment check saying the
elixir reached the bow and nothing else.

**THE PER-PROFILE ROWS ARE CHOSEN, NOT STATED.** The owner supplied the
catalogue and no per-profile table, and asked for a sensible row on each; the
selections follow one written-down rule and are the first thing an owner table
would replace. See `consumables.ts`.

**AND THE RANKING MOVES WHERE THE ARITHMETIC DOES NOT.** Arcane sits above
Shockadin and Combat above the Shadow Priest on gaps well inside either
interval -- `update_baseline_table.py` sorts on the figure and the figure does
not know that. Read the intervals before reading the order.

**THE PARAGRAPH HERE SAID THE OPPOSITE AND HAD BEEN STALE FOR SEVERAL
COMMITS** -- "Seal Twist Ret 709.0 +/-9.4 against Cat 703.8 +/-6.4 is a gap of
5.2 inside both intervals" -- while the table above it read 937.7 and 748.3. Both
figures had been moved by dives on other branches and the prose was never
re-read. **A CAVEAT ABOUT TWO NUMBERS GOES STALE WHEN EITHER MOVES**, and it is
worse than a stale number because it tells a reader not to trust a ranking that
is now real. The underlying warning is still worth keeping, which is why it is
rewritten rather than deleted: the top of this table HAS changed hands twice
without anybody measuring a difference, so check the intervals before calling
anything the best profile.

**AND IT CHANGED HANDS AND BACK IN ONE DAY, WHICH IS THE POINT.** Cat read 737.5
for the length of one pull request, and a note here said the gap to Seal Twist Ret
was "28.5 outside both intervals -- the first time the top of the table has been a
measurable difference". That was true of the formula in the tree at the time, the
owner then corrected the formula, and Cat went back to 703.8. **A note declaring
that an ambiguity has finally been resolved is the one most worth dating**, and it
survived exactly one commit.

**EVERY FIGURE HERE IS RE-MEASURED IN ONE RUN RATHER THAN ADJUSTED, and that has
now earned its keep twice in two days.** Once on a clean rebase of two branches
that had each moved this table and each written a figure the other invalidated --
git had nothing to complain about, because they touched different entries in the
same file. And once on the flat-damage revert, where **the three profiles that
moved back are exactly the three that had moved**, to the decimal in both
directions: Cat 703.8, Rupture 455.0, and Venom up rather than down because its
Mutilate is the one fraction below 1.

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
| [warlock.md](docs/handoff/warlock.md) | SM/DS, Firelock | **19** |

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
| **9 `PLACEHOLDER_*` constants** | each a real number nobody has supplied. **COUNT THE DECLARATIONS, DO NOT ADJUST THE NUMBER**: `grep -rhoE "(export )?const PLACEHOLDER_[A-Z_]+" src/ \| grep -oE "PLACEHOLDER_[A-Z_]+" \| sort -u \| wc -l`. **THE COMMAND THAT USED TO BE HERE COUNTED MENTIONS AND OVER-COUNTED BY FIVE** -- a deleted placeholder leaves its NAME behind in the comment explaining what it used to be, and Combustion's duration, Maelstrom Weapon's chance, the pet's base DPS, the pet's swing and the old coefficient cast cap are all epitaphs rather than placeholders now. That is why this figure has been wrong three times: the instruction was right and its command was not. Sniper Shot's invented 200-mana cost is gone, but it was never one of these -- it was a bare literal with a false caveat, which is worse, because an invented number that is not named cannot be audited |
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

**AND THE HUNTER HAS NO UNRATIFIED READING LEFT.** Improved Tracking was the
last one: "while tracking <seven creature types>, all damage you deal to the
tracked creature type is increased" has always been applied as a flat bonus,
with an `unmodelled` entry saying so -- the flat reading ASSUMED the Hunter was
tracking what it was fighting. The owner ratified it on 2026-10-07 ("improved
tracking is correct, applied as a flat 5% damage bonus"), so the assumption is
a ruling and the caveat is gone. **No profile moves by a decimal**;
`conditionalDamage` has applied the rank's percentage since the talent was
written. What moves is the census, because **a caveat is the whole difference
between PARTLY and FULLY** -- Hunter 28 fully to 29, partly 5 to 4.

| Class | Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- | --- |
| Warrior | 53 | 43 | 4 | 6 | **0** |
| Paladin | 52 | 33 | 7 | 11 | **1** |
| Druid | 51 | 29 | 6 | 14 | **2** |
| Rogue | 53 | 32 | 6 | 12 | **3** |
| Shaman | 50 | 22 | 4 | 18 | **6** |
| Hunter | 50 | 29 | 4 | 9 | **8** |
| Mage | 54 | 30 | 2 | 12 | **10** |
| Priest | 53 | 20 | 2 | 19 | **12** |
| Warlock | 52 | 25 | 3 | 5 | **19** |
| **Total** | **468** | **263** | **38** | **106** | **61** |

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

**300 of 468 talents do something**, 106 never will, and **62 are the actual
remaining work** — not the raw count of unmodelled reasons. The 129 scoped
entries break down as 37 crowd control, 36 healing, 21 positioning, 13 threat,
7 cast pushback, 6 stealth, 4 totem entities, **3 immunity and 2 dispel**.

**THE TWO NEWEST MEMBERS ARE THE OWNER'S, 2026-10-07**, and they came out of one
question. `guardian_s_favor`'s reason ended "whether an immunity that disarms you
belongs in scope is a question for the ruleset owner rather than a gap in the
engine" — and asking returned both rulings at once: **a dispel is out of scope,
and so is an immunity that also stops you attacking.** A reason that names the
question it is waiting on is what makes it askable; that sentence is the only
reason this was raised rather than sitting in the queue.

**AND THE IMMUNITY RULING IS THE FIRST THAT A CLASSIC READING WOULD HAVE APPLIED
TOO WIDELY.** Classic's Divine Shield stops you acting; **Forever's reduces all
damage you deal by 50% and lets you keep swinging**, so it is a real tank
cooldown and stays a live gap. Sweeping it in would have deleted a usable
ability and called the deletion a decision. The same check moved Ice Block the
other way: Forever's text says "you cannot attack, move, or cast spells", so it
IS covered and the Mage drops a gap it was never going to reach.

**THE TABLE ABOVE WAS ALSO STALE BY MORE THAN THIS CHANGE.** It read Rogue
31/5/14 and Mage 30/2/11 against a derived 32/6/12 and 30/2/12, on code nobody
touched for this PR — the same drift the Arcane row had. Every figure here is
printed by `npx vite-node tools/census.ts` rather than adjusted.

**EVERY FIGURE IN THIS SECTION IS RE-SUMMED FROM THE TABLE ABOVE RATHER THAN
ADJUSTED, AND THIS MERGE IS WHY.** The Warlock dive and the Warrior dive each
moved the total from the same base and each wrote its own answer; both also wrote
this warning, independently, which is how close the trap is to the surface. Two
branches moving a count by one from the same base both write the same number, git
merges them without a conflict, and the total is short by one.
`tools/class_audit.ts` prints one class and `tools/census.ts` prints all nine,
and **they share one classifier now** — `game/talents/talentCensus.ts`. They did
not: census.ts carried its own copy of the four-way rule which left out
`appliedElsewhere`, so the moment a clause of a working Rogue poison talent was
scoped the two tools disagreed about that talent and the published figure would
have been whichever was run last. Both throw if the buckets do not account for
every talent. **Run one rather than trusting this.**

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
| ~~`PLACEHOLDER_PET_BASE_DPS`~~ | — | **DELETED 2026-10-01.** The owner supplied the whole pet model — 36.34–55.32 a swing at 2.0 seconds, from 136 strength and 100 agility, with attack power and crit formulas — so there is nothing left for a placeholder to hold. Worth **−193.0** to BM Hunter |
| ~~`PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE`~~ | ~~20~~ | **DELETED 2026-09-30.** The owner gave **5 PPM**, which changed the SHAPE as well as the number. This row survived as an epitaph after the constant went, which is the over-counting the note above describes |
| `PLACEHOLDER_SOUL_SHARDS` | 10 | what a Warlock banks before a pull. No in-fight income |
| ~~`PLACEHOLDER_COMBUSTION_DURATION_MS`~~ | ~~30s~~ | **DELETED, and this row was still reading as LIVE.** `auras/mage.ts` names it as deleted in its own comment. It is the over-counting the note above this table describes, caught by counting DECLARATIONS against the table rather than reading either alone |
| ~~`PLACEHOLDER_WINDFURY_WEAPON_DURATION_MS`~~ | ~~1.5s~~ | **DELETED 2026-10-07, and not by being answered.** It held the imbue's attack power WINDOW, borrowed from Windfury Totem. The owner's ruling is that the imbue has no window at all -- the attack power is "added into the hits themselves" -- so there is nothing left for a placeholder to hold. **A placeholder can be retired by the QUESTION going away rather than by the number arriving**, and the borrow is what made that visible: an unnamed 1.5 would have survived the rework. The claimed SoD trinket tooltip reading 2s does not exist anywhere in this repository and the claim is withdrawn |
| ~~`PLACEHOLDER_WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS`~~ | ~~1.5s~~ | **DELETED 2026-09-30.** The owner gave **3 seconds for the imbue**; the totem's 1.5 is still right for the totem |
| `PLACEHOLDER_FLURRY_DURATION_MS` / `_REVENGE_WINDOW_MS` | 12s / 5s | Warrior-era; charges end Flurry in practice. **`_BERSERKER_RAGE_DURATION_MS` is gone**: all three sources say "Lasts 10 sec", and the placeholder's reason was a claim about the owner's spreadsheet being silent — true of the spreadsheet and irrelevant to the data |
| ~~`PLACEHOLDER_PET_SWING_SECONDS`~~ | — | **DELETED 2026-10-01.** "Base Swing Time = 2.0 seconds", stated, and it is the speed the `2 / 14` in the owner's damage formula is the coefficient for — so the two halves cannot disagree |
| `PLACEHOLDER_GORE_DRINKER_DURATION_MS` | 30s | **ADDED TO THIS TABLE, NOT TO THE CODE.** It has been declared in `auras/warriorTalents.ts` throughout and had no row, which is the opposite drift to Combustion's above and was found by the same count |
| `PLACEHOLDER_BOSS_*` | 5000 / 2s / 15% | the encounter, not a class. See [docs/incoming-damage.md](docs/incoming-damage.md) |
| `PLACEHOLDER_ONE_HAND` / `_TWO_HANDER` / `_RANGED` | — | only used when nothing is equipped; every preset equips |
| `PLACEHOLDER_PREFERRED_WEIGHT` | 1.00 | **THE ONE HERE THAT IS NOT A RULESET NUMBER.** The Gear panel's stat-sorting weight, which nothing in `engine`, `game` or `simulator` reads -- so a wrong value sorts a slot's list badly and cannot move a figure. The owner has said they will supply a valuation; until then every preferred stat is 1.00, which discards the ORDER their spreadsheet gives |

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
~~5. **One pet's base DPS, or one damage range, at 60.**~~ **ANSWERED IN FULL,
   2026-10-01**, and the answer was the whole model rather than the one number:
   base damage `random(36.34, 55.32)` a swing at 2.0 seconds, base stats of 136
   strength / 100 agility / −20 attack power, and the two formulas
   `AP = −20 + Str × 2 + 0.1 × max(melee, ranged)` and
   `crit = agility / 20 + owner's crit`. Claw and Bite are confirmed as built and
   **take no attack power at all**, which is a statement rather than an omission.

   **AND THE 1.375 WAS ALREADY THERE.** The owner's "Pet Global Damage Multiplier
   = 1.375x" is Petopia's 1.10 family modifier times the wiki's 1.25 for a fed
   pet — *"They're the same thing"* — so no constant was added. **The danger was
   implementing the stated figure a SECOND time**, which takes a Cat to 1.89 and
   reads as an ordinary pet; `petsAndHunter.test.ts` guards it with a scripted
   swing asserted against the owner's formula, and the guard was verified to fail
   by injecting one.

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

**TWO MORE ARE ANSWERED AND BOTH ANSWERS WERE "INTENDED", 2026-10-08.** Neither
was a missing number and neither was a defect; both were things this project had
measured, found surprising, and reported as questions.

- **Ice Lance's frozen case.** Whether the owner's `1.5/3.5/4` had already done
  the frozen division, given that a frozen cast then carries `* 4` back on top
  and lands on exactly the old unfrozen `1.5/3.5` -- two readings sixteen apart.
  **"This is intended stop asking."** The familiar 0.4286 on a frozen cast is the
  ruleset. Recorded at the constant, at the ability, and in `iceLance.test.ts`,
  all three of which had been carrying it as a chosen interpretation.
- **Evocation firing on no Mage profile.** Zero casts across three profiles and
  twenty seeds each, because no build drops to a tenth of its pool any more --
  reported with the 10% threshold offered as the thing to move. **"This is
  intended."** So a never-fired entry has a FIFTH cause: somebody meant it. The
  second time the owner's list has outranked a measurement of ours, after
  Hunter's Mark's -10.1, and the test asserts the zero as a fact about the
  ruleset rather than as an item outstanding.

Answered already, for reference: Seal of Command procs at **7 PPM**;
Vindication procs at **10%**; Seal of the Crusader's damage penalty is
**Classic's, exactly cancelling its haste**; Judgement of the Crusader's "up to
161" is **spell power rather than flat damage**; Retribution Aura stays
**undeclared**; Divine Favor is **in the Shockadin list**; seal damage is **not** a
weapon use; a hawk is modelled **without** a real combatant; pet family is a **profile field**; Shield
Slam triggers **main-hand** effects; Careful Aim contributes to attack power
**and** ranged attack power; resistances on an enemy target do not affect damage.

## What to do next

**TWO OPEN QUESTIONS FROM THE STAT-WEIGHT WORK, BOTH THE OWNER'S TO CALL.**

1. **The boss's damage ramp decides whether flat mitigation is worth anything.**
   `targetSwingDamage: 5000` and a 10% compounding ramp are invented numbers
   borrowed from Classic, and between them they make block worth about 1% of
   dodge for survival -- see the block entry above for the arithmetic. A
   shallower ramp or a block value that scales would both change that answer,
   and either is a ruleset decision rather than something to tune.
2. **`BatchTotals` cannot be merged, so the baseline batch cannot be split.**
   It is one accumulator for the whole run, so every breakdown on the results
   page comes off a single thread while the variants spread across every other
   core -- which makes it a large share of a tank-weight run's wall clock.
   Merging it is the obvious next performance step and was deliberately not
   taken: every number on the results page flows through that accumulator.

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
