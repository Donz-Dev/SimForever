# Optimising a profile

**MAXIMISE DPS FOR ONE NAMED PROFILE, WITHOUT CHANGING WHAT THE PROFILE IS.**
This is the repeatable form of the ruleset owner's brief. It has been run
**three times and got a different thing wrong each time**, and the three
failures are three different kinds:

| | what happened | the gate below that catches it |
| --- | --- | --- |
| **an illegal talent tree** | the Shockadin's optimised spread was refused by the game's own calculator; 896.0 and 1008.2 became 856.0 and 933.2 | **Gate A** |
| **an illegal pre-combat list** | the Arcane Mage opener dealt ~1,200-1,400 damage before the clock started; its **+95.9** headline is void | **Gate B** |
| **not going deep enough** | four of six named profiles got a tree repair and a pre-combat line and **no APL pass at all**; meanwhile six classes nobody named were audited | **Step 1**, **Step 6.6**, and the scope rule in **Step 0** |
| **measuring inside a fixed frame** | the fight is 60s, two cooldowns were silently on the GCD, and an entry was called dead that fires twice at 240s — none of it visible to a paired probe, because it is true of the baseline too | **Step 1's sixth read**, and *"What the loop cannot find"* |

Every rule here exists because one of those happened. Read
[CLAUDE.md](../CLAUDE.md)'s section *"An optimisation brief, and five ways this
project has failed one"* for the narrative; this file is the procedure.

**THE OWNER'S FRAMING IS A LOOP AND NOT A PIPELINE** -- *"this process is
iterative because some decisions have a knock-on effect"* -- so the order below
is the order of one **pass**, and a pass is repeated until it ships nothing.

---

## 0. The loop, in one page

```
  STEP 0   write the theme down                              once, 5 min
  STEP 1   read the build: 5 runs + 1 READ, ~25s total       every pass
  STEP 2   every candidate passes Gates A, B and C           before it is measured
  STEP 3   write the candidates into tools/<x>Variants.ts    one group per dimension
  STEP 4   measure PAIRED, one group at a time               ~20s per 10 variants
  STEP 5   ship the winners, then run the loop again         knock-on is the point
  STEP 6   per-dimension playbooks                           the levers and their traps
  STEP 7   close the pass: typecheck, test, write it down
```

Stop when a whole pass produces no shipped change. Two passes with nothing in
them means the profile is at a local optimum, and **that is a result worth
reporting** -- the Arcane round's most valuable output was nineteen variants of
which seventeen lost.

**BUT "A LOCAL OPTIMUM" MEANS *INSIDE THE FRAME THE LOOP MEASURES IN*.** A
paired probe cannot see anything true of the baseline and the variant alike --
the fight length, an ability's own declarations, the shape of the list. The
first profile taken through this procedure was then audited by the owner, who
found four things in that blind spot. See **What the loop cannot find** before
calling a profile done.

---

## Step 0 — Fix the theme, in writing, before anything

Dimension 1 of the brief, and it is a **scope limit** rather than a dimension to
optimise. An Arcane Mage spends the majority of its points in Arcane and
considers Arcane spells; a DW Fury Warrior stays in Berserker stance, holds two
one-handers, and lives in Fury.

**DERIVE IT, DO NOT RECALL IT.** One command prints the tree split and the
build URL for every preset:

```bash
npx vite-node tools/encode_talent_build.mjs --all
```

`2H Arms  (two_hand_arms)   39/10/2   51 points` is the theme's first line. The
rest is on the preset: `preset.detail` already states race, weapon or style,
stance or form, and whether the target swings back -- for example
`Gnome, caster, standing target. 39 Fire / 10 Arcane`.

Write these five invariants into the variant file's header. **They may not
move:**

| invariant | read from |
| --- | --- |
| class | `preset.characterClass` |
| **majority tree, and that it stays the majority** | `encode_talent_build.mjs --all` |
| combat style and weapons in hand | `preset.detail`, `profile.combatStyle` |
| stance or form | `preset.detail`, `profile.stance` |
| whether the target swings back | `profile.encounter.targetAttacks` |

**AND THE NAMED PROFILE IS THE WHOLE SCOPE.** *"Diff every class, every time"*
is a rule about a **patch**, where a client refresh moves trees nobody
mentioned. An optimisation is a list of profiles. Applying the patch rule to an
optimisation is what cost four of six profiles their APL pass, and the figure
to remember is that of seven talent spreads repaired in that round, **one**
belonged to a named profile.

**A TANK IS THE ONE PROFILE WHOSE FIGURE OF MERIT IS NOT DPS.** If
`targetAttacks` is true, the quantity is the **death count**, DPS is secondary,
and the tools are `tools/bear_survival.ts` and the survival half of the stat
weights. Do not report a tank round as a DPS round.

---

## Step 1 — Read the build before you change it

Five commands, about twenty-five seconds in total on one thread, **and a sixth
step that runs nothing at all.** Run all six every pass. They are not
interchangeable: each answers a question the others cannot, and skipping one is
how a round spends an hour tuning the wrong rotation.

**COUNT THESE FROM THE LIST RATHER THAN FROM THIS SENTENCE** — it said "five"
for exactly as long as there were five, which is this project's own
re-count-don't-increment rule applied to its own procedure.

```bash
npx vite-node tools/encode_talent_build.mjs --all              # theme + legality + a URL the owner can audit
USES=1 SEEDS=3 PROFILES=<id> npx vite-node tools/measure_profiles.ts   # what each list entry actually did
PROFILE=<id> npx vite-node tools/probe_resources.ts            # is the build resource-bound or GCD-bound
PROFILE=<id> npx vite-node tools/probe_clock.ts                # ...AND AT WHICH FIGHT LENGTH
PRESET=<id> npx vite-node tools/probe_profile_report.ts        # where the damage is, uptimes, avoid rates
PROFILE=<id> PLAN=1 npx vite-node tools/stat_weights.ts        # which stats this build can even read
```

| command | the question it answers | its trap |
| --- | --- | --- |
| `encode_talent_build` | is the tree legal, and is it still on theme | — |
| `USES=1` | which entries fire, which never fire, and what is dealing damage from **outside** the list | the **"before the pull"** block prints each action beside the ability's **whole-fight** cast count, so four `arcane_blast` rows all read 13.2 and `<-- NEVER HAPPENED` can never fire for a spell that is also the filler |
| `probe_resources` | `headroom` at the end of the fight: large means **GCD-bound**, zero with `wasted` means **capping** | one batch, so it is a diagnostic and not a measurement. **And it answers for 60 seconds only** |
| `probe_clock` | the same book plus the cast counts and the uptimes **at four fight lengths**, which is the one axis a paired probe cannot see | one batch per length, same caveat. Read `headroom` as a SHARE, because the absolute figure grows with the fight |
| `probe_profile_report` | the damage table, buff/debuff uptime, and the `avoid` column | a row is pooled by ability **name**, so a proc sharing a name merges into it |
| `stat_weights PLAN=1` | the hit ladder and the list of stats reported **not measured** — no fights are run | **the hit ladder undercounts school-scoped hit.** See Appendix B |

### And a sixth, which is a READ rather than a run

```bash
grep -n "triggersGcd" src/game/abilities/<class>.ts
```

**IS EVERY COOLDOWN ACTUALLY OFF THE GLOBAL COOLDOWN?** `triggersGcd(ability)`
is `ability.triggersGcd ?? ability.onNextSwing === undefined`, so **an ordinary
ability is ON the global cooldown unless it opts out** — and three ability files
had no `triggersGcd: false` anywhere in them.

**THIS WAS WORTH +33 DPS ON ONE PROFILE AND IT IS NOT A MEASUREMENT.** The owner
found it by reading the list, not by running anything: *"Ensure Presence of Mind
and Arcane Power don't trigger a global cooldown."* Both did.

**AND THE SAME READ FOUND A THIRD, ON THE NEXT PROFILE, IN THE SAME FILE.**
Combustion is the Fire capstone and the spellbook capture gives it the identical
row to those two -- no cost, "Instant", "3 min cooldown", no rank, granted by a
capstone -- and it was on the global cooldown. **It was PRICED and not shipped**
(+24.93 +/- 4.21 at 60s), because a ruling covers what it says and is not
extended by analogy; the owner then ruled it off, which is worth +23.9 on that
profile.

