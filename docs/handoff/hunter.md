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

**THE DEEP DIVE IS DONE AND THE OWNER ANSWERED EVERYTHING IT ASKED.** Live gaps
went **13 → 8**, and the three rulings behind that were each larger than the
question that prompted them — see **What the owner ruled** below. Of the eight
left, six are the encounter or the build, one is a consequence of a ruling, and
**one is a genuine named engine gap that no Hunter profile takes.**

---

## The profiles

| Profile | Talents | DPS | List | Notes |
| --- | --- | --- | --- | --- |
| BM Hunter | 31/20/0 | **547.0** | `HUNTER_BEAST_MASTERY` | **the only profile with a pet** |
| LW Melee | 7/13/31 | **495.4** | `HUNTER_LONE_WOLF_MELEE` | **dual wield**, since 2026-10-03 |
| LW Ranged | 7/39/5 | **311.7** | `HUNTER_LONE_WOLF_RANGED` | |

**BM HUNTER HAS HELD THREE DIFFERENT FIGURES IN TWO DAYS, AND THE SEQUENCE IS
THE POINT RATHER THAN ANY ONE OF THEM.** 405.8, then 731.8, then 595.1, then
646.6, then **547.0** — and
**the first two were both measured against an invented pet base damage**, 50 for
the life of the project and 150 for a day. 595.1 is the first that was not. (The
figures below were taken before `#149` raised the preset raid buffs from twelve
to seventeen, which moved every profile; the deltas are still what each change
was worth.)

**THE PET MODEL IS −193.0**, measured against current main, with the other
twenty-two profiles identical to the decimal:

| | |
| --- | --- |
| **−230.8** | the base damage, 300 a swing → 36.34–55.32, with the pet's attack power and crit left alone |
| **+37.5** | the pet's own 252 attack power and 5 crit, which did not exist |

**AND THE HUNTER DIVE BEFORE IT WAS +326.0, ON TWO RULINGS, ALSO ISOLATED.**
It is 80 DPS clear of DW Fury's 651.2 and the owner has published it as the
baseline deliberately rather than by default.

| | |
| --- | --- |
| **+223.2** | the pet's base DPS, 50 → 150, measured with the hawk left at 32 |
| **+144.4** | the hawk, measured with the pet's base left at 50 |
| **+326.0** | both, which is less than the sum because the two overlap |

**LW MELEE WENT 321.5 → 362.7**, also isolated: **+30.4** for the Immolation Trap
entry and **+12.4** for Lacerating Strikes' bleed.

**LW RANGED DID NOT MOVE BY A DECIMAL**, which is the containment check for a
change that touched pets, hawks, traps and a melee bleed. Nor did the other
twenty profiles.

### The one measured decision that was left, and is now closed

**DROPPING SNIPER SHOT IS +12.1 AND IT IS KEPT.** 311.7 against 323.8 over 30
batches of 10 on a ±2.4 interval, so REAL; the earlier single run said +7.9 and
this replaces it. **No placement escapes the cost** — below Arcane Shot it
measures 311.7 to the decimal and still fires twice a fight, because Arcane
Shot's own six-second cooldown means it never blocks the entry beneath it.

**WHICH IS A GENERAL LESSON ABOUT LISTS:** "an unconditional entry is a floor
under everything below it" holds only for an entry with **no cooldown**. Checking
the condition is not enough; check the cooldown.

A four-second cast resets the ranged swing timer and this build's auto-shot is
49.7% of its damage on a 3.2-second cycle, so 295 damage for 365 mana does not
pay for a cycle and a quarter of bow. **Asked directly, the owner kept it**, and
12.1 is the price of that choice the way Hunter's Mark's −10.1 is on the melee
list. `petsAndHunter.test.ts` pins the invariant — the ability is cast — and
carries the figure.

