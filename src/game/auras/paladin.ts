import type { AuraDefinition, Combatant } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, flat, percent, seconds, spellPowerFor } from '../../engine';
import {
  CONSECRATION_TICK_SP_COEFFICIENT,
  SEAL_OF_FURY_SP_COEFFICIENT,
  SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_ONE_HAND,
  SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_TWO_HAND,
} from '../combat/coefficients';

/**
 * Paladin auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * Captured in `src/data/abilities/forever-paladin-spellbook.json` at MAX RANK.
 *
 * ----------------------------------------------------------------------------
 * A SEAL IS A STANCE THAT DEALS DAMAGE. "Only one Seal can be active on the
 * Paladin at any one time" is the same exclusivity rule a Warrior's stances
 * already follow, and it is modelled the same way: casting one removes the
 * others. Nothing new in the engine was needed for that.
 *
 * WHAT IS NEW IS THAT A SEAL PAYS OUT TWICE. It rides on every melee swing for
 * thirty seconds, AND it can be spent by Judgement for a one-off effect -- and
 * in Forever, unlike Classic, JUDGEMENT DOES NOT CONSUME THE SEAL. The
 * spellbook says so outright, which removes the whole reason Classic paladins
 * re-cast a seal after every judgement.
 *
 * SEAL DAMAGE IS NOT A WEAPON USE, by the ruleset owner's ruling. The swing
 * that carried it is one and triggers Windfury, Crusader and Hand of Justice
 * normally; the Holy damage the seal adds is not a second use and triggers
 * nothing. Every seal effect here therefore deals its damage with NO
 * `weaponSlot`, which is exactly what `isWeaponUse` reads.
 * ----------------------------------------------------------------------------
 */

/** Every seal lasts half a minute, and the spellbook says so for each. */
export const SEAL_DURATION_MS = seconds(30);

/**
 * The seals that are mutually exclusive, by aura id.
 *
 * Written out rather than derived from a prefix, so that adding a seal is a
 * visible change here rather than a silent consequence of naming.
 */
export const SEAL_AURA_IDS = [
  'seal_of_righteousness',
  'seal_of_command',
  'seal_of_the_crusader',
  'seal_of_fury',
] as const;

/** Which seal a Paladin currently carries, if any. */
export function activeSeal(actor: Combatant): string | undefined {
  return SEAL_AURA_IDS.find((id) => actor.auras.has(id));
}

// ---------------------------------------------------------------------------
// The seals
// ---------------------------------------------------------------------------

/**
 * Seal of Righteousness: "granting each melee attack an additional 21 to 75
 * Holy damage. Slower weapons cause more Holy damage per swing."
 *
 * ----------------------------------------------------------------------------
 * A FLAT SPELL POWER COEFFICIENT PER STRIKE, CHOSEN BY WHAT IS HELD: 20% with a
 * one-hander, 22% with a two-hander, and NO attack power term at all.
 *
 * THIS SUPERSEDED A FORMULA, and the difference is a change of shape rather
 * than a refinement. The owner's earlier one was
 *
 *     damage = base + baseWeaponSpeed x (0.022 x attackPower + 0.044 x spellPower)
 *
 * which read attack power as well, and scaled CONTINUOUSLY with weapon speed --
 * so "slower weapons cause more Holy damage per swing" fell out of the
 * arithmetic. Under the sheet the weapon reaches the seal by TYPE instead, in
 * two steps, and attack power does not reach it. `WoWSimWorksheet.xlsx` wins,
 * being the document handed over as authoritative; what the old constants were
 * is recorded in docs/spell-coefficients.md so that meeting `0.022` in this
 * project's history leads somewhere.
 *
 * THE BASE SURVIVED THE CHANGE. "21 to 75" still supplies a flat term that the
 * coefficient is added TO, and which half of the range is the base is still the
 * same interpretation it always was -- see the constant below.
 * ----------------------------------------------------------------------------
 */

/** The low end of "21 to 75", read as the base the coefficient adds to. */
// 20.5, the low end of foreverchanges.pro's "20.5 to 71.4", against our
// capture's "21 to 75" at the same build. WHICH END IS THE BASE IS STILL THE
// SAME INTERPRETATION as before -- only the number moved.
export const SEAL_OF_RIGHTEOUSNESS_BASE = 20.5;

/**
 * A seal's damage: its flat base, PLUS its spell power coefficient.
 *
 * THE BASE IS NOT PART OF THE COEFFICIENT and is added to it, which is the
 * owner's instruction given with the sheet -- "many spells have a base damage
 * that needs to be added to this". A seal with 20% of 450 spell power deals
 * 20.5 + 90, never 90.
 */
