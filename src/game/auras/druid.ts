import type { AuraDefinition } from '../../engine';
import {
  ALL_ABILITIES,
  RATING_PER_PERCENT,
  applyHealing,
  dealDamage,
  flat,
  percent,
  seconds,
} from '../../engine';
import {
  INSECT_SWARM_TICK_SP_COEFFICIENT,
  MOONFIRE_SP_COEFFICIENT,
  MOONFIRE_TICK_SP_COEFFICIENT,
  REGROWTH_TICK_HEAL_COEFFICIENT,
  REJUVENATION_TICK_HEAL_COEFFICIENT,
  WILD_GROWTH_TICK_HEAL_COEFFICIENT,
} from '../combat/coefficients';
import {
  LACERATE_TICK_WEAPON_FRACTION_PER_APPLICATION,
  RAKE_TICK_AP_COEFFICIENT,
  RIP_AP_COEFFICIENT_PER_COMBO_POINT,
} from '../combat/coefficients';

/**
 * Druid auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * Captured in `src/data/abilities/forever-druid-spellbook.json` at MAX RANK.
 *
 * ----------------------------------------------------------------------------
 * THREE SPECS AND THREE RESOURCES, which is what makes the Druid the widest
 * class in the project. Moonkin casts on mana, Cat builds combo points on
 * energy, Bear earns rage -- and all three already existed:
 *
 *   forms          `combatStyles.ts` has caster, moonkin, tree, bear and cat,
 *                  each with its own primary resource
 *   combo points   `game/combat/comboPoints.ts`, built for the Rogue
 *   bear rage      `RAGE_FROM_BEAR_PAW` in `resourceRules.ts`, which the
 *                  ruleset owner's rage formula names directly
 *
 * A FORM IS FIXED AT CREATION rather than shifted mid-fight, the same way a
 * Warrior's stance is. Each profile is one form, so nothing here needs to
 * model the shift; a Druid who weaved forms would.
 * ----------------------------------------------------------------------------
 */

const ARCANE = 'arcane' as const;
const NATURE = 'nature' as const;
const PHYSICAL = 'physical' as const;

/*
 * ============================================================================
 * THE TWO PARTY CRIT AURAS: 3% EACH, AND ONE ID PER AURA RATHER THAN PER
 * SOURCE.
 *
 * Moonkin Aura and Leader of the Pack each put +3% critical strike chance on
 * everyone within 45 yards, and each can be met two ways -- the Druid TALENT
 * that grants it, or the raid buff entry of the same name. Each is ONE
 * `AuraDefinition` with ONE id that both of its sources apply, so a Moonkin in
 * a raid that also ticks Moonkin Aura reads 3% and not 6%:
 * `AuraCollection.apply` refreshes a matching id instead of stacking a second
 * instance, and no rule has to be remembered anywhere.
 *
 * ----------------------------------------------------------------------------
 * THIS SECTION SAID "ONE AURA, THREE SOURCES, 3% ONCE" AND IT IS TWO AURAS
 * NOW, WHICH TOOK TWO PATCHES AND ONE OWNER RULING TO ARRIVE AT.
 *
 * 1. It was two auras and it DOUBLE-DIPPED. Each TALENT shared an id with the
 *    raid buff of the same name, which closed two of the three combinations
 *    and left the third wide open: a Moonkin carrying its own form talent in a
 *    raid that selected `leader_of_the_pack` held two different ids and read
 *    **+6% crit** -- measured, not suspected, 24.243% against 21.243%. The
 *    ruling then was "these are all the same exclusive 3% global critical
 *    strike chance and do not stack", so they became ONE id.
 *
 * 2. A patch split them BY ATTACK TYPE -- Moonkin Aura spell crit only, Leader
 *    of the Pack melee and ranged only -- so they are two ids again and they
 *    stack with each other on purpose. See `MOONKIN_AURA_ID` below.
 *
 * 3. The owner has since ruled the two raid buff entries NOT exclusive, and
 *    every preset selects both. So a raid has a feral druid and a moonkin.
 *
 * WHAT SURVIVED ALL THREE IS THE SHAPE, and it is the part worth keeping: the
 * no-double-dip rule lives in the ID and not in the chooser. The older ruling
 * was "they don't stack, but that can be handled on the GUI", and `withRaidBuff`
 * did switch one off when the other went on -- which was only ever half the
 * surface, because it governs two raid buff entries and knows nothing about a
 * TALENT, and nothing at all about a profile loaded from JSON with both ids in
 * its list. **A GUI rule cannot cover a source the GUI does not own**, and that
 * is why step 3 costs nothing: there is no exclusivity left in a chooser to
 * remove, because the exclusivity that mattered was never there.
 * ----------------------------------------------------------------------------
 *
 * EACH NAME CARRIES ITS OWN SOURCE, and the aura surfaces in the combat log's
 * line at the pull and nowhere else: a permanent aura is never removed, so
 * `auraUptime` filters it out -- it only totals a span when an `aura_removed`
 * closes one.
 * ============================================================================
 */

/** Percentage POINTS, stated by both tooltips. */
export const PARTY_CRIT_AURA_PERCENT = 3;

/*
 * ============================================================================
 * PROWL, AND IT IS A GATE ON RAVAGE AND NOTHING ELSE.
 *
 * "Allows the Druid to prowl around, but reduces your movement speed by 30%.
 * Lasts until cancelled." Instant, 10 second cooldown, requires Cat Form.
 *
 * THE SAME SHAPE STEALTH ALREADY HAS, deliberately: one permanent aura whose
 * only reader is the opener it unlocks. A Rogue's `stealth` makes Ambush
 * castable and does nothing else, and this makes Ravage castable and does
 * nothing else -- so there is one mechanism for "an opener needs to be hidden"
 * rather than two that can drift.
 *
 * THE MOVEMENT SPEED IS THE ONLY CLAUSE WITH A NUMBER AND IT IS `positioning`.
 * Nothing here has a position, so -30% movement is unmodelled and the ability
 * says so where it is declared.
 *
 * AND IT IS NOT APPLIED BY `openingAuras` THE WAY A ROGUE'S STEALTH IS, which
 * is the one difference and it is the owner's: a Rogue "opens from stealth" as
 * a fact about the class, where a Druid's opener names Prowl as a STEP -- "2s
 * before cat form, 1s before prowl, 0s Ravage". So it is cast, which also means
 * its ten second cooldown is on the clock at the pull with the lead rewound.
 * ============================================================================
 */
export const PROWL: AuraDefinition = {
  /*
   * ANY COMPLETED CAST OR ATTACK ENDS IT, on the owner's general rule -- which
   * is what settled the one clause neither source stated about Ravage. The
   * question raised was whether Ravage SPENDS the window; the answer is wider
   * and is not Ravage's at all: everything does. See
   * `AuraDefinition.brokenByAction`.
   */
  brokenByAction: true,
  id: 'prowl',
  name: 'Prowl',
  // Lasts until cancelled, which is what every stance, form and Stealth here
  // expresses as a permanent aura.
  durationMs: 0,
};

