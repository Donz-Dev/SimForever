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

/** Said once; eleven talents say it. */
const NO_DEMON =
  'It affects a summoned demon, and both profiles take Demonic Sacrifice -- ' +
  'which kills the demon for a two-hour buff. Inert because of the BUILD ' +
  'rather than because of the engine, and neither profile spends a point here.';

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

  improved_life_tap: [{ kind: 'abilityBonus', abilityId: 'life_tap', key: 'bonusPercent' }],

  suppression: [
    { kind: 'stat', stat: 'hitChance', operation: 'flat' },
    { kind: 'unmodelled', scope: 'threat', reason: `The hit applies. ${NO_THREAT}` },
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
    /*
     * WRACK COUNTS AS PERIODIC DAMAGE HERE, by the ruleset owner's ruling, and
     * it is the one entry in this list that is NOT an aura id.
     *
     * IT IS A CHANNEL, so its six ticks are CAST ticks and carry no `periodic`
     * flag -- which is exactly what stops Wrack's own debuff amplifying its own
     * ticks, and would equally have stopped a rule keyed on that flag from
     * reaching them. The owner has ruled on the question the engine could not
     * answer from the data: for Malediction, a Wrack tick is periodic damage.
     *
     * `abilityDamage` ON THE ABILITY ID reaches it regardless, because
     * `abilityModifiers` is keyed by id and Wrack deals its damage under its
     * own. So the ruling costs one line and no new rule.
     */
    { kind: 'abilityDamage', abilityId: 'wrack' },
  ],

  soul_harvesting: [
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
     * FOUR OF THE SEVEN SPELLS IT NAMES EXIST, and it reaches every one that is
     * in the profile's own book -- which is the standard Twin Disciplines set on
     * the Priest: a talent naming spells one by one is fully modelled when it
     * reaches the build's, and the ones missing belong to the SPELL list rather
     * than to this talent. Bane of Doom, Drain Soul and Drain Life are in the
     * spellbook capture, are declared nowhere in this project, and
     * `WoWSimWorksheet.xlsx` has no coefficient row for any of them.
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
  improved_imp: [{ kind: 'unmodelled', reason: NO_DEMON }],

  demonic_embrace: [{ kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 }],

  unholy_power: [{ kind: 'unmodelled', reason: NO_DEMON }],

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
  improved_sayaad: [{ kind: 'unmodelled', reason: NO_DEMON }],

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
     * Neither profile takes it.
     * ------------------------------------------------------------------------
     */
    {
      kind: 'unmodelled',
      reason:
        'Three of its four clauses are about SOUL FIRE -- its cooldown, its ' +
        'cast time and its Soul Shard -- and Soul Fire is not a declared ' +
        'ability here. The fourth, +6% damage while the target is below 35% ' +
        'health, is a per-ability damage modifier conditional on the final ' +
        'fraction of the fight: 35% is the CLOCK by the owner ruling, the ' +
        'same one the Rogue Quietus runs on, so the threshold is reachable ' +
        'and the modifier is what is missing. Neither profile takes it.',
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

  destructive_reach: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Range, and nothing here has a position.' }],

  improved_shadow_bolt: [{ kind: 'reaction', reactionId: 'improved_shadow_bolt' }],

  bane: [
    { kind: 'abilityCastTime', abilityId: 'shadow_bolt' },
    { kind: 'abilityCastTime', abilityId: 'immolate' },
    { kind: 'abilityCastTime', abilityId: 'incinerate' },
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
