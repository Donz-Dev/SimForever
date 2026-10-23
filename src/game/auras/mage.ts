import type { AuraDefinition, DamageSchool } from '../../engine';
import { ALL_ABILITIES, dealDamage, flat, seconds } from '../../engine';
import {
  FIREBALL_SP_COEFFICIENT,
  FIREBALL_TICK_SP_COEFFICIENT,
  FROSTFIRE_BOLT_SP_COEFFICIENT,
  FROSTFIRE_BOLT_TICK_SP_COEFFICIENT,
  PYROBLAST_SP_COEFFICIENT,
  PYROBLAST_TICK_SP_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Mage auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * Captured in `src/data/abilities/forever-mage-spellbook.json` at MAX RANK.
 *
 * ----------------------------------------------------------------------------
 * THE FIRST CLASS WHOSE TALENTS ARE MOSTLY SCHOOLS. Fire Power, Piercing Ice,
 * Critical Mass, Arcane Impact, Ice Shards and Arcane Mind all read "your Fire
 * spells" or "your Frost spells" or "your Arcane spells", which is why
 * `SchoolModifiers` exists -- and why building it first meant the Druid's
 * Moonfury and the Shaman's Elemental Fury were fixed on the way past.
 *
 * WHAT IS HERE AND WHAT IS NOT. The Mage's damage is three nukes and a handful
 * of effects that ride on their crits: Ignite, Heating Up and Combustion all
 * fire off a critical strike and all three are here. What is NOT here is
 * everything keyed on a FROZEN target -- see `FROZEN_UNMODELLED`.
 * ----------------------------------------------------------------------------
 */

const ARCANE = 'arcane' as const;
const FIRE = 'fire' as const;

/**
 * Nothing freezes a raid boss, and ONE Frost talent depends on one.
 *
 * ----------------------------------------------------------------------------
 * THIS COMMENT SAID FOUR UNTIL THE TALENTS WERE RE-READ, and it named Shatter,
 * Fingers of Frost, Frostbite and Ice Lance's 300% clause. Three of the four
 * were wrong and had been for as long as Fingers of Frost existed:
 *
 *   Fingers of Frost  does not freeze anything. It puts a state on the MAGE
 *                     that makes its next spells behave as though the target
 *                     were frozen, which is reachable exactly as written.
 *   Shatter           reads that state, through `critWhileAura`.
 *   Ice Lance         takes its times-four inside that same window.
 *
 * FROSTBITE IS THE ONLY ONE LEFT: "gives your Chill effects a chance to Freeze
 * the target". A boss is immune to every root and freeze in the game, and this
 * project models one target which is a raid boss.
 *
 * SO IT IS INERT BECAUSE OF THE TARGET rather than because of the engine --
 * a different claim and a more durable one. The day an encounter has a
 * freezable target it becomes reachable with nothing else changing.
 *
 * AND NO MAGE PROFILE TAKES IT, which is a second and independent reason it
 * costs the baseline nothing: the Frostfire build is 0/29/22 and spends none
 * of its Frost points here. The old header in `abilities/mage.ts` claimed
 * this cluster cost that build three talents; it costs it none.
 * ----------------------------------------------------------------------------
 */
export const FROZEN_UNMODELLED =
  'It applies only to a FROZEN target. Nothing freezes a raid boss, and every ' +
  'encounter here is one, so this is inert because of the target rather than ' +
  'because of the engine. Whether a talent whose whole effect is a ROOT is ' +
  'covered by the crowd-control ruling instead is a question for the ruleset ' +
  'owner: the root itself is out of scope, and what a Mage buys with it is ' +
  'damage.';

/**
 * One periodic tick of a magical damage-over-time effect.
 *
 * THE COEFFICIENT IS PER TICK and is passed in, because each of these three is
 * the DoT half of a hybrid: the cast and the burn share one spell's scaling
 * between them, so the burn's share cannot be derived from the aura alone.
 * See `hybridSpellCoefficients`.
 */
function tick(
  context: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[0],
  aura: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[1],
  amount: number,
  school: typeof ARCANE | typeof FIRE,
  powerCoefficient: number,
  options: { readonly canCrit?: boolean; readonly countsAsSchools?: readonly DamageSchool[] } = {},
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
    powerCoefficient,
    periodic: true,
    /*
     * EVERY DoT IN THIS RULESET CAN CRIT, AND IGNITE IS THE EXCEPTION. The
     * field is OMITTED rather than set to anything, which is how "cannot crit"
     * is said here -- and it also means the tick draws no random number, so
     * adding or removing it cannot shift a seeded run.
     */
    ...(options.canCrit === false ? {} : { critFrom: 'spell' as const }),
    countsAsSchools: options.countsAsSchools,
    appliesArmor: false,
  });
}

// ---------------------------------------------------------------------------
// The damage-over-time halves of the nukes
// ---------------------------------------------------------------------------

/*
 * ----------------------------------------------------------------------------
 * THE THREE HYBRID PAIRS LIVE HERE, BESIDE THE DoT HALF, and the ability file
 * imports them. Both halves of a hybrid come out of ONE call, so the cast and
 * the burn cannot end up weighted against different assumptions -- which is
 * the only failure of this rule that would look entirely normal.
 *
 * THE CAST TIME IS THE BASE ONE, declared here and used by the ability for its
 * own `castTimeMs` as well. Reading `ability.castTimeMs` inside `onCast`
 * instead would read the TALENT-REDUCED time, and Improved Fireball would then
 * quietly REDUCE Fireball's scaling -- a cast-time talent making a spell worse
 * with gear, at a number nobody would question.
 * ----------------------------------------------------------------------------
 */

/**
 * Fireball's burn: "an additional 60 Fire damage over 8 sec".
 *
 * TWO SECONDS, WHICH IS THE ONLY CADENCE THAT DIVIDES EVENLY into four ticks
 * of 15. Three would leave 2.67 ticks and four would leave two of 30 -- also
 * whole, but a four-second cadence on an eight-second effect is not a shape
 * this data set uses anywhere else. Same argument as Flame Shock's.
 */
export const FIREBALL_DOT_TOTAL = 60;
export const FIREBALL_DOT_DURATION_MS = seconds(8);
export const FIREBALL_TICK_INTERVAL_MS = seconds(2);

/** Fireball: a 3.5-second cast leaving an 8-second burn in four ticks. */
export const FIREBALL_CAST_MS = seconds(3.5);
/*
 * THE BURN TAKES NOTHING, by the sheet, and the hit takes the lot.
 *
 * The old hybrid rule gave the burn 35% of the spell's scaling for 11% of its
 * damage -- a consequence this project documented and left alone because the
 * rule came from the owner. The sheet settles it the other way, and the way
 * Classic does: 0.84 on the hit and zero on the burn.
 */
export const FIREBALL_COEFFICIENTS = {
  direct: FIREBALL_SP_COEFFICIENT,
  perTick: FIREBALL_TICK_SP_COEFFICIENT,
};

