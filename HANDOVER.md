# Handover

Current state of SimForever, for picking up in a fresh context.

Architectural rules and conventions live in [CLAUDE.md](CLAUDE.md) and are not
repeated here. **Read its "Where the Forever data comes from" and "Reading a
class accurately" sections before touching any class number** — this file is
status, that one is how.

---

## Where the project is

**All nine classes and all 21 profiles are implemented**, every number traced
to a source rather than invented. **1,574 tests**, CI green on Node 20 and 22.
Profile format **v9**.

**EVERY PROFILE IS IN ITS OWN CLASS'S GEAR.** Twenty of them wore
`SHARED_ARMOUR`, which is the Warrior set, and seventeen of those were not
Warriors. Twelve sixtyupgrades sets the owner supplied replaced it -- 151 items
on file now, in nine files, one per set. See "What the gear import moved".

The twenty profiles were specified by the ruleset owner as
`talentsforever.com` build URLs; the Shadow Priest was added afterwards as the
twenty-first. Every one decodes to exactly 51 points.

The app is live at <https://donz-dev.github.io/SimForever/>, republished by
`.github/workflows/deploy.yml` on every push to `main` that passes.

### Measured, 300 iterations, seed 12345, with the preset raid buffs

These are comparable to **each other** and to nothing else. Turning the raid
off moves all of them; see [docs/raid-buffs.md](docs/raid-buffs.md).

| Profile | Class | Talents | DPS | was |
| --- | --- | --- | --- | --- |
| DW Fury | Warrior | 18/33/0 | 643.2 | — |
| 2H Arms | Warrior | 38/13/0 | 585.5 | — |
| LW Melee | Hunter | 7/13/31 | **556.2** | 567.3 |
| BM Hunter | Hunter | 31/20/0 | **421.0** | 416.1 |
| Enh Shaman | Shaman | 19/32/0 | **404.5** | 408.3 |
| Seal Twist Ret | Paladin | 13/0/38 | **380.2** | 403.1 |
| Combat Rogue | Rogue | 18/33/0 | **376.9** | 347.6 |
| Prot Warr | Warrior | 17/0/34 | 357.5 | — |
| LW Ranged | Hunter | 7/39/5 | **342.1** | 349.9 |
| Rupture Rogue | Rogue | 12/8/31 | **315.2** | 290.3 |
| Venom Rogue | Rogue | 37/12/2 | **314.4** | 308.5 |
| Shadow Priest | Priest | 16/3/32 | **285.0** | 266.1 |
| Cat Druid | Druid | 9/35/7 | **272.0** | 282.7 |
| Shockadin | Paladin | 23/0/28 | **252.7** | 380.6 |
| Firelock | Warlock | 5/11/35 | **247.5** | 225.6 |
| Arcane Mage | Mage | 47/4/0 | **242.6** | 210.2 |
| Fire Mage | Mage | 10/39/2 | **223.3** | 133.5 |
| Bear Druid | Druid | 9/42/0 | **208.4** | 263.1 |
| Frostfire Mage | Mage | 0/29/22 | **184.4** | 95.5 |
| Moonkin | Druid | 38/0/13 | **166.2** | 94.2 |
| SM/DS | Warlock | 40/11/0 | **135.3** | 129.3 |
| Prot Pally | Paladin | 8/36/7 | **135.2** | 191.9 |
| Ele Shaman | Shaman | 38/13/0 | **119.3** | 70.3 |

**Bold is what the gear import moved, and it moved seventeen of the
twenty-three in both directions.** The six unmoved are the three Warriors and
the three Hunters, whose gear this did not touch -- and they are unmoved to the
DECIMAL, which is the check that nothing leaked out of the sets into shared
code. See "What the gear import moved".

| | was | statFromStat | + gear | + ranged AP | + tables | + APL | total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BM Hunter | 282.8 | 290.7 | 350.1 | 354.0 | 354.0 | **376.2** | +33.0% |
| LW Ranged | 229.0 | 238.3 | 307.3 | 312.8 | 326.7 | **349.9** | +52.8% |
| LW Melee | 458.8 | 474.6 | 500.1 | 500.1 | 521.0 | **567.3** | +23.6% |
| Enh Shaman | 392.6 | **408.3** | — | — | — | — | +4.0% |
| Shockadin | 372.4 | **380.6** | — | — | — | — | +2.2% |
| Cat Druid | 267.8 | — | **282.7** | — | — | — | +5.6% |
| Bear Druid | 241.9 | — | **263.1** | — | — | — | +8.8% |

Two profiles gained a stat-from-stat talent and did not move at all, on
purpose. **The two Druids moved without touching a Druid**: they carry a
two-hander that a stat-stick style was deleting, so its 42 strength had never
counted. LW Melee is unmoved by the ranged fix because it swings, not shoots.

**THE WARRIOR SET IS NOW WORN ONLY BY WARRIORS.** It used to be worn by twenty
profiles, seventeen of them not Warriors -- 370 strength and 245 agility on
Rogues, Druids, Mages and Priests alike. Every figure any of them ever produced
was built on somebody else's gear, and no test could have caught it: a profile
in the wrong gear runs perfectly and produces a plausible number.

