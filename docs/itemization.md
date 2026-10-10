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
