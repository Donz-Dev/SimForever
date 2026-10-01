# WARLOCK DEEP DIVE

**Class:** Warlock
**Profiles:** SM/DS, Firelock

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**FIRELOCK WAS OVERSTATED BY 12.5% AND NOTHING LOOKED WRONG. TWO OF ITS TALENTS
SELECTED A SCHOOL WHERE THE TOOLTIP SELECTS A TREE, AND TWO OF ITS BUFFS RAISED
EVERY SCHOOL WHERE THE TOOLTIP NAMES ONE.**

535.5 → **468.4**, and every one of the four causes carried a comment at the time
admitting what it was doing. The comments were honest; the numbers were not.

| | |
| --- | --- |
| **−42.2** | **Shadow and Flame**, whose two halves name OPPOSITE schools on purpose — "+10% Shadow when Conflagrate hits, +10% Fire when Shadowburn hits". Both were whole-character multipliers, so Firelock held x1.10 **twice on every school** where the talent gives x1.10 once per school. Its comment read "generous for a hybrid, which Firelock is" |
| **−13.1** | **Demonic Sacrifice**, whose Succubus option is "+15% **Fire** damage". Whole-character again, so the 22% of Firelock's damage that is Shadow — Corruption and Shadowburn — collected a fire bonus. Its comment read "exact for either profile", which was true of SM/DS and not of this one |
| **−4.8** | **Agonizing Flames**, "+10% damage to all your **Destruction** spells", read as Fire and Shadow — the two schools a Warlock has, which is every spell it owns, so it also raised Corruption |
| **−3.3** | **Ruin**, "+100% crit damage bonus to your **Destruction** spells", the same mistake |

They compound, which is why the four sum to 63.4 and the total is 67.1. Each was
isolated by reverting it alone and re-running the thirty batches.

**THE ENGINE FIELD THAT WAS MISSING HAD BEEN PREDICTED BY NAME BEFORE IT EXISTED.**
`game/auras/warrior.ts` says, of Death Wish's "Physical" qualifier, that "the day
an aura needs to scale one school and not another is the day this needs a
`damageDoneBySchool`". `SchoolModifiers` could not hold these because it is built
once when the character is, and all four effects come and go.

**AND "YOUR DESTRUCTION SPELLS" IS NOT A SCHOOL.** `WARLOCK_DESTRUCTION_SPELLS`
reads the spellbook capture's own `tab` field now — and **Shadow Bolt is a
Destruction spell**, which is the one entry a reader would get wrong from the
school alone.

### The other half: SM/DS gained 14.8 from one talent

**349.1 → 363.9**, all of it Pandemic, which was the largest single live gap in
the class. Its `unmodelled` reason was exact and named the field it wanted —
`critMultiplierBonus` on `AbilityModifiers`, which had existed since Impale with
no talent effect reaching it. `abilityCritDamage` is that declaration. **The
Rogue's Lethality wanted the identical one**, so it was built once and both are
live.

### The count was always the misleading number, and still is

**THIRTEEN OF THE REMAINING GAPS ARE ONE THING: BOTH PROFILES TAKE DEMONIC
SACRIFICE, WHICH KILLS THE DEMON.**

`improved_imp`, `improved_voidwalker`, `improved_sayaad`, `improved_felhunter`,
`unholy_power`, `demonic_energies`, `demonic_brand`, `soul_link`,
`demonic_knowledge`, `master_demonologist`, `improved_health_funnel`,
`master_summoner`, `fel_domination`, `demonic_pact` — **every one is inert
because there is no pet, and there is no pet because the build chose not to have
one.** That is the BUILD cause and it is correctly dead, the same situation as the
Hunter's Lone Wolf. **Neither profile spends a point in any of them.**

**A FURTHER FOUR ARE THE ENCOUNTER:** `fel_concentration`, `intensity`,
`molten_skin`, and half of `demonic_aegis` all need something to attack the
Warlock, and `encounter.targetAttacks` is false for both profiles. **That is not
an engine gap either** — `damageTakenMultiplier` on an aura expresses Molten Skin
exactly, and a Warlock profile fighting a target that swings back would make it
live with no new capability. **Each reason says so in those words now**, rather
than the four-word version it had.

