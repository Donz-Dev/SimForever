# Telemetry, combat log and analysis

## The principle

The engine emits events. It keeps **no running totals of its own**.

```
Combat event
     │
     ├──▶ combat state   (health, resources, auras — the live simulation)
     │
     └──▶ telemetry      (the permanent record)
              │
              ├──▶ combat log     (a pure formatter)
              ├──▶ DamageAnalyzer
              ├──▶ HealingAnalyzer
              └──▶ future: buff uptime, resource waste, cooldown usage, timeline
```

Every derived number comes from the stream. The consequences are worth being
explicit about:

- **The combat log and the statistics cannot disagree.** The log is a formatter
  over the same events the analyzers read. If a number looks wrong, there is one
  place it came from.
- **Adding a statistic never touches combat code.** Write an analyzer.
- **Nothing gets silently forgotten.** If a mechanic does not emit telemetry, it
  is invisible to analysis — which is the correct pressure to apply.

## Event shape

`src/engine/logging/TelemetryEvent.ts` defines a discriminated union on `type`.
Narrowing on that field in a `switch` is exhaustively checked, so adding a new
event type surfaces every place that needs updating.

```typescript
{
  type: 'damage',
  timestamp: 1500,         // engine time, integer milliseconds
  sourceId: 'player_1',
  targetId: 'dummy_1',
  abilityId: 'strike',
  abilityName: 'Strike',
  school: 'physical',
  amount: 219,             // what reached the target's health
  critical: false,
  mitigated: 0,            // removed by armor or resistance
  absorbed: 0,             // removed by shields
  overkill: 0,             // portion of `amount` beyond remaining health
  periodic: false,         // true for DoT ticks
}
```

Current event types:

| Type | Emitted when |
| --- | --- |
| `combat_start` | The fight begins. Carries the seed. |
| `combat_end` | The fight ends, with the reason. |
| `cast` | An ability is used (at cast start). |
| `damage` | Damage is applied. |
| `heal` | Healing is applied. |
| `aura_applied` / `aura_refreshed` / `aura_stacks_changed` / `aura_removed` | Aura transitions. |
| `resource_spent` / `resource_gained` | A resource changes, with any waste. |
| `death` | A combatant dies. |

All events carry `timestamp`. Ids, not object references, so the stream is plain
JSON and can cross a Worker or network boundary unchanged.

## Sinks

```typescript
interface TelemetrySink {
  emit(event: TelemetryEvent): void;
}
```

| Sink | Use |
| --- | --- |
| `TelemetryRecorder` | Keeps everything. The default for a run you will inspect. |
| `NullTelemetrySink` | Discards everything. |
| `FanOutTelemetrySink` | Sends to several sinks. |
| `StreamingDamageTotals` | Sums damage per source and discards the events. |

`StreamingDamageTotals` is why a 10,000-iteration batch does not exhaust memory:
retaining every event for every iteration would cost gigabytes for numbers that
get summed once and thrown away. The batch aggregates as it goes, then re-runs
only the median iteration with full recording so the log the user reads matches
the headline number.

## Combat log

`src/engine/logging/CombatLog.ts` formats telemetry into lines:

```
00:00.000  Combat begins (seed 12345)
00:00.000  Example gains Battle Fury
00:00.000  Example Melee hits Training Dummy for 107
00:02.600  Example casts Strike at Training Dummy
00:02.600  Example Strike hits Training Dummy for 219
00:02.600  Training Dummy is afflicted by Rending Wound
00:05.600  Example Rending Wound ticks on Training Dummy for 27
00:15.000  Combat ends (time limit reached)
```

`formatCombatLog` renders everything. `formatConciseCombatLog` drops the
high-volume resource events, which otherwise outnumber everything else several
times over; this is what the UI shows.

Actor names come from a `NameResolver` callback, because the stream holds ids.

## Analyzers

```typescript
interface Analyzer<T> {
  readonly name: string;
  analyze(input: AnalysisInput): T;
}
```

`AnalysisInput` is the telemetry stream plus actor snapshots and the elapsed
time. Implemented so far:

- **`DamageAnalyzer`** — total, DPS, per-actor and per-ability breakdown with
  hits, crit rate, average and share. Counts only damage dealt by friendly
  actors, since that is what a DPS sim measures; damage taken is a different
  question and deserves its own analyzer rather than a flag on this one.
- **`HealingAnalyzer`** — total, HPS, overhealing per actor.

`buildSimulationResult` runs both and assembles the `SimulationResult` the UI
consumes.

### Writing a new analyzer

1. Confirm the events you need are already emitted. If not, emit them — do not
   add a counter to combat code.
2. Implement `Analyzer<T>` in `src/analysis/`.
3. Add it to `buildSimulationResult` if it belongs in the standard result.
4. Test it against a hand-written event array. Analyzers are pure functions of
   their input, so this needs no simulation at all.

Buff uptime, resource waste, cooldown usage and a timeline view are all
straightforward additions: the events they need are already in the stream.
