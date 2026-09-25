import type { Ability, AuraDefinition, Combatant, SimulationContext } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { baseManaFor } from '../character/baseStatLookup';
import {
  ASPECT_AURA_IDS,
  ASPECT_OF_THE_BEAST,
  ASPECT_OF_THE_HAWK,
  HUNTERS_MARK,
  BESTIAL_WRATH,
  HAWK_UNMODELLED,
  RAPID_FIRE,
  SERPENT_STING,
  SUMMON_HAWK_AURA,
} from '../auras/hunter';

/**
 * Hunter abilities, from the WoW Forever beta client and the Forever Hunter
 * wiki.
 *
 * ----------------------------------------------------------------------------
 * ALMOST EVERY NUMBER HERE IS A FOREVER NUMBER RATHER THAN A CLASSIC ONE, and
 * the wiki lists them side by side. A few examples, Classic first:
 *
 *   Arcane Shot r8      183 -> 217, and it now scales with 10% RAP
 *   Aimed Shot r6       600 -> 166 bonus, and the cast is 2s rather than 3
 *   Serpent Sting r9    490 -> 555 total, and it now scales with 15% RAP
 *   Raptor Strike r8    140 -> 70 bonus
 *
 * Reading any of these from Classic would have been badly wrong in both
 * directions at once. The spellbook agrees with the wiki on every one.
 *
 * THE FIRST ATTACK POWER COEFFICIENTS ON ABILITIES. Arcane Shot takes 10% of
 * ranged attack power and Serpent Sting 15% over its duration -- which is the
 * Hunter's whole identity as a scaling class and is why these two are the ones
 * Forever bothered to give coefficients to.
 *
 * MELEE RESETS THE RANGED SWING TIMER, which the wiki reports as current
 * behaviour and flags as possibly unintended. Not modelled: it would make
 * melee weaving a loss, and acting on a sentence that says a behaviour may be
 * a bug is worse than recording it. See `docs/`.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const RANGED = 'ranged' as const;
const PHYSICAL = 'physical' as const;

/** A Hunter's base mana, which a "% of base mana" cost is a share of. */
export const HUNTER_BASE_MANA = baseManaFor('orc', 'hunter');
const shareOfBase = (fraction: number) => Math.round(HUNTER_BASE_MANA * fraction);

/**
 * Cast an aspect, removing whichever one is up.
 *
 * "Only one Aspect can be active at a time" -- the same exclusivity a stance
 * and a seal already have, handled in one place so a new aspect cannot forget
 * it.
 */
function castAspect(
  simulation: SimulationContext,
  caster: Combatant,
  aspect: AuraDefinition,
): void {
  for (const id of ASPECT_AURA_IDS) {
    if (id !== aspect.id) caster.auras.remove(simulation, id);
  }
  simulation.applyAura(caster, aspect, caster.id);
}

// ---------------------------------------------------------------------------
// Aspects
// ---------------------------------------------------------------------------

export const ASPECT_OF_THE_HAWK_ABILITY: Ability = {
  id: 'aspect_of_the_hawk',
  name: 'Aspect of the Hawk',
  cost: { resource: 'mana', amount: 120 },
  requiresTarget: false,
  canCast: ({ caster }) => !caster.auras.has('aspect_of_the_hawk'),
  onCast: ({ simulation, caster }) => castAspect(simulation, caster, ASPECT_OF_THE_HAWK),
};

/**
 * Hunter’s Mark. One instant cast on the pull, and it lasts the fight.
 *
 * The aura carries the caveat: it is really a debuff on the TARGET that helps
 * every attacker, and with one attacker a buff on the Hunter is the same
 * number. See `HUNTERS_MARK`.
 */
export const HUNTERS_MARK_ABILITY: Ability = {
  id: 'hunters_mark',
  name: "Hunter’s Mark",
  cost: { resource: 'mana', amount: 60 },
  requiresTarget: true,
  canCast: ({ caster }) => !caster.auras.has('hunters_mark'),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, HUNTERS_MARK, caster.id);
  },
  unmodelled:
    'It is really a debuff on the TARGET, raising the ranged attack power of ' +
    'every attacker against it. With one attacker that is the same number, so ' +
    'it is applied to the Hunter -- the difference would only show in a raid.',
};

