import type { Ability, SimulationContext } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  BATTLE_SHOUT,
  BATTLE_STANCE,
  BERSERKER_RAGE,
  BERSERKER_STANCE,
  BLOODRAGE,
  DEFENSIVE_STANCE,
  DEMORALIZING_SHOUT,
  OVERPOWER_READY,
  PLACEHOLDER_BLOODRAGE_INSTANT_RAGE,
  RECKLESSNESS,
  REND,
  REVENGE_READY,
  SHIELD_BLOCK,
  SHIELD_WALL,
  SUNDER_ARMOR,
  WARRIOR_STANCES,
} from '../auras/warrior';

/**
 * Warrior abilities, from WoWForeverWarriorAbilities.xlsx.
 *
 * `docs/warrior-abilities.md` holds that spreadsheet transcribed verbatim
 * alongside everything it does not say. Read it before changing a number here.
 *
 * Every cost, cooldown, cast time, attack table and damage figure below is
 * taken from that sheet. Where a value is NOT in the sheet it is named
 * `PLACEHOLDER_*` and says so; those live in `game/auras/warrior.ts`.
 *
 * Damage scaling comes in three shapes, and the sheet distinguishes them:
 *
 *   - `weaponScaling`                 "Weapon Damage" — a swing, plus the
 *                                     ability's own flat damage
 *   - `weaponScaling` with a fraction "40% Weapon Damage" (Spearing Strike)
 *   - `powerCoefficient`              a stated number (Bloodthirst, 0.35)
 *   - neither                         a stated "0" — flat damage only, which is
 *                                     most of the utility strikes
 *
 * A "0" in the coefficient column means genuinely no scaling, not "unknown".
 * Revenge, Thunder Clap, Hamstring, Intercept and Shield Slam are all flat.
 */

/**
 * Which hand an ability swings with.
 *
 * Every warrior weapon-damage ability uses the main hand. The slot is named
 * rather than assumed because the ruleset's off-hand penalty is applied from
 * the weapon in the slot, and an ability pointed at the wrong hand would be
 * silently wrong rather than broken.
 */
const MAIN_HAND = 'mainHand' as const;

/** Physical damage, which is all a warrior deals. */
const PHYSICAL = 'physical' as const;

// ---------------------------------------------------------------------------
// Weapon damage strikes
// ---------------------------------------------------------------------------

/**
 * "160" base damage plus full Weapon Damage, 30 rage, 6 second cooldown.
 *
 * The flat 160 is added on top of the weapon's contribution and the off-hand
 * penalty applies to the finished total — which is why the engine takes
 * `weaponScaling` as a declaration rather than the ability computing it.
 */
