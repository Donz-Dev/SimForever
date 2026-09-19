# Talent data

One file per class, read out of the World of Warcraft: Forever talent
calculators at `https://www.wowhead.com/forever/talent-calc/<class>`.

**469 talents across 27 trees.** Nine classes, three trees each.

Forever REMOVED the Warrior's Bastion and moved Focused Rage into its slot,
which is the one hand edit this data has ever taken. See
`values/README.md`; the other eight classes have not been re-checked.

## How these were produced

Not typed by hand, and not fetched with a script either. The calculator renders
its grid client-side, so the data is not in the page's HTML and there is no API
call carrying it — a plain `fetch` returns a page with no talents in it.

They were read out of the rendered DOM in a browser, where each cell carries
what is needed:

| Where | What |
| --- | --- |
| `.ctc-tree-talent` | `data-row`, `data-col`, `data-max-points` |
| `data-error-message` | the tier requirement and the prerequisite |
| the child `<a>`'s `data-simple-tooltip` | the name and the rank-one text |
| the `<ins>` background image | the icon |

Each file was then checked: the extracted text was hashed with SHA-256 in the
browser, and the written file had to hash to the same value. So these are the
bytes the page produced, not a transcription of them.

To refresh a class, repeat that and replace its file. `talentData.ts` validates
the shape on load and throws rather than quietly accepting a tree with a broken
arrow, so a page that changes structure fails loudly.

## Shape

```json
{
  "class": "warrior",
  "source": "https://www.wowhead.com/forever/talent-calc/warrior",
  "trees": [
    {
      "id": "arms",
      "name": "Arms",
      "talents": [
        {
          "row": 0, "col": 0, "ranks": 3,
          "name": "Improved Heroic Strike",
          "icon": "ability_rogue_ambush",
          "tier": 0,
          "requires": null,
          "requiresRanks": null,
          "description": "Reduces the cost of your Heroic Strike ability by 1 Rage."
        }
      ]
    }
  ]
}
```

`requires` holds a talent NAME; `talentData.ts` slugifies it into an id.

## Two things worth knowing

**Talent ids are unique within a class, not across classes.** `deflection`
belongs to the Hunter, Paladin, Rogue and Warrior, with different rank caps and
different rows; `toughness` and `precision` are shared three ways. Anything
looking a talent up must know which class it is asking about — which is why
every function in `talentRules.ts` takes a `ClassTalents`.

**A prerequisite is not always above the talent that needs it.** The Paladin's
Divine Precision and the Priest's Improved Mind Flay each point SIDEWAYS at a
neighbour on the same row. Nothing may assume a strictly higher row.

## No talent does anything

These are names, positions and text. No talent has an implemented effect, so a
full build and an empty one produce identical simulation results.
