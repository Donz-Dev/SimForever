import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  ADRENALINE_RUSH,
  ADRENALINE_RUSH_UNMODELLED,
  BLADE_FLURRY,
  BLADE_FLURRY_UNMODELLED,
  COLD_BLOOD,
  COLD_BLOOD_ABILITIES,
  GHOSTLY_STRIKE_DODGE_AURA,
  HEMORRHAGE_DEBUFF,
  HEMORRHAGE_UNMODELLED,
  RUPTURE_UNMODELLED,
  exposeArmorAura,
  ruptureAura,
  sliceAndDiceAura,
} from '../auras/rogue';
import { awardComboPoint, hasComboPoints, spendComboPoints } from '../combat/comboPoints';

/**
 * Rogue abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * `src/data/abilities/forever-rogue-spellbook.json` holds the capture, written
 * by `tools/import_forever_spells.mjs` at MAX RANK -- the rank a level 60
 * trains. Read `docs/class-implementation.md` before changing a number here.
 *
 * ----------------------------------------------------------------------------
 * THE SHAPE OF THE CLASS, and what is genuinely new against the Warrior.
 *
 * BUILDERS AND FINISHERS. A builder awards a combo point when it LANDS and a
 * finisher spends every point there is, scaling by how many. See
 * `game/combat/comboPoints.ts` for why that is a helper rather than five
 * copies of read-drain-scale.
 *
 * ENERGY, NOT RAGE. It arrives as a fixed batch on a timer rather than being
 * earned, so a Rogue is never rage-starved after a bad run of misses -- but
 * also never rewarded for a good one. The whole rotation is a queue against a
 * clock.
 *
 * WHAT IS NOT HERE AND WHY:
 *
 *   - POISONS. Weapon-bound procs, which the engine can already express --
 *     see docs/extra-attacks.md -- but they need the poison ITEMS and an
 *     application mechanic, and neither is captured yet.
 *   - STEALTH OPENERS. Ambush, Garrote, Cheap Shot and Premeditation all say
 *     "Requires Stealth", and every fight here opens IN COMBAT. Charge has the
 *     same problem and the ruleset owner settled it by making it castable once
 *     at timestamp zero; the same ruling would fit here and has not been
 *     given, so they are absent rather than guessed at.
 *   - POSITIONAL REQUIREMENTS. Backstab "must be behind the target". Nothing
 *     in this simulator has a facing, so the requirement is dropped and said
 *     to be dropped rather than silently met.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const OFF_HAND = 'offHand' as const;
const PHYSICAL = 'physical' as const;

/**
 * Spend Cold Blood if it is up and this ability is one of the five it names.
 *
 * Returns nothing: the crit has already been applied by the aura's stat
 * modifier, and this only removes it. Called AFTER the damage, because
 * removing it first would take the bonus away before the roll that needed it.
 */
function consumeColdBlood(
  simulation: Parameters<NonNullable<Ability['onCast']>>[0]['simulation'],
  caster: Parameters<NonNullable<Ability['onCast']>>[0]['caster'],
  abilityId: string,
): void {
  if (!COLD_BLOOD_ABILITIES.has(abilityId)) return;
  if (caster.auras.remainingMs(COLD_BLOOD.id, simulation.clock.now()) <= 0) return;
  caster.auras.remove(simulation, COLD_BLOOD.id);
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** "68 damage in addition to your normal weapon damage. Awards 1 combo point." */
export const SINISTER_STRIKE_BASE_DAMAGE = 68;

export const SINISTER_STRIKE: Ability = {
  id: 'sinister_strike',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Sinister Strike',
  cost: { resource: 'energy', amount: 45 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: SINISTER_STRIKE_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });

    // A builder that missed builds nothing. Same rule as rage from damage
    // dealt, and for the same reason.
    if (!result.avoided) {
      awardComboPoint(simulation, caster, ability.id, ability.name);
    }
    consumeColdBlood(simulation, caster, ability.id);
  },
};

/**
 * "150% weapon damage plus 225. Must be behind the target. Requires a dagger
 * in the main hand."
 *
 * THE POSITION IS DROPPED and the DAGGER IS NOT. Nothing here has a facing, so
 * "behind the target" cannot be checked and is not pretended to be; the weapon
 * is knowable, so it is enforced.
 */
export const BACKSTAB_BASE_DAMAGE = 225;
export const BACKSTAB_WEAPON_FRACTION = 1.5;

export const BACKSTAB: Ability = {
  id: 'backstab',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Backstab',
  cost: { resource: 'energy', amount: 60 },
  attackTable: 'melee-special',
  canCast: ({ caster }) => caster.weapons.mainHand?.weaponType === 'dagger',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: BACKSTAB_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND, fraction: BACKSTAB_WEAPON_FRACTION },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    if (!result.avoided) awardComboPoint(simulation, caster, ability.id, ability.name);
    consumeColdBlood(simulation, caster, ability.id);
  },
  unmodelled:
    'Its "must be behind the target" is dropped: nothing in this simulator ' +
    'has a facing, so the requirement cannot be checked and is not pretended ' +
    'to be met. The dagger requirement IS enforced.',
};

