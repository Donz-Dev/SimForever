import type { AuraDefinition, DamageSchool } from '../../engine';
import { dealDamage, flat, seconds } from '../../engine';
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
 * of effects that ride on their crits: Ignite, Hot Streak and Combustion all
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
 * Hot Streak: "reduces the cast time of Pyroblast by 25%, stacking up to 3
 * times", for 15 seconds after a non-periodic Fire crit.
 *
 * NOT CONSUMED BY THE CAST, and that is the difference from Maelstrom Weapon.
 * The tooltip says "reduces the cast time of Pyroblast", not "of your NEXT
 * Pyroblast" -- it is a duration buff, so it has no `consumedByCast` at all
 * and every Pyroblast inside the fifteen seconds is faster.
 *
 * THREE STACKS AT 25% EACH IS 75%, which takes a six-second Pyroblast to one
 * and a half. That is the whole reason a Fire mage casts Pyroblast at all.
 */
export const HOT_STREAK_DURATION_MS = seconds(15);
export const HOT_STREAK_MAX_STACKS = 3;
export const HOT_STREAK_REDUCTION_PER_STACK = 0.25;

export const HOT_STREAK: AuraDefinition = {
  id: 'hot_streak',
  name: 'Hot Streak',
  durationMs: HOT_STREAK_DURATION_MS,
  maxStacks: HOT_STREAK_MAX_STACKS,
  refreshBehaviour: 'reset',
  castModifier: {
    abilityIds: ['pyroblast'],
    castTimeFraction: HOT_STREAK_REDUCTION_PER_STACK,
    scalesWithStacks: true,
    requiresCastTime: true,
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
  'arcane_missiles',
  'arcane_blast',
];

/**
 * Combustion: "each of your Fire damage spell hits increases your critical
 * strike chance with Fire damage spells by 10%. Lasts until you have caused 4
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
/** "4 non-periodic critical strikes with Fire spells", and then it ends. */
export const COMBUSTION_CRITS_TO_END = 4;
/**
 * A cap the source does not state, set where it cannot bind.
 *
 * `maxStacks` has to be a number and the real end is the four crits, not a
 * stack count. Twenty is past anything reachable: ten stacks is already +100%
 * Fire crit, so every spell after that one crits and the fourth arrives within
 * four more casts. It is here to satisfy the field, NOT as a ruleset figure --
 * a run that reached it would mean the crit counter had stopped working, which
 * is why a test asserts the aura ends on crits rather than on stacks.
 */
export const COMBUSTION_STACK_CAP = 20;

export const COMBUSTION: AuraDefinition = {
  id: 'combustion',
  name: 'Combustion',
  // No duration: the four crits are what end it. See above.
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
 * THE COST HALF IS EXACT AND THE DAMAGE HALF IS NOT MODELLED.
 *
 * `castModifier.costFraction` takes a NEGATIVE fraction, which is an increase
 * -- so 175% a stack is expressible precisely, and it is the half that
 * actually governs whether a rotation should spam this. Four stacks is eight
 * times the base cost, which is what makes Arcane Blast a burst spell rather
 * than a filler.
 *
 * PER STACK RATHER THAN IN TOTAL, the same reading Maelstrom Weapon needed and
 * for the same reason: the tooltip states one percentage and then says "stacks
 * up to 4 times", which is only meaningful if the stacks multiply it.
 *
 * ============================================================================
 * "ALL YOUR OTHER SPELLS" IS MODELLED NOW, AND IT IS THE HALF THE ARCANE
 * PROFILE IS BUILT AROUND. It was left out with a written caveat saying
 * `damageDoneMultiplier` is every spell INCLUDING Arcane Blast and there is no
 * "everything except this one" -- which was true of that field and not of
 * `abilityModifiers`, where "everything except this one" is a list with one
 * name missing. `MAGE_DAMAGE_SPELL_IDS` minus `arcane_blast` is that list.
 *
 * WHEN IT ENDS IS AN INTERPRETATION, AND IT IS THE ONLY ONE THAT LEAVES THE
 * CLAUSE DOING WORK. "Lasts 8 sec or until any other damage spell is cast"
 * read literally against "the damage of all your OTHER spells is increased"
 * says the bonus is removed by the only thing that could ever collect it, so
 * the talent would be worth exactly nothing. The reading taken is that the
 * other spell BENEFITS and the stacks then go -- which is also the shape of
 * the ruleset owner's own Arcane list, where four Arcane Blasts are spent into
 * one Arcane Missiles channel. `arcaneBlastSpender` in
 * `reactions/mageTalents.ts` is that rule, and it fires on the LAST tick of a
 * channel so all five missiles are inside the window.
 *
 * SAID OUT LOUD BECAUSE IT MOVES A PROFILE. This is a reading of an ambiguous
 * sentence, not a transcription, and it is worth asking the owner about --
 * HANDOVER.md carries the question.
 * ============================================================================
 */
export const ARCANE_BLAST_MAX_STACKS = 4;
export const ARCANE_BLAST_DURATION_MS = seconds(8);
export const ARCANE_BLAST_COST_INCREASE_PER_STACK = 1.75;
export const ARCANE_BLAST_DAMAGE_PER_STACK = 10;

/** "All your OTHER spells": the damage book with this spell taken out. */
export const ARCANE_BLAST_BOOSTED_SPELL_IDS: readonly string[] =
  MAGE_DAMAGE_SPELL_IDS.filter((id) => id !== 'arcane_blast');

export const ARCANE_BLAST_UNMODELLED =
  'Its "8 sec or until any other damage spell is cast" is read as: the other ' +
  'spell TAKES the bonus and the stacks then go. Read the other way the ' +
  'damage clause could never pay out at all, so this is the reading that ' +
  'leaves every clause doing work -- and it is an interpretation of an ' +
  'ambiguous sentence rather than a transcription.';

export const ARCANE_BLAST: AuraDefinition = {
  id: 'arcane_blast',
  name: 'Arcane Blast',
  durationMs: ARCANE_BLAST_DURATION_MS,
  maxStacks: ARCANE_BLAST_MAX_STACKS,
  refreshBehaviour: 'reset',
  /*
   * BOTH HALVES SCALE, and this flag reaches both: `abilityModifiers` below
   * for the damage, `castModifier.scalesWithStacks` for the cost. They are
   * separate flags because a cast modifier is read by `resolveCast` and not by
   * the damage pipeline, and the two were written at different times.
   */
  modifiersScaleWithStacks: true,
  abilityModifiers: Object.fromEntries(
    ARCANE_BLAST_BOOSTED_SPELL_IDS.map((id) => [
      id,
      { damageMultiplier: 1 + ARCANE_BLAST_DAMAGE_PER_STACK / 100 },
    ]),
  ),
  castModifier: {
    abilityIds: ['arcane_blast'],
    // NEGATIVE, which is an increase. The one place in the project where a
    // cast modifier makes something worse, and the field takes it without a
    // special case.
    costFraction: -ARCANE_BLAST_COST_INCREASE_PER_STACK,
    scalesWithStacks: true,
  },
};

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
 * spell is caught by a test rather than by nobody. That is the same argument
 * `PRESENCE_OF_MIND_SPELLS` already rested on, made checkable.
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
  ...MAGE_DAMAGE_SPELL_IDS,
  'mage_armor',
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
 * Presence of Mind: "your next Mage spell with a casting time less than 10 sec
 * becomes an instant cast spell."
 *
 * EVERY CAST-TIME SPELL IN THE BOOK, LISTED. `CastModifier` selects by ability
 * id and not by school or class, deliberately -- a `school` on every `Ability`
 * is a field that is silent when forgotten. Listing a single class's spells is
 * maintainable, and `requiresCastTime` does the "with a casting time" half, so
 * an instant cannot eat the charge.
 *
 * The "less than 10 sec" clause is satisfied by every spell here; the longest
 * is Pyroblast at six.
 */
export const PRESENCE_OF_MIND_DURATION_MS = seconds(30);

export const PRESENCE_OF_MIND_SPELLS = [
  'fireball',
  'frostbolt',
  'frostfire_bolt',
  'scorch',
  'pyroblast',
  'arcane_blast',
  'arcane_missiles',
] as const;

export const PRESENCE_OF_MIND: AuraDefinition = {
  id: 'presence_of_mind',
  name: 'Presence of Mind',
  durationMs: PRESENCE_OF_MIND_DURATION_MS,
  castModifier: {
    abilityIds: [...PRESENCE_OF_MIND_SPELLS],
    castTimeFraction: 1,
    consumedByCast: 'all',
    requiresCastTime: true,
  },
};

/**
 * Clearcasting, from Arcane Concentration: "reduces the mana cost of your next
 * damage spell by 100%."
 *
 * THE SIBLING OF PRESENCE OF MIND, and the reason `CastModifier` carries cost
 * as well as cast time. The Priest's Inner Focus is the same shape again.
 */
export const CLEARCASTING_DURATION_MS = seconds(15);

export const CLEARCASTING: AuraDefinition = {
  id: 'clearcasting',
  name: 'Clearcasting',
  durationMs: CLEARCASTING_DURATION_MS,
  castModifier: {
    abilityIds: [...PRESENCE_OF_MIND_SPELLS, 'fire_blast', 'ice_lance', 'blast_wave'],
    costFraction: 1,
    consumedByCast: 'all',
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
 * Winter's Chill effect, which increases the chance your Ice Lance and
 * Frostbolt spells will critically hit the target by 2% for 15 sec. Stacks up
 * to 1 times." (Rank 5: 100%, and five stacks.)
 *
 * A CRIT DEBUFF THE TARGET CARRIES, WHICH IS THE ONE SHAPE THIS ENGINE DID NOT
 * HAVE. Its `unmodelled` reason said so exactly: "`abilityCrit` is on the
 * caster and an aura reaches every ability or none". Both halves were true and
 * both are gone -- `attackerAbilityModifiers` names abilities and is read off
 * the DEFENDER.
 *
 * IT IS THE MIRROR OF `critWhileAura`, built for Shatter one PR earlier, and
 * the two are worth reading together: a crit bonus that only counts inside a
 * window, differing in whose window it is. Shatter reads a buff on the Mage;
 * this reads a debuff on the boss.
 *
 * THE RANK SCALES TWO NUMBERS, WHICH NO OTHER PROC IN THIS FILE DOES. The
 * values row is `[chance, critPerStack, duration, maxStacks]` and the chance
 * goes 20..100 while the cap goes 1..5, so the reaction takes the whole row
 * rather than one index. The 2% and the 15 seconds are the same at every rank
 * and are constants here, checked against the file by a test -- the discipline
 * `FINGERS_OF_FROST_PROC_CHANCE` already follows.
 *
 * TWO NAMED SPELLS AND NOT A SCHOOL. Frostfire Bolt APPLIES it, because it
 * counts as Frost damage, and is not one of the two that CRIT more for it --
 * the tooltip names Ice Lance and Frostbolt and stops. That asymmetry is the
 * kind a reader assumes away, so it is written here and asserted in the test.
 *
 * NO MAGE PROFILE TAKES IT. The Frostfire build is 0/29/22 and this sits below
 * that in the Frost tree, so nothing in the baseline moves -- which is the
 * expected result for a talent nobody spends a point on, and not evidence that
 * it does not work. The test asserts the MECHANISM.
 * ============================================================================
 */
export const WINTERS_CHILL_DURATION_MS = seconds(15);
/** 2% a stack at every rank. Checked against the values file by a test. */
export const WINTERS_CHILL_CRIT_PER_STACK = 2;
/** The two spells the crit bonus names. Frostfire Bolt APPLIES it and is not one. */
export const WINTERS_CHILL_SPELL_IDS: readonly string[] = ['ice_lance', 'frostbolt'];

export function wintersChillAura(maxStacks: number): AuraDefinition {
  return {
    id: 'winters_chill',
    name: "Winter's Chill",
    durationMs: WINTERS_CHILL_DURATION_MS,
    maxStacks,
    isDebuff: true,
    refreshBehaviour: 'reset',
    modifiersScaleWithStacks: true,
    attackerAbilityModifiers: Object.fromEntries(
      WINTERS_CHILL_SPELL_IDS.map((id) => [id, { critBonus: WINTERS_CHILL_CRIT_PER_STACK }]),
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
export const FROST_SPELL_IDS: readonly string[] = ['frostbolt', 'ice_lance', 'frostfire_bolt'];

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

export const MAGE_ARMOR: AuraDefinition = {
  id: 'mage_armor',
  name: 'Mage Armor',
  durationMs: 0,
  statModifiers: [flat('manaRegenBypass', MAGE_ARMOR_REGEN_BYPASS)],
};