**The bottom of this table is not a balance finding.** See "What a caster
figure means" below before quoting any of it.

### What the gear import moved

Twelve sets, 120 new items, seventeen profiles. Grouped by WHY, because the
reason matters more than the number:

| Profile | Was | Now | | Why |
| --- | --- | --- | --- | --- |
| Frostfire Mage | 95.5 | 184.4 | +93.1% | cloth: intellect and spell crit where plate gave neither |
| Moonkin | 94.2 | 166.2 | +76.4% | as above |
| Ele Shaman | 70.3 | 119.3 | +69.7% | as above, plus a caster shield that used to be deleted |
| Fire Mage | 133.5 | 223.3 | +67.3% | as above |
| Arcane Mage | 210.2 | 242.6 | +15.4% | as above; least mana-bound of the three |
| Firelock | 225.6 | 247.5 | +9.7% | as above |
| Rupture Rogue | 290.3 | 315.2 | +8.6% | real Rogue weapons and leather |
| Combat Rogue | 347.6 | 376.9 | +8.4% | as above |
| Shadow Priest | 266.1 | 285.0 | +7.1% | cloth, but most of its spell power is Shadow-only and inert |
| SM/DS | 129.3 | 135.3 | +4.6% | cloth; Shadow Bolt is flat-damage either way |
| Venom Rogue | 308.5 | 314.4 | +1.9% | **it can finally cast Backstab and Mutilate** |
| Enh Shaman | 408.3 | 404.5 | −0.9% | a 3.8s mace for a 3.6s sword, and less strength |
| Cat Druid | 282.7 | 272.0 | −3.8% | leather has less strength than plate, and +172 AP is inert |
| Seal Twist Ret | 403.1 | 380.2 | −5.7% | its own plate carries less strength than the Warrior's |
| Bear Druid | 263.1 | 208.4 | −20.8% | as Cat, and the tank cut trades strength for stamina |
| Prot Pally | 191.9 | 135.2 | −29.5% | a weaker one-hander and less block value than the Forever shield |
| Shockadin | 380.6 | 252.7 | −33.6% | **a 2.4s one-hander for a 3.6s two-hander** |

**THE WARRIOR SET WAS NOT A NEUTRAL STAND-IN.** It is a very strength-heavy
plate set, so every melee hybrid that moved to its own class's gear LOST attack
power. That is the honest figure and the old one was flattering.

**SHOCKADIN ALSO CHANGED COMBAT STYLE, and the gear is what changed it.** Its
set is Azuresong Mageblade and Earth and Fire -- a one-hander and a caster
shield -- where the preset said `two_hander`, under which `liveEquipment`
deletes the main hand and both off-hand slots and the build holds nothing at
all. It is `one_hand_shield` now. Seal of Righteousness scales with weapon
speed, so trading a 3.6-second two-hander for a 2.4-second one-hander is most
of the −33.6%. **This is the one decision in the import that is a build change
rather than a gear change, and it is the one to revisit if the owner meant
something else.**

**TWO FIGURES ARE UNDERSTATED BY A KNOWN AMOUNT.** Cat and Bear hold the Glaive
of Obsidian Fury, whose "+172 Attack Power in Cat, Bear, and Dire Bear forms
only" cannot be expressed -- an item stat is not conditional on the combat
style -- and the Shadow Priest is missing ~293 Shadow-only spell power for want
of a school-scoped spell power stat. Both are listed in the Gear panel and in
[src/data/items/README.md](src/data/items/README.md).

**FOUR BUGS SURFACED, all of which needed caster or tank gear to be visible:**

- a stat-stick OFF HAND had its stats deleted, so a caster shield contributed
  nothing. The main-hand half of this was fixed for the Hunter; the mirror
  survived.
- `Improves your chance to get a critical strike with all spells and attacks`
  granted only the MELEE half. `critChance` and `spellCritChance` are separate
  stats read by separate tables; sixty-two item lines say both.
- `Increased Defense +N` was being swallowed by the weapon-skill pattern and
  DROPPED, because only a weapon carries bonus skill. Seventeen lines.
- SET BONUSES were dropped entirely -- not unmodelled, dropped. They are text
  in `unmodelled` now, and the Priest's four-piece +2% spell crit is one.

And one that would have been silent: five sets name the **Season of Discovery**
Hand of Justice, id 228722, while the proc was keyed to the Classic 11815. Its
tooltip matches `MODELLED_AS_PROCS`, so the trinket would have read as fully
simulated while never firing once.

**The bow reads ranged attack power now**, and the prediction that said those
two figures were OVERSTATED was wrong: they went UP. At the pull a geared
Hunter has more melee attack power than ranged, 1160 against 1092, so reading
the correct pool looks like a nerf -- but the rotation opens with Aspect of
the Hawk, +120 ranged and nothing to melee, which puts the ranged pool ahead
once the fight is running. See "What the ranged attack power fix moved".

---

## Accuracy: what each source answered

