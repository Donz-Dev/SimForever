# Handoff — picking up the APL work

**All 23 priority lists are the ruleset owner's own and are in.** This file is
for the next person continuing that work: what state it is in, what is open, and
the traps that cost time the first time round.

Read in this order:

1. [CLAUDE.md](../CLAUDE.md) — the rules. Its **Rotations** section is about a
   fifth rotation lessons, and every one of them was paid for.
2. [docs/handoff-rotations.md](handoff-rotations.md) — what each list turned out
   to be worth, per profile, and the failure modes a list has.
3. This file — what is left.

---

## The state, in one table

| | |
| --- | --- |
| **23 of 23 lists** | the owner's, specified entry by entry, measured after |
| **Every entry fires** | the twelve that never did are gone; a `USES=1` sweep is clean |
| **Baseline** | republished in [HANDOVER.md](../HANDOVER.md) at 30 batches of 10 |
| **Still shells** | `WARRIOR_BATTLE` and `WARRIOR_SHIELD` only, which **no preset reaches**, plus `PET_PRIORITY` |
| **Optimisation** | NOT started. The owner's instruction was "implement the provided APLs as best as possible, don't try to optimize the lists I provided any further for now" |

**THE LISTS ARE IMPLEMENTED, NOT TUNED.** Three of them measure DOWN against the
shells they replaced and were shipped that way deliberately, with the cost
isolated rather than acted on. Do not "fix" one without asking — the design is
the owner's, and the numbers below are the price they have already been told.

---

## Open, in the order they cost the most

### 1. Wrack has no coefficient, and the ability is paused

`WoWSimWorksheet.xlsx` — the owner's authoritative coefficient document — lists
nine Warlock spells, and Wrack is not one. So it deals a flat 36 a tick and
scales with nothing: 216 over a six-second channel against a Shadow Bolt worth
268 plus 0.857 spell power in three. **As modelled it cannot be worth casting.**

The owner paused its implementation. The PR is open and unmerged; the SM/DS list
carries a comment where the entry belongs, saying why it is absent.

Its exemption in `everySpellScales.test.ts` is **the only entry in that list
which is a GAP rather than a RULE**, and the comment says to DELETE the line the
day a Wrack row exists rather than amend it.

**What unblocks it:** one number from the ruleset owner.

### 2. LW Melee lost 237 DPS and nobody has confirmed the second half

It went from the highest non-Warrior profile (558.7) to fourth from bottom
(321.5), and it is two separate things:

- **−100.6** from Raptor Strike becoming on-next-swing. Its capture said
  `"range": "Next melee"` all along and the owner confirmed it in the same
  words. **This half is not a choice** and is not in question.
- **−136.6** from the owner's list dropping Serpent Sting (8.5% of that
  profile's damage), Arcane Shot (9.6%) and Rapid Fire, while adding Hunter's
  Mark — which a 40-batch measurement put at **−10.1 for this build
  specifically**, because ranged attack power buys a melee Hunter almost nothing
  and the cast still costs a global cooldown at the pull.

**What unblocks it:** the owner confirming the list is intended as written.

### 3. Two Eviscerate gates suppress the ability they gate

Both Rogue lists that carry one are affected, and the shape is identical:
three conditions that must hold at once, one of which is a floor on a
maintenance aura's remaining duration.

| List | Gate | Result |
| --- | --- | --- |
| Venom | Slice and Dice ≥ 10s **and** Venom ≥ 10s **and** 5 points | 0.2 casts a fight; isolated at **−20.4** |
| Rupture | Slice and Dice ≥ 10s **and** Rupture ≥ 10s **and** 5 points | **0 casts**; Rupture is only applied 1.3 times a fight |

Gating the Venom one on five points alone measures 413.1 — noise against its
baseline. **Shipped as specified**; the isolation is recorded so the owner can
decide.

### 4. Shatter is a live gap that Fingers of Frost opened

"Nothing freezes a raid boss" stopped being the whole story the moment Fingers
of Frost landed: it treats the caster's next two spells as though the target
were frozen, and the Frostfire build takes **both** talents. Shatter's crit
reaches those two casts in the ruleset and does not here.

**What it needs:** `AuraDefinition.abilityModifiers` to honour the
`ALL_ABILITIES` key. The field exists (added with Berserk) and
`AuraCollection.abilityModifierFor` looks up the ability id exactly; it needs to
fold in the `'*'` entry the way `AbilityModifiers.for` already does.

### 5. "Scorch if scorch debuff <= 5" is implemented as `< 5`

