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
   abilities its class has. The scope rule that keeps nine branches mergeable:
   - its own variant file `tools/optimise/<class>Variants.ts` (loaded with `FILE=`, never registered
     in `probe_build.ts`);
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
   the losers, shipped vs withheld, questions for the owner, and its commits.

## Phase 2 — update (merge into one branch)

1. Merge each class branch into the round branch one at a time (`git merge --no-ff opt-<class>`).
   `presets.ts`, shared tests (`precombatOpeners.test.ts`, consumable/enchant tables) and
   `multiTarget/index.ts` are where conflicts land; resolve by each branch's diff, never by taking
   a side of a hunk. Typecheck after every merge, including the clean ones.
2. `npm run typecheck` and `npm test` on the merged branch.
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
6. Commit, push, open one PR, bind it, and stop at the merge question.

## Things that have gone wrong before

- A paired probe cannot see the clock: optimise at the report's own durations (120 s, 60 s, 30 s),
  never at a preset's 60 s default.
- A tank's TPS can be bought with deaths; read the deaths delta `probe_build` prints.
- A healer's 120 s tank fight is a mana fight; its 60 s figure is not.
- `syncDefaultRotation` re-derives a `default` list on a build change; a Multi Target default is
  stored `custom` for that reason.
