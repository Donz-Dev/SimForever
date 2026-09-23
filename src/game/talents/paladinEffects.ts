import type { TalentEffects } from './TalentEffect';
import { TWIST_OF_LIGHT_FLAG } from '../abilities/paladin';
import { RECKONING_UNMODELLED } from '../reactions/paladinTalents';

/**
 * What each Paladin talent does, as data.
 *
 * Every one of the 52 has an entry, and one that cannot be expressed says so.
 *
 * ----------------------------------------------------------------------------
 * WHAT CLUSTERS HERE, and it is a different shape from every class before it:
 *
 *   HEALING          eleven. The whole Holy tree bar its damage talents, and
 *                    no Paladin profile heals.
 *   THREAT           six, more than any other class -- Righteous Fury, Iron
 *                    Creed, Instrument of Law and three more. The engine does
 *                    not track it, which costs the Protection profile more
 *                    than it costs the other two.
 *   STAT FROM STAT   Champion of the Light, "spell damage equal to 100% of
 *                    your Intellect". The FOURTH talent in the project with
 *                    this shape, after the Shaman's Mental Dexterity and
 *                    Mental Quickness and the Mage's Arcane Resilience -- and
 *                    the first where it matters, because the seal formula has
 *                    a spell power term.
 *   UNDEAD AND DEMON four. Exorcism, Holy Wrath and two talents that scale
 *                    them. The training dummy is neither.
 * ----------------------------------------------------------------------------
 */

/** Said once; eleven talents say it. */
const NO_PROFILE_HEALS = 'Healing, and no Paladin profile heals.';

/** Said once; six talents say it. */
const NO_THREAT = 'Threat, which the engine does not track.';

/** Said once; four talents say it. */
const NOT_UNDEAD =
  'It applies only to Undead or Demon targets, and the training dummy is ' +
  'neither -- inert because of the target rather than because of the engine.';

