# SimForever — working notes for Claude

An event-driven combat simulator for **World of Warcraft: Forever**, a custom
ruleset heavily based on Classic. TypeScript + React + Vite + Vitest.

This file holds things that stay true between sessions. For what is currently
in progress, read [HANDOVER.md](HANDOVER.md).

## Commands

```bash
npm run dev          # dev server (port 5173)
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build
```

Always run `npm run typecheck` **and** `npm test` before opening a PR. The
typechecker catches things the tests do not — it has caught a mutation of a
shared readonly array and a stat rename that silently invalidated a test.

## The one architectural rule

> **The simulation engine is completely independent of the UI.**

`src/engine` imports no React, touches no DOM, holds no module-level mutable
state. Everything a running simulation needs arrives through a
`SimulationContext`.

Dependencies point one way. If you want an arrow pointing back up, something is
in the wrong layer.

```
ui  ──▶  simulator  ──▶  engine
                   ├──▶  analysis  ──▶  (engine types only)
                   ├──▶  game      ──▶  engine
                   └──▶  profiles  ──▶  engine, game/character, game/talents
```

- **`engine`** — the rules. How combat works. Knows nothing about warriors or fireballs.
- **`game`** — the content. Races, classes, abilities, talents, items, the Forever numbers.
- **`data`** — bulk content from external sources, as JSON. A script writes it; nothing hand-edits it.
- **`analysis`** — turns telemetry into statistics. Never touches a live simulation.
- **`simulator`** — the only place engine + game + analysis are wired together. The UI imports from here.
- **`profiles`** — versioned JSON character configuration.

**Rules go in `engine`, numbers go in `game`.** When the engine needs a ruleset
number, it takes it as an injected function or value — see
`SimulationConfig.attackChances` and `StatBlock`'s derivation parameter.

## Conventions that prevent real bugs

Each of these exists because the alternative produced, or would produce, wrong
numbers that look plausible.

**Time is integer milliseconds** everywhere below the UI. Seconds appear only in
profiles and formatted output. `seconds()` and `toSeconds()` are the only
conversions.

**Combat rolls are integers 1–10000**, and percentages are **truncated** into
that space (`toRollUnits`). 25.7891% becomes 2578, never 2579. Floats would make
an outcome depend on summation order.

**Telemetry is the single source of truth.** The engine keeps no running totals.
The combat log is a pure formatter over the same stream the analyzers read, so
they cannot disagree. Adding a statistic means adding an analyzer, never
threading a counter through combat code.

**Stats are base + modifiers, never mutated in place.** Derived stats
(attack power, crit, armor) are produced by a *function* on the stat block, so
they re-derive when a buff moves a primary stat. Computing them once at creation
would leave attack power stuck at its unbuffed value.

**`attempts` and `hits` are different numbers.** Avoided attacks emit a damage
event with `amount: 0`. Averaging over attempts folds every miss in as a zero.

**Events at the same timestamp** sort by `(timestamp, priority, insertion
order)`. `Periodic` sorts before `AuraExpiration` so a DoT's final tick, due at
the moment it falls off, still lands.

**At most one pending swing per weapon slot.** `scheduleSwing` cancels whatever
that slot was waiting on before scheduling. Without it an extra attack forks the
chain: it fires from inside a swing, which has not yet scheduled its successor,
so the extra attack schedules one and the original schedules another — two
independent timers on one weapon, doubling again with every proc. Four Hand of
Justice procs turned 115 main-hand swings into 211, which reads as a very good
trinket rather than as a bug.

**A dual-wielder has two combat tables, not one shown twice.** Miss and enemy
dodge both derive from the WIELDING WEAPON's skill, so a sword in one hand and a
mace in the other diverge the moment anything grants skill with one and not the
other. Anything reporting them must ask per slot. The dual-wield penalty lands on
both hands, so it is skill and not the penalty that separates them.

**Which combat table resolves an attack depends on who is being HIT**, not on
who is swinging. `melee-received` is the attacks-received table: the one with
crushing blows and with the DEFENDER's dodge, parry and block. Auto-attacks once
hardcoded `melee-auto`, which would have resolved a boss swing on the player's
own table.

**A block LANDS, and is reduced by a flat amount.** It is deliberately not in
`AVOIDED_OUTCOMES`, and its reduction happens in the damage pipeline rather than
as a table multiplier. That flatness is the whole character of the stat: 30
block value takes half of a 60-damage hit and a tenth of a 300 one.

**Every damage-over-time effect can crit, and none of them are reduced by
armor.** This is a Forever rule, given by the ruleset owner as a correction to
the original combat table guidance, and it is not WoW Classic's behaviour. A
tick does not re-roll the combat table — whether the effect landed was settled
when it was applied — but it *does* roll for a crit, at the crit chance of **the
kind of event that applied it**: Rend and Deep Wounds are applied by melee
attacks, so they crit at melee crit chance. `DamageRequest.critFrom` names that
table. A DoT with no `critFrom` cannot crit and consumes no random number, so
adding the field never shifts a seeded run that does not use it. Bleeds are
physical and still ignore armor: set `appliesArmor: false` on every one.

**The global cooldown is 1.5 seconds, 1.0 for a Rogue and a Cat-Form Druid,
and it belongs to the CLASS rather than to the ability.** It arrives on the
combatant as `baseGcdMs`, because the same ability costs a Rogue one second
and a Warrior one and a half. Being off it means ONE thing: the ability does not
START a global cooldown. It is still BLOCKED by one already running, and what
being off it buys is that the action AFTER it is free. Haste does not affect
the global cooldown at all, only cast time. On-next-swing abilities are off it
by DERIVATION,
`triggersGcd ?? onNextSwing === undefined`, so a new one gets the rule without
anyone remembering it; the failure mode of declaring it per ability is silent,
because an ability that wrongly takes a global cooldown still costs the right
rage and deals the right damage. Full rules, exceptions and provenance in
[docs/global-cooldown.md](docs/global-cooldown.md).

