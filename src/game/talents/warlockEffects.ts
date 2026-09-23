import type { TalentEffects } from './TalentEffect';
import {
  CONFLAGRATE_KEEPS_IMMOLATE,
  SHADOWBURN_REFUNDS_SHARD,
} from '../abilities/warlock';

/**
 * What each Warlock talent does, as data.
 *
 * Every one of the 52 has an entry, and one that cannot be expressed says so.
 *
 * ----------------------------------------------------------------------------
 * ELEVEN TALENTS ARE ABOUT A DEMON THAT IS NOT THERE. Both of the ruleset
 * owner's profiles take Demonic Sacrifice, which kills the demon for a
 * two-hour buff -- so Unholy Power, Improved Imp, Soul Link, Master
 * Demonologist, Demonic Knowledge and the rest are inert BY THE BUILD rather
 * than by the engine. Neither profile spends a point in any of them, which is
 * the build agreeing with itself.
 *
 * THE FOURTH CLASS TO USE THE ONE-SHOT CAST-TIME RULE. Nightfall's Shadow
 * Trance makes the next Shadow Bolt instant, which is `CastModifier` -- built
 * for Eclipse, used by Maelstrom Weapon and Presence of Mind, and now this.
 * ----------------------------------------------------------------------------
 */

/** Said once; eleven talents say it. */
const NO_DEMON =
  'It affects a summoned demon, and both profiles take Demonic Sacrifice -- ' +
  'which kills the demon for a two-hour buff. Inert because of the BUILD ' +
  'rather than because of the engine, and neither profile spends a point here.';

/** Said once; four talents say it. */
const NO_PUSHBACK =
  'Avoiding interruption while casting, and no Warlock profile is attacked.';

/** Said once; three talents say it. */
const NO_THREAT = 'Threat, which the engine does not track.';

