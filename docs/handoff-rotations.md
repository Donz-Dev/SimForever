# The action priority lists

**ALL 23 ARE THE RULESET OWNER'S OWN**, specified entry by entry and measured
after. This was a handoff describing a system that was thin in a way that did
not look thin; it is now the record of what replacing it was worth, and of the
three things building it turned up.

The rules an edit has to respect are unchanged and are at the bottom. So is the
four-ways-a-list-fails table, because every one of those failures was found
again while implementing the owner's lists.

Read [CLAUDE.md](../CLAUDE.md) first — it is the rules, and about a fifth of it
is rotation lessons paid for in wrong numbers. This file is the state of the
lists, the tools, and what each one was worth.

**CONTINUING THE WORK STARTS AT [docs/handoff-apl.md](handoff-apl.md)**, which
is the forward brief: what is open, what is blocked on the ruleset owner, and
the order to use the tools in. This file is the record it refers back to.

---

## The one thing to understand before editing anything

**A priority list fails silently, in four different ways, and all four produce
a perfectly ordinary DPS figure.**

| | What it looks like | Caught by |
| --- | --- | --- |
| The id names no ability | the entry is skipped forever; `rend` for `rend_cast` lived a whole life | `tests/game/rotationIds.test.ts` — **now sweeps all 26 lists** |
| The build never learned it | Shockadin asking for Seal of Command: no seal, no Judgement, 276.9 against a true 366.7 | nothing — `USES=1` below |
| The entry above never yields | an unconditional, cheaper ability sits above it | nothing — `USES=1` below |
| The encounter already supplies it | Battle Shout is a preset raid buff, so the Warrior's own cast is refused all fight | nothing — `USES=1` below |

Three of the four are invisible to the test suite, to the results page and to
the DPS number. `tools/measure_profiles.ts USES=1` is the only thing that shows
them, which is why it was written before this handoff was -- and it earned its
keep again while the owner's lists were going in. Three of the four failures
above were found in them, and a fourth was CREATED by the engine work one list
needed: see the dead-entry section below.

---

## Tools

### Measure profiles — `tools/measure_profiles.ts`

```bash
npx vite-node tools/measure_profiles.ts
```

| | |
| --- | --- |
| `PROFILES=cat,rogue` | comma-separated **substrings** of the preset id or label |
| `SEEDS=30 ITERATIONS=10` | 30 batches of 10 is the standing method; the default |
| `USES=1` | print the list, in priority order, with uses and damage share |
| `SAVE=before.json` | write this run's figures |
| `BASELINE=before.json` | compare against a saved run, with a REAL/noise verdict |

The workflow an edit wants is three commands:

```bash
SAVE=before.json npx vite-node tools/measure_profiles.ts
# ... edit one entry ...
BASELINE=before.json npx vite-node tools/measure_profiles.ts
```

**`SEEDS=1 ITERATIONS=10 USES=1` is the fast audit pass** and takes about a
minute for all 23. It prints no interval, on purpose — one sample has none, and
`NaN` reads as a broken tool.

### Measure Warrior talent builds — `tools/measure_rotation.ts`

Older and narrower: it assembles Warriors from `createDefaultProfile` and a
starting set, so it measures **talent builds**, not profiles. Keep it for
questions like "what is Death Wish worth"; it cannot answer "what is the 2H Arms
profile doing", because that profile has its own gear, raid buffs and 51 points.

### The registry — `src/game/rotations/allLists.ts`

Every list in the project, with the class that owns it, the display name, and
**which preset runs it**. Added for this work. Two consumers:

- `rotationIds.test.ts` sweeps it, and separately reads the source files and
  fails if a list exists that the registry does not carry — so a tenth class is
  covered on the day its rotation lands.
- `measure_profiles.ts` joins it to the damage table to produce the uses column.

---

## The 23 profiles and their lists

Every profile has exactly one list of its own — 23 profiles, 23 lists, no
sharing, and **all 23 are the ruleset owner's**. DPS is the baseline in
[HANDOVER.md](../HANDOVER.md): 30 batches of 10 with the preset raid buffs.