/**
 * "Attacks with BOTH weapons for 75% weapon damage plus 38 with each. Damage
 * increased by 20% against Poisoned targets. Awards 2 Combo Points."
 *
 * TWO ATTACKS AND TWO COMBO POINTS, which makes it the only builder in the
 * class that can take a Rogue from four points to over the cap. The overflow
 * is wasted and reported, rather than refused -- see `comboPoints.ts`.
 *
 * The poison clause does nothing: poisons are not implemented.
 */
export const MUTILATE_BASE_DAMAGE = 38;
export const MUTILATE_WEAPON_FRACTION = 0.75;
export const MUTILATE_COMBO_POINTS = 2;

export const MUTILATE: Ability = {
  id: 'mutilate',
  comboPointsAwarded: MUTILATE_COMBO_POINTS,
  name: 'Mutilate',
  cost: { resource: 'energy', amount: 60 },
  attackTable: 'melee-special',
  canCast: ({ caster }) =>
    caster.weapons.mainHand?.weaponType === 'dagger' &&
    caster.weapons.offHand?.weaponType === 'dagger',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    let landed = false;
    for (const slot of [MAIN_HAND, OFF_HAND] as const) {
      if (!caster.weapons[slot]) continue;
      const result = dealDamage(simulation, {
        source: caster,
        target,
        abilityId: ability.id,
        abilityName: slot === OFF_HAND ? 'Mutilate (Off Hand)' : ability.name,
        school: PHYSICAL,
        baseAmount: MUTILATE_BASE_DAMAGE,
        weaponScaling: { slot, fraction: MUTILATE_WEAPON_FRACTION },
        attackTable: ability.attackTable,
        weaponSlot: slot,
      });
      if (!result.avoided) landed = true;
    }

    // Two points for the ability, not one per hand: the source says "Awards 2
    // Combo Points", and a half-avoided Mutilate is still a Mutilate.
    if (landed) {
      awardComboPoint(simulation, caster, ability.id, ability.name, MUTILATE_COMBO_POINTS);
    }
    consumeColdBlood(simulation, caster, ability.id);
  },
  unmodelled:
    'Its "+20% against Poisoned targets" does nothing: poisons are not ' +
    'implemented, so no target here is ever poisoned.',
};

/**
 * "100% weapon damage (145% if a Dagger is equipped) and causes the target to
 * take 15% increased Rupture damage. Awards 1 Combo Point."
 */
export const HEMORRHAGE_WEAPON_FRACTION = 1.0;
export const HEMORRHAGE_DAGGER_FRACTION = 1.45;

export const HEMORRHAGE: Ability = {
  id: 'hemorrhage',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Hemorrhage',
  cost: { resource: 'energy', amount: 35 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const dagger = caster.weapons.mainHand?.weaponType === 'dagger';
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: {
        slot: MAIN_HAND,
        fraction: dagger ? HEMORRHAGE_DAGGER_FRACTION : HEMORRHAGE_WEAPON_FRACTION,
      },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });

    if (!result.avoided) {
      awardComboPoint(simulation, caster, ability.id, ability.name);
      simulation.applyAura(target, HEMORRHAGE_DEBUFF, caster.id);
    }
  },
  unmodelled: HEMORRHAGE_UNMODELLED,
};

/**
 * "125% (180% with a Dagger in your Main Hand) weapon damage and increases
 * your chance to dodge by 15% for 7 sec. Awards 1 combo point."
 */
export const GHOSTLY_STRIKE_WEAPON_FRACTION = 1.25;
export const GHOSTLY_STRIKE_DAGGER_FRACTION = 1.8;

export const GHOSTLY_STRIKE: Ability = {
  id: 'ghostly_strike',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Ghostly Strike',
  cost: { resource: 'energy', amount: 40 },
  cooldownMs: seconds(20),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const dagger = caster.weapons.mainHand?.weaponType === 'dagger';
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: {
        slot: MAIN_HAND,
        fraction: dagger ? GHOSTLY_STRIKE_DAGGER_FRACTION : GHOSTLY_STRIKE_WEAPON_FRACTION,
      },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });

    // The dodge goes up whether or not the strike landed: it is a state the
    // cast confers, not a rider on the hit.
    simulation.applyAura(caster, GHOSTLY_STRIKE_DODGE_AURA, caster.id);
    if (!result.avoided) awardComboPoint(simulation, caster, ability.id, ability.name);
  },
};

// ---------------------------------------------------------------------------
// Finishers
// ---------------------------------------------------------------------------

/**
 * Eviscerate's stated damage at 1..5 combo points, as the midpoint of each
 * range.
 *
 *     1 point : 224-332     4 points: 734-842
 *     2 points: 394-502     5 points: 904-1,012
 *     3 points: 564-672
 *
 * THE MIDPOINT, and the spread is dropped. Every step is exactly 170 apart and
 * every range is exactly 108 wide, so the table is regular enough to be
 * confident it was read correctly. The engine's combat table supplies the
 * variance a real cast shows.
 */
