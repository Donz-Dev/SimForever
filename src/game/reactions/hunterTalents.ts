import type { AttackTableKind, AuraDefinition } from '../../engine';
import { flat, isWeaponUse, seconds } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import { DEADLY_ASPECTS, FRENZY, laceratingStrikesAura } from '../auras/hunter';

/**
 * Hunter talent procs.
 *
 * ----------------------------------------------------------------------------
 * FIVE NOW. Two ride on an auto-attack (Deadly Aspects, Expose Prey), one
 * belongs to the PET (Frenzy), and two are new: a bleed off Mongoose Bite and
 * a mana-regeneration window off any critical strike.
 *
 * Almost everything else reactive in this class belongs to the pet -- Ferocity,
 * Unleashed Fury -- and a talent effect reaches the character carrying it, not
 * a separate combatant. Those are `petStat` and `petReaction` rather than
 * anything here.
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
 *
 * ----------------------------------------------------------------------------
 * "ALL MELEE AUTO ATTACKS" MEANS BOTH HANDS, AND THIS CHECKED ONLY THE MAIN
 * ONE. That was invisible for as long as the melee Hunter held a two-hander --
 * a two-hander swings one slot, so `isWeaponUseOf(attack, 'mainHand')` and
 * "any melee swing" were the same test. The owner made that build a
 * dual-wielder and they stopped being the same: the off hand swings a
 * 1.30-second dagger, which is MORE swings than the main hand, and every one of
 * them was failing to roll for this proc.
 *
 * `isWeaponUse` is the engine's name for "a melee swing from either hand", and
 * it is what the tooltip says. The Hawk half stays slot-specific because "Auto
 * Shot" is one weapon by definition.
 *
 * This is the "when a rule is fixed for one slot, check its siblings" lesson
 * arriving from the other direction: nothing here was fixed, the CHARACTER
 * changed underneath a test that had been equivalent by accident.
 * ----------------------------------------------------------------------------
 */
