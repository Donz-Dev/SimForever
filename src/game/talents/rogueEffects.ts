import type { TalentEffects } from './TalentEffect';
import { THOUSAND_CUTS_BONUS } from '../auras/rogue';

/**
 * Where the two poison talents are really applied, for `appliedElsewhere`.
 *
 * A path rather than a sentence, because the whole point of the field is that
 * the claim can be checked: `poisonReactions` reads both ranks off the
 * allocation there.
 */
const POISONS_MODULE = 'game/reactions/poisons.ts';

/**
 * What each Rogue talent does, as data.
 *
 * The same table the Warrior has, and the same rule: EVERY talent has an entry,
 * and one that cannot be expressed says so rather than being left out. A talent
 * with no entry is indistinguishable from one that silently does nothing.
 *
 * ----------------------------------------------------------------------------
 * WHAT THIS CLASS NEEDED THAT THE WARRIOR DID NOT.
 *
 * Almost nothing, which is the finding. Combo points arrived with
 * `game/combat/comboPoints.ts`; everything else here is a stat, an ability
 * cost, an ability damage multiplier or a granted ability -- effect kinds that
 * already existed.
 *
 * THE CLUSTERS OF INERT TALENTS HAVE ALL BEEN CLEARED OR RULED, and what each
 * one turned out to be is worth more than the list was:
 *
 *   ~~POISONS~~      DONE, and never a missing number -- a missing SYSTEM.
 *                    `poisonReactions` reads both talents' ranks off the
 *                    allocation, which is why neither has an effect in this
 *                    table and why both carry `appliedElsewhere`.
 *   ~~STEALTH~~      RULED OUT by the project owner. Six talents, and it does
 *                    NOT cover an in-combat proc that removes a stealth
 *                    requirement -- Cutthroat is exactly that and is modelled.
 *   ~~REACTIVE HOOKS~~  DONE. Four talents keyed off a CAST rather than a hit,
 *                    and `castReaction` is the effect kind that reaches them.
 *                    Seal Fate needed only one new fact, not a new hook:
 *                    `Ability.comboPointsAwarded`, so a crit reaction can ask
 *                    whether the ability that critted builds points.
 *   ~~ARMOR PENETRATION~~  DONE, and this comment was true before it was.
 *                    `armorPenetration` is a stat, read by `resolveDamage`
 *                    off the ATTACKER -- but for a release it was granted
 *                    and read by NOTHING, while this line said otherwise
 *                    and the census counted the talents as fully modelled.
 *                    See the note at the reduction site. It cleared the
 *                    Warrior's Weaponmaster mace clause at the same time --
 *                    which is what the old note calling it "the Warrior's
 *                    version of exactly this" was for.
 *
 * WHAT IS LEFT IS THREE TALENTS AND NONE OF THEM IS AN ENGINE GAP. Remorseless
 * Attacks needs a kill, and the fight ends on a timer with the target alive;
 * Riposte and Setup need a target that swings back, which `targetAttacks`
 * supplies and no Rogue profile sets. Both of the second kind are PROFILE gaps.
 * ----------------------------------------------------------------------------
 */
