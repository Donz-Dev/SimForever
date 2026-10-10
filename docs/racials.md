# Racials

Every race in World of Warcraft: Forever carries four traits, and until this
landed none of them did anything. `game/character/ids.ts` has said "racial
traits will key off them" since the vocabulary was written; this is that.

`src/game/racials/` holds it. The shape is `talentBuild`'s: a declaration table
(`racialEffects.ts`), a builder that turns a race into plain data
(`racialBuild.ts`), and `createPlayer` as the only reader.

## The two sources, and which one wins

| | |
| --- | --- |
| `talentsforever.com/racials.js` | the beta client's own file. Forty traits across the ten races, each with its name, its tooltip and an icon. **The source of record for the text.** |
| the ruleset owner | stated the subset that "registers as a combat advantage", with four details the client does not carry. **Wins where they differ.** |

They differed in four places and every one is recorded at the line it changed:

| | the client | the owner |
| --- | --- | --- |
| **Blood Fury** | "Attack Power and Spell Power" | "Attack Power, **Ranged Attack Power**, and Spell Power" |
| the global cooldown | "Instant" for all five actives, nothing either way | Stoneform takes 1.5s; the other four take **none** |
| weapon specialization | crit for the character | "**this includes** +2% for pet crit chance" |
| Touch of the Grave | adds a **1 sec internal cooldown** | eight exclusions the client does not state |

The internal cooldown is the one place the client adds something. That is a
**silence rather than a disagreement** — the owner's statement does not deny it
— so both are taken, which is the reading that kept Shadowburn's Soul Shard
when `foreverchanges.pro` carried no reagent field to contradict it.

## What is modelled

**Racials are not selectable**, which is the one way they are not a raid buff.
Nothing among the raid buffs is on by default, because a buff that applied
itself would move every figure ever recorded — and a racial applies for the same
reason a Tauren's base strength does: race is already a required field on every
profile and `baseStats.ts` is already keyed by it.

### Passive

| Race | Trait | How |
| --- | --- | --- |
| Human | Sword Specialization, +2% | `critChance` **and** `spellCritChance`, while a sword is equipped |
| Human | The Human Spirit, +5% | a `percentAdd` modifier on `spirit` |
| Dwarf | Mace Specialization, +1% | both crit stats, while a mace is equipped |
| Orc | Axe Specialization, +1% | both crit stats, while an axe is equipped |
| Night Elf | Quickness, +1% dodge | flat `dodgeChance` |
| Tauren | Endurance | `healthPercent` 5%, and flat `hitChance` 1 |
| Gnome | Expansive Mind | `resourceMaxPercent` 5% on mana, rage and energy |
| both Skyborne | Wind Blessed, +1% haste | `hasteRating` through `RATING_PER_PERCENT.haste` |

**"Global Crit Chance from all sources" is two stats.** `critChance` and
`spellCritChance` are read by separate tables, which is the reading sixty-two
item lines saying "with all spells and attacks" already take. It is not
academic: all three Human Paladin presets hold Azuresong Mageblade and the
Shockadin's damage is almost entirely Holy spells.

**And the pet comes for free, which is why it is a stat.** `createPet` reads
`owner.stats.effective.critChance` and inherits all of it, so a crit stat on the
Hunter is already on its pet. That is the exact opposite of the bow enchant's
"+2% Crit Chance", which the owner ruled must **not** reach the pet and which is
`attackTableModifiers` for that reason. The two clauses point opposite ways and
the engine already draws the line in the right place.

### "Holding" means EQUIPPED, and it decides two profiles

The owner's ruling. `weaponsForEquipment` builds no `WeaponProfile` for a hand
the style marks `stat-stick`, so a **ranged** Hunter carrying Dreadforge
Retaliator has no main-hand weapon at all — while `liveEquipment` keeps the axe,
because it is held and contributing its stats.

Of the seven Orc presets, exactly **two** hold an axe: `bm_hunter` and
`lw_ranged`, both of which carry it in the two-hand slot as a stat stick. The
two melee Orc Hunters dual-wield a sword and a dagger and the two Orc Warriors
hold swords. So reading the weapon profile rather than the equipment would have
made Axe Specialization reach **zero** of the 25 presets while looking like a
working trait.

