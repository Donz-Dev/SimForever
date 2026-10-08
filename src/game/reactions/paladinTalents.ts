import type { Reaction } from '../../engine';
import { dealDamage } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import {
  HOLY_SHIELD_DAMAGE,
  SHIELD_SPECIALIZATION_USED,
  VINDICATION_CHANCE,
  redoubtAura,
  vengeanceAura,
  vindicationDebuff,
  vindicationSelfAura,
} from '../auras/paladin';

/**
 * Paladin talent procs.
 *
 * ----------------------------------------------------------------------------
 * A BLOCK IS AN OUTCOME A REACTION CAN SEE, AND THIS FILE SAID IT WAS NOT.
 *
 * The header here used to open with "A BLOCK IS NOT AN OUTCOME A REACTION CAN
 * SEE, and it costs this class two clauses", and reasoned that Forever's block
 * LANDS and is reduced by a flat amount in the damage pipeline "rather than being
 * rolled as a table result -- which is the right model and is why `AttackOutcome`
 * has no `block` for `melee-received` to produce". Half of that is true and the
 * conclusion is false:
 *
 *   TRUE       a block is not an AVOIDED outcome, and its reduction is a flat
 *              amount applied in the damage pipeline rather than a table
 *              multiplier. That flatness is the character of the stat.
 *   FALSE      that `melee-received` cannot produce `block`. `TABLES` has listed
 *              it in that table's first roll since the table was written, and the
 *              Warrior's own Shield Specialization, Revenge, Enrage and Blood
 *              Craze all name `block` in their `outcomes` and all fire.
 *
 * SO HOLY SHIELD'S 221 HOLY DAMAGE PER BLOCK AND RECKONING'S BLOCK HALF BOTH
 * WORK NOW, and they were never blocked by the engine. The false half of the
 * rule reached CLAUDE.md, the `Reaction.outcomes` doc comment and the Paladin
 * deep-dive brief, and cost the Protection profile a damage source and its
 * largest talent half. A claim about the engine expires; this one was never true.
 *
 * ONE ORDERING DID HAVE TO CHANGE, and it is a real bug the same clause found: a
 * block's CHARGE used to be spent before the reactions ran, so Holy Shield's
 * fourth and last block dropped the aura before its own reaction could see it.
 * `dealDamage` now spends the charge last.
 *
 * TWO OF THESE NEED THE TARGET TO SWING BACK, which makes this the second class
 * after the Warrior where a tree's reactive half is live for one profile and
 * inert for the others.
 * ----------------------------------------------------------------------------
 */

/** Every outcome where the attack LANDED, block included. */
const LANDED = ['hit', 'crit', 'glance', 'crush', 'block'] as const;

/**
 * Vengeance: a non-periodic critical strike raises Physical and Holy damage,
 * stacking.
 *
 * ANY CRIT, not only a melee one. "After landing a critical strike" names no
 * school and no weapon, so a Judgement crit arms it exactly as a swing does --
 * which matters for a Retribution paladin judging every ten seconds.
 *
 * "NON-PERIODIC" ARRIVED AT CLIENT BUILD 1.60.1.70170 AND NEEDS NO CONDITION.
 * `dealDamage` offers an attack to a reaction only when
 * `request.attackTable && !request.periodic`, so a tick is never shown to one --
 * the same guarantee Nature's Grace and Blood Frenzy's combo point clause rely
 * on. The tooltip got narrower and the behaviour did not change, which is worth
 * writing down: otherwise the next reader looks for the condition and adds one.
 *
 * ITS STACK CAP WENT 5 TO 3 IN THE SAME PATCH, which is where the figure moved.
 * See `VENGEANCE_MAX_STACKS`.
 */
export const vengeance: TalentReactionBuilder = (percentPerStack) => ({
  id: 'vengeance',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => attack.amount > 0,
  onTrigger: (context, actor) => {
    context.applyAura(actor, vengeanceAura(percentPerStack), actor.id);
  },
});

