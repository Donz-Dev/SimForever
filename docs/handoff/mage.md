# MAGE DEEP DIVE

**Class:** Mage
**Profiles to audit and prepare:** Frostfire, Arcane, Fire

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**TWO OF THE THREE PROFILES WERE WRONG ABOUT THEIR OWN SIGNATURE MECHANIC, AND
BOTH ERRORS WERE WRITTEN DOWN.** Combustion applied ten stacks by writing
`instance.stacks` directly and Arcane Blast's "+10% to all your other spells"
was left out with a caveat. Fixing the two moved Fire **+38.9** and Arcane
**+58.3**, and the other twenty-one profiles did not move by a decimal.

Neither was found by a test, because neither had one. **Combustion had no test
at all** — and that is how three separate errors survived in one aura.

---

## The profiles

| Profile | Talents | DPS | List | Notes |
| --- | --- | --- | --- | --- |
| Arcane | 47/4/0 | **450.9** | `MAGE_ARCANE` | **now the top Mage**, on Arcane Blast's damage half |
| Fire | 10/39/2 | **440.1** | `MAGE_FIRE` | Combustion is a real ramp now |
| Frostfire | 0/29/22 | **412.5** | `MAGE_FROSTFIRE` | unchanged: takes none of the three |

**FROSTFIRE NOT MOVING IS THE CONTAINMENT CHECK, not an oversight.** It takes
neither Combustion, Arcane Blast nor Arcane Power, so a change scoped to those
three must leave it identical to the decimal — and it did.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Arcane | **Arcane Missiles 55.7%, Arcane Blast 44.3%** |
| Fire | Pyroblast 42.2%, Fireball 27.9%, Scorch 16.2%, Ignite 13.7% |
| Frostfire | Frostfire Bolt 35.5%, Pyroblast 27.3%, Scorch 14.7%, Ice Lance 12.3%, Ignite 10.1% |

**THE ARCANE MAGE HAS TWO DAMAGE SOURCES AND NOTHING ELSE.** Two spells account
for 100% of its damage, so its whole figure is two coefficients and one aura. No
auto attack at all — a `caster` style has none, which is why a Mage with no
rotation would deal literally zero.

**FIRE'S SHAPE CHANGED WITHOUT ITS LIST CHANGING.** Pyroblast went 27.7% to
42.2% and Fireball 38.6% to 27.9%, because Combustion's crit burst feeds Hot
Streak and a Hot Streak Pyroblast is a 1.5-second cast. Same five entries, same
order, different fight.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 54 | 28 | 2 | **11** | **13** |

Down from 16. **`arcane_focus` and `elemental_precision` are NOT counted as
closed here** — spell hit per school is landing on the `priest-deep-dive`
branch, which wires both. With that merged the Mage is at **12**.

### The 14 live gaps, grouped by cause

**Spell hit per school — being built elsewhere:** `arcane_focus`,
`elemental_precision`. The attack table decides hit before any per-school
modifier is consulted, and `AbilityModifier.hitBonus` is the field it had
nothing to carry. Both Mage talents are wired on that branch.

**Nothing attacks the Mage — the PROFILE, not the engine:** `improved_channeling`,
`magic_absorption`, `arcane_shielding`, `improved_fire_ward`, `frost_warding`,
`ice_block`, `ice_barrier`. All three profiles set
`encounter.targetAttacks: false`. **The encounter CAN hit back** — two Paladin
builds use it — so this expires the day somebody writes a Mage profile that is
attacked. `improved_channeling` and `ice_barrier` have a second cause on top:
**the engine has no pushback at all**, for any class.

**A spell that is captured and not declared:** `improved_flamestrike`,
`improved_cone_of_cold`, `cold_snap`. All three are waiting on the spell
exclusion list HANDOVER.md already owes the owner. **Cone of Cold is the
strongest candidate in the whole proposal** — 328 to 358 Frost, 555 mana,
instant, 10-second cooldown, which is a real single-target instant rather than
an area spell that happens to land on one enemy.

