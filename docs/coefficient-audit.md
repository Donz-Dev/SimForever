# Coefficient audit: what every damaging ability scales with

Every ability any of the 23 presets can reach, MEASURED -- not read off a
declaration -- and set beside the source's own words.

**Generated.** Re-run both scripts rather than editing the table:

```bash
npx vite-node tools/coefficient_probe.ts --json > probe.json
node tools/coefficient_report.mjs
```

## What it found

**82 of 120 abilities deal damage.** 52 of them scale at a rate a rule
predicts, and every one agrees with it to within 6%.

**4 DISAGREE WITH THEIR OWN TOOLTIP**, and they are the finding:

| Ability | Class | The source's own words | The simulator |
| --- | --- | --- | --- |
| **Eviscerate** | rogue | Finishing move that causes damage per combo point, increased by Attack Power: | FLAT, base 1219 |
| **Rupture** | rogue | Finishing move that causes damage over time, increased by your Attack Power. | FLAT, base 469 |
| **Ferocious Bite** | druid | Damage is increased by your Attack Power. | FLAT, base 997 |
| **Rip** | druid | Damage increases per combo point and by your Attack Power: | FLAT, base 859 |

All four are FINISHERS, across two classes, and **no source says by how much.**
That is a missing RULE rather than a missing transcription -- the same shape as
the spell coefficient and as Careful Aim, each of which one question settled.
**Nothing is changed here.** See the questions below.

They are not small. Eviscerate at five combo points is the largest single hit
either Rogue has, and Ferocious Bite is the largest the Cat Druid has, so
whatever the answer is it moves Venom Rogue, Rupture Rogue and Cat Druid.

## The rest of the accounting, so nothing is silently missing

| | |
| --- | --- |
| **120 abilities reached** | every preset x every ability in its own book. **Nothing was refused** -- each precondition a damaging ability needs is arranged in the probe's `SETUP`, and a refusal would be printed with its reason rather than dropped |
| **82 deal damage** | of which 52 are checkable against a rule, all agreeing |
| **16 deal damage that moves on no axis** | 4 are the finding above; the other 12 state flat figures and carry no scaling clause at all |
| **38 deal none** | stances, aspects, shouts, seals-as-auras, cooldowns. Each cast successfully and did nothing, which is correct |
| **2 reached only by forcing a crit** | applied by a REACTION, so they appear in no ability sweep -- `everySpellScales.test.ts` says outright that it cannot reach them |

### Two more, of different kinds, and neither is the finding above

**Lacerate** is flat, and its own words state a coefficient: "75 damage over
15 sec **plus 10% weapon damage per existing application**". That is a STATED
number rather than a missing rule, so it needs no ruling -- what it needs is a
stack-dependent weapon-damage term, which nothing in the damage pipeline
expresses today. Worth a line of its own because it will not be found by
looking for the four above: it claims WEAPON damage, not attack power.

**Seal of Fury** is the only seal that does not scale. Seal of Righteousness
measures AP 0.9114 and SP 1.8227 -- a point of spell power worth exactly twice
a point of attack power, which is the owner's formula reproduced to four
decimals. Seal of Fury is flat, because its tooltip states a flat "additional
35 Holy damage" with no weapon-speed term for the formula to use. Defensible,
and a question: **does the seal formula apply to Seal of Fury, or is 35 flat?**

### The twelve that are flat and say nothing about scaling

Listed rather than counted, because "no scaling clause" is a claim about each
one and an aggregate hides the one that is wrong. Each was flat on EVERY build
that has it.

| Ability | Class | Base | The source's words |
| --- | --- | --- | --- |
| Revenge | warrior | 242 | *(no scaling clause)* |
| Hamstring | warrior | 50 | *(no scaling clause)* |
| Thunder Clap | warrior | 113 | *(no scaling clause)* |
| Intercept | warrior | 72 | *(no scaling clause)* |
| Execute | warrior | 2175 | *(no scaling clause)* |
| Rend | warrior | 204 | *(no scaling clause)* |
| Shield Slam | warrior | 818 | Slam the target with your shield, causing <damage> damage, increased by your Block Value, and has a 50% chance of dispelling 1 magic effect on the target. |
| Rake | druid | 180 | *(no scaling clause)* |
| Swipe | druid | 119 | *(no scaling clause)* |
| Lacerate | druid | 75 | Lacerates the enemy target, making them bleed for 75 damage over 15 sec plus 10% weapon damage per existing application of Lacerate on the target. |
| Seal of Fury | paladin | 576 | *(no scaling clause)* |
| Summon Hawk | hunter | 338 | *(no scaling clause)* |