| Profile | DPS | List | Entries | Gated |
| --- | --- | --- | --- | --- |
| DW Fury | __FURY__ | `WARRIOR_DUAL_WIELD_BERSERKER` | 10 | 6 |
| 2H Arms | __ARMS__ | `WARRIOR_TWO_HAND_BATTLE` | 12 | 8 |
| Cat | 488.0 | `DRUID_CAT` | 5 | 3 |
| Seal Twist Ret | 471.0 | `PALADIN_RETRIBUTION` | 7 | 3 |
| Firelock | 468.4 | `WARLOCK_DESTRUCTION` | 6 | 2 |
| Prot Warr | 454.6 | `WARRIOR_SHIELD_DEFENSIVE` | 14 | 10 |
| Enh Shaman | 451.1 | `SHAMAN_ENHANCEMENT` | 7 | 5 |
| Shadow | 437.3 | `PRIEST_SHADOW` | 6 | 4 |
| Combat | 422.5 | `ROGUE_COMBAT` | 5 | 2 |
| Frostfire | 412.5 | `MAGE_FROSTFIRE` | 5 | 4 |
| BM Hunter | 405.8 | `HUNTER_BEAST_MASTERY` | 7 | 5 |
| Fire | 401.2 | `MAGE_FIRE` | 5 | 4 |
| Venom | 395.9 | `ROGUE_VENOM` | 5 | 4 |
| Arcane | 392.6 | `MAGE_ARCANE` | 5 | 4 |
| Moonkin | 384.3 | `DRUID_MOONKIN` | 5 | 4 |
| Rupture | 379.7 | `ROGUE_RUPTURE` | 8 | 5 |
| Shockadin | 379.0 | `PALADIN_SHOCKADIN` | 7 | 2 |
| Bear | 376.2 | `DRUID_BEAR` | 8 | 4 |
| SM/DS | 363.9 | `WARLOCK_AFFLICTION` | 5 | 4 |
| LW Melee | 321.5 | `HUNTER_LONE_WOLF_MELEE` | 5 | 2 |
| LW Ranged | 311.7 | `HUNTER_LONE_WOLF_RANGED` | 7 | 5 |
| Ele Shaman | 295.4 | `SHAMAN_ELEMENTAL` | 3 | 1 |
| Prot Pally | 153.2 | `PALADIN_PROTECTION` | 9 | 6 |

Plus `PET_PRIORITY` (2 entries), which runs on the BM Hunter's pet, and two
Warrior lists **no preset reaches** — `WARRIOR_BATTLE` (14 entries) and
`WARRIOR_SHIELD` (15), the fallbacks for a shield in Battle Stance or a
dual-wielder outside Berserker. Both are pinned by a test so a third does not
quietly join them. They are the only lists in this file that are still shells.

**THE SIZES WERE THE STORY AND ARE NOT ANY MORE.** This table used to note that
the Elemental shaman had three entries and the Moonkin four, against 9, 11 and
14 for the three the owner had shaped, and that a short list was where to look
first. That held: the Moonkin is five now and gained 25.1, and SM/DS went from
six entries to five and gained 55.9 -- **the count was never the thing, the
conditions were.** The Elemental shaman is still three entries and still gained
16.4, from one word in one condition.

**How a profile reaches its list** is `rotationFor(class, style, stance,
talents)`: the Warrior by style **and** stance, the Rogue, Paladin, Warlock and
Hunter by capstone, the Druid and Shaman by style, the Mage by **points spent**
across all three trees, the Priest by having one profile. Each mapping is now
pinned by a test, because the Shockadin ran the wrong list for its whole life
without erroring.

---

## What each list was worth

Every figure is 30 batches of 10 against the profile's previous baseline, with
the containment check that the profiles a change should not reach do not move by
a decimal. **Every one held: a list edit moved exactly the profile that runs it.**