/**
 * ============================================================================
 * TWO AURAS NOW, WHERE THERE WAS ONE, AND THE PATCH SPLIT THEM BY ATTACK TYPE.
 *
 *   "Moonkin Aura now only increases Spell Critical Strike chance"
 *   "Leader of the Pack now only increases Melee and Ranged Critical Strike
 *    chance"
 *
 * IT WAS ONE ID ON THE OWNER'S OWN RULING -- "these are all the same exclusive
 * 3% global critical strike chance and do not stack" -- and that single id was
 * the whole of the no-double-dip rule: `AuraCollection.apply` refreshes a
 * matching id rather than stacking, so a Moonkin carrying its own form talent
 * in a raid with Leader of the Pack ticked read 3% and not 6%. Enforcing it at
 * the CHOOSER instead is what had produced the +6% bug, measured at 24.243%
 * against 21.243%.
 *
 * THE SPLIT DOES NOT REPEAL THAT LESSON, IT NARROWS IT. Each aura keeps ONE id
 * shared by its talent and its raid buff entry, so a Moonkin with both sources
 * of Moonkin Aura still reads 3% spell crit -- which is the half of the old
 * ruling that was about double-dipping. What is gone is the claim that the two
 * are the same buff, because the note says in as many words that they are not.
 *
 * SO THEY STACK WITH EACH OTHER NOW, and that is the intended consequence: a
 * character under both carries +3% spell AND +3% melee, which is two different
 * buffs doing two different things rather than one counted twice.
 *
 * ----------------------------------------------------------------------------
 * AND THE EXCLUSIVITY IS GONE, WHICH IS THE OWNER ANSWERING A QUESTION THIS
 * NOTE WAS LEFT CARRYING.
 *
 * It read "`exclusiveWith` IS NOW A QUESTION FOR THE OWNER RATHER THAN AN
 * ANSWER", on the reasoning that two buffs which no longer overlap have no
 * obvious reason to exclude each other -- a raid with a feral druid and a
 * moonkin would have both -- while removing it is a RAID COMPOSITION decision
 * that moves every profile's figure and is therefore not a reading of a note.
 * The ruling: "Moonkin and Leader of the Pack are no longer exclusive. And all
 * profiles should have both enabled by default in the raid buffs."
 *
 * SO IT COST EVERY CASTER PROFILE 3% SPELL CRIT FOR ONE RELEASE AND HANDS IT
 * BACK. Every preset carried `leader_of_the_pack`, which after the split
 * grants melee and ranged crit only -- so the split itself is what took the
 * spell crit away from nine caster rows, and selecting both is what restores
 * it. The flag was worth writing down: this is the second question in two
 * rounds whose answer arrived because it was recorded where somebody reads it.
 *
 * `RaidBuff.exclusiveWith` NOW HAS NO DECLARATION ANYWHERE, and
 * `raidBuffs.test.ts` pins that rather than leaving it to be assumed -- a
 * selection rule with no caller reads exactly like one that sometimes fires,
 * which is `RacialRequirement.weaponTypes`' lesson from the patch before this
 * one. The field and `areExclusive` are kept: the next exclusive PAIR is a
 * declaration rather than a re-implementation, and `withRaidBuff` is still
 * load-bearing for the catalogue ordering it also does.
 * ============================================================================
 */

/** Moonkin Aura: SPELL critical strike chance, and nothing else. */
export const MOONKIN_AURA_ID = 'moonkin_aura';

/**
 * Leader of the Pack: MELEE AND RANGED critical strike chance.
 *
 * ONE STAT FOR BOTH, which is not a simplification: `critChance` is the stat
 * the melee AND the ranged tables both read -- `critChanceFrom` is the engine's
 * one crit function -- so "melee and ranged" is exactly that stat and naming
 * two would be naming it twice.
 */
export const LEADER_OF_THE_PACK_AURA_ID = 'leader_of_the_pack_aura';

/**
 * Crit in this engine is percentage POINTS, and melee and spells are separate
 * stats. "+3% crit chance" is therefore TWO modifiers, not one -- ranged reads
 * `critChance`, the same stat melee does. Moved here with the aura from
 * `raidBuffs.ts`, which had this as `critChanceEverywhere` and no other caller.
 */
/*
 * ============================================================================
 * OMEN OF CLARITY, AND CLEARCASTING.
 *
 * "Your spells and attacks have a chance to grant you Clearcasting, reducing
 * the Mana, Rage, or Energy cost of your next damage or healing spell or
 * offensive ability by 100%. Clearcasting is not consumed by Wrath or by spells
 * or abilities that cost no resources."
 *
 * A PASSIVE, NOT A CAST. The capture gives it a school and a level and nothing
 * else -- no cost, no cooldown, no cast time, no duration -- so there is
 * nothing to put in a priority list and nothing to keep up. Every Druid learns
 * it at 20, so every Druid profile simply has it; the proc is registered by
 * `reactionsForClass`, which is where Windfury Weapon lives for the same reason.
 *
 * THE THREE NUMBERS ARE THE RULESET OWNER'S, and none of them is in the
 * tooltip: 4% to proc, DOUBLED in Moonkin form, with a ten second internal
 * cooldown. The doubling is Moonkin Form's own clause -- "Omen of Clarity gains
 * 100% increased chance to trigger" -- which that talent carried as
 * `unmodelled` on the honest grounds that there was no proc here to double.
 *
 * CLEARCASTING LASTS UNTIL IT IS SPENT, because no duration is stated. Classic's
 * is fifteen seconds and that figure is not borrowed: with a ten second internal
 * cooldown the next offensive ability is almost always within a second or two,
 * so the two readings are nearly indistinguishable and only one of them invents
 * a number. The same decision Nature's Swiftness took, and for the same reason.
 * ============================================================================
 */

/** Percentage chance per spell or attack, stated by the ruleset owner. */
export const OMEN_OF_CLARITY_PROC_CHANCE = 4;
/**
 * Moonkin Form doubles it, which is that form's own tooltip clause stated as a
 * multiplier rather than as the "+100% increased chance" the text uses.
 */
export const OMEN_OF_CLARITY_MOONKIN_MULTIPLIER = 2;
/** And it cannot proc again inside this window. The owner's figure. */
export const OMEN_OF_CLARITY_INTERNAL_COOLDOWN_MS = seconds(10);

