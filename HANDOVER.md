# Handover

Current state of SimForever, for picking up in a fresh context.

Architectural rules and conventions live in [CLAUDE.md](CLAUDE.md) and are not
repeated here. This file is **status**: where the project is, what was decided,
and what to do next.

---

## Where the project is

The **combat foundation is complete**. A character can be built from real
World of Warcraft: Forever data and fought against a level 63 raid boss, with
every number traced back to source data rather than invented.

What works end to end:

| | |
| --- | --- |
| **Character creation** | faction → race → class → combat style, with cascading validity |
| **Base stats** | all 65 race/class/form combinations at level 60, generated from the spreadsheet |
| **Stat conversions** | per class (and per Druid form), re-derived when a buff moves a primary stat |
| **Combat tables** | all six, on an integer 1–10000 die, derived from weapon skill vs defense skill |
| **Armor** | level-scaled, applied per damage event |
| **Resources** | rage from damage, energy in batches, mana on the five-second rule |
| **Abilities** | all 26 Warrior abilities from the ruleset spreadsheet, with weapon-damage scaling and on-next-swing |
| **Reactions** | content can respond to an attack result; Overpower fires off a target dodge |
| **Gear** | 18 real items and the Crusader enchant, equippable, driving stats and weapons |
| **Talents** | all 470 talents, nine classes, real data, spendable in the UI -- but NO talent has an effect |
| **Analysis** | DPS, per-ability breakdown with attempts/hits/crit/glance/avoid rates |
| **UI** | React panels driving the real engine; combat log; Monte Carlo batches |

**624 tests**, CI green on Node 20 and 22.

## The next task

**The remaining eight classes' abilities.** The Warrior is done — see
[docs/warrior-abilities.md](docs/warrior-abilities.md) for its source data and
its gaps. Each other class needs the same: a spreadsheet from the ruleset owner,
then definitions, a rotation and hand-transcribed tests.

Before that, one thing is worth closing:

**Effect values for the nine Warrior buffs and debuffs.** They are defined,
castable and completely inert. Until they arrive the rotation cannot use any of
them.

The reactive proc hook is now built. `Reaction` in `engine/combat/reactions.ts`
lets content watch an attack result and respond, and Overpower runs on it: the
target dodges, a window opens, the rotation spends 5 rage on it. Measured at
6.13% dodges over 4860 swings against an expected 6.5%, with 281 windows opening
and 257 of them used. A Rogue's Riposte and a Druid's Savage Defense want the
same hook.

An ability definition looks like this:

```typescript
export const MORTAL_STRIKE: Ability = {
  id: 'mortal_strike',
  name: 'Mortal Strike',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 30 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster, target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'physical',
      baseAmount: 160,
      // "Weapon Damage" in the sheet. The weapon's own damage and its attack
      // power contribution are supplied by the pipeline, and the off-hand
      // penalty applies once to the finished total.
      weaponScaling: { slot: 'mainHand' },
      attackTable: ability.attackTable,
      weaponSlot: 'mainHand',
    });
  },
};
```

Wire new abilities through `abilitiesForClass(class, style)` and
`rotationFor(class, style)` in `src/game/`. Both already take the combat style,
so per-style priority lists are a change to those two functions alone.

**Eight of the nine classes still do nothing.** Only the Warrior has content.

## Read this before trusting any number

The engine is correct; some of its **inputs are still invented**. In rough order
of how much they distort results:

1. **Weapon stats are placeholders UNTIL SOMETHING IS EQUIPPED.** A character
   with an empty Gear panel still swings the same imaginary weapon: 2.6s/80
   damage one-hand, 3.4s/140 two-hander, 2.9s/110 ranged, in
   `src/game/actors/weapons.ts`. Equipping a real weapon replaces it outright.

   There are now 18 real items to equip, but they are WoW CLASSIC items rather
   than Forever ones -- see `src/data/items/README.md`. So the placeholder
   problem is solved in shape and only half solved in substance.

   The attack power *coefficients* were never the problem: each is derived from
   its weapon's speed by the ruleset formula in `game/combat/weaponDamage.ts`.
2. **Bear/Cat paw swing speed and AP coefficients** are invented. The *damage*
   values (100 / 50) are real.
3. **No gear grants `hitChance`**, so miss is always the base value. Hit is a
   large part of melee and caster scaling.
4. **`manaRegenBypass`** exists as a stat but nothing grants it.

**The Warrior rotation now runs on real data, but its DPS is still not a
number to trust** — roughly 35 DPS over 400 iterations. Rage income comes from
placeholder weapon damage, and at ~0.9 rage/sec the warrior can barely afford a
30-rage Mortal Strike. Real weapon data will change the rotation's *shape*, not
just its total: Rend currently outranks Mortal Strike only because rage is
scarce and a bleed ignores armor. Re-measure the priority list when weapons
land.

**No buffs are applied at combat start.** `BATTLE_FURY`, an example aura
granting an invented +10% attack power, used to be applied to every player and
was removed. It inflated every figure the simulator produced, and made a
character sheet reading 400 attack power fight at 440. Real raid buffs go in
`simulator/trainingDummyEncounter.ts` when there is real data for them.

## Interpretations awaiting confirmation

Each is isolated in one place and cheap to flip. All are flagged in code.

