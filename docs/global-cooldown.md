# The global cooldown

Every action a character takes occupies it for a moment, and nothing else can
be started in that moment. It is the budget the whole game is played against:
a rotation is a decision about what to spend global cooldowns on, and an
ability that does not cost one is not competing for the same thing at all.

## The rule

> Every action, unless otherwise specified, triggers a **1.5 second** global
> cooldown before another action can be taken. For a **Rogue**, and for a
> **Druid in Cat Form**, it is **1.0 second** instead.

Given by the ruleset owner. It applies to every class.

## The exceptions

Four, and each is a different kind of thing.

| | |
| --- | --- |
| **Auto attacks** | Never on the global cooldown, because they are not actions. They run on their own timers and nothing chooses them. |
| **On-next-swing abilities** | Heroic Strike and Cleave. They are *armed*, not cast: they replace the next swing when it lands. |
| **Bloodrage, Shield Block, Charge** | Named by the ruleset owner. Three Warrior abilities that simply do not cost one. |
| **Warrior stances** | Not on the global cooldown, but they share a **1 second cooldown among the three**. |

### Off the global cooldown means one thing, not two

> **Off the global cooldown means the ability does not START one. It is still
> BLOCKED by one already running.**

The ruleset owner's ruling, and it is the narrower of the two readings.
A running global cooldown blocks everything, without exception.

So Shield Block still waits its turn to go out — and what being off the global
cooldown buys is that the action **after** it is free. Cast Shield Block and
Shield Slam follows immediately rather than 1.5 seconds later. That is why
Shield Block can sit above Shield Slam in the tank list without costing it a
strike.

`castAbility` reads `triggersGcd(ability)` to decide whether to start one.
`checkCast` does not consult it at all: it refuses anything while
`caster.isOnGcd(now)`.

### On-next-swing is derived, not declared

`triggersGcd` defaults to `onNextSwing === undefined`. Heroic Strike does not
say `triggersGcd: false`; it says `onNextSwing: 'mainHand'`, and the rule
follows from that.

This is deliberate. Writing the flag on each one would mean a new on-next-swing
ability needs someone to remember it, and the failure would be silent — the
ability would work, cost the right rage, deal the right damage, and quietly
eat a global cooldown it should not. An ability that genuinely wants both can
still say `triggersGcd: true`.

Arming Heroic Strike costing nothing from the action budget is what makes it
the place surplus rage goes. A rotation that had to choose between Heroic
Strike and Bloodthirst would be a different rotation.

### Stances are a separate mechanism

A stance change is off the global cooldown *and* on a one second cooldown
shared by all three, which is `cooldownGroup: 'warrior_stance'` rather than
anything to do with the global cooldown. Without the shared cooldown a warrior
could go Berserker → Defensive → Battle without the clock moving, because no
two of those casts are the same ability.

## Where it lives

**How long** a global cooldown is belongs to the class, so it sits on the
combatant as `baseGcdMs` and arrives from `game/character/globalCooldown.ts`.
The same ability costs a Rogue one second and a Warrior one and a half, so it
cannot be a property of the ability.

**Whether** an ability triggers one belongs to the ability, as `triggersGcd`.

The engine keeps `DEFAULT_GCD_MS = 1500` as a fallback for an actor built
without a class — in practice a training dummy. It is not the rule; the rule
is in the game layer, where every other ruleset number is.

The Druid clause is per **form**, not per class: Bear Form is on the ordinary
1.5 and only Cat is quickened, which is why `globalCooldownFor` takes a combat
style as well as a class.

## Haste

> **Haste does not affect the global cooldown.**

The ruleset owner's ruling. `gcdLength` takes no haste multiplier at all,
rather than taking one and ignoring it — a parameter nothing reads is an
invitation to start reading it.

`affectedByHaste` still governs **cast time**, which is a different question
with a different answer: a hasted Slam casts faster, and the global cooldown
it costs is 1.5 seconds either way.

`MINIMUM_GCD_MS` (750ms) still exists, and no longer has anything to do with
haste. It is the floor for a **talent** that shortens the global cooldown —
Improved Slam is the one — so a stack of reductions cannot reach zero.

## What this changed when it was written down

Writing the rule out found four abilities disagreeing with it. **Heroic
Strike, Cleave, Bloodrage and Charge** were all taking a global cooldown they
should not, and had been since they were written.

None of them looked broken: they cost the right resource, dealt the right
damage and appeared in the right place in a breakdown. The only symptom was a
rotation getting slightly fewer actions than it should, which is invisible
without something to compare against.

Two further things were settled by asking rather than assumed:

- Whether an off-GCD ability is blocked by a running global cooldown. The
  first implementation said no; the ruling is **yes**.
- Whether haste shortens the global cooldown. The inherited behaviour said
  yes; the ruling is **no**.

Both had been decided by whoever wrote the code first, which is exactly the
kind of thing this document exists to stop.
