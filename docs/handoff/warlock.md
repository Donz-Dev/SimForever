# WARLOCK DEEP DIVE

**Class:** Warlock
**Profiles:** SM/DS, Firelock

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**SEVEN RULINGS FROM THE OWNER LANDED AT ONCE AND SM/DS GAINED 34.9 ON THEM.**
441.5 to **476.5, REAL**, Firelock −0.4, and the other twenty-two profiles
identical to the decimal. Each isolated by reverting it alone over thirty
batches of ten:

| | |
| --- | --- |
| **+23.6** | **Bane of Agony's coefficient is 160% of spell power across the whole effect** — the owner's worked example is `552 + 500 * 1.6 = 1352`, and the twelve ticks reproduce it exactly. It replaces the sheet's 13.3% a tick, which was 1.064 in total |
| **+18.6** | **Amplify Curse**, one point moved out of Suppression, cast once before the first Bane. **Off the global cooldown**, which is what makes it free rather than merely cheap |
| **+6.6** | **Wrack counts as periodic damage for Malediction**, by ruling — a question the data could not answer, because a channel's ticks are CAST ticks and carry no `periodic` flag |
| **+1.7** | **a Nightfall proc is spent by the NEXT action.** Inside the interval on DPS, and the behaviour is not in doubt: Shadow Trance uptime falls 0.082 → 0.049 |
| **+0.4** | **Curse of the Elements counts for Soul Siphon.** Noise, and correctly so — see below |
| **−4.3** | **Siphon Life cannot crit**, the only DoT here that cannot |
| **−7.6** | **the RAMP**, against a flat distribution of the same total |

**THE RAMP COSTS DPS AND IS RIGHT ANYWAY.** Back-loading throws away the big
late ticks every time the Bane is re-applied, so a flat distribution of the same
total measures 7.6 higher. It is the owner's data; the figure is the price of
accuracy, not an argument.

**AND IT IS CLASSIC'S SHAPE AT A DIFFERENT RESOLUTION**, which the old caveat
guessed and had no authority to assert: 1/24 : 1/12 : 1/8 is 1 : 2 : 3, and the
flat share over twelve ticks is 1/12 — so the bands are 50%, 100% and 150% of the
average, exactly as Classic's are. **The guess was right and is now sourced**,
which is the happier version of an expired caveat.

### Two of the seven measure as noise, and both for good reasons

- **Curse of the Elements, +0.4.** The three bleeds already reach Soul Siphon's
  36% cap, so a fourth counted effect is redundant *while all three are up*. The
  ruling is implemented and becomes load-bearing the moment one drops.
- **The Nightfall entry, +1.7**, inside a ±2.6 interval. The bottom Shadow Bolt
  was already spending the proc reasonably promptly; what the gated entry buys is
  spending it *sooner*, and the uptime figure is the witness rather than the DPS.
  **The owner asked for the behaviour, not for a number**, and it is in.

### The answer to "is Siphon Life worth casting": yes, +13.6 — and the first answer was wrong

**476.5 with its entry, 462.9 without.** So it earns its global cooldown even
having lost its crits.

**THE FIRST MEASUREMENT SAID −24.1 AND WAS MEASURING TWO THINGS.**
`WARLOCK_AFFLICTION` gates Wrack on **all three bleeds** having six seconds left,
and one of the three is Siphon Life — so removing Siphon Life's entry took **Wrack
from 5.7 casts a fight to ZERO**, because an aura nothing applies can never have
six seconds left. The honest figure repairs the gate first.

**THAT IS THE SELF-DISABLING SPECIFICATION FOR THE THIRD TIME IN THIS PROJECT**,
after the Seal Twist cycle with no entry point and "Scorch if scorch debuff <= 5"
being always true — and the first time it disabled a DIFFERENT entry from the one
being changed. **Anyone removing Siphon Life must repair Wrack's gate too**, and
the comment on that entry says so.

---

## The previous deep dive, for context

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
| Firelock | 5/11/35 | **544.3** | 544.7, −0.4 noise (Corruption out) | `WARLOCK_DESTRUCTION` |
| SM/DS | 40/11/0 | **476.5** | 441.5, **+34.9 REAL** (the seven rulings) | `WARLOCK_AFFLICTION` |

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
| SM/DS | **Wrack 26.6%**, Bane of Agony 24.4%, Shadow Bolt 21.5%, Corruption 21.3%, Siphon Life 6.2% |
| Firelock | **Incinerate 48.1%**, Immolate 26.1%, Conflagrate 18.6%, Shadowburn 7.3% |

