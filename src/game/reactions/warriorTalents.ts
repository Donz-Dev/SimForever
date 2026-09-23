import type { Reaction } from '../../engine';
import { isWeaponUse } from '../../engine';
import { ENRAGE_TRIGGER_CHANCE, OVERPOWER_READY, REND, enrageAura } from '../auras/warrior';
import {
  FLURRY_SWINGS,
  bloodCrazeAura,
  deepWoundsAura,
  flurryAura,
} from '../auras/warriorTalents';

/**
 * Reactions a Warrior talent grants.
 *
 * Built per character, from the rank taken, because the numbers come from the
 * values file. `reactionsForClass` returns the ones every warrior has; these
 * are added on top by `talentBuild`.
 *
 * Each builder takes the talent's value at the character's rank. A talent with
 * no captured value never reaches here — `talentBuild` reports it as unmodelled
 * instead, so a missing number can never quietly become a zero-strength proc.
 */
export type TalentReactionBuilder = (value: number) => Reaction;

/** Only melee swings and melee specials carry a weapon slot. */
/*
 * `isWeaponUse` REPLACED A PRIVATE COPY OF THIS TEST. It used to be a
 * one-liner here, and the proc reactions in `items/procs.ts` and
 * `buffs/windfury.ts` re-derived the same idea in their own files -- two of
 * them wrongly. It is one function in the engine now, and its doc comment
 * carries the ruleset: a "use" of a weapon is a swing OR an ability that
 * needs that weapon.
 */

/**
 * Deep Wounds: a critical strike applies a bleed.
 *
 * INTERPRETATION: "your critical strikes" is read as MELEE critical strikes,
 * which is what a warrior has. The check is on the weapon slot rather than on
 * the ability, so a crit from any melee source — a swing, Mortal Strike,
 * Overpower — applies it, and a hypothetical non-weapon crit does not.
 */
export const deepWounds: TalentReactionBuilder = (percentOfWeaponDamage) => ({
  id: 'deep_wounds',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => isWeaponUse(attack),
  onTrigger: (context, actor, attack) => {
    context.applyAura(attack.defender, deepWoundsAura(percentOfWeaponDamage), actor.id);
  },
});

/**
 * Flurry: a melee critical strike hastens the next few swings.
 *
 * Applied at full stacks every time, because the source says "your next 3
 * swings" rather than "up to 3": a second crit refreshes the window rather than
 * extending a partly-spent one.
 */
export const flurry: TalentReactionBuilder = (hastePercent) => ({
  id: 'flurry',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => isWeaponUse(attack),
  onTrigger: (context, actor) => {
    // Applied at full charges every time: the source says "your next 3 swings",
    // so a second crit refreshes the window rather than topping up a spent one.
    const instance = context.applyAura(actor, flurryAura(hastePercent), actor.id);
    instance.stacks = FLURRY_SWINGS;
  },
});

/** Rage a proc of Unbridled Wrath grants, by whether the weapon is two-handed. */
export const UNBRIDLED_WRATH_RAGE = { oneHanded: 1, twoHanded: 2 } as const;

/**
 * Unbridled Wrath: a chance at extra rage when a melee weapon deals damage.
 *
 * "This effect is increased to 2 Rage for two-handed weapons", so the amount is
 * decided by the weapon that SWUNG rather than by the character -- a warrior
 * cannot hold a two-hander and an off-hand at once, but reading the slot keeps
 * it right whatever is equipped.
 */
export const unbridledWrath: TalentReactionBuilder = (chancePercent) => ({
  id: 'unbridled_wrath',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance'],
  canTrigger: (context, _actor, attack) =>
    isWeaponUse(attack) && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor, attack) => {
    const weapon = attack.weaponSlot ? actor.weapons[attack.weaponSlot] : undefined;
    context.grantResource(
      actor,
      'rage',
      weapon?.twoHanded ? UNBRIDLED_WRATH_RAGE.twoHanded : UNBRIDLED_WRATH_RAGE.oneHanded,
      { id: 'unbridled_wrath', name: 'Unbridled Wrath' },
    );
  },
});

