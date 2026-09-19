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
 * 27 are fully modelled and 6 more are PARTLY modelled — something real plus an
 * `unmodelled` entry naming the part that is missing. 20 do nothing at all.
 * Those three numbers must sum to 53; the previous count said 21 inert and
 * summed to 54, which is how the drift below went unnoticed.
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
 *   - it needs a mechanism that exists but is not wired to talents yet
 *     (combat-start auras, a talent-granted reaction)
 *
 * "Nothing attacks the player" USED to be a group here, and is not one any
 * more: `encounter.targetAttacks` makes the target swing back. Five entries
 * went on claiming it long after that shipped — two of them on talents that had
 * become fully modelled without anyone noticing. Whether the switch is ON is an
 * encounter setting, not a modelling gap, so it is not a reason to file
 * anything as unmodelled.
 *
 * The Gear panel's "Equipped but not simulated" does the same job for items,
 * and the Talent panel prints these the same way.
 *
 * Edge cases, interpretations and the talents that are deliberately only PARTLY
 * modelled are all written up in `docs/talent-effects.md`. Read that before
 * deciding a reason below is out of date -- eight of them already were, in two
 * separate rounds. A reason here is a claim about the engine on the day it was
 * written, and it does not re-check itself.
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
        'The ability is implemented and does nothing: its whole effect is that ' +
        'the next 5 melee attacks strike an ADDITIONAL opponent, and an ' +
        'encounter here has exactly one enemy. Not a missing number -- a ' +
        'missing second target. See engine/combat/targeting.ts.',
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
  /*
   * PARTLY MODELLED, and the sword clause is the part that is.
   *
   * Three clauses by weapon type: crit with an axe or polearm, armor
   * penetration with a mace or staff, and a chance at an extra attack with a
   * sword. The third is a reaction and is implemented, reading the talent's
   * THIRD value through `valueIndex`.
   *
   * The other two are unmodelled for the same reason as each other: an ability
   * cannot ask what weapon type it is holding. Nothing in the engine carries a
   * weapon's type -- only its speed, damage and skill -- so all three clauses
   * are ungated and the sword one fires whatever the warrior is wielding.
   */
  weaponmaster: [
    { kind: 'reaction', reactionId: 'weaponmaster', valueIndex: 2 },
    {
      kind: 'unmodelled',
      reason:
        'Only the SWORD clause is modelled -- a chance at an extra attack -- ' +
        'and it is not gated on carrying a sword, because the engine does not ' +
        'record a weapon type. The axe/polearm crit and mace/staff armor ' +
        'penetration clauses are absent for the same reason.',
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
        'Dazes nearby enemies, -50% movement for 6 sec. NOT TO BE IMPLEMENTED: the ' +
        'project owner classes snares as non-combat, so this is out of scope ' +
        'rather than waiting on anything.',
    },
  ],

  blood_craze: [
    {
      kind: 'unmodelled',
      reason:
        'Regenerates a percentage of health after being critically hit. The ' +
        'trigger is reachable now that the target swings back, but the healing ' +
        'itself would not be observable: the player cannot drop below one ' +
        'health, so a heal has nothing to restore and survival is not modelled.',
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

  /*
   * FULLY MODELLED. A 30% chance on being hit to deal 2-10% more physical
   * damage for 12 seconds. The rank value is the DAMAGE BONUS, not the proc
   * chance, which is fixed at 30% -- the one reaction here where the two are
   * not the same number.
   *
   * Fires only when something attacks the player, which is an encounter
   * setting (`targetAttacks`, off by default) and not a gap in the model.
   */
  enrage: [{ kind: 'reaction', reactionId: 'enrage' }],

  improved_execute: [{ kind: 'abilityCost', abilityId: 'execute' }],

  precision: [{ kind: 'stat', stat: 'hitChance', operation: 'flat' }],

  /*
   * FULLY MODELLED. The ability was missing from the spreadsheet and is in
   * Forever's spell data: +20% damage done, +5% damage taken, 30 sec, 10 rage,
   * 3 minute cooldown.
   */
  death_wish: [{ kind: 'grantAbility', abilityId: 'death_wish' }],

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
   *
   * FULLY MODELLED. It carried an `unmodelled` entry saying neither half could
   * fire because nothing attacked the player; that stopped being true when
   * `encounter.targetAttacks` landed, and the entry outlived it. Both halves
   * run whenever the target swings back. Whether that switch is on is an
   * encounter choice, not a gap in the model, so nothing is flagged here.
   */
  shield_specialization: [
    { kind: 'stat', stat: 'blockChance', operation: 'flat' },
    { kind: 'reaction', reactionId: 'shield_specialization', valueIndex: 1 },
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
        'The ability is implemented -- 30% more maximum health for 20 sec -- ' +
        'but it changes no outcome, because the player cannot drop below one ' +
        'health and survival is not modelled. It is a real ability with ' +
        'nothing here to measure it against.',
    },
  ],

  /*
   * FULLY MODELLED, apart from its shield clause. A 50/100% chance of 5 rage
   * when the warrior dodges or parries.
   *
   * "While a shield is equipped" is not expressed: a reaction cannot see the
   * actor's gear. The talent sits at tier 10 of Protection, where a shield is
   * the entire point, so the overstatement applies only to a Protection warrior
   * who dual-wields.
   */
  master_of_defense: [
    { kind: 'reaction', reactionId: 'master_of_defense' },
    {
      kind: 'unmodelled',
      reason:
        'The rage proc is implemented. Its "while a shield is equipped" ' +
        'condition is not -- a reaction cannot see the wearer gear -- so it ' +
        'would also fire for a Protection warrior holding two weapons.',
    },
  ],

  /*
   * FULLY MODELLED, for the same reason as Shield Specialization above: the
   * `unmodelled` entry here said Revenge could never fire, and Revenge has been
   * in the rotation since the target learned to swing back.
   */
  improved_revenge: [{ kind: 'abilityDamage', abilityId: 'revenge' }],


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
        'Stuns the target for 5 sec. NOT TO BE IMPLEMENTED: the project owner ' +
        'classes stuns as non-combat, so this is out of scope rather than ' +
        'waiting on anything. The ability grant is still declared so the talent ' +
        'gates correctly.',
    },
  ],

  improved_shield_bash: [
    { kind: 'unmodelled', reason: 'Shield Bash is not an implemented ability.' },
  ],

  // Two stats at once. `percentAdd` wants a fraction, so 2% is scaled to 0.02.
  /*
   * BASTION REPLACED VITALITY IN THIS SLOT, and the replacement is a fact about
   * the tree rather than a rename. Forever's tier 20 Protection talent is
   * "Increases all damage you deal by 10% while a shield is equipped"; the
   * repository had Vitality, a stamina and strength percentage, because the
   * structure file was once hand-corrected and the hand edit put the wrong
   * talent here. Re-scraped 2026-09-18.
   *
   * Its effect is expressible -- a damage multiplier conditional on a shield --
   * and its PER-RANK VALUES ARE NOT KNOWN. Forever prints the same 10% at every
   * rank and the talent has no per-rank spell ids, so the split across five
   * ranks is unpublished. 2/4/6/8/10 is the obvious guess and is exactly the
   * plausible invented number this project refuses.
   *
   * So it is declared unmodelled, not given a number. Capture the ranks with
   * tools/talent_ranks_browser.js and this becomes a `damageMultiplier` effect
   * gated on a shield.
   */
  bastion: [
    {
      kind: 'unmodelled',
      reason:
        'Increases all damage done while a shield is equipped -- 10% at max ' +
        'rank. The per-rank split is not published: Forever prints the same ' +
        'figure at every rank and the talent has no per-rank spell ids. The ' +
        'effect is expressible; the numbers are missing.',
    },
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
