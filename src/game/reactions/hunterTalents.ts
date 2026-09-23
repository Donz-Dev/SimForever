import type { AuraDefinition } from '../../engine';
import { isWeaponUseOf, seconds } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import { DEADLY_ASPECTS, FRENZY } from '../auras/hunter';

/**
 * Hunter talent procs.
 *
 * ----------------------------------------------------------------------------
 * TWO, AND BOTH RIDE ON AN AUTO-ATTACK. Almost everything reactive in this
 * class belongs to the PET -- Frenzy, Ferocity, Unleashed Fury -- and a talent
 * effect reaches the character carrying it, not a separate combatant. Those
 * are recorded as unmodelled on the talents themselves rather than half-built
 * here.
 * ----------------------------------------------------------------------------
 */

/**
 * Deadly Aspects: an auto-attack may hasten the Hunter, depending on Aspect.
 *
 * TWO CLAUSES AND ONE REACTION. "While Aspect of the Hawk is active, AUTO SHOT
 * has a chance of increasing RANGED attack speed ... While Aspect of the Beast
 * is active, melee auto attacks [have] a chance to increase MELEE attack
 * speed." The engine has one haste rating, so the two clauses differ only in
 * which aura gates them and which slot swung -- and this checks both.
 *
 * AN AUTO-ATTACK ONLY, which is what "Auto Shot" and "melee auto attacks" say.
 * An `abilityId` means an ability was used, so its absence is the test.
 */
export const deadlyAspects: TalentReactionBuilder = (chancePercent) => ({
  id: 'deadly_aspects',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'crush'],
  canTrigger: (context, actor, attack) => {
    if (attack.abilityId !== undefined) return false;

    const hawk = actor.auras.has('aspect_of_the_hawk') && isWeaponUseOf(attack, 'ranged');
    const beast = actor.auras.has('aspect_of_the_beast') && isWeaponUseOf(attack, 'mainHand');
    if (!hawk && !beast) return false;

    return context.rng.rollChance(chancePercent / 100);
  },
  onTrigger: (context, actor) => {
    context.applyAura(actor, DEADLY_ASPECTS, actor.id);
  },
});

/**
 * Expose Prey: an attack may open the Mongoose Bite window.
 *
 * ----------------------------------------------------------------------------
 * IT IS THE ONLY ROUTE TO MONGOOSE BITE HERE. The ability says "can only be
 * performed after you dodge", and nothing in these profiles is attacked -- so
 * without this talent the Lone Wolf melee build would never cast it once.
 *
 * "AGAINST TARGETS WITH HUNTER'S MARK" is not checked, and that is stated
 * rather than hidden: Hunter's Mark is a raid-buff-shaped ability no list
 * casts, so requiring it would make the talent inert for a reason that has
 * nothing to do with the talent. A hunter fighting a marked target is the
 * normal case.
 * ----------------------------------------------------------------------------
 */
export const EXPOSE_PREY_DURATION_MS = seconds(5);

export const EXPOSE_PREY: AuraDefinition = {
  id: 'expose_prey',
  name: 'Expose Prey',
  durationMs: EXPOSE_PREY_DURATION_MS,
  refreshBehaviour: 'reset',
};

export const EXPOSE_PREY_UNMODELLED =
  'Its "against targets with Hunter’s Mark" condition is not checked. ' +
  'Hunter’s Mark is a raid-buff-shaped ability no priority list casts, so ' +
  'requiring it would make the talent inert for a reason unrelated to the ' +
  'talent. A Hunter fighting a marked target is the normal case.';

export const exposePrey: TalentReactionBuilder = (chancePercent) => ({
  id: 'expose_prey',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'crush'],
  canTrigger: (context, _actor, attack) =>
    attack.amount > 0 && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, EXPOSE_PREY, actor.id);
  },
});

/**
 * Frenzy: the PET gains attack speed after ITS OWN critical strike.
 *
 * ----------------------------------------------------------------------------
 * A REACTION THAT BELONGS TO SOMEBODY ELSE, which is what `petReaction` is
 * for. It is built from the HUNTER'S talent rank and carried by the PET: it
 * fires on the pet's crit and hastens the pet, and the Hunter is involved only
 * in having spent the points.
 *
 * AT 5/5 THE CHANCE IS 100%, so a Beast Mastery pet is hasted by 30% for eight
 * seconds after every crit it lands -- and it inherits the whole of the
 * Hunter's crit chance, so it crits often. This was inert until now and it is
 * the largest of the six pet talents that were.
 * ----------------------------------------------------------------------------
 */
export const frenzy: TalentReactionBuilder = (chancePercent) => ({
  id: 'frenzy',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, FRENZY, actor.id);
  },
});

export const HUNTER_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  deadly_aspects: deadlyAspects,
  expose_prey: exposePrey,
  frenzy,
};
