# MAGE DEEP DIVE

**Class:** Mage
**Profiles to audit and prepare:** Frostfire, Arcane, Fire

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**THIS CLASS HAS NOW BEEN WRONG IN THREE DIFFERENT PLACES AND ONLY ONE OF THEM
WAS THE SIMULATION.**

| Where | What |
| --- | --- |
| the AURA | Combustion applied ten stacks by writing `instance.stacks` directly, of every school, for a placeholder 30 seconds. Arcane Blast's "+10% to all your other spells" was left out with a caveat. **+38.9 and +58.3** |
| the SCHOOL | Frostfire Bolt "counts as both Frost and Fire" and three Frost talents could not select it. **+38.0** |
| the REPORT | the miss column divided by every damage event including DoT ticks, so a hybrid's rate was diluted. **0.0 DPS and it still cost a day** — the ruleset owner read Elemental Precision off that column and reported a working talent as half-broken |

**NONE OF THE THREE WAS FOUND BY A TEST, AND THE THIRD COULD NOT HAVE BEEN** by
any test of the engine: the roll was always right. What finds a reporting bug is
a figure that disagrees with an expectation somebody holds, which is what the
owner supplied.

---

## The profiles

| Profile | Talents | DPS | List | Notes |
| --- | --- | --- | --- | --- |
| Frostfire | 0/29/22 | **661.3** | `MAGE_FROSTFIRE` | **now the top Mage**, on the three Frost talents that reach its filler |
| Fire | 10/39/2 | **622.0** | `MAGE_FIRE` | Combustion is a real ramp; Ignite rolls over |
| Arcane | 47/4/0 | **576.1** | `MAGE_ARCANE` | two spells and one aura |

**EVERY FIGURE HERE IS STALE THE MOMENT ANOTHER CLASS MERGES.** These are from
`4be5c09`; the Mage figures moved 412–450 to 576–661 between two deep dives
without the Mage being touched, because spell hit, the 16% cap and the raid buff
work all reached it. **Reprint rather than quote.**

### What the fine-tuning pass changed

The ruleset owner's seven items, with what each was worth:

| Item | Worth |
| --- | --- |
| **Frostfire Bolt counts as both schools** | **+38.0 to Frostfire.** Ten talents treat it as Frost and Fire; seven already did. Piercing Ice and Ice Shards select by SCHOOL and Frost Channeling by ABILITY ID, so the first two needed `countsAsSchools` and the third needed an id in a list |
| **Ignite cannot crit, and rolls over** | **+13.2 to Fire**, isolated: 608.8 with the old shape against 622.0 with this one. The two exceptions cut opposite ways and the roll-over is the larger |
| **Evocation at 10% mana, all three lists** | 0.9 casts a fight for Fire, 0.4 for Frostfire, **0.0 for Arcane** |
| **Presence of Mind at one Arcane Blast stack** | 1.0 casts a fight; Arcane −5.7, inside its interval |
| **Scorch gated on Improved Scorch** | 0.0 for all three profiles, which take it 3/3. A guard on the LIST, not a fix to a profile |
| **Elemental Precision "0.5% per point"** | **the talent was never broken.** See below |

### Elemental Precision was right and the column was wrong

**IT DELIVERS THE FULL 1% A POINT TO THE ROLL**, and the proof is the two spells
with nothing to dilute them: Arcane Blast and Arcane Missiles read **9.71% and
10.30% miss** against an expected 10.0% with `arcane_focus` 5/5 on a 15% table.

What the owner was reading was `avoidRate`, which divided by `attempts` —
**every damage event, DoT ticks included.** Frostfire Bolt is 21.8 attempts a
fight of which 12.0 are casts, so it reported **2.83% miss on a spell whose
casts miss 10%**, and toggling five points moved the displayed figure by about a
point and a half rather than five. Every hybrid in the project had it: Fireball
read 5.13% and reads 14.45% now.

