# WARRIOR DEEP DIVE

**Class:** Warrior
**Profiles to audit and prepare:** 2H Arms, DW Fury, Prot Warr

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## Read this before anything else

**THE WARRIOR IS NOT THE NORM AND MUST NOT BE USED AS THE MODEL FOR EFFORT.** It
had **four** sources where every other class has one or two, and **eight of its
numbers turned out wrong** when they were cross-checked: Slam, Thunder Clap,
Bloodthirst, Demoralizing Shout, Battle Shout, Shield Wall, Revenge and Shield
Slam. It is also the only class with an owner spreadsheet
(`WoWForeverWarriorAbilities.xlsx`), the only one documented in `docs/` in its own
right — [docs/warrior.md](../warrior.md) — and it carries 2,025 comment lines
against 268–529 for every other class.

**So its 1 live gap is what a class looks like AFTER the work, not a class that
needed less.** Read any claim about this project's depth as a claim about the
Warrior until checked.

[docs/warrior.md](../warrior.md) has the full tooltip-reading rules and the
per-ability figures. **They are class-independent** and worth reading before
auditing any class.

---

## The profiles

| Profile | Talents | DPS | List | Style / stance |
| --- | --- | --- | --- | --- |
| DW Fury | 18/33/0 | **652.0** | `WARRIOR_DUAL_WIELD_BERSERKER` | dual wield, Berserker |
| 2H Arms | 38/13/0 | **607.2** | `WARRIOR_TWO_HAND_BATTLE` | two-hander, Battle |
| Prot Warr | 17/0/34 | **454.6** | `WARRIOR_SHIELD_DEFENSIVE` | 1H & shield, Defensive, **target attacks back** |

**DW Fury and 2H Arms are the two highest profiles in the project.** Prot Warr is
sixth. Anything that moves a shared melee rule shows up here first and largest.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| 2H Arms | Main Hand 39.4%, Overpower 16.5%, Mortal Strike 16.5%, Slam 6.9%, Deep Wounds 6.3%, Execute 5.7% |
| DW Fury | Main Hand 24.7%, Off Hand 18.6%, Heroic Strike 15.8%, Bloodthirst 13.6%, Execute 10.7%, Whirlwind 5.7% |
| Prot Warr | Heroic Strike 32.3%, Revenge 21.7%, Shield Slam 19.1%, Main Hand 12.4%, Thunder Clap 6.4%, Rend 4.5% |

**PROT WARR IS THE ONLY PROFILE IN THE PROJECT WHOSE AUTO ATTACK IS NOT ITS
LARGEST SOURCE**, and the only one where the target swings back. Its rage income
is partly from damage TAKEN, which is why Bastion's 10% damage multiplier measures
as ~12% DPS: more damage buys more rage buys more casts. Treat it as a different
animal from the other two.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 53 | 43 | 3 | 6 | **1** |

### The one live gap

| Talent | Reason |
| --- | --- |
| `improved_berserker_rage` | Grants rage when Berserker Rage is activated, and **no priority list casts Berserker Rage** |

**That is a BUILD cause, not an engine one.** Berserker Rage is in the book of all
three profiles and in no list, and `PLACEHOLDER_BERSERKER_RAGE_` is 10 seconds
borrowed because Forever's tooltip names no magnitude. Two ways to close it and
they are different work: put Berserker Rage in a list and measure it, or get the
magnitude from the owner and keep it out.

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `sweeping_strikes` | the ability is implemented and does nothing — its whole effect is extra targets, and there is one |
| `weaponmaster` | the mace and staff clause ignores a percentage of target armor, which the damage pipeline cannot express |
| `piercing_howl` | **NOT TO BE IMPLEMENTED** — the owner ruled it out. Not a gap |

---

## Never-fired entries

| Entry | Profiles | Why |
| --- | --- | --- |
| `battle_shout_cast` | all three | **the encounter already supplies it** as a preset raid buff, so the cast is refused all fight |
| `battle_stance_cast` | 2H Arms | the preset already opens in Battle Stance |
| `berserker_stance_cast` | DW Fury | as above |
| `defensive_stance_cast` | Prot Warr | as above |

**ALL FOUR ARE KEPT ON PURPOSE** and must not be "fixed". A character built by
hand in another stance needs the stance casts, and they cost a build that does not
need them exactly nothing. Battle Shout's entry carries a **"+11.83 DPS" comment
measured before raid buffs were selected rather than assumed** — the figure was
right on the day and the entry has been inert since.

## In the book, in no list, never cast

`slam`, `whirlwind`, `overpower`, `revenge`, `hamstring`, `thunder_clap`,
`intercept`, `execute`, `cleave`, `rend_cast`, `demoralizing_shout_cast`,
`recklessness_cast`, `berserker_rage_cast`, `shield_wall_cast`,
`shield_block_cast`, `charge`, `sweeping_strikes` — **varying by profile**, and
most are correct: a two-hander does not Revenge, a Berserker cannot Thunder Clap,
Cleave and Sweeping Strikes are area damage against one enemy.

**Worth a second look:** `recklessness_cast` and `berserker_rage_cast` are
cooldowns no list asks for, and Improved Berserker Rage's gap depends on the
second one.

---

## Traps specific to this class

- **THE OVERLOADED TABLE.** Thunder Clap, Intercept and Charge are melee abilities
  declaring `ranged-special`, because that table has no dodge or parry and because
  it is how `isWeaponUse` excludes them. **Check the class's own abilities, not a
  table name**, before scoping anything to a table.
- **A dual-wielder has two combat tables, not one shown twice.** Miss and enemy
  dodge derive from the WIELDING weapon's skill. Anything reporting them must ask
  per slot.
- **Shield Slam triggers MAIN HAND effects**, settled by the owner because the
  rule alone did not answer it.
- **Rage is a flat rate per swing, not a share of damage.** `R × S`, R being 3.46
  one-handed and 4.5 two-handed, S the BASE speed. Speed cancels, so haste raises
  nothing — **except that an extra attack pays a full `R × S` for a swing that
  cost no time.**
- **Prot Warr's Revenge costs 2 rage on the built character**, not what the
  ability declares. Read costs off `characterAtCombatStart`.
- **`WARRIOR_BATTLE` (14 entries) and `WARRIOR_SHIELD` (15) are still shells and
  NO PRESET REACHES THEM** — the fallbacks for a shield in Battle Stance or a
  dual-wielder outside Berserker. A test pins them so a third does not quietly
  join them. Do not measure them as if they mattered.
- **`protectionTalents.test.ts`'s Bastion DPS-ratio test is rotation-sensitive**
  with about 6% of headroom either way, and it moves with the Prot list. It reads
  1.1224 today and has read 1.089 to 1.16 on code that never touched the talent.
  **It is not testing the multiplier** — the exact 1.1 is asserted next door on
  `baseDamageMultiplier`. Expect it to move if you touch the Prot list.

---

## What "done" looks like

1. **Improved Berserker Rage resolved** — either Berserker Rage enters a list and
   is measured, or the owner supplies its magnitude and the talent's reason says
   so specifically enough to re-read.
2. **`sweeping_strikes` and `weaponmaster` reasons re-read.** Both blame the
   engine. Armor penetration is a real missing pipeline step; confirm it is still
   missing rather than assuming.
3. **The four never-fired entries confirmed as still deliberate**, and Battle
   Shout's expired "+11.83" comment corrected or dated.
4. **Every figure re-checked against `docs/warrior.md`'s reading rules** — this is
   the one class where a second and third source exist, so disagreements are
   settleable rather than open questions.