**The target is never frozen:** `frostbite`, and **it is still the only one**.
See below — the cluster comment that claimed four was wrong about three of them
and has been corrected in the code.

**Wands:** `wand_specialization`. The Mage gear set **does equip one** — Crimson
Shocker — and a `caster` style has no auto attack, so it never fires. Reaching
it is a change to every caster in the project.

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `wake_of_fire` | its killing-blow crit bonus needs a kill, and the target survives every fight |
| `frost_channeling` | its mana reduction applies; threat does not, and never will |

### What left the gap column

| Talent | Why |
| --- | --- |
| `winter_s_chill` | **built.** A crit debuff the TARGET carries, for two named spells — `attackerAbilityModifiers`, the mirror of the `critWhileAura` Shatter needed |
| `improved_blizzard` | **ruled out, and its old reason was the wrong cause.** Its only effect is a movement-speed Chill, which is a snare; Permafrost is the same clause on the same tree and was already scoped `crowdControl`. Declaring Blizzard would not have reached it |

---

## What changed, and what it was worth

### Combustion: three errors in one aura, and the first cancelled the other two

"When activated, this spell causes each of your Fire damage spell hits to
increase your critical strike chance with Fire damage spells by 10%. This effect
lasts until you have caused 4 non-periodic critical strikes with Fire spells."

| Was | Is |
| --- | --- |
| ten stacks applied at once, by writing `instance.stacks` | one stack, and one more per Fire spell hit |
| `spellCritChance` — **every** school | `abilityModifiers` keyed by the six Fire spells |
| a placeholder 30 seconds | no duration; four non-periodic Fire crits end it |

**`applyStatModifiers` RUNS INSIDE `apply` AT ONE STACK, AND ONLY `refresh`
RE-APPLIES.** So writing `instance.stacks = 10` afterwards left the aura
*reporting* ten stacks and *paying* one. The caveat beside it said the effect
was generous; it was worth +10% crit for thirty seconds, and the profile was
**understated by 38.9 DPS**. Flurry writes its stacks the same way and is
unaffected, because its haste does not scale with stacks.

`PLACEHOLDER_COMBUSTION_DURATION_MS` is **deleted**.

### Arcane Blast: the damage half, and a clause that would disable itself

"Each time you cast Arcane Blast, the damage of all your other spells is
increased by 10%... Effect stacks up to 4 times and lasts 8 sec **or until any
other damage spell is cast**."

**READ LITERALLY, THE BONUS IS DESTROYED BY THE ONLY THING THAT COULD COLLECT
IT.** The reading taken is that the other spell TAKES the bonus and the stacks
then go — the project's standing rule for a specification that disables itself,
and the shape of the owner's own Arcane list, which spends four Arcane Blasts
into one Arcane Missiles channel. **It is an interpretation and HANDOVER.md
carries it as a question.**

`cast.final` is what makes a channel work: a cast reaction fires once per tick,
so without it the first of five missiles would end the window and the other four
would fire unbuffed. Smaller number, no error, opposite of what the list is for.

Worth **+64.5** on its own; **+58.3** after Arcane Power's cost half came in.

### Arcane Power's cost half, which was dropped

"+30% mana cost" was left out with a caveat saying it would need a list of every
Mage spell. The list exists now (`MAGE_COSTED_SPELL_IDS`) and **a test derives
the same set from `MAGE_ABILITIES` and fails if the two disagree**, which is
what keeps a hand-maintained list in step. Worth **−6.2**.

### And what the two branches are worth together

**MEASURED ON A TRIAL MERGE OF `priest-deep-dive` INTO THIS BRANCH**, which
composes cleanly -- one conflict, in `combineModifiers`, where both branches add
a field. 2,042 tests pass and the typechecker is clean.

