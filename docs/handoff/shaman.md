# SHAMAN DEEP DIVE

**Class:** Shaman
**Profiles to audit and prepare:** Ele Shaman, Enh Shaman

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**TOTEMS ARE NOT ENTITIES, AND THAT IS SIX OF THE SEVENTEEN LIVE GAPS.**
`earth_s_grasp`, `guardian_totems`, `totemic_focus`, `restorative_totems`,
`mana_tide_totem` and parts of `call_of_flame` and `elemental_fury` all need a
totem to exist as something that acts on its own. The engine cannot add a
combatant mid-fight — `Simulation` exposes `combatants` read-only.

**That is the mid-fight-summon gap wearing different clothes**, and it is the same
engine change the Warlock's Infernal and the Mage's elemental want. It lands
hardest here: it is an Elemental profile whose figure is short by whatever they are
worth, and **Ele Shaman is the second-lowest profile in the project.**

Searing Totem IS modelled — as damage credited without a combatant, the same way
the Hunter's hawk is, on the owner's call. So the precedent for "model the damage,
lose the separate targetability" exists and could be extended before the engine
change is.

---

## The profiles

| Profile | Talents | DPS | List | Entries |
| --- | --- | --- | --- | --- |
| Enh Shaman | 19/32/0 | **451.1** | `SHAMAN_ENHANCEMENT` | 7 |
| Ele Shaman | 38/13/0 | **295.4** | `SHAMAN_ELEMENTAL` | **3** |

**Enh Shaman gained +46.2 from the owner's list — the second-largest gain of the
23.** Ele Shaman gained **+16.4 from one word in one condition**: "if not active"
in place of a two-second refresh window on Flame Shock, with nothing else changed.

**ELE SHAMAN IS STILL A THREE-ENTRY LIST AND IS SECOND-LOWEST OVERALL.** The
handoff notes used to say a short list was where to look first; that stopped being
true — the count was never the thing, the conditions were. But **295.4 with six
totem gaps behind it is the most under-served profile in the project.**

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Ele Shaman | Lightning Bolt 60.5%, Flame Shock 21.2%, Lava Burst 18.3% |
| Enh Shaman | Main Hand 58.6%, Stormstrike 16.1%, Searing Totem 9.3%, Flame Shock 8.5%, Earth Shock 6.2%, Lightning Bolt 1.3% |

**THREE SOURCES FOR THE ELEMENTAL — the narrowest table in the project.** Lightning
Bolt alone is 60.5%, so its coefficient is effectively that profile's whole figure.
The Enhancement Shaman is the opposite: 58.6% is its own swing.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 50 | 17 | 4 | 12 | **17** |

### The 17 live gaps, grouped by cause

**Totems as entities (six, and one engine change):** `earth_s_grasp`,
`guardian_totems`, `totemic_focus`, `restorative_totems`, `mana_tide_totem`,
`improved_fire_nova`

**Nothing attacks either Shaman (five):** `elemental_warding`,
`improved_lightning_shield`, `water_shield`, `improved_stormstrike`'s dodge/parry
half, `eye_of_the_storm`

**Nothing interrupts a cast (two):** `eye_of_the_storm`, `healing_focus`

**A declaration that does not exist yet:**

| Talent | What it needs |
| --- | --- |
| `elemental_focus` | **THE CLEAREST ONE IN THE PROJECT.** A 10% chance of a Clearcasting state removing the NEXT damage spell's mana cost entirely is exactly `CastModifier.costFraction` with `consumedByCast`, which **Maelstrom Weapon already uses** — and its reason still says it has no declaration |
| `lightning_overload` | a chance for Lightning Bolt to cast a SECOND copy at half damage. A cast-triggered extra cast |
| `nature_s_swiftness` | a one-shot cast-time modifier. **The Druid has the same gap — build it once** |

**Healing or out of combat:** `improved_reincarnation`, `healing_focus`

### Partly modelled

| Talent | What is missing |
| --- | --- |
| `call_of_flame` | Searing Totem half works; Magma Totem and Fire Nova do not |
| `elemental_fury` | its Magma Totem clause |
| `maelstrom_weapon` | cast time and mana apply **per stack**; its PROC CHANCE is `PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE = 20` because the tooltip says only "a chance" |
| `tidal_focus` | healing only, and neither profile heals |

---

## Never-fired entries

**None.** Both Shaman lists have every entry firing.

## In the book, in no list, never cast

`chain_lightning`, `earth_shock`, `frost_shock`, `windfury_weapon`,
`searing_totem` for the Elemental; `chain_lightning` and `frost_shock` for
Enhancement.

- **`chain_lightning` has no second target** — area damage against one enemy.
- **`frost_shock` is a snare**, out of scope by ruling.
- `earth_shock` and `searing_totem` are cast by Enhancement and not by Elemental,
  which is a list decision rather than a gap.

---

## Traps specific to this class

- **WINDFURY IS MAIN-HAND ONLY** and it is a WEAPON-BOUND effect, so it fires only
  from a use of its own weapon. **It spent its whole life refusing abilities and
  every figure was self-consistent and too low** — a proc that never fires leaves
  nothing behind to notice. If whether an ability can proc something is in
  question, **ask the owner**; that is a standing instruction.
- **An extra attack pays a full `R × S` of rage for a swing that cost no time**,
  which is the one place the rage arithmetic does not cancel. Not the Shaman's
  problem directly, but Windfury is the project's canonical extra attack.
- **`PLACEHOLDER_WINDFURY_WEAPON_DURATION_MS` / `_INTERNAL_COOLDOWN_MS` are 1.5s**,
  borrowed from Windfury Totem whose window the owner stated. **The SoD trinket
  tooltip says 2s where the code carries 1.5.** That is a live discrepancy.
- **A proc's reaction is built PER CHARACTER**, because an internal cooldown is
  per-character state. One shared closure silently stopped Windfury proccing after
  the first iteration of a batch.
- **Mana ticks twenty times a second**, "smooth" regeneration at 50ms.
- **Maelstrom Weapon is interpreted as PER STACK**, which is an interpretation
  recorded beside the constant, not a placeholder.
- **A REFRESH WINDOW CLIPS.** The Elemental's entire +16.4 was replacing a
  two-second refresh window on Flame Shock with "if not active". Every list this
  project wrote for itself had that bug; the owner's do not.

---

## What "done" looks like

1. **`elemental_focus` closed.** Its reason claims no declaration exists and the
   mechanism is already in use by Maelstrom Weapon in the same class. **This is the
   cheapest real gap in the project** and it will move the Elemental's figure.
2. **The six totem talents written up as ONE engine gap** — mid-fight summoning —
   shared with the Warlock and Mage, and with the Searing Totem precedent noted as
   the cheaper alternative.
3. **Maelstrom Weapon's proc chance asked for.** It is a named placeholder on a
   capstone mechanic of the higher-DPS profile.
4. **The Windfury 1.5s vs 2s discrepancy settled**, since one of the two is wrong.
5. **Nature's Swiftness built once** for this class and the Druid.
6. **The Elemental list revisited last, and only after the totem question.** Three
   entries is not by itself the problem, but 295.4 is the lowest non-tank figure and
   six of its gaps point the same direction.
