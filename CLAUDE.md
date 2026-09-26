# SimForever — working notes for Claude

An event-driven combat simulator for **World of Warcraft: Forever**, a custom
ruleset heavily based on Classic. TypeScript + React + Vite + Vitest.

This file is a **reference**: the rules, and what breaks if you get one wrong.
Every line is here because the alternative produced, or would have produced, a
plausible wrong number. Status is [HANDOVER.md](HANDOVER.md); detail is behind
each link.

## Commands

```bash
npm run dev          # dev server (port 5173)
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build
```

Run `npm run typecheck` **and** `npm test` before opening a PR. The typechecker
catches what the tests do not — a mutation of a shared readonly array, a stat
rename that silently invalidated a test.

## The one architectural rule

> **The simulation engine is completely independent of the UI.**

`src/engine` imports no React, touches no DOM, holds no module-level mutable
state. Everything a running simulation needs arrives through a
`SimulationContext`. An arrow pointing back up means something is in the wrong
layer.

```
ui  ──▶  simulator  ──▶  engine
                   ├──▶  analysis  ──▶  (engine types only)
                   ├──▶  game      ──▶  engine
                   └──▶  profiles  ──▶  engine, game/character, game/talents
```

| | |
| --- | --- |
| `engine` | the rules. How combat works. Knows nothing about warriors or fireballs |
| `game` | the content. Races, classes, abilities, talents, items, the Forever numbers |
| `data` | bulk content from external sources, as JSON. A script writes it; nothing hand-edits it |
| `analysis` | telemetry → statistics. Never touches a live simulation |
| `simulator` | the only place engine + game + analysis meet. The UI imports from here |
| `profiles` | versioned JSON character configuration |

**Rules go in `engine`, numbers go in `game`.** When the engine needs a ruleset
number it takes it as an injected function or value — `SimulationConfig.attackChances`,
`StatBlock`'s derivation parameter. See [docs/architecture.md](docs/architecture.md).

## Scope: what is deliberately not modelled

Rulings by the project owner. **Permanent classifications, not a work queue** — a
talent blocked on one of these is not an engine gap, and writing it up as pending
inflates the queue and hides the real items.

**A RULING IS DATA, NOT PROSE.** An `unmodelled` effect carries a `scope` from the
`OutOfScope` union when the owner has ruled its effect out, and nothing otherwise.
That is the whole difference between a decision and a gap, and prose could not
carry it: "the engine has no positions" and "nothing attacks the player" read
identically and only one of them expires. `tests/game/outOfScope.test.ts` matches
the WORDING, so a class nobody has written yet cannot file a ruled-out concept as
outstanding work, and the Talent panel lists the two separately — showing them
together told someone their build was missing features that were never coming.

| `scope` | Covers | Entries |
| --- | --- | --- |
| `positioning` | positions, range, facing, movement, "nearby", radius, travel forms | 17 |
| `crowdControl` | stuns, fears, roots, snares, silences, incapacitates, disorients, disarms | 32 |
| `threat` | threat, which is not tracked. Defensive Stance's +30% and Defiance are dropped, not deferred | 14 |
| `healing` | healing THROUGHPUT. **Mana RETURN is NOT out of scope** — it changes a damage profile's sustain, so it is a live gap and gets no `scope` | 33 |

Adding a member to that union is a scope DECISION and needs the owner, not a
judgement call while writing a class. Two things the rulings do NOT cover and that
are still open questions: **stealth openers** (eleven Rogue talents, inert because
every fight opens in combat) and **totems as entities** (five Shaman talents).

## Conventions that prevent real bugs

### Time, numbers, telemetry

- **Time is integer milliseconds** below the UI. Seconds appear only in profiles
  and formatted output; `seconds()` / `toSeconds()` are the only conversions.
- **Combat rolls are integers 1–10000** and percentages are **truncated** into
  that space (`toRollUnits`): 25.7891% → 2578, never 2579. Floats would make an
  outcome depend on summation order.
- **Telemetry is the single source of truth.** No running totals in the engine.
  The combat log is a pure formatter over the same stream the analyzers read, so
  they cannot disagree. A new statistic is a new analyzer, never a counter
  threaded through combat code. [docs/telemetry.md](docs/telemetry.md)
- **`attempts` and `hits` are different numbers.** Avoided attacks emit a damage
  event with `amount: 0`; averaging over attempts folds every miss in as a zero.
- **Same-timestamp events** sort by `(timestamp, priority, insertion order)`.
  `Periodic` sorts before `AuraExpiration`, so a DoT's final tick — due at the
  moment it falls off — still lands.
- **Stats are base + modifiers, never mutated in place.** Derived stats are
  produced by a *function* on the stat block so they re-derive when a buff moves
  a primary. Computing them at creation leaves attack power stuck unbuffed.

### Swings and the combat tables

See [docs/combat-tables.md](docs/combat-tables.md).

- **At most one pending swing per weapon slot.** `scheduleSwing` cancels whatever
  the slot was waiting on. Without it an extra attack forks the chain — it fires
  from inside a swing that has not yet scheduled its successor, so both schedule
  one, and the fork doubles with every proc.
- **A dual-wielder has two combat tables, not one shown twice.** Miss and enemy
  dodge derive from the WIELDING weapon's skill, so anything granting skill with
  one hand diverges them. Anything reporting them must ask per slot. The
  dual-wield penalty lands on both hands, so skill is what separates them.
- **Which table resolves an attack depends on who is being HIT**, not who swings.
  `melee-received` is the attacks-received table: crushing blows, and the
  DEFENDER's dodge, parry and block.
