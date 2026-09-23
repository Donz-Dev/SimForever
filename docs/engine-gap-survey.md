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

### 1. Combo points — **DONE 2026-09-23, and it was not an engine change**

Needed by **Cat Druid, Venom Rogue, Combat Rogue, Rupture Rogue** — four
profiles, the largest single group.

`game/combat/comboPoints.ts` holds the mechanism: a maximum of five, the pool
on the Rogue and the Druid, and `awardComboPoint` / `spendComboPoints` /
`hasComboPoints`. No engine file changed.

**The maximum was the part that would have failed quietly.** A resource with no
entry in `FIXED_RESOURCE_MAXIMUMS` is built with `maximum: 0`, so every point
awarded overflows the instant it is granted — no error, just a finisher that
never has anything to spend.

The four profiles still need their own builders and finishers; what they no
longer need is a decision about how combo points work.

The resource type exists, the UI knows its label, and the finisher pattern is
proven. What is missing is entirely in `game`:

- `comboPoints: 5` in `FIXED_RESOURCE_MAXIMUMS` — without it the pool has no
  maximum
- `comboPoints` added to the Rogue's and the Druid's resource lists
- builders granting a point, finishers draining and scaling

**Do this first.** It is the cheapest thing on the list and unblocks the most.

### 1b. What the Rogue turned up — **an on-cast hook**, since done

Three profiles shipped on 2026-09-23 and the class exposed one gap the survey
did not predict, wanted by **four talents at once**:

| | |
| --- | --- |
| Relentless Strikes | returns energy **when a finisher is cast**, per point spent |
| Ruthlessness | returns a combo point on the same event |
| Improved Expose Armor | refunds combo points when cast at five |
| Seal Fate | adds a point when an ability **that awards one** crits |

A `reaction` fires on damage dealt or taken. None of these is a damage event:
three key off a CAST and the fourth needs the ability to declare that it
builds combo points.

**DONE 2026-09-23.** `castReaction` is the effect kind; the engine snapshots
every resource pool around a cast and reports the difference, so "per combo
point spent" is answerable without any ability declaring anything. Seal Fate
needed no new hook, only a new fact — `Ability.comboPointsAwarded`.

**It was not cosmetic.** Without it the Rogue could not afford its own
finisher: Eviscerate fired zero times at every threshold. Fixing it — together
with a second bug found on the way, the Rogue missing from `talentValues.ts`
and therefore having its whole tree inert — moved the three profiles by **21,
55 and 88 DPS**.

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

### 4. ~~Spell resistance~~ — **ruled out by the ruleset owner**

> Assume resistances on enemy targets have no impact on damage for now.

So magic landing for full is CORRECT, and `resistancesFromItems` going unread
is the right behaviour rather than a gap. This survey had it the other way and
was wrong to.

### 5. ~~Intellect to mana~~ — **it was already done**

This survey recorded it as missing on the strength of a comment in
`game/character/resources.ts` that said so. **The comment was stale.**
`conversions.ts` has `manaPerIntellect: 15` — the ruleset owner's own figure —
and `createPlayer` adds `derived.mana` to the base before building the pool.
The first caster built found the code already doing it.

Recorded rather than quietly removed, because reading a comment instead of the
code is how it got here.

### 5b. What the Moonkin actually found — **two gaps, neither inventable**

| | |
| --- | --- |
| **No spell power coefficients** | Every Druid spell states flat damage — "350 to 412 Arcane damage" — and no coefficient. None is invented, so **gear does not scale a caster's damage at all**. |
| **No caster gear** | The item data is nineteen Classic stand-ins curated for a Warrior. A Moonkin's `spellPower` reads **0**. |

Together those make the Moonkin's DPS a floor rather than an estimate: it is
mana-limited, casting flat-damage spells, in plate. The figure is honest and
not yet useful, which is the right failure mode — but do not quote it.

**Resistance is NOT among these.** The ruleset owner ruled that resistances on
enemy targets have no impact on damage for now, so `resistancesFromItems`
staying unread is correct rather than a gap.

