import type { CastReaction, Reaction } from '../../engine';
import { applyHealing, isWeaponUse, isWeaponUseOf } from '../../engine';
import { ENRAGE_TRIGGER_CHANCE, OVERPOWER_READY, REND, enrageAura } from '../auras/warrior';
import {
  GORE_DRINKER_ID,
  bloodCrazeAura,
  deepWoundsAura,
  flurryAura,
  goreDrinkerAura,
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
 *
 * ----------------------------------------------------------------------------
 * AND EVERY NUMBER AT THAT RANK, as a second argument, for the proc whose
 * tooltip varies more than one of them.
 *
 * MOST DO NOT NEED IT, which is why it is second and optional: a builder that
 * ignores it is a one-argument function and TypeScript is happy. The talent
 * effect's `valueIndex` picks which number arrives as `value`, and that is
 * enough whenever the others are the same at every rank -- Improved Scorch's
 * per-stack 3 and Fingers of Frost's 15% chance are both constants beside
 * their auras, checked against the file by a test.
 *
 * WINTER'S CHILL IS THE FIRST WHERE TWO NUMBERS BOTH MOVE. Its values are
 * `[chance, critPerStack, duration, maxStacks]` and the rank scales the chance
 * 20..100 AND the stack cap 1..5. Deriving one from the other would work today
 * and is exactly the kind of arithmetic that is right until a rank changes,
 * so the whole row is handed over instead.
 * ----------------------------------------------------------------------------
 */
export type TalentReactionBuilder = (
  value: number,
  values?: readonly number[],
) => Reaction;

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
 * Flurry: ANY non-DoT critical strike hastens the next three swings.
 *
 * ----------------------------------------------------------------------------
 * NO `canTrigger`, AND THAT IS THE FIX RATHER THAN AN OMISSION.
 *
 * It read `isWeaponUse(attack)`, which requires a main- or off-hand weapon slot
 * -- so Thunder Clap, Intercept and Charge crits refused to proc it. They are
 * melee abilities that declare `ranged-special` (the overloaded table; see
 * CLAUDE.md), which is exactly what `isWeaponUse` is built to exclude for
 * WEAPON-BOUND effects like Crusader. Flurry is not weapon-bound: the ruleset
 * owner's wording is any non-DoT critical strike.
 *
 * `outcomes: ['crit']` IS THE WHOLE CONDITION, because `dealDamage` dispatches
 * reactions only for attacks that consulted a combat table and were NOT
 * periodic. So a Deep Wounds or Rend tick cannot reach here however it rolls,
 * and the "non-DoT" half of the rule is enforced one layer down rather than
 * restated here where it could drift.
 *
 * IT MOVES NOTHING FOR THE WARRIOR AND +10.5 DPS FOR THE SHAMAN, which is the
 * one thing to know before editing this. DW Fury is the only Warrior profile
 * that takes Flurry and its list casts nothing on the ranged table, so for the
 * Warrior the abilities this reaches are ones no profile uses -- it is correct
 * for a Flurry build in Battle or Defensive stance and costs the current ones
 * nothing.
 *
 * ENHANCEMENT SHAMAN HAS ITS OWN FLURRY AND SHARES THIS BUILDER, and there the
 * breadth is worth real damage: a Shaman crits with Lightning Bolt, Flame Shock
 * and Earth Shock, so Enh Shaman went 593.5 to 604.0. **Both tooltips say "after
 * dealing a MELEE critical strike" and the ruleset owner has ruled the broad
 * reading for BOTH classes**, so the wording is overridden deliberately and in
 * two places at once. It shipped narrow for the Shaman for exactly one PR, on
 * the grounds that the ruling had been given while reading a Warrior profile;
 * the owner then ruled the Shaman too. A reader who finds the tooltip and this
 * code disagreeing is looking at a decision, not a bug.
 *
 * APPLIED AT FULL CHARGES BY DECLARATION, not by hand. The aura carries
 * `chargesOnApply` and `refreshRestoresCharges`; this used to set
 * `instance.stacks` directly after `applyAura` had already emitted a smaller
 * count, so the telemetry disagreed with the engine on every single proc.
 * ----------------------------------------------------------------------------
 */
export const flurry: TalentReactionBuilder = (hastePercent) => ({
  id: 'flurry',
  on: 'dealt',
  outcomes: ['crit'],
  onTrigger: (context, actor) => {
    context.applyAura(actor, flurryAura(hastePercent), actor.id);
  },
});

/**
 * Rage a proc of Unbridled Wrath grants.
 *
 * ----------------------------------------------------------------------------
 * ONE, WHATEVER IS HELD. This was `{ oneHanded: 1, twoHanded: 2 }` and the
 * amount was read off the weapon that SWUNG; client build 1.60.1.70170 removed
 * the second half -- "Unbridled Wrath no longer grants twice as much Rage to
 * two-handed weapons" -- and the refreshed tooltip drops the sentence that said
 * so. The values row went from `[chance, 1, 2]` to `[chance, 1]` with it.
 *
 * IT MATTERS MOST TO THE BUILD THAT IS NOT DUAL-WIELDING. A two-hander swings
 * about half as often as two one-handers between them, so halving the per-proc
 * rage on top of that is a real cut to 2H Arms' rage income and none at all to
 * DW Fury's -- and both builds take 5/5.
 * ----------------------------------------------------------------------------
 */
export const UNBRIDLED_WRATH_RAGE = 1;

/**
 * Unbridled Wrath: a chance at extra rage when a melee weapon deals damage.
 *
 * `isWeaponUse` rather than "a swing", which is deliberate and is what the
 * tooltip says: "when you deal melee damage with a weapon" covers an ability
 * that needs the weapon as well as the auto-attack. A special attack costs no
 * swing time, so this is one of the places a fast rotation earns more than the
 * flat `R x S` income suggests.
 */
export const unbridledWrath: TalentReactionBuilder = (chancePercent) => ({
  id: 'unbridled_wrath',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance'],
  canTrigger: (context, _actor, attack) =>
    isWeaponUse(attack) && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'rage', UNBRIDLED_WRATH_RAGE, {
      id: 'unbridled_wrath',
      name: 'Unbridled Wrath',
    });
  },
});

