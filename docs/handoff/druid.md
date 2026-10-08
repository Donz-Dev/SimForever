# DRUID DEEP DIVE

**Class:** Druid
**Profiles:** Moonkin, Cat, Bear
**State:** the deep dive is DONE. Twelve live gaps to **three**, and the three
that remain are two talents on one engine gap plus one engine gap of its own.

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## Client build 1.60.1.70170 — Tiger's Fury is gone and the Cat gained a talent

**CAT AND BEAR WERE RE-SPECIFIED and the owner supplied both URLs with the patch
notes.** Cat **770.0 → 794.0 (+24.0 REAL)**, Bear 490.5 → 496.1 (+5.7, noise),
Moonkin unchanged to the decimal.

| | |
| --- | --- |
| **removed** | Tiger's Fury (the ABILITY), King of the Jungle |
| **added** | Shifting Power, Improved Shifting Power |
| **renamed** | Primal Fury → **Blood Frenzy**; the talent id and the reaction ids followed the client, because the source name is what a reader sees on the resource panel |
| **moved** | Shredding Attacks up a row; Predatory Instincts across |

**SHIFTING POWER IS THE RESOURCE HALF OF KING OF THE JUNGLE, MOVED ONTO AN
ABILITY AND PAID FOR IN MANA.** "Instantly convert 55% of base Mana into 40
Energy" -- 530 mana, a sixteen second cooldown, eight with Improved Shifting
Power which the Cat build takes 2/2 of. **It is the first entry in the Cat list**
and unconditional, which is the owner's whole "as long as you have the mana":
`checkCast` refuses what the character cannot afford and the list walks past it.

**AND IT IS THE SECOND DRUID ABILITY THAT COSTS SOMETHING AND ROLLS NOTHING**,
which `omenOfClarity.test.ts` had asserted was only Demoralizing Roar. That test
caught it, which is what it was written for: without `requiresAttackTable` this
ability would take most of the Clearcasting charges the owner's instruction says
must all go on Shred -- and the aura would still report its uptime.

**SWIPE'S COEFFICIENT WENT 10% TO 3%** on a patch note that calls it a fix. The
sheet says 10 and the notes are later. It moves no figure: Swipe is in no list.

**THE BEAR'S CRIT NOW PAYS RAGE**, at 1.75x the flat per-swing award. Worth +5.7,
inside the interval -- a Bear is not short of rage.

---


## The one thing to understand first

**A DRUID'S FORM IS ITS COMBAT STYLE — A FIELD THE PRESET SETS — NOT AN AURA.**
The engine gates on Warrior stances and on nothing else, so **nothing stops a Cat
casting Starfire.** Three of the owner's list entries say "cat form if not active"
and are absent for that reason rather than being unimplemented.

**AND THE SECOND HALF OF THAT SENTENCE USED TO BE WRONG.** This document said
the same fact explained **five** of the twelve live gaps, as one engine gap
wearing five hats. It explains **two**. The difference is the question each
talent asks:

| Asks | Talents | Knowable before the pull? |
| --- | --- | --- |
| **which form is HELD** | `moonkin_form`, `predatory_strikes`, `heart_of_the_wild`'s clauses | **Yes** — it is a field on the character, as fixed as the weapon in its hand |
| **that a SHIFT happened** | `furor`, `natural_shapeshifter` | No. A form cannot change mid-fight |

`BuildRequirement.styles` is that distinction made into data, and it took three
talents off the queue without modelling anything about shapeshifting. **When a
family of talents is written up as one gap, check they are all asking the same
question** — the count was wrong for as long as nobody did.

---

## The profiles

| Profile | Talents | DPS | List | Style |
| --- | --- | --- | --- | --- |
| Cat | 9/35/7 | **663.3** | `DRUID_CAT` | cat (paws) |
| Bear | 9/42/0 | **433.6** | `DRUID_BEAR` | bear (paws) |
| Moonkin | 38/0/13 | **513.4** | `DRUID_MOONKIN` | caster |

