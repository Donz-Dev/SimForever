import type { TalentEffects } from './TalentEffect';
import { SWP_EXTRA_SECONDS_BONUS } from '../abilities/priest';

/**
 * What each Priest talent does, as data.
 *
 * Every one of the 53 has an entry, and one that cannot be expressed says so.
 *
 * ----------------------------------------------------------------------------
 * THE LAST CLASS, AND ITS ONE PROFILE IS SHADOW. Twenty-six of these talents
 * are healing, which nothing in this project measures -- so the Discipline and
 * Holy trees are mostly inert for a reason that has nothing to do with the
 * engine and everything to do with there being no healing profile.
 *
 * A PERCENTAGE MANA REDUCTION IS FINALLY EXPRESSIBLE, and Shadowform is what
 * made it obvious: `CastModifier.costFraction` takes a FRACTION OF THE COST,
 * which is exactly what "reduces the mana cost by 50%" is. `abilityCost`
 * subtracts a flat amount, and that mismatch is the single most common
 * unmodelled reason across the other eight classes. Mental Agility and
 * Devouring Contagion use it here too.
 * ----------------------------------------------------------------------------
 */

/** Said once; twenty-six talents say it. */
const NO_HEALING = 'Healing, and nothing in this project measures it.';

/** Said once; five talents say it. */
const NO_THREAT = 'Threat, which the engine does not track.';

/** Said once; four talents say it. */
const NOT_ATTACKED =
  'It needs the Priest to be attacked, and no damage profile here is.';

