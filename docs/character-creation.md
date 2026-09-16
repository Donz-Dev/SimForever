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

Race and class are currently **recorded but not simulated** — they do not change
any combat numbers. The next steps, each of which is additive:

- **Primary resource per class** (Warrior rage, Mage mana, Rogue energy), so
  `createPlayer` stops hard-coding rage.
- **Base stats per race and class**, and per level.
- **Racial traits**, as auras applied at combat start.
- **Class ability lists and rotations**, replacing the example content.

## Adding a race or class

1. Add the id to `RACE_IDS` or `CLASS_IDS` in `ids.ts`. TypeScript will now flag
   every place that needs updating.
2. Add the definition to `RACES` or `CLASSES` in `definitions.ts`.
3. Update the `EXPECTED` table in `tests/game/character.test.ts`.
4. Run `npm test`. The structural invariants — every race has a class, every
   class is playable, no duplicates, ids used exactly once — are already
   enforced, so a mistake fails there.
