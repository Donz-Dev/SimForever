# ROGUE DEEP DIVE

**Class:** Rogue
**Profiles to audit and prepare:** Venom, Combat, Rupture

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## Where this class is

**THE DIVE IS DONE. Fourteen live gaps to three, and not one of the three is an
engine gap.** Nine talents were built, five engine capabilities were added to
reach them, and two `unmodelled` reasons turned out to have expired while still
being printed on the results page.

| | |
| --- | --- |
| **Live gaps** | **3**, down from 14 |
| `remorseless_attacks` | needs a KILL, and the fight ends on a timer with the target alive. Not the same case as a "below N% health" clause, which the owner has ruled is the final fraction of the fight |
| `riposte`, `setup` | need a target that swings back. `targetAttacks` supplies one and no Rogue profile sets it, so these are **PROFILE gaps rather than engine ones** and want no new rule |

**THE TWO PROFILE GAPS ARE THE ONLY THING LEFT THAT COULD BE CLOSED HERE**, and
closing them means giving a Rogue profile a target that attacks back — which is
a build decision for the owner, not a modelling one.

### The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 53 | **31** | **5** | **14** | **3** |

Reprint it with `npx vite-node tools/class_audit.ts rogue`, which derives the
whole thing and throws if the four buckets do not account for every talent.

**THE PARTLY COLUMN GAINED TWO TALENTS THAT WERE ALREADY WORKING.**
`vile_poisons` and `improved_poisons` apply in full — `poisonReactions` reads
both ranks straight off the allocation — and every census in the project
counted them as live gaps, because `class_audit` counts EFFECTS and their
reasons only said "APPLIES" in capital letters. **Prose could not fix that**, so
the `unmodelled` effect carries `appliedElsewhere` now: a string naming the
module that really applies it, which is data, is countable, and can be checked
because it names a file.

---

## The profiles

| Profile | Talents | DPS | was | | List |
| --- | --- | --- | --- | --- | --- |
| Combat | 18/33/0 | **461.8** | 419.8 | **+42.0** | `ROGUE_COMBAT` |
| Venom | 37/12/2 | **440.2** | 392.7 | **+47.5** | `ROGUE_VENOM` |
| Rupture | 12/8/31 | **409.4** | 377.1 | **+32.3** | `ROGUE_RUPTURE` |

**THE CONTAINMENT CHECK WAS EXACT: the other twenty profiles are identical to
the decimal.** Five of the nine talents built are Rogue-only content and four
are engine capabilities with one caller each, so nothing else could move — and
the run says nothing else did.

### What each change was worth, isolated

Knocked out one at a time, 30 batches of 10 each, against the finished branch.
**Every one reaches exactly the profiles that take the talent**, which is a
containment check per talent rather than per commit.

| | Venom | Combat | Rupture |
| --- | --- | --- | --- |
| `murder` +4% all damage | **+16.9** | **+17.8** | — not taken |
| Mutilate's +20% vs Poisoned | **+14.9** | — | — |
| `puncturing_wounds` Mutilate crit | **+15.3** | — | — |
| `hack_and_slash` sword extra attack | — | **+13.9** | — |
| `weapon_expertise` | — | +10.6 *(noise)* | — |
| `puncturing_wounds` Backstab combo point | — | — | **+12.3** |
| `thousand_cuts` | — | — | **+9.3** |
| `serrated_blades` +30% Rupture | — | — | **+8.3** |
| `serrated_blades` armor penetration | — | — | **+6.9** |
| Hemorrhage's +15% Rupture taken | — | — | +4.5 *(noise)* |
| `lethality` crit damage | +5.7 *(noise)* | +2.7 *(noise)* | +2.6 *(noise)* |

**`murder` IS THE LARGEST SINGLE ITEM ON TWO OF THE THREE PROFILES**, and it is
not a mechanism at all — it is the owner's ruling that the target is a Humanoid
or a Giant, applied the way the Hunter's Improved Tracking already is, with the
assumption stated in the talent's own entry rather than checked by the engine.
Its old reason blamed the ENGINE ("no combatant here carries a creature type")
and the question was never put to the owner. **Check whether a missing number is
a missing RULE before recording it as a gap** — this is the second time that has
paid out, after the coefficient sheet.

**`lethality` MEASURES AS NOISE ON ALL THREE AND IS STILL CORRECT.** A crit
damage bonus reaches only the crit half of the abilities it names, and abilities
are under half of a Rogue's damage — so 20% of the bonus half of a x2 crit on a
minority of a minority is a couple of DPS. **A correct talent can be worth
nothing**, and the mechanism is tested rather than the delta.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Venom | Main Hand 37.5%, Mutilate 16.0%, Off Hand 14.3%, **Instant Poison 11.9%, Deadly Poison 10.7%**, Mutilate (Off Hand) 7.4% |
| Combat | Main Hand 42.2%, Sinister Strike 18.3%, Off Hand 17.2%, Eviscerate 12.4%, Instant 4.4%, Deadly 4.0% |
| Rupture | Main Hand 38.2%, Backstab 20.4%, Off Hand 14.1%, **Rupture 8.0%**, Deadly 7.3%, Hemorrhage 5.7% |

