import type { Reaction } from '../../engine';
import { ENRAGE_TRIGGER_CHANCE, OVERPOWER_READY, REND, enrageAura } from '../auras/warrior';
import { FLURRY_SWINGS, deepWoundsAura, flurryAura } from '../auras/warriorTalents';

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
const isMelee = (slot: string | undefined) => slot === 'mainHand' || slot === 'offHand';

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
  canTrigger: (_context, _actor, attack) => isMelee(attack.weaponSlot),
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
  canTrigger: (_context, _actor, attack) => isMelee(attack.weaponSlot),
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
    isMelee(attack.weaponSlot) && context.rng.rollChance(chancePercent / 100),
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
    isMelee(attack.weaponSlot) &&
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
 * NOT GATED ON CARRYING A SWORD, because a reaction cannot see the weapon. The
 * talent's own `unmodelled` note carries that caveat.
 */
export const weaponmasterSword: TalentReactionBuilder = (chancePercent) => ({
  id: 'weaponmaster_sword',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance'],
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.extraAttack(actor, 'mainHand');
  },
});

/** Every Warrior talent that grants a reaction, by talent id. */
export const WARRIOR_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  deep_wounds: deepWounds,
  flurry,
  unbridled_wrath: unbridledWrath,
  bloodthrill,
  shield_specialization: shieldSpecialization,
  master_of_defense: masterOfDefense,
  enrage,
  weaponmaster: weaponmasterSword,
};