**LW MELEE'S OLDER −237.1 STANDS AS A RECORD, NOT A QUESTION.** −100.6 from
Raptor Strike becoming on-next-swing, which its capture said all along, and
−136.6 from the owner's list dropping Serpent Sting, Arcane Shot and Rapid Fire
while adding Hunter's Mark. The owner's position: *"I'm fine with LW melee's
−136.6 for now. It's explainable based on the changes that were made (to make it
more accurate). We can revisit it once everything is working."*

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| BM Hunter | Ranged Auto 30.0%, **Hawk 17.9%**, Cat Melee 17.2%, Serpent Sting 13.5%, Aimed Shot 13.1%, Claw 5.6%, Bite 2.7% |
| LW Ranged | Ranged Auto 49.7%, Arcane Shot 19.6%, Aimed Shot 13.0%, Serpent Sting 11.0%, Sniper Shot 6.6% |
| LW Melee | Main Hand Auto 29.0%, **Off Hand Auto 23.5%**, Raptor Strike 16.9%, Strider Kick 11.5%, Mongoose Bite 9.2%, Immolation Trap 6.5%, Lacerating Strikes 1.9%, **Fatal Wound 1.4%** |

**"Cat Melee" USED TO READ "Main Hand Auto-Attack" AND THAT WAS A LIE THIS
DOCUMENT REPEATED.** See **The row that was about the wrong thing** below.

---

## What the owner ruled

Four questions, 2026-09-30, and three of the answers reached further than the
question did.

### Immolation Trap is in scope, and it is the only trap that is

Asked whether traps belong in a simulator with no positions — five talents and
two damaging abilities hung on it — the answer put **one** trap in and ruled away
the part the engine cannot do:

> *"Let's add Immolation Trap. Assume it triggers instantly when cast. And add it
> to the LW melee APL after strider kick. Immolation trap doesn't scale with
> attack power or spell power currently."*

245 mana, 690 Fire damage over five three-second ticks, 30-second cooldown, last
in the melee list. **Explosive Trap is NOT covered** — the owner named one trap,
so the other stays undeclared rather than inferred.

**IT IS THE ONLY DAMAGING EFFECT IN THE PROJECT THAT SCALES WITH NOTHING**, which
makes it a third standing exemption in `everySpellScales.test.ts`, with the
owner's sentence beside it. Its share of a profile therefore **falls** as the
build gears up. "Currently" is the owner's word and is the reason to expect this
one to expire.

**THAT ONE RULING MOVED THREE TALENTS**, which is why it is worth more than the
ability: Clever Traps' damage half became expressible, Resourcefulness' "your
Trap abilities" gained a member, and Entrapment stopped being "no profile places
a trap" and became what it always was — a **root**, which is crowd control and
permanently out of scope.

### The hawk is 108, and the 32 it replaced was rank 1

> *"Assume it's 108 for initial and every other hit. Once every 2 seconds.
> Similar to a DoT effect except two of these can be active."*

**THE COMMENT ON THE CONSTANT SAID "32 IS NOT IN EITHER SOURCE" AND THAT WAS
WRONG.** It is in a source — the **talent tooltip**, whose text in
`src/data/talents/values/hunter.json` reads *"dealing 32 Physical damage"*. That
is the rank-1 trap CLAUDE.md names outright: **a talent tooltip shows rank 1 of
the ability it grants.** The spellbook capture says `"rank": 4` and 108, and
`foreverchanges.pro` says 110 — so the two "disagreeing" sources were one number
at two ranks and **there was never a disagreement to settle.**

**THIS IS THE SECOND TIME THIS CLASS HAS FALLEN INTO THAT TRAP**, after Sniper
Shot. Both times a plausible comment explained the wrong number.

### And the owner restated it again on 2026-10-02

> *"Summon Hawk does 108 physical damage + Hunter's Ranged Attack Power \* 0.05
> instantly. And then the same damage again every 3 seconds for 18 seconds.
> Totalling 7 hits."*
> *"...there is a hawk_1 and hawk_2, so that casting one doesn't overwrite the
> other."*

**+51.4 TO BM HUNTER**, and the hawk became the profile's largest single source
at 30.3%:

| | |
| --- | --- |
| **+84.0** | the 5% ranged attack power coefficient, measured by zeroing it |
| **−32.5** | the shape, together: ten hits at two seconds became seven at three, offset by each hawk getting its own clock |

### And a third time, hours later

> *"it's 108 + 5% ranged attack power (RAP) on the initial hit BUT (108 + 5% RAP)
> / 4 every 2 seconds — instead of (108 + 5% RAP) every 3 seconds."*

