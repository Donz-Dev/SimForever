# Source cross-checks, per class

The Warrior's numbers were checked against four sources and **eight of them turned
out wrong**. Every other class was built from `talentsforever.com` alone. This
file records what happens when a second source is put beside one of them, class
by class, so the accuracy question has an answer other than "nobody looked".

**Where the two agree, confidence rises. Where they disagree,
`foreverchanges.pro` WINS** — the ruleset owner's standing rule, "when in doubt use
foreverchanges.pro", given when it settled Life Tap. It applies to every class,
because eight of the nine have no owner spreadsheet to appeal to.

Two conditions on applying it:

- **Say so where the number lives.** A constant that disagrees with the
  checked-in capture carries the ruling in a comment, or the next person reads it
  as drift. The captures are scraped data and are never hand-edited to match.
- **It does not apply when the preferred source is SILENT rather than
  different.** `foreverchanges.pro` carries no reagent field for any spell, so its
  mana-only cost for Shadowburn does not contradict a Soul Shard — it cannot
  express one. Both are charged. A tie-break where there is no tie deletes a real
  cost.

## The method

```bash
node tools/import_forever_spells.mjs <class>            # look, write nothing
node tools/import_forever_spells.mjs <class> --write     # refresh the capture
```

Then read `foreverchanges.pro/spellbook/<class>` beside it. Two traps, both hit on
the first attempt:

- **Its text dump is "at the rank the book opens on", which is not always the
  max.** Conflagrate reads 172–216 there and **251–313 at its real max rank of
  6**, which looked exactly like a disagreement and was not. Read `max_rank` out
  of the page payload rather than the visible list.
- **The page payload, not the DOM.** The per-rank data is in an RSC flight script;
  the rendered list shows one rank at a time. Everything below came from the
  payload.

Compare only at the same rank AND the same level. Compare cost, cast time and
cooldown too — one of the Warlock's four findings is a cost, not a damage figure.

**AND COMPARE THE REQUIREMENT LINE.** Added after the Warrior re-check, which
found a two-handed weapon requirement nobody had been reading. A requirement is
the one field where the three sources differ in KIND rather than in value:
Wowhead's tooltip omits some outright, the spellbook capture names weapon
classes one by one, and `foreverchanges.pro` states the family. An omission is
not a disagreement, so the tie-break rule does not apply to it — see the Warrior
section below.

## Warrior — RE-CHECKED 2026-09-30, and it was the first machine check this class had

**THE WARRIOR WAS THE LAST CLASS WITHOUT A SPELLBOOK CAPTURE**, so every earlier
"check" of it was a hand read of a web page. `node
tools/import_forever_spells.mjs warrior --write` closes that: 42 spells at build
1.60.1.70009, the ninth of nine, and it is now diffable by machine like the rest.

**Three sources were put side by side and three numbers moved.** Two of them
were found only because the spellbook existed.

| | ours, before | spellbook capture | `foreverchanges.pro` | applied |
| --- | --- | --- | --- | --- |
| **Slam** cooldown | 15 sec | **18 sec** | **18 sec** | **18** |
| **Spearing Strike** | no weapon requirement | "Requires Two-Handed Axes, Two-Handed Maces, Polearms, Two-Handed Swords, Staves" | "Requires Two-Handed Melee Weapon" | **two-handed only** |
| **Thunder Clap** targets | `Infinity` | "up to 4 targets" | "up to 4 targets" | **4** |
| Demoralizing Shout | 196 | 204 | **196** | 196, unchanged |
| Battle Shout | 139 | 139 | 139 | 139, unchanged |
| Revenge | 153 flat | 138 to 168 | 138 to 168 | 153, the exact midpoint |
| Shield Slam | 655 flat | 640 to 670 | 640 to 670 | 655, the exact midpoint |

**SLAM IS BUILD DRIFT AND NOT A SOURCE DISAGREEMENT**, which matters because the
two are fixed differently. `node tools/import_spell.mjs --verify` re-fetched the
SAME spell id from the SAME endpoint the 15 came from and got 18. The 15 was
right on 2026-09-19 — three sources including the ruleset owner's own word — and
is wrong on 2026-09-30 without anybody touching this repository. **No amount of
cross-checking finds this kind; only refreshing does**, and the Warrior had gone
eleven days without a refresh because it was the class with the fewest reasons
to doubt.

