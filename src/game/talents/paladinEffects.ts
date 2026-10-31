import type { TalentEffects } from './TalentEffect';
import { SHIELD_SPECIALIZATION_CHANCE_KEY } from '../reactions/paladinTalents';
import {
  CONSECRATED_GROUND_FLAG,
  IMPROVED_RIGHTEOUS_FURY_FLAG,
  ILLUMINATION_CHANCE_KEY,
  ILLUMINATION_REFUND_KEY,
  INFUSION_OF_LIGHT_KEY,
} from '../auras/paladin';

/**
 * What each Paladin talent does, as data.
 *
 * Every one of the 51 has an entry, and one that cannot be expressed says so.
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
 *
 * ----------------------------------------------------------------------------
 * AND WHAT USED TO CLUSTER HERE AND NO LONGER DOES: BLOCKS. Three talents --
 * Reckoning, Holy Shield and Shield Specialization -- were written off against a
 * rule that a reaction cannot fire on a block. It is not a rule; `melee-received`
 * rolls `block` and the Warrior's own reactions have keyed on it all along. All
 * three work now and none of them needed a new engine capability.
 *
 * TWO MORE WENT THE SAME WAY, for different wrong reasons. Divine Favor's said a
 * one-shot per-ability crit modifier did not exist, which was true of
 * `CastModifier` and false of an AURA's `abilityModifiers`. Judgement of the
 * Crusader's said a flat per-school damage bonus had no declaration, when "up to
 * 161" is spell POWER and always was.
 *
 * THE ONE THAT IS A GENUINE ENGINE ADDITION is Divine Precision, and it is shared
 * with the Mage twice and the Priest twice: `AbilityModifier.hitBonus`, one field
 * on a modifier the roll was already consulting.
 * ----------------------------------------------------------------------------
 */


/** Said once; six talents say it. */

/** Said once; four talents say it. */
const NOT_UNDEAD =
  'It applies only to Undead or Demon targets, and the training dummy is ' +
  'neither -- inert because of the target rather than because of the engine.';

