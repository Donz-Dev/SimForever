# Implementing a class

The Warrior took months. The other eight did not, and this is the process that
made the difference: **every number comes from the beta client, fetched by a
tool, before any of it is written by hand.**

**All nine classes and 23 profiles are now built this way.** The steps below
are kept because they are also the process for CORRECTING one, and because a
tenth class or a new profile would follow them unchanged. See
[HANDOVER.md](../HANDOVER.md) for what each class actually has.

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
"Forever inherited this". Its data is in the page's RSC payload rather than the
DOM; `tools/import_forever_spells.mjs` does the extraction.

## Before starting a class: does the engine already do it?

[HANDOVER.md](../HANDOVER.md) carries the open engine gaps, with the talents
each one would retire. **Every feature the original survey named has since been
built** — combo points (which turned out to be content, not engine), channelled
casts, and pets — so the question is now which of the few remaining gaps a class
needs, not whether the big ones exist.

**Sequence by shared mechanism, not by class.** Ordering alphabetically would
have built Druid's forms — which already existed — before combo points, which
Cat Druid and all three Rogues were equally waiting on. That ordering held for
all nine.

**And check which cause an inert talent has.** The survey called five profiles
pet-blocked and four of them take a talent meaning "I bring no pet" — Lone
Wolf, or Demonic Sacrifice. A build's own choice is not an engine gap. See
CLAUDE.md, "Reading a class accurately".

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
> Wowhead scrape had three wrong talents in 468 — 99.4% accurate — and that
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

Read [warrior.md](warrior.md) first — it holds every trap this project has hit
reading Forever's spell data, and all of them are class-independent:

- **A talent tooltip shows rank 1** of the ability it grants, not the rank a
  level 60 has. FIVE separate arguments were the same misreading — Mortal
  Strike, Bloodthirst, Shield Slam, Lava Burst and Pyroblast, one per class
  with a damage-granting capstone.
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

## Auditing a tree once it is written

Ordered. Step 2 is wasted before step 1.

1. **Re-read every `unmodelled` reason before trusting one.** A reason is a
   claim about the engine on the day it was written and it does not re-check
   itself. This has been wrong eight times, and twice a talent was fully working
   while telling the user on screen that it could not fire.
2. **Make the effect observable before judging it.** Three Arms talents were
   "unclear" only because nothing on screen could show them: Deflection grants
   parry, which appears only on attacks RECEIVED, and Improved Heroic Strike
   reduces a cost, so the ability hits for exactly the same amount and a damage
   table cannot show it at all. If an effect has nowhere to appear, build the
   telemetry first — an audit without it produces "seems fine", which is not a
   finding.
3. **Check the build is legal.** `talentRules.isLegal` is enforced in
   `createPlayer` and `abilitiesForClass` — the two places a character is built
   — and deliberately NOT in `talentBuild`, so a unit test spending five points
   on one talent does not have to spend twenty-five more.
   `tests/helpers/legalise` pads an allocation with tier-0 filler. A talent's
   own rank does not always open its own gate: `{ careful_aim: 5 }` is legal and
   `{ careful_aim: 1 }` is not, and `createPlayer` strips the illegal one
   SILENTLY.
4. **Test each talent against the SOURCE, twice, independently.** The expected
   value written out by hand from the tooltip, AND the stored tooltip asserted
   to contain that same number. A test that read the constant would pass
   whatever the constant said. A typo fails the second check; upstream drift
   fails `--verify`. Writing these is what finds the bugs — testing Impale's
   wording is what exposed `AbilityModifiers.for(ALL_ABILITIES)` returning
   double.
5. **Measure by ablation, not by addition.** Remove the talent from a real build
   and re-run; the figure that matters is what dropping it costs. A difference
   smaller than the combined 95% intervals is not a difference — say that rather
   than reporting it.

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
