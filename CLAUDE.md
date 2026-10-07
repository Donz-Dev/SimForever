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

Measurement harnesses and audits, none of them tests:

```bash
npx vite-node tools/measure_profiles.ts          # the 24 profiles, 30 batches of 10
USES=1 SEEDS=1 PROFILES=druid_cat npx vite-node tools/measure_profiles.ts
npx vite-node tools/measure_rotation.ts          # Warrior TALENT builds, not profiles
npx vite-node tools/ability_audit.ts             # is every ability connected at all
npx vite-node tools/class_audit.ts warrior       # one class's gaps, lists and sources
npx vite-node tools/coefficient_probe.ts         # does every ability's damage scale
PROFILE=pally_ret npx vite-node tools/probe_resources.ts   # where one pool went
npx vite-node tools/druid_attribution.ts         # what one talent is worth, with its CASCADE named
```

The three audits in the middle are AUDITS rather than measurements and none of
their DPS figures is the baseline — see **Verifying work** for which one
answers what. `probe_resources.ts` is a DIAGNOSTIC, one batch, and answers the
question a never-fired entry raises: did the build simply run out. It is what
settled Hammer of Wrath — gained 4101, spent 4023, 78 to spare.

`measure_profiles.ts` is the one that reproduces a published baseline, because a
preset carries its own gear, raid buffs and 51 points that a hand-assembled
character does not; `SAVE=` and `BASELINE=` turn it into a before-and-after with
a REAL/noise verdict, and `USES=1` prints a list in priority order with what
each entry actually did. See [docs/handoff-rotations.md](docs/handoff-rotations.md).

Per-class state is [docs/handoff/](docs/handoff/) — one document per class,
each the starting point for that class's deep dive, with its profiles, its live
gaps and its own traps. **All nine have now been done**: the live-gap count went
132 to 64, four classes are at 0–3, and what closed was mostly declarations and
owner rulings rather than new engine capability. [HANDOVER.md](HANDOVER.md) has the
recap.

**THE UI HAS NOT HAD A PASS OF ITS OWN** and is the next piece of work:
[docs/handoff/gui.md](docs/handoff/gui.md).

> **LAND THE SHARED ENGINE PIECES FIRST, BEFORE DISPATCHING ANY CLASS WORK.** The
> owner's instruction after the first round of nine parallel dives, and it is about
> SEQUENCING rather than noticing: the briefs already named the four items that
> wanted building once, and **three of them got built two and three times anyway.**
> A "build once" note in nine parallel briefs is not a mechanism; only landing the
> thing on `main` first is. The bill arrives on whichever branch merges last — the
> Rogue came back carrying seven divergent APIs and cost more to reconcile than any
> single dive. See [docs/handoff/README.md](docs/handoff/README.md).

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

**READ EVERY CLAUSE BEFORE WRITING A `scope`, AND NEVER WRITE ONE FROM THE
NAME.** Nature's Reach is "increases the RANGE of your offensive Balance spells
by 20% **and improves your chance to hit by 4%**", and it was a single
`positioning` entry reading "Range, and nothing here has a position" -- true of
the first clause and silent about the second. **A `scope` IS THE WORST PLACE FOR
A CLAUSE TO GO MISSING**, because it is permanent by design: the talent was
counted as RULED OUT rather than as a live gap, so the census that exists to find
unfinished work had nothing to report, and 4% hit went missing on all three Druid
profiles. Classic's Nature's Reach is range and nothing else, which is why the
name and the first clause agreed with each other and with nothing else.

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
| `crowdControl` | stuns, fears, roots, snares, silences, incapacitates, disorients, disarms, **and removing any of them** | 36 |
| `threat` | threat, which is not tracked. Defensive Stance's +30% and Defiance are dropped, not deferred | 14 |
| `healing` | healing THROUGHPUT. **Mana RETURN is NOT out of scope** — it changes a damage profile's sustain, so it is a live gap and gets no `scope` | 36 |
| `stealth` | being stealthed, detecting it, and the openers requiring it — Ambush, Garrote, Cheap Shot. **NOT an in-combat proc that REMOVES a stealth requirement**, which is what Cutthroat is | 7 |
| `castPushback` | avoiding, resisting or reducing the interruption or DELAY of a cast or channel from damage taken. **NOT an interrupt the TARGET suffers** — Earth Shock's school lockout is about the enemy casting and is inert for a different reason | 7 |
| `totemEntities` | a totem that BUFFS or HEALS on its own. **NOT a totem that deals DAMAGE**, which Searing Totem proved is expressible as a debuff that ticks | 4 |

Adding a member to that union is a scope DECISION and needs the owner, not a
judgement call while writing a class.

**AND A `scope` TAG ON A LIVE EFFECT IS THE QUIETEST MISTAKE AROUND THIS TABLE,
BECAUSE THE TAG'S WHOLE PURPOSE IS TO STOP ANYBODY LOOKING AGAIN.** A ruled-out
effect is deliberately kept out of the live-gap list and shown apart in the Talent
panel -- so tagging something that DOES work, or that has since become
expressible, deletes it from the one list that gets re-read. An ordinary
`unmodelled` reason is counted and re-read; a scoped one is filed as answered.

It has now cost three Rogue talents at once. **Improved Ambush, Initiative and
Opportunity's Ambush clause** all carried `scope: 'stealth'` with a reason saying
"Ambush requires stealth and is absent" -- true when written, and left there
through the whole release in which the owner ruled that Cutthroat's proc IS
Ambush's stealth requirement and the ability was declared, listed, and dealing
damage in a profile. Wiring the three was worth **+19** to the Rupture profile and
needed no engine work. **When a ruling WIDENS what is modelled, the `scope` tags
are the first place to look**, and they are the one place a reader does not expect
to have to.

**AND A SCOPE QUESTION CAN COME BACK AS AN ABILITY.** Asked whether TRAPS were
out of scope — they need a position and a target that walks onto one, which is
five Hunter talents and two abilities — the owner added no member and instead
put **Immolation Trap** in, ruling away the only part the engine cannot do:
"assume it triggers instantly when cast". So the answer to "is this out of
scope" can be "no, and here is how to model it", and it closed three Hunter
talents rather than one.

**AND THE SECOND HALF OF THAT ARRIVED SEPARATELY, WHICH IS THE POINT.** Explosive
Trap stayed undeclared while only Immolation Trap was named -- a ruling covers
what it says and is not extended by analogy -- and the owner later named it too:
"Explosive trap can be implemented, there isn't an AP or SP scaler." **Waiting was
right and cost nothing**: when the ruling came it carried a second fact, the
absence of a coefficient, that an analogy would have had to guess.

**"BLOCKED TWICE" IS THE TEST FOR RECOGNISING ONE, and it has found three of the
seven.** When clearing either half of a reason alone would still leave the talent
inert, nothing is ever going to reach it and it is a ruling rather than a gap.
Stealth was that shape (every fight opens in combat AND no opener is declared);
cast pushback is (the engine resolves a cast time once, before `onCast`, AND no
caster profile is attacked); totems as entities is (no combatant can be added
mid-fight AND there is nothing to attach a group mana return to). **Each had spent
the project counted as work.**

**THE LAST TWO WERE PROPOSED BY THE SHAMAN DIVE AND THE OWNER HAS SINCE RATIFIED
THEM** -- "castPushback and totemEntities don't need to be implemented". So both
are rulings in the full sense now, and the "blocked twice" argument that proposed
them is a test worth reusing rather than a liberty that was taken. **Seven members,
all of them the owner's.**

`totemEntities` is still narrower than it sounds: a DAMAGE totem turned out to be
expressible, and Searing Totem is modelled as a debuff that ticks.

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
  multiplier — that flatness is the whole character of the stat.
- **AND A REACTION CAN FIRE ON ONE. THIS ENTRY USED TO SAY IT COULD NOT.** It
  read "a block is not an outcome a reaction can see: an aura can be spent by one
  (`consumedByBlock`), a reaction cannot fire on one, and the two Paladin clauses
  that wanted it say so" — and `melee-received` has rolled `block` since the table
  was written, `runReactions` filters on nothing but the outcome list, and the
  WARRIOR'S OWN Shield Specialization, Revenge, Enrage and Blood Craze all name
  `block` and all fire. The sentence was inferred from the true half above rather
  than from the code, it spread to the `Reaction.outcomes` doc comment, to
  `reactions/paladinTalents.ts` and to the Paladin brief, and it cost that class
  three talents and the tank profile a damage source worth 14.9% of it. **A claim
  about the engine expires; this one was never true.**
  `tests/engine/blockReactions.test.ts` is what stops it returning.
- **A BLOCK'S CHARGE IS SPENT AFTER THE REACTIONS RUN**, and that ordering is
  load-bearing the way `runCast` running `onCast` before the cast reactions is.
  Holy Shield is "221 Holy damage for each attack blocked" with four charges, and
  its reaction asks whether the aura is up: spending the charge first drops the
  aura on the FOURTH block, so the last of the four dealt nothing and the ability
  was quietly worth three quarters of itself.
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
- **AND A SEAL STILL CRITS, AT THE PALADIN'S MELEE CRIT CHANCE** — also the
  owner's ruling, covering Seal of Righteousness, Seal of Fury and Seal of
  Command. `critFrom` is the field, which is the same one a damage-over-time tick
  uses and for the same reason: the LANDING was settled by something else and
  only the crit is left to roll. **A SEAL DEALS HOLY DAMAGE AND CRITS FOR 2x
  ANYWAY**, because the multiplier follows the TABLE and not the school — reading
  the school gives a spell's 1.5x, which is half the bonus, entirely plausible
  and no error. The Echo gets it for free and should: Twist of Light applies "the
  replaced Seal's effects", so an echoed seal is the seal.
- **A POISON IS THE SAME SHAPE: NOT A USE, BUT TRIGGERED BY ONE.** Also the
  owner's ruling. `isWeaponUseOf(attack, slot)` is what fires it -- a swing,
  a Windfury extra attack, or an ability needing that weapon -- and the poison
  hit itself carries no `weaponSlot`, so it cannot proc a second poison, a
  Crusader or Hand of Justice. Getting that backwards does not look wrong:
  poisons chaining off poisons is a bigger number and no error.
