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
 * THE PARTY CRIT AURA: ONE AURA, THREE SOURCES, 3% ONCE.
 *
 * Moonkin Aura and Leader of the Pack each put +3% critical strike chance on
 * everyone within 45 yards, and each tooltip says it is "exclusive with" the
 * other. A character can meet it three ways: the Moonkin Form talent, the
 * Leader of the Pack talent, or either of the two raid buff entries.
 *
 * THE RULESET OWNER'S RULING IS THAT THEY ARE ONE THING. "These are all the
 * same exclusive 3% global critical strike chance and do not stack." So this is
 * ONE `AuraDefinition` with ONE id, and every source applies that one --
 * `AuraCollection.apply` refreshes a matching id instead of stacking a second
 * instance, so any combination of the three is 3% and no rule has to be
 * remembered anywhere.
 *
 * ----------------------------------------------------------------------------
 * IT WAS TWO AURAS AND IT DOUBLE-DIPPED, which is why this is now structural
 * rather than a selection rule. The earlier arrangement shared an id between
 * each TALENT and the raid buff OF THE SAME NAME, which closed two of the three
 * combinations and left the third wide open: a Moonkin carrying its own
 * `moonkin_form` aura in a raid that selected `leader_of_the_pack` held two
 * different ids and read **+6% crit**. Measured, not suspected -- 21.243%
 * spell crit against 24.243%.
 *
 * The older ruling was "they don't stack, but that can be handled on the GUI",
 * and `withRaidBuff` does switch one off when the other goes on. That was only
 * ever half the surface: it governs two raid buff entries and knows nothing
 * about a TALENT, and nothing at all about a profile loaded from JSON with both
 * ids in its list. A GUI rule cannot cover a source the GUI does not own.
 *
 * THE TWO RAID BUFF ENTRIES STILL EXIST SEPARATELY, and should: a raid is
 * composed by choosing which druid turned up, and the panel names both. They
 * keep `exclusiveWith` so the selection still reads correctly. What changed is
 * that choosing wrongly can no longer be worth anything.
 * ----------------------------------------------------------------------------
 *
 * THE NAME CARRIES BOTH, because one aura cannot be called after one source.
 * It surfaces in the combat log's line at the pull and nowhere else: a
 * permanent aura is never removed, so `auraUptime` filters it out -- it only
 * totals a span when an `aura_removed` closes one. A reader of the log sees one
 * line and the reason there is one line.
 * ============================================================================
 */

/** Percentage POINTS, stated by both tooltips. */
export const PARTY_CRIT_AURA_PERCENT = 3;

/**
 * The id every source applies, and the whole of the no-double-dip rule.
 *
 * Named apart from the two RAID BUFF ids -- which are still `moonkin_form` and
 * `leader_of_the_pack`, because those name a CHOICE in the panel rather than an
 * effect on a character. Reusing either one here would have made the aura look
 * like it belonged to one source.
 */
export const PARTY_CRIT_AURA_ID = 'party_crit_aura';

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
 * ITS HEALING HALF IS OUT OF SCOPE like every healing clause -- a heal has no
 * attack table, so `requiresAttackTable` excludes one. No Druid profile heals,
 * so nothing is lost today, and the day one does this is the line to revisit.
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
    costFraction: 1,
    /*
     * ONE CAST, because the tooltip says "your NEXT". Spending a stack where
     * the effect spends all of them leaves the rest behind, which reads as a
     * working effect worth several times its value.
     */
    consumedByCast: 'all',
  },
};

export const PARTY_CRIT_AURA: AuraDefinition = {
  id: PARTY_CRIT_AURA_ID,
  name: 'Moonkin Aura / Leader of the Pack',
  // As long as the druid is there, which is the whole fight.
  durationMs: 0,
  statModifiers: [
    flat('critChance', PARTY_CRIT_AURA_PERCENT),
    flat('spellCritChance', PARTY_CRIT_AURA_PERCENT),
  ],
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
// Feral: Berserk, which belongs to both forms
// ---------------------------------------------------------------------------

/*
 * ===================================================================== * BERSERK: "Causes your Primal Bite ability to strike up to 3 targets, removes
 * its cooldown, and increases the critical strike chance of your Combo
 * Point-generating abilities by 100%. Clears and grants immunity to Fear
 * effects for the duration. Lasts 15 sec."
 *
 * FOUR CLAUSES AND THEY LAND IN FOUR DIFFERENT PLACES, which is why this is a
 * long comment for a short aura.
 *
 *   3 TARGETS      unmodelled. Every encounter here has one.
 *   NO COOLDOWN    `suppressesCooldownOf`, an aura field that did not exist:
 *                  `CastModifier` carries cast time and cost, and an ability's
 *                  cooldown lives in the `AbilityBook` where no aura reached.
 *                  This is the BEAR's half -- Primal Bite is `mangle`, a rage
 *                  ability, and a Cat never casts it.
 *   +100% CRIT     `abilityModifiers`, the other aura field that did not
 *                  exist. This is the CAT's half: a Bear has no combo point
 *                  generators at all. One ability, two builds, and each gets
 *                  one half of it.
 *   FEAR IMMUNITY  crowd control, and permanently out of scope by ruling.
 *
 * +100 PERCENTAGE POINTS, NOT A DOUBLING, by the ruleset owner's ruling. So
 * Shred, Claw and Rake crit every time for fifteen seconds rather than going
 * from thirty percent to sixty. Both readings produce a plausible number and
 * the wording carries neither, which is why it was asked rather than chosen.
 *
 * THE GENERATORS ARE DERIVED, NOT LISTED. `comboPointsAwarded` is already
 * declared on every ability that awards one, so a new generator is covered on
 * the day it lands -- the same argument `triggersGcd` makes about
 * `onNextSwing`. Listing three ids by hand is how a fourth gets missed
 * silently, and a missed one looks exactly like an ability that simply did not
 * crit this time.
 * ============================================================================
 */
export const BERSERK_DURATION_MS = seconds(15);
export const BERSERK_COOLDOWN_MS = seconds(180);
/** Percentage POINTS, matching `critChance` on the stat block. */
export const BERSERK_CRIT_BONUS = 100;

/** The ability Berserk frees, by the id it carries here. */
export const BERSERK_FREED_ABILITY = 'mangle';

export function berserkAura(comboPointGenerators: readonly string[]): AuraDefinition {
  return {
    id: 'berserk',
    name: 'Berserk',
    durationMs: BERSERK_DURATION_MS,
    suppressesCooldownOf: [BERSERK_FREED_ABILITY],
    abilityModifiers: Object.fromEntries(
      comboPointGenerators.map((id) => [id, { critBonus: BERSERK_CRIT_BONUS }]),
    ),
  };
}

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
    statModifiers: [flat('hasteRating', percentValue * RATING_PER_PERCENT.haste)],
    gcdFraction: percentValue / 100,
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
 * which is what stops this shortening the Moonkin's main nuke. The healing
 * Nature spells the tooltip also covers are out of scope like every heal.
 *
 * NO DRUID PROFILE TAKES IT. That is a statement about the three builds and not
 * about this: the talent is real, tested on its mechanism, and worth nothing to
 * a Moonkin that spent its thirteen Restoration points elsewhere.
 * ============================================================================
 */
export const NATURES_SWIFTNESS_COOLDOWN_MS = seconds(180);

/** The Druid's damaging NATURE spells, which is what the talent selects. */
export const NATURE_SPELLS: readonly string[] = ['wrath', 'insect_swarm'];

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
export const CATALOG_AURAS: readonly AuraDefinition[] = [
  ripAura(0),
  berserkAura([]),
];
