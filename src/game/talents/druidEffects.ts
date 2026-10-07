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
 *   FORM SHIFTING    two talents, and only two. Furor and Natural Shapeshifter
 *                    pay out ON THE SHIFT, and a form is fixed at creation
 *                    like a Warrior's stance.
 *   THREAT           unchanged and unchangeable: the engine does not track it.
 *
 * ----------------------------------------------------------------------------
 * "FIVE TALENTS KEY OFF THE FORM" WAS THE WRONG COUNT, and it mattered,
 * because it was written up as one engine gap wearing five hats. Only TWO of
 * them ask about SHIFTING. The other three -- Moonkin Form, Predatory Strikes
 * and Heart of the Wild's per-form clauses -- ask WHICH FORM IS HELD, and a
 * Druid's form IS its combat style: a field the preset sets and the character
 * is built with, as knowable before the pull as the weapon in its hand.
 *
 * `BuildRequirement.styles` is that distinction made into data. Three talents
 * came off the queue for it and nothing about shapeshifting was modelled.
 *
 * THE ONE-SHOT CAST MODIFIER GAP IS CLOSED TOO. This header used to call it
 * "the first such gap in the project"; the rule arrived with Eclipse, and
 * Nature's Swiftness is its second caller -- an aura carrying a `castModifier`
 * that names the abilities and is spent by the cast that uses it.
 * ----------------------------------------------------------------------------
 */
