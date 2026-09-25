import type { AuraDefinition } from '../../engine';
import { dealDamage, flat, seconds } from '../../engine';
import { hybridSpellCoefficients } from '../combat/spellCoefficient';

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
 * Nothing freezes a raid boss, and four Frost talents depend on one.
 *
 * Shatter ("against Frozen targets"), Fingers of Frost ("treats your next 2
 * spells as if the target were Frozen"), Frostbite ("chance to Freeze") and
 * Ice Lance's own 300% bonus all key on the same state. A boss is immune to
 * every root and freeze in the game, and this project models one target which
 * is a raid boss.
 *
 * So they are inert, and they are inert because of the ENCOUNTER rather than
 * because of the engine -- which is a different claim and a more durable one.
 * The day an encounter has a freezable target, these become reachable without
 * anything else changing.
 */
export const FROZEN_UNMODELLED =
  'It applies only to a FROZEN target. Nothing freezes a raid boss, and every ' +
  'encounter here is one, so this is inert because of the target rather than ' +
  'because of the engine.';

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
    critFrom: 'spell',
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
export const FIREBALL_COEFFICIENTS = hybridSpellCoefficients(
  FIREBALL_CAST_MS,
  FIREBALL_DOT_DURATION_MS,
  FIREBALL_DOT_DURATION_MS / FIREBALL_TICK_INTERVAL_MS,
);

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
 * THE ONE SPELL IN THE PROJECT THAT REACHES THE CAST CLAMP. Six seconds is
 * treated as 3.5, so its direct half is computed from a coefficient of 1.0
 * rather than 1.714 -- see `PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS`.
 */
export const PYROBLAST_CAST_MS = seconds(6);
export const PYROBLAST_COEFFICIENTS = hybridSpellCoefficients(
  PYROBLAST_CAST_MS,
  PYROBLAST_DOT_DURATION_MS,
  PYROBLAST_DOT_DURATION_MS / PYROBLAST_TICK_INTERVAL_MS,
);

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
export const FROSTFIRE_COEFFICIENTS = hybridSpellCoefficients(
  FROSTFIRE_CAST_MS,
  FROSTFIRE_DOT_DURATION_MS,
  FROSTFIRE_DOT_DURATION_MS / FROSTFIRE_TICK_INTERVAL_MS,
);

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

export function igniteAura(totalDamage: number): AuraDefinition {
  const ticks = IGNITE_DURATION_MS / IGNITE_TICK_INTERVAL_MS;
  return {
    id: 'ignite',
    name: 'Ignite',
    durationMs: IGNITE_DURATION_MS,
    isDebuff: true,
    /*
     * RESET, NOT EXTEND, and a second crit REPLACES rather than adding to the
     * remainder. Forever's tooltip describes one burn from one crit and says
     * nothing about rolling them together, so the simpler reading is taken and
     * stated. Classic's Ignite does combine, which is exactly the kind of
     * inherited assumption this project has been caught by before.
     */
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: IGNITE_TICK_INTERVAL_MS,
      /*
       * NO COEFFICIENT, AND THAT IS NOT AN OMISSION. Ignite's magnitude is a
       * percentage OF THE CRIT THAT CAUSED IT, and that hit was already
       * scaled by its own spell's coefficient -- so a coefficient here would
       * apply spell power twice to the same damage. The 0 is the rule for
       * every effect whose size is derived from another hit.
       */
      onTick: (context, aura) => tick(context, aura, totalDamage / ticks, FIRE, 0),
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
 * Combustion: "each of your Fire damage spell hits increases your critical
 * strike chance with Fire damage spells by 10%. Lasts until you have caused 4
 * non-periodic critical strikes with Fire spells."
 *
 * ----------------------------------------------------------------------------
 * A STACKING CRIT BUFF WITH A CRIT-COUNTED END, and only half of it fits.
 *
 * The stacking crit is `SchoolModifiers` territory and `SchoolModifiers` is
 * built once when the character is, not during a fight -- so a per-school crit
 * bonus that comes and goes has nowhere to live. `statModifiers` on an aura
 * reaches `spellCritChance`, which is EVERY school rather than Fire, and a
 * Fire mage casting only Fire spells makes that exact for this build and wrong
 * in principle.
 *
 * Taken, because the alternative is a three-minute cooldown reading as inert
 * for the build that takes it, and the overreach is stated on the ability.
 *
 * THE FOUR-CRIT END IS NOT MODELLED. `chargesOnApply` counts down on swings or
 * blocks, not on the carrier's own critical strikes, so this runs its full
 * duration instead. That is GENEROUS, and it is the honest direction to be
 * wrong in only because it is written down.
 * ----------------------------------------------------------------------------
 */
export const COMBUSTION_CRIT_PER_STACK = 10;
export const COMBUSTION_MAX_STACKS = 10;
export const PLACEHOLDER_COMBUSTION_DURATION_MS = seconds(30);

export const COMBUSTION_UNMODELLED =
  'Its crit bonus applies to EVERY school rather than only to Fire: a ' +
  'per-school crit bonus that comes and goes during a fight has no ' +
  'declaration. Its "until you have caused 4 critical strikes" ending is not ' +
  'modelled either -- nothing counts the carrier’s own crits -- so it runs ' +
  'a placeholder 30 seconds instead, which is generous.';

export const COMBUSTION: AuraDefinition = {
  id: 'combustion',
  name: 'Combustion',
  durationMs: PLACEHOLDER_COMBUSTION_DURATION_MS,
  maxStacks: COMBUSTION_MAX_STACKS,
  refreshBehaviour: 'ignore',
  modifiersScaleWithStacks: true,
  statModifiers: [flat('spellCritChance', COMBUSTION_CRIT_PER_STACK)],
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
 * "ALL YOUR OTHER SPELLS" HAS NO DECLARATION. `damageDoneMultiplier` is every
 * spell INCLUDING Arcane Blast, and there is no "everything except this one".
 * Left out rather than approximated, so the build understates.
 *
 * "OR UNTIL ANY OTHER DAMAGE SPELL IS CAST" is not modelled either: nothing
 * drops an aura because a DIFFERENT ability was used. The eight seconds still
 * apply, so it falls off on its own.
 * ----------------------------------------------------------------------------
 */
export const ARCANE_BLAST_MAX_STACKS = 4;
export const ARCANE_BLAST_DURATION_MS = seconds(8);
export const ARCANE_BLAST_COST_INCREASE_PER_STACK = 1.75;
export const ARCANE_BLAST_DAMAGE_PER_STACK = 10;

export const ARCANE_BLAST_UNMODELLED =
  'Its "+10% damage to all your OTHER spells" is not modelled: a multiplier ' +
  'covering every spell except one has no declaration, so this understates. ' +
  'Its mana escalation IS modelled and is 175% a stack. It also does not fall ' +
  'off early when another damage spell is cast -- nothing drops an aura ' +
  'because a different ability was used -- so it runs its full 8 seconds.';

export const ARCANE_BLAST: AuraDefinition = {
  id: 'arcane_blast',
  name: 'Arcane Blast',
  durationMs: ARCANE_BLAST_DURATION_MS,
  maxStacks: ARCANE_BLAST_MAX_STACKS,
  refreshBehaviour: 'reset',
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
 * THE DAMAGE HALF APPLIES AND THE COST HALF DOES NOT. `damageDoneMultiplier`
 * is exactly right -- "your spells" with no school is the whole character, and
 * a Mage has no physical damage to over-reach into. The cost clause would need
 * a cast modifier naming every Mage spell, which is a list this aura would
 * have to keep in step with the spellbook; it is left out and said so, and it
 * makes the ability GENEROUS.
 */
export const ARCANE_POWER_DAMAGE = 1.3;
export const ARCANE_POWER_DURATION_MS = seconds(15);

export const ARCANE_POWER_UNMODELLED =
  'Its +30% damage applies. Its "+30% mana cost" does not, which makes this ' +
  'generous: expressing it would mean naming every Mage spell in a list that ' +
  'has to be kept in step with the spellbook.';

export const ARCANE_POWER: AuraDefinition = {
  id: 'arcane_power',
  name: 'Arcane Power',
  durationMs: ARCANE_POWER_DURATION_MS,
  damageDoneMultiplier: ARCANE_POWER_DAMAGE,
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
