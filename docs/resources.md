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

Rage is earned by fighting, never granted by the clock.

### Dealing damage

```
rage gained = R x S

  R   3.46 for one-handed weapons and for druid (Bear) paw attacks
      4.5  for two-handed weapons
  S   the BASE speed of the weapon, before any modifier
```

`S` is the item's own speed — 2.5 for a bear's paws, which are not an item.

**It does not depend on the damage at all.** A swing is worth the same rage
whether it crits for eight hundred or glances for ninety. What it depends on is
how long the character waited for it.

**Which makes it a rate, for swings the timer produces.** `R × S` rage every
`S` seconds is `R` rage per second, so the speed cancels and the handedness
constant is the *floor*:

| | Rage per second, unaided |
| --- | --- |
| Two-handed | **4.5** |
| One-handed | **3.46** |
| Dual-wield | **6.92** — 3.46 per hand, each on its own timer |
| Bear | **3.46** |

- **A fast weapon is no longer better for rage.** Speed is exactly cancelled.
- **Haste does not raise it.** "Base speed before any modifiers" is the item's
  number, so a hasted warrior swings more often for proportionally less each
  time. Under the old rule haste raised damage and damage *was* rage.
- **Rage income no longer scales with gear or buffs.** It is the same 4.5 a
  second in a full raid as it is naked. This is the single largest behavioural
  change: see [the measurements below](#what-the-change-was-worth).

### Extra attacks break the cancellation, and that is the interesting part

An extra attack from Windfury, Hand of Justice or Weaponmaster pays a **full
`R × S`** for a swing that consumed no time at all. The speed only cancels
against the swing *timer*; a proc has no timer to cancel against.

**So a slow weapon is worth more per proc, not less.** The 2H Arms preset
carries a 3.6 second two-hander:

```
4.5 x 3.6 = 16.2 rage per swing, procced or not
```

against a dual-wielder's `3.46 × 2.6 = 9.0`. Measured, that preset draws
**370 rage a minute from main-hand swings — 6.2 a second against a 4.5 floor**,
because roughly six of its twenty-three swings a fight are procs.

This is the one place the new rule rewards a gear choice, and it does it
backwards from the old one: slow weapons used to be good for rage because they
hit hard, and are now good for rage because each proc is worth a whole slow
swing.

**A miss still earns nothing.** The rule is rage from damage *dealt*, so the
award is flat but conditional — `ResourceGeneration.requiresDamage` is what
expresses that. Without it a flat award would pay out on a swing that never
landed.

**Only auto-attacks generate rage from damage dealt.** Ability damage grants
none unless an ability says otherwise.

### Taking damage

```
rage gained = D x 10 / H

  D   pre-armor damage to be dealt
  H   maximum hit points
```

**Taking your entire health bar is worth ten rage.** A tenth of it is worth
one. The figure is easy to misread: ten sounds small until you notice that a
ramping boss deals a tank many times their health over a fight, which is why
damage taken is still most of a tank's income.

**It is a fraction of the character rather than a fixed rate.** The old rule
paid the same rage for the same damage however large the character was, so
stamina quietly cost rage. This one does not.

**"Pre-armor" is `resolution.raw`** — after both sides' damage multipliers and
before armor, block and absorbs. So Defensive Stance's −10% *does* reduce the
rage earned, because it reduces the damage to be dealt, while armor does not.

> **Open question.** A block is removed at the same pipeline step as armor, so
> it does not reduce rage here either. The rule names armor and says nothing
> about block. This takes the reading where every *defensive* reduction behaves
> alike; ask the ruleset owner before changing it.

### The old formulas

Kept, commented out, in `game/combat/resourceRules.ts`, in case Forever changes
back:

```
rage from dealing damage = damage / 230.6 * 7.5
rage from taking damage  = damage / 230.6 * 2.5
```

Both sides were proportional to damage, scaled by a level-dependent constant.

### What the change was worth

Measured on identical seeds, 500 iterations for the presets and 400 fights a
row for the baselines.

**Raid-buffed presets all fell**, because their rage no longer scales with the
damage the raid buffs let them deal:

| Preset | Before | After | Rage a fight |
| --- | --- | --- | --- |
| 2H Arms | 619.3 | **583.1** | 546 → 459 |
| DW Fury | 689.2 | **641.7** | 784 → 666 |
| Prot Warr | 375.5 | **356.8** | 779 → 704 |

**Unbuffed baselines all rose**, for the same reason read the other way — a
character dealing little damage used to earn little rage and now earns the same
flat income as anyone else:

| Build | Before | After |
| --- | --- | --- |
| Dual-wield / Berserker | 163.71 | **189.44** |
| Two-hander / Battle | 162.44 | **183.66** |
| Dual-wield, 31-pt Arms | 185.84 | **213.43** |
| 1H & Shield, 31-pt Protection | 66.40 | **72.77** |
| Prot, target swings back | 151.49 | **151.12** |

The tank barely moves when the target attacks back, because most of its income
is damage taken and that side stayed proportional.

Rage is **stored as a decimal** and displayed as an integer, so a fraction of a
point is never lost to truncation on the way in.

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