export const MORTAL_STRIKE: Ability = {
  id: 'mortal_strike',
  name: 'Mortal Strike',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 30 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 160,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * "30" base damage plus a stated 0.35 attack power coefficient, 30 rage, 6
 * second cooldown.
 *
 * NOT a weapon damage ability. The sheet gives it a number in the coefficient
 * column where the weapon-damage abilities say "Weapon Damage", so Bloodthirst
 * scales with attack power alone and ignores the weapon entirely.
 */
export const BLOODTHIRST: Ability = {
  id: 'bloodthirst',
  name: 'Bloodthirst',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 30 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 30,
      powerCoefficient: 0.35,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * Weapon damage with a 1.5 second cast time, 15 rage, no cooldown.
 *
 * The sheet gives no base damage, so Slam is pure weapon damage.
 *
 * UNSTATED: whether the cast pauses the swing timer, as it does in Classic.
 * It currently does not, which makes Slam slightly better than it should be if
 * Forever kept that behaviour.
 */
export const SLAM: Ability = {
  id: 'slam',
  name: 'Slam',
  castTimeMs: seconds(1.5),
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
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
  },
};

/** How many targets Whirlwind hits, per "can hit up to 4 targets". */
export const WHIRLWIND_MAX_TARGETS = 4;

/**
 * Weapon damage to up to four targets, 25 rage, 10 second cooldown.
 *
 * No base damage in the sheet, so each hit is pure weapon damage. Against the
 * single training dummy this is one hit; the loop is here so it stays correct
 * when an encounter has adds.
 */
export const WHIRLWIND: Ability = {
  id: 'whirlwind',
  name: 'Whirlwind',
  cooldownMs: seconds(10),
  cost: { resource: 'rage', amount: 25 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, ability }) => {
    const targets = simulation.enemiesOf(caster).slice(0, WHIRLWIND_MAX_TARGETS);
    for (const target of targets) {
      dealDamage(simulation, {
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
    }
  },
};

/** The fraction of weapon damage Spearing Strike deals, per the sheet. */
export const SPEARING_STRIKE_WEAPON_FRACTION = 0.4;

/**
 * "40% Weapon Damage", 15 rage, 20 second cooldown. No base damage.
 *
 * A Forever original with no Classic counterpart, so there is nothing to check
 * it against beyond the sheet.
 */
export const SPEARING_STRIKE: Ability = {
  id: 'spearing_strike',
  name: 'Spearing Strike',
  cooldownMs: seconds(20),
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: { slot: MAIN_HAND, fraction: SPEARING_STRIKE_WEAPON_FRACTION },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * "35" base damage plus Weapon Damage, 5 rage, 5 second cooldown.
 *
 * Requires that the target recently dodged. The spreadsheet states no trigger
 * at all; the ruleset owner CONFIRMED the Classic behaviour explicitly. The
 * window length is still a placeholder — see `OVERPOWER_READY`.
 */
export const OVERPOWER: Ability = {
  id: 'overpower',
  name: 'Overpower',
  cooldownMs: seconds(5),
  cost: { resource: 'rage', amount: 5 },
  attackTable: 'melee-special',
  canCast: ({ caster, simulation }) =>
    caster.auras.remainingMs(OVERPOWER_READY.id, simulation.clock.now()) > 0,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 35,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    caster.auras.remove(simulation, OVERPOWER_READY.id);
  },
};

// ---------------------------------------------------------------------------
// Flat damage strikes — the sheet states a coefficient of 0 for all of these
// ---------------------------------------------------------------------------

/**
 * Damage stated as a range in the sheet.
 *
 * Revenge is "81 to 99" and Shield Slam "421 to 439". Both are a flat plus or
 * minus 9 around their midpoint rather than a percentage band, which is why
 * these are kept as explicit bounds and rolled uniformly rather than converted
 * into the `damageVariance` fraction weapons use.
 */
export interface DamageRange {
  readonly min: number;
  readonly max: number;
}

export const REVENGE_DAMAGE: DamageRange = { min: 81, max: 99 };
export const SHIELD_SLAM_DAMAGE: DamageRange = { min: 421, max: 439 };

/** A uniform roll inside a stated damage range. */
function rollRange(simulation: SimulationContext, range: DamageRange): number {
  return simulation.rng.nextFloat(range.min, range.max);
}

/**
 * "81 to 99" flat, 5 rage, 5 second cooldown, no scaling of any kind.
 *
 * Requires that the warrior recently blocked, parried or dodged — CONFIRMED by
 * the ruleset owner, not stated in the sheet. Nothing attacks the player yet,
 * so `REVENGE_READY` never gets applied and Revenge is currently uncastable.
 * That is the honest state, not a bug to work around.
 */
export const REVENGE: Ability = {
  id: 'revenge',
  name: 'Revenge',
  cooldownMs: seconds(5),
  cost: { resource: 'rage', amount: 5 },
  attackTable: 'melee-special',
  canCast: ({ caster, simulation }) =>
    caster.auras.remainingMs(REVENGE_READY.id, simulation.clock.now()) > 0,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: rollRange(simulation, REVENGE_DAMAGE),
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    caster.auras.remove(simulation, REVENGE_READY.id);
  },
};

/**
 * "421 to 439 + shield block value" flat, 20 rage, 6 second cooldown.
 *
 * THE SHIELD BLOCK VALUE IS MISSING. No such stat exists in the engine and no
 * gear grants one, so Shield Slam currently deals only its stated range. Its
 * damage is therefore too low by whatever a shield would have contributed.
 *
 * Gated on carrying a shield rather than on a stance, which is how Classic
 * expresses it; the sheet says nothing either way.
 */
export const SHIELD_SLAM: Ability = {
  id: 'shield_slam',
  name: 'Shield Slam',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 20 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      // MISSING: + shield block value.
      baseAmount: rollRange(simulation, SHIELD_SLAM_DAMAGE),
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * "45" flat, 10 rage, no cooldown, no scaling.
 *
 * Its slow is not modelled: a training dummy does not move, and the sheet
 * gives neither a slow percentage nor a duration.
 */
export const HAMSTRING: Ability = {
  id: 'hamstring',
  name: 'Hamstring',
  cost: { resource: 'rage', amount: 10 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 45,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * "103" flat, 20 rage, 4 second cooldown, no scaling.
 *
 * Listed as a RANGED Special Attack, and implemented literally as the ruleset
 * owner confirmed. A warrior has no ranged weapon in any of its three styles,
 * so `weaponSkill('ranged')` falls back to five times its level.
 */
export const THUNDER_CLAP: Ability = {
  id: 'thunder_clap',
  name: 'Thunder Clap',
  cooldownMs: seconds(4),
  cost: { resource: 'rage', amount: 20 },
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 103,
      attackTable: ability.attackTable,
      weaponSlot: 'ranged',
    });
  },
};

/**
 * "65" flat, 10 rage, 30 second cooldown, ranged table.
 *
 * Its charge and stun are not modelled; the sheet states neither.
 */
export const INTERCEPT: Ability = {
  id: 'intercept',
  name: 'Intercept',
  cooldownMs: seconds(30),
  cost: { resource: 'rage', amount: 10 },
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 65,
      attackTable: ability.attackTable,
      weaponSlot: 'ranged',
    });
  },
};

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

