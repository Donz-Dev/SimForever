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
npx vite-node tools/measure_profiles.ts          # the 25 profiles, 30 batches of 10
USES=1 SEEDS=1 PROFILES=druid_cat npx vite-node tools/measure_profiles.ts
npx vite-node tools/measure_rotation.ts          # Warrior TALENT builds, not profiles
npx vite-node tools/ability_audit.ts             # is every ability connected at all
npx vite-node tools/class_audit.ts warrior       # one class's gaps, lists and sources
npx vite-node tools/coefficient_probe.ts         # does every ability's damage scale
node tools/value_index_sweep.mjs                 # which talents index a multi-number row
node tools/diff_forever_talents.mjs              # WHAT changed in each tree, talent by talent
node tools/decode_talent_build.mjs --profiles    # does every profile's build URL still decode
node tools/decode_talent_build.mjs --presets     # does each URL still MATCH its preset
PROFILE=pally_ret npx vite-node tools/probe_resources.ts   # where one pool went
npx vite-node tools/probe_block.ts               # a tank's block chain, link by link
npx vite-node tools/druid_attribution.ts         # what one talent is worth, with its CASCADE named
npx vite-node tools/enchant_report.ts            # all 25 profiles' enchants, shaped like the owner's table
npx vite-node tools/consumable_report.ts         # all 25 profiles' consumables, the same way
PROFILE=dw_fury npx vite-node tools/stat_weights.ts        # what a point of each stat is worth
PROFILE=rogue_combat PLAN=1 npx vite-node tools/stat_weights.ts   # the cap ladder, no fights
npx vite-node tools/probe_racials.ts             # does each racial MECHANISM do its thing
npx vite-node tools/probe_racial_worth.ts        # what one race is worth, by RACE SWAP
npx vite-node tools/probe_revelation.ts          # a proc's RATE against its own denominator
npx vite-node tools/probe_consumable_choice.ts   # every mid-fight candidate on every preset, with its CASTS
PRESET=warlock_firelock npx vite-node tools/probe_firelock_heal.ts   # why healing a Warlock LOSES dps
npx vite-node tools/probe_cat_rage.ts            # does a Cat's rage pool ever hold anything
npx vite-node tools/probe_life_tap_gate.ts       # what mana a Warlock should Life Tap at
npx vite-node tools/probe_other_assignment.ts    # each preset's `other` consumable beside its POOLS
npx vite-node tools/item_vocabulary.ts           # which item lines the parser does NOT read, by shape
npx vite-node tools/stamina_share.ts             # what share of a real item's budget is stamina, PvP split out
ITEMS=19321,21126 npx vite-node tools/item_show.ts   # one item's tooltip beside its parse
node tools/fetch_class_restrictions.mjs --check  # which set pieces carry no `Classes:` line, by set
npx vite-node tools/benchmark_stat_report.ts     # what a benchmark set GRANTS, per build, on the character
STAT=critRating CLASS=warrior npx vite-node tools/real_set_shape.ts   # what a REAL set of that item level carries
npx vite-node tools/item_budget.ts               # what an item COST to make, and whether it adds up
FOREVER=1 npx vite-node tools/item_budget.ts     # the 64 Premier PvP cloth pieces, Forever's own
WEAPONS=1 npx vite-node tools/item_budget.ts     # the 41 new Forever epic weapons
PRESET=bm_hunter VARIANTS=hunterTalents npx vite-node tools/probe_build.ts   # A/B a whole BUILD, PAIRED
PRESET=bm_hunter npx vite-node tools/probe_profile_report.ts   # one profile's whole results page
npx vite-node tools/encode_talent_build.mjs --all   # every preset's build as a talentsforever.com URL
npx vite-node tools/probe_shared_cd.ts            # does a shared cooldown actually BITE, off the event stream
PRESET=bm_hunter npx vite-node tools/probe_jow.ts   # which ACTIONS roll for Judgement of Wisdom, by instant
ABILITIES=mark npx vite-node tools/probe_precombat_abilities.ts   # map an owner's ability NAME to an id, per profile
npx vite-node tools/probe_precombat_pools.ts     # what each profile ARRIVES with, and its lockout remainder
npx vite-node tools/probe_party_crit.ts          # does any profile hold a party crit aura TWICE
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
132 to 62, four classes are at 1–3, and what closed was mostly declarations and
owner rulings rather than new engine capability. [HANDOVER.md](HANDOVER.md) has the
recap.

**A PATCH ARRIVES IN WAVES, AND THE NOTES ARE ONLY THE FIRST ONE.** The
1.60.1.70170 work took FIVE rounds across seven commits, and the notes were round
one:

| | what it was | largest effect |
| --- | --- | --- |
| 1 | the notes, plus four silent tree changes the importers found | DW Fury **+101.6**, Seal Twist Ret **-98.5** |
| 2 | four rulings on questions round one RAISED | Fire **-187.6** |
| 3 | one more coefficient the owner gave afterwards | Frostfire **-159.3** |
| — | the write-up commit, documenting rounds one to three as a finished patch | no code |
| 4 | three more changes, arriving AFTER that write-up | Cat **+13.2** |
| — | two rulings closing the last open questions, both "intended" | no code |
| 5 | melee and ranged miss 8% not 9%, arriving after THAT | **15 of 25 rows** |

**FOUR OF THE FIVE ROUNDS WERE EACH LARGER THAN ANYTHING IN THE NOTES.** So "the
patch notes are exhausted" is not "the patch is implemented": what the notes
actually produce is a list of QUESTIONS, and the answers keep arriving. Plan for
a patch to land in several commits and expect to re-measure after each.

**AND NEITHER THE WRITE-UP NOR AN EMPTY QUESTION LIST IS THE END.** Round four
arrived after rounds one to three had been documented as a finished patch in a
commit of its own; round five arrived after a commit that closed the last two
open questions, and it was the widest-reaching of the five. The header summarising
them has been reopened twice and its mean re-summed three times -- 689.4 and 690.2
are both still in `HANDOVER.md` as published figures that are no longer the mean.
**Write the recap so another round can be added to it**, rather than as a closing
statement, and name the round each figure belongs to.

**AND A FEATURE ARRIVES IN WAVES TOO, WHICH IS THE SAME RULE WITH NO PATCH
NOTES TO BLAME.** Racials shipped as one commit and then took THREE more rounds,
two of them the owner's:

| | what it was | effect |
| --- | --- | --- |
| 1 | the ten races, five abilities, four engine additions | 25 of 25 rows moved, mean 700.0 -> 709.8 |
| 2 | the owner's three asks about the panel and the APL | no figure moved; all 75 hashes identical |
| 3 | the owner found the proc at HALF its rate, by arithmetic | SM/DS 1.17 -> 2.03 procs a fight |
| 4 | the sweep asking whether anything else was left behind | six DoTs, four on classes no profile reaches |

**ROUND ONE'S HEADER SAID "THIS IS ROUND ONE" AND STILL GOT IT WRONG**, because
it then listed a single row and left the table closed. Saying a thing is round
one is not the same as leaving room for round two: **write the TABLE so a row
can be added**, which is what this one is for.

**AND ROUNDS THREE AND FOUR CAME FROM THE OWNER AFTER THE FEATURE WAS
DOCUMENTED AS FINISHED**, which is the pattern below about who finds what the
suite cannot -- so "the feature is built and measured" is not "the feature is
right" any more than "the notes are exhausted" is "the patch is implemented".

**EVERY ROUND'S FIGURES WERE PUBLISHED, AND THE TOP ROW CHANGED TWICE** --
Frostfire to DW Fury, by way of Frostfire again. The baseline table was rebuilt
three times by `tools/update_baseline_table.py` and no row drifted, which is the
first time that script has been under real pressure; a row-at-a-time edit across
three rounds is exactly the drift it was written for. **Re-run the FULL
measurement after each round rather than patching the rows the round touched.**

**AND A THIRD TIME, WHERE ROUND ONE MOVED NO FIGURE AT ALL.** The Gear panel
took five rounds, FOUR of them the owner reading the result and sending it
back:

| | what it was | mean |
| --- | --- | --- |
| 1 | the panel as a **character planner** -- cards, a class filter, value sorting | **no figure moved**; all 75 hashes identical |
| 2 | six tweaks, aimed at Forever's own items instead of at a target | 719.6 -> 736.1 |
| 3 | a hit rating paid for out of **crit**, not out of spell power | 736.1 -> 737.3 |
| 4 | twelve movements on the template gear | 737.3 -> 748.4 |
| 5 | a dual-wielder applies the **weapon effect twice** | 748.4 -> 752.7 |

**THE WRINKLE IS THAT ROUND ONE WAS CORRECTLY WORTH NOTHING.** A UI feature
that moves a figure has a bug in it, so "no row moved" was the containment
check rather than a disappointment -- and it is exactly why rounds two to five
existed: **the planner is what let the owner SEE the gear**, and four of their
five findings came from reading a panel that had just been built. Shipping the
thing that makes a fault visible is itself a round.

**SO A FEATURE THAT MOVES NOTHING CAN BE THE ONE THAT CAUSES THE NEXT FOUR
ROUNDS**, which is the opposite of how "worth no DPS" usually reads here.

**AND FOREVER PATCHES, WHICH IS A WHOLE CLASS OF WORK THE NINE DIVES DID NOT
COVER.** Client build 1.60.1.70170 removed four talents, added three, moved six
Protection rows, swapped two Shaman tiers and re-specified ten of the
twenty-four profiles. **A PATCH STARTS WITH THE THREE IMPORTERS AND THE DECODER,
NOT WITH THE NOTES**: `import_forever_talents.mjs --check` says which trees
changed shape, `import_forever_spells.mjs --all --write` says which numbers
moved, and `decode_talent_build.mjs --profiles` says which builds stopped
decoding. Seven of twenty did, and **three of the four removed talents are in no
patch note at all** -- two of them with points spent in every Paladin build. The
notes are a guide to what is intended, not a list of what changed.

**AND `--check` REPORTS A COUNT, WHICH CANNOT SEE A SWAP.** That is what
`tools/diff_forever_talents.mjs` is for, and it is the step that belongs FIRST
now: a patch that replaces one talent with another leaves the count identical,
and so does moving a row, changing a prerequisite, adding a rank or restating a
value. Asked to check three classes the owner had named, the count said two of
them changed and the diff said **EIGHT OF NINE** -- the Rogue alone was
untouched, and the five nobody mentioned carried a removed talent (the Warlock's
Malediction), a new one (Grim Reach) and a dozen restated descriptions between
them.
**SO "THE OWNER NAMED THREE CLASSES" IS A GUIDE TO WHAT THEY NOTICED**, which is
the same rule as "the notes are a guide to what is intended" pointed one level
up. Diff every class, every time.
**READ THE DESCRIPTION DIFFS, WHICH IS WHERE A PATCH ACTUALLY HIDES.** A talent
that keeps its name, row, ranks and prerequisite and changes only its NUMBERS
has no structural tell at all -- and in that one refresh those included Mental
Strength 15% to 10%, Critical Mass 6% to 10% over five ranks instead of three,
Lava Burst's damage cut by a quarter, and **Ice Lance's frozen bonus from 300%
to 200%**, which is the constant this file has already recorded three separate
owner rulings about.

**THE UI HAS HAD FOUR PASSES NOW, AND THIS LINE HAS ALREADY BEEN WRONG ONCE
BY THE SAME ARITHMETIC.** It once read "THE UI HAS NOT HAD A PASS OF ITS OWN
and is the next piece of work" while `docs/handoff/gui.md`'s own header read
"THE FIRST PASS IS DONE, AND THIS DOCUMENT IS NOW ITS RECORD" -- two files
disagreeing about the same fact, with the stale one at the top of the file
everybody reads first. **A POINTER AT A DOCUMENT IS A CLAIM ABOUT THAT DOCUMENT
AND EXPIRES LIKE ANY OTHER**, which is this file's own rule about an
`unmodelled` reason applied one level up. **So COUNT the passes against the
handoff document rather than incrementing this sentence.**

Where it stands: the first pass settled the layout, the collapsing panels and
the preset rail. The second built **Save and Load**, and the **Action Priority
List** -- a panel, an editor, and the list stored on the profile. The third
rebuilt the **Gear panel as a character planner**: item cards, a class
proficiency filter, items sorted by what the build values, and the four test
sets exposed. The fourth gave the APL editor **duplicate** and **retarget**
controls and added the **Timeline** panel -- one fight drawn against the clock,
which is the view a priority list is read with, because every question a list
is tuned against is about where two things sat RELATIVE to each other.
[docs/handoff/gui.md](docs/handoff/gui.md) is the record of all four,
[docs/apl.md](docs/apl.md) is the APL's own and
[docs/gear-planner.md](docs/gear-planner.md) is the planner's. What is left is
named at the end of each: Import still does nothing, nothing writes to
`localStorage`, and five condition kinds are shown but not editable.

**AND THE FOURTH PASS WAS ASKED FOR AS A MEANS RATHER THAN AN END**, which is
the Gear panel's lesson stated outright by the person it happened to: "in order
to actually optimize the APL I need the tooling to be a bit more sophisticated
as well." **Shipping the thing that makes a fault visible is itself a round**,
and the panel found something in the first list it was pointed at -- 2H Arms'
Sunder Armor entry fires 0.00 times because a preset raid DEBUFF puts five
stacks on the boss before the pull, which is the fourth cause of a never-fired
entry and the one that reads least like a defect.

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

**AND `game/racials`, WHICH IS A SEVENTH LAYER OF THE CHARACTER AND NOT A
TALENT.** `racialBuild` is `talentBuild`'s shape -- a declaration table, a
builder, and `createPlayer` as the only reader -- and deliberately not part of
it: a talent has RANKS and a generated values file, so every effect kind there
carries a `valueIndex` and four talents have been found reading the wrong number
off a multi-value row. **A racial has no row to index into**, which removes the
commonest failure mode in the talent layer by construction rather than by care.
[docs/racials.md](docs/racials.md).

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
| `positioning` | positions, range, facing, movement, "nearby", radius, travel forms | 21 |
| `crowdControl` | stuns, fears, roots, snares, silences, incapacitates, disorients, disarms, **and removing any of them** | 37 |
| `threat` | threat, which is not tracked. Defensive Stance's +30% and Defiance are dropped, not deferred | 13 |
| `healing` | healing THROUGHPUT. **Mana RETURN is NOT out of scope** — it changes a damage profile's sustain, so it is a live gap and gets no `scope` | 37 |
| `stealth` | being stealthed, detecting it, and the openers requiring it — Ambush, Garrote, Cheap Shot. **NOT an in-combat proc that REMOVES a stealth requirement**, which is what Cutthroat is. **NOR an action BREAKING it**, which is now an engine rule | 6 |
| `castPushback` | avoiding, resisting or reducing the interruption or DELAY of a cast or channel from damage taken. **NOT an interrupt the TARGET suffers** — Earth Shock's school lockout is about the enemy casting and is inert for a different reason | 7 |
| `totemEntities` | a totem that BUFFS or HEALS on its own. **NOT a totem that deals DAMAGE**, which Searing Totem proved is expressible as a debuff that ticks | 4 |
| `dispel` | removing a poison, disease, curse or magic effect, **and RESISTING a dispel**, which is the same concept from the other side. **NOT removing crowd control**, which `crowdControl` covers in its own words | 2 |
| `immunity` | an immunity that **also stops the character attacking** — Blessing of Protection, Divine Protection, Ice Block. **NOT one you can attack through**: Forever's Divine Shield reduces your damage 50% instead of disarming you, so it stays a live gap | 3 |

**THE TWO NEWEST MEMBERS CAME FROM ONE QUESTION AND THE ANSWER SPLIT IN TWO.**
`guardian_s_favor`'s own reason ended "whether an immunity that disarms you
belongs in scope is a question for the ruleset owner rather than a gap in the
engine", and asking got both rulings at once. **A reason that names the question
it is waiting on is what makes it askable** — that sentence is the whole reason
this got raised rather than sitting in the queue.

**AND THE IMMUNITY RULING IS THE FIRST ONE THAT A CLASSIC READING WOULD HAVE
APPLIED TOO WIDELY.** Classic's Divine Shield stops you acting; Forever's
"reduces all damage you deal by 50%" and lets you keep swinging. Sweeping it in
would have deleted a usable tank cooldown and called the deletion a decision.
**Read the Forever tooltip before applying a scope, not just the talent's.** The
same check moved Ice Block the other way: its Forever text says "you cannot
attack, move, or cast spells", so it IS covered.

**EVERY FIGURE IN THAT LAST COLUMN IS COUNTED FROM THE DECLARATIONS, NOT
ADJUSTED**, and three of them were wrong when this was written -- positioning by
three, crowdControl by one, stealth by one. Each is the arithmetic failure this
file already documents under **Git workflow**: two branches move a count by one
from the same base, both write the same number, git merges them without a
conflict and the total is short. **So re-count rather than increment**, the same
rule the talent census follows, and the one-liner that does it is a loop over the
nine `*_TALENT_EFFECTS` tables counting `unmodelled` effects that carry a `scope`.

**AND A FOURTH WAS WRONG, WHICH IS THE POINT OF SAYING SO FOR THE SECOND TIME.**
`threat` read 14 against 13 declarations, and the paragraph above had already
claimed every figure here was counted rather than adjusted. It was found by
running that one-liner during the 1.60.1.70170 patch, on a column the patch did
not touch -- so the drift happened at some point after the sentence promising it
could not. HANDOVER's placeholder figure had drifted the same way, 10 against 9.
**A note saying a number is derived is not the same as the number being
re-derived**, which is this file's own recurring failure one level up.

**AND THAT COLUMN COUNTS TALENTS ONLY, WHICH IS NEW AND IS WHY THE ONE-LINER
BELOW IS PATH-SCOPED.** `game/racials` declares `unmodelled` effects against the
same union, so the project-wide total is the two sources added and neither figure
is the other's. Count them apart, because they expire for different reasons: a
talent's reason expires when the ENGINE gains something, and a racial's expires
when the OWNER revisits a trait they declined.

```bash
grep -rhoE "scope: '[a-zA-Z]+'" src/game/racials/ | sort | uniq -c   # 21 declarations
```

**AND THAT GREP IS 21 WHERE THE CENSUS IS 22, WHICH IS NOT DRIFT.** A grep counts
DECLARATIONS and the census counts per RACE, and the two Skyborne races SHARE
three of their four traits -- one declaration each for Walk on Air, Elemental
Insight and Wind Blessed, the arrangement Crusader already uses for its three
weapon slots. So Walk on Air's one `positioning` tag is two entries in the
census. **Said here because two figures that disagree by one is exactly what a
stale count looks like**, and the difference is structural rather than an error
in either.
Adding a member to that union is a scope DECISION and needs the owner, not a
judgement call while writing a class.

**AND A `scope` TAG ON A LIVE EFFECT IS THE QUIETEST MISTAKE AROUND THIS TABLE,
BECAUSE THE TAG'S WHOLE PURPOSE IS TO STOP ANYBODY LOOKING AGAIN.** A ruled-out
effect is deliberately kept out of the live-gap list and shown apart in the Talent
panel -- so tagging something that DOES work, or that has since become
expressible, deletes it from the one list that gets re-read. An ordinary
`unmodelled` reason is counted and re-read; a scoped one is filed as answered.

**AND THE STEALTH-BREAKING RULING IS THE FIRST WIDENING THAT CLOSED NONE OF
THEM, WHICH IS WORTH RECORDING AS AN ANSWER RATHER THAN AS A NON-EVENT.** The
rule below made an action end a stealth window, so the six entries were re-read
on this file's own instruction -- and all six survive, for three different
reasons: **detection** is three of them (Master of Deception, Heightened Senses,
Improved Distract's second clause), **a stealth OPENER this project does not
declare** is two (Garrote and Cheap Shot, named by Opportunity and Initiative
beside clauses that DO apply), and Camouflage is the odd one -- it reduces "your
speed penalty from your Stealth ability and its cooldown", and there is no
Stealth ABILITY here at all: the window is an opening aura, so there is no
cooldown to reduce and the penalty is positioning.
**SO "CHECK THE SCOPE TAGS WHEN A RULING WIDENS SOMETHING" PAID BY RETURNING
SIX NOs.** The check cost one read and the alternative is the Improved Ambush
failure below, which went a whole release.

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
them is a test worth reusing rather than a liberty that was taken. **Seven members
at that point, all of them the owner's** -- NINE now, and see below.

`totemEntities` is still narrower than it sounds: a DAMAGE totem turned out to be
expressible, and Searing Totem is modelled as a debuff that ticks.

**AND THE COUNT ABOVE IS NINE MEMBERS, NOT SEVEN, WHICH THIS FILE SAID FOR
SEVERAL RELEASES.** `OutOfScope` declares nine and the table above has nine rows
summing to **130 entries**. "Seven members, all of them the owner's" was true the
day the Shaman dive's `castPushback` and `totemEntities` were ratified; `dispel`
and `immunity` came later, from the one question whose answer split in two, and
the sentence recording the earlier ratification was left with a total that had
moved underneath it. **BOTH HALVES OF THAT SENTENCE WERE TRUE WHEN WRITTEN AND
ONLY ONE OF THEM EXPIRED**, which is the compound-claim failure this file
documents for `unmodelled` reasons, in prose instead of in a declaration. Count
the union's members and the entries:

```bash
grep -rhoE "scope: '[a-zA-Z]+'" src/game/talents/ | sort | uniq -c   # entries, per member
```

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
- **ENEMY PARRY FOLLOWS THE ENCOUNTER, NOT THE WEAPON IN HAND.** The owner:
  "when the Target Attacks Back checkbox in the Encounter panel is selected, the
  target gains a 14% chance to parry you." It replaces a reading of the source's
  "0% if 1H & Shield is not selected" as a statement about the STYLE -- which
  was right about a shield tank and **wrong in both directions either side of
  it**: the BEAR tanks without a shield and was never being parried, and the
  SHOCKADIN holds a shield against a dummy that never swings and was being
  parried by it. Worth **-51.6** and **+59.7**. `CombatStyleLookup` is gone with
  it, because parry was the only thing it fed.
- **PARRYING HURRIES THE PARRIER'S OWN NEXT SWING.** 40% of a full swing off
  the remaining timer, floored at 20% of a full swing, "to both players and
  mobs, including raid bosses". `engine/combat/parryHaste.ts`. **BOTH FRACTIONS
  ARE OF A FULL SWING AND NOT OF WHAT IS LEFT**: that is what makes it
  converge, because no run of parries can drive a timer to zero.
- **AND IT SHIPPED POINTING THE WRONG WAY, OFF THE OWNER'S OWN SENTENCE.**
  "Successfully parrying an attack reduces the ATTACKER'S remaining swing
  timer" reads as the unit whose blow was turned aside, and that is how it was
  built; the owner means the parrier, who is an attacker in their own right --
  "if I parry an attack MY NEXT ATTACK COMES SOONER." **THE WRONG READING WAS
  SELF-CONSISTENT AND DANGEROUS-SOUNDING**, which is what let it through a
  review and a measurement pass: it made a tank parrying a boss speed the BOSS
  up, which is what a tank is supposed to fear, and every figure it produced
  was internally consistent. **It even produced a finding** -- "parry is worth
  42% of dodge" -- which read as insight and was an artefact. Corrected, the
  two are **0.1598 against 0.1485** and indistinguishable, which is what two
  stats that both avoid the whole blow should be.
  **WHERE IT ACTUALLY BITES IS THE OPPOSITE OF WHERE IT LOOKED.** The boss
  parries 14% of the TANK's blows and the tank attacks far more often than the
  boss swings, so the boss is hurried by the tank's own ATTACKS rather than by
  its defence -- and several parries land inside one boss swing cycle, which
  drives it to the 20% floor. Its minimum gap is **480ms** where the wrong
  direction gave 1,440ms.
- **AND IT HAS TO BE SCHEDULED, NOT APPLIED INLINE -- THE FIRST VERSION FIRED
  EXACTLY ZERO TIMES.** A swing's handler resolves its blow and only THEN
  schedules its successor, so at the moment `dealDamage` sees the parry the
  handle on the combatant is the swing that is CURRENTLY FIRING, with no time
  left on it; the real next swing is scheduled at full speed a moment later.
  **SIX UNIT TESTS PASSED THROUGHOUT**, because a test that calls `dealDamage`
  by hand at a chosen moment DOES leave a real future swing pending -- the one
  case the live path never presents. What caught it was measuring the
  mechanism's own quantity: three tank profiles took **25.5 attacks a fight
  before the change and 25.5 after it**. One `events.schedule` at the current
  timestamp is the fix, and it is the same fix for the same reason
  `extraAttack` schedules rather than swinging inline.
- **ARMOR CAPS AT 75% PHYSICAL REDUCTION, AND THE CURVE CANNOT REACH IT.**
  The owner's ruling, and `MAXIMUM_ARMOR_REDUCTION` in `ratings.ts` is it.
  `armor / (K + armor)` is an ASYMPTOTE -- it approaches 1 and arrives at
  nothing -- so **a missing ceiling on a curve like that leaves no trace at
  all**: no flat figure anywhere to be wrong about, nothing that reads too
  large, nothing to notice. At level 63, where K is 5,755, it binds at
  **17,265 armor**.
  **IT WAS UNREACHABLE UNTIL ONE COMMIT MADE IT REACHABLE.** The highest armor
  in the project was the Protection Warrior's 7,864 -- 57.74%, seventeen points
  clear -- and Dire Bear Form's multiplier took the Bear to 16,753 in a single
  change. **A rule that is worth nothing today is worth landing when the thing
  that would reach it lands**, which is the opposite of the usual argument for
  deferring one.
  **CLAMPED ON THE MULTIPLIER, NOT THE REDUCTION**, so the floor is `1 - 0.75`
  and at least a quarter of every blow comes through. **And AFTER armor
  penetration**, which falls out of where the clamp lives rather than needing a
  rule: `penetratedArmor` reduces the armor and this clamps the reduction THAT
  produces. Clamping first would hand a penetrating attacker the full cap and
  make penetration worthless above it.
- **CRUSHING BLOWS ARE FLAT, AND DEFENSE SKILL REACHES THEM ONLY THROUGH THE
  WALK.** The owner's ruling: "Defense CAN reduce crushing blow chance, but only
  indirectly. By obtaining so much of the avoidance stat above crushing blow in
  the combat table to the point that it 'pushes crushing blows off the table'."
  So `crush` takes no `fromDefense` while miss, dodge, parry, block and crit all
  do, and `melee-received` resolving in that order is the entire mechanism --
  once the four above crush fill the roll space, no roll can reach it.
  **IT IS VISIBLE IN THE TWO SHIELD TANKS.** The Protection Warrior's avoidance
  and block come to **95.9%** of the table and it takes **2.0%** crushing blows;
  the Protection Paladin's come to **75.0%** and it takes **12.7%**, on the same
  flat 15%. Neither has crush reduced; one has it squeezed.
  **AND A GROUPING COMMENT MANUFACTURED THE APPEARANCE OF A BUG.** The note
  above the table called `bossMiss`, `bossCrit` and `bossCrush` the same kind of
  flat figure and then two of the three were adjusted -- which is this file's
  own "two of three reproducing and the third moving is the shape of a bug", so
  the CORRECT implementation was raised as a defect. **A sentence that groups
  things the code then treats differently is a trap**, and the fix is at the
  grouping as much as at the line. `attackChances.test.ts` pins the ruling now,
  because **a ruling that is only prose gets re-raised** -- this one already was.
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
- **`isWeaponUseOf(attack, 'ranged')` WAS ALWAYS FALSE, FOR EVERY ATTACK,
  FOREVER.** `isWeaponUse` means "a use of a MELEE weapon" -- Thunder Clap,
  Intercept and Charge declare `weaponSlot: 'ranged'` precisely so it excludes
  them -- so the composed predicate read `(mainHand || offHand) && ranged`. It
  compiled, it is the obvious thing to write, and the Hunter's Deadly Aspects
  asked it on every Auto Shot: **403 ranged swings over twenty fights, zero
  procs of a stated 10%.** The parameter is `MeleeWeaponSlot` now, so the type
  refuses the question instead of answering it wrongly, and narrowing it found
  two more callers passing a wider type than they ever use. **A predicate that
  is always false reads exactly like one that is sometimes true**, which is why
  a proc wants a measured RATE and not only a unit test on its branch.
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
- **PPM IS THE OWNER'S EQUATION, AND `PPM` IS A VARIABLE IN IT RATHER THAN A
  CEILING:**

      % chance to proc = PPM * baseweaponspeed / 60

  `ppmChance` is it, and `procs.test.ts` pins it in that form rather than in the
  order the function computes. **BASE speed, so haste raises the delivered rate**
  while leaving the per-use chance alone — the same reading `rageFromSwing` takes
  of "base speed before any modifiers".

  **THE VARIABLE-OR-CEILING QUESTION IS ANSWERED AND IS WORTH NOT RE-ASKING.**
  The two readings agree while only auto-attacks roll and diverge the moment
  anything else does: every weapon USE rolls, and only a swing costs swing time,
  so specials and extra attacks are free rolls. An Enhancement shaman makes about
  35 melee uses a minute and **5 PPM delivers about 11 procs a minute, which is
  the intended consequence of the equation** rather than a figure to explain away.
  Nothing in the engine throttles a rate, and nothing should.
- **A `dealt` REACTION FIRES PER DAMAGE EVENT, SO A RULE PHRASED PER ABILITY
  *USE* NEEDS SOMETHING TO KEY ON.** Mutilate deals two, and the owner has ruled
  that Seal Fate "can now NO LONGER give 4 combo points -- if either hand crits,
  Mutilate gives 3", so the opportunity belongs to the USE. `Combatant.castSequence`
  is that fact: `recordCast` stamps every cast with a number and the reaction's own
  closure remembers the one it last fired on. **Mutilate's own award already worked
  this way** -- "two points for the ability, not one per hand" -- so the cap is the
  same reading applied to the proc rather than a new convention.
  **NOT THE TIMESTAMP**, which is the tempting discriminator and is incidental:
  the two hits share a millisecond because they are dealt synchronously inside one
  `onCast`, and nothing guarantees it. **AND NOT A BOOLEAN LATCH**, because
  something would have to clear it and that something is the next bug -- a latch
  nobody cleared would make Seal Fate fire once a FIGHT, which is a smaller number
  and no error. **The closure is only safe because `talentBuild` builds a reaction
  PER CHARACTER**, the same reason Windfury's internal cooldown can live in one;
  a module-level variable would make one Rogue's Mutilate suppress another's.
  **STAMP IT BEFORE `onCast` AND BEFORE `runCast`'S EARLY RETURN** -- a reaction
  asking which use it is seeing fires from INSIDE `onCast`, and a character with
  no CAST reactions takes a different path out of that function.
- **A reaction fires on damage; a CAST reaction fires on a cast.** A finisher
  spends its combo points inside its own `onCast`, where neither the cost system
  nor a damage reaction can see it. `AbilityCastEvent` carries what the cast
  SPENT, **measured by snapshotting every pool around it** — measuring rather
  than asking each ability to declare is the point, because the ability that
  forgot would be silently inert.
- **AN EXTRA ATTACK COMES IN TWO SHAPES AND THEY ARE DIFFERENT EFFECTS.** Both
  say "grants extra attacks" and only one is a SWING.

  | | an extra SWING | an extra SPECIAL ATTACK |
  | --- | --- | --- |
  | who | Windfury TOTEM, Hand of Justice, Weaponmaster | Windfury WEAPON, the imbue |
  | how | `extraAttack`, which completes the swing now and **restarts the slot's timer** | content schedules its own `dealDamage` |
  | table | `melee-auto` — one roll, and a GLANCING BLOW | `melee-special` — two rolls, **no glance** |
  | reported as | "Main Hand Auto-Attack" | its own row |

  **THE TOTEM'S SHAPE WAS BORROWED FOR THE IMBUE AND WAS WRONG IN FOUR WAYS AT
  ONCE**, every one of them in the generous-or-mistaken direction and none of them
  visible: the glancing blows cost 15.8 DPS, the attack power arriving as a
  1.5-second AURA instead of inside the hits cost 18.8 and also paid any swing or
  Stormstrike landing in the window, the timer reset threw away about one real
  swing a fight, and the damage was invisible inside the auto-attack line. The
  owner separated them on 2026-10-07. **Two effects described with the same words
  are not therefore the same mechanism** — and `buffs/windfury.ts` stays on the
  old shape on purpose, because that one the owner stated directly.
- **ATTACK POWER CAN BELONG TO ONE HIT RATHER THAN TO THE CHARACTER.**
  `WeaponScaling.bonusAttackPower` is the imbue's 333: it goes through
  `speed / 14` with the character's own power and reaches nothing else. **A buff
  aura is the wrong shape for "with N extra attack power"**, because a window pays
  whatever lands inside it and the phrase names the attacks.
- **A REACTION'S OWN DAMAGE MUST BE SCHEDULED, NOT DEALT INLINE, IF ANYTHING IS
  MEANT TO PROC OFF IT.** `runReactions` claims a per-actor lock, so `dealDamage`
  called from inside a reaction reaches no `dealt` reaction at all. One
  `events.schedule` at the current timestamp puts it back on the ordinary path —
  which is why `extraAttack` schedules too. Windfury's special attacks have to
  feed Maelstrom Weapon, and dealt inline they silently would not.
- **A `dealt` REACTION NEVER SEES A TICK, AND AN EXCEPTION TO THAT NEEDS ITS OWN
  TRIGGER.** `dealDamage` runs `dealt` and `taken` only for damage that
  consulted a combat table and is not periodic -- "a bleed ticking is not an
  attack anyone parries" -- and every one of the project's forty-odd reactions is
  written against that, so widening it is not available. `ReactionTrigger` has a
  third member, `periodicDealt`, which a reaction has to ASK for; nothing that
  existed declares it, so adding it changed no behaviour at all.
  **THE ONE CALLER IS THE OWNER'S OWN EXCEPTION, AND THE TWO HALVES OF IT NEED
  TWO DIFFERENT MECHANISMS.** DoTs and channels proc Touch of the Grave "only on
  cast not each tick", excepting Arcane Missiles and Consecration. Arcane
  Missiles needs nothing: a CHANNEL's ticks are not periodic, so each missile is
  already an ordinary non-periodic damage event and what the exception overrules
  is the per-channel rule. **Consecration deals nothing at all on its cast** --
  it applies a ground aura that ticks -- so through `dealt` a Paladin's only area
  spell could never have procced, and the exception would have been silently
  absent on a racial whose every other clause was implemented. **Two exceptions
  in one sentence can be exceptions to two different rules.**
- **A PURE DoT EMITS NO DAMAGE EVENT FOR A PROC TO READ, AND "ON CAST" IS NOT
  "ON THE CAST'S DAMAGE".** Touch of the Grave is "spells and attacks with a
  damage part", with the owner's rule that DoTs proc "only on CAST not each
  tick" -- and it was built to read the DAMAGE, so Corruption, Bane of Agony and
  Siphon Life, which only apply an aura, never rolled at all. **The owner found
  it by arithmetic**: 21.6 damage-dealing casts a minute against 1.17 procs
  where 10% is 2.16, on the one build whose core is DoTs. (**The 10% and 5% are
  historical**: a patch took them to 30% for casters and 20% for Paladins,
  Rogues and Warriors with a **25 second** internal cooldown where it was 1 --
  so the COOLDOWN is now the binding constraint on every class rather than the
  rate, the ceiling is two or three procs a fight for any build, and the class
  split decides how fast a window is claimed rather than how many there are.
  The arithmetic above is the method and not the figures.)
  **THE FIX IS A DAMAGE HALF AND A CAST HALF SHARING ONE CLOSURE**, which is
  exactly the shape `judgementOfWisdomReactions` already had -- and whose own
  comment names Corruption as the case it exists for. The damage half records
  the INSTANT it rolled and the cast half refuses when a roll was already taken
  at that instant, because `runCast` runs `onCast` before the cast reactions.
  Without the dedupe, Immolate -- direct damage AND a DoT in one instant --
  would sit at 19% where Corruption is at 10%, and both figures read as ordinary.
  **"HAS A DAMAGE PART" IS ANSWERED BY ASKING THE AURAS**: on the TARGET, with
  `periodic`, applied at THIS instant. A flag on `Ability` is the shape where
  the one that forgot is silently inert, and an EXCLUSION list -- which the
  owner's "like demoralizing shout" wording invites -- fails the generous way,
  which is worse.
- **A PROC CAN SIT ON A WEAPON AND TRIGGER OFF SOMETHING THAT IS NOT A WEAPON
  USE AT ALL.** Enchant Weapon - Revelation goes on a MELEE weapon and fires
  "when a non-periodic spell fails to critically strike" -- so it takes a flat
  chance rather than `ppmChance`, and it asks which TABLE resolved the attack
  rather than which slot swung. `AttackEvent.attackTable` exists for that
  question: nothing else on the event can answer it, because `weaponSlot` is
  undefined for a spell AND for a seal AND for Thunder Clap's ranged table.
  **ITS BUFF IS A STAT, AND THE STAT IS WHAT SCOPES IT.** "Your next SPELL" is
  a set `abilityModifiers` cannot name -- the catch-all reaches melee abilities,
  and this enchant is on a melee weapon, so a Shockadin's Holy Strike would have
  taken a crit meant for its Holy Shock. `spellCritChance` IS that scope, so a
  hundred points of it is a guaranteed crit on a spell and worth nothing to a
  swing, with no new engine field.
  **THE TRIGGER IS A SPELL AND NO KIND OF ATTACK, CONFIRMED BY THE OWNER IN
  THE TERMS THAT EXPLAIN THE SHAPE**: "a spell doesn't use a weapon. Whereas
  something like Crusader procs from attacks and that's what drives it having a
  PPM-based proc system." So the flat chance is not a simplification -- PPM
  needs a weapon SPEED and a spell has none, which is why this is the one proc
  in `procs.ts` that does not call `ppmChance`.
  **VERIFIED ON A HYBRID AND NOT ONLY ON A MAGE**, because a Mage fixture has
  no melee ability and cannot express the mistake. Over 30 fights a Shockadin's
  reaction is asked about **329 auto-attacks and 99 Holy Strikes and fires on
  none of them**, and fires only on Judgement, Holy Shock and Hammer of Wrath.
  A Cat Druid, which casts nothing on the spell table, procs **0 times in 617
  asks** -- a correct effect worth exactly nothing to a build.
  **AND A TALENT CAN TURN AN ABILITY FROM A SPELL INTO AN ATTACK AND STOP IT
  PROCCING**, which is the rule's sharpest consequence and needs no code:
  `hammerOfWrathTable` returns `ranged-special` once Instrument of Law has made
  Hammer of Wrath instant and `spell` otherwise, so the Shockadin's procs
  Revelation and the Retribution Paladin's does not.
  **ONE ROLL PER HAND, ON THE OWNER'S RULING**, which is Crusader's arrangement
  reached from the opposite direction: Crusader is per-hand because only a use
  of THAT weapon triggers it, and Revelation is per-hand because the owner said
  so -- the enchant is on each weapon and each one rolls. Two enchanted hands
  make the per-spell probability `1 - (1 - p)^2`, and the reaction ids carry
  the slot so nothing is left unable to say which fired.
  **AND IT READS THE EFFECTIVE PER-SPELL CRIT, ALSO ON THEIR RULING, WHICH
  EXPOSED A BUG IN THE CHARACTER SHEET.** Asked whether
  "CharacterSpellCritChance" meant the sheet figure or the effective one, they
  said effective -- and added that a sheet reading 10.82% was "likely missing
  proper calculation". **IT WAS**, and see the Verifying work section: the
  panel printed the raw stat and ignored `critRating` in both crit rows, on all
  28 profiles.
  `AttackEvent.critChance` IS WHAT IT READS NOW -- the slice the roll actually
  faced, after the rating, the per-ability crit, the per-school crit, the
  per-table crit and the target's contribution. **So two spells on one
  character can have different rates**: a Fire Mage's Scorch carries Improved
  Scorch's crit and its Fireball does not, so Revelation is rarer off the
  Scorch. That follows from the tooltip rather than being a special case.
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
- **A HUNTER CARRIES A QUIVER AND AMMUNITION, AND NEITHER IS AN EQUIPMENT
  SLOT.** The owner's ruling, so both live in `game/character/hunterRanged.ts`
  rather than in a gear set: the quiver DIVIDES the ranged swing timer by 1.15
  -- their own example is `2.9 / 1.15 = 2.5217`, and `x 0.85` is a 2% faster bow
  and a plausible wrong number -- and ammunition adds `16.5 x BASE bow speed` to
  `baseDamage`, before attack power and before any ability's own flat damage.
  **NEITHER TOUCHES `powerCoefficient`**, which is base speed over fourteen: a
  faster bow fires more often for the same attack power per shot, and
  recomputing the coefficient from the shortened timer would quietly cut every
  Hunter's scaling by 13%. **Ammo is a DPS, so it needs a SPEED to become a
  per-shot figure, and which speed is the whole question** -- the base one lets
  the quiver multiply ammo too, which is what the wiki's own
  `AmmoDPS x WeaponSpeed + (RAP / 14 x WeaponSpeed + ...)` says by using one
  symbol for both terms.
- **A DRUID'S PAW IS BUILT FROM THE WEAPON BEING HELD**, and Druids are exempt
  from normalisation because a paw is already one shape: `BasePaw + weaponDPS ×
  formSwing + AP × formSwing / 14`, times `rand(0.8, 1.2)`, with the form's
  swing being 1.0 for a cat and 2.5 for a bear. A stat stick never SWINGS and
  still feeds the paw's damage through its DPS — but **NOT through its speed**.
  The other reading of the owner's formula, where the held weapon's speed is the
  multiplier, put Cat at 988.8 and Bear at 909.2 and made paw damage
  proportional to how SLOW the held weapon was; it was rejected on measurement.
- **`BasePaw` IS 1 FOR BOTH FORMS, STATED BY THE OWNER, AND IT HAD BEEN ASSUMED
  AT 100 AND 50.** So the paw is the held weapon's dps and the Druid's attack
  power and essentially nothing else — **the form contributes a CADENCE rather
  than damage of its own**, which is a statement about where a feral Druid's
  damage comes from and not just a smaller number. The assumed figures were
  about a fifth of every paw swing (50 of the Cat's 245.1, 100 of the Bear's
  511.1), so two profiles were carrying a sixth to a fifth of their damage on a
  number nobody had supplied: **Cat 937.7 → 843.0 and Bear 523.1 → 433.6**.
- **AND THE SHARE A PAW CHANGE MOVES IS THE SHARE THAT GOES THROUGH
  `weaponScaling`, WHICH IS NOT THE SAME AS "the feral abilities".** The Bear
  lost 17.1% and the Cat 10.1% from the same ~20% cut to the same term, because
  **the Bear is 85.9% paw** (Maul, autos, Primal Bite) **and the Cat is 54.6%**
  (autos, Shred) — Rip at 35.3% and Rake at 10.1% carry their own coefficients
  and never touch it. `20.0% × 54.6%` predicts 10.9% against a measured 10.1%,
  and `19.4% × 85.9%` predicts 16.7% against 17.1%.
  **THE COMMENT NAMING THOSE ABILITIES WAS WRONG, AND IT WAS THE OBVIOUS PLACE
  TO GO FOR THE ESTIMATE.** `weapons.ts` listed "Shred, Claw, Maul, Primal Bite,
  Lacerate"; Lacerate is a pure stacking DoT with no weapon damage at all, so
  anyone pricing a paw change off that list would have expected the Bear to lose
  all of its 14.1% Lacerate share too. **Read `weaponScaling` rather than a
  prose list of which abilities use the weapon.**
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
- **AND THE LAST TWO ARE INDEPENDENT MARKERS: A COMBO-POINT ROW WITHOUT
  `per tick` IS A DURATION TOTAL.** Rip's row is `4%*combo point spent` and
  carries no per-tick marker, and it was implemented per tick on a SIX-tick
  effect -- `0.04 x 5 x 6` is **120% of attack power at five points instead of
  20%**, six times the stated figure, and it was **35.3% of the Cat's damage**.
  Fixing it is **-179.7, -21.3%**, and it took the Cat from the highest profile
  in the project to sixth. The owner settled it on sight: "per combo point spent
  over its duration NOT each tick".
  **THE WRONG READING SURVIVED IN THE CONSTANT'S NAME.**
  `RIP_TICK_AP_COEFFICIENT_PER_COMBO_POINT`, with a comment restating it -- and
  the comment also said "its EIGHT ticks" where there are six, so the figure
  that would have exposed it was wrong in the same sentence that asserted it.
  **Name a coefficient for what the SHEET says, not for where the code applies
  it**, because the name is what the next reader checks instead of the row.
- **AND THE STRUCTURAL TELL WAS ONE EFFECT RUNNING ON TWO CONVENTIONS.** Rip's
  flat damage was a duration total divided by its tick count while its
  coefficient was per tick -- so **a reader checking either half ALONE would
  have found it self-consistent**, which is why an audit could not see it and the
  owner could. Both halves divide by one named `RIP_TICK_COUNT` now, which is the
  cheap structural guard: **when a DoT carries flat damage AND a coefficient,
  check the two are stated in the same unit before trusting either.**
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
- **MELEE AND RANGED MISS 8% AGAINST A LEVEL 63 TARGET, NOT 9%, AND THE
  DERIVATION HAD IT WRONG FOR THE WHOLE PROJECT.** The owner's note -- "the new
  melee and ranged attack miss chance against a level 63 target is now 8% not
  9%" -- restores a figure their own combat table always stated:
  `BASE_CHANCES.meleeMiss` was 8 before the table was derived from weapon skill,
  and the commit that derived it gave the large-gap regime a SECOND, higher base
  (6% against 5%) which made it 9%. One base of 5% with the per-point rate
  doubling past a 10-point gap gives 8% at the 15-point gap every profile faces.
  **So only the PER-POINT rate changes regime, not the base.**
- **AND THAT COMMIT WROTE THE DISCREPANCY DOWN RATHER THAN QUESTIONING IT.**
  `docs/combat-tables.md` read "the formulas are consistent with the constants
  they replace; only miss moves, from 8% to 9%" -- dodge's 6.5% and glance's 40%
  reproduced exactly and miss alone did not. **Two of three figures reproducing
  and the third moving by a point is the shape of a bug**, and it sat as a note
  about the formula for a year. **A DIFFERENCE THAT GETS DOCUMENTED STILL NEEDS
  SOMEBODY TO CALL IT WRONG**, which is the same failure as a `PLACEHOLDER_` that
  everybody reads and nobody asks about.
- **THE USABLE MELEE AND RANGED HIT CAP IS THEREFORE 8**, and unlike spells
  **melee and ranged have NO miss floor** -- the owner stated the 1% floor for
  spells and `missFromSkill` is a different formula. So the ninth point of hit
  buys a non-dual-wielder literally nothing, and **six of the 25 profiles sit at
  exactly 0.00% melee miss**. A DUAL-WIELDER is the exception that keeps hit
  valuable: the +19% penalty lands in full on both hands, so a Rogue still misses
  9-14% and collected the whole point.
- **SO "IT IS A MELEE PROFILE" DOES NOT PREDICT THAT A MISS CHANGE MOVES IT.**
  Cat and Bear Druid measured **0.0 to the decimal** on a change to the melee
  miss table, which reads exactly like a change that failed to apply -- they
  carry 9% and 11% hit against a single paw with no dual-wield penalty, so their
  melee attacks could not miss before the change either. **Check hit against the
  cap before treating a zero as a bug**, and measure the MISS RATE off the event
  stream rather than computing it: that is the only reading that accounts for the
  dual-wield penalty, per-hand skill and school-scoped hit at once.
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
- **AND A PATCH NOTE IS A LATER STATEMENT, WHICH IS THE THIRD ONE.** The
  1.60.1.70170 notes read "Fixed a bug causing Swipe to not scale with Attack
  Power. It will now correctly gain 3% of the Druid's attack power", and
  `WoWSimWorksheet.xlsx` says 10%. **The sheet records what the figure was meant
  to be before the fix landed and the notes record what shipped**, so the notes
  win and `SWIPE_AP_COEFFICIENT` says so beside itself — a refresh of the sheet
  will not carry it and a reader who knows the sheet would read 0.03 as drift.
  **IT MOVES NO PROFILE AND IS STILL WORTH DOING**: Swipe is in no priority list,
  because every encounter here has one target, so what changes is what the number
  MEANS the day a multi-target encounter exists.
- **AND A MEASURED SLOPE IS NOT THE COEFFICIENT -- IT IS THE COEFFICIENT TIMES
  EVERYTHING BETWEEN IT AND THE DAMAGE EVENT.** Measuring Ice Lance's over two
  spell powers gave 0.1136 against a declared 0.1071, a clean 1.06x, and that 6%
  is PIERCING ICE at 3/3 on the build being measured. **The obvious conclusion
  was that the transcription was wrong, and what was wrong was the
  measurement** -- so divide the school multiplier back out and NAME it rather
  than widening a tolerance until it passes, which hides the one term in the way.
  **A RATIO NEEDS NONE OF THAT**, because every such term appears on both sides
  and cancels: Ice Lance's frozen-to-unfrozen ratio is exactly its frozen
  multiplier whatever else is applied, which makes it the assertion to trust
  most. (It was 4 when this was written and is 3 now -- **the ratio is the
  assertion to trust and the FIGURE in it is still a dated claim**, which is
  this file's own rule about a derived number pointed at its own example.)
- **A COEFFICIENT STATED AS AN EXPRESSION IS KEPT AS ONE, AND THE OWNER'S
  DIVISOR IS A DIFFERENT NUMBER FROM THE MULTIPLIER NEXT DOOR EVEN WHEN THEY
  MATCH.** Ice Lance's is `1.5 / 3.5 / 3` in the owner's own words, written out
  rather than rounded because `1.5 / 3.5` does not terminate and the old 0.43
  was already a rounding. **It sits beside `ICE_LANCE_FROZEN_MULTIPLIER`, which
  is ALSO 3** -- so a frozen cast carries `1.5 / 3.5 / 3 * 3`, exactly the
  figure the spell had unfrozen before any of it. Reading the owner's divisor as
  having already done the frozen division, or applying the multiplier twice, are
  NINE apart and both plausible, so the guard is a test that multiplies them out
  end to end -- the same argument the pet's 1.375 makes, because a constant
  check cannot see a double application.
  **THEY HAVE NOW MATCHED, DIVERGED AND MATCHED AGAIN, AND THAT IS THE WHOLE
  LESSON.** Both were 4; a patch moved the frozen bonus to 3 and said nothing
  about the coefficient, which left the divisor at 4 on this file's rule that
  **a statement of a VALUE does not overturn a separate ruling about which terms
  a multiplier reaches**; the owner then said "Ice Lance was changed to use
  1.5/3.5/3". **The rule is still the right default and it was the wrong
  answer**, and what made that recoverable in one message was the reading being
  LABELLED as a reading, with both figures and a negative assertion pinning the
  alternative. See below.
  **AND THEY STAY TWO CONSTANTS RATHER THAN ONE DERIVED FROM THE OTHER.**
  Writing `1.5 / 3.5 / ICE_LANCE_FROZEN_MULTIPLIER` would have moved the
  coefficient on nobody's authority at the patch that separated them -- and
  `game/combat` cannot import `game/abilities` in any case. **Pin each by
  IDENTITY rather than asserting they are equal**, which is
  `critRageMultiplierFor`'s arrangement and is what stopped the last divergence
  failing in the constant that did not move.
- **"BEHIND THE TARGET" IS ASSUMED, EXCEPT WHEN THE TARGET ATTACKS BACK**, and
  that one ruling overturned FOUR written-down caveats at once. The owner, giving
  Ravage: "You do NOT need to scope in behind the target positioning. **Once
  again this should be assumed in all cases EXCEPT when 'Target attacks back' is
  checked.**" Shred, Backstab and Ambush each carried an `unmodelled` entry
  saying the position "is dropped ... and is not pretended to be met", and the
  Cat's own list called the drop "generous to the build".
  **THE BEHAVIOUR NEVER CHANGED AND THE NOTES WERE WRONG**, which is the shape
  this file keeps recording: all three abilities always dealt their damage, and
  what the caveats did was tell a reader the build was getting something it had
  not earned, while three `unmodelled` entries inflated the gap census with a
  decision. **A caveat that apologises for the engine can be wrong about the
  RULESET**, and nothing in the code contradicts it.
  **THE EXCEPTION IS NOT BUILT, BECAUSE NOTHING REACHES IT.** A character whose
  target swings back stands in FRONT of it -- that is why the encounter grants
  the target 14% parry -- so a behind-the-target ability should be refused on
  such a build. No engine field carries `targetAttacks`: it is baked into the
  chance provider and into whether the enemy has a rotation. Every profile that
  can cast one of these sets `targetAttacks: false`, so a gate would be
  unreachable, and `positioning.test.ts` ASSERTS that instead -- which is the
  `isWeaponUseOf(attack, 'ranged')` guard applied to a rule rather than a
  predicate. **The day a tank build takes Shred, that test fails and the gate
  becomes worth building.**
  **AND IT UNBLOCKED A WHOLE OPENER**, which is why it is here and not only in a
  caveat: the Cat's Ravage was refused as unimplementable on the reading that
  "must be prowling AND behind the target" was `stealth` plus `positioning`, two
  `OutOfScope` members. Neither half held -- the owner had already ruled Ambush's
  stealth requirement modellable as an aura a cast reads, and `PROWL` is that
  shape exactly. **When a ruling WIDENS what is modelled, the scope tags are the
  first place to look**, and this is the second time that sentence has paid.
- **A COEFFICIENT PICKS ITS POOL BY SCHOOL, AND THAT IS RIGHT EXCEPT ONCE.**
  `scaleByPower` reads attack power when `isPhysical(school)` and spell power
  otherwise, which is what lets one field serve every ability here. A FIRE
  ability that scales with ATTACK power is outside it, and the Hunter's two
  traps are exactly that: "Immolation Trap and Explosive Trap now scale with 5%
  of your Attack Power" written as `powerCoefficient` would have read the
  Hunter's SPELL power -- **close to nothing, so the traps would have gained
  almost exactly zero, kept an ordinary damage row, and looked implemented.**
  `DamageRequest.attackPowerCoefficient` is the field, added ALONGSIDE rather
  than instead of, and it reads the MELEE pool because a trap is not a weapon
  use and has no slot to read. **A silent near-zero is why this is a field and
  not a number written into the wrong one.**
- **AND THAT NOTE REVERSED THE OWNER'S OWN RULING**, which both traps were
  declared under -- "there isn't an AP or SP scaler, all the information should
  be known already" -- so both carried `powerCoefficient: 0` on that authority.
  A note is a later statement and wins, the same reading that gives Swipe 3%
  against a sheet saying 10%. The SPELL power half of the ruling stands, which
  is why the tests push the two pools separately.
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
- **"CANNOT CRIT" IS NOT WHAT OMITTING `critFrom` SAYS, AND THE TWO READINGS
  LOOK IDENTICAL.** `critFrom` governs an attack with NO table -- a periodic
  tick, which rolls for a crit and nothing else -- so leaving it off is how a
  TICK is made unable to crit. An attack that DECLARES a table takes its crit
  from that table, and the spell table's crit slice IS the caster's
  `spellCritChance`. Touch of the Grave is the first thing in the ruleset that
  needs both at once -- the owner's "uses the Spell Cast Combat Table" AND
  "cannot crit" -- and it shipped as a bare absence of `critFrom`, which is the
  obvious thing to write. **A test handing the caster a hundred points of crit
  found 200 crits in 200 drains.** `DamageRequest.cannotCrit` is the field, and
  it zeroes the slice AFTER every modifier for the reason `NO_CHANCES` already
  records: `applyAbilityModifiers` ADDS a talent's `abilityCrit` to whatever the
  provider returned.
  **AND THE FIRST VERSION OF THAT TEST AGREED WITH THE BUG**, because it built
  the `DamageRequest` by hand and omitted the flag exactly as the reaction did.
  **A test that reconstructs the thing under test will reproduce its mistakes**
  -- drive the real reaction and read the event stream.

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
- **AND A FIFTH, WHICH IS THAT AXIS POINTING THE OTHER WAY.**
  `AuraDefinition.nonPeriodicDamageMultiplier` is Eureka!'s "+10% damage;
  periodic effects get nothing from it". **AN AURA FIELD WHERE GENESIS IS A
  COMBATANT SCALAR**, which is the whole reason it is not one more argument to
  that one: Genesis is a talent and lasts as long as the character, and Eureka!
  arrives and goes. (It was THREE CHARGES until a patch made it an 8 second
  window with none, which **deleted a mechanism rather than adding one**: the
  charges needed a `dealt` marker plus a `final` cast reaction, because "a
  damaging ability" cannot be read off a declaration -- Rupture and Serpent
  Sting both declare a table and deal no direct damage. A window pays whatever
  lands inside it and nothing has to decide what counted.)
  **`abilityModifiers: { '*': ... }` IS THE NEAR MISS.** It selects every
  ability correctly and `abilityModifierFor` is never told whether the damage is
  a TICK -- and a tick carries its ability's id, so the catch-all finds it.
  Ignite, Pyroblast's burn and every Corruption tick inside the window would
  have collected it: a bigger number and no error.
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
- **AND IT HAS NOW GONE THE OTHER WAY TOO, WHICH MAKES IT A RULE ABOUT WHO
  DECIDES RATHER THAN ABOUT WORDINGS.** Rend and Tear's stated 1.09x WIDENED a
  talent past the abilities-or-weapons rule; Predator's Edge NARROWS one inside
  it. "Increases your melee critical strike damage" says neither "abilities"
  nor "weapons", so the rule gives it the swing -- and the owner ruled that it
  "does NOT affect the hunter's auto-attack swings, unless it was upgraded to a
  Raptor Strike on next hit. This functions very similarly to warrior's Impale
  talent and Heroic Strike."
  **THE EXCEPTION THEY NAMED COSTS NO CODE, WHICH IS THE PART WORTH KEEPING.**
  An on-next-swing ability REPLACES the swing and declares
  `attackTable: 'melee-special'`, so "the swing, but only when it was upgraded"
  and "a special" are the same set. A version that put `melee-auto` back with
  an exception bolted on would pass a declaration-only test, which is why the
  test pins Raptor Strike's own two fields instead.
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
- **MOVING AN AURA FROM THE CASTER TO THE TARGET IS TWO CHANGES, AND THE SECOND
  IS REPORTING.** `AuraInstance.isDebuff` reads the DEFINITION rather than asking
  who holds the aura, so an enemy aura that does not declare it lands on NEITHER
  table: `buffUptime` reads friendly actors and `debuffUptime` filters on the
  flag. Shadow Weaving moved sides and applied, stacked and multiplied the damage
  correctly while reporting nothing at all -- the inert-buff-with-visible-uptime
  shape with the UPTIME missing instead of the effect.
  **THE REPORTING SPLIT IS WHAT CAUGHT IT**, which is the one piece of luck: the
  old test looked for the aura in `buffUptime` and failed, where a single table
  reading every actor would have passed on the wrong side and said nothing. **So
  when an aura changes who carries it, `isDebuff` changes with it**, and a test
  that names the TABLE is what proves which side it is on.
- **`ALL_ABILITIES` COUNTS ON AN AURA TOO, and did not until Shatter needed it.**
  `AuraCollection.abilityModifierFor` looked the ability id up EXACTLY, so an aura
  declaring `{ '*': ... }` compiled, applied, reported its uptime and changed
  nothing about any cast -- Berserk introduced the field with a NAMED ability and
  never exercised the catch-all. `pick` is the ONE shared implementation of that
  fold now, because it was written out per site and the third copy is where it
  drifted. It also carries the double-count guard: asking for `'*'` must return
  the catch-all once, or a talent granting +20% reads back as +40%.
- **A GENERAL FIELD READ BY ONLY SOME OF ITS RULES IS SILENT IN THE REST, AND
  THIS HAS NOW HAPPENED TWICE.** `AuraDefinition.resourceRegenMultiplier` is
  documented as multiplying "the carrier's REGENERATION of a resource" and was
  wired into ONE of the three regeneration rules -- energy, for Adrenaline Rush
  -- so an aura declaring `{ mana: 16 }` compiled, applied, reported its uptime
  and changed nothing. Evocation measured a ratio of exactly 1.0000. All three
  rules go through `regenMultiplierFor` now, focus included, which nothing
  multiplies today. **When a field is added for one caller, wire every rule of
  its kind or the second caller finds a silent no-op.**
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
- **ONE SPELL CAN COUNT AS TWO SCHOOLS, AND SUMMING THEM DOUBLE-PAYS A TALENT
  THAT NAMES BOTH.** `DamageRequest.countsAsSchools` is Frostfire Bolt's "counts
  as both Frost and Fire damage", and it reaches the CASTER'S school talents
  only -- `school` stays single because every other step wants one answer.
  **The two kinds of field combine differently**: a damage multiplier
  MULTIPLIES, because Fire Power and Piercing Ice are different talents and
  both apply; crit, crit damage and hit take **the LARGER**, because an additive
  bonus naming both schools is ONE source and the collection cannot tell it from
  two. Elemental Precision is that source, and summing put a Frostfire Bolt's
  measured miss at 5.26% against an expected 10%. School-scoped `spellPower` is
  excluded on purpose: it is a POOL, and two pools for one cast is more than any
  talent asked for.
- **A DoT APPLIED BY A CRIT CANNOT CRIT, AND IT ROLLS OVER.** Deep Wounds and
  Ignite, both by the owner, and they are one mechanic: the crit is already in
  the magnitude, so a crit on the tick pays for it twice, and a second
  application adds to the undelivered remainder rather than replacing it.
  `periodic.pool` plus `drawFromPool` is the roll-over and OMITTING `critFrom`
  is the no-crit -- the duration still resets, which is a separate clock.
  **Ignite's old comment argued the opposite and argued it well** ("Forever's
  tooltip ... says nothing about rolling them together ... Classic's Ignite does
  combine, which is exactly the kind of inherited assumption this project has
  been caught by before"): every step sound, conclusion wrong, because the
  tooltip was the wrong source to ask when the owner had already specified the
  same mechanic next door. **A reading flagged as an interpretation is still an
  interpretation after it has sat there for months.**
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
- **AN EFFECT THAT HAS TO LAST THE CAST GOES IN `onCastStart`, NOT `onCast`.**
  `onCast` runs at the END of a cast and once per tick of a channel, so
  anything that must be in place FOR the cast had nowhere to go. Evocation is
  the first caller -- "immediately starts your out-of-combat mana regeneration
  and multiplies it by 16x" over an eight-second channel -- and the PAIR is the
  design: `onCastStart` opens the window and `onCast` closes it, so the two end
  together whatever haste does to the channel. Giving the aura a duration
  instead means keeping a constant in step with a hasted cast time, and getting
  that wrong is free mana after the channel with nothing to flag it.
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
- **A COMPLETED CAST OR ATTACK BREAKS STEALTH AND PROWL, AND THAT IS AN ENGINE
  RULE WITH EXACTLY ONE DECLARED EXCEPTION.** The owner's words and their only
  exception in one sentence: "Almost every completed cast or attack breaks
  stealth/prowl, and for the purposes of this simulation the only thing that
  doesn't is a rogue's premeditation." `AuraDefinition.brokenByAction` on the
  two states, `Ability.breaksActionAuras` as the opt-out, and
  `AuraCollection.breakOnAction` called from `runCast` and from `swing`.
  **DERIVED, NOT DECLARED**, which is `refundsCostOnMiss`' shape and is what the
  word "almost" asks for: a new ability gets the rule for free and the one that
  forgot would be the exception. It REPLACED Ambush and Ravage each removing the
  aura in their own `onCast` -- and the Ravage line was flagged in the source as
  a READING of an unstated clause, which is what got it ruled on. **The answer
  came back wider than the question**: not Ravage's rule, everything's.
  **CUTTHROAT DELIBERATELY DOES NOT CARRY IT**, though it gates the same Ambush.
  The owner ruled its proc IS the stealth requirement, so it is a ten-second
  PROC WINDOW spent by the Ambush rather than a state an action ends -- and a
  Rogue reaches 60 energy in only 30 of 207 windows as it is, so tagging it
  would quietly delete most of three talents. Ambush's `if`/`else` is gone with
  it: one window is now spent by the ability and the other ended by the engine,
  so with both up both go.
  **TWO WAYS TO HALF-WIRE IT WERE WRITTEN, AND THE FULL SUITE PASSED ON BOTH.**
  3,709 tests green on a rule that was inert for most characters and
  self-defeating for the rest:

  | | |
  | --- | --- |
  | below `runCast`'s early return | a character with no cast reaction leaves by another path, so the rule would have applied to Rogues and Druids with a talent and to nobody else -- the `resourceRegenMultiplier` failure exactly |
  | after `onCast` instead of before | **Vanish and Prowl do nothing but apply one**, so it removed the window each had just opened: the whole of both abilities |

  **THE SECOND IS NOT FIXED WITH MORE OPT-OUTS**, which is the tempting repair
  and would have grown the exception list from one to three to cover a mistake
  in an ordering. **The rule is about what was up BEFORE the action**: breaking
  first says that exactly, and whatever the action establishes is newer than the
  action. Neither Ambush nor Ravage reads the aura in `onCast` -- the gate is
  `canCast`, which `checkCast` has already passed.
  **AND A MISS STILL BREAKS IT**, because the attack happened and whether it
  connected is the combat table's business. The swing call sits before the
  on-next-swing early return too, so a queued Heroic Strike counts.
  **WHAT IT COST IS THE VANISH-AMBUSH PAIR, BY ABOUT ONE AMBUSH A FIGHT.**
  Vanish is off the global cooldown, so the actor is left FREE and
  `nextDecisionTime` returns `now + ROTATION_POLL_MS` -- which is the documented
  Charge problem, and in that 100ms gap a swing can take the window the Vanish
  just opened. Rupture's Ambushes go **4.2 to 3.4** a fight and Hemo Dagger's
  **2.7 to 2.2**, for **-6.6 +/- 5.4** and **-9.0 +/- 9.1**; the harness calls
  both `noise` and the uses column is what says they are not. **The list
  recovers most of it** -- 0.8 of 4.2 Ambushes is 3.3% of Rupture's damage,
  about 23 DPS, and the energy goes to Hemorrhage instead. **Whether a Rogue
  should be able to chain Vanish into Ambush without a swing intervening is a
  question for the owner**, because the 100ms poll is a property of this
  simulation rather than of the ruleset.
  **THE CAT AND PURE HEMO ARE BIT-IDENTICAL ACROSS THE CHANGE**, 894.1 and
  712.5 to the decimal, which is the containment check: Ravage ends Prowl by a
  new route to the same outcome, and a Pure Hemo rogue's opening window was
  never spent by anything.
- **A CAST THAT LEAVES THE ACTOR FREE NOW ACTS AGAIN AT ONCE, AND THE 100ms IT
  USED TO WAIT WAS AN ARTEFACT RATHER THAN A COST.** The owner's ruling: "Vanish
  into Ambush should not be interrupted by a swing." Vanish is off the global
  cooldown, so it left the actor free -- and `nextDecisionTime` gave a free
  actor `now + ROTATION_POLL_MS`, a tenth of a second in which an auto-attack
  could land and take the stealth window the Vanish had just opened. A player
  presses the two keys together and nothing in the ruleset puts a swing between
  them.
  **IT IS THE CHARGE PROBLEM, MET FROM THE OTHER SIDE, AND THAT IS WHY NO
  POSITION COULD FIX IT.** This file already records the first instance --
  Charge is castable for one instant, the off-GCD cast left the actor free, and
  "the window is gone", one cast a fight to ZERO -- which was worked around by
  MOVING THE ENTRY to second. That works when the thing that steals the gap is
  another ENTRY; here it is a SWING, which no ordering can outrank.
  **AND A SEQUENCE CANNOT EXPRESS IT EITHER**, which was tried first:
  `AplEntry.sequence` steps ONE cast per decision, so the poll still sits
  between the steps -- and `resumeSequence` then ABANDONS the pointer, because
  the refusal is the stealth gate rather than `on_gcd`. It also cannot hold
  "step one ENABLES step two" at all: `sequenceIsAffordable` checks Ambush
  before the Vanish has been cast, so the window it is waiting for is not up
  yet and the whole sequence is refused.
  **WHAT MAKES IT TERMINATE IS THE ONLY THING THAT MAKES IT SAFE**, because a
  decision scheduled at its own timestamp can recur forever. Two guards, and
  both are load-bearing:

  | | |
  | --- | --- |
  | only after a cast that SUCCEEDED | an IDLE actor is the unbounded case, and it still polls |
  | every off-GCD ability declares a `cooldownMs` | so each can win at most once per instant, and the chain is bounded by the length of the list |

  **THE SECOND IS NOBODY'S RULE AND IS NOW A TEST**, `freeCastChain.test.ts`,
  across all nine classes, the four racials and the consumables: an ability
  added later with no cooldown and no global cooldown would HANG a fight rather
  than fail one, which is the worst failure available here.
  **AN ON-NEXT-SWING ABILITY IS EXCLUDED OUTRIGHT AND IS THE REASON THE GUARD
  IS NOT MERELY DEFENSIVE.** It is off the global cooldown by DERIVATION and is
  the one family with no cooldown: Heroic Strike is refused while already armed,
  but **Heroic Strike and Cleave share a slot** and would overwrite each other's
  queue forever, draining a warrior's whole rage bar in one instant. Arming a
  swing is the end of an action rather than the middle of one.
  **IT MOVED ALL 28 ROWS AND THE SHAPE IS WHAT SAYS IT IS RIGHT**: mean 795.6
  to 798.9, **20 up and 8 down**, every loss inside its own interval and the
  only `REAL` verdict a **+14.9 on LW Melee** -- the build this file already
  describes as global-cooldown-bound rather than resource-bound, which is
  exactly who a recovered 100ms belongs to. The owner's own two profiles,
  **Rupture +8.7 and Hemo Dagger +14.2**, more than recover what the
  stealth-breaking rule had cost them.
  **AND FOUR TESTS BROKE, ALL OF THEM FIXTURES READING A TIMING THEY NEVER MEANT
  TO PIN** -- which is the lesson worth more than the rule:

  | | what it was really asserting |
  | --- | --- |
  | `costRefund` x2 | a built character CARRIES ITS ROTATION, so one `advanceTo(1)` tick now cast a chain ending on the GCD; the hand-driven Hamstring was refused, cost nothing, and **a refund test read zero as "the full cost"** |
  | `mageAbilities` | it `find`-ed "any row whose attempts equal its casts" as the comparison spell, so which spell it compared against was whatever the fight produced first. Named as **Scorch** now, which the sibling test beside it already did |
  | `paladinTalents` | "nothing is left banked at the end of a fight that swung" is a claim about WHERE THE FIGHT STOPPED. It asks the event stream for applied-against-removed pairs now |

  **AND AN ANCHOR THAT LOOKED LIKE A RULESET FACT WAS WRONG TOO**: the Mage
  repair first asserted that no spell can report a miss rate below the owner's
  1% FLOOR, which is true of the CHANCE and false of a measured frequency --
  Frostfire Bolt measures 0.8% over sixty fights. **A floor bounds the roll, not
  the sample**, and a rate read off a batch is an estimate like any other.
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
  **AND THE THIRD READING IS NOT CONSUMING IT AT ALL, WHICH IS WORTH 187 DPS ON
  ONE PROFILE.** Heating Up is "reduce the cast time of your next Pyroblast cast
  within 20 sec by 25%, stacking up to 3 times", and it had no `consumedByCast`
  -- so three stacks were 75% off EVERY Pyroblast in a twenty-second window
  rather than off one. The owner ruled it `all`: Fire went **877.7 to 690.1**,
  with Pyroblast falling from **13.55 casts a fight to 1.75** because the build
  only reaches three stacks twice. **The field being absent is a reading too**,
  and it is the most generous of the three.
- **A CAST MODIFIER CAN BE REFUSED BECAUSE OF ANOTHER AURA** --
  `CastModifier.exceptWhileAura`, keyed by aura id, and it suppresses the effect
  AND the consumption together because one predicate decides both. "Heating Up
  is no longer consumed if the Mage also had Presence of Mind active for the
  Pyroblast cast" is why. **`requiresCastTime` IS THE NEAR MISS AND DOES NOT SAY
  IT**: that flag reads the ability's DECLARED `castTimeMs`, and Pyroblast always
  declares one -- so the aura matched a cast Presence of Mind had already made
  instant, its 75% had nothing left to reduce, and all three stacks were thrown
  away with nothing on the results page to show it. The Arcane list moves
  Presence of Mind onto Pyroblast deliberately, so every one of those casts was
  eating a three-stack Heating Up for nothing.
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
  the unbuffed figure while reading as plausible. **Careful Aim feeds BOTH attack
  power pools** by the owner's ruling, though the talent says only "Attack
  Power" — Forever names the ranged pool explicitly everywhere else it means it,
  so the melee-only reading was defensible and wrong.
- **IT CONVERTS FROM ANY FLAT STAT, AND THE CONSTRAINT IS ON WHAT IS DERIVED
  RATHER THAN ON WHAT IS READ.** It was documented and tested as primaries-only,
  on the reason that "the derivation is handed resolved primaries" -- and it is
  not: `StatBlock.computeEffective` calls `this.derivation(firstPass)`, every
  stat resolved from base and modifiers. The parameter is named `primary` and
  typed `Readonly<Stats>`, so **the name described its six callers and the type
  always allowed more**. What actually makes two fixed passes terminate is the
  argument `StatBlock` states for itself: nothing the derivation PRODUCES is also
  read by it. So a conversion may read any stat no derivation writes, and
  `statFromStat.test.ts` checks that against all nine classes and every Druid
  form instead of against a hand-written list of five names. Thick Hide's
  `defenseSkill` is the first non-primary source — a flat stat that gear and two
  Anticipation talents grant and nothing derives.
- **`scale` IS A UNIT ON BOTH DERIVATIONS, AND THE DEFAULT IS A PERCENTAGE.**
  `statFromLevel` and `statFromStat` divide by 100, because Predatory Strikes is
  "150% of your level" and Careful Aim is "100% of your Intellect". Thick Hide
  states MULTIPLES -- 3 armor per level, 2 per defense point -- so it passes
  `scale: 1`. The two readings differ by a hundred times, which is the one saving
  grace: 180 armor against 1.8 is obvious, where a `percentAdd` missing its
  `scale: 0.01` is a thousand percent and still renders.
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
- **A CRITICAL SWING PAYS MORE RAGE, AND IT IS THE FLAT HALF ONLY.**
  `Combatant.critResourceMultiplier` — **2.0 for a Warrior, 1.75 for a Bear
  Druid**, 1 for everything else — arrives on the combatant the way `baseGcdMs`
  and `costRefundOnMiss` do, because the rule is the engine's and the two numbers
  are the ruleset's. Forever states them separately, under two class headings,
  and the owner has confirmed reading them independently rather than stacking the
  Bear's 75% on a class-wide 100% that the word "Players" invites.
  **THE `flat` HALF ONLY, AND THAT IS NOT A SIMPLIFICATION**: a `perDamage` award
  is proportional to the damage and a crit has already doubled the damage, so
  multiplying it here as well pays the bonus twice — a bigger number and no
  error. Forever's two rage rules split exactly along that line, rage from
  DEALING damage being flat per swing and rage from TAKING it per damage.
  **SWINGS ONLY, AND BY DERIVATION RATHER THAN BY A TEST OF THE WORDING**:
  "with a basic attack" needs no check because an ABILITY generates no rage in
  this engine at all, so the auto-attack path is the only caller that has an
  outcome to pass.
  **IT MAKES CRIT A RAGE STAT, which is a change to what a build can AFFORD
  rather than to what anything hits for.** Worth +75.5 to DW Fury, +18.0 to 2H
  Arms and +6.8 to the tank — the tank least, because a Protection warrior is
  already capping and wasting income. It is also the first thing in this section
  that lets a FASTER weapon earn more: `R × S` cancels speed exactly, and a crit
  RATE is per swing.
- **Taking damage is `D × 10 / H` off the PRE-ARMOR figure MINUS THE BLOCK.**
  Defensive Stance reduces the rage earned, armor does not, and a block does.
  Armor and a block are one pipeline step, so `DamageResolution` carries
  `blocked` separately to tell them apart.
- **AND THE ARMOR HALF OF THAT WAS CONTRADICTED IN A COMMENT WRITTEN BY SOMEBODY
  WHO HAD READ IT.** Fixing Thick Hide gives the Bear 220 more armor, and three
  comments plus a test predicted the consequence as "more armor means less damage
  taken means LESS rage, so the Bear's DPS falls". Measured: damage taken fell
  2.6% and rage went **751 to 750**, because rage is taken off the PRE-ARMOR
  figure and armor is the one mitigation that cannot touch it. Avoidance can --
  the dodge fix next door moved rage 669 to 751.
  **A PREDICTION IN A COMMENT IS A MEASUREMENT THAT HAS NOT HAPPENED**, and it is
  worth less than a question mark: it is specific, mechanical and reads exactly
  like a finding. The rule that falsified this one was two sections above it in
  this file and in `resourceRules.ts` in the same words. **Check the rules file
  before writing down a mechanism, especially when the mechanism sounds obvious.**
- **AND A DPS FIGURE INSIDE THE INTERVAL CANNOT TELL YOU WHICH HALF MOVED.**
  Thick Hide measured −1.7 DPS, which is "no difference" and is also what an
  inert talent measures. `tools/bear_survival.ts` prints armor, dodge, deaths,
  damage taken and rage beside the DPS, and those columns are what showed the
  armor arriving and the rage not moving. **When a correctness fix is expected to
  be worth nothing, measure the mechanism's own quantity** -- otherwise "inside
  the interval" is indistinguishable from "did not apply".
- **Health and mana are maximums computed ONCE from a stats snapshot**, so a
  stamina buff applied as an aura grants no health. The encounter passes
  `poolStats`, a transform from the character's stats to their buffed ones.

### Builds, encounters and buffs

- **A FORM GRANTS STATS, AND FOR THE WHOLE PROJECT NOTHING APPLIED THEM.**
  Forever's Dire Bear Form is "increasing Attack Power by 180, **Armor
  contribution from items by 360%**, and Health by 1,240", and the armor half
  reached the Bear Druid never. A form is a COMBAT STYLE here and **nothing
  anywhere granted stats for a style**; `game/character/druidForms.ts` is that
  layer now, applied in `createPlayer` as a layer of its own.
  **MOONKIN'S IDENTICAL CLAUSE WORKED, WHICH IS WHY NOBODY LOOKED.** Moonkin
  Form is a TALENT, so its 360% could hang off `moonkin_form` as an
  `itemArmorPercent` effect and did. Bear Form is a base ability with no talent
  to hang one on -- so one instance of the mechanic worked by an INCIDENTAL
  ROUTE and the others had no route at all. **When one instance of a rule works
  through something structural about that instance, check whether the siblings
  have any route at all**, which is the `isWeaponUse` lesson pointed at content
  instead of at a predicate.
  **AND NO AUDIT COULD HAVE FOUND IT, WHICH IS A CLASS OF BUG THIS FILE DID NOT
  HAVE A NAME FOR.** The three audits find an ability that is not connected, a
  coefficient that does not respond, and a list entry that never fires. A stat
  that was **never declared** leaves no zero, no caveat, no `unmodelled` entry
  and no talent reporting itself partly modelled -- there is nothing to count
  and nothing to re-read. What found it was the owner reading damage taken
  across the three tanks and asking which of them was wrong: the Bear took
  **232,551** against the Protection Warrior's **118,927** while carrying nearly
  twice its dodge. Worth **armor 4,690 -> 16,753**, **damage taken -55%** and
  **deaths 9.98 -> 4.73**.
  **WHICH BEAR IT IS WAS SETTLED BY DATA RATHER THAN BY A DEFAULT.** The engine
  folds Bear and Dire Bear into one style, so 180% against 360% was worth about
  35,000 damage taken a fight. `baseStats.ts` gives a Tauren Druid 1,303 hit
  points in caster form and **2,543 in bear** -- a difference of exactly
  **1,240**, which is DIRE Bear's health figure and not Bear Form's 180 -- and a
  Night Elf's attack power moves -20 to 160, exactly its **+180**. The owner's
  own spreadsheet had chosen the form before the multiplier existed.
  **AND `ENRAGE_BEAR_ARMOR_REDUCTION` ANSWERS THE SAME QUESTION THE OTHER WAY**,
  using the 27% BEAR figure with 16% Dire Bear declared beside it and unused.
  Two places now resolve "which bear is this" differently and only one of them
  is resolved by data. **Outstanding work**, named here rather than quietly
  aligned.
  **WHAT THE MULTIPLIER REACHES IS TWO THINGS AND ONE OF THEM NEEDED A SECOND
  MECHANISM.** Item armor, BASE and BONUS -- both tooltip lines parse into
  `item.stats.armor`, which is the field `armorFromItems` sums, so a generated
  Bear head reading "155 Armor" and "+165 Armor" carries 320 and both are
  multiplied. And THICK HIDE, whose own tooltip asks for it: "This amount can be
  further increased by multipliers from those forms." Its per-LEVEL half is flat
  and is multiplied directly; its per-DEFENSE-POINT half is a CONVERSION, so the
  multiplier is applied as a **second conversion at the multiplied rate** rather
  than by resolving the clause -- resolving would work today, because nothing
  buffs defense skill mid-fight, and would stop being correct the day something
  does. It does NOT reach an enchant's or a potion's armor, which is the owner's
  existing ruling and needs no exclusion because `armorFromItems` never counted
  either.
  **AND THIS FILE RECORDED THE THICK HIDE CLAUSE AS NEEDING NOTHING.**
  `druidEffects.ts` said the sentence "refers to something the engine applies
  elsewhere or not at all" -- half right, because Moonkin's multiplier genuinely
  did not reach it, and the conclusion drawn from that was that nothing should.
  **Moonkin's Thick Hide is STILL unmultiplied**, worth 0.0 because nothing
  attacks a Moonkin, and is outstanding work rather than a decision.
- **A BUILD IS FIVE SETTINGS THAT HAVE TO AGREE** — class, playstyle, stance or
  form, gear, and whether the target swings back — and `profiles/presets.ts` is
  where that is written down. Choosing three of the five produces a character
  nobody meant, and half a tree silently does nothing. A preset sets EVERY field
  rather than inheriting any, or it behaves differently depending on what was on
  screen when it was pressed. `isTankBuild` is the same idea inferred from two
  fields, and `encounter.targetAttacks` is what tells the two Paladin shield
  builds apart, because the style cannot and stances belong to the Warrior.
- **Gear belongs to a class, so changing class replaces it.** A race change keeps
  it. The sets live in `game/items/` -- `benchmarkSets.ts` and the
  `startingSets.ts` that picks one -- and not in `presets.ts`: two layers need
  them, `game` may not import from `profiles`, and duplicated item ids drift.
  **`gearSets.ts` IS GONE and that is the owner's instruction**: the nine
  Classic and Season of Discovery sets "were just random templates of items
  that won't exist 1-to-1 in Forever". `startingEquipmentFor` kept its name and
  its shape and returns the **E65 benchmark set**, which is what let 23 test
  files carry on unedited -- none of them cares WHICH realistic character it
  gets, and rewriting them all would have been 23 chances to change what a test
  measures while claiming to move a gear set.
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
- **A RACIAL IS THE ONE THING THAT IS NOT SELECTED, WHICH IS THE EXCEPTION THAT
  PROVES THE RULE BELOW.** Race is already a required field on every profile and
  `baseStats.ts` is already keyed by it, so a racial applies for the same reason
  a Tauren's base strength does -- there is nothing to tick. That it moved all
  25 published figures is a consequence of the feature rather than an argument
  for a switch. **The test is whether the thing is a CHOICE the character made**:
  a raid buff is somebody else in the raid, a consumable was drunk, an enchant
  was applied, and a race was not any of those.
- **AND A RACIAL CHANGE CAN REACH A FIGURE THROUGH THE GEAR, WHICH IS THE ONE
  ROUTE NO AUDIT HERE CAN SEE.** Tauren Endurance's "+1% hit" became "+2%
  critical damage", and the owner's benchmark templates had been CREDITING that
  1%: the two Tauren melee rows ask for 70 hit rating where every other melee
  row asks for 80, the two feral Druids ask for 30 against a 4-point Nature's
  Reach, and the Moonkin asks for 110 against the same 4. **Every one of the five
  landed exactly on its cap WITH the racial and is one point under it without.**
  **THE MOONKIN IS THE SHARPEST CASE BECAUSE OF THE FLOOR.** Spells miss on a
  flat 17% floored at 1%, so its last point of hit was unusually valuable: its
  spells now miss **2% where they sat on 1%**, which DOUBLES the miss rather
  than adding a point. Melee and ranged have no floor at all, so for the other
  four the eighth point was simply the last one that bought anything.
  **IT WAS NOT FIXED AND THE QUESTION IS WHAT FIXED IT.** Raising five rows by
  10 rating was a change to the owner's own spreadsheet on nobody's authority,
  so it was pinned in `statHeadroom.test.ts` and written up as a question
  instead -- and the ruling came back: "+10 hit rating, which should be
  subtracted from elsewhere on the template set without violating the item
  budget." The rows are **80, 80, 40, 40 and 120** now.
  **AND THE SECOND HALF OF THE INSTRUCTION NEEDED NO CODE**, which is the part
  worth knowing: a rating already costs budget and is already paid for out of
  CRIT first, so "subtracted from elsewhere without violating the budget" is
  what `spreadRating` and `RATING_DONORS` already do. Where it actually came
  from splits on whether the build's `preferred` list buys crit at all -- the
  Cat, the Enh Shaman and the Moonkin each gave up **2 crit rating**, and the
  two TANKS gave up **2 to 3 stamina and a few points of attack power** because
  neither has Crit in its list for the donor rule to find.
  **A RACIAL AND A GEAR TEMPLATE CAN BE TUNED AGAINST EACH OTHER**, so when a
  racial's stat changes, check what the templates were assuming -- and the test
  that recorded the consequence is what made it askable, which is this file's
  own rule about a flagged interpretation, pointed at a BUILD fact.
- **Raid buffs are SELECTED, never assumed.** Nothing is on by default; a buff
  that applied itself would move every figure ever recorded. **A proc's reaction
  is built PER CHARACTER**, because an internal cooldown is per-character state
  and one shared closure silently stopped Windfury proccing after the first
  iteration of a batch. [docs/raid-buffs.md](docs/raid-buffs.md)
- **A BUFF THE CHARACTER PROVIDES ITSELF IS THE SAME AURA REACHED SEVERAL WAYS,
  AND THE ID IS THE WHOLE RULE.** Moonkin Aura and Leader of the Pack are two
  raid buff entries AND two Druid talents, and the owner ruled that "these are
  all the same exclusive 3% global critical strike chance and do not stack" —
  so there was ONE `AuraDefinition` with one id and all four sources applied it.
  `AuraCollection.apply` refreshes a matching id instead of stacking, so no
  combination was worth more than 3%. The arrangement Thunder Clap already had,
  which `raidBuffs.ts` reuses from the Warrior.
- **AND A PATCH HAS SINCE SPLIT THEM BY ATTACK TYPE, WHICH NARROWS THAT RULE
  RATHER THAN REPEALING IT.** "Moonkin Aura now only increases Spell Critical
  Strike chance"; "Leader of the Pack now only increases Melee and Ranged
  Critical Strike chance." They are `MOONKIN_AURA` and
  `LEADER_OF_THE_PACK_AURA` now, two ids, and **they stack with each other** --
  a character under both carries +3% spell AND +3% melee, which is two buffs
  doing two things rather than one counted twice.
  **THE SHARED ID SURVIVES WITHIN EACH AND NOT ACROSS THE PAIR**, which is the
  half of the old ruling that was about double-dipping and is still
  load-bearing: each aura keeps one id shared by its talent and its raid buff
  entry, so a Moonkin with both sources of Moonkin Aura still reads 3%.
  **WHAT IT COST IS EVERY CASTER PROFILE'S 3% SPELL CRIT**, because every preset
  but the Moonkin carried Leader of the Pack.
- **AND THE OWNER HAS SINCE RULED THEM NOT EXCLUSIVE, WITH BOTH SELECTED
  EVERYWHERE, WHICH HANDS THAT 3% BACK.** "Moonkin and Leader of the Pack are no
  longer exclusive. And all profiles should have both enabled by default in the
  raid buffs." So `moonkin_form` is in `PRESET_RAID_BUFFS`, the Moonkin's SWAP
  is deleted -- it ran the one list that substituted an entry for this pair --
  and a raid simply has a feral druid AND a moonkin.
  **THE RULING COST NOTHING TO APPLY BECAUSE THE CHOOSER WAS NEVER WHAT
  WORKED**, which is the entry below stated from the other end: the no-double-dip
  rule lives in the shared aura ID, so there was no exclusivity in a chooser
  left to remove. A Moonkin's own spell crit does not move when the box is
  ticked, because its talent and the raid entry are one id.
  **AND `RaidBuff.exclusiveWith` NOW HAS NO DECLARATION ANYWHERE.** The field,
  `areExclusive` and the panel's "replaces X" line are kept -- the next
  exclusive pair should be one line rather than a re-implementation, and
  `withRaidBuff` still does the catalogue ordering that makes two identical
  selections one file. `raidBuffs.test.ts` asserts that `areExclusive` answers
  false for **every pair in the catalogue**, because a selection rule with no
  declaration reads exactly like one that sometimes fires. **Third instance of
  that guard** after `isWeaponUseOf(attack, 'ranged')` and
  `RacialRequirement.weaponTypes`, and the first where the thing with no caller
  is a RULE rather than a predicate.
- **AND IT SUPERSEDES "HANDLE IT ON THE GUI", BECAUSE A GUI RULE CANNOT COVER A
  SOURCE THE GUI DOES NOT OWN.** The earlier ruling made exclusivity a SELECTION
  rule, and `withRaidBuff` does switch one entry off when the other goes on. It
  governs the two RAID BUFF entries and knows nothing about a TALENT — so a
  Moonkin carrying its own form talent in a raid with Leader of the Pack ticked
  held two ids and read **+6% crit**, measured at 24.243% against 21.243%. A
  profile loaded from JSON with both ids does the same, because nothing re-runs
  `withRaidBuff` on load. **When a rule is enforced at a chooser, ask what else
  can reach the thing being chosen.**
- **EVERY PROFILE NOW TAKES EVERY RAID BUFF BUT ONE, AND THE EXCEPTIONS ARE
  GONE.** The owner's instruction: "For all profiles ensure that all raid buffs
  are checked on except for Curse of Recklessness." So `PRESET_RAID_BUFFS` is the
  catalogue minus one entry, all 28 profiles share it byte for byte, and
  `windfuryImbue.test.ts` derives the single absence FROM `RAID_BUFFS` rather
  than listing the others -- which is the stronger test: a buff added to the
  catalogue used to pass silently, and now either joins every preset or fails.
  **A TICKED BOX IS ALLOWED TO BE WORTH NOTHING**, which is what both old
  exceptions were really about. Windfury Totem reaches no bow, so the two ranged
  Hunters' swap for Grace of Air bought a real 89 agility and cost a box that
  did nothing -- and with both selected there is nothing to substitute.
  **AND THE SECOND EXCEPTION MOVED INTO THE ENGINE, WHICH IS WHERE IT BELONGED.**
  The Enhancement Shaman dropped Windfury Totem because its own imbue says
  "when applied to main hand, disables any benefit you personally receive from
  Windfury Totem" -- a rule about a CHARACTER expressed as an unticked checkbox,
  which is the Moonkin's +6% crit mistake exactly: a selection cannot enforce
  something a user can re-tick. `windfuryTotemReaction`'s `canTrigger` refuses
  while the imbue is up, so the box is ticked and the carrier is paid once.
  **ASKED AT PROC TIME, because the imbue is a pre-combat CAST** and
  `onPrecombat` runs after `openingAuras` -- a build-time check would have found
  no aura at all. It also makes it true for a mid-fight re-imbue, which the
  Enhancement list does when the hour runs out.
  **AND THE DOUBLE-DIP THE OWNER ASKED ABOUT IS NOT HAPPENING**, verified rather
  than assumed: removing both party buffs changes the Cat's melee crit by
  **0.000** and the Moonkin's spell crit by **0.000**, because each Druid's own
  talent supplies its half and the raid supplies only the half it lacks. Every
  profile holds each aura at exactly one stack. `tools/probe_party_crit.ts`.
  **IT MOVED EVERY ROW AND THE ARCHETYPE SPLIT IS THE FINDING**, mean 798.8 ->
  843.5 with 28 of 28 up and none down:

  | | n | mean | what reaches them |
  | --- | --- | --- | --- |
  | **the three Paladins** | 3 | **+114.1** | Judgement of the Crusader's 161 HOLY spell power |
  | physical, non-tank | 14 | +50.5 | Grace of Air's agility, and Gift of Arthas' +8 a hit |
  | tanks | 3 | +43.6 | the Prot Paladin is +82.3 of it, for the Holy reason above |
  | casters | 8 | **+9.1** | Gift of Arthas alone -- they read no agility and deal no Holy |

  **JUDGEMENT OF THE CRUSADER IS ISOLATED AND IT IS MOST OF THE PALADIN MOVE**:
  +79.5, +74.9, +63.0 and +49.4 on the four, and **exactly 0.0 on DW Fury and the
  Fire Mage**, which is the control -- it is Holy spell power and reaches nothing
  that deals no Holy damage.
  **AND TWO JUDGEMENTS ARE NOW SELECTED AT ONCE**, Wisdom and the Crusader, which
  one target cannot carry in the game being modelled. `exclusiveWith` has no
  declaration anywhere, so nothing refuses it. **Implemented as instructed and
  recorded as a question**, because it is worth 63 to 80 DPS on three profiles
  and is a RAID COMPOSITION ruling rather than a bug.
- **TWO PRESETS SUBSTITUTE ONE RAID BUFF AND ONE DROPS ONE, and a SWAP is the
  commoner shape.** The two ranged Hunters take Grace of Air for Windfury, and
  only the Enhancement Shaman drops one outright, because Windfury Weapon
  disables the totem for its own carrier. The list is derived from
  `PRESET_RAID_BUFFS` by mapping rather than written out, so a buff added there
  reaches it; the exception lists are in `presets.test.ts` and are asserted
  EXHAUSTIVE. **A drop and a swap say different things about the raid**:
  dropping says it is short a buff.
  **IT WAS THREE SWAPS AND THE THIRD IS GONE**, which is one of these lists
  getting shorter for once: the Moonkin took Moonkin Aura for Leader of the Pack
  while the two were exclusive, and the owner has since ruled them not exclusive
  with both selected everywhere. **The exhaustive assertion is what made that a
  one-line change** -- the swap table and its `toEqual` on the keys both had to
  move, so nothing could be half-applied.

### Consumables

FOURTEEN CATEGORIES from the ruleset owner's table, **at most one per
category**. `game/buffs/consumables.ts`, and `tools/consumable_report.ts` prints
all 25 profiles' rows at once.

**AND THE LAST TWO ARE ACTIONS RATHER THAN STATS, WHICH FALSIFIES MOST OF WHAT
THE TWELVE BELOW SAY ABOUT THEMSELVES.** Potion and Other are used DURING a
fight, so each carries an `Ability`, joins the ability book when it is selected,
and gets an entry in the priority list — the owner's instruction, "must be
treated like a character ability and be exposed on the APL and consumable
panels". They contribute no starting stats, they have a cooldown, they can be
wasted, and WHEN to use one is a decision. `game/abilities/consumables.ts`,
`game/auras/consumables.ts`, `rotations/consumableCooldowns.ts`.

- **NOTHING NEEDED A NEW ENGINE CAPABILITY, AND THE RACIALS ARE THE TEMPLATE
  THROUGHOUT.** An ability belonging to no class is appended in `createPlayer`
  beside them; a shared constant puts an entry in all 25 stock lists;
  `stockListFor` narrows it to what the profile carries. That last one is
  `withoutUnselectedConsumables`, which is `withoutOtherRacials` with a
  SELECTION in place of a race — and the difference is the whole feature: a race
  is settled when the character is made and a selection changes while somebody
  is looking at the panel.
- **AND THE OWNER'S ASK WAS ALREADY SATISFIED BY A MECHANISM THAT EXISTED.**
  Selecting a potion makes its entry appear because `editProfile` runs
  `syncDefaultRotation` on every change a panel makes, and its own comment had
  predicted this case: "applied to every change rather than to the four that can
  matter, because the alternative is a list of edits that change which stock list
  applies that is correct until somebody adds a fifth". **A consumable selection
  is the fifth.** No format bump either — the selection is already a map from
  category id to consumable id, so two more keys are legal in every saved file.
- **ALL NINE ARE OFF THE GLOBAL COOLDOWN, by the owner's ruling**, which is the
  same answer they gave for four of the five racials and it matters for the same
  reason: an ability wrongly taking one still restores the right pool for the
  right amount on the right cooldown, so the mistake is invisible in everything
  except the DPS. **Being off it means ONE thing** — the ability does not START
  one — and it is still BLOCKED by one running. A test that forgot that cast two
  potions behind a Ghostly Strike and asserted on a state neither of them
  reached.
- **THE SHARED POTION COOLDOWN IS DECLARED AND IS INERT**, which is the point.
  The owner describes using one as putting "all Potions on a 2 min cooldown",
  and calls that what "effectively make[s] the choice exclusive" — and the
  exclusivity is already a property of a selection keyed by category, so
  `cooldownGroup: 'potion'` can never reach a second ability today. It is the
  ruling written down where it is enforced rather than implied by a shape, and
  it is right the day anything lets a character hold two.
- **A CLASS LIST IS GATED TWICE AND FOR TWO DIFFERENT REASONS**, which is the
  Warlock stone's arrangement. The PANEL does not offer a Mage the Mighty Rage
  Potion, so nobody can choose one; `consumableAbilities` refuses it, so a
  profile that carries one anyway — hand-edited, or saved before a class change
  — is built WITHOUT the ability rather than refused. The panel still SHOWS the
  stale choice, labelled, because a dropdown reading "None" would claim nothing
  was chosen while the file says otherwise.
- **`consumableEffects` IS CLASS-BLIND AND THAT IS SAFE FOR ONE REASON ONLY**:
  both class-restricted entries grant an ability and no stats. It is a property
  of the TABLE rather than of the function, so a test asserts it — a
  class-restricted consumable gaining `stats` fails until somebody threads the
  class through, because a condition nobody declared is a bonus being paid.
- **THE TWO HEALS GO WHERE A TANK'S SURVIVAL COOLDOWNS ARE, AND THAT IS THE ONE
  JUDGEMENT IN THE FEATURE.** A tank list puts free entries LAST on a measured
  argument — "100ms is not free to a tank at thirty percent health" — and that
  argument does not reach a healing potion, because **the bottom of a tank list
  is a place entries are not REACHED**: a Protection warrior caps its rage, so
  something above is nearly always castable, which is how five of seven racials
  came back inert when they were tried there. So `CONSUMABLE_HEALS` sits with
  Last Stand and Shield Wall and the other seven sit with the racials. In the
  other 22 lists the position is free, because health never leaves maximum and an
  unreachable condition is not a floor under anything.
- **MAJOR MENDER'S POTION IS DECLARED, CASTABLE AND WORTH NOTHING, AND APPLIES
  NO AURA.** Healing power is not a stat `STAT_NAMES` carries. The `unmodelled`
  reason is shared by the ability and the catalogue entry rather than written
  twice, and the missing aura is deliberate: a 30-second aura carrying nothing
  would put a row on the buff-uptime table for a potion that did not do
  anything, which is exactly how **Adrenaline Rush reported 24.9% uptime for the
  life of the project while delivering no energy**. It is the one mid-fight
  consumable with no line in any list, and `consumableCooldowns.ts` says so
  where the entry is not.
- **A MID-FIGHT ABILITY IN THE BOOK IS A NEW KIND OF THING FOR ANYTHING THAT
  RESETS COOLDOWNS, AND PREPARATION WAS WRONG ABOUT IT.** "Immediately finishes
  the cooldown on your other ROGUE abilities" was implemented as every ability
  the character had, which was the same set until a book started holding
  racials and potions — so it handed a Rogue **a second Thistle Tea on a five
  minute cooldown**, 2.00 casts a fight, worth about 30 DPS of inflation.
  `resetCooldowns` takes the ids the caller owns now. **Found by the CAST COUNT
  and not by the DPS**: +64.7 reads as a potion that is unusually good, and
  "two casts of something on a five minute cooldown" does not.
- **AND THE THREE TESTS ON PREPARATION COULD NOT HAVE SEEN IT**, because all
  three built the actor a book of two Rogue abilities — so the restriction had
  nothing to restrict. **A test whose fixture cannot express the mistake proves
  nothing about it**, which is the stock Warlock list's lesson about the
  interrupt check, in a different file.

The twelve that came before them, and which the rest of this section is about:

- **A WEAPON EFFECT IS COATED ONTO A WEAPON, SO A DUAL-WIELDER BUYS TWO** --
  the owner's ruling, and `ConsumableCategory.perWeapon` is where it lives.
  **It is a property of the ROW and of nothing else**: a flask, an elixir and
  a piece of food are worth the same whatever is in the character's hands, and
  a test pins that Weapon Effect is the only row carrying the flag.
  **TWO WEAPONS MEANS TWO THAT SWING**, which is `offHand: 'weapon'` in
  `combatStyles.ts` -- a shield is not a second coated weapon, nor is a held
  off-hand item nor a Hunter's melee stat stick, and reading "two hands full"
  instead would pay a Protection warrior for coating its shield.
  **THE WHOLE CONSUMABLE IS APPLIED TWICE, NOT JUST ITS CRIT**, which the
  caster option is what makes checkable: it carries spell power as well, and
  both double. **And the SELECTION is still one choice** -- asking somebody to
  pick the same stone twice would be a control whose only correct answer is
  the one above it.
- **THE WEAPON EFFECT IS TWO ROWS NOW, MAIN HAND AND OFF HAND**, on the
  owner's instruction -- "weapons stones need to be split out into MH / OH to
  be able to control this precisely". It replaces `perWeapon`, which was the
  SAME RULING with no control on it: one selection applied once per weapon that
  swings, which cannot express "a Dense Sharpening Stone on the main hand and
  an Elemental on the off hand". **`ConsumableCategory.hand` is the field, and
  an off-hand row contributes NOTHING unless `offHand: 'weapon'` -- not half,
  nothing: there is no weapon for it to be on.**
  **THE THREE STONES ARE DECLARED ONCE AND OFFERED PER HAND**, because two
  hand-written copies is six places for a number to be wrong in -- and the IDS
  carry the hand, which `CONSUMABLES_BY_ID`'s duplicate check at module load
  requires.
- **THE DENSE SHARPENING STONE IS THE FIRST CONSUMABLE WHOSE EFFECT BELONGS TO
  A WEAPON RATHER THAN TO A CHARACTER.** "+8 base weapon damage to the equipped
  weapon" is not a stat and there is no stat it could be: a character holding
  two weapons has two of them. It goes into `WeaponProfile.baseDamage`, where a
  Hunter's ammunition goes and for the same reason, and leaves
  `powerCoefficient` alone -- that is `baseSpeed / 14`, and a stone does not
  change how fast the weapon swings. **So it is worth more PER SWING to a slow
  weapon and the same per second**, which is the opposite of how the PPM
  enchants here distribute and reads like a bug the first time somebody
  compares the two hands of a dual-wielder.
- **THE EXCLUSIVITY IS STRUCTURAL, NOT CHECKED.** A selection is a map from
  CATEGORY id to consumable id, so two from one category is not representable
  and the second write replaces the first. `RaidBuff.exclusiveWith` is the other
  design — a selection RULE the panel enforces — and this project has already
  paid for it: the Moonkin's +3% crit read +6% because the rule lived in a
  chooser and a TALENT reached the same aura without passing through it. **A
  shape that cannot express the mistake needs no chooser to be honest**, which
  is why the panel contains no exclusivity logic at all.
- **THE ONE THING THE SHAPE CANNOT STOP is a consumable filed under a category
  it does not belong to**, which is the only route to holding one twice.
  `selectedConsumables` looks an id up WITHIN its category so a smuggled one
  contributes nothing, and `validateProfile` reports it.
- **THEY ARE STATS, NOT AURAS**, which is the difference from a raid buff. A
  raid buff is an aura because it has a lifecycle — Windfury's window opens and
  closes, Sunder Armor stacks. A consumable is drunk before the pull and lasts
  the fight, so it is a layer of the STARTING stat block: it reaches the
  conversions (thirty strength is also sixty attack power on a Warrior), the
  pools are sized with it in, and the character sheet reads it for free. **No
  `poolStats` pass and no uptime row.**
- **"HIT POINTS" IS HEALTH**, confirmed by the owner, so "+1200 Hit Points" is
  1200 off the maximum and not a pool of its own.
- **"+1200 HIT POINTS" CANNOT BE A STAT AND IS THE ONE EFFECT WITH ITS OWN
  ROUTE.** `STAT_NAMES` has no `hitPoints`; health is a maximum derived from
  stamina, and the owner states no conversion, so turning it into stamina at
  some rate would be inventing a number. It arrives at `createPlayer` as its own
  term. **IT ALSO CHANGES RAGE**: Forever's `D x 10 / H` means a bigger pool
  makes each point of damage taken worth less, which is the formula doing what
  it says and not a side effect to correct.
- **"+2% MELEE CRIT CHANCE" IS NOT `critChance`, AND THAT IS THE TRAP.**
  `critChanceFrom` is the engine's ONE crit function and both the melee and the
  ranged tables read it, so the stat would hand two points to every shot a
  Hunter fires from a line whose first word is "Melee". It is
  `AttackTableModifiers` on `melee-auto` and `melee-special` instead — the same
  scope the bow enchant's ranged crit uses, pointing the other way.
  **WHAT SETTLES IT IS THE OWNER'S OWN PAIR OF LABELS**: this row says "Melee"
  and the Agility row says "+2% Crit Chance", and asked which the second meant
  they said melee and ranged. Two labels for one stat would be one label. The
  owner has since confirmed the narrow half directly — it "should not apply to
  Hunter Ranged attacks" — so both ends of the pair are stated rather than read.
- **"+40 ATTACK POWER" FEEDS BOTH POOLS, BY THE OWNER'S RULING** — "truly Melee
  Attack AND Ranged attack power for this consumable". It reaches the Food of
  the same name too, because the effect text is identical and treating two
  identical lines differently would need a reason.
  **AND IT IS A GENERAL RULE NOW, NOT A CONSUMABLE ONE:** "Attack Power always
  equals and reaches Melee & Ranged Attack Power. And Melee Attack Power NEVER
  reaches Ranged Attack Power." So **164 item lines** that read bare "Attack
  Power" grant both pools, where every one of them was melee-only. Worth
  **+24.1 to BM Hunter and +29.2 to LW Ranged**; the other 21 profiles moved by
  0.0, and LW Melee moved 0.0 because it fires nothing — only Hawk Melee's
  summon picked up a trickle. The two lines that say "ranged Attack Power" keep
  their own rule: ranged-only is still expressible, it is just not what the bare
  words mean.
  **IT SHIPPED THE OTHER WAY FOR ONE REVIEW AND THE REASONING WAS SOUND**: every
  ITEM line in the data read bare "Attack Power" as `attackPower` and had a
  separate rule for "ranged Attack Power", and the owner's one existing ruling
  the other way — Careful Aim — is about a TALENT, which a ruling covers what it
  says and is not extended by analogy. **That conclusion — "an item's wording and
  a consumable's mean different things, and neither settles the other" — was
  right on the evidence and has been SUPERSEDED by the general ruling above.**
  Waiting still beat guessing: the answer, when it came, covered every line in
  one sentence rather than one line at a time.
  Waiting was still right: the price of asking was one review, and the price of
  guessing would have been two Hunter profiles carrying an elixir worth nothing
  with nobody to notice.
- **AN ENCHANT'S ARMOR RULING COVERS A POTION WITH MORE FORCE, NOT LESS.** The
  owner ruled the cloak enchant's +60 is not "armor from items"; a potion is not
  a worn item by any reading, so Toughness and Thick Hide do not scale the +450
  either. It needs no exclusion of its own — `armorFromItems` sums ITEM stats
  directly, so a consumable is already outside it.
- **AND A RAID DEBUFF CAN ADD FLAT DAMAGE, WHICH NEITHER NEIGHBOUR COULD
  CARRY.** Gift of Arthas is "+8 damage to any direct damage (non-damage over
  time) source", and `AuraDefinition.flatDamageTaken` is it:
  `damageTakenBySchool` MULTIPLIES, and `spellPowerTakenBySchool` is POWER
  scaled by each ability's coefficient -- so a seal at 20% would take 1.6 of it
  and an uncoefficiented swing none at all. **"Up to 161" is what a power line
  reads like; a bare "+8 damage" is not.**
  **ADDED TO THE BASE ON THE OWNER'S OWN CHOICE** between the two readings they
  were offered, so a crit doubles it and armor cuts it -- and it therefore sits
  INSIDE the off-hand penalty exactly as an ability's own flat damage does.
  **`periodic` IS THE WHOLE OF "DIRECT", so a CHANNEL's ticks DO gain it**: an
  Arcane Missile is an ordinary non-periodic damage event, which is the same
  answer Wrack's "other" clause and Touch of the Grave's exception already give.
  Said here because "Arcane Missiles gains 8 six times" reads like a bug.
- **AND JUDGEMENT OF THE CRUSADER AS A RAID BUFF SHARES THE PALADIN'S OWN AURA
  ID, WHICH IS THE WHOLE DESIGN.** `spellPowerTakenFor` ADDS across auras, so a
  second id would hand a Retribution Paladin 322 Holy spell power the moment
  somebody ticked the box -- a bigger number and no error, on the build that
  already casts it. One id makes that unrepresentable, which is
  `PARTY_CRIT_AURA`'s arrangement and is there because enforcing exclusivity at
  a CHOOSER is what let a Moonkin read +6% crit. Only the duration differs and
  it is SPREAD from the one declaration, so the 161 cannot drift.
- **THE 25 PRESET ROWS ARE CHOSEN, NOT STATED**, and an owner table arriving
  later replaces them outright. They follow ONE written-down rule rather than
  taste, because twenty-five separate opinions is not something a reader can
  check: **take every category the build can actually read, choosing within a
  category by what the build scales with, and leave empty only what is worth
  literally nothing.** Nothing competes across categories — one choice each and
  no budget between them — so the only real decisions are the three categories
  offering a caster option against a melee one.
- **AND THE SAME RULE ON THE TWO MID-FIGHT ROWS CAME OUT AS ONE SENTENCE: THE
  `other` SLOT TAKES THE POOL THE BUILD RUNS OUT OF AND THE `potion` SLOT TAKES
  THE DAMAGE BUFF.** Measured rather than derived, because a potion is not a
  conversion-table question — "forty attack power for thirty seconds" against
  "sixty strength for twenty" against "2,250 mana" has no arithmetic answer. So
  every candidate was run on every preset by
  `tools/probe_consumable_choice.ts`. **NO MANA POTION IS SELECTED ANYWHERE**,
  which falls out of the categories NOT being exclusive with each other: the
  Demonic Rune covers mana from `other`, so `potion` is free for something that
  hits. Mighty Rage beats Frenzy wherever it is legal — 120 attack power for
  twenty seconds against 40 for thirty, plus the rage — and the two Paladin
  hybrids take Spellblasting where the WEAPON EFFECT row splits them on their
  physical share, so one answer serves four builds that another row divides.
- **THE `other` SLOT IS THE OWNER'S OWN THREE-WAY PARTITION, AND THE DRUIDS ARE
  WHY IT IS A TABLE RATHER THAN A DERIVATION.** "Demonic rune being used at 10%
  mana remaining should be the default behavior for pure mana users. Specifically
  cat druid should never use it in favor of Thistle Tea. Non-mana, non-energy
  users and the three tank profiles (Prot Warr, Prot Pally, and Bear) should use
  the Healthstone." All three Druids own mana, rage AND energy — pools are keyed
  by CLASS and not by form — so **no reading of "which pools does it have"
  separates the Moonkin's Rune from the Cat's Tea from the Bear's Healthstone.**
  Each is right for a different stated reason, and a derivation that cannot tell
  them apart would pass whatever the presets said.
- **AND THE RUNE'S 10% IS DELIBERATELY TIGHTER THAN THE MANA POTION'S 30%.** The
  owner stated the first and nothing about the second, so the potion keeps this
  repository's figure — and the asymmetry does work rather than merely surviving
  the no-extension-by-analogy rule: the two categories are not exclusive, so a
  character carrying both spends the one with no downside first and only then the
  one that costs 600 to 1000 Hit Points. At 10% the Rune fires on **four of the
  fifteen presets that carry one**, and those four are the builds that run dry.
- **AND "LEAVE EMPTY ONLY WHAT IS WORTH LITERALLY NOTHING" IS A RULE ABOUT
  MEASUREMENT THAT THE OWNER OVERRULED ON A SELECTION.** 2H Arms and DW Fury
  restore no pool at all, every Other candidate measured 0.00 casts on both, and
  the rule emptied them — and the ruling gives them a Healthstone, because that
  is what such a build actually carries. It still fires 0.00 times and moves no
  figure. **A row worth nothing is not the same as a row that should be blank.**
- **AND A HEAL MEASURED -28.4 ON THE FIRELOCK, WHICH WAS A BUG IN LIFE TAP AND
  WAS WRITTEN UP AS A PROPERTY OF WARLOCKS.** The measurement was right: a
  Warlock trades HEALTH for mana, Life Tap's `canCast` asks whether there is
  health to spend and whether the pool has room — never whether the mana is
  WANTED — so 1,400 restored health bought 1.63 more taps, each costing a global
  cooldown, and the list cast 1.43 fewer Incinerates. **The owner ruled that
  "should never be the case"**, and the real fault was that the Firelock's Life
  Tap entry was UNGATED where SM/DS's was gated at 15% — the lesson applied to
  one of the two lists that needed it, with the SM/DS entry's own comment
  recording it. Gated at a measured 5%, Life Tap fires 1.05 times instead of
  5.46, a heal is worth **-0.1**, and the profile is **+88.7**.
- **SO "ISOLATE A LOSS, DO NOT BLAME THE OBVIOUS SUSPECT" HAS A SECOND HALF:
  HAVING FOUND THE REAL CAUSE, ASK WHETHER THE CAUSE IS ITSELF CORRECT.** The
  isolation worked perfectly — `probe_firelock_heal.ts` named the mechanism to
  the cast — and the conclusion drawn from it was still wrong, because a correct
  explanation of a number was mistaken for a justification of it. **An
  explanation is not a defence.**
- **AND THE FIRELOCK'S OWN PAIR INVERTED UNDER THE FIX WITHOUT CHANGING.**
  Gating Life Tap made the build genuinely mana-bound, so measured ALONE the
  Major Mana Potion (+33.0) beat Spellblasting (+18.4) — and PAIRED with the
  Demonic Rune, which already restores mana, Spellblasting wins again, **+41.5
  against +38.5**. A category that is not exclusive with another makes a second
  source of the same pool redundant, so a pair has to be measured as a pair:
  "marginal values do not sum" can reverse a ranking and not merely shrink it.
- **THE ROWS ARE DERIVED FROM TWO MEASURED THINGS, SO EACH CAN BE RE-DERIVED.**
  The conversion table decides Blasted Lands — and **a Cat Druid takes STRENGTH
  where a Rogue takes agility**, which is the entry a reader assumes wrongly,
  because a Druid is 2 attack power a strength against 1 an agility and a Rogue
  is 1 and 1. The measured damage SCHOOL decides School Spell Power, and three
  of them are not guessable from the class: the Moonkin is **71% arcane**, the
  Frostfire Mage **62% fire**, the Elemental Shaman **56% nature**.
- **THE CONSUMABLES MOVED THE CASTERS FOUR TIMES AS FAR AS THE MELEE BUILDS, AND
  THE OWNER HAS CONFIRMED THAT IS INTENDED** — "casters *should* have moved
  more". A caster row reaches 254 school-blind spell power plus 40 on its own
  school; the biggest single entry a melee build can take is 40 attack power.
  The table re-sorted around it — four of the top six are casters where none was
  before. **Recorded because it reads like a bug**: a change that moves one
  archetype by +250 and another by +40 is the shape somebody later "fixes", and
  this one is the ruleset.
- **PROFILE FORMAT 12**, and older profiles get an EMPTY selection so nothing
  about their results changes. That is the version 9 decision rather than the
  version 10 one, and it turns on the same question: a saved character with no
  consumables was genuinely fighting without them, where a saved Rogue was not
  choosing to fight without poisons — those did not exist to choose.
  **IT WAS WRITTEN AS 11 AND SO WAS THE WARLOCK STONE**, from the same base, and
  the two merged without a conflict. See **Git workflow**.

### Interrupting a channel

**BOTH HALVES HAVE TO AGREE AND NEITHER IS ENOUGH**: an ability declares
`interruptibleChannel` and a list entry declares `interruptsChannel`, and
nothing is cancelled unless both do. That is what lets the panel offer a
checkbox safely, and what makes it meaningless in a list holding no
interruptible channel -- so it is not offered there.

- **`already_casting` IS NOT AN ANSWER ABOUT ANYTHING ELSE, AND A COMMENT HERE
  ARGUED THAT IT WAS.** `checkCast` reports ONE reason in a fixed order, and the
  cast lock is checked SECOND -- so an earlier reason hides every later one, and
  while a caster is channelling the global cooldown, the ability's own cooldown,
  its cost and its target are **never reached**. The comment reasoned "the cast
  lock is checked second, so nothing else is in the way"; checked second means
  everything else is checked LATER, which is to say not at all. **Every step
  true, conclusion backwards.**
  Ask the real question instead -- `castRejection(..., { ignoreCastLock: true })`
  -- which is "would this be castable if the channel were abandoned".
- **THE GLOBAL COOLDOWN STAYS CHECKED**, which is the one exception worth
  stating: cancelling a channel to sit on a running GCD throws the rest of it
  away and casts nothing.
- **A LIST THAT AVOIDS A BUG IS NOT A LIST THAT PROVES THERE IS NONE.** The
  stock Warlock list is the only one with interrupting entries, and all three
  are gated on an aura with no cooldown and no cost they could fail -- so their
  CONDITIONS did the work the broken check was supposed to do and it was never
  exercised. It took the panel letting somebody tick a box on an ability with a
  COOLDOWN: Mind Blast on the Shadow Priest cancelled Mind Flay on every poll
  for the whole eight seconds it was unavailable, taking the channel from ~30
  ticks a fight to zero.
- **A CHANNEL CAN PROTECT ITS FIRST N TICKS, AND MIND FLAY PROTECTS TWO OF
  THREE.** `Ability.protectedChannelTicks`, by the owner's ruling: "make sure it
  preserves a minimum of the first 2 ticks of Mind Flay and thus only cuts off
  the last tick when interrupted. **This may no longer be optimal play, but I
  still want the functionality so the user can choose.**" A THIRD condition on
  top of the two that already have to agree, and the engine owns it: enough of
  the channel has to have happened.
  **ON TICKS DELIVERED AND NOT ON ELAPSED TIME**, because a channel is hasted --
  the moment its second tick lands moves with the character's gear and only the
  COUNT is stable. `channelTicksDelivered` already existed, so this is a new
  READER of an existing fact.
  **DECLARED RATHER THAN DERIVED, WHICH IS THIS FILE'S USUAL PREFERENCE INVERTED
  ON PURPOSE.** "The first 2, and thus only the last one" reads as
  `channelTicks - 1` -- and ARCANE MISSILES is the only other interruptible
  channel here, at five ticks, which would silently become un-interruptible for
  its first FOUR on nobody's authority. **A ruling covers what it says and is not
  extended by analogy**, which already paid when Immolation Trap was ruled in and
  Explosive Trap waited to be named.
  **AND THE TWO PRIEST RULINGS PULL AGAINST EACH OTHER**, worth knowing before
  reading a figure for either: Improved Mind Flay compounds 20% a tick, so the
  three are 1, 1.2 and 1.44 of the base -- and the tick this now lets an
  interrupt take is the BIGGEST of them, **39.6% of the channel rather than a
  third of it.**
  **NO STOCK LIST REACHES IT**, because only the Warlock's three entries
  interrupt anything, so all 28 rows are bit-identical. That is the containment
  check and it is also the owner's framing: the feature is there so a user can
  tick the box.
- **AN INTERRUPTIBLE CHANNEL POLLS INSTEAD OF SLEEPING TO ITS END**, because the
  one moment it would otherwise wake is the moment the channel has already
  finished. `Rotation.interruptsChannels` gates that poll, because it is pure
  cost when no entry wants an interrupt -- marking Arcane Missiles and Mind Flay
  interruptible cost the Arcane Mage 13% more events a fight and the Shadow
  Priest 25% **for an identical combat log**. The hash was unchanged and
  `eventsProcessed` was not, which is the only reason it was visible: **print a
  mechanism's own quantity beside the hash, or a change that costs only time
  looks like no change at all.**
- **AND THE COUNT READS THE OTHER WAY TOO: FEWER EVENTS WITH MORE CASTS IS AN
  ACTOR THAT IS IDLE LESS.** The rule above is about a change that RAISES the
  count for an identical log, which is pure cost. The inverse is a finding:
  putting Hamstring at the bottom of the 2H Arms list took a fight from **33
  casts and 351 processed events to 42 casts and 247**, because an idle 100ms
  rotation poll that becomes a cast removes several polls at once.
  **THAT IS THE CHEAPEST AVAILABLE PROOF THAT A FILLER IS FILLING SOMETHING**,
  and it is what separated the same entry being worth **+26.74 on 2H Arms and
  -33.25 on DW Fury** -- Fury moved 44 casts and 449 events to 48 and 427,
  barely at all, because Heroic Strike already spends every spare rage and
  there is no idle moment to put a filler in. A DPS figure says which build
  liked it; the event count says WHY.

### The priority list on a profile

**PROFILE FORMAT 16**, and the list is written out IN FULL -- `source`, `name`
and every entry. (The list arrived at 13; 14 added the Gear panel's stat
valuation and the benchmark template id, neither of which the engine reads;
15 split the Weapon Effect consumable row into one category per HAND, and 16
added `precombat` -- what the character did before the pull.) The owner's call, and the opposite of how `combatStyle`
handles its default: a saved file is a complete description of the build, and
nothing about it depends on what this version thinks a Beast Mastery Hunter's
stock list is. [docs/apl.md](docs/apl.md).

- **AN ENTRY CAN COMBINE SEVERAL ABILITIES INTO ONE ACTION** -- `AplEntry.sequence`,
  the owner's "5 combo points is reached + 35 energy is reached -> use Cold
  Blood and then Eviscerate". **The condition gates the WHOLE thing and nothing
  may be cast between the steps**, which is the part two ordinary entries
  cannot express: a priority list makes a sequence by EMERGENCE, each step
  being in turn the highest castable entry, and that requires hoisting the
  follow-up above everything that could win the gap. Cold Blood is free and off
  the global cooldown, so the instant it goes out the list is re-read and
  anything affordable below it wins.
  **THE POINTER LIVES ON THE COMBATANT AND NOT ON THE ROTATION.** A compiled
  rotation is a MODULE-LEVEL CONSTANT -- `DRUID_CAT_ROTATION` and twenty-five
  siblings -- so state held there would be shared by every character running
  that list and by every iteration of a batch, which is exactly how one shared
  closure stopped Windfury proccing after the first iteration.
  **THE WHOLE SEQUENCE IS RESOLVED BEFORE ANY OF IT IS CAST**, which is the
  split `resolveCast` and `consumeCastCharges` already make: a sequence
  half-cast is worse than one not started, because Cold Blood spent with no
  Eviscerate behind it is a two-minute cooldown thrown away and nothing reports
  it. `CastCheckOptions.ignoreGcd` is what lets that question be asked at all,
  and it is `ignoreCastLock`'s shape exactly -- the GCD is checked THIRD, so
  reading `on_gcd` as an answer hides the cost, the cooldown, the stance and the
  target.
  **AND IT ABANDONS RATHER THAN BLOCKING**: a step refused for anything other
  than the GCD clears the pointer and lets the list resume, because an actor
  that stops acting would read as a DPS regression rather than as a deadlock.
- **A COOLDOWN CAN BE READ AS A CLOCK AS WELL AS A STATE** -- `cooldownTime`,
  the owner's "a 'seconds left' controller just like buff/debuff does". It
  mirrors `auraTime` including its absent case, and that case differs from the
  `cooldown` kind beside it ON PURPOSE: an ability the build lacks is NEITHER
  ready NOR on cooldown, because each is a positive claim about an ability that
  exists -- where a DURATION has no such pair and zero is what keeps
  `atMost 0` meaning "is ready".
- **THE COST IS THAT A SAVED PROFILE IS FROZEN, AND IT WAS CHOSEN KNOWINGLY.**
  A file keeps its list after a stock list is improved. Storing a REFERENCE
  would have let improvements reach old files and would have made the file
  depend on this build of the app; the owner picked the file.
- **`source` IS WHAT STOPS A STORED LIST BECOMING THE WRONG LIST.** Freezing a
  list means it stops following the BUILD, and the build is editable -- change a
  Rogue's capstone and a different stock list applies, change class and the
  stored list names another class's abilities. **`PriorityRotation` SKIPS AN
  ABILITY THE CHARACTER DOES NOT KNOW IN SILENCE**, so the symptom is a rotation
  that quietly does less. A `default` list re-derives on a build change the way
  gear is replaced when class changes; a `custom` one is never touched and the
  panel SAYS it no longer matches. **The Fire Mage that ran the Arcane list is
  what this is for.**
- **AND LOADING NEVER RE-DERIVES, WHICHEVER IT SAYS.** That is the freezing. The
  sync runs on edits made IN THE APP; a loaded file runs the list it carries.
- **THE MIGRATION DERIVES THE LIST RATHER THAN ADDING AN EMPTY ONE**, which is
  the one thing that would have changed a result: an empty list is a character
  that casts nothing, so a migration that just added the field would silently
  reduce every old profile to auto attacks. It is also the first migration that
  READS the rest of the profile -- every earlier one supplies a constant.
- **THE 25 PRESETS ARE WRAPPED, NOT EDITED.** `withStockRotations` fills each
  `build()` from `aplFor`, so a preset stores the list it was already running
  and no figure can move. Twenty-five hand-written copies would be
  twenty-five chances to store the wrong one -- which is the mistake
  `rotationIds.test.ts` exists for.
- **AN EDIT IS CHECKED BY ROUND-TRIPPING THE CONDITION, NOT BY RENDERING IT.**
  The panel parses a condition into a tree and emits it again, and a condition
  that comes back DIFFERENT is a rotation that changed because somebody opened a
  panel. `aplEditing.test.ts` asserts all 132 conditions in the stock lists
  survive unchanged -- it caught `!auras.has(id)` and `remainingMs(id) <= 0`
  being collapsed into one option, which differ on an aura that is present with
  nothing left and which the stock lists both use.
  **IT COVERED 81 OF 132 AT FIRST AND SKIPPED WHAT THE EDITOR COULD NOT DRAW**,
  which is the shape to avoid: a round-trip test that skips the hard cases
  asserts nothing about them. A leaf with no controls is a `fixed` node now --
  kept verbatim, shown as its sentence -- so there is nothing left to skip.
- **A LIST NAMING AN ABILITY THE BUILD LACKS STILL LOADS**, which is the
  `raidBuffs` rule rather than the `equipment` one: the engine already skips
  such an entry, and that is what lets one list serve several builds. **A
  BUILTIN CONDITION IS THE EXCEPTION AND IS CHECKED AT LOAD**, because
  `compileCondition` THROWS on an unknown id -- a profile naming one would load
  cleanly and fail when the fight starts, which is the worst place to find out.

### Before the pull

`CharacterProfile.precombat` is what the character did before combat started --
a stance, a form, Stealth, a pre-cast spell -- each with how long before. The
owner asked for it as "a small section above the main APL controller, but
within the same panel". `engine/abilities/precombat.ts`.

- **THE LEAD TIME IS REAL, ON THE OWNER'S RULING**, chosen over the alternative
  that it is only a feasibility budget. So it has exactly TWO observable
  consequences: an aura it applied has N seconds less left at the pull, and its
  own cooldown comes back N seconds sooner. **A pre-cast spell lands at t=0**,
  which is their own example and the only reading that can be simulated --
  there is no negative time for it to land in.
- **NOT A NEGATIVE CLOCK**, which is the obvious alternative. `SimulationClock`
  only moves forward and every scheduled event, swing timer and aura window is
  expressed against it; rebasing the fight to start at -2500 would touch all of
  them to buy exactly those two adjustments.
- **`AuraInstance.revision` EXISTS BECAUSE BOTH OBVIOUS DISCRIMINATORS FAIL.**
  The rewind has to age whatever the cast applied OR REFRESHED, and everything
  pre-combat happens at timestamp 0: `appliedAt` is unchanged by a refresh in
  the same millisecond, and `expiresAt` is unchanged whenever the aura was
  already at full duration. A Warrior pre-casting Battle Shout over the raid's
  own copy read as untouched and kept the full two minutes. **A counter is the
  fact**, which is `castSequence`'s argument about telling one USE from another.
- **`onPrecombat` IS A SECOND HOOK RATHER THAN `onCombatStart`, AND THE ORDER
  IS THE WHOLE REASON.** That one runs BEFORE the `openingAuras` loop, where a
  stance and a form are applied -- so a pre-combat action fired there would act
  on a character that is not yet in its stance.
- **IT IS NOT A FREE CAST.** The mana is spent and the cooldown runs, which is
  what a character who opened with a Fireball actually arrives with. What
  pre-combat mode skips is three things: the global cooldown it would start,
  the swing reset, and the cast time.
- **AND REGENERATION IS CREDITED ACROSS THE LEAD, WITH THE FIVE SECOND RULE
  STAMPED WHEN THE SPEND HAPPENED.** The owner's ruling -- "credit the regen and
  back-date the five-second rule" -- which makes the lead's observable
  consequences FOUR. The enumeration above said TWO when it was written and
  `accruesBeforeCombat` made it three, so **treat any list of them here as open
  rather than closed.**
  **THE WINDOW IS WALKED RATHER THAN COLLAPSED**: `runPrecombat` keeps a
  NEGATIVE local offset, credits each pool for the gap before every action, and
  credits the last gap to the pull. The clock is not moved and cannot be --
  `SimulationClock` only goes forward, which is the whole reason this feature
  resolves at timestamp zero -- so `ResourceRegen.amountPerTick` takes an
  optional `at`, and **each tick is evaluated at its own moment**.
  **THAT LAST PART IS THE RULE AND A SINGLE MULTIPLICATION WOULD GET IT
  WRONG.** `rate x seconds` hands a caster back every point the lockout should
  have suppressed; asking per tick is what makes the two halves of the ruling
  compose instead of cancel.
  **THE STAMP IS A PLAIN NUMBER AND A NEGATIVE ONE IS ARITHMETIC.**
  `spentWithin` asks `now - last < windowMs`, so a spend at -4500 reads as 4.5
  seconds ago at the pull and the lockout expires 500ms into the fight, by
  itself, with nothing to clear. Before this it sat at ZERO, so a Mage that
  drank Mage Armor 4.5 seconds early arrived with the FULL five seconds to run.
  **AND THE BOUNDARY TICK IS FREE, WHICH IS WORTH KNOWING BECAUSE A TEST GOT IT
  WRONG FIRST.** The comparison is STRICT, so the tick at exactly five seconds
  after a spend is already unlocked: a six-second lead credits **21** ticks of
  its one-second tail and not 20.
  **SO FOR A CASTER THE CREDIT IS USUALLY ZERO, AND THAT IS THE RULING WORKING
  RATHER THAN FAILING.** The openers spend mana and the back-dated lockout then
  suppresses exactly the regeneration the lead would have bought -- Fire spends
  900 mana at leads of 4.5s and 3s and gains **91** of it back. Energy has no
  such rule, so the two Combat Rogues really do bank **ten a second** across
  Blade Flurry's one-second lead: 75 energy at the pull becomes **85**.
  **TEN A SECOND AND NOT TWENTY, WHICH IS A FIGURE THIS PROJECT HAS ALREADY
  REJECTED ONCE.** `ENERGY_PER_SECOND` is `0.5 x 20` -- half an energy twenty
  times a second -- because the literal reading of "1 energy 20 times a second"
  was built, measured at +35% to +53% on every energy build, and withdrawn. The
  CADENCE is twenty and the RATE is ten, and quoting twenty is quoting the
  version that went back.
  **23 OF 28 ROWS ARE BIT-IDENTICAL, WHICH IS THE CONTAINMENT CHECK AND ALSO
  THE FINDING.** Only the two Combat Rogues and the three Mages move at all
  (-5.09, +0.71, +0.24, -0.17, +0.10; mean 798.91 -> 798.76), every one inside
  its own interval. **A POOL GAIN ONLY MOVES A FIGURE IF IT CROSSES A CAST'S
  COST AT A DECISION POINT** -- BM Hunter gains 63 mana and runs a
  BIT-IDENTICAL fight, because 63 does not buy another Aimed Shot, so no
  decision anywhere in the fight differs. That is why a change this broad can
  be this quiet, and why the two Combat Rogues moving in OPPOSITE directions on
  the same +10 energy is noise rather than a finding: one changed decision
  reorders the whole random stream.
  `tools/probe_precombat_pools.ts` prints the pool and the lockout remainder per
  profile, because neither has a zero anywhere to notice -- **a pool arriving
  short reads exactly like a pool that was meant to be short.**
- **A CHANNEL IS REFUSED** rather than relying on the zeroed cast time, which
  would deliver one tick's worth of effect and report it as the whole channel.
- **IT IS STORED ON THE PROFILE ROOT AND EDITED IN THE APL PANEL**, which is the
  one place where where-it-is-stored and where-it-is-edited differ.
  `syncDefaultRotation` REPLACES the whole `StoredRotation` object whenever a
  `default` list stops matching the build -- a talent, a stance, a class, even a
  consumable selection -- so a pre-combat list kept inside it would be silently
  wiped by any of them.
- **AND ONE OF ITS TESTS SAYS WHAT IT CANNOT PROVE.** "Throws away no swing"
  passed when probed against BOTH protections -- the hook moved after
  `startAutoAttack` AND the cast-time zeroing removed -- because at t=0 there is
  no swing in progress to lose. It is kept as a regression guard on the property
  and LABELLED as one, rather than left to imply it demonstrates a mechanism.

**AND ALL 28 PROFILES HAVE ONE NOW, WHICH IS THE FEATURE'S SECOND ROUND AND IS
WHERE EVERYTHING BELOW WAS ACTUALLY TESTED.** It shipped with the mechanism and
no caller -- "no preset carries a pre-combat list" was a sentence in its own
test -- and the owner then specified an opener for every profile in one message.

- **`secondsBefore` IS WHEN THE ACTION STARTED, AND FOR A CAST THAT IS NOT WHEN
  IT FINISHED.** The owner drew the distinction in their own wording: an instant
  is "3s before Battle Stance" and a cast is "**2.5s before start casting**
  Frostfire Bolt". **Every one of the ten "start casting" leads they gave is
  exactly that spell's cast time on that build** -- Wrath 1.5, Arcane Blast 1.5,
  Mind Blast 1.5, Lightning Bolt 2, Aimed Shot 2, Incinerate 2, Frostfire Bolt
  2.5, Fireball 3, **Sniper Shot 4**, and **Shadow Bolt 2.5 which is 3.0 MINUS
  BANE**. The last two are what make it a reading rather than a coincidence:
  neither is a number anybody would pick, and the second is not the figure on
  the ability at all.
  **SO `runPrecombat` AGES BY THE LEAD MINUS THE CAST TIME**, clamped at zero.
  Without it a pre-cast spell was incoherent with itself -- the damage landed at
  t=0 while everything the same cast applied was already aged: Fireball's DoT
  three seconds into an eight second burn, Arcane Blast's fifteen second window a
  tenth gone, Aimed Shot's six second cooldown back at t=4. **Two of those are a
  bigger number and no error.**
  **THE CLAMP IS A CASE AND NOT A GUARD**, because the owner's ORIGINAL example
  was "Cast Fireball <= 2.5 sec before combat initiates" -- a 2.5 second lead on
  a three second cast, which cannot have finished and therefore finishes at the
  pull.
  **AND THE OWNER HAS SINCE STATED THE PHRASING OUTRIGHT, WHICH CONFIRMS IT:**
  "'3s before Battle Stance' means t-minus 3 seconds from combat starting ...
  everything listed is meant to be a set sequence to properly initiate combat at
  0s with all non-combat skills already pre-fired." A lead is t-MINUS, and the
  sequence is complete AT zero -- which is the reading above, said from the
  other end: a three second cast begun at t-3 is one of the things that is
  "already pre-fired" by the pull.
- **IT SKIPS WHAT IT CANNOT DO IN SILENCE, SO SOMETHING HAS TO ASK WHETHER THE
  OPENER HAPPENED.** That is `PriorityRotation`'s rule and it is right -- a plan
  can be unaffordable -- but it makes a mistyped id or a wrong ORDER into a line
  that reads perfectly and does nothing. `precombatOpeners.test.ts` transcribes
  the owner's message a second time and then drives all 28 fights, asserting
  each action emits a cast at timestamp zero.
  **IT FOUND TWO THE MOMENT IT RAN, AND ONE OF THEM THE OWNER THEN FIXED.**
  Mongoose Bite "can only be performed after you dodge" and its only route here
  is Expose Prey's 10% proc on a landed attack -- so before the pull the window
  cannot be open, on both melee Hunters. Reported, and the answer was a
  substitution: "good catch. Replace Mongoose Bite with Strider kick instead for
  those pre-combat instances." **Strider Kick has no gate at all**, the bite
  keeps its list entry, and what was impossible was only the OPENING.
  And **BATTLE SHOUT COSTS 10 RAGE AND A WARRIOR OPENS ON AN EMPTY BAR**, so a
  shout written before its Bloodrage is refused: the owner's own openers put
  them in the right order at one lead time, and THREE hand-built test fixtures
  did not. `Array.prototype.sort` being stable is the whole mechanism keeping
  two actions at the same lead in declaration order.
- **A PERIODIC EFFECT'S ACCRUED RESOURCE SURVIVES THE PULL, AND IT HAS TO BE
  DECLARED.** Bloodrage is "10 rage at once and another 1 a second for 10
  seconds", the owner's openers press it at a TEN second lead, and the aura was
  therefore aged past its own end and removed with the over-time half
  undelivered -- **the warrior arrived with 10 of the owner's stated 20**.
  `PeriodicEffect.accruesBeforeCombat` is the fix.
  **DECLARED RATHER THAN DERIVED, because the engine cannot tell the two kinds
  of periodic apart**: both are an `onTick` closure and what it does is decided
  inside. A resource granted to the CARRIER is accrual the character arrives
  with; damage dealt to a TARGET is damage in a fight that had not started. So
  the default loses the elapsed ticks, which is what every DoT wants, and
  Bloodrage is the one caller.
  **THE ARITHMETIC DOES NOT DOUBLE-COUNT AT A SHORTER LEAD**, which is the half
  to check rather than reason about: the ticks already scheduled keep firing
  after the pull and stop when the AGED window closes, so a four-second lead is
  four before and six after. Probed by switching the flag off -- 10 against 20,
  exactly the two halves.
- **SEVEN OF THE OWNER'S LINES NAME A STATE RATHER THAN A CAST, AND ALL SEVEN
  ARE LISTED ANYWAY.** "2s before Stealth" on three Rogues -- `openingAuras`
  carry `stealth` and there is no Stealth ABILITY -- and "Cat Form", "Moonkin
  Form" and "Dire Bear Form", which are COMBAT STYLES. `onPrecombat` runs AFTER
  the `openingAuras` loop, so each character is already in the state the line
  asks for.
  **THEY WERE OMITTED FIRST AND THE OWNER ASKED FOR THEM BACK**: "Even if lines
  were already true, like Moonkin Form, just leave it in the pre-combat so users
  know that." The argument for leaving them out was that `runPrecombat` finds no
  ability and skips in silence, so the entry does nothing -- true of the ENGINE
  and beside the point. **A pre-combat list is also the thing a person reads to
  see how the fight opens, and a missing step reads as a step not taken.**
  **SO `PRECOMBAT_STATES` CARRIES THEM WITH WHAT MAKES EACH ONE TRUE**, and the
  two readers that would otherwise misreport them use it: the APL panel, which
  labelled them "(not in this build)" -- exactly backwards on the row somebody
  is checking -- and the opener guard, which asserts every action FIRES. **It is
  not a way to declare something inert**: each entry reads the PROFILE, so a
  Moonkin naming `cat_form` is still wrong, and `precombatOpeners.test.ts`
  drives that both ways.
- **MOVING AN ENTRY OUT OF A LIST AND INTO AN OPENER IS NOT NEUTRAL FOR
  ANYTHING THAT SHARES THAT LIST.** The owner asked for Charge, the stance and
  Battle Shout out of the three Warrior PROFILES, and a profile-specific list is
  also what any hand-built character of that style and stance runs -- so such a
  character now gets none of the three unless it declares them. The two GENERIC
  Warrior lists keep theirs, which is the right scope and is why they were left
  alone. **Four test fixtures had to be given openers** before their assertions
  about Battle Shout meant anything again.
- **AND A PRECOMBAT ACTION WAS INVISIBLE TO `USES=1`, WHICH IS THE REPORTING
  HALF OF THE SAME CHANGE.** A pre-combat cast is not a list entry, so the uses
  loop never reaches it, and the "not in the list, and still dealing damage"
  block filters on `damage > 0` -- which a shout and a stance never have. So
  three actions a fight simply vanished from the report the day they moved.
  `measure_profiles.ts` prints a **"before the pull"** block now, with a
  `<-- NEVER HAPPENED` flag, because a zero there is the finding for exactly the
  reason a zero in the list is.
- **A ZERO-SECOND ACTION IS OFF THE GLOBAL COOLDOWN, AND THAT IS THE DESIGN
  RATHER THAN A LOOPHOLE.** The Bear's whole opener is "Enrage + Mighty Rage
  Potion + queue Maul + Primal Bite" at 0s, and only Primal Bite would have cost
  a GCD in the fight. Pre-combat mode skips the GCD it would start, the swing
  reset and the cast time -- so an opener really is four actions in the instant
  a list could spend one, which is what "before the pull" means.
- **"QUEUE" IS A WORD THE OWNER USED AND THE ENGINE ALREADY HAD.** Heroic
  Strike, Maul and Raptor Strike are on-next-swing: `castAbility` ARMS one --
  paid for now, delivered by the first swing that lands -- and returns before
  the cast path. So "0s queue Heroic Strike" is exactly what happens to it, and
  it spends the rage Bloodrage just banked.

### Editing a priority list

The panel parses a condition into a TREE -- a group matching `all of` or
`any of`, holding clauses and nested groups, with a `not` flag on every node --
and emits it again. `ui/panels/aplEditing.ts` holds that apart from the
component, because it is the part that can be wrong.

- **A FLAT LIST OF ANDed CLAUSES LOCKED 51 OF 132 CONDITIONS**, which is what
  the first editor was. One `not` anywhere, or one `any`, made the WHOLE
  condition read-only -- the Rogue's pooling gates, the Paladin's entire seal
  twist, the Mage's Scorch, the Priest's hold band.
- **AND A LEAF THE PANEL CANNOT DRAW NO LONGER POISONS THE REST**, which turned
  out to be the larger half and was not the thing asked for. A builtin or a
  swing-timer read is ONE `fixed` row inside a tree that is otherwise fully
  editable; before, one of them made everything around it read-only too.
- **AN EDITOR THAT CANNOT EXPRESS SOMETHING MUST SAY SO RATHER THAN SIMPLIFY
  IT.** A `fixed` node is shown as its sentence, can be negated, moved or
  removed, and cannot be rewritten. Silently redrawing the Rogue's
  `not(poolingForAmbush)` as something the controls could hold would change the
  rotation with nothing on screen to say so.
- **`not` IS A FLAG AND A DOUBLE NEGATION IS KEPT WHOLE.** `not(not(x))` and
  `x` mean the same thing and are not the same DATA, and the editor's one
  promise is that opening a condition and changing nothing leaves it
  byte-identical -- so a flag that cannot hold two negations keeps the whole
  thing as a fixed leaf rather than collapsing it.
- **AN ENTRY CAN BE SWITCHED OFF INSTEAD OF REMOVED** -- `AplEntry.disabled`,
  and the eye button in the panel. Removing a line to see what it is worth and
  adding it back means retyping its condition, its note and its interrupt flag,
  which is the thing this editor exists to make unnecessary.
  **FILTERED IN `compileRotation`, NOT CHECKED IN `selectAction`**, and the
  reason is the second kind of cost: `PriorityRotation` computes
  `interruptsChannels` ONCE in its constructor, so a disabled INTERRUPTING entry
  would still make the actor poll its channel every 100ms -- invisible, because
  the combat log stays byte-identical and only `eventsProcessed` moves.
  **THE FLAG IS DROPPED RATHER THAN STORED AS `false`**, because a stored list is
  compared to the stock one BY VALUE and an entry switched off and on again has
  to come back byte-identical. Absent means active, so no migration.
  **AND IT SHIPS IN A STOCK LIST NOW, WHICH IT NEVER DID BEFORE.** It was built
  as an EDITING convenience and nothing checked in carried one, until the owner
  ruled that Recklessness belongs in both damage Warrior lists and **"default
  disabled in the APL"**. So an off-by-default entry is a way to carry a
  MEASURED option: deleting it would lose the measurement and the placement with
  it, and an entry with no measured position is one somebody has to measure
  again before they can use it. Worth **+94.15** to DW Fury and **+37.91** to 2H
  Arms when the eye is opened, and the published figures do not include it.
  **THE PRICE IS A SIXTH CAUSE OF A NEVER-FIRED ENTRY** -- see the list of
  causes under **Rotations**, because the tool reported it as a defect.
- **A STORED LIST IS NARROWED BY RACE, AND THE ENGINE NEVER NEEDED THAT.** Every
  list names all four free racial cooldowns -- the shared constant is spread
  into lists belonging to no race -- and `PriorityRotation` skips what the
  character does not know in SILENCE, so all 75 combat-log hashes and event
  counts are identical with them in or out. **What it cost was a PERSON reading
  the panel**: three of an Orc's first four entries were abilities no Orc can
  cast. `withoutOtherRacials` drops them, and **only a RACIAL may be dropped** --
  the wider "drop what the build lacks" would delete a capstone a list names for
  a sibling spec.
  **AND `syncDefaultRotation` HAD TO STOP COMPARING BY NAME.** For class, style,
  stance and talents a different build means a different list NAME; race does
  not work that way, so an Orc and a Gnome Warrior run the same named list with
  different entries, and a name comparison left Blood Fury in after a race
  change.
- **A NEW ENTRY GOES AT THE BOTTOM**, the only position that cannot change what
  the list already does: an unconditional entry anywhere else is a FLOOR under
  everything below it. **Moving past either end is a no-op rather than a wrap**,
  because position IS priority.
- **AND THE STRICT COMPARISONS ARE NOT DECORATION.** Leaving `below` and `above`
  out of the editor locked every stock condition using one -- "under 5 stacks",
  "under 15% mana" -- by itself.

### Offering a buff by name

`game/auras/auraCatalog.ts` derives what a class can be asked about, so a
condition is built from a dropdown rather than by typing an aura id.

- **A HALF-TYPED ID IS WORSE THAN A WRONG ONE.** An aura that does not exist is
  never present, so `is up` is permanently FALSE and `has run out` is
  permanently TRUE -- one silently disables an entry and the other silently
  ungates it, with nothing on screen to say which. A dropdown cannot produce
  either.
- **FINDING AURAS BY SHAPE MISSES EVERY ONE BUILT BY A FACTORY, AND THAT IS 20
  OF THEM.** The catalog walks a module's exports and keeps whatever looks like
  an `AuraDefinition`, which finds every aura declared as a CONSTANT and none
  returned by a function. Rip is `ripAura(comboPoints)` because its damage
  depends on the points spent; so are Deep Wounds, Ignite, Flurry, Blood Craze,
  Expose Armor, Deadly Poison, Shadow Weaving and thirteen more. Each module
  exports a `CATALOG_AURAS` list now, built by calling its own factories --
  **the representative argument belongs beside the factory**, because the
  catalog would otherwise be guessing and would break from a distance the day a
  factory gained a required parameter.
- **NOTHING IN THE SUITE COULD HAVE CAUGHT IT**, which is why the test for it
  reads the SOURCE. Every earlier assertion was about ids the stock LISTS
  mention, and no stock list mentions Rip's aura -- the Cat gates Rip on combo
  points. `auraCatalog.test.ts` scans `game/auras/*.ts` for every aura
  definition and fails naming the aura and the file.
- **TALENT AURAS ARE NARROWED BY THE CLASS'S OWN TREE.** `TALENT_AURAS` is keyed
  by TALENT id and talent ids are unique only WITHIN a class, so the record
  alone cannot attribute an entry -- without `talentsForClass` every class was
  offered the Warrior's Anger Management.
- **BOTH GROUPS ARE ALWAYS OFFERED, ORDERED RATHER THAN FILTERED.** Showing only
  debuffs for a target clause would be tidier and wrong: the Druid's Bear list
  asks whether the TARGET has the WARRIOR's Demoralizing Shout. Hiding one a
  list can legitimately name sends somebody back to hunting for ids.

### Saving and loading a profile

The Save button writes `serializeProfile` to a file and the Load button reads it
back through `parseProfile`, which is parse -> **MIGRATE** -> validate in that
order. `docs/handoff/gui.md`.

- **THE SAVED FILE IS THE PROFILE'S OWN JSON, AND THE VERSION FIELD IS WHY.** A
  separate "build text file" was the obvious ask and would have been a second
  serializer to keep in step with `CharacterProfile`, with no migration path: a
  profile already carries `version` and twelve migrations already exist, so a
  file saved today still opens after the format moves on. **The thing a second
  format silently loses is not the fields, it is the ability to CHANGE them.**
- **`validateProfile` REBUILDS THE PROFILE FIELD BY FIELD, so a field nobody
  NAMES there is dropped on load in silence — AND IT HAS NOW HAPPENED TWICE IN
  THE SAME FUNCTION.** The rebuild exists so unknown keys cannot ride along,
  which is right; the cost is that every field is opt-in. `stance` was found
  missing and fixed with a comment recording the lesson, and **`petFamily`
  arrived later, was never added, and repeated it directly underneath that
  comment**. A comment recording a lesson is not a mechanism, which is the same
  thing this file says about a "build once" note in nine parallel briefs.
  **THE PRICE WAS PAID ENTIRELY BY THE FALLBACKS.** Nothing errored, because
  every consumer handles a missing family: a Hunter's `petFor` falls back to
  `cat`, so a Wolf came back a Cat with a damage modifier of 1.1 instead of 1.0
  — and `sacrificedDemon` does NOT fall back, so **both Warlock presets lost
  Demonic Sacrifice entirely**, 15% of a school's damage, on a profile that
  loaded with no issue raised.
- **SO THE TEST IS A WHOLE-STRUCTURE COMPARISON, NOT A LIST OF FIELDS.**
  `tests/profiles/roundTrip.test.ts` round-trips all 25 presets and asserts
  `toEqual` on the entire profile, because **a test naming the fields is a
  second copy of the rebuild with the same hole available to it** — whoever
  forgets the field forgets the assertion. Compare STRUCTURALLY and not by text:
  the rebuild emits its own key order, so all 25 differ as JSON and none differs
  as a character.
- **NO PUBLISHED FIGURE MOVED, BECAUSE NOTHING MEASURES THROUGH THAT PATH.**
  `validateProfile` has no caller in `tools/` or in `simulator`: a preset goes
  from `preset.build()` straight to the engine, so the baseline table never saw
  the dropped field. **It was reachable only by a user saving and loading, which
  is a thing nobody could do until Save existed** — check which path a
  correctness fix is actually on before re-measuring, and say so either way.
- **A FILE INPUT FIRES `change` ONLY WHEN ITS VALUE CHANGES**, so picking the
  same file twice is silent the second time — which is exactly what somebody
  does after editing a build on disk. Clear `event.target.value` BEFORE the
  await, so the next pick is a change whatever the read does.

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

**A PRIORITY LIST IS DATA, NOT CODE, AND THAT IS RECENT.**
`PriorityEntry.condition` is a closure and always was; a list is now written as
`AplList` -- plain JSON-safe objects -- and `compileRotation` turns one into the
closures the engine runs, once, when the character is built.
`src/game/rotations/apl/`, and [docs/apl.md](docs/apl.md).

- **IT EXISTS BECAUSE A FUNCTION CANNOT BE SAVED, SHOWN OR EDITED.** The list
  decided most of a build's damage and was the one part of a character with no
  panel, no profile field and no way to change it without editing TypeScript.
  Everything else about this is downstream of that one fact.
- **THE CONVERSION OF ALL 26 LISTS CHANGED NOTHING, AND THE PROOF IS NOT A DPS
  FIGURE.** `tools/rotation_fingerprint.ts` hashes the COMBAT LOG of all 25
  presets over three seeds -- the log is a pure formatter over the whole
  telemetry stream, so it carries every cast, swing, aura and tick in order.
  All 75 hashes are unchanged. **That is stronger than `measure_profiles.ts`
  for this question and about a hundred times cheaper**: a mean answers "did
  the published figure move", which is a question about variance and needs 300
  fights a profile; a hash answers "did any decision change", which is a
  question about identity and needs three. The engine draws from ONE random
  stream, so a single differing decision reorders every later draw and the rest
  of the fight diverges completely -- the property that ruins paired
  measurement is what makes this check sharp.
  **BUT IT HASHES THE LOG, SO ANYTHING THAT ADDS A LINE TO THE LOG DIFFERS BY
  CONSTRUCTION AND THE CHECK SAYS NOTHING.** Selecting one more raid buff on
  all 25 presets moved **all 84 hashes** and that is not a finding: an aura
  applied at the pull writes a line and consumes no random number, so a pure
  melee build whose new buff grants `spellCritChance` runs the identical fight
  and still reports a different hash. **The hash answers "is this log
  byte-identical", which is the same question as "did any decision change" only
  for a change that cannot write a line** -- a refactor, an item nobody wears,
  a condition nobody reaches. `eventsProcessed` is no substitute either: it was
  unchanged on 20 of 28 profiles across that commit, and a fight can diverge
  completely while processing the same number of events. **Say which question
  the tool is answering before offering a hash as a containment check**, and
  where the change legitimately touches a stat, the containment check is the
  MECHANISM -- which stat the aura moves, asserted on the stat.
- **MIRROR THE SOURCE'S COMPARISON EXACTLY, INCLUDING STRICTNESS.** The nine
  class files had written `< cap` and `<= cap` and `!has()` and
  `remainingMs() <= 0` in different places and MEANT both of each pair, so
  `AplCompare` carries `below` and `above` beside `atLeast` and `atMost`, and
  `aura present` is a different test from `auraTime atMost 0`. An aura can be
  present with nothing left on it.
- **THE SAME HELPER NAME MEANT DIFFERENT THINGS IN DIFFERENT FILES.** `expired`
  read the TARGET's aura in five files while the Hunter wrote `selfExpired`
  beside it for its own; `missing`, `missingOn`, `withoutAura`, `selfLacks` and
  `actorHas` were five names over two tests. Every builder in `apl/shorthand.ts`
  says WHOSE aura it is in its own name, because that is the one mistranslation
  that converts silently -- both readings compile and both produce an ordinary
  rotation.
- **AND TWO CLASSES DISAGREED ABOUT AN ABILITY THE BUILD DOES NOT HAVE.**
  `chargesAvailable` returns 0 for an absent ability, so `isReady` is false, so
  the Paladin's unguarded `!isReady` reported an ability it never learned as
  PERMANENTLY on cooldown while the Rogue's guarded version said the opposite.
  Both survive: `{ state: 'onCooldown' }` is the Rogue's and `not(ready(...))`
  is the Paladin's. **Check what a predicate says about the ABSENT case before
  folding two class helpers into one.**
- **THREE CONDITIONS RESISTED BEING DATA AND ARE AN HONEST ESCAPE HATCH.**
  `{ kind: 'builtin', id, args }` names a closure in a registry -- the Warrior's
  rage pooling, Charge's stance gate, the Hawk cap and Slam's swing-timer
  talent. It serialises, survives a save and a load, and describes itself, so an
  entry carrying one can be reordered or removed; what it cannot be is rewritten
  in a panel, and the panel says so rather than offering an editor that would
  drop the half it cannot express. **The registry THROWS on an unknown id**,
  which is the opposite of `TALENT_AURAS`' deliberate silent drop: a talent that
  does nothing is visible, and an entry that LOSES its gate fires far more often
  than it should, which is a bigger number and no error.
- **A LIST NAMES ITSELF NOW, so `rotationName` is gone from the registry.** It
  was written out beside the entries because the only alternative was reading it
  off a compiled rotation; `compileRotation` puts `list.name` on the rotation, so
  the two cannot disagree. **One name I retyped by hand drifted** -- "Two-Hander"
  to "Two-Hand" -- and `presets.test.ts` caught it, which is what that test is
  for.
- **`aplFor` GOES THROUGH `rotationFor` AND LOOKS THE RESULT UP BY NAME** rather
  than repeating a dispatch that is nine rules in five patterns. A second copy
  would be the shape this file documents everywhere else: both compile, both
  produce a plausible list, and the one that drifts is the one nobody measured.


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
  **BUT THE OWNER KEEPS THE BASELINE, AND A FULL RE-MEASURE PER ROUND IS WASTE.**
  Their instruction, after several rounds of it: *"don't deliberate so much over
  baselining. I'm already doing that and tell you what to implement. it's fine if
  you catch something but often times we're wasting hours a day re-baselining
  profiles."* So a round of APL work is implement, `npm run typecheck`,
  `npm test` and **`USES=1 SEEDS=3 PROFILES=<id>`** -- that last one stays
  because it is seconds and it catches the entry that cannot fire, which is the
  commonest rotation bug here and the one a correct-looking list hides. Then
  commit, push, PR. **Measure only when the change itself raises a question a
  figure answers** -- a suspected bug, or something flagged that the owner asks
  about -- and say what was NOT measured rather than measuring to be safe.
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

**AND THE SENTENCE THAT SAID SO WAS FALSE FOR A WHOLE RELEASE.** This file and
the commit that merged it both stated that `cat_attribution.py` "counts its
matches now", and it did not -- it tested `if find not in text`, which is
presence. Nobody was lied to by the code; they were lied to by the note ABOVE
the code, which is the pattern this file records under **Three causes of
inert**: a reason that describes a working half is a claim about the code and
can simply be false. **A lesson is not landed until the tool that learned it
actually implements it**, and the cheapest way to check is to grep the tool for
the thing the note says it does.

**AND AN ANCHOR THAT IS NOT IN EVERY MEMBER OF THE SET SILENTLY LANDS IN THE
NEXT ONE.** A script adding a line to all 24 presets anchored on each preset's
`raidBuffs: [...PRESET_RAID_BUFFS],`, searching forward from its `id:`. Four
presets do not carry that line verbatim -- **the two ranged Hunters and the
Moonkin SWAP an entry and the Enhancement Shaman DROPS one**, which this file
documents two sections up -- so the search ran past them and wrote four rows
onto the WRONG PROFILES. It typechecked everywhere the duplicate keys did not
collide. **Anchor on something every member has** (`equipment:` here), and the
tell was the typechecker reporting a duplicate property in four object literals
rather than none.

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
- **AND A GATE CAN BE WORTH POSITIVE DPS, WHICH IS NOT THE USUAL DIRECTION.**
  Every other condition in this file costs something -- it refuses a cast that
  would otherwise have happened. An ability that GRANTS a resource is the
  exception: the Cat's Shifting Power gives 40 energy against a cap of 100, so
  gating it on `energy <= 50` made the list cast it **less** (8.00 to 7.45 a
  fight) and collect **more** (280.0 to 298.0), worth **+13.2**. The ungated
  version wasted 40.0 energy a fight, 12.5% of everything it granted, and the
  reliable waster is THE PULL -- every fight opens at a full bar. **`wasted` on
  the `resource_gained` event is what shows it**; a DPS figure alone cannot say
  which half moved.
- **AND THE GATE'S NUMBER IS THE OWNER'S, NOT THE ARITHMETIC'S.** 40 into a cap
  of 100 overflows above **60**, and the owner stated **50** -- so the gate sits
  ten energy inside the no-waste region rather than on its edge. Both waste
  nothing, so a reader who DERIVES the threshold from the grant gets a
  defensible, different, wrong number. Assert that a stated boundary is SAFE
  rather than that it is tight.

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

**A RACE CANNOT BE ISOLATED BY A BEFORE-AND-AFTER, AND THE CONTROL HAS TO BE
CHOSEN RATHER THAN ASSUMED.** Racials moved all 25 rows at once, so every row
carries its own race's traits AND the 100ms poll the lists now pay; and a weapon
specialization cannot be isolated by removing the weapon, because Obsidian Edged
Blade and Azuresong Mageblade both carry "+1% crit with all spells and attacks"
-- that probe returned 1.000 and 3.269 where the racial is 0 and 2.
**SWAP THE RACE ON IDENTICAL GEAR**, which holds the items, talents, enchants,
consumables, raid buffs and list fixed. `tools/probe_racial_worth.ts`.
**AND THE COMPARISON RACE'S OWN FOUR TRAITS HAVE TO BE INERT FOR THAT BUILD,
WHICH IS A FACT TO LOOK UP AND NOT TO GUESS.** Comparing a Tauren Druid against
a Night Elf measured ELUNE'S LIGHT: all three rows came back near -12 and read
as the Tauren traits being worth negative DPS. Comparing a Human Paladin against
an Undead measured "+2% crit minus Touch of the Grave". **Print the control
beside the figure**, or a reader cannot tell which of the two races a row is
about.

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

**AND A CAUSE THAT IS NOT A PROBLEM AT ALL: THE OWNER MEANT IT.** Evocation is
in all three Mage lists at a 10% mana gate, by the owner's instruction, and fires
**zero times on every one of them** -- no build drops that low since Heating Up
changed. Reported with the threshold offered as the thing to move, the ruling was
"This is intended". **So a never-fired entry is a question for the owner before
it is a defect**, and the second time their list has outranked a measurement of
ours after Hunter's Mark's -10.1. The honest reading is a safety net that costs
nothing: a conditional entry that is almost never true costs the entries below it
nothing, and it pays out in a fight that goes differently from the ones measured.
**Pin the zero as a FACT** -- `mageAbilities.test.ts` fails if Evocation starts
firing, which is the right moment to go back and ask again.

**AND A FIFTH CAUSE, WHICH IS THE ENGINE SIDE OF THE SAME COIN: THE CONDITION
READS SOMETHING NOTHING SETS.** `Combatant.recordSwing` was added so the Hunter
lists could ask "has a ranged auto-attack fired in the last 0.5 seconds", and it
landed in `extraAttack` instead of `scheduleSwing` -- two functions carrying the
SAME TWO LINES, so the edit matched the wrong one. The window never opened,
Aimed Shot and Sniper Shot fired zero times in three lists, nothing errored, and
the comment beside the mistake asserted the opposite of what the code did. **When
a new condition primitive is added, the `USES=1` pass IS the test that it
fires** -- the suite passed with it broken.

**AND A SIXTH, WHICH IS THE ONLY ONE THAT IS A SETTING: THE ENTRY IS SWITCHED
OFF.** `AplEntry.disabled` was an EDITING convenience with no shipped caller
until the owner ruled Recklessness into both damage Warrior lists and "default
disabled in the APL". `compileRotation` filters it, so it reports 0.00 uses --
and `USES=1` printed `<-- NEVER FIRED`, **the loudest flag that tool has,
pointed at the one cause that is somebody's decision.** It reads
`(switched off in the list)` now.

**IT IS THE SAME FIX AS `(not learned by this build)` AND FOR THE SAME REASON.**
That flag exists because every list names all four racial cooldowns and a
character learns one, so three or four honest zeros a profile looked like
findings. **A zero has to say which kind it is, or the flag that means "this is
the bug" stops meaning anything** -- which is the cost of adding a cause without
teaching the reporting about it.

**AND THE HEADER ABOVE SAYS FOUR, WHICH IS THIS FILE'S OWN COUNT PROBLEM AGAIN.**
Counted from the paragraphs rather than incremented: the id names no ability;
the build never learned it; the entry above never yields; the ENCOUNTER already
supplies it; the condition reads something nothing sets; **the entry is switched
off** -- SIX, and SEVEN with "the owner meant it", which is deliberately filed
as not-a-problem. The sentence that opens this section was written when there
were four and each addition has been labelled by its own ordinal since, so
**re-count the paragraphs rather than trusting the number in the header.**

**"A NEW ENTRY GOES AT THE BOTTOM" IS A RULE ABOUT AN ENTRY THAT COSTS
SOMETHING, AND BOTH ENDS OF THE LIST WERE MEASURED TO FIND THAT OUT.** The four
free racial cooldowns are learned by a RACE, so no class list was ever going to
name them and an ability in the book and in no list never fires.

| | what happened |
| --- | --- |
| **top** | **Charge went from one cast a fight to ZERO.** Its `canCast` is `clock.now() === CHARGE_OPENING_TIMESTAMP_MS` -- castable for one instant and never again -- and an off-GCD cast leaves the actor FREE, so `nextDecisionTime` returns `now + ROTATION_POLL_MS` and the window is gone |
| **bottom** | the documented rule, "the only position that cannot change what the list already does" -- and **five of seven** profiles never cast their racial, because a list with anything castable never falls that far |

They sit SECOND now, after whatever opens the list, and **LAST in a tank list**
so nothing can delay a survival cooldown -- which is the argument
`protectionRotation.test.ts` already made about Charge in its own words.
**WHAT A FREE OFF-GCD CAST COSTS IS ONE POLL**, 100ms of idle because the actor
is not busy, which is about 0.17% of a fight at a two or three minute cooldown
and is the same price Bloodrage already pays.

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

**AN ABILITY CAN BE PRESSED FOR ITS PROCS AND NOT FOR ITS DAMAGE, AND THE TWO
HALVES ISOLATE SEPARATELY.** Wing Clip is 50 flat damage with no coefficient and
is worth +41.2 to the melee Hunter; patching the damage out leaves +16.7 and
dropping its `weaponSlot` leaves +12.8, so **the triggering is the larger half**
and a version whose damage was right and whose `weaponSlot` was missing would
have reported the same 3.6% share and looked like a working ability. Both
decompositions summing to the measured total is what says the patches isolated
what they claimed to.

**AND PATCH SUCH A DAMAGE TO ONE, NEVER TO ZERO.** An attack dealing 0 is refused
by every reaction that reads `amount`, so zeroing it switches off the procs being
measured and reports them as worthless. One damage costs 0.2 DPS and keeps every
roll.

**ISOLATE A LOSS, DO NOT BLAME THE OBVIOUS SUSPECT.** The owner's Venom list
measured -24.3 and the suspect was its Venom entry, which THREE earlier
placements had each measured as a loss. It was not: removing the entry dropped
the list to 375.0, so it is worth +17.7 there. The whole -24.3 is the two
aura-duration floors on Eviscerate -- gating it on five combo points alone gives
413.1, inside the interval -- because the floors suppress it to 0.2 casts a fight
and the points overflow instead. **A prior measurement is true of the list it was
taken in**, and "a point spent on Venom is a point not spent on Eviscerate" stops
holding when Eviscerate cannot fire.

**AND A CONDITION CAN BE ALWAYS-TRUE BECAUSE THE BUILD CANNOT REACH THE THING
IT ASKS ABOUT.** "Scorch if the Fire Vulnerability debuff is below five stacks"
is permanently true for a Mage WITHOUT Improved Scorch, because nothing applies
the debuff -- so Scorch becomes an unconditional entry near the top of two
lists and everything beneath it is unreachable. Same failure as the `<= 5`
reading, from the other direction. The guard reads the built character's
REACTIONS, which is what the talent leaves behind: `hasReaction` rather than a
talent id, the arrangement Vanguard and Charge already use. **Asking the ability
book would not work** -- Scorch is a trainer spell every Mage owns.

**A CHANNEL CAN BE CANCELLED MID-CAST, AND BOTH HALVES HAVE TO AGREE.**
`Ability.interruptibleChannel` says a channel is willing and
`PriorityEntry.interruptsChannel` says an entry is worth it; neither alone does
anything, so adding an urgent entry does not silently start cutting channels
short and marking a channel interruptible does not put it at the mercy of
everything above it. **IT IS NOT "ANY ENTRY ABOVE THE CHANNEL"** -- that is the
shortcut that resembles the rule, and for Wrack it would have been right about
three entries and wrong about two, because Siphon Life and Life Tap sit above it
and are not urgent. `selectInterrupt` accepts a candidate only when
`already_casting` is the SOLE rejection reason, so the channel is never discarded
for a cast that then cannot happen. **A cancelled channel has still PAID**: 1
interrupt in 138 lands before the first tick, so 200 mana buys nothing, and that
is what starting a channel costs rather than a bug.

**AND AN INTERRUPT RULE CAN RETIRE A CONDITION RATHER THAN JOIN IT.** Wrack was
gated on "all three bleeds have six seconds left" -- a conservative answer to
"can I afford to stop acting", asked because a channel was a commitment. Being
able to leave the channel made the question stop needing an answer, and deleting
the gate deleted the coupling that had already produced one wrong measurement.
**The best fix for a fragile condition is sometimes a capability that makes it
unnecessary.**

**AND THE THIRD TIME IT DISABLED A DIFFERENT ENTRY THAN THE ONE BEING CHANGED.**
Wrack's gate is "all three bleeds have six seconds left" and one of the three
is Siphon Life -- so asked whether Siphon Life was worth casting, removing its
entry took WRACK from 5.7 casts a fight to ZERO, because an aura nothing
applies can never have six seconds left. The profile read 452.4 and looked
like a clean -24.1; the honest figure, with the gate repaired first, is -13.6.
**A measurement that removes one entry can silently remove another**, so when
an entry names an aura, grep for who else reads it before measuring its
removal -- and read the `USES=1` column, which is where the zero shows.

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

**WHAT A CLASS MAY EQUIP IS THE OWNER'S OWN TABLE, AND ASKING FOR IT BEAT EVERY
ALTERNATIVE.** Nothing in the six data sources states a proficiency -- not the
spellbook captures, not `talentsforever.com`, not `foreverchanges.pro` -- so
the honest options were to borrow Classic's behind a `PLACEHOLDER_` name or to
ask. Asking produced all 27 columns for all nine classes in one message, and
**three rows disagree with Classic**:

| | Forever | Classic |
| --- | --- | --- |
| Rogue, one-handed axe | **may** | may not, until Burning Crusade |
| Druid, dagger | **may not** | may |
| Hunter, two-handed axe and polearm | **may**, and no mace of either size | the same, and it reads wrong |

**SO A CLASSIC TABLE WOULD HAVE BEEN WRONG IN BOTH DIRECTIONS ON THE ONE CLASS
THE OWNER USED AS THE EXAMPLE.** `game/character/proficiency.ts` holds it and
`proficiency.test.ts` transcribes it a SECOND time in the owner's own
`TRUE`/`FALSE` grid, so an error has to be made twice in two different shapes
to survive.

- **AN ARMOUR CLASS APPLIES TO THE EIGHT ARMOUR SLOTS AND NOT TO A CLOAK.**
  All 44 cloaks in the data carry the subclass "Cloth" and every class wears
  one, so reading the subclass without asking which SLOT it is for leaves eight
  classes with no back slot at all -- **and it looks exactly like a correct
  filter**, because a missing item and an item that was never in the database
  are the same absence. `ARMOUR_CLASS_SLOTS` is that line.
- **DUAL WIELD IS A RULE ABOUT THE SLOT, NOT ABOUT THE ITEM.** A one-handed
  sword is legal for a Paladin in the main hand and illegal in the off hand. A
  SHIELD and a HELD OFF-HAND ITEM both sit in the off hand and neither is a
  second weapon: the shield asks for its own `shield` column and a held item
  asks for nothing. `item.weapon !== undefined` is what separates them, read
  off the one field that answers "does it swing".
- **ONE-HANDED AND TWO-HANDED ARE SEPARATE COLUMNS AND THE SUBCLASS CANNOT TELL
  THEM APART.** The capture says "Axe" and says nothing about which hand, so
  `proficiencyForItem` takes the INVENTORY TYPE as well -- and `Item` carries
  `subclass` and `inventoryType` now for exactly that, because `slots` is a
  lossy derivation of the second. A Hunter may hold a two-handed axe and no
  mace of either size, which is the row that needs both halves.
- **THE FILTER DEFAULTS TO PERMISSIVE AND HAS AN ESCAPE HATCH, BOTH ON
  PURPOSE.** A word the switch does not recognise returns `undefined` and the
  item is offered; the picker has a "show items this class cannot use" toggle
  that greys them instead of hiding them; and **whatever is already equipped is
  always listed**. A filter is the one kind of bug that leaves nothing behind
  to notice -- there is no zero anywhere and nothing to count -- so the
  containment check is that **all 25 presets wear only what their class may
  equip**, which `proficiency.test.ts` asserts per preset.
- **AND SOMETHING HAS TO ASK WHETHER THE FILTER EVER FIRES**, which is
  `isWeaponUseOf(attack, 'ranged')`'s lesson and the ranged-attack-power item
  rule's: a predicate that is always false reads exactly like one that is
  sometimes true, and a permissive default would make a typo in that switch a
  silent no-op across the whole database. The counts are pinned -- a Rogue has
  no two-hander at all, a Druid no ranged weapon, and each relic reaches
  exactly the class whose column names it.

**AND AN ITEM'S OWN `Classes:` LINE IS A SECOND FILTER THE TABLE CANNOT
REPLACE.** The proficiency table answers "may this class wear leather"; it
cannot answer "may a Warrior wear the ROGUE tier set", which is leather and
says so on its own tooltip. **895 of the 1,946 items on file carry one** --
nearly half the database -- and it sat in the tooltip text, read by nothing,
until the owner was offered the Rogue and Druid tier on a Warrior. Thirteen
distinct wordings, all comma-separated class names; **no item carries a
`Races:` line**, which was checked rather than assumed.

**AND 184 SET PIECES CARRY NO LINE, OF WHICH SEVEN HAVE ONE UPSTREAM.** Every
one was asked of Wowhead, which is allowed here for the reason CLAUDE.md
already states about Shadowburn's Soul Shard: **the preferred source is SILENT
rather than different**, so `foreverchanges.pro` having no class field cannot
contradict a line it is unable to express. Only the Bonescythe set had one.
**The T3 sets and the tier-0 dungeon sets carry none in Classic's own data
either**, so a Paladin being offered a Frostfire Circlet is what both sources
say about that item rather than a gap in the filter -- and whether Forever
means them class-locked is a question for the owner.

**NOTHING INFERS A CLASS FROM A SET BONUS**, which is the tempting shortcut and
is wrong for a good fraction of the 177: Devilsaur Armor, the Dragon Mail sets
and the Highlander's/Defiler's PvP sets are crafted and reputation sets with no
class restriction at all.

**AND THE FOUR TEST SETS DROPPED EVERY ENCHANT ON A SWAP.**
`benchmarkEquipmentFor` built each slot as `{ itemId }` and nothing else, so
pressing E65 and then E75 discarded the whole loadout -- worth **+2.4 to +53.7
DPS a profile** -- and made exactly the four-item-level comparison the buttons
exist for wrong. **Silently**: an unenchanted slot looks like a slot nobody
enchanted. It takes the current equipment now and carries each slot's enchant
across, through ONE helper rather than six slot literals, which is
`validateProfile`'s field-by-field rebuild in miniature.

**AN ENCHANT BELONGS TO THE SLOT THERE AND TO THE ITEM EVERYWHERE ELSE**, and
the difference is what the action MEANS: changing one item by hand is a new
item in a slot, and pressing a benchmark button is re-gearing the whole
character at a different item level. The owner asked for the second in so many
words.

- **AN ABILITY'S WEAPON REQUIREMENT IS GATED AT THE BOOK, NOT AT THE CAST.**
  `abilitiesForBuild` takes `style` and refuses Shield Slam without a shield, so
  the ability is simply ABSENT rather than present and always refused. The
  difference is what a report says: an ability in the book and never cast reads as
  a rotation problem, and this is a weapon problem. A `canCast` gate is the
  Rogue's dagger shape and is right where a weapon could change mid-fight;
  nothing here swaps weapons.
- **A STANCE REQUIREMENT IS THE OTHER WAY ROUND, AND SPEARING STRIKE CROSSED
  FROM ONE TO THE OTHER.** It required a two-handed weapon and was gated here
  beside Shield Slam; at client build 1.60.1.70170 Forever replaced that with
  Battle Stance, so it is `Ability.stances` now -- where Overpower's has always
  lived -- and `abilitiesForBuild` has no opinion about it. **The dividing line is
  whether the condition can change mid-fight**: a weapon cannot, so an ability
  the character can never use should not be in the book at all; a stance can, so
  `PriorityRotation` treats the wrong one as "not yet, and here is how" and will
  cast a stance change to reach it. That last part is why the swap is not free --
  Spearing Strike joined Revenge, Whirlwind and Recklessness as a reason the two
  GENERIC Warrior lists dance, and it moves none of the three profiles only
  because the stance-specific lists exist so that neither ever dances.
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
- **TWO CONFIGURATIONS COMING BACK EQUAL TO THE DECIMAL MEANS THE SAME ONE WAS
  MEASURED TWICE.** A Firestone and a Spellstone grant different stats to
  different schools, and a probe reported both at an IDENTICAL 484.6 across
  thirty batches -- which was written into a handoff document and used to tell
  the owner the choice was a toss-up. It was not: re-measured two independent
  ways, the Spellstone is worth +19.9 to that profile and the Firestone +7.6.
  **The identity was the evidence and it went unquestioned**, which is the same
  shape as a share total of exactly 100% hiding a pooled column. A suspicious
  run is worth confirming by a second route -- `measure_profiles.ts` against a
  saved baseline AND a standalone probe -- before a figure leaves the session.
- **A TEMPORARY WEAPON ENCHANT IS A PROFILE FIELD, NOT AN ITEM.** A Rogue's
  poisons and a Warlock's Firestone or Spellstone are both consumables applied
  before the pull, so they are selected in the Gear panel and stored on the
  profile -- and **they STACK with the weapon's enchant** by the owner's ruling,
  which falls out of nothing in the path reading `equipment`. **The default is
  the decision to get right**: version 10 gave every Rogue the owner's STATED
  pairing and changed every saved Rogue's result, and version 11 gave every
  Warlock `none` because the owner stated a control rather than a choice.
  Inventing the choice would move a published baseline on no authority.
- **A SCHOOL-SCOPED LINE AND A WHOLE-CHARACTER ONE CAN SIT IN THE SAME
  SENTENCE.** The Firestone is "+2% spell critical strike chance AND +21 damage
  done by your Fire spells": the second half is school-scoped spell power and
  **the first half is not scoped at all**, because `spellCritChance` is one stat
  the spell table reads for every school. So it is not "the Fire stone" -- it is
  the better stone for a Fire build and an EQUALLY good one for a pure Shadow
  build, measured at +20.0 and +7.3. Reading the whole line as Fire-only is the
  mistake, and it cost a wrong test assertion that one batch appeared to
  confirm and thirty batches called a tie.
- **"With all spells and attacks" is TWO STATS.** `critChance` and
  `spellCritChance` are read by separate tables, so an item line saying both has
  to grant both. Sixty-two lines say it, and granting only the melee half was
  invisible for exactly as long as no caster owned any gear.
- **A RULE THAT MATCHES NOTHING READS EXACTLY LIKE ONE THAT SOMETIMES MATCHES,
  AND SEVEN OF TWENTY-TWO ITEM RULES MATCH NOTHING.** That is fine -- they are
  Classic wordings kept for an inherited tooltip -- and the EIGHTH is the
  problem. `/^\+(\d+) ranged Attack Power\.?$/` was written for Classic's
  lower-case r, every one of the twelve lines in Forever's data has a capital
  R, and **a Hunter's own bow granted no ranged attack power for the whole
  dataset**. The rule that existed to catch it was the thing that was broken.
  **`EFFECT_RULES` IS EXPORTED SO A TEST CAN ASK WHICH RULES THE DATA REACHES**,
  and `items.test.ts` asserts the unreachable list EXACTLY: a tenth entry fails,
  and so does one of the nine becoming reachable. The second half has already
  paid -- `+N Spirit` was on it with a comment calling it a question for the
  owner, the owner answered with a slot table, and the test failing is how that
  was confirmed rather than assumed. It is the same shape as
  `isWeaponUseOf(attack, 'ranged')`, which was always false for every attack,
  and the same guard: make something ask whether the predicate ever fires.
- **A RULESET CAN WRITE THE SAME STAT IN WORDS THE PARSER HAS NEVER SEEN, AND
  1,384 LINES WENT MISSING THAT WAY.** Classic writes spell power as "Increases
  damage and healing done by magical spells and effects by up to 40" and that
  sentence was the only rule; **Forever writes "+94 Spell Power" and "+58 Spell
  Damage"**, so Premier High Warlord's War Staff reported +94 on its tooltip and
  granted zero. **IT WAS INVISIBLE BECAUSE NO PRESET WORE A FOREVER ITEM** --
  an item in the database and in no profile is the quietest place in this
  project for a stat to go missing, and it stayed quiet right up to the commit
  that made every preset wear one.
  **SO WHEN A NEW SOURCE LANDS, DIFF ITS VOCABULARY AND NOT ONLY ITS NUMBERS.**
  The `unmodelled` list is the report that would have said so, and it was
  thousands of lines long; a count of unmodelled lines per source file is the
  cheap check.
- **AND A NEGATIVE STAT IS A STAT.** `^([+-]\d+)`, because Lapidis Tankard
  carries "-15 Agility" and a `+`-only pattern silently drops a penalty, which
  is a bigger number and no error.
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
- **AN ENCHANT COMES FROM ONE OF TWO SOURCES AND THEY ARE NOT THE SAME KIND OF
  THING.** The two WEAPON enchants were SCRAPED — Crusader and Weapon Spell
  Power have a Wowhead spell id, an icon and a tooltip, and `ENCHANT_RULES` in
  `itemData.ts` says what the simulator does with the words. The 28 ARMOUR ones
  are the ruleset owner's own table: an effect and a slot, **no spell behind
  either**, so they are declared outright in `game/items/foreverEnchants.ts`.
  There is nothing to scrape and nothing to `--verify`, and a JSON file
  pretending otherwise would be invented provenance.
- **THEIR IDS ARE THE SIMULATOR'S, NOT THE GAME'S.** `EquippedSlot.enchantId` is
  a number a saved profile stores, so each needs a stable key; they are
  allocated BY POSITION from a block at 900,000, which is far clear of every
  item and spell id and is asserted so. **So an entry may not be reordered or
  removed once a profile has been saved against it** — a new one goes on the
  end, and `enchants.test.ts` pins the first and last to their ids so a reorder
  fails loudly rather than moving somebody's helmet enchant onto their boots.
  Reading one as a WoW spell id is reading a fabricated number as game data.
- **ONE ENCHANT PER DISTINCT EFFECT, LISTING EVERY SLOT IT IS OFFERED ON.** "+8
  Strength" is the helmet's entry and the legs', and it is ONE enchant with two
  slots — the arrangement Crusader already uses for its three weapon slots.
  Splitting per slot would be two ids for one thing and two places to drift.
  **The SHOULDER column reads "None" and nothing else**, so no enchant lists it
  and the Gear panel shows that slot a dash, which is the honest rendering of a
  column with no options.
- **A LOADOUT IS SEPARATE FROM THE GEAR, AND IT OUTLIVED THE GEAR.** The
  enchants used to be written into each preset's `equipment` block by
  `withEnchants(set, loadout)` over a gear set -- which is how one Warrior plate
  set served Arms, Fury and Protection: only the enchants told them apart. Both
  the sets and that function are deleted, so the 25 loadouts are a table of
  their own, `PRESET_ENCHANTS` in `presets.ts`, applied slot by slot over the
  benchmark set by `withBenchmarkGear`.
- **EXTRACT WHAT RIDES ALONG WITH A DATA LAYER BEFORE DELETING IT.** The owner
  asked for the gear to change and the enchants to stay exactly as they were,
  and the enchants lived INSIDE the thing being deleted -- worth **+2.4 to
  +53.7 DPS a profile**, the figures `enchants.test.ts` records, and a loss
  nobody would have thought to look for inside a gear swap. They were read off
  the BUILT profiles rather than retyped, so the table is what the presets
  actually wore rather than what somebody believed they wore.
  **THE SECOND PASSENGER WAS THE TWO SCRAPED WEAPON ENCHANTS**, which sat in
  `classic-warrior.json` because that is the file they were scraped with:
  Crusader and Weapon Spell Power have a spell id, an icon and a tooltip, where
  the other 28 are the owner's declared table. Deleting the file would have
  silently unenchanted every weapon in the project, so they were moved to
  `weapon-enchants.json` first. **ASK WHAT ELSE IS IN A FILE BEFORE DELETING
  IT FOR WHAT IS NAMED AFTER IT.**
- **AND THE COST OF THE TABLE IS THAT IT NAMES ITS ENCHANTS BY ID.** The old
  loadouts said "+8 Strength" and read straight against the owner's
  spreadsheet; `PRESET_ENCHANTS` stores 900,000-block numbers, so
  `foreverEnchantId` -- which throws on a name the table does not contain --
  now has no caller outside its own test. Recorded as a readability regression
  rather than a decision: mapping the ids back to the owner's wording is cheap
  and nothing depends on them being numbers.
- **"+4 Stats" IS ALL FIVE PRIMARIES**, four each — stamina, strength, agility,
  intellect AND spirit. The owner's clarification, and the reading that is easy
  to get wrong: a version granting the three a melee build reads would be right
  about every melee profile and short on every caster.
- **"+1% Haste" IS `hasteRating: 1 * RATING_PER_PERCENT.haste`**, the idiom Seal
  of the Crusader, Nature's Grace, Flurry and Blade Flurry already share.
  `hasteMultiplierFrom` divides by the same constant, so 1% in is 1.01 out
  exactly and the placeholder conversion moving cannot change it. It reaches
  **cast speed, melee auto-attack speed and ranged auto-attack speed** — the
  owner's own statement, and all three go through `applyHaste` off that one
  multiplier.
- **AN ENCHANT'S ARMOR IS NOT "ARMOR FROM ITEMS", by the owner's ruling**, which
  is why `armorFromItems` sums ITEM stats directly instead of going through
  `statsFromEquipment`. Toughness and Thick Hide scale "your Armor value from
  items"; the cloak's sixty points are not that, so they reach the character
  once and flat. **Worth nothing on the day it was written** — no enchant
  granted armor before that one — and wrong the day one does, in the direction
  that reads as a slightly better tank rather than as an error.
- **THE BOW'S "+2% CRIT CHANCE" IS NOT A STAT, AND THAT IS THE WHOLE POINT.**
  `critChance` is every attack a character makes, and the owner ruled this one
  reaches **ranged attacks only — not melee, and not the pet**. It is
  `Enchant.attackTableModifiers` on `ranged-auto` and `ranged-special`, merged
  into the build's in `createPlayer` the way `schoolPower` already is, and the
  pet never sees it because `createPet` builds its own combatant and inherits
  the owner's crit STAT, which this deliberately is not. **The melee Hunter
  wears the same armour and holds the same Rhok'delar**, so a stat would have
  raised its Raptor Strike — and the melee build is given no ranged enchant at
  all even though one would be inert, because a loadout quietly carrying
  something the owner did not specify diverges the day a talent reads the bow.
- **AND A RACIAL'S CRIT POINTS THE OTHER WAY FROM THAT ENCHANT'S, BY THE SAME
  OWNER.** "+2% Global Crit Chance from all sources if holding a sword ... **this
  includes +2% for pet crit chance**", so the weapon specializations were a STAT
  -- and `createPet` reads `owner.stats.effective.critChance` and inherits all
  of it, so the pet clause needs no code at all. The bow enchant had to be
  `attackTableModifiers` precisely because the owner ruled it must NOT reach the
  pet. **Two "+2% crit" lines from one owner with opposite answers about the
  same pet**, and the engine already draws the line in the right place: what
  there was to get right was choosing which side of it.
  **THE THREE WEAPON SPECIALIZATIONS ARE GONE AND THE CLAUSE SURVIVED THEM**,
  which is the part worth keeping. A patch replaced Human Sword Specialization
  with RUTHLESS and Orc Axe Specialization with SAVAGE -- the same figures with
  no weapon condition -- and Dwarf Mace Specialization with EARTH FURY, which is
  crit DAMAGE instead of crit chance. The pet still collects Ruthless and Savage,
  because what carried the owner's clause to the pet was never the WEAPON: it
  followed from the effect being a stat.
  **AND EARTH FURY DOES NOT REACH THE PET, WHICH THE MECHANISM DECIDES RATHER
  THAN A RULING.** Crit DAMAGE has to be `attackTableModifiers` -- the bonus half
  of a crit multiplier is 1.0 on the physical tables and 0.5 on the spell one,
  and a Dwarf can be a Priest -- and `createPet` builds its own combatant, so it
  stops at its owner. The note says nothing either way; recorded as a question.
  **`RacialRequirement.weaponTypes` NOW HAS NO CALLER AT ALL**, and
  `racials.test.ts` asserts that it reaches NOTHING: a condition with no caller
  reads exactly like one that is sometimes true, which is `EFFECT_RULES`' lesson
  and `isWeaponUseOf(attack, \'ranged\')`'s.
- **FOUR ENCHANTS DO NOTHING AND ARE STILL SELECTABLE, which the owner asked
  for.** Healing power, threat in both directions and Minor Speed each carry an
  `unmodelled` entry with the source's own words — an inert effect that SAYS it
  is inert is the honest failure mode, and the mirror assertion is the one that
  expires: `enchants.test.ts` fails if any OTHER enchant claims anything, so one
  that gains a stat has to lose its caveat in the same commit.
- **EVERY PROFILE'S FIGURE MOVED WHEN THESE LANDED**, +2.4 to +53.7 on a mean of
  +27.0, so no DPS recorded before that commit is comparable. **The two smallest
  are the two tanks and both are correct**: their rows are dodge, defense skill
  and threat, so a DPS figure is the wrong measure and the mechanism is pinned
  on the attacks-received table instead. A correct enchant can be worth zero.
- **Check whose gear a profile is in before quoting its number.** All three
  Hunters wore the Warrior set for the whole project and no test could have
  caught it, because a profile in the wrong gear runs perfectly. **The profiles
  whose gear did not change must not move by a decimal** — that is the check that
  a gear commit stayed inside the sets it touched.

### Talents

- **AND A FIFTH SITE FOR A TALENT THAT GRANTS AN AURA: `TALENT_AURAS`.**
  `grantAura` resolves its id through that table and `createPlayer` DROPS what
  it cannot find -- deliberately, so "a typo should show up as a talent that
  visibly does nothing, not as a character that cannot be built". `lone_wolf`
  was never registered, so **both Hunter profiles NAMED AFTER the talent went
  the whole project without its 20% damage** and nothing errored. The silent
  drop is the right design and the missing check was the problem:
  `hunterFiveFixes.test.ts` fails if any `grantAura` id across all nine classes
  resolves to nothing. **A lookup that misses is not an error, so something has
  to ask whether it missed.**
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
  silently had no Seal Fate.
- **AND A THIRD AND A FOURTH, SO THE PATTERN IS THE RULE AND NOT THE EXCEPTION.**
  Nature's Reach's hit clause was swallowed by a `scope` tag, and **Feral
  Swiftness read a MOVEMENT SPEED as a dodge chance** -- "increases your movement
  speed while in Cat Form by {0}%, and increases your chance to Dodge by {1}%",
  `[30, 4]` at rank 2, no `valueIndex`, so both feral presets carried **+30 dodge
  instead of +4** for the life of the talent. The ruleset owner found it from the
  number: "I think it's giving 30% chance to dodge instead of 4%."
  **A WRONG INDEX IS PLAUSIBLE BY CONSTRUCTION, WHICH IS WHY FOUR OF THESE GOT
  THROUGH.** The numbers on one talent's row are all numbers that talent states,
  so the wrong one is always the right order of magnitude for something -- 0.5
  seconds reads as 0.5%, and 30% movement speed reads as 30 dodge on a bear. Four
  instances in one class is why the full index audit across all nine is worth
  running rather than fixing these one at a time.
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
  INDEX, WHICH IS QUIETER STILL.** Thick Hide is "{0} additional base Armor per
  LEVEL and another {1} base Armor for each point of DEFENSE SKILL beyond five
  times your level", declared as `itemArmorPercent` -- a percentage of ITEM
  armor, which is exactly what Toughness says and neither of what this says. At
  rank 3 it paid 3% of 1793, about **54 armor against a correct 274**.
  **THE WRONG RULE IGNORES BOTH INDICES EQUALLY**, so there is no wrong index to
  find and the index sweep cannot see it; what found it was reading the TOOLTIP
  beside the declaration. It needed two units rather than two rules --
  `statFromLevel` and `statFromStat` both read their value as a PERCENTAGE by
  default and now take `scale: 1` for a talent stating a MULTIPLE, which is the
  difference between 180 armor and 1.8. **When a fix motivates a sweep, run the
  sweep**: the index bug was one talent and the sweep found a second, unrelated
  one beside it.
- **AND A TALENT WITH ONE CLAUSE MODELLED AND ONE RULED OUT THAT SAYS NOTHING
  READS AS FULLY MODELLED.** Feral Swiftness's movement speed is `positioning`
  and was simply absent, so the talent sat in the `Fully` column -- the one
  column nothing re-reads -- while its only live clause had the wrong index.
  Declaring the ruling moved it to `partly`, which is where a reader looking for
  a half-done talent actually looks. **An undeclared ruling and an undeclared gap
  look identical from the census, and both of them hide whatever else is on the
  talent.**
- **AND AN EFFECT THAT READS THE WRONG VALUE IS APPLIED, AND THE CENSUS CALLS IT
  FULLY MODELLED.** The Priest's Improved Mind Flay declared `valueIndex: 1`
  against a row of `[damage%, yards, slow%]`, so it applied the RANGE as a
  damage multiplier for its whole life -- 10% where the talent grants 20%, on
  the biggest damage source in the build, worth **+18.2 DPS** when corrected.
  **NO AUDIT IN THIS PROJECT ASKS WHETHER A MULTIPLIER IS THE RIGHT
  MULTIPLIER**: `coefficient_probe` asks whether damage responds to a stat,
  `ability_audit` asks whether an ability is connected, and the census has four
  columns of which none is "correct". **The plausible wrong value is usually
  another rank's right one** -- 10 is exactly what rank 1 correctly grants, so
  the talent read as one rank behind itself and no figure looked odd. The
  Warlock's Aftermath had the same mistake and escaped it only because at 5/5
  the two numbers coincide. `tools/value_index_sweep.mjs` lists all 48 sites;
  **a multi-number row is where to look, and the tooltip's placeholder order IS
  the index order.**
- **AND THE AFTERMATH PREDICTION CAME TRUE, WHICH IS THE WHOLE POINT OF HAVING
  WRITTEN IT DOWN.** The sentence above named the talent and the reason it was
  safe -- "escapes it only because at 5/5 the two numbers coincide" -- and the
  day the ruleset owner respecified Firelock to **2/5** it stopped being safe.
  Its row is `[10,20,30,40,50]`, `[20,40,...,100]`, **`[50,50,50,50,50]`**,
  `[5,5,5,5,5]`: index 2 is the daze clause's MOVEMENT SPEED, constant at every
  rank, and index 0 is the Immolate figure. At 5/5 both read 50 and the talent
  was **correct by coincidence**; at 2/5 it would have paid 50 where the talent
  grants 20 -- two and a half times, on the profile's second-largest damage
  source, measured at **+35.5 DPS of inflation**.
  **SO A TALENT CHANGE IS WHAT WAKES A DORMANT INDEX BUG, NOT A CODE CHANGE**,
  and the dangerous rank is whichever one every profile happens to carry. The
  comment beside it restated the wrong index in its own words ("by {2}%"),
  which is the Rip lesson repeating: the figure that would expose a wrong
  reading is wrong in the same sentence that asserts it.
  **ASSERT THE SLOPE, NOT A VALUE.** Any single-rank check at 5/5 passes
  against both indices; only the rank scaling -- 1.10/1.20/1.30/1.40/1.50
  against a flat 1.50 -- can see it. `warlockTalents.test.ts`.
- **An effect that reads no value is DROPPED, not reported.** `talentBuild` asks
  `talentNumber` and `continue`s when it is undefined, so a single-rank talent
  whose values file says `null` produces nothing and reads as unmodelled without
  having said so. **A talent whose effect does nothing is usually this**, not the
  effect table. **IT HAS NOW HAPPENED THREE TIMES, ALL ON THE PALADIN** — Holy
  Shield's damage reaction, Divine Favor's cast reaction and Sacred Arbiter's
  +10% to Holy Strike, the last of which the ruleset owner found by reading a
  damage table. **A SINGLE-RANK TALENT IS THE WHOLE RISK GROUP**, because that is
  the only way an entry comes back `null`: no `{0}` for the importer to match.
  Check every one of a class's single-rank talents against its effects before
  calling the class done. A proc declares `valueless: true`; anything that
  genuinely needs the number gets it hand-filled in the values file with a
  `note`, which is the documented exception.
- **AND IT HAS NOW HAPPENED A FOURTH TIME, ON A DIFFERENT CLASS, AND THE HALF
  THAT SURVIVED WAS THE HALF THAT PAYS OUT.** Inner Focus is single-rank, so its
  `castReaction` -- the thing that takes the buff off again -- was dropped, while
  `grantAbility` reads no value and so the ABILITY was granted and castable. The
  Priest applied a +25% crit buff that nothing ever removed: it sat there for its
  full sixty seconds, reported its uptime, and the owner found it from the result
  -- "it is providing the shadow profile +25% crit chance permanently".
  **THAT IS THE INERT-BUFF-WITH-VISIBLE-UPTIME SHAPE UPSIDE DOWN.** Adrenaline
  Rush reported 24.9% uptime and delivered nothing; this reported its uptime and
  delivered too much. Nothing was MISSING from the results page either time,
  which is why both needed somebody to ask what the buff was supposed to move.
  **AND ITS THREE EXISTING TESTS COULD NOT HAVE SEEN IT**, because all three
  build the spender BY HAND -- `innerFocusSpender()` -- which is this file's own
  "a test that reconstructs the thing under test will reproduce its mistakes".
  The reaction was always correct; the JOIN to the character was not. Ask the
  BUILD: `talentBuild(...).castReactions`.

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
- **`requiresRanks` IS NOT ALWAYS 1, AND THAT IS WHAT MAKES A DEAD POINT
  MANDATORY.** A prerequisite is `requires` plus `requiresRanks ?? 1`, and
  **three of the Warrior's seven ask for the FULL rank**: Anger Management on
  Improved Tactical Mastery 5/5, Deep Wounds on Improved Rend 3/3, Gore Drinker
  on Enrage 5/5. So a talent whose own effect is worth nothing can be five points
  that cannot be moved -- Improved Tactical Mastery retains rage across a stance
  change a list never makes, and all five are held by the talent beneath it.
  **"THIS TALENT DOES NOTHING, MOVE ITS POINTS" IS A CLAIM ABOUT THE PREREQUISITE
  GRAPH AND NOT ONLY ABOUT THE TIER ARITHMETIC.** Three variants written on the
  tier arithmetic alone were refused by `tools/buildVariants.ts`, each naming the
  NINE talents it would have stranded -- which is what that guard is for, and the
  cheapest place to find out. Read `requiresRanks` off the tree before pricing a
  point, because the tier sums can be perfect and the build still illegal.
- **AND A DEAD POINT'S DESTINATIONS CAN BE PROVABLY EQUALLY DEAD.** Where two
  points COULD move, Enrage 2, Blood Craze 2 and Booming Voice 2 each ran
  **BIT-IDENTICAL FIGHTS** holding them -- so the choice is legibility rather
  than DPS, and the smallest edit wins. **An identical pair is usually this
  project's tell for a patch that did not apply**, so say which it is: three
  variants agreeing exactly is evidence only when each one provably applied.
- **AND AFTER THE PROBES, RE-RUN THE FULL MEASUREMENT AND CHECK IT REPRODUCES TO
  THE DECIMAL.** Five probes were run across the 1.60.1.70170 rounds -- Champion
  of the Light, Vengeance's stack cap, the Warrior crit-rage multiplier,
  Bloodthrill's two halves, and a four-cell Pyroblast gate sweep -- each one
  reverted by hand. The 24-profile run afterwards came back identical to the
  pre-probe figures on every row, which is the only thing that says no probe was
  left in. **It costs one command and the alternative is a published baseline
  measured on a tree nobody meant**, which is the same failure a shared checkout
  produces and this file already documents twice.
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

**A PATCH NOTE CAN STATE A TALENT VALUE THE CLIENT HAS NOT SHIPPED, AND
`values/<class>.json` IS NOT WHERE IT GOES.** CLAUDE.md calls that directory the
one piece of scraped data that IS hand-editable, and the importer disagrees:
`import_forever_talents.mjs` merges a previous entry ONLY where this run produced
`null` -- which is to say only for a SINGLE-RANK talent with no `{0}` to match.
**A hand edit to a MULTI-rank row survives exactly until the next `--write`.**

`PATCH_NOTE_TALENT_VALUES` in `game/talents/patchNoteValues.ts` is that layer,
and it is consulted in **`talentValue`, the ROOT** -- which is the second place
it went. Wired into `talentBuild` first, which would have left the Talent panel
printing the client's 1/2/3/4/5 for a Shadow Mastery the engine ran at
2/4/6/8/10: **the character sheet's crit bug exactly**, a panel disagreeing with
the fight about a number, invisible because every neighbour is right.
`talentNumber`, `talentNumbers` and `talentDescription` all come through the root.

**EVERY ENTRY RECORDS WHAT THE CLIENT SAYS, WHICH IS WHAT MAKES THE LAYER EXPIRE
RATHER THAN ACCUMULATE.** `patchNoteValues.test.ts` fails when a refresh moves
the generated row, naming the talent; fails separately if an entry ever AGREES
with the file, because an override that is a silent no-op is worse than none;
and fails on a stale talent id, which is the failure a RENAME already cost this
project once. **ONLY A VALUE MAY GO IN IT, never a tree SHAPE** -- a rank count,
a row and a prerequisite are read by the decoder and the legality rules, so
inventing one is inventing game data with a build URL that will not decode.

**AND A NOTE'S PARENTHETICAL HISTORY CAN DISAGREE WITH EVERY SOURCE WHILE ITS
PRESCRIPTION STANDS.** "Shadow Word: Death cooldown increased to 18 seconds (was
12 seconds)" -- the capture says 15 and so did this file, so nothing here has
ever said 12. The two halves are different kinds of claim: "increased to 18" is
a PRESCRIPTION with a number in it and "(was 12)" is the note's own record. The
target is applied and the mismatch is flagged, because the other two Priest
cooldowns in the same patch match their own parentheticals exactly -- **two of
three reproducing and the third moving is the shape of a bug**, even when the
odd one out is only the history.

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

- **AND THE TARGET'S CAUSE INCLUDES ITS TIMING, NOT ONLY ITS PROPERTIES.** That
  row reads as a list of things the boss IS; the encounter's CADENCE belongs in
  it too, and it can make a change arithmetically unable to do anything.
  Reckoning's new 1.5-second internal cooldown measured **0.0 on the Prot Pally,
  to the decimal**: there is one attacker on a two-second swing timer, widened by
  the tank's own Thunder Clap slow, so a fight was **25 attacks received with a
  median and minimum gap of 2,400ms and NOT ONE gap under 1,500ms**. Two
  triggerable events could not fall inside the window. **The cooldown was
  correctly implemented and correctly worth nothing**, and it would start binding
  the day the encounter swung faster or gained a second attacker.
  **AND THAT DAY ARRIVED, WHICH IS WHY THIS ENTRY IS KEPT.** Parry haste takes
  40% of a full swing off, and the boss earns it by parrying the TANK -- which
  it does on 14% of a tank's many blows, so several land inside one boss swing
  cycle and drive it to the 20% floor. Measured over forty fights, the minimum
  gap is **480ms** and **124 of 1,045 gaps fall under 1,500ms**, so the
  cooldown now binds on about one gap in eight. The prediction was right, the
  figure expired on schedule, and the test that recorded it had to be rewritten
  to assert the opposite. **An encounter-cause note is a dated claim like any
  other.**
  **AND IT MOVED AGAIN WHEN PARRY HASTE'S DIRECTION WAS CORRECTED**, from
  1,440ms to 480ms, which is the difference between the boss being hurried once
  per swing by the tank's rare parries and being hurried repeatedly by its own.
  A figure derived from a mechanic is only as settled as the mechanic.
- **AND A SECOND ONE: THE RAMP DECIDES WHETHER A FLAT MITIGATION STAT MEANS
  ANYTHING.** Block chance and block value both come back "not measured" in the
  tank weights even at 3000 iterations, and the cause is the encounter rather
  than the code. The boss opens at 5,000 and every swing is 10% harder, so
  incoming hits grow from **1,624 early to 12,458 late** while block value stays
  flat at 97 -- six percent of an early blow and 0.78% of a late one. Block's
  whole contribution is **1,556 of 139,118** damage taken, 1.12%.
  **THE MECHANISM IS LIVE AND WAS CHECKED BY SCALING IT**: the Prot Warrior
  blocks 16.05 of 26.60 attacks a fight (Shield Block takes its 11.16% slice far
  higher), and +5000 block value removes 64,243 damage and takes deaths from
  8.69 to 4.82. **A ZERO HERE IS A MAGNITUDE, NOT A WIRING FAULT.**
  **AND THE RATIO IS ARITHMETIC, WHICH IS WHAT MAKES IT CHECKABLE RATHER THAN
  ASSERTED**: a dodge removes the whole blow and a block removes a flat 97 of
  it, so a point of block chance is worth a point of dodge chance times
  `blockValue / meanHit`. 97/5230 is 1.85% predicted against 0.0017/0.1375 =
  1.2% measured. `targetSwingDamage` and `BOSS_DAMAGE_RAMP` are both invented
  numbers borrowed from Classic, so **whether a flat mitigation stat is worth
  anything in this project is currently decided by a placeholder** -- a question
  for the owner rather than something to tune.
- **SO MEASURE THE ENCOUNTER'S OWN QUANTITY WHEN A CHANGE MEASURES ZERO**, the
  way a correctness fix expected to be worth nothing is measured on its
  mechanism. The gaps between attacks are what settled this in one probe; the
  alternative was an unexplained 0.0, which is indistinguishable from a change
  that did not apply. **And write it down beside the constant** -- the comment
  already there predicted the opposite in specific terms ("critically struck
  several times a second"), which is this file's own rule about a prediction in a
  comment, pointing at a number nobody had taken yet.

- **A FOURTH CAUSE HIDES INSIDE THE FIRST: THE LIST.** "No priority list casts
  Berserker Rage" is an argument about a ROTATION and it sat in the engine column
  for the Warrior's whole life, as the class's last live gap. The number it was
  supposedly waiting on -- 5 and 10 rage by rank -- was in `values/warrior.json`
  the entire time. **A reason that names a list, a build or a profile is not an
  engine gap**, and it reads exactly like one because the talent is equally
  silent either way. Build the mechanism, test the MECHANISM, and let the list
  cause be a list cause.
  **AND IT HAS NOW BEEN CLOSED BY A LIST AND A BUILD, WHICH IS WHAT THE REASON
  SAID IT NEEDED.** DW Fury spends two points there -- moved off an Enrage that
  cannot fire against a target which never attacks -- and the Berserker list has
  an entry at the bottom. **Both halves or neither**: the talent alone runs
  BIT-IDENTICAL fights, the entry alone is **-1.13** (a free ability granting
  nothing and taking a global cooldown), and together they are **+6.02**. The
  gap is gone and no engine work closed it.
  **THE PAIR IS WHY THE MEASUREMENT HAS TO BE OF THE PAIR.** Measured one at a
  time, both halves of a talent-plus-entry read as worthless, and the honest
  conclusion from either alone is "this is not worth taking".

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
- **AND THAT SHAPE HAS A SECOND INSTANCE NOW, CREATED BY A PATCH RATHER THAN
  FOUND.** The Bear's crit rage multiplier went 1.75 to 2.0 and the Warrior's
  was already 2.0, so `critRageMultiplierFor` has two branches returning the
  same number. **They stay separate**: two owner statements about two classes,
  and folding them means the next patch moving either has to split them back
  apart, after somebody works out they were ever different. **Pin each by
  IDENTITY rather than asserting they are equal** -- an equality test turns the
  next divergence into a failure in the constant that did not move.
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
- **AND THE WORSE VERSION IS A BLANKET JUDGEMENT OVER SUCH A LIST, BECAUSE IT
  COVERS THE ENTRY NOBODY CHECKED.** `docs/handoff/warrior.md` listed SEVENTEEN
  abilities under "In the book, in no list, never cast" and then said **"most are
  correct"**. **Three of the seventeen went into a list the next time anybody
  looked** -- Recklessness **+94.15**, Hamstring **+26.74**, Berserker Rage
  **+6.02** -- so the judgement was right about fourteen and wrong about three,
  and the largest of the three is 9.5% of DW Fury.
  **THE ENTRY THAT GOT A PARAGRAPH WAS THE SMALL ONE.** Berserker Rage had its
  own note there saying a build that spent a point would want it measured, and it
  is worth +6.02. **Prose draws attention to what somebody already thought about,
  which is the opposite of where the finding is** -- so check such a list by
  reading the BUILT CHARACTER'S BOOK against the list rather than by re-reading
  the reasons, and re-read the judgement whenever the lists change.
  **AND THE WRITE-UP OF THIS LESSON SAID "sixteen ... right about fifteen and
  wrong about one" IN THREE PLACES BEFORE ANYBODY COUNTED THE LIST.** Both
  figures were wrong, in a paragraph whose whole subject is a claim nobody
  checked. **Count the thing you are about to generalise from**, which is this
  file's "re-count rather than increment" rule pointed at prose rather than at a
  census column.

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
- **A REASON WITH TWO CLAUSES EXPIRES WHEN EITHER ONE DOES, AND IT KEEPS READING
  AS TRUE BECAUSE THE OTHER STILL IS.** Three Paladin talents carried the shape
  at once: "threat is out of scope, AND no profile casts Righteous Fury", "threat,
  AND its damage half needs Righteous Fury which no profile casts", "the Hammer of
  Wrath cast time, which is never usable here, AND threat". The threat half is
  permanent and correct in all three; the second half had expired in all three,
  because the owner's Protection list casts Righteous Fury at the pull and the
  owner's Retribution list casts Hammer of Wrath. **A reader checking the reason
  reads the true clause and stops.** Worth 6% and 10% damage taken on the tank and
  a never-fired entry on the fifth-highest profile. **Split a compound reason, or
  put the expiring clause FIRST.**
- **An `unmodelled` reason is a claim about the engine ON THE DAY IT WAS WRITTEN,
  and it expires.** Clearing a blocker is not finished until every reason naming
  it has been re-read — missed at least four times, and twice a talent was fully
  working while printing a caveat saying it could not fire. Write it specifically
  enough to re-read: a whole family expires at once and is then findable by its
  wording, which has paid for itself six times. **A reason matched by wording is
  a test** — `grantCastModifier.test.ts` fails if any talent still claims a
  percentage cost cannot be expressed, matching the SENTENCE rather than ids.
- **A REASON CAN NAME A MISSING MECHANISM AND BE WRONG ABOUT WHICH ONE.**
  Amplify Curse's said it wanted "a one-shot per-ability DAMAGE modifier",
  because `CastModifier` carries cast time and cost and not damage. It was
  right that nothing expressed the effect and wrong about what would: the 50%
  applies to Bane of Agony's TICKS, which land over twenty-four seconds, and a
  cast modifier is resolved and spent AT the cast. The amplification travels
  with the AURA instead -- two definitions sharing one id, chosen at
  application -- so the talent was one `grantAbility` away the whole time and
  was recorded as waiting on an engine gap it never needed. **A reason that
  names a mechanism is a design claim, and it expires the same way a claim
  about the engine does.**
- **When a reason blames the SOURCE, check it is not really a question for the
  owner.** Twenty-nine said Forever states no spell coefficient, which was true
  and still is; the conclusion was wrong, because a coefficient is a RULE and
  asking got one in a single message. **Check whether a missing number is missing
  DATA or a missing RULE before recording it as a gap.**
- **AND A FLAGGED INTERPRETATION CAN EARN A REWRITE RATHER THAN A RULING, WHICH
  IS A THIRD OUTCOME THIS FILE DID NOT HAVE.** Arcane Blast's "8 sec or until
  any other damage spell is cast" read literally said the bonus was destroyed by
  the only thing that could collect it, so the clause would have paid nothing --
  the reading taken was that the other spell BENEFITS and the stacks then go,
  and HANDOVER carried it as a question. A patch redesigned the spell: the window
  is a stated fifteen seconds, the damage clause is spell power from Intellect
  instead, and `arcaneBlastSpender` is deleted. **The question was answered by
  being removed.** The flag is still what made it findable.
- **AND ONE WENT THE OTHER WAY IN THE SAME PATCH: A SETTLED FACT BECAME A
  QUESTION AGAIN, AND THE ANSWER WAS THAT THE RULING HAD COVERED THE PRODUCT.**
  While Ice Lance's frozen multiplier and the divisor in the owner's
  `1.5 / 3.5 / 4` were both four they multiplied out to exactly `1.5 / 3.5`, and
  asked whether the `/4` had already done the frozen division the owner said
  **"This is intended stop asking."** A note then took the multiplier to three
  and said nothing about the coefficient -- so either the divisor was a separate
  settled fact (0.3214, implemented) or "intended" meant the PRODUCT and the
  divisor should follow (0.4286). **A RULING IS ABOUT THE STATE IT WAS GIVEN
  IN**, and a patch can move the thing it was about.
  **THE OWNER'S ANSWER: "Ice Lance was changed to use 1.5/3.5/3."** So the
  ratification was of the product, the divisor tracks the multiplier, and the
  implemented reading was wrong for one release.
  **WHAT RECOVERED IT IN ONE MESSAGE WAS THE NEGATIVE ASSERTION.** The
  alternative was pinned as `not.toBeCloseTo(1.5 / 3.5)` with both figures and
  their cost beside it, so restoring the symmetry meant arguing with a line
  rather than with a coincidence -- and the person who could settle it read the
  line. **A flagged reading is cheap and a wrong unflagged one is not**: this is
  the third ruling on that one constant, and the second where the label is what
  produced the answer.
  **AND THE DEFAULT THAT CHOSE WRONGLY IS STILL THE RIGHT DEFAULT.** "A
  statement of a VALUE does not overturn a separate ruling about which terms a
  multiplier reaches" settled these same two numbers correctly the first time.
  A rule that is right in general can be wrong on an instance, so **implement
  the default AND flag the instance** rather than treating a good rule as having
  removed the question.
- **AN INTERPRETATION THAT IS RIGHT IS STILL AN INTERPRETATION, AND LABELLING IT
  ONE IS WHAT GETS IT RULED ON.** Ice Lance's `1.5/3.5/4` left a real ambiguity:
  a frozen cast multiplies the four back out and lands on exactly the old
  unfrozen figure, so "the owner already divided by the frozen multiplier" and
  "the owner gave a base coefficient" are SIXTEEN apart and both plausible. The
  note chose the second, gave its argument, and said it was a choice -- and
  asking got **"This is intended stop asking"** in one message. **The label is
  what made it askable**, the same property `guardian_s_favor`'s reason had.
  **AND IT HAS TO COME OFF ONCE THE ANSWER LANDS**, because a caveat outlives the
  doubt it describes -- three sites were carrying this as a chosen reading, and a
  reader who finds one of them next year cannot tell a live question from a
  settled one.
  **IT THEN WENT BACK ON AND CAME OFF AGAIN**, because the next patch moved the
  frozen multiplier and reopened exactly this ambiguity -- see the entry above.
  The answer both times was the same one stated two ways: `1.5 / 3.5` on a
  frozen cast is the ruleset, and **what "intended" covered was the PRODUCT**.
  So the thing to carry forward is not the figure but the shape: a caveat on
  this constant has been written, removed, rewritten and removed again, and
  every cycle was cheap because it named both readings and what each would cost.
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
- **Read the owner's own words for what a talent selects.** Heating Up names four
  spells and Pyroblast is not one, which is what stops it feeding itself. (It was
  HOT STREAK until client build 1.60.1.70170 renamed it, and the four spells did
  not change with the name -- **but the rename cost its hand-filled value**: a
  single-rank talent's number is keyed by TALENT ID, so the importer wrote a new
  key, found no hand-fill under it and left `null`, and an effect that reads no
  value is dropped in silence. A rename is the one case where the importer's merge
  does not protect a hand-filled value.) **Shadow Weaving IS ON THE TARGET AGAIN**, and
  this read "on the CASTER in Forever and on the target in Classic" for the
  whole project. The owner has since ruled it back -- "Shadow Weaving is now a
  debuff, where the target takes more shadow damage from me" -- which the client
  says in its own words, "the Shadow damage the target takes from you" where it
  read "the Shadow damage you deal". **A Forever-versus-Classic difference is a
  dated claim like any other**, and this one expired by Forever moving TOWARD
  Classic rather than away from it. Twin
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
| `foreverchanges.pro/spellbook/<class>` | the beta client diffed against Classic Era, per rank, with cost, cast time and cooldown. **The tie-break: where it and our capture disagree, it wins, by the owner's standing rule.** Nothing imports from it — it is read by hand. Checked so far: the Warrior (five numbers moved) and the Warlock (three moved). Seven classes to go |
| `foreverchanges.pro/items/*.json` | **the ITEMS half of the same site, and it is plain JSON rather than the RSC flight script this file used to describe.** `new.json`, `changed.json`, `same.json`, `missing.json` and `sources.json`, each stating the beta build it was taken at. **A plain `curl` is refused with a 403**, so it is read in a browser on the origin and the payload hashed there and re-hashed on disk. `tools/data/forever-epic-weapons.json` is the first capture from it |
| `foreverchanges.pro/items` | **the item database, and the source of record for it.** Serves `/items/{new,changed,same,missing,sources}.json` -- Forever's own items diffed against Classic Era, with each item's full tooltip. Five captures are checked in under `tools/data/`, imported by `tools/import_forever_items.mjs` into `src/data/items/`. Plain `curl` gets a 403: read it in a browser on the origin and hash the transfer |
| `nether.wowhead.com/classic/tooltip/item/<id>` | Classic item and spell tooltips as JSON, no browser. **For READING an item Forever inherited, and no longer the project's item data** -- the Classic and Season of Discovery stand-ins are deleted |
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
  **EIGHTEEN are hand-filled**, each with a `note` saying so. `--check` prints
  the count per class, and the importer MERGES rather than overwrites.
  **THE FIGURE SAID EIGHT AND WAS COUNTED FROM THE DECLARATIONS**, which is the
  third derived count in this file found stale in one patch -- the one-liner is
  the entries across the nine `values/*.json` files whose `note` is not exactly
  `"single rank"`. It also grew by one in that patch: Twist of Light gained a
  percentage clause and needed its 20 filling in.
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
- **A RENAME IS A SOURCE CHANGE TOO, AND WHETHER THE ID FOLLOWS IT IS A
  JUDGEMENT WITH ONE RULE.** The NAME always follows the client, because the name
  is what a person reads on the damage table and the buff-uptime row. The ID
  follows only when nothing much keys off it — so at 1.60.1.70170 the Mage's
  `hot_streak` aura became `heating_up` and the Druid's `primal_fury` reactions
  became `blood_frenzy`, while the ABILITY `mangle` kept its id under the display
  name "Primal Bite" because rotations, profiles, talents and the Berserk aura all
  reference it. **A TALENT ID HAS NO CHOICE**: it is slugified from the client's
  name, so a renamed talent IS a new key.
  **WHICH IS HOW A RENAME CAN LOSE A HAND-FILLED VALUE, SILENTLY.** Eighteen
  single-rank talents have their number hand-filled in `values/*.json`, keyed by
  talent id, and the importer MERGES — so a rename writes a new key, finds no
  hand-fill under it and leaves `null`. Heating Up came back at `null` and an
  effect that reads no value is DROPPED without saying so, which would have
  stopped Pyroblast's 25% cast-time reduction applying on a talent reporting
  itself fully modelled. **After a refresh, check every hand-filled entry still
  has its value**, which is one grep for `"note"` across the nine files.
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

**AND THE SPELLBOOK CAPTURE'S `cost` FIELD WAS WRONG FOR ABOUT A HUNDRED SPELLS
ACROSS SEVEN CLASSES, FOR AS LONG AS IT EXISTED.** The cost/range/cast/cooldown
lines arrive as a GRID of free text sorted into named fields by what each cell
says, and `cost` was the fall-through — so a SECOND cost-shaped cell overwrote
the first. A finisher is what exposed it, `["30 Energy", "Melee Range"], ["1 to 5
Combo Points", ""]`, which made Rip and Ferocious Bite free; the same shape had
been replacing mana costs with **reagent lines** (Shadowburn read "Reagents: Soul
Shard" where its cost is 365 mana), **pet-family lines** (every Hunter pet ability
read its family instead of its focus) and **totem tools**. `extraLines` carries
them now and the FIRST cost-shaped cell wins.

**NOTHING READS THAT CAPTURE PROGRAMMATICALLY, WHICH IS WHY IT SURVIVED.** The
wrong number sat in a reference document that a reader would have believed, and
no test could have failed on it — the file is a source, not an input. **An
importer's own output is worth reading, not just diffing**: the bug is visible on
one spell the moment anybody asks what Rip costs.

**A CAPTURED TOOLTIP CAN DISAGREE WITH ITSELF, so read the effect rows and not
only the description.** Base points run consistently ONE higher than the stated
figure. The trap is the readable description that disagrees with its own row
anyway — one said 210 above a row saying −195, and the 210 was transcribed for
months. [docs/warrior.md](docs/warrior.md) has the full reading rules and the
per-ability figures; they are class-independent.

**AND WHERE A PATCH NOTE DISAGREES WITH THE CLIENT, THE CLIENT WINS.** The
owner's ruling on Dual Wield Specialization: the note said it "no longer provides
a 20/40/60/80/100% increase to your Off-Hand weapon's Rage generation" and the
client's tooltip carried one at half that, and the answer was "the client tooltip
was correct". **A note describes an intent; the client is what players run.** So
the note is about THAT increase rather than about the clause existing -- which is
the same shape as a source being SILENT rather than different, one level down.

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
IT.** Wowhead's Forever tooltip for Spearing Strike carried no requirement line;
the spellbook capture and `foreverchanges.pro` both stated a two-handed weapon.
That is two sources speaking and one saying nothing, so the tie-break never comes
up and the clause was simply true. **The silence was read as "no requirement" for
the whole project**, which is the same mistake as Shadowburn's in the opposite
direction — one deletes a real cost, the other grants a real ability to a
character that cannot use it.

**THAT CLAUSE HAS SINCE BEEN REPLACED RATHER THAN REFUTED**, which is worth
keeping the example for: at client build 1.60.1.70170 the requirement became
Battle Stance, and the capture now reads "Requires Battle Stance" where it listed
five two-handed weapon types. So the reading was right, the clause was real, and
it then expired on its own. **A requirement line is DATA and it moves like any
other number** -- which is the second reason to re-read the captures on a patch
rather than only the damage.

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

**AND A FLAGGED OPEN QUESTION IS WORTH MORE THAN A DECISION, WHICH HAS NOW PAID
THREE TIMES.** Heating Up's rename changed its tooltip from "reduces the cast time
of Pyroblast" to "your NEXT Pyroblast cast within 20 sec" and said nothing about
the mechanic. The old reading was kept, with the question written on the aura and
in the PR -- and the owner answered it: "This was an oversight by me." The two
readings were **187 DPS apart on the Fire Mage**, so guessing the generous one
silently would have put that figure in the baseline table on nobody's authority.
**A rename note is not authority to change a mechanic, and the thing that gets a
question asked is writing it down where somebody reads it.**

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

`src/data/talents/*.json` (466 talents) and `src/data/items/*.json` were
**scraped** and are checked in. Each directory has a README recording where the
data came from and how to refresh it. Never hand-edit either —
`src/data/talents/values/*.json` is the one exception, for the single-rank
talents above.

**THE ITEM DATABASE IS FOREVER'S OWN AND HAS NO CLASSIC IN IT.** The owner's
instruction: "only new/changed authentic Forever items, and KEEP THE RECENTLY
MADE TEST ITEMS. None of the old WoW Vanilla/Classic/SoD items." So the nine
stand-in files, `gearSets.ts`, `tools/item-sets.json` and
`tools/import_item.mjs` are all deleted, and what is left is five captures
from `foreverchanges.pro`:

| file | n | |
| --- | --- | --- |
| `forever-new-epics.json` | 449 | items Forever ADDED |
| `forever-new-rares.json` | 412 | |
| `forever-changed-epics.json` | 614 | Classic items Forever ALTERED -- an **override layer** |
| `forever-changed-rares.json` | 198 | |
| `forever-same.json` | 273 | Classic items Forever KEPT, captured because "new and changed" leaves out everything it did not touch |

**1,943 items, plus the benchmark gear, which is generated and not captured.**
`src/data/items/` is captured data ONLY -- the benchmark items are built in
code from the budget, numbered from 9,500,000, resolvable by id and kept out of
every dropdown so a person browsing a slot sees real items only.

**THE CHANGED FILES ARE AN OVERRIDE LAYER RATHER THAN MORE ITEMS**, because
their entries are allowed to share an id with something on file and the
duplicate check has to keep throwing for everything else. The owner's ruling is
that the Forever side is definitive, so a colliding id is **REPLACED rather
than merged** -- merged is how an item ends up carrying Classic's flat "+1%
crit" AND Forever's "+14 Critical Strike Rating" at once.
`FOREVER_OVERRIDDEN_IDS` is exported so a test can pin how many collide,
because an override that silently stops matching leaves the Classic version in
place and looks like nothing at all.

**AND `same.json` IS THE FILE THAT IS EASY NOT TO TAKE.** A diff site publishes
what CHANGED, so "new plus changed" is a complete description of the diff and
an incomplete description of the game -- 273 items Forever left alone would
simply have been absent from a database claiming to be Forever's.

**ADDING ITEMS MOVES NO PUBLISHED FIGURE AND SWAPPING THE PRESETS' GEAR MOVES
EVERY ONE.** A preset names its items BY ID, so a new capture changes what can
be CHOSEN and not what any of the 25 builds wear -- all 75 combat-log hashes
from `tools/rotation_fingerprint.ts` were unchanged when the first 449 landed.
**That is the containment check for any item commit.** It does not apply to
this one: every preset now wears E65, so every row moved and the baseline table
has to be rebuilt rather than checked.

**`FOREVER_SPELL_POWER_BUFFS` IS THE OVERRIDE THAT THE REAL DATA RETIRED.** It
carries the owner's +64 spell power on four caster weapons as a HAND-MAINTAINED
layer over the scrape -- and three of the four, Staff of Dominance, Sorcerous
Dagger and Azuresong Mageblade, are in Forever's own `missing.json`: the
ruleset REMOVED them. The fourth, Anathema, is in `changed.json` at id 18609
with Forever's own wording. **So the map is dead weight pointing at items that
no longer exist**, and the override shape it demonstrated is now redundant --
`forever-changed-*.json` IS the override layer, generated and hashed rather
than typed. Deleting it is outstanding work.

**THE SHAPE IS STILL RIGHT AND WORTH KEEPING THE LESSON FOR.** A Forever value
layered OVER a generated file at build time and never written into it is how
`ENCHANT_RULES` works too, and it was **A DELTA AND NOT A TOTAL** on purpose:
the owner gave +64 as a bonus, two of their four stated bases disagreed with
the scrape, and a bonus survives a re-scrape meaning the same thing where a
total silently reinstates whatever Classic says.

**A CASTER WEAPON'S DAMAGE AND ITS SPELL POWER ARE BOTH STATED NOW, AND THE
RULE AS GIVEN DID NOT REPRODUCE THE OWNER'S OWN TARGET.** They gave
`T = expected weapon DPS + 6q`, `1H = T x 2/3`, `2H staff = 1.3T - T/3`, and
separately said the staff should come out at Forever's 45.67. Against the
TWO-HAND line those disagree with each other -- `(1.3 - 1/3) x 61.54` is 59.5.
Against the ONE-HAND line both land exactly on Forever's observed weapons:

    47.24 x 2/3         = 31.49   against an observed 31.5  (dagger)
    47.24 x (1.3 - 1/3) = 45.67   against an observed 45.67 (staff)

**TWO INDEPENDENT MULTIPLIERS HITTING TWO OBSERVED VALUES OFF ONE BASE IS NOT
CHANCE**, so `T` is the one-hand line for BOTH hands and a caster staff keeps
1.45x what a one-hander keeps. Put to the owner WITH THE ARITHMETIC rather than
guessed, which is the fourth time a printed table has settled something no tool
here could.

**AND THE `+ 6 * q` IS ABSENT ON THEIR RULING, BECAUSE THE DATA ALREADY
CONTAINS IT.** It is a per-tier dps step and `WEAPON_DPS` already fits one --
the epic line sits 4.77 (one hand) to 6.20 (two hand) above the rare line at
item level 65, which is the same 6. Adding it would double-count quality and
take the staff to 51.4 against the stated 45.67. **A formula and a fitted line
can encode the same fact, and applying both is not conservative.**

**THE SPELL POWER IS `1.17 x ilvl - 1.6` RARE AND `ilvl + 29` EPIC, THE SAME
FOR BOTH HANDS, AND `real_set_shape.ts` CONFIRMS IT INDEPENDENTLY**: all four
real Forever caster weapons at item level 60-70 carry 94, and the formula gives
94. The weapon is now the most faithful slot in a benchmark set.

**IT IS FREE WITH THE ITEM LEVEL, WHICH MAKES IT THE THIRD SUCH THING** after
base armour and weapon dps. `spent` is deliberately NOT recomputed: the budget
is divided exactly as before and the Spell Power share still costs what it
cost, so only the line's VALUE moves. That is what keeps the owner's "additional
stats (Intellect, Hit Rating, Crit Rating, etc) are unaffected" literally true
-- taking Spell Power out of the shares, or dropping the `DPS_TO_BUDGET` credit
that funds it, would each have moved crit and intellect by a third on a change
that is about spell power.

**AND ONE FINDING REPORTED RATHER THAN TUNED**: the caster set total goes 401 ->
429 against a richest-real 391, and the excess is NOT in the weapon -- 335 of
armour against a richest-real 297. That was already true at 324 before the
change; making the weapon correct stopped it being masked. Pulling the armour
back is a `SHARE_WEIGHT` decision and is the owner's.

**AND AN ITEM HAS A BUDGET, WHICH IS A WAY OF READING ONE AND NEVER A WAY OF
MAKING ONE.** `budget = qualityBase(ilvl) x slotMultiplier` and
`budget^1.5 = sum((stat x cost)^1.5)`, from a community reconstruction, and it
reproduces real items well enough to be useful: **122 of the 133 non-weapon
items on file land within 90% to 110%** of their budget, mean 99.7%, and seven
of ten hand-picked Classic examples sit between 95% and 107%. `tools/item_budget.ts`,
[docs/itemization.md](docs/itemization.md).

**IT WAS AN AUDIT TOOL AND NOTHING IN `src/` READ IT.** Run backwards -- a
budget used to GENERATE stats for an item no source states -- it is inventing
game data with arithmetic in front of it, and the arithmetic is what makes the
invention look sourced. It ranks below every row of the source table above: not
Forever's, not the owner's, not even Blizzard's.

**AND IT IS RUN BACKWARDS IN `src/` NOW, BY THE OWNER'S OWN DESIGN, WHICH IS AN
EXCEPTION AND NOT A REPEAL.** `game/items/benchmarkGear.ts` generates four full
sets from the budget -- **B55, E65, E75, E85**, blue item level 55 and epic 65,
75 and 85 -- to a 25-row specification the owner supplied: each build's hit cap,
its reduced dodge/parry, and its preferred stats **in descending order of
importance**. The rule above forbids passing an invented item off as a sourced
one; **a benchmark item is not claiming to exist.** What makes it legitimate is
exactly what the rule asks for: the owner asked for it, it is named for the set
it belongs to, it is numbered from 9,500,000 clear of every real id, and
`itemsForSlot` never offers one, so nothing can mistake it for a drop.
**THE DANGEROUS VERSION WOULD BE THE SAME ARITHMETIC WITH A REAL ITEM'S NAME ON
IT.**

**THE OWNER SAYS WHICH DIRECTION AND THE ITEMS SAY HOW FAR, AND TAKING EITHER
ALONE IS WRONG.** Three rulings in one thread needed it, and each failed
differently when read literally:

| the ruling | read literally | what the items said |
| --- | --- | --- |
| "pull from crit rating to get more hit rating" | crit drained to **74** against a real mage set's 154, and spell power above the richest set in the database | bound it at 40% -- crit **153** |
| "the eight **plate** slots shouldn't have both strength and attack power" | plate only | **0 of 1,374** armour pieces carry both, every class -- so all four |
| the same, dropping the later stat outright | the Rogue's Strength **zero across the set** | both appear on real sets; the slots take turns |

**THE FIRST TRADES ONE UNREALISTIC NUMBER FOR TWO**, which is the shape to
watch for: a correction that overshoots looks like a correction right up to the
moment somebody measures the thing it was supposed to fix.

**AND A RULING CAN BE WIDER THAN ITS AUTHOR SCOPED IT.** "Likely only the DPS
warrior profiles" was a guess about which PROFILES would move, not about the
rule -- so **check the scope against the data rather than taking it from the
sentence**, and say which half of the statement you are relying on.

**AND A SET'S SHAPE IS AIMED AT FOREVER'S OWN ITEMS, WHICH THE BUDGET CANNOT
CHECK.** `item_budget.ts` asks whether an item fits its budget and every one
did while a benchmark set carried **295 crit rating and 205 spell power**
against real item-level-60-70 sets at **168-210 crit and 290-397 spell power**.
So crit sat 40% above the best real set in the game and spell power below an
ordinary one, and nothing in the suite could see it: **the budget's arithmetic
is about TOTALS and both faults were about SHAPE.**

`tools/real_set_shape.ts` is the measure -- the per-slot distribution of a stat
over real Forever items a class can equip, PvP excluded, summed across a set --
and `tools/benchmark_stat_report.ts` is what a generated set grants beside it.
**THE MEDIAN IS THE ANSWER AND THE MAXIMUM IS NOT**: taking the richest item in
every slot gives a ceiling no character wears, cherry-picked across factions,
raids and professions.

**A BENCHMARK SET SITS BETWEEN p75 AND BEST**, which is the one judgement in it:
these sets exist so two builds can be compared at one item level, so each
should be a STRONG set of that level and must not exceed what the game
contains. `SHARE_WEIGHT` is the lever, a per-stat multiplier on the positional
shares -- **a fraction of budget, so it scales with item level for free**,
where an absolute pullback would have to be re-derived per set.

**AND A TRINKET IS THE SLOT THAT GOES WRONG.** It is a ONE-stat slot, four of
the five preference lists open with Crit, and the trinket multiplier made the
pair **the two largest crit sources in the whole set -- 68 rating from two
items**. Real trinkets at that item level carry **no passive stats at all**:
of the 35 on file between item level 58 and 72, all 35 have a proc or an on-use
effect and 6 carry any engine stat. The owner's replacement is a pair of
archetypes -- one with 28 crit and a scaling damage stat, one pure -- and
**A MAXIMUM IS NOT A FIXED AMOUNT**: 28 crit costs 28 budget points and a B55
trinket has 23.3, so `trinketCrit` clamps it exactly as `staminaFloor` does.

**AND NO ARMOUR PIECE CARRIES BOTH STRENGTH AND ATTACK POWER**, the owner's
rule -- and **the data made it WIDER than they scoped it**. They said "the eight
PLATE armor class item slots ... this should likely only affect the DPS warrior
profiles"; across all **1,374 real armour pieces on file, every class, not one
carries both**. So `EXCLUSIVE_PAIRS` applies to all four armour classes, and the
owner's guess was about which PROFILES would move rather than about the scope.

**AGILITY AND ATTACK POWER ARE NOT A PAIR**, which is why that list has one
entry rather than a blanket "no two offensive stats": 8 leather and 21 mail
pieces carry both.

**AND DROPPING THE LATER MEMBER OUTRIGHT COLLIDES WITH THE ZERO RULE.** It took
the Rogue's STRENGTH to nothing across the whole set, which is the owner's own
earlier instruction about a stat going to zero. **The two are about different
SCOPES and both can hold**: the pair is about one ITEM and the zero check is
about the SET, so the slots take turns -- the earlier preference on three in
four, which is the real items' own ratio (plate 130 Strength to 14 Attack
Power, leather 33 to 22).

**AND A HIT OR EXPERTISE RATING IS PAID FOR OUT OF CRIT**, the owner's ruling
-- "instead of pull from spell power to get more hit rating, it should be pull
from crit rating". It replaced taking the cost off the TOTAL before the shares
divided anything, which shrank every stat together: four slots of every B55
caster set read **"+25 Hit Rating, +2 Stamina, +1 Spell Power"**, because at
the 3/2 power a slot with little left rounds each share to 0 or 1.

**THE RULE ALONE WOULD NOT HAVE FIXED IT, AND THOSE FOUR SLOTS SAY WHY: THEY
CARRIED NO CRIT AT ALL.** 25 hit costs **97% of a B55 medium slot** whatever it
is taken from, so `RATING_BUDGET_SHARE` caps a rating at half a slot and
`spreadRating` gives each slot what it can afford rather than one uniform
chunk. **The chunk was a circle** -- the smallest of 10/15/20/25 that fit the
total into a slot list that had itself been filtered by affordability, so a set
whose small slots could not afford 25 got FEWER eligible slots and therefore a
BIGGER chunk.

**AND THE LITERAL READING OVER-CORRECTS, WHICH THE ITEMS SAY AND THE RULE DOES
NOT.** Draining crit without limit leaves a caster at **74 crit against a real
mage set's 154** and pushes spell power above the richest set in the database
-- one unrealistic number traded for two. `RATING_DONOR_SHARE` bounds it at
40%, which lands caster crit at 153. **The owner's rule said which direction
and Forever's own items said how far**, which is the shape to copy.

**AND A PREFERRED STAT MUST NOT COME OUT AT ZERO ACROSS A WHOLE SET**, the
owner's ruling -- "that's unrealistic to how items are actually designed". A
template may name more stats than a slot holds and the first N were taken every
time, so the TAIL of a long list was bought nowhere: Ret had no Attack Power,
the Shockadin no Agility, both Protection builds no Block, the Bear no Defense.
The last position rotates through the tail by slot index now, which also stops
every piece in a set carrying the identical five stats.

**HIT AND EXPERTISE ARE ABSOLUTE TOTALS PER SET AND STILL COST BUDGET**, the
owner's instruction in capitals: "even though the needed hit cap is mandatory,
IT STILL COUNTS AGAINST THE STAT BUDGET ON THE ITEMS". So a Rogue spends 120
points on hit before buying anything else, which is what makes a benchmark set
a fair comparison rather than a wish list.

**EVERY ARMOUR-CLASS PIECE CARRIES STAMINA, AS A FLOOR, AND THE OWNER SPOTTED
ITS ABSENCE BY READING THE ITEMS.** "It's strange to me that stamina was dropped
on some of the template items ... Typically all armor class items have stamina."
**639 of Forever's 685 clean armour pieces carry it, 93.3%** -- so a piece
without any is the exception, and the generator had made it the rule by buying
stamina only when it fell inside a template's stat count. `staminaFloor` is a
share of the slot's budget on the EIGHT armour slots, and `tools/stamina_share.ts`
is what measures the real figure.
**A FLOOR RATHER THAN A PLACE IN THE PREFERENCE ORDER**, which is what leaves a
tank untouched: the Bear and both Protection builds already buy several times
it, and all five stamina-led profiles measured **0.0 to the decimal** across the
change. Putting stamina into the order instead would have moved it ahead of
every build's first choice.
**AND THE FLOOR IS CLAMPED BY WHAT THE RATINGS ALREADY TOOK**, which 48 items
proved by going over their own budget. A B55 medium slot has 25.6 points and a
Rogue's hit puts 25 Hit Rating on it -- 97% of `budget^1.5` -- so the floor on
top was 26.9 of 25.6. **A floor that wins against the budget is not a floor, it
is a leak**, and the honest answer is that such a slot cannot afford it.
**THE SHARE IS 25%, AND THE ROUTE TO IT IS THE POINT.** The owner remembered
"around 10-15% of its item budget"; it went in at 12.5% with the measurement
recorded beside it -- Forever's own non-PvP armour spends a median 25% of
`budget^1.5`, per slot 20.5% to 35.0% -- because "I BELIEVE" marks a
recollection and not a ruling. Shown the figures they ruled: "use 25% and
re-measure". **Picking a different number because the data suggests one is the
thing this project does not do; putting the data in front of the owner is the
thing that works**, and it is the fourth time their reading of a printed table
has settled something no tool here could.
**AND THE CAVEAT CAME OFF WHEN THE ANSWER LANDED**, which is the half that gets
forgotten: a flagged question outlives the doubt it describes, and a reader who
finds one next year cannot tell a live question from a settled one.

**HOW MANY STATS A SLOT CARRIES IS THE OWNER'S TABLE TOO, AND A PREFERENCE LIST
LONGER THAN IT SILENTLY LOSES ITS TAIL.** Head, chest and legs take FIVE;
shoulders, hands, feet and waist four; wrist, neck, rings and shields three; a
trinket one. Every slot used to take at most four, so a fifth preference was
never bought at ALL -- a caster benchmark granted **no Spirit**, and the Bear's
**Dodge** and **Defense** were fifth and sixth of its six. The owner on raising
the counts: "it should open up some space for Spirit, Dodge, Defense etc."
**FIVE OF THE 25 TEMPLATES STILL LOSE SOMETHING**, because they list six or
seven: both Protection builds lose `Block`, the Bear loses `Defense`, Seal Twist
Ret loses `Stamina` and `Attack Power`, the Shockadin loses `Agility` and
`Attack Power`. Twenty of 25 now buy everything they list. **A spreadsheet row
is a wish and a slot count is a budget**, and where they disagree the row's tail
is what gives -- so the count is worth checking against the longest row before
reading a set as faithful.
**AND IT CHANGES THE SHAPE RATHER THAN THE TOTAL**, which the owner called:
"I understand that this may change the shape of the gear." Five stats on a head
is five smaller numbers, and the 3/2 power makes that cost something real -- a
concentrated item buys more total stat than a spread one, which is what the
exponent is for.

**IT GENERATES TOOLTIP TEXT AND PARSES IT BACK**, rather than writing stat
blocks directly, so a generated item travels the same path a captured one does
-- and that is how **1,384 stranded spell power lines** were found, because the
generator wrote a line nothing could read. A shortcut straight to the stat block
would have hidden the engine bug it exposed.

**THE COST OF THAT CHOICE IS A SEAM, AND IT SWALLOWED EVERY PRIMARY ON EVERY
SET.** `LINE.Strength` writes "+19 Strength"; a CAPTURED item carries its
primaries in the raw `stats` object, so no rule existed for the words. A
Warrior's E65 came out as **328 Critical Strike Rating with no strength, stamina
or agility at all** -- 23.4% crit from gear, entirely plausible -- and the first
full measurement of the four sets was taken that way.

**WHAT MADE IT INVISIBLE IS THAT `budget` AND `spent` STILL BALANCED**, because
both are computed from the ALLOCATION rather than from the parse. Every item was
inside its budget, in the right slot, with a tooltip that reads correctly to a
person. **A generator that checks its own arithmetic has checked the half that
was never in doubt**; what needed checking was whether the words it wrote are
words the reader knows.

**SO THE GUARD IS ON THE OTHER SIDE OF THE SEAM.** `benchmarkGear.test.ts`
asserts that no generated item leaves anything in `unmodelled` -- a line there
is a stat the set paid budget for and did not grant -- and
`tools/item_vocabulary.ts` reports the generated items in their own section.

**AND THAT TOOL HID THE BUG FROM ITSELF FOR A COMMIT, WHICH IS THE SHARPEST
LESSON HERE.** It EXCLUDED ids above 9,500,000, on the reasoning that an unread
line on a generated item is a bug in the generator rather than a gap in the
parser's vocabulary. That reasoning is correct. The exclusion was still wrong,
because the generator is the thing most likely to write a line nobody has taught
the parser to read. **An exclusion justified by "that would be a different kind
of bug" is an exclusion that hides that kind of bug.**

**AND `Math.floor`, NOT `Math.round`, PLUS A SLOT THAT CAN AFFORD THE RATING.**
Two separate ways to go over budget: rounding up, and placing a rating on a slot
too small to pay for it -- a B55 neck at 18.8 points of an 18.3 budget. Filter
the candidate slots by affordability BEFORE spreading a rating across them.

**TWO THINGS COME FREE WITH THE ITEM LEVEL RATHER THAN OUT OF THE BUDGET**, and
both were found by the budget refusing to balance. **BASE ARMOR** is a function
of slot, armor type and item level -- and it cannot be budgeted, because
Breastplate of Might's 749 armor at the sourced cost of 0.1 is `74.9^1.5` = 648
against a whole chest budget of 352. **WEAPON DPS** is a straight line in item
level per hand, and the fit is barely a fit: ten epic one-handers between item
level 66 and 77 sit on one line with a worst residual of **0.31 dps**. What IS
budgeted is giving either of them up -- Cenarion Pauldrons carry 120 armor above
the leather-shoulder baseline, and Azuresong Mageblade is 10.1 dps below the
one-hand line and spends the difference on spell power.

**SO A CASTER WEAPON PRICING AT 206% OF ITS BUDGET IS NOT THE MODEL FAILING**,
which is what it looks like beside Zin'rokh at 87%. Three of the ten examples
are weapons and all three of the apparent failures are the DPS trade. **A model
that explains its own outliers is worth more than one that has none**, and the
exchange rate it implies -- about 2.5 budget points per dps forgone, from TWO
items -- is printed beside the item rather than folded into the budget, because
folding it in would hide the one number this model does not have.

**AND THE OWNER HAS SINCE SUPPLIED REAL FOREVER ARMOUR, WHICH IS THE FIRST OF
IT IN THE PROJECT.** The 64 Premier PvP cloth pieces, item level 65, three
classes, eight slots -- transcribed by hand from screenshots into
`tools/foreverPremierPvp.ts` as reference data for the audit tool while the
database was still frozen. **They are equippable items now**, arriving with
everybody else through `foreverchanges.pro`, and that transcription is kept
because it was read off the owner's own client rather than off the diff site --
two independent readings of the same 64 items.

**BASE ARMOUR IS NOW CONFIRMED FREE ON THE RULESET'S OWN DATA.** Forever's
item-level-65 cloth wrist is 44 armour and its waist is 56 -- identical to
Classic's General's Silk Cuffs and Sash at the same item level -- and four
pieces list `+40 Armor` among the STATS, separately from the slot's own armour
on the line above. **Forever's client writes the base/bonus split out**, which
Classic's tooltips never do.

**AND IT USES RATINGS WHERE CLASSIC USES FLAT PERCENTAGES.** "+7 Critical
Strike Rating" where Classic's own rank-13/14 cloth says "+1% spell crit", so
the budget source's blanket "any rating costs 1" -- dead weight in a ruleset
with no ratings -- finally has something to price. **Healing and spell damage
are two lines too**, "+33 Healing" and "+11 Spell Damage", at a ratio of 3.0
across all five pairs that occur.

**THEY SIT AT 85.1% OF CLASSIC'S EPIC BUDGET WITH A STANDARD DEVIATION OF 3.2
POINTS, AND THE TIGHTNESS IS THE FINDING RATHER THAN THE 85%.** That is
TIGHTER than the Classic and SoD items on file, which scatter over 90-110%: the
Classic cost table reproduces the SHAPE of a Forever item better than it
reproduces Classic's own. What differs is the LEVEL, and whether that is a
Forever budget or a PvP discount is **a question for the owner** -- Classic's
own item-level-65 PvP cloth is also under budget, at 96.0% and 90.6%, so PvP
gear being cheap is not a Forever invention and two items cannot say how the 15
points divide.

**A WRONG STAT COST AND A WRONG BUDGET LOOK ALIKE, AND WHAT SEPARATES THEM IS A
CORRELATION WITH THE ITEM'S COMPOSITION.** A scaled budget moves every slot and
every build together; a dearer stat pushes the items that buy a lot of it
further off. Here the budget reading wins -- 3.8 points of residual against
5.8, and making spell power dearer leaves a +0.80 correlation with spell-power
share. **THE FIRST CUT GOT THE OPPOSITE ANSWER FROM THE SAME DATA**, because it
computed that share over spell power and spell damage while leaving HEALING
out, which made it a test of "is this a healer piece" and returned -0.60.
**A correlation whose sign depends on how the denominator is defined is not
evidence**, and the cheap guard is to define the share over every stat the
hypothesis touches.

**AND THE STAT BLOCKS REPEAT, WHICH IS A TRANSCRIPTION CHECK FOR FREE.** Thirty
distinct (slot, stats) blocks across the 64, with 62 appearing in BOTH rank
tiers -- Centurion's Felweave Boots is Knight-Champion's Dreadweave Boots under
another rank name. That leaves exactly two items without a twin and **they are
the same item except 34 stamina against 37**, where every other head piece is
34. Flagged on the row rather than corrected, because a 7 read off a 4 is the
likelier explanation and it is the owner's client to check.
**THE CHECK ONLY WORKS WITH THE KEYS SORTED**: `JSON.stringify` preserves key
ORDER and the stats were transcribed in each tooltip's own order, so an
unsorted key reported four twinned items as unique -- a check quietly weakened
into saying nothing, caught only because an independent script had counted 30
where it counted 34.

**THE SHORTFALL IS PvP AND NOTHING ELSE, AND IT TOOK A CONTROL GROUP TO SEE
IT.** The question was answered twice and wrongly, both times for the same
reason: **there was no baseline, so 100% was used as one, and 100% is not a
number this model reaches even on Classic.**

`forever-changed-epics.json` is the control. 487 of its 653 items differ from
Classic ONLY IN WORDING -- Classic's "Improves your chance to get a critical
strike by 1%" is Forever's "+14 Critical Strike Rating" -- so their stats ARE
Classic's, and pricing them measures CLASSIC'S itemization through the same
model, on the same slots, at the same item levels, with the same blind spots.
Clean armour at item level 65:

| | n | mean |
| --- | --- | --- |
| **Classic's own epics** | 24 | **93.2%** |
| **Forever new, not PvP** | 41 | **93.3%** |
| Forever new, PvP | 66 | 87.0% |

**Classic and Forever's non-PvP gear agree to a TENTH OF A POINT.** There is no
general Forever budget reduction; the ~7 points below 100% are the MODEL's own
residual, and the only real effect is a PvP discount of about 6.

**AND THEN THE PvP GAP TURNED OUT TO BE ONE UNCERTAIN PARAMETER, WHICH IS A
THIRD WRONG ANSWER TO THE SAME QUESTION.** The budget source prices stamina at
0.67 and FOOTNOTES IT -- "changed with Burning Crusade, originally 1 as well"
-- and everything here is pre-Burning Crusade. **The Premier PvP sets spend
40.8% of their budget on stamina against 14.0% for Classic's own epics**, so
that one cost is exactly the lever that moves PvP gear relative to everything
else, and the gap goes **-6.2 at 0.67, -0.1 at 0.87, +4.0 at 1.00**. It
inverts.

**TWO INDEPENDENT CRITERIA LAND ON 0.86-0.87** -- "Classic's own gear should
price at 100%" and "PvP gear has no reason to be discounted" -- which is the
encouraging part. **But 0.86 is FITTED and absorbs every other residual in the
model**: if the fitted crit cost of 16 or a slot multiplier is wrong, this is
where it shows up. The source's 0.67 and the footnote's 1.0 BRACKET it, and
the sourced era-correct 1.0 is the default.

**AND THE SPELL POWER ANSWER WAS WRONG TOO UNTIL THE OWNER SPLIT THE
POPULATION.** Asked to re-run ignoring items that carry healing AND spell power
together -- "that may be a different case" -- the effect vanished entirely:
pure damage-caster items run **+0.7 +/- 1.9** over non-caster items in Classic
and **-0.5 +/- 2.7** in Forever's non-PvP gear, and the best-fit cost is
**0.851 for Forever against a transcribed 0.86**. Forever's caster items fit
the stated cost BETTER than Classic's own do.

**THE ANOMALY IS HEALING, AND IT WAS CONTAMINATING THE SPELL POWER SIGNAL.**
Healing items run 107.4% (Classic), 112.1% (Forever non-PvP), 117.3% (PvP).
Forever writes a healer item as TWO lines -- "+33 Healing" and "+11 Spell
Damage", at a ratio of 3.0 across every pair in the data -- and charging both
treats one design decision as two purchases: dropping the rider takes Forever's
non-PvP healing items from 112.1% to **102.8%**.

**AND THE BLUES CONFIRM ALL OF IT ON A POPULATION THAT FITTED NONE OF IT.**
611 rares at item level 50-60 price on a DIFFERENT quality row --
`0.625 x ilvl - 1.15` -- and with the epic settings carried over unchanged they
land at **100.3% +/- 2.3 for Classic's own and 100.6% +/- 0.8 for Forever's**.
Best fit against that control is **stamina 0.99** and **healing 0.49**, against
the 1.0 the owner ruled and the 0.45 the source states. **Nothing about the
blues was used to choose either number**, which makes this the strongest
evidence in the thread -- and at stamina 0.67 the same blues read 93.8% and
87.0%, reproducing the artefact exactly.

**A SECOND QUALITY ROW AND A SECOND ITEM-LEVEL BAND IS WHAT AN INDEPENDENT
CHECK LOOKS LIKE**, as against more items of the kind already fitted. The epic
work could not distinguish "the model is right" from "the model has been tuned
to these items"; the blues can, because they were never in the tuning set.

**AND THE EXTENSION FOUND TWO IMPORTER GAPS, BOTH REAL.** `Thrown` is an
inventory type nothing here had seen -- Classic equips a thrown weapon in the
RANGED slot, so that is the mapping, with the source's own word kept in the
tooltip. And **Orb of Deception has no equipment slot at all**, a bag item
whose only line is a Use effect: it reached the importer because the capture
filter keeps anything with an effect, which is right for a trinket and wrong
for this. Excluded and listed by name, under its own heading rather than the
test-item one -- **two exclusions for two reasons are two lines of output**,
because a shared label made the Orb read as a developer test item.

**AND WITH THE BY-PRODUCT NOT CHARGED FOR, 0.45 FITS.** The paired spell damage
is 1/3 of the healing (measured 3.0, range 2.86-3.14); dropping it, healing
items sit **+2.6 +/- 2.7 over their own siblings in Classic and +2.0 +/- 3.6 in
Forever**, and the best-fit cost is **0.42 in BOTH** -- the same number to two
decimals, inside the uncertainty of the transcribed 0.45. **So the healing cost
is not a Forever change either**: once one purchase is charged once, Forever's
healer items are priced exactly as Classic's are.

**THE ONE RESIDUAL LEFT IS PvP HEALER GEAR, 10.3 +/- 4.2 OVER ITS OWN SIBLINGS
(2.5 sigma), AND IT IS RECORDED AS OPEN RATHER THAN CLAIMED.** It is the only
thing in the whole thread that survives a control group, a sensitivity sweep
and a population split -- and it is also the population confounded at every
earlier step, being 40.8% stamina and the group that inverted when the stamina
cost moved. **A finding that only ever appears in the population most sensitive
to the model's weakest parameter is not yet a finding.**

**MIXING TWO POPULATIONS AND FITTING A PARAMETER TO THE BLEND PRODUCES A
CONFIDENT NUMBER FOR A THING THAT DOES NOT EXIST**, which is what "spell power
is 9% too expensive" was. It is the fourth correction in this thread and the
only one that came from NARROWING the population rather than widening the data
-- every earlier fix needed a new capture; this one needed somebody to notice
that two kinds of item were in one bucket.

**AND THE BEST-FIT COST FALLS AS THE STAT'S SHARE OF BUDGET FALLS** -- healing
fits 0.36 at a 36% share, 0.20 at 22%, 0.10 at 13%. The fit blames whatever it
is allowed to move. **Read a best-fit figure beside the share of budget that
stat actually commands**, or it is answering a different question.

**AND THE SAME METHOD ANSWERED THE SPELL POWER QUESTION WITHOUT A FOURTH WRONG
ANSWER, WHICH IS THE POINT OF HAVING IT.** Asked whether Forever devalued spell
power to fit more on an item, the control separates "the model's cost is wrong"
from "Forever changed it": items carrying spell power run over budget by
**+2.5 +/- 2.0 in CLASSIC's own gear** and +4.4 +/- 2.4 in Forever's non-PvP
gear, so the transcribed 0.86 is a little high for this era REGARDLESS of
ruleset. **Forever's premium over Classic is +1.9 +/- 3.1, which is 0.6
sigma** -- suspicion directionally right about the cost, not supported as a
Forever-specific change. Best fit against the control is **0.783**.

**AND THE CLASSIFICATION NEARLY REPEATED THE MISTAKE IT WAS TESTING.** The
first cut split "caster" from "physical" by spell power's SHARE of budget --
which moves with the stamina cost -- so the categories depended on the
parameter under test and the stamina-heavy PvP sets kept crossing the
threshold. Classifying by whether the item carries ANY spell power is
parameter-free. **A test whose GROUPS depend on the thing being tested is not a
test.**

**A FIT WILL ALWAYS BLAME THE PARAMETER YOU LET IT MOVE**, which is why the PvP
row comes back wanting spell power at 0.361: spell power is a small share of
those items, so the fit drives it absurdly low trying to pull a STAMINA-heavy
population down. Read a best-fit figure beside the share of budget the stat
actually commands, or it is answering a different question.

**NO CONCLUSION RESTING ON LESS THAN ABOUT TEN POINTS OF BUDGET IS SAFE HERE,
AND THREE ANSWERS IN A ROW RESTED ON SIX.** "Not PvP-specific" (two items),
"11 points general plus 5 PvP" (no baseline), "PvP only, about 6" (this). Each
correction came from better data and each felt conclusive. **What would have
prevented all three is a SENSITIVITY CHECK** -- vary the least certain
parameter and see whether the conclusion survives -- and it now costs one
command, `STAMINA=0.67 FOREVER=1 npx vite-node tools/item_budget.ts`.
**A CONTROL GROUP ANSWERS "COMPARED AGAINST WHAT"; IT DOES NOT ANSWER "HOW
SURE IS THE MODEL".** Those are two different questions and this took both.

**SO "COMPARED AGAINST WHAT" WAS THE WHOLE QUESTION, AND IT WENT UNASKED
THROUGH TWO ROUNDS OF CONFIDENT ARITHMETIC.** The figures were never wrong --
84.6% and 89.2% are what those items price at. What was wrong was treating a
reconstruction's 100% as ground truth. **A model needs a control before it
needs more data**, and the control was one capture away the entire time.

**TWO ITEMS AGREEING IS NOT EVIDENCE WHEN THE POPULATIONS OVERLAP**, which is
the same shape as this file's "a two-point comparison cannot see a peak" and
its warning about an identical pair. The guard is the one the stat-weight work
already states: **report n and the spread beside the figure**, because a reader
sorting rows by value cannot otherwise tell which the measurement can stand
behind.

**AND THE NON-PvP ITEMS SCATTER TWICE AS WIDELY** -- sd 9.5 against 5.6, from
67.6% to 121.4% -- which is what hand-made items look like beside ones stamped
from templates. The PvP sets are 30 pieces a slot built from a handful of stat
blocks; the rest are individually designed.

**AND AN ITEM WITH A PROC READS LOW, WHICH IS THE MODEL AND NOT THE ITEM.** A
proc, an on-use or a set bonus costs budget that nothing here can price, so the
item comes out short through no fault of the ruleset -- Classic epics with one
price at **90.0%** against **95.4%** for the ones without. Classic gear is full
of them, so any comparison that does not filter them is measuring how many
procs each population has. `isClean` in `item_budget.ts` is that filter.

**`critRating` WAS DECLARED, EXPORTED, DOCUMENTED, PRICED BY THE STAT-WEIGHT
CATALOGUE AND READ BY NOTHING.** Both places that build a crit slice --
`game/combat/attackChances.ts` and the engine's `defaultAttackChances` -- read
`stats.critChance` off the block, so `critChanceFrom`, the ONE function that
folds the rating in, **had no callers anywhere in the project**. Two correct
halves with nothing joining them, which is precisely how `armorPenetration`
shipped unread.

**IT COST NOTHING UNTIL FOREVER GEAR GRANTED A RATING, AND THEN IT COST 1% DPS
ON THIRTEEN PROFILES.** What made it findable was the DIRECTION: every one of
the thirteen moved DOWN. **Float-truncation noise is symmetric and a missing
point of crit is not**, so "all thirteen negative" is the tell -- the first
explanation reached for was the documented truncation hazard, and that
explanation predicts a sign that the data did not show.

**AND THE FIX HAD THREE SITES, NOT ONE.** The engine fallback, the ruleset's
own provider, and `createPet`, which inherits the owner's crit and was reading
the raw stat too. Fixing the first two left **BM Hunter at -1.2** and every
other affected profile at 0.0 -- a residual that names its own cause, because
BM is the one profile with a pet. **A join that is missing in one place is
worth grepping for in all of them.**

**ONE RATING FEEDS BOTH TABLES IN FOREVER**, which the changed items settle
rather than suggest: Classic has separate "critical strike" and "critical
strike with spells" lines and Forever rewrote both into one Critical Strike
Rating, at **exactly 14 per point in each direction** across 62 items carrying
the pair. Reading it on the melee side only would have deleted every point of
spell crit Forever gear carries.

**AND THE 83 REWRITES CONFIRM THE OWNER'S WHOLE TABLE INDEPENDENTLY**: crit
14.0 across 42 items, spell crit 14.0 across 20, hit 10.0 across 18, dodge 12.0
across 3, **with no variation at all**. The table came from the owner in one
message and the client's own item data reproduces it exactly.

**THE ONE-HAND AND RANGED ROWS LOOK LIKE A PvP PREMIUM AND ARE MOSTLY THE 3/2
POWER.** High Warlord's Blade and Ironwood Blade carry nearly the same raw
points -- 27.34 against 26.04 -- and price 13 points apart, because the Blade
concentrates its spend into two large chunks where the Ironwood spreads it over
three small ones; the Blade's own points spread evenly would price at 92.3%
instead of 101.4%. **A concentrated item costs more for the same stat total,
which is what the exponent is FOR** -- so reading a used% difference as a
richness difference needs the raw points checked beside it.

**WEAPON DPS IS NOW DEMONSTRATED RATHER THAN FITTED.** At one item level a
hand's dps does not move with speed: Forever's one-handers run 47.2 to 47.4
across speeds 1.80, 2.00, 2.30, 2.40 and 2.90, a 61% spread in speed and none
in dps. **And the lines fitted from CLASSIC weapons predict all three hands
within 0.65 dps**, having never seen a Forever item -- so Forever did not
re-derive the weapon curve any more than it re-derived base armour. The six
caster weapons each give up **15.6 to 15.9 dps**, and on the two-hand slot that
is 2.97 budget points per dps, corroborating the 2.33-2.72 estimated from
Classic.

**AND FOREVER GRANTS HIT AND CRIT AS RATINGS, WHICH IS AN ENGINE QUESTION AND
NOT ONLY A BUDGET ONE.** Fourteen stat names across those 41 weapons and every
one has a cost in the source -- the first capture here where nothing falls
through -- including **Critical Strike Rating, Hit Rating and Spell
Penetration**, three things Classic could never have tested because it has no
ratings at all. `STAT_NAMES` carries `hitChance` and `critChance` as flat
percentage POINTS and `critRating` is barely read. **The conversion is the
owner's to state**, and nothing here invents one.

**AND THAT CAPTURE IS BUILD 1.60.1.70338 WHERE THE PROJECT'S ARE 1.60.1.70170.**
Two builds stale, by this file's own rule that a capture goes stale and a
correct number becomes a wrong one with nobody touching it. Not acted on with
the itemization work, and now a dated fact rather than a suspicion.

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

**THE TAB HAS TO BE FRONTED OR THE WRITE DOES NOT LAND, AND `execCommand`
REPORTS SUCCESS EITHER WAY.** A background tab's copy returns `true` and
`Get-Clipboard` comes back with whatever was there before -- so the hash check
is what catches it, and without one the previous chunk would have been imported
twice under the new chunk's name. `tabs_select` first.
**AND CHUNK IT AT 70-90KB.** 362KB in one write came back empty with no error;
hash each chunk in the browser, re-hash on disk, and concatenate only once
every piece matches.

**A 403 ON `curl` IS NOT A DEAD END WHEN THE DATA IS A PAGE'S OWN JSON.**
`foreverchanges.pro/items/*.json` refuses a plain request and serves the same
bytes to a `fetch` from its own origin, which the built-in browser can make.
**Read it in the browser, hash it there, and prove the transfer** -- which is
the rule above, not an exception to it.

**Validate scraped data at load and throw.** `talentData.ts` checks tier against
row, prerequisites resolving inside their own tree, and duplicate ids; the item
loader recomputes each weapon's dps from its damage and speed. A page that changes
shape should fail loudly, not render a tree with a broken arrow.

## Testing

- **Write the spec out independently in the test.** The race/class table, the
  per-class resource table and the combat table constants are all duplicated by
  hand on purpose: a test that reads the source data passes no matter what the
  source data says. Where volume makes that impractical — 466 talents —
  transcribe the shape and assert the invariants that hold for all of them.
- **Two independent checks on a captured number**: the expected value written out
  by hand from the tooltip, AND the stored tooltip asserted to contain that same
  number. A typo fails the second; upstream drift fails `--verify`.
- **Assert what should stay true, not what happens to be true today.** A test
  pinned to a temporary limitation outlives the limitation — one was named "still
  says it cannot fire, because nothing attacks the player" and enforced the stale
  caveat instead of catching it.
- **Assert the MECHANISM, not a DPS delta.** A correct talent can be worth zero.
- **A TEST THAT HARD-CODES A GEAR FIGURE IS TESTING THE GEAR, AND ABOUT FORTY
  OF THEM WERE.** Replacing the twelve Classic stand-in sets with generated
  benchmark gear broke 100 tests across 22 files, and almost every one broke for
  the same reason: a literal that was a PROPERTY OF THE SET rather than of the
  thing under test. "The Shadow Priest carries ONE point of spell hit";
  "Deflection is 1% a rank, so 5/5 doubles the baseline" (true until the gear
  granted parry); "the shield's 71"; "409 off the items plus 30 from the staff
  enchant".
  **THE REPAIR IS THE SAME EVERY TIME: READ THE BASE OFF THE CHARACTER AND
  ASSERT THE RULE.** `17 - hitChance` for a miss band, `shield.stats.blockValue
  + strength / 20` for block value, `(base + 16) * 1.1` for Blessing of Kings --
  a base that is MEASURED cannot be stale, and the arithmetic written out by
  hand is the part that was ever the claim. Several of these had already been
  rewritten once when the armour enchants landed and once when a weapon buff
  did; the third rewrite is the one that stopped them needing a fourth.
  **AND IT FOUND THREE REAL BUGS ON THE WAY**, which is the argument for doing
  it rather than widening a tolerance: a test asserting a figure fails the same
  way whether the gear moved or the engine broke, and only re-deriving the
  figure tells you which.
- **A FIXED MARGIN BETWEEN TWO MEASURED RATES IS A THIRD KIND OF STALE FIGURE.**
  "Crit against an equal-level target must exceed crit against a boss BY 0.02"
  held for as long as the build made a particular number of swings, and missed
  by 0.0004 after a gear change. The suppression itself is pinned exactly beside
  it; what this assertion is for is that it REACHES the roll, so the comparison
  is the direction and not the size.
- **A `createPlayer` COMBATANT CARRIES A ROTATION, SO A TEST THAT RUNS THE CLOCK
  IS TESTING THE PRIORITY LIST TOO.** A Soul Siphon test cast Wrack once,
  advanced ten seconds and summed every `wrack` damage event -- correct only
  while Wrack was in no list, and nothing said so. The day it entered the SM/DS
  list the ROTATION cast it a second time inside the window, and
  **ASYMMETRICALLY**: the second cast is gated on three bleeds being up, so the
  "three bleeds" arm got ten ticks and the "no bleeds" arm six. The ratio read
  2.27 against an expected 1.36 and neither number was about the talent. Strip
  the rotation (`soloPlayerFor`) or use `makeAttacker`, which has none -- and
  note that this test PASSED at main and failed only with the list change, which
  is the signature of a latent dependency rather than a broken mechanism.
- **A TEST THAT READS A PROFILE TO PIN A MECHANISM BREAKS ON A REVISION THAT
  HAS NOTHING TO DO WITH IT, AND FIVE DID IN ONE SESSION.** Reverberation,
  Shamanistic Focus, Arcane Resilience, Focused Fire's reason wording and the
  Mage's Presence of Mind entry all took `PRESETS_BY_ID.get(...).build().talents`
  to test a rule, and all five failed when the owner respecified a build. Four
  build their allocation by hand now.
  **THE CORRECTION WAS ALREADY WRITTEN DOWN, ONE REVISION EARLIER.**
  `grantCastModifier.test.ts` had recorded it for Mental Agility in its own
  words -- "this pins a mechanism, so it must not depend on which talents a
  profile happens to spend points on" -- and the file next to it did the same
  thing again. **A comment recording a lesson is not a mechanism**, which this
  file says about `validateProfile` and is true one layer up.
  **THE OTHER HALF IS TO ASSERT THE BUILD FACT SEPARATELY.** "No Mage profile
  takes Arcane Resilience any more" and "no Hunter preset takes Focused Fire"
  are real and worth pinning -- just not in the same assertion as the rule, or
  the rule moves when a profile does.
- **AN ABSOLUTE EXPECTATION ON A PER-ABILITY MULTIPLIER IS A CLAIM ABOUT EVERY
  TALENT THAT LANDS THERE.** Aftermath's test expected the Firelock's Immolate
  modifier to be 1.20 and read **1.32**, because Agonizing Flames multiplies on
  the same ability id. **The code was right and the assertion was wrong** --
  which is the cheaper of the two outcomes and only because the figure was
  implausible enough to check. Measure such a talent as a RATIO against the same
  build without it, and print `legalAllocation(...).dropped` beside it so the
  removal is known not to have stripped a deeper talent.
- **A CAST COUNT IS A ROTATION OUTCOME, however much it looks like a mechanism.**
  SM/DS's Life Tap assertion wanted more than three casts a fight, was loosened
  to "more than one" when the preset raid buffs gained Blessing of Wisdom and
  Mana Spring Totem, and hit ZERO when Wrack entered the list and the profile
  stopped running dry. Twice invalidated by changes that had nothing to do with
  Life Tap. Assert the conversion -- health for mana, one for one -- which
  neither a raid buff nor a list can move.
- **A TEST THAT PINS CONSTANTS PINS NOTHING, and the way you find out is a rework
  passing untouched.** Windfury Weapon's tests asserted 20%, two attacks, 333
  attack power, a 3-second cooldown and that the reaction was registered. Every
  one still passed after the effect was rebuilt from "apply an attack power aura,
  then swing twice" into "deal two special attacks carrying that power" — a
  change worth 21.8 DPS that moved which combat table resolved the hits, whether
  they could glance, whether the swing timer reset and which row they reported in.
  **The constants were never what could be wrong.** Ask what the effect DOES that
  a reader could not see: the outcome it produces, the row it lands in, the timer
  it leaves alone.
- **Combat table boundaries use scripted rolls, not sampling.** An off-by-one at
  a boundary shifts every damage number a fraction of a percent.
- **Verify a probabilistic mechanic against its rate, over many seeds.** A 6.5%
  dodge chance is absent from an entire 100-second fight about once in two
  hundred runs. Naming a specific ability in a training-dummy assertion pins a
  rotation decision rather than the behaviour under test.
- **AND A CAST COUNT IS A RATE, HOWEVER DETERMINISTIC THE SEED MAKES IT.**
  Evocation's "the Fire list reaches it" was asserted on seed 12345 alone, and
  passed for as long as that one fight happened to run dry. Giving the Mage
  presets their consumable row moved the rate from 16 casts in 20 fights to 14
  — the mechanism is as reachable as it ever was — and **seed 12345 fell the
  other side of the gate**, so the test failed on something that still works. A
  single seed is how this project tests a BOUNDARY, with a scripted roll; a cast
  that depends on a pool draining is the other kind. Count over twenty and
  assert loosely.
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
- **THE "SYNCHRONOUS TEST CANNOT TIME OUT" CLAIM IS SETTLED, AND IT IS WRONG.
  FOURTH INSTANCE, WITH A MEASURED DURATION.**
  `chargeAndShieldTalents.test.ts`'s "lets the Prot preset Charge once" failed
  under the full suite at **5,224ms against the 5,000ms default**, and the file
  still has **zero async bodies and zero awaits**. A synchronous body that
  overruns IS reported as a timeout; the reasoning below -- that the body blocks
  the event loop so vitest's timer never fires -- explained away the first
  instance and misdirected three investigations after it, into non-determinism,
  into the shared checkout, and into the commit that first added 449 items.
  **THE FIX IS A LIMIT, NOT A DIAGNOSIS.** That test runs TWO Monte Carlo
  batches where its three siblings run one, so it carries an explicit
  `30_000` now and the others are left on the default -- widening all four
  would hide the next one that genuinely gets slower. `vite.config.ts` still
  sets no `testTimeout`.
  **AND THE ARTIFACT RULE IS WHAT PRODUCED THE NUMBER.** The duration was the
  whole diagnosis, and it survived only because the run was captured. A
  re-run passes and destroys it, which is what happened the first three times.
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

**AND AN AUDIT THAT CANNOT NAME AN ABILITY REPORTS IT AS NEVER FIRED.**
`printUses` joins a priority list's IDS to a damage table keyed by NAME through
`ABILITY_NAMES`, and falls back to the raw id when the map has no entry -- which
can never match. The five racials arrived in every list at once, were absent
from that map, and **printed `<-- NEVER FIRED` on all 25 profiles** while a
direct count off the event stream had each of them casting once a fight. **A
tool that answers "did this entry fire" must know every ability a list can
name**, or its zero means two different things.

**AND FIXING THAT CREATED THE SECOND PROBLEM: AN HONEST ZERO AND A FINDING LOOK
ALIKE.** Every list names all four free racial cooldowns and a character learns
only whichever its RACE grants, so every profile grew three or four expected
zeros -- and "a row of zeros looks like a row of numbers in a table this wide"
is that function's own comment. It reads the built character's ability book now
and prints **"(not learned by this build)"**, which is the distinction this file
already describes: reading the book is what tells the BUILD cause apart from the
POSITION cause rather than guessing.

**AN AUDIT FINDS A NEVER-FIRED ENTRY AND SAYS NOTHING ABOUT WHY. MEASURE THE
CAUSE.** Hammer of Wrath is the worked example: the plausible explanation — "needs
the target below 20% health" — was written into the docs and was wrong, with the
code disproving it one file away. Sampling `checkCast` through the window gave 22
refusals for `not_enough_resource` against 3 for `on_gcd`, because the Retribution
Paladin spends 3425 of the 3449 mana it gains. **And the cross-check that
separates "cannot afford it" from "broken" is another build firing the same
ability** — the Shockadin casts it 0.3 times a fight on more mana.

**A DIFFERENCE THAT GETS WRITTEN DOWN STILL NEEDS SOMEBODY TO CALL IT WRONG.**
The commit that derived the combat tables from weapon skill recorded, in
`docs/combat-tables.md`, that "the formulas are consistent with the constants they
replace; **only miss moves, from 8% to 9%**" -- dodge reproduced its flat 6.5%
exactly, glance its 40% exactly, and miss alone changed by a point, because the
large-gap regime was given a second, higher base. `BASE_CHANCES.meleeMiss` had
been **8**, from the owner's own combat table.

**TWO OF THREE FIGURES REPRODUCING AND THE THIRD MOVING IS THE SHAPE OF A BUG**,
and that sentence sat for a year reading as a note ABOUT the formula rather than
as a defect in it. Nobody was misled by the code; they were misled by the
sentence above it agreeing with it. The owner eventually restored the figure as a
patch note -- "the new melee and ranged attack miss chance against a level 63
target is now 8% not 9%" -- and it was worth **+1.7 to +11.7 across 15 of the 25
profiles**, the widest-reaching change of the five patch rounds.

**SO WHEN A DERIVATION REPLACES FLAT CONSTANTS, THE CHECK IS THAT IT REPRODUCES
EVERY ONE OF THEM**, and a single exception is the finding rather than a footnote.
It is the same failure as a reason that describes a working half: a true,
specific, written-down statement that nobody treats as a question.

**AND A FIX FOUND ON ONE PROFILE IS TESTED ON ONE PROFILE'S ABILITIES, WHICH IS
THE COVERAGE SHAPE AGAIN.** Touch of the Grave's DoT bug was found on the SM/DS
Warlock and fixed, and the first tests covered the three WARLOCK DoTs that
exposed it. Asked whether others were left behind, a sweep of every ability
every Undead-legal class can cast named **six** against the old code -- Shadow
Word: Pain, Devouring Plague, Rupture and Rend as well. **NOT ONE OF THOSE FOUR
IS REACHED BY A PROFILE**: there is no Undead Warrior, Priest or Paladin preset
at all. **So the build that exposes a bug is not the measure of the bug**, and
the check that closes it walks the BOOK rather than the profiles.
**FORCE THE ROLL RATHER THAN SAMPLING IT, so one cast is decisive.** The first
version of that sweep drove two hundred casts an ability and was useless twice
over: the caster's AUTO-ATTACKS procced too, so rows that never cast at all
reported a dozen procs, and an ability on a three minute cooldown got one cast,
where zero procs at 10% means nothing -- Devouring Plague read as a gap on a
sample of one. `rollChance` forced true, auto-attacks off, and a hundred points
of hit so the proc's own table cannot miss.
**AND PIN WHAT THE HARNESS CANNOT REACH.** Eight abilities need fight state it
cannot fabricate -- a seal up, the execute phase, a dodge, a block, stealth, the
opening instant -- and they are listed BY NAME, because "could not drive it" and
"takes no roll" are the two answers such a check exists to keep apart.

**AND A PROC'S RATE NEEDS A DENOMINATOR, OR HALF OF IT CAN GO MISSING IN
SILENCE.** Every assertion about Touch of the Grave was about an ability that
deals direct damage, so every one passed while three pure DoTs took no roll at
all -- 3,022 tests green on a proc firing at half its stated rate. **The check
that finds it is procs divided by the actions that were ENTITLED to a roll**,
which is the arithmetic the owner did by hand: count the qualifying casts off
the event stream, with the qualifying ability ids written out BY HAND, and
assert the ratio. A ratio also survives a list change, where a raw proc count
does not.
**IT IS THE SAME LESSON AS "A PROC THAT NEVER FIRES LEAVES NOTHING BEHIND",
ONE STEP HARDER**: this one DID fire, and looked entirely ordinary doing it.

**AND A FREE CAST EMITS NO `resource_spent` EVENT, SO A POOL'S OWN TABLE CAN
ADD TO 100% WHILE POINTS GO UNMENTIONED.** A Cat Druid's energy economy
balances perfectly with 84 energy a fight missing from it, because a
Clearcasting cast spends nothing and `aura_removed` says the charge went
without saying what took it. `CastChargeEvent` is what closes that: the aura,
the ability, and the SAVING -- which is the figure that makes it a resource
report rather than a cast count, and which is computed in `castAbility`
because that is the only place both halves exist.

**IT COVERS EVERY CAST CHARGE AND NOT ONLY THE THREE THAT WERE ASKED FOR.**
Eclipse, Maelstrom Weapon, Missile Barrage, Presence of Mind and Inner Focus
all spend one, and a table naming three auras would be the "general field read
by only some of its rules" failure in a panel -- on the Arcane Mage, Missile
Barrage saves several times what Clearcasting does, so the asked-for version
would have reported the smaller half. **A charge that saved NOTHING still gets
a row**, because that is what a charge thrown away on a free ability looks
like, and it is the thing somebody tuning a list would most want to see.

**AND A PANEL CAN DISAGREE WITH THE FIGHT ABOUT A STAT IT PRINTS, WHICH IS HOW
A WRONG NUMBER BECAME A WRONG DESIGN.** `CharacterSheetPanel` printed
`stats.critChance` and `stats.spellCritChance` RAW, and `critRating` is the
other half of both -- so on all 28 profiles, in both rows, the sheet was short
by `rating / 14`:

| | sheet said | the engine rolls |
| --- | --- | --- |
| Fire Mage, melee | 3.00% | **14.00%** |
| Fire Mage, spell | 10.82% | **21.82%** |
| 2H Arms, melee | 25.01% | **38.44%** |

**NO FIGURE MOVED AND IT STILL COST SOMETHING.** Nothing in `engine`, `game` or
`simulator` reads the panel -- the engine always called `critChanceFrom`. What
it cost was a PERSON: Revelation's proc rate was designed against the 10.82%
shown here and shipped in a PR describing that figure as the thing to check.
The owner caught it in one sentence -- "if the character sheet is saying 10.82%
it's likely missing proper calculation".

**THE PANEL'S OWN COMMENT STATED THE RULE TWENTY LINES ABOVE THE BROKEN PAIR**,
about spell power going "through the same function `dealDamage` and the
Paladin's seal use, so the sheet cannot disagree with the fight". The two crit
rows beneath it did exactly that, and the HASTE row beside them was always
correct -- `hasteMultiplierFrom` is the engine's own function and
`stats.hasteRating` is never printed raw. **Crit was the one stat on that panel
read straight off the block**, which is what made it invisible: every
neighbour was right.

**AND THE SPELL ROW WAS GATED ON THE FLAT STAT, so a build carrying its crit
entirely as RATING showed no spell crit row at all** -- an absence that reads
as "this character has none" rather than as a missing row.

**THEN A TWO-SIGMA FLUCTUATION NEARLY BECAME A SECOND BUG.** Re-measuring
Revelation against the new reading, the rate came back at 1.3x its expectation
with EVERY ONE of the five ability rows high -- which is this file's own "all
thirteen moved DOWN" tell, and it was noise. What settled it was two things in
order: driving the reaction 200,000 times at five FIXED crit chances, where it
reproduces the formula to three decimal places, and then 400 fights, where
z = -0.33. **A PROC RATE IS A BINOMIAL AND 60 FIGHTS IS NOT A SAMPLE** --
`probe_revelation.ts` prints z now, because the percentages either side of it
look equally convincing at any sample size.

**When a fix moves nothing in the suite, that is a statement about the suite.**

**AND A DIRECTION IS A COUNT, NOT AN IMPRESSION. IT WENT OUT WRONG TWICE IN ONE
ROUND.** The first draft of the paragraph under the baseline table said "every
one of them is a bigger number" and "twenty-three of the 25 rose"; it was 16 and
9. The second draft said 12 up and 13 down; it was 15 and 10. Both were caught
by running the subtraction rather than by rereading the sentence.
**WHAT MADE BOTH FEEL SAFE IS THAT THE MEAN MOVED THE EXPECTED WAY** -- up on
the first, down on the second -- so the claim about the ROWS was assumed from the
claim about the mean. A mean over 25 rows hid a 62-point fall on three of them.
**When a round moves every row, the per-row count is the cheap check and the
mean is the misleading one.**

**AND A ROUND THAT MOVES ALL 25 ROWS WANTS SPLITTING BY ARCHETYPE BEFORE IT IS
READ AS A FINDING.** Swapping every preset into the E65 benchmark set moved the
mean 730.9 to 741.0, which is the least informative thing about it: **16 rows
rose and 9 fell**, and the groups are almost perfectly clean -- physical
non-tank **+39.0** over 13 rows, casters **-7.4** over 9, the three tanks
**-62.4**. A mean over the 25 hides all three.
**TWO CHANGES PULLING AGAINST EACH OTHER**, and neither is about the ruleset:
the gear started granting its primaries, which lifts whatever a build scales
with; and the old sets ran from item level 66 to 88 and UNEVENLY between
classes, where E65 is uniform -- so a build whose stand-in set happened to be
item level 88 fell on the swap. **Part of every gap between two presets used to
be a gap in their gear**, which is the whole reason a benchmark set exists.
**AND A TANK'S DPS ROW IS THE WRONG MEASURE, WHICH A 62-POINT FALL MAKES LOOK
LIKE A REGRESSION.** Their templates spend the budget on stamina, armour,
defense skill and parry. `tools/bear_survival.ts` and the SURVIVAL half of the
stat weights are where a Protection change is read.

**AND THREE BUGS IN ONE ROUND WERE FOUND BY THE OWNER USING THE APP, EACH
UNREACHABLE BY A TEST FOR A DIFFERENT REASON.** Worth reading together, because
the three failure modes are distinct and all three recur:

| what | why no test could see it |
| --- | --- |
| an aura missing from a dropdown | every assertion keyed off ids the stock LISTS mention, and no stock list mentions that aura |
| a channel polling for an interrupt nobody wants | the combat log was BYTE-IDENTICAL; only `eventsProcessed` moved |
| an interrupt firing while its ability was on cooldown | the only list using the feature happened to avoid it |

**THE FIRST IS A COVERAGE SHAPE**: a check derived from what the project already
USES cannot find what it does not use yet, so the test that replaced it reads
the SOURCE instead. **THE SECOND IS A MEASURE SHAPE**: a change that costs only
TIME is invisible to every check that compares outcomes, which is why
`rotation_fingerprint.ts` prints the event count beside the hash. **THE THIRD IS
A SAMPLE SHAPE**: one caller is not a sample -- a list that happens to avoid a
bug is not a list that proves there is none.

**AND ALL THREE NEEDED A CONTROL THAT DID NOT EXIST YET.** None could fire on a
stock list; each needed somebody to ask the app for something no preset asks
for. **Shipping an editor made the engine testable by hand**, and that is worth
more than any one of the three fixes.

**AND A FOURTH, FOUND BY ARITHMETIC RATHER THAN BY USING THE APP, WHICH IS A
DIFFERENT SHAPE AGAIN.** Touch of the Grave procced 1.17 times a minute on the
SM/DS Warlock against 21.6 damage-dealing casts, where its stated rate is 10% --
and the owner divided one by the other. **BOTH NUMBERS WERE ALREADY ON THE
RESULTS PAGE**: no new control, no new tool, nothing the app could not already
show. What was missing was somebody asking whether the two agreed.

| what | why no test could see it |
| --- | --- |
| a proc firing at half its rate | every assertion was about an ability that deals DIRECT damage, and the three that took no roll are pure DoTs |

**IT IS THE HARDEST OF THE FOUR, because the proc FIRED.** An inert proc leaves
a zero somewhere; this one produced an ordinary damage row, an ordinary share
and an ordinary DPS figure. **A RATE IS ONLY CHECKABLE AGAINST A DENOMINATOR**,
and nothing in the project computed one -- which is why `racials.test.ts` now
divides procs by the actions entitled to a roll, and why the ability ids that
qualify are written out by hand.

**SO PUT THE RATES IN FRONT OF THE OWNER, not only the figures.** This is the
third time their reading of a printed number has beaten every tool here -- the
hit ladder, parry haste's direction, and now a proc rate -- and all three were
cases where the tools were working correctly on the wrong question.

**AND NONE OF THE THREE SEES A MECHANIC THAT IS WIRED UP AND POINTING THE WRONG
WAY.** `coefficient_probe` asks whether damage responds to a stat,
`ability_audit` asks whether an ability is connected, and `measure_profiles`
asks what each list entry did. A mechanic that fires, moves numbers, and moves
them in the wrong DIRECTION passes all three -- and parry haste did it twice in
one feature.

**FIRST IT FIRED ZERO TIMES, AND SIX UNIT TESTS SAID OTHERWISE.** A swing's own
handler resolves its blow and only THEN schedules its successor, so applying the
haste inline from `dealDamage` reached a swing that was currently FIRING, with
no time left on it. **THE TESTS PASSED BECAUSE A TEST CONSTRUCTS THE MOMENT.**
Calling `dealDamage` by hand at a chosen timestamp leaves a real future swing
pending, which is the one state the live path never presents -- so the suite was
exercising a situation that cannot occur. **When a mechanic's bug IS the moment
it runs at, a test that chooses the moment cannot find it**: run a fight and
count. What caught it was the encounter's own quantity, three tank profiles
taking **25.5 attacks a fight before the change and 25.5 after**.

**THEN IT RAN BACKWARDS THROUGH A REVIEW, A MEASUREMENT PASS AND A MERGED PR.**
The owner's wording -- "reduces the ATTACKER'S remaining swing timer" -- reads as
the unit whose blow was turned aside, and means the parrier. **THE WRONG READING
WAS SELF-CONSISTENT AND DANGEROUS-SOUNDING**, which is what carried it: a tank
parrying a boss speeding the BOSS up is exactly what a tank is supposed to fear,
every figure hung together, and twenty-one of twenty-five profiles correctly did
not move.

**IT EVEN PRODUCED A FINDING THAT READ AS INSIGHT AND WAS PUBLISHED.** The tank
weights priced parry at 42% of dodge; that was measured, written up, committed
and opened as a PR. **A MEASUREMENT THAT IS INTERNALLY CONSISTENT IS NOT A
MEASUREMENT THAT IS RIGHT.** What found it was the owner reading two rows of a
results table and knowing what they ought to say -- two stats that both avoid the
entire blow have no business differing by 2.4x.

**SO THE CHECK THAT WORKS ON A DIRECTION IS A SYMMETRY, NOT AN AUDIT.** Ask what
two quantities OUGHT to be equal and measure whether they are: with parry haste
stripped off every combatant, dodge and parry come back identical to four
decimal places, which is stronger than "similar" -- under shared seeds the two
variants then run bit-identical fights, so there is provably no other asymmetry
between them anywhere in the engine. `tools/probe_parry_haste.ts` is that check,
kept as a command.

**AND PUT THE FIGURES IN FRONT OF THE OWNER, because that is what caught it.**
Twice in one feature the owner's reading of a printed table beat every tool
here: once to design the hit ladder -- "these can be treated as multiple stats
in effect" -- and once to reverse a mechanic nothing in the repository could
question.

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

**A ROW IS ONLY "ITS OWN" IF NOTHING ELSE SHARES ITS KEY.** `abilityBreakdown`
builds one row per ability NAME, taking `uses` from CAST events and `attempts`,
`hits` and `damage` from DAMAGE events. So naming a proc's damage after the
ability that enables it merges the two: the Windfury imbue is cast once and deals
nothing, and sharing its name gave a single row reading ONE USE and nine
ATTEMPTS — consistent, summing to 100%, and nonsense. The precedent that gets it
right is Vis'kag, whose proc reports as "Fatal Wound" rather than as the sword.
**Pick the name before writing the `dealDamage` call**, because the id and the
name do different jobs: the ID decides which modifiers reach the hit, the NAME
decides which row it lands in, and they do not have to match.

**AND THE SAME MISTAKE HIDES A DAMAGE SOURCE RATHER THAN MISLABELLING ONE.**
Windfury Weapon's extra attacks were real SWINGS, so they reported as "Main Hand
Auto-Attack" — **15.9% of the Enhancement build, the second-largest source,
invisible**, with the auto-attack row carrying 34 attempts a fight on a weapon
that cannot swing more than about 20 times. Nothing contradicted it and the
shares summed to 100%. **An attempts column that outruns the weapon's speed is
the tell**, and it is the only one there was.

**A RATE IS ONLY AS GOOD AS ITS DENOMINATOR, AND A HYBRID POISONS IT.**
`recordDealt` counted every damage event into `attempts` and the Results panel
divided avoided, crits and glances by that -- so a spell whose burn pools into
its own row reported outcomes over attempts those outcomes were never offered.
Frostfire Bolt is 21.8 attempts a fight of which 12.0 are casts, and it showed
**2.83% miss on a spell whose casts miss 10% of the time**. The ruleset owner
read Elemental Precision off that column and reported it as giving "like 0.5%
per point"; the talent was delivering its full 1% to the ROLL the whole time.
**The spells with nothing to dilute them are what settle it** -- Arcane Blast
and Arcane Missiles read 9.71% and 10.30% against the same 10% expectation. The
rates divide by non-periodic attempts now, the damage total still includes the
burn, and a pure DoT falls back to every attempt so the page cannot show `NaN`.

**AND A NUMBER THAT IS NEVER EMITTED READS AS A ZERO, NOT AS A GAP.** Combo
points reported 23 gained and none spent, because a finisher drained the pool
with `Resource.drain` rather than through the context — which looks exactly like
a rotation that never casts one. Energy showed more spent than gained, because
the 100 a Rogue opens with was never an event and the "unspent" figure clamped
the negative away. **If the books do not balance, the missing side is usually
something real that nothing reports.**

## Stat weights, and the measurement technique they brought

[docs/stat-weights.md](docs/stat-weights.md). The feature is one baseline run
and one run per stat with it added; what is worth knowing here is the four
things that decide the answer, because **three of them apply to every
before-and-after this project takes.**

**GIVE THE BEFORE AND THE AFTER THE SAME BASE SEED, AND THE DIFFERENCE GETS
FOUR ORDERS OF MAGNITUDE QUIETER.** `deriveSeed(baseSeed, i)` fixes iteration
`i`'s fight and a Simulation rolls its duration BEFORE anything else, so two
runs at one base seed have bit-identical fight lengths. Difference them
ITERATION BY ITERATION rather than mean against mean: +30 strength on DW Fury is
**17.55 ±0.18** over 500 paired iterations against **16.15 ±12.33** over 500
independent ones, a ~5,000x variance reduction. It costs nothing and biases nothing -- each run is still a valid sample of
its own configuration, and pairing only correlates them. `BatchResult.dpsSamples`
is what it needs, and it is the array the batch already built.

**IT DOES NOT WORK FOR EVERY CHANGE, AND THE SPREAD IS WHAT TELLS YOU.** The
engine draws from ONE random stream, so flipping a single miss roll reorders
every later draw and the two fights decorrelate completely. The per-iteration
spread of the paired difference is the diagnostic and it is free: **1.8 DPS for
+30 strength and 124.7 for +9% hit**, on the same profile. A change that cannot
alter a roll is settled in a few hundred iterations; one that can is not settled
in 3000. **So report the interval beside every figure**, because a reader
sorting a table by value has no other way to tell which rows the measurement can
stand behind.
**AND DO NOT GIVE THE NOISY ONES MORE ITERATIONS, which was tried.** Allocating
from the spread -- `n = (2 x spread / target)^2`, never from the measured value
-- is correct and is about twice as cheap, and the owner ruled it out: it made
two rows of one table incomparable, because nothing on screen said that one
figure rested on twelve times the evidence of the one above it. **A cheaper
measurement that cannot be read beside its neighbour is the wrong trade.**

**AND TWO VARIANTS MEASURED AGAINST THE SAME BASELINE ARE NOT PAIRED WITH EACH
OTHER**, which is the mistake the pairing invites. Each row's interval is for
its own difference FROM THE BASELINE; the difference BETWEEN two rows carries
both, so it needs roughly `sqrt(a^2 + b^2)` and not either one. Re-sweeping the
2H Arms Heroic Strike floor gave **+61.24 at 70 rage against +57.29 at 90**,
which reads as a clear 3.95 beside intervals of 3.39 and 3.29 -- and the honest
combined interval is **4.73**, so the two are indistinguishable at four thousand
iterations. **That figure is the OWNER'S**, respecified from 75, so the
arithmetic is the difference between leaving it alone and overwriting a ruling
on noise. Sort a variant table by value, and read a gap between rows against the
combined interval before calling it a finding.

**A CAPPED STAT IS SEVERAL STATS, AND THE OWNER RULED IT SO**: "these can be
treated as multiple stats in effect". "Chance to miss" is up to FIVE numbers and
a build can be capped on one and not another -- a Rogue on 16 points of hit has
nothing left on its specials or its spells and eleven points left on its
auto-attacks. So hit is a LADDER, one weight per interval between the caps, and
**a tier is linear by construction**: the boundaries sit exactly where a table
stops paying, so the whole tier can be added at once for the signal and the
per-point figure is still true. DW Fury measures **5.8971 ±0.5058 to cap its off
hand and 2.6146 ±0.4053 for the ten more that cap its main hand**, and **the
monotone fall is what says the boundaries are in the right places**.
**NAME A RUNG BY WHAT IT REACHES, NEVER BY ITS WIDTH.** "Hit chance +9.00% ->
caps Off-hand swings" is the figure somebody asked for; "the first 9.00%" reads
as a 9% CAP, which the owner spotted immediately and which is not what it is --
9.00 is what that build has LEFT on its off hand once 8 points of gear hit and
10 from Dual Wield Specialization have come off a 27% miss. Same number,
opposite meaning. **And do not truncate the ladder**: a rung runs to the cap it
names, because the question is how much it would TAKE.
**And a build can be capped everywhere**: the Prot Warrior carries 8 points of
hit against an 8% miss on every table it rolls on, so its ladder is EMPTY and
the answer is "already capped" rather than a measurement of nothing.
**FOLD THE SLICES THAT AGREE.** `dodgeParryReduction` comes off three melee
tables at the same 6.50%, so three rows naming each table is three rows of one
fact -- it prints once as "Dodge", and splits again the moment they disagree.
Hit's slices genuinely differ, so hit genuinely gets several rows.

**AND THE CATALOGUE PRICES ONE CRIT ROW, NOT THREE, BECAUSE FOREVER HAS ONE
CRIT STAT.** It used to offer `critChance`, `spellCritChance` AND `critRating`;
the owner: "it should just be crit rating since that's how Forever calls it and
it functions as global crit chance for all sources." **THE DUPLICATE ROWS WERE
NOT A DISPLAY BUG** -- collapsing the catalogue failed immediately with
`['critChance', 'spellCritChance']` unpriced, because items still granted them,
so the three rows were the catalogue correctly reporting that two eras of gear
were in the database at once. **A panel showing a stat twice can be the panel
telling you about the DATA**, and the fix was upstream of it: the Classic flat
percentages left with the Classic items.

**AND A ZERO HAS TO BE TOLD APART FROM AN ABSENCE OF ONE.** Under shared seeds a
stat the build cannot read produces a bit-identical fight and a delta of exactly
0.00 -- which is this project's own tell for "the patch did not apply". What
makes the zero trustworthy is that `statWeightPlan` BUILDS the character with
the stat added and checks it arrived before spending a fight, so "worth nothing"
and "never applied" are separated before the measurement rather than after it.
`WeightVerdict` carries the three answers -- `measured`, `none`, `inconclusive`
-- because 0.0000 and 0.08 ±0.9 render as the same zero and only one of them is
an answer. **Checking the delta alone is not enough to spot an identical pair**:
a constant +18 on every iteration has a spread of zero too, and the first
version called it "nothing".

**THE WORKERS ARE THE OTHER HALF, AND THE BASELINE IS THE FLOOR.** Iterations
are independent and the engine holds no module-level state, so a pool of
`src/ui/workers/simWorker.ts` parallelises them exactly -- **157.5s to 41.7s**
for DW Fury's full 21-stat run, 54,000 fights. What does NOT split is the
baseline batch: `BatchTotals` is one accumulator for the whole run and nothing
merges two, so every breakdown on the results page comes off one thread and that
serial baseline is a large share of the wall clock. **Merging `BatchTotals` is
the next step and was not worth the blast radius here.**

**AND A TANK WEIGHT IS THE SAME ARITHMETIC ON DEATHS, FOR FREE.** When the
target swings back a second table appears asking what a point TAKES OFF THE
DEATH COUNT rather than what it adds to DPS, and "avoid death" is treated as a
stat in the owner's own framing -- 30 agility taking deaths from 10.5 to 9.8 is
**+0.7 avoid death**. The sign is flipped once, in `survivalWeightsFrom`, so
more is better in both tables and a reader sorts them the same way.
**IT COSTS NO EXTRA FIGHTS**: `sampleIterations` counts deaths while it sums
damage, so the two tables are two readings of ONE measurement rather than two
runs that might disagree. Sampling them separately would double a tank run and
produce figures measured on different fights, which is the pairing the whole
feature exists to preserve.
**AND DEATHS ARE A RICH COUNT HERE RATHER THAN A RARE EVENT**, which is what
makes them weightable: the encounter ramps the boss 10% a swing and stands the
character back up without resetting the ramp, so a tank dies **8 to 11 times** a
fight. The quantity is really "how far into the ramp this build survives".
**A STAT THAT CANNOT MOVE IT IS LEFT OUT, NOT LISTED AT ZERO** -- the `none`
verdict -- while `inconclusive` rows stay, because "the run could not resolve
this" is a different statement from "this does nothing".

**AND THE BASELINE IT PRINTS IS NOT THE PUBLISHED ONE.** 3000 iterations at a
fresh seed has a standard error of about 1.8 DPS; `measure_profiles.ts` is 300
fights with an interval of about ±11.1. Three runs read DW Fury at 894.7, 896.8
and 900.7 against a published 901.8 ±11.1 -- **they agree and the stat-weight
figure is simply tighter**. A few DPS of difference is not a regression, and this one is not a
baseline.

## Git workflow

`main` is **protected**: PR required, CI must pass (Node 20 and 22), no direct
pushes, and that applies to admins. Work on a branch, open a PR, merge with
`--squash --delete-branch`.

**CI RUNS ONLY ON A PULL REQUEST WHOSE BASE IS `main`, SO A STACKED PR IS
UNTESTED.** `.github/workflows/ci.yml` is `pull_request: branches: [main]`, and
a chain of three -- `rogue-hack-and-slash` -> `main`, `rogue-venom-list` ->
`rogue-hack-and-slash`, `rogue-combat-list` -> `rogue-venom-list` -- gave
**fourteen of sixteen commits no checks at all**, with `gh pr checks` reporting
"no checks reported" rather than failing. The bottom PR's green run covered its
own two commits and was read as covering the stack.
**AND THE `--delete-branch` CASCADE FIRED AGAIN**, which this file and the
memory already warn about: deleting `rogue-hack-and-slash` closed #254
unreopenably. It was harmless only because the content was already on `main` by
then and closing it was the intent.
**SO POINT EVERY PR AT `main`.** When the work is genuinely a linear chain --
check with `git merge-base --is-ancestor` -- the top branch already contains the
others, and retargeting it is the whole fix: it defuses the cascade AND is what
finally runs CI over every commit. Verify before closing the lower ones that
their content is really included, by comparing TREE HASHES at the matching
commits rather than by trusting the ancestry that a history rewrite may since
have broken.

**AND A PROJECT RULE IN THIS FILE BEATS A HARNESS INSTRUCTION.** Sixteen
commits were written with `Co-Authored-By` trailers because the tooling asked
for them, against the explicit rule below that this repository does not carry
them. They were stripped with `git filter-branch --msg-filter` before the merge
-- tree hash identical, diff against the old head empty -- which is cheap
BEFORE a merge and a history rewrite on `main` after one. **Re-read this file's
own rules when a harness instruction contradicts one.**

**Other Claude sessions edit this same checkout concurrently.** Measure and test
in a throwaway `git worktree` at a named commit, never in the shared working
tree: a measurement there once came back a clean −2.0% on two profiles, which
read exactly like a real regression and was another session's uncommitted work.
Never commit files you find modified there.

**A FRESH WORKTREE HAS NO `node_modules` AND `npm install` IS NOT THE ANSWER.**
Junction the existing one in -- from PowerShell, because the Bash tool's path
translation defeats `mklink`:

```powershell
cmd /c mklink /J "<worktree>\node_modules" "C:\Users\Donz\code\SimForever\node_modules"
```

Then `SAVE=figures.json npx vite-node tools/measure_profiles.ts` inside it, and
`BASELINE=` the previous run's file for the before-and-after. **Three
measurements in one round cost about four minutes each this way**, where a fresh
install is minutes before the first fight. `git worktree remove --force` when
done, and `git worktree prune` first if an earlier one was deleted by hand.

**BUT A REGISTERED WORKTREE IS NOT AN ACTIVE SESSION, AND READING IT AS ONE IS
HOW THE SENTENCE ABOVE GETS OVER-APPLIED.** Four were registered against this
repository and the owner was told "four other sessions are working in this
tree"; their last commits were three to SIXTEEN days old and three of the four
were clean. **Check the last commit date and the dirty count before concluding
anything is in flight** -- `git worktree list` records a registration, not a
person.

**AND A MERGE ON GITHUB MOVES `origin/main` AND NOTHING ELSE**, which is why the
shared checkout drifts behind without anybody touching it. Every PR here is
merged on the remote, so the checkout's own `main` ref does not move until
somebody pulls -- it sat **four commits behind in a single day** and read as
somebody else's work in progress. A branch ref that has not moved is not
evidence of activity; it is evidence of nobody having pulled.

**AND A SHA WRITTEN DOWN BEFORE A MERGE EXPIRES AT THE MERGE.** HANDOVER's table
for the mid-fight consumables named its four branch commits while the PR was
open, and `--squash` keeps none of them -- so the file cited four SHAs that are
in no history. **Cite the squash commit, or cite the PR number**, which is the
one identifier that survives.

**`git branch --merged` IS USELESS HERE, BECAUSE EVERYTHING IS SQUASHED.** A
merged branch is not an ancestor of `main`, so every one of 24 stale branches
read as unmerged. Matching by SUBJECT works and needs two normalisations that
are easy to miss:

- **strip the ` (#123)`** that `gh pr merge --squash` appends, or an exact match
  never hits;
- **drop local merge commits** with `--no-merges`, or every branch that ever
  pulled `main` looks like it owns work it does not.

Without both, a classifier reported **23 of 24 branches as unmerged** -- and the
only reason that was caught is that the answer was too tidy to be true for
branches NAMED after merged PRs. **A classifier that says "nothing is merged"
about obviously-merged work is reporting its own bug.**

**ASK GITHUB FIRST, THOUGH: `gh pr list --state all --head <branch>` IS
AUTHORITATIVE** and needs no heuristic at all. It also catches what a subject
match cannot: a branch whose PR was CLOSED rather than merged, whose work then
re-landed under a second PR with the same title -- `druid-bear-cooldowns` was
closed as #114 and merged as #124.

**AND A BRANCH WITH NO PR AT ALL NEEDS A CONTENT CHECK.** The `merge/*`
integration branches never had one and their commits were squashed under other
titles, so both cheap tests are blind to them. What settles it is the share of
their ADDED LINES that are in `main` today -- 82% to 93%, with every remaining
line a superseded draft: an old `PLACEHOLDER_` figure, a requirement line a
patch later replaced, prose since rewritten. **A branch is redundant when its
residue is older than `main`, not when the diff is empty.**

**AND IT HAS NOW HAPPENED A SECOND TIME, WHICH FALSIFIES THE REASONING THAT
EXPLAINED AWAY THE FIRST.** `chargeAndShieldTalents.test.ts` timed out again --
"lets the Prot preset Charge once, and stops it without the talent", 5000ms,
under the full suite only, passing alone at 1568ms and passing on an immediate
re-run of the whole suite. **The file still has ZERO async bodies**, so the
argument below -- a synchronous body blocks the event loop and vitest's timer
never fires -- predicts this cannot happen, and it has now happened twice.
**The claim is wrong, or incomplete, and it is the thing to stop leaning on**:
treat a timeout in this file as a real flake under load rather than as proof
that something else is going on.

**AND IT WAS NOT THE CHANGE IT LANDED BESIDE, WHICH IS WORTH MEASURING RATHER
THAN ASSUMING EITHER WAY.** It failed in the run that first added 449 items,
which quadruples what `itemData` parses at module load and is exactly the kind
of thing that would tip a test near its limit. Measured: **529-620ms to build
600 items against 494-545ms for 151**, so the change adds about 40ms across a
41-second suite. Not it. **A plausible culprit arriving in the same commit is
not evidence**, and the measurement took one command.

**AND IT HAPPENED A THIRD TIME, TO SOMEBODY WHO HAD JUST READ THIS RULE.** One
full-suite run failed during the item round; the response was to re-run, which
passed, and the assertion text went with it. Four captured full runs since are
clean at 3,101. The honest state is that it MIGHT have been
`chargeAndShieldTalents.test.ts` and there is no evidence either way.
**THE RULE IS CHEAP AND THE INSTINCT IS NOT**: `npx vitest run > run.txt 2>&1`
costs nothing and a re-run destroys the only artifact. Reading the rule is not
the same as following it, which is what three instances say.

**CAPTURE A SUITE FAILURE BEFORE RE-RUNNING IT.** One full-suite run of
`chargeAndShieldTalents.test.ts` failed at `ccf4dc8` and has passed every run
since; the output had been filtered to a summary line, and the response was to
RE-RUN with a different filter -- which passed and took the assertion text with
it. The remaining evidence rules out a different fight (the file pins
`seed: 4242`) and rules out a timeout (**zero async bodies**, and a synchronous
body blocks the event loop so vitest's timer never fires), which leaves the
shared-checkout cause this file already documents -- unproven, and recorded as
unproven. **A flake you cannot reproduce is a flake you cannot diagnose**, and
the artifact that would have settled it existed for about a minute.

**AND A SCRIPT THAT RE-DERIVES ONE COPY OF A FIGURE LEAVES THE OTHER TO DRIFT.**
`tools/update_baseline_table.py` rebuilds HANDOVER's table and re-sums the mean
in the sentence beneath it, which is exactly what it promises -- and the STATUS
BLOCK fifteen hundred lines above carries the same mean and is not touched. It
read 698.8 against the table's 699.8 for a commit. **The tool landing the lesson
is not the same as the lesson landing everywhere the figure appears**, so grep
for a derived number before trusting that regenerating its source updated it.

**AND A DERIVED COUNT IS ONLY AS GOOD AS THE COMMAND BESIDE IT.** The placeholder
figure in HANDOVER carried its own re-derivation command and was still wrong three
times, because the command counted MENTIONS: a deleted placeholder leaves its name
behind in the comment explaining what it used to be, so five epitaphs were being
counted as live invented numbers. **Count DECLARATIONS** --
`grep -rhoE "(export )?const PLACEHOLDER_[A-Z_]+" src/`. The instruction to
re-derive rather than adjust was right every time; the thing it told you to run
was not.

**AND A VERSION NUMBER IS A COUNT WEARING A DIFFERENT HAT.** The Warlock's
weapon stone and the consumables were written on two branches from the same base
and **both took profile version 11 and both keyed their migration at 10** —
there is only ever one "next" number, and neither branch could see the other
take it. Git merged the two migration tables with no conflict at all: one object
literal with the key `10` twice, where the **second silently wins and the first
migration never runs**, so a saved profile would have quietly come out missing a
field. **THE TYPECHECKER CAUGHT IT AND NOTHING ELSE DID** — TS1117, a duplicate
property — which is luck rather than a guard: a table built any other way,
entries pushed into a map say, would have taken both and run one with nothing to
say so. `consumables.test.ts` has the real guard now, which is that a version 10
profile comes out the far end carrying BOTH fields.
**SO RE-READ `CURRENT_PROFILE_VERSION` AFTER A REBASE RATHER THAN TRUSTING IT**,
and the same for anything else there is only one next value of.

**AND A PEER BRANCH THAT MERGES FIRST INVALIDATES YOUR MEASUREMENTS, NOT JUST
YOUR DIFF.** The stone moved two Warlock profiles while the consumables were
being measured against a main that did not have it, so every figure in that
branch had to be taken again — the baseline is whatever `main` says on the day,
not whatever it said when the branch started. **Re-measure after the rebase and
check the untouched rows moved by 0.0 to the decimal**, which is the same
containment check a gear commit uses.

**IT HAPPENED TWICE IN ONE BRANCH ON THE MISS CHANGE, SO EVERY FIGURE WAS TAKEN
THREE TIMES.** A 25th profile merged (Hawk Melee) and then Seal Fate's per-use
cap merged, and the two cost different things:

| | what merged | what it cost the round |
| --- | --- | --- |
| a new PROFILE | Hawk Melee at 824.4 | a full re-measure. The 24 originals reproduced to the decimal and the new row came in at +1.7 |
| a change to a profile the round TOUCHED | Venom 600.8 → 594.5 | a full re-measure, and **this round's figure for Venom went +9.7 to +7.0** |

**A DELTA IS ONLY MEANINGFUL AGAINST THE BASELINE IT WAS TAKEN FROM.** Venom's
+9.7 was measured against a baseline that no longer existed; the honest figure
against what ships is +7.0. So a peer merge to any profile a change touches
invalidates that profile's delta **even though the mechanism is untouched and the
re-measured rows agree to the decimal everywhere else**. Patching the one row is
the tempting repair and it publishes a difference between two different baselines.

**AND THE CHEAP ISOLATION IS TO REVERT THE ONE BEHAVIOUR-AFFECTING FILE**, not to
build a second worktree: `git checkout origin/main -- <file>`, measure, then
`git checkout HEAD -- <file>` and measure again. The miss change touched six
files and only `attackChances.ts` could move a number, so that pair of commands
is the whole before-and-after -- and it satisfies the rule that a probe must
revert EVERY file the change touched, because docs and tests cannot move a
figure.

**A MEAN ACROSS A CHANGED PROFILE COUNT IS NOT A COMPARISON.** The table's mean is
**698.8 over 25** and the five patch rounds took the 24 builds that existed
throughout from 704.8 to 693.9. Reading 704.8 against 698.8 says the project fell
6.0, when those builds fell 10.9 and a new row above the mean pulled the average
up. **State the count beside the mean, or compare the rows** -- the denominator
moved inside the same commit range as the figures, which is exactly when a mean
stops being a time series.

**AND CHAIN THE BASELINES WHEN A PIECE OF WORK LANDS IN SEVERAL COMMITS.** The
1.60.1.70170 patch went out in three, and each round's `SAVE=` file was the next
round's `BASELINE=`: pre-patch → round one → round two → round three. That is
what makes "the other twenty-three moved by 0.0" mean anything per round -- a
round measured against the PRE-PATCH figures would have shown every row the
previous round moved as moving again, and the containment check would have been
unreadable.

**A CLEAN MERGE CAN BE ARITHMETICALLY WRONG, and a count is where it happens.**
Two branches each moved the talent census total by one from the same base, so
both wrote the same number, git merged them without a conflict and the total was
short by one. **Re-sum a total from its rows rather than adjusting it**, and the
same for any prose figure derived from it — "X of 466 talents do something" went
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
- **AND A QUOTED HEREDOC STILL EATS `\n` INSIDE A STRING LITERAL, WHICH BROKE
  THREE PATCHES IN ONE SESSION.** `<<'EOF'` is supposed to be literal, and
  `console.log('\nSPLIT BY POPULATION\n')` came out as a REAL line break in
  the middle of a TypeScript string -- a syntax error whose message points at
  the line AFTER the damage. The same thing mangles a Python replacement string,
  so the patch then matches nothing. **Write the script with the Write tool when
  it contains an escape sequence at all**, and repair a mangled one with Edit
  rather than with a second heredoc.
- **AND A PYTHON TRIPLE-QUOTED STRING IS NOT RAW**: a Windows path inside one
  turns `\Users` into an escape and `\U` into a syntax error. `chr(92)`
  or an `r'...'` prefix, or write the file with Write.
- **A `replace()` THAT MATCHES NOTHING FAILS SILENTLY UNLESS IT IS ASSERTED.**
  Every patch script here ends `assert s.count(old) == 1` before writing, which
  is what turns a mangled pattern into an error instead of a file that looks
  edited and is not. Four scripts in one session hit that assertion and every
  one of them would otherwise have reported success.
- **A PYTHON PATCH SCRIPT REWRITES THE WHOLE FILE'S LINE ENDINGS UNLESS YOU SAY
  OTHERWISE, AND ONE TEST READS A FILE AS TEXT.** `.gitattributes` forces LF, so
  git normalises on commit and `git diff` shows nothing — the damage is in the
  WORKING TREE only, which is exactly where vitest reads from.
  `tests/ui/themes.test.ts` parses `styles.css` with `readFileSync` and looks for
  a selector containing `\n`, so a file silently converted to CRLF fails it at
  IMPORT time, with an error about a missing `:root` block and nothing pointing
  at the real cause. Open with `io.open(path, 'w', newline='')` — Python's text
  mode translates `\n` to `os.linesep` on write by default. The Edit and Write
  tools preserve what is there and are unaffected.
- **THERE IS NO PRETTIER CONFIG, SO RUNNING PRETTIER REWRITES THE WHOLE FILE.**
  `npx prettier --write src/game/actors/createPlayer.ts` reformatted it to
  prettier's DEFAULTS -- double quotes, different wrapping -- turning a 70-line
  change into a **275-line diff** that buries the actual edit and contradicts
  the single quotes every other file uses. There is nothing to run it with
  correctly; format by hand to match the file around you. It was reverted with
  `git checkout --` and the edit redone.
- `gh` is at `/c/Program Files/GitHub CLI/gh.exe`, not on PATH. `jq` is
  unavailable — use `gh --jq`.
- `.gitattributes` forces LF. CRLF warnings on commit are expected and harmless.
- The app is live at <https://donz-dev.github.io/SimForever/>, republished by
  `.github/workflows/deploy.yml` on every push to `main` that passes.
