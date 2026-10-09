# Stat weights

What one more point of a stat is worth, in DPS. One baseline run, then one run
per stat with it temporarily added; the weight is the DPS difference over the
amount added.

```bash
npx vite-node tools/stat_weights.ts
PROFILE=rogue_combat npx vite-node tools/stat_weights.ts
PROFILE=mage_fire PLAN=1 npx vite-node tools/stat_weights.ts     # the plan, no fights
PROFILE=prot_warr STATS=hitChance,critChance ITERATIONS=6000 npx vite-node tools/stat_weights.ts
```

In the app it is a checkbox under the Run button, and ticking it changes what
Run Simulation does: the ordinary results page and combat log still appear,
because the stat-weight run's baseline **is** the ordinary batch.

| | |
| --- | --- |
| the catalogue, the plan, the arithmetic | [`src/simulator/statWeights.ts`](../src/simulator/statWeights.ts) |
| the cap ladder | [`src/game/combat/statHeadroom.ts`](../src/game/combat/statHeadroom.ts) |
| per-iteration DPS, sliceable | [`src/simulator/dpsSamples.ts`](../src/simulator/dpsSamples.ts) |
| the worker pool | [`src/ui/hooks/useStatWeights.ts`](../src/ui/hooks/useStatWeights.ts) |
| the tank table | [`src/ui/panels/TankStatWeightsPanel.tsx`](../src/ui/panels/TankStatWeightsPanel.tsx) |

---

## The four things that decide the answer

### 1. The baseline and the variant share their seeds

`deriveSeed(baseSeed, i)` fixes iteration `i`'s fight and a Simulation rolls its
duration **before anything else**, so the same base seed gives both runs
bit-identical fight lengths. The weight is then a PAIRED difference — iteration
`i` against iteration `i`, the same fight with one stat changed — rather than
the difference of two independently noisy means.

| +30 strength on DW Fury, 500 iterations, over 20 repeats | |
| --- | --- |
| shared seeds | **17.55 ± 0.18** |
| independent seeds | 16.15 ± 12.33 |

A ~5,000x variance reduction, costing nothing and biasing nothing: each run is
still a valid sample of its own configuration and pairing only correlates them.

### 2. IT DOES NOT WORK FOR EVERY STAT, AND THE RUN HAS TO SAY WHICH

The engine draws from **one** random stream. Flip a single miss roll and every
later draw is consumed in a different order, so the two fights decorrelate
completely — and a 60-second fight rolls enough attacks that adding 1% hit flips
at least one about seven times in eight.

| DW Fury, 3000 iterations | per-iteration spread of the paired difference |
| --- | --- |
| +30 strength | 1.8 DPS — the same fights with bigger numbers |
| +9% hit | **124.7 DPS** — effectively two independent fights |

So strength is settled in a few hundred iterations and hit is not settled in
3000. **That is a property of the stat, not a flaw to hide**, and every weight
carries the 95% interval computed from its own paired spread so a reader can
see which rows to act on.

**Every row runs the same iterations**, on the ruleset owner's instruction. An
earlier version read each variant's spread and gave the noisy ones more fights
— strength finished in 250 where hit took 3000 — which was much cheaper and
made two rows of one table incomparable: sorting by weight gave no hint that
one figure rested on twelve times the evidence of the one above it. Uniform
counts cost roughly twice the fights and buy a table that can be read straight
down.

### 3. A CAPPED STAT IS SEVERAL STATS

"Chance to miss" is up to five numbers and a build can be capped on one and not
another:

| profile | melee specials | main-hand swings | off-hand swings |
| --- | --- | --- | --- |
| rogue_combat | **0.00% capped** | 11.00% | 11.00% |
| dw_fury | **0.00% capped** | 19.00% | 9.00% |
| prot_warr | **0.00% capped** | **0.00% capped** | — |

DW Fury's two hands differ because Dual Wield Specialization gives ten points
of hit to the off hand alone.

Prot Warr is the case the reporting is for: every slice it rolls on is at zero,
so the ladder comes back empty and the answer is **"Already capped. No stat
weight."** rather than a measurement of nothing.

So hit is measured as a **ladder**, one weight per interval between the caps:
run to the first cap and difference against the baseline, run to the second and
difference against the first. The ruleset owner's own words for it were "these
can be treated as multiple stats in effect".

**A rung is named by what it reaches, not by its width.** "Hit chance +9.00% →
caps Off-hand swings" is the figure that was asked for; "the first 9.00%" reads
like a 9% cap and is not one — it is what DW Fury has LEFT on its off hand once
8 points of gear hit and 10 from Dual Wield Specialization have come off a 27%
miss. Same number, opposite meaning. **And nothing is truncated**: a rung runs
all the way to the cap it names, because the question is how much it would
take.