/**
 * The Mage's Fire effects a target can carry, for Fire Power's COUNT.
 *
 * ==============================================================================
 * "3% per your Fire effects on the target, up to a maximum increase of 12%.
 * Effects which mix multiple schools of magic do not qualify."
 *
 * NAMED RATHER THAN DERIVED, which is `WARLOCK_SOUL_SIPHON_EFFECTS`' arrangement
 * and for the identical reason: an `AuraDefinition` carries no school, because
 * the school of a periodic effect is decided inside its own `onTick`. A
 * derivation that has to RUN the effect to answer is not a derivation -- the
 * argument `isBleed` already makes about "physical, periodic and ignoring
 * armor".
 *
 * ------------------------------------------------------------------------------
 * FOUR ENTRIES, AND FOUR IS EXACTLY THE CAP AT 3/3. 3% each with a 12% ceiling
 * means the fourth effect is the last one that pays, so a fully-loaded target
 * sits precisely on the maximum and a fifth would be worth nothing. That is the
 * same coincidence Soul Siphon has -- three effects reaching a 36% cap at 12%
 * each -- and it has the same consequence: **the cap is never the binding
 * constraint, so a reading error in the list is invisible while everything is
 * up** and only shows in the window where one has dropped.
 *
 * FROSTFIRE BOLT'S DoT IS DELIBERATELY ABSENT, and it is the whole of the
 * tooltip's last sentence. It ticks Fire damage and `countsAsSchools` says it
 * is also Frost, so it is an effect that mixes two schools and does not
 * qualify. **The exclusion is enforced by this list rather than by a check**,
 * which is why it is written here: a reader adding the next Fire DoT has to
 * decide the same question, and there is nothing in the code to remind them.
 *
 * AND THE ASYMMETRY IS THE PART TO HOLD ON TO: a Frostfire Bolt still COLLECTS
 * Fire Power, because the spell is a Fire spell. It just does not contribute to
 * the count. See `perTargetEffectMultiplier`.
 *
 * ------------------------------------------------------------------------------
 * WHAT IT MAY BE MISSING. Fireball's and Pyroblast's burns and Ignite are every
 * Fire DoT this project declares; `fire_vulnerability` is Improved Scorch's
 * debuff, which is a Fire effect the Mage put on the target and is counted on
 * that reading. Blast Wave and Flamestrike leave nothing behind, and Living
 * Bomb does not exist in this ruleset. **If the ruleset counts something this
 * list does not, the talent is worth LESS than it should be** -- a smaller
 * number and no error -- so the talent's own `unmodelled`-free declaration is
 * paired with this note rather than with a claim of completeness.
 * ==============================================================================
 */
export const MAGE_FIRE_POWER_EFFECTS: readonly string[] = [
  'fireball',
  'pyroblast',
  'ignite',
  'fire_vulnerability',
];

export const FIREBALL_DOT: AuraDefinition = {
  id: 'fireball',
  name: 'Fireball',
  durationMs: FIREBALL_DOT_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: FIREBALL_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      tick(
        context,
        aura,
        FIREBALL_DOT_TOTAL / (FIREBALL_DOT_DURATION_MS / FIREBALL_TICK_INTERVAL_MS),
        FIRE,
        FIREBALL_COEFFICIENTS.perTick,
      ),
  },
};

/** Pyroblast's burn: "an additional 212 Fire damage over 12 sec". */
export const PYROBLAST_DOT_TOTAL = 212;
export const PYROBLAST_DOT_DURATION_MS = seconds(12);
export const PYROBLAST_TICK_INTERVAL_MS = seconds(3);

/**
 * Pyroblast: a SIX-second cast leaving a 12-second burn in four ticks.
 *
 * IT USED TO BE THE ONLY SPELL THAT REACHED THE CAST CLAMP, and with the
 * sheet there is no clamp to reach: 0.91 on the hit and 15% a tick are stated
 * outright. `PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS` existed because this
 * one spell needed it, and it is gone with it.
 */
export const PYROBLAST_CAST_MS = seconds(6);
export const PYROBLAST_COEFFICIENTS = {
  direct: PYROBLAST_SP_COEFFICIENT,
  perTick: PYROBLAST_TICK_SP_COEFFICIENT,
};

export const PYROBLAST_DOT: AuraDefinition = {
  id: 'pyroblast',
  name: 'Pyroblast',
  durationMs: PYROBLAST_DOT_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: PYROBLAST_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      tick(
        context,
        aura,
        PYROBLAST_DOT_TOTAL / (PYROBLAST_DOT_DURATION_MS / PYROBLAST_TICK_INTERVAL_MS),
        FIRE,
        PYROBLAST_COEFFICIENTS.perTick,
      ),
  },
};

/**
 * Frostfire Bolt's burn: "an additional 57 Frostfire damage over 9 sec".
 *
 * FROSTFIRE IS BOTH SCHOOLS, and the spellbook says so: "checked against the
 * lower of the target's Frost and Fire resists and counts as both Frost and
 * Fire damage". A `DamageRequest` carries ONE school, so this is dealt as
 * Fire -- which is the reading that matters here, because Fire Power and
 * Improved Fireball both name Frostfire Bolt explicitly and Piercing Ice does
 * not. Stated rather than silently chosen.
 */
export const FROSTFIRE_DOT_TOTAL = 57;
export const FROSTFIRE_DOT_DURATION_MS = seconds(9);
export const FROSTFIRE_TICK_INTERVAL_MS = seconds(3);

/** Frostfire Bolt: a 3-second cast leaving a 9-second burn in three ticks. */
export const FROSTFIRE_CAST_MS = seconds(3);
/** Like Fireball: the hit takes it all and the burn takes nothing. */
export const FROSTFIRE_COEFFICIENTS = {
  direct: FROSTFIRE_BOLT_SP_COEFFICIENT,
  perTick: FROSTFIRE_BOLT_TICK_SP_COEFFICIENT,
};

/**
 * The further school Frostfire Bolt counts as, for the caster's own talents.
 *
 * ----------------------------------------------------------------------------
 * TEN MAGE TALENTS TREAT IT AS BOTH SCHOOLS, by the ruleset owner, and seven
 * of them already did. The three that did not were the FROST-scoped ones, and
 * they failed in two different ways:
 *
 *   Piercing Ice   `schoolDamage: ['frost']`      -- this field fixes it
 *   Ice Shards     `schoolCritDamage: ['frost']`  -- this field fixes it
 *   Frost Channeling  a cast modifier naming ability ids -- fixed by adding
 *                     `frostfire_bolt` to that list, in `mageEffects.ts`
 *
 * The other seven select either by ABILITY ID -- Ignite, Improved Scorch,
 * Master of Elements, Combustion -- or by the FIRE school, which it is dealt
 * as: Critical Mass, Fire Power, Elemental Precision.
 *
 * IT IS STILL DEALT AS FIRE, and that is not a contradiction. `school` answers
 * "which vulnerability, which resistance, what the log says" and needs one
 * answer; `countsAsSchools` answers "which of the caster's school talents
 * select it" and is the only question with two.
 * ----------------------------------------------------------------------------
 */
export const FROSTFIRE_ALSO_COUNTS_AS = ['frost'] as const;

export const FROSTFIRE_DOT: AuraDefinition = {
  id: 'frostfire_bolt',
  name: 'Frostfire Bolt',
  durationMs: FROSTFIRE_DOT_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: FROSTFIRE_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      tick(
        context,
        aura,
        FROSTFIRE_DOT_TOTAL / (FROSTFIRE_DOT_DURATION_MS / FROSTFIRE_TICK_INTERVAL_MS),
        FIRE,
        FROSTFIRE_COEFFICIENTS.perTick,
        /*
         * THE BURN IS THE SAME SPELL AND COUNTS THE SAME WAY. Piercing Ice is
         * "damage done by your Frost spells" and the burn is part of the
         * spell; Ice Shards is crit damage and this tick can crit, through
         * `critFrom: 'spell'`. Leaving it off the tick would have made the
         * fix cover 93% of the ability -- a smaller number and no error.
         */
        { countsAsSchools: FROSTFIRE_ALSO_COUNTS_AS },
      ),
  },
};

// ---------------------------------------------------------------------------
// Fire: the things that ride on a critical strike
// ---------------------------------------------------------------------------

/**
 * Ignite: "Your critical strikes from Fire damage spells cause the target to
 * burn for an additional {0}% of your spell's damage over 4 sec."
 *
 * ----------------------------------------------------------------------------
 * ITS MAGNITUDE COMES FROM THE HIT THAT CAUSED IT, which is why this is a
 * factory rather than a constant. The reaction reads `attack.amount` off the
 * crit and hands it over; nothing about the aura knows what Fireball does.
 *
 * FOUR SECONDS AT A TWO-SECOND CADENCE is two ticks, which divides evenly.
 *
 * THE BURN IS FIRE, so Fire Power raises it and Improved Scorch's vulnerability
 * applies to it. That is correct and worth noticing: a fire mage's Ignite is
 * scaled twice, once through the crit that made it and once on the way out.
 * ----------------------------------------------------------------------------
 */