**SO THE SIXTH READ IS NOT DONE WHEN THE FILE HAS SOME `triggersGcd: false` IN
IT.** Two of the three were already there. Check every cooldown-shaped ability
against what the spell is, and where the answer is a ruling rather than a fact,
**price it, flag it, and leave the default alone** -- the figure is what makes
the question answerable in one sentence.

**AND IT IS INVISIBLE IN EVERYTHING EXCEPT THE DPS** — an ability wrongly taking
a global cooldown still applies the right aura, for the right duration, on the
right cooldown, and reports an ordinary row. There is no zero to notice.

So for every ability in the build that is a *cooldown* rather than a cast —
trinket-likes, a damage window, a charge-granter, a potion — **check the flag
against what the spell is.** Two rules bound it:

- **it must declare a `cooldownMs`**, which `freeCastChain.test.ts` asserts for
  every off-GCD ability across all nine classes: one with no cooldown would win
  the list forever and **hang** a fight rather than fail one;
- **off the GCD means it does not START one.** It is still *blocked* by one
  running. What it buys is that the action after it is free — which is what
  makes a cooldown stack expressible at all.

**THE RESOURCE ANSWER DECIDES THE WHOLE APL PASS**, because resource-bound and
GCD-bound builds want opposite orders. The Fire Mage ends a fight with
`headroom 2920` mana, so it is GCD-bound and the question is what fills a
global cooldown; a geared Hunter empties its mana by the 30-second mark and the
question is damage per mana.

**AND A NEVER-FIRED ENTRY HAS EIGHT CAUSES, SEVEN OF WHICH ARE INVISIBLE.** The
id names no ability; the build never learned it; the entry above never yields; a
preset raid **debuff** already supplies it; the condition reads something
nothing sets; the entry is **switched off** (`disabled`); or **the owner meant
it** — Evocation sits in all three Mage lists at a 10% mana gate, fires zero
times on every one, and the ruling was *"This is intended"*. `USES=1` labels
`(not learned by this build)` and `(switched off in the list)` for you; the
other causes need the built character's own ability book. **So a never-fired
entry is a question before it is a defect.**

**AND THE EIGHTH IS THE CLOCK: the fight is shorter than the cooldown the entry
waits for.** The Arcane Mage's `arcane_power` entry fires 0.00 times at 60s and
**2.00 times at 240s**, because the ability is a three-minute cooldown that is
pre-cast at the pull. Writing that up as a dead entry is writing down a fact
about the clock as a fact about the list — **count the casts at a longer
DURATION before concluding anything about an entry whose ability has a cooldown
longer than the fight.**

---

## Step 2 — The three gates

**A CANDIDATE PASSES ALL THREE BEFORE IT IS MEASURED.** A measurement of an
illegal build is worse than no measurement, because it is a number somebody
will publish. All three failures in the table at the top of this file were
measured, reviewed, tested, CI'd and merged.

### Gate A — the talent tree is legal

Write the allocation out **in full** and hand it to `treeFor`, which throws
rather than returning something plausible:

```ts
import { MAGE_TREE as tree } from './buildVariants';
{ label: '...', apply: tree({ arcane_focus: 5, /* ...all 51 points... */ }) }
```

It checks three things that a delta cannot:

1. **Total is exactly 51.**
2. **`legalAllocation` drops nothing.** It reports `dropped[]`, and
   `createPlayer` would strip an illegal talent **silently** — so a variant
   written as a delta measures a build nobody chose and reports it as a finding.
3. **A tier counts the points STRICTLY BELOW it** (`pointsBelowTier`) — not the
   talent's own ranks and not its neighbours' in the same row. 14 points below
   tier 15 plus Divine Favor is refunded; one point in **each** of two tier-15
   talents is refunded **both** times.

**THE CASE THAT SEPARATES THE RIGHT RULE FROM THE WRONG ONE IS A TREE THAT
STOPS AT THE TIER IT IS SPENDING IN** — which is exactly what an optimiser
produces and no hand-written build does. That is why this cost 40 DPS on the
Shockadin and nothing historically.

**ALSO READ `requiresRanks`.** A prerequisite can demand the **full** rank —
three of the Warrior's seven do — so a talent whose own effect is worth nothing
can be five points that cannot be moved. Read the tree before pricing a point;
the tier sums can be perfect and the build still illegal.

**AND PRINT THE URL.** `encode_talent_build.mjs` turns the allocation into a
`talentsforever.com` link, which is the independent second opinion and is how
the tier bug was found in the first place — the owner asked for the build as a
link so they could audit it.

### Gate B — the pre-combat list is legal

**THE RULING: *"Once you deal damage or finish casting a damaging ability combat
has started."*** So a pre-combat list may finish **at most one** damaging
ability, and it must finish at **exactly t=0** — that cast is the pull.

**NOTHING IN THE ENGINE ENFORCES THIS AND NO FIGHT CAN REVEAL IT.**
`runPrecombat` resolves every action at timestamp zero, so the damage, the procs
and the auras all arrive free; there is no zero anywhere to notice, the suite
stays green, and `USES=1` prints an illegal opener as cheerfully as a legal one.
**The gate is arithmetic on the declared leads.**

**THE ARITHMETIC.** `rewindFor` is `max(0, lead - castTime)`, so:

```
finish(action) = -max(0, lead - hastedCastTime)        # 0 means "at the pull"
hastedCastTime = castLength(ability, haste, resolveCast(actor, ability).baseCastTimeMs)
```

Three clauses, in this order:

- **B1 — at most ONE damaging action in the whole list.** Two casts cannot both
  complete at t=0. This is the clause that catches most violations and it needs
  no arithmetic at all.
- **B2 — that action must finish at 0**, i.e. `lead <= hastedCastTime`.
- **B3 — no two casts may overlap.** Sum the leads and the cast times by hand.
  Real, and **the weakest of the three**: the Arcane opener satisfied B3 and
  broke B1 four times over. *Having found one constraint, ask whether it is the
  binding one.*

**WHAT COUNTS AS DAMAGING IS READ OFF THE ABILITY'S OWN `onCast`**, and there
are three answers, not two. This is where the deleted checker went wrong — it
flagged every Paladin seal as the offender while reporting the four Arcane
Blasts as merely questionable:

| | test | examples | verdict |
| --- | --- | --- | --- |
| **damaging** | `onCast` calls `dealDamage` and there is **no** `onNextSwing` | `scorch`, `wrath`, `lightning_bolt`, `flame_shock`, `judgement`, `frostfire_bolt`, `fireball`, `pyroblast`, `arcane_blast`, `shadow_bolt`, `incinerate`, `mind_blast`, `aimed_shot`, `sniper_shot`, `ambush`, `ravage`, `mangle`, `strider_kick` | subject to B1 and B2 |
| **not damaging** | no `dealDamage`, **or** `onNextSwing` is declared so the ability only **arms** a swing that lands after the pull | every stance, form, seal, aspect, mark, potion, `charge` (rage only), `heroic_strike`, `maul`, `raptor_strike`, `holy_shield`, `righteous_fury`, `mage_armor`, `arcane_power`, `shadowform`, `prowl`, `premeditation`, `blade_flurry`, `bloodrage_cast`, `battle_shout_cast`, `enrage`, `elemental_mastery`, `windfury_weapon` | free at any lead |
| **pure DoT** | no damage at the cast, but it applies a periodic that damages | `shadow_word_pain`, `devouring_plague`, `searing_totem` | **legal at a 0s lead** (the first tick is after the pull); at a lead > 0 it is an **open owner question** |

**A SEAL DEALS NOTHING WHEN CAST — THE SWING CARRYING IT DOES.** That is why
`judgement` at 0s is the Paladins' one damaging action and the seals above it
are free, and why a checker that accuses the owner's own line while excusing the
offender is worse than arithmetic done by hand.

**THE HASTE ROUNDING IS NOT A VIOLATION TO FIX.** The owner wrote every
"start casting" lead as that spell's **declared** cast time, and haste makes the
real cast shorter — so `frostfire_bolt` at a 2.5s lead finishes 0.049s before
the pull. Classify it: if `lead <= declaredCastTime`, the deficit is the haste
artefact on the owner's own transcription. **Record it, do not "fix" it, and
never ADD a line that relies on it.** A whole extra cast fitting in the gap is a
different thing entirely — that is `[EARLY]`, and it is B2 failing.