/**
 * Bloodthrill: MAIN HAND melee attacks against a target bleeding from your Rend
 * have a chance to open the Overpower window.
 *
 * Reuses OVERPOWER_READY, the same aura a dodge applies, so Overpower's
 * `canCast` needs no second condition and the window behaves identically
 * however it was opened.
 *
 * ----------------------------------------------------------------------------
 * MAIN HAND ONLY, AND THE CHANCE DOUBLED, both at client build 1.60.1.70170 and
 * neither in the patch notes. The tooltip went from "Your melee attacks ... have
 * a 10% chance" to "Your Main Hand melee attacks ... have a 20% chance", and the
 * values row from 2/4/6/8/10 to 4/8/12/16/20.
 *
 * SO THE TWO CHANGES PULL AGAINST EACH OTHER and the net depends on the build.
 * For 2H Arms, which takes 5/5, every weapon use is already a main-hand use and
 * the talent simply doubled. For a dual-wielder it would have halved the
 * eligible attacks and doubled the chance, which is roughly a wash -- and no
 * dual-wield build takes it.
 *
 * THE VALUE ROW ALSO LOST A NUMBER. It was `[chance, 1, 6]` -- the middle one
 * being "for 1 attack", which the new wording drops -- and is `[chance, 6]` now.
 * This effect reads index 0 either way, which is exactly the kind of accident
 * worth not relying on: see `improved_slam`, where the same reshaping happened
 * and every reader was given an explicit index.
 * ----------------------------------------------------------------------------
 */
