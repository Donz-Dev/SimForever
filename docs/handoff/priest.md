# PRIEST DEEP DIVE

**Class:** Priest
**Profiles:** Shadow

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**A CENSUS COUNTS A CLASS AND A PROFILE SPENDS POINTS, and for this class the two
answers are almost disjoint.** The Priest had 18 live gaps and the one Shadow
build TOOK four of them. Reading the census as the profile's to-do list sent the
first pass of this document at `early_demise`, `power_infusion` and `inner_focus`
— all real work, and none of it worth a point of the profile's DPS at the time,
because the build took none of the three.

**AND THE SECOND LESSON IS THE OTHER HALF OF THE FIRST: A CORRECT TALENT CAN BE
READING THE WRONG NUMBER, AND NO AUDIT IN THIS PROJECT ASKS.** Improved Mind
Flay's effect declared `valueIndex: 1` against a row of
`[damage%, yards, slow%]` — so it applied the RANGE as a damage multiplier.
`coefficient_probe` asks whether damage responds to a stat and
`ability_audit` asks whether an ability is connected; neither asks whether a
multiplier is the RIGHT multiplier, and the talent was 10% where it should be
20% for as long as it existed. **+18.2 DPS**, and Mind Flay is the biggest
single source in the build.

**THE PRIEST STILL HAS ONE PROFILE AND THEREFORE NO CROSS-CHECK.** Every other
class has two or three builds, and "does this finding hold for the other builds of
the same class" is a question this class cannot answer. Treat any single-profile
finding here as less settled than the same finding elsewhere. Spell hit was the
exception and only by accident: it landed on five profiles across three classes at
once, so the Mage and the Paladin corroborated it.

**Nineteen ruled out** is because two of the three trees are healing, and healing
THROUGHPUT is out of scope by ruling — but **mana RETURN is NOT**, because it
changes a damage profile's sustain. That distinction is the one to hold while
reading this class's reasons, and it is why `spirit_tap` below is a live gap
rather than a ruling.

---

## The profile

| Profile | Talents | DPS | List | Entries |
| --- | --- | --- | --- | --- |
| Shadow | 13/3/35 | **597.9** | `PRIEST_SHADOW` | 7 |

**516.4 → 597.9, +81.5, REAL**, and twenty-three of the twenty-four profiles
identical to the decimal. Four things moved it, each isolated by removing it from
the finished configuration:

| | |
| --- | --- |
| Shadow Word: Death back in the list | **+37.7** |
| The owner's new 13/3/35 talent build | **+18.7** |
| Improved Mind Flay reading the damage instead of the yards | **+18.2** |
| The hold band on Shadow Word: Death | **−4.9** |

**THEY DO NOT SUM TO 81.5 AND SHOULD NOT.** Each is a MARGINAL figure measured
against the other three being present, so they interact — Improved Mind Blast
cutting Mind Blast's cooldown to 5.5 seconds changes what a global cooldown given
to Shadow Word: Death costs, and the Mind Flay fix changes what the filler is
worth. Quoting a sum would be inventing a number none of the runs produced.

**THE 13/3/35 BUILD ANSWERS THE FIRST OPEN QUESTION THIS DOCUMENT PUT TO THE
OWNER.** Spirit Tap is out of it — five points waiting on a kill that never
happens, and the largest dead allocation in any profile in the project. Mental
Agility goes with it; Improved Mind Blast 5, Early Demise 2 and Silence 1 come
in. **Early Demise arriving is the whole reason Shadow Word: Death needed a hold
band**, so items in this brief turned out to be one item.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals. Every entry fires and
the shares sum to 100%.

| Top sources |
| --- |
| Mind Flay 35.2%, Mind Blast 25.6%, Shadow Word: Pain 21.5%, Shadow Word: Death 11.7%, Devouring Plague 6.0% |

**FIVE SOURCES NOW, AND MIND FLAY IS NO LONGER HALF.** It was 48.0% against a
Mind Blast on 18.8%; Improved Mind Blast 5/5 takes that spell's cooldown from
8 seconds to 5.5 and its casts from 5.9 a fight to 8.7, so the filler gets
fewer global cooldowns and the table flattens. No auto attack — a `caster` style
has none.

**MIND FLAY IS A CHANNEL**, so channel mechanics matter more here than anywhere
else: `channelTicks` runs `onCast` that many times inside `castTimeMs`, haste
shortens the channel so ticks come faster and there are still the same number,
and **the caster stays locked for the whole channel**.