/**
 * Redoubt: a damaging melee attack against the Paladin may raise block chance.
 *
 * ----------------------------------------------------------------------------
 * ITS CHANCE IS THE SAME AT EVERY RANK AND ONLY THE BONUS MOVES. The values
 * are [10, 6], [10, 12], [10, 18], [10, 24], [10, 30] -- ten percent
 * throughout, with the block bonus stepping by six.
 *
 * So this builder takes the BLOCK BONUS, not the chance, and the effect table
 * passes `valueIndex: 1` to make that happen. A builder handed index 0 would
 * receive 10 at every rank and grant a +10% block bonus from a 10% chance --
 * a third of the talent at rank 5, identical at every rank, and completely
 * silent. The chance is the constant below.
 *
 * A BLOCKED BLOW IS A DAMAGING ONE. "Damaging melee attacks against you" is
 * every attack that landed, and a block lands -- so `block` belongs in the
 * outcomes beside hit and crush. It was missing for as long as this file
 * believed a reaction could not see one, which made Redoubt slightly less
 * likely to renew itself off exactly the attacks it exists to answer.
 * ----------------------------------------------------------------------------
 */
export const REDOUBT_PROC_CHANCE = 10;

export const redoubt: TalentReactionBuilder = (blockChanceBonus) => ({
  id: 'redoubt',
  on: 'taken',
  // A damaging attack: one that landed. Avoided attacks deal nothing.
  outcomes: [...LANDED],
  canTrigger: (context, _actor, attack) =>
    attack.amount > 0 && context.rng.rollChance(REDOUBT_PROC_CHANCE / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, redoubtAura(blockChanceBonus), actor.id);
  },
});

/**
 * Reckoning: an extra attack after blocking, and after being critically hit.
 *
 * ----------------------------------------------------------------------------
 * BOTH HALVES NOW. The block half was written off against a rule that was not
 * real -- see the header -- and the reason on the talent said so for as long as
 * it stood. Nothing in the engine had to change for it: `melee-received` rolls
 * `block`, and a reaction naming it fires.
 *
 * TWO CHANCES, ONE REACTION, because it is one talent and both clauses do the
 * same thing. Which chance applies is decided by the OUTCOME: 40% at rank 5
 * after a block, 100% after a non-periodic critical strike. Rolling one chance
 * for both would be wrong in whichever direction the shared number was.
 *
 * AN EXTRA ATTACK, the same machinery Hand of Justice and Windfury use, with
 * the same invariant: `scheduleSwing` keeps at most one pending swing per
 * slot, so this cannot fork the chain.
 *
 * "NON-PERIODIC" IS FREE. `dealDamage` never offers a periodic tick to a
 * reaction at all, so the qualifier is already enforced one layer down.
 * ----------------------------------------------------------------------------
 */
export const reckoning: TalentReactionBuilder = (blockChancePercent) => ({
  id: 'reckoning',
  on: 'taken',
  outcomes: ['crit', 'block'],
  canTrigger: (context, _actor, attack) => {
    if (attack.amount <= 0) return false;
    /*
     * THE TALENT'S FIRST VALUE IS THE BLOCK CHANCE AND ITS SECOND IS THE CRIT
     * CHANCE -- [8, 20] through [40, 100]. The builder receives the first,
     * because that is the one `valueIndex` defaults to and the one this clause
     * needs; the crit chance is the named constant below, which is 100 at the
     * only rank any profile takes.
     */
    const chance = attack.outcome === 'block' ? blockChancePercent : RECKONING_CRIT_CHANCE;
    return context.rng.rollChance(chance / 100);
  },
  onTrigger: (context, actor) => {
    context.extraAttack(actor, 'mainHand');
  },
});

/**
 * Reckoning's crit chance, which the Protection build takes at 5/5.
 *
 * Named rather than threaded through the builder because the builder's one
 * argument is already spoken for by the block chance, and the Protection
 * profile is the only one that takes the talent at all -- at full rank, where
 * this is 100.
 */
