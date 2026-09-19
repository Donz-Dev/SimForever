# Finishing the Warrior

What is left before the Warrior is a class you can trust end to end. Counts,
file claims and every DPS figure below were produced on 2026-09-18.

Read this alongside [talent-effects.md](talent-effects.md), which covers how a
talent expresses itself and every edge case the Warrior turned up.

---

## Where it stands

Starting set, level 63 dummy, **300 fights per row** with a 95% interval.
Reproduce with `npx vite-node tools/measure_rotation.ts`, which spells out the
talent builds it uses.

| Build | Standing target | Target swings back |
| --- | --- | --- |
| Dual-wield, no talents | **148.13** ± 1.83 | **224.04** ± 1.76 |
| Two-hander, no talents | **148.57** ± 1.60 | — |
| 1H & Shield, no talents | **90.01** ± 1.41 | — |
| 1H & Shield, 31-pt Protection | **101.37** ± 2.14 | **219.07** ± 2.52 |
| Dual-wield, 31-pt Arms | **187.41** ± 2.66 | — |
| Fury to Death Wish | **182.98** ± 2.17 | — |
| the same, without Death Wish | **171.39** ± 2.10 | — |

> The two columns differ by **rage from damage taken**, which is enormous. A
> damage warrior is not the one being hit, which is why `targetAttacks` is off
> by default. Treat the right column as a tanking scenario.

**These are not comparable to the figures published before 2026-09-18.** The
previous table read 118.97 / 119.07 / 81.33 / 160.60 and was measured before the
ten inert abilities had their effect magnitudes, so three of the rotation's
strongest actions were doing nothing. Filling them is worth **+28.32 DPS** on a
geared dual-wielder on its own.

The old table also recorded no talent builds, so its "Shield Slam" and "full
Arms" rows could not be reproduced by anyone. The harness now writes its builds
out talent by talent; both are 31-point capstone builds.

| | Count | |
| --- | --- | --- |
| Abilities defined | 27 | from the ability spreadsheet |
| Abilities a rotation casts | **14** | Battle Shout, Recklessness and Sunder Armor joined the list |
| Abilities castable that do NOTHING | **3** | was 10; see §1 |
| Talents fully modelled | 27 of 53 | 6 partly, 20 inert |
| Items | 19 | 1 is real Forever data, 18 are Classic stand-ins |
| Armour enchants | **0** | only Crusader, for weapons |

---

## 1. ~~The ten inert abilities~~ — SOLVED, and not the way this document said

Battle Shout, Demoralizing Shout, Sunder Armor, Recklessness, Shield Wall and
both non-Battle stances **now do what Forever says they do**. Only Berserker
Rage, Bloodrage and Shield Block are still inert, and each for a stated reason
below.

### The plan was wrong, and it would have produced wrong numbers

This document said the magnitudes were missing and had to come from the ruleset
owner, and that in the meantime the standing decision was to borrow WoW Classic
values under `PLACEHOLDER_` names.

**They were never missing.** `nether.wowhead.com/forever/tooltip/item/<id>` was
already known to serve Forever item data. The same host serves
`/forever/tooltip/spell/<id>`, and every one of these abilities is there with a
real Forever number.

Borrowing from Classic would have been confidently wrong:

| | Forever | Classic | The borrow would have been |
| --- | --- | --- | --- |
| Demoralizing Shout | −210 AP, 45 sec | −146 AP, 30 sec | **30% too weak** |
| Shield Wall | 60% for 12 sec | 75% for 10 sec | too strong, too short |
| Shield Block | +75% block, 7 sec, **2 attacks** | +75% block, 5 sec, 1 attack | half the blocks |

Three of the durations already on file as "plausible and *probably* fine" were
also simply wrong: Battle Shout is 3 minutes and not 120 seconds, Demoralizing
Shout 45 seconds and not 30, Shield Wall 12 and not 10.

### What the numbers are

