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
 *   REACTIVE HOOKS   Relentless Strikes and Seal Fate both need a hook on
 *                    "a finisher was cast" and "an ability that awards a combo
 *                    point critted". Reactions fire on damage, not on either.
 *   ARMOR PENETRATION  ignoring a percentage of armor, which the damage
 *                    pipeline has no form for. Weaponmaster's mace clause is
 *                    the Warrior's version of exactly this.
 * ----------------------------------------------------------------------------
 */
export const ROGUE_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Assassination -------------------------------------------------------

  improved_gouge: [
    { kind: 'unmodelled', reason: 'Lengthens Gouge, which is an incapacitate and out of scope.' },
  ],

  remorseless_attacks: [
    {
      kind: 'unmodelled',
      reason: 'Triggers after killing an enemy. Nothing dies here but the player.',
    },
  ],

  malice: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  ruthlessness: [
    {
      kind: 'unmodelled',
      reason:
        'Returns a combo point when a FINISHER is cast, and a reaction fires ' +
        'on damage rather than on a cast. Needs an on-cast hook, which ' +
        'Relentless Strikes and Seal Fate also want.',
    },
  ],

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

  relentless_strikes: [
    {
      kind: 'unmodelled',
      reason:
        'Restores energy on a FINISHER, per combo point spent. A reaction ' +
        'fires on damage and cannot see either, so this needs an on-cast hook ' +
        'that knows what was spent.',
    },
  ],

  improved_expose_armor: [
    { kind: 'abilityCost', abilityId: 'expose_armor' },
    {
      kind: 'unmodelled',
      reason:
        'The energy reduction applies. Refunding 2 combo points when cast at ' +
        '5 does not: it needs the same on-cast hook.',
    },
  ],

  lethality: [
    {
      kind: 'unmodelled',
      reason:
        'Raises crit DAMAGE for six named abilities. `critDamageBonus` is ' +
        'whole-character and `abilityCrit` is crit CHANCE, so neither fits; ' +
        'it needs a per-ability crit multiplier.',
    },
  ],

  vile_poisons: [{ kind: 'unmodelled', reason: 'Poisons are not implemented.' }],

  cold_blood: [{ kind: 'grantAbility', abilityId: 'cold_blood' }],

  improved_poisons: [{ kind: 'unmodelled', reason: 'Poisons are not implemented.' }],

  vigor: [{ kind: 'resourceMax', resource: 'energy' }],

  mutilate: [{ kind: 'grantAbility', abilityId: 'mutilate' }],

  improved_kidney_shot: [
    { kind: 'unmodelled', reason: 'Keyed to a stun, which the project owner classes as out of scope.' },
  ],

  seal_fate: [
    {
      kind: 'unmodelled',
      reason:
        'Adds a combo point when an ability that awards one CRITS. A reaction ' +
        'sees the crit but not whether the ability awards a point, so this ' +
        'needs the builders to declare that they do.',
    },
  ],

  venom: [
    { kind: 'unmodelled', reason: 'A finisher whose whole effect is on poisons.' },
  ],

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

  improved_sprint: [{ kind: 'unmodelled', reason: 'Movement, which is not modelled.' }],

  improved_kick: [{ kind: 'unmodelled', reason: 'Silences, and nothing here casts.' }],

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

  camouflage: [{ kind: 'unmodelled', reason: 'Stealth, and every fight opens in combat.' }],

  master_of_deception: [{ kind: 'unmodelled', reason: 'Stealth detection.' }],

  opportunity: [
    { kind: 'abilityDamage', abilityId: 'backstab' },
    { kind: 'abilityDamage', abilityId: 'mutilate' },
    {
      kind: 'unmodelled',
      reason: 'It also covers Garrote and Ambush, which require stealth and are absent.',
    },
  ],

  setup: [
    {
      kind: 'unmodelled',
      reason: 'Awards a combo point after DODGING, so it needs the target to attack back.',
    },
  ],

  elusiveness: [{ kind: 'unmodelled', reason: 'Shortens Vanish and Blind, neither implemented.' }],

  dirty_tricks: [{ kind: 'unmodelled', reason: 'Sap and Blind are not implemented.' }],

  improved_ambush: [{ kind: 'unmodelled', reason: 'Ambush requires stealth and is absent.' }],

  initiative: [{ kind: 'unmodelled', reason: 'Keyed to the stealth openers, which are absent.' }],

  ghostly_strike: [{ kind: 'grantAbility', abilityId: 'ghostly_strike' }],

  improved_distract: [{ kind: 'unmodelled', reason: 'Distract is not implemented.' }],

  heightened_senses: [
    { kind: 'unmodelled', reason: 'Stealth detection, and resistance to spells that are not cast.' },
  ],

  premeditation: [
    {
      kind: 'unmodelled',
      reason: 'Adds combo points out of stealth, and every fight opens in combat.',
    },
  ],

  serrated_blades: [
    {
      kind: 'unmodelled',
      reason:
        'Ignores a percentage of the target armor, which the damage pipeline ' +
        'cannot express, and raises Rupture damage, which is bundled into the ' +
        'same talent rather than being separable.',
    },
  ],

  dirty_deeds: [{ kind: 'unmodelled', reason: 'Cheap Shot and Garrote require stealth.' }],

  preparation: [
    {
      kind: 'unmodelled',
      reason:
        'Resets the cooldown of every other Rogue ability. Nothing can reset ' +
        'a cooldown from content -- the engine owns them.',
    },
  ],

  hemorrhage: [{ kind: 'grantAbility', abilityId: 'hemorrhage' }],

  quietus: [
    {
      kind: 'unmodelled',
      reason:
        'Conditional on the target being below 35% health. The training dummy ' +
        'has a hundred thousand health and takes a fraction of it, so the ' +
        'condition could never fire -- the same reason Execute is gated on ' +
        'TIME rather than health here.',
    },
  ],

  cutthroat: [{ kind: 'unmodelled', reason: 'Makes Ambush castable, and Ambush is absent.' }],

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