/**
 * Clearcasting: the next offensive ability that costs something is free.
 *
 * ----------------------------------------------------------------------------
 * THREE CLAUSES OF THE TOOLTIP ARE THREE FIELDS, and each one is a charge that
 * would otherwise be thrown away on the wrong thing:
 *
 *   ALL_ABILITIES          "your next ... spell or offensive ability" names no
 *                          spell and never could, so it is the catch-all
 *   exceptAbilityIds       "not consumed by Wrath"
 *   requiresCost           "nor by spells or abilities that cost no resources"
 *   requiresAttackTable    "OFFENSIVE ability", which the owner defines as one
 *                          processed through a combat table -- so the Druid's
 *                          Demoralizing Roar, ten rage and no table, is its
 *                          Battle Shout and does not consume this
 *
 * `consumedByCast: 'all'` because it is ONE cast: "your NEXT". A stack would
 * leave the rest of the charge behind, which reads as a working effect worth
 * several times its value.
 *
 * ITS HEALING HALF SINCE ROUND 72, the owner's: a healing spell cast can PROC
 * it (`omenOfClarityHealReaction`), and a heal SPENDS it -- `healsCount` lets
 * an ability marked `heals` past `requiresAttackTable`, which a heal, rolling
 * on no table, would otherwise fail. Innervate costs mana and heals nothing,
 * so it still cannot spend the charge.
 * ----------------------------------------------------------------------------
 */
export const CLEARCASTING: AuraDefinition = {
  id: 'clearcasting',
  name: 'Clearcasting',
  // Until it is spent. No duration is stated and none would mean anything.
  durationMs: 0,
  castModifier: {
    abilityIds: [ALL_ABILITIES],
    exceptAbilityIds: ['wrath'],
    requiresCost: true,
    requiresAttackTable: true,
    // "Damage or HEALING spell": a heal spends it too (round 72).
    healsCount: true,
    costFraction: 1,
    /*
     * ONE CAST, because the tooltip says "your NEXT". Spending a stack where
     * the effect spends all of them leaves the rest behind, which reads as a
     * working effect worth several times its value.
     */
    consumedByCast: 'all',
  },
};

export const MOONKIN_AURA: AuraDefinition = {
  id: MOONKIN_AURA_ID,
  name: 'Moonkin Aura',
  // As long as the druid is there, which is the whole fight.
  durationMs: 0,
  statModifiers: [flat('spellCritChance', PARTY_CRIT_AURA_PERCENT)],
};

export const LEADER_OF_THE_PACK_AURA: AuraDefinition = {
  id: LEADER_OF_THE_PACK_AURA_ID,
  name: 'Leader of the Pack',
  durationMs: 0,
  statModifiers: [flat('critChance', PARTY_CRIT_AURA_PERCENT)],
};

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

/**
 * Moonfire's bleed half: "an additional 240 Arcane damage over 12 sec".
 *
 * ARCANE, AND THEREFORE NOT REDUCED BY ARMOR -- which is true of every magical
 * school and not a special case. It still crits, at the crit chance of the
 * event that applied it: a spell, so spell crit.
 */
export const MOONFIRE_DOT_TOTAL = 240;
export const MOONFIRE_DOT_DURATION_MS = seconds(12);
export const MOONFIRE_TICK_INTERVAL_MS = seconds(3);

/*
 * Moonfire hits AND burns, and the sheet gives each half its own row.
 *
 * ITS DIRECT HALF IS UNCHANGED AT 0.15 AND ITS BURN IS NOT. The old hybrid
 * rule reproduced Classic's published 0.15 / 0.52 pair exactly, and that
 * agreement was the cross-check that the rule had been transcribed correctly.
 * Forever's own figures are 0.15 and 13% a tick, which is 1.56 over twelve
 * ticks -- so the direct half was right for both rulesets and the burn was
 * Classic's alone.
 */
export const MOONFIRE_COEFFICIENTS = {
  direct: MOONFIRE_SP_COEFFICIENT,
  perTick: MOONFIRE_TICK_SP_COEFFICIENT,
};

export const MOONFIRE_DOT: AuraDefinition = {
  id: 'moonfire',
  name: 'Moonfire',
  durationMs: MOONFIRE_DOT_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: MOONFIRE_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      tick(
        context,
        aura,
        MOONFIRE_DOT_TOTAL / (MOONFIRE_DOT_DURATION_MS / MOONFIRE_TICK_INTERVAL_MS),
        ARCANE,
        'spell',
        MOONFIRE_COEFFICIENTS.perTick,
      );
    },
  },
};

/**
 * Insect Swarm: "decreasing their chance to hit with attacks by 2% and causing
 * 186 Nature damage over 12 sec".
 *
 * THE HIT REDUCTION IS A DEFENSIVE EFFECT and does nothing on a target that
 * does not swing back, which every Balance profile faces. It is applied anyway,
 * as a negative `hitChance` on the target, so the day an encounter hits back it
 * works without anyone remembering.
 */
export const INSECT_SWARM_TOTAL = 186;
export const INSECT_SWARM_DURATION_MS = seconds(12);
export const INSECT_SWARM_TICK_INTERVAL_MS = seconds(2);
export const INSECT_SWARM_HIT_REDUCTION = 2;

/** A pure DoT: the cast deals nothing, and the sheet states the tick. */
export const INSECT_SWARM_TICK_COEFFICIENT = INSECT_SWARM_TICK_SP_COEFFICIENT;

export const INSECT_SWARM: AuraDefinition = {
  id: 'insect_swarm',
  name: 'Insect Swarm',
  durationMs: INSECT_SWARM_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  statModifiers: [flat('hitChance', -INSECT_SWARM_HIT_REDUCTION)],
  periodic: {
    intervalMs: INSECT_SWARM_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      tick(
        context,
        aura,
        INSECT_SWARM_TOTAL / (INSECT_SWARM_DURATION_MS / INSECT_SWARM_TICK_INTERVAL_MS),
        NATURE,
        'spell',
        INSECT_SWARM_TICK_COEFFICIENT,
      );
    },
  },
};

/**
 * Eclipse: "Your Wrath spell reduces the cast time of your next 2 Starfire
 * spells by 0.5 sec. Stores up to 4 charges. Lasts 15 sec."
 *
 * ----------------------------------------------------------------------------
 * LIVE NOW, AND IT WAS THE FIRST TALENT TO ASK FOR THE RULE. It spent the
 * Druid PR tracked and inert, and said so: cast time is resolved by the engine
 * before `onCast` runs, so unlike Cold Blood's crit -- which the Rogue solved
 * by having the five named abilities remove the aura themselves -- no amount
 * of content could reach it. `CastModifier` on the aura is the engine rule
 * that does, and Maelstrom Weapon on the Shaman wanted the same one.
 *
 * A CHARGE PER STARFIRE, NOT A MAGNITUDE PER STACK. `scalesWithStacks` is
 * deliberately off: four charges is four half-second Starfires, not one
 * two-second discount. Maelstrom Weapon is the other arrangement, and the two
 * are worth reading together.
 *
 * TWO CHARGES A WRATH, capped at four -- so a Moonkin alternating Wrath and
 * Starfire banks them faster than it spends them, and the cap is what stops
 * the filler paying for the whole fight. Granted as two applications rather
 * than by setting `stacks`, because `applyAura` already adds one and caps at
 * `maxStacks`; reaching in to set it would duplicate that rule and be the copy
 * that goes stale.
 *
 * THE HALF SECOND IS THE RANK 3 VALUE. Ranks 1 and 2 are 0.17 and 0.33, and
 * the aura is built from the rank rather than from a constant for that reason.
 * ----------------------------------------------------------------------------
 */
