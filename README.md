# SimForever

[![CI](https://github.com/Donz-Dev/SimForever/actions/workflows/ci.yml/badge.svg)](https://github.com/Donz-Dev/SimForever/actions/workflows/ci.yml)
[![Deploy](https://github.com/Donz-Dev/SimForever/actions/workflows/deploy.yml/badge.svg)](https://github.com/Donz-Dev/SimForever/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A combat simulator for **World of Warcraft: Forever**, a custom ruleset built on
Classic. Build a character, gear it, and fight a target dummy as many times as
you like to find out what actually does more damage.

## ▶ [Run it in your browser](https://donz-dev.github.io/SimForever/)

Nothing to install, no account, no download. It runs entirely on your own
machine — no character you build is ever sent anywhere.

## What it does

- Build a character: faction, race, class and combat style, with only the
  combinations the ruleset allows
- Equip weapons, armour, trinkets and enchants, and watch the character sheet
  re-derive itself
- Fight a target dummy of any level and armour for as long as you like
- Read the result as a DPS figure, a per-ability breakdown with hit, crit,
  glance and avoidance rates, and a full combat log of the fight
- Run the same fight hundreds of times and see the spread rather than one lucky
  pull

Every number comes from a real simulated fight — a seeded, event-driven engine
resolving each swing on the ruleset's own combat table. Nothing is estimated
from a formula.

## What is finished, and what is not

The simulator is under active development and honest about its gaps:

- **The Warrior is complete** — all 26 abilities, real gear, working procs. The
  other eight classes can be built and will auto-attack, but have no abilities
  yet.
- **Talents are display only.** All 470 are there and spendable, but no talent
  changes a single number in the result yet.
- **The items are WoW Classic stand-ins**, not Forever items, so their values
  may differ from the ruleset's own.

Results are good for comparing one setup against another. Treat an absolute DPS
number as provisional.

## Running it locally

Requires [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload, at http://localhost:5173 |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Re-run tests as files change |
| `npm run typecheck` | Type check without building |
| `npm run build` | Type check, then build into `dist/` |
| `npm run preview` | Serve the production build exactly as the live site does |

Every push to `main` that passes the tests deploys automatically to
[the live site](https://donz-dev.github.io/SimForever/). See
[docs/deployment.md](docs/deployment.md).

## Documentation

The simulation engine is plain TypeScript that knows nothing about React, the
DOM, or WoW specifically — it is the rules, and the game content is data handed
to it. [`docs/architecture.md`](docs/architecture.md) explains why, and the rest
of [`docs/`](docs/) covers the engine, combat tables, character creation,
resources, telemetry, profiles and the Warrior's abilities.

Two files at the root are for anyone picking the project up:

- **[CLAUDE.md](CLAUDE.md)** — the conventions that stay true between sessions,
  and why each one exists
- **[HANDOVER.md](HANDOVER.md)** — current status: what works, what is still
  placeholder, and what is next

## Contributing

- Keep the engine free of UI and framework imports
- Rules go in `engine`, numbers go in `game`
- Emit telemetry for anything worth measuring; never add a private running total
- Never invent game data — flag what is missing instead

Run `npm test` and `npm run typecheck` before opening a pull request.

## License

[MIT](LICENSE).

## Disclaimer

SimForever is an unofficial fan project and is not affiliated with, endorsed by,
or sponsored by Blizzard Entertainment. World of Warcraft and Warcraft are
trademarks of Blizzard Entertainment, Inc. All game data referenced by this
project remains the property of its respective owners.
