# Handover

Current state of SimForever, for picking up in a fresh context.

Architectural rules and conventions live in [CLAUDE.md](CLAUDE.md) and are not
repeated here. **Read its "Where the Forever data comes from" and "Reading a
class accurately" sections before touching any class number** — this file is
status, that one is how.

---

## Where the project is

**All nine classes and all 21 profiles are implemented**, every number traced
to a source rather than invented. **1,534 tests**, CI green on Node 20 and 22.
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
| LW Melee | Hunter | 7/13/31 | 458.8 |
| Seal Twist Ret | Paladin | 13/0/38 | 403.1 |
| Enh Shaman | Shaman | 19/32/0 | 392.6 |
| Shockadin | Paladin | 23/0/28 | 372.4 |
| Prot Warr | Warrior | 17/0/34 | 357.5 |
| Combat Rogue | Rogue | 18/33/0 | 347.6 |
| Venom Rogue | Rogue | 37/12/2 | 308.5 |
| Rupture Rogue | Rogue | 12/8/31 | 290.3 |
| BM Hunter | Hunter | 31/20/0 | 282.8 |
| Cat Druid | Druid | 9/35/7 | 267.8 |
| Shadow Priest | Priest | 16/3/32 | 266.1 |
| Bear Druid | Druid | 9/42/0 | 241.9 |
| LW Ranged | Hunter | 7/39/5 | 229.0 |
| Firelock | Warlock | 5/11/35 | 225.6 |
| Arcane Mage | Mage | 47/4/0 | 210.2 |
| Prot Pally | Paladin | 8/36/7 | 191.9 |
| Fire Mage | Mage | 10/39/2 | 133.5 |
| SM/DS | Warlock | 40/11/0 | 129.3 |
| Frostfire Mage | Mage | 0/29/22 | 95.5 |
| Moonkin | Druid | 38/0/13 | 94.2 |
| Ele Shaman | Shaman | 38/13/0 | 70.3 |

**The bottom of this table is not a balance finding.** See "What a caster
figure means" below before quoting any of it.

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
talents said "nothing attacks the player" three commits after something did.

Still open, in order of how many talents they would retire:

| Gap | Talents | Classes |
| --- | --- | --- |
| **Stat from stat** — a stat as a percentage of another | 6 | Shaman ×2, Mage, Paladin, Hunter, Priest |
| **Spell hit per school** — the attack table decides hit before any per-school modifier is consulted | 5 | Mage ×2, Priest ×2, Paladin |
| **Crit, or crit damage, for a LIST of abilities** — `critDamageBonus` is whole-character, `schoolCritDamage` is per school, `abilityCrit` names one; none selects a set | 3 | Warlock (Pandemic), Hunter (Mortal Shots, Savage Strikes) |
| **Mid-fight summoning** — `Simulation` exposes `combatants` read-only | 2 | Warlock Infernal, Mage elemental |
| **A one-shot per-ability CRIT modifier** — `CastModifier` carries cast time and cost, not crit | 2 | Paladin (Divine Favor), Priest (Inner Focus) |
| **A flat per-school damage bonus** — `damageTakenBySchool` multiplies | 1 | Paladin (Judgement of the Crusader, +161 Holy) |
| **Threat** | ~15 | every class; deliberately out of scope |

**Stat-from-stat is the obvious next one.** Careful Aim is 5/5 in all three
Hunter builds; Champion of the Light matters to Retribution because the seal
formula has a spell power term; Spiritual Guidance is Shadow's. Like
`grantCastModifier`, it is likely a missing DECLARATION rather than a missing
rule.

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

1. **Stat-from-stat** — six talents, four classes, and likely a declaration
   rather than a rule. Same shape as `grantCastModifier`, which retired eleven
   talents across seven classes for about 400 lines.
2. **Caster gear.** Every caster figure is a floor until some exists, and four
   of the five lowest numbers in the table are casters. This is a DATA task,
   not a code one — `nether.wowhead.com/classic/tooltip/item/<id>` returns
   plain JSON and `src/data/items/README.md` has the markers.
3. **Spell hit per school** — five talents, and a genuine rule change: the hit
   roll happens before any per-school modifier is consulted.
4. **The APLs are shells and say so.** Every list since the Warrior's is this
   project's guess at the standard shape, not the owner's own. They have been
   wrong twice in ways that cost real damage — the Shockadin seal and the
   missing Lightning Bolt in Enhancement. Worth reviewing with the owner
   profile by profile.

Not worth doing yet: **mid-fight summoning**. It is the last item on the gap
survey and exactly two abilities want it, neither in any profile.
