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

/**
 * Said once; six talents say it.
 *
 * ----------------------------------------------------------------------------
 * THIS IS THE ENCOUNTER, NOT THE ENGINE, and the distinction decides whether
 * it ever expires. `targetAttacks` exists and three profiles use it -- Prot
 * Warr, Prot Pally and Bear all take damage, ramp, and can die. What the
 * Priest has is no TANK profile, because a Priest is not one: the class's two
 * defensive trees are healing, and healing throughput is out of scope by the
 * owner's ruling.
 *
 * So none of the six is a missing engine capability, and writing one up as a
 * gap that a future context could close reads as work that exists. Two of them
 * -- `spell_warding` and `improved_inner_fire` -- are ordinary numbers the
 * engine already has a place for, and declaring them would move nothing and
 * report as fully modelled, which is the less honest of the two answers.
 *
 * WORTH ASKING THE OWNER, as the same shape was worth asking for stealth: six
 * Priest talents and eleven points of the one Shadow build hang on an
 * encounter property rather than on a ruling.
 * ----------------------------------------------------------------------------
 */
const NOT_ATTACKED =
  'It needs the Priest to be attacked, and no Priest profile is -- the class ' +
  'has no tank build here. The engine models incoming damage and three ' +
  'profiles in other classes use it, so this is the ENCOUNTER rather than a ' +
  'missing capability.';

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

  silent_resolve: [{ kind: 'unmodelled', scope: 'threat', reason: `${NO_THREAT} Its stun and fear clauses reach nothing.` }],

  /*
   * IT APPLIES, AND A SHADOW PRIEST STILL GETS NOTHING FROM IT -- which is the
   * honest shape rather than a caveat. The hit reaches every Holy spell the
   * character casts and this build casts none, so the talent WORKS and the
   * BUILD is what does not reach it. The old reason claimed the engine could
   * not express it, and that half has expired.
   *
   * 18% AT 3/3, WHICH IS THE CAPTURE'S OWN NUMBER and much larger than the
   * Shadow and Arcane trees' 5%. The Paladin's Divine Precision reads 18% too,
   * at the same three ranks and for the same school, so the two corroborate
   * each other -- and that is the only cross-check available, because talent
   * VALUES have no second source.
   */
  holy_precision: [{ kind: 'schoolHit', schools: ['holy'] }],

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

  /*
   * BOTH HALVES, AND THE REASON WAS WRONG ABOUT THE SECOND ONE. It said the
   * crit was "a one-shot per-ability crit modifier, which nothing carries" --
   * true of `CastModifier`, which covers cast time and cost, and not true of
   * the project: an AURA carries per-ability modifiers, and Fingers of Frost
   * is already an aura whose charge a cast spends and whose effect the DAMAGE
   * reads. Inner Focus is that shape with a cost modifier added.
   *
   * The ordering it depends on, and why `consumedByCast` is absent, is written
   * out on `INNER_FOCUS` in `auras/priest.ts` and on its spender in
   * `reactions/priestTalents.ts`. NO PRIEST PROFILE TAKES IT, so it moves no
   * figure -- it is tested on its mechanism.
   */
  inner_focus: [
    { kind: 'grantAbility', abilityId: 'inner_focus' },
    { kind: 'castReaction', reactionId: 'inner_focus' },
  ],

  meditation: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],

  improved_inner_fire: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],

  mental_strength: [{ kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 }],

  soul_warding: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],
  improved_mana_burn: [{ kind: 'unmodelled', reason: 'Mana Burn, which no damage list casts.' }],
  penance: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],
  renewed_hope: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],
  divine_aegis: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],

  /*
   * ITS OWN REASON SAID "Expressible -- and no Shadow build reaches it, so it
   * is written down rather than built", which is an odd thing for a project
   * that counts live gaps to settle for: not reaching a talent is a property
   * of one BUILD and the census is a property of the CLASS. Built.
   *
   * The target question and the healing half are on `POWER_INFUSION` in
   * `auras/priest.ts`. The Shadow build spends 16 points in Discipline and
   * this is the 31-point capstone, so it moves no figure here either.
   */
  power_infusion: [{ kind: 'grantAbility', abilityId: 'power_infusion' }],

  // --- Holy ----------------------------------------------------------------

  /*
   * THREE POINTS THE SHADOW PROFILE SPENDS, and two separate things stop it.
   * The wording matches the Mage's and the Warlock's so the family expires
   * together the day either one is answered.
   */
  twilight_focus: [
    {
      kind: 'unmodelled',
      scope: 'castPushback',
      reason:
        'Avoiding interruption from damage while casting, which is out of scope ' +
        "by the ruleset owner's 2026-09-30 ruling.",
    },
  ],

  improved_renew: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],

  holy_specialization: [{ kind: 'schoolCrit', schools: ['holy'] }],

  spell_warding: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],

  divine_fury: [
    { kind: 'abilityCastTime', abilityId: 'smite' },
    { kind: 'unmodelled', reason: 'Smite and the heals, none of which a Shadow list casts.' },
  ],

  holy_nova: [{ kind: 'unmodelled', reason: 'An area spell, and there is one target.' }],
  blessed_recovery: [{ kind: 'unmodelled', reason: NOT_ATTACKED }],
  inspiration: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],
  holy_reach: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Range, and nothing here has a position.' }],
  improved_healing: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],

  searing_light: [{ kind: 'schoolDamage', schools: ['holy'] }],

  binding_heal: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],
  litany_of_light: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],

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

  spiritual_healing: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],
  prayer_of_mending: [{ kind: 'unmodelled', scope: 'healing', reason: NO_HEALING }],

  // --- Shadow --------------------------------------------------------------

  /*
   * --------------------------------------------------------------------------
   * FIVE POINTS THE SHADOW PROFILE SPENDS, AND THEY WERE BUYING NOTHING. This
   * is the largest live gap the one Priest build actually TAKES, and the rest
   * of its gaps are talents it does not: the census counts a class and a
   * profile spends points.
   *
   * ITS OLD REASON WAS HALF RIGHT, WHICH IS WHY IT LASTED. Hit IS settled by
   * the attack table before any per-school modifier is consulted -- and the
   * school's modifier is one of the three `combineModifiers` folds into the
   * chances BEFORE the roll, alongside the ability's and the table's. The route
   * was there; `AbilityModifier` had no field to carry hit along it. See
   * `schoolHit` in `TalentEffect.ts`.
   *
   * WHAT IT IS WORTH IS NOT 5% OF THE PROFILE, and reasoning from the tooltip
   * would say it is. Spell miss is 17%, so 5 points take the landing rate from
   * 83% to 88% -- +6.0% on what ROLLS. Half this build's damage does not roll:
   * Shadow Word: Pain and Devouring Plague apply auras with no table at all,
   * and a tick's landing was settled when the aura went on. Mind Flay and Mind
   * Blast are the two that pay, and they are 65% of the damage. Measure it.
   * --------------------------------------------------------------------------
   */
  shadow_focus: [{ kind: 'schoolHit', schools: ['shadow'] }],

  blackout: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'A stun, which is out of scope as every stun is.' }],

  /*
   * --------------------------------------------------------------------------
   * FIVE POINTS OF THE OWNER'S OWN BUILD, AND THE LARGEST DEAD ALLOCATION IN
   * ANY PROFILE IN THIS PROJECT. Worth stating plainly rather than leaving in
   * a one-line reason.
   *
   * ITS MANA HALF IS NOT OUT OF SCOPE. "Your Mana will regenerate at 50% of
   * normal rate while casting" is mana RETURN, which the owner's rulings
   * explicitly keep in scope because it changes a damage profile's sustain --
   * so this is not a healing talent wearing a different hat. What gates it is
   * the KILL, and the encounter is a damage sink running for a fixed duration
   * that nothing ever kills.
   *
   * SO IT IS THE SAME SHAPE THE OPENERS WERE BEFORE THE OWNER RULED ON THEM:
   * an ENCOUNTER property that no amount of engine work reaches, counted as a
   * live gap because no `OutOfScope` member covers it. One talent rather than
   * eleven, and it is one question -- is a talent that triggers on a kill in
   * scope? -- for the owner rather than a judgement to make while writing a
   * class.
   * --------------------------------------------------------------------------
   */
  spirit_tap: [
    {
      kind: 'unmodelled',
      reason:
        'It needs a KILL, and the encounter is a damage sink that survives ' +
        'every fight by design. Its 100% Spirit and its "regenerate while ' +
        'casting" are both expressible and both wait on a trigger nothing ' +
        'here pulls. Not an engine gap and not a missing number: a property ' +
        'of the encounter, which is the one kind of blocker only a ruling ' +
        'from the owner can settle.',
    },
  ],

  shadow_affinity: [{ kind: 'unmodelled', scope: 'threat', reason: NO_THREAT }],

  improved_shadow_word_pain: [
    /*
     * A DURATION TALENT, which is real damage rather than the same total
     * spread thinner: the tooltip's 762 is over the BASE eighteen seconds, so
     * six more seconds is two more ticks. Handed to the ability as a named
     * number, because the duration lives on the aura the ability applies.
     */
    { kind: 'abilityBonus', abilityId: 'shadow_word_pain', key: SWP_EXTRA_SECONDS_BONUS },
  ],

  shadow_reach: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Range, and nothing here has a position.' }],

  improved_mind_blast: [{ kind: 'abilityCooldown', abilityId: 'mind_blast', unit: 'seconds' }],

  improved_psychic_scream: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'A fear, which is out of scope.' }],

  mind_flay: [{ kind: 'grantAbility', abilityId: 'mind_flay' }],

  /*
   * --------------------------------------------------------------------------
   * IT WAS READING THE YARDS. "Your Mind Flay now deals {0}% more damage,
   * gains {1} yards increased range, but slows the target's movement speed by
   * {2}%" -- three numbers in one row, and `valueIndex: 1` is the RANGE.
   *
   * THE ROW IS WHAT MADE IT INVISIBLE. At 2/2 the values are [20, 10, 20], so
   * reading index 1 gave 10% where the talent is 20% -- and 10 is both a
   * plausible damage percentage AND exactly what rank 1 correctly grants. So
   * the talent read as "one rank behind itself", which no results page could
   * show and no coefficient probe could catch: Mind Flay still scaled, still
   * crit, and still took 48% of the profile's damage.
   *
   * MIND FLAY IS NEARLY HALF THIS BUILD'S DAMAGE, so the missing 10% is the
   * single largest number the Priest was giving away.
   *
   * `valueIndex: 0` IS WRITTEN OUT rather than left to the default, because
   * the default is what the next edit will reach for and this row has three
   * numbers in it. The range clause is positioning and the slow is crowd
   * control; both are out of scope by ruling, so nothing else in the row is
   * wanted.
   * --------------------------------------------------------------------------
   */
  improved_mind_flay: [{ kind: 'abilityDamage', abilityId: 'mind_flay', valueIndex: 0 }],

  improved_fade: [{ kind: 'unmodelled', scope: 'threat', reason: `Fade is a threat drop. ${NO_THREAT}` }],

  vampiric_embrace: [{ kind: 'grantAbility', abilityId: 'vampiric_embrace' }],

  shadow_weaving: [{ kind: 'reaction', reactionId: 'shadow_weaving' }],

  silence: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'A silence, and nothing the target does is a cast.' }],

  devouring_contagion: [
    { kind: 'grantCastModifier', abilityIds: ['devouring_plague'], property: 'costFraction' },
    {
      kind: 'unmodelled',
      reason:
        'Its mana reduction applies. Its spread clause needs a target to die, ' +
        'which never happens.',
    },
  ],

  /*
   * --------------------------------------------------------------------------
   * BUILT, AND WITH THE ROGUE'S QUIETUS -- the same mechanism at a different
   * fraction and for damage rather than crit.
   *
   * ITS OLD REASON WAS WRONG ABOUT THE ENGINE, NOT MERELY STALE. It said "the
   * target never drops", which reads as the TARGET cause of inert -- and a
   * low-health requirement is not one of those. `inExecutePhase` in
   * `combat/executePhase.ts` reads remaining combat TIME against a fraction of
   * the planned duration, by the ruling made for Execute and deliberately
   * shared, so the window this talent wants OPENS in every fight. That
   * reasoning had been got wrong three times when this was written.
   *
   * THE 20 IS THE TALENT'S OWN NUMBER, not `EXECUTE_PHASE_FRACTION`. The two
   * agree today and are different facts -- one is Execute's threshold and one
   * is this talent's -- so the effect reads index 0 of its own row rather than
   * importing a constant that would go on agreeing after Forever moved one of
   * them. `values/priest.json` states [[20, 15], [20, 30]].
   *
   * AND IT IS TRIPLY UNREACHED BY THE ONE PRIEST PROFILE, which is worth saying
   * plainly rather than leaving as a surprise. The Shadow build does not take
   * it; the ability it modifies is Shadow Word: Death; and the ruleset owner's
   * priority list removed that ability, isolated at -35.7. So it moves no
   * figure in the baseline and is tested on its MECHANISM, which is the
   * distinction between a talent WORKING and a talent MATTERING.
   * --------------------------------------------------------------------------
   */
  early_demise: [
    {
      kind: 'abilityCritInFinalFraction',
      abilityId: 'shadow_word_death',
      fractionIndex: 0,
      valueIndex: 1,
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