export const RECKONING_CRIT_CHANCE = 100;

/**
 * Holy Shield: "deals 221 Holy damage for each attack blocked while active."
 *
 * ----------------------------------------------------------------------------
 * 221, NOT 110. The talent tooltip says 110 and the spellbook capture says 221,
 * and they do not disagree: a talent tooltip shows RANK 1 of the ability it
 * grants, and Holy Shield is rank 3 at level 60. That rule has explained every
 * apparent disagreement of this kind in the project.
 *
 * FOUR BLOCKS OR TEN SECONDS, WHICHEVER ENDS FIRST, and the aura already says
 * so with `chargesOnApply` and `consumedByBlock`. This reaction only has to ask
 * whether the aura is up -- which is exactly why the charge has to be spent
 * AFTER the reactions run, or the fourth and last block of every cast would
 * find the aura already gone and deal nothing.
 *
 * NOT A WEAPON USE AND NO `weaponSlot`, the same as a seal hit: this is Holy
 * damage the shield deals for having blocked, not a swing, so it cannot proc a
 * Crusader or a Hand of Justice. It carries no `attackTable` either, so it does
 * not roll to hit -- the block that caused it already happened.
 *
 * ITS "+20% additional threat" IS THREAT, which is permanently out of scope.
 * ----------------------------------------------------------------------------
 */
export function holyShieldBlockDamage(): Reaction {
  return {
    id: 'holy_shield',
    on: 'taken',
    outcomes: ['block'],
    canTrigger: (_context, actor) => actor.auras.has('holy_shield'),
    onTrigger: (context, actor, attack) => {
      dealDamage(context, {
        source: actor,
        target: attack.attacker,
        abilityId: 'holy_shield',
        abilityName: 'Holy Shield',
        school: 'holy',
        baseAmount: HOLY_SHIELD_DAMAGE,
        /*
         * NO COEFFICIENT. The sheet gives Holy Shield no row, and this project
         * does not derive one -- a flat figure with no stated scaling stays
         * flat rather than inheriting a plausible share of spell power.
         */
        powerCoefficient: 0,
        appliesArmor: false,
      });
    },
  };
}

/**
 * Shield Specialization's mana clause: "gives your blocks a 100% chance to
 * restore 6% of your maximum Mana. May only occur once every 3 sec."
 *
 * ----------------------------------------------------------------------------
 * THE BUILDER TAKES THE CHANCE, which is the only one of the four values that
 * moves with rank: [10, 33, 6, 3] through [30, 100, 6, 3]. The absorb bonus is
 * index 0 and is a `stat` effect on block value; the mana share and the internal
 * cooldown are index 2 and 3 and are the same at every rank, so they are the
 * constants here.
 *
 * ITS INTERNAL COOLDOWN IS AN AURA. A closure variable would be per BUILD rather
 * than per character, and a `TalentBuild` is a value a Monte Carlo batch can
 * reuse -- which is exactly how one shared closure silently stopped Windfury
 * proccing after the first iteration of a batch. An aura is per character by
 * construction and shows in the log when the window is shut.
 * ----------------------------------------------------------------------------
 */
export const SHIELD_SPECIALIZATION_MANA_PERCENT = 6;

export const shieldSpecialization: TalentReactionBuilder = (chancePercent) => ({
  id: 'shield_specialization',
  on: 'taken',
  outcomes: ['block'],
  canTrigger: (context, actor) =>
    !actor.auras.has('shield_specialization_used') &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, SHIELD_SPECIALIZATION_USED, actor.id);
    context.grantResource(
      actor,
      'mana',
      ((actor.resources.get('mana')?.maximum ?? 0) * SHIELD_SPECIALIZATION_MANA_PERCENT) / 100,
      { id: 'shield_specialization', name: 'Shield Specialization' },
    );
  },
});

