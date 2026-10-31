# PALADIN DEEP DIVE

**Class:** Paladin
**Profiles:** Seal Twist Ret, Shockadin, **Shockadin 2H**, Prot Pally
**State:** the deep dive is done. **1 live gap, and it is not an engine gap** --
it was 2, and client build 1.60.1.70170 removed the talent carrying the other.

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The Shockadin deep dive, and the fast two-hander beside it

**THE OWNER ASKED FOR A SECOND SET OF HANDS AND THEN FOR BOTH TO BE OPTIMISED**
-- "add a fast 2H to the profile ... an alternative to the template gear, not a
replacement", then "optimize both setups", holding the E65 template gear fixed
apart from the weapons.

| | was | now |
| --- | --- | --- |
| **Shockadin** (1H + shield) | 787.7 | **856.0** |
| **Shockadin 2H** (new) | -- | **933.2** |

### The weapon

`98-148 damage at 2.00 speed, 61.5 dps, +16 Intellect, +18 Critical Strike
Rating, +39 Spell Power` at E65.

**EVERY NUMBER FALLS OUT OF THE GENERATOR**, which is why it is a weapon PLAN
and not a hand-written item: `weaponDamage` derives the range from the two-hand
epic dps line and the speed, so "similar to the Seal Twist Ret weapon, except
rescaled to be 2.0 swing speed with the same DPS" is `speed: 2.0` on a two-hand
plan and nothing else said. The Ret's 177-266 at 3.60 and this one are the same
61.5 dps. **Not `caster: true`** -- that is what "the same DPS" decides, since a
caster two-hander comes out at 45.7.

### The two configurations are EXCLUSIVE, which is a ruling and was a correction

**THE FIRST VERSION PUT BOTH IN ONE SET**, reasoning that `liveEquipment`
already strips whichever hands a style cannot fill. Every step of that is true,
the stats were never doubled, and it is not what the owner asked for:

> "You cannot ever have the stats of both active. It's one or the other ...
> Equipping a 2H weapon REMOVES the 1H+shield from the character planner
> equipped items."

**"RESOLVED CORRECTLY AT THE POINT OF USE" AND "CANNOT BE EXPRESSED" ARE
DIFFERENT GUARANTEES**, and the equipment MAP is what a person reads off the
planner. `equipExclusive` in `game/items/equipRules.ts` is the ruling where it
is enforced; the Gear panel and `benchmarkEquipmentFor` both go through it. It
reads no combat style, because it is about what two HANDS can hold.

### A TALENT TIER COUNTS POINTS BELOW IT, which this project had wrong

**FOUND BY PASTING A GENERATED BUILD URL INTO talentsforever.com**, which is the
audit the owner asked for doing exactly its job: the calculator refunded six
points and said why.

`requirementsMet` asked `pointsInTree(...) < talent.tier` against the WHOLE
allocation, so a talent's own ranks -- and its neighbours' in the same row --
counted towards opening the row they sit in. The site disagrees, and two probes
settle it exactly:

| | |
| --- | --- |
| 14 points below tier 15 + Divine Favor | refunded: *"Divine Favor -- Requires 15 points in Holy -- 1 back"* |
| 15 points below tier 15 + Divine Favor | accepted, *"Points left: 0"* |
| 14 below, plus a point in Infusion of Light AND one in Divine Favor | **both** refunded, not one -- so same-tier points do not help either |

**THE OLD COMMENT CITED THE CALCULATOR FOR THE WRONG RULE** and gave an example
that does not distinguish the two readings -- "five points in row 0 open row 1"
is true either way. The case that separates them is a tree that STOPS at the
tier it is spending in, which is what an optimiser produces and no hand-written
build does. `pointsBelowTier` is the fix and `talentLegality.test.ts` pins both
probes.

### What the trees look like once the rule is right

Almost everything is forced. Twenty below tier 20 in Holy to reach Holy Shock,
twenty below tier 20 in Retribution to reach Vengeance, twenty-five below tier
25 for Champion of the Light -- which leaves the shield build **two** free
points and the two-hander **one**.

| | spread | build |
| --- | --- | --- |
| Shockadin | **23/0/28** | <https://talentsforever.com/paladin/60/553030030001012--052253301010303-ilkjnprtmvABECHLNM-6> |
| Shockadin 2H | **22/0/29** | <https://talentsforever.com/paladin/60/553030030001011--052153300013303-ilkjnprtmvABECHLNM-6> |

