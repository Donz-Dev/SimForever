import type { Ability } from '../../engine';
import {
  BERSERKING,
  BERSERKING_COOLDOWN_MS,
  BLOOD_FURY,
  BLOOD_FURY_COOLDOWN_MS,
  ELUNES_LIGHT,
  ELUNES_LIGHT_COOLDOWN_MS,
  EUREKA,
  EUREKA_COOLDOWN_MS,
  STONEFORM,
  STONEFORM_COOLDOWN_MS,
} from './auras';

/**
 * The five active racials, as abilities.
 *
 * ============================================================================
 * FOUR OF THE FIVE ARE OFF THE GLOBAL COOLDOWN, AND THAT IS THE OWNER'S OWN
 * BREAKDOWN RATHER THAN A CONVENTION.
 *
 * The client states "Instant" for all five and says nothing about the global
 * cooldown either way; the owner's statement is explicit and splits them:
 * Stoneform has a "1.5 second Global Cooldown" and Elune's Light, Eureka!,
 * Blood Fury and Berserking each have "No Global Cooldown".
 *
 * WHY THAT MATTERS MORE THAN IT LOOKS. Being off the global cooldown means ONE
 * thing in this engine -- the ability does not START one -- and what it buys is
 * that the action AFTER it is free. So Blood Fury costs an Orc nothing at all
 * and Stoneform costs a Dwarf a whole global cooldown's worth of rotation. A
 * racial wrongly taking a GCD still applies the right aura for the right
 * duration on the right cooldown, so the mistake is invisible in everything
 * except the DPS.
 *
 * `triggersGcd` IS DECLARED HERE RATHER THAN DERIVED. The engine derives it as
 * `triggersGcd ?? onNextSwing === undefined`, which makes an on-next-swing
 * ability free and everything else not -- right for a class ability and wrong
 * for four of these five, so each one says so in its own line.
 *
 * NONE OF THEM COSTS A RESOURCE. The client gives no cost line for any of the
 * five, and inventing one would be inventing data -- so a Warrior's Berserking
 * is genuinely free rather than costing a plausible ten rage.
 *
 * NONE OF THEM NEEDS A TARGET. All five buff the caster, so `requiresTarget` is
 * false on each: an ability that asks for a target it does not use would be
 * refused by `checkCast` in any fight that had none.
 * ============================================================================
 */

export const STONEFORM_ABILITY: Ability = {
  id: 'stoneform',
  name: 'Stoneform',
  cooldownMs: STONEFORM_COOLDOWN_MS,
  requiresTarget: false,
  // The ONE racial that costs a global cooldown, by the owner's statement.
  triggersGcd: true,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, STONEFORM, caster.id);
  },
};

export const ELUNES_LIGHT_ABILITY: Ability = {
  id: 'elunes_light',
  name: "Elune's Light",
  cooldownMs: ELUNES_LIGHT_COOLDOWN_MS,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, ELUNES_LIGHT, caster.id);
  },
};

export const BLOOD_FURY_ABILITY: Ability = {
  id: 'blood_fury',
  name: 'Blood Fury',
  cooldownMs: BLOOD_FURY_COOLDOWN_MS,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BLOOD_FURY, caster.id);
  },
};

export const BERSERKING_ABILITY: Ability = {
  id: 'berserking',
  name: 'Berserking',
  cooldownMs: BERSERKING_COOLDOWN_MS,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BERSERKING, caster.id);
  },
};

export const EUREKA_ABILITY: Ability = {
  id: 'eureka',
  name: 'Eureka!',
  cooldownMs: EUREKA_COOLDOWN_MS,
  requiresTarget: false,
  triggersGcd: false,
  /*
   * APPLIED AT FULL CHARGES, which `chargesOnApply` on the aura does rather
   * than this line. Writing `instance.stacks` by hand would not re-apply stat
   * modifiers -- `applyStatModifiers` runs inside `apply` at ONE stack -- and
   * while Eureka! carries no stat modifiers today, the failure is an aura that
   * reports three stacks and pays one, which Combustion already paid for.
   */
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, EUREKA, caster.id);
  },
};

/**
 * Every ability a race can grant, by id.
 *
 * `grantAbility` resolves through this table and `createPlayer` would otherwise
 * have nowhere to look. A racial naming an id absent here is a racial that
 * visibly does nothing -- so `racials.test.ts` asserts every `grantAbility` id
 * across all ten races resolves, which is the check `lone_wolf` did not have:
 * both Hunter profiles NAMED AFTER that talent went the whole project without
 * its aura because `TALENT_AURAS` never carried it and a missed lookup is not
 * an error.
 */
export const RACIAL_ABILITIES: Readonly<Record<string, Ability>> = {
  stoneform: STONEFORM_ABILITY,
  elunes_light: ELUNES_LIGHT_ABILITY,
  blood_fury: BLOOD_FURY_ABILITY,
  berserking: BERSERKING_ABILITY,
  eureka: EUREKA_ABILITY,
};