export const ASPECT_OF_THE_BEAST_ABILITY: Ability = {
  id: 'aspect_of_the_beast',
  name: 'Aspect of the Beast',
  cost: { resource: 'mana', amount: 110 },
  requiresTarget: false,
  canCast: ({ caster }) => !caster.auras.has('aspect_of_the_beast'),
  onCast: ({ simulation, caster }) => castAspect(simulation, caster, ASPECT_OF_THE_BEAST),
};

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------

/**
 * Arcane Shot: "causes 217 Arcane damage", and in Forever it scales.
 *
 * "NOW SCALES WITH 10% OF RANGED ATTACK POWER. Classic Spell Power scaling
 * removed." Both halves of that matter: the coefficient is new AND the old one
 * is gone, so reading this from Classic would have scaled it off a stat a
 * Hunter does not stack.
 */
export const ARCANE_SHOT_DAMAGE = 217;
export const ARCANE_SHOT_RAP_COEFFICIENT = 0.1;

export const ARCANE_SHOT: Ability = {
  id: 'arcane_shot',
  name: 'Arcane Shot',
  cost: { resource: 'mana', amount: 190 },
  cooldownMs: seconds(6),
  // Shares its cooldown with Summon Hawk, which the wiki states.
  cooldownGroup: 'arcane_shot',
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      baseAmount:
        ARCANE_SHOT_DAMAGE +
        caster.stats.effective.rangedAttackPower * ARCANE_SHOT_RAP_COEFFICIENT,
      powerCoefficient: 0,
      attackTable: ability.attackTable,
      weaponSlot: RANGED,
    });
  },
};

/**
 * Aimed Shot: "increases ranged damage by 166", a 2-second cast.
 *
 * A TALENT IN CLASSIC AND A TRAINER ABILITY IN FOREVER, learned at 20 by every
 * Hunter -- so all three profiles have it whatever they spent. Its bonus was
 * also cut by more than two thirds, 600 to 166, which is the largest single
 * change in the class.
 */
export const AIMED_SHOT_BONUS = 166;

export const AIMED_SHOT: Ability = {
  id: 'aimed_shot',
  name: 'Aimed Shot',
  cost: { resource: 'mana', amount: 310 },
  castTimeMs: seconds(2),
  cooldownMs: seconds(6),
  // "Aimed Shot shares its cooldown with Multi-Shot."
  cooldownGroup: 'aimed_shot',
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: AIMED_SHOT_BONUS,
      weaponScaling: { slot: RANGED },
      attackTable: ability.attackTable,
      weaponSlot: RANGED,
    });
  },
};

/**
 * Multi-Shot: "Fires several missiles, hitting 3 targets."
 *
 * ONE RANK IN FOREVER, down from five, and a 0.5-second cast where Classic's
 * was instant. It lands on the one target this project has, so what is shown
 * is a third of what it is worth in a pull of three -- and it shares a
 * cooldown with Aimed Shot, which is the better single-target spell.
 */
export const MULTI_SHOT_TARGETS = 3;

export const MULTI_SHOT: Ability = {
  id: 'multi_shot',
  name: 'Multi-Shot',
  cost: { resource: 'mana', amount: shareOfBase(0.139) },
  castTimeMs: seconds(0.5),
  cooldownMs: seconds(6),
  cooldownGroup: 'aimed_shot',
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: { slot: RANGED },
      attackTable: ability.attackTable,
      weaponSlot: RANGED,
    });
  },
  unmodelled:
    `It hits ${MULTI_SHOT_TARGETS} targets and there is one, so only that ` +
    'one is dealt damage -- which says nothing about its value in a pull.',
};

export const SERPENT_STING_ABILITY: Ability = {
  id: 'serpent_sting',
  name: 'Serpent Sting',
  cost: { resource: 'mana', amount: 250 },
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, SERPENT_STING, caster.id);
  },
};

/**
 * Sniper Shot, granted by the Marksmanship talent.
 *
 * "A steady snipe that increases ranged damage by 160" -- rank 1, which is the
 * one the talent grants. The wiki gives 225 and 295 for ranks 2 and 3, learned
 * from the trainer; the spellbook opens on rank 1, and the rank-1 rule says
 * a talent shows the rank it grants.
 */
export const SNIPER_SHOT_BONUS = 160;

export const SNIPER_SHOT: Ability = {
  id: 'sniper_shot',
  name: 'Sniper Shot',
  cost: { resource: 'mana', amount: 200 },
  cooldownMs: seconds(6),
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: SNIPER_SHOT_BONUS,
      weaponScaling: { slot: RANGED },
      attackTable: ability.attackTable,
      weaponSlot: RANGED,
    });
  },
  unmodelled:
    'Its mana cost is not stated anywhere -- the spellbook gives the ability ' +
    'no cost line at all -- so 200 is assumed, and it is a placeholder.',
};