| Profile | Baseline | This branch | Plus spell hit |
| --- | --- | --- | --- |
| Arcane | 392.6 | 450.9 | **492.2** |
| Fire | 401.2 | 440.1 | **449.4** |
| Frostfire | 412.5 | 412.5 | **437.8** |

**THESE ARE NOT A BASELINE.** They are a projection taken on a merge that has
not happened, recorded so that whoever merges second can tell a surprise from
an expectation. Re-measure after the real merge.

**FROSTFIRE'S WHOLE +25.3 IS SPELL HIT**, which is what a 5/5 Elemental
Precision against a flat 17% spell miss should be worth: roughly a thirtieth
more casts landing, on a profile with nothing else in this branch's way.

### Fire Blast, measured once

An instant no list asks for. Added above the Fireball filler, 30 batches of 10:
**440.1 ± 6.4 against 440.1 ± 7.0.** Exactly no difference — and the list
changed completely to produce it, with Fireball going 6.3 casts to 3.0 and
Pyroblast 7.3 to 8.4. **The uses column says whether a list changed; the DPS
says whether it mattered.** It stays out.

---

## Never-fired entries

**None.** All three Mage lists have every entry firing, Combustion included at
1.0 uses a fight.

## In the book, in no list, never cast

`fireball`, `fire_blast`, `frostbolt`, `frostfire_bolt`, `scorch`,
`arcane_missiles`, `blast_wave`, `presence_of_mind` — varying by profile, and
**mostly a class where each list picks a different subset of the same book.**

**Three are cast by NO Mage at all:**

- **`frostbolt`** — cast by no Mage including Frostfire, which sounds wrong for a
  Frost build and is not: that list casts `frostfire_bolt`, **which is also a Chill
  effect**, so Fingers of Frost still procs and Shatter's window still opens.
- **`fire_blast`** — measured above at +0.0.
- **`blast_wave`** — area damage, one target.

---

## Traps specific to this class

- **`modifiersScaleWithStacks` DID NOT REACH `abilityModifiers` UNTIL COMBUSTION
  WANTED IT.** The flag was read by `statModifiers` and by `damageTakenBySchool`
  and ignored by the third collection, so an aura declaring both stacked visibly,
  reported its stack count and paid one stack's worth. It reaches all three now,
  and `scaleByStacks` is the one place the rule lives: **chances multiply by the
  count, damage goes to the POWER of it**, matching every other reader.
- **WRITING `instance.stacks` DIRECTLY DOES NOT RE-APPLY STAT MODIFIERS.** Only
  `refresh` does. Two places in the project did it and only Combustion was hurt,
  because Flurry's haste does not scale with stacks. If a new effect needs to
  start at full charges, `chargesOnApply` is the field.
- **"SCORCH IF SCORCH DEBUFF <= 5" IS IMPLEMENTED AS `< 5`, AND THE OWNER HAS
  CONFIRMED THAT READING.** Fire Vulnerability caps at five, so the literal `<= 5`
  is always true and Scorch becomes unconditional, putting every entry below it in
  two lists out of reach. `SCORCH_STACK_CAP` names the constant. **Settled — do not
  re-open it.**
- **`NO_CHANCES` DOES NOT STOP A CRIT**, and Conflagrate is where that was found.
  `applyAbilityModifiers` ADDS a talent's `abilityCrit` to whatever the provider
  returned, and the crit multiplier scales the coefficient's contribution too.
  **A large NEGATIVE chance is what holds; zero is the number that looks right
  and is not.**
- **Ignite takes NO coefficient, deliberately.** Its magnitude is a share of the
  crit that caused it and that hit was already scaled, so a coefficient would apply
  spell power twice to the same damage. The zero is asserted in
  `mageAbilities.test.ts`; `everySpellScales` cannot reach it because it is an aura
  with no ability behind it.
