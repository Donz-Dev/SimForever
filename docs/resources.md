# Resources

Every pool has a **current** and a **maximum**. `Resource` owns both, along with
the clamping rules, so there is one implementation for all of them — including
health, which is a resource like any other.

```typescript
const rage = player.resources.require('rage');
rage.current;   // 37.42
rage.maximum;   // 100
```

## Rage

| | |
| --- | --- |
| Starts at | **0** |
| Cap | 100, raisable by talents |
| Regenerates on a timer | **no** |

Rage is earned by fighting, never granted by the clock:

```
rage from dealing damage = damage / 230.6 * 7.5
rage from taking damage  = damage / 230.6 * 2.5
```

`RAGE_CONVERSION_FACTOR` is 230.6 at level 60. It scales with level in the real
game, which is why it is named rather than folded into the coefficients.

**Only auto-attacks generate rage from damage dealt.** Ability damage grants
none unless an ability says otherwise, which the source describes as rare.

Generation is purely proportional with **no flat component**, so a missed or
dodged swing generates nothing at all. That is what makes a high-miss build
rage-starved as well as low-damage, and it is why the dual-wield miss penalty
hurts twice over.

Rage is **stored as a decimal** and displayed as an integer. Damage divided by
230.6 essentially never lands on a whole number, and truncating on every gain
would leak a fraction of a point per swing.

## Energy

| | |
| --- | --- |
| Starts at | **maximum** |
| Cap | 100, raisable by talents |
| Regenerates | **20 every 2 seconds** |

A flat batch, unaffected by stats and unaffected by spending. There is no
equivalent of mana's five second rule.

## Mana

| | |
| --- | --- |
| Starts at | **maximum** |
| Cap | base mana by class plus 15 per intellect |
| Regenerates | **40% of MP5, every 2 seconds** |

The 40% is exactly 2/5 — MP5 prorated to the tick interval — so a character
regenerates precisely its stated MP5 over any five seconds of uninterrupted
ticking. The two numbers agree by construction rather than by coincidence.

### The five second rule

After spending mana, regeneration **stops** until five quiet seconds have
passed.

`manaRegenBypass` is the stat that reads *"allows X% of your mana regeneration
to continue while casting"*. While inside the lockout, a character regenerates
that fraction of the normal tick:

```
inside lockout:  MP5 * 0.4 * (manaRegenBypass / 100)
outside:         MP5 * 0.4
```

With no such stat the answer is zero, and the tick does nothing.

The tick still **fires** during the lockout rather than being cancelled, so
regeneration resumes by itself the moment the window clears. Nothing has to
restart it.

Spend times are tracked **per resource**, so a druid spending rage in bear form
does not suppress its mana regeneration.

## How it fits together

Regeneration is a generic engine mechanism; the numbers are content.

```typescript
interface ResourceRegen {
  resource: ResourceType;
  intervalMs: Milliseconds;
  amountPerTick: (actor, context) => number;
}
```

`amountPerTick` is a **function**, not a number, because how much arrives can
depend on state that changes mid-fight: the five second rule, and a stat a buff
can move. Evaluating it per tick means neither needs special handling, and
returning 0 is normal and cheap.

Each resource ticks on its **own independent schedule**, exactly like swing
timers. A druid's energy and mana do not share a clock.

Timers stop when a combatant dies, so the event queue does not carry regeneration
for corpses.

## Which classes get what

| Class | Pools | Timers |
| --- | --- | --- |
| Warrior | rage | none |
| Rogue | energy | energy |
| Druid | mana, rage, energy | energy, mana |
| Everyone else | mana | mana |

A Druid owns all three pools in every form, so its rage and energy regenerate
according to their own rules regardless of which form it is in.

## Not implemented

- **Ability-driven rage generation.** The hook exists (`ResourceGeneration` on
  any event), but no ability uses it.
- **Energy and mana triggers from talents or set bonuses**, described in the
  source as rare.
- **Damage taken** happens only when `encounter.targetAttacks` is on, which is
  off by default because a damage warrior is not the one being hit. Rage
  from being hit is implemented and wired; it simply never fires.
- **Resource analysis.** Telemetry records every gain with the amount wasted to
  the cap, so rage capping and mana downtime are measurable, but no analyzer
  reports them yet.