**THE SPLIT BETWEEN WHAT ROLLS AND WHAT DOES NOT is why Shadow Focus was worth
+17.4 rather than the +22 the tooltip suggests.** Mind Flay, Mind Blast and
Shadow Word: Death roll the spell table; Shadow Word: Pain and Devouring Plague
**apply auras and roll no table at all** — a tick's landing was settled when the
aura went on. 17% spell miss to 12% is +6.0% on what rolls, and a bit over a
quarter of this build does not roll.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 53 | 20 | 2 | **19** | **12** |

Was 15 / 2 / 18 / **18**. Five talents left the gap column here, and a sixth
left it when the Shaman dive's `castPushback` ruling landed -- `twilight_focus`,
which is why this row reads 12 rather than the 13 this dive measured: `shadow_focus`,
`holy_precision`, `early_demise`, `inner_focus`, `power_infusion`.

### What was built

| Talent | What it needed, and what that turned out to be |
| --- | --- |
| `shadow_focus` 5/5, `holy_precision` | Spell HIT for a school. **The reason was half right, which is why it lasted:** hit IS settled by the attack table before any per-school modifier — and the school's modifier is one of the three `combineModifiers` folds into the chances BEFORE the roll. The route was there and `AbilityModifier` had no field to carry hit along it. `schoolHit` |
| `early_demise` | A per-ability CRIT modifier conditional on the fight's final fraction. Built with the Rogue's Quietus, as one mechanism with two callers |
| `inner_focus` | Its crit half was "a one-shot per-ability crit modifier, which nothing carries" — true of `CastModifier` and false of the project. **Fingers of Frost is already this shape** |
| `power_infusion` | Nothing. Its own reason said "Expressible — and no Shadow build reaches it, so it is written down rather than built", which is a fact about a BUILD standing in for a fact about the CLASS |

### The 12 live gaps, grouped by cause

**Nothing attacks the Priest (six):** `improved_power_word_shield`, `martyrdom`,
`improved_inner_fire`, `soul_warding`, `spell_warding`, `blessed_recovery`

**THIS GROUP IS THE ENCOUNTER, NOT THE ENGINE**, and the reasons now say so.
`targetAttacks` exists and three profiles in other classes use it — Prot Warr,
Prot Pally and Bear all take damage, ramp, and can die. What the Priest has is no
TANK profile, because a Priest is not one here. Two of the six (`spell_warding`,
`improved_inner_fire`) are ordinary numbers the engine already has a place for,
and **declaring them would move nothing and report as fully modelled**, which is
the less honest of the two answers. See the open question below.

**A Shadow list never casts them (four):** `power_in_light` (Smite and Penance),
`improved_mana_burn`, `holy_nova` (an area spell, one target),
`wand_specialization` (wands are not modelled)

**Needs a kill or a death (two):** `spirit_tap`, `spirit_of_redemption`

~~**Cast pushback (one):** `twilight_focus`~~ — **RULED OUT.** It was reworded
here to match the Mage's Improved Channeling and the Warlock's precisely so the
family would expire together, and it did: the Shaman dive got a `castPushback`
member out of the owner and all three went with it. **Three points of this
profile that were counted as work are now counted as a decision**, which is the
whole reason the wording was made to match.

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `divine_fury` | Smite and the heals, none of which a Shadow list casts |
| `devouring_contagion` | its mana reduction applies; **its spread clause needs a target to die** |

---

## The three findings

### 1. The hold band on Shadow Word: Death buys nothing, and the reason is arithmetic

`shadow_word_death` was in the book, in no list, and cast by none of the 23 — the
one ability the Priest had in that state. **It is in the list now**, on the
owner's instruction, and it is **+37.7**: the price recorded against it twice
while it was absent (−35.7 when it came out, +35.2 re-isolated later) turned out
to be a standing offer, and the owner took it.

**THE INSTRUCTION CAME WITH A HOLD BAND**: cast on cooldown, but not between 21%
and 35% of the remaining combat duration, so the ability comes off cooldown
inside the window Early Demise opens. It is implemented, shipped, and **measured
at −4.9**.

**IT BUYS NOTHING BECAUSE THE WINDOW IS SHORTER THAN THE COOLDOWN.** At this
profile's 60-second fight Early Demise's window is 11.6 seconds and Shadow Word:
Death's cooldown is 15, so **at most one cast can ever land inside it** — and an
ungated entry already lands that cast there on its own:

| | casts a fight | of those, in the window |
| --- | --- | --- |
| held | 3.53 | **1.00** |
| unheld | 4.00 | **1.00** |

Identical where it matters and half a cast apart everywhere else, and that half
cast is the whole −4.9. The 2×2 confirms it from the other side: **Early Demise
is worth +5.2 held and +4.9 unheld**, so the hold does not move the talent it
exists for.

**THE OWNER'S LIST OUTRANKS A MEASURED DECISION OF OURS, so the band stays and
the number is the price of the choice** — the same resolution Hunter's Mark got
at −10.1. Removing one word restores 4.9 whenever the owner wants it.

**AND THE FIRST RATIONALE WRITTEN FOR THE BAND WAS FALSE, which is the lesson
worth more than the 4.9.** It said the band was "one cooldown wide", because 15%
of a 100-second fight is 15 seconds — the cooldown exactly. **The fight is sixty
seconds.** The band is 8.7 seconds. The arithmetic was self-consistent and about
a fight that does not exist, and a test had been written that asserted it and
passed. A rationale is a claim and wants measuring like any other.

### 2. Improved Mind Flay was applying the RANGE as a damage multiplier

Its row is `[damage%, yards, slow%]` and the effect declared `valueIndex: 1`.

**THE ROW IS WHAT HID IT.** At 2/2 the values are `[20, 10, 20]`, so index 1 gave
10% where the talent grants 20% — and 10 is both a plausible damage percentage
AND exactly what rank 1 correctly grants. **The talent read as one rank behind
itself.** Mind Flay still scaled, still crit, and still took the largest share of
the damage table; `coefficient_probe` asks whether damage responds to a stat and
`ability_audit` asks whether an ability is connected, and **neither asks whether
a multiplier is the right multiplier**. +18.2.

### 3. The reported spell power was the school-blind pool: 204 against a real 561

`BatchStatAverages.spellPower` is the school-BLIND figure, and `dealDamage` has
always read `spellPowerFor(source, school)` — the blind pool plus the school's
own. The equipped set scopes **357** to Shadow, so the results page was reporting
36% of the number every one of this profile's spells actually used.

**IT WAS WRONG BY 63% AND NOTHING CONTRADICTED IT.** The figure was plausible, it
agreed exactly with the character sheet's own blind row, and **the sheet lists the
scoped pools in a different panel** — so the two pages never had to agree, and
each was internally consistent. The sample carries the scoped pools now, through
`spellPowerFor` so there is one expression of the rule, and the results page
grows a row per school that differs.

**KEYED BY SCHOOL RATHER THAN FOLDED IN**, because a hybrid has two and neither
is "the" spell power. There is no single number to fold them into without
choosing one, and choosing one is how a row comes to be about something other
than its label.

---

## Never-fired entries

**None.** Every one of the seven entries in the Shadow list fires, and the
Priest's book now holds nothing that no profile casts. `USES=1` confirms both.

**THE HOLD BAND IS THE ONE THING `USES=1` CANNOT CONFIRM**, and it is worth
knowing why: an entry firing the right NUMBER of times in the wrong PLACES looks
exactly like a working one. `tests/game/shadowWordDeathHold.test.ts` reads the
cast timestamps out of the event stream across 40 seeds instead — zero casts in
the band, and 21 back in it the moment the condition is removed, which is the
check that the test tests something.

---

## Traps specific to this class

- **THE CENSUS IS THE CLASS AND NOT THE PROFILE.** Read the preset's allocation
  before deciding what is worth building. The 13/3/35 build now spends **three**
  of its 51 points on live gaps — `improved_power_word_shield`, and that is all —
  against sixteen before, because the owner's revision dropped Spirit Tap and the
  `castPushback` ruling took Twilight Focus. The other eleven live gaps are
  talents it never had.
- **AND A TALENT THAT APPLIES CAN STILL BE APPLYING THE WRONG NUMBER.** The
  census has four columns and none of them is "correct": Improved Mind Flay was
  counted as fully modelled for its whole life while multiplying by the range.
  **A multi-number row is where to look** — `valueIndex` is silent when wrong,
  and the plausible wrong value is usually another rank's right one.
- **SHADOW WEAVING IS ON THE CASTER IN FOREVER AND ON THE TARGET IN CLASSIC.**
  Read the owner's own words for what a talent selects.
