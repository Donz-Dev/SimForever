import type { TalentEffects } from './TalentEffect';

/**
 * What every Warrior talent does, by talent id.
 *
 * ALL 54 have an entry. A talent that cannot be modelled says so and says why,
 * rather than being absent — absence would be indistinguishable from an
 * oversight, and this file is the only place that can tell the difference.
 *
 * 14 of the 54 do something today. The other 40 are `unmodelled`, and their
 * reasons fall into a handful of groups:
 *
 *   - the engine has no such concept yet (parry, block, defense skill, threat,
 *     stances, per-ability crit, crit damage bonus)
 *   - the ability they modify is itself inert, pending its numbers from the
 *     ruleset owner (Bloodrage, Berserker Rage, Shield Wall, Shield Block)
 *   - nothing attacks the player, so nothing can trigger them
 *   - they need a mechanism that exists but is not wired to talents yet
 *     (reactions, auras applied at combat start)
 *
 * Every reason names the specific obstacle, so the list doubles as the work
 * queue. The Gear panel's "Equipped but not simulated" does the same job for
 * items, and for the same reason.
 *
 * The NUMBERS are not here. They live in `src/data/talents/values/warrior.json`,
 * per rank, hand-editable. This file says what a talent does with its number.
 */
export const WARRIOR_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // ---------------------------------------------------------------------
  // Arms
  // ---------------------------------------------------------------------
  improved_heroic_strike: [{ kind: 'abilityCost', abilityId: 'heroic_strike' }],

  deflection: [
    {
      kind: 'unmodelled',
      reason:
        'The engine has no parry chance for the player. `parryRating` exists as ' +
        'a stat but player parry in the attacks-received table is deliberately 0 ' +
        'pending a defense stat, so a parry bonus would land nowhere.',
    },
  ],

  improved_rend: [
    {
      kind: 'unmodelled',
      reason:
        "Scales one aura's periodic damage. Damage multipliers are whole-character " +
        '(an aura\'s `damageDoneMultiplier`); nothing scales a single effect.',
    },
  ],

  improved_charge: [
    {
      kind: 'unmodelled',
      reason:
        'Changes the rage Charge generates, which is a number inside its `onCast` ' +
        'rather than a declared field. Charge is also absent from the rotation, ' +
        'because its real constraints (minimum range, being out of combat) are ' +
        'not modelled.',
    },
  ],

  improved_tactical_mastery: [
    {
      kind: 'unmodelled',
      reason: 'Rage retained on a stance change. Stances are defined but gate nothing.',
    },
  ],

  improved_overpower: [
    {
      kind: 'unmodelled',
      reason:
        'Crit chance for ONE ability. Crit comes from the stat block via the ' +
        'attack table, and `AttackContext` carries only the weapon slot, so there ' +
        'is nowhere to put a per-ability bonus.',
    },
  ],

  anger_management: [
    {
      kind: 'unmodelled',
      reason:
        'A passive that ticks rage in combat. That is an aura with a periodic ' +
        'effect, applied at combat start — the mechanism exists, but no talent is ' +
        'wired to apply one yet.',
    },
  ],

  deep_wounds: [
    {
      kind: 'unmodelled',
      reason:
        'Applies a bleed on a critical strike. That is a reaction, the same ' +
        'mechanism Overpower and the item procs use; talents cannot contribute ' +
        'reactions yet.',
    },
  ],

  spearing_strike: [{ kind: 'grantAbility', abilityId: 'spearing_strike' }],

  two_handed_weapon_specialization: [
    {
      kind: 'unmodelled',
      reason:
        'Damage conditional on the weapon type held. Damage multipliers apply to ' +
        'the whole character and nothing is conditional on what is equipped.',
    },
  ],

  impale: [
    {
      kind: 'unmodelled',
      reason: 'Raises the critical strike multiplier, which is fixed in the attack table.',
    },
  ],

  bloodthrill: [
    { kind: 'unmodelled', reason: 'A chance to open the Overpower window: a reaction.' },
  ],

  sweeping_strikes: [
    { kind: 'unmodelled', reason: 'Strikes an additional target; the encounter has one.' },
  ],

  weaponmaster: [
    {
      kind: 'unmodelled',
      reason:
        'Three different effects chosen by weapon type, one of which (ignoring a ' +
        "percentage of the target's armor) the damage pipeline cannot express.",
    },
  ],

  improved_slam: [
    {
      kind: 'unmodelled',
      reason:
        "Shortens Slam's cast. Slam is absent from the rotation because its cast " +
        'does not currently pause the swing timer, and whether it should is ' +
        'unstated — so shortening it would change a number that is already wrong.',
    },
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

  unbridled_wrath: [
    { kind: 'unmodelled', reason: 'A chance of extra rage on a melee hit: a reaction.' },
  ],

  improved_cleave: [{ kind: 'abilityCost', abilityId: 'cleave' }],

  piercing_howl: [{ kind: 'unmodelled', reason: 'Movement speed. Nothing moves.' }],

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
    {
      kind: 'unmodelled',
      reason:
        'An activated buff. The aura mechanism would carry it, but the rotation ' +
        'has no notion of cooldowns worth pressing for a damage buff.',
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

  flurry: [
    {
      kind: 'unmodelled',
      reason:
        'Haste for a fixed number of swings after a crit: a reaction that applies ' +
        'a charge-limited aura. Auras expire on time, not on a swing count.',
    },
  ],

  bloodthirst: [{ kind: 'grantAbility', abilityId: 'bloodthirst' }],

  // ---------------------------------------------------------------------
  // Protection
  // ---------------------------------------------------------------------
  shield_specialization: [
    {
      kind: 'unmodelled',
      reason:
        'Block chance and rage on a block. The engine has no block outcome at all ' +
        '— the same gap that leaves Revenge catching two thirds of its triggers.',
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
    { kind: 'unmodelled', reason: 'Temporary maximum health. Nothing threatens the player.' },
  ],

  master_of_defense: [
    { kind: 'unmodelled', reason: 'Rage on a dodge or parry by the player, which never happens.' },
  ],

  improved_revenge: [
    {
      kind: 'unmodelled',
      reason:
        "Scales one ability's damage; nothing scales a single ability. Revenge " +
        'also needs the player to be attacked, which nothing does.',
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

  concussion_blow: [{ kind: 'unmodelled', reason: 'A stun. Nothing can be stunned.' }],

  improved_shield_bash: [{ kind: 'unmodelled', reason: 'Shield Bash is not an implemented ability.' }],

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

  bastion: [
    {
      kind: 'unmodelled',
      reason:
        'Not on the live Forever calculator any more — it was removed, and Focused ' +
        'Rage moved into its place. It survives here only because the scraped tree ' +
        'structure predates that change. See src/data/talents/values/README.md.',
    },
  ],

  shield_slam: [{ kind: 'grantAbility', abilityId: 'shield_slam' }],
};