export const ROGUE_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Assassination -------------------------------------------------------

  improved_gouge: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Lengthens Gouge, which is an incapacitate and out of scope.' },
  ],

  /*
   * A KILL, AND NOT A LOW-HEALTH THRESHOLD, which is worth saying because the
   * two look alike and only one of them is answered by the clock ruling.
   * Execute, Hammer of Wrath and Quietus all say "below N% health" and all
   * three are the final fraction of the fight; this says "after KILLING a
   * non-trivial enemy", and the fight ends on a timer with the target alive.
   */
  remorseless_attacks: [
    {
      kind: 'unmodelled',
      reason:
        'Triggers after KILLING an enemy, which never happens: the encounter ' +
        'runs for a fixed duration and the target survives it. Not the same ' +
        'case as a "below N% health" clause, which the project owner has ruled ' +
        'is the final fraction of the fight -- see Quietus.',
    },
  ],

  malice: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  ruthlessness: [{ kind: 'castReaction', reactionId: 'ruthlessness' }],

  /*
   * APPLIED, ON THE OWNER'S RULING THAT THE TARGET IS ONE OF THE TWO TYPES.
   *
   * "Increases all damage dealt by 4% against Humanoid and Giant targets." Its
   * old reason -- "conditional on creature type, which no combatant here
   * carries" -- described the ENGINE and let the question go unasked; the
   * answer was one message away, and it is the same answer the Hunter's
   * Improved Tracking already runs on.
   *
   * `conditionalDamage` WITH AN EMPTY REQUIREMENT, which is how that talent
   * expresses "a bonus the engine does not check". It covers auto attacks as
   * well as abilities, which is what "all damage dealt" means and which matters
   * here more than anywhere: auto attacks are 55-57% of every Rogue profile.
   *
   * NOT the same case as the Paladin's Undead-and-Demon clauses, which stay
   * inert -- those were ruled the other way for the same target.
   */
  murder: [
    { kind: 'conditionalDamage', requires: {} },
    {
      kind: 'unmodelled',
      reason:
        'Applied as a flat damage bonus on the ruling of the project owner ' +
        'that the target is a Humanoid or a Giant. The engine checks no ' +
        'creature type, so this is an assumption about the encounter rather ' +
        'than something it verifies.',
    },
  ],

  /*
   * The duration bonus reaches the ability as a named number, which Slice and
   * Dice reads when it builds its aura. `abilityBonus` is the same hook
   * Improved Charge uses for the rage it adds.
   */
  improved_slice_and_dice: [
    { kind: 'abilityBonus', abilityId: 'slice_and_dice', key: 'durationPercent' },
  ],

  relentless_strikes: [{ kind: 'castReaction', reactionId: 'relentless_strikes' }],

  improved_expose_armor: [
    { kind: 'abilityCost', abilityId: 'expose_armor' },
    { kind: 'castReaction', reactionId: 'improved_expose_armor' },
  ],

  /*
   * APPLIED. Its reason was right about what was missing -- "a missing
   * declaration rather than a missing rule" -- and `abilityCritDamage` is that
   * declaration: a LIST of ability ids reaching `critMultiplierBonus`, which
   * had held the right shape since Impale with nothing pointed at it.
   *
   * MELEE, so "+20%" raises the bonus half of a x2 crit by 0.2 and a fully
   * talented Backstab crits for x2.2. A spell list would read 0.1 from the same
   * number, which is why the effect states the base rather than assuming one.
   *
   * FIVE OF THE SIX NAMED ABILITIES, and the sixth is Gouge -- an incapacitate,
   * ruled out of scope, and not declared. Listed as its own `unmodelled` clause
   * so the shortfall is visible rather than implied by a short array.
   */
  lethality: [
    {
      kind: 'abilityCritDamage',
      abilityIds: ['sinister_strike', 'backstab', 'mutilate', 'ghostly_strike', 'hemorrhage'],
      // Main's field for this is `table`, and `critBonusHalfFor` derives the
      // half from it -- 1.0 for a 2x melee crit. Every ability named above
      // rolls on `melee-special`.
      table: 'melee-special',
    },
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason:
        'Five of its six abilities take the crit damage bonus. The sixth is ' +
        'Gouge, an incapacitate the project owner classes as out of scope, so ' +
        'it is not declared and cannot take one.',
    },
  ],

  /*
   * APPLIED, and not through this table. Both poison talents are read by
   * `poisonReactions` off the allocation directly, for the same reason
   * Windfury Weapon is a class reaction that reads one talent number: a Rogue
   * who spent no points still applies poisons, and a talent-GRANTED proc would
   * delete them for that Rogue while a second registration would double them.
   *
   * AND THAT IS WHY BOTH CARRY `appliedElsewhere`. Having no non-unmodelled
   * entry here, every census in the project counted them as LIVE GAPS -- two of
   * the Rogue's fourteen were talents that already worked in full. Their reasons
   * said "APPLIES" in capitals and it made no difference, because `class_audit`
   * counts effects rather than adjectives. The field is the fix, it is data, and
   * it names the module so the claim can be checked.
   */
  vile_poisons: [
    {
      kind: 'unmodelled',
      appliedElsewhere: POISONS_MODULE,
      reason:
        'MOSTLY MODELLED. Its +20% poison damage APPLIES in full, read off the ' +
        'allocation by `poisonReactions` and worth about a fifth of the Venom ' +
        "build's total. What does nothing is the second half alone -- \"an " +
        'additional 40% chance to resist dispel effects" -- because nothing in ' +
        'any encounter here dispels anything.',
    },
  ],

  cold_blood: [{ kind: 'grantAbility', abilityId: 'cold_blood' }],

  improved_poisons: [
    {
      kind: 'unmodelled',
      appliedElsewhere: POISONS_MODULE,
      reason:
        'MOSTLY MODELLED. Its +10% chance to apply poisons APPLIES in full, ' +
        'read off the allocation by `poisonReactions` -- added in percentage ' +
        'POINTS, so Instant Poison goes from 20% a strike to 30%. What does ' +
        'nothing is the second half alone -- "a 50% chance to not consume a ' +
        'charge" -- because charges are infinite here on the instruction of ' +
        'the ruleset owner, and a sixty-second fight could not exhaust the ' +
        'stated 175 even if they were counted.',
    },
  ],

  vigor: [{ kind: 'resourceMax', resource: 'energy' }],

  mutilate: [{ kind: 'grantAbility', abilityId: 'mutilate' }],

  improved_kidney_shot: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Keyed to a stun, which the project owner classes as out of scope.' },
  ],

  seal_fate: [{ kind: 'reaction', reactionId: 'seal_fate' }],

  /*
   * GRANTED, now that poisons exist and the owner has ruled on the stacking.
   * Its +30% is ADDED to Vile Poisons' +20% rather than multiplied, so a
   * fully talented poison deals 1.5x rather than 1.56x.
   */
  venom: [{ kind: 'grantAbility', abilityId: 'venom' }],

  improved_eviscerate: [{ kind: 'abilityDamage', abilityId: 'eviscerate' }],

  // --- Combat --------------------------------------------------------------

  improved_sinister_strike: [{ kind: 'abilityCost', abilityId: 'sinister_strike' }],

  lightning_reflexes: [{ kind: 'stat', stat: 'dodgeChance', operation: 'flat' }],

  /*
   * ALL THREE CLAUSES, AND THE TALENT NEEDED TWO SEPARATE THINGS TO GET THERE.
   *
   * "Increases the critical strike chance of your Backstab by 30% and your
   * Mutilate by 15%, and gives Backstab a 45% chance to add an additional Combo
   * Point." One talent, three numbers, three effects.
   *
   * THE MUTILATE HALF WAS LEFT OFF RATHER THAN GRANTED WRONG, and the old
   * reason said exactly why: `abilityCrit` read a talent's FIRST value with no
   * way to name another, so Mutilate could only have taken Backstab's 30%.
   * `valueIndex` is the fix, and it is the same field `abilityDamage` and
   * `reaction` have carried all along.
   *
   * ITS THIRD CLAUSE WAS RECORDED AS "a bleed on Backstab, not captured" AND IS
   * NOT A BLEED. The Forever tooltip says an additional combo point, which is
   * an ordinary proc -- so the old reason was wrong about the clause rather
   * than merely stale, and reading the capture is what settled it.
   */
  puncturing_wounds: [
    { kind: 'abilityCrit', abilityId: 'backstab', valueIndex: 0 },
    { kind: 'abilityCrit', abilityId: 'mutilate', valueIndex: 1 },
    { kind: 'reaction', reactionId: 'puncturing_wounds', valueIndex: 2 },
  ],

  deflection: [{ kind: 'stat', stat: 'parryChance', operation: 'flat' }],

  precision: [{ kind: 'stat', stat: 'hitChance', operation: 'flat' }],

  /*
   * BOTH ITS ABILITIES ARE OUT OF SCOPE RATHER THAN MERELY ABSENT, which is a
   * change of KIND and not of wording. Sprint is movement speed -- `positioning`
   * -- and Evasion is a dodge cooldown, worth nothing on a character nothing
   * attacks. The scope tag is on the half that will never expire; the Evasion
   * half is stated in the reason because a Rogue encounter that swung back
   * would reach it.
   */
  endurance: [
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason:
        'Shortens Sprint, which is movement and out of scope, and Evasion, ' +
        'which is a dodge cooldown and is not implemented -- no Rogue profile ' +
        'fights a target that attacks back, so it would be worth nothing today ' +
        'even if it were.',
    },
  ],

  riposte: [
    {
      kind: 'unmodelled',
      reason:
        'Becomes active after PARRYING, so it needs a target that attacks back ' +
        '-- which `targetAttacks` can supply and no Rogue profile sets -- and ' +
        'the strike it unlocks is not declared. Its disarm is crowd control ' +
        'and would stay out of scope even then.',
    },
  ],

  improved_sprint: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Movement, which is not modelled.' }],

  improved_kick: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Silences, and nothing here casts.' }],

  flawless_execution: [{ kind: 'abilityCost', abilityId: 'eviscerate' }],

  dual_wield_specialization: [{ kind: 'offHandDamage' }],

  blade_flurry: [{ kind: 'grantAbility', abilityId: 'blade_flurry' }],

  /*
   * ALL THREE CLAUSES, EACH GATED ON A DIFFERENT WEAPON, and only one of the
   * three is ever live for a given character.
   *
   *   Axe/Sword   5% chance of an extra attack. A proc, so a `reaction`, and
   *               gated INSIDE it on the weapon that SWUNG rather than by the
   *               effect's `requires` -- that gate reads the main hand only,
   *               which is right for a whole-character stat and wrong for a
   *               per-swing proc. Sword Specialization on the Warrior is the
   *               same clause and was settled the same way.
   *   Dagger/Fist +5% crit. A plain stat, and `critChance` rather than
   *               `conditionalCrit`: the latter registers under
   *               `ALL_ABILITIES`, which by design does NOT reach an auto
   *               attack, and "increases your critical strike chance" plainly
   *               does. Auto attacks are over half of every Rogue profile.
   *   Mace        ignores 15% of the target's armor -- 3.80 points of
   *               mitigation against a raid boss, not fifteen.
   *               `armorPenetration`, the
   *               stat that did not exist when the old reason called this
   *               "the same gap as the Warrior Weaponmaster mace clause". It
   *               was that gap, and the gap is now closed for both.
   *
   * ONLY THE COMBAT PROFILE TAKES THIS, and it holds two swords -- so the
   * extra attack is the live clause and the other two are reported unmet by
   * `talentBuild` rather than silently skipped.
   */
  hack_and_slash: [
    { kind: 'reaction', reactionId: 'hack_and_slash', valueIndex: 0 },
    {
      kind: 'stat',
      stat: 'critChance',
      operation: 'flat',
      valueIndex: 1,
      requires: { weaponTypes: ['dagger', 'fist'] },
    },
    {
      kind: 'stat',
      stat: 'armorPenetration',
      operation: 'flat',
      valueIndex: 2,
      requires: { weaponTypes: ['mace'] },
    },
  ],

  /*
   * APPLIED. Its reason was a true statement about the engine -- "the attack
   * tables read the DEFENDER for both, and nothing lets an attacker lower
   * them" -- and `dodgeParryReduction` is the attacker-side term that was
   * missing. Two percentage points off EACH of the two slices, not one off
   * each: the tooltip states one figure and names both outcomes.
   *
   * NOT GRANTED AS HIT, which was the tempting shortcut. Hit comes off MISS
   * alone, and miss, dodge and parry are three different-sized slices of the
   * same table that move differently with the level gap -- so the same two
   * points would have been worth a different amount taken from the wrong one.
   */
  weapon_expertise: [{ kind: 'stat', stat: 'dodgeParryReduction', operation: 'flat' }],

  aggression: [
    { kind: 'abilityDamage', abilityId: 'sinister_strike' },
    { kind: 'abilityDamage', abilityId: 'backstab' },
    { kind: 'abilityDamage', abilityId: 'eviscerate' },
  ],

  adrenaline_rush: [{ kind: 'grantAbility', abilityId: 'adrenaline_rush' }],

  // --- Subtlety ------------------------------------------------------------

  camouflage: [
    { kind: 'unmodelled', scope: 'stealth', reason: 'Stealth, and every fight opens in combat.' },
  ],

  master_of_deception: [{ kind: 'unmodelled', scope: 'stealth', reason: 'Stealth detection.' }],

  /*
   * "Increases the damage dealt by your Backstab, Garrote, Ambush, and Mutilate
   * abilities by 10%."
   *
   * THREE OF ITS FOUR ABILITIES APPLY NOW. The Ambush clause was dead on the
   * same false premise as Improved Ambush and Initiative -- "Garrote and Ambush
   * ... are absent" was half right, and the half that was wrong is the one the
   * Rupture profile casts. Only Garrote is genuinely out of scope.
   */
  opportunity: [
    { kind: 'abilityDamage', abilityId: 'backstab' },
    { kind: 'abilityDamage', abilityId: 'mutilate' },
    { kind: 'abilityDamage', abilityId: 'ambush' },
    {
      kind: 'unmodelled',
      scope: 'stealth',
      reason:
        'Its Backstab, Mutilate and Ambush clauses all APPLY. It also covers ' +
        'Garrote, which is a stealth opener and out of scope for good.',
    },
  ],

  setup: [
    {
      kind: 'unmodelled',
      reason:
        'Awards a combo point after DODGING or fully resisting, so it needs a ' +
        'target that attacks back. The encounter can supply one -- ' +
        '`targetAttacks` -- and no Rogue profile sets it, so this is a ' +
        'PROFILE gap rather than an engine one and would need no new rule.',
    },
  ],

  elusiveness: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Shortens Vanish and Blind, neither implemented.' }],

  dirty_tricks: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Sap and Blind are not implemented.' }],

  /*
   * "Increases the critical strike chance of your Ambush ability by 45%."
   *
   * --------------------------------------------------------------------------
   * ITS REASON WAS FALSE RATHER THAN STALE, and it is one of three that shared
   * the same false premise. It read "Ambush requires stealth and is absent" --
   * and Ambush has been DECLARED since the owner ruled that Cutthroat's proc is
   * its stealth requirement. The ability was in the book, in the Rupture list
   * and dealing 1.6% of that profile's damage while three talents pointing at
   * it reported themselves out of scope.
   *
   * A `scope` TAG IS WHAT MADE IT INVISIBLE, which is worth stating plainly
   * because the tag is a good mechanism being misapplied: a ruled-out effect is
   * deliberately NOT a work queue item and is listed apart from live gaps, so
   * tagging a live effect `stealth` removed it from the only list anybody
   * re-reads. An ordinary `unmodelled` reason would have been counted.
   *
   * ORDINARY `abilityCrit`, 45% at 3/3, on the one ability it names.
   * --------------------------------------------------------------------------
   */
  improved_ambush: [{ kind: 'abilityCrit', abilityId: 'ambush' }],

  /*
   * "Gives you a 100% chance to add an additional combo point to your target
   * when using your Ambush, Garrote, or Cheap Shot ability." 33/67/100 by rank.
   *
   * --------------------------------------------------------------------------
   * ONE OF ITS THREE ABILITIES EXISTS, SO IT IS PARTLY MODELLED RATHER THAN
   * RULED OUT. The Ambush clause is live; Garrote and Cheap Shot are stealth
   * openers the owner has ruled out for good, so that half keeps the `stealth`
   * tag and will not expire. The old single entry claimed ALL THREE were absent.
   *
   * AT 3/3 IT IS 100%, so an Ambush is worth TWO combo points rather than one --
   * not a chance at all at the rank every Subtlety build takes, which is the
   * figure to check against: a rank-3 Ambush that awards one point is this
   * talent doing nothing.
   * --------------------------------------------------------------------------
   */
  initiative: [
    { kind: 'reaction', reactionId: 'initiative' },
    {
      kind: 'unmodelled',
      scope: 'stealth',
      reason:
        'Its Ambush clause APPLIES, through the `initiative` reaction in ' +
        'game/reactions/rogueTalents.ts. It also names Garrote and Cheap ' +
        'Shot, which are stealth openers and are out of scope for good.',
    },
  ],

  ghostly_strike: [{ kind: 'grantAbility', abilityId: 'ghostly_strike' }],

  /*
   * ITS OLD REASON WAS AN ENGINE CLAIM AND BOTH ITS CLAUSES ARE RULINGS.
   * "Distract is not implemented" reads as a gap waiting to be filled; the
   * talent is "increases the RADIUS of your Distract by 5 yds, and further
   * reduces the STEALTH DETECTION of distracted enemies" -- a radius is
   * `positioning` and stealth detection is `stealth`, and neither expires.
   * Distract itself is absent for the same reason rather than by omission.
   *
   * TAGGED `positioning`, because an entry carries one scope and the radius
   * clause is the one the talent is named for. The stealth half is stated in
   * the reason.
   */
  improved_distract: [
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason:
        'Both its clauses are ruled out: a Distract radius is positioning, ' +
        'and reducing stealth detection is stealth. Distract itself is not ' +
        'declared for the same reason.',
    },
  ],

  heightened_senses: [
    {
      kind: 'unmodelled',
      scope: 'stealth',
      reason: 'Stealth detection, and resistance to spells that are not cast.',
    },
  ],

  /*
   * ITS OLD REASON READ CLASSIC'S REQUIREMENT INTO A FOREVER ABILITY. It said
   * "adds combo points out of stealth, and every fight opens in combat" --
   * and the Forever tooltip has no stealth clause at all: "Adds 2 Combo Points
   * to your target. You must add to or use those combo points within 20 sec or
   * the combo points are lost." The capture marks it `changed` against Classic,
   * and that is the change.
   *
   * The second Rogue talent in this file to be counted among the eleven that
   * stealth makes inert while not being one of them. Cutthroat is the other.
   */
  premeditation: [{ kind: 'grantAbility', abilityId: 'premeditation' }],

  /*
   * BOTH CLAUSES, AND THE OLD REASON WAS WRONG ABOUT THE SECOND ONE. "Raises
   * Rupture damage, which is bundled into the same talent rather than being
   * separable" -- the two numbers are separate slots in the values file, and
   * `valueIndex` has always been able to pick one of them. Only the armor half
   * was genuinely blocked, and `armorPenetration` unblocks it.
   *
   * 9% OF THE ARMOR AND NOT 9% OF THE REDUCTION, which is the trap the stat's
   * own comment spells out: against a 3731-armor boss it takes mitigation from
   * 39.33% to 37.11%, so it is worth 2.23 points and not nine.
   */
  serrated_blades: [
    { kind: 'stat', stat: 'armorPenetration', operation: 'flat', valueIndex: 0 },
    { kind: 'abilityDamage', abilityId: 'rupture', valueIndex: 1 },
  ],

  dirty_deeds: [
    { kind: 'unmodelled', scope: 'stealth', reason: 'Cheap Shot and Garrote require stealth.' },
  ],

  /*
   * ITS REASON WAS A STATEMENT ABOUT THE ENGINE and it has been answered:
   * "nothing can reset a cooldown from content -- the engine owns them."
   * `AbilityBook.resetCooldowns` is the engine saying so, and Preparation is
   * its only caller.
   */
  preparation: [{ kind: 'grantAbility', abilityId: 'preparation' }],

  hemorrhage: [{ kind: 'grantAbility', abilityId: 'hemorrhage' }],

  /*
   * --------------------------------------------------------------------------
   * THE OWNER HAS ANSWERED THE THRESHOLD: "quietus is 35%", meaning the last
   * 35% of the fight by the same CLOCK Execute and Hammer of Wrath run on. So
   * this is no longer a question about the ruling -- it is a missing
   * declaration, and a specific one.
   *
   * WHAT IT NEEDS: a per-ability DAMAGE modifier active only while the fight is
   * in its final fraction. `inExecutePhase` is hardcoded to
   * `EXECUTE_PHASE_FRACTION` and wants a fraction argument; the modifier itself
   * is the shape `addWhileAura` has, conditioned on the clock rather than on an
   * aura -- and `Combatant.abilityModifierFor` has no simulation to read a
   * clock from, which is the actual work.
   *
   * BUILD IT WITH THE PRIEST'S EARLY DEMISE, which is the same capability at
   * 20% and for CRIT rather than damage. Two callers, two classes, one
   * mechanism -- and the modifier must go through the combatant rather than an
   * ability's `onCast`, by the standing rule that an ability which forgot to
   * look would be quietly wrong.
   *
   * NO PROFILE TAKES IT, so building it moves nothing and carries no baseline
   * risk. Its three abilities are Sinister Strike, Ghostly Strike and
   * Hemorrhage, and only Hemorrhage is cast by any Rogue list.
   * --------------------------------------------------------------------------
   */
  /*
   * --------------------------------------------------------------------------
   * THE OWNER'S 35% IS THE CLOCK, declared through the mechanism the PRIEST dive
   * built rather than the one this dive built. Both branches reached for the same
   * capability independently and named it differently -- this one
   * `abilityBelowTargetHealth` taking a list of ids, that one
   * `abilityDamageInFinalFraction` taking one id per entry.
   *
   * ONE MECHANISM, ONE NAME, and the merged project keeps the Priest's: "in final
   * fraction" describes the MODEL where "below target health" describes the
   * TOOLTIP, and the whole point of the ruling is that those are not the same
   * thing.
   *
   * THREE ENTRIES BECAUSE THE TOOLTIP NAMES THREE ABILITIES. `fractionIndex: 1`
   * is the 35 and `valueIndex: 0` is the 2-10%, which is the order
   * `values/rogue.json` states them at every rank -- [2,35] through [10,35].
   * Reading them the other way round gives a 35% bonus in the last 2% of the
   * fight: a plausible-looking number and the wrong one.
   * --------------------------------------------------------------------------
   */
  quietus: [
    { kind: 'abilityDamageInFinalFraction', abilityId: 'sinister_strike', fractionIndex: 1, valueIndex: 0 },
    { kind: 'abilityDamageInFinalFraction', abilityId: 'ghostly_strike', fractionIndex: 1, valueIndex: 0 },
    { kind: 'abilityDamageInFinalFraction', abilityId: 'hemorrhage', fractionIndex: 1, valueIndex: 0 },
  ],

  /*
   * CUTTHROAT IS NOT A STEALTH TALENT, and its old reason -- "Makes Ambush
   * castable, and Ambush is absent" -- was true of the second half and hid the
   * first. It is an in-combat proc whose entire purpose is to let Ambush be
   * used WITHOUT stealth, so a fight that opens in combat is the case it was
   * written for rather than the case that kills it. It was nonetheless counted
   * among the eleven Rogue talents inert for exactly that reason.
   *
   * The ruleset owner's ruling is what keeps it this small: Ambush is simply
   * castable while the buff is up, and there is no stealth system at all.
   */
  cutthroat: [{ kind: 'reaction', reactionId: 'cutthroat' }],

  /*
   * APPLIED, AND IT COULD NOT BE A REACTION. "When your Rupture ability deals
   * periodic damage, the Energy cost of your next Hemorrhage or Backstab within
   * 10 sec is reduced by 3, stacking up to 5 times."
   *
   * A PERIODIC TICK RUNS NO REACTIONS -- `dealDamage` excludes them explicitly,
   * because a bleed ticking is not an attack anybody parries -- so the old
   * reason's "the tick is reachable" was the half that was wrong, and the half
   * it doubted was the easy one. The tick reaches this by APPLYING AN AURA from
   * inside `ruptureAura`, which is the only thing that runs there.
   *
   * THE NUMBER TRAVELS AS AN `abilityBonus` ON RUPTURE, the same hook Improved
   * Slice and Dice uses for its duration: the tick needs the talent's value and
   * an aura definition cannot read an allocation. A Rogue without the talent
   * passes nothing and applies nothing, so the aura simply never exists.
   *
   * AND THE COST REDUCTION IS FLAT. `CastModifier.costFraction` would be right
   * for a 380-mana spell and is wrong for a 35-energy strike -- three energy is
   * three energy however the strike is priced -- so `costReduction` is the
   * field, and it was the missing sibling of `castTimeReductionMs`.
   */
  thousand_cuts: [
    { kind: 'abilityBonus', abilityId: 'rupture', key: THOUSAND_CUTS_BONUS },
  ],
};