**AND AN OPTIMISATION MAY ADD TO THE OWNER'S OPENER AND MAY NOT REWRITE IT.**
`tests/profiles/precombatOpeners.test.ts` transcribes their message a second
time and asserts *their lines plus an explicitly declared set of additions*, so
every addition is listed separately with the figure it is worth. An addition may
be inserted anywhere; it may not reorder or replace anything they wrote. **That
test is what caught a round that had moved `mage_armor` off its stated lead** —
and the two arrangements then measured 8.1 apart against a combined interval of
11.4, so there was no measurement to trade against keeping the transcription.

**FINALLY, CONFIRM THE OPENER ARRIVED.** `USES=1` cannot:

```bash
npx vite-node tools/verify_opener.ts          # reads auras.stacksOf AFTER begin()
PROFILE=<id> npx vite-node tools/probe_precombat_pools.ts
```

Counting `aura_applied` says 1 where the answer is 4, because the casts after
the first are **refreshes**. The stack count on the combatant at the pull is the
only thing that answers it.

### Gate C — the theme and the gear are untouched

- **E65 gear, and no stat on it changes.** `withBenchmarkGear` attaches it to
  every preset, so this is structural: a variant may set **`enchantId`** and
  nothing else. `buildVariants.ts` has no helper that can reach `itemId`,
  `benchmarkTemplateId` or an item's stats — if you find yourself needing one,
  you are outside the brief.
- **The five Step 0 invariants hold.** Check the tree split in
  `encode_talent_build.mjs` output, not your memory of it.
- **`syncDefaultRotation` after every edit**, which `probe_build.ts` already
  does — a talent change moves which stock list applies, so a variant that
  changed the talents and kept the old list would be measuring two things and
  reporting one. Conversely an APL edit must mark the list `custom`, or the
  re-derivation throws the edit away; `apl()` does that for you.

---

## Step 3 — The variant file

One file per profile or class, `tools/<name>Variants.ts`, registered in
`tools/probe_build.ts`'s `VARIANT_GROUPS`. **One group per dimension**, named
with a short prefix because group names share a command-line namespace:

```
<x>Talents   <x>Enchants   <x>Precombat   <x>Apl   <x>Consumables
<x>Combined  — the winners together, which is the knock-on check
```

Four conventions, each of which has been paid for:

1. **Every group contains its own control** — `{ label: 'the shipped X -- the
   control', apply: (p) => p }`. A group without one cannot tell "this loses"
   from "this group did not apply".

   **AND THE CONTROL'S LABEL MUST SAY "SHIPPED" AND NOT WHAT THE SHIPPED VALUE
   CURRENTLY IS.** `(p) => p` means *whatever is on `main` right now*, so a row
   labelled with the behaviour — "on expiry", "no inner_focus", "13/3/35" — is
   honest exactly until that group ships something, and then it silently
   becomes a second copy of the new baseline while still claiming to be the old
   one. **It cost a wrong ship in the Shadow Priest round and then caught a
   second group in the same round**: a two-second refresh window was measured
   at +84.67 against what the label called "on expiry" and was in fact the
   previously-shipped two-second window, and the real on-expiry reading turned
   out to be **+33.33 better** than the thing being shipped.

   So a group that ships anything wants **two** rows: the no-op control,
   labelled *the shipped X*, and the prior behaviour **written out explicitly**
   so it cannot drift. *A no-op control is a control over the current list,
   never over the list it was written against.*
2. **Write the header as the profile's damage table**, off a `USES=1` run, with
   the DPS it was taken at. A figure in a comment expires; one that states the
   build it was taken in merely becomes dated.
3. **A prior measurement is true of the build it was taken in.** When a group
   ships something, say so in the header rather than re-pricing nineteen losing
   variants against the new baseline.
4. **One decision per variant, and one variant per decision.** Three pre-combat
   Arcane Blasts are **one** variant, because a build cannot arrive at three
   stacks by taking two of them.

---

## Step 4 — Measuring

```bash
PRESET=<id> VARIANTS=<group> npx vite-node tools/probe_build.ts     # ITER=400, SEED=20260101
PRESET=<id> VARIANTS=<group> ITER=1000 npx vite-node tools/probe_build.ts
PRESET=<id> VARIANTS=<group> DURATION=180 npx vite-node tools/probe_build.ts
```

**AND FIGHT LENGTH IS AN AXIS, NOT A CONSTANT.** The owner: *"rotations need to
be built for longer than 1 minute ... ensure that variable combat time is taken
into account."* Every profile carries `durationSeconds: 60` with a fixed ±5%
`FIGHT_DURATION_VARIANCE`, and **a minute is shorter than several of the
cooldowns a list holds** — so at the default length such an ability is cast once
and its entry can never be reached again. **Any conclusion about where it
belongs is then a conclusion about the clock.**

It is not a small effect. The Arcane Mage over twenty seeds:

| fight | DPS | `arcane_power` casts | `evocation` casts |
| --- | --- | --- | --- |
| 60s | 1147.9 | 1.00 | **0.05** |
| 180s | 1017.8 | **1.40** | 0.70 |
| 300s | 954.1 | **2.00** | **1.00** |

**DPS FALLS 17% AND THE BUILD CHANGES REGIME** — global-cooldown bound at one
minute with 2,638 mana spare, mana bound at five. So three "settled" answers on
that profile are answers about a one-minute clock: the Major Mana Potion losing
by 12.7, `manaPer5` and `spirit` weighing zero, and Evocation never firing.

**AND IT HAS NOW REVERSED A `real` WINNER AND NOT ONLY A `noise` ROW.** The Fire
Mage's `improved_fire_blast` 2/2 measures **+8.00 +/- 3.10 against the pre-round
build, +2.92 +/- 2.81 on the finished list, and -33.76 +/- 7.52 at 300s** — so
three paired measurements, two of them `real` and positive, and the change is a
loss. It was not shipped.

**THAT IS A STEP UP FROM THE ARCANE CASE ABOVE.** Pre-casting Arcane Power went
+4.19 +/- 6.81 to -8.07, which is a sign change on a row that was inside its
own interval at 60s -- the long run upgraded a `noise` row to a loss. This one
had a `real` positive verdict at 60s, measured twice against two different
baselines, and is eleven times worse at 300s. **A round can pass every gate,
measure a real gain twice, and still be shipping a loss.**

**THE MECHANISM IS THE REGIME CHANGE AND IT IS PREDICTABLE FROM STEP 1.** Fire
Blast costs 340 mana for about 1,347 where the filler costs 410 for 1,781, so
more Fire Blasts is more damage per global cooldown and LESS damage per mana —
worth something exactly as long as the global cooldown is what binds, which for
that profile is true at 60s (2,615 mana spare) and false by 300s (196).

**SO WHEN `probe_resources` SAYS A BUILD IS GCD-BOUND, ASK AT WHAT LENGTH IT
STOPS BEING SO, AND RE-RUN ANY CANDIDATE THAT SPENDS MORE MANA PER GLOBAL
COOLDOWN AT THAT LENGTH.** It is one command, and it is the difference between
shipping a 60-second optimum and shipping a rotation.

**SO: BEFORE CALLING A COOLDOWN'S PLACEMENT SETTLED, RE-RUN IT AT A LENGTH
LONGER THAN THAT COOLDOWN.** And before writing "this entry never fires", check
whether the fight is simply shorter than the thing it waits for — that is an
**eighth** cause for the never-fired list, and the only one a different clock
makes disappear.

**PAIRED, UNDER SHARED SEEDS.** `deriveSeed(baseSeed, i)` fixes iteration *i*'s
fight, so the two runs share fight lengths and the difference is four orders of
magnitude quieter: +30 strength on DW Fury is **17.55 ±0.18** paired against
**16.15 ±12.33** independent. Measured on this machine, one thread: about **390
fights a second**, so ten variants at 400 iterations is roughly **20 seconds**.

**READ THE VERDICT COLUMN, AND IT HAS THREE VALUES:**

