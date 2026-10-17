/*
 * ==============================================================================
 * THE VARIANTS `probe_build.ts` MEASURES ON THE TWO SHAMANS.
 *
 * Written for the owner's six-profile optimisation pass. Client build
 * 1.60.1.70425 removed Call of Thunder, added the ELEMENTAL MASTERY capstone,
 * moved Lava Burst from row 6 to row 4 and renamed Improved Fire Nova -- and
 * Call of Flame's nine seconds of Flame Shock duration were implemented in the
 * same round, which changed what the Elemental list spends its time on.
 *
 * ------------------------------------------------------------------------------
 * "THE ELEMENTAL BUILD IS CAST-BOUND AND NOT MANA-BOUND" WAS THIS FILE'S
 * HEADLINE FINDING AND IT WAS A FACT ABOUT A SIXTY SECOND FIGHT.
 *
 * It was measured honestly: CONVECTION 5/5 is "10% off Shock, Lightning Bolt,
 * Lava Burst and Chain Lightning", bought with ten dead points, and it measured
 * **-0.18 against an interval of 1.63** -- with the cast counts IDENTICAL to the
 * decimal. The mana was saved and there was nothing to spend it on. True, and
 * true only at the one length every profile here carries.
 *
 * RUN LONGER, THE SAME BUILD COLLAPSES: **802 DPS at 60s, 546 at 180s, 465 at
 * 300s**, with mana headroom falling from 14.3% to **1.3%**. It empties the pool
 * inside the first minute and then stands still. Convection re-measured at 180s
 * is **+19.05 +/- 2.35**, and the sentence above had closed the whole question.
 *
 * SO THE LESSON IS NOT "that finding was wrong" -- it is that a regime claim is
 * a claim ABOUT A CLOCK, and `probe_build.ts` applies the same clock to the
 * baseline and to every variant, so the clock itself can never appear in a
 * verdict. `tools/probe_clock.ts` is what reads it.
 *
 * ------------------------------------------------------------------------------
 * AND HASTE ON THIS PROFILE IS NOT A WEIGHT AT ALL. `stat_weights` prices +1%
 * at **-15.12 +/- 0.77** at 180s and a paired swap taking the same 2% back OFF
 * measures **-22.58**: both directions lose, which no slope can express. Swept
 * finely the shape is a small POSITIVE slope with a step of about -10 on top,
 * and the step is a SEARING TOTEM boundary -- 35.0 totem ticks at haste ratings
 * 0, 9, 10, 11, 30 and 60, and **37.7 at 19, 20 and 21**, which is what the
 * build wears. `tools/probe_stat_sweep.ts` carries the figures.
 *
 * THAT IS WHY `elementalHaste` BELOW EXISTS AND WHY ITS ANSWER IS "LEAVE IT".
 * Every swap off the two haste enchants loses by 22 to 28 at 180s, and that
 * figure is the artefact rather than the stat. The procedure's rule that "most
 * enchants are pure stats, so the stat weight table answers them without a
 * fight" has an exception here, and neither route resolves it.
 *
 * ------------------------------------------------------------------------------
 * AND ITS HIT IS EXACTLY AT THE CAP, WITH A TALENT HOLDING IT THERE. 16.00
 * points against a usable spell cap of 16 -- 17% miss floored at 1% -- and
 * TIDAL FOCUS supplies five of them. So the five Restoration points that look
 * like filler are the difference between 1% and 6% spell miss, which is why no
 * variant here touches them. The three Mages and the Shadow Priest sit at 11
 * and make it up with SCHOOL-scoped hit; the Elemental Shaman's is school-blind
 * and comes from this talent.
 *
 * ------------------------------------------------------------------------------
 * THE ENHANCEMENT BUILD IS A PHYSICAL BUILD WEARING A CASTER'S TREE: Main Hand
 * Auto-Attack 38.3% plus Windfury Attack 22.4% is 61% of it, against Stormstrike
 * 12.8%, Fire Nova 7.7%, Searing Totem 6.2% and Earth Shock 6.1%. Lightning
 * Bolt is 1.2% on 1.8 casts.
 *
 * AND ALMOST NOTHING ON IT MOVED: its list was measured entry by entry and
 * every removal lost -- Fire Nova by **69.6**, even after the client cut its
 * damage 44%. Its one gain was a dead boot enchant, +1.9.
 * ==============================================================================
 */
