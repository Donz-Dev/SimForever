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
| **135** | abilities in at least one profile's book |
| **110** | exercised by at least one profile |
| **25** | never cast by any of the 23 |

**IMMOLATION TRAP IS THE 135th AND THE 110th AT ONCE.** It is a trainer spell
every Hunter learns, so it entered all three books, and the owner placed it in
one list — so it is cast by the melee Hunter and sits in the book, in no list,
for the two ranged ones. **The never-cast count did not move**, which is the
right outcome for an ability that arrived already in a list.
| **9** | priority list entries that never fire — 8 at the time of this table, plus Spearing Strike, see below |
| **23 of 23** | damage tables summing to 100% — **nothing unaccounted, anywhere** |

**THE SHARE TOTAL IS THE STRONGEST RESULT HERE and the easiest to overlook.**
Every profile's damage breakdown adds to 100%, which is what says the table is
complete rather than merely consistent. A damage source nobody reports reads as
a zero rather than as a gap — the same failure `resourceFlow` had when it summed
every pool under a heading that said "Rage" and produced a tidy 100%.

**AND NO ABILITY DEALS DAMAGE WITHOUT SCALING.** That is the probe's result, not
this one's, and the two together are the macro bill of health: everything that
deals damage scales with something, and everything that deals damage is counted.

## The nine list entries that never fire

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
| `hammer_of_wrath` | Seal Twist Ret | **out of mana, not out of window, and still out of mana after 863 mana a fight was added to the build.** See below -- this row said the wrong thing for a day |
| `spearing_strike` | DW Fury | **the build does not have the ability**, because Spearing Strike requires a two-handed weapon and that list is only reached by a dual-wielder. Added 2026-09-30; the entry is the owner's and is left as written |

Seven causes, four of them deliberate, one ruled on, one a RESOURCE and one a
WEAPON. **None is a broken declaration**, which is the point of listing them with
reasons rather than counting them.

**AND THE LAST ONE IS INVISIBLE TO THIS AUDIT**, which is worth saying in the
document the audit produces. `ability_audit.ts` reports a listed entry only when
the built character HAS the ability, so an entry naming an ability the build
never learned does not appear here at all -- it shows up in
`tools/class_audit.ts`, which reads the list against the book. That is the fourth
of the five causes of a never-fired entry, and the tool most people reach for
cannot see it.

### Hammer of Wrath: the audit found it, and then named the wrong cause

**This row first read "needs the target below 20% health, which never happens".
That was wrong, and it is a good example of why a never-fired entry needs its
cause MEASURED rather than inferred** -- the plausible explanation was sitting
right there and it was not the true one.

Its "20% or less health" is already the CLOCK, not health: `inExecutePhase` in
`combat/executePhase.ts`, the same rule Execute runs on, shared rather than
duplicated. `paladinAbilities.test.ts` pins it -- refused for the first four
fifths of the fight, allowed in the last, and the target's health untouched
throughout. **The window opens.**

What refuses it is MANA. Sampling `checkCast` every half second through the
execute phase of the Retribution profile:

| outcome | samples |
| --- | --- |
| `not_enough_resource` | 22 |
| `on_gcd` | 3 |

**The Retribution Paladin spends 3425 of the 3449 mana it gains in a fight.** It
is completely resource-bound, and a 425-mana ability that only becomes legal in
the last fifth arrives when there is nothing left to pay with. Its cost is not a
transcription error: 425 mana, a 1-second cast and a 6-second cooldown are all
confirmed against `forever-paladin-spellbook.json`, at rank 3, which is max.

**THE CROSS-CHECK THAT IT IS MANA AND NOT THE GATE IS THE SHOCKADIN**, which
carries the same entry and casts it **2.0 times a fight** on more mana than
Retribution has. Same ability, same clock, more mana, and it fires.

So this is a resource question and a list question, not an engine one, and it is
**not fixed here** -- reordering the entry does not conjure mana, and whether
Hammer of Wrath is worth more per mana than the Consecration it would displace is
a measurement nobody has taken. Recorded so that the next person starts from the
real cause.

### AND IT SURVIVED TWO THINGS THAT SHOULD HAVE FIXED IT

The Paladin deep dive gave the Retribution build **170 mana a cast off this very
ability** -- Holy Conduit's 40% reduction, whose `unmodelled` reason had been
written before Hammer of Wrath was a declared ability and listed it among the
clauses that could not apply -- and **693 mana a fight** from Sanctified
Judgement, which went from inert to the largest single source of mana either
Retribution build has. It still never fires.

