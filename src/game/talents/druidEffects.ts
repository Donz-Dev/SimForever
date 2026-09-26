import type { TalentEffects } from './TalentEffect';

/**
 * What each Druid talent does, as data.
 *
 * Every one of the 51 has an entry, and one that cannot be expressed says so
 * rather than being left out. A talent with no entry is indistinguishable from
 * one that silently does nothing — see CLAUDE.md, which now carries that rule
 * because the Rogue shipped with its whole tree inert and nothing said so.
 *
 * ----------------------------------------------------------------------------
 * THREE SPECS SHARE ONE TREE, so a talent inert for one build is live for
 * another and neither statement is about the engine. Thick Hide does nothing
 * for Moonkin and a great deal for Bear; Moonfury is the reverse.
 *
 * WHAT CLUSTERS HERE, and what it tells the next class:
 *
 *   HEALING          eleven talents. The engine HAS a healing pipeline; what
 *                    is missing is any heal to apply it to, because no Druid
 *                    profile is Restoration.
 *   FORM SHIFTING    a form is fixed at creation, like a Warrior's stance, so
 *                    anything paying out ON the shift never fires.
 *   THREAT           unchanged and unchangeable: the engine does not track it.
 *   ONE-SHOT CAST    Eclipse and Nature's Swiftness both shorten the NEXT cast
 *   MODIFIERS        of a named spell. `abilityCastTime` is a standing talent
 *                    reduction and an aura cannot reach one ability, so
 *                    neither fits. The first such gap in the project.
 * ----------------------------------------------------------------------------
 */