Captured by `tools/import_spell.mjs` into `src/data/abilities/forever-warrior.json`,
transcribed into named constants in `src/game/auras/warrior.ts`, and
cross-checked against the stored tooltip by
`tests/game/warriorAbilityValues.test.ts`.

| Ability | Spell | Forever |
| --- | --- | --- |
| Battle Shout | 25289 | +140 attack power, 3 min |
| Demoralizing Shout | 11556 | −210 attack power, 45 sec |
| Sunder Armor | 11597 | −450 armor a stack, 5 stacks, 30 sec |
| Recklessness | 1719 | +100 crit, 15 sec, +20% damage taken |
| Shield Wall | 871 | −60% damage taken, 12 sec |
| Defensive Stance | 71 | −10% damage done, −10% taken |
| Berserker Stance | 2458 | +3 crit, +10% damage taken |
| Battle Stance | 2457 | **nothing at all** — confirmed, not assumed |

### What it was worth

Three of them are in the rotation with measured priorities. Ablation, 200
fights per row, geared dual-wielder:

| | DPS | Cost of removing it |
| --- | --- | --- |
| All three openers | 148.20 ± 2.38 | — |
| without Sunder Armor | 135.69 | **−12.51** |
| without Battle Shout | 136.37 | **−11.83** |
| without Recklessness | 142.87 | −5.33 |
| no openers at all | 119.88 ± 1.71 | **−28.32** |

**+28.32 DPS, about a quarter of the class's output**, was sitting in three
abilities that burned no global cooldown because the rotation correctly refused
to cast things that did nothing.

Whether the openers sit above or below the strikes is **not measurable**: 148.20
± 2.38 against 145.44 ± 2.13. They are kept above on principle, and the honest
statement is that the measurement does not object rather than that it agrees.

### Still inert, and why

| Ability | Why |
| --- | --- |
| **Berserker Rage** | Forever's own tooltip names **no magnitude** — "generating extra rage when taking damage". Its other half is Fear and Incapacitate immunity, which the engine has no notion of. Not a gap in the capture; a gap in the source. |
| **Bloodrage** | Forever gives the number — 10 rage instantly then 10 more over 10 sec, at 20% of base health. The aura has **no periodic and no rage-grant mechanism**, so this needs code, not data. |
| **Shield Block** | +75% block for 7 sec, limited to **2 attacks**. The per-attack charge cap is not expressible, and granting +75% block for a full 7 seconds without it would overstate it badly. |

**Demoralizing Shout is deliberately not in the rotation**, though it works. It
lowers the *target's* attack power, which does nothing to a standing dummy and
is actively negative when the target swings back — less damage taken is less
rage from damage taken. It is a survival cooldown in a simulator that does not
model survival.

---

## 2. Still blocked on the ruleset owner

Nothing here can be done without data, and asking costs nothing.

### 2.1 Stance gating

**Only the GATING is still missing.** What each stance *does* is now known --
Defensive is −10% damage done and −10% taken, Berserker is +3 crit and +10%
taken, and Battle Stance genuinely does nothing. Which abilities each stance
*requires* is not in the tooltips, and that is the part the rotation needs
before it can stance dance.

The spell tooltips do carry a "Requires Berserker Stance" line, which is a
lead rather than an answer: it appears on some abilities and the ability
spreadsheet contradicts none of it because the spreadsheet says nothing at all.
**Worth checking before asking again** — see §3.6.

Two talents wait on it: Improved Tactical Mastery and Vanguard.

**Ask for:** which abilities require which stance.

### 2.2 The five missing abilities

Sweeping Strikes, Death Wish, Piercing Howl, Last Stand and Concussion Blow are
talents that grant an ability, and none of those abilities is in the
spreadsheet. The grants are already declared, so they gate correctly the moment
the abilities exist.

**Ask for:** their rows.

### 2.3 Defense skill

Player dodge, parry and block are all wired and read from the character's own
stats. What is missing is **defense skill only**: the attacks-received table
uses flat ruleset constants for boss miss, crit and crush, and shifting them by
a skill comparison needs a formula Forever has not given.

