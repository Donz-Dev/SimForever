# Character creation

The first decision a player makes, in the game and in SimForever: **faction,
then race, then class.**

Lives in `src/game/character/`. It is content, not engine — the simulation
engine has no idea what a Tauren is.

## The ruleset

This is **World of Warcraft: Forever**, which is heavily based on Classic but is
its own ruleset. Several combinations deliberately differ from real Classic and
must not be "corrected" toward it:

- **Paladin is not Alliance-locked, Shaman is not Horde-locked.** Dwarf Shaman
  and Undead Paladin are intentional. The result is that both factions can field
  all nine classes, which real Classic could not.
- **Human Hunter, Gnome Priest, Orc Mage and Troll Warlock** exist here. None of
  them did in Classic.
- **High Order Skyborne** (Alliance) and **Windshaper Skyborne** (Horde) are
  Forever-only races.
- There is no Death Knight. The class list is Classic's nine.

The combination table is duplicated by hand in `tests/game/character.test.ts`.
That duplication is deliberate: a test that derived its expectations from the
source data would pass no matter what the source data said.

## The data

| | |
| --- | --- |
| Factions | Alliance, Horde |
| Races | 5 per faction, 10 total |
| Classes | 9 |
| Level cap | 60, as in Classic |

`MAX_CHARACTER_LEVEL` lives in `game/character/definitions.ts` because the cap
is a ruleset decision, not a simulation rule — raising it in a future patch is a
content change. Anything that scales with level (base stats, rating conversions,
ability coefficients) should read it rather than hard-coding 60.

```typescript
{
  id: 'night_elf',
  name: 'Night Elf',
  faction: 'alliance',
  classes: ['druid', 'hunter', 'priest', 'rogue', 'warrior'],
}
```

### Why TypeScript and not JSON

`RaceId` and `ClassId` are union types derived from `as const` arrays, so
`'nightelf'` is a compile error rather than a simulation that silently produces
plausible but wrong numbers. A JSON import widens every string to `string` and
throws that guarantee away.

Bulk content that will be imported from an external export — items, spells —
still belongs in `src/data` as JSON. See [`src/data/README.md`](../src/data/README.md).

## Resources

Every class has **Health**. It lives on `Combatant`, not on the class
definitions, so there is one source of truth rather than nine copies.

Beyond that, one resource drives how each class plays:

| Class | Resource |
| --- | --- |
| Warrior | Rage |
| Rogue | Energy |
| Mage, Warlock, Shaman, Paladin, Priest, Hunter | Mana |
| Druid | depends on form |

### The Druid

The Druid is why `ClassDefinition.resources` is a list rather than a single
value:

| Form | Resource |
| --- | --- |
| Caster Form | Mana |
| Moonkin Form | Mana |
| Bear Form | Rage |
| Cat Form | Energy |

A Druid combatant is built with **all three pools at once**, even in caster
form. A bear still has a mana pool it is not currently using, and creating the
rage pool only on shapeshift would mean conjuring state mid-fight. The form
decides which pool *matters*, not which pools exist.

`activeResourceFor(classId, formId?)` answers "what drives play right now". For
the eight classes with no forms it always returns the primary resource, so
callers never need to special-case the Druid.

### Maximums

Rage and energy are fixed at **100** for everyone, at every level — they are
ruleset constants, in `FIXED_RESOURCE_MAXIMUMS`.

**Base mana is real data**, per race and class, from the base stats table. What
is still missing is the intellect contribution on top of it, so a geared
caster's pool is understated rather than invented.

### Starting values

Rage starts at **0**; mana and energy start **full**. This is what makes the
opening seconds of a rage rotation different from everyone else's — a warrior
walks in with nothing and builds it by swinging.

## Base stats

`src/game/character/baseStats.ts` holds what a level 60 character of each race,
class and form starts with, before any gear, buffs or talents.

**It is a generated file.** `tools/import_base_stats.py` produces it from
`WoWForeverBaseStats.xlsx`:

```bash
pip install openpyxl
python tools/import_base_stats.py path/to/WoWForeverBaseStats.xlsx
```