**SPEARING STRIKE IS THE FINDING WORTH CARRYING**, and it is a new shape. The
two sources that speak agree; the one that stays silent is the one we had. A
missing clause is not a denial, so the tie-break rule never came into it — the
same reasoning that keeps Shadowburn's Soul Shard when `foreverchanges.pro`
cannot express a reagent. **DW Fury had been casting a two-handed-only ability
while dual-wielding two swords for the whole project**, and a test asserted that
it did.

**THE REFRESH ALSO CONFIRMED FIVE TRANSCRIPTIONS**, which is the result this
exercise mostly produces and mostly buries. Forever stopped rendering the
`(100% of Spell Power)` artifact, so Bloodthirst, Shield Slam, Revenge,
Hamstring and Intercept now print 48, 640–670, 138–168, 45 and 65 — every one
of them a number this project had read out of an effect row when no description
could state it. **And the two ranges settle a question `docs/warrior.md` had
recorded as unanswerable**: 153 and 655 are exact midpoints, so flat-at-the-
midpoint was right.

**WHAT IT MEASURED**, 30 batches of 10 against the baseline:

| | was | now | |
| --- | --- | --- | --- |
| 2H Arms | 607.2 | **603.3** | −3.9, inside ±9.1. Slam 2.9 casts a fight to 2.5 |
| DW Fury | 652.0 | **651.2** | −0.8, inside ±8.9. Spearing Strike 2.7 casts to **0** |
| the other 21 | — | — | identical to the decimal, Prot Warr included |

**BOTH CORRECTIONS MEASURE AS NOISE, AND THAT IS THE INTERESTING PART FOR DW
FURY.** Losing an ability outright cost 0.8 DPS because the 15 rage it was
spending went straight into Heroic Strike: 9.0 casts a fight became 11.0, and
its share went 15.8% to 19.5%. **The owner's Spearing Strike entry was worth
about one DPS even when it worked** — so the point DW Fury spends on the talent
was buying almost nothing before it started buying nothing at all. Whether the
entry comes out of the list and whether the point moves are both the owner's
calls and neither is taken here.

## Warlock — checked 2026-09-25, both sources at build 1.60.1.70009

**Seven of ten agreed exactly**, on damage, mana cost, cast time and cooldown:
Shadow Bolt, Corruption, Bane of Agony, Siphon Life, Immolate, Incinerate and
Conflagrate. That is the result worth having: the class's core rotation is
corroborated by an independent read of the same client.

**Four disagreed, and all four are RULED.** The owner ruled Life Tap at 840 and
gave the standing rule above with it, which settles the other two damage figures
the same way.

| | `talentsforever` (ours) | `foreverchanges.pro` | Applied |
| --- | --- | --- | --- |
| **Life Tap** r6 | 424 health to mana | **840** | **840**, by the owner's explicit ruling |
| **Shadowburn** r6 | 258 to 288 | **251 to 281** | **266** midpoint, by the standing rule |
| **Searing Pain** r6 | 107 to 125 | **105 to 123** | **114** midpoint, by the standing rule |
| **Shadowburn cost** | `Reagents: Soul Shard` | `365 Mana` | **both** — the rule does not apply, see above |

**What it moved**, 300 iterations at seed 12345:

| | was | now | |
| --- | --- | --- | --- |
| Firelock | 479.1 | **537.2** | **+12.1%**, and it passes the Shadow Priest into fourth |
| SM/DS | 331.7 | **333.8** | +0.6% |
| the other 21 | — | — | unmoved to the decimal |

Life Tap alone was worth +13.5% to Firelock; the two damage nerfs and Shadowburn's
new mana cost give about 6 of it back. **SM/DS barely moves because Affliction is
not mana-bound and Destruction is** — the same number, two profiles, one result.

