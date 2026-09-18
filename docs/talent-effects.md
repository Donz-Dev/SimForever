# Talent effects

How a talent turns into something a simulation can compute, and — more usefully
— every edge case that turned up while making the Warrior's work.

This file is what the code actually does. The design rationale — why declared
data with a narrow escape hatch rather than a function per talent — is in the
proposal on PR #22, which has not been merged.

---

## The shape

A talent declares **what it does** as data. What its **number is** lives
somewhere else entirely:

| | Where | Edited by |
| --- | --- | --- |
| What a talent does | `src/game/talents/warriorEffects.ts` | code |
| What its number is, per rank | `src/data/talents/values/warrior.json` | **by hand** |
| Which talents a character took | the profile, format v5 | the UI |

`talentBuild(class, allocation, context)` resolves those into plain data before
the fight. Nothing below `createPlayer` knows talents exist.

## Effect kinds

Every kind below is used by at least one Warrior talent. An effect kind with no
user is speculation, and would be removed.

| Kind | Does | Example |
| --- | --- | --- |
| `stat` | Adds to a stat | Cruelty, +1% crit per rank |
| `abilityCost` | Reduces one ability's cost | Improved Heroic Strike |
| `abilityCooldown` | Reduces one ability's cooldown | Improved Intercept |
| `abilityCastTime` / `abilityGcd` | Shortens a cast or its GCD | Improved Slam |
| `abilityHoldsSwing` | Stops a cast resetting the swing timer | Improved Slam |
| `abilityCrit` | Crit chance for ONE ability | Improved Overpower |
| `abilityDamage` | Damage multiplier for ONE ability | Improved Rend |
| `critDamageBonus` | Crit damage for every ability | Impale |
| `conditionalDamage` / `conditionalCrit` | Applies only with the right weapon | Two-Handed Weapon Specialization |
| `resourceMax` | Raises a resource cap | Boundless Rage |
| `grantAbility` | Gives an ability the character otherwise lacks | Mortal Strike |
| `abilityBonus` | A named number read by one ability's `onCast` | Improved Charge |
| `reaction` | A proc keyed off an attack result | Deep Wounds, Flurry |
| `unmodelled` | Says why it cannot work yet | Anticipation |

---

## Edge cases

Each of these is a decision that could have gone the other way, and most of them
would have been invisible if they had gone wrong.

### A missing value is not zero

A talent whose rank has no captured value contributes **nothing and reports
itself as unmodelled**. It is never extrapolated from a lower rank — three
Warrior talents break the linear assumption (`improved_rend` is 12, 23, 35), so
a guess would be wrong about 7% of the time and no result could reveal it.

### A conditional talent that does not apply says so

Two-Handed Weapon Specialization with a one-hander equipped reports as not
applying rather than silently contributing nothing. That distinction matters:
it is not a permanent gap, it is a state the person can fix by equipping
something else.

### Ability definitions are copied, never edited

Abilities are module-level constants shared by every character in every
iteration of a Monte Carlo batch. A talent that reduced a cost in place would
leak into characters that never took it, and compound across iterations rather
than showing up on the first. `applyTalentChanges` returns a copy; a test
asserts a fresh talentless warrior still pays full price.

### Percentage stats stay modifiers

Vitality's "+2% Stamina" folded into a flat number would be computed once
against the unbuffed stat and be wrong thereafter. As a modifier it re-derives —
which is why attack power moves when Vitality raises strength, and the test
checks exactly that.

### Auto attacks are not abilities

A swing carries no `abilityId`, so nothing in `AbilityModifiers` touches it,
including the `ALL_ABILITIES` entry. That is what a talent reading "your
abilities" means. A talent that should cover swings — Two-Handed Weapon
Specialization — uses `conditionalDamage`, which is a whole-character
multiplier, precisely because per-ability scaling would miss them.

### A crit multiplier bonus raises the bonus half

Impale's "+10% critical strike damage bonus" on a x2 melee crit gives
1 + (2 − 1) × 1.1 = **x2.1**, not x2.2. Reading it the other way would overstate
every crit in the game by a tenth.

### A damage-over-time tick that cannot crit consumes no random number

`critFrom` is what lets a tick roll for a crit. An effect without it does not
roll at all — so adding the field never shifts the roll sequence of anything
that does not use it, and a seeded run stays reproducible. Tested explicitly.

### A swing charge is spent at the START of a swing

Flurry is applied by a critical strike, mid-swing. If charges were spent after
the swing resolved, the swing that applied the buff would immediately eat one
and only two of the three would be hasted. Spending at the start means the swing
that benefits is the swing that pays.

### Flurry refreshes at full charges

The source says "your next 3 swings", not "up to 3", so a second crit resets the
window rather than topping up a partly spent one.

### Deep Wounds is fixed when it is applied

Its damage is a percentage of the weapon's average damage at the moment of the
crit, not recomputed per tick. The source keys it to the strike that caused it,
and a weapon swap mid-bleed should not retune ticks already scheduled.