Transcribing 65 rows of eleven numbers by hand would introduce errors that look
exactly like real data. Never edit the generated file — re-run the generator.

`tests/game/baseStats.test.ts` checks it against values read off the spreadsheet
**by hand**, independently. A test that read the generated file to build its
expectations would prove nothing.

### What the table holds

Hit Points, Mana, Strength, Agility, Stamina, Intellect, Spirit, Attack Power,
Ranged Attack Power, Crit Chance, Spell Crit Chance.

These are **constants**, not calculated results — the floor everything else is
added to. A profile's `stats` section is gear and other bonuses, **added on
top**, not the character's stats from scratch.

### Crit chance

The crit columns are **base constants**, and some are negative — a Hunter's is
`-1.53`. The class conversion table adds the contribution from agility (and from
intellect, for spell crit) on top, which is what brings them positive.

An Orc Hunter: `-1.53 + 122 agility / 53 = 0.77%`.

### Two interpretations, not data

Both are marked in the code and will change if the spreadsheet says otherwise:

1. **Moonkin Form has no row.** It is declared as a Druid form that uses mana,
   but the sheet has only Caster, Bear and Cat. Since forms differ only in hit
   points and attack power, Moonkin borrows Caster Form's numbers.
2. **Bear and Cat show `Mana: 0`.** Read as "mana is not this form's resource",
   not "the pool is destroyed" — a bear still has mana it simply is not
   spending. The pool is always sized from Caster Form, so shifting mid-fight
   does not silently discard it.

### Forms

Only hit points and attack power differ between Druid forms. Primary stats and
crit are identical across all of them.

| Form | Hit Points | Attack Power |
| --- | --- | --- |
| Caster | 1303 | -20 (Tauren -36) |
| Bear | 2543 | 160 |
| Cat | 1303 | 100 |

## Combat styles

The selector after class. It decides **which weapons auto-attack**, **which
action priority list runs**, and what the UI shows for equipment slots.

Combat style and Druid form are **one concept, not two**. A Druid's styles are
its forms, so they also drive its resource and stat conversions; every other
class has styles that describe a weapon configuration. Modelling them separately
would mean two selectors that always had to agree with each other.

| Class | Styles (first is the default) |
| --- | --- |
| Warrior | **Dual-Wield**, Two-Hander, 1H & Shield |
| Rogue | **Dual-Wield** |
| Shaman | **Caster**, Two-Hander |
| Paladin | **1H & Shield**, Two-Hander, Caster |
| Hunter | **Ranged**, Two-Hander, Dual-Wield |
| Mage / Warlock / Priest | **Caster** |
| Druid | **Cat**, Caster, Bear, Tree of Life, Moonkin |

### What each style does

| Style | Auto-attack | Main hand | Off hand | Ranged |
| --- | --- | --- | --- | --- |
| Two-Hander | main hand only | two-handed, swings | none | - |
| 1H & Shield | main hand only | one-handed, swings | shield | - |
| Dual-Wield | **both hands** | one-handed, swings | weapon, swings | - |
| Ranged | ranged only | stat stick | stat stick | required, swings |
| Caster / Tree / Moonkin | **none** | stat stick | stat stick | - |
| Bear / Cat | paws, not weapons | stat stick | stat stick | - |

A *stat stick* is an item that can be equipped and contributes its stats but
never swings.

### Independent swing timers

Dual-wield runs a **separate timer per hand**. The off-hand does not wait for
the main hand, so the two drift apart over a fight exactly as they do in game.
This is why `Combatant` holds weapons by slot and the auto-attack scheduler
takes a slot rather than assuming one weapon.

### Casters genuinely do nothing

A Mage currently deals **zero damage**: the Caster style never auto-attacks, and
no class abilities exist yet. That is correct rather than broken, and there is a
test asserting the fight still completes cleanly instead of stalling.

### Resolution

`resolveCombatStyle(class, requested)` always returns something the class can
use. A profile carrying a stale style — a character that was a bear Druid and is
now a Warrior — resolves to the class default rather than failing. A test applies
every (class x style) pair and asserts the result is always legal.