**An encounter that hits back RAMPS, and the character can die.** Turning on
`targetAttacks` brings three mechanisms at once, none of them Forever ruleset
data: the target's damage grows 10% a swing compounding, an assumed healer
restores a random 500-1500 a second, and the character dies at zero health and
is stood back up at full. Survival is modelled as a COUNT OF DEATHS rather than
as an immunity, which is the whole difference: the character used to carry
`survivesLethalDamage` and could not die, so "how close was that" had no answer
at all. A revive does not mark the character dead even for an instant --
marking them would cancel their own swing timers and skip the reactions the
killing blow was meant to trigger -- and it does not reset the target's ramp,
because a ramp that reset would hand a character an easier fight for dying.
Full rules and provenance in [docs/incoming-damage.md](docs/incoming-damage.md).

**A BUILD IS FIVE SETTINGS THAT HAVE TO AGREE, and `profiles/presets.ts` is
where that is written down.** A Protection warrior is a shield AND Defensive
Stance AND a target that swings back AND a particular tree AND particular gear;
choosing three of the five produces a character nobody meant, and half the
Protection tree silently does nothing. Almost every instruction about this
simulator has been phrased as "if 1H and shield is selected", "if Battle Stance
is chosen", "if the target attacks back is checked" -- a preset is that whole
answer, named, and `isTankBuild` is the same idea inferred from two fields. A
preset sets EVERY field rather than inheriting any, or it would behave
differently depending on what was on screen when it was pressed.

**Raid buffs are SELECTED, never assumed, and a pool has to be sized from
them.** The catalogue is `game/buffs/raidBuffs.ts`, the profile stores chosen
ids, and nothing is on by default -- a buff that applied itself would move every
figure ever recorded, which is exactly what `BATTLE_FURY` did. Health and mana
are resource maximums computed ONCE from a stats snapshot, so a stamina buff
applied as an aura grants no health at all: the encounter passes `poolStats`, a
transform from the character's own stats to their buffed ones, and the pools are
sized from that. A proc's reaction is built PER CHARACTER, because an internal
cooldown is per-character state and one shared closure silently stopped Windfury
proccing after the first iteration of a batch. Full rules in
[docs/raid-buffs.md](docs/raid-buffs.md).

**A revive keeps auras, except the ones spent to prevent it.** An aura declares
`removedOnDeath`, and Last Stand and Shield Wall are the two that do: a
survival cooldown that visibly failed does not carry through the death it
failed to stop, and Last Stand would otherwise drag its borrowed maximum health
into a pool that was just refilled. Everything ELSE stays up, which is the
point of `revivesOnDeath` — dropping the lot would switch off the assumed
healer at the moment it is needed most. Which effects survive dying is a
property of the effect, so the flag is on the aura and not on the character.

**RAGE IS A FLAT RATE PER SWING, NOT A SHARE OF THE DAMAGE.** Forever's rule is
`rage = R x S`, R being 3.46 for a one-hander or a bear's paws and 4.5 for a
two-hander, S the weapon's BASE speed before any modifier. `R x S` every `S`
seconds is `R` per second, so the speed cancels: a two-hander earns 4.5 a
second and a dual-wielder 6.92, and haste raises neither. EXTRA ATTACKS BREAK
THAT CANCELLATION -- a Windfury or Hand of Justice proc pays a full `R x S` for
a swing that cost no time, so a slow two-hander earns 16.2 a proc against a
dual-wielder's 9.0, and the 2H Arms preset runs at 6.2 rage a second against a
4.5 floor. **Rage income no
longer scales with gear, buffs or damage**, which moved every measured figure
in this project in both directions at once -- unbuffed builds gained, the
raid-buffed presets lost. A miss still earns nothing, because it is rage from
damage DEALT, and that is `ResourceGeneration.requiresDamage` rather than a
consequence of the arithmetic. Taking damage is `D x 10 / H` off the PRE-ARMOR
figure MINUS THE BLOCK: Defensive Stance reduces the rage earned, armor does
not, and a block does -- "blocked hits give the rage of the unblocked amount".
Armor and a block are one pipeline step, so `DamageResolution` carries
`blocked` separately to tell them apart. The old
damage-proportional formulas are commented out rather than deleted, on the
owner's instruction. Full rules in [docs/resources.md](docs/resources.md).

**A ROTATION WILL CHANGE STANCE TO REACH AN ABILITY, and that is not always
wanted.** `PriorityRotation` treats a wrong stance as "not yet, and here is
how" -- which is why Revenge, Whirlwind and Recklessness are reachable at all.
An entry that must NOT provoke a swap says so in its `condition`, which is
checked BEFORE the swap is considered: Charge lists Battle Stance, and adding
it to the Protection list sent the tank out of Defensive at the pull until its
condition required a stance the ability already allows. That same condition is
how Vanguard gates it, without naming the talent -- the talent adds Defensive
Stance to the character's copy of Charge, and the rule reads the ability rather
than the build.

**Charge is used ONCE, as the first action.** "Cannot be used in combat", and
every fight here opens in combat, so the only legal moment is timestamp zero.
The rule is on the ability, not on each list that includes it.

**A REACTION FIRES ON DAMAGE; A CAST REACTION FIRES ON A CAST, and the second
exists because four Rogue talents needed it.** Relentless Strikes, Ruthlessness
and Improved Expose Armor all pay out when a FINISHER IS USED, and a finisher
spends its combo points inside its own `onCast` -- so neither the cost system
nor a damage reaction can see what happened. `AbilityCastEvent` carries what
the cast SPENT, MEASURED BY SNAPSHOTTING every pool around it, which covers the
declared cost and anything the ability drained itself. Measuring rather than
asking each ability to declare is the point: the ability that forgot would be
silently inert. Seal Fate needed no new hook, only a new FACT --
`Ability.comboPointsAwarded`, because a reaction sees an ability id and nothing
about what the ability does.