Nine classes were built by the same five-step process, in
[docs/class-implementation.md](docs/class-implementation.md).

### `talentsforever.com` — talents, and the profile URLs

The beta client's own files, four static JavaScript assignments a plain `fetch`
reaches. Imported by `tools/import_forever_talents.mjs`, which **merges rather
than overwrites** and validates every invariant `talentData.ts` enforces.

- `src/data/talents/<class>.json` — **468** talents, nine classes, tree order
- `src/data/talents/values/<class>.json` — per-rank numbers, **hand-editable**

Profiles are decoded from their URLs by `tools/decode_talent_build.mjs`.
**Decode before writing anything.** A build that comes back at other than 51
points, or throws "X given N of M ranks", means the tree on disk disagrees with
the tree the URL was written against — and a wrong tree does not always throw.

**The rank values are the trap, not the tree.** A single-rank talent has no
`{0}` placeholder for the importer to identify, so its values come back `null`
and every effect reading one is silently dropped. Eight are hand-filled, each
with a `note` saying which number and why:

| Class | Talent | Value | Why it was needed |
| --- | --- | --- | --- |
| Warrior | Raging Blows | 2 | owner-confirmed Cleave rage |
| Rogue | Relentless Strikes | 20 | energy per finisher |
| Rogue | Flawless Execution | 10 | crit |
| Shaman | Call of Thunder | 3 | crit, stated in its text |
| Shaman | Shamanistic Focus | 45 | mana %, stated in its text |
| Mage | Missile Barrage | 40 | Arcane Blast proc chance |
| Mage | Hot Streak | 25 | cast-time % per stack |
| Priest | Shadowform | 100 | crit damage; its other three are aura constants |

`node tools/import_forever_talents.mjs --check` prints the count per class.

### `foreverchanges.pro` — every ability number

All nine spellbooks are captured at **max rank** in
`src/data/abilities/forever-<class>-spellbook.json` by
`tools/import_forever_spells.mjs`.

**No ability number in the project comes from Classic.** Forever changes them
heavily and in both directions, so a Classic value is not a safe approximation.
The Hunter is the clearest case, and all four differences came from this source
agreeing with the Forever Hunter wiki:

| | Classic | Forever |
| --- | --- | --- |
| Aimed Shot r6 | 600 bonus, 3s cast | **166**, 2s cast |
| Raptor Strike r8 | 140 bonus | **70** |
| Serpent Sting r9 | 490 total | **555**, and **+15% ranged AP** |
| Arcane Shot r8 | 183, spell power scaling | **217**, **+10% ranged AP** |

**The rank-1 rule caught five arguments**, one per class that has a
damage-granting capstone: a talent tooltip shows rank 1 of the ability it
grants, not the rank a level 60 trains. Mortal Strike 85 → 160, Bloodthirst
30 → 48, Shield Slam 421 → 640, Lava Burst 106–134 → 192–248, Pyroblast
101–131 → 520–646. **Check `max_rank` before comparing two sources.**

### A fifth source, for the Hunter only

`github.com/classic-hunter/forever-hunter/wiki`, named by the ruleset owner.
It is the **only** source for pet stat scaling and pet focus regeneration, and
it carries a full Forever-versus-Classic diff for the class. Community-
maintained rather than client-derived, so it ranks below the two above where
they overlap — they have not yet disagreed.

---

## What is NOT modelled, by cause

"Inert" has three different causes and they expire differently. This
distinction matters more than the count.

### Because of the engine — these expire, and three already have

Write these reasons specifically enough to re-read. Six Hunter pet talents all
named the same cause and expired together the moment pets existed; five Warrior
talents said "nothing attacks the player" three commits after something did;
**six stat-from-stat talents across five classes expired together** the day
`statFromStat` was declared. That is the fourth time, and the reason it keeps
working is that the reasons were specific enough to find by their wording.

Still open, in order of how many talents they would retire:

| Gap | Talents | Classes |
| --- | --- | --- |
| **Spell hit per school** — the attack table decides hit before any per-school modifier is consulted | 5 | Mage ×2, Priest ×2, Paladin |
| **Crit damage for a LIST of NAMED abilities** — `critMultiplierBonus` exists on `AbilityModifiers` and no talent effect reaches it, the way `abilityCrit` reaches crit CHANCE | 2 | Warlock (Pandemic), Rogue (Lethality) |
| **Mid-fight summoning** — `Simulation` exposes `combatants` read-only | 2 | Warlock Infernal, Mage elemental |
| **A one-shot per-ability CRIT modifier** — `CastModifier` carries cast time and cost, not crit | 2 | Paladin (Divine Favor), Priest (Inner Focus) |
| **A flat per-school damage bonus** — `damageTakenBySchool` multiplies | 1 | Paladin (Judgement of the Crusader, +161 Holy) |
| **Threat** | ~15 | every class; deliberately out of scope |

