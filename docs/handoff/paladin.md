# PALADIN DEEP DIVE

**Class:** Paladin
**Profiles:** Seal Twist Ret, Shockadin, Prot Pally
**State:** the deep dive is done. **2 live gaps, and neither is an engine gap.**

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**THIS CLASS WENT FROM TEN LIVE GAPS TO TWO, AND SIX OF THE EIGHT THAT CLOSED
NEEDED NO NEW ENGINE CAPABILITY AT ALL.** Their `unmodelled` reasons were claims
about what the engine could not do, and each claim was about the wrong thing:

| Talent | What its reason said | What was actually true |
| --- | --- | --- |
| `reckoning` | a block is not an attack outcome, "so no reaction can key on one" | `melee-received` has rolled `block` since the table was written |
| `holy_shield` | the same claim, and it cost the tank a damage source | the Warrior's Shield Specialization, Revenge, Enrage and Blood Craze all name `block` and all fire |
| `shield_specialization` | the same claim, plus "the absorb is a shield stat nothing reads" | `blockValue` is read by `resolveDamage` as the flat amount a block removes |
| `divine_favor` | a one-shot per-ability crit modifier, "which `CastModifier` does not carry" | true of `CastModifier`; an AURA has carried `abilityModifiers` since Shatter |
| `sanctified_judgement` | "a refund proportional to a different ability's cost has no declaration" | a cast reaction plus `resolveCast`, which is what the cast path itself uses |
| `templar_s_bulwark` | an absorb worth the health pool "is not granted" | it had been granted, cast and absorbing since the day absorbs were built |

**THE BLOCK CLAIM IS THE ONE WORTH REMEMBERING, because it had spread.** It was
in CLAUDE.md as design, in the `Reaction.outcomes` doc comment on the type, at
the top of `game/reactions/paladinTalents.ts`, and in this brief. Half of it is
true — a block is not AVOIDED, and its reduction is flat rather than a
multiplier, which is the character of the stat. The false half was that nothing
can fire on one. `tests/engine/blockReactions.test.ts` is the test that stops it
coming back.

**ONE REAL BUG CAME OUT OF THE SAME CLAUSE.** A block's CHARGE was spent before
the reactions ran, so the fourth and last block of every Holy Shield would have
found the aura already gone — the ability would have been worth three quarters of
itself, silently. `dealDamage` spends the charge last now.

**ONLY ONE OF THE EIGHT NEEDED A NEW ENGINE FIELD**, and it is shared four ways:
`divine_precision` wanted spell hit scoped to a school, which five talents across
three classes had written off with the same sentence — that the table decides hit
before a per-school modifier is consulted. It does not; `rollTable` folds the
school's modifier in before the roll. `AbilityModifier.hitBonus` is the field.

---

## The profiles

| Profile | Talents | DPS | Was | List |
| --- | --- | --- | --- | --- |
| Seal Twist Ret | 13/0/38 | **528.3** ±6.8 | 471.0 | `PALADIN_RETRIBUTION` |
| Shockadin | 23/0/28 | **472.7** ±3.8 | 379.0 | `PALADIN_SHOCKADIN` |
| Prot Pally | 8/36/7 | **238.1** ±4.9 | 153.2 | `PALADIN_PROTECTION` |

**+57.3, +93.7 and +84.9, every one of them REAL**, and the twenty non-Paladin
profiles are identical to the decimal — which is the containment check for a
change that touches four shared engine files.

Seal Twist Ret is now the **fourth** highest profile in the project, behind DW
Fury, 2H Arms and Firelock. Prot Pally is still the lowest and is no longer an
outlier: 238.1 against the Elemental Shaman's 295.4.

### What moved them, in order of size