/**
 * Eye for an Eye: "All critical strikes against you cause 10% of the damage
 * taken to the attacker as well. The damage caused by Eye for an Eye will not
 * exceed 50% of the Paladin's total health."
 *
 * ----------------------------------------------------------------------------
 * INERT FOR THE BUILD, NOT FOR THE ENGINE, and the distinction is the whole
 * point of writing it. Only the Protection profile is attacked and Protection
 * does not take this -- so it is the third cause of inert, which expires the day
 * a profile spends a point on it rather than the day the engine grows something.
 *
 * ITS CAP IS THE SECOND VALUE AND IS 50 AT BOTH RANKS, so it is the constant
 * below and the builder takes the share. A boss crit for six thousand against a
 * Paladin with five thousand health is what the cap is for, and it binds.
 *
 * NOT A WEAPON USE, like every other reflected or seal-carried hit here.
 * ----------------------------------------------------------------------------
 */
export const EYE_FOR_AN_EYE_HEALTH_CAP_PERCENT = 50;

export const eyeForAnEye: TalentReactionBuilder = (sharePercent) => ({
  id: 'eye_for_an_eye',
  on: 'taken',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => attack.amount > 0,
  onTrigger: (context, actor, attack) => {
    const cap = (actor.health.maximum * EYE_FOR_AN_EYE_HEALTH_CAP_PERCENT) / 100;
    const amount = Math.min(cap, (attack.amount * sharePercent) / 100);
    if (amount <= 0) return;
    dealDamage(context, {
      source: actor,
      target: attack.attacker,
      abilityId: 'eye_for_an_eye',
      abilityName: 'Eye for an Eye',
      school: 'holy',
      baseAmount: amount,
      powerCoefficient: 0,
      appliesArmor: false,
    });
  },
});

/**
 * Vindication: "Gives your damaging melee attacks a chance to reduce the
 * target's Attack Power by 200, and increase your Attack Power by 3% for 30
 * sec."
 *
 * ----------------------------------------------------------------------------
 * ITS CHANCE IS 10%, AND THAT IS THE RULESET OWNER'S ANSWER RATHER THAN A
 * PLACEHOLDER. Nothing in the client data states a rate -- the values file gives
 * the attack power taken, the attack power gained and the duration -- so the
 * talent was left inert rather than handed an invented one. Asking settled it in
 * one message, which is the lesson this project has now learned six times: check
 * whether a missing number is missing DATA or a missing RULING.
 *
 * THE BUILDER TAKES THE ATTACK POWER IT GAINS, index 1, because that is the half
 * that does anything. Index 0 -- the 200 it strips -- is applied too and reaches
 * nothing: the training dummy's damage is a flat placeholder that reads no attack
 * power. Modelled anyway, because a debuff carrying a stat modifier costs nothing
 * and the day the encounter grows an attack power it is already right.
 * ----------------------------------------------------------------------------
 */
export const VINDICATION_ATTACK_POWER_TAKEN = 200;

export const vindication: TalentReactionBuilder = (attackPowerPercent) => ({
  id: 'vindication',
  on: 'dealt',
  // "Damaging melee attacks", which is every melee outcome that landed.
  outcomes: [...LANDED],
  canTrigger: (context, _actor, attack) =>
    attack.amount > 0 &&
    attack.weaponSlot !== undefined &&
    attack.weaponSlot !== 'ranged' &&
    context.rng.rollChance(VINDICATION_CHANCE / 100),
  onTrigger: (context, actor, attack) => {
    context.applyAura(actor, vindicationSelfAura(attackPowerPercent), actor.id);
    context.applyAura(
      attack.defender,
      vindicationDebuff(VINDICATION_ATTACK_POWER_TAKEN),
      actor.id,
    );
  },
});

export const PALADIN_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  vengeance,
  redoubt,
  reckoning,
  shield_specialization: shieldSpecialization,
  eye_for_an_eye: eyeForAnEye,
  vindication,
  // Holy Shield takes no value: its 221 is the ability's, not the talent's.
  holy_shield: () => holyShieldBlockDamage(),
};