- **A block LANDS and is reduced by a flat amount.** Deliberately not in
  `AVOIDED_OUTCOMES`, and reduced in the damage pipeline rather than as a table
  multiplier — that flatness is the whole character of the stat. So **a block is
  not an outcome a reaction can see**: an aura can be spent by one
  (`consumedByBlock`), a reaction cannot fire on one, and the two Paladin clauses
  that wanted it say so.
- **THE OVERLOADED TABLE IS THE TRAP.** Thunder Clap, Intercept and Charge are
  melee Warrior abilities declaring `ranged-special`, because that table has no
  dodge or parry and because it is how `isWeaponUse` excludes them. Check a
  class's own abilities, not a table name, before scoping anything to a table.

### What triggers what

- **A WEAPON PROC FIRES ON A USE, AND A USE IS A SWING OR AN ABILITY** — anything
  going through a combat table that needs that weapon. A WEAPON-BOUND effect
  fires only from a use of its own weapon (so main-hand and off-hand Crusader are
  two effects with two rolls, and Windfury is main-hand only); a GLOBAL one, Hand
  of Justice, fires from either. Shield Slam triggers MAIN HAND effects, settled
  by the owner because the rule alone did not answer it. It is `isWeaponUse` in
  the engine — it lived as a private one-liner while two other files re-derived
  it and got it wrong. [docs/extra-attacks.md](docs/extra-attacks.md)
- **SEAL DAMAGE IS NOT A WEAPON USE**, by the owner's ruling, and the swing
  carrying it still is. Enforced by dealing every seal hit with no `weaponSlot`.
- **A reaction fires on damage; a CAST reaction fires on a cast.** A finisher
  spends its combo points inside its own `onCast`, where neither the cost system
  nor a damage reaction can see it. `AbilityCastEvent` carries what the cast
  SPENT, **measured by snapshotting every pool around it** — measuring rather
  than asking each ability to declare is the point, because the ability that
  forgot would be silently inert.
- **IF WHETHER AN ABILITY CAN PROC SOMETHING IS IN QUESTION, ASK.** The owner's
  standing instruction. A wrong answer does not look wrong: Windfury spent its
  whole life refusing abilities and every figure was self-consistent and too low.
  A proc that never fires leaves nothing behind to notice.

### Damage scaling

- **Weapon damage**, universal across classes: `base + baseSpeed / 14 ×
  attackPower`, using the weapon's **actual** base speed, not a normalised one.
  An ability's flat damage adds on top, and **the off-hand penalty applies once
  to the final total** — `(weapon + power + 160) × 0.5`, never
  `(weapon + power) × 0.5 + 160`.
- **A ranged weapon scales with RANGED attack power**, keyed on
  `weaponScaling.slot` and never on `weaponSlot` — the latter says whose procs an
  attack triggers. This was wrong for the whole project and 1,548 tests passed
  with it in, because a Hunter with a plausible attack power produces a plausible
  number.
- **A spell's coefficient is `castTime / 3.5`**, an instant priced at 1.5s,
  applied to `spellPower + schoolSpellPower`. A RULE the owner supplied, not
  per-spell data. [docs/spell-coefficients.md](docs/spell-coefficients.md)
- **A seal is the exception**: `base + baseWeaponSpeed × (0.022 × AP + 0.044 ×
  SP)`, supplied directly, which makes a point of spell power worth twice a point
  of attack power. A Hunter shot is the other — Forever REMOVED Arcane Shot's
  spell power coefficient, so applying the general rule would reinstate something
  Forever took out.
- **Every DoT can crit, and none is reduced by armor.** A Forever rule, not
  Classic's. A tick does not re-roll the table — whether the effect landed was
  settled on application — but it rolls for a crit at the crit chance of **the
  kind of event that applied it**, named by `DamageRequest.critFrom`. No
  `critFrom` means no crit and no random number consumed, so adding the field
  never shifts a seeded run. Bleeds are physical and still ignore armor:
  `appliesArmor: false` on every one.
- **A tick is reached for CRIT and not for DAMAGE.** The crit fields read
  `attackTable ?? critFrom`; the damage multiplier reads `attackTable` alone. So
  Mortal Shots' crit damage reaches Serpent Sting's ticks and "damage you deal
  with ranged WEAPONS" correctly does not.

### The three modifier scopes

Per-ability crit and damage go through modifiers **on the combatant**, never
through an ability's own `onCast`: `dealDamage` consults them, so an ability
respects them without knowing they exist, and the one that forgot to look would
be quietly wrong. Auto attacks carry no `abilityId`, so nothing there touches
them, including `ALL_ABILITIES`.

| Scope | Keyed by | For |
| --- | --- | --- |
| `AbilityModifiers` | ability id | "your Fireball" |
| `SchoolModifiers` | `DamageSchool` | "your Fire spells", **and** school-scoped spell power |
| `AttackTableModifiers` | `AttackTableKind` | melee vs ranged, **and** swing vs special |

- **`SchoolModifiers` is the missing middle** between one ability and the whole
  character. Without it both bad options were taken: one talent left inert
  because listing every spell by id was unmaintainable, another applied
  whole-character with a caveat admitting it also raised physical crits.
- **`AttackTableModifiers` keys on the TABLE, not a `'melee' | 'ranged'` enum**,
  and that is why it works: the talents wanting it divide on two axes at once.
  **Read whether the tooltip says "abilities" or "weapons"** — "melee ABILITIES"
  stops at `melee-special`, while "melee critical strike damage" says nothing
  about abilities and therefore reaches the swing. Both readings produce a
  plausible number.
