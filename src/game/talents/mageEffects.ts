import type { TalentEffects } from './TalentEffect';
import { ALL_ABILITIES } from '../../engine';
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
 *   FROZEN TARGETS   ONE talent, down from the five this used to claim, and
 *                    the reduction is worth reading. Nothing freezes a raid
 *                    boss, so Frostbite is inert because of the TARGET rather
 *                    than because of the engine -- a different claim and a more
 *                    durable one. But it never covered the other four:
 *                    Fingers of Frost does not freeze anything, it puts a
 *                    state on the MAGE, and Shatter now reads that state, so
 *                    both are modelled. Improved Blizzard and Ice Lance are
 *                    out for their own reasons, neither of them the target.
 *                    THE CLUSTER WAS THE MISTAKE: one reason written across
 *                    five talents outlived its truth on four of them.
 *   PERCENTAGE MANA  Frost Channeling, Burning Soul's cost half. Still the
 *   COSTS            most common unmodelled reason in the project.
 *   THREAT           four. The engine does not track it.
 *   RANGE            three. Nothing here has a position.
 *   PUSHBACK         four -- Improved Channeling, Burning Soul, Ice Barrier,
 *                    Frost Warding. Nothing interrupts a cast here, because
 *                    no Mage profile is attacked.
 * ----------------------------------------------------------------------------
 */

/**
 * Said once; four talents say it.
 *
 * TWO CAUSES AND NOT ONE, which the old wording gave only half of. There is no
 * pushback mechanic in this engine AT ALL -- nothing shortens, delays or
 * interrupts a cast in progress, for any class -- and separately no Mage
 * profile is attacked, because all three set `encounter.targetAttacks: false`.
 * Either alone would make these inert, so clearing one clears nothing.
 */
const NO_PUSHBACK =
  'Avoiding pushback from damage taken while casting. The engine has no ' +
  'pushback at all -- nothing delays or interrupts a cast in progress -- and ' +
  'no Mage profile is attacked either, so both halves would have to change.';

/** Said once; three talents say it. */
const NO_POSITION = 'Range, and nothing here has a position.';

/**
 * Said once; five talents say it.
 *
 * IT IS THE PROFILE, NOT THE ENGINE, and the difference is worth the sentence:
 * `encounter.targetAttacks` exists and brings real incoming damage, a ramp and
 * deaths -- the two Paladin shield builds are told apart by it. All three Mage
 * profiles set it false, because a Mage is not the one being hit. So these
 * expire the day a Mage profile is written that is attacked, which is not a
 * change to anything here.
 */
const NOT_ATTACKED =
  'Nothing attacks the Mage: all three profiles set ' +
  '`encounter.targetAttacks: false`, so there is no incoming damage for this ' +
  'to reduce, absorb or reflect. The encounter CAN hit back -- two Paladin ' +
  'builds use it -- so this is the profile rather than the engine.';

/** Said once; four talents say it. */
const NO_THREAT = 'Threat, which the engine does not track.';