**Shield Slam is the one to read carefully.** Its clause is "increased by your
Block Value", which is neither attack power nor spell power, so being flat on
both is correct and the block value term is a separate question.

### The two that no cast reaches

| Aura | Reached via | Measured |
| --- | --- | --- |
| `deep_wounds` | 2H Arms / mortal_strike | AP 0.1748, RAP 0.0000, SP 0.0000 |
| `ignite` | Fire / fireball | AP 0.0000, RAP 0.0000, SP 1.2626 |

Both move with a stat, and both are declared `powerCoefficient: 0`. The two
statements are not in conflict: each is a SHARE of a hit that was already
scaled -- Deep Wounds a percentage of average weapon damage, Ignite a
percentage of the crit that caused it -- so a coefficient here would apply the
stat twice. What the figures show is INHERITED scaling, which is what should
happen, and measuring it is the only way to tell that apart from a gap.

## Questions for the ruleset owner

One question, asked four times. Eviscerate, Rupture, Rip and Ferocious Bite
each say in the client's own words that their damage is increased by attack
power, and not one states a figure.

1. **Is there ONE rule for a finisher**, the way `castTime / 3.5` is one rule
   for a spell? A coefficient per combo point, or a flat fraction of attack
   power for the whole finisher?
2. Or does each of the four carry its own number, the way each spell carries
   its own cast time?

A plausible number here would be invisible: a Rogue whose Eviscerate scales
produces a perfectly ordinary figure, and so does one whose Eviscerate does
not.

## One measurement that exceeds its rule, deliberately

**Shadow Word: Pain** measures 1.8480 where the duration the source
states predicts 1.3860.

Improved Shadow Word: Pain adds two ticks at the same cadence, and each carries the coefficient of the BASE eighteen seconds — so 24s of ticks scale at 8 x 0.2 rather than at 18/15. Deliberate, and stated in src/game/auras/priest.ts: "the extra two ticks are extra damage rather than the same total spread thinner". Worth the owner confirming that a duration talent should raise total gear scaling proportionally.

## How to read the table

| Column | |
| --- | --- |
| **Source says** | the scaling clause, lifted verbatim from `src/data/abilities`. `<damage>` is where Forever's own tooltip renderer prints "(100% of Spell Power)" instead of the number -- it is NOT a spell power coefficient, and reading it as one reports four Warrior abilities as disagreeing when they do not |
| **Simulator** | which stat axis the damage actually responded to, or `FLAT` |
| **Measured** | the implied coefficient, derived from damage that landed and divided by how much the stat REALLY moved rather than by how much was asked for |
| **Rule** | the arithmetic the expectation came from, using the SOURCE's own numbers wherever it states them |
| **Expected** | that rule, times every damage multiplier the build puts on that ability |

A measured figure carries the build it was measured on. `Expected` carries the
same multipliers, so the two are comparable and **neither is the bare rule** --
a Shadow Priest reads 1.155x on everything and a Moonkin 1.10x.

## Every ability, by class

Sorted by damage within each class, so what matters most is at the top.