- **A crit damage bonus raises the bonus HALF** — 1.0 for a 2x melee crit, 0.5
  for a 1.5x spell crit. "+100%" takes a spell crit to 2.0x, not 2.5x; a melee
  crit with "+10% crit damage" is 2.1x, never 2.2x.
- **A school-blind `spellPower` cannot hold "damage done by SHADOW spells"**, and
  seventeen item lines say exactly that. It is a fourth field on
  `SchoolModifier`, not a stat (`STAT_NAMES` is a closed flat set), and
  `spellPowerFor` adds it to the school-blind pool **at the point of use** so a
  buff still moves it. On the school scope and not the shared `AbilityModifier`,
  which is the guard: hung off an ability nothing would read it, and it would do
  nothing without saying so.

### Casts, auras and the global cooldown

- **The GCD is 1.5s, 1.0 for a Rogue and a Cat-Form Druid, and it belongs to the
  CLASS** — it arrives as `baseGcdMs`. Being off it means ONE thing: the ability
  does not START one. It is still BLOCKED by one running, and what it buys is
  that the action AFTER it is free. Haste does not affect it, only cast time.
  On-next-swing abilities are off it by DERIVATION,
  `triggersGcd ?? onNextSwing === undefined`, so a new one gets the rule for
  free — declaring it per ability fails silently, because an ability wrongly
  taking a GCD still costs the right resource and deals the right damage.
  [docs/global-cooldown.md](docs/global-cooldown.md)
- **A cast interrupts the swing in progress and the swing timer resets**, which
  is what makes a cast a real cost to a melee character rather than free damage
  between swings. `Ability.swingTimer: 'hold'` is the exception: the timer runs
  on behind the cast and a swing due during it waits rather than being lost.
- **A channel is a cast that ticks, and nothing else about it is new.**
  `channelTicks` runs `onCast` that many times inside `castTimeMs`, the LAST tick
  where a plain cast's single effect already lands — so a one-tick channel and a
  plain cast are the same thing, which is the check that the paths have not
  drifted. The caster stays locked for the whole channel; freeing them per tick
  would let a rotation cast over its own channel. Haste shortens the channel, so
  ticks come faster and there are still the same number.
- **An aura can change the next cast of an ability it names** — `CastModifier` on
  `AuraDefinition`. `abilityCastTime` is a standing talent reduction fixed at
  build time, an ordinary aura reaches every ability or none, and content cannot
  reach cast time at all because the engine resolves it BEFORE `onCast` runs.
- **Resolving and consuming are two steps, and that is the whole design.**
  `checkCast` must be side-effect free because a rotation calls it on every
  candidate before committing, so `resolveCast` is pure and `consumeCastCharges`
  is called once by the cast that happens. Both halves must see the same cost, or
  a list refuses a spell the character can afford and does it SILENTLY.
- **`consumedByCast` is an enum, not a boolean.** "Your next 2 Starfires" spends
  a `stack`; "your NEXT Lightning Bolt" spends `all`, being one cast that every
  stack paid for. Spending a stack where the effect spends all of them leaves the
  rest behind, which reads as a working talent worth several times its value.
- **A percentage mana reduction is `CastModifier.costFraction`**, granted by
  `grantCastModifier`. `abilityCost` subtracts a FLAT amount, right for a 20-rage
  strike and wrong for a 380-mana spell. **Two on the same ability stack
  ADDITIVELY** — 50% and 25% make 75%, not 62.5%, because `resolveCast` subtracts
  each from the BASE. Both readings produce a plausible number, so there is a
  test.
- **A stat can be worth a percentage of another stat** — `statFromStat`, folded
  into the derivation rather than computed once, so it follows a buffed primary
  the way attack power follows strength. Resolving it at build time freezes it at
  the unbuffed figure while reading as plausible. It converts FROM a primary
  only. **Careful Aim feeds BOTH attack power pools** by the owner's ruling,
  though the talent says only "Attack Power" — Forever names the ranged pool
  explicitly everywhere else it means it, so the melee-only reading was
  defensible and wrong.

### Resources

See [docs/resources.md](docs/resources.md).

- **RAGE IS A FLAT RATE PER SWING, NOT A SHARE OF THE DAMAGE.** `rage = R × S`,
  R being 3.46 for a one-hander or a bear's paws and 4.5 for a two-hander, S the
  weapon's BASE speed before any modifier. `R × S` every `S` seconds is `R` per
  second, so speed cancels and haste raises nothing. **Extra attacks break that
  cancellation** — a proc pays a full `R × S` for a swing that cost no time. Rage
  income does not scale with gear, buffs or damage. A miss earns nothing, which
  is `ResourceGeneration.requiresDamage` and not a consequence of the arithmetic.
- **Taking damage is `D × 10 / H` off the PRE-ARMOR figure MINUS THE BLOCK.**
  Defensive Stance reduces the rage earned, armor does not, and a block does.
  Armor and a block are one pipeline step, so `DamageResolution` carries
  `blocked` separately to tell them apart.
- **Health and mana are maximums computed ONCE from a stats snapshot**, so a
  stamina buff applied as an aura grants no health. The encounter passes
  `poolStats`, a transform from the character's stats to their buffed ones.

### Builds, encounters and buffs

