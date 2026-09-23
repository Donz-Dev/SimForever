import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  BANE_OF_AGONY,
  BANE_OF_AGONY_UNMODELLED,
  CORRUPTION,
  IMMOLATE,
  IMMOLATE_DIRECT,
  SIPHON_LIFE,
} from '../auras/warlock';

/**
 * Warlock abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE NINTH AND LAST CLASS. No pet: both of the ruleset owner's profiles take
 * Demonic Sacrifice, which kills the demon and keeps a two-hour buff, so
 * neither has one active. The demon they sacrifice is read from the same
 * profile field the Hunter's pet family uses.
 *
 * NO SPELL POWER COEFFICIENTS, for the fourth caster running. Druid, Shaman,
 * Mage and now Warlock all state flat damage and none. The Paladin's seals are
 * still the only thing in the project that scales with spell power, because
 * the ruleset owner supplied that formula directly.
 *
 * SOUL SHARDS ARE A RESOURCE WITH NO INCOME HERE. Shadowburn and Soul Fire
 * cost one, and the only way to earn one is Drain Soul killing something --
 * which never happens against a target that survives every fight. So a
 * Warlock starts with a banked pool and spends it, which is what a Warlock
 * walking into a raid actually does.
 * ----------------------------------------------------------------------------
 */

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

// ---------------------------------------------------------------------------
// Affliction
// ---------------------------------------------------------------------------

export const SHADOW_BOLT_DAMAGE = midpoint(253, 283);

export const SHADOW_BOLT: Ability = {
  id: 'shadow_bolt',
  name: 'Shadow Bolt',
  cost: { resource: 'mana', amount: 380 },
  castTimeMs: seconds(3),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: SHADOW_BOLT_DAMAGE,
      attackTable: ability.attackTable,
    });
  },
};

export const CORRUPTION_ABILITY: Ability = {
  id: 'corruption',
  name: 'Corruption',
  cost: { resource: 'mana', amount: 340 },
  castTimeMs: seconds(2),
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, CORRUPTION, caster.id);
  },
};

export const BANE_OF_AGONY_ABILITY: Ability = {
  id: 'bane_of_agony',
  name: 'Bane of Agony',
  cost: { resource: 'mana', amount: 215 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, BANE_OF_AGONY, caster.id);
  },
  unmodelled: BANE_OF_AGONY_UNMODELLED,
};

/** Siphon Life, granted by the Affliction talent. */
export const SIPHON_LIFE_ABILITY: Ability = {
  id: 'siphon_life',
  name: 'Siphon Life',
  cost: { resource: 'mana', amount: 365 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, SIPHON_LIFE, caster.id);
  },
  unmodelled:
    'Its damage applies and the health it transfers back does not: no Warlock ' +
    'profile is attacked, so the heal would land on a character at full.',
};

/**
 * Life Tap: "Converts 424 health into 424 Mana."
 *
 * THE ONE ABILITY IN THE PROJECT THAT SPENDS HEALTH. It is what keeps an
 * Affliction warlock casting, and it is genuinely free here for the same
 * reason Siphon Life's heal is wasted -- nothing is attacking, so the health
 * has no other use.
 *
 * ITS SPIRIT CLAUSE IS NOT MODELLED. "Mana gained is increased by your Spirit"
 * states no rate, so the flat conversion is used and the ability says so.
 */
export const LIFE_TAP_AMOUNT = 424;

export const LIFE_TAP: Ability = {
  id: 'life_tap',
  name: 'Life Tap',
  requiresTarget: false,
  // Only when there is health to spend AND mana worth gaining.
  canCast: ({ caster }) =>
    caster.health.current > LIFE_TAP_AMOUNT &&
    (caster.resources.get('mana')?.current ?? 0) <
      (caster.resources.get('mana')?.maximum ?? 0) - LIFE_TAP_AMOUNT,
  onCast: ({ simulation, caster }) => {
    caster.health.spend(LIFE_TAP_AMOUNT);
    simulation.grantResource(caster, 'mana', LIFE_TAP_AMOUNT, {
      id: 'life_tap',
      name: 'Life Tap',
    });
  },
  unmodelled:
    'Its "Mana gained is increased by your Spirit" clause states no rate, so ' +
    'the flat conversion is used and this understates.',
};

// ---------------------------------------------------------------------------
// Destruction
// ---------------------------------------------------------------------------

