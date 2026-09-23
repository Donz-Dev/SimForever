# Implementing a class

The Warrior took months. The other eight should not, and this is the process
that makes the difference: **every number comes from the beta client, fetched
by a tool, before any of it is written by hand.**

## The data pipeline

talentsforever.com serves the beta client's own files as four static
JavaScript assignments. Plain `fetch` reaches all of them — no browser, no DOM
walk, no clipboard.

| | | |
| --- | --- | --- |
| `talentsforever.com/talents.js` | 429 KB | Every class's trees, every rank's text, prerequisites, and the granted ability's cost line |
| `talentsforever.com/spellbooks.js` | 179 KB | Every trainer spell to 60, every rank |
| `talentsforever.com/spelldesc.js` | 768 KB | Spell descriptions with cast, range and cooldown |
| `talentsforever.com/racials.js` | 18 KB | Racials, by faction and race |

`foreverchanges.pro/spellbook/<class>` covers the same spells with a **Classic
diff** beside each one, which is what tells "Forever changed this" from
"Forever inherited this". Its data is in the page's RSC payload; see
[warrior-ability-audit.md](warrior-ability-audit.md) for the extraction.

## Before starting a class: does the engine already do it?

[engine-gap-survey.md](engine-gap-survey.md) answers that for all twenty
profiles, checked against the code rather than assumed. The short version:
**fourteen of the twenty need no engine change at all**, and the three features
that block the rest are combo points (content, not engine), channelled casts,
and pets.

**Sequence by shared mechanism, not by class.** Ordering alphabetically would
have built Druid's forms — which already exist — before combo points, which
Cat Druid and all three Rogues are equally waiting on.

## The steps

### 1. Refresh the talent data

```bash
node tools/import_forever_talents.mjs --check   # diff first
node tools/import_forever_talents.mjs --write
```

Writes `src/data/talents/<class>.json` and `values/<class>.json` for all nine
classes, validates every invariant `talentData.ts` enforces, and **merges
rather than overwrites**: a single-rank talent's hand-filled value survives,
because its text carries a number and nothing says which number is the
variable.

### 2. Decode the profile's talent build

Each profile is specified by a talentsforever.com URL.

```bash
node tools/decode_talent_build.mjs --profiles          # all of them
node tools/decode_talent_build.mjs <url> --verbose     # one, with the allocation
```

**The encoding is positional**: one digit per talent in tree order, trees
separated by `-`, trailing zeroes dropped.

> **This is why step 1 comes first.** Position is the only key there is. Our
> Wowhead scrape had three wrong talents in 469 — 99.4% accurate — and that
> was still fatal. With the old Druid tree, the Moonkin build fails loudly
> ("Insect Swarm given 5 of 1 ranks") and the **Cat build decodes cleanly to
> 51 points with the wrong talents**, because its Balance segment stops before
> the divergence. One shouts; the next lies.

### 3. Import the abilities

```bash
node tools/import_forever_spells.mjs rogue            # look
node tools/import_forever_spells.mjs rogue --write    # write the JSON
node tools/import_forever_spells.mjs --all --write    # every class
```

**Max rank only**, by construction — the rank a level 60 trains, which is the
one thing this data set makes easy to get wrong.

It does NOT carry the effect rows that a spell page has, because it does not
need to: those existed to recover numbers Forever's own tooltip hid behind
"(100% of Spell Power)", and this source renders the real figures instead.

Read [warrior-abilities.md](warrior-abilities.md) and
[warrior-ability-audit.md](warrior-ability-audit.md) first — between them they
hold every trap this project has hit reading Forever's spell data, and all of
them are class-independent:

- **A talent tooltip shows rank 1** of the ability it grants, not the rank a
  level 60 has. Three separate arguments were the same misreading.
- **Read the effect rows, not only the description.** Base points run one
  higher than the stated figure, and a description can disagree with its own
  row (Demoralizing Shout said 210 above a row saying −195).
- **Check `max_rank` before reading a number.** Forever shifts ranks down and
  sometimes adds one, and the spellbook opens a spell on a rank that is not
  always the max. Slam's damage went 87 → 68 → 87 on that.

### 4. Write the content

`game/abilities/<class>.ts`, `game/auras/<class>.ts`,
`game/talents/<class>Effects.ts`, `game/rotations/<class>.ts`. The Warrior's
are the worked example for all four.

**Rules go in `engine`, numbers go in `game`.** A class needing a rule the
engine does not have — a combo point, a pet, a shapeshift form — is an engine
change first, and it should be general rather than named after the class that
wanted it.

### 5. Add the profile presets

`src/profiles/presets.ts`. A preset sets **every** field, never inheriting any,
or it behaves differently depending on what was on screen when it was pressed.
See the note in that file on why a build is five settings that have to agree.

## What to ask about rather than guess

The standing rules in [CLAUDE.md](../CLAUDE.md) apply, and two come up in
almost every class:

- **If an ability being able to proc effects is in question, ask.** A wrong
  answer does not look wrong — Windfury spent its whole life refusing abilities
  and every figure was self-consistent and too low.
- **Never invent a missing number.** Name it `PLACEHOLDER_*`, say so in a
  comment, and surface it where a person can see it.

## What the Warrior cost, and where it went

Worth knowing before starting another class, because almost none of it was
typing the abilities in.

| | |
| --- | --- |
| Engine rules the Warrior needed | swing timers, stances, extra attacks, the attack tables, rage, on-next-swing, reactions |
| Numbers corrected after first being wrong | Slam, Thunder Clap, Bloodthirst, Demoralizing Shout, Battle Shout, Shield Wall, Mortal Strike |
| `unmodelled` reasons that expired and had to be re-read | four |
| Tests that passed for the wrong reason | three, all probabilistic or rolled |

The engine work is mostly done and is shared. The corrections are what this
pipeline is for.