**Stat-from-stat is done**, and it was a missing declaration rather than a
missing rule, exactly as predicted -- `statFromStat`, folded into the
derivation `StatBlock` already takes as an injected function. What the
prediction got WRONG is worth keeping: it said Champion of the Light "matters
to Retribution because the seal formula has a spell power term". Seal Twist
Ret casts Seal of Command and Seal of the Crusader, and **Seal of Command is
70% of WEAPON damage with no spell power term at all** -- so the talent is
correct, the spell power is really on the character, and the figure did not
move by a decimal. Shockadin, which casts Seal of Righteousness, gained 2.2%.
Spiritual Guidance is a HOLY talent and the Shadow Priest does not take it.

**Two of six moved nothing, and both are right.** Arcane Resilience is armor
on a Mage nothing attacks. Assert the mechanism, not the DPS.

### Because of the target — these expire only if the encounter changes

The training dummy is a damage sink that survives every fight by design, is not
Undead or Demon, is never frozen, and never drops below full health. So:

- **Frozen targets** — Shatter, Fingers of Frost, Frostbite, and Ice Lance's
  own 300% bonus. Most of the Mage's Frost tree.
- **Execute ranges** — Decimation, Early Demise, Wake of Fire, Rapid Killing,
  Hammer of Wrath, Shadowburn's and Drain Soul's shard clauses.
- **Undead and Demon** — Exorcism, Holy Wrath, Crusade's bonus half, Purifying
  Power, Holy Conduit's other three spells.
- **Shadow Word: Death's backlash ALWAYS lands**, for the same reason — and
  that one is modelled, because leaving it out would make a genuinely dangerous
  spell look free.

### Because of the build — these are the profile agreeing with itself

- **Eleven Warlock Demonology talents.** Both profiles take Demonic Sacrifice,
  which kills the demon for a two-hour buff.
- **Eight Hunter Beast Mastery talents**, for the two Lone Wolf builds, which
  take the talent that means "no pet".
- **Every healing talent** — 26 on the Priest alone. Nothing here measures
  healing.

**The gap survey called five profiles pet-blocked and four of them bring no
pet.** Do not write a build's own choice up as an engine gap.

---

## Placeholders — every invented number, named

Each is a `PLACEHOLDER_*` constant with a comment saying it is unverified, and
each is surfaced where a person can see it.

| Constant | Value | What would settle it |
| --- | --- | --- |
| `PLACEHOLDER_SEAL_OF_COMMAND_PPM` | 7 | **The owner chose PPM and the figure has not arrived.** The largest number in Seal Twist Ret. |
| `PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE` | 20 | The tooltip says only "a chance"; the `{0}` is the reduction. |
| `PLACEHOLDER_PET_BASE_DPS` | 50 | **One stated pet DPS or damage range at level 60.** Every source gives family modifiers RELATIVE to a base and none states the base. Swing speed is also still a placeholder and no longer affects damage. |
| `PLACEHOLDER_WINDFURY_WEAPON_DURATION_MS` / `_INTERNAL_COOLDOWN_MS` | 1.5s | Borrowed from Windfury Totem, whose window the owner stated. |
| `PLACEHOLDER_SOUL_SHARDS` | 10 | What a Warlock banks before a pull. No income in-fight. |
| `PLACEHOLDER_COMBUSTION_DURATION_MS` | 30s | Its real end is "until 4 crits", which nothing counts. Generous. |
| `PLACEHOLDER_FLURRY_DURATION_MS` | 12s | Warrior-era; charges end it in practice. |
| `PLACEHOLDER_BERSERKER_RAGE_DURATION_MS` | 10s | Warrior-era. |
| `PLACEHOLDER_REVENGE_WINDOW_MS` | 5s | Warrior-era. |
| `PLACEHOLDER_BOSS_*` | 5000 / 2s / 15% | The encounter, not a class. See [docs/incoming-damage.md](docs/incoming-damage.md). |
| `PLACEHOLDER_ONE_HAND` / `_TWO_HANDER` / `_RANGED` | — | Only used when nothing is equipped; every preset equips. |

### Interpretations — stated in one place, cheap to flip

Not placeholders. A real number read one of two possible ways, with the reading
written down beside it.

- **Seal of Righteousness' base** is read as the LOW end of "21 to 75", because
  the range is described as the effect of weapon speed and the midpoint would
  double-count the speed term in the owner's formula. **Unconfirmed.**
- **Maelstrom Weapon is per stack**, not in total — otherwise its five-stack
  cap does nothing at any rank.
- **Arcane Blast's cost escalation is per stack**, same argument.
- **Bane of Agony ticks flat.** Its tooltip describes a ramp and states no
  figures; the 24-second total is exact and only its distribution is flattened.
- **Every DoT cadence divides its stated total evenly.** Where a source gives a
  total and a duration but no interval, the cadence chosen is the one leaving
  whole ticks — Flame Shock's 176 over 12s is four of 44 at three seconds, and
  two or four seconds both leave fractions.

---

## What a caster figure means

**The casters are still at the bottom of the table, and that is a data
limitation rather than a finding.**

**ONE OF THE TWO CAUSES HAS EXPIRED.** Caster gear exists now -- every caster
reads 200 to 453 spell power where it used to read zero -- and the four cloth
profiles gained 4.6% to 93.1% for it. None of that gain is spell power
multiplying damage. It is INTELLECT buying casts before the mana runs out, and
SPELL CRIT, which caster gear grants and plate does not.

