import type { Ability, Combatant } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { baseManaFor } from '../character/baseStatLookup';
import {
  ARCANE_BLAST,
  ARCANE_BLAST_UNMODELLED,
  ARCANE_POWER,
  COMBUSTION,
  FIREBALL_CAST_MS,
  FIREBALL_COEFFICIENTS,
  FIREBALL_DOT,
  EVOCATION_AURA,
  EVOCATION_CHANNEL_MS,
  FROSTFIRE_ALSO_COUNTS_AS,
  FROSTFIRE_CAST_MS,
  FROSTFIRE_COEFFICIENTS,
  FROSTFIRE_DOT,
  FINGERS_OF_FROST,
  MAGE_ARMOR,
  MAGE_ARMOR_MAGIC_RESISTANCE,
  PRESENCE_OF_MIND,
  PYROBLAST_CAST_MS,
  PYROBLAST_COEFFICIENTS,
  PYROBLAST_DOT,
} from '../auras/mage';
import {
  ARCANE_BLAST_SP_COEFFICIENT,
  ARCANE_MISSILES_TICK_SP_COEFFICIENT,
  BLAST_WAVE_SP_COEFFICIENT,
  FIRE_BLAST_SP_COEFFICIENT,
  FROSTBOLT_SP_COEFFICIENT,
  ICE_LANCE_SP_COEFFICIENT,
  SCORCH_SP_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Mage abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE THIRD CASTER, AND THE FIRST TO NEED ENGINE WORK. Two rules arrived
 * before it and both are general: per-SCHOOL modifiers, because six Mage
 * talents read "your Fire spells" rather than naming an ability, and CHANNELLED
 * casts, because Arcane Missiles is the Arcane build's core spender.
 *
 * EVERY NUKE NOW SCALES, and the rule came from the ruleset owner rather than
 * from the spell data: `castTime / 3.5` of the character's spell power, added
 * to the flat damage the source states. The data is unchanged -- it still
 * gives "425 to 541 Fire damage" and no coefficient -- but the coefficient is
 * a RULE and it is universal, so it does not need to be stated per spell. See
 * `game/combat/spellCoefficient.ts`.
 *
 * THREE OF THESE ARE HYBRIDS and their pairs live in `auras/mage.ts`, beside
 * the burn each one leaves: Fireball, Pyroblast and Frostfire Bolt share one
 * spell's scaling between the hit and the DoT rather than taking both.
 *
 * NOTHING FREEZES A RAID BOSS, AND IT COSTS THE FROSTFIRE BUILD NOTHING. This
 * said "three talents" for a long time and the number was never re-read:
 * `FROZEN_UNMODELLED` is carried by Frostbite alone now, and the 0/29/22 build
 * does not take Frostbite. Ice Lance and Shatter both reach their Frozen
 * clauses through Fingers of Frost, which does not freeze the target -- it
 * makes the caster's next spells behave as though it were, which is a state on
 * the MAGE and is reachable exactly as written.
 * ----------------------------------------------------------------------------
 */

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/**
 * A Mage's base mana, which is what a "% of base mana" cost is a share of.
 *
 * BASE MANA IS A CLASS CONSTANT, not a character one: it is the same 933 for
 * every race, and intellect is added on top of it to make the pool. So the
 * cost can be resolved here rather than per character, and a test pins the
 * race-independence rather than trusting it.
 */
export const MAGE_BASE_MANA = baseManaFor('gnome', 'mage');

// ---------------------------------------------------------------------------
// Fire
// ---------------------------------------------------------------------------

export const FIREBALL_DAMAGE = midpoint(425, 541);

export const FIREBALL: Ability = {
  id: 'fireball',
  name: 'Fireball',
  cost: { resource: 'mana', amount: 410 },
  castTimeMs: FIREBALL_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: FIREBALL_DAMAGE,
      // The hit's share of the pair. NOT `directSpellCoefficient(3.5s)`: the
      // burn takes the rest, and the two come out of one call so they cannot
      // be weighted against different assumptions.
      powerCoefficient: FIREBALL_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, FIREBALL_DOT, caster.id);
  },
};

