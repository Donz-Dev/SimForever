# MAGE DEEP DIVE

**Class:** Mage
**Profiles to audit and prepare:** Frostfire, Arcane, Fire

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**FIVE OF THE SIXTEEN LIVE GAPS ARE ONE CAPABILITY: SPELL HIT PER SCHOOL — AND
IT IS BUILT NOW.** `arcane_focus`, `elemental_precision` and their relatives all
raise the chance to hit with one school, and their shared reason was that **the
attack table decides hit before any per-school modifier is consulted**.

**THAT WAS NOT TRUE, AND THE PALADIN DIVE FOUND IT.** `rollTable` folds the
ability's modifier, the SCHOOL'S and the table's into one and hands the result to
the roll, so the school was in hand at the roll all along. What was missing was a
FIELD: `AbilityModifier.hitBonus`, taken off MISS because no table carries a hit
chance, plus `schoolHit` as the talent effect kind. Divine Precision uses both and
is worth 19 DPS to the Shockadin.

**SO THIS IS NO LONGER AN ENGINE CHANGE — IT IS A ONE-LINE EFFECT PER TALENT AND
A RE-MEASURED BASELINE.** Still the highest-leverage item for this class, and far
cheaper than the brief used to say. The engine half is tested in
`tests/engine/targetSideModifiers.test.ts`.

**ONE WARNING FROM THE SAME WORK**: `combine` did not fold `hitBonus` when the
field landed, so ONE source worked and TWO silently cancelled — and a character
whose gear already carries a school entry is the case that hits. Check a Mage
with Arcane-scoped spell power on its gear, not only a bare build.

A second cluster is **area damage against one enemy**: `improved_flamestrike`,
`improved_blizzard`, `improved_cone_of_cold`, and Blast Wave's area half. Those are
permanent unless the encounter grows a second target.

---

## The profiles

| Profile | Talents | DPS | List | Notes |
| --- | --- | --- | --- | --- |
| Frostfire | 0/29/22 | **412.5** | `MAGE_FROSTFIRE` | **now the top Mage** |
| Fire | 10/39/2 | **401.2** | `MAGE_FIRE` | |
| Arcane | 47/4/0 | **392.6** | `MAGE_ARCANE` | |

**FROSTFIRE MOVED +36.0 WHEN SHATTER LANDED** and went from last of the three to
first. It was the only profile that moved; the other 22 were identical to the
decimal. The build exists for the Fire/Frost overlap and now has a third reason
to — Fingers of Frost procs off a Chill, and its window is worth more to a Mage
whose Frost crits are doubled by Ice Shards.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Frostfire | Frostfire Bolt 35.5%, Pyroblast 27.3%, Scorch 14.7%, Ice Lance 12.3%, Ignite 10.1% |
| Arcane | **Arcane Missiles 60.4%, Arcane Blast 39.6%** |
| Fire | Fireball 38.6%, Pyroblast 27.7%, Scorch 22.0%, Ignite 11.8% |

**THE ARCANE MAGE HAS TWO DAMAGE SOURCES AND NOTHING ELSE.** Two spells account
for 100% of its damage, so its whole figure is two coefficients. No auto attack at
all — a `caster` style has none, which is why a Mage with no rotation would deal
literally zero.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 54 | 27 | 2 | 9 | **16** |

**54 talents is the largest tree in the project**, and 27 fully modelled is second
only to the Warrior's 43.

### The 16 live gaps, grouped by cause


**THE ENGINE HALF OF SPELL HIT PER SCHOOL IS BUILT.** The Paladin deep dive found
that the shared reason — that the attack table decides hit before any per-school
modifier is consulted — was simply false: `rollTable` folds the school's modifier
in before the roll and always did. `AbilityModifier.hitBonus` is the field and
`schoolHit` is the talent effect kind, both live and tested in
`tests/engine/targetSideModifiers.test.ts`. Divine Precision uses them and is
worth 19 DPS to the Shockadin. **These talents are now a one-line effect each and
a re-measured baseline**, left for the class that owns them because each moves a
profile.

**Spell hit per school (the engine gap above):** `arcane_focus`,
`elemental_precision`

**Area damage, one enemy:** `improved_flamestrike`, `improved_blizzard`,
`improved_cone_of_cold`

**Nothing attacks or interrupts a Mage:** `improved_channeling`,
`magic_absorption`, `improved_fire_ward`, `frost_warding`, `arcane_shielding`,
`ice_block`, `ice_barrier`

**The target is never frozen:** `frostbite` — **and this is now the ONLY talent in
this file with that reason.** The header used to list five and only one ever
qualified: Fingers of Frost does not freeze anything (it puts a state on the
Mage), Shatter now reads that state, and Improved Blizzard and Ice Lance are out
for reasons of their own. **One reason written across five talents outlived its
truth on four.**