| | |
| --- | --- |
| **Judgement of the Crusader's "+ up to 161 Holy damage taken"** | all three. It was tracked and added nothing, and every Paladin list opens by putting it up — so the class spent the project paying a global cooldown for a debuff that did nothing |
| **Holy Shield's 221 Holy a block** | Prot only, and **14.9% of its damage**. A damage source that did not exist |
| **Divine Precision's 12% Holy hit** | Shockadin only, **+19**. Worth saying how it was found: it was silently inert even after the field was added, because `combine` did not fold `hitBonus` and the Shockadin's gear already had a Holy entry for it to combine with. A test of TWO sources is what caught it — one source worked perfectly |
| **Reckoning's block half, Shield Specialization's mana and block value** | Prot only |
| **Sanctified Judgement's mana** | both Retribution builds. **693 mana a fight**, the largest single source either has |
| **Seal of the Crusader's damage penalty** | all three, downward, and tiny — the seal is replaced within a global cooldown or two in every list |

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Seal Twist Ret | Main Hand 41.2%, **Echo (Seal of Command) 12.7%**, Holy Strike 11.4%, Seal of Command 10.9%, Judgement 8.7%, Consecration 7.8% |
| Shockadin | Main Hand 22.1%, Seal of Righteousness 21.0%, Judgement 15.2%, Consecration 14.6%, Holy Shock 13.3%, Holy Strike 7.7% |
| Prot Pally | Main Hand 40.7%, **Holy Shield 14.9%**, Judgement 13.2%, Seal of Fury 11.4%, Consecration 10.3%, Holy Strike 9.5% |

**The Echo appearing as its own source is the Twist of Light capstone working** —
replacing a seal grants an Echo and the next melee attack applies the replaced
seal's effects on top of the new one's.

**`encounter.targetAttacks` is what tells the two shield builds apart**, because
the style cannot and stances belong to the Warrior. Prot Pally spends global
cooldowns on Righteous Fury and Templar's Bulwark, which are threat and survival
and **neither of which is damage** — that is the build and the scope rather than
the list, and it is expected.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 52 | 32 | 5 | 13 | **2** |

Was 22 / 7 / 13 / 10. Reprint it with `npx vite-node tools/class_audit.ts paladin`,
which derives it from the effect table and throws if its four buckets do not
account for every talent.

### The 2 live gaps, and neither is an engine gap

| Talent | Why |
| --- | --- |
| `purifying_power` | two clauses, two causes, **neither of them the engine**. Its Cleanse and Purify cost reduction reaches two dispels, and nothing in this encounter ever applies anything dispellable. Its cooldown reduction reaches Exorcism and Holy Wrath, which are Undead-and-Demon only |
| `guardian_s_favor` | Blessing of Freedom is immunity to movement impairment, which is positioning; Blessing of Protection stops all physical damage AND all physical attacking, so on a damage profile it is a survival cooldown that costs its own damage. Neither blessing is declared |

**BOTH ARE REALLY OWNER QUESTIONS RATHER THAN WORK.** Neither is taken by any of
the three profiles, and both turn on a scope decision nobody has made — whether a
dispel with nothing to dispel, and an immunity that disarms you, belong in scope
at all. They are the last two rows in **What is left** below.

### Partly modelled — the five

| Talent | The clause that does not apply |
| --- | --- |
| `crusade` | its extra bonus against Demons and Undead. **The TARGET cause** |
| `holy_conduit` | Holy Wrath and Exorcism, which are Undead-only and undeclared. Its Consecration and **Hammer of Wrath** clauses now apply |
| `divine_favor` | Flash of Light and Holy Light, which are heals. Scoped `healing`; its Holy Shock clause applies in full |
| `sacred_duty` | Divine Shield and Divine Protection, both undeclared immunities. Its stamina and its **Templar's Bulwark** cooldown apply |
| `vindication` | the 200 attack power it strips off the target, which is applied and reaches nothing: the encounter's damage is a flat placeholder that reads no attack power. **The TARGET cause.** Its self buff applies in full |

---

## Never-fired entries