// 163 to 193 from foreverchanges.pro; our capture says 166 to 196 at the same
// rank 7 and build. Same for Fire Blast and Ice Lance below.
export const SCORCH_DAMAGE = midpoint(163, 193);
export const SCORCH_CAST_MS = seconds(1.5);
export const SCORCH_COEFFICIENT = SCORCH_SP_COEFFICIENT;

export const SCORCH: Ability = {
  id: 'scorch',
  name: 'Scorch',
  cost: { resource: 'mana', amount: 150 },
  castTimeMs: SCORCH_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: SCORCH_DAMAGE,
      powerCoefficient: SCORCH_COEFFICIENT,
      attackTable: ability.attackTable,
    });
    /*
     * IMPROVED SCORCH'S VULNERABILITY IS APPLIED BY A REACTION, not here. The
     * talent gives it a chance and a magnitude, and an ability that applied it
     * unconditionally would hand an untalented mage the debuff for free.
     */
  },
};

export const PYROBLAST_DAMAGE = midpoint(520, 646);

export const PYROBLAST: Ability = {
  id: 'pyroblast',
  name: 'Pyroblast',
  cost: { resource: 'mana', amount: 440 },
  castTimeMs: PYROBLAST_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: PYROBLAST_DAMAGE,
      powerCoefficient: PYROBLAST_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, PYROBLAST_DOT, caster.id);
  },
};

export const FIRE_BLAST_DAMAGE = midpoint(402, 474);
/** Instant, so 1.5 / 3.5 by the owner's own wording. */
export const FIRE_BLAST_COEFFICIENT = FIRE_BLAST_SP_COEFFICIENT;

export const FIRE_BLAST: Ability = {
  id: 'fire_blast',
  name: 'Fire Blast',
  cost: { resource: 'mana', amount: 340 },
  cooldownMs: seconds(8),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: FIRE_BLAST_DAMAGE,
      powerCoefficient: FIRE_BLAST_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/**
 * Blast Wave, granted by the Fire talent.
 *
 * AN AREA EFFECT ON A SINGLE TARGET. It lands in full on the one enemy there
 * is, which is correct for that enemy and says nothing about what the spell is
 * worth in a pull of five. The talent tooltip's 154 to 184 is rank 1; a level
 * 60 trains rank 5.
 */
export const BLAST_WAVE_DAMAGE = midpoint(453, 533);
export const BLAST_WAVE_COEFFICIENT = BLAST_WAVE_SP_COEFFICIENT;

export const BLAST_WAVE: Ability = {
  id: 'blast_wave',
  name: 'Blast Wave',
  cost: { resource: 'mana', amount: 545 },
  cooldownMs: seconds(45),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: BLAST_WAVE_DAMAGE,
      powerCoefficient: BLAST_WAVE_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    'It is an AREA effect and lands on the one target this project has, so ' +
    'its value in a pull of several is not shown.',
};

/**
 * Combustion, granted by the Fire capstone.
 *
 * ----------------------------------------------------------------------------
 * APPLIED AT ONE STACK, WHICH IS THE RAMP STARTING. It used to be applied at
 * FULL stacks -- ten at once, worth +100% crit to every school, for a
 * placeholder thirty seconds -- because nothing counted Fire spell hits and
 * nothing counted the four crits that end it. `combustionCounter` in
 * `reactions/mageTalents.ts` counts both now, so the ability does the one thing
 * the tooltip gives it: switch the effect on.
 *
 * THE FIRST STACK IS THE CAST'S OWN, and not a hit's. "When activated, this
 * spell causes each of your Fire damage spell hits to increase..." describes an
 * effect that exists before the first hit, and an aura cannot be applied at
 * zero stacks. So the Fire spell cast immediately after Combustion already
 * carries 10%, and each hit after it adds another.
 * ----------------------------------------------------------------------------
 */
export const COMBUSTION_ABILITY: Ability = {
  id: 'combustion',
  name: 'Combustion',
  cooldownMs: seconds(180),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, COMBUSTION, caster.id);
  },
};