**THESE ARE CURRENT AND THE TABLE USED TO CARRY A "was" COLUMN**, which is gone
because it had stopped being about this class: the figures moved 656.1 → 716.4,
444.7 → 488.5 and 398.0 → 494.0 mostly on work done elsewhere — caster gear, the
Staff of Dominance, Sunder Armor — and a before-and-after column that mixes six
causes tells nobody anything. HANDOVER.md's baseline table is the live figure;
reprint it rather than trusting this one.

**CAT WAS THE HIGHEST PROFILE IN THE PROJECT AND IS SIXTH NOW**, at 663.3 against
Seal Twist Ret's 748.3 -- the paw base and Rip's coefficient took 274.4 off it
between them, both the owner's own figures. It got
there from ninth. That is a claim worth distrusting, so it is attributed rather
than asserted — `npx vite-node tools/druid_attribution.ts` reprints the table
below. **MEASURED AT THE 656.1 BASELINE**, so read it as a RELATIVE attribution
of where the deep dive's gain came from and not as a set of current figures.

| | Cat | Bear | Moonkin |
| --- | --- | --- | --- |
| `king_of_the_jungle` | **+104.5** | — | — |
| `predatory_strikes` | +62.9 † | +24.5 † | — |
| the Glaive's form clause | +32.3 | +23.7 | — |
| `genesis` | +29.5 † | +23.1 † | +2.2 noise |
| `rend_and_tear` | +16.6 | +12.5 | — |
| `natural_reaction` | — | +14.8 | — |
| `nature_s_splendor` | — | — | +14.8 |
| `heart_of_the_wild` | +12.9 noise | +0.0 noise | — |
| `moonkin_form` | — | — | +11.7 ‡ |

† **THE FIGURE INCLUDES A CASCADE.** Taking three points out of Feral Combat
puts a deeper talent under its tier gate, and `createPlayer` drops that one
SILENTLY — so `-predatory_strikes` also drops Rend and Tear and (on the Cat)
Berserk, and `-genesis` also drops Nature's Majesty and Nature's Reach. The
probe names every cascade beside its figure; **a figure without the cascade named
is a rumour**, and the first run of that probe produced two.

‡ **NOT A GAIN FROM THIS WORK.** The Moonkin's crit is +3% however it arrives —
from its own talent or from the raid buff — so removing the talent removes 3%
crit outright, and 11.7 is what 3% crit is worth to a Moonkin.

**KING OF THE JUNGLE IS THE BIGGEST SINGLE ITEM IN THE CLASS, and it is the
resource panel's kind of finding.** The Cat's whole fight budget is about **690
energy** — 588 regenerated plus the 100 it opens with — and two Tiger's Furies
at 60 each add **120 of it**. Shred goes 9.8 uses a fight to 12.4 and Rip 2.3 to
3.0. Nothing about per-use damage would have shown that; the energy row does.

**AND THE FERAL PROFILES ARE NO LONGER UNDERSTATED.** The Glaive of Obsidian
Fury's "+172 Attack Power in Cat, Bear, and Dire Bear forms only" is applied,
through `Item.styleStats` — a stat scoped to a combat style, read by
`statsForStyle`, which already knew which style it was resolving for. That was
the last known understatement in the project.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Moonkin | Starfire 52.7%, Moonfire 19.8%, Insect Swarm 13.9%, Wrath 13.6% |
| Cat | Main Hand 39.1%, Shred 28.1%, Rip 27.3%, Rake 5.5% |
| Bear | Main Hand 31.6%, Primal Bite 27.0%, Maul 25.9%, Lacerate 15.5% |

**Only four sources each — these are the narrowest damage tables in the project.**
That makes every one of them load-bearing: a coefficient error on Starfire moves
half the Moonkin's damage.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 51 | **30** | **5** | **14** | **2** |