- **Twin Disciplines selects "instant cast spells", which no declaration
  expresses**, so it names them one by one. That is the accepted answer, not a gap
  — and `INNER_FOCUS_CRITTABLE` and `SHADOW_SPELLS` are two more lists of the same
  kind, for the same reason: `CastModifier` and `AbilityModifiers` select by id.
- **INNER FOCUS COULD NOT HAVE USED `consumedByCast`, AND THE FAILURE WOULD HAVE
  BEEN SILENT.** That field spends at cast START — before `runCast`, and 1.5
  seconds before a Mind Blast lands — so the aura carrying the 25% crit would be
  gone by the time anything rolled. The cost would still have come off. A free
  cast with no crit, reporting itself fully modelled.
- **POWER INFUSION IS `abilityModifiers` AND NOT `damageDoneMultiplier`**, because
  "spell damage" is not physical damage. `ALL_ABILITIES` on an aura reaches every
  ability and no auto attack, and a Priest owns no physical ability — so the two
  readings are the same set here and **would not be on a hybrid**.
- **`resourceFlow` ONCE REPORTED A MOONKIN SPENDING MORE "RAGE" THAN ITS MANA
  POOL**, and a test depended on it. Check that a number is about what its label
  says before trusting that it adds up.
- **Every DoT can crit and none is reduced by armor** — a Forever rule, not
  Classic's. A tick rolls for a crit at the crit chance of the kind of event that
  applied it, named by `DamageRequest.critFrom`. No `critFrom` means no crit and
  no random number consumed, **so adding the field never shifts a seeded run.**
- **A tick is reached for CRIT and not for DAMAGE.** The crit fields read
  `attackTable ?? critFrom`; the damage multiplier reads `attackTable` alone.
- **Devouring Plague's tick HALVED when the sheet arrived**, against the old
  derived `duration / 15` rule. **A derived number that looks reasonable is
  exactly what this project is built not to trust.**
- **`percentAdd` without `scale: 0.01` is a thousand percent**, and it survived
  two class PRs because **a caster with a very large mana pool looks exactly like
  a caster with a very large mana pool.**
- **There is no second Priest build**, so the usual "does it hold for the other
  builds of the same class" check is unavailable. Say so when reporting a finding
  here.

---

## Open questions for the ruleset owner

Both are the same shape stealth had before it was ruled on: an ENCOUNTER property
that no amount of engine work reaches, counted as a live gap because no
`OutOfScope` member covers it.

1. ~~**Is a talent that triggers on a KILL in scope?**~~ **ANSWERED BY THE
   BUILD, NOT BY A RULING, and the distinction matters.** The owner's 13/3/35
   revision drops `spirit_tap`, so the five dead points are gone from the
   profile — but the TALENT is still a class-level live gap waiting on a kill
   that never happens, and `spirit_of_redemption` sits beside it waiting on the
   Priest dying. **The queue did not shrink; the profile stopped paying for
   it.** Worth asking the narrower question now: is a kill trigger ever going to
   be in scope, or should these two carry a ruling?
2. **Is "the Priest is not attacked" a ruling or a missing profile?** Six talents
   hang on it, and it is now the ONLY live gap the profile still spends points on
   — three, on `improved_power_word_shield`. The engine models incoming damage, so this is
   not an engine gap; a Priest tank profile is not a thing this ruleset has.

---

## What "done" looks like from here

1. **The hold band on Shadow Word: Death is worth 4.9 to the owner, one word.**
   It is shipped as instructed and it buys nothing, because the Early Demise
   window is shorter than the ability's cooldown and an ungated entry already
   lands its one cast inside it. **The owner's call, with the number next to it.**
2. **A second Priest profile, if one exists.** Still the only class where every
   finding is uncorroborated by a sibling build. It would not reach the six
   `NOT_ATTACKED` talents — a second Priest DAMAGE build is still not attacked —
   but it would give `holy_precision`, `power_in_light` and `divine_fury`'s Smite
   half something to be measured on.
3. **The two questions above**, which between them are eight talents and the
   three points of the build that are still on a live gap.
4. **Nothing else here is a missing declaration.** The remaining live gaps need
   either a ruling, an encounter the class does not have, or content nobody has
   asked for (Mana Burn, Holy Nova, wands).

**AND ONE THING THAT IS NOT PRIEST WORK AT ALL: the Improved Mind Flay bug has a
shape, and this class is not the only place it can live.** A `valueIndex` into a
multi-number row is silent when wrong, the census cannot see it, and the
plausible wrong value is usually another rank's right one. Every class's values
file has rows with two and three numbers in them. **Nothing has swept them.**
