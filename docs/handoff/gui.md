# GUI DEEP DIVE

**Purpose:** finalize the GUI and the miscellaneous tweaks around it. This is the
first pass the UI has had of its own.

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

- **Other sessions hold ports.** 5173–5176 were all taken while this brief was
  written. Read the actual port out of `preview_logs` rather than trusting the one
  the tool reports — they can differ.
- **The dev server runs from the repo root**, which other sessions check out onto
  their own branches. If the app does not match `main`, check what branch the root
  is on before debugging the code. **This cost time already**: the raid-buffs panel
  showed 12 buffs where `main` has 17, and the panel was right — the checkout was
  stale.

### It works today

Pick a preset → **Run Simulation** → a full stack renders: DPS and distribution,
a damage table with uses, share, crit, glance and avoided per ability, buff and
debuff uptime, a resource timeline, and a combat log. 2H Arms comes back at
**606.6** against a published **603.3** — that is the batch-versus-profile
difference and not a bug, and CLAUDE.md explains it under **Verifying work**.

---

## The two known bugs, both engine work that outran its panel

### 1. The Talent panel lists working talents as gaps

`appliedElsewhere` was added by the Rogue dive for talents whose effect is applied
by another module — **Vile Poisons and Improved Poisons both work**, read by the
poison reactions, and neither has an entry in the effects table because there is
nothing for it to say.

`TalentPanel.tsx` splits `unmodelled` into gaps and rulings on `scope === undefined`
alone, so a talent carrying `appliedElsewhere` and no `scope` **lands in the gaps
list and is shown as missing work.** `class_audit.ts` already counts it correctly
as partly modelled; the panel is the only reader that does not.

**The fix is small and the test is the point**: a Rogue build with Vile Poisons
must not list it as unmodelled. Grep for `appliedElsewhere` — the panel has zero
hits today.

### 2. The Talent panel is collapsed by default

It opens showing `38/13/0 · 0 points left` and a `▢`. Everything the nine dives
produced — the gap list, the out-of-scope list, the per-talent reasons — is behind
that toggle.

**That is a judgement call rather than a defect**, and it is worth re-making: the
split between "not modelled yet" and "ruled out by the owner, never coming" is the
single most informative thing this project can show a reader, and it is the one
thing hidden by default. Whatever you decide, decide it on purpose.

---

## What the UI is made of

4,731 lines, and **1,288 of them are `styles.css`** — the largest single file by
some way, and the first place to look for anything visual.

| | |
| --- | --- |
| `App.tsx` (193) | composition and layout. Every panel is wired here |
| `panels/ResultsPanel.tsx` (480) | the biggest panel: DPS, distribution, the damage table, uptimes |
| `panels/CharacterPanel.tsx` (367) | the 23 presets, Import and Load |
| `panels/TalentPanel.tsx` (359) | the tree, and the gap/ruling split. **Both bugs above are here** |
| `panels/GearPanel.tsx` | 19 `<select>`s. Its "Equipped but not simulated" list is gone |
| `panels/CharacterSheetPanel.tsx` (335) | the stat block |
| `panels/RaidBuffsPanel.tsx` (168) | 21 checkboxes, 17 on by default |
| `charts/` | `DonutChart`, `ResourceTimeline`, `UptimeBars` — hand-rolled SVG, no chart library |
| `components/` | `Field`, `Panel`, `OptionGroup`, `Logo` |
| `hooks/useSimulation.ts` (68) | the only bridge to the simulator |

**There are no TODOs or FIXMEs in `src/ui`.** Whatever is unfinished is unfinished
silently, which is why this brief leads with the two bugs rather than a list.

**Two UI tests exist**, `tests/ui/talentScopeCaption.test.ts` and
`tests/ui/themes.test.ts`, and that is the whole of the UI's coverage. The panels
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
  owner's instruction. Keep writing the entries: `class_audit.ts` is the reader.
  Never guess a value to make a panel look complete.

---

## Miscellaneous tweaks worth considering

Not instructions — candidates, with what is known about each.

- **Responsiveness.** `styles.css` has four `@media` queries. Nobody has checked
  the app at phone width.
- **The single long column.** Character → sheet → encounter → simulation → talents
  → gear → raid buffs → results → combat log, all stacked. It works; whether it is
  the right shape for a tool people scroll repeatedly is open.
- **The 23 presets as a flat list of buttons.** No grouping by class, no search.
- ~~**`PLACEHOLDER_` constants are not surfaced anywhere in the UI.**~~ **SETTLED,
  AND THE OPPOSITE WAY.** The owner's instruction was that none of this reporting
  belongs on screen, so the Encounter panel's caveat went the way of the talent,
  gear and raid-buff lists. CLAUDE.md's placeholder rule is down to two conditions
  and its third is written up as removed. Ten placeholders remain; their audience
  is a reader of the code.
- **Faction has no field.** It is derived from race, and the milestone asks for it
  as a default — so either say derivation is the answer or store it and bump the
  profile version to v11.

---

## What "done" looks like

1. **The two Talent panel bugs fixed**, with a test for the first — a Rogue build
   must not show Vile Poisons as a gap.
2. **Every panel looked at in a running browser**, not just typechecked. There is
   no render coverage, so the compiler cannot help you here.
3. **No number computed in a panel** that could be an analyzer instead.
4. **`npm run typecheck` and `npm test` both green**, and the baseline untouched —
   a UI change that moves a DPS figure has reached past the simulator and is a bug
   in itself. Re-measure with `npx vite-node tools/measure_profiles.ts` if you touch
   anything outside `src/ui`.