`npx vite-node tools/probe_resources.ts` is the tool that says why, and it
exists because this question gets asked while reading a priority list:

```
Seal Twist Ret  526.7 DPS
mana: gained 4101  spent 4023  wasted 0  headroom 78
  GAINED   Started the fight with 3344   Sanctified Judgement 693   Regeneration 64
  SPENT    Consecration 1196   Seal of Command 1090   Seal of Righteousness 1038
           Judgement 428   Seal of the Crusader 144   Holy Strike 127
```

**78 mana of headroom in a whole fight, against a 255-mana ability.** The two
twisted seals take 2128 between them, which is the capstone's own price: a
Paladin that swaps seals every few seconds pays for every swap. **A build this
resource-bound absorbs any amount of extra mana into the entries above the one
that is starving**, which is worth knowing before adding sustain to fix a
never-fired entry.

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
| **The owner's list does not name it** | `ghostly_strike`, `expose_armor`, `searing_pain`, `ferocious_bite`. ~~`shadow_word_death`~~ **IS BACK AND IS WORTH +37.7.** The price was recorded against it twice while it was absent -- −35.7 when it came out and +35.2 re-isolated later -- and then the owner put it in. **A figure recorded against an absent ability is a standing offer, and this one was taken.** The Priest's book now holds nothing that no profile casts |
| ~~**Declared, and deliberately in no list**~~ | ~~`wrack`~~ **IN THE SM/DS LIST, AND NOW THE PROFILE'S LARGEST SOURCE AT 26.6%.** The owner paused it, un-paused it, and has since ruled it periodic for Malediction. **Its gate names Siphon Life, so removing Siphon Life silently takes Wrack with it** — measured, and it cost a wrong answer before it was caught |
| **Unreachable on cost** | `claw` — Improved Shred and Ferocity put it and Shred at the SAME 42 energy, so the harder-hitting one is always taken. A known finding |
| **Superseded within its own class** | `fireball`, `frostbolt`, `fire_blast` — the three Mage lists cast `frostfire_bolt`, `scorch`, `arcane_missiles` and `arcane_blast` instead |

**TWO WORTH A SECOND LOOK, and neither is a bug:**

- **`ferocious_bite`** is a Cat finisher that no profile casts. The owner's
  `DRUID_CAT` list is five entries and its finisher is `rip`; Ferocious Bite is
  in the book and in no list. It is one of the twelve entries that once fired
  zero times, and removal is how it was resolved. **The intent is an open
  question for the owner**, and the Cat's energy budget is why it is defensible:
  about 690 energy for a whole fight, and Bite empties the bar.
- **`frostbolt`** is cast by no Mage including Frostfire, which sounds wrong for
  a Frost build and is not: that list casts `frostfire_bolt`, which is also a
  Chill effect, so **Fingers of Frost still procs** and Shatter's window still
  opens.

## A third bucket: declared and in NOBODY's book

**THE SAME BLIND SPOT THIS AUDIT WAS WRITTEN TO CLOSE, one step further out.**
An ability in the book, in no list, dealing no damage was invisible to everything
until this audit existed. An ability in NO BOOK AT ALL was invisible to the audit
too: it appeared in neither the "in a book somewhere" total nor the 25, so it read
as an ability that does not exist.

| Class | Ability | Why |
| --- | --- | --- |
| Druid | `natures_swiftness` | granted by a talent no Druid profile takes. Built as the second caller of the one-shot cast-time rule, tested on its mechanism, and worth nothing to the three builds |

**ONE TODAY, and the bucket matters more than the entry.** A declaration nothing
can reach is exactly what an unfinished ability looks like, and the difference
between the two is a sentence somebody has to write.

## What this does NOT check

Said plainly, because an audit that looks complete is worse than one with stated
limits.

- **It does not check that a number is right.** An ability firing for a plausible
  wrong figure passes here. That is `ownerCoefficients.test.ts` and the probe.
- **It is one batch of ten, not the 30-batch method**, because the question is
  "did this fire at all" and one batch settles it. Do not read its DPS.
- **It cannot reach what the harness cannot set up, and a never-fired entry does
  not announce its cause.**   `ambush` needs stealth. `hammer_of_wrath` is the other shape and the more
  interesting one: the harness CAN reach its window, and the profile still cannot
  afford it -- which is why the cause has to be measured rather than guessed.
- **There is no test pinning this.** The 25 and the 8 are explained here and
  nothing fails if a 26th appears. An exception list with a reason each — the
  shape `everySpellScales.test.ts` already uses — would fix that, at the cost of
  23 profiles' worth of runtime in the suite.