**THE TWO-HANDER HAS ONE FEWER FREE POINT BECAUSE ITS TIER 20 IS FULLER.**
Vengeance and Two-Handed Weapon Specialization are both tier 20 and both
wanted; six points there leaves nineteen below tier 20, one short. So
Retribution goes to 29 and Holy to 22, and Consecrated Ground is 1/2 rather
than 2/2.

**BOTH URLS WERE LOADED IN THE CALCULATOR AND READ BACK 23/0/28 AND 22/0/29,
"all 51 spent".** `tools/encode_talent_build.mjs` generates them and round-trips
every one through the decoder before printing; re-encoding Seal Twist Ret and
Prot Pally reproduces the owner's own URLs byte for byte, perk tail included,
which is what says the encoder is reporting the allocation rather than an
encoding error.

### Where the gains came from

Measured under shared seeds, 600 to 3,000 paired iterations, on the legal trees:

| | |
| --- | --- |
| **Consecrated Ground on the free points** | the best use of them by a distance: on the shield build the alternatives measure **-13.6** (1 + Divine Precision 1), **-39.7** (Divine Precision 2) and **-41.5** (Instrument of Law 2). On the two-hander its single point beats Divine Precision's by **16.2** |
| **Two-Handed Weapon Specialization 3/3** | **+22.2**, priced as the tree swap it is -- it cannot simply be removed, since dropping it takes Retribution back under the twenty-five Champion of the Light needs |
| **Consecration above the two ten-second strikes** | **+14** on both. It was LAST, and fired 6.0 times in a sixty second fight where 7.5 fit |
| **head and legs +1% Haste, neck +6 Spell Power** | **+9** together |
| **Blasted Lands +25 Intellect** rather than Strength | **+3** |
| **Divine Favor off the global cooldown** | **+3.5** and **+2.3**, an owner ruling |

**AND INSTRUMENT OF LAW IS OUT, WHICH THE TIER RULE DECIDED RATHER THAN A
MEASUREMENT.** It measured +18 while the trees were illegal; it is tier 25 in
Retribution, so taking it costs both of Holy's tier-20 slots, and that measures
**-41**.

### Mana is not what binds this build, and the proof is not a DPS figure

**SWAPPING BENEDICTION 5/5 FOR DEFLECTION 5/5 MEASURED BIT-IDENTICAL FIGHTS** --
not "worth nothing within the interval", but the same rolls in the same order.
The results page agrees: 8,255 mana gained against 5,037 spent, and the Demonic
Rune's 10% gate is never reached on either profile. So the filler points sit in
the mana talents because there is nowhere better, not because they pay.

### Divine Favor: a finding, and then a ruling that retired it

The entry sat above Holy Shock because the buff is "your NEXT Holy Shock", so
arming it below the spell it arms would waste a global cooldown. **Every step of
that is true and the conclusion does not follow**: `DIVINE_FAVOR.durationMs` is
**0**, so the aura lasts until it is SPENT and the next Holy Shock collects the
crit whether it was armed one global cooldown earlier or thirty seconds earlier.
Position decided only WHEN the global cooldown was paid, and the bottom of the
list measured **+13.5**.

**THEN THE OWNER RULED THAT IT PAYS NONE**: "the Divine Favor talent/cooldown
doesn't trigger the global cooldown." At 3,000 paired iterations every position
is now within **+/-2.2** of every other, so the entry went back where the owner
put it. What is not free is having it at all: removing it went from **+9.9** to
**-9.7**.

**A MEASURED ROTATION DECISION IS ONLY AS SETTLED AS THE MECHANIC UNDER IT.**

### Two things that were measured and turned out to be noise

**+1% HASTE AND +8 INTELLECT ON THE HEAD AND LEGS ARE A TIE.** The first sweep
read haste at +4.65 and Intellect at +0.86 against the +8 Strength that was
there, which looked decisive; at 4,000 paired iterations the two are **+0.4
+/- 1.4** and **-0.4 +/- 1.6**. Haste moves the swing timer, so it decorrelates
the paired fights -- a spread of 42 against an interval of 3 is two coin flips
that agreed. Both beat +8 Strength by two to three.

**THE MECHANISM WAS CHECKED RATHER THAN THE FIGURE**, because "worth nothing"
and "did not apply" render identically: auto-attack attempts a fight go
**36.944 -> 37.275 -> 37.476** across 0%, 1% and 2%.

### One thing to put in front of the owner

**CONSECRATED GROUND'S WORDING SAYS "HOLY SPELLS".** It is implemented as
`damageTakenBySchool: { holy }` on the Consecration debuff -- deliberately, and
`paladinEffects.ts` says why -- which reaches every Holy hit the Paladin lands,
**including Seal of Righteousness and Holy Strike's Holy half**. That was a
defensible reading of a talent nobody took; it is both Shockadins' free points
now.
---