export const DRUID_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Balance -------------------------------------------------------------

  improved_wrath: [
    { kind: 'abilityCastTime', abilityId: 'wrath' },
    // The SECOND value: "and its Mana cost by 50%". Index 0 is the half second.
    { kind: 'grantCastModifier', abilityIds: ['wrath'], property: 'costFraction', valueIndex: 1 },
  ],

  genesis: [
    {
      kind: 'unmodelled',
      reason:
        'Raises PERIODIC damage only. `abilityDamage` is per ability and ' +
        '`damageMultiplier` is everything, and neither can select the ticks.',
    },
  ],

  moonglow: [
    // "Your damaging spells" -- every nuke and both bleeds a Moonkin casts.
    {
      kind: 'grantCastModifier',
      abilityIds: ['wrath', 'starfire', 'moonfire', 'insect_swarm'],
      property: 'costFraction',
    },
  ],

  improved_moonfire: [
    { kind: 'abilityDamage', abilityId: 'moonfire' },
    { kind: 'abilityCrit', abilityId: 'moonfire' },
  ],

  nature_s_majesty: [
    { kind: 'stat', stat: 'spellCritChance', operation: 'flat' },
    { kind: 'stat', stat: 'critChance', operation: 'flat' },
  ],

  nature_s_reach: [
    { kind: 'unmodelled', scope: 'positioning', reason: 'Range, and nothing here has a position.' },
  ],

  improved_entangling_roots: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Entangling Roots is a root and is not implemented.' },
  ],

  nature_s_splendor: [
    {
      kind: 'unmodelled',
      reason:
        'Lengthens Moonfire and three healing spells. A per-ability aura ' +
        'duration bonus has no form: `abilityBonus` reaches the ability, and ' +
        'the duration lives on the aura it applies.',
    },
  ],

  insect_swarm: [{ kind: 'grantAbility', abilityId: 'insect_swarm' }],

  /*
   * LIVE NOW. Both of these were unmodelled for exactly one reason -- the
   * declarations available were per-ABILITY or whole-CHARACTER, and the
   * tooltips are per-SCHOOL. `schoolCritDamage` and `schoolDamage` are that
   * missing middle, and a Feral druid's melee crits are untouched because
   * `physical` is not on either list.
   */
  vengeance: [{ kind: 'schoolCritDamage', schools: ['arcane', 'nature'] }],

  improved_starfire: [
    { kind: 'abilityCastTime', abilityId: 'starfire' },
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Its 15% stun is out of scope, as every stun is.' },
  ],

  overgrowth: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Entangling Roots targets.' }],

  nature_s_grace: [
    /*
     * NOT A ONE-SHOT, AND I HAD THIS WRONG. Forever's wording is "increasing
     * your spellcasting speed and reducing your global cooldown by 10% for 3
     * sec" -- a three-second HASTE window off a spell crit, not Classic's
     * shorten-the-next-cast. It was recorded here and in CLAUDE.md as wanting
     * the Eclipse rule, and it wants a reaction and an aura the engine has had
     * all along.
     *
     * Reachable and simply not written yet, which is a different claim from
     * "the engine cannot": see Elemental Devastation on the Shaman, which is
     * the same spell-crit-grants-an-aura shape.
     */
    {
      kind: 'unmodelled',
      reason:
        'A 3-second haste window from a non-periodic spell crit. Reachable -- ' +
        'a cast-crit reaction plus a haste aura, both of which exist -- and ' +
        'not written yet. Its global cooldown clause is separate: haste does ' +
        'not affect the global cooldown in this engine.',
    },
  ],

  eclipse: [
    /*
     * LIVE, and it was the talent that asked for the engine rule. Wrath grants
     * the charges in its own `onCast` and Starfire spends them, so what the
     * talent hands over is the per-rank half second -- 0.17, 0.33, 0.5 -- as
     * the SECOND value in its row. Index 0 is the "next 2 Starfires" count.
     */
    { kind: 'abilityBonus', abilityId: 'wrath', key: 'eclipseReductionSeconds', valueIndex: 1 },
  ],

  moonfury: [{ kind: 'schoolDamage', schools: ['arcane', 'nature'] }],

  moonkin_form: [
    {
      kind: 'unmodelled',
      reason:
        'The form is a COMBAT STYLE chosen at creation rather than a talent ' +
        'effect, so the Moonkin preset is already in it. Its armor and party ' +
        'aura are not modelled.',
    },
  ],

  // --- Feral Combat --------------------------------------------------------

  ferocity: [
    { kind: 'abilityCost', abilityId: 'maul' },
    { kind: 'abilityCost', abilityId: 'mangle' },
    { kind: 'abilityCost', abilityId: 'swipe' },
    { kind: 'abilityCost', abilityId: 'claw' },
    { kind: 'abilityCost', abilityId: 'rake' },
  ],

  heart_of_the_wild: [
    { kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 },
    {
      kind: 'unmodelled',
      reason:
        'The intellect applies. Its per-form stamina and attack power clauses ' +
        'do not: a stat conditional on the form held has no declaration.',
    },
  ],

  feral_swiftness: [{ kind: 'stat', stat: 'dodgeChance', operation: 'flat' }],

  feral_instinct: [{ kind: 'abilityDamage', abilityId: 'swipe' }],

  brutal_impact: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Stun duration, which is out of scope.' }],

  thick_hide: [{ kind: 'itemArmorPercent' }],

  savage_fury: [
    { kind: 'abilityDamage', abilityId: 'claw' },
    { kind: 'abilityDamage', abilityId: 'rake' },
    { kind: 'abilityDamage', abilityId: 'shred' },
    { kind: 'abilityDamage', abilityId: 'maul' },
    { kind: 'abilityDamage', abilityId: 'swipe' },
  ],

  feral_charge: [
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason: 'A charge that immobilises and interrupts, and every fight opens in combat.',
    },
  ],

  sharpened_claws: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  shredding_attacks: [
    { kind: 'abilityCost', abilityId: 'shred' },
    {
      kind: 'unmodelled',
      reason: 'The Shred reduction applies. Its Lacerate clause is a second value the effect cannot read.',
    },
  ],

  mangle: [{ kind: 'grantAbility', abilityId: 'mangle' }],

  predatory_strikes: [
    {
      kind: 'unmodelled',
      reason:
        'Attack power from a percentage of LEVEL, conditional on the form held. ' +
        'Neither the derivation nor the condition has a declaration.',
    },
  ],

  primal_fury: [{ kind: 'reaction', reactionId: 'primal_fury' }],

  predatory_instincts: [{ kind: 'critDamageBonus' }],

  leader_of_the_pack: [
    {
      kind: 'unmodelled',
      reason:
        'A party-wide crit aura. The engine simulates one character, so it is ' +
        'the raid buff of the same name -- selectable there rather than granted here.',
    },
  ],

  king_of_the_jungle: [
    {
      kind: 'unmodelled',
      reason:
        "Grants energy when Tiger's Fury is used. It is a CAST reaction, which " +
        'the engine now has -- this is reachable and simply not written yet.',
    },
  ],

  natural_reaction: [
    { kind: 'stat', stat: 'dodgeChance', operation: 'flat' },
    {
      kind: 'unmodelled',
      reason: 'The dodge applies. Its rage on dodge needs the target to swing back.',
    },
  ],

  rend_and_tear: [
    {
      kind: 'unmodelled',
      reason:
        'Raises melee damage against BLEEDING targets. A damage multiplier ' +
        'conditional on an aura being on the target has no declaration.',
    },
  ],

  berserk: [
    {
      kind: 'unmodelled',
      reason:
        'Three clauses, and the engine reaches none: extra targets, a cooldown ' +
        'removed for a duration, and crit on combo-point abilities.',
    },
  ],

  // --- Restoration ---------------------------------------------------------

  nature_s_focus: [
    { kind: 'unmodelled', reason: 'Avoiding interruption, and nothing interrupts a cast here.' },
  ],

  furor: [
    {
      kind: 'unmodelled',
      reason: 'Pays out ON SHAPESHIFTING, and a form is fixed at creation like a stance.',
    },
  ],

  naturalist: [
    /*
     * "Increases all damage you deal" with no condition, which is the one
     * blanket multiplier in this tree that is genuinely blanket. Expressed as
     * `conditionalDamage` with no requirement, the only declaration that
     * reaches `damageMultiplier`.
     */
    { kind: 'conditionalDamage', requires: {} },
    { kind: 'unmodelled', scope: 'healing', reason: 'The damage applies. Its Healing Touch cast time does not.' },
  ],

  subtlety: [{ kind: 'unmodelled', scope: 'threat', reason: 'Threat, which the engine does not track.' }],

  natural_shapeshifter: [
    { kind: 'unmodelled', reason: 'The cost of shifting, and a form is fixed at creation.' },
  ],

  reflection: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],

  gift_of_nature: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing, and no profile here heals.' }],
  gift_of_the_earthmother: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing spells only.' }],
  tranquil_spirit: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing spells only.' }],
  improved_rejuvenation: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing, and no profile here heals.' }],
  swiftmend: [{ kind: 'unmodelled', scope: 'healing', reason: 'A heal, and no profile here heals.' }],

  nature_s_swiftness: [
    {
      kind: 'unmodelled',
      reason:
        'Makes the NEXT Nature spell instant. A one-shot cast-time modifier, ' +
        'which is the gap Eclipse and the Nature Grace talent share.',
    },
  ],

  living_spirit: [{ kind: 'stat', stat: 'spirit', operation: 'percentAdd', scale: 0.01 }],
  improved_tranquility: [{ kind: 'unmodelled', scope: 'healing', reason: 'Threat and a healing cooldown.' }],
  improved_regrowth: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing, and no profile here heals.' }],
  wild_growth: [{ kind: 'unmodelled', scope: 'healing', reason: 'A heal, and no profile here heals.' }],
};