**−99.6 TO BM HUNTER**, 646.6 → **547.0**. The cadence returns to two seconds and
every strike after the dive is a **quarter** of it, so the whole hawk is **3.25
openers against the previous 7** — 46%, and the profile fell 15.4% with it. The
hawk drops from the largest single source to **17.9%**, behind auto-shot and
level with the pet's swings.

**THE OPENER AND THE ASSAULT ARE DIFFERENT NUMBERS NOW**, which is the design
change rather than the arithmetic one. The previous revision's whole shape was
"one formula used twice" — the ability and the aura called the same function.
`hawkTickDamage` is derived from `hawkStrikeDamage` rather than written out,
because a quarter of a changing number must not become a second transcription of
it.

**AND THE HIT COUNT IS DERIVED THIS TIME, NOT STATED.** The previous revision
came with "totalling 7 hits" and this project leaned on it as a cross-check on
the cadence and duration. This one states no count, so the ten is arithmetic —
`HAWK_TOTAL_AS_MULTIPLE_OF_OPENER` is the named cross-check instead, and the
tests assert the total is **not** `opener × 10`, which is the mistake the new
shape invites. **A cross-check and a source are not the same thing, and the
comments say which each is.**

**IT CLOSED A CAVEAT RATHER THAN A PLACEHOLDER.** `HAWK_UNMODELLED` said in
writing that the two hawks "share one 18-second clock: summoning the second
resets the first, so both expire together", and called it "a fraction of a hawk
either way". A stacked aura has ONE duration and ONE tick chain, which is what
forced that; `hawk_1` and `hawk_2` are separate definitions now, each with its
own expiry.

**SEVEN IS THE CHECK ON THE OTHER THREE NUMBERS.** One instant hit plus 18 / 3
ticks is 7, so `HAWK_STRIKES` is asserted rather than derived — a cadence or a
duration that drifts fails a test instead of quietly changing the total. **A
redundant number in a spec is worth keeping for exactly this.**

**THE GATE MOVED FROM THE ABILITY TO THE LIST.** A third cast is legal and
overwrites the oldest, so the ability permits it and the list carries
`summoned_hawks < 2`. **An ability says what is LEGAL, a list says what is
WISE** — the previous version had the ability refusing its own third cast, which
is the ability deciding something the list should decide.

**AND IT NEARLY BROKE TWO TALENTS IN SILENCE.** Unleashed Fury declares
`abilityDamage` and Ferocity `abilityCrit` against the id `summon_hawk`, and both
reached the old hawk **only because the AURA was called `summon_hawk`** — a
periodic tick carries its aura's id. With the auras renamed, keeping `aura.id`
would have stopped both applying to a quarter of this build's damage, with
nothing erroring and the profile reading as an ordinary hawk. `abilityId` is
passed explicitly, and a test asserts every hawk damage event carries it **and**
that both talents still name it.

### The pet model, supplied in full on 2026-10-01

The 150 of the day before was a placeholder too, and this replaced it entirely:

```
Base damage      random(36.34, 55.32) per swing, at a 2.0-second base swing
Base stats       136 strength, 100 agility, -20 attack power
Attack Power     -20 + Strength x 2 + 0.1 x max(HunterMeleeAP, HunterRangedAP)
Crit Chance      Agility / 20 + HunterCritChance
Damage           (random(min, max) + 2 / 14 x PetAP) x 1.375
Claw / Bite      random(43, 59) and random(81, 99), x 1.375
```

**THERE IS NO PLACEHOLDER LEFT IN THE PET MODEL.** The base was 50, then 150, and
both were invented — so **every pet figure this project ever recorded was
measured against a guess**, including the 731.8 this document published for a day.

**A PET NOW HAS 252 ATTACK POWER AND 5 CRIT OF ITS OWN.** Neither term existed:
attack power was 10% of the owner's and nothing else. The Hunter's share is about
a third of the total now, which means a pet is **less** gear-sensitive than the
old model implied, not more.

**CLAW AND BITE TAKE NO ATTACK POWER**, stated outright, and already did — they
declare no `weaponScaling`. So a geared Hunter raises the pet's SWING and leaves
its two strikes alone, and their share of its damage falls as the Hunter gears
up. Classic's scaled. This is a statement, not an omission.