export const IGNITE_DURATION_MS = seconds(4);
export const IGNITE_TICK_INTERVAL_MS = seconds(2);

/*
 * ============================================================================
 * IGNITE IS DEEP WOUNDS IN A DIFFERENT SCHOOL, and the ruleset owner has said
 * so: both are DoTs applied BY a critical strike, and both carry the same two
 * exceptions because of it.
 *
 *   IT CANNOT CRIT          against the general Forever rule that every DoT
 *                           can. The crit is already in the magnitude -- the
 *                           burn is a share of a hit that was multiplied by
 *                           1.5 -- so letting the tick crit as well pays for
 *                           the same crit twice.
 *
 *   IT ROLLS OVER           a second crit does not throw the undelivered
 *                           remainder away. `periodic.pool` carries that and
 *                           the engine owns the arithmetic; this function says
 *                           only what THIS application contributes.
 *
 * THE OLD COMMENT ARGUED THE OPPOSITE AND ARGUED IT WELL: "Forever's tooltip
 * describes one burn from one crit and says nothing about rolling them
 * together, so the simpler reading is taken and stated. Classic's Ignite does
 * combine, which is exactly the kind of inherited assumption this project has
 * been caught by before." Every step of that is sound and the conclusion was
 * wrong, because the tooltip was the wrong source to ask -- `periodic.pool`
 * exists BECAUSE the owner specified this behaviour for Deep Wounds, and the
 * two effects are one mechanic. **A reading flagged as an interpretation is
 * still an interpretation after it has sat there for months.**
 *
 * THE DURATION STILL RESETS, which is not a contradiction and is the same
 * split Deep Wounds documents: `refreshBehaviour: 'reset'` restarts the four
 * seconds while the pool carries the damage, and the two are separate clocks.
 * ============================================================================
 */
export function igniteAura(totalDamage: number): AuraDefinition {
  return {
    id: 'ignite',
    name: 'Ignite',
    durationMs: IGNITE_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: IGNITE_TICK_INTERVAL_MS,
      /*
       * What THIS crit contributes, read off the hit that caused it. The share
       * per tick is DERIVED by the engine from the duration and the interval,
       * so the two-tick split is not a third constant here.
       */
      pool: () => totalDamage,
      /*
       * NO COEFFICIENT, AND THAT IS NOT AN OMISSION. Ignite's magnitude is a
       * percentage OF THE CRIT THAT CAUSED IT, and that hit was already
       * scaled by its own spell's coefficient -- so a coefficient here would
       * apply spell power twice to the same damage. The 0 is the rule for
       * every effect whose size is derived from another hit, and `canCrit:
       * false` is the second half of that same rule.
       */
      onTick: (context, aura) => {
        const amount = aura.drawFromPool();
        if (amount <= 0) return;
        tick(context, aura, amount, FIRE, 0, { canCrit: false });
      },
    },
  };
}

/**
 * Improved Scorch's fire vulnerability: "+{1}% Fire damage, stacking up to 5
 * times, lasting 30 sec".
 *
 * ON THE TARGET AND SCALED BY STACKS. `damageTakenBySchool` is the declaration,
 * and `modifiersScaleWithStacks` makes the five stacks compound the way every
 * other damage multiplier in this engine does -- 1.03 at five stacks is 1.159
 * rather than 1.150. The source says "stacking" and not which, and a second
 * convention for that flag would cost more than the one percent.
 */
export const IMPROVED_SCORCH_DURATION_MS = seconds(30);
export const IMPROVED_SCORCH_MAX_STACKS = 5;

export function fireVulnerabilityAura(percentPerStack: number): AuraDefinition {
  return {
    id: 'fire_vulnerability',
    name: 'Fire Vulnerability',
    durationMs: IMPROVED_SCORCH_DURATION_MS,
    maxStacks: IMPROVED_SCORCH_MAX_STACKS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    modifiersScaleWithStacks: true,
    damageTakenBySchool: { fire: 1 + percentPerStack / 100 },
  };
}

/**
 * Heating Up: "reduce the cast time of your next Pyroblast cast within 20 sec by
 * 25%, stacking up to 3 times", after a non-periodic Fire crit.
 *
 * ----------------------------------------------------------------------------
 * IT WAS CALLED HOT STREAK UNTIL CLIENT BUILD 1.60.1.70170. Forever renamed it
 * -- "Hot Streak has been renamed to Heating Up, since it is no longer dependent
 * on having a 'streak'" -- and the aura's id, name and constants follow the
 * client, because the NAME is what a person reads on the buff-uptime table. That
 * is the opposite of the choice made for Primal Bite, whose ability id stayed
 * `mangle`: this id is referenced by one reaction and one test, where that one
 * is referenced by rotations, talents, profiles and the Berserk aura.
 *
 * THE WINDOW ALSO WENT 15 SECONDS TO 20, which the rename notes do not mention
 * and the tooltip does.
 *
 * CONSUMED BY ONE PYROBLAST, ALL THREE STACKS AT ONCE -- the ruleset owner's
 * ruling, and it settles a question the rename raised rather than answered.
 *
 * ----------------------------------------------------------------------------
 * IT SHIPPED THE OTHER WAY FOR ONE REVIEW AND THE REASONING WAS RECORDED. The
 * tooltip went from "reduces the cast time of Pyroblast" to "reduce the cast time
 * of your NEXT Pyroblast cast within 20 sec", and the patch notes said only that
 * the name had moved -- so the behaviour was left as the OLD reading, flagged
 * here as a real open question, on the principle that a rename note is not
 * authority to change a mechanic. The owner then called it: "This was an
 * oversight by me ... Heating up's 3 stacks should be consumed after 1 pyroblast
 * cast."
 *
 * WAITING WAS STILL RIGHT, AND THE PRICE WAS ONE REVIEW. The two readings are
 * not close -- 75% off ONE Pyroblast against 75% off every Pyroblast in a
 * twenty-second window -- so guessing the generous one and saying nothing would
 * have put two Mage figures in the baseline table on nobody's authority. The
 * flag is what got it asked.
 *
 * `all` AND NOT `stack`, which is the whole reason that field is an enum. One
 * cast that every stack paid for together is Maelstrom Weapon's shape; spending
 * a single stack would leave two behind for the next Pyroblast and read as a
 * working talent worth several times what it should be.
 *
 * THREE STACKS AT 25% EACH IS 75%, which takes a six-second Pyroblast to one
 * and a half. That is the whole reason a Fire mage casts Pyroblast at all --
 * and now it is once per rebuilt stack of three rather than once per window.
 *
 * ----------------------------------------------------------------------------
 * AND IT IS NOT SPENT ON A PYROBLAST PRESENCE OF MIND HAS ALREADY MADE INSTANT:
 * "Heating Up is no longer consumed if the Mage also had Presence of Mind
 * active for the Pyroblast cast."
 *
 * `requiresCastTime` DID NOT ALREADY SAY THIS, which is the near miss worth
 * naming: that flag reads the ability's DECLARED `castTimeMs`, and Pyroblast
 * always declares one. So the aura matched a cast that was already instant, its
 * 75% had nothing left to reduce, and all three stacks were thrown away -- with
 * nothing on the results page to show it, because the Pyroblast was instant
 * either way and the aura still reported its uptime.
 *
 * `exceptWhileAura` SUPPRESSES THE EFFECT AS WELL AS THE CONSUMPTION, which is
 * the same answer by a different route: a cast Presence of Mind has already
 * zeroed cannot be shortened again.
 *
 * IT MAKES THE ARCANE LIST'S OWN COMBINATION WORK, which is what the note is
 * plainly for. That list was respecified to move Presence of Mind so it makes
 * PYROBLAST instant -- so before this, every one of those casts also ate a
 * three-stack Heating Up for nothing.
 * ----------------------------------------------------------------------------
 */