export const EVISCERATE_BY_COMBO_POINT: readonly number[] = [278, 448, 618, 788, 958];

export const EVISCERATE: Ability = {
  id: 'eviscerate',
  name: 'Eviscerate',
  cost: { resource: 'energy', amount: 35 },
  attackTable: 'melee-special',
  canCast: ({ caster }) => hasComboPoints(caster),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    // READ, DRAIN, THEN SCALE. `spendComboPoints` returns what it drained so
    // the order cannot be got wrong. See game/combat/comboPoints.ts.
    const spent = spendComboPoints(caster);
    if (spent <= 0) return;

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: EVISCERATE_BY_COMBO_POINT[spent - 1],
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    consumeColdBlood(simulation, caster, ability.id);
  },
  unmodelled:
    'Its "increased by Attack Power" does not apply: the source states five ' +
    'flat figures and no coefficient, so none is invented.',
};

export const RUPTURE: Ability = {
  id: 'rupture',
  name: 'Rupture',
  cost: { resource: 'energy', amount: 25 },
  attackTable: 'melee-special',
  canCast: ({ caster }) => hasComboPoints(caster),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || !ability.attackTable) return;

    const spent = spendComboPoints(caster);
    if (spent <= 0) return;

    /*
     * Rolled ONCE here rather than per tick, exactly as Rend is: whether the
     * bleed landed is settled when it is applied, and then it ticks for its
     * whole duration.
     */
    const roll = simulation.rollAttack(ability.attackTable, caster, target, {
      slot: MAIN_HAND,
    });
    if (roll.avoided) return;

    simulation.applyAura(target, ruptureAura(spent), caster.id);
  },
  unmodelled: RUPTURE_UNMODELLED,
};

/** The key Improved Slice and Dice hands its percentage over on. */
export const SLICE_AND_DICE_DURATION_BONUS = 'durationPercent';

export const SLICE_AND_DICE: Ability = {
  id: 'slice_and_dice',
  name: 'Slice and Dice',
  cost: { resource: 'energy', amount: 25 },
  requiresTarget: false,
  canCast: ({ caster }) => hasComboPoints(caster),
  onCast: ({ simulation, caster, ability }) => {
    const spent = spendComboPoints(caster);
    if (spent <= 0) return;

    /*
     * Improved Slice and Dice lengthens it by a percentage, and that number
     * lives inside this body rather than in a declared field -- so it arrives
     * as a named bonus on the copy of this ability built for a character who
     * took the talent. Improved Charge does the same with its rage.
     */
    const bonus = ability.bonuses?.[SLICE_AND_DICE_DURATION_BONUS] ?? 0;
    simulation.applyAura(caster, sliceAndDiceAura(spent, 1 + bonus / 100), caster.id);
  },
};

export const EXPOSE_ARMOR: Ability = {
  id: 'expose_armor',
  name: 'Expose Armor',
  cost: { resource: 'energy', amount: 25 },
  canCast: ({ caster }) => hasComboPoints(caster),
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    const spent = spendComboPoints(caster);
    if (spent <= 0) return;
    simulation.applyAura(target, exposeArmorAura(spent), caster.id);
  },
};

// ---------------------------------------------------------------------------
// Cooldowns
// ---------------------------------------------------------------------------

export const ADRENALINE_RUSH_ABILITY: Ability = {
  id: 'adrenaline_rush',
  name: 'Adrenaline Rush',
  cooldownMs: seconds(300),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, ADRENALINE_RUSH, caster.id);
  },
  unmodelled: ADRENALINE_RUSH_UNMODELLED,
};

export const BLADE_FLURRY_ABILITY: Ability = {
  id: 'blade_flurry',
  name: 'Blade Flurry',
  cost: { resource: 'energy', amount: 25 },
  cooldownMs: seconds(120),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BLADE_FLURRY, caster.id);
  },
  unmodelled: BLADE_FLURRY_UNMODELLED,
};

export const COLD_BLOOD_ABILITY: Ability = {
  id: 'cold_blood',
  name: 'Cold Blood',
  cooldownMs: seconds(180),
  requiresTarget: false,
  // Off the global cooldown: it is a state change with no cast of its own,
  // and spending a GCD to buff the next ability would be self-defeating.
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, COLD_BLOOD, caster.id);
  },
};

export const ROGUE_ABILITIES: readonly Ability[] = [
  SINISTER_STRIKE,
  BACKSTAB,
  MUTILATE,
  HEMORRHAGE,
  GHOSTLY_STRIKE,
  EVISCERATE,
  RUPTURE,
  SLICE_AND_DICE,
  EXPOSE_ARMOR,
  ADRENALINE_RUSH_ABILITY,
  BLADE_FLURRY_ABILITY,
  COLD_BLOOD_ABILITY,
];