- **A POISON'S CHANCE IS FLAT PER STRIKE, NOT PROCS PER MINUTE**, which is the
  opposite of every weapon enchant here. "Each strike has a 20% chance" means a
  fast off hand really does poison more often, where PPM exists to stop exactly
  that. The two live side by side and must not be made to match.
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
  attackPower`. An ability's flat damage adds on top, and **the off-hand penalty
  applies once to the final total** — `(weapon + power + 160) × 0.5`, never
  `(weapon + power) × 0.5 + 160`.
- **SEVENTEEN ABILITIES NORMALISE THAT SPEED**, replacing the weapon's own with
  a fixed one — 3.3 two-handed, 2.8 ranged, 2.4 one-handed, 1.7 dagger — **in
  the ATTACK POWER half only**. The damage roll is untouched, so a slow weapon
  still hits harder; what it loses is the second advantage it got on an INSTANT,
  where the attack power term should not depend on a swing that never happened.
  The speeds are content (`normalizedPowerCoefficient` on the weapon) and the
  rule is engine (`weaponScaling.normalized`). **It is OPT-IN and falls back to
  the weapon's own coefficient rather than to zero** — a paw or a placeholder is
  un-normalised, not powerless. Slam, Heroic Strike, Cleave, Raptor Strike and
  Ghostly Strike are the owner's five exceptions.
- **RANGED IS CHECKED BEFORE TWO-HANDED, because a bow is both.** Reading
  `twoHanded` first normalises every bow to 3.3 instead of 2.8 and inflates
  every Hunter shot by 18%.
- **A DRUID'S PAW IS BUILT FROM THE WEAPON BEING HELD**, and Druids are exempt
  from normalisation because a paw is already one shape: `BasePaw + weaponDPS ×
  formSwing + AP × formSwing / 14`, times `rand(0.8, 1.2)`, with the form's
  swing being 1.0 for a cat and 2.5 for a bear. A stat stick never SWINGS and
  still feeds the paw's damage through its DPS — but **NOT through its speed**.
  The other reading of the owner's formula, where the held weapon's speed is the
  multiplier, put Cat at 988.8 and Bear at 909.2 and made paw damage
  proportional to how SLOW the held weapon was; it was rejected on measurement.
- **A ranged weapon scales with RANGED attack power**, keyed on
  `weaponScaling.slot` and never on `weaponSlot` — the latter says whose procs an
  attack triggers. This was wrong for the whole project and 1,548 tests passed
  with it in, because a Hunter with a plausible attack power produces a plausible
  number.
- **EVERY COEFFICIENT IS DATA, AND `src/game/combat/coefficients.ts` IS IT.**
  Transcribed row for row from `WoWSimWorksheet.xlsx`, the owner's authoritative
  coefficient document. **Nothing is derived any more**: the old
  `castTime / 3.5` rule, its two `PLACEHOLDER_` constants and the hybrid share
  formula are deleted, because three of those four were Classic's and the owner
  has now stated the numbers.
  [docs/spell-coefficients.md](docs/spell-coefficients.md)
- **A COEFFICIENT IS ADDED TO THE BASE DAMAGE, NEVER INSTEAD OF IT** — the
  owner's instruction with the sheet, "make sure that flat ability damage
  doesn't get lost". `scaleByPower` already adds, so the risk is not the
  pipeline but an EDIT that overwrites a `baseAmount` while setting a
  coefficient: it compiles, it passes a coefficient test, and it silently
  deletes half an ability. `ownerCoefficients.test.ts` casts everything at ZERO
  power, where every coefficient contributes nothing and what is left is the
  flat damage.
- **AN ABILITY'S FLAT DAMAGE IS ADDED OUTSIDE ITS WEAPON PERCENTAGE**, and this
  is the owner's ruling after the other reading was built and withdrawn. "75%
  weapon damage plus an additional 50" is `weapon x 0.75 + 50`, never
  `(weapon + 50) x 0.75`. **THE EPISODE IS WORTH MORE THAN THE RULE.** The other
  reading was applied as a derived rule across seventeen abilities with an
  opt-out, containment-checked, measured, shipped and reverted the next day — and
  **the whole suite passed in both directions**, because nothing pinned the
  damage of any ability whose weapon fraction is not 1. Twelve of the seventeen
  are 100% weapon damage, so the two formulas are the same arithmetic for all
  twelve and only five move: Mutilate 0.75, Claw 1.10, Backstab 1.50, Shred 1.55,
  Ambush 2.50. **"The profiles did not move" is not evidence a damage formula is
  right when it is invisible in twelve of the seventeen places it applies.**
  `flatOutsideWeaponFraction.test.ts` pins it now, in both directions either side
  of 1 — and it is the INVERSE of the test that went out with the revert, because
  **a revert is exactly when a test-shaped hole reopens**: the test that closed it
  was written for the rule being removed.
- **A SHEET ROW STATES ONE OF THREE THINGS**, and they are not interchangeable:
  a percentage is the ability's OWN coefficient, `weapon damage` means attack
  power arrives through the weapon at `speed / 14`, and `% per tick` is PER
  TICK. `%*combo point spent` multiplies by what the finisher spent.
- **THE SHEET SUPERSEDED TWO EARLIER RULINGS, both from the same owner.** Seal
  of Righteousness was `base + baseWeaponSpeed × (0.022 × AP + 0.044 × SP)` and
  is now a flat spell power figure chosen by weapon TYPE — 20% one-handed, 22%
  two-handed, and no attack power term at all. And
  `WoWForeverWarriorAbilities.xlsx` states a coefficient of 0 for every Warrior
  strike, where the sheet gives Revenge 22%, Thunder Clap 7% and Rend 2% a tick.
  **The later and more specific document wins, and both sites say so** — a
  reader who knows the older source would otherwise read the new numbers as
  transcription errors.
- **A Hunter shot takes no spell coefficient**: Forever REMOVED Arcane Shot's,
  giving it a ranged attack power one instead, so reading spell power would
  reinstate something Forever took out. The sheet confirms it — the Hunter is
  the one class it left entirely unchanged.
- **"DAMAGE FROM YOUR DAMAGE OVER TIME EFFECTS" IS ITS OWN FIELD**,
  `periodicDamageTakenBySchool`, and folding it into `damageTakenBySchool` is the
  mistake it exists to prevent: Wrack's +10% to Shadow DoTs would also raise
  Shadow Bolt, which is half of the SM/DS profile's damage. **A bigger number
  wearing the right label is not an approximation.** "Over time" is
  `DamageRequest.periodic`, which a real tick sets and a CHANNEL's ticks do not --
  so Wrack cannot amplify its own six ticks, which is what its own word "other"
  asks for and nothing has to special-case.
- **SPELLS MISS ON A FLAT 17% AND THE MISS FLOORS AT 1%, so the usable spell hit
  cap is 16.** The owner's figures. `AttackChances.missFloor` carries it ON THE
  TABLE rather than being applied where the table is built, because hit arrives
  along TWO routes and only one goes through `attackChances`: the
  character-wide `hitChance` stat is folded in there, and a SCHOOL-scoped
  `hitBonus` -- five talents across three classes -- is folded in later by
  `withModifier`. **A floor on one route is a floor the other walks around**, and
  one profile was already walking around it: the Shockadin's Divine Precision
  gives +12% HOLY hit on top of 6% from gear, so its Holy spells could not miss
  at all. **CHECKING ONE ROUTE SAID NOBODY WAS AT THE CAP** -- no profile exceeds
  16% on the `hitChance` stat, so a probe over that stat alone called the floor a
  guard for the future when it was already load-bearing. Melee and ranged state
  no floor and pass 0; the owner stated this for spells and `missFromSkill` is a
  different formula.
- **A SPELL HAS NO HAND.** `attackChances` defaults an unnamed slot to
  `mainHand` and the melee term adds that hand's own hit bonus, which belongs to
  Dual Wield Specialization's off hand. The spell branch reads the
  character-wide stat alone. Worth zero today, because nothing grants main-hand
  hit -- and wrong the day something does, in a way that reads as a correct
  number.
- **A DoT APPLICATION ROLLS TO HIT; A DoT TICK NEVER ASKS AGAIN.** Both halves
  are the owner's. **A PURE DoT HAS NO DAMAGE EVENT TO CARRY THE ROLL**, which
  is the shape to check: an ability that deals damage AND applies an aura gets
  the roll from `dealDamage` for free, and one that only applies an aura has to
  ask. Serpent Sting did not ask for most of its life and was the only DoT in
  the project that could not miss -- invisible because **a missing miss is not
  an error**, so the sting landed every cast, its ticks were the right size and
  the damage table summed to 100%. Three abilities apply an aura without rolling
  ON PURPOSE and all three are non-DoT debuffs: Thunder Clap's slow, Wrack's
  amplification, and the damage-free Seal of the Crusader branch of Judgement.
- **Every DoT can crit, and none is reduced by armor.** A Forever rule, not
  Classic's. A tick does not re-roll the table — whether the effect landed was
  settled on application — but it rolls for a crit at the crit chance of **the
  kind of event that applied it**, named by `DamageRequest.critFrom`. No
  `critFrom` means no crit and no random number consumed, so adding the field
  never shifts a seeded run. Bleeds are physical and still ignore armor:
  `appliesArmor: false` on every one.
- **A LATER STATEMENT FROM THE OWNER OUTRANKS THE SHEET, and Rake is the second
  one.** `WoWSimWorksheet.xlsx` gives Rake 1% of attack power on the hit and 1%
  per tick; the owner has since given the TICK as **5.5%** directly. The same
  shape as Wrack's 14.3%, which the sheet does not contain at all — and like
  Wrack it is recorded beside the constant, because a refresh of the sheet will
  not carry it and a reader who knows the sheet would read it as drift.
  **ONE OF THE TWO NUMBERS MOVED.** The hit is still 1%, so reading "Rake is
  5.5%" and setting both would quietly inflate the direct damage as well —
  `RAKE_AP_COEFFICIENT` and `RAKE_TICK_AP_COEFFICIENT` are separate constants
  for exactly this reason.
- **A COEFFICIENT IS MEASURED, NEVER COUNTED.** It is passed per `dealDamage`
  call, so `powerCoefficient` written in the wrong place is silent and grepping
  gives 77 damage sites and no ability names. `tools/coefficient_probe.ts` casts
  every ability every preset can reach, pushes one stat axis, and derives the
  coefficient from damage that landed; `tools/coefficient_report.mjs` sets it
  beside the source's own words. Counting declarations was the wrong measure and
  said the Rogue had none, when a Rogue ability correctly scales through weapon
  damage. [docs/coefficient-audit.md](docs/coefficient-audit.md)
- **`NO_CHANCES` DOES NOT STOP A CRIT.** `applyAbilityModifiers` ADDS a talent's
  `abilityCrit` to whatever the provider returned, so an ability a talent grants
  crit chance to still crits at a base of zero — and the crit multiplier scales
  the coefficient's contribution as well as the base. Conflagrate read 0.7071
  against a declared 0.4286, which is not a coefficient error but 1.5x of one.
  A large NEGATIVE chance is what holds; zero is the number that looks right and
  is not.
- **A tick is reached for CRIT and not for DAMAGE.** The crit fields read
  `attackTable ?? critFrom`; the damage multiplier reads `attackTable` alone. So
  Mortal Shots' crit damage reaches Serpent Sting's ticks and "damage you deal
  with ranged WEAPONS" correctly does not.

### The modifier scopes — three keyed, two conditional

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
| `Combatant.periodicDamageMultiplier` | nothing — a scalar | "PERIODIC damage only", which crosses all three of the above |
| `Combatant.bleedingTargetModifiers` | `AttackTableKind`, read only while the TARGET bleeds | "your melee abilities on BLEEDING targets" |

- **`periodicDamageMultiplier` IS A FOURTH AXIS AND IT CROSSES THE OTHER THREE.**
  Genesis is "the periodic damage and healing done by your spells AND abilities",
  which is every school, every table and every ability at once — so it is not one
  of the keyed scopes and a list of ids would be unmaintainable. What separates it
  is the one thing none of them can see: whether the damage is a TICK.
  `DamageRequest.periodic` has carried that since the first DoT, so it is a new
  READER of an existing fact rather than a new fact.
- **`bleedingTargetModifiers` IS THE SAME CLASS, A SECOND INSTANCE**, not a new
  shape: "on Bleeding targets" is `AttackTableModifiers` in every respect except
  that whether it counts is a question about somebody ELSE, answered per hit. Kept
  APART from the unconditional one for the reason `addWhileAura` is kept apart
  from `add` — combining loses the condition, and a talent that pays all fight
  instead of during its window is a bigger number and no error.
- **THE BLEED IS ASKED OF THE AURAS, NOT OF A LIST OF IDS.**
  `AuraDefinition.isBleed` is a ruleset TAG the engine attaches no behaviour to,
  so a new bleed is covered the day it lands. It is NOT derived from "physical,
  periodic and ignoring armor" — a true description of every bleed here — because
  the school and the armor rule are decided inside `onTick` and are not visible on
  the definition. **A derivation that has to run the effect to answer is not a
  derivation.**
- **A TICK IS REACHED FOR CRIT AND NOT FOR DAMAGE, and the bleeding scope obeys
  that too.** `bleedingTargetModifier` takes the table as an ARGUMENT for exactly
  that reason: the crit fold passes `attackTable ?? critFrom` and the damage fold
  passes `attackTable` alone. Hard-coding either would break half of a convention
  that is written down. **It is also what stops Rip amplifying Rip** — a bleed's
  own ticks being raised by the bleed being up is self-referential, and the looser
  reading measured the Cat Druid a third higher.

**AND A FOURTH THAT BELONGS TO THE OTHER SIDE OF THE ATTACK.**
`AuraDefinition.attackerAbilityModifiers` is keyed by ability id like the first
and is carried by the DEFENDER, read through `Combatant.abilityModifierAgainst`.
Winter's Chill is "increases the chance your Ice Lance and Frostbolt spells will
critically hit THE TARGET" -- a per-ability crit the boss holds, which
`abilityCrit` could not say because it is registered on the caster, and which an
ordinary aura could not say because it reaches every ability or none. **Only
auras, with no build-time registry behind it**: a debuff is by definition
something that comes and goes.

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
- **AND THAT RULE HAS A COUNTER-EXAMPLE NOW: THE OWNER'S FIGURE BEATS THE
  WORDING.** Rend and Tear is "damage done by your melee ABILITIES on Bleeding
  targets", which by the rule above stops at `melee-special` — and that is what
  shipped. The owner reported expecting "around 1.09x" and seeing "more like
  1.025x", and the three readings measure, at 89.3% bleed uptime on the Cat:
  `melee-special` non-periodic **×1.0296**, plus the ticks **×1.0612**, plus the
  AUTO-ATTACKS **×1.0948**. Only the last is 1.09 and the first is 1.025 to the
  decimal, so the talent reaches every point of melee damage.
  **A STATED EXPECTED VALUE SETTLES A WORDING QUESTION THAT THE WORDING CANNOT**
  — so when a tooltip is ambiguous and a figure is available, compute what each
  reading would give and let the figure choose. It also means Rip raises Rip,
  which is the self-reference the narrow reading was partly chosen to avoid, and
  that is the owner's call rather than an oversight.
- **A crit damage bonus raises the bonus HALF** — 1.0 for a 2x melee crit, 0.5
  for a 1.5x spell crit. "+100%" takes a spell crit to 2.0x, not 2.5x; a melee
  crit with "+10% crit damage" is 2.1x, never 2.2x.
- **A TOOLTIP THAT LISTS SPELLS BY NAME IS A FOURTH SCOPE**, `abilityCritDamage`,
  and the three above could not reach it: whole-character, per school and per
  table all select something a NAMED LIST is not. `critMultiplierBonus` had
  existed since Impale with no talent effect reaching it, and two talents in two
  classes said so in almost identical words -- the Warlock's Pandemic over seven
  periodic spells and the Rogue's Lethality over six strikes. **It DECLARES its
  table rather than deriving one**, because `AbilityModifiers` is keyed by ability
  and nothing in it knows which table an ability rolls on; reading the melee half
  for Pandemic would have been worth twice the talent. **An aura id is an ability
  id here**, which is what makes a talent naming seven DoTs expressible at all.
- **A TREE IS NOT A SCHOOL, and for a Warlock the wrong reading is the tempting
  one.** "Your DESTRUCTION spells" was `schoolDamage` / `schoolCritDamage` over
  Fire and Shadow -- the two schools a Warlock HAS, so it selected every spell it
  owns, Affliction included. Two talents did it, both for the whole project, and
  Corruption collected +100% crit damage and +10% damage it was never entitled to.
  **Read what the tooltip SELECTS, not what the class happens to cast**; the tree
  is in the spellbook capture's own `tab` field, and **Shadow Bolt is a Destruction
  spell** -- the entry a reader gets wrong from the school alone.
- **A PER-SCHOOL EFFECT THAT COMES AND GOES BELONGS ON THE AURA, not in
  `SchoolModifiers`** -- `AuraDefinition.damageDoneBySchool`, the attacker's
  mirror of `damageTakenBySchool`. `SchoolModifiers` is built once when the
  character is. **BOTH WARLOCK EFFECTS THAT WANTED IT WERE APPLIED
  WHOLE-CHARACTER WITH A CAVEAT ADMITTING IT, AND BOTH CAVEATS UNDERSTATED THE
  COST**: Demonic Sacrifice names one school out of four demons and Shadow and
  Flame's two halves name OPPOSITE schools on purpose, so a hybrid collected
  x1.10 twice on every school where the talent gives x1.10 once per school.
  **"Generous for a hybrid" was −55.3 DPS of Firelock, 10% of the profile.**
  `game/auras/warrior.ts` had predicted the field by name years of commits
  earlier: "the day an aura needs to scale one school and not another".
- **A CAVEAT IS NOT A SUBSTITUTE FOR THE FIELD, and its price is not a rounding
  error.** Applying a per-school effect whole-character "because the profile is
  almost all one school" is a claim about a PROFILE, and it silently becomes false
  for the next build — which is exactly what happened: the same sentence was exact
  for SM/DS and 10% wrong for Firelock, and it said "exact for either profile".
- **`ALL_ABILITIES` COUNTS ON AN AURA TOO, and did not until Shatter needed it.**
  `AuraCollection.abilityModifierFor` looked the ability id up EXACTLY, so an aura
  declaring `{ '*': ... }` compiled, applied, reported its uptime and changed
  nothing about any cast -- Berserk introduced the field with a NAMED ability and
  never exercised the catch-all. `pick` is the ONE shared implementation of that
  fold now, because it was written out per site and the third copy is where it
  drifted. It also carries the double-count guard: asking for `'*'` must return
  the catch-all once, or a talent granting +20% reads back as +40%.
- **`modifiersScaleWithStacks` HAS TO REACH EVERY COLLECTION THAT READS IT, AND
  IT REACHED TWO OF THREE FOR A LONG TIME.** `statModifiers` honoured it and
  `damageTakenBySchool` honoured it and `abilityModifiers` silently ignored it,
  so an aura declaring both stacked visibly, REPORTED its stack count and PAID
  one stack's worth. `scaleByStacks` is the one place the rule lives now:
  **chances multiply by the count and damage goes to the POWER of it**, which is
  what every other reader of that flag already did -- a five-stack 1.03 is 1.159
  and not 1.150.
- **WRITING `instance.stacks` DIRECTLY DOES NOT RE-APPLY STAT MODIFIERS**, and
  the failure is an aura that reports N stacks and pays one. `applyStatModifiers`
  runs inside `apply` at ONE stack and only `refresh` re-applies. Combustion did
  it and was worth a tenth of itself while its own caveat called it generous;
  Flurry does it and is unharmed, because its haste does not scale with stacks.
  **`chargesOnApply` is the field for an effect that starts full.**
- **A MODIFIER CAN BE REGISTERED AT BUILD TIME AND CONDITIONED AT READ TIME** --
  `AbilityModifiers.addWhileAura` / `forWhileAura`, keyed by aura id, with
  `Combatant.abilityModifierFor` as the third source in the one funnel every
  reader comes through. Shatter is why: its crit is on the Mage and its window is
  a DIFFERENT talent's aura, so writing the number onto the aura would mean one
  talent reading another's rank mid-build -- correct only while the two are
  visited in the right order, and **talent iteration order is not something to
  rest a crit chance on**. Conditional entries are stored APART from unconditional
  ones, because combining loses the condition and a talent that pays all fight
  instead of during its window is a bigger number and no error.
- **A MODIFIER CAN ALSO CARRY HIT, AND FIVE TALENTS ACROSS THREE CLASSES SAID IT
  COULD NOT.** `AbilityModifier.hitBonus` is **taken off MISS**, because no table
  carries a hit chance — `hit` is the remainder after the walk falls past every
  other slice. Arcane Focus and Elemental Precision, Shadow Focus and Holy
  Precision, and Divine Precision all read "improves your chance to hit with
  <school> spells" and all carried the same reason: that the attack table decides
  hit before any per-school modifier is consulted. **It does not** —
  `combineModifiers` takes the school's modifier as one of its three arguments and
  hands the result to the roll. What was missing was a FIELD, not a route to one.
  **And `combine` has to fold it**: it did not at first, so one source worked and
  TWO silently cancelled, which is how Divine Precision stayed inert for a build
  whose gear already had a Holy entry to combine with. Worth 19 DPS when fixed.
- **THE TARGET CAN CARRY SPELL POWER TOO** — `AuraDefinition.spellPowerTakenBySchool`,
  read through `spellPowerAgainst`. "Increases damage done by your Holy spells by
  up to 161" is the attacker's gear and "increasing Holy damage taken by up to
  161" is Judgement of the Crusader on the target: same school, same arithmetic,
  different owner. **"UP TO" IS THE WORD THAT DECIDES IT**, on the owner's ruling
  — it is POWER and each ability scales it by its own coefficient, so a seal at 20%
  gains a fifth of it. A flat 161 on every Holy hit would roughly treble a seal.
  Its reason said a flat per-school bonus had no declaration and had correctly
  ruled out `damageTakenBySchool`, which multiplies; what it got wrong was reading
  the number as flat at all. **An ability that computes its own damage in `game`
  must ASK**, because `scaleByPower` needs a coefficient to apply it to — every
  Paladin seal calls `spellPowerAgainst` for exactly that reason.
- **AN AURA CAN SCOPE ITS DAMAGE TO A TABLE** — `damageDoneByTable`, the
  aura-shaped sibling of `AttackTableModifiers`, which is built once with the
  character and cannot come and go. Seal of the Crusader is the first caller:
  "attacks 40% faster, but deals less damage with each attack", and the penalty has
  to arrive and leave with the seal. **On `melee-auto` alone**, because haste here
  shortens a swing and a cast and nothing else — a whole-character
  `damageDoneMultiplier` would take the penalty to Judgement and Consecration,
  which the haste never accelerated.
- **A CONDITION THE CHARACTER *IS*, RATHER THAN CARRIES, GOES IN
  `BuildRequirement`** — weapon type, two-handed, shield, pet, and now `styles`.
  **A DRUID'S FORM IS ITS COMBAT STYLE**, a field the preset sets, so "in Cat
  Form, Bear Form, and Dire Bear Form" is as knowable before the pull as the
  weapon in its hand. `stat`, `statFromLevel`, `grantAura`, `conditionalDamage`,
  `conditionalCrit` and `reaction` all take one.
- **"THE FORM IS FIXED" IS A REASON A SHIFT CANNOT PAY OUT, NOT A REASON A TALENT
  CANNOT READ THE FORM**, and conflating the two inflated the Druid's queue by
  three. Five talents were written up as ONE engine gap — mid-fight shifting —
  and only two of them ask whether a shift happened; the other three ask which
  form is HELD. **When a family of talents is written up as one gap, check they
  are all asking the same question.**
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
- **A CAST REACTION FIRES ONCE PER CHANNEL TICK, and `AbilityCastEvent.final`
  is how one that ENDS something tells the last tick apart.** `runCast` runs per
  tick, so a reaction removing an aura would remove it on the first of five
  missiles and leave the other four outside the window -- a smaller number and
  no error. Arcane Blast is why: its stacks last "until any other damage spell
  is cast", and the only reading where its damage clause pays anything is that
  the other spell BENEFITS and the stacks then go. **Not `castEndsAt === 0`**,
  though that is true at the same moments: resting a ruleset reading on a field
  the engine happens to clear one line earlier survives until somebody reorders
  two statements.
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
- **OR OF AN ABILITY IT DOES *NOT* NAME: `abilityIds` TAKES `ALL_ABILITIES`, AND
  THEN THREE CLAUSES NARROW IT.** Clearcasting is "your next damage or healing
  spell or offensive ability", which is not a list and never will be, so it
  passes the catch-all and narrows with `exceptAbilityIds` ("not consumed by
  Wrath"), `requiresCost` ("nor by spells or abilities that cost no resources")
  and `requiresAttackTable`. **Each one is a charge that would otherwise be
  thrown away on the wrong thing** — and a charge spent on the wrong ability is
  the invisible failure: the proc still fires, the aura still reports its uptime,
  and the saving simply lands somewhere it should not.
  **SELECTING BY SCHOOL IS STILL NOT THERE.** "Your next SPELL" is a different
  set from "every ability" and only one of them is expressible; Presence of Mind
  still says so.
- **`requiresAttackTable` IS THE OWNER'S DEFINITION OF "OFFENSIVE", REUSED.**
  Asked which abilities Focused Rage reduces, they ruled that "an ability is
  offensive if it is PROCESSED THROUGH A COMBAT TABLE. Heroic Strike, Thunder
  Clap and Sunder Armor are; Battle Shout is not." So Clearcasting reads the same
  rule, and the Druid's Demoralizing Roar -- ten rage, no table, and the first
  entry in the Bear's list -- does not consume it. **A ruling already on the
  books is worth looking for before inventing a reading**, and this one answers
  a tooltip written for a different class.
- **`runCast` RUNS `onCast` BEFORE THE CAST REACTIONS**, and that ordering is
  load-bearing rather than incidental: the spell that spends an aura's FINAL
  charge has already rolled its crit while the aura was still up. Reversing the
  two would silently rob every Fingers of Frost window of its last spell, and
  nothing would error.
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
  strike and wrong for a 380-mana spell. **AND `abilityCost` TAKES A
  `valueIndex`, because one talent can cut two abilities by two different
  amounts** — Shredding Attacks is 18 energy off Shred and 3 rage off Lacerate,
  and a second entry reading the first number would have taken 18 rage off a
  15-rage ability, which is not a small error but the ability made free. **Two on the same ability stack
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
- **A STAT CAN BE A PERCENTAGE OF THE *LEVEL*, AND THAT ONE IS RESOLVED ONCE** —
  `statFromLevel`, for Predatory Strikes' "150% of your level". Level cannot be
  buffed and never moves during a fight, so folding it into the derivation would
  add a term that can never change; resolving it at build time is CORRECT here for
  exactly the reason it is wrong for `statFromStat`. **A caller that supplies no
  level gets an inert talent that SAYS it is inert** rather than a plausible 60
  nobody chose, and both callers pass `MAX_CHARACTER_LEVEL` — the level the fight
  builds at, not one off the profile, because a panel has to describe the
  character the fight will run.

### Resources

- **AN ABILITY THAT DOES NOT CONNECT REFUNDS 80% OF ITS COST**, for RAGE AND
  ENERGY only. The rule is the engine's and the numbers the ruleset's, so both
  arrive on the COMBATANT like `baseGcdMs`. **Derived, not declared**: an
  ability opts OUT with `refundsCostOnMiss: false` and never in, so a new one
  gets the rule for free — Ferocious Bite and Execute are the two exceptions.
  It reduces to `AVOIDED_OUTCOMES`, because `melee-special` has **no block
  outcome at all** and an auto-attack that is blocked costs nothing. **A
  multi-hit ability is judged on its FIRST hit**, so Whirlwind's off hand
  missing after its main hand connected refunds nothing.
- **ENERGY, MANA AND FOCUS TICK TWENTY TIMES A SECOND** — "smooth"
  regeneration, at 50ms, because no event-driven engine is continuous. All
  three keep the RATE they had; the cadence is what changed. **A rate and a
  cadence are separate decisions and an instruction can change one while
  looking like it changed both**: energy specified as "1 energy 20 times a
  second" is twenty a second against the old ten, which measured at +35% to
  +53% on every energy build before the owner confirmed smoothing was the
  intent.
- **COMBO POINTS BELONG TO A TARGET.** `comboPointTargetId` records whose they
  are; building on another enemy discards them. It cannot fire with one enemy,
  which is the point — the old model would have carried points across targets
  SILENTLY. **Anything that banks points by writing the pool must set the
  target too**, or every finisher refuses to spend and reads as an ability that
  lost its flat damage.

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
- **A BUFF THE CHARACTER PROVIDES ITSELF IS THE SAME AURA REACHED SEVERAL WAYS,
  AND THE ID IS THE WHOLE RULE.** Moonkin Aura and Leader of the Pack are two
  raid buff entries AND two Druid talents, and the owner has ruled that "these
  are all the same exclusive 3% global critical strike chance and do not stack"
  — so there is ONE `AuraDefinition` with one id, `PARTY_CRIT_AURA`, and all
  four sources apply it. `AuraCollection.apply` refreshes a matching id instead
  of stacking, so no combination is worth more than 3%. The arrangement Thunder
  Clap already had, which `raidBuffs.ts` reuses from the Warrior.
- **AND IT SUPERSEDES "HANDLE IT ON THE GUI", BECAUSE A GUI RULE CANNOT COVER A
  SOURCE THE GUI DOES NOT OWN.** The earlier ruling made exclusivity a SELECTION
  rule, and `withRaidBuff` does switch one entry off when the other goes on. It
  governs the two RAID BUFF entries and knows nothing about a TALENT — so a
  Moonkin carrying its own form talent in a raid with Leader of the Pack ticked
  held two ids and read **+6% crit**, measured at 24.243% against 21.243%. A
  profile loaded from JSON with both ids does the same, because nothing re-runs
  `withRaidBuff` on load. **When a rule is enforced at a chooser, ask what else
  can reach the thing being chosen.**
- **THREE PRESETS SUBSTITUTE ONE RAID BUFF AND ONE DROPS ONE, and a SWAP is the
  commoner shape.** The two ranged Hunters take Grace of Air for Windfury, the
  Moonkin takes Moonkin Aura for Leader of the Pack — the half of the pair it
  provides, on the owner's instruction — and only the Enhancement Shaman drops
  one outright, because Windfury Weapon disables the totem for its own carrier.
  Both lists are derived from `PRESET_RAID_BUFFS` by mapping rather than written
  out, so a buff added there reaches them; the exception lists are in
  `presets.test.ts` and are asserted EXHAUSTIVE. **A drop and a swap say
  different things about the raid**: dropping says it is short a buff, which for
  the Moonkin was wrong — it has the other one.

### Pets

- **A pet is a second friendly combatant, and almost all of that already
  worked.** The one thing missing was reporting, so **reporting reads every
  friendly actor, not the player** — damage and buff uptime both, or a working
  pet talent looks exactly like an inert one. Rage and survival stay the
  player's, which they genuinely are.
- **AND READING EVERY ACTOR MEANS A ROW CAN BE ABOUT THE WRONG ONE.**
  `abilityBreakdown` pools by ability NAME across friendly actors, on purpose —
  one table, not two — so a pet's main-hand swing landed in the row called "Main
  Hand Auto-Attack". That row was **38.1% of BM Hunter and none of it was the
  Hunter's**: the profile is `combatStyle: 'ranged'` and never swings a melee
  weapon. Shares still summed to 100%, nothing contradicted it, and
  `docs/handoff/hunter.md` read the row and wrote down "BM Hunter is the only
  profile that swings BOTH melee and ranged". **A mislabelled number becomes a
  documented fact in one reading.** `autoAttackName` names a pet's swing after
  the pet, in the engine beside `AUTO_ATTACK_NAMES` because `kind` is an engine
  concept and naming it twice is how two labels drift.
- **A talent reaches the owner; a pet needs `petStat` and `petReaction`**,
  collected into `TalentBuild.pet` and handed to `createPet`, which applies what
  it is given and does no arithmetic on a rank.
- **A pet receives no raid buffs**, a Forever rule. `isPlayerControlled` counts a
  pet — right for who the raid is FIGHTING, wrong for who it BUFFS.
  `kind === 'player'` is the narrower test.
- **A PET HAS STATS OF ITS OWN AND INHERITS MORE ON TOP**, and for a long time
  only the second half was modelled. Its own, from the owner: 136 strength, 100
  agility, −20 attack power, with `AP = −20 + Str × 2 + 0.1 × max(melee, ranged)`
  and `crit = agility / 20 + owner's crit` — so **252 attack power and 5 crit
  before a point of the Hunter's**. Inherited: 2 health a stamina, 30% of armor,
  10% of the HIGHEST attack power source, 100% of crit. The inherited share is
  about a THIRD of a pet's attack power, so a pet is **less** gear-sensitive than
  this used to say, not more.