### Deep Wounds does not scale with attack power twice

Attack power is already inside "the weapon's average damage" by the universal
formula. Scaling the result again would count it twice, so the tick sets
`powerCoefficient: 0`.

### Shield Slam needs a shield AND the talent

The weapon check runs first, so a warrior who took Shield Slam and put the
shield away still cannot use it.

### An explicit resource override beats a talent

`createPlayer`'s own `resourceMaximums` win over Boundless Rage, so a caller
testing a specific cap is not quietly overruled by a build.

### A talent cannot raise a cap the ruleset does not fix

Boundless Rage adds to rage's fixed 100. A resource whose maximum is derived
from stats — mana — is skipped rather than guessed at, because adding a delta
to a number this layer does not have would mean inventing the base.

### An empty allocation is not a neutral default

From profile v5, empty means a warrior knows **no** Mortal Strike, Bloodthirst
or Shield Slam, because all three are 31-point capstones. A migrated v4 profile
therefore fights weaker than it did — the old number was wrong, not the new one.

### Unbridled Wrath reads the weapon that SWUNG, not the character

"increased to 2 Rage for two-handed weapons" is decided per hit, from the slot
the attack came from. A warrior cannot hold a two-hander and an off-hand at
once, so the distinction is academic today — but reading the slot keeps it right
whatever is equipped, and costs nothing.

This one is also the clearest example of why the unmodelled reasons need
re-reading: it was written off as impossible for want of a weapon type that had
been added to the engine an hour earlier, and only a documentation pass caught
it.

### Nine talents grant an ability, and five of those abilities do not exist

Sweeping Strikes, Death Wish, Piercing Howl, Last Stand and Concussion Blow are
absent from the ability spreadsheet. They declare `grantAbility` anyway, so they
are gated correctly the moment the ability exists rather than being remembered
later. A test asserts all nine are unreachable without their talent, in every
combat style — satisfied either by gating or by not existing, and both count.

---

## Interpretations

Choices the source did not make for us. Each is isolated and cheap to flip.

| Interpretation | Where | If wrong |
| --- | --- | --- |
| **Deep Wounds ticks every 3 seconds.** The interval is not stated; 3s is the cadence every other bleed in the ruleset uses, and 12 divides evenly by it. | `auras/warriorTalents.ts` | One constant. |
| **Deep Wounds triggers on MELEE crits.** "Your critical strikes" is read as melee, checked on the weapon slot rather than the ability, so any melee source counts. | `reactions/warriorTalents.ts` | Change the `canTrigger`. |
| **Flurry's backstop duration is 12 seconds**, and is a `PLACEHOLDER_*`. The swing count is real; the duration is not stated and should never be reached, because charges run out first. | `PLACEHOLDER_FLURRY_DURATION_MS` | One constant. |
| **Impale uses the melee crit multiplier**, because every Warrior ability is melee. A class with spell crits would need this per school. | `talents/talentBuild.ts` | Make the bonus per damage school. |
| **Slam is worth casting only when it does not cost a swing.** A rotation heuristic, not ruleset data. The entry asks the ability whether it holds the swing, so the talent stays the thing that changed it. | `rotations/warrior.ts` | Change or remove the condition. |

---

## Still partly modelled

Talents that do something real and flag what is missing. They are listed here
because a partly-modelled talent is the easiest kind to forget.

| Talent | Works | Missing |
| --- | --- | --- |
| **Weaponmaster** | The axe and polearm crit bonus | The mace and staff clause ignores a percentage of the target's armor, which the damage pipeline cannot express; the sword clause needs a reaction that triggers an extra attack. `extraAttack` exists but no talent is wired to it, and the effect would need to read the talent's THIRD value rather than its first. |
| **Improved Revenge** | The damage scaling | Revenge needs the player to be attacked to open its window, and nothing attacks the player. |
| **The five ability grants** | The gate | The abilities themselves are not implemented. |

**Deliberately not partly modelled:**

- **Dual Wield Specialization** — off-hand damage, off-hand rage generation and
  off-hand hit chance. Hit chance is a whole-character stat here and rage
  generation has no per-hand term, so modelling one third would understate it by
  an unknown amount rather than visibly not working.
- **Raging Blows** — gives Whirlwind an off-hand strike, which its `onCast` does
  not do, and also reduces Cleave's cost. The second half alone is not the
  talent.

---

## Things that will need re-reading

**The classification has been wrong twice already.** Improved Rend and Improved
Overpower were both filed as impossible before per-ability scaling existed, and
Unbridled Wrath's two-handed clause was written off as needing a weapon type
that had been added an hour earlier.

So: when a blocker in [HANDOVER.md](../HANDOVER.md) clears, re-read every
`unmodelled` reason rather than trusting it. The reasons are specific enough to
check quickly, which is the point of writing them that way.
