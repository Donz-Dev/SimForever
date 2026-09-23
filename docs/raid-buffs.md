# Raid buffs

What the rest of the group has given this character, and what it has already
put on the target. One list, selected once, used by every run — it lives on the
profile, so it is saved, exported and reloaded with the character.

Every number is the **ruleset owner's, given directly**. Nothing here is
scraped and nothing is Classic.

## Nothing is on by default, and that is the point

An empty selection is not laziness. Every figure this project has ever recorded
was measured unbuffed, and a default raid loadout would move all of them at
once — including the baselines in [HANDOVER.md](../HANDOVER.md).

It is also exactly how `BATTLE_FURY` went wrong. That was an example aura
granting an invented +10% attack power, applied to every player at combat
start. It inflated every damage figure the simulator produced, and a character
sheet reading 400 attack power fought at 440. It was deleted, and the note left
where it had been said *"real raid buffs belong here when there is real data for
them."*

There is now. The difference between this and `BATTLE_FURY` is entirely that
somebody chose it.

## Where each piece lives

| | |
| --- | --- |
| `game/buffs/raidBuffs.ts` | The catalogue: what each entry is and what it does |
| `game/buffs/windfury.ts` | The one entry that is a proc rather than a state |
| `profiles` | `raidBuffs`, a list of ids. Format version 9 |
| `simulator/trainingDummyEncounter.ts` | Applies them, via `onCombatStart` |
| `ui/panels/RaidBuffsPanel.tsx` | The switches |

**Ids, not copies**, for the reason equipment stores item ids: what a buff *is*
belongs to the catalogue, and a profile carrying its own numbers would drift the
moment one was corrected. An id nobody recognises is dropped rather than
throwing, so a profile saved before a rename still loads.

## Reused rather than redeclared

Three entries already existed as Warrior abilities, and they use the **same
aura**. A raid that applied Battle Shout and a warrior who casts it cannot
stack, and cannot disagree about the magnitude — one refreshes the other.

| Entry | Note |
| --- | --- |
| **Battle Shout** | The owner's raid figure is +139 and the ability spreadsheet says +140. Asked which wins, the owner chose the spreadsheet. |
| **Sunder Armor** | Applied five times, which is the 2,250 armor the owner states and exactly what five casts produce. |
| **Demoralizing Shout** | Deliberately absent — *"make it a comment, keep it inert for now."* It would change nothing anyway: the boss's swing damage is stated rather than derived from attack power. |

### Applying a stack means applying it repeatedly

Sunder Armor arrives at five stacks, and the encounter applies the aura five
times to get there. Writing the stack count onto the instance does **not**
rescale its stat modifiers — `applyStatModifiers` multiplies by the stack count
it saw when it ran — so Sunder read as one stack's worth of armor, 450 instead
of 2,250, until this went through the normal path.

## The pools are a snapshot, and that nearly broke Fortitude

Health and mana are **resource maximums**, computed once in `createPlayer` from
a stats snapshot. Unlike attack power or crit, they do not re-derive when a buff
moves stamina.

So Power Word: Fortitude's +70 stamina granted **no health at all**, which is
the entire point of it, and Blessing of Kings' +10% stamina none either.

The encounter now passes `poolStats`: a **transform** from the character's own
stats to the stats they will have once the raid buffs are up, and the pools are
sized from the result. A function rather than a delta, because Blessing of Kings
is multiplicative and +10% of a total cannot be written down without knowing the
total. The buffs are still applied as auras; nothing is counted twice, because
the pools are computed once and never again.

**The underlying limitation is unchanged.** A buff landing *mid*-fight still
does not resize the pool. Everything here is up before the first swing, which is
what makes the snapshot correct.

## Blessing of Kings multiplies

`percentMul`, not `percentAdd`. "+10% (1.1x)" is the owner's own notation, and
the operation that means it: two independent +10% effects give 1.21, where an
additive pair would give 1.20.

It is applied **after** the flats, which is the order `StatBlock` combines them
in — so Kings multiplies a total that already includes Mark of the Wild:

```
strength  344 base + 53 (Strength of Earth) + 16 (Mark of the Wild) = 413
          x 1.1 (Blessing of Kings) = 454.3
```

## Thunder Clap slows by a quarter, and three sources disagree

