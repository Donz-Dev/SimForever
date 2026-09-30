# PRIEST DEEP DIVE

**Class:** Priest
**Profiles to audit and prepare:** Shadow

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**THE PRIEST HAS ONE PROFILE AND THE PROJECT'S LARGEST RULED-OUT COLUMN — 18 — AND
BOTH FACTS SHAPE EVERYTHING HERE.**

One profile means **there is no cross-check.** Every other class has two or three
builds, and "does this finding hold for the other builds of the same class" is a
question this class cannot answer. When the Paladin's Hammer of Wrath looked broken,
the Shockadin firing it 0.3 times a fight is what proved the ability worked and the
build could not afford it. **The Priest has no second build to do that with.** Treat
any single-profile finding here as less settled than the same finding elsewhere.

Eighteen ruled out is because two of the three trees are healing, and **healing
THROUGHPUT is out of scope by ruling** — but **mana RETURN is NOT**, because it
changes a damage profile's sustain. That distinction is the one to hold while
reading this class's reasons.

---

## The profile

| Profile | Talents | DPS | List | Entries |
| --- | --- | --- | --- | --- |
| Shadow | 16/3/32 | **437.3** | `PRIEST_SHADOW` | 6 |

**Eighth-highest of the 23**, and **it went DOWN 10.8 on the owner's list.** That is
Shadow Word: Death coming out, **isolated at −35.7 against +24.9 for the rest of the
list** — so the rest of the owner's changes were worth +24.9 and one removal cost
more than that. The owner's design, and the number is recorded rather than acted on.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Top sources |
| --- |
| Mind Flay 47.5%, Shadow Word: Pain 26.4%, Mind Blast 17.9%, Devouring Plague 8.3% |

**FOUR SOURCES, AND MIND FLAY IS NEARLY HALF.** No auto attack — a `caster` style has
none. **Mind Flay is a channel**, so everything about channel mechanics matters more
here than anywhere else: `channelTicks` runs `onCast` that many times inside
`castTimeMs`, haste shortens the channel so ticks come faster and there are still the
same number, and **the caster stays locked for the whole channel** — freeing them per
tick would let the rotation cast over its own channel.

**Shadow Word: Pain at 26.4% is a pure DoT**, which is exactly the category
`everySpellScales.test.ts` once skipped entirely: its first version filtered on
`attackTable === 'spell'` and **silently missed every pure DoT**, because a spell that
only applies an aura declares no table. That list is discovered from the event stream
now.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 53 | 15 | 2 | **18** | **18** |

### The 18 live gaps, grouped by cause

**Nothing attacks the Priest (seven):** `improved_power_word_shield`, `martyrdom`,
`improved_inner_fire`, `soul_warding`, `spell_warding`, `blessed_recovery`,
`twilight_focus`

**A Shadow list never casts them (five):** `power_in_light` (Smite and Penance),
`improved_mana_burn`, `holy_nova` (an area spell, one target),
`wand_specialization` (wands are not modelled), `divine_fury`'s Smite half

**Spell hit per school (two):** `holy_precision`, `shadow_focus` — **shared with the
Mage ×2 and the Paladin, eight talents for one engine capability**

**Needs a kill or a death:** `spirit_tap` (a kill), `spirit_of_redemption` (the
Priest dying, which a damage profile does not)

**A declaration that does not exist yet:**

| Talent | What it needs |
| --- | --- |
| `inner_focus` | free next spell **plus 25% crit on it**. The cost half is a `CastModifier` a talent cannot grant one-shot; **the crit half is a one-shot per-ability CRIT modifier, which `CastModifier` does not carry** |
| `power_infusion` | a 20% spell damage buff on a TARGET, which for one character is itself. **Its own reason says "Expressible — and"**, so this one is closer than the rest |

### `early_demise` IS THE FINDING IN THIS FILE

| Talent | Current reason |
| --- | --- |
| `early_demise` | "It needs the target at or below 20% health, and the target never drops." |

**THAT REASON WAS WRONG AND IS NOW CORRECTED IN THE SOURCE.** It was the exact
mistake Hammer of Wrath's docs made, for the third time.
A low-health requirement in this project is **the CLOCK**: `inExecutePhase` in
`combat/executePhase.ts` reads remaining combat TIME against 20% of the planned
duration, by the owner's ruling, made for Execute and deliberately shared.

