# Handover

Current state of SimForever, for picking up in a fresh context.

Architectural rules and conventions live in [CLAUDE.md](CLAUDE.md) and are not
repeated here. This file is **status**: where the project is, what was decided,
and what to do next.

---

## Where the project is

A **fully geared Warrior can be built and fought**, end to end, with every
number traced to a source rather than invented. The other eight classes have
their talent trees and nothing else.

| | |
| --- | --- |
| **Character creation** | faction → race → class → combat style, with cascading validity |
| **Base stats** | all 65 race/class/form combinations at level 60, generated from the spreadsheet |
| **Stat conversions** | per class (and per Druid form), re-derived when a buff moves a primary stat |
| **Combat tables** | all six, on an integer 1–10000 die, derived from weapon skill vs defense skill |
| **Armor** | level-scaled, applied per damage event |
| **Resources** | rage from damage, energy in batches, mana on the five-second rule |
| **Abilities** | all 26 Warrior abilities from the ruleset spreadsheet, with weapon-damage scaling and on-next-swing |
| **Reactions** | content responds to an attack result: Overpower off a target dodge, and every item proc |
| **Gear** | 18 items and the Crusader enchant, equippable, driving stats, weapons and procs |
| **Procs** | PPM (Vis'kag, Crusader) and flat-chance with an internal cooldown (Hand of Justice) |
| **Talents** | all 470 talents, nine classes, spendable in the UI, saved on the profile, and **gating which abilities a character has**. No talent changes any other number yet |
| **Analysis** | DPS, per-ability breakdown with attempts/hits/crit/glance/avoid rates |
| **UI** | two-step character flow, per-class character sheet, style-aware gear, talent trees, combat log, Monte Carlo batches |

**684 tests**, CI green on Node 20 and 22. Profile format **v5**.

The app is **live at <https://donz-dev.github.io/SimForever/>**, republished by
`.github/workflows/deploy.yml` on every push to `main` that passes the tests.
See [docs/deployment.md](docs/deployment.md) for the one manual setting it needs
and why a production build carries a `/SimForever/` path prefix.

A geared dual-wield Warrior runs at roughly **140 DPS** against a level 63
dummy. That figure is meaningful for comparing changes to each other; see
"Read this before trusting any number".

## The next task

Two candidates, and they are not close in value.

### 1. Talent effects — the biggest gap between what is shown and what is computed

470 talents across nine classes are real data, and **gating is the only thing
any of them does**. Taking Mortal Strike gives you Mortal Strike; taking
Deflection still does nothing at all.

**Gating is done** — talents live on the profile at format v5, and
`abilitiesForClass` grants Mortal Strike, Bloodthirst, Shield Slam and Spearing
Strike only to a character whose allocation contains them. See
`docs/talent-effects-proposal.md`.

What remains is the effects themselves, and one decision:

- **How a talent expresses its effect.** A stat modifier, a modifier on an
  existing ability, or a new ability entirely. All three occur in the first ten
  Warrior talents. The proposal recommends a declarative union with a function
  escape hatch; it has not been accepted or rejected.
- **The per-rank values exist but are not captured.** `src/data/talents/values/`
  holds an entry for all 470 talents; three have values and 467 are `null`. See
  that directory's README.

### 2. The remaining eight classes' abilities

The Warrior is the worked example. Each other class needs a spreadsheet from the
ruleset owner, then definitions, a rotation and hand-transcribed tests. See
[docs/warrior-abilities.md](docs/warrior-abilities.md) for the pattern and the
provenance record.

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
`rotationFor(class, style)`, and new procs through `reactionsForClass`. All
three already take what they need, so adding a class is a change to those
functions alone.

## Waiting on the ruleset owner

Work that is blocked, not merely unstarted.

| Needed | Blocks |
| --- | --- |
| **Warrior stance gating** — which abilities require which stance. Corrections were promised and never arrived. The sheet has no Battle Stance row at all. | Stances are defined but gate nothing; the rotation does not stance dance |
| **Effect values for nine Warrior buffs/debuffs** — Battle Shout, Demoralizing Shout, Sunder Armor, Recklessness, Berserker Rage, Bloodrage, Shield Wall, Shield Block, and both stances. Costs and cooldowns are known; magnitudes and durations are not. | All nine are castable and completely inert, and deliberately absent from the rotation |
| **Ability spreadsheets for the other eight classes** | Those classes fight with auto-attacks only |
| **Forever item data** | The 18 items are WoW Classic, not Forever |

**Resolved, do not re-litigate:** Mortal Strike is weapon damage **+160**. The
Forever talent calculator says "plus 85"; the ruleset owner confirmed 160 and
the calculator tooltip is wrong.

## Read this before trusting any number

The engine is correct. Some of its **inputs are still invented**, in rough order
of how much they distort results.

1. **The items are WoW CLASSIC, not Forever.** The Tier 1 Unstoppable Might set
   is Season of Discovery. They were chosen deliberately, to replace invented
   placeholder weapons with real numbers, but a Forever item of the same name may
   carry different values. See `src/data/items/README.md`.

2. **An empty gear slot still uses a placeholder weapon** — 2.6s/80 one-hand,
   3.4s/140 two-hander, 2.9s/110 ranged, in `src/game/actors/weapons.ts`.
   Equipping anything real replaces it outright. The attack power *coefficients*
   were never invented: each derives from its weapon's speed by the ruleset
   formula in `game/combat/weaponDamage.ts`.

3. **Four item effects are equipped and do nothing**, listed in the Gear panel
   under "Equipped but not simulated": all Fire Resistance (not a stat the
   engine has) and Crusader's heal (nothing damages the player). A geared
   character is weaker here than in the game by exactly that much.

4. **Bear/Cat paw swing speed and AP coefficients** are invented. The *damage*
   values (100 / 50) are real.

5. **`manaRegenBypass`** exists as a stat but nothing grants it.

**No buffs are applied at combat start.** `BATTLE_FURY`, an example aura
granting an invented +10% attack power, used to be applied to every player and
was removed — it inflated every figure and made a sheet reading 400 attack power
fight at 440. Real raid buffs go in `simulator/trainingDummyEncounter.ts` when
there is real data for them.

**The rotation was last tuned against placeholder weapons.** Rend outranks
Mortal Strike in the priority list because rage was scarce and a bleed ignores
armor. With real weapons the rage economy is completely different, so
`game/rotations/warrior.ts` is worth re-measuring. The method that produced the
current ordering is in that file's comments.

## Interpretations awaiting confirmation

Each is isolated in one place and cheap to flip. All are flagged in code.

| Interpretation | Where | If wrong |
| --- | --- | --- |
| `Armor_Reduction` computes the **damage multiplier**, not the reduction. Chosen because it reproduces the known ~40% figure for a 3731-armor boss; reading it the other way gives 61%. | `engine/combat/damage.ts` | Swap `armorReduction` / `armorDamageMultiplier` at the call site |
| **Enemy parry applies only to 1H & Shield** — read as "only a tank with a shield stands in front of the target". | `PARRYABLE_STYLES` in `game/combat/attackChances.ts` | Change that set, or key it off facing/threat |
| **Ranged uses the special-attack miss shape** with the ranged weapon's skill. No ranged formula was given. | `game/combat/attackChances.ts` | Add a ranged branch |
| **Thunder Clap, Intercept and Charge use the literal ranged table**, confirmed by the ruleset owner. | `game/abilities/warrior.ts` | Change their `attackTable` |
| **Which gear slots take an enchant** follows the usual Classic pattern and is a placeholder. It decides only whether a second dropdown is drawn. | `GEAR_SLOTS` in `ui/panels/GearPanel.tsx` | Edit the flags |
| **Moonkin and Tree of Life borrow Caster Form's base stats.** Neither has a spreadsheet row. | `FORM_STAT_FALLBACKS` in `game/character/baseStatLookup.ts` | Add rows to the spreadsheet and delete the fallback |
| **Bear/Cat `Mana: 0` means "not this form's resource"**, not "the pool is destroyed". | `MANA_REFERENCE_FORM`, same file | Change the constant |
| **Tree of Life uses mana** — it appeared in the conversion table but not the resource list. | `game/character/definitions.ts` | Change its `resource` |

## Key decisions, and why

Decisions whose rationale is not obvious from the code alone.

**Combat style and Druid form are one concept.** The Druid's five styles *are*
its forms. Two selectors would have had to agree with each other forever.

**Race/class ids live in TypeScript, not JSON.** Literal union types turn a typo
into a compile error; JSON widens strings to `string`. Bulk external content
(talents, items) still belongs in `src/data`.

**Talent ids are unique WITHIN a class, not across.** Thirteen collide —
`deflection` belongs to the Hunter, Paladin, Rogue and Warrior with different
rank caps. Every function in `talentRules.ts` takes a `ClassTalents` for that
reason; a global index would answer with whichever class loaded last.

**Talents live on the profile, at format v5.** They were UI state for as long as
they changed nothing — persisting them would have meant a format version and a
migration for data nothing read. Gating abilities is what made them matter, so
that is when they moved.

**An empty allocation is not a neutral default.** From v5 it means a warrior
knows no Mortal Strike, Bloodthirst or Shield Slam, because all three are
31-point capstones. A migrated v4 profile therefore fights *weaker* than it did
before — the old number was wrong, not the new one.

**Equipment is stored as item ids, not copies.** An item's numbers belong to the
item data; a profile carrying its own would drift the moment that data was
corrected.

**A two-hander and a one-hand set can both be stored.** Only the slots the combat
style uses contribute, stats included, so a dual-wielder cannot bank the
two-hander's +42 strength. The RANGED slot is not exclusive: a bow contributes
its stats to a melee character and simply does not swing.

**Faction is derived from race, not stored**, so an Alliance Orc is
unrepresentable rather than merely invalid.

**Level is fixed at 60** and not editable, but the field stays on the profile and
validation accepts 1–60 so level-scaling formulas can be written per level.

**Rage generation is purely proportional with no flat component**, so a missed
swing generates nothing. That is what makes the dual-wield miss penalty hurt
twice: less damage *and* less rage.

**The mana tick keeps firing during the five-second lockout**, granting 0 or the
bypass fraction, so regeneration resumes by itself with nothing to restart.

**Single-roll vs two-roll tables are substantively different.** Single-roll makes
a large miss chance crowd crit off the table; two-roll gives specials the
character's true crit rate among landed hits.

**Every run draws a fresh seed.** Two clicks of Run on an unchanged setup should
show the spread the fight actually has; a fixed seed repeated one fight and made
a noisy result look certain. The profile's own seed is untouched.

## Where things are

```
src/
├── engine/          rules only — no React, no DOM, no globals
│   ├── combat/      attackTable, damage, healing, autoAttack, reactions, ratings
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
│   ├── combat/      attackChances, resourceRules, weaponDamage (the speed/14 formula)
│   ├── actors/      createPlayer, createTrainingDummy, placeholder weapons
│   ├── abilities/   warrior.ts (real), abilitiesForClass.ts (the lookup)
│   ├── auras/       warrior.ts — Rend is real, the rest are PLACEHOLDER
│   ├── items/       Item, itemData (loads the JSON), equipment, procs
│   ├── reactions/   reactionsForClass — Overpower and Revenge
│   ├── talents/     Talent, talentData (loads nine JSON files), talentRules
│   └── rotations/   warrior.ts, rotationFor(class, style)
│
├── data/            bulk content from external sources, as JSON
│   ├── items/       classic-warrior.json + README (how it was scraped)
│   └── talents/     one file per class + README (how they were scraped)
│
├── analysis/        analyzers; SimulationResult
├── simulator/       runProfile, runProfileBatch, trainingDummyEncounter
├── profiles/        versioned profiles (format v4), validation, migration
└── ui/              React panels
```

Longer explanations: [`docs/`](docs/) — `architecture.md`,
`simulation-engine.md`, `combat-tables.md`, `character-creation.md`,
`resources.md`, `telemetry.md`, `profiles.md`, `warrior-abilities.md`.

`ProfilePanel.tsx` is **not mounted**. Import and Load buttons sit above the
character name as placeholders; the panel's serialize-out / parse-in / render-
issues round trip is exactly what they need, which is why it was kept.

## Data the project still needs

Roughly in order of value.

1. **Talent effects**, and talents gating abilities. See "The next task".
2. **Ability spreadsheets for the other eight classes.**
3. **Effect values for the Warrior's nine inert buffs and debuffs.**
4. **Forever item data**, to replace the Classic stand-ins. More items of any
   kind also help: there are no shields at all, so the 1H & Shield style has an
   empty slot, and no one-handed weapon grants weapon skill, so a dual-wielder's
   two combat tables cannot yet diverge.
5. **Bear/Cat paw swing speed and AP coefficients.**
6. **A `block` outcome and a block value stat.** Revenge triggers on block in
   Classic and the engine has no such outcome, so it catches two thirds of what
   it should; Shield Slam is missing its "+ shield block value". One stat, two
   fixes.

## Built but unreachable

- **Table 6 (attacks received by the player)** — nothing attacks the player yet.
  Player parry within it is 0, not guessed, because it needs a defense stat.
- **Rage from damage taken** — implemented and wired, never fires.
- **Revenge** — reaction wired and tested, but it needs the warrior to be
  attacked.
- **Healing** — full pipeline with overhealing; no content heals.
- **Resource waste analysis** — telemetry records every gain with the amount lost
  to the cap, so rage capping and mana downtime are measurable. No analyzer
  reports them yet. Cheap and useful before tuning a rotation.