## Client build 1.60.1.70170 — the class this patch cost the most

**ALL THREE BUILDS WERE RE-SPECIFIED and the owner supplied the URLs when asked**,
because the client removed two talents the patch notes do not mention and every
Paladin build had points in one of them.

| Profile | was | now | |
| --- | --- | --- | --- |
| Seal Twist Ret | 886.9 | **788.4** | **-98.5 REAL** |
| Shockadin | 682.0 | **601.3** | **-80.7 REAL** |
| Prot Pally | 355.4 | 355.2 | -0.2, noise |

**THE TWO LARGEST, MARGINAL:** Champion of the Light's 33/66/100% → 20/40/60% of
Intellect is **-27.6** and **-31.9**, and Vengeance's five stacks → three is
**-24.3** and **-22.5**. The rest is Crusade's removal, the Ret's Two-Handed
Weapon Specialization 9% → 6%, and Improved Holy Strike's cooldown, offset by
Holy Power now naming Holy Strike and Sacred Arbiter going 10% → 20%.

**THE TWO SILENT REMOVALS:** **Improved Holy Strike** (Holy, 2 points in all
three builds) and **Crusade** (Retribution, 2 points in two of them). Neither is
in the notes. Their 4, 4 and 2 freed points were a decision rather than a
transcription, which is why they were asked for.

**THE TANK IS THE PROFILE THAT DID NOT MOVE, AND BOTH ITS BLOCK TALENTS DID.**
Redoubt went 30% → 20% and Holy Shield 20% → 30%, in opposite directions in one
patch -- which is the pair to be careful with, because reading one note and
applying it to both numbers is a wash and looks deliberate.

**AND THE LIVE GAP COUNT FELL TO ONE BY DELETION.** Crusade carried the second
one; the talent is gone, so the gap is.

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

## Client build 1.60.1.70707

The tree was re-captured off foreverchanges.pro and the owner supplied all
four builds for it -- see HANDOVER round 86 for the whole list, the readings
and the open questions. What a reader of the
rest of this document most needs:

- **Twist of Light is Unsealed Wrath** and its Echo is gone. A stored seal is
  `unsealed_wrath_<seal>` with up to three stacks, spent by `unsealedWrathProc`;
  Seal Twist runs the owner's cycle B: three attacks under Righteousness, one
  under Command (`SEAL_TWIST_RIGHTEOUSNESS_ATTACKS`, `SEAL_TWIST_COMMAND_ATTACKS`),
  opening under Righteousness.
- **Instrument of Law is gone**; Champion of the Light 5/5 makes Hammer of
  Wrath instant, and `castsInstantly` still gates the Seal Twist entry.
- **Holy Shield is row 5**, and **Shieldsworn** is the Protection capstone.
- **Swift Judgement** is a second Judgement on its own minute, and the
  Protection list casts it ungated.
- **Light's Vigil** is friendly only.
- The figures in the table below are another tree's.

## The profiles

| Profile | Talents | DPS | List |
| --- | --- | --- | --- |
| Seal Twist Ret | 12/8/31 (1.60.1.70707) | **748.3** ±9.6 | `PALADIN_RETRIBUTION` |
| Shockadin | 21/0/30 (1.60.1.70707) | **585.5** ±4.9 | `PALADIN_SHOCKADIN` |
| Prot Pally | 10/31/10 (1.60.1.70707) | **303.9** ±3.7 | `PALADIN_PROTECTION` |

**DO NOT READ THESE AS THE DEEP DIVE'S FIGURES.** The dive took them to 528.3,
472.7 and 238.1; everything since — the raid buff list, Judgement of Wisdom,
buffs lasting the fight, and the seal crit ruling below — has moved them again,
and `npx vite-node tools/measure_profiles.ts` is the only thing that knows the
current ones.

**THE DEEP DIVE ITSELF WAS +57.3, +93.7 AND +84.9, every one of them REAL**, with
the twenty non-Paladin profiles identical to the decimal — the containment check
for a change touching four shared engine files.

**AND THEN THE SEALS WERE RULED TO CRIT**, which moved them again: Seal Twist Ret
**+40.6** and Shockadin **+17.0**, both REAL, with Prot Pally's +5.1 called noise
against a doubled interval of 5.8. See the trap below for the two numbers that
could each have gone the other way.