export const PALADIN_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Holy ----------------------------------------------------------------

  /*
   * IMPROVED HOLY STRIKE IS GONE, removed from the Holy tree at client build
   * 1.60.1.70170 and named nowhere in the patch notes -- the tree is two talents
   * shorter, 52 to 50, and Crusade in Retribution is the other one.
   *
   * ALL THREE PALADIN BUILDS SPENT TWO POINTS HERE, so all three had to be
   * re-specified; the owner supplied new URLs when asked. It took one second off
   * Holy Strike's cooldown per rank, so what the Retribution and Protection
   * profiles lose is two seconds off a ten-second ability they both cast.
   *
   * HOLY STRIKE ITSELF GAINED ELSEWHERE in the same patch: Sacred Arbiter's
   * damage bonus went 10% to 20%, and Holy Power now raises its crit chance by
   * 15% rather than only Holy Shock's.
   */

  divine_strength: [{ kind: 'stat', stat: 'strength', operation: 'percentAdd', scale: 0.01 }],

  divine_intellect: [{ kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 }],

  /*
   * HEALING IS A FEATURE SINCE ROUND 52 -- the owner's Holy Pal -- so the four
   * Holy talents its build relies on lost their `healing` scope tags and do
   * what they say. "+12% to Holy Light, Flash of Light and Holy Shock" heals.
   */
  healing_light: [
    { kind: 'abilityHealing', abilityId: 'holy_light' },
    { kind: 'abilityHealing', abilityId: 'flash_of_light' },
    { kind: 'abilityHealing', abilityId: 'holy_shock' },
  ],

  spiritual_focus: [
    {
      kind: 'unmodelled',
      /*
       * CAST PUSHBACK, NOT HEALING (round 52). Filed under `healing` while heals
       * were out of scope; with them in, what is left is the pushback, which is
       * its own ruling -- a compound reason losing its first clause.
       */
      scope: 'castPushback',
      reason: 'Pushback while casting heals. Nothing interrupts or pushes back a Paladin here.',
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
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Fear and Disorient duration, and nothing applies either.' },
  ],


  reverence: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],

  purifying_power: [
    /*
     * TWO CLAUSES, TWO CAUSES, AND THEY ARE NOW TWO ENTRIES. A single reason
     * could carry only one `scope`, so the halves had to be split before either
     * could be classified -- which is the same lesson three other Paladin talents
     * taught in the shape of a reason whose first clause stayed true.
     */
    {
      kind: 'unmodelled',
      scope: 'dispel',
      reason:
        'Its Cleanse and Purify cost reduction. Both are dispels, and dispels ' +
        'are out of scope by the owner’s ruling: nothing in any encounter here ' +
        'applies anything dispellable and nothing here dispels.',
    },
    {
      kind: 'unmodelled',
      reason:
        'Its cooldown reduction reaches Exorcism and Holy Wrath, neither of ' +
        `which is declared. ${NOT_UNDEAD}`,
    },
  ],

  // A Holy Shock or Flash of Light crit takes {1} seconds off the next Holy
  // Light. The duration, {0}, is the aura's own 15. See `paladinHeal`.
  infusion_of_light: [
    { kind: 'abilityBonus', abilityId: 'holy_shock', key: INFUSION_OF_LIGHT_KEY, valueIndex: 1 },
    { kind: 'abilityBonus', abilityId: 'flash_of_light', key: INFUSION_OF_LIGHT_KEY, valueIndex: 1 },
  ],

  /*
   * A heal crit returns {1}% of the spell's base cost {0}% of the time. Both
   * numbers ride on the three heal abilities; Light's Vigil is the fourth the
   * tooltip names and is not declared. See `paladinHeal`.
   */
  illumination: [
    ...(['holy_light', 'flash_of_light', 'holy_shock'] as const).flatMap((abilityId) => [
      { kind: 'abilityBonus' as const, abilityId, key: ILLUMINATION_CHANCE_KEY, valueIndex: 0 },
      { kind: 'abilityBonus' as const, abilityId, key: ILLUMINATION_REFUND_KEY, valueIndex: 1 },
    ]),
  ],

  divine_favor: [
    /*
     * ITS REASON WAS TRUE OF THE WRONG TYPE. "A one-shot per-ability CRIT
     * modifier, which `CastModifier` does not carry" -- correct about
     * `CastModifier`, and an AURA has carried `abilityModifiers` since Shatter,
     * where a `critBonus` for one named ability is exactly this.
     *
     * TWO EFFECTS, because the ability and the spending of it are different
     * things: `grantAbility` puts the button in the book, and the cast reaction
     * takes the buff away when a Holy Shock has used it. The reaction has to be
     * a CAST reaction rather than `consumedByCast`, because cast charges are
     * spent BEFORE `onCast` runs and the crit would be gone before it was rolled.
     */
    { kind: 'grantAbility', abilityId: 'divine_favor' },
    // Single rank, so its values entry is `null`: the reaction takes no number.
    { kind: 'castReaction', reactionId: 'divine_favor', valueless: true },
    // All three of its spells since round 52: the aura names Holy Light and
    // Flash of Light too, and the reaction spends it on whichever goes first.
  ],

  divine_precision: [
    /*
     * "IMPROVES YOUR CHANCE TO HIT WITH HOLY SPELLS BY 8%" at 2/2 since
     * 1.60.1.70707 -- two ranks where it had three, 8% where it was 18%, and no
     * longer behind Holy Shock. Index 0 now, because the row grew a second
     * number: the Silence reduction, which is crowd control.
     *
     * HOLY ONLY, which for this class is Judgement, Holy Shock, Consecration's
     * ticks and every seal. Holy Strike is dealt as PHYSICAL, so it keeps the
     * melee table's own miss chance.
     */
    { kind: 'schoolHit', schools: ['holy'], valueIndex: 0 },
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Its Silence duration, and nothing silences anybody here.' },
  ],

  holy_shock: [{ kind: 'grantAbility', abilityId: 'holy_shock' }],

  consecrated_ground: [
    /*
     * "GIVES YOUR HOLY SPELLS 10% INCREASED DAMAGE AGAINST THE FIRST 4 ENEMIES
     * THAT ENTER YOUR CONSECRATION", and it is expressed where it belongs: on the
     * Consecration debuff itself, as `damageTakenBySchool`.
     *
     * IT WAS A FLAT BONUS TO CONSECRATION'S OWN DAMAGE, which is a different
     * effect wearing the same number -- it missed Judgement, Holy Shock and every
     * seal, and paid Consecration a bonus the tooltip does not give it. The
     * `abilityBonus` carries the percentage to the ability so the aura it applies
     * can be built with the talent's rank in it.
     *
     * "AGAINST ENEMIES IN YOUR CONSECRATION" IS THE DEBUFF ITSELF, because that is
     * how the ground effect is modelled: one target that never moves, carrying the
     * aura for its eight seconds. `damageTakenBySchool` is on the TARGET, so
     * strictly it raises Holy damage from anyone rather than from this Paladin --
     * with one Paladin and one enemy the two readings are the same number.
     *
     * NO PROFILE TAKES IT, so this is inert by BUILD.
     */
    {
      kind: 'abilityBonus',
      abilityId: 'consecration',
      key: CONSECRATED_GROUND_FLAG,
    },
  ],

  /*
   * "Increases the critical strike chance of your Holy Shock and Holy Strike
   * spells by {0}%, and all other spells by {1}%" -- 15% and 5% at 5/5.
   *
   * HOLY STRIKE WAS ADDED TO THE FIRST CLAUSE at client build 1.60.1.70170,
   * which the patch notes do not mention, and it is the one Paladin figure in
   * this patch that moves a damage profile rather than a tank one: Holy Strike
   * is in all three priority lists and Holy Shock is in one.
   *
   * TWO ENTRIES AND TWO INDICES, unchanged in shape. The named spells take
   * `abilityCrit` at index 0; "all other spells" is the character-wide
   * `spellCritChance` at index 1, which also reaches the two named ones -- so
   * they collect 20% in total, which is what the tooltip's "and all other"
   * arithmetic gives and is deliberate rather than a double count.
   */
  holy_power: [
    /*
     * REWORKED AT 1.60.1.70707: "Increases the critical strike healing bonus of
     * your Holy spells by {0}%", 50% at 5/5. It used to be crit CHANCE on Holy
     * Shock and Holy Strike and a little on every other spell; it is now heal
     * crit DAMAGE and nothing else, so it no longer reaches a damage build.
     *
     * THE BONUS HALF: a heal crits for 1.5, so "+50%" takes it to 1.75.
     * Healing-only by field, because Holy Shock's damage shares its id.
     */
    {
      kind: 'abilityHealingCritDamage',
      abilityIds: ['holy_light', 'flash_of_light', 'holy_shock', 'lights_vigil'],
    },
  ],

  oath_of_light: [
    /*
     * THE OWNER GAVE THE AMOUNTS the client data carries as zero: 400 on Holy
     * Light, 115 on Flash of Light, 229 on Holy Shock, as "up to" healing power
     * on the Oath target. See `oathOfLight` and `OATH_OF_LIGHT_ABILITY`.
     */
    { kind: 'grantAbility', abilityId: 'oath_of_light' },
  ],

  boundless_light: [
    /*
     * "INCREASES THE CRITICAL STRIKE CHANCE OF YOUR HOLY SHOCK SPELL BY {0}% WHEN
     * CAST ON ALLIES NOT AFFECTED BY YOUR OATH OF LIGHT". A standing heal crit
     * here, which the Oath target hands back -- see `oathOfLight`. A HEAL's crit
     * only: Holy Shock's damage on an enemy is not "cast on allies".
     */
    { kind: 'abilityHealingCrit', abilityIds: ['holy_shock'] },
  ],

  /*
   * DECLARED IN ROUND 61, when the owner asked the Holy Pal to cast it. The
   * spell and its Holy Shock half are `LIGHTS_VIGIL_ABILITY`.
   */
  light_s_vigil: [{ kind: 'grantAbility', abilityId: 'lights_vigil' }],

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
    /*
     * THE QUESTION THIS TALENT RAISED HAS BEEN ANSWERED. Its reason used to end
     * "whether an immunity that disarms you belongs in scope is a question for
     * the ruleset owner rather than a gap in the engine" -- and the owner has
     * ruled that it does not. Both halves are scoped now, so the talent is a
     * DECISION rather than work, and the Paladin's live-gap column drops to one.
     */
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason:
        'Its Blessing of Freedom half. Immunity to movement impairment, and ' +
        'nothing here moves.',
    },
    {
      kind: 'unmodelled',
      scope: 'immunity',
      reason:
        'Its Blessing of Protection half. "Protected from all physical attacks ' +
        'for 10 sec, but during that time they cannot attack or use physical ' +
        'abilities" -- an immunity that also stops you attacking, which is out ' +
        'of scope by the owner’s ruling: on a damage profile it costs its own ' +
        'damage and could never be worth using.',
    },
  ],

  anticipation: [{ kind: 'stat', stat: 'defenseSkill', operation: 'flat' }],


  improved_righteous_fury: [
    /*
     * "WHILE RIGHTEOUS FURY IS ACTIVE, ALL DAMAGE TAKEN IS REDUCED BY 9%" at 3/3
     * since 1.60.1.70707 (it was 6%). The Protection list casts Righteous Fury at
     * the pull, so the condition holds for the whole fight.
     */
    { kind: 'abilityBonus', abilityId: 'righteous_fury', key: IMPROVED_RIGHTEOUS_FURY_FLAG },
  ],

  shield_specialization: [
    /*
     * "INCREASES THE AMOUNT OF DAMAGE ABSORBED BY YOUR SHIELD BY 30%" IS BLOCK
     * VALUE, index 0; the mana clause is a block reaction at index 1's chance.
     * Two ranks since 1.60.1.70707, the second giving what the third did.
     */
    { kind: 'stat', stat: 'blockValue', operation: 'percentAdd', scale: 0.01 },
    { kind: 'reaction', reactionId: 'shield_specialization', valueIndex: 1 },
    // And the same chance carried to Holy Strike, for Shieldsworn.
    {
      kind: 'abilityBonus',
      abilityId: 'holy_strike',
      key: SHIELD_SPECIALIZATION_CHANCE_KEY,
      valueIndex: 1,
    },
  ],

  sacred_duty: [
    /*
     * THE STAMINA IS GONE (1.60.1.70707) and Forbearance's duration took its
     * place: "Reduces the cooldown of your Divine Shield, Divine Protection, and
     * Templar's Bulwark spells by {0} sec, and reduces the duration of
     * Forbearance by {1} sec." So the cooldown is index 0 now -- it was index 1
     * while the stamina sat in front of it.
     */
    { kind: 'abilityCooldown', abilityId: 'templars_bulwark', unit: 'seconds', valueIndex: 0 },
    {
      kind: 'unmodelled',
      reason:
        'Its Forbearance half. Forbearance gates Templar\'s Bulwark, Divine ' +
        'Shield and Divine Protection, and only the first is declared here -- ' +
        'with a four minute cooldown that outlasts its one minute Forbearance ' +
        'by itself, so ten seconds off it changes no cast.',
    },
    {
      kind: 'unmodelled',
      scope: 'immunity',
      reason:
        'Its Divine Protection cooldown. "You are protected from all physical ' +
        'attacks and spells for 8 sec, but during that time you cannot attack ' +
        'or use physical abilities yourself" -- an immunity that also stops you ' +
        'attacking, which the owner has ruled out of scope.',
    },
    {
      kind: 'unmodelled',
      reason:
        'Its Divine Shield cooldown. Divine Shield is NOT covered by the ' +
        'immunity ruling, because Forever\'s version reduces the damage you deal ' +
        'by 50% rather than stopping you attacking -- so it is a real survival ' +
        'cooldown a tank could use, and it is simply not a declared ability here.',
    },
  ],

  swift_judgement: [{ kind: 'grantAbility', abilityId: 'swift_judgement' }],


  improved_hammer_of_justice: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'A stun, which is out of scope as every stun is.' },
  ],

  templar_s_bulwark: [
    /*
     * ITS REASON EXPIRED WITHOUT ANYBODY TOUCHING THE TALENT, which is the
     * failure mode this project has now caught seven times. It said an absorb
     * shield worth the whole health pool was not granted -- and `TEMPLARS_BULWARK`
     * has carried `absorb: (target) => target.health.maximum` since the day
     * absorbs were built, the ABILITY has been in `PALADIN_ABILITIES`, and the
     * Protection list has cast it at 35% health for as long as the list existed.
     * Every part of the talent was working while the table said none of it was.
     *
     * DECLARING THE GRANT IS NOT A NO-OP, THOUGH. `TALENT_ABILITIES` is derived
     * from `grantAbility` in this table, so until now Templar's Bulwark was in
     * EVERY Paladin's book, talent or not -- which is a bonus being paid rather
     * than an omission, even though neither Retribution nor Shockadin has an entry
     * for it. Now only a build that spends the point can cast it.
     */
    { kind: 'grantAbility', abilityId: 'templars_bulwark' },
  ],

  reckoning: [
    /*
     * BOTH HALVES. "An extra attack after Blocking" was `unmodelled` with the
     * reason that a block is a flat reduction in the damage pipeline rather than
     * an attack outcome, "so no reaction can key on one" -- and `melee-received`
     * has rolled `block` since the table was written. One reaction covers both
     * clauses and picks its chance from the outcome.
     */
    { kind: 'reaction', reactionId: 'reckoning' },
    /*
     * AND THE HALF THAT PAYS OUT, which the patch separated from the trigger:
     * "you gain a CHARGE of Reckoning each time it triggers. Your next melee
     * swing (auto attack) will trigger all accumulated charges for 1 extra
     * attack each."
     *
     * TWO ENTRIES AND NOT ONE, the shape Primal Fury already has: one reaction
     * cannot fire on both a block taken and a swing dealt. `valueless` because
     * the release reads no rank -- the charge count is on the aura and the
     * chance to GAIN one is the other entry's business.
     */
    { kind: 'reaction', reactionId: 'reckoning_release', valueless: true },
  ],

  iron_creed: [
    /*
     * "WHILE RIGHTEOUS FURY IS ACTIVE, HOLY STRIKE ALSO REDUCES YOUR DAMAGE
     * TAKEN BY 10% FOR 6 SEC" at 5/5, which is index 1. Same two-clause reason as
     * Improved Righteous Fury and wrong in the same half.
     */
    { kind: 'castReaction', reactionId: 'iron_creed', valueIndex: 1 },
    // "Increases the threat generated by your Holy Strike ability by 25%."
    { kind: 'threat', direction: 'increase', valueIndex: 0, abilityIds: ['holy_strike'] },
  ],

  holy_shield: [
    /*
     * ROW 5 SINCE 1.60.1.70707, and no longer behind Templar's Bulwark -- so it
     * is not the Protection capstone any more; Shieldsworn is.
     *
     * Its damage half: 221 Holy for each of four blocks, every ten seconds. Its
     * "+20% additional threat" is NOT modelled.
     */
    { kind: 'grantAbility', abilityId: 'holy_shield' },
    /*
     * VALUELESS: a single-rank talent's values entry is `null`, and the 221 is
     * the ABILITY'S figure, so there is no talent number for it to want.
     */
    { kind: 'reaction', reactionId: 'holy_shield', valueless: true },
  ],

  stoicism: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Stun and Charm duration, and nothing stuns or charms anybody here.' },
  ],

  shieldsworn: [
    /*
     * THE PROTECTION CAPSTONE (1.60.1.70707): Holy Strike's cooldown four seconds
     * shorter -- hand-filled in the values file, a single-rank talent stating the
     * number literally -- and a landed Holy Strike setting off Holy Shield and
     * Shield Specialization. See `shieldswornStrike`.
     */
    { kind: 'abilityCooldown', abilityId: 'holy_strike', unit: 'seconds' },
    { kind: 'reaction', reactionId: 'shieldsworn', valueless: true },
    {
      kind: 'unmodelled',
      reason:
        'Its "allowing you to Block spells for 6 sec": nothing here casts a ' +
        'spell at a Paladin -- inert because of the TARGET.',
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
    /*
     * TWO OF ITS FOUR ARE IN THE BOOK NOW, AND THE SECOND ONE MATTERS A LOT.
     * "Reduces the mana cost of your Consecration, Holy Wrath, Exorcism, and
     * Hammer of Wrath spells by 40%" at 2/2, which both Retribution and Shockadin
     * take -- and Hammer of Wrath became a declared ability when the owner put it
     * in those two lists, after this reason was written. 40% off 425 mana is 170,
     * on the one entry in the Retribution list that fires zero times BECAUSE THE
     * BUILD IS OUT OF MANA. An expired reason with a measurable price.
     */
    {
      kind: 'grantCastModifier',
      abilityIds: ['consecration', 'hammer_of_wrath'],
      property: 'costFraction',
    },
    {
      kind: 'unmodelled',
      reason:
        'Its Consecration and Hammer of Wrath clauses apply. Holy Wrath and ' +
        `Exorcism are the other two and neither is declared: ${NOT_UNDEAD}`,
    },
  ],

  /*
   * "IMPROVES YOUR CHANCE TO GET A CRITICAL STRIKE WITH ALL SPELLS AND ATTACKS
   * BY 6%" at 3/3 since 1.60.1.70707 -- three ranks where it had five, and
   * "with all spells and attacks" where it said melee. That phrase is TWO
   * STATS here, `critChance` and `spellCritChance`, read by separate tables.
   */
  conviction: [
    { kind: 'stat', stat: 'critChance', operation: 'flat' },
    { kind: 'stat', stat: 'spellCritChance', operation: 'flat' },
  ],

  vindication: [
    /*
     * ITS CHANCE IS 10%, ON THE RULESET OWNER'S ANSWER. Since 1.60.1.70707 it no
     * longer raises the Paladin's own attack power -- "reduce the target's
     * Attack Power by {0} for {1} sec" is the whole tooltip -- so index 0, the
     * attack power taken, is all the reaction applies.
     */
    { kind: 'reaction', reactionId: 'vindication', valueIndex: 0 },
    {
      kind: 'unmodelled',
      reason:
        'The attack power it strips off the target is applied as a debuff and ' +
        "changes no number, because the encounter's damage is a flat placeholder " +
        'that reads no attack power -- inert because of the TARGET rather than ' +
        'because of the engine.',
    },
  ],

  sanctified_judgement: [
    /*
     * A REFUND PROPORTIONAL TO A DIFFERENT ABILITY'S COST, which its reason said
     * had no declaration -- and it needed no new engine capability, only a cast
     * reaction that asks `resolveCast` what the seal actually costs this build.
     *
     * INDEX 0 IS THE CHANCE, 33/66/100, and the 60% share is the constant beside
     * the reaction. Both profiles that take this take it at 3/3.
     *
     * 126 MANA EVERY EIGHT SECONDS on a Seal of Command, which is the largest
     * single piece of sustain either Retribution build has -- and the build that
     * spends 3425 of the 3449 mana it gains is the one that could not afford
     * Hammer of Wrath.
     */
    { kind: 'castReaction', reactionId: 'sanctified_judgement' },
  ],

  seal_of_command: [{ kind: 'grantAbility', abilityId: 'seal_of_command' }],

  pursuit_of_justice: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Movement speed, and nothing here moves.' }],

  eye_for_an_eye: [
    /*
     * BUILT, AND INERT FOR THE BUILD RATHER THAN FOR THE ENGINE -- which is the
     * third cause of inert and the only one of the three that expires when a
     * PROFILE changes. Reckoning already reacted to being critically hit, so
     * reflecting a share of that hit needed nothing new; what it needs is a
     * Paladin who is both attacked and spent two points here, and none of the
     * three is. Index 0 is the share; the 50%-of-health cap is index 1 and is 50
     * at both ranks.
     */
    { kind: 'reaction', reactionId: 'eye_for_an_eye' },
  ],

  sacred_arbiter: [
    /*
     * ITS 10% WAS DROPPED FOR WANT OF A NUMBER TO READ, which is the single-rank
     * trap this project has now been caught by twice. `values/paladin.json` is
     * generated by matching `{0}` placeholders against each rank's text, and a
     * one-rank talent has no variable to identify -- so its entry was `null` and
     * `talentBuild` discarded every effect asking for a value. The talent granted
     * nothing, reported itself FULLY MODELLED to a census that reads the effect
     * TABLE, and Holy Strike was quietly 10% smaller for the one build that pays
     * a point for it.
     *
     * HOLY SHIELD WAS THE FIRST and was fixed by declaring `valueless`, which
     * routes a proc past the lookup. That is not available here: `abilityDamage`
     * genuinely needs the 10%. So the number is hand-filled in the values file
     * with a `note` -- the documented exception for exactly this case, and the
     * eighth entry to use it.
     */
    /*
     * BOTH CLAUSES, AND THE SECOND ONE COSTS NOTHING TO HONOUR. "Causes Holy
     * Strike to refresh all Judgement effects on the target" -- the only judgement
     * with a duration is the Crusader's, and that spell's own tooltip says "your
     * melee strikes will refresh the spell's duration". Holy Strike is a melee
     * strike, so `judgementOfTheCrusaderRefresh` already covers it and this clause
     * asks for nothing the spell does not do by itself.
     *
     * ITS REASON SAID THE CRUSADER'S JUDGEMENT WAS "itself tracked and inert",
     * which was true and is not: the debuff grants 161 Holy spell power now. So
     * the clause went from redundant-and-worthless to redundant-and-already-done.
     */
    { kind: 'abilityDamage', abilityId: 'holy_strike' },
  ],

  /*
   * CRUSADE IS GONE, removed from the Retribution tree at client build
   * 1.60.1.70170 and named nowhere in the patch notes. It was +1/2% damage to
   * everything, doubled against Demons and Undead -- a blanket multiplier the
   * Retribution and Shockadin builds both spent two points on, and one of the
   * three `conditionalDamage` effects CLAUDE.md lists as using `requires: {}`.
   *
   * IT WAS ALSO ONE OF THE THREE EFFECTS THE VALUE-INDEX AUDIT FLAGGED as
   * sitting on a multi-number row without naming an index -- `[[1, 1], [2, 2]]`
   * -- and right by inspection rather than by declaration. The audit's point
   * stands for the other two.
   */

  two_handed_weapon_specialization: [
    /*
     * REWORKED AT 1.60.1.70707: "Increases the physical damage you deal by {0}%,
     * and reduces all threat you generate by {1}% while a two-handed melee weapon
     * is equipped." The damage is no longer gated on the weapon -- it is every
     * point of PHYSICAL damage whatever is in the Paladin's hand -- and the
     * weapon condition moved onto the threat, which is Instrument of Law's
     * clause arriving here with that talent's removal.
     */
    { kind: 'schoolDamage', schools: ['physical'], valueIndex: 0 },
    { kind: 'threat', direction: 'decrease', valueIndex: 1, requires: { twoHanded: true } },
  ],

  vengeance: [{ kind: 'reaction', reactionId: 'vengeance' }],

  repentance: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'An incapacitate, and only against Humanoids.' },
  ],

  champion_of_the_light: [
    /*
     * "Increases your spell damage by up to {0}% of your Intellect, and reduces
     * the cast time of your Hammer of Wrath by {1} sec" -- five ranks since
     * 1.60.1.70707, the same 60% at the last, and Instrument of Law's cast time
     * arriving with that talent's removal: 0.2 a rank, the whole second at 5/5.
     *
     * AT 5/5 HAMMER OF WRATH IS INSTANT, and an instant Hammer of Wrath is a
     * RANGED attack that still scales with SPELL POWER, on the owner's ruling --
     * derived from the cast time; see `HAMMER_OF_WRATH`.
     *
     * THE ONE PLACE IN THE PROJECT WHERE SPELL POWER REACHES A MELEE BUILD THIS
     * MUCH: the seals scale with it.
     */
    { kind: 'statFromStat', from: 'intellect', to: 'spellPower', valueIndex: 0 },
    { kind: 'abilityCastTime', abilityId: 'hammer_of_wrath', valueIndex: 1 },
  ],

  turn_evil: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: `Turn Undead's cast and cooldown, a fear. ${NOT_UNDEAD}` },
  ],


  unsealed_wrath: [
    /*
     * TWIST OF LIGHT RENAMED AND REWORKED (1.60.1.70707): the Retribution
     * capstone, which stores copies of the active seal on every melee attack
     * and spends them on an attack under a different one. All of it is the
     * reaction -- see `unsealedWrathProc`. Twist of Light's 20% off every seal's
     * mana went with the old talent.
     */
    { kind: 'reaction', reactionId: 'unsealed_wrath', valueless: true },
  ],
};