**So of 22 live gaps, 17 are the build or the encounter.** The real engine queue
is five, and three of those five want the ruleset owner or the spell list rather
than code.

---

## The profiles

| Profile | Talents | DPS | Was | List |
| --- | --- | --- | --- | --- |
| Firelock | 5/11/35 | **468.4** | 535.5, **−67.1 REAL** | `WARLOCK_DESTRUCTION` |
| SM/DS | 40/11/0 | **363.9** | 349.1, **+14.8 REAL** | `WARLOCK_AFFLICTION` |

**FIRELOCK IS NO LONGER THE THIRD-HIGHEST PROFILE IN THE PROJECT.** It sits
between Prot Warr's 454.6 and Cat's 488.0 now. The drop is a CORRECTION and not a
regression, and the other twenty-one profiles moved by nothing at all except the
three Rogues, which is what a change scoped to two classes should look like.

**SM/DS GAINED +55.9 FROM THE OWNER'S LIST — THE LARGEST GAIN OF ALL 23** — and
it went from six entries to five doing it. **The count was never the thing, the
conditions were.**

**Firelock gained +12.1% from Life Tap alone**, and that is the standing rule's
origin story: our capture said 424 and `foreverchanges.pro` said 840, **both at
build 1.60.1.70009.** Refreshing a capture does not settle a disagreement between
two reads of the same build. The owner's rule — **where our capture and
`foreverchanges.pro` disagree, foreverchanges wins** — was given for this.

**This class is one of only two cross-checked in depth against
`foreverchanges.pro`** (the Warrior is the other). Three numbers moved; **seven of
its ten matched exactly**, which is where confidence comes from.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| SM/DS | **Shadow Bolt 50.0%**, Corruption 23.0%, Bane of Agony 19.0%, Siphon Life 7.9% |
| Firelock | Incinerate 38.5%, Immolate 25.4%, Conflagrate 17.8%, Corruption 10.3%, Shadowburn 8.0% |

**CORRUPTION FELL FROM 13.5% TO 10.3% OF FIRELOCK**, which is the containment
check for the Ruin and Agonizing Flames corrections: it is the one Affliction
spell in a Destruction build, and it is exactly the source those two talents
should never have reached. **Shadow Bolt is still half of SM/DS.** No auto attack
in either — a `caster` style has none.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 52 | 24 | 3 | **5** | **20** |

Previously 21 / 3 / 3 / **25**.

**Three ruled out is still the LOWEST in the project** — this class's trees are
almost all damage and pets, with very little healing, positioning, threat or crowd
control to rule out. That is why the gap column looks large even now: nothing is
absorbed by the scope rulings.

### What left the gap column

| Talent | How | Worth |
| --- | --- | --- |
| `pandemic` | `abilityCritDamage`, a fourth modifier scope | **+14.8 DPS to SM/DS** |
| `improved_drains` | Wrack is declared, which its own reason already SAID | zero |
| `soul_siphon` | the same, through `abilityBonus` read in Wrack's `onCast` | zero |

**TWO OF THE THREE ARE WORTH EXACTLY ZERO AND ARE WORKING**, because the only
ability they reach is Wrack and no list casts Wrack. Their tests assert the
resolved multiplier and the per-cast count, not a DPS delta. **A talent working
and a talent mattering are different questions.**

`ruin` and `agonizing_flames` were already counted as fully modelled while being
WRONG, so the correction does not move the census — which is worth noticing about
the census: it counts whether a talent is EXPRESSED and not whether it is right.

### Two reasons were expired and one was wrong

- **`improved_drains` and `soul_siphon` both said "Wrack is declared"** and
  neither had been acted on. That sentence was written the day Wrack landed.
  **The fifth time in this project an expired reason has been caught by
  re-reading it, and the first where the reason contained its own fix.**
- **`decimation` blamed the TARGET and should not have.** Its reason said every
  clause needs the target below 35% health, "which never happens against a target
  that survives by design" — and 35% is the CLOCK by the owner's ruling,
  `combat/executePhase.ts`, the exact fraction the Rogue's Quietus runs on.
  **This is the fourth time that mistake has been made here.** What actually
  blocks it is Soul Fire, which three of its four clauses are about; its fourth
  clause is the same clock-conditional per-ability modifier Quietus and Early
  Demise want, so **decimation is the THIRD caller for that one mechanism.**