**LIFE TAP IS THE ONE THAT MATTERS, AND IT IS NOT A STALENESS PROBLEM.** Our
capture was refreshed from build 69876 to 70009 during this check, which is the
same build `foreverchanges.pro` reads, and talentsforever still says 424. The
tooltip *rewording* that site flags for 24 September is real — the duplicated
"Mana gained is increased by your Spirit" sentence is gone — and the two sources
disagree on the number underneath it.

It was worth measuring rather than guessing, and the measurement is what the
ruling was made against: Life Tap alone took Firelock from 479.1 to 543.7,
**+13.5%**, and SM/DS from 331.7 to 333.8. Life Tap is in both priority lists and
is the mana engine for both, so it was the largest open figure on the class.

**THE SHADOWBURN COST IS NOT A DISAGREEMENT AT ALL, AND THAT IS WHY THE RULE IS
NOT APPLIED TO IT.** talentsforever lists a Soul Shard reagent and no mana;
`foreverchanges.pro` lists 365 mana and **carries no reagent field for any spell
in its payload**, so it is silent rather than contradicting. Classic charges both.
Both are charged here: the shard stays the declared `cost`, because a rotation's
affordability check is what that field is for and shards are the scarce pool, and
the mana is taken in `onCast` — the shape Execute already uses for the rage it
drains beyond its declared 15. One line in `abilities/warlock.ts` reverts it to
mana alone if the owner means that.

### 2026-10-07: Bane of Agony's coefficient SUPERSEDES the sheet

**NOT A SOURCE DISAGREEMENT AND NOT STALENESS.** `WoWSimWorksheet.xlsx` gives
Bane of Agony 13.3% of spell power a tick -- 1.064 in total over the eight ticks
it then had. The ruleset owner has since stated the figure directly as **160% of
spell power across the whole effect**, with the cadence and the ramp in the same
message and a worked example: "552 + 500 * 1.6 = 1352".

**THE LATER AND MORE SPECIFIC OWNER STATEMENT WINS**, which is the same rule that
let the sheet supersede `WoWForeverWarriorAbilities.xlsx` on Rend, Revenge and
Thunder Clap. No tie-break between the two captured sources is involved: neither
`talentsforever.com` nor `foreverchanges.pro` carries a coefficient at all.

**IT IS RECORDED IN THREE PLACES** -- beside the constant, in
[spell-coefficients.md](spell-coefficients.md) and here -- because a figure that
disagrees with a checked-in document reads as drift to the next person unless the
ruling travels with it. Worth **+23.6 DPS** to SM/DS.

### What this check established beyond the Warlock

**TWO CLIENT-DERIVED SOURCES CAN DISAGREE AT THE SAME BUILD.** Before this the
project had never seen it: the Hunter wiki and the spellbook had "not yet
disagreed", and the working assumption was that a second client read would either
confirm a number or be stale. It can do neither. So a second source is worth
running on every class, and 7-of-10 agreement is a real result rather than a
formality.

## Rogue — checked 2026-09-25, both sources at build 1.60.1.70009

**Ten of twelve agreed exactly**, including every finisher's whole per-combo-point
table: Eviscerate's five ranges, Rupture's five damage-and-duration pairs, Expose
Armor's 450 a point, Slice and Dice's 30% and its five durations, plus Sinister
Strike, Hemorrhage's 100%/145%, Ghostly Strike's 125%/180%, Adrenaline Rush, Blade
Flurry and Cold Blood. Those tables are the most error-prone data in the class and
they match figure for figure.

| | ours | `foreverchanges.pro` | applied |
| --- | --- | --- | --- |
| **Backstab** r9 | 225 flat | **150** | **150** |
| **Mutilate** r4 | 38 an weapon | **50** | **50** |

**225 IS EXACTLY 150 x 1.5, AND THAT IS WORTH REMEMBERING.** Backstab is "150%
weapon damage plus N", and the losing figure is the winning one times the weapon
fraction printed beside it — so one of the two sources may be rendering the
tooltip with the coefficient already folded in. Neither states which, the rule
settles it, and the comment on the constant says so in case it comes back.

**THE BACKSTAB CORRECTION IS WORTH NOTHING TODAY, BECAUSE NO PRIORITY LIST CASTS
BACKSTAB.** The Venom list opens with Mutilate, Combat uses Sinister Strike and
Rupture uses Hemorrhage. That is a finding in its own right: an Assassination
rogue holding daggers and never pressing Backstab is an APL question, not a data
one, and it belongs with the seven unmeasured class lists.