Anticipation is the one talent waiting on it.

### 2.4 Forever item ids

The ids, and only the ids. The DATA is reachable — see §3.5, which is where the
tooling for it lives, because that part is not blocked at all.

**Ask for:** item ids. Anything with one can be imported today.

---

## 3. Doable now, no new data needed

### 3.1 ~~Re-measure the rotation~~ — DONE

`game/rotations/warrior.ts` put Rend above Mortal Strike on an ordering measured
**against placeholder weapons**, and the rage economy had changed twice since.

Re-measured on 2026-09-18 with `tools/measure_rotation.ts`, at 200-300 fights a
row instead of the 400 iterations of a single build the old note described.
**Rend above Mortal Strike survives** — it is still the most rage-efficient
thing a warrior does and still ignores armor, and Sunder Armor stripping 2250
armor does not change that ordering because the bleed was never subject to armor
in the first place.

What did change is the top of the list: Battle Shout, Recklessness and Sunder
Armor now sit above every strike, worth +28.32 DPS together.

**The 30-rage Mortal Strike reserve is still a heuristic and still unmeasured.**
It was not touched. That is the remaining piece of this item.

### 3.2 Wire the Import and Load buttons

`ProfilePanel.tsx` is **written and not mounted**. Its serialize-out, parse-in
and render-issues round trip is exactly what the Import and Load buttons above
the character name need, and those buttons currently call `() => undefined`.

Profiles now carry talents, equipment and the encounter switches, so saving a
build is worth something in a way it was not before.

### 3.3 Talents needing only wiring

- **Enrage** and **Master of Defense** — both were filed as blocked on nothing
  attacking the player, and both stopped being blocked when `targetAttacks`
  landed. Their per-rank values are already captured: Enrage is a 30% chance on
  being hit to deal 2–10% more physical damage for 12s, Master of Defense a
  50/100% chance of 5 rage on a dodge or parry with a shield. Each needs a
  talent-granted reaction, which is the shape Shield Specialization already
  uses on a block. **The cheapest remaining talent wins.**
- **Combat-start auras** — Anger Management and Death Wish. The aura mechanism
  exists and `trainingDummyEncounter` has the slot for opening buffs; nothing
  connects a talent to it.
- **Weaponmaster's sword clause** — needs a talent-granted reaction that
  triggers an extra attack. `extraAttack` exists, and effects can now read a
  talent's third value through `valueIndex`.

**Blood Craze stays inert, and for a real reason.** Its trigger is reachable
now, but it regenerates health, the player cannot drop below one health, and
survival is not modelled — so there is nothing for the heal to restore. It
becomes meaningful when survival does.

### 3.4 Armour enchants

There are none. Only Crusader, for weapons.

### 3.5 More Forever items

Not blocked — `https://nether.wowhead.com/forever/tooltip/item/<id>` **works**,
and the importer is written. Only the ids are missing (§2.4).

```bash
node tools/import_item.mjs forever <id>   # prints the entry to append
node tools/import_item.mjs --verify       # re-parses everything on file
```

`--verify` currently reproduces all 19 items exactly, which is why the tool can
be trusted with the next one.

### 3.6 Stance gating is partly answerable without asking

**The spell tooltips carry a stance requirement line.** Of the eleven captured
so far, four state one:

| Spell | Requires |
| --- | --- |
| Recklessness | Berserker Stance |
| Berserker Rage | Berserker Stance |
| Shield Wall | Defensive Stance |
| Shield Block | Defensive Stance |

The other seven state none, which is itself information: Battle Shout,
Demoralizing Shout, Sunder Armor and Bloodrage are castable in any stance.

**This does not close §2.1 on its own**, because only eleven spells have been
captured — the ones whose magnitudes were missing. Capturing the other sixteen
Warrior abilities would say whether Mortal Strike, Whirlwind, Overpower and the
rest carry requirements, and that is the whole of what the ruleset owner was
being asked for.

It is cheap: `node tools/import_spell.mjs forever <id>` per ability, and the
ids are on Wowhead. **Do this before asking again.**

