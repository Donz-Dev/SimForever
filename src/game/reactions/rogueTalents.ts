import type { AbilityCastEvent, CastReaction, Reaction } from '../../engine';
import { isWeaponUse } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import { CUTTHROAT } from '../auras/rogue';
import { awardComboPoint } from '../combat/comboPoints';

/**
 * Rogue talent procs.
 *
 * ----------------------------------------------------------------------------
 * FOUR TALENTS THAT NEEDED A NEW HOOK, and they are why `castReaction` exists.
 *
 * Three of them pay out WHEN A FINISHER IS USED, and a finisher spends its
 * combo points inside its own `onCast` -- so neither the cost system nor a
 * damage reaction can see what happened. The engine now snapshots every pool
 * around a cast and reports the difference, which answers "how many combo
 * points did that spend" without any ability announcing anything.
 *
 * The fourth, Seal Fate, is an ordinary damage reaction that needed one new
 * fact: whether the ability that critted awards combo points. That is declared
 * on the ability rather than inferred, because a reaction sees an id and
 * nothing else.
 *
 * IT WAS NOT COSMETIC. With Relentless Strikes absent the Rogue could not
 * afford its own finisher: Slice and Dice consumed the whole combo point
 * budget and Eviscerate fired zero times at any threshold. See the measurements
 * in `rotations/rogue.ts`.
 * ----------------------------------------------------------------------------
 */

/** A cast that spent combo points is a finisher. Nothing else spends them. */
function comboPointsSpent(cast: AbilityCastEvent): number {
  return cast.spent.comboPoints ?? 0;
}

/**
 * Relentless Strikes: "a 20% chance per Combo Point to restore 25 Energy".
 *
 * ROLLED PER POINT, not once at a scaled chance. Five points is five 20% rolls
 * and can return anything from nothing to 125 energy, which is a different
 * distribution from one roll at 100% -- and the source says "per Combo Point".
 */
export const RELENTLESS_STRIKES_ENERGY = 25;

export const relentlessStrikes = (chancePerPoint: number): CastReaction => ({
  id: 'relentless_strikes',
  canTrigger: (_context, _actor, cast) => comboPointsSpent(cast) > 0,
  onTrigger: (context, actor, cast) => {
    const points = comboPointsSpent(cast);
    for (let i = 0; i < points; i += 1) {
      if (!context.rng.rollChance(chancePerPoint / 100)) continue;
      context.grantResource(actor, 'energy', RELENTLESS_STRIKES_ENERGY, {
        id: 'relentless_strikes',
        name: 'Relentless Strikes',
      });
    }
  },
});

/**
 * Ruthlessness: "gives your finishing moves a 60% chance to add a Combo Point".
 *
 * ONE ROLL FOR THE WHOLE FINISHER, unlike Relentless Strikes: the source says
 * "a 60% chance" rather than a chance per point.
 *
 * The point is granted AFTER the finisher has already drained the bar, so it
 * lands on an empty one and starts the next cycle rather than being consumed
 * by the cast that produced it.
 */
export const ruthlessness = (chancePercent: number): CastReaction => ({
  id: 'ruthlessness',
  canTrigger: (context, _actor, cast) =>
    comboPointsSpent(cast) > 0 && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'comboPoints', 1, {
      id: 'ruthlessness',
      name: 'Ruthlessness',
    });
  },
});

/**
 * Improved Expose Armor: "refunds 2 Combo Points when cast with 5 Combo Points".
 *
 * The refund is FIXED at two and does not scale with rank -- the rank scales
 * the energy reduction, which is a separate effect on the same talent. Bound to
 * the one ability by `abilityId`, so it cannot fire off another finisher.
 */
export const IMPROVED_EXPOSE_ARMOR_REFUND = 2;

export const improvedExposeArmor = (): CastReaction => ({
  id: 'improved_expose_armor',
  abilityId: 'expose_armor',
  canTrigger: (_context, _actor, cast) => comboPointsSpent(cast) >= 5,
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'comboPoints', IMPROVED_EXPOSE_ARMOR_REFUND, {
      id: 'improved_expose_armor',
      name: 'Improved Expose Armor',
    });
  },
});

