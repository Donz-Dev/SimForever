# Talent effects — a design proposal

**Status: proposal. Nothing here is implemented.** It exists to settle two
decisions before any talent effect is written, because both are expensive to
change once 470 talents depend on them.

The two decisions, as [HANDOVER.md](../HANDOVER.md) states them:

1. **How a talent expresses its effect.**
2. **Talents must gate abilities** — `abilitiesForClass` hands out Mortal
   Strike, Bloodthirst *and* Shield Slam, which three 31-point capstones in
   three different trees make impossible.

A third thing — not a design decision but a data gap — was the largest obstacle
in the first draft: 77% of talents had no values beyond rank one, and it was
unknown whether any source held the rest. **That is now resolved**; see "The
rank problem" below.

---

## What the talents actually demand

Not a survey of WoW in general — the first twelve talents of the Warrior's Arms
tree, which is the tree we have real abilities for. Every row is real data from
`src/data/talents/warrior.json`.

| Talent | Ranks | What it does | Shape |
| --- | --- | --- | --- |
| Improved Heroic Strike | 3 | Heroic Strike costs 1 less rage | changes a field on an ability |
| Deflection | 5 | +1% parry | changes a stat |
| Improved Rend | 3 | +12% Rend bleed damage | changes an aura's damage |
| Improved Charge | 2 | Charge generates +3 rage | changes a number *inside* `onCast` |
| Improved Tactical Mastery | 5 | retain rage on stance change | needs stances to mean something |
| Improved Overpower | 2 | +25% crit **on Overpower only** | per-ability crit; engine has none |
| Anger Management | 1 | 1 rage every 3 sec in combat | a passive aura with a periodic tick |
| Deep Wounds | 3 | crits apply a bleed | a reaction to an attack result |
| Spearing Strike | 1 | a new attack, 40% weapon damage | grants an ability |
| Two-Handed Weapon Spec | 3 | +1% damage with two-handers | a conditional damage multiplier |
| Impale | 2 | +10% crit damage bonus | changes the crit multiplier |

Eleven talents, seven distinct mechanisms. Any design that assumes talents are
"just stat bonuses" dies at row 0.

Across all nine classes, a deliberately crude keyword pass over the 470
descriptions puts them roughly at: ~150 that modify a named ability, ~100
triggered by an event, ~50 plain stat changes, ~18 that grant an ability, and
~143 the regex could not classify. **Those numbers are indicative, not
authoritative** — they are here to justify the shape of the taxonomy, not to be
quoted. The honest reading is: modifying an existing ability is the single most
common thing a talent does, and plain stat changes are a minority.

---

## The rank problem — resolved

**This was the largest obstacle in the first draft of this proposal. It is now
answered, and the answer was yes.**

The original scrape took `data-simple-tooltip`, which holds the rank-one text
only, so 361 of the 470 talents — 77% of them — had no values beyond rank one.
The open question was whether the Forever calculator exposed the rest at all.

It does. The calculator **rewrites the tooltip as points go in**, so reading
rank three of a talent means putting three points into it:

| Points | Tooltip |
| --- | --- |
| 1 | Reduces the cost of your Heroic Strike ability by **1** Rage |
| 2 | ...by **2** Rage |
| 3 | ...by **3** Rage |

Deflection reads 1/2/3/4/5 and Flurry 5/10/15/20/25 the same way.

Those values now live in [`src/data/talents/values/`](../src/data/talents/values/),
one hand-editable file per class, holding the text with a `{0}` where the number
goes and the value at each rank. `tools/talent_ranks_browser.js` captures them
and `tools/derive_talent_values.js` folds a capture in.

**What this changes for the design below.** Nothing structural — `perRank` was
already an explicit array rather than a formula, precisely so that unknown ranks
could not be extrapolated. What changes is the prognosis: the effects work is no
longer gated on a data source that might not exist. The remaining risk is
ordinary and bounded.

**What is still outstanding:**

- **The bulk capture is not done.** Three of 470 values are filled; the rest are
  `null`, meaning not known yet rather than zero. Wowhead began returning 403
  partway through the nine classes. Re-running it is two documented steps in
  `src/data/talents/values/README.md`.
- **Assuming linear ranks remains forbidden.** It always was, and now there is
  no excuse for it whatsoever: the real numbers are one capture away.
- **The calculator is a source, not an authority.** It says Mortal Strike is
  weapon damage "plus 85"; the ruleset owner confirmed 160. Where the two
  disagree the owner wins, which is why `fill` will not overwrite an existing
  value without `--overwrite`.
- **A ruleset-owner talent spreadsheet would still be better** than scraped
  tooltips, for the same reason it was better for abilities. It is no longer
  blocking, though — it is a cross-check.

---

## Decision 1 — how a talent expresses its effect

### The options