**THE RANGE IS EXACTLY SYMMETRIC, WHICH IS WHY IT NEEDED NO NEW MECHANISM.** 36.34
and 55.32 are both 9.49 either side of 45.83, and `weapon.damageVariance` is
already a fraction either side of `baseDamage` — so the engine reproduces
`random(36.34, 55.32)` exactly rather than approximately. It is 20.7% against the
engine's 15% default, so dropping the field would leave the mean right and the
tails wrong.

**AND THE TWO SOURCES NEVER DISAGREED ABOUT THE UNIT.** This project recorded that
a pet's base "is a DPS, not a per-swing damage" as a FINDING. Multiply the wiki's
`((PetBaseDPS + AP / 14) x mods) x PetSwingSpeed` out and it IS the owner's line.
The unit was only ambiguous while the SWING was unknown, and the owner states it —
so the question dissolved rather than being settled. **A disagreement between two
sources can be an artefact of a third number neither of them gives.**

**THE 1.375 WAS ALREADY THERE, AND THE RISK WAS IMPLEMENTING IT TWICE.** It is
Petopia's 1.10 family modifier times the wiki's 1.25 for a fed pet, to the tenth
decimal — confirmed by the owner: *"They're the same thing."* So **1.375 appears
nowhere in the source**. The obvious way to implement a stated multiplier is to
declare it beside the two factors that already produce it, which takes a Cat to
**1.89** — a bigger number, no error, and a results page that reads as an ordinary
pet. Both factors are read in exactly one place, the pet's weapon carries no
`damageMultiplier` of its own, and `dealDamage` applies the composed figure once.
Bestial Wrath's +50% rides on top as an *aura* multiplier, correctly separate.

**THE GUARD IS END-TO-END, NOT A CONSTANT CHECK.** `petsAndHunter.test.ts` scripts
a swing — damage roll at its midpoint, attack table at a plain hit — and asserts
it against `(base + 2 / 14 × AP) × 1.375` built from the owner's own words. A
second application fails it by 37.5% rather than hiding in a mean, **and the test
was verified to fail by injecting one.**

Health and armor are unchanged and still purely inherited — 2 a stamina, 30% of
armor — with the family modifiers on top. **Happiness is the one assumption left
in the pet**: nothing tracks feeding, so it is assumed fed.

### Lacerate is not a real ability; Trueshot Aura is the raid buff

`Lacerate` is in the captured spellbook — Survival, level 60, *"new"*, 95 mana,
*"bleed for 406 damage over 21 sec"* — and the owner's answer was **"Lacerate
isn't a real ability as of now. It can be removed."** So it belongs on the spell
exclusion list and not in the book. **It is NOT the same thing as the Lacerating
Strikes talent**, which shares its 21 seconds and is built.

`Trueshot Aura` is a real rank-5 spell at **+50** ranged attack power — the
talent tooltip's +30 is rank 1 again — and the owner's answer was **"Trueshot
aura is already handled on the raid buffs GUI."** So the talent's `unmodelled`
reason stands as written, and the raid buff carries the right figure.

---

## The row that was about the wrong thing

**"Main Hand Auto-Attack" WAS 38.1% OF BM HUNTER AND NONE OF IT WAS THE
HUNTER'S.**

The damage breakdown pools by ability **name** across every friendly actor —
deliberately, so a reader sees one table rather than two — so the pet's main-hand
swing landed in the row named for the player's main hand. BM Hunter is
`combatStyle: 'ranged'`; **it never swings a melee weapon at all.** The shares
still summed to 100% and nothing on the page contradicted it.

**AND THIS DOCUMENT READ THAT ROW AND WROTE IT DOWN**: the previous version said
*"BM Hunter is the only profile that swings BOTH melee and ranged"*, which is how
a mislabelled number becomes a documented fact. It is the `resourceFlow` failure
again — internally consistent, and about the wrong thing.

A pet's swing is named after the pet now (`autoAttackName`, in the engine beside
`AUTO_ATTACK_NAMES`, because `kind` is an engine concept and naming it twice is
how two labels drift). The row reads **"Cat Melee"**.