export function sealDamage(base: number, spellPower: number, coefficient: number): number {
  return base + coefficient * spellPower;
}

/**
 * Seal of Righteousness scales by WHAT IS HELD: 22% with a two-hander, 20%
 * otherwise.
 *
 * The sheet's two rows read "(1H + Shield)" and "(2H)", so the one-hander
 * figure is the default and the two-hander is the exception -- which is also
 * the safe way round, since a style holding no weapon at all falls to the
 * commoner case rather than to the better one.
 */
export function sealOfRighteousnessCoefficient(twoHanded: boolean): number {
  return twoHanded
    ? SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_TWO_HAND
    : SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_ONE_HAND;
}

export const SEAL_OF_RIGHTEOUSNESS: AuraDefinition = {
  id: 'seal_of_righteousness',
  name: 'Seal of Righteousness',
  durationMs: SEAL_DURATION_MS,
  refreshBehaviour: 'reset',
};

/**
 * Seal of Command: "a chance to deal additional Holy damage equal to 70% of
 * normal weapon damage."
 *
 * PROCS PER MINUTE, on the ruleset owner's ruling -- the same normalisation
 * Crusader and Vis'kag already use, so a slow weapon and a fast one proc the
 * same number of times a minute. **AND THE RATE IS REAL NOW**: 7, confirmed by
 * the owner, so `SEAL_OF_COMMAND_PPM` in `reactions/paladin.ts` is data rather
 * than the named placeholder it used to be. This comment said it was still a
 * placeholder for one commit after it stopped being one.
 */
export const SEAL_OF_COMMAND_WEAPON_FRACTION = 0.7;

export const SEAL_OF_COMMAND: AuraDefinition = {
  id: 'seal_of_command',
  name: 'Seal of Command',
  durationMs: SEAL_DURATION_MS,
  refreshBehaviour: 'reset',
};

/**
 * Seal of the Crusader: "granting 325 melee attack power. The Paladin also
 * attacks 40% faster, but deals less damage with each attack."
 *
 * THE THIRD CLAUSE HAS NO NUMBER, AND THE RULESET OWNER CHOSE WHICH READING IT
 * GETS: Classic's, where the reduction exactly cancels the haste so that damage
 * per second is unchanged.
 *
 * ----------------------------------------------------------------------------
 * AN INTERPRETATION, NOT A PLACEHOLDER, and the difference matters. There is no
 * missing number to go and find: the source says "deals less damage with each
 * attack" and states no figure, so somebody has to say what that means. The
 * owner did, so the figure below is DERIVED from the haste rather than invented
 * beside it -- change the haste and the penalty follows.
 *
 * FOR AS LONG AS IT WAS UNAPPLIED THIS SEAL WAS GENEROUS, and the ability said
 * so on the results page. Both Retribution and Protection open with it, so the
 * overstatement was real if small: the seal is replaced within a global cooldown
 * or two in all three lists, which is what bounds what this change is worth.
 *
 * `melee-auto` ONLY, which is the clause doing its stated work. Haste in this
 * engine shortens a SWING and a CAST and reaches nothing else -- Judgement, Holy
 * Shock and Consecration are all on cooldowns the haste never touched, so
 * penalising them would take away damage the seal never sped up. A whole
 * character `damageDoneMultiplier` would have done exactly that.
 * ----------------------------------------------------------------------------
 */
// 306 from foreverchanges.pro against our capture's 325, same build, same rank 6.
export const SEAL_OF_THE_CRUSADER_ATTACK_POWER = 306;
export const SEAL_OF_THE_CRUSADER_HASTE_PERCENT = 40;

/**
 * "Deals less damage with each attack", read as exactly cancelling the haste.
 *
 * 40% faster swings land 1.4 times as many, so each has to be worth 1/1.4 of
 * itself for the rate to come out unchanged. Written as the reciprocal rather
 * than as 0.714 so that the two numbers cannot drift apart.
 */
export const SEAL_OF_THE_CRUSADER_SWING_MULTIPLIER =
  1 / (1 + SEAL_OF_THE_CRUSADER_HASTE_PERCENT / 100);

export const SEAL_OF_THE_CRUSADER: AuraDefinition = {
  id: 'seal_of_the_crusader',
  name: 'Seal of the Crusader',
  durationMs: SEAL_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [
    flat('attackPower', SEAL_OF_THE_CRUSADER_ATTACK_POWER),
    flat('hasteRating', SEAL_OF_THE_CRUSADER_HASTE_PERCENT * RATING_PER_PERCENT.haste),
  ],
  // The third clause, on the owner's reading. See above for why it is the swing
  // table alone and not the whole character.
  damageDoneByTable: { 'melee-auto': SEAL_OF_THE_CRUSADER_SWING_MULTIPLIER },
};

