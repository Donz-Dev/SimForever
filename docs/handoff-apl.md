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
| **Every entry fires** | the twelve that never did are gone -- but the sweep is NOT clean: **eight entries still never fire**, six of them deliberately. Listed with reasons in [ability-audit.md](ability-audit.md) |
| **Baseline** | republished in [HANDOVER.md](../HANDOVER.md) at 30 batches of 10 |
| **Still shells** | `WARRIOR_BATTLE` and `WARRIOR_SHIELD` only, which **no preset reaches**, plus `PET_PRIORITY` |
| **Optimisation** | NOT started. The owner's instruction was "implement the provided APLs as best as possible, don't try to optimize the lists I provided any further for now" |

**THE LISTS ARE IMPLEMENTED, NOT TUNED.** Three of them measure DOWN against the
shells they replaced and were shipped that way deliberately, with the cost
isolated rather than acted on. Do not "fix" one without asking — the design is
the owner's, and the numbers below are the price they have already been told.

---

## Open, in the order they cost the most

**TWO ANSWERS FROM THE RULESET OWNER CLEARED TWO ITEMS.** Wrack's coefficient is
**14.3% of spell power a tick**, six ticks a second apart -- supplied directly,
because `WoWSimWorksheet.xlsx` has no Wrack row -- and it is applied. Scorch's
`< 5` was **confirmed as intended**, which is what was already implemented. Both
entries are deleted rather than marked done.

**WRACK IS STILL IN NO LIST, AND THE COEFFICIENT IS WHY THAT DID NOT CHANGE.**
Six ticks at 14.3% is 0.858 over the channel -- Shadow Bolt's 0.857 delivered in
twice the time -- so six seconds of Wrack is about half what two Shadow Bolts
deal in the same six. The reason to cast it is the +10% to your other Shadow
DoTs, which is still unmodelled. The owner said so outright: "it's unimportant
for the rest of the simulator for now, there isn't a profile that uses it."


### 1. LW Melee lost 237 DPS and nobody has confirmed the second half

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

### 2. Two Eviscerate gates suppress the ability they gate

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

**AND `ability_audit.ts` IS THE THIRD AUDIT, for the macro question rather than
a list one.** `USES=1` shows what the LIST did; the audit adds the category
neither it nor the coefficient probe can see -- an ability in the character's own
book that is in no list and deals no damage, which is declared, learnable, never
cast, and reported nowhere. It also checks each profile's damage shares sum to
100%, which is what says the table is complete rather than merely consistent.

```bash
npx vite-node tools/ability_audit.ts
```

See [ability-audit.md](ability-audit.md) for what it found: 134 abilities in a
book somewhere, 109 exercised by at least one profile, and 25 cast by none of the
23 -- with each of the 25 grouped by why, because most of them are correct.

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

Fourteen abilities, four talent mechanics and eight engine capabilities, all
merged. The engine ones are the reusable part:

| Capability | Added for | Where |
| --- | --- | --- |
| `AuraDefinition.suppressesCooldownOf` | Berserk removing Primal Bite's cooldown | hides the CHECK, does not clear the timer |
| `AuraDefinition.abilityModifiers` | Berserk's per-ability crit | combined with the standing one via `Combatant.abilityModifierFor`. **Ignored `ALL_ABILITIES` until Shatter** — see below |
| `AbilityModifiers.addWhileAura` / `forWhileAura` | Shatter | a standing modifier with a RUNTIME condition, keyed by aura id |
| `AuraDefinition.absorb` | Templar's Bulwark | read in `resolveDamage`, spent in `dealDamage`, like a block charge |
| `AuraDefinition.gcdFraction` | Nature's Grace | applied at the call site so `gcdLength` stays the rule |
| `AuraCollection.consumeStack` | Fingers of Frost | for an aura whose charges are spent by casting but which carries no `CastModifier` |
| `AbilityBook.resetCooldowns` | Preparation | takes an exception, because "your OTHER abilities" |
| `Combatant.lastSwingAt` / `recordSwing` | the Hunters' shot window | **this is the one that shipped broken** — see below |

**THE SECOND SILENT NO-OP IN THIS TABLE.** `AuraDefinition.abilityModifiers`
looked its ability id up EXACTLY, so an aura declaring `{ '*': ... }` compiled,
applied, reported its uptime and changed nothing about any cast. Berserk
introduced the field with a NAMED ability and never exercised the catch-all,
which is why it sat there. `pick` is the one shared implementation of that fold
now, rather than the third hand-written copy of it.

**AND WHY THAT FIX WAS NOT ENOUGH ON ITS OWN**, which is the part worth keeping:
this file used to say Shatter needed only the `ALL_ABILITIES` key. It also needed
somewhere to put the number, because SHATTER'S VALUE IS ON A DIFFERENT TALENT
FROM THE AURA — Fingers of Frost builds its aura from its own rank, and Shatter's
17/33/50 is not in scope there. Writing one talent's value onto another talent's
aura is correct only while the two are visited in the right order during the
build, and talent iteration order is not something to rest a crit chance on. So
the condition is keyed by AURA ID on the standing registry instead: Shatter names
the aura, Fingers of Frost applies it, and neither reads the other. **When a
handoff names the mechanism, check it also answers where the number comes from.**

**THE CAUTIONARY ONE.** `recordSwing` landed in `extraAttack` instead of
`scheduleSwing`: the two functions carry the same two lines and the edit matched
the first. The window never opened, three entries in three Hunter lists fired
zero times, nothing errored, and the comment beside it asserted the opposite of
what the code did. The full suite passed. A `USES=1` pass is what found it.