**CORRUPTION FELL FROM 13.5% TO 10.3% OF FIRELOCK**, which is the containment
check for the Ruin and Agonizing Flames corrections: it is the one Affliction
spell in a Destruction build, and it is exactly the source those two talents
should never have reached. **Shadow Bolt is still half of SM/DS.** No auto attack
in either — a `caster` style has none.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 52 | **25** | 3 | **5** | **19** |

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
ability they reach is Wrack, which was in no list then. Their tests assert the
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
| ~~`amplify_curse`~~ | **DECLARED, AND IT NEVER NEEDED THE MECHANISM ITS REASON ASKED FOR.** The reason wanted "a one-shot per-ability DAMAGE modifier" and was wrong about the shape: the 50% applies to ticks landing over 24 seconds, and a `CastModifier` is spent AT the cast. The amplification travels with the AURA instead — two definitions sharing one id, chosen at application — so this was one `grantAbility` away all along. **+18.6** | — |
| `decimation` | Soul Fire declared, plus the clock-conditional modifier above | code + the spell list |
| `demonic_aegis` | Demon Skin and Demon Armor declared **and** something attacking a Warlock. **Two independent reasons**, so clearing one moves nothing | the spell list + the encounter |
| `soul_harvesting` | a KILL, which the target survives by design | the encounter |
| `bane_of_havoc` | a second target. Correctly **zero** rather than inert | the encounter |

---

## Never-fired entries

**ONE, AND WRACK CAUSED IT: SM/DS's LIFE TAP.** Confirmed with `USES=1`:

| SM/DS | uses | | Firelock | uses |
| --- | --- | --- | --- | --- |
| amplify_curse | 1.0 | | immolate | 4.3 |
| shadow_bolt (proc-gated) | 7.3 | | conflagrate | 6.0 |
| bane_of_agony | 3.0 | | shadowburn | 4.0 |
| corruption | 3.9 | | life_tap | 5.0 |
| siphon_life | 2.0 | | incinerate | 16.4 |
| **life_tap** | **0.0** | | | |
| wrack | 5.0 | | | |
| shadow_bolt (filler) | 7.3 | | | |

**AMPLIFY CURSE FIRES EXACTLY ONCE**, which is the three-minute cooldown doing
the work a condition would otherwise have to — and the two Shadow Bolt rows are
one pooled figure, because the id is in the list twice on purpose.

**WRACK IS 200 MANA AGAINST SHADOW BOLT'S 380, AND IT DISPLACED NINE SHADOW BOLT
CASTS.** So the profile now gains 8,236 mana and spends 6,034, and
`manaBelowFraction(0.15)` is never true. That is the fifth cause of a never-fired
entry — **the condition reads a state the fight no longer enters** — and it is not
a broken declaration.

**THE ENTRY STAYS, AND IT COSTS NOTHING TO LEAVE IT.** It is the ruleset owner's,
and the owner's list outranks a measured decision of ours. Removing it measures
**441.6 against 441.5** — identical to the decimal, because a condition that is
never true costs no global cooldown. So this is recorded rather than fixed, and a
profile that spent more mana would reach it immediately.

**ITS TEST HAD TO CHANGE, AND HAD BEEN WRONG ONCE BEFORE FOR THE SAME REASON.**
`warlockAbilities.test.ts` asserted a Life Tap CAST COUNT; it wanted "more than
three", was loosened to "more than one" when the preset raid buffs gained
Blessing of Wisdom and Mana Spring Totem, and is now zero. A cast count is a
ROTATION outcome and this one has been invalidated by a raid-buff change and a
list change in turn, so the subject is the MECHANISM now — health for mana, one
for one — which neither can move.

## In the book, in no list, never cast

`immolate`, `searing_pain` for SM/DS; `shadow_bolt`, `bane_of_agony`,
`searing_pain` for Firelock — **the two lists dividing the same book, which is
correct.** Wrack has left this list.