- **A BUILD IS FIVE SETTINGS THAT HAVE TO AGREE** — class, playstyle, stance or
  form, gear, and whether the target swings back — and `profiles/presets.ts` is
  where that is written down. Choosing three of the five produces a character
  nobody meant, and half a tree silently does nothing. A preset sets EVERY field
  rather than inheriting any, or it behaves differently depending on what was on
  screen when it was pressed. `isTankBuild` is the same idea inferred from two
  fields, and `encounter.targetAttacks` is what tells the two Paladin shield
  builds apart, because the style cannot and stances belong to the Warrior.
- **Gear belongs to a class, so changing class replaces it.** A race change keeps
  it. The sets live in `game/items/gearSets.ts`, not `presets.ts`: two layers
  need them, `game` may not import from `profiles`, and duplicated item ids
  drift.
- **An encounter that hits back RAMPS, and the character can die.**
  `targetAttacks` brings three mechanisms, none of them Forever data: the
  target's damage grows 10% a swing compounding, an assumed healer restores a
  random 500–1500 a second, and the character dies at zero and is stood back up
  at full. Survival is a COUNT OF DEATHS rather than an immunity — with an
  immunity, "how close was that" has no answer at all. A revive does not mark
  them dead even for an instant (that would cancel their own swing timers and
  skip the reactions the killing blow should trigger) and does not reset the
  ramp, which would hand a character an easier fight for dying.
  [docs/incoming-damage.md](docs/incoming-damage.md)
- **A revive keeps auras, except the ones spent to prevent it** —
  `removedOnDeath`, which Last Stand and Shield Wall declare. Dropping them all
  would switch off the assumed healer when it is needed most. Which effects
  survive dying is a property of the effect, so the flag is on the aura.
- **Raid buffs are SELECTED, never assumed.** Nothing is on by default; a buff
  that applied itself would move every figure ever recorded. **A proc's reaction
  is built PER CHARACTER**, because an internal cooldown is per-character state
  and one shared closure silently stopped Windfury proccing after the first
  iteration of a batch. [docs/raid-buffs.md](docs/raid-buffs.md)

### Pets

- **A pet is a second friendly combatant, and almost all of that already
  worked.** The one thing missing was reporting, so **reporting reads every
  friendly actor, not the player** — damage and buff uptime both, or a working
  pet talent looks exactly like an inert one. Rage and survival stay the
  player's, which they genuinely are.
- **A talent reaches the owner; a pet needs `petStat` and `petReaction`**,
  collected into `TalentBuild.pet` and handed to `createPet`, which applies what
  it is given and does no arithmetic on a rank.
- **A pet receives no raid buffs**, a Forever rule. `isPlayerControlled` counts a
  pet — right for who the raid is FIGHTING, wrong for who it BUFFS.
  `kind === 'player'` is the narrower test.
- **Pet stats come from the owner**: 2 health a stamina, 30% of armor, 10% of the
  HIGHEST attack power source, 100% of crit — far more gear-sensitive than a
  Classic pet. **A pet's base is a DPS, not a per-swing damage**, which makes its
  swing speed damage-neutral, and **a placeholder in the wrong UNIT is worse than
  one with the wrong value**, because the value is wrong once and the unit is
  wrong every time something else moves.
- **One function answers "will there be a pet".** `bringsPet` decides whether the
  encounter BUILDS one and whether a pet-gated talent APPLIES, and those have to
  be the same answer. **A condition nobody declared is not an omission, it is a
  bonus being paid**: `requires: {}` on "while your pet is active" paid both
  no-pet builds. An unexpressible condition that silently evaluates TRUE is worse
  than an inert talent, because an inert talent is reported.
- **A temporary summon is modelled without a combatant**, on the owner's call:
  the engine cannot add one mid-fight, so the damage lands and is credited and
  what is lost is that the summon is not separately targetable.

### Rotations

- **A rotation will change stance to reach an ability, and that is not always
  wanted.** `PriorityRotation` treats a wrong stance as "not yet, and here is
  how". An entry that must NOT provoke a swap says so in its `condition`, checked
  BEFORE the swap is considered — which is also how Vanguard gates Charge without
  naming the talent: the talent adds a stance to the character's copy of the
  ability, and the rule reads the ability rather than the build.
- **Charge is used ONCE, as the first action.** "Cannot be used in combat", and
  every fight here opens in combat. The rule is on the ability, not on each list.
- **AN ABILITY A LIST ASKS FOR AND THE BUILD DOES NOT HAVE IS SILENT**, which is
  what lets one list serve several builds. It has happened twice and both times
  it was invisible — a list asked for a capstone that build does not take, so no
  seal was ever cast and Judgement then refused every time. **When a list entry
  shows zero uses, check the book before the list.**
- **THE WRONG ROTATION IS WORSE THAN NO ROTATION, because nothing about it looks
  wrong.** A list is chosen by points spent, and the first Mage version compared
  two trees and never looked at Fire: a Fire build ran an Arcane list and
  produced a perfectly ordinary figure without casting Fireball once.
- **MEASURE A LIST, DO NOT REASON ABOUT IT.** Patch one entry, run 30 batches of
  10, treat a difference inside the interval as no difference. The comment that
  put Summon Hawk above Arcane Shot counted the hawk's ticks and not its price,
  and was specific, plausible and believed for as long as it existed.

Three things decide a list and none is visible in per-use damage:

1. **Resource-bound or global-cooldown-bound?** They want opposite orders. A
   geared Hunter empties its mana by the 30-second mark and spends the rest of
   the fight on auto-shot, so what binds is damage per MANA; the melee Hunter
   ends with 44% unspent.
