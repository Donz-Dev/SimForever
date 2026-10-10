# GUI DEEP DIVE

**Purpose:** finalize the GUI and the miscellaneous tweaks around it.

**THE FIRST PASS IS DONE, AND THIS DOCUMENT IS NOW ITS RECORD** rather than its
brief. Everything below that reads as outstanding work is marked with what
happened to it. Read it the way the per-class documents are read: for the state
of the area and the traps in it, not for a queue.

Read [CLAUDE.md](../../CLAUDE.md) first — it is the rules, and about a fifth of it
is lessons paid for in wrong numbers. Then this file.

---

## The project you are joining

A combat simulator for **WoW: Forever**, a custom ruleset based on Classic.
TypeScript + React + Vite + Vitest. **The simulation is finished to a usable
standard; the UI is the part that has not been looked at.**

| | |
| --- | --- |
| **Classes** | 9, all implemented. **Four are essentially done** — Warrior 0 live gaps, Paladin 2, Druid 2, Rogue 3 |
| **Talents** | 468: 258 fully, 36 partly, 110 ruled out by the owner, **64 a live gap** — down from 132 |
| **Abilities** | 114 declared against 478 captured |
| **Profiles** | 23, each the ruleset owner's own build URL, each with its own gear and priority list, all measured |
| **Baseline** | 30 batches of 10, **mean 488.3**, top Cat Druid 656.1, bottom Prot Pally 270.1 |
| **Tests** | 2,275, CI green on Node 20 and 22 |

**HOW IT GOT HERE:** nine parallel per-class deep dives, one context each, merged
one at a time. Then the Hunter moved twice more — its pet and hawk model were
corrected twice, taking BM Hunter from a placeholder-inflated **788.1 down to
547.0** -- first to 646.6 and then again. **Treat every figure in these documents as
a claim with a date on it**: that one went stale inside an hour. [HANDOVER.md](../../HANDOVER.md) is the full recap.

**WHAT THAT MEANS FOR YOU:** the numbers behind every panel are settled and
measured. If a figure on screen looks wrong, **suspect the panel, not the engine**
— that is the opposite of the assumption that was correct six months ago, and the
two bugs below are both exactly that.

---

## Running it

```bash
npm run dev          # port 5173, or the next free one
npm test
npm run typecheck
```

**USE THE PREVIEW TOOL RATHER THAN BASH FOR THE DEV SERVER.** `.claude/launch.json`
has `simforever-dev` configured. Two things will bite you:

- **Other sessions hold ports**, and **the log's port can be someone else's.**
  5173-5176 were all taken while this brief was written. Reading the port out of
  `preview_logs` is what this brief used to advise, and in the GUI pass that led
  straight to another session's server: the fix is to check what the dev server
  is actually SERVING. Fetch a module and read the `fileName` in its sourcemap
  -- it is an absolute path, so it names the checkout.
- **The dev server runs from the repo root**, which other sessions check out onto
  their own branches. If the app does not match `main`, check what branch the root
  is on before debugging the code. **This cost time already**: the raid-buffs panel
  showed 12 buffs where `main` has 17, and the panel was right — the checkout was
  stale.
- **AND `preview_start` LAUNCHES IN THE REPO ROOT EVEN FROM A WORKTREE.** Entering
  a worktree moves the session; it does not move the dev server, which went on
  serving another branch while the edits landed somewhere else entirely. The
  symptom is a change that will not appear however hard you reload. Run vite from
  the worktree and point the browser at that port instead.

### It works today

Pick a preset → **Run Simulation** → a full stack renders: DPS and distribution,
a damage table with uses, share, crit, glance and avoided per ability, buff and
debuff uptime, a resource timeline, and a combat log. 2H Arms comes back at
**606.6** against a published **603.3** — that is the batch-versus-profile
difference and not a bug, and CLAUDE.md explains it under **Verifying work**.

---

## The two known bugs, and what happened to them

**NEITHER WAS FIXED THE WAY THIS BRIEF EXPECTED, AND ONE WAS NOT FIXED AT ALL.**

### 1. The Talent panel listed working talents as gaps — DISSOLVED, NOT FIXED

