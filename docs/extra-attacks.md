# Extra attacks, and what triggers an effect

Extra attacks are a headline feature of Forever and of Classic, so what counts
as "using a weapon" decides a large part of a warrior's damage. This is the
ruleset owner's rule, written down once.

## A "use" is a swing OR an ability

> Weapon-bound and global effects trigger when you **use that weapon** — a
> swing **or** an ability. Bloodthirst is a main-hand swing for the purpose of
> triggering effects, and so is Rend. Thunder Clap is not, because it does not
> require a melee weapon.

The test is whether the action **goes through a combat table and needs the
weapon**. Not whether the tooltip says "Requires Melee Weapon": Bloodthirst's
does not say it and is a use; Thunder Clap's does not say it and is not.

## Weapon-bound against global

| | Fires from | Examples |
| --- | --- | --- |
| **Weapon-bound** | uses of **that one weapon** | Crusader, Vis'kag, Windfury (main hand), Weaponmaster's sword clause |
| **Global** | any melee use, **either hand** | Hand of Justice |

A main-hand Crusader and an off-hand Crusader are two separate effects with
separate rolls. Windfury is bound to the main hand, so an off-hand use never
triggers it however the character is armed.

## The table

What each effect does with each kind of action, asserted in
`tests/game/weaponUseTriggers.test.ts`:

| Action | MH Crusader | OH Crusader | Windfury | Hand of Justice |
| --- | :-: | :-: | :-: | :-: |
| Main-hand auto swing | ✅ | — | ✅ | ✅ |
| Off-hand auto swing | — | ✅ | — | ✅ |
| Bloodthirst, Mortal Strike, Rend, Heroic Strike, Sunder Armor, … | ✅ | — | ✅ | ✅ |
| **Whirlwind** with Raging Blows, main-hand half | ✅ | — | ✅ | ✅ |
| **Whirlwind** with Raging Blows, off-hand half | — | ✅ | — | ✅ |
| Thunder Clap, Intercept, Charge | — | — | — | — |

**Whirlwind with Raging Blows is the case that shows the whole rule.** It
strikes with both hands, as two separate attacks, so it is a main-hand use AND
an off-hand use — main-hand Crusader, off-hand Crusader and Windfury can all
fire from one cast, and Windfury only from the main-hand half.

## How the engine decides

`isWeaponUse` and `isWeaponUseOf`, in `engine/combat/reactions.ts`.

A reaction only ever sees attacks that **consulted a combat table** and were
**not periodic** — `dealDamage` dispatches no others, so a Rend tick cannot
proc anything. By the time a reaction runs, "went through a combat table" is
already true, and all that is left to ask is which weapon swung.

So the whole test is the **weapon slot**. An ability that needs no weapon does
not name a melee slot: Thunder Clap, Intercept and Charge resolve on the ranged
table with `weaponSlot: 'ranged'`.

| Attack table | Abilities |
| --- | --- |
| `melee-special` | Mortal Strike, Bloodthirst, Slam, Whirlwind, Spearing Strike, Overpower, Revenge, Shield Slam, Hamstring, Execute, Heroic Strike, Cleave, Rend (the cast), Sunder Armor |
| `ranged-special` | Thunder Clap, Intercept, Charge |
| none | the shouts, the stances, Bloodrage, Shield Wall, Shield Block, Death Wish, Last Stand, Sweeping Strikes — these never reach a reaction at all |

## What this corrected

Two of the four effects had the rule wrong, and each had derived it privately
in its own file. The concept existed as a one-line helper in
`game/reactions/warriorTalents.ts` and nothing else could see it.

**Windfury refused every ability.** `if (attack.abilityId !== undefined) return
false` made it an auto-attack-only effect. A warrior takes far more main-hand
*actions* than main-hand *swings* — a slow weapon and a full rotation — so this
was hiding most of the totem:

| Preset | Before | After |
| --- | --- | --- |
| 2H Arms | 558.5 | **605.9** |
| DW Fury | 640.5 | **679.9** |
| Prot Warr | 347.3 | **374.7** |

Windfury's uptime went 7.7% → 16.2% on Arms, 5.7% → 17.7% on Fury and
**1.4% → 15.5%** on the tank, which is the build that casts most and swings
least. Main-hand swings per fight rose from 4.43 to 7.65 there — those are the
extra attacks.

**Hand of Justice accepted any landed attack**, including Thunder Clap,
Intercept and Charge. Worth very little — 2% on roughly eight tank casts a
fight — and the unbuffed baselines did not move outside their intervals. It was
wrong all the same, and it is the same root cause.

**The test that should have caught the Windfury change did not.** It asserted
that Mortal Strike does *not* proc Windfury, and went on passing after the gate
was fixed, because `canTrigger` rolls the 20% chance as its last step and a
live RNG happened to fail it. A `false` meant "refused" *or* "rolled badly".
Every gate test now scripts the roll to succeed, so a false can only be a
refusal.

## What is still open

**Shield Slam.** It is declared main-hand and resolves on the melee table, so
by this rule it is a main-hand use and triggers main-hand Crusader and
Windfury. But its tooltip says *"Requires Shields"*, not *"Requires Melee
Weapon"* — it strikes with the **shield**, which is an off-hand item.

Every other ability treated as a use either states a melee weapon requirement
or was named by the ruleset owner directly. Shield Slam does neither. It is
left as a main-hand use because that is what the model already said, and
changing it quietly would be worse than flagging it. **A question for the
ruleset owner**, and it matters for the tank: Shield Slam is cast about nine
times a fight there.