### Paw damage

Bear and Cat attack with their own damage rather than an equipped weapon:

| | |
| --- | --- |
| `BASE_BEAR_PAW_DAMAGE` | 100 |
| `BASE_CAT_PAW_DAMAGE` | 50 |

These are **assumed** values pending confirmation. Everything else about the
paws — swing speed, attack power scaling, damage variance — is still
placeholder, so a druid's auto-attack damage is directionally right rather than
accurate.

### Off-hand damage penalty

`OFF_HAND_DAMAGE_MULTIPLIER` is **0.5**: a dual-wield off-hand deals half
damage.

The multiplier scales the **whole swing**, attack power contribution included.
Halving only the weapon's own damage would let the off-hand grow stronger
relative to the main hand as a character geared up, which is not what a
percentage penalty means.

Talents are expected to change this, so it is not baked in:

```typescript
createPlayer({ race, characterClass, combatStyle: 'dual_wield',
               offHandDamageMultiplier: 0.75 });   // a talent improved it
```

The penalty lives on the off-hand `WeaponProfile` rather than on the weapon
itself, because it is a property of the hand: the same sword swings for full in
the main hand and half in the off-hand.

## Stat conversions

Base stats are the input. `src/game/character/conversions.ts` turns them into
everything else, and the numbers vary per class — and, for the Druid, per form.

```
Base stats (race + class + form)
        +  gear and other bonuses
        =  primary stats
                 |
                 v   class conversion table
        attack power, ranged attack power, armor,
        crit %, dodge %, spell crit %, MP5,
        hit points, mana
```

### The table

| Class | Str -> AP | Agi -> AP | Agi -> crit | Int -> mana | Int -> spell crit | Spirit -> MP5 |
| --- | --- | --- | --- | --- | --- | --- |
| Warrior | 2 | - | 20 = 1% | - | - | - |
| Rogue | 1 | 1 | 29 = 1% | - | - | - |
| Hunter | 1 | 1 (+2 ranged) | 53 = 1% | 15 | - | 2 = 1 |
| Shaman | 2 | - | 20 = 1% | 15 | 59.5 = 1% | 2 = 1 |
| Paladin | 2 | - | 20 = 1% | 15 | 54 = 1% | 2 = 1 |
| Mage | - | - | **none** | 15 | 59.5 = 1% | 8 = 5 |
| Priest | - | - | **none** | 15 | 59.5 = 1% | 8 = 5 |
| Warlock | - | - | **none** | 15 | 60.6 = 1% | 8 = 5 |
| Druid (Caster/Moonkin/Tree) | 2 | - | 20 = 1% | 15 | 61 = 1% | 2 = 1 |
| Druid (Bear) | 2 | - | 20 = 1% | 15 | - | 2 = 1 |
| Druid (Cat) | 2 | 1 | 20 = 1% | 15 | - | 2 = 1 |

Universal: **1 Agility = 2 Armor**, **1 Stamina = 10 Hit Points**, and every
class gets dodge from agility.

Note that Mage, Priest and Warlock get **no crit from agility at all** — which
is different from getting a very small amount, and is why the field is `null`
rather than a large number.

Ratios are stored as the source states them (`agilityPerCritPercent: 20`, not
`0.05` crit per agility) so the table can be checked against the source by eye.

### Conversions re-run when stats change

The derivation is a *function* on the stat block, not a value computed once at
character creation. It runs in two passes: resolve the primary stats from base
and modifiers, then feed those through the conversions and resolve again.

That is what makes a +10% strength blessing raise attack power. Computing attack
power once at creation would leave it stuck at the unbuffed value.

Derivation never produces a primary stat, so the two passes always agree on the
primaries and the process terminates.

### Worked examples

These come from the source and are pinned as tests in
`tests/game/conversions.test.ts`. If any of them breaks, the conversions are
wrong regardless of what the rest of the suite says.

| | |
| --- | --- |
| Troll Shaman hit points | `1100 + 96 x 10` = **2060** |
| Night Elf Druid (Bear) hit points | `2543 + 69 x 10` = **3233** |
| Tauren Druid (Caster) attack power | `-36 + 70 x 2` = **104** |
| Orc Hunter crit chance | `-1.53 + 122 / 53` = **0.77%** |

