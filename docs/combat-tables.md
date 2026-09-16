# Combat tables

Every attack in World of Warcraft: Forever resolves against one of six tables.
The table decides what outcomes are possible, in what order they are checked,
and whether one die is rolled or two.

## The die

Combat rolls an integer from **1 to 10000**, where 10000 is 100%. Chances are
converted into these units before any comparison:

```typescript
toRollUnits(25.7891)  // 2578, not 2579
toRollUnits(8)        // 800
toRollUnits(6.5)      // 650
```

**Truncated, not rounded.** Rounding would hand out a fraction of a percent of
free crit, which compounds across thousands of iterations.

Integers rather than floats because an attack's outcome must be exactly
reproducible. Comparing accumulated floating-point percentages would make the
result depend on the order they were summed in, and a 0.0001% drift at a table
boundary is the kind of bug that surfaces as an unexplained 0.1% DPS difference
months later.

Class base crit constants can be negative — a Hunter's is `-1.53` — so
`toRollUnits` floors at zero.

## Single roll versus two rolls

This is the substantive difference between the tables, not a detail.

**Single roll** walks one die down a cumulative range. Miss occupies 1..miss,
dodge the next slice, and so on. Because everything shares the same 10000 slots,
a large miss chance genuinely **crowds crit off the table**: a dual-wielding
warrior misses more *and* crits less on its auto-attacks.

**Two rolls** spend the first die on avoidance only, then roll again for crit.
Avoidance and crit do not compete, so a special attack crits at the character's
actual crit rate among the hits that land.

A two-roll table only rolls twice **if the first roll did not avoid the
attack**. A missed special never rolls for crit, which keeps the RNG stream
aligned with what actually happened.

## The six tables

| # | Table | Rolls | Order |
| --- | --- | --- | --- |
| 1 | `melee-auto` | one | miss, dodge, parry, glance, crit, hit |
| 2 | `ranged-auto` | one | miss, crit, hit |
| 3 | `melee-special` | two | miss, dodge, parry then crit, hit |
| 4 | `ranged-special` | two | miss then crit, hit |
| 5 | `spell` | two | miss then crit, hit |
| 6 | `melee-received` | one | miss, dodge, parry, crush, crit, hit |

Glancing blows only exist on melee auto-attacks. Crushing blows only exist on
attacks the player receives.

## Weapon skill versus defense skill

Most of the table is **derived** from the gap between the attacker's weapon
skill and the defender's defense skill, not from flat numbers.

```
defense skill = 5 x target level
```

A level 60 character caps weapon skill at **300**. A level 63 raid boss has
**315** defense. That 15-point deficit is what shapes everything below.

| | Formula | At a 15-point gap |
| --- | --- | --- |
| Miss (gap > 10) | `600 - hit + 1900*dualWield + gap * 20` | 9% |
| Miss (gap <= 10) | `500 - hit + 1900*dualWield + gap * 10` | - |
| Dodge | `500 + gap * 10` | 6.5% |
| Glance | `1000 + (defense - 300) * 200` | 40% |
| Glance damage | floored, capped at 91 / 99 | 55%..75% |
| Crit suppression | `180 + (targetLevel - level) * 100` | -4.8 points |

Two things are worth noticing.

**The miss formula has two regimes.** Past a 10-point gap both the base and the
per-point penalty rise, which is why a level 63 target is disproportionately
harder to hit than a level 62 one.

**Dodge and glance reproduce the earlier flat values exactly** at a 15-point
gap: 6.5% and 40%. The formulas are consistent with the constants they replace;
only miss moves, from 8% to 9%.

**Glancing blows depend on the target, not the attacker.** Training weapon skill
reduces miss and dodge but cannot reduce glancing at all.

**Crit suppression is brutal.** At level 63 it removes 4.8 percentage points,
which is more than an ungeared character has. A Warrior with 5.14% crit lands at
**0.34%** against a raid boss.

### Flat numbers that remain

