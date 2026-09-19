# Warrior abilities

Source: **`WoWForeverWarriorAbilities.xlsx`**, supplied by the ruleset owner.

This file is the provenance record. The spreadsheet lives outside the repository
alongside the other `WoWForever*` source files, so it is transcribed here
verbatim and the gaps are listed explicitly. Read it before changing a number in
[`src/game/abilities/warrior.ts`](../src/game/abilities/warrior.ts) or
[`src/game/auras/warrior.ts`](../src/game/auras/warrior.ts).

---

## The sheet, verbatim

Cooldown and cast time are in seconds, as the sheet states them.

| Name | Rage cost | Cooldown | Cast | Attack table | Base damage | Attack power coefficient |
| --- | --- | --- | --- | --- | --- | --- |
| Revenge | 5 | 5 | 0 | Melee Special Attack | 81 to 99 | 0 |
| Rend | 10 | 0 | 0 | Melee Special Attack | 147 damage/21 sec, ticks every 3 seconds | 0% per tick |
| Overpower | 5 | 5 | 0 | Melee Special Attack | 35 | Weapon Damage |
| Heroic Strike | 15 | 0 | 0 | Melee Special Attack | 157 | Weapon Damage (on-next Main Hand swing) |
| Cleave | 20 | 0 | 0 | Melee Special Attack | 50 | Weapon Damage (hits a second target if possible) |
| Bloodthirst | 30 | 6 | 0 | Melee Special Attack | 30 | 0.35 |
| Battle Shout | 10 | 0 | 0 | Other/Buff | | |
| Thunder Clap | 20 | 4 | 0 | Ranged Special Attack | 103 | 0 |
| Sunder Armor | 15 | 0 | 0 | Melee Special Attack | | |
| Execute | 15 + all remaining rage | 0 | 0 | Melee Special Attack | 600 + 15 × each point of remaining rage after cost was taken out | 0 |
| Slam | 15 | 0 | 1.5 | Melee Special Attack | | Weapon Damage |
| Hamstring | 10 | 0 | 0 | Melee Special Attack | 45 | 0 |
| Demoralizing Shout | 10 | 0 | 0 | Other/Debuff | | |
| Intercept | 10 | 30 | 0 | Ranged Special Attack | 65 | 0 |
| Recklessness | 0 | 1800 | 0 | Other/Buff | | |
| Charge | Generates 15 | 15 | 0 | Ranged Special Attack | | |
| Whirlwind | 25 | 10 | 0 | Melee Special Attack | | Weapon Damage (can hit up to 4 targets) |
| Berserker Rage | 0 | 30 | 0 | Other/Buff | | |
| Berserker Stance | 0 | 1 | 0 | Other/Buff | | |
| Shield Wall | 0 | 1800 | 0 | Other/Buff | | |
| Shield Block | 10 | 5 | 0 | Other/Buff | | |
| Defensive Stance | 0 | 1 | 0 | Other/Buff | | |
| Bloodrage | 0 | 60 | 0 | Other/Buff | | |
| Mortal Strike | 30 | 6 | 0 | Melee Special Attack | 160 | Weapon Damage |
| Spearing Strike | 15 | 20 | 0 | Melee Special Attack | | 40% Weapon Damage |
| Shield Slam | 20 | 6 | 0 | Melee Special Attack | 421 to 439 + shield block value | 0 |

## The weapon damage formula

Stated separately by the ruleset owner, and **universal across all classes**:

```
weapon damage = main hand (or off hand) base damage
              + base weapon speed / 14 * attack power
```

An ability with its own flat damage adds it on top:

```
Mortal Strike = weapon base damage + speed / 14 * attack power + 160
```

The off-hand penalty **applies once to the final calculation**, not to the
weapon's base damage alone. So an off-hand Mortal Strike is
`(weapon + power + 160) × 0.5`, never `(weapon + power) × 0.5 + 160`.

Two consequences worth stating:

- The divisor uses the weapon's **actual** base speed. Some rulesets normalise
  special attacks to a fixed speed per weapon class; Forever's formula as given
  does not.
- This **replaced an invented `powerCoefficient: 0.35`** on every weapon. For
  the 2.6 second placeholder one-hander the correct coefficient is 0.186, so
  auto-attack damage was previously overstated by most of its attack power
  contribution. Weapon coefficients are now derived in
  [`src/game/combat/weaponDamage.ts`](../src/game/combat/weaponDamage.ts).

## Reading the coefficient column

The column is labelled "attack power coefficient" but carries three different
kinds of value, and the difference matters:

| Value in the sheet | Means | Abilities |
| --- | --- | --- |
| `Weapon Damage` | full weapon damage, plus the ability's flat damage | Mortal Strike, Overpower, Heroic Strike, Cleave, Slam, Whirlwind |
| `40% Weapon Damage` | a fraction of weapon damage | Spearing Strike |
| a number (`0.35`) | flat + coefficient × attack power, **no** weapon damage | Bloodthirst |
| `0` | flat damage only, no scaling of any kind | Revenge, Thunder Clap, Hamstring, Intercept, Execute, Shield Slam |

A `0` is read as "genuinely does not scale", not as "unknown". This matches how
the same abilities are built in Classic, which is the only corroboration
available.

---

## What the sheet does not say