### 6. Threat — **out of scope, as it already is**

**Prot Pally** wants it, exactly as Prot Warr does: Defiance already carries
`unmodelled: 'Threat, which the engine does not track.'` No change in position.

## What this means for sequencing

**Fourteen profiles need no engine work.** Taking them by shared mechanism
rather than by class:

| Wave | Profiles | Needs |
| --- | --- | --- |
| ~~**1**~~ | ~~Bear + Moonkin Druid~~, ~~Ele + Enhance Shaman~~ **done**; ~~Frostfire / Arcane / Fire Mage~~ **done**, ~~Shockadin, Seal Twist Ret, Prot Pally~~ **done** | content only |
| ~~**1b**~~ | ~~Venom / Combat / Rupture Rogue~~, ~~Cat Druid~~ **all done** | ~~combo points~~ **done** |
| ~~**2**~~ | Shadow Priest | ~~channelled casts~~ **done** |
| ~~**3**~~ | ~~BM Hunter, LW Ranged, LW Melee~~ **done**; ~~SM/DS Warlock, Firelock~~ **done** | ~~pets~~ **done** |

**ALL TWENTY PROFILES ARE DONE, across eight of nine classes.**

The one engine feature never built is **adding a combatant mid-fight**, and
nothing in the owner's twenty needs it: a Hunter's hawk is modelled as a
periodic effect on its owner, on the owner's own call. The Warlock's Infernal
and the Mage's elemental would want it.

The Priest is the only class with no content, and its Shadow profile is not in
the owner's twenty. Channelled casts, which it would need, already exist. The Shaman needed no engine change — the fourth
class in a row where the survey was right about that. **The Mage is the first
that does**, and it needed two:

**Per-school modifiers.** `SchoolModifiers`, the missing middle between one
ability and the whole character. Six Mage talents want it — Fire Power,
Piercing Ice, Critical Mass, Arcane Impact, and the two +100% crit-damage ones
— and it retroactively fixed three talents on shipped classes.

**Channelled casts.** `Ability.channelTicks`. Arcane Missiles is the Arcane
mage's core spender, and this was the last Wave 2 feature, so **Shadow Priest
is unblocked too**.

### Two gaps the survey did not have, both found by building

**~~A one-shot, per-ability cast-time modifier.~~ Done.** `CastModifier` on
`AuraDefinition`, with `resolveCast` pure so `checkCast` stays side-effect
free. **Eclipse** and **Maelstrom Weapon** are live against it and were both
inert before. Still waiting on their classes: Presence of Mind, Hot Streak and
Arcane Concentration (Mage), Inner Focus (Priest).

**Nature's Swiftness is NOT among them**, and selecting by SCHOOL is what it
needs — "your next Nature spell". That means a `school` on every `Ability`, a
field that is silent when forgotten, so it is worth adding when a whole class
can be filled in at once rather than one talent at a time.

**Two claims in this survey were wrong, both mine.** Nature's Grace does not
want this rule at all: Forever's wording is "increasing your spellcasting
speed and reducing your global cooldown by 10% for 3 sec", which is a haste
window off a spell crit — a reaction and an aura the engine has had all along.
And Eclipse, now that it works, is worth **zero DPS** to the Moonkin, because
that profile is mana-bound rather than time-bound.

**Totems as damage.** A Shaman's Searing and Magma Totems attack on their own,
which is the pet gap in Wave 3 wearing different clothes — and it lands on a
Wave 1 profile. Elemental's measured figure is short by whatever they are
worth. Searing Totem does not state an attack interval at all; Magma Totem
does (73 every 2 seconds for 20) but is an area effect on a single-target
fight, and Fire Nova needs an active fire totem to go off at all.

**Ordering by class would have built Druid's forms before Rogue's combo
points**, even though forms already exist and combo points are what both Cat
and all three Rogues are waiting on.

The two accuracy gaps — resistance and intellect-to-mana — are worth doing
before any caster number is quoted, and block nothing.
