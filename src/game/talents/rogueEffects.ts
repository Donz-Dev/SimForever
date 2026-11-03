import type { TalentEffects } from './TalentEffect';

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
   * The duration bonus reaches the ability as a named number, which Slice and
   * Dice reads when it builds its aura. `abilityBonus` is the same hook
   * Improved Charge uses for the rage it adds.
   */
  improved_slice_and_dice: [
    { kind: 'abilityBonus', abilityId: 'slice_and_dice', key: 'durationPercent' },
  ],

  relentless_strikes: [{ kind: 'castReaction', reactionId: 'relentless_strikes' }],

  // `[energy, refund, at points]`: the refund scales with rank since 1.60.1.70755.
  improved_expose_armor: [
    { kind: 'abilityCost', abilityId: 'expose_armor', valueIndex: 0 },
    { kind: 'castReaction', reactionId: 'improved_expose_armor', valueIndex: 1 },
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
      /*
       * ITS DEAD HALF IS A DISPEL, which the owner ruled out of scope on
       * 2026-10-07 -- so the clause is a DECISION now rather than work. The
       * reason already said why in its own words: nothing here dispels
       * anything, which is half of what makes the ruling a ruling.
       */
      scope: 'dispel',
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
   * A PASSIVE ON SHANK SINCE 1.60.1.70755, no longer a finisher: "Causes your
   * Shank ability to increase your Poison damage by 30% and your chance to
   * apply Poisons by 20% for 6 sec." A flag on Shank, which applies the window.
   * Its +30% is ADDED to Vile Poisons' rather than multiplied, as it was.
   */
  venom: [{ kind: 'abilityFlag', abilityId: 'shank', key: 'venom' }],

  /*
   * BLOOD SPLATTER (1.60.1.70755): "Increases the duration of your Rupture
   * ability by 6 sec and your Garrote ability by 9 sec." A flag on each; the
   * seconds are on the auras.
   */
  blood_splatter: [
    { kind: 'abilityFlag', abilityId: 'rupture', key: 'bloodSplatter' },
    { kind: 'abilityFlag', abilityId: 'garrote', key: 'bloodSplatter' },
  ],


  // --- Combat --------------------------------------------------------------

  /*
   * COUP DE GRACE, Improved Eviscerate renamed at 1.60.1.70755: "Increases the
   * damage done by your Eviscerate ability by {0}%, and the damage and storage
   * rate of your Death Mark ability by {1}%." The Death Mark damage is its
   * burst's id; the storage rate rides on the ability.
   */
  coup_de_grace: [
    { kind: 'abilityDamage', abilityId: 'eviscerate', valueIndex: 0 },
    { kind: 'abilityDamage', abilityId: 'death_mark', valueIndex: 1 },
    { kind: 'abilityBonus', abilityId: 'death_mark', key: 'coupDeGraceStorage', valueIndex: 1 },
  ],

  /* EFFICIENT STRIKES, Improved Sinister Strike renamed and widened to Hemorrhage. */
  efficient_strikes: [
    { kind: 'abilityCost', abilityId: 'sinister_strike' },
    { kind: 'abilityCost', abilityId: 'hemorrhage' },
  ],

  /* COMPOSURE (1.60.1.70755): Poised takes 5/10 more off. See `poised.ts`. */
  composure: [{ kind: 'abilityBonus', abilityId: 'poised', key: 'composure' }],

  /*
   * FLASH OF STEEL (1.60.1.70755): "Increases the Energy generated by your
   * Shank ability by {0} and reduces its cooldown by {1} sec."
   */
  flash_of_steel: [
    { kind: 'abilityBonus', abilityId: 'shank', key: 'flashOfSteelEnergy', valueIndex: 0 },
    { kind: 'abilityCooldown', abilityId: 'shank', unit: 'seconds', valueIndex: 1 },
  ],


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
   * ALL THREE CLAUSES, EACH GATED ON A DIFFERENT WEAPON -- AND A DUAL WIELDER
   * CAN HAVE TWO OF THEM LIVE AT ONCE.
   *
   * ==========================================================================
   * "ONLY ONE OF THE THREE IS EVER LIVE FOR A GIVEN CHARACTER" IS WHAT THIS
   * COMMENT USED TO SAY, AND IT WAS A CONSEQUENCE OF THE BUG RATHER THAN A
   * FACT ABOUT THE TALENT. The owner's ruling: "these are global effects ...
   * if you have a MH mace, and an off hand Dagger/Fist the off hand gives a
   * global 5% crit chance to everything, and the mace gives a global 15%
   * armor pen to everything."
   *
   * The two stat clauses read EITHER HAND now -- `weaponIn: 'eitherHand'`,
   * which is where the ruling is written down.
   * ==========================================================================
   *
   *   Axe/Sword   5% chance of an extra attack, and the owner's STATED
   *               EXCEPTION to the other two: "it can only proc when you use
   *               that weapon and it always triggers a MH swing regardless of
   *               weapon type". So it is a proc, gated INSIDE the reaction on
   *               the weapon that SWUNG, and `weaponIn` would be the wrong
   *               tool -- a build clause cannot ask which hand is swinging.
   *               Sword Specialization on the Warrior is the same clause and
   *               was settled the same way.
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
   * ONLY THE COMBAT PROFILE TAKES THIS, AND IT HOLDS A SWORD AND A DAGGER --
   * so TWO clauses are live: the sword earns the extra attack and the dagger
   * earns the 5% crit. The mace clause is reported unmet by `talentBuild`
   * rather than silently skipped.
   *
   * THIS SENTENCE SAID "it holds two swords" AND THAT HAD STOPPED BEING TRUE
   * when every preset moved into the generated benchmark gear. It is the
   * second half of what made the bug invisible: the comment described a
   * character for whom the main-hand reading and the either-hand reading give
   * the same answer, so a reader checking it would have found nothing wrong.
   * `hackAndSlash.test.ts` asserts the preset's own delta now, which is a
   * claim about the build rather than about the gear it happens to wear.
   */
  hack_and_slash: [
    { kind: 'reaction', reactionId: 'hack_and_slash', valueIndex: 0 },
    {
      kind: 'stat',
      stat: 'critChance',
      operation: 'flat',
      valueIndex: 1,
      requires: { weaponTypes: ['dagger', 'fist'], weaponIn: 'eitherHand' },
    },
    {
      kind: 'stat',
      stat: 'armorPenetration',
      operation: 'flat',
      valueIndex: 2,
      requires: { weaponTypes: ['mace'], weaponIn: 'eitherHand' },
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

  // Sinister Strike and Eviscerate at 5/10/15% since 1.60.1.70755; Backstab left it.
  aggression: [
    { kind: 'abilityDamage', abilityId: 'sinister_strike' },
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
  /*
   * GARROTE IS DECLARED NOW, on the owner's ruling, so the `stealth` tag this
   * carried for its Garrote clause has expired -- the second time a scope tag
   * on this talent has been overtaken by a ruling that widened stealth. The
   * id reaches the bleed's TICKS, because a tick carries its aura's id.
   */
  opportunity: [
    { kind: 'abilityDamage', abilityId: 'backstab' },
    { kind: 'abilityDamage', abilityId: 'mutilate' },
    { kind: 'abilityDamage', abilityId: 'ambush' },
    { kind: 'abilityDamage', abilityId: 'garrote' },
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
    // GARROTE, NOW DECLARED: its application deals no damage for a `dealt`
    // reaction to see, so the chance rides on the ability and is rolled there.
    { kind: 'abilityBonus', abilityId: 'garrote', key: 'initiativeChance' },
    {
      kind: 'unmodelled',
      scope: 'stealth',
      reason:
        'Its Ambush and Garrote clauses APPLY. It also names Cheap Shot, a ' +
        'stealth opener this project does not declare.',
    },
  ],

  ghostly_strike: [{ kind: 'grantAbility', abilityId: 'ghostly_strike' }],


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

  quick_getaway: [
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason: 'More Sapped targets and movement speed after a Sap. Sap is crowd control and movement is positioning.',
    },
  ],

  /*
   * BOOT KNIFE (1.60.1.70755): "Grants your Shank ability a {0}% chance to add
   * {1} Combo Points to the target."
   */
  boot_knife: [
    { kind: 'abilityBonus', abilityId: 'shank', key: 'bootKnifeChance', valueIndex: 0 },
    { kind: 'abilityBonus', abilityId: 'shank', key: 'bootKnifePoints', valueIndex: 1 },
  ],

  /*
   * DEATH MARK, the Subtlety capstone at 1.60.1.70755: the ability, and the two
   * reactions that fill its store -- a hit half and a tick half. Valueless: the
   * figures are on the ability and its aura.
   */
  death_mark: [
    { kind: 'grantAbility', abilityId: 'death_mark' },
    { kind: 'reaction', reactionId: 'death_mark_hits', valueless: true },
    { kind: 'reaction', reactionId: 'death_mark_ticks', valueless: true },
  ],

  /*
   * REMOVED AT 1.60.1.70755, and gone from this table with them: Murder,
   * Improved Distract, Quietus, Cutthroat and Thousand Cuts; Improved
   * Eviscerate and Improved Sinister Strike renamed to Coup de Grace and
   * Efficient Strikes above. `git log` has every one.
   */
};
