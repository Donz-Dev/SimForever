import type { AuraDefinition } from '../../engine';
import { applyHealing, dealDamage, flat, percent, seconds } from '../../engine';
import {
  INSECT_SWARM_TICK_SP_COEFFICIENT,
  MOONFIRE_SP_COEFFICIENT,
  MOONFIRE_TICK_SP_COEFFICIENT,
} from '../combat/coefficients';
import {
  LACERATE_TICK_WEAPON_FRACTION_PER_APPLICATION,
  RAKE_TICK_AP_COEFFICIENT,
  RIP_TICK_AP_COEFFICIENT_PER_COMBO_POINT,
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

export function ripAura(comboPoints: number): AuraDefinition {
  const total = RIP_BY_COMBO_POINT[clampIndex(comboPoints)];
  const perTick = total / (RIP_DURATION_MS / RIP_TICK_INTERVAL_MS);

  return {
    id: 'rip',
    name: 'Rip',
    durationMs: RIP_DURATION_MS,
    isDebuff: true,
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
           * 4% OF ATTACK POWER PER COMBO POINT SPENT, PER TICK -- so a
           * five-point Rip carries 20% on every one of its eight ticks.
           *
           * The points are read from the aura's OWN combo points rather than
           * the character's, because the character has spent them: `ripAura`
           * is built with what was spent and its ticks land long afterwards.
           */
          RIP_TICK_AP_COEFFICIENT_PER_COMBO_POINT * (clampIndex(comboPoints) + 1),
        ),
    },
  };
}

/** "Increases Physical damage done by 15% for 6 sec." */
export const TIGERS_FURY_DAMAGE = 1.15;
export const TIGERS_FURY_DURATION_MS = seconds(6);

export const TIGERS_FURY: AuraDefinition = {
  id: 'tigers_fury',
  name: "Tiger's Fury",
  durationMs: TIGERS_FURY_DURATION_MS,
  damageDoneMultiplier: TIGERS_FURY_DAMAGE,
};

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
 * ============================================================================
 * BERSERK: "Causes your Primal Bite ability to strike up to 3 targets, removes
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
  TIGERS_FURY,
  LACERATE,
  DEMORALIZING_ROAR,
];
