import type { Ability, Combatant, SimulationContext } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  FLAME_SHOCK_DOT,
  RAGE_OF_THE_FARSEER,
  STORMSTRIKE_DAMAGE_BONUS,
  STORMSTRIKE_DEBUFF,
  WINDFURY_WEAPON_IMBUE,
} from '../auras/shaman';
import { MAELSTROM_WEAPON_UNMODELLED } from '../reactions/shamanTalents';

/**
 * Shaman abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE SECOND CASTER, AND THE FIRST HYBRID THAT SPENDS ONE POOL ON BOTH HALVES.
 *
 * Enhancement pays mana for Stormstrike, its shocks and its weapon imbue while
 * swinging a two-hander, which no class here has done: a Warrior's rage and a
 * Rogue's energy both refill on their own, and a Moonkin casts until the bar
 * is empty and then stops. A Shaman that empties its bar keeps swinging, so
 * running dry costs it the abilities rather than the fight.
 *
 * NO SPELL POWER COEFFICIENTS, again. Every Shaman nuke states flat damage --
 * "189 to 211 Nature damage" -- and no coefficient, exactly as every Druid
 * spell did. So this is not a Druid quirk; it is how Forever's spell data
 * reads, and a caster figure here is a FLOOR rather than an estimate.
 *
 * RESISTANCE IS RULED TO HAVE NO EFFECT on an enemy target, so these land for
 * full against a raid boss.
 *
 * NOT HERE, AND EACH FOR A STATED REASON:
 *
 *   TOTEMS       Searing, Magma and Fire Nova are the Elemental shaman's own
 *                damage that this file cannot give it. A totem is a separate
 *                attacking entity and the engine has none; Searing Totem does
 *                not even state an attack interval, and Fire Nova REQUIRES an
 *                active fire totem to go off at all. See docs.
 *   IMBUES       Windfury Weapon is here. Flametongue, Frostbrand and
 *                Rockbiter are not: Flametongue and Frostbrand scale their
 *                damage with weapon speed and state only a range, so the
 *                coefficient is missing, and Rockbiter's attack power is a
 *                threat imbue nothing here would choose.
 *   HEALS        Every Restoration spell. No Shaman profile heals.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const PHYSICAL = 'physical' as const;

/** Said once, because every nuke in this file says it. */
const NO_SPELL_COEFFICIENT =
  'Its damage is flat. The source states a range and no spell power ' +
  'coefficient, so none is invented -- a geared Shaman understates this ' +
  'rather than guessing at it.';

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/**
 * Spend Stormstrike's debuff, if it is up, and report the multiplier.
 *
 * Lightning Bolt, Chain Lightning and Earth Shock are the three spells the
 * tooltip names, and the debuff is consumed by whichever lands FIRST -- so
 * removing it here, in the cast that benefits, is the mechanic rather than
 * bookkeeping. See `STORMSTRIKE_DEBUFF` for why this is not a school
 * multiplier on the target.
 */
function spendStormstrike(simulation: SimulationContext, target: Combatant): number {
  if (!target.auras.has(STORMSTRIKE_DEBUFF.id)) return 1;
  target.auras.remove(simulation, STORMSTRIKE_DEBUFF.id);
  return STORMSTRIKE_DAMAGE_BONUS;
}

// ---------------------------------------------------------------------------
// Elemental
// ---------------------------------------------------------------------------

export const LIGHTNING_BOLT_DAMAGE = midpoint(189, 211);

export const LIGHTNING_BOLT: Ability = {
  id: 'lightning_bolt',
  name: 'Lightning Bolt',
  cost: { resource: 'mana', amount: 220 },
  castTimeMs: seconds(2.5),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'nature',
      baseAmount: LIGHTNING_BOLT_DAMAGE * spendStormstrike(simulation, target),
      attackTable: ability.attackTable,
    });
  },
  unmodelled: `${NO_SPELL_COEFFICIENT} ${MAELSTROM_WEAPON_UNMODELLED}`,
};

/**
 * Chain Lightning: "dealing 119 to 133 Nature damage and then jumping to
 * additional nearby enemies. Each jump reduces the damage by 30%. Affects 3
 * total targets."
 *
 * THE JUMPS ARE NOT MODELLED AND CANNOT BE. Every encounter in this project
 * has exactly one target, so the second and third hits have nothing to land
 * on. Only the first target's damage is dealt, which is the honest reading for
 * a single-target fight and is what makes this spell a poor one here relative
 * to what it is worth in a pull of three.
 */
export const CHAIN_LIGHTNING_DAMAGE = midpoint(119, 133);
export const CHAIN_LIGHTNING_TARGETS = 3;

export const CHAIN_LIGHTNING: Ability = {
  id: 'chain_lightning',
  name: 'Chain Lightning',
  cost: { resource: 'mana', amount: 485 },
  castTimeMs: seconds(2),
  cooldownMs: seconds(6),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'nature',
      baseAmount: CHAIN_LIGHTNING_DAMAGE * spendStormstrike(simulation, target),
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    `${NO_SPELL_COEFFICIENT} It also jumps to ${CHAIN_LIGHTNING_TARGETS - 1} further ` +
    'enemies at 30% less damage each, and every encounter here has one target.',
};

export const EARTH_SHOCK_DAMAGE = midpoint(293, 309);

export const EARTH_SHOCK: Ability = {
  id: 'earth_shock',
  name: 'Earth Shock',
  cost: { resource: 'mana', amount: 450 },
  cooldownMs: seconds(6),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'nature',
      baseAmount: EARTH_SHOCK_DAMAGE * spendStormstrike(simulation, target),
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    `${NO_SPELL_COEFFICIENT} Its interrupt and school lockout do nothing: ` +
    'nothing the target does is a cast.',
};