So the whole measured effect is Mutilate, +12 a weapon on a two-weapon strike:

| | was | now | |
| --- | --- | --- | --- |
| Venom Rogue | 314.4 | **316.3** | +0.6%, and it passes Rupture |
| Rupture Rogue | 315.2 | 315.2 | Hemorrhage, which agreed |
| Combat Rogue | 376.9 | 376.9 | Sinister Strike, which agreed |

## Priest — checked 2026-09-25, both sources at build 1.60.1.70009

**Five of seven agreed exactly**: Shadow Word: Pain's 762 over 18s, Devouring
Plague's 848 over 24s, Mind Flay's 390 over a 3-second channel, Shadowform's three
clauses and Vampiric Embrace's 20% over 30s. Every mana cost and cooldown matched
too.

| | ours | `foreverchanges.pro` | applied |
| --- | --- | --- | --- |
| **Mind Blast** r9 | 477 to 503 | **472 to 498** | **485** midpoint |
| **Shadow Word: Death** r4 | 444 to 472 | **434 to 462** | **448** midpoint |

**MIND BLAST WAS THE PROJECT'S ONE HAND-VERIFIED COEFFICIENT EXAMPLE**, so the
worked figure moved with it: 485 base, a 1.5-second cast for 0.4286, and 497 Shadow
spell power now gives **698.00** where the same arithmetic gave 703.00. The
verification still holds — it is the base that moved, not the formula.

| | was | now | |
| --- | --- | --- | --- |
| Shadow Priest | 510.9 | **509.4** | −0.3% |

## Mage, Shaman — checked 2026-09-25, small and uniform

Both came out the same way: every DoT total, cadence, cost, cast time, cooldown
and mechanic matched, and a handful of direct-damage ranges sat a few points
apart.

| | ours | `foreverchanges.pro` |
| --- | --- | --- |
| Mage Scorch r7 | 166–196 | **163–193** |
| Mage Fire Blast r7 | 417–489 | **402–474** |
| Mage Ice Lance r6 | 136–160 | **133–157** |
| Shaman Lightning Bolt r10 | 189–211 | **185–207** |
| Shaman Chain Lightning r4 | 119–133 | **116–130** |
| Shaman Frost Shock r4 | 278–294 | **275–291** |

Agreed: Fireball, Pyroblast and Frostfire Bolt with all three hybrid DoTs,
Frostbolt, Blast Wave, Arcane Missiles' 209 a tick, Arcane Blast's +10% and +175%,
Arcane Power, Combustion, Earth Shock, Flame Shock, Lava Burst, Stormstrike's
+20%, Rage of the Farseer. Fire −0.4%, Frostfire −0.5%, Elemental −0.5%, Moonkin
−0.1%, Arcane unmoved.

## Paladin — checked 2026-09-25, and it moved three profiles

The largest mover of the five, and **Holy Strike is wrong in two different ways at
once**, which is why it needs reading carefully.

| | ours | `foreverchanges.pro` | why |
| --- | --- | --- | --- |
| **Holy Strike** weapon | 0.4 | **0.5** | **build drift** — our own capture moved 40%→50% and 12s→10s cooldown between builds, so both sources now agree and we were stale |
| **Holy Strike** holy | 32–42 | **81–105** | **source disagreement** — our capture says 40–53 at the new build; this is a doubling |
| Judgement of Righteousness | 170–186 | **162–178** | source disagreement |
| Judgement of Fury | 153–167 | **146–160** | source disagreement |
| Seal of the Crusader | 325 AP | **306** | source disagreement |
| Seal of Righteousness base | 21 | **20.5** | source disagreement; "21 to 75" against "20.5 to 71.4" |

Judgement of Command, Judgement of the Crusader's 161, Seal of Command's 70%, Seal
of Fury, Holy Shock, Consecration and Holy Shield all agreed.

| | was | now | |
| --- | --- | --- | --- |
| Seal Twist Ret | 391.9 | **431.0** | **+10.0%**, now sixth |
| Prot Pally | 139.3 | **158.1** | **+13.5%** |
| Shockadin | 324.5 | **334.5** | +3.1% |

