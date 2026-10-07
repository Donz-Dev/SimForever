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

## An extra SWING and an extra SPECIAL ATTACK are different effects

Both are described as "extra attacks" and only one is a swing. The ruleset owner
separated Windfury Weapon from Windfury Totem on 2026-10-07, and the imbue had
been built on the totem's shape until then.

| | an extra SWING | an extra SPECIAL ATTACK |
| --- | --- | --- |
| who | Windfury **Totem**, Hand of Justice, Weaponmaster's sword clause | Windfury **Weapon**, the imbue |
| built with | `extraAttack` | content's own `dealDamage`, scheduled |
| the swing timer | **restarted**, on the owner's ruling — see below | **untouched** |
| combat table | `melee-auto`: one roll, and a **glancing blow** | `melee-special`: two rolls, **no glance** |
| extra attack power | a short **AURA**, so it also pays anything else landing inside it | `weaponScaling.bonusAttackPower`, **in the hits** |
| reported as | "Main Hand Auto-Attack" | its own row |

**EVERY ONE OF THOSE FOUR DIFFERENCES WAS WRONG IN THE SAME DIRECTION, and none
was visible.** Measured on the Enhancement Shaman: the glancing blows cost 15.8
DPS, the attack power arriving as a window instead of in the hits cost 18.8, the
timer reset threw away about one real swing a fight, and 15.9% of the build's
damage — its second-largest source — was hidden inside the auto-attack row with
the shares still summing to 100%. Net **+21.8** once the window's incidental
payments are netted off.

## The restarted swing timer is a RULING, and it reads as a bug

**The ruleset owner, 2026-10-07:** "an extra attack from Reckoning is exactly
the same as the other extra attacks — like from Hand of Justice. It will trigger
an auto-attack and reset the swing timer."

So `extraAttack` ending with a full fresh `scheduleSwing` is correct, every
caller is the same, and **there is no special case for a proc triggered by
damage TAKEN** rather than by the attacker's own swing.

**WHY IT KEEPS LOOKING WRONG.** For a proc that fires from inside the attacker's
own swing — Hand of Justice, Windfury Totem — the reset is invisible: the original
handler has already scheduled its successor one whole timer out, so rescheduling
to the same instant changes nothing. The Paladin's **Reckoning** fires from a
BLOCK or a CRIT TAKEN, at a moment with no relationship to the swing cadence, so
there the reset is real and visible. That asymmetry is what makes the line look
like an oversight, and a change to preserve the pending swing's due time was
written and reverted on this ruling.

**IT WAS MEASURED BEFORE IT WAS RULED ON, AND THE MEASUREMENT AGREED**:
Reckoning delivers 3.77 extra swings a fight against an expectation of 3.62, so
nothing was missing. `tests/engine/extraAttackSwingTimer.test.ts` pins the rule,
because nothing about `scheduleSwing(full timer)` announces that it is meant.

**THE LOCK IS WHY THE SPECIAL ATTACKS ARE SCHEDULED RATHER THAN DEALT INLINE.**
`runReactions` claims a per-actor re-entry lock, so `dealDamage` called from
inside a reaction reaches no `dealt` reaction at all — Maelstrom Weapon would
never see these, and the owner has said it must. One `events.schedule` at the
current timestamp puts them back on the ordinary path, which is the same reason
`extraAttack` schedules instead of running inline.

**THE TOTEM IS DELIBERATELY NOT CHANGED.** `buffs/windfury.ts` still applies a
1.5-second +246 attack power window and still asks for a real swing, because the
owner stated that one directly. The two are the same effect at different
strengths and **must not be made to match** — which is easy to get wrong in
exactly one direction, by tidying the totem to look like the imbue.

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

## Shield Slam, settled

> **Shield Slam can trigger main hand effects.**

The ruleset owner, asked directly. It was the one ability the rule above did
not settle by itself: it is declared main-hand and resolves on the melee table,
so it reads as a main-hand use — but its tooltip says *"Requires Shields"*, not
*"Requires Melee Weapon"*, and it strikes with the **shield**, an off-hand
item. Every other ability treated as a use either states a melee weapon
requirement or was named by the owner directly.

It triggers main-hand Crusader and Windfury, which is what the code already
did. Nothing changed; the reason it does it is written down now.

It is not a marginal case — the tank casts Shield Slam about nine times a
fight.

## When an ability's proc behaviour is in question, ASK

The ruleset owner's standing instruction, given with the Shield Slam answer:

> If an ability being able to proc effects is in question, ask me.

This is cheap to follow and the alternative is expensive. A wrong answer here
does not look wrong: Windfury spent its whole life refusing abilities and every
figure the simulator produced was self-consistent and too low. There is no
symptom to notice, because a proc that never fires leaves nothing behind.

The rule above decides most abilities on its own. Where it does not — an
ability that goes through a combat table but whose weapon requirement is
unclear, as Shield Slam's was — that is the question to bring.