export const HEATING_UP_DURATION_MS = seconds(20);
export const HEATING_UP_MAX_STACKS = 3;
export const HEATING_UP_REDUCTION_PER_STACK = 0.25;

export const HEATING_UP: AuraDefinition = {
  id: 'heating_up',
  name: 'Heating Up',
  durationMs: HEATING_UP_DURATION_MS,
  maxStacks: HEATING_UP_MAX_STACKS,
  refreshBehaviour: 'reset',
  castModifier: {
    abilityIds: ['pyroblast'],
    castTimeFraction: HEATING_UP_REDUCTION_PER_STACK,
    scalesWithStacks: true,
    requiresCastTime: true,
    // One Pyroblast spends the whole aura, however many stacks it held. See
    // above: the owner's ruling, and `all` rather than `stack` for the reason
    // that field is an enum.
    consumedByCast: 'all',
    // ... unless Presence of Mind already made the cast instant, in which case
    // this has nothing to shorten and is not spent. See above.
    exceptWhileAura: 'presence_of_mind',
  },
};

/**
 * "Fire damage spells", named one by one.
 *
 * ----------------------------------------------------------------------------
 * THE SAME LIST `reactions/mageTalents.ts` KEEPS FOR IGNITE, and it lives here
 * because the aura needs it too: Combustion's crit bonus is per SCHOOL and an
 * aura's `abilityModifiers` are per ABILITY, so the school has to be spelled
 * out as the spells that are it.
 *
 * FROSTFIRE BOLT IS ONE OF THEM. It "counts as both Frost and Fire damage" and
 * is dealt as Fire here, which is the reading `FROSTFIRE_BOLT` states and the
 * one Improved Fireball and Fire Power already take.
 *
 * LISTING IS THE ESTABLISHED WAY ROUND IN THIS FILE -- Presence of Mind and
 * Clearcasting both name the spells rather than a school, for the reason given
 * there: a `school` field on every `Ability` is silent when forgotten, and one
 * class's spellbook is a maintainable list. The cost is that a new Fire spell
 * must be added here; `mageAbilities.test.ts` checks this list against the
 * Mage's own book so that the day one is not, a test says so.
 * ----------------------------------------------------------------------------
 */
export const FIRE_SPELL_IDS: readonly string[] = [
  'fireball',
  'scorch',
  'pyroblast',
  'fire_blast',
  'blast_wave',
  'frostfire_bolt',
];

/**
 * Every damage spell in the Mage's book, which is what "any damage spell"
 * means -- and, minus one of them, what "all your other spells" means.
 *
 * THREE EFFECTS READ IT and they would otherwise keep three copies: Arcane
 * Concentration's "after any damage spell hits", Arcane Blast's "+10% to all
 * your OTHER spells", and the same aura's "until any other damage spell is
 * cast". The last two have to select the SAME set or a spell could take the
 * bonus without ending the window, which is a bigger number and no error.
 */
export const MAGE_DAMAGE_SPELL_IDS: readonly string[] = [
  ...FIRE_SPELL_IDS,
  'frostbolt',
  'ice_lance',
  'cone_of_cold',
  'arcane_missiles',
  'arcane_blast',
];

/**
 * Combustion: "each of your Fire damage spell hits increases your critical
 * strike chance with Fire damage spells by 10%. Lasts until you have caused 3
 * non-periodic critical strikes with Fire spells."
 *
 * ----------------------------------------------------------------------------
 * BOTH HALVES FIT NOW, AND THE OLD SHAPE WAS THE MOST GENEROUS THING IN THIS
 * FILE: ten stacks applied at once, worth +100% crit TO EVERY SCHOOL, for a
 * placeholder thirty seconds. Every one of those three was wrong in the same
 * direction, and the ability said so where a person could see it -- which is
 * the only reason it was allowed to stand.
 *
 * THE CRIT IS PER FIRE SPELL, keyed by ability id. `SchoolModifiers` is built
 * once when the character is and cannot hold something that comes and goes,
 * which is what the old caveat said; what it missed is that an aura's
 * `abilityModifiers` reach the same roll and select by id. `FIRE_SPELL_IDS` is
 * the school written out.
 *
 * ONE STACK PER FIRE SPELL HIT, applied by `reactions/mageTalents.ts`. The hit
 * that adds a stack has already rolled its own crit, which is what "each of
 * your Fire damage spell HITS increases" says -- the bonus is for the spells
 * after it.
 *
 * `modifiersScaleWithStacks` IS WHAT MAKES THE STACKS COUNT, and it did not
 * reach `abilityModifiers` until this aura wanted it: the flag was read by
 * `statModifiers` and by `damageTakenBySchool` and ignored by the third
 * collection, so this would have stacked to ten and paid ten percent.
 *
 * IT HAS NO DURATION, because the source states none: `durationMs: 0` is
 * "until explicitly removed", and what removes it is the four crits.
 * `PLACEHOLDER_COMBUSTION_DURATION_MS` is deleted with it -- the placeholder
 * existed only because nothing counted crits.
 * ----------------------------------------------------------------------------
 */
export const COMBUSTION_CRIT_PER_STACK = 10;
/**
 * "3 non-periodic critical strikes with Fire spells", and then it ends.
 *
 * FOUR UNTIL CLIENT BUILD 1.60.1.70170, and Forever put it back to three: "The
 * number of charges of Combustion has returned to 3 (was 4)". The word "charges"
 * in that note is the CRIT COUNT and not `maxStacks` -- the tooltip reads "lasts
 * until you have caused 3 non-periodic critical strikes with Fire spells" -- and
 * the two are easy to confuse here, because this aura genuinely has a stack
 * count as well and it is capped at twenty for an unrelated reason. Reading the
 * note as the stack cap would have left the window ending a crit late and
 * capped the crit bonus at +30%.
 */
export const COMBUSTION_CRITS_TO_END = 3;
/**
 * A cap the source does not state, set where it cannot bind.
 *
 * `maxStacks` has to be a number and the real end is the three crits, not a
 * stack count. Twenty is past anything reachable: ten stacks is already +100%
 * Fire crit, so every spell after that one crits and the third arrives within
 * three more casts. It is here to satisfy the field, NOT as a ruleset figure --
 * a run that reached it would mean the crit counter had stopped working, which
 * is why a test asserts the aura ends on crits rather than on stacks.
 */
export const COMBUSTION_STACK_CAP = 20;

export const COMBUSTION: AuraDefinition = {
  id: 'combustion',
  name: 'Combustion',
  // No duration: the three crits are what end it. See above.
  durationMs: 0,
  maxStacks: COMBUSTION_STACK_CAP,
  /*
   * NO `refreshBehaviour`, and it would do nothing if there were one: `refresh`
   * skips the expiry half entirely for a permanent aura. What it does NOT skip
   * is the stack, which is the half this wants -- a re-application is another
   * Fire spell hit. It also leaves `appliedAt` alone, which is what the crit
   * counter keys on to tell one Combustion window from the next.
   */
  modifiersScaleWithStacks: true,
  abilityModifiers: Object.fromEntries(
    FIRE_SPELL_IDS.map((id) => [id, { critBonus: COMBUSTION_CRIT_PER_STACK }]),
  ),
};

// ---------------------------------------------------------------------------
// Arcane
// ---------------------------------------------------------------------------