/** Execute's flat damage before any rage is added. */
export const EXECUTE_BASE_DAMAGE = 600;
/** Damage per point of rage left after the 15 rage cost was paid. */
export const EXECUTE_DAMAGE_PER_RAGE = 15;
/** The rage Execute costs before it consumes the rest. */
export const EXECUTE_BASE_COST = 15;

/**
 * The health fraction below which Execute may be used.
 *
 * CONFIRMED by the ruleset owner as Classic's 20%. The spreadsheet states no
 * threshold, so without that confirmation Execute would have been usable at
 * full health and worth an absurd amount of DPS.
 */
export const EXECUTE_HEALTH_THRESHOLD = 0.2;

/**
 * "600 + 15 * each point of remaining rage after cost was taken out", costing
 * "15 + all remaining rage".
 *
 * The variable cost cannot be expressed as an `AbilityCost`, which is a fixed
 * amount, so the ability declares the 15 and drains the remainder itself in
 * `onCast`. That is the one place in this file where an ability reaches for a
 * resource directly, and it is why: the engine's cost model has no "and then
 * everything else" case.
 */
export const EXECUTE: Ability = {
  id: 'execute',
  name: 'Execute',
  cost: { resource: 'rage', amount: EXECUTE_BASE_COST },
  attackTable: 'melee-special',
  canCast: ({ target }) =>
    target !== undefined && target.health.fraction <= EXECUTE_HEALTH_THRESHOLD,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    // The engine has already taken the 15. Everything still in the bar is
    // consumed and converted into damage.
    const rage = caster.resources.get('rage');
    const remaining = rage?.current ?? 0;
    rage?.drain(remaining);

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: EXECUTE_BASE_DAMAGE + EXECUTE_DAMAGE_PER_RAGE * remaining,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

// ---------------------------------------------------------------------------
// On-next-swing abilities
// ---------------------------------------------------------------------------

/**
 * "157" base damage plus Weapon Damage, 15 rage, no cooldown, and explicitly
 * "on-next Main Hand swing".
 *
 * Queued rather than cast: it replaces the next main-hand auto-attack instead
 * of landing immediately. See `Combatant.queueNextSwing`.
 *
 * UNSTATED: whether it is off the global cooldown, as it is in Classic. It
 * currently triggers the GCD, which costs a warrior real throughput if Forever
 * kept the Classic behaviour.
 */
export const HEROIC_STRIKE: Ability = {
  id: 'heroic_strike',
  name: 'Heroic Strike',
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onNextSwing: MAIN_HAND,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 157,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/** How many targets Cleave hits, per "hits a second target if possible". */
export const CLEAVE_MAX_TARGETS = 2;

/**
 * "50" base damage plus Weapon Damage, 20 rage, no cooldown, on the next swing
 * and hitting a second target if one exists.
 *
 * Same unstated GCD question as Heroic Strike.
 */
export const CLEAVE: Ability = {
  id: 'cleave',
  name: 'Cleave',
  cost: { resource: 'rage', amount: 20 },
  attackTable: 'melee-special',
  onNextSwing: MAIN_HAND,
  onCast: ({ simulation, caster, ability }) => {
    const targets = simulation.enemiesOf(caster).slice(0, CLEAVE_MAX_TARGETS);
    for (const target of targets) {
      dealDamage(simulation, {
        source: caster,
        target,
        abilityId: ability.id,
        abilityName: ability.name,
        school: PHYSICAL,
        baseAmount: 50,
        weaponScaling: { slot: MAIN_HAND },
        attackTable: ability.attackTable,
        weaponSlot: MAIN_HAND,
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Damage over time and debuffs
// ---------------------------------------------------------------------------

/** 10 rage, no cooldown. Applies the bleed; see `REND` for its numbers. */
export const REND_ABILITY: Ability = {
  id: 'rend_cast',
  name: 'Rend',
  cost: { resource: 'rage', amount: 10 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || !ability.attackTable) return;

    // Rolled once here rather than per tick: a bleed that lands applies, and
    // then ticks unconditionally for its whole duration.
    const roll = simulation.rollAttack(ability.attackTable, caster, target, {
      slot: MAIN_HAND,
    });
    if (roll.avoided) return;

    simulation.applyAura(target, REND, caster.id);
  },
};

/** 15 rage, no cooldown. Effect values are placeholders; see `SUNDER_ARMOR`. */
export const SUNDER_ARMOR_ABILITY: Ability = {
  id: 'sunder_armor_cast',
  name: 'Sunder Armor',
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || !ability.attackTable) return;
    const roll = simulation.rollAttack(ability.attackTable, caster, target, {
      slot: MAIN_HAND,
    });
    if (roll.avoided) return;
    simulation.applyAura(target, SUNDER_ARMOR, caster.id);
  },
};

/** 10 rage, no cooldown. Effect values are placeholders. */
export const DEMORALIZING_SHOUT_ABILITY: Ability = {
  id: 'demoralizing_shout_cast',
  name: 'Demoralizing Shout',
  cost: { resource: 'rage', amount: 10 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, DEMORALIZING_SHOUT, caster.id);
  },
};

// ---------------------------------------------------------------------------
// Self buffs
// ---------------------------------------------------------------------------

/** 10 rage, no cooldown. The attack power figure is a placeholder. */
export const BATTLE_SHOUT_ABILITY: Ability = {
  id: 'battle_shout_cast',
  name: 'Battle Shout',
  cost: { resource: 'rage', amount: 10 },
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BATTLE_SHOUT, caster.id);
  },
};

/** Free, 30 minute cooldown. Effect and duration are placeholders. */
export const RECKLESSNESS_ABILITY: Ability = {
  id: 'recklessness_cast',
  name: 'Recklessness',
  cooldownMs: seconds(1800),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, RECKLESSNESS, caster.id);
  },
};

