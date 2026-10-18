/*
 * ==============================================================================
 * THE FROSTFIRE MAGE, OPTIMISED DIMENSION BY DIMENSION.
 *
 *   PRESET=mage_frostfire VARIANTS=ffApl npx vite-node tools/probe_build.ts
 *
 * Run through `docs/profile-optimisation.md`. Every group carries its own
 * control, because a group without one cannot tell "this loses" from "this
 * group did not apply".
 *
 * ------------------------------------------------------------------------------
 * THE FIVE STEP 0 INVARIANTS, DERIVED RATHER THAN RECALLED.
 * `npx vite-node tools/encode_talent_build.mjs --all` says:
 *
 *   Frostfire  (mage_frostfire)   0/29/22   51 points
 *   https://talentsforever.com/mage/60/-1355000013013403-00550003310003002-3
 *
 *   class                mage
 *   majority tree        FIRE, 29 of 51, and it stays the majority
 *   combat style         caster  (`preset.detail`: "Gnome, caster, standing target")
 *   stance/form          battle, which a Mage never reads
 *   target swings back   false
 *
 * GEAR IS E65 AND NO STAT ON IT MOVES. No group here touches `itemId`.
 *
 * ------------------------------------------------------------------------------
 * WHERE ITS DAMAGE IS, off a 30-fight `USES=1` run at **1092.5 +/- 15.3** on the
 * shipped build -- which is the ILLEGAL one, see `ffGateB`:
 *
 *   frostfire_bolt   42.2%  on 15.9 casts
 *   pyroblast        19.7%  on  4.6 casts   (the entry appears TWICE, pooled)
 *   Ignite           16.3%  not in the list, and correctly so
 *   fire_blast       13.4%  on  6.7 casts
 *   scorch            8.4%  on  6.6 casts
 *
 * `evocation` fires 0.00 times. **That is the owner's entry and they have ruled
 * it intended** -- `mageAbilities.test.ts` pins the zero. Do not touch it.
 *
 * ------------------------------------------------------------------------------
 * STEP 1'S SIXTH READ -- `grep -n triggersGcd src/game/abilities/mage.ts` --
 * returns exactly two hits, `arcane_power` and `presence_of_mind`, and **this
 * build casts neither.** Every ability it does cast is a spell with a cast time
 * or an instant that should take a global cooldown, so there is nothing of the
 * +33 shape here. `combustion` is instant, applies an aura and takes a GCD,
 * which is the same shape the owner corrected on Arcane -- but it is not in
 * this build's book (it needs `critical_mass` 5/5 and this build has 4/5), so
 * it is out of scope for this round and recorded in HANDOVER instead.
 *
 * THE BUILD IS NEARLY MANA-BOUND AT 60s. `probe_resources` reads
 * `gained 11593  spent 10630  wasted 0  headroom 962`, against the Fire Mage's
 * 2920 -- so a candidate that buys casts with mana is paying from a thin pool,
 * and `master_of_elements` (1137 mana a fight) and `frost_channeling` are load
 * bearing rather than filler.
 *
 * ------------------------------------------------------------------------------
 * **WHAT THIS ROUND SHIPPED, AND THE TWO LARGEST MEASURED GAINS ARE NOT IN IT.**
 *
 *   SHIPPED  the illegal pre-pull Scorch reverted      **-25.90 +/- 9.70**
 *   SHIPPED  eureka held for a Fingers of Frost window **+5.99 +/- 0.95**
 *   SHIPPED  mage_armor's dead entry removed           BIT-IDENTICAL
 *   WITHHELD critical_mass 5/5 via master_of_elements  **+21.80 at 60s**
 *   WITHHELD the owner's scorch window 3s -> 5s        **+18.54 at 60s**
 *
 * EVERY FIGURE ABOVE WAS RE-TAKEN AT `e5f45ad` (round 26, the Hunter auto-shot
 * ruling) after it merged mid-round. **A peer merge invalidates the
 * measurements and not only the diff** -- they reproduced: the shipped baseline
 * is 1051.7 + 5.99 = **1057.7 to the decimal**, and ungating Eureka again on the
 * shipped build measures **-5.99 +/- 0.95**, the exact mirror.
 *
 * ------------------------------------------------------------------------------
 * **THE TWO WITHHELD GAINS ARE 60-SECOND ARTEFACTS, AND THE CLOCK IS THE ONE
 * THING A PAIRED PROBE CANNOT SEE** -- every profile carries
 * `durationSeconds: 60`, so the fight length is in the baseline AND in every
 * variant and cancels. Re-run with `DURATION=`:
 *
 *   |                               | 60s     | 180s    | 300s   |
 *   | baseline                      | 1057.7  | 851.2   | 658.8  |
 *   | eureka gate (SHIPPED)         | **+5.99 real** | +0.34 noise  | +2.80 noise |
 *   | moe 2 + critical_mass 5       | **+21.80 real** | **-10.29 real** | **-7.90 real** |
 *   | scorch window 3s -> 5s        | **+18.54 real** | +5.22 noise  | +0.21 noise |
 *
 * THE MECHANISM IS A REGIME CHANGE AND IT IS ISOLATED. `moe 3->2` with the
 * freed point spent on a DEAD talent measures **+1.22 +/- 1.90 noise at 60s and
 * -28.29 +/- 6.70 REAL at 180s** -- so `master_of_elements`' third rank is worth
 * nothing in a minute and worth real DPS in three, because this build is
 * global-cooldown bound at 60s with 962 mana spare and **mana bound by 180s**.
 * `critical_mass` 5/5 is a gain at BOTH lengths (about +21 and +17); what fails
 * is paying for it out of the mana talent.
 *
 * AND THERE IS NO OTHER ROUTE TO IT. Fire needs 30 points to hold
 * `critical_mass` 5/5 without touching `master_of_elements`, which means Frost
 * 21 and a Fingers of Frost charge -- `-6.57 +/- 7.53` at 60s and
 * `-13.26 +/- 6.61` at 180s. **So no talent change in this file is a gain at
 * more than one fight length**, and the shipped 0/29/22 tree stands.
 *
 * THE DECIDING INSTRUCTION IS THE OWNER'S: *"rotations need to be built for
 * longer than 1 minute ... ensure that variable combat time is taken into
 * account."* A change that is +22 at the published clock and -10 at a realistic
 * one is optimising the clock rather than the profile.
 *
 * AND THE SCORCH WINDOW IS WITHHELD FOR A SECOND REASON: `scorchNeeded` is
 * SHARED with `MAGE_FIRE`, so moving `SCORCH_REFRESH_SECONDS` would silently
 * change a profile this round does not name -- and a Fire optimisation round is
 * running concurrently in another worktree. It is also the owner's own quoted
 * condition, from the commit titled "as the ruleset owner specified them".
 *
 * ------------------------------------------------------------------------------
 * AND HIT IS CAPPED, WHICH THE LADDER DENIES. `stat_weights PLAN=1` offers
 * "+5.00% to cap Spells" and that is Appendix B's artefact: `elemental_precision`
 * is declared `schools: ['frost', 'fire']` and this build takes it 5/5, so all
 * four of its spells carry school-scoped hit the ladder cannot see. The `avoid`
 * column on `probe_profile_report` reads **0.9% to 1.6% against a 1% floor**,
 * which is the reading to trust. **No group here buys hit.**
 * ==============================================================================
 */