export const IMMOLATE_ABILITY: Ability = {
  id: 'immolate',
  name: 'Immolate',
  cost: { resource: 'mana', amount: 380 },
  castTimeMs: seconds(2),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    // One roll decides both halves, as every direct-plus-burn spell here does.
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: IMMOLATE_DIRECT,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, IMMOLATE, caster.id);
  },
};

/**
 * Incinerate, granted by the Destruction capstone: "201 to 233 Fire damage and
 * an additional 25% damage if the target is afflicted by Immolate."
 *
 * ITS CONDITION IS READ AT CAST TIME, which makes the priority list's order
 * load-bearing -- Immolate sits above it for exactly that reason.
 */
export const INCINERATE_DAMAGE = midpoint(201, 233);
export const INCINERATE_IMMOLATE_BONUS = 1.25;

export const INCINERATE: Ability = {
  id: 'incinerate',
  name: 'Incinerate',
  cost: { resource: 'mana', amount: 325 },
  castTimeMs: seconds(2.5),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const burning = target.auras.has('immolate');
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: INCINERATE_DAMAGE * (burning ? INCINERATE_IMMOLATE_BONUS : 1),
      attackTable: ability.attackTable,
    });
  },
};

/**
 * Conflagrate, granted by the Destruction talent.
 *
 * "Ignites a target that is ALREADY AFFLICTED BY YOUR IMMOLATE, dealing 251 to
 * 313 Fire damage and CONSUMING your Immolate effect."
 *
 * BOTH CLAUSES MATTER AND SHADOW AND FLAME UNDOES THE SECOND. At 5/5 that
 * talent gives "a 100% chance NOT to consume Immolate", which is why the
 * Firelock list casts this on cooldown rather than weighing it against the
 * burn it would otherwise eat. The consumption is gated on the talent's flag
 * rather than assumed either way.
 */
export const CONFLAGRATE_DAMAGE = midpoint(251, 313);
export const CONFLAGRATE_KEEPS_IMMOLATE = 'keepsImmolate';

export const CONFLAGRATE: Ability = {
  id: 'conflagrate',
  name: 'Conflagrate',
  cost: { resource: 'mana', amount: 255 },
  cooldownMs: seconds(10),
  attackTable: 'spell',
  canCast: ({ caster, target }) => target?.auras.has('immolate') === true && caster.isAlive,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: CONFLAGRATE_DAMAGE,
      attackTable: ability.attackTable,
    });

    // Shadow and Flame at full rank keeps it; without the talent it burns.
    const keeps = (ability.bonuses?.[CONFLAGRATE_KEEPS_IMMOLATE] ?? 0) > 0;
    if (!keeps) target.auras.remove(simulation, 'immolate');
  },
};

/**
 * Shadowburn, granted by the Destruction talent.
 *
 * A SOUL SHARD, AND SHADOW AND FLAME REFUNDS IT. "Shadowburn has a 100% chance
 * to instantly refund a Soul Shard" at 5/5, which is the only reason a build
 * with no shard income can cast it more than once.
 */
export const SHADOWBURN_DAMAGE = midpoint(258, 288);
export const SHADOWBURN_REFUNDS_SHARD = 'refundsShard';

export const SHADOWBURN: Ability = {
  id: 'shadowburn',
  name: 'Shadowburn',
  cost: { resource: 'soulShards', amount: 1 },
  cooldownMs: seconds(15),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: SHADOWBURN_DAMAGE,
      attackTable: ability.attackTable,
    });

    if ((ability.bonuses?.[SHADOWBURN_REFUNDS_SHARD] ?? 0) > 0) {
      simulation.grantResource(caster, 'soulShards', 1, {
        id: 'shadow_and_flame',
        name: 'Shadow and Flame',
      });
    }
  },
};

export const SEARING_PAIN_DAMAGE = midpoint(107, 125);

export const SEARING_PAIN: Ability = {
  id: 'searing_pain',
  name: 'Searing Pain',
  cost: { resource: 'mana', amount: 168 },
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
      baseAmount: SEARING_PAIN_DAMAGE,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: 'Its "high amount of threat" does nothing; the engine does not track threat.',
};

export const WARLOCK_ABILITIES: readonly Ability[] = [
  SHADOW_BOLT,
  CORRUPTION_ABILITY,
  BANE_OF_AGONY_ABILITY,
  SIPHON_LIFE_ABILITY,
  LIFE_TAP,
  IMMOLATE_ABILITY,
  INCINERATE,
  CONFLAGRATE,
  SHADOWBURN,
  SEARING_PAIN,
];