/** Free, 30 second cooldown. Effect and duration are placeholders. */
export const BERSERKER_RAGE_ABILITY: Ability = {
  id: 'berserker_rage_cast',
  name: 'Berserker Rage',
  cooldownMs: seconds(30),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BERSERKER_RAGE, caster.id);
  },
};

/**
 * Free, 60 second cooldown.
 *
 * The rage it grants is a placeholder set to zero, so casting it currently
 * costs a global cooldown and achieves nothing. That is deliberate: an invented
 * rage figure would change the rotation's whole shape.
 */
export const BLOODRAGE_ABILITY: Ability = {
  id: 'bloodrage_cast',
  name: 'Bloodrage',
  cooldownMs: seconds(60),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BLOODRAGE, caster.id);
    if (PLACEHOLDER_BLOODRAGE_INSTANT_RAGE > 0) {
      simulation.grantResource(caster, 'rage', PLACEHOLDER_BLOODRAGE_INSTANT_RAGE);
    }
  },
};

/** Free, 30 minute cooldown. Effect and duration are placeholders. */
export const SHIELD_WALL_ABILITY: Ability = {
  id: 'shield_wall_cast',
  name: 'Shield Wall',
  cooldownMs: seconds(1800),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, SHIELD_WALL, caster.id);
  },
};

