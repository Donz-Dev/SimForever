# WARLOCK DEEP DIVE

**Class:** Warlock
**Profiles to audit and prepare:** SM/DS, Firelock

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## The one thing to understand first

**THE WARLOCK'S 25 LIVE GAPS ARE THE LARGEST COUNT IN THE PROJECT AND THE MOST
MISLEADING NUMBER IN IT. THIRTEEN OF THEM ARE ONE THING: BOTH PROFILES TAKE DEMONIC
SACRIFICE, WHICH KILLS THE DEMON.**

`improved_imp`, `improved_voidwalker`, `improved_sayaad`, `improved_felhunter`,
`unholy_power`, `demonic_energies`, `demonic_brand`, `soul_link`,
`demonic_knowledge`, `master_demonologist`, `improved_health_funnel`,
`master_summoner`, `fel_domination`, `demonic_pact` — **every one is inert because
there is no pet, and there is no pet because the build chose not to have one.**

**That is the BUILD cause of inert, and it is correctly dead.** It is the same
situation as the Hunter's Lone Wolf. Writing these up as remaining work inflates
the queue by half. **The honest count of this class's real gaps is about 11.**

**So do not read Warlock 25 against Warrior 1 as a measure of how much work is
left here.** The real queue is roughly the Paladin's size.

---

## The profiles

| Profile | Talents | DPS | List | Notes |
| --- | --- | --- | --- | --- |
| Firelock | 5/11/35 | **535.5** | `WARLOCK_DESTRUCTION` | **third-highest in the project** |
| SM/DS | 40/11/0 | **349.1** | `WARLOCK_AFFLICTION` | |

**SM/DS GAINED +55.9 FROM THE OWNER'S LIST — THE LARGEST GAIN OF ALL 23**, and it
went from six entries to five doing it. **The count was never the thing, the
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
| SM/DS | **Shadow Bolt 52.1%**, Corruption 22.3%, Bane of Agony 18.0%, Siphon Life 7.6% |
| Firelock | Incinerate 36.9%, Immolate 24.2%, Conflagrate 16.8%, Corruption 13.5%, Shadowburn 8.7% |

**Shadow Bolt is over half of SM/DS.** No auto attack in either — a `caster` style
has none. Four and five sources respectively, so every coefficient is load-bearing.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 52 | 21 | 3 | **3** | **25** |

**Three ruled out is the LOWEST in the project** — this class's trees are almost all
damage and pets, with very little healing, positioning, threat or crowd control to
rule out. That is why the gap column looks so large: nothing is absorbed by the
scope rulings.

### The 25 live gaps, grouped by cause

**No demon, because both profiles sacrifice it (thirteen — see above).**

**Nothing attacks or interrupts a Warlock (four):** `fel_concentration`,
`intensity`, `molten_skin`, `demonic_aegis`

**One target:** `bane_of_havoc` — it copies damage dealt to OTHER targets onto the
cursed one, and there is one target, **so it is correctly zero rather than inert**

**Needs a kill:** `soul_harvesting`

**A declaration that does not exist yet:**

| Talent | What it needs |
| --- | --- |
| `pandemic` | crit DAMAGE for seven NAMED periodic spells. **`critMultiplierBonus` exists on `AbilityModifiers` and no talent effect reaches it** — the Rogue's Lethality wants the identical mechanism, so **build it once** |
| `amplify_curse` | raises the effect of the NEXT Curse or Bane. A one-shot per-ability DAMAGE modifier — `CastModifier` carries cast time and cost, not damage |
| `decimation` | blocked twice, and the shard clause is the one that needs saying |
| `improved_drains` / `soul_siphon` | Drain Life and Drain Soul are channels **no list casts**. Wrack IS declared now, so **both reasons were updated and are worth re-reading** |

---

## Never-fired entries

**None.** Both Warlock lists have every entry firing.

## In the book, in no list, never cast

`immolate`, `searing_pain`, `wrack` for SM/DS; `shadow_bolt`, `bane_of_agony`,
`searing_pain` for Firelock — **mostly the two lists dividing the same book, which
is correct.**

