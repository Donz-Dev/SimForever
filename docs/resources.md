# Resources

Rage, energy, mana, combo points, focus and soul shards — what each one is
capped at, where it comes from, and what is still a placeholder.

**Every number here is read off the code as it stands**, not from memory. The
previous version of this file dated from before combo points, focus and soul
shards existed, and three of its "not implemented" entries had expired.

## Who owns what

| Class | Pools | Regenerates on a timer |
| --- | --- | --- |
| Warrior | rage | — |
| Rogue | energy, combo points | energy |
| Druid | mana, rage, energy, combo points | energy, mana |
| Warlock | mana, soul shards | mana |
| Paladin, Hunter, Priest, Shaman, Mage | mana | mana |
| **Pet** | focus | focus |

**A Druid owns all four pools in every form**, so switching to bear does not
have to create a rage pool that did not exist a moment earlier. Which one
*drives* play is the form's: `caster`, `moonkin` and `tree` run on mana, `bear`
on rage, `cat` on energy.

**Focus is the PET's and never the Hunter's.** A Hunter runs on mana like any
other caster; the pet is a separate combatant with its own hundred focus.

---

## Rage

| | |
| --- | --- |
| Cap | 100, raisable by talent |
| Starts at | **0** — the only pool that does |
| Timer | none. Rage is earned, not regenerated |

### From dealing damage

**A FLAT RATE PER SWING, NOT A SHARE OF THE DAMAGE.**

```
rage = R × S
```

`R` is 3.46 for a one-hander or a bear's paws, 4.5 for a two-hander. `S` is the
weapon's **base** speed, before any modifier.

`R × S` every `S` seconds is `R` per second, **so the speed cancels**:

| | rage per second |
| --- | --- |
| Two-hander | 4.50 |
| One-hander | 3.46 |
| Dual-wield | **6.92** — each hand pays its own `R × S` |
| Bear paws | 3.46, at a stated 2.5s speed |

**Haste raises none of it.** `S` is the item's number, so a hasted warrior
swings more often for proportionally less each time.

**A miss earns nothing** — it is rage from damage *dealt*, expressed as
`ResourceGeneration.requiresDamage` rather than falling out of the arithmetic.

**EXTRA ATTACKS BREAK THE CANCELLATION, and that is where it gets interesting.**
A Windfury or Hand of Justice proc pays a full `R × S` for a swing that cost no
time, so a slow two-hander earns 16.2 a proc against a dual-wielder's 9.0.

### From taking damage

```
rage = D × 10 / H
```

`D` is the **pre-armor** damage minus the block; `H` is maximum health. Ten
percent of your health taken is ten rage, on any character at any gear level.

Three rulings pull against each other on one pipeline step:

| | Reduces the rage? |
| --- | --- |
| Defensive Stance −10% | **yes** — it reduces `D` before any of this |
| Armor | **no** — that is what "pre-armor" means |
| A block | **yes**, by its flat value |

Armor and a block are one step in this engine, so `DamageResolution` carries
`blocked` separately to tell them apart. **A block is therefore worth less than
it looks** to a Protection warrior: it removes damage *and* the rage that damage
would have paid.

Only fires when `encounter.targetAttacks` is on.

### From abilities

Bloodrage (10 instant, then 10 over time) and Anger Management (1 every 3
seconds). The `ResourceGeneration` hook is on any event, not just swings.

---

## Energy

| | |
| --- | --- |
| Cap | 100; Vigor raises it by 5 or 10 |
| Starts at | maximum |
| Regenerates | **0.5 every 50ms** — a flat 10 a second |

Unaffected by stats and unaffected by spending. **There is no equivalent of
mana's five second rule.**

**SMOOTH, AND AT THE RATE IT ALWAYS HAD.** Twenty ticks a second rather than one
batch every two seconds. The rate is unchanged; what changes is that a rotation
waits at most 50ms for the last energy it needs instead of up to two seconds.

A Rogue and a Cat-Form Druid also have a **1.0 second global cooldown** rather
than 1.5, which is a property of the class and not of energy.

---

## Mana

| | |
| --- | --- |
| Cap | class/race base mana **+ 15 per intellect** |
| Starts at | maximum |
| Regenerates | **MP5 ÷ 100, every 50ms** |

The fraction is **derived from the interval** rather than written down, so the
rate cannot drift from the cadence: a character still regenerates precisely its
stated MP5 over any five quiet seconds, exactly as the old 2/5-every-two-seconds
did.

**SMOOTHING MANA CHANGES WHEN THE FIVE SECOND RULE BITES**, which is the only
way it is not purely cosmetic — regeneration resumes within 50ms of the window
clearing rather than waiting for the next two-second boundary.

**MP5 comes from spirit**, at 0.5 a point for most classes and 5/8 for the
Druid's caster forms.

### The five second rule

After spending mana, regeneration **stops** for five seconds. Inside the
lockout a character gets only what `manaRegenBypass` allows:

```
inside:   (MP5 ÷ 100) × (manaRegenBypass / 100)
outside:  (MP5 ÷ 100)
```

With no such stat that is zero. The tick still **fires** during the lockout
rather than being cancelled, so regeneration resumes by itself.