**Either hand satisfies it**, also the owner's ruling: a dual-wielder holding
one sword is holding a sword.

### Active

Five abilities, in `racials/abilities.ts` and `racials/auras.ts`.

| Race | Ability | Effect | Cooldown | GCD |
| --- | --- | --- | --- | --- |
| Dwarf | Stoneform | physical damage taken ×0.9 for 8s | 3 min | **1.5s** |
| Night Elf | Elune's Light | +10 to both crit stats for 15s | 3 min | none |
| Orc | Blood Fury | +10% attack, ranged attack and spell power for 15s | 2 min | none |
| Troll | Berserking | +10% haste for 10s | 3 min | none |
| Gnome | Eureka! | next 3 damaging abilities cost 10% less and deal 10% more | 2 min | none |

**None of them costs a resource**, because the client states no cost for any
racial and inventing one would be inventing data.

**Stoneform is `damageTakenBySchool` and not the blanket field**, because the
tooltip says "all **Physical** damage taken" and the blanket field would also
soften magic the encounter does not currently deal — worth nothing today and
wrong the day it does, in the direction that reads as a slightly better tank.

**Blood Fury is a `percentAdd` modifier and not a flat figure**, so +10% scales
the whole derived pool — the strength conversion, the gear, Blessing of Might
and all. A flat number taken at build time would scale the unbuffed pool and be
wrong for the rest of the fight.

## Eureka!, which needed two engine additions and a reaction pair

"Your next 3 non-periodic damaging abilities cost 10% less (Mana, Rage or
Energy) and deal 10% more damage. Periodic effects get nothing from it; a
channeled spell is not periodic."

**The two halves are spent by different machinery, and that is not tidiness.**
`consumeCastCharges` runs *before* `onCast`, and at one stack `consumedByCast`
removes the aura — so an aura carrying both the cost reduction and the damage
bonus would give the **third** ability its discount and no damage bonus at all.
That is Holy Shield's bug exactly: an ability quietly worth two thirds of
itself, with nothing on the results page to say so.

So the cast modifier carries no `consumedByCast`, and the charge is spent by a
reaction pair **after** the damage has landed. `AuraCollection.consumeStack`
exists for precisely this and says so: "Fingers of Frost has no cast modifier at
all … and its charges are still spent by casting."

**Why a pair rather than one cast reaction.** "Non-periodic *damaging*
abilities" cannot be answered from the ability declaration, and the two
counter-examples are already in the project: **Rupture and Serpent Sting both
declare a combat table** — they roll it to decide whether the bleed lands — and
neither deals a point of direct damage. `requiresAttackTable` would have spent a
charge on either. So a damage reaction observes that a non-periodic damage event
happened and marks the cast; a cast reaction on `cast.final` spends the stack.

**One charge per cast is the owner's ruling, and `cast.final` is what buys it.**
`runCast` runs once per channel tick, so without it the first of five Arcane
Missiles would spend a charge and the last two would fire unbuffed — a smaller
number, no error, and the opposite of what the Arcane list is built around.

**`nonPeriodicDamageMultiplier` rather than `abilityModifiers`**, because
`abilityModifierFor` is never told whether the damage is a tick. A catch-all
entry there selects every ability correctly and would raise Ignite, Pyroblast's
burn and every Corruption tick inside the window. It is the second field in the
engine that selects on the KIND of damage; `Combatant.periodicDamageMultiplier`
is the first, and this is that axis pointing the other way.

## Touch of the Grave, which is eight exclusions and two of them needed work

> "Your spells and attacks with a damage part have a chance (10% for casters, 5%
> for melee) to drain Health from the target, up to 5% of your maximum Health."

5% flat and it **heals the Undead for what it dealt**, both the owner's rulings.
Nothing states a floor for "up to", so none is invented.