Gating itself is a second piece of work: the engine would need `Ability.stance`,
a `canCast` check, and a rotation willing to spend a global cooldown swapping.
Two talents wait on that — Improved Tactical Mastery and Vanguard.

---

## 4. Done

Struck through rather than deleted, so finished work is not re-derived.

- ~~**A block outcome and block value**~~ — Shield Slam gained its missing damage
  component (+5.3 DPS), Revenge triggers on all three of its openings, Shield
  Specialization is modelled, and the shield's own block stats are real.
- ~~**Make something attack the player**~~ — `encounter.targetAttacks`. Brought
  the attacks-received table, rage from damage taken, Revenge and block to life,
  and exposed three bugs that could not show while nothing swung. **Five talent
  entries went on claiming it had not happened**, for three commits; see §5.
- ~~**Shields**~~ — The Immovable Object, the first real Forever item. It also
  settled that the missing shield was *never* why 1H & Shield lagged.
- ~~**A starting set**~~ — a Warrior begins geared, so the first number a person
  sees is one worth reading.
- ~~**The ten inert abilities**~~ — seven of ten filled from Forever's own spell
  data, not the Classic stand-ins this document planned for. Worth +28.32 DPS.
  See §1; the three that remain each name their own obstacle.
- ~~**Re-measure the rotation**~~ — done, with a reproducible harness that
  writes its talent builds out. The Mortal Strike rage reserve is the one part
  still unmeasured.

---

## 5. Full talent audit — all 53, against the Forever calculator

Audited against <https://www.wowhead.com/forever/talent-calc/warrior> on
2026-09-18. **28 of 53 are fully simulated, 5 partly, 20 not at all**, which is
why a build shows entries under "Chosen but not simulated" in the Talent panel.
That list is not an error: it is the panel refusing to let an unmodelled talent
look like it is working.

### Two things the audit found wrong

**1. The Protection tree has the wrong talent in it.** At tier 20, column 3,
five ranks, Forever has **Bastion** — *"Increases all damage you deal by 10%
while a shield is equipped."* `src/data/talents/warrior.json` has **Vitality**
(*"Increases your Stamina and Strength by 2-10%"*) in that slot instead.

This is the same slot that caused trouble before. HANDOVER records that Forever
"removed Bastion and moved Focused Rage into its slot", and the structure file
was corrected **by hand** — the one hand edit this data has ever taken. Bastion
is on the live calculator today with five ranks. Either Forever changed again or
the hand edit was wrong; either way the file disagrees with its source now, and
the hand edit is the obvious suspect.

It matters more than a name. Bastion is a **flat damage increase for a shield
build**, which is the weakest build the simulator reports. A Protection warrior
is currently offered a talent Forever does not have, and denied one that would
be among its best.

**The fix is a re-scrape, not another hand edit.** `src/data/talents/README.md`
has the method.

**2. Talent prerequisites are not enforced.** The data carries them correctly —
Mortal Strike requires a point in Sweeping Strikes, Bloodthirst one in Death
Wish, Shield Slam one in Concussion Blow, Flurry five in Enrage — and
`talentBuild` ignores them. A warrior with no points in Sweeping Strikes is
still granted Mortal Strike.

So every allocation measured with so far is *possibly* illegal, including the
31-point Arms build in `tools/measure_rotation.ts`, which skips Sweeping
Strikes. The DPS effect is small, because Sweeping Strikes does nothing against
one target, but the rule is not applied anywhere and a profile loaded from JSON
is not checked at all.

### The table

`yes` means the talent changes a simulation. `partly` means something real plus
a stated gap. `no` means it is inert, and the Talent panel says so on screen.

### Arms