**WRACK IS IN THE SM/DS LIST, AT THE OWNER'S POSITION AND ON THE OWNER'S
CONDITION:** between Life Tap and Shadow Bolt, gated on all three bleeds having
six seconds left. The list's own comment had carried that specification for the
whole time the entry was absent. Both halves of the ability were already built:

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

**WHAT IT IS WORTH IS ANSWERED: +5.6 DPS, REAL, AND IT RESHAPES THE PROFILE OUT
OF ALL PROPORTION TO THAT.** 435.9 to 441.5 over thirty batches of ten, and in
exchange Shadow Bolt falls from 14.8 casts a fight to 5.6 and from 51.1% of the
damage to 20.2%, while Wrack takes 30.3%. **A list can change completely and be
worth almost nothing** — the third time this project has measured that, and the
uses column is the only thing that says the list changed at all.

**THE ARITHMETIC THAT SAID IT COULD NOT BE WORTH CASTING WAS NEARLY RIGHT**, which
is the interesting part. Six ticks at 14.3% is 0.858 against Shadow Bolt's 0.857
in half the time, so per second the direct damage is roughly a wash; what pays for
it is the amplification on the three bleeds plus the 180 mana saved per cast. The
margin is thin and REAL.

**AND ONE BATCH OF TEN READ +12.9, MORE THAN TWICE THE TRUTH.** The full method is
what separated a 1.3% gain from a 3% one here.

**THE SIX-SECOND GATE IS WHAT MAKES IT CASTABLE AT ALL.** A channel locks the
caster for its whole duration, so committing to one while a bleed is about to drop
trades that bleed's remaining ticks for Wrack's. `allLastingAtLeast` reads
`WRACK_CHANNEL_MS` rather than a literal six seconds, so a channel that changes
length takes its own gate with it.

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
- ~~**Bane of Agony ticks FLAT**~~ **ANSWERED, AND THE GUESS WAS RIGHT.** The
  owner has quantified the ramp — three bands of four ticks at 1/24th, 1/12th and
  1/8th of the total, twelve ticks two seconds apart — which is 50/100/150% of
  the average and therefore Classic's shape after all. It is **24.4%** of SM/DS's
  damage now, up from 19.0%, because the coefficient went 1.064 to 1.6.
- **A RAMPED DoT READS ITS TICK NUMBER OFF `appliedAt`, NOT OFF A COUNTER**, so a
  refresh restarts the ramp — which is what `refreshBehaviour: 'reset'` means
  everywhere else. A counter on the instance would need resetting by hand in the
  one place that is easy to forget.
- **WRACK'S GATE NAMES SIPHON LIFE.** Removing Siphon Life from the list takes
  Wrack with it, silently, and it cost a wrong measurement before it was caught.
- **A temporary summon is modelled without a combatant** on the owner's call — the
  Infernal is the mid-fight-summon gap, shared with the Mage's elemental and the
  Shaman's totems. **Nothing in any profile needs it.**
- **`fel_vitality`'s mana bonus is applied through INTELLECT** rather than to the
  pool directly, because a percentage of a pool computed once would freeze at the
  unbuffed figure.

---

## What "done" looks like

Five of the six items this brief opened with are done, and two of the remaining
four are questions rather than code.

1. ~~**Bane of Agony's ramp asked for.**~~ **ANSWERED** — three bands, twelve
   ticks, and a 160% coefficient that supersedes the sheet. Worth +23.6 on the
   coefficient and −7.6 on the ramp itself.
2. **SM/DS's Life Tap entry is unreachable** and the owner may want the 15%
   threshold re-tuned, or may not — it costs nothing to leave, and a profile that
   spent more mana would reach it. Recorded, not fixed.
3. ~~**`amplify_curse`'s one-shot damage modifier**~~ **DONE, and it needed no
   such modifier** — see the census table above. The one-shot CRIT modifier two
   other classes want is still genuinely missing; this talent is no longer a
   caller for its damage twin.
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
and both said so in their own words. **And both are now LIVE rather than merely
correct**, because the only ability they reach is Wrack and Wrack is in the list —
without one assertion in their tests changing, which is what asserting the
mechanism instead of a DPS delta buys.

~~Wrack measured with its amplification live.~~ Done, and the owner has put it in
the list: **+5.6 REAL**, with Shadow Bolt dropping from 51.1% of the profile to
20.2%.