/**
 * Arcane Blast's own escalating debuff: "Each time you cast Arcane Blast, the
 * damage of all your other spells is increased by 10% and the mana cost of
 * Arcane Blast is increased by 175%. Effect stacks up to 4 times and lasts 8
 * sec or until any other damage spell is cast."
 *
 * ----------------------------------------------------------------------------
 * ============================================================================
 * REDESIGNED BY THE PATCH, AND THE DAMAGE CLAUSE CHANGED KIND RATHER THAN SIZE.
 *
 * "Arcane Blast: Redesigned. This spell is now a 1.5 second cast, and each time
 * it is cast it grants the casting Mage 15% of their Intellect as additional
 * Spell Damage. This effect also increases the cost of Arcane Blast as before
 * and still stacks to 4 times. However, the effect now lasts 15 seconds from
 * when it is FIRST APPLIED, instead of just until the next spell cast. Mana
 * cost unchanged, but damage done and Spell Damage coefficients both reduced
 * 40%."
 *
 * ----------------------------------------------------------------------------
 * WHAT WENT: "+10% damage to all your OTHER spells" per stack, carried as an
 * `abilityModifiers` entry for every damage spell except this one, and the
 * `arcaneBlastSpender` cast reaction that took the stacks away on the next
 * spell. BOTH ARE DELETED. The old damage clause was this project's most
 * load-bearing INTERPRETATION -- "8 sec or until any other damage spell is
 * cast" read literally said the bonus was removed by the only thing that could
 * collect it, so the clause would have been worth nothing, and the reading
 * taken was that the other spell BENEFITS and the stacks then go. HANDOVER
 * carried it as a question for the owner.
 *
 * THE REDESIGN ANSWERS THAT QUESTION BY REMOVING IT, which is worth saying
 * plainly: the ambiguous sentence is gone from the tooltip, the effect now
 * lasts a stated 15 seconds, and nothing has to guess what ends it. An
 * interpretation flagged as one is what gets ruled on -- and sometimes what
 * arrives is not a ruling but a rewrite.
 *
 * ----------------------------------------------------------------------------
 * SPELL POWER FROM INTELLECT, PER STACK, AND IT REACHES ARCANE BLAST ITSELF.
 *
 * "Grants the CASTING MAGE 15% of their Intellect as additional Spell Damage"
 * is a stat on the Mage, not a per-ability bonus -- so unlike the clause it
 * replaces it is not "other spells", and Arcane Blast's own next cast collects
 * it. That is the whole character of the redesign: it was a setup spell for
 * something else and is now a ramp for everything including itself.
 *
 * A FACTORY RATHER THAN A CONSTANT, the arrangement `ripAura` already uses: the
 * figure depends on the caster's Intellect, which a module-level
 * `AuraDefinition` cannot know. `CATALOG_AURAS` carries a representative call
 * so the aura catalogue can still offer it by name.
 *
 * AND THE INTELLECT IS READ AT THE FIRST APPLICATION, WHICH IS A FREEZE AND IS
 * DECLARED RATHER THAN HIDDEN. `apply` finds an existing instance by id and
 * refreshes using the ORIGINAL definition, so every stack of one window is
 * worth 15% of whatever Intellect the first cast saw. This project's own rule
 * is that "a percentage folded into a flat number at build time freezes against
 * the unbuffed stat" -- the mitigation here is that it is folded at CAST time,
 * so Arcane Intellect, the gear and every raid buff are already in it, and
 * nothing in the Mage's kit moves Intellect during a fifteen-second window.
 * It would stop being true the day something does, and `statFromStat` carried
 * on an AURA -- folded into the derivation rather than resolved once -- is what
 * that day needs.
 *
 * ----------------------------------------------------------------------------
 * `refreshBehaviour: 'ignore'` IS "15 SECONDS FROM WHEN IT IS FIRST APPLIED",
 * AND IT STILL STACKS -- which is not obvious and is the reason this is one
 * field rather than a new mechanism.
 *
 * `AuraCollection.refresh` increments the stack and re-applies the scaled stat
 * modifiers BEFORE it consults the behaviour, and only the expiry reschedule is
 * gated on it. So `ignore` declines the new WINDOW and accepts the new STACK,
 * which is exactly what the note describes. `reset` would restart the clock on
 * every cast and make the window unbounded in practice.
 *
 * ----------------------------------------------------------------------------
 * THE COST HALF IS UNCHANGED, which the note says outright -- "increases the
 * cost of Arcane Blast as before". `castModifier.costFraction` takes a NEGATIVE
 * fraction, which is an increase, so 175% a stack is expressible precisely and
 * four stacks is eight times the base cost. That is what keeps this a burst
 * spell rather than a filler even at a 1.5-second cast.
 *
 * PER STACK RATHER THAN IN TOTAL, the same reading Maelstrom Weapon needed: the
 * tooltip states one percentage and then says "stacks up to 4 times", which is
 * only meaningful if the stacks multiply it.
 * ============================================================================
 */
export const ARCANE_BLAST_MAX_STACKS = 4;
/**
 * FIFTEEN SECONDS, FROM FIRST APPLICATION. Was eight, and was also ended early
 * by any other damage spell -- see above.
 */
export const ARCANE_BLAST_DURATION_MS = seconds(15);
export const ARCANE_BLAST_COST_INCREASE_PER_STACK = 1.75;
/**
 * "15% of their Intellect as additional Spell Damage", per stack.
 *
 * REPLACES `ARCANE_BLAST_DAMAGE_PER_STACK`, which was the old "+10% damage to
 * your other spells" -- a different KIND of effect, not a renumbering. The 10
 * was hand-filled in `values/mage.json` as the talent's single-rank number and
 * is now unread by anything; it stays in the values file because the importer
 * merges rather than overwrites and deleting it would be an edit to captured
 * data for no behavioural reason.
 */
export const ARCANE_BLAST_INTELLECT_TO_SPELL_POWER = 0.15;

export const ARCANE_BLAST_UNMODELLED =
  'Its Intellect share is read at the FIRST application and frozen for the ' +
  'window, because a refresh reuses the original definition. Nothing in a ' +
  'Mage kit moves Intellect during fifteen seconds, so the two readings agree ' +
  'today -- an aura-carried `statFromStat`, folded into the derivation rather ' +
  'than resolved once, is what a mid-fight Intellect buff would need.';

/**
 * Arcane Blast's ramp, built from the caster's own Intellect.
 *
 * `intellect` is the caster's EFFECTIVE value at the moment of the first cast.
 * See the note above on why that is a freeze and why it is tolerable.
 */
export function arcaneBlastAura(intellect: number): AuraDefinition {
  return {
    id: 'arcane_blast',
    name: 'Arcane Blast',
    durationMs: ARCANE_BLAST_DURATION_MS,
    maxStacks: ARCANE_BLAST_MAX_STACKS,
    /*
     * DECLINES THE NEW WINDOW AND ACCEPTS THE NEW STACK. See above: `refresh`
     * increments and re-scales before it consults this, and only the expiry
     * reschedule is gated on it. That is "15 seconds from when it is first
     * applied" with no new mechanism.
     */
    refreshBehaviour: 'ignore',
    /*
     * BOTH HALVES SCALE, and this flag reaches both: `statModifiers` below for
     * the spell power -- `applyStatModifiers` multiplies a flat spec by the
     * stack count -- and `castModifier.scalesWithStacks` for the cost.
     */
    modifiersScaleWithStacks: true,
    statModifiers: [flat('spellPower', intellect * ARCANE_BLAST_INTELLECT_TO_SPELL_POWER)],
    castModifier: {
      abilityIds: ['arcane_blast'],
      // NEGATIVE, which is an increase. The one place in the project where a
      // cast modifier makes something worse, and the field takes it without a
      // special case.
      costFraction: -ARCANE_BLAST_COST_INCREASE_PER_STACK,
      scalesWithStacks: true,
    },
  };
}