import {
  type Variant,
  SHAMAN_TREE as tree,
  addAbove,
  apl,
  addPrecombat,
  chain,
  consumable,
  enchant,
  moveAbove,
  precombatLead,
  removeEntry,
  removePrecombat,
} from './buildVariants';
import {
  all,
  any,
  not,
  onCooldown,
  resource,
  resourceFraction,
  targetHas,
  targetTime,
} from '../src/game/rotations/apl';

/* ------------------------------------------------------------ the APL edits */

/**
 * One Earth Shock entry, above Lightning Bolt, with up to two gates.
 *
 * ==============================================================================
 * A BUILDER RATHER THAN NINE HAND-WRITTEN ENTRIES, because nine copies of a
 * condition tree is nine places for a threshold to be typed wrong -- and a
 * sweep whose cells differ by a typo reads as a flat parameter. The Rogue's
 * Slice and Dice sweep came back identical to the decimal for exactly that
 * class of reason.
 *
 * `mana` IS A FRACTION OF THE POOL AND `flameShockSeconds` IS A FLOOR ON THE
 * BURN. Both omitted is the ungated cell, which is the one already measured at
 * -30.3 and is re-taken here so the sweep carries its own control.
 *
 * ABOVE `lightning_bolt`, which `addAbove` places it immediately before --
 * below Lava Burst, because the bolt is this list's unconditional filler and an
 * entry under it can never be the first castable one.
 * ==============================================================================
 */
/**
 * A MANA FLOOR ON THE FILLER, which is the fix for an expensive entry being
 * starved from beneath by a cheap one.
 *
 * ==============================================================================
 * PRIORITY DOES NOT RESERVE A RESOURCE. Flame Shock sits ABOVE Lightning Bolt
 * and is still starved by it: the list checks the shock, is refused for cost,
 * and walks straight past to something affordable. That is the behaviour
 * CLAUDE.md names for the Rogue's Ambush under a 35-energy Hemorrhage -- and
 * the fix there was a condition on the CHEAP entry rather than a reorder,
 * because position was never the problem.
 *
 * IT IS INVISIBLE AT 60s AND COSTS HALF THE DEBUFF BY 300s. Flame Shock's
 * uptime reads **96.8% at 60s, 64.1% at 180s and 53.7% at 300s**, and Lava
 * Burst is gated on the shock being on the target -- so the clock takes a
 * maintenance entry and a cooldown entry together.
 *
 * TWO SHAPES, BECAUSE IDLING IS NOT FREE:
 *
 *   `fillerFloor`       refuse the filler below N mana, full stop. Simple, and
 *                       it idles a global cooldown even when nothing better is
 *                       waiting for the pool
 *   `fillerFloorSmart`  refuse it only when something better IS pending -- the
 *                       shock down, or Lava Burst off cooldown. Costs nothing
 *                       when both are satisfied
 *
 * SWEPT, NOT GUESSED. Flame Shock costs 369 with Convection 5/5 and Lightning
 * Bolt 198, so "enough for the shock after this bolt" is about 567 -- which is
 * an argument for a starting point and not for a value.
 * ==============================================================================
 */
const fillerFloor = (mana: number) =>
  apl((entries) =>
    entries.map((entry) =>
      entry.abilityId === 'lightning_bolt'
        ? { ...entry, condition: resource('atLeast', mana, 'mana') }
        : entry,
    ),
  );

const fillerFloorSmart = (mana: number) =>
  apl((entries) =>
    entries.map((entry) =>
      entry.abilityId === 'lightning_bolt'
        ? {
            ...entry,
            condition: any(
              all(targetHas('flame_shock'), not(onCooldown('lava_burst'))),
              resource('atLeast', mana, 'mana'),
            ),
          }
        : entry,
    ),
  );

/** Chain Lightning above the filler, with a mana floor of its own. */
const chainLightning = (mana?: number) =>
  addAbove(
    {
      abilityId: 'chain_lightning',
      ...(mana === undefined ? {} : { condition: resource('atLeast', mana, 'mana') }),
    },
    'lightning_bolt',
  );