---

## The melee Hunter dual-wields

> *"instead of a two-hander being the default weapon I want it to be dual wield.
> The main hand weapon should be: vis'kag with crusader enchant. The off hand
> weapon should be: core hound tooth with crusader enchant."*
>
> *"...pay special attention to the predator's edge talent which mitigates the
> impact of the dual wield damage penalty. it becomes a 25% penalty with rank 5
> predator's edge."*

**414.5 → 495.4, +80.9, REAL**, with the other twenty-two profiles identical to
the decimal. Three things, and only the first is the weapon swap:

| | |
| --- | --- |
| **+38.8** | **Predator's Edge's off-hand clause**, which had no off hand to raise until now |
| **+30.2** | **Deadly Aspects rolling off EITHER hand**, which its tooltip always said |
| **~+11.9** | the switch itself: two weapons, two swing timers, and Vis'kag's Fatal Wound proc |

They overlap, so the three do not sum exactly. **The off hand is 23.5% of the
profile**, and Mongoose Bite nearly doubles its casts — 3.3 a fight to 6.2 —
because Expose Prey procs off both hands.

**NEITHER ITEM IS NEW AND NEITHER LIVES IN A HUNTER FILE.** Vis'kag (17075) is in
`classic-warrior.json` and the Core Hound Tooth (228277) in `sod-rogue.json`;
`HUNTER_DUAL_WIELD_WEAPONS` references them by id, which is what the Rogue's own
sword set already does with Vis'kag. **The item database is frozen and this added
nothing to it.**

**A SWORD AND A 1.30-SECOND DAGGER**, worth noticing rather than smoothing over:
the off hand swings far more often than the main, so the speed is what decides
what the penalty and Predator's Edge are worth. No Hunter talent keys on weapon
type, so the pairing costs nothing else.

### Predator's Edge was half a talent, and the other half was never an engine gap

Its `unmodelled` reason read *"there is no off hand for the second number to
raise"* — **a claim about the PROFILE, not about the engine.** `offHandDamage`
has existed since Dual Wield Specialization needed it. The owner changed the
build and the reason expired with no engine code touched. The talent is **fully
modelled** now: the Hunter goes 27 fully to 28, partly 6 to 5.

**THE TALENT MULTIPLIES THE PENALTY RATHER THAN REPLACING IT:**

```
OFF_HAND_DAMAGE_MULTIPLIER x (1 + 50 / 100) = 0.5 x 1.5 = 0.75
```

which is the owner's stated 25% penalty. **Writing 0.75 directly would agree with
them at rank 5 and silently stop scaling at every other rank**, so the test builds
it from the two numbers that produce it and checks ranks 1, 3 and 5.
`valueIndex: 1` reads the second number in a row whose halves differ at every rank
— 6/10 through 30/50 — so an index mistake is visible here, unlike Clever Traps'
matching 30/30.

### And a proc that had been right by accident

**Deadly Aspects' melee half checked `isWeaponUseOf(attack, 'mainHand')`.** While
this Hunter held a two-hander that WAS "any melee swing" — one slot swings. Dual
wielding separated them, and **the off hand is the faster weapon**, so most of
the build's swings had stopped rolling for a proc whose tooltip says *"all melee
auto attacks"*. It reads `isWeaponUse` now.

**A test can be equivalent by accident and stop being so because the CHARACTER
changed rather than the code.** That is the "when a rule is fixed for one slot,
check its siblings" lesson arriving from the other direction, and it is worth
+30.2 — more than the weapon swap itself.

`attackTableModifiers.test.ts` asserted the off-hand caveat was still there, and
it was right to. **The assertion flips rather than being deleted**: a reason
reappearing is as much a regression as the old one failing to.

### The bow is still equipped and still does not swing

Unchanged by any of this, and asserted because *"the melee Hunter lost its bow"*
is the obvious wrong conclusion to draw. `weaponsForEquipment` skips the ranged
slot unless the style marks it `required`, while `statsForStyle` reads
`liveEquipment` — so Rhok'delar's stats count either way.

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 50 | 28 | 5 | 9 | **8** |

### The 8 live gaps, grouped by cause