2. **Does anything have a CAST TIME?** A cast resets the swing timer, and the
   swing it throws away belongs to a different line of the damage table.
   `resetSwingTimers` covers the RANGED slot, so a two-second shot throws away
   most of a 3.2-second bow cycle. **An instant and a cast ability are not
   comparable by their damage**, which is exactly what a list gets sorted by.
3. **Does the finding hold for the other builds of the same class?** The same
   ability was worth −23 to one and +4 to another.

**A STAT PROBE IS NOT AN ABILITY PROBE.** Injecting Hunter's Mark's 71 ranged
attack power said +1.9 to the melee Hunter; casting the ABILITY — which also
spends 60 mana and a GCD at the pull — measured −10.1. Measure the CAST.

### Gear and items

- **A stat that only applies sometimes is a bug waiting to happen.** Equipment
  resolution strips the slots a style cannot fill, and only genuine conflicts are
  exclusive: a two-hander against a one-hander, and an off-hand the style cannot
  hold. A ranged weapon coexists with a sword and simply does not swing.
- **A STAT-STICK STYLE IS TWO SEPARATE QUESTIONS** — is the item kept, and does
  it swing — and one commit got one wrong in each direction. Reading
  `mainHand: 'stat-stick'` as "not two-hand, therefore one-hand" DELETED a held
  two-hander; letting it through then handed it over as a WEAPON, and
  `createPlayer` merges equipped weapons OVER the style's own, so a Druid in Cat
  form swung a real sword instead of a paw — which read as a working feature.
  **When a rule is fixed for one slot, check its siblings**: `offHand` and
  `shield` are both off-hand slots.
- **"With all spells and attacks" is TWO STATS.** `critChance` and
  `spellCritChance` are read by separate tables, so an item line saying both has
  to grant both. Sixty-two lines say it, and granting only the melee half was
  invisible for exactly as long as no caster owned any gear.
- **The named item rules are tried BEFORE the weapon-skill pattern.**
  `^Increased (.+) \+(\d+)$` matches `Increased Defense +7`, and a weapon's
  `bonusSkill` on a breastplate is dropped on the floor.
- **A set bonus being DROPPED is the one thing this parser may not do.**
  `(4) Set : ...` starts with a bracket and matched neither the prefix list nor
  the bare-number fallback — not unmodelled, dropped. The full tooltip is always
  stored, so nothing is lost from the SOURCE, only from the list of what the
  simulator does not do.
- **An item's proc is keyed by id, and an item can have two.** Five sets name the
  Season of Discovery Hand of Justice where the proc was keyed to the Classic id
  — and its tooltip matches `MODELLED_AS_PROCS`, so it would have read as fully
  SIMULATED while firing never once.
- **A gear set can force a build setting.** When the owner supplies the gear, it
  is the gear that says which of the five settings was wrong.
- **VALIDATE THE GEAR, NOT THE CHARACTER, AGAINST THE PLANNER.** The planner
  shows BASE + GEAR and nothing else, so comparing a preset's primaries to it
  flags every build that spends a talent point on a stat. Build the same
  character with no items and no talents and check `panel - base` is what the
  items supply. Remaining differences in BASE are Forever's data and are not to
  be "fixed"; crit differing is CORRECT, because base stats here are Forever's.
- **Check whose gear a profile is in before quoting its number.** All three
  Hunters wore the Warrior set for the whole project and no test could have
  caught it, because a profile in the wrong gear runs perfectly. **The profiles
  whose gear did not change must not move by a decimal** — that is the check that
  a gear commit stayed inside the sets it touched.

### Talents

- **A CLASS IS REGISTERED IN FOUR PLACES AND MISSING ANY ONE IS SILENT:**
  `talentValues.ts`'s `FILES`, `talentBuild.ts`'s `EFFECTS` **and** its
  `REACTIONS`, and `abilitiesForClass`. Two have been missed and the failures do
  not look alike. Missing the VALUES file makes every rank resolve to nothing, so
  every talent reports itself `unmodelled` — which is what an unfinished class is
  supposed to look like. Missing the EFFECTS table is quieter: nothing reports
  unmodelled at all, the tree simply produces no effects, and talent-GRANTED
  abilities go missing from the spellbook with no complaint.
  `tests/game/classRegistration.test.ts` fails when a class with abilities is
  absent from any registry. **Check a new class's talents actually change a
  number rather than trusting the build to complain**, because it will not.
- **A `percentAdd` stat effect without `scale: 0.01` is a thousand percent.**
  `StatBlock` computes `(base + flat) × (1 + sum(percentAdd))`, so the modifier
  wants a FRACTION and a talent states a PERCENTAGE. It survived two class PRs,
  because a caster with a very large mana pool looks exactly like a caster with a
  very large mana pool.
- **An effect that reads no value is DROPPED, not reported.** `talentBuild` asks
  `talentNumber` and `continue`s when it is undefined, so a single-rank talent
  whose values file says `null` produces nothing and reads as unmodelled without
  having said so. **A talent whose effect does nothing is usually this**, not the
  effect table.
- **A talent's own rank does not always open its own gate.** `{ careful_aim: 5 }`
  is legal and `{ careful_aim: 1 }` is not; `createPlayer` strips the illegal one
  SILENTLY, and a rank-scaling test read that as "worth nothing at rank 1". Pad a
  single-talent allocation with tier-0 filler, as `tests/helpers/legalise` does.

See [docs/talent-effects.md](docs/talent-effects.md) for how an effect is
expressed.