`appliedElsewhere` names a talent whose effect is applied by another module --
Vile Poisons and Improved Poisons both work, read by the poison reactions.
`TalentPanel.tsx` split `unmodelled` on `scope === undefined` alone, so those
landed in the gaps list and were shown as missing work.

**The owner then removed the gap list entirely**, along with the Gear, Raid
buffs and Results equivalents: that reporting is for this repository, not for
someone running a sim. So there is no bucket left to land in and the bug cannot
occur -- **but the classification was never corrected.** If any of those lists
ever comes back, this comes back with it. `tools/class_audit.ts` counts
`appliedElsewhere` correctly and always did.

### 2. The Talent panel was collapsed by default — SETTLED, AND GENERALISED

Decided on purpose, and the opposite way to what this section suggested:
**every configuration panel is collapsible now and every one starts shut.**
Character sheet, Encounter, Talents, Gear, Raid buffs and the combat log. Only
Simulation and Results cannot be shut -- one holds Run, the other is what the
run was for.

The state lives in `Panel`, not in `App`. It was in `App` for the Talents panel
alone, which is why `applyPreset` had to remember to shut it; five panels doing
that would have been five chances to forget.

**A shut panel is a title and nothing else**, so `Panel` takes a `badge` and
each says the thing you would have opened it to check -- Talents `17/0/34`,
Gear `17 equipped`, Encounter `Training Dummy · level 63 · swings back`, the
combat log `207 lines`.

### And three bugs nobody had filed

- **A DUPLICATE REACT KEY THE PROSE WAS HIDING.** Weaponmaster carries three
  unmodelled clauses sharing one `talentId`, so the panel rendered three `<li>`s
  with `key="weaponmaster"` and React logged it on every build that takes it.
  Invisible while the three rows had differing reason text; obvious the moment
  the reasons were cut. Retired with the list.
- **`.panel` IS `overflow: hidden`, SO WIDE CONTENT WAS CLIPPED RATHER THAN
  SCROLLABLE.** The damage-taken table is 14 columns, and its last ones were
  unreachable **at full desktop width**, not just on a phone. Nothing looked
  broken -- the table just stopped. `.panel-body` is `overflow-x: auto` now and
  the table was compressed to fit.
- **A MEDIA QUERY THAT NEVER APPLIED.** The profile rail's wrapped layout was
  defined with the layout breakpoints, which is BEFORE the base `.profile-rail`
  rule in the file -- equal specificity, later wins. At 1000px the pills
  rendered 474px wide. It only shows between 900 and 1200px, which is why a
  1500px check and a 375px check both missed it. **Check the band between your
  breakpoints, not only the ends.**

---

## What the UI is made of

4,653 lines, and **1,379 of them are `styles.css`** — the largest single file by
some way, and the first place to look for anything visual.

| | |
| --- | --- |
| `App.tsx` (199) | composition and layout. Every panel is wired here |
| `panels/ResultsPanel.tsx` (422) | the biggest panel: DPS, distribution, the damage tables, uptimes |
| `panels/CharacterSheetPanel.tsx` (335) | the stat block |
| `panels/GearPanel.tsx` (331) | 19 `<select>`s |
| `panels/CharacterPanel.tsx` (324) | creation, and the confirmed one-line summary |
| `panels/TalentPanel.tsx` (201) | the three trees. **Was 359** before the lists came out |
| `panels/RaidBuffsPanel.tsx` (145) | 21 checkboxes, 17 on by default |
| `panels/EncounterPanel.tsx` (112) | the target, and whether it swings back |
| `components/Panel.tsx` (85) | **the collapse lives here**, with `badge` |
| `panels/ProfileRail.tsx` (72) | the 24 class-coloured pills |
| `panels/ProfilePanel.tsx` (83) | **not mounted.** See below |
| `charts/` | `DonutChart`, `ResourceTimeline`, `UptimeBars` — hand-rolled SVG, no chart library |
| `hooks/useSimulation.ts` (68) | the only bridge to the simulator |

**There are no TODOs or FIXMEs in `src/ui`.** Whatever is unfinished is unfinished
silently -- which is how two dead buttons survived this whole pass.

