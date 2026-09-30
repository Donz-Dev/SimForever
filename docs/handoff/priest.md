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
— all real work, none of it worth a single point of the profile's DPS, because
the build does not take any of the three.

**What the profile took was `shadow_focus` 5/5, and it was buying nothing.** Five
percent spell hit on a build whose damage is entirely Shadow. It is fixed, and it
is **+17.4 DPS**.

**THE PRIEST STILL HAS ONE PROFILE AND THEREFORE NO CROSS-CHECK.** Every other
class has two or three builds, and "does this finding hold for the other builds of
the same class" is a question this class cannot answer. Treat any single-profile
finding here as less settled than the same finding elsewhere. Spell hit is the
exception and only by accident: it landed on five profiles across three classes at
once, so the Mage and the Paladin corroborated it.

**Eighteen ruled out** is because two of the three trees are healing, and healing
THROUGHPUT is out of scope by ruling — but **mana RETURN is NOT**, because it
changes a damage profile's sustain. That distinction is the one to hold while
reading this class's reasons, and it is why `spirit_tap` below is a live gap
rather than a ruling.

---

## The profile

| Profile | Talents | DPS | List | Entries |
| --- | --- | --- | --- | --- |
| Shadow | 16/3/32 | **454.7** | `PRIEST_SHADOW` | 6 |

**437.3 → 454.7, +17.4, REAL**, all of it Shadow Focus. It goes from eighth of
the 23 to **sixth**, and the sixth is by 0.1 over Prot Warr's 454.6 — which is
inside both intervals and is therefore a tie, not a lead.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals. Every entry fires and
the shares sum to 100%.

| Top sources |
| --- |
| Mind Flay 48.0%, Shadow Word: Pain 25.6%, Mind Blast 18.8%, Devouring Plague 7.6% |

**FOUR SOURCES, AND MIND FLAY IS NEARLY HALF.** No auto attack — a `caster` style
has none. **Mind Flay is a channel**, so channel mechanics matter more here than
anywhere else: `channelTicks` runs `onCast` that many times inside `castTimeMs`,
haste shortens the channel so ticks come faster and there are still the same
number, and **the caster stays locked for the whole channel**.

**THE SPLIT BETWEEN WHAT ROLLS AND WHAT DOES NOT IS WHY SHADOW FOCUS IS WORTH
+17.4 AND NOT +22.** Mind Flay and Mind Blast roll the spell table and are 66.8%
of the damage. Shadow Word: Pain and Devouring Plague **apply auras and roll no
table at all** — a tick's landing was settled when the aura went on — so five
points of hit reach two thirds of the build. 17% spell miss to 12% is +6.0% on
what rolls, which is what the measurement says.

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

### The 13 live gaps, grouped by cause

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

**Cast pushback (one):** `twilight_focus`. Reworded to match the Mage's
Improved Channeling and the Warlock's, so the family expires together — and it is
blocked TWICE, because pushback is not modelled at all and would still be inert
on a profile that was attacked.

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `divine_fury` | Smite and the heals, none of which a Shadow list casts |
| `devouring_contagion` | its mana reduction applies; **its spread clause needs a target to die** |

---

## The two findings

### 1. Shadow Word: Death costs 35.2 DPS to leave out, RE-MEASURED

`shadow_word_death` is in the book, in no list, and cast by none of the 23 — the
only such ability the Priest has, which still makes this the cleanest book in the
project. It is out because the ruleset owner's list removed it.

**Re-isolated at the new baseline: putting it back is 454.7 → 489.9, +35.2,
REAL.** The figure recorded when it was removed was −35.7, measured before spell
hit existed; it has not moved, so spell hit and Shadow Word: Death are
independent and the cost of the owner's choice is confirmed rather than assumed.

**THE OWNER'S LIST OUTRANKS A MEASURED DECISION OF OURS, so it stays out and the
number is the price of the choice** — the same resolution Hunter's Mark got at
−10.1. It is the largest single cost of any list decision on this profile.

### 2. `early_demise` and Shadow Word: Death were ONE item and are now decided

Its old reason said "it needs the target at or below 20% health, and the target
never drops". **That was wrong about the ENGINE, not merely stale** — a low-health
requirement in this project is the CLOCK, and that was the third time the
reasoning had been got wrong. It is built.

**AND IT IS TRIPLY UNREACHED BY THIS PROFILE, which is worth stating rather than
leaving as a surprise:** the Shadow build does not take it, the ability it
modifies is Shadow Word: Death, and that ability is not in the list. It moves no
figure and is tested on its MECHANISM — which is the distinction between a talent
WORKING and a talent MATTERING.

**THE MECHANISM IS SHARED WITH THE ROGUE'S QUIETUS** and was built once:
`AbilityModifiers.addWhileFinalFraction`, crit here at 20% and damage there at
35%. Both read their threshold out of their own data rather than importing
`EXECUTE_PHASE_FRACTION`, because the talent's 20 and Execute's 0.2 agree today
and are different facts.

---

## Never-fired entries

**None.** Every entry in the Shadow list fires. `USES=1` confirms it.

---

## Traps specific to this class

- **THE CENSUS IS THE CLASS AND NOT THE PROFILE.** Read the preset's allocation
  before deciding what is worth building. Sixteen of the Shadow build's 51 points
  were on live gaps and eleven still are; the other nine live gaps are talents it
  never had.
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

1. **Is a talent that triggers on a KILL in scope?** `spirit_tap` is **five points
   of the owner's own build** and the largest dead allocation in any profile in
   this project. Its mana half — "your Mana will regenerate at 50% of normal rate
   while casting" — is mana RETURN and explicitly IN scope; what gates it is the
   kill, and the encounter is a damage sink that survives every fight by design.
   One talent, one question.
2. **Is "the Priest is not attacked" a ruling or a missing profile?** Six talents
   hang on it, and three more points of the Shadow build
   (`improved_power_word_shield`). The engine models incoming damage, so this is
   not an engine gap; a Priest tank profile is not a thing this ruleset has.

---

## What "done" looks like from here

1. **A second Priest profile, if one exists.** Still the only class where every
   finding is uncorroborated by a sibling build. It would not reach the six
   `NOT_ATTACKED` talents — a second Priest DAMAGE build is still not attacked —
   but it would give `holy_precision`, `power_in_light` and `divine_fury`'s Smite
   half something to be measured on, and it would answer whether +17.4 for five
   points of hit holds for a build with a different mix of rolling and
   non-rolling damage.
2. **The two questions above**, which between them are eight talents and eleven
   points of the one build.
3. **Nothing else here is a missing declaration.** The remaining live gaps need
   either a ruling, an encounter the class does not have, or content nobody has
   asked for (Mana Burn, Holy Nova, wands).
