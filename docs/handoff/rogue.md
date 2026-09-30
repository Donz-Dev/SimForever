# ROGUE DEEP DIVE

**Class:** Rogue
**Profiles to audit and prepare:** Venom, Combat, Rupture

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**MOST OF THE ROGUE'S 20 LIVE GAPS ARE STEALTH, AND STEALTH IS NOT ONE OF THE
OWNER'S FOUR RULINGS.** Eleven talents are inert because **every fight opens in
combat** — Camouflage, Master of Deception, Initiative, Improved Ambush, Dirty
Deeds, Heightened Senses and more. That is an ENCOUNTER property, and it is
neither an engine gap nor a permanent scope decision.

**It is an open question for the ruleset owner: is an opener in scope at all?** A
yes turns a third of this class's queue into real work; a no turns it into a fifth
`OutOfScope` member and the queue drops from 20 to about 9. **Nothing else about
this class should be planned before that is asked**, because it changes what the
work is.

Two more gaps need the target to attack back (`riposte`, `setup`), which no Rogue
profile does.

---

## The profiles

| Profile | Talents | DPS | List | Notes |
| --- | --- | --- | --- | --- |
| Combat | 18/33/0 | **419.8** | `ROGUE_COMBAT` | Sinister Strike into Eviscerate |
| Venom | 37/12/2 | **392.7** | `ROGUE_VENOM` | Mutilate, and **eleven of its 51 points are poisons** |
| Rupture | 12/8/31 | **377.1** | `ROGUE_RUPTURE` | Backstab and Hemorrhage, Subtlety |

**EVERY ROGUE FIGURE RECORDED BEFORE POISONS EXISTED WAS A FLOOR.** When the
poison system landed, Venom moved +25.5%, Rupture +16.2%, Combat +8.4%, and all
twenty other profiles were identical to the decimal — which is the containment
check for a change that adds a whole system.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Venom | Main Hand 39.8%, Off Hand 16.9%, Mutilate 12.6%, **Deadly Poison 12.4%, Instant Poison 12.1%**, Mutilate (Off Hand) 5.4% |
| Combat | Main Hand 38.1%, Off Hand 20.6%, Sinister Strike 18.4%, Eviscerate 12.8%, Instant 4.5%, Deadly 3.7% |
| Rupture | Main Hand 39.6%, Backstab 20.5%, Off Hand 15.8%, Deadly 7.4%, Hemorrhage 6.3%, Instant 5.0% |

**AUTO ATTACKS ARE 55–57% OF EVERY ROGUE PROFILE.** A list change here moves a
minority of the damage, which is why several measured as noise. **Poisons are a
quarter of Venom** and about a tenth of the other two.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 53 | 25 | 2 | 6 | **20** |

### The 20 live gaps, grouped by cause

**Stealth and openers (the big block, and the open question above):**
`camouflage`, `master_of_deception`, `improved_ambush`, `initiative`,
`dirty_deeds`, `heightened_senses`, `improved_distract`

**Needs the target to act:** `riposte` (after parrying, and it disarms),
`setup` (a combo point after dodging)

**Needs a kill or a creature type:** `remorseless_attacks` (a kill),
`murder` (creature type), `quietus` — see below

**A declaration that does not exist yet:**

| Talent | What it needs |
| --- | --- |
| `lethality` | crit DAMAGE for six NAMED abilities. `critMultiplierBonus` exists on `AbilityModifiers` and **no talent effect reaches it** |
| `thousand_cuts` | reduces the cost of the NEXT Hemorrhage or Backstab when Rupture ticks. The tick is reachable; the one-shot cost modifier from a periodic is not wired |
| `hack_and_slash` | armor penetration, which the damage pipeline cannot express |
| `serrated_blades` | the same armor penetration |
| `weapon_expertise` | reduces the chance to be dodged or parried. **The attack tables read the DEFENDER for both** |
| `endurance` | Sprint and Evasion, neither implemented |

**Only partly real:** `vile_poisons` and `improved_poisons` **both APPLY** — their
damage and apply-chance bonuses are read by `poisonReactions`. Only the "resist
dispel" and "chance to not consume a charge" halves do not. **Their reasons are
worth re-reading; they read as more broken than they are.**

### `quietus` is the honest version of a trap

Its reason says the target is never below 35% health **and names the Execute
ruling**, correctly, rather than assuming the fraction. `inExecutePhase` is
hardcoded to 20%. **So this is an owner question, not a gap:** is a 35% health
threshold also a clock, and at what fraction of the fight? Compare with the
Priest's Early Demise, which is at 20% and is therefore expressible today.

