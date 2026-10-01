# SHAMAN DEEP DIVE

**Class:** Shaman
**Profiles:** Ele Shaman, Enh Shaman

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**THE DEEP DIVE IS DONE, AND WHAT IT FOUND WAS NOT A MISSING ENGINE.** The
previous version of this document opened with "TOTEMS ARE NOT ENTITIES, AND THAT
IS SIX OF THE SEVENTEEN LIVE GAPS", pointed at the mid-fight-summoning gap shared
with the Warlock and the Mage, and said it landed "hardest here". Every part of
that framing was wrong in a way worth keeping on the record:

| The claim | What was true |
| --- | --- |
| six talents blocked on totems-as-entities | **four.** Improved Fire Nova needed a COEFFICIENT, and Totemic Focus is a percentage mana cost on a totem SPELL -- `grantCastModifier`, no entity involved |
| "it lands on an Elemental profile whose figure is short by whatever they are worth" | **neither profile spends a point on any of the four.** Both are 0 in Restoration, and neither takes Earth's Grasp or Guardian Totems. The totem gap was worth exactly nothing to either build |
| the engine change was the blocker | **the owner answering four questions was.** Three numbers and three rulings, none of them requiring an engine change |

**ELEVEN OF THE SEVENTEEN LIVE GAPS WERE UNSPENT POINTS IN BOTH BUILDS.** That is
the reframing worth carrying to the other eight classes: a census counts all 50
talents and a profile spends 51 points on about eighteen of them, so the live-gap
column never said how much of a BUILD was inert. Six of the Shaman's seventeen
were in a build; one is left, and it works.

---

## The profiles

| Profile | Talents | DPS | was | List | Entries |
| --- | --- | --- | --- | --- | --- |
| Enh Shaman | 19/32/0 | **462.0** ±7.3 | 451.1 | `SHAMAN_ENHANCEMENT` | 8 |
| Ele Shaman | 38/13/0 | **375.0** ±3.8 | 295.4 | `SHAMAN_ELEMENTAL` | 4 |

**ELE SHAMAN +79.6, REAL. ENH SHAMAN +10.9, AND THAT ONE IS A LIE BY NET.** The
Enhancement figure is inside its interval and hides four separate real changes
that happen to offset — see the decomposition below, which is the only honest way
to report it.

**ELE SHAMAN STOPS BEING THE MOST UNDER-SERVED PROFILE IN THE PROJECT.** It was
second-lowest of 23; it is now fifth-lowest, above SM/DS and both Hunters, a
decimal under Bear. The mean across 23 moved 411.7 to **415.6** and the twenty-one
non-Shaman profiles are identical to the decimal.

### What each change was worth, measured one at a time

Each row is that change REMOVED from the finished build, so the figure is what it
contributes in the presence of the others. 30 batches of 10 per row.

| Change | Profile | Worth |
| --- | --- | --- |
| **Searing Totem in the Elemental list** | Ele | **+59.5** |
| **Fire Nova declared, and in the Enhancement list** | Enh | **+25.5** |
| **Elemental Focus** (Clearcasting) | Ele | **+12.5** |
| **Lightning Overload** | Ele | **+11.1** |
| **Maelstrom Weapon: flat 20% → 5 PPM** | Enh | **+6.6** |
| **Improved Stormstrike's mana regeneration** | Enh | **+3.4** |
| **Windfury imbue internal cooldown: 1.5s → 3s** | Enh | **−10.0** |

**THE ENHANCEMENT ROWS DO NOT ADD UP AND THAT IS THE FINDING.** −10.0 + 6.6 +
25.5 + 3.4 is +25.5 against a measured net of +10.9. The build is MANA-BOUND, so
four changes compete for one pool: removing Fire Nova's 520 mana a cast makes
everything above it more affordable, which is why its isolated value overstates
what it adds. Read the rows as "what this is worth here", never as a sum.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Ele Shaman | Lightning Bolt 48.1%, Searing Totem 18.2%, Flame Shock 16.1%, Lava Burst 15.1%, Lightning Bolt (Overload) 2.5% |
| Enh Shaman | Main Hand 56.2%, Stormstrike 12.4%, Fire Nova 10.7%, Searing Totem 8.5%, Flame Shock 5.9%, Earth Shock 4.4% |

**THE ELEMENTAL'S TABLE WENT FROM THREE SOURCES TO FIVE**, which was the narrowest
in the project and is not any more. Lightning Bolt fell from 60.5% to 48.1%
without losing any damage: the table grew around it.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 50 | 22 | 4 | 18 | **6** |
| *was* | *17* | *4* | *12* | ***17*** |

