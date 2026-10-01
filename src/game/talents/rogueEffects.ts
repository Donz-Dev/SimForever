import type { TalentEffects } from './TalentEffect';

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
 * THE INERT ONES CLUSTER, and the clusters are worth reading before building
 * another class, because several are shared:
 *
 *   POISONS          five talents. Not a missing number -- a missing system.
 *                    Poisons are weapon-bound procs, which the engine can
 *                    express, but they need the poison items and an
 *                    application mechanic and neither is captured.
 *   STEALTH          six talents. Every fight opens in combat, so nothing here
 *                    is ever stealthed.
 *   ~~REACTIVE HOOKS~~  DONE. Four talents keyed off a CAST rather than a hit,
 *                    and `castReaction` is the effect kind that reaches them.
 *                    Seal Fate needed only one new fact, not a new hook:
 *                    `Ability.comboPointsAwarded`, so a crit reaction can ask
 *                    whether the ability that critted builds points.
 *   ARMOR PENETRATION  ignoring a percentage of armor, which the damage
 *                    pipeline has no form for. Weaponmaster's mace clause is
 *                    the Warrior's version of exactly this.
 * ----------------------------------------------------------------------------
 */
export const ROGUE_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Assassination -------------------------------------------------------

  improved_gouge: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Lengthens Gouge, which is an incapacitate and out of scope.' },
  ],

  remorseless_attacks: [
    {
      kind: 'unmodelled',
      reason: 'Triggers after killing an enemy. Nothing dies here but the player.',
    },
  ],

  malice: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  ruthlessness: [{ kind: 'castReaction', reactionId: 'ruthlessness' }],

  murder: [
    {
      kind: 'unmodelled',
      reason: 'Conditional on creature type, which no combatant here carries.',
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

  lethality: [
    /*
     * ------------------------------------------------------------------------
     * "THE CRITICAL STRIKE DAMAGE BONUS OF YOUR SINISTER STRIKE, GOUGE,
     * BACKSTAB, MUTILATE, GHOSTLY STRIKE, AND HEMORRHAGE ABILITIES BY 20%."
     *
     * DECLARED NOW, AND THE DECLARATION IS SHARED WITH THE WARLOCK'S PANDEMIC.
     * Its old reason was exact -- none of the three scopes selects a LIST, and
     * `critMultiplierBonus` on `AbilityModifiers` existed with nothing reaching
     * it -- and `abilityCritDamage` is the missing declaration it named. Two
     * talents in two classes wanted the identical mechanism, so it was built
     * once rather than twice.
     *
     * `table: 'melee-special'` GIVES THE RIGHT HALF. A melee crit multiplies by
     * 2, so the bonus half is 1.0 and +20% takes a crit to 2.2x. Reading the
     * spell figure would give 2.1x -- plausible, and half the talent.
     *
     * ALL THREE ROGUE PROFILES TAKE IT: Venom 5/5, Combat 4/5, Rupture 2/5.
     *
     * GOUGE IS NOT DECLARED, which the clause below says. It is a crowd-control
     * ability whose damage is incidental, and no list casts one.
     * ------------------------------------------------------------------------
     */
    {
      kind: 'abilityCritDamage',
      abilityIds: ['sinister_strike', 'backstab', 'mutilate', 'ghostly_strike', 'hemorrhage'],
      table: 'melee-special',
    },
    {
      kind: 'unmodelled',
      reason:
        'Gouge is the one ability of the six it names that this project does ' +
        'not declare -- crowd control, which is out of scope, with incidental ' +
        'damage no list would cast it for. The other five carry it.',
    },
  ],

  /*
   * APPLIED, and not through this table. Both poison talents are read by
   * `poisonReactions` off the allocation directly, for the same reason
   * Windfury Weapon is a class reaction that reads one talent number: a Rogue
   * who spent no points still applies poisons, and a talent-GRANTED proc would
   * delete them for that Rogue while a second registration would double them.
   *
   * Their REASONS HAVE EXPIRED -- both said "Poisons are not implemented", and
   * they are now. The dispel-resistance half of Vile Poisons is all that is
   * left unmodelled, and nothing here dispels.
   */
  vile_poisons: [
    {
      kind: 'unmodelled',
      reason:
        'Its damage bonus APPLIES, read by `poisonReactions`. Only the "resist ' +
        'dispel effects" half does nothing: nothing here dispels.',
    },
  ],

  cold_blood: [{ kind: 'grantAbility', abilityId: 'cold_blood' }],

  improved_poisons: [
    {
      kind: 'unmodelled',
      reason:
        'Its apply-chance bonus APPLIES, read by `poisonReactions`. Only the ' +
        '"chance to not consume a charge" half does nothing: charges are ' +
        'infinite here, on the ruleset owner’s instruction.',
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
   * ONE VALUE, TWO ABILITIES, AND THEY DIFFER. The talent gives Backstab 30%
   * crit and Mutilate 15%, and `abilityCrit` reads a talent's value with no
   * way to say WHICH value -- unlike `reaction`, which has `valueIndex`.
   *
   * Backstab takes the effect because it is the larger of the two and the one
   * the Subtlety build is named for; Mutilate's half is reported rather than
   * approximated at the wrong figure.
   */
  puncturing_wounds: [
    { kind: 'abilityCrit', abilityId: 'backstab' },
    {
      kind: 'unmodelled',
      reason:
        'Backstab crit applies. Mutilate half applies at 15% rather than 30% ' +
        'and `abilityCrit` cannot select a value, so it is left off rather ' +
        'than doubled. Its third clause, a bleed on Backstab, is not captured.',
    },
  ],

  deflection: [{ kind: 'stat', stat: 'parryChance', operation: 'flat' }],

  precision: [{ kind: 'stat', stat: 'hitChance', operation: 'flat' }],

  endurance: [
    { kind: 'unmodelled', reason: 'Shortens Sprint and Evasion, neither of which is implemented.' },
  ],

  riposte: [
    {
      kind: 'unmodelled',
      reason:
        'Becomes active after PARRYING, so it needs the target to attack, and ' +
        'it disarms, which is not modelled.',
    },
  ],

  improved_sprint: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Movement, which is not modelled.' }],

  improved_kick: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Silences, and nothing here casts.' }],

  flawless_execution: [{ kind: 'abilityCost', abilityId: 'eviscerate' }],

  dual_wield_specialization: [{ kind: 'offHandDamage' }],

  blade_flurry: [{ kind: 'grantAbility', abilityId: 'blade_flurry' }],

  hack_and_slash: [
    {
      kind: 'unmodelled',
      reason:
        'Weapon-dependent, and its clauses are an extra attack, armor ' +
        'penetration and crit. The armor clause has no form in the damage ' +
        'pipeline -- the same gap as the Warrior Weaponmaster mace clause.',
    },
  ],

  weapon_expertise: [
    {
      kind: 'unmodelled',
      reason:
        'Reduces the chance to be dodged or parried. The attack tables read ' +
        'the DEFENDER for both, and nothing lets an attacker lower them.',
    },
  ],

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

  opportunity: [
    { kind: 'abilityDamage', abilityId: 'backstab' },
    { kind: 'abilityDamage', abilityId: 'mutilate' },
    {
      kind: 'unmodelled',
      scope: 'stealth',
      reason: 'It also covers Garrote and Ambush, which require stealth and are absent.',
    },
  ],

  setup: [
    {
      kind: 'unmodelled',
      reason: 'Awards a combo point after DODGING, so it needs the target to attack back.',
    },
  ],

  elusiveness: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Shortens Vanish and Blind, neither implemented.' }],

  dirty_tricks: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Sap and Blind are not implemented.' }],

  improved_ambush: [
    { kind: 'unmodelled', scope: 'stealth', reason: 'Ambush requires stealth and is absent.' },
  ],

  initiative: [
    { kind: 'unmodelled', scope: 'stealth', reason: 'Keyed to the stealth openers, which are absent.' },
  ],

  ghostly_strike: [{ kind: 'grantAbility', abilityId: 'ghostly_strike' }],

  improved_distract: [{ kind: 'unmodelled', reason: 'Distract is not implemented.' }],

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

  serrated_blades: [
    {
      kind: 'unmodelled',
      reason:
        'Ignores a percentage of the target armor, which the damage pipeline ' +
        'cannot express, and raises Rupture damage, which is bundled into the ' +
        'same talent rather than being separable.',
    },
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
  quietus: [
    {
      kind: 'unmodelled',
      reason:
        'Its 2-10% bonus below 35% target health is not read. The threshold is ' +
        'the CLOCK by the ruling of the project owner -- the last 35% of the ' +
        'fight, the same rule Execute runs on at 20% -- so this is a missing ' +
        'declaration rather than a property of the target: a per-ability damage ' +
        'modifier conditional on the final fraction of the fight, which nothing ' +
        'expresses yet. Early Demise on the Priest wants the same mechanism at 20%.',
    },
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

  thousand_cuts: [
    {
      kind: 'unmodelled',
      reason:
        'Reduces the cost of the NEXT Hemorrhage or Backstab when Rupture ' +
        'ticks. The tick is reachable; a one-shot cost reduction on a named ' +
        'ability is not -- `abilityCost` is a standing reduction.',
    },
  ],
};