**RESISTANCE ON AN ENEMY TARGET HAS NO EFFECT ON DAMAGE**, by the ruleset
owner's ruling. So a spell lands for full against a raid boss, and
`resistancesFromItems` being computed and never read is CORRECT rather than a
gap. The engine gap survey had it the other way round and was wrong to.

**THE WRONG ROTATION IS WORSE THAN NO ROTATION, because nothing about it
looks wrong.** The Mage's list is chosen by points spent -- three `caster`
builds with no stance, no form, and a 0/29/22 Frostfire build with no capstone
for the Rogue's test to find -- and the first version compared two trees and
never looked at Fire. The owner's 10/39/2 FIRE build came back as ARCANE, ran
a list built around a spell it had one point in, and produced a perfectly
ordinary 143.9 DPS without casting Fireball once. Nothing errored and nothing
was missing.

**TWO CLASSES IN A ROW BRING NO PET, AND BOTH SAY SO IN A TALENT.** Lone Wolf
is "+20% damage while you do not have an active pet" and Demonic Sacrifice
kills the demon for a two-hour buff -- so four of the five profiles that the
gap survey listed as blocked on pets turned out not to want one. The pet work
the Beast Mastery hunter needed is not wasted; it is simply not what the other
four do, and that is a property of the BUILDS rather than of the engine.

**A PERCENTAGE MANA REDUCTION IS `CastModifier.costFraction`, AND A TALENT
GRANTS ONE WITH `grantCastModifier`.** "Reduces the mana cost by 50%" is a
FRACTION OF THE COST, which is what that field always was; `abilityCost`
subtracts a flat amount, which is right for a 20-rage Mortal Strike and wrong
for a 380-mana Immolate. That mismatch was the single most common `unmodelled`
reason in the project -- eleven talents across SEVEN classes saying it in
almost identical words -- and it was a missing DECLARATION rather than a
missing rule: the modifier, its resolution and its consumption all already
existed.

**TWO OF THEM ON THE SAME ABILITY STACK ADDITIVELY.** Improved Wrath's 50% and
Moonglow's 25% make 75%, not the 62.5% two multiplicative reductions would
give, because `resolveCast` subtracts each from the BASE rather than from the
running total. Both readings produce a plausible number, which is why there is
a test on it.

**IT ONLY MOVES A MANA-BOUND PROFILE, and that is the point.** A cost
reduction is worth nothing to a build that never runs dry: the Moonkin gained
48% and the Elemental shaman 32%, while Retribution -- which genuinely has
Benediction applying -- did not move at all. A talent working and a talent
mattering are different questions.

**AN `unmodelled` REASON MATCHED BY WORDING IS A TEST.**
`grantCastModifier.test.ts` fails if any talent still claims a percentage cost
cannot be expressed, matching the SENTENCE rather than a list of ids -- so a
new class writing the same complaint is caught. It found one on the way in:
the Shaman's Tidal Focus, which is inert for want of a healing profile and had
been given the percentage-cost reason by mistake.

**A STAT CAN BE WORTH A PERCENTAGE OF ANOTHER STAT, and that is
`statFromStat` FOLDED INTO THE DERIVATION rather than a number computed once.**
Six talents across five classes said this could not be expressed -- Careful
Aim, Mental Dexterity, Mental Quickness, Arcane Resilience, Champion of the
Light and Spiritual Guidance -- and like `grantCastModifier` it was a missing
DECLARATION and not a missing rule. `StatBlock` already resolves in two passes
so a derived stat sees FULLY BUFFED primaries, and it already takes the
derivation as an injected function because which primary makes which secondary
is game content; a conversion is one more term in that function. So Careful
Aim follows a buffed intellect exactly as attack power already follows a
buffed strength, and resolving it once at build time would freeze it at the
unbuffed figure while still reading as a perfectly plausible attack power. It
converts FROM a primary only, because the derivation is handed resolved
primaries and all six talents read one.

**IT MOVED FOUR PROFILES AND WAS WORTH EXACTLY ZERO TO TWO**, which is the
Eclipse lesson again. Arcane Resilience is ARMOR on a Mage nothing attacks.
Champion of the Light is spell power on a Seal Twist Ret whose seals are
Command and Crusader -- and **Seal of Command is 70% of WEAPON damage with no
spell power term**, so the one profile the gap survey named as "the first
where it bites" is the one it does not bite at all. Shockadin, which casts
Seal of Righteousness, gained 2.2%. The mechanism was right and the build was
wrong, which is why the test asserts THE STAT ARRIVING and not a DPS delta.

**A TALENT'S OWN RANK DOES NOT ALWAYS OPEN ITS OWN GATE.** Careful Aim is tier
5, so `{ careful_aim: 5 }` alone is legal and `{ careful_aim: 1 }` is not --
`createPlayer` strips the illegal one SILENTLY, and a rank-scaling test read
that as "worth nothing at rank 1" rather than as "not allocated". Pad a
single-talent allocation with tier-0 filler, the way `tests/helpers/legalise`
does for the Warrior.

**A TALENT REACHES THE OWNER; A PET NEEDS `petStat` AND `petReaction`.** Six
Hunter talents were inert for one reason -- a talent effect lands on the
character carrying it, and a pet is a separate combatant built afterwards --
and they are most of what Beast Mastery spends its points on. Collected into
`TalentBuild.pet` and handed to `createPet`, which applies what it is given
and does no arithmetic on a rank. The HAWK halves of Unleashed Fury and
Ferocity needed nothing new: a periodic tick carries its aura's id, so
`abilityDamage` and `abilityCrit` on `summon_hawk` reach it, the same route
Improved Rend takes.

