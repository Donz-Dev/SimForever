# Architecture

This document explains how SimForever is put together and, more importantly,
*why*. If you are about to add a system, read this first — most of the questions
you are about to have are answered here.

## The one rule

> The simulation engine is completely independent of the web UI.

`src/engine` imports no React, touches no DOM, and holds no module-level mutable
state. Everything a running simulation needs is reachable from a
`SimulationContext` that is passed in.

This is not architectural purity for its own sake. It buys four concrete things:

1. **Tests run the real engine.** No mocking a browser, no rendering components.
2. **Iterations can move to Web Workers** without touching combat code, because
   nothing in the engine assumes it owns the process.
3. **A CLI, or a server, is a new entry point** rather than a rewrite.
4. **Combat logic stays findable.** When a number looks wrong there is exactly
   one place it can come from.

## The layers

```
ui  ──▶  simulator  ──▶  engine
                   ├──▶  analysis  ──▶  (engine types only)
                   ├──▶  game      ──▶  engine
                   └──▶  profiles  ──▶  engine, game/character
```

`simulator` owns the profile-to-config translation, so `game` never has to know
what a profile is. That keeps the arrow out of `game` pointing in one direction
only: at the engine.

Dependencies point one way. If you find yourself wanting an arrow that points
back up, that is the signal that something is in the wrong layer.

### `engine` — the rules

How combat works. Time, events, combatants, stats, resources, auras, abilities,
damage, healing, RNG, telemetry. It knows nothing about warriors or fireballs.

### `game` — the content

What exists in the game. Factions, races, classes, specific abilities, auras,
actors, rotations. Content is data handed to the engine, not new engine code. A new
class should add files here and change nothing in `engine`; if it can't, the
engine is missing an abstraction and that is the thing to fix.

### `analysis` — the interpretation

Turns telemetry into statistics. Depends on engine *types* but never calls into
a running simulation.

### `simulator` — the facade

The only place engine, game and analysis are wired together. `runSimulation`,
`runProfileBatch`. This is what the UI imports, and the seam where the
implementation can later become "post to a Web Worker" or "post to a server"
without anything above noticing.

### `profiles` — the data format

Versioned, JSON-safe character configuration. Validation and migration live
here. Everything entering the app from a file, a paste box or storage goes
through `parseProfile`.

Profiles store race and class as ids from `game/character`, and validation
rejects combinations the ruleset forbids. Faction is deliberately *not* stored:
it is determined by the race, so storing it would make an Alliance Orc
representable.

### `ui` — React

Panels, components, one hook. A component may call `runProfileBatch` and render
what comes back. It may not contain combat logic, and it may not reach into
`engine` internals.

## Why event-driven

WoW combat happens at arbitrary sub-second times: a 1.4-second hasted cast, a
2.6-second swing timer, a 3-second DoT tick. A `for (let second = 0; ...)` loop
either cannot express these or has to run at millisecond granularity, spending
almost all of its effort on instants where nothing happens.

The event loop is the whole engine:

```typescript
while (!hasEnded) {
  const scheduled = queue.pop();
  clock.advanceTo(scheduled.timestamp);
  scheduled.event.execute(context);
}
```

A 100-second fight in the current prototype processes about 750 events. A tick
loop would process 100,000 and still get the timing wrong.

## Determinism

Two mechanisms, and the simulation needs both:

1. **Seeded RNG.** Every random decision goes through `RNG`. Nothing calls
   `Math.random()`. The same seed produces the same rolls.
2. **Total ordering of events.** Events sort by `(timestamp, priority, insertion
   sequence)`. The sequence is a monotonic counter, so it always breaks a tie
   and never depends on hash order, object identity or insertion timing.

Together these mean a config plus a seed reproduces a fight exactly, down to the
combat log. That is the difference between debugging a five-minute fight and
guessing at it.

### Same-timestamp ordering

`EventPriority` decides what happens when several events land on the same
millisecond. Two rules are encoded in it:

**Anything scheduled for time T happens at T, and auras expiring at T are still
present while it does.** `Periodic` sorts before `AuraExpiration` because a
12-second DoT ticking every 3 seconds has its final tick due at exactly the
moment it falls off. Expiring first would silently eat that tick and quietly
undercount every DoT in the game by one tick.

