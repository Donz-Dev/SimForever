# Round N — optimise every profile of one class (shared brief template)

The brief the coordinator hands every class agent. It is the round 80 brief with the round-specific
lines lifted out: copy it to the scratchpad, replace `N`, refresh the "since last round" paragraph
from HANDOVER, and point each agent at it. Keep it in this repository, because the scratchpad copy
of the round 78 and round 80 briefs did not survive the session that wrote them.

You are optimising every preset profile of ONE class of SimForever, a WoW: Forever combat simulator
(TypeScript, Vite, Vitest). This is a run of the owner's "Optimize, Update, and Report all Profiles"
procedure. Nine classes are being done at the same time by other agents, each in its own git
worktree, so stay inside your scope.

## Read first (do not skip)

1. `.claude/skills/optimize-update-report/SKILL.md` — the procedure, and especially **"The owner's
   standing rules"**. They override everything else.
2. `.claude/skills/optimize-update-report/patterns.md` — what won and what lost last time, across
   every class. Try the winning shapes on your profiles before inventing new ones.
3. `docs/profile-optimisation.md` — the per-profile method: theme invariants, the Step 1 reads
   (including the `triggersGcd` read), Gates A/B/C, a control in every variant group, paired
   measurement, the loop, a Combined group before shipping.
4. CLAUDE.md sections "An optimisation brief, and five ways this project has failed one", "Before
   the pull" (at most one damaging pre-combat action, finishing at exactly t=0), "The priority list on
   a profile", "Consumables".
5. HANDOVER.md's last two rounds, and your class's `docs/handoff/<class>.md` **last round section**:
   what was shipped, priced and withheld last time, and why. Start from there, not from scratch.
   Since last round: <the coordinator fills this in — rulings, engine changes, new rules>.

## The owner's rules, restated

1. **One talent build per profile, chosen on the WEIGHTED score.** DPS and tanks: 49% single target
   (120 s) + 17% each for 3, 5 and 8 targets. Healers: 50% tank healer fight + 50% raid healer fight.
   Measure every talent candidate with `WEIGHTED=1`. Never pick talents per fight.
2. **Play style and potions may differ by fight.** Tune the Single Target list on 1 target / 120 s
   and the Multi Target list on 5 targets / 60 s (check it at 3/60 and 8/30 too). Healers: the Single
   Target list on the tank healer fight (120 s), the Multi Target list on the raid healer fight
   (60 s). Every profile has a **Primary Potion** and a **Secondary Potion** (`potion` and
   `potion_secondary` in `consumables`; secondary ids are `secondary_<potion id>`); they share the
   two-minute potion cooldown and the APL decides which is drunk when. Choose the pair and write that
   logic for every mana user, in both lists. **Read `patterns.md` on potions first**: the owner's
   example gate ("under 50% after 60 s") loses in any 60 s fight.
3. **Races: only Orc, Undead, Troll, Tauren, Windshaper Skyborne**, whichever the class can be:

   | class | allowed |
   | --- | --- |
   | Warrior | Orc, Undead, Tauren, Troll, Windshaper Skyborne |
   | Rogue, Mage | Orc, Undead, Troll, Windshaper Skyborne |
   | Hunter, Shaman | Orc, Tauren, Troll, Windshaper Skyborne |
   | Warlock | Orc, Undead, Troll |
   | Priest | Undead, Troll |
   | Druid | Tauren, Windshaper Skyborne |
   | Paladin | Undead only |

   Price the allowed races on the weighted score and ship the best. Update the preset's `detail` line
   and any racial-specific APL entries and tests.
4. **Enchants must be legal for the slot** (`enchantsForSlot`). +25 Agility is two-hand only.
5. **Go deeper, outside the box.** For every profile:
   - enumerate **every ability the class can cast** (other trees' spells, granted spells, procs,
     racials, consumables) and ask what each could add in each fight;
   - try **whole alternative rotations**, not just edits: a different filler, a proc chain, a weave,
     an AoE spell in a melee list, a hybrid of two trees;
   - **sweep every threshold** (resource, health, stacks, time left) rather than comparing two values;
   - report what was tried and lost, with figures.
6. **Ask before changing a core feature.** You cannot prompt the owner yourself. If driving a figure
   needs a change to the theme tree, the weapon style, an owner opener or list line, or an engine
   rule, do NOT ship it: price it and put it in your report under "Needs the owner", with the figure
   and the alternative. **Also report any engine behaviour that looks like a rule question** (a proc
   rolling per target hit, a spell missing from a school list, an ability on the global cooldown):
   in round 80 four agents independently found the same one, and asking it mid-round moved six
   profiles.

## Tooling

`tools/probe_build.ts` is the paired A/B harness:

```
PRESET=<id> FILE=tools/optimise/<class>VariantsN.ts VARIANTS=<group[,group]> ITER=400 DURATION=120
TARGETS=5             # number of targets (more than 1 runs the Multi Target section)
FIGHT=tank|raid       # healers only; default tank
METRIC=dps|tps|hps    # defaults by role
WEIGHTED=1            # every row is the weighted score across the report encounters, each paired
                      # at its own clock; prints per-encounter deltas too
```

**Prefix your group names** (e.g. `wN…`): the built-in registry has won name clashes with a `FILE=`
group before. `tools/buildVariants.ts` has `enchant`, `consumable`, `<CLASS>_TREE`, `apl`,
`moveAbove`, `moveToBottom`, `removeEntry`, `addEntry`, `addAbove`, `chain`, `addPrecombat`,
`removePrecombat`, `precombatLead`, `inMulti(...applies)` and `multiList(name, entries, precombat?)`.
A race swap is `(p) => ({ ...p, character: { ...p.character, race: 'orc' } })` followed by the
harness's own `syncDefaultRotation`. **Read the tooling traps in `SKILL.md`** before trusting a zero.

`ITER=300 PROFILES=<your ids> npx vite-node tools/full_report.ts` prints every report column and the
weighted score for your presets — run it at the start and at the end. Step 1 tools still work
(`USES=1 SEEDS=3 PROFILES=<id> npx vite-node tools/measure_profiles.ts`, `probe_resources.ts`,
`probe_clock.ts`, `probe_profile_report.ts`, `stat_weights.ts` with `DURATION=`,
`probe_consumable_choice.ts`; healers: `tools/optimise/probe_healer_book.ts` and
`probe_priest80.ts`, since `USES=1` runs a dummy). The machine is shared by nine agents: run one
measurement at a time.

## What you may change (your scope)

- Your variant file `tools/optimise/<class>VariantsN.ts` (new; export `VARIANT_GROUPS`).
- Your class's stock lists in `src/game/rotations/<class>.ts`. Check `rotationFor`/`aplFor` first: a
  stock list can be shared by more than one preset.
- Your class's Multi Target defaults in `src/profiles/multiTarget/<class>.ts`.
- Your presets' own blocks in `src/profiles/presets.ts` (talents, race, detail, precombat,
  consumables, poisons, warlock stone) and their rows in `src/game/items/presetEnchants.ts`.
- Tests that pin something you changed — update them honestly, never delete an assertion to pass.
  Shared tests (`tests/profiles/aplSections.test.ts`, `tests/game/enchants.test.ts`,
  `tests/profiles/precombatOpeners.test.ts`, `tests/game/racials.test.ts`,
  `tests/game/statHeadroom.test.ts`, the Rogue/Hunter food assertions in `combatRotation` and
  `venomRotation`) will conflict across classes: keep your edits small and local to your presets'
  lines.
- `tests/game/talentSpreads.test.ts` reads HANDOVER.md: if your talent split changes, do NOT edit
  HANDOVER — list the line it flags in your report and the coordinator fixes it.
- Your class's `docs/handoff/<class>.md` (append a round N section).

Do NOT change engine or game rules or numbers, any preset's `durationSeconds`, gear (only
`enchantId`), another class's files, HANDOVER.md or CLAUDE.md. A temporary engine edit to PRICE a
question is fine if reverted before committing — say so in the report. Owner lines outrank a
measurement: an optimisation may ADD to an owner opener or list, never rewrite, gate or reorder it;
a loss from an owner line is a "Needs the owner" item with its figure.

## Finishing

1. `npm run typecheck` and `npm test` (all of it) must pass in your worktree, apart from a
   `talentSpreads` HANDOVER line you list for the coordinator. The first full-suite run in a fresh
   worktree, and any run under the nine-way load, can time out (`lastStand.test.ts` did on most
   branches in round 80); re-run it alone before concluding.
2. `USES=1 SEEDS=3 PROFILES=<id>` on every profile you changed: no entry you added may read 0 uses
   unless intended and explained (it runs at 60 s, so a 120 s-only branch reads 0).
3. `ITER=300 PROFILES=<all your ids> npx vite-node tools/full_report.ts` for the after figures.
4. Commit on your branch. **No `Co-Authored-By` trailers.** Do not push, PR, merge, or touch `main`
   or other worktrees.
5. Your final message is your report, per profile:
   - before → after for each report column and the weighted score, with intervals;
   - one row per dimension (talents, race, opener, Single Target APL, Multi Target APL, potions and
     their APL logic, other consumables, enchants), including the losers, with figures;
   - the "outside the box" ideas you tried, with figures;
   - **Needs the owner**: core-feature changes priced and not shipped, owner lines that lose, rule
     questions about the engine;
   - engine or data issues; any HANDOVER line `talentSpreads` flags; the commits on your branch.