Was 20 / 5 / 14 / **12** when this document was written. **Ten talents have moved
into `Fully` and the live-gap count has only fallen by ten of the twelve**, which
is the honest shape of it: two of the clearances never showed in that column at
all. Nature's Reach was counted as RULED OUT because a `scope` swallowed its hit
clause, and Nature's Focus left the column when the owner ruled spell pushback
out rather than when anything was built.

### The 2 live gaps

| Talent | Why, and what would clear it |
| --- | --- |
| `furor` | pays out ON SHAPESHIFTING, and a form is fixed at creation like a stance |
| `natural_shapeshifter` | the same sentence, deliberately: both are findable by that wording the day mid-fight shifting lands, and `druidTalents.test.ts` fails if a third talent joins them or either one stops saying it |

**AND `nature_s_focus` IS NO LONGER ONE.** It was listed here as an engine gap --
spell pushback, which nothing in this engine models -- and the owner **ruled it
out of scope on 2026-09-30**, adding `castPushback` to the `OutOfScope` union. It
is a decision now rather than work, which is what that union is for.

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `genesis` | its periodic HEALING half — `healing`, ruled out |
| `nature_s_reach` | its RANGE clause — `positioning`, ruled out. The hit applies |
| `nature_s_splendor` | its Rejuvenation and Regrowth clauses — `healing`, ruled out |
| `improved_starfire` | its 15% stun — `crowdControl`, ruled out |
| `feral_swiftness` | movement speed in Cat Form — `positioning`, ruled out. The dodge applies |
| `naturalist` | the Healing Touch cast time — `healing`, ruled out |

**ALL SIX ARE HEALING, CROWD CONTROL OR POSITIONING** -- every one of them is a
clause the owner has ruled out, on a talent whose other clauses work. **There is
no remaining content item in this class.** Moonkin Form was the last one, and its
reason named Omen of Clarity, which is now built.

**THIS TABLE SAID "ALL FIVE" WHILE LISTING FOUR, AND BOTH NUMBERS WERE WRONG.**
`nature_s_reach` had been partly modelled since its range clause was scoped and
was never added here, and `feral_swiftness` joined when its movement speed was
declared. **Re-count from `npx vite-node tools/class_audit.ts druid` rather than
adding a row and incrementing the word** -- a prose total drifts exactly the way
the census total does, and this one had drifted in both directions at once.

---

## Never-fired entries

**None.** All three Druid lists have every entry firing — reconfirmed with
`USES=1` after this work.

## In the book, in no list, never cast

Mostly correct cross-form noise — a Moonkin carries every feral ability and casts
none of them. **Three are worth knowing, and one of them was a real bug:**

- **`berserk` WAS IN EVERY DRUID'S BOOK AND IS A TALENT.** It sat in
  `DRUID_ABILITIES` as a base ability, so the Moonkin carried an ability it had
  spent no point on — its own audit line read "in book, never cast: ... berserk",
  which is exactly what that looks like. Its talent entry meanwhile claimed "the
  engine reaches none" of its clauses while the ability had `suppressesCooldownOf`
  and +100 crit on every combo point generator, two aura fields written for it.
  **WHAT MISLED IT is worth knowing for the next class:** the capture gives
  Berserk "Learned at level 40", and gives Insect Swarm, Swiftmend, Feral Charge,
  Moonkin Form and Nature's Swiftness the same line. **All five are talents.**
  The level line says where the client shows a spell, not how it is obtained.
- **`claw` can never fire at ANY energy.** Improved Shred takes Shred to 42 and
  Ferocity takes Claw to 42, so the two cost the SAME and the harder-hitting one
  is above it. **Read costs off `characterAtCombatStart`, not off the ability
  declaration.**
- **`ferocious_bite` and `swipe` are cast by no profile at all.** `DRUID_CAT` is
  five entries and its finisher is `rip`. **Still an open question for the
  owner** — see below.

---

## Traps specific to this class

- **A DRUID'S PAW IS BUILT FROM THE WEAPON BEING HELD**, and Druids are **exempt
  from normalisation** because a paw is already one shape:
  `BasePaw + weaponDPS × formSwing + AP × formSwing / 14`, times `rand(0.8, 1.2)`,
  with the form's swing 1.0 for a cat and 2.5 for a bear.