| T | Talent | Ranks | What Forever says | Simulated |
| --- | --- | --- | --- | --- |
| 0 | Improved Heroic Strike | 3 | Reduces the cost of your Heroic Strike ability by 3 Rage. | **yes** |
| 0 | Deflection | 5 | Increases your Parry chance by 5%. | **yes** |
| 0 | Improved Rend | 3 | Increases the Bleed damage done by your Rend ability by 35%. | **yes** |
| 5 | Improved Charge | 2 | Increases the Rage generated by your Charge ability by 6. | **yes** |
| 5 | Improved Tactical Mastery | 5 | Tactical Mastery lets you retain up to an additional 15 Rage when you change stances. | **no** |
| 5 | Improved Overpower | 2 | Increases the critical strike chance of your Overpower ability by 50%. | **yes** |
| 10 | Anger Management | 1 | Generates 1 Rage every 3 sec while in combat, and reduces Rage loss while out of combat by 30%. | **no** |
| 10 | Deep Wounds | 3 | Your critical strikes cause your opponent to Bleed, dealing 60% of your melee weapon's average damage over 12 sec. | **yes** |
| 15 | Spearing Strike | 1 | A brutal attack that deals 40% weapon damage. Deals an additional 80% weapon damage against Giants, Dragonkin, and mounted targets. Mounted targets... | **yes** |
| 15 | Two-Handed Weapon Specialization | 3 | Increases the damage you deal with two-handed melee weapons by 3%. | **yes** |
| 15 | Impale | 2 | Increases the critical strike damage bonus of your abilities by 20%. | **yes** |
| 20 | Bloodthrill | 5 | Your melee attacks against targets afflicted by your Rend have a 10% chance to activate your Overpower ability for 1 attack on your current target.... | **yes** |
| 20 | Sweeping Strikes | 1 | Your next 5 melee attacks strike an additional nearby opponent. | partly |
| 20 | Weaponmaster | 5 | Gives your melee weapon attacks a benefit depending on the weapon. Axe/Polearm: Increases your critical strike chance by 5%. Mace/Staff: Your attac... | partly |
| 25 | Improved Slam | 2 | Reduces the global cooldown and cast time of your Slam ability by 0.5 sec. In addition, Slam no longer interrupts your melee swing time. | **yes** |
| 25 | Improved Hamstring | 3 | Gives your Hamstring ability a 15% chance to immobilize the target for 5 sec. | **no** |
| 30 | Mortal Strike | 1 | A vicious strike that deals weapon damage plus 85 and wounds the target, reducing the effectiveness of any healing by 50% for 10 sec. | **yes** |

### Fury

| T | Talent | Ranks | What Forever says | Simulated |
| --- | --- | --- | --- | --- |
| 0 | Booming Voice | 5 | Increases the radius of your Battle Shout and Demoralizing Shout abilities by 50%. | **no** |
| 0 | Cruelty | 5 | Increases your chance to get a critical strike with melee attacks by 5%. | **yes** |
| 5 | Iron Will | 5 | Reduces the duration of Stun and Fear effects inflicted on you by 15%. | **no** |
| 5 | Unbridled Wrath | 5 | Gives you a 60% chance to generate 1 additional Rage when you deal melee damage with a weapon. This effect is increased to 2 Rage for two-handed we... | **yes** |
| 10 | Improved Cleave | 3 | Reduces the Rage cost of your Cleave ability by 3. | **yes** |
| 10 | Piercing Howl | 1 | Causes all nearby enemies to be Dazed, reducing movement speed by 50% for 6 sec. | partly |
| 10 | Blood Craze | 3 | Regenerates 3% of your total Health over 6 sec after being the victim of a critical strike, dealing damage with Bloodthirst, or suffering more than... | **no** |
| 10 | Boundless Rage | 3 | Increases your maximum Rage by 30. | **yes** |
| 15 | Dual Wield Specialization | 5 | Increases your off-hand weapon damage by 25%, off-hand Rage generation by 100%, and chance to hit with off-hand attacks by {2}%. | **no** |
| 15 | Raging Blows | 1 | Causes your Whirlwind to also strike with your off-hand weapon, and reduces the Rage cost of your Cleave ability by 2. | **no** |
| 15 | Enrage | 5 | Gives you a 30% chance to deal 10% increased Physical damage for 12 sec after being the victim of any damaging attack. | **no** |
| 15 | Improved Execute | 2 | Reduces the Rage cost of your Execute ability by 5. | **yes** |
| 20 | Precision | 3 | Increases your chance to hit with all abilities and attacks by 3%. | **yes** |
| 20 | Death Wish | 1 | When activated, increases your Physical damage done by 20% and makes you immune to Fear effects, but increases all damage you take by 5%. Lasts 30 ... | **yes** |
| 20 | Improved Intercept | 2 | Reduces the cooldown of your Intercept ability by 10 sec. | **yes** |
| 25 | Improved Berserker Rage | 2 | Your Berserker Rage ability will instantly generate 10 Rage and has a 100% chance to remove all movement impairing effects when activated. | **no** |
| 25 | Flurry | 5 | Increases your melee attack speed by 25% for your next 3 swings after dealing a melee critical strike. | **yes** |
| 30 | Bloodthirst | 1 | Instantly attack the target causing damage equal to 35% of your Attack Power plus 30 and increasing your movement speed by 10% for 10 sec. | **yes** |