Early Demise is **"Increases Shadow Word: Death's critical strike chance on targets
at or below 20% health by 15%/30%"** — **the same 20%**, at two ranks, both values
present in `values/priest.json`. **It is expressible today with no new data and no
new engine capability.**

**It is doubly dead, which is why nobody noticed:** its condition reads health, AND
the ability it modifies is the one the owner's list removed. Fixing the condition
alone changes nothing until Shadow Word: Death is cast — so **this is one item with
two halves, and they should be decided together.**

**THE MECHANISM IS SHARED WITH THE ROGUE'S QUIETUS**, which the owner has now ruled
at 35%: a per-ability modifier conditional on the fight's final fraction, crit here
and damage there. `Combatant.abilityModifierFor` has no simulation to read a clock
from, and that is the actual work in both. **Build it once** — Quietus is the safer
place to do it, because no profile takes it and it moves no number.

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `divine_fury` | Smite and the heals, none of which a Shadow list casts |
| `devouring_contagion` | its mana reduction applies; **its spread clause needs a target to die** |

---

## Never-fired entries

**None.** The Shadow list has every entry firing.

## In the book, in no list, never cast

`shadow_word_death` — **and it is the only one**, which makes this the cleanest book
in the project. It is out because the owner's list removed it, isolated at **−35.7**.

---

## Traps specific to this class

- **SHADOW WEAVING IS ON THE CASTER IN FOREVER AND ON THE TARGET IN CLASSIC.** Read
  the owner's own words for what a talent selects; this one differs from Classic in a
  way that changes who carries the aura.
- **Twin Disciplines selects "instant cast spells", which no declaration expresses**,
  so it names them one by one. That is the accepted answer, not a gap.
- **`resourceFlow` ONCE REPORTED A MOONKIN SPENDING MORE "RAGE" THAN ITS MANA POOL**,
  and a test depended on it. It took a `resource` argument and discarded it with
  `void resource`, so every pool a character owned was summed under one heading with
  shares totalling a tidy 100%. **Check that a number is about what its label says
  before trusting that it adds up.**
- **Every DoT can crit and none is reduced by armor** — a Forever rule, not Classic's.
  A tick does not re-roll the table but **rolls for a crit at the crit chance of the
  kind of event that applied it**, named by `DamageRequest.critFrom`. No `critFrom`
  means no crit and no random number consumed, **so adding the field never shifts a
  seeded run.**
- **A tick is reached for CRIT and not for DAMAGE.** The crit fields read
  `attackTable ?? critFrom`; the damage multiplier reads `attackTable` alone.
- **Devouring Plague's tick HALVED when the sheet arrived**, against the old derived
  `duration / 15` rule. Every derived coefficient in this project is gone and the
  sheet states them outright — **a derived number that looks reasonable is exactly
  what this project is built not to trust.**
- **`percentAdd` without `scale: 0.01` is a thousand percent**, and it survived two
  class PRs because **a caster with a very large mana pool looks exactly like a caster
  with a very large mana pool.** This is a caster class with a large pool.
- **There is no second Priest build**, so the usual "does it hold for the other builds
  of the same class" check is unavailable. Say so when reporting a finding here.

---

## What "done" looks like

1. **`early_demise` and Shadow Word: Death decided together.** The talent is
   expressible today; the ability is out of the list by the owner's choice at a
   measured −35.7. **One item, two halves** — and the talent's current reason must be
   corrected either way, because it is wrong about the engine.
2. **Spell hit per school scoped with the Mage and Paladin** — eight talents, one
   capability, and two of them are here.
3. **`power_infusion` finished**, since its own reason says it is expressible.
4. **`inner_focus` split into its two halves** — a one-shot cost modifier (which
   `grantCastModifier` can nearly do) and a one-shot per-ability crit modifier (which
   nothing can). The second is an engine gap shared with the Paladin.
5. **A second Priest profile considered.** Not required, but this is the only class
   where every finding is uncorroborated by a sibling build, and the project has been
   caught by exactly that shape before.