**AUTO ATTACKS ARE 52–59% OF EVERY ROGUE PROFILE**, which is why `murder` — the
one change that reaches a swing — outweighs the four that reach abilities.

**RUPTURE IS 8.0% OF THE BUILD NAMED AFTER IT, UP FROM 3.6%**, without the
priority list being touched. Serrated Blades' +30% and Hemorrhage's +15% both
land on it now. **The owner said 1.3 applications a fight was too low and that
is still open** — this raised what each application is worth, not how many there
are.

---

## The five engine capabilities, and their one caller each

Each is a missing DECLARATION rather than a missing rule, which is what the
`unmodelled` reasons said and what turned out to be true.

| | For | The trap |
| --- | --- | --- |
| `armorPenetration` (stat) | `hack_and_slash` mace, `serrated_blades`, **and the Warrior's Weaponmaster** | A percentage of the ARMOR, not of the reduction. 9% off a boss's 3731 armor is **2.23 points** of mitigation, not 9; the other reading is four times the talent |
| `dodgeParryReduction` (stat) | `weapon_expertise` | NOT `hitChance`. Hit comes off MISS, and miss, dodge and parry are three different-sized slices that move differently with the level gap |
| `CastModifier.costReduction` | `thousand_cuts` | FLAT. A fraction is right for a 380-mana spell and wrong for a 35-energy strike |
| `AuraDefinition.abilityDamageTaken` | Hemorrhage's Rupture clause, Mutilate's Poisoned clause | NOT a school multiplier. Rupture is physical, so +15% physical would raise every swing on the target too |
| `AbilityModifiers.addWhileFinalFraction` | `quietus` | Keyed by FRACTION, because Quietus is 35% and the Priest's Early Demise is 20%. A shared constant would silently hand one the other's window |