**ONE UI TEST EXISTS**, `tests/ui/themes.test.ts`. It was two;
`talentScopeCaption.test.ts` was deleted with the caption it tested. The panels
are not rendered by any test, so **anything you change you have to look at.**

---

## The rules that matter here

- **THE ENGINE IS COMPLETELY INDEPENDENT OF THE UI.** `src/engine` imports no
  React, touches no DOM, holds no module-level mutable state. The dependency arrow
  is `ui → simulator → engine`, and **nothing may point back up**. If a panel needs
  something the engine does not expose, the fix goes in `simulator`, not in the
  engine and not in the panel reaching past it.
- **THE UI RUNS `runProfileBatch`, NOT `runProfile`.** Even at one iteration the
  batch derives its own seed, so the browser is showing a different fight from
  `runProfile`. Before chasing a mismatch, check the two numbers are supposed to
  match at all.
- **IF THEY SHOULD MATCH AND DO NOT, SUSPECT A STALE VITE CACHE** before suspecting
  the code. Restart with `npm run dev -- --force`. Those two are in that order
  deliberately: the cache warning is the memorable one, and reading it first has
  cost a long detour before.
- **TELEMETRY IS THE SINGLE SOURCE OF TRUTH.** Every panel reads the same event
  stream the analyzers do. A new statistic is a new analyzer, **never a counter
  threaded through combat code**, and never a number computed in a panel.
- **CHECK A NUMBER IS ABOUT WHAT ITS LABEL SAYS.** `resourceFlow` once summed every
  pool a character owned under a heading reading "Rage" — a Rogue's energy and
  combo points added together, shares totalling a tidy 100%, nothing on the page
  contradicting it. **Two tests depended on it.** The resource panel is keyed by
  resource now, but the lesson is the one to carry into any aggregate you add.
- **AN INERT THING THAT SAYS SO IS THE HONEST FAILURE MODE.** Items, talents and
  raid buffs each carry an `unmodelled` entry with the source's exact wording.
  **The panels no longer print them** -- all four lists were removed on the
  owner's instruction. Keep writing the entries: `tools/class_audit.ts` is the
  reader, and it throws if its four buckets do not account for every talent.
  Never guess a value to make a panel look complete.

---

## Miscellaneous tweaks worth considering

Not instructions — candidates, with what is known about each.

- ~~**Responsiveness.**~~ **CHECKED AT 375px, 1000px AND 1500px.** No horizontal
  page overflow and nothing clipped at any of the three. The audit is what found
  the `overflow: hidden` clipping above, which was never a phone problem.
  **Check between the breakpoints too** -- the 474px pills lived in the band a
  375/1500 check steps straight over.
- ~~**The single long column.**~~ **ANSWERED BY COLLAPSE RATHER THAN BY LAYOUT.**
  Every configuration panel is one line until opened, so the column the question
  was about is now six bars and a Run button. The layout is three columns --
  config, results, and the profile rail -- collapsing to one below 900px.
- ~~**The 23 presets as a flat list of buttons.**~~ **A TWO-COLUMN RAIL OF
  CLASS-COLOURED PILLS**, on the right, in class order. No headings: the order
  groups them and the colour makes the grouping legible. Chosen from four
  treatments mocked up side by side. Still no search, and 23 does not need one.
- ~~**`PLACEHOLDER_` constants are not surfaced anywhere in the UI.**~~ **SETTLED,
  AND THE OPPOSITE WAY.** The owner's instruction was that none of this reporting
  belongs on screen, so the Encounter panel's caveat went the way of the talent,
  gear and raid-buff lists. CLAUDE.md's placeholder rule is down to two conditions
  and its third is written up as removed. Ten placeholders remain; their audience
  is a reader of the code.
- ~~**Faction has no field.**~~ **DERIVATION IS THE ANSWER**, the owner's call.
  The creation screen already has a faction selector that filters the race list,
  and race determines faction thereafter. Nothing stored, no v11 bump.

---

## What "done" looked like, and what it came to

The original four, with what actually happened:

1. ~~**The two Talent panel bugs fixed**, with a test for the first.~~ One
   DISSOLVED when the list it lived in was removed, and **was never actually
   corrected**; the other was settled the opposite way and generalised to six
   panels. See the section above -- this is the one line in this document worth
   re-reading before touching the talent panel.
