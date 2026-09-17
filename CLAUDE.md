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
- **`game`** — the content. Races, classes, abilities, talents, items, the Forever numbers.
- **`data`** — bulk content from external sources, as JSON. A script writes it; nothing hand-edits it.
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

**At most one pending swing per weapon slot.** `scheduleSwing` cancels whatever
that slot was waiting on before scheduling. Without it an extra attack forks the
chain: it fires from inside a swing, which has not yet scheduled its successor,
so the extra attack schedules one and the original schedules another — two
independent timers on one weapon, doubling again with every proc. Four Hand of
Justice procs turned 115 main-hand swings into 211, which reads as a very good
trinket rather than as a bug.

**A dual-wielder has two combat tables, not one shown twice.** Miss and enemy
dodge both derive from the WIELDING WEAPON's skill, so a sword in one hand and a
mace in the other diverge the moment anything grants skill with one and not the
other. Anything reporting them must ask per slot. The dual-wield penalty lands on
both hands, so it is skill and not the penalty that separates them.

**A stat that only applies sometimes is a bug waiting to happen.** Equipment
resolution strips the slots a combat style cannot fill, and stripping one slot
too many silently discarded a bow's attack power from every melee character.
Only genuine conflicts are exclusive: a two-hander against a one-hander, and an
off-hand the style cannot hold. A ranged weapon coexists with a sword and simply
does not swing.

## Where the Forever data comes from

Three sources, and knowing which answers what saves a lot of asking.

**`C:\Users\Donz\Documents\WoWForever*`** — the ruleset owner's own files, and
the highest authority. Base stats (`.xlsx`), the combat table, stat conversions,
resources, expected stats, and one ability spreadsheet per class as they are
written. `WoWForeverSimGuidance.docx` is NOT data; it is screenshots of an
architecture discussion.

**`wowhead.com/forever/talent-calc/<class>`** — the talent trees, and a useful
cross-check on ability numbers because its tooltips restate them. Client-side
rendered, so a plain fetch gets a page with no talents in it; the data is in the
DOM. `src/data/talents/README.md` has the selectors.

**`nether.wowhead.com/classic/tooltip/item/<id>`** — Classic item and spell
tooltips, as plain JSON. No browser needed. Used for the current items, which are
Classic stand-ins rather than Forever data. `src/data/items/README.md` has the
markers to parse.

When a number is missing, check whether one of these answers it before asking.

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

**When an effect cannot be modelled, keep its own words and surface them.** Items
carry an `unmodelled` list holding the source's exact text and one line on why it
does nothing, and the Gear panel prints every one under "Equipped but not
simulated". An effect that matches no rule is never guessed at — which is what
kept Crusader granting nothing until its proc rate arrived, rather than quietly
inheriting a plausible one. The same applies to `PLACEHOLDER_*` constants: a
visibly inert buff is the honest failure mode.

**Two sources can disagree.** The ability spreadsheets and the Forever talent
calculator both describe the same abilities, and where they agree confidence
rises. Where they disagree, say so in the docs and pick the one the ruleset owner
supplied directly — do not average them or quietly prefer the newer.

## Generated and scraped data

`src/game/character/baseStats.ts` is **generated** by
`tools/import_base_stats.py` from the base stats spreadsheet. Never edit it by
hand; re-run the generator.

`src/data/talents/*.json` (470 talents, nine classes) and
`src/data/items/classic-warrior.json` (18 items) were **scraped once** and are
checked in. Each directory has a README recording exactly where the data came
from and how to refresh it. Never hand-edit either.

**Prove a transfer rather than trusting it.** Both data sets came out of a
browser, and both were hashed with SHA-256 there and re-hashed on disk before
being accepted. For 113KB of talents that is the difference between confidence
and hope. The clipboard is a working channel for this on Windows
(`document.execCommand('copy')` after a real click, then `Get-Clipboard -Raw`),
and it overwrites the user's clipboard, so say so.

**Validate scraped data at load and throw.** `talentData.ts` checks tier against
row, prerequisites resolving inside their own tree, and duplicate ids; the item
loader recomputes each weapon's dps from its damage and speed and throws if the
three disagree. A page that changes shape should fail loudly, not render a tree
with a broken arrow.

Tests check this data against values transcribed **independently by hand**. A
test that derived its expectations from the file under test would prove nothing.
Where the volume makes that impractical — 470 talents — transcribe the shape
(tree names, sizes, capstones) and assert the invariants that must hold for all
of them at once.

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

**First check the two numbers are even supposed to match.** The UI runs
`runProfileBatch` and renders `batch.representative`, *not*
`runProfile(profile)`. Even at one iteration the batch derives its own seed, so
the browser is showing a different fight from a direct `runProfile` call with
the same profile — the log's `Combat begins (seed ...)` line gives the derived
seed, not the profile's. To reproduce what the browser shows, call
`runProfileBatch` and read `.representative`.

**Then, if they should match and do not, suspect a stale Vite cache** before
suspecting the code. This has happened: the dev server served transformed
modules from before an engine change, and the browser showed a level-60 combat
table while the tests and a direct `vite-node` probe showed the correct level-63
one. Restart with `npm run dev -- --force`.

Those two are in that order for a reason. The cache warning is the memorable
one, so a mismatch reads as a cache bug on sight — and that cost a long detour
of server restarts and cache clearing before `runProfileBatch` turned out to
reproduce the browser's numbers exactly, outside the browser.

**Verify a probabilistic mechanic against its rate, over many seeds, not
against whether it showed up in one fight.** A 6.5% dodge chance is absent from
an entire 100-second fight about once in every two hundred runs, which is often
enough to happen on the seed you are looking at. Loop over a few dozen seeds and
compare the observed rate with the one the combat table specifies. The same goes
for asserting on it in a test: naming a specific ability in a training-dummy
assertion pins a rotation decision rather than the behaviour under test, and
breaks as soon as the rage economy shifts.

## Environment

- Windows. `npm`/`npx` may not be on the Bash tool's PATH; PowerShell with a
  refreshed `$env:Path` works reliably.
- Heredocs in the Bash tool are unreliable for large multi-line content. Write a
  script to a file and run it, or use the Write/Edit tools.
- `.gitattributes` forces LF. CRLF warnings on commit are expected and harmless.
