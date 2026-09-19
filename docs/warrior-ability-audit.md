# Warrior ability audit against Forever

Every Warrior ability the simulator models, checked against Forever's own spell
data on **2026-09-18**.

The data is captured in `src/data/abilities/forever-warrior.json` and this
document is the reading of it. **Neither needs scraping again** — refresh with:

```bash
node tools/import_spell.mjs --verify    # re-fetch all 32, diff, exit 1 on drift
node tools/import_spell.mjs --refresh   # re-capture
```

Companion to [warrior-abilities.md](warrior-abilities.md), which holds the
ruleset owner's spreadsheet transcribed verbatim.

**Where the two disagreed, the ruleset owner chose Forever** — all four cases,
listed below. The spreadsheet file is kept as the record of what it said, not as
what the simulator implements; when they differ, this file is now the one the
code follows.

---

## Where the data comes from

| | |
| --- | --- |
| Ability list | <https://www.wowhead.com/forever/class=1/warrior> |
| Rendered tooltip | `nether.wowhead.com/forever/tooltip/spell/<id>` |
| Raw effect values | `www.wowhead.com/forever/spell=<id>` |

**Both endpoints are needed.** Several Forever tooltips substitute a broken
variable and print `(100% of Spell Power)` where the damage should be, so the
number is simply absent from the text. The spell page's `Effect #N: School
Damage, Value:` row carries it.

Everything is captured at the **highest rank a level 60 warrior can learn**.
Rank matters enormously: Battle Shout rank 1 grants 12 attack power, rank 7
grants 140.

### `(100% of Spell Power)` is an artifact and is ignored

It appears on Shield Slam, Revenge, Bloodthirst and Intercept. Warriors have no
spell power, nothing in this engine grants any, and the phrase is a templating
failure rather than a statement about the damage formula. It is **not** part of
any damage calculation here.

### The effect row is base points, and the offset is not constant

Ten abilities' effect `Value` is exactly one more than the number their own
tooltip prints — Mortal Strike 161 for "plus 160", Execute 601 for "600",
Recklessness 101 for "100%", Sunder Armor −449 for "450 per".

**Two are not.** Battle Shout's value is 140 and its tooltip says 140;
Demoralizing Shout's value is −195 and its tooltip says 210. Both of those
tooltips carry a standalone `Level 60` line and none of the others do: they
**scale with level**, so the effect row is the spell's base and the tooltip is
the value at 60.

So the rule is: **the tooltip wins wherever it states a number**, because it is
rendered at level 60 and that is the only level this simulator runs. The effect
row is the fallback for Shield Slam and Revenge, whose tooltips hide the number,
and it is read the same way there as everywhere it can be checked.

A blanket −1 was applied briefly during this audit and would have made
Demoralizing Shout 7% too weak while looking rigorous.

---

## Stance gating — the question that was blocked

`docs/warrior-completion.md` §2.1 recorded stance gating as blocked on the
ruleset owner, with corrections "promised and never arrived". **Forever states
it outright**, in the spell page's `Forms` row.

| Ability | Usable in |
| --- | --- |
| Mortal Strike, Bloodthirst, Shield Slam, Slam | **any stance** |
| Heroic Strike, Cleave, Spearing Strike | **any stance** |
| Battle Shout, Demoralizing Shout, Sunder Armor, Bloodrage | **any stance** |
| Charge, Overpower, Sweeping Strikes | Battle |
| Rend, Thunder Clap | Battle or Defensive |
| Execute, Hamstring | Battle or Berserker |
| Whirlwind, Intercept, Recklessness, Berserker Rage | Berserker |
| Revenge, Shield Wall, Shield Block | Defensive |

**An empty `Forms` row means any stance, which is an answer and not an absence
of one.** Note the prose form is "Requires Battle Stance, Defensive Stance" —
comma separated, often more than one. Reading only the first halves the answer
for Rend, Execute, Thunder Clap and Hamstring.

### What the three stances do

| Stance | Effect |
| --- | --- |
| **Battle** | **Nothing.** "A balanced combat stance", in full. It exists to be the stance other things are gated on. |
| **Defensive** | −10% damage done, −10% damage taken, +30% threat |
| **Berserker** | +3% crit, +10% damage taken |

Battle Stance doing nothing was an **assumption** in `src/game/auras/warrior.ts`
— the spreadsheet has no Battle Stance row at all, and the engine defined one
anyway on the grounds that two stances with no way back to a neutral one is not
a coherent ruleset. Forever confirms both the existence and the emptiness.

The +30% threat on Defensive Stance is dropped: the engine does not track
threat.

---

## Where the simulator and Forever agree

These needed no change, and the agreement is worth recording because it raises
confidence in the rest.

| Ability | Both say |
| --- | --- |
| **Mortal Strike** | weapon damage **+160** |
| Overpower | weapon damage +35 |
| Heroic Strike | +157 |
| Cleave | +50 |
| Hamstring | +45 |
| Thunder Clap | +103 |
| Execute | 600 base, +15 per extra rage |
| Rend | 147 over 21 sec |
| Charge | generates 15 rage |
| Spearing Strike | 40% weapon damage |

**Mortal Strike is the important one.** HANDOVER records it as resolved and not
to be re-litigated: the ruleset owner confirmed **160** while the Forever talent
calculator's tooltip says 85. Forever's spell data says 160. That is now two
independent sources against the calculator, and the calculator tooltip is
confirmed wrong.

---

## Where they disagreed — RESOLVED IN FOREVER'S FAVOUR

The audit found four places the ability spreadsheet and Forever disagree. **The
ruleset owner chose Forever for all four**, and all four are now implemented.

| Ability | Was (spreadsheet) | Now (Forever) |
| --- | --- | --- |
| **Shield Slam** | 421–439 + block value | **655** + block value |
| **Revenge** | 81–99 | **153** |
| **Slam** | weapon damage, no bonus | weapon damage **+87** |
| **Bloodthirst** | 30 + 35% attack power | **35% attack power**, no flat part |

**The ranges are gone, and that is a change in shape as well as magnitude.**
Revenge and Shield Slam were each a spread of ±9 around a midpoint, which
contributed a little variance to every cast. Both are flat now, so any spread
they show comes from the combat table alone.

Shield Slam's and Revenge's tooltips hide their damage behind the `(100% of
Spell Power)` artifact, so their numbers came from the spell page's base points
— 656 and 154 — read the same way as every ability whose tooltip does state a
number, where base points run one higher than the stated figure.

### What it changed

| | Before | After |
| --- | --- | --- |
| 1H & Shield, 31-pt Protection | 93.98 | **101.37** |
| 1H & Shield Protection, target swings back | 176.81 | **219.07** |
| Dual-wield, target swings back | 222.10 | **224.04** |

**1H & Shield was the build this was about**, and it gained most — a quarter
more damage when the target swings back. Shield Slam at 655 and Revenge at 153
are both defensive-stance abilities that only come into their own when something
is hitting back.

The standing dual-wield figure did not move at all, and should not have: it uses
none of the four. Slam needs Improved Slam to be worth casting, Bloodthirst is a
Fury capstone, and Revenge and Shield Slam both need a shield or an attacker.

### And it exposed a wrong rotation ordering

Raising Shield Slam to 655 made it obvious that it was **barely being cast** —
twice in a hundred seconds standing, against thirteen times when attacked. A
shield warrior is rage starved in a way a dual-wielder is not, and Sunder
Armor's five stacks cost 75 rage ahead of it.

The opener priorities had been measured on a dual-wielder and applied to both
lists. Measuring the shield list on its own put Shield Slam above the openers:

```
standing        101.69 +/- 2.42  against  97.33 +/- 2.03   +4.36
target attacks  218.57 +/- 2.53  against 206.43 +/- 2.12  +12.14
```

**A rotation measured on one build is not measured for another.**

---

## The five abilities talents grant

`docs/warrior-completion.md` §2.2 records these as blocked on the ruleset owner
— talents grant them and the spreadsheet has no rows. **Forever has all five.**

| Ability | Spell | Forever says | Status |
| --- | --- | --- | --- |
| **Death Wish** | 12328 | +20% physical damage, +5% damage taken, 30 sec, 10 rage, 3 min | **Implemented**, in the rotation, **+11.77 ± 3.29 DPS** |
| **Last Stand** | 12975 | +30% maximum health for 20 sec, lost when it ends | **Implemented**, and worth nothing here — see below |
| **Sweeping Strikes** | 12292 | next 5 melee attacks strike an additional nearby opponent, 30 rage, Battle Stance | **Implemented and inert** — no second target |
| **Concussion Blow** | 12809 | stuns the target for 5 sec | **Out of scope.** Stuns are non-combat |
| **Piercing Howl** | 12323 | dazes nearby enemies, −50% movement, 6 sec | **Out of scope.** Snares are non-combat |

Three of the five are now real abilities. The other two are not pending: the
project owner classes stuns and snares as non-combat, so they will not be
implemented and their talents say so rather than claiming to wait on data.

**Death Wish** is a straightforward damage cooldown and the only one of the five
that moves a number. Measured at **+11.77 ± 3.29 DPS** over 250 fights against
the same Fury build with the point spent elsewhere — isolating the ability, not
the tree.

**Last Stand is implemented and changes no outcome**, which is worth stating
plainly rather than leaving someone to discover it. It raises maximum health
30%, grants that much, and takes both back when it expires. The player here
cannot drop below one health and no analyzer reports survival, so extra health
decides nothing. It exists because it is fully expressible and a talent that
grants an ability should grant a real one — not because it will show up in a
result.

**Sweeping Strikes is implemented and does nothing**, for a different reason: its
entire effect is the *additional* opponent, and every encounter here has exactly
one enemy. It is 30 rage for no damage, and is deliberately absent from every
rotation. See the next section.

---

## Multi-target: a skeleton, not a feature

Four abilities strike more than one enemy in Forever, and none of them can here.

| Ability | Forever | Here |
| --- | --- | --- |
| Cleave | 2 targets | 1 |
| Whirlwind | up to 4 | 1 |
| Thunder Clap | all nearby | 1 |
| Sweeping Strikes | next 5 attacks hit one extra | nothing at all |

`src/engine/combat/targeting.ts` holds the shape: a `TargetSelection` an ability
declares, and a `selectTargets` that resolves it. **Today it always resolves to
one target**, because `trainingDummyEncounter` builds exactly one dummy and
nothing in the engine has ever created a second. Each of the four abilities now
declares what it *would* hit, so the claim lives on the ability rather than in a
comment nobody reads.

This was a deliberate choice over two alternatives. Adding a second dummy would
have meant inventing an encounter nobody asked for, and leaving multi-target
entirely unsaid is how Whirlwind and Cleave came to look like single-target
abilities with nothing anywhere explaining that they are not.

**What it means for the numbers:** Cleave, Whirlwind and Thunder Clap are
understated by exactly the targets they do not hit — which against a single
dummy is the correct answer, because a single dummy is one target. Sweeping
Strikes is not understated; it is inert. Anything reading these figures for a
multi-target fight is reading the wrong simulator.

---

## What Forever still does not answer

- **Berserker Rage** names no magnitude: "generating extra rage when taking
  damage". Its other half is Fear and Incapacitate immunity, which the engine
  has no notion of. A gap in the source, not in the capture.
- **Damage ranges.** The effect rows give a single base value, not a min and
  max, so Forever cannot say whether Shield Slam's 655 is flat or the centre of
  a range the way the spreadsheet's 421–439 is.
- **Intercept's damage**, as above.
