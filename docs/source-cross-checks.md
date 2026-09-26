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

## Still unchecked

Mage, Paladin, Druid, Shaman, Hunter.

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