**Nothing attacks a Hunter (four):** `deterrence`, `counterattack` (after a
parry), `spirit_bond`, `improved_aspect_of_the_monkey`

**No pet dies:** `improved_revive_pet`

**The encounter, not the engine:** `trueshot_aura` — a party-wide ranged attack
power aura, which for one character is the raid buff of the same name, and the
owner has confirmed that is where it lives

**A consequence of a ruling:** `survival_tactics` — "+10% chance to hit with your
Trap and Feign Death abilities", and Immolation Trap triggers on cast, rolls no
attack table and **cannot miss**. Feign Death is not a damage ability. The reason
CHANGED rather than expiring when the trap arrived, which is worth noticing: a
ruling can close one gap and reshape another

**A named engine gap, and the only one:**

| Talent | What it needs |
| --- | --- |
| `survivalist_s_discipline` | a **percentage** cooldown reduction. `abilityCooldown` subtracts a flat amount in seconds or minutes and has no fractional form — the same shape `grantCastModifier` was built for on the COST side. **It is the only talent in the project asking for it and no Hunter profile takes it**, so building the capability would move nothing |

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `improved_stings` | Serpent Sting damage applies; Viper and Scorpid reach neither. Viper drains the TARGET's mana and Scorpid reduces its hit — neither is damage and neither is declared |
| `rapid_killing` | **its Rapid Fire cooldown reduction applies now**; its damage half needs a kill |
| `improved_tracking` | **applied as a flat damage bonus, which ASSUMES the Hunter is tracking the right creature type** — an interpretation still unratified, and the one item on the old "done" list the owner was not asked about |
| `clever_traps` | its Immolation Trap damage applies; Freezing and Frost durations are crowd control and Explosive Trap is not declared |
| `surefooted` | the hit applies; movement or control does not |

---

## Never-fired entries

**None.** All three Hunter lists have every entry firing, the new Immolation Trap
entry included at 2.0 uses a fight — confirmed by a `USES=1` pass, which is the
only thing that confirms it.

## In the book, in no list, never cast

`aspect_of_the_beast`, `aspect_of_the_hawk`, `arcane_shot`, `aimed_shot`,
`multi_shot`, `raptor_strike`, `mongoose_bite`, `serpent_sting`, `rapid_fire`,
`immolation_trap` — varying by profile, and mostly correct: the melee list does
not shoot and the ranged lists do not strike.

**`immolation_trap` IS IN ALL THREE BOOKS AND ONE LIST**, because it is a trainer
spell every Hunter learns rather than a talent grant. In the two ranged books and
in neither ranged list is the correct state.

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
  it left entirely unchanged.** `arcane_shot` and `serpent_sting` are two of the
  three standing exemptions in `everySpellScales.test.ts`, and both are RULES not
  gaps. **The third is `immolation_trap` and it is a ruling.**
- **THE RANK-1 TRAP HAS CAUGHT THIS CLASS TWICE.** Sniper Shot read 160 against a
  capture saying 295, and the hawk read 32 against a capture saying 108 — both
  times the number came from a tooltip showing rank 1 of the ability a talent
  grants, and both times a confident comment explained the wrong one. **Read the
  capture's `rank` field.** The hawk's version was worse, because the comment
  asserted the figure was in *no* source while it sat in the values file.
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
- **AN UNGATED ENTRY IS ONLY A FLOOR IF IT HAS NO COOLDOWN.** Sniper Shot below
  Arcane Shot still fires twice a fight, because Arcane Shot's own six-second
  cooldown lets the list fall past it. Measured, not reasoned.
- **A STAT PROBE IS NOT AN ABILITY PROBE.** Injecting Hunter's Mark's 71 ranged
  attack power said +1.9 to the melee Hunter; casting the ABILITY — which also spends
  60 mana and a GCD at the pull — measured **−10.1**. Measure the CAST.
- **A PET'S DAMAGE IS REPORTED UNDER ITS OWN NAME NOW**, and the reason that
  matters is above. **Reporting reads every friendly actor** — damage and buff
  uptime both, or a working pet talent looks exactly like an inert one.