/**
 * Bloodthrill: melee attacks against a target bleeding from your Rend have a
 * chance to open the Overpower window.
 *
 * Reuses OVERPOWER_READY, the same aura a dodge applies, so Overpower's
 * `canCast` needs no second condition and the window behaves identically
 * however it was opened.
 */
export const bloodthrill: TalentReactionBuilder = (chancePercent) => ({
  id: 'bloodthrill',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance'],
  canTrigger: (context, _actor, attack) =>
    isWeaponUse(attack) &&
    attack.defender.auras.has(REND.id) &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, OVERPOWER_READY, actor.id);
  },
});

/** Rage a Shield Specialization proc grants. Stated by the source. */
export const SHIELD_SPECIALIZATION_RAGE = 5;

/**
 * Shield Specialization: a chance at rage when the warrior BLOCKS.
 *
 * Fires on attacks RECEIVED, so it needs something to be attacking the player.
 * Nothing does yet, which is why the talent carries an `unmodelled` note
 * alongside this saying so -- the proc is right and simply never gets a chance
 * to run.
 */
export const shieldSpecialization: TalentReactionBuilder = (chancePercent) => ({
  id: 'shield_specialization',
  on: 'taken',
  outcomes: ['block'],
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'rage', SHIELD_SPECIALIZATION_RAGE, {
      id: 'shield_specialization',
      name: 'Shield Specialization',
    });
  },
});

/** Rage a Master of Defense proc grants. Stated by the source. */
export const MASTER_OF_DEFENSE_RAGE = 5;

/**
 * Master of Defense: a chance at rage when the warrior DODGES or PARRIES.
 *
 * The same shape as Shield Specialization one outcome over. Both fire on
 * attacks RECEIVED, so both need something to be attacking the player --
 * `encounter.targetAttacks`, which is off by default. That is an encounter
 * setting and not a gap in the model, so neither carries an unmodelled note.
 *
 * "While a shield is equipped" is NOT expressed here. A reaction has no view of
 * the actor's gear, and the talent sits at tier 10 of Protection where a
 * shield is the point. Overstates it for a Protection warrior who dual-wields,
 * which is not a build anyone makes.
 */
export const masterOfDefense: TalentReactionBuilder = (chancePercent) => ({
  id: 'master_of_defense',
  on: 'taken',
  outcomes: ['dodge', 'parry'],
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'rage', MASTER_OF_DEFENSE_RAGE, {
      id: 'master_of_defense',
      name: 'Master of Defense',
    });
  },
});

/**
 * Enrage: a chance at increased physical damage after BEING HIT.
 *
 * The 30% trigger chance is fixed and the damage bonus is what ranks up, so
 * unlike every other builder here the rank value is the AURA's magnitude rather
 * than the proc chance.
 */
export const enrage: TalentReactionBuilder = (damageBonusPercent) => ({
  id: 'enrage',
  on: 'taken',
  // Any landed attack. A miss, dodge or parry is not "being the victim of a
  // damaging attack", so the avoided outcomes are deliberately absent.
  outcomes: ['hit', 'crit', 'crush', 'glance', 'block'],
  canTrigger: (context) => context.rng.rollChance(ENRAGE_TRIGGER_CHANCE / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, enrageAura(damageBonusPercent), actor.id);
  },
});

/**
 * Weaponmaster's SWORD clause: a chance at an extra attack.
 *
 * Its third value, hence `valueIndex: 2` where the talent declares it. The
 * other two clauses -- crit with an axe or polearm, armor penetration with a
 * mace or staff -- are a stat and an armor-ignoring modifier rather than a
 * reaction, and are still unmodelled. The talent says so.
 *
 * GATED ON THE SWORD, per swinging weapon. An older version of this comment
 * said the opposite -- "a reaction cannot see the weapon" -- and it was wrong
 * about the code directly below it, which has read `actor.weapons[slot]`
 * since it was written. The gate is verified by the matrix in
 * `tests/game/armsTalentAudit.test.ts`.
 *
 * IN PRACTICE IT NEVER REFUSES, because every weapon in
 * `data/items/classic-warrior.json` is a Sword. The gate is right and
 * currently unreachable; the day an axe or a mace is added, it starts
 * mattering and the axe/polearm crit clause starts firing too.
 */
