# Handover

Current state of SimForever, for picking up in a fresh context.

Architectural rules and conventions live in [CLAUDE.md](CLAUDE.md) and are not
repeated here. **Read its "Where the Forever data comes from" and "Reading a
class accurately" sections before touching any class number** — this file is
status, that one is how.

---

## Where the project is

**All nine classes and all 21 profiles are implemented**, every number traced
to a source rather than invented. **1,546 tests**, CI green on Node 20 and 22.
Profile format **v9**.

The twenty profiles were specified by the ruleset owner as
`talentsforever.com` build URLs; the Shadow Priest was added afterwards as the
twenty-first. Every one decodes to exactly 51 points.

The app is live at <https://donz-dev.github.io/SimForever/>, republished by
`.github/workflows/deploy.yml` on every push to `main` that passes.

### Measured, 300 iterations, seed 12345, with the preset raid buffs

These are comparable to **each other** and to nothing else. Turning the raid
off moves all of them; see [docs/raid-buffs.md](docs/raid-buffs.md).

| Profile | Class | Talents | DPS |
| --- | --- | --- | --- |
| DW Fury | Warrior | 18/33/0 | 643.2 |
| 2H Arms | Warrior | 38/13/0 | 585.5 |
| LW Melee | Hunter | 7/13/31 | **473.7** |
| Enh Shaman | Shaman | 19/32/0 | **408.3** |
| Seal Twist Ret | Paladin | 13/0/38 | 403.1 |
| Shockadin | Paladin | 23/0/28 | **380.6** |
| Prot Warr | Warrior | 17/0/34 | 357.5 |
| Combat Rogue | Rogue | 18/33/0 | 347.6 |
| Venom Rogue | Rogue | 37/12/2 | 308.5 |
| Rupture Rogue | Rogue | 12/8/31 | 290.3 |
| BM Hunter | Hunter | 31/20/0 | **290.0** |
| Cat Druid | Druid | 9/35/7 | 267.8 |
| Shadow Priest | Priest | 16/3/32 | 266.1 |
| Bear Druid | Druid | 9/42/0 | 241.9 |
| LW Ranged | Hunter | 7/39/5 | **237.2** |
| Firelock | Warlock | 5/11/35 | 225.6 |
| Arcane Mage | Mage | 47/4/0 | 210.2 |
| Prot Pally | Paladin | 8/36/7 | 191.9 |
| Fire Mage | Mage | 10/39/2 | 133.5 |
| SM/DS | Warlock | 40/11/0 | 129.3 |
| Frostfire Mage | Mage | 0/29/22 | 95.5 |
| Moonkin | Druid | 38/0/13 | 94.2 |
| Ele Shaman | Shaman | 38/13/0 | 70.3 |

**Bold is what `statFromStat` moved**, and it is the whole of the change:
Careful Aim for the three Hunters, Mental Dexterity and Mental Quickness for
Enhancement, Champion of the Light for Shockadin. Two profiles that gained the
talent did not move at all, on purpose -- see below.

**The bottom of this table is not a balance finding.** See "What a caster
figure means" below before quoting any of it.

**The two ranged Hunter figures are still wrong, in the other direction.** See
"Ranged attack power reaches nothing" under what to do next.

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
| **Crit, or crit damage, for a LIST of abilities** — `critDamageBonus` is whole-character, `schoolCritDamage` is per school, `abilityCrit` names one; none selects a set | 3 | Warlock (Pandemic), Hunter (Mortal Shots, Savage Strikes) |
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
| `PLACEHOLDER_PET_BASE_DAMAGE` / `_SWING_SECONDS` | 100 / 2 | The wiki says families differ and states none. Makes BM the roughest figure. |
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

**Four of the five lowest numbers in the table are casters, and that is a data
limitation rather than a finding.**

Two causes, neither inventable:

1. **No caster gear exists.** The item data is nineteen Classic stand-ins
   curated for a Warrior — no cloth, no staff, no caster weapon — so every
   caster's `spellPower` reads **zero**.
2. **Forever's spell data states flat damage and no coefficient.** Druid,
   Shaman, Mage, Warlock and Priest all read the same way, so this is how the
   source is written rather than a quirk of one class.

**The Paladin's seals are the single exception**, because the ruleset owner
supplied the formula directly:

```
damage = base + baseWeaponSpeed × (0.022 × attackPower + 0.044 × spellPower)
```

The Hunter has two ability coefficients from the wiki — Arcane Shot's 10% of
ranged attack power and Serpent Sting's 15% over its duration.

So a caster figure is a **floor, not an estimate**. Tests pin both causes, so
the day a coefficient or a caster item arrives they fail and the figures get
re-read.