| Interpretation | Where | If wrong |
| --- | --- | --- |
| `Armor_Reduction` computes the **damage multiplier**, not the reduction. Chosen because it reproduces the known ~40% figure for a 3731-armor boss; reading it the other way gives 61%. | `engine/combat/damage.ts` | Swap `armorReduction` / `armorDamageMultiplier` at the call site |
| **Enemy parry applies only to 1H & Shield** — read as "only a tank with a shield stands in front of the target". | `PARRYABLE_STYLES` in `game/combat/attackChances.ts` | Change that set, or key it off facing/threat |
| **Ranged uses the special-attack miss shape** with the ranged weapon's skill. No ranged formula was given. | `game/combat/attackChances.ts` | Add a ranged branch |
| **Thunder Clap, Intercept and Charge use the literal ranged table**, confirmed by the ruleset owner. A Warrior holds no ranged weapon, so weapon skill falls back to 5 x level. | `game/abilities/warrior.ts` | Change their `attackTable` |
| **Warrior stance gating is not implemented.** The sheet has no Battle Stance row and states no stance requirements; corrections are pending from the ruleset owner. | `game/abilities/warrior.ts` | Add `canCast` stance checks and re-run the rotation |
| **Moonkin and Tree of Life borrow Caster Form's base stats.** Neither has a spreadsheet row. | `FORM_STAT_FALLBACKS` in `game/character/baseStatLookup.ts` | Add rows to the spreadsheet and delete the fallback |
| **Bear/Cat `Mana: 0` means "not this form's resource"**, not "the pool is destroyed". A bear keeps its mana. | `MANA_REFERENCE_FORM`, same file | Change the constant |
| **Tree of Life uses mana** — it appeared in the conversion table but not the resource list. | `game/character/definitions.ts` | Change its `resource` |

## Key decisions, and why

Decisions whose rationale is not obvious from the code alone.

**Combat style and Druid form are one concept.** The Druid's five styles *are*
its forms. Two selectors would have had to agree with each other forever, so
`FormId` became `CombatStyleId`.

**Race/class ids live in TypeScript, not JSON**, deviating from "game data in
JSON". They are referenced across profiles, abilities and traits, and literal
union types turn a typo into a compile error. JSON widens strings to `string`.
Bulk external content still belongs in `src/data`.

**Profile `stats` are gear bonuses, added on top of the race/class base** — not
the character's stats from scratch.

**Faction is derived from race, not stored**, so an Alliance Orc is
unrepresentable rather than merely invalid.

**Level is fixed at 60** and not editable, but the field stays on the profile
and validation accepts 1–60 so level-scaling formulas can be written per level.

**Rage generation is purely proportional with no flat component**, so a missed
swing generates nothing. This is what makes the dual-wield miss penalty hurt
twice: less damage *and* less rage.

**The mana tick keeps firing during the five-second lockout**, granting 0 or the
bypass fraction, so regeneration resumes by itself with nothing to restart.

**Single-roll vs two-roll tables are substantively different.** Single-roll
makes a large miss chance crowd crit off the table; two-roll gives specials the
character's true crit rate among landed hits.

## Where things are

```
src/
├── engine/          rules only — no React, no DOM, no globals
│   ├── combat/      attackTable, damage, healing, autoAttack, ratings
│   ├── simulation/  Simulation (implements SimulationContext), clock, config
│   ├── events/      EventQueue (binary heap), EventPriority
│   ├── stats/       StatBlock with the derivation function
│   ├── resources/   Resource, regeneration timers
│   ├── effects/     auras
│   ├── abilities/   Ability, AbilityBook, casting rules
│   └── logging/     telemetry events, sinks, combat log formatting
│
├── game/            Forever content
│   ├── character/   races, classes, combat styles, base stats, conversions
│   ├── combat/      attackChances (the combat table numbers), resourceRules
│   ├── actors/      createPlayer, createTrainingDummy, weapons
│   ├── abilities/   warrior.ts (real), exampleAbilities.ts (the other classes)
│   └── rotations/   rotationFor(class, style)
│
├── analysis/        analyzers; SimulationResult
├── simulator/       runProfile, runProfileBatch, trainingDummyEncounter
├── profiles/        versioned profiles (format v3), validation, migration
└── ui/              React panels
```

Longer explanations: [`docs/`](docs/) — `architecture.md`,
`simulation-engine.md`, `combat-tables.md`, `character-creation.md`,
`resources.md`, `telemetry.md`, `profiles.md`.

## Data the project still needs

Roughly in order of value:

1. **Weapon data**, to replace the placeholders. Now the single biggest
   distortion, because it drives ability damage and rage income alike.
2. **Effect values for the Warrior's nine buffs and debuffs**, and ability
   definitions for the other eight classes.
3. **Hit from gear**, so miss stops being fixed.
4. **Bear/Cat paw swing speed and AP coefficients.**
5. **Talent EFFECTS.** The trees themselves are now real data for ALL NINE
   CLASSES in `src/data/talents/*.json`, read from the Forever talent
   calculators, and points can be spent in the UI. Not one of the 470 talents
   does anything: a full build and an empty one produce identical numbers. Several hooks already anticipate
   them -- `offHandDamageMultiplier`, `resourceMaximums`, `manaRegenBypass`,
   `WeaponProfile.skill`.

   Talents also need to GATE abilities. Mortal Strike, Bloodthirst and Shield
   Slam are 31-point capstones in three different trees, so a warrior can reach
   exactly one; `abilitiesForClass` currently grants all three.
6. **Item data**, which the gear panel is a mock-up for: seventeen slots, an
   item and an enchant each, every list empty because nothing exists to fill it.

## Built but unreachable

- **Table 6 (attacks received by the player)** — nothing attacks the player yet.
  Player parry within it is 0, not guessed, because it needs a defense stat.
- **Rage from damage taken** — implemented and wired, never fires.
- **Healing** — full pipeline with overhealing; no content heals.
- **Resource waste analysis** — telemetry records every gain with the amount lost
  to the cap, so rage capping and mana downtime are measurable. No analyzer
  reports them yet. Cheap and useful before tuning a real rotation.
