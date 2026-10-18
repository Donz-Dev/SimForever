import type { TalentEffects } from './TalentEffect';
import {
  CONFLAGRATE_KEEPS_IMMOLATE,
  SHADOWBURN_REFUNDS_SHARD,
  WARLOCK_AFFLICTION_PERIODICS,
  WARLOCK_DESTRUCTION_SPELLS,
  WRACK_SOUL_SIPHON_CAP,
  WRACK_SOUL_SIPHON_PER_EFFECT,
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

/**
 * Said once; the demon talents for the two demons that cannot be summoned here.
 *
 * THE IMP AND THE SUCCUBUS FIGHT NOW -- `createDemon`, chosen per profile -- so
 * this reason no longer covers them. What is left is the Voidwalker and the
 * Felhunter, and talents about summoning and health.
 */
const NO_DEMON =
  'It affects a demon this simulator does not summon -- the Voidwalker or the ' +
  'Felhunter, for which no fighting numbers have been given -- or the act of ' +
  'summoning, which happens before the pull. Inert because of the BUILD rather ' +
  'than the engine: only the Imp and the Succubus can be out.';

/**
 * Said once; two talents say it.
 *
 * THE ENCOUNTER, NOT THE ENGINE. `targetAttacks` is a profile field and both
 * Warlock presets set it false, so nothing ever interrupts one. A Warlock
 * profile that took damage would make these live -- which is the same shape as
 * the pet talents below and is not an engine gap.
 */
const NO_PUSHBACK =
  'Avoiding interruption from damage while casting. Nothing attacks either ' +
  'Warlock profile -- `encounter.targetAttacks` is false for both -- so there ' +
  'is no interruption to avoid. The ENCOUNTER rather than the engine: a ' +
  'Warlock profile fighting a target that swings back would make this live.';

/** Said once; three talents say it. */
const NO_THREAT = 'Threat, which the engine does not track.';

export const WARLOCK_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Affliction ----------------------------------------------------------

  // Read by `lifeTapMana` in abilities/warlock.ts -- the reader was missing until round 42.
  improved_life_tap: [{ kind: 'abilityBonus', abilityId: 'life_tap', key: 'bonusPercent' }],

  suppression: [
    { kind: 'stat', stat: 'hitChance', operation: 'flat' },
    { kind: 'unmodelled', scope: 'threat', reason: `The hit applies. ${NO_THREAT}` },
  ],

  improved_corruption: [
    { kind: 'abilityCastTime', abilityId: 'corruption' },
    { kind: 'abilityDamage', abilityId: 'corruption', valueIndex: 1 },
  ],

  /*
   * ==========================================================================
   * GRIM REACH REPLACES MALEDICTION, AND IT IS A LIVE TALENT REPLACED BY A
   * RULED-OUT ONE -- which is the opposite of the usual direction here and is
   * worth saying plainly.
   *
   * Malediction raised ALL periodic damage from Warlock spells, named aura by
   * aura, and was real damage on the one build whose core is DoTs. Grim Reach
   * is "Increases the range of your Affliction spells by 20%" -- `positioning`,
   * permanently, with nothing to expire.
   *
   * SO THE SM/DS WARLOCK LOSES A DAMAGE TALENT AND ITS POINTS ARE NOW DEAD
   * WHERE THEY SIT. That is a BUILD question rather than an engine one: five
   * points want moving, and this file is not where that is decided.
   * ==========================================================================
   */
  grim_reach: [
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason: 'Range, and nothing here has a position.',
    },
  ],

  /*
   * RENAMED FROM SOUL HARVESTING at client build 1.60.1.70170, which the patch
   * notes do not mention. The tooltip was reworded with it and its value row
   * REORDERED -- `[10, 50, 50]` became `[50, 10, 50]`, duration and regeneration
   * swapping places -- which is harmless here only because this entry reads no
   * value at all. An effect with a `valueIndex` would have started reading
   * seconds as a percentage, which is the failure CLAUDE.md records four times
   * over on the Druid and once on the Priest.
   */
  soul_harvest: [
    { kind: 'unmodelled', reason: 'Needs a KILL, and the target survives every fight.' },
  ],

  improved_drains: [
    /*
     * "DRAIN LIFE, DRAIN SOUL, AND WRACK", and Wrack is the one of the three
     * this project declares -- which the old `unmodelled` reason SAID, in those
     * words, and had not been acted on. SM/DS spends three points here.
     *
     * IT WAS WORTH EXACTLY ZERO AND IS NOT ANY MORE: Wrack entered the SM/DS
     * list when the owner un-paused it, so this +20% now lands on about 30% of
     * the profile's damage. The test still asserts the resolved MULTIPLIER
     * rather than a DPS delta, because that is what pins the talent -- the
     * whole entry's worth is +5.6 and Improved Drains is a fraction of it.
     *
     * Drain Life and Drain Soul are in the spellbook capture and declared
     * nowhere; `WoWSimWorksheet.xlsx` has no coefficient row for either, so a
     * declaration needs the ruleset owner and belongs to the SPELL list rather
     * than to this talent.
     */
    { kind: 'abilityDamage', abilityId: 'wrack' },
  ],

  improved_bane_of_agony: [{ kind: 'abilityDamage', abilityId: 'bane_of_agony' }],

  fel_concentration: [{ kind: 'unmodelled', scope: 'castPushback', reason: NO_PUSHBACK }],

  amplify_curse: [
    /*
     * ------------------------------------------------------------------------
     * DECLARED NOW, AND IT NEVER NEEDED THE MECHANISM IT WAS WAITING FOR.
     *
     * Its reason said this wanted "a one-shot per-ability DAMAGE modifier",
     * because `CastModifier` carries cast time and cost and not damage. That
     * was the wrong shape: the 50% applies to Bane of Agony's TICKS, which land
     * over twenty-four seconds, and a cast modifier is resolved and spent at
     * the cast. So the amplification travels with the AURA instead -- two
     * definitions sharing the id `bane_of_agony`, chosen at application. See
     * `BANE_OF_AGONY_ABILITY`.
     *
     * A REASON THAT NAMES A MISSING MECHANISM CAN BE WRONG ABOUT WHICH ONE, and
     * this one was. It was right that nothing expressed the effect and wrong
     * about what would; the one-shot per-ability CRIT modifier two other
     * classes want is still genuinely missing, and this talent is no longer a
     * caller for its damage twin.
     *
     * THE SM/DS BUILD TAKES IT NOW, at the owner's instruction, with the point
     * moved out of Suppression -- see `WARLOCK_AFFLICTION_TALENTS`.
     * ------------------------------------------------------------------------
     */
    { kind: 'grantAbility', abilityId: 'amplify_curse' },
  ],

  pandemic: [
    /*
     * ------------------------------------------------------------------------
     * "THE CRITICAL STRIKE DAMAGE BONUS OF YOUR CORRUPTION, BANE OF AGONY, BANE
     * OF DOOM, DRAIN SOUL, DRAIN LIFE, SIPHON LIFE, AND WRACK SPELLS BY 100%."
     *
     * A NAMED LIST, WHICH IS THE FOURTH SCOPE AND THE ONE THAT DID NOT EXIST.
     * Its old reason said exactly that and named the field --
     * `critMultiplierBonus` on `AbilityModifiers`, which has existed since
     * Impale with nothing reaching it. `abilityCritDamage` is the declaration
     * that reaches it, and the Rogue's Lethality wanted the identical one.
     *
     * AN AURA ID IS AN ABILITY ID HERE, which is why this works at all: a
     * periodic tick carries its AURA's id, and `rollPeriodicCrit` applies the
     * same modifier a cast gets. Malediction takes the same route for periodic
     * DAMAGE two entries above.
     *
     * `table: 'spell'` BECAUSE THE HALF DEPENDS ON IT. A spell crit multiplies
     * by 1.5, so +100% takes it to 2.0x; reading the melee figure would take it
     * to 3.0x, which is a plausible number and twice the talent.
     *
     * SM/DS SPENDS THREE POINTS HERE and 48% of its damage is these effects.
     *
     * FIVE OF THE SEVEN SPELLS IT NAMES EXIST, and it reaches every one that is
     * in the profile's own book -- which is the standard Twin Disciplines set on
     * the Priest: a talent naming spells one by one is fully modelled when it
     * reaches the build's, and the ones missing belong to the SPELL list rather
     * than to this talent. Drain Soul and Drain Life are in the spellbook
     * capture and declared nowhere in this project. (Bane of Doom joined the
     * list when the owner gave its figures.)
     * ------------------------------------------------------------------------
     */
    {
      kind: 'abilityCritDamage',
      abilityIds: WARLOCK_AFFLICTION_PERIODICS,
      table: 'spell',
    },
    { kind: 'abilityCritDamage', abilityIds: ['wrack'], table: 'spell' },
  ],

  malevolence: [{ kind: 'schoolCrit', schools: ['shadow'] }],

  nightfall: [{ kind: 'reaction', reactionId: 'nightfall' }],

  curse_of_exhaustion: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Movement speed, and nothing here moves.' }],

  siphon_life: [{ kind: 'grantAbility', abilityId: 'siphon_life' }],

  soul_siphon: [
    /*
     * "+{0}% PER EACH OF YOUR OTHER AFFLICTION EFFECTS ACTIVE ON THE TARGET, UP
     * TO {1}%", so its size is read at cast time rather than being a standing
     * modifier -- which is what `abilityBonus` is for. Wrack's `onCast` counts
     * `WARLOCK_AFFLICTION_PERIODICS` and applies the smaller of the two.
     *
     * WHICH EFFECTS COUNT IS THE OWNER'S RULING NOW, AND IT INCLUDES A RAID
     * DEBUFF: "corruption, curse of the elements, and bane of agony are the 3
     * affliction effects needed to max out the 36% damage buff to wrack."
     * Curse of the Elements arrives from the preset raid buffs and sits on the
     * target for the hour, so in practice it is always one of the three.
     *
     * `WARLOCK_SOUL_SIPHON_EFFECTS` IS A SEPARATE LIST FROM PANDEMIC'S, and
     * conflating them was the trap worth avoiding: Curse of the Elements is not
     * periodic and Pandemic does not name it, so putting it in the shared list
     * would have handed a crit damage bonus to a raid debuff.
     *
     * Same as Improved Drains above, this reaches only Wrack -- and the SM/DS
     * list casts Wrack now, so it is live rather than merely correct. The gate
     * the owner put on that entry is what keeps the cap reachable: Wrack only
     * fires while all three bleeds have six seconds left, which is exactly the
     * state in which all three are counted here.
     */
    { kind: 'abilityBonus', abilityId: 'wrack', key: WRACK_SOUL_SIPHON_PER_EFFECT },
    { kind: 'abilityBonus', abilityId: 'wrack', key: WRACK_SOUL_SIPHON_CAP, valueIndex: 1 },
  ],

  shadow_mastery: [{ kind: 'schoolDamage', schools: ['shadow'] }],

  /*
   * DECLARED NOW, because the ruleset owner put it in the SM/DS list -- and
   * the arithmetic the old reason gave is unchanged and still says it cannot
   * be worth casting. Both of the reasons why are on the ability: it carries
   * no spell power coefficient because the sheet has no Wrack row, and its
   * +10% to other Shadow DoTs has no form the engine can express without also
   * raising Shadow Bolt. Neither is a rotation decision.
   */
  wrack: [{ kind: 'grantAbility', abilityId: 'wrack' }],

  // --- Demonology ----------------------------------------------------------

  improved_health_funnel: [{ kind: 'unmodelled', reason: NO_DEMON }],
  /*
   * "Increases the damage of your Imp's Firebolt spell by {0}%" -- 30% at 3/3,
   * a multiplier of 1.3 on the Imp's own Firebolt and nothing else.
   */
  improved_imp: [
    { kind: 'petAbilityDamage', abilityId: 'imp_firebolt', valueIndex: 0 },
    {
      kind: 'unmodelled',
      reason:
        'Its Fire Shield clause damages whatever hits the shielded target, and ' +
        'nothing here attacks a Warlock or its demon.',
    },
  ],

  demonic_embrace: [{ kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 }],

  // "Increases all damage done by your ... pets by {0}%" -- 1.1x at 5/5.
  unholy_power: [{ kind: 'petStat', property: 'damage' }],

  demonic_aegis: [
    /*
     * BOTH PROFILES SPEND TWO POINTS HERE and it is worth nothing to either,
     * for two independent reasons -- which is why it stays inert even after the
     * first one is cleared. Worth saying both, because clearing one and
     * expecting a number to move is how an afternoon goes missing.
     */
    {
      kind: 'unmodelled',
      reason:
        'Demon Skin and Demon Armor are not declared abilities here, and ' +
        'neither would be worth a cast if they were: between them they give ' +
        'armor, Shadow resistance and health per 5 sec, and nothing attacks ' +
        'either Warlock profile -- `encounter.targetAttacks` is false for ' +
        'both. Two independent reasons, so declaring the spells alone would ' +
        'move nothing. Both profiles spend two points here as a route to the ' +
        'tier that holds Demonic Sacrifice.',
    },
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
  /*
   * "Increases the effect of your Succubus' ... Lash of Pain ... by {0}%" --
   * 1.3x at 3/3 on Lash of Pain. Soothing Kiss is not a damage ability.
   */
  improved_sayaad: [
    { kind: 'petAbilityDamage', abilityId: 'lash_of_pain', valueIndex: 0 },
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason:
        'Seduction and Lesser Invisibility duration: control and stealth, and ' +
        'neither ability is declared.',
    },
  ],

  demonic_sacrifice: [{ kind: 'grantAura', auraId: 'demonic_sacrifice' }],

  master_summoner: [
    { kind: 'unmodelled', reason: 'Summoning cost and cast time, and the demon is sacrificed.' },
  ],

  decimation: [
    /*
     * ------------------------------------------------------------------------
     * ITS REASON BLAMED THE TARGET AND WAS WRONG TO, which is the mistake this
     * project has documented FOUR times now. "Below 35% health" is the CLOCK by
     * the owner's ruling -- `combat/executePhase.ts`, the rule Execute runs on
     * at 20% and the Rogue's Quietus at exactly this 35% -- so the health gate
     * is not what blocks it and never was.
     *
     * WHAT ACTUALLY BLOCKS IT IS SOUL FIRE, which three of its four clauses are
     * about and which this project does not declare. The fourth clause, the
     * +6% damage inside the window, is the same conditional-on-the-clock
     * per-ability modifier Quietus and Early Demise want -- so this is the
     * THIRD caller for that one mechanism.
     *
     * The Demonology profile takes it at 2/2.
     * ------------------------------------------------------------------------
     */
    /*
     * ------------------------------------------------------------------------
     * BUILT ON THE OWNER'S READING, which is wider than the client tooltip.
     *
     * The owner: "it reduces Soul Fire's cooldown to 6 seconds and cast time by
     * 40%. If Bane rank 5 is taken with Decimation the new Soul Fire cast time
     * is 2.4 seconds and no longer consumes soul shards. Decimation also
     * separately buffs Shadow Bolt + Searing Pain by 6% if the combat duration
     * is <35%." The client ties the cast-time and shard clauses to a 10 second
     * window after a Shadow Bolt or Searing Pain below 35%; the owner states
     * them as standing effects, and their figures are what is built. Recorded
     * in HANDOVER as the reading taken.
     *
     *   cooldown   -90% of 60s, {0}                          -> 6s
     *   cast time  -40%, {4}, AFTER Bane's flat 2 seconds    -> (6 - 2) x 0.6 = 2.4s
     *   shards     none, the whole cost                       -> a fixed fraction of 1
     *   damage     +6%, {2}, on Shadow Bolt and Searing Pain in the last 35%, {1}
     * ------------------------------------------------------------------------
     */
    /*
     * ROUND 44: THE CAST-TIME AND SHARD HALVES ARE A 10-SECOND BUFF NOW, not
     * standing cast modifiers -- the owner saw Decimation at 100% uptime and
     * ruled its maximum is 35%. Shadow Bolt or Searing Pain inside the last
     * 35% opens it; `decimationAura` and the `decimation` cast reaction. The
     * cooldown cut stays standing, as its clause is unconditional.
     */
    { kind: 'abilityCooldown', abilityId: 'soul_fire', unit: 'percent', valueIndex: 0 },
    { kind: 'castReaction', reactionId: 'decimation', valueIndex: 4 },
    {
      kind: 'abilityDamageInFinalFraction',
      abilityId: 'shadow_bolt',
      fractionIndex: 1,
      valueIndex: 2,
    },
    {
      kind: 'abilityDamageInFinalFraction',
      abilityId: 'searing_pain',
      fractionIndex: 1,
      valueIndex: 2,
    },
  ],

  fel_domination: [{ kind: 'unmodelled', reason: 'Summoning, and the demon is sacrificed.' }],
  /*
   * Searing Pain brands the target with {2} charges; each of the DEMON's landed
   * attacks spends one for 65-68 more Fire (Imp) or Shadow (anything else).
   * Two halves, two combatants: the brand is the Warlock's reaction and the
   * extra hit is the demon's.
   */
  demonic_brand: [
    { kind: 'reaction', reactionId: 'demonic_brand', valueIndex: 2 },
    { kind: 'petReaction', reactionId: 'demonic_brand_strike', valueIndex: 3 },
    { kind: 'unmodelled', scope: 'threat', reason: NO_THREAT },
  ],
  improved_felhunter: [{ kind: 'unmodelled', reason: NO_DEMON }],
  /*
   * "Both the Demon and the master will inflict 3% more damage" while the demon
   * is out. The 3 is hand-filled in `values/warlock.json`: a single-rank
   * talent's row comes back null, and an effect that reads no value is dropped.
   */
  soul_link: [
    { kind: 'conditionalDamage', requires: { hasPet: true } },
    { kind: 'petDamageFactor' },
    {
      kind: 'unmodelled',
      reason:
        'Its 30% of damage taken moved to the demon: nothing attacks a ' +
        'Warlock here, so there is nothing to move.',
    },
  ],
  /*
   * "Up to {0}% of your level" in spell damage, to the Warlock AND the demon,
   * while a demon is out -- 60 at 3/3 and level 60.
   */
  demonic_knowledge: [
    { kind: 'statFromLevel', to: 'spellPower', requires: { hasPet: true } },
    { kind: 'petSpellPowerFromLevel' },
  ],
  /*
   * "Grants both the Warlock and the summoned demon an effect as long as that
   * demon is active" -- Imp {0}% Fire damage, Succubus {2}% Shadow damage.
   */
  master_demonologist: [
    { kind: 'schoolDamage', schools: ['fire'], valueIndex: 0, requires: { summonedDemon: 'imp' } },
    {
      kind: 'schoolDamage',
      schools: ['shadow'],
      valueIndex: 2,
      requires: { summonedDemon: 'succubus' },
    },
    {
      kind: 'petSchoolDamage',
      schools: ['fire'],
      valueIndex: 0,
      requires: { summonedDemon: 'imp' },
    },
    {
      kind: 'petSchoolDamage',
      schools: ['shadow'],
      valueIndex: 2,
      requires: { summonedDemon: 'succubus' },
    },
    {
      kind: 'unmodelled',
      reason:
        'The Voidwalker and Felhunter halves reduce damage taken, and neither ' +
        'demon can be summoned here.',
    },
  ],

  /*
   * "Your Demonic Sacrifice effect is no longer cancelled by summoning a
   * different Demon pet." Applied by the ENCOUNTER, beside Demonic Sacrifice
   * itself -- see `sacrificedDemon` -- which is why this names an aura the
   * talent registry does not carry, as Demonic Sacrifice already does.
   */
  demonic_pact: [{ kind: 'grantAura', auraId: 'demonic_pact' }],

  // --- Destruction ---------------------------------------------------------

  destructive_reach: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Range, and nothing here has a position.' }],

  improved_shadow_bolt: [{ kind: 'reaction', reactionId: 'improved_shadow_bolt' }],

  bane: [
    { kind: 'abilityCastTime', abilityId: 'shadow_bolt' },
    { kind: 'abilityCastTime', abilityId: 'immolate' },
    { kind: 'abilityCastTime', abilityId: 'incinerate' },
    // "...and your Soul Fire spell by {1} sec" -- the SECOND number, which is
    // the larger one; reading index 0 would take Soul Fire's off at Shadow
    // Bolt's rate.
    { kind: 'abilityCastTime', abilityId: 'soul_fire', valueIndex: 1 },
  ],

  molten_skin: [
    {
      kind: 'unmodelled',
      reason:
        'Reduces all damage taken, and nothing attacks either Warlock ' +
        'profile -- `encounter.targetAttacks` is false for both. The ' +
        'ENCOUNTER rather than the engine: `damageTakenMultiplier` on an aura ' +
        'expresses this exactly, and a Warlock fighting a target that swings ' +
        'back would make it live with no new capability. Neither profile ' +
        'spends a point here.',
    },
  ],

  cataclysm: [
    {
      kind: 'grantCastModifier',
      abilityIds: ['immolate', 'incinerate', 'conflagrate', 'searing_pain'],
      property: 'costFraction',
    },
  ],

  aftermath: [
    /*
     * ========================================================================
     * `valueIndex` WAS 2 AND IS 0, WHICH IS THE WRONG-INDEX BUG CLAUDE.md
     * NAMED BY NAME BEFORE IT COULD BITE: "The Warlock's Aftermath has the
     * same mistake and escapes it only because at 5/5 the two numbers
     * coincide."
     *
     * The row is "Increases the initial damage of your Immolate spell by {0}%
     * and your Conflagrate spell has a {1}% chance to Daze the target,
     * reducing the target's movement speed by {2}% for {3} sec", and the four
     * numbers by rank are:
     *
     *     rank   1              2              3              4              5
     *     {0}    10             20             30             40             50   <- Immolate
     *     {1}    20             40             60             80            100   <- daze chance
     *     {2}    50             50             50             50             50   <- MOVEMENT SPEED
     *     {3}     5              5              5              5              5   <- seconds
     *
     * SO INDEX 2 IS A MOVEMENT SPEED, CONSTANT AT EVERY RANK, and it read 50
     * where the talent grants 50 only at 5/5 -- which is the rank every
     * Warlock preset happened to carry. **It was correct by coincidence.**
     *
     * WHAT MADE IT LIVE IS A TALENT CHANGE, NOT A CODE CHANGE. The owner's
     * respecification takes Firelock to 2/5, where the correct figure is 20
     * and index 2 still reads 50 -- Immolate would have collected **two and a
     * half times the talent**, on the profile's second-largest damage source,
     * with nothing anywhere reading wrong. That is this project's own
     * description of the failure: "the plausible wrong value is usually
     * another rank's right one".
     *
     * THE COMMENT HERE RESTATED THE WRONG INDEX IN ITS OWN WORDS ("by {2}%"),
     * which is the second half of the Rip lesson -- a wrong reading survives
     * in the prose beside it, so the figure that would expose it is wrong in
     * the same sentence that asserts it.
     * ========================================================================
     */
    { kind: 'abilityDamage', abilityId: 'immolate', valueIndex: 0 },
    {
      kind: 'unmodelled',
      reason:
        'It raises Immolate INITIAL damage only, and the initial hit and its ' +
        'burn share one ability id -- so the burn is raised too. Generous, and ' +
        'the burn is the larger half.',
    },
  ],

  ruin: [
    /*
     * ------------------------------------------------------------------------
     * "THE CRITICAL STRIKE DAMAGE BONUS OF YOUR DESTRUCTION SPELLS BY 100%",
     * and a TREE is not a school. This was `schoolCritDamage` over Fire and
     * Shadow -- the two schools a Warlock has, which is every spell it owns --
     * so it also doubled the crit damage of Corruption, Bane of Agony, Siphon
     * Life and Wrack. Corruption is 13.5% of the Firelock profile's damage and
     * Firelock takes this 5/5.
     *
     * `WARLOCK_DESTRUCTION_SPELLS` IS THE SOURCE'S OWN TAB, which matters most
     * for SHADOW BOLT: it is a Destruction spell in the spellbook capture, and
     * it is the entry a reader would get wrong from the school alone.
     *
     * IT REACHES EVERY DESTRUCTION SPELL THIS PROJECT DECLARES. Soul Fire, Rain
     * of Fire, Hellfire and Bane of Havoc are in the tab and declared nowhere --
     * the three area effects need a second target to be worth declaring at all.
     * That is the SPELL list's business, not this talent's.
     * ------------------------------------------------------------------------
     */
    {
      kind: 'abilityCritDamage',
      abilityIds: WARLOCK_DESTRUCTION_SPELLS,
      table: 'spell',
    },
  ],

  shadowburn: [{ kind: 'grantAbility', abilityId: 'shadowburn' }],

  intensity: [{ kind: 'unmodelled', scope: 'castPushback', reason: NO_PUSHBACK }],

  agonizing_flames: [
    { kind: 'abilityCrit', abilityId: 'searing_pain' },
    /*
     * "AND THE DAMAGE DONE BY ALL YOUR DESTRUCTION SPELLS BY {1}%". The same
     * correction Ruin above needed, for the same reason and in the same words:
     * this read "which for this class is Fire and Shadow -- the two schools it
     * has", and those two schools are also every Affliction spell it owns.
     *
     * ONE ENTRY PER ABILITY, and they MULTIPLY with each other exactly as the
     * school modifier they replace did -- `combineAbilityModifiers` multiplies
     * damage and adds chances, which is the same rule `SchoolModifiers` uses.
     * So a spell under this and Aftermath is under both, unchanged.
     */
    ...WARLOCK_DESTRUCTION_SPELLS.map((abilityId) => ({
      kind: 'abilityDamage' as const,
      abilityId,
      valueIndex: 1,
    })),
  ],

  conflagrate: [{ kind: 'grantAbility', abilityId: 'conflagrate' }],

  pyroclasm: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'A stun, which is out of scope as every stun is.' }],

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
