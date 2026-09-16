# Game data

Static, data-driven content. The engine provides the rules; this directory
provides the content those rules operate on.

```
data/
├── profiles/     Sample character profiles (JSON)
├── items/        (not yet) gear
├── spells/       (not yet) spell data
├── classes/      (not yet) class and spec definitions
├── races/        (not yet) racial traits
├── talents/      (not yet) talent trees
└── encounters/   (not yet) boss definitions
```

## Why JSON rather than TypeScript

Data that will eventually be imported from an external source — a game data
export, an armory API, a community spreadsheet — should be in a format that a
script can write without generating code. `resolveJsonModule` is enabled, so
these files import with full type inference.

Content that carries *behaviour* (an ability's `onCast`, an aura's `onTick`)
cannot be JSON and lives in `src/game` as TypeScript instead. The split is:
**JSON for values, TypeScript for behaviour.**

## Profiles

`profiles/example-warrior.json` is a realistic profile for a geared character
running a 5-minute, 1000-iteration simulation. Paste it into the Profile panel
in the UI to load it.

Anything read from this directory still goes through `parseProfile`, which
validates and migrates it — a file on disk is no more trusted than a paste box.
See [docs/profiles.md](../../docs/profiles.md).