| Profile | before | after | |
| --- | --- | --- | --- |
| SM/DS | 293.2 | 349.1 | **+55.9** |
| Enh Shaman | 404.8 | 451.1 | **+46.2** |
| Cat | 444.1 | 488.0 | **+43.9** |
| Frostfire | 339.9 | 376.6 | **+36.7** |
| Shockadin | 342.6 | 379.0 | **+36.4** |
| Seal Twist Ret | 443.9 | 471.0 | **+27.2** |
| Moonkin | 359.2 | 384.3 | **+25.1** |
| Bear | 354.1 | 376.2 | **+22.1** |
| Ele Shaman | 278.9 | 295.4 | **+16.4** |
| LW Ranged | 304.6 | 311.7 | **+7.1** |
| 2H Arms, DW Fury, Prot Warr, Combat, Rupture, Fire, Arcane, Firelock | | | noise |
| Prot Pally | 158.8 | 153.2 | **−5.6** |
| Shadow | 448.1 | 437.3 | **−10.8** |
| BM Hunter | 417.3 | 405.8 | **−11.6** |
| Venom | 417.0 | 392.7 | **−24.3** |
| LW Melee | 458.1 | 321.5 | **−136.6** |

### The three findings worth keeping

**A REFRESH WINDOW CLIPS, AND A BUFF CAN EXPOSE IT.** Every shell here refreshed
a debuff at two seconds remaining, and a refresh RESETS the aura -- so whatever
is left is thrown away, and the faster a character acts the more it loses.
Nature's Grace cost the Moonkin 14.9 DPS doing nothing but speeding it up: casts
26.3 a fight to 27.4, Moonfire ticks 25.1 to 22.5. The owner's "if not active"
removes the clipping outright, and the Elemental Shaman's entire +16.4 is that
one word on Flame Shock with nothing else in its list changed.

**A LIST THAT LOSES IS WORTH ISOLATING, NOT ARGUING ABOUT.** The Venom list
measured −24.3 and the obvious suspect was the Venom entry, which three earlier
placements had measured as a loss. It was not: removing it dropped the list to
375.0, so it is worth **+17.7** there. The whole loss is the two aura-duration
floors on Eviscerate -- gating it on five points alone gives 413.1, noise --
because the floors suppress it to 0.2 casts a fight and the combo points
overflow. The same shape is in the Rupture list and its Eviscerate never fires.

**THE MECHANISM AND THE DPS ARE DIFFERENT QUESTIONS, BOTH WAYS.** Combat's
Eviscerate went from 1.1 casts a fight to 9.0 for +0.6 DPS, and the Rupture list
went from three live entries to seven for +0.1. A list can change completely and
be worth nothing; the uses column is what says whether it changed at all.

## The twelve entries that never fired, and what happened to them

`SEEDS=1 ITERATIONS=10 USES=1` found them. **Eight entries still never fire and
six of those are deliberate** -- the claim here used to be that every entry in
every list fires, which was never true and is contradicted two paragraphs below
by the stance and shout entries that are kept on purpose. The eight are listed
with a reason each in [ability-audit.md](ability-audit.md). How each one went is worth more than the list of them was.

| Cause | What became of it |
| --- | --- |
| the preset already opens in that stance | `battle_stance_cast` and `defensive_stance_cast` are still in their lists and still fire zero times, KEPT on purpose -- a character built by hand in another stance needs them, and they cost a build that does not exactly nothing. `berserker_stance_cast` joined them for the same reason |
| the encounter already supplies it | `battle_shout_cast` in four Warrior lists. Still there, still refused all fight, and now a deliberate position rather than an accident |
| the build never learned it | Combat's `ghostly_strike`. Gone -- the owner's list does not name it |
| **the entry above never yields** | the interesting one, and it took four forms |

**THE FOURTH CAUSE, IN FULL.** Rupture's Ghostly Strike and Sinister Strike sat
below an UNCONDITIONAL 35-energy Hemorrhage and could never be the first castable
entry; the owner's list gates Hemorrhage on its own debuff and Backstab builds
instead. Cat's Claw could not fire at ANY energy, because Improved Shred and
Ferocity put it and Shred at the same 42 -- the entry's own comment said "falls
back when Shred is unaffordable, which at 60 energy it often is", and both
halves of that were wrong. Cat's Ferocious Bite and Rupture's Eviscerate were
starved of combo points by the finishers above them.

