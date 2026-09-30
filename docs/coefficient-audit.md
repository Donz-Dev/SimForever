# Coefficient audit

Every damage source in the simulator, with what its damage scales with.

**Generated, and MEASURED rather than read off a declaration.** A
coefficient is passed per `dealDamage` call, so one written in the wrong
place is silent. Re-run both scripts rather than editing the table:

```bash
npx vite-node tools/coefficient_probe.ts --json > probe.json
node tools/coefficient_report.mjs
```

## Reading it

| Cell | Means |
| --- | --- |
| `weapon damage` | the damage IS weapon damage, so attack power arrives through the weapon at `speed / 14`. Measured, by halving the weapon speed and asking again — Mortal Strike and Bloodthirst both simply "respond to attack power" without that check |
| `40% weapon damage` | the same, for a share of the weapon swing |
| `ranged weapon damage` | the same through the RANGED weapon and ranged attack power, which is a separate pool |
| a percentage | the ability carries its own coefficient, the same on any weapon |
| `0%` | no response to that stat at all |

Figures are the **bare** coefficients: the build's damage multipliers are
divided back out, so a Shadow Priest's spells state their coefficient and not
their coefficient times Shadow Mastery.

## Nothing disagrees with its own tooltip any more

Every damage source that claims to scale, scales. The four that did not --
Eviscerate, Rupture, Rip and Ferocious Bite, each stating "increased by
Attack Power" and measuring completely flat -- were the finding of the
first version of this audit, and `WoWSimWorksheet.xlsx` answered all four.

Lacerate went with them: its "10% weapon damage per existing application"
now applies, reading the stack count off the aura that a stale note said a
periodic tick could not see.

## Two things to know before comparing this with the sheet

**A DAMAGE-OVER-TIME ROW IS A TOTAL HERE AND PER TICK ON THE SHEET.** The
probe casts once and totals everything the cast causes, so Devouring Plague
reads 80% against the sheet's 10% -- eight ticks of it. Siphon Life reads 50%
for ten ticks of 5%, and Rip 120% for six ticks of 4% per combo point at five
points. Neither figure is wrong; they answer different questions.

**A FEW ROWS CARRY A MULTIPLIER THE PROBE CANNOT DIVIDE OUT.** It reads a
build's modifiers off a character that has not entered combat, so an OPENING
aura is missing from them -- a Warrior's stance most of all. Revenge reads 20%
against the sheet's 22%, which is Defensive Stance's 0.9 and not a
transcription error.

## Every damage source

### Warrior

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Execute | 0% | 0% |
| Shield Slam | 0% | 0% |
| Mortal Strike | weapon damage | 0% |
| Heroic Strike | weapon damage | 0% |
| Revenge | 20% | 0% |
| Slam | weapon damage | 0% |
| Cleave | weapon damage | 0% |
| Overpower | weapon damage | 0% |
| Whirlwind | weapon damage (both hands) | 0% |
| Rend | 19% | 0% |
| Bloodthirst | 35% | 0% |
| Spearing Strike | 40% weapon damage | 0% |
| Thunder Clap | 7.0% | 0% |
| Intercept | 0% | 0% |
| Hamstring | 0% | 0% |

### Paladin

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Seal of Command *(per strike)* | 20% | 20% |
| Seal of Fury *(per strike)* | 0% | 10% |
| Holy Shock | 0% | 43% |
| Seal of Righteousness *(per strike)* | 0% | 20% |
| Consecration | 0% | 38% |
| Holy Strike | 50% weapon damage | 21% |
| Judgement | 0% | 50% |

A seal strikes once per swing, so its figures are per strike. They come from
the formula you supplied — `base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)`
— which is why spell power is worth exactly twice attack power, and why a
slower weapon hits harder. Seal of Command is the exception: it is 70% of the
swing that carried it, so it inherits that hit rather than scaling itself.

### Hunter

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Serpent Sting | 15% | 0% |
| Sniper Shot | ranged weapon damage | 0% |
| Aimed Shot | ranged weapon damage | 0% |
| Raptor Strike | weapon damage | 0% |
| Mongoose Bite | weapon damage | 0% |
| Strider Kick | weapon damage | 0% |
| Multi-Shot | ranged weapon damage | 0% |
| Arcane Shot | 10% | 0% |
| Summon Hawk | 0% | 0% |

### Rogue

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Eviscerate | 20% | 0% |
| Rupture | 24% | 0% |
| Backstab | 150% weapon damage | 0% |
| Ghostly Strike | 180% weapon damage | 0% |
| Sinister Strike | weapon damage | 0% |
| Mutilate | weapon damage (both hands) | 0% |
| Hemorrhage | 145% weapon damage | 0% |

### Priest

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Shadow Word: Pain | 0% | 160% |
| Devouring Plague | 0% | 80% |
| Mind Flay | 0% | 51% |
| Mind Blast | 0% | 43% |
| Shadow Word: Death | 0% | 43% |

### Shaman

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Lava Burst | 0% | 71% |
| Lightning Bolt | 0% | 71% |
| Earth Shock | 0% | 39% |
| Frost Shock | 0% | 39% |
| Stormstrike | weapon damage | 0% |
| Flame Shock | 0% | 61% |
| Chain Lightning | 0% | 57% |

### Mage

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Arcane Missiles | 0% | 143% |
| Pyroblast | 0% | 151% |
| Fireball | 0% | 84% |
| Frostbolt | 0% | 81% |
| Frostfire Bolt | 0% | 81% |
| Arcane Blast | 0% | 71% |
| Fire Blast | 0% | 43% |
| Blast Wave | 0% | 13% |
| Scorch | 0% | 43% |
| Ice Lance | 0% | 43% |

### Warlock

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Immolate | 0% | 85% |
| Bane of Agony | 0% | 106% |
| Corruption | 0% | 120% |
| Shadow Bolt | 0% | 86% |
| Siphon Life | 0% | 50% |
| Incinerate | 0% | 71% |
| Conflagrate | 0% | 43% |
| Shadowburn | 0% | 43% |
| Searing Pain | 0% | 43% |

### Druid

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Ferocious Bite | 15% | 0% |
| Rip | 120% | 0% |
| Starfire | 0% | 100% |
| Moonfire | 0% | 67% |
| Insect Swarm | 0% | 95% |
| Shred | 155% weapon damage | 0% |
| Wrath | 0% | 57% |
| Claw | 110% weapon damage | 0% |
| Maul | weapon damage | 0% |
| Primal Bite | weapon damage | 0% |
| Rake | 4.0% | 0% |
| Swipe | 10.0% | 0% |
| Lacerate | 50% weapon damage | 0% |

### Applied by a reaction, so no cast reaches them

| Damage source | AP coeff | SP coeff |
| --- | --- | --- |
| Deep Wounds | inherited | inherited |
| Ignite | inherited | inherited |

Deep Wounds is a share of average weapon damage and Ignite a share of the
crit that caused it, and that hit was already scaled — so a coefficient here
would apply the stat twice. They do move with gear, through the parent.

---

**82 damage sources**, from 120 abilities reached across all 23 presets.
Nothing was refused — every precondition a damaging ability needs is arranged
in the probe's `SETUP`, and a refusal would be printed with its reason rather
than dropped. The other 38 are stances, aspects, shouts, cooldowns and
seals-as-auras: they cast successfully and deal no damage themselves.