export const PRIEST_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Discipline ----------------------------------------------------------

  power_in_light: [{ kind: 'unmodelled', reason: 'Smite and Penance, which a Shadow list never casts.' }],

  wand_specialization: [
    { kind: 'unmodelled', reason: 'Wands are not modelled; no Priest profile swings or shoots.' },
  ],

  twin_disciplines: [
    /*
     * "Increases the damage and healing of your INSTANT CAST spells."
     *
     * NAMED ONE BY ONE, because `conditionalDamage` selects on weapons and
     * nothing selects "an ability with no cast time". Four of the Shadow
     * build's spells are instants and all four are here; Mind Blast and Mind
     * Flay are not, which is correct and is why this is a list rather than a
     * blanket multiplier.
     */
    { kind: 'abilityDamage', abilityId: 'shadow_word_pain' },
    { kind: 'abilityDamage', abilityId: 'devouring_plague' },
    { kind: 'abilityDamage', abilityId: 'shadow_word_death' },
  ],

  silent_resolve: [{ kind: 'unmodelled', reason: `${NO_THREAT} Its stun and fear clauses reach nothing.` }],

  holy_precision: [
    {
      kind: 'unmodelled',
      reason:
        'Spell HIT for one school, which the attack table decides before any ' +
        'per-school modifier is consulted -- and a Shadow priest casts no Holy.',
    },
  ],

  improved_power_word_shield: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],

  martyrdom: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],

  mental_agility: [
    /*
     * THE TALENT THAT NAMED THE MISSING EFFECT KIND, AND IT NOW USES IT. Its
     * reason read "this wants a `grantCastModifier` and not a new rule", which
     * turned out to be exactly right: the modifier, its resolution and its
     * consumption all already existed, and only the declaration was missing.
     *
     * "Your Smite, Holy Fire, and INSTANT CAST spells" -- four of the Shadow
     * build's spells are instants. It stacks with Shadowform's 50%
     * ADDITIVELY, so a Shadow priest pays 60% less for those four.
     */
    {
      kind: 'grantCastModifier',
      abilityIds: [
        'shadow_word_pain',
        'devouring_plague',
        'shadow_word_death',
        'vampiric_embrace',
      ],
      property: 'costFraction',
    },
  ],

  inner_focus: [
    {
      kind: 'unmodelled',
      reason:
        'Free next spell plus 25% crit on it. The cost half is a `CastModifier` ' +
        'a talent cannot grant; the crit half is a one-shot per-ability crit ' +
        'modifier, which nothing carries.',
    },
  ],

  meditation: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],

  improved_inner_fire: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],

  mental_strength: [{ kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 }],

  soul_warding: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],
  improved_mana_burn: [{ kind: 'unmodelled', reason: 'Mana Burn, which no damage list casts.' }],
  penance: [{ kind: 'unmodelled', reason: NO_HEALING }],
  renewed_hope: [{ kind: 'unmodelled', reason: NO_HEALING }],
  divine_aegis: [{ kind: 'unmodelled', reason: NO_HEALING }],

  power_infusion: [
    {
      kind: 'unmodelled',
      reason:
        'A 20% spell damage buff on a TARGET, which for one character is ' +
        'itself. Expressible -- and no Shadow build reaches it, so it is ' +
        'written down rather than built.',
    },
  ],

  // --- Holy ----------------------------------------------------------------

  twilight_focus: [
    { kind: 'unmodelled', reason: 'Avoiding interruption, and nothing interrupts a cast here.' },
  ],

  improved_renew: [{ kind: 'unmodelled', reason: NO_HEALING }],

  holy_specialization: [{ kind: 'schoolCrit', schools: ['holy'] }],

  spell_warding: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],

  divine_fury: [
    { kind: 'abilityCastTime', abilityId: 'smite' },
    { kind: 'unmodelled', reason: 'Smite and the heals, none of which a Shadow list casts.' },
  ],

  holy_nova: [{ kind: 'unmodelled', reason: 'An area spell, and there is one target.' }],
  blessed_recovery: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],
  inspiration: [{ kind: 'unmodelled', reason: NO_HEALING }],
  holy_reach: [{ kind: 'unmodelled', reason: 'Range, and nothing here has a position.' }],
  improved_healing: [{ kind: 'unmodelled', reason: NO_HEALING }],

  searing_light: [{ kind: 'schoolDamage', schools: ['holy'] }],

  binding_heal: [{ kind: 'unmodelled', reason: NO_HEALING }],
  litany_of_light: [{ kind: 'unmodelled', reason: NO_HEALING }],

  spirit_of_redemption: [
    { kind: 'unmodelled', reason: 'It triggers on the Priest dying, which a damage profile does not.' },
  ],

  spiritual_guidance: [
    /*
     * "Increases your spell healing by up to {0}% of your total Spirit and
     * your spell damage by up to {1}% of your total Spirit."
     *
     * TWO NUMBERS IN ONE ROW AND THE DAMAGE ONE IS SECOND -- 25% healing and
     * 8% damage at 5/5. Taking the first would hand Shadow three times the
     * spell power it earns, and it would look entirely plausible. The healing
     * half is not modelled because nothing here measures healing.
     */
    { kind: 'statFromStat', from: 'spirit', to: 'spellPower', valueIndex: 1 },
  ],

  spiritual_healing: [{ kind: 'unmodelled', reason: NO_HEALING }],
  prayer_of_mending: [{ kind: 'unmodelled', reason: NO_HEALING }],

  // --- Shadow --------------------------------------------------------------

  shadow_focus: [
    {
      kind: 'unmodelled',
      reason:
        'Spell HIT for one school, which the attack table decides before any ' +
        'per-school modifier is consulted. The same gap the Mage Arcane Focus ' +
        'and the Shaman Elemental Precision have, and this build takes it 5/5.',
    },
  ],

  blackout: [{ kind: 'unmodelled', reason: 'A stun, which is out of scope as every stun is.' }],

  spirit_tap: [
    { kind: 'unmodelled', reason: 'It needs a KILL, and the target survives every fight.' },
  ],

  shadow_affinity: [{ kind: 'unmodelled', reason: NO_THREAT }],

  improved_shadow_word_pain: [
    /*
     * A DURATION TALENT, which is real damage rather than the same total
     * spread thinner: the tooltip's 762 is over the BASE eighteen seconds, so
     * six more seconds is two more ticks. Handed to the ability as a named
     * number, because the duration lives on the aura the ability applies.
     */
    { kind: 'abilityBonus', abilityId: 'shadow_word_pain', key: SWP_EXTRA_SECONDS_BONUS },
  ],

  shadow_reach: [{ kind: 'unmodelled', reason: 'Range, and nothing here has a position.' }],

  improved_mind_blast: [{ kind: 'abilityCooldown', abilityId: 'mind_blast', unit: 'seconds' }],

  improved_psychic_scream: [{ kind: 'unmodelled', reason: 'A fear, which is out of scope.' }],

  mind_flay: [{ kind: 'grantAbility', abilityId: 'mind_flay' }],

  improved_mind_flay: [{ kind: 'abilityDamage', abilityId: 'mind_flay', valueIndex: 1 }],

  improved_fade: [{ kind: 'unmodelled', reason: `Fade is a threat drop. ${NO_THREAT}` }],

  vampiric_embrace: [{ kind: 'grantAbility', abilityId: 'vampiric_embrace' }],

  shadow_weaving: [{ kind: 'reaction', reactionId: 'shadow_weaving' }],

  silence: [{ kind: 'unmodelled', reason: 'A silence, and nothing the target does is a cast.' }],

  devouring_contagion: [
    { kind: 'grantCastModifier', abilityIds: ['devouring_plague'], property: 'costFraction' },
    {
      kind: 'unmodelled',
      reason:
        'Its mana reduction applies. Its spread clause needs a target to die, ' +
        'which never happens.',
    },
  ],

  early_demise: [
    {
      kind: 'unmodelled',
      reason: 'It needs the target at or below 20% health, and the target never drops.',
    },
  ],

  darkness: [{ kind: 'schoolDamage', schools: ['shadow'] }],

  shadowform: [
    { kind: 'grantAbility', abilityId: 'shadowform' },
    /*
     * ITS CRIT DAMAGE CLAUSE LANDS HERE rather than on the aura, because an
     * aura cannot carry a school modifier -- `SchoolModifiers` is built once
     * when the character is. So the form's damage and mana live on the aura
     * and its +100% Shadow crit damage lives on the talent that grants it.
     *
     * A hundred percent of a spell crit's 0.5 bonus takes a Shadow crit from
     * 1.5x to 2.0x, which is the largest single number in this build.
     */
    { kind: 'schoolCritDamage', schools: ['shadow'] },
  ],
};
