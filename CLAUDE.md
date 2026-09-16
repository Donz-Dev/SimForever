# SimForever — working notes for Claude

An event-driven combat simulator for **World of Warcraft: Forever**, a custom
ruleset heavily based on Classic. TypeScript + React + Vite + Vitest.

This file holds things that stay true between sessions. For what is currently
in progress, read [HANDOVER.md](HANDOVER.md).

## Commands

```bash
npm run dev          # dev server (port 5173)
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build
```

Always run `npm run typecheck` **and** `npm test` before opening a PR. The
typechecker catches things the tests do not — it has caught a mutation of a
shared readonly array and a stat rename that silently invalidated a test.

## The one architectural rule

> **The simulation engine is completely independent of the UI.**

`src/engine` imports no React, touches no DOM, holds no module-level mutable
state. Everything a running simulation needs arrives through a
`SimulationContext`.

Dependencies point one way. If you want an arrow pointing back up, something is
in the wrong layer.

```
ui  ──▶  simulator  ──▶  engine
                   ├──▶  analysis  ──▶  (engine types only)
                   ├──▶  game      ──▶  engine
                   └──▶  profiles  ──▶  engine, game/character
```

- **`engine`** — the rules. How combat works. Knows nothing about warriors or fireballs.
- **`game`** — the content. Races, classes, abilities, the Forever numbers.
- **`analysis`** — turns telemetry into statistics. Never touches a live simulation.
- **`simulator`** — the only place engine + game + analysis are wired together. The UI imports from here.
- **`profiles`** — versioned JSON character configuration.

**Rules go in `engine`, numbers go in `game`.** When the engine needs a ruleset
number, it takes it as an injected function or value — see
`SimulationConfig.attackChances` and `StatBlock`'s derivation parameter.

## Conventions that prevent real bugs

Each of these exists because the alternative produced, or would produce, wrong
numbers that look plausible.

**Time is integer milliseconds** everywhere below the UI. Seconds appear only in
profiles and formatted output. `seconds()` and `toSeconds()` are the only
conversions.

**Combat rolls are integers 1–10000**, and percentages are **truncated** into
that space (`toRollUnits`). 25.7891% becomes 2578, never 2579. Floats would make
an outcome depend on summation order.

**Telemetry is the single source of truth.** The engine keeps no running totals.
The combat log is a pure formatter over the same stream the analyzers read, so
they cannot disagree. Adding a statistic means adding an analyzer, never
threading a counter through combat code.

**Stats are base + modifiers, never mutated in place.** Derived stats
(attack power, crit, armor) are produced by a *function* on the stat block, so
they re-derive when a buff moves a primary stat. Computing them once at creation
would leave attack power stuck at its unbuffed value.

**`attempts` and `hits` are different numbers.** Avoided attacks emit a damage
event with `amount: 0`. Averaging over attempts folds every miss in as a zero.

**Events at the same timestamp** sort by `(timestamp, priority, insertion
order)`. `Periodic` sorts before `AuraExpiration` so a DoT's final tick, due at
the moment it falls off, still lands.

## Never invent game data

This is the most important working rule.

When a formula or value is missing, **say so and flag it loudly** — a named
`PLACEHOLDER_*` constant, a comment, a docs entry. Do not substitute a plausible
number. A simulator built on invented data produces results that look entirely
reasonable and mean nothing, and nobody finds out for months.

When the source is ambiguous, **pick the reading that reproduces a known value**,
state the interpretation in a comment, and isolate it in one place so it is cheap
to flip. Example: the source names an expression `Armor_Reduction` but it
computes the damage *multiplier* — resolved by checking it against the known
~40% figure for a 3731-armor raid boss.

## Generated files

`src/game/character/baseStats.ts` is **generated** by
`tools/import_base_stats.py` from the base stats spreadsheet. Never edit it by
hand; re-run the generator.

Its tests check it against values transcribed **independently by hand**. A test
that derived expectations from the generated file would prove nothing.

## Testing

- **Write the spec out independently in the test.** The race/class table, the
  per-class resource table and the combat table constants are all duplicated by
  hand in tests on purpose. A test that reads the source data passes no matter
  what the source data says.
- **Combat table boundaries use scripted rolls, not sampling.** An off-by-one at
  a boundary shifts every damage number a fraction of a percent; averaging would
  never catch it.
- Use `toBeCloseTo` for anything that passed through a percentage modifier —
  `100 * 1.1` is `110.00000000000001`.

## Git workflow

`main` is **protected**: PR required, CI must pass (Node 20 and 22), no direct
pushes, and that applies to admins. Work on a branch, open a PR, merge with
`--squash --delete-branch`.

**Do not add `Co-Authored-By` trailers** to commits. The user asked for these
removed and the history was rewritten to strip them.

Commit messages: explain *why*, not just what. Flag behaviour changes and
missing data explicitly.

## Verifying work

Tests passing is not the same as the app working. Run the real thing in the
browser and check actual numbers against hand-computed expectations.

**If browser numbers disagree with the tests, suspect a stale Vite cache**
before suspecting the code. This has happened: the dev server served
transformed modules from before an engine change, and the browser showed a
level-60 combat table while the tests and a direct `vite-node` probe showed the
correct level-63 one. Restart with `npm run dev -- --force`.

## Environment

- Windows. `npm`/`npx` may not be on the Bash tool's PATH; PowerShell with a
  refreshed `$env:Path` works reliably.
- Heredocs in the Bash tool are unreliable for large multi-line content. Write a
  script to a file and run it, or use the Write/Edit tools.
- `.gitattributes` forces LF. CRLF warnings on commit are expected and harmless.