/**
 * Seal Fate: "your critical strikes from abilities that add Combo Points have a
 * chance to add an additional Combo Point".
 *
 * AN ORDINARY DAMAGE REACTION, because a crit IS a damage event -- this one
 * needed no new hook, only a new fact. `Ability.comboPointsAwarded` is how an
 * ability says it builds, and the reaction reads it from the caster's own book
 * rather than carrying a list of ability ids that would drift from the
 * abilities themselves.
 */
export const sealFate = (chancePercent: number): Reaction => ({
  id: 'seal_fate',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (context, actor, attack) => {
    if (!attack.abilityId) return false;
    const ability = actor.abilities.get(attack.abilityId);
    if (!ability?.comboPointsAwarded) return false;
    return context.rng.rollChance(chancePercent / 100);
  },
  onTrigger: (context, actor, attack) => {
    awardComboPoint(context, actor, attack.defender, 'seal_fate', 'Seal Fate');
  },
});

/** Procs that fire on a cast, by the talent that grants them. */
export const ROGUE_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {
  relentless_strikes: relentlessStrikes,
  ruthlessness,
  improved_expose_armor: improvedExposeArmor,
};

/**
 * Cutthroat: "Your Backstab has a {0}% chance to cause your next Ambush within
 * 10 sec to not require Stealth."
 *
 * ----------------------------------------------------------------------------
 * AN ORDINARY DAMAGE REACTION ON ONE ABILITY, which is all it ever needed. The
 * talent was recorded as inert alongside the ten Rogue talents that genuinely
 * are -- every fight here opens in combat, so nothing is ever stealthed -- and
 * this one is the exception in the same list: it exists to remove the stealth
 * requirement, so a fight that is never stealthed is the case it was written
 * for rather than the case that kills it.
 *
 * ON A HIT OR A CRIT, and not on an avoided Backstab: the tooltip says "your
 * Backstab has a chance", and a Backstab that was dodged is not one that
 * happened. Same reading Improved Scorch takes.
 * ----------------------------------------------------------------------------
 */
export const cutthroat = (chancePercent: number): Reaction => ({
  id: 'cutthroat',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId === 'backstab' && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, CUTTHROAT, actor.id);
  },
});

/**
 * Puncturing Wounds' third clause: "gives Backstab a 45% chance to add an
 * additional Combo Point."
 *
 * ----------------------------------------------------------------------------
 * THE THIRD OF THREE CLAUSES ON ONE TALENT, and the two crit clauses beside it
 * are `abilityCrit` entries reading different value slots. This one is a proc
 * and cannot be, which is why the talent has three effects rather than one.
 *
 * AN ADDITIONAL POINT, so it stacks on top of the one Backstab already awarded
 * in its own `onCast` -- a proc'd Backstab is worth two. It goes through
 * `awardComboPoint` rather than `grantResource` so the target is set: a point
 * written straight into the pool leaves `comboPointTargetId` pointing at
 * nobody, and every finisher then refuses to spend.
 *
 * ON A HIT OR A CRIT ONLY. A dodged Backstab awards nothing through the
 * ability's own path either, and "gives Backstab a chance" is a claim about a
 * Backstab that happened.
 * ----------------------------------------------------------------------------
 */
export const puncturingWounds = (chancePercent: number): Reaction => ({
  id: 'puncturing_wounds',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId === 'backstab' && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor, attack) => {
    awardComboPoint(context, actor, attack.defender, 'puncturing_wounds', 'Puncturing Wounds');
  },
});

