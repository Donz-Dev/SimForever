# SimForever

[![CI](https://github.com/Donz-Dev/SimForever/actions/workflows/ci.yml/badge.svg)](https://github.com/Donz-Dev/SimForever/actions/workflows/ci.yml)
[![Deploy](https://github.com/Donz-Dev/SimForever/actions/workflows/deploy.yml/badge.svg)](https://github.com/Donz-Dev/SimForever/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An event-driven World of Warcraft combat simulator that runs in the browser.

**Try it: [donz-dev.github.io/SimForever](https://donz-dev.github.io/SimForever/)** —
every push to `main` that passes the tests deploys there.

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

## Deployment

The app is entirely client-side — no server, no database, no API keys. A build
is a folder of static files, and `.github/workflows/deploy.yml` publishes it to
[GitHub Pages](https://donz-dev.github.io/SimForever/) on every push to `main`
that type checks, passes the tests and builds. Nothing is published from a
laptop; the live site is always a commit on `main`.

Two things about it are worth knowing before changing anything:

- **Pages must be switched on once, by hand**, under
  Settings → Pages → Build and deployment → Source → **GitHub Actions**. Until
  that is done the deploy job fails and CI carries on unaffected.
- **A project site is served from a subdirectory**, so a production build sets
  `base: '/SimForever/'` in [vite.config.ts](vite.config.ts) and every asset URL
  carries that prefix. The dev server is unaffected and stays at `/`. Run
  `npm run preview` to see exactly what Pages will serve, prefix included; it is
  the only local command that reproduces the deployed paths.

Moving to a custom domain, or to a `donz-dev.github.io` user site, means setting
that `base` back to `'/'`.

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

| **Attacks resolve on integer dice** | Combat rolls 1-10000 and truncates every percentage into that space, so an outcome is exactly reproducible rather than depending on floating-point accumulation order. |

Longer explanations live in [`docs/`](docs/).

Two files sit at the root for anyone (or any AI assistant) picking the project up:

- **[CLAUDE.md](CLAUDE.md)** — durable architectural constraints and working
  conventions. Claude Code loads it automatically each session.
- **[HANDOVER.md](HANDOVER.md)** — current status: what works, what is still
  placeholder, open interpretations, and the next task.

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
- Ten races and nine classes with the Forever combination rules, and per-class
  resources (including the Druid's form-dependent mana/rage/energy)
- Base stats at level 60 for all 65 race/class/form combinations, generated from
  the source spreadsheet rather than transcribed
- Combat styles per class (two-hander, dual-wield, sword and board, ranged,
  caster, and the Druid forms), driving auto-attack behaviour and rotation
- Per-class stat conversions (strength to attack power, agility to crit and
  armor, stamina to health, intellect to mana and spell crit, spirit to MP5),
  re-derived whenever a buff changes a primary stat
- Combatants with stats, resources, auras and abilities
- Stat modifier system with flat, additive-percent and multiplicative-percent buckets
- Auras: durations, stacks, periodic ticks, stat modifiers, refresh behaviour
- Abilities: cast time, cooldowns, charges, global cooldown, resource costs, haste
- Auto attacks on an independent, hasted swing timer
- Resource generation: rage proportional to damage dealt and taken, energy in
  fixed batches, mana on a five-second rule with a casting-bypass stat
- Six combat tables (melee/ranged auto, melee/ranged special, spell, and
  attacks received) resolving on an integer 1-10000 die, with single-roll and
  two-roll semantics
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