**EVERY `unmodelled` REASON ON THOSE SIX NAMED THE SAME CAUSE, WHICH IS HOW
THEY WERE FOUND.** They expired together the moment pets existed. That is the
third time reasons written specifically enough to re-read have paid for
themselves.

**A PET RECEIVES NO RAID BUFFS**, which is a Forever rule and not Classic's:
"Pets can no longer receive external buffs." `isPlayerControlled` counts a pet
-- right for deciding who the raid is FIGHTING, wrong for deciding who it
BUFFS -- so using it handed a Hunter's pet the whole raid AND printed every
buff twice on the results page. The duplication is how it was noticed;
`kind === 'player'` is the narrower test.

**REPORTING READS EVERY FRIENDLY ACTOR, NOT THE PLAYER.** Damage and buff
uptime both: a talent the Hunter spent points on can put a buff on its pet,
and reading the player alone made Frenzy invisible -- so a working pet talent
looked exactly like an inert one. Rage and survival stay the player's, which
they genuinely are.

**A PET IS A SECOND FRIENDLY COMBATANT, AND ALMOST ALL OF THAT ALREADY
WORKED.** `dps` has summed every friendly actor since batching was written,
`CombatantKind` has had `pet`, `ownerId` has been on `Combatant`, and a
`Combatant` carries its own rotation. The ONE thing missing was reporting:
`abilityBreakdown` read a single actor, so a Beast Mastery hunter would have
shown a DPS figure its own damage table could not account for. Pet stats come
from the owner at Forever's rates -- 2 health a stamina, 30% of armor, 10% of
the HIGHEST attack power source, and 100% of crit, which makes a Forever pet
far more gear-sensitive than a Classic one. A pet's own base damage and swing
speed are stated nowhere and are placeholders.

**A TEMPORARY SUMMON IS MODELLED WITHOUT A COMBATANT**, on the ruleset owner's
call: the engine cannot add one mid-fight, so a Hunter's hawk is a periodic
effect on the Hunter that deals the hawk's damage. The damage lands and is
credited; what is lost is that the hawk is not separately targetable. Adding
combatants mid-fight remains the last item on the gap survey, wanted only by
the Warlock's Infernal and the Mage's elemental.

**`github.com/classic-hunter/forever-hunter/wiki` IS A FIFTH SOURCE**, named
by the ruleset owner for pet scaling and carrying a full Forever-versus-Classic
diff for the whole class. It is the only source for pet stat scaling and focus
regeneration, and it states Forever ability numbers that differ sharply from
Classic's -- Aimed Shot's bonus went 600 to 166, Raptor Strike's 140 to 70,
Arcane Shot gained a 10% ranged attack power coefficient and lost its spell
power one. Where it and the spellbook overlap they agree.

**A SEAL SCALES WITH SPELL POWER, AND IT IS THE ONLY THING THAT DOES.** The
ruleset owner supplied the formula directly: `base + baseWeaponSpeed x (0.022
x attackPower + 0.044 x spellPower)`, which makes a point of spell power worth
exactly twice a point of attack power and makes a slow weapon hit harder --
the tooltip's "slower weapons cause more Holy damage per swing" falls out of
it rather than needing a rule. Which half of a stated range like "21 to 75" is
the BASE is an interpretation, and the low end is read as the base because the
range is described as the effect of speed; it is one named constant so it is
cheap to flip.

**SEAL DAMAGE IS NOT A WEAPON USE**, by the ruleset owner's ruling, and the
swing that carried it still is. So a Seal of Righteousness hit triggers
nothing -- not Windfury, not Crusader, not Hand of Justice, and not another
seal -- while the auto-attack underneath it triggers everything as usual. It
is enforced by dealing every seal hit with NO `weaponSlot`, which is the whole
of `isWeaponUse`.

**A BLOCK IS NOT AN ATTACK OUTCOME A REACTION CAN SEE.** Forever's block lands
and is reduced by a flat amount inside the damage pipeline rather than being
rolled as a table result, so `AttackOutcome` has no `block` for
`melee-received` to produce. An aura can be SPENT by a block
(`consumedByBlock`) and a reaction cannot FIRE on one -- which costs the
Paladin two clauses, Reckoning's extra attack after blocking and Holy Shield's
221 damage per block, and both say so.

**A CASTER'S DAMAGE DOES NOT SCALE WITH GEAR YET, and it is the source rather
than the engine.** `dealDamage` reads `spellPower` for any non-physical school
and has since before any caster existed; what is missing is that every Druid
spell states FLAT damage -- "350 to 412 Arcane damage" -- and no coefficient at
all, so there is nothing to multiply. None is invented. Combined with an item
set curated for a Warrior, where a Moonkin's `spellPower` reads zero, a caster
figure is a FLOOR rather than an estimate. Honest, and not yet worth quoting.
**THE SHAMAN READS THE SAME WAY**, which settles it: two classes, flat damage
and no coefficient in both, so this is how Forever's spell data is written
rather than a Druid quirk.

**AN AURA CAN CHANGE THE NEXT CAST OF AN ABILITY IT NAMES**, which is
`CastModifier` on `AuraDefinition` and the rule four classes asked for.
`abilityCastTime` is a STANDING talent reduction fixed when the character is
built, an ordinary aura reaches every ability or none, and content cannot
reach cast time at all because the engine resolves it BEFORE `onCast` runs --
which is exactly why Stormstrike's +20% could be done in content and Eclipse
could not.

**RESOLVING AND CONSUMING ARE TWO STEPS, and that is the whole design.**
`checkCast` has to be side-effect free, because a rotation calls it on every
candidate before committing to any -- so `resolveCast` is pure and
`consumeCastCharges` is called once, by the cast that happens. Both halves
must see the same cost or a priority list refuses a spell the character can
afford, and does it SILENTLY: the list moves to the next entry and nothing
reports a spell it declined to consider.