Seal Twist Ret is now at the **top** of the table and should not be read as
first: 748.3 against a Cat that has since moved as well — check the table,
so the two are indistinguishable. Prot Pally is still the lowest and is no longer
an outlier. (The deep dive's own figures were measured
against a main that had meanwhile taken the Warlock dive's corrections and the
Warrior dive's two noise-sized moves; all 23 were re-run after merging and every
figure reproduced.)

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
| 52 | 33 | 7 | 11 | **1** |

Was 22 / 7 / 13 / 10. Reprint it with `npx vite-node tools/class_audit.ts paladin`,
which derives it from the effect table and throws if its four buckets do not
account for every talent.

### The 1 live gap, and it is not an engine gap

| Talent | Why |
| --- | --- |
| `purifying_power` | **Its dispel half is RULED OUT now; what is left is the other half.** The cooldown reduction reaches Exorcism and Holy Wrath, which are undeclared and Undead-and-Demon only — the TARGET cause, which is not one of the rulings and expires only if the encounter changes |

**`guardian_s_favor` LEFT THE COLUMN**, both halves scoped: Blessing of Freedom
is `positioning` and Blessing of Protection is the new `immunity`. The talent's
own reason had ended "whether an immunity that disarms you belongs in scope is a
question for the ruleset owner rather than a gap in the engine", and that
sentence is the only reason it got asked rather than sitting in the queue.

**AND `sacred_duty` SPLIT IN TWO, WHICH CORRECTED SOMETHING THIS FILE GOT WRONG.**
Its reason said Divine Shield and Divine Protection were "both damage immunities
that stop the Paladin attacking" — read from Classic. **Forever's Divine Shield
does not stop you attacking**: "protects the paladin from all damage and spells
for 12 sec, but reduces all damage you deal by 50%". So Divine Protection is
scoped `immunity` and **Divine Shield is a real tank cooldown nobody has
declared**, which is the one piece of expressible Paladin content left.

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
| ~~`hammer_of_wrath`~~ | ~~Seal Twist Ret~~ | **IT FIRES NOW** — 1.9 times a fight for 4.5% of the profile's damage. See below |

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

## The owner's six-item pass, and what each turned out to be

Read in the app, not in the code, which is how five of the six were found.

| | |
| --- | --- |
| **Sacred Arbiter's +10% to Holy Strike** | **A NULL VALUES ENTRY.** Single-rank, so the importer had no `{0}` to match and wrote `null`, and `talentBuild` discards every effect that asks for a number. The talent reported itself fully modelled to a census that reads the effect TABLE. Third time on this class |
| **Hammer of Wrath** | **INSTANT, RANGED, AND STILL SPELL POWER** at Instrument of Law 2/2, on the owner's ruling. The entry is gated on the talent. **It fires now** |
| **Improved Righteous Fury** | **A TWO-CLAUSE REASON.** "Threat is out of scope AND no profile casts Righteous Fury" -- the first half permanent, the second expired when the owner's Protection list started casting it. 6% damage taken |
| **Iron Creed** | the same shape, same half wrong. 10% for 6 sec on every Holy Strike while Righteous Fury is up |
| **Swift Judgement** | **WORKING, AND A GLOBAL COOLDOWN LATE.** Its gate named Seal of Fury, which the Protection opener does not have up at the moment Judgement first goes on cooldown. Any seal now, which is Judgement's own rule |
| **Reckoning** | **ALREADY CORRECT**, and the one item that was not a bug. Measured at 3.77 extra swings a fight against an expectation of 3.62 |

### Reckoning: all four links verified, and the count is small

`npx vite-node tools/probe_block.ts` prints the chain, which is the only way to
see a stat, a buff and a proc as three contributions instead of one number:

| | |
| --- | --- |
| base (5.0 stat, 114 defense) | **9.56%** |
| + Holy Shield | **29.56%** — exactly +20 |
| + Redoubt at 5/5 | **59.56%** — exactly +30 |

8.80 blocks a fight, 40% of them an extra attack, is **3.52 expected from blocks**
plus 0.10 from crits taken. Measured by diffing against a run with `reckoning: 0`:
**3.77**. So the talent is right and the EXPECTATION is small.

**AND THE SWING TIMER RESET IS A RULING, NOT AN OVERSIGHT.** The owner, 2026-10-07: "an extra attack from Reckoning is exactly the same as the other
extra attacks — like from Hand of Justice. It will trigger an auto-attack and
reset the swing timer." So `extraAttack` restarting the timer is correct and
**Reckoning is not a special case**, even though it is the only caller where the
reset is visible — every other one fires from inside the attacker's own swing,
where rescheduling to the same instant changes nothing. A change to preserve the
pending swing was written here and reverted; `tests/engine/extraAttackSwingTimer.test.ts`
pins the rule so the next reader does not find the same apparent bug.