- **Pet stats come from the owner**: 2 health a stamina, 30% of armor, **10% of the
  HIGHEST attack power source, 100% of crit** — far more gear-sensitive than a
  Classic pet. **A pet receives no raid buffs**, a Forever rule; `kind === 'player'`
  is the test, not `isPlayerControlled`, which counts a pet.
- **A pet's base is a DPS, not a per-swing damage**, which makes its swing speed
  damage-neutral — and a placeholder in the wrong UNIT is worse than one with the
  wrong value.
- **`bringsPet` answers "will there be a pet" ONCE**, for both whether the encounter
  BUILDS one and whether a pet-gated talent APPLIES. `requires: {}` on "while your
  pet is active" once paid both no-pet builds — **a condition nobody declared is not
  an omission, it is a bonus being paid.**
- **THE OWNER'S LIST OUTRANKS A MEASURED DECISION OF OURS, AND THE MEASUREMENT
  STAYS.** Twice in this class now: Hunter's Mark at −10.1 on the melee list, and
  Sniper Shot at −12.1 on the ranged one. Both tests assert the INVARIANT — the
  ability is cast — and keep the figure in the comment.
- **A REASON THAT DESCRIBES A WORKING HALF IS A CLAIM ABOUT THE CODE.** Rapid
  Killing's read *"Its Rapid Fire cooldown reduction is real"* and its effect list
  was **empty**. It was false the day it was written and invisible for as long as
  it stood, because five minutes and three minutes are both longer than a fight.

---

## Explosive Trap: declared, and in no list on purpose

**EXPLOSIVE TRAP IS DECLARED AND IN NO LIST, AND THE REASON IS MEASURED.** The
owner named it after Immolation Trap -- "there isn't an AP or SP scaler, all the
information should be known already" -- so it takes the same two rulings: it
triggers instantly when cast, and neither pool scales it.

| | Cost | Damage |
| --- | --- | --- |
| Immolation Trap | **245** mana | 690 over 15s |
| Explosive Trap | **520** mana | 236 on the cast + 330 over 20s = **566** |

Swapped into the Lone Wolf melee list in place of Immolation -- a swap and not an
addition, because **only one Fire trap can be active at a time** and the two have
separate cooldowns -- it measured **353.3 against 362.7** over 30 batches of 10.
More than twice the cost for less damage, because what the extra buys is "to all
within 10 yards" and there is one target.

**IT IS THE CLEAREST CASE IN THE PROJECT OF A CORRECTLY IMPLEMENTED ABILITY WORTH
CASTING NEVER.** Both halves are right, both are tested, and one line re-measures
it the day the encounter grows a second target.

## What "done" looks like

All six items from the previous version are closed.

1. ~~LW Ranged re-measured with Sniper Shot dropped~~ — **done, +12.1 REAL, and
   the owner kept the ability.** No placement avoids the cost.
2. ~~The hawk's damage asked for~~ — **108, and the 32 was rank 1.**
3. ~~One pet base DPS asked for~~ — **150.**
4. ~~`lacerating_strikes` re-read~~ — **built, +12.4 to LW Melee.** Its reason had
   argued itself out of being built on a premise that was never measured.
5. **`improved_tracking`'s assumption is STILL unratified** — it is applied as a
   flat damage bonus on the assumption the Hunter is tracking the creature type it
   is fighting. True of any real pull, not something the engine checks, and the one
   question from the old list that has not been put to the owner.
6. ~~`rapid_killing`'s reason split~~ — **and the "working" half turned out not to
   be working at all.** Now declared.

### What is left for this class

- **`improved_tracking`'s interpretation**, above. One sentence from the owner.
- **A percentage cooldown reduction**, for `survivalist_s_discipline`. No profile
  takes it, so it moves nothing — build it when a second talent wants it.
- **Talent VALUES have never been cross-checked** for any class. The Hunter's
  ability numbers are cross-checked against `foreverchanges.pro`; the rank values
  in `src/data/talents/values/hunter.json` come from `talentsforever.com` alone.
  Lacerating Strikes' 40%, Resourcefulness' 60% and Clever Traps' 30% are all
  single-source and all now load-bearing.
- **Explosive Trap**, if the owner ever extends the Immolation ruling to it. 208–264
  plus 330 over 20 seconds, and Clever Traps names it.