**AND THE APL WORK CREATED ONE OF ITS OWN, WHICH IS THE WARNING.**
`Combatant.recordSwing` was added for the Hunters' "only if a ranged auto-attack
has fired in the last 0.5 seconds" and landed in `extraAttack` instead of
`scheduleSwing` -- the two functions carry the same two lines. So the window
never opened, Aimed Shot and Sniper Shot fired zero times in three lists, and
nothing errored. The comment beside the mistake asserted the opposite of what
the code did. A `USES=1` pass caught it; review had not.

## The rules an edit has to respect

**Patch ONE entry, then measure.** 30 batches of 10, and a difference inside the
interval is not a difference. Two changes at once cannot be attributed.

**Run all 23 and say which ones were expected to move.** The containment check
in this project is that the profiles a change should not reach do not move by a
decimal. A rotation edit should move exactly one profile; if it moves two, the
list is shared by more builds than the edit assumed.

**A profile's DPS moving is not the test that an entry works, and an entry
working is not the test that it belongs.** Assert the mechanism — the uses
count, the aura uptime, the resource spent — and read the DPS separately.

**Check a finding against the other builds of the same class before
generalising it.**

**Do not invent game data to justify an order.** If the reason an ability goes
above another is a number nobody has supplied, say so in the entry's comment
rather than picking a plausible one.

**An entry's comment is a claim with a date on it.** Battle Shout's +11.83 is
the example. When an edit changes what a list can reach, re-read the comments on
the entries around it.

---

## Where the lists live

`src/game/rotations/` — one file per class, plus `pet.ts`, `rotationFor.ts`
(the dispatch) and `allLists.ts` (the registry).

A `PriorityEntry` is `{ abilityId, condition?, selectTarget? }`. The list is
walked top to bottom and the first castable entry wins. Two things are worth
knowing about `condition`:

- It is for **rotation logic** — "only when the debuff has under 3 seconds
  left" — not for things the engine already knows, like cooldowns and costs.
- **It is checked BEFORE a stance swap is considered.** `PriorityRotation`
  treats a wrong stance as "not yet, and here is how" and will change stance to
  reach an ability, which is what makes Revenge and Whirlwind reachable at all.
  An entry that must not provoke a swap says so in its condition — Charge does,
  and without it the tank left Defensive Stance at the pull.

**A repeated ability id is legal and sometimes correct.** The Mage's Arcane
Missiles and the Warlock's Shadow Bolt each appear twice: gated on a proc above,
ungated as the filler below. What is NOT legal is a copy below an *unconditional*
one, which can never be reached — the test fails on that shape specifically.

---

## Open questions for the ruleset owner

**ANSWERED, and the answers are in the lists:** the raid-buff-inert entries are
KEPT; Summon Hawk stays in the Beast Mastery list; the three-and-four-entry
caster lists were not complete and are now five to seven entries each; and Prot
Pally's gap is the build and the scope rather than the list -- it went DOWN 5.6
on the owner's own order, because Righteous Fury and Templar's Bulwark spend
global cooldowns on threat and survival, neither of which is damage.

**STILL OPEN:**

1. **LW Melee lost 237 DPS and went from the highest non-Warrior profile to
   fourth from bottom.** −100.6 of that is Raptor Strike becoming on-next-swing,
   which its capture stated all along and is not a choice. The other −136.6 is
   the list dropping Serpent Sting, Arcane Shot and Rapid Fire while adding
   Hunter's Mark, which a 40-batch measurement put at −10.1 for this build
   specifically. Implemented as written; worth confirming it is intended.

**ANSWERED SINCE, both by the ruleset owner.** Wrack's coefficient is **14.3% of
spell power a tick**, six ticks a second apart, supplied directly because the
sheet has no Wrack row. It is applied, and the ability stays out of every list --
the coefficient did not make it worth casting, because the reason to cast it is
the unmodelled +10% to other Shadow DoTs. And **"Scorch if scorch debuff <= 5"
is confirmed as `< 5`**, which is what was implemented; flagging the reading is
what got it asked.