**WRACK IS DECLARED, SCALING, AND DELIBERATELY IN NO LIST.** Its coefficient is
**14.3% of spell power per tick**, six ticks one second apart, supplied by the owner
directly because `WoWSimWorksheet.xlsx` has no Wrack row — **the only row in
`coefficients.ts` that is not from the sheet**, and its provenance is recorded
beside the constant because a sheet refresh will not carry it.

**The coefficient did not make it worth casting.** Six ticks at 14.3% is 0.858 over
the channel — Shadow Bolt's 0.857 delivered in twice the time — so six seconds of
Wrack is 216 + 0.858 against two Shadow Bolts at 536 + 1.714 in the same six. About
half, before and after. **The reason to cast it is its +10% to your other Shadow
DoTs, and that is still unmodelled**: damage-taken multipliers here are per SCHOOL,
and a Shadow multiplier would also raise Shadow Bolt at 52.1% of the profile's
damage, which is a bigger number rather than an approximation. **A periodic-only
school vulnerability is the field it wants.**

The owner's words: *"it's unimportant for the rest of the simulator for now, there
isn't a profile that uses it."*

---

## Traps specific to this class

- **WHERE TWO SOURCES DISAGREE, `foreverchanges.pro` WINS** — the owner's standing
  rule, given when it settled Life Tap at 840 against our capture's 424. It outranks
  the older instruction to prefer the newer read or to ask, and **it applies to every
  class**, because eight of the nine have no owner spreadsheet to appeal to.
- **THE RULE DOES NOT APPLY WHEN THE PREFERRED SOURCE IS SILENT RATHER THAN
  DIFFERENT.** `foreverchanges.pro` carries **no reagent field for any spell**, so
  its 365-mana cost for Shadowburn does not contradict the Soul Shard the other
  source states — it cannot express one. **Both are charged.** Taking a tie-break
  literally where there is no tie deletes a real cost.
- **`PLACEHOLDER_SOUL_SHARDS` is 10** — what a Warlock banks before a pull. There is
  no in-fight shard income modelled.
- **Fireball's hybrid split is the interpretation to know:** a hybrid's two halves
  share one coefficient **by DURATION rather than by damage**, which is why
  Fireball's burn is 11% of its damage and takes 35% of its scaling. Immolate is the
  Warlock's version of the same shape — `IMMOLATE_SP_COEFFICIENT` 0.2 for the hit and
  `IMMOLATE_TICK_SP_COEFFICIENT` 0.13 per tick.
- **`aftermath` raises Immolate INITIAL damage only**, and the initial hit and its
  burn share one ability id — which is why that talent is partly modelled.
- **Bane of Agony ticks FLAT**, an interpretation: **did Forever keep Classic's
  50/100/150 bands?** It is 18.0% of SM/DS's damage, so the answer matters.
- **A temporary summon is modelled without a combatant** on the owner's call — the
  Infernal is the mid-fight-summon gap, shared with the Mage's elemental and the
  Shaman's totems. **Nothing in any profile needs it.**
- **`fel_vitality`'s mana bonus is applied through INTELLECT** rather than to the
  pool directly, because a percentage of a pool computed once would freeze at the
  unbuffed figure.
- **A duplicate ability id in a list is legal here:** Shadow Bolt is in the
  Affliction list twice on purpose — gated on a proc above, ungated as the filler
  below.

---

## What "done" looks like

1. **The thirteen demon talents written up as ONE build cause** — Demonic Sacrifice —
   rather than thirteen items, so this class's real queue reads as ~11 and not 25.
2. **`pandemic` reached via `critMultiplierBonus`**, together with the Rogue's
   Lethality. One mechanism, two classes, and it exists and is unused today.
3. **Bane of Agony's ramp asked for.** 18% of SM/DS's damage currently ticks flat on
   an interpretation.
4. **A periodic-only school vulnerability decided**, which is the only thing that
   would make Wrack worth casting and is the one clause it still has open.
5. **`improved_drains` and `soul_siphon` reasons re-read**, since Wrack's declaration
   changed what they say and neither has been checked since.
6. **`amplify_curse`'s one-shot damage modifier scoped** — `CastModifier` carries cost
   and cast time and not damage, and this is the second talent to want that.