### The five remaining engine gaps, and only one is ours alone

| Talent | What it needs | Whose |
| --- | --- | --- |
| `amplify_curse` | a one-shot per-ability **damage** modifier. `CastModifier` carries cast time and cost; two other classes want a one-shot **crit**. Neither profile takes it, so building it moves nothing | code |
| `decimation` | Soul Fire declared, plus the clock-conditional modifier above | code + the spell list |
| `demonic_aegis` | Demon Skin and Demon Armor declared **and** something attacking a Warlock. **Two independent reasons**, so clearing one moves nothing | the spell list + the encounter |
| `soul_harvesting` | a KILL, which the target survives by design | the encounter |
| `bane_of_havoc` | a second target. Correctly **zero** rather than inert | the encounter |

---

## Never-fired entries

**None.** Both Warlock lists have every entry firing, confirmed with `USES=1`:

| SM/DS | uses | | Firelock | uses |
| --- | --- | --- | --- | --- |
| bane_of_agony | 3.0 | | immolate | 4.5 |
| corruption | 4.0 | | conflagrate | 6.0 |
| siphon_life | 2.0 | | shadowburn | 4.0 |
| life_tap | 3.7 | | corruption | 3.0 |
| shadow_bolt | 14.5 | | life_tap | 5.0 |
| | | | incinerate | 13.3 |

## In the book, in no list, never cast

`immolate`, `searing_pain`, `wrack` for SM/DS; `shadow_bolt`, `bane_of_agony`,
`searing_pain` for Firelock — **mostly the two lists dividing the same book, which
is correct.**

**WRACK IS COMPLETE NOW AND STILL IN NO LIST, AND THAT IS THE OWNER'S CALL.** Both
halves are built:

- **14.3% of spell power per tick**, six ticks one second apart, supplied by the
  owner directly because `WoWSimWorksheet.xlsx` has no Wrack row — **the only row
  in `coefficients.ts` that is not from the sheet**, with its provenance recorded
  beside the constant because a sheet refresh will not carry it.
- **+10% to your other Shadow damage-over-time effects**, through
  `periodicDamageTakenBySchool`. Its `unmodelled` reason had named that field: a
  plain Shadow vulnerability would also raise Shadow Bolt at half the profile's
  damage, which is a bigger number wearing the right label rather than an
  approximation.

**"OTHER" FALLS OUT RATHER THAN BEING SPECIAL-CASED.** Wrack is a CHANNEL, so its
six ticks are CAST ticks and carry no `periodic` flag — only a real
damage-over-time tick does. So the debuff cannot amplify the ability that applied
it, and the test asserts exactly that: a Corruption tick inside the window is 10%
larger and a Shadow Bolt cast inside it is unchanged.

**WHAT IT IS WORTH IS NOW GENUINELY OPEN.** Arithmetic used to settle it: six
ticks at 14.3% is 0.858, which is Shadow Bolt's 0.857 in twice the time. Against
that now sits 10% of the profile's periodic damage — half of SM/DS is Shadow Bolt
and the other half is periodic — for the six seconds the channel occupies.
**Thirty batches of ten is what answers it, and one line in `WARLOCK_AFFLICTION`
runs the test.** The owner's words stand: *"it's unimportant for the rest of the
simulator for now, there isn't a profile that uses it."*

---

## Traps specific to this class

- **"YOUR DESTRUCTION SPELLS" IS A TREE, NOT A SCHOOL, AND SHADOW BOLT IS IN IT.**
  Two talents got this wrong for the whole project, and the wrong reading is the
  tempting one: a Warlock's only two schools ARE Fire and Shadow.
  `WARLOCK_DESTRUCTION_SPELLS` reads the spellbook capture's own `tab`. Four
  spells in that tab are declared nowhere — Soul Fire, Rain of Fire, Hellfire,
  Bane of Havoc — and that is the SPELL list's business rather than either
  talent's, by the standard Twin Disciplines set on the Priest.