const earthShock = (mana?: number, flameShockSeconds?: number) => {
  const gates = [
    ...(mana === undefined ? [] : [resourceFraction('atLeast', mana, 'mana')]),
    ...(flameShockSeconds === undefined
      ? []
      : [targetTime('atLeast', flameShockSeconds, 'flame_shock')]),
  ];
  return addAbove(
    {
      abilityId: 'earth_shock',
      ...(gates.length === 0 ? {} : { condition: gates.length === 1 ? gates[0] : all(...gates) }),
    },
    'lightning_bolt',
  );
};

/* --------------------------------------------------------------- the trees */

/**
 * ELEMENTAL, with the ten dead points moved to Convection and Reverberation.
 *
 * KEPT AS A MEASURED NEGATIVE RATHER THAN DELETED. `elemental_warding` 3 is
 * damage taken on a profile nothing attacks, `eye_of_the_storm` 3 is cast
 * pushback, `elemental_reach` 2 is range and `trial_by_fire` 2 is Fire Nova,
 * which the Elemental list never casts -- ten points that provably do nothing.
 * They still measured as NOISE when moved, because the only things left to buy
 * in the tree are MANA, and this build has mana to spare.
 *
 * **TEN DEAD POINTS WITH NOWHERE LIVE TO GO IS A STATEMENT ABOUT THE TREE**,
 * not a failure of the search, and it is the reason this variant is here: a
 * reader who finds Elemental Warding in the owner's spread should see that
 * moving it was tried and measured rather than assume nobody looked.
 */
const ELEMENTAL_NO_DEAD_POINTS = {
  // Elemental, 32
  convection: 5,
  concussion: 5,
  reverberation: 5,
  elemental_alacrity: 3,
  call_of_flame: 3,
  elemental_focus: 1,
  lava_burst: 1,
  lightning_overload: 3,
  elemental_fury: 5,
  elemental_mastery: 1,
  // Enhancement, 6
  thundering_strikes: 5,
  ancestral_knowledge: 1,
  // Restoration, 13
  tidal_focus: 5,
  totemic_focus: 5,
  mindfulness: 3,
};

/**
 * ELEMENTAL, trading the near-dead Restoration filler for +8% Intellect.
 *
 * `totemic_focus` is 25% off a totem cast twice a fight and `mindfulness` is
 * threat; ANCESTRAL KNOWLEDGE is +2% Intellect a rank at Enhancement tier 0, so
 * four of those eight points become +8% Intellect without disturbing a single
 * tier gate. Worth **+2.95 +/- 0.63** -- small, real, and the only talent move
 * on this profile that measured as anything at all. It is the shipped spread.
 */
const ELEMENTAL_INTELLECT = {
  // Elemental, 32 -- unchanged from the owner's spread
  concussion: 5,
  elemental_warding: 3,
  call_of_flame: 3,
  elemental_focus: 1,
  elemental_alacrity: 3,
  trial_by_fire: 2,
  eye_of_the_storm: 3,
  elemental_mastery: 1,
  elemental_reach: 2,
  lightning_overload: 3,
  elemental_fury: 5,
  lava_burst: 1,
  // Enhancement, 10
  thundering_strikes: 5,
  ancestral_knowledge: 5,
  // Restoration, 9
  tidal_focus: 5,
  totemic_focus: 4,
};

/** The control: Ancestral Knowledge back at 1, the filler back in Restoration. */
const ELEMENTAL_OWNER_SPREAD = {
  ...ELEMENTAL_INTELLECT,
  ancestral_knowledge: 1,
  totemic_focus: 5,
  mindfulness: 3,
};

/*
 * ==============================================================================
 * MINDFULNESS, WHICH THE SPREAD ABOVE MOVED THREE POINTS *OUT* OF ON A RULING
 * THAT BELONGED TO THE TALENT NEXT DOOR.
 *
 * The owner's own spread spends 3 there. The round that moved them recorded
 * "`totemic_focus` is 25% off a totem cast twice a fight and `mindfulness` is
 * threat" and measured **+2.95 +/- 0.63** for the move -- correct arithmetic on
 * a talent that did nothing, because `mindfulness` was declared
 * `scope: 'threat'` with the reason "Threat, which the engine does not track."
 * That sentence is `natural_grace`'s tooltip, one talent across in the same
 * tier. See `shamanEffects.ts`.
 *
 * WHAT IT ACTUALLY SAYS IS "Allows 17/33/50% of your Mana regeneration to
 * continue while casting", and this build regenerates **ZERO** mana in a fight:
 * 163.65 MP5 suppressed by the five second rule from the pull to the end.
 *
 * SO THE THREE SPREADS BELOW ARE THREE WAYS TO PAY FOR IT, and which point is
 * cheapest is the question:
 *
 *   out of TOTEMIC FOCUS   same tier, same tree. 25% off a 170-mana totem cast
 *                          twice -- about 68 mana a fight against what 50%
 *                          bypass is worth
 *   out of ANCESTRAL       the +2.95 the earlier round bought. +2% Intellect a
 *   KNOWLEDGE              rank is a bigger POOL; mindfulness is a bigger FLOW
 *   the OWNER'S SPREAD     both at once, which is where they started
 * ==============================================================================
 */

