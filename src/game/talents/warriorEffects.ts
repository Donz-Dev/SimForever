import type { TalentEffects } from './TalentEffect';

/**
 * What every Warrior talent does, by talent id.
 *
 * ALL 53 have an entry. A talent that cannot be modelled says so and says why,
 * rather than being absent — absence would be indistinguishable from an
 * oversight, and this file is the only place that can tell the difference. A
 * test asserts the coverage both ways, which is how three entries lost to a
 * careless edit were caught.
 *
 * 25 are fully modelled and 8 more are PARTLY modelled — something real plus an
 * `unmodelled` entry naming the part that is missing. 21 do nothing at all.
 *
 * NINE GRANT AN ABILITY, and those are where being wrong costs most: an ability
 * handed to a character who never took its talent is free damage that nothing
 * in the results explains, which is exactly what happened when every warrior
 * had all three 31-point capstones at once. All nine declare `grantAbility`, so
 * `abilitiesForClass` gates them from one list. Four have an implemented
 * ability today; the other five declare the grant anyway, so they are gated
 * correctly the moment their ability exists rather than being remembered later.
 *
 * The reasons a talent is unmodelled fall into a few groups, and each names its
 * own specific obstacle so the list doubles as the work queue:
 *
 *   - a concept the engine does not have (threat, movement, stuns, multiple
 *     targets, defense skill)
 *   - the ability it modifies is itself inert, pending its numbers from the
 *     ruleset owner (Bloodrage, Berserker Rage, Shield Wall, Shield Block)
 *   - nothing attacks the player, so nothing can trigger it
 *   - it needs a mechanism that exists but is not wired to talents yet
 *     (combat-start auras)
 *
 * The Gear panel's "Equipped but not simulated" does the same job for items,
 * and the Talent panel prints these the same way.
 *
 * Edge cases, interpretations and the talents that are deliberately only PARTLY
 * modelled are all written up in `docs/talent-effects.md`. Read that before
 * deciding a reason below is out of date -- three of them already were.
 *
 * The NUMBERS are not here. They live in `src/data/talents/values/warrior.json`,
 * per rank, hand-editable. This file says what a talent does with its number.
 */
