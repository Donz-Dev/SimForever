import type { Ability, AuraDefinition, Combatant, SimulationContext } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { baseManaFor } from '../character/baseStatLookup';
import {
  CONSECRATION_GROUND,
  HOLY_SHIELD,
  JUDGEMENT_OF_THE_CRUSADER,
  JUDGEMENT_OF_THE_CRUSADER_UNMODELLED,
  SEAL_AURA_IDS,
  SEAL_OF_COMMAND,
  SEAL_OF_FURY,
  SEAL_OF_RIGHTEOUSNESS,
  SEAL_OF_THE_CRUSADER,
  SEAL_OF_THE_CRUSADER_UNMODELLED,
  activeSeal,
  echoAura,
} from '../auras/paladin';
import { directSpellCoefficient } from '../combat/spellCoefficient';

/**
 * Paladin abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE FIRST CLASS WITH A SPELL POWER COEFFICIENT. The ruleset owner supplied
 * the seal formula directly:
 *
 *     damage = base + baseWeaponSpeed x (0.022 x attackPower + 0.044 x spellPower)
 *
 * Every caster before this -- Druid, Shaman, Mage -- states flat damage and no
 * coefficient, and each says so on its results page. A Paladin's seal is the
 * one place in the project where gear reaches a Holy number, which is worth
 * knowing before comparing a Paladin figure with a Moonkin one.
 *
 * A SEAL IS EXCLUSIVE, like a stance: casting one removes the rest. Judgement
 * spends its effect WITHOUT consuming it, which the spellbook states outright
 * and which is a Forever change from Classic.
 *
 * SEAL DAMAGE IS NOT A WEAPON USE, on the owner's ruling. Every seal hit below
 * is dealt with NO `weaponSlot`, so `isWeaponUse` refuses it and Windfury,
 * Crusader and Hand of Justice see only the swing that carried it.
 *
 * NOT HERE, AND EACH FOR A STATED REASON:
 *
 *   EXORCISM       "to an Undead or Demon target", and the training dummy is
 *   HOLY WRATH     neither. Two spells that do literally nothing here.
 *   HAMMER OF      "Only usable on enemies that have 20% or less health", and
 *   WRATH          the target never drops below full.
 *   EVERY HEAL     Holy Light, Flash of Light, Light's Vigil. No profile heals.
 *   BLESSINGS      Raid buffs, selected in the buff panel rather than cast.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const HOLY = 'holy' as const;
const PHYSICAL = 'physical' as const;

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/** A Paladin's base mana, which a "% of base mana" cost is a share of. */
export const PALADIN_BASE_MANA = baseManaFor('human', 'paladin');

/** Costs stated as a share of base mana, resolved once. */
const shareOfBase = (fraction: number) => Math.round(PALADIN_BASE_MANA * fraction);

/**
 * Cast a seal, removing whichever one is already up.
 *
 * "Only one Seal can be active on the Paladin at any one time." Handled here
 * rather than by each seal, so a new seal cannot forget the rule -- the same
 * reason the global cooldown is derived rather than declared per ability.
 *
 * TWIST OF LIGHT READS THE REPLACEMENT. The talent pays out when a seal is
 * REPLACED, which is exactly this moment and nowhere else, so the echo is
 * granted here and gated on the character actually having the talent.
 */
export const TWIST_OF_LIGHT_FLAG = 'twistOfLight';

function castSeal(
  simulation: SimulationContext,
  caster: Combatant,
  seal: AuraDefinition,
  hasTwistOfLight: boolean,
): void {
  const replaced = activeSeal(caster);

  for (const id of SEAL_AURA_IDS) {
    if (id !== seal.id) caster.auras.remove(simulation, id);
  }

  /*
   * An Echo only for a REPLACEMENT, and only by a different seal. Re-casting
   * the same seal refreshes it and replaces nothing, which is what the
   * tooltip's "with a different Seal" says.
   */
  if (hasTwistOfLight && replaced !== undefined && replaced !== seal.id) {
    simulation.applyAura(caster, echoAura(replaced), caster.id);
  }

  simulation.applyAura(caster, seal, caster.id);
}

// ---------------------------------------------------------------------------
// Seals
// ---------------------------------------------------------------------------

const sealAbility = (
  id: string,
  name: string,
  cost: number,
  aura: AuraDefinition,
  unmodelled?: string,
): Ability => ({
  id,
  name,
  cost: { resource: 'mana', amount: cost },
  requiresTarget: false,
  onCast: ({ simulation, caster, ability }) => {
    /*
     * THE TALENT ARRIVES ON THE ABILITY, not on the character. Twist of Light
     * sets an `abilityFlag` on every seal, and `applyTalentChanges` hands each
     * character its own COPY of the ability -- so reading it here is
     * per-character by construction. A module-level set keyed on the character
     * would leak the talent across a Monte Carlo batch, which is the exact bug
     * that copy exists to prevent.
     */
    castSeal(simulation, caster, aura, (ability.bonuses?.[TWIST_OF_LIGHT_FLAG] ?? 0) > 0);
  },
  ...(unmodelled ? { unmodelled } : {}),
});