## Druid — checked 2026-09-25, and Wrath had gone stale under us

| | ours | `foreverchanges.pro` | why |
| --- | --- | --- | --- |
| **Wrath** r8 | 62–68 | **86–96** | **build drift AND disagreement** — our refreshed capture reads 92–102, so both sources agree it gained ~40% and differ on the figure |
| Moonfire direct r10 | 128–150 | **124–146** | source disagreement |
| Claw r5 | 126 | **115** | source disagreement |

**WRATH IS THE CASE FOR REFRESHING CAPTURES RATHER THAN ONLY CROSS-CHECKING
THEM.** 62–68 was correct at build 69876. Nobody mistyped it; the client changed
and the number went wrong on its own.

**AND FOREVER RENAMED MANGLE TO PRIMAL BITE** at the same build — same damage,
cost, cooldown and form requirement, and the Feral talent that names it changed
too. The display name follows the client and the id does not: `BatchTotals`
aggregates by **name**, with no ability id on a reported row, so a rename in
content is a rename in the damage table and in anything matching on it.

Agreed: Starfire, Insect Swarm, Shred's 155%+180, Rake, Ferocious Bite's five
ranges, Rip's five, Swipe, Lacerate, Tiger's Fury. Moonkin −0.1%; **Cat and Bear
unmoved**, because no Cat list casts Claw and Primal Bite's damage did not change.

## Hunter — checked 2026-09-25, and this one was ours

**Nine of eleven agreed** — Arcane Shot, Aimed Shot's 166, Multi-Shot, Serpent
Sting's 555, Raptor Strike, Mongoose Bite, Hunter's Mark's 71, both Aspects, Rapid
Fire, Bestial Wrath.

**SNIPER SHOT WAS WRONG IN FOUR WAYS AND ITS OWN CAPTURE HELD EVERY ANSWER, at
both builds.** Not a source disagreement at all — `foreverchanges.pro` and
`forever-hunter-spellbook.json` agree with each other and the code agreed with
neither.

| | was | is |
| --- | --- | --- |
| damage | 160 | **295** |
| cost | 200, a `PLACEHOLDER` | **365 mana**, stated in the capture's own `cost` field |
| cast | instant | **4 seconds** |
| cooldown | 6 seconds | **15 seconds** |

Two separate failures produced it:

- **The rank-1 rule was applied to the wrong artifact.** The old comment reasoned
  that "the spellbook opens on rank 1, and a talent shows the rank it grants" —
  true of the website, irrelevant to a capture that says `rank: 3` because the
  importer writes max rank by construction.
- **The placeholder's own justification was false.** It said "the spellbook gives
  the ability no cost line at all". The capture says `"cost": "365 Mana"`, and did
  at build 69876 too. **And it was never a named `PLACEHOLDER_` constant** — a bare
  200 with a caveat, so the count of 19 does not change. An invented number that
  is not named cannot be audited, which is the whole point of the naming rule.

| | was | now | |
| --- | --- | --- | --- |
| LW Ranged | 342.1 | **304.0** | **−11.1%** |

**A FOUR-SECOND CAST IS WHY, AND THE APL NOW NEEDS RE-MEASURING.** A cast resets
the ranged swing timer and auto-shot is 42% of a Marksmanship Hunter's damage on a
3.2-second cycle — the same rule that took Aimed Shot out of this list at *two*
seconds. Dropping Sniper Shot measures **+7.9** on one 300-iteration run, so the
list is probably wrong now; it wants the full 30-batch method before it changes,
and it is not changed here. The profile is genuinely weaker either way: it had
been casting a 295-damage shot at a 160-damage instant's price.

~~**THE HAWK'S 32 PER STRIKE IS IN NEITHER SOURCE.**~~ **IT WAS IN ONE OF THEM,
AND THIS ENTRY WAS WRONG FOR AS LONG AS IT STOOD.** 32 is the TALENT tooltip's
figure — `src/data/talents/values/hunter.json` reads "dealing 32 Physical damage
and continuing its assault for 18 sec" — and **a talent tooltip shows rank 1 of
the ability it grants.** The spellbook capture says `"rank": 4` and 108;
`foreverchanges.pro` says 110. So the two sources were one number at two ranks
and there was no disagreement to settle, only a rank to check.