| the clause | how |
| --- | --- |
| "spells and attacks" | every landed outcome, on any table |
| "with a damage component" | `amount > 0`, read off the **damage** |
| DoTs and channels, on the initial cast only | a tick reaches no `dealt` reaction at all, which the engine already guarantees; a channel is held to its first tick |
| Arcane Missiles excepted | `TOUCH_OF_THE_GRAVE_CHANNEL_EXCEPTIONS` |
| Consecration excepted | `periodicDealt`, because its cast deals nothing |
| "pets can never trigger" | built only for the player; a pet is a separate combatant with its own reaction list |
| "poison applications cannot proc" | `TOUCH_OF_THE_GRAVE_POISON_EXCLUSIONS` |
| "cannot crit" | `cannotCrit` — see below |
| "uses the Spell Cast Combat Table" | `attackTable: 'spell'`, so it **can** miss |
| "only scales off your Hit Points" | no coefficient and no weapon scaling, plus `ignoresAttackerDamageScaling` |
| "BUT it does scale if the target is vulnerable" | the target's side, deliberately left alone |

**The two exceptions need two different mechanisms, which is the finding.**
Arcane Missiles is a **channel**, and a channel's ticks are not periodic — so
each missile is already an ordinary non-periodic damage event and what the
exception overrules is the per-channel rule. Consecration deals **nothing** on
its cast: it applies a ground aura that ticks, and `dealt` reactions never see a
tick, so through `dealt` it could never have procced at all.

**"Cannot crit" is not what omitting `critFrom` says.** It shipped that way,
which is the obvious thing to write and is about the other case entirely:
`critFrom` governs an attack with **no** table, and one that declares a table
takes its crit from that table — and the spell table's crit slice *is* the
caster's spell crit. A test handing the caster a hundred points of crit found
**200 crits in 200 drains**. `DamageRequest.cannotCrit` is the field that says
it, and it zeroes the slice *after* every modifier, because
`applyAbilityModifiers` adds a talent's `abilityCrit` to whatever the provider
returned.

**The first version of that test agreed with the bug**, because it built the
`DamageRequest` by hand and omitted `cannotCrit` exactly as the reaction did. A
test that reconstructs the thing under test will reproduce its mistakes; it
drives the reaction through real fights now.

**And the self-heal is not overhealing on a Warlock.** A comment here first said
the heal "is worth nothing to all five Undead presets, because what it changes
is the death count and none of the five is a tank" — true of the three Rogues
and false of both Warlocks. **Life Tap spends health for mana**, and the Firelock
build is health-bound rather than mana-bound: measured over twenty fights it taps
down to **2.3%** of its pool. The Undead build gets 5.6 Life Taps a fight against
a Human's 5.0, and neither dies.

## Where the entries go in a priority list, which was measured both ways

An ability in the book and in no list **never fires** — the fourth cause of
inert, and the one that reads exactly like an engine gap. The four free racial
cooldowns are learned by a *race*, so no class list was ever going to name them.
`rotations/racialCooldowns.ts` is one shared constant spread into every list; a
list naming an ability the build lacks is skipped in silence, which is what
makes one constant safe in all 27.

**Both ends of the list were tried and both were wrong.**

| | what happened |
| --- | --- |
| **top** | broke Charge completely. Its `canCast` allows only the opening timestamp, and `nextDecisionTime` gives a free actor `now + 100ms` — so a free off-GCD racial cast at the pull throws the window away. Charge went from one cast a fight to **zero**. |
| **bottom** | this project's own rule for a new entry, and it left **five of seven** racials inert: a list with anything castable never falls that far. |

So they sit **second**, after whatever opens the list — every pull-only entry
keeps its position and all seven profiles that learn an active racial cast it
once a fight. **A tank list puts them last instead**, for the reason
`protectionRotation.test.ts` already states about Charge: an entry above a
survival cooldown "would cost a survival cooldown the moment it was needed".

**What it costs is one poll per cast.** An off-GCD cast leaves the actor free, so
the next decision is 100ms away rather than a global cooldown — about 0.17% of a
fight, once per two or three minute cooldown. The same price Bloodrage and the
stance casts already pay at the top of the Warrior lists.

## No profile format bump, and one consequence of that

Race is already a required field, so nothing about the format changed and there
is no migration. **The passives therefore reach a profile saved before this
landed**, for the same reason its base stats do.