export const FLAME_SHOCK_DIRECT = 166;

export const FLAME_SHOCK: Ability = {
  id: 'flame_shock',
  name: 'Flame Shock',
  cost: { resource: 'mana', amount: 410 },
  cooldownMs: seconds(6),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    // One roll decides both halves: whether the effect landed is settled by
    // the cast, and the burn does not re-roll the table.
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: FLAME_SHOCK_DIRECT,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, FLAME_SHOCK_DOT, caster.id);
  },
  unmodelled: NO_SPELL_COEFFICIENT,
};

export const FROST_SHOCK_DAMAGE = midpoint(278, 294);

export const FROST_SHOCK: Ability = {
  id: 'frost_shock',
  name: 'Frost Shock',
  cost: { resource: 'mana', amount: 430 },
  cooldownMs: seconds(6),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'frost',
      baseAmount: FROST_SHOCK_DAMAGE,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: `${NO_SPELL_COEFFICIENT} Its slow does nothing; nothing here moves.`,
};

/**
 * Lava Burst, granted by the 31-point Elemental talent.
 *
 * THE TALENT TOOLTIP SAYS 106 TO 134 AND THE SPELLBOOK SAYS 192 TO 248, and
 * they do not disagree: the talent shows RANK 1 and a level 60 trains rank 3.
 * The project rule, and the fourth time it has come up.
 *
 * The Flame Shock clause is read off the target at cast time, which makes the
 * priority list's order load-bearing -- Flame Shock sits above it for exactly
 * this reason.
 */
export const LAVA_BURST_DAMAGE = midpoint(192, 248);
export const LAVA_BURST_FLAME_SHOCK_BONUS = 1.2;

export const LAVA_BURST: Ability = {
  id: 'lava_burst',
  name: 'Lava Burst',
  cost: { resource: 'mana', amount: 265 },
  castTimeMs: seconds(2.5),
  cooldownMs: seconds(10),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const burning = target.auras.has(FLAME_SHOCK_DOT.id);
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: LAVA_BURST_DAMAGE * (burning ? LAVA_BURST_FLAME_SHOCK_BONUS : 1),
      attackTable: ability.attackTable,
    });
  },
  unmodelled: NO_SPELL_COEFFICIENT,
};

// ---------------------------------------------------------------------------
// Enhancement
// ---------------------------------------------------------------------------

/**
 * Stormstrike, granted by the Enhancement talent.
 *
 * "Instantly strike for normal weapon damage" -- ONE STRIKE, with the main
 * hand, which is what the singular says. Classic's version hits with both
 * weapons; Forever's wording does not, and a Shaman here carries a two-hander
 * in any case, so the two readings agree for both profiles in the project.
 *
 * IT IS A MAIN-HAND USE. It goes through a melee combat table and needs the
 * weapon, so `isWeaponUse` counts it and Windfury Weapon can proc from it --
 * the ruleset owner's rule, applied rather than re-derived.
 */
export const STORMSTRIKE: Ability = {
  id: 'stormstrike',
  name: 'Stormstrike',
  cost: { resource: 'mana', amount: 125 },
  cooldownMs: seconds(8),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    // The debuff rides on a strike that CONNECTED. A dodged Stormstrike
    // buffs nothing, which is what "when you Stormstrike" has to mean.
    if (!result.avoided) simulation.applyAura(target, STORMSTRIKE_DEBUFF, caster.id);
  },
};

/**
 * Windfury Weapon, the imbue.
 *
 * Cast once, at the pull, for one global cooldown and 165 mana; it then lasts
 * an hour. It is in the priority list rather than assumed, because a global
 * cooldown spent is a global cooldown spent and the alternative is a free
 * buff.
 *
 * Casting it again while it is up would be a wasted cast, so `canCast` refuses
 * -- which is what keeps a priority list from sitting on it forever.
 */
export const WINDFURY_WEAPON: Ability = {
  id: 'windfury_weapon',
  name: 'Windfury Weapon',
  cost: { resource: 'mana', amount: 165 },
  canCast: ({ caster }) => !caster.auras.has(WINDFURY_WEAPON_IMBUE.id),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, WINDFURY_WEAPON_IMBUE, caster.id);
  },
  unmodelled:
    'It disables any benefit the caster personally receives from Windfury ' +
    'Totem. Selecting both is the raid buff plus the imbue, which overstates ' +
    'a Shaman who has imbued the main hand.',
};

/**
 * Rage of the Farseer, granted by the 31-point Enhancement talent.
 *
 * Off the global cooldown is NOT claimed: the spellbook says "Instant" and
 * says nothing about the global cooldown, so it takes one like every other
 * instant here.
 */
export const RAGE_OF_THE_FARSEER_ABILITY: Ability = {
  id: 'rage_of_the_farseer',
  name: 'Rage of the Farseer',
  cooldownMs: seconds(180),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, RAGE_OF_THE_FARSEER, caster.id);
  },
};

export const SHAMAN_ABILITIES: readonly Ability[] = [
  LIGHTNING_BOLT,
  CHAIN_LIGHTNING,
  EARTH_SHOCK,
  FLAME_SHOCK,
  FROST_SHOCK,
  LAVA_BURST,
  STORMSTRIKE,
  WINDFURY_WEAPON,
  RAGE_OF_THE_FARSEER_ABILITY,
];