1. ~~No caster gear exists.~~ Twelve sets, imported from the owner's own
   sixtyupgrades links. See "What the gear import moved".
2. **Forever's spell data states flat damage and no coefficient.** Druid,
   Shaman, Mage, Warlock and Priest all read the same way, so this is how the
   source is written rather than a quirk of one class. **All 453 points of an
   Elemental shaman's spell power multiply nothing**, and every nuke says so on
   the results page.

**AND A THIRD, WHICH BELONGS TO THE PRIEST ALONE.** Most of the spell power in
Vestments of Prophecy is SHADOW-ONLY -- six of eight tier pieces and 75 on
Anathema -- and `spellPower` here is one school-blind number, so ~293 of it is
listed and not applied. Eight Paladin lines say the same about Holy.

**The Paladin's seals are the single exception**, because the ruleset owner
supplied the formula directly:

```
damage = base + baseWeaponSpeed × (0.022 × attackPower + 0.044 × spellPower)
```

The Hunter has two ability coefficients from the wiki — Arcane Shot's 10% of
ranged attack power and Serpent Sting's 15% over its duration.

So a caster figure is still a **floor, not an estimate** -- for one reason
where it used to be two, and two for the Priest. Tests pin each cause, so the
day a coefficient arrives they fail and the figures get re-read. That is how the
gear half of this caveat was caught expiring: five tests asserting
`spellPower === 0` failed the moment the sets landed.

---

## The Hunter is done at the engine level

An audit of all 50 talents, every Hunter and pet ability, and the whole Forever
spellbook against what is implemented found **one** thing the engine could not
express -- and it was WRONG rather than merely missing.

**`conditionalDamage` HAD NO "WHILE YOU HAVE A PET" CLAUSE.** Focused Fire is
"+2% to all damage you and your pet deal while your pet is active", declared
with `requires: {}` -- no requirement at all -- so **both Lone Wolf builds
collected the 2% for a pet that is never built.** They take it as a cheap route
to Careful Aim and then take the talent that means "no pet", so it was the one
clause that mattered.

`BuildRequirement` (renamed from `WeaponRequirement`, because `shield` was
already not a weapon and `hasPet` is not even equipment) now carries it, and
`bringsPet` answers it -- **the same function the encounter uses to decide
whether to BUILD a pet**, so the talent and the fight cannot disagree. That is
the `isWeaponUse` lesson: a rule kept privately in one file while another
re-derives it gets re-derived wrong.

**HUNTER'S MARK WAS NEVER IMPLEMENTED**, and it is 71 ranged attack power for
two minutes off one instant cast. It had been dismissed once as "a raid-buff-
shaped ability no priority list casts" -- the wrong shape, since it is a single
cast the Hunter makes on the pull, exactly like the Aspect every list already
opens with. It was also worth nothing to check while a bow scaled off MELEE
attack power; that changed earlier in this run of work.

| | was | now | what moved it |
| --- | --- | --- | --- |
| BM Hunter | 416.1 | **421.0** | Hunter's Mark, +8.0. Keeps Focused Fire: it has a pet |
| LW Ranged | 349.9 | **342.1** | Focused Fire fix -6.9, Mark +0.8 (noise) |
| LW Melee | 567.3 | **556.2** | Focused Fire fix -11.1, no Mark |

**THE MARK IS IN TWO LISTS OF THE THREE, AND THAT IS MEASURED.** Over 40
batches it is +8.0 to Beast Mastery, +0.8 to Lone Wolf Ranged inside a 3.3
interval, and **-10.1 to Lone Wolf Melee**. Measuring the STAT alone said +1.9
for the melee build; measuring the ABILITY -- which also spends 60 mana and a
global cooldown at the pull -- said the opposite. A stat probe is not an
ability probe.

**TWO OF THE THREE HUNTER BUILDS NOW REPORT NOTHING INERT AT ALL.** Beast
Mastery joined Lone Wolf Ranged with an empty "chosen but not fully simulated"
list.

### What is left on the Hunter, and none of it is the engine

| Cause | Items |
| --- | --- |
| **Content** the engine can already express | Lacerating Strikes (a bleed, and its value is `null` in the data -- the single-rank trap, so it needs hand-filling); Summon Hawk's second hawk, which is why BM is understated |
| **Data** nobody has stated | Sniper Shot's mana cost, a placeholder at 200 with no cost line in the spellbook -- and it matters, because LW Ranged is mana-bound and Sniper Shot is its largest spender; the pet's base DPS |
| **Target or build**, and these never expire | ~22 reasons: traps (6), movement and control (7), stuns, range, not being attacked (4), needing a kill, healing a pet |

---

## What the pet work moved

**BM Hunter 376.2 -> 416.1**, and no other profile, because no other profile
brings a pet.

The two pet placeholders were the roughest numbers left in the project. One of
them is gone, one shrank, and one turned out not to matter.