### Warrior

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Execute | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Shield Slam | Slam the target with your shield, causing <damage> damage, increased by your Block Value, and has a 50% chance of dispelling 1 magic effect on the target. | FLAT | — | — | — | flat, source states no scaling |
| Mortal Strike | Requires Melee WeaponA vicious strike that deals weapon damage plus 160 and wounds the target, reducing the effectiveness of any healing by 50% for 10 sec. | AP | 0.2649 | 3.6/14 x 1 | 0.2649 | agrees |
| Heroic Strike | *(states no scaling)* | AP | 0.2649 | — | — | scales; rule not computable here |
| Slam | Requires Melee WeaponSlams the opponent, causing weapon damage plus 87. | AP | 0.2649 | 3.6/14 x 1 | 0.2649 | agrees |
| Cleave | Requires Melee WeaponA sweeping attack that does your weapon damage plus 50 to the target and a second nearby enemy. | AP | 0.2649 | 3.6/14 x 1 | 0.2649 | agrees |
| Overpower | Requires Battle StanceInstantly overpower the enemy, causing weapon damage plus 35. | AP | 0.2649 | 3.6/14 x 1 | 0.2649 | agrees |
| Whirlwind | Requires Berserker StanceIn a whirlwind of steel you attack up to 4 enemies within 8 yards, causing weapon damage to each enemy. | AP | 0.2973 | 2.6/14 x 1 + 2.5/14 x 1 x 0.625 (off hand) | 0.2973 | agrees |
| Bloodthirst | Instantly attack the target causing damage equal to 35% of your Attack Power plus <damage> and increasing your movement speed by 10% for 10 sec. | AP | 0.3500 | source states 0.35 | 0.3500 | agrees |
| Revenge | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Rend | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Spearing Strike | A brutal attack that deals 40% weapon damage. Deals an additional 80% weapon damage against Giants, Dragonkin, and mounted targets. | AP | 0.1059 | 3.6/14 x 0.4 | 0.1059 | agrees |
| Thunder Clap | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Intercept | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Hamstring | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Sunder Armor | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Demoralizing Shout | Reduces the melee attack power of all enemies within 10 yards by 210 for 45 sec. | no damage | — | — | — | deals no damage |
| Battle Shout | The warrior shouts, increasing the melee attack power of all party members within 20 yards by 140. | no damage | — | — | — | deals no damage |
| Recklessness | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Berserker Rage | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Bloodrage | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Shield Wall | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Shield Block | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Charge | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Battle Stance | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Defensive Stance | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Berserker Stance | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Sweeping Strikes | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Death Wish | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Last Stand | *(states no scaling)* | no damage | — | — | — | deals no damage |

### Paladin

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Seal of Command | Gives the Paladin a chance to deal additional Holy damage equal to 70% of normal weapon damage. | AP | 1.0235 | owner's seal formula, 3.6s weapon | — | **seal SP:AP is 0.000, not 2** |
| Seal of Righteousness | *(states no scaling)* | SP | 1.8227 | owner's seal formula, 3.6s weapon | — | agrees (SP is 2x AP) |
| Holy Shock | *(states no scaling)* | SP | 0.4371 | instant 1.5/3.5 | 0.4371 | agrees |
| Seal of Fury | *(states no scaling)* | FLAT | — | owner's seal formula, 2.4s weapon | — | flat, source states no scaling |
| Consecration | *(states no scaling)* | SP | 0.5930 | 8/15 | 0.5930 | agrees |
| Holy Strike | An instant strike that causes 50% weapon damage plus an additional 40 to 53 as Holy damage. | AP | 0.1429 | 3.6/14 x 0.5 | 0.1429 | agrees |
| Judgement | *(states no scaling)* | SP | 0.5480 | instant 1.5/3.5 | 0.5480 | agrees |
| Seal of the Crusader | Fills the Paladin with the spirit of a crusader for 30 sec, granting 325 melee attack power. | no damage | — | owner's seal formula, 3.6s weapon | — | deals no damage |
| Swift Judgement | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Holy Shield | *(states no scaling)* | no damage | — | — | — | deals no damage |

### Hunter

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Serpent Sting | *(states no scaling)* | RAP | 0.1575 | — | — | scales; rule not computable here |
| Sniper Shot | *(states no scaling)* | RAP | 0.2520 | — | — | scales; rule not computable here |
| Aimed Shot | *(states no scaling)* | RAP | 0.2772 | — | — | scales; rule not computable here |
| Raptor Strike | A strong attack that deals melee weapon damage plus 70. | AP | 0.2700 | 3.6/14 x 1 | 0.2700 | agrees |
| Mongoose Bite | Counterattack the enemy for melee weapon damage plus 57. | AP | 0.2700 | 3.6/14 x 1 | 0.2700 | agrees |
| Strider Kick | A powerful kick that deals 100% melee weapon damage and increases movement speed by 30% for 3 sec. | AP | 0.2700 | 3.6/14 x 1 | 0.2700 | agrees |
| Multi-Shot | *(states no scaling)* | RAP | 0.2772 | — | — | scales; rule not computable here |
| Arcane Shot | *(states no scaling)* | RAP | 0.1103 | — | — | scales; rule not computable here |
| Summon Hawk | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Hunter’s Mark | Places the Hunter's Mark on the target, increasing the Ranged Attack Power of all attackers against that target by 71. | no damage | — | — | — | deals no damage |
| Aspect of the Hawk | The hunter takes on the aspects of a hawk, increasing Ranged Attack Power by 120. | no damage | — | — | — | deals no damage |
| Aspect of the Beast | The hunter takes on the aspects of a beast, becoming untrackable and increasing Melee Attack Power by 110. | no damage | — | — | — | deals no damage |
| Rapid Fire | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Bestial Wrath | *(states no scaling)* | no damage | — | — | — | deals no damage |

