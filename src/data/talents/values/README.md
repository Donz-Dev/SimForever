# Talent values

What each talent's number is, at each rank. One file per class, **hand-editable**.

469 talents. A value of `null` means *not known yet* — never zero, and never
standing in for a number nobody has.

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
`docs/warrior.md` records the decision. Nothing here should quietly
overwrite a value the owner supplied.

That is also why `fill` never overwrites an existing value without
`--overwrite`: a hand-entered correction survives a refresh of the capture.

## Status

**The Warrior is captured. The other eight classes are not.**

| | Warrior | Other eight |
| --- | --- | --- |
| Values filled | 41 | 0 |
| Single rank (no variable to identify) | 12 | — |
| Not captured | none | all |

The capture was verified against the talent structure already in the repo, which
was scraped independently months earlier by a different method: **all 53 rank-one
texts matched exactly**. That is a real cross-check, not a self-consistency one.

### Assuming linear ranks would have been wrong

Three of the Warrior's 41 multi-rank values do not follow `rank one x n`:

```
improved_rend      12, 23, 35     (not 12, 24, 36)
improved_execute    3,  5         (not 3, 6)
improved_disarm     7, 13, 20     (not 7, 14, 21)
```

Seven percent, wrong by a little, in a way nothing downstream could have
detected. This is the argument for capturing values rather than extrapolating
them, and it is no longer hypothetical.

### The Protection tree has changed since the structure was scraped

The live calculator and `../warrior.json` disagree about two things, and the
live calculator is the newer of the two:

| | `../warrior.json` (scraped earlier) | Live calculator |
| --- | --- | --- |
| `bastion` | Protection, row 5, col 2, 5 ranks | **not present** |
| `focused_rage` | Protection, row 5, col 0 | Protection, row 5, **col 2** |

So Forever removed Bastion and moved Focused Rage into its place. **Both have
now been corrected in `../warrior.json` by hand** — the only hand edit that file
has ever taken — because leaving them would have meant the app offering a talent
the ruleset does not have. The hand-transcribed counts in
`tests/game/talents.test.ts` were updated with the reason beside them, and the
Warrior is now 53 talents rather than 54.

**The rest of that file has not been re-scraped.** Bastion was found only
because capturing values tripped over it; the eight classes with no values
captured yet may have drifted the same way and nobody would know.

### Filling the rest

Two documented steps, above. Nothing is blocked; wowhead rate-limited an earlier
attempt at all nine classes in one sitting, so do them a few at a time.
