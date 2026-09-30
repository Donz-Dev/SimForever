# PALADIN DEEP DIVE

**Class:** Paladin
**Profiles to audit and prepare:** Seal Twist Ret, Shockadin, Prot Pally

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**THIS CLASS HAS THE PROJECT'S LARGEST "PARTLY MODELLED" COLUMN — SEVEN — AND THAT
IS THE INTERESTING NUMBER, NOT THE TEN GAPS.** Seven talents do something and have
a clause that does not, and the clauses cluster into three shapes:

1. **A BLOCK IS NOT AN OUTCOME A REACTION CAN SEE.** `reckoning`'s extra attack
   after blocking and `holy_shield`'s "221 Holy damage for each attack blocked"
   both need it. A block LANDS and is reduced by a flat amount in the damage
   pipeline, deliberately not in `AVOIDED_OUTCOMES` — that flatness is the whole
   character of the stat. An aura can be spent by a block (`consumedByBlock`); a
   reaction cannot fire on one. **Both Paladin clauses that wanted it say so.**
2. **UNDEAD AND DEMON TARGETS.** `crusade`, `holy_conduit`, `purifying_power` — a
   raid boss is not Undead. That is the TARGET cause and expires only if the
   encounter changes.
3. **HOLY SPELL DAMAGE VERSUS FLAT ABILITY DAMAGE.** `consecrated_ground` is
   modelled as a flat bonus to Consecration where the tooltip raises Holy spells.

---

## The profiles

| Profile | Talents | DPS | List | Notes |
| --- | --- | --- | --- | --- |
| Seal Twist Ret | 13/0/38 | **471.0** | `PALADIN_RETRIBUTION` | fifth-highest in the project |
| Shockadin | 23/0/28 | **379.0** | `PALADIN_SHOCKADIN` | |
| Prot Pally | 8/36/7 | **153.2** | `PALADIN_PROTECTION` | **lowest in the project**, target attacks back |

**`encounter.targetAttacks` is what tells the two shield builds apart**, because
the style cannot and stances belong to the Warrior. Prot Pally went **DOWN 5.6** on
the owner's own list: Righteous Fury and Templar's Bulwark spend global cooldowns
on threat and survival, **neither of which is damage.** That is the build and the
scope rather than the list, and it is expected.

Seal Twist Ret gained **+27.2** from the owner's list, and **+10.0% earlier from
Holy Strike's doubling** (40% weapon damage on 12s → 50% on 10s) found by
refreshing captures.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Seal Twist Ret | Main Hand 47.7%, **Seal of Command 17.7%**, Holy Strike 10.0%, **Echo (Seal of Command) 8.8%**, Consecration 7.0%, Judgement 6.1% |
| Shockadin | Main Hand 27.1%, Seal of Righteousness 19.3%, Judgement 17.6%, Consecration 13.7%, Holy Shock 13.6%, Holy Strike 7.9% |
| Prot Pally | Main Hand 63.5%, Holy Strike 11.9%, Consecration 8.4%, Judgement 8.3%, Seal of Fury 7.8% |

**The Echo appearing as its own 8.8% source is the Twist of Light capstone
working** — replacing a seal grants an Echo and the next melee attack applies the
replaced seal's effects on top of the new one's.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 52 | 22 | 7 | 13 | **10** |

### The 10 live gaps, grouped by cause

**Healing, which is out of scope for THROUGHPUT:** `divine_favor` (two of three
spells are heals), `guardian_s_favor`

**Nothing attacks two of the three profiles:** `eye_for_an_eye` (reflects crits
taken, and only Protection is attacked — and it does not take this talent)

**Absorb shields:** `templar_s_bulwark` — an absorb worth the whole health pool,
which **granted would prevent every death in an encounter designed to measure
them**; `improved_seal_of_fury` and `shield_specialization` need that same shield

**Spell hit per school:** `divine_precision` — shared with the Mage ×2 and the
Priest ×2, **eight talents for one engine capability**

**A declaration that does not exist yet:**

| Talent | What it needs |
| --- | --- |
| `sanctified_judgement` | returns a PERCENTAGE of the judged seal's mana cost on Judgement. A refund proportional to a cost |
| `vindication` | **its CHANCE is not stated anywhere** — the values give the attack power taken and nothing else |
| `purifying_power` | Cleanse and Purify costs, plus Exorcism and Holy Wrath, and Undead-or-Demon only |

### Partly modelled — the seven

`consecrated_ground`, `sacred_duty`, `reckoning`, `holy_shield`, `holy_conduit`,
`sacred_arbiter`, `crusade`. See the three shapes at the top of this file.

---

## Never-fired entries