| | |
| --- | --- |
| Dual-wield miss penalty | **+19%, in full on both weapons** |
| Spell miss (resist) | 17%, unaffected by weapon skill |
| Enemy parry | 14%, or 0% (see below) |
| Melee / ranged crit | 2x |
| Spell crit | 1.5x |
| Boss miss / crush / crit | 5% / 15% (1.5x) / 5% (2x) |

The dual-wield penalty is applied **in full to each weapon**, not halved and not
applied to one hand. Special attacks never carry it: a special is one strike,
not one per hand.

**Ranged is an interpretation.** The source gives no ranged formula, so ranged
attacks use the special-attack shape with the ranged weapon's skill: no
dual-wield penalty, no dodge, no parry, no glancing blow.

## Armor

```
damage multiplier = 1 - armor / (400 + 85 * targetLevel + armor)
```

A 3731-armor level 63 target lets **60.67%** through, the familiar "just under
40% reduction" against a raid boss.

**Read the naming carefully.** The source calls this expression
`Armor_Reduction`, but what it computes is the *multiplier*, not the amount
removed. Taking it as the reduction would turn a 39% reduction into a 61% one —
exactly the sort of error that produces plausible-looking numbers. The code
exposes both `armorDamageMultiplier` and `armorReduction`, and a test asserts
they sum to 1.

Armor applies to **hit-based physical damage**, decided per damage event rather
than inferred from the school. A bleed is physical and sets
`appliesArmor: false`.

### Enemy parry

INTERPRETATION. The source gives 14% parry, "0% if 1H & Shield is not selected".
Read as: only a character tanking with a shield stands in front of the target,
and everyone else is behind it, where parry cannot happen.

If parry should instead follow facing or threat directly, `PARRYABLE_STYLES` is
the one place to change.

## Declaring a table on an ability

```typescript
export const MORTAL_STRIKE: Ability = {
  id: 'mortal_strike',
  name: 'Mortal Strike',
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    dealDamage(simulation, {
      source: caster,
      target,
      abilityName: 'Mortal Strike',
      school: 'physical',
      baseAmount: 500,
      attackTable: ability.attackTable,
    });
  },
};
```

The ability declares its table once and reads it back through
`context.ability`, so the table is not repeated in every damage call.

| Ability | Table |
| --- | --- |
| Mortal Strike, Rend | `melee-special` |
| Multi-Shot | `ranged-special` |
| Fireball, Shadow Word: Pain | `spell` |

## Effects that land but deal no direct damage

A damage-over-time spell still rolls the **spell** table once, to see whether it
was resisted. Its ticks then land unconditionally.

```typescript
const landed = simulation.rollAttack('spell', caster, target);
if (!landed.avoided) {
  simulation.applyAura(target, SHADOW_WORD_PAIN, caster.id);
}
```

`rollAttack` resolves a table without dealing damage. Damage with **no**
`attackTable` lands unconditionally and cannot crit, which is what a DoT tick
wants: whether it landed was already decided.

## Outcomes in telemetry

Every damage event carries an `outcome`. That is what makes miss rate, glance
rate and crit rate measurable rather than inferred.

It also forced a change in the analyzer: **`attempts` and `hits` are different
numbers.** Avoided attacks emit a damage event with `amount: 0`, so averaging
over attempts would fold every miss in as a zero and report a weapon as hitting
for far less than it does. Averages and crit rates are computed over landed
hits.

## What is not implemented

- **Hit comes from a `hitChance` stat** measured in percentage points, which the
  miss formulas subtract. No gear grants it yet, so it is zero unless set by
  hand.
- **Weapon skill above the cap** is supported by the formulas but nothing grants
  it. Talents and racials that raise weapon skill would set `WeaponProfile.skill`.
- **Defense skill is exactly 5 x level.** A defense stat that raises it beyond
  that does not exist.
- **Table 6 is built but unused.** Nothing attacks the player yet. Player dodge
  comes from the agility conversion; **player parry is 0**, because it depends
  on a defense stat and talents that do not exist. It is left at zero rather
  than guessed.
- **Defense stat, resistances and level-based miss** are all absent.
- **Glance penalty is fixed at 30%.** The source notes it "can be adjusted by
  stats"; no such stat exists yet.