**THREE NEW TALENT EFFECT KINDS**, and two of them are selectors that were
simply absent: `abilityCritDamage` names a LIST of abilities for crit DAMAGE
(the Warlock's Pandemic wants the same one), `abilityBelowTargetHealth` carries
the clock ruling as data, and `abilityCrit` finally took a `valueIndex`.

**`stat` TOOK A `requires` TOO**, which is what let Hack and Slash's three
weapon clauses be three entries instead of a paragraph of apology. An unmet
clause is REPORTED by `talentBuild` rather than silently skipped.

---

## Two reasons that had expired, both printed while false

**THIS IS THE FAILURE MODE THE PROJECT KEEPS MEETING, and both instances here
had the disproving code in the same file.**

- **Rupture** declared `'Its "increased by your Attack Power" clause does NOT
  [land]: the source gives no coefficient'`. `RUPTURE_TICK_AP_COEFFICIENT` is
  applied four lines above the claim, and has been since the owner's sheet
  arrived. The ability was fully scaling while telling the results page it
  could not.
- **Hemorrhage** declared its Rupture clause had no form. True when written;
  `abilityDamageTaken` is the form, and the constant is deleted rather than
  reworded.
- **Mutilate's "+20% against Poisoned targets"** expired the other way, without
  anybody touching Mutilate: it read "poisons are not implemented" and the
  poison system landed a release earlier. **A reason can expire because
  something ELSE was built.**

`armorPenetration.test.ts` matches the SENTENCES rather than the ids, across all
nine classes — because the Rogue's own reason said "the same gap as the Warrior
Weaponmaster mace clause", and a test scoped to one class would have let the
Warrior's copy of the claim outlive the thing that cleared it.

---

## What is left, and it is short

1. **`riposte` and `setup`** want a Rogue profile whose target attacks back.
   An owner decision about the profiles, not a modelling one.
2. **`remorseless_attacks`** needs a kill. Permanent for this encounter shape.
3. **Rupture's 1.3 applications a fight.** The owner has said it is too low and
   this dive did not touch any priority list. Its entry is gated on
   `rupture down` AND `exactly 5 combo points`, and the same `>= 10s` floor
   idea suppresses Eviscerate in the same list to zero casts — **which the owner
   has separately ruled fine**. Measure variants; do not reason about them.
4. **`lethality`'s Gouge share** and **`opportunity`'s Garrote and Ambush
   shares** are scoped out, not pending.
5. **Talent VALUES have never been cross-checked** for any class. The Rogue's
   ABILITY numbers were, at build 1.60.1.70009, and two moved — Backstab
   225 → 150 and Mutilate 38 → 50. `values/rogue.json` rests on
   `talentsforever.com` alone.

**`quietus` IS BUILT AND NO PROFILE TAKES IT**, which is why it was the safe
place to build the clock mechanism. **The Priest's Early Demise is the second
caller and is deliberately NOT wired** — the mechanism is there and it is one
entry, held back because it moves a Priest figure and belongs with that class's
own re-measured baseline. Its reason has been left pointing at the mechanism
rather than at the gap.

---

## Traps specific to this class

- **A POISON IS NOT A WEAPON USE, BUT IS TRIGGERED BY ONE** — the owner's ruling.
  `isWeaponUseOf(attack, slot)` fires it, and **the poison hit carries no
  `weaponSlot`**, so it cannot proc a second poison, a Crusader or Hand of
  Justice. Getting that backwards does not look wrong: poisons chaining off
  poisons is a bigger number and no error.
- **AND "POISONED" IS THE DEADLY POISON DEBUFF, NOT ANY POISON.** Instant Poison
  deals its damage and leaves nothing behind, so it never makes a target
  Poisoned in the sense Mutilate's tooltip means. That is correct rather than a
  shortfall, and it is why the +20% rides on the debuff's own aura.
- **A POISON'S CHANCE IS FLAT PER STRIKE, NOT PROCS PER MINUTE**, which is the
  opposite of every weapon enchant here. A fast off hand really does poison more
  often. PPM exists to stop exactly that, and the two live side by side.
- **A PERIODIC TICK RUNS NO REACTIONS.** `dealDamage` excludes them on purpose —
  a bleed ticking is not an attack anybody parries — so Thousand Cuts could not
  be a proc and had to be an aura the Rupture tick APPLIES. Its old reason said
  "the tick is reachable", and that was the half that was wrong.
- **A TALENT VALUE TRAVELS TO AN AURA AS AN `abilityBonus`.** An aura definition
  cannot read an allocation, so Rupture's `onCast` reads the named bonus and
  hands it down — the same hook Improved Slice and Dice uses for its duration.
- **COMBO POINTS BELONG TO A TARGET.** `comboPointTargetId` records whose they
  are. **Anything banking points by writing the pool must set the target too**,
  or every finisher refuses to spend and reads as an ability that lost its flat
  damage. Puncturing Wounds' proc goes through `awardComboPoint` for that reason.
- **A finisher spends its points inside its own `onCast`**, where neither the
  cost system nor a damage reaction can see it. `AbilityCastEvent` carries what
  the cast SPENT, measured by snapshotting every pool around it.
- **Energy ticks twenty times a second**, not ten, and **the GCD is 1.0 for a
  Rogue**, arriving as `baseGcdMs`.
- **AN UNCONDITIONAL ENTRY IS A FLOOR UNDER EVERYTHING BELOW IT.** The Rupture
  list's original Hemorrhage was 35 energy and ungated with Ghostly Strike at 40
  and Sinister Strike at 45 beneath it — nothing below an ungated cheaper
  ability can ever be the first castable entry, so a six-entry list was really
  three.
- **AND THE COST THAT DECIDES IT IS THE BUILT ONE.** Thousand Cuts now takes
  Hemorrhage and Backstab down by up to 15 energy inside its window, so the
  Rupture list's ordering is answering a different question at a Rupture tick
  than it is between them. Read costs off the character
  `characterAtCombatStart` builds.
- **`legalise` TAKES A CLASS NOW**, and did not. A Rogue test asking for a
  31-point Subtlety capstone on its own got a character WITHOUT it, silently,
  and read the result as "the talent is worth nothing". That caught four tests
  in this dive.

---

## Never-fired entries

| Entry | Profile | Why |
| --- | --- | --- |
| `eviscerate` | Rupture | the gate's two aura-duration floors never coincide with five combo points. **Ruled fine by the owner: "zero is fine"** |

**Do not "fix" that gate.** The measurement is recorded: dropping the two
duration floors from the *Venom* entry took that list from 392.7 to 413.1 on the
pre-dive baseline, which means the whole −24.3 the Venom list measured is those
floors, not the Venom entry (worth +17.7 there).

## In the book, in no list, never cast

`sinister_strike`, `backstab`, `rupture`, `expose_armor`, `ambush`,
`ghostly_strike` — varying by profile.

- `ambush` is castable only on a Cutthroat proc, which only the Rupture build
  takes, so the other two carry an Ambush they can never use. That is the
  honest state of the ability rather than a gap.
- `expose_armor` and `ghostly_strike` are simply not in the owner's lists.
- **VENOM IS IN NO LIST DELIBERATELY** and it is correctly implemented: +30% to
  poisons loses to the Eviscerate its combo points would have bought. **A
  correctly implemented ability can be worth casting never.** One line
  re-measures it the day a coefficient moves — and three of them moved in this
  dive, so it is now worth re-measuring.
