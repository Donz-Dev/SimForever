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

### Crit chance is stored but not used

The crit columns are class constants that other contributions add to, and some
are negative — a Hunter's base is `-1.53`. They are therefore not a character's
actual crit chance, and `baseStatsToEngineStats` deliberately leaves them out.

Wiring them up needs the **agility-to-crit** and **intellect-to-spell-crit**
conversions, which do not exist yet.

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