// ---------------------------------------------------------------------------
// Frost
// ---------------------------------------------------------------------------

export const FROSTBOLT_DAMAGE = midpoint(457, 493);
export const FROSTBOLT_CAST_MS = seconds(3);
export const FROSTBOLT_COEFFICIENT = FROSTBOLT_SP_COEFFICIENT;

export const FROSTBOLT: Ability = {
  id: 'frostbolt',
  name: 'Frostbolt',
  cost: { resource: 'mana', amount: 290 },
  castTimeMs: FROSTBOLT_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'frost',
      baseAmount: FROSTBOLT_DAMAGE,
      powerCoefficient: FROSTBOLT_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: 'Its slow does nothing; nothing here moves.',
};

/**
 * Frostfire Bolt: "counts as both Frost and Fire damage".
 *
 * DEALT AS FIRE, and stated rather than silently chosen. A `DamageRequest`
 * carries one school, and Fire is the one that matters to both builds that
 * cast this: Improved Fireball names Frostfire Bolt explicitly and Fire Power
 * covers it, while Piercing Ice does not name it at all.
 *
 * The resist clause -- "checked against the lower of the target's Frost and
 * Fire resists" -- does nothing, because resistance has no effect on an enemy
 * target by the ruleset owner's ruling.
 */
export const FROSTFIRE_BOLT_DAMAGE = midpoint(270, 314);

export const FROSTFIRE_BOLT: Ability = {
  id: 'frostfire_bolt',
  name: 'Frostfire Bolt',
  cost: { resource: 'mana', amount: 370 },
  castTimeMs: FROSTFIRE_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      // AND FROST, for the caster's own Frost talents. See above.
      countsAsSchools: FROSTFIRE_ALSO_COUNTS_AS,
      baseAmount: FROSTFIRE_BOLT_DAMAGE,
      powerCoefficient: FROSTFIRE_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, FROSTFIRE_DOT, caster.id);
  },
  unmodelled:
    'It counts as both Frost and Fire and is DEALT as Fire, so its ' +
    'school-scoped SPELL POWER is read as Fire only -- adding two pools to one ' +
    'cast is more than any talent asks for. Its Frost TALENTS do reach it: ' +
    'Piercing Ice, Ice Shards and Frost Channeling all select it now, which ' +
    'is what `countsAsSchools` is for.',
};

/*
 * ============================================================================
 * ICE LANCE, AND ITS 300% CLAUSE NOW FIRES.
 *
 * "Deals 300% increased damage to Frozen targets." It was recorded as
 * permanently inert -- nothing freezes a raid boss -- and that is still true
 * of every OTHER Frozen effect in this class. Fingers of Frost is the
 * exception: it does not freeze the target, it makes the caster's next spells
 * behave as though it were, which is a state on the Mage.
 *
 * TIMES FOUR, NOT THREE, by the ruleset owner's ruling. "Increased BY 300%" is
 * base plus three times itself; "deals 300% damage" would be three, and that is
 * also what Classic's Ice Lance does -- so the reading that agrees with Classic
 * is the one that was rejected. Forever marks this spell `new`, so Classic is
 * not authoritative about it in either direction.
 *
 * 133-157 AND NOT THE CAPTURE'S 136-160, by the standing rule that
 * `foreverchanges.pro` wins a disagreement. Recorded in
 * docs/source-cross-checks.md; said here too, because a number that disagrees
 * with the checked-in capture reads as drift without the ruling beside it.
 * ============================================================================
 */
export const ICE_LANCE_DAMAGE = midpoint(133, 157);
export const ICE_LANCE_FROZEN_MULTIPLIER = 4;
export const ICE_LANCE_COEFFICIENT = ICE_LANCE_SP_COEFFICIENT;

