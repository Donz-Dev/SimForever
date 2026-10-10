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
| Stamina | 0.67 |
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