/** Mindfulness 3 paid for out of Totemic Focus, Ancestral Knowledge kept at 5. */
const ELEMENTAL_MINDFULNESS_FROM_TOTEMS = {
  ...ELEMENTAL_INTELLECT,
  totemic_focus: 1,
  mindfulness: 3,
};

/** Mindfulness 1 and 2, the same way -- the rank sweep. */
const ELEMENTAL_MINDFULNESS_1 = { ...ELEMENTAL_INTELLECT, totemic_focus: 3, mindfulness: 1 };
const ELEMENTAL_MINDFULNESS_2 = { ...ELEMENTAL_INTELLECT, totemic_focus: 2, mindfulness: 2 };

/** Mindfulness 3 paid for out of Ancestral Knowledge, the totems kept at 4. */
const ELEMENTAL_MINDFULNESS_FROM_INTELLECT = {
  ...ELEMENTAL_INTELLECT,
  ancestral_knowledge: 2,
  mindfulness: 3,
};

/*
 * MINDFULNESS *AND* CONVECTION, which is the knock-on check and needs both of
 * this pass's findings at once. Convection measured NOISE when it was last
 * asked, on the finding that the build is cast-bound -- true at 60s and false
 * at every longer length, where headroom falls to 1.0%. Ten points that are
 * provably dead go to Convection 5 and Reverberation 5, and three more to
 * Mindfulness out of Totemic Focus.
 *
 * MOVING A POINT *DOWN* A TREE IS ALWAYS LEGAL, which is what makes this
 * spread possible at all: the Elemental tree sits exactly on every one of its
 * tier gates -- 15 below tier 15, 20 below 20, 26 below 25, 31 below 30 -- so
 * no point can come out of a tier the capstone needs, and every one of these
 * lands in tier 0 or tier 5.
 */
/*
 * THE TEN DEAD POINTS TO CONVECTION ALONE, AND TO REVERBERATION ALONE, which is
 * what splits the combined spread above into its parts. MARGINAL values do not
 * sum and can exceed the total, so these are "what this one is worth with the
 * others absent" and not addends.
 */
const ELEMENTAL_CONVECTION_ONLY = {
  // Elemental, 32 -- five dead points to Convection, five left where they were
  concussion: 5,
  convection: 5,
  elemental_alacrity: 3,
  call_of_flame: 3,
  elemental_focus: 1,
  elemental_warding: 3,
  trial_by_fire: 2,
  lightning_overload: 3,
  elemental_fury: 5,
  lava_burst: 1,
  elemental_mastery: 1,
  // Enhancement, 10
  thundering_strikes: 5,
  ancestral_knowledge: 5,
  // Restoration, 9
  tidal_focus: 5,
  totemic_focus: 4,
};

const ELEMENTAL_REVERBERATION_ONLY = {
  ...ELEMENTAL_CONVECTION_ONLY,
  convection: 0,
  reverberation: 5,
};

/** Convection 5 and Mindfulness 3, with no Reverberation -- the pair that pays. */
const ELEMENTAL_CONVECTION_AND_MINDFULNESS = {
  ...ELEMENTAL_CONVECTION_ONLY,
  totemic_focus: 1,
  mindfulness: 3,
};

const ELEMENTAL_MANA_EVERYTHING = {
  // Elemental, 32 -- the ten dead points to Convection and Reverberation
  concussion: 5,
  convection: 5,
  elemental_alacrity: 3,
  call_of_flame: 3,
  reverberation: 5,
  elemental_focus: 1,
  lightning_overload: 3,
  elemental_fury: 5,
  lava_burst: 1,
  elemental_mastery: 1,
  // Enhancement, 10
  thundering_strikes: 5,
  ancestral_knowledge: 5,
  // Restoration, 9
  tidal_focus: 5,
  totemic_focus: 1,
  mindfulness: 3,
};