---

## Open questions for the ruleset owner

1. **Seal of Command's PPM.** You chose procs-per-minute; the figure did not
   come with it. Largest single number in Seal Twist Ret.
2. **Seal of Righteousness' base** — is the low end of "21 to 75" the `base`
   term in your formula, or is it the midpoint?
3. **Maelstrom Weapon's proc chance.** Not in the client data at all.
4. **Pet base damage and swing speed**, per family. The wiki says they differ
   and states none.
5. **Bane of Agony's ramp** — did Forever keep Classic's 50/100/150 bands?
6. **Seal of the Crusader's "deals less damage with each attack"** states no
   figure, so the seal is currently generous.
7. **Careful Aim** reads "Increases your Attack Power by 100% of your
   Intellect". Is that the MELEE pool, as declared, or the ranged one a Hunter
   actually shoots with? Forever names ranged attack power explicitly in
   Aspect of the Hawk and Trueshot Aura and does not here, which is why it is
   declared as the plain one — but it is the difference between the talent
   being worth ~14% of a ranged Hunter's power and worth almost nothing. One
   line in `hunterEffects.ts`.

Asked and answered already, for reference: seal damage is **not** a weapon use;
a hawk is modelled **without** a real combatant; pet family is a **profile
field**; Shield Slam triggers **main-hand** effects.

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

1. **Ranged attack power reaches nothing.** Found while declaring Careful Aim,
   and it is the biggest accuracy problem in the project today.
   `weaponDamageFor` reads `stats.effective.attackPower` for EVERY slot,
   including `ranged` — so a Hunter's bow scales off MELEE attack power and is
   completely unaffected by the ranged pool. Probed directly: +200 melee attack
   power moved a bow hit from 168 to 209.43, and +200 ranged attack power left
   it at 168.

   The owner-named Hunter wiki settles it and disagrees:
   `github.com/classic-hunter/forever-hunter/wiki/Attack-Formulas` gives Auto
   Shot as `AmmoDPS x WeaponSpeed + (RAP / 14 x WeaponSpeed + Scope +
   AverageWeaponDamage)`, and Stat-Mechanics states "1 Agility = 2 Ranged
   Attack Power", "1 Agility = 1 Melee Attack Power" and "1 Strength = 1 Melee
   Attack Power" — no ranged bonus from strength at all.

   **So both ranged Hunter figures are overstated**, and the gear makes it
   worse rather than better: `SHARED_ARMOUR` is the Warrior set, so a Hunter
   carries 370 strength it should get no ranged attack power from. Measured on
   the presets, melee attack power is 1187 against a ranged 601 — the bow is
   swinging with roughly twice the power it should have.

   Three things are currently inert because of it and all three should come
   back: agility's 2 ranged attack power per point, Aspect of the Hawk, and
   the Trueshot Aura raid buff. Only Arcane Shot's and Serpent Sting's own
   coefficients read the ranged pool today.

   **It changes what Careful Aim is worth, so do it before re-reading that
   number.** Careful Aim is declared into `attackPower` — the plain one,
   because the talent says "Attack Power" and Forever names the ranged pool
   explicitly wherever it means it. Once the bow reads ranged attack power,
   Careful Aim will be worth very little to the two ranged builds and
   unchanged for LW Melee. **That is a question for the ruleset owner**: does
   Careful Aim feed the ranged pool for a Hunter? It is one line in
   `hunterEffects.ts`, deliberately.

2. **Caster gear.** Every caster figure is a floor until some exists, and four
   of the five lowest numbers in the table are casters. This is a DATA task,
   not a code one — `nether.wowhead.com/classic/tooltip/item/<id>` returns
   plain JSON and `src/data/items/README.md` has the markers.
3. **Spell hit per school** — five talents, and a genuine rule change: the hit
   roll happens before any per-school modifier is consulted.
4. **Crit, or crit damage, for a LIST of abilities** — three talents, two of
   them Hunter, and it is the same missing middle `SchoolModifiers` filled for
   damage schools, keyed by attack TABLE instead. It would retire Savage
   Strikes and Ranged Weapon Specialization, both fully inert and both taken
   at full rank by a Hunter profile, and make Mortal Shots and Predator's Edge
   exact where they are currently applied whole-character.
5. **The APLs are shells and say so.** Every list since the Warrior's is this
   project's guess at the standard shape, not the owner's own. They have been
   wrong twice in ways that cost real damage — the Shockadin seal and the
   missing Lightning Bolt in Enhancement. Worth reviewing with the owner
   profile by profile.

Not worth doing yet: **mid-fight summoning**. It is the last item on the gap
survey and exactly two abilities want it, neither in any profile.