export const PALADIN_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Holy ----------------------------------------------------------------

  improved_holy_strike: [
    { kind: 'abilityCooldown', abilityId: 'holy_strike', unit: 'seconds' },
  ],

  divine_strength: [{ kind: 'stat', stat: 'strength', operation: 'percentAdd', scale: 0.01 }],

  divine_intellect: [{ kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 }],

  healing_light: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],

  spiritual_focus: [
    {
      kind: 'unmodelled',
      reason: 'Pushback while casting heals. No Paladin profile heals or is interrupted.',
    },
  ],

  improved_seals: [
    /*
     * "Increases the damage done by your Seals and Judgements by {0}%."
     *
     * SEVEN ABILITY IDS, which is what `abilityDamage` is for -- and the seal
     * procs carry the seal's own id, so naming the seal reaches both its
     * per-swing damage and nothing else. Judgement is one id whatever seal
     * fed it.
     */
    { kind: 'abilityDamage', abilityId: 'seal_of_righteousness' },
    { kind: 'abilityDamage', abilityId: 'seal_of_command' },
    { kind: 'abilityDamage', abilityId: 'seal_of_fury' },
    { kind: 'abilityDamage', abilityId: 'twist_of_light' },
    { kind: 'abilityDamage', abilityId: 'judgement' },
  ],

  unyielding_faith: [
    { kind: 'unmodelled', reason: 'Fear and Disorient duration, and nothing applies either.' },
  ],

  voice_of_truth: [
    {
      kind: 'unmodelled',
      reason: 'Silence and interrupt immunity, and nothing interrupts a cast here.',
    },
  ],

  reverence: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],

  purifying_power: [
    { kind: 'unmodelled', reason: `Cleanse and Purify costs, plus Exorcism and Holy Wrath. ${NOT_UNDEAD}` },
  ],

  infusion_of_light: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],

  illumination: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],

  divine_favor: [
    {
      kind: 'unmodelled',
      reason:
        'A guaranteed crit on the next Flash of Light, Holy Light or Holy ' +
        'Shock. Two of the three are heals; for Holy Shock it is a one-shot ' +
        'per-ability CRIT modifier, which `CastModifier` does not carry -- it ' +
        'covers cast time and cost.',
    },
  ],

  divine_precision: [
    {
      kind: 'unmodelled',
      reason:
        'Spell HIT for one school, which the attack table decides before any ' +
        'per-school modifier is consulted. The same gap the Mage Arcane Focus has.',
    },
  ],

  holy_shock: [{ kind: 'grantAbility', abilityId: 'holy_shock' }],

  consecrated_ground: [
    { kind: 'abilityDamage', abilityId: 'consecration' },
    {
      kind: 'unmodelled',
      reason:
        'Modelled as a flat bonus to Consecration. The tooltip raises HOLY ' +
        'SPELLS against enemies standing in it, which is a damage bonus ' +
        'conditional on a debuff being on the target and has no declaration.',
    },
  ],

  holy_power: [
    { kind: 'abilityCrit', abilityId: 'holy_shock' },
    { kind: 'stat', stat: 'spellCritChance', operation: 'flat', valueIndex: 1 },
  ],

  light_s_vigil: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],

  // --- Protection ----------------------------------------------------------

  toughness: [{ kind: 'itemArmorPercent' }],

  redoubt: [
    /*
     * `valueIndex: 1` -- the BLOCK BONUS, not the chance. Redoubt's chance is
     * 10 at every rank and only the bonus moves, so index 0 would hand the
     * reaction the same number five times over. See `paladinTalents.ts`.
     */
    { kind: 'reaction', reactionId: 'redoubt', valueIndex: 1 },
  ],

  precision: [{ kind: 'stat', stat: 'hitChance', operation: 'flat' }],

  guardian_s_favor: [
    { kind: 'unmodelled', reason: 'Blessing of Protection and Blessing of Freedom.' },
  ],

  anticipation: [{ kind: 'stat', stat: 'defenseSkill', operation: 'flat' }],

  improved_seal_of_fury: [
    {
      kind: 'unmodelled',
      reason:
        "Mana back when Seal of Fury's absorb shield is spent, and that shield " +
        'is not modelled -- a shield granted per swing and consumed per hit has ' +
        'no declaration.',
    },
  ],

  improved_righteous_fury: [
    {
      kind: 'unmodelled',
      reason:
        'Damage reduction WHILE RIGHTEOUS FURY IS ACTIVE. Righteous Fury is a ' +
        'threat buff and nothing here tracks threat, so no profile casts it ' +
        'and the condition is never met.',
    },
  ],

  shield_specialization: [
    {
      kind: 'unmodelled',
      reason:
        'Shield absorb and mana on block. The absorb is a shield stat nothing ' +
        'reads, and the mana clause is a percentage of maximum on a timer.',
    },
  ],

  sacred_duty: [
    { kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 },
    {
      kind: 'unmodelled',
      reason: 'The stamina applies. Its cooldown reductions are on survival abilities not cast here.',
    },
  ],

  swift_judgement: [{ kind: 'grantAbility', abilityId: 'swift_judgement' }],

  one_handed_weapon_specialization: [
    { kind: 'conditionalDamage', requires: { twoHanded: false } },
  ],

  improved_hammer_of_justice: [
    { kind: 'unmodelled', reason: 'A stun, which is out of scope as every stun is.' },
  ],

  templar_s_bulwark: [
    {
      kind: 'unmodelled',
      reason:
        'An absorb shield worth the whole health pool. Granted, it would ' +
        'prevent every death in an eight-second window -- and the Protection ' +
        'profile measures deaths, so a survival cooldown nothing spends is ' +
        'the honest gap rather than a free one.',
    },
  ],

  reckoning: [
    { kind: 'reaction', reactionId: 'reckoning' },
    { kind: 'unmodelled', reason: RECKONING_UNMODELLED },
  ],

  iron_creed: [
    {
      kind: 'unmodelled',
      reason: `${NO_THREAT} Its damage-reduction half needs Righteous Fury, which no profile casts.`,
    },
  ],

  holy_shield: [
    { kind: 'grantAbility', abilityId: 'holy_shield' },
    {
      kind: 'unmodelled',
      reason:
        'Its block chance applies. Its "221 Holy damage for each attack ' +
        'blocked" does NOT: a block is a flat reduction in the damage pipeline ' +
        'rather than an attack outcome, so nothing can fire on one.',
    },
  ],

  // --- Retribution ---------------------------------------------------------

  deflection: [{ kind: 'stat', stat: 'parryChance', operation: 'flat' }],

  benediction: [
    /*
     * "All INSTANT cast spells and abilities", which for a Paladin is every
     * seal, Judgement, Holy Strike, Holy Shield and Consecration. Holy Shock
     * is instant too and is on the list.
     */
    {
      kind: 'grantCastModifier',
      abilityIds: [
        'seal_of_righteousness',
        'seal_of_command',
        'seal_of_the_crusader',
        'seal_of_fury',
        'judgement',
        'holy_strike',
        'holy_shock',
        'holy_shield',
        'consecration',
      ],
      property: 'costFraction',
    },
  ],

  improved_judgement: [{ kind: 'abilityCooldown', abilityId: 'judgement', unit: 'seconds' }],

  holy_conduit: [
    // Consecration is the only one of its four in the book; the other three
    // are Undead-and-Demon spells that do nothing here.
    { kind: 'grantCastModifier', abilityIds: ['consecration'], property: 'costFraction' },
    {
      kind: 'unmodelled',
      reason: `Its Holy Wrath, Exorcism and Hammer of Wrath clauses. ${NOT_UNDEAD}`,
    },
  ],

  conviction: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  vindication: [
    {
      kind: 'unmodelled',
      reason:
        'Its CHANCE is not stated anywhere. The values are the attack power ' +
        'taken, the attack power gained and the duration -- no proc rate -- so ' +
        'the talent is left inert rather than given an invented one.',
    },
  ],

  sanctified_judgement: [
    {
      kind: 'unmodelled',
      reason:
        'Returns a PERCENTAGE of the judged seal’s mana cost on Judgement. A ' +
        'refund proportional to a different ability’s cost has no declaration.',
    },
  ],

  seal_of_command: [{ kind: 'grantAbility', abilityId: 'seal_of_command' }],

  pursuit_of_justice: [{ kind: 'unmodelled', reason: 'Movement speed, and nothing here moves.' }],

  eye_for_an_eye: [
    {
      kind: 'unmodelled',
      reason: 'Reflects crits taken. Only the Protection profile is attacked, and it does not take this.',
    },
  ],

  sacred_arbiter: [
    { kind: 'abilityDamage', abilityId: 'holy_strike' },
    {
      kind: 'unmodelled',
      reason:
        'The damage applies. Its "refreshes all Judgement effects" clause does ' +
        'not: the only judgement with a duration is the Crusader’s, which is ' +
        'itself tracked and inert.',
    },
  ],

  crusade: [
    { kind: 'conditionalDamage', requires: {} },
    { kind: 'unmodelled', reason: `Its extra bonus against Demons and Undead does nothing. ${NOT_UNDEAD}` },
  ],

  two_handed_weapon_specialization: [
    { kind: 'conditionalDamage', requires: { twoHanded: true } },
  ],

  vengeance: [{ kind: 'reaction', reactionId: 'vengeance' }],

  repentance: [
    { kind: 'unmodelled', reason: 'An incapacitate, and only against Humanoids.' },
  ],

  champion_of_the_light: [
    {
      kind: 'unmodelled',
      reason:
        'Spell damage from a PERCENTAGE OF INTELLECT. The fourth talent in the ' +
        'project with that shape and the first where it bites: the seal formula ' +
        'has a spell power term, so this is real damage the Retribution build ' +
        'is not getting.',
    },
  ],

  instrument_of_law: [
    {
      kind: 'unmodelled',
      reason: `Hammer of Wrath cast time, which is never usable here, and ${NO_THREAT}`,
    },
  ],

  twist_of_light: [
    /*
     * A FLAG ON EVERY SEAL rather than a reaction, because the talent fires
     * when a seal is REPLACED and only `castSeal` knows that happened. The
     * reaction that spends the Echo is carried by every Paladin and does
     * nothing without one.
     */
    { kind: 'abilityFlag', abilityId: 'seal_of_righteousness', key: TWIST_OF_LIGHT_FLAG },
    { kind: 'abilityFlag', abilityId: 'seal_of_command', key: TWIST_OF_LIGHT_FLAG },
    { kind: 'abilityFlag', abilityId: 'seal_of_the_crusader', key: TWIST_OF_LIGHT_FLAG },
    { kind: 'abilityFlag', abilityId: 'seal_of_fury', key: TWIST_OF_LIGHT_FLAG },
  ],
};