**SECOND TIME IN THIS CLASS, AFTER SNIPER SHOT**, and the more instructive of the
two: Sniper Shot's comment applied a real rule to the wrong artifact, while this
one asserted the figure came from NOWHERE. A number nobody can place is more
likely rank 1 of a granted ability than an invention — look there before
recording it as an open question, which is what happened here.

**THE OWNER RULED IT 2026-09-30:** *"Assume it's 108 for initial and every other
hit. Once every 2 seconds. Similar to a DoT effect except two of these can be
active."* So the dive and each strike are both 108, and the second hawk deals
damage for the first time. Worth **+144.4** to BM Hunter.

| | ours | `foreverchanges.pro` | applied |
| --- | --- | --- | --- |
| **Summon Hawk** r4 | 32 (a rank-1 tooltip) | **110** | **108**, the capture's own max rank, by the owner's ruling |

**AND ONE ABILITY LEAVES THE BOOK RATHER THAN CHANGING.** `Lacerate` is in the
capture — Survival, level 60, marked `"new"`, 95 mana, *"bleed for 406 damage
over 21 sec"* — and the owner's answer was **"Lacerate isn't a real ability as of
now."** So it belongs on the spell exclusion list, not in the spellbook. **It is
not the Lacerating Strikes TALENT**, which shares its 21-second duration, is
real, and is built.

## All nine refreshed 2026-10-08, to client build 1.60.1.70170

**THE FIRST FULL REFRESH, and it was a PATCH rather than a cross-check.** `node
tools/import_forever_spells.mjs --all --write` and `node
tools/import_forever_talents.mjs --write` took every class from build
1.60.1.70009 to 1.60.1.70170 in two commands. The section below this one had
asked for exactly that and said the diff is where a change announces itself; it
is, and the diff was large.

**WHAT A REFRESH FINDS THAT A CROSS-CHECK CANNOT, demonstrated at scale.** Three
trees changed SHAPE -- Warrior 53 talents to 52, Paladin 52 to 50, Druid 51 to
52 -- and no amount of reading a second source for a number would have found
that. The tell is the TALENT COUNT, which `--check` prints before it writes
anything.

### Four talents were removed and three of them are in no patch note

| | |
| --- | --- |
| **Improved Holy Strike** | Paladin Holy. **All three** Paladin builds spent 2 points. Silent |
| **Crusade** | Paladin Retribution. Two builds spent 2, +2% to everything. Silent |
| **Precision** | Warrior Fury, +3% hit. No Warrior build took it. Silent |
| **Toughness** | Warrior Protection. Named in the notes. No Warrior build took it |

**AND TWO SHAMAN TALENTS SWAPPED TIERS WITHOUT BEING MENTIONED EITHER.**
Elemental Fury went from row 3 (tier 10) to row 6 (tier 25) and Elemental
Alacrity the other way, and Call of Thunder's prerequisite moved with them. That
put Elemental Fury out of reach of the Enhancement build's nineteen Elemental
points, which is a build change rather than a figure change and one the owner had
to make.

### The decoder is what noticed, and it throws rather than guessing

**SEVEN OF THE TWENTY RECORDED BUILD URLS STOPPED DECODING AT ONCE.** The
encoding is one digit per talent IN TREE ORDER, so a removal shifts every digit
after it -- `tools/decode_talent_build.mjs --profiles` reports
"Feral Charge given 2 of 1 ranks" rather than producing a legal-looking build
nobody chose, which is the whole reason that check exists.

**THE WARRIOR WAS NOT IN THAT LIST, FOR THE WHOLE PROJECT.** Its three builds
were transcribed by hand from the owner's lists rather than decoded, so the one
class with four sources was the one class no build URL was ever checked against
-- and its tree had changed shape. All three are in the list now.

### The figures that moved

