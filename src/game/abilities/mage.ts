import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { baseManaFor } from '../character/baseStatLookup';
import {
  ARCANE_BLAST,
  ARCANE_BLAST_UNMODELLED,
  ARCANE_POWER,
  ARCANE_POWER_UNMODELLED,
  COMBUSTION,
  COMBUSTION_UNMODELLED,
  FIREBALL_DOT,
  FROSTFIRE_DOT,
  FROZEN_UNMODELLED,
  PRESENCE_OF_MIND,
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
 * NO SPELL POWER COEFFICIENTS, for the third class running. Every Mage nuke
 * states flat damage -- "425 to 541 Fire damage" -- and no coefficient. Druid,
 * Shaman and now Mage: this is how Forever's spell data is written, and a
 * caster figure here is a FLOOR rather than an estimate.
 *
 * NOTHING FREEZES A RAID BOSS, which costs the Frost half of the Frostfire
 * build four talents and most of Ice Lance. See `FROZEN_UNMODELLED` -- they are
 * inert because of the TARGET rather than because of the engine.
 * ----------------------------------------------------------------------------
 */

/** Said once, because every nuke in this file says it. */
const NO_SPELL_COEFFICIENT =
  'Its damage is flat. The source states a range and no spell power ' +
  'coefficient, so none is invented -- a geared Mage understates this rather ' +
  'than guessing at it.';

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
  castTimeMs: seconds(3.5),
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
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, FIREBALL_DOT, caster.id);
  },
  unmodelled: NO_SPELL_COEFFICIENT,
};

export const SCORCH_DAMAGE = midpoint(166, 196);

export const SCORCH: Ability = {
  id: 'scorch',
  name: 'Scorch',
  cost: { resource: 'mana', amount: 150 },
  castTimeMs: seconds(1.5),
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
      attackTable: ability.attackTable,
    });
    /*
     * IMPROVED SCORCH'S VULNERABILITY IS APPLIED BY A REACTION, not here. The
     * talent gives it a chance and a magnitude, and an ability that applied it
     * unconditionally would hand an untalented mage the debuff for free.
     */
  },
  unmodelled: NO_SPELL_COEFFICIENT,
};

export const PYROBLAST_DAMAGE = midpoint(520, 646);

export const PYROBLAST: Ability = {
  id: 'pyroblast',
  name: 'Pyroblast',
  cost: { resource: 'mana', amount: 440 },
  castTimeMs: seconds(6),
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
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, PYROBLAST_DOT, caster.id);
  },
  unmodelled: NO_SPELL_COEFFICIENT,
};

export const FIRE_BLAST_DAMAGE = midpoint(417, 489);

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
      attackTable: ability.attackTable,
    });
  },
  unmodelled: NO_SPELL_COEFFICIENT,
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
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    `${NO_SPELL_COEFFICIENT} It is an AREA effect and lands on the one target ` +
    'this project has, so its value in a pull of several is not shown.',
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

export const FROSTBOLT: Ability = {
  id: 'frostbolt',
  name: 'Frostbolt',
  cost: { resource: 'mana', amount: 290 },
  castTimeMs: seconds(3),
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
      attackTable: ability.attackTable,
    });
  },
  unmodelled: `${NO_SPELL_COEFFICIENT} Its slow does nothing; nothing here moves.`,
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
  castTimeMs: seconds(3),
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
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, FROSTFIRE_DOT, caster.id);
  },
  unmodelled:
    `${NO_SPELL_COEFFICIENT} It counts as both Frost and Fire; it is dealt as ` +
    'Fire, which is the school both builds that cast it have talents for.',
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
      attackTable: ability.attackTable,
    });
  },
  unmodelled: `${NO_SPELL_COEFFICIENT} ${FROZEN_UNMODELLED}`,
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

export const ARCANE_MISSILES: Ability = {
  id: 'arcane_missiles',
  name: 'Arcane Missiles',
  cost: { resource: 'mana', amount: 655 },
  castTimeMs: seconds(ARCANE_MISSILES_TICKS),
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
      attackTable: ability.attackTable,
    });
  },
  unmodelled: NO_SPELL_COEFFICIENT,
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

export const ARCANE_BLAST_ABILITY: Ability = {
  id: 'arcane_blast',
  name: 'Arcane Blast',
  cost: {
    resource: 'mana',
    amount: Math.round(MAGE_BASE_MANA * ARCANE_BLAST_BASE_MANA_FRACTION),
  },
  castTimeMs: seconds(2.5),
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
  unmodelled: `${NO_SPELL_COEFFICIENT} ${ARCANE_BLAST_UNMODELLED}`,
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
