# The simulation engine

A tour of `src/engine`, in the order the pieces build on each other.

## Time

`src/engine/time.ts`

All engine time is an **integer number of milliseconds**. `Milliseconds` is a
type alias for `number` — it documents intent, it does not enforce anything.

```typescript
seconds(1.5)        // 1500
toSeconds(1500)     // 1.5
formatTimestamp(65250)  // "01:05.250"
```

Use `seconds()` at boundaries. Never inside the engine.

## Clock

`src/engine/simulation/SimulationClock.ts`

```typescript
interface SimulationClock {
  now(): Milliseconds;
}
```

Most code gets this read-only view. Only the simulation loop holds the mutable
clock, and it can only move forward — `advanceTo` throws on a backwards jump,
because silently accepting one would corrupt every duration in the fight.

## Events

`src/engine/events/`

```typescript
interface CombatEvent {
  readonly name: string;
  readonly priority: EventPriority;
  execute(context: SimulationContext): void;
}
```

An event owns *what* it does. The queue owns *when*, so a rescheduled event
cannot end up with two disagreeing timestamps.

`EventQueue` is a binary min-heap: O(log n) push and pop. Cancellation is lazy —
the entry is flagged and skipped when it reaches the front — because removing
from the middle of a heap costs more than it saves. `size` excludes cancelled
entries so it stays meaningful.

Scheduling returns a `ScheduledEvent` handle. Keep it if you might need to
cancel: an aura keeps handles for its expiry and next tick, which is how removing
it early cleans up instead of leaving ghost ticks in the queue.

### Ordering