export const ECLIPSE_MAX_CHARGES = 4;
export const ECLIPSE_CHARGES_PER_WRATH = 2;
export const ECLIPSE_DURATION_MS = seconds(15);
/** The maximum rank, for the catalogue below. Ranks 1 and 2 are 0.17 and 0.33. */
export const ECLIPSE_RANK_3_SECONDS = 0.5;

export function eclipseAura(reductionSeconds: number): AuraDefinition {
  return {
    id: 'eclipse',
    name: 'Eclipse',
    durationMs: ECLIPSE_DURATION_MS,
    maxStacks: ECLIPSE_MAX_CHARGES,
    refreshBehaviour: 'reset',
    castModifier: {
      abilityIds: ['starfire'],
      castTimeReductionMs: seconds(reductionSeconds),
      consumedByCast: 'stack',
      /*
       * Starfire always has a cast time, so this changes nothing today. It is
       * set because the charge is FOR a cast: an instant Starfire from some
       * future effect must not silently eat one.
       */
      requiresCastTime: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Feral: Cat
// ---------------------------------------------------------------------------

/**
 * Rake's bleed: "61 damage and an additional 102 damage over 9 sec".
 *
 * Nine seconds at a three-second cadence is three ticks, which divides evenly
 * -- the reading that reproduces the stated total.
 */
export const RAKE_DOT_TOTAL = 102;
export const RAKE_DOT_DURATION_MS = seconds(9);
export const RAKE_TICK_INTERVAL_MS = seconds(3);

export const RAKE_DOT: AuraDefinition = {
  id: 'rake',
  name: 'Rake',
  durationMs: RAKE_DOT_DURATION_MS,
  isDebuff: true,
  isBleed: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: RAKE_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      tick(
        context,
        aura,
        RAKE_DOT_TOTAL / (RAKE_DOT_DURATION_MS / RAKE_TICK_INTERVAL_MS),
        PHYSICAL,
        'melee-special',
        // 1% of attack power per tick, on top of the flat bleed.
        RAKE_TICK_AP_COEFFICIENT,
      );
    },
  },
};

/**
 * Rip, the Cat finisher: damage scaling with combo points over a FIXED twelve
 * seconds.
 *
 *     1 point  243        4 points  702
 *     2 points 396        5 points  855
 *     3 points 549
 *
 * THE DURATION DOES NOT SCALE, unlike the Rogue's Rupture, whose duration and
 * damage both did. Every step here is exactly 153 apart, which is the kind of
 * regularity that makes a transcription easy to check.
 */
export const RIP_DURATION_MS = seconds(12);
export const RIP_TICK_INTERVAL_MS = seconds(2);
export const RIP_BY_COMBO_POINT: readonly number[] = [243, 396, 549, 702, 855];

/**
 * SIX. Twelve seconds at two, and the divisor for BOTH halves of a tick.
 *
 * Named because it is the number the two halves have to share. The flat damage
 * was always a duration total divided by this; the attack power coefficient was
 * applied per tick instead, which made it six times the stated figure. Deriving
 * it rather than writing 6 also means a change to either constant moves both
 * halves together.
 */
export const RIP_TICK_COUNT = RIP_DURATION_MS / RIP_TICK_INTERVAL_MS;

export function ripAura(comboPoints: number): AuraDefinition {
  const points = clampIndex(comboPoints) + 1;
  const total = RIP_BY_COMBO_POINT[clampIndex(comboPoints)];
  const perTick = total / RIP_TICK_COUNT;

  return {
    id: 'rip',
    name: 'Rip',
    durationMs: RIP_DURATION_MS,
    isDebuff: true,
    isBleed: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: RIP_TICK_INTERVAL_MS,
      onTick: (context, aura) =>
        tick(
          context,
          aura,
          perTick,
          PHYSICAL,
          'melee-special',
          /*
           * 4% OF ATTACK POWER PER COMBO POINT SPENT, OVER THE WHOLE DURATION,
           * so a five-point Rip carries 20% SPREAD ACROSS ITS SIX TICKS and
           * each tick takes 4%/6 a point.
           *
           * DIVIDED THE SAME WAY `perTick` IS, one line above, which is the
           * whole point: both halves of a tick come from one duration total
           * over one tick count. This used to be applied per tick, making a
           * five-point Rip 120% of attack power instead of 20%.
           *
           * The comment here also said "its EIGHT ticks" and there are six.
           *
           * The points are read from the aura's OWN combo points rather than
           * the character's, because the character has spent them: `ripAura`
           * is built with what was spent and its ticks land long afterwards.
           */
          (RIP_AP_COEFFICIENT_PER_COMBO_POINT * points) / RIP_TICK_COUNT,
        ),
    },
  };
}

/*
 * TIGER'S FURY IS GONE, and so is its aura. Forever removed the ability at
 * client build 1.60.1.70170 -- "Tiger's Fury has been removed" -- together with
 * King of the Jungle, the talent whose only clause was "Tiger's Fury now
 * instantly grants you 60 Energy".
 *
 * WHAT IT WAS: a free instant on a 30-second cooldown applying a 1.15x physical
 * damage multiplier for six seconds. The Cat list cast it on an empty energy bar
 * and King of the Jungle refilled 60 energy on the cast. Both are deleted rather
 * than left inert, because an ability nothing can learn is not an inert ability
 * -- it is one the ruleset does not have, and leaving it in the catalogue would
 * put it back in the spellbook the day something enumerated the file.
 *
 * ITS REPLACEMENT IS NOT A DAMAGE BUFF. Shifting Power converts 55% of base mana
 * into 40 energy -- the resource half of King of the Jungle, moved onto an
 * ability of its own and paid for in mana.
 */

// ---------------------------------------------------------------------------
// Feral: Bear
// ---------------------------------------------------------------------------

/**
 * Lacerate: "75 damage over 15 sec plus 10% weapon damage per existing
 * application", stacking.
 *
 * THE STACKING HALF IS NOT MODELLED. `modifiersScaleWithStacks` scales a STAT
 * modifier by the stack count and there is no equivalent for a periodic tick,
 * so the bleed applies its flat total and the per-application weapon damage
 * does not. Stacks are still tracked, so the day a periodic can read them the
 * number is already there.
 */
export const LACERATE_TOTAL = 75;
export const LACERATE_DURATION_MS = seconds(15);
export const LACERATE_TICK_INTERVAL_MS = seconds(3);
export const LACERATE_MAX_STACKS = 5;