/**
 * Initiative: "Gives you a {0}% chance to add an additional combo point to your
 * target when using your Ambush, Garrote, or Cheap Shot ability." 33/67/100.
 *
 * ----------------------------------------------------------------------------
 * PUNCTURING WOUNDS' THIRD CLAUSE WITH A DIFFERENT ABILITY ID, which is the
 * whole of it -- an additional point on one named ability, rolled per use. It
 * had been `unmodelled` with a `stealth` scope since the class was written, on
 * a reason that said its abilities were absent; Ambush has been declared and
 * cast since the owner's Cutthroat ruling, so one of the three is present and
 * this is the half that was never re-read.
 *
 * AT 3/3 IT IS 100% AND THEREFORE NOT A CHANCE AT ALL. Every Subtlety build
 * takes three ranks, so an Ambush is worth TWO combo points there -- one from
 * the ability's own `onCast` and one from here. `rollChance(1)` is still the
 * path taken rather than special-cased, because ranks 1 and 2 are real and a
 * branch would be two behaviours to keep in step.
 *
 * ON A HIT OR A CRIT, MATCHING AMBUSH'S OWN AWARD. Ambush awards its point only
 * when the attack is not avoided, and a talent adding "an additional" point to
 * the same use follows the same rule -- a dodged Ambush that awarded one point
 * from a talent and none from itself would be a strange shape. `canTrigger`
 * also consumes no random number on an avoided Ambush, so a seeded run is
 * unaffected by whether the roll happens.
 *
 * GARROTE AND CHEAP SHOT ARE OUT OF SCOPE for good, so there is nothing here
 * to extend to them; the talent carries that half as a scoped `unmodelled`.
 * ----------------------------------------------------------------------------
 */
export const initiative = (chancePercent: number): Reaction => ({
  id: 'initiative',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId === 'ambush' && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor, attack) => {
    awardComboPoint(context, actor, attack.defender, 'initiative', 'Initiative');
  },
});

/**
 * Hack and Slash's Axe/Sword clause: "your successful melee attacks have a 5%
 * chance to trigger an extra attack on the target."
 *
 * ----------------------------------------------------------------------------
 * THE WARRIOR'S SWORD SPECIALIZATION, WORD FOR WORD, and it is registered the
 * same way for the same two reasons.
 *
 * GATED ON THE WEAPON THAT SWUNG, not on the main hand: a Rogue holding a sword
 * and a dagger gets this from the sword hand only, and gets it from either
 * hand. Reading `mainHand` would give a main-hand dagger the sword's proc and
 * deny it to the sword entirely. That is why this clause does NOT use the
 * talent effect's `requires` gate the other two clauses do -- that gate is
 * main-hand-only by design, which is right for a whole-character stat and
 * wrong for a per-swing proc.
 *
 * AND THE EXTRA ATTACK IS ALWAYS THE MAIN HAND, whichever hand procced it --
 * the ruleset owner's ruling, already shared by Hand of Justice and Sword
 * Specialization. An extra attack in this engine means a main-hand swing.
 *
 * `isWeaponUse` AND NOT ONLY A SWING: "your melee weapon attacks" covers an
 * ability that needed the weapon as well as the swing itself, which is the
 * standing reading of a weapon proc here.
 * ----------------------------------------------------------------------------
 */
export const HACK_AND_SLASH_WEAPONS: ReadonlySet<string> = new Set(['sword', 'axe']);

export const hackAndSlash = (chancePercent: number): Reaction => ({
  id: 'hack_and_slash',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance'],
  canTrigger: (context, actor, attack) => {
    if (!isWeaponUse(attack)) return false;
    const weapon = attack.weaponSlot ? actor.weapons[attack.weaponSlot] : undefined;
    if (!weapon || !HACK_AND_SLASH_WEAPONS.has(weapon.weaponType ?? '')) return false;
    return context.rng.rollChance(chancePercent / 100);
  },
  onTrigger: (context, actor) => {
    context.extraAttack(actor, 'mainHand');
  },
});

/** Procs that fire on an attack, by the talent that grants them. */
export const ROGUE_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  seal_fate: sealFate,
  cutthroat,
  initiative,
  puncturing_wounds: puncturingWounds,
  hack_and_slash: hackAndSlash,
};