**The five ABILITIES do not, and that is the frozen-list decision rather than a
bug.** A saved profile carries its priority list in full — the owner's call, so
that "a saved file is a complete description of the build" — and loading never
re-derives one. So a file saved before this commit holds a list with no racial
entries, and its character will learn Blood Fury and never cast it. The panel
can add the entry back; `abilityChoicesFor` offers the build's own racial and no
other race's, which is what that took.

## What is NOT modelled, and the owner's list is the scope

Asked directly whether to build the traits their list omits, the owner ruled
that their list is the scope. So the other 25 traits are declared `unmodelled`
with the client's own text and a reason each, because an inert effect that
*says* it is inert is the honest failure mode and a trait nobody declared is
indistinguishable from one nobody noticed.

**15 traits do something; 20 effects carry a `scope` ruling and 11 are live
gaps**, counted per RACE by `racials.test.ts` and pinned there by hand.

```bash
grep -rhoE "scope: '[a-zA-Z]+'" src/game/racials/ | sort | uniq -c   # 19 declarations
```

**That grep is 19 and the census is 20, which is structural rather than drift.**
A grep counts declarations; the census counts per race, and the two Skyborne
races share three of their four traits — one declaration each for Walk on Air,
Elemental Insight and Wind Blessed, the arrangement Crusader already uses for its
three weapon slots. Walk on Air's one `positioning` tag is therefore two entries.
Worth saying because two figures that disagree by one is exactly what a stale
count looks like.

**Three of the live gaps are the clauses the owner was asked about by name and
declined**, and they carry no `scope` because a ruling is permanent by design
and these are questions:

| | what it would take |
| --- | --- |
| Orc **Shatter Curse** | its −15% magic damage is `damageTakenBySchool` over four schools, exactly as Stoneform does for physical |
| Troll **Regeneration** | nothing regenerates health outside the assumed healer, so there is no rate to raise |
| Skyborne **Read Ley Line** | mana return is explicitly not out of scope, and `resourceRegenMultiplier` would express it |

Four more are live gaps for a reason that is not a gap at all: Underwater
Breathing, Find Treasure, Engineering Specialization and Cultivation have **no
combat effect in any sense**. There is no `OutOfScope` member for "not combat"
and adding one is a scope decision that needs the owner, so each is declared
with a reason saying plainly that there is nothing to model — one honest line in
a census of eleven rather than a new permanent category chosen here.

And three name the creature TYPE — Beast Slaying, Big Game Hunter, Elemental
Insight. That is the target's cause in a shape this project had not met: not
"the boss is not a Beast" but "the encounter declares no creature type, so
nothing can ask".

## Tools

```bash
npx vite-node tools/probe_racials.ts        # does each mechanism do its thing
npx vite-node tools/probe_racial_worth.ts   # what one race is worth, by race swap
```

**`probe_racial_worth.ts` swaps the RACE on identical gear**, which is the only
honest isolation: a before-and-after against a pre-racial commit cannot separate
one race's contribution from the 100ms poll the list now pays, and removing an
item to isolate a weapon specialization removes the item's own stats too.

**The comparison race has to be chosen per profile and is printed**, because
there is no race with no racials at all. Both versions of this probe got it
wrong before getting it right:

- Taking the **weapon off** was useless. Obsidian Edged Blade and Azuresong
  Mageblade both carry "+1% crit with all spells and attacks", so the deltas
  came back 1.000 and 3.269 where the racial is 0 and 2.
- Comparing a Tauren Druid against a **Night Elf** measured Elune's Light: all
  three rows came back near −12 and read as the Tauren traits being worth
  negative DPS.
- Comparing a Human Paladin against an **Undead** measured "+2% crit minus Touch
  of the Grave".

A control race is clean only when its own four traits are inert for that build,
and the only way to know is to read them.

**The confounded run did leave one usable figure behind.** A Night Elf Cat Druid
measures 820.2 against a Skyborne's 811.5, so Elune's Light and Quickness
together are **+8.7 net of a point of haste** — the only number this project has
for Elune's Light, since no preset is a Night Elf. Stated as the compound it is
rather than attributed to one trait, which is the mistake that run made.