### Protection

| T | Talent | Ranks | What Forever says | Simulated |
| --- | --- | --- | --- | --- |
| 0 | Shield Specialization | 5 | Increases your chance to Block attacks with your shield by 5% and grants you a 100% chance to generate 5 Rage when you Block. | **yes** |
| 0 | Anticipation | 5 | Increases your Defense Skill by 20. | **no** |
| 5 | Improved Bloodrage | 2 | Increases all the Rage generated by your Bloodrage ability by 50%. | **no** |
| 5 | Toughness | 5 | Increases your Armor value from items by 10%. | **no** |
| 5 | Improved Thunder Clap | 3 | Reduces the Rage cost of your Thunder Clap ability by 6. | **yes** |
| 10 | Last Stand | 1 | When activated, this ability temporarily grants you 30% of your maximum health for 20 sec. After the effect expires, the health is lost. | partly |
| 10 | Master of Defense | 2 | Grants you a 100% chance to generate 5 Rage when you Dodge or Parry while a shield is equipped. | **no** |
| 10 | Improved Revenge | 3 | Increases damage dealt by your Revenge ability by 60%. | **yes** |
| 10 | Defiance | 3 | Increases all threat generated in Defensive stance by an additional 15% while a shield is equipped. | **no** |
| 15 | Improved Sunder Armor | 3 | Reduces the Rage cost of your Sunder Armor ability by 3. | **yes** |
| 15 | Improved Disarm | 3 | Reduces the cooldown of your Disarm ability by 20 secs. | **no** |
| 15 | Vanguard | 1 | Your Charge ability is now usable while in Defensive Stance. | **no** |
| 20 | Improved Shield Wall | 2 | Reduces the cooldown of your Shield Wall ability by 11 min. | **no** |
| 20 | Concussion Blow | 1 | Stuns the target for 5 sec. | partly |
| 20 | Improved Shield Bash | 2 | Gives your Shield Bash ability a 100% chance to Silence the target for 3 sec. | **no** |
| 20 | Vitality | 5 | Increases your Stamina and Strength by 10%. | **yes** |
| 25 | Focused Rage | 3 | Reduces the Rage cost of your offensive abilities by 3. | **no** |
| 30 | Shield Slam | 1 | Slam the target with your shield, causing 421 to 439 damage, increased by your Block Value, and has a 50% chance of dispelling 1 magic effect on th... | **yes** |

### Why the twenty are inert

Grouped, because each blocker covers several:

| Blocker | Talents | Can it be fixed? |
| --- | --- | --- |
| **Needs a talent-granted reaction** | Enrage, Master of Defense, Weaponmaster's sword clause | **Yes, today.** Values captured, trigger exists, Shield Specialization is the worked example. The cheapest remaining wins |
| **Out of scope by decision** | Improved Hamstring, Improved Disarm, Improved Shield Bash, Defiance, Booming Voice, Iron Will | Snares, disarms, threat and shout radius. Non-combat |
| **Stances gate nothing yet** | Improved Tactical Mastery, Vanguard | **Yes** — the gating data now exists. Needs `Ability.stance` and a rotation willing to swap |
| **The ability it modifies is inert** | Improved Bloodrage, Improved Berserker Rage, Improved Shield Wall | Waits on Bloodrage's rage mechanism and Berserker Rage's missing magnitude |
| **No defense skill** | Anticipation | Needs a formula Forever has not given |
| **Talent-driven combat-start aura** | Anger Management | The mechanism exists; nothing wires a talent to it |
| **Engine holds one armor number** | Toughness | It scales armor FROM ITEMS, and the engine cannot separate item armor from base |
| **Source does not say what it affects** | Focused Rage | "Your offensive abilities", unnamed. Choosing the set would be inventing the talent |
| **Modelling part would misrepresent it** | Dual Wield Specialization, Raging Blows | Each is several effects at once, and the expressible subset alone understates them |
| **Survival is not modelled** | Blood Craze | Heals after a crit, and the player cannot drop below one health |

**Six of the twenty are out of scope rather than pending**, so the honest
denominator is 47, of which 33 do something.

### The order worth doing them in

1. **Re-scrape the talent structure** and get Bastion back. Wrong data, not
   missing work, and it costs a shield build one of its best talents.
2. **Enforce prerequisites** in `talentBuild`, and validate a loaded profile.
3. **Enrage and Master of Defense** — one reaction each, values already
   captured.
4. **Stance gating**, now that the data exists.

---

## 6. Standing risks

**The talent structure is WRONG, and the hand edit is the likely cause.** The
Protection tree's tier 20 slot holds Vitality in this repository and Bastion on
the live calculator. That slot is exactly the one that was hand-corrected when
Bastion appeared to have been removed — the single hand edit this data has ever
taken, and it now disagrees with its source. See §5.

The eight classes with no values captured have never been re-checked at all and
could have drifted the same way, with nobody the wiser. A full re-scrape is the
honest fix and is still not done.

**Talent prerequisites are not enforced.** The data carries them; `talentBuild`
ignores them. Mortal Strike is granted without Sweeping Strikes. Any allocation
the project has measured with may be illegal, and a profile loaded from JSON is
not checked at all. See §5.

**Unmodelled reasons go stale, and this is the failure mode that recurs.** The
classification has now been wrong **eight times, in two rounds**. The first
three — Improved Rend, Improved Overpower, Unbridled Wrath — were each blocked
on something that already existed. The second five all claimed nothing attacked
the player, three commits after something did: Enrage, Master of Defense and
Blood Craze stayed inert for a reason that had expired, and **Shield
Specialization and Improved Revenge were fully working while still printing a
caveat saying they could not fire.**

Two lessons, both paid for:

- **Clearing a blocker is not done until every reason that named it is
  re-read.** §4 recorded `targetAttacks` as finished and nobody swept the
  reasons; the count of fully-modelled talents was understated by two for three
  commits.
- **A test pinned to a temporary limitation outlives the limitation.** The
  Shield Specialization test was named *"still says it cannot fire, because
  nothing attacks the player"* and enforced the stale caveat instead of
  catching it. Assert what should stay true, not what happens to be true today.

**Survival is not modelled.** With `targetAttacks` on, a healer is *assumed*: the
character cannot drop below one health. Such a run says nothing about whether
they would live.

**Every absolute number is provisional, but less so than it was.** 18 of 19
items are still Classic and the boss swing figures are still Classic. The
ability magnitudes are no longer among the borrowed numbers — they are Forever's
own. Comparisons between builds hold; absolute DPS still does not.

**A source being reachable is not the same as it having been checked.** The
spell endpoint was available the entire time this document said the magnitudes
were missing and had to be requested. Nobody tried it, because the item endpoint
was filed under "items". Before recording anything as blocked on the ruleset
owner, try the obvious neighbouring URL.
