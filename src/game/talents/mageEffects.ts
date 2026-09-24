import type { TalentEffects } from './TalentEffect';
import { FROZEN_UNMODELLED } from '../auras/mage';

/**
 * What each Mage talent does, as data.
 *
 * Every one of the 54 has an entry, and one that cannot be expressed says so.
 *
 * ----------------------------------------------------------------------------
 * THE FIRST TREE WHERE MOST TALENTS ARE SCHOOLS RATHER THAN ABILITIES, which
 * is why `SchoolModifiers` was built before this file: Fire Power, Piercing
 * Ice, Critical Mass, Arcane Impact, Ice Shards and Arcane Mind are six
 * talents that had no declaration at all a PR ago.
 *
 * WHAT CLUSTERS HERE:
 *
 *   FROZEN TARGETS   five talents, and the whole Frost tree's best ones.
 *                    Shatter, Frostbite, Fingers of Frost, Improved Blizzard
 *                    and Ice Lance's own 300% all need a frozen target, and
 *                    nothing freezes a raid boss. Inert because of the TARGET
 *                    rather than because of the engine, which is a different
 *                    claim and a more durable one.
 *   PERCENTAGE MANA  Frost Channeling, Burning Soul's cost half. Still the
 *   COSTS            most common unmodelled reason in the project.
 *   THREAT           four. The engine does not track it.
 *   RANGE            three. Nothing here has a position.
 *   PUSHBACK         four -- Improved Channeling, Burning Soul, Ice Barrier,
 *                    Frost Warding. Nothing interrupts a cast here, because
 *                    no Mage profile is attacked.
 * ----------------------------------------------------------------------------
 */

/** Said once; four talents say it. */
const NO_PUSHBACK =
  'Avoiding pushback from damage taken while casting. No Mage profile is ' +
  'attacked, so nothing interrupts or delays a cast.';

/** Said once; three talents say it. */
const NO_POSITION = 'Range, and nothing here has a position.';

/** Said once; four talents say it. */
const NO_THREAT = 'Threat, which the engine does not track.';

