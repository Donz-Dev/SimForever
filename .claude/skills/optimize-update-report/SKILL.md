---
name: optimize-update-report
description: Optimize, Update, and Report all Profiles. Optimise every SimForever preset (DPS, tank, healer) for the report encounters, make the optimised settings the presets' defaults, and regenerate and publish the full profile report. Use when the owner asks to optimise all profiles, refresh the full report, or run "Optimize, Update, and Report".
---

# Optimize, Update, and Report all Profiles

The owner's procedure from round 78. Three phases, in order: **optimise** every preset against its
role's own figure, **update** the presets so the optimised settings are the defaults, then **report**
every preset in the report encounters and publish the page. The per-profile method is
`docs/profile-optimisation.md`; this skill is the orchestration around it.

## The encounters and the figures

| role (from `src/profiles/presetRoles.ts`) | Single Target section, optimised for | Multi Target section, optimised for | report columns |
| --- | --- | --- | --- |
| DPS | DPS, 1 target, 120 s | DPS, 5 targets, 60 s (reused at 3/60 s and 8/30 s) | DPS: 1T 2 min, 3T 1 min, 5T 1 min, 8T 30 s |
| tank | TPS, 1 target, 120 s (deaths secondary) | TPS, 5 targets, 60 s | TPS: the same four |
| healer | HPS, tank healer fight, 120 s | HPS, raid healer fight, 60 s | HPS: Tank Healer 2 min, Raid Healer 1 min |

More than one target runs a preset's **Multi Target** section; the raid healer fight runs Multi
Target; the tank healer fight runs Single Target. Talents, enchants, consumables, race and poisons
are shared by both sections. Gear is fixed at E65 (only `enchantId` may change).

## The owner's standing rules (round 79, after the first run)

These override anything the procedure document says where they disagree.

1. **ONE TALENT BUILD PER PROFILE, CHOSEN ON THE WEIGHTED SCORE.** Never pick talents per fight
   style. A player can change how they play (the APL) and what they drink between fights, and
   usually cannot respec. The score is:
   - DPS and tank profiles: **49% single target (120 s) + 17% each for 3, 5 and 8 targets**;
   - healers: **50% tank healer fight + 50% raid healer fight**.

   Measure talents with `WEIGHTED=1` on `probe_build.ts`, which pairs each encounter at its own
   clock and combines them. The report shows the same score as its own sortable column.
2. **PLAY STYLE AND POTIONS MAY DIFFER BY FIGHT.** The Single Target and Multi Target APLs are
   tuned separately, each on its own encounter. Every profile has a **Primary Potion** and a
   **Secondary Potion** row (they share the two-minute potion cooldown), and the APL decides which
   is drunk and when. For example: a mana potion only when mana is under 50% *and* more than 60 s
   of the fight has passed, and a damage potion otherwise. Choose the pair and write that logic for
   every mana user.
3. **RACES: HORDE AND WINDSHAPER SKYBORNE ONLY.** Evaluate only **Orc, Undead, Troll, Tauren and
   Windshaper Skyborne**, whichever of them the class can be. Never pick an Alliance race (Human,
   Dwarf, Night Elf, Gnome, High Order Skyborne). If a class can be none of the five, ask the owner.
4. **ENCHANTS MUST BE LEGAL FOR THE SLOT.** +25 Agility is a **two-hand** enchant; a one-hand
   weapon takes +15 Agility or Crusader. `enchantsForSlot` is the offer list. Check it before
   writing an enchant into a preset, because a preset's enchant is applied whether or not the slot
   offers it.
5. **GO DEEPER, AND OUTSIDE THE BOX.** The first run accepted local optima a person found at once:
   Hawk Melee and LW Melee found little in Melee Weave and never tried Volley on several targets,
   and the Arcane Mage never tried Fire Blast into Heating Up into Pyroblast. So for every profile:
   - **Enumerate every ability the class can cast**, including the other trees' spells and any
     talented proc chain, and ask what each could add in each fight. Do not stop at re-ordering the
     existing list.
   - **Try whole alternative rotations,** not only edits to the current one: a different filler, a
     proc-driven chain, a weave, an AoE spell in a melee list, a hybrid of two trees.
   - **Sweep every threshold** (mana, rage, energy, health, stack counts, time left), and price each
     candidate in every encounter it could touch.
   - **Report what was tried and lost**, with figures, so the owner can see the depth.
6. **ASK BEFORE CHANGING A CORE FEATURE.** If driving a figure needs a change to something the
   profile is built around — its theme tree, its weapon style, an owner opener line, an engine rule
   — stop and ask the owner with an AskUserQuestion prompt: the change, the figure, and the
   alternative. Do not ship it, and do not quietly skip it.

## Phase 0 — baseline and tooling

1. Read `docs/profile-optimisation.md` in full and CLAUDE.md's optimisation, pre-combat, APL and
   consumable sections. Re-read them each time; they change.
2. Work in a worktree off `origin/main` (CLAUDE.md: never measure in the shared checkout).
3. Take the "before" report so the page can show the change:
   `OUT=report_before.json npx vite-node tools/full_report.ts` (300 fights a cell, ~10-20 min,
   run in the background).