**`consumedByCast` IS AN ENUM AND NOT A BOOLEAN.** Eclipse spends a `stack`
-- "your next 2 Starfire spells" is two casts each getting the full half
second -- and Maelstrom Weapon spends `all`, because "your NEXT Lightning
Bolt" is ONE cast that every stack paid for. Spending a stack where the effect
spends all of them leaves four behind for the next cast, which reads as a
working talent and is worth several times what it should be.

**A CORRECT TALENT CAN BE WORTH ZERO, and Eclipse is.** It saves cast time and
the Moonkin is MANA-bound, spending ~3,400 from a ~2,800 pool over sixty
seconds: time it was not using is worth nothing, and the DPS figure did not
move. That is why the tests assert the MECHANISM and not a damage delta --
a test measuring DPS would have passed identically before the rule existed.

**A `percentAdd` STAT EFFECT WITHOUT `scale: 0.01` IS A THOUSAND PERCENT.**
`StatBlock` computes `(base + flat) * (1 + sum(percentAdd))`, so the modifier
wants a FRACTION and a talent states a PERCENTAGE. The Warrior's one entry
scales it and says why; the Druid, the Shaman and the Mage all forgot, which
multiplied intellect by ELEVEN -- an Arcane mage read 1,529 intellect against
a base of 139 and 28.9% spell crit against a true 5.8%. It survived two class
PRs because a caster with a very large mana pool looks exactly like a caster
with a very large mana pool. `classRegistration.test.ts` now fails for any
unscaled percentage operation, which is structural and gets a new class for
free.

**A CLASS HAS TO BE REGISTERED IN FOUR PLACES AND MISSING ANY ONE IS SILENT.**
`talentValues.ts`'s `FILES`, `talentBuild.ts`'s `EFFECTS` **and** its
`REACTIONS`, and `abilitiesForClass`. Two of the four have now been missed, and
the two failures do not even look alike. Missing the VALUES file makes every
rank resolve to nothing so every talent reports itself `unmodelled` -- which is
exactly what an unfinished class is supposed to look like, so twenty dead Rogue
talents read as progress for a day. Missing `talentBuild`'s EFFECTS table is
quieter still: nothing reports unmodelled at all, the tree simply produces no
effects, and three talent-GRANTED abilities went missing from the Shaman's
spellbook with no complaint -- 37% of an Elemental shaman's damage and 44% of
an Enhancement one's, at figures that looked perfectly ordinary. A prose rule
naming one file caught the first and missed the second, so the rule is now
`tests/game/classRegistration.test.ts` instead: it fails when a class with
abilities is absent from any registry. **Check a new class's talents actually
change a number rather than trusting the build to complain**, because it will
not.

**A WEAPON PROC FIRES ON A USE, AND A USE IS A SWING OR AN ABILITY.** Anything
that goes through a combat table and needs that weapon counts -- Bloodthirst,
Mortal Strike, Rend and Heroic Strike are all main-hand uses, which is the
ruleset owner's own wording. Thunder Clap is not, because it needs no melee
weapon; it and Intercept and Charge resolve on the ranged table, which is how
`isWeaponUse` tells them apart. A WEAPON-BOUND effect fires only from a use of
its own weapon, so a main-hand Crusader and an off-hand Crusader are two
effects with two rolls and Windfury is main-hand only; a GLOBAL one, Hand of
Justice, fires from either hand. Whirlwind with Raging Blows strikes with both
hands as two attacks, so one cast can trigger both Crusaders and Windfury, and
Windfury only from the main-hand half. Shield Slam triggers MAIN HAND effects,
settled by the owner because the rule alone did not answer it -- it strikes
with the shield, but the effects it feeds are the main hand's.
The rule lived as a private one-liner in
one file while the procs in two others re-derived it and got it wrong: Windfury
refused every ability and was worth a third of what it should have been, and
Hand of Justice procced off Thunder Clap. It is `isWeaponUse` in the engine
now. Full rules in [docs/extra-attacks.md](docs/extra-attacks.md).

**A cast interrupts the swing in progress, and the swing timer resets.** That is
what makes a cast a real cost to a melee character rather than free damage
between swings. `Ability.swingTimer: 'hold'` is the exception — the timer runs on
behind the cast and a swing that comes due *during* it waits for the cast to
finish rather than being lost. The Warrior's Improved Slam is exactly that, and
it is worth far more than the quarter second of cast time the same talent
removes.

**A MODIFIER CAN BE SCOPED TO A SCHOOL, and that is the missing middle
between one ability and the whole character.** `SchoolModifiers` carries the
same three fields as `AbilityModifiers` -- crit chance, crit damage bonus,
damage multiplier -- keyed by `DamageSchool`, and `dealDamage` consults both.
Before it existed a talent reading "your Fire spells" had two bad options and
BOTH WERE TAKEN: the Druid's Moonfury and Vengeance were left inert because
listing every Balance spell by id was unmaintainable, and the Shaman's
Elemental Fury was applied whole-character with a caveat admitting it also
raised physical crits. Fixing the second moved TWO things, because it was
wrong twice: it reached physical, and it used the MELEE crit multiplier for a
spell. A crit damage bonus raises the bonus HALF, and that half is 1.0 for a
2x melee crit and 0.5 for a 1.5x spell crit -- so "+100%" takes a spell crit
to 2.0x and not to 2.5x. Getting it right cost the Elemental shaman 9.9% and
the Enhancement one 3.0%, and gained the Moonkin 14.6%.

**A CHANNEL IS A CAST THAT TICKS, and nothing else about it is new.**
`Ability.channelTicks` runs `onCast` that many times, evenly spaced inside
`castTimeMs`, with the LAST tick where an ordinary cast's single effect
already lands -- so a one-tick channel and a plain cast are the same thing,
which is the check that the two paths have not drifted. The caster stays
locked for the whole channel: a tick that freed them would let a rotation cast
over its own channel every second. Haste shortens the channel, so the ticks
come faster and there are still the same number of them.

