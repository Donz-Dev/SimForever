# Handoff — action priority lists

**The job: receive, tweak and optimise the priority list behind each of the 23
profiles.** Everything else in this simulator is built. This is the last system
that is thin, and it is thin in a way that does not look thin.

Read [CLAUDE.md](../CLAUDE.md) first — it is the rules, and about a fifth of it
is rotation lessons paid for in wrong numbers. This file is the state of the
lists, the tools, and what is already known to be wrong with them.

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
them, which is why it was written before this handoff was.

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
sharing. Baselines are 300 iterations at seed 12345 with the preset raid buffs,
as published in [HANDOVER.md](../HANDOVER.md).

| Profile | DPS | List | Entries | Gated |
| --- | --- | --- | --- | --- |
| DW Fury | 652.2 | `WARRIOR_DUAL_WIELD_BERSERKER` | 9 | 5 |
| 2H Arms | 596.6 | `WARRIOR_TWO_HAND_BATTLE` | 11 | 8 |
| LW Melee | 550.1 | `HUNTER_LONE_WOLF_MELEE` | 7 | 2 |
| Firelock | 537.6 | `WARLOCK_DESTRUCTION` | 6 | 2 |
| Prot Warr | 457.1 | `WARRIOR_SHIELD_DEFENSIVE` | 14 | 10 |
| Seal Twist Ret | 451.8 | `PALADIN_RETRIBUTION` | 4 | 2 |
| Shadow Priest | 449.3 | `PRIEST_SHADOW` | 7 | 4 |
| Cat | 441.2 | `DRUID_CAT` | 6 | 3 |
| BM Hunter | 418.3 | `HUNTER_BEAST_MASTERY` | 8 | 1 |
| Combat | 417.6 | `ROGUE_COMBAT` | 6 | 2 |
| Venom | 410.3 | `ROGUE_VENOM` | 6 | 4 |
| Arcane | 405.2 | `MAGE_ARCANE` | 5 | 2 |
| Enh Shaman | 404.3 | `SHAMAN_ENHANCEMENT` | 5 | 2 |
| Fire | 390.3 | `MAGE_FIRE` | 6 | 2 |
| Rupture | 377.3 | `ROGUE_RUPTURE` | 6 | 3 |
| Moonkin | 359.0 | `DRUID_MOONKIN` | 4 | 2 |
| Bear | 353.1 | `DRUID_BEAR` | 5 | 2 |
| Shockadin | 343.4 | `PALADIN_SHOCKADIN` | 4 | 1 |
| Frostfire | 339.5 | `MAGE_FROSTFIRE` | 4 | 2 |
| LW Ranged | 302.0 | `HUNTER_LONE_WOLF_RANGED` | 6 | 1 |
| SM/DS | 292.6 | `WARLOCK_AFFLICTION` | 6 | 4 |
| Ele Shaman | 277.7 | `SHAMAN_ELEMENTAL` | 3 | 1 |
| Prot Pally | 161.8 | `PALADIN_PROTECTION` | 5 | 3 |

Plus `PET_PRIORITY` (2 entries), which runs on the BM Hunter's pet, and two
Warrior lists **no preset reaches** — `WARRIOR_BATTLE` (14 entries) and
`WARRIOR_SHIELD` (15), the fallbacks for a shield in Battle Stance or a
dual-wielder outside Berserker. Both are pinned by a test so a third does not
quietly join them.

**THE SIZES ARE THE STORY.** The three lists the owner shaped carry 9, 11 and 14
entries; the Elemental shaman has three, and the Moonkin four. A four-entry list
is not automatically wrong — a Moonkin genuinely casts two DoTs and a nuke — but
it is where to look first, and none of them has ever been measured entry by
entry.

**How a profile reaches its list** is `rotationFor(class, style, stance,
talents)`: the Warrior by style **and** stance, the Rogue, Paladin, Warlock and
Hunter by capstone, the Druid and Shaman by style, the Mage by **points spent**
across all three trees, the Priest by having one profile. Each mapping is now
pinned by a test, because the Shockadin ran the wrong list for its whole life
without erroring.

---

## What has already been measured, and what has not