## Three causes of inert, and they expire differently

Say which. Only the first is an engine gap.

| | |
| --- | --- |
| **the engine** | no declaration exists. Expires when one is built, and has six times — so write the reason specifically enough to re-read |
| **the target** | a raid boss is never frozen, never below 20% health, never killed, is not Undead. Expires only if the encounter changes |
| **the build** | the profile did not take it, or took a talent switching it off. Lone Wolf and Demonic Sacrifice both mean "no pet", so nineteen talents are correctly dead |

Plus the permanent rulings under **Scope**.

- **An `unmodelled` reason is a claim about the engine ON THE DAY IT WAS WRITTEN,
  and it expires.** Clearing a blocker is not finished until every reason naming
  it has been re-read — missed at least four times, and twice a talent was fully
  working while printing a caveat saying it could not fire. Write it specifically
  enough to re-read: a whole family expires at once and is then findable by its
  wording, which has paid for itself six times. **A reason matched by wording is
  a test** — `grantCastModifier.test.ts` fails if any talent still claims a
  percentage cost cannot be expressed, matching the SENTENCE rather than ids.
- **When a reason blames the SOURCE, check it is not really a question for the
  owner.** Twenty-nine said Forever states no spell coefficient, which was true
  and still is; the conclusion was wrong, because a coefficient is a RULE and
  asking got one in a single message. **Check whether a missing number is missing
  DATA or a missing RULE before recording it as a gap.**
- **A profile's DPS moving is not the test that a talent works.** A cost
  reduction is worth nothing to a build that never runs dry; armor is worth
  nothing on a character nothing attacks. **Assert the MECHANISM** — the resolved
  cost, the stack count, the stat arriving, the aura present. A talent working and
  a talent mattering are different questions.
- **Read the owner's own words for what a talent selects.** Hot Streak names four
  spells and Pyroblast is not one, which is what stops it feeding itself. Shadow
  Weaving is on the CASTER in Forever and on the target in Classic. Twin
  Disciplines selects "instant cast spells", which no declaration expresses, so
  it names them one by one.

## Where the Forever data comes from

Five sources. **All nine classes were built from the two client-derived ones.**
[docs/class-implementation.md](docs/class-implementation.md) is the process.

| Source | Answers |
| --- | --- |
| `C:\Users\Donz\Documents\WoWForever*` | the owner's own files, **highest authority**: base stats, the combat table, stat conversions, resources, and **one ability spreadsheet — the Warrior's**. There is no spreadsheet for the other eight classes. `WoWForeverSimGuidance.docx` is NOT data — it is screenshots of an architecture discussion |
| `talentsforever.com` | the beta client's own files, four static JS assignments a plain `fetch` reaches. **The source of record for talents AND for every ability number in the project**, and the build URLs the profiles are specified by |
| `foreverchanges.pro/spellbook/<class>` | the beta client diffed against Classic Era, per rank, with cost, cast time and cooldown. **The tie-break: where it and our capture disagree, it wins, by the owner's standing rule.** Nothing imports from it — it is read by hand, and its data is in the page's RSC flight script, not the DOM. Checked so far: the Warrior (five numbers moved) and the Warlock (three moved). Seven classes to go |
| `nether.wowhead.com/classic/tooltip/item/<id>` | Classic item and spell tooltips as JSON, no browser. The current items are Classic stand-ins, not Forever data |
| `github.com/classic-hunter/forever-hunter/wiki` | the ONLY source for pet stat scaling and pet focus regeneration, plus a full Forever-vs-Classic diff for the Hunter. Community-maintained, so it ranks below the two above where they overlap — they have not yet disagreed |

`talentsforever.com` serves `/talents.js` (all nine trees, every rank's text,
prerequisites, each granted ability's cost line), `/spellbooks.js` (every trainer
spell to 60), `/spelldesc.js` (descriptions with cast, range, cooldown) and
`/racials.js`. Imported by `tools/import_forever_talents.mjs`; spells by
`tools/import_forever_spells.mjs`, at MAX RANK, which reads `/spellbooks.js` and
`/spelldesc.js` — each capture states that source in its own header.

**THE WARRIOR HAD FOUR SOURCES AND THE OTHER EIGHT HAVE ONE.** The Warrior's
numbers were cross-checked against an owner spreadsheet, a Wowhead tooltip
capture and `foreverchanges.pro`, and **eight of them turned out wrong** —
Slam, Thunder Clap, Bloodthirst, Demoralizing Shout, Battle Shout, Shield
Wall, Revenge and Shield Slam. Every other class rests on `talentsforever.com`
alone, uncorroborated, and that is the honest state of them: not suspected
wrong, but never checked the way the one class that WAS checked needed eight
fixes. `foreverchanges.pro` is the available second opinion and running it
against a class is cheap.

- **Decode a build before writing anything.** `tools/decode_talent_build.mjs`. A
  build coming back at other than 51 points, or throwing "X given N of M ranks",
  means the tree on disk disagrees with the tree the URL was written against.
  **A wrong tree does not always fail** — with the old Druid data one build threw
  and another DECODED CLEANLY TO 51 POINTS WITH THE WRONG TALENTS, because its
  first tree's segment stopped before the divergence.
- **THE RANK VALUES ARE THE TRAP, NOT THE TREE.** `values/<class>.json` is
  generated by matching `{0}` placeholders against each rank's text, and a
  single-rank talent has no variable to identify, so its values come back `null`.
  Eight are hand-filled, each with a `note`. `--check` prints the count per
  class, and the importer MERGES rather than overwrites.