// ---------------------------------------------------------------------------
// Melee
// ---------------------------------------------------------------------------

/** Raptor Strike: "melee weapon damage plus 70". Forever cut it from 140. */
export const RAPTOR_STRIKE_BONUS = 70;

export const RAPTOR_STRIKE: Ability = {
  id: 'raptor_strike',
  name: 'Raptor Strike',
  cost: { resource: 'mana', amount: 100 },
  cooldownMs: seconds(6),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: RAPTOR_STRIKE_BONUS,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * Mongoose Bite: "Counterattack the enemy for melee weapon damage plus 57. Can
 * only be performed after you dodge."
 *
 * ITS CONDITION NEVER FIRES ON ITS OWN, because nothing in these profiles is
 * attacked -- so no dodge, so no window. What DOES open it is Expose Prey,
 * a Survival talent the Lone Wolf melee build takes: "your attacks against
 * targets with Hunter's Mark have a 10% chance to activate your Mongoose
 * Bite". That is the only route to it here, and `canCast` reads the aura that
 * talent applies.
 */
export const MONGOOSE_BITE_BONUS = 57;

export const MONGOOSE_BITE: Ability = {
  id: 'mongoose_bite',
  name: 'Mongoose Bite',
  cost: { resource: 'mana', amount: 65 },
  cooldownMs: seconds(5),
  attackTable: 'melee-special',
  canCast: ({ caster }) => caster.auras.has('expose_prey'),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    caster.auras.remove(simulation, 'expose_prey');
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: MONGOOSE_BITE_BONUS,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/** Strider Kick, granted by the Survival talent: 100% melee weapon damage. */
export const STRIDER_KICK: Ability = {
  id: 'strider_kick',
  name: 'Strider Kick',
  cooldownMs: seconds(8),
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

// ---------------------------------------------------------------------------
// Cooldowns
// ---------------------------------------------------------------------------

export const RAPID_FIRE_ABILITY: Ability = {
  id: 'rapid_fire',
  name: 'Rapid Fire',
  cost: { resource: 'mana', amount: 100 },
  cooldownMs: seconds(300),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, RAPID_FIRE, caster.id);
  },
};

/** Bestial Wrath, granted by the Beast Mastery capstone. */
export const BESTIAL_WRATH_ABILITY: Ability = {
  id: 'bestial_wrath',
  name: 'Bestial Wrath',
  cost: { resource: 'mana', amount: shareOfBase(0.12) },
  cooldownMs: seconds(120),
  requiresTarget: false,
  /*
   * IT BUFFS THE PET, NOT THE HUNTER. "Send your PET into a rage causing 50%
   * additional damage" -- so the aura goes on whichever combatant names this
   * one as its owner, which is what `ownerId` is for and the first thing to
   * use it.
   */
  onCast: ({ simulation, caster }) => {
    const pet = simulation.combatants.find((actor) => actor.ownerId === caster.id);
    if (!pet) return;
    simulation.applyAura(pet, BESTIAL_WRATH, caster.id);
  },
  unmodelled:
    'With no pet it does nothing at all, which is correct -- and a Lone Wolf ' +
    'build cannot take the talent that grants it in any case.',
};

/** Summon Hawk, granted by the Beast Mastery talent. */
export const SUMMON_HAWK: Ability = {
  id: 'summon_hawk',
  name: 'Summon Hawk',
  cost: { resource: 'mana', amount: 190 },
  cooldownMs: seconds(6),
  // "Shares cooldown with Arcane Shot", which the wiki states outright.
  cooldownGroup: 'arcane_shot',
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, SUMMON_HAWK_AURA, caster.id);
  },
  unmodelled: HAWK_UNMODELLED,
};

export const HUNTER_ABILITIES: readonly Ability[] = [
  HUNTERS_MARK_ABILITY,
  ASPECT_OF_THE_HAWK_ABILITY,
  ASPECT_OF_THE_BEAST_ABILITY,
  ARCANE_SHOT,
  AIMED_SHOT,
  MULTI_SHOT,
  SERPENT_STING_ABILITY,
  SNIPER_SHOT,
  RAPTOR_STRIKE,
  MONGOOSE_BITE,
  STRIDER_KICK,
  RAPID_FIRE_ABILITY,
  BESTIAL_WRATH_ABILITY,
  SUMMON_HAWK,
];
