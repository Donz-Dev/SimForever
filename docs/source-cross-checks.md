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

**THE HAWK'S 32 PER STRIKE IS IN NEITHER SOURCE.** Both state one figure and it is
not that one — our capture says the hawk dive-bombs for **108** and "continu[es]
its assault for 18 sec", `foreverchanges.pro` says **110**, and neither quantifies
the continuing assault, which is exactly what the constant models. Reading 108 as
the per-strike rate would more than triple the hawk; reading it as an opening hit
would add a damage source. That is a modelling decision for the owner, so it is
recorded and left alone.

## Every class is now checked

| Class | Agreed | Moved | Largest |
| --- | --- | --- | --- |
| Warrior | — | 5 | Slam, Thunder Clap, Bloodthirst, Demo Shout, Battle Shout |
| Warlock | 7 of 10 | 3 + a cost | **Life Tap 424→840**, +12.1% Firelock |
| Rogue | 10 of 12 | 2 | Backstab 225→150, worth nothing (nothing casts it) |
| Priest | 5 of 7 | 2 | Mind Blast 490→485 |
| Mage | 10 of 13 | 3 | Fire Blast 453→438 |
| Shaman | 6 of 9 | 3 | Lightning Bolt 200→196 |
| Paladin | 7 of 12 | 5 | **Holy Strike 37→93**, +10% Ret, +13.5% Prot |
| Druid | 10 of 13 | 3 + a rename | **Wrath 65→91** |
| Hunter | 9 of 11 | 1, four fields | **Sniper Shot**, −11.1% LW Ranged |

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

Nothing, for abilities. What has NOT been cross-checked is **talent values**
(`src/data/talents/values/*.json`), which come from `talentsforever.com` alone and
have no second source at all.

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