import {
  type Apply,
  type Variant,
  MAGE_TREE as tree,
  apl,
  addAbove,
  addEntry,
  addPrecombat,
  chain,
  consumable,
  enchant,
  precombatLead,
  removeEntry,
} from './buildVariants';
import { all, selfStacks, selfTime, selfHas, targetStacks, targetTime, any, resourceFraction } from '../src/game/rotations/apl/shorthand';
import type { AplCondition } from '../src/game/rotations/apl';
import { HEATING_UP_MAX_STACKS, IMPROVED_SCORCH_MAX_STACKS } from '../src/game/auras/mage';
import { foreverEnchantId } from '../src/game/items/foreverEnchants';

/** Crusader's real Wowhead spell id, which `presetEnchants.ts` writes out as 20034. */
const CRUSADER_ENCHANT_SPELL_ID = 20034;

/* --------------------------------------------------------------- the tree */

/*
 * THE SHIPPED ALLOCATION, WRITTEN OUT IN FULL so every variant below is a whole
 * tree handed to `treeFor`, which throws rather than returning something
 * plausible. A delta cannot see a stranded tier.
 *
 * ------------------------------------------------------------------------------
 * BOTH TREES ARE TIGHT AT A TIER, WHICH IS MOST OF WHY THERE IS SO LITTLE
 * FREEDOM HERE. Counting STRICTLY BELOW, as `pointsBelowTier` does:
 *
 *   FIRE   below tier 15 = 1+3+5+5+1 = **exactly 15**, which is what reaches
 *          improved_scorch, heating_up and master_of_elements. Nothing in rows
 *          0-2 can be removed without costing three talents.
 *   FROST  below tier 20 = 5+5+(3+3+1)+3 = **exactly 20**, which is what reaches
 *          fingers_of_frost. So any two points taken out of Frost rows 0-3 drop
 *          the capstone as well -- `fingers_of_frost` itself is the only place
 *          in that tree a point can come from without a cascade.
 *
 * SO THE DESIGN SPACE IS: one in-tree Fire trade that costs nothing, and a
 * handful of swaps that each buy a Fire rank with a Fingers of Frost charge.
 * ------------------------------------------------------------------------------
 */
const CURRENT = {
  // Fire, 29
  improved_fire_blast: 1,
  incineration: 3,
  improved_fireball: 5,
  ignite: 5,
  pyroblast: 1,
  improved_scorch: 3,
  heating_up: 1,
  master_of_elements: 3,
  critical_mass: 4,
  fire_power: 3,
  // Frost, 22
  elemental_precision: 5,
  ice_shards: 5,
  piercing_ice: 3,
  frost_channeling: 3,
  ice_lance: 1,
  shatter: 3,
  fingers_of_frost: 2,
};

/*
 * ==============================================================================
 * `improved_fireball` IS NOT THE DEAD TALENT ITS NAME MAKES IT LOOK, AND READING
 * THE TOOLTIP IS THE ONLY WAY TO KNOW.
 *
 * "Reduces the casting time of your Fireball **and Frostfire Bolt** spells by
 * 0.5 sec." This build casts no Fireball at all -- so from the name, from the
 * list and from the damage table those five points read as pure tier tax. They
 * are the single largest talent in the build: half a second off a 2.5 second
 * cast on **42.2% of its damage**, and `mageEffects.ts` declares both clauses.
 *
 * NOTHING HERE MOVES A POINT OUT OF IT. Said in the file rather than left
 * implicit, because "the Frostfire build has five points in Fireball" is exactly
 * the kind of thing an optimiser reaches for first.
 *
 * ITS SIBLING IS THE ONE THAT IS ACTUALLY DEAD: `improved_frostbolt` is
 * "Frostbolt and Frost Blast" and names Frostfire Bolt nowhere, so the two
 * cast-time talents read identically from their names and only one of them pays.
 * ==============================================================================
 */

