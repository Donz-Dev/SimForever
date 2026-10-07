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
| `game/buffs/windfury.ts` | A proc rather than a state |
| `game/buffs/judgementOfWisdom.ts` | The other proc, and the only one with a CAST half |
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
| **Battle Shout** | **+139.** The owner's raid figure was 139 and the ability spreadsheet said 140; asked which won, the owner chose the spreadsheet. The client-derived spellbook then agreed with the raid figure, and the owner asked for the spellbook to be matched — so both are 139 now. Our capture still says 140 and is the odd one out. |
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

## Thunder Clap makes the swing a fifth longer

> **swing time × 1.2** — a 2.00 second swing becomes **2.40**.

| Source | 2.00 second swing becomes | |
| --- | --- | --- |
| **The ruleset owner** | **2.40** — swing time × 1.2 | ✅ used |
| Forever's spell description | 2.40 — "increasing the **time between** their attacks by 20%" | agrees |
| Forever's own effect row | 2.47 — "Mod Melee Attack Speed", value −19 | still odd |
| ~~The owner's first answer~~ | ~~2.50 — attack speed −20%~~ | replaced |

**The owner overturned their own earlier ruling**, and the new one means
Forever's description was right all along. The two readings are not the same
thing: a tenth of a second on every swing the target takes.

The captured data still does not agree with itself — its effect row says the
speed drops nineteen percent, which is 2.47 — so two of the three sources now
agree and the effect row is the odd one out.

Carried as a **negative haste rating**, because a swing time multiplier and a
haste multiplier are reciprocals and the engine already has the second:
`applyHaste` *divides* a swing timer by it. The aura holds the owner's 1.2
literally and derives the rating, using the same constant
`hasteMultiplierFrom` divides by, so the round trip is exact:

```
swing x 1.2  <=>  haste multiplier 1 / 1.2 = 0.8333...
             <=>  haste -16.666...%
             <=>  rating -2833.33
```

**The Warrior's own Thunder Clap applies it**, on the owner's instruction, and
the raid entry reuses that aura rather than declaring a copy — so a raid that
supplied it and a warrior keeping it up refresh one debuff instead of stacking
two.

That took its uptime from a one-shot **50%** to **100%** in the Prot Warr
preset, where the warrior recasts it all fight. Thunder Clap is **twelfth** in
the tank list, below the stance, Battle Shout, five Sunder Armors, Demoralizing
Shout, Heroic Strike, Shield Block, Shield Slam and Revenge, so the first cast
lands late — but the raid's own application covers the opening thirty seconds,
which is what closes the gap.

**Its cooldown is 6 seconds, not 4** (corrected 2026-09-23 against the
spellbook; the spreadsheet said 4, which is the Classic value). That costs the
tank about half a cast a fight, **8.62 → 8.22**, and costs the debuff nothing:
a 30 second slow covers a 6 second cooldown with room to spare.

## Every selected entry lasts twice the fight

> Make the raid buff/debuff application duration for all GUI selections equal to
> 2x the simulation duration.

The ruleset owner's rule, and it exists because of **reuse**. `SUNDER_ARMOR` and
`THUNDER_CLAP_SLOW` are the same aura objects the Warrior's own abilities apply,
and they carry the durations those abilities need: thirty seconds, because a
warrior recasts them. The raid entry reuses them rather than declaring a second
copy -- which is the right call, and which quietly meant that on anyone who
could not recast them **the raid's debuff fell off at the half-way mark**.

### It is an override at application time, never an edit

`trainingDummyEncounter` copies the aura with a new `durationMs` as it applies
it. Lengthening the definition would hand the Warrior a fight-long Sunder and
delete the reason its own rotation refreshes at all.

### Twice the duration rather than the duration

A fight does not end at exactly `durationSeconds` -- `FIGHT_DURATION_VARIANCE`
moves the end. An aura expiring one tick before the last swing would be a
silent, occasional version of the bug this fixes.

### Uniform on purpose, even though it moves only two

Every other entry is already an hour, five minutes, or zero -- which means
permanent here. The rule is written once so the next short-duration entry gets
it for free; the alternative is a list of exceptions that nobody updates.

### What it was worth

**Fourteen profiles moved REAL and nine did not move by a decimal**, and the
nine are every pure caster: Sunder Armor reduces ARMOR, which only physical
damage pays, and Thunder Clap slows a SWING, which only matters when something
is swinging. Combat Rogue was the largest at +59.3. The mean went 496.8 to
520.8.

**And the two-handed Warrior stopped casting Sunder Armor altogether**, because
the raid's five stacks now hold all fight. `presets.test.ts` asserts that as
zero rather than dropping the assertion -- a list entry that silently stops
firing is this project's most repeated silent failure, so the one time it is
deliberate it is written down.

## Judgement of Wisdom takes one roll per ACTION

> Every direct damage source (not DoT ticks) or cast against an enemy has a 50%
> chance to restore 59 mana to classes that use mana.

The ruleset owner's wording, and it does not say what happens to a spell that is
both. A Fireball is a direct damage source AND a cast against an enemy.

