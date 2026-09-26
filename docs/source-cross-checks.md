# Source cross-checks, per class

The Warrior's numbers were checked against four sources and **eight of them turned
out wrong**. Every other class was built from `talentsforever.com` alone. This
file records what happens when a second source is put beside one of them, class
by class, so the accuracy question has an answer other than "nobody looked".

**Where the two agree, confidence rises. Where they disagree, neither wins here**
— the ruleset owner adjudicates, because both are client-derived and there is no
owner-supplied spreadsheet for any class except the Warrior. Do not average them
and do not quietly prefer the newer.

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

**Four disagree, and all four are open questions for the ruleset owner.** Nothing
was changed on the strength of either source.

| | `talentsforever` (ours) | `foreverchanges.pro` | Worth |
| --- | --- | --- | --- |
| **Life Tap** r6 | **424** health to mana | **840** | **+13.5% on Firelock** — measured |
| **Shadowburn** r6 | 258 to 288 | 251 to 281 | small |
| **Searing Pain** r6 | 107 to 125 | 105 to 123 | small |
| **Shadowburn cost** | `Reagents: Soul Shard` | `365 Mana` | gates the ability on the wrong pool |

**LIFE TAP IS THE ONE THAT MATTERS, AND IT IS NOT A STALENESS PROBLEM.** Our
capture was refreshed from build 69876 to 70009 during this check, which is the
same build `foreverchanges.pro` reads, and talentsforever still says 424. The
tooltip *rewording* that site flags for 24 September is real — the duplicated
"Mana gained is increased by your Spirit" sentence is gone — and the two sources
disagree on the number underneath it.

It is worth measuring rather than guessing. At 424 against 840, over 300
iterations at seed 12345:

| | 424 | 840 | |
| --- | --- | --- | --- |
| Firelock | 479.1 | **543.7** | **+13.5%** |
| SM/DS | 331.7 | 333.8 | +0.6%, inside noise |

**Destruction is mana-bound and Affliction is not**, which is why one moves and
the other does not. Life Tap is in both priority lists and is the mana engine for
both, so this single unresolved number is the largest open figure on the class.

**THE SHADOWBURN COST IS A DIFFERENT KIND OF DISAGREEMENT.** talentsforever lists
a Soul Shard reagent and no mana; `foreverchanges.pro` lists 365 mana and carries
no reagent field at all. In Classic the spell costs **both**, so the likeliest
reading is that each source shows the half its own data model holds. The simulator
charges one soul shard and no mana, which follows our source faithfully and would
understate the cost if both apply — and it matters more than 365 mana sounds,
because shards come from `PLACEHOLDER_SOUL_SHARDS` with no in-fight income.

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