- **A stat stick feeds the paw through its DPS but NOT through its speed.** The
  other reading of the owner's formula — held weapon's speed as the multiplier —
  put Cat at 988.8 and Bear at 909.2 and made paw damage proportional to how SLOW
  the held weapon was. **It was rejected on measurement.** Do not re-derive it.
- **A STAT-STICK STYLE IS TWO SEPARATE QUESTIONS** — is the item kept, and does it
  swing — and one commit got one wrong in each direction. `createPlayer` merges
  equipped weapons OVER the style's own, so a Cat once swung a real sword instead
  of a paw, **which read as a working feature.**
- **THE CAT IS SEVERELY ENERGY-BOUND**, on about 690 energy for a whole fight.
  Anything that hands it energy is worth more than anything that hands it damage,
  which is why King of the Jungle is the largest talent in the class and why the
  owner's list gates Tiger's Fury on "energy <= 30".
- **The GCD is 1.0 for a Cat-Form Druid**, and it belongs to the class.
- **A bear's paws earn rage at the one-handed rate**, 3.46 × base speed.
- **THE BEAR IS THE ONE DRUID PROFILE THE TARGET SWINGS AT**, and a reason that
  blamed the encounter for Natural Reaction's rage proc was wrong for as long as
  it existed. `targetAttacks: true` is in that preset and its own comment names
  Natural Reaction. **Check a reason that blames the encounter against the
  encounter.**
- **NATURE'S GRACE ONCE COST THE MOONKIN 14.9 DPS BY DOING NOTHING BUT SPEEDING
  IT UP.** A refresh window CLIPS: refreshing at two seconds remaining throws
  away what is left, and the faster the character acts the sooner it reaches that
  entry. **The owner's lists say "if not active" instead**, so the cost is gone
  and the lesson is not. A haste buff that measures as a loss is this, not a bug.
- **REND AND TEAR REACHES A STRIKE AND NOT A TICK, and that is an
  interpretation.** "Damage done by your melee abilities on Bleeding targets"
  could include the ticks of Rip, Rake and Lacerate. It does not, for two
  reasons: a damage multiplier keyed on a table reads `attackTable` and never
  `critFrom` everywhere else in the pipeline, and a bleed's own ticks would
  otherwise be amplified BY THE BLEED BEING UP — Rip would raise Rip. **The
  looser reading measured the Cat a third higher**, which is how plausible it is.
- **NATURALIST WAS READING A NUMBER OF SECONDS AS A PERCENTAGE**, for the whole
  life of the talent. Its row is `[0.5, 5]` — "reduces the cast time of your
  Healing Touch spell by 0.5 sec AND increases all damage you deal by 5%" — and
  `conditionalDamage` had no `valueIndex`, so a rank-5 Moonkin carried **x1.005
  instead of x1.05**. Worth **+21.2 to the Moonkin and +12.6 to the Cat** when
  fixed, and it is the one talent in these trees that reaches the paw swings as
  well as the spells, because `damageMultiplier` is the only scope that does.
  **Nothing could have caught it**: half a percent is a plausible multiplier, the
  talent reported itself FULLY modelled so the census never questioned it, and
  the only check on its magnitude was a DPS figure measured with the bug in.
  `tests/game/talentValueIndex.test.ts` now records all eleven blanket
  multipliers in the project with what each one's index means.
- **AND THICK HIDE IS MODELLED WITH THE WRONG RULE, found by the same sweep.**
  Forever's is "{0} additional base Armor per LEVEL and another {1} base Armor
  for each point of DEFENSE SKILL beyond five times your level"; it is declared
  as `itemArmorPercent`, which is a percentage of ITEM armor and is exactly right
  for Toughness and expresses neither clause. At rank 3 the first clause alone is
  180 armor against the ~33 the Bear gets. **Not fixed here** — it needs a new
  effect kind, and it moves the Bear's rage the counter-intuitive way, since more
  armor means less damage taken means less rage.