/**
 * Arcane Power: "For the next 15 sec, your spells deal 30% more damage while
 * costing 30% more mana to cast."
 *
 * ----------------------------------------------------------------------------
 * BOTH HALVES APPLY NOW. `damageDoneMultiplier` was always exactly right --
 * "your spells" with no school is the whole character, and a Mage has no
 * physical damage to over-reach into. The cost clause was left out with a
 * caveat saying it would need a cast modifier naming every Mage spell in a
 * list that has to be kept in step with the spellbook.
 *
 * THE LIST EXISTS AND THE TEST IS WHAT KEEPS IT IN STEP. `MAGE_COSTED_SPELL_IDS`
 * is every Mage ability that costs mana, and `mageAbilities.test.ts` derives
 * the same set from `MAGE_ABILITIES` and fails if the two disagree -- so a new
 * spell is caught by a test rather than by nobody.
 *
 * IT USED TO SAY "the same argument `PRESENCE_OF_MIND_SPELLS` already rested
 * on, made checkable", AND THAT LIST HAD NO SUCH TEST -- which is how it came
 * to be missing Arcane Wrath while this one had it. A comment claiming a
 * neighbour is guarded is not a guard; Presence of Mind is a RULE now rather
 * than a list, and this remains the one place a hand-written set of Mage ids
 * survives, because "every ability that costs mana" has no clause to express
 * it.
 *
 * NO `consumedByCast`, because this is a DURATION effect: every spell inside
 * the fifteen seconds pays more, not just the next one.
 *
 * A NEGATIVE FRACTION IS AN INCREASE, as it is on Arcane Blast, and two cast
 * modifiers on one ability stack ADDITIVELY against the base -- so a
 * Clearcasting spell cast under Arcane Power is 100% - 30% = 70% off rather
 * than free. That is the engine's stated rule and not a special case here.
 * ----------------------------------------------------------------------------
 */
export const ARCANE_POWER_DAMAGE = 1.3;
export const ARCANE_POWER_COST_INCREASE = 0.3;
export const ARCANE_POWER_DURATION_MS = seconds(15);

/** Every Mage ability that costs mana. Checked against the book by a test. */
export const MAGE_COSTED_SPELL_IDS: readonly string[] = [
  // Arcane Wrath, new at client build 1.60.1.70425: 395 mana, so Arcane Power's
  // +30% cost reaches it like every other costed spell in the book.
  'arcane_wrath',
  ...MAGE_DAMAGE_SPELL_IDS,
  'mage_armor',
  // Ice Barrier, a trainer spell since round 55: 480 mana.
  'ice_barrier',
];

export const ARCANE_POWER: AuraDefinition = {
  id: 'arcane_power',
  name: 'Arcane Power',
  durationMs: ARCANE_POWER_DURATION_MS,
  damageDoneMultiplier: ARCANE_POWER_DAMAGE,
  castModifier: {
    abilityIds: [...MAGE_COSTED_SPELL_IDS],
    costFraction: -ARCANE_POWER_COST_INCREASE,
  },
};

/**
 * Presence of Mind: the owner's rule -- "should make the next non-channeled,
 * non-instant spell an instant cast."
 *
 * ==============================================================================
 * IT WAS A HAND-WRITTEN LIST OF SEVEN SPELLS AND THE LIST HAD DRIFTED. Arcane
 * Wrath arrived at client build 1.60.1.70425 as a 3.5-second cast and nobody
 * added it, so Presence of Mind took the charge, reported its uptime, and let
 * the Mage cast a full 3.5 seconds. The owner found it: "Presence of Mind is
 * bugged for at least Arcane Wrath. It's not actually making it instant cast."
 *
 * AND THE LIST WAS WRONG IN THE OTHER DIRECTION TOO: it named ARCANE MISSILES,
 * which is a channel. Zeroing a channel's cast delivers ONE tick's worth of
 * effect -- one missile of five -- and reports a successful cast. Nothing had
 * reported that either, because the Arcane list spends the charge on Pyroblast
 * through a `sequence`, so the case was reachable and not reached.
 *
 * SO IT IS THE RULE NOW RATHER THAN A LIST, in the owner's own two clauses:
 *
 * | the clause | what expresses it |
 * | --- | --- |
 * | "the next ... spell" | `ALL_ABILITIES`, the catch-all |
 * | "non-instant" | `requiresCastTime` |
 * | "non-channeled" | `excludesChannel` |
 *
 * THE CATCH-ALL IS SAFE HERE BECAUSE OF WHAT A MAGE OWNS, AND THAT IS MEASURED
 * RATHER THAN ASSUMED. `Aura.ts` still records that "every ability" and "every
 * SPELL" are different sets -- there is no `school` on `Ability` to select by --
 * and for a Mage the two clauses above close the gap: every ability in a built
 * Mage's book with a cast time IS a spell, racials and consumables included.
 * `mageAbilities.test.ts` asserts that over all three Mage presets, so the day
 * a cast-time racial exists the test fails rather than the charge going astray.
 *
 * "LESS THAN 10 SEC" NEEDS NOTHING: the longest cast a Mage has is Evocation's
 * eight seconds, and that is a channel and excluded by the clause above.
 * ==============================================================================
 */
export const PRESENCE_OF_MIND_DURATION_MS = seconds(30);

export const PRESENCE_OF_MIND: AuraDefinition = {
  id: 'presence_of_mind',
  name: 'Presence of Mind',
  durationMs: PRESENCE_OF_MIND_DURATION_MS,
  castModifier: {
    abilityIds: [ALL_ABILITIES],
    castTimeFraction: 1,
    consumedByCast: 'all',
    requiresCastTime: true,
    excludesChannel: true,
  },
};

/**
 * Clearcasting, from Arcane Concentration: "reduces the mana cost of your next
 * damage spell by 100%."
 *
 * THE SIBLING OF PRESENCE OF MIND, and the reason `CastModifier` carries cost
 * as well as cast time. The Priest's Inner Focus is the same shape again.
 *
 * ------------------------------------------------------------------------------
 * AND IT SHARED PRESENCE OF MIND'S LIST, SO IT INHERITED THE SAME GAP. It read
 * `[...PRESENCE_OF_MIND_SPELLS, 'fire_blast', 'ice_lance', 'blast_wave']`, so
 * Arcane Wrath -- a 395-mana damage spell -- was the one Mage nuke Clearcasting
 * could never make free. One drifting list, two talents.
 *
 * "YOUR NEXT DAMAGE SPELL" IS THE CATCH-ALL WITH TWO CLAUSES, the arrangement
 * the Druid's own Clearcasting already uses: `requiresCost` keeps a free
 * ability from eating the charge, and `requiresAttackTable` is the owner's
 * definition of offensive -- processed through a combat table. Together they
 * select exactly the Mage's damage spells and leave out Mage Armor, which costs
 * mana and rolls nothing, and Evocation, which rolls nothing and is free.
 *
 * NO `excludesChannel`, which is the difference from its sibling and is not an
 * oversight: making a channel FREE is a coherent thing to do to it, where
 * making it instant destroys it. Arcane Missiles has always been in this list
 * and stays.
 * ------------------------------------------------------------------------------
 */
export const CLEARCASTING_DURATION_MS = seconds(15);

export const CLEARCASTING: AuraDefinition = {
  id: 'clearcasting',
  name: 'Clearcasting',
  durationMs: CLEARCASTING_DURATION_MS,
  castModifier: {
    abilityIds: [ALL_ABILITIES],
    costFraction: 1,
    consumedByCast: 'all',
    requiresCost: true,
    requiresAttackTable: true,
  },
};


/*
 * ============================================================================
 * FINGERS OF FROST: "Gives your Chill effects a 15% chance to grant you the
 * Fingers of Frost effect, which treats your next 2 spells cast as if the
 * target were Frozen. Lasts 15 sec."
 *
 * WHAT MAKES IT REACHABLE IS THAT IT DOES NOT FREEZE ANYTHING. Every other
 * Frozen-target effect in this file carries `FROZEN_UNMODELLED` and is inert
 * because a raid boss is never frozen -- a claim about the TARGET, and a
 * durable one. This talent does not freeze the target; it makes the caster's
 * next spells BEHAVE as though it were, which is a state on the Mage and is
 * reachable exactly as written.
 *
 * ITS RANK SCALES THE CHARGES, NOT THE CHANCE, which is the opposite of nearly
 * every other proc talent here: the values file gives [15, 1, 15] and
 * [15, 2, 15]. So the chance is a constant and the charges come from the rank,
 * and a test asserts the constant still matches the file at BOTH ranks -- the
 * day a rank changes the chance, that fails rather than drifting.
 * ============================================================================
 */
