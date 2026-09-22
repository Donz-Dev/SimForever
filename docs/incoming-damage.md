# The encounter that hits back

Turning on **Target attacks back** does not just add a damage source. It
replaces the whole model of what happens to the character, and three separate
mechanisms arrive together:

| | |
| --- | --- |
| **A ramp** | The target opens at 5,000 a swing and each swing is 10% harder than the last, compounding. |
| **A healer** | A random 500 to 1,500 every second, from nobody. Raises current health to a maximum of maximum health. |
| **Death** | At zero health the character dies, is restored to full, and the fight carries on. It happens many times a fight, and the deaths are counted. |

All three are the ruleset owner's figures for how this encounter is set up.
**None of them is Forever ruleset data**, and nothing in the source states any
of them — they are in the same category as fight length and its variance:
modelling choices about the scenario rather than rules about the game.

## Why it ramps

A flat 5,000 every two seconds is a fight the character either survives
comfortably for its whole length or dies in immediately, and neither teaches
anything. Worse, the interesting half of the Protection tree — everything keyed
on being hurt, on blocking, on being close to death — either always fires or
never does.

A ramp guarantees the fight goes from comfortable to impossible, so every one
of those thresholds is crossed exactly once per fight, in order. The question
stops being "does the character survive" and becomes "how far in did it get",
which is a number.

**Compounding, not linear.** "Increased by 10%" applied to a figure that has
already been increased. Swing one is 5,000, swing two 5,500, swing three 6,050.
Thirty swings into a sixty second fight the target is hitting seventeen times as
hard as it started.

### How the ramp is built

A stacking permanent buff on the target, `Mounting Fury`, with
`modifiersScaleWithStacks` — which raises its 1.1 multiplier to the power of
the stack count, and is exactly the compounding the rule describes.

A **reaction** adds the stack, on the target's own swing, for every outcome
including a miss. Two consequences follow from that and both are deliberate:

- **The first swing is unramped.** Reactions run after the damage has landed
  and been reported, so the swing that adds the stack is not the swing that
  benefits from it.
- **An avoided swing still counts.** A swing the tank dodged is still a swing.
  Keying the ramp on damage LANDING would let a tank freeze it by avoiding
  well, which is the opposite of the point, and would make an avoidance talent
  read as a damage reduction several times its real size.

An aura rather than a counter, for the usual reason: it is then in the
telemetry, visible in the combat log, and read by the same `damageDoneMultiplier`
every other damage buff goes through. A private field would work and nobody
could audit it.

## Why the healer is not a combatant

A raid healer is a character with a spell book, a mana pool and a rotation, and
none of that exists. What this needs from a healer is only its output, so the
output is what it models: a flat random amount on a timer with nothing behind
it, carried as a permanent aura on the character being healed.

Adding a real one would put a third actor in every breakdown, give the target
something else to swing at, and change what "everyone on this side is dead"
means — all to produce a number that a periodic aura produces directly.

**It only exists when the target attacks.** A character nothing is hitting has
nothing to heal, and a fight's worth of pure overhealing in the log is noise.

### The source problem

A heal needs a source: telemetry is attributed, and a request with no source
could not be reported at all. An assumed healer has nobody to name, so the
character being healed is named as the source of their own heal.

That stand-in would quietly scale the incoming heal by the **tank's** healing
done and versatility, which is nonsense. `HealRequest.external` says the amount
is the whole answer and nothing about the nominal source scales it. A warrior
has neither of those stats today, so the bug would be worth exactly zero until
the day something granted one.

Crusader's heal deliberately does NOT set the flag: that one genuinely comes
from the character's own enchant, so anything that ever raises their healing
done should raise it too.

## Dying, and standing back up

`Combatant.revivesOnDeath` is the **other answer** to the question
`survivesLethalDamage` answers, and the two are mutually exclusive.

| | |
| --- | --- |
| `survivesLethalDamage` | Health never reaches zero. Nothing dies, so a death cannot be counted. |
| `revivesOnDeath` | The character dies, it is RECORDED, and they are stood back up at full health. |

The character used to carry the first one, and the Encounter panel said so: "the
character cannot die, so nothing here says whether they would survive". That
kept the fight running at the price of making the interesting question
unanswerable — a tank at 1 health and a tank at full looked identical, and "how
close was that" had no answer at all.

The target still carries `survivesLethalDamage`, because it genuinely is a
damage sink rather than something with a health bar to get through.

### What a revive does and does not do

**It does not mark the character dead, even for an instant.** Marking them
would make every `isAlive` check between the death and the revive read false,
which inside one tick of the event loop cancels their own swing timers and
skips the reactions the killing blow was meant to trigger.

**It does not drop auras**, unlike a real death. Survival is what is being
measured, not a death-and-rebuff cycle, and dropping them would switch off the
healer at the exact moment it is needed. This is a modelling choice and a
defensible thing for the ruleset owner to change.

**It does not touch the encounter.** The ramp keeps climbing straight through a
death, which is the ruleset owner's rule and the reason a death is not a fresh
pull: a ramp that reset would hand a character an easier fight for dying.

It is still not a survival model. Something is putting the character back on
their feet and nothing in the ruleset says what. What it gives is a count of
how often the encounter as configured would have killed them.

## What the results show

`BatchSurvival` — deaths, damage taken, healing received and overhealing, all
as per-iteration means, above the damage-taken table.

**Deaths are a mean with decimals, not a yes or no.** A build that dies on nine
fights in ten reads 0.9, and one the encounter overruns reads twenty. Healing
sits beside it because damage taken alone says nothing: 300,000 over a minute
is fine or fatal depending entirely on what came back the other way.

**Overhealing will dwarf healing received** in any fight the ramp wins. Once a
single swing exceeds the whole health pool the character spends their time at
full — a revive fills the bar — so the healer's output lands on a full one.
That is not a bug in the healer; it is what the late fight looks like.

## What it did to the numbers

Measured over 400 fights a row with `tools/measure_rotation.ts`, against the
same build immediately before the change:

| Build | Before | After |
| --- | --- | --- |
| Dual-wield / Berserker, attacked | 294.54 | **357.22** |
| 1H & Shield Protection, attacked | 141.87 | **158.61** |

Standing-target rows are unchanged, as they must be: none of this exists in a
fight the target does not swing in.

**The gain is rage, not damage.** Rage from damage taken is proportional to the
damage, and the ramp makes the damage enormous — a tank in the late fight
generates several times the rage they can spend. On the default tank build,
**rage wasted at the cap is about four times rage gained**. That is a real
consequence of the configuration rather than a bug, and it means the back half
of a ramped fight is not a rage-constrained rotation at all.

## What this unblocked

Crusader's heal. Its `unmodelled` reason read *"Nothing damages the player, so a
heal would restore nothing"* — true on the day it was written, and false from
the day the target started killing people. Both its figures (75 to 125) are its
own tooltip, so nothing had to be invented; the enchant is now fully simulated
and the "Equipped but not simulated" list for the starting set is empty.

That is the second time a reason has expired without anyone noticing. A reason
is a claim about the engine at a point in time, and **clearing a blocker is not
finished until every reason naming it has been re-read.**
