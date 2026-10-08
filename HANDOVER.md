**THE WARLOCK HAS A WEAPON STONE, AND BOTH PRESETS NOW CARRY ONE.**
`profile.warlockStone` -- a Firestone or a Spellstone, selected in the Gear panel
beside a Rogue's poisons, and **profile format v11**. The owner's choice:
**SM/DS takes the Spellstone (+19.6 REAL) and Firelock the Firestone (+20.8
REAL)**, and the other twenty-two profiles are identical to the decimal.

| Profile | none | Firestone | Spellstone |
| --- | --- | --- | --- |
| Firelock | 568.3 | **589.1, +20.8 REAL** | 575.0, +6.7 noise |
| SM/DS | 496.9 | 504.4, +7.6 REAL | **516.8, +19.9 REAL** |

**A FIRESTONE IS NOT A "FIRE STONE"** -- only its +21 is school-scoped, while its
2% spell crit is whole-character, which is why it is the better stone for a Fire
build and still worth +7.6 to a pure Shadow one.

**THE DEFAULT IS STILL `none` AND NO SAVED PROFILE MOVED.** The presets state the
owner's choice; `createDefaultProfile()` states no choice at all, which is the
opposite of version 10's poison decision and for the stated reason -- the owner
supplied the poison pairing, and a saved Warlock has simply never been asked.

**ONE FIGURE IN AN EARLIER VERSION OF THIS ENTRY WAS WRONG**, and the tell was
visible: SM/DS's two stones were reported at an IDENTICAL 484.6, which two
different stat bundles do not do across thirty batches. See
[docs/handoff/warlock.md](docs/handoff/warlock.md).

# Handover

**Status only.** Rules and conventions are in [CLAUDE.md](CLAUDE.md); how a class
gets built is [docs/class-implementation.md](docs/class-implementation.md).

## Where the project is

All nine classes and all 24 profiles are implemented, every number traced to a
source rather than invented, and **all 24 priority lists are the ruleset owner's
own** -- specified entry by entry and measured after. **2,662 tests**, CI green
on Node 20 and 22. Profile format **v12**. Live at
<https://donz-dev.github.io/SimForever/>, republished by
`.github/workflows/deploy.yml` on every push to `main` that passes.

**THE "23" IN THAT SENTENCE WAS STALE FOR MONTHS, AND THIS FILE ALREADY SAID
SO** -- the mean's own entry records that "Hemo made it twenty-four and the
sentence kept saying twenty-three". It was corrected one place and not the
other, which is the drift this document warns about one level down and then
demonstrated at the top. **Re-count rather than re-reading the sentence.**

### The state in one table

| | |
| --- | --- |
| **Talents** | 258 fully, 36 partly, 110 ruled out, **64 a live gap** -- from 132 before the class dives |
| **Abilities** | 114 declared against 478 captured |
| **Profiles** | 24, all measured, **mean 704.8** -- the armour enchants are +27.0 of it and the consumables +105.9 |
| **Scope rulings** | 7 members, all the owner's |
| **Placeholders** | **10 declared** -- see the milestone table, and count DECLARATIONS |
| **Tests** | 2,662 on Node 20 and 22 |

**FOUR CLASSES ARE ESSENTIALLY DONE** -- Warrior 0 live gaps, Paladin 2, Druid 2,
Rogue 3 -- and the remaining 64 sit mostly in the Warlock (20), Priest (12) and
Mage (11). **The Warlock's 20 overstates its own work**: thirteen of them are one
build cause, Demonic Sacrifice killing the demon, so its real queue is about 11.

### How it got here: the nine-class push

**NINE PARALLEL DEEP DIVES, ONE PER CLASS, EACH IN ITS OWN CONTEXT**, briefed from
[docs/handoff/](docs/handoff/) and merged one at a time with the census re-derived
after every merge. What each was worth is recorded per class below and in its own
brief. The headline is that the live-gap count halved and the mean rose about 80
DPS, and that **almost none of it was new engine capability** -- most of what the
dives closed were declarations that could have been written at any point, plus
owner rulings that arrived when asked for.

**AND THE MERGE ORDER COST MORE THAN ANY SINGLE DIVE.** Three capabilities were
built two and three times by contexts working in parallel, and the bill landed on
whichever branch merged last: the Rogue came back carrying seven divergent APIs
and had to be translated rather than merged. That is written up as a rule in
CLAUDE.md and in full in [docs/handoff/README.md](docs/handoff/README.md) --
**land the shared engine pieces first**.

### And then the Hunter moved twice more

**THE HUNTER IS THE ONE CLASS THAT KEPT MOVING AFTER ITS DIVE**, and the second
round was a CORRECTION rather than a gain:

| | |
| --- | --- |
| the dive | BM Hunter 405.8 to **731.8**, almost all of it two owner answers -- the pet's base DPS 50 to 150, and the hawk at 108 |
| the raid buffs | 731.8 to **788.1**, Trueshot Aura and the Grace of Air swap |
| the pet damage model (#150) and Summon Hawk (#151) | 788.1 down to **646.6** |
| Summon Hawk again (#153) | 646.6 down to **547.0** |

**SO THE 788 WAS NEVER A REAL FIGURE, AND NEITHER WAS THE 731.8 OR THE 646.6.** A
placeholder answered generously, measured, published, and then corrected twice as
the real model arrived -- which is the cycle those named constants exist to make
possible, and the reason a figure resting on one is published with its placeholder
named rather than quietly. BM Hunter fell from first to sixth across the two
corrections, and is **546.1** now.

**THIS PARAGRAPH WAS STALE WITHIN THE HOUR, WHICH IS THE POINT OF IT.** It was
written at 646.6 and #153 landed before it merged. **Re-derive every figure in this
file rather than reading it** -- `tools/class_audit.ts` for the census,
`tools/measure_profiles.ts` for the baseline, and the mean from the table's own
rows. A number written by hand into a document is a claim with a date on it, and
this one is the shortest-lived example the project has.

### Where the GUI stands

**IT HAS HAD ITS PASS.** Pick a profile from the rail, Run Simulation, and the
full results stack renders: DPS and distribution, a damage table with uses,
share, crit and avoidance per ability, buff and debuff uptime, a resource
timeline and a combat log. 2H Arms comes back at 602.23 against a published
603.3 and Seal Twist Ret at 635.78 against 630.9 -- the batch-versus-profile
difference, not a bug, and the check that no UI change reached past the
simulator.

**THE PASS WAS MOSTLY SUBTRACTION.** The owner's instruction was that the
interface carries no notes: eleven explanatory paragraphs, five per-entry reason
strings and all four "not simulated" lists came off, and the 23 preset cards --
each with a line of body text under it -- became a two-column rail of
class-coloured pills. Every configuration panel is collapsible and starts shut,
so the app opens on a character and a Run button.

**NO DATA WAS REMOVED AND NOTHING STOPPED BEING TRACKED.** Every `unmodelled`
entry still carries its reason and its `scope`, and `tools/class_audit.ts` still
derives the whole census from them. What went is one READER -- which is why the
`unmodelled` field's own documentation now says to keep writing them and names
the audit as the consumer. **The risk after a change like this is that the next
class quietly stops filling them in.**

**THREE BUGS NOBODY HAD FILED CAME OUT OF IT**, and the useful one is this: every
panel is `overflow: hidden`, so content wider than its column was CLIPPED rather
than scrollable -- the damage-taken table's last columns were unreachable **at
full desktop width**, not merely on a phone, and nothing looked broken because
the table simply stopped. The other two are a duplicate React key that prose had
been hiding and a media query that never applied.

**WHAT IS LEFT IS IMPORT AND LOAD**, two buttons wired to `() => undefined`, and
the unmounted `ProfilePanel.tsx` that holds the round-trip they need. Parked by
the owner rather than closed. See
[docs/handoff/gui.md](docs/handoff/gui.md), which is the record of the pass.

The profiles were specified by the ruleset owner as `talentsforever.com` build
URLs and every one decodes to exactly 51 points. Every profile is in its own
class's gear, from twelve sixtyupgrades sets the owner supplied — 151 items in
nine files. The item database is **frozen**.

### Gear customisation: enchants, then consumables

**TWO OWNER TABLES LANDED BACK TO BACK AND BETWEEN THEM MOVED EVERY PROFILE IN
THE PROJECT.** The armour enchants were +2.4 to +53.7 on a mean of **+27.0**;
the consumables were +40.0 to +249.3 on a mean of **+105.9**. Nothing recorded
before them is comparable with anything recorded after, which is the single most
important thing to know when reading an older figure in this file.

| | Enchants | Consumables |
| --- | --- | --- |
| shape | one per enchantable SLOT, ten slots | one per CATEGORY, twelve categories |
| source | 28 entries, no spell behind any | 12 rows, no item behind any |
| ids | simulator's own, from a 900,000 block | simulator's own, by name |
| preloaded | the owner's own per-profile table | **chosen here**, to a stated rule |
| worth | `tests/game/enchants.test.ts` | `tests/game/consumables.test.ts` |

**NEITHER IS SCRAPED AND NEITHER COULD BE.** The two WEAPON enchants that
predate both came out of Wowhead with a spell id, an icon and a tooltip; these
are an effect and a slot, so there is nothing to `--verify` and no tooltip to
store. Both are declared outright -- `game/items/foreverEnchants.ts` and
`game/buffs/consumables.ts` -- and both carry simulator-allocated ids that **may
not be reordered once a profile has been saved against them**.

**THE EXCLUSIVITY IS WHERE THE TWO DIFFER MOST, AND IT IS A DESIGN POINT RATHER
THAN A DETAIL.** A consumable selection is a map from CATEGORY to consumable, so
two flasks is not representable and the panel enforces nothing. The alternative
is in the repository and has already cost something: `RaidBuff.exclusiveWith` is
a selection rule the raid buff panel honours, and a TALENT reached the same aura
without passing through that panel, which is how a Moonkin read +6% crit.

**THREE EFFECTS TURNED OUT NOT TO BE STATS**, and each is worth knowing because
the stat was the obvious place to put it:

| | |
| --- | --- |
| "+1200 Hit Points" | `STAT_NAMES` has no `hitPoints`; health is derived from stamina and the owner states no conversion. It reaches the maximum as its own term -- **and lowers rage**, because `D x 10 / H` |
| the bow's "+2% Crit Chance" | `critChance` is every attack a character makes, and this one is RANGED only. `AttackTableModifiers` on the two ranged tables, so the pet never sees it either |
| "+2% Melee Crit Chance" | the same scope pointing the other way, on the two MELEE tables -- because `critChanceFrom` is one function and a bow reads it too |

**THE LAST TWO ARE THE SAME TABLE ON OPPOSITE SIDES, AND THE OWNER'S OWN PAIR OF
LABELS IS WHAT SETTLED THEM.** Their enchant table writes "+2% Crit Chance" on a
bow and their consumable table writes "+2% Melee Crit Chance", and asked which
the unqualified one meant they said melee and ranged. Two labels for one stat
would be one label.

**AND AN ENCHANT'S ARMOR IS NOT "ARMOR FROM ITEMS"**, by the owner's ruling, so
`armorFromItems` sums ITEM stats directly rather than going through
`statsFromEquipment`. Toughness and Thick Hide scale the plate and not what was
enchanted onto it. Worth nothing on the day it was written -- no enchant granted
armor before the cloak's 60 -- and wrong the day one does.

**THE CONSUMABLE ROWS ARE CHOSEN, NOT STATED, AND THAT IS THE FIRST THING TO
REPLACE.** The owner supplied the catalogue and no per-profile table, and asked
for a sensible row on each. They follow one written-down rule rather than taste
-- take every category the build can read, choose within a category by what it
scales with, leave empty only what is worth nothing -- and both halves of every
row are derived from something re-checkable: the conversion table decides
Blasted Lands, and the MEASURED damage school decides School Spell Power. Three
of those schools are not guessable from the class: the Moonkin is 71% arcane,
the Frostfire Mage **62% fire**, the Elemental Shaman 56% nature.

**THE CASTERS MOVED FOUR TIMES AS FAR AS THE MELEE BUILDS AND THE OWNER HAS
CONFIRMED THAT IS INTENDED** -- "casters *should* have moved more". A caster row
reaches 254 school-blind spell power plus 40 on its own school, where the
biggest single entry a melee build can take is 40 attack power. The table
re-sorted around it: four of the top six are casters where none was before, and
the Frostfire Mage took the top from Seal Twist Ret. **Recorded because it reads
like a bug** -- a change moving one archetype +250 and another +40 is the shape
somebody later "fixes".

**ONE RULING CAME BACK THE OPPOSITE WAY FROM THE PRECEDENT, WHICH IS THE
EPISODE WORTH KEEPING.** "+40 Attack Power" shipped as the melee pool alone,
because every ITEM line in the data reads those words that way and because the
owner's one ruling the other way -- Careful Aim -- is about a TALENT, and a
ruling covers what it says. The owner then ruled the consumable feeds BOTH
pools. **So an item's wording and a consumable's are now known to mean different
things, and neither settles the other.** Waiting was still right: it cost one
review, where guessing would have left two Hunter profiles carrying an elixir
worth nothing with nobody to notice.

**AND THE TWO CHANGES COLLIDED WITH A THIRD, CLEANLY AND WRONGLY.** The Warlock
stone merged between them, and it and the consumables were written from the same
base: **both took profile version 11 and both keyed their migration at 10**, and
git merged the two migration tables with no conflict at all -- one object
literal with the key `10` twice, where the second silently wins and the first
migration never runs. The TYPECHECKER caught it, not the suite and not the
merge. The consumables are v12 keyed at 11 now, and `consumables.test.ts`
carries a regression test that a version 10 profile comes out the far end with
BOTH fields. See **Git workflow** in CLAUDE.md.

**THE GEAR PANEL NEEDED NO CODE FOR THE ENCHANTS**, because it already built its
dropdown from `enchantsForSlot`; what it needed was CSS, since the enchant
column was sized when the only two names were "Crusader" and "Spell Power". The
consumables are a panel of their own, under the raid buffs, one dropdown per
category. `tools/enchant_report.ts` and `tools/consumable_report.ts` print all
24 rows of each in the shape of the owner's own spreadsheets.

### The Mage fine-tuning pass

**SEVEN ITEMS FROM THE RULESET OWNER, AND ONE OF THEM TURNED OUT TO BE A
REPORTING BUG RATHER THAN A SIMULATION ONE.** Frostfire **623.2 to 661.3,
+38.0, REAL**; Arcane and Fire inside their intervals; the other twenty-one
profiles identical to the decimal.

| | |
| --- | --- |
| **Frostfire Bolt counts as BOTH schools, +38.0** | ten talents treat it as Frost and Fire and SEVEN already did. The three that did not were the Frost-scoped ones: Piercing Ice and Ice Shards select by school, Frost Channeling by ability id. `DamageRequest.countsAsSchools` is the first two and a list entry is the third |
| **Ignite cannot crit and ROLLS OVER, +13.2 to Fire** | the same two exceptions Deep Wounds carries, and for the same reason -- it is a DoT applied BY a crit. Losing the crit costs less than the roll-over gains, because a Fire list re-applies it before it has delivered. Isolated: Fire reads 608.8 with the old shape against 622.0 with this one |
| **Evocation, in all three lists at 10% mana** | 8-second channel, haste-shortened, x16 out-of-combat mana regeneration. Fires 0.9 times a fight for Fire, 0.4 for Frostfire and **0.0 for Arcane**, which never drops that low -- the entry stays in all three because the owner asked for it |
| **Presence of Mind on the CHEAP Arcane Blast** | at exactly one stack and no Missile Barrage, which is the opposite of where a damage cooldown goes and is the point: each stack raises the cost 175% |
| **Scorch is gated on Improved Scorch** | without the talent nothing applies the debuff, so the condition is permanently true and Scorch becomes an unconditional entry with every list entry beneath it unreachable |
| **Elemental Precision was never broken** | reported as "like 0.5% per point". It delivers the full 1% to the roll, and **the miss COLUMN was diluted** -- see below |

**TWO BUGS FOUND BY BUILDING THESE, NEITHER IN THE MAGE.**

**THE MISS RATE WAS DIVIDED BY THE WRONG DENOMINATOR, FOR EVERY HYBRID IN THE
PROJECT.** `recordDealt` counted every damage event into `attempts`, so a spell
whose burn pools into its own row reported avoided, crit and glance over
attempts those outcomes were never offered: Frostfire Bolt is 21.8 attempts a
fight of which 12.0 are casts, and it showed **2.83% miss on a spell whose casts
miss 10%**. That is what the owner read Elemental Precision off. The two Arcane
spells, which have no burn, read 9.71% and 10.30% against the same 10%
expectation -- **the undiluted rows were right all along, which is what pins the
cause on the denominator rather than on the talent.** Fixed in
`BatchTotals.recordDealt`; the damage total still includes the burn, because a
burn is part of the spell.

**AND `resourceRegenMultiplier` REACHED ONE OF THE THREE REGENERATION RULES.**
Written for Adrenaline Rush and wired into energy only, so Evocation's
`{ mana: 16 }` compiled, applied, reported its uptime and measured a ratio of
exactly 1.0000. Mana and focus go through `regenMultiplierFor` now. **A general
field added for one caller is a silent no-op for the second one.**

### The regression baseline

**30 batches of 10**, preset raid buffs, reproduced by
`npx vite-node tools/measure_profiles.ts`. Comparable to **each other** and to
nothing else. **Measure with `runProfileBatch`, not `runProfile`** — the app runs
the former and the two are different fights even at one iteration.

**EIGHT WARLOCK RULINGS FROM THE OWNER, AND SM/DS GAINED 38.1 ON THEM.** 441.5
to **479.7, REAL**, with Firelock at -0.4 and the other twenty-two identical to
the decimal. Each isolated by reverting it alone over thirty batches of ten:

| | |
| --- | --- |
| **+23.6** | **Bane of Agony's coefficient is 160% of spell power across the whole effect**, against the sheet's 13.3% a tick -- 1.064 in total over the eight ticks it then had. The owner's worked example is `552 + 500 * 1.6 = 1352`, and the twelve ticks reproduce it exactly. **The second row in `coefficients.ts` that is not from the sheet, and the first that CONTRADICTS it** |
| **+18.6** | **Amplify Curse**, one talent point moved out of Suppression, cast once before the first Bane and **off the global cooldown** -- which is what makes it free |
| **+6.6** | **Wrack counts as periodic damage for Malediction**, by ruling. Its ticks are CAST ticks and carry no `periodic` flag, so this was a question the data could not answer |
| **+1.7** | **a Nightfall proc is spent by the NEXT action.** Inside the interval on DPS, and the behaviour is not in doubt: Shadow Trance uptime falls from 0.082 to 0.049, so the proc is held 40% less time |
| **+0.4** | **Curse of the Elements counts for Soul Siphon.** Noise, and correctly so -- the three bleeds already reach the 36% cap, so the fourth counted effect is redundant until one drops |
| **-4.3** | **Siphon Life cannot crit.** The only damage-over-time effect here that cannot; every other one can, which is a Forever rule |
| **-7.6** | **the RAMP**, against a flat distribution of the same total. Back-loading throws away the big late ticks every time the Bane is re-applied, and it is the owner's data either way |

**AND A CHANNEL CAN NOW BE CANCELLED MID-CAST**, which is the eighth ruling and
a new engine capability: `Ability.interruptibleChannel` plus
`PriorityEntry.interruptsChannel`, and **both halves have to agree** before
anything is cut short. Worth **+3.2** on its own, and it REPLACED Wrack's
six-second gate rather than adding to it -- the gate asked "can I afford to stop
acting for six seconds" and answered conservatively, because a channel used to be
a commitment.

**IT IS NOT "EVERY ENTRY ABOVE THE CHANNEL", WHICH WAS THE TEMPTING SHORTCUT.**
The owner named three cases -- a Shadow Bolt because Nightfall procced, a
Corruption or a Bane of Agony because it fell off -- and Siphon Life and Life Tap
sit above Wrack in that same list and are NOT among them. A positional rule would
have been right about three entries and wrong about two. Measured off the
telemetry stream: 4.6 interrupts a fight, caused by **exactly those three ids and
nothing else**.

**THE CONTAINMENT CHECK IS THE INTERESTING ONE HERE**, because the change touches
`casting.ts`, `Simulation.ts` and `Combatant.ts` on every cast in the project:
**all 23 other profiles came back identical to the decimal.**

**THE RAMP IS CLASSIC'S SHAPE AT A DIFFERENT RESOLUTION**, which the old caveat
guessed and had no authority to assert: 1/24 : 1/12 : 1/8 is 1 : 2 : 3, and the
flat share over twelve ticks is 1/12 -- so the bands are 50%, 100% and 150% of
the average exactly as Classic's are. The guess was right and is now sourced.

**AND SIPHON LIFE IS WORTH CASTING, ASKED TWICE AND ANSWERED TWICE: +15.7** on
the re-measure after the interrupt rule landed, against +13.6 before it. **The
FIRST answer was wrong by a factor of two**, because Wrack's gate named Siphon
Life -- so removing Siphon Life took Wrack to zero casts and the figure was the
loss of both. **Removing the gate removed the coupling**, which is a better
outcome than remembering to work around it. See
[docs/handoff/warlock.md](docs/handoff/warlock.md).

**THE WARLOCK HAS A WEAPON STONE NOW, AND NO FIGURE IN THE TABLE MOVED.**
`profile.warlockStone` -- a Firestone or a Spellstone, selected in the Gear panel
beside a Rogue's poisons, and **profile format v11**. It defaults to `none` and
both presets keep it, which is the OPPOSITE of v10's poison decision and for a
stated reason: the owner supplied the poison pairing, and has not said which
stone a Warlock carries. Choosing one here would invent a build decision and move
a published baseline.

**WHAT THEY ARE WORTH, 30 batches of 10 on their own seeds:** Firelock takes
**+20.0 REAL** from a Firestone against +2.4 noise from a Spellstone; SM/DS takes
**+7.3 REAL from either**, a dead heat by two different routes. **A Firestone is
not a "Fire stone"** -- only its +21 is school-scoped, while its 2% spell crit is
whole-character, which is what makes it the better stone for a Fire build and an
equal one for a Shadow build. See
[docs/handoff/warlock.md](docs/handoff/warlock.md).

**THE NEWEST MOVE IS THAT A SEAL CRITS**, on the owner's ruling: Seal of
Righteousness, Seal of Fury and Seal of Command all roll against the Paladin's
MELEE crit chance. Three profiles moved and the other twenty are **+0.0 to the
decimal**, which is a stronger containment check than usual because the change
CONSUMES A RANDOM NUMBER per seal hit -- any leak outside the class would have
shifted a seeded stream and shown up as a difference rather than as a zero.

| | |
| --- | --- |
| **Seal Twist Ret 668.4 to 709.0, +40.6, REAL** | and it goes to the top of the table |
| **Shockadin 543.6 to 560.6, +17.0, REAL** | |
| Prot Pally 287.8 to **293.0**, +5.1 | **noise under the conservative rule**, which judges a gap against this run's interval DOUBLED. 5.1 against 5.8, so it is called noise before it is called a change |
| The other twenty | **+0.0** |

**THE TANK GAINS LEAST AND THAT IS THE BUILD RATHER THAN THE RULING.** Protection
carries Seal of Fury, a flat 35 Holy plus 10% of a spell power it barely has, and
it does not take Conviction -- so it is the least seal damage at the lowest crit
chance. Retribution gains most because Seal of Command and its Echo are a quarter
of its damage before anything else is counted.

**TWO NUMBERS COULD EACH HAVE GONE THE OTHER WAY AND ONE OF THEM IS NOT OBVIOUS.**
A seal deals HOLY damage, so `spellCritChance` and a spell's 1.5x are the
plausible answers; the owner named the MELEE chance, and the multiplier follows
the TABLE rather than the school, so a seal crit is **2x**. Reading the school
instead would have made every seal crit worth half what it should be -- a smaller
number, a plausible one, and no error. `tests/game/sealCrits.test.ts` pins both by
the SET of amounts a seal deals rather than by an average.

**AND THE ECHO CRITS, WHICH IS THE SAME RULING RATHER THAN AN EXTENSION OF IT.**
Twist of Light applies "the replaced Seal's effects", so an echoed seal is the
seal; it goes through `sealHit` and got the field for free. Seal of the Crusader
is untouched because it has no per-swing damage to crit.

**THE MEAN WAS 528.2 AT THAT POINT**, from 527.0, re-summed from the table's own
rows.

---

**AND THEN THE CASTER WEAPONS WERE BUFFED: +64 SPELL POWER ON FOUR OF THEM.**
The ruleset owner's, given directly, and the **first item numbers in this project
that are Forever's rather than Classic's** -- the Immovable Object aside. Staff
of Dominance 47 to 111, Sorcerous Dagger 36 to 100, Azuresong Mageblade 44 to
108, and Anathema 75 to 139 on SHADOW alone.

**IT IS ENCODED AS A DELTA AND NOT AS FOUR TOTALS.** The owner's own figures for
two of them did not match this data -- Staff of Dominance quoted at 60 against
the scrape's 47, Azuresong at 40 against 44 -- and asked which to use, the owner
chose the +64. So `FOREVER_SPELL_POWER_BUFFS` stores bonuses: a re-scrape that
moves a base still means "Forever buffed this by 64" rather than quietly
reinstating a Classic figure.

**TEN PROFILES MOVED REAL AND THIRTEEN DID NOT MOVE BY A DECIMAL, AND THE TEN
ARE EXACTLY THE TEN THAT HOLD ONE OF THE FOUR WEAPONS.** Every physical profile
is at +0.0: all three Warriors, all three Rogues, Cat, Bear, Enh Shaman, both
melee Hunters and BM Hunter. **Seal Twist Ret is the containment check inside
the casters** -- a Paladin, but a two-handed one, so it holds none of the four
and did not move either.

| | |
| --- | --- |
| **Frostfire +42.4, Fire +36.7, Moonkin +36.0** | the three largest |
| Firelock +35.5, Arcane +32.2, Ele Shaman +31.8, SM/DS +31.2, Shadow +24.1, Shockadin +23.0, Prot Pally +12.0 | |
| the other thirteen | **+0.0** |

**SIX OF THE TEN ARE ONE WEAPON.** The Staff of Dominance is in the Moonkin,
Mage and Warlock sets, so it alone accounts for Moonkin, all three Mages and
both Warlocks. Azuresong is the two shield Paladins, the Sorcerous Dagger the
Elemental Shaman, and Anathema the Shadow Priest.

**ANATHEMA'S STAYS SCOPED TO SHADOW**, which the owner confirmed. Its line reads
"damage done by SHADOW spells", so the bonus lands there and the school-blind
pool is untouched -- the Priest's stat block still reads 204 and only its Shadow
total moved, 497 to 561. Widening it would have fed Holy as well.

**WING CLIP IS PRESSED FOR THE PROCS AND NOT FOR THE 50, AND THE MEASUREMENT
SAYS SO.** LW Melee **631.4 to 672.6, +41.2, REAL**, the other twenty-three
identical to the decimal. The ruleset owner asked for it "as a filler/low
priority ability if there is nothing else to press", with the reason stated
plainly: "even though it only deals 50 base damage and has no attack power
coefficient it can still count as a melee use in order to trigger things like
hand of justice, windfury, and expose prey."

**SO IT WAS WORTH ISOLATING THE TWO HALVES, AND THE OWNER'S HALF IS THE BIGGER
ONE.** Patching the damage to 1 leaves a weapon use that deals nothing; dropping
`weaponSlot` leaves 50 damage that triggers nothing.

| | LW Melee | against no Wing Clip |
| --- | --- | --- |
| as shipped | **672.6** | **+41.2** |
| weapon use kept, damage patched to 1 | 648.1 | **+16.7**, the procs alone |
| 50 damage kept, `weaponSlot` dropped | 644.2 | **+12.8**, the damage alone |
| no Wing Clip | 631.4 | — |

**THE TWO DECOMPOSITIONS AGREE TO A DECIMAL, WHICH IS WHAT SAYS THE ISOLATION IS
SOUND**: 24.5 + 16.7 and 28.4 + 12.8 both come to 41.2, the measured total. The
~12 of synergy left over is inside the noise on four intervals of that size, so
it is not claimed as a mechanism. What IS claimed is the ordering, which holds on
every reading: **the triggering is worth more than the hit.**

**PATCHING THE DAMAGE TO 1 RATHER THAN 0 IS THE WHOLE ISOLATION.** An attack that
deals nothing is refused by every reaction that reads `amount` -- Expose Prey
included -- so zeroing it would have switched off the thing being measured and
read as "the procs are worth nothing". A one-damage hit costs 0.2 DPS and keeps
every roll.

**AND THE KNOCK-ON IS VISIBLE IN THE SHARES, WHICH IS THE INDEPENDENT CHECK.**
Wing Clip itself is 3.6% of the profile at 22 uses a fight, and two rows that it
never touches directly moved with it: **Mongoose Bite 6.6 uses to 7.0**, because
Expose Prey is its only route in this build and 22 more landed main-hand attacks
is 22 more rolls for it, and **Fatal Wound 1.1% to 1.9%**, which is Vis'kag's
main-hand proc. Neither is in the entry's own row. **A filler whose damage was
right and whose `weaponSlot` was missing would have read as 3.6% and a working
ability**, and been worth a third of this.

**`weaponSlot` SET AND `weaponScaling` ABSENT IS THE CLEAREST CASE OF THAT PAIR
IN THE PROJECT.** One says whose procs an attack triggers, the other says which
attack power pool its damage reads, and Wing Clip answers the first and declines
the second. Someone "fixing" the missing field would add hundreds of damage and
break the owner's statement, so the test asserts the damage is EQUAL at 0 and
2000 attack power.

**IT IS LAST BECAUSE IT HAS NO COOLDOWN, NOT BECAUSE IT IS WEAK.** That is the
half of the floor rule that is easy to forget: an entry is a floor when it is
ungated AND always castable. Immolation Trap above it is ungated too and has a
30-second cooldown, so the list falls straight past it; Wing Clip has none, so
nothing below it could ever be reached. What limits it is 80 mana, and this
build used to finish with mana unspent.

**THE PROFILE IS FOURTH OF TWENTY-FOUR NOW, AND ALL THREE HUNTERS ARE IN THE TOP
FIVE** -- it passed Frostfire, DW Fury and BM Hunter on this one entry.

**ALL THREE HUNTERS MOVED AND NOTHING ELSE DID, ON FIVE THINGS THE RULESET
OWNER REPORTED.** BM Hunter **595.7 to 668.6**, LW Ranged **486.5 to 681.1**, LW
Melee **523.8 to 631.4**, all REAL; the other twenty-one identical to the
decimal. **Three of the five had never worked at all** rather than working
wrongly, and every one produced a plausible figure -- a Hunter without its 20%,
without a haste proc and without a hawk is still a Hunter doing Hunter damage.

| | BM | LW Ranged | LW Melee |
| --- | --- | --- | --- |
| **Lone Wolf's 20%**, which had never been applied | — | **+113.5** | **+107.6** |
| **Ammunition**, 16.5 DPS x base bow speed into base damage | **+32.0** | **+43.1** | — |
| **The quiver**, ranged swing timer / 1.15 | **+32.3** | **+39.0** | — |
| **Deadly Aspects' Auto Shot half**, which could never fire | **+25.1** | **+30.2** | — |
| **Summon Hawk in the ranged list** | 0 | 0 | — |
| **together** | **+72.9** | **+194.7** | **+107.6** |

They overlap, so the columns do not sum. **LW Melee's whole change is Lone Wolf
alone**, to the decimal, and BM Hunter did not move from it at all -- it takes a
pet instead. That is the containment check inside the class.

**TWO OF THEM WERE SILENT FOR THE LIFE OF THE PROJECT, AND BOTH FOR THE SAME
REASON: A LOOKUP THAT MISSES IS NOT AN ERROR.**

**`grantAura` RESOLVES THROUGH A FIFTH REGISTRATION SITE AND NOBODY KNEW.**
CLAUDE.md lists four places a class is registered; `TALENT_AURAS` is a fifth,
and `createPlayer` DROPS an id it cannot find on purpose -- "a typo should show
up as a talent that visibly does nothing". `lone_wolf` was never registered, so
both profiles NAMED AFTER the talent went the whole project without its 20%.
`hunterFiveFixes.test.ts` now fails if any `grantAura` id across all nine
classes resolves to nothing, with the Warlock's one legitimate exemption
written out.

**AND A PREDICATE THAT IS ALWAYS FALSE READS EXACTLY LIKE ONE THAT IS SOMETIMES
TRUE.** Deadly Aspects asked `isWeaponUseOf(attack, 'ranged')`, and
`isWeaponUse` means "a use of a MELEE weapon" -- Thunder Clap and Charge declare
`weaponSlot: 'ranged'` precisely so it excludes them. So the expression was
`(mainHand || offHand) && ranged`: **403 ranged swings over twenty fights, zero
procs of a stated 10%.** The parameter is `MeleeWeaponSlot` now, so the question
is refused at compile time rather than answered wrongly -- and narrowing it
found two more callers passing a wider type than they ever use.

**THE QUIVER AND THE AMMUNITION ARE CLASS PROPERTIES, NOT EQUIPMENT.** "Hunters
also passively have a quiver equipped -- which is not a normal equipment slot."
Both live in `game/character/hunterRanged.ts`: the quiver DIVIDES the ranged
swing timer by 1.15 (the owner's own example, 2.9 / 1.15 = 2.5217 -- not x 0.85,
which is a 2% faster bow and a plausible wrong number), and ammunition adds
`16.5 x BASE bow speed` to base damage. **Neither touches `powerCoefficient`**,
which is base speed over fourteen: recomputing it from the shortened timer would
quietly cut every Hunter's attack power scaling by 13%.

**THE WIKI FORMULA ALREADY HAD THE AMMO TERM AND NOBODY HAD READ IT.**
`rangedAttackPower.test.ts` has carried `AmmoDPS x WeaponSpeed + (RAP / 14 x
WeaponSpeed + Scope + AvgWeaponDmg)` in its header since it was written -- the
same speed symbol in both terms, which is what settles "base" over
"quiver-shortened".

**AND A LIST IS CHOSEN BY A DIFFERENT TALENT FROM THE ONE THAT GRANTS THE
ABILITY.** `hunterRotation` dispatches on `bestial_wrath`, the 31-point
capstone; `summon_hawk` is a 5-point talent five rows above it. A build taking
the hawk without the capstone fell through to the ranged list, which had no hawk
entry, and silently stopped casting an ability it had paid for. The entry is in
both lists now and is SILENT for a build without the talent -- LW Ranged shows
it at 0.0 uses, which is the ninth deliberate never-fired entry.

**THE MEAN IS 578.4**, from 541.5, re-summed from the table's own rows.

---

**THE NEWEST MOVE IS A SIX-ITEM PALADIN PASS THE OWNER FOUND BY READING THE
APP**, and five of the six were a talent that reported itself modelled and did
nothing. **The twenty-one non-Paladin profiles are +0.0 to the decimal.**

| | |
| --- | --- |
| **Seal Twist Ret 709.0 to 748.3, +39.2, REAL** | Sacred Arbiter's missing 10% on Holy Strike, plus an instant Hammer of Wrath that **fires for the first time in the project** — 1.9 casts a fight, 4.5% of the profile |
| Shockadin 581.2 to **585.5**, +4.3 | noise. Sacred Arbiter alone, on a build whose Holy Strike is 7.7% of its damage |
| Prot Pally 304.9 to **303.9**, -1.0 | noise, **and the two talents it gained do not deal damage**: Improved Righteous Fury and Iron Creed are damage TAKEN. Deaths go 11.27 to 9.63 |

**TWO FAILURE SHAPES, AND NEITHER IS VISIBLE FROM THE CENSUS.**

**A NULL VALUES ENTRY.** Sacred Arbiter is single-rank, so the importer had no
`{0}` to match and wrote `null` — and `talentBuild` discards every effect that
asks for a number, while `class_audit` reads the effect TABLE and calls the
talent complete. **Third time on this class**, after Holy Shield and Divine
Favor. The whole risk group is a class's single-rank talents, and checking them
is a five-minute job that has now been worth doing three times.

**A TWO-CLAUSE REASON, WHICH KEEPS READING AS TRUE BECAUSE HALF OF IT IS.**
Improved Righteous Fury, Iron Creed and Instrument of Law each said "threat is
out of scope, AND <something that stopped being true>". The threat half is
permanent and correct in all three; the second half expired when the owner's own
priority lists started casting Righteous Fury and Hammer of Wrath. A reader
checks the reason, reads the true clause, and stops.

**ONE OF THE SIX WAS NOT A BUG.** Reckoning measures **3.77 extra swings a fight
against an expectation of 3.62**, with all four links of the block chain verified
separately — base 9.56%, +20 exactly from Holy Shield, +30 exactly from Redoubt.
Seeing 2 in one fight is the sample size: 3.6 is a COUNT, and an extra attack
emits no telemetry of its own, so the only honest form of the answer is a mean
over many fights. `tools/probe_block.ts` is the tool that says so and is kept.

**AND ONE ENGINE CHANGE WAS WRITTEN, REVERTED, AND THEN RULED ON** — which is
worth more than the ones that shipped, and the ruling is the part to keep.

`extraAttack` ends by scheduling a FULL fresh swing timer, which cancels the
pending one, so an extra attack pushes the next normal swing out by up to a
whole timer. A change to preserve the pending swing's due time was written as
the explanation for Reckoning seeming short; **the measurement said Reckoning
was already at expectation**, the justification collapsed, and it was reverted.

**THE RULESET OWNER HAS SINCE RULED THAT THE EXISTING BEHAVIOUR IS CORRECT**:
"an extra attack from Reckoning is exactly the same as the other extra attacks
— like from Hand of Justice. It will trigger an auto-attack and reset the swing
timer." So the reset is the RULE rather than an accident, Reckoning is not a
special case, and `docs/extra-attacks.md` had the row right all along ("the
swing timer: **restarted**") — the paragraph that used to sit here called it
"almost certainly wrong" and was contradicting a document in this repository.

**`tests/engine/extraAttackSwingTimer.test.ts` PINS IT NOW**, because nothing
about `scheduleSwing` with a full fresh timer announces that it is deliberate:
the next reader goes looking and finds a bug, exactly as this pass did.

---

**THE METHOD CHANGED WITH THIS TABLE, AND THAT IS WHY SOME FIGURES MOVED WITHOUT
A CAUSE.** Every earlier baseline here was ONE batch of 300 at seed 12345; these
are thirty independent batches of ten, which is what `measure_profiles.ts` runs
and what gives each figure the interval a REAL/noise verdict needs. Most profiles
land inside the old interval and a few do not — 2H Arms read 596.6 under the old
method and 607.2 under this one on identical code. Do not read those as changes.

**AND THEN TO EIGHTEEN, WITH JUDGEMENT OF WISDOM.** The owner's instruction,
after the mechanic landed: 50% of the actions a character takes against the
target restore 59 mana. **Six profiles moved REAL and six did not move by a
decimal**, and the six that did not are exactly the right six -- the three
Warriors and the three Rogues, the only profiles with no mana bar at all. Their
roll is refused before any randomness is consumed, so those fights are
bit-identical rather than merely close.

| | |
| --- | --- |
| **Seal Twist Ret +45.4, Frostfire +43.2, Enh Shaman +40.5** | the three largest |
| Fire +34.7, LW Ranged +28.7, Prot Pally +5.5 | the rest of the REAL moves |
| 2H Arms, DW Fury, Prot Warr, Venom, Combat, Rupture | **+0.0**, to the decimal |

**IT IS WORTH MOST TO A BUILD THAT RUNS DRY, NOT TO ONE THAT GAINS MOST MANA.**
Shadow Priest takes 1,516 mana from it and moves -1.6, inside its interval,
because it was never mana-bound and the mana lands in "unspent". Seal Twist Ret
takes a comparable 1,680 and gains 45.4, because it spends nearly everything it
gets. **Arcane is the odd one of the three Mages** -- +3.1 against Fire's +34.7
and Frostfire's +43.2.

**AND IT MOVED THE TOP OF THE TABLE BY NOISE RATHER THAN BY WORK.** DW Fury is
first at 651.2 with Cat at 650.9, a gap of 0.3 against intervals of +/-8.9 and
+/-6.2 -- so the two are indistinguishable and "the top profile" has stopped
being a meaningful statement about them. Cat's own -5.2 is noise: a Druid HAS a
mana bar, so the roll is taken and the seeded stream shifts even where the mana
is worth nothing.

**THE MEAN WAS 496.8 AT THAT POINT**, from 488.3.

---

**AND THEN EVERY SELECTED ENTRY WAS MADE TO LAST THE WHOLE FIGHT, WHICH IS THE
LARGEST SINGLE MOVE THE BASELINE HAS EVER MADE.** The owner's rule: a raid
buff or debuff is applied for **twice the planned duration**, so it cannot
expire mid-fight.

**IT CHANGES EXACTLY TWO ENTRIES AND THAT IS THE WHOLE STORY.** Sunder Armor
and Thunder Clap were declared with the durations the WARRIOR'S OWN abilities
use -- thirty seconds, because a warrior recasts them -- and the raid buff
REUSES those auras rather than declaring a second copy. Right for a warrior and
wrong for everyone else: on a Rogue or a Hunter nothing refreshes them, so the
raid's 2,250 armor reduction fell off at the half-way mark and the back half of
every such fight was measured against a target it was never meant to face.
Every other entry is already an hour, five minutes, or zero -- which means
permanent -- so a uniform rule moves only those two.

**FOURTEEN PROFILES MOVED REAL AND NINE DID NOT MOVE BY A DECIMAL, AND THE NINE
ARE EVERY PURE CASTER.** Moonkin, Ele Shaman, all three Mages, both Warlocks and
the Shadow Priest came back identical. That is the containment check and it
could not be cleaner: Sunder Armor reduces ARMOR, which only physical damage
pays, and Thunder Clap slows a target's SWING, which only matters when something
is being swung at. A profile that deals pure spell damage should see nothing
from either, and sees nothing.

| | |
| --- | --- |
| **Combat +59.3, Cat +52.9, BM Hunter +49.7** | the three largest |
| Bear +47.0, LW Melee +45.7, Venom +46.5, Rupture +43.9, Enh Shaman +43.3, LW Ranged +40.1 | |
| Seal Twist Ret +37.5, 2H Arms +21.3, Shockadin +20.1, Prot Warr +14.5, Prot Pally +12.2 | |
| Moonkin, Ele Shaman, Frostfire, Arcane, Fire, SM/DS, Firelock, Shadow | **+0.0** |

**DW FURY'S +15.9 IS CALLED NOISE AND IS ALMOST CERTAINLY REAL.** The verdict
compares a delta against this run's interval DOUBLED, which is deliberately
conservative -- it calls a real change noise before it calls noise a change --
and DW Fury's interval is the widest of the physical profiles. It is the one
figure in the table where the label is the method talking rather than the
mechanic.

**AND THE TWO-HANDED WARRIOR STOPPED CASTING SUNDER ARMOR ENTIRELY.** The raid's
five stacks now hold all fight, so the entry that refreshed them never becomes
the first castable one and the rage and global cooldowns go elsewhere. That is
the rule working rather than a list breaking, and it is asserted as ZERO in
`presets.test.ts` rather than deleted -- an entry that silently stops firing is
the failure this project has been caught by twelve times, so the one time it is
deliberate it gets written down.

**THE MEAN WAS 520.8 AT THAT POINT**, from 496.8, and Cat was on top at 703.8 —
which the seal crit ruling above has since taken back off it.

**BEFORE THAT, THE PRESET RAID BUFFS WENT FROM TWELVE TO SEVENTEEN, ON THE OWNER'S OWN SCREEN,
AND IT MOVED EIGHTEEN PROFILES.** Added: **Arcane Intellect, Blessing of Wisdom,
Mana Spring Totem, Trueshot Aura and Curse of the Elements.** Still absent on
purpose: Grace of Air Totem except where it replaces Windfury, Moonkin Form, which
cannot sit beside Leader of the Pack, and Curse of Recklessness.

**AND THE TWO RANGED HUNTERS SWAP WINDFURY FOR GRACE OF AIR**, also the owner's
instruction. Windfury Totem is "20% chance on each MAIN-HAND use", which a Hunter
shooting a bow never has -- a ticked box worth exactly nothing. **LW Melee keeps
Windfury**, because it swings a main hand: the split is by what the profile DOES
rather than by class.

**FIVE PROFILES DID NOT MOVE BY A DECIMAL, AND THEY ARE EXACTLY THE RIGHT FIVE.**
2H Arms, DW Fury, Prot Warr, Cat and Bear -- every profile that deals pure physical
damage, carries no mana bar and never fires a ranged weapon. All five new buffs are
intellect, mana, ranged attack power or magic damage taken, so a containment check
could not have come back cleaner if it had been designed.

| | |
| --- | --- |
| **Fire +103.1, LW Ranged +101.5, Frostfire +99.8** | the three largest. LW Ranged is the Windfury swap on top of Trueshot and the curse |
| Seal Twist Ret +57.2, BM Hunter +56.3, Arcane +54.3, Shockadin +50.0, Enh Shaman +47.8 | |
| Firelock +39.5, Shadow +39.2, SM/DS +38.1, Ele Shaman +36.4, Moonkin +34.4, Prot Pally +32.0 | |
| **Venom +8.2, LW Melee +7.0, Rupture +3.8, Combat +3.1** | the small ones, and they are small for a reason worth reading |
| 2H Arms, DW Fury, Prot Warr, Cat, Bear | **+0.0** |

**THE FOUR SMALL GAINS ARE CURSE OF THE ELEMENTS REACHING DAMAGE NOBODY THINKS OF
AS MAGIC.** A Rogue's poisons tick NATURE and a Hunter's Immolation Trap burns
FIRE, so three nominally physical profiles take a share of an 8% magic debuff --
and the share is in the right order, Venom's poison-heavy build gaining most. That
is the sort of thing a containment check is for: those four were not expected to
move at all, and the reason they did is correct rather than a leak.

**THE MEAN WAS 498.8 AT THAT POINT**, from 463.5. The dives and corrections
below then took it to 488.3, and Judgement of Wisdom to 496.8.

**THE ROGUE DEEP DIVE WAS THE LAST IN AND NEEDED A RECONCILIATION RATHER THAN A
MERGE.** Venom 392.7 to **440.2**, Combat 419.8 to **461.8**, Rupture 377.1 to
**402.5**. Its census went 14 live gaps to **3**, and nine of the eleven it closed
were declarations rather than engine work.

**IT BRANCHED BEFORE FIVE OTHER DIVES LANDED AND BUILT SEVEN OVERLAPPING APIs
UNDER DIFFERENT NAMES.** That is the real finding of this round, and it cost more
than any single dive:

| The Rogue called it | The merged project calls it |
| --- | --- |
| `abilityBelowTargetHealth` (a list of ids) | `abilityDamageInFinalFraction` (one id per entry) |
| `FightProgress` (an object) | a plain `remainingFraction` number |
| `clockConditionsUnreachable` (a predicate) | a THROW from `forWhileFinalFraction` |
| `abilityDamageTaken` + `abilityDamageTakenMultiplierFor` | `attackerAbilityModifiers` + `abilityModifierAgainst` |
| `critMultiplier: 'melee'` | `table: 'melee-special'` |

**AND THREE OF ITS ADDITIONS WERE GENUINELY NEW, so they were restored rather than
translated**: `CastModifier.costReduction` (a FLAT cost cut, where main had only
the fraction -- not interchangeable), `abilityCrit`'s `valueIndex` (without which
Puncturing Wounds silently gave Mutilate Backstab's 15% instead of 30%), and
`appliedElsewhere`.

**`appliedElsewhere` IS THE ONE WORTH KEEPING ACROSS CLASSES.** It names the module
that applies an effect the table cannot express -- Vile Poisons and Improved
Poisons both WORK, read by the poison reactions, and every census in the project
counted both as live gaps because their reasons said "APPLIES in full" in capitals
and `class_audit.ts` counts effects, not adjectives. It is data, exactly as `scope`
is, and the tool now counts a talent carrying it PARTLY modelled.

**THE TRANSLATION IS VERIFIED BY MEASUREMENT AND NOT ONLY BY TESTS.** Its own
figures reproduce to the decimal after the rewrite -- Venom 440.2 and Combat 461.8
are exactly what its branch recorded against its own engine -- and its 708-line
test file passes. A rename that had changed semantics would have moved them.

**ONE EXPIRY CROSSED A CLASS BOUNDARY AND ONLY A TEST CAUGHT IT.** The Warrior's
Weaponmaster said "the damage pipeline has no attacker-side armor term, re-checked
2026-09-30" -- true that day, and false once this dive made `armorPenetration` a
stat for Hack and Slash. Nothing in the Warrior's own files changed.
`armorPenetration.test.ts` asserts BOTH callers on purpose, which is what failed.
See [docs/handoff/rogue.md](docs/handoff/rogue.md).

**RAPID FIRE WAS IN THE MELEE HUNTER'S BOOK AND IN NO LIST.** LW Melee **495.4
to 523.8, +28.4, REAL**, the other twenty-two identical to the decimal.
"Increases RANGED AND MELEE attack speed by 40% for 15 sec" -- the melee half is
why it belongs, and the other two Hunter lists have carried it since they were
written. **This one was the odd one out for as long as the build swung a
two-hander, and nobody re-read the list against the ability book when it
changed.**

**WHERE IT GOES MEASURES AS NOTHING.** First 517.0, third 523.8, last 531.2, on
intervals of 5.3, 7.3 and 7.1 -- all three overlap, so by this project's own rule
that is no difference and the nominally-highest is noise. It sits third because
that is where the owner's other two lists put it. **The entry is worth +28.4 and
its position is worth zero**, which is a distinction worth keeping apart: one is
a finding and the other is a coin.

**THE MELEE HUNTER DUAL-WIELDS NOW, AND IT MOVED ONE PROFILE.** LW Melee
**414.5 to 495.4, +80.9, REAL**, the other twenty-two identical to the decimal.
The ruleset owner replaced its two-hander with Vis'kag and the Core Hound Tooth,
both enchanted, and it is worth more than a weapon swap because it expired a
talent's caveat and exposed a proc that had been right by accident:

| | |
| --- | --- |
| **+38.8** | **Predator's Edge's off-hand clause**, which had no off hand to raise until now |
| **+30.2** | **Deadly Aspects rolling off EITHER hand**, which its tooltip always said |
| **~+11.9** | the switch itself: two weapons, two swing timers, and Vis'kag's Fatal Wound proc |

They overlap, so the three do not sum exactly. **The off hand is 23.5% of the
profile**, and Mongoose Bite nearly doubles its casts -- 3.3 a fight to 6.2 --
because Expose Prey procs off both hands.

**PREDATOR'S EDGE WAS HALF A TALENT AND THE OTHER HALF WAS NEVER AN ENGINE GAP.**
Its `unmodelled` reason read "there is no off hand for the second number to
raise", which is a claim about the PROFILE rather than about the engine --
`offHandDamage` had existed since Dual Wield Specialization needed it. The owner
changed the build and the reason expired with no engine code touched. **Hunter
goes 27 fully modelled to 28, and partly 6 to 5.**

**THE TALENT MULTIPLIES THE PENALTY RATHER THAN REPLACING IT**, which is the
arithmetic worth writing down: `0.5 x (1 + 50 / 100) = 0.75`, the owner's stated
25% penalty. Writing 0.75 directly would agree with them at rank 5 and silently
stop scaling everywhere else.

**THE PROC THAT HAD BEEN RIGHT BY ACCIDENT IS THE PART TO CARRY.** Deadly
Aspects' melee half checked `isWeaponUseOf(attack, 'mainHand')`, and while this
Hunter held a two-hander that WAS "any melee swing" -- one slot swings. Dual
wielding separated them, and the off hand is the FASTER weapon, so most of the
build's swings had stopped rolling for a proc whose tooltip says "all melee auto
attacks". **A test can be equivalent by accident and stop being so because the
CHARACTER changed, not the code** -- the "check its siblings" lesson arriving
from the other direction, and worth more than the weapon swap itself.

**THE HAWK HAS BEEN REDEFINED THREE TIMES IN THREE DAYS, AND EACH TIME IT MOVED
ONE PROFILE AND NOTHING ELSE.** The latest: **646.6 to 547.0, -99.6, REAL**, the
other twenty-two identical to the decimal.

| Revision | What it said | BM Hunter |
| --- | --- | --- |
| 2026-09-30 | 108 flat every 2 seconds, one aura stacked twice | 731.8 |
| 2026-10-02 | 108 + 5% RAP every 3 seconds, 7 hits, two independent hawks | 646.6 |
| 2026-10-02 | **108 + 5% RAP on the dive, a QUARTER of it every 2 seconds** | **547.0** |

**THE THIRD IS 3.25 OPENERS AGAINST THE SECOND'S 7**, so the ability more than
halved and the profile fell 15.4% with it. The hawk goes from the largest single
source at 30.3% to **17.9%**, behind auto-shot again and level with the pet's
swings.

**THE SECOND REVISION'S ISOLATIONS, KEPT BECAUSE THEY STILL EXPLAIN THE SHAPE:**
the 5% ranged attack power coefficient was worth **+84.0** measured by zeroing
it, and the move from ten hits at two seconds to seven at three was **-32.5**
including the gain from each hawk getting its own clock.

**WHAT HAS SURVIVED ALL THREE REVISIONS** is the part that was never about the
numbers: two independent auras with two clocks, the overwrite-the-oldest rule,
the `summoned_hawks < 2` clause on the list, and the damage crediting
`summon_hawk` so Unleashed Fury and Ferocity keep reaching it. **AND IT CLOSED A CAVEAT RATHER THAN A PLACEHOLDER**: the old model
admitted in writing that the two hawks shared one eighteen-second clock, so
summoning the second reset the first and both expired together. `hawk_1` and
`hawk_2` are separate auras now.

**THE SILENT BREAKAGE IT NEARLY CAUSED IS THE PART WORTH CARRYING.** Unleashed
Fury and Ferocity both key on the ability id `summon_hawk`, and both reached the
old hawk only because the AURA was called `summon_hawk` -- a periodic tick
carries its aura's id. Renaming the auras would have stopped two talents
applying to a quarter of a Beast Mastery build's damage with nothing erroring.
The damage events pass `abilityId` explicitly and a test asserts it.

**THE PET MODEL MOVED ONE PROFILE AND NOTHING ELSE BY A DECIMAL BEFORE THAT.** BM Hunter
**788.1 to 595.1, -193.0, REAL**, and the other twenty-two identical -- the two
pet-less Hunters included, which is the containment check for a change confined
to `createPet`. The ruleset owner supplied a complete pet model on 2026-10-01 and
**it removed the last placeholder in the class**:

| | |
| --- | --- |
| **-230.8** | the base damage, 300 a swing to **36.34-55.32**, measured with the pet's attack power and crit left as they were |
| **+37.5** | the pet's own **252 attack power and 5 crit**, which did not exist at all before |

**SO BM HUNTER'S 788.1 AND ITS 731.8 BEFORE THAT WERE BOTH MEASURED AGAINST AN
INVENTED BASE DAMAGE** -- 50 for the life of the project and 150 for a day. 595.1
is the first figure that was not, and it takes the profile from first to fourth.
The two isolations above were measured on the pre-`#149` raid buffs, where the
whole was -193.2; re-measured here it is -193.0, which is the same change seen
through a different raid.

**THE HUNTER DEEP DIVE CAME FIRST AND ITS CONTAINMENT HELD TOO.**
BM Hunter **405.8 to 731.8, +326.0, REAL** and LW Melee **321.5 to 362.7, +41.1,
REAL**; the other twenty-one identical to the decimal, **LW Ranged included** --
which is the check for a change that touched pets, hawks, traps and a melee bleed
at once.

**ALMOST ALL OF IT WAS TWO OWNER ANSWERS, NOT ENGINE WORK.** Both figures were
named `PLACEHOLDER_` and both were load-bearing:

| | |
| --- | --- |
| BM Hunter **+223.2** | the pet's base DPS, **50 to 150** -- **superseded the next day by the owner's real model**, above |
| BM Hunter **+144.4** | the hawk at **108**, with both of the two it can have dealing damage, measured with the pet left at 50 |
| LW Melee **+30.4** | the Immolation Trap entry |
| LW Melee **+12.4** | Lacerating Strikes' bleed |

**AND A SCOPE QUESTION CAME BACK AS AN ABILITY.** Asked whether traps were out of
scope, the owner added no union member and put **Immolation Trap** in instead,
ruling away only the part the engine cannot do: "assume it triggers instantly when
cast". That closed three Hunter talents rather than one. **Explosive Trap is still
undeclared, because the owner named one trap** -- a ruling covers what it says.
See [docs/handoff/hunter.md](docs/handoff/hunter.md).

**THE PRIEST DEEP DIVE CLOSED THE LARGEST SHARED GAP IN THE CENSUS, AND IT
REACHED FOUR CLASSES.** Spell hit per school was the stated reason five talents
across three classes were inert, and **it was not true**: `rollTable` already
folds the school's modifier in before the roll, so the school was in hand all
along and what was missing was a FIELD. `AbilityModifier.hitBonus`, one line in
`talentBuild`, five talents -- Arcane Focus and Elemental Precision on the Mage,
Shadow Focus and Holy Precision on the Priest, Divine Precision on the Paladin.

**IT ALSO BUILT THE CLOCK-CONDITIONED MODIFIER** that Early Demise and the
Rogue's Quietus both wanted, which is `addWhileFinalFraction` -- and the Rogue
branch built the same thing independently. See the note on that field.

**ITS OWN FIGURES WERE MEASURED AT A BASE FOUR MERGES OLD** and are not repeated
here for that reason: Arcane +34.1, Frostfire +25.2, Shadow +17.4 and Shockadin
+12.4 against a baseline where Arcane was 392.6 and Shockadin 379.0. **The
published table below is re-measured once after all the dives land** rather than
patched five times -- which is the only way the 23 figures stay comparable to
each other, and comparability is the whole contract of that table.

**AND SHADOW WORD: DEATH WAS RE-ISOLATED AT THE CURRENT BASELINE AND HAS NOT
MOVED**: putting it back is +35.2 REAL, so spell hit and that ability are
independent and the cost of the owner's choice is confirmed rather than assumed.
See [docs/handoff/priest.md](docs/handoff/priest.md).

**THE PRIEST WAS THEN TUNED BY THE OWNER AND IS 516.4 TO 597.9, +81.5 REAL**,
with twenty-three of the twenty-four identical to the decimal. Shadow Word:
Death's entry is **+37.7** -- the price recorded against it twice while it was
absent, and the owner took it -- the new 13/3/35 build is **+18.7**, and the
Improved Mind Flay fix is **+18.2**. **Marginal figures, each measured by
removal from the finished configuration, and they do not sum to 81.5.**

**ONE TALENT HAD BEEN APPLYING THE WRONG NUMBER, AND NO AUDIT HERE ASKS.**
Improved Mind Flay declared `valueIndex: 1` against a row of
`[damage%, yards, slow%]`, so it applied the RANGE as a damage multiplier for
its whole life. **The census has four columns and none of them is "correct"**;
`coefficient_probe` asks whether damage responds to a stat and `ability_audit`
whether an ability is connected. The plausible wrong value was another rank's
right one -- 10% where the talent grants 20% -- so the talent read as one rank
behind itself and no figure looked odd. `tools/value_index_sweep.mjs` lists the
other 47 sites and **found a second instance at once**: the Warlock's Aftermath,
right only because at 5/5 its two candidate numbers coincide.

**AND THE HOLD BAND THE OWNER PUT ON SHADOW WORD: DEATH MEASURES -4.9**, which
was put to the owner with that figure and **ruled: "leave the hold band".** So it
is a DECISION rather than an outstanding item, the same resolution Hunter's Mark
got at -10.1 -- and saying which it is matters, because a settled choice written
up as pending inflates the queue and hides the real work.

It buys nothing because the Early Demise window (11.6s) is shorter than the
ability's cooldown (15s), so at most one cast can land in it and an ungated entry
already lands that one: 1.00 a fight either way, against 3.53 casts held and 4.00
unheld. **What would reopen it is the arithmetic, not the DPS** -- a longer fight
or a shorter cooldown makes the window hold two casts, and a test fails if that
happens.

**THE RATIONALE FIRST WRITTEN FOR THE BAND WAS FALSE** -- "one cooldown wide",
from 15% of a hundred-second fight, when the fight is sixty -- **and a test had
been written that asserted it and passed**, because `bandFraction * seconds(100)`
really is 15000. A rationale is a claim and wants measuring like any other.

**THE DRUID DEEP DIVE MOVED THREE PROFILES AND THE OTHER TWENTY DID NOT MOVE BY
A DECIMAL.** Cat **488.0 to 656.1, +168.1**, Bear **376.2 to 444.7, +68.5**,
Moonkin **384.3 to 398.0, +13.7**, and every other figure identical -- which is
the containment check for nine talents and six new declarations. **Cat is now the
highest profile in the project**, above DW Fury's 651.2, from ninth.

**A GAIN THAT SIZE IS ATTRIBUTED, NOT ASSERTED.** `tools/druid_attribution.ts`
takes one talent back out at a time over the same 30 batches of 10. King of the
Jungle is **+104.5** on its own, because the Cat's whole fight budget is about
690 energy and two Tiger's Furies at 60 each are 120 of it; then Predatory
Strikes +62.9, the Glaive's form clause +32.3, Genesis +29.5, Rend and Tear
+16.6. **Two of those figures carry a cascade**: removing three points from Feral
Combat puts a deeper talent under its tier gate and `createPlayer` drops it
silently, so `-predatory_strikes` also drops Rend and Tear and Berserk. The probe
names every cascade beside its figure, and the first run of it did not.
See [docs/handoff/druid.md](docs/handoff/druid.md).

**THE MAGE DEEP DIVE MOVED TWO PROFILES AND LEFT TWENTY-ONE IDENTICAL.** Arcane
392.6 to **450.9, +58.3, REAL** and Fire 401.2 to **440.1, +38.9, REAL**, on two
signature mechanics that were each wrong in a way the code said out loud.
Frostfire did not move by a decimal, which is the containment check: it takes
neither Combustion nor Arcane Blast nor Arcane Power. **Arcane is now the top
Mage, and the Mage is the best caster after Firelock.**

| | |
| --- | --- |
| **Combustion, +38.9** | applied TEN stacks by writing `instance.stacks` directly, of `spellCritChance` -- every school -- for a placeholder 30 seconds. `applyStatModifiers` runs inside `apply` at ONE stack and only `refresh` re-applies, so the aura REPORTED ten stacks and PAID one. Three errors, and the first cancelled the other two. It is a real ramp now: a stack per Fire spell hit, Fire spells only, ending on four non-periodic Fire crits. `PLACEHOLDER_COMBUSTION_DURATION_MS` is deleted |
| **Arcane Blast, +64.5** | its "+10% damage to all your OTHER spells" was unmodelled with a caveat saying there is no "everything except this one". True of `damageDoneMultiplier` and not of `abilityModifiers`, where it is a list with one name left out. **When it ends is an INTERPRETATION** -- see the open questions |
| **Arcane Power, -6.2** | its "+30% mana cost" was dropped with a caveat saying it would need a list of every Mage spell. The list exists and a test derives the same set from `MAGE_ABILITIES` |
| **Winter's Chill, 0.0** | built, and no Mage profile takes it. `attackerAbilityModifiers` is the mirror of the `critWhileAura` Shatter needed: a crit bonus for two NAMED abilities carried by the TARGET |

**ITS TRIAL MERGE WITH `priest-deep-dive` PROJECTED Arcane 492.2, Fire 449.4 and
Frostfire 437.8**, the last being spell hit alone. **Not a baseline** -- a
projection on a merge that had not happened, recorded so whoever merged second
could tell a surprise from an expectation. The Priest merge is still to come.
See [docs/handoff/mage.md](docs/handoff/mage.md).

**THE SHAMAN DEEP DIVE MOVED BOTH ITS PROFILES AND NOTHING ELSE.** Ele Shaman
295.4 to **375.0, +79.6, REAL** — the largest single-profile gain in the project
since the owner's priority lists landed — and Enh Shaman 451.1 to **462.0, +10.9,
noise**, with the other twenty-one identical to the decimal.

**AND IT WAS RE-BASELINED AGAINST `main` AFTER THE WARRIOR AND WARLOCK DIVES
LANDED**, because both of those touched ENGINE files and a delta taken against the
older base would have credited this one with their work. Both Shaman figures came
back identical to the decimal, so nothing those two changed reaches this class —
which is also the containment check for them.

**THE ENHANCEMENT FIGURE IS A LIE BY NET AND THE DECOMPOSITION IS THE REPORT.**
Four real changes offset inside one interval, and because the build is MANA-BOUND
they do not sum to it either — removing Fire Nova's 520 mana a cast makes
everything above it more affordable, so each isolated value overstates what it
adds. Each measured on its own, 30 batches of 10:

| Change | Profile | Worth |
| --- | --- | --- |
| Searing Totem in the Elemental list | Ele | **+59.5** |
| Fire Nova, declared and in the Enhancement list | Enh | **+25.5** |
| Elemental Focus (Clearcasting) | Ele | **+12.5** |
| Lightning Overload | Ele | **+11.1** |
| Maelstrom Weapon, flat 20% to **5 PPM** | Enh | **+6.6** |
| Improved Stormstrike's mana regeneration | Enh | **+3.4** |
| Windfury imbue internal cooldown, 1.5s to **3s** | Enh | **-10.0** |

**THE LARGEST IS A TALENT POINT BUYING A CLAUSE THE ROTATION COULD NOT REACH.** The
Elemental build spends 3/3 on CALL OF FLAME, whose first clause is "the damage done
by your FIRE TOTEMS", and its list cast no totem for the whole project. The talent
was correct, its effect was correct, and it was worth nothing — which reports
identically to a talent that works. **When a talent names an ability, check a list
casts it.** See [docs/handoff/shaman.md](docs/handoff/shaman.md).

**AND IT PROPOSED TWO NEW SCOPE MEMBERS**, `castPushback` and `totemEntities`, on a
"blocked twice" argument rather than on the owner's word — which moved FIVE classes'
counts, not just its own. See CLAUDE.md under **Scope**; the owner has not ruled on
them.

**THE PALADIN DEEP DIVE MOVED ALL THREE OF ITS PROFILES AND NOTHING ELSE.**
Seal Twist Ret 471.0 to **528.3 (+57.3)**, Shockadin 379.0 to **472.7 (+93.7)**,
Prot Pally 153.2 to **238.1 (+84.9)**, every one REAL -- and the twenty
non-Paladin profiles identical to the decimal, which is the containment check for
a change touching four shared engine files. Seal Twist Ret becomes the project's
third-highest profile and Prot Pally stops being an outlier at the bottom.

**NOTHING IN IT WAS A NEW NUMBER.** Six of the eight gaps it closed were never
engine gaps: their `unmodelled` reasons were claims about what the engine could
not do, and each claim was about the wrong thing. Three of them rested on a rule
that a reaction cannot fire on a BLOCK, which **the Warrior's own reactions have
disproved since the attack table was written**. See
[docs/handoff/paladin.md](docs/handoff/paladin.md).

**THE WARRIOR DEEP DIVE MOVED TWO PROFILES AND BOTH MOVES ARE NOISE.** 2H Arms
607.2 to **603.3** (-3.9 against +/-9.1) on Slam's cooldown going 15 to 18, and
DW Fury 652.0 to **651.2** (-0.8 against +/-8.9) on Spearing Strike turning out
to require a two-handed weapon. The other twenty-one are identical to the
decimal, Prot Warr included. **The uses column is where the change actually
shows**: Slam 2.9 casts a fight to 2.5, and Spearing Strike 2.7 to ZERO, with
its 15 rage going straight into Heroic Strike -- 9.0 casts to 11.0. **Losing an
ability outright cost 0.8 DPS**, which is what a rage-bound build looks like --
and it means the owner's Spearing Strike entry was worth about one DPS even
while it worked.

**THE SAME DIVE TOOK THE FIRST CLASS TO ZERO LIVE GAPS.** See
[docs/handoff/warrior.md](docs/handoff/warrior.md) and
[docs/source-cross-checks.md](docs/source-cross-checks.md).

**SHATTER MOVED ONE PROFILE AND THE CONTAINMENT HELD EXACTLY.** Frostfire
376.6 to **412.5, +36.0, REAL**, and the other twenty-two identical to the
decimal -- which is what a talent change scoped to one build should look like.
It makes Frostfire the top Mage, above Fire's 401.2 and Arcane's 392.6, and the
build that existed for the Fire/Frost overlap now has a third reason to. The
mean across **24** is **704.8**, RE-SUMMED FROM THE TABLE ABOVE rather than
adjusted -- **by `tools/update_baseline_table.py`, which exists now**; the
sentence above it had promised a script for several commits and there was none,
so the mean and the ordering were still being maintained by hand.
**AND RE-SUMMING IT ONCE MOVED IT 21.5 ON A CHANGE WORTH 1.7 A PROFILE** -- that
was the Shatter edit, not this one -- which is the drift the instruction exists
to catch: 558.9 was stale at that point and would have stayed stale if the
figure had been adjusted by the delta instead. It read 488.3 for a while, then 541.3 **across 23 when there
were already 24** -- each figure right when it was written and drifted as dive after
dive moved a profile and left the average alone. **The COUNT drifted too, which
is the same failure one level up**: Hemo made it twenty-four and the sentence
kept saying twenty-three. Add the rows up and count them.
See [docs/handoff-apl.md](docs/handoff-apl.md).

**AND THEN THE BASE PAW DAMAGE TURNED OUT TO BE 1, FOR BOTH FORMS.** Stated by
the ruleset owner, where `BASE_BEAR_PAW_DAMAGE` and `BASE_CAT_PAW_DAMAGE` had
been **assumed at 100 and 50** with a comment saying so. They were about a fifth
of every paw swing -- 50 of the Cat's 245.1 and 100 of the Bear's 511.1 -- so two
profiles were carrying a sixth to a fifth of their damage on a number nobody had
supplied.

| Profile | was | now | |
| --- | --- | --- | --- |
| Cat | 937.7 | **843.0** | **-94.8, -10.1% REAL** |
| Bear | 523.1 | **433.6** | **-89.5, -17.1% REAL** |
| the other 22 | | | **+0.0** |

**THE MOONKIN IS ONE OF THE TWENTY-TWO**, which is the containment check worth
naming: it is the third Druid profile and it is a caster, so it holds a weapon
rather than a paw and the constant cannot reach it.

**THE TWO FORMS LOST DIFFERENT SHARES FROM THE SAME ~20% CUT, AND THE REASON IS
`weaponScaling`.** The base paw damage is a flat term inside the paw, so it
reaches the autos and the abilities that take weapon damage and nothing else:

| | paw-based share | prediction | measured |
| --- | --- | --- | --- |
| Bear | **85.9%** -- Maul 31.5, autos 28.0, Primal Bite 26.4 | 19.4% x 85.9% = 16.7% | **17.1%** |
| Cat | **54.6%** -- autos 31.5, Shred 23.1 | 20.0% x 54.6% = 10.9% | **10.1%** |

Rip at 35.3% and Rake at 10.1% carry their own coefficients, and Lacerate's
14.1% is a stacking DoT -- none of the three touches the paw.

**AND THE COMMENT NAMING THE PAW ABILITIES WAS WRONG, WHICH IS THE OBVIOUS PLACE
SOMEBODY WOULD GO FOR THAT ESTIMATE.** `weapons.ts` listed "Shred, Claw, Maul,
Primal Bite, Lacerate"; Lacerate deals no weapon damage at all. Pricing this
change off that list would have expected the Bear to lose its Lacerate share
too, putting the estimate at 19.4% x 100%. **Read `weaponScaling` rather than a
prose list of which abilities use the weapon.**

**THE BEAR IS NOW THE SECOND-LOWEST PROFILE IN THE PROJECT**, 433.6 against Prot
Pally's 303.9, having been mid-table. That is what the owner's number says and
it is not a tuning decision -- but it is a large move on a tank build and worth
knowing about.

**AND THEN RIP'S COEFFICIENT WAS PER TICK AND SHOULD HAVE BEEN PER DURATION.**
The owner reported the Cat as still too high and named the ability: "rip should
be 4% attack power coefficient per combo point spent over its duration NOT each
tick; each tick should be 4%/6 attack power coefficient per combo point spent."

Rip has SIX ticks -- twelve seconds at two -- so a five-point Rip was paying
`0.04 x 5 x 6` = **120% of attack power instead of 20%**, six times the stated
figure.

| Profile | was | now | |
| --- | --- | --- | --- |
| Cat | 843.0 | **663.3** | **-179.7, -21.3% REAL** |
| the other 23 | | | **+0.0** |

**THE BEAR IS ONE OF THE TWENTY-THREE AND SO IS THE MOONKIN**, which is the
containment worth naming: Rip is a Cat finisher, so neither of the other two
Druid profiles can reach it.

**THE ARITHMETIC RECONCILES, WHICH IS THE CHECK THAT THE FIX LANDED WHERE IT
SHOULD.** At 1792 attack power a five-point Rip went from `855 + 2150.4` to
`855 + 358.4`, so it pays 40.4% of what it did. Rip was 35.3% of 843.0 = 297.6,
and `297.6 x (1 - 0.404)` predicts **-177.4** against a measured **-179.7**. Its
share is **17.9%** now and the Cat's top source is its auto-attack at 40.0%.

**NOTHING IN THE SOURCE EVER SAID PER TICK, AND THE SHEET'S OWN NOTATION SAYS
SO.** `docs/spell-coefficients.md` records the key: `N% per tick` for an effect
stated per tick, `N%*combo point spent` for one multiplied by what the finisher
spent. Rip's row carries the second marker and NOT the first. **The per-tick
reading contradicted a notation table in the same document** -- and the constant
was named `RIP_TICK_AP_COEFFICIENT_PER_COMBO_POINT` with a comment repeating it,
which is how a reading becomes a fact nobody re-checks.

**THE TELL WAS THAT THE TWO HALVES OF ONE EFFECT USED DIFFERENT CONVENTIONS.**
Rip's flat damage was always a duration total divided by the tick count
(`RIP_BY_COMBO_POINT` over six) while its coefficient was applied per tick. Both
halves now come from one duration total over one named `RIP_TICK_COUNT`, so they
cannot drift apart again -- and a reader checking EITHER HALF ALONE would have
found it self-consistent, which is why this needed the owner rather than an
audit.

**AND IT PUTS THE CAT'S LIST BACK IN QUESTION, WHICH IS NOT DONE HERE.** Rip now
pays 40% of what it did, so "spend five points on Rip" is a weaker claim than it
was and Ferocious Bite is the alternative the list does not use. That is an APL
measurement rather than a coefficient fix, and this commit deliberately changes
one thing: the Cat's priority list is untouched and its 663.3 is the figure for
the list as it stands.

**AND NATURALIST WAS READING A NUMBER OF SECONDS AS A PERCENTAGE.** "Reduces the
cast time of your Healing Touch spell by 0.5 sec and increases all damage you
deal by 5%" is one values row of two numbers, `[0.5, 5]`, and
`conditionalDamage` had no `valueIndex` -- so it read index 0 and a rank-5
Moonkin carried **x1.005 instead of x1.05** for the whole life of the talent.
Moonkin **472.8 to 494.0, +21.2**, Cat **703.8 to 716.4, +12.6**, and the other
twenty-two identical to the decimal.

**BOTH LAND EXACTLY ON THE RATIO, WHICH IS A BETTER CHECK THAN THE VERDICT.**
472.8 x 1.05 / 1.005 = 494.0 and 703.8 x 1.02 / 1.002 = 716.4, to the decimal in
both cases -- so the Cat's +12.6 is a deterministic +1.8% even though the harness
printed `noise` for it. **A REAL/noise verdict is a statistical test on the
OUTPUT, and a change with a known exact mechanism can be real and be labelled
noise**: the Cat is a high-variance profile and 1.8% is inside its own interval.
Read the label, then check the mechanism.

**NOTHING COULD HAVE CAUGHT IT, and that is the part worth keeping.** Half a
percent is a plausible blanket multiplier; the talent reported itself FULLY
MODELLED, so the census counted it in the `Fully` column and no audit looks at a
working talent's magnitude; and the only published check on it was a profile DPS
figure measured with the bug already in. Every Moonkin and Cat number in this
repository was light and perfectly self-consistent.
`tests/game/talentValueIndex.test.ts` now records all eleven blanket
multipliers, by hand, with what each one's index MEANS.

**AND MOONKIN AURA WAS WORTH 6% TO THE WRONG RAID.** The owner has ruled that
Moonkin Aura and Leader of the Pack "are all the same exclusive 3% global
critical strike chance and do not stack", which SUPERSEDES their earlier "they
don't stack, but that can be handled on the GUI". The GUI half was never enough:
`withRaidBuff` governs the two RAID BUFF entries and knows nothing about the two
TALENTS, so a Moonkin carrying its own form talent in a raid with Leader of the
Pack ticked held two different aura ids and read **+6% crit** -- 24.243% spell
crit against 21.243%, measured. A profile loaded from JSON with both buff ids did
the same, because nothing re-runs `withRaidBuff` on load.

**ONE `AuraDefinition`, ONE id, FOUR SOURCES.** `PARTY_CRIT_AURA`, and both raid
buff entries and both talents apply it, so `AuraCollection.apply` refreshes
instead of stacking and no combination is worth more than 3%. Structural rather
than remembered: a fifth source gets the rule for free. **A rule enforced at a
chooser does not cover a source the chooser does not own.**

**AND THE MOONKIN PRESET NOW SELECTS MOONKIN AURA BY DEFAULT**, on the owner's
instruction -- a SUBSTITUTION for Leader of the Pack rather than the removal it
used to be, because the raid is not short a buff, it has the other one. Three
presets now substitute a raid buff and one drops one; the exception lists are
derived from `PRESET_RAID_BUFFS` by mapping and asserted EXHAUSTIVE in
`presets.test.ts`.

**ALL 24 PROFILES ARE IDENTICAL TO THE DECIMAL**, which is the whole point: the
fix removes a way to be wrong rather than changing a number, and the containment
check is that nothing moved at all.

**AND THEN SPELL HIT, WHICH WAS THREE SEPARATE THINGS.** The owner stated the
numbers -- 17% flat spell miss, a 1% floor, so a 16% usable cap -- and that a DoT
APPLICATION rolls to hit while its ticks never ask again.

| | |
| --- | --- |
| **Nature's Reach was doing NEITHER of its clauses** | "Increases the range of your offensive Balance spells by 20% **and improves your chance to hit by 4%**", declared as one `positioning` entry reading "Range, and nothing here has a position". True of the first clause, silent about the second |
| **The spell miss floored at 0, not 1%** | so the cap was 17 and the seventeenth point still bought something |
| **Serpent Sting could not miss** | it declared `ranged-special` and applied its aura unconditionally -- the only DoT in the project that never rolled |

**A `scope` IS THE WORST PLACE FOR A CLAUSE TO GO MISSING.** It is permanent by
design, so Nature's Reach was counted as RULED OUT rather than as a live gap: the
census that exists to find unfinished work had nothing to report, and 4% hit went
missing on all three Druid profiles for the life of the talent. **The Druid's
live-gap count did not change when this was fixed** -- 2 before, 2 after -- which
is exactly the problem. Classic's Nature's Reach is range and nothing else, which
is why the name and the first clause agreed with each other and with nothing else.

| Profile | was | now | |
| --- | --- | --- | --- |
| Cat | 716.4 | **749.7** | +33.3 REAL -- 4% melee hit |
| Moonkin | 494.0 | **516.8** | +22.8 REAL -- 4% spell hit |
| Bear | 488.5 | **494.8** | +6.3, inside its own interval and mechanically real |
| Shockadin | 583.6 | **581.2** | -2.4 -- the floor, see below |
| LW Ranged | 482.1 | **486.5** | +4.4, and NOT a gain. See below |
| BM Hunter | 595.8 | **595.7** | -0.1, the same |

**THE FLOOR WAS ALREADY LOAD-BEARING AND A PROBE SAID IT WAS NOT.** Hit reaches a
spell along TWO routes -- the character-wide `hitChance` stat, folded in by
`attackChances`, and a SCHOOL-scoped `hitBonus` folded in later by
`withModifier` -- so the floor is carried ON THE TABLE as
`AttackChances.missFloor`, where both respect it. Checking the STAT alone said no
profile was over 16% and the floor was a guard for the future; the SHOCKADIN
takes Divine Precision for +12% Holy hit on top of 6% from gear, which is 18
against a 17% miss, so its Holy spells could not miss at all. **A cap nobody has
reached is still the wrong cap, and "nobody" depended on which route was
measured.**

**THE TWO HUNTERS MOVED AND NEITHER MOVE IS A GAIN.** Serpent Sting now draws a
random number it did not draw before, which re-sequences every roll after it in a
seeded run -- so both figures are inside their intervals and the mechanism can
only ever REDUCE the sting's damage. Measured directly rather than inferred: over
twenty seeds it now lands 98.7% of casts on LW Ranged and 96.4% on BM Hunter,
where before it landed 100%.

**AND THEN OMEN OF CLARITY, WHICH IS WORTH EVERYTHING TO ONE DRUID AND NOTHING TO
THE OTHER TWO.** Every Druid learns it at 20 and none spends a point on it, so it
is registered by `reactionsForClass` beside Windfury Weapon rather than as a
talent proc. The owner supplied all three numbers and the tooltip states none of
them: **4% per spell or attack, doubled in Moonkin form, ten second internal
cooldown.**

| Profile | was | now | | procs a fight |
| --- | --- | --- | --- | --- |
| Cat | 749.7 | **795.3** | **+45.7 REAL** | 2.05, all spent |
| Bear | 494.8 | **498.0** | +3.2, inside its interval | 1.45 |
| Moonkin | 516.8 | **513.4** | -3.4, inside its interval | 1.50 (8%) |

**ONLY THE CAT IS RESOURCE-BOUND, WHICH IS THE WHOLE EXPLANATION** -- and it is
the same finding King of the Jungle produced on the same build. The Cat's entire
fight budget is about 690 energy, so two free 42-energy Shreds are +12% of it.
The Moonkin finishes with **29% of its mana income unspent** and the Bear is rage
rich, so a free cast there saves a resource they already have spare. **A correct
proc can be worth zero**, and the mechanism is what says it works: 1.50 and 1.45
procs a fight, every one of them spent.

**THE TWO SMALL FIGURES ARE RE-SEQUENCING, NOT EFFECT.** `canTrigger` rolls on
every landed attack, which reshuffles every subsequent roll in a seeded fight --
so for the Bear and the Moonkin the proc's own dice swamp what the proc is worth.
Read the procs column, not the DPS column.

**AND THEN TWO DEFENSIVE TALENTS, ONE WITH THE WRONG INDEX AND ONE WITH THE
WRONG RULE.** Both reported by the ruleset owner, and both confirmed:

| | |
| --- | --- |
| **Feral Swiftness gave 30 dodge, not 4** | "increases your movement speed while in Cat Form by {0}%, and increases your chance to Dodge by {1}%" -- `[30, 4]` at rank 2, no `valueIndex`, so it granted the MOVEMENT SPEED. The FOURTH value-index bug in this class |
| **Thick Hide was 3% of item armor** | it is "{0} additional base Armor per LEVEL and another {1} base Armor for each point of defense skill beyond five times your level" -- 54 armor against a correct **274** |

**ONE WAS THE WRONG INDEX AND THE OTHER THE WRONG RULE, AND THE SECOND IS
QUIETER.** A wrong rule ignores both indices equally, so there is no wrong index
for an index sweep to find; what found it was reading the tooltip beside the
declaration. Thick Hide needed two UNITS rather than two rules -- `statFromLevel`
and `statFromStat` both default to reading their value as a percentage, and now
take `scale: 1` for a talent stating a multiple.

**AND `statFromStat` TURNED OUT TO READ MORE THAN IT SAID.** It was documented
and tested as primaries-only because "the derivation is handed resolved
primaries" -- and `StatBlock` hands it the whole FIRST PASS, every stat resolved.
The real constraint is that nothing the derivation PRODUCES may be read by it, so
`defenseSkill` is safe and the test checks that property across all nine classes
instead of listing five stat names.

| Profile | was | now | |
| --- | --- | --- | --- |
| Bear | 514.4 | **523.1** | **+8.7** |
| the other 23 | | | **+0.0** |

**THE CAT DID NOT MOVE BY A DECIMAL AND TAKES FERAL SWIFTNESS AT RANK 2.** Its
dodge fell 45.95% to 19.95% and nothing attacks it, so 26 points of avoidance are
worth exactly zero -- which is the containment check that this commit reaches
only what it should.

**THE NET IS TWO MECHANISMS PULLING OPPOSITE WAYS, SO THE PAIR WAS MEASURED**
(`python tools/thick_hide_attribution.py`), with the Bear's armor, dodge, deaths,
damage taken and rage beside each figure:

| variant | armor | dodge | deaths | taken | rage | DPS |
| --- | --- | --- | --- | --- | --- | --- |
| both, as committed | 2870 | 19.45% | 13.69 | 275129 | 750 | **523.1** |
| without the dodge index | 2870 | 45.45% | 8.60 | 181443 | 671 | 516.9 |
| without the armor rule | 2650 | 19.45% | 13.87 | 282434 | 751 | 524.8 |
| neither | 2650 | 45.45% | 8.63 | 185385 | 669 | **514.4** |

The last row reproduces the published 514.4 to the decimal, which is the
cross-check the Cat probe learned the hard way. **Feral Swiftness is +10.4
isolated** -- 26 fewer points of avoidance, 52% more damage taken, 61% more
deaths, 82 more rage -- **and Thick Hide is −1.7 marginal and +2.5 isolated,
inside the interval both ways.**

**A PREDICTION IN THREE COMMENTS AND A TEST WAS WRONG, AND THE RULE THAT
FALSIFIED IT WAS ALREADY WRITTEN DOWN.** They said "more armor means less damage
taken means less rage, so the Bear's DPS falls". **Armor does not reduce rage** --
it comes off the PRE-ARMOR figure, which `resourceRules.ts` states in those words
and CLAUDE.md repeats. Measured: rage 751 to 750. All four have been corrected to
what the measurement shows.

**AND THE CENSUS MOVED WITHOUT THE LIVE-GAP COUNT MOVING.** Feral Swiftness's
movement-speed clause is `positioning` and was simply not declared, so the talent
sat in the `Fully` column -- the one column nothing re-reads -- while its only
live clause had the wrong index. The Druid is **29 fully, 6 partly, 14 ruled out,
2 live gaps**, the same two shapeshifting talents as before.

**AND THEN FOUR THINGS ON THE CAT, TWO OF THEM A SECOND CLAUSE NOBODY READ.**
The ruleset owner reported all four; what each turned out to be:

| | |
| --- | --- |
| **Primal Fury gave a Cat nothing** | its row holds THREE numbers and a single `reaction` read index 0. The whole second clause -- "your non-periodic critical strikes from Cat Form abilities that generate Combo Points have a 100% chance to add an additional Combo Point" -- was absent, and the talent reported itself FULLY MODELLED |
| **Rend and Tear read ~1.025x where ~1.09x was expected** | scoped to `melee-special` and non-periodic, on the reading "melee ABILITIES" invites |
| **Rake's DoT tick scaled at 1%** | the owner has since given it as 5.5%; the HIT stays at 1% |
| **Clearcasting went wherever the list reached** | about a third of the procs paid for Rake and Rip instead of Shred |

**THE OWNER'S FIGURE SETTLED A WORDING QUESTION THE WORDING COULD NOT.** With the
target bleeding 89.3% of the fight, the three readings of Rend and Tear measure
**x1.0296**, **x1.0612** and **x1.0948** -- and the first and last are the 1.025
reported as the symptom and the 1.09 reported as the expectation, to the decimal.
So it reaches every point of melee damage, and **Rip raises Rip**: a bleed's own
ticks are amplified by the bleed being up, which is the self-reference the narrow
reading was partly chosen to avoid, and the owner's figure includes it.

| Profile | was | now | |
| --- | --- | --- | --- |
| Cat | 795.3 | **937.7** | **+142.4 REAL** |
| Bear | 498.0 | **514.4** | **+16.4 REAL** |
| the other 22 | | | **+0.0** |

**THE CAT'S SPLIT, AS MARGINAL VALUES against the full build** -- each is what
removing that one change costs with the other three present:

| | Cat | Bear |
| --- | --- | --- |
| Rend and Tear widened | **+61.0** (autos 27.4, ticks 33.6) | **+16.4** (autos 9.5, ticks 6.9) |
| Primal Fury's combo points | **+45.1** | — |
| Rake's 5.5% tick | **+43.7** | — |
| Clearcasting always on Shred | +6.3, inside the interval | — |

**THEY SUM TO MORE THAN THE TOTAL AND THAT IS NOT AN ERROR**: 156.1 against
+142.4, because the marginals overlap -- Rake's bigger ticks and Rip's ticks both
collect Rend and Tear, so removing either alone understates what they share. The
Rend and Tear halves ARE exactly additive within themselves, 27.4 + 33.6 = 61.0
and 9.5 + 6.9 = 16.4, and the Bear's "as it shipped" variant reproduces its old
498.0 to the decimal -- which is the cross-check that Rend and Tear is the only
one of the four that reaches the Bear.

**THE PROBE WAS WRONG TWICE BEFORE IT WAS RIGHT**, and both times the tell was
arithmetic rather than a failure. It first reverted only the `tables` list and not
the fold in `damage.ts`, leaving the tick half in its own baseline; then it
reverted the fold with a one-shot string replace, and
`bleedingTargetModifier(request, request.attackTable ?? request.critFrom)`
appears TWICE in that file -- the crit fold and the damage fold -- so it patched
the inert one and two variants came back identical to the decimal. **Two variants
that agree exactly are a patch that did not apply.**

**A BALANCE OBSERVATION RATHER THAN A BUG: the Cat is now 40% clear of the next
profile**, 937.7 against DW Fury's 667.5, and 82% above the Bear. Every one of
the four levers is a figure the owner stated, so nothing here is a guess -- but
the spread across the 24 is much wider than it was and that is worth a look.

**AND MOONKIN FORM HAS NO UNMODELLED CLAUSE LEFT.** Its last one read "Omen of
Clarity's trigger chance is doubled, and Omen of Clarity is not declared ... so
there is no proc here for this to double" -- true when written, and specific
enough to point straight back here the day the proc landed. The Druid census was
**30 fully / 5 partly / 14 ruled out / 2 live gaps** at this point, and declaring
Feral Swiftness's positioning clause later moved one talent from `fully` to
`partly`.

**AND THEN AN OFFICIAL SOURCE REVISED DEEP WOUNDS AGAIN, THREE BULLETS, AND TWO
OF THEM WERE ALREADY RIGHT.** "Deep Wounds compared to Vanilla now: rolls over
its damage when refreshed; doesn't reset its tick timer when it is refreshed;
doesn't scale with Attack Power."

| Bullet | State |
| --- | --- |
| rolls over its damage | **already done** -- the pool, above |
| doesn't reset its tick timer | **already true, BY ACCIDENT.** `refresh` cancels and reschedules the EXPIRY and never touches `tickHandle`. Nothing asserted it, so nothing would have caught the day it changed; measured and pinned now |
| **doesn't scale with Attack Power** | **wrong here.** The pool read the universal weapon formula, base + (speed / 14) x AP |

**IT IS A LARGE NERF: 2H Arms -46.7, DW Fury -61.7, Prot Warr -18.7, all REAL**,
and it nearly cancels the pooling gain. Net across the whole Deep Wounds pass,
against the figures before any of it: 2H Arms **-3.5**, DW Fury **+0.3**, Prot
Warr **-12.0** (of which -4.7 is Thunder Clap). So the bleed was being paid twice
over -- once by rolling nothing over, and once by scaling with attack power --
and the two errors had been hiding each other.

**TWO CLOCKS, AND ONLY ONE RESETS.** The owner says the DURATION restarts at
twelve seconds; the official note says the TICK TIMER does not. Both hold: the
window re-opens while the ticks keep their cadence, so a refresh one second after
a tick still ticks one second later.

**AND A TEST HAD BEEN INSISTING ON THE BUG.** `talentReactions.test.ts` computed
its expectation from the weapon formula WITH attack power, and its comment said
it did so "so the test would catch the aura scaling by attack power twice". It
caught the wrong thing: scaling it once was already one time too many. A test
that pins the wrong rule defends it.

**THUNDER CLAP TAKES ITS CRIT FROM THE SPELL TABLE**, by the ruleset owner, and
it moved Prot Warr 480.4 to **475.7, -4.7** -- the only profile that casts it.
Its crit rate goes 17.7% to 4.9%, because the warrior's spell crit is 10% against
24.4% melee and both are suppressed against a level 63 target.

**ONLY THE CRIT MOVED, AND THAT WAS A DECISION.** `attackTable: 'spell'` would
have been a one-word change and brought something nobody asked for: spell miss is
flat where `missFromSkill` gave Thunder Clap almost none, so **0.9% avoided became
9.4%** -- a melee ability missing ten times as often off a sentence about critical
strikes, for a net -5.4 rather than -4.7. Every clause of the ruling is about
crit, so `DamageRequest.critTable` moves the crit chance and multiplier and
leaves miss, dodge and parry where they were.

**TWO OF THE THREE EXCLUSIONS WERE FREE AND ONE WAS NOT.** Cruelty is a
`critChance` stat, so the spell table cannot see it. Crit from AGILITY is a
vacuous exclusion -- there is no agility-to-crit conversion in this engine at
all, which `baseStatTypes.ts` states outright. **Weaponmaster needed real work**:
its axe/polearm crit was an `ALL_ABILITIES` ability modifier, which reaches any
ability with an id whatever table it uses.

**AND FIXING WEAPONMASTER FOUND IT WRONG IN BOTH DIRECTIONS.** `ALL_ABILITIES`
reaches no AUTO ATTACK, because a swing carries no ability id -- and "gives your
melee weapon attacks a benefit" plainly includes swings, which are the largest
source on every Warrior profile. Scoped to `melee-auto` and `melee-special` now,
which draws the line the tooltip draws and excludes Thunder Clap for the right
reason. It measures as nothing today: the talent needs an axe or a polearm and
every weapon in every Warrior gear set is a sword.

**DEEP WOUNDS MOVED ALL THREE WARRIORS, AND IT IS THE LARGEST SINGLE CORRECTION
SINCE THE PRIORITY LISTS.** 2H Arms 624.6 to **667.8 (+43.2, REAL)**, DW Fury
667.2 to **729.2 (+62.0, REAL)**, Prot Warr 469.0 to **480.4 (+11.4)**. The other
twenty are identical to the decimal.

**THE RULESET OWNER STATED THREE CLAUSES AND ALL THREE WERE WRONG**: it could
crit, it ticked every three seconds rather than every two, and a re-application
reset the clock and DISCARDED the undelivered damage instead of rolling it over.

**THE ROLLOVER IS NEARLY THE WHOLE OF IT**, and the reason is a rate argument
rather than a damage one. Deep Wounds refreshes on every melee crit, which for
these builds is far more often than once every twelve seconds -- so under
`refreshBehaviour: 'reset'` alone, most of each application's damage was thrown
away before it could tick. Rolling the remainder forward means every crit's worth
eventually lands, and in steady state the bleed delivers one application per crit
instead of a fraction of one.

| Clause REMOVED from the finished build | 2H Arms | DW Fury | Prot Warr |
| --- | --- | --- | --- |
| **the rollover** | **-43.9** | **-68.5** | **-12.8** |
| **"it cannot crit"** (so: crit restored) | +18.8 | +30.9 | +10.5 |
| the two-second cadence (back to three) | -2.4 | -3.1 | -1.3 |

**THEY DO NOT SUM, AND THAT IS THE POINT OF MEASURING THEM THIS WAY.** Each row is
that clause taken OUT of the finished build, so it is worth what it contributes
in the presence of the others -- and the three interact hard, because the crit
multiplier scales whatever the pool is delivering and the rollover decides how
much that is. -43.9 + 18.8 - 2.4 is +27.5 against an actual +43.2; reading the
rows as independent terms would be wrong by a third.

**THE CADENCE IS ALMOST FREE**, which is worth knowing: six ticks of a sixth and
four ticks of a quarter deliver the same pool over the same twelve seconds. What
the faster cadence buys is only that the pool drains sooner, which matters a
little once refreshes are topping it up.

**AND "IT CANNOT CRIT" IS AN EXCEPTION TO A DOCUMENTED UNIVERSAL RULE.** CLAUDE.md
states "Every DoT can crit, and none is reduced by armor. A Forever rule, not
Classic's", and that still holds for every other DoT. Deep Wounds is the owner's
named exception, and the reason is legible: the bleed is the PRODUCT of a critical
strike, so critting again pays the same roll twice. It is the only clause here
that costs damage, and it costs 19 to 31.

**WINDFURY WEAPON IS NOT WINDFURY TOTEM, AND IT WAS MODELLED AS THOUGH IT WERE.**
Enh Shaman 604.0 to **625.8, +21.8, REAL**, and the other twenty-two profiles
identical to the decimal. The ruleset owner separated the two effects on
2026-10-07: the imbue "grants 2 extra SPECIAL attacks with the rank's added
attack power", which differs from the totem in four ways, and the borrowed
implementation got every one of them wrong.

| | What the totem does, and the imbue was doing | The imbue's own rule | Worth |
| --- | --- | --- | --- |
| the attacks | an extra SWING, on `melee-auto` | **SPECIAL** attacks, `melee-special`: two rolls and **no glancing blow** | **+15.8** |
| the attack power | +466 as a 1.5-second AURA | **folded into the hits themselves** | **+18.8** |
| the swing timer | `extraAttack` restarts the slot | **not reset** | ~1 extra swing a fight |
| the report | counted as "Main Hand Auto-Attack" | **its own row** | 15.9% of the build |

**THE FIRST TWO COMPOUND: +31.6 TOGETHER against +34.6 apart**, because a
glancing blow was reducing the bonus attack power as well as the weapon damage.
The net is +21.8 rather than +31.6 because the old window also paid an ordinary
swing or a Stormstrike that happened to land inside it, which partly compensated
for everything else it got wrong.

**AND THE ROW WAS 15.9% OF THE BUILD, HIDING INSIDE THE AUTO-ATTACK LINE.** A
swing is reported as "Main Hand Auto-Attack", so the auto-attack row carried 34
attempts a fight on a weapon that cannot swing more than about 20 times -- the
second-largest damage source in the build, invisible, with the shares summing to
a tidy 100%. **It is "Windfury Attack" now and the imbue keeps its own name**:
`abilityBreakdown` builds one row per NAME and takes `uses` from casts, so
sharing the name produced a single row reading ONE USE and nine ATTEMPTS.

**MAELSTROM WEAPON WAS ASKED ABOUT IN THE SAME MESSAGE AND IS CORRECT.**
`tools/maelstrom_probe.ts` counts the rolls per source against the chance the
weapon's base speed implies: auto-attacks 31.2%, Windfury attacks 32.6%,
Stormstrike 30.7%, against 31.67% for a 3.80-second weapon at 5 PPM. All three
roll, none is missing. The bolt count is low because the ARITHMETIC says so --
about 35 melee uses a minute at 31.67% is 11 procs a minute, and five stacks buy
one bolt -- so 1.7 casts a fight is what 5 PPM means here, not a broken trigger.

**FLURRY'S TRIGGER MOVED ONE PROFILE, AND IT IS A RULING RATHER THAN A FIX.**
Enh Shaman 593.5 to **604.0, +10.5** -- inside the two runs' combined interval, so
the harness calls it noise, but the direction and cause are certain because a
mechanism was switched on rather than a number nudged, and 604.0 reproduced
exactly across two independent worktrees.

**THE CAUSE IS THAT TWO CLASSES SHARE ONE REACTION BUILDER.** Flurry gated on
`isWeaponUse`, which refused crits carrying no weapon slot; the owner ruled it
fires on ANY non-DoT critical strike. For the Warrior that reaches only Thunder
Clap, Intercept and Charge -- none of which DW Fury's list casts, so all three
Warriors are +0.0. **Enhancement Shaman takes its own Flurry and imports the
Warrior's builder**, and a Shaman crits with Lightning Bolt, Flame Shock and
Earth Shock, so there the same breadth is worth real damage.

It shipped NARROW for the Shaman for exactly one PR, because the ruling had been
given while reading a Warrior profile and extending it to another class was an
inference. The owner then ruled this class too. **Both tooltips still say "after
dealing a MELEE critical strike"** -- the override is deliberate and now in two
places at once. The lesson is the sharing: a change to a reaction two classes
import has to be MEASURED on both, and this one would have shipped as an
unexplained +10.5 on a class nobody was looking at.

**THE WARLOCK DEEP DIVE MOVED FIVE PROFILES AND ONE OF THEM A LONG WAY DOWN.**
**Firelock 535.5 to 468.4, -67.1, REAL** -- a CORRECTION, and the four causes were
each carrying a comment admitting what they did:

| | |
| --- | --- |
| **-42.2** | **Shadow and Flame**, whose two halves name OPPOSITE schools on purpose. Both were whole-character multipliers, so a hybrid held x1.10 TWICE ON EVERY SCHOOL where the talent gives x1.10 once per school. Its comment read "generous for a hybrid, which Firelock is" |
| **-13.1** | **Demonic Sacrifice**, whose Succubus option is "+15% FIRE damage". Whole-character too, so the 22% of Firelock that is Shadow collected a fire bonus. Its comment read "exact for either profile" -- true of SM/DS, not of this one |
| **-4.8 / -3.3** | **Agonizing Flames and Ruin**, both "your DESTRUCTION spells" read as Fire and Shadow -- the two schools a Warlock HAS, which is every spell it owns. So both also raised Corruption, 13.5% of the profile |

**AND THE OTHER DIRECTION: SM/DS 349.1 to 363.9, +14.8, REAL**, all of it Pandemic,
plus **+2.6 to +3.2 on all three Rogues** from Lethality. Those two talents wanted
the IDENTICAL missing declaration and both said so in almost identical words; one
`abilityCritDamage` effect reached both. **The other eighteen profiles are
identical to the decimal.**

**TWO LESSONS, AND THE FIRST IS THE EXPENSIVE ONE.** A clause that cannot be
expressed per school is not therefore worth applying whole-character with a
caveat -- "generous for a hybrid" was 42 DPS. And **a TREE is not a SCHOOL**:
Shadow Bolt is a Destruction spell in the source's own spellbook tab, which is the
entry the school reading gets wrong. See
[docs/handoff/warlock.md](docs/handoff/warlock.md).

**EVERY LIST IS THE RULESET OWNER'S OWN**, specified entry by entry; what was here
before was this project's guess and said so.

**ALL 24 RE-MEASURED IN ONE RUN, so these are comparable with each other rather
than each being the figure from the dive that last touched it.** The newest is
**Hemo**, a fourth Rogue profile from the owner's own talent URL.

**AND THE TABLE IS REBUILT BY A SCRIPT NOW RATHER THAN EDITED A ROW AT A TIME.** It
parses its own rows for each profile's class and talents, takes the DPS from the
measurement and derives the ordering, then asserts that the profiles it measured and
the profiles the table carries are the same set.

**THAT IS HERE BECAUSE THIS TABLE HAS GONE WRONG THREE TIMES.** Four rows were once
stale with nobody having touched them -- Cat 703.8, Combat 524.2, Venom 494.9 and
Rupture 450.3 were each correct the day they were written and had since been moved
by a dive on another branch. A row-at-a-time edit goes wrong silently, because every
individual figure has a commit behind it and looks defensible on its own. Adding
Hemo moves five rows between the two columns, which is exactly that kind of edit.

**AND IT HAS NOW CAUGHT THE FOURTH, WHICH NO HUMAN WAS GOING TO SEE.** A rebase
auto-merged two versions of this table -- one that had moved the Shadow Priest
into the left column at 597.9, and one that still had it in the right at 516.4 --
and git took BOTH rows cleanly, dropping Shockadin to keep the row count. The
result was twenty-four rows carrying twenty-three profiles, one of them twice at
two different figures, with no conflict marker and nothing misaligned. **The
set assertion is what failed**: "in the map, not in the table: ['Shockadin']".
A table where every row is individually plausible is precisely what a reader
cannot audit, which is why the check is a SET comparison and not a row count.

| Profile | Class | Talents | DPS | | Profile | Class | Talents | DPS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Frostfire Mage | Mage | 0/29/22 | 947.2 | | Moonkin | Druid | 38/0/13 | 724.0 |
| Seal Twist Ret | Paladin | 13/0/38 | 886.9 | | 2H Arms | Warrior | 38/13/0 | 721.5 |
| Fire Mage | Mage | 10/39/2 | 874.1 | | Combat Rogue | Rogue | 18/33/0 | 691.1 |
| LW Ranged | Hunter | 7/39/5 | 805.9 | | SM/DS | Warlock | 40/11/0 | 690.4 |
| DW Fury | Warrior | 18/33/0 | 790.4 | | Shockadin | Paladin | 23/0/28 | 682.0 |
| LW Melee | Hunter | 7/13/31 | 787.7 | | Hemo Rogue | Rogue | 17/3/31 | 622.4 |
| BM Hunter | Hunter | 31/20/0 | 771.7 | | Ele Shaman | Shaman | 38/13/0 | 617.5 |
| Cat Druid | Druid | 9/35/7 | 770.0 | | Venom Rogue | Rogue | 37/12/2 | 600.8 |
| Arcane Mage | Mage | 47/4/0 | 769.4 | | Rupture Rogue | Rogue | 12/8/31 | 584.2 |
| Firelock | Warlock | 5/11/35 | 759.7 | | Prot Warr | Warrior | 17/0/34 | 499.3 |
| Shadow Priest | Priest | 13/3/35 | 746.9 | | Bear Druid | Druid | 9/42/0 | 490.5 |
| Enh Shaman | Shaman | 19/32/0 | 727.2 | | Prot Pally | Paladin | 8/36/7 | 355.4 |

**THE TOP IS THE FROSTFIRE MAGE NOW, AND THE TABLE RE-SORTED AROUND THE
CASTERS.** **947.2 +/-15.6** against Seal Twist Ret's **886.9 +/-8.8** is 60.3,
outside both intervals -- and Seal Twist Ret had held the top since the Cat lost
it. Four of the top six are casters where none was in the top six a commit ago.

**TWO CHANGES MOVED EVERY ROW, ONE AFTER THE OTHER, AND NOTHING RECORDED BEFORE
EITHER IS COMPARABLE.** The armour enchants were +2.4 to +53.7 on a mean of
+27.0; the consumables were +40.0 to +249.3 on a mean of **+105.9**.

**THE SPREAD IS THE WHOLE STORY OF THE SECOND ONE, AND THE OWNER HAS CONFIRMED
IT IS INTENDED** -- "casters *should* have moved more". A caster's row reaches 254 school-blind spell
power -- the Flask's 150, the Weapon Effect's 36, the Spell Power elixir's 35
and the Food's 33 -- plus 40 more on its own school, 1% spell crit and 25
intellect. On roughly 500 base that is about +57% spell power, and the casters
moved +133 to +249 accordingly. The melee rows have no equivalent: the biggest
single entry they can take is 40 attack power, which is a far smaller share of
what they already carry. **Two tanks and the two ranged Hunters moved least**,
and both tanks for the reason their rows name: a tank spends its categories on
armor and hit points. The two ranged Hunters moved least of the damage builds
because neither Weapon Effect reaches a bow and a Hunter shot carries no spell
coefficient -- **the Attack Power elixir does reach them**, which it did not in
the first version of this change and which is the owner's ruling.

**THAT RULING IS THE ONE PLACE A `noise` VERDICT IS WRONG HERE.** Giving the two
ranged Hunters forty ranged attack power measured +8.0 and +9.5, and the harness
calls both noise against their own intervals -- while the mechanism is
deterministic and exact: forty points on about seventeen hundred. Every OTHER
row moved by **0.0 to the decimal**, which is the containment check saying the
elixir reached the bow and nothing else.

**THE PER-PROFILE ROWS ARE CHOSEN, NOT STATED.** The owner supplied the
catalogue and no per-profile table, and asked for a sensible row on each; the
selections follow one written-down rule and are the first thing an owner table
would replace. See `consumables.ts`.

**AND THE RANKING MOVES WHERE THE ARITHMETIC DOES NOT.** Arcane sits above
Shockadin and Combat above the Shadow Priest on gaps well inside either
interval -- `update_baseline_table.py` sorts on the figure and the figure does
not know that. Read the intervals before reading the order.

**THE PARAGRAPH HERE SAID THE OPPOSITE AND HAD BEEN STALE FOR SEVERAL
COMMITS** -- "Seal Twist Ret 709.0 +/-9.4 against Cat 703.8 +/-6.4 is a gap of
5.2 inside both intervals" -- while the table above it read 937.7 and 748.3. Both
figures had been moved by dives on other branches and the prose was never
re-read. **A CAVEAT ABOUT TWO NUMBERS GOES STALE WHEN EITHER MOVES**, and it is
worse than a stale number because it tells a reader not to trust a ranking that
is now real. The underlying warning is still worth keeping, which is why it is
rewritten rather than deleted: the top of this table HAS changed hands twice
without anybody measuring a difference, so check the intervals before calling
anything the best profile.

**AND IT CHANGED HANDS AND BACK IN ONE DAY, WHICH IS THE POINT.** Cat read 737.5
for the length of one pull request, and a note here said the gap to Seal Twist Ret
was "28.5 outside both intervals -- the first time the top of the table has been a
measurable difference". That was true of the formula in the tree at the time, the
owner then corrected the formula, and Cat went back to 703.8. **A note declaring
that an ambiguity has finally been resolved is the one most worth dating**, and it
survived exactly one commit.

**EVERY FIGURE HERE IS RE-MEASURED IN ONE RUN RATHER THAN ADJUSTED, and that has
now earned its keep twice in two days.** Once on a clean rebase of two branches
that had each moved this table and each written a figure the other invalidated --
git had nothing to complain about, because they touched different entries in the
same file. And once on the flat-damage revert, where **the three profiles that
moved back are exactly the three that had moved**, to the decimal in both
directions: Cat 703.8, Rupture 455.0, and Venom up rather than down because its
Mutilate is the one fraction below 1.

**WHAT THE OWNER'S LISTS WERE WORTH, against the last figures measured on this
project's own shells:**

| | |
| --- | --- |
| SM/DS +55.9, Enh Shaman +46.2, Cat +43.9 | the three largest, and the first two are the two weakest casters |
| Frostfire +36.7, Shockadin +36.4, Ret +27.2, Moonkin +25.1, Bear +22.1, Ele Shaman +16.4 | |
| Venom −24.3 | its Eviscerate's two aura-duration floors, isolated at −20.4. The Venom entry itself is +17.7 |
| BM Hunter −11.6, Shadow −10.8, Prot Pally −5.6 | Shadow is Shadow Word: Death coming out, isolated at −35.7 against +24.9 for the rest of the list. Prot Pally is Righteous Fury and Templar's Bulwark costing global cooldowns for nothing modelled |
| **LW Melee −237.1** | two separate things. −100.6 from Raptor Strike becoming on-next-swing, which its capture stated all along, and −136.6 from the list dropping Serpent Sting, Arcane Shot and Rapid Fire while adding Hunter's Mark |

**THE SPREAD NARROWED AND THE MEAN DID NOT.** 408.5 to 410.1 across 23 profiles,
because LW Melee absorbed most of what the other twenty-two gained.

**BEFORE THE LISTS, POISONS WERE THE LAST THING TO MOVE THESE, AND ONLY THE
ROGUES MOVED.**
Venom +25.5%, Rupture +16.2%, Combat +8.4%, and all twenty other profiles
identical to the decimal -- which is the containment check for a change that
adds a whole system rather than touching a shared rule.

Before that, normalisation and the Druid paw formula moved twelve, and the
coefficient sheet before them moved nineteen. **Every Rogue figure recorded
before poisons existed was a floor**, because the Venom build spends eleven of
its fifty-one points on them.

**THE CHECK IS THAT THE PROFILES A CHANGE SHOULD NOT REACH DO NOT MOVE BY A
DECIMAL**, and it wants naming per change rather than a fixed list. For anything
in the physical-damage path it is the eleven pure-melee profiles — both Warriors,
Prot Warr, all three Rogues, Cat, Bear, and LW Melee; for a spell change it is
those plus the ranged Hunters. Run all 23 every time and say which ones were
expected to move. The list used to read "all three Hunters" as pure melee, which
stopped being true the moment Sniper Shot became a cast.

**A caster figure is an estimate, not a floor.** All three reasons it used to be a
floor have expired: caster gear exists, spell power has a school, and the
coefficient rule arrived. What remains unmodelled for casters is ordinary content
— totems have no entity, Chain Lightning has no second target, Blast Wave's area
half lands on the one enemy there is — and each is listed per ability on the
results page.

**Two figures are understated by a known amount.** Cat and Bear hold the Glaive of
Obsidian Fury, whose "+172 Attack Power in Cat, Bear, and Dire Bear forms only"
cannot be expressed, because an item stat is not conditional on the combat style.

### The macro audit

**Every ability and damage source, across all 23 profiles, checked for whether it
is CONNECTED rather than whether its number is right.**
[docs/ability-audit.md](docs/ability-audit.md), `npx vite-node tools/ability_audit.ts`.

| | |
| --- | --- |
| **135** | abilities in at least one profile's book |
| **110** | exercised by at least one profile |
| **25** | cast by none of the 23, **each with a stated reason and none of them a broken declaration** |
| **9** | priority list entries that never fire, six of them deliberate. The ninth is Spearing Strike in the Berserker list, added by the Warrior dive — and it is the one `ability_audit.ts` itself cannot see, because the build does not have the ability |
| **23 of 23** | damage tables summing to **100%** |
| **0** | abilities that deal damage without responding to a stat (the coefficient probe's result) |

**THOSE LAST TWO TOGETHER ARE THE BILL OF HEALTH**: everything that deals damage
scales with something, and everything that deals damage is counted. The share
total is the one that is easy to overlook and hard to fake -- a source nobody
reports reads as a zero rather than as a gap.

**AND IT CORRECTED A DOCUMENTED INVARIANT.** Both handoff files claimed every
entry in every list fires; eight did, nine do now, and the claim was
contradicted two paragraphs below in the same file by the stance and shout
entries kept on purpose.

## Per-class deep dives

**Nine documents in [docs/handoff/](docs/handoff/), one per class**, each the
starting point for that class's own context window. Every one carries its
profiles and their baseline DPS, its talent census row, its live gaps with
reasons, its never-fired entries, its damage sources, the state of its SOURCES,
and the traps specific to it.

Their figures are re-derivable rather than asserted: `npx vite-node
tools/class_audit.ts <class>` prints the census, the gaps and the per-profile
structure, and throws if its four buckets do not account for every talent.

| Document | Profiles | Live gaps |
| --- | --- | --- |
| [warrior.md](docs/handoff/warrior.md) | 2H Arms, DW Fury, Prot Warr | **0** |
| [paladin.md](docs/handoff/paladin.md) | Seal Twist Ret, Shockadin, Prot Pally | **2** |
| [druid.md](docs/handoff/druid.md) | Moonkin, Cat, Bear | **2** |
| [rogue.md](docs/handoff/rogue.md) | Venom, Combat, Rupture | **3** |
| [shaman.md](docs/handoff/shaman.md) | Ele Shaman, Enh Shaman | **6** |
| [hunter.md](docs/handoff/hunter.md) | BM Hunter, LW Ranged, LW Melee | **8** |
| [mage.md](docs/handoff/mage.md) | Frostfire, Arcane, Fire | **11** |
| [priest.md](docs/handoff/priest.md) | Shadow | **12** |
| [warlock.md](docs/handoff/warlock.md) | SM/DS, Firelock | **19** |

**THE WARRIOR'S 0 AGAINST THE WARLOCK'S 25 IS NOT A DIFFERENCE IN DIFFICULTY.**
The Warrior had four sources and eight of its numbers turned out wrong; the other
eight classes rest on `talentsforever.com` plus one `foreverchanges.pro`
cross-check. Read the Warrior's column as what a class looks like after the work,
not as a class that needed less.

## The milestone

**A full engine for WoW: Forever with all 23 profiles fully implemented — every
ability, spell, cooldown and talent NON-INERT, and every applicable spell and
ability carrying an attack power or spell power coefficient.**

Measured at `d2718b0`, and the numbers say it is not close:

| | |
| --- | --- |
| **64 of 468 talents are a live gap** | well down from a raw count of 251 unmodelled reasons, because 95 are permanently out of scope by ruling and 35 more are PARTLY modelled. See the census below, and **re-sum it rather than adjusting it** — the raw total is not a work queue. **The Warrior is at zero**, the first class to get there |
| **114 abilities declared against 478 captured** | the data is on disk; the declarations are not. Druid 15, Hunter 14, Mage 13, Rogue 12, Warlock 10, Shaman 9, Priest 7, Paladin 6, plus the Warrior's 27. **THE WARRIOR IS RECONCILED**, which is what the exclusion list below actually means: 42 captured against 30 declared counting its three stances, and each of the 12 that are not declared is named — 3 that Forever has and nothing here needs, 9 that are threat or crowd control by ruling. See [docs/warrior.md](docs/warrior.md). It is the only class where the subtraction balances |
| ~~**Coefficients**~~ | **DONE, AND NOW EVERY ROW IS APPLIED.** `WoWSimWorksheet.xlsx`, the owner's authoritative coefficient document, is transcribed in `src/game/combat/coefficients.ts` and applied across all nine classes. Every derived rule is deleted. The last unapplied row was Hammer of Wrath, which was not a declared ability until the owner put it in two Paladin priority lists; the two poison rows went the same way when the poison system landed. [docs/spell-coefficients.md](docs/spell-coefficients.md) |
| **9 `PLACEHOLDER_*` constants** | each a real number nobody has supplied. **COUNT THE DECLARATIONS, DO NOT ADJUST THE NUMBER**: `grep -rhoE "(export )?const PLACEHOLDER_[A-Z_]+" src/ \| grep -oE "PLACEHOLDER_[A-Z_]+" \| sort -u \| wc -l`. **THE COMMAND THAT USED TO BE HERE COUNTED MENTIONS AND OVER-COUNTED BY FIVE** -- a deleted placeholder leaves its NAME behind in the comment explaining what it used to be, and Combustion's duration, Maelstrom Weapon's chance, the pet's base DPS, the pet's swing and the old coefficient cast cap are all epitaphs rather than placeholders now. That is why this figure has been wrong three times: the instruction was right and its command was not. Sniper Shot's invented 200-mana cost is gone, but it was never one of these -- it was a bare literal with a false caveat, which is worse, because an invented number that is not named cannot be audited |
| ~~**Rotations are thin and unmeasured**~~ | **DONE.** All 23 priority lists are the ruleset owner's own, specified entry by entry, and every one is measured — see the baseline above and [docs/handoff-rotations.md](docs/handoff-rotations.md). The twelve dead entries of that round are gone; the nine that remain are listed in [docs/ability-audit.md](docs/ability-audit.md), each with a reason and none of them a broken declaration. Fourteen abilities and three talent mechanics were declared to reach them, and six engine capabilities built |

**The Warrior was built first and built properly, and it is not the norm.** Read
any claim about this project's depth as a claim about the Warrior until checked.
It is the only class with an owner spreadsheet, the only one documented in
`docs/` at all, and it carries 2,025 comment lines against 268–529 for every
other class.

### All nine classes are cross-checked

Against `foreverchanges.pro`, under the owner's standing rule that **where it and
our own capture disagree, it wins**. Full record, method and its two traps in
[docs/source-cross-checks.md](docs/source-cross-checks.md).

**NOT ONE CLASS CAME BACK CLEAN. Twenty-seven figures moved**, and **three more
on the Warrior's re-check** -- thirty. The exercise found three distinct kinds of
error, and the Warrior re-check added a FOURTH:

| | |
| --- | --- |
| **Source disagreement at the same build** | most of them, usually a few points. Both sources read 1.60.1.70009, so refreshing a capture settles nothing — which is why the standing rule was needed |
| **Build drift** | a figure that was right when written and is not now: Wrath 62–68 → 92–102, Holy Strike 40%/12s → 50%/10s, Life Tap doubled, and Mangle **renamed to Primal Bite**. **No amount of cross-checking finds these; only refreshing the captures does** |
| **Our own transcription** | Sniper Shot, wrong in four fields at once, with the answers in its own capture the whole time |
| **A source that is SILENT rather than different** | Spearing Strike's two-handed requirement is stated by two sources and omitted by the third, which is the one we had. An omission is not a denial, so the tie-break rule never applies -- the sources that speak decide it. **The same shape as Shadowburn's Soul Shard**, where `foreverchanges.pro` carries no reagent field at all |

The third kind is the one to fear. **Sniper Shot** read 160 damage, a 200-mana
placeholder, instant cast and a 6-second cooldown; its capture says 295, 365 mana,
a **4-second cast** and 15 seconds, and said so at both builds. The old comment
applied the rank-1 rule to a capture that is already max rank — a real rule, the
wrong artifact — and the placeholder's justification ("the spellbook gives no cost
line at all") was simply false.

**What moved most**: Prot Pally +13.5% and Seal Twist Ret +10.0% on Holy Strike's
doubling, Firelock +12.1% on Life Tap, and **LW Ranged −11.1%** on Sniper Shot
becoming a four-second cast.

**AND EIGHT CLASSES ARE NOW ONE REFRESH OLD.** The Warrior's re-check found
Slam's cooldown had gone 15 to 18 in ELEVEN DAYS, on the class with the best
sources in the project and against a figure the owner had confirmed personally.
Nothing in this repository moved; the game did. The other eight captures are all
at build 1.60.1.70009 and have not been re-fetched since 2026-09-25.
`node tools/import_forever_spells.mjs --all --write` is one command, and the
diff is where the change announces itself.

**THE LW RANGED PRIORITY LIST NOW NEEDS RE-MEASURING.** A cast resets the ranged
swing timer, which is the rule that removed Aimed Shot from that list at *two*
seconds. Dropping Sniper Shot measures **+7.9** on one run; it wants the full
30-batch method before it changes, and it is not changed yet.

**Ability numbers are done; TALENT VALUES have never been cross-checked at all.**
`src/data/talents/values/*.json` comes from `talentsforever.com` alone and has no
second source.

### The talent census

Every talent, classified from the DATA rather than from prose: an `unmodelled`
entry carries a `scope` when the owner has ruled the effect out, so a decision
and a gap can be told apart mechanically. `tests/game/outOfScope.test.ts`
enforces it, and a new class writing "nothing here moves" without the ruling
fails.

**AND THE HUNTER HAS NO UNRATIFIED READING LEFT.** Improved Tracking was the
last one: "while tracking <seven creature types>, all damage you deal to the
tracked creature type is increased" has always been applied as a flat bonus,
with an `unmodelled` entry saying so -- the flat reading ASSUMED the Hunter was
tracking what it was fighting. The owner ratified it on 2026-10-07 ("improved
tracking is correct, applied as a flat 5% damage bonus"), so the assumption is
a ruling and the caveat is gone. **No profile moves by a decimal**;
`conditionalDamage` has applied the rank's percentage since the talent was
written. What moves is the census, because **a caveat is the whole difference
between PARTLY and FULLY** -- Hunter 28 fully to 29, partly 5 to 4.

| Class | Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- | --- |
| Warrior | 53 | 43 | 4 | 6 | **0** |
| Paladin | 52 | 33 | 7 | 11 | **1** |
| Druid | 51 | 29 | 6 | 14 | **2** |
| Rogue | 53 | 32 | 6 | 12 | **3** |
| Shaman | 50 | 22 | 4 | 18 | **6** |
| Hunter | 50 | 29 | 4 | 9 | **8** |
| Mage | 54 | 30 | 2 | 12 | **10** |
| Priest | 53 | 20 | 2 | 19 | **12** |
| Warlock | 52 | 25 | 3 | 5 | **19** |
| **Total** | **468** | **263** | **38** | **106** | **61** |

**THE WARRIOR LEFT THE GAP COLUMN ENTIRELY**, and its last entry is worth
reading because of the shape rather than the size. Improved Berserker Rage's
reason was "grants rage when Berserker Rage is activated, and no priority list
casts Berserker Rage" — an argument about a LIST, filed where this project keeps
arguments about the ENGINE — while the number it needed, 5 and 10 by rank, sat in
`values/warrior.json` the whole time. **A reason that argues from a rotation is
not an engine gap**, and it read like one for as long as it existed.

**AND THE PALADIN LEFT IT ALMOST ENTIRELY, FOR A RELATED REASON SIX TIMES OVER.**
Eight talents left the column and **six were never in it**: Reckoning, Holy
Shield and Shield Specialization all rested on a rule that a reaction cannot fire
on a BLOCK, which the Warrior's own Shield Specialization, Revenge, Enrage and
Blood Craze have disproved since the attack table was written. Divine Favor's
reason was true of `CastModifier` and false of an aura's `abilityModifiers`;
Sanctified Judgement's wanted a cast reaction that already existed; and Templar's
Bulwark had been granted, cast and absorbing in full the whole time. **Only Divine
Precision needed a new engine field.** Read every reason that names an engine
limitation against the ENGINE, not against its own plausibility.

**SIX TALENTS LEFT THE GAP COLUMN WITH THE PRIORITY LISTS**, and four of them
were never really in it. Cutthroat and Premeditation were counted among the
eleven Rogue talents that stealth makes inert and are neither -- Cutthroat is an
in-combat proc whose whole purpose is to REMOVE a stealth requirement, and
Premeditation's Forever tooltip has no stealth clause at all. Preparation's
reason was a statement about the engine ("nothing can reset a cooldown from
content") and the engine now can. Fingers of Frost carried `FROZEN_UNMODELLED`,
which is a claim about the TARGET, and that talent does not freeze anything.

**300 of 468 talents do something**, 106 never will, and **62 are the actual
remaining work** — not the raw count of unmodelled reasons. The 129 scoped
entries break down as 37 crowd control, 36 healing, 21 positioning, 13 threat,
7 cast pushback, 6 stealth, 4 totem entities, **3 immunity and 2 dispel**.

**THE TWO NEWEST MEMBERS ARE THE OWNER'S, 2026-10-07**, and they came out of one
question. `guardian_s_favor`'s reason ended "whether an immunity that disarms you
belongs in scope is a question for the ruleset owner rather than a gap in the
engine" — and asking returned both rulings at once: **a dispel is out of scope,
and so is an immunity that also stops you attacking.** A reason that names the
question it is waiting on is what makes it askable; that sentence is the only
reason this was raised rather than sitting in the queue.

**AND THE IMMUNITY RULING IS THE FIRST THAT A CLASSIC READING WOULD HAVE APPLIED
TOO WIDELY.** Classic's Divine Shield stops you acting; **Forever's reduces all
damage you deal by 50% and lets you keep swinging**, so it is a real tank
cooldown and stays a live gap. Sweeping it in would have deleted a usable
ability and called the deletion a decision. The same check moved Ice Block the
other way: Forever's text says "you cannot attack, move, or cast spells", so it
IS covered and the Mage drops a gap it was never going to reach.

**THE TABLE ABOVE WAS ALSO STALE BY MORE THAN THIS CHANGE.** It read Rogue
31/5/14 and Mage 30/2/11 against a derived 32/6/12 and 30/2/12, on code nobody
touched for this PR — the same drift the Arcane row had. Every figure here is
printed by `npx vite-node tools/census.ts` rather than adjusted.

**EVERY FIGURE IN THIS SECTION IS RE-SUMMED FROM THE TABLE ABOVE RATHER THAN
ADJUSTED, AND THIS MERGE IS WHY.** The Warlock dive and the Warrior dive each
moved the total from the same base and each wrote its own answer; both also wrote
this warning, independently, which is how close the trap is to the surface. Two
branches moving a count by one from the same base both write the same number, git
merges them without a conflict, and the total is short by one.
`tools/class_audit.ts` prints one class and `tools/census.ts` prints all nine,
and **they share one classifier now** — `game/talents/talentCensus.ts`. They did
not: census.ts carried its own copy of the four-way rule which left out
`appliedElsewhere`, so the moment a clause of a working Rogue poison talent was
scoped the two tools disagreed about that talent and the published figure would
have been whichever was run last. Both throw if the buckets do not account for
every talent. **Run one rather than trusting this.**

**STEALTH IS THE NEWEST RULING AND IT CLOSED THE LARGEST OPEN QUESTION.** Every
fight opens in combat, so nothing is ever stealthed — and until the owner ruled,
that was an ENCOUNTER property rather than one of the rulings, which left six
Rogue talents counted as work nothing would ever reach. **The Rogue goes from 20
live gaps to 14 and stops being the second-largest queue in the project.** It
covers being stealthed, detecting it, and the openers that require it; it does NOT
cover an in-combat proc that REMOVES a stealth requirement, which is what
Cutthroat is and why Cutthroat is modelled.

The rulings, recorded in CLAUDE.md under **Scope**: positions, range, facing and
movement; crowd control; threat; and healing THROUGHPUT — but **mana RETURN is in
scope**, because it changes a damage profile's sustain, so a talent returning mana
is a live gap and gets no `scope`.

Two questions the census raises that the rulings do not answer:

- **Poisons and Venom both exist now**, so three of the Rogue's census gaps are
  closed: Vile Poisons, Improved Poisons and Venom all apply, the last stacking
  ADDITIVELY with the first by the owner's ruling.
  **VENOM IS IN NO PRIORITY LIST, BECAUSE IT MEASURES AS A LOSS** -- 415.2
  without it against 395.7, 398.0 and 400.1 at three placements, each outside
  its interval. A combo point is worth more on Eviscerate than a 30% bonus on
  the fifth of the build's damage that poisons supply. The mechanism is tested,
  so one line re-measures it the day a coefficient moves.
  **AND POISONS EXISTING OPENED A GAP THAT WAS CLOSED BY IMPOSSIBILITY.**
  Mutilate is "+20% against Poisoned targets" and its `unmodelled` reason used
  to be that no target here is ever poisoned. The Venom build now keeps Deadly
  Poison up for most of a fight, so that is a live 20% on the signature ability
  of the build that takes it, and it is not read. Left for its own PR because it
  moves a profile and wants a re-measured baseline. **A reason can expire
  without anybody touching the thing it is written on.**
- **Stealth and openers.** Eleven Rogue talents are inert because every fight
  opens in combat — Premeditation, Initiative, Improved Ambush, Cutthroat, Dirty
  Deeds, Camouflage, Opportunity and more. That is an encounter property, not one
  of the four rulings, and it is most of why the Rogue has the second-largest live
  count. **Worth asking whether an opener is in scope at all.**
- **Totems as entities.** Five Shaman talents need a totem to exist as something
  that acts on its own. That is the mid-fight-summon engine gap wearing different
  clothes, and it lands on an Elemental profile whose figure is short by whatever
  they are worth.

**The spell exclusion list is still to be proposed and approved** — 478 captured
against 113 declared. A stated exclusion list is what turns a vague "incomplete"
into a finite work list.

**THE WARRIOR NOW HAS ONE AND IT BALANCES**, which is the worked example for the
other eight: 42 captured, 30 declared, and the 12 that are not are named
individually — Victory Rush, Retaliation and Tactical Mastery, plus nine that are
threat or crowd control by existing ruling. Nothing is declared that the capture
does not have, which is the check in the other direction. Each class is one
`node tools/import_forever_spells.mjs <class>` and an hour of reading.

### Open engine gaps

| Gap | Talents | Classes |
| --- | --- | --- |
| ~~**Spell hit per school**~~ **BUILT.** `AbilityModifier.hitBonus`, taken off MISS because no table carries a hit chance, and folded by `combineModifiers` AND by `combine` — it was not folded by the second at first, so one source worked and two cancelled. The reason, that the table decides hit before any per-school modifier is consulted, was false: the school's modifier was already one of `combineModifiers`' three arguments. Divine Precision uses it; **the other four are a one-line effect each and belong to their own re-measured baselines** | ~~5~~ 4 | Mage ×2, Priest ×2 |
| ~~**Crit damage for a LIST of NAMED abilities**~~ **BUILT.** `abilityCritDamage` is the declaration `critMultiplierBonus` had been waiting for since Impale. Pandemic and Lethality both named the field in almost identical words, so it was built once: **+14.8 to SM/DS and +2.6 to +3.2 across the three Rogues** | ~~2~~ 0 | — |
| ~~**A per-school damage multiplier from an AURA**~~ **BUILT.** `damageDoneBySchool`, predicted by name in `game/auras/warrior.ts` before it existed. Demonic Sacrifice and Shadow and Flame were both whole-character with a caveat, and the caveat was **−55.3 DPS of Firelock** | ~~2~~ 0 | — |
| ~~**A periodic-only school vulnerability**~~ **BUILT.** `periodicDamageTakenBySchool`, which Wrack's own `unmodelled` reason named. A plain Shadow vulnerability would also have raised Shadow Bolt at half the SM/DS profile | ~~1~~ 0 | — |
| **A one-shot per-ability CRIT modifier** — and it is NOT `CastModifier`, which carries cast time and cost. An AURA's `abilityModifiers` carries a `critBonus`, spent by a CAST REACTION rather than by `consumedByCast`: cast charges are spent before `runCast`, so the aura would be gone before the spell rolled its crit. **Divine Favor does it now; the Priest's is the same shape** | ~~2~~ 1 | Priest |
| **A style-scoped item stat** — `statsForStyle` knows the combat style; the item rule does not | 1 item line | both feral Druids, 172 attack power |
| ~~**A flat per-school damage bonus**~~ **NOT A GAP, AND NOT FLAT.** Judgement of the Crusader's "up to 161" is spell POWER on the target, by the owner's ruling, so each ability scales it by its own coefficient. `AuraDefinition.spellPowerTakenBySchool`, read through `spellPowerAgainst`. The old reason had correctly ruled out `damageTakenBySchool` for multiplying and then read the number as flat anyway | 0 | — |
| **Mid-fight summoning** — `Simulation` exposes `combatants` read-only | 2 | Warlock Infernal, Mage elemental. Nothing in any profile needs it |
| **An aura scoped to an attack TABLE** — built, as `damageDoneByTable`. `AttackTableModifiers` is fixed when the character is and Seal of the Crusader's penalty has to come and go with the seal | 0 | — |

### Placeholders — every invented number, named

| Constant | Value | What would settle it |
| --- | --- | --- |
| ~~`PLACEHOLDER_SEAL_OF_COMMAND_PPM`~~ | **7, and real** | **Answered.** The owner has confirmed 7 procs-per-minute, so the constant is `SEAL_OF_COMMAND_PPM` and the fourth-highest profile loses its one big asterisk. The value did not move; what moved is whether it can be quoted |
| ~~`PLACEHOLDER_PET_BASE_DPS`~~ | — | **DELETED 2026-10-01.** The owner supplied the whole pet model — 36.34–55.32 a swing at 2.0 seconds, from 136 strength and 100 agility, with attack power and crit formulas — so there is nothing left for a placeholder to hold. Worth **−193.0** to BM Hunter |
| ~~`PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE`~~ | ~~20~~ | **DELETED 2026-09-30.** The owner gave **5 PPM**, which changed the SHAPE as well as the number. This row survived as an epitaph after the constant went, which is the over-counting the note above describes |
| `PLACEHOLDER_SOUL_SHARDS` | 10 | what a Warlock banks before a pull. No in-fight income |
| `PLACEHOLDER_COMBUSTION_DURATION_MS` | 30s | its real end is "until 4 crits", which nothing counts. Generous |
| ~~`PLACEHOLDER_WINDFURY_WEAPON_DURATION_MS`~~ | ~~1.5s~~ | **DELETED 2026-10-07, and not by being answered.** It held the imbue's attack power WINDOW, borrowed from Windfury Totem. The owner's ruling is that the imbue has no window at all -- the attack power is "added into the hits themselves" -- so there is nothing left for a placeholder to hold. **A placeholder can be retired by the QUESTION going away rather than by the number arriving**, and the borrow is what made that visible: an unnamed 1.5 would have survived the rework. The claimed SoD trinket tooltip reading 2s does not exist anywhere in this repository and the claim is withdrawn |
| ~~`PLACEHOLDER_WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS`~~ | ~~1.5s~~ | **DELETED 2026-09-30.** The owner gave **3 seconds for the imbue**; the totem's 1.5 is still right for the totem |
| `PLACEHOLDER_FLURRY_DURATION_MS` / `_REVENGE_WINDOW_MS` | 12s / 5s | Warrior-era; charges end Flurry in practice. **`_BERSERKER_RAGE_DURATION_MS` is gone**: all three sources say "Lasts 10 sec", and the placeholder's reason was a claim about the owner's spreadsheet being silent — true of the spreadsheet and irrelevant to the data |
| ~~`PLACEHOLDER_PET_SWING_SECONDS`~~ | — | **DELETED 2026-10-01.** "Base Swing Time = 2.0 seconds", stated, and it is the speed the `2 / 14` in the owner's damage formula is the coefficient for — so the two halves cannot disagree |
| `PLACEHOLDER_BOSS_*` | 5000 / 2s / 15% | the encounter, not a class. See [docs/incoming-damage.md](docs/incoming-damage.md) |
| `PLACEHOLDER_ONE_HAND` / `_TWO_HANDER` / `_RANGED` | — | only used when nothing is equipped; every preset equips |

**Interpretations** are not placeholders — a real number read one of two ways,
with the reading beside it: Seal of Righteousness' base as the LOW end of "21 to
75"; Maelstrom Weapon and Arcane Blast as per stack; Bane of Agony ticking flat;
every DoT cadence dividing its stated total into whole ticks; a hybrid's two
halves sharing one coefficient by DURATION rather than by damage. The last is why
Fireball's burn is 11% of its damage and takes 35% of its scaling.

## Open questions for the ruleset owner

**THREE ARE NEW AND ALL THREE COME FROM THE WARRIOR DIVE.** Each is a decision
rather than a missing number, and none of them blocks anything.

- **DW Fury's point in Spearing Strike, and the Berserker list's entry for it.**
  Spearing Strike requires a two-handed weapon -- stated by the spellbook capture
  and by `foreverchanges.pro`, absent only from the Wowhead tooltip this project
  had been reading. So the point buys nothing on a dual-wielder and the list entry
  can never fire. The entry was added on your instruction precisely BECAUSE the
  point looked wasted, so both halves are yours to move. It was worth about one
  DPS even while it worked: removing it cost 0.8, because the 15 rage went
  straight into Heroic Strike.
- **Berserker Rage's magnitude**, which is the same question as before and now the
  only unanswerable thing on the class. "Generating extra rage when taking damage"
  -- no number in any source, and the spell carries exactly two effect rows, both
  immunities. Improved Berserker Rage's 10 rage ON ACTIVATION is stated and is
  applied; the ability's own half is not.
- **Retaliation.** 15 minutes in Forever, down from 30. Battle Stance, 15 seconds,
  at most 30 counterattacks. It is a real Arms cooldown once a target swings back
  and it is not modelled -- worth nothing to all three profiles today, because the
  one in Battle Stance is the one whose target stands still. Worth declaring only
  if an attacking Arms encounter is wanted.

**THE FOUR FLAT FINISHERS ARE ANSWERED**, and so is everything else the
coefficient audit raised. `WoWSimWorksheet.xlsx` supplies Eviscerate at 4% of
attack power per combo point spent, Ferocious Bite at 3%, Rip at 4% per combo
point per tick, and Rupture at a flat 3% a tick. Lacerate's "10% weapon damage
per existing application" applies too — its `unmodelled` reason claimed a
periodic tick could not read its own stack count, and `AuraInstance` has carried
`stacks` all along.

**AND ONE COEFFICIENT NOW EXISTS THAT THE SHEET DOES NOT CONTAIN.** Wrack is
**14.3% of spell power per tick**, six ticks one second apart, supplied by the
owner directly -- `WoWSimWorksheet.xlsx` lists nine Warlock spells and Wrack is
not one of them. It is the only row in `coefficients.ts` that a refresh of the
sheet will not carry, and the provenance is recorded beside the constant for
exactly that reason. **It did not make the ability worth casting:** 0.858 over a
six-second channel is Shadow Bolt's 0.857 in twice the time, so Wrack stays out
of every list, which is what the owner asked for. Its +10% to your other Shadow
DoTs is still unmodelled and is the reason anybody would cast it.

~~**ONE ROW OF THE SHEET STILL CANNOT BE APPLIED.**~~ **Every row is applied.**
The last one was:

- ~~**Hammer of Wrath.**~~ **Declared.** Its "20% or less health" is the CLOCK,
  by the same ruling Execute runs on — `combat/executePhase.ts`, which is where
  that rule moved when it stopped being the Warrior's alone. The row had sat
  transcribed-and-unapplied since the sheet arrived, and what cleared it was not
  new data but the owner putting the ability in two priority lists.

~~**Instant Poison and Deadly Poison.**~~ **Applied.** They were listed here as
a missing SYSTEM rather than a missing number, and the system was built: both
coefficients are read by `reactions/poisons.ts` and `auras/rogue.ts`. The
comment on the constants said "not applied" for a while after it stopped being
true, which is the third time an expired reason has been caught in this file.

1. ~~**Seal of Command's PPM.**~~ **Answered: 7.** And so are Vindication's proc
   chance (**10%**), Seal of the Crusader's damage penalty (**Classic's reading,
   where it exactly cancels the haste**) and Judgement of the Crusader's "up to
   161" (**spell power, not flat damage**). Four Paladin answers in one pass, and
   three of them deleted an inert talent rather than a placeholder.
2. **Seal of Righteousness' base** — is the low end of "20.5 to 71.4" the `base`
   term, or the midpoint? Still open, and the last Paladin interpretation.
3. **Is a dispel in scope, and is a self-disarming immunity?** The Paladin's last
   two live gaps turn on these and nothing else. `purifying_power`'s Cleanse and
   Purify half is inert because nothing here applies anything dispellable, which
   is an ENCOUNTER property rather than one of the five rulings — the same shape
   stealth had before you ruled on it. `guardian_s_favor`'s Blessing of
   Protection, and `sacred_duty`'s Divine Shield and Divine Protection, all stop
   the Paladin attacking for their duration.
4. **Maelstrom Weapon's proc chance.** Not in the client data at all.
~~5. **One pet's base DPS, or one damage range, at 60.**~~ **ANSWERED IN FULL,
   2026-10-01**, and the answer was the whole model rather than the one number:
   base damage `random(36.34, 55.32)` a swing at 2.0 seconds, base stats of 136
   strength / 100 agility / −20 attack power, and the two formulas
   `AP = −20 + Str × 2 + 0.1 × max(melee, ranged)` and
   `crit = agility / 20 + owner's crit`. Claw and Bite are confirmed as built and
   **take no attack power at all**, which is a statement rather than an omission.

   **AND THE 1.375 WAS ALREADY THERE.** The owner's "Pet Global Damage Multiplier
   = 1.375x" is Petopia's 1.10 family modifier times the wiki's 1.25 for a fed
   pet — *"They're the same thing"* — so no constant was added. **The danger was
   implementing the stated figure a SECOND time**, which takes a Cat to 1.89 and
   reads as an ordinary pet; `petsAndHunter.test.ts` guards it with a scripted
   swing asserted against the owner's formula, and the guard was verified to fail
   by injecting one.

6. **Bane of Agony's ramp** — did Forever keep Classic's 50/100/150 bands?
7. **Berserker Rage's magnitude** — Forever's tooltip names none.
8. **The hawk's damage, and how to read it.** Both sources state ONE figure —
   our capture 108, `foreverchanges.pro` 110 — for a hawk that "dive-bomb[s] your
   targeted enemy, dealing 108 Physical damage and continuing its assault for 18
   sec", and **neither quantifies the continuing assault**, which is what the
   simulator actually models at 32 a strike. Is 108 the per-strike rate (which
   would more than triple the hawk), or an opening hit on top of ticks whose rate
   is unstated? 32 appears in no source and is left alone pending the answer.

**The four from the Warlock cross-check are ANSWERED**, and the answer came with a
standing rule that closes the same question for every class: **where our capture
and `foreverchanges.pro` disagree, foreverchanges wins.** Life Tap is 840,
Shadowburn 251–281, Searing Pain 105–123. Shadowburn is charged both a shard and
365 mana, because there the preferred source is silent rather than different — it
carries no reagent field for any spell. See
[docs/source-cross-checks.md](docs/source-cross-checks.md).

Answered already, for reference: Seal of Command procs at **7 PPM**;
Vindication procs at **10%**; Seal of the Crusader's damage penalty is
**Classic's, exactly cancelling its haste**; Judgement of the Crusader's "up to
161" is **spell power rather than flat damage**; Retribution Aura stays
**undeclared**; Divine Favor is **in the Shockadin list**; seal damage is **not** a
weapon use; a hawk is modelled **without** a real combatant; pet family is a **profile field**; Shield
Slam triggers **main-hand** effects; Careful Aim contributes to attack power
**and** ranged attack power; resistances on an enemy target do not affect damage.

## What to do next

The refactor is phased; the milestone follows it.

1. ~~**Phase 1 — documentation.**~~ **Done.** Five Warrior-only docs and the engine
   gap survey folded into [docs/warrior.md](docs/warrior.md) and this file;
   CLAUDE.md restructured as a reference; five expired claims cleared.
2. **Phase 2 — code, conservatively.** In progress. **Done:** the rulings are data
   (`OutOfScope`, 96 entries tagged, a test that a new class cannot slip past), the
   Talent panel shows a decision separately from a gap, the healing split is made,
   and the odd-one-out Warrior capture is named for what it is. **Left:**
   - **Ask the owner for each placeholder number** — 16 of them, listed
     above. Every one answered is a placeholder deleted. **One went without being
     asked about**: Berserker Rage's duration was never missing data. **And Seal
     of Command's is the proof the asking is worth it** — one message turned the
     largest invented number in a top-three profile into real data.
     **FOUR PALADIN QUESTIONS WERE ANSWERED IN ONE PASS AND ONLY ONE WAS A
     PLACEHOLDER.** The other three were inert TALENTS, which is the lesson the
     coefficient sheet taught twenty-nine talents at once. **Check whether a
     missing number is missing DATA or a missing RULING.**
   - **The talents whose rule already exists with nothing hooked to it.**
     Shaman Elemental Focus is the clearest: a one-shot cost modifier is exactly
     `CastModifier.costFraction` with `consumedByCast`, which Maelstrom Weapon
     already uses, and its reason still says it has no declaration.
     ~~Rogue Lethality and Warlock Pandemic want `critMultiplierBonus`, which
     exists and nothing reaches.~~ **Both DONE** -- `abilityCritDamage`, one
     declaration for both, and it did move DPS: +14.8 to SM/DS and +2.6 to +3.2
     across the three Rogues. **These will move DPS, so they want their own PR
     and a re-measured baseline**, which is how that one was done.
     **AND THE PALADIN IS THE WORKED EXAMPLE OF HOW BIG THIS CATEGORY IS.** Six
     of its ten live gaps were in it, worth +57, +94 and +85 DPS across its three
     profiles, and not one of them needed a number nobody had. Three were
     contradicted by code in the WARRIOR'S OWN reaction file. **Read every
     `unmodelled` reason that names an engine limitation against the engine, not
     against its own plausibility.**
   - **Dead code**: exports nothing imports.
   **Do not restructure the engine, the panels or the profile schema**; volume is
   the problem, not shape.
3. **Phase 3 — the milestone, per class.** Every talent resolves to an effect or
   to a permanent out-of-scope reason, with no "not written yet". Every spell on
   the approved list declared, with its cooldown. Every damaging ability carrying
   the right coefficient. **The APL measured entry by entry** — 30 batches of 10
   per variant, a difference inside the interval treated as no difference. The
   Hunter review is the worked method and moved those three profiles +20 to +55
   DPS each.

~~**THE APL HALF OF PHASE 3 IS THE NEXT PIECE OF WORK**~~ **and is done.** All 23
lists are the owner's, the nine entries that do not fire each have a reason,
and the baseline above is measured on them. [docs/handoff-rotations.md](docs/handoff-rotations.md)
carries what each list turned out to be worth and the three findings that came
out of building them.

**PICKING IT UP AGAIN HAS ITS OWN BRIEF**: [docs/handoff-apl.md](docs/handoff-apl.md),
which carries the state, the two open items below in full, the tools in the order
to use them, and the two things about this codebase a list author needs before
writing an entry.

**WHAT THE APL WORK LEFT BEHIND, in order of how much it costs:**

1. **Two of the owner's lists measure down and were shipped as written**, with
   the cost isolated rather than acted on: Venom's Eviscerate floors at -20.4,
   and Shadow Word: Death leaving the Priest at -35.7. Both are the owner's
   design and both numbers are in the baseline notes above.

A profile has **no `faction` field**; faction is derived from race. The milestone
asks for faction as a default, so either say that derivation is the answer or
store it and bump v10.