export const WARRIOR_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // ---------------------------------------------------------------------
  // Arms
  // ---------------------------------------------------------------------
  improved_heroic_strike: [{ kind: 'abilityCost', abilityId: 'heroic_strike' }],

  // Parry is held in percentage POINTS, like dodge and crit, so no scaling.
  deflection: [{ kind: 'stat', stat: 'parryChance', operation: 'flat' }],

  // Scales the bleed, not the cast: a periodic tick carries the AURA's id.
  improved_rend: [{ kind: 'abilityDamage', abilityId: 'rend' }],


  improved_charge: [{ kind: 'abilityBonus', abilityId: 'charge', key: 'rage' }],

  improved_tactical_mastery: [
    {
      kind: 'unmodelled',
      reason: 'Rage retained on a stance change. Stances are defined but gate nothing.',
    },
  ],

  improved_overpower: [{ kind: 'abilityCrit', abilityId: 'overpower' }],


  anger_management: [
    {
      kind: 'unmodelled',
      reason:
        'A passive that ticks rage in combat. That is an aura with a periodic ' +
        'effect, applied at combat start — the mechanism exists, but no talent is ' +
        'wired to apply one yet.',
    },
  ],

  deep_wounds: [{ kind: 'reaction', reactionId: 'deep_wounds' }],

  spearing_strike: [{ kind: 'grantAbility', abilityId: 'spearing_strike' }],

  // Covers auto attacks as well as abilities, so it is a whole-character
  // multiplier rather than a per-ability one -- conditional on what is held.
  two_handed_weapon_specialization: [
    { kind: 'conditionalDamage', requires: { twoHanded: true } },
  ],

  impale: [{ kind: 'critDamageBonus' }],


  bloodthrill: [{ kind: 'reaction', reactionId: 'bloodthrill' }],

  sweeping_strikes: [
    { kind: 'grantAbility', abilityId: 'sweeping_strikes' },
    {
      kind: 'unmodelled',
      reason:
        'The ability itself is not implemented -- it is not in the Warrior '+
        'ability spreadsheet, so it has no cost, cooldown or damage. The GRANT '+
        'is declared above, so the moment the ability exists it is gated '+
        'correctly rather than handed to everyone.',
    },
  ],

  /*
   * Three clauses, one per weapon family, and only two of them can be modelled.
   * The axe and polearm crit is expressible; the sword extra-attack chance
   * needs a reaction that can trigger another swing, which `extraAttack`
   * supports but nothing wires to a talent yet; the mace and staff armor
   * ignore has no home in the damage pipeline at all.
   *
   * The crit clause applies on its own rather than the talent being written off
   * whole: with an axe equipped it is exactly right, and with anything else it
   * reports as not applying rather than silently contributing.
   */
  weaponmaster: [
    { kind: 'conditionalCrit', requires: { weaponTypes: ['axe', 'polearm'] } },
    {
      kind: 'unmodelled',
      reason:
        'PARTIAL: the axe and polearm crit bonus works. The mace and staff ' +
        'clause ignores a percentage of the target armor, which the damage ' +
        'pipeline cannot express, and the sword clause needs a talent-granted ' +
        'reaction that triggers an extra attack.',
    },
  ],

  /*
   * Two effects that scale and one that does not. "Slam no longer interrupts
   * your melee swing time" is granted by both ranks, and is worth far more than
   * the quarter second of cast time: without it a Slam costs a whole swing.
   */
  improved_slam: [
    { kind: 'abilityCastTime', abilityId: 'slam' },
    { kind: 'abilityGcd', abilityId: 'slam' },
    { kind: 'abilityHoldsSwing', abilityId: 'slam' },
  ],

  improved_hamstring: [
    { kind: 'unmodelled', reason: 'Immobilises the target. There is no movement to prevent.' },
  ],

  mortal_strike: [{ kind: 'grantAbility', abilityId: 'mortal_strike' }],

  // ---------------------------------------------------------------------
  // Fury
  // ---------------------------------------------------------------------
  booming_voice: [
    { kind: 'unmodelled', reason: 'Shout radius. The encounter has no positions.' },
  ],

  // Crit is held in percentage POINTS, so "+1%" is a flat +1 and needs no scale.
  cruelty: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  iron_will: [
    { kind: 'unmodelled', reason: 'Stun and fear duration. Nothing stuns or fears the player.' },
  ],

  unbridled_wrath: [{ kind: 'reaction', reactionId: 'unbridled_wrath' }],

  improved_cleave: [{ kind: 'abilityCost', abilityId: 'cleave' }],

  piercing_howl: [
    { kind: 'grantAbility', abilityId: 'piercing_howl' },
    {
      kind: 'unmodelled',
      reason:
        'The ability itself is not implemented -- it is not in the Warrior '+
        'ability spreadsheet, so it has no cost, cooldown or damage. The GRANT '+
        'is declared above, so the moment the ability exists it is gated '+
        'correctly rather than handed to everyone.',
    },
  ],

  blood_craze: [
    {
      kind: 'unmodelled',
      reason: 'Heals after being critically hit. Nothing attacks the player.',
    },
  ],

  boundless_rage: [{ kind: 'resourceMax', resource: 'rage' }],

  dual_wield_specialization: [
    {
      kind: 'unmodelled',
      reason:
        'Three effects at once: off-hand damage, off-hand rage generation and ' +
        'off-hand hit chance. `createPlayer` could take the damage part through ' +
        '`offHandDamageMultiplier`, but hit chance is a whole-character stat here ' +
        'and rage generation is proportional with no per-hand term — so modelling ' +
        'one third of the talent would understate it by an unknown amount rather ' +
        'than visibly not working.',
    },
  ],

  raging_blows: [
    {
      kind: 'unmodelled',
      reason:
        'Gives Whirlwind an off-hand strike, which its `onCast` does not do, and ' +
        "also reduces Cleave's cost. The second half alone is not the talent.",
    },
  ],

  enrage: [{ kind: 'unmodelled', reason: 'Triggers on being hit. Nothing attacks the player.' }],

  improved_execute: [{ kind: 'abilityCost', abilityId: 'execute' }],

  precision: [{ kind: 'stat', stat: 'hitChance', operation: 'flat' }],

  death_wish: [
    { kind: 'grantAbility', abilityId: 'death_wish' },
    {
      kind: 'unmodelled',
      reason:
        'The ability itself is not implemented -- it is not in the Warrior '+
        'ability spreadsheet, so it has no cost, cooldown or damage. The GRANT '+
        'is declared above, so the moment the ability exists it is gated '+
        'correctly rather than handed to everyone.',
    },
  ],

  improved_intercept: [{ kind: 'abilityCooldown', abilityId: 'intercept', unit: 'seconds' }],

  improved_berserker_rage: [
    {
      kind: 'unmodelled',
      reason:
        'Modifies Berserker Rage, which is castable but completely inert pending ' +
        'its effect values from the ruleset owner.',
    },
  ],

  flurry: [{ kind: 'reaction', reactionId: 'flurry' }],

  bloodthirst: [{ kind: 'grantAbility', abilityId: 'bloodthirst' }],

  // ---------------------------------------------------------------------
  // Protection
  // ---------------------------------------------------------------------
  /*
   * Two values: block chance is the first, the rage proc chance the second.
   * Both halves are modelled and NEITHER can fire, because nothing attacks the
   * player -- so the talent also says that out loud rather than appearing to
   * work.
   */
  shield_specialization: [
    { kind: 'stat', stat: 'blockChance', operation: 'flat' },
    { kind: 'reaction', reactionId: 'shield_specialization', valueIndex: 1 },
    {
      kind: 'unmodelled',
      reason:
        'Both halves are implemented -- block chance and the rage proc -- but ' +
        'both need the warrior to be ATTACKED, and nothing attacks the player ' +
        'yet. They will work the moment something does.',
    },
  ],

  anticipation: [
    {
      kind: 'unmodelled',
      reason:
        'Defense skill, which the player does not have. Defense skill exists only ' +
        'for the target, where it shapes the combat table.',
    },
  ],

  improved_bloodrage: [
    { kind: 'unmodelled', reason: 'Modifies Bloodrage, which is castable but inert.' },
  ],

  toughness: [
    {
      kind: 'unmodelled',
      reason:
        'Raises armor FROM ITEMS by a percentage. The engine holds one armor ' +
        'number, base and gear combined, so a percentage here would also scale ' +
        'the base and overstate the talent.',
    },
  ],

  improved_thunder_clap: [{ kind: 'abilityCost', abilityId: 'thunder_clap' }],

  last_stand: [
    { kind: 'grantAbility', abilityId: 'last_stand' },
    {
      kind: 'unmodelled',
      reason:
        'The ability itself is not implemented -- it is not in the Warrior '+
        'ability spreadsheet, so it has no cost, cooldown or damage. The GRANT '+
        'is declared above, so the moment the ability exists it is gated '+
        'correctly rather than handed to everyone.',
    },
  ],

  master_of_defense: [
    { kind: 'unmodelled', reason: 'Rage on a dodge or parry by the player, which never happens.' },
  ],

  improved_revenge: [
    { kind: 'abilityDamage', abilityId: 'revenge' },
    {
      kind: 'unmodelled',
      reason:
        'The damage scaling works, but Revenge needs the player to be attacked ' +
        'to open its window and nothing attacks the player, so it never fires.',
    },
  ],


  defiance: [{ kind: 'unmodelled', reason: 'Threat, which the engine does not track.' }],

  improved_sunder_armor: [{ kind: 'abilityCost', abilityId: 'sunder_armor_cast' }],

  improved_disarm: [{ kind: 'unmodelled', reason: 'Disarm is not an implemented ability.' }],

  vanguard: [
    { kind: 'unmodelled', reason: 'Makes Charge usable in a stance. Stances gate nothing.' },
  ],

  improved_shield_wall: [
    { kind: 'unmodelled', reason: 'Modifies Shield Wall, which is castable but inert.' },
  ],

  concussion_blow: [
    { kind: 'grantAbility', abilityId: 'concussion_blow' },
    {
      kind: 'unmodelled',
      reason:
        'The ability itself is not implemented -- it is not in the Warrior '+
        'ability spreadsheet, so it has no cost, cooldown or damage. The GRANT '+
        'is declared above, so the moment the ability exists it is gated '+
        'correctly rather than handed to everyone.',
    },
  ],

  improved_shield_bash: [
    { kind: 'unmodelled', reason: 'Shield Bash is not an implemented ability.' },
  ],

  // Two stats at once. `percentAdd` wants a fraction, so 2% is scaled to 0.02.
  vitality: [
    { kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 },
    { kind: 'stat', stat: 'strength', operation: 'percentAdd', scale: 0.01 },
  ],

  focused_rage: [
    {
      kind: 'unmodelled',
      reason:
        'Reduces the cost of "your offensive abilities", and the source does not ' +
        'say which those are. Choosing the set would be inventing the talent, so ' +
        'it waits for the ruleset owner to name them.',
    },
  ],

  shield_slam: [{ kind: 'grantAbility', abilityId: 'shield_slam' }],
};