- **A channel is a cast that ticks and nothing else about it is new.**
  `channelTicks` runs `onCast` that many times inside `castTimeMs`. Haste shortens
  the channel, so ticks come faster and there are still the same number. Arcane
  Missiles is 55.7% of the Arcane Mage. **A cast reaction fires once per tick**,
  which is what `cast.final` exists to tell apart.
- **THE MAGE'S "SCHOOLS" ARE WRITTEN OUT AS ABILITY IDS, in three lists now.**
  `FIRE_SPELL_IDS`, `FROST_SPELL_IDS` and `MAGE_DAMAGE_SPELL_IDS` all live in
  `auras/mage.ts` and are shared with `reactions/mageTalents.ts`, because two
  copies of "which spells are Fire" is one too many — the failure of them
  disagreeing is Ignite firing off a spell Combustion does not count, with both
  numbers plausible. `MAGE_COSTED_SPELL_IDS` is checked against the book by a test.
- **WHAT APPLIES WINTER'S CHILL AND WHAT BENEFITS FROM IT ARE DIFFERENT SETS.**
  Any Frost damage spell applies it; only Ice Lance and Frostbolt crit more for
  it. Frostfire Bolt is in the first and not the second, and that asymmetry is
  the kind a reader assumes away.
- **FROSTFIRE BOLT IS IN THE FIRE LIST *AND* THE FROST LIST, on purpose.** Its
  own spellbook entry says it "counts as both Frost and Fire damage"; it is
  DEALT as Fire because a `DamageRequest` carries one school, and that is a
  modelling choice rather than a claim that it is not Frost.
- **Hot Streak names four spells and Pyroblast is not one**, which is what stops it
  feeding itself. Read the owner's own words for what a talent selects.
- **A duplicate ability id in a list is legal and sometimes correct.** Arcane
  Missiles is in its list twice on purpose — gated on a proc above, ungated as the
  filler below. A test that said "no ability twice" failed this correct list.
- **Shatter is joined to Fingers of Frost BY AURA ID, a bare string.** Renaming the
  aura would leave Shatter pointing at nothing and paying nothing with no compile
  error. `mageAbilities.test.ts` asserts the LINK rather than the two ids separately.
- **`arcane_mind` reads its SECOND value** for the crit-damage clause. Reading index
  0 would give the intellect clause a tenfold value and the crit clause a tenth.
- **TWO SINGLE-RANK TALENTS NOW CARRY A HAND-FILLED VALUE**, `combustion` and
  `arcane_blast`, per `src/data/talents/values/README.md`. Both are reactions, and
  **an effect that reads no value is DROPPED rather than reported** — so the day
  one of those hand-filled entries is lost in a refresh, the talent goes silent
  rather than complaining. A test reads each back and compares it to the constant
  beside the aura.

---

## What "done" looks like from here

1. **Spell hit per school merged** — the Mage's two talents are wired on
   `priest-deep-dive`, and merging it takes this class to 12 gaps. Nothing here
   depends on it; the two branches touch `mageEffects.ts` in different places
   and will conflict textually.
2. **The spell exclusion list proposed and approved.** Three Mage gaps are
   waiting on it, and **Cone of Cold is the best candidate in the project** —
   captured in full, single-target-relevant, and the only Frost spell with a
   cooldown Cold Snap could reset.
3. **Is "nothing attacks the Mage" worth a ruling?** Seven talents and eleven of
   the Arcane build's fifty-one points. It is not one of the five scope members
   and the encounter genuinely can hit back, so it is a real question rather
   than a gap — but it will never be reached by a damage profile.
4. **Is Frostbite covered by the crowd-control ruling?** Its only effect is
   applying a ROOT, which is out of scope; what a Mage buys with the root is
   damage. `improved_blizzard` was the easy half of this question and is
   settled; this is the hard half and wants the owner.
5. **Arcane Blast's ending confirmed.** The reading chosen is worth most of
   +58.3 to this class's best profile, and it is a reading.