**A tier is linear by construction**, which is what makes it measurable. The
boundaries sit exactly where a table stops paying, so nothing changes behaviour
inside one — the whole tier can be added at once for the best signal-to-noise
available, and the per-point figure is still a true one. A single large step
ACROSS a cap would average the first point together with the last:

| DW Fury hit, 3000 iterations | DPS per point |
| --- | --- |
| `+9.00% → caps Off-hand swings` | **5.8971 ± 0.5058** |
| `+10.00% more → caps Main-hand swings` | **2.6146 ± 0.4053** |
| one 19-point step instead | 4.17 — understates the first nine, overstates the last ten |

The monotone fall is what says the boundaries are in the right places.

`dodgeParryReduction` is the same shape from a single table: the reduction comes
off the defender's dodge AND its parry, and those are different sizes. A shield
build gets two rungs — `+6.50% → caps Dodge` then `+7.50% more → caps Parry`;
anything else gets one, because enemy parry is zero for a character not standing
in front of the target.

**Its slices fold into one row each, where hit's do not.** Enemy dodge is the
same 6.50% on every melee table a build rolls on, so three rows naming the
main hand, the off hand and the specials table are three rows of one fact —
`fold` prints them once as "Dodge", and splits them again the moment they
disagree, which they would the day anything grants weapon skill with one hand
and not the other. Hit's slices genuinely differ, so hit genuinely gets
several.

### 4. A ZERO IS AN ANSWER HERE, AND IT HAS TO BE TOLD APART FROM AN ABSENCE OF ONE

`StatWeight.verdict` is one of three:

| | means | how it is decided |
| --- | --- | --- |
| `measured` | a number to act on | the interval is narrower than the value |
| `none` | **worth exactly nothing to this build** | the paired runs produced the same fights |
| `inconclusive` | not a measurement yet | the interval swallows the value |

`none` is the **stronger** claim, not the weaker one, and it is only trustworthy
because of the guard below. Printing it as "0.0000" beside an `inconclusive`
"0.08 ± 0.9" would file a confident answer under the same heading as the absence
of one.

**Every variant is checked to have arrived before it is run.** Shared seeds mean
a variant that never applied produces a bit-identical fight and a delta of
exactly 0.00 — indistinguishable from a stat genuinely worth nothing, and this
project's own rule is that two figures agreeing to the decimal mean the same
thing was measured twice. So `statWeightPlan` builds the character with the stat
added and compares the effective stat block, and a stat that did not move is
**skipped with that as its reason** rather than measured and reported as
worthless. It costs one `createPlayer` per variant and no fights.

---

## The step sizes are a modelling choice

Not ruleset data. They are declared in one place, `WEIGHTABLE_STATS`, and each is
about one gear line's worth — the range an item or an enchant in this project's
data actually grants — chosen so the step reads as marginal and still clears the
noise floor. **Changing one changes what the number means**, not just its
precision, so `StatWeight.units` carries whichever was used and the panel prints
it.

Haste is the one stat expressed in a unit the engine does not hold.
`RATING_PER_PERCENT` says of itself that every constant in it is a placeholder,
so the step is `percent × RATING_PER_PERCENT.haste` — the project's one idiom,
shared with Seal of the Crusader, Nature's Grace, Flurry and the gloves enchant
— and the weight is DPS per 1% haste, which survives the conversion moving.

`critRating` and its siblings are deliberately absent: no gear in this project
grants rating, and an item line saying "+2% crit" becomes `critChance`.

## What is skipped, and why that is not a gap

| reason | example |
| --- | --- |
| the target does not swing back | armor, defense skill, dodge, parry, block chance |
| already capped | a Rogue's `dodgeParryReduction`, if it ever reached 4.5% |
| the build rolls on no table the stat can reach | `dodgeParryReduction` on a Mage |
| adding it does not change the built character | nothing today — see the guard above |

`blockValue` is deliberately **not** in the first group. Shield Slam adds the
wielder's block value to its own damage, so it is an offensive stat for a shield
Warrior in a fight it is never hit in.

---

## Cost

A fight is 3 to 5 ms, and a demanding selection is tens of thousands of them.
Four things keep that down, and none of them trades accuracy for it.

1. **Shared seeds**, above. Most stats need hundreds of iterations, not thousands.
2. **A lean telemetry sink.** `dpsSamplesFor` keeps one number per source id
   where `runBatch` accumulates a whole `BatchTotals` — 1.2x to 1.75x faster,
   and it reproduces `runBatch`'s DPS to twelve significant digits. (Not bit for
   bit: the batch takes each iteration's damage as a difference of cumulative
   sums. One part in 10^13, pinned by a test.)
3. **Adaptive allocation.** A stat whose spread is zero costs one probe block
   and nothing more, which is why eighteen variants is not eighteen full batches.
4. **A pool of Web Workers**, one per core less one. Iterations are independent
   and the engine holds no module-level state, so they parallelise exactly.