**Per-ability crit and damage go through `AbilityModifiers` on the combatant**,
not through the ability's own `onCast`. `dealDamage` consults them, so an
ability respects them without knowing they exist — otherwise every ability would
have to remember to look, and the one that forgot would be quietly wrong. Auto
attacks carry no `abilityId`, so nothing there touches them, including the
`ALL_ABILITIES` entry. A crit *multiplier* bonus raises the bonus half: a x2
melee crit with "+10% crit damage" is 1 + (2-1) x 1.1 = x2.1, never x2.2.

**A stat that only applies sometimes is a bug waiting to happen.** Equipment
resolution strips the slots a combat style cannot fill, and stripping one slot
too many silently discarded a bow's attack power from every melee character.
Only genuine conflicts are exclusive: a two-hander against a one-hander, and an
off-hand the style cannot hold. A ranged weapon coexists with a sword and simply
does not swing.

## Where the Forever data comes from

Five sources, and knowing which answers what saves a lot of asking. **All nine
classes were built from the two client-derived ones**, so the paragraphs on
`talentsforever.com` and `foreverchanges.pro` below are the ones to read first.

**`C:\Users\Donz\Documents\WoWForever*`** — the ruleset owner's own files, and
the highest authority. Base stats (`.xlsx`), the combat table, stat conversions,
resources, expected stats, and one ability spreadsheet per class as they are
written. `WoWForeverSimGuidance.docx` is NOT data; it is screenshots of an
architecture discussion.

**`wowhead.com/forever/talent-calc/<class>`** — the talent trees, and a useful
cross-check on ability numbers because its tooltips restate them. Client-side
rendered, so a plain fetch gets a page with no talents in it; the data is in the
DOM. `src/data/talents/README.md` has the selectors.

**`talentsforever.com`** — the beta client's own files, served as four static
JavaScript assignments that plain `fetch` reaches. **This is the source of
record for talents**, imported by `tools/import_forever_talents.mjs`.

| | |
| --- | --- |
| `/talents.js` | all nine classes' trees, every rank's text, prerequisites, and each granted ability's cost line |
| `/spellbooks.js` | every trainer spell to 60, every rank |
| `/spelldesc.js` | spell descriptions with cast, range and cooldown |
| `/racials.js` | racials by faction and race |

It replaced the Wowhead talent scrape, which had three wrong talents in 468 and
was still not good enough: a build URL encodes one digit per talent IN TREE ORDER,
so a tree of the wrong length decodes a profile into different talents without
failing. See [docs/class-implementation.md](docs/class-implementation.md), which
is the process every class was built by.

**IT ALSO SERVES THE BUILD URLS THE OWNER SPECIFIES PROFILES WITH.** Every one
of the 21 profiles is a `talentsforever.com/<class>/60/<digits>` link, decoded
by `tools/decode_talent_build.mjs`. Decode before writing anything: a build
that comes back at other than 51 points, or that throws "X given N of M
ranks", means the tree on disk disagrees with the tree the URL was written
against. **A wrong tree does not always fail** -- with the old Druid data the
Moonkin build threw and the CAT BUILD DECODED CLEANLY TO 51 POINTS WITH THE
WRONG TALENTS, because its Balance segment stopped before the divergence.

**THE RANK VALUES ARE THE TRAP, NOT THE TREE.** `values/<class>.json` is
generated by matching `{0}`-style placeholders against each rank's text, and a
SINGLE-RANK talent has no variable to identify -- so its values come back
`null` and every effect reading it is silently dropped. Eight talents are
hand-filled for this reason and each carries a `note` saying which number and
why. **A talent whose effect does nothing is usually this**, not the effect
table. `node tools/import_forever_talents.mjs --check` prints the hand-filled
count per class and the importer MERGES rather than overwrites, so they
survive a refresh.

**`nether.wowhead.com/classic/tooltip/item/<id>`** — Classic item and spell
tooltips, as plain JSON. No browser needed. Used for the current items, which are
Classic stand-ins rather than Forever data. `src/data/items/README.md` has the
markers to parse.

**`foreverchanges.pro/spellbook/<class>`** — every spell of a class read from
the **beta client** and diffed against the Classic Era client, per rank, with
cost, cast time, cooldown, training level and tooltip. The closest thing to the
client itself that does not require the client. Its structured data is in the
page's RSC flight script, not the DOM.

**EVERY ABILITY NUMBER IN THE PROJECT COMES FROM HERE**, imported at MAX RANK
by `tools/import_forever_spells.mjs` into
`src/data/abilities/forever-<class>-spellbook.json`. All nine are captured.

Two things it is uniquely good at, both of which have already caught a bug:

- **Ranks.** It states which rank is the max and at what level, and it OPENS on
  a rank that is not always the max. Forever shifts ranks down and sometimes
  adds one, so reading the page as it loads can give a real Forever number for
  the wrong rank. That is how Slam became 68 instead of 87.
- **Deliberate changes.** It separates "Forever changed this" from "Forever
  inherited this", so a value that matches Classic can be confirmed as intended
  rather than assumed. Thunder Clap's cooldown is 6 in Forever and 4 in Classic,
  and our spreadsheet's 4 had gone unquestioned because it agreed with Classic.

**NEVER READ AN ABILITY NUMBER FROM CLASSIC.** Forever changes them heavily and
in both directions, so a Classic value is not even a safe approximation. The
Hunter is the clearest: Aimed Shot's bonus went 600 to 166, Raptor Strike's 140
to 70, Serpent Sting's total 490 to 555, and Arcane Shot GAINED a ranged attack
power coefficient while LOSING its spell power one. Four numbers, four
directions.

