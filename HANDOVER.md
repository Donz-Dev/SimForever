# Handover

**Status only.** Rules and conventions are in [CLAUDE.md](CLAUDE.md); how a class
gets built is [docs/class-implementation.md](docs/class-implementation.md).

## Where the project is

All nine classes and all 23 profiles are implemented, every number traced to a
source rather than invented. **1,648 tests**, CI green on Node 20 and 22. Profile
format **v9**. Live at <https://donz-dev.github.io/SimForever/>, republished by
`.github/workflows/deploy.yml` on every push to `main` that passes.

The profiles were specified by the ruleset owner as `talentsforever.com` build
URLs and every one decodes to exactly 51 points. Every profile is in its own
class's gear, from twelve sixtyupgrades sets the owner supplied — 151 items in
nine files. The item database is **frozen**.

### The regression baseline

300 iterations, seed 12345, preset raid buffs. Comparable to **each other** and to
nothing else. **Measure with `runProfileBatch`, not `runProfile`** — the app runs
the former and the two are different fights even at one iteration.

| Profile | Class | Talents | DPS | | Profile | Class | Talents | DPS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DW Fury | Warrior | 18/33/0 | 643.2 | | Fire Mage | Mage | 10/39/2 | 355.9 |
| 2H Arms | Warrior | 38/13/0 | 585.5 | | Moonkin | Druid | 38/0/13 | 353.1 |
| LW Melee | Hunter | 7/13/31 | 556.2 | | LW Ranged | Hunter | 7/39/5 | 342.1 |
| Shadow Priest | Priest | 16/3/32 | 510.9 | | SM/DS | Warlock | 40/11/0 | 331.7 |
| Firelock | Warlock | 5/11/35 | 479.1 | | Shockadin | Paladin | 23/0/28 | 324.5 |
| BM Hunter | Hunter | 31/20/0 | 421.0 | | Rupture Rogue | Rogue | 12/8/31 | 315.2 |
| Enh Shaman | Shaman | 19/32/0 | 410.9 | | Venom Rogue | Rogue | 37/12/2 | 314.4 |
| Arcane Mage | Mage | 47/4/0 | 405.1 | | Frostfire Mage | Mage | 0/29/22 | 305.6 |
| Seal Twist Ret | Paladin | 13/0/38 | 391.9 | | Ele Shaman | Shaman | 38/13/0 | 279.0 |
| Combat Rogue | Rogue | 18/33/0 | 376.9 | | Cat Druid | Druid | 9/35/7 | 272.0 |
| Prot Warr | Warrior | 17/0/34 | 357.5 | | Bear Druid | Druid | 9/42/0 | 208.4 |
| | | | | | Prot Pally | Paladin | 8/36/7 | 139.3 |

**The eleven pure-melee profiles being unmoved to the DECIMAL is the check that a
change stayed where it was meant to** — both Warriors, Prot Warr, all three
Rogues, Cat, Bear and all three Hunters. Use it on every change.

**A caster figure is an estimate, not a floor.** All three reasons it used to be a
floor have expired: caster gear exists, spell power has a school, and the
coefficient rule arrived. What remains unmodelled for casters is ordinary content
— totems have no entity, Chain Lightning has no second target, Blast Wave's area
half lands on the one enemy there is — and each is listed per ability on the
results page.

**Two figures are understated by a known amount.** Cat and Bear hold the Glaive of
Obsidian Fury, whose "+172 Attack Power in Cat, Bear, and Dire Bear forms only"
cannot be expressed, because an item stat is not conditional on the combat style.

## The milestone

**A full engine for WoW: Forever with all 23 profiles fully implemented — every
ability, spell, cooldown and talent NON-INERT, and every applicable spell and
ability carrying an attack power or spell power coefficient.**

Measured at `d2718b0`, and the numbers say it is not close:

| | |
| --- | --- |
| **140 of 468 talents are a live gap** | down from a raw count of 262 unmodelled reasons, because 89 are permanently out of scope by ruling and 33 more are PARTLY modelled. See the census below — the raw total is not a work queue |
| **113 abilities declared against 478 captured** | the data is on disk; the declarations are not. Druid 15, Hunter 14, Mage 13, Rogue 12, Warlock 10, Shaman 9, Priest 7, Paladin 6, plus the Warrior's 27 |
| **`powerCoefficient` per class file** | Mage 10, Warlock 6, Shaman 6, Warrior 3, Priest 3, Druid 3, Paladin 2, Hunter 1, **Rogue 0**. The RULE exists; per-ability application is what is missing |
| **19 `PLACEHOLDER_*` constants** | each a real number nobody has supplied |
| **Rotations are thin and unmeasured** | Warrior has 12 priority lists and came from the owner; every other class has 2–5, and **only the three Hunter APLs have ever been measured entry by entry** |

**The Warrior was built first and built properly, and it is not the norm.** Read
any claim about this project's depth as a claim about the Warrior until checked.
It is the only class with an owner spreadsheet, the only one documented in
`docs/` at all, and it carries 2,025 comment lines against 268–529 for every
other class.