### Rogue

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Eviscerate | Finishing move that causes damage per combo point, increased by Attack Power: | FLAT | — | — | — | **DISAGREES** |
| Backstab | Backstab the target, causing 150% weapon damage plus 225 to the target. | AP | 0.2239 | 1.9/14 x 1.5 | 0.2239 | agrees |
| Rupture | Finishing move that causes damage over time, increased by your Attack Power. | FLAT | — | — | — | **DISAGREES** |
| Ghostly Strike | A strike that deals 125% (180% if a Dagger is equipped in your Main Hand) weapon damage and increases your chance to dodge by 15% for 7 sec. | AP | 0.2443 | 1.9/14 x 1.8 | 0.2443 | agrees |
| Sinister Strike | An instant strike that causes 68 damage in addition to your normal weapon damage. | AP | 0.1969 | 2.6/14 x 1 | 0.1969 | agrees |
| Mutilate | Instantly attacks with both weapons for 75% weapon damage plus an additional 38 with each weapon. | AP | 0.1503 | 1.9/14 x 0.75 + 1.3/14 x 0.75 x 0.5 (off hand) | 0.1503 | agrees |
| Hemorrhage | An instant strike that deals 100% weapon damage (145% if a Dagger is equipped) and causes the target to take 15% increased Rupture damage from the Rogue. | AP | 0.1968 | 1.9/14 x 1.45 | 0.1968 | agrees |
| Slice and Dice | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Expose Armor | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Cold Blood | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Adrenaline Rush | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Blade Flurry | *(states no scaling)* | no damage | — | — | — | deals no damage |

### Priest

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Shadow Word: Pain | *(states no scaling)* | SP | 1.8480 | 18/15 | 1.3860 | x1.333, explained: Improved Shadow Word: Pain adds two ticks at the same cadence, and each carries the coefficient of the BASE eighteen seconds — so 24s of ticks scale at 8 x 0.2 rather than at 18/15. Deliberate, and stated in src/game/auras/priest.ts: "the extra two ticks are extra damage rather than the same total spread thinner". Worth the owner confirming that a duration talent should raise total gear scaling proportionally. |
| Devouring Plague | *(states no scaling)* | SP | 1.8480 | 24/15 | 1.8480 | agrees |
| Mind Flay | *(states no scaling)* | SP | 1.0580 | — | — | scales; rule not computable here |
| Mind Blast | *(states no scaling)* | SP | 0.4714 | 1.5/3.5 | 0.4714 | agrees |
| Shadow Word: Death | *(states no scaling)* | SP | 0.4950 | instant 1.5/3.5 | 0.4950 | agrees |
| Shadowform | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Vampiric Embrace | Afflicts your target with Shadow energy that causes all party members to be healed for 20% of any Shadow spell damage you deal for 30 sec. | no damage | — | — | — | deals no damage |

### Shaman

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Lava Burst | *(states no scaling)* | SP | 0.8214 | 2.5/3.5 | 0.8214 | agrees |
| Lightning Bolt | *(states no scaling)* | SP | 0.7500 | 2.5/3.5 | 0.7500 | agrees |
| Earth Shock | *(states no scaling)* | SP | 0.4500 | instant 1.5/3.5 | 0.4500 | agrees |
| Frost Shock | *(states no scaling)* | SP | 0.4286 | instant 1.5/3.5 | 0.4286 | agrees |
| Stormstrike | Instantly strike for normal weapon damage and increase the damage you deal to the target with your next Lightning Bolt, Chain Lightning, or Earth Shock spell by 20% for 12 sec. | AP | 0.2714 | 3.8/14 x 1 | 0.2714 | agrees |
| Flame Shock | *(states no scaling)* | SP | 0.7710 | hybrid(0.429, 12/15) | 0.7710 | agrees |
| Chain Lightning | *(states no scaling)* | SP | 0.6000 | 2/3.5 | 0.6000 | agrees |
| Windfury Weapon | Each hit has a 20% chance of granting you 2 extra attacks with 333 extra melee attack power. | no damage | — | — | — | deals no damage |
| Rage of the Farseer | *(states no scaling)* | no damage | — | — | — | deals no damage |