### And it has an internal cooldown now, which is worth exactly nothing here

"Reckoning: Now has a 1.5 second internal cooldown on how often it can be
triggered." Implemented as `RECKONING_ICD_MS`, checked BEFORE the roll so a
refused attack consumes no randomness, in a closure built **per character** --
the Windfury idiom, because one shared closure stops proccing after the first
iteration of a batch.

**IT MEASURED 0.0 ON THE PROT PALLY, TO THE DECIMAL, AND THAT IS ARITHMETIC
RATHER THAN LUCK.** The encounter has ONE attacker on a two-second swing timer,
widened by the tank's own Thunder Clap slow:

| | |
| --- | --- |
| attacks received a fight | **25** |
| median gap / minimum gap | **2,400ms / 2,400ms** |
| gaps under 1,500ms | **0** |
| blocks / crits taken | 10.3 / **0.0** |

Two triggerable events cannot fall inside the window, so the cooldown refuses
nothing. **AN ENCOUNTER CAUSE, NOT A GAP** -- it starts binding the day the
encounter swings faster or carries a second attacker, and it is written down
because a change that measures nothing is otherwise indistinguishable from one
that did not apply. `paladinTalents.test.ts` asserts the gap rather than leaving
the claim in prose.

**THE FIRST COMMENT ON THE CONSTANT PREDICTED THE OPPOSITE**, specifically: "a
tank is ... critically struck several times a second against a target that
ramps". Crits taken are 0.0 and attacks arrive every 2.4 seconds. A prediction in
a comment is a measurement that has not happened.

**SEEING 2 IN ONE FIGHT IS NOT A BUG, IT IS THE SAMPLE SIZE.** An expectation of
3.6 events is a count, and a single fight returns 2 or 3 often. **An extra attack
also emits no telemetry of its own** — it is an ordinary main-hand swing by the
time anything can see it — so the only way to count them is the diff, and the
only honest form of the answer is a mean over many fights.

### Where the two damage-reduction talents actually pay

Not in DPS. 300 iterations, deaths and damage taken:

| | deaths | damage taken |
| --- | --- | --- |
| both, as shipped | **9.63** | 146,400 |
| without Improved Righteous Fury | 9.99 | 155,387 |
| without Iron Creed | 9.99 | 155,443 |
| without either | **11.27** | 174,190 |

0.94 x 0.90 = 0.846, and removing both raises damage taken by 19.0% against the
18.2% that predicts — so both are applying and they multiply, which is the rule
every other damage-taken multiplier here follows. **Iron Creed alone is worth as
much as Improved Righteous Fury alone**, because its 10% runs about 60% of the
fight against the other's permanent 6%.

---

## Traps specific to this class

- **A BLOCK IS AN OUTCOME A REACTION CAN SEE.** Four places in this project said
  otherwise. See the top of this file, and do not write the claim again.
- **CHECK EVERY SINGLE-RANK TALENT AGAINST ITS OWN EFFECTS.** Three of this
  class's talents have been silently inert for this one reason — Holy Shield,
  Divine Favor and Sacred Arbiter — and nothing reports it: a `null` values entry
  makes `talentBuild` discard the effect, while the census reads the effect TABLE
  and calls the talent complete. The Paladin's single-rank talents are
  `divine_favor`, `improved_seal_of_fury`, `templar_s_bulwark`, `holy_shield`,
  `swift_judgement` and `sacred_arbiter`.
- **THREE TALENTS CARRIED A REASON WHOSE FIRST CLAUSE WAS PERMANENT AND WHOSE
  SECOND HAD EXPIRED**, and all three read as correct because the first half was.
  Threat is out of scope forever; "and no profile casts Righteous Fury" stopped
  being true the day the owner's Protection list opened with it. **If a reason has
  an AND in it, check both sides.**
- **RIGHTEOUS FURY IS NOT INERT ANY MORE, AND ITS OWN EFFECT STILL IS.** The
  spell does nothing but threat. What it does is switch two talents ON, so the
  entry that casts it is paying for Improved Righteous Fury and Iron Creed rather
  than for nothing. The ability's `unmodelled` says exactly that.
- **A SEAL CRITS OFF MELEE CRIT CHANCE, AND CRITS FOR 2x.** The owner's ruling,
  covering Seal of Righteousness, Seal of Fury and Seal of Command. **Both halves
  are counter-intuitive because the damage is HOLY**: `spellCritChance` and a
  spell's 1.5x are the plausible answers and both are wrong. The multiplier
  follows the TABLE `critFrom` names rather than the school, so getting it wrong
  halves every seal crit — a smaller number, a plausible one, and no error.
  `tests/game/sealCrits.test.ts` pins both by the SET of amounts a seal deals.