export const DRUID_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Balance -------------------------------------------------------------

  improved_wrath: [
    { kind: 'abilityCastTime', abilityId: 'wrath' },
    // The SECOND value: "and its Mana cost by 50%". Index 0 is the half second.
    { kind: 'grantCastModifier', abilityIds: ['wrath'], property: 'costFraction', valueIndex: 1 },
  ],

  /*
   * "Increases the periodic damage and healing done by your spells and
   * abilities by 5%." Every tick, whatever cast it, and nothing that is not a
   * tick -- which is an axis none of the three modifier scopes can see. Its
   * old reason said exactly that: "`abilityDamage` is per ability and
   * `damageMultiplier` is everything, and neither can select the ticks."
   *
   * ALL THREE PROFILES TAKE IT and it reaches all three: Moonfire and Insect
   * Swarm on the Moonkin, Rake and Rip on the Cat, Lacerate on the Bear.
   */
  genesis: [
    { kind: 'periodicDamage' },
    {
      kind: 'unmodelled',
      scope: 'healing',
      reason: 'Its periodic HEALING half, and no profile here heals.',
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

  /*
   * "Increases the duration of your Moonfire and Rejuvenation spells by 3 sec,
   * your Regrowth spell by 6 sec, and your Insect Swarm spell by 2 sec."
   *
   * FOUR SPELLS, TWO OF WHICH THIS PROJECT HAS. The two healing figures stay in
   * the values row -- dropping them would renumber the two that are read -- so
   * the indices follow the sentence's own order and the Insect Swarm clause is
   * index 3 rather than index 1.
   *
   * THE DURATION LIVES ON THE AURA AND A TALENT REACHES THE ABILITY, which is
   * what the old `unmodelled` reason correctly identified. `abilityBonus` is the
   * bridge, and it already existed for Eclipse: the number is handed to the
   * ability's `onCast`, which lengthens the aura it is about to apply.
   *
   * IT ADDS TICKS AT THE SAME RATE rather than spreading a fixed total thinner,
   * because every DoT here computes its per-tick figure from its own constants.
   * See `lengthened` in `auras/druid.ts` -- the other reading would make the
   * talent worth exactly nothing.
   */
  nature_s_splendor: [
    { kind: 'abilityBonus', abilityId: 'moonfire', key: 'auraDurationBonusSeconds', valueIndex: 0 },
    {
      kind: 'abilityBonus',
      abilityId: 'insect_swarm',
      key: 'auraDurationBonusSeconds',
      valueIndex: 3,
    },
    {
      kind: 'unmodelled',
      scope: 'healing',
      reason: 'Its Rejuvenation and Regrowth clauses, and no profile here heals.',
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

  /*
   * FOREVER'S IS A THREE-SECOND WINDOW, NOT CLASSIC'S ONE-SHOT, and this file
   * had it the other way round once: "increasing your spellcasting speed and
   * reducing your global cooldown by 10% for 3 sec" wants a reaction and an
   * aura, where Classic's shorten-the-next-cast wants the Eclipse rule.
   *
   * ITS TWO CLAUSES ARE TWO EFFECTS. The haste half was reachable all along;
   * the global cooldown half was not, because haste deliberately does not
   * touch the global cooldown in this engine and `baseGcdMs` had no aura path
   * to it. `AuraDefinition.gcdFraction` is that path, added here.
   *
   * IT COST THE MOONKIN 14.9 DPS, AND THE TALENT WAS NOT WHAT WAS WRONG. The
   * buff does what it says -- casts went from 26.3 a fight to 27.4 -- and the
   * DoTs lost ticks, Moonfire 25.1 to 22.5 and Insect Swarm 27.9 to 25.5,
   * because that list refreshed them on a two-second window and a refresh
   * RESETS the aura. Acting faster reaches the window earlier and clips more.
   * THE FIGURE MEASURED A LIST THAT NO LONGER EXISTS: the owner's replacement
   * refreshes on "not active", so the cost is gone and the lesson is not.
   */
  nature_s_grace: [{ kind: 'reaction', reactionId: 'nature_s_grace' }],

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

  /*
   * "Transforms the Druid into Moonkin Form. While in this form, the armor
   * contribution from items is increased by 360%, Omen of Clarity gains 100%
   * increased chance to trigger, and all party members within 45 yards have
   * their critical strike chance increased by 3%, exclusive with Leader of the
   * Pack."
   *
   * THE FORM ITSELF IS STILL A COMBAT STYLE and the Moonkin preset is already
   * in it -- that half of the old reason was right and has not changed. What
   * was wrong was the conclusion drawn from it: the form being a style does not
   * stop the talent's CLAUSES applying, and two of the three now do.
   *
   * THE PARTY AURA IS THE RAID BUFF OF THE SAME NAME, granted here so a Moonkin
   * carries it whether or not that buff is ticked, and sharing the buff's aura
   * id so it cannot be counted twice. It EXCLUDES Leader of the Pack by the
   * owner's ruling, which is why the Moonkin preset no longer selects that raid
   * buff -- its crit is +3% either way.
   *
   * THE ARMOR IS `itemArmorPercent`, the declaration Thick Hide uses and
   * exactly what "the armor contribution FROM ITEMS" means. Worth nothing to a
   * Moonkin nothing attacks, and right the day something does.
   */
  moonkin_form: [
    { kind: 'grantAura', auraId: 'moonkin_form', requires: { styles: ['moonkin'] } },
    { kind: 'itemArmorPercent' },
    {
      kind: 'unmodelled',
      reason:
        "Omen of Clarity's trigger chance is doubled, and Omen of Clarity is " +
        'not declared -- it is in the captured spellbook and no profile casts ' +
        'it, so there is no proc here for this to double.',
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

  /*
   * "Increases your Intellect by 10%. In addition, while in Bear Form or Dire
   * Bear Form your Stamina is increased by 20% and while in Cat Form your
   * Strength is increased by 10%."
   *
   * THREE CLAUSES, THREE STATS, TWO OF THEM FORM-GATED. Its old reason said "a
   * stat conditional on the form held has no declaration", which was true and
   * is not: `BuildRequirement.styles` is that declaration.
   *
   * FOREVER'S CAT CLAUSE IS STRENGTH, NOT ATTACK POWER, which is what Classic
   * gives and what the old reason repeated. Strength makes attack power through
   * the class table, so the effect is similar and the number is not -- and as a
   * modifier it follows a buffed strength, which a flat attack power would not.
   */
  heart_of_the_wild: [
    { kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01, valueIndex: 0 },
    {
      kind: 'stat',
      stat: 'stamina',
      operation: 'percentAdd',
      scale: 0.01,
      valueIndex: 1,
      requires: { styles: ['bear'] },
    },
    {
      kind: 'stat',
      stat: 'strength',
      operation: 'percentAdd',
      scale: 0.01,
      valueIndex: 2,
      requires: { styles: ['cat'] },
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

  /*
   * "Reduces the Energy cost of your Shred ability by 18 and reduces the Rage
   * cost of your Lacerate ability by 3."
   *
   * TWO ABILITIES, TWO NUMBERS, and the second is why `abilityCost` gained a
   * `valueIndex`. Without one, a second entry would have taken 18 RAGE off a
   * 15-rage ability -- not a small error but the ability made free -- so the
   * clause was carried as unmodelled instead. That was the right call and it
   * has expired.
   *
   * NO PROFILE USES BOTH HALVES. The Cat takes this talent and never casts
   * Lacerate; the Bear casts Lacerate and does not take this. The second clause
   * is worth zero DPS to the three builds and is still the difference between a
   * talent that is expressed and one that is not.
   */
  shredding_attacks: [
    { kind: 'abilityCost', abilityId: 'shred', valueIndex: 0 },
    { kind: 'abilityCost', abilityId: 'lacerate', valueIndex: 1 },
  ],

  mangle: [{ kind: 'grantAbility', abilityId: 'mangle' }],

  /*
   * "Increases your melee Attack Power in Cat Form, Bear Form, and Dire Bear
   * Form by 150% of your level" -- 90 attack power at 60.
   *
   * ITS OLD REASON NAMED TWO MISSING DECLARATIONS AND BOTH NOW EXIST:
   * `statFromLevel` is the derivation and `BuildRequirement.styles` is the
   * condition. Dire Bear is Bear here, because the engine has one bear style.
   *
   * MELEE ATTACK POWER, so `attackPower` and not `rangedAttackPower`. Forever
   * names the ranged pool explicitly wherever it means it -- the point Careful
   * Aim turned on -- and this one says melee.
   */
  predatory_strikes: [
    { kind: 'statFromLevel', to: 'attackPower', requires: { styles: ['cat', 'bear'] } },
  ],

  primal_fury: [{ kind: 'reaction', reactionId: 'primal_fury' }],

  predatory_instincts: [{ kind: 'critDamageBonus' }],

  /*
   * "While in Cat Form, Bear Form, or Dire Bear Form, the Leader of the Pack
   * increases the critical strike chance of all party members within 45 yards
   * by 3%, exclusive with Moonkin Aura."
   *
   * THE OLD REASON WAS TRUE AND WAS NOT THE WHOLE STORY. It is the raid buff of
   * the same name -- and a druid who takes the talent IS the druid that buff
   * represents. Granting it here means a feral build carries its own 3% whatever
   * the raid buff panel says, and the SHARED AURA ID means a build with both
   * counts it once: `AuraCollection.apply` refreshes a matching id rather than
   * stacking a second aura.
   *
   * ZERO DPS ACROSS ALL 23 PROFILES, because every preset already selects the
   * raid buff. That is the point -- the talent stops being a gap without any
   * figure moving, which is the containment check for this kind of change.
   */
  leader_of_the_pack: [
    { kind: 'grantAura', auraId: 'leader_of_the_pack', requires: { styles: ['cat', 'bear'] } },
  ],

  /*
   * "Tiger's Fury now instantly grants you 60 Energy."
   *
   * ITS OWN REASON SAID IT WAS REACHABLE -- "it is a CAST reaction, which the
   * engine now has -- this is reachable and simply not written yet" -- which is
   * what an honest expired reason looks like, and why they are written
   * specifically enough to re-read.
   */
  king_of_the_jungle: [{ kind: 'castReaction', reactionId: 'king_of_the_jungle' }],

  /*
   * "Increases your dodge chance by 5%, and gives you a 100% chance to gain 5
   * Rage each time you dodge."
   *
   * ITS RAGE CLAUSE WAS NEVER BLOCKED. The old reason said it "needs the target
   * to swing back", and the Bear preset sets `targetAttacks: true` -- it is the
   * one Druid build that is hit, and that preset's own comment names Natural
   * Reaction as a reason for the setting. A reason blaming the ENCOUNTER is
   * worth checking against the encounter.
   *
   * Index 1 is the chance. The rage is a flat 5 at every rank and is named on
   * the reaction, exactly as the Warrior's Master of Defense does it.
   */
  natural_reaction: [
    { kind: 'stat', stat: 'dodgeChance', operation: 'flat', valueIndex: 0 },
    { kind: 'reaction', reactionId: 'natural_reaction', valueIndex: 1 },
  ],

  /*
   * "Increases damage done by your melee abilities on Bleeding targets by 10%."
   *
   * MELEE ABILITIES, SO `melee-special` AND NOT THE SWING. "Abilities" is the
   * word that decides it -- the reading Savage Strikes gets on the Hunter --
   * and it costs this talent about half of what it would otherwise be worth to
   * a Cat, whose main hand is 46% of its damage.
   *
   * THE BLEED IS ASKED OF THE AURAS, not of a list of ids: Rake, Rip and
   * Lacerate declare `isBleed`, so a fourth Druid bleed is covered the day it
   * lands. Both feral profiles hold one up almost continuously -- Rip and Rake
   * on the Cat, Lacerate on the Bear -- which is what makes this worth taking.
   */
  rend_and_tear: [{ kind: 'bleedingTargetDamage', tables: ['melee-special'] }],

  /*
   * THE ABILITY WAS BUILT AND THE TALENT NEVER GRANTED IT.
   *
   * `abilities/druid.ts` has carried Berserk -- with `suppressesCooldownOf` and
   * +100 crit on every combo point generator, two aura fields written for it --
   * while this entry said "the engine reaches none" of its clauses, and the
   * ability sat in the BASE list so every Druid had it. The Moonkin's audit
   * line read "in book, never cast: ... berserk", which is exactly what an
   * ability nobody should have looks like.
   *
   * The two clauses the engine does not reach are on the ability itself, where
   * the results page prints them: three targets on a one-target encounter, and
   * Fear immunity, which is crowd control.
   */
  berserk: [{ kind: 'grantAbility', abilityId: 'berserk' }],

  // --- Restoration ---------------------------------------------------------

  /*
   * "Gives you a 70% chance to avoid interruption caused by damage while casting
   * Arcane and Nature spells."
   *
   * TWO REASONS, AND THE ENGINE ONE IS THE REAL ONE. Spell pushback from damage
   * taken is not modelled at all -- no cast in this engine is ever lengthened by
   * being hit -- so this would be inert even on a caster something attacked, and
   * the Moonkin faces a standing target on top of that. Recorded as an ENGINE
   * gap rather than an encounter one, because the encounter claim is the weaker
   * of the two and would expire first.
   */
  nature_s_focus: [
    {
      kind: 'unmodelled',
      scope: 'castPushback',
      reason:
        'Avoiding interruption from damage while casting, which is out of scope ' +
        "by the ruleset owner's 2026-09-30 ruling.",
    },
  ],

  /*
   * THE FORM-SHIFTING GAP, and it is exactly TWO talents rather than the five it
   * was once written up as. Both wordings are deliberately the same sentence, so
   * that the day mid-fight shifting is modelled both are findable by it -- the
   * discipline that has paid for itself six times.
   */
  furor: [
    {
      kind: 'unmodelled',
      reason:
        'Pays out ON SHAPESHIFTING, and a form is fixed at creation like a ' +
        'stance -- nothing in a fight can change one.',
    },
  ],

  naturalist: [
    /*
     * "Reduces the cast time of your Healing Touch spell by 0.5 sec and
     * increases all damage you deal by 5%."
     *
     * THE SECOND NUMBER, AND READING THE FIRST COST A FACTOR OF TEN. The row
     * is `[0.5, 5]` -- a number of SECONDS and then a percentage -- and
     * `conditionalDamage` had no `valueIndex`, so it read 0.5 as a percentage
     * and a rank-5 Moonkin carried x1.005 where it should carry x1.05.
     *
     * NOTHING COULD HAVE NOTICED. Half a percent is a perfectly plausible
     * blanket multiplier, the talent reported itself fully modelled, and the
     * only published check on it was a profile DPS figure that had been
     * measured with the bug in. It is the trap `abilityDamage.valueIndex`
     * already documents on Improved Corruption, on a sibling effect kind that
     * never got the field.
     *
     * "Increases all damage you deal" with no condition is the one blanket
     * multiplier in this tree that is genuinely blanket, which is why this is
     * `conditionalDamage` with an empty requirement -- the only declaration
     * that reaches `damageMultiplier` and therefore the auto-attacks too.
     */
    { kind: 'conditionalDamage', requires: {}, valueIndex: 1 },
    { kind: 'unmodelled', scope: 'healing', reason: 'The damage applies. Its Healing Touch cast time does not.' },
  ],

  subtlety: [{ kind: 'unmodelled', scope: 'threat', reason: 'Threat, which the engine does not track.' }],

  natural_shapeshifter: [
    {
      kind: 'unmodelled',
      reason:
        'Reduces the cost of SHAPESHIFTING, and a form is fixed at creation ' +
        'like a stance -- nothing in a fight can change one.',
    },
  ],

  reflection: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],

  gift_of_nature: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing, and no profile here heals.' }],
  gift_of_the_earthmother: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing spells only.' }],
  tranquil_spirit: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing spells only.' }],
  improved_rejuvenation: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing, and no profile here heals.' }],
  swiftmend: [{ kind: 'unmodelled', scope: 'healing', reason: 'A heal, and no profile here heals.' }],

  /*
   * "When activated, your next Nature spell becomes an instant cast spell."
   *
   * THE ONE-SHOT CAST-TIME GAP IS CLOSED, and it was closed by Eclipse rather
   * than by this: an aura carrying a `castModifier` that names the abilities and
   * is spent by the cast that uses it. This is the rule's second caller, and the
   * Shaman's talent of the same name is the third.
   *
   * NO DRUID PROFILE TAKES IT, so it is worth nothing to the three builds and is
   * tested on its MECHANISM instead. Which spells count as Nature, and why an
   * instant must not eat the charge, are on the aura in `auras/druid.ts`.
   */
  nature_s_swiftness: [{ kind: 'grantAbility', abilityId: 'natures_swiftness' }],

  living_spirit: [{ kind: 'stat', stat: 'spirit', operation: 'percentAdd', scale: 0.01 }],
  improved_tranquility: [{ kind: 'unmodelled', scope: 'healing', reason: 'Threat and a healing cooldown.' }],
  improved_regrowth: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing, and no profile here heals.' }],
  wild_growth: [{ kind: 'unmodelled', scope: 'healing', reason: 'A heal, and no profile here heals.' }],
};