export const MAGE_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Arcane --------------------------------------------------------------

  wand_specialization: [
    {
      kind: 'unmodelled',
      reason:
        'Wand damage. The Mage gear set DOES equip one -- Crimson Shocker, in ' +
        'the ranged slot -- and it never fires: a `caster` combat style has no ' +
        'auto attack at all, so there is no wand shot for this to raise. ' +
        'Reaching it means giving that style a ranged attack, which is a ' +
        'change to every caster in the project rather than to this talent. ' +
        'The Arcane build takes it 2/2 and spends 83% of the mana it gains, ' +
        'so what it would be worth is a real question rather than a rounding ' +
        'error.',
    },
  ],

  /*
   * THE SCHOOL NEVER NEEDED THREADING INTO THE ROLL: `combineModifiers` has
   * folded the school's modifier into the chances all along, and what was
   * missing was a hit FIELD for it to carry. `AbilityModifier.hitBonus` is it.
   * Arcane and Fire both take this 5/5.
   */
  arcane_focus: [{ kind: 'schoolHit', schools: ['arcane'] }],

  improved_channeling: [{ kind: 'unmodelled', scope: 'castPushback', reason: NO_PUSHBACK }],

  arcane_subtlety: [
    {
      kind: 'unmodelled',
      scope: 'threat',
      reason: `Target spell resistance, which has no effect here by ruling, and ${NO_THREAT}`,
    },
  ],

  magic_absorption: [
    {
      kind: 'unmodelled',
      reason:
        'Resistances, and mana back on a FULL resist. ' +
        NOT_ATTACKED +
        ' The resistance ruling does not cover this and is easy to reach for: ' +
        'it says resistance on an ENEMY target does not reduce damage, which ' +
        'is about what the Mage DEALS rather than what it takes.',
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

  arcane_geometry: [{ kind: 'unmodelled', scope: 'positioning', reason: NO_POSITION }],

  arcane_impact: [{ kind: 'schoolCrit', schools: ['arcane'] }],

  /*
   * TWO EFFECTS AGAIN. The ability brings its own escalating aura; the cast
   * reaction is what ends the window, on the last tick of the spell that
   * collected the bonus. See `arcaneBlastSpender` for why that reading and not
   * the literal one.
   */
  arcane_blast: [
    { kind: 'grantAbility', abilityId: 'arcane_blast' },
    { kind: 'castReaction', reactionId: 'arcane_blast' },
  ],

  arcane_shielding: [
    {
      kind: 'unmodelled',
      reason:
        'Mana lost per point of damage taken under Mana Shield, and the ' +
        'resistances Mage Armor grants. MAGE ARMOR IS CAST -- it is the first ' +
        'entry of all three lists -- so the second clause is not missing a ' +
        'spell, it is resistance with nothing to resist. ' +
        NOT_ATTACKED,
    },
  ],

  improved_counterspell: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'A silence, and nothing the target does is a cast.' },
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

  flame_throwing: [{ kind: 'unmodelled', scope: 'positioning', reason: NO_POSITION }],

  impact: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'A stun, which is out of scope as every stun is.' }],

  burning_soul: [{ kind: 'unmodelled', scope: 'threat', reason: `${NO_PUSHBACK} ${NO_THREAT}` }],

  improved_flamestrike: [
    {
      kind: 'unmodelled',
      reason:
        'The critical strike chance of Flamestrike, which IS captured in the ' +
        'spellbook and is not declared. Which spells get a declaration is an ' +
        'open question for the ruleset owner -- 478 captured against 113 ' +
        'declared -- and this class three area spells are named in that ' +
        'proposal. No Mage profile takes this talent.',
    },
  ],

  pyroblast: [{ kind: 'grantAbility', abilityId: 'pyroblast' }],

  improved_scorch: [{ kind: 'reaction', reactionId: 'improved_scorch' }],

  improved_fire_ward: [
    {
      kind: 'unmodelled',
      reason:
        'A chance for Fire Ward to REFLECT Fire spells. Fire Ward is not ' +
        'declared, and it would absorb nothing if it were. ' +
        NOT_ATTACKED,
    },
  ],

  hot_streak: [{ kind: 'reaction', reactionId: 'hot_streak' }],

  master_of_elements: [{ kind: 'reaction', reactionId: 'master_of_elements' }],

  critical_mass: [{ kind: 'schoolCrit', schools: ['fire'] }],

  blast_wave: [{ kind: 'grantAbility', abilityId: 'blast_wave' }],

  fire_power: [{ kind: 'schoolDamage', schools: ['fire'] }],

  /*
   * TWO EFFECTS, because the ability only switches the aura on. The reaction is
   * what makes it a ramp with an end: a stack per Fire spell hit, and the aura
   * gone after four non-periodic Fire crits. Its value is the 10, hand-filled
   * in the values file per that directory's README -- a single-rank talent has
   * no variable the calculator can identify, and an effect that reads no value
   * is DROPPED rather than reported.
   */
  combustion: [
    { kind: 'grantAbility', abilityId: 'combustion' },
    { kind: 'reaction', reactionId: 'combustion' },
  ],

  // --- Frost ---------------------------------------------------------------

  frost_warding: [
    {
      kind: 'unmodelled',
      reason:
        'Armor and resistance on Frost Armor and Ice Armor, and a reflect ' +
        'chance on Frost Ward. None of the three is declared -- a Mage here ' +
        'casts Mage Armor, and only one Armor spell may be active at a time. ' +
        NOT_ATTACKED,
    },
  ],

  improved_frostbolt: [{ kind: 'abilityCastTime', abilityId: 'frostbolt' }],

  /*
   * TWO SCHOOLS IN ONE ROW, which is what `schools` is a list for -- Frostfire
   * takes it 5/5 and Fire takes it 2/5, and the same entry serves both.
   */
  elemental_precision: [{ kind: 'schoolHit', schools: ['frost', 'fire'] }],

  ice_shards: [{ kind: 'schoolCritDamage', schools: ['frost'] }],

  permafrost: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Chill duration and movement speed.' }],

  improved_frost_nova: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Frost Nova is a root and is not in the book.' },
  ],

  frostbite: [{ kind: 'unmodelled', reason: FROZEN_UNMODELLED }],

  piercing_ice: [{ kind: 'schoolDamage', schools: ['frost'] }],

  /*
   * FROSTFIRE BOLT IS A FROST SPELL HERE TOO, and this is the one of the three
   * that `countsAsSchools` could not reach: a cast modifier selects by ABILITY
   * ID, because cost is resolved before any damage request exists. So the id
   * goes in the list by hand -- and the Frostfire profile takes this 3/3 and
   * casts Frostfire Bolt as its filler, so the 15% was missing from the
   * cheapest place it could have been noticed.
   */
  frost_channeling: [
    {
      kind: 'grantCastModifier',
      abilityIds: ['frostbolt', 'frostfire_bolt', 'ice_lance'],
      property: 'costFraction',
    },
    { kind: 'unmodelled', scope: 'threat', reason: `Its mana reduction applies. ${NO_THREAT}` },
  ],

  ice_lance: [{ kind: 'grantAbility', abilityId: 'ice_lance' }],

  /*
   * ITS REASON NAMED THE WRONG CAUSE, and the right one is permanent.
   *
   * "Blizzard is an area spell and is not in the book" says this would work
   * the day Blizzard is declared. It would not: the talent's ONLY effect is
   * "adds a Chill effect to your Blizzard spell. This effect lowers the
   * target's movement speed by 40% for 1.5 sec", and a movement-speed slow is
   * a snare. Permafrost is the same clause on the same tree and is already
   * scoped `crowdControl`; this is that talent's twin and was filed as
   * outstanding work instead.
   *
   * WHAT A CHILL IS WORTH TO A MAGE ELSEWHERE does not reach here. Fingers of
   * Frost procs off a Chill, but it names the spells that chill by id --
   * nothing in this project has movement to slow -- so a Blizzard that existed
   * would have to be added to `CHILL_ABILITY_IDS` by hand. That is a property
   * of the SPELL and not of this talent.
   */
  improved_blizzard: [
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason:
        'A Chill: it lowers the target movement speed and does nothing else. ' +
        'Declaring Blizzard would not reach it, which is what the old reason ' +
        'implied. The same clause as Permafrost, scoped the same way.',
    },
  ],

  arctic_reach: [{ kind: 'unmodelled', scope: 'positioning', reason: NO_POSITION }],

  /*
   * BLOCKED TWICE, AND THE SECOND BLOCKER IS NOW A RULING. Its reason was
   * that nothing attacks the Mage, which is the ENCOUNTER and expires if a
   * profile ever sets `targetAttacks`. Forever's Ice Block also says "you
   * cannot attack, move, or cast spells" for its ten seconds -- an immunity
   * that stops you attacking, which the ruleset owner ruled out of scope on
   * 2026-10-07. A Mage that WAS attacked still could not afford to use it.
   *
   * SO IT IS A DECISION RATHER THAN WORK, and both halves are said: the
   * encounter reason is kept because it is true and specific, and the scope
   * is what stops the talent being counted as a queue item forever.
   */
  ice_block: [
    {
      kind: 'unmodelled',
      scope: 'immunity',
      reason:
        'A survival cooldown that also stops the Mage acting -- "you cannot ' +
        'attack, move, or cast spells" for 10 sec -- so it costs more damage ' +
        `than it could ever save on a damage profile. ${NOT_ATTACKED}`,
    },
  ],

  /*
   * ITS REASON CHANGED THE MOMENT FINGERS OF FROST LANDED, which is the
   * failure this project has been caught by six times: nothing errors, the
   * caveat keeps printing, and it is now describing a different situation.
   *
   * "Nothing freezes a raid boss" was a claim about the TARGET, and those
   * expire only if the encounter changes. This one expired for a different
   * reason: Fingers of Frost does not freeze anything either, it treats the
   * caster's next spells AS THOUGH the target were frozen, which is a state on
   * the Mage. The Frostfire build takes both talents, so the window is real.
   *
   * THE WINDOW IS THE FINGERS OF FROST AURA, and nothing else needs saying:
   * while it is up the target counts as Frozen, and `critWhileAura` adds this
   * talent's 17/33/50 to every spell cast inside it. The two talents never
   * meet -- Shatter names the aura, Fingers of Frost applies it, and neither
   * reads the other's rank.
   *
   * `ALL_ABILITIES` IS "ALL YOUR SPELLS" HERE because every ability in the
   * Mage's book declares `attackTable: 'spell'`, and an auto attack carries no
   * ability id so nothing keyed to one reaches it. The day a Mage gets a
   * non-spell ability -- a wand shot as a declared ability would be one -- this
   * has to name the spells instead.
   *
   * ITS PRICE IS PAID ON THE LAST CHARGE AND NOT BEFORE: `runCast` runs
   * `onCast` BEFORE the cast reactions, so the spell that spends the final
   * stack has already rolled its crit while the aura was still up. Reversing
   * those two would silently rob every window of its last spell.
   */
  shatter: [{ kind: 'critWhileAura', auraId: 'fingers_of_frost', abilityId: ALL_ABILITIES }],

  improved_cone_of_cold: [
    {
      kind: 'unmodelled',
      reason:
        'The damage of Cone of Cold, which IS captured -- 328 to 358 Frost, ' +
        '555 mana, instant, 10 second cooldown -- and is not declared. It is ' +
        'the one Mage area spell that would also be a real single-target ' +
        'instant, so it is the strongest candidate in the spell exclusion ' +
        'proposal. No Mage profile takes this talent.',
    },
  ],

  /*
   * ITS OLD REASON CONTRADICTED ITSELF IN ONE SENTENCE -- "the only Frost
   * spell here with one is Ice Lance, which has none" -- which is what a
   * reason looks like after it is edited rather than re-read. The fact behind
   * it was right: no declared Frost spell has a cooldown.
   */
  cold_snap: [
    {
      kind: 'unmodelled',
      reason:
        'Finishes the cooldown on your other Frost spells, and no declared ' +
        'Frost spell has one -- Frostbolt, Frostfire Bolt and Ice Lance are ' +
        'off cooldown always. The captured Frost spells that DO have one, ' +
        'Cone of Cold at 10s, Frost Nova at 25s, Ice Barrier and Frost Ward ' +
        'at 30s, are not declared; and even with them this is a ten-MINUTE ' +
        'cooldown resetting seconds. No Mage profile takes it.',
    },
  ],

  /*
   * THE FROZEN TALENT THAT WAS NEVER INERT, and it never should have carried
   * `FROZEN_UNMODELLED`. That reason is a claim about the TARGET -- nothing
   * freezes a raid boss -- and this talent does not freeze anything. It puts a
   * state on the MAGE that makes its next spells behave as though the target
   * were frozen, which is reachable exactly as written.
   *
   * SHATTER NOW READS THIS AURA BY ID, which is the one thing to know before
   * touching it: `critWhileAura` names `'fingers_of_frost'` as a string, so
   * renaming the aura would leave Shatter pointing at nothing and paying
   * nothing, without a compile error. `mageAbilities.test.ts` asserts the link
   * rather than the two ids separately, so that rename fails a test.
   *
   * TWO EFFECTS FOR ONE TALENT: the proc that applies the charges, and the
   * cast reaction that spends them. `valueIndex: 1` is the CHARGE COUNT, which
   * is the number the rank scales -- the chance is 15 at both ranks and lives
   * as a checked constant beside the aura.
   */
  fingers_of_frost: [
    { kind: 'reaction', reactionId: 'fingers_of_frost', valueIndex: 1 },
    { kind: 'castReaction', reactionId: 'fingers_of_frost', valueIndex: 1 },
  ],

  /*
   * THE LAST MAGE TALENT WITH NO DECLARATION AT ALL, and its reason named the
   * two things that were missing rather than describing the effect: crit from
   * a debuff the TARGET carries, for two NAMED spells. `abilityCrit` is
   * registered on the caster and an ordinary aura reaches every ability or
   * none, so both halves were true.
   *
   * `attackerAbilityModifiers` IS THE FIELD, and it is the mirror of the
   * `critWhileAura` that Shatter needed one PR earlier -- the same shape on
   * the other side of the attack. Read through
   * `Combatant.abilityModifierAgainst`, at both of the two points the
   * attacker's own modifiers are read.
   *
   * ITS CHANCE IS INDEX 0 and its STACK CAP IS INDEX 3, and the rank moves
   * both, which nothing else in this tree does. The reaction takes the whole
   * row for that reason.
   */
  winter_s_chill: [{ kind: 'reaction', reactionId: 'winter_s_chill' }],

  ice_barrier: [
    { kind: 'unmodelled', reason: `An absorb -- ${NOT_ATTACKED} And ${NO_PUSHBACK}` },
  ],
};