**Four lists out of twenty-six have ever been measured entry by entry**: the
three Hunter APLs, and one entry of the Venom Rogue's. Everything else is
reasoned. The Warrior's came from the ruleset owner, which is the next best
thing and is still not a measurement.

The findings that came out of the Hunter work are in CLAUDE.md and are the
closest thing to prior art:

- **A list ordered by damage per cast is ordered by the wrong thing when the
  build runs out of resource.** Check whether a build is resource-bound or
  global-cooldown-bound before reading its list. Dropping Aimed Shot was worth
  +23 to Marksmanship; adding an instant shot to the melee Hunter was worth +55.
- **A cast time is a hidden cost the list cannot see**, because it resets the
  swing timer of a slot whose damage is on a different row of the table.
- **The same ability is right in one list and wrong in another** — Aimed Shot is
  −23 to Marksmanship and +4 to Beast Mastery.
- **Measure the cast, not the effect.** Injecting Hunter's Mark's 71 ranged
  attack power said +1.9; casting the ability measured **−10.1**.
- **Measure a list, do not reason about it.** Summon Hawk sat above Arcane Shot
  because a comment counted the hawk's ticks and not its price. Arcane Shot
  above it is worth +20, and the comment had been believed for as long as it had
  existed.

---

## Twelve entries that never fire, measured

`SEEDS=1 ITERATIONS=10 USES=1`, every profile. **"Has it" is read from the
built character's own ability book**, so the build cause and the position cause
are told apart rather than guessed at.

| Profile | Entry | Has it | Why it never fires |
| --- | --- | --- | --- |
| 2H Arms | `battle_stance_cast` | yes | the preset opens IN Battle Stance |
| 2H Arms | `battle_shout_cast` | yes | `battle_shout` is a preset raid buff, up all fight |
| DW Fury | `battle_shout_cast` | yes | same |
| Prot Warr | `defensive_stance_cast` | yes | the preset opens IN Defensive Stance |
| Prot Warr | `battle_shout_cast` | yes | same as above |
| Combat | `ghostly_strike` | **no** | 18/33/0 does not take the talent |
| Rupture | `ghostly_strike` | yes | 40 energy, below an **unconditional 35-energy Hemorrhage** |
| Rupture | `sinister_strike` | yes | 45 energy, same position, same reason |
| Rupture | `eviscerate` | yes | gated at 5 points; Slice and Dice and Rupture consume every cycle |
| Cat | `ferocious_bite` | yes | gated at 5 points; Rip takes them first |
| Cat | `claw` | yes | **its own comment says it should** — see below |
| BM Hunter | `summon_hawk` | yes | below Arcane Shot, which shares its cooldown, deliberately |

**None of these is a crash, a warning or a visible zero.** On the results page
an entry that never fired is simply a row that is not there.

### The three worth opening first

**`claw` in the Cat list contradicts its own comment.** The entry reads "falls
back when Shred is unaffordable, which at 60 energy it often is" — Claw is 45,
Shred is 60, and Claw fires **zero** times in ten fights. Either the Cat never
acts in the 45–59 energy window, or something above it is taking that window.
This is the one finding here that looks like a bug rather than a judgement.

**Two entries in the Rupture Rogue's list are unreachable by construction.**
Hemorrhage is unconditional and the cheapest builder it has, so nothing below it
can ever be the first castable entry. The list is six entries and three of them
are dead — it is really a three-entry list, and it is the lowest Rogue at 377.3.

**Battle Shout is in four Warrior lists and can never fire in any of them**,
because the preset raid buff supplies it. The entry carries a comment measuring
it at **+11.83 DPS**, which was true before raid buffs were selected rather than
assumed. A measurement expires the same way an `unmodelled` reason does.

---

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

1. **Should an entry that the preset's own raid buffs make inert be deleted, or
   kept for a character built without them?** Battle Shout, and the two stance
   casts, are in four lists and fire in none.
2. **Is Summon Hawk meant to stay in the Beast Mastery list at all**, given
   Arcane Shot above it is worth +20 and shares its cooldown?
3. **Are the three-and-four-entry caster lists complete?** The Elemental shaman
   casts three things and the Moonkin four; both are near the bottom of the
   table.
4. **Prot Pally at 161.8 is 116 DPS below the next profile.** Whether that is
   the list, the build or the class is not known, and nothing has looked.