Everything below is missing data. Nothing here has been invented into a
plausible number; each is either a flagged `PLACEHOLDER_*` constant or an
explicitly confirmed assumption.

### Confirmed by the ruleset owner, not in the sheet

These were **explicitly confirmed** as Classic behaviour when asked, so they are
implemented. They are recorded here because the spreadsheet alone does not
support them.

| Thing | Value |
| --- | --- |
| Execute's health threshold | below 20% target health |
| Overpower's trigger | the target recently dodged |
| Revenge's trigger | the warrior recently blocked, parried or dodged |
| Thunder Clap / Intercept / Charge | resolve against the **literal** ranged table |

### Missing entirely — currently `PLACEHOLDER_*`

Nine of the twenty-six rows are buffs or debuffs with a cost and a cooldown and
**no effect value and no duration**. All are defined so they can be cast and
seen, and all currently do nothing.

| Ability | What is missing |
| --- | --- |
| Battle Shout | attack power granted, duration, radius |
| Demoralizing Shout | attack power removed, duration |
| Sunder Armor | armor per stack, maximum stacks, duration |
| Recklessness | effect, duration |
| Berserker Rage | effect, duration |
| Bloodrage | rage granted, duration |
| Shield Wall | damage reduction, duration |
| Shield Block | effect, duration |
| Both stances | what a stance actually does |

Also missing:

- **Shield block value.** Shield Slam is "421 to 439 **+ shield block value**".
  No such stat exists in the engine and no gear grants one, so Shield Slam is
  currently undervalued by whatever a shield would contribute.
- **Hamstring's slow**, and **Intercept's stun** — irrelevant against a
  stationary dummy, but unstated.
- **Charge's constraints.** A minimum range and being out of combat are the
  usual ones. Without them it is a free 15 rage every 15 seconds, which is why
  it is left out of the rotation.
- **Whether Heroic Strike and Cleave are off the global cooldown.** They are in
  Classic. They currently trigger it, which costs a warrior real throughput if
  Forever kept the Classic behaviour.
- **Whether Slam's 1.5 second cast pauses the swing timer.** It does in Classic.
  It currently does not, so Slam is left out of the rotation.
- **Overpower and Revenge window lengths.** Both placeholder at 5 seconds.

### Open questions

- **Battle Stance has no row.** Berserker and Defensive both do. A warrior with
  no way back to a neutral stance is not a coherent ruleset, so Battle Stance is
  defined anyway — with the same zero cost and 1 second cooldown as the other
  two. That it exists at all is an assumption.
- **Stance gating is undecided.** Which abilities require which stance is not in
  the sheet. A Classic-derived mapping was proposed and the ruleset owner is
  sending corrections, so **no gating is implemented yet** and the rotation does
  not stance dance.
- **Mortal Strike and Bloodthirst are both present**, at the same 30 rage and
  the same 6 second cooldown.

  **ANSWERED by the talent calculator** (see below): Mortal Strike, Bloodthirst
  and Shield Slam are the 31-point capstones of Arms, Fury and Protection. Two
  capstones costs 62 points against a budget of 51, so a warrior can reach
  exactly one. `abilitiesForClass` currently hands out all three at once, which
  is now known to be wrong; fixing it needs talents to actually gate abilities,
  which is the next step after talent effects exist.

---

## A second Forever source, and where it disagrees

The talent calculator at https://www.wowhead.com/forever/talent-calc/warrior is
the source for `src/game/talents/warriorTalents.ts`. Its tooltips restate some
of the same abilities, which makes it a check on the spreadsheet.

Where they AGREE, confidence goes up:

| Ability | Spreadsheet | Calculator |
| --- | --- | --- |
| Bloodthirst | 30 base, 0.35 coefficient | "35% of your Attack Power plus 30" |
| Shield Slam | 421 to 439 + shield block value | "421 to 439 damage, increased by your Block Value" |
| Spearing Strike | 40% Weapon Damage | "deals 40% weapon damage" |

Where they DISAGREED:

| Ability | Spreadsheet | Calculator |
| --- | --- | --- |
| **Mortal Strike** | base damage **160** | "weapon damage plus **85**" |

**RESOLVED: 160 is correct.** Confirmed by the ruleset owner. Mortal Strike is
weapon damage plus 160; the talent calculator's 85 is wrong for Forever. The
code always used 160, so nothing changed.

The calculator also confirms **Spearing Strike is an Arms talent**, which is why
it had no Classic counterpart to check against.

## Engine changes this required

| Change | Why |
| --- | --- |
| `DamageRequest.weaponScaling` | abilities that deal weapon damage, with the off-hand penalty applied once to the total |
| `Ability.onNextSwing` | Heroic Strike and Cleave replace the next auto-attack rather than landing on cast |
| Auto-attacks route through `weaponScaling` | a swing and a Mortal Strike can no longer disagree about the same weapon |
| `Reaction` | Overpower and Revenge respond to an attack result |

## Still not reachable

- **Revenge** can never be cast. It needs the warrior to have been attacked, and
  nothing attacks the player unless `encounter.targetAttacks` is on.
- **Overpower** can never be cast. It needs the engine to let content observe an
  attack result, which does not exist — there is no hook for a reactive proc.
  This is the next engine gap worth closing.
