import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  BANE_OF_AGONY,
  BANE_OF_AGONY_UNMODELLED,
  CORRUPTION,
  CORRUPTION_CAST_MS,
  IMMOLATE,
  IMMOLATE_CAST_MS,
  IMMOLATE_COEFFICIENTS,
  IMMOLATE_DIRECT,
  SIPHON_LIFE,
} from '../auras/warlock';
import { directSpellCoefficient } from '../combat/spellCoefficient';

/**
 * Warlock abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE NINTH AND LAST CLASS. No pet: both of the ruleset owner's profiles take
 * Demonic Sacrifice, which kills the demon and keeps a two-hour buff, so
 * neither has one active. The demon they sacrifice is read from the same
 * profile field the Hunter's pet family uses.
 *
 * EVERY SPELL SCALES, AND THIS CLASS GAINED THE MOST OF ANY. SM/DS went
 * 135.3 -> 331.7 and the Firelock 247.5 -> 479.1, because almost all of a
 * Warlock's damage is PERIODIC and a DoT's coefficient is its duration over
 * 15 -- uncapped, so Bane of Agony's 24 seconds is worth 1.6 and Siphon Life's
 * 30 is worth 2.0, the two largest in the project.
 *
 * The spell text is unchanged and still states flat damage with no
 * coefficient; the coefficient is the owner's universal RULE. See
 * `game/combat/spellCoefficient.ts`. Immolate is the one hybrid here and its
 * pair lives in `auras/warlock.ts`.
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
export const SHADOW_BOLT_CAST_MS = seconds(3);
export const SHADOW_BOLT_COEFFICIENT = directSpellCoefficient(SHADOW_BOLT_CAST_MS);

export const SHADOW_BOLT: Ability = {
  id: 'shadow_bolt',
  name: 'Shadow Bolt',
  cost: { resource: 'mana', amount: 380 },
  castTimeMs: SHADOW_BOLT_CAST_MS,
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
      powerCoefficient: SHADOW_BOLT_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

export const CORRUPTION_ABILITY: Ability = {
  id: 'corruption',
  name: 'Corruption',
  cost: { resource: 'mana', amount: 340 },
  castTimeMs: CORRUPTION_CAST_MS,
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    /*
     * A PURE DoT: the cast itself deals nothing, so the whole coefficient is
     * on the aura's ticks and there is no direct half to weight against.
     * NOTHING IS PASSED HERE -- the scaling lives with the damage.
     */
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
 *
 * ----------------------------------------------------------------------------
 * 840 AND NOT 424, ON THE RULESET OWNER'S RULING, AND THE TWO SOURCES DISAGREE
 * AT THE SAME CLIENT BUILD.
 *
 * `talentsforever.com/spelldesc.js` says 424 at rank 6 and
 * `foreverchanges.pro/spellbook/warlock` says 840, both read at build
 * 1.60.1.70009 -- so this is not our capture being stale, and refreshing it
 * does not settle it. The owner's ruling is 840, and the standing rule that
 * came with it is that **foreverchanges.pro wins a disagreement**. See
 * `docs/source-cross-checks.md`.
 *
 * IT IS WORTH 13.5% TO FIRELOCK AND NOTHING TO SM/DS. Destruction is mana-bound
 * and Affliction is not, so the same number moves one Warlock profile a long way
 * and leaves the other inside noise. The checked-in capture still says 424,
 * because it is scraped data and is never hand-edited; this constant deliberately
 * disagrees with it and says why.
 * ----------------------------------------------------------------------------
 */
export const LIFE_TAP_AMOUNT = 840;

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
  castTimeMs: IMMOLATE_CAST_MS,
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
      powerCoefficient: IMMOLATE_COEFFICIENTS.direct,
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
export const INCINERATE_CAST_MS = seconds(2.5);
export const INCINERATE_COEFFICIENT = directSpellCoefficient(INCINERATE_CAST_MS);

export const INCINERATE: Ability = {
  id: 'incinerate',
  name: 'Incinerate',
  cost: { resource: 'mana', amount: 325 },
  castTimeMs: INCINERATE_CAST_MS,
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
      powerCoefficient: INCINERATE_COEFFICIENT,
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
export const CONFLAGRATE_COEFFICIENT = directSpellCoefficient(0);

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
      powerCoefficient: CONFLAGRATE_COEFFICIENT,
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
 *
 * ----------------------------------------------------------------------------
 * IT COSTS BOTH A SHARD AND 365 MANA, AND THAT IS THE ONE PLACE THE OWNER'S
 * "PREFER foreverchanges.pro" RULE IS NOT APPLIED LITERALLY.
 *
 * The two sources do not contradict each other here; each carries the half its
 * own data model holds. `talentsforever` lists `Reagents: Soul Shard` and no
 * mana line. `foreverchanges.pro` lists `365 Mana` and **carries no reagent
 * field at all, for any spell in the payload** -- so its silence on the shard is
 * structural rather than a statement that there is none. Classic charges both.
 *
 * Taking the rule literally would DELETE a cost that one source states and the
 * other cannot express, which is the opposite of what a tie-break is for. Both
 * are charged, and this comment is the flag: one line reverts it if the owner
 * means mana alone.
 *
 * `cost` is singular, so the shard stays the declared cost -- a rotation's
 * affordability check is the reason it exists, and shards are the scarce pool --
 * and the mana is taken in `onCast`, the same shape Execute uses for the rage it
 * drains beyond its declared 15.
 * ----------------------------------------------------------------------------
 */
export const SHADOWBURN_MANA = 365;
// 251 to 281 from foreverchanges.pro, which the owner's ruling prefers over
// talentsforever's 258 to 288. Same rank 6, same level 56, same build.
export const SHADOWBURN_DAMAGE = midpoint(251, 281);
export const SHADOWBURN_REFUNDS_SHARD = 'refundsShard';
export const SHADOWBURN_COEFFICIENT = directSpellCoefficient(0);

export const SHADOWBURN: Ability = {
  id: 'shadowburn',
  name: 'Shadowburn',
  cost: { resource: 'soulShards', amount: 1 },
  cooldownMs: seconds(15),
  attackTable: 'spell',
  // The mana half of the cost, so a caster that cannot afford it does not cast
  // it -- `checkCast` only knows about the declared shard.
  canCast: ({ caster }) => (caster.resources.get('mana')?.current ?? 0) >= SHADOWBURN_MANA,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    // The engine has taken the shard; the mana is the half no single `cost` can
    // carry. See the note above on why both are charged.
    caster.resources.get('mana')?.spend(SHADOWBURN_MANA);

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: SHADOWBURN_DAMAGE,
      powerCoefficient: SHADOWBURN_COEFFICIENT,
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

// 105 to 123 from foreverchanges.pro, over talentsforever's 107 to 125, by the
// same ruling. Same rank 6, same level 58, same build.
export const SEARING_PAIN_DAMAGE = midpoint(105, 123);
export const SEARING_PAIN_CAST_MS = seconds(1.5);
export const SEARING_PAIN_COEFFICIENT = directSpellCoefficient(SEARING_PAIN_CAST_MS);

export const SEARING_PAIN: Ability = {
  id: 'searing_pain',
  name: 'Searing Pain',
  cost: { resource: 'mana', amount: 168 },
  castTimeMs: SEARING_PAIN_CAST_MS,
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
      powerCoefficient: SEARING_PAIN_COEFFICIENT,
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