- **NEVER READ AN ABILITY NUMBER FROM CLASSIC.** Forever changes them heavily and
  in both directions, so a Classic value is not even a safe approximation. Aimed
  Shot's bonus went 600 → 166, Raptor Strike's 140 → 70, Serpent Sting's total
  490 → 555, and Arcane Shot GAINED a ranged attack power coefficient while
  LOSING its spell power one. Four numbers, four directions.
- **`foreverchanges.pro` OPENS ON A RANK THAT IS NOT ALWAYS THE MAX.** Forever
  shifts ranks down and sometimes adds one, so reading the page as it loads can
  give a real Forever number for the wrong rank. It also separates "Forever
  changed this" from "Forever inherited this", which is how Thunder Clap's
  cooldown was settled: 6 in Forever, 4 in Classic, and our sheet's 4 had gone
  unquestioned because it agreed with Classic.

**A TALENT TOOLTIP SHOWS RANK 1 OF THE ABILITY IT GRANTS**, not the rank a level
60 has — Mortal Strike reads 85 and is 160. That explains every "disagreement"
this project had between a calculator and an ability sheet, one per class with a
damage-granting capstone, and none was a disagreement. The owner's spreadsheets
mix the two conventions, so a sheet cannot settle it. **Check `max_rank` before
comparing two sources.**

**A CAPTURED TOOLTIP CAN DISAGREE WITH ITSELF, so read the effect rows and not
only the description.** Base points run consistently ONE higher than the stated
figure. The trap is the readable description that disagrees with its own row
anyway — one said 210 above a row saying −195, and the 210 was transcribed for
months. [docs/warrior.md](docs/warrior.md) has the full reading rules and the
per-ability figures; they are class-independent.

**WHERE TWO SOURCES DISAGREE, `foreverchanges.pro` WINS.** The ruleset owner's
standing rule — "when in doubt use foreverchanges.pro" — given when it settled Life
Tap at 840 against our own capture's 424. It outranks the older instruction to
prefer the newer read or to ask, and it applies to every class, because eight of
the nine have no owner spreadsheet to appeal to. Still say so in the docs and in
the constant: a number that disagrees with the checked-in capture must carry the
ruling beside it, or the next person reads it as drift.

**Two sources can disagree, INCLUDING TWO READS OF THE SAME CLIENT BUILD**, which
is what makes that rule necessary rather than tidy. Life Tap is 424 on
`talentsforever` and 840 on `foreverchanges.pro`, both at build 1.60.1.70009 — so
refreshing a capture does not settle it, and the disagreement is not staleness. It
was worth **+12.1% to Firelock**. Where they agree, confidence rises: seven of the
Warlock's ten matched exactly.

**THE RULE DOES NOT APPLY WHEN THE PREFERRED SOURCE IS SILENT RATHER THAN
DIFFERENT.** `foreverchanges.pro` carries no reagent field for any spell, so its
365-mana cost for Shadowburn does not contradict the Soul Shard the other source
states — it cannot express one. Both are charged. Taking a tie-break literally
where there is no tie deletes a real cost.

Record every check in [docs/source-cross-checks.md](docs/source-cross-checks.md),
which also holds the two traps — one of them manufactures a disagreement that is
not there.

## Never invent game data

The most important working rule.

When a formula or value is missing, **say so and flag it loudly**: a named
`PLACEHOLDER_*` constant, a comment, a docs entry. Do not substitute a plausible
number. A simulator built on invented data produces results that look entirely
reasonable and mean nothing, and nobody finds out for months.

When the source is ambiguous, **pick the reading that reproduces a known value**,
state the interpretation in a comment, and isolate it in one place so it is cheap
to flip — the way `Armor_Reduction`, which is named as a reduction and computes a
*multiplier*, was settled against the known ~40% figure for a 3731-armor boss.

**When an effect cannot be modelled, keep its own words and surface them.** Items
carry an `unmodelled` list with the source's exact text and one line on why it
does nothing, and the Gear panel prints every one under "Equipped but not
simulated". An effect matching no rule is never guessed at — which is what kept
Crusader granting nothing until its proc rate arrived, rather than quietly
inheriting a plausible one. A visibly inert buff is the honest failure mode.

**Resistance on an enemy target has no effect on damage**, by the owner's ruling.
So a spell lands for full against a raid boss, and `resistancesFromItems` being
computed and never read is CORRECT rather than a gap.

**Borrowing a Classic value is allowed, and only when it stays visible.** Where
Forever has not supplied a number, prefer a Classic one over leaving a system
unreachable — on three conditions, all of which must hold.

1. It keeps a `PLACEHOLDER_` name, so nothing can read it without seeing that.
2. A comment says it is Classic and unverified, and what would confirm it.
3. Where a person can see the result, the app says so — the way the Encounter
   panel prints the caveat beside the "target attacks back" switch.

A visibly borrowed number beats an inert system. A *silently* borrowed one is
worse than either, because it produces a confident figure nobody can audit. If
any of the three cannot be met, leave it inert. **A placeholder nobody is told
about is the failure mode the rule exists to prevent** — one was written,
exported and referenced by nothing for as long as pets existed, while its own
comment claimed it was printed in the app.

## Generated and scraped data

`src/game/character/baseStats.ts` is **generated** by `tools/import_base_stats.py`
from the base stats spreadsheet. Never edit it by hand; re-run the generator.