/**
 * ONE POINT FROM A 6% CRIT TALENT TO A COOLDOWN REDUCTION, INSIDE THE FIRE TREE.
 *
 * `incineration` is +6% crit on Fire Blast, Ice Lance, Arcane Blast and Scorch
 * at 3/3, of which this build casts two (13.7 casts a fight, 21.8% of damage).
 * `improved_fire_blast` is a second off Fire Blast's cooldown per rank.
 *
 * FIRE STAYS AT 29 AND FROST IS UNTOUCHED, which is what makes this the only
 * talent candidate with no cascade: below tier 15 is 2+2+5+5+1 = 15, still
 * exactly the fifteen the tree needs.
 */
const FIRE_BLAST_FOR_CRIT = { ...CURRENT, incineration: 2, improved_fire_blast: 2 };

/**
 * A FIRE RANK BOUGHT WITH A FINGERS OF FROST CHARGE. Fire 30 / Frost 21.
 *
 * `fingers_of_frost`'s rank IS the charge count -- `valueIndex: 1`, with the 15%
 * chance flat at both ranks -- so 2/2 to 1/2 halves the spells that get Shatter's
 * +50% crit, from about 4.8 a fight to 2.4. That is the price of every row in
 * this group that reads "Fire 30".
 */
const CRITICAL_MASS_5 = { ...CURRENT, critical_mass: 5, fingers_of_frost: 1 };
const FIRE_BLAST_2 = { ...CURRENT, improved_fire_blast: 2, fingers_of_frost: 1 };

/**
 * MANA FOR CRIT, INSIDE THE FIRE TREE AND WITH FROST UNTOUCHED.
 *
 * `master_of_elements` refunds 30% of base mana on a Fire or Frost crit at 3/3
 * and is **1137 mana a fight** on this build, against a headroom of 962 -- so
 * this is the candidate most likely to cost more than it looks.
 * Below tier 20 = 15+3+1+2 = 21 and below tier 25 = 26, both legal.
 */
const CRIT_FOR_MANA = { ...CURRENT, master_of_elements: 2, critical_mass: 5 };

/**
 * COMBUSTION, WHICH COSTS FIVE FROST POINTS RATHER THAN TWO.
 *
 * ------------------------------------------------------------------------------
 * `combustion` is tier 30 in Fire, so it wants **30 points strictly below it**
 * plus its own, and it requires `critical_mass` 5/5. That is Fire 31 and
 * therefore Frost 20 -- and Frost 20 cannot hold `fingers_of_frost` at all,
 * because that capstone wants exactly 20 points below IT.
 *
 * SO IT STRANDS SHATTER TOO. `shatter` is "+50% crit against Frozen targets" and
 * `fingers_of_frost` is the only thing in this ruleset that makes the Mage's
 * spells behave as though the target were -- so with Fingers gone, Shatter's
 * three points pay nothing. They are left IN rather than moved, because every
 * other Frost talent at that depth is equally dead for this build
 * (improved_frostbolt, permafrost, frostbite, improved_blizzard, arctic_reach),
 * so three points die whatever is written here and leaving Shatter makes the
 * diff legible.
 *
 * **THE TRADE IS THEREFORE: critical_mass +1 rank and Combustion, against
 * Fingers of Frost 2/2 and Shatter 3/3.** Combustion is +10% Fire crit per Fire
 * hit until three non-periodic Fire crits, on a 180 second cooldown -- so in a
 * 60 second fight it fires once and is also the row in this file most likely to
 * be worth more at a longer DURATION.
 * ------------------------------------------------------------------------------
 */
const COMBUSTION = {
  ...CURRENT,
  critical_mass: 5,
  combustion: 1,
  fingers_of_frost: 0,
};

/* ---------------------------------------------------------------- the list */

/** The Heating Up gate on the FIRST Pyroblast entry, as a function of stacks. */
const pyroblastAt = (stacks: number) =>
  apl((entries) =>
    entries.map((e, i) =>
      e.abilityId === 'pyroblast' && entries[i + 1]?.abilityId === 'pyroblast'
        ? { ...e, condition: selfStacks('exactly', stacks, 'heating_up') }
        : e,
    ),
  );

/** The SALVAGE Pyroblast's window, in seconds left on Heating Up. */
const salvageWindow = (seconds: number) =>
  apl((entries) =>
    entries.map((e, i) =>
      e.abilityId === 'pyroblast' && entries[i - 1]?.abilityId === 'pyroblast'
        ? {
            ...e,
            condition: all(
              selfStacks('exactly', 2, 'heating_up'),
              selfTime('atMost', seconds, 'heating_up'),
            ),
          }
        : e,
    ),
  );

/** Fire Blast's mana floor, which the shipped list shares with Evocation's gate. */
const fireBlastAbove = (percent: number) =>
  apl((entries) =>
    entries.map((e) =>
      e.abilityId === 'fire_blast'
        ? { ...e, condition: resourceFraction('above', percent / 100, 'mana') }
        : e,
    ),
  );

/** Scorch's refresh window, in seconds left on Fire Vulnerability. */
const scorchRefreshAt = (seconds: number) =>
  apl((entries) =>
    entries.map((e) =>
      e.abilityId === 'scorch'
        ? {
            ...e,
            condition: all(
              { kind: 'hasReaction', reactionId: 'improved_scorch' } as const,
              any(
                targetStacks('below', IMPROVED_SCORCH_MAX_STACKS, 'fire_vulnerability'),
                targetTime('atMost', seconds, 'fire_vulnerability'),
              ),
            ),
          }
        : e,
    ),
  );

/** Strip an entry's condition, keeping its position -- the inverse of `gate`. */
const ungate = (abilityId: string): Apply =>
  apl((entries) =>
    entries.map((e) => {
      if (e.abilityId !== abilityId) return e;
      const { condition: _dropped, ...rest } = e;
      return rest;
    }),
  );

