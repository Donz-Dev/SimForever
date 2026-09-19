# Finishing the Warrior

What is left before the Warrior is a class you can trust end to end. Counts and
file claims audited against the code on 2026-09-18.

> The DPS table below was **not** re-measured on that date — it is carried
> forward from the run that added `targetAttacks`. The audit date covers the
> counts and the code references, not the numbers.

Read this alongside [talent-effects.md](talent-effects.md), which covers how a
talent expresses itself and every edge case the Warrior turned up.

---

## Where it stands

Measured with the starting set, 10 seeds × 5 iterations, level 63 dummy:

| Build | Standing target | Target swings back |
| --- | --- | --- |
| Dual-wield, no talents | 118.97 | 182.91 |
| Two-hander, no talents | 119.07 | — |
| 1H & Shield, Shield Slam | 81.33 | 152.12 |
| Dual-wield, full Arms build | 160.60 | — |

> The two columns differ by **rage from damage taken**, which is enormous. A
> damage warrior is not the one being hit, which is why `targetAttacks` is off
> by default. Treat the right column as a tanking scenario.

| | Count | |
| --- | --- | --- |
| Abilities defined | 27 | from the ability spreadsheet |
| Abilities a rotation casts | **11** | the other 16 are inert, situational or unreachable |
| Abilities castable that do NOTHING | **10** | see §1 |
| Talents fully modelled | 27 of 53 | 6 partly, 20 inert |
| Items | 19 | 1 is real Forever data, 18 are Classic stand-ins |
| Armour enchants | **0** | only Crusader, for weapons |

---

## 1. The ten inert abilities — the biggest single gap

Battle Shout, Demoralizing Shout, Sunder Armor, Recklessness, Berserker Rage,
Bloodrage, Shield Wall, Shield Block and the two non-Battle stances are
**castable and do nothing**. They are deliberately absent from every rotation,
because burning a global cooldown for no effect would make the warrior look
worse than it is.

> That is **ten**, and this document called it nine in three places while
> listing ten — the table below had nine rows because Shield Block was written
> up separately. Battle Stance is inert too, which would make eleven, but its
> emptiness is deliberate: the sheet has no Battle Stance row and a neutral
> stance that does nothing is the honest reading, not a missing number.

### What is missing is narrower than it looks

All 21 constants live in one file, `src/game/auras/warrior.ts`, and they are
**not all empty**. Durations and stack counts already carry plausible figures;
it is the **magnitudes** that are zero, and a zero magnitude is what makes an
ability inert.

**Seven need only a number.** Fill the constant and they work:

| Ability | Constant that is empty | Currently | Needs |
| --- | --- | --- | --- |
| **Battle Shout** | `PLACEHOLDER_BATTLE_SHOUT_ATTACK_POWER` | `0` | attack power granted |
| **Demoralizing Shout** | `PLACEHOLDER_DEMORALIZING_SHOUT_ATTACK_POWER` | `0` | attack power removed from the target |
| **Sunder Armor** | `PLACEHOLDER_SUNDER_ARMOR_PER_STACK` | `0` | armor removed per stack |
| **Recklessness** | `PLACEHOLDER_RECKLESSNESS_CRIT_BONUS` | `0` | crit percentage points |
| **Shield Wall** | `PLACEHOLDER_SHIELD_WALL_DAMAGE_TAKEN_MULTIPLIER` | `1` | damage taken multiplier |
| **Defensive Stance** | `..._DAMAGE_DONE`, `..._DAMAGE_TAKEN` | `1`, `1` | both multipliers |
| **Berserker Stance** | `..._DAMAGE_TAKEN`, `..._CRIT_BONUS` | `1`, `0` | multiplier and crit |

**Three need code as well**, and there is no constant waiting to receive a
value — the aura carries no modifier of the right kind at all. A number alone
will not switch these on:

| Ability | State | Needs, beyond the number |
| --- | --- | --- |
| **Bloodrage** | `PLACEHOLDER_BLOODRAGE_INSTANT_RAGE` is `0`, and the aura has no periodic | A rage grant on cast, and a per-tick mechanism. There is **no rage-per-tick constant** to fill; this document previously asked for one that does not exist |
| **Berserker Rage** | duration only, `// No modifiers at all` | Whatever it does has to be expressible first — nothing is stated, so nothing is claimed |
| **Shield Block** | duration only, no modifier | A `blockChance` modifier on the aura. `blockChance` became a real stat with a real outcome after the constant was written, so this is now possible — it just is not wired |

Already plausible and *probably* fine, but still `PLACEHOLDER_` because nothing
confirmed them: Battle Shout 120s, Demoralizing Shout 30s, Recklessness 15s,
Sunder 5 stacks over 30s, Bloodrage 10s, Shield Wall 10s, Shield Block 5s, and
the Overpower and Revenge windows at 5s.

### How to fill them

**The standing decision is: use WoW Classic values, loudly flagged.** Keep the
`PLACEHOLDER_` prefix, keep the comment saying the number is Classic and
unverified. A visibly borrowed number is better than an inert ability; a
*silently* borrowed one is worse than either.

Then, per ability:

1. Fill the constant, leaving the prefix and the comment. For the three in the
   second table, write the mechanism first — otherwise the value lands nowhere
   and the ability stays inert while looking done.
2. Add it to `game/rotations/warrior.ts` with a **measured** priority, not a
   guessed one. The existing entries record their measurements in comments;
   match that.
3. Re-measure the baselines at the top of this document.

**Three will move DPS materially:** Battle Shout (attack power on every swing),
Sunder Armor (armor is in every physical damage event), and Recklessness.

---

## 2. Still blocked on the ruleset owner

Nothing here can be done without data, and asking costs nothing.

### 2.1 Stance gating

**Corrections were promised and never arrived.** The sheet has no Battle Stance
row at all. Stances exist as auras, cost nothing, gate nothing, and are absent
from the rotation because stance dancing for no modelled benefit is pure loss.

Two talents wait on it: Improved Tactical Mastery and Vanguard.

**Ask for:** which abilities require which stance, and what each stance does.

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

### 3.1 Re-measure the rotation — most urgent

`game/rotations/warrior.ts` puts Rend above Mortal Strike, and its comment is
explicit that the ordering was measured **against placeholder weapons**, where
rage was scarce and an armor-ignoring bleed was the best rage a warrior could
spend.

The rage economy has since changed **twice**: the starting set, and the target
swinging back. The 30-rage Mortal Strike reserve is a heuristic from the same
era. Neither has been re-measured.

**Done when:** the priority list and the reserve are re-measured over a few
hundred iterations with the starting set, in both the standing and attacking
cases, and the comments record the new numbers.

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

---

## 5. Standing risks

**The talent structure has only been corrected for Bastion.** Forever removed it
and moved Focused Rage into its slot, found only because capturing values
tripped over it. The eight classes with no values captured could have drifted
the same way and nobody would know.

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

**Every absolute number is provisional.** 18 of 19 items are Classic, the boss
swing figures are Classic, and if the nine abilities above are filled from
Classic then a large part of the warrior's output will be too. Comparisons
between builds hold; absolute DPS does not.
