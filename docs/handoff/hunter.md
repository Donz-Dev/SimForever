# HUNTER DEEP DIVE

**Class:** Hunter
**Profiles to audit and prepare:** BM Hunter, LW Ranged, LW Melee

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**THIS CLASS HAS THE PROJECT'S ONLY THIRD SOURCE, AND ITS OWN WIKI.**
`github.com/classic-hunter/forever-hunter/wiki` is the **only** source for pet stat
scaling and pet focus regeneration, plus a full Forever-vs-Classic diff for the
Hunter. Community-maintained, so it ranks below the owner's files and
`foreverchanges.pro` where they overlap — **they have not yet disagreed.**

**AND THIS CLASS IS WHERE NEVER READING A CLASSIC NUMBER WAS PROVEN.** Forever
changed four Hunter numbers in four different directions: Aimed Shot's bonus
600 → 166, Raptor Strike's 140 → 70, Serpent Sting's total 490 → 555, and Arcane
Shot **gained** a ranged attack power coefficient while **losing** its spell power
one. A Classic value here is not even a safe approximation.

**SEVEN OF THE THIRTEEN LIVE GAPS ARE TRAPS OR BEING ATTACKED**, and no Hunter
profile is attacked. That is the encounter, not the engine.

---

## The profiles

| Profile | Talents | DPS | List | Notes |
| --- | --- | --- | --- | --- |
| BM Hunter | 31/20/0 | **405.8** | `HUNTER_BEAST_MASTERY` | **the only profile with a pet** |
| LW Melee | 7/13/31 | **321.5** | `HUNTER_LONE_WOLF_MELEE` | |
| LW Ranged | 7/39/5 | **311.7** | `HUNTER_LONE_WOLF_RANGED` | |

**LW MELEE LOST 237.1 DPS AND WENT FROM THE HIGHEST NON-WARRIOR PROFILE TO FOURTH
FROM BOTTOM.** Two separate things, and **the owner has accepted both**:

- **−100.6** from Raptor Strike becoming on-next-swing. Its capture said
  `"range": "Next melee"` all along and the owner confirmed it. **Not a choice.**
- **−136.6** from the owner's list dropping Serpent Sting (8.5% of that profile's
  damage), Arcane Shot (9.6%) and Rapid Fire while adding Hunter's Mark — which a
  40-batch measurement put at **−10.1 for this build specifically**, because ranged
  attack power buys a melee Hunter almost nothing and the cast still costs a GCD at
  the pull.

**The owner's position: "I'm fine with LW melee's −136.6 for now. It's explainable
based on the changes that were made (to make it more accurate). We can revisit it
once everything is working."** So it is a record, not a question.

**LW Ranged fell −11.1% when Sniper Shot became a four-second cast**, and
**that list still wants re-measuring**: a cast resets the ranged swing timer, which
is the rule that removed Aimed Shot from that list at *two* seconds. Dropping
Sniper Shot measured **+7.9 on one run** and wants the full 30-batch method. **Not
changed yet — this is the one live measurement item for this class.**

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| BM Hunter | Ranged Auto 33.8%, Main Hand 25.5%, Aimed Shot 12.7%, Serpent Sting 12.2%, **Claw 7.1%, Hawk 5.5%** |
| LW Ranged | Ranged Auto 49.7%, Arcane Shot 19.6%, Aimed Shot 13.0%, Serpent Sting 11.0%, Sniper Shot 6.6% |
| LW Melee | Main Hand 35.5%, Raptor Strike 32.4%, **Strider Kick 22.9%**, Mongoose Bite 9.2% |

**BM Hunter is the only profile that swings BOTH melee and ranged** and its pet's
Claw is a visible 7.1%. **Reporting reads every friendly actor, not the player** —
damage and buff uptime both, or a working pet talent looks exactly like an inert one.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 50 | 24 | 5 | 8 | **13** |

### The 13 live gaps, grouped by cause

**Traps, and no profile places one (five):** `entrapment`, `clever_traps`,
`survival_tactics`, `survivalist_s_discipline`, `resourcefulness`

**Nothing attacks a Hunter (four):** `deterrence`, `counterattack` (after a parry),
`spirit_bond`, `improved_aspect_of_the_monkey`

**Needs a kill:** `rapid_killing`'s damage half — **its Rapid Fire cooldown
reduction is real**, so the reason should say which half works

**The encounter, not the engine:** `trueshot_aura` — a party-wide ranged attack
power aura, which for one character is the raid buff of the same name;
`improved_revive_pet` — no pet dies

**A declaration that does not exist yet:**

| Talent | What it needs |
| --- | --- |
| `lacerating_strikes` | a bleed worth a share of the damage Mongoose Bite dealt. **The bleed itself is expressible** — worth re-reading, because Mongoose Bite is 9.2% of LW Melee |

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `bestial_discipline` | pet focus regen applies; "mana regen while casting" does not |
| `improved_stings` | Serpent Sting damage applies; Viper and Scorpid reach neither |
| `improved_tracking` | **applied as a flat damage bonus, which ASSUMES the Hunter is tracking the right creature type** — an interpretation worth confirming |
| `surefooted` | the hit applies; movement or control does not |
| `predator_s_edge` | melee crit damage applies; its OFF-HAND clause does not, because every Hunter here holds one weapon |

---

## Never-fired entries

**None.** All three Hunter lists have every entry firing — **and getting there took
finding an engine bug.**

## In the book, in no list, never cast