| Entry | Profile | Why |
| --- | --- | --- |
| `hammer_of_wrath` | Seal Twist Ret | **OUT OF MANA, NOT OUT OF WINDOW** |

**THIS IS THE PROJECT'S WORKED EXAMPLE OF MEASURING A CAUSE RATHER THAN INFERRING
ONE**, and it is written up in [docs/ability-audit.md](../ability-audit.md).

Its "20% or less health" is already the CLOCK — `inExecutePhase`, the same rule
Execute runs on — and `paladinAbilities.test.ts` pins it: refused for four fifths
of the fight, allowed in the last, target health untouched. **The window opens.**
Sampling `checkCast` through it gives **22 refusals for `not_enough_resource`
against 3 for `on_gcd`**, because this build spends **3425 of the 3449 mana it
gains.** The cost is not a transcription error: 425 mana, 1s cast, 6s cooldown all
confirmed against the capture at rank 3, which is max.

**The cross-check that it is mana and not the gate is the Shockadin**, which casts
the same entry 0.3 times a fight on 4129 mana gained. Left as is: reordering does
not conjure mana, and whether it beats the Judgement or Holy Strike it displaces
is unmeasured.

## In the book, in no list, never cast

`seal_of_fury`, `templars_bulwark`, `righteous_fury`, `seal_of_righteousness`,
`hammer_of_wrath` — varying by profile, and each is a seal or a defensive that
build does not use.

---

## Traps specific to this class

- **SEAL DAMAGE IS NOT A WEAPON USE**, by the owner's ruling, **and the swing
  carrying it still is.** Enforced by dealing every seal hit with **no
  `weaponSlot`** — so a seal hit cannot proc a Crusader or Hand of Justice, and the
  swing underneath it can.
- **THE SEAL TWIST CYCLE HAD NO ENTRY POINT and it is the one addition to the
  owner's orders.** Each seal was gated on the other being up, so after the opening
  Seal of the Crusader neither could ever fire and the profile named "Seal Twist"
  ran a whole fight on one seal. **Both entries measured zero uses and nothing
  errored.** The owner chose Seal of Command to seed it; the clause fires only
  while NEITHER of the pair is up.
- **JUDGEMENT DOES NOT CONSUME THE SEAL in Forever.** It is cast on cooldown and
  the seal underneath is untouched — the single biggest difference from Classic, and
  what makes this a priority list rather than a scripted sequence.
- **THE SHEET SUPERSEDED THE EARLIER SEAL OF RIGHTEOUSNESS FORMULA.** It was
  `base + baseWeaponSpeed × (0.022 × AP + 0.044 × SP)` and is now **a flat spell
  power figure chosen by weapon TYPE** — 20% one-handed, 22% two-handed, **no attack
  power term at all.** Both sites say so, because a reader who knows the older
  source would read the new numbers as transcription errors.
- **Seal of Righteousness' base is an INTERPRETATION**: the LOW end of "21 to 75",
  recorded as a reading rather than a placeholder. Still an open owner question.
- **`PLACEHOLDER_SEAL_OF_COMMAND_PPM` is 7 and is the largest invented number in
  Seal Twist Ret.** The owner chose procs-per-minute; the figure has not arrived.
  **Seal of Command plus its Echo is 26.5% of that profile's damage**, so this
  placeholder is load-bearing.
- **Seal of the Crusader's "deals less damage with each attack" states no figure**,
  so the seal is currently generous.
- **Hammer of Wrath's row sat transcribed-and-unapplied** in the coefficient sheet
  until the owner put the ability in two lists. **A coefficient existing is not the
  same as an ability being declared.**
- **Two Paladin tests assert "every build keeps a seal up and judges it"** — those
  are invariants, not rotation decisions, and they are what caught the seal
  deadlock. Do not weaken them.

---

## What "done" looks like

1. **`PLACEHOLDER_SEAL_OF_COMMAND_PPM` answered.** It is the largest invented number
   in the fifth-highest profile, and 26.5% of that profile's damage rests on it.
2. **Seal of Righteousness' base settled** — low end or midpoint of "21 to 75".
3. **A block as a reaction outcome decided.** Two partly-modelled talents want it and
   the current design deliberately forbids it. That is an owner-level design
   question, not a bug.
4. **Spell hit per school scoped with the Mage and Priest** — eight talents, one
   capability.
5. **`vindication`'s chance asked for**, since nothing states it anywhere.
6. **Prot Pally accepted as a tank rather than treated as a low outlier.** 153.2 is
   Righteous Fury and Templar's Bulwark spending GCDs on threat and survival; the
   figure is correct and the build is doing what it was told.