export const MAGE_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Arcane --------------------------------------------------------------

  wand_specialization: [
    { kind: 'unmodelled', reason: 'Wands are not modelled; no Mage profile swings or shoots.' },
  ],

  arcane_focus: [
    {
      kind: 'unmodelled',
      reason:
        'Spell HIT for one school. `SchoolModifiers` covers crit, crit damage ' +
        'and damage -- hit is decided by the attack table before any of them, ' +
        'and reaching it would mean threading the school into the roll.',
    },
  ],

  improved_channeling: [{ kind: 'unmodelled', reason: NO_PUSHBACK }],

  arcane_subtlety: [
    {
      kind: 'unmodelled',
      reason: `Target spell resistance, which has no effect here by ruling, and ${NO_THREAT}`,
    },
  ],

  magic_absorption: [
    {
      kind: 'unmodelled',
      reason:
        'Resistances, and mana back on a FULL resist. Resistance has no effect ' +
        'on an enemy target by ruling, and nothing casts at the Mage.',
    },
  ],

  arcane_concentration: [{ kind: 'reaction', reactionId: 'arcane_concentration' }],

  arcane_resilience: [
    /*
     * "Increases your Armor by an amount equal to {0}% of your Intellect."
     *
     * CORRECT AND WORTH NOTHING HERE, which is a different thing from inert:
     * no Mage profile is attacked, so armor reduces no damage. Declared
     * anyway, because a talent that works and does not matter must not look
     * like one that cannot be expressed.
     */
    { kind: 'statFromStat', from: 'intellect', to: 'armor' },
  ],

  arcane_geometry: [{ kind: 'unmodelled', reason: NO_POSITION }],

  arcane_impact: [{ kind: 'schoolCrit', schools: ['arcane'] }],

  arcane_blast: [{ kind: 'grantAbility', abilityId: 'arcane_blast' }],

  arcane_shielding: [
    { kind: 'unmodelled', reason: 'Mana Shield and Mage Armor, neither of which is cast here.' },
  ],

  improved_counterspell: [
    { kind: 'unmodelled', reason: 'A silence, and nothing the target does is a cast.' },
  ],

  arcane_meditation: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],

  missile_barrage: [{ kind: 'reaction', reactionId: 'missile_barrage' }],

  presence_of_mind: [{ kind: 'grantAbility', abilityId: 'presence_of_mind' }],

  arcane_mind: [
    { kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 },
    /*
     * The SECOND value: "+100% critical strike damage bonus of your Arcane
     * spells". Index 0 is the 10% intellect. Reading the wrong one would give
     * the intellect clause a tenfold value and the crit clause a tenth.
     */
    { kind: 'schoolCritDamage', schools: ['arcane'], valueIndex: 1 },
  ],

  arcane_instability: [
    // "Increases the damage done by your spells" with no school, which for a
    // Mage is everything it casts -- and it has no physical damage to reach.
    { kind: 'conditionalDamage', requires: {} },
    { kind: 'stat', stat: 'spellCritChance', operation: 'flat', valueIndex: 1 },
  ],

  arcane_power: [{ kind: 'grantAbility', abilityId: 'arcane_power' }],

  // --- Fire ----------------------------------------------------------------

  wake_of_fire: [
    { kind: 'abilityCooldown', abilityId: 'fire_blast', unit: 'seconds' },
    {
      kind: 'unmodelled',
      reason: 'Its killing-blow crit bonus needs a kill, and the target survives every fight.',
    },
  ],

  incineration: [
    { kind: 'abilityCrit', abilityId: 'fire_blast' },
    { kind: 'abilityCrit', abilityId: 'ice_lance' },
    { kind: 'abilityCrit', abilityId: 'arcane_blast' },
    { kind: 'abilityCrit', abilityId: 'scorch' },
  ],

  improved_fireball: [
    { kind: 'abilityCastTime', abilityId: 'fireball' },
    { kind: 'abilityCastTime', abilityId: 'frostfire_bolt' },
  ],

  ignite: [{ kind: 'reaction', reactionId: 'ignite' }],

  flame_throwing: [{ kind: 'unmodelled', reason: NO_POSITION }],

  impact: [{ kind: 'unmodelled', reason: 'A stun, which is out of scope as every stun is.' }],

  burning_soul: [{ kind: 'unmodelled', reason: `${NO_PUSHBACK} ${NO_THREAT}` }],

  improved_flamestrike: [
    { kind: 'unmodelled', reason: 'Flamestrike is an area spell and is not in the book.' },
  ],

  pyroblast: [{ kind: 'grantAbility', abilityId: 'pyroblast' }],

  improved_scorch: [{ kind: 'reaction', reactionId: 'improved_scorch' }],

  improved_fire_ward: [
    { kind: 'unmodelled', reason: 'Fire Ward, and nothing casts Fire at the Mage.' },
  ],

  hot_streak: [{ kind: 'reaction', reactionId: 'hot_streak' }],

  master_of_elements: [{ kind: 'reaction', reactionId: 'master_of_elements' }],

  critical_mass: [{ kind: 'schoolCrit', schools: ['fire'] }],

  blast_wave: [{ kind: 'grantAbility', abilityId: 'blast_wave' }],

  fire_power: [{ kind: 'schoolDamage', schools: ['fire'] }],

  combustion: [{ kind: 'grantAbility', abilityId: 'combustion' }],

  // --- Frost ---------------------------------------------------------------

  frost_warding: [
    { kind: 'unmodelled', reason: 'Frost Armor and Frost Ward, neither of which is cast here.' },
  ],

  improved_frostbolt: [{ kind: 'abilityCastTime', abilityId: 'frostbolt' }],

  elemental_precision: [
    {
      kind: 'unmodelled',
      reason:
        'Spell HIT for two schools, which the attack table decides before any ' +
        'per-school modifier is consulted. The same gap Arcane Focus has.',
    },
  ],

  ice_shards: [{ kind: 'schoolCritDamage', schools: ['frost'] }],

  permafrost: [{ kind: 'unmodelled', reason: 'Chill duration and movement speed.' }],

  improved_frost_nova: [
    { kind: 'unmodelled', reason: 'Frost Nova is a root and is not in the book.' },
  ],

  frostbite: [{ kind: 'unmodelled', reason: FROZEN_UNMODELLED }],

  piercing_ice: [{ kind: 'schoolDamage', schools: ['frost'] }],

  frost_channeling: [
    { kind: 'grantCastModifier', abilityIds: ['frostbolt', 'ice_lance'], property: 'costFraction' },
    { kind: 'unmodelled', reason: `Its mana reduction applies. ${NO_THREAT}` },
  ],

  ice_lance: [{ kind: 'grantAbility', abilityId: 'ice_lance' }],

  improved_blizzard: [
    { kind: 'unmodelled', reason: 'Blizzard is an area spell and is not in the book.' },
  ],

  arctic_reach: [{ kind: 'unmodelled', reason: NO_POSITION }],

  ice_block: [{ kind: 'unmodelled', reason: 'A survival cooldown, and no Mage profile is hit.' }],

  shatter: [{ kind: 'unmodelled', reason: FROZEN_UNMODELLED }],

  improved_cone_of_cold: [
    { kind: 'unmodelled', reason: 'Cone of Cold is an area spell and is not in the book.' },
  ],

  cold_snap: [
    {
      kind: 'unmodelled',
      reason:
        'Resets Frost cooldowns. The only Frost spell here with one is Ice ' +
        'Lance, which has none, so there is nothing to reset.',
    },
  ],

  fingers_of_frost: [{ kind: 'unmodelled', reason: FROZEN_UNMODELLED }],

  winter_s_chill: [
    {
      kind: 'unmodelled',
      reason:
        'A stacking crit debuff ON THE TARGET for two named spells. Crit from ' +
        'a debuff the target carries has no declaration: `abilityCrit` is on ' +
        'the caster and an aura reaches every ability or none.',
    },
  ],

  ice_barrier: [{ kind: 'unmodelled', reason: `An absorb, and ${NO_PUSHBACK}` }],
};