export const weaponmasterSword: TalentReactionBuilder = (chancePercent) => ({
  id: 'weaponmaster_sword',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance'],
  canTrigger: (context, actor, attack) => {
    /*
     * GATED ON THE WEAPON THAT SWUNG, not on the main hand.
     *
     * A warrior holding a mace and a sword gets this from the sword only, and
     * gets it from the off hand -- so the check reads the slot the attack came
     * from rather than asking what the character is "wielding". Reading the
     * main hand would give a main-hand mace the sword's proc and deny it to
     * the sword entirely, which is exactly backwards.
     */
    if (!isWeaponUse(attack)) return false;
    const weapon = attack.weaponSlot ? actor.weapons[attack.weaponSlot] : undefined;
    if (weapon?.weaponType !== 'sword') return false;
    return context.rng.rollChance(chancePercent / 100);
  },
  onTrigger: (context, actor) => {
    /*
     * THE EXTRA ATTACK IS ALWAYS THE MAIN HAND, whichever hand procced it.
     *
     * Stated by the ruleset owner, and it matters for a mace/sword pairing:
     * an off-hand sword's proc swings the main-hand mace. Hand of Justice
     * already does this, and the two now agree -- an extra attack in this
     * engine means a main-hand swing.
     */
    context.extraAttack(actor, 'mainHand');
  },
});

/**
 * The share of maximum health a single blow must exceed to set off Blood
 * Craze's third clause. The source's own figure.
 */
export const BLOOD_CRAZE_BIG_HIT_FRACTION = 0.2;

/**
 * Blood Craze, the two clauses that fire off being HURT.
 *
 * "after being the victim of a critical strike ... or suffering more than 20%
 * of your maximum Health from a single attack". One reaction rather than two,
 * because both watch the same side of the same event and either one applies
 * the same regeneration -- a crit that also happens to be a big hit is one
 * proc, not two.
 *
 * Avoided outcomes are absent: a dodged blow is not one anybody suffered. A
 * BLOCK is present, because a blocked attack lands and can still take a fifth
 * of a health pool.
 */
export const bloodCrazeWhenHurt: TalentReactionBuilder = (percentOfMaxHealth) => ({
  id: 'blood_craze',
  on: 'taken',
  outcomes: ['hit', 'crit', 'crush', 'glance', 'block'],
  canTrigger: (_context, actor, attack) => {
    if (attack.critical) return true;
    return attack.amount > actor.health.maximum * BLOOD_CRAZE_BIG_HIT_FRACTION;
  },
  onTrigger: (context, actor) => {
    context.applyAura(actor, bloodCrazeAura(percentOfMaxHealth), actor.id);
  },
});

/**
 * Blood Craze's third clause: "dealing damage with Bloodthirst".
 *
 * A SEPARATE reaction because it watches the other side of the attack, and
 * `Reaction.on` names one side. It is also the only clause a warrior nothing
 * is hitting can ever meet, which is the whole reason Blood Craze is a Fury
 * talent rather than a Protection one.
 *
 * "Dealing damage" is read as LANDING it: a Bloodthirst the target dodged
 * dealt none.
 */
export const bloodCrazeOnBloodthirst: TalentReactionBuilder = (percentOfMaxHealth) => ({
  id: 'blood_craze_bloodthirst',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'crush', 'block'],
  canTrigger: (_context, _actor, attack) =>
    attack.abilityId === 'bloodthirst' && attack.amount > 0,
  onTrigger: (context, actor) => {
    context.applyAura(actor, bloodCrazeAura(percentOfMaxHealth), actor.id);
  },
});

/** Every Warrior talent that grants a reaction, by talent id. */
export const WARRIOR_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  deep_wounds: deepWounds,
  /*
   * Two entries for ONE talent, which the effect table reaches by declaring
   * two `reaction` effects. A talent whose triggers sit on both sides of an
   * attack cannot be one reaction, and nothing about the registry had to
   * change to allow it.
   */
  blood_craze: bloodCrazeWhenHurt,
  blood_craze_bloodthirst: bloodCrazeOnBloodthirst,
  flurry,
  unbridled_wrath: unbridledWrath,
  bloodthrill,
  shield_specialization: shieldSpecialization,
  master_of_defense: masterOfDefense,
  enrage,
  weaponmaster: weaponmasterSword,
};
