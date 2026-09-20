# Profiles

A profile is everything needed to reproduce a simulation, as plain JSON-safe
data. It can be saved to a file, pasted into a text box, committed to a
repository, or sent to a server.

## Format

```json
{
  "version": 8,
  "character": {
    "name": "Example",
    "race": "human",
    "characterClass": "warrior",
    "level": 60,
    "combatStyle": "dual_wield"
  },
  "stats": {
    "attackPower": 0,
    "critRating": 0,
    "hasteRating": 0
  },
  "equipment": {
    "mainHand": { "itemId": 17075, "enchantId": 20034 },
    "trinket1": { "itemId": 11815 }
  },
  "talents": {
    "improved_heroic_strike": 3,
    "deep_wounds": 3
  },
  "simulation": {
    "durationSeconds": 60,
    "iterations": 3000,
    "seed": 12345
  },
  "encounter": {
    "targetName": "Training Dummy",
    "targetHealth": 100000,
    "targetArmor": 3731,
    "targetLevel": 63
  }
}
```

Races and classes are stored as **ids** (`human`, not `Human`), so display names
can be reworded without invalidating saved files. Faction is deliberately absent:
it follows from the race, so storing it would let a profile claim an Alliance
Orc.

Consumables, professions and rotation settings become further sections as those
systems are built.

### `equipment` holds ids, not copies

An item's numbers belong to the item data. A profile carrying its own copy would
drift the moment that data was corrected.

### `talents` decides which abilities exist

Points spent per talent id. This is not decoration: talent-granted abilities are
only in a character's book when the talent has a point in it, so an empty
allocation means a warrior knows no Mortal Strike, no Bloodthirst and no Shield
Slam. All three are 31-point capstones in three different trees, and 51 points
reaches exactly one.

**Talent ids are unique within a class, not across classes** — `deflection`
belongs to four of them — so an allocation only means anything alongside
`character.characterClass`. Validation checks the ids against that class's trees
and rejects an unknown one rather than dropping it, and it rejects an allocation
no character could actually reach: over budget, a tier requirement unmet, or a
prerequisite missing.

### Seconds, not milliseconds

Profiles are written and read by people, so `durationSeconds` is in seconds. The
engine works exclusively in milliseconds. `trainingDummyEncounter` is the single
place that converts, which is how the two conventions never get mixed up.

### `characterClass`, not `class`

`class` is a reserved word in JavaScript. Using it as a property name works but
reads badly everywhere it is destructured.

## API

```typescript
import {
  createDefaultProfile,
  serializeProfile,
  parseProfile,
  loadProfile,
  validateProfile,
  cloneProfile,
} from './profiles';

const profile = createDefaultProfile();
const json = serializeProfile(profile);      // indented, diffable

const result = parseProfile(json);           // parse -> migrate -> validate
if (result.ok) {
  console.log(result.profile, result.migrated);
} else {
  for (const issue of result.issues) {
    console.log(`${issue.path}: ${issue.message}`);
  }
}
```

`loadProfile(value)` is the same thing for an already-parsed object, e.g. one
from `localStorage`.

## Validation

Anything arriving from a file, a paste box or storage is untrusted, and
TypeScript's types are long gone by the time it does. `validateProfile` is the
boundary where an `unknown` becomes a `CharacterProfile`, and every path into
the app goes through it.

It collects **every** problem rather than stopping at the first, so someone
fixing a hand-edited file sees the whole list at once:

```
stats.spirit: Unknown stat "spirit".
encounter.targetArmor: Must be zero or greater.
```

Validation rebuilds the profile field by field rather than casting, so unknown
extra keys are dropped instead of riding along into the rest of the app.

## Versioning and migration

Every profile carries a `version`. `CURRENT_PROFILE_VERSION` is 8.

The order is always **parse → migrate → validate**. An old file is valid for its
own version, not the current one, so validating first would reject files that
are perfectly loadable.

To change the format:

1. Bump `CURRENT_PROFILE_VERSION` in `CharacterProfile.ts`.
2. Add a migration keyed by the version it upgrades *from*:

```typescript
const migrations: Record<number, Migration> = {
  1: (profile) => ({
    ...profile,
    gear: [],                 // new section, sensible default
  }),
};
```

Migrations run in sequence, so a version-1 file loaded by a build at version 8
passes through 1→2, 2→3 and so on up to 7→8.

A profile from a *newer* format is refused with a clear message rather than
silently mangled.

**A migration says what it does to the numbers, not just to the shape.** Four
of them change results, and each says so in its own comment: version 5 made an
empty talent allocation mean a Warrior knows no capstone ability, version 7 let
a dual-wielder open in Berserker Stance instead of Battle, and version 8
dropped `durationVariance` so every fight now varies in length. A migration
that quietly moves a saved character's recorded numbers is the one that costs
someone a day.

## Using a profile

```typescript
import { runProfile, runProfileBatch } from './simulator';

const result = runProfile(profile);                 // one fight
const batch = runProfileBatch(profile, onProgress); // profile.simulation.iterations
```

`runProfile` takes an optional seed override, so a single iteration of a batch
can be re-run in isolation for debugging.