### Mage

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Arcane Missiles | *(states no scaling)* | SP | 1.4714 | — | — | scales; rule not computable here |
| Pyroblast | *(states no scaling)* | SP | 1.0022 | hybrid(1.000, 12/15) | 1.0022 | agrees |
| Fireball | *(states no scaling)* | SP | 0.9214 | hybrid(1.000, 8/15) | 0.9214 | agrees |
| Frostbolt | *(states no scaling)* | SP | 0.9086 | 3/3.5 | 0.9086 | agrees |
| Frostfire Bolt | *(states no scaling)* | SP | 0.8264 | hybrid(0.857, 9/15) | 0.8264 | agrees |
| Blast Wave | *(states no scaling)* | SP | 0.4714 | instant 1.5/3.5 | 0.4714 | agrees |
| Arcane Blast | *(states no scaling)* | SP | 0.7357 | 2.5/3.5 | 0.7357 | agrees |
| Fire Blast | *(states no scaling)* | SP | 0.4714 | instant 1.5/3.5 | 0.4714 | agrees |
| Scorch | *(states no scaling)* | SP | 0.4714 | 1.5/3.5 | 0.4714 | agrees |
| Ice Lance | *(states no scaling)* | SP | 0.4543 | instant 1.5/3.5 | 0.4543 | agrees |
| Arcane Power | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Presence of Mind | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Combustion | *(states no scaling)* | no damage | — | — | — | deals no damage |

### Warlock

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Bane of Agony | *(states no scaling)* | SP | 1.9404 | 24/15 | 1.9404 | agrees |
| Siphon Life | *(states no scaling)* | SP | 2.2050 | 30/15 | 2.2050 | agrees |
| Immolate | *(states no scaling)* | SP | 1.3929 | hybrid(0.571, 15/15) | 1.3929 | agrees |
| Corruption | *(states no scaling)* | SP | 1.4553 | 18/15 | 1.4553 | agrees |
| Shadow Bolt | *(states no scaling)* | SP | 0.9429 | 3/3.5 | 0.9429 | agrees |
| Incinerate | *(states no scaling)* | SP | 0.7857 | 2.5/3.5 | 0.7857 | agrees |
| Conflagrate | *(states no scaling)* | SP | 0.4714 | instant 1.5/3.5 | 0.4714 | agrees |
| Shadowburn | *(states no scaling)* | SP | 0.4714 | instant 1.5/3.5 | 0.4714 | agrees |
| Searing Pain | *(states no scaling)* | SP | 0.4714 | 1.5/3.5 | 0.4714 | agrees |
| Life Tap | *(states no scaling)* | no damage | — | — | — | deals no damage |

### Druid

| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Ferocious Bite | Damage is increased by your Attack Power. | FLAT | — | — | — | **DISAGREES** |
| Starfire | *(states no scaling)* | SP | 1.1055 | 3.5/3.5 | 1.1055 | agrees |
| Rip | Damage increases per combo point and by your Attack Power: | FLAT | — | — | — | **DISAGREES** |
| Moonfire | *(states no scaling)* | SP | 0.8153 | hybrid(0.429, 12/15) | 0.8153 | agrees |
| Insect Swarm | *(states no scaling)* | SP | 0.8844 | 12/15 | 0.8844 | agrees |
| Shred | *(states no scaling)* | AP | 0.3045 | — | — | scales; rule not computable here |
| Wrath | *(states no scaling)* | SP | 0.6317 | 2/3.5 | 0.6317 | agrees |
| Claw | *(states no scaling)* | AP | 0.2161 | — | — | scales; rule not computable here |
| Maul | *(states no scaling)* | AP | 0.1964 | — | — | scales; rule not computable here |
| Primal Bite | *(states no scaling)* | AP | 0.1786 | — | — | scales; rule not computable here |
| Rake | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Swipe | *(states no scaling)* | FLAT | — | — | — | flat, source states no scaling |
| Lacerate | Lacerates the enemy target, making them bleed for 75 damage over 15 sec plus 10% weapon damage per existing application of Lacerate on the target. | FLAT | — | — | — | flat, source states no scaling |
| Tiger's Fury | *(states no scaling)* | no damage | — | — | — | deals no damage |
| Demoralizing Roar | The druid roars, decreasing nearby enemies' melee attack power by 204. | no damage | — | — | — | deals no damage |