export const SEAL_OF_RIGHTEOUSNESS_ABILITY = sealAbility(
  'seal_of_righteousness',
  'Seal of Righteousness',
  200,
  SEAL_OF_RIGHTEOUSNESS,
);

export const SEAL_OF_COMMAND_ABILITY = sealAbility(
  'seal_of_command',
  'Seal of Command',
  210,
  SEAL_OF_COMMAND,
);

export const SEAL_OF_THE_CRUSADER_ABILITY = sealAbility(
  'seal_of_the_crusader',
  'Seal of the Crusader',
  160,
  SEAL_OF_THE_CRUSADER,
  SEAL_OF_THE_CRUSADER_UNMODELLED,
);

export const SEAL_OF_FURY_ABILITY = sealAbility(
  'seal_of_fury',
  'Seal of Fury',
  200,
  SEAL_OF_FURY,
);

// ---------------------------------------------------------------------------
// Judgement
// ---------------------------------------------------------------------------

/**
 * Judgement: "Unleash the energy of a Seal spell upon an enemy. DOES NOT
 * CONSUME THE SEAL."
 *
 * ----------------------------------------------------------------------------
 * ONE ABILITY WITH FOUR EFFECTS, chosen by whichever seal is up. That is the
 * spellbook's own structure -- "Refer to individual Seals for Judgement
 * effect" -- so the dispatch lives here and each seal's number lives beside
 * the seal.
 *
 * AND IT DOES NOT CONSUME THE SEAL, which is a Forever change and removes the
 * whole reason a Classic paladin re-casts a seal after every judgement. It is
 * stated in the spellbook in capitals for that reason.
 *
 * WITH NO SEAL UP IT DOES NOTHING, rather than dealing some default damage.
 * `canCast` refuses, so a priority list skips it instead of wasting the
 * cooldown.
 * ----------------------------------------------------------------------------
 */
/*
 * TWO JUDGEMENTS AND HOLY STRIKE MOVED, and Holy Strike moved for two reasons
 * at once -- read `docs/source-cross-checks.md` before changing any of these.
 *
 * Judgement of Righteousness is 162 to 178 and Judgement of Fury 146 to 160 on
 * foreverchanges.pro, against our capture's 170-186 and 153-167 at the same
 * build. Judgement of Command agrees on both sides.
 */
export const JUDGEMENT_OF_RIGHTEOUSNESS = midpoint(162, 178);
export const JUDGEMENT_OF_COMMAND = midpoint(169, 187);
export const JUDGEMENT_OF_FURY = midpoint(146, 160);

/*
 * AN INSTANT HOLY SPELL, so 1.5 / 3.5 -- and it reads HOLY-scoped spell power,
 * which eight pieces of Lawbringer grant.
 *
 * THE SEALS ARE NOT THIS. A seal has the ruleset owner's own formula, `base +
 * baseWeaponSpeed x (0.022 x AP + 0.044 x SP)`, supplied directly and
 * unaffected by the universal cast-time rule -- a seal is not cast at the
 * target and has no cast time to divide. A judgement IS a cast, so it takes
 * the general rule like every other spell.
 */
export const JUDGEMENT_COEFFICIENT = directSpellCoefficient(0);

export const JUDGEMENT: Ability = {
  id: 'judgement',
  name: 'Judgement',
  cost: { resource: 'mana', amount: shareOfBase(0.06) },
  cooldownMs: seconds(10),
  attackTable: 'spell',
  canCast: ({ caster }) => activeSeal(caster) !== undefined,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const seal = activeSeal(caster);
    if (!seal) return;

    if (seal === 'seal_of_the_crusader') {
      // The only judgement that deals no damage: it applies a debuff instead.
      simulation.applyAura(target, JUDGEMENT_OF_THE_CRUSADER, caster.id);
      return;
    }

    const amount =
      seal === 'seal_of_command'
        ? JUDGEMENT_OF_COMMAND
        : seal === 'seal_of_fury'
          ? JUDGEMENT_OF_FURY
          : JUDGEMENT_OF_RIGHTEOUSNESS;

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: HOLY,
      baseAmount: amount,
      powerCoefficient: JUDGEMENT_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    `Its Crusader judgement is tracked and adds no damage. ${JUDGEMENT_OF_THE_CRUSADER_UNMODELLED}`,
};

/**
 * Swift Judgement, granted by the Protection talent.
 *
 * "Finishes the remaining cooldown on your Judgement ability and reduces the
 * Mana cost of your next Judgement by 100%." Only the cooldown reset is
 * modelled: a one-shot cost reduction is a `CastModifier`, which exists, but
 * Judgement's cost is 6% of base mana and the reset is the whole point.
 */