### What is not wired yet

- **MP5 is computed but nothing regenerates.** Mana regen needs a tick interval
  and the rule for whether it applies while casting, neither of which exists.
  The number is shown in the UI, labelled as not yet regenerating.
- **Dodge is computed but never rolled.** There is no avoidance step in the
  damage pipeline.
- **Hit points and mana are sized once at character creation.** A buff that
  changes stamina or intellect mid-fight will not resize the pools, because
  those are resource maximums rather than stats. Every other converted stat does
  update.

## Level

Level is **fixed at 60** and is not editable in the UI.

The field remains on the profile and validation still accepts 1–60, so
level-dependent formulas can be written per level rather than against a
hard-coded 60. `MAX_CHARACTER_LEVEL` is the constant to read; nothing should
write `60` inline.

## Querying

```typescript
racesForFaction('horde')            // Orc, Undead, Tauren, Troll, Windshaper Skyborne
classesForRace('tauren')            // Druid, Hunter, Shaman, Warrior
racesForClass('paladin')            // Human, Dwarf, Undead
racesForClass('paladin', 'horde')   // Undead
isValidCombination('tauren', 'mage')  // false
```

`racesForClass` is the reverse lookup, for the player who decides "I want to be
a Paladin" before deciding anything else.

## The selection cascade

`applySelection(change, current)` is the decision flow itself. It lives here
rather than in the React component so it can be tested without rendering
anything, and reused by a future CLI.

It always returns a legal selection, applying these rules in order:

1. Changing faction keeps the current race if it belongs to that faction,
   otherwise moves to the faction's first race.
2. **Changing race keeps the current class if the new race can play it.** An Orc
   Warrior switching to Tauren stays a Warrior.
3. A class the resulting race cannot play falls back to that race's first class.

Rule 2 is the one that matters for feel. Without it, browsing races silently
throws away the class the player actually chose.

A test exhaustively applies every (faction × race × class) combination and
asserts the result is always legal, so a gap in the cascade cannot slip through.

## Profiles

Profiles store **ids**, not display names:

```json
"character": { "name": "Thunderaxe", "race": "orc", "characterClass": "warrior", "level": 60 }
```

That way display names can be reworded without invalidating saved profiles.

**Faction is not stored.** It is determined by the race, so storing it would
allow a profile claiming an Alliance Orc. Derive it with
`getRace(profile.character.race).faction`. If Forever ever adds a race playable
by both factions, this becomes a real field.

`validateProfile` rejects unknown ids *and* illegal combinations, with a
readable message:

```
character.characterClass: Tauren cannot be a Mage in World of Warcraft: Forever.
```

## What this does not do yet

**Class now affects the simulation** — it determines the resource pools a
character gets. Race still does not.

Known gaps, each additive:

- **Mana pool sizes** are a placeholder. Needs base mana per class per level and
  the intellect-to-mana conversion.
- **Base health** is a flat 1000 for everyone. Needs base health per class per
  level and the stamina conversion.
- **Only the Warrior has abilities.** Every other class fights with auto attacks
  alone, which the UI says plainly rather than hiding.
- **Shapeshifting is not implemented.** The Druid owns all three pools and the
  form-to-resource mapping exists, but nothing switches forms yet, and forms
  also change armor, abilities and attack power in ways not modelled here.
- **Racial traits** do not exist. They slot in as auras applied at combat start,
  keyed off `profile.character.race`.
- **Base stats per race** do not exist.

## Adding a race or class

1. Add the id to `RACE_IDS` or `CLASS_IDS` in `ids.ts`. TypeScript will now flag
   every place that needs updating.
2. Add the definition to `RACES` or `CLASSES` in `definitions.ts`.
3. Update the `EXPECTED` table in `tests/game/character.test.ts`.
4. Run `npm test`. The structural invariants — every race has a class, every
   class is playable, no duplicates, ids used exactly once — are already
   enforced, so a mistake fails there.