- **A PET'S SWING SCALES WITH ATTACK POWER AND CLAW AND BITE DO NOT**, which is
  the owner's statement and is expressed by those two declaring no
  `weaponScaling`. Their share of a pet's damage FALLS as the Hunter gears up.
- **THE PET'S DAMAGE MULTIPLIER IS COMPOSED, NEVER DECLARED.** The owner's "Pet
  Global Damage Multiplier = 1.375x" IS Petopia's 1.10 family modifier times the
  wiki's 1.25 for a fed pet — the same thing, not a third number. **Declaring a
  stated figure beside the factors that already produce it is the failure here**:
  it takes a Cat to 1.89, which is a bigger number and no error. 1.375 appears
  nowhere in the source, and the guard is an END-TO-END scripted swing rather
  than a constant check, because a constant check cannot see a double
  application.
- ~~**A pet's base is a DPS, not a per-swing damage.**~~ **THE QUESTION DISSOLVED
  RATHER THAN BEING SETTLED.** The wiki's `((PetBaseDPS + AP / 14) × mods) ×
  PetSwingSpeed` multiplied out IS the owner's `(random(min, max) + swing / 14 ×
  AP) × mods`. The unit was only ever ambiguous while the SWING was unknown, and
  the owner states it. **A disagreement between two sources can be an artefact of
  a third number neither of them gives.**
- **A placeholder in the wrong UNIT is still worse than one with the wrong
  value**, because the value is wrong once and the unit is wrong every time
  something else moves. That lesson outlived the thing that taught it.
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
  10, treat a difference inside the interval as no difference.
- **BUT A REAL/noise VERDICT IS A TEST ON THE OUTPUT, so a change with a known
  EXACT mechanism can be real and be labelled noise.** Naturalist's fix took the
  Cat from 703.8 to 716.4 and the harness printed `noise`, because 1.8% is inside
  that profile's own run-to-run interval -- and the change is deterministic:
  703.8 x 1.02 / 1.002 is 716.4 to the decimal, as is the Moonkin's
  472.8 x 1.05 / 1.005 = 494.0. **Where the mechanism predicts an exact ratio,
  check the ratio.** The verdict is the right default and it is a statement about
  variance, not about whether anything happened.

**A ONE-SHOT STRING REPLACE IS UNSAFE WHEREVER THE STRING IS NOT UNIQUE, AND
THE TELL IS TWO VARIANTS AGREEING TO THE DECIMAL.** The Cat attribution probe
reverted Rend and Tear's `critFrom` fold with `replace(find, replace, 1)`, and
`bleedingTargetModifier(request, request.attackTable ?? request.critFrom)`
appears TWICE in `damage.ts` -- the CRIT fold in `rollTable` and the DAMAGE fold
in `resolveDamage`. It hit the first, which carries no crit for that talent, so
the variant reverted something inert and measured the same build twice: 910.3 and
910.3, identical, and the figures looked like a finding rather than a bug. **Two
variants that agree exactly are a patch that did not apply**, not a change worth
nothing -- a change worth nothing still shifts the RNG sequence. Count the
matches and refuse unless there is exactly one.

**AND PATCH IT BY SLICING THE LIST, NOT BY `replace(old, new, 1)` -- THE ENTRIES
ARE TEXTUALLY IDENTICAL ACROSS LISTS.** The Rogue's Slice and Dice entry is the
same four lines in all three of its lists, so a one-shot string replace hit the
VENOM list while the RUPTURE profile was being measured. Twelve cells of a sweep
came back with the Slice and Dice axis **identical to the decimal**, which is the
only reason it was caught: a dimension that does nothing looks exactly like a
dimension that does not matter, and the conclusion "this threshold is not a lever"
was sitting right there to be believed. Slice the file at the list's own
`export const` and assert the entry appears **once** inside it. The comment that
  put Summon Hawk above Arcane Shot counted the hawk's ticks and not its price,
  and was specific, plausible and believed for as long as it existed. **It
  happened again with Venom**, whose first comment said it belonged above the
  damage finishers "by measurement" before anything had been measured — three
  placements later it was −15 to −20 DPS at every one.
- **A CORRECTLY IMPLEMENTED ABILITY CAN BE WORTH CASTING NEVER.** Venom's +30%
  to poisons loses to the Eviscerate its combo points would have bought,
  because poisons are about a fifth of the build's damage. It is built, tested
  on its MECHANISM, and in no list — so one line re-measures it the day a
  coefficient moves.
- **THE RESOURCE PANEL IS AN APL TOOL.** Its timeline shows the shape a total
  cannot: a Rogue flat at zero is starved, a Warrior flat at 100 is capping and
  wasting income, and a caster whose mana never recovers has hit the five
  second rule harder than it regenerates. Read it before reordering a list.

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

**A PRIORITY LIST CANNOT HOLD A SEQUENCE, AND IT DOES NOT NEED TO.** The owner's
Rogue stealth design is four sequences -- an opener, a Vanish-Ambush pair, a
Preparation clause, and the Vanish-Premeditation-Ambush that follows it -- and it
is THREE ENTRIES. A list is re-read from the top every global cooldown and the
first castable entry wins, so a sequence is what EMERGES when each of its steps is
in turn the highest castable entry. The fourth sequence needs no entry at all:
once Preparation has finished their cooldowns, the same three entries are castable
again and the list walks them. **Say so where the entry is not**, because an
absent entry for a clause the owner named reads exactly like an omission -- and a
second entry per ability would be the duplicate-id shape this project only wants
deliberately.

**A GATE AN ABILITY'S OWN `canCast` ENFORCES BELONGS THERE AND NOT IN THE LIST.**
Ambush's entry carried `selfActive('cutthroat')`, which was the list restating the
ability's rule. Harmless while there was one route to the gate -- and the moment
the owner added a second, it would have been the list restating HALF of it, which
is worse than restating none. An unconditional entry is still refused by
`checkCast`, so it is only a FLOOR under the entries below when it is also always
castable.

**AN ENTRY THAT NEVER FIRES HAS FOUR CAUSES AND THREE OF THEM ARE INVISIBLE.**
The id names no ability; the build never learned it; the entry above never
yields; or the ENCOUNTER already supplies it. Only the first is caught by a
test. Twelve entries across eight of the 23 profiles once fired zero times, and
every one of them produced an ordinary DPS figure and an ordinary results page
-- an entry that never fired is simply a row that is not there.
`tools/measure_profiles.ts` with `USES=1` prints the list in priority order with
what each entry actually did, and reading the built character's own ability book
is what tells the BUILD cause apart from the POSITION cause rather than guessing.

**AND A FIFTH CAUSE, WHICH IS THE ENGINE SIDE OF THE SAME COIN: THE CONDITION
READS SOMETHING NOTHING SETS.** `Combatant.recordSwing` was added so the Hunter
lists could ask "has a ranged auto-attack fired in the last 0.5 seconds", and it
landed in `extraAttack` instead of `scheduleSwing` -- two functions carrying the
SAME TWO LINES, so the edit matched the wrong one. The window never opened,
Aimed Shot and Sniper Shot fired zero times in three lists, nothing errored, and
the comment beside the mistake asserted the opposite of what the code did. **When
a new condition primitive is added, the `USES=1` pass IS the test that it
fires** -- the suite passed with it broken.

**AN UNCONDITIONAL ENTRY IS A FLOOR UNDER EVERYTHING BELOW IT.** The Rupture
Rogue's Hemorrhage is 35 energy and ungated, with Ghostly Strike at 40 and
Sinister Strike at 45 beneath it: nothing below an ungated, cheaper ability can
ever be the first castable entry, so a six-entry list is really a three-entry
one.

**AND THE SAME RULE UPSIDE DOWN: A CHEAPER ENTRY STARVES AN EXPENSIVE ONE FROM
BENEATH, HOWEVER HIGH THE EXPENSIVE ONE SITS.** Ambush is SECOND in that list and
still could not be cast, because Hemorrhage at 35 energy is seventh and took the
pool every time it passed 35. **Priority does not reserve a resource** -- an entry
is checked, refused for cost, and the list walks straight past it to something
affordable, which is the correct behaviour and is also how a 60-energy ability
below a 35-energy one never fires. The fix is a condition on the CHEAP entry
(`not(poolingForAmbush)`), not a reorder: position was never the problem.

**THE MEASUREMENT IS WHAT MADE IT LEGIBLE, AND IT WAS NOT GUESSABLE.** Over 300
fights: 207 Cutthroat windows, **30 ending in an Ambush**. Mean energy at the
moment a window OPENED was **0.2** -- Cutthroat procs off Backstab, which costs
the same 60, so the proc always lands on an empty pool -- and the mean PEAK over
the ten seconds that followed was 45.2, with only 30 of 207 windows ever reaching
60. The window was not too short; the regeneration was being spent before any of
it could be banked. **Count the windows and their fates, not the casts**: "Ambush
fired 2.74 times" says nothing about whether a gate opened and closed unused.

**ONLY IF IT HAS NO COOLDOWN, THOUGH.** Sniper Shot moved BELOW an ungated
Arcane Shot still fires twice a fight and measures 311.7 either way, to the
decimal — because Arcane Shot's own six-second cooldown lets the list fall
straight past it. **An entry is a floor when it is ungated AND always castable**,
and a cooldown is the half that is easy to forget, because the condition is the
thing written in the list and the cooldown is not.

**AND THE COST THAT DECIDES IT IS THE BUILT ONE, NOT THE TOOLTIP'S.** The Cat
Druid's Claw fired zero times at ANY energy, and its own comment explained why it
should fire: "falls back when Shred is unaffordable, which at 60 energy it often
is". Both halves were wrong. Improved Shred takes Shred from 60 to 42 and
Ferocity takes Claw from 45 to 42, so the two cost the SAME and the harder-hitting
one is above it. Read costs off the character `characterAtCombatStart` builds, not
off the ability declaration -- a talent cost reduction is exactly the thing that
turns a sensible fallback into an unreachable one.

**A DUPLICATE ID IS ONLY A BUG IN THAT SAME SHAPE** -- the Mage's Arcane
Missiles and the Warlock's Shadow Bolt are each in their list twice on purpose,
gated on a proc above and ungated as the filler below, and a test that said "no
ability twice" failed both correct lists the moment it was pointed at a class
other than the Warrior.

**A MEASUREMENT IN A COMMENT EXPIRES THE SAME WAY AN `unmodelled` REASON
DOES.** Battle Shout sits in four Warrior lists carrying "+11.83 DPS", measured
before raid buffs were SELECTED rather than assumed -- and `battle_shout` is in
the preset raid buff list, so the entry's own condition refuses it for the whole
fight in every one of them. The figure was right on the day. When a change moves
what a list can reach, re-read the comments on the entries around it.

**A TEST THAT ENUMERATES ITS SUBJECTS BY HAND DECAYS, AND SILENTLY.**
`rotationIds.test.ts` was written the day a Protection entry was found asking
for `rend` when the ability is `rend_cast`, and it listed the lists to check.
By the time nine classes existed it was checking FOUR OF TWENTY-SIX -- not the
Warrior's own two-handed list, and not one entry belonging to any other class.
The enumeration is `src/game/rotations/allLists.ts` now and the test reads the
source files and fails if a list exists that the registry does not carry, which
is the same structural argument `classRegistration.test.ts` makes.

**WHICH LIST A PROFILE RUNS IS A CLAIM, AND IT IS WORTH A TEST.** `rotationFor`
dispatches on style, stance and talents in five different patterns across nine
classes, and the Shockadin ran a list built around a talent it does not take for
its whole life without erroring. All 23 mappings are pinned now.

**A REFRESH WINDOW CLIPS, AND A BUFF IS WHAT EXPOSES IT.** Every list this
project wrote for itself refreshed a debuff at two seconds remaining, and a
refresh RESETS the aura -- so whatever is left is thrown away, and the faster the
character acts the sooner it reaches the entry inside that window. Nature's Grace
cost the Moonkin 14.9 DPS doing nothing but speeding it up: casts went 26.3 a
fight to 27.4 while Moonfire ticks fell 25.1 to 22.5. **A haste buff that
measures as a loss is this, not a bug.** The ruleset owner's lists say "if not
active" instead, and the Elemental Shaman's entire +16.4 is that one word on
Flame Shock with nothing else in its list changed.

**ISOLATE A LOSS, DO NOT BLAME THE OBVIOUS SUSPECT.** The owner's Venom list
measured -24.3 and the suspect was its Venom entry, which THREE earlier
placements had each measured as a loss. It was not: removing the entry dropped
the list to 375.0, so it is worth +17.7 there. The whole -24.3 is the two
aura-duration floors on Eviscerate -- gating it on five combo points alone gives
413.1, inside the interval -- because the floors suppress it to 0.2 casts a fight
and the points overflow instead. **A prior measurement is true of the list it was
taken in**, and "a point spent on Venom is a point not spent on Eviscerate" stops
holding when Eviscerate cannot fire.

**A SPECIFICATION READ LITERALLY CAN DISABLE ITSELF, AND BOTH TIMES IT LOOKED
FINE.** "Scorch if scorch debuff <= 5" is always true, because Fire Vulnerability
caps at five -- so Scorch becomes unconditional and every entry below it in two
Mage lists is unreachable. And the Seal Twist cycle had NO ENTRY POINT: each seal
was gated on the other being up, so after the opening Seal of the Crusader
neither could ever fire and the profile named "Seal Twist" ran a whole fight on
one seal. Nothing errored either time. **Implement the reading that leaves every
clause doing work, name the constant, and say which reading was chosen** -- and
where the fix changes the owner's design rather than interpreting it, ask.

**THE OWNER'S LIST OUTRANKS A MEASURED DECISION OF OURS, AND THE MEASUREMENT
STAYS.** `petsAndHunter.test.ts` asserted Hunter's Mark OUT of the melee list on
40 batches saying -10.1 there. The owner's list names it, so it is in, and -10.1
became the price of that choice rather than an argument against it. The test now
asserts what is not a rotation decision -- the ability is cast once -- and keeps
the figure. **A test that pins a rotation decision has to give way when the
decision changes owner; a test that pins an invariant does not.** Two Paladin
tests asserting "every build keeps a seal up and judges it" are the second kind,
and they are what caught the seal deadlock.

**A LIST CAN CHANGE COMPLETELY AND BE WORTH NOTHING.** Combat's Eviscerate went
from 1.1 casts a fight to 9.0 for +0.6 DPS, and the Rupture list went from three
live entries to seven for +0.1. "Hold for five combo points" is a claim about
damage per POINT and spending as they come is a claim about the whole cycle, and
the measurement says they are the same cycle. **The uses column is what says
whether a list changed at all; the DPS says whether it mattered.**

**AND A TWO-POINT COMPARISON CANNOT SEE A PEAK, WHICH IS HOW THAT FINDING WENT
WRONG.** Sweeping Combat's Eviscerate gate over every point count gives 577.7,
**588.5**, 587.2, 580.6, 572.2 — and the two lists compared above are the two
WORST cells, bad in opposite directions, with **+10.8 sitting between them**.
"It does not matter" is the conclusion two points hand you whenever they happen
to measure the same, so **sweep the parameter rather than comparing the two
readings somebody already wrote down**. It is cheap: a point gate, a threshold or
a refresh window is one number, and the whole range costs the same measurement
each.

**AN UNGATED FINISHER ABOVE THE ONLY BUILDER SPENDS ONE RESOURCE UNIT, ALWAYS.**
Not "whatever is on the bar", which is how the Combat list read and what its own
comment claimed: Sinister Strike awards one combo point, Eviscerate sat above it
with no gate, so the pool went 0 → 1 → 0 for the whole fight. **The gate is
therefore the COUNT rather than a floor** — every cast lands at exactly the gate
— and a list whose finisher could in principle spend five is a different list from
one that ever does. **Read the histogram, not the average**: "10 casts, 10 points"
says this instantly and a mean of 1.0 reads like a rounding artefact.

**AND "HOLD FOR THE MAXIMUM" NEEDS THE FINISHER'S TABLE TO RUN THROUGH THE
ORIGIN.** `EVISCERATE_BY_COMBO_POINT` is 278, 448, 618, 788, 958 — 278 for the
first point and 170 for each one after — so damage per point FALLS as the pool
fills, 278 down to 192. The rule this project applied everywhere is a rule about
a PROPORTIONAL table, and three of the Rogue's finishers have a flat first step.
Check the array before reasoning about damage per point.

**A BLEED HAS TWO TABLES AND BOTH CAN SLOPE THE SAME WAY.** Rupture is 159/222/
295/377/469 damage over 8/10/12/14/16 seconds -- 159 damage and 8.0 seconds for
one point against 94 and 3.2 for five -- so **damage per point AND seconds per
point both fall**, and the fifth point buys only 92 damage and two seconds. Four
measured +3.0 over five on the Rupture profile. **A duration table is a second
place to look and it is easy to check only the damage one.**

**THE SAME ABILITY WANTS A DIFFERENT THRESHOLD IN TWO LISTS, AND THE REASON IS
WHAT ELSE IS COMPETING.** Eviscerate's peak is TWO points on the Combat Rogue and
FIVE on the Rupture Rogue: Combat has no bleed, so Eviscerate is where its points
are meant to go, while on Subtlety a point taken by Eviscerate is a point Rupture
needed -- 489.3 at three points and 479.2 at two, against 498.1 at five. **Do not
normalise a threshold across two lists of the same class**, and do not read one
list's sweep as a fact about the ability.

**A MAINTENANCE BUFF'S THRESHOLD IS NOT A LEVER, AND THAT NOW HOLDS FOR TWO
PROFILES INDEPENDENTLY.** Slice and Dice at 2, 3 or 4 points is indistinguishable
on both the Combat and Rupture lists, and holding it to FIVE costs 4 to 18 on both.
Its duration table is proportional -- a flat three seconds a point -- so there is
no per-point argument either way and what decides it is uptime.

### Gear and items

- **AN ABILITY'S WEAPON REQUIREMENT IS GATED AT THE BOOK, NOT AT THE CAST.**
  `abilitiesForBuild` takes `style` and refuses Shield Slam without a shield and
  Spearing Strike without a two-hander, so the ability is simply ABSENT rather
  than present and always refused. The difference is what a report says: an
  ability in the book and never cast reads as a rotation problem, and this is a
  weapon problem. A `canCast` gate is the Rogue's dagger shape and is right where
  a weapon could change mid-fight; nothing here swaps weapons.
- **A stat that only applies sometimes is a bug waiting to happen.** Equipment
  resolution strips the slots a style cannot fill, and only genuine conflicts are
  exclusive: a two-hander against a one-hander, and an off-hand the style cannot
  hold. A ranged weapon coexists with a sword and simply does not swing.
- **AND THE ONE STAT THAT GENUINELY DOES ONLY APPLY SOMETIMES IS
  `Item.styleStats`.** "+172 Attack Power in Cat, Bear, and Dire Bear forms only"
  is the single line in the data that says it, and it was listed as unmodelled for
  as long as the item existed on the grounds that "an item stat is not conditional
  on the combat style". `statsForStyle` TAKES THE STYLE — it is how the slots are
  stripped in the first place — so the answer was one argument away the whole
  time. **THE FORM LIST IS MAPPED IN FULL OR NOT AT ALL**: a name `FORM_STYLES`
  cannot translate sends the whole line to `unmodelled` rather than applying the
  part that matched, because half a stat is worse than a reported one.
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
- **A CONDITIONAL ITEM LINE IS A CANDIDATE FOR EVERY OTHER SLOT IT NAMES.** The
  Glaive's clause lists three forms, two of which are one engine style, and the
  parser folds them — so a line naming Moonkin or a stat other than attack power
  is reported rather than guessed at. `reasonFor` says which of the two it is.
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
  Two more registries are OPTIONAL and silent in the same way: `CAST_REACTIONS`
  in `talentBuild.ts` (three classes have one) and `TALENT_AURAS` in
  `auras/talentAuras.ts`. **A `grantAura` naming an aura that registry does not
  carry is DROPPED rather than throwing**, which is right for a typo and reads as
  a talent that reports itself modelled and does nothing — so a class that adds
  one wants a test that the registry reaches every aura its effects name.
- **A TALENT-GRANTED SPELL IS IN THE CAPTURED SPELLBOOK WITH A LEVEL BESIDE IT.**
  `forever-druid-spellbook.json` gives Berserk "Learned at level 40", and gives
  Insect Swarm, Swiftmend, Feral Charge, Moonkin Form and Nature's Swiftness the
  same line. **All five are talents.** The level says where the client shows the
  spell, not how it is obtained — and reading it as a trainer spell put Berserk in
  the BASE ability list, so every Druid carried an ability it had spent no point
  on while its talent claimed the engine could not reach any of its clauses.
- **A `percentAdd` stat effect without `scale: 0.01` is a thousand percent.**
  `StatBlock` computes `(base + flat) × (1 + sum(percentAdd))`, so the modifier
  wants a FRACTION and a talent states a PERCENTAGE. It survived two class PRs,
  because a caster with a very large mana pool looks exactly like a caster with a
  very large mana pool.
- **AN EFFECT THAT READS THE *WRONG* VALUE IS NOT REPORTED EITHER, AND IT IS
  WORSE.** `conditionalDamage` had no `valueIndex`, so the Druid's Naturalist
  read index 0 of `[0.5, 5]` -- "reduces the cast time of your Healing Touch
  spell by 0.5 sec AND increases all damage you deal by 5%" -- and a rank-5
  Moonkin carried **x1.005 instead of x1.05** for the whole life of the talent.
  The number it was reading was a quantity of SECONDS.
  **THREE THINGS THAT USUALLY CATCH A BROKEN TALENT ALL PASSED IT.** The talent
  reported itself FULLY modelled rather than unmodelled, so the census counted it
  in the `Fully` column and no audit looks at a working talent's MAGNITUDE; half
  a percent is a perfectly plausible blanket multiplier; and the only published
  check on it was a profile DPS figure that had been measured with the bug
  already in, so every Moonkin and Cat number in the repository was light and
  self-consistent. **"Assert the MECHANISM" means the SIZE of the mechanism**,
  not only that it is wired up.
  `tests/game/talentValueIndex.test.ts` records all eleven blanket multipliers by
  hand with what each one's index MEANS, so a twelfth fails until somebody says.
- **AND IT HAS HAPPENED A SECOND TIME, ON A DIFFERENT EFFECT KIND.** Primal Fury
  is "a {0}% chance to gain an additional {1} Rage ... while in Bear Form. **In
  addition**, your non-periodic critical strikes from Cat Form abilities that
  generate Combo Points have a {2}% chance to add an additional Combo Point" —
  a row of THREE numbers, read at index 0 by a single `reaction` that granted
  rage. **The whole second clause was absent and the talent reported itself
  FULLY MODELLED**, so the census counted it in the `Fully` column and the Cat
  silently had no Seal Fate. Two instances now, which is why the full
  index audit is worth running rather than fixing these one at a time.
- **A SECOND CLAUSE IS OFTEN A SECOND EFFECT, NOT A BIGGER ONE.** Primal Fury is
  two `reaction` entries with different `reactionId`s, different `valueIndex`es
  and different `requires` — rage gated on `styles: ['bear']`, the combo point on
  `['cat']`. Trying to carry both in one reaction would have meant passing two
  values into a builder that takes one.
- **A KIND HAVING `valueIndex` IS NOT THE SAME AS AN EFFECT SETTING IT**, which
  is why that test asks whether the effect OBJECT carries the key. The first
  draft listed the kinds that could not name an index and missed Weaponmaster,
  Arcane Instability and Crusade -- three effects on multi-value rows whose kind
  does have the field and which do not use it. All three want index 0 and all
  three were right by inspection; none of them said so.
- **AND THE SAME SWEEP FOUND A TALENT WITH THE WRONG RULE RATHER THAN THE WRONG
  INDEX.** Thick Hide is "{0} additional base Armor per LEVEL and another {1}
  base Armor for each point of DEFENSE SKILL beyond five times your level",
  declared as `itemArmorPercent` -- a percentage of ITEM armor, which is exactly
  what Toughness says and neither of what this says. **When a fix motivates a
  sweep, run the sweep**: the index bug was one talent and the sweep found a
  second, unrelated one beside it.
- **An effect that reads no value is DROPPED, not reported.** `talentBuild` asks
  `talentNumber` and `continue`s when it is undefined, so a single-rank talent
  whose values file says `null` produces nothing and reads as unmodelled without
  having said so. **A talent whose effect does nothing is usually this**, not the
  effect table.
- **AND FOR A PROC IT IS WORSE THAN UNREPORTED, BECAUSE THE CENSUS READS THE
  TABLE.** Holy Shield is single-rank, so its values entry is `null`, so its
  `reaction` effect was discarded — while the talent granted its ability and
  `class_audit` called it FULLY MODELLED, because the census is derived from what
  the effect table declares rather than from what the build produced. The profile
  simply had one damage source fewer than its own audit claimed. **A `reaction` or
  `castReaction` whose magnitude lives on the ability or the aura must declare
  `valueless: true`**, which routes it past the lookup the way `grantAbility`
  already is. Declared rather than inferred: passing 0 to any builder whose value
  happened to be missing would hide a real data gap behind a working-looking proc.
- **A talent's own rank does not always open its own gate.** `{ careful_aim: 5 }`
  is legal and `{ careful_aim: 1 }` is not; `createPlayer` strips the illegal one
  SILENTLY, and a rank-scaling test read that as "worth nothing at rank 1". Pad a
  single-talent allocation with tier-0 filler, as `tests/helpers/legalise` does.
  **AND PAD IT AT RANKS THAT EXIST**: Subtlety has three, so five points in it is
  dropped, which takes the tree total under the next tier and drops the capstone
  with it — a test that reads "the talent grants nothing" for two reasons at once.
- **AN ISOLATION PROBE MUST REVERT EVERY FILE THE CHANGE TOUCHED.** Rend and
  Tear's widening is two edits -- the `tables` list in `druidEffects.ts` and the
  fold in `damage.ts` -- and a variant reverting one of them measures a state the
  code was never in. The Cat probe did exactly that twice over: once by reverting
  only the tables, and once by patching the wrong one of two identical call
  sites. **The cross-check that caught both was arithmetic**: the Bear's total was
  +16.4 and Rend and Tear is the only change that reaches it, so an isolated +9.5
  left +6.9 unexplained.
- **MARGINAL VALUES MEASURED AGAINST A FULL BUILD DO NOT SUM TO THE TOTAL, AND
  CAN EXCEED IT.** The Cat's four changes price at +61.0, +45.1, +43.7 and +6.3
  -- 156.1 against a measured +142.4 -- because each is "what removing this one
  costs with the other three present" and they overlap: Rake's bigger ticks and
  Rip's ticks both collect Rend and Tear, so removing either alone understates
  what they share. Say MARGINAL rather than presenting addends.
- **REMOVING A TALENT TO PRICE IT CAN STRIP A DEEPER ONE, SILENTLY, AND THAT IS
  THE SAME RULE POINTING THE OTHER WAY.** Taking three points out of Feral Combat
  put Rend and Tear under its tier gate and Berserk after it, so "Predatory
  Strikes is worth +62.9" was really three talents. **An isolation probe has to
  print `legalAllocation(...).dropped` beside every figure** —
  `tools/druid_attribution.ts` does, and its first run did not. A figure without
  its cascade named is a rumour.

See [docs/talent-effects.md](docs/talent-effects.md) for how an effect is
expressed.

## Three causes of inert, and they expire differently

Say which. Only the first is an engine gap.

| | |
| --- | --- |
| **the engine** | no declaration exists. Expires when one is built, and has six times — so write the reason specifically enough to re-read |
| **the target** | a raid boss is never frozen, never killed, is not Undead. Expires only if the encounter changes -- **but "never below 20% health" is NOT one of these**, see below |
| **the build** | the profile did not take it, or took a talent switching it off. Lone Wolf and Demonic Sacrifice both mean "no pet", so nineteen talents are correctly dead |

Plus the permanent rulings under **Scope**.

- **A FOURTH CAUSE HIDES INSIDE THE FIRST: THE LIST.** "No priority list casts
  Berserker Rage" is an argument about a ROTATION and it sat in the engine column
  for the Warrior's whole life, as the class's last live gap. The number it was
  supposedly waiting on -- 5 and 10 rage by rank -- was in `values/warrior.json`
  the entire time. **A reason that names a list, a build or a profile is not an
  engine gap**, and it reads exactly like one because the talent is equally
  silent either way. Build the mechanism, test the MECHANISM, and let the list
  cause be a list cause.

- **A LOW-HEALTH REQUIREMENT IS A CLOCK, NOT A TARGET PROPERTY, and writing it
  off as one was a documented mistake THREE TIMES.** `inExecutePhase` in
  `combat/executePhase.ts` reads remaining combat TIME against a fraction of the
  planned duration -- the owner's ruling, made for Execute, and it lives outside
  `abilities/warrior.ts` so a second class is a CALLER rather than a borrower.
  **Before writing "the target never drops", check whether the threshold is one
  this ruling already answers.**
- **AND THE FRACTION IS A NUMBER, NOT THE RULE.** `inExecutePhase` takes one and
  defaults to `EXECUTE_PHASE_FRACTION`; Execute and Hammer of Wrath are 20% and
  the Rogue's Quietus is 35% by the owner's word. **Two TALENTS take their
  fraction from their own DATA instead** -- Early Demise states `[[20, 15],
  [20, 30]]` and Quietus `[[2, 35], ...]`, threshold and bonus in one row, so a
  Forever change to either moves the talent with nobody editing TypeScript.
  Early Demise's 20 and `EXECUTE_PHASE_FRACTION` agree today and are DIFFERENT
  FACTS, and a test pins that they still do.
- **A per-ability modifier can be conditional on that clock** --
  `AbilityModifiers.addWhileFinalFraction`, the third condition shape after the
  weapon in hand and an aura, and the first one **a combatant cannot answer by
  itself**: it holds no clock, so `abilityModifierFor` is HANDED the remaining
  fraction by `dealDamage`. **It THROWS when a caller offers none and the
  character carries one**, which is the whole design -- treating a missing clock
  as "not in the window" gives a talent that is declared, reports itself
  modelled and contributes nothing.

- **AND A STALE ENTRY IN A "NOT HERE, AND EACH FOR A STATED REASON" LIST IS THE
  SAME MISTAKE WEARING A HEADER.** `abilities/paladin.ts` listed Hammer of Wrath
  among the spells it does not declare, reason "the target never drops below full"
  — forty lines above the declaration of Hammer of Wrath. Nothing contradicted it
  and nothing could: a list of what is absent is not checked by anything that
  compiles. **When an ability joins a file, read that file's own list of what it
  does not have.**

- **AND A REASON CAN NAME THE WRONG CAUSE WHILE THE TALENT IS CORRECTLY
  INERT**, which reads as work outstanding forever. Improved Blizzard said
  "Blizzard is an area spell and is not in the book", so it looked like a
  declaration away from working. It is not: its only effect is a movement-speed
  Chill, a Chill is a snare, and Permafrost is the same clause on the same tree
  already scoped `crowdControl`. **Ask what the talent would do if the thing its
  reason blames were fixed** -- if the answer is "still nothing", the reason is
  the wrong one and the entry is probably a ruling.
- **A REASON THAT DESCRIBES A WORKING HALF IS A CLAIM ABOUT THE CODE, AND IT CAN
  SIMPLY BE FALSE.** Rapid Killing's read "Its Rapid Fire cooldown reduction is
  real and its damage bonus needs a KILL" — and the talent's effect list held
  nothing but that one `unmodelled` entry, so the cooldown reduction was never
  applied to anything. Invisible because 5 minutes and 3 minutes are both longer
  than a fight, so no profile could have shown it. **When a partly-modelled
  reason names the half that works, check that half exists**; the census counts
  such a talent as a gap either way, which is what hides it.
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
- **TWO CORRECT HALVES WITH NOTHING JOINING THEM IS A SHAPE NO HALF'S TEST CAN
  CATCH.** `armorPenetration` shipped declared, granted by three talents,
  counted as fully modelled and READ BY NOTHING -- `resolveDamage` took the
  target's raw armor. Its test file passed throughout, because it asserted the
  ARITHMETIC (`armorReduction` on an already-reduced figure) and the
  REGISTRATION (`talentBuild` putting the number on the stat) and never the join
  between them. **A stat is not modelled until something READS it**, and the
  assertion that proves it is one that resolves real damage twice and compares:
  that one fails by 22.2 damage with the wiring removed while both halves stay
  green. **Check the reader, not just the writer** -- `git grep` for the stat
  name outside the file that declares it.
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

Six sources. **All nine classes were built from the two client-derived ones.**
[docs/class-implementation.md](docs/class-implementation.md) is the process.

| Source | Answers |
| --- | --- |
| `C:\Users\Donz\Documents\WoWForever*` | the owner's own files, **highest authority**: base stats, the combat table, stat conversions, resources, and **one ability spreadsheet — the Warrior's**. There is no spreadsheet for the other eight classes. `WoWForeverSimGuidance.docx` is NOT data — it is screenshots of an architecture discussion |
| `WoWSimWorksheet.xlsx` | the owner's **authoritative document for COEFFICIENTS**, all nine classes, supplied 2026-09-29 and transcribed in `src/game/combat/coefficients.ts`. It SUPERSEDES the Warrior ability sheet on Rend, Revenge and Thunder Clap, and the earlier seal formula on Seal of Righteousness -- where it and an older owner document disagree, the sheet wins and the disagreement is recorded at the call site |
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

**AND IT HAD FOUR SOURCES WITHOUT HAVING A SPELLBOOK CAPTURE, WHICH TURNED OUT
TO MATTER.** It was the one class of the nine with no
`forever-<class>-spellbook.json`, so it was also the only one whose data carried
no BUILD NUMBER and could not be diffed by machine. Taking it in 2026-09-30 was
one command and moved three more figures. **THE TWO CAPTURES ANSWER DIFFERENT
QUESTIONS and a class wants both**: the Wowhead tooltips carry the EFFECT ROWS —
which is where Revenge's 153 and Bloodthirst's 48 came from when the description
rendered `(100% of Spell Power)` — and the spellbook carries the BUILD and the
REQUIREMENT LINES, which the tooltips do not have at all.

**A REQUIREMENT LINE IS DATA, AND READING ONLY THE DAMAGE MISSES IT.** Spearing
Strike requires a two-handed weapon; the DW Fury profile had been casting it
while dual-wielding two swords for the whole project, and a test asserted that it
did. Nothing about the figure looked wrong, because the damage was right — it was
the wrong CHARACTER casting it. Check cost, cast, cooldown AND requirement when
two sources are put side by side.

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
- **THE RANK-1 RULE IS ABOUT THE WEBSITE, NOT ABOUT THE CAPTURE.**
  `import_forever_spells.mjs` writes MAX RANK by construction and each entry
  states its `rank`, so "the spellbook opens on rank 1" is a fact about the page
  and says nothing about the JSON. Sniper Shot was transcribed at 160 with a
  comment applying the rule to a capture whose own entry reads `rank: 3` and
  295 — the rule is real and it was applied to the wrong artifact. **Read the
  capture's `rank` field rather than reasoning about what the page shows.**
- **A CAPTURE GOES STALE, AND A CORRECT NUMBER BECOMES A WRONG ONE WITHOUT
  ANYONE TOUCHING IT.** Between builds 1.60.1.69876 and 1.60.1.70009 Forever
  buffed Wrath 62–68 to 92–102, took Holy Strike from 40% weapon damage on a
  12-second cooldown to 50% on a 10-second one, doubled Life Tap, and renamed
  Mangle to Primal Bite. Every one of those was transcribed correctly and went
  wrong on its own. **Refresh the captures before trusting a figure, and do it
  for all nine classes at once** — `--write` per class, then read the diff, which
  is where the change announces itself.
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

**IT HAS NOW CAUGHT THE SAME CLASS TWICE, AND THE SECOND TIME THE COMMENT SAID
THE NUMBER CAME FROM NOWHERE.** Sniper Shot read 160 against a capture saying
295. Summon Hawk read 32 against a capture saying 108 — and the comment on the
constant asserted "32 IS NOT IN EITHER SOURCE", which was false: it is the
TALENT tooltip's figure, sitting in `values/hunter.json` the whole time. The
capture says `rank: 4`, `foreverchanges.pro` says 110, and the two "disagreeing"
sources were one number at two ranks. **A figure you cannot place is more likely
rank 1 of a granted ability than an invention**, so look there before writing
that it came from nowhere — the hawk was recorded as an open question to the
owner for as long as that comment stood. It was worth +144.4 DPS.

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

**AND IT CUTS THE OTHER WAY TOO: A SOURCE THAT OMITS A CLAUSE HAS NOT DENIED
IT.** Wowhead's Forever tooltip for Spearing Strike carries no requirement line;
the spellbook capture and `foreverchanges.pro` both state a two-handed weapon.
That is two sources speaking and one saying nothing, so the tie-break never comes
up and the clause is simply true. **The silence was read as "no requirement" for
the whole project**, which is the same mistake as Shadowburn's in the opposite
direction — one deletes a real cost, the other grants a real ability to a
character that cannot use it.

**A REFRESH AND A CROSS-CHECK FIND DIFFERENT THINGS AND NEITHER SUBSTITUTES FOR
THE OTHER.** Slam's cooldown went 15 to 18 in ELEVEN DAYS, on the class with the
best sources in the project and against a figure the ruleset owner had confirmed
personally. `--verify` re-fetched the SAME spell id from the SAME endpoint the 15
came from and got 18, so it was not a source disagreement and no tie-break
applies: the game changed. **Run the refresh first**, because a cross-check
between two stale reads agrees perfectly.

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

**When an effect cannot be modelled, keep its own words and RECORD them.** Items
carry an `unmodelled` list with the source's exact text and one line on why it
does nothing. An effect matching no rule is never guessed at — which is what
kept Crusader granting nothing until its proc rate arrived, rather than quietly
inheriting a plausible one. An inert effect that SAYS it is inert is the honest
failure mode.

**IT IS NO LONGER SURFACED IN THE APP, AND THAT IS THE OWNER'S DECISION.** The
Gear panel printed every entry under "Equipped but not simulated", the Talent
panel printed two lists, and the Raid buffs and Results panels printed their
own; the GUI pass removed all four. The data is untouched and `class_audit.ts`
still derives the whole census from it — what went is one READER. Keep filling
the `unmodelled` lists exactly as before.

**Resistance on an enemy target has no effect on damage**, by the owner's ruling.
So a spell lands for full against a raid boss, and `resistancesFromItems` being
computed and never read is CORRECT rather than a gap.

**Borrowing a Classic value is allowed, and only when it stays visible.** Where
Forever has not supplied a number, prefer a Classic one over leaving a system
unreachable — on two conditions, both of which must hold.

1. It keeps a `PLACEHOLDER_` name, so nothing can read it without seeing that.
2. A comment says it is Classic and unverified, and what would confirm it, and
   `docs/` records it where the system it belongs to is written up.

A silently borrowed number produces a confident figure nobody can audit, which
is the failure mode this rule exists to prevent — one was written, exported and
referenced by nothing for as long as pets existed, while its own comment claimed
it was printed in the app.

**THERE WAS A THIRD CONDITION AND THE OWNER REMOVED IT.** It read "where a
person can see the result, the app says so", and the Encounter panel's caveat
beside the "target attacks back" switch was its worked example. The GUI pass
took every such caveat off the interface — the talent gap list, the gear and
raid-buff caveats, and finally that one — on the instruction that this
reporting is for the repository and not for someone running a sim. **So the
audience for a placeholder is a READER OF THIS CODE, not a user of the app.**
Condition 1 and the audit tools are what carry it now:
`tools/class_audit.ts` derives the census from the `unmodelled` entries and
throws if its four buckets do not account for every talent.

Nothing about conditions 1 and 2 relaxed, and the rule they serve did not
change: **never invent a number, and never let a borrowed one look sourced.**

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
**Keep saying so.**

**AND THE FIRST OF THOSE FURTHER CHANGES HAS ARRIVED, AS AN OVERRIDE RATHER THAN
AN EDIT.** `FOREVER_SPELL_POWER_BUFFS` in `itemData.ts` carries the owner's +64
spell power on four caster weapons -- Staff of Dominance, Sorcerous Dagger,
Azuresong Mageblade and Anathema. The JSON is generated and `--verify`-checked,
so a Forever value is layered OVER the scrape at build time and never written
into it; `ENCHANT_RULES` beside it is the same shape for the same reason. The
Immovable Object and those four are the real Forever item data.

**A DELTA, NOT A TOTAL**, because the owner gave it as one and because two of
their four stated bases disagreed with the scrape. A bonus survives a re-scrape
meaning the same thing; a total silently reinstates whatever Classic says.

**AND AN OVERRIDE KEYED BY ID IS SILENT WHEN THE ID IS WRONG.** Two of these
were first written with the CLASSIC item ids where the sets are Season of
Discovery -- 17103 and 18608 against 228269 and 228336. It typechecked, the
suite passed, and the buff reached nothing for half the items it named.
`items.test.ts` now asserts every id in the map resolves to an item of that
name.

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
- **A SEEDED TEST THAT "FAILS UNDER THE FULL SUITE AND PASSES IN ISOLATION ON THE
  SAME COMMIT" IS THE SHARED CHECKOUT, NOT NON-DETERMINISM.** That sentence is
  what you get when the difference was never IN the commit — another session's
  uncommitted work, or your own. Chasing it as non-determinism cost an afternoon:
  the ratio in question was bit-identical across processes, six full-suite runs
  passed, and the code at the recorded commit was byte-identical to the code that
  passed. **Check the tree before the engine.**
- **A SYNCHRONOUS TEST CANNOT TIME OUT.** The body blocks the event loop, so
  vitest's timer never fires — `bloodCraze.test.ts` has a test that takes 5491ms
  and passes against a 5000ms default. So a slow test is not a flaky one, and a
  CPU-contention slowdown (1487ms alone against 4721ms under the suite) is not a
  near-miss against anything. Rule the timeout out by finding a longer test that
  passes, not by arithmetic.
- **A DPS-RATIO TEST IS TESTING THE ROTATION, whatever its name says.** Bastion's
  exact 1.1 is asserted next door on `baseDamageMultiplier` to ten decimal
  places; the ratio test beside it measures the tank's RAGE LOOP, which is why it
  moves with the Prot priority list and has read anywhere from 1.089 to 1.16 on
  code that never touched the talent. Two tests, two subjects, one name.

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

**THREE AUDITS EXIST AND EACH IS BLIND TO WHAT THE OTHERS SEE.** Reach for the
right one rather than the familiar one.

| | Answers | Blind to |
| --- | --- | --- |
| `coefficient_probe.ts` | does the damage respond to a stat, casting each ability in ISOLATION | whether any profile ever casts it |
| `measure_profiles.ts USES=1` | what each LIST ENTRY did, plus damage sources not in the list | an ability that is in neither |
| `ability_audit.ts` | every ability in the BUILT character's book, and whether the damage shares sum to 100% | whether a number is RIGHT |

**AN ABILITY IN THE BOOK, IN NO LIST, DEALING NO DAMAGE WAS INVISIBLE TO
EVERYTHING** until the third one existed — declared, learnable, castable, never
cast, reported nowhere. And **the share total is the completeness check**: a
damage source nobody reports reads as a ZERO rather than as a gap, which is
exactly how `resourceFlow` summed every pool under a heading saying "Rage" and
produced a tidy 100%.

**AN AUDIT FINDS A NEVER-FIRED ENTRY AND SAYS NOTHING ABOUT WHY. MEASURE THE
CAUSE.** Hammer of Wrath is the worked example: the plausible explanation — "needs
the target below 20% health" — was written into the docs and was wrong, with the
code disproving it one file away. Sampling `checkCast` through the window gave 22
refusals for `not_enough_resource` against 3 for `on_gcd`, because the Retribution
Paladin spends 3425 of the 3449 mana it gains. **And the cross-check that
separates "cannot afford it" from "broken" is another build firing the same
ability** — the Shockadin casts it 0.3 times a fight on more mana.

**When a fix moves nothing in the suite, that is a statement about the suite.**

**AN INERT BUFF WITH VISIBLE UPTIME IS THE HARDEST KIND TO FIND, BECAUSE THE
RESULTS PAGE SHOWS IT WORKING.** Adrenaline Rush was cast, spent its cooldown,
applied its aura and reported **24.9% uptime** for the whole project while
delivering no energy whatsoever — and it was worth **+53.0** to the Combat Rogue,
the largest single figure that class has produced. There was no missing row, no
zero and no caveat anywhere a reader would be looking. **The buff-uptime table
says the aura was PRESENT and nothing about what it did**, so an aura applied for
visibility — which this project does deliberately, so a talent can find it — reads
identically to one that works. Check what the buff is supposed to MOVE: the energy
a fight did not change when the cooldown fired, and that is the whole detection.

**AND ITS REASON NAMED A HOOK THAT EXISTED.** "Needs a rate multiplier on
ResourceRegen" — `ResourceRegen.amountPerTick` has been `(actor, context) =>
number` since it was written and `createPet` already multiplied a pet's focus
through that exact signature. So this is not an expired reason, it is one that was
FALSE ON THE DAY, and the difference matters: an expired reason is found by
re-reading reasons after a change, and a false one is only found by checking the
claim against the code. **When a reason says the engine needs a capability, grep
for it before believing it** — twice now the capability was there with one caller.

**A TEST CAN BE WHAT KEEPS A STALE CAVEAT ALIVE.** `rogueAbilities.test.ts` had a
test called "says on the results page what it cannot do" asserting Adrenaline Rush
appeared under "cast but not simulated", its comment repeating the false claim
verbatim. **A test named for what the page SAYS enforces that the page keep saying
it**, and fixing the ability is what finally failed it. A caveat's entry on that
list is an assertion about a LIMITATION, so it has to be deleted with the
limitation.

**A REPORT CAN BE INTERNALLY CONSISTENT AND STILL BE ABOUT THE WRONG THING.**
`resourceFlow` took a `resource` argument and discarded it with `void resource`,
so every pool a character owned was summed under a heading that said "Rage" — a
Rogue's energy and combo points added together, shares totalling a tidy 100%,
nothing on the page contradicting it. **Two tests depended on it**: one looked
for Relentless Strikes (which restores ENERGY) in `batch.rage`, and one asserted
a MOONKIN spent more "rage" than its mana pool. Check that a number is about
what its label says before trusting that it adds up.

**AND A NUMBER THAT IS NEVER EMITTED READS AS A ZERO, NOT AS A GAP.** Combo
points reported 23 gained and none spent, because a finisher drained the pool
with `Resource.drain` rather than through the context — which looks exactly like
a rotation that never casts one. Energy showed more spent than gained, because
the 100 a Rogue opens with was never an event and the "unspent" figure clamped
the negative away. **If the books do not balance, the missing side is usually
something real that nothing reports.**

## Git workflow

`main` is **protected**: PR required, CI must pass (Node 20 and 22), no direct
pushes, and that applies to admins. Work on a branch, open a PR, merge with
`--squash --delete-branch`.

**Other Claude sessions edit this same checkout concurrently.** Measure and test
in a throwaway `git worktree` at a named commit, never in the shared working
tree: a measurement there once came back a clean −2.0% on two profiles, which
read exactly like a real regression and was another session's uncommitted work.
Never commit files you find modified there.

**AND A DERIVED COUNT IS ONLY AS GOOD AS THE COMMAND BESIDE IT.** The placeholder
figure in HANDOVER carried its own re-derivation command and was still wrong three
times, because the command counted MENTIONS: a deleted placeholder leaves its name
behind in the comment explaining what it used to be, so five epitaphs were being
counted as live invented numbers. **Count DECLARATIONS** --
`grep -rhoE "(export )?const PLACEHOLDER_[A-Z_]+" src/`. The instruction to
re-derive rather than adjust was right every time; the thing it told you to run
was not.

**A CLEAN MERGE CAN BE ARITHMETICALLY WRONG, and a count is where it happens.**
Two branches each moved the talent census total by one from the same base, so
both wrote the same number, git merged them without a conflict and the total was
short by one. **Re-sum a total from its rows rather than adjusting it**, and the
same for any prose figure derived from it — "X of 468 talents do something" went
wrong the same way. `tools/class_audit.ts` now derives the whole census
independently and throws if its four buckets do not account for every talent.

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