**AND IT WAS THE ONLY CLASS WHOSE NUMBERS HAD EVER BEEN CROSS-CHECKED.** Four
sources agreed or were adjudicated for the Warrior and **eight of its figures
turned out wrong**. `foreverchanges.pro/spellbook/<class>` is the available second
opinion and nothing imports from it.

**THE WARLOCK IS NOW CHECKED TOO: seven of ten agreed exactly, and four
disagreements are open.** Full record and method in
[docs/source-cross-checks.md](docs/source-cross-checks.md). The one that matters
is **Life Tap, 424 against 840 — worth +13.5% on Firelock, measured**, and it is
not staleness: both sources are at build 1.60.1.70009 and they disagree on the
number. **Two client-derived sources can disagree at the same build**, which this
project had not seen before. Seven classes are still unchecked; the Rogue and the
Priest are the highest value.

### The talent census

Every talent, classified from the DATA rather than from prose: an `unmodelled`
entry carries a `scope` when the owner has ruled the effect out, so a decision
and a gap can be told apart mechanically. `tests/game/outOfScope.test.ts`
enforces it, and a new class writing "nothing here moves" without the ruling
fails.

| Class | Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- | --- |
| Warrior | 53 | 43 | 3 | 6 | **1** |
| Paladin | 52 | 22 | 7 | 13 | **10** |
| Hunter | 50 | 24 | 5 | 8 | **13** |
| Druid | 51 | 19 | 5 | 14 | **13** |
| Shaman | 50 | 17 | 4 | 12 | **17** |
| Mage | 54 | 25 | 2 | 9 | **18** |
| Priest | 53 | 15 | 2 | 18 | **18** |
| Rogue | 53 | 21 | 2 | 6 | **24** |
| Warlock | 52 | 20 | 3 | 3 | **26** |
| **Total** | **468** | **206** | **33** | **89** | **140** |

**239 of 468 talents do something**, 89 never will, and **140 are the actual
remaining work** — not the 262 a raw count of unmodelled reasons suggests. The 96
scoped entries break down as 32 crowd control, 33 healing, 17 positioning and 14
threat.

The rulings, recorded in CLAUDE.md under **Scope**: positions, range, facing and
movement; crowd control; threat; and healing THROUGHPUT — but **mana RETURN is in
scope**, because it changes a damage profile's sustain, so a talent returning mana
is a live gap and gets no `scope`.

Two questions the census raises that the rulings do not answer:

- **Stealth and openers.** Eleven Rogue talents are inert because every fight
  opens in combat — Premeditation, Initiative, Improved Ambush, Cutthroat, Dirty
  Deeds, Camouflage, Opportunity and more. That is an encounter property, not one
  of the four rulings, and it is most of why the Rogue has the second-largest live
  count. **Worth asking whether an opener is in scope at all.**
- **Totems as entities.** Five Shaman talents need a totem to exist as something
  that acts on its own. That is the mid-fight-summon engine gap wearing different
  clothes, and it lands on an Elemental profile whose figure is short by whatever
  they are worth.

**The spell exclusion list is still to be proposed and approved** — 478 captured
against 113 declared. A stated exclusion list is what turns a vague "incomplete"
into a finite work list.

### Open engine gaps

| Gap | Talents | Classes |
| --- | --- | --- |
| **Spell hit per school** — the attack table decides hit before any per-school modifier is consulted | 5 | Mage ×2, Priest ×2, Paladin |
| **Crit damage for a LIST of NAMED abilities** — `critMultiplierBonus` exists on `AbilityModifiers` and no talent effect reaches it, the way `abilityCrit` reaches crit CHANCE | 2 | Warlock, Rogue |
| **A one-shot per-ability CRIT modifier** — `CastModifier` carries cast time and cost, not crit | 2 | Paladin, Priest |
| **A style-scoped item stat** — `statsForStyle` knows the combat style; the item rule does not | 1 item line | both feral Druids, 172 attack power |
| **A flat per-school damage bonus** — `damageTakenBySchool` multiplies | 1 | Paladin |
| **Mid-fight summoning** — `Simulation` exposes `combatants` read-only | 2 | Warlock Infernal, Mage elemental. Nothing in any profile needs it |

### Placeholders — every invented number, named

| Constant | Value | What would settle it |
| --- | --- | --- |
| `PLACEHOLDER_SEAL_OF_COMMAND_PPM` | 7 | the owner chose PPM and the figure has not arrived. Largest number in Seal Twist Ret |
| `PLACEHOLDER_SPELL_COEFFICIENT_DOT_DIVISOR` | 15 | any Forever source stating one DoT's coefficient outright. Decides most of the Shadow Priest and both Warlocks |
| `PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS` | 3.5 | Pyroblast's coefficient — the only spell that reaches the clamp |
| `PLACEHOLDER_PET_BASE_DPS` | 50 | one stated pet DPS or damage range at 60. Every source gives family modifiers RELATIVE to a base and none states the base |
| `PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE` | 20 | the tooltip says only "a chance" |
| `PLACEHOLDER_SOUL_SHARDS` | 10 | what a Warlock banks before a pull. No in-fight income |
| `PLACEHOLDER_COMBUSTION_DURATION_MS` | 30s | its real end is "until 4 crits", which nothing counts. Generous |
| `PLACEHOLDER_WINDFURY_WEAPON_DURATION_MS` / `_INTERNAL_COOLDOWN_MS` | 1.5s | borrowed from Windfury Totem, whose window the owner stated. The SoD trinket tooltip says 2s where the code carries 1.5 |
| `PLACEHOLDER_FLURRY_DURATION_MS` / `_BERSERKER_RAGE_` / `_REVENGE_WINDOW_MS` | 12s / 10s / 5s | Warrior-era; charges end Flurry in practice |
| `PLACEHOLDER_PET_SWING_SECONDS` | — | no longer affects damage, since a pet's base is a DPS |
| `PLACEHOLDER_BOSS_*` | 5000 / 2s / 15% | the encounter, not a class. See [docs/incoming-damage.md](docs/incoming-damage.md) |
| `PLACEHOLDER_ONE_HAND` / `_TWO_HANDER` / `_RANGED` | — | only used when nothing is equipped; every preset equips |

