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
3. The owner's standing checks every agent runs: mana potions and the `other` row on every mana user
   at 120 s; enchants by stat weights at `DURATION=120`; a race swap as a candidate; a real Multi
   Target list that also holds at 3 and 8 targets (gate AoE entries on `targetCount` if it loses at
   3); Gates A/B/C; owner lines outrank measurements.
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