2. **Every panel looked at in a running browser.** Held. There is still no render
   coverage, and the three unfiled bugs above were all found by looking rather
   than by the compiler or the suite.
3. **No number computed in a panel.** Held; nothing was added that could have been
   an analyzer.
4. **Typecheck and tests green, and the baseline untouched.** Held throughout.
   2,272 tests, and the DPS figures were re-checked in the browser after every
   change that could have reached past the UI: 2H Arms 603.40 and Cat 655.15
   against a published 603.3 and 656.1.

---

## Save and Load, which is how a character gets out of the app and back in

**LOAD WORKS AND SAVE EXISTS; IMPORT IS STILL `() => undefined`.** The owner
scoped it that way deliberately -- "let's focus in on the Load and Save
features" -- so the pair that moves a character to disk and back is built and
the paste-a-profile half is still parked.

| | where | what it does |
| --- | --- | --- |
| **Save** | the CONFIRMED summary line | writes `serializeProfile` as `<name>-<race>-<class>.json` |
| **Load** | the creation panel AND the summary line | opens the file dialog, `parseProfile`, and confirms the character |
| **Import** | the creation panel | nothing, still |

**THE FILE IS THE PROFILE'S OWN JSON AND THAT IS THE WHOLE DESIGN DECISION.**
The ask was for "a simple build text file with all of the variables that make a
profile", and `serializeProfile` has written exactly that since format version
1. What a second format would have cost is `version`: loading runs parse ->
**MIGRATE** -> validate, so a file saved today still opens after the format
moves on, and twelve versions of migration already exist to prove it. A bespoke
text format would be a second serializer to keep in step with
`CharacterProfile`, with no migration and nothing to notice when the two
drifted.

**SAVE IS ON FLOW TWO BECAUSE FLOW ONE HAS NO CHARACTER TO SAVE.** The creation
screen holds five fields; the talents, the gear, the raid buffs, the
consumables and the encounter are all chosen afterwards and all of them are in
the file.

**LOAD IS ON BOTH, AND THAT IS A CHANGE OF MIND WORTH RECORDING.** It was
flow-one-only first, on the owner's call -- which left `Change` as the only
route to it from a confirmed character, and **Change CLEARS THE TALENT
ALLOCATION**. That is harmless when a file is then loaded, because a load
replaces the whole profile, and it costs somebody their build the moment they
cancel the file dialog instead. The owner reversed it once the trap was named:
**a second entry point is cheaper than a trap.**

**THE ORDER IS SAVE, LOAD, CHANGE**, and the rule behind it is that the
destructive button goes last -- the two that preserve a build sit to the left of
the one that discards it. `profileFile.test.ts` pins that RELATION rather than
the exact positions, so adding a fourth button does not fail it for no reason.

**ONE FILE INPUT, BUILT ONCE AND PASSED TO WHICHEVER SCREEN IS MOUNTED.** Both
need one and only one renders at a time, so `CharacterPanel` builds the element
and the issue list and hands them down. Writing the input out in both branches
would be two things to keep in step, and **the half that drifted would be the
one nobody pressed** -- there is a test that each screen has exactly one.

**AND A FAILED LOAD IS CLEARED WHEN THE SCREEN CHANGES.** The panel stays
mounted across the confirm/edit boundary, so an error raised on the creation
screen would otherwise still be sitting under the summary line afterwards -- a
message about a file, attached to a character that has nothing to do with it.
Both Confirm and Change go through `clearingIssues`.

### Three things that were not obvious

- **`validateProfile` REBUILDS THE PROFILE FIELD BY FIELD**, so every field has
  to be named there or it is dropped on load in total silence. It had already
  happened to `stance` and been fixed with a comment recording the lesson;
  `petFamily` arrived later, was never added, and repeated it directly
  underneath that comment. **Both Warlock presets lost Demonic Sacrifice
  entirely** -- `sacrificedDemon` returns undefined rather than falling back --
  and the BM Hunter's Wolf or Boar would have come back a Cat.
  `tests/profiles/roundTrip.test.ts` compares the WHOLE profile across all 25
  presets rather than listing fields, because a test that lists them is a second
  copy of the rebuild with the same hole in it.