The rates divide by non-periodic attempts; the damage total still includes the
burn, because a burn is part of the spell.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Arcane | **Arcane Missiles 55.7%, Arcane Blast 44.3%** |
| Fire | Pyroblast 42.2%, Fireball 27.9%, Scorch 16.2%, Ignite 13.7% |
| Frostfire | Frostfire Bolt 35.5%, Pyroblast 27.3%, Scorch 14.7%, Ice Lance 12.3%, Ignite 10.1% |

**THE SHAPES BELOW ARE FROM THE PREVIOUS PASS AND HAVE MOVED.** Reprint with
`npx vite-node tools/class_audit.ts mage`.

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
| 54 | 30 | 2 | **11** | **11** |

Down from 16. **`arcane_focus` and `elemental_precision` ARE closed now** — spell
hit per school landed with the Priest dive and wires both, which is why this row
reads 11 rather than the 12 this brief predicted: the Priest dive also closed one
more than expected.

### The 10 live gaps, grouped by cause

**~~Spell hit per school~~ — DONE, and not by this class.** `arcane_focus` and
`elemental_precision` read "improves your chance to hit with <school> spells" and
were inert on the claim that the attack table decides hit before any per-school
modifier is consulted. **That claim was false**: `rollTable` folds the school's
modifier in before the roll and always did, so the route existed and
`AbilityModifier` had no FIELD to carry hit along it. `hitBonus` is that field,
and one line in `talentBuild` reaches it — five talents across three classes for
the same line.

**~~`ice_block`~~ IS RULED OUT NOW, by a ruling that came from the Paladin.**
The owner ruled on 2026-10-07 that an immunity which also stops you attacking is
out of scope, and Forever's Ice Block says "you cannot attack, move, or cast
spells" for its ten seconds — so a Mage that WAS attacked still could not afford
to use it. **Blocked twice is what makes it a ruling rather than a gap**, which
is the shape stealth and cast pushback already had.

**Nothing attacks the Mage — the PROFILE, not the engine:** `improved_channeling`,
`magic_absorption`, `arcane_shielding`, `improved_fire_ward`, `frost_warding`,
`ice_barrier`. All three profiles set
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

- **A HYBRID'S MISS AND CRIT COLUMNS USED TO BE ABOUT ITS TICKS AS WELL AS ITS
  CASTS**, and that is how a working hit talent read as half-broken. The rates
  divide by non-periodic attempts now; the damage total does not, because a burn
  is part of the spell. **If a rate on the results page disagrees with the table
  arithmetic, check the denominator before the roll.**
- **FROSTFIRE BOLT IS DEALT AS FIRE AND COUNTS AS FROST**, through
  `countsAsSchools`. Ten talents name it and they fail in two different ways
  when it is missed: the SCHOOL-scoped ones silently select nothing, and the
  ABILITY-ID ones need the id adding by hand. **A talent that names both of its
  schools is paid ONCE** — additive fields take the larger and the damage
  multiplier multiplies, which is `casterSchoolModifier`'s whole comment.
  Elemental Precision is that talent and summing it put the bolt's miss at 5.26%.
- **IGNITE IS DEEP WOUNDS IN A DIFFERENT SCHOOL.** It cannot crit and it rolls
  over, both by the owner, because it is a DoT applied BY a crit. Its old
  comment argued the roll-over away on the grounds that Forever's tooltip says
  nothing about it and Classic's behaviour is not evidence — sound reasoning
  from the wrong source, since `periodic.pool` existed precisely because the
  owner had specified the same mechanic for Deep Wounds.
- **THREE OF THE MAGE'S TIER-10 FROST TALENTS ARE STRIPPED SILENTLY IN A TEST**
  unless the allocation spends ten points above them. Piercing Ice, Frost
  Channeling, Ice Lance and Improved Blizzard all sit there, and a probe with
  eight points read "Piercing Ice is worth exactly 1.0000" — which looks like a
  broken fix and is the documented trap.
- **`grantCastModifier` IS A PERMANENT AURA, so a cost has to be read inside a
  BEGUN fight.** Frost Channeling's 15% is invisible on `ability.cost.amount`
  and invisible to `resolveCast` on a character the encounter has not set up.

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