**State settles before anyone decides what to do next.** `Decision` sorts last,
so an actor choosing an ability always sees fully resolved state rather than a
half-applied instant.

## Time

Every timestamp and duration below the UI is an **integer number of
milliseconds**. Seconds appear in exactly two places: profiles (written by
people) and formatted output (read by people). `seconds()` and `toSeconds()` are
the only conversions, and they live at those boundaries.

## Stats: base plus modifiers

```
effective = (base + Σ flat) × (1 + Σ percentAdd) × Π (1 + percentMul)
```

Base stats are immutable. A buff applies modifiers tagged with its own id and
removes them on expiry, so the character is always one `clearModifiers()` away
from its unbuffed state. Permanently mutating stats on buff application is the
classic version of this bug, and it corrupts character data the first time a
buff expires during a fight.

Flat bonuses land before percentages, so a +200 strength trinket is amplified by
a +10% strength buff — the behaviour players expect. Both percentage buckets
exist because WoW genuinely uses both, and which one an effect belongs in is
content, not engine policy.

## Telemetry as the source of truth

```
Combat event
     │
     ├──▶ combat state (health, resources, auras)
     │
     └──▶ telemetry stream
                 │
                 ├──▶ DamageAnalyzer
                 ├──▶ HealingAnalyzer
                 └──▶ (buff uptime, resources, cooldowns, ... )
```

The engine keeps no running totals. The combat log is a pure formatter over the
telemetry stream, not a second logging path. Consequently the log and the
statistics cannot disagree, and adding a statistic means adding an analyzer
rather than threading a counter through combat code.

## How the unimplemented features slot in

Nothing below is implemented. Each entry says where it goes, to show the
architecture has room for it.

| Feature | Where it lands |
| --- | --- |
| **Multiple players / raid** | Already supported: the simulation holds a flat combatant collection. Add more combatants. |
| **Pets and summons** | `CombatantKind` already has `pet` and `summon`, and `ownerId` exists. They are combatants with a rotation. |
| **Multi-target, target switching** | Replace `defaultTargetFor` with encounter-driven target selection. `Ability.onCast` already receives a target. |
| **Boss mechanics and phases** | Encounter content that schedules events and applies auras, using the same context as everything else. |
| **Procs and internal cooldowns** | An aura with a trigger. Needs an event hook on damage; the telemetry stream is the natural place to subscribe. |
| **Absorb shields** | `DamageResolution.absorbed` already exists and is plumbed through telemetry. Fill it in during `resolveDamage`. |
| **Resource regeneration** | A repeating event at `EventPriority.Regeneration`, which is already reserved. |
| **Threat, movement, range** | Combatant state plus a check in `checkCast`. Range is why `Ability.requiresTarget` exists rather than assuming a target. |
| **Gear and talents** | Profile sections that contribute stats and modify ability definitions before the combatant is built. |
| **Racial traits** | Auras applied at combat start, keyed off `profile.character.race`. |
| **Class abilities and resources** | Class definitions in `game/character` gain an ability list and a primary resource; `createPlayer` reads them instead of hard-coding. |
| **Web Workers** | Inside `src/simulator`. The engine is already free of shared state; `SimulationResult` is plain serialisable data. |
| **WebAssembly / server** | Same seam. Replace the body of `runSimulation`; the UI contract does not change. |

## Things deliberately not done

- **No dependency injection framework.** Passing a `SimulationContext` is enough.
- **No ECS.** The combatant count is small; an entity-component system would add
  indirection without buying anything at this scale.
- **No premature optimisation.** The engine is written to be readable. When it
  becomes too slow, the order is: measure, then Web Workers, then hot paths,
  then consider another language. Not before.
- **No combatant hierarchy.** One `Combatant` class, not a `Player` / `Boss` /
  `Pet` tree. Every difference between them turned out to be data — stats, a
  rotation, a kind flag — and a flat collection of combatants is exactly what
  lets the same engine run a 1v1 training dummy and a twenty-player raid.
- **No per-caster aura instances yet.** One instance per aura per target. Raid
  simulation needs per-caster tracking, and that changes the collection's key
  from `auraId` to `auraId + casterId` and nothing else.