/* -------------------------------------------------------------- the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /*
   * ------------------------------------------------------------------------------
   * THE HISTORICAL SPREADS, KEPT SO EVERY FIGURE ABOVE CAN BE RE-DERIVED -- and
   * their labels are what this round's own mistake was about, so they say which
   * build they are rather than what they once changed.
   *
   * `ELEMENTAL_INTELLECT` IS NOW THE PRE-ROUND SHIPPED SPREAD, so it prices the
   * whole of what round 27 shipped: **-1.01 +/- 2.09 noise at 60s, -84.08 +/-
   * 2.84 at 180s, -80.89 +/- 2.20 at 300s**, measured against the current
   * baseline. It was labelled "ancestral_knowledge 1 -> 5" -- true of the round
   * that wrote it and silent about what it is now.
   * ------------------------------------------------------------------------------
   */
  elementalTalents: [
    {
      label: 'the PRE-ROUND-27 spread: no mindfulness, no convection',
      apply: tree(ELEMENTAL_INTELLECT),
    },
    { label: "the owner's original spread -- ak 1, totems 5, mindfulness 3", apply: tree(ELEMENTAL_OWNER_SPREAD) },
    {
      label: '10 dead points -> convection 5 + reverberation 5 (the 60s-only reading)',
      apply: tree(ELEMENTAL_NO_DEAD_POINTS),
    },
    { label: 'the shipped spread -- the control', apply: (p) => p },
  ],

  /*
   * THE ELEMENTAL LIST. Elemental Mastery's entry is worth **+24.4** and is
   * shipped; these are the questions left after it. Both maintenance entries
   * are load-bearing -- Searing Totem by 80.4 and Flame Shock by 32.9 -- and
   * Earth Shock as a filler on the shock cooldowns Call of Flame freed up is
   * **-30.3**, because it cost 6.5 Lightning Bolts and pushed the build into
   * its mana.
   */
  elementalApl: [
    { label: 'no elemental_mastery entry -- the control', apply: removeEntry('elemental_mastery') },
    { label: 'no searing_totem entry', apply: removeEntry('searing_totem') },
    { label: 'no flame_shock entry', apply: removeEntry('flame_shock') },
    { label: 'no lava_burst entry', apply: removeEntry('lava_burst') },
  ],

  /*
   * ============================================================================
   * THE MINDFULNESS QUESTION, SWEPT. See the spreads above for what it is and
   * why the owner's own three points were taken out of it.
   *
   * EVERY ROW IS A COMPLETE 51-POINT ALLOCATION handed to `tree()`, which
   * throws rather than returning something plausible -- Gate A. A delta would
   * have let `createPlayer` strip an illegal talent in silence.
   *
   * RUN IT AT MORE THAN ONE LENGTH. The fight is 60s by default and this build
   * has 6.7% mana headroom there against **1.0% at 120s and 1.2% at 300s**, so
   * a mana talent measured only at a minute is measured in the one regime where
   * it is worth least.
   * ============================================================================
   */
  elementalMana: [
    { label: 'mindfulness 3 (out of totemic_focus)', apply: tree(ELEMENTAL_MINDFULNESS_FROM_TOTEMS) },
    { label: 'mindfulness 2 (out of totemic_focus)', apply: tree(ELEMENTAL_MINDFULNESS_2) },
    { label: 'mindfulness 1 (out of totemic_focus)', apply: tree(ELEMENTAL_MINDFULNESS_1) },
    {
      label: 'mindfulness 3 (out of ancestral_knowledge)',
      apply: tree(ELEMENTAL_MINDFULNESS_FROM_INTELLECT),
    },
    { label: "the owner's own spread -- ak 1, totems 5, mindfulness 3", apply: tree(ELEMENTAL_OWNER_SPREAD) },
    { label: 'mindfulness 3 + convection 5 + reverberation 5', apply: tree(ELEMENTAL_MANA_EVERYTHING) },
    { label: 'mindfulness 3 + convection 5 (no reverberation)', apply: tree(ELEMENTAL_CONVECTION_AND_MINDFULNESS) },
    { label: 'convection 5 alone (5 dead points)', apply: tree(ELEMENTAL_CONVECTION_ONLY) },
    { label: 'reverberation 5 alone (5 dead points)', apply: tree(ELEMENTAL_REVERBERATION_ONLY) },
    { label: 'the shipped spread -- the control', apply: (p) => p },
  ],

  /*
   * ============================================================================
   * EARTH SHOCK, AND IT IS A GATE SWEEP RATHER THAN THE ONE CELL ALREADY TAKEN.
   *
   * UNGATED IT MEASURED **-30.3**, "because it cost 6.5 Lightning Bolts and
   * pushed the build into its mana" -- one reading, written down, of a
   * PARAMETER. A gate is one number and the whole range costs the same
   * measurement each.
   *
   * WHY IT SHOULD BE ASKED AT ALL. The owner's own ruling on the shared shock
   * cooldown is "these do share a cooldown, but Flame Shock's duration is long
   * enough such that they can be alternated, **therefore both deserve to be on
   * the list**" -- and Call of Flame 3/3 takes Flame Shock to **21 seconds**
   * against a six second shock cooldown, so about fifteen of every twenty-one
   * seconds the shock school is free and this list casts nothing into it. The
   * list's own header still says "Flame Shock's TWELVE seconds of burn", which
   * is the pre-Call-of-Flame figure.
   *
   * THE ARITHMETIC PER GLOBAL COOLDOWN FAVOURS IT AND THE ARITHMETIC PER MANA
   * DOES NOT, which is exactly the shape a gate exists to resolve. At 760 spell
   * power: Earth Shock is 301 + 0.386 x 760 = **594 in a 1.5s global cooldown**
   * for 450 mana, and Lightning Bolt 196 + 0.714 x 760 = **739 in a 2.5s cast**
   * for 220. That is 396 damage a second against 295 -- and 1.32 damage a mana
   * against 3.36.
   *
   * TWO PARAMETERS, SWEPT SEPARATELY:
   *   the MANA floor      how much of the pool to protect for the filler
   *   the FLAME SHOCK     whether to refuse the shock cooldown when the burn
   *   guard               is close to needing it back
   *
   * ABOVE LIGHTNING BOLT AND BELOW LAVA BURST, because the bolt is the
   * unconditional filler and nothing below it can ever be the first castable
   * entry.
   * ============================================================================
   */
  elementalEarthShock: [
    { label: 'earth_shock ungated (the -30.3 cell, re-taken)', apply: earthShock() },
    { label: 'earth_shock above 50% mana', apply: earthShock(0.5) },
    { label: 'earth_shock above 60% mana', apply: earthShock(0.6) },
    { label: 'earth_shock above 70% mana', apply: earthShock(0.7) },
    { label: 'earth_shock above 80% mana', apply: earthShock(0.8) },
    { label: 'earth_shock above 90% mana', apply: earthShock(0.9) },
    {
      label: 'earth_shock above 70% mana + flame_shock >8s left',
      apply: earthShock(0.7, 8),
    },
    {
      label: 'earth_shock, flame_shock >8s left only',
      apply: earthShock(undefined, 8),
    },
    { label: 'no earth_shock entry -- the control', apply: (p) => p },
  ],

  /*
   * ============================================================================
   * THE FILLER FLOOR AND CHAIN LIGHTNING. See `fillerFloor` above for the
   * starvation this is aimed at.
   *
   * CHAIN LIGHTNING IS HERE BECAUSE ELEMENTAL ALACRITY MAKES IT A CLOSE CALL
   * PER GLOBAL COOLDOWN AND NOT PER MANA. The talent takes 0.5s off Lightning
   * Bolt, Chain Lightning and Lava Burst alike, so the bolt casts in 2.0s and
   * the chain in **1.5s, which is the global cooldown floor** -- at 760 spell
   * power that is 557 damage in 1.5s against 739 in 2.0s, or 371 a second
   * against 370. Indistinguishable per second, and **1.77 damage a mana against
   * 3.36**. The list's header rules it out for its missing jumps, which is true
   * and is not the binding reason.
   * ============================================================================
   */
  elementalFiller: [
    { label: 'filler floor 400 mana', apply: fillerFloor(400) },
    { label: 'filler floor 500 mana', apply: fillerFloor(500) },
    { label: 'filler floor 600 mana', apply: fillerFloor(600) },
    { label: 'filler floor 800 mana', apply: fillerFloor(800) },
    { label: 'filler floor 400, only when something pends', apply: fillerFloorSmart(400) },
    { label: 'filler floor 600, only when something pends', apply: fillerFloorSmart(600) },
    { label: 'filler floor 800, only when something pends', apply: fillerFloorSmart(800) },
    { label: 'filler floor 1200, only when something pends', apply: fillerFloorSmart(1200) },
    { label: 'chain_lightning ungated above the filler', apply: chainLightning() },
    { label: 'chain_lightning above 70% mana', apply: chainLightning(3000) },
    { label: 'the shipped list -- the control', apply: (p) => p },
  ],

  /*
   * ============================================================================
   * THE PRE-COMBAT DIMENSION, AND ELEMENTAL MASTERY IS THE REASON IT IS HERE.
   *
   * A pre-combat action skips the global cooldown it would start, so a fifteen
   * second window opened at a 0s lead is the SAME window the fight would get,
   * bought for no GCD -- and this build's GCD is the thing it is short of. The
   * list entry is worth +24.4 with the GCD paid; the pre-cast is **+13.9** on
   * top, and Searing Totem moved to the Enhancement opener's own 1.5s lead is
   * **+11.0**. Together **+27.5 +/- 5.0**.
   *
   * THE LEAD CUTS BOTH WAYS AND 0s IS WHAT WINS. The lead is REAL, so 0s gives
   * the full fifteen seconds from the pull and a 5s lead gives ten -- while the
   * cooldown comes back five seconds sooner, which on a three minute cooldown
   * in a hundred second fight buys nothing.
   * ============================================================================
   */
  /*
   * ------------------------------------------------------------------------------
   * THE THREE `addPrecombat` ROWS THAT USED TO BE HERE WERE MEASURING A
   * DUPLICATE, AND THEIR LABELS NO LONGER SAID SO. Elemental Mastery and Searing
   * Totem have both been IN the opener since the round that priced them, so
   * adding them again appended a second action: the Mastery row read IDENTICAL
   * FIGHTS (the second cast is refused by its own cooldown) and the totem row
   * read **-5.46** at 180s, which is the cost of a wasted pre-combat cast and
   * not a verdict on the totem. **A variant label is a claim about the build it
   * is applied to, and it expires when that build ships the thing it adds.**
   *
   * WHAT PRICES A SHIPPED ACTION IS REMOVING IT, so all four rows are removals.
   * ------------------------------------------------------------------------------
   */
  elementalPrecombat: [
    { label: 'no pre-combat elemental_mastery', apply: removePrecombat('elemental_mastery') },
    { label: 'no pre-combat searing_totem', apply: removePrecombat('searing_totem') },
    { label: 'no pre-combat lightning_bolt', apply: removePrecombat('lightning_bolt') },
    { label: 'no pre-combat flame_shock', apply: removePrecombat('flame_shock') },
    { label: 'elemental_mastery lead 0s -> 5s', apply: precombatLead('elemental_mastery', 5) },
    { label: "the owner's opener -- the control", apply: (p) => p },
  ],

  enhancementPrecombat: [
    { label: 'rage_of_the_farseer at 0s before', apply: addPrecombat(0, 'rage_of_the_farseer') },
    { label: 'no pre-combat flame_shock', apply: removePrecombat('flame_shock') },
    { label: 'no pre-combat searing_totem', apply: removePrecombat('searing_totem') },
  ],

  /*
   * FIRE NOVA AFTER A 44% DAMAGE CUT: removing it is **-69.6**, so it is still
   * the fourth-largest source on this profile and stays where the owner put it.
   * Its position is noise.
   */
  enhancementApl: [
    { label: 'no fire_nova entry', apply: removeEntry('fire_nova') },
    { label: 'fire_nova above earth_shock', apply: moveAbove('fire_nova', 'earth_shock') },
    { label: 'no lightning_bolt entry', apply: removeEntry('lightning_bolt') },
    { label: 'no earth_shock entry', apply: removeEntry('earth_shock') },
  ],

  /*
   * THE ELEMENTAL LOADOUT IS THE SAME FIVE-CASTER ONE, so the same slots are
   * the only live questions -- see `mageVariants.ts`, which carries the
   * argument: the cloak and feet slots offer a caster NOTHING, so their
   * `unmodelled` enchants are dead by table rather than by choice.
   */
  /*
   * ============================================================================
   * HASTE IS THE WORST STAT ON THIS BUILD AND IT WEARS TWO POINTS OF IT.
   *
   * `stat_weights` at 180s prices +1% haste at **-15.12 +/- 0.77** and +8
   * Intellect at **+5.59**, and the head and legs slots both carry +1% Haste.
   * At 60s the same two rows are -0.81 and +1.07 -- so this is the enchant
   * question the default clock could not ask.
   *
   * THE SWAP IS THE INDEPENDENT CHECK ON THAT WEIGHT, which is why it is
   * measured rather than read off the table: a figure that large and that
   * counter-intuitive on a caster wants a second route before it is published.
   * ============================================================================
   */
  elementalHaste: [
    { label: 'head AND legs +8 Intellect (was +1% Haste)', apply: chain(enchant('head', 900006), enchant('legs', 900006)) },
    { label: 'head AND legs +8 Spirit (was +1% Haste)', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
    { label: 'head +8 Intellect only', apply: enchant('head', 900006) },
    { label: 'legs +8 Intellect only', apply: enchant('legs', 900006) },
    { label: 'head +8 Intellect, legs +8 Spirit', apply: chain(enchant('head', 900006), enchant('legs', 900007)) },
    { label: 'the shipped loadout -- the control', apply: (p) => p },
  ],

  elementalEnchants: [
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],

  /*
   * ============================================================================
   * THE ENHANCEMENT SHAMAN HAD A DEAD ENCHANT ITS SLOT COULD ACTUALLY FIX, which
   * none of the five casters does: its boots carried MINOR SPEED, and the feet
   * slot offers +7 AGILITY -- which a 61%-physical build reads in full. Worth
   * **+1.9 +/- 1.8**, and it was the one free enchant in the six profiles: a
   * slot worth zero with a live option in the same table. It is shipped, so the
   * row below is the control.
   *
   * EVERYTHING ELSE STAYS ON STRENGTH, measured rather than assumed: +15 Agility
   * for +15 Strength is -1.7, +8 Agility on the head is -1.0, and haste on the
   * head, legs or gloves is noise against an interval of 11.
   * ============================================================================
   */
  enhancementEnchants: [
    { label: 'feet Minor Speed (was +7 Agility) -- the control', apply: enchant('feet', 900025) },
    { label: 'feet +7 Stamina', apply: enchant('feet', 900027) },
    { label: 'gloves +15 Agility (was +15 Strength)', apply: enchant('gloves', 900022) },
    { label: 'head +8 Agility (was +8 Strength)', apply: enchant('head', 900003) },
    { label: 'head +1% Haste (was +8 Strength)', apply: enchant('head', 900002) },
    { label: 'legs +1% Haste (was +8 Strength)', apply: enchant('legs', 900002) },
    { label: 'gloves +1% Haste (was +15 Strength)', apply: enchant('gloves', 900002) },
  ],

  /*
   * ============================================================================
   * THE MANA-RELEVANT CONSUMABLE ROWS, RE-ASKED AT A LENGTH WHERE MANA BINDS.
   *
   * The rows below were settled at 60s, where this build has 14.3% headroom and
   * `manaPer5` and `spirit` both weigh **0.000** -- "not measured: the interval
   * swallows the value". At 180s they are **0.6623 and 0.3613 a point**, and
   * Intellect goes 0.1337 to **0.6988**. So the two measured inputs the
   * selection rule turns on have both moved.
   * ============================================================================
   */
  elementalConsumables: [
    { label: 'blasted lands +25 Spirit (was +25 Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'flask +1200 Hit Points (was +150 Spell Power)', apply: consumable('flask', 'flask_hit_points') },
    { label: 'food +20 Stamina (was +28 Spell Power)', apply: consumable('food', 'food_stamina') },
    { label: 'the shipped row -- the control', apply: (p) => p },
  ],

  /* Every alternative lost on both Shamans. Kept so that can be re-derived. */
  shamanConsumables: [
    { label: 'school power Fire', apply: consumable('school_spell_power', 'school_fire') },
    { label: 'school power Nature', apply: consumable('school_spell_power', 'school_nature') },
    { label: 'blasted lands +25 Intellect', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
  ],
};
