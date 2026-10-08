import type { TalentEffects } from './TalentEffect';
import { PARTY_CRIT_AURA_ID } from '../auras/druid';

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

  /*
   * "Increases the range of your offensive Balance spells by 20% and improves
   * your chance to hit by 4%."
   *
   * TWO CLAUSES, AND THE `scope` SWALLOWED BOTH. This read as a single
   * `positioning` entry -- "Range, and nothing here has a position" -- which is
   * true of the FIRST clause and says nothing about the second. So the talent
   * was counted as RULED OUT in the census rather than as a live gap, and 4% hit
   * went missing on all three Druid profiles, every one of which takes it at
   * rank 2.
   *
   * THAT IS THE WORST WAY FOR A CLAUSE TO GO MISSING. A `scope` is permanent by
   * design -- it is the owner's ruling and it "does not expire, and must not be
   * counted against the milestone" -- so a second clause hidden behind one is
   * invisible to the audit that exists to find unfinished work.
   *
   * AND THE NAME IS WHY, which is worth saying because it will happen again:
   * Classic's Nature's Reach is range and nothing else, so the name reads as a
   * positioning talent and the first clause confirms it. Forever added the hit.
   * **Read every clause before writing a scope**, and never from the name.
   *
   * ONE `hitChance` REACHES MELEE AND SPELLS BOTH, which is what the tooltip
   * says and what this engine already does: `attackChances` reads the one
   * character-wide stat for the spell table and through `missFromSkill` for the
   * melee ones. So the Moonkin's spells and the Cat's and Bear's abilities are
   * all covered by this single entry, with no per-table split needed.
   *
   * INDEX 1, because index 0 is the 20% RANGE -- the Naturalist shape, on a
   * talent that had no value-reading effect at all to be caught by.
   */
  nature_s_reach: [
    { kind: 'stat', stat: 'hitChance', operation: 'flat', valueIndex: 1 },
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason: 'Its RANGE clause only, and nothing here has a position. The hit applies.',
    },
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
  /*
   * ITS THIRD CLAUSE IS LIVE NOW, AND THE REASON IT CARRIED WAS TRUE WHEN IT
   * WAS WRITTEN: "Omen of Clarity's trigger chance is doubled, and Omen of
   * Clarity is not declared -- it is in the captured spellbook and no profile
   * casts it, so there is no proc here for this to double." There is a proc
   * now, and the doubling is applied by `omenOfClarityChanceFor` -- 8% in
   * Moonkin form against 4% everywhere else.
   *
   * **A REASON SPECIFIC ENOUGH TO RE-READ IS WHAT MADE THIS FINDABLE** the day
   * the proc landed. It named the blocker rather than the symptom, so clearing
   * the blocker pointed straight back here.
   *
   * All three clauses of Moonkin Form are expressed and nothing is left
   * unmodelled on it.
   */
  moonkin_form: [
    { kind: 'grantAura', auraId: PARTY_CRIT_AURA_ID, requires: { styles: ['moonkin'] } },
    { kind: 'itemArmorPercent' },
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

  /*
   * "Increases your movement speed while in Cat Form by {0}%, and increases
   * your chance to Dodge by {1}%."
   *
   * --------------------------------------------------------------------------
   * THE FOURTH VALUE-INDEX BUG IN THIS CLASS, and the one the ruleset owner
   * spotted from the number alone: "I think it's giving 30% chance to dodge
   * instead of 4%." Its row holds TWO numbers -- `[30, 4]` at rank 2 -- and the
   * dodge effect declared no `valueIndex`, so it read index 0 and granted the
   * MOVEMENT SPEED as dodge. Both feral presets take it at rank 2, so both
   * carried +30 dodge instead of +4.
   *
   * WHY NOTHING CAUGHT IT: the talent reported itself FULLY MODELLED, it
   * granted a real stat to a real build, and 30 is not an absurd dodge figure
   * for a bear. The Cat read 45.95% and the Bear 45.45% -- high, and the Cat is
   * never attacked, so only the Bear's fight could ever have shown it.
   *
   * FIXING IT MAKES THE BEAR TAKE MORE DAMAGE, and rage IS a share of damage
   * taken -- the pre-armor figure, so avoidance reduces it where armor does
   * not. Measured on the Bear: damage taken 185385 -> 282434, deaths 8.6 ->
   * 13.9, rage 669 -> 751, DPS +10.4. **It is the larger half of this commit
   * and it is not an improvement to the talent** -- the Bear is simply paying
   * the right price for 26 points of dodge it never had.
   *
   * THE MOVEMENT SPEED IS INDEX 0 AND IS OUT OF SCOPE, declared so rather than
   * left silent: a talent with one clause modelled and one ruled out that says
   * nothing reads as fully modelled, which is exactly the state that hid the
   * dodge index.
   * --------------------------------------------------------------------------
   */
  feral_swiftness: [
    { kind: 'stat', stat: 'dodgeChance', operation: 'flat', valueIndex: 1 },
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason: 'Movement speed in Cat Form, which is out of scope.',
    },
  ],

  feral_instinct: [{ kind: 'abilityDamage', abilityId: 'swipe' }],

  brutal_impact: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Stun duration, which is out of scope.' }],

  /*
   * "While in Bear Form, Cat Form, Dire Bear Form, or Moonkin Form, you gain
   * {0} additional base Armor per level and another {1} base Armor for each
   * point of defense skill beyond five times your level. This amount can be
   * further increased by multipliers from those forms."
   *
   * --------------------------------------------------------------------------
   * NOT THE WRONG INDEX BUT THE WRONG RULE, which is why it survived the sweep
   * that found the other four. It was `itemArmorPercent`, which computes
   * `itemArmor x value / 100` -- exactly right for Toughness, whose text says
   * "your Armor value FROM ITEMS", and an expression of NEITHER clause here.
   * At rank 3 it paid 3% of the Bear's 1793 item armor, about 54, against a
   * first clause worth 3 x 60 = 180 on its own.
   *
   * `tests/game/talentValueIndex.test.ts` recorded the finding and pinned the
   * wrong declaration on purpose, so the fix would have a before. This is it.
   *
   * TWO CLAUSES, TWO MECHANISMS, BOTH NEW UNITS RATHER THAN NEW RULES:
   *
   *   - `statFromLevel` with `scale: 1` is "per level" instead of "% of
   *     level", resolved once because level cannot be buffed.
   *   - `statFromStat` from `defenseSkill` with `scale: 1` is "per point", and
   *     it goes through the DERIVATION so it follows a buffed defense skill.
   *     `defenseSkill` holds only the surplus above five per level, which is
   *     precisely what the clause asks for -- `Combatant.defenseSkill` adds
   *     the baseline back and this stat never carries it. The Bear's 47 points
   *     of surplus are worth another 94 armor at rank 3.
   *
   * SO RANK 3 IS 274 ARMOR, not 54. The forms are the four the text names;
   * Dire Bear is not a separate style here, so `bear` covers both.
   *
   * AND IT IS WORTH ALMOST NOTHING TO THE BEAR'S DAMAGE, which is not what
   * was predicted here before it was measured. The prediction was "more armor
   * means less damage taken means less rage, so the Bear's DPS falls" -- and
   * **ARMOR DOES NOT REDUCE RAGE**: rage from damage taken is `D x 10 / H` off
   * the PRE-ARMOR figure, which `resourceRules.ts` states in those words and
   * CLAUDE.md repeats. A block reduces it and Defensive Stance reduces it;
   * armor is the one that does not. Measured, the 220 armor takes damage taken
   * from 282434 to 275129 (-2.6%) and rage from 751 to 750, so the DPS move is
   * -1.7, well inside a +/-5 interval. **The rule that contradicted the guess
   * was already written down in two places.**
   *
   * THE LAST SENTENCE IS ALREADY TRUE AND NEEDS NOTHING: Moonkin Form's own
   * +360% is an `itemArmorPercent` on the ITEM contribution, so it does not
   * multiply this and the text's "multipliers from those forms" refers to
   * something the engine applies elsewhere or not at all. Recorded because a
   * reader looking for the multiplier should not conclude it was missed.
   * --------------------------------------------------------------------------
   */
  thick_hide: [
    {
      kind: 'statFromLevel',
      to: 'armor',
      valueIndex: 0,
      scale: 1,
      requires: { styles: ['bear', 'cat', 'moonkin'] },
    },
    {
      kind: 'statFromStat',
      from: 'defenseSkill',
      to: 'armor',
      valueIndex: 1,
      scale: 1,
      requires: { styles: ['bear', 'cat', 'moonkin'] },
    },
  ],

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

  /*
   * THE TALENT IS `primal_bite` AND THE ABILITY IT GRANTS IS STILL `mangle`,
   * which is not a typo. Forever renamed Mangle to Primal Bite; the ability's
   * internal id was deliberately left alone -- rotations, tests and the Berserk
   * aura all key off it -- and the TALENT's id is derived from the client's
   * name, so the two parted company. `MANGLE.name` is "Primal Bite" and that is
   * what a reader sees. See `abilities/druid.ts`.
   */
  primal_bite: [{ kind: 'grantAbility', abilityId: 'mangle' }],

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

  /*
   * "Gives you a 100% chance to gain an additional 5 Rage any time you get a
   * critical strike while in Bear Form or Dire Bear Form. IN ADDITION, your
   * non-periodic critical strikes from Cat Form abilities that generate Combo
   * Points have a 100% chance to add an additional Combo Point."
   *
   * ------------------------------------------------------------------------
   * TWO CLAUSES AND THE SECOND ONE WAS NEVER READ. This was a single `reaction`
   * taking value index 0 -- the rage chance -- and granting rage. The row has
   * THREE numbers, `[100, 5, 100]` at rank 2, and index 2 is the combo point
   * clause: a Cat's crits from Shred, Claw and Rake should each be worth two
   * points, which is the Rogue's Seal Fate wearing a Druid's name.
   *
   * IT REPORTED ITSELF FULLY MODELLED, which is why nothing found it: there was
   * no `unmodelled` entry, so the census counted it in the `Fully` column and no
   * audit looks at a working talent for a clause it never mentions. The same
   * shape as Naturalist, on a different effect kind.
   *
   * AND THE RAGE CLAUSE WAS NOT BEAR-ONLY EITHER. Its reaction carried "the form
   * condition is not checked here and does not need to be: rage is the Bear's
   * resource, and `grantResource` finds no pool on a Cat". That is FALSE -- every
   * Druid owns every pool in every form, which this project's own test asserts
   * ("owns every pool in every form, so shifting conjures nothing") -- so the Cat
   * was gaining 100 rage a fight and wasting 62% of it. Harmless to its damage,
   * because a Cat has nothing to spend rage on, and wrong on the resource panel.
   * Both clauses are form-gated now, as the tooltip states them.
   * ------------------------------------------------------------------------
   */
  blood_frenzy: [
    {
      kind: 'reaction',
      reactionId: 'blood_frenzy',
      valueIndex: 0,
      requires: { styles: ['bear'] },
    },
    {
      kind: 'reaction',
      reactionId: 'blood_frenzy_combo_point',
      valueIndex: 2,
      requires: { styles: ['cat'] },
    },
  ],

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
    { kind: 'grantAura', auraId: PARTY_CRIT_AURA_ID, requires: { styles: ['cat', 'bear'] } },
  ],

  /*
   * KING OF THE JUNGLE IS GONE, with Tiger's Fury, the ability its only clause
   * named. Removed at client build 1.60.1.70170.
   *
   * SHIFTING POWER IS WHAT TOOK ITS PLACE IN THE TREE -- row 4 of Feral Combat,
   * requiring Shredding Attacks 3 -- and it does the same job from the other
   * end: King of the Jungle made a free cooldown refund 60 energy, and this buys
   * 40 energy with 55% of base mana.
   *
   * "Instantly convert 55% of base Mana into 40 Energy." Everything about it --
   * the cost, the cooldown, why the energy cap is not checked here -- is on
   * `SHIFTING_POWER` in `abilities/druid.ts`, and the talent is a plain grant.
   */
  shifting_power: [{ kind: 'grantAbility', abilityId: 'shifting_power' }],

  /*
   * "Reduces the cooldown of your Shifting Power spell by 4/8 sec."
   *
   * A FLAT SECONDS REDUCTION, so `abilityCooldown` is the kind -- the same one
   * Improved Arcane Shot and Improved Judgement use. At 2/2 it halves the
   * sixteen second cooldown, which is what the Cat build takes.
   */
  improved_shifting_power: [
    { kind: 'abilityCooldown', abilityId: 'shifting_power', unit: 'seconds' },
  ],

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
   * ------------------------------------------------------------------------
   * IT REACHES EVERY POINT OF MELEE DAMAGE -- the swings and the bleed TICKS as
   * well as the strikes -- AND THE OWNER'S OWN FIGURE IS WHAT DECIDED IT.
   *
   * This shipped scoped to `melee-special` and non-periodic, on the reading
   * CLAUDE.md states for `attackTableModifiers`: "melee ABILITIES stops at
   * melee-special, while melee critical strike damage says nothing about
   * abilities and therefore reaches the swing." That is a defensible reading of
   * the words and it is not the one the ruleset uses.
   *
   * THE ARITHMETIC IS UNAMBIGUOUS. The owner reported expecting "something like
   * 1.09x" and seeing "more like 1.025x". Measured over 30 batches, with the
   * target bleeding 89.3% of the fight:
   *
   *     melee-special, non-periodic      29.6% of damage    x1.0296
   *     plus the bleed TICKS             61.2%              x1.0612
   *     plus the AUTO-ATTACKS            94.8%              x1.0948
   *
   * Only the last reading produces 1.09, and the first produces 1.025 to the
   * decimal. **A stated expected VALUE settles a wording question that the
   * wording cannot.**
   *
   * SO RIP DOES RAISE RIP, and that is worth naming rather than leaving to be
   * discovered: a bleed's own ticks are amplified by the bleed being up, which
   * is self-referential and was the second reason the narrow reading was chosen
   * originally. The owner's figure includes it, so it is their call and not an
   * oversight.
   *
   * IT IS THE ONE SCOPE IN THE PIPELINE WHOSE DAMAGE FOLD READS `critFrom`.
   * Every other table-keyed multiplier reads `attackTable` alone -- see the note
   * on `tableMultiplier` in `damage.ts` -- so this deviation is declared there
   * too, because a reader who knows that rule would otherwise read this as a bug.
   *
   * THE BLEED IS ASKED OF THE AURAS, not of a list of ids: Rake, Rip and
   * Lacerate declare `isBleed`, so a fourth Druid bleed is covered the day it
   * lands. Both feral profiles hold one up almost continuously.
   * ------------------------------------------------------------------------
   */
  rend_and_tear: [
    { kind: 'bleedingTargetDamage', tables: ['melee-auto', 'melee-special'] },
  ],

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
