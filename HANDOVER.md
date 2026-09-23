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
| **Combat tables** | all six, on an integer 1–10000 die, derived from weapon skill vs defense skill, including a **block** outcome. **Defense skill is live**: the surplus above the level baseline moves boss miss, boss crit, dodge, parry and block by 0.04 points each, every one clamped to 0–100% |
| **Armor** | level-scaled, applied per damage event |
| **Resources** | rage from damage, energy in batches, mana on the five-second rule |
| **Abilities** | all 26 Warrior abilities from the ruleset spreadsheet, with weapon-damage scaling and on-next-swing. Effect magnitudes for the ten the sheet leaves blank come from Forever's own spell data, audited against the client-derived spellbook on 2026-09-23 |
| **Reactions** | content responds to an attack result: Overpower off a target dodge, and every item proc |
| **Gear** | 19 items and the Crusader enchant, equippable, driving stats, weapons and procs. A **starting set** is equipped automatically when a Warrior is created, so the first fight is a geared one |
| **Procs** | PPM (Vis'kag, Crusader) and flat-chance with an internal cooldown (Hand of Justice), all firing on a weapon USE -- a swing or an ability. See [docs/extra-attacks.md](docs/extra-attacks.md) |
| **Talents** | all 469 talents, nine classes, spendable in the UI and saved on the profile. The Warrior's per-rank values are captured; **46 of its 53 talents do something** (43 fully, 3 partly), 7 say on screen why they cannot |
| **Encounter** | the target optionally hits back, **ramping 10% a swing**, against a character held up by an assumed healer who can be out-damaged. Deaths are counted. See [docs/incoming-damage.md](docs/incoming-damage.md) |
| **Raid buffs** | 20 buffs, debuffs and totems selectable per profile and applied before the first swing, Windfury's proc included. Nothing on by default. See [docs/raid-buffs.md](docs/raid-buffs.md) |
| **Presets** | **2H Arms**, **DW Fury** and **Prot Warr**, one button each on the creation screen: name, race, style, stance, the whole tree, gear and whether the target swings back, all at once |
| **Analysis** | DPS, per-ability breakdown with uses/attempts/hits/crit/glance/avoid rates, buff and debuff uptime, rage economy, deaths and healing received |
| **UI** | two-step character flow, per-class character sheet (offensive and defensive), style-aware gear, talent trees, combat log, Monte Carlo batches, uptime bar charts |

**1,305 tests**, CI green on Node 20 and 22. Profile format **v9**.

The interface is one theme, **Abyssal Copper**, chosen from four mock-ups. The
other three still exist in `ui/styles.css` under `:root[data-theme=...]` and
`ui/theme.ts` catalogues all four; nothing switches between them and the picker
that briefly did was removed on request.

The app is **live at <https://donz-dev.github.io/SimForever/>**, republished by
`.github/workflows/deploy.yml` on every push to `main` that passes the tests.
See [docs/deployment.md](docs/deployment.md) for the one manual setting it needs
and why a production build carries a `/SimForever/` path prefix.

Starting set, level 63 dummy, **300 fights a row** with a 95% interval.
Reproduce with `npx vite-node tools/measure_rotation.ts`, which writes out the
talent builds it uses.

Re-measured **2026-09-23**, after Thunder Clap learned to slow.

**WITH NO RAID BUFFS SELECTED**, which is the default and is the only way these
stay comparable to each other. Turning the raid on is worth roughly +60% to a
Fury warrior; see [docs/raid-buffs.md](docs/raid-buffs.md) and do not mix the
two sets of figures.

| Build | Standing target | Target swings back |
| --- | --- | --- |
| Dual-wield / Berserker (default) | **163.71** +/- 2.67 | **357.13** +/- 3.37 |
| Dual-wield / Battle (general list) | **161.30** +/- 2.39 | - |
| Two-hander / Battle (default) | **162.44** +/- 2.11 | - |
| 1H & Shield / Defensive (default) | **64.55** +/- 1.08 | - |
| 1H & Shield, 31-pt Protection | **66.38** +/- 1.34 | **151.31** +/- 1.57 |
| Dual-wield, 31-pt Arms | **185.84** +/- 3.13 | - |
| Fury to Death Wish | **222.02** +/- 3.50 | - |
| the same, without Death Wish | **194.40** +/- 3.29 | - |

**Every row fell slightly on 2026-09-23**, by a tenth to three tenths of a
point, and it is one cause: Battle Shout is 139 attack power rather than 140.
One attack power is about 0.07 damage a swing, it is in every build, and it is
the only change in that pass that reaches a build with no talents.

**The tank with the target attacking fell further, 153.71 to 151.31**, and
that is Thunder Clap's cooldown going from 4 seconds to 6 -- all of it.
Isolated on the same `PROTECTION_31` build by changing nothing else, it
measures **153.66 at 4 seconds and 151.31 at 6**, with casts falling **8.87 to
7.49**. It is the one build that casts Thunder Clap on cooldown all fight, so
it is the one build where Battle Shout's lost attack power is swamped.

**No baseline row takes Bloodthirst**, which is a 31-point capstone, so the +48
that moved DW Fury by eight points does not appear in this table at all.

**Earlier moves, kept for the record.** The tank fell from 158.61 to 153.71 when
Thunder Clap began slowing the target -- a fifth fewer swings taken is a fifth
less rage from damage taken. The two-hander went 153.43 to 158.93 when it got
its own priority list, then back to about 152 when Slam gained a fifteen second
cooldown where it had none.

That same change is why Bastion's DPS ratio fell from about 1.16 to 1.106. It
is a rage economy loosening, not a talent getting worse.

**The two columns are far apart because the target ramps.** Turning it on took
the dual-wielder from 294.54 to 357.22 and the tank from 141.87 to 158.61 on
the day the ramp landed. The whole difference is rage from damage taken, which
is proportional to damage.

**How rage-flooded a tank is has moved twice in two days**, and it is worth
watching, because it is what makes a damage talent worth more or less than its
own multiplier. On the ramp alone, rage wasted at the cap ran about four times
rage gained; with Thunder Clap slowing the target it is nearer 1.3 times.

**The shield rows fell hard between 2026-09-18 and 2026-09-22** — 95.48 to
64.64 on a standing target — and it was not one change. Defensive Stance's
damage penalty, the Protection priority list and Shield Block all landed in
between, and none of them is aimed at a target that does not fight back.

**Not comparable to anything published before 2026-09-18.** The ability effect
magnitudes arrived, and three of the rotation's strongest actions stopped doing
nothing -- worth +28.32 DPS on its own. The old table also recorded no talent
builds, so two of its rows could not be reproduced by anyone.

A damage warrior is not the one being hit, which is why `targetAttacks` is off
by default; read the right column as a tanking scenario, and note that it is a
statement about the ramp's settings as much as about the character.

These compare builds to each other and nothing else; see "Read this before
trusting any number".

**[docs/warrior-completion.md](docs/warrior-completion.md) is the action list
for finishing the Warrior** — the ten inert abilities, what is blocked on the
ruleset owner, and what is doable now. **Start there.**

## Start from a preset

Three buttons on the creation screen, at the very top:

| | |
| --- | --- |
| **2H Arms** | Orc, two-hander, Battle Stance, standing target. 38 Arms / 13 Fury | **619 DPS** |
| **DW Fury** | Orc, dual-wield, Berserker Stance, standing target. 18 Arms / 33 Fury, Crusader on both weapons | **689 DPS** |
| **Prot Warr** | Tauren, shield, Defensive Stance, target swings back. 17 Arms / 34 Protection | **376 DPS** |

**All three carry the same twelve raid buffs**, which is what makes those
figures so much higher than the baselines above -- and the only way two presets
can be compared to each other, since they then differ by the character rather
than by who else turned up.

**The raid's Sunder Armor is the one that changes the fight**, not the stat
buffs. The target starts at five stacks, so the warrior stops opening every
fight by applying five of its own and only refreshes what is there: Sunder fell
from 6.56 casts to 2.35 on the Arms build, and **Mortal Strike rose from 1.73 to
6.92** on the rage that freed. Battle Shout is no longer cast at all, because
the raid entry and the Warrior's ability are the same aura.

They exist because almost every instruction about this simulator has been
phrased as a condition -- "if 1H and shield is selected", "if Battle Stance is
chosen", "if the target attacks back is checked" -- and those are not
independent settings. A preset is the whole answer, named, and sets every field
rather than inheriting any. See `profiles/presets.ts`.

**Two of the three lists did not add up, in opposite directions**, and both are
recorded where the allocation is written:

- **Prot Warr came to 52 against a cap of 51.** Anger Management is the point
  the owner chose to give up. `legalAllocation` would have dropped exactly that
  talent on its own -- landing on the right build by accident, with nobody aware
  a point had gone.
- **2H Arms came to 48, three short.** Left that way rather than filled in,
  because choosing where three points went would have been inventing a build.
  The owner named Improved Cleave, which brings it to 51.

**Two of 2H Arms' talents change no number in a result**, and both are the
owner's deliberate choices. Improved Cleave reduces Cleave's rage cost and
Cleave is in no priority list -- it is an on-next-swing ability for two targets
and every encounter here has one. Improved Tactical Mastery retains rage through
a stance change and this list never changes stance after the pull. Eight points
between them.

**Each preset has its own priority list**, chosen by style AND stance: `2H Arms`
runs `Warrior (Two-Hander, Battle)`, `DW Fury` the Berserker list and `Prot Warr`
the Defensive one. A dual-wielder in Battle Stance still gets the general melee
list, which is the only build left using one.

## The encounter now fights back properly

The target ramps 10% a swing, an assumed healer restores 500-1500 a second, and
the character dies and is stood back up as often as the encounter manages it.
**[docs/incoming-damage.md](docs/incoming-damage.md) is the whole story**, and
it matters because the ruleset owner's stated next step is the Protection
priority list — everything in it keyed on being hurt now has something to react
to.

Two things worth knowing before working on that list:

- **The default tank dies about twenty times in sixty seconds**, first at around
  two seconds in on a crushing blow. That is the ramp doing what it was asked to
  do, not a bug, but it means the last half of the fight is a character being
  one-shot from full and the first half is where a rotation decision matters.
- **Rage stops being scarce.** Wasted at the cap runs about four times gained,
  so a list tuned on the standing-target rage economy is being tested against a
  different one.

## The next task

## A fourth source: the spellbook

<https://foreverchanges.pro/spellbook/warrior> carries **every spell of a class
read from the beta client** (`1.60.1.69913`) and diffed against the Classic Era
client, per rank, with cost, cast time, cooldown, training level and tooltip.
There is a page per class, so the other eight are already waiting.

Audited against it on **2026-09-23**: 23 of the 27 Warrior abilities the
simulator models matched exactly, and **five numbers moved** -- Slam +68 to
+87, Thunder Clap's cooldown 4s to 6s, Bloodthirst +0 to +48 flat,
Demoralizing Shout -210 to -196, Battle Shout +140 to +139. Nothing the
simulator models is absent from Forever.

**Four of the five were already in `forever-warrior.json`**, in effect rows
nobody had read. That is the lesson worth carrying to the other classes:

> **Read the effect rows, not only the description.** Base points run one
> higher than the stated figure. Demoralizing Shout's description said 210
> above a row saying -195, and the description was transcribed.

The fifth, Slam, was a **rank** confusion: Forever adds a rank Classic has no
equivalent for, shifts every rank down a level, and the spellbook opens a spell
on a rank that is not always the max. Check `max_rank` before reading a number
off it.

Full findings in
[docs/warrior-ability-audit.md](docs/warrior-ability-audit.md).

**Three Forever abilities are still unmodelled and now visible**: Victory Rush
(new, needs a kill, inert against one boss), Retaliation (**15 min in Forever,
down from 30** -- a real Arms cooldown once the target swings back) and
Tactical Mastery (no longer a talent; trained, and 10 rage retained rather than
Classic's 25).

The site also has a talent calculator and a sourced change list, which would be
a second opinion on the Wowhead-scraped tree in `src/data/talents/`. Not done.

## Charge opens a list, once

The ruleset owner's rule: **if Charge is in a priority list it is used exactly
once, as the first player action**, because it cannot be used in combat after
that. `CHARGE.canCast` allows it only at timestamp zero -- a fight that opens
in combat leaves exactly one legal moment, and the clock can name it.

It is first in the **Two-Hander / Battle** and **Shield / Defensive** lists. It
is off the global cooldown, so it costs the entries below it nothing, and it
hands over 18 rage (15, plus 3 from 1/2 Improved Charge) before the first
swing. Worth **+10.2 DPS** to the unbuffed two-hander baseline and **+13** to
the 2H Arms preset.

**In the Protection list it is gated on Vanguard, with no talent named
anywhere.** Charge lists Battle Stance; Vanguard adds Defensive to the
character's own copy. A tank without it is in a stance Charge does not allow,
so the entry is refused.

**AND THAT NEARLY WENT VERY WRONG.** `PriorityRotation` treats a wrong stance
as "not yet, and here is how" and will cast a stance change to unblock an entry
-- right for Revenge, catastrophic for Charge. Dropping it into the Protection
list sent the tank into Battle Stance at the pull. Three stance tests caught
it. The entry's `condition` now refuses unless the character is already in a
stance Charge allows, and a condition is checked before the swap is considered.

## Extra attacks: what triggers a proc

The ruleset owner's rule, settled 2026-09-23 and written down in
[docs/extra-attacks.md](docs/extra-attacks.md):

> A **use** of a weapon is a **swing or an ability** -- anything that goes
> through a combat table and needs that weapon. Bloodthirst and Rend are
> main-hand uses. Thunder Clap is not, because it needs no melee weapon.

**Weapon-bound** effects (Crusader, Vis'kag, Windfury, Weaponmaster's sword
clause) fire only from a use of their own weapon; **global** ones (Hand of
Justice) from either hand. Whirlwind with Raging Blows strikes with both hands
as two attacks, so one cast can trigger both Crusaders and Windfury -- Windfury
only from the main-hand half.

**Two of the four had it wrong**, each having re-derived the rule privately in
its own file. Windfury refused every `abilityId`, making it auto-attack-only;
Hand of Justice accepted any landed attack, including Thunder Clap. It is
`isWeaponUse` in the engine now, named once.

| Preset | Before | After |
| --- | --- | --- |
| 2H Arms | 558.5 | **605.9** |
| DW Fury | 640.5 | **679.9** |
| Prot Warr | 347.3 | **374.7** |

Windfury's uptime went **1.4% to 15.5%** on the tank, the build that casts
most and swings least. The unbuffed baselines below did not move outside their
intervals, because they carry no Windfury and the Hand of Justice restriction
is worth very little.

**Shield Slam triggers MAIN HAND effects**, settled by the ruleset owner. It
was the one ability the rule did not answer by itself -- it is declared
main-hand and resolves on the melee table, but its tooltip says "Requires
Shields" and it strikes with an off-hand item. The answer matched what the code
already did, so nothing changed.

**A standing instruction came with it:** *if an ability being able to proc
effects is in question, ask.* A wrong answer there does not look wrong -- a
proc that never fires leaves nothing behind -- which is exactly how Windfury
went unnoticed.

## The talents are confirmed, by a second client-derived source

<https://talentsforever.com/warrior> reads the beta client (`1.60.1.69876`) and
exposes the trees as `window.TALENT_DATA` -- every rank's text, the Classic
comparison, and the talents Forever removed. There is a page per class.

Audited **2026-09-23**: **53 of 53 talents and 154 of 154 rank values match**
our Wowhead capture exactly. No errors. The only flagged row was `0.5` against
`0.50` on Improved Slam.

**A talent tooltip shows rank 1 of the ability it grants**, and that single
fact explains three arguments this project has had:

| Ability | Talent tooltip | Level 60 |
| --- | --- | --- |
| Mortal Strike | 85 | **160** |
| Bloodthirst | 30 | **48** |
| Shield Slam | 421 to 439 | **640 to 670** |

The Mortal Strike one is recorded above as "resolved, do not re-litigate" after
being escalated to the ruleset owner. It is still 160; the calculator was never
wrong, it was describing rank 1. **The spreadsheet mixes the conventions** --
Mortal Strike at max rank, the other two at rank 1 -- so it cannot settle a
rank question alone.

**Two `unmodelled` reasons had expired** and were corrected. Vanguard said
"Stances gate nothing", which stopped being true when abilities got a `stances`
field; Improved Berserker Rage said its values were pending, and they have been
in `values/warrior.json` all along. Neither talent's behaviour changed -- both
are inert because no priority list casts Charge or Berserker Rage -- but both
reasons are shown to users, and both were false.

Full findings in
[docs/warrior-talent-audit.md](docs/warrior-talent-audit.md).

**Finishing the Warrior is the priority, and
[docs/warrior-completion.md](docs/warrior-completion.md) is the ordered list.**
In short:

1. ~~**The ten inert abilities**~~ and ~~**re-measure the rotation**~~ are both
   **done**. The magnitudes were never missing: Forever serves spell tooltips at
   `nether.wowhead.com/forever/tooltip/spell/<id>`, the same host as the item
   endpoint, and borrowing from Classic would have been 40% wrong on
   Demoralizing Shout alone.
2. **Capture the other sixteen Warrior spells.** Cheap, and it would answer the
   stance-gating question filed as blocked on the ruleset owner for months --
   four of the eleven captured already state their required stance. See section
   3.6 of the completion doc.
3. **Enrage and Master of Defense** -- not blocked, values captured, each needs
   a talent-granted reaction of the shape Shield Specialization already uses.
4. **Wire Import/Load**, **combat-start aura talents**, **armour enchants**.

The two longer-range candidates below remain after that.

### 1. Talent effects for the other eight classes, and the rest of the Warrior's

The mechanism is built and the Warrior is the worked example. A talent declares
what it does in `game/talents/warriorEffects.ts`; what its number IS lives in
`src/data/talents/values/warrior.json`, per rank, hand-editable. See
[docs/talent-effects.md](docs/talent-effects.md) for what the code does and
**every edge case and interpretation** the Warrior turned up. The design
rationale is in the proposal on PR #22, which is not merged.

**Warrior: 43 talents carry no caveat, 3 partly, 7 inert.** Every one of the 53
has an explicit entry, and the inert ones name their own obstacle, so the list
below IS the work queue. The Talent panel prints them under "Chosen but not
simulated".

**ONE OF THE 43 IS DELIBERATELY SILENT RATHER THAN COMPLETE.** Concussion Blow
stuns, stuns are out of scope, and the ruleset owner asked for no note about it
on the GUI -- so it carries no `unmodelled` entry and counts here as if it were
finished. It is the only exception, it is written down beside the talent, and
a count is the wrong place to find that out.

The seven still inert are `improved_hamstring`, `booming_voice`, `iron_will`,
`improved_berserker_rage`, `defiance`, `improved_disarm` and
`improved_shield_bash`. Regenerate the list with a three-line script over
`WARRIOR_TALENT_EFFECTS`: a talent is inert when every one of its effects is
`unmodelled`.

#### What the remaining talents are blocked on

Grouped, because each blocker unlocks several at once:

| Blocker | Talents | Note |
| --- | --- | --- |
| **Concepts the engine has no notion of** — threat, movement, stuns, multiple targets, shout radius, fear/stun duration | Defiance, Piercing Howl, Concussion Blow, Sweeping Strikes, Booming Voice, Iron Will, Improved Hamstring | **Deliberately left absent.** None of them matters against a single stationary dummy, and each would need an encounter model that does not exist. Revisit when encounters gain positions, adds or mechanics. |
| ~~Nothing attacks the player~~ | ~~Enrage, Master of Defense, Blood Craze, Shield Specialization, Improved Revenge~~ | **Done, and the reasons were not swept for three commits.** `encounter.targetAttacks` makes the target swing back; Table 6, rage from damage taken, Revenge, block and Shield Specialization all run. This row used to hold an em-dash, asserting nothing waited on it — five entries did. Shield Specialization and Improved Revenge turned out to be **fully modelled already**; the other three moved to the two rows below. |
| ~~No block outcome~~ | — | **Done.** The engine has a `block` outcome and `blockChance`/`blockValue` stats; Shield Slam, Revenge and Shield Specialization all use them. |
| ~~No defense skill~~ | ~~Anticipation~~ | **Done.** The ruleset owner gave the formula: each point of defense skill above the level baseline moves boss miss, boss crit, player dodge, parry and block by 0.04 percentage points, every one clamped so it cannot go negative or past 100%. |
| **Stances gate nothing** | Improved Tactical Mastery, Vanguard | Waiting on the ruleset owner; see below. |
| **The ability it modifies is inert** | Improved Berserker Rage | **Improved Bloodrage and Improved Shield Wall have both left this row.** Bloodrage got its periodic half, and Shield Wall became a real decision once survival was measurable -- so the talent that cuts its cooldown from 15 minutes to 4 is modelled. |
| ~~Talents cannot apply a combat-start aura~~ | ~~Anger Management, Death Wish~~ | **Done.** `grantAura` on a talent effect puts a definition in the character's opening auras, via `TALENT_AURAS`. Anger Management's first tick is rolled 1-3000ms into the fight, so a batch does not tighten its distribution around a fiction. |
| **Ability not implemented** | Improved Disarm, Improved Shield Bash, and the five ability grants below | Disarm and Shield Bash are absent from the ability spreadsheet. |
| **Needs a talent-granted reaction** | Enrage, Master of Defense, Weaponmaster's sword clause | **Not blocked on data.** Values are captured and the trigger exists; Shield Specialization is the worked example of the shape. The cheapest remaining talent wins. |
| ~~Needs a concept the engine lacks~~ | ~~Toughness, Blood Craze~~ | **Both done.** Toughness scales armor from items, which is now tracked separately from armor derived from stats. Blood Craze regenerates on all three of its triggers — being critically struck, taking more than 20% of maximum health from one blow, and landing a Bloodthirst. |
| ~~The source does not say what it affects~~ | ~~Focused Rage~~ | **Done.** The ruleset owner defined "offensive": an ability is offensive if it is processed through a combat table. Derived from `attackTable`, not from a list of ability ids, so a new ability gets it without anyone remembering. |
| ~~Would be understated by modelling part of it~~ | ~~Dual Wield Specialization, Raging Blows~~ | **Done, once the ruleset owner supplied all the parts.** Dual Wield Specialization is off-hand damage 0.5 to 0.625, doubled off-hand rage and +10% off-hand hit; Raging Blows makes Whirlwind strike with both hands, main first, the off hand taking the damage penalty but not the miss penalty. |
| **Partly modelled, by choice** | Weaponmaster | Does the part that is expressible and flags the rest. Dual Wield Specialization and Raging Blows were listed here too and are in fact wholly inert — each declares only an `unmodelled` reason. |

**More edge cases almost certainly remain.** The 53 were classified by reading
each talent's text against what the engine can express, and the classification
has already been wrong **eight times, in two rounds**. Improved Rend and Improved
Overpower were both filed as impossible before per-ability scaling existed, and
Unbridled Wrath's two-handed clause was written off as needing a weapon type that
had been added an hour earlier. Then five more all claimed nothing attacked the
player, three commits after something did — and two of those five were working
perfectly while telling the user on screen that they could not fire.

**Clearing a blocker is not finished until every reason naming it has been
re-read.** That step was skipped once already and cost two talents' worth of
understated coverage. Every remaining `unmodelled` reason deserves re-reading
rather than being trusted; they are written specifically enough to check
quickly.

The ones found so far are in
[docs/talent-effects.md](docs/talent-effects.md) — edge cases, interpretations,
and the talents that are deliberately only partly modelled.

#### Data still needed

- **Per-rank values for the other eight classes.** Two documented steps per
  class in `src/data/talents/values/README.md`. Do a few at a time; wowhead
  rate-limited an attempt at all nine in one sitting.
- **Effect tables for those classes**, once they have abilities at all.

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

## The Protection tree changed under us

Forever **removed Bastion** and moved Focused Rage into the slot it vacated.
Confirmed against the live calculator on 2026-09-17, which is why the Warrior
now has 53 talents and the project 469. The structure file was corrected by hand
to match — the one hand edit `src/data/talents/*.json` has ever taken — and the
hand-transcribed test in `tests/game/talents.test.ts` was updated with the
reason beside it.

**The rest of that file has not been re-scraped.** Bastion is the change we
found because the values capture tripped over it; there may be others in the
eight classes nobody has captured values for yet. A full re-scrape is the honest
fix and is not done.

## Waiting on the ruleset owner

Work that is blocked, not merely unstarted.

| Needed | Blocks |
| --- | --- |
| **Warrior stance gating** — which abilities require which stance. Corrections were promised and never arrived. The sheet has no Battle Stance row at all. | Stances are defined but gate nothing; the rotation does not stance dance. Improved Tactical Mastery and Vanguard wait on it |
| ~~**Effect MAGNITUDES for ten Warrior abilities**~~ | **Not blocked, and never was.** Forever serves them at `nether.wowhead.com/forever/tooltip/spell/<id>`. Seven are filled. Berserker Rage has no magnitude even in Forever; Bloodrage and Shield Block need a mechanism rather than a number. |
| **Rows for five abilities talents grant** — Sweeping Strikes, Death Wish, Piercing Howl, Last Stand, Concussion Blow | Five talents grant an ability that does not exist. The grants are declared, so they gate correctly the moment the abilities do |
| ~~**Defense skill formula**~~ | **Supplied.** 0.04 percentage points per point of skill, on boss miss, boss crit, dodge, parry and block alike, clamped at both ends |
| **Ability spreadsheets for the other eight classes** | Those classes fight with auto-attacks only |
| **Forever item IDS** — not the data, which is reachable | 18 of 19 items are Classic stand-ins. `nether.wowhead.com/forever/tooltip/item/<id>` works and `tools/import_item.mjs` imports from it; only the ids are missing |

**The Classic-borrowing decision was never exercised, and should not have
been.** Forever's own spell data was reachable the whole time at
`nether.wowhead.com/forever/tooltip/spell/<id>` — the same host as the item
endpoint, which had been in use for months. Borrowing Classic's Demoralizing
Shout would have been 30% too weak. Before recording a number as blocked on the
ruleset owner, try the obvious neighbouring URL.

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

3. **The starting set is now fully simulated.** Resistances are totalled on the
   character sheet for display and are deliberately not a combat stat, which is
   the ruleset owner's decision rather than a gap. Crusader's heal was the last
   real omission and works now — its reason said "nothing damages the player",
   which stopped being true when the target started killing people.

   **The bigger caveat has moved to the encounter.** Every figure from a fight
   with the target attacking depends on three settings nothing in Forever
   states: the opening swing damage, the swing speed, and the 10% ramp. See
   [docs/incoming-damage.md](docs/incoming-damage.md).

4. **Bear/Cat paw swing speed and AP coefficients** are invented. The *damage*
   values (100 / 50) are real.

5. **`manaRegenBypass`** exists as a stat but nothing grants it.

**Raid buffs exist now, and none of them is on by default.** `BATTLE_FURY`, an
example aura granting an invented +10% attack power, used to be applied to
every player and was removed — it inflated every figure and made a sheet
reading 400 attack power fight at 440. The note left in its place said real
raid buffs belonged there when there was real data for them, and there is:
twenty entries, every number from the ruleset owner directly, selected per
profile. See [docs/raid-buffs.md](docs/raid-buffs.md).

**The baselines below were measured with none of them selected**, which is
what an empty default is for.

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
│   ├── encounters/  raidBoss (the boss melee and its ramp), externalHealer
│   ├── buffs/       raidBuffs (the catalogue), windfury (the one proc)
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
├── profiles/        versioned profiles (format v9), validation, migration, presets
└── ui/              React panels
```

Longer explanations: [`docs/`](docs/) — `architecture.md`,
`simulation-engine.md`, `combat-tables.md`, `character-creation.md`,
`resources.md`, `telemetry.md`, `profiles.md`, `warrior-abilities.md`,
`global-cooldown.md` (a fundamental rule, written down after it was found
broken in four places), `incoming-damage.md` (the ramp, the assumed healer and
how death is counted), `raid-buffs.md` (what the rest of the group supplies,
and the two traps in Windfury), `warrior-ability-audit.md` (the abilities
against the client, and the five numbers it moved) and
`warrior-talent-audit.md` (the talents against the client, which found
nothing wrong, and the rank-1 rule that explains three old arguments) and
`extra-attacks.md` (what counts as using a weapon, and the two procs that
had it wrong).

`ProfilePanel.tsx` is **not mounted**. Import and Load buttons sit above the
character name as placeholders; the panel's serialize-out / parse-in / render-
issues round trip is exactly what they need, which is why it was kept.

## Data the project still needs

Roughly in order of value.

1. ~~**Effect magnitudes for the Warrior's ten inert abilities.**~~ Done, from
   Forever's own spell data. What remains is **the other sixteen Warrior
   spells**, which would likely answer stance gating too.
2. **Warrior stance gating**, and rows for the five abilities talents grant but
   the spreadsheet does not list.
3. **Per-rank talent values for the other eight classes.** The Warrior's are
   captured; see `src/data/talents/values/README.md`.
4. **Ability spreadsheets for the other eight classes.**
5. **Forever item ids.** The DATA is reachable —
   `nether.wowhead.com/forever/tooltip/item/<id>` works and
   `tools/import_item.mjs` imports from it — so this is a list of ids, not a
   blocked request. More items of any kind also help: no one-handed weapon
   grants weapon skill, so a dual-wielder's two combat tables cannot yet
   diverge, and there are no armour enchants at all.
6. **A defense skill formula**, the last piece of the attacks-received table.
7. **Bear/Cat paw swing speed and AP coefficients.**

## Built but unreachable

Three entries left this list at once when the target learned to swing back. They
are kept here, struck through, because "built and never run" is a state worth
remembering: all three had passing tests and none of them had ever executed in a
real fight, and two carried bugs that only showed when they finally did.

- ~~**Table 6 (attacks received by the player)**~~ — runs whenever
  `encounter.targetAttacks` is on. Player dodge, parry and block all come from
  the character's own stats. Only DEFENSE SKILL is still missing.
- ~~**Rage from damage taken**~~ — runs, and is large: it takes a geared
  dual-wielder from 119.65 to 182.13 DPS, which is why the switch defaults off.
- ~~**Revenge**~~ — its window opens on a dodge, parry or block, and the rotation
  casts it above everything but Execute.
- ~~**Healing**~~ — two things heal now. The encounter's assumed healer restores
  a random 500-1500 a second while the target attacks, and Crusader's enchant
  heals 75-125 on proc. The character is no longer immortal: they die, are stood
  back up at full, and the deaths are counted in the results. What is still not
  modelled is a healer with a spell book — see
  [docs/incoming-damage.md](docs/incoming-damage.md) for why that is deliberate.
- ~~**Resource waste analysis**~~ — the Results panel reports rage gained, spent,
  wasted at the cap and unspent, with donuts for source and destination. It
  immediately found something: a ramped tank wastes roughly four times what it
  gains, so the back half of that fight is not rage-constrained at all.