/**
 * Seal of Fury: "causing melee attacks to deal an additional 35 Holy damage.
 * While a shield is equipped, each attack also grants an absorb shield equal to
 * 50% of the Holy damage dealt."
 *
 * Both clauses now. The shield is live only for the Protection profile, which is
 * the only Paladin holding a shield and the only one that is hit back.
 */
export const SEAL_OF_FURY_DAMAGE = 35;
export const SEAL_OF_FURY_ABSORB_FRACTION = 0.5;

export const SEAL_OF_FURY: AuraDefinition = {
  id: 'seal_of_fury',
  name: 'Seal of Fury',
  durationMs: SEAL_DURATION_MS,
  refreshBehaviour: 'reset',
};

/**
 * Improved Seal of Fury: "When Seal of Fury's shield is fully absorbed, restore
 * 60 Mana, increased by 15% per level the attacker is above you, up to 45%."
 */
/**
 * The flag Improved Seal of Fury sets on the Seal of Fury ABILITY.
 *
 * The Twist of Light pattern: `applyTalentChanges` hands each character its own
 * copy of the ability, so a flag read off it is per character by construction. A
 * module-level set keyed on the character would leak the talent across a Monte
 * Carlo batch, which is the exact bug that copy exists to prevent.
 */
export const IMPROVED_SEAL_OF_FURY_FLAG = 'improvedSealOfFury';

export const IMPROVED_SEAL_OF_FURY_MANA = 60;
export const IMPROVED_SEAL_OF_FURY_PER_LEVEL = 0.15;
export const IMPROVED_SEAL_OF_FURY_MAX_BONUS = 0.45;

/** The mana Improved Seal of Fury returns against an attacker N levels above. */
export function improvedSealOfFuryMana(levelsAbove: number): number {
  const bonus = Math.min(
    IMPROVED_SEAL_OF_FURY_MAX_BONUS,
    IMPROVED_SEAL_OF_FURY_PER_LEVEL * Math.max(0, levelsAbove),
  );
  return IMPROVED_SEAL_OF_FURY_MANA * (1 + bonus);
}

/*
 * ============================================================================
 * SEAL OF FURY'S SHIELD: "each attack also grants an absorb shield equal to 50%
 * of the Holy damage dealt", while a shield is equipped.
 *
 * A SEPARATE AURA FROM THE SEAL, because the two have separate lifetimes: the
 * seal runs thirty seconds whatever happens, and the shield is spent by the next
 * thing that hits hard enough. Putting the absorb on the seal itself would end
 * the seal the first time the shield was consumed.
 *
 * THE AMOUNT IS RE-EVALUATED ON EVERY SWING, which is what `AuraCollection`'s
 * refresh path was changed to do. "Each attack grants" a shield; a refresh that
 * left the old pool alone would cap it at one swing's worth for the whole thirty
 * seconds, which reads as a working shield and is worth a fraction of one.
 *
 * ITS DURATION IS NOT STATED ANYWHERE, so it takes the seal's own thirty
 * seconds -- the only duration the source gives. An interpretation with almost
 * nothing resting on it: the shield is re-granted every swing, so it can only
 * ever expire on a Paladin who has stopped attacking.
 *
 * "50% OF THE HOLY DAMAGE DEALT" IS READ AS 50% OF THE SEAL'S OWN FIGURE --
 * before the swing's crit, and without the Holy power a Judgement of the
 * Crusader on the target would add. The alternative is to thread the resolved
 * damage of the seal hit back out of `dealDamage`, which nothing else needs;
 * said here because the shield is then slightly smaller than the largest
 * defensible reading rather than larger.
 * ============================================================================
 */
export const SEAL_OF_FURY_SHIELD_ID = 'seal_of_fury_shield';