**The owner settled it: one roll per action.** An action that dealt direct damage
rolls on the damage; a cast that dealt none -- applying Corruption, or a spell
that missed -- rolls on the cast. Each clause does work and nothing is counted
twice. The rejected reading rolls on both, which is an effective 75% per Fireball
rather than 50%, and **both readings produce a perfectly plausible number**.

### The two halves share one closure

That is the whole mechanism. The damage half records the instant it rolled and
the cast half refuses at that instant. It rests on `runCast` running `onCast`
BEFORE the cast reactions, so a damaging spell has already been through the
damage pipeline by the time the cast half is offered it.

**So `RaidBuff.buildReactions` returns both halves from one call**, where
Windfury alone had needed only `buildReaction`. Two separate factory fields was
the first attempt and it was a real bug: two calls, two closures, two
independent rolls -- the rejected reading, reached by accident with nothing to
catch it.

### "Not DoT ticks" is the engine's, not this file's

`dealDamage` dispatches reactions only when `request.attackTable &&
!request.periodic`, so a tick never reaches a damage reaction at all. A test
asserts it, because if that gate ever changes this starts paying out on every
Shadow Word: Pain tick -- a bigger number and no error.

### A class with no mana consumes no randomness

The mana check runs BEFORE the roll. A Warrior fight is therefore
**bit-identical** with the buff on and off, not merely close -- which is what
makes the six physical profiles' +0.0 a containment check rather than a small
number. A proc that rolled and then discarded the result would shift every later
roll in the fight and read as noise.

### Whose reaction it is, and where its aura lands, are different questions

It applies to the ENEMY -- a judgement placed on the target -- and its proc
belongs to the ATTACKER. The encounter collects reactions from every selected
entry for that reason; reading the player-targeted ones answered the wrong
question.

## Windfury is a proc, and it has two traps in it

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

## What does nothing

Each of these carries an `unmodelled` string saying so. **The panel used to
print it beside the selected entry and no longer does** — the GUI pass took that
reporting off the interface, along with the Gear and Talent panels' equivalents.
The strings are still here and still maintained; this table is where they are
read now.

| Entry | Why |
| --- | --- |
| **Curse of the Elements** | Magic schools only, and every Warrior ability is physical, Shield Slam included. The ruleset owner is content with that — "it'll work for other classes" — and `damageTakenBySchool` is checked by a test that fires real fire damage. |
| **Curse of Recklessness / Curse of the Elements** | Both curses. Only one curse holds on a target in WoW; nothing in the source says so, so both apply here. |

## Entries that cannot sit beside each other

> These are all the same exclusive 3% global critical strike chance and do not
> stack.

The ruleset owner on Moonkin Aura and Leader of the Pack, and **it supersedes an
earlier ruling of theirs** — "they don't stack, but that can be handled on the
GUI" — which made it a SELECTION rule rather than a combat one.

### Why the GUI was the wrong place for it

`exclusiveWith` works: it declares the pair in one direction, is read in both,
and the panel turns one off when the other goes on and says "replaces Moonkin
Form" beside the switch. What it governs is **two raid buff entries**, and the
3% has **three** sources:

| Source | Governed by `withRaidBuff`? |
| --- | --- |
| the `leader_of_the_pack` raid buff | yes |
| the `moonkin_form` raid buff | yes |
| the **Moonkin Form and Leader of the Pack TALENTS** | **no** |

So a Moonkin that took its own form talent, in a raid whose panel had Leader of
the Pack ticked, held two different aura ids and read **+6% crit** — 24.243%
spell crit against 21.243%, measured. A profile loaded from JSON with both buff
ids in its list did the same, because nothing re-runs `withRaidBuff` on load.

**A GUI rule cannot cover a source the GUI does not own**, and the talent half
arrived after the ruling did.

### What it is now

**One `AuraDefinition`, one id, three sources.** `PARTY_CRIT_AURA` in
`game/auras/druid.ts`, id `party_crit_aura`, and both raid buff entries and both
talents apply that one — so `AuraCollection.apply` refreshes a matching id
instead of stacking a second instance and no combination of the three is worth
more than 3%. It is structural rather than remembered: a fourth source would get
the rule for free.

**THE TWO ENTRIES STILL EXIST SEPARATELY, and should.** A raid is composed by
choosing which druid turned up, the panel names both, and they keep
`exclusiveWith` so the selection still reads correctly. What changed is that
choosing wrongly can no longer be worth anything.

**THE AURA'S NAME CARRIES BOTH** — "Moonkin Aura / Leader of the Pack" — because
one aura cannot be named after one of three sources. It surfaces in the combat
log's line at the pull and nowhere else: a permanent aura is never removed, and
`auraUptime` only totals a span when an `aura_removed` closes one, so it is
filtered out of the uptime table entirely.

Nothing else in the catalogue is exclusive. The two curses are not, because
nothing in the source says a target holds only one.

## What it is worth

A dual-wield Fury warrior on a standing target, 500 iterations:

| | DPS |
| --- | --- |
| Unbuffed | **165.4** |
| Windfury Totem alone | **183.8** |
| Everything selected | **~263** |