- **A PER-SCHOOL EFFECT THAT COMES AND GOES BELONGS ON THE AURA.**
  `SchoolModifiers` is built once when the character is. `damageDoneBySchool` on
  `AuraDefinition` is the field, and Demonic Sacrifice and Shadow and Flame both
  needed it.
- **A CLAUSE THAT CANNOT BE EXPRESSED PER SCHOOL IS NOT AUTOMATICALLY WORTH
  APPLYING WHOLE-CHARACTER.** Both auras above did, with a caveat, and both
  caveats were correct and understated. "Generous for a hybrid" turned out to be
  42 DPS.
- **WHERE TWO SOURCES DISAGREE, `foreverchanges.pro` WINS** — the owner's standing
  rule, given when it settled Life Tap at 840 against our capture's 424. It
  outranks the older instruction to prefer the newer read or to ask, and **it
  applies to every class**, because eight of the nine have no owner spreadsheet.
- **THE RULE DOES NOT APPLY WHEN THE PREFERRED SOURCE IS SILENT RATHER THAN
  DIFFERENT.** `foreverchanges.pro` carries **no reagent field for any spell**, so
  its 365-mana cost for Shadowburn does not contradict the Soul Shard the other
  source states — it cannot express one. **Both are charged.**
- **`PLACEHOLDER_SOUL_SHARDS` is 10** — what a Warlock banks before a pull. There
  is no in-fight shard income modelled.
- **Immolate is the hybrid to know:** `IMMOLATE_SP_COEFFICIENT` 0.2 for the hit and
  `IMMOLATE_TICK_SP_COEFFICIENT` 0.13 per tick, both the owner's own rows.
- **`aftermath` raises Immolate INITIAL damage only**, and the initial hit and its
  burn share one ability id — which is why that talent is partly modelled. **The
  same shared id is what makes Pandemic and Ruin expressible at all**, because a
  periodic tick carries its aura's id and `rollPeriodicCrit` applies the same
  modifier a cast gets.
- **Bane of Agony ticks FLAT**, an interpretation: **did Forever keep Classic's
  50/100/150 bands?** It is **19.0%** of SM/DS's damage, so the answer matters.
  The 24-second TOTAL is the source's own and is exact; only its distribution
  inside the duration is flattened.
- **A temporary summon is modelled without a combatant** on the owner's call — the
  Infernal is the mid-fight-summon gap, shared with the Mage's elemental and the
  Shaman's totems. **Nothing in any profile needs it.**
- **`fel_vitality`'s mana bonus is applied through INTELLECT** rather than to the
  pool directly, because a percentage of a pool computed once would freeze at the
  unbuffed figure.

---

## What "done" looks like

Four of the six items this brief opened with are done, and two of the remaining
four are questions rather than code.

1. **Bane of Agony's ramp asked for.** 19% of SM/DS's damage ticks flat on an
   interpretation.
2. **Wrack measured with its amplification live**, which is now a real question
   rather than arithmetic, and one line away. **The owner has said it is out, so
   this is a measurement to report and not a change to make** — the owner's list
   outranks a measured decision of ours, and the measurement stays either way.
3. **`amplify_curse`'s one-shot damage modifier** — cheapest of the code items,
   since no profile takes it and it therefore moves no baseline. Worth building
   alongside the one-shot CRIT modifier two other classes want.
4. **Soul Fire declared**, which is the only thing standing between `decimation`
   and the clock mechanism Quietus and Early Demise also want.

~~The thirteen demon talents written up as ONE build cause.~~ Done — and four more
turned out to be the encounter, which the reasons now say in those words.

~~`pandemic` reached via `critMultiplierBonus`, together with the Rogue's
Lethality.~~ Done. One declaration, `abilityCritDamage`, two classes, and the
Rogue side is +2.6 to +3.2 across its three profiles — inside every interval.

~~A periodic-only school vulnerability decided.~~ Done —
`periodicDamageTakenBySchool`, and Wrack's own reason had named the field.

~~`improved_drains` and `soul_siphon` reasons re-read.~~ Done. Both were expired
and both said so in their own words.