export function sealOfFuryShield(manaOnFullAbsorb: number): AuraDefinition {
  return {
    id: SEAL_OF_FURY_SHIELD_ID,
    name: 'Seal of Fury (shield)',
    durationMs: SEAL_DURATION_MS,
    refreshBehaviour: 'reset',
    absorb: (target) =>
      SEAL_OF_FURY_ABSORB_FRACTION *
      sealDamage(SEAL_OF_FURY_DAMAGE, spellPowerFor(target, 'holy'), SEAL_OF_FURY_SP_COEFFICIENT),
    /*
     * SPENT TO PREVENT DAMAGE, so a revive drops it, exactly as Templar's
     * Bulwark and the Warrior's Last Stand do.
     */
    removedOnDeath: true,
    /*
     * "FULLY ABSORBED" IS TOLD APART FROM "EXPIRED" BY THE POOL, and no engine
     * hook was needed for it: `consumeAbsorb` removes a shield the moment it
     * reaches zero, and a shield that ran out of TIME still has some left. So
     * `onExpire` plus one comparison is the whole of Improved Seal of Fury.
     *
     * `manaOnFullAbsorb` IS ZERO WITHOUT THE TALENT, which is why it is a
     * parameter rather than a lookup: the aura does not have to know what a
     * talent is, and a build without the talent carries a shield that returns
     * nothing rather than a second aura definition.
     */
    onExpire: (context, aura) => {
      if (manaOnFullAbsorb <= 0) return;
      if (aura.absorbRemaining > 0) return;
      const owner = context.combatant(aura.targetId);
      if (!owner) return;
      context.grantResource(owner, 'mana', manaOnFullAbsorb, {
        id: 'improved_seal_of_fury',
        name: 'Improved Seal of Fury',
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Judgements
// ---------------------------------------------------------------------------

/**
 * The Crusader's judgement: "increasing Holy damage taken by up to 161. Your
 * melee strikes will refresh the spell's duration."
 *
 * ----------------------------------------------------------------------------
 * "UP TO 161" IS SPELL POWER, ON THE RULESET OWNER'S RULING, and that one word
 * is what decides the arithmetic. Each Holy ability scales it by its OWN
 * coefficient -- a seal at 20% gains about 32, Consecration 9.5% of it a tick,
 * Judgement of Righteousness half of it -- which is how every other "increases
 * damage by up to N" line in this ruleset reads.
 *
 * IT WAS INERT FOR THE WHOLE PROJECT AND THE REASON WAS AN ARITHMETIC ERROR
 * RATHER THAN A MISSING CAPABILITY. The note here used to say that a FLAT
 * per-school bonus had no declaration, having ruled out the two things it could
 * have been:
 *
 *   `damageTakenBySchool`         rejected, correctly -- it MULTIPLIES, and
 *                                reading 161 as +161% would be absurd
 *   `SchoolModifier.spellPower`   rejected because it sits on the ATTACKER, and
 *                                this debuff sits on the target
 *
 * The second rejection is the mistake. Which SIDE carries the number is a
 * plumbing question and is now answered by `spellPowerTakenBySchool`; what the
 * number MEANS is the question that mattered, and both lines mean the same thing
 * because they are worded the same way. Every Paladin list opens by putting this
 * debuff up, so the class spent the project paying a global cooldown for nothing.
 *
 * AND ITS OWN REFRESH CLAUSE IS MODELLED TOO -- "your melee strikes will refresh
 * the spell's duration", which `judgementOfTheCrusaderRefresh` does. Once judged,
 * a Paladin who keeps swinging keeps it, which is what makes the one opening cast
 * worth a whole fight.
 * ----------------------------------------------------------------------------
 */
export const JUDGEMENT_OF_THE_CRUSADER_BONUS = 161;
export const JUDGEMENT_OF_THE_CRUSADER_DURATION_MS = seconds(40);

export const JUDGEMENT_OF_THE_CRUSADER: AuraDefinition = {
  id: 'judgement_of_the_crusader',
  name: 'Judgement of the Crusader',
  durationMs: JUDGEMENT_OF_THE_CRUSADER_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  /*
   * ON THE TARGET, READ BY WHOEVER HITS IT. `spellPowerAgainst` is the one
   * function both the damage pipeline and the seals ask, so the debuff reaches
   * an ability scaling through `powerCoefficient` and one computing its own
   * damage in `game` by the same route.
   */
  spellPowerTakenBySchool: { holy: JUDGEMENT_OF_THE_CRUSADER_BONUS },
};

// ---------------------------------------------------------------------------
// Talents
// ---------------------------------------------------------------------------

/**
 * Twist of Light, the Retribution capstone and the reason a profile is called
 * "Seal Twist":
 *
 *   "When you replace your Seal of Command, Seal of Righteousness, Seal of
 *    Fury, or Seal of Justice with a different Seal, gain an Echo. Your next
 *    melee attack applies the replaced Seal's effects, consuming the Echo."
 *
 * ----------------------------------------------------------------------------
 * SEAL TWISTING AS A TALENT RATHER THAN AS A TECHNIQUE. In Classic this was a
 * timing trick -- swap seals in the window before a swing lands and both
 * resolve. Forever has made it an explicit effect with an explicit trigger,
 * which means it can be modelled exactly instead of being approximated by a
 * rotation that pretends to have millisecond hands.
 *
 * ONE CHARGE, consumed by the next melee attack. Carried as an aura holding
 * the id of the seal it echoes, so the reaction knows which effect to apply
 * without the talent having to enumerate them.
 * ----------------------------------------------------------------------------
 */
export const ECHO_DURATION_MS = seconds(30);

export function echoAura(replacedSealId: string): AuraDefinition {
  return {
    id: `echo_${replacedSealId}`,
    name: 'Echo',
    durationMs: ECHO_DURATION_MS,
    refreshBehaviour: 'reset',
  };
}

/** Every echo aura, so a reaction can find whichever one is up. */
export const ECHO_AURA_IDS = SEAL_AURA_IDS.map((id) => `echo_${id}`);

/**
 * Vengeance: "Increases your Physical and Holy damage dealt by {0}% for 30 sec
 * after landing a critical strike. Stacks up to 5 times."
 *
 * TWO SCHOOLS BY NAME, so it is a pair of school modifiers rather than a
 * blanket one -- except that a Paladin deals only physical and Holy damage, so
 * for these three profiles the two readings agree. Expressed as the tooltip
 * writes it anyway, because being right for the wrong reason does not survive
 * a fourth profile.
 *
 * A SCHOOL MODIFIER CANNOT COME AND GO, which is the catch: `SchoolModifiers`
 * is built once when the character is. So this is an aura with a blanket
 * `damageDoneMultiplier`, and the difference only shows on a Paladin dealing
 * damage of some third school -- which none of them do.
 */
export const VENGEANCE_DURATION_MS = seconds(30);
export const VENGEANCE_MAX_STACKS = 5;

export function vengeanceAura(percentPerStack: number): AuraDefinition {
  return {
    id: 'vengeance',
    name: 'Vengeance',
    durationMs: VENGEANCE_DURATION_MS,
    maxStacks: VENGEANCE_MAX_STACKS,
    refreshBehaviour: 'reset',
    modifiersScaleWithStacks: true,
    damageDoneMultiplier: 1 + percentPerStack / 100,
  };
}

/**
 * Holy Shield: "Increases chance to block by 20% for 10 sec, and deals 221
 * Holy damage for each attack blocked while active. Each block expends a
 * charge. 4 charges."
 *
 * FOUR BLOCKS OR TEN SECONDS, WHICHEVER ENDS FIRST, which is exactly what
 * `consumedByBlock` and `chargesOnApply` were built for -- Shield Block is the
 * same shape and came first.
 */
export const HOLY_SHIELD_BLOCK_CHANCE = 20;
export const HOLY_SHIELD_DAMAGE = 221;
export const HOLY_SHIELD_DURATION_MS = seconds(10);
export const HOLY_SHIELD_CHARGES = 4;

export const HOLY_SHIELD: AuraDefinition = {
  id: 'holy_shield',
  name: 'Holy Shield',
  durationMs: HOLY_SHIELD_DURATION_MS,
  chargesOnApply: HOLY_SHIELD_CHARGES,
  consumedByBlock: true,
  statModifiers: [flat('blockChance', HOLY_SHIELD_BLOCK_CHANCE)],
};


/*
 * ============================================================================
 * TEMPLAR'S BULWARK: "grants you an absorb shield equal to 100% of your maximum
 * health for 8 sec. Applies Forbearance for 1 min. Cannot be cast while
 * Forbearance is active." 110 mana, five minute cooldown, new in Forever.
 *
 * THE FIRST ABSORB IN THE PROJECT, and `DamageResolution.absorbed` has been
 * hard-coded to zero since the damage pipeline was written -- with a comment
 * saying the field existed so adding absorbs later would not change the
 * function's shape. It did not.
 *
 * A SHARE OF MAXIMUM HEALTH, READ ONCE WHEN IT IS CAST. Maximum health here is
 * itself computed once from a stats snapshot, so this is a fixed number for the
 * fight -- but the evaluation still happens at apply time rather than per hit,
 * because a shield that grew with a buff landing after it would be the wrong
 * number and would look entirely reasonable.
 *
 * FORBEARANCE IS NOT MODELLED AND DOES NOT NEED TO BE. It stops this being
 * chained with the Paladin's other immunities, none of which are declared here,
 * and its one minute is well inside a five minute cooldown -- so on this
 * encounter it can never be the binding constraint. Said rather than dropped.
 * ============================================================================
 */
export const TEMPLARS_BULWARK_DURATION_MS = seconds(8);
export const TEMPLARS_BULWARK_COOLDOWN_MS = seconds(300);
export const TEMPLARS_BULWARK_FORBEARANCE_MS = seconds(60);
/** "100% of your maximum health". */
export const TEMPLARS_BULWARK_HEALTH_SHARE = 1;

export const TEMPLARS_BULWARK: AuraDefinition = {
  id: 'templars_bulwark',
  name: "Templar's Bulwark",
  durationMs: TEMPLARS_BULWARK_DURATION_MS,
  absorb: (target) => target.health.maximum * TEMPLARS_BULWARK_HEALTH_SHARE,
  /*
   * SPENT TO PREVENT A DEATH, so it goes with the ones a revive drops --
   * Last Stand and Shield Wall declare the same. Carrying an exhausted or
   * running shield through a death would switch the assumed healer off at the
   * moment it is most needed.
   */
  removedOnDeath: true,
};

/*
 * ============================================================================
 * RIGHTEOUS FURY: "Increases the threat generated by your Holy attacks by 60%.
 * Lasts 30 min."
 *
 * PURELY THREAT, AND THREAT IS PERMANENTLY OUT OF SCOPE. So this aura carries
 * no modifier of any kind and is correct: there is nothing here for it to do.
 *
 * IT IS DECLARED AND CAST ANYWAY, by the ruleset owner's ruling, and that is
 * the honest model rather than a generous one. A Protection Paladin really
 * does spend 30% of its base mana and a global cooldown on this at the pull, so
 * the profile pays what it pays. Dropping the ability instead would hand the
 * build back a cast it does not get to keep.
 *
 * A VISIBLY INERT BUFF IS THE HONEST FAILURE MODE -- the Talent and Results
 * panels print the reason beside it, which is the whole point of carrying an
 * effect's own words rather than guessing at a number for it.
 * ============================================================================
 */
export const RIGHTEOUS_FURY_THREAT_PERCENT = 60;

/**
 * The percentage Improved Righteous Fury carries to the ability, as a key.
 *
 * ----------------------------------------------------------------------------
 * THE TALENT'S RANK REACHING AN AURA, and the ability is the only place the two
 * meet -- the Consecrated Ground pattern. `applyTalentChanges` writes the number
 * onto the character's own copy of Righteous Fury, and `onCast` builds the buff
 * with it. A module-level aura carrying the reduction would hand it to every
 * Paladin who casts the spell, talent or not.
 * ----------------------------------------------------------------------------
 */
export const IMPROVED_RIGHTEOUS_FURY_FLAG = 'improvedRighteousFury';

/**
 * Righteous Fury, with Improved Righteous Fury's damage reduction when taken.
 *
 * ----------------------------------------------------------------------------
 * "WHILE RIGHTEOUS FURY IS ACTIVE, ALL DAMAGE TAKEN IS REDUCED BY 6%" at 3/3,
 * which the Protection build takes -- and which was `unmodelled` with the reason
 * that "Righteous Fury is a threat buff and nothing here tracks threat, so no
 * profile casts it and the condition is never met".
 *
 * THE FIRST HALF IS STILL TRUE AND THE SECOND HALF STOPPED BEING TRUE. The
 * Protection list casts Righteous Fury at the pull, on the owner's own ruling,
 * precisely so the profile pays the mana and the global cooldown it really
 * pays -- so the condition is met for the whole fight and the reduction was
 * simply missing. **A reason with two clauses expires when EITHER one does**,
 * and this one kept reading as true because its first clause still was.
 *
 * THE THREAT HALF REMAINS OUT OF SCOPE, permanently, and the aura carries no
 * modifier for it. What changed is that the spell is no longer inert.
 * ----------------------------------------------------------------------------
 */
export function righteousFury(damageTakenReductionPercent = 0): AuraDefinition {
  return {
    id: 'righteous_fury',
    name: 'Righteous Fury',
    durationMs: 0,
    ...(damageTakenReductionPercent > 0
      ? { damageTakenMultiplier: 1 - damageTakenReductionPercent / 100 }
      : {}),
  };
}

/** The untalented buff, which is what a Paladin without the talent gets. */
export const RIGHTEOUS_FURY: AuraDefinition = righteousFury();

/*
 * ============================================================================
 * IRON CREED: "Increases the threat generated by your Holy Strike ability 25%.
 * While Righteous Fury is active, Holy Strike ALSO reduces your damage taken by
 * 10% for 6 sec." at 5/5, which the Protection build takes.
 *
 * ITS REASON WAS THREAT PLUS "its damage-reduction half needs Righteous Fury,
 * which no profile casts" -- the same two-clause reason Improved Righteous Fury
 * carried, and wrong in the same half. Protection casts Righteous Fury at the
 * pull and casts Holy Strike every ten seconds, so this is a 6-second window
 * opened roughly every ten.
 *
 * TRIGGERED BY HOLY STRIKE, NOT BY ACTIVATING ANYTHING. There is no Iron Creed
 * button; the talent hangs a rider on an ability the build already casts, which
 * is why it is a CAST reaction rather than an aura the Paladin keeps up.
 *
 * THE RIGHTEOUS FURY CONDITION IS CHECKED WHEN HOLY STRIKE IS CAST, which is
 * what "while Righteous Fury is active" says. It is up all fight for the one
 * build that takes this, so the gate never refuses -- declared anyway, because a
 * condition nobody declared is a bonus being paid.
 * ============================================================================
 */
export const IRON_CREED_DURATION_MS = seconds(6);

export function ironCreedAura(damageTakenReductionPercent: number): AuraDefinition {
  return {
    id: 'iron_creed',
    name: 'Iron Creed',
    durationMs: IRON_CREED_DURATION_MS,
    refreshBehaviour: 'reset',
    damageTakenMultiplier: 1 - damageTakenReductionPercent / 100,
  };
}

/**
 * Divine Favor: "When activated, gives your next Flash of Light, Holy Light, or
 * Holy Shock spell a 100% critical effect chance."
 *
 * ----------------------------------------------------------------------------
 * ONE OF THE THREE IS DAMAGE AND IT IS THE ONE THAT MATTERS HERE. Flash of Light
 * and Holy Light are heals and no Paladin profile heals, so what this buys the
 * Shockadin is a guaranteed Holy Shock crit every two minutes.
 *
 * ITS REASON USED TO BE THAT A ONE-SHOT PER-ABILITY CRIT MODIFIER DID NOT EXIST,
 * "which `CastModifier` does not carry -- it covers cast time and cost". True of
 * `CastModifier`, and the wrong place to look: an AURA has carried
 * `abilityModifiers` since Shatter, and `critBonus` on one is exactly this.
 *
 * NO DURATION, AND NO `consumedByCast` EITHER -- both deliberate. The tooltip
 * gives the buff no lifetime, so it is permanent until spent, and it is spent by
 * a CAST REACTION rather than by the cast-charge machinery. That ordering is the
 * whole reason it works: `consumeCastCharges` runs BEFORE `runCast`, so a charge
 * spent that way would drop the aura before the spell rolled its crit and the
 * talent would do nothing at all. Cast reactions run AFTER `onCast`, so the
 * crit is already rolled when the aura goes.
 * ----------------------------------------------------------------------------
 */
export const DIVINE_FAVOR_CRIT_BONUS = 100;

export const DIVINE_FAVOR: AuraDefinition = {
  id: 'divine_favor',
  name: 'Divine Favor',
  // Permanent: "your next" is a count, and the count is spent by the reaction.
  durationMs: 0,
  abilityModifiers: { holy_shock: { critBonus: DIVINE_FAVOR_CRIT_BONUS } },
};

/**
 * Vindication: "Gives your damaging melee attacks a chance to reduce the
 * target's Attack Power by 200, and increase your Attack Power by 3% for 30
 * sec."
 *
 * ----------------------------------------------------------------------------
 * ITS CHANCE IS 10%, ON THE RULESET OWNER'S ANSWER. Nothing in the client data
 * states one -- the values file gives the attack power taken, the attack power
 * gained and the duration, and no rate -- so the talent sat inert rather than
 * take an invented one. It is real data now, not a placeholder.
 *
 * ONLY THE SELF BUFF DOES ANYTHING, AND THAT IS THE TARGET'S FAULT RATHER THAN
 * THE ENGINE'S. The 200 attack power it strips is real and reaches nothing: the
 * training dummy's damage is a flat placeholder that reads no attack power at
 * all, so debuffing it changes no number. Modelled anyway -- `statModifiers` on
 * a debuff costs nothing and the day the encounter grows an attack power it is
 * already right.
 * ----------------------------------------------------------------------------
 */
export const VINDICATION_CHANCE = 10;
export const VINDICATION_DURATION_MS = seconds(30);

export function vindicationSelfAura(attackPowerPercent: number): AuraDefinition {
  return {
    id: 'vindication',
    name: 'Vindication',
    durationMs: VINDICATION_DURATION_MS,
    refreshBehaviour: 'reset',
    statModifiers: [percent('attackPower', attackPowerPercent / 100)],
  };
}

export function vindicationDebuff(attackPowerTaken: number): AuraDefinition {
  return {
    id: 'vindication_debuff',
    name: 'Vindication',
    durationMs: VINDICATION_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    statModifiers: [flat('attackPower', -attackPowerTaken)],
  };
}

/**
 * Shield Specialization's mana clause: "gives your blocks a 100% chance to
 * restore 6% of your maximum Mana. May only occur once every 3 sec."
 *
 * THE INTERNAL COOLDOWN IS AN AURA RATHER THAN A CLOSURE, which is the shape
 * this project settled on after a shared closure silently stopped Windfury
 * proccing past the first iteration of a batch. An aura is per character by
 * construction and shows up in the log when the window is shut.
 */
export const SHIELD_SPECIALIZATION_COOLDOWN_MS = seconds(3);

export const SHIELD_SPECIALIZATION_USED: AuraDefinition = {
  id: 'shield_specialization_used',
  name: 'Shield Specialization (cooldown)',
  durationMs: SHIELD_SPECIALIZATION_COOLDOWN_MS,
  refreshBehaviour: 'reset',
};

/**
 * Redoubt: "Damaging melee attacks against you have a 10% chance to increase
 * your chance to block by 30%. Lasts 10 sec or 5 blocks."
 *
 * The same charge-and-duration shape again, and the third effect in the
 * project to use it.
 */
export const REDOUBT_DURATION_MS = seconds(10);
export const REDOUBT_CHARGES = 5;

export function redoubtAura(blockChance: number): AuraDefinition {
  return {
    id: 'redoubt',
    name: 'Redoubt',
    durationMs: REDOUBT_DURATION_MS,
    chargesOnApply: REDOUBT_CHARGES,
    consumedByBlock: true,
    refreshBehaviour: 'reset',
    statModifiers: [flat('blockChance', blockChance)],
  };
}

/**
 * Consecration's ground effect: "96 Holy damage over 8 sec ... an additional
 * 216 damage over 8 sec" to the first four enemies in it.
 *
 * BOTH HALVES, because there is one target and it is certainly among the first
 * four -- 312 over eight seconds. A two-second cadence divides it into four
 * ticks of 78, which is the reading that leaves whole ticks.
 *
 * A DEBUFF ON THE TARGET rather than a patch of ground, which is the only
 * shape the engine has and is exactly right for a target that never moves.
 */
export const CONSECRATION_TOTAL = 96 + 216;
export const CONSECRATION_DURATION_MS = seconds(8);
export const CONSECRATION_TICK_INTERVAL_MS = seconds(2);

/** A pure periodic effect: the cast deals nothing. 9.5% a tick. */
export const CONSECRATION_TICK_COEFFICIENT = CONSECRATION_TICK_SP_COEFFICIENT;

/**
 * The percentage Consecrated Ground carries to the ability, as a named key.
 *
 * ----------------------------------------------------------------------------
 * A TALENT'S RANK REACHING AN AURA, and the ability is the only place the two
 * meet: `applyTalentChanges` writes the number onto the character's own copy of
 * Consecration, and `onCast` builds the ground effect with it. The alternative --
 * a module-level aura carrying the bonus -- would hand it to every Paladin,
 * talent or not, which is the Focused Fire mistake in a different tree.
 * ----------------------------------------------------------------------------
 */
export const CONSECRATED_GROUND_FLAG = 'consecratedGround';

export function consecrationGround(holyDamageTakenPercent = 0): AuraDefinition {
  return {
  id: 'consecration',
  name: 'Consecration',
  durationMs: CONSECRATION_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  /*
   * CONSECRATED GROUND, when the Paladin has it: "gives your Holy spells 10%
   * increased damage against the first 4 enemies that enter your Consecration."
   *
   * ON THE TARGET'S SIDE, which is where "against enemies standing in it" puts
   * it, and which is why it reaches Judgement, Holy Shock and every seal rather
   * than only Consecration's own ticks. The talent used to be modelled as a flat
   * bonus to Consecration, which is a different effect wearing the same number.
   *
   * Strictly this raises Holy damage from ANYONE rather than from the Paladin who
   * placed it; with one Paladin and one enemy the readings agree.
   */
  ...(holyDamageTakenPercent > 0
    ? { damageTakenBySchool: { holy: 1 + holyDamageTakenPercent / 100 } }
    : {}),
  periodic: {
    intervalMs: CONSECRATION_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: 'holy',
        baseAmount:
          CONSECRATION_TOTAL / (CONSECRATION_DURATION_MS / CONSECRATION_TICK_INTERVAL_MS),
        // A pure periodic effect: 8 seconds over 15, spread across its ticks.
        powerCoefficient: CONSECRATION_TICK_COEFFICIENT,
        periodic: true,
        critFrom: 'spell',
        appliesArmor: false,
      });
    },
  },
  };
}

/** The untalented ground effect, which is what a Paladin without the talent lays. */
export const CONSECRATION_GROUND: AuraDefinition = consecrationGround();