| Entry | Profile | Why |
| --- | --- | --- |
| `hammer_of_wrath` | Seal Twist Ret | **OUT OF MANA, AND STILL OUT OF MANA** |

**THIS IS THE PROJECT'S WORKED EXAMPLE OF MEASURING A CAUSE RATHER THAN INFERRING
ONE**, written up in [docs/ability-audit.md](../ability-audit.md). Its "20% or
less health" is the CLOCK — `inExecutePhase`, the same rule Execute runs on — and
`paladinAbilities.test.ts` pins it: refused for four fifths of the fight, allowed
in the last. **The window opens.**

**AND IT SURVIVED TWO THINGS THAT SHOULD HAVE FIXED IT.** Holy Conduit now takes
40% off its cost (425 → 255) and Sanctified Judgement adds 693 mana a fight, and
it still never fires. `npx vite-node tools/probe_resources.ts` says why:
**gained 4101, spent 4023, headroom 78.** Consecration takes 1196 of it and the
two twisted seals take 2128 between them — the capstone's own price. The cross-
check that it is mana and not the gate is still the Shockadin, which casts the
same entry **2.0 times a fight**, up from 0.3.

Left as is. Reordering does not conjure mana, and whether Hammer of Wrath beats
the Consecration it would displace is a measurement nobody has taken.

## In the book, in no list, never cast

`seal_of_fury` and `righteous_fury` for both Retribution builds;
`seal_of_righteousness` and `hammer_of_wrath` for Protection. Each is a trainer
seal or defensive that build does not use.

**TEMPLAR'S BULWARK IS NO LONGER ON THAT LIST FOR THE TWO BUILDS THAT DO NOT TAKE
IT.** `TALENT_ABILITIES` is derived from `grantAbility` in the effect table, and
nothing declared one — so the ability sat in every Paladin's book regardless of
talent. **A bonus being paid rather than an omission**, even though neither build
had an entry for it, so no number ever moved and that is why it survived.

---

## Traps specific to this class

- **A BLOCK IS AN OUTCOME A REACTION CAN SEE.** Four places in this project said
  otherwise. See the top of this file, and do not write the claim again.
- **SEAL DAMAGE IS NOT A WEAPON USE**, by the owner's ruling, **and the swing
  carrying it still is.** Enforced by dealing every seal hit with **no
  `weaponSlot`** — so a seal hit cannot proc a Crusader or Hand of Justice, and
  the swing underneath it can.
- **A SEAL ASKS FOR THE TARGET'S SPELL POWER AS WELL AS ITS OWN.** A seal
  computes `base + coefficient x power` in `game` and hands it over as a
  `baseAmount` with `powerCoefficient: 0`, so `scaleByPower` never sees a
  coefficient to apply a target-side debuff to. **Every seal site calls
  `spellPowerAgainst`, not `spellPowerFor`** — get that wrong and Judgement of the
  Crusader silently stops reaching the half of the class it is worth most to.
- **"UP TO N" IS SPELL POWER, NOT FLAT DAMAGE.** The owner's ruling on Judgement
  of the Crusader, and it is the difference between +32 to a seal and +161. A flat
  reading would roughly treble seal damage; "increasing Holy damage taken by 161"
  is how the source would have had to word that.
- **THE SEAL TWIST CYCLE HAD NO ENTRY POINT and it is the one addition to the
  owner's orders.** Each seal was gated on the other being up, so after the opening
  Seal of the Crusader neither could ever fire and the profile named "Seal Twist"
  ran a whole fight on one seal. **Both entries measured zero uses and nothing
  errored.** The owner chose Seal of Command to seed it.
- **JUDGEMENT DOES NOT CONSUME THE SEAL in Forever.** Cast on cooldown, seal
  untouched — the single biggest difference from Classic, and what makes this a
  priority list rather than a scripted sequence.