/** 10 rage, 5 second cooldown. Effect and duration are placeholders. */
export const SHIELD_BLOCK_ABILITY: Ability = {
  id: 'shield_block_cast',
  name: 'Shield Block',
  cost: { resource: 'rage', amount: 10 },
  cooldownMs: seconds(5),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, SHIELD_BLOCK, caster.id);
  },
};

// ---------------------------------------------------------------------------
// Charge and stances
// ---------------------------------------------------------------------------

/** The rage Charge generates, per the sheet's "Generates 15". */
export const CHARGE_RAGE_GENERATED = 15;

/**
 * Free, 15 second cooldown, and it GENERATES 15 rage rather than costing any.
 *
 * `AbilityCost` has no negative case, so the grant happens in `onCast`.
 *
 * Charge's real constraints — a minimum range, and being out of combat in most
 * rulesets — are not modelled, because the sheet states neither. Against a
 * training dummy that makes it a free 15 rage every 15 seconds, which is very
 * probably too generous. It is left out of the rotation for that reason.
 */
export const CHARGE: Ability = {
  id: 'charge',
  name: 'Charge',
  cooldownMs: seconds(15),
  attackTable: 'ranged-special',
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.grantResource(caster, 'rage', CHARGE_RAGE_GENERATED);
  },
};

/** Swap to a stance, clearing whichever one is currently up. */
function stanceAbility(id: string, aura: (typeof WARRIOR_STANCES)[number]): Ability {
  return {
    id,
    name: aura.name,
    cooldownMs: seconds(1),
    requiresTarget: false,
    // A stance swap is not a global cooldown in any ruleset that has stances.
    // UNSTATED in the sheet; this is an assumption.
    triggersGcd: false,
    onCast: ({ simulation, caster }) => {
      for (const stance of WARRIOR_STANCES) {
        if (stance.id !== aura.id) caster.auras.remove(simulation, stance.id);
      }
      simulation.applyAura(caster, aura, caster.id);
    },
  };
}

/**
 * NOT IN THE SPREADSHEET.
 *
 * The sheet has Berserker Stance and Defensive Stance and no Battle Stance
 * row. A warrior with no way back to a neutral stance is not a coherent
 * ruleset, so this is defined with the same cost and cooldown as the other two
 * — an assumption, flagged here and in the docs.
 */
export const BATTLE_STANCE_ABILITY = stanceAbility('battle_stance_cast', BATTLE_STANCE);
export const DEFENSIVE_STANCE_ABILITY = stanceAbility(
  'defensive_stance_cast',
  DEFENSIVE_STANCE,
);
export const BERSERKER_STANCE_ABILITY = stanceAbility(
  'berserker_stance_cast',
  BERSERKER_STANCE,
);

// ---------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------

/**
 * Every warrior ability in the spreadsheet.
 *
 * Which of them a given combat style can actually use is a separate question
 * from which exist, and stance gating is still an open question with the
 * ruleset owner, so no filtering happens here yet.
 */
export const WARRIOR_ABILITIES: readonly Ability[] = [
  MORTAL_STRIKE,
  BLOODTHIRST,
  SLAM,
  WHIRLWIND,
  SPEARING_STRIKE,
  OVERPOWER,
  REVENGE,
  SHIELD_SLAM,
  HAMSTRING,
  THUNDER_CLAP,
  INTERCEPT,
  EXECUTE,
  HEROIC_STRIKE,
  CLEAVE,
  REND_ABILITY,
  SUNDER_ARMOR_ABILITY,
  DEMORALIZING_SHOUT_ABILITY,
  BATTLE_SHOUT_ABILITY,
  RECKLESSNESS_ABILITY,
  BERSERKER_RAGE_ABILITY,
  BLOODRAGE_ABILITY,
  SHIELD_WALL_ABILITY,
  SHIELD_BLOCK_ABILITY,
  CHARGE,
  BATTLE_STANCE_ABILITY,
  DEFENSIVE_STANCE_ABILITY,
  BERSERKER_STANCE_ABILITY,
];

/** Look one up by id, for tests and for the rotation. */
export function warriorAbility(id: string): Ability | undefined {
  return WARRIOR_ABILITIES.find((ability) => ability.id === id);
}
