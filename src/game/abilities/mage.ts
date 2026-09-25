import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { baseManaFor } from '../character/baseStatLookup';
import { channelTickCoefficient, directSpellCoefficient } from '../combat/spellCoefficient';
import {
  ARCANE_BLAST,
  ARCANE_BLAST_UNMODELLED,
  ARCANE_POWER,
  ARCANE_POWER_UNMODELLED,
  COMBUSTION,
  COMBUSTION_UNMODELLED,
  FIREBALL_CAST_MS,
  FIREBALL_COEFFICIENTS,
  FIREBALL_DOT,
  FROSTFIRE_CAST_MS,
  FROSTFIRE_COEFFICIENTS,
  FROSTFIRE_DOT,
  FROZEN_UNMODELLED,
  PRESENCE_OF_MIND,
  PYROBLAST_CAST_MS,
  PYROBLAST_COEFFICIENTS,
  PYROBLAST_DOT,
} from '../auras/mage';

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
 * NOTHING FREEZES A RAID BOSS, which costs the Frost half of the Frostfire
 * build four talents and most of Ice Lance. See `FROZEN_UNMODELLED` -- they are
 * inert because of the TARGET rather than because of the engine.
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

export const SCORCH_DAMAGE = midpoint(166, 196);
export const SCORCH_CAST_MS = seconds(1.5);
export const SCORCH_COEFFICIENT = directSpellCoefficient(SCORCH_CAST_MS);

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

export const FIRE_BLAST_DAMAGE = midpoint(417, 489);
/** Instant, so 1.5 / 3.5 by the owner's own wording. */
export const FIRE_BLAST_COEFFICIENT = directSpellCoefficient(0);

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
export const BLAST_WAVE_COEFFICIENT = directSpellCoefficient(0);

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

/** Combustion, granted by the Fire capstone. */
export const COMBUSTION_ABILITY: Ability = {
  id: 'combustion',
  name: 'Combustion',
  cooldownMs: seconds(180),
  onCast: ({ simulation, caster }) => {
    /*
     * APPLIED AT FULL STACKS, because the ramp it describes cannot be
     * modelled: stacks are meant to build one per Fire spell HIT and to end
     * after four crits, and nothing counts either. Ten stacks for a
     * placeholder thirty seconds is the generous reading, and the ability says
     * so where a person can see it.
     */
    const instance = simulation.applyAura(caster, COMBUSTION, caster.id);
    instance.stacks = COMBUSTION.maxStacks ?? 1;
  },
  unmodelled: COMBUSTION_UNMODELLED,
};

// ---------------------------------------------------------------------------
// Frost
// ---------------------------------------------------------------------------

export const FROSTBOLT_DAMAGE = midpoint(457, 493);
export const FROSTBOLT_CAST_MS = seconds(3);
export const FROSTBOLT_COEFFICIENT = directSpellCoefficient(FROSTBOLT_CAST_MS);

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
      baseAmount: FROSTFIRE_BOLT_DAMAGE,
      powerCoefficient: FROSTFIRE_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, FROSTFIRE_DOT, caster.id);
  },
  unmodelled:
    'It counts as both Frost and Fire; it is dealt as Fire, which is the ' +
    'school both builds that cast it have talents for. Its coefficient ' +
    'therefore reads FIRE-scoped spell power and not Frost-scoped.',
};

/**
 * Ice Lance, granted by the Frost talent.
 *
 * ITS 300% CLAUSE NEVER FIRES. "Deals 300% increased damage to Frozen targets",
 * and nothing freezes a raid boss -- so what is left is a 148-damage instant
 * for 160 mana, which is a poor spell and correctly so.
 */
export const ICE_LANCE_DAMAGE = midpoint(136, 160);
export const ICE_LANCE_FROZEN_MULTIPLIER = 4;
export const ICE_LANCE_COEFFICIENT = directSpellCoefficient(0);

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
      baseAmount: ICE_LANCE_DAMAGE,
      powerCoefficient: ICE_LANCE_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: FROZEN_UNMODELLED,
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
export const ARCANE_MISSILES_TICK_COEFFICIENT = channelTickCoefficient(
  ARCANE_MISSILES_CHANNEL_MS,
  ARCANE_MISSILES_TICKS,
);

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
export const ARCANE_BLAST_COEFFICIENT = directSpellCoefficient(ARCANE_BLAST_CAST_MS);

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

/** Arcane Power, granted by the Arcane capstone. */
export const ARCANE_POWER_ABILITY: Ability = {
  id: 'arcane_power',
  name: 'Arcane Power',
  cooldownMs: seconds(180),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, ARCANE_POWER, caster.id);
  },
  unmodelled: ARCANE_POWER_UNMODELLED,
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
];