export const WARLOCK_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Affliction ----------------------------------------------------------

  improved_life_tap: [{ kind: 'abilityBonus', abilityId: 'life_tap', key: 'bonusPercent' }],

  suppression: [
    { kind: 'stat', stat: 'hitChance', operation: 'flat' },
    { kind: 'unmodelled', reason: `The hit applies. ${NO_THREAT}` },
  ],

  improved_corruption: [
    { kind: 'abilityCastTime', abilityId: 'corruption' },
    { kind: 'abilityDamage', abilityId: 'corruption', valueIndex: 1 },
  ],

  malediction: [
    /*
     * "Increases all PERIODIC damage done by your Warlock spells."
     *
     * NAMED ONE BY ONE, because a periodic tick carries its AURA's id -- so
     * `abilityDamage` on the aura id reaches the ticks and nothing else. That
     * is the same route Improved Rend takes on the Warrior, and it is why
     * "all periodic damage" is expressible at all.
     */
    { kind: 'abilityDamage', abilityId: 'corruption' },
    { kind: 'abilityDamage', abilityId: 'bane_of_agony' },
    { kind: 'abilityDamage', abilityId: 'siphon_life' },
    { kind: 'abilityDamage', abilityId: 'immolate' },
  ],

  soul_harvesting: [
    { kind: 'unmodelled', reason: 'Needs a KILL, and the target survives every fight.' },
  ],

  improved_drains: [
    { kind: 'unmodelled', reason: 'Drain Life, Drain Soul and Wrack are channels no list casts.' },
  ],

  improved_bane_of_agony: [{ kind: 'abilityDamage', abilityId: 'bane_of_agony' }],

  fel_concentration: [{ kind: 'unmodelled', reason: NO_PUSHBACK }],

  amplify_curse: [
    {
      kind: 'unmodelled',
      reason:
        'Raises the effect of the NEXT Curse or Bane. A one-shot per-ability ' +
        'DAMAGE modifier, and `CastModifier` carries cast time and cost rather ' +
        'than damage.',
    },
  ],

  pandemic: [
    {
      kind: 'unmodelled',
      reason:
        'Raises crit DAMAGE for seven named periodic spells. `critDamageBonus` ' +
        'is whole-character and `schoolCritDamage` is per school -- neither ' +
        'selects a list of abilities, so this is real damage the build is not ' +
        'getting.',
    },
  ],

  malevolence: [{ kind: 'schoolCrit', schools: ['shadow'] }],

  nightfall: [{ kind: 'reaction', reactionId: 'nightfall' }],

  curse_of_exhaustion: [{ kind: 'unmodelled', reason: 'Movement speed, and nothing here moves.' }],

  siphon_life: [{ kind: 'grantAbility', abilityId: 'siphon_life' }],

  soul_siphon: [
    { kind: 'unmodelled', reason: 'Drain Life, Drain Soul and Wrack are channels no list casts.' },
  ],

  shadow_mastery: [{ kind: 'schoolDamage', schools: ['shadow'] }],

  wrack: [
    {
      kind: 'unmodelled',
      reason:
        'A six-second CHANNEL. The engine has channels now, and this one is ' +
        'worth 216 damage over six seconds against a Shadow Bolt worth 268 in ' +
        'three -- so no list casts it, which is a rotation decision rather ' +
        'than a gap.',
    },
  ],

  // --- Demonology ----------------------------------------------------------

  improved_health_funnel: [{ kind: 'unmodelled', reason: NO_DEMON }],
  improved_imp: [{ kind: 'unmodelled', reason: NO_DEMON }],

  demonic_embrace: [{ kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 }],

  unholy_power: [{ kind: 'unmodelled', reason: NO_DEMON }],

  demonic_aegis: [
    { kind: 'unmodelled', reason: 'Demon Skin and Demon Armor, neither of which is cast.' },
  ],

  improved_voidwalker: [{ kind: 'unmodelled', reason: NO_DEMON }],

  fel_vitality: [
    /*
     * "Increases the maximum health and Mana of your [demons] by {0}%, AND
     * increases your maximum Mana by {0}%." The demon half is inert; the
     * Warlock's own mana is real and is what both profiles take it for.
     */
    { kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 },
    {
      kind: 'unmodelled',
      reason:
        'Its mana bonus is applied through INTELLECT rather than to the pool ' +
        'directly, because a percentage of maximum mana has no declaration -- ' +
        'the pool is sized once from a stats snapshot. Its demon half is inert.',
    },
  ],

  demonic_energies: [{ kind: 'unmodelled', reason: NO_DEMON }],
  improved_sayaad: [{ kind: 'unmodelled', reason: NO_DEMON }],

  demonic_sacrifice: [{ kind: 'grantAura', auraId: 'demonic_sacrifice' }],

  master_summoner: [
    { kind: 'unmodelled', reason: 'Summoning cost and cast time, and the demon is sacrificed.' },
  ],

  decimation: [
    {
      kind: 'unmodelled',
      reason:
        'Every clause needs the target BELOW 35% HEALTH, and the target never ' +
        'drops -- it survives every fight by design.',
    },
  ],

  fel_domination: [{ kind: 'unmodelled', reason: 'Summoning, and the demon is sacrificed.' }],
  demonic_brand: [{ kind: 'unmodelled', reason: `${NO_DEMON} ${NO_THREAT}` }],
  improved_felhunter: [{ kind: 'unmodelled', reason: NO_DEMON }],
  soul_link: [{ kind: 'unmodelled', reason: NO_DEMON }],
  demonic_knowledge: [{ kind: 'unmodelled', reason: NO_DEMON }],
  master_demonologist: [{ kind: 'unmodelled', reason: NO_DEMON }],

  demonic_pact: [
    {
      kind: 'unmodelled',
      reason:
        'It stops Demonic Sacrifice being cancelled by summoning another ' +
        'demon. Nothing summons one mid-fight, so there is nothing to cancel.',
    },
  ],

  // --- Destruction ---------------------------------------------------------

  destructive_reach: [{ kind: 'unmodelled', reason: 'Range, and nothing here has a position.' }],

  improved_shadow_bolt: [{ kind: 'reaction', reactionId: 'improved_shadow_bolt' }],

  bane: [
    { kind: 'abilityCastTime', abilityId: 'shadow_bolt' },
    { kind: 'abilityCastTime', abilityId: 'immolate' },
    { kind: 'abilityCastTime', abilityId: 'incinerate' },
  ],

  molten_skin: [
    { kind: 'unmodelled', reason: 'Damage taken, and no Warlock profile is attacked.' },
  ],

  cataclysm: [
    {
      kind: 'unmodelled',
      reason:
        'Reduces Destruction mana costs by a PERCENTAGE. `abilityCost` ' +
        'subtracts a flat amount, which is wrong for a 380-mana Immolate.',
    },
  ],

  aftermath: [
    /*
     * "Increases the INITIAL damage of your Immolate spell by {2}%." The
     * initial half and the burn are one ability id here, so this raises both
     * -- which is generous, and the amount by which is the burn's share.
     */
    { kind: 'abilityDamage', abilityId: 'immolate', valueIndex: 2 },
    {
      kind: 'unmodelled',
      reason:
        'It raises Immolate INITIAL damage only, and the initial hit and its ' +
        'burn share one ability id -- so the burn is raised too. Generous, and ' +
        'the burn is the larger half.',
    },
  ],

  ruin: [{ kind: 'schoolCritDamage', schools: ['fire', 'shadow'] }],

  shadowburn: [{ kind: 'grantAbility', abilityId: 'shadowburn' }],

  intensity: [{ kind: 'unmodelled', reason: NO_PUSHBACK }],

  agonizing_flames: [
    { kind: 'abilityCrit', abilityId: 'searing_pain' },
    // "and the damage done by all your Destruction spells by {1}%", which for
    // this class is Fire and Shadow -- the two schools it has.
    { kind: 'schoolDamage', schools: ['fire', 'shadow'], valueIndex: 1 },
  ],

  conflagrate: [{ kind: 'grantAbility', abilityId: 'conflagrate' }],

  pyroclasm: [{ kind: 'unmodelled', reason: 'A stun, which is out of scope as every stun is.' }],

  bane_of_havoc: [
    {
      kind: 'unmodelled',
      reason:
        'It copies damage dealt to OTHER targets onto the cursed one, and ' +
        'there is one target -- so there are no others to copy from.',
    },
  ],

  fire_and_brimstone: [{ kind: 'abilityCrit', abilityId: 'conflagrate' }],

  shadow_and_flame: [
    { kind: 'reaction', reactionId: 'shadow_and_flame' },
    /*
     * ITS TWO OTHER CLAUSES ARE FLAGS ON THE ABILITIES THEY CHANGE, which is
     * what `abilityFlag` is for: on or off, no magnitude. At 5/5 Conflagrate
     * keeps Immolate and Shadowburn refunds its shard, and both change what
     * the priority list can do rather than what a number is.
     */
    { kind: 'abilityFlag', abilityId: 'conflagrate', key: CONFLAGRATE_KEEPS_IMMOLATE },
    { kind: 'abilityFlag', abilityId: 'shadowburn', key: SHADOWBURN_REFUNDS_SHARD },
  ],

  incinerate: [{ kind: 'grantAbility', abilityId: 'incinerate' }],
};