- **IT COSTS ONE RANDOM NUMBER PER SEAL HIT**, so every seeded Paladin fight
  shifted when it landed. That is why the three profiles moved by more than the
  crits alone are worth, and why the twenty non-Paladin profiles coming back
  **+0.0 to the decimal** was a stronger containment check than usual.
- **THE CHEAPEST WAY TO CHECK IT IS THE DAMAGE TABLE'S CRIT COLUMN.** Run a
  Paladin in the app and read the seal rows against Main Hand Auto-Attack: they
  should match, and Judgement should NOT. Seal Twist Ret comes back with Seal of
  Righteousness 21.52%, Seal of Command 21.85% and both Echoes at ~21.9% against a
  main hand of 21.53%, while Judgement sits at 11.49% on spell crit; Prot Pally
  shows Seal of Fury 6.29% against a main hand of 6.34%. **Two numbers in one
  glance** -- that the seals moved to melee crit, and that nothing else did.
- **A SEAL CRIT DOES NOT ARM VENGEANCE**, and that is the pipeline rather than a
  decision: a seal hit carries no `attackTable`, so `dealDamage` offers it to no
  reaction, and `sealHit` runs inside the seal's own reaction where the
  re-entrancy guard would refuse a second one anyway. Worth knowing, because
  "after landing a critical strike" now has a kind of critical strike it cannot
  see.
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
not tracked, which is what each of those eight items' `unmodelled` entry says --
all eight carry the same caveat, which is why the Gear panel's list printed it
eight times before that list was removed. It would be worth
real damage to the tank profile and it is NOT counted in the 238.1 above.

Recorded here because the clause only became interesting when Holy Shield started
dealing damage at all. **A dormant item line can wake up when a talent is fixed.**

---

## What is left

Nothing in the engine. Four things, and every one of them is a question for the
ruleset owner:

1. **Seal of Righteousness' base** — is the low end of "20.5 to 71.4" the `base`
   term, or the midpoint? An interpretation either way, recorded in one place.
2. ~~**Is a dispel in scope?**~~ ~~**Is a self-disarming immunity in scope?**~~
   **BOTH ANSWERED, 2026-10-07: yes, both are out of scope.** `dispel` and
   `immunity` are members of `OutOfScope` now. They took the Paladin from two
   live gaps to one and the Mage from eleven to ten.
3. **Divine Shield, which the immunity ruling does NOT cover.** Forever's version
   reduces the damage you deal by 50% rather than stopping you attacking, so it is
   a usable twelve-second full immunity on a tank that measures deaths — and it is
   not a declared ability. The only expressible Paladin content left.
4. **Retribution Aura** — "30 Holy damage to any creature that strikes a party
   member", real damage for the tank profile, and the owner has chosen to leave it
   undeclared. Recorded so the choice is visible rather than looking like an
   omission.

**Prot Pally is a tank and 238.1 is correct.** Righteous Fury and Templar's
Bulwark spend global cooldowns on threat and survival; six of its talents are
threat, which is permanently out of scope, and a tank's whole job is threat.

---

## Round 78: the five presets optimised for the full report

Objectives: DPS at 1 target / 120 s and 5 targets / 60 s (reused at 3/60 and
8/30); Prot Pally's TPS at the same, deaths as the check; Holy Pal's HPS in the
tank healer fight (120 s) and the raid healer fight (60 s). Variants, controls
and every figure: `tools/optimise/paladinVariants.ts`. Paired, 400 fights.

**THE CLOCK CHANGED THE ANSWER ON THREE OF THE FIVE.** At 120 s Seal Twist Ret
ends with 0.8% of its mana spare, Prot Pally is mana-bound, and Holy Pal's raid
fight is mana-bound at 60 s -- so the mana potion, Reverence and Intellect, which
lost or tied at 60 s, now win. The two Shockadins are not mana-bound at 120 s
(15.6% and 6.7% spare) and nothing moved them in Single Target.

