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
ruleset owner's spreadsheet transcribed verbatim. **That file is what the
simulator implements. This file is what Forever says.** Where they disagree,
both are recorded and neither is quietly preferred.

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
row is for Shield Slam and Revenge, whose tooltips hide the number — and for
those two the −1 is an **assumption that cannot be cross-checked**.

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

## Where they disagree — the findings

**Nothing here has been changed.** `CLAUDE.md` is explicit: where two sources
disagree, say so and prefer the one the ruleset owner supplied directly, rather
than averaging them or quietly preferring the newer. The spreadsheet is the
direct supply. These need a decision.

| Ability | Spreadsheet (implemented) | Forever | Gap |
| --- | --- | --- | --- |
| **Shield Slam** | 421–439 | **655**, plus block value | Forever is ~50% higher |
| **Revenge** | 81–99 | **153** flat | Forever is ~70% higher |
| **Slam** | weapon damage, no bonus | weapon damage **+87** | a whole missing component |
| **Bloodthirst** | **30** + 35% attack power | 35% attack power, no flat part | a spurious flat 30 |

Two smaller notes:

- **Intercept** is implemented at 65 base damage. Forever's tooltip hides its
  damage behind the Spell Power artifact and its effect rows carry only the
  charge, so **Forever cannot confirm or deny 65**. Left alone.
- **Whirlwind** is weapon damage against *up to 4 enemies* in Forever. The
  engine simulates one target, so the multi-target clause is unmodelled — which
  understates Whirlwind against anything but a single dummy.

Shield Slam's gap is the one with a knock-on: the rotation comment in
`game/rotations/warrior.ts` calls Shield Slam "undervalued here", and 1H &
Shield is the weakest build the simulator reports. If 655 is right, that is
most of the explanation.

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