- **FERAL SWIFTNESS READ A MOVEMENT SPEED AS A DODGE CHANCE, WHICH IS THE
  FOURTH VALUE-INDEX BUG IN THIS CLASS.** "Increases your movement speed while in
  Cat Form by {0}%, and increases your chance to Dodge by {1}%" -- `[30, 4]` at
  rank 2, no `valueIndex`, so **both feral presets carried +30 dodge instead of
  +4** for the life of the talent. The owner found it from the number alone.
  **ONLY THE BEAR COULD EVER HAVE SHOWN IT**: the Cat is never attacked, so its
  26 points of surplus avoidance were worth exactly nothing and its DPS does not
  move by a decimal here. The Bear's does, and UPWARDS -- 26 fewer points of
  avoidance is 52% more damage taken, 61% more deaths and 82 more rage, worth
  **+10.4 isolated**. It is not an improvement to the talent; it is the Bear
  paying the right price.
- **THICK HIDE HAD THE WRONG RULE RATHER THAN THE WRONG INDEX, AND THAT IS
  QUIETER.** It is "{0} additional base Armor per LEVEL and another {1} base
  Armor for each point of defense skill beyond five times your level", declared
  as `itemArmorPercent` -- which is `itemArmor x value / 100`, exactly right for
  Toughness ("your Armor value FROM ITEMS") and an expression of neither clause
  here. At rank 3 it paid 3% of 1793, about **54 armor against a correct 274**.
  **A WRONG RULE IGNORES BOTH INDICES EQUALLY**, so the index sweep that found
  the other four could not see it; what found it was reading the tooltip beside
  the declaration.
  It needed two UNITS rather than two rules: `statFromLevel` and `statFromStat`
  both read their value as a PERCENTAGE by default -- Predatory Strikes is "150%
  of your level" -- and now take `scale: 1` for a talent stating a MULTIPLE. The
  defense clause goes through the DERIVATION so it follows a buffed defense
  skill, and `defenseSkill` holds only the surplus above five per level, which is
  precisely what the clause asks for.
- **AND `statFromStat` READ MORE THAN IT SAID IT COULD.** It was documented and
  tested as primaries-only, because "the derivation is handed resolved
  primaries" -- and `StatBlock.computeEffective` hands it the whole FIRST PASS,
  every stat resolved from base and modifiers. The parameter is NAMED `primary`
  and typed `Readonly<Stats>`, so the name described its six callers. The real
  constraint is the termination argument: nothing the derivation PRODUCES may be
  read by it.
- **ARMOR DOES NOT REDUCE RAGE, AND THREE COMMENTS AND A TEST SAID IT DID.** The
  prediction was "220 more armor means less damage taken means less rage, so the
  Bear's DPS falls". Measured, rage went **751 to 750** -- rage from a blow comes
  off the PRE-ARMOR figure, which `resourceRules.ts` states in those words and
  CLAUDE.md repeats. Thick Hide is **−1.7 marginal and +2.5 isolated**, inside
  the interval both ways. Reprint the pair, with deaths and rage beside the DPS,
  with `python tools/thick_hide_attribution.py`. **A prediction in a comment is a
  measurement that has not happened.**