---

## Never-fired entries

| Entry | Profile | Why |
| --- | --- | --- |
| `eviscerate` | Rupture | the gate's two aura-duration floors never coincide with five combo points. **Ruled fine by the owner: "zero is fine"** |

**Do not "fix" that gate.** The owner has ruled on it. The measurement is recorded:
dropping the two duration floors from the *Venom* entry takes that list from 392.7
to 413.1, which means **the whole −24.3 the Venom list measured is those floors**,
not the Venom entry (which is worth +17.7 there).

**RUPTURE LANDS 1.3 TIMES A FIGHT IN THE LIST NAMED AFTER IT**, at 3.6% of that
build's damage against Backstab's 20.5%. The owner has said **that one IS too low
and is worth revisiting.** It shares a cause with the Eviscerate gate — the same
`≥ 10s` duration floor sits on Rupture's own entry. **This is the single most
promising item in this document.**

## In the book, in no list, never cast

`sinister_strike`, `backstab`, `rupture`, `expose_armor`, `ambush`,
`ghostly_strike` — varying by profile.

- `ambush` needs stealth and cannot be probed at all.
- `expose_armor` and `ghostly_strike` are simply not in the owner's lists.
- **VENOM IS IN NO LIST DELIBERATELY** and it is correctly implemented: +30% to
  poisons loses to the Eviscerate its combo points would have bought, because
  poisons are about a fifth of that build's damage. **A correctly implemented
  ability can be worth casting never.** One line re-measures it the day a
  coefficient moves.

---

## Traps specific to this class

- **A POISON IS NOT A WEAPON USE, BUT IS TRIGGERED BY ONE** — the owner's ruling.
  `isWeaponUseOf(attack, slot)` fires it, and **the poison hit carries no
  `weaponSlot`**, so it cannot proc a second poison, a Crusader or Hand of Justice.
  Getting that backwards does not look wrong: poisons chaining off poisons is a
  bigger number and no error.
- **A POISON'S CHANCE IS FLAT PER STRIKE, NOT PROCS PER MINUTE**, which is the
  opposite of every weapon enchant here. A fast off hand really does poison more
  often. PPM exists to stop exactly that, and the two live side by side.
- **COMBO POINTS BELONG TO A TARGET.** `comboPointTargetId` records whose they are.
  **Anything banking points by writing the pool must set the target too**, or
  every finisher refuses to spend and reads as an ability that lost its flat damage.
- **A finisher spends its points inside its own `onCast`**, where neither the cost
  system nor a damage reaction can see it. `AbilityCastEvent` carries what the cast
  SPENT, measured by snapshotting every pool around it.
- **Energy ticks twenty times a second**, not ten. A rate and a cadence are
  separate decisions; the smoothing change measured +35% to +53% on every energy
  build before the owner confirmed it was intended.
- **The GCD is 1.0 for a Rogue**, and it belongs to the class as `baseGcdMs`.
- **AN UNCONDITIONAL ENTRY IS A FLOOR UNDER EVERYTHING BELOW IT.** The Rupture
  list's original Hemorrhage was 35 energy and ungated with Ghostly Strike at 40
  and Sinister Strike at 45 beneath it — nothing below an ungated cheaper ability
  can ever be the first castable entry, so a six-entry list was really three.
- **Mutilate's "+20% against Poisoned targets" is NOT READ**, and that reason
  expired without anybody touching it: the Venom build now keeps Deadly Poison up
  for most of a fight, so this is a live 20% on the signature ability of the build
  that takes it. **Left for its own PR because it moves a profile.**

---

## What "done" looks like

1. **The stealth question asked and answered.** It decides whether this class's
   queue is 20 or about 9. Nothing else should be planned first.
2. **Mutilate's Poisoned bonus applied** — a live 20% on the Venom build's
   signature ability, with a re-measured baseline.
3. **Rupture's 1.3 applications a fight investigated**, since the owner has said
   it is too low. Isolate the duration floor rather than reordering the list.
4. **`lethality` reached**, since `critMultiplierBonus` exists and nothing uses it.
   The Warlock's Pandemic wants the same mechanism — **build it once.**
5. **`vile_poisons` and `improved_poisons` reasons rewritten** to say what applies,
   since both currently read as gaps and both mostly work.
6. **`quietus` put to the owner** with the Priest's Early Demise, as one question
   about health thresholds rather than two.
