# Spell coefficients

How a spell's damage scales with spell power. One rule supplied by the ruleset
owner, three borrowed from WoW Classic on the owner's ruling, and every one of
them visible in `src/game/combat/spellCoefficient.ts`.

Before this, **no spell in the project scaled with gear at all.** Every caster
figure was a floor, and five classes said so in their own file headers.

## The rule, in the owner's words

> A spell coefficient is the % amount of (total spell damage + matching-school
> spell damage) and is then added to the base spell damage of the spell.
>
> Base Cast Time (before reductions from talents or spell haste) / 3.5 = spell
> coefficient

```
damage = castTime / 3.5 × (spellPower + schoolSpellPower) + baseDamage
```

The owner's worked example, which `spellCoefficient.test.ts` pins to two
decimal places:

> A spell has a 2.5 second cast time and has "deals 150 to 250 lightning
> damage". The character has +100 spell damage and +80 nature damage.
>
> `2.5 / 3.5 × 180 + 200 = 328.57`

**"(total spell damage + matching-school spell damage)" is exactly
`spellPowerFor(source, school)`**, which arrived one change earlier for the
school-scoped item stat. The two halves it adds are the school-blind
`spellPower` and the school-scoped `SchoolModifier.spellPower`. That is why
this feature needed no engine work: `scaleByPower` has computed
`baseAmount + coefficient × power` since before any caster existed.

**An instant cast uses 1.5 / 3.5**, also the owner's. It is the global
cooldown, so an instant is priced at the time it really consumes.

## The four cases

| | Rule | Clamped? |
| --- | --- | --- |
| **Direct cast** | `castTime / 3.5` | **Yes**, to `[1.5, 3.5]` seconds |
| **Channel** | `channelDuration / 3.5`, split evenly across ticks | No |
| **Periodic** | `baseDuration / 15`, split evenly across ticks | No |
| **Hybrid** | both, each scaled by its own share of their sum | — |

**Only the direct rule is clamped, and that is Classic being self-consistent
rather than an oversight.** A five-second Arcane Missiles channel is worth
1.429 and a 24-second Bane of Agony 1.6, while a six-second Pyroblast is worth
1.0. A channel and a DoT already pay for their coefficient in TIME, which is
precisely what the clamp stops a single cast from doing.

### The hybrid split

A spell that hits AND leaves a burn is one cast, and would otherwise scale
about twice as hard as a nuke costing the same global cooldown. Each half is
scaled by its own share:

```
directShare = direct / (direct + dot)
dotShare    = dot    / (direct + dot)
finalDirect = direct × directShare
finalDot    = dot    × dotShare
```

**It reproduces Classic's published pairs exactly**, which is what makes it the
right transcription of the rule rather than a plausible one — several
normalisations land NEAR the correct answer. Moonfire, an instant with a
12-second DoT, comes out at **0.1495 and 0.5209** against Classic's stated 0.15
and 0.52. The test pins that pair.

Note it is deliberately **not** "make the two sum to 1.0". The bigger half
keeps more of what it had, so a long DoT on a short cast stays a DoT spell.

## What is borrowed, and what would settle it

Three of the four are WoW Classic's, chosen by the ruleset owner when asked,
because Forever states none of them. Each is named so nothing can read it
without seeing that.

| Constant | What would confirm it |
| --- | --- |
| `PLACEHOLDER_SPELL_COEFFICIENT_DOT_DIVISOR` (15) | Any Forever source stating one DoT's coefficient outright — the durations are known, so a single figure settles the divisor. |
| `PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS` (3.5) | Pyroblast's coefficient. It is the only spell here that reaches the clamp. |
| The hybrid share formula | Any Forever source giving both halves of one hybrid. |

`SPELL_COEFFICIENT_CAST_DIVISOR` (3.5) and `INSTANT_CAST_SECONDS` (1.5) are the
owner's own and carry no placeholder marking.

## Two traps, both of which produce plausible numbers

**THE CAST TIME IS THE BASE ONE, AND `ability.castTimeMs` IS NOT.**
`abilitiesForClass` overwrites `castTimeMs` with the talent-reduced figure, so
reading it inside `onCast` would make Improved Fireball quietly **reduce**
Fireball's scaling with gear — a cast-time talent making a spell worse, at a
number nobody would question. Every spell declares a named `*_CAST_MS` constant
and uses it for both its `castTimeMs` and its coefficient, so the two cannot
drift.

**AN EFFECT WHOSE SIZE IS DERIVED FROM ANOTHER HIT TAKES NO COEFFICIENT.**
Ignite is "an additional N% of your spell's damage", and that spell's damage was
already scaled — so a coefficient here would apply spell power twice. Its zero
is asserted directly, because `everySpellScales.test.ts` cannot reach an aura
with no ability behind it.

## A known consequence worth reading

The hybrid shares are weighted by each half's **coefficient**, which is to say
by **duration**, and not by how much **damage** each half actually deals. Those
come apart when a big nuke leaves a token burn:

> Fireball — 483 direct plus 60 over 8 seconds — gets **0.652 direct** and
> 0.186 over the DoT.

The burn is 11% of the spell's damage and takes 35% of its scaling, so Fireball
scales at 0.652 where a 3.5-second cast with no DoT gets the full 1.0. Classic
sidesteps this by giving Fireball's DoT no coefficient at all and treating the
spell as a pure nuke.

**Left as the rule says rather than special-cased**, because the owner chose the
split knowing it applied to these spells, and a per-spell exception is the kind
of invented content this project refuses. If it should instead weight by damage
share, or exempt a DoT below some fraction of the whole, that is a change to
`hybridSpellCoefficients` and nothing else.

## What does NOT take one

| | Why |
| --- | --- |
| **A Paladin seal** | The owner supplied its own formula: `base + baseWeaponSpeed × (0.022 × AP + 0.044 × SP)`. A seal is not cast at a target and has no cast time to divide. It already reads Holy-scoped spell power through `spellPowerFor`. |
| **A Hunter shot** | Forever **removed** Arcane Shot's spell power coefficient and gave it a ranged attack power one instead. Reading spell power would reinstate something Forever deliberately took out. Serpent Sting ticks Nature and scales with ranged AP for the same reason. |
| **Ignite** | Its size is a share of an already-scaled hit. |
| **Summon Hawk** | Its damage is the hawk's, and it is physical. |
| **Every melee and ranged ability** | They scale with attack power, through `attackPowerCoefficientFor`. |

## How it is kept honest

`tests/game/everySpellScales.test.ts` is the structural guard, and it is
**behavioural rather than declarative**: it casts every spell twice on two
characters differing only in spell power and demands the damage differ. Nothing
about it can be satisfied by writing `powerCoefficient` somewhere.

**The spell list is DISCOVERED from the event stream**, not filtered by
`attackTable`. The first version of that test filtered on
`attackTable === 'spell'` and silently skipped every pure DoT — Shadow Word:
Pain, Corruption, Bane of Agony, Siphon Life, Devouring Plague and Consecration
— because a spell that only applies an aura declares no table. Those six are
exactly the spells the periodic rule exists for, so the check covered everything
except the part most likely to be wrong.