- **THE BASE PAW DAMAGE IS 1 FOR BOTH FORMS**, stated by the owner where it had
  been **assumed at 100 and 50** -- about a fifth of every paw swing. **Cat
  937.7 -> 843.0 (-10.1%) and Bear 523.1 -> 433.6 (-17.1%)**, with the Moonkin
  and the other 21 unmoved to the decimal. So the paw is the held weapon's dps
  and the Druid's attack power and essentially nothing else, and the form
  contributes a CADENCE rather than damage of its own.
  **THE TWO FORMS LOST DIFFERENT SHARES FROM THE SAME CUT**, because the term
  only reaches what goes through `weaponScaling`: the Bear is **85.9% paw** (Maul,
  autos, Primal Bite) and the Cat **54.6%** (autos, Shred), while Rip, Rake and
  Lacerate carry their own coefficients. `19.4% x 85.9%` predicts 16.7% against a
  measured 17.1%, and `20.0% x 54.6%` predicts 10.9% against 10.1%.
  **AND `weapons.ts` LISTED LACERATE AS A PAW ABILITY AND IT IS A PURE DoT**, so
  the obvious place to go for that estimate would have overstated the Bear's loss
  by its whole 14.1% Lacerate share. Read `weaponScaling`, not a prose list.
  **THE BEAR IS NOW THE SECOND-LOWEST PROFILE IN THE PROJECT** at 433.6, having
  been mid-table -- the owner's number, not a tuning decision.
- **RIP'S COEFFICIENT WAS PER TICK AND IS PER DURATION**, by the owner's
  statement: "4% attack power coefficient per combo point spent over its
  duration NOT each tick; each tick should be 4%/6". Rip has SIX ticks, so a
  five-point Rip was paying **120% of attack power instead of 20%**.
  **Cat 843.0 -> 663.3, -21.3%**, and the Bear and the Moonkin do not move --
  Rip is a Cat finisher and neither of the other two can reach it.
  **THE ARITHMETIC RECONCILES**: a five-point Rip went from `855 + 2150.4` to
  `855 + 358.4` at 1792 attack power, so it pays 40.4% of what it did, and
  `297.6 x (1 - 0.404)` predicts -177.4 against a measured -179.7. Rip is
  **17.9%** of the Cat now, down from 35.3%, and the top source is the
  auto-attack at 40.0%.
  **NOTHING IN THE SOURCE SAID PER TICK.** The sheet's notation key separates
  `N% per tick` from `N%*combo point spent` and Rip's row carries only the
  second, so the per-tick reading contradicted a table in the same document.
  The constant's NAME said it, which is how a reading becomes a fact.
  **THE TELL WAS THE TWO HALVES DISAGREEING**: the flat damage was always a
  duration total over the tick count while the coefficient was per tick. Both
  now divide by one named `RIP_TICK_COUNT`.
- **THE CAT'S LIST IS BACK IN QUESTION AND THAT IS NOT SETTLED HERE.** Rip pays
  40% of what it did, so "spend five points on Rip" is a weaker claim than when
  the list was written, and **Ferocious Bite is the alternative no Cat list
  uses** -- already an open question before this. Measure it; do not reason
  about it. The 663.3 above is the list as it stands.
- **THE CAT WAS 12.7% CLEAR OF THE NEXT PROFILE AND IS NOW 11.4% BELOW IT.** It
  read 937.7 three commits ago. Every step was a figure the owner stated, which
  is worth saying plainly: none of the 274.4 was a tuning decision. Four of the owner's own figures took it
  there in one commit, +142.4, and the marginal split is Rend and Tear's wider
  scope **+61.0**, Primal Fury's combo points **+45.1**, Rake's 5.5% tick
  **+43.7** and Clearcasting-on-Shred **+6.3**. Reprint with
  `python tools/cat_attribution.py`. **A balance observation rather than a bug** --
  every lever is stated data -- but the spread across the 24 is much wider than
  it was.
- **REND AND TEAR REACHES EVERY POINT OF MELEE DAMAGE, AND THE OWNER'S FIGURE IS
  WHY.** It shipped scoped to `melee-special` and non-periodic, which is the
  reading CLAUDE.md states for "melee ABILITIES" -- and at 89.3% bleed uptime the
  three readings measure **x1.0296**, **x1.0612** and **x1.0948**, against a
  reported symptom of 1.025 and expectation of 1.09. Both to the decimal.
  **SO RIP RAISES RIP**: a bleed's own ticks are amplified by the bleed being up,
  which is the self-reference the narrow reading was partly chosen to avoid.
  It is the one scope in the pipeline whose DAMAGE fold reads `critFrom`, and
  `damage.ts` says so where a reader of the general rule would trip over it.