4. The tools this needs (all exist since round 78):
   - `tools/probe_build.ts` — paired A/B. `PRESET=`, `FILE=<variant file>`, `VARIANTS=`, `ITER=`,
     `DURATION=`, `TARGETS=`, `FIGHT=tank|raid`, `METRIC=dps|tps|hps` (defaults by role).
   - `tools/buildVariants.ts` — edit helpers, including `inMulti(...)` and `multiList(...)` for the
     Multi Target section and a `<CLASS>_TREE` builder for every class.
   - `src/profiles/multiTarget/<class>.ts` — each preset's own Multi Target list, attached by
     `withStockRotations` in `presets.ts`.
   - `tools/full_report.ts` and `tools/full_report_page.ts` — the report and its page.

If a new encounter or figure is asked for, build the tooling first and commit it on the branch the
class work will start from (CLAUDE.md: land shared pieces before dispatching class work).

## Phase 1 — optimise, one agent per class, in parallel

1. Create one worktree and branch per class off the tooling commit, each with the shared
   `node_modules` junctioned in (`cmd /c mklink /J <wt>\node_modules C:\Users\Donz\code\SimForever\node_modules`).
2. Write one shared brief (the round 78 brief is the template: objectives table, tooling, scope,
   the owner's specific checks, finishing steps) and dispatch one `general-purpose` agent per class
   with its worktree, its preset ids and roles, its prior variant files and handoff doc, and the AoE
   abilities its class has. **`brief-template.md` in this skill's folder is the round 80 brief with
   the round-specific lines lifted out**: copy it to the scratchpad, fill in the round number and a
   "since last round" paragraph from HANDOVER, and add one paragraph per class on where its last
   round stopped. Point every agent at **`patterns.md`**, the cross-class catalogue of what won and
   lost. The scope rule that keeps nine branches mergeable:
   - its own variant file `tools/optimise/<class>VariantsN.ts` (loaded with `FILE=`, never registered
     in `probe_build.ts`, group names prefixed);
   - its class's stock lists in `src/game/rotations/<class>.ts`;
   - `src/profiles/multiTarget/<class>.ts`;
   - its own presets' blocks and `PRESET_ENCHANTS` rows in `src/profiles/presets.ts`;
   - tests pinning what it changed, and its `docs/handoff/<class>.md`;
   - no engine or game-rule changes, no `durationSeconds` change, no HANDOVER/CLAUDE.md edits, no
     push, no PR, no `Co-Authored-By` trailers.
3. The owner's standing checks every agent runs, with the standing rules above in the brief
   verbatim:
   - talents on `WEIGHTED=1` only, one build per profile;
   - a Primary and a Secondary Potion with APL logic, on every mana user;
   - enchants by stat weights at `DURATION=120`, legal for their slot;
   - races from Orc, Undead, Troll, Tauren and Windshaper Skyborne only;
   - a real Multi Target list that also holds at 3 and 8 targets (gate AoE entries on
     `targetCount` if it loses at 3);
   - the go-deeper list: every castable ability, whole alternative rotations, every threshold
     swept;
   - Gates A/B/C; owner lines outrank measurements.
   An agent cannot prompt the owner itself, so a **core-feature change goes back to the
   coordinator as a question with its figure**, and the coordinator asks the owner with
   AskUserQuestion before anything ships.
4. Each agent reports per profile: before/after per report column, one row per dimension including
   the losers, shipped vs withheld, questions for the owner, and its commits. Append each report to
   a scratchpad `agent_reports.md` as it arrives, because the reports are the raw material for the
   notes, HANDOVER and `patterns.md`.
5. **Agents stall on the usage limit.** Six of nine did in round 80. A stalled agent is not
   finished: resume it with SendMessage once the limit resets, and do not re-dispatch it, since a new
   agent starts its measurements over.

## Phase 1b — rule questions, asked mid-round, then re-priced

Round 80's largest single correction came from here, not from optimisation. Several agents
independently reported the same engine behaviour as a question: Revelation rolling once per target
hit, from Shaman, Priest, Mage and Warlock. One noticed a rule gap: Hellfire and Rain of Fire missing
from the Destruction list, worth +108 to +183 weighted on three Warlocks.

1. As the reports arrive, **collect the questions that cross classes or change a rule** (an engine
   reading, a school list, an ability's global cooldown flag, a tank's deaths-for-threat trade, an
   owner talent URL being replaced). Keep the per-profile list questions (an owner line that loses)
   for HANDOVER.
2. **Ask them with AskUserQuestion before merging.** Use up to four at once, each with the agents'
   figures and a recommended option.
3. **Apply each ruling on the round branch, then re-price whatever it touched.** A Revelation ruling
   changes what the best staff enchant is. Write a small `tools/optimise/<topic>RepriceN.ts`
   (`revelationReprice80.ts` is the example), run it `WEIGHTED=1` on every affected preset, and ship
   the winners before the after-report. Shadow Priest's round gain shrank to about zero this way, so
   do not skip it.
4. Record each ruling where the code carries it (the comment beside the change, with the figure)
   and in HANDOVER's round section. Add it to CLAUDE.md when it is a rule the engine will keep
   meeting.

## Phase 2 — update (merge into one branch)

1. Merge each class branch into the round branch one at a time (`git merge --no-ff opt-<class>`).
   `presets.ts`, shared tests (`precombatOpeners.test.ts`, consumable/enchant tables) and
   `multiTarget/index.ts` are where conflicts land; resolve by each branch's diff, never by taking
   a side of a hunk. Typecheck after every merge, including the clean ones. In round 80 the
   conflicts were in `tests/game/enchants.test.ts` (each class's exception rows),
   `tests/game/statHeadroom.test.ts` (race-keyed cap tables), `tests/profiles/aplSections.test.ts`
   and the Rogue/Hunter food assertions. Keep every branch's rows.
2. **Fix the `talentSpreads` lines each agent listed.** Agents may not edit HANDOVER, so every
   changed tree split arrives as a "HANDOVER.md:NNNN X -> Y" line in its report. Mark the old figure
   "(then; X since round N)" rather than rewriting history. Then run `npm run typecheck` and
   `npm test` on the merged branch.
3. `USES=1 SEEDS=3 PROFILES=<id>` on every changed profile; no added entry may read 0 uses unless
   intended.

## Phase 3 — report

1. `BEFORE=report_before.json OUT=report_after.json npx vite-node tools/full_report.ts` on the merged
   branch (background).
2. Write `notes.json` (`{ "build": "...", "summary": [...], "classes": { "<class>": "..." } }`) from
   the agents' reports: what each class shipped, the biggest movers, and what was withheld.
3. `IN=report_after.json NOTES=notes.json HTML=report.html npx vite-node tools/full_report_page.ts`.
4. Publish with the Artifact tool. Update the existing report in place (`action: "list"` to find
   "Forever Profile Report", read it first) rather than creating a new one, unless the owner asks.
   Look at it once before publishing.
5. HANDOVER.md: a new round with the method, one table of before/after per profile (or a pointer to
   the page plus the headline movers), every question raised, and the open items.
6. **Update `patterns.md`** with what won and lost across classes this round, so the next run starts
   from it. The per-class detail stays in `docs/handoff/<class>.md`.
7. Commit, push, open one PR, bind it, and stop at the merge question.
8. After the merge, and only on the owner's yes, remove the class worktrees and their branches.
   Before removing them:
   - check each for untracked files (`git status --porcelain --ignored`);
   - delete each worktree's `node_modules` junction first, with `cmd /c rmdir`, so the shared one
     survives;
   - then `git worktree remove --force`, `git branch -D`, and `git worktree prune`.

## Things that have gone wrong before

- A paired probe cannot see the clock: optimise at the report's own durations (120 s, 60 s, 30 s),
  never at a preset's 60 s default.
- A tank's TPS can be bought with deaths; read the deaths delta `probe_build` prints.
- A healer's 120 s tank fight is a mana fight; its 60 s figure is not.
- `syncDefaultRotation` re-derives a `default` list on a build change; a Multi Target default is
  stored `custom` for that reason.

### Tooling traps found in round 80

Each of these reads like a finding and is not one.

- **A consumable selected inside `inMulti(...)` is discarded.** Consumables are shared by both
  sections, so make the selection outside it.
- **A stored list drops the entry of any consumable that is not selected.** A list edit that gates a
  not-yet-selected potion finds nothing to gate. Select it first, or insert the entry.
- **The `secondary_*` potions grant the primary's ability id.** An existing potion entry also
  drinks the secondary, so an ungated owner Spellblasting line drinks it at the pull.
- **`USES=1` runs at the presets' 60 s.** A 120 s-only branch (a mana potion gated past 60 s, Life
  Tap, Evocation) reads 0 uses by design. It runs healers against a dummy, so a healer list reads 0
  everywhere: use `tools/optimise/probe_healer_book.ts` or `probe_priest80.ts`. It also credits
  `melee_weave` casts to the weave's parts, so the weave reads NEVER FIRED.
- **The built-in variant registry has won a name clash against `FILE=`.** Prefix every group.
- **A full report is unpaired.** A change under about ±7 at 1T is noise there. Quote the paired
  probe for each change, and the report only for the before and after.
- **Gate sweeps that come back bit-identical** are usually smart healing (a healer's thresholds are
  unread), a potion that never wins the shared cooldown, or an entry above that always fires. Find
  out which before calling a threshold "flat".
- **The nine-way load timed out `tests/game/lastStand.test.ts`** (and once `rageAndUses.test.ts`) at
  the 5000 ms default. The `lastStand` case runs up to five batches and now carries its own 30 s
  limit. For any other timeout, re-run alone before concluding anything.
- **On Windows, PowerShell blocks `npm.ps1`.** Use `npm.cmd` and `npx.cmd`, and pass Windows paths
  (not `/c/...`) to `full_report.ts`'s `OUT=` when it runs from PowerShell.