**`github.com/classic-hunter/forever-hunter/wiki`** -- a fifth source, named by
the ruleset owner for pet scaling and carrying a full Forever-versus-Classic
diff for the whole Hunter class. It is the ONLY source for pet stat scaling and
pet focus regeneration. Community-maintained rather than client-derived, so it
ranks below the two above where they overlap -- they have not yet disagreed.

When a number is missing, check whether one of these answers it before asking.

**IF AN ABILITY BEING ABLE TO PROC EFFECTS IS IN QUESTION, ASK.** The ruleset
owner's standing instruction. It is cheap to follow and the alternative is
expensive, because a wrong answer here does not look wrong: Windfury spent its
whole life refusing abilities and every figure the simulator produced was
self-consistent and too low. A proc that never fires leaves nothing behind to
notice. The weapon-use rule above decides most abilities on its own; bring the
ones it does not, as Shield Slam had to be brought.

## Reading a class accurately

Nine classes were built this way. These are the mistakes that were actually
made, in the order they tend to happen.

**AN ABILITY A PRIORITY LIST ASKS FOR AND THE BUILD DOES NOT HAVE IS SILENT.**
`PriorityRotation` skips an entry whose ability is not in the book, which is
what lets one list serve several builds -- and it means a list naming a talent
ability the build never took simply does nothing. It has happened twice and
both times it was invisible: the Shockadin list asked for Seal of Command, a
21-point Retribution talent that build does not take, so NO seal was ever cast
and Judgement then refused every time because it needs one -- 276.9 DPS against
a true 366.7. The Warlock's Shadowburn was never cast because the class had no
soul shard pool to pay from. **When a list entry shows zero uses, check the
book before the list.**

**AN EFFECT THAT READS NO VALUE IS DROPPED, NOT REPORTED.** `talentBuild` asks
`talentNumber` for the rank's value and `continue`s when it is undefined. A
single-rank talent whose values file says `null` therefore produces nothing,
and the talent reads as unmodelled without having said so. Hand-fill the value
-- eight talents are -- and check the `--check` output.

**"INERT" HAS THREE DIFFERENT CAUSES AND THEY EXPIRE DIFFERENTLY.** Say which:

| | |
| --- | --- |
| **the engine** | no declaration exists. Expires when one is built, and has three times -- so write the reason specifically enough to re-read. |
| **the target** | a raid boss is never frozen, never below 20% health, never killed, and is not Undead. Expires only if the encounter changes. |
| **the build** | the profile did not take it, or took a talent that switches it off. Lone Wolf and Demonic Sacrifice both mean "no pet", so eleven Warlock and eight Hunter talents are correctly dead. |

The second and third are NOT engine gaps and should not be written as though
they were. The survey called five profiles pet-blocked; four of them take a
talent saying they bring no pet.

**A PROFILE'S DPS MOVING IS NOT THE TEST THAT A TALENT WORKS.** Eclipse is
correct and worth zero, because the Moonkin is mana-bound and Eclipse saves
cast time. Benediction is correct and worth zero to Retribution, which never
runs dry. Assert the MECHANISM -- the resolved cost, the stack count, the aura
being present -- because a DPS test would have passed before the feature
existed.

**READ THE OWNER'S OWN WORDS FOR WHAT A TALENT SELECTS.** Hot Streak names four
spells and Pyroblast is not one of them, which is what stops it feeding itself.
Mortal Shots says "ranged abilities" and `critDamageBonus` has no table, so it
over-applies to a melee Hunter and says so. Shadow Weaving is on the CASTER in
Forever and on the target in Classic. Twin Disciplines selects "instant cast
spells", which no declaration expresses -- so it names them one by one.

## Never invent game data

This is the most important working rule.

When a formula or value is missing, **say so and flag it loudly** — a named
`PLACEHOLDER_*` constant, a comment, a docs entry. Do not substitute a plausible
number. A simulator built on invented data produces results that look entirely
reasonable and mean nothing, and nobody finds out for months.

When the source is ambiguous, **pick the reading that reproduces a known value**,
state the interpretation in a comment, and isolate it in one place so it is cheap
to flip. Example: the source names an expression `Armor_Reduction` but it
computes the damage *multiplier* — resolved by checking it against the known
~40% figure for a 3731-armor raid boss.

**An `unmodelled` reason is a claim about the engine ON THE DAY IT WAS WRITTEN,
and it expires.** Clearing a blocker is not finished until every reason naming
it has been re-read. This has now been missed twice: five talents still said
nothing attacked the player three commits after something did, and Crusader's
heal said "nothing damages the player, so a heal would restore nothing" for as
long as that was true and for a while after it was not. The reasons are written
specifically enough to check quickly, which is the point of writing them that
way.

**When an effect cannot be modelled, keep its own words and surface them.** Items
carry an `unmodelled` list holding the source's exact text and one line on why it
does nothing, and the Gear panel prints every one under "Equipped but not
simulated". An effect that matches no rule is never guessed at — which is what
kept Crusader granting nothing until its proc rate arrived, rather than quietly
inheriting a plausible one. The same applies to `PLACEHOLDER_*` constants: a
visibly inert buff is the honest failure mode.

**Two sources can disagree.** The ability spreadsheets, the Forever talent
calculator and the spellbook all describe the same abilities, and where they
agree confidence rises. Where they disagree, say so in the docs and pick the one
the ruleset owner supplied directly — do not average them or quietly prefer the
newer.

**A TALENT TOOLTIP SHOWS RANK 1 OF THE ABILITY IT GRANTS, not the rank a level
60 character has.** This explains every "disagreement" the project ever had
between a talent calculator and an ability sheet, and they were never
disagreements at all:

| Ability | Talent tooltip (rank 1) | Level 60 (max rank) |
| --- | --- | --- |
| Mortal Strike | 85 | **160** |
| Bloodthirst | 30 | **48** |
| Shield Slam | 421 to 439 | **640 to 670** |