/*
 * ============================================================================
 * TWO FOURS SIT NEXT TO EACH OTHER HERE AND THEY ARE DIFFERENT FOURS.
 *
 * `ICE_LANCE_FROZEN_MULTIPLIER` is the ruleset's "300% increased damage against
 * frozen targets", times four by the owner's ruling. The four INSIDE
 * `ICE_LANCE_SP_COEFFICIENT` is part of the owner's own expression for the
 * coefficient, `1.5 / 3.5 / 4`, and is not that multiplier.
 *
 * SO THEY MULTIPLY OUT, AND THE PRODUCT IS A FAMILIAR NUMBER: a frozen Ice
 * Lance carries `1.5 / 3.5 / 4 * 4` = `1.5 / 3.5` = 0.4286, which is exactly the
 * coefficient the spell had UNFROZEN before the change. A reader who remembers
 * the old 0.43 will see it reappear on the frozen cast and reasonably suspect a
 * four has been cancelled by accident. It has not.
 *
 * WHAT WOULD GO WRONG IF THE TWO WERE CONFLATED is worth stating because it is
 * large in both directions. Dropping the frozen multiplier from the coefficient
 * -- reading the owner's `/4` as having already done it -- makes a frozen Ice
 * Lance a quarter of its intended coefficient. Applying the multiplier twice
 * makes it four times. Sixteen between the two readings, on a spell that was
 * 35.7% of the Frostfire profile.
 *
 * THE GUARD IS A TEST THAT MULTIPLIES THEM OUT END TO END rather than a check
 * on either constant, which is the argument the pet's 1.375 damage multiplier
 * already makes: a constant check cannot see a double application.
 * ============================================================================
 */

/**
 * Four while Fingers of Frost is up, one otherwise.
 *
 * READ AT CAST TIME rather than being decided when the aura lands, because the
 * charge can expire between the proc and the cast -- the aura is fifteen
 * seconds and the rotation may have a Scorch and a Pyroblast to get through
 * first.
 *
 * THE CHARGE IS NOT SPENT HERE. `fingersOfFrostSpender` takes one on every
 * cast, which is what "your next 2 SPELLS" says: spending it in this ability
 * would leave a charge surviving the Scorch above it in the list.
 */
function frozenMultiplier(caster: Combatant): number {
  return caster.auras.has(FINGERS_OF_FROST.id) ? ICE_LANCE_FROZEN_MULTIPLIER : 1;
}

export const ICE_LANCE: Ability = {
  id: 'ice_lance',
  name: 'Ice Lance',
  cost: { resource: 'mana', amount: 160 },
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'frost',
      /*
       * THE MULTIPLIER IS ON THE BASE AND THE COEFFICIENT BOTH, which is what
       * "deals 300% increased damage" says: all of the damage, not the flat
       * half of it. Applying it to `baseAmount` alone would leave a
       * spell-power-heavy Mage's Ice Lance barely improved and would look
       * entirely reasonable.
       */
      baseAmount: ICE_LANCE_DAMAGE * frozenMultiplier(caster),
      powerCoefficient: ICE_LANCE_COEFFICIENT * frozenMultiplier(caster),
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    'Its 300% clause is reachable ONLY through Fingers of Frost. Nothing ' +
    'freezes a raid boss, so a Mage without that talent deals the base ' +
    'damage always -- which is the target being what it is, not a gap.',
};

// ---------------------------------------------------------------------------
// Arcane
// ---------------------------------------------------------------------------

/**
 * Arcane Missiles: "209 Arcane damage each second for 5 sec".
 *
 * ----------------------------------------------------------------------------
 * THE FIRST CHANNEL IN THE PROJECT, and the reason `Ability.channelTicks`
 * exists. Five ticks over five seconds, each rolling the spell table on its
 * own -- so a missile can miss while the rest land, which is what a channel
 * does and is not what a 1045-damage cast at the five-second mark would do.
 *
 * MISSILE BARRAGE HALVES THE CHANNEL and the ticks stay at five, because
 * `channelTicks` is a COUNT and the gaps shrink with the cast. That is the
 * tooltip's "reduce the channeled duration by 50% ... and missiles fire every
 * 0.5 sec" -- three clauses that turn out to be one thing.
 * ----------------------------------------------------------------------------
 */