export const SWIFT_JUDGEMENT: Ability = {
  id: 'swift_judgement',
  name: 'Swift Judgement',
  cooldownMs: seconds(60),
  requiresTarget: false,
  // Only worth a global cooldown when there is something to reset.
  canCast: ({ simulation, caster }) =>
    !caster.abilities.isReady('judgement', simulation.clock.now()),
  onCast: ({ caster }) => {
    caster.abilities.resetCooldown('judgement');
  },
  unmodelled:
    'Its free-next-Judgement clause is not modelled; the cooldown reset is, ' +
    'and that is what the ability is for.',
};

// ---------------------------------------------------------------------------
// Strikes
// ---------------------------------------------------------------------------

/**
 * Holy Strike: "An instant strike that causes 40% weapon damage plus an
 * additional 32 to 42 as Holy damage."
 *
 * A WEAPON USE, and therefore able to trigger Windfury, Crusader and Hand of
 * Justice -- it goes through a melee table and needs the weapon, which is the
 * ruleset owner's own rule. That is the opposite of the seal damage it can
 * carry, and the two sit one line apart on purpose.
 *
 * ONE DAMAGE EVENT, not two. The Holy half is stated as part of the same
 * strike, so it is added to the weapon-scaled amount rather than rolled
 * separately -- a second roll would give it its own chance to miss.
 */
/*
 * HOLY STRIKE CHANGED IN THE CLIENT AND THE TWO SOURCES THEN DISAGREED.
 *
 * Our own capture moved between builds 69876 and 70009 -- 40% weapon damage on
 * a 12-second cooldown became 50% on a 10-second one -- so the fraction and the
 * cooldown here were STALE rather than wrong, and both sources now agree on
 * them. They disagree on the Holy damage: 40 to 53 in our capture, 81 to 105 on
 * foreverchanges.pro, which the standing rule prefers. That is a doubling, and
 * it is the largest single correction of the five-class cross-check.
 */
export const HOLY_STRIKE_WEAPON_FRACTION = 0.5;
export const HOLY_STRIKE_HOLY_DAMAGE = midpoint(81, 105);

export const HOLY_STRIKE: Ability = {
  id: 'holy_strike',
  name: 'Holy Strike',
  cost: { resource: 'mana', amount: 20 },
  cooldownMs: seconds(10),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: HOLY_STRIKE_HOLY_DAMAGE,
      weaponScaling: { slot: MAIN_HAND, fraction: HOLY_STRIKE_WEAPON_FRACTION },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
  unmodelled:
    'Its Holy half is dealt as part of the same physical strike rather than ' +
    'as a separate Holy hit, so armor applies to all of it.',
};

/**
 * Holy Shock, granted by the Holy talent.
 *
 * The damage half only. Its heal is real and no Paladin profile here heals.
 */
export const HOLY_SHOCK_DAMAGE = midpoint(334, 362);
export const HOLY_SHOCK_COEFFICIENT = directSpellCoefficient(0);

export const HOLY_SHOCK: Ability = {
  id: 'holy_shock',
  name: 'Holy Shock',
  cost: { resource: 'mana', amount: 325 },
  cooldownMs: seconds(10),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: HOLY,
      baseAmount: HOLY_SHOCK_DAMAGE,
      powerCoefficient: HOLY_SHOCK_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: 'Its healing half is not modelled; no Paladin profile heals.',
};

/**
 * Consecration: "96 Holy damage over 8 sec to enemies who enter the area. The
 * first 4 enemies will take an additional 216 damage over 8 sec."
 *
 * BOTH HALVES LAND ON ONE TARGET, because there is one target and it is
 * certainly among the first four. 312 over eight seconds, as a ground effect
 * the target is standing in -- modelled as a debuff on it, which is the only
 * shape the engine has and is exactly right for a target that never moves.
 */
export const CONSECRATION_BASE_TOTAL = 96;
export const CONSECRATION_BONUS_TOTAL = 216;

export const CONSECRATION: Ability = {
  id: 'consecration',
  name: 'Consecration',
  cost: { resource: 'mana', amount: 565 },
  cooldownMs: seconds(8),
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, CONSECRATION_GROUND, caster.id);
  },
  unmodelled:
    'It is a ground effect, modelled as a debuff on the one target -- which ' +
    'is right for a target that never moves and says nothing about its value ' +
    'against several.',
};

/** Holy Shield, granted by the Protection capstone. */
export const HOLY_SHIELD_ABILITY: Ability = {
  id: 'holy_shield',
  name: 'Holy Shield',
  cost: { resource: 'mana', amount: 240 },
  cooldownMs: seconds(10),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, HOLY_SHIELD, caster.id);
  },
};

export const PALADIN_ABILITIES: readonly Ability[] = [
  SEAL_OF_RIGHTEOUSNESS_ABILITY,
  SEAL_OF_COMMAND_ABILITY,
  SEAL_OF_THE_CRUSADER_ABILITY,
  SEAL_OF_FURY_ABILITY,
  JUDGEMENT,
  SWIFT_JUDGEMENT,
  HOLY_STRIKE,
  HOLY_SHOCK,
  CONSECRATION,
  HOLY_SHIELD_ABILITY,
];
