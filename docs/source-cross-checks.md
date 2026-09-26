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

## Still unchecked

Rogue, Priest, Mage, Paladin, Druid, Shaman, Hunter. The Rogue and the Priest are
the highest value: the Rogue has the second-largest live talent gap and the Priest
the largest, so an error there is least likely to be noticed.

**Two of the two classes checked so far needed corrections** — five figures on the
Warrior, three on the Warlock — so treat the remaining seven as a backlog rather
than a formality. Each is about twenty minutes.

**ONE TENSION TO SETTLE EVENTUALLY:** the importer reads `talentsforever.com` and
the tie-break is `foreverchanges.pro`, so every class will keep producing
constants that deliberately disagree with their own checked-in capture. That is
honest and flagged in each comment, but it means the captures are a record of the
losing source. Switching `import_forever_spells.mjs` to read the RSC payload
instead would remove the split — worth raising with the owner rather than deciding
here, since it changes where all nine classes' data comes from.
