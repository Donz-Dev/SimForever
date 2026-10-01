# Coefficients

How damage scales with gear. **The numbers are data, supplied by the ruleset
owner, and they are not derived from anything.**

The source is `WoWSimWorksheet.xlsx`, handed over on 2026-09-29 as the
authoritative document for attack power, weapon damage and spell power
coefficients. It is transcribed row for row in
[`src/game/combat/coefficients.ts`](../src/game/combat/coefficients.ts), which is
the single place to diff against a refreshed sheet.

## The three shapes a row takes

| The sheet says | It means |
| --- | --- |
| a percentage | the ability carries its own coefficient, the same on any weapon. Bloodthirst's 35% of attack power |
| `weapon damage`, or `40% weapon damage` | the damage IS the weapon's, so attack power reaches it through the weapon at `speed / 14` |
| `N% per tick` | a damage-over-time effect, stated PER TICK rather than for the whole effect |
| `N%*combo point spent` | multiplied by the points the finisher spent, so a five-point Eviscerate carries 20% |

**A COEFFICIENT IS ADDED TO THE BASE DAMAGE, NEVER INSTEAD OF IT.** The owner's
instruction, given with the sheet: *"many spells have a base damage that needs to
be added to this ... make sure that flat ability damage doesn't get lost."*

`scaleByPower` computes `baseAmount + coefficient × power`, so the pipeline
already does this. What the instruction guards against is an EDIT that drops a
flat term while setting a coefficient — which compiles, passes a coefficient
test, and silently deletes half an ability.
[`tests/game/ownerCoefficients.test.ts`](../tests/game/ownerCoefficients.test.ts)
is the guard: it casts every damaging ability on a character with **no** attack
power, ranged attack power or spell power, so every coefficient contributes
exactly zero and what is left is the flat damage.

## What this replaced

Until the sheet arrived, every coefficient in the project was **derived**:

```
direct    castTime / 3.5, clamped to [1.5, 3.5] seconds
channel   channelDuration / 3.5, split evenly across ticks
periodic  baseDuration / 15, split evenly across ticks
hybrid    both, each scaled by its own share of their sum
```

The cast-time rule and the 1.5-second instant were the owner's. **The other
three were WoW Classic's**, borrowed on the owner's ruling because Forever had
stated none, and each carried a `PLACEHOLDER_` name saying so. All of it is
gone — `src/game/combat/spellCoefficient.ts` was deleted, and with it:

| Gone | Was |
| --- | --- |
| `PLACEHOLDER_SPELL_COEFFICIENT_DOT_DIVISOR` | 15, Classic's |
| `PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS` | 3.5, Classic's. Pyroblast was the only spell that reached it |
| the hybrid share formula | Classic's, and the largest judgement call in the feature |

**THE DERIVATION AND THE SHEET DISAGREE IN BOTH DIRECTIONS AND BY A LOT.** Blast
Wave fell from 0.43 to 0.129. Devouring Plague's tick halved and Siphon Life's
quartered. Fireball's burn lost its share entirely, and its hit went from 0.652
to 0.84. Revenge, Rend and Thunder Clap gained attack power coefficients they
never had. A derived number that looks reasonable is exactly what this project
is built not to trust.

**One agreement is worth recording as a coincidence rather than a confirmation.**
Arcane Missiles' 28.6% a missile is exactly what `5 / 3.5 / 5` gave, and
Starfire's 1.0 is exactly `3.5 / 3.5`. Those two spells alone would have made the
replacement look like a no-op.

## Two supersessions inside it

Neither is a refinement. Both are the same owner stating something different
later, and in both cases the later and more specific document wins.

### Seal of Righteousness

The owner supplied a formula earlier:

```
base + baseWeaponSpeed × (0.022 × attackPower + 0.044 × spellPower)
```

It read **attack power** as well as spell power, and scaled **continuously** with
weapon speed — so "slower weapons cause more Holy damage per swing" fell out of
the arithmetic rather than needing a rule.

The sheet gives two flat spell power figures chosen by weapon **type** — 20% with
a one-hander, 22% with a two-hander — and **no attack power term at all**. The
direction survived and the magnitude did not: a 3.6-second weapon used to be
worth twice a 1.8-second one and is now worth 10% more.

The base survived too. "21 to 75" still supplies the flat term the coefficient is
added to.

### Rend, Revenge and Thunder Clap

`WoWForeverWarriorAbilities.xlsx` — the per-class ability sheet, and for a long
time the highest authority in this project — states a coefficient of **0** for
every Warrior strike, and Rend's comment quoted that zero directly.
`WoWSimWorksheet.xlsx` gives Revenge 22% of attack power, Thunder Clap 7%, and
Rend 2% per tick, while leaving Execute, Shield Slam, Intercept and Hamstring at
zero.

Called out in the code at both sites, because a reader who knows the Warrior
sheet would otherwise read the new numbers as transcription errors.

## What the sheet does not reach

