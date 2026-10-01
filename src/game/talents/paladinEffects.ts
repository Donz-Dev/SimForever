import type { TalentEffects } from './TalentEffect';
import { TWIST_OF_LIGHT_FLAG } from '../abilities/paladin';
import { CONSECRATED_GROUND_FLAG, IMPROVED_SEAL_OF_FURY_FLAG } from '../auras/paladin';

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

  healing_light: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],

  spiritual_focus: [
    {
      kind: 'unmodelled',
      scope: 'healing',
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
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Fear and Disorient duration, and nothing applies either.' },
  ],

  voice_of_truth: [
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason: 'Silence and interrupt immunity, and nothing interrupts a cast here.',
    },
  ],

  reverence: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],

  purifying_power: [
    {
      kind: 'unmodelled',
      reason:
        'Two clauses and two different reasons, NEITHER of them the engine. Its ' +
        'Cleanse and Purify cost reduction reaches two dispels, and nothing in ' +
        'this encounter ever applies anything dispellable -- so they are not ' +
        'declared and would be cast never. Its cooldown reduction reaches ' +
        `Exorcism and Holy Wrath. ${NOT_UNDEAD}`,
    },
  ],

  infusion_of_light: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],

  illumination: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],

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
    {
      kind: 'unmodelled',
      scope: 'healing',
      reason:
        'Its Flash of Light and Holy Light clauses. Two of its three spells are ' +
        'heals and no Paladin profile heals; its Holy Shock clause applies in ' +
        'full, as a guaranteed crit on the next one.',
    },
  ],

  divine_precision: [
    /*
     * "IMPROVES YOUR CHANCE TO HIT WITH HOLY SPELLS BY 12%" at 2/2, which the
     * Shockadin takes.
     *
     * ITS REASON WAS THAT THE TABLE DECIDES HIT BEFORE ANY PER-SCHOOL MODIFIER IS
     * CONSULTED, shared word for word with the Mage's Arcane Focus and Elemental
     * Precision and the Priest's Shadow Focus and Holy Precision. It was not
     * true: `rollTable` folds the school's modifier in before the roll and always
     * has. `AbilityModifier.hitBonus` is the field that was missing, and one line
     * in `talentBuild` reaches it -- five talents for the same line.
     *
     * HOLY ONLY, which for this class is Judgement, Holy Shock, Consecration's
     * ticks and every seal. Holy Strike is dealt as PHYSICAL, so it keeps the
     * melee table's own miss chance -- which is correct: it is a weapon strike
     * that happens to carry Holy damage.
     */
    { kind: 'schoolHit', schools: ['holy'] },
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

  holy_power: [
    { kind: 'abilityCrit', abilityId: 'holy_shock' },
    { kind: 'stat', stat: 'spellCritChance', operation: 'flat', valueIndex: 1 },
  ],

  light_s_vigil: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],

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
    {
      kind: 'unmodelled',
      reason:
        'Both halves reach a blessing no profile casts, and for two different ' +
        'reasons. Blessing of Freedom is immunity to movement impairment, which ' +
        'is positioning; Blessing of Protection stops all physical damage AND ' +
        'all physical attacking for ten seconds, so on a damage profile it is a ' +
        'survival cooldown that costs its own damage. Neither is declared, and ' +
        'whether an immunity that disarms you belongs in scope is a question for ' +
        'the ruleset owner rather than a gap in the engine.',
    },
  ],

  anticipation: [{ kind: 'stat', stat: 'defenseSkill', operation: 'flat' }],

  improved_seal_of_fury: [
    /*
     * ITS REASON WAS ABOUT THE SHIELD AND THE SHIELD IS BUILT NOW: "a shield
     * granted per swing and consumed per hit has no declaration". It has one --
     * `sealOfFuryShield`, granted by a reaction that `reactionsForClass` registers
     * only for a Paladin holding a shield, re-evaluated on every swing because
     * `AuraCollection`'s refresh path re-reads `absorb`.
     *
     * A FLAG RATHER THAN A VALUE, because the mana return is not a flat number:
     * "60 Mana, increased by 15% per level the attacker is above you, up to 45%"
     * needs the two levels, which only the reaction has. So the talent says
     * PRESENT and `improvedSealOfFuryMana` does the arithmetic.
     */
    { kind: 'abilityFlag', abilityId: 'seal_of_fury', key: IMPROVED_SEAL_OF_FURY_FLAG },
  ],

  improved_righteous_fury: [
    {
      kind: 'unmodelled',
      scope: 'threat',
      reason:
        'Damage reduction WHILE RIGHTEOUS FURY IS ACTIVE. Righteous Fury is a ' +
        'threat buff and nothing here tracks threat, so no profile casts it ' +
        'and the condition is never met.',
    },
  ],

  shield_specialization: [
    /*
     * "INCREASES THE AMOUNT OF DAMAGE ABSORBED BY YOUR SHIELD BY 30%" IS BLOCK
     * VALUE, and its reason used to call it "a shield stat nothing reads".
     * `blockValue` is read -- by the damage pipeline, as the flat amount a block
     * removes -- so this is an ordinary percentage stat effect and index 0.
     *
     * AND THE MANA CLAUSE IS A BLOCK REACTION, which the file believed impossible.
     * Index 1 is the CHANCE, 33/66/100; the 6% share and the three second
     * internal cooldown are the same at every rank and live beside the reaction.
     */
    { kind: 'stat', stat: 'blockValue', operation: 'percentAdd', scale: 0.01 },
    { kind: 'reaction', reactionId: 'shield_specialization', valueIndex: 1 },
  ],

  sacred_duty: [
    { kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 },
    /*
     * ITS COOLDOWN CLAUSE NAMES THREE ABILITIES AND ONE OF THEM IS DECLARED.
     * "Divine Shield, Divine Protection, and Templar's Bulwark by 60 sec" at 2/2,
     * and the Protection list casts Templar's Bulwark -- so the reduction is real
     * and index 1 is the seconds. It took 300 to 240, which on a fight this length
     * is the difference between one cast and two.
     */
    { kind: 'abilityCooldown', abilityId: 'templars_bulwark', unit: 'seconds', valueIndex: 1 },
    {
      kind: 'unmodelled',
      reason:
        'The stamina and the Templar\'s Bulwark cooldown apply. Divine Shield and ' +
        'Divine Protection are the other two abilities it shortens and neither is ' +
        'declared: both are damage immunities that stop the Paladin attacking, ' +
        'which is a survival cooldown on a damage profile.',
    },
  ],

  swift_judgement: [{ kind: 'grantAbility', abilityId: 'swift_judgement' }],

  one_handed_weapon_specialization: [
    { kind: 'conditionalDamage', requires: { twoHanded: false } },
  ],

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
  ],

  iron_creed: [
    {
      kind: 'unmodelled',
      scope: 'threat',
      reason: `${NO_THREAT} Its damage-reduction half needs Righteous Fury, which no profile casts.`,
    },
  ],

  holy_shield: [
    /*
     * ITS DAMAGE HALF WAS THE OTHER CASUALTY OF THE SAME WRONG RULE, and it is
     * the Protection profile's missing damage source: 221 Holy for each of four
     * blocks, every ten seconds.
     *
     * ONE ORDERING BUG WAS REAL, unlike the rule. A block's charge used to be
     * spent before the reactions ran, so the FOURTH block of every cast found the
     * aura already gone -- the ability would have been quietly worth three
     * quarters of itself. `dealDamage` spends the charge last now.
     *
     * ITS "+20% additional threat" IS THREAT, permanently out of scope, and
     * nothing else in the tooltip is left.
     */
    { kind: 'grantAbility', abilityId: 'holy_shield' },
    /*
     * VALUELESS, AND IT HAD TO BE SAID. Holy Shield is a single-rank talent, so
     * its values entry is `null` and every effect asking for a number is dropped
     * -- which is what happened to this reaction the first time it was written.
     * The 221 is the ABILITY'S figure, from the spellbook capture, so there is no
     * talent number for it to want.
     */
    { kind: 'reaction', reactionId: 'holy_shield', valueless: true },
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

  conviction: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  vindication: [
    /*
     * ITS CHANCE IS 10%, ON THE RULESET OWNER'S ANSWER, and that is the whole of
     * what was missing. The reason here said the values give the attack power
     * taken, the attack power gained and the duration and no proc rate -- true,
     * and the conclusion was to leave it inert rather than invent one. Asking
     * settled it in one message, which is the lesson the coefficient sheet taught
     * twenty-nine talents at once: check whether a missing number is missing DATA
     * or a missing RULING.
     *
     * INDEX 1 IS THE ATTACK POWER IT GAINS -- the half that does anything. The 200
     * it strips off the target is applied too and reaches nothing, because the
     * training dummy's damage is a flat placeholder that reads no attack power.
     */
    { kind: 'reaction', reactionId: 'vindication', valueIndex: 1 },
    {
      kind: 'unmodelled',
      reason:
        'Its self buff applies in full. The 200 attack power it strips off the ' +
        "target is applied as a debuff and changes no number, because the " +
        'encounter\'s damage is a flat placeholder that reads no attack power -- ' +
        'inert because of the TARGET rather than because of the engine.',
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

  crusade: [
    { kind: 'conditionalDamage', requires: {} },
    { kind: 'unmodelled', reason: `Its extra bonus against Demons and Undead does nothing. ${NOT_UNDEAD}` },
  ],

  two_handed_weapon_specialization: [
    { kind: 'conditionalDamage', requires: { twoHanded: true } },
  ],

  vengeance: [{ kind: 'reaction', reactionId: 'vengeance' }],

  repentance: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'An incapacitate, and only against Humanoids.' },
  ],

  champion_of_the_light: [
    /*
     * "Increases your spell damage and healing by up to {0}% of your
     * Intellect", 100% at 3/3.
     *
     * THE ONE PLACE IN THE PROJECT WHERE SPELL POWER REACHES A MELEE BUILD.
     * The ruleset owner's seal formula has a spell power term worth twice an
     * attack power one, so this is the only stat-from-stat talent that moves
     * a physical-looking profile's damage. Everything else a caster owns
     * reads flat damage with no coefficient.
     */
    { kind: 'statFromStat', from: 'intellect', to: 'spellPower' },
  ],

  instrument_of_law: [
    {
      kind: 'unmodelled',
      scope: 'threat',
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
