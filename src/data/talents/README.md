# Talent data

> **SOURCE CHANGED 2026-09-23.** These files now come from the WoW Forever beta
> client, via `talentsforever.com/talents.js`, imported by
> `tools/import_forever_talents.mjs`. They were scraped from
> `wowhead.com/forever/talent-calc` before that.
>
> The scrape was 468 of 469 talents correct, and the three it got wrong were
> still fatal: talentsforever encodes a saved build as one digit per talent in
> tree order, so a tree of the wrong length or order decodes a profile into
> different talents. See [docs/class-implementation.md](../../../docs/class-implementation.md).
>
> | | ours was | the client says |
> | --- | --- | --- |
> | rogue / combat | Restless Blades | **Flawless Execution** |
> | warlock / affliction | Drain Hope | **Wrack** |
> | druid / balance | Balance of Nature | *not in the client at all* |
>
> The instructions below describe the old browser scrape. They are kept because
> the Wowhead calculator is still a useful second opinion, and because the
> selectors took a while to work out.

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