export const LACERATE: AuraDefinition = {
  id: 'lacerate',
  name: 'Lacerate',
  durationMs: LACERATE_DURATION_MS,
  isDebuff: true,
  isBleed: true,
  maxStacks: LACERATE_MAX_STACKS,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: LACERATE_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      tick(
        context,
        aura,
        LACERATE_TOTAL / (LACERATE_DURATION_MS / LACERATE_TICK_INTERVAL_MS),
        PHYSICAL,
        'melee-special',
        0,
        /*
         * 10% OF A WEAPON SWING PER EXISTING APPLICATION, so five stacks put
         * half a swing into every tick.
         *
         * THE REASON THIS WAS UNMODELLED HAS EXPIRED. It said a periodic tick
         * "cannot read its own stack count"; `AuraInstance` carries `stacks`
         * and the tick is handed the instance, so it always could. That is the
         * fourth time a reason outlived the thing it described.
         */
        LACERATE_TICK_WEAPON_FRACTION_PER_APPLICATION * aura.stacks,
      );
    },
  },
};

/*
 * NOTHING ABOUT LACERATE IS UNMODELLED ANY MORE. Its "plus 10% weapon damage
 * per existing application" is applied from the sheet, reading `aura.stacks`
 * -- which the old reason claimed a tick could not do.
 */

/** "Decreasing nearby enemies' melee attack power by 204. Lasts 30 sec." */
export const DEMORALIZING_ROAR_ATTACK_POWER = 204;
export const DEMORALIZING_ROAR_DURATION_MS = seconds(30);

/**
 * Faerie Fire: "Decrease the armor of the target by 505 for 40 sec."
 *
 * ONE AURA, TWO ROUTES -- the Bear casting it (round 51) and the raid debuff the
 * encounter assumes. `raidBuffs.ts` SPREADS this definition with an hour's
 * duration, which is Judgement of the Crusader's arrangement: one id means the
 * two can never both apply, so a Bear under the raid's Faerie Fire is not handed
 * 1,010 armor off the boss.
 */
export const FAERIE_FIRE_ARMOR_REDUCTION = 505;
export const FAERIE_FIRE_DURATION_MS = seconds(40);
export const FAERIE_FIRE: AuraDefinition = {
  id: 'faerie_fire',
  name: 'Faerie Fire',
  durationMs: FAERIE_FIRE_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  statModifiers: [flat('armor', -FAERIE_FIRE_ARMOR_REDUCTION)],
};

export const DEMORALIZING_ROAR: AuraDefinition = {
  id: 'demoralizing_roar',
  name: 'Demoralizing Roar',
  durationMs: DEMORALIZING_ROAR_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  statModifiers: [flat('attackPower', -DEMORALIZING_ROAR_ATTACK_POWER)],
};

/**
 * Maul: "increases the druid's next attack by 128 damage".
 *
 * ON THE NEXT SWING, exactly like the Warrior's Heroic Strike, which is why it
 * is an `onNextSwing` ability rather than an aura. Named here only so the
 * figure sits beside the rest.
 */
export const MAUL_BONUS_DAMAGE = 128;



// ---------------------------------------------------------------------------
// Feral: the Bear's three cooldowns
// ---------------------------------------------------------------------------

/**
 * Barkskin: "Physical damage taken is reduced by 20%. While you are protected,
 * damaging attacks will not cause spellcasting delays. Lasts 15 sec."
 *
 * Free, instant, one minute. PHYSICAL ONLY, which is what `damageTakenBySchool`
 * is for -- a flat `damageTakenMultiplier` would reduce everything and this
 * tooltip names one school.
 *
 * IT IS WORTH SOMETHING ONLY TO THE BEAR, and not because of the form: the
 * Bear is the one Druid profile whose target attacks back. On the other two it
 * is a correct effect worth exactly zero, which is a different thing from an
 * inert one.
 *
 * Its spell-pushback clause is dropped: nothing here models pushback, so there
 * is no delay for it to prevent.
 */
export const BARKSKIN_DURATION_MS = seconds(15);
export const BARKSKIN_COOLDOWN_MS = seconds(60);
export const BARKSKIN_PHYSICAL_REDUCTION = 0.2;

export const BARKSKIN: AuraDefinition = {
  id: 'barkskin',
  name: 'Barkskin',
  durationMs: BARKSKIN_DURATION_MS,
  damageTakenBySchool: { physical: 1 - BARKSKIN_PHYSICAL_REDUCTION },
  /*
   * KEPT THROUGH A REVIVE would be wrong for the opposite reason to Last
   * Stand's: this is not spent to prevent a death, so there is nothing to
   * argue it should be consumed by one. It is left at the default.
   */
};

/**
 * Enrage: "Instantly generates 10 Rage and another 20 Rage over 10 sec, but
 * reduces base armor by 27% in Bear Form and 16% in Dire Bear Form."
 *
 * Free, instant, one minute. THE INSTANT 10 IS THE ABILITY'S and the 20 over
 * ten seconds is this aura's, at 2 a second -- the same split Bloodrage has,
 * and the same reason: a grant that happens once is not periodic.
 *
 * TWENTY-SEVEN PERCENT, THE BEAR FORM FIGURE. The Dire Bear number is stated
 * and not used, because `combatStyle` here is `bear` and there is no Dire Bear
 * style to select the other with. Named rather than dropped, so the day a
 * second form exists the figure is already on the page.
 *
 * ARMOR IS A REAL COST ON THE ONE PROFILE THAT TAKES DAMAGE, which is what
 * makes this an interesting entry rather than free rage. It is the Bear, and
 * its target attacks back.
 */
export const ENRAGE_DURATION_MS = seconds(10);
export const ENRAGE_COOLDOWN_MS = seconds(60);
export const ENRAGE_INSTANT_RAGE = 10;
export const ENRAGE_RAGE_OVER_TIME = 20;
export const ENRAGE_TICK_INTERVAL_MS = seconds(1);
export const ENRAGE_BEAR_ARMOR_REDUCTION = 0.27;
/** Stated by the source and unused: there is no Dire Bear combat style. */
export const ENRAGE_DIRE_BEAR_ARMOR_REDUCTION = 0.16;

export const ENRAGE_RAGE_PER_TICK =
  ENRAGE_RAGE_OVER_TIME / (ENRAGE_DURATION_MS / ENRAGE_TICK_INTERVAL_MS);

export const ENRAGE: AuraDefinition = {
  id: 'enrage',
  name: 'Enrage',
  durationMs: ENRAGE_DURATION_MS,
  statModifiers: [percent('armor', -ENRAGE_BEAR_ARMOR_REDUCTION)],
  periodic: {
    intervalMs: ENRAGE_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const actor = context.combatant(aura.targetId);
      if (!actor) return;
      context.grantResource(actor, 'rage', ENRAGE_RAGE_PER_TICK, {
        id: 'enrage',
        name: 'Enrage',
      });
    },
  },
};