**A. A function per talent.** `apply(build) { build.stats.critChance += 1 }`.
Maximum flexibility, no schema to fight. But nothing outside the function can
say what a talent does, so the UI cannot show it, a test has to run it to check
it, and 470 of them become 470 small bespoke programs.

**B. Pure data.** A closed union of effect descriptions. Analysable, testable,
serialisable, and the UI can render "what this build changes" for free. But
every unusual talent needs a new variant, and WoW talents are mostly unusual
ones.

**C. Data with an escape hatch.** A closed union for the shapes that recur,
plus a variant carrying a function for the ones that do not.

### Recommendation: C

It is also what the codebase already does, twice. `AuraDefinition` is data —
`statModifiers`, `damageDoneMultiplier`, `periodic` — with `onApply` / `onExpire`
hooks for what data cannot express. `Ability` is the same: declared `cost`,
`cooldownMs`, `attackTable`, and `onCast` for the rest. A talent that is data
where it can be and a function where it must be is the third instance of a
pattern, not a new idea.

### The proposed type

```typescript
/** One talent's effect. `perRank[i]` is the value at rank i+1. */
export type TalentEffect =
  /* +1% parry. Lands as a StatModifier, exactly like a buff or an item. */
  | { kind: 'stat'; stat: StatName; operation: StatModifierOperation; perRank: readonly number[] }

  /* Heroic Strike costs 1 less rage. Applies before the fight starts. */
  | { kind: 'abilityField'; abilityId: string; field: AbilityField; perRank: readonly number[] }

  /* Spearing Strike. The ability already exists; the talent is what grants it. */
  | { kind: 'grantAbility'; abilityId: string }

  /* Anger Management. An aura applied at combat start. */
  | { kind: 'aura'; auraId: string; perRank?: readonly number[] }

  /* Deep Wounds. A reaction, the same mechanism Overpower and Vis'kag use. */
  | { kind: 'reaction'; reactionId: string; perRank?: readonly number[] }

  /* The escape hatch: Improved Charge's +3 rage lives inside onCast. */
  | { kind: 'custom'; describe: string; apply: (build: CharacterBuild, rank: number) => void }

  /* The honest failure mode. Carries the source's own words. */
  | { kind: 'unmodelled'; text: string; reason: string };
```

### Why `unmodelled` is the most important variant

It is not a placeholder for a missing case. It is the same mechanism items
already use, and it has already proven itself on this project.

`CLAUDE.md` records why:

> Items carry an `unmodelled` list holding the source's exact text and one line
> on why it does nothing, and the Gear panel prints every one under "Equipped
> but not simulated". [...] which is what kept Crusader granting nothing until
> its proc rate arrived, rather than quietly inheriting a plausible one.

The talent panel should grow the same thing — **"Chosen but not simulated"** —
and on day one it will list almost every talent. That is the point. The current
state, where the panel shows a single blanket warning and every talent is
silently inert, is less informative than a per-talent reason.

### Per-rank values, not a formula

`perRank` is an explicit array, so Improved Rend is `[12, 24, 36]` if the ranks
turn out to be linear and `[12, 20, 30]` if they do not — and, critically, a
talent whose ranks 2+ are unknown **cannot be written at all** rather than
being quietly extrapolated. A `perRank` shorter than the talent's `ranks` should
be a load-time validation error, in the same spirit as `talentData.ts` already
throwing on a bad tier or an unresolvable prerequisite.

**Where `perRank` comes from.** It should read
`src/data/talents/values/<class>.json` rather than restating those numbers in
TypeScript. That file already holds a value per rank, is hand-editable for
balance changes, and is deliberately separate from the scraped tree structure.
Duplicating its numbers into an effect definition would recreate exactly the
drift the items data avoided by storing item ids on a profile instead of copies.

That leaves the effect definition saying *what a talent does with its number*
and the values file saying *what the number is* — which is the same split as
"rules go in `engine`, numbers go in `game`", one level down.

---

## Decision 2 — talents gate abilities

### The problem, concretely

All three capstones are row 6, one rank, in three different trees:

```
arms       r6  Mortal Strike  [1]
fury       r6  Bloodthirst    [1]
protection r6  Shield Slam    [1]
```

51 points cannot reach two of them. `abilitiesForClass` currently returns all
three to every Warrior, minus Shield Slam for anyone without a shield. Spearing
Strike, a 1-rank Arms talent, is also handed to everyone.

### Proposed change

```typescript
export function abilitiesForClass(
  characterClass: ClassId,
  style?: CombatStyleId,
  talents?: TalentAllocation,   // new, optional
): readonly Ability[]
```

Talent-granted abilities come out of the unconditional list and are added back
only when the allocation contains their talent. Making the parameter optional
keeps every existing test and call site compiling, and an omitted allocation
means "no talents", which is the correct reading rather than a lenient one.

The same allocation then flows to the three other seams, all of which already
exist and already take what they need:

| Effect kind | Seam | Exists today |
| --- | --- | --- |
| `stat` | `createPlayer`'s `bonusStats` | yes |
| `abilityField`, `grantAbility` | `abilitiesForClass` | yes, needs the parameter |
| `aura` | opening buffs in `trainingDummyEncounter` | yes — the slot is there, deliberately empty |
| `reaction` | `reactionsForClass` | yes, used by Overpower and Revenge |
| resource caps, off-hand penalty | `createPlayer` options | **already built for this** |

That last row is worth noting: `createPlayer` already carries
`offHandDamageMultiplier` ("talents that change it pass a value here") and
`resourceMaximums` ("for talents that do so"). The seams were left open.

### Talents have to move onto the profile

They are UI state today, which HANDOVER explains was deliberate:

> Talents live in UI state, not on the profile. They have no effect yet, and
> persisting them would mean a format version and a migration for data nothing
> reads. That comes with the effects.

This is that moment. **Profile format v5**, a `talents: TalentAllocation`
section, and a migration step reading an absent one as `{}`.

### One consequence worth deciding early

`game/rotations/warrior.ts` reserves 30 rage for Mortal Strike by id, and the
comment is explicit that this is a rotation heuristic rather than ruleset data.
The moment Mortal Strike is gated, a Fury warrior pools rage for an ability they
can never cast, and their DPS drops for a reason that has nothing to do with
their talents.

So `rotationFor` needs the allocation too, or at minimum the reserve has to
become conditional on the ability being present. This is cheap if it is done in
the same change and confusing if it is discovered later.

---

## What this needs that the engine does not have

Honest list, from reading the code rather than guessing.

| Needed | For | Why it is missing |
| --- | --- | --- |
| **Per-ability crit** | Improved Overpower (+25% crit on Overpower) | `AttackContext` carries only `slot`. Crit comes from `stats.critChance` at `attackTable.ts:345`. Cheapest fix: a `critChanceBonus` on `DamageRequest`. |
| **A crit damage multiplier** | Impale (+10% crit bonus) | The crit multiplier is fixed in the attack table. |
| **`parryChance` as a stat** | Deflection (+1% parry) | `STAT_NAMES` has `parryRating`, not `parryChance`, and player parry is deliberately 0 pending a defense stat. |
| **A block outcome and block value** | Shield Slam's "+ block value", Revenge on block | Already the sixth item on HANDOVER's data list. One stat, two fixes. |
| **Stances that gate anything** | Improved Tactical Mastery, and any stance talent | Already blocked on the ruleset owner. |
| **Conditional damage multipliers** | Two-Handed Weapon Specialization | Multipliers are whole-character via auras; nothing is conditional on weapon type. |

None of these is large. All of them are easier to add before 470 talents assume
their absence.

---

## Suggested order

1. **Finish the values capture.** The mechanism works and the files exist; 467
   of 470 values are still `null` because wowhead started returning 403. Two
   documented steps, and everything after this is cheaper for having real
   numbers to test against.
2. **Profile v5** with a talents section and its migration. Small, self-contained,
   and unblocks everything.
3. **Gate the abilities.** Pass the allocation to `abilitiesForClass` and
   `rotationFor`. This fixes a *current wrongness* — three capstones at once —
   independently of any talent doing anything, so it is worth landing on its own.
4. **The `TalentEffect` type plus `unmodelled`**, and the "Chosen but not
   simulated" panel. At this point every talent is honestly described and none
   of them lie.
5. **The `stat` and `abilityField` kinds**, which together cover the largest
   share, for whichever talents have trustworthy numbers.
6. **The engine gaps above**, each with the talents that need it.
7. **`reaction` and `aura` kinds**, which are the most interesting and the most
   likely to need per-talent code.

Steps 2 and 3 are worth doing even if Decision 1 is rejected outright.

## What I would not do

- **Not a talent DSL or a rules engine.** Seven variants and an escape hatch is
  a type, not a language.
- **Not a global talent id index.** Ids collide across classes — `deflection`
  belongs to four of them — and every function in `talentRules.ts` already
  takes a `ClassTalents` for that reason.
- **Not talent effects in `engine`.** They are content. The engine gains generic
  capabilities (per-ability crit, a block outcome); `game` gains the numbers.
- **Not a linear rank formula**, under any deadline pressure. That is the one
  choice that would quietly invalidate every number the simulator produces.

---

## The two questions to answer

1. **Decision 1:** option C — declarative union, function escape hatch,
   `unmodelled` for everything without real data. Accept, or prefer A or B?
2. **Decision 2:** talents move onto the profile at v5 and gate abilities via
   `abilitiesForClass` and `rotationFor`. Accept?

The third question — **where do per-rank values come from** — is answered: the
calculator exposes them, `src/data/talents/values/` holds them, and the capture
just needs finishing. A ruleset-owner talent spreadsheet would still be a
worthwhile cross-check, but nothing is blocked on it.