`(timestamp, priority, insertion sequence)`. See
[architecture.md](architecture.md#same-timestamp-ordering) for why the priority
order is what it is.

## RNG

`src/engine/rng/`

```typescript
const rng = new SeededRNG(12345);
rng.next();              // [0, 1)
rng.nextInt(1, 6);       // inclusive both ends
rng.rollChance(0.25);
```

`sfc32` seeded through `splitmix32`. Two properties matter: 128 bits of state
(no simulation will exhaust the period) and complete decorrelation of nearby
seeds (so Monte Carlo iterations seeded 1, 2, 3… are genuinely independent).

`rollChance(0)` and `rollChance(1)` short-circuit **without consuming
randomness**, so adding a guaranteed-crit effect does not shift every later roll
in the fight.

`deriveSeed(base, index)` produces the seed for one iteration of a batch, so a
batch is reproducible as a whole and any single iteration can be re-run alone.

## Combatants

`src/engine/actors/Combatant.ts`

One class for players, enemies, pets and summons. Every difference between them
is data:

```typescript
new Combatant({
  id, name,
  kind: 'player',          // player | enemy | pet | summon
  faction: 'friendly',     // friendly | hostile — targeting uses this
  maxHealth: 1000,
  stats: { attackPower: 100 },
  resources: [{ type: 'rage', maximum: 100, initial: 0 }],
  abilities: [...],
  rotation,
  weapon,                  // auto-attack profile
});
```

`isAlive` means "alive right now". `isDeathProcessed` means "the simulation has
run its death handling", which is how two lethal hits in the same instant do not
kill twice.

Damage and healing multipliers (`damageDoneMultiplier`, etc.) are the product
over active auras, recomputed per hit. Aura sets are small, and a stale cached
multiplier is a far nastier bug than a few extra multiplications.

## Stats

`src/engine/stats/`

`StatBlock` holds an immutable base plus a list of modifiers, and caches the
effective values until the modifier list changes.

```typescript
stats.addModifiers(bindModifiers([percent('strength', 0.1)], 'aura:target:might'));
stats.get('strength');
stats.removeModifiersFrom('aura:target:might');
```

`flat`, `percent` and `percentMultiplicative` build modifier specs;
`bindModifiers` ties them to a source id so they can all be removed together.

## Resources

`src/engine/resources/`

Health is a `Resource` like any other, so clamping and overflow rules exist once.

- `spend(n)` is all-or-nothing and returns false if unaffordable. A half-paid
  ability cost is never correct.
- `gain(n)` clamps at the cap and reports `{ gained, wasted }`. The wasted
  portion is how rage capping gets measured.
- `drain(n)` floors at zero and is what damage uses.

## Auras

`src/engine/effects/`

A shared, stateless `AuraDefinition` plus a per-target `AuraInstance`.

```typescript
const RENDING_WOUND: AuraDefinition = {
  id: 'rending_wound',
  name: 'Rending Wound',
  durationMs: seconds(12),   // 0 means "until removed"
  maxStacks: 3,
  isDebuff: true,
  modifiersScaleWithStacks: true,
  statModifiers: [flat('armor', -100)],
  refreshBehaviour: 'reset',  // reset | extend | ignore
  periodic: {
    intervalMs: seconds(3),
    onTick: (context, aura) => { /* ... */ },
  },
};

context.applyAura(target, RENDING_WOUND, caster.id);
```

`AuraCollection` owns the whole lifecycle: stat modifiers, the expiry event, the
tick chain, cleanup on early removal, and telemetry for each transition.

Ticks chain themselves — each tick schedules the next — rather than being
scheduled up front. A refresh that extends the duration therefore gets more
ticks automatically, with no special handling.

One instance per aura per target. Per-caster tracking is a raid-simulation
requirement and changes only the collection's key.

## Abilities

`src/engine/abilities/`

The engine owns everything common to every ability: cooldowns, charges, the
global cooldown, cast time, resource costs, target validity, haste. A definition
supplies only what is unique to it.

```typescript
const STRIKE: Ability = {
  id: 'strike',
  name: 'Strike',
  cooldownMs: seconds(4.5),
  cost: { resource: 'rage', amount: 20 },
  onCast: ({ simulation, caster, target }) => { /* ... */ },
};
```

`checkCast` is side-effect free and returns a typed rejection reason
(`on_cooldown`, `not_enough_resource`, …), which makes a stuck rotation easy to
diagnose. `castAbility` pays costs and starts cooldowns at cast *start*, and
lands the effect at cast *end*.

`AbilityBook` holds per-combatant cooldown state, separate from the shared
definitions, so two warriors have independent cooldowns on the same Strike.
Charges recharge lazily when queried rather than via scheduled events, so an
idle ability costs nothing.

## Damage

`src/engine/combat/damage.ts`

```
base + power scaling → critical strike → attacker modifiers
   → target modifiers → armor/resistance → absorbs → final
```

Each step is an exported pure function, so a formula change can be unit-tested
without standing up a simulation. `resolveDamage` runs the pipeline;
`dealDamage` applies the result, emits telemetry and handles death — and is the
only function that reduces health from damage.

Healing mirrors it in `healing.ts`: same shape, with overhealing where damage
has overkill.

Rating conversions live in `combat/ratings.ts`. **Every constant there is a
placeholder.** Real values vary by expansion and level; what matters is that
they are in one file.

## Rotations

`src/engine/rotation/`

```typescript
new PriorityRotation('Basic Melee', [
  { abilityId: 'strike' },
  { abilityId: 'heroic_blow' },
]);
```

An Action Priority List: walk top to bottom, use the first castable ability.
Entries can carry a `condition` for rotation logic and a `selectTarget` override.
Conditions should express intent ("only when the debuff is about to drop"), not
things the engine already checks ("only when off cooldown").

## The simulation

`src/engine/simulation/Simulation.ts`

```typescript
const simulation = new Simulation(config);
const run = simulation.run();
```

`Simulation` implements `SimulationContext` itself, so the object that owns the
queue and the object events talk to are the same thing.

`createCombatants` is a factory, not an array, because a Monte Carlo batch needs
fresh combatants per iteration rather than the previous fight's dead boss.

Actors with a rotation schedule a `Decision` event that reschedules itself. When
busy, the next decision is exactly when the GCD or cast ends; when free with
nothing castable, it polls every 100ms. That minimum interval is also the
guarantee against an event rescheduling itself at the same timestamp forever — a
`MAX_EVENTS` guard throws rather than hanging the browser if it ever happens
anyway.

`advanceTo(timestamp)` runs the fight partway and parks the clock. The tests use
it to inspect mid-combat state; a step-through debugging view would use the same
method.

`run()` returns a `SimulationRun` — raw telemetry plus actor snapshots. It is
deliberately *not* a `SimulationResult`: interpreting events into DPS is the
analysis layer's job.