`aspect_of_the_beast`, `aspect_of_the_hawk`, `arcane_shot`, `aimed_shot`,
`multi_shot`, `raptor_strike`, `mongoose_bite`, `serpent_sting`, `rapid_fire` —
varying by profile, and mostly correct: the melee list does not shoot and the
ranged lists do not strike.

**`multi_shot` is cast by no Hunter at all** — area damage, one target.

---

## Traps specific to this class

- **RANGED IS CHECKED BEFORE TWO-HANDED, BECAUSE A BOW IS BOTH.** Reading
  `twoHanded` first normalises every bow to 3.3 instead of 2.8 and **inflates every
  Hunter shot by 18%.**
- **A ranged weapon scales with RANGED attack power**, keyed on
  `weaponScaling.slot` and **never on `weaponSlot`** — the latter says whose procs an
  attack triggers. **This was wrong for the whole project and 1,548 tests passed
  with it in**, because a Hunter with a plausible attack power produces a plausible
  number.
- **A HUNTER SHOT TAKES NO SPELL COEFFICIENT.** Forever REMOVED Arcane Shot's and
  gave it a ranged attack power one, so reading spell power would reinstate
  something Forever took out. The sheet confirms it — **the Hunter is the one class
  it left entirely unchanged.** `arcane_shot` and `serpent_sting` are the two
  standing exemptions in `everySpellScales.test.ts`, and both are RULES not gaps.
- **Mortal Shots' crit damage reaches Serpent Sting's ticks and "damage you deal
  with ranged WEAPONS" correctly does not.** A tick is reached for CRIT and not for
  DAMAGE: the crit fields read `attackTable ?? critFrom`, the damage multiplier
  reads `attackTable` alone.
- **THE CAUTIONARY ENGINE BUG LIVES HERE.** `Combatant.recordSwing` was added so
  these lists could ask "has a ranged auto-attack fired in the last 0.5 seconds",
  and it **landed in `extraAttack` instead of `scheduleSwing`** — two functions
  carrying the SAME TWO LINES, so the edit matched the wrong one. The window never
  opened, **Aimed Shot and Sniper Shot fired zero times in three lists**, nothing
  errored, and the comment beside the mistake asserted the opposite of what the code
  did. **The full suite passed. A `USES=1` pass is what found it.**
- **SNIPER SHOT WAS WRONG IN FOUR FIELDS AT ONCE**, with the answers in its own
  capture the whole time: it read 160 damage, a 200-mana placeholder, instant cast
  and 6s cooldown; the capture says **295, 365 mana, a 4-second cast and 15
  seconds**, at both client builds. The old comment applied the rank-1 rule to a
  capture that is **already max rank** — a real rule, the wrong artifact. **Read the
  capture's `rank` field rather than reasoning about what the page shows.**
- **A STAT PROBE IS NOT AN ABILITY PROBE.** Injecting Hunter's Mark's 71 ranged
  attack power said +1.9 to the melee Hunter; casting the ABILITY — which also spends
  60 mana and a GCD at the pull — measured **−10.1**. Measure the CAST.
- **`PLACEHOLDER_PET_BASE_DPS` is 50** and every source gives family modifiers
  RELATIVE to a base that none of them states. **A pet's base is a DPS, not a
  per-swing damage**, which makes its swing speed damage-neutral — and a placeholder
  in the wrong UNIT is worse than one with the wrong value.
- **Pet stats come from the owner**: 2 health a stamina, 30% of armor, **10% of the
  HIGHEST attack power source, 100% of crit** — far more gear-sensitive than a
  Classic pet. **A pet receives no raid buffs**, a Forever rule; `kind === 'player'`
  is the test, not `isPlayerControlled`, which counts a pet.
- **`bringsPet` answers "will there be a pet" ONCE**, for both whether the encounter
  BUILDS one and whether a pet-gated talent APPLIES. `requires: {}` on "while your
  pet is active" once paid both no-pet builds — **a condition nobody declared is not
  an omission, it is a bonus being paid.**
- **The hawk is modelled WITHOUT a combatant**, on the owner's call: the damage
  lands and is credited, and what is lost is separate targetability. **Its damage
  is an open question** — both sources state ONE figure (108 / 110) for a hawk that
  "continu[es] its assault for 18 sec" and **neither quantifies the continuing
  assault**, which the simulator models at 32 a strike. **32 appears in no source.**
- **THE OWNER'S LIST OUTRANKS A MEASURED DECISION OF OURS, AND THE MEASUREMENT
  STAYS.** `petsAndHunter.test.ts` asserted Hunter's Mark OUT of the melee list on
  40 batches saying −10.1. The owner's list names it, so it is in, and −10.1 became
  the price of that choice. The test now asserts the ability is cast once — an
  invariant — and keeps the figure.

---

## What "done" looks like

1. **LW Ranged re-measured with Sniper Shot dropped**, at the full 30 batches of 10.
   One run said +7.9 and it has not been changed. **This is the live item.**
2. **The hawk's damage asked for** — is 108 the per-strike rate (which would more
   than triple it) or an opening hit on top of unstated ticks? 32 is invented and
   named.
3. **One pet base DPS or damage range at 60 asked for.** Every source gives family
   modifiers relative to an absolute none of them states.
4. **`lacerating_strikes` re-read**, since the bleed itself is expressible and
   Mongoose Bite is 9.2% of LW Melee.
5. **`improved_tracking`'s assumption confirmed** — it is applied as a flat bonus on
   the assumption the Hunter is tracking the right creature type, which is an
   interpretation nobody has ratified.
6. **`rapid_killing`'s reason split**, since its cooldown half works and its damage
   half needs a kill.
