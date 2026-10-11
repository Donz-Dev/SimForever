# Itemization: what an item costs to make

An item in WoW is not a free collection of numbers. It has a **budget**, set by
its item level, its quality and its slot, and every stat on it is bought out of
that budget at a price. This document records the model, what it reproduces,
what it does not, and — most importantly — **what it may and may not be used
for in this project**.

> **NOTHING IN `src/` READS ANY OF THIS, AND NOTHING SHOULD.** The model is a
> community RECONSTRUCTION of a system Blizzard never published, verified here
> against real items to about ±5%. It is a tool for UNDERSTANDING an item that
> already exists: why a +40 spell damage ring has nothing else on it, why a
> caster sword swings slowly, why a tank piece is mostly stamina. Running it
> backwards — using a budget to generate stats for an item the sources do not
> state — would be inventing game data with arithmetic in front of it, which is
> the one thing [CLAUDE.md](../CLAUDE.md) forbids outright. The item database is
> frozen and this does not unfreeze it.

```bash
npx vite-node tools/item_budget.ts              # the ten reference items, then all 151 on file
REFERENCE=1 npx vite-node tools/item_budget.ts  # the reference items, stat by stat
ITEM=226562 npx vite-node tools/item_budget.ts  # one item on file, stat by stat
```

## The model

From <https://wow.allakhazam.com/wiki/Itemization_Formulas_(wow)>, which is
itself sourced from WoWWiki and says so with "acknowledged uncertainty about
accuracy". Two equations:

```
budget      = qualityBase(itemLevel) x slotMultiplier
budget^1.5  = sum over stats of (value x statCost)^1.5
```

| Quality | Base budget from item level |
| --- | --- |
| Green (2) | `0.5 x ilvl - 2` |
| Blue (3) | `0.625 x ilvl - 1.15` |
| Epic (4) | `0.77 x ilvl - 1` |

| Slot | Multiplier |
| --- | --- |
| Head, chest, legs, **two-handed weapon** | 1.00 |
| Shoulders, gloves, feet, waist | 0.77 |
| Trinket | 0.70 |
| Wrists, neck, ring, cloak, shield, held-in-off-hand | 0.55 |
| **One-handed weapon** | 0.42 |
| **Ranged weapon** | 0.30 |

| Stat | Budget points per point |
| --- | --- |
| Strength, Agility, Intellect, Spirit | 1.00 |
| Stamina | 1.00 — **see below**, the source footnotes this one |
| Attack power | 0.50 |
| Ranged attack power | 0.40 |
| Spell damage and healing, school-blind | 0.86 |
| Spell damage, ONE school | 0.70 |
| Healing only | 0.45 |
| Mana per 5 | 2.50 |
| Armor **above the slot's baseline** | 0.10 |
| Block value | 0.65 |
| Resistance, one school | 1.00 |
| Resistance, all schools | 2.50 |

**THE 3/2 POWER IS THE WHOLE DESIGN AND IT IS NOT A CURIOSITY.** Because every
stat's cost is raised to 1.5 before being summed, concentrating a budget in one
stat costs more than spreading it. Ring of Spell Power's budget is 27.40 and it
buys **33 spell damage and literally nothing else**; Don Julio's Band has the
same-sized budget and buys four stats. That is not two design philosophies, it
is one equation: `(33 x 0.86)^1.5` on its own eats the lot.

It also means **you cannot read a budget off a sum of stats.** Two items with
identical stat totals can be an item level apart in either direction.

## What it reproduces

The ten items supplied as examples, priced by `tools/item_budget.ts`:

| Item | ilvl | Slot | Budget | Spent | Used |
| --- | --- | --- | --- | --- | --- |
| [Breastplate of Might](https://www.wowhead.com/classic/item=16865) | 66 | chest | 49.82 | 49.84 | **100.0%** |
| [Quick Strike Ring](https://www.wowhead.com/classic/item=18821) | 67 | finger | 27.82 | 27.69 | **99.5%** |
| [Don Julio's Band](https://www.wowhead.com/classic/item=19325) | 65 | finger | 26.98 | 26.74 | **99.1%** |
| [Arcanist Crown](https://www.wowhead.com/classic/item=16795) | 66 | head | 49.82 | 48.87 | **98.1%** |
| [Girdle of the Mentor](https://www.wowhead.com/classic/item=23219) | 85 | waist | 49.63 | 48.15 | **97.0%** |
| [Wristguards of True Flight](https://www.wowhead.com/classic/item=18812) | 71 | wrist | 29.52 | 28.12 | **95.3%** |
| [Ring of Spell Power](https://www.wowhead.com/classic/item=19147) | 66 | finger | 27.40 | 28.38 | **103.6%** |
| [Striker's Mark](https://www.wowhead.com/classic/item=17069) | 69 | ranged | 15.64 | 16.68 | 106.6% |
| [Zin'rokh, Destroyer of Worlds](https://www.wowhead.com/classic/item=19854) | 68 | two-hand | 51.36 | 44.54 | 86.7% |
| [Azuresong Mageblade](https://www.wowhead.com/classic/item=17103) | 71 | one-hand | 22.54 | 46.54 | **206.5%** |

Seven of the ten land between 95% and 107%. The three that do not are all
weapons, and the weapons section below explains all three.

**AND IT HOLDS ACROSS THE 151 ITEMS THIS PROJECT ALREADY HAS ON FILE**, which
is a much stronger test than ten hand-picked examples and was not something the
model was fitted to: **122 of the 133 non-weapon items land within 90% to 110%**
of their budget, mean 99.7%, median 98.7%. Those are mostly Season of Discovery
re-itemizations, so SoD is using the same budget as Classic even where it has
changed what an item carries — the Classic Arcanist Crown is 16 stamina /
27 intellect / 10 spirit / 20 spell power and the SoD one is 11 stamina /
18 intellect / 35 spell power, at the same item level, both within 3% of the
same budget.

## Base armor is free, and that is a proof rather than a pattern

An armor piece's armor is **not** bought out of its budget. The pattern says so
— every ilvl-66 plate chest on file carries 749 armor, every ilvl-66 cloth head
83 — but the arithmetic settles it:

> Breastplate of Might's 749 armor at the sourced cost of 0.1 is 74.9 points,
> and `74.9^1.5` is **648** against a whole chest budget of **352**. Base armor
> cannot be in the budget, because it does not fit in the budget.

So armor comes with the slot, the armor type and the item level, the way a
weapon's DPS does. **What is budgeted is armor ABOVE that baseline**, and five
Season of Discovery Cenarion pieces show it cleanly: the standard ilvl-66
leather shoulder is 150 armor and Cenarion Pauldrons carry 270, the extra 120
arriving beside "Increased Defense +7".

`tools/item_budget.ts` derives the baseline from the items on file rather than
carrying a transcribed table — the minimum armor in each
(slot, armor type, item level) group. A group with one member cannot be split,
so its item is reported as all-base **and flagged**, which is the honest answer
rather than a guess in either direction.

## Weapons: DPS is a line, not a budget line

The source does not price weapon DPS at all, and the reason it can get away
with that is that **DPS is not bought**. Fitting the real weapons gives three
straight lines so tight they are barely fits:

| Epic weapons | DPS | Fitted from | Worst residual |
| --- | --- | --- | --- |
| One-handed | `0.9645 x ilvl - 15.880` | 10 weapons, ilvl 66–77 | **0.31 dps** |
| Two-handed (axe, mace, sword, polearm) | `1.2686 x ilvl - 21.507` | 8 weapons, ilvl 65–81 | 0.61 dps |
| Ranged | `0.7475 x ilvl - 11.983` | 4 weapons, ilvl 69–77 | **0.02 dps** |

A weapon's DPS comes with its item level and its hand. **What is budgeted is
GIVING IT UP**, and that single fact explains every weapon row in the table
above:

- **Zin'rokh** is 0.15 dps off its line and spends 86.7% of its stat budget. A
  plain, slightly under-budget two-hander.
- **Striker's Mark** is 0.01 dps off its line and spends 106.6%. The same thing
  the other way.
- **Azuresong Mageblade** is **10.10 dps BELOW** the one-hand line, and the
  24.00 budget it is over by works out at **2.38 points per dps forgone**.
  [Lok'amir il Romathis](https://www.wowhead.com/classic/item=19361) is 20.35
  dps short and gives **2.72**.

So a caster one-hander is a physical one-hander that sold its damage for stats
at roughly 2.5 budget points per point of DPS. **TWO ITEMS IS NOT A
CALIBRATION**, so the tool prints the shortfall and the implied rate and does
*not* correct the budget by it — correcting it would hide the one number this
model does not have behind a figure that looks sourced.

**STAVES ARE NOT ON THE TWO-HAND LINE AND CANNOT BE CHECKED.** Every staff in
reach — Benediction, Anathema, Staff of Dominance — is a caster staff, so there
is no physical staff to establish the line they fall short of. Their shortfall
is measured against a line fitted from axes, maces, swords and a polearm, and
Benediction's implied rate comes out at 1.28 rather than ~2.5, which is most
likely the missing staff line rather than a different exchange rate. Indicative,
not a figure.

## Forever's own data: the Premier PvP cloth sets

Sixty-four items, transcribed from the ruleset owner's client into
`tools/foreverPremierPvp.ts` and priced by `FOREVER=1`. **The only real
Forever ARMOUR in the project** — `src/data/items/` is Classic and Season of
Discovery stand-ins, and the Immovable Object plus four spell-power overrides
were the whole of the Forever item data until this. All 64 are item level 65,
cloth, three classes, eight slots, across two rank tiers.

They are **not** in `src/data/items/`. That directory is loaded by `itemData.ts`
and everything in it is equippable; putting them there would add 64 items to the
Gear panel. **The item database stays frozen.**

### Base armour is confirmed free, on Forever's own data

Classic's [General's Silk Cuffs](https://www.wowhead.com/classic/item=16538) is
item level 65 cloth wrist at **44 armour**, and
[General's Silk Sash](https://www.wowhead.com/classic/item=16537) is item level
65 cloth waist at **56 armour**. Forever's item-level-65 cloth wrist is **44**
and its waist is **56** — identical. Forever did not re-derive the base armour
curve, so the "base armour comes with the slot" reading now rests on the
ruleset's own data rather than on an inference from Classic.

**And Forever writes the split out itself.** Four pieces list `+40 Armor` among
the *stats*, separately from the slot's own armour on the line above — the
Dreadweave Coronal is "81 Armor" and then "+34 Stamina, +20 Intellect,
+40 Armor". That is exactly the base/bonus distinction the budget model needed
and that Classic's tooltips never state.

### Two ruleset changes the budget makes visible

- **Forever uses RATINGS where Classic uses flat percentages.** These items
  grant "+7 Critical Strike Rating" and "+14 Critical Strike Rating"; Classic's
  own rank-13/14 cloth grants a flat "+1% spell crit". The source's blanket
  "any rating costs 1" is dead weight in Classic and finally has something to
  price here — it is the one sourced cost that no Classic item could test.
- **Healing and spell damage are two lines, not one.** Classic writes
  "+N damage and healing"; Forever writes "+33 Healing" and "+11 Spell Damage"
  separately, and the ratio is **3.0 across all five pairs** that occur
  (22/7, 26/9, 33/11, 40/13, 18/6).
- **Forever dropped Classic's PvP bonus armour.** Classic's Field Marshal's
  Coronet carries 162 armour at item level 74 against a cloth-head baseline
  near 99; Forever's Premier pieces carry the baseline and nothing else, except
  where they say `+40 Armor` outright.

### They are internally consistent and 15% under Classic's epic budget

| | |
| --- | --- |
| mean | **85.1%** of the Classic epic budget for item level 65 |
| spread | **sd 3.2 points**, range 81.9% to 92.9% |
| by slot | 83.3% to 88.5% — every slot together |

**THE TIGHTNESS IS THE FINDING, NOT THE 85%.** A 3.2-point standard deviation
across 64 items is *tighter* than the Classic and Season of Discovery items on
file, which scatter over 90–110%. Forever's itemization is more internally
consistent than the game it is based on, and the Classic cost table reproduces
the *shape* of a Forever item well. What differs is the LEVEL.

**And it is the budget that differs, not a stat cost.** Those are two readings
that look alike and the data separates them:

| Reading | Residual sd | Verdict |
| --- | --- | --- |
| Classic costs, budget scaled to `0.6575 x ilvl - 1` | **3.8 points** | best fit; every slot moves together, which is what a scaled budget does |
| Classic epic budget, spell-power family dearer by x1.61 | 5.8 points | **worse**, and it leaves a +0.80 correlation between a piece's spell-power share and how far off budget it lands |

So the spell-power costs are right and the budget level is not. **A correlation
between the residual and the item's COMPOSITION is what tells a wrong stat cost
from a wrong budget**, and it is worth stating because the first cut of this
analysis computed that correlation over a share that excluded healing, got −0.60,
and read it as evidence for the dearer spell power — the exact opposite of what
the full share says. A correlation whose sign depends on how the denominator is
defined is not evidence of anything.

**WHETHER 85% IS A FOREVER BUDGET OR A PvP DISCOUNT IS OPEN, AND IT IS A
QUESTION FOR THE OWNER.** Classic's own item-level-65 PvP cloth is *also* under
budget on the same costs — General's Silk Cuffs prices at **96.0%** and
General's Silk Sash at **90.6%** — so PvP gear being under-budget is not a
Forever invention, and Forever's is simply further under. Two Classic items is
not enough to say how much of the 15 points is "PvP" and how much is "Forever",
and nothing here picks one.

### The sets are built from 30 stat templates

Thirty distinct (slot, stats) blocks across 64 items, with **62 of them
appearing in both rank tiers** — Centurion's Felweave Boots and
Knight-Champion's Dreadweave Boots are the same item under two rank names. That
is a fact about how the sets were built and it doubles as a transcription check,
which is what it is printed for.

**IT LEAVES EXACTLY TWO ITEMS WITHOUT A TWIN, AND THEY ARE THE SAME ITEM.**
Field Marshal's Silk Coronet and Warlord's Magus Cowl are identical except for
**34 stamina against 37**, where every other head piece in all six sets is 34.
Transcribed as read and flagged on the row rather than corrected — but a 7 read
off a 4 is the likelier of the two explanations, and it is worth the owner
confirming against the client.

## Forever's 41 new epic weapons, and the answer to the PvP question

`WEAPONS=1`, from `tools/data/forever-epic-weapons.json` — the whole of the new
epic weapons in Forever beta build **1.60.1.70338**, captured 2026-10-10. Five
of the 41 are **not** PvP items, which is what makes the question answerable.

### How it was captured, because the recorded method no longer applies

CLAUDE.md said of `foreverchanges.pro` that "its data is in the page's RSC
flight script, not the DOM". That is no longer true: the items page fetches
plain JSON — `/items/new.json`, `/items/changed.json`, `/items/same.json`,
`/items/missing.json` and `/items/sources.json` — each carrying the beta build
it was taken at. **A plain `curl` is refused with a 403**, so it is read in a
browser on the origin, hashed there and re-hashed on disk, which is this
project's rule for anything out of a browser. 13,464 bytes, SHA-256
`0345f048…`, matching.

### Weapon DPS is a line — demonstrated, not fitted

The earlier finding was a fit over Classic weapons. Forever shows it directly:
at one item level, a hand's DPS **does not move with speed**.

| Hand | Speeds observed | DPS | Classic-fitted line predicts | Off by |
| --- | --- | --- | --- | --- |
| One-hand | 1.80, 2.00, 2.30, 2.40, 2.90 | 47.2–47.4 | 46.81 | **0.39** |
| Two-hand | 3.30, 3.80 | 61.5–61.6 | 60.95 | 0.65 |
| Ranged | 1.80, 2.50, 2.90 | 36.8–36.9 | 36.60 | **0.30** |

A one-hander's speed varies by 61% across that row and its DPS does not move.
And the lines fitted from **Classic** weapons over item levels 65–81, which had
never seen a Forever item, predict all three within **0.65 DPS**. Forever did
not re-derive the weapon DPS curve any more than it re-derived base armour.

### The answer, superseded below

**WHAT THIS SECTION CONCLUDED WAS WRONG AND IS KEPT FOR THE SHAPE OF THE
MISTAKE.** It read the two-hand rows -- a PvP axe at 86.5% and a non-PvP axe at
85.5% -- and concluded the shortfall was Forever's budget rather than a PvP
discount. Those two figures are correct. The conclusion is not: see
**[The answer, on 289 armour pieces](#the-answer-on-289-armour-pieces)**.

| Item | Slot | PvP | Used |
| --- | --- | --- | --- |
| Premier High Warlord's Battle Axe | two-hand | yes | **86.5%** |
| Forest Defender's Axe | two-hand | no | **85.5%** |
| Premier High Warlord's Destroyer | two-hand | yes | 98.9% |
| Premier High Warlord's Blade | one-hand | yes | 101.4% |
| Ironwood Blade | one-hand | no | 87.9% |
| Greenhammer | one-hand | no | 87.9% |
| Premier High Warlord's Recurve | ranged | yes | 117.7% |
| Hyper Deluxe Sniper Rifle Mk XVII | ranged | no | 94.0% |

**READ THE TWO-HAND ROWS AND IGNORE THE REST.** The two-hand multiplier is 1.00
— no multiplier at all — and is the only one in the source not open to doubt.
There, a PvP axe and a non-PvP axe price at **86.5% and 85.5%**, which is each
other and is also the Premier cloth's **85.1%**.

So the ~15% shortfall is **Forever's budget, not a PvP discount.** Every
non-PvP epic weapon here is under budget too (85.5%, 87.9%, 87.9%, 94.0%), and
if anything the PvP weapons are the *richer* ones.

**THE ONE-HAND AND RANGED ROWS LOOK LIKE A PvP PREMIUM AND ARE MOSTLY THE 3/2
POWER.** High Warlord's Blade and Ironwood Blade carry nearly the same raw
budget points — **27.34 against 26.04** — and price 13 points apart, because
the Blade concentrates its spend into two large chunks (24 attack power,
14 crit rating) where the Ironwood spreads it over three small ones. Spread
across three equal chunks the Blade's own points would price at 92.3% instead
of 101.4%. That is the exponent doing exactly what it is for, on top of the two
shakiest multipliers in the source.

### What a Forever caster weapon gave up

All six caster and healer weapons give up **15.6 to 15.9 DPS** against the
physical weapon of the same hand at the same item level — a tight figure, and
the first time the trade has been measurable inside a single ruleset at a
single item level rather than across a fitted line.

On the two-hand slot that works out at **2.97 budget points per DPS forgone**,
which corroborates the 2.33–2.72 estimated from Classic's Azuresong Mageblade
and Lok'amir il Romathis. The one-hand figures (4.22 and 5.69) rest on the 0.42
multiplier and on healing at 0.45, and are not worth leaning on.

### Forever grants ratings, and the budget source was ready for them

Fourteen stat names appear across these 41 weapons and **every one has a cost
in the source** — the first capture in this project where nothing falls through.
Three of them Classic could never have tested: **Critical Strike Rating**,
**Hit Rating** and **Spell Penetration** (the source's "Magic Penetration").
The blanket "any rating costs 1" was dead weight in a ruleset with no ratings.

**THIS IS A QUESTION FOR THE ENGINE, NOT JUST FOR THE BUDGET.** `STAT_NAMES`
carries `hitChance` and `critChance` as flat percentage POINTS, with
`critRating` and `hasteRating` present but barely used, and Forever is granting
hit and crit as RATINGS on real items. The conversion is the ruleset owner's to
state.

### The captures on file are two builds stale

This capture is build **1.60.1.70338**; the project's talent and spell captures
are at **1.60.1.70170**. CLAUDE.md's own rule is that a capture goes stale and
a correct number becomes a wrong one with nobody touching it. Not acted on here
— it is a separate job from itemization — but it is now a dated fact rather
than a suspicion.

## The answer, on 289 armour pieces — superseded

**ALSO WRONG, AND FOR A DEEPER REASON THAN THE FIRST ONE.** This section's
figures are right and its conclusion is not: it compared Forever's items
against **100%**, and 100% is not a number this model reaches even on Classic
gear. See **[The answer, with a control group](#the-answer-with-a-control-group)**.

## The answer, on 289 armour pieces (figures kept)

The 41 weapons were the wrong population to settle it on. The 449-item capture
has **289 armour pieces at item level 65**, and they split cleanly:

| Armour, item level 65 | n | Mean | Median | sd |
| --- | --- | --- | --- | --- |
| PvP (`Premier ...`) | **248** | **84.6%** | 83.6% | 5.6 |
| not PvP | **41** | **89.2%** | 92.1% | 9.5 |

**It is both.** Forever's epics run about 11 points under Classic's epic budget
generally, and PvP gear is a further 5 points under that. The owner's hunch
that it "could be a PvP-specific issue" is half right, and the half that is not
is the larger half.

**THE EARLIER ANSWER CAME FROM TWO ITEMS AND WAS CONFIDENT.** A PvP axe at
86.5% and a non-PvP axe at 85.5% agree to within a point — and they are one
sample from each of two populations whose spreads are 5.6 and 9.5, so agreeing
to a point is what they would often do even if the means were five points
apart. Both figures were right; the conclusion was not. **Report n and the
spread beside any figure that is going to carry an argument.**

**THE SLOT BREAKDOWN LOOKS LIKE IT CONTRADICTS THIS AND DOES NOT.** Chest shows
a −16.3 gap and Shield a +21.3 — on non-PvP samples of **one item each**. The
only two slots with a non-PvP sample worth reading are Hands (n=10, +6.9) and
Shoulder (n=15, +9.1), and both point the same way as the total.

**AND THE NON-PvP ITEMS SCATTER TWICE AS WIDELY**, 67.6% to 121.4% against the
PvP sets' tight band. That is what individually designed items look like beside
ones stamped from a handful of templates — the PvP sets are 30 pieces a slot
built from 30 stat blocks.

## The answer, with a control group — and then the parameter underneath it

**READ THE STAMINA SECTION BELOW BEFORE USING ANY FIGURE IN THIS ONE.** The
control group was the right idea and it is still the right idea; what it could
not do is separate a PvP discount from an error in ONE cost, because the PvP
sets spend 40.8% of their budget on stamina and everything else spends 14%.

## The answer, with a control group (figures at stamina 0.67)

The third attempt, and the first with a baseline that is not an assumption.

`forever-changed-epics.json` holds the 653 Classic epics Forever altered — and
**487 of them differ only in WORDING**. Classic's "Improves your chance to get
a critical strike by 1%" is Forever's "+14 Critical Strike Rating": same stat,
same value, different prose. Their stats *are* Classic's, so pricing them
measures **Classic's own itemization through the same model**, on the same
slots, at the same item levels, with the same blind spots.

Clean armour — nothing the budget cannot price — at item level 65:

| | n | mean | sd |
| --- | --- | --- | --- |
| **Classic's own epics** | 24 | **93.2%** | 9.4 |
| **Forever new, not PvP** | 41 | **93.3%** | 11.2 |
| Forever new, PvP | 66 | **87.0%** | 7.8 |

**Classic and Forever's non-PvP gear agree to a tenth of a point.** There is no
general Forever budget reduction. The ~7 points below 100% are the **model's**
residual, and the only real effect in the data is a **PvP discount of about 6
points** — which is what the ruleset owner suspected from the start.

**"COMPARED AGAINST WHAT" WAS THE WHOLE QUESTION AND IT WENT UNASKED THROUGH
TWO ROUNDS.** The figures were never wrong; treating a reconstruction's 100% as
ground truth was. **A model needs a control before it needs more data**, and
the control was one capture away the entire time.

### Two things that make any such comparison meaningless if ignored

- **An item with a proc reads low, and that is the model.** A proc, an on-use
  or a set bonus costs budget nothing here can price. Classic epics *with* one
  price at **90.0%** against **95.4%** for those without, and Classic gear is
  full of them — so an unfiltered comparison measures how many procs each
  population has. `isClean` is that filter.
- **The populations have very different spreads.** sd 7.8 for the PvP sets
  against 9.4–11.2 for everything else: 30 pieces a slot stamped from a handful
  of stat blocks, against individually designed items.

## Stamina, the footnote, and why three answers in a row were wrong

The source's table prices stamina at **0.67** and footnotes it:

> This value was changed with Burning Crusade, and was originally 1 as well.

**Everything in this project is pre-Burning Crusade**, so 0.67 is a later
expansion's number and **1.0 is the era-correct one**. That makes 1.0 the
sourced default here. It also breaks every conclusion drawn before it.

### It does not "fix" the shortfall — it overshoots

Clean armour, all item levels, mean budget used:

| stamina cost | 0.67 | 0.80 | **0.86** | 0.90 | 1.00 |
| --- | --- | --- | --- | --- | --- |
| **Classic's own epics** (control) | 96.1% | 98.7% | **99.9%** | 100.7% | 102.9% |
| Forever new, not PvP | 95.2% | 98.3% | 99.8% | 100.8% | 103.4% |
| Forever new, PvP | 89.0% | 96.1% | 99.4% | 101.7% | 107.5% |

1.0 takes the control past 100% to **102.9%**. The value that centres it is
**0.86** — between the table's figure and the footnote's.

### And it inverts the PvP finding, which is the serious part

**The Premier PvP sets spend 40.8% of their budget on stamina. Classic's own
epics spend 14.0%, and Forever's non-PvP gear 17.1%.** PvP gear is nearly three
times as stamina-heavy as anything it is being compared with, so the stamina
cost is precisely the lever that moves it relative to everything else:

| stamina cost | PvP | not PvP | gap |
| --- | --- | --- | --- |
| 0.67 | 89.0% | 95.2% | **−6.2** |
| **0.87** | — | — | **−0.1** |
| 1.00 | 107.5% | 103.4% | **+4.0** |

**The "PvP discount of about 6 points" was this parameter.** At the stamina
cost that centres the control it is −0.4, which is nothing.

**AND TWO INDEPENDENT CRITERIA LAND ON THE SAME PLACE**, which is the one
genuinely encouraging thing here: "Classic's own gear should price at 100%"
gives **0.86**, and "there is no reason for PvP gear to be discounted" gives
**0.87**. Those were not fitted together.

### What this means for every figure in this document

**0.86 IS FITTED AND IT ABSORBS EVERY OTHER RESIDUAL IN THE MODEL.** It is not
a claim about the real cost of stamina. If the fitted crit cost of 16, or the
hit cost of 10, or a slot multiplier is off, this is where that error would
show up — one free parameter will happily soak up the sum of all the others.
The honest reading is that the source's 0.67 and its footnote's 1.0 **bracket**
the truth and the data prefers the middle.

**SO NO CONCLUSION THAT RESTS ON LESS THAN ABOUT TEN POINTS OF BUDGET IS SAFE
HERE**, and three successive answers to one question rested on six:

| | answer | what was wrong |
| --- | --- | --- |
| 1 | "not PvP-specific, it's Forever's budget" | two items, one per population |
| 2 | "both: 11 points general, 5 PvP" | no baseline — 100% was assumed |
| 3 | "PvP only, about 6 points" | one uncertain parameter, and PvP gear is the part most exposed to it |

Each correction came from better data and each felt conclusive at the time.
**The thing that would have prevented all three is a sensitivity check** — vary
the least certain parameter and see whether the conclusion survives. That now
costs one command:

```bash
STAMINA=0.67 FOREVER=1 npx vite-node tools/item_budget.ts
```

## Forever's rewrites confirm the rating table independently

Where Forever replaced a Classic flat percentage with a rating, the ratio is
exact, with **no variation at all**:

| Line | Items | Rating per 1% |
| --- | --- | --- |
| Critical strike | 42 | **14.0** |
| Critical strike *with spells* | 20 | **14.0** |
| Hit | 18 | **10.0** |
| Dodge | 3 | **12.0** |

The owner's table arrived in one message; the client's own item data
reproduces it exactly. **And it settles something the budget doc had flagged as
assumed**: spell crit converts at the same 14, so **one Critical Strike Rating
feeds both tables**. Classic has two item lines and Forever has one.

## `critRating` was read by nothing, and Forever gear found it

A latent bug, pre-existing and invisible until real ratings arrived.

`critRating` was declared in `STAT_NAMES`, exported, documented, and priced by
the stat-weight catalogue. Both places that build a crit slice —
`game/combat/attackChances.ts` and the engine's `defaultAttackChances` — read
`stats.critChance` **off the block**, so `critChanceFrom`, the one function
that folds the rating in, **had no callers anywhere**. Two correct halves with
nothing joining them, exactly how `armorPenetration` once shipped unread.

**THE DIRECTION IS WHAT MADE IT FINDABLE.** Moving Don Julio's Band from
`critChance: 1` to `critRating: 14` dropped thirteen profiles by about 1% DPS
— and **all thirteen moved down**. The first explanation reached for was this
engine's documented float-truncation hazard, which predicts a *symmetric*
scatter. Thirteen negatives is not that.

**THE FIX HAD THREE SITES.** The engine fallback, the ruleset's own provider,
and `createPet`, which inherits the owner's crit and was reading the raw stat
too. Fixing the first two left **BM Hunter at −1.2 and every other affected
profile at 0.0** — a residual that names its own cause, BM being the one
profile with a pet. A join missing in one place is worth grepping for in all.

With all three fixed, 20 of 25 profiles reproduce to **0.0**, four move by
+0.1 to +0.6 (the truncation reordering, now genuinely the only cause left),
and **Enh Shaman moves −8.7 for a real reason**: Forever changed The
Unstoppable Force from 175–292 at 3.8s to 166–277 at 3.6s. Same DPS, faster
weapon.

## The items are in the project's database now

`src/data/items/forever-new-epics.json`, 449 items, imported by
`tools/import_forever_items.mjs` from a capture under `tools/data/` that
records its own SHA-256, the beta build and the filter. **This project no
longer reads anybody's website to know what a Forever item is.**

- **Nothing was silently dropped.** Two exclusions, both listed **by name** in
  the file the importer writes, because "nothing was lost" has to be checkable:
  the eight "Premier Emboldened &lt;slot&gt; Seal" upgrade tokens, which carry
  no armour, stats, effects or set bonuses; and **39 developer test items**
  named `90 Epic <class> <slot>` — a full epic set per class at item level 90
  in a ruleset capped at 60, removed on the owner's instruction. The importer
  refuses to write if any line in any item went unread.
- **The test items are matched on the NAME, not the item level.** Six real
  Naxxramas trinkets sit at item level 90 — Slayer's Crest, Mark of the
  Champion, Eye of the Dead, The Restrained Essence of Sapphiron, Glyph of
  Deflection — so an item-level rule would have taken those with them. Removing
  them moved nothing: **no preset references any of the 39 ids**, which is a
  cheaper and stronger argument than a fingerprint.
- **Adding them moved no published figure.** A preset names its items by id, so
  a new file changes what can be CHOSEN and not what the 25 builds wear. All 75
  combat-log hashes and event counts are unchanged.
- **The hand-transcribed modules are gone.** The Premier cloth and the weapons
  each had a module of their own while the items were outside the project;
  `tools/foreverItems.ts` reads the real file instead. A second copy of a
  number is a copy that drifts, and this one already had: 63 of the 64 cloth
  pieces matched the client exactly and one did not.

**THE MISMATCH WAS THE ONE THE PAIRING CHECK HAD FLAGGED, AND IT WAS FLAGGED
IN THE WRONG DIRECTION.** Two items out of 64 had no twin, differing only in
34 stamina against 37, and the note said a 7 misread off a 4 was the likelier
explanation. The client says **both are 37**: the error was reading 37 as 34 on
the other item. So the check found the right pair for the right reason and the
guess about which half was wrong was itself wrong — **a structural check earns
its keep by pointing at the pair, not by explaining it.**

## Forever's rating conversions

The owner's table, now in `RATING_PER_PERCENT` and no longer placeholders:

| | | | |
| --- | --- | --- | --- |
| 1 Rating | 1 Defense Skill | 12 Rating | +1% Dodge |
| 10 Rating | +1% Hit | 20 Rating | +1% Parry |
| 14 Rating | +1% Crit | 5 Rating | +1% Block Chance |
| 10 Rating | +1% Haste | 10 Rating | +1% Expertise |

**CHANGING CRIT FROM 180 TO 14 MOVED NOTHING**, which looks like it should have
moved everything. Nothing in the project grants `critRating` — every profile
defaults it to 0 — and every haste source uses the
`percent * RATING_PER_PERCENT.haste` idiom that `hasteMultiplierFrom` divides
straight back out, so the constant cancels. All 75 hashes unchanged.

**WHICH SIDE OF THE CONVERSION AN ITEM LINE LANDS ON IS DECIDED BY WHETHER
ANYTHING READS THE RATING.** `critRating` and `hasteRating` have readers, so
those two are stored as ratings and converted at the point of use, which keeps
them buffable. `dodgeRating`, `parryRating` and `blockRating` are declared and
read by nothing, and there is no hit, defense or expertise rating stat at all,
so those six are converted at the item parser into the flat stat the engine
does read. **The day a buff grants dodge rating, the fix is to give those three
stats a reader** — a buff cannot move a number already folded away at parse
time.

All eight are implemented though only five occur in the data today, because
wiring only the callers that exist is how the second caller finds a silent
no-op.

`mastery` and `versatility` are still placeholders: Forever states neither and
nothing grants either.

## What the source does not price, and what was fitted here

Vanilla has no ratings, so the source's blanket "any rating costs 1" cannot be
what it means for "+1% crit". Each of these was solved out of real items where
it is the ONLY unknown — the item's remaining budget, back through the 3/2
power. They live in `CALIBRATED_COST` in the tool, apart from the transcribed
costs, so the two kinds of number cannot be confused.

| Stat | Fitted | Evidence | Confidence |
| --- | --- | --- | --- |
| Defense skill, per point | **2.5** | Five Cenarion tank pieces solve 2.34, 2.55, 2.59, 2.59, 2.63 | **Firm** — five items, every other stat sourced |
| Melee crit, per 1% | **16** | Quick Strike Ring solves 16.11 alone; SoD Arcanist Crown 15.0; least squares over four items 16.75 | Good |
| Melee hit, per 1% | **10** | Wristguards of True Flight solves 12.28, Striker's Mark 8.66 | **Loose.** The band is 8.7–12.3 and 10 is the middle of it, not a reproduction |
| Block chance, per 1% | **6** | Breastplate of Might alone, and it rests on defense skill being 2.5 — both unknowns sit on the same item | Weak |
| Spell crit, per 1% | **16** | **Assumed equal to melee crit and never measured** | None |
| Spell hit, per 1% | — | Classic Arcanist Crown solves **12.07**, one item | One data point; priced at the melee figure |

**ONE TOOLTIP LINE IS ONE BUDGET LINE, EVEN WHERE THE ENGINE SPLITS IT IN TWO.**
"Improves your chance to get a critical strike with all spells and attacks by
1%" is a single thing the item sells, and `itemData` correctly turns it into
BOTH `critChance` and `spellCritChance` because two different tables read them
([CLAUDE.md](../CLAUDE.md) records why). Pricing the resolved stats naively
therefore charges that line twice — which took the SoD Arcanist Crown from 101%
to 113%, and **that wording is on sixty-two lines in this data**, so the whole
on-file table read high for a reason that had nothing to do with itemization.
The tool removes the overlap.

## Where it does not work

Four honest gaps. None is a bug in the tool; each is a thing the model does not
contain.

- **Procs, on-use effects and set bonuses are unpriced.** They plainly cost
  something and the source says nothing about what. It shows as both tails of
  the distribution: [Hand of Justice](https://www.wowhead.com/classic/item=11815)
  prices at **40.7%** of a trinket budget because essentially all of it is the
  proc, and [Blackhand's Breadth](https://www.wowhead.com/classic/item=13965) at
  **119.6%** — both blue trinkets, both priced on the blue formula.
- **Shields do not fit, and block value is the suspect.** Earthen Guard and The
  Immovable Object price at **180%** and **183%**, and in both cases block value
  at the sourced 0.65 is more than the whole budget on its own. The likely
  reading is that a shield's block value is baseline-driven and mostly free, the
  same shape as base armor — **three shields on file cannot settle it**, so it
  is recorded rather than fixed.
- **Relics have no slot multiplier.** The source has no row for an idol, libram
  or totem, and nothing here invents one; the tool reports "no budget for this
  slot".
- **The residual scatter is real.** Even on clean items the fit is ±5%, so a
  figure from this tool supports "about right" and "plainly wrong" and nothing
  finer. The page's own worked example misses by 0.4%.

## What this is for

It answers questions about items that were previously unanswerable here, and it
is worth being specific about which, because the temptation is to use it for the
one thing it must not do.

**It can say:**

- Why an item carries the stats it carries, and what a stat on it displaced.
- Whether a number in the item data is plausible — a mis-scraped stat usually
  pushes an item well outside 90–110%.
- What a Forever item is doing relative to Classic's budget. The one real
  Forever item on file, **The Immovable Object**, and the four
  `FOREVER_SPELL_POWER_BUFFS` weapons all price well over 100% — Azuresong with
  the owner's +64 spell power reaches **447%** of a one-hander's stat budget
  against the Classic version's 206%. Forever is not itemizing to Classic's
  budget on those, which is a statement about the ruleset and not about the
  model.
- Which of two stats is cheaper to the item designer, which is a different
  question from which is better for a character — that is what
  `tools/stat_weights.ts` answers.

**It must not say** what stats a hypothetical item should have. There is no
Forever itemization document, the budget here is a Classic reconstruction, and
`src/data/items/README.md` is explicit that the sets on file are Season of
Discovery stand-ins rather than Forever data. **Keep saying so.**

## Where it sits in the source hierarchy

Below everything in [CLAUDE.md](../CLAUDE.md)'s table of Forever sources. It is
not Forever data, it is not owner data, and it is not even Blizzard data — it is
a community reconstruction of a defunct system, fitted here against Classic
items. If the ruleset owner ever supplies an itemization document, it replaces
this outright.

## There is no test, deliberately

Nothing in `src/` reads the model, so there is no behaviour to pin. A test
asserting the percentages this tool prints would be pinning an audit tool's
output — the same mistake as a test named for what a page SAYS, which this
project has already paid for once. The verification lives in the tool itself:
the ten reference items are checked-in constants with their source URLs, so
`REFERENCE=1` re-derives the table above in one command and a changed
calibration constant shows up immediately.

The one thing here that *would* be worth a test is the **base armor group
invariant** — that every (slot, armor type, item level) group in
`src/data/items/*.json` agrees on its baseline. That is a claim about scraped
data rather than about this model, it is what the free-armor conclusion rests
on, and a re-scrape putting a wrong armor number in would break it silently.
Not written yet.