| Source | 2.00 second swing becomes |
| --- | --- |
| **The ruleset owner, asked directly** | **2.50** — attack speed −20% |
| Forever's spell description | 2.40 — "increasing the **time between** their attacks by 20%" |
| Forever's own effect row | 2.47 — "Mod Melee Attack Speed", value −19 |

The captured data does not agree with itself, let alone with the owner: its
description says the swing gets a fifth longer while its effect row says the
speed drops nineteen percent. **The owner's direct answer settles it**, by the
rule that settled Shield Wall's cooldown, and the other two are written down
rather than lost. Worth resolving — it is a quarter versus a fifth of the
swings that kill the character.

Carried as a **negative haste rating**, which is how the engine already
expresses attack speed, converted with the same constant `hasteMultiplierFrom`
divides by so the round trip is exact.

**The Warrior's own Thunder Clap applies it**, on the owner's instruction, and
the raid entry reuses that aura rather than declaring a copy — so a raid that
supplied it and a warrior keeping it up refresh one debuff instead of stacking
two.

That took its uptime from a one-shot **50%** to **74.7%**. Not higher, and the
gap is a finding rather than a bug: Thunder Clap is **twelfth** in the tank
list, below the stance, Battle Shout, five Sunder Armors, Demoralizing Shout,
Heroic Strike, Shield Block, Shield Slam and Revenge — so the first cast lands
at about **16.9 seconds**. It was a damage ability when that order was chosen
and it is a mitigation one now.

## Windfury is the only proc, and it has two traps in it

> Each main-hand swing has a 20% chance of an extra attack, on the same rules as
> Sword Specialization and Hand of Justice, with a 1.5 second internal cooldown
> and a 1.5 second +246 attack power buff that the extra attack benefits from.

### The order inside `onTrigger` is the mechanic

The aura goes up **first**, and the extra attack is requested second.
`extraAttack` schedules its swing at the current timestamp rather than running
it inline, so it resolves after the reaction returns — by which time the attack
power is already raised.

Swapping those two lines produces an extra attack at base attack power and
**nothing fails**.

The swing that *procced* it does not benefit: it has already dealt its damage
and been reported by the time a reaction runs. The owner settled that.

### It carries no aura of its own in the catalogue

Listing the +246 window as the entry's `aura` applied it free at the pull and
counted it toward the health pool snapshot. A character sheet read 246 attack
power too high.

### The reaction is built per character

A reaction built once at module load shares its internal cooldown with every
combatant in every iteration of a batch. Once one fight set the timestamp, the
next fight's clock started back at zero, the subtraction went negative, and
Windfury **never procced again for the life of the process** — measured as one
proc in a fight where three were expected. Hand of Justice is built per
character for exactly this reason, and the catalogue now carries a
`buildReaction` factory rather than a reaction.

### What the proc rate looks like

About **13% of main-hand attempts**, which is 20% of the ones that *land*: the
outcome list is hit, crit, glance and crush, matching Hand of Justice. A
dual-wielder avoids roughly a quarter of their swings, and the internal cooldown
eats a few more.

## What does nothing, and says so

The panel prints a caveat beside any selected entry that does less than it says
— the same discipline the Gear and Talent panels apply, in the place the choice
is made.

| Entry | Why |
| --- | --- |
| **Curse of the Elements** | Magic schools only, and every Warrior ability is physical, Shield Slam included. The ruleset owner is content with that — "it'll work for other classes" — and `damageTakenBySchool` is checked by a test that fires real fire damage. |
| **Curse of Recklessness / Curse of the Elements** | Both curses. Only one curse holds on a target in WoW; nothing in the source says so, so both apply here. |

## Entries that cannot sit beside each other

> Leader of the Pack and Moonkin Form don't stack, but that can be handled on
> the GUI.

The ruleset owner's ruling, and their choice of where to enforce it — so it is
a **selection** rule rather than a combat one. The engine is right to add two
different +3% auras to +6%; what is wrong is choosing both. `exclusiveWith`
declares the pair in one direction and is read in both, and the panel turns one
off when the other goes on and says "replaces Moonkin Form" beside the switch.

Nothing else in the catalogue is exclusive. The two curses are not, because
nothing in the source says a target holds only one.

## What it is worth

A dual-wield Fury warrior on a standing target, 500 iterations:

| | DPS |
| --- | --- |
| Unbuffed | **165.4** |
| Windfury Totem alone | **183.8** |
| Everything selected | **~263** |