/*
 * ============================================================================
 * FRENZIED REGENERATION: "Converts up to 10 Rage per second into health for 10
 * sec. Each point of Rage is converted into 1% health."
 *
 * Free, instant, three minutes, Bear and Dire Bear only.
 *
 * IN SCOPE BY THE RULESET OWNER'S RULING, and healing THROUGHPUT is otherwise
 * ruled out. The reason it is not that case: this is a RAGE SINK as much as a
 * heal. Ten rage a second for ten seconds is a hundred rage, which is the whole
 * bar and every Maul and Lacerate it would have bought -- so it costs the Bear
 * damage, which is exactly the kind of effect a damage profile has to model.
 * The owner's own words: "meant to work alongside a healer."
 *
 * "UP TO" IS LOAD-BEARING. It converts what is THERE, so a Bear at 30 rage
 * converts 30 and no more, and the tick has to read the pool rather than
 * assume it. A fixed ten a second would heal a starved Bear for rage it never
 * had.
 *
 * THE DRAIN GOES THROUGH THE CONTEXT, not `Resource.drain`. Draining directly
 * is invisible to the resource panel, and this project has been here before:
 * combo points once reported 23 gained and none spent because a finisher
 * drained the pool behind the telemetry's back, which looks exactly like a
 * rotation that never casts one.
 * ============================================================================
 */
export const FRENZIED_REGENERATION_DURATION_MS = seconds(10);
export const FRENZIED_REGENERATION_COOLDOWN_MS = seconds(180);
export const FRENZIED_REGENERATION_TICK_INTERVAL_MS = seconds(1);
export const FRENZIED_REGENERATION_RAGE_PER_TICK = 10;
/** "Each point of Rage is converted into 1% health." */
export const FRENZIED_REGENERATION_HEALTH_PER_RAGE = 0.01;