**NO ROWS ARE LEFT.** Two were transcribed and not applied because each landed
on something that did not exist, and both have since been built -- the poison
system, and then Hammer of Wrath. Everything stays in `coefficients.ts` rather
than being dropped, so the transcription covers every row and the table below
is kept as the record of what was once outstanding and why.

| Row | Why not |
| --- | --- |
| ~~Hammer of Wrath 42.857%~~ | **APPLIED.** The ability was not declared, and what changed was not the data but the ruleset owner putting it in two Paladin priority lists. Its "only usable on enemies that have 20% or less health" is the CLOCK here, by the same ruling Execute runs on -- `combat/executePhase.ts` |
| ~~Instant Poison 0.5%, Deadly Poison 0.45% per tick~~ | **APPLIED.** `reactions/poisons.ts` reads the first and `auras/rogue.ts` the second. The reason here said "poisons are not implemented at all" for a while after they were, which is the failure mode an `unmodelled` reason has: it is a claim with a date on it |

### And THREE coefficients exist that the sheet does not contain

**THE SHEET IS AUTHORITATIVE FOR WHAT IT COVERS AND IT DOES NOT COVER EVERYTHING.**
Three damage sources in this project carry a coefficient supplied by the ruleset
owner DIRECTLY, in answer to a question, and none of them is in
`WoWSimWorksheet.xlsx`. Each says so beside the constant, because the provenance is
different even though the authority is the same, and **a refresh of the sheet will
not carry any of them.**

| Source | Coefficient | Supplied |
| --- | --- | --- |
| Wrack | 14.3% of spell power **per tick**, six ticks | the sheet lists nine Warlock spells and Wrack is not one |
| Searing Totem | 8% of spell power **per tick** | with the ruling that modelled the totem as a damage-over-time effect at all |
| Fire Nova | 10% of spell power | 2026-09-30, asked for with the alternatives beside it. "Give it a 10% spell power coefficient for now" — and the "for now" is recorded rather than smoothed away |

**ALL THREE ARE SPELLS FOREVER ADDED OR CHANGED, which is why the sheet has no
row.** Fire Nova is `versusClassic: "new"`, so there was never a Classic row to
carry over and nothing to transcribe. **A missing row is therefore not evidence
that a spell does not scale** — it can simply mean the spell is newer than the
document, and asking is one message.

**AND A MISSING COEFFICIENT CAN BE WHAT BLOCKS A TALENT WHILE SOMETHING ELSE TAKES
THE BLAME.** Improved Fire Nova spent the project `unmodelled` citing an engine gap
shared with the Warlock and the Mage; what it needed was the row above.
**Magma Totem is the same question still open**, and it is the only Shaman clause
left: a damage totem, fully specified except for its coefficient.

## What it moved

300 iterations, seed 12345, preset raid buffs. **Nineteen of twenty-three
profiles moved**, which is expected: this replaced every coefficient in the
project at once.

| Profile | Before | After | |
| --- | --- | --- | --- |
| Prot Warr | 357.5 | 454.2 | **+27.0%** — Revenge, a Protection staple, went from flat to 22% |
| Cat | 272.0 | 351.7 | **+29.3%** — Rip, Ferocious Bite, Rake and Swipe all gained one |
| Bear | 208.4 | 254.7 | +22.2% — Lacerate and Swipe |
| Frostfire Mage | 304.1 | 340.0 | +11.8% — the burn's share returned to the hit |
| Fire Mage | 354.3 | 390.5 | +10.2% — the same, on Fireball and Pyroblast |
| Shadow Priest | 509.4 | 449.3 | **−11.8%** — Devouring Plague halved, Mind Flay reduced |
| SM/DS | 333.8 | 292.6 | **−12.3%** — Siphon Life's tick quartered |

**THE THREE HUNTERS DID NOT MOVE BY A DECIMAL**, and that is the check that
matters. The Hunter is the one class whose every row the sheet left unchanged —
Serpent Sting at 15%, Arcane Shot at 10%, the rest weapon damage — so all three
profiles coming back at exactly their old figures says the change stayed inside
the rows that moved. DW Fury did not move either, for the same reason: its list
is weapon damage and Bloodthirst, whose 35% the sheet confirms.

## How it is kept honest

| | |
| --- | --- |
| [`tests/game/ownerCoefficients.test.ts`](../tests/game/ownerCoefficients.test.ts) | the flat-damage guard above, one case per ability, discovered from the presets so a new ability is covered without anyone remembering |
| [`tools/coefficient_probe.ts`](../tools/coefficient_probe.ts) | measures what every ability ACTUALLY scales with, by moving one stat and reading the damage. A declaration proves nothing; this is what caught the four flat finishers in the first place |
| [`docs/coefficient-audit.md`](coefficient-audit.md) | the probe's output, per class, to read against the sheet |

**A DAMAGE-OVER-TIME ROW IS PER TICK ON THE SHEET AND A TOTAL IN THE AUDIT**, so
Devouring Plague reads 10% there and 80% here. Both are right and they answer
different questions.
