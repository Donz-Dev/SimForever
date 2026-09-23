# Engine gap survey: what the other eight classes need

Taken **2026-09-23**, before implementing any class beyond the Warrior. Every
row below was checked against the code rather than assumed.

The short answer: **14 of the 20 profiles need no engine change at all.** Six
are blocked, on three features between them.

## What is already there

Enough that the survey is mostly a list of things *not* to build.

| | Where |
| --- | --- |
| **Resources**: mana, rage, energy, focus, runic power, holy power, **combo points** | `engine/resources/Resource.ts` |
| **Mana regeneration**, the five-second rule, and `manaRegenBypass` | `game/combat/resourceRules.ts` |
| **Energy regeneration**, 20 every 2 seconds | same |
| **The spell attack table** — 17% base miss, 1.5× crit, hit subtracting from miss, crit suppression by level | `game/combat/attackChances.ts` |
| **Spell power scaling** — `dealDamage` already reads `spellPower` instead of `attackPower` for any non-physical school | `engine/combat/damage.ts:208` |
| **Seven damage schools** and per-school damage-taken multipliers | `engine/combat/DamageSchool.ts` |
| **Cast times**, and haste shortening them | `engine/abilities/casting.ts` |
| **A cast interrupting the swing**, and `swingTimer: 'hold'` to stop it | `Ability.swingTimer` |
| **Periodic auras** — DoTs and HoTs, ticking, refresh behaviour, crit on ticks | `engine/effects/Aura.ts` |
| **Healing**, with its own multipliers and overhealing | `engine/combat/healing.ts` |
| **Reactions** — procs on damage dealt or taken, per character | `engine/combat/reactions.ts` |
| **Extra attacks** and the weapon-use rule | [extra-attacks.md](extra-attacks.md) |
| **Multi-target** via `Ability.targets.maxTargets` | `engine/combat/targeting.ts` |
| **Druid forms**, as combat styles: `caster`, `moonkin`, `tree`, `bear`, `cat`, each with its own primary resource | `game/character/combatStyles.ts`, `definitions.ts` |
| **Ranged auto-attack**, as the `ranged` style | same |
| **Pet and summon** as combatant kinds, counted as player-controlled | `engine/actors/Combatant.ts:24` |

### The finisher pattern already exists

Worth calling out, because it removes what looked like the biggest gap.

**Execute** takes a fixed 15 rage through `cost`, then drains everything left
in the pool inside its own `onCast` and scales its damage by what it drained.
A combo-point finisher is the same shape: fixed energy through `cost`, combo
points drained and read in `onCast`.

## The gaps, in order of how many profiles they block

### 1. Combo points — **not an engine change**

Needed by **Cat Druid, Venom Rogue, Combat Rogue, Rupture Rogue** — four
profiles, the largest single group.

The resource type exists, the UI knows its label, and the finisher pattern is
proven. What is missing is entirely in `game`:

- `comboPoints: 5` in `FIXED_RESOURCE_MAXIMUMS` — without it the pool has no
  maximum
- `comboPoints` added to the Rogue's and the Druid's resource lists
- builders granting a point, finishers draining and scaling

**Do this first.** It is the cheapest thing on the list and unblocks the most.

### 2. Channelled casts — **engine**

Needed by **Shadow Priest**, and wanted by Warlock and Arcane Mage.

`Ability` has `castTimeMs` but nothing channels: no ticking while casting, no
early break, no partial cast. Mind Flay is not optional for a Shadow Priest —
that profile is genuinely blocked, not merely understated.

Warlock's drains and the Mage's Arcane Missiles and Evocation want the same
mechanism.

### 3. Pets — **engine, partly**

Needed by **BM Hunter** above all, and by **SM/DS Warlock**; the two Lone Wolf
Hunter builds are named for not having one, but a Hunter with no pet at all is
still not a Hunter.

**A permanent pet is closer than it looks.** `createCombatants` returns an
array, `CombatantKind` already has `pet`, `isPlayerControlled` already counts
it, and a `Combatant` can carry its own rotation. What is missing:

- pet stats scaling from the owner's
- an owner link, so a talent like Bestial Wrath can reach the pet
- **summoning mid-fight** — `Simulation` exposes `combatants` as read-only with
  no way to add one, so a Warlock Infernal or a Mage's elemental cannot exist

The first two are content-shaped. The third is a real engine change and is only
needed for *temporary* summons.

### 4. Spell resistance — **engine, and it currently flatters casters**

`resistancesFromItems` exists in `game/items/equipment.ts` and **nothing reads
it**. The damage pipeline applies armor to physical damage and nothing at all
to magic, so every spell lands for full.

Not a blocker — every caster profile runs without it — but every caster figure
will be too high until it is done, and that is worth knowing before any of them
are quoted.

### 5. Intellect to mana — **content**

`game/character/resources.ts` says so itself: base mana is real per-race,
per-class data, and *"what is still missing is the intellect-to-mana
contribution on top of the base, so a geared caster's pool is understated."*

Affects all eight caster profiles. Understating a pool is the safe direction,
and it is still wrong.

### 6. Threat — **out of scope, as it already is**

**Prot Pally** wants it, exactly as Prot Warr does: Defiance already carries
`unmodelled: 'Threat, which the engine does not track.'` No change in position.

## What this means for sequencing

**Fourteen profiles need no engine work.** Taking them by shared mechanism
rather than by class:

| Wave | Profiles | Needs |
| --- | --- | --- |
| **1** | Bear Druid, Moonkin Druid, Ele Shaman, Enhance Shaman, Frostfire / Arcane / Fire Mage, Shockadin, Seal Twist Ret, Prot Pally | content only |
| **1b** | Cat Druid, Venom / Combat / Rupture Rogue | combo points, which is content |
| **2** | Shadow Priest | channelled casts |
| **3** | BM Hunter, LW Ranged, LW Melee, SM/DS Warlock, Firelock | pets |

**Ordering by class would have built Druid's forms before Rogue's combo
points**, even though forms already exist and combo points are what both Cat
and all three Rogues are waiting on.

The two accuracy gaps — resistance and intellect-to-mana — are worth doing
before any caster number is quoted, and block nothing.