| verdict | means |
| --- | --- |
| `real` | `|delta| > interval` |
| `noise` | inside the interval. **A statement about variance, not about whether anything happened** — where the mechanism predicts an exact ratio, check the ratio |
| `IDENTICAL FIGHTS` | spread is zero, and there are **THREE** readings rather than two: worth nothing, **the patch did not apply**, or **the patch applied somewhere unreachable**. See below |

**THE THIRD READING OF `IDENTICAL FIGHTS` IS THE NEWEST AND THE QUIETEST: A
PATCH THAT APPLIED WHERE NOTHING CAN REACH IT.** `addEntry` appends, and a list
whose last entry is **ungated and always castable** is a FLOOR under everything
below it — so Ice Lance added at the bottom of the Frostfire list ran
bit-identical fights, which reads exactly like "worth nothing" and means "never
polled". Placed where the entry actually lived it is **-68.12**.

**"A NEW ENTRY GOES AT THE BOTTOM" IS A RULE ABOUT AN ENTRY THAT COSTS
SOMETHING**: the property that makes the bottom safe for an unconditional
addition is the same one that makes it useless for a gated candidate. Read the
entry above it before believing the zero.

Five rules that have each cost this project a wrong conclusion:

- **TWO ROWS IN ONE TABLE ARE NOT PAIRED WITH EACH OTHER.** Each interval is for
  that row's difference from the **baseline**; the difference between two rows
  needs roughly `sqrt(a² + b²)`. 2H Arms' Heroic Strike floor read +61.24 at 70
  rage against +57.29 at 90 — a clear 3.95 beside intervals of 3.39 and 3.29,
  and an honest combined interval of **4.73**. Indistinguishable.
- **SWEEP A PARAMETER, DO NOT COMPARE TWO READINGS SOMEBODY WROTE DOWN.** A
  point gate, a threshold or a refresh window is one number and the whole range
  costs the same measurement each. Combat's Eviscerate gate swept 577.7,
  **588.5**, 587.2, 580.6, 572.2 — and the two values previously compared were
  the two **worst** cells, with +10.8 sitting between them. "It does not matter"
  is what two points hand you whenever they happen to agree.
- **MARGINAL VALUES DO NOT SUM, AND CAN EXCEED THE TOTAL.** The Cat's four
  changes price at +61.0, +45.1, +43.7 and +6.3 — 156.1 against a measured
  +142.4. Say *marginal*, never present addends.
- **A ZERO ON A CORRECTNESS FIX NEEDS THE MECHANISM MEASURED INSTEAD.** "Inside
  the interval" is indistinguishable from "did not apply". Measure the thing
  itself: the resolved cost, the stack count, the uptime, the rage total, the
  attacks received.
- **STATE WHAT A FIGURE IS A DELTA *FROM*, INCLUDING WHAT STAYED IN PLACE.**
  "Pre-casting Arcane Power is +24.2" survived a PR and a merge before the owner
  asked the question that undid it: *"is pre-casting arcane power +24.2 over a
  normal rotational use, or is it +24.2 over the sandwiched in cooldown
  overlap?"* It was neither of the interesting ones — it was
  `removePrecombat(...)` with the **list entry left in place**, and that entry
  was gated on a proc with nothing to do with the thing being tested. **A delta
  without its comparand is not a measurement, it is a number**, and the reader
  cannot tell which of three questions it answered.
- **AND A FIGURE CAN GO STALE INSIDE THE SAME ROUND THAT PRODUCED IT.** That
  +24.2 was taken before another change in the same session took Arcane Power
  off the global cooldown — so part of what it priced was a cost that no longer
  existed. Re-measured, it did not reproduce at any fight length. **"A prior
  measurement is true of the build it was taken in" applies to the build you had
  an hour ago**, not only to last month's. When a round ships something that
  changes what an ability costs, re-run the figures that priced that ability.
- **MEASURE A PLACEMENT AT A LENGTH LONGER THAN THE COOLDOWN.** The same
  question answered at three durations gave +4.19, +0.52 and +8.07 — and only
  the longest one is `real`. A cooldown longer than the fight is cast once
  whatever the list says, so at the default duration **every placement
  conclusion is a conclusion about the clock**.
- **AN ISOLATION PROBE MUST REVERT EVERY FILE THE CHANGE TOUCHED**, and must
  print `legalAllocation(...).dropped` beside every figure. Removing three
  points to price a talent once took a capstone with them and reported
  "+62.9 for Predatory Strikes", which was three talents.

**AND A ONE-SHOT STRING REPLACE IS UNSAFE WHEREVER THE STRING IS NOT UNIQUE.**
Count the matches and refuse unless there is exactly one — the Rogue's Slice and
Dice entry is textually identical in all three of its lists, and twelve cells of
a sweep came back identical to the decimal because the patch landed in the wrong
one. **Two variants that agree exactly are a patch that did not apply**, because
a change worth nothing still shifts the RNG sequence.

---

## Step 5 — The loop

**ONE PASS IS: Step 1, then dimensions 4 → 5 → 6 → 3 → 7, then Step 1 again.**
That order follows the knock-on, which is the owner's own reason for calling
this a loop:

```
   talents  ──▶  changes which abilities exist, so the APL and the opener change
   opener   ──▶  changes what the fight opens with, so the APL's early entries change
   APL      ──▶  changes which resource binds, so the enchants and consumables change
   enchants ──▶  changes the stat weights, so the next pass's enchant answer changes
   consumables ─▶ changes which pool runs dry, so the APL's gates change
```

**MEASURE THE WINNERS TOGETHER IN A `Combined` GROUP** before shipping. Two
winners measured separately against the same baseline do not add, and they can
**invert**: gating the Firelock's Life Tap made the build genuinely mana-bound,
so the Major Mana Potion beat Spellblasting measured **alone** (+33.0 against
+18.4) and lost to it measured **paired with the Demonic Rune** (+38.5 against
+41.5). A category that is not exclusive with another makes a second source of
the same pool redundant.

**AND WHEN A LOOP CHANGES WHAT A LIST CAN REACH, RE-READ THE COMMENTS ON THE
ENTRIES AROUND IT.** A measurement in a comment expires exactly the way an
`unmodelled` reason does — Battle Shout sits in four Warrior lists carrying
"+11.83 DPS", measured before raid buffs were selected rather than assumed, and
the entry's own condition now refuses it for the whole fight.

**STOP WHEN A PASS SHIPS NOTHING.** Report the negative results: *"every
alternative loses"* is the useful half of an answer, and four of the Arcane
round's five dimensions said exactly that.

---

## Step 6 — The dimensions

### 6.2 Gear — nothing to do but verify

Fixed by the brief. Confirm Gate C and move on. A variant that changes an item
is out of scope, and the helper set cannot express one.

### 6.3 Enchants — settle them with arithmetic, not fights

```bash
PROFILE=<id> PLAN=1 npx vite-node tools/stat_weights.ts      # ~4s, no fights
PROFILE=<id> npx vite-node tools/stat_weights.ts             # ITERATIONS=3000 default
PROFILE=<id> ITERATIONS=500 STATS=spellPower,critRating,hasteRating npx vite-node tools/stat_weights.ts
npx vite-node tools/enchant_report.ts                        # all 28 profiles' current loadouts
```

**MOST ENCHANTS ARE PURE STATS, SO THE STAT WEIGHT TABLE ANSWERS THEM WITHOUT A
FIGHT.** `+8 Intellect` against `+1% Haste` on a head slot is
`8 × weight(intellect)` against `2 × weight(hasteRating) / 2` — read off one
table, for every slot at once. Twenty stats are weightable: the five primaries,
`attackPower`, `rangedAttackPower`, `spellPower`, `hitChance`, `critRating`,
`hasteRating`, `armorPenetration`, `dodgeParryReduction`, `blockValue`,
`manaPer5`, `armor`, `defenseSkill`, `dodgeChance`, `parryChance`, `blockChance`.

**THE EXCEPTIONS NEED A PAIRED FIGHT** because they are not stats: **Crusader**
and **Revelation** (procs), the ranged **+2% Crit Chance** (an
`attackTableModifiers` entry the owner ruled must not reach the pet), **+60
Armor**, **Minor Speed**, and both threat enchants. Four enchants do nothing at
all and say so in their own `unmodelled` entry — healing power, threat in both
directions, and Minor Speed.