**THE BASE IS A DPS, NOT A PER-SWING DAMAGE**, which is the shape both sources
state and the one the old model had backwards. The wiki gives auto attack as
`((PetBaseDPS + AP / 14) x mods) x PetSwingSpeed`, and `powerCoefficient` was
already `speed / 14`, so multiplying a base DPS by the swing reproduces that
line exactly.

**SO SWING SPEED NO LONGER AFFECTS DAMAGE AT ALL.** It used to: a flat 100 per
swing meant a one-second pet would deal twice a two-second pet's damage, and
both sources say the opposite in as many words -- the wiki that "faster attack
speed does not inherently increase the pet's base DPS", Petopia that "faster
pets may attack more frequently but they do proportionally less damage per
hit". A placeholder that changes no number is a much smaller problem than one
that does.

**THE FAMILY MODIFIERS ARE REAL NOW**, from Petopia Classic, which your own
wiki names as the source for per-family detail:

| Family | Damage | Health | Armor |
| --- | --- | --- | --- |
| Cat | 1.10 | 0.98 | 1.00 |
| Wolf | 1.00 | 1.00 | 1.05 |
| Bear | 0.91 | 1.08 | 1.05 |
| Raptor | 1.10 | 0.95 | 1.03 |
| Boar | 0.90 | 1.04 | 1.09 |

**The Cat row cross-checks exactly** against the wiki's own "Notable Family
Modifiers" table, which is what makes the other four trustworthy from the same
source. The four Warlock families are neutral and say so -- neither source
covers a demon, and both Warlock profiles sacrifice theirs before the pull.

**CLASSIC VALUES THAT ARE FOREVER'S VALUES.** The wiki's Forever-changes page
lists what Forever does to pets -- six new abilities and one item -- and pet
base damage, scaling and attack speed are not on it. That is the same
derivation this project already used for Claw and Bite.

**HAPPINESS IS 125%** for a fed pet, from the wiki's Happy / Content / Unhappy
at 125 / 100 / 75. That one is an assumption about the PLAYER rather than the
engine, the same kind Improved Tracking already makes, and it is stated on the
constant rather than hidden.

Together the Cat's 1.10 and the 1.25 are +37.5% on the pet, which is the whole
of the DPS change.

**AND THE CAVEAT NOW REACHES THE PAGE.** `PET_UNMODELLED` was written,
exported, and referenced by NOTHING -- for as long as pets have existed --
while its own comment claimed it was "printed in the app". The caveat channel
reads the PLAYER's ability book, and a pet is not an ability, so it had no
route. It has one now, shown under "The pet" beside the results and only when
a pet was actually built. A placeholder nobody is told about is the failure
mode the rule exists to prevent.

**WHAT IS STILL INVENTED: one number.** `PLACEHOLDER_PET_BASE_DPS`, at 50 --
deliberately the same 50 DPS the old 100-per-2-seconds worked out to, so the
restructure moved nothing by itself and the modifiers are the only measured
change. Every source states the family figures as RELATIVE and none states the
absolute they are relative to.

---

## What the APL review moved

The Hunter lists were the first this project measured entry by entry rather
than reasoned about. Each variant ran 30 batches of 10 fights, and a
difference inside the interval was treated as no difference.

| | was | now | what did it |
| --- | --- | --- | --- |
| LW Melee | 521.0 | **567.3** | Arcane Shot added, +55 |
| LW Ranged | 326.7 | **349.9** | Aimed Shot dropped, +23 |
| BM Hunter | 354.0 | **376.2** | Arcane Shot above Summon Hawk, +20 |

**A CAST RESETS THE SWING TIMER, AND THE RANGED SLOT IS A SWING.** That one
rule decided most of it. Aimed Shot is the heaviest shot in the book -- 784
damage against Sniper Shot's 638, which is exactly why it was in the list --
but two seconds of cast throws away most of a 3.2-second bow cycle, and
auto-shot is 42% of a Marksmanship Hunter's damage. Dropping it is worth +23.
Multi-Shot is out for the same reason at half the cast time. **Per-use damage
says nothing about this**, and per-use damage is what the list had been
ordered by.

**TWO OF THE THREE RUN OUT OF MANA, AND THE THIRD DOES NOT.** A geared Hunter
empties 3,651 mana by the 30-second mark and spends **half the fight on
auto-shot alone**, so what binds is damage per MANA -- Serpent Sting 4.13,
Sniper Shot 3.19, Arcane Shot 2.57, Aimed Shot 2.53. The melee build is the
opposite and ends with 44% unspent, which is why adding one instant shot to it
was the largest single entry in the review at +55.

**THE COMMENT THAT WAS WRONG.** Summon Hawk and Arcane Shot share a cooldown
group, and the note said "a hawk is 32 damage every two seconds for eighteen
seconds against Arcane Shot's one hit. The hawk wins on paper." It counted the
hawk's ticks and not its price: Arcane Shot above it is worth +20, and once it
is above, the hawk never fires at all. **It is kept last rather than deleted**
-- it measures identical either way, and a build with mana to spare would use
it.