**Interpretations** are not placeholders — a real number read one of two ways,
with the reading beside it: Seal of Righteousness' base as the LOW end of "21 to
75"; Maelstrom Weapon and Arcane Blast as per stack; Bane of Agony ticking flat;
every DoT cadence dividing its stated total into whole ticks; a hybrid's two
halves sharing one coefficient by DURATION rather than by damage. The last is why
Fireball's burn is 11% of its damage and takes 35% of its scaling.

## Open questions for the ruleset owner

1. **Seal of Command's PPM.** You chose procs-per-minute; the figure did not come
   with it.
2. **Seal of Righteousness' base** — is the low end of "21 to 75" the `base` term
   in your formula, or the midpoint?
3. **Maelstrom Weapon's proc chance.** Not in the client data at all.
4. **One pet's base DPS, or one damage range, at 60.** The family modifiers are
   real and happiness is the wiki's 125%; what no source states is the absolute
   those are relative to.
5. **Bane of Agony's ramp** — did Forever keep Classic's 50/100/150 bands?
6. **Seal of the Crusader's "deals less damage with each attack"** states no
   figure, so the seal is currently generous.
7. **Berserker Rage's magnitude** — Forever's tooltip names none.

**Four more from the Warlock cross-check**, where our source and
`foreverchanges.pro` disagree at the same client build and neither can win on its
own. See [docs/source-cross-checks.md](docs/source-cross-checks.md).

8. **Life Tap: 424 or 840?** The big one — **+13.5% on Firelock**, measured.
   talentsforever says 424, foreverchanges says 840, both at build 1.60.1.70009.
9. **Shadowburn: 258–288 or 251–281?** Small either way.
10. **Searing Pain: 107–125 or 105–123?** Small either way.
11. **Does Shadowburn cost a Soul Shard, 365 mana, or both?** One source says each.
    Classic charges both. The simulator charges the shard alone, which gates it on
    a placeholder pool with no in-fight income.

Answered already, for reference: seal damage is **not** a weapon use; a hawk is
modelled **without** a real combatant; pet family is a **profile field**; Shield
Slam triggers **main-hand** effects; Careful Aim contributes to attack power
**and** ranged attack power; resistances on an enemy target do not affect damage.

## What to do next

The refactor is phased; the milestone follows it.

1. ~~**Phase 1 — documentation.**~~ **Done.** Five Warrior-only docs and the engine
   gap survey folded into [docs/warrior.md](docs/warrior.md) and this file;
   CLAUDE.md restructured as a reference; five expired claims cleared.
2. **Phase 2 — code, conservatively.** In progress. **Done:** the rulings are data
   (`OutOfScope`, 96 entries tagged, a test that a new class cannot slip past), the
   Talent panel shows a decision separately from a gap, the healing split is made,
   and the odd-one-out Warrior capture is named for what it is. **Left:**
   - **Ask the owner for each placeholder number** — 19 of them, listed above.
     Every one answered is a placeholder deleted.
   - **The seven talents whose rule already exists with nothing hooked to it.**
     Shaman Elemental Focus is the clearest: a one-shot cost modifier is exactly
     `CastModifier.costFraction` with `consumedByCast`, which Maelstrom Weapon
     already uses, and its reason still says it has no declaration. Rogue
     Lethality and Warlock Pandemic want `critMultiplierBonus`, which exists and
     nothing reaches. **These will move DPS, so they want their own PR and a
     re-measured baseline.**
   - **Dead code**: exports nothing imports.
   **Do not restructure the engine, the panels or the profile schema**; volume is
   the problem, not shape.
3. **Phase 3 — the milestone, per class.** Every talent resolves to an effect or
   to a permanent out-of-scope reason, with no "not written yet". Every spell on
   the approved list declared, with its cooldown. Every damaging ability carrying
   the right coefficient. **The APL measured entry by entry** — 30 batches of 10
   per variant, a difference inside the interval treated as no difference. The
   Hunter review is the worked method and moved those three profiles +20 to +55
   DPS each.

A profile has **no `faction` field**; faction is derived from race. The milestone
asks for faction as a default, so either say that derivation is the answer or
store it and bump v9.
