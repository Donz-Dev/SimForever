# Profiles

A profile is everything needed to reproduce a simulation, as plain JSON-safe
data. It can be saved to a file, pasted into a text box, committed to a
repository, or sent to a server.

## Format

```json
{
  "version": 1,
  "character": {
    "name": "Example",
    "race": "Human",
    "characterClass": "Warrior",
    "level": 80
  },
  "stats": {
    "strength": 100,
    "attackPower": 100,
    "critRating": 0,
    "hasteRating": 0
  },
  "simulation": {
    "durationSeconds": 100,
    "durationVariance": 0,
    "iterations": 1,
    "seed": 12345
  },
  "encounter": {
    "targetName": "Training Dummy",
    "targetHealth": 100000,
    "targetArmor": 0
  }
}
```

Gear, talents, consumables, professions and rotation settings become further
sections as those systems are built.

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
simulation.durationVariance: Must be between 0 and 1.
encounter.targetArmor: Must be zero or greater.
```

Validation rebuilds the profile field by field rather than casting, so unknown
extra keys are dropped instead of riding along into the rest of the app.

## Versioning and migration

Every profile carries a `version`. `CURRENT_PROFILE_VERSION` is 1.

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

Migrations run in sequence, so a version-1 file loaded by a build at version 4
passes through 1→2, 2→3 and 3→4.

A profile from a *newer* format is refused with a clear message rather than
silently mangled.

`migrations` is empty today because version 1 is the first version. The
machinery is in place anyway: adding it now costs a few lines, and adding it
after people have saved profiles is a support problem.

## Using a profile

```typescript
import { runProfile, runProfileBatch } from './simulator';

const result = runProfile(profile);                 // one fight
const batch = runProfileBatch(profile, onProgress); // profile.simulation.iterations
```

`runProfile` takes an optional seed override, so a single iteration of a batch
can be re-run in isolation for debugging.