export const bloodthrill: TalentReactionBuilder = (chancePercent) => ({
  id: 'bloodthrill',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance'],
  canTrigger: (context, _actor, attack) =>
    isWeaponUseOf(attack, 'mainHand') &&
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

/*
 * BLOOD CRAZE'S THIRD CLAUSE WAS A SECOND REACTION HERE AND IS GONE.
 * "Blood Craze no longer activates off of Bloodthirst casts", client build
 * 1.60.1.70170, and the refreshed tooltip drops the clause.
 *
 * WHAT IT WAS: `on: 'dealt'`, gated on `attack.abilityId === 'bloodthirst' &&
 * attack.amount > 0`, applying the same `bloodCrazeAura` the other clause does.
 * A separate reaction because it watched the OTHER SIDE of the attack and
 * `Reaction.on` names one side -- which is still the rule, and Gore Drinker
 * below needs the same two-entry shape for the same reason.
 *
 * IT WAS THE ONLY CLAUSE A WARRIOR NOTHING IS HITTING COULD EVER MEET, which is
 * what made Blood Craze a Fury talent rather than a Protection one. Without it
 * the talent is a tank talent sitting in a damage tree, and the owner's new DW
 * Fury build does not take it.
 */

/**
 * GORE DRINKER, the cast half: "Your Enrage, Berserker Rage, Bloodrage, Death
 * Wish, and Bloodthirst abilities cause your next 3 melee attacks to restore
 * 0.5/1% of your maximum Health."
 *
 * ----------------------------------------------------------------------------
 * A SET OF IDS IN `canTrigger` RATHER THAN `CastReaction.abilityId`, which holds
 * exactly one. Four ids, so the field cannot express it -- `runCastReactions`
 * compares `reaction.abilityId` to the cast and skips on a mismatch, and a
 * reaction with no `abilityId` is offered every cast, which is what this wants
 * before narrowing.
 *
 * ENRAGE IS NOT IN THE SET AND IS IN THE TOOLTIP. It is a talent PROC in Forever
 * and no ability a Warrior presses, so there is nothing to react to; the talent
 * carries an `unmodelled` entry saying exactly that.
 *
 * `_cast` IS NOT INSPECTED BEYOND ITS ABILITY. A Bloodthirst that MISSED still
 * opened the window, because the tooltip keys on the ability being used rather
 * than on it connecting -- which is the opposite of the clause this replaced,
 * where "dealing damage with Bloodthirst" was read as landing it.
 * ----------------------------------------------------------------------------
 */
export const GORE_DRINKER_ABILITIES: readonly string[] = [
  'berserker_rage_cast',
  'bloodrage_cast',
  'death_wish',
  'bloodthirst',
];

export const goreDrinker = (percentOfMaxHealth: number): CastReaction => ({
  id: 'gore_drinker',
  canTrigger: (_context, _actor, cast) => GORE_DRINKER_ABILITIES.includes(cast.ability.id),
  onTrigger: (context, actor) => {
    context.applyAura(actor, goreDrinkerAura(percentOfMaxHealth), actor.id);
  },
});

/**
 * GORE DRINKER, the attack half: each of the next three melee attacks restores
 * the health and spends a charge.
 *
 * ----------------------------------------------------------------------------
 * IT SPENDS ITS OWN CHARGE, WHICH IS NOT WHAT THE OTHER CHARGE EFFECTS DO.
 * Flurry declares `consumedBySwing` and Shield Block declares `consumedByBlock`,
 * and in both cases the ENGINE spends the charge -- the auto-attack and the
 * damage pipeline are the only things that know a swing or a block happened.
 * There is no equivalent hook for "any melee attack landed", and adding one
 * would be a general engine field with exactly one caller, which this project
 * has twice found to be silent in the rules that did not get wired up.
 *
 * SO THE REACTION HEALS AND THEN CALLS `consumeStack`, in that order, and the
 * order is load-bearing for the same reason Holy Shield's is: asking whether the
 * aura is up AFTER spending the charge drops the THIRD attack's heal, and the
 * talent would quietly be worth two thirds of itself. `runReactions` only
 * offers an attack at all while the aura is up, so the heal always has its
 * charge.
 *
 * "MELEE ATTACKS" IS `isWeaponUse`, the project's own definition of a use: a
 * swing, an extra attack, or an ability that needs the weapon. A Thunder Clap
 * declares a ranged slot precisely so it is excluded.
 *
 * NO CRIT AND NO SPELL POWER on the heal: it is a fraction of a pool, exactly
 * as Blood Craze's ticks are, and nothing about the Warrior scales it.
 * ----------------------------------------------------------------------------
 */
export const goreDrinkerHeal: TalentReactionBuilder = (percentOfMaxHealth) => ({
  id: 'gore_drinker_heal',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'crush', 'block'],
  canTrigger: (_context, actor, attack) =>
    isWeaponUse(attack) && actor.auras.has(GORE_DRINKER_ID),
  onTrigger: (context, actor) => {
    applyHealing(context, {
      source: actor,
      target: actor,
      abilityId: GORE_DRINKER_ID,
      abilityName: 'Gore Drinker',
      baseAmount: (actor.health.maximum * percentOfMaxHealth) / 100,
      canCrit: false,
    });
    actor.auras.consumeStack(context, GORE_DRINKER_ID);
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
  /*
   * GORE DRINKER IS THE SECOND TALENT WITH TRIGGERS ON BOTH SIDES, and the
   * registry needed no change for it either: a CAST opens the window and an
   * ATTACK spends it, so the cast half is in `WARRIOR_CAST_REACTIONS` and this
   * is the attack half.
   */
  gore_drinker_heal: goreDrinkerHeal,
  flurry,
  unbridled_wrath: unbridledWrath,
  bloodthrill,
  shield_specialization: shieldSpecialization,
  master_of_defense: masterOfDefense,
  enrage,
  weaponmaster: weaponmasterSword,
};

/**
 * Every Warrior talent that grants a CAST reaction, by talent id.
 *
 * THE WARRIOR'S FIRST, which is why `talentBuild.ts` had no `warrior` entry in
 * `CAST_REACTIONS` until Gore Drinker arrived. That registry is OPTIONAL and
 * SILENT -- a class missing from it produces no cast reactions and no complaint
 * -- so the table is exported even though it holds one entry, and
 * `classRegistration.test.ts` is what notices if a class with cast reactions is
 * absent from it.
 */
export const WARRIOR_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {
  gore_drinker: goreDrinker,
};