**Spend times are tracked per resource**, so a Druid spending rage in bear form
does not suppress its own mana regeneration.

---

## Combo points

| | |
| --- | --- |
| Cap | **5** |
| Starts at | 0 |
| Timer | none — built by landing attacks |

**Only a builder that CONNECTED awards one**, the same rule rage follows and for
the same reason.

**At the cap a point is WASTED, not refused.** The overflow is reported, which
is what makes "how much of my Sinister Strike was thrown away" a number rather
than a guess. Refusing the award would hide it.

**TRACKED PER TARGET.** Combo points live on the victim, not on the Rogue, so
building on a different enemy discards whatever was there. `comboPointTargetId`
records whose they are.

**It can never fire today**, because every encounter has exactly one enemy and
it is always the main target — which is the point: the rule is right in advance
rather than remembered the day an encounter has adds. The previous model carried
points across targets silently, which would have read as a very generous Rogue
and not as a bug.

A SELF-BUFF FINISHER spends the pool **without naming a target** — Slice and
Dice and Venom put their buff on the Rogue while the points sit on the enemy.

---

## Focus

The **pet's**, and nobody else's.

| | |
| --- | --- |
| Cap | 100 |
| Starts at | maximum |
| Regenerates | **0.5 every 50ms** — 10 a second |

Spent by Claw (25), Bite (35) and Growl (15). Bestial Discipline scales the
regeneration rate.

**THE SOURCE STATES TWO RATES AND THEY DISAGREE.** The Forever Hunter wiki says
"about 25.5 Focus every 5.2 sec" — which is 4.9 a second — and then "100 Focus
over 10 sec, or 10 Focus per second", followed by "this is roughly double the
Classic Focus regeneration rate". Classic's ~5 a second makes that true of 10
and false of 4.9, so **10 is used**. One constant; flipping it is one edit.

**SMOOTH, at the rate it already had.** The wiki calls the behaviour
"continuous", which no event-driven engine can be; twenty ticks a second is the
nearest thing and delivers the stated rate exactly.

---

## Refunds

**An ability that does not connect hands 80% of its cost back**, for **rage and
energy only**. A mana spell that resists refunds nothing.

"Miss or otherwise don't connect through a block/dodge/parry" is the owner's
wording, and for an ability the block clause has no case to cover: this engine's
`melee-special` table offers miss, dodge and parry and **no block at all**, while
an auto-attack that is blocked costs nothing to refund. So the rule reduces
exactly to `AVOIDED_OUTCOMES`.

| | |
| --- | --- |
| **Ferocious Bite** | exempt — always depletes the pool |
| **Execute** | exempt — always depletes the pool |

Both say so on themselves with `refundsCostOnMiss: false`. Everything else gets
the rule by **derivation**, so a new rage or energy ability cannot forget it —
the same argument the global cooldown uses, and for the same reason: an ability
that wrongly kept its cost would still deal the right damage.

**A multi-hit ability is judged on its first hit.** The refund is armed when the
cost is paid and cleared by the first damage the ability resolves, whether that
damage landed or not — so Whirlwind's off hand missing after its main hand
connected refunds nothing.

## Soul shards

| | |
| --- | --- |
| Cap | **10 — `PLACEHOLDER_SOUL_SHARDS`** |
| Starts at | maximum |
| Income | **none at all** |

A Warlock earns shards from Drain Soul **killing** something, which never
happens against a target that survives every fight. So what a Warlock has is
whatever it banked before the pull, and nothing states that number.

Ten is a visibly round placeholder, chosen high enough that a sixty-second fight
never runs dry — which keeps the absence of income from silently becoming the
thing being measured. **Shadowburn is the only spender.**

**One refund exists and works**: Shadow and Flame gives Shadowburn a 100% chance
to refund its shard, applied as an `abilityFlag`.

**Decimation's shard clause is blocked twice** and neither blocker is the one
its old reason named. Every clause needs the target **below 35% health**, which
never happens against a target that survives by design — *and* its "costs no
Soul Shards" applies to **Soul Fire**, which is not a declared ability here. So
the shard half would still do nothing the day the health gate became reachable.

---

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
depend on state that changes mid-fight — the five second rule, and a stat a buff
can move. Returning 0 is normal and cheap.

Each resource ticks on its **own independent schedule**, exactly like swing
timers. Timers stop when a combatant dies.

## Still open

| | |
| --- | --- |
| ~~**Only RAGE is reported**~~ | **DONE.** `batch.resources` carries one flow per pool, DISCOVERED FROM THE EVENT STREAM rather than from the class, and the results page gives each one a spent-by-source donut, a gained-by-source donut, a uses table and a timeline of the level over the representative iteration. The old single `rage` field was worse than incomplete: its totals were never keyed by resource, so a Rogue's energy and combo points were summed together under a heading that said "Rage" |
| **Soul shards have no income** | and their pool is a placeholder. The only resource here with no source at all |
| **Focus's rate is a 10-vs-4.9 judgement** | from one source that contradicts itself |
| **Energy and mana triggers from talents or set bonuses** | the hook exists; nothing uses it |