export const ARCANE_MISSILES_PER_TICK = 209;
export const ARCANE_MISSILES_TICKS = 5;
export const ARCANE_MISSILES_CHANNEL_MS = seconds(ARCANE_MISSILES_TICKS);

/*
 * THE WHOLE CHANNEL IS THE CAST, so five seconds over 3.5 is 1.429 shared
 * evenly across the five missiles -- 0.286 each. It is the largest total
 * coefficient in the project and it is NOT clamped, unlike a direct cast:
 * a channel pays for its scaling in time, which is the thing the clamp on a
 * direct cast exists to prevent.
 *
 * FROM THE BASE CHANNEL TIME, not the talented one. Missile Barrage halves
 * the channel and keeps all five missiles; reading the shortened time here
 * would make that talent cut the spell's scaling in half while doubling its
 * rate, which nets out to nothing and would look like the talent working.
 */
export const ARCANE_MISSILES_TICK_COEFFICIENT = ARCANE_MISSILES_TICK_SP_COEFFICIENT;

export const ARCANE_MISSILES: Ability = {
  id: 'arcane_missiles',
  name: 'Arcane Missiles',
  cost: { resource: 'mana', amount: 655 },
  castTimeMs: ARCANE_MISSILES_CHANNEL_MS,
  channelTicks: ARCANE_MISSILES_TICKS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      baseAmount: ARCANE_MISSILES_PER_TICK,
      // Per MISSILE. `onCast` runs once per tick for a channel.
      powerCoefficient: ARCANE_MISSILES_TICK_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/**
 * Arcane Blast, granted by the Arcane talent.
 *
 * ITS COST IS A SHARE OF BASE MANA -- "15% of base mana" -- which is 140 for
 * every Mage, and it ESCALATES: each cast adds a stack worth +175% of that
 * base, to four. See `ARCANE_BLAST` in `auras/mage.ts` for what is and is not
 * modelled; the short version is that the cost half is exact and the "+10% to
 * all your other spells" half is not.
 */
export const ARCANE_BLAST_BASE_MANA_FRACTION = 0.15;
export const ARCANE_BLAST_DAMAGE = midpoint(364, 424);
export const ARCANE_BLAST_CAST_MS = seconds(2.5);
export const ARCANE_BLAST_COEFFICIENT = ARCANE_BLAST_SP_COEFFICIENT;

export const ARCANE_BLAST_ABILITY: Ability = {
  id: 'arcane_blast',
  name: 'Arcane Blast',
  cost: {
    resource: 'mana',
    amount: Math.round(MAGE_BASE_MANA * ARCANE_BLAST_BASE_MANA_FRACTION),
  },
  castTimeMs: ARCANE_BLAST_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      baseAmount: ARCANE_BLAST_DAMAGE,
      powerCoefficient: ARCANE_BLAST_COEFFICIENT,
      attackTable: ability.attackTable,
    });
    /*
     * THE STACK GOES UP AFTER THE CAST THAT PAID THE OLD PRICE. The cost was
     * resolved and taken at cast START, so this stack raises the price of the
     * NEXT one -- which is what "each time you cast Arcane Blast, the mana
     * cost is increased" means, and the opposite of what applying it first
     * would do.
     */
    simulation.applyAura(caster, ARCANE_BLAST, caster.id);
  },
  unmodelled: ARCANE_BLAST_UNMODELLED,
};

/**
 * Arcane Power, granted by the Arcane capstone.
 *
 * NO CAVEAT ANY MORE. Both halves of "your spells deal 30% more damage while
 * costing 30% more mana" are modelled -- see `ARCANE_POWER` for the list the
 * cost half names and the test that keeps it in step with the book.
 */
