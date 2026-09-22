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

### Off the global cooldown means two things

Both halves matter, and having only the first is a bug that is easy to miss:

1. Using the ability does not **start** a global cooldown.
2. The ability is not **blocked** by one that is already running.

Shield Block goes out while a Sunder Armor global cooldown is still ticking.
That is the whole point of it being off the global cooldown, and a rotation
built on the first half alone would still be waiting.

`checkCast` enforces (2) and `castAbility` enforces (1), and both read the
same `triggersGcd(ability)` so they cannot disagree.

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

A hasted global cooldown is floored at `MINIMUM_GCD_MS`, 750ms — and the floor
can never *raise* a global cooldown that is already shorter than it, which a
naive `Math.max` would do to a Rogue at 1.0 seconds the moment haste was
involved.

Whether Forever hastes the physical global cooldown at all is **not stated**,
and the current behaviour — that it does, via `affectedByHaste` defaulting to
true — is an inherited assumption rather than a ruleset fact. Worth confirming.

## What this changed when it was written down

Writing the rule out found three abilities disagreeing with it:

- **Heroic Strike and Cleave** were taking a global cooldown they should not.
- **Bloodrage and Charge** were too.

All four had been that way since they were written, and none of them looked
broken: they cost the right resource, dealt the right damage and appeared in
the right place in a breakdown. The only symptom was a rotation getting
slightly fewer actions than it should, which is invisible without something to
compare against.
