# DRUID DEEP DIVE

**Class:** Druid
**Profiles:** Moonkin, Cat, Bear
**State:** the deep dive is DONE. Twelve live gaps to **three**, and the three
that remain are two talents on one engine gap plus one engine gap of its own.

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

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

| Profile | Talents | DPS | was | List | Style |
| --- | --- | --- | --- | --- | --- |
| Cat | 9/35/7 | **656.1** | 488.0 | `DRUID_CAT` | cat (paws) |
| Bear | 9/42/0 | **444.7** | 376.2 | `DRUID_BEAR` | bear (paws) |
| Moonkin | 38/0/13 | **398.0** | 384.3 | `DRUID_MOONKIN` | caster |

**CAT IS NOW THE HIGHEST PROFILE IN THE PROJECT**, above DW Fury's 652.0, and it
got there from ninth. That is a claim worth distrusting, so it is attributed
rather than asserted — `npx vite-node tools/druid_attribution.ts` reprints the
table below, 30 batches of 10 per variant, each variant taking one talent back
out of the build.

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

‡ **NOT A GAIN FROM THIS WORK.** The Moonkin's crit is +3% either way — from its
own talent now instead of from the raid buff — so removing the talent removes 3%
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
| 51 | 29 | 5 | **15** | **2** |

Was 20 / 5 / 14 / **12**. Nine talents moved into `Fully` and nothing changed
about the fourteen the owner has ruled out.

### The 3 live gaps

| Talent | Why, and what would clear it |
| --- | --- |
| `furor` | pays out ON SHAPESHIFTING, and a form is fixed at creation like a stance |
| `natural_shapeshifter` | the same sentence, deliberately: both are findable by that wording the day mid-fight shifting lands, and `druidTalents.test.ts` fails if a third talent joins them or either one stops saying it |
| `nature_s_focus` | avoids spell pushback from damage taken, and **no cast in this engine is ever lengthened by being hit**. Recorded as an ENGINE gap rather than an encounter one, because "the Moonkin's target does not swing" is the weaker claim and would expire first |

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `genesis` | its periodic HEALING half — `healing`, ruled out |
| `nature_s_splendor` | its Rejuvenation and Regrowth clauses — `healing`, ruled out |
| `improved_starfire` | its 15% stun — `crowdControl`, ruled out |
| `naturalist` | the Healing Touch cast time — `healing`, ruled out |
| `moonkin_form` | Omen of Clarity's trigger chance is doubled, and **Omen of Clarity is not declared**. It is a real spell in the capture that no profile casts, so there is no proc here to double |

**FOUR OF THE FIVE ARE HEALING OR CROWD CONTROL**, so the only remaining
*content* item in this class is Omen of Clarity.

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