- **THE SHEET SUPERSEDED THE EARLIER SEAL OF RIGHTEOUSNESS FORMULA.** It was
  `base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)` and is now **a flat spell
  power figure chosen by weapon TYPE** — 20% one-handed, 22% two-handed, **no attack
  power term at all.** Both sites say so, because a reader who knows the older
  source would read the new numbers as transcription errors.
- **Seal of Righteousness' base is an INTERPRETATION**: the LOW end of
  foreverchanges.pro's "20.5 to 71.4", recorded as a reading rather than a
  placeholder. Still an open owner question.
- **Seal of the Crusader's damage penalty is an INTERPRETATION TOO, and it is now
  applied.** The owner chose Classic's reading: the reduction exactly cancels the
  haste, so a swing is worth `1 / 1.4`. **On the `melee-auto` table alone** — haste
  here shortens a swing and a cast and nothing else, so penalising Judgement or
  Consecration would remove damage the seal never granted.
- **`PLACEHOLDER_SEAL_OF_COMMAND_PPM` IS GONE.** The owner has confirmed 7 PPM is
  the real figure, so it is `SEAL_OF_COMMAND_PPM` and the fifth-highest profile
  loses its one big asterisk. The VALUE did not move; what moved is whether it can
  be quoted.
- **A SINGLE-RANK TALENT HAS NO VALUE TO LOOK UP, AND `talentBuild` DROPS EVERY
  EFFECT THAT ASKS FOR ONE.** Holy Shield is the case and it failed the worst way:
  the talent granted its ability, the census reads the effect TABLE so it reported
  itself fully modelled, and its damage-per-block reaction was never registered.
  **A `reaction` or `castReaction` whose magnitude lives on the ability or the aura
  must declare `valueless: true`.**
- **Two Paladin tests assert "every build keeps a seal up and judges it"** — those
  are invariants, not rotation decisions, and they are what caught the seal
  deadlock. Do not weaken them.

---

## One item effect worth knowing about

**LAWBRINGER'S SIX-PIECE BONUS IS ABOUT HOLY SHIELD, AND IT IS STILL UNMODELLED.**
Eight pieces of the Protection set carry it:

> Holy Shield no longer has charges and instead always lasts its full duration.
> In addition, its damage is increased by 80% of your shield block value.

Both halves are expressible NOW that the damage exists -- the charges are
`chargesOnApply`, and 80% of `blockValue` is a stat the pipeline already reads.
**What blocks it is the set bonus itself**: counting pieces across a whole set is
not tracked, which is what the Gear panel's "Equipped but not simulated" line says
and why every one of those eight items prints the same caveat. It would be worth
real damage to the tank profile and it is NOT counted in the 238.1 above.

Recorded here because the clause only became interesting when Holy Shield started
dealing damage at all. **A dormant item line can wake up when a talent is fixed.**

---

## What is left

Nothing in the engine. Four things, and every one of them is a question for the
ruleset owner:

1. **Seal of Righteousness' base** — is the low end of "20.5 to 71.4" the `base`
   term, or the midpoint? An interpretation either way, recorded in one place.
2. **Is a dispel in scope?** `purifying_power`'s Cleanse and Purify half is inert
   because nothing here applies anything dispellable, which is an ENCOUNTER
   property and not one of the five rulings — the same shape stealth had before it
   was ruled on.
3. **Is a self-disarming immunity in scope?** `guardian_s_favor`'s Blessing of
   Protection, and `sacred_duty`'s Divine Shield and Divine Protection. All three
   stop the Paladin attacking for their duration, so on a damage profile they cost
   their own damage.
4. **Retribution Aura** — "30 Holy damage to any creature that strikes a party
   member", real damage for the tank profile, and the owner has chosen to leave it
   undeclared. Recorded so the choice is visible rather than looking like an
   omission.

**Prot Pally is a tank and 238.1 is correct.** Righteous Fury and Templar's
Bulwark spend global cooldowns on threat and survival; six of its talents are
threat, which is permanently out of scope, and a tank's whole job is threat.
