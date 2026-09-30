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
     * WORTH EXACTLY ZERO AND WORKING, because no list casts Wrack. A talent
     * working and a talent mattering are different questions, and the test for
     * this asserts the resolved multiplier rather than a DPS delta.
     *
     * Drain Life and Drain Soul are in the spellbook capture and declared
     * nowhere; `WoWSimWorksheet.xlsx` has no coefficient row for either, so a
     * declaration needs the ruleset owner and belongs to the SPELL list rather
     * than to this talent.
     */
    { kind: 'abilityDamage', abilityId: 'wrack' },
  ],

  improved_bane_of_agony: [{ kind: 'abilityDamage', abilityId: 'bane_of_agony' }],

  fel_concentration: [{ kind: 'unmodelled', reason: NO_PUSHBACK }],

  amplify_curse: [
    /*
     * A ONE-SHOT PER-ABILITY DAMAGE MODIFIER, and it is the THIRD talent to
     * want one field on `CastModifier` that is not there. Two Paladin and
     * Priest talents want a one-shot CRIT; this one wants damage. Neither
     * profile spends a point here, so building it moves nothing -- which makes
     * it the cheap one to build alongside whichever of the other two goes
     * first.
     */
    {
      kind: 'unmodelled',
      reason:
        'Raises the effect of the NEXT Curse of Weakness or Bane of Agony by ' +
        '50%. `CastModifier` carries cast time and cost and not damage, so a ' +
        'one-shot per-ability DAMAGE modifier is the missing field -- the same ' +
        'shape as the one-shot CRIT modifier two other classes want. Neither ' +
        'Warlock profile takes it, and of the spells it names only Bane of ' +
        'Agony is declared.',
    },
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
     * WHICH EFFECTS COUNT IS AN INTERPRETATION AND IT IS BOUNDED BY THE BOOK:
     * the three declared Affliction periodics are Corruption, Bane of Agony and
     * Siphon Life, so a fully-loaded target counts three and reaches the 36%
     * cap exactly. Bane of Doom, Drain Life and Drain Soul would each add
     * another 12% and none is declared, so the bonus is UNDERSTATED rather than
     * absent -- which, at the cap, it currently is not.
     *
     * Same as Improved Drains above, this reaches only Wrack and no list casts
     * Wrack, so it is worth zero and working.
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

  intensity: [{ kind: 'unmodelled', reason: NO_PUSHBACK }],

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
