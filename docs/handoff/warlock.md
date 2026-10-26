# WARLOCK DEEP DIVE

**Class:** Warlock
**Profiles:** SM/DS, Firelock, Fire Demo, Sbolt Spam

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## Round 80 -- the second pass, under the owner's round 79 rules

`tools/optimise/warlockVariants80.ts` (`w80*` groups, `FILE=` it). Talents,
race, enchants, stones and stat consumables on `WEIGHTED=1` (49% 1T/120s, 17%
each 3T/60s, 5T/60s, 8T/30s), 300 paired iterations a column; Single Target
lists at 1T/120s and Multi Target lists at 5T/60s with 3T/60s and 8T/30s
checked, 300-600 paired fights a row. **This is a round that can have a round
after it** -- the figures below are this branch's, before any merge.

### Before and after (`tools/full_report.ts`, 300 fights a cell)

| | 1T 120s | 3T 60s | 5T 60s | 8T 30s | weighted |
| --- | --- | --- | --- | --- | --- |
| SM/DS | 808.1 -> **806.4** | 1338.1 -> **1324.3** | 1822.6 -> **1833.4** | 2458.8 -> **2537.2** | 1351.3 -> **1363.2** (+11.9) |
| Firelock | 877.5 -> **873.5** | 1219.2 -> **1321.3** | 1816.9 -> **1863.1** | 2870.3 -> **3019.6** | 1434.1 -> **1482.7** (+48.6) |
| Sbolt Spam | 834.5 -> **834.6** | 1142.1 -> **1142.1** | 1570.2 -> **1570.2** | 2270.0 -> **2270.0** | 1255.9 -> **1256.0** |
| Fire Demo | 1021.6 -> **1013.9** | 1346.1 -> **1374.4** | 1890.5 -> **1922.3** | 2936.0 -> **3057.1** | 1549.9 -> **1577.0** (+27.0) |

### What shipped

| profile | change | figure |
| --- | --- | --- |
| SM/DS, Firelock, Fire Demo | **Troll** (Human is no longer allowed) | weighted +11.05 / +32.17 / +23.13 over Human; Orc +2.06 / -2.79 / +3.91, Undead -0.65 / -2.04 / -1.31. Troll costs 4-6 DPS at 1T and pays at 8T (Berserking under a 30s Hellfire fight) |
| all four | the racial cooldowns in the **Multi Target** lists (they had none) | narrowed by race, so only Berserking reaches these builds |
| all four | **Primary + Secondary Potion** (Spellblasting and Major Mana) with list logic | below |
| Firelock | Multi Target Immolate walked over up to 4 targets at <= 4 | **+75.70 +/- 4.66 at 3T**, nothing at 5/8 |
| Fire Demo | Multi Target Bane of Agony on the boss at <= 4 targets | +4.58 +/- 1.79 at 3T (-2.55 at 5T ungated) |

**THE POTION PAIR.** The two share the two-minute cooldown, so in a 120s fight
exactly one is drunk and the entries decide which:

| profile | Single Target list | Multi Target list | figure |
| --- | --- | --- | --- |
| SM/DS | Spellblasting at the pull; mana potion under 30% | Spellblasting at the pull; mana under 50% after 60s | every mana logic lost at 120s (-1.6 to -5.9); mana-only -18.5 at 5T |
| Firelock | mana under 30%, else Spellblasting in the last 30s | Spellblasting at the pull | ST identical fights (the build always dips under 30%); MT +5.38 +/- 0.02 |
| Fire Demo | mana under 50% after 60s, else Spellblasting in the last 30s | Spellblasting at the pull | ST +4.52 +/- 3.09 (+3.39 at 600 fights); MT +4.66 |
| Sbolt | the owner's sequence drinks Spellblasting at the pull; mana under 50% after 60s below it | the same | identical at 120s and under; reached only in a longer fight |

**THE OWNER'S FIRELOCK POTION LINE GAINED A CONDITION** -- the Spellblasting
entry that opens the list now waits for the last 30s -- on the owner's own
round 79 instruction that the APL decides which potion is drunk when.

**A CONSUMABLE CHANGE INSIDE `inMulti` IS THROWN AWAY.** `setSection` writes
back the lists and nothing else, so a variant that selects a potion inside
`inMulti` measures the old selection with the new entries. The first Multi
Target potion sweep read identical fights on the Fire builds for that reason;
`potionLogic` selects outside and edits inside.

### Every dimension, with the rows that lost