`src/data/talents/*.json` (468 talents) and `src/data/items/*.json` (151 items in
nine files, one per gear set) were **scraped** and are checked in. Each directory
has a README recording where the data came from and how to refresh it. Never
hand-edit either — `src/data/talents/values/*.json` is the one exception, for the
single-rank talents above.

**THE ITEM FILES ARE REBUILT BY ONE COMMAND**, `node tools/import_item.mjs
--build`, off the ordered spec in `tools/item-sets.json` — which is also what
`--verify` reads, so a set added to one is covered by the other. They used to be
two lists and a file was once added to only one, which turns "re-parse everything
on file" into a false promise. **Twenty-two items are worn by more than one set**,
`itemData` throws on a duplicate id, and the spec order decides which file owns
each shared piece.

**The item database is FROZEN**, pending further Forever item changes. Do not add
sets or go looking for gear. The sets in scope are the ones the owner supplied;
they are Season of Discovery stand-ins, not Forever data, and the README says so.
**Keep saying so.** The Immovable Object is the one real Forever item.

**Prove a transfer rather than trusting it.** Anything out of a browser is hashed
with SHA-256 there and re-hashed on disk before being accepted. The clipboard is a
working channel on Windows (`document.execCommand('copy')` after a real click,
then `Get-Clipboard -Raw`) and it overwrites the user's clipboard, so say so.

**Validate scraped data at load and throw.** `talentData.ts` checks tier against
row, prerequisites resolving inside their own tree, and duplicate ids; the item
loader recomputes each weapon's dps from its damage and speed. A page that changes
shape should fail loudly, not render a tree with a broken arrow.

## Testing

- **Write the spec out independently in the test.** The race/class table, the
  per-class resource table and the combat table constants are all duplicated by
  hand on purpose: a test that reads the source data passes no matter what the
  source data says. Where volume makes that impractical — 468 talents —
  transcribe the shape and assert the invariants that hold for all of them.
- **Two independent checks on a captured number**: the expected value written out
  by hand from the tooltip, AND the stored tooltip asserted to contain that same
  number. A typo fails the second; upstream drift fails `--verify`.
- **Assert what should stay true, not what happens to be true today.** A test
  pinned to a temporary limitation outlives the limitation — one was named "still
  says it cannot fire, because nothing attacks the player" and enforced the stale
  caveat instead of catching it.
- **Assert the MECHANISM, not a DPS delta.** A correct talent can be worth zero.
- **Combat table boundaries use scripted rolls, not sampling.** An off-by-one at
  a boundary shifts every damage number a fraction of a percent.
- **Verify a probabilistic mechanic against its rate, over many seeds.** A 6.5%
  dodge chance is absent from an entire 100-second fight about once in two
  hundred runs. Naming a specific ability in a training-dummy assertion pins a
  rotation decision rather than the behaviour under test.
- **A structural test that filters can silently skip the part most likely to be
  wrong.** `everySpellScales.test.ts` filtered on `attackTable === 'spell'` and
  skipped every pure DoT, because a spell that only applies an aura declares no
  table. Discover the list from the event stream instead.
- Use `toBeCloseTo` for anything through a percentage modifier — `100 * 1.1` is
  `110.00000000000001`.

## Verifying work

Tests passing is not the same as the app working. Run the real thing and check
actual numbers against hand-computed expectations.

**First check the two numbers are even supposed to match.** The UI runs
`runProfileBatch` and renders `batch.representative`, *not* `runProfile(profile)`.
Even at one iteration the batch derives its own seed, so the browser is showing a
different fight — the log's `Combat begins (seed ...)` line gives the derived
seed, not the profile's.

**Then, if they should match and do not, suspect a stale Vite cache** before
suspecting the code. The dev server once served modules from before an engine
change, and the browser showed a level-60 combat table while the tests showed the
correct level-63 one. Restart with `npm run dev -- --force`.

Those two are in that order for a reason: the cache warning is the memorable one,
so a mismatch reads as a cache bug on sight, and that cost a long detour before
`runProfileBatch` turned out to reproduce the browser's numbers exactly outside
the browser.

**`characterAtCombatStart` processes no events**, so it shows the character a
moment before its own opener lands. Do not reason about in-fight scaling from it
alone.

**When a fix moves nothing in the suite, that is a statement about the suite.**

## Git workflow

`main` is **protected**: PR required, CI must pass (Node 20 and 22), no direct
pushes, and that applies to admins. Work on a branch, open a PR, merge with
`--squash --delete-branch`.

**Other Claude sessions edit this same checkout concurrently.** Measure and test
in a throwaway `git worktree` at a named commit, never in the shared working
tree: a measurement there once came back a clean −2.0% on two profiles, which
read exactly like a real regression and was another session's uncommitted work.
Never commit files you find modified there.

Commit messages explain *why*, not just what, and flag behaviour changes and
missing data explicitly. **Do not add `Co-Authored-By` trailers** — the user asked
for these removed and the history was rewritten to strip them.

## Environment

- Windows. `npm`/`npx` may not be on the Bash tool's PATH; PowerShell with a
  refreshed `$env:Path` works reliably.
- Heredocs in the Bash tool are unreliable for large multi-line content. Write a
  script to a file and run it, or use Write/Edit.
- `gh` is at `/c/Program Files/GitHub CLI/gh.exe`, not on PATH. `jq` is
  unavailable — use `gh --jq`.
- `.gitattributes` forces LF. CRLF warnings on commit are expected and harmless.
- The app is live at <https://donz-dev.github.io/SimForever/>, republished by
  `.github/workflows/deploy.yml` on every push to `main` that passes.
