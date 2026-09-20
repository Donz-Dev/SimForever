# How a talent tree gets audited

The Arms tree went from "mostly implemented" to trustworthy over several
passes. This is what those passes actually were, written down so Fury and
Protection get the same treatment rather than a different one.

It is ordered. Step 3 is wasted effort before step 2, and step 5 is
meaningless before step 4.

---

## 0. Re-read every "unmodelled" reason before trusting one

**This is first because it is the mistake that keeps happening.** The
classification of what cannot be modelled has been wrong **eight times, in two
rounds**, and every single time the reason was written accurately and then
quietly expired underneath.

Improved Rend and Improved Overpower were blocked on per-ability scaling that
already existed. Unbridled Wrath's two-handed clause was blocked on a weapon
type added an hour earlier. Five more claimed "nothing attacks the player"
three commits after `targetAttacks` shipped — and **two of those five were
fully working while telling the user on screen that they could not fire**.

A reason is a claim about the engine on the day it was written. It does not
re-check itself. So before auditing anything:

```bash
# Every talent the tree reports as doing nothing, with its stated reason.
npx vite-node -e "..."   # see the probe in warrior-completion.md §5
```

and read each one against what the engine can do **today**.

## 1. Get the source data, mechanically and verifiably

Hand-transcription is where invented numbers come from. Both Warrior captures
are scripted and re-runnable:

| | |
| --- | --- |
| `tools/import_spell.mjs --refresh` | ability magnitudes, stance gating, effect rows |
| `tools/import_talents.mjs --build` | the talent grid, guarded by a SHA-256 of the DOM read |
| `tools/talent_ranks_browser.js` | per-rank values, by driving the calculator |

**`--verify` matters more than convenience.** Forever has changed under this
project twice: Bastion left the Protection tree and came back, and the second
time the repository still had Vitality in its slot because the first
correction was a hand edit. A hand edit cannot be re-run and cannot be
checked.

Two endpoints are needed, not one. Several tooltips print
`(100% of Spell Power)` where the damage should be, so the number is only in
the spell page's effect row.

## 2. Make the effect observable before judging it

Three Arms talents were "unclear" for the same reason: **nothing on screen
could show whether they worked.**

- **Deflection** grants parry, and parry only ever appears on attacks the
  player RECEIVES. No amount of staring at a damage-done table shows it. →
  the damage-taken breakdown.
- **Improved Heroic Strike** reduces a cost. The ability hits for exactly the
  same amount, so a damage table cannot show the talent at all. → rage
  attributed by source, with uses and cost-per-use.

If a talent's effect has nowhere to appear, **build the telemetry first**. An
audit without it produces "seems fine", which is not a finding.

## 3. Enforce the rules, or the numbers are of a build nobody can have

`talentRules.isLegal` knew about tier gates and prerequisites, and nothing
called it: one point in Mortal Strike granted a 31-point capstone. Every
figure measured before that was of a possibly-illegal build, including the
project's own published Arms baseline, which skipped Sweeping Strikes.

Legality is enforced in `createPlayer` and `abilitiesForClass` — the two places
a character is built — and NOT in `talentBuild`, so a unit test spending five
points on Flurry does not have to spend twenty-five more to make it legal.
`tests/helpers/legalTalents.ts` pads a test allocation.

## 4. Give the build a rotation that actually uses the talents

A talent the rotation never triggers measures zero and looks broken. Two Arms
problems were really this:

- **Execute** was gated on target health, and the training dummy never reaches
  20% health, so it sat in every list and had never once been cast.
- **Stance-gated abilities** were unreachable without a swap, and swapping
  cost nothing, so the rotation thrashed — 540 rage a fight — and every
  build's numbers included that noise.

A per-stance priority list is the fix that worked: **nothing in the dual-wield
Berserker list leaves Berserker Stance, so it never swaps at all.** Fury and
Protection want the same treatment before their talents are measured.

## 5. Test each talent against the SOURCE, not against the code

Two independent checks, deliberately:

1. The expected value written out **by hand** from the tooltip. A test that
   read the constant would pass whatever the constant said.
2. The stored tooltip asserted to contain that same number, tying the
   transcription to the capture.

A typo fails check 2; upstream drift fails `--verify`. The only way a wrong
number survives is being typed twice AND matching the source, which is a
decision rather than a mistake.

**Writing these tests is what finds the bugs.** Testing Impale's "your
abilities" wording is what exposed `AbilityModifiers.for(ALL_ABILITIES)`
returning double — a talent granting +20% crit damage read back as +40%. Every
per-ability lookup was correct, so nothing else would ever have found it.

## 6. Measure by ablation, over hundreds of iterations

Not "add it to an empty build" — **remove it from a real one** and re-run. The
figure that matters is what dropping it costs.

`tools/measure_rotation.ts` is the harness. Every row states its talent build
and its stance, because the previously published baselines recorded neither
and could not be reproduced by anyone, including whoever measured them.

A difference smaller than the combined 95% intervals is not a difference. Say
so rather than reporting it: the stance-dancing ordering came out at +2.76
± 3.19, and the honest statement is that the measurement does not object.

## 7. Write down what is still inert, and why, specifically

Every talent gets an entry — a talent that cannot be modelled says so and says
why, because absence is indistinguishable from an oversight. The reasons are
the work queue, so they have to be specific enough to re-check in a minute.

Distinguish three things that look alike:

- **Blocked on data** — a number nobody has supplied. Ask, or capture it.
- **Blocked on a mechanism** — the number exists and the engine cannot express
  it. That is an implementation task with a known cost.
- **Out of scope** — stuns, snares, threat, movement. Not pending, and saying
  "pending" about them inflates the work queue and hides the real items.

Six of the Warrior's eighteen inert talents are the third kind. Counting them
as gaps made the class look further from done than it was.

---

## The shape of a finished tree

For Arms, all of this produced: every talent either implemented and tested
against its Forever value, or inert with a specific and current reason; a
rotation that exercises the tree without stance noise; telemetry that makes
each effect visible; and measured, reproducible figures with their builds
written out.

Three real bugs were found on the way, and **none of them by reading the
code** — one by writing a test, one by measuring, one by a user noticing a
number that made no sense.