export const FINGERS_OF_FROST_DURATION_MS = seconds(15);
/**
 * 15% at rank 1 AND rank 2. Read from `values/mage.json` by hand and checked
 * against it by `mageAbilities.test.ts`, because a constant standing in for a
 * per-rank value is exactly how a rank change goes unnoticed.
 */
export const FINGERS_OF_FROST_PROC_CHANCE = 15;

export function fingersOfFrostAura(charges: number): AuraDefinition {
  return {
    id: 'fingers_of_frost',
    name: 'Fingers of Frost',
    durationMs: FINGERS_OF_FROST_DURATION_MS,
    maxStacks: charges,
    chargesOnApply: charges,
    refreshBehaviour: 'reset',
  };
}

/** The untalented shape, for anything that only needs the id and duration. */
export const FINGERS_OF_FROST: AuraDefinition = fingersOfFrostAura(2);

/*
 * ============================================================================
 * WINTER'S CHILL: "Gives your Frost damage spells a 20% chance to apply the
 * Winter's Chill effect, which increases the damage done by your CONE OF COLD
 * spell to the target by 40%, stacking up to 5 times." (Rank 5: 100%.)
 *
 * A DEBUFF THE TARGET CARRIES THAT NAMES ONE OF THE ATTACKER'S ABILITIES,
 * WHICH IS THE ONE SHAPE THIS ENGINE DID NOT HAVE. The talent's original
 * `unmodelled` reason said so exactly: "`abilityCrit` is on the caster and an
 * aura reaches every ability or none". Both halves were true and both are gone
 * -- `attackerAbilityModifiers` names abilities and is read off the DEFENDER.
 *
 * ----------------------------------------------------------------------------
 * IT WAS A CRIT DEBUFF ON ICE LANCE AND FROSTBOLT UNTIL CLIENT BUILD
 * 1.60.1.70425, AND IT IS A DAMAGE DEBUFF ON CONE OF COLD NOW. The mechanism
 * survives the redesign untouched and only the FIELD and the ABILITY LIST
 * moved -- `critBonus: 2` on two spells becomes `damageMultiplier` on one --
 * which is what `attackerAbilityModifiers` carrying a whole `AbilityModifier`
 * bought rather than a bare crit number.
 *
 * AND THE RANK NOW MOVES ONE NUMBER WHERE IT USED TO MOVE TWO. The row was
 * `[chance, critPerStack, duration, maxStacks]` with the chance going 20..100
 * AND the cap going 1..5; it is `[chance, damagePercent, maxStacks]` now, and
 * only the chance scales -- the 40% and the five stacks are flat at every
 * rank. **So the index moved as well as the meaning**: the stack cap is index
 * 2 where it was index 3, and reading the old index off the new row gives
 * `undefined`, which the reaction would have turned into a one-stack debuff.
 * That is a fifth of the talent and no error, which is why the index is named
 * and every rank is pinned.
 *
 * ----------------------------------------------------------------------------
 * **FIVE STACKS IS 3x, BY THE OWNER'S RULING, SO THIS ONE ADDS RATHER THAN
 * COMPOUNDING.** "Winter's Chill at 5 stacks is a 3x multiplier for Cone of
 * Cold" -- which is `1 + 0.4 x 5` ADDITIVELY, where this engine's default raises
 * a damage multiplier to the POWER of the stack count and would give
 * `1.4^5 = 5.378`. `additiveDamageStacks` is the opt-in and this is its only
 * caller; see `stackedMultiplier`, which is the one place the rule lives.
 *
 * AND THE FLAG WAS WHAT GOT IT RULED ON. The convention was implemented with the
 * alternative pinned beside it -- both figures, and a negative assertion on the
 * one not chosen -- and the answer came back in one line. At 3% a stack the two
 * readings are 1.159 against 1.150 and nobody would notice; at 40% they are a
 * factor of 1.8 apart, so **a house rule that is invisible at every existing
 * caller was never evidence about a caller eight times larger.**
 *
 * IMPROVED SCORCH KEEPS ITS 1.159, because **a ruling covers what it says and is
 * not extended by analogy** -- the same reason Explosive Trap waited to be named
 * after Immolation Trap was ruled in. Worth nothing today either way, for the
 * reason below.
 *
 * ----------------------------------------------------------------------------
 * AND IT IS UNREACHABLE TWICE OVER, both named on the talent rather than here.
 * CONE OF COLD IS NOT DECLARED -- its damage is captured and the ability is
 * not, the same blocker Improved Cone of Cold has carried all along -- and NO
 * MAGE PROFILE TAKES THIS TALENT, the Frostfire build being 0/29/22 with this
 * sitting below its Frost investment. So the redesign moves no figure, which
 * is the expected result and not evidence that it does not work.
 * ============================================================================
 */
export const WINTERS_CHILL_DURATION_MS = seconds(15);
/** 40% a stack at every rank. Checked against the values file by a test. */
export const WINTERS_CHILL_DAMAGE_PER_STACK = 40;
/**
 * The one spell the damage bonus names, and NOT the set that applies it.
 *
 * Any Frost damage spell applies the debuff -- Frostfire Bolt included, because
 * it counts as Frost damage -- and only Cone of Cold deals more for it. That
 * asymmetry survived the redesign and is the kind a reader assumes away, so it
 * is written here and asserted in the test.
 */
export const WINTERS_CHILL_SPELL_IDS: readonly string[] = ['cone_of_cold'];

export function wintersChillAura(maxStacks: number): AuraDefinition {
  return {
    id: 'winters_chill',
    name: "Winter's Chill",
    durationMs: WINTERS_CHILL_DURATION_MS,
    maxStacks,
    isDebuff: true,
    refreshBehaviour: 'reset',
    modifiersScaleWithStacks: true,
    // THE OWNER'S 3x AT FIVE STACKS: 1 + 0.4 x 5, not 1.4^5. See the note above.
    additiveDamageStacks: true,
    attackerAbilityModifiers: Object.fromEntries(
      WINTERS_CHILL_SPELL_IDS.map((id) => [
        id,
        { damageMultiplier: 1 + WINTERS_CHILL_DAMAGE_PER_STACK / 100 },
      ]),
    ),
  };
}

/** The untalented shape, for anything that only needs the id and duration. */
export const WINTERS_CHILL: AuraDefinition = wintersChillAura(5);

/**
 * "Your Frost damage spells", which is what applies it.
 *
 * FROSTFIRE BOLT IS ONE, and it is also in `FIRE_SPELL_IDS`. Its own spellbook
 * entry says it "counts as both Frost and Fire damage", so it belongs to both
 * lists -- it is dealt as Fire because a `DamageRequest` carries one school,
 * and that is a modelling choice rather than a claim that it is not Frost.
 */
export const FROST_SPELL_IDS: readonly string[] = [
  'frostbolt',
  'ice_lance',
  'frostfire_bolt',
  'cone_of_cold',
];

/**
 * Missile Barrage: "reduce the channeled duration of your next Arcane Missiles
 * spell by 50%, reduce the Mana cost by 100%, and missiles fire every 0.5 sec."
 *
 * ALL THREE CLAUSES ARE ONE THING HERE. Halving a five-second channel and
 * firing every half second instead of every second is the SAME five missiles
 * in half the time -- which is exactly what `castTimeFraction: 0.5` does to a
 * channel, because `channelTicks` is a count and the gaps shrink with the
 * cast. The free mana is the same field again.
 */
export const MISSILE_BARRAGE_DURATION_MS = seconds(20);