**THE THREE LISTS DISAGREE ON PURPOSE.** Aimed Shot is worth -23 to
Marksmanship and +4 to Beast Mastery, because Beast Mastery has no Sniper Shot
to spend the mana on and its pet carries enough damage that the interrupted
auto-shot is a smaller share. A rule that held for one build was checked
against the others rather than assumed.

**WHAT WAS CHECKED AND LEFT ALONE**, which is as much of the review as what
changed: Aspect of the Beast is correct for the melee build and Aspect of the
Hawk costs it 35 DPS; Serpent Sting is worth 23 and belongs where it is;
Sniper Shot above Arcane Shot is 0.55 apart inside a 2.26 interval, so the
order is not a finding and the capstone keeps the top on other grounds.

---

## What the attack-table scope moved

`AttackTableModifiers` is the same three fields as `SchoolModifiers` keyed by
`AttackTableKind` — the other axis. A school separates fire from frost; this
separates MELEE from RANGED, and a SWING from a SPECIAL.

**It keys on the table rather than on a `'melee' | 'ranged'` enum, and that is
the whole reason it works.** The four Hunter talents divide on TWO axes at
once, so a two-value enum could express none of them without a second flag:

| Talent | Tooltip says | Tables |
| --- | --- | --- |
| Savage Strikes | "all your melee ABILITIES" | `melee-special` |
| Ranged Weapon Spec | "damage with ranged WEAPONS" | both ranged |
| Mortal Shots | "all ranged ABILITIES" | `ranged-special` |
| Predator's Edge | "your MELEE critical strike damage" | both melee |

Measured, 300 iterations and seed 12345:

| | was | now | what moved |
| --- | --- | --- | --- |
| LW Melee | 500.1 | **521.0** | Savage Strikes +8.6, Predator's Edge reaching swings +15.5, no longer over-applying to Serpent Sting about −3.2 |
| LW Ranged | 312.8 | **326.7** | Ranged Weapon Specialization, +13.9, previously inert |
| BM Hunter | 354.0 | 354.0 | takes only Mortal Shots, which was already exact for a ranged build |

**LW RANGED NOW HAS AN EMPTY "chosen but not fully simulated" LIST** — every
talent it takes is modelled, which no Hunter build had managed before.

**The swing-versus-special line is where the value is.** Predator's Edge says
"melee critical strike damage" and not "melee abilities", so it reaches the
two-hander's swing — worth more on its own than the two previously inert
talents together. Getting that backwards would have been a plausible number
forever.

**A DoT tick is reached for CRIT and not for DAMAGE.** `critFrom` declares
which table's crit a tick borrows and nothing more, so `dealDamage` looks the
damage multiplier up on `attackTable` alone. Serpent Sting is the case: it
ticks NATURE damage with `critFrom: 'ranged-special'`, so Mortal Shots reaches
it and "damage you deal with ranged WEAPONS" correctly does not.

---

## What the ranged attack power fix moved

`weaponDamageFor` read `attackPower` for **every** weapon slot, so a bow
scaled off melee attack power. Fixed to read the pool that matches the slot,
which reproduces the Forever Hunter wiki's Auto Shot term exactly --
`powerCoefficient` is `speed / 14`, so `coefficient x RAP` is `RAP / 14 x
speed`.

**THE PREDICTION ON FILE WAS WRONG IN DIRECTION.** It said both ranged Hunter
figures were overstated; they went UP, by 3.9 and 5.5. At the pull a geared
Hunter has MORE melee attack power than ranged -- 1160 against 1092 -- so the
correct pool looks smaller. But the rotation opens with **Aspect of the Hawk,
+120 ranged and nothing to melee**, which puts the ranged pool ahead at 1212
once the fight is actually running. `characterAtCombatStart` processes no
events, so it shows the character a moment before that is true.

Three sources of ranged attack power were being paid for and reaching
nothing: the Aspect, agility's 2-per-point, and the Trueshot Aura raid buff --
plus the +48 and +17 on the Hunter's own trinket and bow.

**It keys on `weaponScaling.slot`, never on `weaponSlot`.** The latter says
which weapon's PROCS an attack triggers, and Thunder Clap and Intercept both
declare `'ranged'` there so `isWeaponUse` excludes them -- they are melee
Warrior abilities using the ranged TABLE because it has no dodge or parry.
Keying on it would hand a Warrior a ranged pool of zero.

**1,548 TESTS PASSED WITH THE BUG IN.** Nothing asserted which pool a bow
read, because a Hunter with a plausible attack power produces a plausible
number. Five of the seven new tests fail without the fix.

### And a stat stick that was being swung

Found while measuring this: the fix that stopped a stat-stick style DELETING a
two-hander let one through as a **weapon**. `createPlayer` merges equipped
weapons over the style's own, so a Druid in Cat form was swinging an Obsidian
Edged Blade -- base 234 every 3.6 seconds instead of a paw's 50 every 1.0 --
which read as a 62% damage increase and as a working feature.

A stat-stick hand now contributes stats and never a weapon, which is what both
`combatStyles.ts` and `weaponsForStyle` already said it meant. Cat and Bear
keep the 42 strength they had never been getting, worth 5.6% and 8.8%.