- **PRIMAL FURY HAS TWO CLAUSES AND A CAT GETS THE SECOND ONE.** Its row holds
  THREE numbers -- `[100, 5, 100]` at rank 2 -- and a single `reaction` read index
  0 and granted rage, so the Cat had no Seal Fate and the talent reported itself
  FULLY MODELLED. It is two reactions now, gated `bear` and `cat`, worth about
  ten extra combo points a fight.
  **AND THE RAGE HALF WAS FIRING FOR THE CAT**, against a comment claiming it
  could not: "rage is the Bear's resource, and `grantResource` finds no pool on a
  Cat". Every Druid owns every pool in every form -- this file's own test asserts
  it -- so the Cat gained 100 rage a fight and wasted 62%. Harmless to damage,
  wrong on the resource panel.
- **RAKE'S TICK IS 5.5% OF ATTACK POWER AND ITS HIT IS STILL 1%.**
  `WoWSimWorksheet.xlsx` says 1% for both; the owner gave the tick directly, and
  a later statement outranks the sheet. **Only one of the two numbers moved**,
  which is why they are separate constants -- reading "Rake is 5.5%" and setting
  both would quietly inflate the direct damage.
- **EVERY CLEARCASTING PROC GOES ON SHRED**, by the owner's instruction, through a
  gated entry ABOVE the finisher -- which is what "regardless of existing Combo
  Points" requires, since at five points the list would otherwise reach Rip
  first. Worth **+6.3, inside the interval**: it is a correctness fix, not a
  damage lever, and the measurement that matters is that 2.10 of 2.10 procs land
  on Shred where about a third used to go to Rake and Rip.
- **OMEN OF CLARITY IS A PASSIVE, NOT A CAST, AND IT IS WHY `reactionsForClass`
  TAKES A STYLE.** Every Druid learns it at 20 and none spends a point on it, so
  it is registered by the class rather than by a talent -- the same reason
  Windfury Weapon lives there. The capture gives it a school and a level and
  **nothing else**: no cost, no cooldown, no cast time, no duration, so there is
  nothing to put in a priority list and nothing to keep up.
  **THE THREE NUMBERS ARE THE OWNER'S AND NONE IS IN THE TOOLTIP**: 4% per spell
  or attack, **doubled in Moonkin form**, with a ten second internal cooldown.
  The doubling is Moonkin Form's OWN clause, so that talent's last unmodelled
  reason has expired -- it said "there is no proc here for this to double", which
  was true when written and specific enough to find the day the proc landed.
  **CLEARCASTING LASTS UNTIL IT IS SPENT**, because no duration is stated.
  Classic's fifteen seconds is deliberately not borrowed: with a ten second
  internal cooldown the next offensive ability is almost always within a second
  or two, so the two readings are nearly indistinguishable and only one of them
  invents a number.
  **AND TWO THINGS MUST NOT SPEND IT.** Wrath, which the tooltip names, and
  Demoralizing Roar -- which the tooltip does not name, and which the owner's own
  definition of "offensive ability" excludes: processed through a combat table,
  and the Roar rolls nothing. It is the Druid's Battle Shout.
- **NATURE'S REACH IS 4% HIT AND WAS DOING NOTHING, AND A `scope` IS WHY.** Its
  tooltip is "increases the RANGE of your offensive Balance spells by 20% **and
  improves your chance to hit by 4%**", and it was declared as a single
  `positioning` entry reading "Range, and nothing here has a position" -- true of
  the first clause and silent about the second. **All three profiles take it at
  rank 2**, so all three were short 4% hit for the life of the talent.
  **A `scope` IS THE WORST PLACE FOR A CLAUSE TO GO MISSING**, because it is
  permanent by design: the talent was counted as RULED OUT rather than as a live
  gap, so the Druid's live-gap count was 2 before the fix and 2 after it, and the
  audit that exists to find unfinished work had nothing to say. Classic's
  Nature's Reach is range and nothing else, which is why the name and the first
  clause agreed with each other and with nothing else. **Read every clause before
  writing a scope, and never write one from the name.**
  Worth **+33.3 to the Cat, +22.8 to the Moonkin and +6.3 to the Bear**, and ONE
  `hitChance` entry covers all three: the spell branch of `attackChances` reads
  that stat directly and the melee branches read it through `missFromSkill`, so
  no per-table split was needed.
