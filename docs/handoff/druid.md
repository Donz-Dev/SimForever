# DRUID DEEP DIVE

**Class:** Druid
**Profiles to audit and prepare:** Moonkin, Cat, Bear

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**A DRUID'S FORM IS ITS COMBAT STYLE — A FIELD THE PRESET SETS — NOT AN AURA.**
The engine gates on Warrior stances and on nothing else, so **nothing stops a Cat
casting Starfire.** Three of the owner's list entries say "cat form if not active"
and are absent for that reason rather than being unimplemented.

That single fact explains **five** of the twelve live gaps: `moonkin_form`,
`furor`, `natural_shapeshifter`, `predatory_strikes` and part of
`heart_of_the_wild` all key off shifting or off which form is held. **The day
form-shifting is modelled mid-fight is the day that gate has to exist**, and five
talents become expressible at once. Until then they are one gap wearing five hats,
and they should be written up as such rather than as five independent items.

---

## The profiles

| Profile | Talents | DPS | List | Style |
| --- | --- | --- | --- | --- |
| Cat | 9/35/7 | **488.0** | `DRUID_CAT` | cat (paws) |
| Moonkin | 38/0/13 | **384.3** | `DRUID_MOONKIN` | caster |
| Bear | 9/42/0 | **376.2** | `DRUID_BEAR` | bear (paws) |

**Cat is the fourth-highest profile in the project.** Both feral profiles are
**understated by a known amount**: they hold the Glaive of Obsidian Fury, whose
"+172 Attack Power in Cat, Bear, and Dire Bear forms only" cannot be expressed,
because an item stat is not conditional on the combat style. That is one of the
open engine gaps and it is worth 172 attack power to two profiles.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Moonkin | Starfire 50.8%, Moonfire 20.9%, Insect Swarm 14.9%, Wrath 13.4% |
| Cat | Main Hand 46.2%, Shred 23.7%, Rip 23.5%, Rake 6.7% |
| Bear | Main Hand 36.2%, Primal Bite 29.7%, Maul 19.9%, Lacerate 14.2% |

**Only four sources each — these are the narrowest damage tables in the project.**
That makes every one of them load-bearing: a coefficient error on Starfire moves
half the Moonkin's damage.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 51 | 20 | 5 | **15** | **11** |

**Fourteen ruled out is the second-highest in the project** — the Druid's trees are
full of healing, positioning and crowd control, all four rulings at once.

### The 12 live gaps, grouped by cause

**Form and shifting (one gap, five talents — see above):** `moonkin_form`,
`furor`, `natural_shapeshifter`, `predatory_strikes`, and `heart_of_the_wild`'s
per-form clauses

**A declaration that does not exist yet:**

| Talent | What it needs |
| --- | --- |
| `genesis` | raises PERIODIC damage only. `abilityDamage` is per ability and `damageMultiplier` is everything — **the missing middle, and `SchoolModifiers` was built for exactly this shape once already** |
| `nature_s_splendor` | a per-ability aura DURATION bonus. No form exists |
| `nature_s_swiftness` | makes the NEXT Nature spell instant. **A one-shot cast-time modifier — the same gap the Shaman's Nature's Swiftness has, and Eclipse already does this for a named ability** |
| `rend_and_tear` | a damage multiplier conditional on the target having a BLEED. `critWhileAura` now exists for the caster's own aura; this wants the target's |
| `king_of_the_jungle` | energy when Tiger's Fury is used — a CAST reaction, **which the engine has**. Worth re-reading |
| `berserk` | three clauses and the engine reaches none: extra targets, a cooldown removed, a cost reduction |

**Encounter, not engine:** `leader_of_the_pack` (a party-wide aura — the engine
simulates one character, so it is a raid buff rather than a talent),
`nature_s_focus` (nothing interrupts a cast here)

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `improved_starfire` | its 15% stun, out of scope as every stun is |
| `heart_of_the_wild` | intellect applies; per-form stamina and attack power do not |
| `shredding_attacks` | the Shred reduction applies; its Lacerate clause is a second value the effect cannot read |
| `natural_reaction` | the dodge applies; rage on dodge needs the target to swing back |
| `naturalist` | the damage applies; the Healing Touch cast time does not |

---

## Never-fired entries

**None.** All three Druid lists have every entry firing.

## In the book, in no list, never cast

Mostly correct cross-form noise — a Moonkin carries every feral ability and casts
none of them. **Two are worth knowing:**

- **`claw` can never fire at ANY energy**, and its own comment used to explain why
  it should: "falls back when Shred is unaffordable, which at 60 energy it often
  is." **Both halves were wrong.** Improved Shred takes Shred to 42 and Ferocity
  takes Claw to 42, so the two cost the SAME and the harder-hitting one is above
  it. **Read costs off `characterAtCombatStart`, not off the ability declaration.**
- **`ferocious_bite` is cast by no profile at all.** `DRUID_CAT` is five entries and
  its finisher is `rip`. It was one of the twelve entries that once fired zero
  times, and removal is how it was resolved — worth confirming the owner intended
  a Rip-only finisher rather than assuming.

---

## Traps specific to this class

- **A DRUID'S PAW IS BUILT FROM THE WEAPON BEING HELD**, and Druids are **exempt
  from normalisation** because a paw is already one shape:
  `BasePaw + weaponDPS × formSwing + AP × formSwing / 14`, times `rand(0.8, 1.2)`,
  with the form's swing 1.0 for a cat and 2.5 for a bear.
- **A stat stick feeds the paw through its DPS but NOT through its speed.** The
  other reading of the owner's formula — held weapon's speed as the multiplier —
  put Cat at 988.8 and Bear at 909.2 and made paw damage proportional to how SLOW
  the held weapon was. **It was rejected on measurement.** Do not re-derive it.
- **A STAT-STICK STYLE IS TWO SEPARATE QUESTIONS** — is the item kept, and does it
  swing — and one commit got one wrong in each direction. `createPlayer` merges
  equipped weapons OVER the style's own, so a Cat once swung a real sword instead
  of a paw, **which read as a working feature.**
- **The GCD is 1.0 for a Cat-Form Druid**, and it belongs to the class.
- **A bear's paws earn rage at the one-handed rate**, 3.46 × base speed.
- **NATURE'S GRACE COST THE MOONKIN 14.9 DPS BY DOING NOTHING BUT SPEEDING IT UP.**
  Casts went 26.3 a fight to 27.4 while Moonfire ticks fell 25.1 to 22.5, because
  a refresh window CLIPS: refreshing at two seconds remaining throws away what is
  left, and the faster the character acts the sooner it reaches that entry. **The
  owner's lists say "if not active" instead.** A haste buff that measures as a loss
  is this, not a bug.
- **Mangle was RENAMED to Primal Bite** between client builds. It is 29.7% of the
  Bear's damage under the new name. Build drift is found only by refreshing
  captures, never by cross-checking.

---

## What "done" looks like

1. **The five form talents written up as ONE gap** — mid-fight form shifting — rather
   than five items, with the engine change scoped once.
2. **`king_of_the_jungle` re-read**, because its reason says the engine has no cast
   reaction and the engine does.
3. **`genesis` reached.** "Periodic damage only" is the same missing-middle shape
   `SchoolModifiers` was built for, and the Warlock's Pandemic wants a relative of it.
4. **The style-scoped item stat decided** — it is worth 172 attack power to both
   feral profiles and it is the only thing understating them by a known amount.
5. **`ferocious_bite`'s absence confirmed with the owner** rather than inherited.
6. **Nature's Swiftness built once** for both this class and the Shaman.