| profile | shipped | figure |
| --- | --- | --- |
| Seal Twist Ret | Reverence 3/3 out of Pursuit of Justice 1 | +12.51 +/- 4.86 |
| | Major Mana Potion over Spellblasting | +42.45 +/- 6.18 |
| | wrists +16 Spell Power over +9 Strength | +0.62 +/- 0.03 |
| | Hammer of Wrath above Judgement (second pass) | +3.73 +/- 2.07 |
| | MT: Consecration first, Holy Strike above Judgement | +23.20 +/- 11.73 at 5 |
| Shockadin, Shockadin 2H | MT: Consecration first, Holy Strike above Holy Shock | +6.58 / +6.81 at 5, +38.6 / +36.7 at 8 |
| Prot Pally | Major Mana Potion, +25 Intellect, gloves +2% Threat | +73.60 +/- 5.63 TPS, deaths -0.15 |
| | wrists +16 Spell Power over +4 Defense | +9.2 TPS on top, deaths +0.13 (noise) |
| | MT: Consecration above Templar's Bulwark | +10.75 at 5, +89.61 at 8, -4.60 (noise) at 3 |
| Holy Pal | head and legs +8 Intellect over +1% Haste | raid +48.84 +/- 7.17; tank -2.80 +/- 3.09 (noise, 1000 fights) |
| | raid list: Divine Favor above the Holy Light line | +8.40 HPS on top |

**EVERY ALTERNATIVE LOST**, and these are the rows: Ret's Consecration gated on
mana (+10.9 before the potion, -2.5 after it), Consecration at a 0s lead
(-6.50), head/legs Intellect (-10.03), Crusader (-13.66), Revelation (-19.09),
Dwarf (-6.33) and Undead (-7.75, noise); the Shockadins' free points (Divine
Precision -16 to -78), every APL move (Hammer ungated -9 to -12, removed -16),
the mana potion (-3.45 / -5.54), Strength Blasted Lands, Dwarf (-5.5 / -7.0),
Undead (noise); Prot's talent moves (all -7 to -39 TPS), APL moves (Consecration
above Judgement -11.40, Swift Judgement removed -23.78), Dwarf (-7.11); Holy
Pal's other consumables (Spellblasting -94.85 in the raid), Spirit, Dwarf
(-17.08) and Undead (-14.25) in the raid fight. Holy Pal's talents were not
varied: the 13 Protection and 2 Holy Conduit points are dead for a healer
nobody attacks and the Holy tree has no unbought healing talent left.

**WITHHELD, AND WHY:**

- Prot's flask +150 Spell Power: **+56.9 TPS on top of the shipped set, deaths
  +1.1 (4%)**. The owner gave this build the spell power food and not the
  flask; whether that is a ruling or a default is the question.
- Prot's Demonic Rune over the Healthstone: +1.1 TPS on top, noise -- and the
  owner ruled tanks take the Healthstone.
- Prot's Deflection 5 -> Benediction 5: +37.69 before the potion, deaths +1.74;
  -2.85 after it, deaths +2.19.
- Holy Pal's raid list without the owner's pre-cast Holy Light: +14.85 HPS over
  the Intellect enchants. It is the owner's line, so it stays.

## Round 80: the second optimisation run, under the round 79 rules

Variants, controls and every row: `tools/optimise/paladinVariants80.ts`, paired
over 400 fights (800 for the Shockadin potion sweep, 600 for Prot's AoE pair).
Talents, race, enchants and stat consumables on `WEIGHTED=1` (49/17/17/17, or
50/50 for Holy Pal); the Single Target list at 1 target / 120 s; the Multi
Target list at 5/60, checked at 3/60 and 8/30.

**EVERY PALADIN IS UNDEAD**, the only legal race. Undead against Human,
weighted: Ret +4.18 +/- 6.71 (noise), Shockadin +6.14 +/- 3.57, Shockadin 2H
+4.14 +/- 4.07, Prot +5.78 +/- 5.66 TPS, Holy Pal **-6.54 +/- 1.86 HPS**
(Touch of the Grave needs damage and the healer deals none; it loses the Human
Spirit). No Paladin list carries an Undead racial: Will of the Forsaken is
`crowdControl` and Cannibalize `healing`, both out of scope.

| profile | shipped | figure |
| --- | --- | --- |
| all five | Undead | above |
| Seal Twist Ret | potion pair: Major Mana under 30%, Spellblasting (secondary) in the last 30 s of a single-target fight and at the pull in Multi Target | ST bit-identical; MT +3.49 / +2.38 / +17.00 at 5 / 3 / 8 |
| both Shockadins | potion pair: Spellblasting held for the last 45 s, Major Mana (secondary) under 20% | +0.25 +/- 0.04 / +0.24 +/- 0.04 at 120 s |
| | MT opener: Consecration at 0s after the owner's Judgement (pure DoT, Gate B legal) | 1H +4.78 / +3.43 / +12.91, 2H +5.89 / +4.51 / +13.51 |
| Prot Pally | Sacred Duty 2 -> Reckoning 5 + Anticipation 3 | +18.71 +/- 4.23 TPS weighted, deaths -0.08 +/- 0.17 at 120 s |
| | potion pair (ST bit-identical) and MT Spellblasting at the pull + Consecration at 0s | +23.20 / +23.87 / +23.43 TPS, deaths noise |
| Holy Pal | tank list: Flash of Light under 60% mana on whoever is below full, above the owner's four | +2.52 +/- 1.34 HPS at 120 s |
| | neck +6 Spell Power (was +11 Healing Power) | +1.05 +/- 0.81 weighted |
| | potion pair (ST bit-identical; the raid list drops Spellblasting, -99.79 at the pull) | |

**THE TREES ARE FORCED, AND THE WEIGHTED SCORE SAYS SO ROW BY ROW.** Ret's
only free point is Pursuit of Justice (Deflection runs bit-identical fights);
Reverence -3.92, Benediction -10.13, Holy Conduit -27.46, Improved Seals
-64.36. The Shockadins' Reverence and Benediction are worth ~0 (the 1H ends
120 s with 15.6% mana spare) but every destination is dead too; Divine
Precision -21.6 / -23.7, 2HWS 1 -20.2. Prot: Deflection -> Benediction -13.56,
Divine Strength -> Intellect -8.15.