Three separate arguments, one rule. The ruleset owner's spreadsheet mixes the
two — Mortal Strike is max rank, Bloodthirst and Shield Slam are rank 1 — so
the sheet cannot settle this by itself. **Check the rank before comparing two
sources**, and prefer the spellbook, which states `max_rank` outright.

**A CAPTURED TOOLTIP CAN DISAGREE WITH ITSELF, so read the effect rows and not
only the description.** Base points in this data set run consistently ONE higher
than the stated figure, so an effect row of 49 is a 48. Revenge and Shield Slam
were read that way from the start because their descriptions were unreadable —
Forever renders "(100% of Spell Power)" where the number should be. The trap is
the tooltip whose description is perfectly readable and disagrees with its own
row anyway: Demoralizing Shout said 210 above a row saying −195, and the 210 was
transcribed for months because nothing prompted anyone to look down one line.
Four of the five corrections on 2026-09-23 were already sitting in a file we had
captured; only the reading was wrong.

**Borrowing a Classic value is allowed, and only when it stays visible.** The
project owner's standing decision: where Forever has not supplied a number,
prefer a WoW Classic one over leaving a system unreachable — on three
conditions, all of which must hold.

1. It keeps a `PLACEHOLDER_` name, so nothing can read it without seeing that.
2. A comment says it is Classic and unverified, and what it would take to
   confirm it.
3. Where a person can see the result, the app says so — the way the Encounter
   panel prints the caveat beside the "target attacks back" switch.

A visibly borrowed number beats an inert system. A *silently* borrowed one is
worse than either, because it produces a confident figure nobody can audit. If
any of the three conditions cannot be met, leave it inert instead.

## Generated and scraped data

`src/game/character/baseStats.ts` is **generated** by
`tools/import_base_stats.py` from the base stats spreadsheet. Never edit it by
hand; re-run the generator.

`src/data/talents/*.json` (468 talents, nine classes) and
`src/data/items/classic-warrior.json` (19 items) were **scraped** and are
checked in. Each directory has a README recording exactly where the data came
from and how to refresh it. Never hand-edit either.

**Prove a transfer rather than trusting it.** Both data sets came out of a
browser, and both were hashed with SHA-256 there and re-hashed on disk before
being accepted. For 113KB of talents that is the difference between confidence
and hope. The clipboard is a working channel for this on Windows
(`document.execCommand('copy')` after a real click, then `Get-Clipboard -Raw`),
and it overwrites the user's clipboard, so say so.

**Validate scraped data at load and throw.** `talentData.ts` checks tier against
row, prerequisites resolving inside their own tree, and duplicate ids; the item
loader recomputes each weapon's dps from its damage and speed and throws if the
three disagree. A page that changes shape should fail loudly, not render a tree
with a broken arrow.

Tests check this data against values transcribed **independently by hand**. A
test that derived its expectations from the file under test would prove nothing.
Where the volume makes that impractical — 468 talents — transcribe the shape
(tree names, sizes, capstones) and assert the invariants that must hold for all
of them at once.

## Testing

- **Write the spec out independently in the test.** The race/class table, the
  per-class resource table and the combat table constants are all duplicated by
  hand in tests on purpose. A test that reads the source data passes no matter
  what the source data says.
- **Combat table boundaries use scripted rolls, not sampling.** An off-by-one at
  a boundary shifts every damage number a fraction of a percent; averaging would
  never catch it.
- Use `toBeCloseTo` for anything that passed through a percentage modifier —
  `100 * 1.1` is `110.00000000000001`.

## Git workflow

`main` is **protected**: PR required, CI must pass (Node 20 and 22), no direct
pushes, and that applies to admins. Work on a branch, open a PR, merge with
`--squash --delete-branch`.

**Do not add `Co-Authored-By` trailers** to commits. The user asked for these
removed and the history was rewritten to strip them.

Commit messages: explain *why*, not just what. Flag behaviour changes and
missing data explicitly.

## Verifying work

Tests passing is not the same as the app working. Run the real thing in the
browser and check actual numbers against hand-computed expectations.

**First check the two numbers are even supposed to match.** The UI runs
`runProfileBatch` and renders `batch.representative`, *not*
`runProfile(profile)`. Even at one iteration the batch derives its own seed, so
the browser is showing a different fight from a direct `runProfile` call with
the same profile — the log's `Combat begins (seed ...)` line gives the derived
seed, not the profile's. To reproduce what the browser shows, call
`runProfileBatch` and read `.representative`.

**Then, if they should match and do not, suspect a stale Vite cache** before
suspecting the code. This has happened: the dev server served transformed
modules from before an engine change, and the browser showed a level-60 combat
table while the tests and a direct `vite-node` probe showed the correct level-63
one. Restart with `npm run dev -- --force`.

Those two are in that order for a reason. The cache warning is the memorable
one, so a mismatch reads as a cache bug on sight — and that cost a long detour
of server restarts and cache clearing before `runProfileBatch` turned out to
reproduce the browser's numbers exactly, outside the browser.

**Verify a probabilistic mechanic against its rate, over many seeds, not
against whether it showed up in one fight.** A 6.5% dodge chance is absent from
an entire 100-second fight about once in every two hundred runs, which is often
enough to happen on the seed you are looking at. Loop over a few dozen seeds and
compare the observed rate with the one the combat table specifies. The same goes
for asserting on it in a test: naming a specific ability in a training-dummy
assertion pins a rotation decision rather than the behaviour under test, and
breaks as soon as the rage economy shifts.

## Environment

- Windows. `npm`/`npx` may not be on the Bash tool's PATH; PowerShell with a
  refreshed `$env:Path` works reliably.
- Heredocs in the Bash tool are unreliable for large multi-line content. Write a
  script to a file and run it, or use the Write/Edit tools.
- `.gitattributes` forces LF. CRLF warnings on commit are expected and harmless.