| dimension | SM/DS | Firelock | Sbolt | Fire Demo |
| --- | --- | --- | --- | --- |
| talents (weighted) | every alternative loses: ISB->Bane -9.20, IBoA->ILT -25.44, Imp Drains->ILT -29.42, Soul Siphon -45.24, Pandemic -64.47; Aegis->Energies identical | ILT->Imp Corr -7.07, Cataclysm -8.04, Aftermath -12.93, F&B -13.26 | Imp Voidwalker->Fel Vitality **+8.42 +/- 0.74 (owner's URL, not shipped)**; Agonizing->Cataclysm -26.06 | Aftermath->Cata3+Aft2 -4.74; Suppression->ILT -24.51; Embrace->Energies identical |
| race | **Troll** | **Troll** | Orc kept (owner sequence); see Needs the owner | **Troll** |
| opener | unchanged | Immolate pull (question) -2.55 noise | unchanged | Immolate pull (question) -4.80 |
| ST APL | tap 3% -0.07, 8% -0.73, 12% -5.12; Siphon interrupts Wrack -9.33; no Siphon -8.43; SB above Wrack -7.79; Bane of Doom -16.25; Berserking timing all noise | tap 3% **-39.43**, 8% -1.61; Conflagrate held for Immolate at 12/9/6/3s -5.9/-6.7/-6.6/**-31.4**; Soul Fire -4.6 to -8.7; Searing Pain filler -59.8; Shadow Bolt in the S&F window **-114.3**; Corruption +4.44 to +5.05 (owner removed it); Bane of Doom +8.41 | owner taps 5% -18.26, 15% -6.26; Bane of Doom -13.25 | tap 3% -2.73, 10% -2.72; no Corruption -17.21; Soul Fire outside Decimation -7.91; SB in the Decimation phase -31.84; Immolate "if missing" -11.19; Bane of Doom +8.48 |
| MT APL | Berserking above Hellfire +5.2 at 5T, -11.4 at 3T; DoTs interrupting Hellfire -179/-53/-55; DoTs on 3 not 5 -119 at 5T; DoTs spread at 8 -38; Siphon Life -22.6; tap 2000 -10.8; Rain of Fire at 3T **-271** | Immolate x4 **shipped**; plus Conflagrate held to 3s +4.0 more (noise); Bane walked x3 -612 at 3T; Corruption -55/-125; no Shadowburn -68; no Havoc -200/-347; Berserking above Hellfire -4 to -7 | DoTs interrupting Hellfire -89/-30/-118; DoTs on 3 -81 | Bane on the boss at <=4 **shipped**; Corruption -46/-103; Immolate at 5T -38; Berserking above Hellfire -5.7 at 3T |
| potions | above | above | above | above |
| other consumables (weighted) | Healthstone -4.26; Fire school -22.95 | Healthstone -5.85; Shadow school -12.63 | **Shadow school +22.77 (owner's, not shipped)**; Healthstone -8.37 | Healthstone -6.88; Shadow school -13.21 |
| stone (weighted) | Firestone -13.86, none -32.55 | Spellstone -0.35, none -24.70 | **Spellstone +14.42 (owner's)**; none -20.20 | Spellstone -3.82, none -26.21 |
| enchants (weighted, legal for the slot) | all hold: head/legs Int -7.52, Spirit -9.11; gloves Haste -3.75; weapon SP -24.13; Minor Speed->Stamina and Threat->Agility identical fights | Int -11.54; gloves Haste -0.37 noise | Int -9.69; gloves Haste -3.44 | Int -10.30; gloves Haste -1.69 noise |
| demon | -- | -- | -- | Succubus out, Imp sacrificed **-251.0** |

### Needs the owner

1. **HELLFIRE AND RAIN OF FIRE ARE DESTRUCTION SPELLS IN THE CLIENT AND NOT IN
   `WARLOCK_DESTRUCTION_SPELLS`.** The spellbook capture gives both the
   Destruction tab; the list omits them, so Agonizing Flames, Ruin and
   Cataclysm never reach the spell every Multi Target list is built on. Priced
   by adding the two ids and reverting: Firelock weighted **1482.7 -> 1665.4**,
   Sbolt **1256.0 -> 1364.1**, Fire Demo **1577.0 -> 1759.5**. Not shipped.
2. Firelock **Corruption** above Life Tap: +4.44 to +5.05 at 1T/120s (two
   seeds), against the owner's "no Corruption" instruction.
3. **Bane of Doom** above Bane of Agony (61s+ left): Firelock +8.41, Fire Demo
   +8.48, SM/DS -16.25, Sbolt -13.25 at 120s; with Corruption on the Firelock +17.58.
4. **Sbolt Spam**: Troll with Berserking in the owner's sequence for Blood Fury
   **+19.71** weighted (-8.7 at 1T; Undead -5.25); Shadow school + Spellstone +
   Fel Vitality **+46.01**; all of them together **+63.17**.

### Engine or data notes

- Revelation's crit reaching DoT ticks (round 78's question) is still open and
  nothing here builds on it.
- Death Coil and Drain Life are in the spellbook capture and not declared.

---

## Round 78 -- all four optimised for the full report, and a Multi Target list each

**The objective changed under every earlier figure here.** The report measures
1 target for **120 seconds** and 3/5/8 targets for 60/60/30, so every number
below is at those lengths; earlier sections are 60s figures and dated.
`tools/optimise/warlockVariants.ts` (`wl*` groups, `FILE=` it), 400 paired
fights a row unless said.

### Before and after (`tools/full_report.ts`, 300 fights a cell)

| | 1 target 120s | 3 targets 60s | 5 targets 60s | 8 targets 30s |
| --- | --- | --- | --- | --- |
| SM/DS | 765.0 ±2.5 -> **814.9 ±3.1** | 790.0 -> **1347.0** | 790.0 -> **1834.3** | 834.5 -> **2472.2** |
| Firelock | 868.2 ±3.7 -> **882.8 ±3.9** | 1063.5 -> **1226.4** | 1063.5 -> **1825.6** | 1115.6 -> **2883.5** |
| Sbolt Spam | 837.5 ±6.0 -> **843.7 ±6.0** | 923.8 -> **1150.0** | 923.8 -> **1581.0** | 1004.6 -> **2282.5** |
| Fire Demo | 1008.2 ±3.4 -> **1026.1 ±3.4** | 1101.9 -> **1353.1** | 1101.9 -> **1898.8** | 1150.1 -> **2948.7** |

The 3- and 5-target "before" cells are identical because no Warlock had a
Multi Target list: the Single Target list hit the boss alone at both counts.

### What shipped

| profile | change | paired figure |
| --- | --- | --- |
| SM/DS | Bane 5 -> **Improved Shadow Bolt 5** (Bane only shortens a CAST bolt; this build's bolts are Nightfall instants) | +12.58 ±1.18 at 120s |
| SM/DS | Life Tap gate **15% -> 5%** (`SMDS_LIFE_TAP_MANA`) | +8.63 ±1.16 alone; 3%/7% within a point |
| SM/DS | **Human** for Undead | +5.9 at 120s, +14.9 at 5 targets |
| SM/DS | opener **+ Amplify Curse, Bane of Agony, Corruption, Siphon Life at 0s** (pure DoTs and an off-GCD curse: Gate B legal) | +24.9 at 120s, +94.5 at 5 targets |
| Firelock | **Major Mana Potion** for Spellblasting | +11.25 ±3.41 at 120s; -5.5 at 5 targets |
| Firelock | **Human** | +6.9 at 120s, +9.7 at 5 |
| Sbolt | opener **+ Corruption at 0s** | +8.01 ±6.46 at 120s |
| Fire Demo | **Major Mana Potion** | +14.41 ±3.29 at 120s; -4.5 at 5 |
| Fire Demo | **Human** | +8.7 at 120s, +9.8 at 5 |
| all four | a **Multi Target list** each, `src/profiles/multiTarget/warlock.ts` | see below |

**THE MULTI TARGET LISTS ARE BUILT ON HELLFIRE**, which no Warlock list cast
before: 210 a tick plus 2.2% spell power to every enemy for 15 seconds, the
self-damage healed back. Each list gates on the target count only what the
three encounters disagreed about:

| profile | shape | vs its Single Target list at 5 / 3 / 8 |
| --- | --- | --- |
| SM/DS | Bane + Corruption walked across 5 targets (boss only above 5), Hellfire, Wrack | +940 / +468 / +1380 |
| Firelock | Havoc, **Shadowburn** (Shadow and Flame's +10% Fire feeds Hellfire), Immolate + Conflagrate + Bane on the boss at 4 targets or fewer, Hellfire; Havoc at 0s in the opener | +713 / +160 / +1620, and the opener's Havoc +48 / +9 on top |
| Sbolt | the owner's opening stack, then the SM/DS shape | +602 / +196 / +1181 |
| Fire Demo | Soul Fire, Immolate on every target at 4 or fewer, Hellfire | +793 / +253 / +1792 |

**RAIN OF FIRE LOSES TO HELLFIRE EVERYWHERE** (-104 against the ST list at 5,
-461 at 3 on the Firelock). Walking Immolate across five targets loses to
Hellfire at 5 and 8 on both Fire builds.

### Every dimension, with the rows that lost

| dimension | SM/DS | Firelock | Sbolt | Fire Demo |
| --- | --- | --- | --- | --- |
| talents | ISB 5 **+12.58**; ILT 2 + ISB 3 +8.25; ILT 2 + Bane 3 +0.72 | forced: Cataclysm priced at **-16.84** (the only other home for its 3 points is Intensity) | **withheld**: Improved Voidwalker 3 -> Fel Vitality 3 **+8.05 ±1.08** (owner's URL build) | Cataclysm 3 + Aftermath 2: +0.29 noise -- kept |
| opener | +4 at 0s **+24.9** | nothing non-damaging left in ST; MT +Havoc **+48** | +Corruption **+8.0** | nothing legal (Corruption is a 2s cast here) |
| ST APL | tap 5% **+8.6**; tap 25% -10.2; tap floor 10s -5.4; Siphon interrupting Wrack -3.5 (then -9.4) | tap gate re-swept: 5% stays (3% -44.7, 8% -1.2, 12% -5.7, 20% -9.4; fight floors -6.7/-29.7) | owner's list; a second standalone Spellblasting entry +0.23 -- not shipped | tap 5% stays (all others noise or worse); removing Corruption -15.2 |
| MT APL | above | above | above | above |
| enchants | arithmetic (120s weights): +1% Haste beats +8 Int/Spirit on head and legs everywhere; SP is the only option elsewhere. Revelation **+29.91 -- withheld, see questions** | Revelation -26.2; head Int -5.1 | Revelation -31.5; head Int -7.8 | Revelation -34.8; head Int -4.3 |
| consumables | Mana Potion -6.6 with tap 5% -- Spellblasting stays; Healthstone -3.8 | Mana **+11.25**; Healthstone -12.3 | **withheld**: school Shadow **+29.62 ±0.18**; Healthstone -19.5 | Mana **+14.41**; Healthstone -10.0 |
| stone | Firestone -12.4, none -24.0 | Spellstone -8.5, none -24.9 | **withheld**: Spellstone +7.61 ±5.65 | Spellstone -13.5, none -24.1 |
| race | **Human +5.0**, Orc +4.9, Troll/Gnome noise | **Human +9.5**, Orc +6.6, Gnome +6.4 | withheld: Human +6.55 (owner's Orc, Blood Fury in their sequence) | **Human +7.8**, Gnome +7.6, Orc +6.4 |

A second pass on the shipped builds (Life Tap gates, the potion back to
Spellblasting) shipped nothing: every alternative lost.

### Questions for the owner

1. **REVELATION RAISES EVERY DoT TICK WHILE IT IS UP**, not only "the next
   spell cast". On SM/DS the buff is up 16% of the fight and Bane of Agony's
   tick crit rate goes 23.3% -> 35.9% (Corruption the same), because a tick
   reads the caster's `spellCritChance` at the moment it lands. Worth
   **+29.91 ±4.21** over +65 Spell Power on that profile only. Is a periodic
   tick meant to collect it?
2. **Sbolt Spam's Firelock consumables and stone** are the owner's
   instruction, and the build deals no Fire damage: +40 Shadow Spell Power is
   **+29.62 ±0.18**, the Spellstone +7.61 ±5.65.
3. **Sbolt Spam's Improved Voidwalker 3** does nothing with no demon out;
   Fel Vitality 3 is **+8.05 ±1.08**. Kept because the build is the owner's URL.
4. **Bane of Doom** (one 60s DoT, 1742 + 400% SP) above Bane of Agony while
   61s+ remain, priced by also gating the owner's Bane of Agony line on it:
   Firelock **+10.63**, Fire Demo **+18.01**, SM/DS -13.26, Sbolt -23.42.
   Rewrites an owner line, so not shipped.
5. The three Undead -> Human swaps take Touch of the Grave off the
   presets; two tests that pinned that mechanism on `warlock_smds` /
   `warlock_firelock` now build those presets as Undead explicitly.

---

## Demonology -- the third profile, and the first with a demon out

`warlock_demonology`, 5/31/15: the Imp summoned, the Succubus sacrificed and
kept through **Demonic Pact**, Fire through Searing Pain and Demonic Brand, and
Soul Fire under Decimation in the last 35% of the fight. Everything but the
lists is the Firelock's. HANDOVER's round 40 has the full optimisation pass;
the three things to know before touching it:

- **IT WAS MANA-BOUND PAST A MINUTE UNTIL LIFE TAP WAS HEALED BACK** (round
  41), and that was Life Tap running out of health rather than the build. With
  the group healing every tap a second later, Aftermath 5/5 and Corruption --
  both held in round 40 -- gain at every length and ship. Price a candidate at
  180s anyway: the regime moved once and can move again.
- **DECIMATION IS A 10-SECOND BUFF SINCE ROUND 44**, opened by Shadow Bolt or
  Searing Pain in the last 35% of the fight; it read 100% uptime as standing
  effects. The list's Soul Fire entry reads the buff. The profile is called
  **Fire Demo** now, 2/31/18 with Agonizing Flames 3/3.
- **SOUL FIRE'S COEFFICIENT IS A PLACEHOLDER** and Soul Fire is 12.5% of the
  profile.

---

## Client build 1.60.1.70170 — a rename, and a reordered value row

**NO BUILD CHANGED and both profiles are unchanged to the decimal.** The live gap
count fell to 19 by deletion rather than by work.

**SOUL HARVESTING IS CALLED SOUL HARVEST, AND ITS VALUE ROW WAS REORDERED:**
`[10, 50, 50]` became `[50, 10, 50]`, duration and regeneration swapping places.

**THAT IS HARMLESS HERE FOR EXACTLY ONE REASON** -- the talent's only effect is
`unmodelled` and reads no value at all. An effect with a `valueIndex` would have
started reading a number of SECONDS as a percentage, which is the failure CLAUDE.md
records four times over on the Druid and once on the Priest, and every one of those
reported itself fully modelled while it did it.

**SO THE DIFF TO READ ON A PATCH IS `values/*.json` AND NOT ONLY THE TREES.** A
refresh can reorder a row without changing a number in it, and nothing about the
tree's shape says so.

---


## The one thing to understand first

**EIGHT RULINGS FROM THE OWNER AND SM/DS GAINED 38.1 ON THEM.**
441.5 to **479.7, REAL**, Firelock −0.4, and the other twenty-two profiles
identical to the decimal. Each isolated by reverting it alone over thirty
batches of ten:

| | |
| --- | --- |
| **+23.6** | **Bane of Agony's coefficient is 160% of spell power across the whole effect** — the owner's worked example is `552 + 500 * 1.6 = 1352`, and the twelve ticks reproduce it exactly. It replaces the sheet's 13.3% a tick, which was 1.064 in total |
| **+18.6** | **Amplify Curse**, one point moved out of Suppression, cast once before the first Bane. **Off the global cooldown**, which is what makes it free rather than merely cheap |
| **+6.6** | **Wrack counts as periodic damage for Malediction**, by ruling — a question the data could not answer, because a channel's ticks are CAST ticks and carry no `periodic` flag |
| **+1.7** | **a Nightfall proc is spent by the NEXT action.** Inside the interval on DPS, and the behaviour is not in doubt: Shadow Trance uptime falls 0.082 → 0.049 |
| **+0.4** | **Curse of the Elements counts for Soul Siphon.** Noise, and correctly so — see below |
| **−4.3** | **Siphon Life cannot crit**, the only DoT here that cannot |
| **−7.6** | **the RAMP**, against a flat distribution of the same total |
| **+3.2** | **a channel can be cancelled mid-cast**, which REPLACED Wrack's six-second gate rather than adding to it |

**THE RAMP COSTS DPS AND IS RIGHT ANYWAY.** Back-loading throws away the big
late ticks every time the Bane is re-applied, so a flat distribution of the same
total measures 7.6 higher. It is the owner's data; the figure is the price of
accuracy, not an argument.

**AND IT IS CLASSIC'S SHAPE AT A DIFFERENT RESOLUTION**, which the old caveat
guessed and had no authority to assert: 1/24 : 1/12 : 1/8 is 1 : 2 : 3, and the
flat share over twelve ticks is 1/12 — so the bands are 50%, 100% and 150% of the
average, exactly as Classic's are. **The guess was right and is now sourced**,
which is the happier version of an expired caveat.

### The interrupt rule, which is a new engine capability

**`Ability.interruptibleChannel` + `PriorityEntry.interruptsChannel`, and BOTH
HALVES HAVE TO AGREE** before anything is cut short. Measured off the telemetry
stream over thirty fights: **4.6 interrupts a fight**, caused by exactly the three
ids the owner named and nothing else.

| cut short for | per fight |
| --- | --- |
| `corruption` (fell off) | 1.60 |
| `bane_of_agony` (fell off) | 1.60 |
| `shadow_bolt` (Nightfall procced) | 1.15 |

**IT IS NOT "EVERY ENTRY ABOVE WRACK."** Siphon Life and Life Tap sit above it in
the same list and are NOT interrupters — the positional rule would have been right
about three entries and wrong about two, and the two would have cost channel time
to refresh a bleed that was not about to drop.

**`already_casting` IS WHAT MAKES IT SAFE.** `selectInterrupt` accepts a candidate
only when that is the SOLE rejection reason, so the channel is never discarded for
a cast that then cannot happen — a Corruption that has expired while the Warlock
is out of mana leaves the channel alone.

**A CANCELLED CHANNEL HAS STILL PAID.** 1 interrupt in 138 lands before the first
tick, so its 200 mana buys nothing. That is what starting a channel costs, and the
test says so rather than asserting it away — the assertion originally demanded at
least one tick and failed, which is how the case was found.

**WRACK IS 39.5% OF THE PROFILE NOW** and starts 10.5 channels a fight, averaging
4.2 of 6 ticks. Shadow Bolt is down to 2.0 casts and 5.4% — it is a proc spender
rather than a filler, and **the filler entry at the bottom of the list now fires
zero times**, because an ungated Wrack with no cooldown is a floor under it. Kept,
because it is the owner's and because an entry the walk never reaches costs
nothing.

### Two of the eight measure as noise, and both for good reasons

- **Curse of the Elements, +0.4.** The three bleeds already reach Soul Siphon's
  36% cap, so a fourth counted effect is redundant *while all three are up*. The
  ruling is implemented and becomes load-bearing the moment one drops.
- **The Nightfall entry, +1.7**, inside a ±2.6 interval. The bottom Shadow Bolt
  was already spending the proc reasonably promptly; what the gated entry buys is
  spending it *sooner*, and the uptime figure is the witness rather than the DPS.
  **The owner asked for the behaviour, not for a number**, and it is in.

### "Is Siphon Life worth casting": asked twice, answered twice, and the first answer was wrong

**+15.7 on the re-measure** — 479.7 with its entry, 464.0 without — against +13.6
before the interrupt rule. So it earns its global cooldown either way, even having
lost its crits.

**THE FIRST MEASUREMENT SAID −24.1 AND WAS MEASURING TWO THINGS.** Wrack was gated
on **all three bleeds** having six seconds left and one of the three was Siphon
Life, so removing Siphon Life's entry took **Wrack from 5.7 casts a fight to
ZERO** — an aura nothing applies can never have six seconds left. The honest
figure had to repair the gate first.

**THAT WAS THE SELF-DISABLING SPECIFICATION FOR THE THIRD TIME IN THIS PROJECT**,
after the Seal Twist cycle with no entry point and "Scorch if scorch debuff <= 5"
being always true — and the first time it disabled a DIFFERENT entry from the one
being changed.

**AND THE COUPLING IS NOW GONE RATHER THAN DOCUMENTED.** The gate went with the
interrupt rule, so Wrack fires 10.9 times a fight without Siphon Life and the
question answers itself cleanly. **The best fix for a fragile condition turned out
to be a capability that made it unnecessary.**

---

## The previous deep dive, for context

**FIRELOCK WAS OVERSTATED BY 12.5% AND NOTHING LOOKED WRONG. TWO OF ITS TALENTS
SELECTED A SCHOOL WHERE THE TOOLTIP SELECTS A TREE, AND TWO OF ITS BUFFS RAISED
EVERY SCHOOL WHERE THE TOOLTIP NAMES ONE.**

535.5 → **468.4**, and every one of the four causes carried a comment at the time
admitting what it was doing. The comments were honest; the numbers were not.

| | |
| --- | --- |
| **−42.2** | **Shadow and Flame**, whose two halves name OPPOSITE schools on purpose — "+10% Shadow when Conflagrate hits, +10% Fire when Shadowburn hits". Both were whole-character multipliers, so Firelock held x1.10 **twice on every school** where the talent gives x1.10 once per school. Its comment read "generous for a hybrid, which Firelock is" |
| **−13.1** | **Demonic Sacrifice**, whose Succubus option is "+15% **Fire** damage". Whole-character again, so the 22% of Firelock's damage that is Shadow — Corruption and Shadowburn — collected a fire bonus. Its comment read "exact for either profile", which was true of SM/DS and not of this one |
| **−4.8** | **Agonizing Flames**, "+10% damage to all your **Destruction** spells", read as Fire and Shadow — the two schools a Warlock has, which is every spell it owns, so it also raised Corruption |
| **−3.3** | **Ruin**, "+100% crit damage bonus to your **Destruction** spells", the same mistake |

They compound, which is why the four sum to 63.4 and the total is 67.1. Each was
isolated by reverting it alone and re-running the thirty batches.

**THE ENGINE FIELD THAT WAS MISSING HAD BEEN PREDICTED BY NAME BEFORE IT EXISTED.**
`game/auras/warrior.ts` says, of Death Wish's "Physical" qualifier, that "the day
an aura needs to scale one school and not another is the day this needs a
`damageDoneBySchool`". `SchoolModifiers` could not hold these because it is built
once when the character is, and all four effects come and go.

**AND "YOUR DESTRUCTION SPELLS" IS NOT A SCHOOL.** `WARLOCK_DESTRUCTION_SPELLS`
reads the spellbook capture's own `tab` field now — and **Shadow Bolt is a
Destruction spell**, which is the one entry a reader would get wrong from the
school alone.

### The other half: SM/DS gained 14.8 from one talent

**349.1 → 363.9**, all of it Pandemic, which was the largest single live gap in
the class. Its `unmodelled` reason was exact and named the field it wanted —
`critMultiplierBonus` on `AbilityModifiers`, which had existed since Impale with
no talent effect reaching it. `abilityCritDamage` is that declaration. **The
Rogue's Lethality wanted the identical one**, so it was built once and both are
live.

### The count was always the misleading number, and still is

**THIRTEEN OF THE REMAINING GAPS ARE ONE THING: BOTH PROFILES TAKE DEMONIC
SACRIFICE, WHICH KILLS THE DEMON.**

`improved_imp`, `improved_voidwalker`, `improved_sayaad`, `improved_felhunter`,
`unholy_power`, `demonic_energies`, `demonic_brand`, `soul_link`,
`demonic_knowledge`, `master_demonologist`, `improved_health_funnel`,
`master_summoner`, `fel_domination`, `demonic_pact` — **every one is inert
because there is no pet, and there is no pet because the build chose not to have
one.** That is the BUILD cause and it is correctly dead, the same situation as the
Hunter's Lone Wolf. **Neither profile spends a point in any of them.**

**A FURTHER FOUR ARE THE ENCOUNTER:** `fel_concentration`, `intensity`,
`molten_skin`, and half of `demonic_aegis` all need something to attack the
Warlock, and `encounter.targetAttacks` is false for both profiles. **That is not
an engine gap either** — `damageTakenMultiplier` on an aura expresses Molten Skin
exactly, and a Warlock profile fighting a target that swings back would make it
live with no new capability. **Each reason says so in those words now**, rather
than the four-word version it had.

**So of 22 live gaps, 17 are the build or the encounter.** The real engine queue
is five, and three of those five want the ruleset owner or the spell list rather
than code.

---

## The profiles

| Profile | Talents | DPS | Was | List |
| --- | --- | --- | --- | --- |
| Firelock | 7/11/33 (round 42; 5/11/35 before) | **544.3** | 544.7, −0.4 noise (Corruption out) | `WARLOCK_DESTRUCTION` |
| SM/DS | 35/11/5 | **479.7** | 441.5, **+38.1 REAL** (the eight rulings) | `WARLOCK_AFFLICTION` |

**FIRELOCK IS NO LONGER THE THIRD-HIGHEST PROFILE IN THE PROJECT.** It sits
between Prot Warr's 454.6 and Cat's 488.0 now. The drop is a CORRECTION and not a
regression, and the other twenty-one profiles moved by nothing at all except the
three Rogues, which is what a change scoped to two classes should look like.

**SM/DS GAINED +55.9 FROM THE OWNER'S LIST — THE LARGEST GAIN OF ALL 23** — and
it went from six entries to five doing it. **The count was never the thing, the
conditions were.**

**Firelock gained +12.1% from Life Tap alone**, and that is the standing rule's
origin story: our capture said 424 and `foreverchanges.pro` said 840, **both at
build 1.60.1.70009.** Refreshing a capture does not settle a disagreement between
two reads of the same build. The owner's rule — **where our capture and
`foreverchanges.pro` disagree, foreverchanges wins** — was given for this.

**This class is one of only two cross-checked in depth against
`foreverchanges.pro`** (the Warrior is the other). Three numbers moved; **seven of
its ten matched exactly**, which is where confidence comes from.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| SM/DS | **Wrack 39.5%**, Bane of Agony 26.0%, Corruption 23.2%, Siphon Life 5.9%, Shadow Bolt 5.4% |
| Firelock | **Incinerate 48.1%**, Immolate 26.1%, Conflagrate 18.6%, Shadowburn 7.3% |

**CORRUPTION FELL FROM 13.5% TO 10.3% OF FIRELOCK**, which is the containment
check for the Ruin and Agonizing Flames corrections: it is the one Affliction
spell in a Destruction build, and it is exactly the source those two talents
should never have reached. **Shadow Bolt is still half of SM/DS.** No auto attack
in either — a `caster` style has none.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 52 | **25** | 3 | **5** | **19** |

Previously 21 / 3 / 3 / **25**.

**Three ruled out is still the LOWEST in the project** — this class's trees are
almost all damage and pets, with very little healing, positioning, threat or crowd
control to rule out. That is why the gap column looks large even now: nothing is
absorbed by the scope rulings.

### What left the gap column

| Talent | How | Worth |
| --- | --- | --- |
| `pandemic` | `abilityCritDamage`, a fourth modifier scope | **+14.8 DPS to SM/DS** |
| `improved_drains` | Wrack is declared, which its own reason already SAID | zero |
| `soul_siphon` | the same, through `abilityBonus` read in Wrack's `onCast` | zero |

**TWO OF THE THREE ARE WORTH EXACTLY ZERO AND ARE WORKING**, because the only
ability they reach is Wrack, which was in no list then. Their tests assert the
resolved multiplier and the per-cast count, not a DPS delta. **A talent working
and a talent mattering are different questions.**

`ruin` and `agonizing_flames` were already counted as fully modelled while being
WRONG, so the correction does not move the census — which is worth noticing about
the census: it counts whether a talent is EXPRESSED and not whether it is right.

### Two reasons were expired and one was wrong

- **`improved_drains` and `soul_siphon` both said "Wrack is declared"** and
  neither had been acted on. That sentence was written the day Wrack landed.
  **The fifth time in this project an expired reason has been caught by
  re-reading it, and the first where the reason contained its own fix.**
- **`decimation` blamed the TARGET and should not have.** Its reason said every
  clause needs the target below 35% health, "which never happens against a target
  that survives by design" — and 35% is the CLOCK by the owner's ruling,
  `combat/executePhase.ts`, the exact fraction the Rogue's Quietus runs on.
  **This is the fourth time that mistake has been made here.** What actually
  blocks it is Soul Fire, which three of its four clauses are about; its fourth
  clause is the same clock-conditional per-ability modifier Quietus and Early
  Demise want, so **decimation is the THIRD caller for that one mechanism.**

### The five remaining engine gaps, and only one is ours alone

| Talent | What it needs | Whose |
| --- | --- | --- |
| ~~`amplify_curse`~~ | **DECLARED, AND IT NEVER NEEDED THE MECHANISM ITS REASON ASKED FOR.** The reason wanted "a one-shot per-ability DAMAGE modifier" and was wrong about the shape: the 50% applies to ticks landing over 24 seconds, and a `CastModifier` is spent AT the cast. The amplification travels with the AURA instead — two definitions sharing one id, chosen at application — so this was one `grantAbility` away all along. **+18.6** | — |
| `decimation` | Soul Fire declared, plus the clock-conditional modifier above | code + the spell list |
| `demonic_aegis` | Demon Skin and Demon Armor declared **and** something attacking a Warlock. **Two independent reasons**, so clearing one moves nothing | the spell list + the encounter |
| `soul_harvesting` | a KILL, which the target survives by design | the encounter |
| `bane_of_havoc` | a second target. Correctly **zero** rather than inert | the encounter |

---

## Never-fired entries

**TWO, AND WRACK CAUSED BOTH: SM/DS's LIFE TAP AND ITS FILLER SHADOW BOLT.**
Confirmed with `USES=1`:

| SM/DS | uses | | Firelock | uses |
| --- | --- | --- | --- | --- |
| amplify_curse | 1.0 | | immolate | 4.3 |
| shadow_bolt (proc-gated) | 2.0 | | conflagrate | 6.0 |
| bane_of_agony | 3.0 | | shadowburn | 4.0 |
| corruption | 4.0 | | life_tap | 5.0 |
| siphon_life | 2.0 | | incinerate | 16.4 |
| **life_tap** | **0.0** | | | |
| wrack | 10.5 | | | |
| **shadow_bolt (filler)** | **0.0** | | | |

**AMPLIFY CURSE FIRES EXACTLY ONCE**, which is the three-minute cooldown doing
the work a condition would otherwise have to — and the two Shadow Bolt rows are
one pooled figure, because the id is in the list twice on purpose.

**WRACK IS 200 MANA AGAINST SHADOW BOLT'S 380, AND IT DISPLACED NINE SHADOW BOLT
CASTS.** So the profile now gains 8,236 mana and spends 6,034, and
`manaBelowFraction(0.15)` is never true. That is the fifth cause of a never-fired
entry — **the condition reads a state the fight no longer enters** — and it is not
a broken declaration.

**THE ENTRY STAYS, AND IT COSTS NOTHING TO LEAVE IT.** It is the ruleset owner's,
and the owner's list outranks a measured decision of ours. Removing it measures
**441.6 against 441.5** — identical to the decimal, because a condition that is
never true costs no global cooldown. So this is recorded rather than fixed, and a
profile that spent more mana would reach it immediately.

**ITS TEST HAD TO CHANGE, AND HAD BEEN WRONG ONCE BEFORE FOR THE SAME REASON.**
`warlockAbilities.test.ts` asserted a Life Tap CAST COUNT; it wanted "more than
three", was loosened to "more than one" when the preset raid buffs gained
Blessing of Wisdom and Mana Spring Totem, and is now zero. A cast count is a
ROTATION outcome and this one has been invalidated by a raid-buff change and a
list change in turn, so the subject is the MECHANISM now — health for mana, one
for one — which neither can move.

## In the book, in no list, never cast

`immolate`, `searing_pain` for SM/DS; `shadow_bolt`, `bane_of_agony`,
`searing_pain` for Firelock — **the two lists dividing the same book, which is
correct.** Wrack has left this list.

**WRACK IS IN THE SM/DS LIST, AT THE OWNER'S POSITION AND ON THE OWNER'S
CONDITION:** between Life Tap and Shadow Bolt, gated on all three bleeds having
six seconds left. The list's own comment had carried that specification for the
whole time the entry was absent. Both halves of the ability were already built:

- **14.3% of spell power per tick**, six ticks one second apart, supplied by the
  owner directly because `WoWSimWorksheet.xlsx` has no Wrack row — **the only row
  in `coefficients.ts` that is not from the sheet**, with its provenance recorded
  beside the constant because a sheet refresh will not carry it.
- **+10% to your other Shadow damage-over-time effects**, through
  `periodicDamageTakenBySchool`. Its `unmodelled` reason had named that field: a
  plain Shadow vulnerability would also raise Shadow Bolt at half the profile's
  damage, which is a bigger number wearing the right label rather than an
  approximation.

**"OTHER" FALLS OUT RATHER THAN BEING SPECIAL-CASED.** Wrack is a CHANNEL, so its
six ticks are CAST ticks and carry no `periodic` flag — only a real
damage-over-time tick does. So the debuff cannot amplify the ability that applied
it, and the test asserts exactly that: a Corruption tick inside the window is 10%
larger and a Shadow Bolt cast inside it is unchanged.

**WHAT IT IS WORTH IS ANSWERED: +5.6 DPS, REAL, AND IT RESHAPES THE PROFILE OUT
OF ALL PROPORTION TO THAT.** 435.9 to 441.5 over thirty batches of ten, and in
exchange Shadow Bolt falls from 14.8 casts a fight to 5.6 and from 51.1% of the
damage to 20.2%, while Wrack takes 30.3%. **A list can change completely and be
worth almost nothing** — the third time this project has measured that, and the
uses column is the only thing that says the list changed at all.

**THE ARITHMETIC THAT SAID IT COULD NOT BE WORTH CASTING WAS NEARLY RIGHT**, which
is the interesting part. Six ticks at 14.3% is 0.858 against Shadow Bolt's 0.857
in half the time, so per second the direct damage is roughly a wash; what pays for
it is the amplification on the three bleeds plus the 180 mana saved per cast. The
margin is thin and REAL.

**AND ONE BATCH OF TEN READ +12.9, MORE THAN TWICE THE TRUTH.** The full method is
what separated a 1.3% gain from a 3% one here.

**THE SIX-SECOND GATE IS WHAT MAKES IT CASTABLE AT ALL.** A channel locks the
caster for its whole duration, so committing to one while a bleed is about to drop
trades that bleed's remaining ticks for Wrack's. `allLastingAtLeast` reads
`WRACK_CHANNEL_MS` rather than a literal six seconds, so a channel that changes
length takes its own gate with it.

---

## The weapon stone, and which one each profile wants

**A WARLOCK CARRIES A TEMPORARY WEAPON ENCHANT, SELECTED IN THE GEAR PANEL** --
the same shape as a Rogue's poisons, and the owner asked for it in those terms.
`profile.warlockStone`, arrived in profile version 11.

| | |
| --- | --- |
| **Firestone** | +2% spell critical strike chance, +21 damage done by your **Fire** spells |
| **Spellstone** | +2% spell haste, +21 damage done by your **Shadow** spells |

**BOTH SOURCES AGREE ON ALL FOUR NUMBERS** -- the owner's message and
`forever-warlock-spellbook.json` -- which for this class is the confidence
measure, since eight of the nine rest on one capture.

### What each is worth: 30 batches of 10

**The owner has chosen: SM/DS takes the Spellstone, Firelock the Firestone**, and
both presets carry them. Measured on current `main`:

| Profile | none | Firestone | Spellstone |
| --- | --- | --- | --- |
| **Firelock** | 568.3 | **589.1, +20.8 REAL** | 575.0, +6.7 noise |
| **SM/DS** | 496.9 | 504.4, +7.6 REAL | **516.8, +19.9 REAL** |

**BOTH CHOICES ARE THE BETTER ONE, DECISIVELY**, and in the baseline table the
selection is worth **+19.6 to SM/DS and +20.8 to Firelock** — the harness's own
figures, which agree with the table above to within a seed.

**AN EARLIER VERSION OF THIS TABLE SAID SM/DS WAS A TIE AT +7.3 EITHER WAY, AND
IT WAS WRONG.** That measurement was taken before the armour-enchant table
landed and it reported the Firestone and the Spellstone at an **identical
484.6** — two different stat bundles returning bit-identical means across thirty
batches, which is not something that happens. **That identity was the tell and
it went unquestioned.** The Firestone half of it was right (+7.3 then, +7.6 now);
the Spellstone half was not.

**THE LESSON IS CHEAPER THAN THE CHECK THAT CATCHES IT:** when two
configurations come back equal to the decimal, suspect that the same one was
measured twice. The confirmation here is two independent routes agreeing —
`measure_profiles.ts` against a saved baseline, and a standalone probe — which
is what a single suspicious run is worth checking against.

### THE TRAP: a Firestone is not a "Fire stone"

**ONLY THE +21 IS SCHOOL-SCOPED.** `spellCritChance` is a whole-character stat
read by the spell table for every school, so a Firestone's 2% crit helps a pure
Shadow build exactly as much as a Fire one. The two stones are really "crit plus
a little Fire power" and "haste plus a little Shadow power".

**THIS COST A WRONG TEST ASSERTION.** I wrote "gives SM/DS more from the
Spellstone than from the Firestone", reasoning from SM/DS dealing almost nothing
but Shadow — and it failed at 486.7 against 478.4 on one batch, then came back a
*tie* on thirty. Two lessons in one: the school reading, and that a single batch
said Firestone won by 8 where the full method says neither wins. The test asserts
the SCOPING now and leaves the ordering to this document.

### The default is still `none`, and the presets still choose

**THE PRESETS CARRY THE OWNER'S CHOICE; `createDefaultProfile()` CARRIES `none`.**
Those are two different questions and it is worth keeping them apart: a new
profile a user starts from scratch has made no choice, while the 24 presets are
the owner's builds and now state one.

**SO VERSION 11 STILL MOVES NO SAVED PROFILE.** The migration gives an older file
`none`, which is the opposite of version 10's poison decision — the owner stated
the poison pairing, so a saved Rogue carrying none was wrong, while a saved
Warlock has simply never been asked. Only the two presets moved, by +19.6 and
+20.8.

---

## Traps specific to this class

- **"YOUR DESTRUCTION SPELLS" IS A TREE, NOT A SCHOOL, AND SHADOW BOLT IS IN IT.**
  Two talents got this wrong for the whole project, and the wrong reading is the
  tempting one: a Warlock's only two schools ARE Fire and Shadow.
  `WARLOCK_DESTRUCTION_SPELLS` reads the spellbook capture's own `tab`. Four
  spells in that tab are declared nowhere — Soul Fire, Rain of Fire, Hellfire,
  Bane of Havoc — and that is the SPELL list's business rather than either
  talent's, by the standard Twin Disciplines set on the Priest.
- **A PER-SCHOOL EFFECT THAT COMES AND GOES BELONGS ON THE AURA.**
  `SchoolModifiers` is built once when the character is. `damageDoneBySchool` on
  `AuraDefinition` is the field, and Demonic Sacrifice and Shadow and Flame both
  needed it.
- **A CLAUSE THAT CANNOT BE EXPRESSED PER SCHOOL IS NOT AUTOMATICALLY WORTH
  APPLYING WHOLE-CHARACTER.** Both auras above did, with a caveat, and both
  caveats were correct and understated. "Generous for a hybrid" turned out to be
  42 DPS.
- **WHERE TWO SOURCES DISAGREE, `foreverchanges.pro` WINS** — the owner's standing
  rule, given when it settled Life Tap at 840 against our capture's 424. It
  outranks the older instruction to prefer the newer read or to ask, and **it
  applies to every class**, because eight of the nine have no owner spreadsheet.
- **THE RULE DOES NOT APPLY WHEN THE PREFERRED SOURCE IS SILENT RATHER THAN
  DIFFERENT.** `foreverchanges.pro` carries **no reagent field for any spell**, so
  its 365-mana cost for Shadowburn does not contradict the Soul Shard the other
  source states — it cannot express one. **Both are charged.**
- **`PLACEHOLDER_SOUL_SHARDS` is 10** — what a Warlock banks before a pull. There
  is no in-fight shard income modelled.
- **Immolate is the hybrid to know:** `IMMOLATE_SP_COEFFICIENT` 0.2 for the hit and
  `IMMOLATE_TICK_SP_COEFFICIENT` 0.13 per tick, both the owner's own rows.
- **`aftermath` raises Immolate INITIAL damage only**, and the initial hit and its
  burn share one ability id — which is why that talent is partly modelled. **The
  same shared id is what makes Pandemic and Ruin expressible at all**, because a
  periodic tick carries its aura's id and `rollPeriodicCrit` applies the same
  modifier a cast gets.
- ~~**Bane of Agony ticks FLAT**~~ **ANSWERED, AND THE GUESS WAS RIGHT.** The
  owner has quantified the ramp — three bands of four ticks at 1/24th, 1/12th and
  1/8th of the total, twelve ticks two seconds apart — which is 50/100/150% of
  the average and therefore Classic's shape after all. It is **24.4%** of SM/DS's
  damage now, up from 19.0%, because the coefficient went 1.064 to 1.6.
- **A RAMPED DoT READS ITS TICK NUMBER OFF `appliedAt`, NOT OFF A COUNTER**, so a
  refresh restarts the ramp — which is what `refreshBehaviour: 'reset'` means
  everywhere else. A counter on the instance would need resetting by hand in the
  one place that is easy to forget.
- ~~**WRACK'S GATE NAMES SIPHON LIFE.**~~ **GONE WITH THE GATE**, which the
  interrupt rule replaced. It cost one wrong measurement while it existed, and the
  lesson is in CLAUDE.md: when an entry's condition names an aura, grep for who
  else applies it before measuring that aura's removal.
- **A FIRESTONE'S CRIT IS SCHOOL-BLIND AND ITS +21 IS NOT**, so neither stone is
  "the Fire one" or "the Shadow one". See the stone section above; it cost a
  wrong test assertion.
- **`hasteRating` IS SPELL HASTE FOR A WARLOCK, AND ONLY BECAUSE IT NEVER
  SWINGS.** `STAT_NAMES` is closed and has one haste member driving both swing
  speed and cast speed, where crit is split into `critChance` and
  `spellCritChance`. A `caster` is `autoAttack: 'none'`, so the reading is exact
  here and would be generous for a class that swings -- and no such class can
  carry a Spellstone. **The day a melee class gets a spell-haste effect is the
  day the stat has to be split**, and `warlockStones.ts` says so.
- **A CHANNEL IS CANCELLABLE AND BOTH HALVES HAVE TO AGREE** --
  `Ability.interruptibleChannel` and `PriorityEntry.interruptsChannel`. Only
  Wrack declares the first, deliberately: every channel in a real client can be
  cancelled, and turning it on for Arcane Missiles would move the Mage profiles
  on a ruling that was about the Warlock.
- **A temporary summon is modelled without a combatant** on the owner's call — the
  Infernal is the mid-fight-summon gap, shared with the Mage's elemental and the
  Shaman's totems. **Nothing in any profile needs it.**
- **`fel_vitality`'s mana bonus is applied through INTELLECT** rather than to the
  pool directly, because a percentage of a pool computed once would freeze at the
  unbuffed figure.

---

## What "done" looks like

Five of the six items this brief opened with are done, and two of the remaining
four are questions rather than code.

1. ~~**Bane of Agony's ramp asked for.**~~ **ANSWERED** — three bands, twelve
   ticks, and a 160% coefficient that supersedes the sheet. Worth +23.6 on the
   coefficient and −7.6 on the ramp itself.
2. **SM/DS's Life Tap entry is unreachable** and the owner may want the 15%
   threshold re-tuned, or may not — it costs nothing to leave, and a profile that
   spent more mana would reach it. Recorded, not fixed.
3. ~~**`amplify_curse`'s one-shot damage modifier**~~ **DONE, and it needed no
   such modifier** — see the census table above. The one-shot CRIT modifier two
   other classes want is still genuinely missing; this talent is no longer a
   caller for its damage twin.
4. **Soul Fire declared**, which is the only thing standing between `decimation`
   and the clock mechanism Quietus and Early Demise also want.

~~The thirteen demon talents written up as ONE build cause.~~ Done — and four more
turned out to be the encounter, which the reasons now say in those words.

~~`pandemic` reached via `critMultiplierBonus`, together with the Rogue's
Lethality.~~ Done. One declaration, `abilityCritDamage`, two classes, and the
Rogue side is +2.6 to +3.2 across its three profiles — inside every interval.

~~A periodic-only school vulnerability decided.~~ Done —
`periodicDamageTakenBySchool`, and Wrack's own reason had named the field.

~~`improved_drains` and `soul_siphon` reasons re-read.~~ Done. Both were expired
and both said so in their own words. **And both are now LIVE rather than merely
correct**, because the only ability they reach is Wrack and Wrack is in the list —
without one assertion in their tests changing, which is what asserting the
mechanism instead of a DPS delta buys.

~~Wrack measured with its amplification live.~~ Done, and the owner has put it in
the list: **+5.6 REAL**, with Shadow Bolt dropping from 51.1% of the profile to
20.2%.