Measured on a 12-core machine, DW Fury, all 21 stats at 3000 iterations each,
54,000 fights:

| | |
| --- | --- |
| one thread (`tools/stat_weights.ts`) | **157.5 s** |
| 11 workers | **41.7 s** |

Both figures move with whatever else the machine is doing. Uniform iterations
roughly doubled the fight count against the allocation they replaced, which is
the price of a table that can be read straight down.

**The baseline is the floor and it cannot be split.** `BatchTotals` is a single
accumulator for the whole run and nothing merges two of them, so the ability
breakdown, the resource flow and the uptimes all have to come off one thread —
about twelve seconds at 3000 iterations. The first version waited for it before
deciding the allocation, which left the other eleven workers idle for all of it.
The baseline and every variant are dispatched together, so it runs inside the
pool's wall clock rather than in front of it, and nothing waits on anything
else. **No fight is run twice.** An earlier version with adaptive iterations
needed the baseline's spreads BEFORE the baseline batch finished, and ran its
first 250 iterations a second time as lean slices just to unblock the pool;
with nothing to decide, there is nothing to unblock.

**Splitting the baseline itself would need a `BatchTotals` merge**, and that is
the obvious next step. It was not worth the blast radius here — every number on
the results page comes through that accumulator.

## The baseline is not a published figure

It is a 3000-iteration estimate at a fresh seed, standard error about 1.8 DPS.
The table in HANDOVER.md is `measure_profiles.ts`, which is 30 batches of 10 —
300 fights, interval about ±11.1 for this profile. Three runs here read DW Fury
at **894.7, 896.8 and 900.7** against a published **901.8 ± 11.1**: they agree,
and the stat-weight figure is simply the tighter one. Do not read a few DPS of
difference as a regression, and do not quote this one as a baseline.

---

## Tank weights: the same runs, read for deaths

When the target swings back, a second table appears asking a different
question: not what a point of a stat adds to DPS, but **what it takes off the
death count**. The ruleset owner's framing is that avoiding death is itself a
stat — 30 agility taking deaths from 10.5 to 9.8 is **+0.7 avoid death** — so
the sign is flipped once, in `survivalWeightsFrom`, and more is better exactly
as it is in the damage table.

**It costs no extra fights.** `sampleIterations` counts deaths while it sums
damage, so both tables are two readings of one measurement rather than two runs
that might disagree.

**Deaths are a rich count, not a rare event**, which is what makes them
weightable at all. The encounter ramps the boss's damage 10% a swing and stands
the character back up without resetting the ramp, so a tank dies **8 to 11
times** in a sixty-second fight. The quantity is really "how far into the ramp
this build survives".

**A stat that cannot move the death count is left out**, not listed at zero.
That is the `none` verdict — the variant ran bit-identical fights — and attack
power, spell power and the rest of the offensive list produce it. `inconclusive`
rows stay, because "the run could not resolve this" is a different statement
from "this does nothing".

Prot Warr at the default 3000 iterations, 66,000 fights, 8.81 deaths a fight:

| stat | avoid death / point | |
| --- | --- | --- |
| Dodge chance | **0.1383 ± 0.0378** | 1.000 |
| Parry chance | **0.0750 ± 0.0315** | 0.542 |
| Defense skill | **0.0110 ± 0.0063** | 0.080 |
| Agility | **0.0067 ± 0.0025** | 0.049 |
| Stamina | **0.0054 ± 0.0031** | 0.039 |
| Armor | **0.0005 ± 0.0001** | 0.004 |
| Block chance | 0.0048 ± 0.0178 | not resolved |
| Block value | 0.0008 ± 0.0012 | not resolved |

Six rows resolve at 3000 where four did at 600. **Stamina is the row that
disagrees with the damage table on purpose**: it is worth `-0.0736` DPS a point
and `+0.0054` deaths avoided, because Forever's `D x 10 / H` means a bigger
health pool makes each point of damage taken worth less rage.

### Parry is worth 42% of dodge, and parry haste is the whole reason

Both avoid the entire blow, so the two should be the same stat. They are not,
and the gap is not a bug: **a parry hurries the attacker's next swing by 40% of
a full one and a dodge does not**, so parry buys the same avoidance with a cost
attached.

`npx vite-node tools/probe_parry_haste.ts` strips `parryHaste` off every
combatant at runtime and measures both again:

| | dodge | parry |
| --- | --- | --- |
| parry haste **on** | 0.1375 ± 0.0377 | **0.0582** ± 0.0309 |
| parry haste **off** | 0.1128 ± 0.0305 | **0.1128** ± 0.0305 |

**Identical to four decimal places with the mechanic off**, which is a stronger
result than "similar": under shared seeds, swapping two points of dodge for two
points of parry then produces bit-identical fights, so there is provably no
other asymmetry between them anywhere in the engine. The cumulative table walk
displaces the same band of `hit` either way.