export const deadlyAspects: TalentReactionBuilder = (chancePercent) => ({
  id: 'deadly_aspects',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'crush'],
  canTrigger: (context, actor, attack) => {
    if (attack.abilityId !== undefined) return false;

    /*
     * THE SLOT DIRECTLY, AND NOT `isWeaponUseOf`. That read
     * `isWeaponUse(attack) && slot === 'ranged'`, and `isWeaponUse` means "a use
     * of a MELEE weapon" -- so the whole expression was always false and this
     * half of the talent had never fired once. `isWeaponUseOf` no longer accepts
     * a ranged slot at all; see `MeleeWeaponSlot`.
     *
     * An auto-attack is already guaranteed by the `abilityId` check above, so
     * the slot is the whole of what is left to ask.
     */
    const hawk = actor.auras.has('aspect_of_the_hawk') && attack.weaponSlot === 'ranged';
    // EITHER HAND: "all melee auto attacks". See the header.
    const beast = actor.auras.has('aspect_of_the_beast') && isWeaponUse(attack);
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
 * Lacerating Strikes: "Your Mongoose Bite also causes the target to Bleed for
 * damage over 21 sec equal to 40% of the damage done by Mongoose Bite."
 *
 * ----------------------------------------------------------------------------
 * THE ONE REACTION HERE THAT READS `attack.amount`, and that is the whole
 * mechanism. Every other percentage-of-damage effect in this project is a share
 * of the WEAPON'S average damage, recomputed -- Deep Wounds is the model -- and
 * this one is a share of the hit that just landed, crit and armor included.
 * `AttackEvent.amount` is "what reached the defender", so there is nothing to
 * recompute and nothing to snapshot.
 *
 * ITS OLD `unmodelled` REASON WAS WRONG ON BOTH HALVES. It said the bleed was
 * expressible but that "Mongoose Bite fires only through Expose Prey here, so
 * it would be a fraction of a fraction". Mongoose Bite is 9.2% of the Lone Wolf
 * melee profile's damage -- Expose Prey procs on any landed attack and that
 * build swings a fast two-hander -- so the fraction was never small. The claim
 * was written down rather than measured, which is the shape CLAUDE.md warns
 * about twice.
 *
 * ONLY MONGOOSE BITE, by `abilityId`, and only when something landed: a bleed
 * worth 40% of zero is not a bleed, and applying one would overwrite a live
 * bleed from a hit that did connect.
 * ----------------------------------------------------------------------------
 */
export const laceratingStrikes: TalentReactionBuilder = (percentOfDamage) => ({
  id: 'lacerating_strikes',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (_context, _actor, attack) =>
    attack.abilityId === 'mongoose_bite' && attack.amount > 0,
  onTrigger: (context, actor, attack) => {
    context.applyAura(
      attack.defender,
      laceratingStrikesAura(attack.amount * (percentOfDamage / 100)),
      actor.id,
    );
  },
});

/**
 * Resourcefulness' second clause: "your critical strikes have a 60% chance to
 * allow 50% of your Mana regeneration to continue while casting for 30 sec."
 *
 * ----------------------------------------------------------------------------
 * `manaRegenBypass` IS EXACTLY THE STAT, and five classes already read it from
 * this wording -- the Mage's Arcane Meditation, the Priest's Meditation, the
 * Paladin's Reverence, the Druid's Reflection and this class's own Rapid
 * Recuperation. What none of those needed is the window: they grant it
 * permanently, and this one arrives on a proc and lasts 30 seconds.
 *
 * SO IT IS AN AURA CARRYING THE STAT, the shape the Mage's Mage Armor already
 * uses. The engine's rule is that the bypass is the fraction of regeneration
 * that survives the FIVE SECOND RULE, not literally a cast -- which is why this
 * is worth anything at all to a Hunter, whose casts are short and whose mana
 * spending is constant.
 *
 * THE VALUE IT IS BUILT FROM IS THE CHANCE. A reaction is handed one number,
 * and the other two do not move with rank: the values file reads [30,30,50,30]
 * at rank 1 and [60,60,50,30] at rank 2, so the 50% and the 30 seconds are
 * constants rather than a rank the builder could not reach. Nature's Grace sets
 * the same precedent on the Druid.
 *
 * ----------------------------------------------------------------------------
 * AND IT IS NO LONGER ANY CRITICAL STRIKE, WHICH THE PATCH NARROWED TWICE OVER.
 *
 * "Resourcefulness now correctly activates when landing a critical strike, but
 * it has been changed to only activating on melee and ranged ABILITY critical
 * strikes to prevent spamming. Is not activated by Traps."
 *
 * It used to fire on any crit with no test at all -- a Serpent Sting tick's
 * crit opened the window as readily as a Raptor Strike's, which is what the
 * note means by spamming.
 *
 * `melee-special` AND `ranged-special`, WHICH IS THE WORD "ABILITY" READ THE
 * WAY THIS PROJECT ALREADY READS IT. A tooltip saying "abilities" stops at the
 * special tables and a tooltip saying "weapons" reaches the swing, so an
 * AUTO-ATTACK crit no longer opens the window either -- which the note does not
 * name and which follows from the word it does use. Said out loud because a
 * Hunter's auto-shot is most of its crits, so this is the larger half of the
 * narrowing by some distance.
 *
 * AND THE TRAPS NEED THEIR OWN EXCLUSION, which is the part no table test
 * covers: both traps roll NO attack table -- they cannot miss -- and crit
 * through `critFrom: 'ranged-special'`. So a table check alone would have let
 * a trap's burn tick straight through the `ranged-special` arm, and the note
 * excludes them by name. `attackTable` is what separates the two: it is
 * undefined for a trap and set for a real ability, which is exactly the
 * distinction `AttackEvent.attackTable` exists to answer.
 *
 * NOT A LIST OF TRAP IDS, deliberately. An exclusion list fails the generous
 * way -- a trap missing from it fires when it should not, and a proc that
 * fires too often looks exactly like one that works -- and the owner's own
 * "like demoralizing shout" wording invited exactly that on Touch of the
 * Grave. Reading the table is structural and covers the next trap for free.
 * ----------------------------------------------------------------------------
 */
export const RESOURCEFULNESS_REGEN_BYPASS_PERCENT = 50;
export const RESOURCEFULNESS_REGEN_DURATION_MS = seconds(30);

export const RESOURCEFULNESS_REGEN: AuraDefinition = {
  id: 'resourcefulness_regen',
  name: 'Resourcefulness',
  durationMs: RESOURCEFULNESS_REGEN_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [flat('manaRegenBypass', RESOURCEFULNESS_REGEN_BYPASS_PERCENT)],
};

/**
 * The two tables "melee and ranged ABILITY critical strikes" names.
 *
 * `-special` ONLY. The `-auto` tables are the swing and the shot, which
 * "ability" excludes -- and `spell` is not a Hunter concern but is excluded by
 * the same list rather than by an assumption about the class.
 */
const RESOURCEFULNESS_TABLES: readonly AttackTableKind[] = ['melee-special', 'ranged-special'];

export const resourcefulness: TalentReactionBuilder = (chancePercent) => ({
  id: 'resourcefulness',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (context, _actor, attack) =>
    /*
     * THE TABLE THE ATTACK ACTUALLY ROLLED, which is the only thing on the
     * event that can answer this. A trap declares NO table and crits through
     * `critFrom`, so an undefined table is excluded here by construction --
     * which is both halves of the note at once: abilities only, and not traps.
     */
    attack.attackTable !== undefined &&
    RESOURCEFULNESS_TABLES.includes(attack.attackTable) &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, RESOURCEFULNESS_REGEN, actor.id);
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
  lacerating_strikes: laceratingStrikes,
  resourcefulness,
};
