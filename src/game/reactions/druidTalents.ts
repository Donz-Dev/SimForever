import type { Reaction } from '../../engine';
import { isWeaponUse } from '../../engine';
import { naturesGraceAura } from '../auras/druid';
import type { TalentReactionBuilder } from './warriorTalents';

/**
 * Druid talent procs.
 *
 * One, so far. Most of the Feral tree's reactive clauses need the target to
 * swing back -- Natural Reaction's rage on dodge, Furor's rage on shifting --
 * and the three profiles face a standing target.
 */

/**
 * Primal Fury: "a 100% chance to gain an additional 5 Rage any time you get a
 * critical strike while in Bear Form or Dire Bear Form".
 *
 * THE FORM CONDITION IS NOT CHECKED HERE and does not need to be: rage is the
 * Bear's resource, and `grantResource` finds no pool on a Cat or a Moonkin and
 * ignores the grant. The condition enforces itself.
 */
export const PRIMAL_FURY_RAGE = 5;

export const primalFury = (chancePercent: number): Reaction => ({
  id: 'primal_fury',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'rage', PRIMAL_FURY_RAGE, {
      id: 'primal_fury',
      name: 'Primal Fury',
    });
  },
});

/**
 * Nature's Grace: "All NON-PERIODIC spell criticals grace you with a blessing
 * of nature, increasing your spellcasting speed and reducing your global
 * cooldown by 10% for 3 sec."
 *
 * ----------------------------------------------------------------------------
 * "NON-PERIODIC" IS ALREADY GUARANTEED, AND BY THE ENGINE RATHER THAN BY THIS
 * CONDITION. `dealDamage` offers an attack to reactions only when
 * `request.attackTable && !request.periodic`, so a damage-over-time tick is
 * never shown to one at all.
 *
 * That is worth writing down rather than relying on: every DoT in Forever can
 * crit, so a Moonkin holding Moonfire and Insect Swarm up produces a stream of
 * periodic crits, and a reaction that DID see them would keep this buff up for
 * most of a fight off an effect the tooltip explicitly excludes. A test pins
 * the exclusion so the guarantee cannot quietly move.
 *
 * A SPELL CRIT, so weapon uses are out as well: the same shape Elemental
 * Devastation has on the Shaman, which is the other spell-crit-grants-an-aura
 * talent in the project.
 * ----------------------------------------------------------------------------
 */
export const naturesGrace: TalentReactionBuilder = (percentValue) => ({
  id: 'natures_grace',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => !isWeaponUse(attack),
  onTrigger: (context, actor) => {
    context.applyAura(actor, naturesGraceAura(percentValue), actor.id);
  },
});

export const DRUID_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  primal_fury: primalFury,
  nature_s_grace: naturesGrace,
};