## What each race is worth, measured

30 batches of 10 per cell, race-swapped on identical gear. `REAL` means the
difference exceeds the combined 95% interval.

```
rogue_rupture      undead  vs troll       +17.2 +/- 6.3  REAL   Touch of the Grave, 5%
mage_arcane        gnome   vs human       +18.8 +/-13.7  REAL   Eureka! + 5% mana
lw_ranged          orc     vs troll       +14.0 +/- 9.5  REAL   Blood Fury + axe spec
pally_ret          human   vs dwarf       +13.6 +/-11.6  REAL   +2% crit from a sword
pally_shockadin    human   vs dwarf       +10.8 +/- 7.5  REAL   +2% crit from a sword
warlock_smds       undead  vs human       + 8.7 +/- 5.9  REAL   Touch of the Grave, 10%
bm_hunter          orc     vs troll       + 7.7 +/- 6.7  REAL   + pet crit
prot_pally         human   vs dwarf       + 6.4 +/- 5.1  REAL   on a TANK
dw_fury            orc     vs tauren      +10.7 +/-15.4  noise  Blood Fury alone
lw_melee           orc     vs troll       + 5.0 +/-10.7  noise  Blood Fury alone
shaman_elemental   troll   vs skyborne    + 2.8 +/- 9.6  noise  Berserking
shadow_priest      troll   vs dwarf       + 2.0 +/- 6.9  noise  Berserking
druid_moonkin      tauren  vs skyborne    + 1.4 +/-11.7  noise  5% health + 1% hit
prot_warr          tauren  vs skyborne    + 0.4 +/- 9.5  noise  on a TANK
mage_fire          gnome   vs human       + 0.3 +/-12.5  noise  Eureka! + 5% mana
warlock_firelock   undead  vs human       - 0.7 +/- 8.0  noise  Touch of the Grave, 10%
shaman_enhancement tauren  vs skyborne    - 1.8 +/-13.9  noise  5% health + 1% hit
druid_cat          tauren  vs skyborne    - 4.3 +/- 7.5  noise  5% health + 1% hit
druid_bear         tauren  vs skyborne    - 7.9 +/- 8.7  noise  on a TANK
```

### Three readings worth keeping

**Tauren is worth essentially nothing to all five of its profiles, and that is
correct rather than a failure to apply.** The usable melee and ranged hit cap is
8 and there is no miss floor, so a build already at the cap collects nothing from
Endurance's point of hit — the Cat carries 9% hit, the Bear 11% and the Prot
Warrior 8. And +5% health does nothing to a build nothing attacks. The **Cat
measured exactly 0.0 against the pre-racial baseline**, which is this project's
own tell for a patch that did not apply; here it is the honest answer, and what
proves it is that the Moonkin — whose *spell* hit was below the 16% cap — moved
+10.5 off the same trait in the same file.

**The Bear is slightly NEGATIVE, and that is the rage formula doing what it
says.** Forever's rage from damage taken is `D × 10 / H`, so a 5% bigger pool
makes each point of damage taken worth less rage. The Bear survives marginally
longer and earns marginally less, and both follow from the one number.

**Berserking is worth only about +2, far less than 10% haste for a sixth of the
fight suggests.** Haste does not reach the global cooldown in this engine, so on
a caster whose spells cast at or near the GCD a 10% cast-speed increase buys much
less than 10% more casts.

## Adding a race, or a trait

1. The race id goes in `RACE_IDS` and the definition in `RACES`, as
   `docs/character-creation.md` already describes.
2. A `RacialDefinition` goes in `RACIALS`, with **all four** traits — the ones
   that do nothing included, each with the client's text and a reason.
3. An active trait's ability goes in `RACIAL_ABILITIES` and its aura beside it.
   `createPlayer` **drops** an id the table does not carry, deliberately, so
   `racials.test.ts` is what asks whether the lookup missed.
4. `racials.test.ts` pins the census counts by hand. Re-count them rather than
   adjusting, which is this project's rule for every derived total.