---

## Open questions for the ruleset owner

1. **Seal of Command's PPM.** You chose procs-per-minute; the figure did not
   come with it. Largest single number in Seal Twist Ret.
2. **Seal of Righteousness' base** — is the low end of "21 to 75" the `base`
   term in your formula, or is it the midpoint?
3. **Maelstrom Weapon's proc chance.** Not in the client data at all.
4. **One pet's base DPS, or one damage range, at level 60.** Narrowed a lot:
   the family modifiers are now real (Petopia Classic, with the Cat row
   cross-checked against your own wiki), happiness is the wiki's 125%, and
   swing speed turned out not to affect damage at all. What no source states
   is the ABSOLUTE figure all those modifiers are relative to.
5. **Bane of Agony's ramp** — did Forever keep Classic's 50/100/150 bands?
6. **Seal of the Crusader's "deals less damage with each attack"** states no
   figure, so the seal is currently generous.

Asked and answered already, for reference: seal damage is **not** a weapon use;
a hawk is modelled **without** a real combatant; pet family is a **profile
field**; Shield Slam triggers **main-hand** effects; **Careful Aim contributes
to attack power AND ranged attack power** — the wording pointed the other way
and asking was the whole difference.

---

## Where the code is

```
engine/    rules. No React, no DOM, no module-level mutable state.
game/      content. Nine classes: abilities/, auras/, talents/, rotations/,
           reactions/, one file per class each.
data/      scraped JSON. Never hand-edited EXCEPT talents/values/*.json.
analysis/  telemetry → statistics.
simulator/ the only place engine + game + analysis meet.
profiles/  versioned JSON, and presets.ts with all 21 builds.
```

**A class must be registered in four places** and missing any one is silent —
`talentValues.ts`'s `FILES`, `talentBuild.ts`'s `EFFECTS` **and** its
`REACTIONS`, and `abilitiesForClass.ts`. `tests/game/classRegistration.test.ts`
fails when one is missing, and also checks every talent id in the tree has an
effect declared, in both directions. It has caught a slug typo
(`lights_vigil` for `light_s_vigil`) since.

### Tools

```bash
node tools/import_forever_talents.mjs --check     # diff talents, all classes
node tools/import_forever_talents.mjs --write
node tools/decode_talent_build.mjs --profiles     # decode every build URL
node tools/import_forever_spells.mjs <class> --write
```

---

## What to do next

In the order I would do them:

1. **A SCHOOL-SCOPED SPELL POWER STAT**, which is now the largest known
   shortfall in the item data. `spellPower` is one school-blind number, and
   nineteen item lines across the Priest and Paladin sets name a school --
   "Increases damage done by Shadow spells and effects by up to 39". The Shadow
   Priest is missing ~293 of it, which the planner counts and this does not.

   `SchoolModifiers` is the shape to follow: it already carries crit chance,
   crit damage and a damage multiplier per `DamageSchool`, and this is one more
   term. `STAT_NAMES` is a deliberately closed flat set, so a keyed stat does
   not fit there -- the modifier belongs beside the other school-scoped ones,
   read by `dealDamage` where it already reads `spellPower`.

   **A STYLE-SCOPED ITEM STAT is the same shape of gap**, worth 172 attack
   power to both feral Druids: "+172 Attack Power in Cat, Bear, and Dire Bear
   forms only" on the Glaive of Obsidian Fury. `statsForStyle` already knows the
   style; the item rule does not.

2. **Spell hit per school** — five talents, and a genuine rule change: the hit
   roll happens before any per-school modifier is consulted.
3. **Crit damage for a LIST of NAMED abilities** — two talents, Pandemic and
   Lethality, and it should be the cheapest item here: `critMultiplierBonus`
   already exists on `AbilityModifiers` and simply has no talent effect
   reaching it, the way `abilityCrit` reaches crit CHANCE. A missing
   DECLARATION rather than a missing rule, which is now the third time —
   after `grantCastModifier` and `statFromStat`. Both reasons were re-read
   when the attack-table scope landed and name all three existing scopes.
4. **The OTHER SEVEN CLASSES' APLs have not been measured.** The Hunter's
   three now have, entry by entry, and the review moved them **+20 to +55
   DPS each** — so the others are very likely leaving similar amounts on the
   table. They remain this project's guess at the standard shape rather than
   the owner's own, and they have been wrong three ways already: the
   Shockadin seal, the missing Lightning Bolt in Enhancement, and now a
   Hunter comment that argued for the wrong ability and was believed.

   **The method is worth copying.** Patch one list, measure 30 batches of 10
   fights, treat a difference inside the interval as no difference, and check
   the two things that decided the whole Hunter review: whether the build is
   resource-bound or global-cooldown-bound, and whether any listed ability
   has a CAST TIME, because a cast resets the swing timer. Both are cheap to
   check and neither is visible in per-use damage.

   The Warrior's lists are the exception — they came from the owner.

Not worth doing yet: **mid-fight summoning**. It is the last item on the gap
survey and exactly two abilities want it, neither in any profile.