Two things fall out of the same table. Parry haste costs the tank **0.86 deaths
a fight** on its own (8.85 against 7.98), and **dodge is worth MORE with it on**
(0.1375 against 0.1128) -- a harsher fight makes avoidance matter more.

### Block is correctly implemented and correctly worth almost nothing here

The two block rows do not resolve even at 3000, and that was worth chasing
rather than accepting. It is a magnitude, not a wiring fault.

**THE MECHANISM IS LIVE, CHECKED BY SCALING IT.** Blocks are not rare -- the
Prot Warrior blocks **16.05 of 26.60** attacks a fight, because Shield Block
takes its 11.16% table slice far higher for its duration. And the value is
applied: **+5000 block value removes 64,243 damage and takes deaths from 8.69
to 4.82.**

**THE RATIO IS ARITHMETIC AND IT CHECKS OUT.** A dodge removes the whole blow
and a block removes a flat 97 of it, so a point of block chance should be worth
a point of dodge chance times `blockValue / meanHit`:

```
  97 / 5230  = 1.85%          what the arithmetic predicts
  0.0017 / 0.1375 = 1.2%      what the measurement gives
```

Block chance does not resolve even at a 30-point step (`0.00238 +-0.00274`),
which is itself the answer: its weight is somewhere under half a percent of
dodge's. Block VALUE does resolve at a larger step -- `0.00205` a point at 50,
`0.00133` at 200, `0.00107` at 1000, the fall being a block never removing more
than the blow it lands on.

**THE CAUSE IS THE ENCOUNTER'S DAMAGE RAMP, AND THAT IS A PLACEHOLDER.** The
boss opens at 5,000 and every swing is 10% harder than the last, so incoming
hits grow from **1,624 early to 12,458 late** while block value stays flat at
97 -- six percent of an early swing and 0.78% of a late one. Block's entire
contribution is **1,556 of 139,118** damage taken, 1.12%.

So this is an ENCOUNTER cause in the sense `CLAUDE.md` already uses, and it
expires if the ramp changes. `targetSwingDamage` and `BOSS_DAMAGE_RAMP` are
both invented numbers borrowed from Classic, and they are what decide whether a
flat mitigation stat means anything -- which is a question for the ruleset
owner rather than something to tune.

---

## Two ruleset changes landed with it

**Enemy parry follows the encounter, not the weapon.** The owner: "when the
Target Attacks Back checkbox in the Encounter panel is selected, the target
gains a 14% chance to parry you." It replaces a reading of "0% if 1H & Shield is
not selected" as a statement about the STYLE, which was right about a shield
tank and wrong either side of it — the Bear tanks without a shield and was never
parried, the Shockadin holds one against a dummy that never swings and was being
parried by it. `CombatStyleLookup` is gone with it: parry was the only thing it
fed.

**Parry haste.** A parried attack takes 40% of a full swing off the attacker's
remaining timer, floored at 20% of a full swing — the owner's rule, applying to
players and bosses alike. Both fractions are of a full swing rather than of what
is left, which is what makes it converge: no run of parries can drive a timer to
zero. [`engine/combat/parryHaste.ts`](../src/engine/combat/parryHaste.ts) owns
the rule and [`game/combat/attackChances.ts`](../src/game/combat/attackChances.ts)
owns the two numbers.

**It is scheduled, not applied inline, and the first version was not — so it
fired exactly zero times.** A swing's handler resolves its blow and only then
schedules its successor, so at the moment the parry is seen the handle on the
combatant is the swing that is *currently firing*, with no time left on it.
Every unit test passed, because calling `dealDamage` by hand at a chosen moment
does leave a real future swing pending — the one case the live path never
presents. What caught it was measuring the mechanism: three tank profiles took
**25.5 attacks a fight before the change and 25.5 after it**.

| profile | before | after | |
| --- | --- | --- | --- |
| Prot Warr | 507.5 | **543.5** | +36.0 REAL — parry haste, more rage |
| Bear | 500.0 | **448.4** | −51.6 REAL — now parried |
| Shockadin | 608.0 | **667.7** | +59.7 REAL — no longer parried |
| Prot Pally | 357.0 | **369.7** | +12.8 REAL — parry haste |

The other 21 profiles moved by exactly 0.0.

**And it expired a test that had been right.** `paladinTalents.test.ts` asserted
that Reckoning's 1,500 ms internal cooldown "cannot bind in THIS encounter,
because the one attacker swings slower than it" — true when the boss's slowed
swing was 2,400 ms. Parry haste makes that 1,440 ms, sixty milliseconds inside
the window: the minimum gap is now exactly 1,440 ms and 88 of 1,016 gaps fall
under 1,500 ms. The test's own note said it "expires the day the encounter swings
faster", and it did.