### The 6 live gaps, and not one of them is in a build except the first

| Talent | In a build? | Cause |
| --- | --- | --- |
| `elemental_weapons` | **Enh, 3/3** | **A CENSUS ARTEFACT. Its Windfury half WORKS.** See below |
| `elemental_warding` | no | the target. Nothing deals Fire, Frost or Nature damage to either Shaman |
| `improved_lightning_shield` | no | the target, and Lightning Shield is not in the book |
| `water_shield` | no | the target. **Mana return is in scope**, so this is a gap and not a ruling |
| `improved_reincarnation` | no | its **+4% maximum health** clause: `maxHealth` is computed once from a stats snapshot and no effect kind reaches the pool as a percentage |
| `nature_s_swiftness` | no | a one-shot cast-time modifier selecting by SCHOOL. **The Druid has the same gap — build it once** |

**`elemental_weapons` IS NOT A GAP AND THE CENSUS CANNOT TELL.** Its reason has
said "APPLIES" in capitals since it was written — `reactionsForClass` reads its
rank off the allocation and builds the Windfury proc with it — and the census
counts non-unmodelled EFFECT ROWS, of which this talent has none.
`appliedElsewhere` is the field for exactly this and is **not on `main` yet**: it
arrives with the Rogue's two poison talents, which fell into the same hole. When
that branch lands, **one line** in `shamanEffects.ts` takes the Shaman to 5 live
gaps and 5 partly — and `shamanAbilities.test.ts` fails until it is written,
deliberately, because a known-wrong classification that nothing enforces stays
wrong.

### Partly modelled (4)

| Talent | What is missing |
| --- | --- |
| `call_of_flame` | **Magma Totem only.** Its Fire Totem, Flame Shock, Fire Nova and Lava Burst clauses all apply |
| `elemental_fury` | **Magma Totem only.** Searing Totem and all three schools apply |
| `improved_stormstrike` | its dodge/parry cooldown reset. **Its mana clause is live** |
| `tidal_focus` | healing only, and neither profile heals |

**MAGMA TOTEM IS NOT THE TOTEM RULING AND MUST NOT BORROW IT.** It is a DAMAGE
totem, so the reading that reaches Searing Totem reaches it — what it lacks is a
spell power coefficient, the same thing Searing Totem and Fire Nova lacked until
the owner supplied 8% and 10%. It is the **one open data question left in this
class** and it is worth knowing that the answer would not get it cast: 73 every 2
seconds for 20 seconds is 36.5 a second for 650 mana against Searing Totem's 31.3
a second for 55 seconds and 170 mana, and only one fire totem stands at a time.

### Ruled out (18), including two rulings given for this class

Both are new `OutOfScope` members, given by the owner on 2026-09-30, and **both
were found the same way**: a reason that had been counted as work for the whole
project turned out to be blocked TWICE, so clearing either half left it inert.

| Ruling | Shaman talents | Reaches |
| --- | --- | --- |
| **`castPushback`** | `eye_of_the_storm` (Ele, 3/3), `healing_focus` | five more across four classes — see below |
| **`totemEntities`** | `earth_s_grasp`, `guardian_totems`, `restorative_totems`, `mana_tide_totem` | Shaman only. **Closes the project's last open scope question** |

**`castPushback` IS A PROJECT-WIDE RULING AND IT HAS BEEN SWEPT.** Five pure
pushback talents in four other classes carry it now — `mage.improved_channeling`,
`warlock.fel_concentration`, `warlock.intensity`, `priest.twilight_focus`,
`druid.nature_s_focus` — which takes one talent off each of those classes'
queues. Three others name pushback and keep a different reason: `burning_soul`
(threat) and `spiritual_focus` (healing) are already ruled out, and
`mage.ice_barrier`'s first clause is a 447-damage ABSORB, which is the target
rather than the ruling. `outOfScope.test.ts` matches the WORDING now, so a new
unscoped pushback reason fails.

---

## Never-fired entries

**None.** Every entry in both lists fires — reprint with
`USES=1 PROFILES=shaman npx vite-node tools/measure_profiles.ts`.

## In the book, in no list, never cast

`chain_lightning` and `frost_shock` for both; `earth_shock`, `fire_nova` and
`windfury_weapon` for the Elemental.

- **`chain_lightning` has no second target** — area damage against one enemy.
- **`frost_shock` is a snare**, out of scope by ruling.
- **`fire_nova` is DELIBERATELY out of the Elemental list and it was measured, not
  argued.** Below that list's unconditional Lightning Bolt it fired zero times and
  the figure was 375.0 to the decimal; above it, 332.0 — a 43-point loss, because
  520 mana on a six-second cycle starves the filler. The floor rule: nothing below
  an ungated entry can ever be the first castable one.