**CHECK THE LADDER BEFORE BUYING HIT**, and distrust it — see Appendix B. A
melee or ranged build has **no miss floor** and a usable cap of **8**, so the
ninth point buys a non-dual-wielder literally nothing; a dual-wielder takes the
+19% penalty in full on both hands and still collects. Spells miss on a flat
**17%** floored at **1%**, so the usable spell cap is **16** — arriving by two
routes, only one of which the ladder folds.

### 6.4 Talents — find the forced points first

**MOST TREES HAVE ALMOST NO FREEDOM, AND ESTABLISHING THAT IS THE FIRST
RESULT.** Both Warrior damage trees turned out completely forced; BM Hunter's
entire design space is **two points**. Work out what is forced before writing
variants:

1. Tier gates — `pointsBelowTier`, counted **strictly below**.
2. `requiresRanks` — three of the Warrior's seven prerequisites want the **full**
   rank, so points below a wanted talent are held hostage.
3. The capstone's tier, which usually fixes 30+ of the 51.

What is left is the spare points, and there are only three questions about them:
**is a maxed talent in the majority tree still unbought** (usually no); **do the
spare points do more outside the majority tree** (the Arcane Mage's eleven Fire
points are **+49.9** against moving them, because the Arcane talents they would
buy do nothing); and **is a point dead but immovable**.

**AND A FOURTH, WHICH IS NOT ABOUT THE POINTS AT ALL: READ WHAT EACH TALENT IN
THE TREE ACTUALLY DOES AGAINST WHAT THE CODE SAYS IT DOES.** The Elemental
Shaman's Mindfulness is "Allows 17/33/50% of your Mana regeneration to continue
while casting" and was declared `scope: 'threat'`, reason *"Threat, which the
engine does not track"* — which is the tooltip of `natural_grace`, **one talent
across in the same tier**. The two had each other's rulings. The owner's own
spread spends 3 points there; an earlier round moved them out on that reason and
measured **+2.95 ± 0.63** for the move, which was correct arithmetic on a talent
that did nothing.

**A `scope` TAG IS THE WORST PLACE FOR THIS, because its whole purpose is to
stop anybody looking again** — a ruled-out effect is deliberately kept out of
the live-gap list and shown apart in the Talent panel. So the census that exists
to find unfinished work had nothing to report, exactly as it had nothing to
report when Nature's Reach lost 4% hit the same way. Restoring it and buying
Convection with five dead points is **+84.08 ± 2.84** at 180s.

**SO AN OPTIMISATION PASS READS THE TREE'S DECLARATIONS, NOT ONLY ITS
ALLOCATION.** It is the same read as Step 1's sixth — `triggersGcd` against what
the spell is — pointed at talents, and like that one it is reading rather than
running. Two cheap checks that would each have caught this:

- **grep the class's effects file for `scope:` and read every tagged talent's
  tooltip beside its reason.** A reason that is a different talent's sentence is
  visible in one pass.
- **compare the shipped spread against the owner's own**, which the variant file
  usually still carries as a control. A point the owner spent and a later round
  moved is the first thing to re-ask, because the move had a reason and reasons
  expire.

**A DEAD POINT'S DESTINATIONS CAN BE PROVABLY EQUALLY DEAD** — Enrage 2, Blood
Craze 2 and Booming Voice 2 each ran **bit-identical fights**, so the choice is
legibility and the smallest edit wins. Say which it is, because an identical
triple is normally this project's tell for a patch that did not apply.

**AND RE-READ THE TOOLTIPS OF THE SPELLS THE TREE FEEDS.** Three rounds of
Arcane APL work treated Arcane Blast as a filler after a patch had redesigned it
into a maintenance buff. A talent spread is a claim about what the spells do.

### 6.5 Pre-combat — what can be bought for free

Pre-combat mode skips **three** things the fight would charge for: the global
cooldown the action would start, the swing reset, and the cast time. The mana is
still spent and the cooldown still runs.

**AND A PRE-CAST CAN GO FROM "NOISE" TO A CLEAR LOSS WHEN THE GCD FLAG IS
FIXED, WHICH IS THE RETRACTION POINTING THE OTHER WAY.** Pre-casting the Fire
Mage's Combustion measured **-4.69 +/- 10.91 (noise)** while the ability paid a
global cooldown and **-36.38 +/- 5.52 (`real`)** once the owner ruled it off --
because the saved GCD was the only thing offsetting a three-minute window burned
at t=0 on a target with no debuff stacks. Same lesson as Arcane Power's +24.9,
same direction of error, opposite sign: **the GCD flag is part of what a
pre-cast is worth, so price the pre-cast AFTER the flag is right.**

**SO A COOLDOWN IS A CANDIDATE TO MOVE HERE** — a 15-second window opened at a
**0s** lead is the same window the fight would get, bought for no global
cooldown. `elemental_mastery` is **+13.9** on exactly that argument. A **0s lead
on an instant is the safest edit in this whole document**: it cannot fail B2,
and B1 is satisfied as long as the action is not damaging.