Fire Vulnerability caps at five stacks, so the literal reading is always true and
makes Scorch unconditional — which would put every entry below it in the Fire
and Frostfire lists out of reach. The owner's own Combustion entry uses `>= 5`
for "at cap", which is the evidence for `< 5`.

`SCORCH_STACK_CAP` in `src/game/rotations/mage.ts` is the one-line flip if the
literal reading was intended.

### 6. `protectionTalents.test.ts` "Bastion raises DPS" is flaky

It failed twice under the full suite and passed in isolation on the same commit.
**It is a SEEDED test**, so isolated and full-suite runs should be identical —
that non-determinism is real and is not the Bastion talent. Nothing in the APL
work touches it.

---

## The one addition to the owner's orders

Everything else is theirs verbatim. **The Seal Twist cycle had no entry point:**
Seal of Command was gated on Seal of Righteousness being up and vice versa, so
after the opening Seal of the Crusader neither could ever fire and the profile
named "Seal Twist" ran a whole fight on one seal. Both entries measured zero
uses.

The owner chose Seal of Command to seed it. The clause fires only while
**neither** of the pair is up, so it starts the alternation at the pull and never
competes with it again.

---

## The tools, and the order to use them in

```bash
# The fast audit. About a minute for all 23, and the ONLY thing that shows
# three of the five ways a list fails.
SEEDS=1 ITERATIONS=10 USES=1 npx vite-node tools/measure_profiles.ts

# The standing method for a change. 30 batches of 10, with a REAL/noise verdict.
SAVE=before.json npx vite-node tools/measure_profiles.ts
# ... edit ...
BASELINE=before.json npx vite-node tools/measure_profiles.ts
```

**RUN `USES=1` BEFORE THE 30-BATCH RUN, ALWAYS.** An entry that never fires
produces an ordinary DPS figure, so a measurement of a list with a dead entry in
it measures something other than what was written. It caught a broken engine
primitive that the full test suite passed straight over.

**MEASURE IN A THROWAWAY WORKTREE AT A NAMED COMMIT.** Other sessions edit this
checkout live; a measurement taken in it once came back a clean −2.0% on two
profiles and was another session's uncommitted work.

```bash
git worktree add --detach <somewhere-outside-the-repo> <sha>
# and junction or symlink node_modules in rather than reinstalling
```

---

## Two things about this codebase that a list author needs

**COSTS ON THE BUILT CHARACTER ARE NOT THE TOOLTIP'S.** Improved Shred puts the
Cat's Shred at 42 where the ability declares 60; Ferocity puts Claw at 42 too, so
Claw could never fire at any energy. Prot Warr's Revenge is 2 rage. Read them off
`characterAtCombatStart`, which begins a real simulation and processes no events.

**THE ENGINE GATES ON WARRIOR STANCES AND ON NOTHING ELSE.** A Druid's form is
its COMBAT STYLE — a field the preset sets — not an aura, so nothing stops a Cat
casting Starfire. The three "cat form if not active" style entries in the owner's
lists are absent for that reason rather than unimplemented, and the day
form-shifting is modelled mid-fight is the day that gate has to exist.

---

## What was built to get here

Fourteen abilities, three talent mechanics and seven engine capabilities, all
merged. The engine ones are the reusable part:

| Capability | Added for | Where |
| --- | --- | --- |
| `AuraDefinition.suppressesCooldownOf` | Berserk removing Primal Bite's cooldown | hides the CHECK, does not clear the timer |
| `AuraDefinition.abilityModifiers` | Berserk's per-ability crit | combined with the standing one via `Combatant.abilityModifierFor` |
| `AuraDefinition.absorb` | Templar's Bulwark | read in `resolveDamage`, spent in `dealDamage`, like a block charge |
| `AuraDefinition.gcdFraction` | Nature's Grace | applied at the call site so `gcdLength` stays the rule |
| `AuraCollection.consumeStack` | Fingers of Frost | for an aura whose charges are spent by casting but which carries no `CastModifier` |
| `AbilityBook.resetCooldowns` | Preparation | takes an exception, because "your OTHER abilities" |
| `Combatant.lastSwingAt` / `recordSwing` | the Hunters' shot window | **this is the one that shipped broken** — see below |

**THE CAUTIONARY ONE.** `recordSwing` landed in `extraAttack` instead of
`scheduleSwing`: the two functions carry the same two lines and the edit matched
the first. The window never opened, three entries in three Hunter lists fired
zero times, nothing errored, and the comment beside it asserted the opposite of
what the code did. The full suite passed. A `USES=1` pass is what found it.