- **MOONKIN AURA AND LEADER OF THE PACK ARE ONE AURA, NOT TWO, and the id is
  the whole rule.** The owner: "these are all the same exclusive 3% global
  critical strike chance and do not stack." So `PARTY_CRIT_AURA` is one
  definition with one id, and both raid buff entries AND both Druid talents
  apply it — `AuraCollection.apply` refreshes a matching id instead of stacking.
  **It used to be two auras and it paid twice**: a Moonkin carrying its own
  `moonkin_form` aura in a raid with Leader of the Pack ticked read **+6% crit**,
  24.243% spell crit against 21.243%. The older ruling put exclusivity on the
  GUI, and `withRaidBuff` governs two RAID BUFF entries and knows nothing about
  a TALENT. **A rule enforced at a chooser does not cover a source the chooser
  does not own.**
- **THE MOONKIN PRESET SELECTS MOONKIN AURA**, on the owner's instruction, where
  every other profile takes Leader of the Pack — a SUBSTITUTION rather than the
  removal it used to be, because the raid is not short a buff, it has the other
  one. Worth nothing either way, which is the containment check.
- **Mangle was RENAMED to Primal Bite** between client builds. It is 27.0% of the
  Bear's damage under the new name. Build drift is found only by refreshing
  captures, never by cross-checking.

---

## What this deep dive built

Nine talents, and six of the declarations are reusable by other classes:

| Declaration | For | Who else wants it |
| --- | --- | --- |
| `BuildRequirement.styles` | a talent conditional on the FORM held | any class with a style-conditional talent |
| `statFromLevel` | attack power as a percentage of level | nothing yet; Predatory Strikes is the only caller |
| `periodicDamage` + `Combatant.periodicDamageMultiplier` | "periodic damage only" — the fourth modifier axis | the Warlock's Pandemic family |
| `bleedingTargetDamage` + `AuraDefinition.isBleed` + `Combatant.bleedingTargetModifiers` | a multiplier conditional on the TARGET's state | **the Rogue's Mutilate**, "+20% against Poisoned targets", which HANDOVER.md lists as an open item |
| `abilityCost.valueIndex` | one talent cutting two abilities by two amounts | any two-clause cost talent |
| `Item.styleStats` | an item stat conditional on the combat style | the Glaive is the only line in the data that says it |

Plus `Nature's Swiftness`, built as the second caller of the one-shot cast-time
rule Eclipse asked for — **and taken by no Druid profile**, so it is tested on
its mechanism and is worth nothing to the three builds. **The Shaman's talent of
the same name is the third caller and is still `unmodelled`.**

## Open questions for the owner

1. **`ferocious_bite` and `swipe` are cast by no profile.** `DRUID_CAT` is five
   entries with `rip` as its only finisher. Was a Rip-only Cat intended, or
   should Ferocious Bite appear below it? Rip at five points is 855 over twelve
   seconds for 30 energy; Bite is 817 plus whatever the bar converts, for 35 and
   the whole bar. **On a build this energy-bound, emptying the bar is expensive**,
   so the list as given is defensible — it is the intent that is unconfirmed.
2. **Is spell pushback in scope at all?** `nature_s_focus` is the only live gap
   left that is not shapeshifting, and nothing in this engine lengthens a cast
   for being hit. If pushback is ruled out the Druid census reaches two live
   gaps, both of them the one shapeshifting item.
3. **Rend and Tear's ticks** — the interpretation above. Worth one sentence
   either way, because it is a third of the Cat's figure.