**BUT THE ARGUMENT IS WORTH LESS THAN IT LOOKS, AND THIS IS WHERE IT WAS
OVERSOLD.** `arcane_power` was cited here at **+24.9** and the figure is
**retracted**: most of what it bought was a global cooldown the ability should
never have been paying (Step 1's sixth read), and once that was fixed, pre-casting
it measured **+4.19 ±6.81 at 60s and −8.07 by 300s**. **Pre-casting is only worth
the GCD it saves, so it is worth nothing on an ability that is correctly off the
GCD already** — and it *costs* something on a cooldown short enough to come back
inside the fight, because the window is burned before the build is at full
strength. **Check the GCD flag before pricing a pre-cast**, or the measurement
prices a bug.

The lead has **four** observable consequences, and treat that list as open
rather than closed: an aura it applied has N seconds less left; its cooldown
comes back N seconds sooner; regeneration is credited across the lead; and the
five-second rule is stamped where the spend happened. **A buff moved here with a
long lead can therefore expire before it is useful.**

`addPrecombat`, `removePrecombat` and `precombatLead` are the helpers. A
**channel is refused** outright. Every candidate goes through Gate B.

### 6.6 Combat APL — the meat, and the dimension that keeps getting skipped

**THIS IS THE ONE THAT WAS SKIPPED ON FOUR OF SIX PROFILES.** Budget most of the
pass here, and start from Step 1's resource answer.

The complete lever set — nineteen condition kinds plus four entry fields, so
there is no excuse for "the list had nothing to try":

```
  aura   auraTime   auraStacks            buff/debuff presence, seconds left, stacks
  resource   resourceFraction   comboPoints          pools and gates
  cooldown   cooldownTime                 ready/on-cooldown, and seconds left as a clock
  health   fightElapsed   fightRemaining   phase and forecasting
  swingIn   swungWithin   castsInstantly   timing
  hasReaction   builtin                    what the build has; the escape hatch
  all   any   not                          composition
  ---
  condition   interruptsChannel   disabled   sequence        on the entry itself
```

Ten structural facts, each of which has produced a wrong list here:

- **AN UNGATED, ALWAYS-CASTABLE ENTRY IS A FLOOR UNDER EVERYTHING BELOW IT.**
  The Rupture Rogue's six-entry list was really three. **Both halves matter**:
  Sniper Shot moved below an ungated Arcane Shot still fires twice a fight,
  because Arcane Shot's own six-second cooldown lets the list fall past it.
- **AND THE SAME RULE UPSIDE DOWN — A CHEAPER ENTRY STARVES AN EXPENSIVE ONE
  FROM BENEATH, HOWEVER HIGH THE EXPENSIVE ONE SITS.** Ambush sat **second** and
  could not be cast, because a 35-energy Hemorrhage sat seventh and took the
  pool every time it passed 35. **Priority does not reserve a resource.** The
  fix is a condition on the **cheap** entry, not a reorder.
- **READ COSTS OFF THE BUILT CHARACTER, NOT THE ABILITY DECLARATION.** The Cat's
  Claw fired zero times at any energy because Improved Shred takes Shred to 42
  and Ferocity takes Claw to 42 — the fallback costs the same as the thing it
  falls back from.
- **A REFRESH WINDOW CLIPS.** Refreshing a debuff at two seconds left throws the
  remainder away, so a **haste buff can measure as a loss**: Nature's Grace cost
  the Moonkin 14.9 DPS doing nothing but speeding it up. The owner's lists say
  *"if not active"* instead, and that one word was the Elemental Shaman's entire
  +16.4.
- **AND THE CLIP IS NOT ALWAYS THE EXPENSIVE MISTAKE, SO SWEEP THE WINDOW RATHER
  THAN SHRINKING IT.** The Fire Mage's Scorch window swept 2s **-13.70**, 3s 0,
  4s +6.56, 5s **+9.74**, 6s **+9.84**, 8s +8.63 — the peak is on the side the
  clip argument says to avoid, and a two-point comparison at 3s and 1s would have
  concluded "keep 3". What decides it is what a LAPSE costs: Fire Vulnerability is
  five stacks on 84% of that build's damage and losing it costs five Scorches to
  rebuild, so a wide margin is insurance and a tight one is a gamble against a
  2.5-second filler being in flight. **Ask what the aura costs to REBUILD before
  assuming the clip is what matters**, and expect the curve to turn over on both
  sides.
- **A HOLD POINT NEEDS THE FINISHER'S TABLE CHECKED FIRST.** `EVISCERATE_BY_COMBO_POINT`
  is 278/448/618/788/958 — 278 for the first point and 170 for each after — so
  damage per point **falls**. "Hold for the maximum" is a rule about a
  *proportional* table. And a bleed has **two** tables: Rupture's durations
  8/10/12/14/16 slope the same way.
- **THE SAME ABILITY WANTS DIFFERENT THRESHOLDS IN TWO LISTS OF ONE CLASS.**
  Eviscerate peaks at **two** points on Combat and **five** on Rupture, because
  on Subtlety a point taken by Eviscerate is a point Rupture needed. Do not
  normalise a threshold across lists.
- **A GATE CAN BE WORTH POSITIVE DPS** when the ability **grants** a resource.
  Gating the Cat's Shifting Power at `energy <= 50` made the list cast it less
  and collect more, **+13.2** — the ungated version wasted 40 energy a fight and
  the reliable waster is the pull, since every fight opens on a full bar. Read
  `wasted` on the `resource_gained` event.
- **A NEW ENTRY GOES AT THE BOTTOM** — the only position that cannot change what
  the list already does. Except a **free off-GCD cooldown**, which goes
  **second** (a list with anything castable never falls to the bottom: five of
  seven profiles never cast their racial there), and **last in a tank list**, so
  nothing delays a survival cooldown.
- **AN EVENT COUNT READS BOTH WAYS.** More events for an identical log is pure
  cost. **Fewer events with more casts is an actor that is idle less** — putting
  Hamstring at the bottom of 2H Arms took a fight from 33 casts and 351 events
  to 42 casts and 247, and that is the cheapest available proof that a filler is
  filling something. It is also what separated the same entry being **+26.74**
  on 2H Arms and **-33.25** on DW Fury.
- **A DUPLICATE ABILITY ID CAN BE CORRECT** — gated on a proc above and ungated
  as the filler below. Two Mage and Warlock lists do it on purpose.

**AN ENTRY THAT NEVER FIRES IS NOT A DEAD ENTRY UNTIL YOU HAVE CHECKED IT
AGAINST THE CLOCK.** Two entries can look identical in the uses column — both
0.00, both apparently redundant with a pre-combat action — and be completely
different things:

| | why it reads 0.00 | verdict |
| --- | --- | --- |
| Mage Armor | a **thirty-minute** buff, pre-cast at a 3s lead | genuinely dead. **No fight length brings it back** |
| Arcane Power | a **three-minute** cooldown, pre-cast at t=0 | **not dead.** 1.40 casts at 180s, 2.00 at 240s |

**THE OWNER CAUGHT THIS AS A WRITE-UP ERROR**: *"arcane power being pre-cast
doesn't remove it from the main combat APL because the moment a combat run
exceeds 3 minutes it'll want to be cast a second time."* The entry had been
flagged as dead "for the same reason Mage Armor was", which was a fact about
the **clock** written down as a fact about the **list**.

**SO THE TEST IS ONE COMPARISON: the ability's cooldown (or its buff duration)
against the fight length.** Shorter than the fight means the entry is
load-bearing and a longer fight will reach it; longer than any fight you will
ever run means it is genuinely redundant. Count the casts at a longer
`DURATION=` before removing anything.

**A SEQUENCE IS A GUARANTEE; ENTRIES THAT FIRE TOGETHER ARE AN ACCIDENT.** When
several entries always go off as a group, that holds only while nothing between
them is castable — and **your own change can create or destroy that in the same
round**. Three Arcane entries emerged as a stack only because all three were off
the global cooldown, and two of them became so in the same commit. Writing them
as one `AplEntry.sequence` measured **bit-identical** and was still worth doing,
because the old shape would have come apart silently the moment anything above
it took a global cooldown. **Measure it as neutral and ship it as structure.**

**AND WHEN YOU ADOPT AN APL FEATURE, CHECK THE REPORTING UNDERSTANDS IT.**
`printUses` keys on `abilityId`, so the moment the stack shipped, every
sequence *step* vanished from the numbered list and fell into **"not in the list,
and still dealing damage"** — the one heading there that means nobody asked for
this damage. A new feature's first bug is usually in the thing that reports it.

**ISOLATE A LOSS; DO NOT BLAME THE OBVIOUS SUSPECT.** The owner's Venom list
measured -24.3 and the suspect was its Venom entry, which three earlier
placements had each measured as a loss. Removing that entry dropped the list
further — Venom is **+17.7** there, and the whole -24.3 was two aura-duration
floors on Eviscerate. **A prior measurement is true of the list it was taken
in**, and *"a point spent on Venom is a point not spent on Eviscerate"* stops
holding when Eviscerate cannot fire.

**AND A MEASUREMENT THAT REMOVES ONE ENTRY CAN SILENTLY REMOVE ANOTHER.** Wrack
is gated on three bleeds having six seconds left, one of them Siphon Life — so
removing Siphon Life's entry took Wrack from 5.7 casts to **zero**, and the
profile read like a clean -24.1 when the honest figure was -13.6. **When an
entry names an aura, grep for who else reads it before measuring its removal**,
and read the `USES=1` column, which is where the zero shows.

**A LIST CAN CHANGE COMPLETELY AND BE WORTH NOTHING.** Combat's Eviscerate went
from 1.1 casts a fight to 9.0 for **+0.6**. The uses column says whether the
list changed; the DPS says whether it mattered.

**THE OWNER'S LIST OUTRANKS A MEASURED DECISION OF OURS, AND THE MEASUREMENT
STAYS.** Hunter's Mark measures **-10.1** in the melee list and the owner's list
names it, so it is in and -10.1 is the price of that choice. A test that pins a
rotation decision gives way when the decision changes owner; one that pins an
invariant does not.

### 6.7 Consumables — twelve stat rows and two action rows

```bash
npx vite-node tools/consumable_report.ts              # all 28 profiles' rows
npx vite-node tools/probe_consumable_choice.ts        # every mid-fight candidate, with its CASTS
npx vite-node tools/probe_other_assignment.ts
```

**AT MOST ONE PER CATEGORY, AND THE EXCLUSIVITY IS STRUCTURAL** — a selection is
a map from category id to consumable id, so holding two from one category is not
representable. **The categories are not exclusive with each other**, which is
why no mana potion is selected anywhere: the Demonic Rune covers mana from
`other`, leaving `potion` free for something that hits.

**THE TWELVE STAT ROWS ARE STATS AND NOT AURAS**, so they are a layer of the
starting stat block — which means **the stat weight table settles them the same
way it settles enchants**, with no fight. Flask, weapon effect (main hand and
off hand **separately** — a dual-wielder coats two weapons), strength, agility,
attack power, blasted lands, mana regen, hit points, armor, spell power, school
spell power, food.

**THE TWO ACTION ROWS NEED FIGHTS**, because `potion` and `other` carry an
`Ability`, join the ability book, and get an APL entry — so **when** to use one
is a decision, and `syncDefaultRotation` puts the entry in the list for you. The
written-down rule, measured rather than derived: **`other` takes the pool the
build runs out of and `potion` takes the damage buff.**

**THE SELECTION RULE FOR THE TWELVE:** take every category the build can
actually read, choose within a category by what the build scales with, and leave
empty only what is worth literally nothing. **Two things decide it and both are
measured, not guessed:** the conversion table (a Cat Druid takes **strength**
where a Rogue takes agility, because a Druid is 2 attack power per strength) and
the measured damage **school** (the Moonkin is 71% arcane, the Frostfire Mage
62% fire, the Elemental Shaman 56% nature).

**A ROW WORTH NOTHING IS NOT THE SAME AS A ROW THAT SHOULD BE BLANK** — the
owner gave 2H Arms and DW Fury a Healthstone that fires 0.00 times.

---

## Step 7 — Closing a pass

```bash
npm run typecheck
npm test
USES=1 SEEDS=3 PROFILES=<id> npx vite-node tools/measure_profiles.ts
```

**DO NOT RE-BASELINE.** The owner's standing instruction: *"don't deliberate so
much over baselining. I'm already doing that and tell you what to implement ...
often times we're wasting hours a day re-baselining profiles."* So a pass is
implement, typecheck, test, `USES=1`, commit, PR. The `USES=1` pass stays
because it is seconds and it catches the entry that cannot fire. **Measure only
when the change itself raises a question a figure answers, and say what was NOT
measured rather than measuring to be safe.**

**IF YOU RAN ISOLATION PROBES, RE-RUN THE PROFILE AFTERWARDS AND CHECK IT
REPRODUCES TO THE DECIMAL.** Five hand-reverted probes in one round is five
chances to leave one in, and the only thing that says you did not is the figure
coming back identical.

What to write down, in the commit and in `HANDOVER.md`:

- **the figure with its interval and iteration count** — a figure without them
  is a rumour;
- **one row per dimension, including the dimensions that did not move.** A
  dimension with no row is indistinguishable from a dimension that was skipped,
  and the owner cannot tell which. *"Every alternative loses"* is a row;
- **the negative results**, which are usually most of the round;
- **every question the round raised**, in `HANDOVER.md`'s table — a question
  nobody can find is a question nobody answers;
- **a table a row can be added to**, and the round each figure belongs to.

**AND DO NOT NARRATE INTENT.** *"I'll continue without going dark"* was followed
immediately by going dark. The only things that read as progress are a tool
call, a figure or a commit.

---

## What the loop cannot find, and why an audit still finds it

**THE FIRST PROFILE RUN THROUGH THIS PROCEDURE WAS THEN AUDITED BY THE OWNER,
WHO FOUND FOUR THINGS IT HAD NOT.** They are worth reading together, because
they have one cause:

| what they found | what the loop did instead |
| --- | --- |
| a dead `mage_armor` entry | `USES=1` reported it as **1.0 uses** — the pre-combat cast, counted against the entry |
| two cooldowns wrongly **on** the GCD | nothing asks whether an ability is *configured* right |
| the cooldown stack | no measurement proposes a shape nobody wrote |
| the one-minute clock | every tool defaults to it, so it is in the baseline **and** in every variant |

**EVERY ONE IS AN ASSUMPTION THE HARNESS TAKES AS GIVEN.** A paired probe
measures a *variant against a baseline* — so anything true of both sides
cancels and becomes invisible. The clock cancels. An ability's GCD flag cancels
until something changes it. A list's *shape* cancels, because a variant can only
reorder, add or remove the entries somebody already thought of.

**SO THE PROCEDURE IS SOUND AND INCOMPLETE IN A PREDICTABLE PLACE**, and the
answer is not more variants. It is to read these by hand, once per pass, because
no amount of measuring reaches them:

1. **The clock.** Is the fight longer than the cooldowns in the list? Run
   `npx vite-node tools/probe_clock.ts` — which prints the mana book, the cast
   counts and the uptimes at four lengths at once — or `DURATION=` on
   `probe_build.ts` for a paired figure. Note what the build is *bound by* at
   each length: the Arcane Mage is GCD-bound at 60s with 2,638 mana spare and
   **mana-bound by 300s**, which is a different optimisation problem wearing the
   same name.
   **AND THE ELEMENTAL SHAMAN IS THE SHARPEST CASE YET, WHERE THE CLOCK DID NOT
   JUST RE-PRICE AN ANSWER BUT FALSIFIED A WRITTEN-DOWN FINDING.**
   `shamanVariants.ts` carried, in capitals, "THE ELEMENTAL BUILD IS CAST-BOUND
   AND NOT MANA-BOUND, WHICH IS THE FINDING THAT RULES OUT HALF ITS TREE" --
   measured honestly at 60s, where the build has 14.3% mana headroom. At 180s it
   has **1.3%** and its DPS has fallen **802 → 546 → 465**: it spends the whole
   pool in the first minute and then stands still. Convection 5/5 went from
   **-0.18, noise** to **+19.05 ± 2.35**, and three further answers inverted
   outright — the Major Mana Potion from **-13.33 to +75.77**, removing the
   Searing Totem entry from **+8.12 to -52.74**, removing the Lava Burst entry
   from **-5.51 to +6.97**.
   **A REGIME CLAIM IS A CLAIM ABOUT A CLOCK**, and because the clock is applied
   to the baseline and to every variant alike it can never appear in a verdict.
   So when a round writes down which resource binds, write the length beside it.
2. **The declarations.** `triggersGcd`, `cooldownMs`, `castTimeMs`, the cost —
   read them against what the spell is *supposed* to be. This is reading, not
   running.
3. **The pre-combat/APL overlap.** For each entry that looks redundant with the
   opener, compare the ability's cooldown to the fight length before calling it
   dead.
4. **The shape.** Which entries always fire together, and is that a guarantee or
   an accident?

**AND THE OWNER'S READING HAS NOW BEATEN THE TOOLING FIVE TIMES** — the hit
ladder, parry haste's direction, a proc rate at half its value, Crusader on a
feral Druid, and this audit. **Every one was a case where the tools were working
correctly on a question nobody had asked them.** Put the rates, the cast counts
and the declarations in front of them, not just the DPS.

**ONE FIGURE-HYGIENE RULE CAME OUT OF THE SAME ROUND AND BELONGS HERE.** Never
write a number you have not measured — not in a comment, not as a placeholder,
not as an estimate you intend to replace. Two went into source in that round
before being caught: a revert cost written as `-162.5` before it was measured
at **-96.5**, and a buff uptime written as `31.4%` before it was read at
**32.2%**. Both read exactly like findings. **If the measurement has not run
yet, leave the sentence unfinished.**

## Appendix A — the 28 openers against Gate B

Audited at commit `c147ec0`. **Arithmetic only, by the recipe in Gate B** — no
fight reveals any of this.

**ALL THREE OF THOSE PROFILES ARE NOW FIXED -- `mage_arcane`, `mage_fire` AND
`mage_frostfire`** -- each in its own run of this procedure, and each at a real
cost: **-96.5 +/- 9.4**, **-24.23 +/- 4.29** and **-25.90 +/- 9.70**, which is
the honest price of the ruling. (Two branches fixed the last two concurrently,
and each one's text said the other still failed; the merge is what made all
three true at once.)

| profile | damaging actions | verdict |
| --- | --- | --- |
| `mage_arcane` | ~~`pyroblast` -7.618s, `arcane_blast` -6.029s, -4.529s, -3.029s~~, `arcane_blast` -0.029s | **FIXED.** Now one damaging cast, the owner's own, at the haste-rounding boundary |
| `mage_fire` | `fireball` -0.059s, ~~`scorch` -0.029s~~ | **FIXED** in round 28. One damaging cast, the owner's own, at the haste-rounding boundary; the revert cost **-24.23** and the loop recovered **+17.74** of it |
| `mage_frostfire` | `frostfire_bolt` -0.049s, ~~`scorch` -0.029s~~ | **FIXED in round 32.** The project's `scorch` addition is reverted for **-25.90 +/- 9.70**, and nothing legal replaces it |
| `shaman_elemental` | `lightning_bolt` -0.039s, `flame_shock` 0.000s | **FAIL — two, and BOTH ARE THE OWNER'S OWN LINES.** A question for them, not an edit |

**AND A FIXED OPENER'S REMAINING DESIGN SPACE CAN BE EMPTY, WHICH IS A ROW
RATHER THAN A SHRUG.** On `mage_frostfire` the revert was not recovered at all:
an addition has to be a NON-damaging action, and that build's only non-damaging
castables are Mage Armor (already in the opener), Evocation (a channel, refused
outright) and two things **already off the global cooldown** — a potion and the
Gnome racial. Both measured **BIT-IDENTICAL** at a 0s lead, which is *pre-casting
is only worth the GCD it saves* measured rather than asserted. **Print each
variant's precombat list before the fights**, or "identical" cannot be told from
a patch that did not apply.

**AND THIS APPENDIX WAS DOING ITS JOB AS A RECORD WHILE NOTHING ACTED ON IT.**
`mage_frostfire` sat here as a known failure for a release, audited and written
down. **A known-failing row is work, not documentation** — so when a round
names a profile that appears in this table, the revert is the first thing it
does, before any dimension is measured.

**`shaman_elemental` WAS RE-AUDITED IN ITS OWN OPTIMISATION ROUND AND STILL
FAILS, UNCHANGED.** The round added nothing to that opener and moved nothing in
it: both damaging casts are the owner's lines, so the ruling has to bend or one
of the two has to move, and neither is this project's call. Both are also
load-bearing at the published clock -- removing either is about **-16** at 60s
and **noise** at 180s, which is a figure to quote if the answer is to drop one.

**AND THE GATE COST ALMOST NOTHING TO APPLY, WHICH IS THE ARGUMENT FOR IT.**
Reverting the Arcane Mage's four illegal casts took one edit; the loop then
recovered **+13.2 +/- 3.2** of it legally, from a mechanism nobody had looked at
— so the net against the last *honest* figure is positive. **A gate is not a tax
on the optimisation; it is what stops the optimisation measuring a fiction.**

The other twenty-four pass, and the interesting passes are the ones a careless
checker would fail:

- **the three Paladins and Prot Pally** — `judgement` at 0s is the one damaging
  action; the seals and `holy_shield` above it deal nothing when cast;
- **`druid_bear`** — `maul` is `onNextSwing` and merely armed, so `mangle` at 0s
  is the only damaging action;
- **`lw_melee` / `hawk_melee`** — `raptor_strike` is armed, `strider_kick` at 0s
  is the one cast;
- **`bm_hunter` / `lw_ranged`** — `aimed_shot` at a 2s lead and `sniper_shot` at
  4s both finish at **exactly 0.000s**, because a Hunter carries no haste here;
- **the five haste-rounding rows** — `druid_moonkin` (-0.029s),
  `warlock_smds` (-0.096s), `warlock_firelock` (-0.039s),
  `shadow_priest` (-0.029s) and the single-cast Mage rows above. Every one has
  `lead == declaredCastTime`, so each is the owner's transcription meeting haste.

**TWO THINGS ARE NOT GATE B FAILURES AND ARE STILL OPEN:**

- **`searing_totem` at a 1.5s lead on both Shamans** applies a ticking damage
  effect before the pull. It deals nothing *at the cast*, and its DoT does not
  declare `accruesBeforeCombat`, so **the simulation delivers no pre-pull tick**
  — the aura is merely 1.5s older. Whether the real game would have started
  combat is `HANDOVER.md`'s open question. Added by this project.
- **`rogue_venom` has no opener at all**, where its three siblings do.

---

## Appendix B — tool caveats that change an answer

**AND A STAT WEIGHT IS A SLOPE, WHICH IS ONLY AN ANSWER IF THE FUNCTION IS
MONOTONE.** `stat_weights.ts` adds ONE positive step per stat and divides. On
the Elemental Shaman that reported `Haste  2%  -30.24  -15.1180  +-0.7663` at
180s -- a large, statistically solid, **wrong-signed** weight. A paired swap
taking the same 2% back *off*, through the two enchants that grant it, measured
**-22.58 +/- 3.31**. Both directions lose, which no slope can express.

Swept finely in both directions at 60s (`tools/probe_stat_sweep.ts`):

```
   -20     -10      -2      -1      +1      +2     +10     +20     +40
 -12.04   -9.80   -1.01   -0.46   +0.54   +1.12   -4.34   -0.40   +7.74
```

**A SMALL POSITIVE SLOPE WITH A STEP OF ABOUT -10 SITTING ON TOP OF IT.** The
step is a **Searing Totem boundary**: the totem lasts 55 seconds, its
re-application is gated on the aura having fallen off, and whether that last
application delivers any ticks before the fight ends moves with anything that
changes the cast rhythm. Totem ticks read **35.0 at haste ratings 0, 9, 10, 11,
30 and 60, and 37.7 at 19, 20 and 21** -- and 20 is exactly what the build
wears. Per-tick damage is identical at every value, so it is a COUNT and not a
magnitude.

**SO THE PROCEDURE'S OWN RULE -- "most enchants are pure stats, so the stat
weight table answers them without a fight" -- HAS AN EXCEPTION, AND NEITHER
ROUTE RESOLVES IT.** The table is wrong-signed and the paired swap measures the
same artefact. What settles that an enchant question is unanswerable rather than
answered is the sweep: **two directions losing is not a weight.**

**THE CHEAP GUARD IS ONE EXTRA COMMAND.** Before trusting any stat weight large
enough to change a decision, ask for the same stat on the other side of where
the build already sits. It costs one run and it is the only thing that
distinguishes a weight from a discontinuity -- which is this document's own
"sweep a parameter, do not compare two readings somebody wrote down", pointed at
a stat instead of at a threshold.

**AND `stat_weights.ts` NOW TAKES `DURATION=`, WHICH IT DID NOT.** Every weight
it had ever printed was a weight at sixty seconds. On the Elemental Shaman
`manaPer5` and `spirit` both read **0.000, "not measured: the interval swallows
the value"** at the default and are **0.6623 and 0.3613 a point** at 180s, while
Intellect goes 0.1337 to **0.6988** and spell power falls 0.6841 to 0.4647. The
whole table re-sorts.


**THE HIT LADDER UNDERCOUNTS SCHOOL-SCOPED HIT, AND THE WEIGHT BESIDE IT IS THE
ONE TO TRUST.** On `mage_fire`, `stat_weights` prints both of these in one run:

```
  Hit rating — slice by slice:
    Spells                     now   6.00%   to cap +5.00%
  ...
  Hit rating +5.00% → caps Spells    5%   0.00   0.0000   nothing: this build cannot read it
```

**The weight is right and the ladder is wrong.** Hit arrives by **two** routes
and only the character-wide `hitChance` stat goes through `attackChances`; a
school-scoped `hitBonus` is folded in later by `withModifier`. All three Mages
sit at 11 points of school-blind hit against a usable spell cap of 16, and the
missing five arrive as school-scoped hit from a talent — Arcane Focus 5/5 or
Elemental Precision 5/5. So the Fire Mage's own schools **are** capped, its
`avoid` column reads 0.8-2.2% against a 1% floor, and the five points of
"headroom" the ladder offers would buy nothing.

**So read the `avoid` column on `probe_profile_report` before buying hit**, and
treat a `nothing: this build cannot read it` verdict on a hit rung as the
answer rather than as a contradiction. This is CLAUDE.md's own *"a floor on one
route is a floor the other walks around"*, pointed at the ladder.

**AND `USES=1`'s "BEFORE THE PULL" BLOCK SHOWS WHOLE-FIGHT CAST COUNTS**, so it
can neither confirm an opener arrived nor flag one that did not. Use
`tools/verify_opener.ts`.

**AND `rotation_fingerprint.ts` ANSWERS "IS THIS LOG BYTE-IDENTICAL", WHICH IS
THE SAME QUESTION AS "DID ANY DECISION CHANGE" ONLY FOR A CHANGE THAT CANNOT
WRITE A LINE.** An aura applied at the pull writes a line and consumes no random
number, so selecting one more raid buff moved all 84 hashes and that was not a
finding. Say which question you are asking before offering a hash as a
containment check.
