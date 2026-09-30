# The ability audit

**Does every declared ability actually do something, in a real fight, in at
least one of the 23 profiles?**

```bash
npx vite-node tools/ability_audit.ts            # the report
npx vite-node tools/ability_audit.ts --json     # machine-readable
PROFILES=cat,rogue npx vite-node tools/ability_audit.ts
```

This is the MACRO question, and it is a different one from either of the two
audits that already existed. Not "is this number right" but "is this thing
connected at all".

## Why the other two tools cannot answer it

| Tool | Answers | Blind to |
| --- | --- | --- |
| `coefficient_probe.ts` | does the damage respond to a stat, casting each ability in ISOLATION | whether any profile ever casts it |
| `measure_profiles.ts USES=1` | what each LIST ENTRY did, plus damage sources not in the list | an ability that is in neither |

Between them those cover every ability that is **in a list** or **dealing
damage**. Which leaves a third category completely invisible: **an ability in
the character's own book, in no list, dealing no damage.** It is declared, it is
learnable, the profile can cast it, and nothing anywhere reported that it never
does.

## The state, measured

At `d93f167`, 23 profiles, 10 iterations each:

| | |
| --- | --- |
| **134** | abilities in at least one profile's book |
| **109** | exercised by at least one profile |
| **25** | never cast by any of the 23 |
| **8** | priority list entries that never fire |
| **23 of 23** | damage tables summing to 100% — **nothing unaccounted, anywhere** |

**THE SHARE TOTAL IS THE STRONGEST RESULT HERE and the easiest to overlook.**
Every profile's damage breakdown adds to 100%, which is what says the table is
complete rather than merely consistent. A damage source nobody reports reads as
a zero rather than as a gap — the same failure `resourceFlow` had when it summed
every pool under a heading that said "Rage" and produced a tidy 100%.

**AND NO ABILITY DEALS DAMAGE WITHOUT SCALING.** That is the probe's result, not
this one's, and the two together are the macro bill of health: everything that
deals damage scales with something, and everything that deals damage is counted.

## The eight list entries that never fire

**The state table in [handoff-apl.md](handoff-apl.md) used to claim a `USES=1`
sweep was clean. It is not, and it never was** — the detail elsewhere in the same
file already said three of these are kept deliberately, so the summary
contradicted its own body. Corrected, and the list is here instead.

| Entry | Profiles | Why |
| --- | --- | --- |
| `battle_shout_cast` | 2H Arms, DW Fury, Prot Warr | **the encounter already supplies it.** `battle_shout` is a preset raid buff, so the Warrior's own cast is refused all fight. Kept on purpose |
| `battle_stance_cast` | 2H Arms | the preset already opens in that stance. Kept, because a character built by hand in another stance needs it |
| `berserker_stance_cast` | DW Fury | as above |
| `defensive_stance_cast` | Prot Warr | as above |
| `eviscerate` | Rupture | the gate's two aura-duration floors never coincide with five combo points. **Ruled fine by the owner** — "zero is fine" |
| `hammer_of_wrath` | Seal Twist Ret | **needs the target below 20% health, which never happens.** The `executePhase` clock, and the encounter never reaches it |

Six causes, four of them deliberate, one ruled on, and one an encounter
property. **None is a broken declaration**, which is the point of listing them
with reasons rather than counting them.

## The 25 that no profile casts

Grouped by why, because the count alone invites the wrong conclusion. **Most of
these are correct.**

| Reason | Abilities |
| --- | --- |
| **Area damage, one enemy** | `cleave`, `multi_shot`, `blast_wave`, `swipe`, `chain_lightning` |
| **Out of scope by ruling** | `hamstring`, `intercept` (positioning), `frost_shock` (a snare) |
| **The encounter supplies it** | `battle_shout_cast` |
| **Already in that stance** | `battle_stance_cast`, `berserker_stance_cast`, `defensive_stance_cast` |
| **A cooldown no list asks for** | `recklessness_cast`, `berserker_rage_cast`, `sweeping_strikes`, `presence_of_mind` |
| **The owner's list does not name it** | `ghostly_strike`, `expose_armor`, `searing_pain`, `shadow_word_death`, `ferocious_bite` |
| **Declared, and deliberately in no list** | `wrack` — the owner's words: "there isn't a profile that uses it" |
| **Unreachable on cost** | `claw` — Improved Shred and Ferocity put it and Shred at the SAME 42 energy, so the harder-hitting one is always taken. A known finding |
| **Superseded within its own class** | `fireball`, `frostbolt`, `fire_blast` — the three Mage lists cast `frostfire_bolt`, `scorch`, `arcane_missiles` and `arcane_blast` instead |

**TWO WORTH A SECOND LOOK, and neither is a bug:**

- **`ferocious_bite`** is a Cat finisher that no profile casts. The owner's
  `DRUID_CAT` list is five entries and its finisher is `rip`; Ferocious Bite is
  in the book and in no list. It is one of the twelve entries that once fired
  zero times, and removal is how it was resolved.
- **`frostbolt`** is cast by no Mage including Frostfire, which sounds wrong for
  a Frost build and is not: that list casts `frostfire_bolt`, which is also a
  Chill effect, so **Fingers of Frost still procs** and Shatter's window still
  opens.

## What this does NOT check

Said plainly, because an audit that looks complete is worse than one with stated
limits.

- **It does not check that a number is right.** An ability firing for a plausible
  wrong figure passes here. That is `ownerCoefficients.test.ts` and the probe.
- **It is one batch of ten, not the 30-batch method**, because the question is
  "did this fire at all" and one batch settles it. Do not read its DPS.
- **It cannot reach what the harness cannot set up.** `ambush` needs stealth and
  `hammer_of_wrath` needs the execute phase; both appear as never-cast and
  neither is broken.
- **There is no test pinning this.** The 25 and the 8 are explained here and
  nothing fails if a 26th appears. An exception list with a reason each — the
  shape `everySpellScales.test.ts` already uses — would fix that, at the cost of
  23 profiles' worth of runtime in the suite.