---

## Traps specific to this class

- **A TALENT POINT CAN BUY A CLAUSE THE ROTATION CANNOT REACH, AND NOTHING SAYS
  SO.** The Elemental build spends 3/3 on Call of Flame, whose first clause is
  "the damage done by your FIRE TOTEMS", and its list cast no totem for the whole
  project. The talent was correct, its effect was correct, and it was worth
  nothing — a working talent on an ability nobody casts reports exactly like a
  working talent. **Adding the totem was +59.5.**
- **WINDFURY IS MAIN-HAND ONLY** and WEAPON-BOUND, so it fires only from a use of
  its own weapon. It spent its whole life refusing abilities and every figure was
  self-consistent and too low.
- **THE WINDFURY IMBUE'S INTERNAL COOLDOWN IS 3 SECONDS, THE OWNER'S, AND IT WAS
  1.5 BORROWED FROM THE TOTEM.** Twice too generous, worth −10.0 to fix, and the
  totem's 1.5 is still correct for the totem. A borrowed number can be wrong by a
  FACTOR, which is the whole argument for keeping a borrow visible.
  HANDOVER.md also claimed a Season of Discovery trinket tooltip read 2s; no such
  tooltip exists anywhere in the repository and the claim is gone.
- **MAELSTROM WEAPON IS 5 PPM, NOT A FLAT CHANCE**, and the SHAPE matters more
  than the number: a flat per-hit chance is worth more to a fast weapon and PPM
  removes exactly that. **A Rogue's poison is the opposite by ruling** — flat per
  strike, deliberately not normalised — and the two live side by side and must not
  be made to match.
- **A proc's reaction is built PER CHARACTER**, because an internal cooldown is
  per-character state. One shared closure silently stopped Windfury proccing after
  the first iteration of a batch.
- **Mana ticks twenty times a second**, "smooth" regeneration at 50ms, and
  **Improved Stormstrike is the only thing in this project that opens the five
  second rule for a window** rather than permanently.
- **Maelstrom Weapon is interpreted as PER STACK**, an interpretation recorded
  beside the aura, not a placeholder.
- **A REFRESH WINDOW CLIPS.** The Elemental's earlier +16.4 was replacing a
  two-second refresh window on Flame Shock with "if not active".
- **LIGHTNING OVERLOAD CARRIES THE SOURCE SPELL'S ID AND ITS OWN NAME**, and
  reversing either is silent. The ID is what Concussion and Call of Thunder key
  off, so its own id would strip every modifier; the NAME is what the damage
  analyzer groups by, so sharing the name would make it unmeasurable.
- **FIRE NOVA'S FIRE TOTEM REQUIREMENT IS `canCast` AND IS ASKED OF THE TARGET**,
  because the totem is modelled as a debuff there. That makes the Searing Totem
  entry above it in the Enhancement list load-bearing rather than independent —
  and it made the COEFFICIENT PROBE read `condition_failed`, which looks like a
  row rather than a hole. `tools/coefficient_probe.ts` has a `SETUP` entry for it
  now.

---

## What "done" looks like

Every item on the previous version of this list is closed.

1. ~~`elemental_focus` closed~~ — **done**, +12.5 to the Elemental.
2. ~~the six totem talents written up as ONE engine gap~~ — **better than done.**
   Two were never blocked on it, and the owner ruled the other four out of scope.
3. ~~Maelstrom Weapon's proc chance asked for~~ — **5 PPM**, the owner's.
4. ~~the Windfury 1.5s vs 2s discrepancy settled~~ — **3s**, the owner's, and the
   2s claim had no source.
5. **Nature's Swiftness** is the one item left, and it is **not a Shaman job**: a
   one-shot cast-time modifier selecting by SCHOOL, which the Druid wants too and
   `CastModifier.abilityIds` deliberately does not express. Neither Shaman profile
   spends a point on it. **Build it once, for both.**
6. ~~the Elemental list revisited last~~ — **done**, and it was the largest single
   thing in the class.

### What is actually left, in order

1. **`appliedElsewhere` lands with the Rogue's branch** → one line, and
   `elemental_weapons` stops reading as a gap. A test already fails until it is
   written.
2. **Magma Totem's spell power coefficient** — one question, and the answer will
   not get it cast. The only open data question in this class.
3. **Nature's Swiftness**, shared with the Druid.
4. **`improved_reincarnation`'s +4% maximum health** — a real missing declaration,
   in no build, and the cheapest of the three remaining.