| Class | What moved | Worth |
| --- | --- | --- |
| Warrior | Bloodthirst 35% → 45% AP; Bloodthrill 10% → 20% and MAIN HAND only; Improved Slam's cooldown −3s; Spearing Strike's requirement two-hander → Battle Stance; Unbridled Wrath's two-handed doubling removed; Dual Wield Specialization's off-hand rage halved and its hit moved to a new talent | **+101.6 DW Fury, +62.6 2H Arms** |
| Paladin | Champion of the Light 33/66/100% → 20/40/60% of Intellect; Vengeance 5 stacks → 3; Redoubt 30% → 20% block; Holy Shield 20% → 30% block; Two-Handed Weapon Spec 9% → 6%; Sacred Arbiter 10% → 20%; Holy Power now names Holy Strike; Twist of Light gains −20% seal mana | **−98.5 Ret, −80.7 Shockadin** |
| Druid | Tiger's Fury and King of the Jungle REMOVED, Shifting Power and Improved Shifting Power added; Swipe's coefficient 10% → 3%; Primal Fury renamed Blood Frenzy | **+24.0 Cat** |
| Mage | Hot Streak renamed Heating Up, window 15s → 20s; Combustion 4 crits → 3; Master of Elements' kill window 20s → 30s | +3.6 Fire, −10.4 Frostfire, both noise |
| Shaman | Elemental Fury/Alacrity tier swap; Lava Burst's RANK 1 figure 106–134 → 150–192, max rank unchanged | −18.6 Enh, noise |
| Hunter | Deflection 2/4/6/8/10% → 1/2/3/4/5% parry; Lightning Reflexes 15% → 10% agility; Summon Hawk's tooltip now states its 5% RAP | −8.0 LW Melee, noise |
| Priest | Devouring Plague can crit (**it always could here**); Inner Focus narrowed to non-periodic; Spirit Tap gains a Vampiric Embrace trigger | 0.0 |
| Warlock, Rogue | Soul Harvesting renamed Soul Harvest and its value row REORDERED; wording only otherwise | 0.0 |

**THE LAVA BURST ENTRY IS THE ONE TO READ TWICE.** Rank 1 moved and rank 3 did
not, so the talent tooltip and the spellbook now look CLOSER together than they
did -- and a reader who remembers the old gap could easily take 192–248 for the
talent's new number rather than the spellbook's unchanged one. The two sources
were never disagreeing.

**AND THE WARLOCK'S REORDERED VALUE ROW IS THE NEAR MISS.** `[10, 50, 50]` became
`[50, 10, 50]`, duration and regeneration swapping places. It is harmless only
because that talent's effect reads no value at all; an effect with a `valueIndex`
would have started reading seconds as a percentage, which is the failure CLAUDE.md
records four times over on the Druid and once on the Priest. **A REFRESH CAN
REORDER A ROW WITHOUT CHANGING A NUMBER IN IT**, so the diff to read is the
`values/*.json` one and not only the trees.

### The importer's own bug, which the refresh is how you find

**THE `cost` FIELD WAS WRONG FOR ABOUT A HUNDRED SPELLS ACROSS SEVEN CLASSES**,
and had been since the importer was written. The cost/range/cast/cooldown lines
arrive as a grid of free text sorted by what each cell SAYS, and `cost` was the
fall-through -- so a second cost-shaped cell overwrote the first:

| Spell | Capture said | Actually |
| --- | --- | --- |
| Rip, Ferocious Bite | `1 to 5 Combo Points` | 30 and 35 Energy |
| Shadowburn | `Reagents: Soul Shard` | **365 Mana**, and a Soul Shard |
| Every Hunter pet ability | `Pet: Wolf`, `Pet: Crab`, ... | 10 to 80 Focus |
| Every Shaman totem | `Tools: Water Totem` | its mana cost |
| Five Greater Blessings | `Reagents: Symbol of Kings` | its mana cost |

`extraLines` carries them now and the FIRST cost-shaped cell wins, so a third
kind of line cannot delete a cost either. **NOTHING READS THIS CAPTURE
PROGRAMMATICALLY, WHICH IS WHY IT SURVIVED**: the wrong number sat in a reference
document a reader would have believed, and no test could have failed on it. The
Shadowburn row is the sharpest version -- this very file argues, correctly, that
`foreverchanges.pro`'s 365 mana does not contradict a Soul Shard, and our own
capture had been showing the Soul Shard INSTEAD OF the 365.