export const MISSILE_BARRAGE: AuraDefinition = {
  id: 'missile_barrage',
  name: 'Missile Barrage',
  durationMs: MISSILE_BARRAGE_DURATION_MS,
  refreshBehaviour: 'reset',
  castModifier: {
    abilityIds: ['arcane_missiles'],
    castTimeFraction: 0.5,
    costFraction: 1,
    consumedByCast: 'all',
    requiresCastTime: true,
  },
};

// ---------------------------------------------------------------------------
// Armor
// ---------------------------------------------------------------------------

/*
 * ============================================================================
 * EVOCATION: "While channeling this spell, your mana regeneration is active
 * and increased by 1,500%. Lasts 8 sec."
 *
 * THE CAPTURE AND THE OWNER AGREE TO THE DECIMAL, which is worth recording
 * because almost nothing else in this project does. The spellbook says "+1,500%"
 * and the owner says "multiplies it by 16x", and +1500% IS x16 -- so the
 * multiplier is not an interpretation of either wording.
 *
 * BOTH CLAUSES ARE ONE SENTENCE AND TWO FIELDS, and neither is new:
 *
 *   "mana regeneration is ACTIVE"   `manaRegenBypass` at 100. That stat exists
 *                                   for the five second rule and is already fed
 *                                   by Mage Armor and Arcane Meditation; it is
 *                                   clamped at 100 by the RULE rather than here,
 *                                   so stacking on top of those is harmless.
 *                                   This is the owner's "immediately starts your
 *                                   OUT-OF-COMBAT rate" -- the out-of-combat
 *                                   rate IS the unsuppressed one.
 *   "increased by 1,500%"           `resourceRegenMultiplier`, which multiplies
 *                                   the RATE and leaves the 50ms cadence alone.
 *
 * SO IT SCALES WITH THE CHARACTER'S OWN SPIRIT AND GEAR, which is the whole
 * reason to express it as a rate rather than as a flat grant per tick: a Mage
 * that gears into mana regeneration gets more out of Evocation, and a flat
 * number would have frozen that at whatever today's gear gives.
 *
 * NO DURATION OF ITS OWN WORTH TRUSTING. The eight seconds here are a BACKSTOP;
 * what really ends it is `EVOCATION`'s own `onCast`, which removes it when the
 * channel completes. That is the only way to make the window track a HASTED
 * channel -- haste shortens the channel, so a hasted Evocation delivers less
 * total mana at the same rate, and a fixed eight-second aura would have paid
 * out after the channel had already finished.
 * ============================================================================
 */
export const EVOCATION_CHANNEL_MS = seconds(8);
export const EVOCATION_REGEN_MULTIPLIER = 16;
/** Full regeneration while casting, which is what "is active" means. */
export const EVOCATION_REGEN_BYPASS = 100;

export const EVOCATION_AURA: AuraDefinition = {
  id: 'evocation',
  name: 'Evocation',
  // A backstop only. `EVOCATION.onCast` is what ends it, on the channel's own
  // clock, so the window cannot outlive a hasted cast.
  durationMs: EVOCATION_CHANNEL_MS,
  statModifiers: [flat('manaRegenBypass', EVOCATION_REGEN_BYPASS)],
  resourceRegenMultiplier: { mana: EVOCATION_REGEN_MULTIPLIER },
};

/**
 * Mage Armor: "Increases your resistance to all magic by 15 and allows 50% of
 * your mana regeneration to continue while casting."
 *
 * ----------------------------------------------------------------------------
 * THE HALF THAT MATTERS IS THE FIVE SECOND RULE, and the engine already has it.
 *
 * `manaPerTick` suppresses regeneration for five seconds after mana is spent
 * and lets through whatever fraction `manaRegenBypass` names -- the stat
 * written for exactly this sentence, and already fed by Arcane Meditation,
 * Reverence, Meditation and two others. Mage Armor is a flat 50 into the same
 * pool, so it STACKS ADDITIVELY with a talent granting the same thing and the
 * total is clamped at 100 by the rule rather than by the aura.
 *
 * A Mage casting continuously never leaves the lockout, so this is the whole
 * difference between regenerating half its mana and none of it.
 *
 * NO DURATION, because thirty minutes outlasts every fight here by a factor of
 * thirty. Cast once and it is up, which is what the priority lists assume.
 *
 * "Only one type of Armor spell can be active" is real and is not expressed:
 * Frost Armor and Ice Armor are not declared, both being pure armor and a
 * melee slow on a Mage nothing attacks. A second armor would have to remove
 * this one, the way an aspect and a seal already do.
 * ----------------------------------------------------------------------------
 */
export const MAGE_ARMOR_REGEN_BYPASS = 50;
export const MAGE_ARMOR_MAGIC_RESISTANCE = 15;

/**
 * Ice Barrier's buff, the OWNER'S figures (round 55): "+6% Frost damage for 60
 * seconds". The client's tooltip is an 819-point absorb; nothing attacks a
 * Mage here, so the absorb would do nothing, and the owner stated the buff.
 *
 * A SCHOOL BUFF ON THE AURA, `damageDoneBySchool` -- and Frostfire Bolt, which
 * counts as Frost as well as Fire, collects it through `countsAsSchools`. See
 * `Combatant.damageDoneMultiplierFor`.
 */
export const ICE_BARRIER_FROST_DAMAGE = 1.06;
export const ICE_BARRIER_DURATION_MS = seconds(60);

export const ICE_BARRIER: AuraDefinition = {
  id: 'ice_barrier',
  name: 'Ice Barrier',
  durationMs: ICE_BARRIER_DURATION_MS,
  damageDoneBySchool: { frost: ICE_BARRIER_FROST_DAMAGE },
};

export const MAGE_ARMOR: AuraDefinition = {
  id: 'mage_armor',
  name: 'Mage Armor',
  durationMs: 0,
  statModifiers: [flat('manaRegenBypass', MAGE_ARMOR_REGEN_BYPASS)],
};

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
  /*
   * ADDED BY THE AURA-CATALOGUE AUDIT, which found these reachable ONLY through
   * `aurasForClass`'s stock-list safety net -- "anything a stock list names must
   * be choosable, wherever its definition lives". The id was offered with a name
   * derived from it and nothing else, where a listed definition carries the
   * aura's own name and `isDebuff`. A SAFETY NET MASKS THE THING IT IS A NET
   * FOR, which is why the audit asks the modules rather than the catalogue.
   */
  fireVulnerabilityAura(0),
  igniteAura(0),
  /*
   * ========================================================================
   * ARCANE BLAST BECAME A FACTORY WHEN THE PATCH REDESIGNED IT, and that is
   * exactly the change this list exists to catch: it was an exported CONSTANT,
   * which the export walk finds, and is now `arcaneBlastAura(intellect)`,
   * which it does not.
   *
   * THE DROPDOWN DID NOT VISIBLY BREAK, AND THAT IS THE INTERESTING PART.
   * `aurasForClass` ends with a SAFETY NET -- "anything a stock list names must
   * be choosable, wherever its definition lives" -- and the Arcane list gates
   * on `arcane_blast` stacks, so the id kept being offered. What it lost was
   * the DEFINITION behind it: the net supplies a readable name and nothing
   * else, where this list supplies the aura's own name and `isDebuff`.
   *
   * SO `auraCatalog.test.ts` PASSED THROUGH THE REGRESSION. Its structural
   * check reads the source for every `id` / `name` / `durationMs` triple and
   * demands the catalog offer each one -- which the net satisfied. **A safety
   * net masks the thing it is a net for**, and the only reason this was found
   * was re-reading CLAUDE.md's own note that a factory-built aura needs
   * listing here.
   *
   * ZERO IS THE REPRESENTATIVE ARGUMENT, and only the id, name and `isDebuff`
   * are read -- none of which depends on the caster's Intellect.
   * ========================================================================
   */
  arcaneBlastAura(0),
];