**A declaration that does not exist yet:**

| Talent | What it needs |
| --- | --- |
| `winter_s_chill` | a stacking crit debuff **ON THE TARGET** for two named spells. `abilityCrit` is on the CASTER and an aura reaches every ability or none. `critWhileAura` was just built for the caster's side of exactly this shape |
| `cold_snap` | resets Frost cooldowns; the only Frost spell here with one is Ice Lance, which has none |
| `wand_specialization` | wands are not modelled |

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `wake_of_fire` | its killing-blow crit bonus needs a kill, and the target survives every fight |
| `frost_channeling` | its mana reduction applies; threat does not, and never will |

---

## Never-fired entries

**None.** All three Mage lists have every entry firing.

## In the book, in no list, never cast

`fireball`, `fire_blast`, `frostbolt`, `frostfire_bolt`, `scorch`,
`arcane_missiles`, `blast_wave`, `presence_of_mind` — varying by profile, and
**mostly a class where each list picks a different subset of the same book.**

**Three are cast by NO Mage at all:**

- **`frostbolt`** — cast by no Mage including Frostfire, which sounds wrong for a
  Frost build and is not: that list casts `frostfire_bolt`, **which is also a Chill
  effect**, so Fingers of Frost still procs and Shatter's window still opens.
- **`fire_blast`** — an instant nuke no list asks for. Worth measuring once.
- **`blast_wave`** — area damage, one target.

---

## Traps specific to this class

- **"SCORCH IF SCORCH DEBUFF <= 5" IS IMPLEMENTED AS `< 5`, AND THE OWNER HAS
  CONFIRMED THAT READING.** Fire Vulnerability caps at five, so the literal `<= 5`
  is always true and Scorch becomes unconditional, putting every entry below it in
  two lists out of reach. `SCORCH_STACK_CAP` names the constant. **Settled — do not
  re-open it.**
- **`NO_CHANCES` DOES NOT STOP A CRIT**, and Conflagrate is where that was found.
  `applyAbilityModifiers` ADDS a talent's `abilityCrit` to whatever the provider
  returned, and the crit multiplier scales the coefficient's contribution too:
  Conflagrate read 0.7071 against a declared 0.4286, which is 1.5× of it rather
  than a coefficient error. **A large NEGATIVE chance is what holds; zero is the
  number that looks right and is not.**
- **Ignite takes NO coefficient, deliberately.** Its magnitude is a share of the
  crit that caused it and that hit was already scaled, so a coefficient would apply
  spell power twice to the same damage. The zero is asserted in
  `mageAbilities.test.ts`; `everySpellScales` cannot reach it because it is an aura
  with no ability behind it.
- **A channel is a cast that ticks and nothing else about it is new.**
  `channelTicks` runs `onCast` that many times inside `castTimeMs`. Haste shortens
  the channel, so ticks come faster and there are still the same number. Arcane
  Missiles is 60.4% of the Arcane Mage.
- **Hot Streak names four spells and Pyroblast is not one**, which is what stops it
  feeding itself. Read the owner's own words for what a talent selects.
- **A duplicate ability id in a list is legal and sometimes correct.** Arcane
  Missiles is in its list twice on purpose — gated on a proc above, ungated as the
  filler below. A test that said "no ability twice" failed this correct list.
- **Shatter is joined to Fingers of Frost BY AURA ID, a bare string.** Renaming the
  aura would leave Shatter pointing at nothing and paying nothing with no compile
  error. `mageAbilities.test.ts` asserts the LINK rather than the two ids separately.
- **`PLACEHOLDER_COMBUSTION_DURATION_MS` is 30s** and generous: its real end is
  "until 4 crits", which nothing counts.
- **`arcane_mind` reads its SECOND value** for the crit-damage clause. Reading index
  0 would give the intellect clause a tenfold value and the crit clause a tenth.

---

## What "done" looks like

1. ~~**Spell hit per school scoped as an engine change.**~~ **The engine half is
   done** — `AbilityModifier.hitBonus` and the `schoolHit` effect kind, built by
   the Paladin dive, which found the shared reason for it was false. What is left
   for this class is **one `schoolHit` effect per talent and a re-measured
   baseline**; the Priest's two are the same one-line job.
2. **`winter_s_chill` reached.** A crit debuff the TARGET carries is the mirror of
   `critWhileAura`, which was just built for the caster's side. The two belong
   together.
3. **`frostbite` confirmed as the only frozen-target gap** and the other four
   reasons kept clear, since that cluster comment was wrong for four of five
   talents for months.
4. **`fire_blast` measured once** — an instant no list casts, in a class where two
   of three profiles are cast-time-bound.
5. **Combustion's real end condition asked for**, since counting crits is the only
   thing that would remove a 30-second placeholder from a capstone.
