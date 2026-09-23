# Warrior talent audit against the beta client

All 53 Warrior talents checked against <https://talentsforever.com/warrior> on
**2026-09-23**, which reads the WoW Forever beta client, build
**`1.60.1.69876`**.

**Nothing was wrong.** This is the first audit in this project to find no
errors in the data, and that is worth recording as plainly as a list of
corrections would be.

## What was checked, and how

Our talent data has two halves, and both were compared:

| | |
| --- | --- |
| `src/data/talents/warrior.json` | The **structure** — tree, name, rank count, row and column |
| `src/data/talents/values/warrior.json` | The **numbers** — every rank's text and its values |

Both were scraped from `wowhead.com/forever/talent-calc/warrior`. The new site
is independent of that one: it reads the client's own files rather than a
rendered page, and it exposes them as `window.TALENT_DATA`, so no scraping is
needed to check it.

**The comparison was on the numbers, not the prose.** Every number was pulled
out of each rank's text on both sides and the sequences compared, because the
two sites word some tooltips differently while agreeing on every figure —
Precision reads "Improves your chance to hit by 3%" there and "Increases your
chance to hit with all abilities and attacks by 3%" here.

## Result

| | |
| --- | --- |
| Talents | **53 of 53** match: same tree, name, rank count and position |
| Rank values | **154 of 154** match |
| Real differences | **none** |

The single flagged row was `Improved Slam`, where a rank value renders as `0.5`
here and `0.50` there. Same number.

Our `warrior.json` is 0-indexed on row and column and the site is 1-indexed;
every talent sits in the same cell once that is allowed for.

## What the audit did find

### A talent tooltip shows rank 1, and that explains three old arguments

This is the finding worth carrying to the other eight classes.

| Ability | Talent tooltip | Level 60 | Spreadsheet |
| --- | --- | --- | --- |
| **Mortal Strike** | 85 | **160** | 160 — max rank |
| **Bloodthirst** | 30 | **48** | 30 — rank 1 |
| **Shield Slam** | 421 to 439 | **640 to 670** | 421 to 439 — rank 1 |

A talent grants **rank 1** of the ability, so its tooltip describes rank 1.
Mortal Strike's ranks are 85 / 110 / 135 / 160 at levels 40 / 48 / 54 / 60,
and a level 60 warrior trains the rest from a trainer.

Three arguments this project has had — one of them escalated to the ruleset
owner and recorded in HANDOVER as "resolved, do not re-litigate" — were the
same misreading. **The talent calculator was never wrong about any of them.**

**The spreadsheet mixes the two conventions**, which is why it could not settle
the question: Mortal Strike is max rank in it, Bloodthirst and Shield Slam are
rank 1. Every figure the code uses is max rank, which is the only rank a level
60 simulator can reach.

### Two `unmodelled` reasons had expired

Both were **false statements about the engine**, shown to users in the Talent
panel. Neither talent's behaviour changed — both are still inert — but the
reasons now say something true and checkable.

| Talent | Said | Why that was wrong |
| --- | --- | --- |
| **Vanguard** | "Stances gate nothing." | Fourteen Warrior abilities carry a `stances` list, Charge among them, and `casting.ts` refuses a cast in the wrong stance. True when written; false since. |
| **Improved Berserker Rage** | "inert pending its effect values from the ruleset owner" | The values have been in `values/warrior.json` since the talents were captured: 5 Rage and 50% at 1/2, 10 and 100% at 2/2. |

Both are inert for the same smaller, checkable reason: **no priority list casts
Charge or Berserker Rage.** Vanguard has a second reason on top — Charge cannot
be used in combat, and every fight here opens in it.

This is the third and fourth time a stale reason has been caught. The rule in
CLAUDE.md exists because of the first two.

## Talents Forever removed from Classic

Recorded because their absence is a fact about Forever rather than a gap in our
data, and because one of them is named in our own comments.

| Tree | Removed |
| --- | --- |
| Arms | Axe, Mace, **Sword** and Polearm Specialization |
| Fury | Improved Demoralizing Shout, Improved Battle Shout |
| Protection | Improved Shield Block, Improved Taunt, One-Handed Weapon Specialization |

**Sword Specialization does not exist in Forever.** Its extra-attack mechanic
does — `Weaponmaster`'s sword clause is the same effect, and that is what the
engine implements. Comments that name Sword Specialization as the source of the
extra-attack rules are describing WoW Classic, not this ruleset.

Forever adds ten talents Classic has no equivalent for: Spearing Strike,
Bloodthrill, Weaponmaster, Boundless Rage, Raging Blows, Precision, Master of
Defense, Vanguard, Bastion and Focused Rage. All ten are in our data.

## Refreshing this

```js
// on https://talentsforever.com/warrior, in the console
window.TALENT_DATA.Warrior.trees   // [{name, talents: [{name, max, row, col, desc[], classic}]}]
```

`desc` is one entry per rank, already rendered. `classic` carries `status`
(`same` / `changed` / `moved` / `new`) and the Classic text, and each tree
carries a `removed` list.

No clipboard is involved, so nothing of the user's is overwritten.