**EVERY ALTERNATIVE LOST**, the rows: Ret seals (the twist is right: Fury for
Righteousness -162, Righteousness alone -92, Command alone -196), Ret APL
(Consecration removed -66.8, Holy Strike to the bottom -25.2, twist gated on
mana >= 35% -20.8; every reorder noise), Ret enchants (Revelation -22, +25
Agility -12.7, head/legs Intellect -9.3), consumables (Dense Stone -8.0).
Shockadin seals (Fury -34 / -88, Command with a talent point -98 / -142,
Crusader -317 / -368), APL (Consecration removed -119 / -125, Holy Strike
removed -58 / -70, Divine Favor removed -4.4, Hammer of Wrath swing window
150-1000 ms all noise or worse), weapon enchants (-8.5 to -27), consumables
(Frost Oil beats every other weapon effect by 6-18). Prot APL (Holy Strike
above Judgement -28.9, Consecration above Judgement -12.1, Seal of Fury -87.5),
enchants (all noise). Holy Pal consumables and enchants (+8 Spirit -13.2,
+1% Haste -33.5). Spellblasting at the pull in a single-target fight: Ret
-32.7, Prot -38.5, Holy -31.0.

**THE IDLE GLOBAL COOLDOWNS ON THE SHOCKADIN ARE REAL AND UNFILLABLE**: about
20 of 80 at 120 s, with Judgement, Consecration, Holy Shock and Holy Strike all
at 95-97% of their cooldown-bound maximum. Nothing in a Paladin book deals
damage off cooldown, so the list is cooldown-bound rather than tunable.

**SMART HEALING IS WHY THE HOLY THRESHOLDS READ AS UNREAD.** Under it every
friendly entry aims at the lowest member and its condition reads that member,
so the raid Flash (line 3) and the tank Flash (line 4) become the same spell on
the same target: line 3's 70% can change nothing while line 4 is at 100%. In
the raid fight the lowest member is under 50% almost all fight, so the Holy
Light gate at 50, 65 or 80% and the pre-cast cancel at 90, 95 or 99% all run
BIT-IDENTICAL fights. In the tank fight the thresholds do bite: Holy Light at
50% +2.85, at 80% -4.99; tank Flash at 90% -16.6.

**WITHHELD, FOR THE OWNER:**

- Holy Pal's pre-cast Holy Light: removed, **+61.30 +/- 5.47 HPS** in the tank
  healer fight and +5.63 +/- 5.29 in the raid fight; cancelled above 85% (was
  95%) +57.77, above 90% +10.48. An addition that casts Flash on a FULL tank
  under 40% mana measures +60.89, which is the pre-cast being skipped by the
  back door, so it was not shipped.
- Holy Pal smart healing OFF in the raid list: +31.60 +/- 6.04 HPS (tank fight
  bit-identical).
- Holy Pal tank Holy Light at 50% (was 65%): +2.85 +/- 1.53.
- Prot Improved Righteous Fury 3 -> Conviction 3: +22.12 TPS weighted, **deaths
  +0.86 at 120 s (24%)**; with Sacred Duty also moved (Reckoning 5, Anticipation
  4, Conviction 2) +29.44, deaths +0.70.
- Prot flask +150 Spell Power: +51.58 TPS at 120 s, **deaths +1.41 (40%)**.
  Tanks are NOT rare deaths here: 3.4-3.6 a fight at 120 s on this build.
- Prot Demonic Rune over the Healthstone: +2.45, noise.