/** Re-condition an entry in place, keeping its position. */
const gate = (abilityId: string, condition: AplCondition): Apply =>
  apl((entries) =>
    entries.map((e) => (e.abilityId === abilityId ? { ...e, condition } : e)),
  );

/** Ice Lance, gated on a charge being in hand, as it was before it was removed. */
const ICE_LANCE_ENTRY = { abilityId: 'ice_lance', condition: selfHas('fingers_of_frost') };

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /*
   * ==========================================================================
   * GATE B. **THE SHIPPED OPENER FINISHES TWO DAMAGING CASTS AND IS ILLEGAL.**
   *
   * The ruling: *"Once you deal damage or finish casting a damaging ability
   * combat has started."* So a pre-combat list may finish **at most one**
   * damaging ability, and it must finish at exactly t=0.
   *
   *   mage_armor       4.0s   not damaging, free at any lead
   *   frostfire_bolt   2.5s   DAMAGING, finishes -0.049s   <- the owner's line
   *   scorch           1.5s   DAMAGING, finishes -0.029s   <- a PROJECT addition
   *
   * Both deficits are the haste artefact on a lead written as the spell's
   * declared cast time, which is not a violation to fix. **B1 was the
   * violation: there were two of them.** `precombatOpeners.test.ts` records the
   * owner's opener as `[[4, 'mage_armor'], [2.5, 'frostfire_bolt']]` and the
   * Scorch as an addition worth "+25.1 -- one Fire Vulnerability stack at the
   * pull", so the owner's lines stayed and the addition went.
   *
   * THIS WAS THE ARCANE MAGE'S FAILURE A SECOND TIME, in a profile Appendix A
   * had already flagged as failing. Nothing in the engine enforces the rule, no
   * fight reveals it, and `USES=1` printed it as cheerfully as a legal opener.
   *
   * **THE PRESET IS LEGAL NOW, SO THE CONTROL IS THE LEGAL OPENER AND THE
   * ILLEGAL ONE IS A ROW.** The revert cost **-25.90 +/- 9.70** over 400 paired
   * iterations and the row below is how to re-read that figure.
   *
   * AND THE LEGAL DESIGN SPACE IS EMPTY. An addition has to be a NON-damaging
   * action, and this build's only non-damaging castables are `mage_armor`
   * (already there), `evocation` (a channel, refused outright) and two things
   * that are ALREADY off the global cooldown -- the Spellblasting potion and the
   * Gnome racial. **Pre-casting is only worth the GCD it saves**, which is the
   * retracted Arcane Power figure's whole lesson, and both measured
   * **BIT-IDENTICAL** at a 0s lead. Asserted rather than assumed: each variant's
   * precombat list was printed before the fights were run.
   * ==========================================================================
   */
  ffGateB: [
    { label: 'the shipped LEGAL opener -- the control', apply: (p) => p },
    {
      label: 'ILLEGAL: the pre-pull scorch restored (+25.90, and it is void)',
      apply: addPrecombat(1.5, 'scorch'),
    },
    {
      label: 'LEGAL + the potion at 0s (already off the GCD, so expect nothing)',
      apply: chain((p) => ({
        ...p,
        precombat: [...(p.precombat ?? []), { abilityId: 'major_spellblasting_potion', secondsBefore: 0 }],
      })),
    },
    {
      label: 'LEGAL + eureka at 0s (an 8s window, also already off the GCD)',
      apply: chain((p) => ({
        ...p,
        precombat: [...(p.precombat ?? []), { abilityId: 'eureka', secondsBefore: 0 }],
      })),
    },
    {
      label: 'LEGAL + mage_armor moved to a 0s lead',
      apply: chain(precombatLead('mage_armor', 0)),
    },
  ],

  /*
   * ==========================================================================
   * THE TREE. Both trees are tight at a tier, so almost every row costs a
   * Fingers of Frost charge -- see `CURRENT` for the arithmetic.
   *
   * MEASURED ON THE LEGAL OPENER, because a figure taken on the illegal one is
   * a figure about a build nobody may ship.
   * ==========================================================================
   */
  ffTalents: [
    { label: '0/29/22 -- the shipped tree, the control', apply: (p) => p },
    {
      label: 'incineration 3->2, improved_fire_blast 1->2  (Fire 29, NO Frost cost)',
      apply: chain(tree(FIRE_BLAST_FOR_CRIT)),
    },
    {
      label: 'critical_mass 4->5, fingers_of_frost 2->1  (Fire 30 / Frost 21)',
      apply: chain(tree(CRITICAL_MASS_5)),
    },
    {
      label: 'improved_fire_blast 1->2, fingers_of_frost 2->1  (Fire 30 / Frost 21)',
      apply: chain(tree(FIRE_BLAST_2)),
    },
    {
      label: 'master_of_elements 3->2, critical_mass 4->5  (mana for crit, Frost untouched)',
      apply: chain(tree(CRIT_FOR_MANA)),
    },
    {
      label: 'COMBUSTION: critical_mass 5/5 + combustion, fingers_of_frost 0 (strands shatter)',
      apply: chain(tree(COMBUSTION)),
    },
  ],

  /*
   * ==========================================================================
   * THE TRADE THAT WON, SWEPT RATHER THAN LEFT AT TWO READINGS.
   *
   * `master_of_elements` 3->2 with `critical_mass` 4->5 measured **+22.14 +/-
   * 6.73 REAL** on the legal build, which is the only talent row that gained
   * anything -- so the question is which half did the work and how far it goes.
   *
   * **`master_of_elements` 1/3 IS THE FLOOR AND IT IS A TIER FLOOR, NOT A
   * CHOICE.** Fire needs 20 points strictly below tier 20 to hold
   * `critical_mass`, and 15 + improved_scorch 3 + heating_up 1 = 19 of them, so
   * the talent's own rank is the twentieth. `master_of_elements: 0` strands
   * `critical_mass` and `fire_power` and `treeFor` refuses it.
   *
   * THE DECOMPOSITION ROWS SPEND THEIR FREED POINT ON `flame_throwing`, which
   * is a range talent and a permanent `positioning` ruling -- a deliberately
   * DEAD destination, so the row prices one change rather than two. That is the
   * Druid attribution lesson: a point removed to price a talent must not buy
   * anything, or the figure is two talents wearing one label.
   *
   * AND ONE ROW KEEPS FROST WHOLE WHILE BUYING BOTH FIRE RANKS:
   * `master_of_elements` 1 frees the point that `improved_fire_blast` 2 wants,
   * so Fire stays at 29 and the Fingers of Frost charge is never touched. Every
   * row in `ffTalents` that bought a Fire rank with that charge lost.
   * ==========================================================================
   */
  ffTalents2: [
    { label: '0/29/22 -- the shipped tree, the control', apply: (p) => p },
    {
      label: 'moe 3->2 + critical_mass 5  (the ffTalents winner, as the reference)',
      apply: chain(tree(CRIT_FOR_MANA)),
    },
    {
      label: 'moe 3->1 + critical_mass 5, the point DEAD in flame_throwing',
      apply: chain(tree({ ...CRIT_FOR_MANA, master_of_elements: 1, flame_throwing: 1 })),
    },
    {
      label: 'moe 3->1 + critical_mass 5 + improved_fire_blast 2  (Fire 29, FROST UNTOUCHED)',
      apply: chain(
        tree({ ...CRIT_FOR_MANA, master_of_elements: 1, improved_fire_blast: 2 }),
      ),
    },
    {
      label: 'moe 3->2 ALONE, the point DEAD -- isolates the mana loss',
      apply: chain(tree({ ...CURRENT, master_of_elements: 2, flame_throwing: 1 })),
    },
    {
      label: 'critical_mass 5 ALONE via moe 2, plus incineration 3->2 + improved_fire_blast 2',
      apply: chain(
        tree({
          ...CRIT_FOR_MANA,
          incineration: 2,
          improved_fire_blast: 2,
        }),
      ),
    },
  ],

  /*
   * ==========================================================================
   * THE APL. Six levers, and two of them are findings a previous round WROTE
   * DOWN AND LEFT FOR THIS ONE.
   *
   * MAGE ARMOR'S ENTRY IS DEAD AND THE OWNER HAS ALREADY RULED ON IT: "Mage
   * Armor doesn't need to be captured in the main APL section. It's being taken
   * care of in the pre-combat section." The Arcane list's own comment says the
   * other two Mage lists still carry theirs and that the ruling arrived as part
   * of an audit of the Arcane profile, "recorded here so the next Mage round
   * starts with it". **This is that round.** The entry is gated on
   * `selfExpired('mage_armor')`, the opener casts it at a 4s lead, the buff
   * lasts THIRTY MINUTES and nothing dispels -- so the gate is false from the
   * pull onward. `USES=1` reports it as 1.0 uses, which is the PRE-COMBAT cast
   * counted against the entry (Appendix B).
   *
   * AND EUREKA IS UNGATED HERE, WHICH THE SAME COMMENT PRICES AT +1.92 ON
   * ARCANE. The Gnome racial is an 8 second window of **+10% non-periodic**
   * damage; in the shared `RACIAL_COOLDOWNS` block it carries no condition, so
   * it is spent on whatever the first poll of the fight happens to be. Arcane
   * gated it on a Missile Barrage proc. Frostfire has no Missile Barrage, so the
   * candidates are its own two windows: three stacks of Heating Up, which is
   * when a Pyroblast is about to go, and Fingers of Frost, which is when
   * Shatter is paying.
   *
   * **NON-PERIODIC IS THE WORD THAT MATTERS**: Eureka does not raise Ignite,
   * which is 16.3% of this build, nor Pyroblast's burn -- only direct hits.
   * ==========================================================================
   */
  ffApl: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    {
      label: "mage_armor's dead entry removed (the owner's ruling; expect identical)",
      apply: chain(removeEntry('mage_armor')),
    },
    {
      label: 'eureka held for three Heating Up stacks (the Pyroblast window)',
      apply: chain(
        gate('eureka', selfStacks('atLeast', HEATING_UP_MAX_STACKS, 'heating_up')),
      ),
    },
    {
      label: 'eureka held for Fingers of Frost (the Shatter window)',
      apply: chain(gate('eureka', selfHas('fingers_of_frost'))),
    },
    {
      label: 'the Spellblasting potion held for three Heating Up stacks',
      apply: chain(
        gate(
          'major_spellblasting_potion',
          selfStacks('atLeast', HEATING_UP_MAX_STACKS, 'heating_up'),
        ),
      ),
    },
    /*
     * **THIS ROW IS VOID AND IS KEPT AS THE WORKED EXAMPLE.** `addEntry` appends,
     * and the last entry in this list is an UNGATED `frostfire_bolt` -- which is
     * a FLOOR under everything below it, so an entry added at the bottom can
     * never be the first castable one. It measured `IDENTICAL FIGHTS`, which
     * reads exactly like "worth nothing" and means "unreachable". See `ffApl2`
     * for the same candidate placed where the entry actually lived.
     *
     * "A NEW ENTRY GOES AT THE BOTTOM" IS A RULE ABOUT AN ENTRY THAT COSTS
     * SOMETHING -- it is the only position that cannot change what the list
     * already does, which is the same property that makes it useless here.
     */
    {
      label: 'VOID: ice lance at the BOTTOM, under the ungated filler -- unreachable',
      apply: chain(addEntry(ICE_LANCE_ENTRY)),
    },
  ],

  /*
   * ==========================================================================
   * THE APL, SECOND PASS: the Eureka gate swept, and Ice Lance placed where it
   * actually lived.
   *
   * BOTH EUREKA GATES WON AND THEY ARE INDISTINGUISHABLE FROM EACH OTHER --
   * +5.99 +/- 0.95 on Fingers of Frost against +5.83 +/- 2.67 on three Heating
   * Up stacks, a difference of 0.16 against a combined interval of 2.83. So the
   * question this group asks is whether a LOOSER gate -- either window -- beats
   * both, and whether the tight interval on the Fingers row is telling.
   *
   * THE INTERVALS ARE SMALL BECAUSE A GATE ON A FREE OFF-GCD COOLDOWN CANNOT
   * FLIP A ROLL -- it moves WHEN the window opens and nothing else, which is the
   * same reason the Arcane copy of this change measured +/- 0.28.
   * ==========================================================================
   */
  ffApl2: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    {
      label: 'eureka on Fingers of Frost (the +5.99 row, as the reference)',
      apply: chain(gate('eureka', selfHas('fingers_of_frost'))),
    },
    {
      label: 'eureka on EITHER window -- Fingers, or three Heating Up stacks',
      apply: chain(
        gate(
          'eureka',
          any(
            selfHas('fingers_of_frost'),
            selfStacks('atLeast', HEATING_UP_MAX_STACKS, 'heating_up'),
          ),
        ),
      ),
    },
    {
      label: 'eureka on two Heating Up stacks (a looser Pyroblast window)',
      apply: chain(gate('eureka', selfStacks('atLeast', 2, 'heating_up'))),
    },
    {
      label: 'ICE LANCE BACK IN, above fire_blast where it lived -- removed for +74.1',
      apply: chain(addAbove(ICE_LANCE_ENTRY, 'fire_blast')),
    },
    {
      label: 'ice lance above the SALVAGE pyroblast, so it outranks both',
      apply: chain(addAbove(ICE_LANCE_ENTRY, 'pyroblast')),
    },
  ],

  /*
   * ==========================================================================
   * THE OWNER'S OWN FOUR CONSTANTS, SWEPT RATHER THAN COMPARED.
   *
   * "Sweep a parameter, do not compare two readings somebody wrote down" -- the
   * Eviscerate gate's two previously-compared values were the two WORST cells
   * with +10.8 between them.
   *
   * ALL FOUR OF THESE ARE THE OWNER'S NUMBERS, so a marginal win is a QUESTION
   * and not an edit: their list outranks a measured decision of ours, and the
   * measurement stays as the price of the choice.
   *
   *   pyroblast gate       exactly 3 Heating Up stacks
   *   salvage window       2 stacks with 3.5 seconds left
   *   fire_blast floor     above 10% mana, shared with Evocation's gate
   *   scorch refresh       3 seconds left on Fire Vulnerability
   * ==========================================================================
   */
  ffSweep: [
    { label: "the owner's four constants -- the control", apply: (p) => p },
    {
      label: 'salvage window 3.5s -> 2.0s',
      apply: chain(salvageWindow(2)),
    },
    {
      label: 'salvage window 3.5s -> 5.0s',
      apply: chain(salvageWindow(5)),
    },
    {
      label: 'salvage window 3.5s -> 8.0s',
      apply: chain(salvageWindow(8)),
    },
    {
      label: 'fire_blast floor 10% -> 0% (ungated)',
      apply: chain(fireBlastAbove(0)),
    },
    {
      label: 'fire_blast floor 10% -> 20%',
      apply: chain(fireBlastAbove(20)),
    },
    {
      label: 'fire_blast floor 10% -> 30%',
      apply: chain(fireBlastAbove(30)),
    },
    {
      label: 'scorch refresh 3s -> 1.5s',
      apply: chain(scorchRefreshAt(1.5)),
    },
    {
      label: 'scorch refresh 3s -> 5s',
      apply: chain(scorchRefreshAt(5)),
    },
    {
      label: 'pyroblast gate 3 stacks -> 2 (and the salvage entry becomes dead)',
      apply: chain(pyroblastAt(2)),
    },
  ],

  /*
   * ==========================================================================
   * SCORCH'S REFRESH WINDOW IS NOT A FIRE VULNERABILITY LEVER. IT IS A PYROBLAST
   * GENERATOR, AND THAT IS WHY IT SWEPT THE WAY IT DID.
   *
   * ------------------------------------------------------------------------------
   * `ffSweep` found the owner's 3-second window at **-33.36** when tightened to
   * 1.5s and **+18.88 +/- 7.54 REAL** when loosened to 5s, which reads backwards
   * for a maintenance debuff that already sits at 99.9% uptime. The mechanism is
   * next door and has nothing to do with the debuff:
   *
   *   `HEATING_UP_TRIGGERS` is `['fireball', 'frostfire_bolt', 'fire_blast',
   *   'scorch']` and the reaction is `outcomes: ['crit']`.
   *
   * **SO EVERY SCORCH CRIT IS A HEATING UP STACK**, and three stacks is a
   * Pyroblast at a quarter of its cast time -- 19.7% of this build's damage on
   * 4.6 casts. Scorch is the cheapest and fastest of the four triggers (1.5s
   * against Frostfire Bolt's 2.5s) and measures the second-highest crit rate in
   * the build at 34.2%, so widening its window buys Pyroblasts.
   *
   * WHICH MEANS THE WINDOW IS A PROXY FOR THE THING ACTUALLY WANTED, so this
   * group sweeps it to the debuff's full 30-second duration -- at which point
   * `atMost 30` is always true, Scorch becomes an UNGATED entry above everything
   * else, and the list casts nothing else. That end-point is in the sweep on
   * purpose: it is where the proxy breaks.
   *
   * AND IT ASKS THE DIRECT QUESTION TOO -- "Scorch while Heating Up is below
   * three stacks" -- which is what the mechanism says rather than what the
   * debuff timer approximates.
   *
   * THE SALVAGE PYROBLAST NEVER FIRES. Its window measured BIT-IDENTICAL at
   * 2.0s, 5.0s and 8.0s against the owner's 3.5s, and the patch was verified to
   * have applied by printing the compiled conditions. Three identical rows is
   * normally this project's tell for a patch that did not land, so the row below
   * removes the entry outright: if THAT is bit-identical too, the entry is
   * unreachable rather than merely insensitive. **It is the owner's entry, so
   * this is a question for them and not an edit.**
   * ==========================================================================
   */
  ffScorch: [
    { label: "scorch refresh at 3s -- the owner's number, the control", apply: (p) => p },
    { label: 'scorch refresh 5s  (the ffSweep winner, as the reference)', apply: chain(scorchRefreshAt(5)) },
    { label: 'scorch refresh 7s', apply: chain(scorchRefreshAt(7)) },
    { label: 'scorch refresh 10s', apply: chain(scorchRefreshAt(10)) },
    { label: 'scorch refresh 14s', apply: chain(scorchRefreshAt(14)) },
    { label: 'scorch refresh 20s', apply: chain(scorchRefreshAt(20)) },
    {
      label: 'scorch refresh 30s = the full duration, so UNGATED and a floor',
      apply: chain(scorchRefreshAt(30)),
    },
    {
      label: 'DIRECT: scorch while heating_up is below 3 stacks (or the debuff needs it)',
      apply: chain(
        gate(
          'scorch',
          all(
            { kind: 'hasReaction', reactionId: 'improved_scorch' } as const,
            any(
              targetStacks('below', IMPROVED_SCORCH_MAX_STACKS, 'fire_vulnerability'),
              targetTime('atMost', 3, 'fire_vulnerability'),
              selfStacks('below', HEATING_UP_MAX_STACKS, 'heating_up'),
            ),
          ),
        ),
      ),
    },
    {
      label: "the SALVAGE pyroblast entry REMOVED -- does the owner's entry ever fire?",
      apply: chain(
        apl((entries) => {
          const at = entries.findIndex(
            (e, i) => e.abilityId === 'pyroblast' && entries[i - 1]?.abilityId === 'pyroblast',
          );
          if (at < 0) throw new Error('no salvage pyroblast entry to remove');
          return entries.filter((_, i) => i !== at);
        }),
      ),
    },
  ],

  /*
   * ==========================================================================
   * ENCHANTS. **MOST OF THIS DIMENSION IS SETTLED BY ARITHMETIC AND ONLY THE
   * WEAPON NEEDS A FIGHT.**
   *
   * `PROFILE=mage_frostfire ITERATIONS=1500 STATS=... stat_weights.ts`, 13,500
   * fights, baseline 1051.4:
   *
   *   Haste          12.1862 per 1%     +-1.8671
   *   Crit rating    12.0770 per 1%     +-2.3805
   *   Spell power     0.7832 per point  +-0.0048
   *   Intellect       0.2563 per point  +-0.0671
   *   Agility         0.0000            nothing: this build cannot read it
   *   Stamina         0.0000            nothing: this build cannot read it
   *   Spirit         -0.0029            not measured: the interval swallows it
   *   Mana per 5     -0.0051            not measured: the interval swallows it
   *
   * **SO TWO OF THE TEN ARMOUR SLOTS HAVE NO LIVE OPTION AT ALL**, and the inert
   * enchants sitting in them are correct rather than an oversight:
   *
   *   cloak   +1% Dodge, +5 Agility, +60 Armor, -2% Threat   -- all four are 0
   *   feet    +4 Defense Skill, Minor Speed, +7 Agility, +7 Stamina -- all 0
   *
   * Dodge, armor and defense skill are unreadable because nothing attacks this
   * build; threat is a permanent ruling; Minor Speed is `unmodelled`; and agility
   * and stamina weigh ZERO. The shipped `-2% Threat` and `Minor Speed` are
   * therefore as good as anything the slot offers. **A correct enchant can be
   * worth nothing**, and these two slots are where that is structural.
   *
   * AND EVERY LIVE SLOT IS ALREADY ON ITS BEST OPTION, by the same table:
   *
   *   head    +1% Haste 12.19  >  +8 Intellect 2.05  >  agi/sta/spi 0
   *   legs    +1% Haste 12.19  >  the same set
   *   gloves  +20 Spell Power 15.66  >  +1% Haste 12.19  >  the rest 0
   *   wrists  +16 Spell Power 12.53  >  everything else 0
   *   neck    +6 Spell Power 4.70   >  everything else 0
   *   chest   +4 Stats 1.03 (only the intellect counts)  >  +4 Defense 0
   *
   * THE GLOVES ROW IS THE CLOSEST CALL -- 15.66 against 12.19, which is 3.47
   * against intervals of 0.10 and 1.87 -- so it is settled but not by much, and
   * it is the one to re-read if spell power or haste moves.
   *
   * **THE WEAPON IS THE ONLY ROW A TABLE CANNOT ANSWER.** `twoHand` offers +65
   * Spell Power (= 50.9 by the table), +25 Agility (= 0), Crusader and
   * REVELATION -- and the last two are procs. Revelation triggers "when a
   * non-periodic spell fails to critically strike" and grants the next spell
   * 100 points of `spellCritChance`, i.e. a guaranteed crit; this build casts
   * 34 spells a fight at about 31-39% crit, so it fails to crit roughly twenty
   * times. **Its chance diminishes as crit rises**, which is exactly what the
   * fight has to price. The two rows below the weapon are sanity checks that the
   * weight table predicts a real fight.
   * ==========================================================================
   */
  ffEnchants: [
    { label: 'the shipped loadout -- the control (+65 Spell Power on the staff)', apply: (p) => p },
    {
      label: 'STAFF: +65 Spell Power -> REVELATION (a proc, so the table cannot price it)',
      apply: chain(enchant('twoHand', foreverEnchantId('Revelation'))),
    },
    {
      label: 'STAFF: +65 Spell Power -> Crusader (a MELEE proc, as a control)',
      apply: chain(enchant('twoHand', CRUSADER_ENCHANT_SPELL_ID)),
    },
    {
      label: 'STAFF: +65 Spell Power -> +25 Agility (the table says 0.00)',
      apply: chain(enchant('twoHand', foreverEnchantId('+25 Agility'))),
    },
    {
      label: 'cloak: -2% Threat -> +5 Agility (the only other live-looking option)',
      apply: chain(enchant('cloak', foreverEnchantId('+5 Agility'))),
    },
    {
      label: 'feet: Minor Speed -> +7 Agility',
      apply: chain(enchant('feet', foreverEnchantId('+7 Agility'))),
    },
    {
      label: 'gloves: +20 Spell Power -> +1% Haste (15.66 against 12.19 -- the close call)',
      apply: chain(enchant('gloves', foreverEnchantId('+1% Haste'))),
    },
    {
      label: 'head: +1% Haste -> +8 Intellect (12.19 against 2.05 -- expect a REAL loss)',
      apply: chain(enchant('head', foreverEnchantId('+8 Intellect'))),
    },
  ],

  /*
   * ==========================================================================
   * CONSUMABLES. The twelve stat rows are a layer of the STARTING stat block,
   * so the stat weight table settles them with no fight; the two ACTION rows
   * need fights, and those are the only ones here.
   *
   * THE SHIPPED ROWS ARE `casterConsumables('school_fire')` -- and school_fire
   * is correct rather than lucky: Frostfire Bolt declares `school: 'fire'` and
   * reaches Frost only through `countsAsSchools`, which school-scoped SPELL
   * POWER deliberately does not read. The ability's own `unmodelled` entry says
   * so. So the 42.2% of this build's damage that is Frostfire Bolt does collect
   * the Fire pool.
   *
   * `other` IS THE DEMONIC RUNE AT 0.7 CASTS AND `potion` IS SPELLBLASTING AT
   * 1.0, which is the written-down rule already satisfied: `other` takes the
   * pool the build runs out of and `potion` takes the damage buff. The rows
   * below test whether a nearly-mana-bound build wants the mana potion instead,
   * which is the pairing that INVERTED on the Firelock.
   * ==========================================================================
   */
  ffConsumables: [
    { label: 'the shipped rows -- the control', apply: (p) => p },
    {
      label: 'potion: Spellblasting -> Major Mana (headroom is only 962)',
      apply: chain(consumable('potion', 'major_mana_potion')),
    },
    {
      label: 'school spell power: fire -> frost (the wrong pool, as a control)',
      apply: chain(consumable('school_spell_power', 'school_frost')),
    },
  ],
  /*
   * ==========================================================================
   * THE KNOCK-ON. **TWO WINNERS MEASURED SEPARATELY AGAINST THE SAME BASELINE
   * DO NOT ADD, AND THEY CAN INVERT.**
   *
   * What this round has to ship, each measured alone on the legal build:
   *
   *   critical_mass 4->5 via master_of_elements 3->2   **+22.14 +/- 6.73 real**
   *   eureka gated on Fingers of Frost                 **+5.99 +/- 0.95 real**
   *   mage_armor's dead entry removed                  **BIT-IDENTICAL**
   *
   * AND THE TALENT CHANGE IS EXACTLY THE KIND THAT MOVES THE OTHER TWO. It adds
   * 2% Fire crit, and Heating Up is granted by a CRIT of Scorch, Fire Blast or
   * Frostfire Bolt -- so more crit is more Pyroblasts, which changes when the
   * Eureka window is worth opening. It also gives up a third of
   * `master_of_elements`' mana refund on a build whose headroom is 962, so the
   * last row re-asks the Eureka question with the talents already changed.
   *
   * THE OWNER'S SCORCH WINDOW IS PRICED ON TOP RATHER THAN SHIPPED. It is their
   * stated condition and `scorchNeeded` is SHARED with the Fire list, so moving
   * it would silently change a profile this round does not name. The row is here
   * so the question carries a figure taken on the build that ships.
   * ==========================================================================
   */
  ffCombined: [
    { label: 'the SHIPPED build -- legal opener, eureka gated, mage_armor out', apply: (p) => p },
    {
      label: 'WITHHELD: critical_mass 5 via master_of_elements 2',
      apply: chain(tree(CRIT_FOR_MANA)),
    },
    {
      label: 'WITHHELD: critical_mass 5 via a Fingers charge instead (keeps the mana)',
      apply: chain(tree(CRITICAL_MASS_5)),
    },
    {
      label: "WITHHELD: the owner's scorch window 3s -> 5s (shared with the FIRE list)",
      apply: chain(scorchRefreshAt(5)),
    },
    {
      label: 'eureka on three Heating Up stacks instead of Fingers of Frost',
      apply: chain(gate('eureka', selfStacks('atLeast', HEATING_UP_MAX_STACKS, 'heating_up'))),
    },
    {
      label: 'eureka UNGATED again -- what the shipped gate is worth, from the other side',
      apply: chain(ungate('eureka')),
    },
  ],
};