export const FRENZIED_REGENERATION: AuraDefinition = {
  id: 'frenzied_regeneration',
  name: 'Frenzied Regeneration',
  durationMs: FRENZIED_REGENERATION_DURATION_MS,
  periodic: {
    intervalMs: FRENZIED_REGENERATION_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const actor = context.combatant(aura.targetId);
      if (!actor) return;

      const rage = actor.resources.get('rage');
      const available = Math.min(rage?.current ?? 0, FRENZIED_REGENERATION_RAGE_PER_TICK);
      if (available <= 0) return;

      context.spendResource(actor, 'rage', available, {
        id: 'frenzied_regeneration',
        name: 'Frenzied Regeneration',
      });
      applyHealing(context, {
        source: actor,
        target: actor,
        abilityId: 'frenzied_regeneration',
        abilityName: 'Frenzied Regeneration',
        baseAmount: actor.health.maximum * FRENZIED_REGENERATION_HEALTH_PER_RAGE * available,
        periodic: true,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Feral: Predatory Discipline
// ---------------------------------------------------------------------------

/*
 * ============================================================================
 * BERSERK IS GONE, removed from the tree at client build 1.60.1.70707 with the
 * aura, its +100 crit on the combo point generators and its three-target Primal
 * Bite. What took its row is Shifting Power, moved down to the capstone row
 * beside Primal Bite and requiring the talent below.
 *
 * PREDATORY DISCIPLINE: "Your Ferocious Bite ability no longer converts extra
 * Energy into damage, but still deals extra damage based on your excess
 * Energy."
 *
 * A MARKER RATHER THAN A STAT, which is the Leader of the Pack arrangement with
 * nothing on it: Ferocious Bite asks whether its carrier holds this aura, and
 * keeps the energy above its cost where it would otherwise spend it. The
 * damage is unchanged -- 2.7 per excess point, read off the bar as before --
 * so what the talent changes is the PRICE of the bonus, from all of it to none.
 * ============================================================================
 */
export const PREDATORY_DISCIPLINE_AURA_ID = 'predatory_discipline';

export const PREDATORY_DISCIPLINE_AURA: AuraDefinition = {
  id: PREDATORY_DISCIPLINE_AURA_ID,
  name: 'Predatory Discipline',
  // Permanent: it is a passive, not something applied and lost.
  durationMs: 0,
};

/*
 * ============================================================================
 * NATURE'S GRACE: "All non-periodic spell criticals grace you with a blessing
 * of nature, increasing your spellcasting speed and reducing your global
 * cooldown by 10% for 3 sec."
 *
 * ONE SENTENCE, TWO EFFECTS, and they are not the same effect said twice.
 * Haste shortens a CAST here and deliberately does not touch the global
 * cooldown -- a rule with its own long comment in `casting.ts`. So folding the
 * second clause into the haste rating would make every other haste source
 * shorten the global cooldown as well, which is a much larger change wearing
 * this talent's name. `gcdFraction` is the field the second clause wanted and
 * it did not exist.
 *
 * NOT CLASSIC'S TALENT, AND THIS FILE HAD IT WRONG ONCE. Classic's Nature's
 * Grace shortens the NEXT cast by half a second and is a one-shot charge --
 * the Eclipse shape. Forever's is a three-second window, which wants a
 * reaction and an aura rather than a cast modifier. That was recorded in the
 * talent's own `unmodelled` reason after the mistake was caught.
 *
 * HASTE AS A RATING rather than as a percentage, converted with the same
 * constant `hasteMultiplierFrom` divides by, so the round trip is exact
 * whatever that constant is set to. Copied in spirit from the Shaman's, which
 * copied it from the Warrior's Flurry.
 * ============================================================================
 */
export const NATURES_GRACE_DURATION_MS = seconds(3);
export const NATURES_GRACE_PERCENT = 10;

export function naturesGraceAura(percentValue: number): AuraDefinition {
  return {
    id: 'natures_grace',
    name: "Nature's Grace",
    durationMs: NATURES_GRACE_DURATION_MS,
    refreshBehaviour: 'reset',
    /*
     * ITS CASTING SPEED NOW SHORTENS THE GLOBAL COOLDOWN TOO (round 75), as all
     * haste does, so "and reducing your global cooldown by 10%" is the same
     * effect said twice. The `gcdFraction` that carried it alone is gone, or
     * the cooldown would be cut by both: 1.5 / 1.1 x 0.9 rather than 1.5 / 1.1.
     */
    statModifiers: [flat('hasteRating', percentValue * RATING_PER_PERCENT.haste)],
  };
}

/** The stated shape, for anything that only needs the id. */
export const NATURES_GRACE: AuraDefinition = naturesGraceAura(NATURES_GRACE_PERCENT);

// ---------------------------------------------------------------------------

function tick(
  context: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[0],
  aura: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[1],
  amount: number,
  school: typeof ARCANE | typeof NATURE | typeof PHYSICAL,
  critFrom: 'spell' | 'melee-special' = 'spell',
  powerCoefficient = 0,
  /*
   * A SHARE OF A WEAPON SWING, for the one bleed that states one.
   *
   * Lacerate is "10% weapon damage per existing application", which is a
   * weapon fraction rather than an attack power coefficient -- so it goes
   * through `weaponScaling` the way every weapon-damage ability does, and
   * attack power reaches it through the weapon at `speed / 14`.
   */
  weaponFraction = 0,
): void {
  const source = context.combatant(aura.sourceId);
  const target = context.combatant(aura.targetId);
  if (!source || !target || !target.isAlive) return;

  dealDamage(context, {
    source,
    target,
    abilityId: aura.id,
    abilityName: aura.name,
    school,
    baseAmount: amount,
    /*
     * DEFAULTS TO NONE, AND THE BLEEDS KEEP THAT.
     *
     * Rake, Rip and Lacerate are PHYSICAL and say "increased by your Attack
     * Power" without stating a number, so none is invented -- the same
     * decision Rupture and Rend carry, and the spell coefficient rule does
     * not reach them because they are not spells.
     *
     * The two SPELL effects here, Moonfire's burn and Insect Swarm, are
     * passed one.
     */
    powerCoefficient,
    ...(weaponFraction > 0
      ? { weaponScaling: { slot: 'mainHand' as const, fraction: weaponFraction } }
      : {}),
    periodic: true,
    critFrom,
    // A bleed is physical and still ignores armor; a magical tick is not
    // reduced by armor in the first place.
    appliesArmor: false,
    /*
     * INSECT SWARM'S TICKS TAKE THE TARGET'S FULL RESISTANCE, where most DoT
     * ticks take a tenth: 25.6% resisted on ticks against 25.0% on the same
     * mobs' direct hits (wowsims/forever#76). Named rather than derived -- the
     * logs do not say why it escapes the tenth rule.
     */
    ...(aura.id === 'insect_swarm' ? { fullResistanceTicks: true } : {}),
  });
}

/**
 * The same aura, lasting longer -- Nature's Splendor's whole effect.
 *
 * ----------------------------------------------------------------------------
 * IT ADDS TICKS AT THE SAME RATE, WHICH IS THE WHOLE POINT. Every DoT here
 * computes its per-tick figure inside `onTick` from its own CONSTANTS, not
 * from the instance -- so lengthening a Moonfire from 12 seconds to 15 gives a
 * fifth tick of the same size rather than spreading the same total thinner.
 * That is what "increases the duration" means, and the other reading would
 * make the talent worth exactly nothing.
 *
 * A NEW DEFINITION RATHER THAN A MUTATION. `MOONFIRE_DOT` is a module-level
 * constant shared by every Druid in a batch, and a talent that edited it would
 * lengthen Moonfire for the untalented character in the next iteration -- the
 * same shape as the shared-closure bug that stopped Windfury proccing after
 * the first fight of a batch.
 *
 * THE ID IS UNCHANGED, deliberately: the priority lists ask `expired('moonfire')`
 * and the damage breakdown groups by it. A lengthened Moonfire is a Moonfire.
 * ----------------------------------------------------------------------------
 */
export function lengthened(aura: AuraDefinition, extraSeconds: number): AuraDefinition {
  if (extraSeconds <= 0) return aura;
  return { ...aura, durationMs: aura.durationMs + seconds(extraSeconds) };
}

/*
 * ============================================================================
 * NATURE'S SWIFTNESS: "When activated, your next Nature spell becomes an
 * instant cast spell."
 *
 * A ONE-SHOT CAST-TIME MODIFIER, and this was the gap Eclipse named when it
 * arrived -- "the first such gap in the project", said twice in
 * `druidEffects.ts` and once on the Shaman's talent of the same name. The rule
 * was built for Eclipse and this is its second caller, so nothing new is
 * needed: an aura with a `castModifier` naming the abilities, consumed by the
 * cast that uses it.
 *
 * `castTimeFraction: 1` IS THE WHOLE CAST, not a reduction. `resolveCast`
 * multiplies the base cast time by `1 - fraction`, so one is instant.
 *
 * WHICH SPELLS ARE NATURE. Wrath and Insect Swarm, off their own `school`
 * declarations; Starfire and Moonfire are ARCANE and are correctly not here,
 * which is what stops this shortening the Moonkin's main nuke. Healing Touch
 * and Regrowth joined in round 71, when the Resto Drood took the talent.
 * ============================================================================
 */
export const NATURES_SWIFTNESS_COOLDOWN_MS = seconds(180);

/**
 * The Druid's NATURE spells, which is what the talent selects: Wrath and Insect
 * Swarm, and since round 71 the Nature HEALS with a cast time -- Healing Touch,
 * Regrowth, and Wild Growth since it became a three second cast at
 * 1.60.1.70707. Rejuvenation is Nature too, and instant, so `requiresCastTime`
 * keeps it from spending the charge.
 */
export const NATURE_SPELLS: readonly string[] = ['wrath', 'insect_swarm', 'healing_touch', 'regrowth', 'wild_growth'];

export const NATURES_SWIFTNESS: AuraDefinition = {
  id: 'natures_swiftness',
  name: "Nature's Swiftness",
  // Until it is spent. No duration is stated and none would mean anything.
  durationMs: 0,
  castModifier: {
    abilityIds: NATURE_SPELLS,
    castTimeFraction: 1,
    /*
     * ONLY A SPELL THAT HAS A CAST TIME SPENDS IT. Forever's wording drops
     * Classic's "with a casting time less than 10 sec", but the reading is the
     * same and the field exists: without it the charge is eaten by the next
     * Insect Swarm, which is instant already -- an aura spent for nothing,
     * which looks exactly like one that worked.
     */
    requiresCastTime: true,
    /*
     * `'all'` AND NOT `'stack'`: the tooltip is "your NEXT Nature spell", one
     * cast, and there is only ever one charge. Spending a stack where the
     * effect spends all of them is the mistake this field exists to make
     * expressible -- it reads as a working talent worth several times its value.
     */
    consumedByCast: 'all',
  },
};

function clampIndex(comboPoints: number): number {
  return Math.max(1, Math.min(5, Math.floor(comboPoints))) - 1;
}

export const DRUID_AURAS: readonly AuraDefinition[] = [
  MOONFIRE_DOT,
  INSECT_SWARM,
  // Eclipse is built from its rank, so the list carries the rank-3 shape --
  // this is a catalogue of the auras that exist, not a source of live ones.
  eclipseAura(ECLIPSE_RANK_3_SECONDS),
  RAKE_DOT,
  LACERATE,
  DEMORALIZING_ROAR,
];

/*
 * ----------------------------------------------------------------------------
 * THE AURAS THIS MODULE BUILDS WITH A FACTORY, LISTED SO THE PANEL CAN OFFER
 * THEM.
 *
 * `auraCatalog` finds an aura by walking a module's exports and keeping
 * whatever looks like an `AuraDefinition`. That finds every aura declared as a
 * constant and NONE built by a function -- which silently cost the dropdowns 20
 * auras across nine classes, Rip and Deep Wounds and Ignite among them. Rip is
 * how it was noticed: a Druid could not gate Rip on Rip already being up, which
 * is the single most ordinary thing a feral rotation does.
 *
 * THE ARGUMENT IS REPRESENTATIVE AND ONLY THE ID, NAME AND `isDebuff` ARE READ,
 * none of which depends on it. It lives here rather than in the catalog because
 * what a sensible argument IS belongs next to the factory -- the catalog would
 * otherwise be guessing, and a factory that gained a required argument would
 * break it from a distance.
 * ----------------------------------------------------------------------------
 */
/* -------------------------------------------------------------------------- */
/* Restoration (round 71): the Resto Drood profile's heals over time          */
/* -------------------------------------------------------------------------- */

/**
 * One tick of a Druid heal over time: a share of the stated total plus the
 * owner's per-tick coefficient, on the person carrying it.
 *
 * THE TICK CARRIES THE ABILITY'S OWN ID, so every per-ability modifier reaches
 * it -- Gift of Nature, Improved Rejuvenation, Improved Regrowth's crit -- and
 * it reports on the same row as the cast. A TICK CAN CRIT, the owner's: "All
 * of the HoT effects can crit." `periodic` is what Genesis's healing half reads.
 */
function hotTick(
  context: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[0],
  aura: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[1],
  baseAmount: number,
  coefficient: number,
): void {
  const source = context.combatant(aura.sourceId);
  const target = context.combatant(aura.targetId);
  if (!source || !target || !target.isAlive) return;
  applyHealing(context, {
    source,
    target,
    abilityId: aura.id,
    abilityName: aura.name,
    baseAmount,
    powerCoefficient: coefficient,
    periodic: true,
    threatens: true,
  });
}

/**
 * Rejuvenation, rank 11: "Heals the target for 776 over 12 sec." Four ticks,
 * one every three seconds, of a quarter each and 20% of healing power.
 *
 * NATURE'S SPLENDOR'S +3 SECONDS IS ONE MORE TICK OF THE SAME SIZE, which is
 * `lengthened` -- the per-tick figure is the BASE total over the BASE ticks,
 * so a longer Rejuvenation heals more rather than spreading 776 thinner.
 */
export const REJUVENATION_TOTAL = 776;
export const REJUVENATION_DURATION_MS = seconds(12);
export const REJUVENATION_TICK_INTERVAL_MS = seconds(3);
export const REJUVENATION_TICK = REJUVENATION_TOTAL / (REJUVENATION_DURATION_MS / REJUVENATION_TICK_INTERVAL_MS);

export const REJUVENATION_HOT: AuraDefinition = {
  id: 'rejuvenation',
  name: 'Rejuvenation',
  durationMs: REJUVENATION_DURATION_MS,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: REJUVENATION_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      hotTick(context, aura, REJUVENATION_TICK, REJUVENATION_TICK_HEAL_COEFFICIENT),
  },
};

/**
 * Regrowth's heal over time: "another 994 over 21 sec" -- seven ticks, one
 * every three seconds, at 7.1% of healing power each. Nature's Splendor's +6
 * seconds is two more of the same.
 */
export const REGROWTH_HOT_TOTAL = 994;
export const REGROWTH_HOT_DURATION_MS = seconds(21);
export const REGROWTH_TICK_INTERVAL_MS = seconds(3);
export const REGROWTH_TICK = REGROWTH_HOT_TOTAL / (REGROWTH_HOT_DURATION_MS / REGROWTH_TICK_INTERVAL_MS);

export const REGROWTH_HOT: AuraDefinition = {
  id: 'regrowth',
  name: 'Regrowth',
  durationMs: REGROWTH_HOT_DURATION_MS,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: REGROWTH_TICK_INTERVAL_MS,
    onTick: (context, aura) => hotTick(context, aura, REGROWTH_TICK, REGROWTH_TICK_HEAL_COEFFICIENT),
  },
};

/**
 * Wild Growth, rank 3: "Heals the target and their party for 679 over 7 sec.
 * The amount healed is applied quickly at first, and slows down as Wild Growth
 * reaches its full duration."
 *
 * ============================================================================
 * THE FALLOFF IS THE OWNER'S: each tick is (679 / 7 + 3.3% of healing power)
 * times 1.06 on the first tick, 1.04 on the second, 1.02 on the third and so
 * on, two points less each tick -- 1.06 down to 0.94 over seven, which sums to
 * exactly seven, so the falloff moves the healing EARLIER without changing the
 * total.
 *
 * WHICH TICK THIS IS comes from the time left: the first lands with six
 * seconds to go and the seventh as it expires (a tick due at the moment an aura
 * falls off still lands). A recast resets the window and starts the falloff
 * again.
 * ============================================================================
 */
export const WILD_GROWTH_TOTAL = 679;
export const WILD_GROWTH_TICKS = 7;
export const WILD_GROWTH_TICK_INTERVAL_MS = seconds(1);
export const WILD_GROWTH_FALLOFF_FIRST = 0.06;
export const WILD_GROWTH_FALLOFF_STEP = 0.02;

/** The falloff factor of a tick, counting from 0: 1.06, 1.04, ... 0.94. */
export function wildGrowthFalloff(tickIndex: number): number {
  return 1 + WILD_GROWTH_FALLOFF_FIRST - WILD_GROWTH_FALLOFF_STEP * tickIndex;
}

export const WILD_GROWTH_HOT: AuraDefinition = {
  id: 'wild_growth',
  name: 'Wild Growth',
  durationMs: WILD_GROWTH_TICKS * WILD_GROWTH_TICK_INTERVAL_MS,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: WILD_GROWTH_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const left = Math.round((aura.expiresAt - context.clock.now()) / WILD_GROWTH_TICK_INTERVAL_MS);
      const factor = wildGrowthFalloff(WILD_GROWTH_TICKS - 1 - left);
      hotTick(
        context,
        aura,
        (WILD_GROWTH_TOTAL / WILD_GROWTH_TICKS) * factor,
        WILD_GROWTH_TICK_HEAL_COEFFICIENT * factor,
      );
    },
  },
};

/**
 * Innervate: "Increases the target's Mana regeneration by 400% and allows 100%
 * of the target's Mana regeneration to continue while casting. Lasts 20 sec."
 * Evocation's two fields: 400% MORE is five times, and the bypass is full.
 * Cast on the Druid itself -- the healer is the one whose mana runs out.
 */
export const INNERVATE_DURATION_MS = seconds(20);
export const INNERVATE_REGEN_MULTIPLIER = 5;
export const INNERVATE_REGEN_BYPASS = 100;

export const INNERVATE_AURA: AuraDefinition = {
  id: 'innervate',
  name: 'Innervate',
  durationMs: INNERVATE_DURATION_MS,
  statModifiers: [flat('manaRegenBypass', INNERVATE_REGEN_BYPASS)],
  resourceRegenMultiplier: { mana: INNERVATE_REGEN_MULTIPLIER },
};

export const CATALOG_AURAS: readonly AuraDefinition[] = [
  ripAura(0),
];