- **A FILE INPUT FIRES `change` ONLY WHEN ITS VALUE CHANGES**, so choosing the
  same file twice is silent the second time -- which is exactly what someone
  does after editing a build on disk. `CharacterPanel` clears `event.target.value`
  before the await, so the next pick is always a change whatever happens after.
- **THE HIDDEN INPUT IS OFF-SCREEN, NOT `display: none`.** A `none` input is
  unfocusable and unreachable by a screen reader, and Safari has historically
  refused to open a dialog for a programmatic click on one. `.visually-hidden`
  in `styles.css`.

## The priority list panel

**BETWEEN GEAR AND RAID BUFFS**, the owner's placement, and it reads in the
right order: what the character is holding, how it fights, then what the raid
gives it. Collapsible like every other configuration panel and shut by default.

**THE LIST WAS THE ONE PART OF A CHARACTER NOBODY COULD SEE.** Gear, talents,
raid buffs and consumables all had a panel; the rotation decided most of the
damage and was invisible, so "why is this build worse" had no answer on screen
and an entry that never fires looked exactly like one that does.

**THE BADGE IS THE LIST'S OWN NAME**, which shows while the panel is SHUT. That
is the cheapest guard against the failure this project has had twice -- a build
running a list meant for another spec, which produces a perfectly ordinary DPS
figure and nothing that looks wrong.

**AN ENTRY WITH NO CONDITION SAYS "always" RATHER THAN RENDERING BLANK.** An
unconditional entry is a FLOOR under everything below it -- nothing cheaper and
ungated beneath it can ever be the first castable entry -- so it is the single
most important thing to be able to read off a list, and an empty cell reads as
"no information" instead.

**IT RENDERS `AplEntries` AND NOT THE PANEL IN TESTS.** `Panel` is
`useState(!startOpen)`, so a collapsible panel starts shut and renders no body
in a static render -- a test going through `AplPanel` passes every "contains"
check by containing nothing. `gearPanelStone.test.ts` learned that from a
failing test; this applied it rather than paying for it twice.

**IT EDITS NOW**, and an edit is saved with the profile: reorder with the arrows,
remove with the cross, add from the class's own ability book, and build a
condition out of clauses -- buff/debuff, resource, cooldown and fight remaining.
See [docs/apl.md](../apl.md).

**ANY EDIT MARKS THE LIST `custom`, WHICH IS THE WHOLE SAFETY MECHANISM.** A
stored list is frozen, so it stops following the build -- and the build is
editable. A `default` list re-derives when class, spec, style or stance changes;
a `custom` one is never silently replaced, and the panel says when it no longer
matches the build's stock list. A Reset button puts the stock list back.

**A BUFF OR DEBUFF IS CHOSEN BY NAME FROM A DROPDOWN**, grouped into buffs and
debuffs with the half matching the clause's subject on top. It was a text box
asking for an aura id at first -- which meant a buff condition was unreachable
unless you already knew that Fire Vulnerability is `fire_vulnerability`, and
which let a half-typed id produce a condition that is permanently true or
permanently false with nothing on screen to say so. `auras/auraCatalog.ts`
derives the list rather than carrying one.

**THE CONDITIONS THE EDITOR CANNOT DRAW ARE SHOWN AS A SENTENCE AND SAY SO.**
`any`, `not` and the four builtins have no controls, and an editor that silently
simplified one would change what the rotation does with nothing on screen to say
so. The entry can still be reordered or removed; only its condition is fixed.

### What is left

- **IMPORT STILL DOES NOTHING**, and `panels/ProfilePanel.tsx` is still not
  mounted. 83 lines holding the `serializeProfile` / `parseProfile` round trip
  in a paste box, which is the natural other half of the pair: Load reads a
  file, Import takes text somebody sent you. **Do not delete it** without
  building Import -- it is dead today and it is the obvious implementation of
  the thing that is missing.
- **NOTHING WRITES TO `localStorage`.** Saving means a file on disk; closing the
  tab still loses the character. Nobody has asked for the other thing.

Everything else in this document is done or settled.