export const ARCANE_POWER_ABILITY: Ability = {
  id: 'arcane_power',
  name: 'Arcane Power',
  cooldownMs: seconds(180),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, ARCANE_POWER, caster.id);
  },
};

/** Presence of Mind, granted by the Arcane talent. */
export const PRESENCE_OF_MIND_ABILITY: Ability = {
  id: 'presence_of_mind',
  name: 'Presence of Mind',
  cooldownMs: seconds(180),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, PRESENCE_OF_MIND, caster.id);
  },
};

/**
 * Mage Armor. One instant at the pull, and it lasts the fight.
 *
 * Its worth is entirely the five second rule -- see `MAGE_ARMOR` for why the
 * mana half is the half that matters here and the resistance half is not.
 */
export const MAGE_ARMOR_ABILITY: Ability = {
  id: 'mage_armor',
  name: 'Mage Armor',
  cost: { resource: 'mana', amount: 490 },
  requiresTarget: false,
  canCast: ({ caster }) => !caster.auras.has('mage_armor'),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, MAGE_ARMOR, caster.id);
  },
  unmodelled:
    `Its +${MAGE_ARMOR_MAGIC_RESISTANCE} resistance to all magic does nothing: ` +
    'no Mage profile is attacked, so there is no incoming spell for it to ' +
    'reduce. The mana half is modelled in full.',
};

/**
 * Evocation. An eight-second channel that buys mana and costs damage.
 *
 * ----------------------------------------------------------------------------
 * THE FIRST ABILITY IN THE PROJECT THAT PAYS OUT DURING ITS OWN CAST, which is
 * why `Ability.onCastStart` exists. The pair is the design: `onCastStart`
 * opens the window and `onCast` closes it, so it ends exactly when the channel
 * does. Giving the aura a duration instead would mean keeping an eight-second
 * constant in step with a cast time haste shortens -- and getting that wrong is
 * free mana after the channel, which nothing would flag.
 *
 * NO `channelTicks`, and it is still a channel. `castEndsAt` is what locks the
 * caster out, and that is set for any cast with a cast time; ticks exist for an
 * ability whose EFFECT repeats, and this one's effect is a rate rather than a
 * series of events. A one-tick channel and a plain cast are the same thing in
 * this engine, which is exactly what this wants.
 *
 * THE COST IS THE EIGHT SECONDS. It has no mana cost and a 480-second
 * cooldown, so it fires once a fight and the question a list has to answer is
 * whether the mana is worth more than the casts it displaces -- which is why
 * the entry is gated at 10% mana rather than used on cooldown.
 * ----------------------------------------------------------------------------
 */
export const EVOCATION_COOLDOWN_MS = seconds(480);

export const EVOCATION: Ability = {
  id: 'evocation',
  name: 'Evocation',
  castTimeMs: EVOCATION_CHANNEL_MS,
  cooldownMs: EVOCATION_COOLDOWN_MS,
  requiresTarget: false,
  onCastStart: ({ simulation, caster }) => {
    simulation.applyAura(caster, EVOCATION_AURA, caster.id);
  },
  /*
   * THE CHANNEL ENDING IS THE EFFECT ENDING. Removing it here rather than
   * letting the aura expire is what keeps the window and the cast the same
   * length under haste.
   */
  onCast: ({ simulation, caster }) => {
    caster.auras.remove(simulation, EVOCATION_AURA.id);
  },
};

export const MAGE_ABILITIES: readonly Ability[] = [
  FIREBALL,
  SCORCH,
  PYROBLAST,
  FIRE_BLAST,
  BLAST_WAVE,
  COMBUSTION_ABILITY,
  FROSTBOLT,
  FROSTFIRE_BOLT,
  ICE_LANCE,
  ARCANE_MISSILES,
  ARCANE_BLAST_ABILITY,
  ARCANE_POWER_ABILITY,
  PRESENCE_OF_MIND_ABILITY,
  MAGE_ARMOR_ABILITY,
  EVOCATION,
];
