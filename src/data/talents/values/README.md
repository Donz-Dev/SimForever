# Talent values

What each talent's number is, at each rank. One file per class, **hand-editable**.

470 talents. Every value starts as `null`, meaning *not known yet* — never
meaning zero, and never standing in for a number nobody has.

## Why this is separate from `../<class>.json`

`../<class>.json` is scraped **structure**: rows, columns, prerequisites, rank
caps, icons. It is never hand-edited, and refreshing it means re-running the
scrape described in [`../README.md`](../README.md).

Balance numbers change far more often than a tree's shape does, and they are
exactly the thing a person wants to open and edit. Splitting them means changing
what Flurry grants is a one-line edit to a readable file, and that edit cannot
disturb the tree it belongs to.

## Shape

```json
{
  "class": "warrior",
  "source": "https://www.wowhead.com/forever/talent-calc/warrior",
  "structure": "src/data/talents/warrior.json",
  "talents": {
    "improved_heroic_strike": {
      "name": "Improved Heroic Strike",
      "tree": "arms",
      "ranks": 3,
      "text": "Reduces the cost of your Heroic Strike ability by {0} Rage.",
      "values": [1, 2, 3]
    }
  }
}
```

The key is the talent id, slugified from the name exactly as `talentId` in
`src/game/talents/talentData.ts` does it. **Ids are unique within a class, not
across classes** — `deflection` belongs to four of them — which is why these are
per-class files and not one big map.

## What a value is

Nearly every talent varies **one** number as it ranks up, and that number is the
only thing worth storing:

```
Improved Heroic Strike    1, 2, 3
Flurry                    5, 10, 15, 20, 25
```

`{0}` in `text` marks where the value goes. A number that does **not** change
between ranks stays written into the text, because it is not the variable —
Flurry's "next 3 swings" is the same at every rank, so only the attack speed is
stored:

```json
"text": "Increases your melee attack speed by {0}% for your next 3 swings after dealing a melee critical strike.",
"values": [5, 10, 15, 20, 25]
```

A talent that varies two numbers uses `{0}` and `{1}`, and each rank is a pair:

```json
"values": [[10, 2], [20, 4], [30, 6]]
```

## Three kinds of entry that are not a plain list

| Field | Meaning |
| --- | --- |
| `"values": null` | Not known. Nothing may read this as a number. |
| `"note": "single rank"` | One rank, so nothing varies and no variable can be identified from the text alone. Fill it in by hand if the effect needs one. |
| `"irregular": "<reason>"` | The ranks are not one sentence with a different number — a higher rank adds a clause, say. `rankText` holds every rank verbatim so a person can decide. |

## Editing by hand

Change a number, save. That is the whole workflow, and it is the point of the
file. Nothing regenerates it behind your back: `tools/derive_talent_values.js
skeleton` preserves every entry that already has values, and `fill` will not
overwrite one unless you pass `--overwrite`.

## Refilling from the calculator

```bash
# 1. Open https://www.wowhead.com/forever/talent-calc/<class>
#    Paste tools/talent_ranks_browser.js into the console.
#    TalentRanks.run('<class>')  then poll  TalentRanks.status()
#    Click the COPY button it shows, then:
#      Get-Clipboard -Raw | Set-Content -Encoding utf8 <class>-ranks.json

# 2. Fold it in
node tools/derive_talent_values.js fill <class>-ranks.json
```

The per-rank text is not in the page's HTML and there is no API carrying it: the
calculator rewrites the tooltip as points go in, so reading rank three of a
talent means putting three points into it. `tools/talent_ranks_browser.js` does
that, and its header documents the three ways it can go quietly wrong.

**A capture that is not complete is rejected rather than saved.** An earlier
attempt at this produced a file where 48 of 53 talents had `null` where their
text should be, and it hashed and transferred perfectly — a checksum proves
bytes arrived intact, not that they were worth sending. So the browser side
refuses to hand over a partial capture, and `fill` skips any talent whose ranks
are not all present.

## The calculator is a source, not an authority

Where the ruleset owner has given a number directly, **that number wins** and the
calculator's is wrong. Mortal Strike is the worked example: the calculator's
tooltip says weapon damage "plus 85", the owner confirmed **160**, and
`docs/warrior-abilities.md` records the decision. Nothing here should quietly
overwrite a value the owner supplied.

That is also why `fill` never overwrites an existing value without
`--overwrite`: a hand-entered correction survives a refresh of the capture.

## Status

**Three of 470 values are filled in; the rest are `null`.**

Improved Heroic Strike (1/2/3), Deflection (1–5) and Flurry (5/10/15/20/25) were
read directly off the calculator and are real. They are here because they prove
the whole path works, end to end, and because they show the format on genuine
data rather than an invented example.

The bulk run has **not** been done. Wowhead began returning 403 partway through
capturing the nine classes, and the answer to that is to wait rather than to
push harder. Run the two steps above when it lets you back in; every remaining
`null` is a number nobody has yet, not a zero.
