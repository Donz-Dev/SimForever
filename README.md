# SimForever

[![CI](https://github.com/Donz-Dev/SimForever/actions/workflows/ci.yml/badge.svg)](https://github.com/Donz-Dev/SimForever/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An event-driven World of Warcraft combat simulator that runs in the browser.

The project is at its first milestone: a complete, tested simulation engine with a
small amount of example content — one player, one training dummy, an auto-attack,
two abilities, a buff and a stacking bleed — driven from a React UI.

The example content is deliberately generic. The point of this milestone is the
**engine architecture**, not WoW's ruleset; classes, specs, gear and talents are
built on top of the abstractions described below without changing them.

## Quick start

Requires [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open the URL it prints (usually http://localhost:5173), click **Run Simulation**,
and a real fight executes in the browser.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type check, then produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Re-run tests as files change |
| `npm run typecheck` | Type check without building |

## Architecture

The single most important rule in this codebase:

> **The simulation engine knows nothing about the UI.**

`src/engine` is plain TypeScript. It imports no React, touches no DOM, and holds
no module-level state. Anything that can run TypeScript can run it — the web UI,
the tests, a future CLI, a Web Worker, or a server.

```
       ┌──────────────┐
       │   React UI   │   src/ui
       └──────┬───────┘
              │ runProfileBatch(profile)
       ┌──────▼───────┐
       │  Simulator   │   src/simulator   (the public API / facade)
       └──┬────────┬──┘
          │        │
   ┌──────▼──┐  ┌──▼────────┐
   │ Engine  │─▶│ Analysis  │   telemetry events in, statistics out
   └────┬────┘  └───────────┘
        │ uses
   ┌────▼────┐
   │  Game   │   src/game   (content: races, classes, abilities, auras, actors)
   └─────────┘
```

Dependencies point one way only:

- `engine` depends on nothing in the project.
- `game` depends on `engine` only.
- `profiles` depends on `engine` and `game/character` (for race and class ids).
- `analysis` depends on `engine` types only.
- `simulator` wires engine + analysis + game + profiles together, and owns the
  profile-to-config translation.
- `ui` depends on `simulator` and `profiles`. Never on `engine` internals.

The engine does **not** depend on `analysis`. It produces a stream of telemetry
events and stops there; every derived number (DPS, breakdowns, uptimes) is
computed by an analyzer reading that stream. This is why the combat log and the
damage totals can never disagree — they are two views of the same events.

### The core loop

Combat is event-driven, not tick-based. WoW needs sub-second timing, and a
tick loop either misses events or wastes enormous effort on empty milliseconds.

```typescript
while (!hasEnded) {
  const event = queue.pop();
  clock.advanceTo(event.timestamp);
  event.execute(context);
}
```

Everything else in the simulation is an event that schedules further events.

### Key decisions

| Decision | Why |
| --- | --- |
| **All time is integer milliseconds** | One convention everywhere below the UI. Seconds appear only when formatting for a human, or in profiles. Mixing the two is a whole category of bug that simply cannot occur. |
| **Deterministic event ordering** | Events sort by `(timestamp, priority, insertion order)`. The third key always breaks a tie and comes from a counter, so the same run always produces the same output. |
| **Seeded RNG, never `Math.random()`** | The same config and seed reproduce a fight exactly, which is the only practical way to debug one. |
| **Stats are base + modifiers** | A buff adds modifiers and removes them on expiry. Base stats are never mutated, so buffs cannot corrupt character data. |
| **Telemetry is the single source of truth** | The engine keeps no running totals. Adding a statistic means adding an analyzer, never touching combat code. |
| **One `Combatant` class, not a hierarchy** | Every difference between a player, a boss and a pet turned out to be data. A flat collection of combatants is what lets the same engine run 1v1 and a 20-player raid. |

Longer explanations live in [`docs/`](docs/).

## Directory structure

```
src/
├── engine/              The simulation engine. No React, no DOM, no globals.
│   ├── simulation/      Simulation, clock, context, config
│   ├── events/          CombatEvent, EventQueue, EventPriority
│   ├── actors/          Combatant
│   ├── stats/           Stats, StatModifier, StatBlock
│   ├── resources/       Resource, ResourceCollection
│   ├── effects/         Aura, AuraCollection
│   ├── abilities/       Ability, AbilityBook, casting rules
│   ├── combat/          Damage, healing, auto attacks, rating conversion
│   ├── rotation/        Rotation, PriorityRotation (action priority lists)
│   ├── rng/             Seeded RNG
│   └── logging/         Telemetry events, sinks, combat log formatting
│
├── game/                Game CONTENT. Data, not rules.
│   ├── character/       Factions, races, classes and their combinations
│   ├── abilities/       Example abilities
│   ├── auras/           Example buffs and debuffs
│   ├── actors/          Player and training dummy factories
│   └── rotations/       Example priority list
│
├── profiles/            Versioned, JSON-safe character profiles
├── analysis/            Analyzers: damage, healing, statistics
├── simulator/           Public API: runSimulation, runBatch
├── data/                Static JSON game data and sample profiles
└── ui/                  React. Panels, components, hooks. No combat logic.

tests/                   Vitest suites mirroring the src layout
docs/                    Architecture documentation
```

## Current capabilities

- Event-driven simulation with arbitrary sub-second timing
- Deterministic, seeded runs
- Combatants with stats, resources, auras and abilities
- Stat modifier system with flat, additive-percent and multiplicative-percent buckets
- Auras: durations, stacks, periodic ticks, stat modifiers, refresh behaviour
- Abilities: cast time, cooldowns, charges, global cooldown, resource costs, haste
- Auto attacks on an independent, hasted swing timer
- Damage pipeline: power scaling, crit, attacker/target modifiers, armor, overkill
- Healing pipeline with overhealing (foundation; no content uses it yet)
- Action-priority-list rotations
- Telemetry stream, human-readable combat log, damage and healing analyzers
- Monte Carlo batches with mean, median, min, max, standard deviation and percentiles
- Versioned profiles with validation, migration, import and export
- React UI that drives the real engine — no faked results

## Not yet implemented

Real class, spec, gear and talent content. Multiple players and raid simulation.
Pets and summons. Enemy AI and boss mechanics. Multi-target and target switching.
Threat, movement, range and line of sight. Procs and internal cooldowns. Absorb
shields. Resource regeneration. Web Workers for parallel iterations.

The architecture is built to accept all of these without a rewrite; see
[`docs/architecture.md`](docs/architecture.md) for how each one slots in.

## Contributing

- Keep the engine free of UI and framework imports.
- Put rules in `engine`, content in `game`.
- Emit telemetry for anything worth measuring; never add a private running total.
- Add a test with the behaviour, not after it.

Run `npm test` and `npm run typecheck` before opening a pull request.

## License

[MIT](LICENSE).

## Disclaimer

SimForever is an unofficial fan project and is not affiliated with, endorsed by,
or sponsored by Blizzard Entertainment. World of Warcraft and Warcraft are
trademarks of Blizzard Entertainment, Inc. All game data referenced by this
project remains the property of its respective owners.