## Every class is now checked

| Class | Agreed | Moved | Largest |
| --- | --- | --- | --- |
| Warrior, first pass | — | 5 | Slam, Thunder Clap, Bloodthirst, Demo Shout, Battle Shout |
| **Warrior, re-checked 2026-09-30** | 4 of 7 | 3 | **Spearing Strike needs a two-hander**; Slam 15→18 |
| Warlock | 7 of 10 | 3 + a cost | **Life Tap 424→840**, +12.1% Firelock |
| Rogue | 10 of 12 | 2 | Backstab 225→150, worth nothing (nothing casts it) |
| Priest | 5 of 7 | 2 | Mind Blast 490→485 |
| Mage | 10 of 13 | 3 | Fire Blast 453→438 |
| Shaman | 6 of 9 | 3 | Lightning Bolt 200→196 |
| Paladin | 7 of 12 | 5 | **Holy Strike 37→93**, +10% Ret, +13.5% Prot |
| Druid | 10 of 13 | 3 + a rename | **Wrath 65→91** |
| Hunter | 9 of 11 | 1, four fields + the hawk | **Sniper Shot** −11.1% LW Ranged; **the hawk's 32 → 108**, +144.4 BM Hunter |

**NOT ONE CLASS CAME BACK CLEAN.** Twenty-seven figures moved across nine classes,
and the exercise found three distinct kinds of error, which is the part worth
carrying:

1. **Source disagreement at the same build** — most of them, usually a few points,
   settled by the standing rule.
2. **Build drift**: a figure that was right when written and is not now. Wrath,
   Holy Strike, Life Tap, the Mangle rename. **No amount of cross-checking finds
   these; only refreshing the captures does.**
3. **Our own transcription** — Sniper Shot, four fields, with the answers sitting
   in the file the whole time and a plausible comment explaining the wrong one.

The third kind is the one to fear. It survived because the figure looked reasonable
and the comment cited a real rule.

## Still unchecked

**ALL NINE CAPTURES ARE NOW AT BUILD 1.60.1.70170**, refreshed 2026-10-08. The
paragraph that stood here asked for exactly that and is worth keeping as the
reason: the Warrior re-check had found a figure that went stale in ELEVEN DAYS,
on the class with the best sources in the project, and the mechanism was a live
tuning change rather than anything anyone did wrong.

**WHAT IS STILL ONE-SOURCED IS THE 1.60.1.70170 DATA ITSELF.** Everything in the
section above came from `talentsforever.com`; `foreverchanges.pro` has NOT been
read beside it for any class at this build. The two have disagreed at the same
build before -- Life Tap 424 against 840 -- so agreement is not assumed, and the
Paladin's −98.5 and the Warrior's +101.6 both rest on one source.

**AND TALENT VALUES STILL HAVE NO SECOND SOURCE AT ALL**
(`src/data/talents/values/*.json`), which is where most of this patch landed:
Champion of the Light's 20/40/60, Vengeance's 3 stacks and Redoubt's 20% are all
rank values, and all three moved a published figure.

**Three of the three classes checked so far needed corrections** — five figures on
the Warrior, three on the Warlock, four on the Rogue and Priest between them — so
treat the rest as a backlog rather than a formality. Each is about twenty minutes.

**THE DISAGREEMENTS ARE SMALL EXCEPT WHEN THEY ARE NOT.** Nine of the nine found so
far are within a few percent of each other and move a profile by under 1%; the
tenth was Life Tap at double, worth 13.5%. There is no way to tell which kind a
class holds without looking.

**ONE TENSION TO SETTLE EVENTUALLY:** the importer reads `talentsforever.com` and
the tie-break is `foreverchanges.pro`, so every class will keep producing
constants that deliberately disagree with their own checked-in capture. That is
honest and flagged in each comment, but it means the captures are a record of the
losing source. Switching `import_forever_spells.mjs` to read the RSC payload
instead would remove the split — worth raising with the owner rather than deciding
here, since it changes where all nine classes' data comes from.
